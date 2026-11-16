// Animals, modelled rather than assembled: every body is a smooth surface
// lofted through anatomical cross-sections — barrel, withers and croup,
// shoulder and haunch, a neck with crest and throat, a head with jaw, muzzle
// and nostrils, legs with knee, hock, fetlock and hoof.
import * as THREE from 'three';
import { SGB, GB } from './geo.js';
import { M, mergeStatic, group, mesh } from './characters.js';
import { damp, clamp, lerp } from './util.js';
import { normalFromCanvas } from './texmaps.js';

const sphere = (r, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg);
const RB = [0, 0, 256, 128], RN = [0, 128, 128, 256], RL = [128, 128, 192, 256], RH = [192, 128, 256, 256];

// a limb or neck lofted along its own Y axis: rows of [y, half-width, depth in +Z, depth in -Z, x offset, z offset]
function limb(g, rows, seg, region, v0 = 0, v1 = 1, o = {}) {
  g.loft(rows.map(([y, rx, zf, zb = zf, cx = 0, cz = 0], i) => ({ c: [cx, y, cz], ax: [rx, 0, 0], az: [0, 0, zf], azB: [0, 0, zb], v: lerp(v0, v1, i / (rows.length - 1)) })), seg, region, o);
}
// a rounded muscle mass
function blob(g, x, y, z, rx, ry, rz, region, v = 0.4, tilt = 0) {
  const rows = [];
  for (let i = 0; i <= 6; i++) { const a = -1.4 + i * (2.8 / 6), c = Math.cos(a); rows.push({ c: [x, y + ry * Math.sin(a), z + tilt * ry * Math.sin(a)], ax: [rx * c, 0, 0], az: [0, 0, rz * c], v }); }
  g.loft(rows, 12, region, { capStart: ry * 0.03, capEnd: ry * 0.03 });
}

const QUAD = {
  horse: {
    bodyY: 1.2, neck: [0, 0, 0.72, 0.82], neckAt: [0.2, 0.6], headRot: 1.0, legU: 0.5, legC: 0.3, legX: 0.17, legZ: [0.46, -0.42], hipY: -0.2, tailAt: [0.2, -0.78], top: 0.33, col: 0x5a3320, dark: 0x1c120c, hindRest: 0.26,
    // z, centre y, half-width, height above centre, depth below
    barrel: [[-0.82, 0.1, 0.09, 0.11, 0.15], [-0.74, 0.08, 0.2, 0.2, 0.26], [-0.6, 0.05, 0.28, 0.27, 0.32], [-0.42, 0.03, 0.295, 0.275, 0.33], [-0.22, 0.01, 0.285, 0.25, 0.32], [0, 0, 0.3, 0.25, 0.35], [0.22, 0, 0.295, 0.26, 0.37], [0.42, 0.02, 0.275, 0.3, 0.36], [0.58, 0.04, 0.235, 0.27, 0.33], [0.72, 0.06, 0.17, 0.2, 0.26], [0.8, 0.08, 0.08, 0.1, 0.13]],
    neckRows: [[-0.24, 0.17, 0.27, 0.2], [-0.05, 0.15, 0.235, 0.19], [0.15, 0.122, 0.185, 0.165], [0.35, 0.1, 0.145, 0.135], [0.53, 0.088, 0.12, 0.112], [0.66, 0.082, 0.105, 0.1], [0.74, 0.078, 0.095, 0.096]],
    headRows: [[-0.1, 0.06, 0.07, 0.075], [-0.03, 0.09, 0.098, 0.1], [0.06, 0.1, 0.128, 0.108], [0.15, 0.092, 0.124, 0.098], [0.25, 0.074, 0.098, 0.084], [0.35, 0.06, 0.074, 0.07], [0.43, 0.058, 0.066, 0.066], [0.5, 0.05, 0.05, 0.052]],
    fore: [[0.14, 0.095, 0.13], [0, 0.085, 0.12], [-0.15, 0.07, 0.095], [-0.32, 0.052, 0.062], [-0.44, 0.046, 0.05], [-0.5, 0.053, 0.056]],
    hind: [[0.16, 0.115, 0.18], [0, 0.1, 0.155], [-0.18, 0.072, 0.1], [-0.36, 0.05, 0.062], [-0.46, 0.047, 0.05, 0.072], [-0.5, 0.05, 0.05, 0.06]],
    cannon: [[0.03, 0.05, 0.052], [-0.07, 0.036, 0.04], [-0.22, 0.033, 0.038], [-0.3, 0.043, 0.046]],
    hoofR: 0.058, pastern: 0.13,
  },
  cow: {
    bodyY: 1.0, neck: [0, 0, 0.4, 1.2], neckAt: [0.14, 0.56], headRot: 0.55, legU: 0.37, legC: 0.2, legX: 0.2, legZ: [0.42, -0.4], hipY: -0.22, tailAt: [0.24, -0.68], top: 0.36, col: 0xd8d0c0, dark: 0x4a4038, hindRest: 0.22,
    barrel: [[-0.7, 0.08, 0.11, 0.13, 0.19], [-0.62, 0.06, 0.25, 0.24, 0.3], [-0.46, 0.03, 0.33, 0.27, 0.36], [-0.22, 0, 0.37, 0.265, 0.42], [0.04, -0.01, 0.375, 0.265, 0.43], [0.27, 0, 0.34, 0.28, 0.41], [0.44, 0.03, 0.28, 0.29, 0.37], [0.57, 0.05, 0.2, 0.24, 0.31], [0.66, 0.07, 0.1, 0.12, 0.18]],
    neckRows: [[-0.2, 0.17, 0.26, 0.2], [0, 0.15, 0.22, 0.18], [0.16, 0.13, 0.18, 0.155], [0.32, 0.115, 0.15, 0.135], [0.42, 0.11, 0.13, 0.125]],
    headRows: [[-0.07, 0.075, 0.08, 0.085], [0.0, 0.115, 0.108, 0.112], [0.1, 0.12, 0.118, 0.11], [0.2, 0.1, 0.098, 0.094], [0.29, 0.092, 0.084, 0.082], [0.35, 0.086, 0.07, 0.07]],
    fore: [[0.12, 0.1, 0.13], [0, 0.09, 0.115], [-0.14, 0.07, 0.085], [-0.28, 0.055, 0.06], [-0.37, 0.058, 0.06]],
    hind: [[0.14, 0.12, 0.18], [0, 0.1, 0.15], [-0.15, 0.072, 0.095], [-0.29, 0.052, 0.06, 0.075], [-0.37, 0.055, 0.055, 0.064]],
    cannon: [[0.03, 0.055, 0.056], [-0.06, 0.042, 0.045], [-0.15, 0.04, 0.043], [-0.2, 0.05, 0.052]],
    hoofR: 0.066, pastern: 0.1,
  },
};
const coatCache = new Map();
function coatMaterial(col, dark, type) {
  const k = col + '|' + dark + type;
  if (coatCache.has(k)) return coatCache.get(k);
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), hx = (v) => '#' + v.toString(16).padStart(6, '0');
  g.fillStyle = hx(col); g.fillRect(0, 0, 256, 256);
  // body: darker along the spine, paler under the belly, a soft dapple, the shadow of ribs and flank
  let grd = g.createLinearGradient(0, 0, 256, 0);
  grd.addColorStop(0, 'rgba(255,240,220,0.18)'); grd.addColorStop(0.3, 'rgba(0,0,0,0.04)'); grd.addColorStop(0.5, 'rgba(0,0,0,0.24)'); grd.addColorStop(0.7, 'rgba(0,0,0,0.04)'); grd.addColorStop(1, 'rgba(255,240,220,0.18)');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 220; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(255,235,210,0.045)' : 'rgba(0,0,0,0.05)'; g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 9, 0, 7); g.fill(); }
  g.strokeStyle = 'rgba(0,0,0,0.07)'; g.lineWidth = 3;
  for (const u of [0.22, 0.78]) for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(256 * u - 26, 58 + i * 7); g.quadraticCurveTo(256 * u, 62 + i * 7, 256 * u + 26, 56 + i * 7); g.stroke(); }
  // short hair: fine strokes lying back along the body
  g.lineWidth = 1;
  for (let i = 0; i < 900; i++) { g.strokeStyle = Math.random() < 0.5 ? 'rgba(255,240,220,0.05)' : 'rgba(0,0,0,0.07)'; const x = Math.random() * 256, y = Math.random() * 256; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 2, y + 3 + Math.random() * 5); g.stroke(); }
  // neck & head: darker muzzle
  grd = g.createLinearGradient(0, 128, 0, 256);
  grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(0.8, 'rgba(0,0,0,0.05)'); grd.addColorStop(1, type === 'cow' ? 'rgba(40,30,28,0.75)' : 'rgba(0,0,0,0.5)');
  g.fillStyle = grd; g.fillRect(0, 128, 128, 128);
  // legs: shade toward the dark points
  grd = g.createLinearGradient(0, 128, 0, 256);
  grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, hx(dark));
  g.fillStyle = grd; g.fillRect(128, 128, 64, 128);
  g.fillStyle = hx(dark); g.fillRect(192, 128, 64, 128);
  g.strokeStyle = 'rgba(255,255,255,0.08)'; for (let i = 0; i < 60; i++) { const x = 192 + Math.random() * 64; g.beginPath(); g.moveTo(x, 128); g.lineTo(x + (Math.random() - 0.5) * 6, 256); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: type === 'cow' ? 0.78 : 0.55, normalMap: normalFromCanvas(c, 256, 3), normalScale: new THREE.Vector2(0.7, 0.7) });
  coatCache.set(k, m);
  return m;
}

export class Quadruped {
  constructor(type = 'horse', o = {}) {
    const d = QUAD[type], horse = type === 'horse';
    const colHex = o.color ?? d.col, darkHex = o.dark ?? d.dark;
    const mat = coatMaterial(colHex, darkHex, type), dark = M(darkHex, 0.8), hoofM = M(0x17120e, 0.45), eyeM = M(0x090605, 0.15);
    this.type = type;
    this.root = new THREE.Group();
    const body = this.body = group(this.root, 0, d.bodyY, 0);
    const add = (parent, sgb, m = mat) => { const ms = new THREE.Mesh(sgb.build(false), m); ms.castShadow = true; parent.add(ms); return ms; };
    // ---- trunk: barrel, with the masses of shoulder and haunch laid over it
    let g = new SGB(256);
    // shoulder and haunch swell out of the barrel as part of the same skin
    const zs = d.legZ[0] + 0.04, zh = d.legZ[1] - 0.1, E = (x, w) => Math.exp(-(x * x) / (w * w));
    g.loft(d.barrel.map(([z, cy, rx, top, bot], i, a) => ({
      c: [0, cy, z], ax: [rx, 0, 0], az: [0, top, 0], azB: [0, bot, 0], v: i / (a.length - 1),
      mod: (th) => { const sn = Math.sin(th), cs = Math.cos(th), side = sn * sn * (cs > 0 ? 1 - cs * cs * 0.6 : 1 - cs * cs * 0.3); return 1 + (0.085 * E(z - zs, 0.15) + 0.115 * E(z - zh, 0.19)) * side - 0.03 * E(z - (zs + zh) / 2, 0.2) * sn * sn * (cs > 0 ? 1 : 0); },
    })), 24, RB, { capStart: 0.05, capEnd: 0.05 });
    if (!horse) for (const s of [-1, 1]) blob(g, s * 0.2, 0.2, -0.44, 0.045, 0.045, 0.075, RB, 0.2);       // the points of the hips
    if (!horse && o.hump) g.loft([[0.16, 0.12, 0.14, 0.18], [0.3, 0.3, 0.13, 0.2], [0.38, 0.38, 0.1, 0.16], [0.43, 0.4, 0.05, 0.08]].map(([y, z, rx, rz], i) => ({ c: [0, y, z], ax: [rx, 0, 0], az: [0, 0, rz], v: 0.45 + i * 0.03 })), 12, RB, { capEnd: 0.02 });
    if (!horse) g.loft([[-0.18, 0.62, 0.02], [-0.36, 0.52, 0.03], [-0.47, 0.36, 0.022], [-0.4, 0.2, 0.012]].map(([y, z, r], i) => ({ c: [0, y, z], ax: [r, 0, 0], az: [0, 0.07, 0.11], v: i / 3 })), 8, RB, { capStart: 0.01, capEnd: 0.01 });   // dewlap
    add(body, g);
    // ---- neck & head
    const neck = this.neck = group(body, 0, d.neckAt[0], d.neckAt[1]);
    neck.rotation.x = d.neck[3];
    g = new SGB(256);
    limb(g, d.neckRows, 14, RN, 0, 0.5);
    add(neck, g);
    const nl = d.neckRows[d.neckRows.length - 1][0];
    const head = this.head = group(neck, 0, nl - 0.06, 0);
    head.rotation.x = d.headRot;
    g = new SGB(256);
    limb(g, d.headRows, 14, RN, 0.5, 1, { capStart: 0.03, capEnd: 0.022 });
    if (horse) for (const s of [-1, 1]) blob(g, s * 0.062, 0.07, 0.07, 0.04, 0.085, 0.06, RN, 0.6);      // the round of the jaw
    add(head, g);
    const hl = d.headRows[d.headRows.length - 1][0], ew = d.headRows[2][1];
    for (const s of [-1, 1]) {
      mesh(sphere(0.021, 8, 6), eyeM, head, s * (ew - 0.006), 0.075, -0.035);
      mesh(sphere(0.006, 5, 4), M(0xfff6e0, 0.2), head, s * (ew + 0.008), 0.068, -0.045);
      const no = mesh(sphere(0.016, 6, 5), M(0x120c0a, 0.5), head, s * (horse ? 0.03 : 0.045), hl - 0.012, -0.012); no.scale.set(1, 1.5, 0.8);
      // ears: hollow leaves
      const eg = new SGB(256);
      const E = horse ? [[0, 0.03], [0.05, 0.04], [0.11, 0.028], [0.16, 0.006]] : [[0, 0.03], [0.07, 0.055], [0.15, 0.05], [0.21, 0.012]];
      eg.loft(E.map(([y, r], i) => ({ c: [0, y, 0], ax: [r, 0, 0], az: [0, 0, r * 0.45], v: 0.2 + i * 0.1 })), 8, RN, { capEnd: 0.01 });
      const ear = add(head, eg); ear.position.set(s * (horse ? 0.055 : 0.12), -0.05, -0.07);
      if (horse) { ear.rotation.set(-1.9, 0, s * -0.25); } else { ear.rotation.set(-1.6, 0, s * -1.25); }
      if (!horse) {       // horns sweeping out and up
        const hg = new SGB(256);
        hg.loft([[0, 0, 0.03], [0.1, 0.03, 0.027], [0.2, 0.1, 0.02], [0.27, 0.19, 0.008]].map(([x, y, r], i) => ({ c: [s * x, y, 0], ax: [0, r, 0], az: [0, 0, r], v: i / 3 })), 7, RH, { capEnd: 0.01 });
        const hm = new THREE.Mesh(hg.build(false), M(0x4a4038, 0.45)); hm.castShadow = true; hm.position.set(s * 0.08, -0.05, -0.1); hm.rotation.x = -1.5; head.add(hm);
      }
    }
    if (horse) {
      // mane falling to the near side, and a forelock
      g = new SGB(256);
      g.loft(d.neckRows.slice(1).map(([y, rx, zf, zb], i) => ({ c: [0.035, y + 0.02, -zb * 0.9], ax: [0.012, 0, -0.006], az: [0.05, 0, 0.085 + (i % 2) * 0.012], v: i / 5 })), 6, RH, { capStart: 0.01, capEnd: 0.01 });
      g.loft([[-0.09, 0.03], [0.0, 0.045], [0.1, 0.03], [0.17, 0.008]].map(([y, r], i) => ({ c: [0, y, -0.105 - i * 0.004], ax: [r, 0, 0], az: [0, 0, 0.014], v: i / 3 })), 6, RH, { capEnd: 0.01 });
      add(neck, g);
    }
    // ---- tail
    const tail = this.tail = group(body, 0, d.tailAt[0], d.tailAt[1]);
    tail.rotation.x = 0.35;
    g = new SGB(256);
    const Tl = horse ? [[0.02, 0.04], [-0.16, 0.055], [-0.4, 0.085], [-0.68, 0.08], [-0.92, 0.05], [-1.04, 0.012]] : [[0.02, 0.028], [-0.3, 0.02], [-0.55, 0.018], [-0.64, 0.045], [-0.76, 0.05], [-0.86, 0.012]];
    g.loft(Tl.map(([y, r], i) => ({ c: [0, y, 0], ax: [r, 0, 0], az: [0, 0, r * (horse ? 0.7 : 1)], v: i / (Tl.length - 1) })), 8, RH, { capStart: 0.01, capEnd: 0.02 });
    add(tail, g);
    // ---- legs: forearm / gaskin, cannon, pastern and hoof
    this.legs = [];
    const drop = d.bodyY + d.hipY;
    for (const front of [true, false]) for (const s of [-1, 1]) {
      const rest = front ? [0, 0, -0.5] : [d.hindRest, -d.hindRest, -0.5];
      const hp = group(body, s * d.legX, d.hipY, front ? d.legZ[0] : d.legZ[1]);
      g = new SGB(256); limb(g, front ? d.fore : d.hind, 10, RL, 0, 0.45, { capStart: 0.02 }); add(hp, g);
      const kn = group(hp, 0, -d.legU, 0);
      g = new SGB(256); limb(g, d.cannon, 9, RL, 0.45, 0.8); add(kn, g);
      const ft = group(kn, 0, -d.legC, 0);
      g = new SGB(256); limb(g, [[0.02, 0.04, 0.042], [-d.pastern * 0.6, 0.033, 0.036], [-d.pastern, 0.04, 0.042]], 8, RL, 0.8, 1); add(ft, g);
      // the hoof stays level whatever the slope of the pastern
      const hh = Math.max(0.05, drop - d.legU * Math.cos(rest[0]) - d.legC - d.pastern * Math.cos(0.5));
      // the hoof: a horn wall sloping forward to the toe, level on the ground whatever the slope of the pastern
      const hg = new SGB(256), R = d.hoofR;
      limb(hg, [[0, R * 0.78, R * 0.84, R * 0.74], [-hh * 0.55, R * 0.9, R * 1.02, R * 0.8], [-hh, R, R * 1.18, R * 0.86]], 10, RL, 0.95, 1, { capStart: 0.004, capEnd: 0.002 });
      const hf = new THREE.Mesh(hg.build(false), hoofM); hf.castShadow = true; ft.add(hf);
      hf.position.set(0, -d.pastern * Math.cos(0.5) + 0.005, d.pastern * Math.sin(0.5) + 0.012);
      ft.rotation.x = rest[2]; hf.position.applyAxisAngle(new THREE.Vector3(1, 0, 0), 0.5); hf.rotation.x = 0.5;
      hp.rotation.x = rest[0]; kn.rotation.x = rest[1];
      this.legs.push({ hp, kn, ft, front, side: s, rest });
    }
    if (o.saddle) {
      const top = d.top;
      // saddle-cloth lying on the back, and a saddle with a raised pommel and cantle
      const leather = new THREE.MeshStandardMaterial({ color: 0x4a2a16, roughness: 0.45, side: THREE.DoubleSide }), strap = M(0x2a1a10, 0.55);
      const cg = new SGB(256);
      cg.loft([[-0.42, 0.275, 0.275], [-0.2, 0.29, 0.262], [0.05, 0.305, 0.258], [0.3, 0.29, 0.275]].map(([z, rx, tp], i) => ({ c: [0, 0.012, z], ax: [rx, 0, 0], az: [0, tp, 0], azB: [0, 0.06, 0], v: i / 3 })), 16, RB, {});
      const cl = new THREE.Mesh(cg.build(false), new THREE.MeshStandardMaterial({ color: 0x7a1f1c, roughness: 0.95, side: THREE.DoubleSide })); cl.castShadow = true; body.add(cl);
      const sg = new SGB(256);
      sg.loft([[-0.36, 0.1, 0.09, 0.05], [-0.3, 0.07, 0.19, 0.05], [-0.14, 0.012, 0.22, 0.04], [0.06, 0.0, 0.215, 0.04], [0.2, 0.03, 0.16, 0.045], [0.27, 0.085, 0.07, 0.04], [0.29, 0.1, 0.03, 0.02]].map(([z, y, w, t], i) => ({ c: [0, top - 0.02 + y, z - 0.02], ax: [w, 0, 0], az: [0, t, 0], azB: [0, t * 0.6, 0], v: i / 6 })), 14, RB, { capStart: 0.01, capEnd: 0.01 });
      for (const sx of [-1, 1]) sg.loft([[0.0, 0.2, 0.012], [-0.14, 0.215, 0.014], [-0.3, 0.19, 0.012], [-0.4, 0.12, 0.008]].map(([y, w, t], i) => ({ c: [sx * (0.25 + i * 0.022), top - 0.04 + y, 0.02], ax: [t, 0, 0], az: [0, 0, w], v: i / 3 })), 10, RB, { capEnd: 0.004 });   // flaps
      const sd = new THREE.Mesh(sg.build(false), leather); sd.castShadow = true; body.add(sd);
      const girth = mesh(new THREE.TorusGeometry(0.335, 0.014, 5, 22), strap, body, 0, -0.02, 0.2); girth.scale.set(0.9, 1.05, 1);
      for (const sx of [-1, 1]) {
        const lg = new GB(); lg.tube((t) => [sx * (0.3 + t * 0.012), top - 0.1 - t * 0.44, 0.03], () => 0.012, 4, 6, 1, [0.17, 0.1, 0.06], 1);
        const lm = new THREE.Mesh(lg.build(), M(0xffffff, 0.55, { vertexColors: true })); body.add(lm);
        const st = mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 14), M(0x9a9a9a, 0.3, { metalness: 0.9 }), body, sx * 0.315, top - 0.57, 0.03); st.rotation.y = Math.PI / 2;
      }
      // bridle: noseband, browband, cheek straps
      const nb = mesh(new THREE.TorusGeometry(0.066, 0.008, 5, 12), M(0x2a1a10, 0.6), head, 0, 0.33, 0); nb.rotation.x = Math.PI / 2;
      const bb = mesh(new THREE.TorusGeometry(0.1, 0.008, 5, 12), M(0x2a1a10, 0.6), head, 0, 0.02, 0.005); bb.rotation.x = Math.PI / 2;
      for (const sx of [-1, 1]) { const bg = new GB(); bg.tube((t) => [sx * (0.098 - t * 0.03), 0.03 + t * 0.3, 0.012], () => 0.007, 4, 5, 1, [0.17, 0.1, 0.06], 1); head.add(new THREE.Mesh(bg.build(), M(0xffffff, 0.55, { vertexColors: true }))); }
    }
    mergeStatic(this.root);
    this.seatY = d.bodyY + d.top - 0.8;
    this.baseY = d.bodyY;
    this.phase = Math.random() * 6; this.t = Math.random() * 10; this.speed = 0;
    this.graze = !!o.graze;
  }
  // Four gaits, each with its own footfall order: the four-beat walk, the
  // two-beat trot on diagonal pairs, the rocking three-beat canter and the
  // gallop with all feet off the ground — blended by speed.
  update(dt) {
    dt = Math.min(dt, 0.1);
    this.t += dt;
    const sp = this.speed, t = this.t, d = QUAD[this.type], horse = this.type === 'horse';
    const LL = d.legU + d.legC + 0.2, ss = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
    const wT = ss(1.9, 2.7, sp), wC = ss(5.6, 6.8, sp), wG = ss(8.8, 10.2, sp), mix = (a, b, c, e) => lerp(lerp(lerp(a, b, wT), c, wC), e, wG);
    const stride = mix(1.25 + 0.25 * sp, 2.0 + 0.2 * sp, 2.6 + 0.15 * sp, 3.2 + 0.2 * sp) * (horse ? 1 : 0.75);
    const duty = mix(0.66, 0.46, 0.38, 0.28), moving = sp > 0.05;
    if (moving) this.cyc = ((this.cyc || 0) + sp / stride * dt) % 1;
    const cyc = this.cyc || 0, go = this.go = damp(this.go || 0, moving ? 1 : 0, 6, dt);
    // how the body is being ridden: turning, speeding up, pulling up
    const yaw = this.root.rotation.y, dy = Math.atan2(Math.sin(yaw - (this.pyaw ?? yaw)), Math.cos(yaw - (this.pyaw ?? yaw)));
    this.turn = damp(this.turn || 0, clamp(dy / dt, -4, 4), 6, dt); this.pyaw = yaw;
    this.acc = damp(this.acc || 0, clamp((sp - (this.psp ?? sp)) / dt, -12, 12), 5, dt); this.psp = sp;
    const A = clamp(duty * stride / (2 * LL) * 0.9, 0.15, 0.72);
    // resting a hind leg when standing about
    const restSide = Math.sin(t * 0.11 + (this.seed || (this.seed = Math.random() * 9))) > 0 ? 1 : -1, rest = (1 - go) * (this.graze ? 0.5 : 1);
    for (const l of this.legs) {
      const off = l.front ? (l.side < 0 ? mix(0.25, 0.5, 0.3, 0.42) : mix(0.75, 1.0, 0.6, 0.55)) : (l.side < 0 ? 0 : mix(0.5, 0.5, 0.3, 0.12));
      const p = (cyc + off) % 1;
      let hip, knee;
      if (p < duty) { const u = p / duty; hip = lerp(-A, A, u); knee = (l.front ? 0.04 : 0.16) * Math.sin(Math.PI * u) + (l.front ? 0 : 0.1 * wC); }
      else {
        const v = (p - duty) / (1 - duty), e = v * v * (3 - 2 * v);
        hip = lerp(A, -A, e) - (l.front ? 0.12 : 0.05) * Math.sin(Math.PI * v) * (0.5 + wT * 0.5);
        knee = (l.front ? mix(0.75, 1.25, 1.5, 1.6) : mix(0.55, 0.85, 1.1, 1.25)) * Math.sin(Math.PI * Math.pow(v, 0.8));
      }
      hip *= go; knee *= go;
      if (!l.front && l.side === restSide) { hip += -0.1 * rest; knee += 0.34 * rest; }
      const load = p < duty ? Math.sin(Math.PI * p / duty) * go : 0;
      l.hp.rotation.x = damp(l.hp.rotation.x, hip + l.rest[0] + (l.front ? 0 : knee * 0.42), 22, dt);
      l.kn.rotation.x = damp(l.kn.rotation.x, l.front ? knee : l.rest[1] - knee * 0.9, 22, dt);
      l.ft.rotation.x = damp(l.ft.rotation.x, l.rest[2] + knee * 0.75 - load * 0.16, 22, dt);
    }
    const c2 = Math.cos(cyc * Math.PI * 2), s2 = Math.sin(cyc * Math.PI * 2), c4 = Math.cos(cyc * Math.PI * 4);
    const breath = Math.sin(t * (1.1 + Math.min(sp, 10) * 0.35)) * 0.006;
    const bob = go * mix(0.012 * c4, 0.035 * c4, 0.055 * Math.sin((cyc - 0.15) * Math.PI * 2), 0.075 * Math.sin((cyc - 0.15) * Math.PI * 2));
    this.body.position.y = this.baseY + bob - 0.02 * rest;
    this.body.scale.set(1 + breath * 1.6, 1 + breath, 1);
    const rock = go * mix(0, 0.012 * s2, -0.065 * c2, -0.085 * c2);
    this.body.rotation.x = damp(this.body.rotation.x, rock - clamp(this.acc * 0.012, -0.14, 0.1), 14, dt);
    this.body.rotation.z = damp(this.body.rotation.z, go * mix(0.022 * s2, 0.008 * s2, 0, 0) + clamp(-this.turn * Math.min(sp, 12) * 0.014, -0.2, 0.2) + 0.03 * rest * restSide, 8, dt);
    // tail: streams out at speed, swishes at rest, lags through turns
    const sw = Math.max(0, Math.sin(t * 0.37 + (this.seed || 0)) - 0.55) * 2.2;
    this.tail.rotation.x = damp(this.tail.rotation.x, 0.3 + 0.35 * wT + 0.55 * wC + 0.25 * wG + bob * 3, 6, dt);
    this.tail.rotation.z = damp(this.tail.rotation.z, Math.sin(t * 6.5) * 0.45 * sw * (1 - go) + Math.sin(t * 1.3) * 0.12 + clamp(this.turn * 0.25, -0.6, 0.6) + go * 0.1 * s2, 8, dt);
    // neck and head: nodding at the walk, reaching out at the gallop, tossing now and then
    let neckT = d.neck[3] + go * mix(0.07 * c4, 0.025 * c4, 0.09 * Math.cos((cyc + 0.1) * Math.PI * 2) + 0.12, 0.11 * Math.cos((cyc + 0.1) * Math.PI * 2) + 0.3) - clamp(this.acc * 0.012, -0.12, 0.2);
    const toss = Math.max(0, Math.sin(t * 0.23 + (this.seed || 0) * 3) - 0.93) * 14;
    if (this.graze && sp < 0.05) neckT = d.neck[3] + 1.25 + Math.sin(t * 0.7) * 0.12;
    else neckT += (1 - go) * (Math.sin(t * 0.31 + (this.seed || 0)) * 0.08 - toss * 0.22 * Math.abs(Math.sin(t * 9)));
    this.neck.rotation.x = damp(this.neck.rotation.x, neckT, this.graze && sp < 0.05 ? 2.5 : 9, dt);
    this.neck.rotation.z = damp(this.neck.rotation.z, clamp(-this.turn * 0.18, -0.35, 0.35) + (1 - go) * Math.sin(t * 0.19 + (this.seed || 0) * 2) * 0.12, 4, dt);
    this.head.rotation.x = damp(this.head.rotation.x, d.headRot + go * mix(0.05 * c4, 0, -0.06 * c2, -0.08 * c2 - 0.12) + toss * 0.1, 8, dt);
    this.wT = wT; this.wC = wC; this.wG = wG;
  }
}

// =========================================================== ELEPHANT
let _eleSkin = null;
function elephantSkin() {
  if (_eleSkin) return _eleSkin;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#6d6862'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 400; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(255,245,230,0.04)' : 'rgba(0,0,0,0.06)'; g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 12, 0, 7); g.fill(); }
  // the hide: a net of fine creases
  for (let i = 0; i < 520; i++) {
    g.strokeStyle = `rgba(20,16,14,${0.1 + Math.random() * 0.16})`; g.lineWidth = 0.6 + Math.random() * 0.8;
    const x = Math.random() * 256, y = Math.random() * 256, l = 6 + Math.random() * 22, a = (Math.random() - 0.5) * 0.7 + (Math.random() < 0.25 ? 1.57 : 0);
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (Math.random() - 0.5) * 4, y + Math.sin(a) * l * 0.5 + (Math.random() - 0.5) * 4, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return (_eleSkin = new THREE.MeshStandardMaterial({ map: t, roughness: 0.92, normalMap: normalFromCanvas(c, 256, 5, true), normalScale: new THREE.Vector2(1.2, 1.2) }));
}
const RE = [0, 0, 256, 256];
export class Elephant {
  constructor(o = {}) {
    const col = elephantSkin(), dark = M(0x57524e, 0.95), nail = M(0xcfc6b0, 0.6);
    this.root = new THREE.Group();
    const s = o.scale ?? 1;
    this.root.scale.setScalar(s);
    const body = this.body = group(this.root, 0, 1.95, 0);
    const add = (parent, sgb, m = col) => { const ms = new THREE.Mesh(sgb.build(false), m); ms.castShadow = true; parent.add(ms); return ms; };
    // ---- the great barrel: the arched back of the Asian elephant, a hanging belly
    let g = new SGB(256);
    const Bd = [[-1.42, 0.2, 0.2, 0.25, 0.35], [-1.3, 0.14, 0.55, 0.55, 0.7], [-1.0, 0.1, 0.8, 0.78, 0.95], [-0.55, 0.1, 0.87, 0.88, 1.02], [-0.1, 0.12, 0.88, 0.9, 1.03], [0.35, 0.1, 0.86, 0.86, 1.0], [0.75, 0.06, 0.8, 0.8, 0.94], [1.05, 0.05, 0.66, 0.72, 0.82], [1.25, 0.08, 0.42, 0.5, 0.56], [1.36, 0.12, 0.2, 0.25, 0.3]];
    g.loft(Bd.map(([z, cy, rx, top, bot], i, a) => ({ c: [0, cy, z], ax: [rx, 0, 0], az: [0, top, 0], azB: [0, bot, 0], v: i / (a.length - 1) * 2 })), 22, RE, { capStart: 0.08, capEnd: 0.08 });
    add(body, g);
    // ---- head: twin domes, the long face running into the trunk
    const head = this.head = group(body, 0, 0.42, 1.3);
    g = new SGB(256);
    limb(g, [[0.62, 0.2, 0.22, 0.3], [0.5, 0.42, 0.4, 0.46], [0.3, 0.52, 0.5, 0.52], [0.05, 0.5, 0.52, 0.5], [-0.2, 0.42, 0.5, 0.42], [-0.42, 0.3, 0.44, 0.3], [-0.6, 0.2, 0.36, 0.16]], 16, RE, 0, 1, { capStart: 0.03, capEnd: 0.05 });
    for (const sd of [-1, 1]) blob(g, sd * 0.2, 0.5, -0.02, 0.24, 0.24, 0.3, RE, 0.3);
    g.loft([[-0.42, 0.26, 0.2], [-0.6, 0.3, 0.15], [-0.72, 0.36, 0.07]].map(([y, z, r], i) => ({ c: [0, y, z - 0.25], ax: [r, 0, 0], az: [0, 0, r * 0.8], v: i / 2 })), 8, RE, { capEnd: 0.02 });   // lower lip
    add(head, g);
    this.ears = [];
    for (const sd of [-1, 1]) {
      mesh(sphere(0.035, 8, 6), M(0x0c0908, 0.2), head, sd * 0.4, 0.12, 0.3);
      // ears: thin fans with a folded top edge
      const eg = group(head, sd * 0.44, 0.22, -0.08);
      g = new SGB(256);
      g.loft([[0.3, 0.1], [0.2, 0.36], [0.0, 0.5], [-0.25, 0.46], [-0.48, 0.3], [-0.62, 0.1]].map(([y, w], i) => ({ c: [sd * w * 0.55, y, -0.05 - w * 0.1], ax: [w * 0.55, 0, 0], az: [0, 0, 0.022], v: i / 5 })), 8, RE, { capStart: 0.01, capEnd: 0.01 });
      add(eg, g, dark);
      eg.rotation.y = sd * -0.35;
      this.ears.push({ g: eg, s: sd });
      // tusks: short, curving forward
      const tg = new SGB(256);
      tg.loft([[0, 0, 0.055], [-0.2, 0.1, 0.05], [-0.4, 0.26, 0.038], [-0.5, 0.42, 0.016]].map(([y, z, r], i) => ({ c: [0, y, z], ax: [r, 0, 0], az: [0, 0, r], v: i / 3 })), 8, RE, { capEnd: 0.02 });
      const tk = new THREE.Mesh(tg.build(false), M(0xe9e2cf, 0.35)); tk.castShadow = true; tk.position.set(sd * 0.2, -0.5, 0.32); tk.rotation.z = sd * 0.12; head.add(tk);
    }
    // ---- trunk: a tapering chain that can curl
    this.trunk = [];
    let parent = group(head, 0, -0.5, 0.4);
    parent.rotation.x = 0.25;
    for (let i = 0; i < 8; i++) {
      const r0 = 0.2 - i * 0.02, r1 = 0.2 - (i + 1) * 0.02;
      g = new SGB(256);
      limb(g, [[0.05, r0 + 0.004, r0 + 0.004], [-0.13, (r0 + r1) / 2 + 0.006, (r0 + r1) / 2 + 0.006], [-0.3, r1 + 0.002, r1 + 0.002]], 10, RE, i / 8, (i + 1) / 8, i === 7 ? { capEnd: 0.02 } : {});
      add(parent, g);
      this.trunk.push(parent);
      parent = group(parent, 0, -0.27, 0);
    }
    // ---- legs: pillars with a knee, a broad round foot and toenails
    this.legs = [];
    for (const z of [0.82, -0.85]) for (const sd of [-1, 1]) {
      const front = z > 0;
      const hp = group(body, sd * 0.48, -0.4, z);
      g = new SGB(256); limb(g, [[0.25, 0.3, 0.36], [0, 0.27, 0.32], [-0.35, 0.24, 0.26], [-0.72, 0.21, 0.22], [-0.8, 0.22, 0.23]], 12, RE, 0, 1, { capStart: 0.03 }); add(hp, g);
      const kn = group(hp, 0, -0.78, 0);
      g = new SGB(256); limb(g, [[0.04, 0.22, 0.23], [-0.25, 0.2, 0.2], [-0.5, 0.21, 0.22], [-0.56, 0.23, 0.24]], 12, RE, 0, 0.7); add(kn, g);
      const ft = group(kn, 0, -0.54, 0);
      g = new SGB(256); limb(g, [[0.03, 0.23, 0.24], [-0.12, 0.25, 0.27, 0.25], [-0.2, 0.26, 0.29, 0.26], [-0.23, 0.25, 0.28, 0.25]], 12, RE, 0, 0.3, { capEnd: 0.005 }); add(ft, g);
      for (let k = -1; k <= 1; k++) { const n = mesh(sphere(0.06, 6, 5), nail, ft, k * 0.11, -0.18, 0.25 - Math.abs(k) * 0.04); n.scale.set(1, 1.1, 0.5); }
      this.legs.push({ hp, kn, ft, front, side: sd });
    }
    const tail = this.tail = group(body, 0, 0.3, -1.42); tail.rotation.x = 0.12;
    g = new SGB(256); limb(g, [[0.05, 0.07, 0.07], [-0.5, 0.04, 0.04], [-1.0, 0.025, 0.025], [-1.12, 0.05, 0.02], [-1.3, 0.02, 0.01]], 7, RE, 0, 1, { capEnd: 0.01 }); add(tail, g, dark);
    if (o.caparison) {
      // nettipattam: the gilded forehead ornament, and a red saddle-cloth with a gold border
      const gold = new THREE.MeshStandardMaterial({ color: 0xd9a93a, roughness: 0.35, metalness: 0.5, emissive: 0x4a3008, emissiveIntensity: 0.6, side: THREE.DoubleSide });
      const ng = new SGB(256);
      ng.loft([[0.6, 0.16], [0.35, 0.3], [0.05, 0.3], [-0.3, 0.22], [-0.75, 0.12], [-1.05, 0.04]].map(([y, w], i) => ({ c: [0, y, 0.53 - Math.max(0, 0.3 - y) * 0.12 + (y > 0.3 ? -(y - 0.3) * 0.5 : 0)], ax: [w, 0, 0], az: [0, 0, 0.02], v: i / 5 })), 8, RE, {});
      const np = new THREE.Mesh(ng.build(false), gold); head.add(np);
      for (let r = 0; r < 4; r++) for (let k = -1; k <= 1; k++) mesh(sphere(0.045, 6, 5), gold, head, k * 0.14 * (1 - r * 0.15), 0.4 - r * 0.25, 0.56 - Math.max(0, r - 1) * 0.03);
      const cg = new SGB(256);
      cg.loft([[-0.8, 0.9], [-0.4, 0.93], [0, 0.94], [0.4, 0.9], [0.8, 0.84]].map(([z, r], i) => ({ c: [0, 0.12, z], ax: [r, 0, 0], az: [0, r * 1.02, 0], azB: [0, 0.3, 0], v: i / 4 })), 16, RE, {});
      const cl = new THREE.Mesh(cg.build(false), new THREE.MeshStandardMaterial({ color: 0x8a1f1c, roughness: 0.95, side: THREE.DoubleSide })); cl.castShadow = true; body.add(cl);
      for (const sz of [-0.82, 0.82]) { const b = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.025, 5, 24, Math.PI), gold); b.position.set(0, 0.14, sz); body.add(b); }
    }
    mergeStatic(this.root);
    this.t = Math.random() * 10; this.phase = 0; this.speed = 0;
  }
  update(dt) {
    this.t += dt; const t = this.t;
    // an elephant ambles: each side's hind foot then fore foot, the great body rolling over them
    const go = this.go = damp(this.go || 0, this.speed > 0.05 ? 1 : 0, 3, dt);
    this.phase += dt * 1.25 * (this.speed > 0.05 ? 1 : 0);
    const amp = 0.3 * go;
    for (const l of this.legs) {
      const ph = this.phase + (l.side > 0 ? 0 : Math.PI) + (l.front ? 1.2 : 0);
      const sw = Math.sin(ph), lift = Math.max(0, Math.cos(ph));
      l.hp.rotation.x = damp(l.hp.rotation.x, -sw * amp - lift * 0.08 * go, 8, dt);
      l.kn.rotation.x = damp(l.kn.rotation.x, lift * (l.front ? 0.55 : -0.4) * go, 8, dt);
      l.ft.rotation.x = damp(l.ft.rotation.x, lift * (l.front ? 0.35 : 0.5) * go, 8, dt);
    }
    this.body.position.y = (this.baseBodyY ?? (this.baseBodyY = this.body.position.y)) + Math.cos(this.phase * 2) * 0.03 * go + Math.sin(t * 0.9) * 0.008;
    this.body.rotation.x = Math.sin(this.phase * 2 + 0.6) * 0.012 * go;
    this.head.rotation.x = Math.sin(this.phase * 2 + 1.2) * 0.05 * go + Math.sin(t * 0.27) * 0.04;
    this.trunk.forEach((g, i) => { g.rotation.x = (i === 0 ? 0.25 : 0.06) + Math.sin(t * 0.8 - i * 0.5) * 0.09 + (i > 3 ? 0.18 : 0); g.rotation.z = Math.sin(t * 0.55 - i * 0.4) * 0.08; });
    for (const e of this.ears) e.g.rotation.y = e.s * (-0.35 - Math.max(0, Math.sin(t * 1.9 + e.s)) * 0.55);
    this.tail.rotation.z = Math.sin(t * 1.7) * 0.25; this.tail.rotation.x = 0.12 + Math.sin(t * 0.9) * 0.05;
    this.body.rotation.z = Math.sin(this.phase) * 0.035 * this.go + Math.sin(t * 0.6) * 0.012;
    this.head.rotation.y = Math.sin(t * 0.33) * 0.12 + Math.sin(this.phase) * 0.04 * this.go;
  }
}

// =========================================================== BIRD (egret)
export class Bird {
  constructor() {
    const w = M(0xf4f2ea, 0.8, { side: THREE.DoubleSide });
    this.root = new THREE.Group();
    const body = this.body = group(this.root, 0, 0, 0);
    const g = new SGB(256);
    // body, drawn-back neck and dagger bill; legs trailing behind
    g.loft([[-0.3, 0.0, 0.01], [-0.2, 0.01, 0.05], [-0.05, 0.02, 0.085], [0.1, 0.02, 0.075], [0.2, 0.035, 0.045]].map(([z, y, r], i) => ({ c: [0, y, z], ax: [r * 0.85, 0, 0], az: [0, r, 0], v: i / 4 })), 8, RE, { capStart: 0.02 });
    const mb = new THREE.Mesh(g.build(false), w); body.add(mb);
    const neck = this.neck = group(body, 0, 0.035, 0.2);
    const ng = new SGB(256);
    ng.loft([[0, 0, 0.04], [0.06, 0.05, 0.028], [0.03, 0.11, 0.024], [0.1, 0.13, 0.026], [0.17, 0.125, 0.02]].map(([z, y, r], i) => ({ c: [0, y, z], ax: [r, 0, 0], az: [0, r, 0], v: i / 4 })), 6, RE, { capEnd: 0.01 });
    neck.add(new THREE.Mesh(ng.build(false), w));
    const bill = mesh(new THREE.ConeGeometry(0.012, 0.15, 5), M(0xd9a23a, 0.6), neck, 0, 0.122, 0.25); bill.rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) { const lg = mesh(cyl(0.006, 0.006, 0.4, 4), M(0x1c1a16, 0.7), body, s * 0.025, -0.01, -0.45); lg.rotation.x = Math.PI / 2; }
    this.wings = [];
    for (const s of [-1, 1]) {
      const wg = group(body, s * 0.05, 0.035, 0.02);
      // inner wing, then the hand with its spread primaries
      const seg = (x0, x1, c0, c1, tip) => {
        const b = new GB();
        const p = [[x0, 0, c0 * 0.45], [x1, 0.01, c1 * 0.45], [x1, 0, -c1 * 0.55], [x0, 0, -c0 * 0.55]].map(([x, y, z], i) => b.vert(s * x, y, z, 0, 1, 0, i % 2, i > 1 ? 1 : 0, 1, 1, 1));
        b.quad(p[0], p[1], p[2], p[3]);
        if (tip) for (let k = 0; k < 4; k++) { const z0 = c1 * 0.45 - k * c1 * 0.25, q = [[x1, 0.01, z0], [x1 + 0.2 - k * 0.03, 0.02, z0 - 0.04 - k * 0.02], [x1, 0.01, z0 - c1 * 0.22]].map(([x, y, z]) => b.vert(s * x, y, z, 0, 1, 0, 0, 0, 1, 1, 1)); b.tri(q[0], q[1], q[2]); }
        const m = new THREE.Mesh(b.build(), w); m.geometry.computeVertexNormals(); return m;
      };
      wg.add(seg(0, 0.4, 0.3, 0.27, false));
      const tip = group(wg, s * 0.4, 0.01, 0);
      const tm = seg(0, 0.36, 0.27, 0.2, true); tip.add(tm);
      this.wings.push({ g: wg, tip, s });
    }
    this.t = Math.random() * 10;
  }
  update(dt) {
    this.t += dt;
    // a few deep beats, then a glide on set wings
    const burst = Math.sin(this.t * 0.9) > -0.25 ? 1 : 0;
    this.flap = damp(this.flap ?? 1, burst, 4, dt);
    const a = Math.sin(this.t * 7.5) * 0.75 * this.flap + 0.12 * (1 - this.flap);
    for (const w of this.wings) { w.g.rotation.z = w.s * a; w.tip.rotation.z = w.s * (Math.sin(this.t * 7.5 - 0.9) * 0.55 * this.flap + 0.05); }
    this.neck.rotation.x = Math.sin(this.t * 7.5 + 1) * 0.03 * this.flap;
    if (this.body) this.body.position.y = -Math.sin(this.t * 7.5) * 0.03 * this.flap;
  }
}
