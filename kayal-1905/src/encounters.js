// Strangers on the road. While you wander, someone nearby gets into trouble and you hear it before you
// see it: a cry from up the road, a white blip on the map. Walk over and talk, and it becomes a small
// story of its own: a purse-snatcher to run down, a snakebite, a lost child, a drunk spoiling for a
// fight, a trap laid by dacoits. You can help, profit, or walk on; how you behave is remembered.
import * as THREE from 'three';
import { G } from './state.js';
import { ROADS, getHeight } from './heightfield.js';
import { pointInBox, groundAt } from './physics.js';
import { NPC } from './npc.js';
import { CAST, makeStick } from './characters.js';
import { SPOTS } from './structures.js';
import { speak } from './voice.js';
import { makeBicycle } from './vehicles.js';
import { ERA } from './era.js';
import { clamp } from './util.js';

const MEN = ['Kunjan', 'Raghavan', 'Pappu', 'Kesavan', 'Ouseph', 'Bava', 'Chathu', 'Kuttan', 'Vasu', 'Mammu', 'Antony', 'Gopalan'];
const WOMEN = ['Karthiyayani', 'Mariamma', 'Pathumma', 'Janaki', 'Kalyani', 'Thresia', 'Lakshmi', 'Ammini'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const V = (x, z) => new THREE.Vector3(x, groundAt(x, z), z);

export function setupEncounters(scene) {
  const E = G.enc = { active: null, cool: 50, recent: [] };
  const p = () => G.player, ui = () => G.ui, S = () => G.story;
  const pp = () => p().worldPos();
  const dist = (a) => { const w = pp(); return Math.hypot(w.x - a.x, w.z - a.z); };
  const state = () => S().state;
  const reward = (a, why) => S().addMoney(a > 0 ? Math.max(1, Math.round(a * (G.rewardMult ? G.rewardMult() : 1))) : a, why);
  const honour = (n, why) => {
    const st = state(); st.honour = clamp((st.honour || 0) + n, -100, 100); S().save();
    ui().toast(`${n > 0 ? 'Honour ▲' : 'Honour ▼'}${why ? ' &nbsp;·&nbsp; ' + why : ''}`, 4);
  };

  // ---------------------------------------------------------------- where: the roadside ahead of you
  function roadSpot(minD, maxD) {
    const w = pp(), yaw = p().mode === 'foot' ? p().yaw : (p().mount?.yaw ?? p().yaw);
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    let best = null, bs = -1e9;
    for (const key in ROADS) {
      const pts = ROADS[key];
      for (let i = 1; i < pts.length; i += 2) {
        const [x, z] = pts[i], dx = x - w.x, dz = z - w.z, d = Math.hypot(dx, dz);
        if (d < minD || d > maxD) continue;
        const ahead = (dx * fx + dz * fz) / d;                  // prefer up the road, not behind
        const sc = ahead * 2 + Math.random() * 0.8;
        if (sc > bs) {
          const [ax, az] = pts[i - 1], tx = x - ax, tz = z - az, tl = Math.hypot(tx, tz) || 1;
          const side = Math.random() < 0.5 ? 1 : -1, ox = x + tz / tl * 3.4 * side, oz = z - tx / tl * 3.4 * side;
          if (getHeight(ox, oz) < 0.4 || pointInBox(ox, oz, 1.2)) continue;
          bs = sc; best = { x: ox, z: oz, ry: Math.atan2(x - ox, z - oz), rx: tx / tl, rz: tz / tl };
        }
      }
    }
    return best;
  }
  // a free spot some way off in a random direction (for a child who wandered, a house to deliver to)
  function openSpot(cx, cz, rMin, rMax) {
    for (let k = 0; k < 40; k++) {
      const a = Math.random() * Math.PI * 2, r = rMin + Math.random() * (rMax - rMin), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (getHeight(x, z) > 0.5 && !pointInBox(x, z, 1.5)) return { x, z };
    }
    return null;
  }

  // ---------------------------------------------------------------- shared plumbing
  function begin(type, spot) {
    const en = { type, pos: new THREE.Vector3(spot.x, groundAt(spot.x, spot.z), spot.z), spot, npcs: [], ints: [], props: [], phase: 'calling', blip: true, callT: 1.5, calls: [], caller: null, t: 0 };
    en.spawn = (name, preset, x, z, yaw, o = {}) => { const n = new NPC(scene, name, preset, x, z, yaw, o); en.npcs.push(n); return n; };
    en.int = (pos, r, label, cond, action) => { const it = { pos, r, label, prio: true, cond: () => p().mode === 'foot' && !S().busy && (!cond || cond()), action }; G.interactables.push(it); en.ints.push(it); return it; };
    en.unint = (it) => { const i = G.interactables.indexOf(it); if (i >= 0) G.interactables.splice(i, 1); };
    en.prop = (o) => { scene.add(o); o.traverse((m) => m.layers.set(1)); en.props.push(o); return o; };
    E.active = en; E.recent.unshift(type); E.recent.length = Math.min(E.recent.length, 4);
    return en;
  }
  function end(en, cool = 100 + Math.random() * 80) {
    if (E.active !== en) return;
    for (const it of en.ints) en.unint(it);
    for (const n of en.npcs) n.dispose();
    for (const o of en.props) scene.remove(o);
    ui().setMeter(null); ui().setTimer(null); ui().setMarker(null);
    if (S().mode === 'free' && !S().next) ui().setObjective('FREE ROAM', `${ERA.region}, ${ERA.year}: yours to wander, on foot or by vallam`);
    if (G.activity && G.activity.enc) G.activity = null;
    if (en.tk) en.tk.cancelled = true;
    E.active = null; E.cool = cool;
  }
  // the encounter's story, run on the free-roam clock (a mission starting cancels it cleanly)
  async function run(en, fn) {
    en.phase = 'running'; en.blip = false;
    en.tk = { cancelled: false };
    const A = S().api(en.tk);
    try { await fn(A); } catch (e) { if (e && e.message) console.warn('encounter', e); }
    finally { end(en); }
  }
  // wait for the player to use a spot (high priority, so a villager's own 'Talk' never steals it)
  const waitAt = async (en, A, pos, r, label) => { let used = false; const it = en.int(pos, r, label, null, () => { used = true; en.unint(it); }); await A.until(() => used); };
  const A_toast = (t) => ui().toast(t, 3);
  const obj = (text, pos) => { ui().setObjective('STRANGER', text); ui().setMarker(pos || null); };
  // mash E to fill a bar (binding a wound, fixing a chain, lifting a wheel); resolves true when full
  const mash = (A, label, rate = 0.13, decay = 0.12, limit = 12) => new Promise((res) => {
    let v = 0, t = 0;
    G.activity = { enc: true, label, action: () => { v += rate; G.audio?.sfx('swing', 0.25); } };
    A.until((dt) => {
      t += dt; v = Math.max(0, v - decay * dt); ui().setMeter(label, v, v > 0.7);
      if (v >= 1 || t > limit || G.activity?.enc !== true) { if (G.activity?.enc) G.activity = null; ui().setMeter(null); res(v >= 1); return true; }
      return false;
    }).catch(() => res(false));
  });
  const villager = (female) => {
    const pool = female ? CAST.villagerF : CAST.villagerM.filter((v) => !v.headgear || v.headgear === 'thorthu');
    return { ...pick(pool) };
  };

  // ---------------------------------------------------------------- the encounters
  const TYPES = {
    // ---- a purse snatched in the road
    thief: {
      make(en) {
        const sp = en.spot;
        const vic = en.caller = en.spawn(pick(WOMEN), villager(true), sp.x, sp.z, sp.ry);
        const th = en.spawn('Pickpocket', { ...CAST.thug, mundu: 0x3a3428, shirt: undefined }, sp.x + sp.rx * 3, sp.z + sp.rz * 3, sp.ry, { health: 45 });
        th.canBeHit = true; en.thief = th; en.fled = false;
        en.calls = ['Kallan! Kallan! Thief! He has my purse!', 'Stop him! Somebody stop him!', 'Ayyo, my purse — all the rice money!'];
        vic.pose = 'cower';
      },
      update(en, dt, d) {
        if (!en.fled && d < 42) { en.fled = true; run(en, (A) => TYPES.thief.chase(en, A)); }
      },
      async chase(en, A) {
        const th = en.thief, vic = en.caller;
        obj('Catch the purse-snatcher', null);
        A.bark(vic.name, 'Kallan! That one — in the dark mundu! Catch him!', 3.5);
        let t = 0, stuck = 0, last = th.pos.clone(), turn = 0, caught = false;
        await A.until((dt) => {
          t += dt;
          if (th.ko) { caught = true; return true; }
          const w = pp(), dx = th.pos.x - w.x, dz = th.pos.z - w.z, d = Math.hypot(dx, dz) || 1;
          if (d < 1.5 && p().mode === 'foot') { caught = true; th.ko = true; th.h.state = 'ko'; G.audio?.sfx('thud'); return true; }
          if (d > 95) return true;
          if ((stuck += dt) > 1) { if (th.pos.distanceTo(last) < 1.2) turn = (Math.random() < 0.5 ? 1 : -1) * 1.5; else turn *= 0.5; last.copy(th.pos); stuck = 0; }
          const a = Math.atan2(dx, dz) + turn + Math.sin(t * 0.7) * 0.3, sp = t < 9 ? 6.1 : 4.4;
          th.goal = { x: th.pos.x + Math.sin(a) * 4, z: th.pos.z + Math.cos(a) * 4, speed: sp };
          ui().setMarker(th.pos);
          return false;
        });
        th.goal = null;
        if (!caught) { ui().setMarker(null); A.toast('He is gone, over the bund and into the paddy.', 4); return; }
        th.health = 0; th.ko = true; th.h.state = 'ko'; th.aiMode = 'ko';
        await A.dialog([[th, 'Enough! Enough, enough — take it! My children have not eaten since yesterday, I swear it.'], ['M', 'Every thief has hungry children.']]);
        A.toast('You have the purse. Take it back to her — or don\'t.', 4);
        obj(`Return the purse to ${vic.name}`, vic.pos);
        vic.pose = 'idle'; vic.facePlayer = true;
        await waitAt(en, A, vic.pos, 2.6, `Talk to ${vic.name}`);
        ui().setMarker(null);
        await A.dialog([[vic, 'You caught him! Is it — is the purse there?']]);
        const c = await ui().choose(['Give back the purse', 'Keep it for your trouble']);
        if (c === 0) {
          await A.dialog([['M', 'Here. Count it, it is all there.'], [vic, 'Eight annas for the ration shop, and the bus fare home. God bless you. Take this — no, take it.']]);
          reward(12, 'a reward from ' + vic.name); honour(2, 'returned a purse');
        } else {
          await A.dialog([['M', 'He must have dropped it running. I looked.'], [vic, 'Dropped it. Of course. You and he are the same, only he runs faster.']]);
          reward(40, 'the purse'); honour(-3, 'kept a stolen purse');
        }
      },
    },

    // ---- a snakebite at the edge of the paddy
    snake: {
      make(en) {
        const sp = en.spot;
        const man = en.spawn(pick(MEN), villager(false), sp.x, sp.z, sp.ry + 1.2, {}); man.pose = 'ko'; en.man = man;
        const wife = en.caller = en.spawn(pick(WOMEN), villager(true), sp.x + 1.1, sp.z + 0.4, sp.ry - 1.4); wife.pose = 'crouch';
        en.calls = ['Paambu! Paambu kadichu — a snake has bitten him! Help!', 'Somebody! Anyone! He is going cold!', 'Ayyo! Is there no one on this road?'];
        en.label = 'Help them';
      },
      async talk(en, A) {
        const man = en.man, wife = en.caller;
        await A.dialog([[wife, 'A snake, in the bund grass — a krait, I think, all black and white bands. The vaidyan is in the bazaar, it is too far!'], ['M', 'Let me see the bite.']]);
        const c = await ui().choose(['Cut, draw the poison and bind his leg', 'Run to the vaidyasala for medicine', 'Walk on']);
        if (c === 2) { await A.dialog([['M', 'I am sorry. I cannot help him.'], [wife, 'Then go! Go!']]); honour(-1, 'left a dying man'); return; }
        if (c === 0) {
          A.toast('Press <b>E</b> quickly to draw the poison and tie the cloth tight.', 5);
          const ok = await mash(A, 'Binding the wound', 0.075, 0.14, 12);
          if (ok && Math.random() < 0.85) {
            man.pose = 'sit';
            await A.dialog([[man, 'Ammé… my leg is fire. But I can feel it. I can feel it!'], [wife, 'You saved him. We have nothing, but take this — and come for sadya at Onam.']]);
            reward(16, 'their thanks'); honour(3, 'saved a snakebitten man'); return;
          }
          await A.dialog([[wife, 'He is not breathing — no, no, no…']]); wife.pose = 'cower'; honour(0); return;
        }
        // the medicine
        const shop = (SPOTS.shops || []).find((s) => s.kind === 'vaidyasala');
        if (!shop) return;
        await A.dialog([[wife, 'Ask for Kunjikrishnan vaidyar. Run!']]);
        let left = 120, got = false;
        obj('Fetch the snakebite medicine from the vaidyasala', shop.front);
        const it = en.int(shop.front, 3.2, 'Ask the vaidyar for snakebite medicine', () => !got, async () => { got = true; en.unint(it); reward(-6, 'the vaidyar\'s medicine'); A.toast('Run back with it!', 3); obj('Take the medicine back', man.pos); });
        await A.until((dt) => { left -= dt; ui().setTimer(`${Math.ceil(left)}`); return left <= 0 || (got && dist(man.pos) < 3); });
        ui().setTimer(null);
        if (got && left > 0) {
          man.pose = 'sit';
          await A.dialog([[wife, 'You came back! Quick, quick —'], [man, 'Bitter as neem… but the pain is going.'], [wife, 'God sent you down this road. Take this, please.']]);
          reward(24, 'their thanks'); honour(3, 'saved a snakebitten man');
        } else { await A.dialog([[wife, 'Too late. He is gone.']]); wife.pose = 'cower'; }
      },
    },

    // ---- a lost child
    child: {
      make(en) {
        const sp = en.spot;
        en.caller = en.spawn(pick(WOMEN), villager(true), sp.x, sp.z, sp.ry);
        en.calls = ['Unni! Unniii! Where are you?', 'Has anyone seen my boy? This high, a red shirt —', 'Unni! Come home, I am not angry!'];
        en.label = 'Ask what is wrong';
      },
      async talk(en, A) {
        const mum = en.caller;
        await A.dialog([[mum, 'My son — Unni, he is six. He went to watch the buses and now he is gone. Please, sir, please find him.'], ['M', 'Which way did he go?'], [mum, 'Towards the canal… I don\'t know!']]);
        const c = await ui().choose(['I will find him', 'Ask the police, not me']);
        if (c === 1) { await A.dialog([[mum, 'The police! They will take till Vishu.']]); return; }
        const at = openSpot(mum.pos.x, mum.pos.z, 45, 80); if (!at) return;
        const kid = en.spawn('Unni', { ...CAST.child, shirt: 0xa83a2a, mundu: undefined, trousers: 0x5a5040, shorts: true }, at.x, at.z, 0, {}); kid.pose = 'cower';
        const near = new THREE.Vector3(at.x + (Math.random() - 0.5) * 18, 0, at.z + (Math.random() - 0.5) * 18); near.y = groundAt(near.x, near.z);
        obj('Search for Unni around the marked area', near);
        A.toast('He is somewhere around the marker. Listen for crying.', 5);
        let cryT = 0;
        await A.until((dt) => { if ((cryT -= dt) <= 0) { cryT = 5; const d = dist(kid.pos); if (d < 45) speak('Unni', 'Amma… Ammaa…', 'bark', CAST.child, clamp(1 - d / 50, 0.15, 1)); } return dist(kid.pos) < 3.2; });
        ui().setMarker(null);
        await A.dialog([[kid, 'I followed a goat and then I didn\'t know the way…'], ['M', 'Come. Your amma is shouting the whole village awake.']]);
        kid.pose = 'idle'; kid.follow = p();
        obj('Take Unni back to his mother', mum.pos);
        await A.until(() => dist(mum.pos) < 4 && kid.pos.distanceTo(mum.pos) < 6);
        kid.follow = null;
        await A.dialog([[mum, 'Unni! You useless, wicked — come here.'], [mum, 'Thank you. Thank you. Here — it is not much.']]);
        reward(10, 'a mother\'s thanks'); honour(2, 'found a lost child');
      },
    },

    // ---- a drunk from the toddy shop, spoiling for a fight
    drunk: {
      make(en) {
        const sp = en.spot;
        const d = en.caller = en.spawn(pick(MEN), { ...villager(false), dirty: true }, sp.x, sp.z, sp.ry, { wander: 3, speed: 0.8, health: 60 });
        d.hitDmg = 7;
        en.calls = ['Ehh! You! Yes, you! What are you looking at?', 'Thirty years I climbed coconut trees! Thirty! And what do I have?', 'Come here, you big shirt, I will show you!'];
        en.label = 'Talk to the drunk';
      },
      async talk(en, A) {
        const d = en.caller; d.wander = 0;
        await A.dialog([[d, 'You think you are better than me? Hm? Because you have a shirt with buttons?']]);
        const c = await ui().choose(['Calm him down', 'Give him two annas for the bus home', 'Shove him out of the way']);
        if (c === 1) {
          if (!S().canPay(2)) { await A.dialog([['M', 'I have nothing on me.'], [d, 'Then you are worse off than me!']]); return; }
          reward(-2, 'bus fare for a drunk');
          await A.dialog([[d, 'Two annas… you are a good man. A good man. I will go home. My wife will kill me, but I will go home.']]);
          honour(1, 'sent a drunk home'); d.goal = { x: d.pos.x + 30, z: d.pos.z, speed: 1.0 }; await A.wait(3); return;
        }
        if (c === 0 && Math.random() < 0.55) {
          await A.dialog([['M', 'Go home, chetta. Sleep it off. Tomorrow is another day.'], [d, 'Tomorrow… yes. Tomorrow I will climb again. You are right. You are right.']]);
          honour(1, 'calmed a drunk'); await A.wait(2); return;
        }
        await A.dialog([[d, c === 2 ? 'You push me? ME?' : 'Don\'t you tell me to go home!']]);
        d.canBeHit = true; d.becomeHostile(false);
        obj('Deal with the drunk', null);
        await A.until(() => d.ko || dist(d.pos) > 40 || p().health <= 0);
        if (d.ko) { A.bark('Toddy tapper', 'Leave him. He will sleep there till the dogs wake him.', 4); if (c === 2) honour(-1, 'started a fight'); }
      },
    },

    // ---- a man in the road asking for help — and his friends in the bushes
    ambush: {
      cond: () => G.env.hour > 16 || G.env.hour < 6 || Math.random() < 0.4,
      make(en) {
        const sp = en.spot;
        const bait = en.caller = en.spawn(pick(MEN), { ...CAST.thug }, sp.x, sp.z, sp.ry, { health: 70 }); bait.pose = 'ko';
        en.calls = ['Help… please… they took everything…', 'Is someone there? Please — my leg…'];
        en.sprung = false;
      },
      update(en, dt, d) {
        if (!en.sprung && d < 6.5 && p().mode === 'foot') { en.sprung = true; run(en, (A) => TYPES.ambush.spring(en, A)); }
      },
      async spring(en, A) {
        const bait = en.caller, w = pp();
        const foes = [bait];
        for (let k = 0; k < 2; k++) {
          const a = Math.random() * Math.PI * 2, x = w.x + Math.cos(a) * 9, z = w.z + Math.sin(a) * 9;
          const t = en.spawn('Dacoit', { ...CAST.thug, shirt: undefined, mundu: 0x2a2620 }, x, z, 0, { guard: true, noLantern: true, health: 70 });
          foes.push(t);
        }
        bait.pose = 'idle'; bait.canBeHit = true; bait.stick = bait.h.hold(makeStick(1.3, 0x3a2a1a));
        A.bark(bait.name, 'Now! Get him!', 2.5);
        G.audio?.sfx('growl');
        for (const f of foes) { f.canBeHit = true; f.relentless = false; f.becomeHostile(false); f.hitDmg = 9; }
        obj('Dacoits! Fight them off — or run', null);
        await A.until(() => foes.every((f) => f.ko) || dist(foes[0].pos) > 60 && foes.every((f) => f.ko || dist(f.pos) > 45) || p().health <= 0);
        if (foes.every((f) => f.ko)) {
          const loot = 20 + Math.floor(Math.random() * 30);
          A.toast('The dacoits lie groaning in the road.', 4);
          reward(loot, 'the dacoits\' takings'); honour(1, 'beat off an ambush');
        } else if (p().health > 0) A.toast('You got away.', 3);
      },
    },

    // ---- a bicycle with its chain off, the milk going sour
    cycle: {
      make(en) {
        const sp = en.spot;
        en.caller = en.spawn(pick(MEN), villager(false), sp.x, sp.z, sp.ry); en.caller.pose = 'crouch';
        // the bicycle on its side, two milk cans on the carrier spilled beside it
        const bike = en.prop(makeBicycle(0x1c1a16).root); const fx = Math.sin(sp.ry), fz = Math.cos(sp.ry);
        bike.position.set(sp.x + fx * 1.1, groundAt(sp.x + fx * 1.1, sp.z + fz * 1.1) + 0.08, sp.z + fz * 1.1); bike.rotation.set(0, sp.ry + Math.PI / 2, Math.PI / 2 - 0.12);
        for (const k of [-1, 1]) { const can = en.prop(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.5, 10), new THREE.MeshStandardMaterial({ color: 0xb8b8b0, metalness: 0.7, roughness: 0.35 }))); can.position.set(sp.x + fx * 1.6 + k * 0.5, groundAt(sp.x, sp.z) + 0.25, sp.z + fz * 1.6); can.castShadow = true; }
        en.calls = ['Ayyo, this chain! Every day this chain!', 'Somebody give me a hand — the milk will turn by noon!'];
        en.label = 'Offer a hand';
      },
      async talk(en, A) {
        const m = en.caller; m.pose = 'idle';
        await A.dialog([[m, 'The chain has come off and jammed. Two cans of milk for the tea shops, and they wait for no one. Can you hold the wheel while I work it?']]);
        const c = await ui().choose(['Help him fix it', 'Walk on']);
        if (c === 1) return;
        A.toast('Press <b>E</b> quickly to work the chain back on.', 4);
        const ok = await mash(A, 'Fixing the chain', 0.09, 0.12, 10);
        if (ok) {
          await A.dialog([[m, 'Hah! It runs! Here — drink, it is fresh this morning. And a little something.']]);
          p().health = Math.min(100, p().health + 30); reward(4, 'thanks from the milkman'); honour(1, 'helped a stranger');
        } else await A.dialog([[m, 'Never mind, never mind. I will push it. Thank you for trying.']]);
      },
    },

    // ---- election season: posters to paste
    posters: {
      make(en) {
        const sp = en.spot, red = Math.random() < 0.5;
        en.red = red;
        en.caller = en.spawn(red ? 'Party worker' : 'Congress volunteer', { ...villager(false), shirt: red ? 0xa8261c : 0xf2efe6, headgear: red ? undefined : 'cap', gearColor: 0xf6f2e6 }, sp.x, sp.z, sp.ry);
        en.calls = red ? ['Comrade! A minute for the Party!', 'Inquilab Zindabad! Who will help the workers?'] : ['Brother! A minute for the Congress!', 'Jai Hind! Help an old Congressman, son!'];
        en.label = 'Hear him out';
      },
      async talk(en, A) {
        const m = en.caller;
        await A.dialog([[m, en.red ? 'Comrade, three walls along this road still have no poster. My arm is bad. Two annas a poster — the Party pays, eventually.' : 'Son, I have three posters and these knees. Paste them on the walls down the road and I will see you right.']]);
        const c = await ui().choose(['Paste the posters', 'Not my party']);
        if (c === 1) { await A.dialog([[m, en.red ? 'Every man is in the Party, comrade. Some just don\'t know it yet.' : 'Everyone was Congress in \'47. Remember that.']]); return; }
        const spots = [];
        for (let k = 0; k < 3; k++) { const s = openSpot(m.pos.x, m.pos.z, 18 + k * 12, 30 + k * 14); if (s) spots.push(s); }
        let done = 0;
        for (const s of spots) {
          const post = new THREE.Group();
          const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.0, 5), new THREE.MeshStandardMaterial({ color: 0x9a8a5a }));
          stake.position.y = 1.0; post.add(stake);
          const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.95), new THREE.MeshStandardMaterial({ color: en.red ? 0xc8261c : 0xf0e6c8, side: THREE.DoubleSide }));
          sheet.position.set(0, 1.45, 0.06); sheet.visible = false; post.add(sheet);
          post.position.set(s.x, groundAt(s.x, s.z), s.z); post.rotation.y = Math.random() * 6; en.prop(post);
          s.post = post; s.sheet = sheet; s.pos = post.position;
        }
        const next = () => spots.find((s) => !s.sheet.visible);
        for (let s = next(); s; s = next()) {
          obj(`Paste the posters (${done}/${spots.length})`, s.pos);
          await waitAt(en, A, s.pos, 2.2, 'Paste the poster');
          s.sheet.visible = true; done++; G.audio?.sfx('page');
        }
        obj('Go back for your money', m.pos);
        await waitAt(en, A, m.pos, 2.6, 'Collect your pay');
        await A.dialog([[m, en.red ? 'Lal salaam! Six annas, as promised. The revolution keeps its word.' : 'Good boy. Six annas, and my blessing.']]);
        reward(6, 'poster money'); honour(1, null);
      },
    },

    // ---- a telegram that must not wait
    telegram: {
      make(en) {
        const sp = en.spot;
        en.caller = en.spawn('Telegraph peon', { ...villager(false), shirt: 0x8a7d5a, trousers: 0x8a7d5a, shorts: true, headgear: 'cap', gearColor: 0x8a7d5a }, sp.x, sp.z, sp.ry);
        en.calls = ['Telegram! Urgent telegram! And this cursed tyre —', 'Is there anyone going towards the lanes? An urgent wire!'];
        en.label = 'Ask the peon';
      },
      async talk(en, A) {
        const m = en.caller;
        const who = G.npcs.filter((n) => n.active && n.lines && !n.hostile && dist(n.pos) > 60 && dist(n.pos) < 260 && !en.npcs.includes(n));
        if (!who.length) { await A.dialog([[m, 'Never mind — I will walk it.']]); return; }
        const to = pick(who);
        await A.dialog([[m, `A wire for ${to.name}, from Madras. My tyre is flat and it is marked urgent. You know the way? I will give you two annas of my own.`]]);
        const c = await ui().choose(['Deliver the telegram', 'Sorry, I am busy']);
        if (c === 1) return;
        obj(`Deliver the telegram to ${to.name}`, to.pos);
        await waitAt(en, A, to.pos, 2.6, `Give ${to.name} the telegram`);
        ui().setMarker(null);
        const good = Math.random() < 0.6;
        await A.dialog(good
          ? [['M', 'A telegram for you. From Madras.'], [to, 'From Madras? My son… he has passed! B.A. Second Class! Wait, wait, take something, sweets are not ready yet—']]
          : [['M', 'A telegram for you. From Madras.'], [to, '"Father serious. Come at once." … Thank you for bringing it. I must find the bus timings.']]);
        reward(good ? 8 : 2, good ? 'happy news' : 'the peon\'s two annas'); honour(1, null);
      },
    },
  };

  // ---------------------------------------------------------------- the clock
  G.updaters.push((dt) => {
    const st = S();
    if (E.active && (!st || st.mode !== 'free' || st.failing)) { end(E.active, 60); return; }
    if (!G.started || !st || st.mode !== 'free') return;
    const en = E.active;
    if (en) {
      en.t += dt;
      if (en.phase === 'running' && !st.busy && dist(en.pos) > 250 && (!en.caller || dist(en.caller.pos) > 250)) { A_toast('You left them behind.'); end(en, 60); return; }
      const d = en.caller ? dist(en.caller.pos) : dist(en.pos);
      if (en.phase === 'calling') {
        if (en.caller) en.pos.copy(en.caller.pos);
        if ((en.callT -= dt) <= 0 && en.calls.length && d < 85) {
          en.callT = 4.5 + Math.random() * 2.5;
          const line = en.calls[Math.floor(Math.random() * en.calls.length)];
          speak(en.caller?.name || '', line, 'bark', en.caller?.h?.preset, clamp(1.1 - d / 80, 0.12, 1));
          if (d < 30 && !st.busy) ui().bark(en.caller?.name || '', line, 3.5, en.caller?.h?.preset);
          en.caller.talkT = 2.5;
        }
        TYPES[en.type].update?.(en, dt, d);
        if (en.phase === 'calling' && d > 170) end(en, 30);
      }
      return;
    }
    if (st.busy || G.activity || p().locked || p().health <= 0) return;
    if ((E.cool -= dt) > 0) return;
    const pool = Object.keys(TYPES).filter((k) => !E.recent.slice(0, 3).includes(k) && (!TYPES[k].cond || TYPES[k].cond()));
    const type = pick(pool.length ? pool : Object.keys(TYPES));
    const spot = roadSpot(38, 70);
    if (!spot) { E.cool = 12; return; }
    const e2 = begin(type, spot);
    TYPES[type].make(e2);
    if (TYPES[type].talk && e2.caller) {
      const c = e2.caller;
      e2.int(c.pos, 2.7, e2.label || `Talk to ${c.name}`, () => e2.phase === 'calling', () => run(e2, (A) => TYPES[type].talk(e2, A)));
    }
  });

  // for testing: KAYAL.encounter('thief') starts one up the road
  return (type) => { if (E.active) end(E.active, 0); E.cool = 0; const spot = roadSpot(20, 60); if (!spot) return 'no road'; const e2 = begin(type, spot); TYPES[type].make(e2); if (TYPES[type].talk && e2.caller) { const c = e2.caller; e2.int(c.pos, 2.7, e2.label || `Talk to ${c.name}`, () => e2.phase === 'calling', () => run(e2, (A) => TYPES[type].talk(e2, A))); } return e2.caller ? [Math.round(e2.pos.x), Math.round(e2.pos.z)] : 'ok'; };
}
