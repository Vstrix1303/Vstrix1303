// What people wear on their heads and carry, modelled as shaped surfaces —
// hair that follows the skull, hats turned on smooth profiles, cupped ears,
// a plaited braid, a soft satchel — rather than assembled from primitives.
import * as THREE from 'three';
import { SGB } from './geo.js';
import { skullAt } from './body.js';
import { normalFromCanvas } from './texmaps.js';
import { clamp, lerp, smoothstep } from './util.js';

const HEAD_Y = 1.55;                      // rest height of the head joint
const cache = new Map();
const memo = (k, f) => { if (!cache.has(k)) cache.set(k, f()); return cache.get(k); };
const V2 = (pts) => pts.map(([r, h]) => new THREE.Vector2(r, h));
const wrap = (th) => { let a = th % (Math.PI * 2); if (a > Math.PI) a -= Math.PI * 2; if (a < -Math.PI) a += Math.PI * 2; return a; };
const RU = [0, 0, 256, 256];

// ---- fine normal maps shared by all hair and all wound cloth
let _hairN = null, _wrapN = null, _weaveN = null;
function strokes(dir, n, seed) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'); g.fillStyle = '#808080'; g.fillRect(0, 0, 256, 256);
  let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n; i++) {
    const v = 90 + rnd() * 110; g.strokeStyle = `rgb(${v},${v},${v})`; g.lineWidth = 0.8 + rnd() * (dir === 'wrap' ? 5 : 1.6);
    const x = rnd() * 256, y = rnd() * 256;
    g.beginPath();
    if (dir === 'hair') { g.moveTo(x, y); g.bezierCurveTo(x + (rnd() - 0.5) * 10, y + 30, x + (rnd() - 0.5) * 14, y + 60, x + (rnd() - 0.5) * 18, y + 90 + rnd() * 60); }
    else if (dir === 'wrap') { g.moveTo(-10, y); g.bezierCurveTo(80, y + 26 + rnd() * 10, 170, y + 50, 266, y + 78 + rnd() * 14); }
    else { g.moveTo(x, y); g.lineTo(x + (i % 2 ? 9 : 0), y + (i % 2 ? 0 : 9)); }
    g.stroke();
  }
  return c;
}
const hairNormal = () => _hairN || (_hairN = normalFromCanvas(strokes('hair', 900, 7), 256, 4, true));
const wrapNormal = () => _wrapN || (_wrapN = normalFromCanvas(strokes('wrap', 46, 11), 256, 5, true));
const weaveNormal = () => _weaveN || (_weaveN = normalFromCanvas(strokes('weave', 2600, 5), 256, 4, true));

const mats = new Map();
export function hairMat(color) { return memo('hm' + color, () => new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0, normalMap: hairNormal(), normalScale: new THREE.Vector2(0.9, 0.9) })); }
export function clothMat(color, wound = false, rough = 0.92) { return memo('cm' + color + wound + rough, () => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, side: THREE.DoubleSide, normalMap: wound ? wrapNormal() : weaveNormal(), normalScale: new THREE.Vector2(wound ? 1 : 0.5, wound ? 1 : 0.5) })); }
export function feltMat(color, rough = 0.6) { return memo('fm' + color + rough, () => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, side: THREE.DoubleSide })); }

// ---- hair: a shell lofted just outside the skull, with a real hairline (the face side is tucked under the scalp)
export function hairGeo(fem, receding, hs, under) {
  return memo(['hair', fem, receding, hs, under].join(), () => {
    const g = new SGB(256);
    const Y = fem ? [1.585, 1.605, 1.63, 1.655, 1.68, 1.705, 1.728, 1.748, 1.765, 1.777] : [1.612, 1.632, 1.655, 1.68, 1.705, 1.728, 1.748, 1.765, 1.777];
    // angle from straight ahead at which the hair begins, by height
    const line = (y) => {
      const pts = receding ? [[1.6, 2.3], [1.63, 1.95], [1.655, 1.6], [1.68, 1.35], [1.705, 1.2], [1.73, 1.05], [1.75, 0.8], [1.765, 0.45], [1.78, 0]] : [[1.6, 2.25], [1.63, 1.9], [1.655, 1.52], [1.68, 1.2], [1.705, 0.9], [1.728, 0.55], [1.742, 0], [1.78, 0]];
      for (let i = 1; i < pts.length; i++) if (y <= pts[i][0]) { const a = pts[i - 1], b = pts[i]; return lerp(a[1], b[1], clamp((y - a[0]) / (b[0] - a[0]), 0, 1)); }
      return 0;
    };
    g.loft(Y.map((y, i) => {
      const [rx0, zf0, zb0] = skullAt(y), th = (under ? 0.004 : 0.008 + 0.006 * smoothstep(1.66, 1.75, y)) + (fem ? 0.004 : 0);
      const af = line(y) + (fem ? -0.12 : 0);
      return {
        c: [0, y - HEAD_Y, 0.004 - (fem && y < 1.66 ? (1.66 - y) * 0.25 : 0)], ax: [rx0 * hs, 0, 0], az: [0, 0, zf0 * hs], azB: [0, 0, zb0 * hs], v: 1 - i / (Y.length - 1),
        mod: (t) => { const A = Math.abs(wrap(t)), r = Math.hypot(rx0 * Math.sin(t), (Math.cos(t) >= 0 ? zf0 : zb0) * Math.cos(t)) * hs || 1; return lerp(0.9, 1 + th / r, af <= 0.01 ? 1 : smoothstep(af - 0.07, af + 0.07, A)); },
      };
    }), 28, RU, { capEnd: 0.012 });
    return g.build(false);
  });
}
// ---- an ear: a shallow cup with a rolled rim
export function earGeo() {
  return memo('ear', () => { const g = new THREE.LatheGeometry(V2([[0.0005, 0.0045], [0.006, 0.0025], [0.0115, 0.0035], [0.0155, 0.0075], [0.0165, 0.011], [0.015, 0.0135], [0.0125, 0.0125]]), 14); g.scale(1.8, 1, 1); return g; });
}
// ---- hair knotted behind the head
export function bunGeo() { return memo('bun', () => new THREE.LatheGeometry(V2([[0.0005, -0.034], [0.024, -0.028], [0.04, -0.01], [0.042, 0.008], [0.03, 0.026], [0.012, 0.034], [0.0005, 0.036]]), 16)); }
// ---- a plait: it narrows and swells strand over strand, down to a tuft
export function braidGeo() {
  return memo('braid', () => {
    const g = new SGB(256), rows = [];
    for (let i = 0; i <= 18; i++) { const t = i / 18, w = (0.027 - 0.01 * t) * (1 + 0.22 * Math.sin(i * Math.PI)) * (i % 2 ? 1.12 : 0.9); rows.push({ c: [Math.sin(i * 1.57) * 0.004, -t * 0.46, -0.012 - Math.sin(t * 2) * 0.012], ax: [w, 0, 0], az: [0, 0, w * 0.8], v: t * 3 }); }
    rows.push({ c: [0, -0.49, -0.03], ax: [0.016, 0, 0], az: [0, 0, 0.012], v: 3.1 }, { c: [0, -0.53, -0.032], ax: [0.006, 0, 0], az: [0, 0, 0.005], v: 3.3 });
    g.loft(rows, 10, RU, { capStart: 0.005, capEnd: 0.008 });
    return g.build(false);
  });
}
// ---- hats and head-cloths, turned on a profile ([radius, height above the head joint])
const HATS = {
  turban: [[0.096, 0.15], [0.11, 0.164], [0.118, 0.19], [0.114, 0.222], [0.094, 0.252], [0.052, 0.272], [0.0005, 0.278]],
  thorthu: [[0.094, 0.152], [0.104, 0.16], [0.108, 0.178], [0.102, 0.196], [0.092, 0.2], [0.087, 0.192]],
  cap: [[0.094, 0.15], [0.0975, 0.168], [0.097, 0.2], [0.087, 0.228], [0.052, 0.243], [0.0005, 0.246]],
  topi: [[0.158, 0.126], [0.15, 0.134], [0.122, 0.15], [0.103, 0.162], [0.101, 0.175], [0.096, 0.212], [0.076, 0.25], [0.04, 0.27], [0.0005, 0.276]],
  tophat: [[0.132, 0.198], [0.126, 0.186], [0.1, 0.18], [0.085, 0.186], [0.081, 0.2], [0.079, 0.3], [0.081, 0.36], [0.076, 0.369], [0.0005, 0.37]],
  slouch: [[0.172, 0.166], [0.165, 0.16], [0.12, 0.168], [0.094, 0.176], [0.091, 0.21], [0.081, 0.25], [0.05, 0.268], [0.0005, 0.262]],
  fez: [[0.084, 0.158], [0.083, 0.166], [0.067, 0.27], [0.062, 0.276], [0.0005, 0.276]],
};
export function hatGeo(kind) { return memo('hat' + kind, () => { const g = new THREE.LatheGeometry(V2(HATS[kind]), 24); g.scale(0.84, 1, 1.03); return g; }); }
export function bandGeo(r, y, h) { return memo(['band', r, y, h].join(), () => { const g = new THREE.LatheGeometry(V2([[r, y], [r + 0.003, y + h * 0.5], [r, y + h]]), 24); g.scale(0.84, 1, 1.03); return g; }); }
// the knot and hanging end of a tied cloth
export function knotGeo() {
  return memo('knot', () => {
    const g = new SGB(256);
    g.loft([[0.02, 0.012], [0.0, 0.022], [-0.03, 0.02], [-0.07, 0.024], [-0.11, 0.03], [-0.125, 0.012]].map(([y, w], i) => ({ c: [Math.sin(i) * 0.004, y, -i * 0.003], ax: [w, 0, 0], az: [0, 0, 0.008], v: i / 5 })), 8, RU, { capStart: 0.004, capEnd: 0.004 });
    return g.build(false);
  });
}
// ---- a cloth satchel: soft-cornered, sagging, with a flap
export function bagGeo() {
  return memo('bag', () => {
    const g = new SGB(256), sq = (t) => 1 / Math.pow(Math.pow(Math.abs(Math.sin(t)), 3) + Math.pow(Math.abs(Math.cos(t)), 3), 1 / 3);
    g.loft([[0.115, 0.03, 0.085], [0.09, 0.034, 0.1], [0.0, 0.04, 0.105], [-0.08, 0.044, 0.108], [-0.118, 0.034, 0.095]].map(([y, tx, wz], i) => ({ c: [0, y, 0], ax: [tx, 0, 0], az: [0, 0, wz], v: i / 4, mod: sq })), 14, RU, { capStart: 0.01, capEnd: 0.018 });
    g.loft([[0.118, 0.034, 0.09], [0.07, 0.04, 0.106], [0.0, 0.043, 0.108], [-0.02, 0.041, 0.1]].map(([y, tx, wz], i) => ({ c: [0.004, y, 0], ax: [tx, 0, 0], az: [0, 0, wz], v: i / 3, mod: sq })), 14, RU, { capStart: 0.008 });
    return g.build(false);
  });
}
// ---- the palm-leaf rain cape and its hood; the palm-leaf umbrella
export function capeGeo() { return memo('cape', () => new THREE.LatheGeometry(V2([[0.19, 0.3], [0.215, 0.22], [0.25, 0.02], [0.3, -0.25], [0.35, -0.5], [0.37, -0.62]]), 18, Math.PI * 0.42, Math.PI * 1.16)); }
export function hoodGeo() { return memo('hood', () => new THREE.LatheGeometry(V2([[0.0005, 0.33], [0.05, 0.3], [0.115, 0.21], [0.165, 0.11], [0.2, 0.02], [0.215, -0.05]]), 18, Math.PI * 0.3, Math.PI * 1.4)); }
export function canopyGeo() { return memo('canopy', () => new THREE.LatheGeometry(V2([[0.0005, 0.13], [0.2, 0.105], [0.42, 0.045], [0.6, -0.03], [0.63, -0.05]]), 20)); }
