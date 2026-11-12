// The built world of 1905 Travancore: a backwater village, a temple, a
// spice port with its Company compound and the hill-top Cutcherry.
import * as THREE from 'three';
import { Builder, makeMaterials } from './builder.js';
import { GB, TRS } from './geo.js';
import { LOC, getHeight, canalZ } from './heightfield.js';
import { makeRng, TAU } from './util.js';

export const SPOTS = {};   // named world positions used by the story
const BRASS = [0.95, 0.72, 0.28];
const DOOR = [0.55, 0.42, 0.34];

function house(b, x, z, ry, o = {}) {
  const w = o.w || 8, d = o.d || 6, wallH = o.wallH || 2.7, ov = o.overhang ?? 1.4;
  const wall = o.wall || 'wall', roof = o.roof || 'roof';
  b.place(x, z, ry);
  b.box('laterite', w + ov * 2 - 0.5, 2.0, d + ov * 2 - 0.5, 0, -1.5, 0);
  const y0 = 0.5;
  b.box(wall, w, wallH, d, 0, y0, 0, { col: o.col });
  b.box(wall, w + 0.05, 0.55, d + 0.05, 0, y0, 0, { col: wall === 'wall' ? [0.6, 0.58, 0.5] : [0.62, 0.6, 0.58] });
  b.box('wood', 1.34, 2.12, 0.1, o.doorX || 0, y0, d / 2 + 0.0, { col: [0.3, 0.24, 0.2] });
  b.box('wood', 1.1, 2.0, 0.14, o.doorX || 0, y0, d / 2 + 0.02, { col: DOOR });
  for (const sx of [-1, 1]) {
    if (Math.abs(sx * w * 0.32 - (o.doorX || 0)) > 0.9) b.box('wood', 0.9, 1.0, 0.1, sx * w * 0.32, y0 + 1.0, d / 2 + 0.02);
    b.box('wood', 0.1, 1.0, 0.9, sx * (w / 2 + 0.02), y0 + 1.0, 0);
  }
  const rh = (d / 2 + ov) * (o.pitch || 0.82);
  b.roofHip(roof, w + ov * 2, d + ov * 2, rh, Math.max(w - d, w * 0.3), 0, y0 + wallH - 0.2, 0);
  b.box(roof === 'roof' ? 'roof' : 'thatch', Math.max(w - d, w * 0.3) + 0.3, 0.14, 0.34, 0, y0 + wallH - 0.2 + rh - 0.05, 0, { col: [0.6, 0.55, 0.5], tile: 1 });
  if (o.smoke ?? (Math.abs(Math.round(x * 7 + z * 13)) % 3 < 1)) b.smoke(w * 0.25, y0 + wallH + rh * 0.55, -d * 0.2);
  const np = Math.max(2, Math.round(w / 2.6));
  for (let i = 0; i <= np; i++) b.box('wood', 0.16, wallH - 0.25, 0.16, -w / 2 - ov + 0.5 + i * (w + ov * 2 - 1) / np, y0, d / 2 + ov - 0.45);
  b.box('stone', 1.8, 0.28, 0.6, o.doorX || 0, 0, d / 2 + ov - 0.05);
  b.collider(0, 0, (w + ov * 2 - 0.5) / 2, (d + ov * 2 - 0.5) / 2);
  b.yard(Math.max(w, d) * 0.75 + 5, 0.7).clear(Math.max(w, d) * 0.62 + 2).mark(w + 2, d + 2);
  if (o.lamp) b.lamp(o.doorX ? o.doorX + 1.2 : 1.4, y0 + 1.9, d / 2 + ov - 0.5, 1, 0);
}

function lampPost(b, x, z, light = 0) {
  b.place(x, z, 0);
  b.box('wood', 0.14, 3.2, 0.14, 0, 0, 0);
  b.box('wood', 0.7, 0.1, 0.1, 0.3, 3.0, 0);
  b.box('paint', 0.22, 0.3, 0.22, 0.6, 2.62, 0, { col: [0.95, 0.75, 0.35] });
  b.lamp(0.6, 2.78, 0, 1.2, light);
  b.circle(0, 0, 0.15);
}

function crates(b, x, z, ry, rng, n = 4, kind = 'mix') {
  b.place(x, z, ry);
  for (let i = 0; i < n; i++) {
    const px = (rng() - 0.5) * 2.4, pz = (rng() - 0.5) * 2.0, r = rng();
    if (kind === 'sack' || (kind === 'mix' && r < 0.4)) {
      b.sphere('sack', 0.45, px, 0.3, pz, { sx: 1.3, sy: 0.7, sz: 0.9 });
      if (rng() < 0.5) b.sphere('sack', 0.42, px + 0.2, 0.75, pz, { sx: 1.25, sy: 0.65, sz: 0.9 });
    } else if (r < 0.75) {
      const s = 0.7 + rng() * 0.5;
      b.box('plank', s, s, s, px, 0, pz, { ry: rng(), tile: 1 });
      if (rng() < 0.35) b.box('plank', s * 0.8, s * 0.8, s * 0.8, px, s, pz, { ry: rng(), tile: 1 });
    } else {
      b.cyl('wood', 0.36, 0.33, 0.95, px, 0, pz, { seg: 10 });
    }
  }
  b.collider(0, 0, 1.6, 1.3);
}

function spiceStall(b, x, z, ry, rng) {
  b.place(x, z, ry);
  for (const sx of [-1.6, 1.6]) for (const sz of [-1, 1]) b.box('wood', 0.1, 2.3 - sz * 0.25, 0.1, sx, 0, sz);
  b.box('thatch', 3.8, 0.08, 2.8, 0, 2.2, 0, { rx: 0.2, tile: 1.5 });
  b.box('plank', 3.0, 0.75, 1.0, 0, 0, 0.3, { tile: 1 });
  const cols = [[0.9, 0.62, 0.1], [0.72, 0.13, 0.08], [0.1, 0.09, 0.08], [0.45, 0.3, 0.14], [0.55, 0.6, 0.2]];
  for (let i = 0; i < 5; i++) {
    b.cyl('wood', 0.26, 0.2, 0.12, -1.15 + i * 0.58, 0.75, 0.3, { seg: 10 });
    b.cone('paint', 0.22, 0.26, -1.15 + i * 0.58, 0.85, 0.3, { seg: 10, col: cols[i] });
  }
  b.collider(0, 0.3, 1.6, 0.6);
  b.yard(5, 0.9);
}

function jetty(b, x, z, ry, len, w, deck = 0.75) {
  b.place(x, z, ry, 0);
  b.box('plank', w, 0.14, len, 0, deck - 0.14, len / 2, { tile: 1.6 });
  for (let i = 0; i <= len; i += 3.2) for (const sx of [-1, 1]) {
    b.cyl('wood', 0.11, 0.13, deck + 4.2, sx * (w / 2 - 0.08), -4, i, { seg: 6 });
    if (i % 6.4 < 0.1) b.cyl('wood', 0.09, 0.1, 0.8, sx * (w / 2 - 0.08), deck, i, { seg: 6 });
  }
  b.platform(0, len / 2, w / 2, len / 2, deck);
}

function bridge(b, x, z, ry, len, w, deck) {
  b.place(x, z, ry, 0);
  b.box('plank', w, 0.2, len, 0, deck - 0.2, 0, { tile: 1.6 });
  for (const sx of [-1, 1]) {
    b.box('wood', 0.1, 0.1, len, sx * (w / 2 - 0.05), deck + 0.85, 0);
    for (let i = -len / 2; i <= len / 2; i += 2.5) b.box('wood', 0.1, 0.9, 0.1, sx * (w / 2 - 0.05), deck, i);
    for (let i = -len / 2 + 4; i <= len / 2 - 4; i += 5) b.cyl('wood', 0.15, 0.17, deck + 3, sx * (w / 2 - 0.2), -3, i, { seg: 6 });
    b.collider(sx * (w / 2 + 0.05), 0, 0.12, len / 2 - 2.5);
  }
  b.platform(0, 0, w / 2, len / 2, deck);
}

function wallRun(b, mat, x0, z0, x1, z1, h = 1.3, t = 0.45, cap = true) {
  // local-space wall between two points (axis-aligned in local space)
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, len = Math.hypot(x1 - x0, z1 - z0);
  const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  b.box(mat, alongX ? len : t, h + 1, alongX ? t : len, cx, -1, cz);
  if (cap) b.box('laterite', alongX ? len : t + 0.14, 0.12, alongX ? t + 0.14 : len, cx, h, cz, { col: [0.75, 0.7, 0.68] });
  b.collider(cx, cz, alongX ? len / 2 : t / 2, alongX ? t / 2 : len / 2, 0, h + 0.4);
}

function cheenavala(b, x, z, ry) {
  // Chinese fishing net: cantilevered teak frame over the water
  b.place(x, z, ry, 0.9);
  b.box('plank', 3.5, 0.15, 4, 0, 0, -1, { tile: 1.5 });
  for (const sx of [-1.4, 1.4]) { b.cyl('wood', 0.1, 0.12, 4, sx, -3, 0.6, { seg: 6 }); b.cyl('wood', 0.1, 0.12, 4, sx, -3, -2.6, { seg: 6 }); }
  const tilt = 0.5;
  for (const sx of [-1, 1]) {
    b.cyl('wood', 0.07, 0.09, 9, sx * 1.2, 0.1, 1.2, { seg: 5, rx: tilt + 0.55, rz: -sx * 0.1 });
    b.cyl('wood', 0.06, 0.08, 7.5, sx * 0.9, 0.1, -0.5, { seg: 5, rx: -0.75, rz: -sx * 0.06 });
  }
  b.cyl('wood', 0.07, 0.07, 3.2, 0, 3.6, 0.2, { seg: 5, rz: Math.PI / 2 });
  // net: a sagging square
  const g = new GB(), S = 3.4, cz = 7.2, cy = 1.6;
  const pts = [[-S, cy + 0.8, cz - S * 0.7], [S, cy + 0.8, cz - S * 0.7], [S, cy + 0.8, cz + S * 0.7], [-S, cy + 0.8, cz + S * 0.7]];
  const c = g.vert(0, cy - 1.3, cz, 0, 1, 0, 3, 3);
  const vi = pts.map((p, i) => g.vert(p[0], p[1], p[2], 0, 1, 0, i === 1 || i === 2 ? 6 : 0, i >= 2 ? 6 : 0));
  for (let i = 0; i < 4; i++) g.tri(c, vi[i], vi[(i + 1) % 4]);
  b.geo('net', g.build(), new THREE.Matrix4());
  for (const p of pts) b.cyl('wood', 0.03, 0.03, 0.05, p[0], p[1], p[2], { seg: 4 });
  // counterweights
  for (let i = 0; i < 4; i++) b.sphere('stone', 0.22, -0.9 + i * 0.6, 2.2 - i * 0.25, -4.2 - i * 0.3, { col: [0.7, 0.7, 0.7] });
}

function well(b, x, z) {
  b.place(x, z, 0);
  b.cyl('laterite', 1.0, 1.0, 0.9, 0, 0, 0, { seg: 14, open: true });
  b.cyl('paint', 0.9, 0.9, 0.05, 0, 0.25, 0, { seg: 14, col: [0.05, 0.09, 0.1] });
  for (const sx of [-1, 1]) b.box('wood', 0.12, 2.2, 0.12, sx * 1.05, 0, 0);
  b.box('wood', 2.3, 0.12, 0.12, 0, 2.1, 0);
  b.cyl('wood', 0.18, 0.18, 0.14, 0, 1.8, 0, { seg: 8, rx: Math.PI / 2 });
  b.circle(0, 0, 1.1);
}

function cart(b, x, z, ry) {
  b.place(x, z, ry);
  b.box('plank', 1.5, 0.12, 2.6, 0, 0.95, 0, { tile: 1 });
  for (const sx of [-1, 1]) {
    b.cyl('wood', 0.75, 0.75, 0.1, sx * 0.9, 0.7, 0, { seg: 14, rz: Math.PI / 2 });
    b.box('plank', 0.06, 0.5, 2.6, sx * 0.72, 1.05, 0, { tile: 1 });
  }
  b.box('wood', 0.1, 0.1, 2.6, 0, 0.9, 2.4, { rx: -0.12 });
  b.collider(0, 0, 1.0, 1.4);
}

function haystack(b, x, z, s = 1) {
  b.place(x, z, 0);
  b.cyl('thatch', 1.2 * s, 1.6 * s, 1.6 * s, 0, 0, 0, { seg: 10 });
  b.cone('thatch', 1.3 * s, 1.5 * s, 0, 1.6 * s, 0, { seg: 10 });
  b.circle(0, 0, 1.5 * s);
}

function pots(b, x, z, n, rng) {
  b.place(x, z, 0);
  for (let i = 0; i < n; i++) {
    const s = 0.22 + rng() * 0.16;
    b.sphere('paint', s, (rng() - 0.5) * 1.4, s * 0.85, (rng() - 0.5) * 1.4, { sy: 0.9, col: rng() < 0.6 ? [0.55, 0.26, 0.14] : [0.75, 0.58, 0.22] });
  }
}

export function buildStructures(scene) {
  const b = new Builder();
  const rng = makeRng(190577);
  const mats = makeMaterials();
  const bigTrees = [];

  // ================= village houses =================
  const H = [
    [-152, 17, 0, { w: 7 }], [-116, 9, 0.05, { roof: 'thatch', wall: 'laterite', w: 6, d: 5 }], [-84, 3, 0.1, { w: 9 }],
    [-12, -12, 0.2, { w: 8, lamp: 1 }], [34, -22, 0.1, { roof: 'thatch', wall: 'laterite', w: 6, d: 5 }], [86, -36, 0.5, { w: 8 }],
    [-162, 52, Math.PI, { roof: 'thatch', wall: 'laterite', w: 6, d: 5 }], [-128, 46, Math.PI, { w: 8 }], [-90, 40, Math.PI + 0.1, { w: 7, lamp: 1 }],
    [-64, 34, Math.PI + 0.1, { roof: 'thatch', wall: 'laterite', w: 5.5, d: 4.5 }], [-6, 24, Math.PI + 0.15, { w: 7 }],
    [104, -6, Math.PI + 0.5, { w: 7 }], [140, -42, Math.PI + 0.6, { roof: 'thatch', wall: 'laterite', w: 6, d: 5 }],
    [-76, -60, Math.PI / 2, { w: 7 }], [-36, -78, -Math.PI / 2, { roof: 'thatch', wall: 'laterite', w: 6, d: 5 }],
    [-56, 84, Math.PI / 2, { w: 7 }], [-10, 110, -Math.PI / 2, { roof: 'thatch', wall: 'laterite', w: 6, d: 5 }], [-52, 132, Math.PI / 2, { w: 6, d: 5, roof: 'thatch', wall: 'laterite' }],
  ];
  for (const [x, z, ry, o] of H) house(b, x, z, ry, o);

  // tea shop at the junction
  {
    house(b, -22, 30, Math.PI + 0.9, { w: 6, d: 4.5, roof: 'thatch', wall: 'laterite', lamp: 1 });
    b.place(-26.5, 22, 0.9);
    b.box('plank', 2.2, 0.08, 0.45, 0, 0.45, 0, { tile: 1 }); b.box('wood', 0.1, 0.45, 0.4, -0.9, 0, 0); b.box('wood', 0.1, 0.45, 0.4, 0.9, 0, 0);
    b.box('plank', 2.2, 0.08, 0.45, 0, 0.45, -1.6, { tile: 1 }); b.box('wood', 0.1, 0.45, 0.4, -0.9, 0, -1.6); b.box('wood', 0.1, 0.45, 0.4, 0.9, 0, -1.6);
    SPOTS.teaShop = b.world(0, 0, 1.2);
  }
  well(b, -30, -8);
  cart(b, -60, 16, 0.4); cart(b, 62, -2, 1.9);
  haystack(b, -140, 60, 1); haystack(b, 96, 6, 0.9); haystack(b, -100, 54, 0.8);
  pots(b, -80, 12, 5, rng); pots(b, -4, -2, 4, rng);
  lampPost(b, -42, 4, 1); lampPost(b, -120, 30, 0); lampPost(b, 30, 4, 0);

  // ================= the tharavadu (ancestral home) =================
  {
    const hx = LOC.home.x, hz = LOC.home.z;
    b.place(hx, hz, Math.PI);          // faces north (toward the village street)
    const y0 = 0.7;
    b.box('laterite', 19, 2.2, 12.5, 0, -1.5, 0);
    b.box('wall', 14, 3.0, 7.5, 0, y0, 0);
    // ground floor roof skirt
    b.roofHip('roof', 19.6, 13, 2.5, 12, 0, y0 + 2.75, 0);
    // upper storey
    b.box('wall', 8.4, 2.5, 4.6, 0, y0 + 3.0, 0);
    for (const sx of [-2.4, 0, 2.4]) b.box('wood', 1.0, 1.1, 0.1, sx, y0 + 3.9, 2.32);
    b.roofHip('roof', 11.4, 7.6, 2.9, 5.2, 0, y0 + 5.35, 0);
    b.cone('brass', 0.12, 0.6, -2.6, y0 + 8.2, 0, { col: BRASS }); b.cone('brass', 0.12, 0.6, 2.6, y0 + 8.2, 0, { col: BRASS });
    // verandah pillars all round
    for (let i = 0; i <= 8; i++) {
      const px = -8.9 + i * 2.225;
      b.cyl('wood', 0.13, 0.16, 2.2, px, y0, 5.7, { seg: 8 });
      b.cyl('wood', 0.13, 0.16, 2.2, px, y0, -5.7, { seg: 8 });
    }
    for (let i = 1; i < 5; i++) { b.cyl('wood', 0.13, 0.16, 2.2, -8.9, y0, -5.7 + i * 2.28, { seg: 8 }); b.cyl('wood', 0.13, 0.16, 2.2, 8.9, y0, -5.7 + i * 2.28, { seg: 8 }); }
    // poomukham (entrance portico) with gabled front
    b.box('laterite', 5, 2.1, 4, 0, -1.5, 7.6);
    b.roofGable('roof', 5.2, 5.6, 2.0, 0, y0 + 2.5, 7.8, Math.PI / 2, 'wood');
    for (const sx of [-2.2, 2.2]) for (const sz of [6.2, 9.3]) b.cyl('wood', 0.15, 0.19, 2.5, sx, y0 - 0.1, sz, { seg: 8 });
    for (const sx of [-2.2, 2.2]) b.box('wood', 0.12, 0.55, 3.0, sx, y0 + 0.3, 7.75);   // charupadi benches
    b.box('wood', 1.3, 2.2, 0.16, 0, y0, 3.78, { col: DOOR });
    for (const sx of [-4.4, 4.4]) b.box('wood', 1.1, 1.2, 0.1, sx, y0 + 1.0, 3.78);
    for (let i = 0; i < 3; i++) b.box('stone', 2.6, 0.24, 0.5, 0, 0.46 - i * 0.23, 9.9 + i * 0.5);
    b.lamp(1.2, y0 + 1.1, 8.6, 1.3, 1);
    b.cyl('brass', 0.05, 0.16, 1.0, 1.2, y0, 8.6, { seg: 8, col: BRASS });     // nilavilakku
    b.collider(0, 0, 9.5, 6.25); b.collider(0, 7.6, 2.5, 2.0);
    SPOTS.homeDoor = b.world(0, 0, 12.5);
    SPOTS.ammavan = b.world(-1.2, 0, 11.6);
    SPOTS.devaki = b.world(1.6, 0, 11.9);
    // tulsi thara
    b.box('stone', 0.9, 1.0, 0.9, 5.2, 0, 13); b.box('stone', 1.1, 0.14, 1.1, 5.2, 1.0, 13);
    b.sphere('paint', 0.42, 5.2, 1.5, 13, { col: [0.2, 0.42, 0.16] });
    b.circle(5.2, 13, 0.6);
    // kitchen wing and cow shed
    b.box('laterite', 6.4, 2, 5.4, -13.5, -1.5, -2.5); b.box('laterite', 5, 2.4, 4, -13.5, 0.5, -2.5);
    b.roofHip('thatch', 7.4, 6.4, 2.6, 1.6, -13.5, 2.7, -2.5);
    b.collider(-13.5, -2.5, 3.2, 2.7);
    for (const sx of [-2.2, 2.2]) for (const sz of [-1.6, 1.6]) b.box('wood', 0.14, 2.2, 0.14, 15 + sx, 0, -6 + sz);
    b.roofHip('thatch', 6, 4.6, 1.5, 2, 15, 2.2, -6);
    SPOTS.cowShed = b.world(15, 0, -6);
    // compound wall with padippura (gate house)
    const X = 21, Zf = 21, Zb = -13;
    wallRun(b, 'laterite', -X, Zb, X, Zb); wallRun(b, 'laterite', -X, Zb, -X, Zf); wallRun(b, 'laterite', X, Zb, X, Zf);
    wallRun(b, 'laterite', -X, Zf, -2.2, Zf); wallRun(b, 'laterite', 2.2, Zf, X, Zf);
    b.box('laterite', 0.7, 2.6, 1.6, -2.3, -0.5, Zf); b.box('laterite', 0.7, 2.6, 1.6, 2.3, -0.5, Zf);
    b.roofGable('roof', 6.4, 3.4, 1.3, 0, 2.05, Zf, 0, 'wood');
    b.box('wood', 0.1, 1.9, 1.5, -1.9, 0, Zf + 0.9, { ry: 0.5, col: DOOR });
    b.box('wood', 0.1, 1.9, 1.5, 1.9, 0, Zf + 0.9, { ry: -0.5, col: DOOR });
    b.collider(-2.3, Zf, 0.4, 0.8); b.collider(2.3, Zf, 0.4, 0.8);
    SPOTS.homeGate = b.world(0, 0, Zf + 3);
    b.yard(26, 0.75, 0, 4).clear(24, 0, 4).mark(19, 12);
    well(b, hx + 13, hz - 12);
    haystack(b, hx - 15, hz + 8, 1.1);
    pots(b, hx - 6, hz - 9, 6, rng);
    bigTrees.push([hx + 15, hz - 2, 1], [hx - 16, hz - 10, 0], [hx - 4, hz + 9, 0]);
  }

  // ================= temple =================
  {
    const tx = LOC.temple.x, tz = LOC.temple.z;
    b.place(tx, tz, Math.PI / 2);          // faces east, toward the road
    // compound
    const W = 17;
    wallRun(b, 'stone', -W, -W, W, -W, 1.8, 0.6); wallRun(b, 'stone', -W, -W, -W, W, 1.8, 0.6); wallRun(b, 'stone', W, -W, W, W, 1.8, 0.6);
    wallRun(b, 'stone', -W, W, -2.4, W, 1.8, 0.6); wallRun(b, 'stone', 2.4, W, W, W, 1.8, 0.6);
    // gateway
    b.box('stone', 1.2, 3.2, 2.2, -2.9, -0.5, W); b.box('stone', 1.2, 3.2, 2.2, 2.9, -0.5, W);
    b.roofGable('roof', 9, 4.6, 1.7, 0, 2.6, W, 0, 'wood');
    b.roofGable('roof', 5, 3, 1.2, 0, 4.2, W, 0, 'wood');
    b.box('wood', 4.6, 0.5, 2.4, 0, 3.8, W);
    b.collider(-2.9, W, 0.6, 1.1); b.collider(2.9, W, 0.6, 1.1);
    // sreekovil (sanctum)
    b.box('stone', 7.4, 2.4, 7.4, 0, -1.5, -5);
    b.box('wall', 5.4, 2.8, 5.4, 0, 0.9, -5);
    for (const s of [-1, 1]) { b.box('wood', 5.5, 0.9, 0.08, 0, 1.6, -5 + s * 2.72); b.box('wood', 0.08, 0.9, 5.5, s * 2.72, 1.6, -5); }
    b.box('wood', 1.2, 2.1, 0.14, 0, 0.9, -2.26, { col: DOOR });
    b.roofHip('roof', 9.6, 9.6, 2.9, 0.02, 0, 3.4, -5);
    b.box('wall', 3.6, 1.3, 3.6, 0, 5.0, -5);
    b.roofHip('roof', 6, 6, 3.0, 0.02, 0, 6.1, -5);
    b.cyl('brass', 0.1, 0.34, 0.9, 0, 9.0, -5, { seg: 8, col: BRASS }); b.sphere('brass', 0.24, 0, 9.5, -5, { col: BRASS });
    for (let i = 0; i < 3; i++) b.box('stone', 2.4, 0.3, 0.45, 0, 0.6 - i * 0.3, -1.1 + i * 0.45);
    b.collider(0, -5, 3.7, 3.7);
    // namaskara mandapam
    b.box('stone', 4.6, 1.6, 4.6, 0, -1.2, 4.6);
    for (const sx of [-1.8, 1.8]) for (const sz of [-1.8, 1.8]) b.cyl('stone', 0.2, 0.24, 2.5, sx, 0.4, 4.6 + sz, { seg: 8 });
    b.roofHip('roof', 6.4, 6.4, 2.2, 0.02, 0, 2.8, 4.6);
    b.cone('brass', 0.14, 0.6, 0, 5.0, 4.6, { col: BRASS });
    b.collider(0, 4.6, 2.3, 2.3, 0, 0.5);
    // deepastambham (lamp tower)
    b.box('stone', 1.4, 0.5, 1.4, 0, 0, 11);
    for (let i = 0; i < 7; i++) {
      b.cyl('brass', 0.62 - i * 0.07, 0.66 - i * 0.07, 0.07, 0, 0.7 + i * 0.42, 11, { seg: 12, col: BRASS });
      b.cyl('brass', 0.07, 0.07, 0.42, 0, 0.5 + i * 0.42, 11, { seg: 6, col: BRASS });
      if (i % 2 === 0) b.lamp(0.5 - i * 0.06, 0.82 + i * 0.42, 11, 0.6, 0);
    }
    b.lamp(0, 3.7, 11, 1.5, 1);
    b.circle(0, 11, 0.8);
    // kodimaram (flag mast)
    b.box('stone', 1.2, 0.6, 1.2, 0, 0, 14);
    b.cyl('brass', 0.09, 0.15, 10, 0, 0.6, 14, { seg: 8, col: BRASS });
    for (let i = 0; i < 5; i++) b.cyl('brass', 0.2, 0.2, 0.08, 0, 2 + i * 1.9, 14, { seg: 8, col: BRASS });
    b.circle(0, 14, 0.7);
    b.yard(22, 0.85).clear(26).mark(34, 34);
    SPOTS.templeGate = b.world(0, 0, W + 5);
    SPOTS.elephant = b.world(-9, 0, W + 8);
    // banyan with a stone seat outside the gate
    const bt = b.world(9, 0, W + 9);
    b.cyl('stone', 3.2, 3.2, 0.7, 9, 0, W + 9, { seg: 14 });
    bigTrees.push([bt.x, bt.z, 2, 1.5]);
    // the tank: stone ghats stepping down into the water
    b.place(LOC.tank.x, LOC.tank.z, 0, 0);
    for (let i = 0; i < 4; i++) {
      const r = 10.2 + i * 0.9, y = -0.5 + i * 0.75, t = 0.9;
      b.box('stone', r * 2 + t, 1.2, t, 0, y - 1.2, -r); b.box('stone', r * 2 + t, 1.2, t, 0, y - 1.2, r);
      b.box('stone', t, 1.2, r * 2 + t, -r, y - 1.2, 0); b.box('stone', t, 1.2, r * 2 + t, r, y - 1.2, 0);
    }
    b.clear(19); b.yard(18, 0.5);
  }

  // ================= village jetty =================
  {
    const jx = LOC.villageJetty.x;
    jetty(b, jx + 5, 40, -Math.PI / 2, 24, 2.8, 0.75);
    SPOTS.villageJettyEnd = new THREE.Vector3(jx - 17, 0.75, 40);
    SPOTS.villageBoat = new THREE.Vector3(jx - 15, 0, 42.5);
    SPOTS.ouseph = new THREE.Vector3(jx - 3, 0, 39.2);
    SPOTS.arrive = new THREE.Vector3(jx - 12, 0.75, 40);
    b.place(jx + 12, 46, 0); b.yard(12, 0.8).clear(10);
    crates(b, jx + 10, 46, 0.3, rng, 4, 'sack');
    lampPost(b, jx + 7, 37, 1);
    // boatman's hut
    house(b, jx + 20, 56, Math.PI, { w: 5, d: 4, roof: 'thatch', wall: 'laterite' });
  }

  // ================= bridges =================
  bridge(b, -30, canalZ(-30), 0, 30, 3.6, 2.45);
  bridge(b, 118, canalZ(118), 0, 30, 2.4, 2.45);

  // ================= pepper garden =================
  {
    const px = LOC.pepper.x, pz = LOC.pepper.z;
    house(b, px - 8, pz + 14, Math.PI * 0.8, { w: 4.5, d: 3.5, roof: 'thatch', wall: 'laterite', overhang: 1.1 });
    b.place(px - 2, pz + 6, 0.3);
    for (let i = 0; i < 3; i++) b.box('paint', 2.4, 0.04, 3.4, -3 + i * 3, 0.03, 0, { col: i === 1 ? [0.07, 0.06, 0.05] : [0.2, 0.26, 0.1] });
    b.yard(9, 0.8).clear(8);
    SPOTS.pepperYard = b.world(0, 0, 3);
    SPOTS.pepperSacks = [];
    const offs = [[-14, -12], [9, -16], [20, 4], [-22, 8], [4, -30], [-6, 22]];
    for (const [ox, oz] of offs) SPOTS.pepperSacks.push(new THREE.Vector3(px + ox, getHeight(px + ox, pz + oz), pz + oz));
  }

  // ================= port town: Puthenthura =================
  {
    const pz = LOC.portJetty.z;
    jetty(b, -400, pz - 4, 0, 30, 4.2, 0.85);
    SPOTS.portJettyEnd = new THREE.Vector3(-400, 0.85, pz + 22);
    SPOTS.portBoat = new THREE.Vector3(-396.6, 0, pz + 20);
    SPOTS.portLanding = new THREE.Vector3(-400, 0.85, pz + 12);
    // market row north of the road
    const shops = [[-352, -404, 0], [-366, -401, 0], [-380, -399, 0], [-416, -398, 0], [-430, -399, 0], [-444, -400, 0]];
    shops.forEach(([x, z, ry], i) => house(b, x, z, ry, { w: 6 + (i % 2), d: 5, overhang: 1.5, wall: i % 3 === 1 ? 'laterite' : 'wall', lamp: i % 2 }));
    spiceStall(b, -372, -389.5, 0, rng); spiceStall(b, -423, -389, 0, rng); spiceStall(b, -392, -372, Math.PI / 2, rng);
    // Moideen's spice house, on the quay
    house(b, -416, -356, Math.PI / 2, { w: 9, d: 6.5, lamp: 1, overhang: 1.6 });
    b.place(-416, -356, Math.PI / 2);
    SPOTS.moideen = b.world(1.5, 0, 6.4);
    crates(b, -406, -349, 0.2, rng, 5, 'sack'); crates(b, -406.5, -362.5, 1.2, rng, 4, 'mix');
    crates(b, -395, -334, 0.5, rng, 5, 'mix'); crates(b, -404.5, -326, 0.1, rng, 4, 'sack');
    spiceStall(b, -388, -350, -Math.PI / 2, rng);
    // mosque in the old Kerala manner: tiered tiled roofs, no dome
    {
      b.place(-342, -372, -Math.PI / 2);
      b.box('laterite', 12, 2.2, 9, 0, -1.5, 0);
      b.box('wall', 9, 3.2, 6.5, 0, 0.7, 0);
      b.roofHip('roof', 12.6, 9.6, 2.4, 6, 0, 3.6, 0);
      b.box('wall', 5.5, 1.6, 3.6, 0, 5.0, 0);
      b.roofGable('roof', 7.4, 5.4, 2.2, 0, 6.4, 0, 0, 'wood');
      for (let i = 0; i < 5; i++) b.cyl('wood', 0.13, 0.16, 2.9, -5 + i * 2.5, 0.7, 4.0, { seg: 8 });
      b.box('wood', 1.3, 2.2, 0.14, 0, 0.7, 3.27, { col: DOOR });
      b.collider(0, 0, 6, 4.5); b.yard(11, 0.7).clear(9).mark(12, 9);
    }
    // church of the Nasranis: whitewashed gabled façade
    {
      b.place(-452, -420, 0);
      b.box('laterite', 9, 2, 15, 0, -1.5, 0);
      b.box('wall', 8, 4.6, 14, 0, 0.5, 0);
      b.roofGable('roof', 15, 9.4, 3.0, 0, 5.0, 0, Math.PI / 2, 'wall');
      b.box('wall', 8.6, 7.6, 0.6, 0, 0.5, 7.2);
      b.box('wall', 4.4, 2.0, 0.6, 0, 8.1, 7.2); b.box('wall', 2, 1.2, 0.6, 0, 10.1, 7.2);
      b.box('wood', 0.16, 1.5, 0.16, 0, 11.3, 7.2); b.box('wood', 0.8, 0.16, 0.16, 0, 12.2, 7.2);
      b.box('wood', 1.6, 2.6, 0.14, 0, 0.5, 7.55, { col: DOOR });
      b.collider(0, 0, 4.5, 7.5); b.yard(12, 0.6).clear(10).mark(9, 15);
    }
    // Chinese fishing nets along the shore
    for (const x of [-372, -356, -340]) {
      let z = -350; while (getHeight(x, z) > -0.5 && z < -280) z += 0.5;
      cheenavala(b, x, z - 3.5, 0);
    }
    for (const [x, z, l] of [[-400, -372, 1], [-436, -388, 1], [-362, -390, 0], [-398, pz - 2, 1], [-385, -340, 0]]) lampPost(b, x, z, l);
    b.place(-400, -366, 0); b.yard(24, 0.7); b.clear(26);
    cart(b, -384, -380, 1.2); well(b, -428, -376);
    SPOTS.portSquare = new THREE.Vector3(-400, getHeight(-400, -372), -372);

    // ---------- Harrow & Finch Company compound ----------
    b.place(-478, -346, 0);
    const y = b.oy;
    // walls: N (with gate), E (rear gap near the south end), W, S
    wallRun(b, 'laterite', -28, -27, -3.2, -27, 2.3, 0.5); wallRun(b, 'laterite', 3.2, -27, 28, -27, 2.3, 0.5);
    wallRun(b, 'laterite', 28, -27, 28, 13, 2.3, 0.5); wallRun(b, 'laterite', 28, 17.5, 28, 26, 2.3, 0.5);
    wallRun(b, 'laterite', -28, -27, -28, 26, 2.3, 0.5); wallRun(b, 'laterite', -28, 26, 28, 26, 2.3, 0.5);
    for (const sx of [-3.6, 3.6]) { b.box('wall', 0.9, 3.2, 0.9, sx, -0.5, -27); b.sphere('wall', 0.36, sx, 2.9, -27); b.collider(sx, -27, 0.45, 0.45); }
    b.lamp(-3.6, 3.4, -27, 1.2, 1); b.lamp(3.6, 3.4, -27, 1.2, 0);
    // godown (warehouse) along the west wall
    b.box('laterite', 10.6, 2, 31, -20, -1.5, 0);
    b.box('laterite', 10, 4.2, 30, -20, 0.4, 0);
    b.roofGable('roof', 32, 12.6, 3.4, -20, 4.5, 0, Math.PI / 2, 'laterite');
    for (const sz of [-8, 8]) b.box('wood', 0.16, 3.0, 3.2, -14.95, 0.4, sz, { col: DOOR });
    b.collider(-20, 0, 5.3, 15.5);
    b.lamp(-14.6, 3.6, 0, 1.2, 1);
    // agent's bungalow & counting house (faces north to the gate)
    b.box('laterite', 15, 2.2, 12, 12, -1.5, 10);
    b.box('wall', 11, 3.4, 8, 12, 0.7, 10);
    b.roofHip('roof', 16, 13, 3.0, 6, 12, 3.9, 10);
    for (let i = 0; i <= 5; i++) { b.cyl('wall', 0.17, 0.2, 3.1, 5 + i * 2.8, 0.7, 4.5, { seg: 10 }); b.cyl('wall', 0.17, 0.2, 3.1, 5 + i * 2.8, 0.7, 15.5, { seg: 10 }); }
    for (const sz of [8, 12]) { b.cyl('wall', 0.17, 0.2, 3.1, 5, 0.7, sz, { seg: 10 }); b.cyl('wall', 0.17, 0.2, 3.1, 19, 0.7, sz, { seg: 10 }); }
    b.box('wood', 1.3, 2.3, 0.14, 12, 0.7, 5.95, { col: [0.3, 0.42, 0.3] });
    for (const sx of [8.5, 15.5]) b.box('wood', 1.1, 1.4, 0.1, sx, 1.5, 5.96, { col: [0.3, 0.42, 0.3] });
    for (let i = 0; i < 3; i++) b.box('stone', 2.6, 0.24, 0.5, 12, 0.46 - i * 0.23, 3.9 - i * 0.5);
    b.collider(12, 10, 7.5, 6);
    b.lamp(13.6, 2.6, 5.4, 1.2, 1);
    SPOTS.ledger = b.world(12, 0, 3.4);
    SPOTS.finch = b.world(10.5, 0, 2.2);
    SPOTS.compoundGate = b.world(0, 0, -31);
    SPOTS.compoundRear = b.world(31, 0, 15.2);
    SPOTS.compoundYard = b.world(0, 0, -8);
    // yard clutter that doubles as cover
    const cover = [[-9, -16], [-3, -4], [6, -14], [-10, 8], [0, 16], [20, -18], [22, -4], [-8, 20]];
    const wc = cover.map(([cx, cz]) => b.world(cx, 0, cz));
    wc.forEach((p, i) => crates(b, p.x, p.z, i * 0.7, rng, 5, i % 2 ? 'mix' : 'sack'));
    b.place(-478, -346, 0, y);
    // flagstaff with the Company pennant
    b.cyl('wood', 0.06, 0.09, 9, 2, 0, -20, { seg: 6 });
    b.box('paint', 1.6, 1.0, 0.03, 2.85, 7.9, -20, { col: [0.55, 0.08, 0.08] });
    b.box('paint', 0.5, 0.34, 0.04, 2.5, 8.25, -20, { col: [0.85, 0.75, 0.4] });
    b.circle(2, -20, 0.2);
    b.yard(34, 0.7).clear(42).mark(56, 53);
    SPOTS.guards = [
      { post: b.world(0, 0, -30.5), face: Math.PI, route: null },
      { route: [b.world(-6, 0, -22), b.world(-6, 0, -1), b.world(3, 0, 1), b.world(3, 0, -22)] },
      { route: [b.world(-12, 0, 14), b.world(-12, 0, 22), b.world(22, 0, 22), b.world(2, 0, 19)] },
      { route: [b.world(-12.5, 0, -10), b.world(-12.5, 0, 10)] },
    ];
    // stable, west of the compound
    b.place(-526, -352, Math.PI / 2);
    b.box('laterite', 9, 0.3, 6, 0, -0.1, 0);
    b.box('plank', 9, 2.4, 0.15, 0, 0.2, -3); b.box('plank', 0.15, 2.4, 6, -4.5, 0.2, 0); b.box('plank', 0.15, 2.4, 6, 4.5, 0.2, 0);
    for (const sx of [-4.4, -1.5, 1.5, 4.4]) b.box('wood', 0.16, 2.4, 0.16, sx, 0.2, 3);
    b.box('plank', 0.12, 1.3, 5.6, 0, 0.2, 0);
    b.roofGable('thatch', 10.4, 8, 1.8, 0, 2.6, 0, 0, 'plank');
    b.collider(0, -3, 4.5, 0.2); b.collider(-4.5, 0, 0.2, 3); b.collider(4.5, 0, 0.2, 3);
    SPOTS.stableHorse = b.world(2.4, 0, 4.6);
    SPOTS.stableHorse2 = b.world(-2.4, 0, 0.4);
    SPOTS.stableFace = Math.PI / 2;
    b.lamp(0, 2.3, 3.1, 1.1, 1);
    haystack(b, -534, -343, 0.9);
    b.place(-526, -352, 0); b.yard(13, 0.8).clear(12).mark(6, 9);
  }

  // ================= the Cutcherry (district court & revenue office) =================
  {
    const cx = LOC.cutcherry.x, cz = LOC.cutcherry.z;
    b.place(cx, cz, 0);
    b.box('laterite', 25, 2.6, 13, 0, -1.6, 0);
    b.box('wall', 22, 4.6, 10, 0, 1.0, 0);
    b.roofHip('roof', 26, 14, 3.4, 14, 0, 5.5, 0);
    // portico with pediment
    b.box('laterite', 11, 2.6, 4.4, 0, -1.6, 7);
    for (let i = 0; i < 6; i++) b.cyl('wall', 0.26, 0.3, 4.3, -5 + i * 2, 1.0, 8.6, { seg: 12 });
    b.box('wall', 11.4, 0.5, 4.6, 0, 5.3, 7);
    b.roofGable('roof', 4.8, 11.8, 2.2, 0, 5.8, 7, Math.PI / 2, 'wall');
    b.box('wood', 1.8, 2.8, 0.16, 0, 1.0, 5.02, { col: [0.25, 0.3, 0.26] });
    for (const sx of [-8, -4.4, 4.4, 8]) b.box('wood', 1.2, 1.8, 0.1, sx, 2.0, 5.02, { col: [0.25, 0.3, 0.26] });
    for (let i = 0; i < 4; i++) b.box('stone', 7, 0.26, 0.55, 0, 0.74 - i * 0.25, 9.5 + i * 0.55);
    b.collider(0, 0, 12.5, 6.5); b.collider(0, 7, 5.5, 2.2, 0, 0.6);
    b.platform(0, 7.2, 5.4, 2.1, 1.0);
    // flagstaff
    b.box('stone', 1.4, 0.5, 1.4, 9, 0, 17);
    b.cyl('wood', 0.07, 0.1, 11, 9, 0.5, 17, { seg: 6 });
    b.box('paint', 1.9, 1.15, 0.03, 10, 10.2, 17, { col: [0.62, 0.1, 0.1] });
    b.sphere('paint', 0.24, 10, 10.78, 17.02, { sx: 1.1, sy: 1, sz: 0.1, col: [0.92, 0.88, 0.8] });
    b.circle(9, 17, 0.8);
    b.lamp(-3, 3.6, 8.9, 1.3, 1); b.lamp(3, 3.6, 8.9, 1.3, 0);
    SPOTS.cutcherryDoor = b.world(0, 0, 13.5);
    SPOTS.peishkar = b.world(0, 1.0, 8.0);
    SPOTS.cutcherryYard = b.world(0, 0, 22);
    b.yard(26, 0.7, 0, 14).clear(38, 0, 6).mark(25, 13);
    // guard hut and a rest house
    house(b, cx - 30, cz + 14, Math.PI / 2, { w: 6, d: 5 });
    house(b, cx + 32, cz + 10, -Math.PI / 2, { w: 7, d: 5 });
    lampPost(b, cx - 8, cz + 26, 1);
  }

  // scattered farmsteads so the wider land feels lived-in
  const farms = [[-120, 200, 2.6], [150, 150, 0.4], [60, 215, 3.1], [-260, -440, 0.3], [-140, -300, 1.2], [20, -300, 3.2], [240, -280, 2.9], [-620, 100, 1.6], [-640, -120, 1.4], [-630, 300, 1.8], [100, 540, 0.2], [-100, 545, 0.1], [230, 40, 4.4], [-200, -200, 5]];
  for (const [x, z, ry] of farms) {
    if (getHeight(x, z) < 1.2) continue;
    house(b, x, z, ry, rng() < 0.5 ? { w: 6, d: 5, roof: 'thatch', wall: 'laterite' } : { w: 7 });
    if (rng() < 0.6) haystack(b, x + 9, z + 4, 0.9);
  }
  // shrine on the island
  {
    const ix = LOC.island.x, iz = LOC.island.z;
    b.place(ix, iz, 0.6);
    b.box('stone', 2.4, 1.4, 2.4, 0, -0.8, 0); b.box('wall', 1.5, 1.5, 1.5, 0, 0.6, 0);
    b.roofHip('roof', 2.8, 2.8, 1.3, 0.02, 0, 2.0, 0);
    b.lamp(0, 1.0, 1.0, 1, 0);
    b.collider(0, 0, 1.2, 1.2); b.clear(4);
    SPOTS.island = b.world(0, 0, 3);
  }


  // =====================================================================
  //  ACT II locations
  // =====================================================================
  const rock = (x, y, z, sc, sy = 0.7) => b.sphere('stone', sc, x, y, z, { seg: 6, rings: 5, sx: 1 + rng() * 0.5, sy: sy + rng() * 0.3, sz: 1 + rng() * 0.4, col: [0.95 + rng() * 0.25, 0.95 + rng() * 0.25, 0.92 + rng() * 0.25] });

  // ---- Kannimala tea estate (Harrow's)
  {
    const ex = LOC.estate.x, ez = LOC.estate.z;
    b.place(ex, ez, 0);
    const y0 = 0.6;
    // manager's bungalow
    b.box('laterite', 17, 2.2, 12, -20, -1.5, -6);
    b.box('wall', 13, 3.3, 8, -20, y0, -6);
    b.roofHip('roof', 18, 13, 3.1, 7, -20, y0 + 3.1, -6);
    for (let i = 0; i <= 6; i++) b.cyl('wall', 0.16, 0.19, 3.0, -28 + i * 2.67, y0, -0.4, { seg: 10 });
    b.box('wood', 1.3, 2.3, 0.14, -20, y0, -1.98, { col: [0.28, 0.4, 0.3] });
    for (const sx of [-25, -15]) b.box('wood', 1.1, 1.4, 0.1, sx, y0 + 0.9, -1.98, { col: [0.28, 0.4, 0.3] });
    b.collider(-20, -6, 8.5, 6); b.lamp(-18.4, y0 + 2.3, -0.6, 1.2, 1);
    b.smoke(-23, y0 + 6.4, -8);
    // the factory: three floors of withering lofts under corrugated iron
    b.box('laterite', 13, 1.6, 27, 18, -1.2, -4);
    b.box('plank', 12, 9.2, 26, 18, 0.4, -4, { col: [0.86, 0.84, 0.78], tile: 3 });
    b.roofGable('tin', 28, 14, 3.2, 18, 9.5, -4, Math.PI / 2, 'plank');
    for (let f = 0; f < 3; f++) for (let i = 0; i < 7; i++) {
      b.box('wood', 0.08, 1.5, 2.2, 11.96, 1.6 + f * 2.9, -14.5 + i * 3.5, { col: [0.2, 0.22, 0.2] });
      b.box('wood', 0.08, 1.5, 2.2, 24.04, 1.6 + f * 2.9, -14.5 + i * 3.5, { col: [0.2, 0.22, 0.2] });
    }
    b.box('wood', 3.2, 3.2, 0.16, 18, 0.4, 9.06, { col: DOOR });
    b.cyl('laterite', 0.7, 0.95, 15, 27, 0, -12, { seg: 10 });
    b.smoke(27, 15.4, -12); b.smoke(27, 15.4, -12);
    b.collider(18, -4, 6.5, 13.5); b.circle(27, -12, 1.1);
    b.lamp(18, 4.2, 9.5, 1.3, 1);
    // store-shed where the kangani is held
    b.box('laterite', 5.6, 1.6, 4.6, -4, -1.2, -30);
    b.box('laterite', 5, 2.6, 4, -4, 0.4, -30);
    b.roofGable('tin', 6.4, 5.4, 1.2, -4, 3.0, -30, 0, 'laterite');
    b.box('wood', 1.2, 2.0, 0.14, -4, 0.4, -27.95, { col: DOOR });
    b.box('paint', 0.16, 0.2, 0.08, -3.55, 1.35, -27.86, { col: [0.25, 0.25, 0.27] });
    b.collider(-4, -30, 2.8, 2.3);
    SPOTS.veluCell = b.world(-4, 0, -26.6);
    // coolie lines
    b.box('laterite', 22, 2.9, 4.2, -26, -0.4, 22);
    b.roofGable('thatch', 23.5, 6, 1.5, -26, 2.5, 22, 0, 'laterite');
    for (let i = 0; i < 6; i++) b.box('wood', 0.9, 1.8, 0.1, -35 + i * 3.6, 0, 24.12, { col: DOOR });
    b.collider(-26, 22, 11, 2.2);
    // gate
    for (const sx of [-2.6, 2.6]) { b.box('wall', 0.8, 2.8, 0.8, sx, -0.4, 34); b.sphere('wall', 0.3, sx, 2.65, 34); b.collider(sx, 34, 0.4, 0.4); }
    b.box('wood', 5.2, 0.5, 0.12, 0, 2.5, 34, { col: [0.2, 0.3, 0.22] });
    b.lamp(-2.6, 3.1, 34, 1.2, 1);
    for (const [cx, cz] of [[4, 2], [-8, 12], [8, 18], [-10, -18], [6, -22], [-2, 24]]) { const w = b.world(cx, 0, cz); crates(b, w.x, w.z, cx, rng, 4, 'mix'); b.place(ex, ez, 0); }
    SPOTS.estateGate = b.world(0, 0, 40);
    SPOTS.estateYard = b.world(0, 0, 8);
    SPOTS.estateGuards = [
      { post: b.world(1.6, 0, 31), face: 0 },
      { route: [b.world(6, 0, 12), b.world(6, 0, -20), b.world(-6, 0, -20), b.world(-6, 0, 12)] },
      { route: [b.world(-12, 0, -26), b.world(4, 0, -24), b.world(8, 0, -30), b.world(-10, 0, -34)] },
    ];
    b.yard(34, 0.7, 0, 0).clear(46, 0, -2).mark(46, 50);
    bigTrees.push([ex - 36, ez - 22, 1, 1.2], [ex + 34, ez + 20, 1, 1.2]);
  }

  // ---- Azhimukham light, on the bar
  {
    b.place(LOC.lighthouse.x, LOC.lighthouse.z, 0);
    b.cyl('stone', 4.2, 4.6, 1.4, 0, -0.4, 0, { seg: 12 });
    b.cyl('wall', 2.1, 3.0, 19, 0, 1.0, 0, { seg: 16, uv: [6, 8] });
    for (const yy of [6.2, 13]) b.cyl('paint', 2.75 - yy * 0.047, 2.82 - yy * 0.047, 2.4, 0, yy, 0, { seg: 16, col: [0.62, 0.12, 0.1] });
    b.cyl('stone', 2.9, 2.6, 0.3, 0, 20, 0, { seg: 16 });
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; b.box('wood', 0.06, 0.9, 0.06, Math.cos(a) * 2.75, 20.3, Math.sin(a) * 2.75); }
    b.cyl('paint', 1.5, 1.5, 2.2, 0, 20.3, 0, { seg: 10, col: [0.95, 0.9, 0.6], open: true });
    b.cone('paint', 1.9, 1.5, 0, 22.5, 0, { seg: 10, col: [0.16, 0.15, 0.14] });
    b.box('wood', 1.1, 2.1, 0.2, 0, 1.0, 2.86, { col: DOOR });
    b.lamp(0, 21.4, 0, 3.2, 1);
    b.circle(0, 0, 3.4);
    house(b, LOC.lighthouse.x - 13, LOC.lighthouse.z - 9, 0.5, { w: 6, d: 5, lamp: 1 });
    b.place(LOC.lighthouse.x, LOC.lighthouse.z, 0);
    for (let i = 0; i < 9; i++) rock(-6 + rng() * 16, -0.2, 24 + rng() * 8, 0.8 + rng() * 1.1);
    SPOTS.lighthouse = b.world(0, 0, 7);
    SPOTS.duel = b.world(5, 0, 13);
    SPOTS.chest = b.world(1.6, 0, 4.2);
    SPOTS.aground = b.world(38, 0, 31);
    b.yard(11, 0.6).clear(13).mark(7, 7);
  }

  // ---- Azhikkal, a fishing hamlet on the sand-spit
  {
    const hx = LOC.hamlet.x, hz = LOC.hamlet.z;
    for (const [dx, dz, ry] of [[-10, -14, 0.3], [8, -18, -0.2], [-14, 6, 1.5], [12, 16, -1.9], [-4, 24, 2.8], [16, -2, -1.4]]) house(b, hx + dx, hz + dz, ry, { w: 5, d: 4, roof: 'thatch', wall: 'laterite', overhang: 1.2 });
    b.place(hx, hz, 0); b.yard(18, 0.55).clear(12);
    // fish-drying racks and hung nets
    for (const [dx, dz, ry] of [[2, 4, 0.2], [-2, -4, 1.3], [24, 10, 0.1]]) {
      b.place(hx + dx, hz + dz, ry);
      for (const sx of [-1.6, 1.6]) for (const sz of [-0.5, 0.5]) b.box('wood', 0.07, 1.1, 0.07, sx, 0, sz);
      b.box('plank', 3.4, 0.05, 1.2, 0, 1.1, 0, { tile: 1 });
      for (let i = 0; i < 14; i++) b.box('paint', 0.34, 0.03, 0.09, -1.4 + (i % 7) * 0.46, 1.15, -0.25 + Math.floor(i / 7) * 0.5, { col: [0.7, 0.68, 0.6], ry: 0.3 });
      b.collider(0, 0, 1.7, 0.6, 0, 1.2);
    }
    b.place(hx + 6, hz - 6, 0.6);
    for (const sx of [-2.4, 2.4]) b.box('wood', 0.08, 2.6, 0.08, sx, 0, 0);
    b.box('net', 4.8, 2.0, 0.02, 0, 0.5, 0, { tile: 0.35 });
    const jx = LOC.hamletJetty.x;
    jetty(b, jx - 5, 150, Math.PI / 2, 22, 2.6, 0.75);
    SPOTS.hamletBoat = new THREE.Vector3(jx + 14, 0, 152.6);
    SPOTS.hamletJettyEnd = new THREE.Vector3(jx + 12, 0.75, 150);
    lampPost(b, jx - 6, 147.4, 1);
    SPOTS.hamlet = new THREE.Vector3(hx + 2, getHeight(hx + 2, hz + 10), hz + 10);
  }

  // ---- Kottappuram: a ruined Dutch factory-fort on the south shore
  {
    b.place(LOC.fort.x, LOC.fort.z, 0.25);
    const seg = (x0, z0, x1, z1, h) => wallRun(b, 'laterite', x0, z0, x1, z1, h, 1.0, false);
    seg(-16, -12, -4, -12, 3.4); seg(2, -12, 9, -12, 1.6); seg(13, -12, 16, -12, 3.0);
    seg(-16, -12, -16, 2, 2.8); seg(-16, 6, -16, 12, 1.2); seg(16, -12, 16, 12, 2.2);
    seg(-16, 12, -2, 12, 0.9); seg(4, 12, 16, 12, 2.6);
    b.cyl('laterite', 4.2, 4.6, 4.4, -16, -1, -12, { seg: 12 }); b.circle(-16, -12, 4.4);
    b.cyl('laterite', 3.6, 4.0, 2.2, 16, -1, 12, { seg: 12 }); b.circle(16, 12, 3.8);
    // gate arch
    b.box('laterite', 1.2, 4.2, 1.4, -4, -0.5, -12); b.box('laterite', 1.2, 4.2, 1.4, 2, -0.5, -12); b.box('laterite', 7.4, 1.0, 1.4, -1, 3.7, -12);
    // a cannon on the bastion
    b.cyl('paint', 0.16, 0.24, 2.4, -16, 3.7, -12, { seg: 8, rx: Math.PI / 2 - 0.12, ry: 0.8, col: [0.14, 0.15, 0.15] });
    b.box('wood', 0.9, 0.4, 1.3, -16, 3.4, -12, { ry: 0.8 });
    for (let i = 0; i < 12; i++) rock(-14 + rng() * 28, -0.2, -9 + rng() * 18, 0.4 + rng() * 0.7);
    b.clear(14).mark(32, 24);
    SPOTS.fort = b.world(0, 0, 0);
    bigTrees.push([LOC.fort.x + 6, LOC.fort.z + 2, 2, 1.3], [LOC.fort.x - 9, LOC.fort.z - 3, 0, 1.2]);
  }

  // ---- Lotus Falls: boulders down the rock shelf
  {
    b.place(196, 190, 0, 0);
    for (let i = 0; i < 26; i++) {
      const a = (rng() - 0.5) * 2.4, r = 5 + rng() * 9;
      const x = -Math.cos(a) * r * 0.55 + 1, z = Math.sin(a) * r * 1.4;
      if (Math.abs(z) < 4.2) continue;
      rock(x, getHeight(196 + x, 190 + z) - 0.3, z, 1.0 + rng() * 1.6, 0.8);
    }
    for (let i = 0; i < 8; i++) { const zz = (rng() - 0.5) * 16; rock(-9.5 - rng() * 3, -0.5, zz + Math.sign(zz) * 3, 0.7 + rng() * 0.9); }
    SPOTS.falls = new THREE.Vector3(190.5, 0, 190);
    SPOTS.fallsTop = new THREE.Vector3(195.2, getHeight(196, 190) + 0.25, 190);
    SPOTS.fallsView = new THREE.Vector3(168, getHeight(168, 170), 170);
    b.keepClear.push({ x: 196, z: 190, r: 9 });
  }

  // ---- toddy shop on the canal towpath
  {
    house(b, LOC.toddy.x, LOC.toddy.z - 4, 0, { w: 6, d: 4.5, roof: 'thatch', wall: 'laterite', lamp: 1, smoke: true });
    b.place(LOC.toddy.x, LOC.toddy.z + 2.6, 0);
    for (const sx of [-2.2, 2.2]) { b.box('plank', 1.8, 0.08, 0.45, sx, 0.45, 0, { tile: 1 }); b.box('wood', 0.1, 0.45, 0.4, sx - 0.7, 0, 0); b.box('wood', 0.1, 0.45, 0.4, sx + 0.7, 0, 0); }
    SPOTS.toddy = b.world(0, 0, 1.6);
    pots(b, LOC.toddy.x + 4.4, LOC.toddy.z + 1, 7, rng);
  }

  // ---- Sarpa Kavu: a serpent grove in the forest
  {
    b.place(LOC.kavu.x, LOC.kavu.z, 0.4);
    b.cyl('stone', 3.4, 3.7, 0.9, 0, -0.3, 0, { seg: 12 });
    for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; b.box('stone', 0.45, 0.9 + (i % 3) * 0.25, 0.14, Math.cos(a) * 1.5, 0.6, Math.sin(a) * 1.5, { ry: -a + Math.PI / 2, col: [0.5, 0.52, 0.48] }); }
    b.cyl('brass', 0.05, 0.14, 0.8, 0, 0.6, 0, { seg: 8, col: BRASS });
    b.lamp(0, 1.5, 0, 1.2, 1);
    b.clear(5); b.circle(0, 0, 3.6);
    SPOTS.kavu = b.world(0, 0, 5.5);
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.4; bigTrees.push([LOC.kavu.x + Math.cos(a) * 9, LOC.kavu.z + Math.sin(a) * 9, 2, 1.25 + rng() * 0.3]); }
  }

  // ---- the three farmsteads that hold their receipts (Act II)
  SPOTS.farms = [[20, -300, 3.2], [-140, -300, 1.2], [150, 150, 0.4]].map(([x, z, ry]) => {
    const fx = x + Math.sin(ry) * 7.5, fz = z + Math.cos(ry) * 7.5;
    return new THREE.Vector3(fx, getHeight(fx, fz), fz);
  });
  // village life: coir, coconuts, benches
  for (const [x, z] of [[-70, 22], [8, 8], [-140, 28], [-396, -368], [-412, -386], [60, -6]]) {
    b.place(x, z, rng() * 3);
    for (let i = 0; i < 9; i++) b.sphere('paint', 0.15, (rng() - 0.5) * 1.3, 0.13 + (i > 5 ? 0.2 : 0), (rng() - 0.5) * 1.1, { seg: 6, rings: 5, col: rng() < 0.5 ? [0.45, 0.32, 0.18] : [0.35, 0.42, 0.18] });
  }

  const meshes = b.finish(scene, mats);
  return { yards: b.yards, keepClear: b.keepClear, marks: b.marks, lamps: b.lamps, smokes: b.smokes, bigTrees, mats, meshes };
}
