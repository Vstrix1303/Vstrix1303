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
import { Shop } from './shop.js';
import { ERA } from './era.js';
import { WARDROBE, SLOTS, SLOT_NAME, HAIR, FACE, lookFor } from './wardrobe.js';
import { ITEMS, BUFF_NAME, useItem, quickUse } from './items.js';
import { WEAPONS, GUNS, GUN_ORDER, AMMO_TYPES, MODS, modCats, modOpts, DEFAULT_MODS, gunStats, MELEE_ORDER } from './weapons.js';

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
  W.pages = (ERA.storyMissions ? ps : []).map(([x, z], i) => {
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
    if (!st.canPay(FARE)) { ui().toast(`The ferryman wants <b>${fmtMoney(FARE)}</b>. You have not got it.`, 4); return; }
    st.addMoney(-FARE);
    p().locked = true;
    await ui().fade(1, 0.7);
    p().teleport(f.pos.x, f.pos.z, f.yaw);
    G.env.setTime(G.env.hour + 0.4);
    await ui().fade(0, 1.0);
    p().locked = false;
    ui().toast(`The ferry sets you down at <b>${f.name}</b>.`, 4);
  };
  const ferryman = (name, x, z, yaw, idx) => amb(name, CAST.villagerM[6], x, z, yaw, { facePlayer: true, talkLabel: `Take the ferry (${fmtMoney(FARE)})`, talkCond: () => free() && S().state.done >= 1, onTalk: () => G.mapUI.open({ ferry: true, from: idx }) });
  ferryman('Ferryman', SPOTS.arrive.x + 6, SPOTS.arrive.z + 1.0, -Math.PI / 2, 0);
  ferryman('Ferryman', SPOTS.portLanding.x + 1.3, SPOTS.portLanding.z - 9, 0, 1);
  ferryman('Ferryman', SPOTS.hamletJettyEnd.x - 9, 150.9, Math.PI / 2, 2);

  // ------------------------------------------------ shops: clothes, food, medicine
  const shop = G.shop = new Shop();
  const st = () => S().state;
  // what things cost depends on who you are: the respected get a little off, the talked-about pay over the odds
  const cost = (n) => (n > 0 ? Math.max(1, Math.round(n * G.priceMult())) : 0);
  const canPay = (n) => S().canPay(cost(n));
  const fmtPrice = (n) => fmtMoney(cost(n));
  const pay = (n, what) => { n = cost(n); if (!S().canPay(n)) { G.audio?.sfx('ui'); ui().toast(`Not enough money for ${what}.`, 2.5); return false; } if (n) S().addMoney(-n); G.audio?.sfx('coin'); return true; };
  const colourOf = (look) => look.shoulderCloth ?? look.shirt ?? look.gearColor ?? look.bag ?? look.mundu ?? (look.cape ? 0x8a7a4a : look.mark ? 0xd8b070 : look.sandals ? 0x6a4a2a : 0x8d5b3c);
  const preview = (over) => p().setLook(lookFor(st(), over));
  // a tab of pieces for one slot; sold: which of them this shop has
  const wearTab = (slot, sold, free = false) => ({ name: SLOT_NAME[slot], items: () => Object.entries(WARDROBE[slot]).filter(([k, it]) => st().owned.includes(slot + ':' + k) || sold(it)).map(([k, it]) => {
    const id = slot + ':' + k, own = () => st().owned.includes(id), worn = () => st().wear[slot] === k;
    return {
      name: it.name, desc: it.desc, price: it.price, swatch: colourOf(it.look),
      tag: () => (worn() ? { text: 'WEARING', cls: 'worn' } : own() ? { text: 'OWNED', cls: 'own' } : { text: fmtPrice(it.price) }),
      label: () => (worn() ? 'Wearing' : own() || free ? 'Wear' : `Buy · ${fmtPrice(it.price)}`),
      can: () => !worn() && (own() || free || canPay(it.price)),
      preview: () => preview({ wear: { ...st().wear, [slot]: k } }),
      act: () => { if (!own() && !free) { if (!pay(it.price, it.name)) return; st().owned.push(id); } st().wear[slot] = k; S().save(); S().dress(); },
    };
  }) });
  const itemTab = (name, kind) => ({ name, items: () => Object.entries(ITEMS).filter(([, it]) => it.sold.includes(kind)).map(([k, it]) => ({
    name: it.name, desc: `${it.ml} — ${it.desc}`, price: it.price, swatch: it.swatch,
    stat: (st().items[k] || 0) ? `In your satchel: ${st().items[k]}` : '',
    tag: () => ({ text: fmtPrice(it.price) + (st().items[k] ? `  ·  ×${st().items[k]}` : '') }),
    label: () => `Buy · ${fmtPrice(it.price)}`, can: () => canPay(it.price),
    act: () => { if (!pay(it.price, it.name)) return; st().items[k] = (st().items[k] || 0) + 1; S().save(); },
  })) });
  const satchelTab = () => ({ name: 'Satchel', empty: 'Your satchel is empty. Food and medicine are sold in the bazaar.', items: () => Object.keys(st().items).filter((k) => st().items[k] > 0 && ITEMS[k]).map((k) => ({
    name: `${ITEMS[k].name}  ×${st().items[k]}`, desc: `${ITEMS[k].ml} — ${ITEMS[k].desc}`, swatch: ITEMS[k].swatch,
    tag: () => ({ text: '×' + st().items[k], cls: 'own' }), label: () => 'Use', can: () => true, act: () => useItem(k),
  })) });
  const restore = () => S().dress();
  // weapons: bought once, then equipped from the wheel (Tab) or here
  const NEED = { 4: 'later', 5: 'later' };
  const weaponTab = (name, at) => ({ name, items: () => Object.entries(WEAPONS).filter(([, w]) => w.at === at).map(([k, w]) => {
    const own = () => st().weapons.includes(k), cur = () => p().weapon === k, early = () => w.need && st().done < w.need;
    return {
      name: `${w.name} · ${w.ml}`, desc: w.desc + (early() ? `  Not yet — ${NEED[w.need] || 'later in the story'}.` : ''), price: w.price,
      stat: `Damage ${w.dmg} · reach ${w.reach} m · ${w.multi ? 'hits all around' : w.dur < 0.32 ? 'very fast' : w.dur > 0.6 ? 'slow' : 'steady'}${w.shield ? ' · shield' : ''}`,
      tag: () => (cur() ? { text: 'IN HAND', cls: 'worn' } : own() ? { text: 'OWNED', cls: 'own' } : early() ? { text: 'LATER' } : { text: fmtPrice(w.price) }),
      label: () => (cur() ? 'In hand' : own() ? 'Take it' : `Buy · ${fmtPrice(w.price)}`),
      can: () => !cur() && (own() || (!early() && canPay(w.price))),
      act: () => {
        if (!own()) { if (!pay(w.price, w.name)) return; st().weapons.push(k); ui().toast(`<b>${w.name}</b> — yours. Hold <b>Tab</b> for the weapon wheel: it sits in the melee segment (press <b>2</b>).`, 5); }
        st().weapon = k; st().melee = k; p().setWeapon(k); S().save();
      },
    };
  }) });
  // the gunsmith: each gun on its own tab — buy it, buy rounds for it, and rebuild it part by part. What
  // you point at is shown in Madhavan's hands before you pay.
  const gunTab = (k) => {
    const G0 = GUNS[k];
    return { name: { pistol: 'Pistol', shotgun: 'Shotgun', rifle: 'Rifle', sniper: 'Sniper', rocket: 'Launcher' }[k], items: () => {
      const own = () => st().weapons.includes(k), mods = () => ({ ...DEFAULT_MODS(k), ...(st().mods[k] || {}) });
      const show = (over) => { p().previewMods = over || null; p().setWeapon(k); p().drawn = true; p().buildHolsters(); p().h.aim = k === 'pistol'; p().h.longGun = k === 'pistol' ? 0 : 1; };
      const S0 = gunStats(k, mods());
      const rows = [{
        name: `${G0.name} · ${G0.ml}`, desc: G0.desc, price: G0.price, swatch: 0x3a3c40,
        stat: `Damage ${Math.round(S0.dmg)}${S0.pellets ? ' ×' + S0.pellets : ''} · range ${Math.round(S0.range)} m · ${S0.mag} rounds · ${S0.auto ? 'automatic' : (1 / S0.rate).toFixed(1) + ' shots a second'}${S0.radius ? ' · blast ' + S0.radius.toFixed(1) + ' m' : ''}`,
        tag: () => (own() ? { text: 'OWNED', cls: 'own' } : { text: fmtPrice(G0.price) }),
        label: () => (own() ? 'Take it in hand' : `Buy · ${fmtPrice(G0.price)}`),
        can: () => own() || canPay(G0.price), preview: () => show(),
        act: () => {
          if (!own()) { if (!pay(G0.price, G0.name)) return; st().weapons.push(k); st().ammo[k] = (st().ammo[k] || 0) + AMMO_TYPES[k].n; st().mag[k] = gunStats(k, mods()).mag; ui().toast(`<b>${G0.name}</b> — yours, loaded, with a box of rounds. Hold <b>Tab</b> for the wheel, or press <b>${['pistol', 'shotgun', 'rifle', 'sniper', 'rocket'].indexOf(k) + 3}</b>.`, 5); }
          st().weapon = k; S().save();
        },
      }];
      const am = AMMO_TYPES[k];
      rows.push({ name: am.name, desc: 'Packed in oilcloth, sold by the box.', price: am.price, swatch: 0xb8a060, stat: `Carried: ${st().ammo[k] || 0} spare`, tag: () => ({ text: fmtPrice(am.price) }), label: () => `Buy · ${fmtPrice(am.price)}`, can: () => own() && canPay(am.price), preview: () => show(), act: () => { if (!pay(am.price, am.name)) return; st().ammo[k] = (st().ammo[k] || 0) + am.n; S().save(); } });
      for (const cat of modCats(k)) for (const [o, part] of modOpts(cat, k)) {
        const id = `${k}:${cat}:${o}`, has = () => part.price === 0 || st().modsOwned.includes(id), on = () => mods()[cat] === o;
        const col = part.metal ? part.metal[0] : part.wood ?? part.inlay ?? null;
        rows.push({
          name: `${MODS[cat].name} — ${part.name}`, desc: part.desc || `${MODS[cat].name} for the ${G0.name}.`, price: part.price, swatch: col,
          stat: (() => { const t = gunStats(k, { ...mods(), [cat]: o }), b = gunStats(k, mods()), d = []; const cmp = (n, a, c, better, f = (x) => Math.round(x)) => { if (Math.abs(a - c) > 1e-6) d.push(`${n} ${f(a)} → ${f(c)}${(better ? c > a : c < a) ? ' ▲' : ' ▼'}`); };
            cmp('Range', b.range, t.range, true); cmp('Rounds', b.mag, t.mag, true); cmp('Spread', b.aim, t.aim, false, (x) => x.toFixed(2)); cmp('Damage', b.dmg, t.dmg, true); cmp('Recoil', b.recoil, t.recoil, false, (x) => (x * 100).toFixed(1)); cmp('Zoom', 60 / b.zoom, 60 / t.zoom, true, (x) => x.toFixed(1) + 'x'); if (t.sup && !b.sup) d.push('Silent'); return d.join(' · '); })(),
          tag: () => (on() ? { text: 'FITTED', cls: 'worn' } : has() ? { text: 'OWNED', cls: 'own' } : { text: fmtPrice(part.price) }),
          label: () => (on() ? 'Fitted' : has() ? 'Fit it' : `Buy and fit · ${fmtPrice(part.price)}`),
          can: () => own() && !on() && (has() || canPay(part.price)),
          preview: () => show({ ...mods(), [cat]: o }),
          act: () => { if (!has()) { if (!pay(part.price, part.name)) return; st().modsOwned.push(id); } st().mods[k] = { ...(st().mods[k] || {}), [cat]: o }; S().save(); show(); G.audio?.sfx('reload'); },
        });
      }
      return rows;
    } };
  };
  A.gunsmith = () => shop.open({ title: 'Gunsmith', ml: 'തോക്കുപണി', sub: 'Guns from every war the century has had, and the parts to make them yours.', camera: true, tabs: GUN_ORDER.map(gunTab),
    onClose: () => { p().previewMods = null; p().h.aim = false; p().h.longGun = 0; S().dress(); if (st().weapon !== 'fists') p().drawn = false; p().buildHolsters(); } });
  // the barber: a hairstyle or a shave is paid for each time
  const styleTab = (name, key, SET) => ({ name, items: () => Object.entries(SET).map(([k, it]) => {
    const cur = () => st()[key] === k;
    return {
      name: it.name, desc: it.desc, price: it.price,
      tag: () => (cur() ? { text: 'CURRENT', cls: 'worn' } : { text: it.price ? fmtPrice(it.price) : 'free' }),
      label: () => (cur() ? 'Current' : it.price ? `Pay · ${fmtPrice(it.price)}` : 'Choose'),
      can: () => !cur() && canPay(it.price),
      preview: () => preview({ [key]: k }),
      act: () => { if (!pay(it.price, it.name)) return; st()[key] = k; S().save(); S().dress(); G.audio?.sfx('swing', 0.3); },
    };
  }) });
  const KEEPER_SAYS = {
    cloth: ['Feel that weave. Your grandfather wore our cloth.', 'Try it on, try it on. The mirror is free.'],
    tailor: ['Every stitch by hand, on a Singer machine from Madras.', 'A Bombay man should dress like a Bombay man.'],
    provisions: ['Weigh it yourself if you like.', 'Fresh this morning from the Kuttanad boats.'],
    vaidyasala: ['Bitter medicine, sweet health.', 'For the body that fights, the oil that the kalari masters use.'],
    tea: ['Eat. A man cannot argue politics on an empty stomach.'],
    market: ['Take two, they are small this week.'],
    kollan: ['Feel the balance. My grandfather forged for the Raja\'s Nair brigade.', 'Iron is honest. It does what the hand asks.'],
    kalari: ['A weapon is the last thing a kalari teaches, not the first.', 'Oil the body, then the blade.'],
    gun: ['You did not buy this from me.', 'Keep it wrapped. The peons have eyes.'],
    barber: ['Sit, sit. Head still — this razor came from Sheffield.', 'Bombay barbers! They cut hair like they cut cloth. Let me fix it.', 'You know what the Tahsildar\'s clerk told me in this chair? Never mind. Head still.'],
  };
  A.shop = (kind, n) => {
    if (!S() || S().busy || G.activity || p().mode !== 'foot') return;
    if (n) { n.talkT = 4; n.yaw = Math.atan2(p().pos.x - n.pos.x, p().pos.z - n.pos.z); p().yaw = Math.atan2(n.pos.x - p().pos.x, n.pos.z - p().pos.z); }
    const say = KEEPER_SAYS[kind]; if (n && say) n.speak(say[(Math.random() * say.length) | 0]);
    const bazaar = (it) => it.at !== 'tailor', all = () => true;
    const defs = {
      cloth: { title: 'Cloth Shop', ml: 'തുണിക്കട', sub: 'Balaramapuram weaves, mill cloth from Bombay.', camera: true, tabs: [wearTab('lower', bazaar), wearTab('upper', bazaar), wearTab('head', bazaar), wearTab('extra', bazaar)] },
      tailor: { title: 'The Tailor of Puthenthura', ml: 'തയ്യൽക്കട', sub: 'Cut to measure, finished by the next tide.', camera: true, tabs: SLOTS.map((sl) => wearTab(sl, all)) },
      provisions: { title: 'Provisions', ml: 'പലചരക്ക്', sub: 'Rice, oil, jaggery — and food for the road.', tabs: [itemTab('For the road', 'provisions'), satchelTab()] },
      vaidyasala: { title: 'Vaidyasala', ml: 'വൈദ്യശാല', sub: 'Ayurvedic medicines, prepared by the vaidyan.', tabs: [itemTab('Medicines', 'vaidyasala'), satchelTab()] },
      tea: { title: 'Tea Shop', ml: 'ചായക്കട', sub: 'Chaya, and whatever is hot in the pot.', tabs: [{ name: 'Food', items: () => [{ name: 'A glass of chaya', desc: 'Hot, sweet and strong. Drunk here: restores health and breath.', price: 1, swatch: 0xa8743a, label: () => 'Drink · 1 as', can: () => canPay(1) || S().state.done <= 1, act: () => { if (S().state.done > 1 && !pay(1, 'a chaya')) return; p().health = 100; p().stamina = 100; G.audio?.sfx('pickup'); ui().toast('Hot, sweet, and strong enough to stand a spoon in.', 3); } }, ...itemTab('', 'tea').items()] }, satchelTab()] },
      barber: { title: 'The Barber', ml: 'ക്ഷുരകൻ', sub: 'Under the banyan, with a razor, a mirror and a great deal of news.', camera: true, tabs: [styleTab('Hair', 'hair', HAIR), styleTab('Moustache & beard', 'face', FACE)] },
      kollan: { title: 'The Blacksmith', ml: 'കൊല്ലൻ', sub: 'Bell-metal for the kitchen, iron for everything else.', tabs: [weaponTab('Blades', 'kollan')] },
      kalari: { title: 'Kalari', ml: 'കളരി', sub: 'The gurukkal teaches the weapons of the old fighting art — and sells the oil.', tabs: [weaponTab('Weapons', 'kalari'), itemTab('Oil', 'kalari')] },
      market: { title: 'Market Stall', ml: 'ചന്ത', sub: 'Fruit and sweets for the road.', tabs: [itemTab('Stall', 'market'), satchelTab()] },
    };
    if (kind === 'gun') { A.gunsmith(); return; }
    const d = defs[kind]; if (!d) return;
    shop.open({ ...d, onClose: restore });
  };
  // I: the satchel, anywhere
  // how the village sees you, from the strangers you helped, robbed or walked past
  const standing = () => { const h = st().honour || 0; return `Standing: ${h >= 30 ? 'Respected' : h >= 10 ? 'Well thought of' : h > -10 ? 'Unknown' : h > -30 ? 'Talked about' : 'Not trusted'} (${h > 0 ? '+' : ''}${h})${G.priceNote ? G.priceNote().replace('  ·  ', ' — prices ') : ''}${h <= -30 ? ' — the police are looking for you' : ''}`; };
  A.satchel = () => shop.open({ title: 'Satchel', ml: 'സഞ്ചി', sub: (() => { const b = Object.keys(p().buffs).map((k) => `${BUFF_NAME[k]} ${Math.ceil(p().buffs[k] / 60)} min`); return (b.length ? 'Now: ' + b.join(' · ') : 'Food and medicine you carry. V eats the best thing for your wounds.') + ' · ' + standing(); })(), camera: false, tabs: [satchelTab()] });
  A.quickUse = quickUse;
  // changing clothes at home: anything owned, for nothing
  if (SPOTS.homeHall) G.interactables.push({ pos: SPOTS.homeHall, r: 2.6, label: 'Change clothes', cond: () => free(), action: () => shop.open({ title: 'The Wardrobe', ml: 'അലമാര', sub: 'What you own, folded in the old teak chest.', camera: true, onClose: restore, tabs: SLOTS.map((sl) => wearTab(sl, () => false, true)) }) });
  // the barber, under the banyan in the square
  if (SPOTS.aalthara) {
    const a = SPOTS.aalthara, bx = a.x + 3.9, bz = a.z - 3.4;
    amb('Barber', { ...CAST.villagerM[0], shoulderCloth: 0xe6dfcb, mark: 'chandanam' }, bx, bz, Math.atan2(a.x - bx, a.z - bz) + 2.4, { facePlayer: true, talkLabel: 'Barber — hair and shave', talkCond: free, onTalk: (n) => A.shop('barber', n) });
  }
  // the kalari master, by the banyan
  if (SPOTS.aalthara) {
    const a = SPOTS.aalthara, gx = a.x - 4.4, gz = a.z - 3.6;
    amb('Gurukkal', { ...CAST.villagerM[2], shoulderCloth: undefined, munduLong: false, mundu: 0xb8402c, knot: true, mark: 'chandanam', moustache: 'big', grey: false, age: false, muscle: true }, gx, gz, Math.atan2(a.x - gx, a.z - gz) - 2.2, { facePlayer: true, talkLabel: 'Kalari master — weapons', talkCond: free, onTalk: (n) => A.shop('kalari', n) });
  }
  // the man behind the godown at Puthenthura
  amb('Trader', { ...CAST.villagerM[5], shirt: 0x3a3a34, style: 'kurta', longSleeves: true, headgear: 'cap', gearColor: 0x2a2a2a, beard: 'stubble' }, -447.6, -393.2, 0.2, { facePlayer: true, talkLabel: 'Gunsmith — guns, rounds, parts', talkCond: () => free(), onTalk: () => A.gunsmith() });
  // an arms dealer with a licence on the wall and a back room, by the bus stand
  if (SPOTS.busStand) { const bs = SPOTS.busStand, ry = SPOTS.busStandRy || 0, gx = bs.x + Math.cos(ry) * 6.5, gz = bs.z - Math.sin(ry) * 6.5;
    amb('Arms dealer', { ...CAST.villagerM[9], shirt: 0x4a4436, trousers: 0x3a3a40, boots: 0x2a1c10, moustache: 'big' }, gx, gz, ry, { facePlayer: true, talkLabel: 'Arms dealer — guns, rounds, parts', talkCond: () => free(), onTalk: () => A.gunsmith() }); }
  // the tailor of Puthenthura
  amb('Tailor', { ...CAST.villagerM[3], headgear: 'fez' }, -437.5, -392.6, 0, { facePlayer: true, talkLabel: 'Tailor — browse / buy', talkCond: free, onTalk: (n) => A.shop('tailor', n) });

  // ------------------------------------------------ tea
  amb('Tea-seller', CAST.villagerM[3], SPOTS.teaShop.x + 0.3, SPOTS.teaShop.z + 0.2, 2.2, { facePlayer: true, talkLabel: 'Tea shop — chaya and food', onTalk: (n) => (free() ? A.shop('tea', n) : (p().health = 100, n.speak('Drink. Talk later.'))) });

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
