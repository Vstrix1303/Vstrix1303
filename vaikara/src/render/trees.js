// Procedural flora of the Malabar coast: coconut palms, jungle broadleaf,
// teak, mangrove, banana, tea bushes and grass. Real CC0 bark textures;
// leaves are painted on canvases at load. Every mesh carries a `flex`
// attribute (0 = rigid, 1 = free tip) that drives wind sway in the shader.
import * as THREE from 'three/webgpu';
import {
  positionLocal, attribute, sin, cos, vec3, float, uniform, hash, instanceIndex, texture, uv, mix, smoothstep,
  vec4, normalLocal, normalize, max, dot, positionWorld, length, select, step,
} from 'three/tsl';
import { G, U } from '../state.js';
import { pbr } from './textures.js';
import { makeRng } from '../world/noise.js';


const TAU = Math.PI * 2;

// ── Geometry accumulator with material groups
export class MB {
  constructor(nGroups) { this.g = Array.from({ length: nGroups }, () => ({ p: [], n: [], uv: [], f: [], i: [] })); }
  v(gi, x, y, z, nx, ny, nz, u, v, f = 0) {
    const g = this.g[gi]; g.p.push(x, y, z); g.n.push(nx, ny, nz); g.uv.push(u, v); g.f.push(f);
    return g.p.length / 3 - 1;
  }
  tri(gi, a, b, c) { this.g[gi].i.push(a, b, c); }
  quad(gi, a, b, c, d) { this.g[gi].i.push(a, b, c, a, c, d); }
  build() {
    const P = [], N = [], UV = [], F = [], I = [];
    const geo = new THREE.BufferGeometry();
    let off = 0, ioff = 0;
    this.g.forEach((g, gi) => {
      P.push(...g.p); N.push(...g.n); UV.push(...g.uv); F.push(...g.f);
      for (const k of g.i) I.push(k + off);
      geo.addGroup(ioff, g.i.length, gi);
      off += g.p.length / 3; ioff += g.i.length;
    });
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
    geo.setAttribute('flex', new THREE.Float32BufferAttribute(F, 1));
    geo.setIndex(I);
    geo.computeBoundingSphere(); geo.computeBoundingBox();
    return geo;
  }
}

// Tube along a list of points [x,y,z], radius per point.
function tube(mb, gi, pts, radii, seg, vScale, flexFn, uRep = 1) {
  const base = mb.g[gi].p.length / 3;
  let v = 0;
  for (let j = 0; j < pts.length; j++) {
    const a = pts[Math.max(0, j - 1)], b = pts[Math.min(pts.length - 1, j + 1)];
    const t = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
    const ref = Math.abs(t.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const bx = new THREE.Vector3().crossVectors(ref, t).normalize(), bz = new THREE.Vector3().crossVectors(t, bx).normalize();
    if (j > 0) v += Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1], pts[j][2] - pts[j - 1][2]);
    for (let k = 0; k <= seg; k++) {
      const ang = (k / seg) * TAU, c = Math.cos(ang), s = Math.sin(ang);
      const nx = bx.x * c + bz.x * s, ny = bx.y * c + bz.y * s, nz = bx.z * c + bz.z * s;
      const r = radii[j];
      mb.v(gi, pts[j][0] + nx * r, pts[j][1] + ny * r, pts[j][2] + nz * r, nx, ny, nz, (k / seg) * uRep, v / vScale, flexFn(j / (pts.length - 1), pts[j]));
    }
  }
  for (let j = 0; j < pts.length - 1; j++) for (let k = 0; k < seg; k++) {
    const a = base + j * (seg + 1) + k, b = a + 1, c = a + seg + 1, d = c + 1;
    mb.quad(gi, a, b, d, c);
  }
}

// ── Canvas leaf textures
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  draw(x, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  return t;
}
const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;

function frondTexture() {
  const rnd = makeRng(5);
  return canvasTex(512, 2048, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    x.lineCap = 'round';
    const N = 230;
    for (let i = 0; i < N; i++) {
      const t = 0.025 + (i / N) * 0.96;
      const y = h - t * h;
      const len = Math.sin(Math.PI * Math.min(1, t * 1.12)) * (w * 0.48) * (0.82 + rnd() * 0.25);
      for (const side of [-1, 1]) {
        if (rnd() < 0.05) continue;
        const ang = (0.5 + rnd() * 0.28) * side;
        const droop = len * (0.12 + rnd() * 0.1);
        const ex = w / 2 + Math.sin(ang) * len, ey = y - Math.cos(ang) * len * 0.5 + droop;
        const cx = w / 2 + Math.sin(ang) * len * 0.5, cy = y - len * 0.16;
        const l = 20 + rnd() * 14 + (t < 0.3 ? 4 : 0), sat = 42 + rnd() * 20, hue = 76 + rnd() * 24 - (t > 0.92 ? 22 : 0);
        // blade with a lighter midrib and a tapering tip
        x.strokeStyle = hsl(hue, sat, l); x.lineWidth = 9 + rnd() * 4;
        x.beginPath(); x.moveTo(w / 2, y); x.quadraticCurveTo(cx, cy, ex, ey); x.stroke();
        x.strokeStyle = hsl(hue, sat, l + 6, 0.8); x.lineWidth = 4;
        x.beginPath(); x.moveTo(w / 2, y); x.quadraticCurveTo(cx, cy, (cx + ex) / 2, (cy + ey) / 2); x.stroke();
        x.strokeStyle = hsl(hue - 6, sat - 10, l + 20, 0.55); x.lineWidth = 1.4;
        x.beginPath(); x.moveTo(w / 2, y); x.quadraticCurveTo(cx, cy, ex, ey); x.stroke();
        if (rnd() < 0.14) { x.strokeStyle = hsl(38, 48, 46, 0.95); x.lineWidth = 7; x.beginPath(); x.moveTo(ex - Math.sin(ang) * 18, ey - 2); x.lineTo(ex, ey); x.stroke(); }
      }
    }
    const g = x.createLinearGradient(0, h, 0, 0);
    g.addColorStop(0, hsl(48, 40, 46)); g.addColorStop(1, hsl(70, 35, 36));
    x.strokeStyle = g; x.lineWidth = 12;
    x.beginPath(); x.moveTo(w / 2, h); x.lineTo(w / 2, 0); x.stroke();
  });
}

function leafClusterTexture(seed, hueBase, sizeK, dark = 0) {
  const rnd = makeRng(seed);
  return canvasTex(512, 512, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    const n = Math.round(260 / sizeK);
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU, r = Math.sqrt(rnd()) * w * 0.42;
      const cx = w / 2 + Math.cos(a) * r, cy = h / 2 + Math.sin(a) * r * 0.9;
      const len = (16 + rnd() * 18) * sizeK, wid = len * (0.38 + rnd() * 0.15);
      const rot = rnd() * TAU;
      const shade = 1 - r / (w * 0.5);
      const l = 17 + shade * 16 + rnd() * 8 - dark, s = 40 + rnd() * 25, hue = hueBase + rnd() * 18;
      x.save(); x.translate(cx, cy); x.rotate(rot);
      x.fillStyle = hsl(hue, s, l);
      x.beginPath(); x.moveTo(-len / 2, 0); x.quadraticCurveTo(0, -wid, len / 2, 0); x.quadraticCurveTo(0, wid, -len / 2, 0); x.fill();
      x.strokeStyle = hsl(hue, s - 10, l + 10, 0.5); x.lineWidth = 1;
      x.beginPath(); x.moveTo(-len / 2, 0); x.lineTo(len / 2, 0); x.stroke();
      x.restore();
    }
  });
}

function bananaTexture() {
  const rnd = makeRng(9);
  return canvasTex(256, 1024, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    const g = x.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, hsl(95, 50, 30)); g.addColorStop(0.5, hsl(90, 55, 42)); g.addColorStop(1, hsl(95, 50, 30));
    x.fillStyle = g;
    x.beginPath(); x.moveTo(w / 2, h);
    x.bezierCurveTo(w * 0.02, h * 0.8, w * 0.02, h * 0.15, w / 2, 0);
    x.bezierCurveTo(w * 0.98, h * 0.15, w * 0.98, h * 0.8, w / 2, h); x.fill();
    x.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 26; i++) {
      const y = 60 + rnd() * (h - 120), side = rnd() < 0.5 ? -1 : 1;
      x.lineWidth = 2 + rnd() * 3; x.beginPath(); x.moveTo(w / 2 + side * 14, y); x.lineTo(w / 2 + side * w * 0.55, y - 30); x.stroke();
    }
    x.globalCompositeOperation = 'source-over';
    x.strokeStyle = hsl(70, 40, 62); x.lineWidth = 6; x.beginPath(); x.moveTo(w / 2, h); x.lineTo(w / 2, 0); x.stroke();
    x.strokeStyle = hsl(80, 30, 50, 0.25); x.lineWidth = 1;
    for (let y = 10; y < h; y += 7) { x.beginPath(); x.moveTo(w / 2, y); x.lineTo(0, y - 40); x.moveTo(w / 2, y); x.lineTo(w, y - 40); x.stroke(); }
  });
}

function grassTexture(seed, hue, light, tall = 1) {
  const rnd = makeRng(seed);
  return canvasTex(256, 256, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      const bx = 10 + rnd() * (w - 20), bh = h * (0.45 + rnd() * 0.55) * tall, lean = (rnd() - 0.5) * 60;
      x.strokeStyle = hsl(hue + rnd() * 20, 40 + rnd() * 20, light + rnd() * 14);
      x.lineWidth = 2 + rnd() * 2.5; x.lineCap = 'round';
      x.beginPath(); x.moveTo(bx, h); x.quadraticCurveTo(bx + lean * 0.3, h - bh * 0.6, bx + lean, h - bh); x.stroke();
    }
  });
}

// ── Materials with wind
function windNode(strength, flutter) {
  // per-instance phase; crown sway grows with height², tips flutter
  const ph = hash(instanceIndex).mul(TAU);
  const y = max(positionLocal.y, 0);
  const t = U.time;
  const w = U.wind;
  const sway = sin(t.mul(0.8).add(ph)).mul(0.6).add(sin(t.mul(1.7).add(ph.mul(1.3))).mul(0.25)).mul(y.mul(y)).mul(strength).mul(w);
  const f = attribute('flex', 'float');
  const fl = sin(t.mul(3.1).add(ph).add(positionLocal.x.mul(0.7)).add(positionLocal.z.mul(0.5))).mul(f).mul(flutter).mul(w);
  return positionLocal.add(vec3(sway.add(fl.mul(0.4)), fl.mul(0.6), sway.mul(0.5).add(fl.mul(0.3))));
}

function leafMaterial(map, { strength = 0.0015, flutter = 0.12, color = 0xffffff, rough = 1 } = {}) {
  const m = new THREE.MeshStandardNodeMaterial({ map, side: THREE.DoubleSide, alphaTest: 0.45, roughness: rough, metalness: 0, color });
  m.envMapIntensity = 0.35; // leaves are matte: no sky sheen…
  m.roughnessNode = float(rough).sub(U.rain.mul(0.18)); // …a little glossier in the rain
  // translucency: sunlight glows through the leaves, even on the shaded side
  m.emissiveNode = texture(map, uv()).rgb.mul(new THREE.Color(color)).mul(U.sunColor).mul(0.16);
  m.positionNode = windNode(strength, flutter);
  // a touch of translucency: leaves glow when the sun is behind them
  return m;
}
function barkMaterial(name, { strength = 0.0015, color = 0xffffff, repeat = 1 } = {}) {
  const s = pbr(name);
  const m = new THREE.MeshStandardNodeMaterial({ map: s.map, normalMap: s.normalMap, roughnessMap: s.arm, aoMap: s.arm, roughness: 1, metalness: 0, color });
  m.positionNode = windNode(strength, 0);
  void repeat;
  return m;
}

// ── Species
function palm(seed) {
  const rnd = makeRng(seed);
  const mb = new MB(3); // 0 trunk, 1 fronds, 2 coconuts
  const H = 9 + rnd() * 7;
  const lean = 0.06 + rnd() * 0.16, la = rnd() * TAU;
  const pts = [], rad = [];
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const off = Math.sin(t * Math.PI * 0.5) * lean * H + Math.sin(t * Math.PI) * 0.3 * (rnd() - 0.5);
    pts.push([Math.cos(la) * off, t * H, Math.sin(la) * off]);
    rad.push((0.24 - t * 0.08) * (i === 0 ? 1.35 : 1) + (i === 1 ? 0.03 : 0));
  }
  tube(mb, 0, pts, rad, 7, 1.2, () => 0, 2);
  const top = pts[n];
  // crown bulb
  tube(mb, 0, [[top[0], top[1] - 0.6, top[2]], [top[0], top[1], top[2]], [top[0], top[1] + 0.45, top[2]]], [0.2, 0.28, 0.05], 8, 1, () => 0.05, 2);
  // fronds: V-section strips arching outwards and drooping
  const nf = 18 + Math.floor(rnd() * 5);
  for (let f = 0; f < nf; f++) {
    const az = (f / nf) * TAU + rnd() * 0.3;
    const up = f % 4 === 0 ? 0.9 : f % 4 === 1 ? 0.4 : f % 4 === 2 ? -0.05 : -0.5;  // young fronds stand up, old ones hang
    const L = 4.6 + rnd() * 1.4;
    const seg = 8;
    const dir = [Math.cos(az), Math.sin(az)];
    const base = mb.g[1].p.length / 3;
    for (let s = 0; s <= seg; s++) {
      const t = s / seg;
      const out = t * L * (0.95 - up * 0.2);
      const y = top[1] + 0.2 + Math.sin(t * Math.PI * 0.55) * L * 0.38 * (0.6 + up) - t * t * L * (0.7 - up * 0.5);
      const cx = top[0] + dir[0] * out, cz = top[2] + dir[1] * out;
      const wdt = Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.08)) * 1.25 + 0.1;
      const fold = 0.22 * wdt;
      const px = -dir[1], pz = dir[0];
      const fl = Math.pow(t, 1.4);
      // left, centre, right (V fold: centre raised)
      mb.v(1, cx + px * wdt, y - fold, cz + pz * wdt, 0, 1, 0, 0, t, fl);
      mb.v(1, cx, y + 0.03, cz, 0, 1, 0, 0.5, t, fl);
      mb.v(1, cx - px * wdt, y - fold, cz - pz * wdt, 0, 1, 0, 1, t, fl);
    }
    for (let s = 0; s < seg; s++) {
      const a = base + s * 3;
      mb.quad(1, a, a + 1, a + 4, a + 3);
      mb.quad(1, a + 1, a + 2, a + 5, a + 4);
    }
  }
  // fake normals for the crown: pointing out from the crown centre, bent upwards
  const g1 = mb.g[1];
  for (let i = 0; i < g1.p.length; i += 3) {
    const dx = g1.p[i] - top[0], dy = g1.p[i + 1] - top[1] + 1.5, dz = g1.p[i + 2] - top[2];
    const l = Math.hypot(dx, dy, dz) || 1;
    g1.n[i] = dx / l * 0.7; g1.n[i + 1] = dy / l * 0.7 + 0.5; g1.n[i + 2] = dz / l * 0.7;
  }
  // coconut cluster
  const nc = 3 + Math.floor(rnd() * 4);
  for (let c = 0; c < nc; c++) {
    const a = rnd() * TAU, r = 0.32;
    const cx = top[0] + Math.cos(a) * r, cy = top[1] - 0.3 - rnd() * 0.4, cz = top[2] + Math.sin(a) * r;
    tube(mb, 2, [[cx, cy - 0.15, cz], [cx, cy, cz], [cx, cy + 0.15, cz]], [0.04, 0.15, 0.04], 5, 1, () => 0.05);
  }
  return { geo: mb.build(), height: H + 1.5, radius: 5 };
}

function broadleaf(seed, opts = {}) {
  const rnd = makeRng(seed);
  const mb = new MB(2);
  const H = (opts.h || 11) * (0.8 + rnd() * 0.45);
  const trunkH = H * (opts.trunk || 0.45);
  const pts = [], rad = [];
  const r0 = opts.r0 || 0.35;
  for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push([(rnd() - 0.5) * 0.4 * t, t * trunkH, (rnd() - 0.5) * 0.4 * t]); rad.push(r0 * (1 - t * 0.35) * (i === 0 ? 1.4 : 1)); }
  tube(mb, 0, pts, rad, 8, 1.5, () => 0);
  // main limbs
  const limbs = 4 + Math.floor(rnd() * 3);
  const blobs = [];
  for (let l = 0; l < limbs; l++) {
    const a = (l / limbs) * TAU + rnd() * 0.6, up = 0.5 + rnd() * 0.5;
    const len = H * (0.32 + rnd() * 0.15);
    const s = pts[6];
    const e = [s[0] + Math.cos(a) * len * 0.75, s[1] + len * up, s[2] + Math.sin(a) * len * 0.75];
    const m = [(s[0] + e[0]) / 2, (s[1] + e[1]) / 2 + 0.4, (s[2] + e[2]) / 2];
    tube(mb, 0, [s, m, e], [r0 * 0.55, r0 * 0.35, r0 * 0.12], 6, 1.5, (t) => t * 0.2);
    blobs.push(e, m);
  }
  blobs.push([0, H * 0.82, 0]);
  // leaf cards: clusters of crossed quads around each limb end → a full crown
  const crownR = opts.crown || H * 0.28;
  for (const b of blobs) {
    const k = 6 + Math.floor(rnd() * 3);
    for (let i = 0; i < k; i++) {
      const cx = b[0] + (rnd() - 0.5) * crownR * 0.9, cy = b[1] + (rnd() - 0.2) * crownR * 0.6, cz = b[2] + (rnd() - 0.5) * crownR * 0.9;
      const s = crownR * (0.75 + rnd() * 0.5);
      const a = rnd() * Math.PI, tilt = (rnd() - 0.5) * 0.9;
      const ux = Math.cos(a), uz = Math.sin(a);
      const base = mb.g[1].p.length / 3;
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      for (const [cu, cv] of corners) {
        const x = cx + ux * cu * s * 0.5, y = cy + cv * s * 0.5 * Math.cos(tilt), z = cz + uz * cu * s * 0.5 + cv * s * 0.5 * Math.sin(tilt);
        const nx = x - b[0] * 0.6, ny = y - (H * 0.5), nz = z - b[2] * 0.6, ln = Math.hypot(nx, ny, nz) || 1;
        mb.v(1, x, y, z, nx / ln, ny / ln * 0.8 + 0.3, nz / ln, (cu + 1) / 2, (cv + 1) / 2, 0.6 + 0.4 * (cv + 1) / 2);
      }
      mb.quad(1, base, base + 1, base + 2, base + 3);
    }
  }
  return { geo: mb.build(), height: H + crownR * 0.6, radius: crownR * 1.3 };
}

function mangrove(seed) {
  const rnd = makeRng(seed);
  const mb = new MB(2);
  const H = 4.5 + rnd() * 3;
  // arching prop roots
  const roots = 7 + Math.floor(rnd() * 5);
  for (let r = 0; r < roots; r++) {
    const a = (r / roots) * TAU + rnd() * 0.4, d = 1.4 + rnd() * 1.4;
    tube(mb, 0, [[Math.cos(a) * d, -0.8, Math.sin(a) * d], [Math.cos(a) * d * 0.75, 0.9, Math.sin(a) * d * 0.75], [Math.cos(a) * d * 0.3, 1.8, Math.sin(a) * d * 0.3], [0, 2.2, 0]], [0.06, 0.07, 0.08, 0.1], 5, 1, () => 0);
  }
  const pts = [[0, 2, 0], [0.1, H * 0.6, 0.1], [0, H * 0.8, 0]];
  tube(mb, 0, pts, [0.16, 0.12, 0.08], 6, 1, () => 0);
  const b = broadleaf(seed + 1, { h: H, trunk: 0.6, r0: 0.12, crown: H * 0.42 });
  // reuse broadleaf crown cards only
  const crown = b.geo;
  const gi = crown.groups[1];
  const P = crown.attributes.position.array, N = crown.attributes.normal.array, UV = crown.attributes.uv.array, F = crown.attributes.flex.array, I = crown.index.array;
  const map = new Map();
  for (let i = gi.start; i < gi.start + gi.count; i++) {
    const vi = I[i];
    if (!map.has(vi)) map.set(vi, mb.v(1, P[vi * 3] * 1.2, P[vi * 3 + 1] * 0.75 + 1.2, P[vi * 3 + 2] * 1.2, N[vi * 3], N[vi * 3 + 1], N[vi * 3 + 2], UV[vi * 2], UV[vi * 2 + 1], F[vi]));
  }
  for (let i = gi.start; i < gi.start + gi.count; i += 3) mb.tri(1, map.get(I[i]), map.get(I[i + 1]), map.get(I[i + 2]));
  crown.dispose();
  return { geo: mb.build(), height: H + 2, radius: H * 0.6 };
}

function banana(seed) {
  const rnd = makeRng(seed);
  const mb = new MB(2);
  const stems = 2 + Math.floor(rnd() * 3);
  for (let s = 0; s < stems; s++) {
    const ox = (rnd() - 0.5) * 1.2, oz = (rnd() - 0.5) * 1.2, H = 2.2 + rnd() * 1.6;
    tube(mb, 0, [[ox, 0, oz], [ox, H * 0.5, oz], [ox, H, oz]], [0.16, 0.13, 0.1], 7, 1, (t) => t * 0.1);
    const nl = 6 + Math.floor(rnd() * 3);
    for (let l = 0; l < nl; l++) {
      const a = (l / nl) * TAU + rnd(), L = 2 + rnd() * 1;
      const base = mb.g[1].p.length / 3, seg = 6;
      for (let k = 0; k <= seg; k++) {
        const t = k / seg, out = t * L * 0.9;
        const y = H + Math.sin(t * Math.PI * 0.6) * L * 0.4 - t * t * L * 0.55;
        const cx = ox + Math.cos(a) * out, cz = oz + Math.sin(a) * out;
        const w = 0.32 + Math.sin(t * Math.PI) * 0.12, px = -Math.sin(a) * w, pz = Math.cos(a) * w;
        mb.v(1, cx + px, y, cz + pz, 0, 1, 0, 0, t, t);
        mb.v(1, cx - px, y, cz - pz, 0, 1, 0, 1, t, t);
      }
      for (let k = 0; k < seg; k++) { const a0 = base + k * 2; mb.quad(1, a0, a0 + 1, a0 + 3, a0 + 2); }
    }
  }
  return { geo: mb.build(), height: 5, radius: 2.5 };
}

function teaBush(seed) {
  const rnd = makeRng(seed);
  const mb = new MB(1);
  // a clipped, flat-topped bush: lumpy dome of leaf cards
  for (let i = 0; i < 9; i++) {
    const a = rnd() * TAU, r = rnd() * 0.45;
    const cx = Math.cos(a) * r, cz = Math.sin(a) * r, cy = 0.55 + rnd() * 0.35;
    const s = 0.8 + rnd() * 0.4, rot = rnd() * Math.PI;
    for (const k of [0, 1]) {
      const ux = Math.cos(rot + k * Math.PI / 2), uz = Math.sin(rot + k * Math.PI / 2);
      const base = mb.g[0].p.length / 3;
      for (const [cu, cv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const x = cx + ux * cu * s * 0.5, y = cy + cv * s * 0.4, z = cz + uz * cu * s * 0.5;
        mb.v(0, x, y, z, x, 1, z, (cu + 1) / 2, (cv + 1) / 2, (cv + 1) * 0.15);
      }
      mb.quad(0, base, base + 1, base + 2, base + 3);
    }
  }
  return { geo: mb.build() };
}

// Grass / rice clump: three crossed blades cards.
function clump(h = 0.7, w = 0.9) {
  const mb = new MB(1);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI, ux = Math.cos(a) * w * 0.5, uz = Math.sin(a) * w * 0.5;
    const base = mb.g[0].p.length / 3;
    mb.v(0, -ux, 0, -uz, 0, 1, 0, 0, 0, 0); mb.v(0, ux, 0, uz, 0, 1, 0, 1, 0, 0);
    mb.v(0, ux, h, uz, 0, 1, 0, 1, 1, 1); mb.v(0, -ux, h, -uz, 0, 1, 0, 0, 1, 1);
    mb.quad(0, base, base + 1, base + 2, base + 3);
  }
  return mb.build();
}

// ── Library
export function buildFlora() {
  const tex = {
    frond: frondTexture(),
    broad: leafClusterTexture(3, 82, 1),
    broad2: leafClusterTexture(13, 95, 1.2, 4),
    teak: leafClusterTexture(17, 70, 2.1),
    mangrove: leafClusterTexture(21, 100, 0.75, 6),
    banana: bananaTexture(),
    grass: grassTexture(31, 70, 30),
    rice: grassTexture(37, 80, 40, 1.1),
    tea: leafClusterTexture(41, 100, 0.55, 2),
  };
  const palmBark = barkMaterial('palmbark', { strength: 0.0011, color: 0x857563 });
  const bark = barkMaterial('bark', { strength: 0.0004, color: 0x9a8c7c });
  const pale = barkMaterial('bark', { strength: 0.0004, color: 0xd0c4b0 });
  const coconut = new THREE.MeshStandardNodeMaterial({ color: 0x5f6a26, roughness: 0.6 });
  coconut.positionNode = windNode(0.0011, 0);
  const M = {
    frond: leafMaterial(tex.frond, { strength: 0.0011, flutter: 0.14, color: 0xa4b484 }),
    broad: leafMaterial(tex.broad, { strength: 0.0004, flutter: 0.06, color: 0xb8c8a0 }),
    broad2: leafMaterial(tex.broad2, { strength: 0.0004, flutter: 0.06, color: 0xa8bc90 }),
    teak: leafMaterial(tex.teak, { strength: 0.0003, flutter: 0.08, color: 0xc0c498 }),
    mangrove: leafMaterial(tex.mangrove, { strength: 0.0004, flutter: 0.05 }),
    banana: leafMaterial(tex.banana, { strength: 0.004, flutter: 0.1 }),
    grass: leafMaterial(tex.grass, { strength: 0, flutter: 0.08, color: 0x9ab070 }),
    rice: leafMaterial(tex.rice, { strength: 0, flutter: 0.06, color: 0xc8f080 }),
    tea: leafMaterial(tex.tea, { strength: 0, flutter: 0.02, color: 0x90b070 }),
  };
  const species = {};
  const add = (name, list, mats, weight = 1) => { species[name] = { variants: list, mats, weight }; };
  add('palm', [palm(1), palm(2), palm(3), palm(4)], [palmBark, M.frond, coconut]);
  add('broad', [broadleaf(5, { h: 13 }), broadleaf(6, { h: 16, crown: 5 }), broadleaf(7, { h: 10 })], [bark, M.broad]);
  add('broad2', [broadleaf(8, { h: 18, crown: 6, r0: 0.5 }), broadleaf(9, { h: 14 })], [bark, M.broad2]);
  add('teak', [broadleaf(10, { h: 22, trunk: 0.6, crown: 5, r0: 0.45 }), broadleaf(11, { h: 19, trunk: 0.62, crown: 4.5, r0: 0.4 })], [pale, M.teak]);
  add('mangrove', [mangrove(12), mangrove(13)], [bark, M.mangrove]);
  add('banana', [banana(14), banana(15)], [palmBark, M.banana]);
  return {
    species, tex, M,
    tea: teaBush(42).geo, grass: clump(0.75, 1.1), rice: clump(0.8, 0.7), teaMat: M.tea,
  };
}
