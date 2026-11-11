// Assembles the whole world and its ambient life.
import * as THREE from 'three';
import { G, QUALITY } from './state.js';
import { initHeights, initRoads, getHeight, LOC, canalZ } from './heightfield.js';
import { buildTextures, TEX } from './textures.js';
import { buildStructures, SPOTS } from './structures.js';
import { buildTerrain, buildMapImage } from './terrain.js';
import { Env } from './env.js';
import { Water } from './water.js';
import { buildFlora } from './flora.js';
import { NPC } from './npc.js';
import { Horse, Boat } from './entities.js';
import { CAST, Quadruped, Elephant, Bird, makeVallam, makeKettuvallam } from './characters.js';
import { makeRng, TAU, damp, angleDamp } from './util.js';
import { groundAt } from './physics.js';

class Wanderer {
  constructor(scene, obj, x, z, radius, speed) {
    this.o = obj; this.pos = new THREE.Vector3(x, getHeight(x, z), z); this.home = this.pos.clone();
    this.radius = radius; this.walk = speed; this.yaw = Math.random() * TAU; this.wait = Math.random() * 8; this.t = null;
    obj.root.traverse((o) => o.layers.set(1));
    scene.add(obj.root);
    this.sync();
  }
  sync() { this.o.root.position.copy(this.pos); this.o.root.rotation.y = this.yaw; }
  update(dt, pp) {
    const d = Math.hypot(pp.x - this.pos.x, pp.z - this.pos.z);
    const vis = d < 220;
    this.o.root.visible = vis;
    if (!vis) return;
    this.o.speed = 0;
    if (this.radius > 0) {
      if (this.wait > 0) this.wait -= dt;
      else {
        if (!this.t) { const a = Math.random() * TAU, r = Math.random() * this.radius; this.t = [this.home.x + Math.cos(a) * r, this.home.z + Math.sin(a) * r]; }
        const dx = this.t[0] - this.pos.x, dz = this.t[1] - this.pos.z, l = Math.hypot(dx, dz);
        if (l < 0.6 || getHeight(this.t[0], this.t[1]) < 0.3) { this.t = null; this.wait = 4 + Math.random() * 12; }
        else {
          this.yaw = angleDamp(this.yaw, Math.atan2(dx, dz), 1.5, dt);
          this.pos.x += Math.sin(this.yaw) * this.walk * dt; this.pos.z += Math.cos(this.yaw) * this.walk * dt;
          this.pos.y = damp(this.pos.y, getHeight(this.pos.x, this.pos.z), 8, dt);
          this.o.speed = this.walk;
        }
      }
    }
    this.o.update(dt);
    this.sync();
  }
}

function buildLamps(scene, lamps) {
  const pos = new Float32Array(lamps.length * 3);
  lamps.forEach((l, i) => pos.set([l.x, l.y, l.z], i * 3));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ map: TEX.glow, size: 2.6, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false; pts.layers.set(1);
  scene.add(pts);
  const strong = lamps.filter((l) => l.light);
  const n = G.quality === 'low' ? 2 : G.quality === 'medium' ? 4 : 6;
  const pool = [];
  for (let i = 0; i < n; i++) { const pl = new THREE.PointLight(0xffa350, 0, 26, 1.6); scene.add(pl); pool.push(pl); }
  let timer = 0;
  G.updaters.push((dt, t) => {
    const night = G.env.night, k = Math.max(night, G.env.rain * 0.5);
    mat.color.setRGB(2.4 * k, 1.5 * k, 0.55 * k);
    pts.visible = k > 0.03;
    timer -= dt;
    if (timer <= 0) {
      timer = 0.7;
      const pp = G.player.worldPos();
      strong.forEach((l) => { l.d = (l.x - pp.x) ** 2 + (l.z - pp.z) ** 2; });
      strong.sort((a, b) => a.d - b.d);
      pool.forEach((pl, i) => { const l = strong[i]; if (l) { pl.position.set(l.x, l.y, l.z); pl.userData.on = l.d < 140 * 140; } });
    }
    pool.forEach((pl, i) => { pl.intensity = pl.userData.on ? k * (34 + Math.sin(t * 9 + i * 2.1) * 3 + Math.sin(t * 23 + i) * 2) : 0; });
  });
}

const BARKS = {
  village: [
    'The monsoon came eleven days early. The old men say that means a fat pepper crop — or a flood.',
    'They say in Bengal people are burning English cloth in the streets. Swadeshi, they call it.',
    'Finch sahib\'s peons were at the toddy shop again, counting other men\'s coconut palms.',
    'If you go up into the hills, mind the elephants. They come down for the jackfruit.',
    'His Highness has opened an assembly at Trivandrum where even a farmer may speak. Imagine that.',
    'Namaskaram, Madhava. Your mother would have been glad to see this day.',
  ],
  tea: ['Chaya? One chuckram. For a man home from Bombay, the first glass is free.', 'Sit, sit. A boatman\'s son should not stand like a stranger in his own village.'],
  well: ['Devaki reads English better than the Company clerk. That is what frightens them.', 'The well is sweet again now the rains have come.'],
  paddy: ['The seedlings must be in before the next rain. No time for talk, Madhava.', 'Six years away and you still walk like a boatman.'],
  port: [
    'Pepper, cardamom, ginger, turmeric! The ships at Alleppey are waiting!',
    'The Company pays in paper and collects in land.',
    'Karimeen, fresh from the kayal this morning!',
    'Mind your purse near the godown. And mind the peons more.',
  ],
  priest: ['The temple tank is full to the top step. A good omen.', 'Light a lamp at dusk, Madhava. Your family has kept that flame for two hundred years.'],
  hill: ['The Peishkar hears petitions at first light and not a minute after.', 'Tea in the hills, pepper in the foothills, rice in the low country. Travancore feeds half the world\'s kitchens.'],
};

export async function buildWorld(scene, progress) {
  await progress(0.05, 'Surveying the coast of Travancore…');
  initHeights(); initRoads();
  buildTextures();
  await progress(0.2, 'Raising the Western Ghats…');
  const st = buildStructures(scene);
  await progress(0.38, 'Flooding the paddy fields…');
  buildTerrain(scene, st.yards);
  const env = G.env = new Env(scene);
  const water = G.water = new Water(scene, env);
  await progress(0.55, 'Planting coconut groves…');
  buildFlora(scene, env, st.keepClear, st.bigTrees);
  await progress(0.78, 'Waking the village…');
  buildLamps(scene, st.lamps);

  const W = G.world = { SPOTS, env, water, animals: [], birds: [], boats: [], riders: [], cast: {}, mapMarks: st.marks };
  const rng = makeRng(8811);

  // ---- mounts
  W.boat = new Boat(scene, SPOTS.villageBoat.x, SPOTS.villageBoat.z, -Math.PI / 2);
  W.boat.usable = false;
  W.horse = new Horse(scene, SPOTS.stableHorse.x, SPOTS.stableHorse.z, SPOTS.stableFace, { name: 'Sultan' });
  W.horse.usable = false;
  G.interactables.push({ pos: W.boat.pos, r: 3.6, label: 'Board the vallam', cond: () => W.boat.usable && G.player.mode === 'foot', action: () => G.player.mountBoat(W.boat) });
  G.interactables.push({ pos: W.horse.pos, r: 2.8, label: 'Mount the horse', cond: () => W.horse.usable && G.player.mode === 'foot', action: () => G.player.mountHorse(W.horse) });

  // ---- decorative boats
  const moor = (x, z, yaw) => { const v = makeVallam(); v.root.position.set(x, 0.03, z); v.root.rotation.y = yaw; scene.add(v.root); return v; };
  moor(SPOTS.villageBoat.x + 4, SPOTS.villageBoat.z - 5.4, -1.3);
  moor(SPOTS.portBoat.x - 7.6, SPOTS.portBoat.z - 4, 0.2); moor(SPOTS.portBoat.x - 8.2, SPOTS.portBoat.z + 3, -0.15);
  for (let i = 0; i < 2; i++) {
    const k = makeKettuvallam(); scene.add(k);
    W.boats.push({ root: k, a: i * Math.PI + 0.6, cx: -400 + i * 20, cz: 60 - i * 30, rx: 120 - i * 35, rz: 230 - i * 50, sp: 0.012 + i * 0.004 });
  }
  const km = makeKettuvallam(); km.position.set(SPOTS.portBoat.x + 12, 0, SPOTS.portBoat.z - 2); km.rotation.y = 0.1; scene.add(km);

  // ---- animals
  const ele = new Elephant({ caparison: true });
  W.animals.push(new Wanderer(scene, ele, SPOTS.elephant.x, SPOTS.elephant.z, 0, 0));
  W.animals[0].yaw = Math.PI / 2; W.animals[0].sync();
  for (let i = 0; i < 3; i++) W.animals.push(new Wanderer(scene, new Elephant({ scale: i === 2 ? 0.6 : 0.95 + i * 0.08 }), 262 + i * 9, 52 + i * 7, 40, 0.8));
  const cowAt = (x, z, r, o) => W.animals.push(new Wanderer(scene, new Quadruped('cow', { graze: true, ...o }), x, z, r, 0.6));
  cowAt(SPOTS.cowShed.x, SPOTS.cowShed.z, 0, { hump: true });
  cowAt(-128, 108, 14, { color: 0x8a6a4a, dark: 0x4a3a2a }); cowAt(-118, 116, 14, {}); cowAt(140, 120, 16, { hump: true });
  cowAt(-56, 18, 0, { hump: true }); cowAt(-386, -376, 0, { hump: true, color: 0xb9b0a0 });
  const sh2 = new Quadruped('horse', { color: 0x8a6a48, dark: 0x3a2a1c });
  W.animals.push(new Wanderer(scene, sh2, SPOTS.stableHorse2.x, SPOTS.stableHorse2.z, 0, 0));
  W.animals[W.animals.length - 1].yaw = SPOTS.stableFace; W.animals[W.animals.length - 1].sync();
  for (let i = 0; i < 14; i++) {
    const b = new Bird(); scene.add(b.root);
    const lake = i >= 8;
    W.birds.push({ b, cx: lake ? -330 : 10 + (i % 3) * 30, cz: lake ? -150 + (i % 3) * 60 : 350 + (i % 2) * 40, r: 35 + rng() * 70, h: 9 + rng() * 16, a: rng() * TAU, sp: (0.1 + rng() * 0.08) * (rng() < 0.5 ? 1 : -1) });
  }

  // ---- named cast
  const C = W.cast;
  C.ammavan = new NPC(scene, 'Raman Ammavan', CAST.ammavan, SPOTS.ammavan.x, SPOTS.ammavan.z, Math.PI, { facePlayer: true, title: 'Ammavan', lines: ['The land remembers who tends it, Madhava.', 'Your grandfather planted these vines. I will not be the one to lose them.'] });
  C.devaki = new NPC(scene, 'Devaki', CAST.devaki, SPOTS.devaki.x, SPOTS.devaki.z, Math.PI, { facePlayer: true, lines: ['Numbers do not lie, chetta. Only the men who write them.', 'I taught myself from the mission school primers. Do not tell Ammavan how many I borrowed.'] });
  C.ouseph = new NPC(scene, 'Ouseph', CAST.ouseph, SPOTS.ouseph.x, SPOTS.ouseph.z, Math.PI / 2, { facePlayer: true, lines: ['Forty years on this water and she still surprises me.', 'The kayal gives fish to the patient and trouble to the proud.'] });
  C.moideen = new NPC(scene, 'Moideen Hajji', CAST.moideen, SPOTS.moideen.x, SPOTS.moideen.z, Math.PI / 2, { facePlayer: true, title: 'Moideen Hajji', lines: ['Tellicherry pepper, Alleppey green cardamom. The Arabs sailed here for these before Vasco da Gama was born.', 'An honest scale is the best advertisement.'] });
  C.peishkar = new NPC(scene, 'The Peishkar', CAST.peishkar, SPOTS.peishkar.x, SPOTS.peishkar.z, 0, { y: SPOTS.peishkar.y, facePlayer: true });
  C.finch = new NPC(scene, 'Mr. Finch', CAST.finch, SPOTS.finch.x, SPOTS.finch.z, Math.PI, { facePlayer: true });
  C.finch.setActive(false);
  C.guards = SPOTS.guards.map((g, i) => {
    const p = g.post || g.route[0];
    const n = new NPC(scene, 'Company peon', CAST.guard, p.x, p.z, g.face ?? 0, { guard: true, route: g.route, speed: 1.5 });
    n.setActive(false);
    return n;
  });
  C.toughs = [0, 1].map((i) => { const n = new NPC(scene, 'Company peon', CAST.guard, LOC.pepper.x - 60 - i * 3, LOC.pepper.z + 40, 0, { guard: true }); n.lantern.visible = false; n.setActive(false); return n; });

  // ---- villagers
  const VM = CAST.villagerM, VF = CAST.villagerF;
  const amb = (name, preset, x, z, yaw, o) => new NPC(scene, name, preset, x, z, yaw, o);
  amb('Tea-seller', VM[3], SPOTS.teaShop.x, SPOTS.teaShop.z, 2.2, { facePlayer: true, lines: BARKS.tea });
  amb('Villager', VM[2], SPOTS.teaShop.x - 2.2, SPOTS.teaShop.z - 2.6, 0.6, { pose: 'talk', lines: BARKS.village });
  amb('Villager', VM[4], SPOTS.teaShop.x - 3.4, SPOTS.teaShop.z - 1.2, 1.4, { lines: BARKS.village });
  amb('Woman at the well', VF[0], -31.6, -6.4, 1.2, { lines: BARKS.well, pose: 'talk' });
  amb('Woman at the well', VF[1], -28.6, -9.4, -2, { lines: BARKS.well });
  amb('Villager', VM[0], -100, 26, 1, { route: [new THREE.Vector3(-150, 0, 33), new THREE.Vector3(-95, 0, 22), new THREE.Vector3(-42, 0, 11), new THREE.Vector3(18, 0, 1), new THREE.Vector3(-42, 0, 11), new THREE.Vector3(-95, 0, 22)], lines: BARKS.village });
  amb('Villager', VF[2], 30, -2, 1, { route: [new THREE.Vector3(66, 0, -11), new THREE.Vector3(20, 0, 0), new THREE.Vector3(-38, 0, 9), new THREE.Vector3(-33, 0, 76), new THREE.Vector3(-38, 0, 9), new THREE.Vector3(20, 0, 0)], lines: BARKS.village, speed: 1.2 });
  amb('Priest', { skin: 0x8d5b3c, mundu: 0xf2ecdc, munduLong: true, kasavu: true, grey: true, shoulderCloth: 0xf2ecdc }, SPOTS.templeGate.x, SPOTS.templeGate.z + 2, Math.PI / 2, { facePlayer: true, lines: BARKS.priest });
  for (let i = 0; i < 6; i++) {
    const x = -100 + i * 34 + rng() * 10, z = 250 + rng() * 60 + (i % 2) * 70;
    amb('Farmhand', i % 2 ? VF[i % 3] : VM[i % 5], x, z, rng() * TAU, { pose: 'work', lines: BARKS.paddy });
  }
  amb('Farmhand', VM[1], LOC.pepper.x - 4, LOC.pepper.z + 9, 2, { pose: 'work', lines: ['The vines are heavy this year. Black gold, the traders call it.'] });
  // port folk
  const pj = LOC.portJetty.z;
  amb('Spice-seller', VM[3], -372, -390.6, 0, { facePlayer: true, lines: BARKS.port });
  amb('Spice-seller', VF[2], -423, -390.2, 0, { facePlayer: true, lines: BARKS.port });
  amb('Fishmonger', VM[1], -391, -372, Math.PI / 2, { facePlayer: true, lines: BARKS.port });
  amb('Porter', VM[0], -400, -360, 0, { route: [new THREE.Vector3(-400, 0, pj + 8), new THREE.Vector3(-400, 0, -376), new THREE.Vector3(-409, 0, -357), new THREE.Vector3(-400, 0, -376)], lines: BARKS.port, speed: 1.5 });
  amb('Townsman', VM[4], -390, -383, 1, { route: [new THREE.Vector3(-350, 0, -390), new THREE.Vector3(-400, 0, -382), new THREE.Vector3(-445, 0, -385), new THREE.Vector3(-400, 0, -382)], lines: BARKS.port });
  amb('Townswoman', VF[0], -428.5, -373.2, 0.4, { lines: BARKS.port, pose: 'talk' });
  amb('Boatman', VM[2], -401.2, pj + 14, 0, { facePlayer: true, lines: ['Storm or no storm, the kettuvallams sail for Alleppey at dawn.'] });
  amb('Court clerk', { ...VM[3], headgear: 'turban', gearColor: 0xe9d9a8 }, SPOTS.cutcherryYard.x - 7, SPOTS.cutcherryYard.z - 4, 0.5, { facePlayer: true, lines: BARKS.hill });
  amb('Petitioner', VM[4], SPOTS.cutcherryYard.x + 6, SPOTS.cutcherryYard.z - 2, -0.6, { lines: BARKS.hill });

  await progress(0.92, 'Inking the survey map…');
  W.mapImage = buildMapImage(st.marks);

  // ---- per-frame ambient update
  G.updaters.push((dt, t) => {
    const pp = G.player.worldPos();
    for (const a of W.animals) a.update(dt, pp);
    for (const b of W.birds) {
      b.a += b.sp * dt;
      const x = b.cx + Math.cos(b.a) * b.r, z = b.cz + Math.sin(b.a) * b.r * 0.7;
      b.b.root.position.set(x, b.h + Math.sin(b.a * 3) * 1.5, z);
      b.b.root.rotation.y = Math.atan2(-Math.sin(b.a) * Math.sign(b.sp), Math.cos(b.a) * 0.7 * Math.sign(b.sp));
      b.b.root.visible = G.env.night < 0.6;
      b.b.update(dt);
    }
    for (const k of W.boats) {
      k.a += k.sp * dt;
      const x = k.cx + Math.cos(k.a) * k.rx, z = k.cz + Math.sin(k.a) * k.rz;
      k.root.position.set(x, Math.sin(t * 0.8 + k.a) * 0.03, z);
      k.root.rotation.y = Math.atan2(-Math.sin(k.a) * k.rx, Math.cos(k.a) * k.rz);
    }
    W.boat.update(dt); W.horse.update(dt);
    for (const r of W.riders) r.update(dt);
  });
  return W;
}
