// Life on the roads. A small pool of travellers — bullock carts, a horse carriage, riders, people on
// foot, boatmen on the canal — is placed on the road network around wherever the player is and
// taken away again once far behind, so every road feels used without the whole map being simulated.
// They keep to the left, follow one road into the next at junctions, queue behind what is slower,
// stop for anyone in the way and say so, and shy when a horse comes past at a gallop.
import * as THREE from 'three';
import { G } from './state.js';
import { ROADS, CANAL, getHeight } from './heightfield.js';
import { ROAD_W } from './terrain.js';
import { groundAt } from './physics.js';
import { Human, CAST, SKIN } from './human.js';
import { Quadruped, makeVallam, makePaddle } from './characters.js';
import { makeCart, makeJutka } from './structures.js';
import { damp, angleDamp, clamp } from './util.js';

// ---------------------------------------------------------------- the network
const NET = {};
function line(key, pts, w) {
  const len = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { key, pts, len, total: len[len.length - 1], w, ends: [[], []] };
}
function buildNet() {
  for (const k in ROADS) NET[k] = line(k, ROADS[k], ROAD_W[k] || 3.4);
  // where a road ends on (or beside) another, travellers may carry on along that one
  for (const a in NET) for (const e of [0, 1]) {
    const A = NET[a], p = A.pts[e ? A.pts.length - 1 : 0];
    for (const b in NET) {
      if (a === b) continue;
      const B = NET[b]; let bi = -1, bd = 9;
      for (let i = 0; i < B.pts.length; i++) { const d = Math.hypot(B.pts[i][0] - p[0], B.pts[i][1] - p[1]); if (d < bd) { bd = d; bi = i; } }
      if (bi >= 0) A.ends[e].push({ r: B, s: B.len[bi] });
    }
  }
}
const _p = { x: 0, z: 0, tx: 0, tz: 1 };
function sample(r, s) {
  const L = r.len; let i = 1;
  while (i < L.length - 1 && L[i] < s) i++;
  const a = r.pts[i - 1], b = r.pts[i], seg = Math.max(1e-6, L[i] - L[i - 1]), k = clamp((s - L[i - 1]) / seg, 0, 1);
  _p.x = a[0] + (b[0] - a[0]) * k; _p.z = a[1] + (b[1] - a[1]) * k; _p.tx = (b[0] - a[0]) / seg; _p.tz = (b[1] - a[1]) / seg;
  return _p;
}

const SAY = {
  cart: ['Aside, aside! The oxen have no brakes!', 'Madhava, you will be flat as an appam. Move!', 'Hoy! This load is for the Alleppey boat, and the boat will not wait.'],
  jutka: ['Make way! Make way for the jutka!', 'Stand clear, the mare is nervous!'],
  rider: ['Out of the road, man!', 'Mind yourself!'],
  walker: ['Namaskaram, Madhava.', 'Back from Bombay, and still walking? Buy a horse.', 'They say the bazaar has Balaramapuram cloth this week.', 'Rain before evening. My knee says so.', 'Going far?', 'Is it true about the Company and the pepper lands?'],
  scare: ['Aiyo! Is this a road or a racecourse?', 'Slow down! There are children on this road!', 'Ente Deivame — he rides like the Company owns him!'],
};
let barkT = 0;
const bark = (name, set, preset) => { if (barkT > 0 || G.story?.busy || G.ui.subResolve) return; barkT = 9; G.ui.bark(name, SAY[set][(Math.random() * SAY[set].length) | 0], 3.6, preset); };

// ---------------------------------------------------------------- one traveller
const WIDE = ['main', 'north', 'hill', 'south', 'quay', 'coast', 'bar', 'estate'];
const ANY = [...WIDE, 'home', 'temple', 'towpath', 'hamlet', 'laneE', 'laneS', 'laneW'];
class Traveller {
  constructor(scene, kind, o) {
    this.kind = kind; this.name = o.name; this.roads = o.roads; this.max = o.speed; this.half = o.half; this.reach = o.reach; this.lane = o.lane; this.turn = o.turn; this.far = o.far || 150;
    this.root = new THREE.Group(); this.root.visible = false; scene.add(this.root);
    this.pos = new THREE.Vector3(); this.yaw = 0; this.active = false; this.speed = 0; this.s = 0; this.dir = 1; this.lat = 0; this.fx = 0; this.fz = 0;
    this.wait = 0; this.blockT = 0; this.ignoreT = 0; this.scareT = 0; this.r = null;
  }
  finish() { this.root.traverse((ob) => ob.layers.set(1)); }
  keep(r) { return clamp(r.w * this.lane, 0, Math.max(0, r.w / 2 - this.half * 0.6)); }
  spawn(r, s, dir) {
    this.r = r; this.s = s; this.dir = dir; this.lat = this.keep(r) * dir; this.fx = this.fz = 0; this.speed = this.max * 0.8; this.wait = 0; this.blockT = 0;
    const p = sample(r, s);
    this.yaw = Math.atan2(p.tx * dir, p.tz * dir);
    this.pos.set(p.x + p.tz * this.lat, 0, p.z - p.tx * this.lat); this.pos.y = this.ground();
    this.active = true; this.root.visible = true; this.sync();
  }
  despawn() { this.active = false; this.root.visible = false; }
  ground() { return groundAt(this.pos.x, this.pos.z, this.pos.y + 0.7); }
  sync() { this.root.position.copy(this.pos); this.root.rotation.y = this.yaw; }
  shade(d) { const on = d < (G.shadowPeople || 30) + 10; if (this.shadowOn !== on) { this.shadowOn = on; this.root.traverse((m) => { if (m.isMesh) m.castShadow = on; }); } }
  // the end of this road: carry on along one that meets it, or turn back
  arrive() {
    const r = this.r, end = this.s >= r.total ? 1 : 0;
    this.s = clamp(this.s, 0, r.total);
    const opts = r.ends[end].filter((l) => this.roads.includes(l.r.key));
    if (opts.length && Math.random() < 0.85) {
      const l = opts[(Math.random() * opts.length) | 0];
      this.r = l.r; this.s = l.s;
      this.dir = l.s < 6 ? 1 : l.s > l.r.total - 6 ? -1 : Math.random() < 0.5 ? 1 : -1;
      this.lat = this.keep(l.r) * this.dir;
      const p = sample(l.r, l.s);
      this.fx = this.pos.x - (p.x + p.tz * this.lat); this.fz = this.pos.z - (p.z - p.tx * this.lat);      // no jump: the difference is walked off
      this.speed *= 0.6;
    } else { this.dir *= -1; this.wait = this.turn[0] + Math.random() * this.turn[1]; this.speed = 0; }
  }
  // who is in the way?
  blocked(pp, all) {
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const ahead = (x, z, pad, more = 0) => { const dx = x - this.pos.x, dz = z - this.pos.z, f = dx * fx + dz * fz; return f > 0.3 && f < this.reach + more && Math.abs(dx * fz - dz * fx) < this.half + pad; };
    if (ahead(pp.x, pp.z, 0.45)) return 'player';
    for (const t of all) {
      if (t === this || !t.active || t.kind === 'boat' || (this.kind === 'walker' && t.kind !== 'walker')) continue;
      if (Math.abs(t.pos.x - this.pos.x) > 12 || Math.abs(t.pos.z - this.pos.z) > 12) continue;
      if (Math.sin(t.yaw) * fx + Math.cos(t.yaw) * fz < 0.3) continue;          // oncoming traffic is in its own lane
      if (ahead(t.pos.x, t.pos.z, t.half * 0.7, t.reach * 0.4)) return t;
    }
    if (this.kind !== 'walker' && this.ignoreT <= 0) for (const n of G.npcs) {
      if (!n.active || !n.root.visible || Math.abs(n.pos.x - this.pos.x) > 7 || Math.abs(n.pos.z - this.pos.z) > 7) continue;
      if (ahead(n.pos.x, n.pos.z, 0.3)) return 'npc';
    }
    return null;
  }
  move(dt, pp, all) {
    const b = this.blocked(pp, all);
    let target = this.max;
    if (this.wait > 0) { this.wait -= dt; target = 0; }
    this.ignoreT -= dt;
    if (b) {
      target = typeof b === 'object' ? Math.min(target, b.speed * 0.9) : 0;
      this.blockT += dt;
      if (b === 'player' && this.blockT > 2.2) { bark(this.name, this.kind === 'walker' ? 'walker' : this.kind, this.h?.preset || this.crew?.[0]?.preset); this.blockT = -6; }
      if (b === 'npc' && this.blockT > 5) { this.ignoreT = 7; this.blockT = 0; }      // a man who will not move: go round him
    } else this.blockT = Math.min(0, this.blockT + dt);
    if (this.scareT > 0) { this.scareT -= dt; target = 0; }
    this.speed = damp(this.speed, target, target < this.speed ? 4.5 : 1.3, dt);
    const ds = this.speed * dt, r0 = this.r;
    this.s += ds * this.dir;
    if (this.s >= r0.total || this.s <= 0) this.arrive();
    const r = this.r, p = sample(r, this.s);
    this.lat = damp(this.lat, this.keep(r) * this.dir, 0.8, dt);
    const fade = Math.exp(-0.75 * dt); this.fx *= fade; this.fz *= fade;
    const nx = p.x + p.tz * this.lat + this.fx, nz = p.z - p.tx * this.lat + this.fz;
    // a road that runs into the water is the end of the road
    if (this.kind !== 'boat' && getHeight(nx, nz) < -0.3 && groundAt(nx, nz, this.pos.y + 0.7) < -0.2) { this.s -= ds * this.dir; this.dir *= -1; this.wait = 2; return 0; }
    this.pos.x = nx; this.pos.z = nz;
    this.yaw = angleDamp(this.yaw, Math.atan2(p.tx * this.dir, p.tz * this.dir), this.kind === 'walker' ? 5 : 1.7, dt);
    return ds;
  }
  // people on foot are shouldered aside by anything on wheels
  push(pl, ox, oz, rad) {
    const dx = pl.pos.x - ox, dz = pl.pos.z - oz, d = Math.hypot(dx, dz);
    if (d < rad && d > 1e-3) { pl.pos.x = ox + dx / d * rad; pl.pos.z = oz + dz / d * rad; }
  }
}

// ---- a wheeled thing behind draught animals, with a driver (and perhaps a passenger)
class Wagon extends Traveller {
  constructor(scene, mats, o) {
    super(scene, o.kind, o);
    const c = o.kind === 'cart' ? makeCart(mats, o.load) : makeJutka(mats);
    this.wheels = c.wheels; this.wheelR = c.wheelR; this.root.add(c.root);
    this.team = o.team.map(([x, z, q]) => { q.root.position.set(x, 0, z); this.root.add(q.root); return q; });
    this.crew = o.crew.map(([x, y, z, look]) => { const h = new Human(look); h.root.position.set(x, y, z); h.state = 'bench'; this.root.add(h.root); return h; });
    this.len = o.len;
    this.finish();
  }
  update(dt, pp, all, d) {
    const ds = this.move(dt, pp, all);
    this.pos.y = damp(this.pos.y, this.ground(), 6, dt);
    this.sync();
    for (const w of this.wheels) w.rotation.x += ds / this.wheelR;
    if (d < 95) {
      for (const q of this.team) { q.speed = this.speed; q.update(dt); }
      for (const h of this.crew) { h.speed = 0; h.lod = d > 25 ? 1 : 0; h.near = d < 8; h.tick(dt, d); }
    }
    const pl = G.player;
    if (pl.mode === 'foot' && d < 7) {
      const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
      this.push(pl, this.pos.x, this.pos.z, 1.3); this.push(pl, this.pos.x + fx * this.len, this.pos.z + fz * this.len, 1.05);
    }
  }
}
class Horseman extends Traveller {
  constructor(scene, o) {
    super(scene, 'rider', o);
    this.q = new Quadruped('horse', { saddle: true, color: o.coat, dark: o.dark });
    this.h = new Human(o.look);
    this.q.body.add(this.h.root); this.h.root.position.set(0, this.q.seatY - this.q.baseY, -0.06); this.h.state = 'ride'; this.h.mountQ = this.q;
    this.root.add(this.q.root);
    this.finish();
  }
  update(dt, pp, all, d) {
    this.move(dt, pp, all);
    this.pos.y = damp(this.pos.y, this.ground(), 10, dt);
    this.sync();
    if (d < 110) { this.q.speed = this.speed; this.q.update(dt); this.h.speed = this.speed; this.h.lod = d > 25 ? 1 : 0; this.h.near = d < 8; this.h.tick(dt, d); }
    const pl = G.player;
    if (pl.mode === 'foot' && d < 4) this.push(pl, this.pos.x, this.pos.z, 0.95);
  }
}
class Walker extends Traveller {
  constructor(scene, o) {
    super(scene, 'walker', o);
    this.h = new Human(o.look);
    if (o.headLoad) this.h.setHeadLoad(true);
    this.umbrellaOK = !o.headLoad;
    this.root.add(this.h.root);
    this.gaze = { x: 0, y: 0, z: 0 }; this.metT = 0;
    this.finish();
  }
  update(dt, pp, all, d) {
    this.move(dt, pp, all);
    this.pos.y = damp(this.pos.y, this.ground(), 14, dt);
    this.sync();
    if (d > 125) return;
    const h = this.h, pl = G.player;
    if (this.umbrellaOK) { const want = G.env.rain > 0.3; if (want !== !!h.umbrella) { h.setUmbrella(want); h.umb?.traverse((ob) => ob.layers.set(1)); } }
    // a horse at the gallop, close by: flinch from it, and say what you think of it
    if (d < 3.4 && pl.speedNow > 7 && this.scareT <= 0) { this.scareT = 1.6; h.flinch(pp.x, pp.z, 1.3); bark(this.name, 'scare', h.preset); }
    this.metT -= dt;
    if (d < 3 && pl.speedNow < 5 && this.metT <= 0 && Math.random() < dt * 0.5) { this.metT = 40; bark(this.name, 'walker', h.preset); }
    h.state = this.scareT > 0 ? 'cower' : this.speed > 0.2 ? 'move' : 'idle'; h.speed = this.speed;
    h.lod = d > 25 ? 1 : 0; h.near = d < 8;
    h.setWorld(this.pos.x, this.pos.y, this.pos.z, this.yaw);
    if (d < 6.5) { this.gaze.x = pp.x; this.gaze.y = pp.y + 1.55; this.gaze.z = pp.z; h.gaze = this.gaze; } else h.gaze = null;
    h.tick(dt, d);
  }
}
class CanalBoat extends Traveller {
  constructor(scene, o) {
    super(scene, 'boat', o);
    const v = makeVallam();
    this.root.add(v.root);
    this.h = new Human(o.look); this.h.root.position.set(0, -0.2, -1.75); this.h.state = 'paddle'; this.h.rowRate = 3.4;
    v.root.add(this.h.root);
    this.h.hold(makePaddle()); this.h.grip = true;
    if (v.cargo) v.cargo.visible = !!o.cargo;
    this.t = Math.random() * 9;
    this.finish();
  }
  ground() { return 0.03; }
  update(dt, pp, all, d) {
    this.t += dt;
    this.move(dt, pp, all);
    this.root.position.set(this.pos.x, 0.03 + Math.sin(this.t * 1.3) * 0.025, this.pos.z);
    this.root.rotation.set(Math.sin(this.t * 0.9) * 0.015, this.yaw, Math.sin(this.t * 1.1) * 0.02, 'YXZ');
    if (d < 110) { this.h.state = this.speed > 0.3 ? 'paddle' : 'boat'; this.h.lod = d > 25 ? 1 : 0; this.h.tick(dt, d); }
  }
}

// ---------------------------------------------------------------- the pool, and who is on the road now
export function setupTraffic(scene, W, mats) {
  buildNet();
  const canal = line('canal', CANAL, 3);
  const VM = CAST.villagerM, VF = CAST.villagerF;
  const n = { low: [2, 0, 1, 4, 1], medium: [3, 1, 1, 6, 1], high: [4, 1, 2, 8, 2], ultra: [4, 1, 2, 9, 2] }[G.quality] || [3, 1, 1, 6, 1];
  const list = [];
  const ox = (i) => new Quadruped('cow', { hump: true, color: [0xe4ddcf, 0xcdc3b0, 0xb8ab94, 0xd9d2c4][i % 4] });
  for (let i = 0; i < n[0]; i++) {
    list.push(new Wagon(scene, mats, { kind: 'cart', name: 'Cart driver', roads: WIDE, speed: 1.05 + (i % 3) * 0.08, half: 1.0, reach: 6, lane: 0.25, turn: [8, 10], len: 2.4, load: (i + 1) % 4, far: 190,
      team: [[-0.55, 2.42, ox(i)], [0.55, 2.42, ox(i + 1)]], crew: [[0.12, 0.13, 1.0, { ...VM[[1, 5, 6, 0][i % 4]], headgear: 'thorthu', gearColor: [0xe8e0cc, 0xb8402c, 0x4a6a4a, 0xd8d0b8][i % 4] }]] }));
  }
  for (let i = 0; i < n[1]; i++) {
    list.push(new Wagon(scene, mats, { kind: 'jutka', name: 'Jutka driver', roads: WIDE, speed: 2.7, half: 0.9, reach: 7.5, lane: 0.24, turn: [5, 6], len: 2.3, far: 190,
      team: [[0, 2.35, new Quadruped('horse', { color: 0x6a4a30, dark: 0x1c120c })]],
      crew: [[-0.18, 0.34, 0.5, { ...VM[3], headgear: 'turban', gearColor: 0xd8c8a0 }], [0.14, 0.34, -0.5, { ...CAST.villagerM[5], headgear: 'turban', gearColor: 0xeee4c8, shoulderCloth: 0xe6dfcb }]] }));
  }
  const riders = [{ ...VM[5], headgear: 'turban', gearColor: 0x8a2a20 }, { ...CAST.guard }];
  for (let i = 0; i < n[2]; i++) list.push(new Horseman(scene, { name: i ? 'Company peon' : 'Rider', roads: WIDE, speed: 3.1 + i * 0.5, half: 0.6, reach: 6, lane: 0.2, turn: [3, 4], look: riders[i % 2], coat: i ? 0x2a1d16 : 0x7a5434, dark: 0x120c08, far: 180 }));
  for (let i = 0; i < n[3]; i++) {
    const fem = i % 3 === 1, look = fem ? VF[(i >> 1) % VF.length] : { ...VM[(i * 2 + 1) % VM.length], skin: SKIN[(i * 5) % SKIN.length] };
    list.push(new Walker(scene, { name: fem ? 'Village woman' : 'Villager', roads: ANY, speed: 1.2 + (i % 4) * 0.08, half: 0.35, reach: 1.5, lane: 0.42, turn: [2, 5], look, headLoad: i % 3 !== 0 }));
  }
  for (let i = 0; i < n[4]; i++) list.push(new CanalBoat(scene, { name: 'Boatman', roads: ['canal'], speed: 1.7, half: 0.6, reach: 7, lane: 0.3, turn: [6, 8], look: CAST.oarsman[i % 2], cargo: i % 2 === 0, far: 190 }));
  W.traffic = list;

  const tmp = new THREE.Vector3(), fwd = new THREE.Vector3();
  let tick = 0, last = null;
  const place = (t, pp, warm) => {
    const cands = [];
    for (const key of t.roads) {
      const r = key === 'canal' ? canal : NET[key]; if (!r) continue;
      for (let i = 1; i < r.pts.length - 1; i += 2) {
        const x = r.pts[i][0], z = r.pts[i][1], dx = x - pp.x, dz = z - pp.z, d = Math.hypot(dx, dz);
        if (d > t.far || d < (warm ? 28 : 46)) continue;
        // not where it would be seen arriving out of thin air
        if (!warm && d < 105 && (dx * fwd.x + dz * fwd.z) / d > 0.2) continue;
        if (key !== 'canal' && getHeight(x, z) < 0.15) continue;
        cands.push(r, i);
      }
    }
    for (let tries = 0; tries < 4 && cands.length; tries++) {
      const k = ((Math.random() * cands.length / 2) | 0) * 2, r = cands[k], i = cands[k + 1], x = r.pts[i][0], z = r.pts[i][1];
      if (list.some((o) => o.active && Math.hypot(o.pos.x - x, o.pos.z - z) < 16)) continue;
      // mostly headed toward the player, so the road ahead keeps bringing people
      const toward = (pp.x - x) * (r.pts[i + 1][0] - x) + (pp.z - z) * (r.pts[i + 1][1] - z) > 0 ? 1 : -1;
      t.spawn(r, r.len[i], Math.random() < 0.7 ? toward : -toward);
      return true;
    }
    return false;
  };
  G.updaters.push((dt) => {
    const pp = G.player.worldPos(tmp);
    barkT -= dt;
    tick -= dt;
    if (tick <= 0) {
      tick = 0.5;
      G.camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
      const jumped = !last || Math.hypot(pp.x - last.x, pp.z - last.z) > 45;       // a ferry, a mission start: people the roads at once
      last = last || new THREE.Vector3(); last.copy(pp);
      for (const t of list) if (t.active && Math.hypot(t.pos.x - pp.x, t.pos.z - pp.z) > t.far + 45) t.despawn();
      let placed = 0;
      for (const t of list) { if (t.active) continue; if (place(t, pp, jumped)) placed++; if (!jumped && placed) break; }
    }
    for (const t of list) if (t.active) { const d = Math.hypot(t.pos.x - pp.x, t.pos.z - pp.z); t.update(dt, pp, list, d); t.shade(d); }
  });
}
