// Every settlement and landmark on the Vaikara map, generated from the
// layout: Vaikara Town and its bazaar, the ghat and the stone bridge, the
// church, mosque and gopuram temple, the District Court and the Residency,
// fishing villages, two lighthouses, the abandoned fort, the tea estate,
// ferries, salt pans and the railway to Karimulam.
import * as THREE from 'three/webgpu';
import { vec3, float, sin, cos, uniform, smoothstep, positionLocal, uv, vec4, mix } from 'three/tsl';
import { G, U } from '../../state.js';
import { Kit, materials } from './kit.js';
import { getHeight, getSlope, nearestRoad, getBiome, W } from '../../world/data.js';
import { placeById as P, toWorld, PLACES } from '../../world/layout.js';
import { makeRng } from '../../world/noise.js';

const TAU = Math.PI * 2;

export class Settlements {
  constructor(scene) {
    this.scene = scene;
    this.kit = new Kit();
    this.rnd = makeRng(1905);
    this.beams = [];
    this.lamps = [];
    this.jetties = []; // used by props for boats
    this.counts = { shop: 0, house: 0, hut: 0 };
    this.gardens = [];
    this.shopFronts = []; this.shoreSpots = []; this.namedJetty = {}; this.ferries = [];
  }

  // ── helpers
  footY(x, z, w, d, ry) {
    const c = Math.cos(ry), s = Math.sin(ry);
    let mx = -Infinity, mn = Infinity;
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]]) {
      const ox = a * w / 2, oz = b * d / 2;
      const h = getHeight(x + ox * c + oz * s, z - ox * s + oz * c);
      mx = Math.max(mx, h); mn = Math.min(mn, h);
    }
    return { y: mx, drop: mx - mn };
  }
  free(x, z, r) { return !G.colliders.blocked(x, z, r); }
  faceRoad(x, z) { const r = nearestRoad(x, z); return r.seg ? Math.atan2(r.px - x, r.pz - z) : this.rnd() * TAU; }
  findLand(x, z, minH = 1, maxR = 400) {
    for (let r = 0; r <= maxR; r += 6) for (let a = 0; a < TAU; a += Math.max(0.2, 6 / Math.max(r, 1))) {
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (getHeight(px, pz) > minH && getSlope(px, pz) < 0.2) return [px, pz];
    }
    return [x, z];
  }
  collide(x, z, w, d, ry, y, h = 8) { G.colliders.addBox(x, z, w / 2, d / 2, ry, y - 2, y + h); }

  // ── building types (local +z = front)
  house(x, z, ry, o = {}) {
    const k = this.kit, r = this.rnd;
    const ownWash = !k.tints; if (ownWash) k.wash(r);
    const w = o.w || 7 + r() * 3.5, d = o.d || 5.5 + r() * 2;
    const { y } = this.footY(x, z, w + 2, d + 3, ry);
    const ph = 0.6;
    k.lbox('laterite', x, z, ry, 0, y - 2.5, 0.6, w + 1.2, 2.5 + ph, d + 2.6);
    const wallMat = o.wall || (r() < 0.75 ? 'plaster' : r() < 0.5 ? 'laterite' : 'yplaster');
    const wh = o.h || 3.0;
    k.lbox(wallMat, x, z, ry, 0, y + ph, 0, w, wh, d);
    // door and windows on the front
    k.lbox('wood', x, z, ry, 0, y + ph, d / 2 + 0.02, 1.4, 2.35, 0.1);
    k.lbox('wood', x, z, ry, 0, y + ph + 2.35, d / 2 + 0.05, 1.8, 0.18, 0.16);
    for (const sx of [-1, 1]) {
      const wx = sx * w * 0.3;
      k.lbox('window', x, z, ry, wx, y + ph + 0.85, d / 2 + 0.03, 1.25, 1.35, 0.06);
      k.lbox('wood', x, z, ry, wx, y + ph + 0.78, d / 2 + 0.06, 1.5, 0.12, 0.16);
      k.lbox('wood', x, z, ry, wx, y + ph + 2.2, d / 2 + 0.06, 1.5, 0.12, 0.16);
      for (const bx of [-0.36, 0, 0.36]) k.lbox('wood', x, z, ry, wx + bx, y + ph + 0.85, d / 2 + 0.07, 0.06, 1.35, 0.06);
    }
    // veranda half wall (thinna) with a gap for the steps
    for (const sx of [-1, 1]) k.lbox('laterite', x, z, ry, sx * (w / 4 + 0.55), y + ph, d / 2 + 1.6, w / 2 - 1.1, 0.55, 0.32);
    k.lbox('sandstone', x, z, ry, 0, y, d / 2 + 2.15, 1.8, ph - 0.25, 0.7);
    // veranda posts
    const n = Math.max(2, Math.round(w / 2.2));
    for (let i = 0; i <= n; i++) {
      const ox = -w / 2 + (w / n) * i, c = Math.cos(ry), s = Math.sin(ry);
      k.cyl('wood', x + ox * c + (d / 2 + 1.6) * s, y + ph, z - ox * s + (d / 2 + 1.6) * c, 0.11, 0.09, wh + 0.2, 7);
    }
    k.roof(o.roofMat || 'roof', x + Math.sin(ry) * 0.8, y + ph + wh + 0.1, z + Math.cos(ry) * 0.8, w + 0.6, d + 2.2, ry, { over: 1.1, pitch: 0.95 });
    this.collide(x, z, w, d, ry, y);
    G.colliders.addDeck(x + Math.sin(ry) * 0.6, z + Math.cos(ry) * 0.6, (w + 1.2) / 2, (d + 2.6) / 2, ry, y + ph);
    if (ownWash) k.unwash();
    return y;
  }

  hut(x, z, ry, o = {}) {
    const k = this.kit, r = this.rnd;
    k.wash(r);
    const w = 4 + r() * 1.6, d = 3.4 + r() * 0.8;
    const { y } = this.footY(x, z, w, d, ry);
    k.lbox('mud', x, z, ry, 0, y - 1.5, 0, w + 0.4, 1.8, d + 0.4);
    k.lbox('mud', x, z, ry, 0, y + 0.3, 0, w, 2.0, d);
    k.lbox('wood', x, z, ry, 0, y + 0.3, d / 2 + 0.02, 0.9, 1.7, 0.08);
    k.roof(o.roofMat || 'thatch', x, y + 2.3, z, w, d, ry, { over: 0.8, pitch: 1.05, gable: 0.8, flare: 0.1 });
    this.collide(x, z, w, d, ry, y, 4);
    k.unwash();
    return y;
  }

  shophouse(x, z, ry, w, o = {}) {
    const k = this.kit, r = this.rnd;
    const d = o.d || 9 + r() * 3;
    const floors = o.floors || 2;
    const y = o.y ?? this.footY(x, z, w, d, ry).y;
    const wall = o.wall || (r() < 0.6 ? 'plaster' : r() < 0.5 ? 'yplaster' : 'laterite');
    k.lbox('laterite', x, z, ry, 0, y - 2.5, 0.4, w + 0.2, 2.8, d + 0.8);
    // ground floor: back and sides closed, front open shop with dark interior and shutters
    k.lbox(wall, x, z, ry, 0, y + 0.3, -0.5, w, 3.4, d - 1);
    k.lbox('window', x, z, ry, 0, y + 0.3, d / 2 - 0.98, w - 1, 2.6, 0.05);
    for (const sx of [-1, 1]) k.lbox('wood', x, z, ry, sx * (w / 2 - 0.15), y + 0.3, d / 2 - 0.4, 0.3, 3.4, 0.3);
    // awning cloth
    const cloth = ['cloth', 'redcloth', 'bluecloth', 'cloth'][Math.floor(r() * 4)];
    const c = Math.cos(ry), s = Math.sin(ry);
    {
      const g = new THREE.PlaneGeometry(w - 0.2, 2.2);
      g.rotateX(-Math.PI / 2 + 0.35);
      this.kit.push(cloth, g, x + (d / 2 + 0.6) * s, y + 3.0, z + (d / 2 + 0.6) * c, ry);
      for (const sx of [-1, 1]) k.cyl('wood', x + sx * (w / 2 - 0.3) * c + (d / 2 + 1.6) * s, y + 0.3, z - sx * (w / 2 - 0.3) * s + (d / 2 + 1.6) * c, 0.06, 0.05, 2.5, 5);
    }
    if (floors < 2) {
      if (o.roof !== false) k.roof(o.roofMat || 'roof', x + s * 0.4, y + 3.75, z + c * 0.4, w + 0.4, d + 0.8, ry, { over: 0.9, pitch: 0.8 });
      this.collide(x, z, w, d, ry, y, 7);
      return y;
    }
    // upper floor with wooden balcony
    k.lbox(wall, x, z, ry, 0, y + 3.7, -0.3, w, 3.0, d - 0.6);
    k.lbox('planks', x, z, ry, 0, y + 3.7, d / 2 + 0.3, w, 0.18, 1.6);
    k.lbox('wood', x, z, ry, 0, y + 3.88, d / 2 + 1.05, w, 0.9, 0.08);
    const nw = Math.max(1, Math.round(w / 2.6));
    for (let i = 0; i < nw; i++) {
      const ox = -w / 2 + (w / nw) * (i + 0.5);
      k.lbox('window', x, z, ry, ox, y + 4.3, d / 2 - 0.88, 1.0, 1.7, 0.05);
      k.lbox('wood', x, z, ry, ox - 0.62, y + 4.3, d / 2 - 0.84, 0.14, 1.8, 0.08);
      k.lbox('wood', x, z, ry, ox + 0.62, y + 4.3, d / 2 - 0.84, 0.14, 1.8, 0.08);
    }
    for (const sx of [-1, 1]) k.cyl('wood', x + sx * (w / 2 - 0.15) * c + (d / 2 + 1.0) * s, y + 3.88, z - sx * (w / 2 - 0.15) * s + (d / 2 + 1.0) * c, 0.08, 0.07, 2.9, 6);
    if (o.roof !== false) k.roof(o.roofMat || 'roof', x + s * 0.4, y + 6.75, z + c * 0.4, w + 0.4, d + 0.8, ry, { over: 0.9, pitch: 0.85 });
    this.collide(x, z, w, d, ry, y, 10);
    return y;
  }

  godown(x, z, ry, w = 18, d = 9) {
    const k = this.kit;
    const { y } = this.footY(x, z, w, d, ry);
    k.lbox('laterite', x, z, ry, 0, y - 2, 0, w + 0.6, 2.4, d + 0.6);
    k.lbox('laterite', x, z, ry, 0, y + 0.4, 0, w, 4.2, d);
    for (let i = -1; i <= 1; i++) k.lbox('wood', x, z, ry, i * w * 0.3, y + 0.4, d / 2 + 0.02, 2.2, 3, 0.1);
    k.roof('roof', x, y + 4.6, z, w, d, ry, { over: 0.8, pitch: 0.7 });
    this.collide(x, z, w, d, ry, y);
  }

  colonial(x, z, ry, w, d, floors, o = {}) {
    const k = this.kit;
    const { y } = this.footY(x, z, w, d, ry);
    const fh = o.fh || 4.6, mat = o.mat || 'whitewash';
    k.lbox('sandstone', x, z, ry, 0, y - 2.5, 0, w + 2, 3.4, d + 2);
    for (let f = 0; f < floors; f++) {
      const fy = y + 0.9 + f * fh;
      // arcaded verandas front and back, closed core behind
      k.arcade(mat, x, z, ry, 0, fy, d / 2, w, fh, 0.6, Math.round(w / 3.6), 2.2, fh * 0.7);
      k.arcade(mat, x, z, ry, 0, fy, -d / 2, w, fh, 0.6, Math.round(w / 3.6), 2.2, fh * 0.7);
      for (const sx of [-1, 1]) k.lbox(mat, x, z, ry, sx * (w / 2 - 0.3), fy, 0, 0.6, fh, d);
      k.lbox(mat, x, z, ry, 0, fy, 0, w - 1.2, fh, d - 6);
      const nw = Math.round(w / 3.6);
      for (let i = 0; i < nw; i++) {
        const ox = -w / 2 + (w / nw) * (i + 0.5);
        k.lbox('window', x, z, ry, ox, fy + 0.8, (d - 6) / 2 + 0.02, 1.1, 2.4, 0.05);
        k.lbox('window', x, z, ry, ox, fy + 0.8, -(d - 6) / 2 - 0.02, 1.1, 2.4, 0.05);
      }
      k.lbox('sandstone', x, z, ry, 0, fy + fh - 0.25, 0, w + 0.3, 0.35, d + 0.3);
    }
    const top = y + 0.9 + floors * fh;
    k.roof('roof', x, top + 0.05, z, w + 0.4, d + 0.4, ry, { over: 1.2, pitch: 0.55, gable: 0.85, flare: 0.1 });
    // front steps
    k.stairs('sandstone', x, z, ry, 0, y + 0.9, d / 2 + 1.0, 6, 0.3, 0.4, 3);
    this.collide(x, z, w, d, ry, y, floors * fh + 4);
    return { y, top };
  }

  jetty(x0, z0, x1, z1, w = 3) {
    const k = this.kit;
    const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(-(z1 - z0), x1 - x0);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, y = 1.0;
    k.lbox('planks', cx, cz, ry, 0, y, 0, len, 0.2, w, 2);
    for (let t = 0; t <= len; t += 3) for (const sz of [-1, 1]) {
      const c = Math.cos(ry), s = Math.sin(ry), ox = -len / 2 + t;
      k.cyl('wood', cx + ox * c + sz * (w / 2) * s, -3, cz - ox * s + sz * (w / 2) * c, 0.12, 0.11, y + 3.6, 6);
    }
    G.colliders.addDeck(cx, cz, len / 2, w / 2, ry, y + 0.2);
    this.jetties.push({ x: x1, z: z1, ry, len });
  }

  // jetty from the shore out over the water, starting from (x,z) heading towards deeper water
  jettyOut(x, z, len = 22) {
    let best = null;
    for (let a = 0; a < TAU; a += 0.15) {
      const tx = x + Math.cos(a) * len, tz = z + Math.sin(a) * len;
      const h = getHeight(tx, tz);
      if (!best || h < best.h) best = { h, a };
    }
    let sx = x, sz = z;
    for (let t = 0; t < 120; t += 2) { // walk to the water's edge first
      const px = x + Math.cos(best.a) * t, pz = z + Math.sin(best.a) * t;
      if (getHeight(px, pz) < 0.6) { sx = px - Math.cos(best.a) * 4; sz = pz - Math.sin(best.a) * 4; break; }
    }
    this.jetty(sx, sz, sx + Math.cos(best.a) * len, sz + Math.sin(best.a) * len);
    return [sx, sz, best.a];
  }

  // ── planned layout ───────────────────────────────────────────────────────
  // How far a point is from every road (used to keep buildings off other roads).
  clearOfRoads(x, z, m) { return nearestRoad(x, z).d > m; }
  siteOK(x, z, minH = 1.0, maxSlope = 0.22) { return getHeight(x, z) > minH && getSlope(x, z) < maxSlope; }

  // Walk a road outward from the end nearest `centre`, calling fn every `step` metres
  // with (x, z, tx, tz, s) where s = distance from that end.
  walkRoad(name, centre, s0, s1, stepFn) {
    const road = W.meta.roads.find((r) => r.name === name);
    if (!road) return;
    let line = road.line;
    const dA = Math.hypot(line[0][0] - centre.x, line[0][1] - centre.z);
    const dB = Math.hypot(line[line.length - 1][0] - centre.x, line[line.length - 1][1] - centre.z);
    if (dB < dA) line = [...line].reverse();
    let acc = 0, next = s0;
    for (let i = 1; i < line.length && next <= s1; i++) {
      const [ax, az] = line[i - 1], [bx, bz] = line[i];
      const seg = Math.hypot(bx - ax, bz - az);
      if (seg < 1e-3) continue;
      while (next <= acc + seg && next <= s1) {
        const t = (next - acc) / seg;
        const adv = stepFn(ax + (bx - ax) * t, az + (bz - az) * t, (bx - ax) / seg, (bz - az) / seg, next);
        next += adv;
      }
      acc += seg;
    }
  }

  // Terraced bazaar frontage: runs of 3–5 shops under one roof, broken by lanes.
  bazaarRow(name, centre, s0, s1, roadHalf = 3.5) {
    const r = this.rnd;
    for (const side of [-1, 1]) {
      let run = null;
      const flush = () => {
        if (run) this.kit.tints = run.tints || null;
        if (run && run.units.length >= 2) {
          // one continuous roof over the whole run
          const { units, ry, d, floors, y } = run;
          const first = units[0], last = units[units.length - 1];
          const cx = (first.x + last.x) / 2, cz = (first.z + last.z) / 2;
          const len = units.reduce((t, u) => t + u.w, 0);
          const c = Math.cos(ry), sn = Math.sin(ry);
          const roofY = y + (floors > 1 ? 6.75 : 3.75);
          this.kit.roof(run.roofMat, cx + sn * 0.4, roofY, cz + c * 0.4, len + 0.4, d + 0.8, ry, { over: 0.9, pitch: floors > 1 ? 0.8 : 0.75, gable: 0.8 });
          this.counts.shop += units.length;
        } else if (run && run.units.length === 1) {
          const u = run.units[0];
          this.kit.roof(run.roofMat, u.x + Math.sin(run.ry) * 0.4, run.y + (run.floors > 1 ? 6.75 : 3.75), u.z + Math.cos(run.ry) * 0.4, u.w + 0.4, run.d + 0.8, run.ry, { over: 0.9, pitch: 0.85 });
          this.counts.shop += 1;
        }
        run = null;
        this.kit.unwash();
      };
      this.walkRoad(name, centre, s0, s1, (x, z, tx, tz, s) => {
        const w = 6.5 + r() * 3;
        if (!run) {
          // start a new run: fixed facing, depth, height, finish for the whole terrace
          const d = 9 + r() * 2.5;
          const off = roadHalf + 1.8 + d / 2;
          const ry = Math.atan2(tz * side, -tx * side); // face the road
          run = { units: [], ry, d, off, floors: r() < 0.65 ? 2 : 1, wall: r() < 0.55 ? 'plaster' : r() < 0.5 ? 'yplaster' : 'laterite', roofMat: r() < 0.6 ? 'roof' : 'roofOld', target: 3 + Math.floor(r() * 3), ox: x, oz: z, tx, tz, y: null };
        }
        // units in a run follow the run's straight line so the roof stays continuous
        const along = run.units.reduce((t, u) => t + u.w, 0) + w / 2;
        const px = run.ox + run.tx * along, pz = run.oz + run.tz * along;
        const hx = px - run.tz * run.off * side, hz = pz + run.tx * run.off * side;
        // the run's line drifts from a curving road: stop the run if it does
        const drift = Math.abs(nearestRoad(hx, hz).d - run.off);
        const ok = this.siteOK(hx, hz, 1.0, 0.25) && drift < 3 && this.clearOfRoads(hx, hz, run.off - 2.5)
          && this.free(hx, hz, Math.min(w, run.d) / 2 - 1.2);
        if (!ok) { flush(); return 4; }
        if (run.y == null) { run.y = this.footY(hx, hz, w * run.target, run.d, run.ry).y; this.kit.wash(r); run.tints = this.kit.tints; }
        this.kit.tints = run.tints;
        this.shophouse(hx, hz, run.ry, w, { d: run.d, floors: run.floors, wall: run.wall, y: run.y, roof: false });
        run.units.push({ x: hx, z: hz, w });
        this.shopFronts.push({ x: hx + Math.sin(run.ry) * (run.d / 2 + 1.4), z: hz + Math.cos(run.ry) * (run.d / 2 + 1.4), ry: run.ry });
        if (run.units.length >= run.target) { flush(); return w / 2 + 6 + r() * 6; } // lane between terraces
        return w;
      });
      flush();
    }
  }

  // A Kerala house in its own walled compound, set back from the lane.
  compound(x, z, ry, o = {}) {
    const k = this.kit, r = this.rnd;
    const w = 7.5 + r() * 3, d = 6 + r() * 2;
    const PW = w + 12 + r() * 6, PD = d + 14 + r() * 6;   // plot
    const c = Math.cos(ry), s = Math.sin(ry);
    // house sits towards the back of the plot, facing the gate
    const hx = x - s * 2, hz = z - c * 2;
    if (!this.free(hx, hz, Math.max(w, d) / 2 + 2)) return false;
    k.wash(r);
    this.house(hx, hz, ry, { w, d, roofMat: o.roofMat || (r() < 0.55 ? 'roof' : 'roofOld'), wall: o.wall });
    // low laterite compound wall with a gate gap on the lane side
    const wallH = 1.15, t = 0.45;
    const seg = (ox, oz, len, along) => {
      const wx = x + ox * c + oz * s, wz = z - ox * s + oz * c;
      const gy = getHeight(wx, wz);
      const rot = along ? ry : ry + Math.PI / 2;
      k.box('laterite', wx, gy - 0.6, wz, len, wallH + 0.6, t, rot, 1.6);
      k.box('roofOld', wx, gy + wallH, wz, len + 0.1, 0.12, t + 0.18, rot, 2);
      G.colliders.addBox(wx, wz, len / 2, t / 2 + 0.05, rot, gy - 1, gy + wallH);
    };
    seg(0, -PD / 2, PW, true);
    seg(-PW / 2, 0, PD, false); seg(PW / 2, 0, PD, false);
    const gate = 3.2, half = (PW - gate) / 2;
    seg(-(gate / 2 + half / 2), PD / 2, half, true); seg(gate / 2 + half / 2, PD / 2, half, true);
    for (const sx of [-1, 1]) {
      const gx = x + sx * (gate / 2 + 0.3) * c + (PD / 2) * s, gz = z - sx * (gate / 2 + 0.3) * s + (PD / 2) * c, gy = getHeight(gx, gz);
      k.box('laterite', gx, gy - 0.5, gz, 0.7, 2.4, 0.7, ry, 1.6);
      k.pyramid('roofOld', gx, gy + 1.9, gz, 0.6, 0.5, 4, ry + Math.PI / 4);
    }
    // a well or a cattle shed in some compounds
    if (r() < 0.45) {
      const wx = x + (PW / 2 - 3) * c * (r() < 0.5 ? 1 : -1) + (PD / 2 - 4) * s * -0.2, wz = z - (PW / 2 - 3) * s + (PD / 2 - 4) * c * -0.2;
      const gy = getHeight(wx, wz);
      k.cyl('laterite', wx, gy - 0.3, wz, 0.9, 0.9, 1.1, 12, 1.6);
      G.colliders.addCircle(wx, wz, 0.95, gy, gy + 0.8);
    } else if (r() < 0.5) {
      const bx = x - (PW / 2 - 3.5) * c - (PD / 2 - 4) * s, bz = z + (PW / 2 - 3.5) * s - (PD / 2 - 4) * c;
      const gy = getHeight(bx, bz);
      for (const [ox, oz] of [[-1.8, -1.4], [1.8, -1.4], [1.8, 1.4], [-1.8, 1.4]]) k.cyl('wood', bx + ox * c + oz * s, gy, bz - ox * s + oz * c, 0.08, 0.08, 2.2, 5);
      k.roof('thatch', bx, gy + 2.2, bz, 4.2, 3.4, ry, { over: 0.4, pitch: 0.8, gable: 0.8, flare: 0 });
      G.colliders.addBox(bx, bz, 2.1, 1.7, ry, gy, gy + 2.5);
    }
    // garden spots: coconut palms along the walls, banana by the house, a mango in front
    const at = (ox, oz) => [x + ox * c + oz * s, z - ox * s + oz * c];
    const G2 = this.gardens;
    for (let i = 0; i < 2 + Math.floor(r() * 3); i++) G2.push({ sp: 'palm', p: at((r() < 0.5 ? -1 : 1) * (PW / 2 - 1.8), (r() - 0.5) * (PD - 4)) });
    G2.push({ sp: 'banana', p: at((r() < 0.5 ? -1 : 1) * (w / 2 + 3), -d / 2 - 2 + r() * 2) });
    if (r() < 0.7) G2.push({ sp: 'broad', p: at((r() - 0.5) * (PW - 8), PD / 2 - 3.5), s: 0.55 });
    if (r() < 0.5) G2.push({ sp: 'banana', p: at((r() < 0.5 ? -1 : 1) * (PW / 2 - 2.5), PD / 2 - 2.5) });
    G.colliders.addReserve(x, z, Math.max(PW, PD) / 2 + 2); // the yard is the garden's, not the jungle's
    k.unwash();
    this.counts.house++;
    (this.compoundsAt ||= []).push([Math.round(x), Math.round(z), +ry.toFixed(2)]);
    return true;
  }

  // Compounds every 40–70 m along a road, alternating sides, skipping some plots.
  laneHouses(name, centre, s0, s1, roadHalf, o = {}) {
    const r = this.rnd;
    let placed = 0;
    const max = o.max ?? 99;
    this.walkRoad(name, centre, s0, s1, (x, z, tx, tz) => {
      if (placed >= max) return 1e9;
      for (const side of r() < 0.5 ? [-1, 1] : [1, -1]) {
        if (r() > (o.fill ?? 0.6)) continue;
        const set = roadHalf + 12 + r() * 5;
        const hx = x - tz * set * side, hz = z + tx * set * side;
        if (!this.siteOK(hx, hz, o.minH ?? 1.3, 0.2) || !this.clearOfRoads(hx, hz, set - 3)) continue;
        if (Math.hypot(hx - centre.x, hz - centre.z) < (o.keepOut ?? 0)) continue;
        const ry = Math.atan2(tz * side, -tx * side) + (r() - 0.5) * 0.12;
        if (this.compound(hx, hz, ry, o)) { placed++; break; }
      }
      return 40 + r() * 30;
    });
    return placed;
  }

  // Fishing hamlet: clusters of huts on the shore, every door facing the water.
  shoreHamlet(place, nHuts, nHouses = 0, R = place.r) {
    const r = this.rnd;
    const spots = [];
    for (let i = 0; i < 1600 && spots.length < 60; i++) {
      const a = r() * TAU, d = Math.sqrt(r()) * R;
      const x = place.x + Math.cos(a) * d, z = place.z + Math.sin(a) * d;
      const h = getHeight(x, z);
      if (h < 1.1 || h > 4 || getSlope(x, z) > 0.18) continue;
      // nearest water within 45 m
      let best = null;
      for (let b = 0; b < TAU; b += 0.26) for (const dist of [12, 22, 34, 45]) {
        if (getHeight(x + Math.cos(b) * dist, z + Math.sin(b) * dist) < -0.4) { if (!best || dist < best.d) best = { d: dist, b }; break; }
      }
      if (!best || best.d < 12) continue;
      spots.push({ x, z, face: best.b, dw: best.d });
      if (spots.length % 3 === 0) this.shoreSpots.push({ x: x + Math.cos(best.b) * (best.d - 6), z: z + Math.sin(best.b) * (best.d - 6), face: best.b });
    }
    // seed 2–4 clusters along the shore, then fill each cluster
    spots.sort((p, q) => p.dw - q.dw);
    const seeds = [];
    for (const s of spots) if (seeds.length < 2 + Math.floor(nHuts / 6) && seeds.every((q) => Math.hypot(q.x - s.x, q.z - s.z) > 70)) seeds.push(s);
    let huts = 0, houses = 0;
    for (const seed of seeds) {
      const members = spots.filter((s) => Math.hypot(s.x - seed.x, s.z - seed.z) < 55).sort(() => r() - 0.5);
      for (const m of members) {
        if (huts >= nHuts && houses >= nHouses) break;
        if (!this.free(m.x, m.z, 6) || !this.clearOfRoads(m.x, m.z, 6)) continue;
        const ry = Math.atan2(Math.cos(m.face), Math.sin(m.face)) + (r() - 0.5) * 0.35;
        if (houses < nHouses && m.dw > 25) { this.house(m.x, m.z, ry, { roofMat: 'roofOld' }); houses++; this.counts.house++; }
        else if (huts < nHuts) { this.hut(m.x, m.z, ry); huts++; this.counts.hut++; }
      }
    }
    // fish-drying racks between the huts and the water
    for (const seed of seeds) {
      const ry = Math.atan2(Math.cos(seed.face), Math.sin(seed.face));
      const fx = seed.x + Math.cos(seed.face) * seed.dw * 0.5, fz = seed.z + Math.sin(seed.face) * seed.dw * 0.5;
      const gy = getHeight(fx, fz);
      if (gy < 0.3) continue;
      for (let i = -2; i <= 2; i++) this.kit.cyl('wood', fx + Math.cos(ry) * i * 1.6, gy, fz - Math.sin(ry) * i * 1.6, 0.05, 0.05, 1.3, 5);
      this.kit.box('planks', fx, gy + 1.25, fz, 7, 0.06, 1.2, ry, 2);
    }
  }

  // Farmhouses on the raised edges of the paddy, looking over the fields.
  paddyFarms(n) {
    const r = this.rnd, p = P.thenga_paddy;
    let placed = 0;
    for (let i = 0; i < 3000 && placed < n; i++) {
      const a = r() * TAU, d = 200 + r() * 420;
      const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
      if (!this.siteOK(x, z, 1.9, 0.15) || getBiome(x, z)[2] === 2) continue;
      // must overlook a paddy within 40 m
      let fx = 0, fz = 0, found = false;
      for (let b = 0; b < TAU && !found; b += 0.4) { const qx = x + Math.cos(b) * 35, qz = z + Math.sin(b) * 35; if (getBiome(qx, qz)[2] === 2) { fx = qx; fz = qz; found = true; } }
      if (!found || !this.clearOfRoads(x, z, 10) || !this.free(x, z, 18)) continue;
      const ry = Math.atan2(fx - x, fz - z);
      if (this.compound(x, z, ry, { roofMat: r() < 0.5 ? 'roofOld' : 'thatch' })) placed++;
    }
  }

  // The town square: an open maidan with a banyan platform (aalthara) and a well.
  townSquare() {
    const k = this.kit, t = P.vaikara_town;
    const [x, z] = this.findLand(t.x, t.z + 6, 1.5, 60);
    const y = getHeight(x, z);
    k.cyl('laterite', x, y - 1.2, z, 6.5, 6.2, 1.9, 24, 1.6);
    k.cyl('sandstone', x, y + 0.65, z, 6.7, 6.7, 0.15, 24, 3);
    // the banyan itself is a big broadleaf from the vegetation system, planted on the platform
    this.gardens.push({ sp: 'broad2', p: [x, z], s: 2.1, yOff: 0.75 });
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.3; k.cyl('wood', x + Math.cos(a) * 5.2, y + 0.7, z + Math.sin(a) * 5.2, 0.1, 0.1, 7.5, 5); } // aerial roots
    G.colliders.addCircle(x, z, 6.6, y - 2, y + 0.75);
    G.colliders.addDeck(x, z, 4.6, 4.6, 0, y + 0.75);
    // keep the square open: no houses or trees within 32 m
    G.colliders.addReserve(x, z, 32);
    // the well, a lamp post and a stone bench
    const wx = x + 16, wz = z + 6, wy = getHeight(wx, wz);
    k.cyl('laterite', wx, wy - 0.4, wz, 1.3, 1.3, 1.3, 14, 1.6);
    for (const sx of [-1, 1]) k.box('wood', wx + sx * 1.2, wy + 0.9, wz, 0.15, 1.6, 0.15, 0);
    k.box('wood', wx, wy + 2.45, wz, 2.6, 0.15, 0.15, 0);
    G.colliders.addCircle(wx, wz, 1.4, wy, wy + 1);
    this.squareAt = { x, z };
  }

  // Two landings facing each other across a channel; records a ferry route.
  channelCrossing([cx, cz], name) {
    // channel direction from the deepest neighbourhood: find water centre first
    let best = [cx, cz], bh = getHeight(cx, cz);
    for (let a = 0; a < TAU; a += 0.3) for (const d of [10, 20, 30]) { const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d, h = getHeight(x, z); if (h < bh) { bh = h; best = [x, z]; } }
    const banks = [];
    let bestPair = null;
    for (let a = 0; a < Math.PI; a += 0.1) {
      const ends = [];
      for (const sg of [1, -1]) {
        for (let t = 2; t < 120; t += 2) {
          const x = best[0] + Math.cos(a) * t * sg, z = best[1] + Math.sin(a) * t * sg;
          if (getHeight(x, z) > 1.0) { ends.push([x, z, t]); break; }
        }
      }
      if (ends.length === 2 && (!bestPair || ends[0][2] + ends[1][2] < bestPair.w)) bestPair = { w: ends[0][2] + ends[1][2], ends, a };
    }
    if (!bestPair) return;
    for (const [x, z] of bestPair.ends) {
      const dx = best[0] - x, dz = best[1] - z, l = Math.hypot(dx, dz);
      const len = Math.min(14, l * 0.4);
      this.jetty(x - dx / l * 2, z - dz / l * 2, x + dx / l * len, z + dz / l * len);
      banks.push(this.jetties[this.jetties.length - 1]);
    }
    this.ferries.push({ name, a: banks[0], b: banks[1] });
  }

  // ── landmarks
  lighthouse(x, z, h = 26, banded = false) {
    const k = this.kit;
    const y = getHeight(x, z);
    k.cyl('sandstone', x, y - 2, z, 4.6, 4.4, 3.2, 16);
    const bands = 6;
    for (let i = 0; i < bands; i++) {
      const t0 = i / bands, t1 = (i + 1) / bands;
      const mat = banded ? (i % 2 ? 'whitewash' : 'red') : 'laterite';
      k.cyl(mat, x, y + 1.2 + t0 * h, z, 3.2 - t0 * 1.1, 3.2 - t1 * 1.1, h / bands, 18, banded ? 3 : 1.6, true);
    }
    const top = y + 1.2 + h;
    k.cyl('iron', x, top, z, 2.9, 2.9, 0.35, 18);
    k.cyl('iron', x, top + 0.35, z, 2.85, 2.85, 1.0, 18, 2, true); // railing ring
    k.cyl('lamp', x, top + 0.35, z, 1.4, 1.4, 2.2, 14);
    k.sphere('copper', x, top + 2.55, z, 1.65, TAU, Math.PI / 2, 0.8);
    k.cyl('gold', x, top + 3.8, z, 0.1, 0.04, 1, 6);
    // keeper's cottage
    this.house(x + 12, z + 6, Math.PI * 0.3, { w: 7, d: 5, wall: 'whitewash' });
    G.colliders.addCircle(x, z, 3.3, y - 2, top + 4);
    // rotating beam (visible at night)
    const beam = new THREE.Group();
    const bm = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const vv = uv().y;
    bm.colorNode = vec4(vec3(1.0, 0.86, 0.55), vv.mul(vv).mul(vv).mul(0.22).mul(U.night));
    bm.fog = false;
    for (const s of [1, -1]) {
      const g = new THREE.ConeGeometry(18, 420, 24, 1, true);
      g.translate(0, -210, 0); g.rotateZ(s * Math.PI / 2);
      const m = new THREE.Mesh(g, bm);
      m.frustumCulled = false;
      beam.add(m);
    }
    beam.position.set(x, top + 1.4, z);
    this.scene.add(beam);
    this.beams.push(beam);
    const light = new THREE.PointLight(0xffd8a0, 0, 160, 1.6);
    light.position.set(x, top + 1.4, z);
    this.scene.add(light);
    this.lamps.push(light);
  }

  bridge() {
    const k = this.kit;
    const [ax, az] = toWorld(664, 560), [bx, bz] = toWorld(650, 623);
    const L = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / L, dz = (bz - az) / L;
    const ry = Math.atan2(-dz, dx);
    const cx = (ax + bx) / 2, cz = (az + bz) / 2;
    const deckY = 7.2, W2 = 9;
    const n = Math.round(L / 24);
    k.arcade('sandstone', cx, cz, ry, 0, -8, 0, L, deckY + 8, W2, n, (L / n) * 0.74, 12, 0, 3);
    k.lbox('sandstone', cx, cz, ry, 0, deckY, 0, L + 0.2, 0.4, W2 + 0.6, 3);
    for (const s of [-1, 1]) k.lbox('sandstone', cx, cz, ry, 0, deckY + 0.4, s * (W2 / 2), L, 1.0, 0.5, 3);
    // cutwaters on each pier
    for (let i = 1; i < n; i++) {
      const ox = -L / 2 + (L / n) * i;
      for (const s of [-1, 1]) {
        const c = Math.cos(ry), sn = Math.sin(ry);
        const px = cx + ox * c + s * (W2 / 2 + 1.2) * sn, pz = cz - ox * sn + s * (W2 / 2 + 1.2) * c;
        k.cyl('sandstone', px, -8, pz, 1.6, 1.2, 10, 8, 3);
        k.pyramid('sandstone', px, 2, pz, 1.3, 2, 8);
      }
    }
    // lamps on the parapet
    for (let i = 0; i <= n; i += 2) {
      const ox = -L / 2 + (L / n) * i, c = Math.cos(ry), sn = Math.sin(ry);
      for (const s of [-1, 1]) {
        const px = cx + ox * c + s * (W2 / 2) * sn, pz = cz - ox * sn + s * (W2 / 2) * c;
        k.cyl('iron', px, deckY + 1.4, pz, 0.08, 0.06, 3, 6);
        k.box('lamp', px, deckY + 4.3, pz, 0.35, 0.5, 0.35);
      }
    }
    // ramps down to the banks
    const ends = [[ax, az, -1], [bx, bz, 1]];
    for (const [ex, ez, sgn] of ends) {
      const rl = 34;
      const gy = Math.max(getHeight(ex + dx * sgn * rl, ez + dz * sgn * rl), 0.8);
      const mx = ex + dx * sgn * rl / 2, mz = ez + dz * sgn * rl / 2;
      const ang = Math.atan2(deckY - gy, rl);
      const g = new THREE.BoxGeometry(rl + 1, 0.6, W2 + 0.6);
      this.kit.push('sandstone', g, mx, (deckY + gy) / 2, mz, ry, 0, -sgn * ang);
      const gw = new THREE.BoxGeometry(rl + 1, deckY - gy + 2, W2 + 0.6);
      this.kit.push('sandstone', gw, mx, (deckY + gy) / 2 - (deckY - gy) / 2 - 0.5, mz, ry, 0, 0, 1, 1, 1);
      for (let t = 0; t < rl; t += 2) {
        const f = t / rl, px = ex + dx * sgn * t, pz = ez + dz * sgn * t;
        G.colliders.addDeck(px, pz, 1.2, W2 / 2 - 0.3, ry, deckY + (gy - deckY) * f + 0.3);
      }
    }
    for (let t = 0; t <= L; t += 2) G.colliders.addDeck(ax + dx * t, az + dz * t, 1.2, W2 / 2 - 0.3, ry, deckY + 0.4);
    for (const s of [-1, 1]) for (let t = 0; t <= L; t += 4) G.colliders.addBox(ax + dx * t + s * dz * (W2 / 2), az + dz * t - s * dx * (W2 / 2), 2.1, 0.3, ry, deckY, deckY + 1.6);
    this.bridgeInfo = { ax, az, bx, bz, deckY };
  }

  ghat() {
    const k = this.kit;
    // steps from the bazaar down into the river (north bank)
    const [gx, gz] = this.findLand(P.river_ghat.x, P.river_ghat.z - 40, 1.2);
    // find the water direction
    let best = 0, bh = 99;
    for (let a = 0; a < TAU; a += 0.1) { const h = getHeight(gx + Math.cos(a) * 30, gz + Math.sin(a) * 30); if (h < bh) { bh = h; best = a; } }
    const ry = Math.atan2(Math.cos(best), Math.sin(best)) - Math.PI / 2;
    const fx = Math.cos(best), fz = Math.sin(best);
    const top = getHeight(gx, gz);
    for (let i = 0; i < 14; i++) {
      const x = gx + fx * i * 1.1, z = gz + fz * i * 1.1, y = top - i * 0.42;
      k.box('sandstone', x, y - 3, z, 26, 3, 1.4, Math.atan2(fx, fz) + Math.PI / 2, 2.5);
      G.colliders.addDeck(x, z, 13, 0.7, Math.atan2(fx, fz) + Math.PI / 2, y);
    }
    // small riverside shrine and a mandapam
    const sx = gx - fx * 10 + fz * 16, sz = gz - fz * 10 - fx * 16;
    const sy = getHeight(sx, sz);
    k.box('sandstone', sx, sy - 1, sz, 4, 1.6, 4);
    k.box('whitewash', sx, sy + 0.6, sz, 3, 2.6, 3);
    k.pyramid('copper', sx, sy + 3.2, sz, 2.6, 2.4, 4);
    for (const [ox, oz] of [[-3, -3], [3, -3], [3, 3], [-3, 3]]) k.cyl('sandstone', sx - fz * 12 + ox, sy, sz + fx * 12 + oz, 0.25, 0.25, 3, 8);
    k.roof('roof', sx - fz * 12, sy + 3, sz + fx * 12, 8, 8, ry, { over: 0.8, pitch: 0.8 });
    this.jettyOut(gx + fz * 22, gz - fx * 22, 26);
    void ry;
  }

  church() {
    const k = this.kit;
    const p = P.st_thomas;
    const ry = this.faceRoad(p.x, p.z);
    const { y } = this.footY(p.x, p.z, 18, 44, ry);
    const c = Math.cos(ry), s = Math.sin(ry);
    const at = (ox, oz) => [p.x + ox * c + oz * s, p.z - ox * s + oz * c];
    k.lbox('sandstone', p.x, p.z, ry, 0, y - 2.5, 0, 20, 3.3, 46);
    // nave
    k.lbox('whitewash', p.x, p.z, ry, 0, y + 0.8, -4, 14, 10, 36);
    { const [nx, nz] = at(0, -4); k.roof('roof', nx, y + 10.8, nz, 14, 36, ry, { over: 0.8, pitch: 0.9, gable: 0.95 }); }
    // baroque facade with two bell towers
    const fz = 14;
    k.lbox('whitewash', p.x, p.z, ry, 0, y + 0.8, fz, 16, 14, 1.6);
    k.lbox('whitewash', p.x, p.z, ry, 0, y + 14.8, fz, 10, 3, 1.4);
    k.lbox('whitewash', p.x, p.z, ry, 0, y + 17.8, fz, 5, 2.4, 1.2);
    k.lbox('sandstone', p.x, p.z, ry, 0, y + 14.6, fz + 0.2, 16.6, 0.4, 1.9);
    k.lbox('window', p.x, p.z, ry, 0, y + 0.8, fz + 0.82, 2.6, 4.6, 0.08);
    k.lbox('window', p.x, p.z, ry, 0, y + 9, fz + 0.82, 1.6, 2.6, 0.08);
    for (const sx of [-1, 1]) {
      const [tx, tz] = at(sx * 9, fz - 1);
      k.box('whitewash', tx, y + 0.8, tz, 5, 21, 5, ry);
      k.box('window', ...at(sx * 9, fz + 1.53).slice(0, 1), y + 15, at(sx * 9, fz + 1.53)[1], 1.2, 2.4, 0.06, ry);
      k.box('sandstone', tx, y + 21.8, tz, 5.6, 0.5, 5.6, ry);
      k.pyramid('roof', tx, y + 22.3, tz, 3.4, 5, 4, ry + Math.PI / 4);
      k.cyl('gold', tx, y + 27.3, tz, 0.08, 0.08, 1.4, 6);
    }
    // cross on top
    const [cxp, czp] = at(0, fz);
    k.box('gold', cxp, y + 20.2, czp, 0.25, 2.4, 0.25, ry);
    k.box('gold', cxp, y + 21.3, czp, 1.4, 0.25, 0.25, ry);
    k.stairs('sandstone', p.x, p.z, ry, 0, y + 0.8, fz + 1.4, 8, 0.27, 0.45, 3);
    this.collide(p.x + (-4) * s, p.z + (-4) * c, 15, 37, ry, y, 12);
    this.collide(...at(0, fz), 20, 3, ry, y, 20);
    this.fixRoofY = true;
    this.churchY = y;
  }

  mosque() {
    const k = this.kit;
    const p = P.juma_mosque;
    const ry = this.faceRoad(p.x, p.z);
    const { y } = this.footY(p.x, p.z, 24, 24, ry);
    const c = Math.cos(ry), s = Math.sin(ry);
    const at = (ox, oz) => [p.x + ox * c + oz * s, p.z - ox * s + oz * c];
    k.lbox('sandstone', p.x, p.z, ry, 0, y - 2.5, 0, 28, 3.2, 28);
    k.lbox('whitewash', p.x, p.z, ry, 0, y + 0.7, -2, 20, 8, 18);
    k.arcade('whitewash', p.x, p.z, ry, 0, y + 0.7, 7.5, 20, 6, 1.0, 5, 2.4, 4.6);
    k.lbox('roof', p.x, p.z, ry, 0, y + 6.7, 5.2, 20.6, 0.25, 5.4);
    // drum + dome
    const [dx, dz] = at(0, -2);
    k.cyl('whitewash', dx, y + 8.7, dz, 5.2, 5.2, 2.4, 24);
    k.sphere('whitewash', dx, y + 11.1, dz, 5.2, TAU, Math.PI / 2, 1.15, 28);
    k.cyl('gold', dx, y + 16.9, dz, 0.18, 0.05, 2.2, 6);
    k.sphere('gold', dx, y + 17.2, dz, 0.4, TAU, Math.PI, 1, 8);
    for (const sx of [-1, 1]) {
      const [mx, mz] = at(sx * 11.5, 8);
      k.cyl('whitewash', mx, y + 0.7, mz, 1.4, 1.1, 20, 12);
      k.cyl('sandstone', mx, y + 14, mz, 1.6, 1.6, 0.5, 12);
      k.cyl('whitewash', mx, y + 20.7, mz, 1.0, 1.0, 2, 12);
      k.sphere('whitewash', mx, y + 22.7, mz, 1.0, TAU, Math.PI / 2, 1.4, 12);
      k.cyl('gold', mx, y + 24, mz, 0.06, 0.03, 1.2, 5);
      G.colliders.addCircle(mx, mz, 1.5, y, y + 24);
    }
    this.collide(...at(0, 0), 21, 21, ry, y, 12);
  }

  temple() {
    const k = this.kit;
    const p = P.ponnambalam;
    const ry = this.faceRoad(p.x, p.z);
    const { y } = this.footY(p.x, p.z, 70, 70, ry);
    const c = Math.cos(ry), s = Math.sin(ry);
    const at = (ox, oz) => [p.x + ox * c + oz * s, p.z - ox * s + oz * c];
    // compound wall
    const S = 64;
    for (const [ox, oz, w, d] of [[0, -S / 2, S, 1.2], [-S / 2, 0, 1.2, S], [S / 2, 0, 1.2, S], [-S / 4 - 4, S / 2, S / 2 - 8, 1.2], [S / 4 + 4, S / 2, S / 2 - 8, 1.2]]) {
      k.lbox('laterite', p.x, p.z, ry, ox, y - 1.5, oz, w, 4.6, d);
      k.lbox('roof', p.x, p.z, ry, ox, y + 3.1, oz, w + 0.6, 0.3, d + 0.9);
      const [qx, qz] = at(ox, oz);
      this.collide(qx, qz, w, d, ry, y, 4);
    }
    // gopuram over the gate
    const [gx, gz] = at(0, S / 2);
    k.box('sandstone', gx, y - 1.5, gz, 14, 8, 9, ry);
    k.box('window', ...at(0, S / 2 + 4.52).slice(0, 1), y, at(0, S / 2 + 4.52)[1], 3.4, 5.4, 0.06, ry);
    let ty = y + 6.5, tw = 13, td = 8.2;
    for (let t = 0; t < 6; t++) {
      k.box('yplaster', gx, ty, gz, tw, 2.5, td, ry);
      k.box('sandstone', gx, ty + 2.5, gz, tw + 0.6, 0.35, td + 0.6, ry);
      for (let i = -2; i <= 2; i++) {
        const [nx, nz] = [gx + i * (tw / 5) * c + (td / 2 + 0.05) * s, gz - i * (tw / 5) * s + (td / 2 + 0.05) * c];
        k.box(t % 2 ? 'red' : 'window', nx, ty + 0.5, nz, 0.7, 1.4, 0.12, ry);
      }
      ty += 2.85; tw *= 0.84; td *= 0.82;
    }
    // barrel-vault crown with kalasams
    {
      const g = new THREE.CylinderGeometry(td / 2, td / 2, tw, 14, 1, false, 0, Math.PI);
      g.rotateZ(Math.PI / 2);
      this.kit.push('yplaster', g, gx, ty, gz, ry + Math.PI / 2, 0, 0);
      for (let i = -2; i <= 2; i++) {
        const kx = gx + i * (tw / 5) * c, kz = gz - i * (tw / 5) * s;
        k.cyl('gold', kx, ty + td / 2 - 0.2, kz, 0.35, 0.12, 1.8, 8);
      }
    }
    G.colliders.addBox(gx + 4.5 * c, gz - 4.5 * s, 2, 4.5, ry, y, y + 20);
    G.colliders.addBox(gx - 4.5 * c, gz + 4.5 * s, 2, 4.5, ry, y, y + 20);
    // sreekovil: circular shrine with conical copper roof (Kerala style)
    const [sx, sz] = at(0, -6);
    k.cyl('sandstone', sx, y - 1, sz, 7.4, 7.4, 2.2, 28);
    k.cyl('laterite', sx, y + 1.2, sz, 6.2, 6.2, 3.8, 28, 1.6);
    k.cyl('copper', sx, y + 4.8, sz, 8.4, 0.5, 7.5, 28, 2, true);
    k.cyl('gold', sx, y + 12.2, sz, 0.45, 0.1, 1.8, 8);
    G.colliders.addCircle(sx, sz, 7.4, y, y + 12);
    // namaskara mandapam
    const [nx, nz] = at(0, 12);
    for (const [ox, oz] of [[-3.5, -3.5], [3.5, -3.5], [3.5, 3.5], [-3.5, 3.5]]) k.cyl('sandstone', nx + ox, y, nz + oz, 0.3, 0.3, 3.2, 8);
    k.box('sandstone', nx, y - 1, nz, 9, 1.4, 9, ry);
    k.roof('copper', nx, y + 3.2, nz, 9, 9, ry, { over: 0.6, pitch: 1.0, gable: 0.6 });
    // deepastambham: the tall brass lamp pillar
    const [lx, lz] = at(0, 24);
    k.cyl('gold', lx, y, lz, 0.6, 0.3, 11, 10);
    for (let i = 0; i < 9; i++) k.cyl('gold', lx, y + 2 + i * 1.0, lz, 1.0 - i * 0.07, 1.0 - i * 0.07, 0.12, 10);
    G.colliders.addCircle(lx, lz, 0.8, y, y + 11);
    // the temple tank outside the gate
    const [tx, tz] = at(-46, 30);
    const th = getHeight(tx, tz);
    for (let i = 0; i < 6; i++) {
      const w = 26 - i * 3;
      for (const [ox, oz, ww, dd] of [[0, -w / 2, w, 1.5], [0, w / 2, w, 1.5], [-w / 2, 0, 1.5, w], [w / 2, 0, 1.5, w]]) k.lbox('laterite', tx, tz, ry, ox, th - 0.6 - i * 0.6, oz, ww, 0.6, dd);
    }
    const pond = new THREE.Mesh(new THREE.PlaneGeometry(10, 10).rotateX(-Math.PI / 2), new THREE.MeshPhysicalNodeMaterial({ color: 0x16301c, roughness: 0.05, metalness: 0, ior: 1.33 }));
    pond.position.set(tx, th - 3.4, tz); pond.rotation.y = ry;
    this.scene.add(pond);
    G.colliders.addBox(tx, tz, 13, 13, ry, th - 4, th + 0.2);
  }

  court() {
    const p = P.district_court;
    const ry = this.faceRoad(p.x, p.z);
    const { y, top } = this.colonial(p.x, p.z, ry, 42, 16, 2, { mat: 'whitewash', fh: 4.8 });
    const c = Math.cos(ry), s = Math.sin(ry);
    // central pediment and flag
    this.kit.lbox('whitewash', p.x, p.z, ry, 0, top - 1, 8.4, 10, 2, 1);
    this.kit.cyl('iron', p.x + 9.5 * s, y + 0.9, p.z + 9.5 * c + 0, 0.09, 0.06, 16, 6);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.8, 8, 1), materials().redcloth);
    flag.geometry.translate(1.5, 0, 0);
    flag.position.set(p.x + 9.5 * s, y + 15.8, p.z + 9.5 * c);
    this.scene.add(flag);
    this.flag = flag;
    // carriage drive with hitching posts
    for (let i = -3; i <= 3; i++) this.kit.cyl('iron', p.x + i * 4 * c + 14 * s, getHeight(p.x + 14 * s, p.z + 14 * c), p.z - i * 4 * s + 14 * c, 0.08, 0.08, 1.1, 6);
  }

  residency() {
    const k = this.kit;
    const p = P.residency;
    const ry = this.faceRoad(p.x, p.z);
    const { y, top } = this.colonial(p.x, p.z, ry, 32, 20, 2, { mat: 'yplaster', fh: 5 });
    const c = Math.cos(ry), s = Math.sin(ry);
    // portico with columns
    for (const ox of [-5, -1.7, 1.7, 5]) k.cyl('whitewash', p.x + ox * c + 14 * s, y + 0.9, p.z - ox * s + 14 * c, 0.5, 0.42, 9.5, 14);
    k.lbox('whitewash', p.x, p.z, ry, 0, y + 10.4, 13, 12.5, 1, 7);
    {
      const sh = new THREE.Shape(); sh.moveTo(-6.5, 0); sh.lineTo(6.5, 0); sh.lineTo(0, 2.6); sh.lineTo(-6.5, 0);
      const g = new THREE.ExtrudeGeometry(sh, { depth: 7, bevelEnabled: false });
      k.push('whitewash', g, p.x + 9.5 * s, y + 11.4, p.z + 9.5 * c, ry);
    }
    // garden wall and gate piers
    const R = 70;
    for (const [ox, oz, w, d] of [[0, -R / 2, R, 0.8], [-R / 2, 0, 0.8, R], [R / 2, 0, 0.8, R], [-R / 4 - 4, R / 2, R / 2 - 8, 0.8], [R / 4 + 4, R / 2, R / 2 - 8, 0.8]]) {
      const qx = p.x + ox * c + oz * s, qz = p.z - ox * s + oz * c;
      const gy = getHeight(qx, qz);
      k.box('whitewash', qx, gy - 1, qz, w, 3.2, d, ry);
      this.collide(qx, qz, w, d, ry, gy, 3);
    }
    for (const sx of [-1, 1]) {
      const qx = p.x + sx * 4.5 * c + (R / 2) * s, qz = p.z - sx * 4.5 * s + (R / 2) * c, gy = getHeight(qx, qz);
      k.box('sandstone', qx, gy - 0.5, qz, 1.4, 4.2, 1.4, ry);
      k.sphere('sandstone', qx, gy + 3.7, qz, 0.6, TAU, Math.PI, 1, 10);
    }
    void top;
  }

  fort() {
    const k = this.kit;
    const p = P.fort;
    const ry = 0.25;
    const c = Math.cos(ry), s = Math.sin(ry);
    const Wd = 130, Dp = 100;
    const corners = [[-Wd / 2, -Dp / 2], [Wd / 2, -Dp / 2], [Wd / 2, Dp / 2], [-Wd / 2, Dp / 2]];
    const at = (ox, oz) => [p.x + ox * c + oz * s, p.z - ox * s + oz * c];
    const r = makeRng(77);
    for (let i = 0; i < 4; i++) {
      const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % 4];
      const len = Math.hypot(bx - ax, bz - az), segs = Math.round(len / 8);
      for (let j = 0; j < segs; j++) {
        if (r() < 0.12) continue;                 // breaches
        if (i === 2 && Math.abs(j - segs / 2) < 1) continue; // gate gap
        const t = (j + 0.5) / segs;
        const ox = ax + (bx - ax) * t, oz = az + (bz - az) * t;
        const [wx, wz] = at(ox, oz);
        const gy = getHeight(wx, wz);
        const h = 7 + r() * 2 - (r() < 0.2 ? 3 + r() * 3 : 0);
        const along = Math.atan2(-(bz - az), bx - ax) + ry;
        k.box('fortstone', wx, gy - 2, wz, 8.2, h + 2, 3.2, along, 2.6);
        // crenellations
        if (h > 6) for (let m = -1; m <= 1; m += 2) k.box('fortstone', wx + Math.cos(along) * m * 2, gy + h, wz - Math.sin(along) * m * 2, 1.6, 1.0, 3.2, along);
        G.colliders.addBox(wx, wz, 4.1, 1.6, along, gy - 2, gy + h);
      }
      // round bastion at each corner
      const [qx, qz] = at(ax, az);
      const gy = getHeight(qx, qz);
      k.cyl('fortstone', qx, gy - 2, qz, 9, 8, 11.5, 20, 2.6);
      k.cyl('fortstone', qx, gy + 9.5, qz, 8.3, 8.3, 1.2, 20, 2.6, true);
      G.colliders.addCircle(qx, qz, 9, gy - 2, gy + 9.5);
      G.colliders.addDeck(qx, qz, 6, 6, 0, gy + 9.5);
      this.cannons = this.cannons || [];
      this.cannons.push([qx, gy + 9.5, qz, Math.atan2(qx - p.x, qz - p.z)]);
    }
    // gatehouse
    const [gx, gz] = at(0, Dp / 2);
    const gy = getHeight(gx, gz);
    k.arcade('fortstone', gx, gz, ry, 0, gy - 1, 0, 16, 11, 6, 1, 5, 7);
    // ruined barracks inside
    for (let i = 0; i < 3; i++) {
      const [bx, bz] = at(-30 + i * 30, -20);
      const by = getHeight(bx, bz);
      k.box('fortstone', bx, by - 1, bz, 20, 3 + r() * 2, 0.9, ry);
      k.box('fortstone', bx + 9.5 * c, by - 1, bz - 9.5 * s, 0.9, 2 + r() * 2, 8, ry);
      k.box('fortstone', bx - 9.5 * c, by - 1, bz + 9.5 * s, 0.9, 4, 8, ry);
    }
  }

  teaEstate() {
    const p = P.kanmala;
    // bungalow on the crest, factory below, workers' lines
    const [bx, bz] = this.findLand(p.x - 40, p.z - 60, 20);
    this.colonial(bx, bz, this.faceRoad(bx, bz), 22, 14, 1, { mat: 'whitewash', fh: 4.4 });
    const [fx, fz] = this.findLand(p.x + 80, p.z + 50, 5);
    const ry = this.faceRoad(fx, fz);
    const { y } = this.footY(fx, fz, 46, 16, ry);
    const k = this.kit;
    k.lbox('laterite', fx, fz, ry, 0, y - 2, 0, 47, 2.4, 17);
    for (let f = 0; f < 3; f++) {
      k.lbox(f ? 'planks' : 'laterite', fx, fz, ry, 0, y + 0.4 + f * 3.6, 0, 46, 3.6, 16);
      for (let i = 0; i < 14; i++) for (const sd of [-1, 1]) k.lbox('window', fx, fz, ry, -21 + i * 3.25, y + 1.4 + f * 3.6, sd * 8.03, 1.2, 1.6, 0.05);
    }
    k.roof('roof', fx, y + 11.2, fz, 46, 16, ry, { over: 1, pitch: 0.5, gable: 0.9 });
    k.lbox('laterite', fx, fz, ry, 18, y + 11, 0, 2.4, 9, 2.4);
    this.collide(fx, fz, 46, 16, ry, y, 14);
    for (let i = 0; i < 3; i++) {
      const [lx, lz] = this.findLand(p.x + 130 + i * 6, p.z - 20 + i * 26, 5);
      const lry = this.faceRoad(lx, lz);
      const ly = this.footY(lx, lz, 32, 6, lry).y;
      k.lbox('laterite', lx, lz, lry, 0, ly - 2, 0, 32, 4.6, 6);
      for (let j = 0; j < 8; j++) k.lbox('wood', lx, lz, lry, -14 + j * 4, ly, 3.02, 0.9, 1.9, 0.08);
      k.roof('roof', lx, ly + 2.6, lz, 32, 6, lry, { over: 0.9, pitch: 0.6 });
      this.collide(lx, lz, 32, 6, lry, ly, 4);
    }
  }

  railway() {
    const k = this.kit;
    const line = W.meta.rail;
    for (let i = 1; i < line.length; i++) {
      const [ax, az] = line[i - 1], [bx, bz] = line[i];
      const L = Math.hypot(bx - ax, bz - az);
      if (L < 0.1) continue;
      const ry = Math.atan2(-(bz - az), bx - ax);
      for (let t = 0; t < L; t += 0.9) {
        const x = ax + (bx - ax) * t / L, z = az + (bz - az) * t / L;
        k.box('wood', x, getHeight(x, z) + 0.05, z, 0.25, 0.16, 2.5, ry, 1);
      }
      for (const sd of [-0.72, 0.72]) {
        const mx = (ax + bx) / 2 - Math.sin(ry) * sd, mz = (az + bz) / 2 - Math.cos(ry) * sd;
        k.box('iron', mx, getHeight(mx, mz) + 0.2, mz, L + 0.05, 0.14, 0.09, ry, 1);
      }
    }
    // Karimulam station
    const [sx, sz] = line[0];
    const [nx, nz] = line[3];
    const ry = Math.atan2(-(nz - sz), nx - sx);
    const ox = -Math.sin(ry) * 7, oz = -Math.cos(ry) * 7;
    const px = (sx + nx) / 2 + ox, pz = (sz + nz) / 2 + oz;
    const py = getHeight(px, pz);
    k.box('sandstone', px, py - 1, pz, 60, 2, 5, ry);
    G.colliders.addDeck(px, pz, 30, 2.5, ry, py + 1);
    const hx = px - Math.sin(ry) * 7, hz = pz - Math.cos(ry) * 7;
    k.box('yplaster', hx, py, hz, 18, 4.2, 7, ry);
    k.roof('roof', hx, py + 4.2, hz, 18, 7, ry, { over: 1.6, pitch: 0.55 });
    for (let i = -4; i <= 4; i++) k.cyl('iron', px + Math.cos(ry) * i * 6 + Math.sin(ry) * 1.2, py + 1, pz - Math.sin(ry) * i * 6 + Math.cos(ry) * 1.2, 0.08, 0.08, 3.4, 6);
    {
      const g = new THREE.BoxGeometry(54, 0.15, 4.6);
      k.push('roof', g, px, py + 4.5, pz, ry, 0.08);
    }
    this.collide(hx, hz, 18, 7, ry, py, 6);
    this.station = { x: (sx + nx) / 2, z: (sz + nz) / 2, ry };
  }

  saltPans() {
    const k = this.kit, r = makeRng(31);
    const p = P.salt_pans;
    for (let i = 0; i < 60; i++) {
      const x = p.x + (r() - 0.5) * 520, z = p.z + (r() - 0.5) * 420;
      const b = getBiome(x, z);
      if (b[2] !== 3) continue;
      const y = getHeight(x, z);
      if (y < 0.1) continue;
      const s = 0.8 + r() * 1.2;
      k.pyramid('salt', x, y - 0.1, z, 1.2 * s, 1.1 * s, 9, r());
    }
    for (let i = 0; i < 4; i++) {
      const [x, z] = this.findLand(p.x - 200 + i * 120, p.z - 150, 0.8);
      const y = getHeight(x, z);
      const ry = r() * 3;
      k.box('planks', x, y, z, 10, 2.4, 5, ry);
      k.roof('thatch', x, y + 2.4, z, 10, 5, ry, { over: 0.6, pitch: 0.7 });
      this.collide(x, z, 10, 5, ry, y, 4);
    }
  }

  market() {
    const k = this.kit, r = makeRng(55);
    const p = P.old_bazaar;
    const cloths = ['cloth', 'redcloth', 'bluecloth'];
    for (let i = 0; i < 16; i++) {
      const x = p.x + (r() - 0.5) * 70, z = p.z + (r() - 0.5) * 60;
      const y = getHeight(x, z);
      if (y < 1.2 || !this.free(x, z, 2.6)) continue;
      const ry = this.faceRoad(x, z);
      const c = Math.cos(ry), s = Math.sin(ry);
      for (const [ox, oz] of [[-1.4, -1], [1.4, -1], [1.4, 1], [-1.4, 1]]) k.cyl('wood', x + ox * c + oz * s, y, z - ox * s + oz * c, 0.06, 0.06, 2.3, 5);
      const g = new THREE.PlaneGeometry(3.4, 2.6); g.rotateX(-Math.PI / 2 + 0.12);
      k.push(cloths[i % 3], g, x, y + 2.35, z, ry);
      k.box('planks', x, y + 0.7, z, 2.6, 0.12, 1.6, ry);
      for (let b = 0; b < 4; b++) k.sphere(['salt', 'redcloth', 'gold', 'cloth'][b], x + (b - 1.5) * 0.6 * c, y + 0.82, z - (b - 1.5) * 0.6 * s, 0.26, TAU, Math.PI / 2, 0.6, 8);
      G.colliders.addBox(x, z, 1.5, 1.1, ry, y, y + 2.5);
    }
  }

  shrine(p, big = false) {
    const k = this.kit;
    const [x, z] = this.findLand(p.x, p.z, 1.5, 120);
    const y = getHeight(x, z);
    const ry = this.faceRoad(x, z);
    k.box('laterite', x, y - 1, z, 7, 1.8, 7, ry);
    k.box('whitewash', x, y + 0.8, z, 4, 3, 4, ry);
    k.roof('copper', x, y + 3.8, z, 4.5, 4.5, ry, { over: 0.9, pitch: 1.1, gable: 0.6 });
    if (big) k.roof('copper', x, y + 6.0, z, 2.6, 2.6, ry, { over: 0.4, pitch: 1.1, gable: 0.6 });
    k.cyl('sandstone', x + 6, y, z + 2, 0.3, 0.2, 2.4, 8);
    this.collide(x, z, 7, 7, ry, y, 6);
  }

  async build(progress) {
    const step = async (f, t) => { f(); progress?.(t); await new Promise((r) => setTimeout(r, 0)); };
    await step(() => this.bridge(), 0.05);
    await step(() => { this.church(); this.mosque(); this.temple(); }, 0.15);
    await step(() => { this.court(); this.residency(); this.ghat(); this.market(); }, 0.25);
    await step(() => {
      const t = P.vaikara_town;
      this.townSquare();
      // the bazaar core: terraces only on the busiest streets, close to the square
      this.bazaarRow('Bazaar Street', t, 34, 210, 3.5);
      this.bazaarRow('Bridge Road', t, 34, 115, 3.5);
      this.bazaarRow('Puliyur Road', t, 30, 95, 3.5);
      this.bazaarRow('Estate Road', t, 34, 85, 3.5);
    }, 0.4);
    await step(() => {
      const t = P.vaikara_town;
      // residential compounds on the lanes around the core
      this.laneHouses('Temple Way', t, 50, 330, 2.5, { fill: 0.55 });
      this.laneHouses('Church Lane', t, 40, 330, 2.5, { fill: 0.7 });
      this.laneHouses('Ferry Lane', t, 60, 330, 1.3, { fill: 0.6 });
      this.laneHouses('Puliyur Road', t, 170, 520, 3.5, { fill: 0.5 });
      this.laneHouses('Estate Road', t, 160, 520, 3.5, { fill: 0.45 });
      // villages strung along their roads
      this.laneHouses('Puliyur Road', P.puliyur, 0, 260, 3.5, { fill: 0.7, max: 7 });
      this.laneHouses('Hill Road', P.puliyur, 0, 240, 2.5, { fill: 0.6, max: 4 });
      this.laneHouses('North Coast Road', P.puliyur, 0, 260, 3.5, { fill: 0.5, max: 3 });
      this.laneHouses('Karimulam Road', P.karimulam, 0, 300, 2.5, { fill: 0.7, max: 9 });
      this.laneHouses('Hill Road', P.hill_trading_post, 0, 120, 2.5, { fill: 0.8, max: 3 });
      this.laneHouses('Southern Road', P.southern_ferry, 40, 260, 3.5, { fill: 0.5, max: 3 });
      this.laneHouses('Veliyathura Road', P.veliyathura, 60, 360, 2.5, { fill: 0.5, max: 4 });
      this.laneHouses('Fort Road', P.kayalore, 40, 300, 2.5, { fill: 0.5, max: 3 });
      this.paddyFarms(6);
    }, 0.55);
    await step(() => {
      this.shoreHamlet(P.muthalappuzha, 16, 2);
      this.shoreHamlet(P.veliyathura, 9, 1);
      this.shoreHamlet(P.kayalore, 10, 1);
      this.shoreHamlet(P.southern_ferry, 5);
      this.shoreHamlet(P.kalliyar_ferry, 4, 0, 230);
      for (let i = 0; i < 3; i++) { const [x, z] = this.findLand(P.hill_trading_post.x + 30 - i * 26, P.hill_trading_post.z + 24, 3); this.godown(x, z, this.faceRoad(x, z), 14, 8); }
    }, 0.7);
    await step(() => {
      this.lighthouse(...this.findLand(P.lighthouse_point.x - 10, P.lighthouse_point.z, 2.5, 120), 28, true);
      this.lighthouse(...this.findLand(P.veliyathura.x - 20, P.veliyathura.z, 2.0, 120), 24, false);
      this.fort();
      this.teaEstate();
    }, 0.8);
    await step(() => {
      this.railway(); this.saltPans();
      this.shrine(P.monsoon_shrine, true);
      this.shrine({ x: P.karimulam.x + 60, z: P.karimulam.z - 40 });
      this.shrine({ x: P.puliyur.x - 50, z: P.puliyur.z + 30 });
      // godowns at the ghat and harbours
      for (const [px, pz] of [[P.river_ghat.x - 60, P.river_ghat.z - 30], [P.veliyathura.x + 70, P.veliyathura.z + 20], [P.southern_ferry.x + 30, P.southern_ferry.z - 40]]) {
        const [x, z] = this.findLand(px, pz, 1.2, 160); this.godown(x, z, this.faceRoad(x, z));
      }
      // jetties
      for (const pl of [P.muthalappuzha, P.veliyathura, P.kayalore, P.southern_ferry, P.kalliyar_ferry, P.karimulam]) {
        const [x, z] = this.findLand(pl.x, pl.z, 1.0, 200);
        this.jettyOut(x, z, 24);
        this.namedJetty[pl.id] = this.jetties[this.jetties.length - 1];
      }
      // Kalliyar: a landing on the south bank too
      { const [x, z] = this.findLand(P.kalliyar_ferry.x - 20, P.kalliyar_ferry.z + 160, 1.0, 200); this.jettyOut(x, z, 20); this.namedJetty.kalliyar_south = this.jetties[this.jetties.length - 1]; }
      // a crossing over the ferry channel south of the paddy, with a landing on each bank
      this.channelCrossing(toWorld(800, 868), 'southern_crossing');
    }, 0.9);
    const M = materials();
    this.meshes = this.kit.build(this.scene, M);
    Object.assign(this.scene.userData, { jetties: this.jetties, cannons: this.cannons, station: this.station, gardens: this.gardens, shopFronts: this.shopFronts, shoreSpots: this.shoreSpots, namedJetty: this.namedJetty, ferries: this.ferries });
    console.info('[vaikara] buildings', JSON.stringify(this.counts));
    progress?.(1);
  }

  update(dt) {
    for (const b of this.beams) b.rotation.y += dt * 0.9;
    const n = U.night.value;
    for (const l of this.lamps) l.intensity = n * 900;
    if (this.flag) {
      const p = this.flag.geometry.attributes.position;
      const t = G.time;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, Math.sin(t * 4 + x * 1.8) * 0.12 * x); }
      p.needsUpdate = true;
    }
  }
}
void PLACES; void float; void sin; void cos; void uniform; void positionLocal; void mix;
