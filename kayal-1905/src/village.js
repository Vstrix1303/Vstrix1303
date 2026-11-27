// Thekkumkara's bazaar and lanes: shophouses along the main road with open fronts, counters and the
// goods of each trade; a covered market, the village school, the anchal office; a square with a banyan
// platform and a roadside shrine; houses along three new lanes. Returns where the people who work here
// stand, so the world can put them there.
import * as THREE from 'three';
import { house, wall, P, F, stair, barrel, toolbox, olakkuda, castNet } from './houses.js';
import { getHeight } from './heightfield.js';

const TAU = Math.PI * 2;
const BRASS = [0.95, 0.72, 0.28], COPPER = [0.85, 0.45, 0.25];

// the main road through the village centre, from the junction eastward
const A = [-40, 10], B = [20, 0];
const L = Math.hypot(B[0] - A[0], B[1] - A[1]), D = [(B[0] - A[0]) / L, (B[1] - A[1]) / L], N = [-D[1], D[0]];
const along = (s, off) => [A[0] + D[0] * s + N[0] * off, A[1] + D[1] * s + N[1] * off];
const FACE_S = Math.atan2(-N[0], -N[1]), FACE_N = Math.atan2(N[0], N[1]);   // north-side shops face south, and the reverse

function bananas(b, x, y, z, s = 1) {
  b.cyl('wood', 0.015, 0.015, 0.35 * s, x, y - 0.1 * s, z, { seg: 4, col: [0.4, 0.5, 0.25] });
  for (let i = 0; i < 14; i++) { const a = i * 2.4, r = 0.07 * s, h = (i / 14) * 0.3 * s; b.sphere('paint', 0.045 * s, x + Math.cos(a) * r, y - h, z + Math.sin(a) * r, { sx: 0.55, sy: 1.6, sz: 0.55, seg: 6, rings: 4, col: i % 3 ? [0.62, 0.66, 0.16] : [0.78, 0.7, 0.18] }); }
}
function shelf(b, x, z, w, ry = 0, levels = 3) {
  for (let i = 0; i < levels; i++) b.box('plank', w, 0.04, 0.35, x, 0.5 + 0.4 + i * 0.5, z, { ry, tile: 0.8, col: [0.6, 0.48, 0.36] });
  for (const s of [-1, 1]) b.box('wood', 0.05, 1.6, 0.35, x + Math.cos(ry) * s * w / 2, 0.5, z - Math.sin(ry) * s * w / 2, { ry, col: [0.45, 0.35, 0.26] });
}

// goods of each trade, in the shop's local frame (front +z at hd)
const GOODS = {
  provisions(b, hw, hd, rng) {
    const fills = [[0.92, 0.9, 0.82], [0.72, 0.13, 0.08], [0.9, 0.66, 0.12], [0.45, 0.3, 0.14], [0.3, 0.42, 0.2]];
    for (let i = 0; i < 4; i++) P.basket(b, -1.0 + i * 0.6, 1.28, hd - 0.45, 0.75, fills[i]);
    for (let i = 0; i < 5; i++) b.sphere('sack', 0.4, -hw + 0.9 + i * 0.85, 0.75, hd + 0.75, { sx: 1.2, sy: 0.7, sz: 0.9 });
    for (let i = 0; i < 3; i++) P.urn(b, -hw + 0.7 + i * 0.85, 0.53, -hd + 0.55, 0.85);
    shelf(b, hw - 1.4, -hd + 0.3, 2.0);
    for (let i = 0; i < 6; i++) P.pot(b, hw - 2.2 + (i % 3) * 0.6, 0.94 + Math.floor(i / 3) * 0.5, -hd + 0.3, 0.45, i % 2 ? [0.55, 0.3, 0.16] : [0.62, 0.52, 0.3]);
    for (let i = 0; i < 3; i++) bananas(b, -1.2 + i * 1.2, 2.6, hd + 0.2);
    for (let i = 0; i < 4; i++) b.box('paint', 0.18, 0.12, 0.18, 0.9 + (i % 2) * 0.22, 1.28 + Math.floor(i / 2) * 0.12, hd - 0.4, { col: [0.32, 0.18, 0.08] });   // jaggery
  },
  cloth(b, hw, hd, rng) {
    const C = [[0.95, 0.93, 0.86], [0.7, 0.16, 0.14], [0.2, 0.3, 0.5], [0.92, 0.85, 0.6], [0.24, 0.42, 0.3], [0.5, 0.2, 0.4]];
    shelf(b, 0, -hd + 0.3, hw * 1.6, 0, 3);
    for (let lv = 0; lv < 3; lv++) for (let i = 0; i < 6; i++) b.box('paint', 0.42, 0.28, 0.3, -hw * 0.75 + 0.3 + i * (hw * 1.5 / 6), 0.94 + lv * 0.5, -hd + 0.3, { col: C[(i + lv * 2) % 6] });
    b.cyl('wood', 0.02, 0.02, hw * 1.7, 0, 2.45, hd + 0.35, { seg: 5, rz: Math.PI / 2 });
    for (let i = 0; i < 6; i++) { const x = -hw * 0.75 + i * (hw * 1.5 / 5); b.box('paint', 0.55, 1.1, 0.01, x, 1.35, hd + 0.36, { col: C[i % 6] }); if (i % 2 === 0) b.box('brass', 0.55, 0.06, 0.012, x, 1.38, hd + 0.37, { col: BRASS }); }
    for (let i = 0; i < 4; i++) b.cyl('paint', 0.09, 0.09, 0.8, -0.9 + i * 0.4, 1.33, hd - 0.45, { seg: 8, rz: Math.PI / 2, col: C[(i + 1) % 6] });
  },
  vessels(b, hw, hd, rng) {
    shelf(b, 0, -hd + 0.3, hw * 1.6, 0, 3);
    for (let lv = 0; lv < 3; lv++) for (let i = 0; i < 5; i++) { const x = -hw * 0.7 + i * (hw * 1.4 / 4); if ((i + lv) % 2) P.kindi(b, x, 0.94 + lv * 0.5, -hd + 0.3, 1.0); else P.pot(b, x, 0.94 + lv * 0.5, -hd + 0.3, 0.42, (i + lv) % 3 ? BRASS : COPPER); }
    for (let i = 0; i < 3; i++) P.lamp(b, -0.9 + i * 0.6, 1.28, hd - 0.45, 0.45, 0);
    for (let i = 0; i < 7; i++) P.pot(b, -hw + 0.6 + (i % 4) * 0.55, 0.5 + Math.floor(i / 4) * 0.42, hd + 0.75, 0.6, i % 2 ? BRASS : COPPER);
    for (let i = 0; i < 5; i++) b.cyl('brass', 0.16, 0.16, 0.02, -1.2 + i * 0.6, 2.25, hd + 0.3, { seg: 12, rx: Math.PI / 2, col: i % 2 ? BRASS : COPPER });
  },
  vaidyasala(b, hw, hd, rng) {
    shelf(b, 0, -hd + 0.3, hw * 1.6, 0, 3);
    for (let lv = 0; lv < 3; lv++) for (let i = 0; i < 7; i++) P.pot(b, -hw * 0.75 + i * (hw * 1.5 / 6), 0.94 + lv * 0.5, -hd + 0.3, 0.32, [[0.45, 0.28, 0.16], [0.3, 0.22, 0.15], [0.62, 0.55, 0.42]][(i + lv) % 3]);
    for (let i = 0; i < 6; i++) b.cone('paint', 0.07, 0.35, -1.3 + i * 0.5, 2.05, hd + 0.3, { seg: 5, rx: Math.PI, col: i % 2 ? [0.3, 0.42, 0.2] : [0.45, 0.38, 0.2] });
    b.cyl('stone', 0.16, 0.18, 0.28, 0.9, 1.28, hd - 0.45, { seg: 10 }); b.cyl('wood', 0.025, 0.025, 0.45, 0.95, 1.5, hd - 0.42, { seg: 5, rz: 0.3 });
    for (let i = 0; i < 3; i++) P.urn(b, -hw + 0.6 + i * 0.75, 0.53, hd - 1.2, 0.6);
  },
  anchal(b, hw, hd, rng) {
    b.box('plank', 0.5, 0.06, 0.35, -0.6, 1.28, hd - 0.45, { col: [0.3, 0.2, 0.14] });            // the ledger
    for (let i = 0; i < 6; i++) b.box('paint', 0.22, 0.05, 0.12, 0.4 + (i % 3) * 0.25, 1.28 + Math.floor(i / 3) * 0.05, hd - 0.45, { col: [0.88, 0.84, 0.72] });   // letters
    shelf(b, 0, -hd + 0.3, hw * 1.4, 0, 3);
    for (let i = 0; i < 12; i++) b.box('paint', 0.3, 0.2, 0.25, -hw * 0.6 + (i % 4) * (hw * 1.2 / 3), 0.94 + Math.floor(i / 4) * 0.5, -hd + 0.3, { col: i % 3 ? [0.6, 0.5, 0.36] : [0.82, 0.78, 0.66] });
    // the red anchal box on its pillar, and a bench for those waiting
    b.cyl('paint', 0.17, 0.2, 1.0, hw + 0.4, 0, hd + 1.9, { seg: 12, col: [0.62, 0.08, 0.06] }); b.sphere('paint', 0.18, hw + 0.4, 1.02, hd + 1.9, { sy: 0.6, col: [0.62, 0.08, 0.06] });
    b.box('paint', 0.14, 0.02, 0.04, hw + 0.4, 0.82, hd + 2.1, { col: [0.1, 0.06, 0.04] }); b.circle(hw + 0.4, hd + 1.9, 0.22);
    b.box('plank', 1.8, 0.07, 0.4, -hw + 1.3, 0.92, hd + 0.7, { tile: 0.8 }); for (const s of [-1, 1]) b.box('wood', 0.07, 0.42, 0.35, -hw + 1.3 + s * 0.8, 0.5, hd + 0.7);
  },
  pottery(b, hw, hd, rng) {
    for (let r = 0; r < 4; r++) for (let i = 0; i < 4 - r; i++) P.pot(b, -hw + 0.8 + i * 0.62 + r * 0.31, 0.5 + r * 0.42, hd + 1.0, 0.68, [0.66, 0.34, 0.2]);
    for (let i = 0; i < 6; i++) P.urn(b, hw - 0.6 - (i % 3) * 0.8, 0.53, -hd + 0.6 + Math.floor(i / 3) * 0.8, 0.8);
    // the wheel, with a pot half thrown on it
    b.cyl('stone', 0.42, 0.45, 0.12, -0.6, 0.53, -0.4, { seg: 16, col: [0.45, 0.4, 0.36] }); P.pot(b, -0.6, 0.66, -0.4, 0.45, [0.55, 0.36, 0.26]);
    for (let i = 0; i < 8; i++) P.pot(b, 0.6 + (i % 4) * 0.45, 0.53, hd - 0.9 + Math.floor(i / 4) * 0.45, 0.4, [0.62, 0.42, 0.3]);    // drying
  },
};

// A bazaar shophouse of the fifties: two storeys of colour-washed plaster, the shop open to the street
// below behind folding plank shutters and a tin awning, a balcony and shuttered windows above, and
// either a tiled roof or a flat concrete one behind a parapet with the year it was built.
const WASH = [[0.72, 0.84, 0.92], [0.8, 0.9, 0.72], [0.96, 0.84, 0.58], [0.96, 0.8, 0.8], [0.95, 0.94, 0.9], [0.84, 0.9, 0.95], [0.92, 0.88, 0.7]];
const SHUT = [[0.18, 0.42, 0.3], [0.2, 0.32, 0.55], [0.55, 0.2, 0.16], [0.34, 0.3, 0.26]];
export function shophouse57(b, x, z, ry, w, d, seed) {
  b.place(x, z, ry);
  const y0 = 0.5, hw = w / 2, hd = d / 2, g1 = 3.1, g2 = 2.7, wash = WASH[seed % WASH.length], shut = SHUT[(seed >> 1) % SHUT.length];
  const dado = wash.map((c) => c * 0.62), wo = { col: wash, dado, shutter: shut };
  b.box('laterite', w + 0.6, 2.0, d + 1.8, 0, -1.5, 0.5); b.platform(0, 0.5, (w + 0.6) / 2, (d + 1.8) / 2, y0);
  b.box('paint', w - 0.26, 0.03, d - 0.26, 0, y0, 0, { col: [0.5, 0.17, 0.12] });                  // red-oxide floor
  wall(b, 'wall', -hw, hd, hw, hd, y0, g1, [{ at: hw, w: w * 0.74, kind: 'door', h: 2.55, leaf: false }], { ...wo, out: 1 });
  wall(b, 'wall', -hw, -hd, hw, -hd, y0, g1, [], { ...wo, out: -1 });
  wall(b, 'wall', -hw, -hd, -hw, hd, y0, g1, [], { ...wo, out: -1 });
  wall(b, 'wall', hw, -hd, hw, hd, y0, g1, [], { ...wo, out: 1 });
  // the floor above, running out over the street as a balcony
  const y1 = y0 + g1;
  b.box('stone', w + 0.3, 0.16, d + 1.1, 0, y1, 0.45, { col: [0.8, 0.78, 0.74] });
  b.box('paint', w + 0.34, 0.07, 0.06, 0, y1 + 0.02, hd + 1.0, { col: dado });
  // the middle opening is a door onto the balcony
  const FW = [-1, 0, 1].map((k) => (k === 0 ? { at: hw, w: 0.9, kind: 'door', h: 2.1, col: shut } : { at: hw + k * w * 0.3, w: 0.85, kind: 'window', h: 1.3, sill: 0.8 }));
  wall(b, 'wall', -hw, hd, hw, hd, y1 + 0.16, g2, FW, { ...wo, dado: null, out: 1 });
  wall(b, 'wall', -hw, -hd, hw, -hd, y1 + 0.16, g2, [{ at: hw, w: 0.8, kind: 'window', sill: 0.9 }], { ...wo, dado: null, out: -1 });
  wall(b, 'wall', -hw, -hd, -hw, hd, y1 + 0.16, g2, [], { ...wo, dado: null, out: -1 });
  wall(b, 'wall', hw, -hd, hw, hd, y1 + 0.16, g2, [], { ...wo, dado: null, out: 1 });
  const bz = hd + 0.92, by = y1 + 0.16, n = Math.round(w / 0.2);
  b.box('wood', w + 0.24, 0.08, 0.1, 0, by + 0.86, bz, { col: shut }); b.box('wood', w + 0.24, 0.06, 0.08, 0, by + 0.08, bz, { col: shut });
  for (let i = 0; i <= n; i++) b.cyl('wood', 0.022, 0.028, 0.78, -hw - 0.06 + i * (w + 0.12) / n, by + 0.08, bz, { seg: 5, col: [0.92, 0.9, 0.84] });
  for (const s of [-1, 1]) { b.box('wood', 0.08, 0.08, 0.95, s * (hw + 0.1), by + 0.86, hd + 0.45, { col: shut }); }
  // the roof: tiles, or a flat roof behind a parapet with the year on it
  const yt = by + g2;
  if (seed % 2) {
    b.roofHip('roof', w + 1.0, d + 2.0, 1.6, Math.max(w - d, w * 0.3), 0, yt - 0.06, 0.45);
  } else {
    b.box('stone', w + 0.3, 0.18, d + 0.3, 0, yt, 0, { col: [0.8, 0.78, 0.74] });
    b.box('wall', w + 0.3, 0.78, 0.16, 0, yt + 0.18, hd + 0.07, { col: wash });
    b.box('wall', w * 0.36, 0.44, 0.17, 0, yt + 0.96, hd + 0.07, { col: wash });
    for (const s of [-1, 1]) b.box('wall', 0.16, 0.5, d + 0.3, s * (hw + 0.07), yt + 0.18, 0, { col: wash });
    b.box('wall', w + 0.3, 0.5, 0.16, 0, yt + 0.18, -hd - 0.07, { col: wash });
    b.box('paint', w + 0.38, 0.08, 0.22, 0, yt + 0.9, hd + 0.07, { col: dado });
    b.decal('plaque', seed % 8, 4, 2, 0.86, 0.43, 0, yt + 1.18, hd + 0.16);
  }
  // the tin awning over the shop front on iron brackets, the plank shutters stacked to one side
  b.box('tin', w * 0.94, 0.04, 1.45, 0, y0 + 2.36, hd + 0.66, { rx: 0.24, col: [0.66, 0.64, 0.6] });
  for (const s of [-1, 1]) b.box('paint', 0.04, 0.04, 1.2, s * w * 0.42, y0 + 2.2, hd + 0.55, { rx: 0.6, col: [0.18, 0.18, 0.2] });
  for (let i = 0; i < 6; i++) b.box('plank', 0.22, 2.4, 0.035, -hw + 0.32 + i * 0.045, y0, hd + 0.18 + i * 0.035, { ry: 0.05, col: shut.map((c) => c * 1.15) });
  b.decal('ads', seed % 4, 4, 1, 0.8, 0.8, hw + 0.135, y0 + 1.7, -0.7, Math.PI / 2);
  b.interior(0, 0, hw, hd, y1, y0);
  // upstairs: the family's room over the shop, and the balcony over the street
  const yu = y1 + 0.16;
  b.platform(0, 0.45, hw, hd + 0.55, yu); b.interior(0, 0, hw - 0.1, hd - 0.1, yt - 0.05, yu);
  b.box('paint', w - 0.3, 0.02, d - 0.3, 0, yu, 0, { col: [0.5, 0.17, 0.12] });
  b.box('plank', w - 0.2, 0.06, d - 0.2, 0, yt - 0.06, 0, { tile: 1.2, col: [0.6, 0.48, 0.38] });
  stair(b, hw - 0.6, -hd + 0.3 + 1.8, y0, yu);
  b.box('wood', 1.9, 0.35, 0.9, -hw + 1.2, yu, -hd + 0.6, { col: [0.4, 0.28, 0.2] }); b.box('paint', 1.8, 0.08, 0.85, -hw + 1.2, yu + 0.35, -hd + 0.6, { col: [0.86, 0.82, 0.72] });   // a cot
  b.collider(-hw + 1.2, -hd + 0.6, 0.95, 0.45, 0, yu + 0.5);
  P.chest(b, -hw + 0.6, yu, 0.6, Math.PI / 2, 0.9); F.chair(b, -0.3, yu, 0.6, Math.PI * 0.2);
  b.decal('poster', seed % 4, 4, 1, 0.5, 0.75, -hw + 0.13, yu + 1.3, -0.6, Math.PI / 2);
  b.lamp(0, yt - 0.4, 0, 0.8, 0);
  b.yard(Math.max(w, d) * 0.75 + 4, 0.7).clear(Math.max(w, d) * 0.62 + 2).mark(w + 2, d + 2);
  b.lamp(1.2, y0 + 2.3, hd + 0.4, 1, 0);
}

export function shop(b, x, z, ry, kind, sign, rng, o = {}) {
  const w = o.w || 6.6, d = o.d || 5.2, hw = w / 2, hd = d / 2;
  shophouse57(b, x, z, ry, w, d, Math.abs(Math.round(x * 7.3 + z * 3.1)));
  b.sign(sign, 2.4, 0.5, 0, 0.5 + 2.58, hd + 0.14);
  // the counter across most of the opening, a gap at one end to walk in
  const cw = Math.min(3.6, w * 0.58) * 0.72;
  b.box('plank', cw, 0.75, 0.55, -0.45, 0.5, hd - 0.45, { tile: 0.8, col: [0.55, 0.42, 0.3] });
  b.box('plank', cw + 0.06, 0.05, 0.6, -0.45, 1.25, hd - 0.45, { tile: 0.8, col: [0.45, 0.34, 0.24] });
  b.collider(-0.45, hd - 0.45, cw / 2, 0.3, 0, 1.3);
  b.box('plank', 0.5, 0.45, 0.45, -0.45, 0.5, hd - 1.25, { tile: 0.8 });                 // the keeper's stool
  GOODS[kind](b, hw, hd, rng);
  return { kind, ry, keeper: b.world(-0.45, 0, hd - 1.25), customer: b.world(-0.2, 0, hd + 1.3), front: b.world(0, 0, hd + 2) };
}

export function buildVillage(b, rng, SPOTS, lampPost) {
  const foot = [];                                    // footprints, so stray street props can be kept clear
  const shops = [];
  // ---- the bazaar: shophouses on both sides of the road, east of the junction
  const north = [[6.5, 'provisions', 8, 5.6], [15, 'cloth', 9], [23, 'vessels', 10], [31, 'vaidyasala', 11], [39, 'anchal', 12], [55, 'provisions', 8]];
  const south = [[24, 'cloth', 9], [34, 'vessels', 10], [54, 'pottery', 13]];
  for (const [s, kind, sign, w] of north) { const [x, z] = along(s, 8.6); shops.push(shop(b, x, z, FACE_S, kind, sign, rng, { awning: kind === 'provisions' ? 1 : 0, w })); foot.push([x, z, 5.4]); }
  for (const [s, kind, sign, w] of south) { const [x, z] = along(s, -8.6); shops.push(shop(b, x, z, FACE_N, kind, sign, rng, { awning: kind === 'cloth' ? 1 : 0, w })); foot.push([x, z, 5.4]); }

  // ---- the market: an open pavilion of posts under a tiled roof, stalls beneath
  {
    const [x, z] = along(8, -10.5);
    b.place(x, z, FACE_N);
    const W = 11, Dd = 6.5;
    b.box('laterite', W + 1, 1.6, Dd + 1, 0, -1.2, 0); b.platform(0, 0, W / 2 + 0.5, Dd / 2 + 0.5, 0.4);
    for (let i = 0; i <= 5; i++) for (const sz of [-1, 1]) { const px = -W / 2 + i * W / 5; b.cyl('wood', 0.13, 0.16, 2.6, px, 0.4, sz * Dd / 2, { seg: 8 }); b.circle(px, sz * Dd / 2, 0.17); }
    b.roofHip('roof', W + 2.4, Dd + 2.4, 2.4, W - Dd + 1, 0, 2.95, 0);
    b.box('roof', W - Dd + 1.3, 0.14, 0.34, 0, 2.95 + 2.33, 0, { col: [0.6, 0.55, 0.5], tile: 1 });
    b.sign(14, 2.6, 0.65, 0, 2.2, Dd / 2 + 0.05);
    const veg = [[0.3, 0.55, 0.2], [0.85, 0.42, 0.1], [0.45, 0.2, 0.42], [0.82, 0.78, 0.25], [0.6, 0.62, 0.6], [0.7, 0.18, 0.1]];
    for (let st = 0; st < 4; st++) {
      const sx = -W / 2 + 1.6 + st * (W - 3.2) / 3;
      b.box('plank', 2.0, 0.08, 1.1, sx, 0.95, 0.8, { tile: 0.8, col: [0.6, 0.48, 0.36] });
      for (const lx of [-0.9, 0.9]) b.box('wood', 0.07, 0.55, 1.0, sx + lx, 0.4, 0.8);
      b.collider(sx, 0.8, 1.0, 0.55, 0, 1.0);
      for (let k = 0; k < 3; k++) P.basket(b, sx - 0.6 + k * 0.6, 1.03, 0.8, 0.7, veg[(st * 2 + k) % 6]);
      if (st % 2) bananas(b, sx, 2.7, 1.6);
    }
    for (let i = 0; i < 9; i++) b.sphere('paint', 0.12, -W / 2 + 0.8 + (i % 3) * 0.25, 0.52 + Math.floor(i / 3) * 0.17, -1.8 + (i % 2) * 0.1, { col: [0.45, 0.32, 0.18] });   // coconuts
    for (let i = 0; i < 3; i++) P.basket(b, W / 2 - 1.2 - i * 0.7, 0.42, -1.6, 0.8, [0.62, 0.66, 0.68]);   // fish
    b.yard(9, 0.75).clear(9).mark(W + 1, Dd + 1);
    SPOTS.market = b.world(0, 0, 0); SPOTS.marketRy = FACE_N;
    SPOTS.marketStalls = [0, 1, 2, 3].map((st) => b.world(-W / 2 + 1.6 + st * (W - 3.2) / 3, 0, -0.1));
    SPOTS.marketBuyers = [0, 1, 2].map((st) => b.world(-W / 2 + 2.2 + st * (W - 3.2) / 3, 0, 1.9));
    foot.push([x, z, 7.5]);
  }

  // ---- the village school: an open thatched hall with a low wall, mats and slates
  {
    const [x, z] = along(66, -10.5);
    b.place(x, z, FACE_N);
    const W = 8.5, Dd = 6;
    b.box('laterite', W + 0.6, 1.6, Dd + 0.6, 0, -1.2, 0); b.platform(0, 0, W / 2 + 0.3, Dd / 2 + 0.3, 0.4);
    for (const [x0, z0, x1, z1] of [[-W / 2, -Dd / 2, W / 2, -Dd / 2], [-W / 2, -Dd / 2, -W / 2, Dd / 2], [W / 2, -Dd / 2, W / 2, Dd / 2]]) {
      const ax = Math.abs(x1 - x0) > 0.1, len = ax ? W : Dd;
      b.box('laterite', ax ? len : 0.3, 0.65, ax ? 0.3 : len, (x0 + x1) / 2, 0.4, (z0 + z1) / 2, { col: [0.95, 0.85, 0.8] });
      b.collider((x0 + x1) / 2, (z0 + z1) / 2, ax ? len / 2 : 0.15, ax ? 0.15 : len / 2, 0, 1.05);
    }
    for (let i = 0; i <= 4; i++) for (const sz of [-1, 1]) { const px = -W / 2 + i * W / 4; b.cyl('wood', 0.1, 0.12, 2.3, px, 0.4, sz * Dd / 2, { seg: 7 }); }
    b.roofHip('thatch', W + 2.2, Dd + 2.2, 2.6, W - Dd + 1, 0, 2.6, 0);
    b.sign(15, 2.6, 0.65, 0, 2.05, Dd / 2 + 0.05);
    for (let r = 0; r < 2; r++) P.mat(b, -1.5 + r * 3, 0.43, 0.6, 0, 2.6, 1.0);
    for (const r of [0, 1]) b.box('plank', 6.2, 0.3, 0.32, -0.0, 0.4, 0.9 + r * 0.5 - 0.02, { tile: 0.8, col: [0.5, 0.4, 0.3] });   // low benches for the pupils
    b.box('plank', 0.5, 0.36, 0.45, 0, 0.4, -2.35, { tile: 0.8 });   // the asan's stool
    for (let i = 0; i < 6; i++) b.box('paint', 0.22, 0.015, 0.16, -2.6 + i * 1.05 + 0.38, 0.7, 0.88 + (i % 2) * 0.5, { ry: 0.2 * (i % 3), col: [0.12, 0.13, 0.14] });   // slates
    b.box('wood', 1.2, 0.04, 0.8, 0, 0.43, -2.0, { col: [0.6, 0.5, 0.36] });     // the asan's mat and his palm-leaf books
    for (let i = 0; i < 4; i++) b.box('paint', 0.35, 0.03, 0.06, -0.3 + (i % 2) * 0.4, 0.47 + Math.floor(i / 2) * 0.03, -2.0, { col: [0.78, 0.68, 0.42] });
    b.yard(8, 0.7).clear(8).mark(W + 0.6, Dd + 0.6);
    SPOTS.school = b.world(0, 0, 0); SPOTS.schoolRy = FACE_N;
    SPOTS.asan = b.world(0, 0, -2.35);
    SPOTS.pupils = [0, 1, 2, 3, 4, 5].map((i) => b.world(-2.6 + i * 1.05, 0, 0.9 + (i % 2) * 0.5));
    foot.push([x, z, 6.5]);
  }

  // ---- the square at the junction: a banyan on its stone platform (aalthara), a roadside shrine
  {
    const sx = -49, sz = 25;
    b.place(sx, sz, 0);
    b.cyl('laterite', 3.4, 3.5, 0.45, 0, 0, 0, { seg: 24, col: [0.85, 0.8, 0.75] });
    b.cyl('laterite', 2.7, 2.8, 0.45, 0, 0.45, 0, { seg: 24, col: [0.85, 0.8, 0.75] });
    b.cyl('stone', 2.75, 2.75, 0.06, 0, 0.9, 0, { seg: 24 });
    b.platform(0, 0, 2.6, 2.6, 0.92);
    b.circle(0, 0, 3.4);
    P.lamp(b, 1.6, 0.92, 1.6, 0.8, 0);
    b.yard(12, 0.8, 4, 5).clear(4.5);
    SPOTS.aalthara = b.world(0, 0, 0);
    SPOTS.squareTalk = [b.world(3.6, 0, 3.4), b.world(4.6, 0, 4.4)];
    foot.push([sx, sz, 4]);
    // the shrine: a small tiled shelter over a stone and a lamp
    b.place(-44, 19, FACE_S);
    b.box('laterite', 1.6, 0.6, 1.6, 0, 0, 0, { col: [0.85, 0.8, 0.75] });
    for (const [px, pz] of [[-0.6, -0.6], [0.6, -0.6], [0.6, 0.6], [-0.6, 0.6]]) b.cyl('wood', 0.05, 0.06, 1.3, px, 0.6, pz, { seg: 6 });
    b.roofHip('roof', 2.0, 2.0, 0.9, 0.05, 0, 1.9, 0);
    b.sphere('stone', 0.18, 0, 0.78, 0, { sy: 1.4, col: [0.25, 0.22, 0.2] });
    b.box('paint', 0.2, 0.02, 0.2, 0, 0.6, 0.25, { col: [0.9, 0.2, 0.25] });
    P.lamp(b, 0.35, 0.6, 0.4, 0.4, 1);
    b.collider(0, 0, 0.8, 0.8, 0, 2.2);
    foot.push([-44, 19, 1.5]);
  }

  // ---- houses along the lanes, fronts toward the lane, fences and washing lines
  const H = [
    // lane east
    [-6, -17, Math.PI / 2, { w: 7 }], [-7, -31, Math.PI / 2, { w: 6.5, roof: 'thatch', mud: true }], [14, -17, -Math.PI / 2, { w: 7 }], [12.5, -31, -Math.PI / 2, { w: 6, d: 5 }],
    // lane south
    [18, 19, -Math.PI / 2, { w: 6.5 }], [19, 32, -Math.PI / 2, { w: 6, roof: 'thatch' }], [0, 40, Math.PI / 2, { w: 6.5 }],
    [-10, 62, Math.PI, { w: 7 }], [-25, 63, Math.PI, { w: 6, d: 5, roof: 'thatch', mud: true }], [-23, 45, 0, { w: 6.5 }],
    // lane west
    [-54, -1, -Math.PI / 2, { w: 6.5 }], [-55.5, -18, -Math.PI / 2, { w: 6, roof: 'thatch' }],
  ];
  for (const [x, z, ry, o] of H) { house(b, x, z, ry, { fence: true, ...o }); foot.push([x, z, 5.5]); }

  // ---- lamp posts along the bazaar and lanes
  for (const s of [3, 19, 35, 51]) { const [x, z] = along(s, 4.4); lampPost(b, x, z, s % 2); }
  for (const [x, z] of [[2, -24], [10, 26], [-15, 51], [-60, -6]]) lampPost(b, x, z, 0);

  SPOTS.shops = shops;
  return foot;
}
