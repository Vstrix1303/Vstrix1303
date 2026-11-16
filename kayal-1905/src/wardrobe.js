// What Madhavan can wear, piece by piece, and how his hair and face can be dressed.
// A look is the sum of: the man himself + a hairstyle + facial hair + one piece in each slot.
import { SKIN } from './human.js';

export const SLOTS = ['lower', 'upper', 'head', 'extra'];
export const SLOT_NAME = { lower: 'Mundu & lungi', upper: 'Upper cloth', head: 'Headwear', extra: 'Extras' };
// at: where it is sold — 'cloth' (village cloth shops), 'tailor' (the tailor of Puthenthura), or both when absent
export const WARDROBE = {
  lower: {
    cream: { name: 'Cream mundu', desc: 'Hand-loom cotton, worn long and knotted at the waist. What you came home in.', price: 0, look: { mundu: 0xe9e0c8, munduLong: true, knot: true } },
    short: { name: 'Work mundu, folded up', desc: 'The same cloth doubled to the knee, the way a man wears it to work a boat.', price: 0, look: { mundu: 0xe2d8be, knot: true } },
    lungiBlue: { name: 'Checked lungi, indigo', desc: 'Coloured checks from the Malabar looms. Hides the mud of the paddy bunds.', price: 28, look: { mundu: 0x4a6a8a, lungi: 0x24384c } },
    lungiRed: { name: 'Checked lungi, madder red', desc: 'Red checks, a favourite on the coast.', price: 28, look: { mundu: 0x8a4a3a, lungi: 0x4a1c14 } },
    lungiGreen: { name: 'Checked lungi, bottle green', desc: 'Green checks, long to the ankle.', price: 32, look: { mundu: 0x3f6a52, lungi: 0x1c3a2a, munduLong: true } },
    charcoal: { name: 'Dyed mundu, charcoal', desc: 'Dark cloth for wet weather and for work best done unseen.', price: 44, look: { mundu: 0x4a4c50, munduLong: true, knot: true } },
    saffron: { name: 'Saffron mundu', desc: 'Dyed for the pilgrim season.', price: 40, look: { mundu: 0xc8792a, munduLong: true, knot: true } },
    kasavu: { name: 'Kasavu mundu', desc: 'Balaramapuram double-weave with a border of real gold thread. For Onam, weddings and the Raja\'s birthday.', price: 180, look: { mundu: 0xf6f0dc, munduLong: true, kasavu: true, knot: true } },
  },
  upper: {
    bare: { name: 'Bare-chested', desc: 'As most men of the village go about, charm on its cord.', price: 0, look: {} },
    cloth: { name: 'Shoulder cloth', desc: 'A folded cotton thorthu over the left shoulder.', price: 0, look: { shoulderCloth: 0xe4dac0 } },
    clothRed: { name: 'Shoulder cloth, red border', desc: 'A finer melmundu with a woven border.', price: 14, look: { shoulderCloth: 0xa8442e } },
    clothGold: { name: 'Festival shoulder cloth', desc: 'White, with a gold edge to match a kasavu mundu.', price: 48, look: { shoulderCloth: 0xf6f0dc } },
    shirt: { name: 'Mill-cloth shirt', desc: 'Collarless, Bombay-made. The new fashion among clerks and schoolmasters.', price: 52, look: { shirt: 0xe6e0d0 } },
    shirtBlue: { name: 'Striped shirt, blue', desc: 'A coloured shirt, sleeves to the elbow.', price: 60, look: { shirt: 0x6a84a0 } },
    kurta: { name: 'Long kurta', desc: 'Loose and long-sleeved, as the traders of the port wear.', price: 80, look: { shirt: 0xeae6da, style: 'kurta', longSleeves: true }, at: 'tailor' },
    jacket: { name: 'Bombay jacket', desc: 'Cut by a Parsi tailor\'s pattern. A man in this is taken for somebody.', price: 220, look: { shirt: 0x4a4436, style: 'jacket', longSleeves: true }, at: 'tailor' },
    cape: { name: 'Palm-leaf rain cape', desc: 'Woven screw-pine over the shoulders. The monsoon runs off it like off a duck.', price: 96, look: { cape: true } },
  },
  head: {
    none: { name: 'Bare-headed', desc: 'Nothing on the head.', price: 0, look: {} },
    thorthu: { name: 'Head-cloth', desc: 'A thorthu wound round the head against the sun.', price: 0, look: { headgear: 'thorthu', gearColor: 0xe6dcc2 } },
    thorthuRed: { name: 'Head-cloth, red', desc: 'A boatman\'s red head-cloth — the colour of the Thekkumkara crew.', price: 10, look: { headgear: 'thorthu', gearColor: 0xb8402c } },
    turban: { name: 'Turban, cream', desc: 'A full turban, properly tied. For calling on officials.', price: 44, look: { headgear: 'turban', gearColor: 0xe9d9a8 } },
    turbanRed: { name: 'Turban, crimson', desc: 'Crimson muslin, eight yards of it.', price: 56, look: { headgear: 'turban', gearColor: 0x9c2a20 }, at: 'tailor' },
    cap: { name: 'Embroidered cap', desc: 'The round white cap of the coast traders.', price: 30, look: { headgear: 'cap' }, at: 'tailor' },
  },
  extra: {
    none: { name: 'Nothing more', desc: 'Travel light.', price: 0, look: {} },
    bag: { name: 'Shoulder bag', desc: 'Stitched jute, slung across the body.', price: 36, look: { bag: 0x7a6238 } },
    mark: { name: 'Sandal-paste mark', desc: 'A line of chandanam on the brow, fresh from the temple.', price: 2, look: { mark: 'chandanam' } },
    sandals: { name: 'Leather sandals', desc: 'Most men go barefoot. These are for the gravel of the hill road.', price: 64, look: { sandals: true }, at: 'tailor' },
  },
};
export const HAIR = {
  bun: { name: 'Knotted behind', desc: 'Long hair tied in a knot at the back — as you have always worn it.', price: 0, look: { bun: true } },
  crop: { name: 'Short crop', desc: 'Cut close all round, the Bombay way.', price: 3, look: {} },
  long: { name: 'Loose to the shoulders', desc: 'Oiled and left down.', price: 3, look: { longHair: true } },
  kudumi: { name: 'Kudumi', desc: 'The old style: the head shaved but for a tuft knotted at the front.', price: 4, look: { bald: true, tuft: true } },
  shaved: { name: 'Shaved clean', desc: 'All of it off. Cool in the heat, and no trouble.', price: 2, look: { bald: true } },
};
export const FACE = {
  meesha: { name: 'Moustache', desc: 'A trimmed moustache — as you wear it now.', price: 0, look: { moustache: true } },
  clean: { name: 'Clean-shaven', desc: 'Razor and alum. Ten years younger.', price: 1, look: {} },
  komban: { name: 'Komban meesha', desc: 'The great upturned moustache of soldiers and landlords.', price: 3, look: { moustache: 'big' } },
  stubble: { name: 'Moustache and stubble', desc: 'A few days\' growth, left on purpose.', price: 1, look: { moustache: true, beard: 'stubble' } },
  beard: { name: 'Full beard', desc: 'Grown out and combed.', price: 2, look: { moustache: true, beard: true } },
};
export const DEFAULT_WEAR = { lower: 'cream', upper: 'cloth', head: 'none', extra: 'none' };
export const FREE_PIECES = ['lower:cream', 'lower:short', 'upper:bare', 'upper:cloth', 'head:none', 'head:thorthu', 'extra:none'];
// the old complete outfits, as pieces (saves from before the wardrobe)
export const OLD_OUTFITS = {
  everyday: { lower: 'cream', upper: 'cloth', head: 'none', extra: 'none' },
  boatman: { lower: 'short', upper: 'bare', head: 'thorthu', extra: 'none' },
  travel: { lower: 'cream', upper: 'clothRed', head: 'none', extra: 'bag' },
  monsoon: { lower: 'charcoal', upper: 'cape', head: 'none', extra: 'none' },
  festival: { lower: 'kasavu', upper: 'clothGold', head: 'none', extra: 'mark' },
};

export function lookFor(st, over) {
  const wear = { ...DEFAULT_WEAR, ...(st && st.wear), ...(over && over.wear) };
  const look = { skin: SKIN[0], pendant: true, muscle: true };
  Object.assign(look, (HAIR[(over && over.hair) || (st && st.hair)] || HAIR.bun).look, (FACE[(over && over.face) || (st && st.face)] || FACE.meesha).look);
  for (const s of SLOTS) Object.assign(look, (WARDROBE[s][wear[s]] || WARDROBE[s][DEFAULT_WEAR[s]]).look);
  return look;
}
