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
function mesh(geo, mat, parent, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}
function group(parent, x = 0, y = 0, z = 0) {
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

// =========================================================== QUADRUPEDS
const QUAD = {
  horse: { bodyY: 1.2, neck: [0, 0, 0.72, 0.82], neckAt: [0.2, 0.6], headRot: 1.0, legU: 0.5, legL: 0.5, legR: 0.062, legX: 0.17, legZ: [0.44, -0.46], hipY: -0.2, tailAt: [0.17, -0.72], top: 0.33, col: 0x5a3320, dark: 0x1c120c },
  cow: { bodyY: 1.0, neck: [0, 0, 0.4, 1.2], neckAt: [0.12, 0.56], headRot: 0.6, legU: 0.36, legL: 0.36, legR: 0.07, legX: 0.2, legZ: [0.38, -0.42], hipY: -0.22, tailAt: [0.2, -0.64], top: 0.36, col: 0xd8d0c0, dark: 0x4a4038 },
};
const coatCache = new Map();
function coatMaterial(col, dark) {
  const k = col + '|' + dark;
  if (coatCache.has(k)) return coatCache.get(k);
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), hx = (v) => '#' + v.toString(16).padStart(6, '0');
  g.fillStyle = hx(col); g.fillRect(0, 0, 256, 256);
  // body: darker along the spine, paler under the belly, a soft dapple
  let grd = g.createLinearGradient(0, 0, 256, 0);
  grd.addColorStop(0, 'rgba(255,240,220,0.16)'); grd.addColorStop(0.3, 'rgba(0,0,0,0.05)'); grd.addColorStop(0.5, 'rgba(0,0,0,0.26)'); grd.addColorStop(0.7, 'rgba(0,0,0,0.05)'); grd.addColorStop(1, 'rgba(255,240,220,0.16)');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 160; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(255,235,210,0.05)' : 'rgba(0,0,0,0.06)'; g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 3 + Math.random() * 10, 0, 7); g.fill(); }
  // legs: shade toward the dark points
  grd = g.createLinearGradient(0, 128, 0, 256);
  grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, hx(dark));
  g.fillStyle = grd; g.fillRect(128, 128, 64, 128);
  g.fillStyle = hx(dark); g.fillRect(192, 128, 64, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.72 });
  coatCache.set(k, m);
  return m;
}
export class Quadruped {
  constructor(type = 'horse', o = {}) {
    const d = QUAD[type], horse = type === 'horse';
    const colHex = o.color ?? d.col, darkHex = o.dark ?? d.dark;
    const mat = coatMaterial(colHex, darkHex), dark = M(darkHex, 0.8);
    this.type = type;
    this.root = new THREE.Group();
    const body = this.body = group(this.root, 0, d.bodyY, 0);
    const add = (parent, sgb, m = mat) => { const ms = new THREE.Mesh(sgb.build(false), m); ms.castShadow = true; parent.add(ms); return ms; };
    const RB = [0, 0, 256, 128], RN = [0, 128, 128, 256], RL = [128, 128, 192, 256], RH = [192, 128, 256, 256];
    // ---- barrel: croup, flank, girth, chest
    const Bd = horse
      ? [[-0.74, 0.06, 0.13, 0.17], [-0.6, 0.06, 0.26, 0.29], [-0.3, 0.01, 0.3, 0.31], [0.08, -0.02, 0.31, 0.325], [0.4, 0.0, 0.29, 0.335], [0.62, 0.05, 0.22, 0.3], [0.76, 0.08, 0.12, 0.18]]
      : [[-0.66, 0.04, 0.14, 0.2], [-0.52, 0.04, 0.3, 0.32], [-0.2, -0.03, 0.36, 0.38], [0.12, -0.04, 0.36, 0.38], [0.4, 0.0, 0.31, 0.36], [0.56, 0.04, 0.22, 0.3], [0.66, 0.06, 0.12, 0.2]];
    let g = new SGB(256);
    g.loft(Bd.map(([z, cy, rx, ry], i) => ({ c: [0, cy, z], ax: [rx, 0, 0], az: [0, ry, 0], v: i / (Bd.length - 1) })), 14, RB, { capStart: 0.06, capEnd: 0.06 });
    if (!horse && o.hump) g.loft([[0.26, 0.17], [0.38, 0.15], [0.47, 0.07]].map(([y, r], i) => ({ c: [0, y, 0.3], ax: [r, 0, 0], az: [0, 0, r * 1.25], v: i / 2 })), 10, RB, { capEnd: 0.03 });
    if (!horse) g.loft([[-0.2, 0.05], [-0.36, 0.09], [-0.44, 0.03]].map(([y, r], i) => ({ c: [0, y, 0.5], ax: [r * 0.5, 0, 0], az: [0, 0, r * 1.6], v: i / 2 })), 8, RB, { capEnd: 0.02 });   // dewlap
    add(body, g);
    // ---- neck & head
    const neck = this.neck = group(body, 0, d.neckAt[0], d.neckAt[1]);
    neck.rotation.x = d.neck[3];
    const Nk = horse ? [[-0.14, 0.15, 0.22], [0.2, 0.115, 0.17], [0.5, 0.09, 0.125], [0.72, 0.08, 0.105]] : [[-0.12, 0.17, 0.23], [0.15, 0.14, 0.19], [0.4, 0.12, 0.15]];
    g = new SGB(256);
    g.loft(Nk.map(([y, rx, rz], i) => ({ c: [0, y, 0], ax: [rx, 0, 0], az: [0, 0, rz], v: i / (Nk.length - 1) * 0.5 })), 10, RN, {});
    add(neck, g);
    const head = this.head = group(neck, 0, d.neck[2] - 0.04, 0);
    head.rotation.x = d.headRot;
    const Hd = horse ? [[-0.07, 0.07, 0.085], [0.05, 0.097, 0.118], [0.2, 0.076, 0.096], [0.36, 0.058, 0.07], [0.45, 0.056, 0.062]] : [[-0.06, 0.09, 0.1], [0.06, 0.122, 0.132], [0.2, 0.1, 0.106], [0.31, 0.088, 0.086]];
    g = new SGB(256);
    g.loft(Hd.map(([y, rx, rz], i) => ({ c: [0, y, 0.01], ax: [rx, 0, 0], az: [0, 0, rz], v: 0.5 + i / (Hd.length - 1) * 0.5 })), 10, RN, { capStart: 0.03, capEnd: 0.025 });
    add(head, g);
    const hl = Hd[Hd.length - 1][0];
    mesh(sphere(0.012, 6, 4), M(0x0a0806, 0.2), head, -0.085, 0.07, -0.02); mesh(sphere(0.012, 6, 4), M(0x0a0806, 0.2), head, 0.085, 0.07, -0.02);
    mesh(sphere(0.012, 5, 4), M(0x0a0806, 0.4), head, -0.03, hl, 0.02); mesh(sphere(0.012, 5, 4), M(0x0a0806, 0.4), head, 0.03, hl, 0.02);
    for (const s of [-1, 1]) {
      const ear = mesh(new THREE.ConeGeometry(0.035, 0.13, 5), dark, head, s * 0.06, -0.02, -0.09);
      ear.rotation.x = -0.9; ear.rotation.z = s * -0.3;
      if (!horse) { const horn = mesh(new THREE.ConeGeometry(0.026, 0.24, 5), M(0x3a3028, 0.5), head, s * 0.1, -0.02, -0.1); horn.rotation.x = -1.3; horn.rotation.z = s * -0.7; }
    }
    if (horse) {
      // mane & forelock
      g = new SGB(256);
      g.loft(Nk.map(([y, rx, rz], i) => ({ c: [0, y + 0.03, -rz - 0.025], ax: [0.022, 0, 0], az: [0, 0, 0.075], v: i / 3 })), 6, RH, { capStart: 0.01, capEnd: 0.01 });
      add(neck, g);
      mesh(box(0.05, 0.13, 0.08), dark, head, 0, 0.0, -0.1);
    }
    // ---- tail
    const tail = this.tail = group(body, 0, d.tailAt[0], d.tailAt[1]);
    tail.rotation.x = 0.35;
    g = new SGB(256);
    const Tl = horse ? [[0, 0.04], [-0.2, 0.07], [-0.52, 0.078], [-0.8, 0.03]] : [[0, 0.026], [-0.45, 0.02], [-0.56, 0.05], [-0.68, 0.02]];
    g.loft(Tl.map(([y, r], i) => ({ c: [0, y, 0], ax: [r, 0, 0], az: [0, 0, r], v: i / 3 })), 6, RH, { capStart: 0.01, capEnd: 0.03 });
    add(tail, g);
    // ---- legs
    this.legs = [];
    for (const z of d.legZ) for (const s of [-1, 1]) {
      const hind = z < 0, r = d.legR;
      const hp = group(body, s * d.legX, d.hipY, z);
      g = new SGB(256);
      g.loft([[0.1, 1.5, hind ? 2.3 : 1.8], [-d.legU * 0.45, 1.25, hind ? 1.7 : 1.4], [-d.legU, 0.82, 0.9]].map(([y, a, b], i) => ({ c: [0, y, 0], ax: [r * a, 0, 0], az: [0, 0, r * b], v: i / 2 * 0.5 })), 8, RL, { capStart: 0.02 });
      add(hp, g);
      const kn = group(hp, 0, -d.legU, 0);
      g = new SGB(256);
      g.loft([[0.03, 0.86], [-d.legL * 0.45, 0.6], [-d.legL * 0.84, 0.6], [-d.legL * 0.95, 0.8]].map(([y, a], i) => ({ c: [0, y, 0], ax: [r * a, 0, 0], az: [0, 0, r * a * 1.1], v: 0.5 + i / 3 * 0.5 })), 8, RL, {});
      add(kn, g);
      mesh(cyl(r * 0.95, r * 1.12, 0.09, 8), M(0x15100c, 0.5), kn, 0, -d.legL - 0.015, 0.005);
      this.legs.push({ hp, kn, front: z > 0, side: s });
    }
    if (o.saddle) {
      const top = d.top;
      mesh(box(0.66, 0.035, 0.84), M(0x7a1f1c, 0.95), body, 0, top - 0.035, -0.02);
      const sd = mesh(sphere(0.2, 10, 6), M(0x4a2a16, 0.6), body, 0, top + 0.005, -0.02); sd.scale.set(1.15, 0.38, 1.5);
      mesh(sphere(0.07, 8, 6), M(0x4a2a16, 0.6), body, 0, top + 0.06, 0.26);
      for (const sx of [-1, 1]) { mesh(box(0.02, 0.44, 0.03), M(0x2a1a10, 0.6), body, sx * 0.3, top - 0.28, 0.02); mesh(box(0.03, 0.04, 0.12), M(0x8a8a8a, 0.4), body, sx * 0.31, top - 0.5, 0.04); }
      // bridle
      mesh(box(0.2, 0.02, 0.24), M(0x2a1a10, 0.6), head, 0, 0.08, 0.01); mesh(box(0.17, 0.02, 0.19), M(0x2a1a10, 0.6), head, 0, 0.3, 0.01);
    }
    mergeStatic(this.root);
    this.seatY = d.bodyY + d.top - 0.8;
    this.baseY = d.bodyY;
    this.phase = Math.random() * 6; this.t = Math.random() * 10; this.speed = 0;
    this.graze = !!o.graze;
  }
  update(dt) {
    this.t += dt;
    const sp = this.speed, t = this.t;
    this.phase += dt * (2.2 + sp * 0.95) * (sp > 0.05 ? 1 : 0);
    const p = this.phase;
    const gallop = clamp((sp - 6) / 4, 0, 1);
    const amp = sp > 0.05 ? clamp(0.28 + sp * 0.06, 0, 0.95) : 0;
    for (const l of this.legs) {
      // trot: diagonal pairs; gallop: fronts then hinds
      const trotPh = (l.front ? 0 : Math.PI) + (l.side > 0 ? 0 : Math.PI);
      const galPh = (l.front ? 0 : 2.4) + (l.side > 0 ? 0 : 0.5);
      const ph = p + lerp(trotPh, galPh, gallop);
      const tx = -Math.sin(ph) * amp, kx = Math.max(0, Math.cos(ph)) * amp * (l.front ? 1.5 : 1.0);
      l.hp.rotation.x = damp(l.hp.rotation.x, tx, 18, dt);
      l.kn.rotation.x = damp(l.kn.rotation.x, l.front ? kx : -kx * 0.2 + Math.max(0, Math.cos(ph)) * amp * 0.9, 18, dt);
    }
    this.body.position.y = this.baseY + Math.sin(p * 2) * 0.035 * amp + Math.sin(p) * 0.06 * gallop * amp;
    this.body.rotation.x = Math.sin(p + 0.6) * 0.05 * gallop * amp;
    this.tail.rotation.z = Math.sin(t * 1.3) * 0.25;
    this.tail.rotation.x = 0.35 + gallop * 0.9;
    const d = QUAD[this.type];
    let neckT = d.neck[3] + Math.sin(p) * 0.06 * amp + gallop * 0.2;
    if (this.graze && sp < 0.05) neckT = d.neck[3] + 1.25 + Math.sin(t * 0.7) * 0.12;
    this.neck.rotation.x = damp(this.neck.rotation.x, neckT, 3, dt);
  }
}

// =========================================================== ELEPHANT
export class Elephant {
  constructor(o = {}) {
    const col = M(0x6b6661, 0.95), dark = M(0x57524e, 0.95);
    this.root = new THREE.Group();
    const s = o.scale ?? 1;
    this.root.scale.setScalar(s);
    const body = this.body = group(this.root, 0, 1.95, 0);
    mesh(sphere(1, 14, 12), col, body).scale.set(0.86, 0.95, 1.4);
    const head = this.head = group(body, 0, 0.35, 1.3);
    mesh(sphere(0.56, 12, 10), col, head).scale.set(0.95, 1.1, 0.95);
    mesh(sphere(0.3, 8, 6), col, head, -0.2, 0.42, -0.05); mesh(sphere(0.3, 8, 6), col, head, 0.2, 0.42, -0.05);
    this.ears = [];
    for (const sd of [-1, 1]) {
      const eg = group(head, sd * 0.48, 0.12, -0.12);
      const e = mesh(sphere(0.48, 10, 8), dark, eg, sd * 0.25, -0.05, -0.05); e.scale.set(0.9, 1.05, 0.12);
      this.ears.push({ g: eg, s: sd });
      const tusk = mesh(new THREE.ConeGeometry(0.06, 0.75, 6), M(0xe9e2cf, 0.4), head, sd * 0.22, -0.52, 0.42);
      tusk.rotation.x = 2.2;
    }
    this.trunk = [];
    let parent = group(head, 0, -0.25, 0.42);
    parent.rotation.x = 0.25;
    for (let i = 0; i < 7; i++) {
      const r = 0.2 - i * 0.02;
      mesh(cyl(r - 0.02, r, 0.3, 8), col, parent, 0, -0.15, 0);
      this.trunk.push(parent);
      parent = group(parent, 0, -0.28, 0);
    }
    this.legs = [];
    for (const z of [0.82, -0.85]) for (const sd of [-1, 1]) {
      const hp = group(body, sd * 0.48, -0.45, z);
      mesh(cyl(0.25, 0.23, 1.5, 10), col, hp, 0, -0.75, 0);
      mesh(cyl(0.25, 0.27, 0.1, 10), dark, hp, 0, -1.47, 0);
      this.legs.push({ hp, front: z > 0, side: sd });
    }
    const tail = group(body, 0, 0.3, -1.38); tail.rotation.x = 0.2;
    mesh(cyl(0.04, 0.02, 1.0, 5), dark, tail, 0, -0.5, 0);
    if (o.caparison) {
      const gold = new THREE.MeshStandardMaterial({ color: 0xd9a93a, roughness: 0.35, metalness: 0.5, emissive: 0x4a3008, emissiveIntensity: 0.6 });
      const np = mesh(box(0.5, 0.9, 0.05), gold, head, 0, 0.1, 0.53); np.rotation.x = -0.28;
      mesh(box(1.5, 0.05, 1.6), M(0x8a1f1c, 0.95), body, 0, 0.93, 0);
    }
    mergeStatic(this.root);
    this.t = Math.random() * 10; this.phase = 0; this.speed = 0;
  }
  update(dt) {
    this.t += dt; const t = this.t;
    this.phase += dt * 1.6 * (this.speed > 0.05 ? 1 : 0);
    const amp = this.speed > 0.05 ? 0.28 : 0;
    for (const l of this.legs) {
      const ph = this.phase + (l.front ? 0 : Math.PI) + (l.side > 0 ? 0 : Math.PI);
      l.hp.rotation.x = damp(l.hp.rotation.x, -Math.sin(ph) * amp, 8, dt);
    }
    this.trunk.forEach((g, i) => { g.rotation.x = (i === 0 ? 0.25 : 0.06) + Math.sin(t * 0.8 - i * 0.5) * 0.09 + (i > 3 ? 0.18 : 0); g.rotation.z = Math.sin(t * 0.55 - i * 0.4) * 0.08; });
    for (const e of this.ears) e.g.rotation.y = e.s * (0.25 + Math.max(0, Math.sin(t * 1.9)) * 0.5);
    this.body.rotation.z = Math.sin(t * 0.6) * 0.012;
    this.head.rotation.y = Math.sin(t * 0.33) * 0.12;
  }
}

// =========================================================== BIRD (egret)
export class Bird {
  constructor() {
    const w = M(0xf4f2ea, 0.8, { side: THREE.DoubleSide });
    this.root = new THREE.Group();
    const b = mesh(sphere(0.12, 6, 5), w, this.root); b.scale.set(0.7, 0.7, 2.2);
    mesh(new THREE.ConeGeometry(0.02, 0.2, 4), M(0xd9a23a, 0.6), this.root, 0, 0, 0.36).rotation.x = Math.PI / 2;
    this.wings = [];
    for (const s of [-1, 1]) {
      const g = group(this.root, s * 0.05, 0.03, 0.02);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.16, s * 0.75, 0, 0.02, 0, 0, -0.14, s * 0.75, 0, 0.02, s * 0.6, 0, -0.18, 0, 0, -0.14], 3));
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, w); g.add(m);
      this.wings.push({ g, s });
    }
    this.t = Math.random() * 10;
  }
  update(dt) {
    this.t += dt;
    const a = Math.sin(this.t * 7.5) * 0.7;
    for (const w of this.wings) w.g.rotation.z = w.s * a;
  }
}

// =========================================================== BOATS
export function hullGeo(L, B, D, sheer = 0.5) {
  const g = new GB(), st = 12;
  const rows = [];
  for (let i = 0; i <= st; i++) {
    const s = i / st, z = (s - 0.5) * L;
    const beam = B * Math.pow(Math.sin(Math.PI * clamp(s * 0.94 + 0.03, 0, 1)), 0.75);
    const up = sheer * Math.pow(Math.abs(s * 2 - 1), 2.4);
    const pts = [[-beam, D + up], [-beam * 0.72, D * 0.3 + up * 0.8], [0, up * 0.75], [beam * 0.72, D * 0.3 + up * 0.8], [beam, D + up]];
    rows.push(pts.map(([x, y], k) => g.vert(x, y, z, x === 0 ? 0 : Math.sign(x) * 0.8, -0.6, 0, s * 3, k / 4 * 1.2)));
  }
  for (let i = 0; i < st; i++) for (let k = 0; k < 4; k++) g.quad(rows[i][k], rows[i][k + 1], rows[i + 1][k + 1], rows[i + 1][k]);
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
