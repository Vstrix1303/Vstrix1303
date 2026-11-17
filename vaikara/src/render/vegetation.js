// Vegetation: every tree on the map is placed from the baked biome. Within
// `treeNear` of the camera trees are full meshes (refilled as you move);
// beyond, they are crossed-quad impostors rendered from the real meshes at
// load. Close to the camera a scatter of grass, rice, tea bushes and ferns
// follows you around.
import * as THREE from 'three/webgpu';
import {
  positionLocal, positionWorld, vec3, vec4, float, uniform, length, step, select, texture, uv, mix, sin, attribute, hash, instanceIndex,
  modelWorldMatrix, smoothstep, max, cameraPosition, normalize, instance, transformNormalToView,
} from 'three/tsl';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { G, U } from '../state.js';
import { W, getHeight, getSlope, getBiome, nearestRoad } from '../world/data.js';
import { makeRng } from '../world/noise.js';
import { buildFlora } from './trees.js';

const Z = (W.meta?.zones) || { none: 0, mangrove: 1, paddy: 2, salt: 3, tea: 4, teak: 5, elephant: 6, settle: 7, beach: 8, meadow: 9, bank: 10, highland: 11 };
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();

export class Vegetation {
  constructor(scene, renderer) {
    this.scene = scene; this.renderer = renderer;
    this.nearR = uniform(G.Q.treeNear);
    this.palmR = uniform(G.Q.treeNear * (G.quality === 'high' || G.quality === 'ultra' ? 0.68 : 0.55));
    this.farR = uniform(G.Q.treeFar);
    // full meshes inside r0, light meshes r0..r1 (nearR / palmR), impostors beyond
    this.r0 = uniform(G.Q.treeNear * 0.42);
    this.palmR0 = uniform(this.palmR.value * 0.5);
    this.lastFill = new THREE.Vector3(1e9, 0, 0);
    this.lastScatter = new THREE.Vector3(1e9, 0, 0);
  }

  async build(progress) {
    const flora = this.flora = buildFlora();
    // ── place every tree
    const rnd = makeRng(2024);
    const { QX, QZ, QS, X0, Z0 } = W;
    const trees = { palm: [], broad: [], broad2: [], teak: [], mangrove: [], banana: [] };
    // planted first: the garden trees of every house compound
    for (const g of this.scene.userData.gardens || []) {
      const [x, z] = g.p, y = getHeight(x, z);
      if (y < 0.5) continue;
      trees[g.sp].push({ x, y: y - 0.15 + (g.yOff || 0), z, rot: rnd() * Math.PI * 2, s: (g.s || 1) * (0.8 + rnd() * 0.35), v: Math.floor(rnd() * flora.species[g.sp].variants.length) });
      if (g.sp !== 'banana') G.colliders?.addCircle(x, z, g.sp === 'palm' ? 0.3 : 0.5, y - 1, y + 6);
    }
    const col = G.colliders;
    for (let j = 0; j < QZ; j++) {
      if (j % 64 === 0) { progress?.(j / QZ * 0.5); await new Promise((r) => setTimeout(r, 0)); }
      for (let i = 0; i < QX; i++) {
        const k = (j * QX + i) * 4;
        const palm = W.BIO[k] / 255, forest = W.BIO[k + 1] / 255, zone = W.BIO[k + 2];
        if (palm < 0.02 && forest < 0.02) continue;
        for (let att = 0; att < 2; att++) {
        const x = X0 + (i + rnd() - 0.5) * QS, z = Z0 + (j + rnd() - 0.5) * QS;
        const r = rnd();
        let sp = null;
        if (zone === Z.mangrove) { if (r < forest * 0.7) sp = 'mangrove'; }
        else if (r < palm * 0.72) sp = 'palm';
        else if (r < palm * 0.72 + forest * 0.8) {
          const r2 = rnd();
          sp = zone === Z.teak ? (r2 < 0.8 ? 'teak' : 'broad') : zone === Z.settle || zone === Z.bank ? (r2 < 0.45 ? 'banana' : 'broad') : r2 < 0.5 ? 'broad' : r2 < 0.93 ? 'broad2' : 'teak';
        }
        if (!sp) continue;
        const y = getHeight(x, z);
        if (sp === 'mangrove') { if (y < -0.7 || y > 1.8) continue; }
        else if (y < 0.7 || getSlope(x, z) > 0.75) continue;
        if (nearestRoad(x, z).d < (sp === 'palm' ? 4 : 6)) continue;
        if (col && col.blocked(x, z, sp === 'palm' ? 1.5 : 3.5)) continue;
        const v = Math.floor(rnd() * flora.species[sp].variants.length);
        trees[sp].push({ x, y: sp === 'mangrove' ? Math.max(y, -0.3) : y - 0.15, z, rot: rnd() * Math.PI * 2, s: 0.8 + rnd() * 0.45, v });
        if (col && sp !== 'banana') col.addCircle(x, z, sp === 'palm' ? 0.3 : 0.6, y - 1, y + 6);
        }
      }
    }
    this.trees = trees;
    let total = 0; for (const k in trees) total += trees[k].length;
    console.info('[vegetation] trees placed:', total, Object.fromEntries(Object.entries(trees).map(([k, v]) => [k, v.length])));
    // spatial grid for near refills
    this.grid = new Map();
    for (const sp in trees) for (const t of trees[sp]) {
      const key = Math.floor(t.x / 100) * 1000 + Math.floor(t.z / 100);
      if (!this.grid.has(key)) this.grid.set(key, []);
      t.sp = sp;
      this.grid.get(key).push(t);
    }
    progress?.(0.6);
    // ── near meshes: full trees (LOD0) and light trees (LOD1), one InstancedMesh per variant
    this.near = []; this.mid = [];
    const fullCap = { palm: 2200, broad: 2200, broad2: 2200, teak: 1500, mangrove: 2500, banana: 1500 };
    const midCap = { palm: 4500, broad: 5000, broad2: 5000, teak: 3000, mangrove: 6000, banana: 2000 };
    const midShadow = G.quality === 'high' || G.quality === 'ultra';
    const makeSet = (S, geos, cap, list, shadow) => geos.map((v) => {
      const g = v.geo.clone();
      g.setAttribute('iOrigin', new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3));
      const m = new THREE.InstancedMesh(g, S.mats.map((mm) => {
        const c = mm.clone();
        // NodeMaterial.clone() does not carry these over reliably
        c.alphaTest = mm.alphaTest; c.side = mm.side; c.map = mm.map; c.envMapIntensity = mm.envMapIntensity;
        return c;
      }), cap);
      hideAll(m);
      m.userData.cat = 'trees';
      m.castShadow = shadow; m.receiveShadow = true; m.frustumCulled = false;
      this.scene.add(m);
      list.push(m);
      if (location.search.includes('nonear')) m.visible = false;
      return m;
    });
    for (const sp in flora.species) {
      const S = flora.species[sp];
      S.near = makeSet(S, S.variants, fullCap[sp], this.near, true);
      S.mid = makeSet(S, S.lite, midCap[sp], this.mid, midShadow);
    }
    progress?.(0.7);
    // ── impostors
    await this.buildImpostors();
    progress?.(0.9);
    // ── near-field scatter
    await this.buildScatter();
    progress?.(1);
  }

  async buildImpostors() {
    const { species } = this.flora;
    const R = this.renderer;
    const size = 256;
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    const scn = new THREE.Scene();
    scn.add(new THREE.AmbientLight(0xffffff, 1.0));
    const dl = new THREE.DirectionalLight(0xffffff, 1.6); dl.position.set(0.4, 1, 0.8); scn.add(dl);
    const nearR = this.nearR, farR = this.farR;
    for (const sp in species) {
      const S = species[sp];
      S.far = [];
      for (let vi = 0; vi < S.variants.length; vi++) {
        const v = S.variants[vi];
        const bb = v.geo.boundingBox;
        const w = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) * 1.04, h = (bb.max.y - Math.min(0, bb.min.y)) * 1.04;
        const ext = Math.max(w, h) / 2;
        cam.left = -ext; cam.right = ext; cam.top = h / 2 + ext - h / 2; cam.bottom = -ext + 0;
        cam.top = ext; cam.bottom = -ext;
        const cy = (bb.max.y + Math.min(0, bb.min.y)) / 2;
        const el = sp === 'palm' ? 0.42 : 0.22; // look down a little so flat crowns read
        cam.position.set(0, cy + Math.sin(el) * 60, Math.cos(el) * 60); cam.lookAt(0, cy, 0); cam.updateProjectionMatrix();
        const mats = S.mats.map((m) => {
          const b = new THREE.MeshBasicNodeMaterial({ map: m.map, color: m.color.clone().multiplyScalar(0.9), alphaTest: 0.45, side: THREE.DoubleSide });
          return b;
        });
        const mesh = new THREE.Mesh(v.geo, mats);
        scn.add(mesh);
        const rt = new THREE.RenderTarget(size, size * (h / (2 * ext) > 1 ? 1 : 1), { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true });
        rt.texture.colorSpace = THREE.LinearSRGBColorSpace;
        R.setRenderTarget(rt);
        R.setClearColor(new THREE.Color(0.12, 0.16, 0.06), 0);
        R.clear();
        R.render(scn, cam);
        R.setRenderTarget(null);
        R.setClearColor(0x000000, 1);
        scn.remove(mesh);
        // crossed quads sized to the capture frame (−ext..ext around cy)
        const geo = new THREE.BufferGeometry();
        const P = [], N = [], UV = [], I = [];
        for (let k = 0; k < 2; k++) {
          const a = k * Math.PI / 2, ux = Math.cos(a) * ext, uz = Math.sin(a) * ext;
          const b = P.length / 3;
          for (const [cu, cv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
            P.push(cu * ux, cy + cv * ext, cu * uz);
            N.push(cu * 0.3 * Math.cos(a), 0.9, cu * 0.3 * Math.sin(a));
            UV.push((cu + 1) / 2, (cv + 1) / 2);
          }
          I.push(b, b + 1, b + 2, b, b + 2, b + 3);
        }
        geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
        geo.setIndex(I);
        const fm = new THREE.MeshStandardNodeMaterial({ map: rt.texture, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1, color: 0xaca67e });
        fm.envMapIntensity = 0.25;
        // thin fronds lose coverage in the mip chain: boost alpha so distant crowns don't vanish
        fm.opacityNode = texture(rt.texture, uv()).a.mul(2.6).min(1);
        fm.emissiveNode = texture(rt.texture, uv()).rgb.mul(vec3(0.68, 0.65, 0.5)).mul(U.sunColor).mul(0.3);
        // a flat card has no real orientation: light it as a crown half-turned to the sun
        fm.normalNode = transformNormalToView(normalize(vec3(U.sunDir.x.mul(0.55), 0.8, U.sunDir.z.mul(0.55))));
        // collapse impostors inside the near radius and beyond the far radius
        const list = this.trees[sp].filter((t) => t.v === vi);
        // one InstancedMesh per 1 km cell: frustum-culled, and thinned with distance
        const cells = new Map();
        for (const t of list) { const k = `${Math.floor(t.x / 1000)},${Math.floor(t.z / 1000)}`; if (!cells.has(k)) cells.set(k, []); cells.get(k).push(t); }
        for (const [k, cl] of cells) {
          const rr = makeRng(cl.length * 31 + vi * 7 + sp.length);
          for (let i = cl.length - 1; i > 0; i--) { const j = Math.floor(rr() * (i + 1)); [cl[i], cl[j]] = [cl[j], cl[i]]; }
          const gc = geo.clone();
          const org = new Float32Array(cl.length * 3);
          const im = new THREE.InstancedMesh(gc, fm, cl.length);
          cl.forEach((t, i) => {
            _e.set(0, t.rot, 0); _q.setFromEuler(_e); _s.setScalar(t.s); _p.set(t.x, t.y, t.z);
            im.setMatrixAt(i, _m.compose(_p, _q, _s));
            org[i * 3] = t.x; org[i * 3 + 1] = t.y; org[i * 3 + 2] = t.z;
          });
          gc.setAttribute('iOrigin', new THREE.InstancedBufferAttribute(org, 3));
          im.instanceMatrix.needsUpdate = true;
          im.computeBoundingSphere();
          im.castShadow = false; im.receiveShadow = false; im.frustumCulled = true; im.userData.cat = 'tree impostors';
          this.scene.add(im);
          const [ci, cj] = k.split(',').map(Number);
          S.far.push({ mesh: im, n: cl.length, mat: fm, x: (ci + 0.5) * 1000, z: (cj + 0.5) * 1000 });
          if (location.search.includes('nofar')) im.visible = false;
        }
      }
    }
    // distance-gating node, shared: uses the instance's translation column
    for (const sp in species) for (const f of species[sp].far) {
      f.mat.positionNode = farGate(sp === 'palm' ? this.palmR : nearR, farR);
    }
    for (const sp in species) {
      const r0 = sp === 'palm' ? this.palmR0 : this.r0, r1 = sp === 'palm' ? this.palmR : nearR;
      for (const m of species[sp].near) for (const mat of m.material) mat.positionNode = nearGate(mat.positionNode, r0);
      for (const m of species[sp].mid) for (const mat of m.material) mat.positionNode = midGate(mat.positionNode, r0, r1);
    }
  }

  async buildScatter() {
    const { M, grass, rice, tea } = this.flora;
    const fernGeo = await loadFern();
    const mk = (geo, mat, cap, shadow = false) => {
      const m = new THREE.InstancedMesh(geo, mat, cap);
      hideAll(m);
      m.userData.cat = 'ground cover';
      m.frustumCulled = false; m.castShadow = shadow; m.receiveShadow = true;
      this.scene.add(m);
      return m;
    };
    this.scatter = {
      grass: mk(grass, M.grass, Math.round(22000 * G.Q.grass)),
      rice: mk(rice, M.rice, Math.round(16000 * G.Q.grass)),
      tea: mk(tea, M.tea, Math.round(16000 * G.Q.grass), true),
      fern: fernGeo ? mk(fernGeo.geometry, fernGeo.material, Math.round(260 * G.Q.grass), false) : null,
    };
  }

  fillScatter(cam) {
    const S = this.scatter, q = G.Q.grass;
    const cnt = { grass: 0, rice: 0, tea: 0, fern: 0 };
    const put = (name, x, y, z, rot, s, sy = s) => {
      const m = S[name]; if (!m || cnt[name] >= m.instanceMatrix.count) return;
      _e.set(0, rot, 0); _q.setFromEuler(_e); _s.set(s, sy, s); _p.set(x, y, z);
      m.setMatrixAt(cnt[name]++, _m.compose(_p, _q, _s));
    };
    const cell = 1.15 / Math.sqrt(q);
    const R = 70, Rt = 190;
    const cx0 = Math.floor(cam.x / cell), cz0 = Math.floor(cam.z / cell);
    const h = (a, b, s) => { const v = Math.sin(a * 127.1 + b * 311.7 + s * 74.7) * 43758.5453; return v - Math.floor(v); };
    // tea rows: wider radius, coarser rows on the terraces
    const tstep = 1.7;
    for (let gz = Math.floor((cam.z - Rt) / tstep); gz <= Math.floor((cam.z + Rt) / tstep); gz++) {
      for (let gx = Math.floor((cam.x - Rt) / tstep); gx <= Math.floor((cam.x + Rt) / tstep); gx++) {
        const x = gx * tstep + (h(gx, gz, 1) - 0.5) * 0.3, z = gz * tstep + (h(gx, gz, 2) - 0.5) * 0.3;
        if ((x - cam.x) ** 2 + (z - cam.z) ** 2 > Rt * Rt) continue;
        const b = getBiome(x, z);
        if (b[2] !== Z.tea) continue;
        const y = getHeight(x, z);
        // rows follow the terraces: skip the risers
        if (getSlope(x, z, 1) > 0.45) continue;
        if (nearestRoad(x, z).d < 3) continue;
        put('tea', x, y - 0.05, z, h(gx, gz, 3) * 6, 1.1 + h(gx, gz, 4) * 0.3, 1 + h(gx, gz, 5) * 0.2);
      }
    }
    for (let gz = cz0 - Math.ceil(R / cell); gz <= cz0 + Math.ceil(R / cell); gz++) {
      for (let gx = cx0 - Math.ceil(R / cell); gx <= cx0 + Math.ceil(R / cell); gx++) {
        const x = (gx + h(gx, gz, 1)) * cell, z = (gz + h(gx, gz, 2)) * cell;
        const d2 = (x - cam.x) ** 2 + (z - cam.z) ** 2;
        if (d2 > R * R) continue;
        const b = getBiome(x, z), zone = b[2];
        const y = getHeight(x, z);
        const r = h(gx, gz, 3);
        if (zone === Z.paddy) {
          if (y < 1.5 && y > 1.0 && r < 0.92) put('rice', x, y - 0.05, z, r * 9, 0.85 + h(gx, gz, 6) * 0.4);
          continue;
        }
        if (y < 0.8 || zone === Z.salt || zone === Z.tea) continue;
        const under = b[3] / 255;
        if (r > under * 0.85 + 0.12) continue;
        if (nearestRoad(x, z).d < 2.5) continue;
        if (G.colliders.blocked(x, z, 0.4)) continue;
        const forest = b[1] / 255;
        if (S.fern && forest > 0.35 && d2 < 28 * 28 && h(gx, gz, 7) < 0.3) put('fern', x, y - 0.05, z, r * 9, 0.9 + h(gx, gz, 8) * 1.1);
        else put('grass', x, y - 0.05, z, r * 9, 0.45 + h(gx, gz, 9) * 0.5, 0.35 + h(gx, gz, 10) * 0.6 + (zone === Z.meadow ? 0.35 : 0));
      }
    }
    for (const k in S) if (S[k]) { S[k].count = cnt[k]; S[k].instanceMatrix.needsUpdate = true; }
  }

  fillNear(cam) {
    const { species } = this.flora;
    const ls = G.lodScale ?? 1;
    const R1 = G.Q.treeNear * ls + 30;
    const counts = new Map();
    for (const sp in species) for (const m of [...species[sp].near, ...species[sp].mid]) counts.set(m, 0);
    const i0 = Math.floor((cam.x - R1) / 100), i1 = Math.floor((cam.x + R1) / 100);
    const j0 = Math.floor((cam.z - R1) / 100), j1 = Math.floor((cam.z + R1) / 100);
    const put = (m, t) => {
      const c = counts.get(m);
      if (c >= m.instanceMatrix.count) return;
      _e.set(0, t.rot, 0); _q.setFromEuler(_e); _s.setScalar(t.s); _p.set(t.x, t.y, t.z);
      m.setMatrixAt(c, _m.compose(_p, _q, _s));
      m.geometry.attributes.iOrigin.setXYZ(c, t.x, t.y, t.z);
      counts.set(m, c + 1);
    };
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const list = this.grid.get(i * 1000 + j);
      if (!list) continue;
      for (const t of list) {
        const d2 = (t.x - cam.x) ** 2 + (t.z - cam.z) ** 2;
        if (d2 > R1 * R1) continue;
        const r0 = (t.sp === 'palm' ? this.palmR0.value : this.r0.value) + 25;
        if (d2 < r0 * r0) put(species[t.sp].near[t.v], t);
        const r0in = (t.sp === 'palm' ? this.palmR0.value : this.r0.value) - 25;
        if (d2 > r0in * r0in || r0in < 0) put(species[t.sp].mid[t.v], t);
      }
    }
    for (const [m, c] of counts) {
      m.count = c; m.instanceMatrix.needsUpdate = true; m.geometry.attributes.iOrigin.needsUpdate = true;
      m.visible = c > 0 && !location.search.includes('nonear');
      if (c > 0) { m.computeBoundingSphere(); m.frustumCulled = true; }
    }
  }

  // impostor cells: hide beyond the far radius, thin out with distance
  updateFar(cam) {
    const far = this.farR.value;
    for (const sp in this.flora.species) for (const f of this.flora.species[sp].far) {
      const d = Math.max(0, Math.hypot(cam.x - f.x, cam.z - f.z) - 707);
      const vis = d < far && !location.search.includes('nofar');
      f.mesh.visible = vis;
      if (vis) f.mesh.count = Math.max(1, Math.ceil(f.n * (d < 1200 ? 1 : 1 - 0.65 * Math.min(1, (d - 1200) / Math.max(1, far - 1200)))));
    }
  }

  update(cam) {
    if (!this.trees) return;
    const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
    // LOD radii follow the auto-quality scale
    const ls = G.lodScale ?? 1, pr = G.Q.treeNear * (G.quality === 'high' || G.quality === 'ultra' ? 0.68 : 0.55);
    this.nearR.value = G.Q.treeNear * ls; this.palmR.value = pr * ls;
    this.r0.value = G.Q.treeNear * 0.42 * ls; this.palmR0.value = pr * 0.5 * ls;
    this.farR.value = G.Q.treeFar * (0.6 + 0.4 * ls);
    if (flat(cam, this.lastFill) > 25 || ls !== this.lastLs) { this.fillNear(cam); this.lastFill.copy(cam); this.lastLs = ls; }
    if (!this.lastFar || flat(cam, this.lastFar) > 150) { this.updateFar(cam); (this.lastFar ||= new THREE.Vector3()).copy(cam); }
    if (flat(cam, this.lastScatter) > 12) { this.fillScatter(cam); this.lastScatter.copy(cam); }
  }
}

// Each instanced geometry carries its instances' origins (iOrigin) so the
// vertex stage can hand trees over between the near and far sets exactly.
function instanceOrigin() {
  return attribute('iOrigin', 'vec3');
}

function midGate(base, r0, r1) {
  const o = instanceOrigin();
  const d = length(o.xz.sub(U.camPos.xz));
  return (base || positionLocal).mul(step(r0, d).mul(step(d, r1)));
}
function farGate(nearR, farR) {
  const o = instanceOrigin();
  const d = length(o.xz.sub(U.camPos.xz));
  const keep = step(nearR, d).mul(step(d, farR));
  return positionLocal.mul(keep);
}
// Start an instanced mesh with every slot filled by a collapsed (zero-scale)
// matrix, so the GPU buffers are created at full size before the first frame.
const _zero = new THREE.Matrix4().makeScale(0, 0, 0);
function hideAll(m) {
  for (let i = 0; i < m.instanceMatrix.count; i++) m.setMatrixAt(i, _zero);
  m.count = m.instanceMatrix.count;
  m.instanceMatrix.needsUpdate = true;
}

function nearGate(base, nearR) {
  const o = instanceOrigin();
  const d = length(o.xz.sub(U.camPos.xz));
  const keep = step(d, nearR);
  return (base || positionLocal).mul(keep);
}

async function loadFern() {
  try {
    const g = await new GLTFLoader().loadAsync(`${G.base}models/fern_02/fern_02.gltf`);
    let mesh = null;
    g.scene.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
    if (!mesh) return null;
    const geo = mesh.geometry.clone();
    mesh.updateWorldMatrix(true, false);
    geo.applyMatrix4(mesh.matrixWorld);
    const src = mesh.material;
    const mat = new THREE.MeshStandardNodeMaterial({ map: src.map, normalMap: src.normalMap, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8, color: 0xc8d8a8 });
    if (src.map) src.map.colorSpace = THREE.SRGBColorSpace;
    return { geometry: geo, material: mat };
  } catch (e) { console.warn('fern model', e); return null; }
}
