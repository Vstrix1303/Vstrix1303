// Realistic people: MakeHuman bodies (CC0) under the game's animation rig.
// The body's own joint positions become the skeleton the motion system drives;
// clothing is drawn by a shader on the body's surface from its rest-pose position
// (no texture per outfit, crisp at any distance); hair is a shell grown from the scalp;
// the mundu is a cloth tube fitted to each body's hips and legs; eyes, a jaw that
// talks and lids that blink come from MakeHuman's face.
import * as THREE from 'three';
import { SGB } from './geo.js';
import { HUMANS } from './assets.js';
import { hairMat } from './wear.js';
import { clamp, lerp } from './util.js';

export const PARENT = [-1, 0, 1, 2, 3, 2, 5, 6, 7, 8, 2, 10, 11, 12, 13, 0, 15, 16, 17, 0, 19, 20, 21, 0, 4, 4, 4];
const R_SKIRT = [256, 256, 512, 448];

export function pickBody(o) {
  if (!HUMANS.ready) return null;
  let k;
  if (o.child) k = o.female ? 'c_f' : 'c_m';
  else if (o.female) k = (o.age || o.grey) ? 'f_old' : 'f_young';
  else if (o.eye != null) k = (o.age || o.belly) ? 'e_old' : 'e_m';
  else if (o.belly) k = 'm_heavy';
  else if (o.age || o.grey) k = 'm_old';
  else if (o.muscle) k = 'm_young';
  else k = 'm_lean';
  return HUMANS.presets[k] ? k : null;
}

// ---------------------------------------------------------------- per-body shared data
const shared = new Map();
function bodyData(key) {
  if (shared.has(key)) return shared.get(key);
  const m = HUMANS.presets[key], buf = HUMANS.data[key], L = m.layout;
  const A = (n) => new globalThis[L[n].type](buf, L[n].off, L[n].len);
  const pos = A('pos'), nrm = A('nrm'), ski = A('ski'), skw = A('skw');
  const attrs = {
    position: new THREE.BufferAttribute(pos, 3), normal: new THREE.BufferAttribute(nrm, 3), uv: new THREE.BufferAttribute(A('uv'), 2),
    skinIndex: new THREE.BufferAttribute(ski, 4), skinWeight: new THREE.BufferAttribute(skw, 4, true),
  };
  // which garment pieces hide each vertex (bit per piece); the clothing shader discards what is covered
  attrs.cov = new THREE.BufferAttribute(L.cov ? new Float32Array(A('cov')) : new Float32Array(pos.length / 3), 1);
  const lods = ['i0', 'i1', 'i2'].map((n) => {
    const g = new THREE.BufferGeometry();
    for (const k in attrs) g.setAttribute(k, attrs[k]);
    g.setIndex(new THREE.BufferAttribute(A(n), 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.2);
    return g;
  });
  // eyes, all on the head bone
  const ep = A('eyeP'), eg = new THREE.BufferGeometry(), en = ep.length / 3;
  eg.setAttribute('position', new THREE.BufferAttribute(ep, 3)); eg.setAttribute('uv', new THREE.BufferAttribute(A('eyeUV'), 2));
  eg.setIndex(new THREE.BufferAttribute(A('eyeI'), 1)); eg.computeVertexNormals();
  eg.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint8Array(en * 4).fill(0).map((_, i) => (i % 4 === 0 ? 4 : 0)), 4));
  eg.setAttribute('skinWeight', new THREE.BufferAttribute(new Uint8Array(en * 4).map((_, i) => (i % 4 === 0 ? 255 : 0)), 4, true));
  // garment pieces fitted to this body by tools/mh-build.mjs, two levels of detail each
  const garments = {};
  for (const pn in m.garments || {}) {
    const ga = { position: new THREE.BufferAttribute(A(pn + '_p'), 3), normal: new THREE.BufferAttribute(A(pn + '_n'), 3), uv: new THREE.BufferAttribute(A(pn + '_u'), 2),
      skinIndex: new THREE.BufferAttribute(A(pn + '_i'), 4), skinWeight: new THREE.BufferAttribute(A(pn + '_w'), 4, true) };
    garments[pn] = ['_x0', '_x1'].map((x) => {
      const g = new THREE.BufferGeometry(); for (const k in ga) g.setAttribute(k, ga[k]);
      g.setIndex(new THREE.BufferAttribute(A(pn + x), 1)); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.2); return g;
    });
  }
  const d = { m, pos, nrm, ski, skw, i0: A('i0'), attrs, lods, eyes: eg, hair: new Map(), skirts: new Map(), garments };
  shared.set(key, d);
  return d;
}

// a shell over the scalp, grown from the body's own head; its edge follows a hairline
function hairGeometry(d, kind) {
  if (d.hair.has(kind)) return d.hair.get(kind);
  const { pos, nrm, ski, i0, m } = d, Lm = m.landmarks;
  const eyeY = (Lm.eyeL[1] + Lm.eyeR[1]) / 2, cz = Lm.head[2], mouthY = Lm.mouth[1];
  const rec = kind === 'receding' ? 0.025 : 0, fem = kind === 'long';
  const inside = (v) => {
    const b = ski[v * 4];
    if (b !== 4 && b !== 3 && b !== 25 && b !== 26) return false;
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    const front = z - cz, side = Math.abs(x);
    // front: forehead hairline; sides: above the ears; back: down to the nape
    const lineFront = eyeY + 0.046 + rec - Math.min(0.03, side * 0.4);
    const lineSide = eyeY + (side > 0.06 ? 0.018 : 0.03);
    const lineBack = (fem ? mouthY - 0.05 : mouthY - 0.012);
    const line = front > 0.045 ? lineFront : front > -0.02 ? lerp(lineSide, lineFront, (front + 0.02) / 0.065) : lerp(lineSide, lineBack, clamp((-0.02 - front) / 0.05, 0, 1));
    return y > line && !(side > 0.068 && y < eyeY + 0.03 && front > -0.04);     // keep clear of the ears
  };
  const keep = new Uint8Array(pos.length / 3);
  for (let v = 0; v < keep.length; v++) keep[v] = inside(v) ? 1 : 0;
  const idx = [], remap = new Map(), P = [], N = [], SI = [], SW = [];
  const add = (v) => {
    if (remap.has(v)) return remap.get(v);
    const n = P.length / 3; remap.set(v, n);
    const off = 0.0045 + 0.0025 * Math.sin(pos[v * 3] * 400 + pos[v * 3 + 2] * 300);
    P.push(pos[v * 3] + nrm[v * 3] * off, pos[v * 3 + 1] + nrm[v * 3 + 1] * off, pos[v * 3 + 2] + nrm[v * 3 + 2] * off);
    N.push(nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]);
    for (let j = 0; j < 4; j++) { SI.push(d.ski[v * 4 + j]); SW.push(d.skw[v * 4 + j]); }
    return n;
  };
  // a triangle is hair if most of it is: the edge then follows the hairline instead of stepping
  for (let i = 0; i < i0.length; i += 3) if (keep[i0[i]] + keep[i0[i + 1]] + keep[i0[i + 2]] >= 1) idx.push(add(i0[i]), add(i0[i + 1]), add(i0[i + 2]));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  // strand direction for the hair normal map: wraps around the head, runs down it
  const uv = []; for (let k = 0; k < P.length; k += 3) uv.push(Math.atan2(P[k], P[k + 2] - cz) * 1.6, P[k + 1] * 9);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('skinIndex', new THREE.Uint8BufferAttribute(SI, 4)); g.setAttribute('skinWeight', new THREE.Uint8BufferAttribute(SW, 4, true));
  g.setIndex(idx);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.6, 0), 0.4);
  d.hair.set(kind, g);
  return g;
}

// the mundu: a cloth tube hung from the waist, its width measured off this body's hips and legs
function skirtGeometry(d, long, shirtOver) {
  const key = long + '|' + shirtOver;
  if (d.skirts.has(key)) return d.skirts.get(key);
  const { pos, ski } = d, B = d.m.bones;
  const hipY = B[0][1], kneeY = B[16][1], ankleY = B[17][1];
  const waist = hipY + 0.085, hemY = long ? ankleY + 0.035 : kneeY + 0.04;
  const extent = (y, band) => {
    let rx = 0.08, zf = 0.06, zb = 0.06;
    for (let v = 0; v < pos.length / 3; v++) {
      const vy = pos[v * 3 + 1]; if (Math.abs(vy - y) > band) continue;
      const b = ski[v * 4]; if (!(b === 0 || b === 1 || b === 15 || b === 16 || b === 19 || b === 20 || b === 23)) continue;
      const x = Math.abs(pos[v * 3]), z = pos[v * 3 + 2];
      rx = Math.max(rx, x); if (z > 0) zf = Math.max(zf, z); else zb = Math.max(zb, -z);
    }
    return [rx, zf, zb];
  };
  const ys = [waist, waist - 0.07, hipY - 0.06, hipY - 0.2];
  if (long) ys.push(kneeY + 0.06, kneeY - 0.12, lerp(kneeY, hemY, 0.65), hemY); else ys.push(lerp(hipY - 0.2, hemY, 0.5), hemY);
  let widest = [0, 0, 0];
  const rings = ys.map((y, i) => {
    let e = extent(y, 0.02);
    if (y < hipY - 0.1) e = [Math.max(e[0], widest[0]), Math.max(e[1], widest[1] * 0.95), Math.max(e[2], widest[2] * 0.95)];
    widest = [Math.max(widest[0], e[0]), Math.max(widest[1], e[1]), Math.max(widest[2], e[2])];
    // cloth hangs loose below the hips, so a thigh brought forward stays inside it
    const pad = i === 0 ? (shirtOver === 2 ? 0.003 : 0.006) : i === 1 ? (shirtOver === 2 ? 0.007 : 0.016 + (shirtOver ? 0.01 : 0)) : 0.034;   // 2: a cloth shirt hangs over it
    const t = (waist - y) / (waist - hemY);
    const wt = clamp((hipY - y) / 0.25, 0, 1), ws = long ? clamp((kneeY + 0.05 - y) / 0.25, 0, 1) : 0, wh = clamp((t - 0.35) / 0.65, 0, 1) * (long ? 0.3 : 0.22);
    return {
      c: [0, y, (e[1] - e[2]) / 2], ax: [e[0] + pad, 0, 0], az: [0, 0, (e[1] + e[2]) / 2 + pad], v: t,
      w: (th, p) => {
        const l = 0.5 - 0.5 * clamp(p[0] / (0.34 * (e[0] + pad)), -1, 1);       // 1 = left (-x)
        const out = [], hip = 1 - wt * (1 - ws) - ws, k = 1 - wh;
        if (hip > 0.001) out.push([0, hip * k]);
        if (wt * (1 - ws) > 0.001) out.push([15, wt * (1 - ws) * l * k], [19, wt * (1 - ws) * (1 - l) * k]);
        if (ws > 0.001) out.push([16, ws * l * k], [20, ws * (1 - l) * k]);
        if (wh > 0) out.push([23, wh]);
        return out.filter((q) => q[1] > 0.001).sort((a, b) => b[1] - a[1]).slice(0, 4);
      },
    };
  });
  const g = new SGB(512);
  g.loft(rings, 24, R_SKIRT, {});
  const geo = g.build(true);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.6, 0), 1.0);
  d.skirts.set(key, geo);
  return geo;
}

// ---------------------------------------------------------------- the clothing shader
const STYLE = { jacket: 1, frock: 2, uniform: 3, kurta: 4, blouse: 5, chatta: 6, wrap: 7 };
const col = (h, fb = 0x000000) => new THREE.Color(h ?? fb);
const CLOTHE_GLSL = /* glsl */`
uniform vec3 uSkin, uShirt, uWaist, uTie, uMundu, uLungi, uTrou, uBoot, uPut, uScloth, uNeri, uBag, uHair, uLip;
uniform vec4 uF1;   // shirt on, style, sleeves (0 none, 1 short, 2 long), long mundu
uniform vec4 uF2;   // trousers, boots (2 = tall), puttees, kasavu
uniform vec4 uF3;   // lungi, shoulder cloth, thread, pendant
uniform vec4 uF4;   // moustache (1, 2 big), beard (1 stubble, 2 full), mark (1 chandanam, 2 pottu, 3 bhasmam), bangles
uniform vec4 uF5;   // dirty, sandals, rosary, bag
uniform vec4 uF6;   // female, mundu on, scalp painted (no hair shell), sleeves end y
uniform vec3 uEyeL, uEyeR, uMouth;
uniform vec4 uY;    // waist y, knee y, ankle y, neck y
uniform vec4 uY2;   // elbow y, wrist y, chest y, shirt hem y
varying vec3 vRest; varying vec3 vRestN; flat varying float vPart;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
// returns albedo; writes roughness / metalness
vec3 clothe(out float rough, out float metal) {
  vec3 p = vRest, n = normalize(vRestN + vec3(0.0, 1e-6, 0.0));
  float part = vPart;
  bool arm = (part > 5.5 && part < 9.5) || (part > 10.5 && part < 14.5);
  bool hand = part == 8.0 || part == 9.0 || part == 13.0 || part == 14.0;
  bool leg = part > 14.5 && part < 22.5;
  bool foot = part == 17.0 || part == 18.0 || part == 21.0 || part == 22.0;
  bool head = part == 4.0 || part > 23.5;
  bool torso = !arm && !leg && !head;
  float y = p.y, ax = abs(p.x);
  // ---- skin
  vec3 c = uSkin * (0.94 + 0.12 * vn(p.xy * 60.0 + p.z * 40.0)) * (0.97 + 0.06 * vn(p.yz * 9.0));
  rough = 0.52; metal = 0.0;
  if (hand && n.z < -0.2) c *= 1.12;                     // paler palms
  if (head) {
    vec3 e = (uEyeL + uEyeR) * 0.5;
    vec2 m = vec2(p.x - uMouth.x, (p.y - uMouth.y));
    float lips = smoothstep(1.0, 0.75, length(m / vec2(0.025, 0.0095))) * step(0.2, n.z);
    c = mix(c, c * uLip, lips * 0.65); rough = mix(rough, 0.35, lips);
    // eyebrows: an arc above each eye
    for (int s = 0; s < 2; s++) {
      vec3 eye = s == 0 ? uEyeL : uEyeR;
      float dx = (p.x - eye.x) * (s == 0 ? -1.0 : 1.0);
      float arc = eye.y + 0.021 + 0.004 * (1.0 - pow(abs(dx - 0.002) / 0.02, 2.0)) - (uF6.x > 0.5 ? 0.0 : 0.0015);
      float brow = smoothstep(0.024, 0.017, abs(dx - 0.002)) * smoothstep(uF6.x > 0.5 ? 0.0022 : 0.0034, 0.0008, abs(p.y - arc)) * step(0.1, n.z);
      c = mix(c, uHair * 0.9, brow * (0.75 + 0.25 * vn(p.xy * 900.0)));
    }
    // moustache, beard
    if (uF4.x > 0.5) {
      float big = uF4.x > 1.5 ? 1.0 : 0.0;
      float ux = abs(p.x - uMouth.x), uy = p.y - uMouth.y;
      float lim = 0.027 + 0.007 * big;
      // thicker at the middle, tapering and drooping toward the corners of the mouth
      float droop = (0.004 + 0.006 * big) * smoothstep(0.012, lim, ux);
      float lo = 0.004 - droop, hi = 0.0175 - droop * 0.7 - 0.004 * smoothstep(0.014, lim, ux);
      float mo = smoothstep(lim, lim - 0.005, ux) * smoothstep(lo - 0.001, lo + 0.0015, uy) * smoothstep(hi + 0.0015, hi - 0.0012, uy) * step(0.1, n.z);
      c = mix(c, uHair, mo * (0.8 + 0.2 * vn(p.xy * 1200.0)));
    }
    if (uF4.y > 0.5) {
      float jaw = smoothstep(uMouth.y + 0.004, uMouth.y - 0.004, p.y) * step(e.y - 0.12, p.y) * step(-0.25, n.z) * smoothstep(0.0, 0.01, p.z - (e.z - 0.11));
      float cheek = smoothstep(e.y - 0.035, e.y - 0.05, p.y) * smoothstep(0.03, 0.05, abs(p.x)) * step(0.0, n.z);
      float b = max(jaw, cheek) * (1.0 - smoothstep(0.0, 0.005, -(p.y - uMouth.y) - 0.0) * smoothstep(0.012, 0.006, abs(p.x - uMouth.x)) * 0.0);
      c = mix(c, uHair, b * (uF4.y > 1.5 ? 0.92 : 0.35) * (0.7 + 0.3 * vn(p.xy * 1400.0)));
    }
    // marks on the forehead
    float fy = p.y - e.y, fx = p.x - e.x;
    if (uF4.z > 0.5 && n.z > 0.3) {
      if (uF4.z < 1.5) { c = mix(c, vec3(0.86, 0.74, 0.5), smoothstep(0.022, 0.018, abs(fx)) * smoothstep(0.003, 0.0015, abs(fy - 0.05))); c = mix(c, vec3(0.6, 0.08, 0.06), smoothstep(0.0032, 0.002, length(vec2(fx, fy - 0.036)))); }
      else if (uF4.z < 2.5) c = mix(c, vec3(0.62, 0.05, 0.08), smoothstep(0.0036, 0.0024, length(vec2(fx, fy - 0.032))));
      else for (int k = 0; k < 3; k++) c = mix(c, vec3(0.88, 0.86, 0.8), smoothstep(0.028, 0.024, abs(fx)) * smoothstep(0.0024, 0.0012, abs(fy - 0.044 - float(k) * 0.009)));
    }
    // the scalp under the hair, with a soft hairline the hair shell's edge blends into
    if (uF6.z > 0.5) {
      float front = p.z - (e.z - 0.08), side = abs(p.x - e.x);
      float line = front > 0.0 ? e.y + 0.05 - min(0.03, side * 0.4) : e.y + 0.012;
      float back = step(p.z, e.z - 0.1) * smoothstep(uMouth.y - 0.012, uMouth.y + 0.01, y);
      float sc = max(smoothstep(line - 0.004, line + 0.006, y) * (1.0 - step(0.072, side) * step(y, e.y + 0.03) * step(-0.04, front)), back);
      c = mix(c, uHair * (0.75 + 0.25 * vn(p.xy * 700.0)), sc * 0.92);
    }
  }
  // ---- what is worn
  float waistY = uY.x, kneeY = uY.y, ankleY = uY.z, neckY = uY.w;
  float wear = 0.0; vec3 cc = c; float cr = 0.9, cm = 0.0;
  // shirt / jacket / blouse
  if (uF1.x > 0.5) {
    float st = uF1.y;
    float bottom = st == 5.0 ? uY2.z - 0.06 : uY2.w;
    bool onBody = (torso || (leg && y > bottom)) && y > bottom && y < neckY + 0.02;
    float neckCut = 0.0;
    if (onBody && n.z > 0.0) {
      float v = st == 6.0 ? 0.11 : st == 1.0 || st == 2.0 ? 0.2 : 0.035;
      neckCut = step(neckY - v + abs(p.x) * (st == 6.0 || st == 1.0 || st == 2.0 ? 1.5 : 0.2), y);
    }
    bool onArm = arm && !hand && uF1.z > 0.5 && y > uF6.w;
    if ((onBody && neckCut < 0.5) || onArm) {
      wear = 1.0; cc = uShirt; cr = 0.88;
      // folds and weave
      cc *= 0.9 + 0.1 * vn(vec2(p.x * 30.0 + p.z * 20.0, y * 6.0)) + 0.04 * sin(y * 140.0 + p.x * 40.0);
      if (st == 1.0 || st == 2.0) {                       // coats: lapels, buttons, a pocket line
        float lap = step(0.0, n.z) * smoothstep(0.012, 0.0, abs(abs(p.x) - (neckY - y) * 0.5 - 0.01)) * step(uY2.z, y);
        cc = mix(cc, cc * (st == 2.0 ? 1.3 : 0.85), lap);
        if (n.z > 0.0 && abs(p.x + 0.012) < 0.006 && fract(y * 11.0) < 0.12 && y < uY2.z) { cc = st == 2.0 ? vec3(0.72, 0.6, 0.3) : vec3(0.3, 0.25, 0.2); cm = st == 2.0 ? 0.8 : 0.0; cr = 0.4; }
        if (uWaist.r + uWaist.g + uWaist.b > 0.01 && n.z > 0.0 && abs(p.x) < (neckY - y) * 0.45 + 0.01 && y > uY2.z - 0.25 && y < neckY - 0.06) cc = uWaist;
        if (n.z > 0.0 && abs(p.x) < 0.012 && y > neckY - 0.17 && y < neckY - 0.03) cc = uTie;
      } else if (st == 3.0) {                             // uniform: brass buttons, belt, cross-strap
        if (n.z > 0.0 && abs(p.x) < 0.007 && fract(y * 11.0) < 0.15 && y > waistY) { cc = vec3(0.8, 0.65, 0.3); cm = 0.85; cr = 0.35; }
        if (abs(y - waistY - 0.015) < 0.022) { cc = vec3(0.23, 0.15, 0.09); cr = 0.5; }
        if (abs((p.x * (n.z > 0.0 ? 1.0 : -1.0)) - (y - waistY - 0.2) * 0.65) < 0.02 && torso) { cc = vec3(0.23, 0.15, 0.09); cr = 0.5; }
      } else if (st == 4.0 && n.z > 0.0 && abs(p.x) < 0.004 && y > neckY - 0.15) cc *= 0.7;   // kurta placket
      else if (st == 5.0) {                               // blouse: the neriyathu over the left shoulder, across the body
        float diag = (p.x + (y - uY2.z) * 0.85);
        if (n.z > -0.2 && diag > -0.02 && diag < 0.09 && y > uY2.z - 0.08) { cc = uNeri; if (abs(diag + 0.02) < 0.008) { cc = vec3(0.8, 0.62, 0.24); cm = 0.7; cr = 0.4; } }
      } else if (st == 7.0) {                             // a single dark cloth over one shoulder
        if (p.x > 0.03 && y > neckY - 0.18 && n.z > -0.2) { wear = 0.0; cc = c; }
      }
    }
    // the blouse leaves the midriff bare; the neriyathu continues down the back
    if (st == 5.0 && torso && y < uY2.z - 0.06 && y > waistY) { wear = 0.0; cc = c; }
  }
  // the shoulder cloth hangs over the left shoulder, front and back
  if (uF3.y > 0.5 && (torso || head == false) && !arm && p.x < -0.05 && p.x > -0.135 && y > uY2.z - 0.14 && y < neckY + 0.04) {
    wear = 1.0; cc = uScloth * (0.94 + 0.06 * sin(p.x * 300.0)); cr = 0.92;
    if (abs(p.x + 0.13) < 0.006) { cc = vec3(0.8, 0.62, 0.24); cm = 0.7; cr = 0.4; }
  }
  // legs: trousers, mundu underneath its cloth, boots, puttees
  bool belowWaist = y < waistY + 0.02 && (leg || torso);
  if (uF2.x > 0.5 && belowWaist && y > (uF2.x > 1.5 ? kneeY + 0.04 : ankleY - 0.04) && !(torso && y > waistY + 0.02)) { /* uF2.x 2 = shorts, to the knee */ wear = 1.0; cc = uTrou * (0.92 + 0.08 * vn(vec2(p.x * 40.0, y * 8.0))); cr = 0.9; }
  if (uF6.y > 0.5 && belowWaist && !leg && y > (uF1.w > 0.5 ? ankleY + 0.02 : kneeY + 0.03)) { wear = 1.0; cc = uMundu; cr = 0.92;
    if (uF3.x > 0.5) { vec2 q = fract(vec2(atan(p.x, p.z) * 4.0, y * 18.0)); if (q.x < 0.33 || q.y < 0.33) cc = mix(cc, uLungi, 0.6); } }
  if (uF2.z > 0.5 && leg && y < kneeY - 0.02 && y > ankleY - 0.01) { wear = 1.0; cc = uPut * (0.9 + 0.1 * step(0.5, fract(y * 40.0 + p.x * 15.0))); cr = 0.95; }
  if (uF2.y > 0.5 && (foot || (leg && y < (uF2.y > 1.5 ? kneeY - 0.03 : ankleY + 0.1)))) { wear = 1.0; cc = uBoot; cr = 0.32; }
  if (uF5.y > 0.5 && foot && (abs(y - 0.035) < 0.006 || abs(p.x - (part > 18.5 ? 0.11 : -0.11)) < 0.004)) { wear = 1.0; cc = vec3(0.17, 0.11, 0.07); cr = 0.6; }
  // the sacred thread, a charm on a cord, bangles, a rosary, a satchel strap
  if (uF3.z > 0.5 && torso && abs((p.x * (n.z > 0.0 ? -1.0 : 1.0)) - (y - waistY) * 0.42 + 0.1) < 0.0028) { wear = 1.0; cc = vec3(0.92, 0.9, 0.82); cr = 0.8; }
  if (uF3.w > 0.5 && torso && n.z > 0.0 && wear < 0.5) {
    float cord = abs(abs(p.x) - (neckY + 0.005 - y) * 0.35) < 0.0018 && y > neckY - 0.1 ? 1.0 : 0.0;
    float charm = smoothstep(0.009, 0.006, length(vec2(p.x, (y - (neckY - 0.11)) * 1.3)));
    if (cord > 0.5) { cc = vec3(0.07, 0.05, 0.04); wear = 1.0; }
    if (charm > 0.5) { cc = vec3(0.85, 0.66, 0.28); cm = 0.85; cr = 0.3; wear = 1.0; }
  }
  if (uF4.w > 0.5 && arm && y > uY2.y - 0.035 && y < uY2.y + 0.0 && fract(y * 180.0) < 0.55) { wear = 1.0; cc = vec3(0.83, 0.65, 0.25); cm = 0.85; cr = 0.3; }
  if (uF5.z > 0.5 && torso && n.z > 0.0 && abs(length(vec2(p.x, (y - neckY + 0.03) * 0.55)) - 0.085) < 0.0025) { cc = vec3(0.15, 0.1, 0.07); wear = 1.0; }
  if (uF5.w > 0.5 && torso && abs((p.x * (n.z > 0.0 ? 1.0 : -1.0)) - (y - waistY - 0.25) * 0.6) < 0.016) { cc = uBag * 0.8; wear = 1.0; cr = 0.9; }
  if (wear > 0.5) {
    if (uF2.w > 0.5 && uF6.y > 0.5 && belowWaist && y < (uF1.w > 0.5 ? ankleY + 0.06 : kneeY + 0.07) && cc == uMundu) { cc = vec3(0.8, 0.62, 0.24); cm = 0.7; cr = 0.4; }
    if (uF5.x > 0.5) cc *= 0.8 + 0.25 * vn(p.xy * 25.0);
    c = cc; rough = cr; metal = cm;
  }
  return c;
}
`;

export function clothingMaterial(o, d) {
  const m = d.m, Lm = m.landmarks, B = m.bones;
  const sleeve = o.shirt != null && o.sleeves !== false && o.style !== 'wrap' ? (o.longSleeves ? 2 : 1) : 0;
  const sleeveEnd = sleeve === 2 ? B[8][1] + 0.025 : o.style === 'blouse' ? B[6][1] - 0.13 : B[7][1] + 0.06;
  const hem = o.style === 'frock' ? B[16][1] + 0.12 : o.style === 'kurta' ? B[0][1] - 0.15 : o.style === 'jacket' ? B[0][1] - 0.06 : B[0][1] + 0.05;
  const U = {
    uSkin: { value: col(o.skin) }, uShirt: { value: col(o.shirt, 0xeeeeee) }, uWaist: { value: col(o.waistcoat) }, uTie: { value: col(o.tie, 0x3a2a48) },
    uMundu: { value: col(o.mundu, 0xe9e2cf) }, uLungi: { value: col(o.lungi) }, uTrou: { value: col(o.trousers) }, uBoot: { value: col(o.boots, 0x2a1c10) },
    uPut: { value: col(o.puttees) }, uScloth: { value: col(o.shoulderCloth, 0xefe8d4) }, uNeri: { value: col(o.neriyathu, 0xefe8d4) }, uBag: { value: col(o.bag) },
    uHair: { value: col(o.grey ? 0xb4b0a6 : (o.hair ?? 0x15110e)) }, uLip: { value: o.female ? new THREE.Color(0.78, 0.48, 0.47) : new THREE.Color(0.72, 0.52, 0.5) },
    uF1: { value: new THREE.Vector4(o.shirt != null ? 1 : 0, STYLE[o.style] || 0, sleeve, o.munduLong ? 1 : 0) },
    uF2: { value: new THREE.Vector4(o.trousers != null ? (o.shorts ? 2 : 1) : 0, o.boots != null ? (o.tallBoots ? 2 : 1) : 0, o.puttees != null ? 1 : 0, o.kasavu ? 1 : 0) },
    uF3: { value: new THREE.Vector4(o.lungi != null ? 1 : 0, o.shoulderCloth != null ? 1 : 0, o.thread ? 1 : 0, o.pendant ? 1 : 0) },
    uF4: { value: new THREE.Vector4(o.moustache === 'big' ? 2 : o.moustache ? 1 : 0, o.beard === 'stubble' ? 1 : o.beard ? 2 : 0, { chandanam: 1, pottu: 2, bhasmam: 3 }[o.mark] || 0, o.bangles ? 1 : 0) },
    uF5: { value: new THREE.Vector4(o.dirty ? 1 : 0, o.sandals ? 1 : 0, o.rosary ? 1 : 0, o.bag != null && o.shirt != null ? 1 : 0) },
    uF6: { value: new THREE.Vector4(o.female ? 1 : 0, o.trousers == null ? 1 : 0, o.bald ? 0 : 1, sleeveEnd) },
    uEyeL: { value: new THREE.Vector3(...Lm.eyeL) }, uEyeR: { value: new THREE.Vector3(...Lm.eyeR) }, uMouth: { value: new THREE.Vector3(...Lm.mouth) },
    uY: { value: new THREE.Vector4(B[0][1] + 0.085, B[16][1], B[17][1], B[3][1]) },
    uY2: { value: new THREE.Vector4(B[7][1], B[8][1], B[2][1] + 0.13, hem) },
    uCov: { value: 0 },
  };
  const mat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 1, envMapIntensity: 0.8 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRest; varying vec3 vRestN; flat varying float vPart; attribute float cov; uniform float uCov; varying float vHide;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = position; vRestN = normal; vPart = skinIndex.x; vHide = (int(cov + 0.5) & int(uCov + 0.5)) != 0 ? 1.0 : 0.0;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vHide;\n' + CLOTHE_GLSL)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vHide > 0.5) discard;')
      .replace('#include <map_fragment>', 'float cR, cM; diffuseColor.rgb = clothe(cR, cM);')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = cR;')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = cM;');
  };
  mat.customProgramCacheKey = () => 'kayal-human';
  mat.userData.U = U;
  return mat;
}

// the neriyathu: a length of cloth over the left shoulder, across the breast to the right hip in
// front and down the back behind — a shell lifted off the body, its edges trimmed per pixel
const NERI_GLSL = /* glsl */`
  float nDiag = vNR.x + (vNR.y - uNC.x) * 0.45, nBack = step(vNR.z, uNC.z - 0.01);
  float nIn = nBack > 0.5 ? step(-0.16, vNR.x) * step(vNR.x, -0.03) * step(uNW, vNR.y)
                          : step(-0.05, nDiag) * step(nDiag, 0.12) * step(uNW, vNR.y);
  if (nIn < 0.5 || vNR.y > uNC.y + 0.05) discard;
  float nEdge = nBack > 0.5 ? min(vNR.x + 0.16, -0.03 - vNR.x) : min(nDiag + 0.05, 0.12 - nDiag);`;
function neriGeometry(d) {
  if (d.neri) return d.neri;
  const { pos, nrm, ski, skw, i0, m } = d, B = m.bones, chestY = B[2][1] + 0.13, neckY = B[3][1], cz = B[2][2];
  const TORSO = new Set([0, 1, 2, 3, 5, 10]);
  const near = (v) => {
    if (!TORSO.has(ski[v * 4])) return false;
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    if (y > neckY + 0.08 || y < B[0][1] + 0.06) return false;
    if (z < cz + 0.01) return x > -0.2 && x < 0.01;
    const dg = x + (y - chestY) * 0.45; return dg > -0.09 && dg < 0.16;
  };
  const idx = [], remap = new Map(), P = [], N = [], SI = [], SW = [], R = [];
  const add = (v) => {
    if (remap.has(v)) return remap.get(v);
    const n = P.length / 3; remap.set(v, n);
    const off = 0.026;
    P.push(pos[v * 3] + nrm[v * 3] * off, pos[v * 3 + 1] + nrm[v * 3 + 1] * off, pos[v * 3 + 2] + nrm[v * 3 + 2] * off);
    N.push(nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]); R.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]);
    for (let j = 0; j < 4; j++) { SI.push(ski[v * 4 + j]); SW.push(skw[v * 4 + j]); }
    return n;
  };
  for (let i = 0; i < i0.length; i += 3) if (near(i0[i]) && near(i0[i + 1]) && near(i0[i + 2])) idx.push(add(i0[i]), add(i0[i + 1]), add(i0[i + 2]));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('rest', new THREE.Float32BufferAttribute(R, 3));
  g.setAttribute('skinIndex', new THREE.Uint8BufferAttribute(SI, 4)); g.setAttribute('skinWeight', new THREE.Uint8BufferAttribute(SW, 4, true));
  g.setIndex(idx); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.2, 0), 0.5);
  return (d.neri = g);
}
const neriMats = new Map();
function neriMaterial(d, c, gold) {
  const B = d.m.bones, key = [d.m.verts, B[2][1], c, gold].join('|');
  if (neriMats.has(key)) return neriMats.get(key);
  const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, side: THREE.DoubleSide });
  const U = { uNC: { value: new THREE.Vector3(B[2][1] + 0.13, B[3][1], B[2][2]) }, uNG: { value: gold ? 1 : 0 }, uNW: { value: B[0][1] + 0.1 } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 rest; varying vec3 vNR;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvNR = rest;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vNR; uniform vec3 uNC; uniform float uNG, uNW;')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + NERI_GLSL)
      .replace('#include <map_fragment>', `#include <map_fragment>
        diffuseColor.rgb *= 0.93 + 0.07 * sin(nDiag * 900.0);
        if (uNG > 0.5 && nEdge < 0.012) diffuseColor.rgb = vec3(0.8, 0.62, 0.24);`)
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nif (uNG > 0.5 && nEdge < 0.012) metalnessFactor = 0.7;');
  };
  m.customProgramCacheKey = () => 'kayal-neri';
  neriMats.set(key, m);
  return m;
}

// ---------------------------------------------------------------- garments
// Which of the fitted MakeHuman pieces this outfit wears. The shirt over a mundu is the shirt alone;
// trousers come with their belt; coats with trousers are the full suit. What has no mesh (kurta,
// blouse, banian, chatta, uniforms with Sam Browne belts drawn on, boots and puttees) stays painted.
function choosePieces(o, d) {
  const G = d.garments, out = [];
  if (!Object.keys(G).length) return out;
  if (o.female) {
    if (o.shirt != null && o.style === 'blouse' && G.blouse) out.push(['blouse', o.shirt]);
    else if (o.shirt != null && o.style === 'chatta' && G.chatta) out.push(['chatta', o.shirt]);
    return out;
  }
  const coat = o.style === 'jacket' || o.style === 'frock';
  const trousers = o.trousers != null && !o.shorts;
  if (coat && trousers && G.suit) { out.push(['suit', o.shirt, o.waistcoat != null ? 0xeeeae0 : 0xeeeae0, o.tie ?? 0x3a2a48]); }
  else {
    // over a mundu the shirt is worn out, its hem short of the mundu's waist; with trousers it is tucked in
    if (o.shirt != null && o.sleeves !== false && (!o.style || o.style === 'uniform')) out.push([(o.longSleeves ? 'cs01U' : 'cs01H') + (o.trousers == null ? 'M' : ''), o.shirt]);
    if (trousers && G.cs01L) out.push(['cs01L', o.trousers]);
    else if (o.trousers != null && o.shorts && G.cs01S) out.push(['cs01S', o.trousers]);
  }
  if (o.boots != null && !o.tallBoots && o.puttees == null && o.trousers != null && !o.shorts && G.shoes) out.push(['shoes', o.boots]);
  return out.filter((q) => G[q[0]]);
}
const garMats = new Map();
function garmentMaterial(tex, c1, c2, c3, dirty) {
  const key = [tex, c1, c2, c3, dirty].join('|');
  if (garMats.has(key)) return garMats.get(key);
  const t = HUMANS.clothTex?.[tex] || null;
  const m = new THREE.MeshStandardMaterial({ color: c1 ?? 0xeeeeee, map: t, roughness: tex === 'shoes' ? 0.45 : 0.88, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.7 });
  const U = { uC2: { value: col(c2, 0xeeeae0) }, uC3: { value: col(c3, 0x3a2a48) }, uDirt: { value: dirty ? 1 : 0 } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uC2, uC3; uniform float uDirt;')
      .replace('#include <map_fragment>', `#ifdef USE_MAP
        vec4 gT = texture2D(map, vMapUv); float gd = gT.r / 0.75;
        vec3 gc = diffuseColor.rgb;
        gc = mix(gc, uC2, gT.g); gc = mix(gc, uC3, gT.b);
        diffuseColor.rgb = gc * gd * (1.0 - uDirt * 0.18 * (1.0 - gd));
      #endif`);
  };
  m.customProgramCacheKey = () => 'kayal-garment';
  garMats.set(key, m);
  return m;
}

const MOUTH_GEO = new THREE.SphereGeometry(1, 12, 8), MOUTH_MAT = new THREE.MeshStandardMaterial({ color: 0x2a0f0c, roughness: 0.7 });
// the hair shell is trimmed per pixel along the hairline, so its edge is a smooth line rather than triangle steps
function hairMaterial(o, d) {
  const base = hairMat(o.grey ? 0xb4b0a6 : (o.hair ?? 0x15110e)), Lm = d.m.landmarks;
  const m = base.clone();
  const e = [(Lm.eyeL[0] + Lm.eyeR[0]) / 2, (Lm.eyeL[1] + Lm.eyeR[1]) / 2, (Lm.eyeL[2] + Lm.eyeR[2]) / 2];
  const U = { uHE: { value: new THREE.Vector3(...e) }, uHM: { value: Lm.mouth[1] }, uHR: { value: o.receding ? 0.025 : 0 }, uHF: { value: o.female || o.longHair ? 1 : 0 } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vHR;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvHR = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vHR; uniform vec3 uHE; uniform float uHM, uHR, uHF;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        { vec3 p = vHR; float front = p.z - (uHE.z - 0.08), side = abs(p.x - uHE.x);
          float lf = uHE.y + 0.046 + uHR - min(0.03, side * 0.4) + 0.002 * sin(p.x * 900.0);
          float ls = uHE.y + (side > 0.06 ? 0.018 : 0.03);
          float lb = uHF > 0.5 ? uHM - 0.05 : uHM - 0.012;
          float line = front > 0.045 ? lf : front > -0.02 ? mix(ls, lf, (front + 0.02) / 0.065) : mix(ls, lb, clamp((-0.02 - front) / 0.05, 0.0, 1.0));
          if (p.y < line || (side > 0.068 && p.y < uHE.y + 0.03 && front > -0.04)) discard; }`);
  };
  m.customProgramCacheKey = () => 'kayal-hair';
  return m;
}
let eyeMat = null;
function eyeMaterial() {
  if (eyeMat) return eyeMat;
  const t = HUMANS.eyeTex; if (t) t.colorSpace = THREE.SRGBColorSpace;
  return (eyeMat = new THREE.MeshStandardMaterial({ map: t || null, color: t ? 0xffffff : 0xdedad2, roughness: 0.12, metalness: 0 }));
}

// ---------------------------------------------------------------- build onto a Human
export function buildBody(h, o, key) {
  const d = bodyData(key), m = d.m, B = m.bones;
  const bone = (parent, i) => { const b = new THREE.Bone(); const p = PARENT[i]; const w = B[i], q = p < 0 ? [0, 0, 0] : B[p]; b.position.set(w[0] - q[0], w[1] - q[1], w[2] - q[2]); parent.add(b); return b; };
  const bs = [];
  for (let i = 0; i < B.length; i++) bs.push(bone(PARENT[i] < 0 ? h.body : bs[PARENT[i]], i));
  [h.hips, h.spine, h.chest, h.neck, h.head] = bs;
  h.armL = { cl: bs[5], sh: bs[6], el: bs[7], hand: bs[8], fing: bs[9] };
  h.armR = { cl: bs[10], sh: bs[11], el: bs[12], hand: bs[13], fing: bs[14] };
  h.legL = { hp: bs[15], kn: bs[16], ft: bs[17], toe: bs[18] };
  h.legR = { hp: bs[19], kn: bs[20], ft: bs[21], toe: bs[22] };
  h.hem = bs[23]; h.jaw = bs[24]; h.lidL = bs[25]; h.lidR = bs[26];
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  h.rig = {
    hipY: B[0][1], thigh: dist(B[15], B[16]), shin: dist(B[16], B[17]), hipX: Math.abs(B[15][0]), hipDrop: B[0][1] - B[15][1], hipZ: B[15][2] - B[0][2],
    ankle: B[17][1], hem: B[23][1] - B[0][1], toe: [B[18][0] - B[17][0], B[18][1] - B[17][1], B[18][2] - B[17][2]],
  };
  const skel = new THREE.Skeleton(bs);
  h.lodGeos = d.lods;
  const mat = clothingMaterial(o, d);
  const mesh = h.mesh = new THREE.SkinnedMesh(d.lods[0], mat);
  // culled against a sphere that holds any pose (crouched, riding, fallen) rather than not culled at all
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.85, 0), 1.75);
  h.root.add(mesh);
  h.root.updateMatrixWorld(true);
  mesh.bind(skel);
  const extra = (geo, mt, shadow = true) => { const sm = new THREE.SkinnedMesh(geo, mt); sm.castShadow = shadow; sm.boundingSphere = mesh.boundingSphere; h.root.add(sm); sm.bind(skel, mesh.bindMatrix); return sm; };
  h.eyes = extra(d.eyes, eyeMaterial(), false);
  // the inside of the mouth (MakeHuman's lips are parted, with nothing behind them)
  { const Lm = m.landmarks, mi = new THREE.Mesh(MOUTH_GEO, MOUTH_MAT); mi.position.set(Lm.mouth[0] - B[4][0], Lm.mouth[1] - B[4][1] - 0.003, Lm.mouth[2] - B[4][2] - 0.034); mi.scale.set(0.021, 0.011, 0.016); bs[24].add(mi); }
  const hat = o.headgear && o.headgear !== 'thorthu';
  const pieces = choosePieces(o, d);
  if (!o.bald) h.hairMesh = extra(hairGeometry(d, o.female || o.longHair ? 'long' : o.receding ? 'receding' : 'short'), hairMaterial(o, d));
  if (o.trousers == null && o.mundu != null) {
    // the mundu's own cloth, painted by the same atlas the old figures used
    const over = pieces.some((q) => q[0].endsWith('M')) ? 2 : o.shirt != null && o.style !== 'blouse' ? 1 : 0;
    h.skirt = extra(skirtGeometry(d, !!o.munduLong, over), h.skirtMaterial);
  }
  // garments: fitted pieces over the body, the skin they cover discarded, the painted version turned off
  h.garments = [];
  let bits = 0;
  for (const [pn, c1, c2, c3] of pieces) {
    const info = m.garments[pn], gm = extra(d.garments[pn][0], garmentMaterial(info.tex, c1, c2, c3, o.dirty));
    gm.userData.lods = d.garments[pn]; gm.receiveShadow = true; gm.castShadow = false; h.garments.push(gm); bits |= info.bit;
    if (pn.startsWith('cs01U') || pn.startsWith('cs01H') || pn === 'suit' || pn === 'blouse' || pn === 'chatta') mat.userData.U.uF1.value.x = 0;
    if (pn === 'cs01L' || pn === 'cs01S' || pn === 'suit') mat.userData.U.uF2.value.x = 0;
    if (pn === 'shoes') mat.userData.U.uF2.value.y = 0;
  }
  if (pieces.some((q) => q[0] === 'blouse') && o.neriyathu != null) { const nm = extra(neriGeometry(d), neriMaterial(d, o.neriyathu, o.kasavu), false); h.garments.push(nm); nm.userData.lods = [nm.geometry, nm.geometry]; }
  // far away the painted clothes stand in for the meshes: what they were before the meshes turned them off
  const U = mat.userData.U;
  h.garPaint = h.garments.length ? { on: [U.uF1.value.x, U.uF2.value.x, U.uF2.value.y, bits], off: [o.shirt != null ? 1 : 0, o.trousers != null ? (o.shorts ? 2 : 1) : 0, o.boots != null ? (o.tallBoots ? 2 : 1) : 0, 0] } : null;
  U.uCov.value = bits;
  h.mh = { key, mat, d, hat };
  return bs;
}

// where the old figure kept a joint, relative to this body's joint: accessories built for the old
// proportions are carried in groups at these offsets so they sit right on the new bodies
export function legacyAnchors(h, o, RIG) {
  const B = h.mh.d.m.bones, Lm = h.mh.d.m.landmarks, fem = !!o.female, SX = RIG.shoulderX(fem);
  const leg = { hips: [0, 0.94, 0], chest: [0, 1.24, 0], handL: [-(SX + 0.029), 0.885, 0.002], handR: [SX + 0.029, 0.885, 0.002] };
  const idx = { hips: 0, chest: 2, handL: 8, handR: 13 };
  const out = {};
  for (const k in leg) { const b = B[idx[k]], g = new THREE.Group(); g.position.set(leg[k][0] - b[0], leg[k][1] - b[1], leg[k][2] - b[2]); out[k] = g; }
  // the head: map the old skull's crown and width onto this body's
  const g = new THREE.Group(), hp = B[4];
  const k = clamp(Math.abs(Lm.eyeL[0] - Lm.eyeR[0]) / 0.058, 0.9, 1.15);
  const topRel = Lm.top - hp[1];
  g.scale.set(k * 0.98, k, k * 1.02);
  g.position.set(0, topRel - 0.226 * k + 0.012, (Lm.head[2] - hp[2]) - 0.004 * k + 0.012);
  out.head = g;
  return out;
}

// per-frame: level of detail, talking jaw, blinking lids
export function updateFace(h, dt) {
  if (!h.mh) return;
  const want = h.heroLOD ? 0 : h.near ? 0 : h.lod ? 2 : 1;
  if (h.lodIdx !== want) {
    h.lodIdx = want; h.mesh.geometry = h.lodGeos[want];
    for (const g of h.garments || []) { g.geometry = g.userData.lods[want ? 1 : 0]; g.visible = want < 2; }
    if (h.garPaint) { const v = want < 2 ? h.garPaint.on : h.garPaint.off, U = h.mh.mat.userData.U; U.uF1.value.x = v[0]; U.uF2.value.x = v[1]; U.uF2.value.y = v[2]; U.uCov.value = v[3]; }
  }
  const t = h.t, ex = h.expr;
  const talk = h.talking ? 0.05 + 0.09 * Math.max(0, (Math.sin(t * 17) + Math.sin(t * 7.3)) * 0.5) : 0;
  const jaw = Math.max(talk, ex === 'laughing' ? 0.16 : ex === 'grieving' ? 0.05 : 0);
  h.jaw.rotation.x = lerp(h.jaw.rotation.x, jaw, 1 - Math.exp(-dt * 25));
  const squint = ex === 'laughing' ? 0.32 : ex === 'angry' ? 0.18 : ex === 'determined' ? 0.12 : ex === 'grieving' ? 0.26 : ex === 'worried' ? -0.05 : 0;
  const lid = h.blink ? 0.62 : squint;
  for (const l of [h.lidL, h.lidR]) l.rotation.x = lerp(l.rotation.x, lid, 1 - Math.exp(-dt * (h.blink ? 60 : 12)));
}
