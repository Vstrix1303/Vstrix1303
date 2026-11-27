// Thekkumkara in 1957: what the village gained in fifty years. Electric poles and wires along the
// roads, a bus stand, a tent cinema with its posters, a ration shop, a reading room, the panchayat
// office, and — it being election season — the party offices with their flags, bunting across the
// bazaar and slogans on the walls.
// Everything here is placed after the rest of the world is built: each building searches outward
// from where it would like to stand for dry, level, unbuilt ground beside a road, and faces it.
import * as THREE from 'three';
import { getHeight, ROADS } from './heightfield.js';
import { pointInBox } from './physics.js';
import { house, P } from './houses.js';
import { shop } from './village.js';

const TAU = Math.PI * 2;
const ROAD_HALF = { main: 3, north: 2.3, hill: 2.1, south: 1.6, home: 1.5, quay: 3, temple: 2, laneE: 1.4, laneS: 1.4, laneW: 1.3, coast: 1.5, bar: 1.5, estate: 1.7, towpath: 1.2, hamlet: 1.5 };

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

  // ---- Lakshmi Talkies: a big tent cinema, tin roof over bamboo walls, posters across its front
  {
    const s = at('cinema', -66, 32, 8.5, { gap: 2.5, far: 9 });
    if (s) {
      const W = 15, D = 10, hw = W / 2, hd = D / 2;
      b.place(s.x, s.z, s.ry);
      b.box('laterite', W + 0.6, 1.4, D + 0.6, 0, -0.9, 0); b.platform(0, 0, hw + 0.3, hd + 0.3, 0.5);
      b.box('thatch', W, 3.0, D, 0, 0.5, 0, { col: [0.85, 0.75, 0.55] });
      for (const sd of [-1, 1]) b.box('tin', W + 1.2, 0.06, hd + 1.1, 0, 3.5 + 0.95, sd * (hd + 1.1) / 2, { rx: sd * 0.36, col: [0.62, 0.6, 0.56] });
      b.box('wall', W + 0.2, 2.2, 0.25, 0, 2.6, hd + 0.12, { col: [0.96, 0.92, 0.8] });            // the painted front board
      b.sign(17, 4.2, 1.05, 0, 4.2, hd + 0.27);
      for (let i = 0; i < 4; i++) b.decal('poster', i, 4, 1, 1.5, 3.0, -5.4 + i * 3.6, 2.1, hd + 0.27);
      b.box('paint', 2.0, 2.3, 0.05, 0, 0.5, hd + 0.26, { col: [0.06, 0.05, 0.05] });                 // the doorway
      b.box('plank', 1.4, 2.4, 1.2, hw - 1.2, 0.5, hd + 1.2, { tile: 1, col: [0.6, 0.45, 0.32] });        // ticket booth
      b.box('paint', 0.6, 0.35, 0.03, hw - 1.2, 1.7, hd + 1.82, { col: [0.06, 0.05, 0.05] });
      b.collider(0, 0, hw + 0.3, hd + 0.3); b.collider(hw - 1.2, hd + 1.2, 0.7, 0.6);
      b.lamp(-hw + 1, 3.2, hd + 0.6, 1.4, 1); b.lamp(hw - 1, 3.2, hd + 0.6, 1.4, 0);
      b.yard(12, 0.7).clear(13).mark(W + 2, D + 2);
      SPOTS.cinema = b.world(0, 0, hd + 3);
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
    const s = at(name, ax, az, 4.6, { gap: 1.5, far: 7 });
    if (!s) return null;
    const w = o.w || 6.4, d = o.d || 5, hw = w / 2, hd = d / 2;
    house(b, s.x, s.z, s.ry, { w, d, porch: !!o.porch, fence: false, washing: false, smoke: false, lamp: 1, mural: false, roof: o.roof || 'roof', col: o.col });
    b.sign(sign, 2.4, 0.6, 0, 0.5 + 2.33 + 0.31, hd + 0.135);
    if (o.flag) flag(b, hw + 0.8, hd + 2.6, o.flag);
    if (o.slogan != null) b.decal('slogan', o.slogan, 2, 1, 3.0, 1.5, hw + 0.135, 1.75, 0, Math.PI / 2);
    if (o.slogan != null) b.decal('slogan', o.slogan, 2, 1, 3.0, 1.5, -hw - 0.135, 1.75, 0, -Math.PI / 2);
    SPOTS[name] = b.world(0, 0, hd + 2.2);
    return s;
  };
  office('cpiOffice', 10, 16, 19, { flag: 'red', slogan: 0, col: [0.95, 0.9, 0.82] });
  office('congressOffice', -58, 6, 20, { flag: 'tricolour', slogan: 1 });
  office('panchayat', -12, -12, 21, { w: 8, d: 6, porch: true, flag: 'tricolour' });
  {
    const s = office('readingRoom', 28, -18, 22, { w: 6, d: 4.6, roof: 'thatch' });
    if (s) {               // the morning papers on a bench out front
      b.box('plank', 2.6, 0.08, 0.45, 0, 0.5 + 0.42, 2.3 + 0.8, { tile: 1 }); for (const px of [-1.1, 1.1]) b.box('plank', 0.08, 0.42, 0.4, px, 0.5, 3.1, { tile: 1 });
      for (let i = 0; i < 3; i++) b.box('paint', 0.42, 0.012, 0.3, -0.7 + i * 0.6, 0.5 + 0.51, 3.1, { ry: (i - 1) * 0.2, col: [0.92, 0.9, 0.84] });
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
    const RUNS = { main: [-160, 75], laneE: null, laneS: null, laneW: null, home: null };
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
