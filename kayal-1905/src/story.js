import { CAST } from './human.js';
// Open-world mission framework. Between missions the player roams free;
// each mission is a cancellable async script started from a marker in the
// world. Act I and Act II scripts live in missions.js.
import * as THREE from 'three';
import { G } from './state.js';
import { SPOTS } from './structures.js';
import { LOC, getHeight } from './heightfield.js';
import { groundAt } from './physics.js';
import { NPC } from './npc.js';
import { TEX } from './textures.js';
import { MISSIONS } from './missions.js';

export const CANCEL = Symbol('cancel');
const SAVE_KEY = 'kayal1905.save.v2';
export { MISSIONS };

export function loadSave() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); return s && typeof s.done === 'number' ? s : null; } catch (e) { return null; }
}
export function fmtMoney(a) {
  const r = Math.floor(a / 16), an = a % 16;
  return `Rs ${r}` + (an ? ` · ${an} as` : '');
}
const freshState = () => ({ done: 0, annas: 0, pages: [], places: [], outfit: 'everyday', outfits: ['everyday', 'boatman'], fish: 0, jobs: 0, wins: 0 });

export function makePickup(scene, pos, kind = 'sack') {
  const g = new THREE.Group();
  const std = (o) => new THREE.MeshStandardMaterial(o);
  let glowY = 1.1;
  if (kind === 'sack') {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), std({ map: TEX.sack, roughness: 1 }));
    m.scale.set(1.1, 0.8, 0.9); m.position.y = 0.3; m.castShadow = true; g.add(m);
    const k = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), std({ map: TEX.sack })); k.position.y = 0.66; g.add(k);
  } else if (kind === 'ledger') {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.75, 0.6), std({ map: TEX.wood })); t.position.y = 0.375; t.castShadow = true; g.add(t);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.26), std({ color: 0x9a1a16, roughness: 0.5, emissive: 0x400806, emissiveIntensity: 0.8 })); b.position.y = 0.79; b.rotation.y = 0.3; g.add(b);
    g.userData.book = b; glowY = 1.15;
  } else if (kind === 'chest') {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.45, 0.5), std({ map: TEX.wood, color: 0xa08060 })); t.position.y = 0.23; t.castShadow = true; g.add(t);
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.8, 10, 1, false, 0, Math.PI), std({ map: TEX.wood, color: 0xa08060 })); l.rotation.z = Math.PI / 2; l.position.y = 0.45; g.add(l);
    for (const x of [-0.25, 0.25]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.53), std({ color: 0xb08a3a, metalness: 0.5, roughness: 0.4 })); s.position.set(x, 0.26, 0); g.add(s); }
  } else if (kind === 'page') {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.4), std({ color: 0xe9dcb4, roughness: 0.9, side: THREE.DoubleSide, emissive: 0x40381c, emissiveIntensity: 0.6 }));
    m.position.y = 0.9; m.rotation.set(-0.3, 0.6, 0.1); g.add(m); g.userData.spin = m; glowY = 0.95;
  } else if (kind === 'ring') {
    glowY = 0.6;
  }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glow, color: new THREE.Color(1.6, 1.2, 0.5), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 }));
  sp.scale.setScalar(kind === 'page' ? 0.55 : 1.3); sp.position.y = glowY; sp.layers.set(1);
  if (kind === 'page') sp.material.opacity = 0.55;
  g.add(sp);
  g.position.copy(pos);
  scene.add(g);
  g.dispose = () => scene.remove(g);
  return g;
}

// read the mood of a line so faces follow the talk without hand-tagging every one
function moodOf(t) {
  if (/\b(hah|ha!|heh|laugh)/i.test(t)) return 'laughing';
  if (/\b(dead|died|lost|gone|grave|ashes|ruin|forgive|weep|mourn|took the vines|cannot read)\b/i.test(t)) return 'grieving';
  if (/!/.test(t) && /\b(thief|thieves|cheat|liar|lie|dare|never|rogue|dog|swine|burn|curse|damn|out|seize|stop)\b/i.test(t)) return 'angry';
  if (/!/.test(t)) return 'determined';
  if (/\?\s*$/.test(t) || /\b(afraid|fear|careful|bailiff|danger|watch(ed)?|trouble)\b/i.test(t)) return 'worried';
  return 'neutral';
}

export class Story {
  constructor() {
    this.state = freshState();
    this.mode = 'boot'; this.mi = -1; this.cp = null;
    this.tk = null; this.waiters = []; this.temps = [];
    this.busy = false; this.invulnerable = false; this.failing = false;
    this.tag = ''; this.onKO = null; this.onAlert = null;
    // the mission-start marker: a slow ring of light on the ground
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.035, 6, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.05, 0.32), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.ring.rotation.x = Math.PI / 2; this.ring.layers.set(1); this.ring.visible = false;
    this.next = null;      // { i, pos, def } while a mission is on offer
  }
  attach(scene) { scene.add(this.ring); }
  get chapter() { return this.mi >= 0 ? this.mi : this.state.done; }

  save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.state)); } catch (e) { /* storage unavailable */ } }
  addMoney(a, why) {
    if (!a) return;
    this.state.annas = Math.max(0, this.state.annas + a);
    G.ui.setMoney(fmtMoney(this.state.annas), a);
    if (why) G.ui.toast(`${a > 0 ? 'Received' : 'Paid'} <b>${fmtMoney(Math.abs(a))}</b> — ${why}`, 4.5);
    if (a > 0) G.audio?.sfx('coin');
    this.save();
  }
  canPay(a) { return this.state.annas >= a; }

  newGame() { this.state = freshState(); G.player.setOutfit(this.state.outfit); this.save(); G.ui.setMoney(fmtMoney(0)); this.startMission(0); }
  continueGame(s) { this.state = { ...freshState(), ...s }; { const st = this.state, O = CAST.outfits; st.outfits = [...new Set(['everyday', 'boatman', ...st.outfits.filter((k) => O[k])])]; if (!O[st.outfit]) st.outfit = 'everyday'; } G.ui.setMoney(fmtMoney(this.state.annas)); G.player.setOutfit(this.state.outfit); this.enterFree({ fresh: true }); }

  cancel() {
    if (this.tk) this.tk.cancelled = true;
    this.waiters.length = 0;
    G.ui.cancelSay();
    for (const t of this.temps) t.dispose?.();
    this.temps.length = 0;
    this.onKO = null; this.onAlert = null;
    this.ring.visible = false; this.next = null;
  }

  // put every story actor back where free-roam expects them
  resetWorld() {
    const W = G.world, C = W.cast, p = G.player, env = G.env, d = this.state.done;
    for (const r of W.riders) r.dispose();
    W.riders.length = 0;
    for (const g of [...C.guards, ...C.toughs, ...C.thugs, ...C.estateGuards]) { g.reset(); g.perceive = false; g.showCone = false; g.setActive(false); }
    for (const n of [C.finch, C.harrow, C.dacre, C.carmichael]) { n.reset(); n.setActive(false); n.goal = null; }
    C.velu.detach(); C.devaki.detach();
    C.velu.reset(); C.velu.follow = null; C.velu.setActive(d >= 8);
    if (d >= 8) C.velu.place(SPOTS.cutcherryYard.x + 9, SPOTS.cutcherryYard.z - 6, -0.8);
    C.devaki.follow = null; C.devaki.pose = 'idle';
    if (d >= 5) C.devaki.place(SPOTS.cutcherryYard.x - 3.4, SPOTS.cutcherryYard.z - 7.5, 0.3); else C.devaki.place(SPOTS.devaki.x, SPOTS.devaki.z, Math.PI);
    C.ammavan.place(SPOTS.ammavan.x, SPOTS.ammavan.z, Math.PI); C.ammavan.pose = 'idle';
    C.moideen.place(SPOTS.moideen.x, SPOTS.moideen.z, Math.PI / 2); C.moideen.pose = 'idle';
    C.ouseph.place(SPOTS.ouseph.x, SPOTS.ouseph.z, Math.PI / 2);
    C.peishkar.pos.set(SPOTS.peishkar.x, SPOTS.peishkar.y, SPOTS.peishkar.z); C.peishkar.fixedY = true; C.peishkar.yaw = 0; C.peishkar.sync();
    env.frozen = false; env.dayRate = 1 / 55;
    p.locked = false; p.health = 100; p.stamina = 100; p.poseOverride = null; p.setCine(null); p.gallopMax = 12.6; p.setCarry(null);
    if (p.h.state === 'ko') p.h.state = 'idle';
    this.busy = false; this.invulnerable = false;
    const ui = G.ui;
    ui.letterbox(false); ui.setHud(!p.photo); ui.setMarker(null); ui.hideDead(); ui.setTimer(null); ui.setMeter(null); ui.setBoss(null);
    W.boat.cargo.visible = false;
    W.boatsUnlocked = d >= 2;
    W.horse.usable = d >= 4;
    W.horse.call = false;
    G.fx.fireHeat = 0;
  }

  // ---------------------------------------------------------------- free roam
  enterFree(o = {}) {
    this.cancel();
    const tk = this.tk = { cancelled: false };
    this.mode = 'free'; this.mi = -1; this.cp = null;
    const A = this.api(tk), W = G.world, p = G.player, env = G.env, ui = G.ui;
    (async () => {
      try {
        this.resetWorld();
        if (o.fresh) {
          env.setTime(8); env.setRain(0, true);
          const hg = SPOTS.homeGate;
          p.teleport(hg.x, hg.z + 3, 0);
          W.horse.pos.set(hg.x - 5, getHeight(hg.x - 5, hg.z + 4), hg.z + 4); W.horse.yaw = 1; W.horse.speed = 0;
          W.boat.pos.set(SPOTS.villageBoat.x, 0, SPOTS.villageBoat.z); W.boat.yaw = -Math.PI / 2; W.boat.speed = 0;
          await A.wait(0.3);
          await A.fade(0, 1.5);
        }
        this.tag = 'FREE ROAM';
        const i = this.state.done, def = MISSIONS[i];
        if (def) {
          const pos = def.giver().clone();
          pos.y = groundAt(pos.x, pos.z);
          this.next = { i, pos, def };
          this.ring.position.set(pos.x, pos.y + 0.12, pos.z); this.ring.visible = true;
          ui.setObjective('FREE ROAM', `Next: “${def.name}” — ${def.where}`);
          ui.setMarker(pos);
          const it = { pos, r: 3.2, prio: true, label: `Begin: ${def.name}`, cond: () => this.mode === 'free' && !G.activity, action: () => this.startMission(i) };
          it.dispose = () => { const k = G.interactables.indexOf(it); if (k >= 0) G.interactables.splice(k, 1); };
          G.interactables.push(it); this.temps.push(it);
        } else {
          ui.setObjective('FREE ROAM', 'Travancore is yours to wander — by horse, by vallam, or on foot');
          ui.setMarker(null);
        }
        if (o.fresh) A.toast('<b>M</b> map &nbsp;·&nbsp; <b>X</b> whistle for your horse &nbsp;·&nbsp; <b>P</b> photo mode', 9);
        let t = 150 + Math.random() * 150;
        await A.until((dt) => {
          t -= dt;
          if (t <= 0) { const r = env.rainTarget > 0.5 ? 0 : 1; env.setRain(r); t = r ? 80 + Math.random() * 60 : 220 + Math.random() * 220; }
          const m = env.rain > 0.5 ? 'rain' : env.night > 0.6 ? 'night' : (env.hour < 8 ? 'dawn' : 'calm');
          if (G.audio && G.audio.mood !== m && !G.activity) G.audio.setMood(m);
          return false;
        });
      } catch (e) { if (e !== CANCEL) console.error(e); }
    })();
  }

  // ---------------------------------------------------------------- missions
  async startMission(i, cp = null) {
    this.cancel();
    const tk = this.tk = { cancelled: false };
    const def = MISSIONS[i];
    this.mode = 'mission'; this.mi = i; this.cp = cp;
    this.tag = `${def.act === 1 ? 'ACT I' : 'ACT II'} — ${def.name.toUpperCase()}`;
    G.activity = null;
    try {
      await def.run(this, this.api(tk), G.world, G.player, G.env, cp);
      if (tk.cancelled) return;
      // ---- passed
      const first = this.state.done <= i;
      this.state.done = Math.max(this.state.done, i + 1);
      this.save();
      G.audio?.sfx('passed');
      G.player.h.setExpression('laughing', 5);
      G.ui.banner('MISSION PASSED', def.name, first && def.reward ? `+ ${fmtMoney(def.reward)}` : '');
      if (first && def.reward) this.addMoney(def.reward);
      this.enterFree();
    } catch (e) {
      if (e !== CANCEL) console.error(e);
    }
  }
  checkpoint(name) { this.cp = name; }

  fail(msg) {
    if (this.failing || this.mode !== 'mission') {
      // died in free roam: wake up at home
      if (!this.failing && this.mode === 'free') {
        this.failing = true; this.cancel(); G.player.locked = true; G.ui.showDead(msg || 'You collapsed.');
        setTimeout(async () => { await G.ui.fade(1, 0.9); this.failing = false; this.enterFree({ fresh: true }); }, 2400);
      }
      return;
    }
    this.failing = true;
    const i = this.mi, cp = this.cp;
    this.cancel();
    G.player.locked = true;
    G.ui.showDead(msg);
    G.audio?.setMood('none');
    setTimeout(async () => {
      await G.ui.fade(1, 0.9);
      this.failing = false;
      this.startMission(i, cp);
    }, 2400);
  }

  update(dt) {
    for (let i = this.waiters.length - 1; i >= 0; i--) {
      const w = this.waiters[i];
      if (!w) continue;
      if (w.tk.cancelled) { this.waiters.splice(i, 1); continue; }
      if (w.fn(dt)) { this.waiters.splice(i, 1); w.res(); }
    }
    if (this.ring.visible) { const s = 1 + Math.sin(G.time * 2.4) * 0.08; this.ring.scale.set(s, s, 1); this.ring.material.opacity = 0.6 + Math.sin(G.time * 2.4) * 0.25; }
  }

  api(tk) {
    const S = this, ui = G.ui, p = G.player, scene = G.scene;
    const chk = () => { if (tk.cancelled) throw CANCEL; };
    const until = (fn) => new Promise((res) => S.waiters.push({ fn, res, tk })).then(chk);
    const wait = (s) => { let t = 0; return until((dt) => (t += dt) >= s); };
    const fade = async (to, d) => { await ui.fade(to, d); chk(); };
    const card = async (...a) => { await ui.card(...a); chk(); };
    const obj = (text, pos = null) => { ui.setObjective(S.tag, text); ui.setMarker(pos); };
    const dist = (pos) => { const w = p.worldPos(); return Math.hypot(w.x - pos.x, w.z - pos.z); };
    const reach = (pos, r, mode) => until(() => dist(pos) < r && (!mode || p.mode === mode));
    const temp = (t) => { S.temps.push(t); return t; };
    // one-shot interaction; resolves when used
    const interact = (pos, r, label, cond) => new Promise((res) => {
      const it = { pos, r, label, cond: () => p.mode === 'foot' && (!cond || cond()), action: () => { it.dispose(); res(); } };
      it.dispose = () => { const i = G.interactables.indexOf(it); if (i >= 0) G.interactables.splice(i, 1); };
      G.interactables.push(it); S.temps.push(it);
    }).then(chk);
    // repeatable interaction
    const hotspot = (pos, r, label, cond, action) => {
      const it = { pos, r, label, cond: () => p.mode === 'foot' && (!cond || cond()), action };
      it.dispose = () => { const i = G.interactables.indexOf(it); if (i >= 0) G.interactables.splice(i, 1); };
      G.interactables.push(it); S.temps.push(it);
      return it;
    };
    const narrate = async (text, d = 5.5) => { ui.bark('', text, d); await wait(d + 0.4); };
    const focus = (sp, li) => {
      const dx = sp.x - li.x, dz = sp.z - li.z, l = Math.hypot(dx, dz) || 1;
      const nx = dx / l, nz = dz / l;
      const pos = new THREE.Vector3(li.x - nx * 1.5 + nz * 0.85, 0, li.z - nz * 1.5 - nx * 0.85);
      pos.y = Math.max(li.y + 1.72, getHeight(pos.x, pos.z) + 0.6);
      p.setCine({ pos, look: new THREE.Vector3(sp.x, sp.y + 1.5, sp.z), fov: 36, blend: 0.9 });
    };
    // lines: [speaker, text] where speaker is 'M' or an NPC
    const dialog = async (lines, o = {}) => {
      chk();
      S.busy = true; p.locked = true; ui.letterbox(true); ui.prompt(null);
      let other = o.other || lines.find((l) => l[0] !== 'M')?.[0];
      const faces = new Set();
      for (const [who, text, ex] of lines) {
        const me = p.worldPos(), h = who === 'M' ? p.h : who.h;
        if (h) { faces.add(h); h.setExpression(ex || moodOf(text)); h.talking = true; }
        try {
          if (who === 'M') { if (other) focus(me, other.pos); await ui.say('Madhavan', text); }
          else { other = who; who.talkT = 6; focus(who.pos, me); await ui.say(who.name, text); }
        } finally { if (h) h.talking = false; }
        chk();
      }
      for (const h of faces) h.setExpression('neutral');
      ui.letterbox(false); p.locked = false; S.busy = false; p.setCine(null);
    };
    const title = async (line) => {
      G.audio?.sfx('chapter');
      const def = MISSIONS[S.mi];
      await card(line || (def.act === 1 ? 'ACT I' : 'ACT II'), def.name, '', 3.2);
    };
    // standard mission opening: fade out, tidy the world, set the stage, fade in
    const begin = async (o = {}) => {
      await fade(1, o.quick ? 0.5 : 0.8);
      S.resetWorld();
      if (p.mount) p.dismount(true);
      if (o.time != null) G.env.setTime(o.time);
      if (o.rain != null) G.env.setRain(o.rain, true);
      if (o.tp) p.teleport(o.tp[0], o.tp[1], o.tp[2] ?? 0);
      o.setup?.();
      await wait(0.35);
      if (!o.dark) await fade(0, 1.4);
    };
    const spawn = (name, preset, x, z, yaw, opts) => temp(new NPC(scene, name, preset, x, z, yaw, opts));
    const pickup = (pos, kind) => temp(makePickup(scene, pos, kind));
    return {
      chk, until, wait, fade, card, obj, dist, reach, interact, hotspot, narrate, dialog, title, begin, spawn, pickup, temp, focus,
      toast: (t, d) => ui.toast(t, d), bark: (n, t, d) => ui.bark(n, t, d), checkpoint: (n) => S.checkpoint(n),
    };
  }
}
