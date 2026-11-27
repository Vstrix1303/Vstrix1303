// Standing: how Thekkumkara sees Madhavan, from the strangers he helped, robbed or walked past (the
// number lives in the save as `honour`, -100..100). It changes what things cost, what people say as he
// passes, what strangers pay, and — when it falls far enough — whether the police come for him.
import { G } from './state.js';
import { GUNS } from './weapons.js';

export const TIERS = [
  { min: 30, name: 'Respected', price: 0.85, reward: 1.5 },
  { min: 10, name: 'Well thought of', price: 0.93, reward: 1.2 },
  { min: -9, name: 'Unknown', price: 1, reward: 1 },
  { min: -29, name: 'Talked about', price: 1.15, reward: 0.8 },
  { min: -101, name: 'Not trusted', price: 1.3, reward: 0.6 },
];
const honour = () => G.story?.state?.honour || 0;
export const tier = () => TIERS.find((t) => honour() >= t.min);

const GREET = {
  good: ['Namaskaram, Madhavan!', 'There goes a good man.', 'Come and have tea with us one evening!', 'They say you helped Kalyani\'s boy. God bless.', 'Madhava! My mother asks after you.', 'If you need anything, you only have to ask.'],
  fair: ['Hot today.', 'Namaskaram.', 'Going to the bazaar?', 'Rain by evening, you watch.'],
  bad: ['That\'s him. Keep walking.', 'Hold on to your purse, there.', 'Shameless.', 'My mother told me about you.', 'We know what you did.', 'Don\'t look at him, children.'],
  armed: ['Ayyo — put that away!', 'Is that a gun? Here?', 'Don\'t point that at us!', 'Somebody call the police!'],
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export function setupStanding() {
  G.standing = { tier, honour };
  G.priceMult = () => tier().price;
  G.rewardMult = () => tier().reward;
  G.priceNote = () => { const t = tier(); return t.price < 1 ? `  ·  ${t.name}: ${Math.round((1 - t.price) * 100)}% off` : t.price > 1 ? `  ·  ${t.name}: ${Math.round((t.price - 1) * 100)}% over the odds` : ''; };

  // striking or shooting a villager costs your good name, and brings any constable who sees it
  const lastAssault = new WeakMap();
  G.onAssault = (n, dmg) => {
    if (G.story?.mode !== 'free') return;
    const st = G.story.state;
    if ((lastAssault.get(n) || -1e9) < G.time - 30) { lastAssault.set(n, G.time); st.honour = Math.max(-100, (st.honour || 0) - (n.shot ? 5 : 2)); G.story.save(); G.ui.toast(`Honour ▼ &nbsp;·&nbsp; ${n.shot ? 'shot' : 'attacked'} ${n.name}`, 3); }
    for (const c of G.npcs) if (c.police && c.active && !c.ko && !c.hostile && c.pos.distanceTo(n.pos) < 35) { c.canBeHit = true; c.hitDmg = 11; c.becomeHostile(false); G.ui.bark(c.name, 'Stop! Police!', 2.5, c.h.preset); }
    G.combat?.scare(n.pos, 12);
  };
  let greetT = 4, policeT = 0, wantedSaid = false;
  const said = new WeakMap();
  G.updaters.push((dt) => {
    const st = G.story, p = G.player;
    if (!G.started || !st || st.mode !== 'free' || st.busy || p.mode !== 'foot' || p.health <= 0) return;
    const t = tier(), pp = p.pos, gun = p.drawn && !!GUNS[p.weapon];
    // a gun out in the street: people near you duck and cover
    if (gun && G.combat && (p.aiming || Math.random() < dt * 2)) G.combat.scare(pp, p.aiming ? 12 : 6);
    // a word from whoever you pass close by
    if ((greetT -= dt) <= 0) {
      greetT = 1.2;
      let best = null, bd = 4.2;
      for (const n of G.npcs) {
        if (!n.active || n.ko || n.hostile || n.canBeHit || n.guard || n.attached || n.police || G.enc?.active?.npcs?.includes(n)) continue;
        const d = Math.hypot(n.pos.x - pp.x, n.pos.z - pp.z); if (d > bd) continue;
        if ((said.get(n) || -1e9) > G.time - 90) continue;
        best = n; bd = d;
      }
      if (best) {
        const lines = gun ? GREET.armed : t.min >= 10 ? GREET.good : t.min <= -29 || (t.min <= -9 && Math.random() < 0.7) ? GREET.bad : GREET.fair;
        if (lines !== GREET.fair || Math.random() < 0.35) {
          said.set(best, G.time); greetT = 7;
          best.talkT = 3; G.ui.bark(best.name, pick(lines), 3.2, best.h.preset);
          if (lines === GREET.bad && t.min <= -29) { if (best.scaredT == null || best.scaredT <= 0) best.prevPose = best.pose; best.pose = 'cower'; best.scaredT = 5; }
        }
      }
    }
    // not trusted: the constables know your face, and come for you when they see you
    if (honour() <= -30) {
      if ((policeT -= dt) <= 0) {
        policeT = 0.5;
        for (const n of G.npcs) {
          if (!n.police || !n.active || n.ko || n.hostile) continue;
          if (Math.hypot(n.pos.x - pp.x, n.pos.z - pp.z) < 14) {
            n.canBeHit = true; n.relentless = false; n.hitDmg = 11; n.becomeHostile(false);
            G.ui.bark(n.name, 'You! Stop there — in the name of the law!', 3, n.h.preset);
            if (!wantedSaid) { wantedSaid = true; G.ui.toast('The police know your face. <b>Not trusted</b> — win back your standing by helping people, or stay clear of the constables.', 6); }
          }
        }
      }
    }
  });
}
