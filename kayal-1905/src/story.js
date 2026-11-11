// The five chapters of KAYAL, written as cancellable async scripts.
import * as THREE from 'three';
import { G } from './state.js';
import { SPOTS } from './structures.js';
import { LOC, getHeight } from './heightfield.js';
import { groundAt } from './physics.js';
import { Rider } from './npc.js';
import { TEX } from './textures.js';
import { lerp, smoothstep } from './util.js';

const CANCEL = Symbol('cancel');
const SAVE_KEY = 'kayal1905.save';
export const CHAPTER_NAMES = ['Homecoming', 'Black Gold', 'The Backwater Run', 'The Red Ledger', 'Ride for the Cutcherry', 'Free Roam'];
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

export function loadSave() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); return s && typeof s.chapter === 'number' ? s : null; } catch (e) { return null; }
}

export class Story {
  constructor() {
    this.chapter = 0; this.tk = null; this.waiters = []; this.temps = [];
    this.busy = false; this.invulnerable = false; this.failing = false; this.continuing = false;
    this.tag = ''; this.onKO = null; this.onAlert = null;
  }
  save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ chapter: this.chapter })); } catch (e) { /* storage unavailable */ } }

  cancel() {
    if (this.tk) this.tk.cancelled = true;
    this.waiters.length = 0;
    G.ui.cancelSay();
    for (const t of this.temps) t.dispose?.();
    this.temps.length = 0;
    this.onKO = null; this.onAlert = null;
  }

  resetWorld() {
    const W = G.world, C = W.cast, p = G.player, env = G.env;
    for (const r of W.riders) r.dispose();
    W.riders.length = 0;
    for (const g of [...C.guards, ...C.toughs]) { g.reset(); g.perceive = false; g.showCone = false; g.setActive(false); }
    C.finch.setActive(false); C.finch.goal = null;
    env.frozen = false; env.dayRate = 1 / 55;
    p.locked = false; p.health = 100; p.stamina = 100; p.h.state = 'idle'; p.setCine(null); p.gallopMax = 12.6;
    this.busy = false; this.invulnerable = false;
    G.ui.letterbox(false); G.ui.setHud(!p.photo); G.ui.setMarker(null); G.ui.hideDead();
    W.boat.cargo.visible = false;
  }

  async run(ch, continuing = false) {
    this.cancel();
    const tk = this.tk = { cancelled: false };
    this.chapter = ch; this.continuing = continuing;
    this.save();
    if (!continuing) this.resetWorld();
    try {
      await CHAPTERS[ch](this, this.api(tk), G.world, G.player, G.env);
      if (!tk.cancelled && ch + 1 < CHAPTERS.length) this.run(ch + 1, true);
    } catch (e) {
      if (e !== CANCEL) console.error(e);
    }
  }

  fail(msg) {
    if (this.failing) return;
    this.failing = true;
    const ch = this.chapter;
    this.cancel();
    G.player.locked = true;
    G.ui.showDead(msg);
    G.audio?.setMood('none');
    setTimeout(async () => {
      await G.ui.fade(1, 0.9);
      this.failing = false;
      this.run(ch, false);
    }, 2400);
  }

  update(dt) {
    for (let i = this.waiters.length - 1; i >= 0; i--) {
      const w = this.waiters[i];
      if (!w) continue;
      if (w.tk.cancelled) { this.waiters.splice(i, 1); continue; }
      if (w.fn(dt)) { this.waiters.splice(i, 1); w.res(); }
    }
  }

  api(tk) {
    const S = this, ui = G.ui, p = G.player;
    const chk = () => { if (tk.cancelled) throw CANCEL; };
    const until = (fn) => new Promise((res) => S.waiters.push({ fn, res, tk })).then(chk);
    const wait = (s) => { let t = 0; return until((dt) => (t += dt) >= s); };
    const fade = async (to, d) => { await ui.fade(to, d); chk(); };
    const card = async (...a) => { await ui.card(...a); chk(); };
    const obj = (text, pos = null) => { ui.setObjective(S.tag, text); ui.setMarker(pos); };
    const dist = (pos) => { const w = p.worldPos(); return Math.hypot(w.x - pos.x, w.z - pos.z); };
    const reach = (pos, r, mode) => until(() => dist(pos) < r && (!mode || p.mode === mode));
    const interact = (pos, r, label) => new Promise((res) => {
      const it = { pos, r, label, cond: () => p.mode === 'foot', action: () => { it.dispose(); res(); } };
      it.dispose = () => { const i = G.interactables.indexOf(it); if (i >= 0) G.interactables.splice(i, 1); };
      G.interactables.push(it); S.temps.push(it);
    }).then(chk);
    const narrate = async (text, d = 5.5) => { ui.bark('', text, d); await wait(d + 0.4); };
    const focus = (sp, li) => {
      // over-the-shoulder shot of the speaker
      const dx = sp.x - li.x, dz = sp.z - li.z, l = Math.hypot(dx, dz) || 1;
      const nx = dx / l, nz = dz / l;
      const pos = new THREE.Vector3(li.x - nx * 1.5 + nz * 0.85, 0, li.z - nz * 1.5 - nx * 0.85);
      pos.y = Math.max(li.y + 1.72, getHeight(pos.x, pos.z) + 0.6);
      p.setCine({ pos, look: new THREE.Vector3(sp.x, sp.y + 1.52, sp.z), fov: 38, blend: 0.9 });
    };
    // lines: [speaker, text] where speaker is 'M' or an NPC
    const dialog = async (lines, o = {}) => {
      chk();
      S.busy = true; p.locked = true; ui.letterbox(true); ui.prompt(null);
      let other = o.other || lines.find((l) => l[0] !== 'M')?.[0];
      for (const [who, text] of lines) {
        const me = p.worldPos();
        if (who === 'M') { if (other) focus(me, other.pos); await ui.say('Madhavan', text); }
        else { other = who; who.talkT = 6; focus(who.pos, me); await ui.say(who.name, text); }
        chk();
      }
      ui.letterbox(false); p.locked = false; S.busy = false; p.setCine(null);
    };
    const title = async (n) => {
      S.tag = n < 5 ? `CHAPTER ${ROMAN[n]} — ${CHAPTER_NAMES[n].toUpperCase()}` : 'FREE ROAM';
      G.audio?.sfx('chapter');
      if (n < 5) await card(`CHAPTER ${ROMAN[n]}`, CHAPTER_NAMES[n], '', 3.4);
    };
    return { chk, until, wait, fade, card, obj, dist, reach, interact, narrate, dialog, title, toast: (t, d) => ui.toast(t, d), bark: (n, t, d) => ui.bark(n, t, d) };
  }
}

function makePickup(scene, pos, kind = 'sack') {
  const g = new THREE.Group();
  if (kind === 'sack') {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), new THREE.MeshStandardMaterial({ map: TEX.sack, roughness: 1 }));
    m.scale.set(1.1, 0.8, 0.9); m.position.y = 0.3; m.castShadow = true; g.add(m);
    const k = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), new THREE.MeshStandardMaterial({ map: TEX.sack })); k.position.y = 0.66; g.add(k);
  } else {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.75, 0.6), new THREE.MeshStandardMaterial({ map: TEX.wood })); t.position.y = 0.375; t.castShadow = true; g.add(t);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.26), new THREE.MeshStandardMaterial({ color: 0x9a1a16, roughness: 0.5, emissive: 0x400806, emissiveIntensity: 0.8 })); b.position.y = 0.79; b.rotation.y = 0.3; g.add(b);
    g.userData.book = b;
  }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: new THREE.Color(1.6, 1.2, 0.5), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 }));
  sp.scale.setScalar(1.6); sp.position.y = kind === 'sack' ? 1.1 : 1.15; sp.layers.set(1);
  g.add(sp);
  g.position.copy(pos);
  scene.add(g);
  g.dispose = () => scene.remove(g);
  return g;
}

const insideCompound = (w) => w.x > -505.5 && w.x < -450.5 && w.z > -372.5 && w.z < -320.5;

// =====================================================================
const CHAPTERS = [
  // ---------------------------------------------------------- I
  async function homecoming(S, A, W, p, env) {
    const C = W.cast, ui = G.ui;
    env.setTime(6.12); env.setRain(0, true);
    G.audio?.setMood('dawn');
    W.boat.pos.set(SPOTS.villageBoat.x, 0, SPOTS.villageBoat.z); W.boat.yaw = -Math.PI / 2; W.boat.usable = false;
    C.ouseph.place(SPOTS.ouseph.x, SPOTS.ouseph.z, Math.PI / 2);
    p.teleport(SPOTS.arrive.x, SPOTS.arrive.z, Math.PI / 2);
    p.locked = true; ui.setHud(false); ui.letterbox(true);
    const jx = SPOTS.arrive.x;
    const cine = { hard: true, pos: new THREE.Vector3(jx - 150, 30, 120), look: new THREE.Vector3(jx + 40, 5, 38), fov: 46, t: 0 };
    cine.update = (dt) => { cine.t = Math.min(1, cine.t + dt / 22); const e = smoothstep(0, 1, cine.t); cine.pos.set(lerp(jx - 150, jx - 26, e), lerp(30, 4.2, e), lerp(120, 48, e)); cine.look.set(jx + 40, lerp(8, 3, e), 38); };
    p.setCine(cine);
    await A.fade(0, 3);
    await A.card('TRAVANCORE  ·  JUNE 1905', 'KAYAL', 'കായൽ', 5);
    await A.narrate('The monsoon has broken over the Malabar coast. In the foothills the pepper hangs heavy on the vine — black gold, the traders call it.', 7);
    await A.narrate('After six years on the Bombay docks, Madhavan is coming home.', 4.6);
    p.setCine(null); ui.letterbox(false);
    await A.title(0);
    await A.dialog([
      [C.ouseph, 'There she is, Madhava. Thekkumkara. Six years and nothing has changed — only the debts have grown.'],
      ['M', 'And my uncle, Ouseph chetta? Your letter spoke of trouble.'],
      [C.ouseph, 'The Company\'s agent — Finch sahib. He holds notes against half the gardens on this kayal, and he means to collect in land.'],
      [C.ouseph, 'Go home, mone. Raman chettan should tell you himself. Follow the red road east through the village.'],
    ]);
    ui.setHud(true);
    A.obj('Walk home to the tharavadu, your family house', SPOTS.homeGate);
    A.toast('<b>W A S D</b> move &nbsp;·&nbsp; <b>Mouse</b> look &nbsp;·&nbsp; <b>Shift</b> run &nbsp;·&nbsp; <b>Space</b> jump', 9);
    await A.reach(SPOTS.homeGate, 6);
    A.obj('Greet Raman Ammavan on the verandah', SPOTS.homeDoor);
    await A.reach(SPOTS.homeDoor, 4.2);
    await A.dialog([
      [C.ammavan, 'Madhava! Six monsoons gone, and you come back taller than the gatepost.'],
      ['M', 'Ammava. Ouseph says Finch means to take the land.'],
      [C.ammavan, 'He says we owe eight hundred rupees. I borrowed two hundred, the year the blight took the vines. I put my thumb to his paper — I cannot read his English.'],
      [C.devaki, 'I can. I have seen his receipts, chetta, and the sums do not agree. Somewhere there is a true account… and a false one.'],
      [C.ammavan, 'Enough, mole. First the instalment — thirty rupees by tomorrow, or the bailiff comes with his chain and his peons.'],
      [C.ammavan, 'The pepper is ripe on the hill. Bring in the harvest, Madhava. Let us at least buy ourselves a month.'],
    ]);
  },

  // ---------------------------------------------------------- II
  async function blackGold(S, A, W, p, env) {
    const C = W.cast, ui = G.ui, scene = G.scene;
    if (!S.continuing) {
      env.setTime(8.6); env.setRain(0, true);
      p.teleport(SPOTS.homeDoor.x, SPOTS.homeDoor.z, Math.PI);
      await A.fade(0, 1.5);
    }
    G.audio?.setMood('calm');
    await A.title(1);
    A.obj('Go to the family pepper garden in the foothills', SPOTS.pepperYard);
    await A.reach(SPOTS.pepperYard, 16);
    let got = 0, ambushed = false, down = 0;
    const total = SPOTS.pepperSacks.length;
    const text = () => `Gather the pepper harvest (${got}/${total})`;
    A.obj(text(), null);
    A.toast('Look for the glowing sacks among the vines. <b>E</b> — gather', 7);
    const sacks = SPOTS.pepperSacks.map((pos) => { const m = makePickup(scene, pos); S.temps.push(m); return m; });
    const nearest = () => { let b = null, bd = 1e9; sacks.forEach((s) => { if (!s.taken) { const d = A.dist(s.position); if (d < bd) { bd = d; b = s; } } }); return b; };
    sacks.forEach((s) => {
      A.interact(s.position, 2.3, 'Gather pepper').then(() => {
        s.taken = true; s.dispose(); got++; G.audio?.sfx('pickup');
        const n = nearest();
        ui.setObjective(S.tag, text()); ui.setMarker(n && !ambushed ? n.position : ui.markerPos);
        if (down >= 2 || !ambushed) ui.setMarker(n ? n.position : null);
      }).catch(() => {});
    });
    ui.setMarker(nearest().position);
    await A.until(() => got >= 3);
    // the Company's men arrive
    ambushed = true;
    S.onKO = () => { down++; };
    const ang = Math.atan2(p.pos.x - (LOC.pepper.x - 46), p.pos.z - (LOC.pepper.z + 30));
    C.toughs.forEach((t, i) => { t.reset(); t.setActive(true); t.place(LOC.pepper.x - 46 - i * 2.5, LOC.pepper.z + 30 + i * 2, ang); t.showCone = false; t.becomeHostile(false); });
    ui.bark('Company peon', 'You there! This garden is under lien to Harrow & Finch. Put down those sacks!', 5);
    G.audio?.setMood('chase');
    A.obj('Drive off the Company\'s men', null);
    A.toast('<b>Left Mouse</b> or <b>F</b> — strike with your staff. Keep moving between blows.', 8);
    await A.until(() => down >= 2);
    G.audio?.setMood('calm');
    ui.bark('Madhavan', 'Tell Finch the harvest is spoken for.', 4);
    if (got < total) { A.obj(text(), nearest()?.position || null); await A.until(() => got >= total); }
    A.obj('Carry the harvest down to Ouseph at the village jetty', SPOTS.ouseph);
    await A.reach(SPOTS.ouseph, 4.5);
    await A.dialog([
      [C.ouseph, 'Peons in the pepper garden already? Finch is in a hurry, then. That is a frightened man, Madhava — and frightened men make mistakes.'],
      [C.ouseph, 'Take my vallam. Puthenthura lies north-west across the water — steer for the Chinese nets. Moideen Hajji will give you an honest price.'],
      ['M', 'And if the weather turns?'],
      [C.ouseph, 'It is June in Travancore, mone. The weather always turns.'],
    ]);
  },

  // ---------------------------------------------------------- III
  async function backwaterRun(S, A, W, p, env) {
    const C = W.cast, ui = G.ui;
    if (!S.continuing) {
      p.teleport(SPOTS.ouseph.x - 3, SPOTS.ouseph.z + 0.6, -Math.PI / 2);
      W.boat.pos.set(SPOTS.villageBoat.x, 0, SPOTS.villageBoat.z); W.boat.yaw = -Math.PI / 2; W.boat.speed = 0;
    }
    env.setTime(16.2); env.setRain(0, !S.continuing);
    if (!S.continuing) await A.fade(0, 1.5);
    G.audio?.setMood('calm');
    W.boat.cargo.visible = true; W.boat.usable = true;
    await A.title(2);
    A.obj('Board Ouseph\'s vallam', W.boat.pos);
    await A.until(() => p.mode === 'boat');
    A.toast('<b>W</b> paddle &nbsp;·&nbsp; steer with the camera &nbsp;·&nbsp; <b>Shift</b> paddle hard', 8);
    A.obj('Cross the kayal to Puthenthura — north-west, toward the Chinese nets', SPOTS.portLanding);
    const d0 = A.dist(SPOTS.portBoat);
    await A.until(() => A.dist(SPOTS.portBoat) < d0 * 0.72);
    env.setRain(1);
    G.audio?.setMood('rain');
    ui.bark('Madhavan', 'The sky is turning. The monsoon never asks permission.', 5);
    await A.until(() => A.dist(SPOTS.portBoat) < d0 * 0.36);
    ui.bark('Madhavan', 'There — the Chinese nets. Puthenthura.', 4);
    await A.until(() => A.dist(SPOTS.portBoat) < 20);
    A.obj('Bring the vallam alongside the jetty and step ashore', SPOTS.portLanding);
    await A.until(() => p.mode === 'foot' && A.dist(SPOTS.portLanding) < 60);
    W.boat.cargo.visible = false;
    ui.bark('', 'Porters carry the pepper up the quay.', 3.5);
    A.obj('Find Moideen Hajji, the spice merchant, on the quay', SPOTS.moideen);
    await A.reach(SPOTS.moideen, 3.6);
    await A.dialog([
      [C.moideen, 'Raman\'s pepper! Wa alaikum salaam, boy. Tellicherry bold, dry as bone even in this rain. Thirty-four rupees — and no Company scale to cheat you.'],
      ['M', 'Hajji… my uncle borrowed two hundred from Finch. The note now reads eight hundred.'],
      [C.moideen, 'Hah. Forty years I have traded on this quay. Finch keeps two books: one for the Peishkar\'s inspectors, and one — the true one — in his counting-house. Red leather, brass clasp. I have seen it.'],
      [C.moideen, 'Lay that red ledger before the Peishkar at the hill Cutcherry and it is Finch who will owe. But the compound is watched, and the Peishkar leaves for Trivandrum at sunrise.'],
      ['M', 'Then it must be tonight.'],
      [C.moideen, 'In the hour before dawn, when the watch is sleepiest. There is a gap in the east wall the coolies use. Go with God, Madhava.'],
    ]);
    G.audio?.sfx('coin');
    A.toast('Received <b>34 rupees</b> for the harvest', 5);
    await A.wait(1.2);
  },

  // ---------------------------------------------------------- IV
  async function redLedger(S, A, W, p, env) {
    const C = W.cast, ui = G.ui, scene = G.scene;
    await A.fade(1, 1.2);
    S.resetWorld();
    env.setTime(4.3); env.frozen = true; env.setRain(0.12, true);
    p.teleport(SPOTS.portSquare.x + 2, SPOTS.portSquare.z + 8, -Math.PI / 2);
    W.boat.pos.set(SPOTS.portBoat.x, 0, SPOTS.portBoat.z); W.boat.yaw = 0; W.boat.usable = false;
    W.horse.pos.set(SPOTS.stableHorse.x, getHeight(SPOTS.stableHorse.x, SPOTS.stableHorse.z), SPOTS.stableHorse.z); W.horse.yaw = SPOTS.stableFace; W.horse.speed = 0; W.horse.usable = false;
    C.guards.forEach((g) => { g.reset(); g.setActive(true); g.perceive = true; g.showCone = true; });
    G.audio?.setMood('night');
    await A.wait(0.6);
    await A.fade(0, 2);
    await A.title(3);
    A.obj('Slip into the Company compound — the coolies\' gap in the east wall', SPOTS.compoundRear);
    A.toast('<b>C</b> — crouch. You are harder to see and hear. Stay out of the lantern light.', 9);
    let alarm = false;
    S.onAlert = () => {
      if (alarm) return; alarm = true;
      ui.bark('Company peon', 'Who goes there?! Intruder!', 3.5);
      G.audio?.setMood('chase');
      C.guards.forEach((g) => { if (g.active && !g.ko && A.dist(g.pos) < 45) g.becomeHostile(false); });
    };
    await A.until(() => insideCompound(p.worldPos()));
    const desk = makePickup(scene, new THREE.Vector3(SPOTS.ledger.x, groundAt(SPOTS.ledger.x, SPOTS.ledger.z), SPOTS.ledger.z), 'ledger');
    S.temps.push(desk);
    A.obj('Take the red ledger from the counting-house verandah', SPOTS.ledger);
    await A.interact(desk.position, 2.4, 'Take the red ledger');
    desk.remove(desk.userData.book); desk.children.forEach((c) => { if (c.isSprite) c.visible = false; });
    G.audio?.sfx('pickup');
    ui.toast('You have the <b>red ledger</b>', 4);
    await A.wait(0.8);
    // the alarm is raised regardless
    G.audio?.sfx('bell');
    C.finch.setActive(true); C.finch.place(SPOTS.finch.x + 3.5, SPOTS.finch.z - 0.5, Math.PI); C.finch.pose = 'talk';
    ui.bark('Mr. Finch', 'THIEF! My ledger! Ring the bell — a sovereign to the man who brings him down!', 5.5);
    alarm = true;
    G.audio?.setMood('chase');
    C.guards.forEach((g) => g.becomeHostile(false));
    env.frozen = false;
    W.horse.usable = true;
    A.obj('Escape! Take Finch\'s horse from the stable beyond the west wall', W.horse.pos);
    A.toast('Out through the north gate, then west along the wall. <b>E</b> — mount', 7);
    await A.until(() => p.mode === 'horse');
  },

  // ---------------------------------------------------------- V
  async function rideForCutcherry(S, A, W, p, env) {
    const C = W.cast, ui = G.ui, scene = G.scene;
    if (!S.continuing) {
      env.setTime(4.75); env.setRain(0, true);
      W.horse.pos.set(SPOTS.stableHorse.x, getHeight(SPOTS.stableHorse.x, SPOTS.stableHorse.z), SPOTS.stableHorse.z); W.horse.yaw = SPOTS.stableFace; W.horse.speed = 0;
      p.teleport(SPOTS.stableHorse.x, SPOTS.stableHorse.z, SPOTS.stableFace);
      p.mountHorse(W.horse);
      p.camYaw = SPOTS.stableFace + Math.PI;
      await A.fade(0, 1.5);
    }
    env.frozen = false; env.dayRate = 1 / 62; env.setRain(0);
    W.horse.usable = true;
    G.audio?.setMood('chase');
    S.tag = 'CHAPTER V — RIDE FOR THE CUTCHERRY';
    G.audio?.sfx('chapter');
    ui.card('CHAPTER V', CHAPTER_NAMES[4], '', 3);
    A.toast('<b>Shift</b> — gallop. Stay on the road; the riders are slower than Sultan, but not by much.', 8);
    const way = [[-470, -384], [-330, -394], [-250, -385], [-170, -330], [-110, -250], [50, -268], [230, -312], [400, -318]].map(([x, z]) => new THREE.Vector3(x, getHeight(x, z), z));
    way.push(SPOTS.cutcherryYard.clone());
    let wi = 0;
    while (wi < way.length - 1 && A.dist(way[wi]) < 40) wi++;
    A.obj('Ride for the hill Cutcherry before the Peishkar departs — follow the road', way[wi]);
    // pursuers
    let spawned = false, t = 0, warned = false, dawnLine = false;
    const spawn = () => {
      spawned = true;
      for (let i = 0; i < 3; i++) {
        // they burst out from behind the stable, on the player's tail
        const r = new Rider(scene, SPOTS.stableHorse.x - 6 - i * 3, SPOTS.stableHorse.z + 6 + (i - 1) * 4, Math.PI / 2, 11.2 + i * 0.25);
        W.riders.push(r);
      }
      ui.bark('Company rider', 'After him! He has the sahib\'s book!', 4);
    };
    await A.until((dt) => {
      t += dt;
      if (!spawned && A.dist(SPOTS.stableHorse) > 42) spawn();
      if (wi < way.length - 1 && A.dist(way[wi]) < 34) { wi++; ui.setMarker(way[wi]); }
      for (const r of W.riders) {
        if (r.nearT > 1.25 && !S.failing) S.fail('The Company\'s riders dragged you from the saddle.');
        if (r.dist < 12 && !warned) { warned = true; ui.bark('Company rider', 'Stop! In the name of the Company!', 3.5); }
      }
      if (!dawnLine && env.hour > 5.75 && env.hour < 7) { dawnLine = true; ui.bark('Madhavan', 'First light. The Peishkar will be calling for his carriage. Run, Sultan — run!', 5); }
      return A.dist(SPOTS.cutcherryYard) < 22;
    });
    // arrival
    S.invulnerable = true;
    p.locked = true;
    W.riders.forEach((r) => (r.halt = true));
    G.audio?.setMood('none');
    await A.fade(1, 0.9);
    W.riders.forEach((r) => r.dispose()); W.riders.length = 0;
    C.guards.forEach((g) => g.setActive(false));
    const cy = SPOTS.cutcherryYard;
    p.dismount(true, new THREE.Vector3(cy.x, 0, cy.z - 3));
    p.yaw = Math.PI; p.root.rotation.y = Math.PI;
    W.horse.pos.set(cy.x + 7, getHeight(cy.x + 7, cy.z + 3), cy.z + 3); W.horse.yaw = 2.6; W.horse.speed = 0;
    C.finch.setActive(true); C.finch.pose = 'idle'; C.finch.place(cy.x - 4.5, cy.z + 1.5, Math.PI * 0.9);
    C.peishkar.yaw = 0;
    env.setTime(Math.max(6.25, Math.min(env.hour, 6.6))); env.frozen = true;
    p.camYaw = 0.5; p.camPitch = 0.12;
    await A.wait(0.5);
    await A.fade(0, 1.6);
    G.audio?.setMood('dawn');
    await A.dialog([
      [C.peishkar, 'Who gallops into the Cutcherry yard at dawn like a dacoit?'],
      ['M', 'Madhavan of Thekkumkara, yajamanane. I bring the true accounts of Harrow & Finch — before you leave for Trivandrum.'],
      [C.finch, 'That book is Company property! This coolie is a thief and a housebreaker. I demand he be flogged!'],
      [C.peishkar, '…Two hundred rupees lent. Eight hundred claimed. And here — forty families. The same hand, the same trick, page after page.'],
      [C.peishkar, 'Mr. Finch, in His Highness\'s dominions we have a word for this. The word is forgery.'],
      [C.finch, 'You would not dare. The Resident shall hear of this!'],
      [C.peishkar, 'The Resident shall read of it — in my report. The notes are void. Sepoys, escort the agent to his bungalow. He is not to leave Puthenthura.'],
      [C.peishkar, 'Go home, Madhavan. Tell your uncle the land is his. And tell your sister the Durbar has need of people who can read a ledger.'],
    ], { other: C.peishkar });
    p.locked = true;
    await A.fade(1, 2);
    // epilogue
    S.resetWorld();
    p.locked = true;
    env.setTime(17.55); env.setRain(0, true); env.frozen = false;
    const hg = SPOTS.homeGate;
    p.teleport(hg.x, hg.z + 3, 0);
    p.camYaw = Math.PI * 0.75; p.camPitch = 0.1;
    W.horse.pos.set(hg.x - 5, getHeight(hg.x - 5, hg.z + 4), hg.z + 4); W.horse.yaw = 1; W.horse.usable = true;
    W.boat.pos.set(SPOTS.villageBoat.x, 0, SPOTS.villageBoat.z); W.boat.yaw = -Math.PI / 2; W.boat.usable = true;
    ui.setHud(false); ui.letterbox(true);
    const c0 = new THREE.Vector3(hg.x + 30, 16, hg.z + 46);
    const cine = { hard: true, pos: c0.clone(), look: new THREE.Vector3(LOC.home.x, 4, LOC.home.z), fov: 44, t: 0 };
    cine.update = (dt) => { cine.t += dt; cine.pos.set(c0.x - cine.t * 0.9, c0.y - cine.t * 0.12, c0.z - cine.t * 0.5); };
    p.setCine(cine);
    G.audio?.setMood('calm');
    await A.fade(0, 2.5);
    await A.narrate('The notes of Harrow & Finch were declared void that same morning. Forty families along the kayal kept their land.', 7.5);
    await A.narrate('Alistair Finch sailed from Alleppey before the next monsoon. The red ledger is kept, they say, in the record room at Trivandrum.', 7.5);
    await A.narrate('And in Thekkumkara the pepper still ripens on the hill, in the gardens that were never signed away.', 6.5);
    await A.card('A TALE OF TRAVANCORE', 'KAYAL', 'കായൽ  ·  fin', 6);
    p.setCine(null); ui.letterbox(false); ui.setHud(true);
    S.invulnerable = false; p.locked = false;
  },

  // ---------------------------------------------------------- free roam
  async function freeRoam(S, A, W, p, env) {
    const ui = G.ui;
    if (!S.continuing) {
      env.setTime(8); env.setRain(0, true);
      const hg = SPOTS.homeGate;
      p.teleport(hg.x, hg.z + 3, 0);
      W.horse.pos.set(hg.x - 5, getHeight(hg.x - 5, hg.z + 4), hg.z + 4); W.horse.yaw = 1;
      W.boat.pos.set(SPOTS.villageBoat.x, 0, SPOTS.villageBoat.z); W.boat.yaw = -Math.PI / 2;
      await A.fade(0, 1.5);
    }
    W.horse.usable = true; W.boat.usable = true;
    S.tag = 'FREE ROAM';
    G.audio?.setMood('calm');
    A.obj('Travancore is yours to wander — by horse, by vallam, or on foot', null);
    A.toast('<b>P</b> — photo mode &nbsp;·&nbsp; in photo mode: <b>[ ]</b> change the hour, <b>R</b> rain', 10);
    let t = 120 + Math.random() * 120;
    await A.until((dt) => {
      t -= dt;
      if (t <= 0) { const r = env.rainTarget > 0.5 ? 0 : 1; env.setRain(r); t = r ? 90 + Math.random() * 60 : 200 + Math.random() * 200; }
      const m = env.rain > 0.5 ? 'rain' : env.night > 0.6 ? 'night' : (env.hour < 8 ? 'dawn' : 'calm');
      if (G.audio && G.audio.mood !== m) G.audio.setMood(m);
      return false;
    });
  },
];
