// The towns: Puthenthura grown into a proper port town, a west bazaar for Thekkumkara, and three small towns
// on the new roads (Kavalam, Mukkadu, Chettuva). Each street in TOWNS is lined with two-storey shophouses or
// houses, set back from the road and facing it, skipping anywhere already built on, wet, or too steep; the
// bigger towns get offices at the crossroads.
import { ROADS, TOWNS, getHeight, roadDist } from './heightfield.js';
import { ROAD_W } from './terrain.js';
import { pointInBox } from './physics.js';
import { house } from './houses.js';
import { shop } from './village.js';
import { office57 } from './era57.js';

// along a road's smoothed polyline: position and heading at s metres
function along(pts, s) {
  let run = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (run + l >= s) { const t = (s - run) / (l || 1); return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, tx: (b[0] - a[0]) / (l || 1), tz: (b[1] - a[1]) / (l || 1) }; }
    run += l;
  }
  const a = pts[pts.length - 2], b = pts[pts.length - 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return { x: b[0], z: b[1], tx: (b[0] - a[0]) / l, tz: (b[1] - a[1]) / l };
}
const KINDS = [['provisions', 8], ['cloth', 9], ['vessels', 10], ['vaidyasala', 11], ['anchal', 12], ['pottery', 13], ['provisions', 18]];

export function buildTowns(b, rng, SPOTS) {
  const taken = [];                          // footprints placed here, so towns do not overlap themselves
  const free = (x, z, r) => {
    if (pointInBox(x, z, r)) return false;
    for (const t of taken) if (Math.hypot(t[0] - x, t[1] - z) < t[2] + r) return false;
    const h = getHeight(x, z); if (h < 0.35) return false;
    for (const [dx, dz] of [[r, 0], [-r, 0], [0, r], [0, -r]]) if (Math.abs(getHeight(x + dx, z + dz) - h) > 1.4 || getHeight(x + dx, z + dz) < 0.2) return false;
    return true;
  };
  SPOTS.towns = {};
  for (const T of TOWNS) {
    const placed = { shops: [], houses: 0 };
    for (const [key, s0, s1, lining] of T.streets) {
      const pts = ROADS[key]; if (!pts) continue;
      const half = (ROAD_W[key] || 4) / 2;
      const shopsHere = lining === 'shops';
      for (const side of [-1, 1]) {
        let s = s0 + (side > 0 ? 3 : 0);
        while (s < s1) {
          const w = shopsHere ? 6 + (rng() * 1.4 | 0) * 0.6 : 6 + rng() * 2, d = shopsHere ? 5.2 : 5 + rng(), step = w + (shopsHere ? 1.6 + rng() * 1.2 : 5 + rng() * 6);
          const p = along(pts, s + w / 2), nx = p.tz * side, nz = -p.tx * side;
          const off = half + d / 2 + (shopsHere ? 3.0 : 4.5 + rng() * 2);
          const x = p.x + nx * off, z = p.z + nz * off, r = Math.max(w, d) / 2 + 0.6;
          // facing the road; clear of every other road
          if (free(x, z, r) && roadDist(x, z) > Math.min(w, d) / 2 + 1.2) {
            const ry = Math.atan2(-nx, -nz);
            if (shopsHere) {
              const [kind, sign] = KINDS[(rng() * KINDS.length) | 0];
              placed.shops.push({ ...shop(b, x, z, ry, kind, sign, rng, { w }), town: T.id, ti: placed.shops.length });
            } else {
              house(b, x, z, ry, rng() < 0.3 ? { w, d, roof: 'thatch', wall: 'laterite', fence: false } : { w, d, fence: rng() < 0.5, lamp: rng() < 0.4 ? 1 : 0 });
              placed.houses++;
            }
            taken.push([x, z, r]);
          }
          s += step;
        }
      }
    }
    // offices at the town's heart: the panchayat, the party rooms
    const signs = [[21, { flag: 'tricolour' }], [19, { flag: 'red', col: [0.95, 0.9, 0.82], trim: [0.62, 0.12, 0.1] }], [20, { flag: 'tricolour', trim: [0.2, 0.45, 0.25] }]];
    for (let i = 0; i < T.offices; i++) {
      for (let k = 0; k < 30; k++) {
        const a = rng() * Math.PI * 2, rr = 10 + rng() * 26, x = T.at[0] + Math.cos(a) * rr, z = T.at[1] + Math.sin(a) * rr;
        if (!free(x, z, 6) || roadDist(x, z) < 6 || roadDist(x, z) > 16) continue;
        // face the nearest road
        let best = null, bd = 1e9;
        for (const key in ROADS) for (const q of ROADS[key]) { const dd = Math.hypot(q[0] - x, q[1] - z); if (dd < bd) { bd = dd; best = q; } }
        const ry = Math.atan2(best[0] - x, best[1] - z);
        const [sign, o] = signs[i % signs.length];
        office57(b, x, z, ry, 6.4, 5, { ...o, sign });
        taken.push([x, z, 6]);
        break;
      }
    }
    SPOTS.shops.push(...placed.shops);
    SPOTS.towns[T.id] = { ...placed, name: T.name, at: T.at };
  }
  return SPOTS.towns;
}
