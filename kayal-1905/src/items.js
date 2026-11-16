// Things Madhavan can carry in his satchel and use: food, medicine, oil.
import { G } from './state.js';

export const ITEMS = {
  banana: { name: 'Nendran bananas', ml: 'നേന്ത്രപ്പഴം', desc: 'A hand of ripe plantains from Kuttanad. Restores a little health.', price: 1, heal: 30, sold: ['provisions', 'market'], swatch: 0xd9b23a },
  puttu: { name: 'Puttu and kadala', ml: 'പുട്ടും കടലയും', desc: 'Steamed rice cake and black-gram curry, wrapped in a leaf. Restores a good deal of health.', price: 2, heal: 60, sold: ['provisions', 'tea'], swatch: 0xece4d0 },
  meal: { name: 'Rice and fish curry', ml: 'ചോറും മീൻകറിയും', desc: 'Red rice and karimeen in a clay-pot curry, a banana leaf to eat it from. Restores all health.', price: 4, heal: 100, sold: ['provisions', 'tea'], swatch: 0xb8502a },
  jaggery: { name: 'Jaggery and dried ginger', ml: 'ചുക്കും ശർക്കരയും', desc: 'Chewed on the road. For two minutes running costs no breath.', price: 2, buff: ['wind', 120], sold: ['provisions', 'market'], swatch: 0x7a4a1c },
  kashayam: { name: 'Kashayam', ml: 'കഷായം', desc: 'A bitter herbal decoction. Restores all health, and for three minutes wounds close quickly.', price: 6, heal: 100, buff: ['mend', 180], sold: ['vaidyasala'], swatch: 0x5a3a1a },
  thailam: { name: 'Marma oil', ml: 'മർമ്മ തൈലം', desc: 'The kalari masters\' oil, rubbed into the joints. For three minutes blows hurt you less.', price: 9, buff: ['guard', 180], sold: ['vaidyasala', 'kalari'], swatch: 0x8a6a2a },
};
export const BUFF_NAME = { wind: 'Breath', mend: 'Mending', guard: 'Marma oil' };

export function useItem(key) {
  const st = G.story.state, it = ITEMS[key], p = G.player;
  if (!it || !(st.items[key] > 0)) return false;
  st.items[key]--; if (!st.items[key]) delete st.items[key];
  if (it.heal) p.health = Math.min(100, p.health + it.heal);
  if (it.heal) p.stamina = Math.min(100, p.stamina + it.heal * 0.6);
  if (it.buff) p.buffs[it.buff[0]] = Math.max(p.buffs[it.buff[0]] || 0, it.buff[1]);
  G.audio?.sfx('pickup');
  G.ui.toast(`<b>${it.name}</b> — ${it.heal ? `+${Math.min(it.heal, 100)} health` : ''}${it.heal && it.buff ? ', ' : ''}${it.buff ? `${BUFF_NAME[it.buff[0]]} for ${it.buff[1] / 60 | 0} min` : ''}`, 3.5);
  G.story.save();
  return true;
}
// V: eat the cheapest thing that does the job
export function quickUse() {
  const st = G.story.state, p = G.player, need = 100 - p.health;
  const have = Object.keys(st.items || {}).filter((k) => st.items[k] > 0 && ITEMS[k]?.heal);
  if (!have.length) { G.ui.toast('Nothing to eat in your satchel. The bazaar sells food — <b>I</b> opens the satchel.', 3.5); return; }
  if (need < 5) { G.ui.toast('You are not hungry, and not hurt.', 2.5); return; }
  have.sort((a, b) => ITEMS[a].heal - ITEMS[b].heal);
  useItem(have.find((k) => ITEMS[k].heal >= need) || have[have.length - 1]);
}
