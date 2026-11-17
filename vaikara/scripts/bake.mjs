// Offline world bake: turns src/world/layout.js into
//   public/assets/baked/world.bin.gz   heights (u16) + biome (rgba8) + coast distance (i16)
//   public/assets/baked/splatA.png      terrain weights: grass, forest, laterite, road
//   public/assets/baked/splatB.png      terrain weights: sand, mud, rock, meadow
//   public/assets/baked/map.png         painted overview map for the in-game map screen
//   public/assets/baked/meta.json       dimensions, ranges, stream ribbons
//   npm run bake
import { mkdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import * as L from '../src/world/layout.js';
import { makeNoise, fbm, ridged, clamp, lerp, smoothstep, segDist, pointInPoly, polySD, lineSide, smoothLine } from '../src/world/noise.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'public/assets/baked');
await mkdir(OUT, { recursive: true });
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

// ── Grids
const NX = 4097, NZ = 2731;                 // full-res heights
const CS = L.WORLD_W / (NX - 1);            // 1.953 m
const X0 = -L.WORLD_W / 2, Z0 = -L.WORLD_H / 2;
const HX = 2049, HZ = 1366, HS = CS * 2;    // half-res fields / splat
const QX = 1025, QZ = 683, QS = CS * 4;     // quarter-res biome
const HMIN = -60, HMAX = 740;

const nA = makeNoise(11), nB = makeNoise(23), nC = makeNoise(37), nD = makeNoise(51), nE = makeNoise(77);

// ── Half-res distance fields
const HN = HX * HZ;
const F = {
  coast: new Float32Array(HN), front: new Float32Array(HN), mangrove: new Float32Array(HN),
  paddy: new Float32Array(HN), salt: new Float32Array(HN), tea: new Float32Array(HN),
  teak: new Float32Array(HN), eleph: new Float32Array(HN),
  river: new Float32Array(HN).fill(1e4), riverId: new Uint8Array(HN), riverS: new Float32Array(HN),
  road: new Float32Array(HN).fill(1e4), roadT: new Uint8Array(HN),
  rail: new Float32Array(HN).fill(1e4),
};

const frontSign = Math.sign(lineSide(...L.toWorld(1450, 200), L.MOUNTAIN_FRONT)) || 1;

// polygon SD only computed exactly near the polygon (bbox + margin), else ±big
function polyField(arr, poly, margin) {
  let minx = Infinity, minz = Infinity, maxx = -Infinity, maxz = -Infinity;
  for (const [x, z] of poly) { minx = Math.min(minx, x); maxx = Math.max(maxx, x); minz = Math.min(minz, z); maxz = Math.max(maxz, z); }
  for (let j = 0; j < HZ; j++) {
    const z = Z0 + j * HS;
    for (let i = 0; i < HX; i++) {
      const x = X0 + i * HS;
      arr[j * HX + i] = (x < minx - margin || x > maxx + margin || z < minz - margin || z > maxz + margin) ? -margin : polySD(x, z, poly);
    }
  }
}

log('distance fields…');
for (let j = 0; j < HZ; j++) {
  const z = Z0 + j * HS;
  for (let i = 0; i < HX; i++) {
    const x = X0 + i * HS, k = j * HX + i;
    let c = polySD(x, z, L.COAST);
    for (const [ix, iz, r] of L.ISLETS) c = Math.max(c, r - Math.hypot(x - ix, z - iz));
    F.coast[k] = c;
    F.front[k] = lineSide(x, z, L.MOUNTAIN_FRONT) * frontSign;
  }
}
polyField(F.mangrove, L.MANGROVE, 300);
polyField(F.paddy, L.PADDY, 200);
polyField(F.salt, L.SALT_PANS, 200);
polyField(F.tea, L.TEA, 300);
polyField(F.teak, L.TEAK, 300);
polyField(F.eleph, L.ELEPHANT, 300);

// Splat a polyline into a field: keeps the min of (distance − halfWidth).
function splatLine(pts, reach, cb) {
  for (let s = 1; s < pts.length; s++) {
    const a = pts[s - 1], b = pts[s];
    const hw = Math.max(a[2] || 0, b[2] || 0) / 2;
    const R = hw + reach;
    const i0 = Math.max(0, Math.floor((Math.min(a[0], b[0]) - R - X0) / HS)), i1 = Math.min(HX - 1, Math.ceil((Math.max(a[0], b[0]) + R - X0) / HS));
    const j0 = Math.max(0, Math.floor((Math.min(a[1], b[1]) - R - Z0) / HS)), j1 = Math.min(HZ - 1, Math.ceil((Math.max(a[1], b[1]) + R - Z0) / HS));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const [d, t] = segDist(X0 + i * HS, Z0 + j * HS, a[0], a[1], b[0], b[1]);
      const w = lerp(a[2] || 0, b[2] || 0, t) / 2;
      cb(j * HX + i, d - w, s - 1 + t, w);
    }
  }
}

log('rivers…');
const RIVER_IDS = { vaikara: 1, ferry: 2, vellar: 3, muthal: 4 };
const riverLines = {};
for (const [name, pts] of Object.entries(L.RIVERS)) {
  const line = smoothLine(pts, 12);
  riverLines[name] = line;
  const id = RIVER_IDS[name];
  splatLine(line, 220, (k, e, s) => { if (e < F.river[k]) { F.river[k] = e; F.riverId[k] = id; F.riverS[k] = s; } });
}
log('roads…');
const ROAD_W = { main: 7, road: 5, trail: 2.6 };
const roadLines = L.ROADS.map((r) => ({ ...r, line: smoothLine(r.pts.map((p) => [...p, ROAD_W[r.type] * 2]), 6) }));
for (const r of roadLines) {
  const t = r.type === 'main' ? 1 : r.type === 'road' ? 2 : 3;
  splatLine(r.line, 30, (k, e) => { if (e < F.road[k]) { F.road[k] = e; F.roadT[k] = t; } });
}
const railLine = smoothLine(L.RAILWAY.map((p) => [...p, 6]), 8);
splatLine(railLine, 25, (k, e) => { if (e < F.rail[k]) F.rail[k] = e; });

// Bilinear field sample at full-res coordinates.
function bil(arr, x, z) {
  const fx = (x - X0) / HS, fz = (z - Z0) / HS;
  const i = Math.min(HX - 2, Math.max(0, Math.floor(fx))), j = Math.min(HZ - 2, Math.max(0, Math.floor(fz)));
  const tx = fx - i, tz = fz - j, k = j * HX + i;
  return lerp(lerp(arr[k], arr[k + 1], tx), lerp(arr[k + HX], arr[k + HX + 1], tx), tz);
}
const near = (arr, x, z) => arr[Math.min(HZ - 1, Math.max(0, Math.round((z - Z0) / HS))) * HX + Math.min(HX - 1, Math.max(0, Math.round((x - X0) / HS)))];

// ── Base height
function baseHeight(x, z) {
  const c = bil(F.coast, x, z);
  const n1 = fbm(nA, x / 1400, z / 1400, 5);
  const n2 = fbm(nB, x / 160, z / 160, 4);
  let h;
  // lowland
  let low = 1.8 + 5 * smoothstep(20, 700, c) + 7 * n1 * smoothstep(80, 900, c) + n2 * 0.6;
  low += Math.max(0, fbm(nB, x / 1100 + 9, z / 1100, 4) - 0.18) * 48 * smoothstep(250, 1100, c);
  // mountains
  const m = bil(F.front, x, z);
  const foot = smoothstep(-600, 150, m) * 34 * (0.65 + 0.35 * n1);
  let mt = 0;
  if (m > -200) {
    const r = ridged(nC, x / 1500, z / 1500, 6);
    const r2 = ridged(nD, x / 420, z / 420, 5);
    mt = smoothstep(-200, 300, m) * (760 * (1 - Math.exp(-Math.max(0, m + 200) / 1100)) * (0.38 + 0.62 * r) + r2 * 55 * smoothstep(0, 600, m));
  }
  low += (foot + mt) * smoothstep(0, 300, c);
  // Kanmala: the tea estate sits on rolling hills
  low += smoothstep(-350, 250, bil(F.tea, x, z)) * (45 + 25 * n1);
  // Black Rock Pass saddle
  const dp = Math.hypot(x - L.PASS.p[0], z - L.PASS.p[1]);
  const sad = Math.exp(-((dp / (L.PASS.r * 2.6)) ** 2));
  low = lerp(low, Math.min(low, 135 + dp * 0.12 + n2 * 4), sad);

  if (c >= 0) {
    const beach = 60 + 40 * (nE(x / 300, z / 300) * 0.5 + 0.5);
    h = lerp(-0.7, low, smoothstep(0, beach, c));
  } else {
    h = -0.7 - 30 * (1 - Math.exp(c / 520)) + n2 * 0.8 * smoothstep(-200, 0, c);
  }
  // mangrove maze
  const mg = smoothstep(-40, 140, bil(F.mangrove, x, z));
  if (mg > 0) {
    const hm = -1.0 + 2.6 * (fbm(nD, x / 150, z / 150, 4) + 0.12) + n2 * 0.3;
    h = lerp(h, hm, mg);
  }
  // paddy
  const pd = smoothstep(-40, 70, bil(F.paddy, x, z));
  if (pd > 0) {
    const u = (x * 0.94 + z * 0.34) / 42, v = (-x * 0.34 + z * 0.94) / 31;
    const bund = Math.max(smoothstep(0.93, 1, 1 - Math.abs(((u % 1) + 1) % 1 - 0.5) * 2 * 0.98 + 0.0), smoothstep(0.93, 1, 1 - Math.abs(((v % 1) + 1) % 1 - 0.5) * 2 * 0.98));
    h = lerp(h, 1.25 + n2 * 0.08 + bund * 0.4, pd);
  }
  // salt pans
  const sp = smoothstep(-20, 40, bil(F.salt, x, z));
  if (sp > 0) {
    const u = (x + 3) / 26, v = (z + 5) / 19;
    const fu = Math.abs((((u % 1) + 1) % 1) - 0.5) * 2, fv = Math.abs((((v % 1) + 1) % 1) - 0.5) * 2;
    const bund = Math.max(smoothstep(0.9, 0.97, fu), smoothstep(0.88, 0.96, fv));
    h = lerp(h, -0.14 + bund * 0.62, sp);
  }
  // tea terraces
  const te = smoothstep(-60, 90, bil(F.tea, x, z));
  if (te > 0) {
    const q = h / 3.4;
    const ht = (Math.floor(q) + smoothstep(0.72, 1, q - Math.floor(q))) * 3.4;
    h = lerp(h, ht, te * 0.8);
  }
  return h;
}

log('base heights (4097×2731)…');
const H = new Float32Array(NX * NZ);
for (let j = 0; j < NZ; j++) {
  const z = Z0 + j * CS;
  for (let i = 0; i < NX; i++) H[j * NX + i] = baseHeight(X0 + i * CS, z);
}

// ── Streams: sea-level rivers are carved; the Vellar gets a water profile.
log('carving rivers…');
const hAt = (x, z) => {
  const fx = (x - X0) / CS, fz = (z - Z0) / CS;
  const i = Math.min(NX - 2, Math.max(0, Math.floor(fx))), j = Math.min(NZ - 2, Math.max(0, Math.floor(fz)));
  const tx = fx - i, tz = fz - j, k = j * NX + i;
  return lerp(lerp(H[k], H[k + 1], tx), lerp(H[k + NX], H[k + NX + 1], tx), tz);
};
// Vellar profile per smoothed point
const vel = riverLines.vellar;
const fallsIdx = (() => {
  let best = 0, bd = Infinity;
  for (let i = 0; i < vel.length; i++) { const d = Math.hypot(vel[i][0] - L.FALLS.a[0], vel[i][1] - L.FALLS.a[1]); if (d < bd) { bd = d; best = i; } }
  return best;
})();
const velW = vel.map((p) => hAt(p[0], p[1]));
for (let i = 1; i < velW.length; i++) velW[i] = Math.min(velW[i], velW[i - 1] - 0.15);
// a 46 m drop at the falls: everything upstream is held up by the rock lip
const lip = velW[fallsIdx + 2] + 46;
for (let i = 0; i <= fallsIdx; i++) velW[i] = Math.max(velW[i], lip + (fallsIdx - i) * 0.35);
for (let i = 0; i < velW.length; i++) velW[i] = Math.max(velW[i], 0.2);
const velAt = (s) => { const i = Math.min(vel.length - 2, Math.max(0, Math.floor(s))); return lerp(velW[i], velW[i + 1], s - i); };
// map river segment param (in original control points) to smoothed index: we splatted smoothed lines, so s is already a smoothed index.

const DEPTH = { 1: 7, 2: 2.2, 4: 2.4 };
for (let j = 0; j < NZ; j++) {
  const z = Z0 + j * CS;
  for (let i = 0; i < NX; i++) {
    const x = X0 + i * CS, k = j * NX + i;
    const e = bil(F.river, x, z);
    if (e > 240) continue;
    const id = near(F.riverId, x, z);
    let h = H[k];
    if (id === 3) {
      const s = near(F.riverS, x, z);
      const Wl = velAt(s);
      const hw = 6;
      const bank = 34;
      void hw; void bank;
      const up = s <= fallsIdx + 0.5;
      if (e < 0) h = Wl - 1.4 * smoothstep(0, 6, -e) - 0.25;
      else {
        // V-shaped valley cut down to the water, with small banks to hold it
        h = Math.min(h, Wl + 0.6 + e * (up ? 0.9 : 0.42) + Math.max(0, e - 60) * 0.4);
        if (e < 5) h = Math.max(h, Wl + 0.35);
        // above the falls the stream runs on a rock shelf: raise the land to meet it
        if (up && e < 120) h = Math.max(h, lerp(Wl + 0.5, h, smoothstep(0, 120, e)));
      }
    } else {
      const d = DEPTH[id] || 3;
      const hw = 40;
      const bankW = id === 1 ? 70 : 22;
      if (e < 0) h = Math.min(h, -0.6 - d * smoothstep(0, hw, -e) + fbm(nE, x / 90, z / 90, 3) * 0.6);
      else if (e < bankW) h = Math.min(h, lerp(0.35, h, smoothstep(0, bankW, e)));
    }
    H[k] = h;
  }
}

// ── Smooth copy for road and settlement flattening
log('blur…');
function boxBlur(src, r, passes) {
  let a = Float32Array.from(src), b = new Float32Array(src.length);
  for (let p = 0; p < passes; p++) {
    for (let j = 0; j < NZ; j++) { // horizontal
      let acc = 0; const row = j * NX;
      for (let i = -r; i <= r; i++) acc += a[row + Math.min(NX - 1, Math.max(0, i))];
      for (let i = 0; i < NX; i++) {
        b[row + i] = acc / (2 * r + 1);
        acc += a[row + Math.min(NX - 1, i + r + 1)] - a[row + Math.max(0, i - r)];
      }
    }
    for (let i = 0; i < NX; i++) { // vertical
      let acc = 0;
      for (let j = -r; j <= r; j++) acc += b[Math.min(NZ - 1, Math.max(0, j)) * NX + i];
      for (let j = 0; j < NZ; j++) {
        a[j * NX + i] = acc / (2 * r + 1);
        acc += b[Math.min(NZ - 1, j + r + 1) * NX + i] - b[Math.max(0, j - r) * NX + i];
      }
    }
  }
  return a;
}
const HB = boxBlur(H, 10, 3);

log('roads & settlements…');
const SETTLE = L.PLACES.filter((p) => ['vaikara_town', 'old_bazaar', 'river_ghat', 'muthalappuzha', 'veliyathura', 'kayalore', 'karimulam', 'puliyur', 'st_thomas', 'juma_mosque', 'ponnambalam', 'district_court', 'residency', 'hill_trading_post', 'monsoon_shrine', 'southern_ferry', 'fort', 'lighthouse_point', 'kalliyar_ferry'].includes(p.id));
for (let j = 0; j < NZ; j++) {
  const z = Z0 + j * CS;
  for (let i = 0; i < NX; i++) {
    const x = X0 + i * CS, k = j * NX + i;
    let h = H[k];
    for (const p of SETTLE) {
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < p.r) {
        const w = smoothstep(p.r, p.r * 0.35, d) * 0.85;
        if (h > 0.3) h = lerp(h, Math.max(HB[k], 0.9), w);
      }
    }
    const rd = bil(F.road, x, z);
    if (rd < 9) {
      const re = bil(F.river, x, z);
      const w = smoothstep(9, 0.5, rd) * smoothstep(-2, 12, re) * (h > -0.5 ? 1 : 0);
      h = lerp(h, Math.max(HB[k], 0.7) - 0.12, w);
    }
    const ra = bil(F.rail, x, z);
    if (ra < 6) h = lerp(h, Math.max(HB[k], 1) + 0.25, smoothstep(6, 1, ra));
    H[k] = h;
  }
}

let hmin = Infinity, hmax = -Infinity;
for (const v of H) { if (v < hmin) hmin = v; if (v > hmax) hmax = v; }
log(`height range ${hmin.toFixed(1)} … ${hmax.toFixed(1)} m`);

// ── Splat weights (half res)
log('splat…');
const sA = Buffer.alloc(HN * 4), sB = Buffer.alloc(HN * 4);
const slopeAt = (i, j) => {
  const k = Math.min(NZ - 2, j) * NX + Math.min(NX - 2, i);
  const dx = (H[k + 1] - H[k]) / CS, dz = (H[k + NX] - H[k]) / CS;
  return Math.hypot(dx, dz);
};
for (let j = 0; j < HZ; j++) {
  for (let i = 0; i < HX; i++) {
    const k = j * HX + i, fi = Math.min(NX - 1, i * 2), fj = Math.min(NZ - 1, j * 2);
    const x = X0 + i * HS, z = Z0 + j * HS;
    const h = H[fj * NX + fi];
    const sl = (slopeAt(fi, fj) + slopeAt(Math.max(0, fi - 1), Math.max(0, fj - 1))) * 0.5;
    const c = F.coast[k], m = F.front[k];
    const n = fbm(nE, x / 220, z / 220, 4), n2 = nD(x / 60, z / 60);
    const w = new Float32Array(8);
    // 0 grass 1 forest 2 laterite 3 road 4 sand 5 mud 6 rock 7 meadow
    w[0] = 1;
    const forestZ = smoothstep(-250, 150, m) * smoothstep(560, 430, h) + smoothstep(0, 120, Math.max(F.eleph[k], F.teak[k])) + smoothstep(0.35, 0.6, n) * smoothstep(250, 600, c) * 0.8;
    w[1] = clamp(forestZ) * 1.4 * (1 - smoothstep(-30, 40, F.tea[k]));
    w[2] = smoothstep(0.15, 0.5, fbm(nB, x / 90, z / 90, 3) + n * 0.4) * smoothstep(60, 200, c) * (1 - w[1] * 0.6) * 0.9 + smoothstep(0.25, 0.6, sl) * smoothstep(5, 30, h) * 0.8;
    const rd = F.road[k];
    w[3] = smoothstep(2.5, -0.5, rd + n2 * 0.8) * 3 + smoothstep(4, 0, F.rail[k]) * 2;
    const sandBand = 55 + 35 * n2;
    w[4] = (smoothstep(sandBand, 10, c) * smoothstep(3.5, 1.2, h) + (c < 0 ? 1 : 0)) * 2.5 + smoothstep(-20, 30, F.salt[k]) * 0.8;
    const re = F.river[k];
    w[5] = smoothstep(14, 0, re) * smoothstep(4, 0.6, h) * 2 + smoothstep(-20, 60, F.mangrove[k]) * 1.8 * smoothstep(1.4, 0.2, h) + smoothstep(10, 40, F.paddy[k]) * (h < 1.45 ? 0.25 : 0.9) + smoothstep(0.5, -0.5, h) * 1.5;
    w[6] = smoothstep(0.55, 1.0, sl) * 3 + smoothstep(500, 640, h) * smoothstep(0.25, 0.5, sl) * 2;
    w[7] = smoothstep(380, 470, h) * smoothstep(0.7, 0.35, sl) * 1.6 + smoothstep(-30, 40, F.tea[k]) * 0.25;
    if (F.riverId[k] === 3 && re < 3) w[6] += 2.5; // stream bed of rock
    // dampen others under roads
    const rw = clamp(w[3] / 3);
    for (let L2 = 0; L2 < 8; L2++) if (L2 !== 3) w[L2] *= 1 - rw * 0.9;
    let s = 0; for (const v of w) s += v;
    for (let L2 = 0; L2 < 4; L2++) { sA[k * 4 + L2] = Math.round((w[L2] / s) * 255); sB[k * 4 + L2] = Math.round((w[L2 + 4] / s) * 255); }
  }
}
await sharp(sA, { raw: { width: HX, height: HZ, channels: 4 } }).png({ compressionLevel: 9 }).toFile(join(OUT, 'splatA.png'));
await sharp(sB, { raw: { width: HX, height: HZ, channels: 4 } }).png({ compressionLevel: 9 }).toFile(join(OUT, 'splatB.png'));

// ── Biome (quarter res): palm, forest, zone, undergrowth
log('biome…');
const QN = QX * QZ;
const BIO = new Uint8Array(QN * 4);
const COASTQ = new Int16Array(QN);
const ZONE = { none: 0, mangrove: 1, paddy: 2, salt: 3, tea: 4, teak: 5, elephant: 6, settle: 7, beach: 8, meadow: 9, bank: 10, highland: 11 };
for (let j = 0; j < QZ; j++) {
  for (let i = 0; i < QX; i++) {
    const k = j * QX + i, x = X0 + i * QS, z = Z0 + j * QS;
    const fi = Math.min(NX - 2, i * 4), fj = Math.min(NZ - 2, j * 4);
    const h = H[fj * NX + fi], sl = slopeAt(fi, fj);
    const c = bil(F.coast, x, z), m = bil(F.front, x, z), re = bil(F.river, x, z), rd = bil(F.road, x, z);
    COASTQ[k] = Math.round(clamp(c, -3276, 3276) * 10);
    const n = fbm(nE, x / 260, z / 260, 4), n3 = nA(x / 70, z / 70);
    const inPoly = (f) => bil(f, x, z);
    let zone = ZONE.none;
    if (inPoly(F.mangrove) > 0) zone = ZONE.mangrove;
    else if (inPoly(F.paddy) > 0) zone = ZONE.paddy;
    else if (inPoly(F.salt) > 0) zone = ZONE.salt;
    else if (inPoly(F.tea) > 0) zone = ZONE.tea;
    else if (inPoly(F.teak) > 0) zone = ZONE.teak;
    else if (inPoly(F.eleph) > 0) zone = ZONE.elephant;
    else if (SETTLE.some((p) => Math.hypot(x - p.x, z - p.z) < p.r * 0.75)) zone = ZONE.settle;
    else if (c < 60 && h < 3) zone = ZONE.beach;
    else if (h > 400) zone = ZONE.meadow;
    else if (m > 0) zone = ZONE.highland;
    if (re < 25 && re > 0 && zone === ZONE.none) zone = ZONE.bank;
    const dry = h > 0.5 && rd > 6 && re > 3 && near(F.rail, x, z) > 6;
    let palm = 0, forest = 0, under = 0;
    if (dry && sl < 0.6) {
      // coconut palms: the lowland signature — dense on the coast, river banks and around villages
      palm = smoothstep(20, 60, c) * smoothstep(120, 40, h) * (0.35 + 0.65 * smoothstep(-0.2, 0.5, n));
      palm += smoothstep(80, 10, re) * 0.7 * smoothstep(40, 5, h);
      if (zone === ZONE.settle) palm *= 0.55;
      if (zone === ZONE.paddy) palm *= smoothstep(0.1, 0.6, n3) * 0.3;
      if (zone === ZONE.salt || zone === ZONE.tea || zone === ZONE.mangrove) palm = 0;
      palm *= 1 - smoothstep(-300, 100, m);
    }
    if (dry && sl < 1.25) {
      forest = smoothstep(-300, 120, m) * smoothstep(560, 440, h) * (0.55 + 0.45 * n);
      forest += smoothstep(0.32, 0.6, n) * smoothstep(300, 700, c) * 0.7;
      if (zone === ZONE.teak || zone === ZONE.elephant) forest = Math.max(forest, 0.85);
      if (zone === ZONE.tea || zone === ZONE.paddy || zone === ZONE.salt || zone === ZONE.settle) forest *= 0.08;
      under = clamp(forest * 0.9 + palm * 0.4 + 0.2) * (zone === ZONE.salt ? 0 : 1);
    }
    if (zone === ZONE.mangrove) forest = h > -0.6 && h < 1.6 ? 1 : 0;
    BIO[k * 4] = Math.round(clamp(palm) * 255);
    BIO[k * 4 + 1] = Math.round(clamp(forest) * 255);
    BIO[k * 4 + 2] = zone;
    BIO[k * 4 + 3] = Math.round(clamp(under) * 255);
  }
}

// ── Pack heights
log('pack…');
const H16 = new Uint16Array(NX * NZ);
for (let k = 0; k < H.length; k++) H16[k] = Math.round(clamp((H[k] - HMIN) / (HMAX - HMIN)) * 65535);
const bin = Buffer.concat([Buffer.from(H16.buffer), Buffer.from(BIO.buffer), Buffer.from(COASTQ.buffer)]);
await writeFile(join(OUT, 'world.bin.gz'), gzipSync(bin, { level: 9 }));

// stream ribbon for the Vellar (above sea level)
const vellar = vel.map((p, i) => [+(p[0].toFixed(2)), +(p[1].toFixed(2)), +(velW[i].toFixed(2)), +(p[2] / 2).toFixed(2)]);
const meta = {
  NX, NZ, CS, X0, Z0, HMIN, HMAX, QX, QZ, QS, HX, HZ, HS,
  zones: ZONE,
  streams: { vellar, fallsIdx },
  rivers: Object.fromEntries(Object.entries(riverLines).map(([k, v]) => [k, v.map((p) => p.map((q) => +q.toFixed(1)))])),
  roads: roadLines.map((r) => ({ name: r.name, type: r.type, line: r.line.map((p) => [+p[0].toFixed(1), +p[1].toFixed(1)]) })),
  rail: railLine.map((p) => [+p[0].toFixed(1), +p[1].toFixed(1)]),
};
await writeFile(join(OUT, 'meta.json'), JSON.stringify(meta));

// ── Painted overview map (1536×1024) for the in-game map
log('overview map…');
const MW = 1536, MH = 1024;
const img = Buffer.alloc(MW * MH * 3);
for (let y = 0; y < MH; y++) {
  for (let x = 0; x < MW; x++) {
    const [wx, wz] = L.toWorld(x + 0.5, y + 0.5);
    const h = hAt(wx, wz), h2 = hAt(wx - 6, wz - 6);
    const shade = clamp(0.85 + (h - h2) * 0.06, 0.45, 1.25);
    const qi = Math.min(QX - 1, Math.max(0, Math.round((wx - X0) / QS))), qj = Math.min(QZ - 1, Math.max(0, Math.round((wz - Z0) / QS)));
    const b = (qj * QX + qi) * 4;
    let col;
    if (h < 0) { const d = clamp(-h / 25); col = [lerp(126, 62, d), lerp(170, 112, d), lerp(176, 140, d)]; }
    else {
      const f = BIO[b + 1] / 255, p = BIO[b] / 255;
      col = [lerp(196, 120, f), lerp(178, 134, f), lerp(118, 72, f)];
      col = [lerp(col[0], 140, p * 0.5), lerp(col[1], 150, p * 0.5), lerp(col[2], 80, p * 0.5)];
      if (BIO[b + 2] === ZONE.paddy) col = [168, 182, 92];
      if (BIO[b + 2] === ZONE.salt) col = [222, 214, 196];
      if (BIO[b + 2] === ZONE.tea) col = [120, 150, 70];
      if (h > 380) col = [lerp(col[0], 150, 0.5), lerp(col[1], 136, 0.5), lerp(col[2], 100, 0.5)];
      if (near(F.road, wx, wz) < 3) col = [150, 108, 70];
      if (near(F.rail, wx, wz) < 2) col = [70, 60, 50];
      col = col.map((v) => v * shade);
    }
    const o = (y * MW + x) * 3;
    img[o] = clamp(col[0], 0, 255); img[o + 1] = clamp(col[1], 0, 255); img[o + 2] = clamp(col[2], 0, 255);
  }
}
await sharp(img, { raw: { width: MW, height: MH, channels: 3 } }).modulate({ saturation: 0.85 }).jpeg({ quality: 88 }).toFile(join(OUT, 'map.jpg'));
log('done →', OUT);
