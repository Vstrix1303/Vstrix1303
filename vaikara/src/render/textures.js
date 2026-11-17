// Loads the CC0 PBR material sets and the packed terrain texture arrays,
// plus a few procedural textures (noise, water normals).
import * as THREE from 'three/webgpu';
import { G } from '../state.js';

const loader = new THREE.TextureLoader();
const cache = new Map();

export function loadTex(url, srgb = false, repeat = true) {
  if (cache.has(url)) return cache.get(url);
  const t = loader.load(url);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  cache.set(url, t);
  return t;
}

// A PBR set downloaded by scripts/fetch-assets.mjs: col / nrm / arm (AO, rough, metal).
export function pbr(name) {
  const b = `${G.base}tex/${name}/`;
  return { map: loadTex(b + 'col.jpg', true), normalMap: loadTex(b + 'nrm.jpg'), arm: loadTex(b + 'arm.jpg') };
}

async function decode(url) {
  const blob = await (await fetch(url)).blob();
  const bmp = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  const c = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  return { data: ctx.getImageData(0, 0, bmp.width, bmp.height).data, w: bmp.width, h: bmp.height };
}

// Vertical strips (1024 × 1024·layers) → DataArrayTexture.
async function arrayTex(url, layers, srgb) {
  const { data, w } = await decode(url);
  const t = new THREE.DataArrayTexture(new Uint8Array(data.buffer), w, w, layers);
  t.format = THREE.RGBAFormat;
  t.type = THREE.UnsignedByteType;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

export async function loadImageData(url) { return decode(url); }

export async function loadTerrainArrays() {
  const [albedo, normal] = await Promise.all([
    arrayTex(`${G.base}tex/terrain_albedo.webp`, 8, false), // sRGB decoded manually in shader (alpha = roughness)
    arrayTex(`${G.base}tex/terrain_normal.webp`, 8, false),
  ]);
  return { albedo, normal };
}

export function dataTex(url) {
  const t = loader.load(url);
  t.colorSpace = THREE.NoColorSpace;
  t.flipY = false;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.generateMipmaps = false;
  t.minFilter = THREE.LinearFilter;
  return t;
}

// Tileable value-noise texture (R: fine, G: medium, B: coarse, A: cells).
export function noiseTexture(size = 256) {
  const data = new Uint8Array(size * size * 4);
  const grid = (n, seed) => {
    const g = new Float32Array((n + 1) * (n + 1));
    let s = seed;
    for (let i = 0; i < g.length; i++) { s = (s * 16807) % 2147483647; g[i] = s / 2147483647; }
    for (let i = 0; i <= n; i++) { g[i * (n + 1) + n] = g[i * (n + 1)]; g[n * (n + 1) + i] = g[i]; }
    return (u, v) => {
      const x = u * n, y = v * n, i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const a = g[j * (n + 1) + i], b = g[j * (n + 1) + i + 1], c = g[(j + 1) * (n + 1) + i], d = g[(j + 1) * (n + 1) + i + 1];
      return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    };
  };
  const oct = [[grid(32, 7), grid(64, 9), grid(128, 3)], [grid(8, 11), grid(16, 13), grid(32, 17)], [grid(2, 19), grid(4, 23), grid(8, 29)], [grid(16, 31), grid(32, 37), grid(64, 41)]];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size, k = (y * size + x) * 4;
    for (let c = 0; c < 4; c++) {
      const [a, b, d] = oct[c];
      data[k + c] = Math.min(255, Math.max(0, (a(u, v) * 0.55 + b(u, v) * 0.3 + d(u, v) * 0.15) * 255));
    }
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}

// Tileable water normal map from summed sine/noise octaves.
export function waterNormalTexture(size = 512) {
  const h = new Float32Array(size * size);
  let s = 12345;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const waves = Array.from({ length: 48 }, () => {
    const kx = Math.round((rnd() - 0.5) * 2 * (2 + rnd() * 22)), ky = Math.round((rnd() - 0.5) * 2 * (2 + rnd() * 22));
    return [kx, ky, rnd() * Math.PI * 2, 1 / (1 + Math.hypot(kx, ky) * 0.6)];
  });
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let v = 0;
    for (const [kx, ky, p, a] of waves) v += a * Math.sin(((kx * x + ky * y) / size) * Math.PI * 2 + p);
    h[y * size + x] = v;
  }
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const hx = h[y * size + ((x + 1) % size)] - h[y * size + ((x - 1 + size) % size)];
    const hy = h[((y + 1) % size) * size + x] - h[((y - 1 + size) % size) * size + x];
    const nx = -hx * 0.9, ny = -hy * 0.9, nz = 1, l = Math.hypot(nx, ny, nz);
    const k = (y * size + x) * 4;
    data[k] = (nx / l * 0.5 + 0.5) * 255; data[k + 1] = (ny / l * 0.5 + 0.5) * 255; data[k + 2] = (nz / l * 0.5 + 0.5) * 255; data[k + 3] = 255;
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}

// Material factory for PBR sets with world-scale UVs.
const matCache = new Map();
export function pbrMaterial(name, opts = {}) {
  const key = name + JSON.stringify(opts);
  if (matCache.has(key)) return matCache.get(key);
  const s = pbr(name);
  const m = new THREE.MeshStandardNodeMaterial({
    map: s.map, normalMap: s.normalMap, aoMap: s.arm, roughnessMap: s.arm, metalnessMap: s.arm,
    roughness: opts.roughness ?? 1, metalness: 0, color: opts.color ?? 0xffffff, side: opts.side ?? THREE.FrontSide,
  });
  if (opts.normalScale) m.normalScale.setScalar(opts.normalScale);
  matCache.set(key, m);
  return m;
}
