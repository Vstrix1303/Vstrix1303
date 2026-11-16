// Procedural people of Vaikara, 1905. Bodies and clothes are lofted around the
// Mixamo skeleton of the Xbot placeholder and skinned to its bones, so every
// Mixamo animation (idle / walk / run …) drives them unchanged.
//
// Outfits: mundu with kasavu border, jubba, thorthu over the shoulder, checked
// lungi, saree with pallu, set-mundu, khaki police uniform, colonial white suit
// with pith helmet, head cloths and turbans, palm-leaf hats. Faces are painted.
import * as THREE from 'three/webgpu';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { makeRng } from '../world/noise.js';

const TAU = Math.PI * 2;
const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ── canvas textures ─────────────────────────────────────────────────────────
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.wrapS = THREE.RepeatWrapping;
  return t;
}
const rgb = (c, k = 1) => `rgb(${Math.round(c[0] * k)},${Math.round(c[1] * k)},${Math.round(c[2] * k)})`;
function grain(x, w, h, amt, rnd) {
  const img = x.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (rnd() - 0.5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  x.putImageData(img, 0, 0);
}

// Skin atlas: top half = head (face painted at u = 0.5), bottom half = body.
function skinTexture(tone, o, seed) {
  const rnd = makeRng(seed);
  return canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = rgb(tone); x.fillRect(0, 0, w, h);
    // body: soft mottling
    for (let i = 0; i < 300; i++) { x.fillStyle = rgb(tone, 0.9 + rnd() * 0.15); x.globalAlpha = 0.25; x.beginPath(); x.arc(rnd() * w, 256 + rnd() * 256, 4 + rnd() * 18, 0, TAU); x.fill(); }
    x.globalAlpha = 1;
    const hair = o.grey ? [120, 116, 110] : [22, 17, 14];
    // head: hair cap (back and top), longer for women
    const hairBottom = o.female ? 230 : o.bald ? 40 : 95;
    x.fillStyle = rgb(hair);
    x.fillRect(0, 0, w, 62);
    x.beginPath(); x.moveTo(0, 0); x.lineTo(0, hairBottom); x.quadraticCurveTo(128, hairBottom + 18, 150, 70); x.lineTo(362, 70); x.quadraticCurveTo(384, hairBottom + 18, 512, hairBottom); x.lineTo(512, 0); x.fill();
    if (o.female) { x.beginPath(); x.moveTo(170, 60); x.quadraticCurveTo(256, 40, 342, 60); x.lineTo(342, 72); x.quadraticCurveTo(256, 56, 170, 72); x.fill(); }
    // face
    const cx = 256;
    const dark = rgb(tone, 0.72);
    x.fillStyle = rgb(tone, 0.86); // cheek / nose shading
    x.beginPath(); x.ellipse(cx, 152, 7, 20, 0, 0, TAU); x.fill();
    for (const s of [-1, 1]) {
      // brows, eyes
      x.strokeStyle = rgb(hair); x.lineWidth = 4; x.lineCap = 'round';
      x.beginPath(); x.moveTo(cx + s * 12, 110); x.quadraticCurveTo(cx + s * 22, 104, cx + s * 34, 110); x.stroke();
      x.fillStyle = '#efe6d8'; x.beginPath(); x.ellipse(cx + s * 21, 124, 7, 3.6, 0, 0, TAU); x.fill();
      x.fillStyle = '#24160e'; x.beginPath(); x.arc(cx + s * 21, 124, 3.2, 0, TAU); x.fill();
      x.strokeStyle = dark; x.lineWidth = 2; x.beginPath(); x.ellipse(cx + s * 21, 123, 8, 4.4, 0, Math.PI, TAU); x.stroke();
      if (o.female) { x.strokeStyle = '#1a1210'; x.lineWidth = 2; x.beginPath(); x.ellipse(cx + s * 23, 124, 10, 5.5, 0, Math.PI * 1.05, TAU * 0.98); x.stroke(); }
    }
    x.fillStyle = dark; x.beginPath(); x.ellipse(cx - 6, 168, 3, 2, 0, 0, TAU); x.ellipse(cx + 6, 168, 3, 2, 0, 0, TAU); x.fill(); // nostrils
    x.fillStyle = o.female ? '#8a3a34' : rgb(tone, 0.62);
    x.beginPath(); x.ellipse(cx, 188, 13, 4, 0, 0, TAU); x.fill();
    if (o.moustache) { x.fillStyle = rgb(hair); x.beginPath(); x.moveTo(cx - 22, 184); x.quadraticCurveTo(cx, 170, cx + 22, 184); x.quadraticCurveTo(cx, 178, cx - 22, 184); x.fill(); }
    if (o.beard) { x.fillStyle = rgb(hair); x.globalAlpha = 0.85; x.beginPath(); x.moveTo(cx - 40, 165); x.quadraticCurveTo(cx, 260, cx + 40, 165); x.lineTo(cx + 30, 196); x.quadraticCurveTo(cx, 214, cx - 30, 196); x.fill(); x.globalAlpha = 1; }
    if (o.bindi) { x.fillStyle = '#a8141c'; x.beginPath(); x.arc(cx, 100, 3.5, 0, TAU); x.fill(); }
    if (o.chandan) { x.fillStyle = '#e8d8b0'; x.fillRect(cx - 2, 86, 4, 18); }
    // ears
    x.fillStyle = rgb(tone, 0.9); for (const ex of [128, 384]) { x.beginPath(); x.ellipse(ex, 135, 9, 18, 0, 0, TAU); x.fill(); }
    grain(x, w, h, 10, rnd);
  });
}

// Cloth: vertical v runs from hem (0) upward; borders at the hem and edges.
function clothTexture(kind, base, accent, seed) {
  const rnd = makeRng(seed);
  return canvasTex(256, 512, (x, w, h) => {
    x.fillStyle = rgb(base); x.fillRect(0, 0, w, h);
    if (kind === 'check') {
      x.globalAlpha = 0.55; x.fillStyle = rgb(accent);
      for (let i = 0; i < w; i += 32) x.fillRect(i, 0, 10, h);
      for (let j = 0; j < h; j += 32) x.fillRect(0, j, w, 10);
      x.globalAlpha = 1;
    }
    if (kind === 'stripe') { x.fillStyle = rgb(accent); for (let i = 0; i < w; i += 18) x.fillRect(i, 0, 3, h); }
    if (kind === 'kasavu' || kind === 'saree') {
      // gold border near the hem, thin second line
      const y0 = h - 34;
      x.fillStyle = rgb(accent); x.fillRect(0, y0, w, kind === 'saree' ? 26 : 16);
      x.fillRect(0, y0 - 9, w, 3);
      if (kind === 'saree') { x.fillStyle = rgb(accent, 0.8); for (let i = 0; i < w; i += 12) x.fillRect(i, y0 + 4, 6, 6); }
    }
    // woven texture
    x.globalAlpha = 0.08; x.strokeStyle = '#000';
    for (let j = 0; j < h; j += 3) { x.beginPath(); x.moveTo(0, j); x.lineTo(w, j); x.stroke(); }
    x.globalAlpha = 1;
    // folds: vertical soft shading
    for (let i = 0; i < 9; i++) { const gx = rnd() * w; const g = x.createLinearGradient(gx - 14, 0, gx + 14, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(0,0,0,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(gx - 14, 0, 28, h); }
    grain(x, w, h, 12, rnd);
  });
}

// ── skinned geometry builder ───────────────────────────────────────────────
class SkinBuilder {
  constructor(nGroups) { this.g = Array.from({ length: nGroups }, () => ({ p: [], uv: [], si: [], sw: [], i: [] })); }
  vert(gi, p, uv, weights) {
    const g = this.g[gi];
    g.p.push(p.x, p.y, p.z); g.uv.push(uv[0], uv[1]);
    const w = weights.slice().sort((a, b) => b[1] - a[1]).slice(0, 4);
    while (w.length < 4) w.push([0, 0]);
    const s = w.reduce((t, q) => t + q[1], 0) || 1;
    for (const [b, v] of w) { g.si.push(b); g.sw.push(v / s); }
    return g.p.length / 3 - 1;
  }
  // loft rings: rings = [{ c: Vector3, a: Vector3 (axis 1, scaled radius), b: Vector3 (axis 2), w: weights(theta) | weights, v }]
  loft(gi, rings, seg, uScale = 1, closeEnds = false) {
    const g = this.g[gi], base = g.p.length / 3;
    for (const r of rings) {
      for (let k = 0; k <= seg; k++) {
        const th = (k / seg) * TAU, c = Math.cos(th), s = Math.sin(th);
        const p = r.c.clone().addScaledVector(r.a, c).addScaledVector(r.b, s);
        this.vert(gi, p, [(k / seg) * uScale, r.v], typeof r.w === 'function' ? r.w(th, p) : r.w);
      }
    }
    for (let j = 0; j < rings.length - 1; j++) for (let k = 0; k < seg; k++) {
      const a = base + j * (seg + 1) + k, b = a + 1, c = a + seg + 1, d = c + 1;
      g.i.push(a, c, b, b, c, d);
    }
    if (closeEnds) for (const [ri, flip] of [[0, true], [rings.length - 1, false]]) {
      const r = rings[ri], ci = this.vert(gi, r.c, [0.5, r.v], typeof r.w === 'function' ? r.w(0, r.c) : r.w);
      const rb = base + ri * (seg + 1);
      for (let k = 0; k < seg; k++) flip ? g.i.push(ci, rb + k, rb + k + 1) : g.i.push(ci, rb + k + 1, rb + k);
    }
  }
  // ellipsoid
  blob(gi, c, rx, ry, rz, w, seg = 14, uvFn = null, thOff = 0) {
    const g = this.g[gi], base = g.p.length / 3, rows = Math.max(6, seg >> 1);
    for (let j = 0; j <= rows; j++) {
      const ph = (j / rows) * Math.PI, sy = Math.cos(ph), sr = Math.sin(ph);
      for (let k = 0; k <= seg; k++) {
        const th = (k / seg) * TAU + thOff;
        const p = new THREE.Vector3(c.x + Math.sin(th) * sr * rx, c.y + sy * ry, c.z + Math.cos(th) * sr * rz);
        this.vert(gi, p, uvFn ? uvFn(k / seg, j / rows) : [k / seg, 1 - j / rows], typeof w === 'function' ? w(p) : w);
      }
    }
    for (let j = 0; j < rows; j++) for (let k = 0; k < seg; k++) {
      const a = base + j * (seg + 1) + k, b = a + 1, cc = a + seg + 1, d = cc + 1;
      g.i.push(a, cc, b, b, cc, d);
    }
  }
  build() {
    const geo = new THREE.BufferGeometry();
    const P = [], UV = [], SI = [], SW = [], I = [];
    let off = 0, ioff = 0;
    this.g.forEach((g, gi) => {
      P.push(...g.p); UV.push(...g.uv); SI.push(...g.si); SW.push(...g.sw);
      for (const k of g.i) I.push(k + off);
      geo.addGroup(ioff, g.i.length, gi);
      off += g.p.length / 3; ioff += g.i.length;
    });
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4));
    geo.setIndex(I);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  }
}

// groups: 0 skin, 1 lower garment, 2 upper garment, 3 head gear, 4 dark (hair bun, shoes)
const SKIN = 0, LOWER = 1, UPPER = 2, HEAD = 3, DARK = 4;

function buildBody(B, spec) {
  const sb = new SkinBuilder(5);
  const P = (n) => B.pos[n];
  const I = (n) => B.idx[n];
  const f = spec.female, bulk = spec.build;
  const one = (n) => [[I(n), 1]];
  const mixW = (a, b, t) => [[I(a), 1 - t], [I(b), t]];

  // ── torso: hips → neck, elliptical rings weighted along the spine
  const spine = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck'];
  const ys = spine.map((n) => P(n).y);
  const spineW = (y) => {
    if (y <= ys[0]) return one('Hips');
    for (let i = 0; i < ys.length - 1; i++) if (y <= ys[i + 1]) return mixW(spine[i], spine[i + 1], (y - ys[i]) / (ys[i + 1] - ys[i]));
    return one('Neck');
  };
  // half width / half depth profile by height (metres in bind space)
  const torsoProfile = (y) => {
    const hip = f ? 0.165 : 0.145, waist = f ? 0.12 : 0.13, chest = f ? 0.145 : 0.16, sh = f ? 0.145 : 0.17;
    let wx, dz;
    if (y < 1.04) { wx = hip; dz = 0.11; }
    else if (y < 1.16) { const t = (y - 1.04) / 0.12; wx = hip + (waist - hip) * t; dz = 0.11 - 0.01 * t; }
    else if (y < 1.33) { const t = (y - 1.16) / 0.17; wx = waist + (chest - waist) * sstep(0, 1, t); dz = 0.1 + 0.025 * Math.sin(t * Math.PI * 0.9) + (f ? 0.02 * Math.sin(t * Math.PI) : 0); }
    else if (y < 1.45) { const t = (y - 1.33) / 0.12; wx = chest + (sh - chest) * t; dz = 0.105 - 0.03 * t; }
    else { const t = Math.min(1, (y - 1.45) / 0.07); wx = sh * (1 - t) + 0.05 * t; dz = 0.075 * (1 - t) + 0.05 * t; }
    return [wx * bulk, dz * (0.85 + bulk * 0.15)];
  };
  const torsoRings = (gi, y0, y1, n, grow = 0, vOff = 0) => {
    const rings = [];
    for (let j = 0; j <= n; j++) {
      const y = y0 + (y1 - y0) * (j / n);
      const [wx, dz] = torsoProfile(y);
      const zc = P('Spine1').z * 0.5 + (y > 1.45 ? -0.02 : 0);
      rings.push({ c: new THREE.Vector3(0, y, zc), a: new THREE.Vector3(wx + grow, 0, 0), b: new THREE.Vector3(0, 0, dz + grow), w: spineW(y), v: vOff + (y - y0) / 1.2 });
    }
    return rings;
  };
  sb.loft(SKIN, torsoRings(SKIN, 0.9, 1.52, 16), 18, 1, true);
  // neck + head
  sb.loft(SKIN, [0, 1].map((t) => ({ c: P('Neck').clone().lerp(P('Head'), t).add(new THREE.Vector3(0, 0.02, 0.005)), a: new THREE.Vector3(0.048, 0, 0), b: new THREE.Vector3(0, 0, 0.05), w: t < 0.5 ? mixW('Neck', 'Head', 0.2) : one('Head'), v: 0.45 })), 12);
  const hc = P('Head').clone().add(new THREE.Vector3(0, 0.07, 0.014));
  // head uses the top half of the skin atlas; face (u = 0.5) points to +Z
  sb.blob(SKIN, hc, f ? 0.086 : 0.091, 0.118, 0.106, one('Head'), 22, (u, v) => [u, 1 - v * 0.5], Math.PI);
  // nose
  sb.blob(SKIN, hc.clone().add(new THREE.Vector3(0, -0.018, 0.1)), 0.011, 0.02, 0.01, one('Head'), 8, () => [0.5, 0.7]);

  // ── limbs
  const limb = (gi, a, b, ra, rb, n, wFn, vRange = [0, 0.4], seg = 12, uScale = 1) => {
    const A = P(a), Bp = P(b), dir = Bp.clone().sub(A).normalize();
    const ref = Math.abs(dir.y) > 0.7 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const ax = new THREE.Vector3().crossVectors(dir, ref).normalize(), bx = new THREE.Vector3().crossVectors(dir, ax).normalize();
    const rings = [];
    for (let j = 0; j <= n; j++) {
      const t = j / n, c = A.clone().lerp(Bp, t);
      const r = typeof ra === 'function' ? ra(t) : ra + (rb - ra) * t;
      rings.push({ c, a: ax.clone().multiplyScalar(r), b: bx.clone().multiplyScalar(r * (Math.abs(dir.y) > 0.7 ? 1 : 0.92)), w: wFn(t), v: vRange[0] + (vRange[1] - vRange[0]) * t });
    }
    sb.loft(gi, rings, seg, uScale);
  };
  const jointW = (parent, self, child) => (t) => {
    const w = [[I(self), 1]];
    if (parent && t < 0.18) { w[0][1] = 0.5 + t / 0.36; w.push([I(parent), 1 - w[0][1]]); }
    if (child && t > 0.82) { const k = (t - 0.82) / 0.36; w[0][1] = 1 - k; w.push([I(child), k]); }
    return w;
  };
  const armR = (f ? 0.042 : 0.05) * bulk, foreR = (f ? 0.035 : 0.04) * bulk;
  for (const s of ['Left', 'Right']) {
    // shoulder cap blending the torso into the arm
    sb.blob(SKIN, P(s + 'Arm').clone().add(new THREE.Vector3(0, -0.005, 0)), armR * 1.35, armR * 1.25, armR * 1.25, mixW(s + 'Shoulder', s + 'Arm', 0.6), 10, () => [0.2, 0.2]);
    limb(SKIN, s + 'Arm', s + 'ForeArm', (t) => armR * (1 + 0.12 * Math.sin(t * Math.PI)) - t * 0.006, 0, 8, jointW(s + 'Shoulder', s + 'Arm', s + 'ForeArm'));
    limb(SKIN, s + 'ForeArm', s + 'Hand', (t) => foreR * (1 + 0.15 * Math.sin(Math.min(1, t * 1.6) * Math.PI)) - t * 0.008, 0, 8, jointW(s + 'Arm', s + 'ForeArm', s + 'Hand'));
    // hand: flattened blob plus a thumb
    const hp = P(s + 'Hand'), sx = s === 'Left' ? 1 : -1;
    sb.blob(SKIN, hp.clone().add(new THREE.Vector3(sx * 0.045, -0.004, 0)), 0.06, 0.022, 0.042, one(s + 'Hand'), 10, () => [0.3, 0.1]);
    sb.blob(SKIN, P(s + 'HandThumb2'), 0.022, 0.012, 0.012, one(s + 'Hand'), 6, () => [0.3, 0.1]);
    // legs
    const thighR = (f ? 0.082 : 0.078) * bulk, calfR = 0.05 * bulk;
    limb(SKIN, s + 'UpLeg', s + 'Leg', (t) => thighR - t * 0.026, 0, 8, jointW('Hips', s + 'UpLeg', s + 'Leg'), [0, 0.4]);
    limb(SKIN, s + 'Leg', s + 'Foot', (t) => calfR * (1 + 0.18 * Math.sin(Math.min(1, t * 1.8) * Math.PI)) - t * 0.012, 0, 8, jointW(s + 'UpLeg', s + 'Leg', s + 'Foot'));
    // foot
    const fp = P(s + 'Foot'), tb = P(s + 'ToeBase'), te = P(s + 'Toe_End');
    const footRings = [
      [fp.z - 0.05, 0.035, 0.03, 0.045], [fp.z, 0.04, 0.042, 0.05], [tb.z - 0.02, 0.045, 0.028, 0.028], [tb.z + 0.04, 0.043, 0.02, 0.02], [te.z - 0.01, 0.03, 0.014, 0.014],
    ].map(([z, wx, hy, yc], i) => ({ c: new THREE.Vector3(fp.x, yc, z), a: new THREE.Vector3(wx, 0, 0), b: new THREE.Vector3(0, hy, 0), w: z > tb.z ? one(s + 'ToeBase') : one(s + 'Foot'), v: 0.05 + i * 0.01 }));
    sb.loft(spec.shoes ? DARK : SKIN, footRings, 10, 1, true);
  }

  // ── garments
  const legSide = (x) => sstep(-0.06, 0.06, x); // 0 → right leg, 1 → left leg
  // wrap skirt (mundu / lungi / saree): waist → hem, follows the legs by side
  const skirt = (gi, hemY, hemWidth = 0.22, flare = 1) => {
    const top = 1.06, rings = [];
    const n = 12;
    for (let j = 0; j <= n; j++) {
      const y = top - (top - hemY) * (j / n);
      const u = (top - y) / (top - 0.12);
      const wx = (torsoProfile(Math.max(y, 0.95))[0] + 0.012) * (1 - u) + hemWidth * u * flare * bulk;
      const dz = 0.125 * (1 - u) + 0.15 * u;
      rings.push({
        c: new THREE.Vector3(0, y, 0.01), a: new THREE.Vector3(wx, 0, 0), b: new THREE.Vector3(0, 0, dz), v: 1 - j / n,
        w: (th, p) => {
          const side = legSide(p.x), seg = u < 0.45 ? 'UpLeg' : 'Leg';
          const hips = Math.max(0.15, 1 - u * 1.4);
          return [[I('Hips'), hips], [I('Left' + seg), (1 - hips) * side], [I('Right' + seg), (1 - hips) * (1 - side)], [I(u < 0.45 ? 'Spine' : 'Hips'), 0.0001]];
        },
      });
    }
    sb.loft(gi, rings, 24, 2);
  };
  // trousers / shorts: two tubes
  const trousers = (gi, bottomT = 1) => {
    sb.loft(gi, torsoRings(gi, 0.86, 1.08, 3, 0.012), 18, 1);
    for (const s of ['Left', 'Right']) {
      limb(gi, s + 'UpLeg', s + 'Leg', (t) => 0.092 * bulk - t * 0.022, 0, 6, jointW('Hips', s + 'UpLeg', s + 'Leg'), [0, 0.5], 12);
      if (bottomT > 1) limb(gi, s + 'Leg', s + 'Foot', (t) => 0.064 * bulk - t * 0.01, 0, 6, jointW(s + 'UpLeg', s + 'Leg', s + 'Foot'), [0.5, 1], 12);
    }
  };
  const shirt = (gi, sleeve = 0.5, hemY = 0.92, collar = false) => {
    sb.loft(gi, torsoRings(gi, hemY, 1.5, 14, 0.014), 18, 2, false);
    for (const s of ['Left', 'Right']) {
      sb.blob(gi, P(s + 'Arm').clone().add(new THREE.Vector3(0, -0.004, 0)), armR * 1.45, armR * 1.4, armR * 1.4, mixW(s + 'Shoulder', s + 'Arm', 0.6), 10, () => [0.2, 0.9]);
      limb(gi, s + 'Arm', s + 'ForeArm', (t) => armR * 1.25 + 0.006 - (sleeve < 0.4 ? 0 : t * 0.004), 0, 6, jointW(s + 'Shoulder', s + 'Arm', s + 'ForeArm'), [0.6, 1], 12);
      if (sleeve > 1) limb(gi, s + 'ForeArm', s + 'Hand', (t) => foreR * 1.3 - t * 0.004, 0, 6, jointW(s + 'Arm', s + 'ForeArm', s + 'Hand'), [0.6, 1], 12);
    }
    if (collar) sb.loft(gi, [0, 1].map((t) => ({ c: P('Neck').clone().add(new THREE.Vector3(0, 0.0 + t * 0.03, 0)), a: new THREE.Vector3(0.062, 0, 0), b: new THREE.Vector3(0, 0, 0.064), w: mixW('Spine2', 'Neck', 0.6), v: 0.95 })), 14);
  };
  const ribbon = (gi, pts, width, wFn) => {
    // a flat cloth band along a path (thorthu over the shoulder, saree pallu)
    const rings = pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const t = V3(b).sub(V3(a)).normalize(), out = new THREE.Vector3(p[0], 0, p[2]).normalize();
      const side = new THREE.Vector3().crossVectors(t, out).normalize().multiplyScalar(width / 2);
      return { c: V3(p), a: side, b: out.multiplyScalar(0.006), w: wFn(V3(p)), v: i / (pts.length - 1) };
    });
    sb.loft(gi, rings, 4, 1);
  };
  const upperW = (p) => (p.y > 1.38 ? (p.x > 0 ? mixW('Spine2', 'LeftShoulder', 0.5) : mixW('Spine2', 'RightShoulder', 0.5)) : spineW(p.y));

  const o = spec.outfit;
  if (o.lower === 'mundu') skirt(LOWER, o.short ? 0.52 : 0.1, o.short ? 0.175 : 0.165);
  if (o.lower === 'saree') skirt(LOWER, 0.07, 0.19, 1.0);
  if (o.lower === 'shorts') trousers(LOWER, 1);
  if (o.lower === 'trousers') trousers(LOWER, 2);
  if (o.upper === 'jubba') shirt(UPPER, 0.6, 0.78);
  if (o.upper === 'shirt') shirt(UPPER, 0.6, 0.92);
  if (o.upper === 'coat') shirt(UPPER, 2, 0.82);
  if (o.upper === 'blouse') shirt(UPPER, 0.3, 1.2, false);
  if (o.thorthu) {
    // towel draped over the left shoulder, front and back
    const zf = 0.14, zb = -0.13;
    ribbon(UPPER, [[0.06, 1.2, zf], [0.1, 1.36, zf - 0.01], [0.13, 1.47, 0.04], [0.13, 1.49, -0.04], [0.1, 1.36, zb], [0.07, 1.18, zb + 0.01]], 0.12, upperW);
  }
  if (o.pallu) {
    // saree end drawn up from the right hip across the chest, over the left shoulder, down the back
    ribbon(LOWER, [[-0.17, 1.02, 0.12], [-0.08, 1.18, 0.15], [0.05, 1.32, 0.15], [0.13, 1.47, 0.05], [0.13, 1.48, -0.06], [0.12, 1.3, -0.13], [0.1, 1.0, -0.14]], 0.2, upperW);
  }
  // head gear
  if (o.head === 'turban' || o.head === 'cloth') {
    const big = o.head === 'turban';
    sb.loft(HEAD, [0, 0.5, 1].map((t) => ({ c: hc.clone().add(new THREE.Vector3(0, 0.03 + t * (big ? 0.07 : 0.04), -0.005)), a: new THREE.Vector3((0.092 + (big ? 0.012 : 0)) * (1 - t * 0.25), 0, 0), b: new THREE.Vector3(0, 0, (0.105 + (big ? 0.012 : 0)) * (1 - t * 0.25)), w: one('Head'), v: t })), 16, 3, true);
  }
  if (o.head === 'helmet') {
    sb.blob(HEAD, hc.clone().add(new THREE.Vector3(0, 0.05, 0)), 0.11, 0.09, 0.125, one('Head'), 16, (u, v) => [u, v]);
    sb.loft(HEAD, [0, 1].map((t) => ({ c: hc.clone().add(new THREE.Vector3(0, 0.03, 0)), a: new THREE.Vector3(0.11 + t * 0.06, 0, 0), b: new THREE.Vector3(0, 0, 0.125 + t * 0.07), w: one('Head'), v: t })), 18, 1);
  }
  if (o.head === 'cap') sb.loft(HEAD, [0, 1].map((t) => ({ c: hc.clone().add(new THREE.Vector3(0, 0.055 + t * 0.03, 0)), a: new THREE.Vector3(0.09, 0, 0), b: new THREE.Vector3(0, 0, 0.1), w: one('Head'), v: t })), 14, 1, true);
  if (o.head === 'palmhat') {
    // conical palm-leaf hat (kuda)
    const tip = hc.clone().add(new THREE.Vector3(0, 0.2, 0));
    sb.loft(HEAD, [0, 1].map((t) => ({ c: tip.clone().lerp(hc.clone().add(new THREE.Vector3(0, 0.06, 0)), t), a: new THREE.Vector3(0.001 + t * 0.26, 0, 0), b: new THREE.Vector3(0, 0, 0.001 + t * 0.26), w: one('Head'), v: t })), 18, 2);
  }
  if (f && !o.head) sb.blob(DARK, hc.clone().add(new THREE.Vector3(0, -0.02, -0.11)), 0.05, 0.045, 0.04, one('Head'), 10); // hair bun
  return sb.build();
}

// ── outfits ─────────────────────────────────────────────────────────────────
const TONES = [[150, 98, 66], [128, 82, 54], [112, 70, 46], [168, 114, 78], [96, 60, 40], [182, 132, 96]];
const CLOTH = { white: [236, 230, 214], cream: [226, 212, 182], gold: [196, 152, 64], khaki: [168, 146, 102], indigo: [44, 58, 96], red: [150, 36, 30], green: [44, 96, 60], saffron: [214, 132, 42], maroon: [112, 30, 40], blue: [48, 86, 140], black: [30, 26, 24], brown: [96, 64, 42] };
export const ROLES = {
  traveller: { outfit: { lower: 'mundu', upper: 'jubba', thorthu: true }, lowerTex: ['kasavu', 'white', 'gold'], upperTex: ['plain', 'cream'], headTex: ['plain', 'white'], moustache: true },
  villager: { outfit: { lower: 'mundu', thorthu: true }, lowerTex: ['kasavu', 'white', 'gold'], upperTex: ['plain', 'white'], moustache: 0.7 },
  trader: { outfit: { lower: 'mundu', upper: 'jubba', head: 'cloth' }, lowerTex: ['plain', 'cream'], upperTex: ['stripe', 'white', 'brown'], headTex: ['plain', 'white'], moustache: 0.9, chandan: 0.5 },
  fisher: { outfit: { lower: 'mundu', short: true, head: 'cloth' }, lowerTex: ['check', 'blue', 'white'], headTex: ['check', 'red', 'white'], moustache: 0.6 },
  farmer: { outfit: { lower: 'mundu', short: true, head: 'palmhat' }, lowerTex: ['plain', 'cream'], headTex: ['plain', 'cream'], moustache: 0.5 },
  official: { outfit: { lower: 'shorts', upper: 'shirt', head: 'cap' }, lowerTex: ['plain', 'khaki'], upperTex: ['plain', 'khaki'], headTex: ['plain', 'red'], moustache: 1, shoes: true },
  colonial: { outfit: { lower: 'trousers', upper: 'coat', head: 'helmet' }, lowerTex: ['plain', 'white'], upperTex: ['plain', 'white'], headTex: ['plain', 'cream'], moustache: 0.8, shoes: true, pale: true },
  pilgrim: { outfit: { lower: 'mundu', thorthu: true }, lowerTex: ['plain', 'saffron'], upperTex: ['plain', 'saffron'], beard: 0.6, chandan: 1 },
  woman: { female: true, outfit: { lower: 'saree', upper: 'blouse', pallu: true }, lowerTex: ['saree', 'green', 'gold'], upperTex: ['plain', 'maroon'], bindi: 1 },
  setmundu: { female: true, outfit: { lower: 'mundu', upper: 'blouse', pallu: true }, lowerTex: ['kasavu', 'white', 'gold'], upperTex: ['plain', 'white'], bindi: 1 },
};
const SAREE_COLORS = ['green', 'maroon', 'blue', 'saffron', 'red', 'indigo'];

export class HumanFactory {
  constructor(gltf) {
    this.gltf = gltf;
    this.geoCache = new Map(); this.matCache = new Map();
    // bind pose of the template skeleton
    let sk = null, mesh = null;
    gltf.scene.traverse((o) => { if (o.isSkinnedMesh && !sk) { sk = o.skeleton; mesh = o; } });
    this.bones = { pos: {}, idx: {} };
    sk.bones.forEach((b, i) => {
      const m = sk.boneInverses[i].clone().invert();
      const n = b.name.replace('mixamorig', '');
      this.bones.pos[n] = new THREE.Vector3().setFromMatrixPosition(m);
      this.bones.idx[n] = i;
    });
    this.templateMeshName = mesh.name;
  }

  // spec: role + seed → appearance
  spec(role, seed) {
    const R = ROLES[role] || ROLES.villager, rnd = makeRng(seed * 7919 + 13);
    const chance = (v) => (v === true ? true : typeof v === 'number' ? rnd() < v : false);
    const tone = R.pale ? [214, 176, 150] : TONES[Math.floor(rnd() * TONES.length)];
    const lowerTex = R.lowerTex.slice();
    if (role === 'woman') lowerTex[1] = SAREE_COLORS[Math.floor(rnd() * SAREE_COLORS.length)];
    if (role === 'villager' && rnd() < 0.3) { lowerTex[0] = 'plain'; lowerTex[1] = 'cream'; }
    return {
      role, female: !!R.female, outfit: R.outfit, shoes: !!R.shoes,
      build: R.female ? 0.95 + rnd() * 0.1 : 0.92 + rnd() * 0.2,
      height: (R.female ? 0.93 : 0.97) + rnd() * 0.07,
      tone, lowerTex, upperTex: R.upperTex || ['plain', 'white'], headTex: R.headTex || ['plain', 'white'],
      face: { female: !!R.female, moustache: !R.female && chance(R.moustache), beard: chance(R.beard), bindi: chance(R.bindi), chandan: chance(R.chandan), grey: rnd() < 0.15, bald: !R.female && rnd() < 0.08 },
      faceSeed: Math.floor(rnd() * 6),
    };
  }

  materials(s) {
    const key = JSON.stringify([s.tone, s.face, s.faceSeed, s.lowerTex, s.upperTex, s.headTex]);
    if (this.matCache.has(key)) return this.matCache.get(key);
    const std = (map, rough = 0.85, extra = {}) => new THREE.MeshStandardNodeMaterial({ map, roughness: rough, metalness: 0, ...extra });
    const tex = (spec, seed) => clothTexture(spec[0], CLOTH[spec[1]] || CLOTH.white, CLOTH[spec[2]] || CLOTH.gold, seed);
    const mats = [
      std(skinTexture(s.tone, s.face, s.faceSeed + 1), 0.6),
      std(tex(s.lowerTex, 3), 0.9, { side: THREE.DoubleSide }),
      std(tex(s.upperTex, 5), 0.9, { side: THREE.DoubleSide }),
      std(tex(s.headTex, 7), 0.85, { side: THREE.DoubleSide }),
      new THREE.MeshStandardNodeMaterial({ color: 0x1c1612, roughness: 0.7 }),
    ];
    this.matCache.set(key, mats);
    return mats;
  }

  geometry(s) {
    const key = JSON.stringify([s.role, s.female, s.outfit, s.shoes, Math.round(s.build * 20)]);
    if (!this.geoCache.has(key)) this.geoCache.set(key, buildBody(this.bones, { ...s, build: Math.round(s.build * 20) / 20 }));
    return this.geoCache.get(key);
  }

  // A posable person: returns the cloned rig with the custom skinned mesh in place of the mannequin.
  create(role, seed = 1) {
    const s = this.spec(role, seed);
    const root = skeletonClone(this.gltf.scene);
    let tpl = null;
    const drop = [];
    root.traverse((o) => { if (o.isSkinnedMesh) { if (!tpl) tpl = o; drop.push(o); } });
    const mesh = new THREE.SkinnedMesh(this.geometry(s), this.materials(s));
    mesh.name = 'person';
    tpl.parent.add(mesh);
    mesh.position.copy(tpl.position); mesh.quaternion.copy(tpl.quaternion); mesh.scale.copy(tpl.scale);
    mesh.bind(tpl.skeleton, tpl.bindMatrix);
    for (const o of drop) o.parent.remove(o);
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
    root.scale.setScalar(s.height);
    root.userData.spec = s; root.userData.mesh = mesh;
    root.userData.bones = Object.fromEntries(tpl.skeleton.bones.map((b) => [b.name.replace('mixamorig', ''), b]));
    return root;
  }
}
