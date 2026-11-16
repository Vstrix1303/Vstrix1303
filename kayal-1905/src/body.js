// The human figure: one skinned surface built from anatomical cross-sections.
// Realistic proportions (about seven and a half heads tall), a face with real
// relief — brow, eye sockets, nose, lips, chin — shaped limbs, hands with a
// thumb and a finger joint, feet with a toe joint, and a 24-bone skeleton.
import { SGB } from './geo.js';
import { clamp, lerp, smoothstep } from './util.js';

// ---- atlas layout (512 x 512)
export const R_HEAD = [0, 0, 256, 192], R_TORSO = [0, 192, 256, 448], R_ARM = [256, 0, 384, 256], R_LEG = [384, 0, 512, 256];
export const R_SKIRT = [256, 256, 512, 448], R_HAND = [2, 450, 62, 510], R_FOOT = [66, 450, 126, 510], R_CLOTH = [130, 450, 190, 510];

// ---- bones
export const B = {
  hips: 0, spine: 1, chest: 2, neck: 3, head: 4,
  clavL: 5, armL: 6, foreL: 7, handL: 8, fingL: 9,
  clavR: 10, armR: 11, foreR: 12, handR: 13, fingR: 14,
  thighL: 15, shinL: 16, footL: 17, toeL: 18,
  thighR: 19, shinR: 20, footR: 21, toeR: 22,
  hem: 23,
};
// rest pose (metres; each entry is the offset from the parent joint)
export const RIG = {
  hipY: 0.94, spine: 0.09, chest: 0.21, neck: [0, 0.225, -0.005], head: [0, 0.085, 0.005],
  clavY: 0.195, clavX: 0.03, upper: 0.285, fore: 0.265, knuckle: 0.07,
  hipX: 0.09, hipDrop: 0.02, thigh: 0.44, shin: 0.41, toe: [0, -0.05, 0.115], ankle: 0.07, hem: -0.56,
  shoulderX: (fem) => (fem ? 0.158 : 0.178),
};

const G = (x, s) => Math.exp(-(x * x) / (2 * s * s));
const wrap = (th) => { let a = th % (Math.PI * 2); if (a > Math.PI) a -= Math.PI * 2; if (a < -Math.PI) a += Math.PI * 2; return a; };

// relief of the face in metres, at angle a from straight ahead and height y
function faceRelief(a, y, fem) {
  const A = Math.abs(a);
  let d = 0;
  if (y > 1.624 && y < 1.688) {                                   // the nose: narrow root, broad tip
    const t = clamp((1.688 - y) / (1.688 - 1.636), 0, 1);
    const h = y >= 1.636 ? 0.004 + 0.021 * Math.pow(t, 1.3) : 0.025 * (y - 1.624) / 0.012;
    d += h * (fem ? 0.8 : 1) * G(a, 0.07 + 0.075 * t);
  }
  d += 0.004 * G(A - 0.17, 0.06) * G(y - 1.634, 0.006);            // wings of the nostrils
  d += (fem ? 0.0015 : 0.0046) * G(y - 1.691, 0.007) * G(A - 0.38, 0.42);   // brow ridge
  d -= 0.0078 * G(A - 0.37, 0.16) * G(y - 1.670, 0.009);           // eye sockets
  d += 0.0036 * G(A - 0.37, 0.085) * G(y - 1.669, 0.0045);         // … and the eyeballs in them
  d += 0.0042 * G(A - 0.8, 0.28) * G(y - 1.648, 0.013);            // cheekbones
  d -= 0.0012 * G(A - 0.75, 0.3) * G(y - 1.606, 0.014);            // hollow of the cheek
  d += 0.0048 * G(a, 0.26) * G(y - 1.601, 0.0045);                 // upper lip
  d += 0.0042 * G(a, 0.22) * G(y - 1.588, 0.0045);                 // lower lip
  d -= 0.002 * G(a, 0.3) * G(y - 1.5945, 0.002);
  d -= 0.003 * G(a, 0.25) * G(y - 1.580, 0.004);
  d += (fem ? 0.003 : 0.006) * G(a, 0.3) * G(y - 1.566, 0.009);    // chin
  d += (fem ? 0.001 : 0.003) * G(A - 1.15, 0.25) * G(y - 1.59, 0.015);   // angle of the jaw
  d -= 0.003 * G(A - 1.05, 0.25) * G(y - 1.695, 0.02);             // temples
  return d;
}

// skull profile: y, half-width, depth to the front, depth to the back
const SKULL = [
  [1.500, 0.052, 0.050, 0.056], [1.520, 0.053, 0.051, 0.058], [1.538, 0.054, 0.056, 0.062], [1.551, 0.050, 0.070, 0.066],
  [1.560, 0.051, 0.081, 0.069], [1.567, 0.053, 0.087, 0.071], [1.578, 0.061, 0.091, 0.076], [1.594, 0.067, 0.093, 0.082],
  [1.608, 0.070, 0.094, 0.086], [1.622, 0.072, 0.094, 0.090], [1.634, 0.0735, 0.094, 0.093], [1.646, 0.0745, 0.0945, 0.095],
  [1.658, 0.0752, 0.094, 0.097], [1.669, 0.0757, 0.0935, 0.098], [1.681, 0.0755, 0.094, 0.099], [1.693, 0.0765, 0.0955, 0.099],
  [1.708, 0.077, 0.095, 0.098], [1.724, 0.0755, 0.091, 0.096], [1.741, 0.0705, 0.083, 0.090], [1.756, 0.061, 0.070, 0.080], [1.769, 0.046, 0.050, 0.060],
];
const HEAD_Y = [1.500, 1.520, 1.538, 1.551, 1.560, 1.567, 1.574, 1.581, 1.588, 1.5945, 1.601, 1.609, 1.618, 1.626, 1.631, 1.636, 1.643, 1.652, 1.661, 1.669, 1.677, 1.684, 1.691, 1.700, 1.712, 1.726, 1.741, 1.756, 1.769];
export function skullAt(y) {
  for (let i = 1; i < SKULL.length; i++) if (y <= SKULL[i][0]) { const a = SKULL[i - 1], b = SKULL[i], t = (y - a[0]) / (b[0] - a[0]); return [lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)]; }
  const l = SKULL[SKULL.length - 1]; return [l[1], l[2], l[3]];
}
// width of the head at ear level, for placing ears and hats
export function headScale(o) { return (o.female ? 0.97 : 1.0) * (o.child ? 1.16 : 1); }

const geoCache = new Map();
export function bodyGeometry(o) {
  const fem = !!o.female, belly = !!o.belly, skirt = o.trousers == null, long = !!o.munduLong;
  const shirtOver = o.shirt != null && o.style !== 'blouse';
  const bk = (o.build ?? 1) * (fem ? 0.98 : 1.03), mus = o.muscle ? 1.25 : 1;
  const key = [fem, belly, skirt, long, shirtOver, o.boots != null, !!o.shoulderCloth, o.style === 'frock', bk, !!o.child, mus].join('|');
  if (geoCache.has(key)) return geoCache.get(key);
  const g = new SGB(512);
  const sw = fem ? 0.88 : 1, SX = RIG.shoulderX(fem);

  // ---------------- torso: a rounded box, not a tube — chest, waist, pelvis, the slope of the trapezius
  const torsoMod = (y, rx, zf, zb) => (th) => {
    const a = wrap(th), s = Math.sin(th), c = Math.cos(th), ab = Math.PI - Math.abs(a);
    const n = y > 1.44 ? 2 : y > 1.18 ? 2.5 : y > 1.0 ? 2.2 : 2.45;
    const m = 1 / Math.pow(Math.pow(Math.abs(s), n) + Math.pow(Math.abs(c), n), 1 / n);
    let d = 0;
    if (y < 1.44) {
      if (!fem) { d += 0.009 * mus * G(Math.abs(a) - 0.5, 0.3) * G(y - 1.30, 0.045); if (y > 1.05 && y < 1.4) d -= 0.004 * G(a, 0.1); }
      else d += 0.024 * G(Math.abs(a) - 0.45, 0.28) * G(y - 1.295, 0.04);
      if (y > 0.98 && y < 1.42) d -= 0.006 * G(ab, 0.12);                    // furrow of the spine
      d += 0.006 * G(ab - 0.55, 0.25) * G(y - 1.34, 0.05);                    // shoulder blades
      d += (fem ? 0.016 : 0.011) * G(ab - 0.5, 0.3) * G(y - 0.9, 0.05);       // buttocks
    }
    const r = Math.hypot(rx * s, (c >= 0 ? zf : zb) * c) || 1;
    return m * (1 + d / r);
  };
  const T = [
    // y, half-width, front, back, weights
    [0.86, 0.118, 0.086, 0.096, [[B.hips, 1]]],
    [0.90, fem ? 0.174 : 0.164, 0.100, 0.114, [[B.hips, 1]]],
    [0.95, fem ? 0.178 : 0.168, 0.102, 0.112, [[B.hips, 1]]],
    [1.00, fem ? 0.158 : 0.158, 0.100, 0.100, [[B.hips, 0.6], [B.spine, 0.4]]],
    [1.06, fem ? 0.126 : 0.142, 0.095, 0.090, [[B.spine, 1]]],
    [1.13, fem ? 0.130 : 0.147, 0.100, 0.092, [[B.spine, 0.8], [B.chest, 0.2]]],
    [1.21, 0.158 * sw, fem ? 0.112 : 0.108, 0.098, [[B.spine, 0.4], [B.chest, 0.6]]],
    [1.29, 0.168 * sw, 0.118, 0.104, [[B.chest, 1]]],
    [1.36, 0.172 * sw, 0.116, 0.108, [[B.chest, 1]]],
    [1.41, 0.164 * sw, 0.100, 0.104, [[B.chest, 1]]],
    [1.445, 0.136 * sw, 0.080, 0.090, [[B.chest, 0.8], [B.neck, 0.2]]],
    [1.475, 0.080, 0.060, 0.066, [[B.chest, 0.5], [B.neck, 0.5]]],
    [1.500, 0.052, 0.050, 0.056, [[B.neck, 1]]],
  ];
  const nkS = fem ? 0.9 : 1;
  const tr = [];
  const torsoAt = [];          // [y, rx, zf, zb] after scaling, for cloth that lies on it
  for (const [y, rx0, zf0, zb0, w] of T) {
    let rx = rx0, zf = zf0, zb = zb0;
    if (belly && y > 0.88 && y < 1.2) { const k = Math.max(0, 1 - Math.abs(y - 1.05) / 0.17); zf += 0.055 * k; rx += 0.018 * k; }
    if (shirtOver && y < 1.0) { rx += 0.024; zf += 0.034; zb += 0.03; }
    const k = y >= 1.5 ? nkS : y > 1.46 ? lerp(bk, nkS, (y - 1.46) / 0.04) : bk;
    rx *= k; zf *= k; zb *= k;
    torsoAt.push([y, rx, zf, zb]);
    tr.push({ c: [0, y, 0.002], ax: [rx, 0, 0], az: [0, 0, zf], azB: [0, 0, zb], w, v: Math.max(0, (1.49 - y) / 0.69), mod: torsoMod(y, rx, zf, zb) });
  }
  if (shirtOver) {
    const hem = o.style === 'frock' ? 0.66 : 0.80;
    tr[0] = { c: [0, hem, 0.002], ax: [0.2, 0, 0], az: [0, 0, 0.152], azB: [0, 0, 0.15], w: [[B.hips, 1]], v: 1 };
    if (o.style === 'frock') tr.splice(1, 0, { c: [0, 0.84, 0.002], ax: [0.198, 0, 0], az: [0, 0, 0.15], azB: [0, 0, 0.148], w: [[B.hips, 1]], v: 0.94 });
    g.loft(tr, 20, R_TORSO, {});
  } else g.loft(tr, 20, R_TORSO, { capStart: 0.01 });

  // ---------------- head: columns crowded toward the face so the features have real shape
  const hs = headScale(o), yTop = 1.776, yBot = 1.49, HSEG = 32;
  const tOf = (k) => { const s = k / HSEG; return s + (0.6 / (Math.PI * 2)) * Math.sin(Math.PI * 2 * s); };
  g.loft(HEAD_Y.map((y) => {
    const [rx0, zf0, zb0] = skullAt(y);
    const k = lerp(nkS, hs, smoothstep(1.52, 1.56, y)) * (fem && y < 1.61 && y > 1.55 ? 0.95 : 1);
    const rx = rx0 * k, zf = zf0 * k, zb = zb0 * k;
    const w = y <= 1.501 ? [[B.neck, 1]] : y <= 1.521 ? [[B.neck, 0.75], [B.head, 0.25]] : y <= 1.539 ? [[B.neck, 0.4], [B.head, 0.6]] : [[B.head, 1]];
    return {
      c: [0, y, 0.004], ax: [rx, 0, 0], az: [0, 0, zf], azB: [0, 0, zb], w, v: clamp((yTop - y) / (yTop - yBot), 0, 1),
      mod: y < 1.545 ? null : (th) => { const a = wrap(th), s = Math.sin(th), c = Math.cos(th); return 1 + faceRelief(a, y, fem) * hs / (Math.hypot(rx * s, (c >= 0 ? zf : zb) * c) || 1); },
    };
  }), HSEG, R_HEAD, { capEnd: 0.013, tOf });

  // ---------------- arms: deltoid, biceps, the taper to the wrist
  const ak = (fem ? 0.88 : 1.0) * (o.build ?? 1) * (o.muscle ? 1.05 : 1);
  for (const s of [-1, 1]) {
    const cl = s < 0 ? B.clavL : B.clavR, up = s < 0 ? B.armL : B.armR, fo = s < 0 ? B.foreL : B.foreR, ha = s < 0 ? B.handL : B.handR, fi = s < 0 ? B.fingL : B.fingR;
    const A = [
      // y, lateral radius, depth radius, forward offset, weights
      [1.474, 0.016, 0.024, 0, [[B.chest, 0.5], [cl, 0.5]]],
      [1.463, 0.034, 0.042, 0, [[cl, 0.6], [up, 0.4]]],
      [1.44, 0.048, 0.055, 0, [[cl, 0.3], [up, 0.7]]],
      [1.40, 0.055, 0.060, 0, [[B.chest, 0.1], [up, 0.9]]],
      [1.35, 0.050, 0.055, 0.002, [[up, 1]]],
      [1.29, 0.045, 0.052, 0.005, [[up, 1]]],
      [1.22, 0.041, 0.046, 0.003, [[up, 1]]],
      [1.18, 0.037, 0.041, 0, [[up, 0.7], [fo, 0.3]]],
      [1.15, 0.036, 0.040, -0.002, [[up, 0.5], [fo, 0.5]]],
      [1.125, 0.039, 0.043, 0, [[up, 0.25], [fo, 0.75]]],
      [1.09, 0.042, 0.046, 0.003, [[fo, 1]]],
      [1.02, 0.037, 0.040, 0.002, [[fo, 1]]],
      [0.95, 0.029, 0.031, 0, [[fo, 1]]],
      [0.905, 0.021, 0.027, 0, [[fo, 0.7], [ha, 0.3]]],
    ];
    const xAt = (y) => s * (y > 1.435 ? SX - (y - 1.435) * 0.55 : SX + 0.029 * clamp((1.435 - y) / 0.55, 0, 1.1));
    g.loft(A.map(([y, rx, rz, cz, w]) => ({ c: [xAt(y), y, 0.002 + cz], ax: [rx * ak, 0, 0], az: [0, 0, rz * ak], w, v: (1.475 - y) / (1.475 - 0.752) })), 12, R_ARM, { capStart: 0.004, capEnd: 0.004, mirrorU: s > 0 });
    // the hand: palm toward the thigh, four fingers that bend together, a thumb
    const hk = (fem ? 0.9 : 1) * (o.child ? 1.1 : 1);
    const H = [
      [0.902, 0.019, 0.026, 0, [[ha, 1]]], [0.875, 0.016, 0.036, 0.004, [[ha, 1]]], [0.845, 0.015, 0.043, 0.004, [[ha, 1]]],
      [0.815, 0.013, 0.043, 0.003, [[ha, 0.5], [fi, 0.5]]], [0.790, 0.011, 0.041, 0.002, [[fi, 1]]], [0.760, 0.010, 0.037, 0.001, [[fi, 1]]],
      [0.735, 0.008, 0.030, 0, [[fi, 1]]], [0.722, 0.006, 0.020, 0, [[fi, 1]]],
    ];
    g.loft(H.map(([y, tx, wz, cz, w], i) => ({ c: [xAt(0.885), y, 0.002 + cz * hk], ax: [tx * hk, 0, 0], az: [0, 0, wz * hk], w, v: i / (H.length - 1) })), 10, R_HAND, { capEnd: 0.004, mirrorU: s > 0 });
    const TH = [[0.868, 0.034, 0.0125], [0.836, 0.055, 0.0115], [0.808, 0.064, 0.0085]];
    g.loft(TH.map(([y, z, r], i) => ({ c: [xAt(0.885) - s * 0.004 * (i + 1), y, 0.002 + z * hk], ax: [r * hk, 0, 0], az: [0, 0, r * hk], w: [[ha, 1]], v: 0.1 + i * 0.2 })), 6, R_HAND, { capStart: 0.003, capEnd: 0.006 });
  }

  // ---------------- legs & feet: thigh, knee, the belly of the calf, ankle; heel, arch and toes
  const legFrom = skirt ? (long ? 0.19 : 0.61) : 1;
  for (const s of [-1, 1]) {
    const th = s < 0 ? B.thighL : B.thighR, sh = s < 0 ? B.shinL : B.shinR, ft = s < 0 ? B.footL : B.footR, to = s < 0 ? B.toeL : B.toeR;
    const tk = (o.trousers != null ? 1.14 : (fem ? 0.97 : 1.03)) * (o.build ?? 1), bt = o.boots != null ? 1.2 : 1;
    const L = [
      [0.96, 0.078, 0.090, 0.092, [[B.hips, 0.7], [th, 0.3]]],
      [0.90, 0.086, 0.094, 0.098, [[B.hips, 0.3], [th, 0.7]]],
      [0.82, 0.080, 0.088, 0.090, [[th, 1]]],
      [0.72, 0.072, 0.080, 0.080, [[th, 1]]],
      [0.62, 0.063, 0.068, 0.066, [[th, 1]]],
      [0.54, 0.055, 0.058, 0.056, [[th, 0.8], [sh, 0.2]]],
      [0.50, 0.052, 0.058, 0.052, [[th, 0.5], [sh, 0.5]]],
      [0.46, 0.050, 0.052, 0.054, [[th, 0.2], [sh, 0.8]]],
      [0.40, 0.051, 0.048, 0.063, [[sh, 1]]],
      [0.33, 0.049, 0.046, 0.064, [[sh, 1]]],
      [0.24, 0.040, 0.040, 0.049, [[sh, 1]]],
      [0.15, 0.033 * bt, 0.035 * bt, 0.037 * bt, [[sh, 1]]],
      [0.09, 0.031 * bt, 0.034 * bt, 0.035 * bt, [[sh, 0.6], [ft, 0.4]]],
    ].filter((r) => r[0] <= legFrom);
    if (L.length >= 2) g.loft(L.map(([y, rx, zf, zb, w]) => ({ c: [s * RIG.hipX, y, 0], ax: [rx * tk, 0, 0], az: [0, 0, zf * tk], azB: [0, 0, zb * tk], w, v: (0.96 - y) / (0.96 - 0.085) })), 12, R_LEG, { mirrorU: s > 0 });
    const F = [
      [-0.064, 0.034, 0.026, 0.034, [[ft, 1]]], [-0.03, 0.043, 0.032, 0.043, [[ft, 1]]], [0.02, 0.046, 0.034, 0.046, [[ft, 1]]],
      [0.07, 0.034, 0.039, 0.034, [[ft, 1]]], [0.115, 0.024, 0.045, 0.024, [[ft, 0.5], [to, 0.5]]], [0.155, 0.017, 0.044, 0.017, [[to, 1]]], [0.186, 0.013, 0.036, 0.013, [[to, 1]]],
    ];
    g.loft(F.map(([z, cy, rx, ry, w], i) => ({ c: [s * RIG.hipX, cy * bt, z * bt], ax: [rx * bt, 0, 0], az: [0, ry * bt, 0], w, v: i / (F.length - 1) })), 10, R_FOOT, { capStart: 0.012, capEnd: 0.012 });
  }

  // ---------------- mundu (wrap-around waist cloth); its hem hangs from a bone of its own so it can swing
  if (skirt) {
    const up = shirtOver ? 0.94 : 1, sk = fem ? 1.0 : 1.02;
    const S = [
      [1.02, 0.156 * up, 0.106 * up, 0, 0, 0],
      [0.93, 0.180 * up, 0.126 * up, 0.25, 0, 0],
      [0.82, 0.186, 0.132, 0.65, 0, 0],
      [0.68, 0.188, 0.136, 1, 0, 0.12],
      [0.55, 0.192, 0.140, 1, 0, long ? 0.2 : 0.4],
    ];
    if (long) S.push([0.42, 0.190, 0.138, 0.5, 0.5, 0], [0.28, 0.186, 0.135, 0, 1, 0.4], [0.115, 0.192, 0.14, 0, 1, 0.55]);
    const yb = S[S.length - 1][0];
    g.loft(S.map(([y, rx, rz, wt, ws, wh]) => ({
      c: [0, y, 0.004], ax: [rx * sk * (fem ? 1.04 : 1), 0, 0], az: [0, 0, rz * sk], v: (1.02 - y) / (1.02 - yb),
      w: (th, p) => {
        const l = 0.5 - 0.5 * clamp(p[0] / (0.34 * rx), -1, 1);       // 1 = left (-x)
        const out = [], hip = 1 - wt - ws, k = 1 - wh;
        if (hip > 0.001) out.push([B.hips, hip]);
        if (wt > 0) out.push([B.thighL, wt * l * k], [B.thighR, wt * (1 - l) * k]);
        if (ws > 0) out.push([B.shinL, ws * l * k], [B.shinR, ws * (1 - l) * k]);
        if (wh > 0) out.push([B.hem, wh]);
        return out.filter((e) => e[1] > 0.001).sort((a, b) => b[1] - a[1]).slice(0, 4);
      },
    })), 18, R_SKIRT, {});
  }

  // ---------------- folded cloth over the left shoulder
  if (o.shoulderCloth != null) {
    const pts = [[0.120, 1.12], [0.128, 1.30], [0.100, 1.405], [0.048, 1.466], [-0.018, 1.478], [-0.074, 1.452], [-0.114, 1.33], [-0.106, 1.14]];
    g.loft(pts.map(([z, y], i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let ty = b[1] - a[1], tz = b[0] - a[0]; const l = Math.hypot(ty, tz) || 1; ty /= l; tz /= l;
      return { c: [0.098 * sw, y, z * bk], ax: [0.046, 0, 0], az: [0, tz * 0.007, -ty * 0.007], w: [[B.chest, 1]], v: i / (pts.length - 1) };
    }), 6, R_CLOTH, { capStart: 0.001, capEnd: 0.001 });
  }
  const geo = g.build(true);
  geoCache.set(key, geo);
  return geo;
}
