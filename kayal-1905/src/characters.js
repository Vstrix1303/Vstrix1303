// Procedural people, horses, cattle, elephants, birds and boats — built
// from primitives and animated with hand-written joint curves.
import * as THREE from 'three';
import { GB, SGB } from './geo.js';
import { TEX } from './textures.js';
import { damp, clamp, lerp } from './util.js';

const matCache = new Map();
export function M(color, rough = 0.85, extra = null) {
  const k = color + '|' + rough + '|' + (extra ? JSON.stringify(extra) : '');
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color, roughness: rough, ...(extra || {}) }));
  return matCache.get(k);
}
const geoCache = new Map();
function capsule(r, len, seg = 8) {
  const k = `c${r}|${len}|${seg}`;
  if (!geoCache.has(k)) geoCache.set(k, new THREE.CapsuleGeometry(r, len, 3, seg));
  return geoCache.get(k);
}
function sphere(r, w = 10, h = 8) {
  const k = `s${r}|${w}|${h}`;
  if (!geoCache.has(k)) geoCache.set(k, new THREE.SphereGeometry(r, w, h));
  return geoCache.get(k);
}
function cyl(rt, rb, h, seg = 8, open = false) {
  const k = `y${rt}|${rb}|${h}|${seg}|${open}`;
  if (!geoCache.has(k)) geoCache.set(k, new THREE.CylinderGeometry(rt, rb, h, seg, 1, open));
  return geoCache.get(k);
}
function box(w, h, d) {
  const k = `b${w}|${h}|${d}`;
  if (!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, h, d));
  return geoCache.get(k);
}
export function mesh(geo, mat, parent, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}
export function group(parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

const mergedMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 });
// Collapse the plain meshes under each joint into one vertex-coloured mesh.
export function mergeStatic(root) {
  const groups = [];
  root.traverse((o) => { if (o.isGroup) groups.push(o); });
  for (const g of groups) {
    const ms = g.children.filter((c) => c.isMesh && c.children.length === 0 && c.material.isMeshStandardMaterial && c.material.side === THREE.FrontSide
      && !c.material.map && !c.material.transparent && c.material.metalness === 0 && c.material.emissive.getHex() === 0);
    if (ms.length < 2) continue;
    const gb = new GB();
    for (const m of ms) { m.updateMatrix(); const c = m.material.color; gb.add(m.geometry, m.matrix, [c.r, c.g, c.b]); g.remove(m); }
    const mm = new THREE.Mesh(gb.build(), mergedMat);
    mm.castShadow = true;
    g.add(mm);
  }
}

export { Human, CAST, SKIN } from './human.js';

export function makeStick(len = 1.5, color = 0x6a4a2a) {
  const m = new THREE.Mesh(cyl(0.018, 0.022, len, 6), M(color, 0.7));
  m.rotation.x = Math.PI / 2;
  m.position.set(0, -0.075, len * 0.32);
  m.castShadow = true;
  return m;
}
// a walking stick that hangs from the hand to the ground
export function makeCane(len = 0.92, color = 0x3a2616, knob = 0xc9a13a) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(cyl(0.012, 0.016, len, 6), M(color, 0.6)); m.position.y = -len / 2 + 0.06; m.castShadow = true; g.add(m);
  const k = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), M(knob, 0.4)); k.position.y = 0.07; g.add(k);
  g.position.set(0, -0.06, 0.03); g.rotation.x = 0.12;
  return g;
}
// a child's writing slate
export function makeSlate() {
  const g = new THREE.Group();
  const f = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, 0.016), M(0x7a5a36, 0.8)); g.add(f);
  const s = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.02), M(0x1c2024, 0.6)); g.add(s);
  g.position.set(0.03, -0.14, 0.05); g.rotation.set(0.2, 0.3, 0);
  return g;
}
export function makeLantern() {
  const g = new THREE.Group();
  g.position.y = -0.06;
  mesh(cyl(0.05, 0.06, 0.13, 6), new THREE.MeshStandardMaterial({ color: 0xffc070, emissive: 0xffa040, emissiveIntensity: 3, roughness: 0.4 }), g, 0, -0.14, 0);
  mesh(cyl(0.005, 0.005, 0.1, 4), M(0x222222), g, 0, -0.04, 0);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: new THREE.Color(2.2, 1.4, 0.5), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  sp.scale.setScalar(0.75); sp.position.y = -0.14;
  g.add(sp);
  return g;
}

export { Quadruped, Elephant, Bird } from './animals.js';


// =========================================================== BOATS
export function hullGeo(L, B, D, sheer = 0.5) {
  // a round-bilged hull: 26 stations, a smooth U section, rails along the gunwales and posts at stem and stern
  const g = new GB(), st = 26, K = 10, P = [];
  const sec = (s) => ({ z: (s - 0.5) * L, beam: B * Math.pow(Math.sin(Math.PI * clamp(s * 0.94 + 0.03, 0, 1)), 0.75), up: sheer * Math.pow(Math.abs(s * 2 - 1), 2.4) });
  const pt = (i, k) => { const { z, beam, up } = sec(i / st), a = -Math.PI / 2 + (k / K) * Math.PI, sn = Math.sin(a); return [beam * Math.sign(sn) * Math.pow(Math.abs(sn), 0.8), up * 0.75 + (D + up * 0.25) * (1 - Math.pow(Math.max(0, Math.cos(a)), 0.7)), z]; };
  for (let i = 0; i <= st; i++) { P.push([]); for (let k = 0; k <= K; k++) P[i].push(pt(i, k)); }
  const rows = [];
  for (let i = 0; i <= st; i++) {
    rows.push([]);
    for (let k = 0; k <= K; k++) {
      const p = P[i][k], a = P[Math.max(0, i - 1)][k], b = P[Math.min(st, i + 1)][k], c = P[i][Math.max(0, k - 1)], d = P[i][Math.min(K, k + 1)];
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - c[0], vy = d[1] - c[1], vz = d[2] - c[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      if (nx * p[0] + ny * (p[1] - D) < 0) { nx = -nx; ny = -ny; nz = -nz; }
      rows[i].push(g.vert(p[0], p[1], p[2], nx, ny, nz, (i / st) * 3, (k / K) * 1.2));
    }
  }
  for (let i = 0; i < st; i++) for (let k = 0; k < K; k++) g.quad(rows[i][k], rows[i][k + 1], rows[i + 1][k + 1], rows[i + 1][k]);
  const rr = 0.03 * Math.sqrt(B / 0.62);
  for (const k of [0, K]) g.tube((t) => { const i = t * st, i0 = Math.min(st - 1, Math.floor(i)), f = i - i0, a = P[i0][k], b = P[i0 + 1][k]; return [lerp(a[0], b[0], f), lerp(a[1], b[1], f) + rr * 0.3, lerp(a[2], b[2], f)]; }, () => rr, st, 6, L / 2, [0.8, 0.72, 0.62], 1);
  for (const i of [0, st]) { const a = P[i][K / 2], t = P[i][0]; g.tube((u) => [0, lerp(a[1] - 0.02, t[1] + rr * 3.5, u), a[2] + (i ? 1 : -1) * rr * (0.5 + u)], (u) => rr * (1.6 - 0.6 * u), 4, 6, 1, [0.7, 0.62, 0.52], 1, true); }
  return g.build(false);
}

export function makeVallam(o = {}) {
  const root = new THREE.Group();
  const hullM = new THREE.MeshStandardMaterial({ map: TEX.wood, color: 0x8a7a6a, roughness: 0.6, side: THREE.DoubleSide });
  const L = o.L ?? 6.4, B = o.B ?? 0.62, D = o.D ?? 0.5;
  const hull = new THREE.Mesh(hullGeo(L, B, D, o.sheer ?? 0.55), hullM);
  hull.castShadow = true; hull.receiveShadow = true;
  hull.position.y = -0.22;
  root.add(hull);
  const plankM = M(0x6a5540, 0.8);
  for (const z of [-1.9, -0.6, 0.9, 2.0]) mesh(box(B * 1.7, 0.035, 0.2), plankM, root, 0, 0.2, z * L / 6.4);
  for (let i = -4; i <= 4; i++) { const r = mesh(new THREE.TorusGeometry(B * 0.86, 0.018, 4, 10, Math.PI), plankM, root, 0, D * 0.62, i * L / 11); r.rotation.z = Math.PI; r.scale.set(Math.cos(i / 6.5), 1.0, 1); r.castShadow = false; }
  // inner floor so we never see water through the hull
  const fl = mesh(box(B * 1.2, 0.03, L * 0.8), M(0x3a2c20, 0.9), root, 0, -0.08, 0);
  fl.castShadow = false;
  const cargo = new THREE.Group();
  const sackM = new THREE.MeshStandardMaterial({ map: TEX.sack, roughness: 1 });
  for (let i = 0; i < 6; i++) {
    const s = mesh(sphere(0.3, 8, 6), sackM, cargo, (i % 2 - 0.5) * 0.36, 0.1 + Math.floor(i / 4) * 0.28, -0.2 + (Math.floor(i / 2) % 2) * 0.62 + Math.floor(i / 4) * 0.3);
    s.scale.set(1.0, 0.7, 1.25);
  }
  cargo.visible = false;
  root.add(cargo);
  return { root, cargo, L };
}

export function makePaddle() {
  const g = new THREE.Group();
  const shaft = mesh(cyl(0.018, 0.018, 1.5, 6), M(0x7a5a38, 0.7), g, 0, -0.45, 0);
  const blade = mesh(box(0.16, 0.42, 0.02), M(0x6a4a2c, 0.7), g, 0, -1.3, 0);
  g.rotation.x = 0.5;
  g.position.y = -0.06;
  return g;
}

export function makeKettuvallam() {
  const root = new THREE.Group();
  const hullM = new THREE.MeshStandardMaterial({ map: TEX.wood, color: 0x6a5a4a, roughness: 0.65, side: THREE.DoubleSide });
  const hull = new THREE.Mesh(hullGeo(15, 1.7, 1.1, 1.3), hullM);
  hull.castShadow = true; hull.position.y = -0.5;
  root.add(hull);
  mesh(box(2.4, 0.06, 11), M(0x5a4634, 0.9), root, 0, 0.45, 0);
  const th = new THREE.MeshStandardMaterial({ map: TEX.thatch, roughness: 1, side: THREE.DoubleSide });
  const canopy = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, 8, 12, 1, true, -Math.PI / 2, Math.PI), th);
  canopy.rotation.x = -Math.PI / 2; canopy.position.set(0, 0.5, -0.5); canopy.scale.set(1, 1, 0.95);
  canopy.castShadow = true;
  root.add(canopy);
  for (const z of [-4.5, -0.5, 3.5]) for (const x of [-1.6, 1.6]) mesh(cyl(0.05, 0.05, 1.0, 5), M(0x5a4634), root, x, 0.95, z);
  const pole = mesh(cyl(0.03, 0.03, 5, 5), M(0x8a7a50), root, 0.6, 1.8, 6.0); pole.rotation.x = 0.5;
  return root;
}

// The chundan vallam: a long racing snake-boat with a high, raked stern.
export function makeChundan(o = {}) {
  const root = new THREE.Group();
  const trim = o.trim ?? 0xb8402c;
  const hullM = new THREE.MeshStandardMaterial({ map: TEX.wood, color: 0x4a4038, roughness: 0.5, side: THREE.DoubleSide });
  const L = 15.5, B = 0.74, D = 0.52;
  const hull = new THREE.Mesh(hullGeo(L, B, D, 0.35), hullM);
  hull.castShadow = true; hull.position.y = -0.22;
  root.add(hull);
  const fl = mesh(box(B * 1.2, 0.03, L * 0.84), M(0x3a2c20, 0.9), root, 0, -0.08, 0); fl.castShadow = false;
  for (let i = 0; i < 9; i++) mesh(box(B * 1.7, 0.035, 0.18), M(0x6a5540, 0.8), root, 0, 0.2, -5.6 + i * 1.5);
  // the amaram: the stern sweeping up like a cobra's hood
  const g = new GB();
  g.tube((t) => [0, 0.2 + Math.pow(t, 1.7) * 3.3, -L / 2 + 0.9 - t * 2.3], (t) => 0.24 * (1 - t * 0.7), 8, 6, 2, [1, 1, 1], 1, true);
  const st = new THREE.Mesh(g.build(false), hullM); st.castShadow = true; root.add(st);
  const gold = new THREE.MeshStandardMaterial({ color: 0xd9a93a, roughness: 0.35, metalness: 0.5, emissive: 0x4a3008, emissiveIntensity: 0.5 });
  for (let i = 0; i < 4; i++) { const t = 0.3 + i * 0.2; mesh(sphere(0.07, 8, 6), gold, root, 0, 0.2 + Math.pow(t, 1.7) * 3.3 + 0.1, -L / 2 + 0.9 - t * 2.3 + 0.2); }
  // trim stripe & pennant in the village colours
  const tm = M(trim, 0.7);
  for (const sx of [-1, 1]) { const s = mesh(box(0.03, 0.09, L * 0.8), tm, root, sx * (B + 0.005), 0.3, 0); s.castShadow = false; }
  mesh(cyl(0.02, 0.02, 2.2, 5), M(0x8a7a50), root, 0, 4.4, -L / 2 - 1.3);
  const fg = mesh(box(0.02, 0.5, 0.9), new THREE.MeshStandardMaterial({ color: trim, roughness: 0.8, side: THREE.DoubleSide }), root, 0, 5.2, -L / 2 - 1.78);
  fg.userData.flag = true;
  return { root, cargo: new THREE.Group(), L, flag: fg };
}

export function makeBucket() {
  const g = new THREE.Group();
  const w = new THREE.MeshStandardMaterial({ map: TEX.plank, roughness: 0.8, side: THREE.DoubleSide });
  mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.26, 10, 1, true), w, g, 0, -0.3, 0);
  mesh(new THREE.CircleGeometry(0.13, 10), w, g, 0, -0.43, 0).rotation.x = -Math.PI / 2;
  const h = mesh(new THREE.TorusGeometry(0.16, 0.012, 4, 10, Math.PI), M(0x3a3a3a, 0.5), g, 0, -0.17, 0);
  const water = mesh(new THREE.CircleGeometry(0.155, 10), new THREE.MeshStandardMaterial({ color: 0x4a6a70, roughness: 0.15 }), g, 0, -0.2, 0);
  water.rotation.x = -Math.PI / 2; water.visible = false;
  g.userData.water = water;
  g.position.y = -0.06;
  return g;
}
export function makeRod() {
  const g = new THREE.Group();
  const r = mesh(cyl(0.008, 0.016, 2.6, 5), M(0x8a7a40, 0.7), g, 0, 0, 1.2);
  r.rotation.x = Math.PI / 2 - 0.5;
  g.position.y = -0.06;
  return g;
}
