// Thekkumkara in 1957: what the village gained in fifty years. Electric poles and wires along the
// roads, a bus stand, a tent cinema with its posters, a ration shop, a reading room, the panchayat
// office, and — it being election season — the party offices with their flags, bunting across the
// bazaar and slogans on the walls.
// Everything here is placed after the rest of the world is built: each building searches outward
// from where it would like to stand for dry, level, unbuilt ground beside a road, and faces it.
import * as THREE from 'three';
import { getHeight, ROADS } from './heightfield.js';
import { pointInBox } from './physics.js';
import { house, wall, hall, stair, holed, holedPlatform, F, P } from './houses.js';
import { shop } from './village.js';

const TAU = Math.PI * 2;
const ROAD_HALF = { ptMain: 3, ptCross: 2.5, ptEast: 2.3, ptNorth: 1.8, kvLane: 1.5, mkLane: 1.5, chLane: 1.5, main: 3, north: 2.3, hill: 2.1, south: 1.6, home: 1.5, quay: 3, temple: 2, laneE: 1.4, laneS: 1.4, laneW: 1.3, coast: 1.5, bar: 1.5, estate: 1.7, towpath: 1.2, hamlet: 1.5 };

// the nearest point of any road: where, how far, and which way it runs
function nearestRoad(x, z) {
  let best = { d: 1e9 };
  for (const k in ROADS) {
    const pts = ROADS[k];
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i][0], az = pts[i][1], bx = pts[i + 1][0], bz = pts[i + 1][1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)), px = ax + dx * t, pz = az + dz * t, d = Math.hypot(x - px, z - pz);
      if (d < best.d) best = { d, x: px, z: pz, k, tx: dx / Math.sqrt(l2), tz: dz / Math.sqrt(l2) };
    }
  }
  return best;
}

function findSpot(b, ax, az, R, { gap = 2, far = 9, maxR = 90 } = {}) {
  const ok = (x, z) => {
    const h = getHeight(x, z);
    if (h < 0.7 || h > 22) return null;
    for (const [sx, sz] of [[R, 0], [-R, 0], [0, R], [0, -R]]) if (Math.abs(getHeight(x + sx, z + sz) - h) > 0.9 || getHeight(x + sx, z + sz) < 0.5) return null;
    const r = nearestRoad(x, z), half = ROAD_HALF[r.k] ?? 2;
    if (r.d < R + half + gap || r.d > R + half + far) return null;
    if (pointInBox(x, z, R * 0.8)) return null;
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; if (pointInBox(x + Math.cos(a) * (R + 0.5), z + Math.sin(a) * (R + 0.5), 0.2)) return null; }
    for (const y of b.yards) if (Math.hypot(x - y.x, z - y.z) < y.r * 0.45 + R) return null;
    return { x, z, ry: Math.atan2(r.x - x, r.z - z), road: r };
  };
  for (let ring = 0; ring <= maxR; ring += 2.5) {
    const n = Math.max(1, Math.round(ring * TAU / 3));
    for (let k = 0; k < n; k++) {
      const a = k / n * TAU + ring * 0.37, s = ok(ax + Math.cos(a) * ring, az + Math.sin(a) * ring);
      if (s) return s;
    }
  }
  return null;
}

// a flag on a mast: the party's red, or the tricolour
function flag(b, x, z, kind, h = 6) {
  b.cyl('wood', 0.045, 0.06, h, x, 0, z, { seg: 6, col: [0.85, 0.82, 0.76] });
  const y = h - 0.75;
  if (kind === 'red') {
    b.box('paint', 1.0, 0.64, 0.02, x + 0.52, y, z, { col: [0.72, 0.06, 0.05] });
    b.box('paint', 0.16, 0.16, 0.025, x + 0.3, y + 0.38, z, { col: [0.95, 0.85, 0.3] });      // the emblem, small at the hoist
  } else {
    [[1.0, 0.55, 0.2], [0.96, 0.95, 0.92], [0.1, 0.45, 0.18]].forEach((c, i) => b.box('paint', 1.0, 0.213, 0.02, x + 0.52, y + 0.427 - i * 0.213, z, { col: c }));
    b.cyl('paint', 0.07, 0.07, 0.025, x + 0.52, y + 0.307, z + 0.012, { seg: 12, rx: Math.PI / 2, col: [0.1, 0.12, 0.45] });
  }
  b.circle(x, z, 0.1);
}

// A public building of the fifties: a plastered block on a raised plinth, a verandah of square
// columns under a flat concrete slab across the front, and a parapet with a raised centre panel
// that carries the board. Two storeys for the panchayat, one for the party offices.
export function office57(b, x, z, ry, w, d, o = {}) {
  b.place(x, z, ry);
  const y0 = 0.6, hw = w / 2, hd = d / 2, h1 = 3.0, col = o.col || [0.94, 0.9, 0.8], trim = o.trim || [0.55, 0.32, 0.22];
  const dado = col.map((c) => c * 0.6), wo = { col, dado, shutter: o.shutter || [0.2, 0.32, 0.5] }, vd = 1.9;
  b.box('laterite', w + 0.8, 2.1, d + vd + 1.2, 0, -1.5, vd / 2); b.platform(0, vd / 2, (w + 0.8) / 2, (d + vd + 1.2) / 2, y0);
  b.box('paint', w + 0.6, 0.04, vd + 0.4, 0, y0, hd + vd / 2 + 0.1, { col: [0.5, 0.17, 0.12] });   // red-oxide verandah floor
  b.box('paint', w - 0.26, 0.03, d - 0.26, 0, y0, 0, { col: [0.5, 0.17, 0.12] });
  const FO = [{ at: hw, w: 1.3, kind: 'door', h: 2.3 }];
  for (const s of [-1, 1]) for (const k of (w > 7.5 ? [0.22, 0.38] : [0.3])) FO.push({ at: hw + s * w * k, w: 0.95, kind: 'window', h: 1.35, sill: 0.8 });
  wall(b, 'wall', -hw, hd, hw, hd, y0, h1, FO, { ...wo, out: 1 });
  wall(b, 'wall', -hw, -hd, hw, -hd, y0, h1, [{ at: hw, w: 0.95, kind: 'window', h: 1.3, sill: 0.85 }], { ...wo, out: -1 });
  wall(b, 'wall', -hw, -hd, -hw, hd, y0, h1, [{ at: hd, w: 0.95, kind: 'window', h: 1.3, sill: 0.85 }], { ...wo, out: -1 });
  wall(b, 'wall', hw, -hd, hw, hd, y0, h1, [{ at: hd, w: 0.95, kind: 'window', h: 1.3, sill: 0.85 }], { ...wo, out: 1 });
  // the verandah: square columns with a moulded base and cap, a low wall between the outer pairs
  const vz = hd + vd, nc = Math.max(3, Math.round(w / 2.4));
  for (let i = 0; i <= nc; i++) {
    const cx = -hw + 0.2 + i * (w - 0.4) / nc;
    b.box('wall', 0.32, h1, 0.32, cx, y0, vz - 0.16, { col });
    b.box('wall', 0.42, 0.3, 0.42, cx, y0, vz - 0.16, { col: dado });
    b.box('wall', 0.42, 0.12, 0.42, cx, y0 + h1 - 0.12, vz - 0.16, { col: trim });
    b.collider(cx, vz - 0.16, 0.2, 0.2);
    if (i < nc && (i === 0 || i === nc - 1) && nc > 2) { const mx = cx + (w - 0.4) / nc / 2; b.box('wall', (w - 0.4) / nc - 0.32, 0.75, 0.2, mx, y0, vz - 0.16, { col }); b.box('wall', (w - 0.4) / nc - 0.26, 0.07, 0.28, mx, y0 + 0.75, vz - 0.16, { col: trim }); b.collider(mx, vz - 0.16, (w - 0.4) / nc / 2 - 0.16, 0.12); }
  }
  for (let i = 0; i < 3; i++) b.box('stone', 2.2, 0.2, 0.42, 0, y0 - 0.2 - i * 0.2, vz + 0.2 + i * 0.42, { col: [0.72, 0.7, 0.66] });
  let yt = y0 + h1;
  const well = o.storeys === 2 ? stair(b, -hw + 0.6, -hd + 0.95, y0, yt + 0.2) : null;
  holed(b, 'stone', 0, vd / 2 + 0.05, w + 0.4, d + vd + 0.5, yt, 0.2, well, { col: [0.84, 0.82, 0.78] });
  b.box('paint', w + 0.44, 0.08, 0.06, 0, yt + 0.06, vz + 0.32, { col: trim });
  if (o.storeys === 2) {        // a second floor set back over the verandah roof, its own row of windows
    const y2 = yt + 0.2, F2 = [];
    for (let k = -2; k <= 2; k++) if (Math.abs(k * w * 0.19) < hw - 0.6) F2.push(k === 0 ? { at: hw, w: 1.0, kind: 'door', h: 2.2 } : { at: hw + k * w * 0.19, w: 0.9, kind: 'window', h: 1.3, sill: 0.85 });
    wall(b, 'wall', -hw, hd, hw, hd, y2, 2.8, F2, { ...wo, dado: null, out: 1 });
    wall(b, 'wall', -hw, -hd, hw, -hd, y2, 2.8, [], { ...wo, dado: null, out: -1 });
    wall(b, 'wall', -hw, -hd, -hw, hd, y2, 2.8, [{ at: hd, w: 0.9, kind: 'window', h: 1.3, sill: 0.85 }], { ...wo, dado: null, out: -1 });
    wall(b, 'wall', hw, -hd, hw, hd, y2, 2.8, [{ at: hd, w: 0.9, kind: 'window', h: 1.3, sill: 0.85 }], { ...wo, dado: null, out: 1 });
    for (const s of [-1, 1]) b.box('wall', 0.12, 0.85, vd + 0.4, s * (hw + 0.14), y2, hd + vd / 2 + 0.1, { col });     // verandah-roof parapet
    b.box('wall', w + 0.4, 0.85, 0.12, 0, y2, vz + 0.3, { col });
    b.box('stone', w + 0.3, 0.18, d + 0.3, 0, y2 + 2.8, 0, { col: [0.84, 0.82, 0.78] });
    yt = y2 + 2.8; for (const s of [-1, 1]) b.box('wall', 0.14, 0.6, d + 0.3, s * (hw + 0.08), yt + 0.18, 0, { col });
    b.box('wall', w + 0.3, 0.6, 0.14, 0, yt + 0.18, -hd - 0.08, { col }); b.box('wall', w + 0.3, 0.6, 0.14, 0, yt + 0.18, hd + 0.08, { col });
    b.box('paint', w + 0.36, 0.07, 0.2, 0, yt + 0.75, hd + 0.08, { col: trim });
    b.box('wall', 3.0, 0.75, 0.16, 0, yt + 0.78, hd + 0.08, { col });
    b.decal('plaque', o.plaque ?? 3, 4, 2, 0.9, 0.45, 0, yt + 1.0, hd + 0.17);
    b.sign(o.sign, 2.4, 0.6, 0, y2 - 0.08 + 0.42, vz + 0.37);
    // the upper floor: the president's room, and the verandah roof as a terrace
    holedPlatform(b, 0, 0, hw, hd, y2, well); b.platform(0, hd + vd / 2 + 0.1, hw + 0.1, vd / 2 + 0.2, y2);
    b.box('wood', 0.05, 0.9, well.z1 - well.rail[0], well.x1, y2, (well.rail[0] + well.z1) / 2, { col: [0.3, 0.2, 0.14] }); b.box('wood', well.x1 - well.x0, 0.9, 0.05, (well.x0 + well.x1) / 2, y2, well.z1, { col: [0.3, 0.2, 0.14] });
    b.collider((well.x0 + well.x1) / 2, well.z1, (well.x1 - well.x0) / 2, 0.03, 0, 50, y2 - 0.4);
    b.interior(0, 0, hw - 0.1, hd - 0.1, y2 + 2.75, y2);
    holed(b, 'paint', 0, 0, w - 0.3, d - 0.3, y2, 0.02, well, { col: [0.5, 0.17, 0.12] }); b.box('plank', w - 0.2, 0.06, d - 0.2, 0, y2 + 2.74, 0, { tile: 1.2, col: [0.6, 0.48, 0.38] });
    F.desk(b, 1.2, y2, -hd + 1.2, 0, 1.6); F.chair(b, 1.2, y2, -hd + 0.5, 0); F.shelf(b, hw - 0.4, y2, -0.4, 1.8, -Math.PI / 2);
    F.bench(b, 0.4, y2, hd - 0.8, 2.6);
    b.lamp(0, y2 + 2.4, 0, 0.9, 1);
  } else {
    // the parapet over the front, rising to a stepped panel in the middle that holds the board
    const yp = yt + 0.2;
    b.box('wall', w + 0.4, 0.55, 0.14, 0, yp, vz + 0.28, { col });
    for (const s of [-1, 1]) b.box('wall', 0.14, 0.55, d + vd + 0.5, s * (hw + 0.13), yp, vd / 2 + 0.05, { col });
    b.box('wall', w + 0.4, 0.55, 0.14, 0, yp, -hd - 0.2, { col });
    b.box('wall', 3.0, 0.95, 0.15, 0, yp, vz + 0.28, { col }); b.box('wall', 1.6, 0.35, 0.15, 0, yp + 0.95, vz + 0.28, { col });
    b.box('paint', w + 0.48, 0.07, 0.2, 0, yp + 0.55, vz + 0.28, { col: trim });
    b.box('paint', 3.06, 0.07, 0.2, 0, yp + 0.95, vz + 0.28, { col: trim });
    b.sign(o.sign, 2.4, 0.6, 0, yp + 0.18, vz + 0.37);
    b.decal('plaque', o.plaque ?? 0, 4, 2, 0.6, 0.3, 0, yp + 1.0, vz + 0.37);
  }
  b.interior(0, 0, hw, hd, y0 + h1, y0);
  holed(b, 'plank', 0, 0, w - 0.2, d - 0.2, y0 + h1 - 0.06, 0.06, well, { tile: 1.2, col: [0.6, 0.48, 0.38] });
  // inside: a desk under a portrait, benches for the members, files on shelves, a charkha or a red flag
  F.desk(b, 0, y0, -hd + 1.0, 0, 1.6); F.chair(b, 0, y0, -hd + 0.4, 0);
  F.bench(b, -hw / 2 - 0.3, y0, hd - 0.45, Math.min(2.2, hw - 1.0)); F.shelf(b, hw - 0.35, y0, -0.6, 1.6, -Math.PI / 2);
  b.box('wood', 0.62, 0.8, 0.04, 0, y0 + 1.6, -hd + 0.14, { col: [0.3, 0.2, 0.12] }); b.box('paint', 0.5, 0.66, 0.02, 0, y0 + 1.67, -hd + 0.17, { col: o.trim || [0.6, 0.5, 0.4] });
  b.lamp(0, y0 + h1 - 0.4, 0, 0.8, 0);
  b.lamp(0, y0 + h1 - 0.25, hd + 0.5, 1.1, 1);
  b.yard(Math.max(w, d + vd) * 0.75 + 4, 0.7).clear(Math.max(w, d + vd) * 0.62 + 2).mark(w + 2, d + vd + 2);
}

export function buildEra57(b, rng, SPOTS, scene, lampPost) {
  const placed = {};
  const at = (name, ax, az, R, o) => { const s = findSpot(b, ax, az, R, o); if (!s) console.warn('1957: no room for', name); placed[name] = s; return s; };

  // ---- the bus stand on the main road at the east end of the bazaar
  {
    const s = at('busStand', 22, -6, 4.2, { gap: 0.8, far: 4 });
    if (s) {
      b.place(s.x, s.z, s.ry);
      b.box('stone', 7.2, 0.28, 3.6, 0, -0.05, 0, { col: [0.75, 0.72, 0.66] }); b.platform(0, 0, 3.6, 1.8, 0.23);
      for (const px of [-3.2, 3.2]) for (const pz of [-1.4, 1.4]) { b.cyl('paint', 0.06, 0.07, 2.7, px, 0.23, pz, { seg: 8, col: [0.25, 0.28, 0.3] }); b.circle(px, pz, 0.08); }
      b.box('tin', 7.8, 0.05, 4.3, 0, 2.9, 0, { rx: 0.1, col: [0.75, 0.72, 0.66] });
      b.box('paint', 7.8, 0.32, 0.06, 0, 2.62, 2.15, { col: [0.12, 0.22, 0.42] });
      b.sign(16, 2.4, 0.6, 0, 2.78, 2.2);
      b.box('plank', 5.4, 0.08, 0.5, 0, 0.66, -1.1, { tile: 1 }); for (const px of [-2.4, 0, 2.4]) b.box('paint', 0.08, 0.42, 0.4, px, 0.23, -1.1, { col: [0.25, 0.28, 0.3] });
      b.box('plank', 5.4, 0.45, 0.06, 0, 0.74, -1.38, { tile: 1 });
      b.cyl('paint', 0.05, 0.05, 2.2, 3.7, 0, 1.7, { seg: 6, col: [0.25, 0.28, 0.3] }); b.sign(23, 1.9, 0.48, 3.7, 1.9, 1.76);
      b.lamp(0, 2.55, 0.5, 1.1, 1);
      b.yard(6.5, 0.7).clear(7.5).mark(7.5, 4);
      SPOTS.busStand = b.world(0, 0, 3.4); SPOTS.busStandRy = s.ry;
    }
  }

  // ---- Lakshmi Talkies: the town's new picture house, plastered in the Art Deco way the fifties built
  // cinemas — a stepped tower over the entrance with fins and a flagpole, speed-line bands along the
  // wings, a concrete marquee over the doors, and the week's posters in frames either side.
  {
    const s = at('cinema', -66, 32, 9.5, { gap: 2.5, far: 10 });
    if (s) {
      const W = 15, D = 12, hw = W / 2, hd = D / 2, y0 = 0.6, H = 6.2;
      const cream = [0.97, 0.93, 0.84], band = [0.36, 0.6, 0.56], pink = [0.93, 0.74, 0.7], dark = [0.06, 0.05, 0.05];
      b.place(s.x, s.z, s.ry);
      b.box('laterite', W + 1, 2.1, D + 3.4, 0, -1.5, 1.2); b.platform(0, 1.2, hw + 0.5, hd + 1.7, y0);
      b.box('paint', W + 0.6, 0.04, 2.6, 0, y0, hd + 1.4, { col: [0.62, 0.6, 0.56] });
      // the hall: plain plaster, a tin roof hidden behind the parapet, vents high on the sides
      hall(b, 0, 0, W, D, y0, H, { skip: ['front'], col: cream, dado: cream.map((v) => v * 0.6), doors: [{ side: 'back', at: hw - 1.4, w: 1.0, h: 2.1 }], win: 0, floor: [0.42, 0.36, 0.3], ceilCol: [0.22, 0.2, 0.2], light: false });
      // inside: rows of benches on a raked floor, the screen behind a little stage, the projector's beam
      for (let r = 0; r < 6; r++) for (const sx of [-1, 1]) { F.bench(b, sx * 3.6, y0, -1.6 + r * 1.3, 5.2); b.collider(sx * 3.6, -1.6 + r * 1.3, 2.6, 0.2, 0, y0 + 0.5); }
      b.box('wood', W - 1.2, 0.6, 1.6, 0, y0, -hd + 1.0, { col: [0.3, 0.16, 0.12] }); b.collider(0, -hd + 1.0, hw - 0.6, 0.8, 0, y0 + 0.6);
      b.box('paint', 8.4, 3.6, 0.05, 0, y0 + 1.5, -hd + 0.25, { col: [1.6, 1.58, 1.5] });
      for (const sx of [-1, 1]) b.box('paint', 1.6, 4.4, 0.1, sx * 5.0, y0 + 0.9, -hd + 0.35, { col: [0.5, 0.06, 0.08] });
      b.lamp(0, y0 + 3.2, -hd + 0.9, 1.6, 1);
      for (const sd of [-1, 1]) b.box('tin', W - 0.4, 0.06, hd + 0.2, 0, y0 + H - 0.2 + 0.8, sd * hd / 2, { rx: sd * 0.26, col: [0.6, 0.58, 0.54] });
      for (const sd of [-1, 1]) for (let i = 0; i < 4; i++) b.box('paint', 0.04, 0.5, 1.2, sd * (hw + 0.03), y0 + H - 1.4, -hd + 2 + i * 2.7, { col: dark });
      // the facade: wings with three speed lines, a stepped tower in the middle
      const fz = hd + 0.2;
      // the front wall, open at the doors
      b.box('wall', (W + 0.4) / 2 - 2.4, H + 0.7, 0.4, -((W + 0.4) / 4 + 1.2), y0, fz, { col: cream }); b.box('wall', (W + 0.4) / 2 - 2.4, H + 0.7, 0.4, (W + 0.4) / 4 + 1.2, y0, fz, { col: cream });
      b.box('wall', 4.8, H + 0.7 - 2.6, 0.4, 0, y0 + 2.6, fz, { col: cream });
      for (const sd of [-1, 1]) b.collider(sd * ((W + 0.4) / 4 + 1.2), fz, (W + 0.4) / 4 - 1.2, 0.25);
      for (let i = 0; i < 3; i++) for (const sd of [-1, 1]) b.box('paint', hw - 3.0, 0.1, 0.06, sd * (hw + 3.0) / 2 + sd * 0.1, y0 + H - 0.35 - i * 0.28, fz + 0.22, { col: band });
      b.box('wall', 5.4, H + 2.0 - 2.6, 0.7, 0, y0 + 2.6, fz + 0.15, { col: cream }); for (const sd of [-1, 1]) b.box('wall', 0.3, 2.6, 0.7, sd * 2.55, y0, fz + 0.15, { col: cream });
      b.box('wall', 4.2, 1.1, 0.75, 0, y0 + H + 2.0, fz + 0.15, { col: cream });
      b.box('wall', 2.8, 0.9, 0.8, 0, y0 + H + 3.1, fz + 0.15, { col: pink });
      b.box('wall', 1.4, 0.7, 0.8, 0, y0 + H + 4.0, fz + 0.15, { col: cream });
      b.cyl('paint', 0.04, 0.04, 2.4, 0, y0 + H + 4.7, fz + 0.15, { seg: 6, col: [0.3, 0.3, 0.3] });
      for (const fx of [-1.6, -0.55, 0.55, 1.6]) b.box('wall', 0.18, 3.1, 0.25, fx, y0 + 3.4, fz + 0.6, { col: pink });  // the fins
      for (const sd of [-1, 1]) b.box('paint', 0.1, H + 2.0, 0.08, sd * 2.72, y0, fz + 0.52, { col: band });
      b.sign(17, 4.2, 1.05, 0, y0 + H + 0.6, fz + 0.53);
      // the marquee over the doors, three doorways and the poster frames
      b.box('stone', 7.4, 0.24, 2.2, 0, y0 + 3.0, fz + 1.3, { col: [0.86, 0.84, 0.8] });
      b.box('paint', 7.44, 0.12, 0.06, 0, y0 + 3.06, fz + 2.4, { col: band });
      for (const sd of [-1, 1]) { b.cyl('paint', 0.07, 0.07, 3.0, sd * 3.4, y0, fz + 2.2, { seg: 8, col: [0.3, 0.3, 0.32] }); b.circle(sd * 3.4, fz + 2.2, 0.09); }
      b.box('paint', 4.6, 0.12, 0.08, 0, y0 + 2.45, fz + 0.52, { col: band });
      for (const sx of [-1, 1]) b.box('wood', 0.9, 2.4, 0.06, sx * 2.0, y0, fz - 0.05, { ry: sx * 0.9, col: [0.36, 0.22, 0.16] });
      for (let i = 0; i < 4; i++) {
        const px = (i < 2 ? -1 : 1) * (3.9 + (i % 2) * 1.85);
        b.box('wood', 1.66, 2.36, 0.08, px, y0 + 0.62, fz + 0.24, { col: [0.3, 0.2, 0.14] });
        b.decal('poster', i, 4, 1, 1.5, 2.2, px, y0 + 0.7, fz + 0.29);
      }
      b.box('wall', 1.6, 2.6, 1.4, hw + 1.1, y0, hd - 0.6, { col: cream });                         // the ticket booth
      b.box('stone', 2.0, 0.14, 1.8, hw + 1.1, y0 + 2.6, hd - 0.5, { col: [0.86, 0.84, 0.8] });
      b.box('paint', 0.03, 0.4, 0.6, hw + 1.92, y0 + 1.1, hd - 0.6, { col: dark });
      b.collider(hw + 1.1, hd - 0.6, 0.8, 0.7);
      b.lamp(-2.2, y0 + 2.9, fz + 1.6, 1.4, 1); b.lamp(2.2, y0 + 2.9, fz + 1.6, 1.4, 0);
      b.yard(13, 0.7).clear(14).mark(W + 3, D + 4);
      SPOTS.cinema = b.world(0, 0, fz + 3.6);
    }
  }

  // ---- the ration shop: rice, kerosene and sugar against the card
  {
    const s = at('rationShop', 16, 10, 4.2, { gap: 1.2, far: 5 });
    if (s) {
      const sh = shop(b, s.x, s.z, s.ry, 'provisions', 18, rng, { w: 6.2 });
      for (let i = 0; i < 6; i++) b.sphere('sack', 0.32, -2.2 + (i % 3) * 0.55, 0.78 + Math.floor(i / 3) * 0.36, 1.6, { sx: 1.2, sy: 0.75, sz: 0.9 });
      b.cyl('paint', 0.22, 0.22, 0.7, 2.2, 0.5, 1.7, { seg: 10, col: [0.3, 0.32, 0.3] });                  // the kerosene drum
      SPOTS.rationShop = sh;
    }
  }

  // ---- the party offices, the panchayat and the reading room
  const office = (name, ax, az, sign, o) => {
    const s = at(name, ax, az, 6.4, { gap: 1.5, far: 8 });
    if (!s) return null;
    const w = o.w || 6.4, d = o.d || 5, hw = w / 2, hd = d / 2;
    office57(b, s.x, s.z, s.ry, w, d, { ...o, sign });
    if (o.flag) flag(b, hw + 1.0, hd + 3.4, o.flag);
    if (o.slogan != null) b.decal('slogan', o.slogan, 2, 1, 3.0, 1.5, hw + 0.135, 1.75, 0, Math.PI / 2);
    if (o.slogan != null) b.decal('slogan', o.slogan, 2, 1, 3.0, 1.5, -hw - 0.135, 1.75, 0, -Math.PI / 2);
    SPOTS[name] = b.world(0, 0, hd + 4.2);
    return s;
  };
  office('cpiOffice', 10, 16, 19, { flag: 'red', slogan: 0, col: [0.95, 0.9, 0.82], trim: [0.62, 0.12, 0.1], plaque: 1 });
  office('congressOffice', -58, 6, 20, { flag: 'tricolour', slogan: 1, col: [0.98, 0.96, 0.92], trim: [0.2, 0.45, 0.25], plaque: 0 });
  office('panchayat', -12, -12, 21, { w: 9, d: 6, storeys: 2, plaque: 2, flag: 'tricolour', col: [0.96, 0.93, 0.84], trim: [0.42, 0.42, 0.4] });
  {
    const s = office('readingRoom', 28, -18, 22, { w: 6, d: 4.6, col: [0.84, 0.9, 0.78], plaque: 4 });
    if (s) {               // the morning papers on a bench out front
      b.box('plank', 2.6, 0.08, 0.45, 0, 0.6 + 0.42, 3.0, { tile: 1 }); for (const px of [-1.1, 1.1]) b.box('plank', 0.08, 0.42, 0.4, px, 0.6, 3.0, { tile: 1 });
      for (let i = 0; i < 3; i++) b.box('paint', 0.42, 0.012, 0.3, -0.7 + i * 0.6, 0.6 + 0.51, 3.0, { ry: (i - 1) * 0.2, col: [0.92, 0.9, 0.84] });
    }
  }

  // ---- election season: red-and-tricolour bunting across the bazaar on bamboo poles
  {
    const A = [-40, 10], B = [20, 0], L = Math.hypot(B[0] - A[0], B[1] - A[1]), D = [(B[0] - A[0]) / L, (B[1] - A[1]) / L], N = [-D[1], D[0]];
    const along = (s, off) => [A[0] + D[0] * s + N[0] * off, A[1] + D[1] * s + N[1] * off];
    const tri = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([-0.13, 0, 0, 0.13, 0, 0, 0, -0.3, 0], 3)).setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3)).setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 0.5, 0], 2));
    tri.setIndex([0, 1, 2]);
    const COLS = [[0.75, 0.06, 0.05], [0.96, 0.94, 0.9], [0.75, 0.06, 0.05], [1.0, 0.55, 0.2], [0.75, 0.06, 0.05], [0.1, 0.45, 0.18]];
    for (let s = 6; s <= 54; s += 12) {
      const p1 = along(s, 5.3), p2 = along(s + 1.2, -5.3);
      if (pointInBox(p1[0], p1[1], 0.3) || pointInBox(p2[0], p2[1], 0.3)) continue;
      const y1 = getHeight(p1[0], p1[1]) + 4.2, y2 = getHeight(p2[0], p2[1]) + 4.2;
      for (const [p, y] of [[p1, y1], [p2, y2]]) { b.place(p[0], p[1], 0); b.cyl('wood', 0.045, 0.06, y - getHeight(p[0], p[1]) + 0.3, 0, 0, 0, { seg: 6, col: [0.8, 0.72, 0.5] }); b.circle(0, 0, 0.08); }
      b.place(0, 0, 0, 0);
      const n = 26, ry = Math.atan2(p2[0] - p1[0], p2[1] - p1[1]) - Math.PI / 2;
      for (let k = 1; k < n; k++) {
        const t = k / n, x = p1[0] + (p2[0] - p1[0]) * t, z = p1[1] + (p2[1] - p1[1]) * t, y = y1 + (y2 - y1) * t - Math.sin(t * Math.PI) * 0.7;
        b.geo('paint', tri, new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z), COLS[k % COLS.length]);
        const tr = tri.clone(); b.geo('paint', tr.rotateY(Math.PI), new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z), COLS[k % COLS.length]);
      }
    }
  }

  // ---- electricity: poles every 32 m along the village roads and the port road, wires between them
  {
    const wires = [];
    const RUNS = { main: [-160, 75], laneE: null, laneS: null, laneW: null, home: null, ptMain: null, ptCross: null, ptEast: null, ptNorth: null, south: null, hill: [-120, 160] };
    for (const key in RUNS) {
      const pts = ROADS[key]; if (!pts) continue;
      const lim = RUNS[key], half = ROAD_HALF[key] ?? 2;
      let next = 6, run = 0, prev = null, n = 0;          // distance along the road to the next pole
      for (let i = 0; i < pts.length - 1; i++) {
        const ax = pts[i][0], az = pts[i][1], bx = pts[i + 1][0], bz = pts[i + 1][1], seg = Math.hypot(bx - ax, bz - az);
        if (seg < 1e-3) continue;
        const tx = (bx - ax) / seg, tz = (bz - az) / seg;
        while (next <= run + seg) {
          const s = next - run, px = ax + tx * s, pz = az + tz * s;
          next += 32;
          if (lim && (px < lim[0] || px > lim[1])) { prev = null; continue; }
          const ox = tz * (half + 1.4), oz = -tx * (half + 1.4), x = px + ox, z = pz + oz;
          if (getHeight(x, z) < 0.5 || pointInBox(x, z, 0.5)) { prev = null; continue; }
          const ry = Math.atan2(tx, tz);
          b.place(x, z, ry);
          b.cyl('wood', 0.1, 0.13, 7.2, 0, 0, 0, { seg: 7, col: [0.55, 0.45, 0.36] });
          b.box('wood', 1.7, 0.1, 0.1, 0, 6.55, 0, { col: [0.5, 0.4, 0.32] });
          const tops = [-0.7, 0, 0.7].map((lx) => { b.cyl('paint', 0.04, 0.05, 0.12, lx, 6.65, 0, { seg: 6, col: [0.92, 0.9, 0.86] }); return b.world(lx, 6.78, 0); });
          if (n++ % 3 === 1) { b.box('paint', 0.06, 0.06, 1.1, 0, 5.4, -0.55, { col: [0.25, 0.28, 0.3] }); b.box('paint', 0.18, 0.12, 0.18, 0, 5.3, -1.1, { col: [0.95, 0.88, 0.6] }); b.lamp(0, 5.25, -1.1, 1.0, n % 6 === 2 ? 1 : 0); }
          b.circle(0, 0, 0.16);
          if (prev && Math.hypot(prev[1].x - tops[1].x, prev[1].z - tops[1].z) < 48) for (let w = 0; w < 3; w++) wires.push([prev[w], tops[w]]);
          prev = tops;
        }
        run += seg;
      }
    }
    // each span hangs in a shallow curve, a thin dark cable
    const cable = new THREE.CylinderGeometry(0.018, 0.018, 1, 4, 1, true).rotateX(Math.PI / 2);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 1), dir = new THREE.Vector3(), mid = new THREE.Vector3();
    const p0 = new THREE.Vector3(), p1 = new THREE.Vector3();
    for (const [a, c] of wires) {
      const sag = 0.35 + a.distanceTo(c) * 0.008;
      b.place((a.x + c.x) / 2, (a.z + c.z) / 2, 0, 0);
      p0.copy(a);
      for (let k = 1; k <= 8; k++) {
        const t = k / 8;
        p1.set(a.x + (c.x - a.x) * t, a.y + (c.y - a.y) * t - Math.sin(t * Math.PI) * sag, a.z + (c.z - a.z) * t);
        dir.subVectors(p1, p0); const len = dir.length(); dir.divideScalar(len);
        q.setFromUnitVectors(Z, dir); mid.addVectors(p0, p1).multiplyScalar(0.5);
        m4.compose(mid.set(mid.x - b.ox, mid.y, mid.z - b.oz), q, sc.set(1, 1, len + 0.02));
        b.geo('paint', cable, m4, [0.09, 0.08, 0.07]);
        p0.copy(p1);
      }
    }
  }
  SPOTS.era57 = placed;
  return placed;
}
