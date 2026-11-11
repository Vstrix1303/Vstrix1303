// Procedural people, horses, cattle, elephants, birds and boats — built
// from primitives and animated with hand-written joint curves.
import * as THREE from 'three';
import { GB } from './geo.js';
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

export const SKIN = [0x8d5b3c, 0x7a4b30, 0x9b6a48, 0x6e432b, 0x84553a];

// =========================================================== HUMAN
export class Human {
  constructor(o = {}) {
    const skin = M(o.skin ?? SKIN[0], 0.7);
    const cloth = M(o.mundu ?? 0xe9e2cf, 0.95);
    const shirtM = o.shirt != null ? M(o.shirt, 0.9) : skin;
    const hairM = M(o.hair ?? 0x14100d, 0.6);
    const sc = o.scale ?? 1;
    this.root = new THREE.Group();
    this.root.scale.setScalar(sc);
    this.body = group(this.root);
    const hips = this.hips = group(this.body, 0, 0.93, 0);
    const spine = this.spine = group(hips);
    // torso
    const torso = mesh(capsule(0.15, 0.3, 10), shirtM, spine, 0, 0.3, 0);
    torso.scale.set(1.18, 1, 0.74);
    const shd = mesh(capsule(0.052, 0.3, 8), shirtM, spine, 0, 0.5, 0); shd.rotation.z = Math.PI / 2;
    if (o.belly) { const b = mesh(sphere(0.15), shirtM, spine, 0, 0.2, 0.035); b.scale.set(1.18, 1.05, 0.95); }
    mesh(cyl(0.05, 0.06, 0.1, 8), skin, spine, 0, 0.6, 0);
    // head
    const head = this.head = group(spine, 0, 0.73, 0);
    const skull = mesh(sphere(0.105, 12, 10), skin, head);
    skull.scale.set(0.94, 1.1, 1);
    const hair = mesh(new THREE.SphereGeometry(0.113, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.56), hairM, head, 0, 0.012, -0.012);
    hair.rotation.x = -0.32;
    mesh(box(0.028, 0.04, 0.03), skin, head, 0, -0.012, 0.1);
    const eyeM = M(0x120c08, 0.3);
    mesh(sphere(0.012, 6, 4), eyeM, head, -0.036, 0.018, 0.094);
    mesh(sphere(0.012, 6, 4), eyeM, head, 0.036, 0.018, 0.094);
    if (o.moustache) mesh(box(0.075, 0.016, 0.02), M(o.grey ? 0xb9b4a8 : 0x14100d, 0.6), head, 0, -0.04, 0.098);
    if (o.beard) { const bd = mesh(sphere(0.07, 8, 6), M(o.grey ? 0xc9c4b8 : 0x14100d, 0.7), head, 0, -0.085, 0.055); bd.scale.set(1.1, 0.9, 0.7); }
    if (o.grey) hair.material = M(0xb9b4a8, 0.7);
    if (o.headgear === 'turban') { const t = mesh(sphere(0.12, 10, 6), M(o.gearColor ?? 0xb02a22, 0.95), head, 0, 0.07, -0.005); t.scale.set(1.12, 0.62, 1.12); }
    if (o.headgear === 'thorthu') { const t = mesh(sphere(0.115, 10, 6), M(o.gearColor ?? 0xe7dfc8, 0.95), head, 0, 0.065, -0.01); t.scale.set(1.08, 0.5, 1.1); }
    if (o.headgear === 'cap') mesh(cyl(0.098, 0.103, 0.075, 12), M(o.gearColor ?? 0xf0ece0, 0.9), head, 0, 0.1, -0.005);
    if (o.headgear === 'topi') {
      mesh(new THREE.SphereGeometry(0.128, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), M(0xd8cfb4, 0.9), head, 0, 0.045, 0);
      const brim = mesh(cyl(0.185, 0.19, 0.014, 14), M(0xd8cfb4, 0.9), head, 0, 0.05, 0.01); brim.rotation.x = 0.08;
    }
    if (o.bun) { mesh(sphere(0.06, 8, 6), hairM, head, 0, -0.01, -0.115); const hb = mesh(sphere(0.113, 10, 8), hairM, head, 0, 0.005, -0.02); hb.scale.set(1, 1.02, 0.95); }
    // arms
    const sleeve = o.sleeves ? shirtM : skin;
    const mkArm = (s) => {
      const sh = group(spine, s * 0.215, 0.5, 0);
      mesh(capsule(0.044, 0.22), sleeve, sh, 0, -0.14, 0);
      const el = group(sh, 0, -0.29, 0);
      mesh(capsule(0.037, 0.2), o.longSleeves ? shirtM : skin, el, 0, -0.125, 0);
      const hand = group(el, 0, -0.27, 0);
      mesh(sphere(0.043, 8, 6), skin, hand);
      return { sh, el, hand };
    };
    this.armL = mkArm(-1); this.armR = mkArm(1);
    // legs
    const legM = o.trousers != null ? M(o.trousers, 0.9) : skin;
    const mkLeg = (s) => {
      const hp = group(hips, s * 0.088, 0, 0);
      mesh(capsule(0.072, 0.3), legM, hp, 0, -0.21, 0);
      const kn = group(hp, 0, -0.44, 0);
      mesh(capsule(0.056, 0.3), legM, kn, 0, -0.2, 0);
      const ft = mesh(box(0.085, 0.055, 0.21), o.boots != null ? M(o.boots, 0.6) : skin, kn, 0, -0.455, 0.05);
      return { hp, kn, ft };
    };
    this.legL = mkLeg(-1); this.legR = mkLeg(1);
    // lower garment
    if (o.trousers == null) {
      const len = o.munduLong ? 0.78 : 0.5;
      const sk = this.skirt = mesh(new THREE.CylinderGeometry(0.175, o.munduLong ? 0.25 : 0.225, len, 14, 1, true), cloth, hips, 0, 0.09 - len / 2, 0);
      sk.material = M(o.mundu ?? 0xe9e2cf, 0.95, { side: THREE.DoubleSide });
      if (o.kasavu) mesh(new THREE.CylinderGeometry(0.251, 0.253, 0.035, 14, 1, true), M(0xc9a13a, 0.5, { side: THREE.DoubleSide }), hips, 0, 0.09 - len + 0.02, 0);
      mesh(cyl(0.18, 0.18, 0.06, 14), cloth, hips, 0, 0.08, 0);
    } else {
      const p = mesh(capsule(0.15, 0.06, 10), legM, hips, 0, 0.0, 0); p.scale.set(1.1, 1, 0.75);
    }
    if (o.sash != null) {
      const s = mesh(box(0.09, 0.5, 0.2), M(o.sash, 0.95), spine, -0.13, 0.36, 0.0);
      s.rotation.z = -0.12;
    }
    if (o.shoulderCloth != null) { const s = mesh(box(0.1, 0.028, 0.3), M(o.shoulderCloth, 0.95), spine, 0.15, 0.575, 0.0); s.rotation.z = -0.22; }
    mergeStatic(this.root);
    this.state = 'idle';
    this.phase = Math.random() * 6;
    this.t = Math.random() * 10;
    this.speed = 0;
    this.strikeT = -1;
    this.j = { legL: 0, legR: 0, kneeL: 0, kneeR: 0, armL: 0, armR: 0, elL: 0, elR: 0, spine: 0, hipY: 0.93, armLz: 0, armRz: 0, legLz: 0, legRz: 0, bodyX: 0, bodyY: 0, twist: 0, head: 0 };
  }

  hold(obj, right = true) { (right ? this.armR : this.armL).hand.add(obj); return obj; }

  update(dt) {
    this.t += dt;
    const s = this.state, t = this.t, sp = this.speed;
    const g = { legL: 0, legR: 0, kneeL: 0.03, kneeR: 0.03, armL: 0, armR: 0, elL: -0.12, elR: -0.12, spine: 0, hipY: 0.93, armLz: -0.07, armRz: 0.07, legLz: 0, legRz: 0, bodyX: 0, bodyY: 0, twist: 0, head: 0 };
    let k = 12;
    if (s === 'idle' || s === 'talk') {
      g.spine = Math.sin(t * 1.3) * 0.015;
      g.armL = Math.sin(t * 0.9) * 0.03; g.armR = -g.armL;
      if (s === 'talk') { g.armR = -0.55 + Math.sin(t * 3.1) * 0.22; g.elR = -1.0 + Math.sin(t * 2.3) * 0.25; g.head = Math.sin(t * 1.7) * 0.06; }
    } else if (s === 'move' || s === 'crouch') {
      const crouch = s === 'crouch';
      this.phase += dt * (4.0 + sp * 0.86);
      const p = this.phase, amp = clamp(0.3 + sp * 0.115, 0, 1.08) * (sp > 0.05 ? 1 : 0);
      g.legL = -Math.sin(p) * amp; g.legR = Math.sin(p) * amp;
      g.kneeL = Math.max(0, Math.cos(p)) * amp * 1.35 + 0.05; g.kneeR = Math.max(0, -Math.cos(p)) * amp * 1.35 + 0.05;
      g.armL = Math.sin(p) * amp * 0.8; g.armR = -Math.sin(p) * amp * 0.8;
      g.elL = g.elR = -(0.2 + amp * 0.75);
      g.spine = 0.03 + sp * 0.028;
      g.hipY = 0.93 - amp * 0.03 + Math.abs(Math.sin(p)) * 0.035 * amp;
      g.twist = Math.sin(p) * 0.1 * amp;
      if (crouch) {
        g.hipY -= 0.26; g.spine += 0.5; g.legL -= 0.75; g.legR -= 0.75; g.kneeL += 1.25; g.kneeR += 1.25;
        g.elL = g.elR = -0.9; g.head = -0.4;
      }
      k = 16;
    } else if (s === 'sit' || s === 'ride') {
      g.legL = g.legR = -1.25; g.kneeL = g.kneeR = 1.25; g.legLz = -0.42; g.legRz = 0.42;
      g.armL = g.armR = -0.75; g.elL = g.elR = -0.55; g.armLz = -0.12; g.armRz = 0.12;
      g.spine = 0.08 + sp * 0.014 + Math.sin(this.phase * 2) * 0.03 * Math.min(1, sp * 0.2);
      g.hipY = 0.93;
      this.phase += dt * (3 + sp * 0.9);
    } else if (s === 'paddle' || s === 'boat') {
      g.legL = g.legR = -1.45; g.kneeL = g.kneeR = 1.5; g.hipY = 0.5;
      const pd = s === 'paddle' ? 1 : 0;
      this.phase += dt * 4.2 * pd;
      const p = this.phase;
      g.spine = 0.18 + Math.sin(p) * 0.16 * pd;
      g.armR = -0.95 + Math.sin(p) * 0.55 * pd; g.armL = -1.25 + Math.sin(p) * 0.4 * pd;
      g.elR = -0.5 - Math.cos(p) * 0.3 * pd; g.elL = -0.7; g.armLz = 0.35; g.armRz = 0.1;
      g.twist = Math.sin(p) * 0.2 * pd;
    } else if (s === 'swim') {
      this.phase += dt * 5;
      const p = this.phase;
      g.bodyX = 1.1; g.bodyY = -0.3;
      g.armL = -2.4 + Math.sin(p) * 1.2; g.armR = -2.4 - Math.sin(p) * 1.2;
      g.legL = Math.sin(p * 1.5) * 0.35; g.legR = -Math.sin(p * 1.5) * 0.35; g.head = -0.7;
    } else if (s === 'ko') {
      g.bodyX = -1.5; g.bodyY = 0.16; g.armLz = -1.1; g.armRz = 1.2; g.legLz = -0.2; g.legRz = 0.25; g.hipY = 0.93;
      k = 7;
    } else if (s === 'work') {
      // stooping, hands busy (harvesting / planting)
      g.spine = 0.85 + Math.sin(t * 2.2) * 0.08; g.armL = -0.9 + Math.sin(t * 4.4) * 0.3; g.armR = -0.9 - Math.sin(t * 4.4) * 0.3;
      g.elL = g.elR = -0.4; g.kneeL = g.kneeR = 0.25; g.legL = g.legR = -0.12; g.head = -0.3;
    }
    if (this.strikeT >= 0) {
      this.strikeT += dt;
      const u = this.strikeT / 0.42;
      if (u >= 1) this.strikeT = -1;
      else {
        const sw = u < 0.35 ? lerp(-0.6, -2.9, u / 0.35) : lerp(-2.9, -0.2, (u - 0.35) / 0.65);
        g.armR = sw; g.elR = -0.35; g.armRz = 0.25;
        g.spine += u < 0.35 ? -0.1 : 0.28; g.twist = u < 0.35 ? -0.35 : 0.4;
        k = 30;
      }
    }
    const j = this.j;
    for (const key in g) j[key] = damp(j[key], g[key], k, dt);
    this.legL.hp.rotation.set(j.legL, 0, j.legLz); this.legR.hp.rotation.set(j.legR, 0, j.legRz);
    this.legL.kn.rotation.x = j.kneeL; this.legR.kn.rotation.x = j.kneeR;
    this.armL.sh.rotation.set(j.armL, 0, j.armLz); this.armR.sh.rotation.set(j.armR, 0, j.armRz);
    this.armL.el.rotation.x = j.elL; this.armR.el.rotation.x = j.elR;
    this.spine.rotation.set(j.spine, j.twist, 0);
    this.hips.position.y = j.hipY;
    this.hips.rotation.y = -j.twist * 0.5;
    this.head.rotation.x = j.head;
    this.body.rotation.x = j.bodyX; this.body.position.y = j.bodyY + (j.bodyX < -0.5 ? 0 : 0);
    if (this.skirt) this.skirt.rotation.x = clamp((j.legL + j.legR) * 0.42, -0.3, 0.3);
  }
}

// Cast presets
export const CAST = {
  madhavan: { skin: SKIN[0], mundu: 0xe4dcc6, shirt: null, moustache: true, headgear: 'thorthu', gearColor: 0xb8402c },
  ammavan: { skin: SKIN[1], mundu: 0xefe9d8, munduLong: true, kasavu: true, grey: true, moustache: true, belly: true, shoulderCloth: 0xefe9d8, scale: 0.98 },
  devaki: { skin: SKIN[2], mundu: 0xf0ead8, munduLong: true, kasavu: true, shirt: 0x8a2f3a, sleeves: true, bun: true, sash: 0xf0ead8, scale: 0.93 },
  ouseph: { skin: SKIN[3], mundu: 0x4a6a8a, shirt: null, beard: true, grey: true, headgear: 'thorthu', gearColor: 0xd8d0b8 },
  moideen: { skin: SKIN[4], mundu: 0xe8e2d2, munduLong: true, shirt: 0xeae6da, sleeves: true, longSleeves: true, beard: true, headgear: 'cap', belly: true },
  finch: { skin: 0xd9a98c, trousers: 0xcbbf9f, shirt: 0xd5cab0, sleeves: true, longSleeves: true, moustache: true, hair: 0x8a6a3a, headgear: 'topi', boots: 0x3a2416, scale: 1.04 },
  peishkar: { skin: SKIN[2], trousers: 0xe8e4d8, shirt: 0x24303e, sleeves: true, longSleeves: true, moustache: true, headgear: 'turban', gearColor: 0xe9d9a8, boots: 0x20140c },
  guard: { skin: SKIN[1], mundu: 0x8a7d5a, shirt: 0x8a7d5a, sleeves: true, moustache: true, headgear: 'turban', gearColor: 0x9c2a20 },
  villagerM: [
    { skin: SKIN[0], mundu: 0xe6dfcb, moustache: true }, { skin: SKIN[3], mundu: 0xd9d2bd, headgear: 'thorthu' },
    { skin: SKIN[1], mundu: 0x6a4a3a, moustache: true, shoulderCloth: 0xe6dfcb }, { skin: SKIN[4], mundu: 0xe8e2d2, shirt: 0xe6e0d0, sleeves: true, headgear: 'cap' },
    { skin: SKIN[2], mundu: 0x35506a, grey: true, beard: true },
  ],
  villagerF: [
    { skin: SKIN[2], mundu: 0xefe9d8, munduLong: true, kasavu: true, shirt: 0x2f5a4a, sleeves: true, bun: true, sash: 0xefe9d8, scale: 0.92 },
    { skin: SKIN[0], mundu: 0xe9e1cc, munduLong: true, shirt: 0x7a3a5a, sleeves: true, bun: true, sash: 0xe9e1cc, scale: 0.9 },
    { skin: SKIN[4], mundu: 0xe5ddc8, munduLong: true, shirt: 0xb0862a, sleeves: true, bun: true, scale: 0.92 },
  ],
};

export function makeStick(len = 1.5, color = 0x6a4a2a) {
  const m = new THREE.Mesh(cyl(0.018, 0.022, len, 6), M(color, 0.7));
  m.rotation.x = Math.PI / 2;
  m.position.set(0, -0.02, len * 0.32);
  m.castShadow = true;
  return m;
}
export function makeLantern() {
  const g = new THREE.Group();
  mesh(cyl(0.05, 0.06, 0.13, 6), new THREE.MeshStandardMaterial({ color: 0xffc070, emissive: 0xffa040, emissiveIntensity: 3, roughness: 0.4 }), g, 0, -0.14, 0);
  mesh(cyl(0.005, 0.005, 0.1, 4), M(0x222222), g, 0, -0.04, 0);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: new THREE.Color(2.2, 1.4, 0.5), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  sp.scale.setScalar(1.3); sp.position.y = -0.14;
  g.add(sp);
  return g;
}

// =========================================================== QUADRUPEDS
const QUAD = {
  horse: { body: [0.3, 0.95], bodyY: 1.2, bodySX: 0.88, legU: 0.5, legL: 0.5, legR: 0.062, legX: 0.16, legZ: [0.43, -0.45], neck: [0.14, 0.21, 0.74, 0.82], head: [0.105, 0.34], col: 0x5a3320, dark: 0x1c120c },
  cow: { body: [0.36, 0.8], bodyY: 1.0, bodySX: 0.95, legU: 0.36, legL: 0.36, legR: 0.07, legX: 0.19, legZ: [0.36, -0.4], neck: [0.16, 0.22, 0.42, 1.2], head: [0.12, 0.28], col: 0xd8d0c0, dark: 0x4a4038 },
};
export class Quadruped {
  constructor(type = 'horse', o = {}) {
    const d = QUAD[type];
    const col = M(o.color ?? d.col, 0.8), dark = M(o.dark ?? d.dark, 0.8);
    this.type = type;
    this.root = new THREE.Group();
    const body = this.body = group(this.root, 0, d.bodyY, 0);
    const barrel = mesh(capsule(d.body[0], d.body[1], 12), col, body);
    barrel.rotation.x = Math.PI / 2; barrel.scale.set(d.bodySX, 1, 1);
    mesh(sphere(d.body[0] * 1.02, 10, 8), col, body, 0, 0.03, d.body[1] * 0.42).scale.set(d.bodySX, 1.05, 0.9);
    mesh(sphere(d.body[0] * 1.05, 10, 8), col, body, 0, 0.04, -d.body[1] * 0.45).scale.set(d.bodySX * 1.02, 1.05, 0.95);
    if (type === 'cow' && o.hump) mesh(sphere(0.17, 8, 6), col, body, 0, 0.36, 0.3);
    // neck & head
    const neck = this.neck = group(body, 0, d.body[0] * 0.55, d.body[1] * 0.5 + 0.06);
    neck.rotation.x = d.neck[3];
    mesh(cyl(d.neck[0], d.neck[1], d.neck[2], 10), col, neck, 0, d.neck[2] / 2 - 0.05, 0).scale.set(0.8, 1, 1.15);
    const head = this.head = group(neck, 0, d.neck[2] - 0.06, 0);
    head.rotation.x = type === 'horse' ? 1.0 : 0.6;
    const hm = mesh(capsule(d.head[0], d.head[1], 8), col, head, 0, d.head[1] * 0.55, 0.01);
    hm.scale.set(0.82, 1, 1);
    mesh(sphere(d.head[0] * 0.78, 8, 6), type === 'horse' ? dark : col, head, 0, d.head[1] + d.head[0] * 0.75, 0.01);
    for (const s of [-1, 1]) {
      const ear = mesh(new THREE.ConeGeometry(0.035, 0.12, 5), col, head, s * 0.06, 0.02, -0.07);
      ear.rotation.x = -0.9; ear.rotation.z = s * -0.3;
      if (type === 'cow') { const horn = mesh(new THREE.ConeGeometry(0.025, 0.22, 5), M(0x3a3028, 0.5), head, s * 0.09, 0.0, -0.1); horn.rotation.x = -1.3; horn.rotation.z = s * -0.7; }
    }
    if (type === 'horse') {
      mesh(box(0.045, d.neck[2] + 0.1, 0.1), dark, neck, 0, d.neck[2] / 2, -0.17);
      mesh(box(0.05, 0.12, 0.1), dark, head, 0, 0.02, -0.08);
    }
    // tail
    const tail = this.tail = group(body, 0, d.body[0] * 0.55, -d.body[1] * 0.5 - d.body[0] * 0.75);
    tail.rotation.x = 0.35;
    mesh(cyl(0.05, 0.02, type === 'horse' ? 0.8 : 0.7, 6), dark, tail, 0, -0.38, 0);
    // legs
    this.legs = [];
    for (const z of d.legZ) for (const s of [-1, 1]) {
      const hp = group(body, s * d.legX, -d.body[0] * 0.55, z);
      mesh(capsule(d.legR * 1.25, d.legU - 0.1, 8), col, hp, 0, -d.legU / 2, 0);
      const kn = group(hp, 0, -d.legU, 0);
      mesh(capsule(d.legR * 0.78, d.legL - 0.1, 6), type === 'horse' ? dark : col, kn, 0, -d.legL / 2, 0);
      mesh(cyl(d.legR, d.legR * 1.1, 0.08, 8), M(0x15100c, 0.5), kn, 0, -d.legL - 0.02, 0);
      this.legs.push({ hp, kn, front: z > 0, side: s });
    }
    if (o.saddle) {
      mesh(box(0.62, 0.035, 0.8), M(0x7a1f1c, 0.95), body, 0, d.body[0] + 0.0, -0.02).scale.set(d.bodySX, 1, 1);
      const sd = mesh(sphere(0.2, 10, 6), M(0x4a2a16, 0.6), body, 0, d.body[0] + 0.03, -0.02); sd.scale.set(1.15, 0.38, 1.5);
      mesh(box(0.02, 0.4, 0.03), M(0x2a1a10, 0.6), body, -0.28, d.body[0] - 0.25, 0.02);
      mesh(box(0.02, 0.4, 0.03), M(0x2a1a10, 0.6), body, 0.28, d.body[0] - 0.25, 0.02);
    }
    mergeStatic(this.root);
    this.seatY = d.bodyY + d.body[0] - 0.8;   // rider root offset (hips sit at 0.93)
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
