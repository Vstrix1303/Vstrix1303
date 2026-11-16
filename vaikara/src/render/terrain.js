// Chunked-LOD terrain. 250 m chunks aligned to the heightmap grid, four
// detail levels (2 m → 16 m) chosen by distance, skirts to hide cracks.
// Material: 8-layer height-blended PBR splat with triplanar rock, macro
// variation, biome tinting and shoreline wetness (TSL).
import * as THREE from 'three/webgpu';
import {
  Fn, texture, uniform, vec2, vec3, vec4, float, int, positionWorld, normalWorld, mix, smoothstep, clamp, max, pow,
  abs, normalize, transformNormalToView, dot, length, exp, sin, attribute, select,
} from 'three/tsl';
import { G, U } from '../state.js';
import { W, getHeight } from '../world/data.js';
import { WORLD_W, WORLD_H } from '../world/layout.js';
import { loadTerrainArrays, dataTex, noiseTexture } from './textures.js';
import { makeNoise, fbm } from '../world/noise.js';

const CELLS = 128;                 // heightmap cells per chunk
let CHUNK = 250;                   // metres (set from CS)
const LODS = [1, 2, 4, 8, 16];     // vertex step in cells
const RING = 6;                    // extra chunks of "beyond the map" terrain

const edgeNoise = makeNoise(99);

// Height continuing past the map edge: the clamped edge height blended with
// noise hills so the horizon isn't a cliff into the void.
function heightOut(x, z) {
  const hw = WORLD_W / 2, hh = WORLD_H / 2;
  // mirror the map across its edges so the land continues naturally
  const mx = x > hw ? 2 * hw - x : x < -hw ? -2 * hw - x : x;
  const mz = z > hh ? 2 * hh - z : z < -hh ? -2 * hh - z : z;
  const h = getHeight(mx, mz);
  const d = Math.hypot(x - Math.max(-hw, Math.min(hw, x)), z - Math.max(-hh, Math.min(hh, z)));
  if (d <= 0) return h;
  const n = fbm(edgeNoise, x / 700, z / 700, 4);
  if (h < -0.5 || x < -hw + 900) return Math.min(h, -1.5) - d * 0.01; // the sea continues west
  return Math.max(0.5, h * (1 - Math.min(0.6, d / 4000)) + n * 25 * Math.min(1, d / 300));
}

function buildChunkGeometry(ci, cj, step) {
  const { CS, X0, Z0, NX, NZ, H } = W;
  const n = CELLS / step + 1;
  const skirt = 4 * n;
  const vcount = n * n + skirt;
  const pos = new Float32Array(vcount * 3), nor = new Float32Array(vcount * 3);
  const i0 = ci * CELLS, j0 = cj * CELLS;
  const outside = ci < 0 || cj < 0 || (ci + 1) * CELLS > NX - 1 + CELLS || (cj + 1) * CELLS > NZ - 1 + CELLS;
  const hget = (gi, gj) => {
    if (gi >= 0 && gj >= 0 && gi < NX && gj < NZ) return H[gj * NX + gi];
    return heightOut(X0 + gi * CS, Z0 + gj * CS);
  };
  let k = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const gi = i0 + i * step, gj = j0 + j * step;
    const y = hget(gi, gj);
    pos[k * 3] = X0 + gi * CS; pos[k * 3 + 1] = y; pos[k * 3 + 2] = Z0 + gj * CS;
    const e = Math.max(1, step >> 1);
    const hx = hget(gi + e, gj) - hget(gi - e, gj), hz = hget(gi, gj + e) - hget(gi, gj - e);
    const nx = -hx, ny = 2 * e * CS, nz = -hz, l = Math.hypot(nx, ny, nz);
    nor[k * 3] = nx / l; nor[k * 3 + 1] = ny / l; nor[k * 3 + 2] = nz / l;
    k++;
  }
  const idx = [];
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
    const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
    // alternate diagonal for nicer shading
    if ((i + j) & 1) idx.push(a, c, b, b, c, d); else idx.push(a, c, d, a, d, b);
  }
  // skirts around the four edges
  const drop = 3 + step * 2;
  const edge = (list) => {
    const start = k;
    for (const v of list) {
      pos[k * 3] = pos[v * 3]; pos[k * 3 + 1] = pos[v * 3 + 1] - drop; pos[k * 3 + 2] = pos[v * 3 + 2];
      nor[k * 3] = nor[v * 3]; nor[k * 3 + 1] = nor[v * 3 + 1]; nor[k * 3 + 2] = nor[v * 3 + 2];
      k++;
    }
    for (let i = 0; i < list.length - 1; i++) {
      const a = list[i], b = list[i + 1], c = start + i, d = start + i + 1;
      idx.push(a, b, c, b, d, c, a, c, b, b, c, d); // both windings
    }
  };
  const top = [], bot = [], left = [], right = [];
  for (let i = 0; i < n; i++) { top.push(i); bot.push((n - 1) * n + i); left.push(i * n); right.push(i * n + n - 1); }
  edge(top); edge(bot); edge(left); edge(right);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setIndex(idx);
  g.computeBoundingBox(); g.computeBoundingSphere();
  void outside;
  return g;
}

// ── Material
export async function terrainMaterial() {
  const { albedo, normal } = await loadTerrainArrays();
  const splatA = dataTex(`${G.base}baked/splatA.png`);
  const splatB = dataTex(`${G.base}baked/splatB.png`);
  const noise = noiseTexture(256);
  // biome as a texture (zone tint at distance)
  const bio = new THREE.DataTexture(W.BIO, W.QX, W.QZ, THREE.RGBAFormat);
  bio.magFilter = THREE.NearestFilter; bio.minFilter = THREE.NearestFilter; bio.needsUpdate = true;

  const SCALE = [3.2, 3.5, 3.0, 2.6, 4.0, 3.0, 7.0, 3.6];  // metres per tile
  const TINT = [
    [0.50, 0.78, 0.28], // grass → lush monsoon green
    [0.82, 0.85, 0.62], // forest floor
    [1.02, 0.80, 0.68], // laterite
    [0.95, 0.80, 0.66], // red dirt road
    [1.18, 1.06, 0.86], // sand
    [0.80, 0.74, 0.62], // mud
    [0.62, 0.60, 0.58], // rock (cooler grey)
    [0.74, 0.90, 0.40], // meadow
  ];
  const NSTR = [0.8, 0.9, 1.0, 0.8, 0.6, 0.8, 1.3, 0.8];

  const mat = new THREE.MeshStandardNodeMaterial({ roughness: 1, metalness: 0 });
  const wuv = Fn(() => vec2(positionWorld.x.sub(W.X0).div(WORLD_W), positionWorld.z.sub(W.Z0).div(WORLD_H)))();
  const p = positionWorld.xz;
  const nW = normalize(normalWorld);
  const sA = texture(splatA, wuv), sB = texture(splatB, wuv);
  const nz = texture(noise, p.mul(1 / 211)), nz2 = texture(noise, p.mul(1 / 37));
  const weights = [sA.r, sA.g, sA.b, sA.a, sB.r, sB.g, sB.b, sB.a];

  // per-layer samples (rock layer biplanar to avoid stretching on cliffs)
  const toLin = (c) => pow(c, vec3(2.2));
  const samples = [];
  for (let i = 0; i < 8; i++) {
    const s = SCALE[i];
    if (i === 6) {
      const bx = abs(nW.x), bz = abs(nW.z), by = abs(nW.y);
      const wsum = bx.add(by).add(bz);
      const uvX = vec2(positionWorld.z, positionWorld.y).div(s), uvZ = vec2(positionWorld.x, positionWorld.y).div(s), uvY = p.div(s);
      const aX = texture(albedo, uvX).depth(int(i)), aZ = texture(albedo, uvZ).depth(int(i)), aY = texture(albedo, uvY).depth(int(i));
      const nX = texture(normal, uvX).depth(int(i)), nZ2 = texture(normal, uvZ).depth(int(i)), nY = texture(normal, uvY).depth(int(i));
      const a = aX.mul(bx).add(aZ.mul(bz)).add(aY.mul(by)).div(wsum);
      const nn = nX.mul(bx).add(nZ2.mul(bz)).add(nY.mul(by)).div(wsum);
      samples.push({ a, n: nn });
    } else {
      // rotate tiles per layer + macro offset to soften repetition
      const ang = i * 1.7;
      const c = Math.cos(ang), sn = Math.sin(ang);
      const uvr = vec2(p.x.mul(c).sub(p.y.mul(sn)), p.x.mul(sn).add(p.y.mul(c))).div(s);
      samples.push({ a: texture(albedo, uvr).depth(int(i)), n: texture(normal, uvr).depth(int(i)) });
    }
  }
  // height-based blend: weight × (layer height + bias), then sharpen
  const scores = weights.map((w, i) => w.mul(samples[i].n.a.mul(0.6).add(0.4)).add(w.mul(0.001)));
  let mx = scores[0];
  for (let i = 1; i < 8; i++) mx = max(mx, scores[i]);
  const cut = mx.sub(0.18);
  const bw = scores.map((s) => max(s.sub(cut), 0.0));
  let bsum = bw[0]; for (let i = 1; i < 8; i++) bsum = bsum.add(bw[i]);
  let col = vec3(0), rough = float(0), nrm = vec3(0), ao = float(0);
  for (let i = 0; i < 8; i++) {
    const w = bw[i].div(bsum);
    col = col.add(toLin(samples[i].a.rgb).mul(vec3(...TINT[i])).mul(w));
    rough = rough.add(samples[i].a.a.mul(w));
    nrm = nrm.add(samples[i].n.rgb.sub(0.5).mul(2).mul(vec3(NSTR[i], NSTR[i], 1)).mul(w));
    ao = ao.add(samples[i].n.b.mul(w));
  }
  // macro variation: large patches of colour / brightness
  const macro = nz.b.mul(0.5).add(nz.g.mul(0.5));
  col = col.mul(mix(vec3(0.82, 0.86, 0.80), vec3(1.12, 1.08, 1.0), macro)).mul(nz2.r.mul(0.25).add(0.88));
  // biome tint: paddy is bright young rice, tea is dark clipped rows, forest floor in canopy shade
  const bioS = texture(bio, wuv);
  const zone = bioS.b.mul(255);
  const isPaddy = smoothstep(1.5, 2.0, zone).mul(smoothstep(2.5, 2.0, zone));
  const isTea = smoothstep(3.5, 4.0, zone).mul(smoothstep(4.5, 4.0, zone));
  const teaRows = sin(positionWorld.y.mul(Math.PI * 2 / 3.4).add(nz2.g.mul(1.5))).mul(0.5).add(0.5);
  col = mix(col, col.mul(vec3(0.62, 1.12, 0.48)).mul(1.05), isPaddy.mul(0.75));
  col = mix(col, mix(vec3(0.05, 0.12, 0.03), vec3(0.11, 0.21, 0.05), teaRows), isTea.mul(0.85));
  const forestShade = bioS.g;
  col = mix(col, col.mul(vec3(0.55, 0.68, 0.42)), forestShade.mul(0.8));
  // wet shoreline: darker and glossier near/below the water line
  const h = positionWorld.y;
  const wet = smoothstep(1.4, 0.1, h);
  col = col.mul(mix(float(1), float(0.55), wet));
  rough = mix(rough, float(0.0), wet.mul(0.8));
  // normal: UDN blend in world space (tiles are planar in XZ)
  const nWorld = normalize(vec3(nW.x.add(nrm.x), nW.y, nW.z.add(nrm.y)));
  mat.colorNode = vec4(col, 1);
  mat.roughnessNode = clamp(rough.mul(0.5).add(0.5), 0.62, 1.0);
  mat.envMapIntensity = 0.6;
  mat.normalNode = transformNormalToView(nWorld);
  mat.aoNode = mix(float(1), ao, 0.7);
  return mat;
}

export class Terrain {
  constructor(scene, material) {
    this.scene = scene; this.material = material;
    CHUNK = CELLS * W.CS;
    this.chunks = new Map();
    this.group = new THREE.Group();
    this.group.name = 'terrain';
    scene.add(this.group);
    const nx = Math.ceil((W.NX - 1) / CELLS), nz = Math.ceil((W.NZ - 1) / CELLS);
    this.range = { i0: -RING, i1: nx - 1 + RING, j0: -RING, j1: nz - 1 + RING };
    this.queue = [];
    for (let j = this.range.j0; j <= this.range.j1; j++) for (let i = this.range.i0; i <= this.range.i1; i++) {
      const cx = W.X0 + (i + 0.5) * CHUNK, cz = W.Z0 + (j + 0.5) * CHUNK;
      const c = { i, j, cx, cz, cy: heightOut(cx, cz), lod: -1, want: 3, meshes: [] };
      this.chunks.set(`${i},${j}`, c);
    }
  }

  lodFor(c, cam) {
    const dx = Math.max(0, Math.abs(cam.x - c.cx) - CHUNK / 2), dz = Math.max(0, Math.abs(cam.z - c.cz) - CHUNK / 2);
    const d = Math.hypot(dx, dz, Math.max(0, cam.y - c.cy - 200) * 0.5) / G.Q.terrainLod;
    const outside = c.i < 0 || c.j < 0 || c.i >= this.range.i1 - RING + 1 || c.j >= this.range.j1 - RING + 1;
    let l = d < 180 ? 0 : d < 520 ? 1 : d < 1200 ? 2 : d < 2600 ? 3 : 4;
    if (outside) l = Math.max(l, 3);
    return l;
  }

  setLod(c, l) {
    if (!c.meshes[l]) {
      const m = new THREE.Mesh(buildChunkGeometry(c.i, c.j, LODS[l]), this.material);
      m.receiveShadow = true; m.castShadow = l >= 1;
      m.matrixAutoUpdate = false; m.updateMatrix();
      c.meshes[l] = m;
    }
    if (c.lod >= 0 && c.meshes[c.lod]) this.group.remove(c.meshes[c.lod]);
    this.group.add(c.meshes[l]);
    c.lod = l;
    // free very fine meshes when far away
    for (let k = 0; k < 2; k++) if (k < l - 1 && c.meshes[k]) { c.meshes[k].geometry.dispose(); c.meshes[k] = null; }
  }

  update(cam, budget = 6) {
    let built = 0;
    const list = [];
    for (const c of this.chunks.values()) {
      const l = this.lodFor(c, cam);
      if (l !== c.lod) list.push([c, l, Math.hypot(cam.x - c.cx, cam.z - c.cz)]);
    }
    list.sort((a, b) => a[2] - b[2]);
    for (const [c, l] of list) {
      if (c.lod < 0 || c.meshes[l] || built < budget) {
        if (!c.meshes[l]) built++;
        this.setLod(c, l);
      }
    }
  }

  buildAll(cam) { this.update(cam, 1e9); }
}
