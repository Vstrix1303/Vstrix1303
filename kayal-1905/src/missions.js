// The story of KAYAL in nine missions.
//   Act I  — The Red Ledger        (Homecoming, Black Gold, The Backwater Run, The Red Ledger)
//   Act II — The House of Harrow   (The Senior Partner, Fire on the Quay, Vallamkali,
//                                   The Elephant Road, Storm over the Kayal)
import * as THREE from 'three';
import { G } from './state.js';
import { SPOTS } from './structures.js';
import { LOC, getHeight, ROADS } from './heightfield.js';
import { groundAt } from './physics.js';
import { Rider } from './npc.js';
import { Boat } from './entities.js';
import { CAST, Elephant, makeKettuvallam } from './characters.js';
import { lerp, smoothstep, clamp, angleDamp } from './util.js';

const V = (x, z) => new THREE.Vector3(x, getHeight(x, z), z);
const insideCompound = (w) => w.x > -505.5 && w.x < -450.5 && w.z > -372.5 && w.z < -320.5;
const isNight = (env) => env.hour < 5.5 || env.hour > 18.6;
const placeHorse = (W, x, z, yaw) => { W.horse.pos.set(x, getHeight(x, z), z); W.horse.yaw = yaw; W.horse.speed = 0; W.horse.call = false; };
const dockBoat = (b, s, yaw) => { b.pos.set(s.x, 0, s.z); b.yaw = yaw; b.speed = 0; };

// ======================================================================
//  ACT I
// ======================================================================
async function homecoming(S, A, W, p, env) {
  const C = W.cast, ui = G.ui;
  S.resetWorld();
  env.setTime(6.12); env.setRain(0, true);
  G.audio?.setMood('dawn');
  dockBoat(W.boat, SPOTS.villageBoat, -Math.PI / 2);
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
  await A.title('ACT I  ·  THE RED LEDGER');
  await A.dialog([
    [C.ouseph, 'There she is, Madhava. Thekkumkara. Six years and nothing has changed — only the debts have grown.'],
    ['M', 'And my uncle, Ouseph chetta? Your letter spoke of trouble.'],
    [C.ouseph, 'The Company\'s agent — Finch sahib. He holds notes against half the gardens on this kayal, and he means to collect in land.'],
    [C.ouseph, 'Go home, mone. Raman chettan should tell you himself. Follow the red road east through the village.'],
  ]);
  ui.setHud(true);
  A.obj('Walk home to the tharavadu, your family house', SPOTS.homeGate);
  A.toast('<b>W A S D</b> move &nbsp;·&nbsp; <b>Mouse</b> look &nbsp;·&nbsp; <b>Shift</b> run &nbsp;·&nbsp; <b>Space</b> jump &nbsp;·&nbsp; <b>M</b> map', 10);
  await A.reach(SPOTS.homeGate, 6);
  A.obj('Greet Raman Ammavan on the verandah', SPOTS.homeDoor);
  await A.reach(SPOTS.homeDoor, 4.2);
  await A.dialog([
    [C.ammavan, 'Madhava! Six monsoons gone, and you come back taller than the gatepost.'],
    ['M', 'Ammava. Ouseph says Finch means to take the land.'],
    [C.ammavan, 'He says we owe eight hundred rupees. I borrowed two hundred, the year the blight took the vines. I put my thumb to his paper — I cannot read his English.'],
    [C.devaki, 'I can. I have seen his receipts, chetta, and the sums do not agree. Somewhere there is a true account… and a false one.'],
    [C.ammavan, 'Enough, mole. First the instalment — thirty rupees by tomorrow, or the bailiff comes with his chain and his peons.'],
    [C.ammavan, 'The pepper is ripe on the hill. When you have washed the road off your feet, come to me and we will bring in the harvest.'],
  ]);
}

async function blackGold(S, A, W, p, env) {
  const C = W.cast, ui = G.ui;
  await A.begin({ time: isNight(env) ? 8.4 : null, rain: 0, quick: true });
  G.audio?.setMood('calm');
  await A.title();
  ui.bark('Raman Ammavan', 'The garden is east along the red road, where the hill begins. A sack for every row of vines, Madhava.', 5);
  A.obj('Go to the family pepper garden in the foothills', SPOTS.pepperYard);
  await A.reach(SPOTS.pepperYard, 16);
  let got = 0, ambushed = false, down = 0;
  const total = SPOTS.pepperSacks.length;
  const text = () => `Gather the pepper harvest (${got}/${total})`;
  A.toast('Look for the glowing sacks among the vines. <b>E</b> — gather', 7);
  const sacks = SPOTS.pepperSacks.map((pos) => A.pickup(pos, 'sack'));
  const nearest = () => { let b = null, bd = 1e9; sacks.forEach((s) => { if (!s.taken) { const d = A.dist(s.position); if (d < bd) { bd = d; b = s; } } }); return b; };
  const mark = () => { const n = nearest(); ui.setMarker(n && (!ambushed || down >= 2) ? n.position : null); };
  sacks.forEach((s) => {
    A.interact(s.position, 2.3, 'Gather pepper').then(() => { s.taken = true; s.dispose(); got++; G.audio?.sfx('pickup'); if (!ambushed || down >= 2) ui.setObjective(S.tag, text()); mark(); }).catch(() => {});
  });
  A.obj(text(), nearest().position);
  await A.until(() => got >= 3);
  ambushed = true;
  S.onKO = () => { down++; };
  // they come up from the road, on the player's side of the garden
  let ax = LOC.pepper.x - 46 - p.pos.x, az = LOC.pepper.z + 30 - p.pos.z;
  const al = Math.hypot(ax, az) || 1; ax /= al; az /= al;
  const far = Math.min(al, 30);
  C.toughs.forEach((t, i) => { t.reset(); t.setActive(true); t.place(p.pos.x + ax * far - az * i * 2.5, p.pos.z + az * far + ax * i * 2.5, Math.atan2(-ax, -az)); t.becomeHostile(false); });
  ui.bark('Company peon', 'You there! This garden is under lien to Harrow & Finch. Put down those sacks!', 5);
  G.audio?.setMood('chase');
  A.obj('Drive off the Company\'s men', null);
  A.toast('<b>Left Mouse</b> / <b>F</b> strike &nbsp;·&nbsp; hold <b>Right Mouse</b> / <b>Q</b> to block', 8);
  await A.until(() => down >= 2);
  G.audio?.setMood('calm');
  ui.bark('Madhavan', 'Tell Finch the harvest is spoken for.', 4);
  if (got < total) { A.obj(text(), nearest()?.position || null); await A.until(() => got >= total); }
  A.obj('Carry the harvest down to Ouseph at the village jetty', SPOTS.ouseph);
  await A.reach(SPOTS.ouseph, 4.5);
  await A.dialog([
    [C.ouseph, 'Peons in the pepper garden already? Finch is in a hurry, then. That is a frightened man, Madhava — and frightened men make mistakes.'],
    [C.ouseph, 'My vallam is yours when you want her. Puthenthura lies north-west across the water; Moideen Hajji gives an honest price.'],
  ]);
}

async function backwaterRun(S, A, W, p, env) {
  const C = W.cast, ui = G.ui;
  await A.begin({ time: 16.2, rain: 0, quick: true, setup: () => { dockBoat(W.boat, SPOTS.villageBoat, -Math.PI / 2); p.teleport(SPOTS.ouseph.x - 3, SPOTS.ouseph.z + 0.6, -Math.PI / 2); } });
  G.audio?.setMood('calm');
  W.boat.cargo.visible = true; W.boatsUnlocked = true;
  await A.title();
  await A.dialog([
    [C.ouseph, 'She is loaded — six sacks, dry as bone. Steer for the Chinese nets and keep the island on your left hand.'],
    ['M', 'And if the weather turns?'],
    [C.ouseph, 'It is June in Travancore, mone. The weather always turns.'],
  ]);
  A.obj('Board Ouseph\'s vallam', W.boat.pos);
  await A.until(() => p.mode === 'boat' && p.mount === W.boat);
  A.toast('<b>W</b> paddle &nbsp;·&nbsp; steer with the camera &nbsp;·&nbsp; <b>Shift</b> paddle hard (tires you)', 8);
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
    [C.moideen, 'Lay that red ledger before the Peishkar at the hill Cutcherry and it is Finch who will owe. Come to me when you are ready, and I will tell you how the compound is watched.'],
  ]);
  env.setRain(0);
}

async function redLedger(S, A, W, p, env, cp) {
  const C = W.cast, ui = G.ui, scene = G.scene;
  if (cp !== 'ride') {
    await A.begin({ time: 4.3, rain: 0.12, dark: true, setup: () => {
      env.frozen = true;
      p.teleport(SPOTS.portSquare.x + 2, SPOTS.portSquare.z + 8, -Math.PI / 2);
      placeHorse(W, SPOTS.stableHorse.x, SPOTS.stableHorse.z, SPOTS.stableFace); W.horse.usable = false;
      C.guards.forEach((g) => { g.reset(); g.setActive(true); g.perceive = true; g.showCone = true; });
    } });
    G.audio?.setMood('night');
    await A.fade(0, 2);
    await A.title();
    await A.dialog([
      [C.moideen, 'The Peishkar leaves for Trivandrum at sunrise, so it must be now — the hour before dawn, when the watch is sleepiest.'],
      [C.moideen, 'There is a gap in the east wall the coolies use. The book is kept on the counting-house verandah. Go with God, Madhava.'],
    ]);
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
    const desk = A.pickup(new THREE.Vector3(SPOTS.ledger.x, groundAt(SPOTS.ledger.x, SPOTS.ledger.z), SPOTS.ledger.z), 'ledger');
    A.obj('Take the red ledger from the counting-house verandah', SPOTS.ledger);
    await A.interact(desk.position, 2.4, 'Take the red ledger');
    desk.remove(desk.userData.book); desk.children.forEach((c) => { if (c.isSprite) c.visible = false; });
    G.audio?.sfx('pickup');
    ui.toast('You have the <b>red ledger</b>', 4);
    await A.wait(0.8);
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
    A.checkpoint('ride');
  } else {
    await A.begin({ time: 4.75, rain: 0, setup: () => {
      placeHorse(W, SPOTS.stableHorse.x, SPOTS.stableHorse.z, SPOTS.stableFace);
      p.teleport(SPOTS.stableHorse.x, SPOTS.stableHorse.z, SPOTS.stableFace);
      p.mountHorse(W.horse); p.camYaw = SPOTS.stableFace + Math.PI;
    } });
  }
  // ---------------- the ride
  env.frozen = false; env.dayRate = 1 / 62; env.setRain(0);
  W.horse.usable = true;
  G.audio?.setMood('chase');
  ui.card('', 'Ride for the Cutcherry', '', 2.6);
  A.toast('<b>Shift</b> — gallop. Stay on the road; the riders are slower than Sultan, but not by much.', 8);
  const way = [[-470, -384], [-330, -394], [-250, -385], [-170, -330], [-110, -250], [50, -268], [230, -312], [400, -318]].map(([x, z]) => V(x, z));
  way.push(SPOTS.cutcherryYard.clone());
  let wi = 0;
  while (wi < way.length - 1 && A.dist(way[wi]) < 40) wi++;
  A.obj('Ride for the hill Cutcherry before the Peishkar departs — follow the road', way[wi]);
  let spawned = false, warned = false, dawnLine = false;
  const spawn = () => {
    spawned = true;
    for (let i = 0; i < 3; i++) W.riders.push(new Rider(scene, SPOTS.stableHorse.x - 6 - i * 3, SPOTS.stableHorse.z + 6 + (i - 1) * 4, Math.PI / 2, 11.2 + i * 0.25));
    ui.bark('Company rider', 'After him! He has the sahib\'s book!', 4);
  };
  await A.until(() => {
    if (!spawned && A.dist(SPOTS.stableHorse) > 42) spawn();
    if (wi < way.length - 1 && A.dist(way[wi]) < 34) { wi++; ui.setMarker(way[wi]); }
    for (const r of W.riders) {
      if (r.nearT > 1.25 && !S.failing) S.fail('The Company\'s riders dragged you from the saddle.');
      if (r.dist < 12 && !warned) { warned = true; ui.bark('Company rider', 'Stop! In the name of the Company!', 3.5); }
    }
    if (!dawnLine && env.hour > 5.75 && env.hour < 7) { dawnLine = true; ui.bark('Madhavan', 'First light. The Peishkar will be calling for his carriage. Run, Sultan — run!', 5); }
    return A.dist(SPOTS.cutcherryYard) < 22;
  });
  // ---------------- arrival
  S.invulnerable = true; p.locked = true;
  W.riders.forEach((r) => (r.halt = true));
  G.audio?.setMood('none');
  await A.fade(1, 0.9);
  W.riders.forEach((r) => r.dispose()); W.riders.length = 0;
  C.guards.forEach((g) => g.setActive(false));
  const cy = SPOTS.cutcherryYard;
  p.dismount(true, new THREE.Vector3(cy.x, 0, cy.z - 3));
  p.yaw = Math.PI; p.root.rotation.y = Math.PI;
  placeHorse(W, cy.x + 7, cy.z + 3, 2.6);
  C.finch.setActive(true); C.finch.pose = 'idle'; C.finch.place(cy.x - 4.5, cy.z + 1.5, Math.PI * 0.9);
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
    [C.finch, 'You would not dare. The Resident shall hear of this — and so shall Sir Edmund!'],
    [C.peishkar, 'The Resident shall read of it, in my report. The notes are suspended. Sepoys — the agent is not to leave Puthenthura.'],
    [C.peishkar, 'Go home, Madhavan. Keep the horse until the inquiry ends; I shall write you a receipt for him. And tell your sister the Durbar has need of people who can read a ledger.'],
  ], { other: C.peishkar });
  p.locked = true;
  await A.fade(1, 2);
  // ---------------- epilogue of Act I
  S.resetWorld();
  p.locked = true;
  env.setTime(17.55); env.setRain(0, true); env.frozen = false;
  const hg = SPOTS.homeGate;
  p.teleport(hg.x, hg.z + 3, 0);
  p.camYaw = Math.PI * 0.75; p.camPitch = 0.1;
  placeHorse(W, hg.x - 5, hg.z + 4, 1); W.horse.usable = true;
  dockBoat(W.boat, SPOTS.villageBoat, -Math.PI / 2);
  ui.setHud(false); ui.letterbox(true);
  const c0 = new THREE.Vector3(hg.x + 30, 16, hg.z + 46);
  const cine = { hard: true, pos: c0.clone(), look: new THREE.Vector3(LOC.home.x, 4, LOC.home.z), fov: 44, t: 0 };
  cine.update = (dt) => { cine.t += dt; cine.pos.set(c0.x - cine.t * 0.9, c0.y - cine.t * 0.12, c0.z - cine.t * 0.5); };
  p.setCine(cine);
  G.audio?.setMood('calm');
  await A.fade(0, 2.5);
  await A.narrate('The notes of Harrow & Finch were suspended that same morning. For the first time in three years, Thekkumkara slept without counting.', 7.5);
  await A.narrate('But a trading house is not one man. In Madras, the senior partner read the Peishkar\'s report — and sent for his carriage.', 7.5);
  await A.card('END OF ACT I', 'The Red Ledger', 'Sultan is yours — press X to whistle for him', 5.5);
  p.setCine(null); ui.letterbox(false); ui.setHud(true);
  S.invulnerable = false; p.locked = false;
}

// ======================================================================
//  ACT II
// ======================================================================
async function seniorPartner(S, A, W, p, env) {
  const C = W.cast, ui = G.ui;
  const hg = SPOTS.homeGate;
  await A.begin({ time: 7.4, rain: 0, dark: true, setup: () => {
    p.teleport(hg.x + 1, hg.z + 2.5, Math.PI);
    C.devaki.place(hg.x - 1.2, hg.z + 0.6, 0);
    placeHorse(W, hg.x - 5, hg.z + 5, 1.2);
  } });
  G.audio?.setMood('dawn');
  await A.card('ACT II', 'The House of Harrow', 'Three weeks later', 4.5);
  await A.fade(0, 1.6);
  await A.title('ACT II  ·  THE HOUSE OF HARROW');
  await A.dialog([
    [C.devaki, 'The Peishkar\'s letter came with the anchal runner, chetta. “Examiner of Accounts, on probation.” I begin today — if you will take me up the hill.'],
    ['M', 'On Sultan? Ammavan still calls him the stolen horse.'],
    [C.devaki, 'Ammavan says the Peishkar\'s receipt makes him ours till the inquiry ends. He also says to mind the potholes.'],
  ]);
  A.obj('Mount Sultan — Devaki will ride behind you', W.horse.pos);
  await A.until(() => p.mode === 'horse');
  C.devaki.attachTo(W.horse.root, 0, W.horse.q.seatY + 0.02, -0.5, Math.PI / 2, 'sidesaddle');
  A.obj('Ride with Devaki to the hill Cutcherry', SPOTS.cutcherryYard);
  const d0 = A.dist(SPOTS.cutcherryYard);
  let line = 0;
  await A.until(() => {
    const d = A.dist(SPOTS.cutcherryYard);
    if (line === 0 && d < d0 * 0.8) { line = 1; ui.bark('Devaki', 'Forty families, chetta. I have read every page now. He did not even trouble to disguise his hand.', 6); }
    if (line === 1 && d < d0 * 0.5) { line = 2; ui.bark('Devaki', 'They say a woman cannot sit in a Cutcherry. They said a boatman could not shame a Company, too.', 6); }
    if (line === 2 && d < d0 * 0.22) { line = 3; ui.bark('Devaki', 'There is a carriage in the yard. Black, with a crest. That is no Travancore carriage.', 5); }
    return d < 16;
  });
  // ---- the yard: Sir Edmund Harrow
  p.locked = true;
  await A.fade(1, 0.8);
  const cy = SPOTS.cutcherryYard;
  C.devaki.detach();
  p.dismount(true, new THREE.Vector3(cy.x + 1, 0, cy.z - 2));
  p.yaw = Math.PI; p.root.rotation.y = Math.PI; p.camYaw = 0.4; p.camPitch = 0.1;
  placeHorse(W, cy.x + 9, cy.z + 4, 2.6);
  C.devaki.place(cy.x - 1, cy.z - 1.6, Math.PI);
  C.harrow.setActive(true); C.harrow.place(cy.x - 4.2, cy.z - 6.5, 1.2);
  C.dacre.setActive(true); C.dacre.place(cy.x - 6, cy.z - 5, 1.3);
  await A.wait(0.4);
  await A.fade(0, 1.4);
  G.audio?.setMood('night');
  await A.dialog([
    [C.harrow, 'So this is the boatman. I had expected someone taller. Sir Edmund Harrow — senior partner. I have come from Madras to tidy what Finch left untidy.'],
    [C.peishkar, 'Sir Edmund has petitioned the Resident. The ledger, he says, was obtained by burglary and cannot be read in evidence.'],
    [C.harrow, 'A stolen book proves nothing, Peishkar, except that it was stolen. The Assistant Resident will hear the matter in ten days. Until then I advise everyone here… to consider their position.'],
    [C.dacre, 'Captain Dacre. Late of the Madras Police. I look after the Company\'s property. All of it.'],
    [C.peishkar, 'He is right in one thing — a single book is thin. But every family was given a receipt for what it truly borrowed. Bring me those receipts, sworn, and the ledger need not stand alone.'],
    [C.devaki, 'Three families I am sure of: Kunjipennu below the hill road, Pathrose in the north fields, Alikutty beyond the canal.'],
  ], { other: C.peishkar });
  C.harrow.setActive(false); C.dacre.setActive(false);
  C.devaki.place(cy.x - 3.4, cy.z - 7.5, 0.3);
  // ---- the receipts
  const F = C.farmers, got = [false, false, false];
  let n = 0;
  const lines = [
    [[F[0], 'Raman\'s nephew! I kept the paper in the rice-pot, where no peon would think to look. Sixty rupees I borrowed. Sixty — not three hundred.']],
    [[F[1], 'Take it, and God go with it. My father signed with a cross because he could not write. Finch signed for him after that.']],
    [[F[2], 'Here. And tell the Peishkar that Alikutty will swear on the Book, in any court he names.']],
  ];
  const refresh = () => {
    let best = -1, bd = 1e9;
    for (let i = 0; i < 3; i++) if (!got[i]) { const d = A.dist(SPOTS.farms[i]); if (d < bd) { bd = d; best = i; } }
    A.obj(`Collect the families' sworn receipts (${n}/3)`, best >= 0 ? SPOTS.farms[best] : null);
  };
  refresh();
  A.toast('Three farmsteads, any order. Check the map (<b>M</b>) — Sultan or a vallam will save your legs.', 8);
  let down = 0;
  S.onKO = () => { down++; };
  for (let k = 0; k < 3; k++) {
    let which = -1;
    await A.until(() => { for (let i = 0; i < 3; i++) if (!got[i] && A.dist(SPOTS.farms[i]) < (n === 2 ? 26 : 4.5) && (n === 2 || p.mode === 'foot')) { which = i; return true; } return false; });
    if (n === 2) {
      // Harrow's men got to the last farm first
      const f = SPOTS.farms[which];
      F[which].pose = 'cower';
      C.thugs.forEach((t, i) => { t.reset(); t.setActive(true); t.place(f.x + 3 + i * 1.8, f.z + 2 - i * 1.5, 0); });
      ui.bark('Harrow\'s man', 'The captain says nobody on this lake has any papers. Hand it over, old one!', 5);
      A.obj('Harrow\'s men are at the farm — drive them off', f);
      await A.until(() => A.dist(f) < 12);
      C.thugs.forEach((t) => t.becomeHostile(false));
      G.audio?.setMood('chase');
      await A.until(() => down >= 3);
      G.audio?.setMood('calm');
      F[which].pose = 'idle';
      A.obj('Speak to the farmer', f);
      await A.until(() => A.dist(f) < 4.5 && p.mode === 'foot');
    }
    await A.dialog(lines[which]);
    got[which] = true; n++;
    G.audio?.sfx('pickup');
    refresh();
  }
  ui.bark('Madhavan', 'Three receipts, three thumbs. The anchal runner will have them at the Cutcherry by dark.', 5);
  await A.wait(2.5);
}

async function fireOnTheQuay(S, A, W, p, env, cp) {
  const C = W.cast, ui = G.ui, scene = G.scene, fx = G.fx;
  const sq = SPOTS.portSquare;
  if (cp !== 'chase') {
    await A.begin({ time: 22.3, rain: 0, setup: () => { p.teleport(SPOTS.moideen.x + 2.5, SPOTS.moideen.z + 0.5, -Math.PI / 2); env.frozen = true; placeHorse(W, sq.x - 6, sq.z - 4, 0.4); } });
    G.audio?.setMood('night');
    await A.title();
    await A.dialog([
      [C.moideen, 'Harrow sent his captain to my door this evening. “A merchant of your years should think of his warehouse,” he says.'],
      [C.moideen, 'I told him I have thought of little else for forty years — and that I will still testify.'],
      ['M', 'Hajji… do you smell that?'],
    ]);
    // ---- fire!
    G.audio?.sfx('bell');
    G.audio?.setMood('chase');
    const hx = -416, hz = -356;
    const spots = [[hx + 1, 8.6, hz - 2], [hx - 2, 9.0, hz + 2.5], [hx + 6.6, 4.4, hz + 1.5], [-406, 1.2, -349], [-388, 2.2, -350]];
    const fires = spots.map(([x, y, z]) => {
      const pos = new THREE.Vector3(x, groundAt(x, z) + y, z);
      const em = fx.addEmitter({ pos, type: 'fire', rate: 30, scale: 1.4 });
      return { pos, em, out: false };
    });
    A.temp({ dispose: () => fires.forEach((f) => fx.removeEmitter(f.em)) });
    ui.bark('Moideen Hajji', 'FIRE! The spice house — Ya Allah, the whole season is in there! Water, bring water!', 5);
    p.setCarry('bucket'); p.bucketFull = false;
    C.moideen.pose = 'cheer';
    const helpers = [0, 1].map((i) => A.spawn('Townsman', CAST.villagerM[i + 1], -424 + i * 3, -372, 0, { route: [V(-427, -374), V(-410 + i * 4, -352 - i * 6)], speed: 3.4 }));
    helpers.forEach((h) => { h.h.carry = true; });
    let doused = 0;
    const total = fires.length, T0 = 210;
    let tLeft = T0;
    const text = () => `Douse the flames (${doused}/${total}) — fill the bucket at the well or in the kayal`;
    const nearestFire = () => { let b = null, bd = 1e9; for (const f of fires) if (!f.out) { const d = A.dist(f.pos); if (d < bd) { bd = d; b = f; } } return b; };
    const well = V(-428, -376);
    const fill = () => { if (!p.bucketFull) { p.bucketFull = true; p.setCarry('bucket'); G.audio?.sfx('splash', 0.6); fx.splash(p.pos, 5, 0.6); const f = nearestFire(); ui.setMarker(f ? f.pos : null); } };
    A.hotspot(well, 3.4, 'Fill the bucket', () => !p.bucketFull, fill);
    A.hotspot(SPOTS.portLanding, 4.5, 'Fill the bucket', () => !p.bucketFull, fill);
    fires.forEach((f) => A.hotspot(f.pos, 7.5, 'Throw water on the fire', () => p.bucketFull && !f.out, () => {
      f.out = true; doused++; p.bucketFull = false; p.setCarry('bucket');
      fx.removeEmitter(f.em); fx.steam(f.pos, 14); fx.splash(f.pos, 10, 1.2);
      G.audio?.sfx('hiss');
      ui.setObjective(S.tag, text()); ui.setMarker(well);
    }));
    A.obj(text(), well);
    A.toast('<b>E</b> fill at the well or the jetty (wading into the kayal fills it too), then <b>E</b> at each fire.', 9);
    await A.until((dt) => {
      tLeft -= dt;
      ui.setMeter('The spice house', tLeft / T0);
      if (!p.bucketFull && p.mode === 'foot' && getHeight(p.pos.x, p.pos.z) < -0.25 && !p.onDeck) fill();
      if (tLeft <= 0 && !S.failing) S.fail('The spice house burned to the ground.');
      return doused >= total;
    });
    ui.setMeter(null);
    p.setCarry(null);
    C.moideen.pose = 'idle';
    helpers.forEach((h) => { h.h.carry = false; h.route = null; h.aiMode = 'idle'; h.pose = 'cheer'; });
    G.audio?.sfx('passed');
    ui.bark('Moideen Hajji', 'It holds! The roof holds! — There, by the church: a rider with a tin under his arm. That is Dacre\'s lantern-man!', 6);
    A.checkpoint('chase');
    await A.wait(1.5);
  } else {
    await A.begin({ time: 22.6, rain: 0, setup: () => { p.teleport(sq.x, sq.z + 2, 0); env.frozen = true; placeHorse(W, sq.x - 6, sq.z - 4, 0.4); } });
  }
  // ---- run the fire-raiser down
  G.audio?.setMood('chase');
  W.horse.usable = true;
  const path = [[-400, -382], [-330, -394], [-250, -385], [-170, -330], [-110, -250], [-40, -272], [50, -268], [140, -290], [230, -312], [320, -335], [400, -318]].map(([x, z]) => V(x, z));
  const r = new Rider(scene, -436, -392, Math.PI / 2, 10.7, CAST.thug);
  r.path = path; r.lantern.visible = true;
  W.riders.push(r);
  A.obj('Mount Sultan and run the fire-raiser down', W.horse.pos);
  await A.until(() => p.mode === 'horse');
  A.toast('Ride alongside him and hold there — Madhavan will drag him from the saddle.', 7);
  let grab = 0;
  await A.until((dt) => {
    ui.setMarker(r.pos);
    const d = A.dist(r.pos);
    r.max = d > 70 ? 8.8 : d < 14 ? 11.6 : 10.7;
    grab = d < 4.6 && p.mode === 'horse' ? grab + dt : Math.max(0, grab - dt * 0.6);
    ui.setMeter('Drag him down', grab / 1.7, true);
    if ((r.pathDone || d > 280) && !S.failing) S.fail('The fire-raiser got away into the hills.');
    return grab >= 1.7;
  });
  ui.setMeter(null);
  p.locked = true; S.invulnerable = true;
  G.audio?.sfx('thud');
  await A.fade(1, 0.6);
  const at = r.pos.clone();
  r.dispose(); W.riders.length = 0;
  p.dismount(true, new THREE.Vector3(at.x + 1.5, 0, at.z));
  placeHorse(W, at.x - 3, at.z + 3, p.yaw);
  const man = A.spawn('Fire-raiser', CAST.thug, at.x, at.z, 0, { pose: 'cower' });
  man.pos.y = groundAt(at.x, at.z); man.sync();
  p.yaw = Math.atan2(at.x - p.pos.x, at.z - p.pos.z); p.root.rotation.y = p.yaw; p.camYaw = p.yaw + Math.PI + 0.5;
  await A.wait(0.4);
  await A.fade(0, 1.2);
  G.audio?.setMood('night');
  await A.dialog([
    [man, 'Mercy, mercy! It was the captain — eight rupees and a tin of kerosene from the Company godown. Look, the brand is on it. Look!'],
    ['M', 'Then you will say so to the Peishkar, with the tin in your hands. Get up. Walk.'],
  ]);
  env.frozen = false; S.invulnerable = false; p.locked = false;
}

async function vallamkali(S, A, W, p, env) {
  const C = W.cast, ui = G.ui, scene = G.scene;
  const jx = SPOTS.arrive.x;
  await A.begin({ time: 15.6, rain: 0, setup: () => { p.teleport(SPOTS.ouseph.x - 2.5, SPOTS.ouseph.z + 0.4, -Math.PI / 2); env.frozen = true; } });
  G.audio?.setMood('calm');
  await A.title();
  await A.dialog([
    [C.ouseph, 'Champakulam day, Madhava! Every village on the kayal sends a boat. Harrow has hired Alleppey oarsmen and put up fifty rupees — he wants the whole lake to watch the Company win.'],
    [C.ouseph, 'Our helmsman has the fever. You steered a lighter through Bombay harbour. Take the stern oar.'],
    ['M', 'And if we win?'],
    [C.ouseph, 'Then forty families remember whose side luck is on. That is worth more than fifty rupees… though we shall take the fifty.'],
  ]);
  await A.fade(1, 0.7);
  // ---- the course
  const gates = [[-300, 10], [-345, -120], [-414, -62], [-352, 10], [-250, 40]].map(([x, z]) => new THREE.Vector3(x, 0, z));
  const sx = jx - 34;
  const boats = [
    { name: 'Thekkumkara', b: new Boat(scene, sx, 40, -Math.PI / 2, { chundan: true, crew: 6, trim: 0xb8402c }), player: true },
    { name: 'Harrow & Finch', b: new Boat(scene, sx, 28, -Math.PI / 2, { chundan: true, crew: 6, trim: 0x1c2c4c, look: CAST.rival }), base: 7.25, off: -7 },
    { name: 'Kainakary', b: new Boat(scene, sx, 52, -Math.PI / 2, { chundan: true, crew: 6, trim: 0x2f6a3a }), base: 6.95, off: 7 },
    { name: 'Azhikkal', b: new Boat(scene, sx, 16, -Math.PI / 2, { chundan: true, crew: 6, trim: 0xc9a13a }), base: 6.75, off: -13 },
  ];
  boats.forEach((o) => { o.gate = 0; o.done = false; W.extraBoats.push(o.b); if (!o.player) o.b.rider = o; });
  A.temp({ dispose: () => { if (p.mount && boats.some((o) => o.b === p.mount)) p.dismount(true, SPOTS.arrive.clone()); boats.forEach((o) => { o.b.dispose(); const i = W.extraBoats.indexOf(o.b); if (i >= 0) W.extraBoats.splice(i, 1); }); } });
  const flags = gates.map((g, i) => A.temp(W.makeFlag(g.x, g.z, i === gates.length - 1 ? 0xf2e9c8 : 0xb8402c)));
  const crowd = [];
  for (let i = 0; i < 9; i++) crowd.push(A.spawn('Villager', i % 3 === 2 ? CAST.villagerF[i % 4] : CAST.villagerM[i % 7], jx + 2 + (i % 5) * 1.6, 38.6 + Math.floor(i / 5) * 2.4, -Math.PI / 2, { pose: 'cheer' }));
  const pb = boats[0].b;
  p.mountBoat(pb); p.camYaw = Math.PI / 2 + 0.25; p.camPitch = 0.24;
  p.locked = true;
  await A.wait(0.4);
  await A.fade(0, 1.2);
  A.obj('Vallamkali — round the island and back to the flag. Finish first.', gates[0]);
  A.toast('<b>W</b> stroke &nbsp;·&nbsp; <b>Shift</b> racing stroke — the crew tires, so ease off to let them breathe.', 9);
  G.audio?.setMood('chase');
  for (const n of ['3', '2', '1']) { G.audio?.sfx('drum'); ui.card('', n, '', 0.55); await A.wait(1.0); }
  G.audio?.sfx('bell'); ui.card('', 'ARPPO!', 'irro… irro… irro!', 1.2);
  p.locked = false;
  let finished = null;
  const prog = (o) => o.gate * 1000 - Math.hypot(o.b.pos.x - gates[Math.min(o.gate, gates.length - 1)].x, o.b.pos.z - gates[Math.min(o.gate, gates.length - 1)].z);
  await A.until((dt) => {
    const me = boats[0];
    for (const o of boats) {
      if (o.done) { o.b.drive(dt, 0, 0, false); continue; }
      const g = gates[o.gate];
      const d = Math.hypot(o.b.pos.x - g.x, o.b.pos.z - g.z);
      if (d < (o.gate === gates.length - 1 ? 13 : 20)) {
        o.gate++;
        if (o.gate >= gates.length) { o.done = true; if (!finished) finished = o; continue; }
        if (o.player) { ui.setMarker(gates[o.gate]); G.audio?.sfx('pickup'); }
      }
      if (!o.player) {
        const t = gates[o.gate], nx = -(t.z - o.b.pos.z), nz = t.x - o.b.pos.x, nl = Math.hypot(nx, nz) || 1;
        const tx = t.x + nx / nl * o.off * 0.5, tz = t.z + nz / nl * o.off * 0.5;
        const lead = prog(o) - prog(me);
        o.b.spBase = o.base * (lead > 22 ? 0.93 : lead < -26 ? 1.07 : 1);
        o.b.drive(dt, tx - o.b.pos.x, tz - o.b.pos.z, false);
      }
    }
    const rank = 1 + boats.filter((o) => !o.player && prog(o) > prog(me)).length;
    ui.setTimer(`${['1st', '2nd', '3rd', '4th'][rank - 1]} of 4`);
    return !!finished;
  });
  ui.setTimer(null);
  if (!finished.player) { S.fail(`${finished.name} took the flag.`); return; }
  G.audio?.sfx('passed');
  crowd.forEach((c) => (c.pose = 'cheer'));
  ui.card('', 'Thekkumkara wins!', 'Fifty rupees — and the whole kayal watching', 3.6);
  p.locked = true;
  await A.wait(3.6);
  await A.fade(1, 0.8);
  p.dismount(true, new THREE.Vector3(SPOTS.ouseph.x - 2.5, 0.75, SPOTS.ouseph.z + 0.4));
  p.yaw = Math.PI / 2; p.root.rotation.y = p.yaw; p.camYaw = -Math.PI / 2 + 0.4;
  boats.forEach((o) => { o.b.root.visible = false; });
  await A.wait(0.3);
  await A.fade(0, 1.2);
  G.audio?.setMood('calm');
  await A.dialog([
    [C.ouseph, 'Did you see Sir Edmund\'s face? Like a man who has bitten a green mango. He paid — in front of everyone, he had to pay.'],
    [C.ouseph, 'They will stand with us at the hearing now, mone. Every boat on this water.'],
  ]);
  env.frozen = false; p.locked = false;
  S.state.wins = (S.state.wins || 0) + 1;
}

async function elephantRoad(S, A, W, p, env, cp) {
  const C = W.cast, ui = G.ui, scene = G.scene;
  const cy = SPOTS.cutcherryYard, gate = SPOTS.estateGate;
  const herdAt = V(349, -258);
  if (cp !== 'escape') {
    await A.begin({ time: 19.7, rain: 0, setup: () => { p.teleport(cy.x - 1.5, cy.z - 5.5, Math.PI); env.frozen = true; placeHorse(W, cy.x + 8, cy.z + 3, 2.4); } });
    G.audio?.setMood('night');
    await A.title();
    await A.dialog([
      [C.devaki, 'A tea-plucker\'s child brought this up from Kannimala — Harrow\'s estate. The kangani there, Velu, keeps the check-roll: every coolie\'s true wage, set against what the Company claimed to pay.'],
      [C.devaki, 'The books are forged at both ends, chetta. What they lent, and what they paid. With the check-roll no barrister alive can save him.'],
      [C.devaki, 'But Dacre found out. Velu is locked in the store-shed behind the factory. If he is not in this yard by morning, he will not be anywhere.'],
    ]);
    A.obj('Ride up to Kannimala Estate — take the spur north off the hill road', gate);
    await A.until(() => A.dist(gate) < 46);
    C.estateGuards.forEach((g) => { g.reset(); g.setActive(true); g.perceive = true; g.showCone = true; });
    A.toast('Leave Sultan outside the gate. <b>C</b> — crouch. The watch carries lanterns.', 9);
    A.obj('Free Velu from the store-shed behind the factory', SPOTS.veluCell);
    let alarm = false;
    S.onAlert = () => {
      if (alarm) return; alarm = true;
      ui.bark('Estate watchman', 'Someone in the yard! Turn out, turn out!', 3.5);
      G.audio?.setMood('chase');
      C.estateGuards.forEach((g) => { if (g.active && !g.ko) g.becomeHostile(false); });
    };
    await A.interact(SPOTS.veluCell, 2.6, 'Break the lock');
    G.audio?.sfx('thud');
    C.velu.setActive(true); C.velu.place(SPOTS.veluCell.x + 0.4, SPOTS.veluCell.z + 1.2, 0);
    await A.dialog([
      [C.velu, 'The boatman! Devaki-amma said you would come. The check-roll is under my shirt — every name, every anna.'],
      ['M', 'Can you ride?'],
      [C.velu, 'I can hold on. Go — go!'],
    ]);
    G.audio?.sfx('bell');
    if (!alarm) { alarm = true; G.audio?.setMood('chase'); C.estateGuards.forEach((g) => g.becomeHostile(false)); }
    ui.bark('Estate watchman', 'The shed is open! He has the kangani!', 4);
    C.velu.follow = p; C.velu.walkSpeed = 6.6;
    A.obj('Get Velu to Sultan and ride', W.horse.pos);
    await A.until(() => p.mode === 'horse');
    A.checkpoint('escape');
  } else {
    await A.begin({ time: 20.4, rain: 0, setup: () => { env.frozen = true; placeHorse(W, gate.x, gate.z + 4, Math.PI); p.teleport(gate.x, gate.z + 4, Math.PI); p.mountHorse(W.horse); p.camYaw = 0; C.velu.setActive(true); } });
  }
  // ---- down the elephant road
  C.velu.follow = null;
  C.velu.attachTo(W.horse.root, 0, W.horse.q.seatY, -0.48, 0, 'ride');
  G.audio?.setMood('chase');
  // the herd, standing on the estate road
  const herd = [[347, -262, 1.0], [341, -251, 0.62], [356, -247, 1.08]].map(([x, z, sc], i) => {
    const e = new Elephant({ scale: sc });
    e.root.traverse((o) => o.layers.set(1));
    scene.add(e.root);
    const o = { e, pos: V(x, z), yaw: 2 + i, charge: 0, cool: 0, home: V(x, z) };
    e.root.position.copy(o.pos); e.root.rotation.y = o.yaw;
    return o;
  });
  A.temp({ dispose: () => herd.forEach((h) => scene.remove(h.e.root)) });
  for (let i = 0; i < 2; i++) W.riders.push(new Rider(scene, SPOTS.estateYard.x + i * 4, SPOTS.estateYard.z + 6, Math.PI, 11.0 + i * 0.3));
  A.obj('Ride down to the Cutcherry with Velu', cy);
  let warned = false, turned = false, passed = false;
  await A.until((dt) => {
    const pp = p.worldPos();
    const dh = A.dist(herdAt);
    if (!warned && dh < 75) { warned = true; ui.bark('Velu', 'Aana! Elephants on the road — slow, slow! Walk him past and they will let us be.', 6); A.toast('Elephants: pass at a <b>walk</b> (release Shift, ease off W). Gallop and they charge.', 8); }
    if (dh < 30 && pp.z < herdAt.z - 4) passed = true;
    if (!passed && pp.z < herdAt.z - 30) passed = true;
    for (const h of herd) {
      const dx = pp.x - h.pos.x, dz = pp.z - h.pos.z, d = Math.hypot(dx, dz);
      h.cool -= dt;
      if (h.charge <= 0 && h.cool <= 0 && d < 15 && p.speedNow > 5.2 && h.e.root.scale.x > 0.8) { h.charge = 3.4; G.audio?.sfx('elephant', 1.6); ui.bark('Velu', 'It is charging! Ride!', 3); }
      if (h.charge > 0) {
        h.charge -= dt;
        h.yaw = angleDamp(h.yaw, Math.atan2(dx, dz), 4, dt);
        const sp = 8.6;
        h.pos.x += Math.sin(h.yaw) * sp * dt; h.pos.z += Math.cos(h.yaw) * sp * dt; h.pos.y = getHeight(h.pos.x, h.pos.z);
        h.e.speed = sp;
        if (d < 3.2) {
          h.charge = 0; h.cool = 6;
          if (p.mode === 'horse') p.dismount(true);
          p.damage(45, h.pos.x, h.pos.z); G.audio?.sfx('thud');
        }
        if (h.charge <= 0) h.cool = 5;
      } else { h.e.speed = 0; if (Math.hypot(h.pos.x - h.home.x, h.pos.z - h.home.z) > 26) h.home.copy(h.pos); }
      h.e.update(dt);
      h.e.root.position.copy(h.pos); h.e.root.rotation.y = h.yaw;
    }
    // the pursuit meets the herd
    for (const r of W.riders) {
      if (r.nearT > 1.25 && !S.failing) S.fail('The estate riders pulled you down.');
      if (!turned && passed && Math.hypot(r.pos.x - herdAt.x, r.pos.z - herdAt.z) < 26) {
        turned = true;
        G.audio?.sfx('elephant', 1.8);
        ui.bark('Estate rider', 'Aana! AANA! Turn back — turn back!', 4);
        W.riders.forEach((q) => { q.path = [SPOTS.estateYard.clone()]; q.max = 12; });
        herd.forEach((h) => { h.yaw = Math.atan2(r.pos.x - h.pos.x, r.pos.z - h.pos.z); });
      }
    }
    if (C.velu.attached && p.mode !== 'horse') { /* thrown: Velu waits by the horse */ }
    return A.dist(cy) < 18 && p.mode === 'horse';
  });
  p.locked = true; S.invulnerable = true;
  await A.fade(1, 0.8);
  W.riders.forEach((r) => r.dispose()); W.riders.length = 0;
  C.velu.detach();
  p.dismount(true, new THREE.Vector3(cy.x + 1, 0, cy.z - 3));
  p.yaw = Math.PI; p.root.rotation.y = Math.PI; p.camYaw = 0.45; p.camPitch = 0.1;
  placeHorse(W, cy.x + 8, cy.z + 3, 2.4);
  C.velu.place(cy.x + 2.6, cy.z - 4, Math.PI);
  await A.wait(0.4);
  await A.fade(0, 1.4);
  G.audio?.setMood('night');
  await A.dialog([
    [C.velu, 'Here, yajamanane. Three years of wages, in my own hand. What the coolies were paid, and what the estate wrote that it paid.'],
    [C.peishkar, 'Wage by wage… Sir Edmund\'s barrister will not enjoy his breakfast.'],
    [C.devaki, 'The hearing is the day after tomorrow, chetta. Sleep. I shall not.'],
  ], { other: C.peishkar });
  env.frozen = false; S.invulnerable = false; p.locked = false;
}

async function stormOverTheKayal(S, A, W, p, env, cp) {
  const C = W.cast, ui = G.ui, scene = G.scene;
  const cy = SPOTS.cutcherryYard;
  const pboat = W.vallams[1];
  if (!cp) {
    await A.begin({ time: 10.2, rain: 0.25, setup: () => {
      env.frozen = true;
      p.teleport(cy.x + 1.5, cy.z - 2, Math.PI); p.camYaw = 0.35; p.camPitch = 0.1;
      placeHorse(W, cy.x + 10, cy.z + 5, 2.4);
      C.devaki.place(cy.x - 1.4, cy.z - 4.2, Math.PI);
      C.velu.setActive(true); C.velu.place(cy.x + 4.2, cy.z - 3.2, Math.PI);
      C.moideen.place(cy.x - 4.6, cy.z - 1.5, Math.PI * 0.9);
      C.harrow.setActive(true); C.harrow.place(cy.x - 5.5, cy.z - 7.2, 1.0);
      C.carmichael.setActive(true); C.carmichael.pos.set(SPOTS.peishkar.x + 2.2, SPOTS.peishkar.y, SPOTS.peishkar.z); C.carmichael.fixedY = true; C.carmichael.yaw = 0; C.carmichael.sync();
      C.peishkar.pos.x = SPOTS.peishkar.x - 1.6; C.peishkar.sync();
    } });
    G.audio?.setMood('night');
    await A.title();
    await A.dialog([
      [C.carmichael, 'This is an inquiry under the Resident\'s authority, not a bazaar. Sir Edmund — your barrister says the red ledger was stolen, and proves nothing.'],
      [C.harrow, 'Precisely so. One book, taken by a burglar and read aloud by a girl.'],
      [C.devaki, 'Then set the book aside, sir. Here are the families\' receipts, sworn before the Peishkar. Here is the Kannimala check-roll, in the kangani\'s own hand. And here is a Company kerosene tin, found at the fire on the quay.'],
      [C.carmichael, '…The sums agree with one another, Sir Edmund. They do not agree with you.'],
      [C.carmichael, 'The Peishkar\'s finding stands. The Company\'s books and title-deeds at Puthenthura are to be seized and examined. Every one.'],
      [C.harrow, 'By all means, Mr. Carmichael. Seize whatever you can find.'],
      [C.moideen, 'Yajamanane — my boy has run up from the quay! Dacre has loaded the deed-chest on a kettuvallam. He is making for the bar, and there is a steamer standing off Azhimukham!'],
      [C.peishkar, 'If that chest reaches the steamer, forty title-deeds sail to Madras and are never seen again. Madhavan —'],
      ['M', 'I know that water, yajamanane. He does not.'],
    ], { other: C.carmichael });
    env.frozen = false; env.setRain(1);
    G.audio?.setMood('chase');
    dockBoat(pboat, SPOTS.portBoat, 0); W.boatsUnlocked = true;
    A.obj('Ride for the Puthenthura jetty!', SPOTS.portLanding);
    A.toast('<b>X</b> whistles Sultan to you. Down the hill road and west — the storm is breaking.', 7);
    await A.until(() => A.dist(SPOTS.portLanding) < 30);
    A.checkpoint('lake');
  } else if (cp === 'lake') {
    await A.begin({ time: 11, rain: 1, setup: () => { p.teleport(SPOTS.portLanding.x, SPOTS.portLanding.z - 6, 0); dockBoat(pboat, SPOTS.portBoat, 0); W.boatsUnlocked = true; } });
    G.audio?.setMood('chase');
  }
  const duelAt = SPOTS.duel, ag = SPOTS.aground;
  const kv = makeKettuvallam();
  scene.add(kv);
  A.temp({ dispose: () => scene.remove(kv) });
  if (cp !== 'duel') {
    // ---- the chase across the kayal
    const path = [[-430, -236], [-505, -120], [-566, -8], [-596, 30], [ag.x, ag.z]];
    const k = { i: 0, x: path[0][0], z: path[0][1], yaw: -2.4, going: false, sp: 5.3, done: false };
    kv.position.set(k.x, 0, k.z); kv.rotation.y = k.yaw;
    A.obj('Take a vallam from the jetty', pboat.pos);
    await A.until(() => p.mode === 'boat');
    ui.bark('Madhavan', 'There — the big rice-boat, running for the bar. Pull, pull!', 4.5);
    A.obj('Run down Dacre\'s kettuvallam before it clears the bar', new THREE.Vector3(k.x, 0, k.z));
    k.going = true;
    await A.until((dt) => {
      if (!k.done) {
        const t = path[k.i + 1], dx = t[0] - k.x, dz = t[1] - k.z, d = Math.hypot(dx, dz);
        k.yaw = angleDamp(k.yaw, Math.atan2(dx, dz), 1.5, dt);
        const st = Math.min(d, k.sp * dt);
        k.x += dx / d * st; k.z += dz / d * st;
        if (d < 1.5) { k.i++; if (k.i >= path.length - 1) k.done = true; }
        kv.position.set(k.x, Math.sin(G.time * 1.1) * 0.08, k.z); kv.rotation.set(Math.sin(G.time * 0.9) * 0.03, k.yaw, Math.sin(G.time * 1.3) * 0.05);
        ui.setMarker(new THREE.Vector3(k.x, 0, k.z));
        if (Math.random() < dt * 6) G.fx.splash({ x: k.x - Math.sin(k.yaw) * 7, y: 0, z: k.z - Math.cos(k.yaw) * 7 }, 2, 1.2);
      }
      return k.done;
    });
    kv.position.set(ag.x, 0.25, ag.z); kv.rotation.set(0.04, k.yaw, 0.16);
    ui.bark('Madhavan', 'He has run her aground on the bar! He will make for the lighthouse.', 5);
    A.checkpoint('duel');
  } else {
    await A.begin({ time: 11.4, rain: 1, setup: () => { dockBoat(pboat, new THREE.Vector3(ag.x + 14, 0, ag.z + 12), -1.2); p.teleport(ag.x - 2, ag.z - 6, -1.2); } });
    kv.position.set(ag.x, 0.25, ag.z); kv.rotation.set(0.04, -1.9, 0.16);
    G.audio?.setMood('chase');
  }
  // ---- the lighthouse
  env.setRain(1);
  C.dacre.reset(); C.dacre.setActive(true); C.dacre.place(duelAt.x, duelAt.z, 0.8);
  C.thugs[0].reset(); C.thugs[0].setActive(true); C.thugs[0].place(duelAt.x - 4, duelAt.z + 3, 0.8);
  const chest = A.pickup(new THREE.Vector3(SPOTS.chest.x, groundAt(SPOTS.chest.x, SPOTS.chest.z), SPOTS.chest.z), 'chest');
  A.obj('Land on the bar and stop Dacre at the Azhimukham light', duelAt);
  await A.until(() => p.mode === 'foot' && A.dist(duelAt) < 17);
  ui.bark('Captain Dacre', 'You again. Twenty years a policeman, boatman — I know how to put down a riot of one.', 5.5);
  A.toast('Hold <b>Right Mouse</b> / <b>Q</b> to block. Block just as the blow lands and he staggers. His overhead swing hurts — block it or step away.', 10);
  let down = 0;
  S.onKO = (n) => { down++; };
  C.dacre.becomeHostile(false); C.thugs[0].becomeHostile(false);
  A.obj('Defeat Captain Dacre', null);
  await A.until(() => { ui.setBoss('Captain Dacre', C.dacre.health / C.dacre.maxHealth); return C.dacre.ko; });
  ui.setBoss(null);
  G.audio?.setMood('none');
  C.thugs[0].hostile = false; if (!C.thugs[0].ko) { C.thugs[0].pose = 'cower'; }
  A.obj('Take the Company\'s deed-chest', chest.position);
  await A.interact(chest.position, 2.6, 'Take the deed-chest');
  G.audio?.sfx('passed');
  p.locked = true; S.invulnerable = true;
  await A.fade(1, 2);
  // ---- epilogue
  S.resetWorld();
  p.locked = true;
  env.setTime(17.5); env.setRain(0, true);
  const hg = SPOTS.homeGate;
  p.teleport(hg.x, hg.z + 3, 0); p.camYaw = Math.PI * 0.75; p.camPitch = 0.1;
  placeHorse(W, hg.x - 5, hg.z + 4, 1);
  dockBoat(W.boat, SPOTS.villageBoat, -Math.PI / 2);
  C.devaki.place(SPOTS.devaki.x, SPOTS.devaki.z, Math.PI);
  ui.setHud(false); ui.letterbox(true);
  const jx = SPOTS.arrive.x;
  const cine = { hard: true, pos: new THREE.Vector3(jx - 20, 5, 70), look: new THREE.Vector3(jx - 120, 4, 20), fov: 44, t: 0 };
  cine.update = (dt) => { cine.t += dt; cine.pos.set(jx - 20 - cine.t * 0.6, 5 + cine.t * 0.1, 70 - cine.t * 0.25); };
  p.setCine(cine);
  G.audio?.setMood('calm');
  await A.fade(0, 2.5);
  await A.narrate('The steamer lay off Azhimukham until dark, then put back to sea without her cargo.', 6.5);
  await A.narrate('Sir Edmund Harrow was examined for eleven days. That September, Harrow & Finch was struck from the register of Travancore, and forty families took their title-deeds home.', 9);
  await A.narrate('Devaki was confirmed Examiner of Accounts at the hill Cutcherry. She kept the red ledger on her desk, and nobody asked her to move it.', 8);
  await A.narrate('And Madhavan the boatman spent his reward on a single thing: a new vallam, which he named for his mother.', 7);
  await A.card('A TALE OF TRAVANCORE', 'KAYAL', 'കായൽ  ·  fin', 6.5);
  p.setCine(null); ui.letterbox(false); ui.setHud(true);
  S.invulnerable = false; p.locked = false;
}

export const MISSIONS = [
  { name: 'Homecoming', act: 1, letter: 'H', reward: 0, where: 'the village jetty', giver: () => SPOTS.arrive, run: homecoming },
  { name: 'Black Gold', act: 1, letter: 'R', reward: 48, where: 'Raman Ammavan, at the tharavadu', giver: () => SPOTS.homeDoor, run: blackGold },
  { name: 'The Backwater Run', act: 1, letter: 'O', reward: 64, where: 'Ouseph, at the village jetty', giver: () => SPOTS.ouseph.clone().add(new THREE.Vector3(-2.6, 0, 0.6)), run: backwaterRun },
  { name: 'The Red Ledger', act: 1, letter: 'M', reward: 400, where: 'Moideen Hajji, on the quay at Puthenthura', giver: () => SPOTS.moideen.clone().add(new THREE.Vector3(2.6, 0, 0.5)), run: redLedger },
  { name: 'The Senior Partner', act: 2, letter: 'D', reward: 240, where: 'Devaki, at the tharavadu gate', giver: () => SPOTS.homeGate.clone().add(new THREE.Vector3(1, 0, 2.5)), run: seniorPartner },
  { name: 'Fire on the Quay', act: 2, letter: 'M', reward: 480, where: 'Moideen Hajji, on the quay at Puthenthura', giver: () => SPOTS.moideen.clone().add(new THREE.Vector3(2.6, 0, 0.5)), run: fireOnTheQuay },
  { name: 'Vallamkali', act: 2, letter: 'O', reward: 800, where: 'Ouseph, at the village jetty', giver: () => SPOTS.ouseph.clone().add(new THREE.Vector3(-2.6, 0, 0.6)), run: vallamkali },
  { name: 'The Elephant Road', act: 2, letter: 'D', reward: 640, where: 'Devaki, at the hill Cutcherry', giver: () => SPOTS.cutcherryYard.clone().add(new THREE.Vector3(-1.5, 0, -5.5)), run: elephantRoad },
  { name: 'Storm over the Kayal', act: 2, letter: 'P', reward: 1600, where: 'the Peishkar, at the hill Cutcherry', giver: () => SPOTS.cutcherryYard.clone().add(new THREE.Vector3(1.5, 0, -2)), run: stormOverTheKayal },
];
