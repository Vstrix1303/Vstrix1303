// Loads the baked world (heights, biome, coast distance) and answers
// height / slope / biome queries. The same data drives rendering and physics.
import { WORLD_W, WORLD_H } from './layout.js';

export const W = {
  meta: null, H: null, BIO: null, COAST: null,
  NX: 0, NZ: 0, CS: 1, X0: 0, Z0: 0, QX: 0, QZ: 0, QS: 1,
};

async function gunzip(buf) {
  const ds = new DecompressionStream('gzip');
  const stream = new Blob([buf]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function loadWorld(base, onProgress) {
  const meta = await (await fetch(`${base}baked/meta.json`)).json();
  const res = await fetch(`${base}baked/world.bin.gz`);
  const total = +res.headers.get('content-length') || 15e6;
  const reader = res.body.getReader();
  const chunks = []; let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); got += value.length;
    onProgress?.(Math.min(1, got / total));
  }
  const gz = new Uint8Array(got); let o = 0;
  for (const c of chunks) { gz.set(c, o); o += c.length; }
  // Some static servers transparently decompress .gz; detect the magic bytes.
  const bin = gz[0] === 0x1f && gz[1] === 0x8b ? await gunzip(gz) : gz;
  const { NX, NZ, HMIN, HMAX, QX, QZ } = meta;
  const n = NX * NZ;
  const h16 = new Uint16Array(bin.buffer, bin.byteOffset, n);
  const H = new Float32Array(n);
  const sc = (HMAX - HMIN) / 65535;
  for (let i = 0; i < n; i++) H[i] = h16[i] * sc + HMIN;
  let off = bin.byteOffset + n * 2;
  const BIO = new Uint8Array(bin.buffer.slice(off, off + QX * QZ * 4)); off += QX * QZ * 4;
  const COAST = new Int16Array(bin.buffer.slice(off, off + QX * QZ * 2));
  Object.assign(W, { meta, H, BIO, COAST, NX, NZ, CS: meta.CS, X0: meta.X0, Z0: meta.Z0, QX, QZ, QS: meta.QS });
  return W;
}

// Bilinear height (clamped to the world; gently continues past the edge).
export function getHeight(x, z) {
  const { H, NX, NZ, CS, X0, Z0 } = W;
  let fx = (x - X0) / CS, fz = (z - Z0) / CS;
  fx = fx < 0 ? 0 : fx > NX - 1.001 ? NX - 1.001 : fx;
  fz = fz < 0 ? 0 : fz > NZ - 1.001 ? NZ - 1.001 : fz;
  const i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j, k = j * NX + i;
  const a = H[k] + (H[k + 1] - H[k]) * tx;
  const b = H[k + NX] + (H[k + NX + 1] - H[k + NX]) * tx;
  return a + (b - a) * tz;
}

export function getNormal(x, z, out = [0, 1, 0], e = 1.5) {
  const hx = getHeight(x + e, z) - getHeight(x - e, z);
  const hz = getHeight(x, z + e) - getHeight(x, z - e);
  const nx = -hx, ny = 2 * e, nz = -hz;
  const l = Math.hypot(nx, ny, nz);
  out[0] = nx / l; out[1] = ny / l; out[2] = nz / l;
  return out;
}

export const getSlope = (x, z, e = 2) => Math.hypot(getHeight(x + e, z) - getHeight(x - e, z), getHeight(x, z + e) - getHeight(x, z - e)) / (2 * e);

// Biome: [palm, forest, zone, undergrowth] (0–255, zone is an id)
export function getBiome(x, z) {
  const { BIO, QX, QZ, QS, X0, Z0 } = W;
  const i = Math.max(0, Math.min(QX - 1, Math.round((x - X0) / QS)));
  const j = Math.max(0, Math.min(QZ - 1, Math.round((z - Z0) / QS)));
  const k = (j * QX + i) * 4;
  return [BIO[k], BIO[k + 1], BIO[k + 2], BIO[k + 3]];
}

// Signed distance to the coast in metres (+ inland).
export function getCoast(x, z) {
  const { COAST, QX, QZ, QS, X0, Z0 } = W;
  const i = Math.max(0, Math.min(QX - 1, Math.round((x - X0) / QS)));
  const j = Math.max(0, Math.min(QZ - 1, Math.round((z - Z0) / QS)));
  return COAST[j * QX + i] / 10;
}

export const inWorld = (x, z, m = 0) => x > -WORLD_W / 2 + m && x < WORLD_W / 2 - m && z > -WORLD_H / 2 + m && z < WORLD_H / 2 - m;

// Nearest distance to any baked road polyline (cached spatial hash).
let roadHash = null;
const RH = 64;
function buildRoadHash() {
  roadHash = new Map();
  for (const r of W.meta.roads) {
    for (let i = 1; i < r.line.length; i++) {
      const a = r.line[i - 1], b = r.line[i];
      const seg = { a, b, type: r.type, name: r.name };
      const x0 = Math.floor((Math.min(a[0], b[0]) - 20) / RH), x1 = Math.floor((Math.max(a[0], b[0]) + 20) / RH);
      const z0 = Math.floor((Math.min(a[1], b[1]) - 20) / RH), z1 = Math.floor((Math.max(a[1], b[1]) + 20) / RH);
      for (let gx = x0; gx <= x1; gx++) for (let gz = z0; gz <= z1; gz++) {
        const key = gx * 10007 + gz;
        if (!roadHash.has(key)) roadHash.set(key, []);
        roadHash.get(key).push(seg);
      }
    }
  }
}
export function nearestRoad(x, z) {
  if (!roadHash) buildRoadHash();
  const list = roadHash.get(Math.floor(x / RH) * 10007 + Math.floor(z / RH));
  let best = { d: Infinity, dx: 0, dz: 0, seg: null };
  if (!list) return best;
  for (const s of list) {
    const [ax, az] = s.a, [bx, bz] = s.b;
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
    let t = l2 ? ((x - ax) * dx + (z - az) * dz) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = ax + dx * t, pz = az + dz * t;
    const d = Math.hypot(x - px, z - pz);
    if (d < best.d) best = { d, px, pz, tx: dx / Math.sqrt(l2), tz: dz / Math.sqrt(l2), seg: s };
  }
  return best;
}

// Water surface height at (x, z): the Vellar stream's own level where its
// channel runs (it flows above sea level), otherwise the sea (0).
let streamHash = null;
const SH = 40;
function buildStreamHash() {
  streamHash = new Map();
  const v = W.meta.streams.vellar;
  for (let i = 1; i < v.length; i++) {
    const a = v[i - 1], b = v[i], r = Math.max(a[3], b[3]) + 4;
    const x0 = Math.floor((Math.min(a[0], b[0]) - r) / SH), x1 = Math.floor((Math.max(a[0], b[0]) + r) / SH);
    const z0 = Math.floor((Math.min(a[1], b[1]) - r) / SH), z1 = Math.floor((Math.max(a[1], b[1]) + r) / SH);
    for (let gx = x0; gx <= x1; gx++) for (let gz = z0; gz <= z1; gz++) {
      const k = gx * 10007 + gz;
      if (!streamHash.has(k)) streamHash.set(k, []);
      streamHash.get(k).push([a, b]);
    }
  }
}
export function waterLevelAt(x, z) {
  if (!streamHash) buildStreamHash();
  const list = streamHash.get(Math.floor(x / SH) * 10007 + Math.floor(z / SH));
  if (list) {
    let best = null, bd = Infinity;
    for (const [a, b] of list) {
      const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
      let t = l2 ? ((x - a[0]) * dx + (z - a[1]) * dz) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const d = Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t));
      const hw = a[3] + (b[3] - a[3]) * t;
      if (d < hw * 0.85 && d < bd) { bd = d; best = a[2] + (b[2] - a[2]) * t + 0.08; }
    }
    if (best !== null) return best;
  }
  return 0;
}
