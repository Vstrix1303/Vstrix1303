// Builds the game's realistic human bodies from MakeHuman's CC0 data.
//   node tools/mh-build.mjs <path to makehuman/data>
// For each body preset it blends MakeHuman's macro targets (sex, age, muscle, weight, ancestry),
// folds MakeHuman's 163-bone skeleton onto the game's 24-bone animation rig, scales the body so its
// legs match the rig (the walking IK depends on that), makes two lighter versions for distance,
// and writes assets/humans/<preset>.bin plus a manifest.
import fs from 'node:fs';
import path from 'node:path';
import { MeshoptSimplifier } from 'meshoptimizer';
import * as THREE from 'three';

const DATA = process.argv[2];
if (!DATA || !fs.existsSync(path.join(DATA, '3dobjs', 'base.obj'))) { console.error('usage: node tools/mh-build.mjs <makehuman/data>'); process.exit(1); }
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'assets', 'humans');
fs.mkdirSync(OUT, { recursive: true });

// the game's rig (src/body.js): bone order and leg lengths
const ROLES = ['hips', 'spine', 'chest', 'neck', 'head', 'clavL', 'armL', 'foreL', 'handL', 'fingL', 'clavR', 'armR', 'foreR', 'handR', 'fingR', 'thighL', 'shinL', 'footL', 'toeL', 'thighR', 'shinR', 'footR', 'toeR', 'hem', 'jaw', 'lidL', 'lidR'];
const PARENT = [-1, 0, 1, 2, 3, 2, 5, 6, 7, 8, 2, 10, 11, 12, 13, 0, 15, 16, 17, 0, 19, 20, 21, 0, 4, 4, 4];
const RIG_LEG = 0.44 + 0.41, RIG_HEM = -0.56;

// body presets (age in years; muscle/weight 0..1, 0.5 = average; ancestry weights)
const SOUTH = { african: 0.35, asian: 0.15, caucasian: 0.5 }, EURO = { african: 0, asian: 0, caucasian: 1 };
const PRESETS = {
  m_young: { male: 1, age: 27, muscle: 0.66, weight: 0.4, race: SOUTH },
  m_lean: { male: 1, age: 32, muscle: 0.5, weight: 0.36, race: SOUTH },
  m_heavy: { male: 1, age: 48, muscle: 0.45, weight: 0.82, race: SOUTH },
  m_old: { male: 1, age: 66, muscle: 0.38, weight: 0.42, race: SOUTH },
  f_young: { male: 0, age: 24, muscle: 0.45, weight: 0.46, race: SOUTH },
  f_old: { male: 0, age: 60, muscle: 0.38, weight: 0.56, race: SOUTH },
  c_m: { male: 1, age: 9, muscle: 0.5, weight: 0.42, race: SOUTH },
  c_f: { male: 0, age: 9, muscle: 0.5, weight: 0.42, race: SOUTH },
  e_m: { male: 1, age: 38, muscle: 0.5, weight: 0.52, race: EURO },
  e_old: { male: 1, age: 60, muscle: 0.4, weight: 0.72, race: EURO },
};

// ---------------------------------------------------------------- base mesh
const obj = fs.readFileSync(path.join(DATA, '3dobjs', 'base.obj'), 'utf8').split('\n');
const V = [], VT = [], faces = [];
let grp = '';
for (const l of obj) {
  if (l.startsWith('v ')) { const p = l.split(/\s+/); V.push(+p[1], +p[2], +p[3]); }
  else if (l.startsWith('vt ')) { const p = l.split(/\s+/); VT.push(+p[1], +p[2]); }
  else if (l.startsWith('g ')) grp = l.slice(2).trim();
  else if (l.startsWith('f ') && grp === 'body') faces.push(l.split(/\s+/).slice(1).filter(Boolean).map((t) => t.split('/').map((x) => +x - 1)));
}
const NV = V.length / 3;
console.log(`base mesh: ${NV} vertices, ${faces.length} body faces`);

const readTarget = (rel) => {
  const t = fs.readFileSync(path.join(DATA, 'targets', rel), 'utf8').split('\n'), out = [];
  for (const l of t) { if (!l || l[0] === '#') continue; const p = l.trim().split(/\s+/); if (p.length >= 4) out.push(+p[0], +p[1], +p[2], +p[3]); }
  return out;
};
const tcache = new Map();
const target = (rel) => { if (!tcache.has(rel)) tcache.set(rel, fs.existsSync(path.join(DATA, 'targets', rel)) ? readTarget(rel) : null); return tcache.get(rel); };

// MakeHuman's macro blending
function ageWeights(years) {
  const v = years < 11 ? (years - 1) / 10 * 0.1875 : years < 25 ? 0.1875 + (years - 11) / 14 * 0.3125 : 0.5 + Math.min(1, (years - 25) / 65) * 0.5;
  if (v < 0.1875) return { baby: 1 - v / 0.1875, child: v / 0.1875 };
  if (v < 0.5) return { child: 1 - (v - 0.1875) / 0.3125, young: (v - 0.1875) / 0.3125 };
  return { young: 1 - (v - 0.5) / 0.5, old: (v - 0.5) / 0.5 };
}
const tri = (x, lo, mid, hi) => (x < 0.5 ? { [lo]: (0.5 - x) / 0.5, [mid]: x / 0.5 } : { [mid]: (1 - x) / 0.5, [hi]: (x - 0.5) / 0.5 });
function morph(p) {
  const pos = Float64Array.from(V);
  const add = (rel, w) => { if (w < 1e-4) return; const t = target(rel); if (!t) { console.warn('  missing target', rel); return; } for (let i = 0; i < t.length; i += 4) { const k = t[i] * 3; pos[k] += t[i + 1] * w; pos[k + 1] += t[i + 2] * w; pos[k + 2] += t[i + 3] * w; } };
  const G = { female: 1 - p.male, male: p.male }, A = ageWeights(p.age);
  const Mu = tri(p.muscle, 'minmuscle', 'averagemuscle', 'maxmuscle'), We = tri(p.weight, 'minweight', 'averageweight', 'maxweight');
  for (const [g, gw] of Object.entries(G)) for (const [a, aw] of Object.entries(A)) {
    for (const [r, rw] of Object.entries(p.race)) add(`macrodetails/${r}-${g}-${a}.target`, gw * aw * rw);
    for (const [m, mw] of Object.entries(Mu)) for (const [w, ww] of Object.entries(We)) add(`macrodetails/universal-${g}-${a}-${m}-${w}.target`, gw * aw * mw * ww);
  }
  return pos;
}

// ---------------------------------------------------------------- skeleton and weights
const sk = JSON.parse(fs.readFileSync(path.join(DATA, 'rigs', 'default.mhskel'), 'utf8'));
const WT = JSON.parse(fs.readFileSync(path.join(DATA, 'rigs', 'default_weights.mhw'), 'utf8')).weights;
const FACE = /oris|orbicularis|levator|risorius|temporalis|special|tongue|eye|oculi|jaw/;
function role(name) {
  if (/^(jaw|tongue)/.test(name)) return 'jaw';
  if (/^oris/.test(name)) return 'lip';          // decided per body: lower lip follows the jaw
  if (/^orbicularis03/.test(name)) return 'lid';
  if (/^(root|spine05|pelvis)/.test(name)) return 'hips';
  if (/^spine0[34]/.test(name)) return 'spine';
  if (/^(spine0[12]|breast)/.test(name)) return 'chest';
  if (/^neck/.test(name)) return 'neck';
  if (name === 'head' || FACE.test(name)) return 'head';
  if (/^(clavicle|shoulder01)/.test(name)) return 'clav';
  if (/^upperarm/.test(name)) return 'arm';
  if (/^lowerarm/.test(name)) return 'fore';
  if (/^(wrist|metacarpal|finger1-)/.test(name)) return 'hand';
  if (/^finger[2-5]-/.test(name)) return 'fing';
  if (/^upperleg/.test(name)) return 'thigh';
  if (/^lowerleg/.test(name)) return 'shin';
  if (/^foot/.test(name)) return 'foot';
  if (/^toe/.test(name)) return 'toe';
  return null;
}
const PIVOT = { hips: 'root', spine: 'spine04', chest: 'spine02', neck: 'neck01', head: 'head', clav: 'clavicle', arm: 'upperarm01', fore: 'lowerarm01', hand: 'wrist', fing: 'finger3-1', thigh: 'upperleg01', shin: 'lowerleg01', foot: 'foot', toe: 'toe3-1' };
const jointPos = (pos, jname) => { const ids = sk.joints[jname]; let x = 0, y = 0, z = 0; for (const i of ids) { x += pos[i * 3]; y += pos[i * 3 + 1]; z += pos[i * 3 + 2]; } return [x / ids.length, y / ids.length, z / ids.length]; };
const boneHead = (pos, b) => jointPos(pos, sk.bones[b].head);
const sided = (r, x) => (['clav', 'arm', 'fore', 'hand', 'fing', 'thigh', 'shin', 'foot', 'toe', 'lid'].includes(r) ? r + (x < 0 ? 'L' : 'R') : r);

// ---------------------------------------------------------------- one preset
await MeshoptSimplifier.ready;
const manifest = { source: 'MakeHuman 1.1 (makehumancommunity.org) — base mesh, targets, skeleton and weights are CC0', roles: ROLES, presets: {} };
const unknown = new Set();
for (const [key, p] of Object.entries(PRESETS)) {
  const pos = morph(p);
  // per-vertex weights folded onto the game's bones
  const acc = Array.from({ length: NV }, () => new Map());
  const lipY = (() => { let y = 0, c = 0; for (const b of Object.keys(WT)) if (/^oris/.test(b)) { y += boneHead(pos, b)[1]; c++; } return y / c; })();
  for (const [b, list] of Object.entries(WT)) {
    let r = role(b);
    if (r === 'lip') r = boneHead(pos, b)[1] < lipY - 0.01 ? 'jaw' : 'head';
    if (!r) { unknown.add(b); continue; }
    const hx = boneHead(pos, b)[0];
    const ri = ROLES.indexOf(sided(r, hx));
    for (const [vi, w] of list) acc[vi].set(ri, (acc[vi].get(ri) || 0) + w);
  }
  // pivots of the game's bones, then scale so the legs match the rig
  const piv = {};
  for (const [r, mhb] of Object.entries(PIVOT)) {
    const sides = ['clav', 'arm', 'fore', 'hand', 'fing', 'thigh', 'shin', 'foot', 'toe'].includes(r) ? [['L', '.R'], ['R', '.L']] : [['', '']];
    for (const [suf, mhSuf] of sides) {
      let name = mhb + mhSuf;
      if (!sk.bones[name]) name = mhb;
      let h = boneHead(pos, name);
      // MakeHuman's ".R" is the character's right, which faces +Z on the -X side: check and swap if needed
      if (suf && (suf === 'L') !== (h[0] < 0)) h = boneHead(pos, mhb + (mhSuf === '.R' ? '.L' : '.R'));
      piv[r + suf] = h;
    }
  }
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const leg = dist(piv.thighL, piv.shinL) + dist(piv.shinL, piv.footL);
  const s = RIG_LEG / leg;                       // MakeHuman units are decimetres; this converts and normalises in one step
  let minY = 1e9;
  for (const f of faces) for (const [vi] of f) minY = Math.min(minY, pos[vi * 3 + 1]);
  const ox = piv.hips[0], oz = piv.hips[2];
  const T = (q) => [(q[0] - ox) * s, (q[1] - minY) * s, (q[2] - oz) * s];
  const flip = 1;
  // extra face pivots: the jaw hinge, and each upper lid hinged at the eye's centre
  piv.jaw = boneHead(pos, 'jaw');
  { const a = jointPos(pos, 'eye.L____head'), b = jointPos(pos, 'eye.R____head'); piv.lidL = a[0] < 0 ? a : b; piv.lidR = a[0] < 0 ? b : a; }
  let bones = ROLES.map((r) => (r === 'hem' ? null : T(piv[r])));
  bones[23] = [bones[0][0], bones[0][1] + RIG_HEM, bones[0][2]];

  // unique (position, uv) pairs → vertices
  const map = new Map(), P = [], UV = [], SKI = [], SKW = [], SRC = [], idx0 = [];
  const vid = (vi, ti) => {
    const k = vi * 65536 + ti;
    if (map.has(k)) return map.get(k);
    const n = P.length / 3; map.set(k, n);
    const q = T([pos[vi * 3], pos[vi * 3 + 1], pos[vi * 3 + 2]]);
    P.push(q[0] * flip, q[1], q[2] * flip); UV.push(VT[ti * 2], VT[ti * 2 + 1]); SRC.push(vi);
    const w = [...acc[vi].entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const tot = w.reduce((a, e) => a + e[1], 0) || 1;
    const wi = [0, 0, 0, 0], ww = [0, 0, 0, 0];
    w.forEach(([i, x], k) => { wi[k] = i; ww[k] = x / tot; });
    if (!w.length) { wi[0] = 4; ww[0] = 1; }
    // weights to bytes that sum to exactly 255
    const b = ww.map((x) => Math.round(x * 255)); b[0] += 255 - (b[0] + b[1] + b[2] + b[3]);
    SKI.push(...wi); SKW.push(...b);
    return n;
  };
  for (const f of faces) {
    const ids = f.map(([vi, ti]) => vid(vi, ti));
    for (let k = 1; k + 1 < ids.length; k++) idx0.push(ids[0], ids[k], ids[k + 1]);
  }
  const N = P.length / 3;
  // smooth normals across UV seams (accumulate on the source vertex)
  const nacc = new Float64Array(NV * 3);
  for (let i = 0; i < idx0.length; i += 3) {
    const a = idx0[i], b = idx0[i + 1], c = idx0[i + 2];
    const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
    const vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const v of [a, b, c]) { const sv = SRC[v] * 3; nacc[sv] += nx; nacc[sv + 1] += ny; nacc[sv + 2] += nz; }
  }
  const NRM = new Float32Array(N * 3);
  for (let v = 0; v < N; v++) { const sv = SRC[v] * 3, l = Math.hypot(nacc[sv], nacc[sv + 1], nacc[sv + 2]) || 1; NRM[v * 3] = nacc[sv] / l; NRM[v * 3 + 1] = nacc[sv + 1] / l; NRM[v * 3 + 2] = nacc[sv + 2] / l; }
  // check winding: normals should point away from the body's axis on the torso
  let out = 0;
  for (let v = 0; v < N; v += 37) if (P[v * 3 + 1] > 1.0 && P[v * 3 + 1] < 1.3) out += Math.sign(NRM[v * 3] * P[v * 3] + NRM[v * 3 + 2] * P[v * 3 + 2]);
  if (out < 0) { for (let i = 0; i < idx0.length; i += 3) { const t = idx0[i + 1]; idx0[i + 1] = idx0[i + 2]; idx0[i + 2] = t; } for (let i = 0; i < NRM.length; i++) NRM[i] = -NRM[i]; }

  // ---- re-pose from MakeHuman's A-pose to the rig's rest: arms hanging at the sides, legs straight
  let lift = 0;
  {
    const bs = ROLES.map(() => new THREE.Bone());
    bs.forEach((b, i) => { const p = PARENT[i], w = bones[i]; if (p < 0) b.position.set(...w); else { const q = bones[p]; b.position.set(w[0] - q[0], w[1] - q[1], w[2] - q[2]); bs[p].add(b); } });
    bs[0].updateMatrixWorld(true);
    const inv = bs.map((b) => b.matrixWorld.clone().invert());
    const wp = (i) => new THREE.Vector3().setFromMatrixPosition(bs[i].matrixWorld);
    const aim = (i, child, dir) => {
      bs[0].updateMatrixWorld(true);
      const from = wp(child).sub(wp(i)).normalize(), to = new THREE.Vector3(...dir).normalize();
      const qw = new THREE.Quaternion().setFromUnitVectors(from, to);
      const pq = new THREE.Quaternion(); bs[i].parent.getWorldQuaternion(pq);
      const cur = new THREE.Quaternion(); bs[i].getWorldQuaternion(cur);
      bs[i].quaternion.copy(pq.clone().invert().multiply(qw).multiply(cur));
    };
    for (const sgn of [-1, 1]) {
      const [arm, fore, hand, fing, thigh, shin, foot] = sgn < 0 ? [6, 7, 8, 9, 15, 16, 17] : [11, 12, 13, 14, 19, 20, 21];
      aim(arm, fore, [sgn * 0.06, -1, 0.0]); aim(fore, hand, [sgn * 0.05, -1, 0.04]); aim(hand, fing, [sgn * 0.02, -1, 0.02]);
      aim(thigh, shin, [0, -1, 0]); aim(shin, foot, [0, -1, 0]);
    }
    bs[0].updateMatrixWorld(true);
    const M = bs.map((b, i) => b.matrixWorld.clone().multiply(inv[i]));
    const v = new THREE.Vector3(), n = new THREE.Vector3(), acc3 = new THREE.Vector3(), accn = new THREE.Vector3(), nm = M.map((m) => new THREE.Matrix3().setFromMatrix4(m));
    for (let k = 0; k < N; k++) {
      acc3.set(0, 0, 0); accn.set(0, 0, 0);
      for (let j = 0; j < 4; j++) { const w = SKW[k * 4 + j] / 255; if (!w) continue; const b = SKI[k * 4 + j];
        acc3.addScaledVector(v.set(P[k * 3], P[k * 3 + 1], P[k * 3 + 2]).applyMatrix4(M[b]), w);
        accn.addScaledVector(n.set(NRM[k * 3], NRM[k * 3 + 1], NRM[k * 3 + 2]).applyMatrix3(nm[b]), w); }
      P[k * 3] = acc3.x; P[k * 3 + 1] = acc3.y; P[k * 3 + 2] = acc3.z; accn.normalize(); NRM[k * 3] = accn.x; NRM[k * 3 + 1] = accn.y; NRM[k * 3 + 2] = accn.z;
    }
    bones = bones.map((b, i) => (b ? wp(i).toArray() : b));
    // the hands' pivots moved with the arms; re-level the soles on the ground
    let minY2 = 1e9; for (let k = 0; k < N; k++) minY2 = Math.min(minY2, P[k * 3 + 1]);
    for (let k = 0; k < N; k++) P[k * 3 + 1] -= minY2; bones = bones.map((b) => [b[0], b[1] - minY2, b[2]]); lift = minY2;
  }

  // ---- the eyes: MakeHuman's eye mesh rides on helper vertices of the base mesh, so it follows every body shape
  const eyeObj = fs.readFileSync(path.join(DATA, 'eyes', 'low-poly', 'low-poly.obj'), 'utf8').split('\n');
  const eRef = fs.readFileSync(path.join(DATA, 'eyes', 'low-poly', 'low-poly.mhclo'), 'utf8').split('\n');
  const refs = []; { let on = false; for (const l of eRef) { if (l.startsWith('verts')) { on = true; continue; } if (on && /^\s*\d/.test(l)) refs.push(l.trim().split(/\s+/).map(Number)); } }
  const EV = [], EVT = [], EF = [];
  for (const l of eyeObj) { if (l.startsWith('vt ')) { const q = l.split(/\s+/); EVT.push(+q[1], +q[2]); } else if (l.startsWith('f ')) EF.push(l.split(/\s+/).slice(1).filter(Boolean).map((t) => t.split('/').map((x) => +x - 1))); }
  const eyeP = [], eyeUV = [], eyeI = [], emap = new Map();
  const evid = (vi, ti) => { const key2 = vi * 65536 + ti; if (emap.has(key2)) return emap.get(key2); const r = refs[vi]; const q = T([pos[r[0] * 3], pos[r[0] * 3 + 1], pos[r[0] * 3 + 2]]); q[1] -= lift; const id = eyeP.length / 3; emap.set(key2, id); eyeP.push(...q); eyeUV.push(EVT[ti * 2], EVT[ti * 2 + 1]); return id; };
  for (const f of EF) { const ids = f.map(([vi, ti]) => evid(vi, ti)); for (let k = 1; k + 1 < ids.length; k++) eyeI.push(ids[0], ids[k], ids[k + 1]); }

  const pos32 = new Float32Array(P), i0 = new Uint32Array(idx0);
  const lod = (ratio, err) => MeshoptSimplifier.simplify(i0, pos32, 3, Math.floor(i0.length * ratio / 3) * 3, err, ['LockBorder'])[0];
  const i1 = lod(0.3, 0.02), i2 = lod(0.1, 0.05);

  // facial landmarks for painting the face and fitting hair and hats
  const mean = (pred) => { let x = 0, y = 0, z = 0, c = 0; for (const [b, list] of Object.entries(WT)) if (pred(b)) for (const [vi, w] of list) if (w > 0.5) { const q = T([pos[vi * 3], pos[vi * 3 + 1], pos[vi * 3 + 2]]); x += q[0]; y += q[1]; z += q[2]; c++; } return c ? [x / c, y / c, z / c] : null; };
  const down = (q) => [q[0], q[1] - lift, q[2]];
  const L = {
    eyeL: down(T(jointPos(pos, 'eye.R____head'))), eyeR: down(T(jointPos(pos, 'eye.L____head'))),
    mouth: down(mean((b) => /^oris0[1-7]/.test(b))), head: bones[4], neck: bones[3],
  };
  if (L.eyeL[0] > 0) [L.eyeL, L.eyeR] = [L.eyeR, L.eyeL];
  let top = -1e9, front = -1e9, chinY = 1e9;
  for (let v = 0; v < N; v++) {
    const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
    if (SKI[v * 4] === 4 && SKW[v * 4] > 200) { top = Math.max(top, y); if (Math.abs(x) < 0.01) { front = Math.max(front, z); } }
  }
  L.top = top; L.front = front;

  // write: header json + typed arrays
  const parts = { eyeP: new Float32Array(eyeP), eyeUV: new Float32Array(eyeUV), eyeI: new Uint16Array(eyeI), pos: pos32, nrm: NRM, uv: new Float32Array(UV), ski: new Uint8Array(SKI), skw: new Uint8Array(SKW), i0: N < 65536 ? new Uint16Array(i0) : i0, i1: N < 65536 ? new Uint16Array(i1) : i1, i2: N < 65536 ? new Uint16Array(i2) : i2 };
  const layout = {}; let off = 0; const bufs = [];
  for (const [k, a] of Object.entries(parts)) { const pad = (4 - (off % 4)) % 4; if (pad) { bufs.push(Buffer.alloc(pad)); off += pad; } layout[k] = { off, len: a.length, type: a.constructor.name }; bufs.push(Buffer.from(a.buffer, a.byteOffset, a.byteLength)); off += a.byteLength; }
  fs.writeFileSync(path.join(OUT, key + '.bin'), Buffer.concat(bufs));
  manifest.presets[key] = { verts: N, tris: [i0.length / 3, i1.length / 3, i2.length / 3], layout, bones, landmarks: L, scale: s * 10 };
  console.log(`${key}: ${N} verts, tris ${i0.length / 3} / ${i1.length / 3} / ${i2.length / 3}, scale ${(s).toFixed(4)}, height ${(top).toFixed(3)} m`);
}
if (unknown.size) console.log('unmapped bones:', [...unknown].join(' '));
fs.copyFileSync(path.join(DATA, 'eyes', 'materials', 'brown_eye.png'), path.join(OUT, 'eye.png'));
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
const mb = fs.readdirSync(OUT).reduce((a, f) => a + fs.statSync(path.join(OUT, f)).size, 0) / 1048576;
console.log(`wrote ${Object.keys(PRESETS).length} bodies, ${mb.toFixed(1)} MB`);
