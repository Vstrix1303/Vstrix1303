// Analytic description of the land: a strip of Travancore between the
// Arabian sea (west), a great backwater lake (kayal), paddy lowlands and
// the foothills of the Western Ghats (east).
import { fbm, ridged, smoothstep, lerp, clamp, polyDist, smoothPath } from './util.js';

export const WORLD = 1600;
export const HALF = WORLD / 2;
export const GRID = 384;
export const CELL = WORLD / GRID;
export const N = GRID + 1;
export const PLAY_LIMIT = 745;

export const LOC = {
  village: { x: -20, z: 5 },
  home: { x: 58, z: 50 },
  temple: { x: -112, z: -92 },
  tank: { x: -114, z: -140 },
  pepper: { x: 196, z: -100 },
  port: { x: -410, z: -362 },
  godown: { x: -478, z: -372 },
  stable: { x: -520, z: -350 },
  cutcherry: { x: 500, z: -334 },
  island: { x: -350, z: -60 },
  lotus: { x: 176, z: 190 },
  estate: { x: 372, z: -128 },
  lighthouse: { x: -668, z: -14 },
  hamlet: { x: -654, z: 152 },
  fort: { x: -352, z: 434 },
  falls: { x: 204, z: 190 },
  toddy: { x: 62, z: 172 },
  kavu: { x: 268, z: 36 },
  hamletJetty: { x: -590, z: 150 },   // refined at init
  villageJetty: { x: -200, z: 40 },   // refined at init
  portJetty: { x: -400, z: -310 },    // refined at init
};

const CANAL_RAW = [];
for (let x = -250; x <= 176; x += 14) CANAL_RAW.push([x, 190 + 16 * Math.sin(x * 0.018)]);
export const CANAL = CANAL_RAW;
export const canalZ = (x) => 190 + 16 * Math.sin(x * 0.018);

function hills(x, z) {
  let h = 2.4 + (fbm(x * 0.006, z * 0.006, 4, 1) - 0.5) * 3.0;
  const wob = (fbm(x * 0.0025, z * 0.0025, 3, 5) - 0.5) * 240;
  const e = smoothstep(130, 760, x + wob);
  if (e > 0) {
    h += e * 120 * (0.55 + 0.9 * fbm(x * 0.0042, z * 0.0042, 5, 9));
    h += e * ridged(x * 0.011, z * 0.011, 3, 3) * 22;
  }
  if (x > 720) h += smoothstep(720, 1700, x) * 240 * (0.5 + fbm(x * 0.0015, z * 0.0015, 3, 40));
  const az = Math.abs(z);
  if (az > 850) h += smoothstep(850, 1800, az) * 70 * fbm(x * 0.002, z * 0.002, 3, 41);
  return h;
}

const cutH = hills(LOC.cutcherry.x, LOC.cutcherry.z);
const estH = hills(LOC.estate.x, LOC.estate.z);

export function heightFn(x, z) {
  let h = hills(x, z);
  let d;
  // village core: gently levelled
  d = Math.hypot(x - 0, z - 5);
  if (d < 190) h = lerp(h, 2.6, 0.75 * smoothstep(190, 100, d));
  // port town
  d = Math.hypot((x + 440) / 1.6, z + 362);
  if (d < 110) h = lerp(h, 2.3, smoothstep(110, 60, d));
  // cutcherry plateau
  d = Math.hypot(x - LOC.cutcherry.x, z - LOC.cutcherry.z);
  if (d < 85) h = lerp(h, cutH, smoothstep(85, 44, d));
  // tea-estate terrace
  d = Math.hypot(x - LOC.estate.x, z - LOC.estate.z);
  if (d < 74) h = lerp(h, estH, smoothstep(74, 40, d));
  // rock shelf above the lotus pond (the falls)
  d = Math.hypot(x - 206, z - 190);
  if (d < 28) h += 9 * smoothstep(28, 9, d);
  // paddy fields
  if (z > 215 && z < 520 && x > -200 && x < 210) {
    const px = smoothstep(-190, -172, x) * smoothstep(200, 182, x);
    const pz = smoothstep(224, 238, z) * smoothstep(510, 492, z);
    h = lerp(h, 0.42, px * pz);
  }
  // canal
  if (z > 150 && z < 232 && x > -270 && x < 195) {
    d = polyDist(x, z, CANAL);
    if (d < 13) h = lerp(h, -1.7, smoothstep(12.5, 5, d));
  }
  // lotus pond
  d = Math.hypot(x - LOC.lotus.x, z - LOC.lotus.z);
  if (d < 22) h = lerp(h, -1.8, smoothstep(21, 12, d));
  // temple tank
  d = Math.max(Math.abs(x - LOC.tank.x), Math.abs(z - LOC.tank.z));
  if (d < 15) h = lerp(h, -1.7, smoothstep(14.5, 9.5, d));
  // the kayal
  const dn = Math.hypot((x + 400) / 200, (z - 40) / 340) + (fbm(x * 0.008, z * 0.008, 3, 21) - 0.5) * 0.14;
  if (dn < 1.12) {
    const lake = smoothstep(1.1, 0.86, dn);
    h = lerp(h, -5.5 - 1.5 * fbm(x * 0.02, z * 0.02, 2, 22), lake);
  }
  // island
  d = Math.hypot(x - LOC.island.x, z - LOC.island.z);
  if (d < 46) h += 9 * smoothstep(46, 8, d);
  // the bar: a tidal channel cutting the sand-spit between kayal and sea
  if (x < -560) {
    const dz = Math.abs(z - 40);
    if (dz < 26) h = lerp(h, -3.2, smoothstep(25, 10, dz) * smoothstep(-560, -588, x));
  }
  // the sea
  if (x < -640) {
    const sea = smoothstep(-690, -780, x + (fbm(z * 0.006, 0.5, 2, 30) - 0.5) * 40);
    h = lerp(h, -9, sea);
  }
  return h;
}

// ---- sampled grid -------------------------------------------------------
export const heights = new Float32Array(N * N);

export function initHeights() {
  for (let iz = 0; iz < N; iz++) {
    const z = -HALF + iz * CELL;
    for (let ix = 0; ix < N; ix++) {
      heights[iz * N + ix] = heightFn(-HALF + ix * CELL, z);
    }
  }
  // refine the jetties: march to the waterline
  let x = -150;
  while (getHeight(x, 40) > -0.9 && x > -300) x -= 0.5;
  LOC.villageJetty.x = x + 9;
  let z = -360;
  while (getHeight(-400, z) > -0.9 && z < -250) z += 0.5;
  LOC.portJetty.z = z - 9;
  x = -650;
  while (getHeight(x, 150) > -0.9 && x < -540) x += 0.5;
  LOC.hamletJetty.x = x - 9;
}

// Exact height of the rendered triangle mesh at (x,z)
export function getHeight(x, z) {
  const gx = (x + HALF) / CELL, gz = (z + HALF) / CELL;
  if (gx < 0 || gz < 0 || gx >= GRID || gz >= GRID) return heightFn(x, z);
  const ix = Math.floor(gx), iz = Math.floor(gz);
  const fx = gx - ix, fz = gz - iz;
  const i = iz * N + ix;
  const ha = heights[i], hd = heights[i + 1], hb = heights[i + N], hc = heights[i + N + 1];
  if (fx + fz <= 1) return ha + (hd - ha) * fx + (hb - ha) * fz;
  return hc + (hb - hc) * (1 - fx) + (hd - hc) * (1 - fz);
}

export function getSlope(x, z) {
  const e = 2;
  const dx = getHeight(x + e, z) - getHeight(x - e, z);
  const dz = getHeight(x, z + e) - getHeight(x, z - e);
  return Math.hypot(dx, dz) / (2 * e);
}

// ---- roads ---------------------------------------------------------------
export const ROADS = {};
export function initRoads() {
  const jx = LOC.villageJetty.x, pz = LOC.portJetty.z;
  const raw = {
    main: [[jx + 6, 40], [-150, 34], [-95, 22], [-40, 10], [20, 0], [70, -12], [120, -45], [160, -78], [196, -98]],
    home: [[38, -4], [50, 10], [58, 24]],
    north: [[-40, 10], [-52, -45], [-62, -110], [-85, -185], [-110, -250], [-170, -330], [-250, -385], [-330, -394], [-400, -382], [-470, -384], [-530, -372]],
    hill: [[-110, -250], [-40, -272], [50, -268], [140, -290], [230, -312], [320, -335], [400, -318], [455, -306], [500, -304]],
    south: [[-40, 10], [-34, 80], [-30, 150], [-30, 190], [-30, 232], [-32, 330], [-30, 480]],
    quay: [[-400, -382], [-400, pz - 6]],
    temple: [[-58, -92], [-96, -92]],
    bar: [[-530, -372], [-585, -340], [-640, -250], [-662, -120], [-668, -34]],
    coast: [[-30, 480], [-150, 502], [-300, 474], [-420, 454], [-540, 412], [-622, 300], [-650, 176]],
    estate: [[320, -335], [345, -270], [362, -205], [370, -160]],
    towpath: [[-30, 160], [30, 168], [62, 180], [120, 176], [170, 168]],
    hamlet: [[-650, 176], [-640, 152], [LOC.hamletJetty.x - 4, 150]],
  };
  for (const k in raw) ROADS[k] = smoothPath(raw[k], 5);
}

export function roadDist(x, z) {
  let best = Infinity;
  for (const k in ROADS) {
    const d = polyDist(x, z, ROADS[k]);
    if (d < best) best = d;
  }
  return best;
}

export { clamp };
