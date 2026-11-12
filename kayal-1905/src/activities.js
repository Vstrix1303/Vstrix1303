// Things to do between missions: lost ledger pages, fishing, ferries,
// a tailor, tea, cargo runs, whistling for your horse, discovering places.
import * as THREE from 'three';
import { G } from './state.js';
import { SPOTS } from './structures.js';
import { LOC, getHeight } from './heightfield.js';
import { groundAt } from './physics.js';
import { CAST } from './characters.js';
import { makePickup, fmtMoney } from './story.js';
import { PLACES } from './places.js';

const PAGE_LINES = [
  '“Ouseph, boatman — lent Rs 12, entered Rs 90.”', '“Kunjipennu, widow — lent Rs 60, entered Rs 300.”', '“Interest to be reckoned monthly, and upon the interest.”',
  '“Thumb-marks to be taken before the sums are written.”', '“Kannimala: wages entered Rs 4, paid Rs 2 as. 8.”', '“Remit to Madras by the first steamer. E.H.”',
  '“The Peishkar\'s inspector dines at the bungalow. Show him the green book.”', '“Pathrose — crop lien, three seasons.”', '“Forty holdings, 212 acres, to be consolidated by Onam.”',
  '“Alikutty will not sign. Send the captain.”', '“Kerosene, 4 tins, charged to sundries.”', '“The red book is never to leave the counting-house.”',
];
const FISH = [['a karimeen (pearl-spot)', 10, 16], ['a varal (snakehead)', 6, 11], ['a fat konju (river prawn)', 12, 22], ['a kari (catfish)', 4, 8], ['a chemballi (red snapper)', 10, 18], ['an old sandal', 0, 0]];

export function setupActivities(scene, W, amb) {
  const p = () => G.player, S = () => G.story, ui = () => G.ui;
  const free = () => S() && S().mode === 'free' && !G.activity && p().mode === 'foot';
  const A = G.act = {};
  const V = (x, z, y) => new THREE.Vector3(x, y ?? groundAt(x, z), z);

  A.stop = () => {
    const a = G.activity; if (!a) return;
    G.activity = null;
    p().locked = false; p().poseOverride = null; p().rod.visible = false; p().stick.visible = p().mode === 'foot';
    ui().setTimer(null);
    if (a.onStop) a.onStop();
  };

  // ------------------------------------------------ lost ledger pages
  const ps = [
    [SPOTS.island.x + 2, SPOTS.island.z + 1], [SPOTS.lighthouse.x + 4, SPOTS.lighthouse.z - 9], [SPOTS.fort.x - 13, SPOTS.fort.z - 9], [SPOTS.fallsView.x, SPOTS.fallsView.z],
    [SPOTS.kavu.x + 2, SPOTS.kavu.z + 2], [SPOTS.estateGate.x - 9, SPOTS.estateGate.z + 3], [LOC.tank.x + 14, LOC.tank.z + 15], [SPOTS.cutcherryYard.x - 22, SPOTS.cutcherryYard.z + 4],
    [SPOTS.toddy.x - 5, SPOTS.toddy.z + 3], [SPOTS.hamlet.x - 12, SPOTS.hamlet.z + 14], [SPOTS.pepperYard.x + 24, SPOTS.pepperYard.z - 22], [-30, 402],
  ];
  W.pages = ps.map(([x, z], i) => {
    const pos = V(x, z);
    const obj = makePickup(scene, pos, 'page');
    const has = () => S() && S().state.pages.includes(i);
    G.interactables.push({ pos, r: 2.2, label: 'Take the ledger page', cond: () => !has() && p().mode === 'foot', action: () => {
      S().state.pages.push(i); obj.visible = false;
      G.audio?.sfx('pickup');
      ui().bark(`Lost ledger page ${S().state.pages.length} of 12`, PAGE_LINES[i], 6);
      S().addMoney(8);
      if (S().state.pages.length === 12) { S().addMoney(800, 'the Peishkar\'s bounty for the complete ledger'); }
    } });
    return { i, pos, obj, has };
  });

  // ------------------------------------------------ fishing
  const fishSpots = [V(SPOTS.villageJettyEnd.x + 1, SPOTS.villageJettyEnd.z, 0.75), V(SPOTS.portJettyEnd.x, SPOTS.portJettyEnd.z - 1, 0.85), V(SPOTS.hamletJettyEnd.x + 3, 150, 0.75), V(SPOTS.falls.x - 13, SPOTS.falls.z - 6)];
  W.fishSpots = fishSpots;
  for (const pos of fishSpots) {
    G.interactables.push({ pos, r: 2.6, label: 'Cast a line', cond: () => free() && S().state.done >= 1, action: () => {
      const pl = p();
      pl.locked = true; pl.poseOverride = 'fish'; pl.rod.visible = true; pl.stick.visible = false;
      const a = G.activity = { kind: 'fish', t: 3 + Math.random() * 7, bite: 0, label: 'Reel in and stop' };
      a.action = () => {
        if (a.bite > 0) {
          const f = FISH[(Math.random() * FISH.length) | 0], val = f[1] + Math.round(Math.random() * (f[2] - f[1]));
          G.audio?.sfx('splash'); G.fx.splash(pl.pos, 6, 0.8);
          S().state.fish++;
          if (val > 0) S().addMoney(val, `you landed ${f[0]}`); else ui().toast(`You landed ${f[0]}. The kayal has a sense of humour.`, 4);
        }
        A.stop();
      };
      a.update = (dt) => {
        if (a.bite > 0) { a.bite -= dt; if (a.bite <= 0) { ui().toast('It slipped the hook.', 3); A.stop(); } return; }
        a.t -= dt;
        if (a.t <= 0) { a.bite = 1.3; a.label = 'STRIKE!'; G.audio?.sfx('wade'); G.fx.splash({ x: pl.pos.x + Math.sin(pl.yaw) * 3, y: 0, z: pl.pos.z + Math.cos(pl.yaw) * 3 }, 5, 0.6); ui().toast('A bite! <b>E</b> — strike!', 1.4); }
      };
      ui().toast('Line out. Wait for the bite, then <b>E</b> to strike.', 4);
    } });
  }

  // ------------------------------------------------ ferries (fast travel between jetties)
  W.ferries = [
    { name: 'Thekkumkara', pos: SPOTS.arrive.clone(), yaw: Math.PI / 2 },
    { name: 'Puthenthura', pos: SPOTS.portLanding.clone(), yaw: Math.PI },
    { name: 'Azhikkal', pos: SPOTS.hamletJettyEnd.clone().add(new THREE.Vector3(-6, 0, 0)), yaw: -Math.PI / 2 },
  ];
  const FARE = 4;
  A.ferryTo = async (i) => {
    const f = W.ferries[i], st = S();
    if (!st.canPay(FARE)) { ui().toast('The ferryman wants <b>4 annas</b>. You have not got it.', 4); return; }
    st.addMoney(-FARE);
    p().locked = true;
    await ui().fade(1, 0.7);
    p().teleport(f.pos.x, f.pos.z, f.yaw);
    G.env.setTime(G.env.hour + 0.4);
    await ui().fade(0, 1.0);
    p().locked = false;
    ui().toast(`The ferry sets you down at <b>${f.name}</b>.`, 4);
  };
  const ferryman = (name, x, z, yaw, idx) => amb(name, CAST.villagerM[6], x, z, yaw, { facePlayer: true, talkLabel: 'Take the ferry (4 annas)', talkCond: () => free() && S().state.done >= 1, onTalk: () => G.mapUI.open({ ferry: true, from: idx }) });
  ferryman('Ferryman', SPOTS.arrive.x + 6, SPOTS.arrive.z + 1.0, -Math.PI / 2, 0);
  ferryman('Ferryman', SPOTS.portLanding.x + 1.3, SPOTS.portLanding.z - 9, 0, 1);
  ferryman('Ferryman', SPOTS.hamletJettyEnd.x - 9, 150.9, Math.PI / 2, 2);

  // ------------------------------------------------ the tailor of Puthenthura
  {
    const keys = Object.keys(CAST.outfits);
    let idx = 0, offerT = -99;
    amb('Tailor', { ...CAST.villagerM[3], headgear: 'fez' }, -437.5, -392.6, 0, { facePlayer: true, talkLabel: 'Tailor — browse / buy', talkCond: free, onTalk: (n) => {
      const st = S().state;
      if (G.time - offerT < 9) {
        const k = keys[idx], o = CAST.outfits[k];
        if (!st.outfits.includes(k)) { if (!S().canPay(o.price)) { n.speak(`${fmtMoney(o.price)}, and not an anna less. Come back when the pepper is sold.`); return; } S().addMoney(-o.price); st.outfits.push(k); }
        st.outfit = k; p().setOutfit(k); S().save();
        G.audio?.sfx('pickup');
        n.speak(`${o.name}. It sits well on a boatman's shoulders.`);
        offerT = -99;
      } else {
        idx = (idx + 1) % keys.length;
        const k = keys[idx], o = CAST.outfits[k], own = st.outfits.includes(k);
        n.speak(`“${o.name}” — ${own ? 'yours already' : fmtMoney(o.price)}. Speak to me again to ${own ? 'put it on' : 'buy it'}.`);
        offerT = G.time;
      }
    } });
  }

  // ------------------------------------------------ tea
  amb('Tea-seller', CAST.villagerM[3], SPOTS.teaShop.x + 0.3, SPOTS.teaShop.z + 0.2, 2.2, { facePlayer: true, talkLabel: 'Buy a glass of chaya (1 anna)', onTalk: (n) => {
    if (!S().canPay(1) && S().state.done > 1) { n.speak('No annas? Sit anyway. Pay me when the Company pays you.'); }
    else if (S().state.done > 1) S().addMoney(-1);
    p().health = 100; p().stamina = 100;
    n.speak(['Hot, sweet, and strong enough to stand a spoon in.', 'Chaya cures everything but debt, Madhava.', 'First glass of the monsoon. Drink.'][(Math.random() * 3) | 0]);
    G.audio?.sfx('pickup');
  } });

  // ------------------------------------------------ cargo runs for the quay clerk
  amb('Quay clerk', { ...CAST.villagerM[5], headgear: 'cap' }, -403.6, -340.5, Math.PI / 2, { facePlayer: true, talkLabel: 'Ask for a cargo run', talkCond: () => free() && S().state.done >= 3, onTalk: (n) => {
    const dest = Math.random() < 0.5 ? W.ferries[0] : W.ferries[2];
    n.speak(`Six sacks of ginger for ${dest.name}, and the tide will not wait. Four minutes. Two rupees if it arrives dry.`);
    const vb = W.vallams[1];
    vb.cargo.visible = true;
    const a = G.activity = { kind: 'cargo', t: 240, label: null, dest };
    ui().setObjective('CARGO RUN', `Carry the ginger to ${dest.name} by vallam`); ui().setMarker(dest.pos);
    a.update = (dt) => {
      a.t -= dt;
      const m = Math.floor(a.t / 60), s = Math.floor(a.t % 60);
      ui().setTimer(`${m}:${String(s).padStart(2, '0')}`);
      const pp = p().worldPos();
      if (p().mode === 'foot' && Math.hypot(pp.x - dest.pos.x, pp.z - dest.pos.z) < 12 && Math.hypot(vb.pos.x - dest.pos.x, vb.pos.z - dest.pos.z) < 40) {
        S().state.jobs++; S().addMoney(32 + (a.t > 90 ? 16 : 0), a.t > 90 ? 'cargo delivered, with a bonus for speed' : 'cargo delivered'); A.stop();
      } else if (a.t <= 0) { ui().toast('Too slow — the clerk gave the cargo to another boat.', 5); A.stop(); }
    };
    a.onStop = () => { vb.cargo.visible = false; S().enterFree(); };
  } });

  // ------------------------------------------------ whistle
  A.whistle = () => {
    const h = W.horse, pl = p();
    if (!h.usable || pl.mode !== 'foot' || h.rider) return;
    G.audio?.sfx('whistle');
    const d = Math.hypot(h.pos.x - pl.pos.x, h.pos.z - pl.pos.z);
    if (d > 90) {
      // bring him in from just out of sight, behind the camera
      for (let k = 0; k < 10; k++) {
        const a = pl.camYaw + (Math.random() - 0.5) * 1.2, r = 38 + k * 3;
        const x = pl.pos.x + Math.sin(a) * r, z = pl.pos.z + Math.cos(a) * r;
        if (getHeight(x, z) > 0.4) { h.pos.set(x, getHeight(x, z), z); break; }
      }
    }
    h.call = true;
  };

  // ------------------------------------------------ discovery & per-frame upkeep
  let scan = 0, lastPlace = null;
  G.updaters.push((dt, t) => {
    const st = S(); if (!st || !G.started) return;
    for (const pg of W.pages) { const v = !pg.has(); if (pg.obj.visible !== v) pg.obj.visible = v; if (v) pg.obj.userData.spin.rotation.y = t * 1.5 + pg.i; }
    if (G.activity && G.activity.update) G.activity.update(dt);
    scan -= dt;
    if (scan > 0) return;
    scan = 0.5;
    const pp = p().worldPos();
    let here = null;
    for (const pl of PLACES) { if (!pl.r) continue; if (Math.hypot(pp.x - pl.x, pp.z - pl.z) < pl.r && (!here || pl.r < here.r)) here = pl; }
    if (here && here !== lastPlace && !st.busy && !p().locked) {
      const isNew = !st.state.places.includes(here.id);
      if (isNew) { st.state.places.push(here.id); st.save(); }
      ui().area(here.name, isNew ? 'DISCOVERED' : '');
    }
    lastPlace = here;
  });
}
