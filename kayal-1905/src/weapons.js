// What Madhavan can fight with: bare hands; the weapons of the kalari and the road; and five guns
// from the smugglers' godowns, each of which the gunsmith can rebuild to taste.
// Everything is built along +z from the grip (the hand holds the origin), the way the staff always was.
import * as THREE from 'three';

const std = (color, rough = 0.6, metal = 0, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...o });
const WOOD = () => std(0x6a4a2a, 0.7), DARK = () => std(0x3a2616, 0.6), STEEL = () => std(0xb8bcc0, 0.32, 0.85), BRASS = () => std(0xc9a13a, 0.35, 0.8);

// stats — dmg: per hit; reach: metres; arc: cos of the half-angle hit; dur: swing length; cd: time between swings;
// multi: hits everyone in the arc (else the nearest); guard: what a block lets through; knock: knockback scale
export const MELEE = {
  fists: { name: 'Unarmed', ml: 'കൈ', desc: 'Your own two fists. Quick jabs, left and right; hold right mouse to keep your guard up.', price: 0, dmg: 17, reach: 1.35, arc: 0.45, dur: 0.3, cd: 0.34, guard: 0.35, knock: 0.6, icon: 'fists', fists: true },
  staff: { name: 'Lathi', ml: 'വടി', desc: 'A long staff of seasoned bamboo, bound with brass. Long reach, steady blows — the weapon you came home with.', price: 0, dmg: 50, reach: 2.15, arc: 0.3, dur: 0.42, cd: 0.62, guard: 0.15, knock: 1, low: true, icon: 'staff' },
  cheruvadi: { name: 'Cheruvadi', ml: 'ചെറുവടി', desc: 'The short stick of the kalari, a forearm and a half long. Quick strikes, one after another, close in.', price: 80, dmg: 30, reach: 1.65, arc: 0.4, dur: 0.28, cd: 0.36, guard: 0.2, knock: 0.6, icon: 'short', at: 'kalari' },
  otta: { name: 'Otta', ml: 'ഒറ്റ', desc: 'A curved stick shaped like an elephant\'s tusk, aimed at the body\'s vital points. Every third blow lands on a marma and drops a man.', price: 160, dmg: 40, reach: 1.7, arc: 0.35, dur: 0.38, cd: 0.52, guard: 0.18, knock: 1.2, marma: 3, icon: 'otta', at: 'kalari' },
  kathi: { name: 'Vettukathi', ml: 'വെട്ടുകത്തി', desc: 'The coconut-climber\'s billhook. Heavy in the hand and very sharp; short reach.', price: 60, dmg: 62, reach: 1.6, arc: 0.4, dur: 0.38, cd: 0.6, guard: 0.3, knock: 1.1, icon: 'kathi', at: 'kollan' },
  val: { name: 'Val and paricha', ml: 'വാളും പരിചയും', desc: 'A straight sword and a round shield of hide over cane, the kalari\'s classic pairing. Blocks with the shield hardly hurt, and a well-timed one opens the enemy wide.', price: 360, dmg: 66, reach: 1.95, arc: 0.3, dur: 0.4, cd: 0.6, guard: 0.04, parry: 0.45, knock: 1.1, shield: true, icon: 'val', at: 'kollan' },
  urumi: { name: 'Urumi', ml: 'ഉറുമി', desc: 'The flexible sword: a coil of thin steel that unrolls into a whip-blade. Slow and dangerous to its owner, it cuts everyone around you in one sweep.', price: 640, dmg: 48, reach: 3.2, arc: -0.25, dur: 0.66, cd: 1.0, guard: 0.45, knock: 1.4, multi: true, icon: 'urumi', at: 'kalari', need: 4 },
};
export const MELEE_ORDER = ['staff', 'cheruvadi', 'otta', 'kathi', 'val', 'urumi'];

// ---------------------------------------------------------------- guns
// base stats — dmg: per bullet (per pellet for the shotgun); range: metres; rate: seconds between shots;
// mag: rounds; reload: seconds; hip / aim: spread in degrees; recoil: radians of kick; zoom: aimed field of view
export const GUNS = {
  pistol: { name: 'Colt .45 automatic', ml: 'പിസ്റ്റൾ', desc: 'An American army automatic that came ashore at Cochin in a sailor\'s kitbag. Seven rounds, quick to the hand.', price: 120, dmg: 46, range: 45, rate: 0.24, mag: 7, reload: 1.6, hip: 3.0, aim: 0.9, recoil: 0.035, zoom: 44, icon: 'pistol', slot: 'pistol', ammo: 'pistol', pose: 'pistol' },
  shotgun: { name: 'Double-barrel 12-bore', ml: 'ഇരട്ടക്കുഴൽ', desc: 'A planter\'s duck gun: two barrels side by side, nine pellets of buckshot each. Terrible close in, useless far out.', price: 200, dmg: 15, pellets: 9, range: 22, rate: 0.38, mag: 2, reload: 2.4, hip: 7, aim: 5, recoil: 0.11, zoom: 46, icon: 'shotgun', slot: 'shotgun', ammo: 'shotgun', pose: 'long' },
  rifle: { name: 'Kalashnikov assault rifle', ml: 'റൈഫിൾ', desc: 'Ten years old and already everywhere — this one came by dhow from Aden. Thirty rounds, and it keeps firing while you hold the trigger.', price: 480, dmg: 30, range: 80, rate: 0.1, mag: 30, reload: 2.3, hip: 4.5, aim: 1.2, recoil: 0.022, zoom: 40, auto: true, icon: 'rifle', slot: 'rifle', ammo: 'rifle', pose: 'long' },
  sniper: { name: 'Lee-Enfield No. 4 (T)', ml: 'സ്നൈപ്പർ', desc: 'The British army\'s sniping rifle, telescope and all, sold off when they left. Bolt action, five rounds, and it reaches across the backwater.', price: 400, dmg: 160, range: 260, rate: 1.1, mag: 5, reload: 3.0, hip: 9, aim: 0.15, recoil: 0.09, zoom: 34, icon: 'sniper', slot: 'sniper', ammo: 'sniper', pose: 'long', head: 3.5 },
  rocket: { name: 'M9 bazooka', ml: 'റോക്കറ്റ്', desc: 'A war-surplus rocket launcher nobody can explain. One rocket at a time; everything near where it lands is thrown about.', price: 900, dmg: 260, radius: 6.5, range: 160, rate: 1.0, mag: 1, reload: 3.4, hip: 3, aim: 0.6, recoil: 0.06, zoom: 42, speed: 42, icon: 'rocket', slot: 'rocket', ammo: 'rocket', pose: 'shoulder' },
};
export const GUN_ORDER = ['pistol', 'shotgun', 'rifle', 'sniper', 'rocket'];
export const AMMO_TYPES = {
  pistol: { name: '.45 rounds (14)', n: 14, price: 4 },
  shotgun: { name: '12-bore shells (10)', n: 10, price: 5 },
  rifle: { name: 'Rifle rounds (60)', n: 60, price: 9 },
  sniper: { name: '.303 rounds (10)', n: 10, price: 6 },
  rocket: { name: 'Rockets (2)', n: 2, price: 30 },
};
export const WEAPONS = { ...MELEE, ...GUNS };
for (const k in GUNS) GUNS[k].gun = true;

// the gunsmith's work, by category; 'for' lists the guns a part fits (all, when absent)
export const MODS = {
  finish: { name: 'Finish', opts: {
    blued: { name: 'Blued steel', price: 0, metal: [0x2a2e36, 0.35, 0.8] },
    black: { name: 'Parkerised black', price: 12, metal: [0x16171a, 0.62, 0.45] },
    nickel: { name: 'Nickel plate', price: 30, metal: [0xc8ccd2, 0.18, 0.95] },
    case: { name: 'Case-hardened', price: 24, metal: [0x5e5048, 0.3, 0.85] },
    gold: { name: 'Gold plate', price: 90, metal: [0xd6a840, 0.25, 0.95] },
  } },
  wood: { name: 'Wood', opts: {
    walnut: { name: 'Walnut', price: 0, wood: 0x5a3a22 },
    teak: { name: 'Malabar teak', price: 10, wood: 0x8c5a2c },
    rosewood: { name: 'Rosewood', price: 22, wood: 0x3a1a14 },
    ebony: { name: 'Ebony', price: 30, wood: 0x17110d },
    ivory: { name: 'Ivory grips', price: 60, wood: 0xe8dfc6, for: ['pistol'] },
  } },
  barrel: { name: 'Barrel', for: ['pistol', 'shotgun', 'rifle', 'sniper'], opts: {
    std: { name: 'Standard barrel', price: 0 },
    long: { name: 'Long barrel', price: 28, len: 1.35, range: 1.3, aim: 0.75, rate: 1.05, desc: 'Reaches further and groups tighter, a touch slower to bring round.' },
    short: { name: 'Cut-down barrel', price: 16, len: 0.72, range: 0.75, hip: 0.7, aim: 1.25, desc: 'Handy and quick from the hip; worse at a distance.' },
    silencer: { name: 'Suppressor', price: 70, sup: true, dmg: 0.9, range: 0.9, for: ['pistol', 'rifle', 'sniper'], desc: 'A can on the muzzle. The shot is a cough nobody comes running for.' },
  } },
  sight: { name: 'Sight', for: ['rifle', 'sniper', 'pistol'], opts: {
    iron: { name: 'Iron sights', price: 0 },
    scope2: { name: 'Short scope, 2.5x', price: 40, zoom: 30, aim: 0.7, for: ['rifle', 'sniper'] },
    scope4: { name: 'Telescope, 4x', price: 60, zoom: 16, aim: 0.5, for: ['sniper', 'rifle'] },
    scope8: { name: 'Long telescope, 8x', price: 110, zoom: 8, aim: 0.4, for: ['sniper'] },
    peep: { name: 'Target sight', price: 18, aim: 0.75, for: ['pistol'] },
  } },
  mag: { name: 'Magazine', for: ['pistol', 'rifle', 'sniper'], opts: {
    std: { name: 'Standard magazine', price: 0 },
    ext: { name: 'Extended magazine', price: 34, mag: 1.6, reload: 1.1 },
    drum: { name: 'Drum magazine', price: 80, mag: 2.5, reload: 1.35, for: ['rifle'] },
  } },
  stock: { name: 'Stock', for: ['shotgun', 'rifle', 'sniper'], opts: {
    std: { name: 'Standard stock', price: 0 },
    padded: { name: 'Leather recoil pad', price: 20, recoil: 0.6 },
    folding: { name: 'Folding stock', price: 30, hip: 0.75, aim: 1.15, recoil: 1.2, for: ['rifle'] },
  } },
  warhead: { name: 'Rocket', for: ['rocket'], opts: {
    he: { name: 'High-explosive', price: 0 },
    heavy: { name: 'Heavy warhead', price: 90, radius: 1.5, dmg: 1.3, speed: 0.8 },
  } },
  engrave: { name: 'Engraving', opts: {
    none: { name: 'Plain', price: 0 },
    scroll: { name: 'Gold scrollwork', price: 50, inlay: 0xd8b048 },
    silver: { name: 'Silver vines', price: 40, inlay: 0xd8dce0 },
  } },
};
const fits = (part, gun) => !part.for || part.for.includes(gun);
export function modCats(gun) { return Object.keys(MODS).filter((c) => fits(MODS[c], gun) && Object.values(MODS[c].opts).some((o) => fits(o, gun))); }
export function modOpts(cat, gun) { return Object.entries(MODS[cat].opts).filter(([, o]) => fits(o, gun)); }
export const DEFAULT_MODS = (gun) => ({ finish: 'blued', wood: 'walnut', barrel: 'std', sight: gun === 'sniper' ? 'scope4' : 'iron', mag: 'std', stock: 'std', warhead: 'he', engrave: 'none' });
// the stats of a gun as built
export function gunStats(key, mods = {}) {
  const b = GUNS[key], m = { ...DEFAULT_MODS(key), ...mods }, o = { ...b, mods: m };
  for (const c of modCats(key)) {
    const part = MODS[c].opts[m[c]]; if (!part || !fits(part, key)) continue;
    for (const f of ['range', 'aim', 'hip', 'rate', 'dmg', 'recoil', 'reload', 'radius', 'speed']) if (part[f]) o[f] = b[f] != null ? o[f] * part[f] : o[f];
    if (part.mag) o.mag = Math.round(b.mag * part.mag);
    if (part.zoom) o.zoom = part.zoom;
    if (part.sup) o.sup = true;
  }
  o.scoped = o.zoom <= 30;
  return o;
}
// 0..1 ratings for the wheel and the gunsmith
export function gunRatings(s) {
  return { Damage: Math.min(1, (s.dmg * (s.pellets || 1)) / 200), Range: Math.min(1, s.range / 200), 'Fire rate': Math.min(1, 0.08 / s.rate * 1.2), Accuracy: Math.min(1, 0.4 / s.aim) };
}

function bladeGeo(len, w0, w1, curve = 0, thick = 0.006) {
  const s = new THREE.Shape(), n = 10;
  s.moveTo(0, -w0 / 2);
  for (let i = 1; i <= n; i++) { const t = i / n, z = t * len; s.lineTo(z, -w0 / 2 + (w0 - w1) / 2 * t + curve * t * t); }
  s.lineTo(len + w1 * 0.8, curve * 0.9);              // the point
  for (let i = n; i >= 0; i--) { const t = i / n, z = t * len; s.lineTo(z, w0 / 2 - (w0 - w1) / 2 * t + curve * t * t); }
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: thick * 0.6, bevelSize: thick * 0.8, bevelSegments: 1, steps: 1 });
  g.translate(0, 0, -thick / 2);
  g.rotateY(-Math.PI / 2);            // length along +z
  return g;
}
const add = (g, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; g.add(m); return m; };
const rod = (r0, r1, len, seg = 7) => { const c = new THREE.CylinderGeometry(r1, r0, len, seg); c.rotateX(Math.PI / 2); c.translate(0, 0, len / 2); return c; };

export function makeWeapon(key) {
  const g = new THREE.Group(); g.position.set(0, -0.075, 0);
  if (key === 'fists') return g;
  if (GUNS[key]) return makeGun(key);
  if (key === 'staff') {
    const len = 1.45;
    add(g, rod(0.022, 0.018, len), WOOD(), 0, 0, -len * 0.18);
    for (const z of [-len * 0.18 + 0.03, len * 0.82 - 0.03]) add(g, rod(0.025, 0.025, 0.05), BRASS(), 0, 0, z - 0.025);
  } else if (key === 'cheruvadi') {
    add(g, rod(0.02, 0.016, 0.72), DARK(), 0, 0, -0.1);
    add(g, rod(0.023, 0.023, 0.04), BRASS(), 0, 0, -0.1);
  } else if (key === 'otta') {
    // the S-curve of the otta, thick at the grip and tapering to a blunt knob
    const pts = [[0, 0, -0.14], [0, 0.0, 0.1], [0, 0.06, 0.3], [0, 0.03, 0.5], [0, -0.07, 0.62], [0, -0.13, 0.66]].map((p) => new THREE.Vector3(...p));
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.024, 7, false);
    add(g, tube, DARK());
    add(g, new THREE.SphereGeometry(0.034, 9, 7), DARK(), 0, -0.13, 0.665);
    add(g, new THREE.SphereGeometry(0.03, 9, 7), DARK(), 0, 0, -0.14);
  } else if (key === 'kathi') {
    add(g, rod(0.017, 0.015, 0.16), WOOD(), 0, 0, -0.06);
    add(g, rod(0.02, 0.02, 0.025), STEEL(), 0, 0, 0.09);
    const b = add(g, bladeGeo(0.36, 0.055, 0.075, 0.07, 0.004), STEEL(), 0, 0, 0.1); b.rotation.z = Math.PI / 2;     // the hook curves down
  } else if (key === 'val') {
    add(g, rod(0.016, 0.016, 0.14), DARK(), 0, 0, -0.05);
    add(g, new THREE.SphereGeometry(0.024, 8, 6), BRASS(), 0, 0, -0.06);
    add(g, new THREE.BoxGeometry(0.16, 0.022, 0.02), BRASS(), 0, 0, 0.095);
    const b = add(g, bladeGeo(0.7, 0.042, 0.032, 0, 0.004), STEEL(), 0, 0, 0.105); b.rotation.z = Math.PI / 2;
  } else if (key === 'urumi') {
    add(g, rod(0.017, 0.017, 0.15), DARK(), 0, 0, -0.05);
    add(g, new THREE.BoxGeometry(0.11, 0.02, 0.02), BRASS(), 0, 0, 0.1);
    // the blade hangs and trails: a flat ribbon of steel curving down to the ground
    const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector3(Math.sin(t * 7) * 0.05 * t, -0.95 * t * t - 0.05 * t, 0.12 + 0.55 * t - 0.35 * t * t)); }
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.011, 4, false);
    const m = add(g, tube, STEEL()); m.scale.x = 1.7;
    g.userData.ribbon = m;
  }
  return g;
}
export function makeShield() {
  const g = new THREE.Group();
  const prof = [[0, 0.03], [0.1, 0.026], [0.2, 0.012], [0.25, 0.0], [0.255, -0.012]].map(([x, y]) => new THREE.Vector2(x, y));
  const face = new THREE.Mesh(new THREE.LatheGeometry(prof, 22), std(0x5a3a22, 0.75, 0, { side: THREE.DoubleSide }));
  face.rotation.x = Math.PI / 2; face.castShadow = true; g.add(face);
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4; add(g, new THREE.SphereGeometry(0.022, 8, 6), BRASS(), Math.cos(a) * 0.13, Math.sin(a) * 0.13, 0.025); }
  add(g, new THREE.SphereGeometry(0.035, 10, 8), BRASS(), 0, 0, 0.033);
  add(g, new THREE.TorusGeometry(0.25, 0.012, 5, 28), BRASS(), 0, 0, -0.004);
  g.position.set(-0.04, -0.03, 0.06); g.rotation.set(0, Math.PI / 2, 0);      // strapped to the forearm, face outward
  return g;
}

// ---------------------------------------------------------------- the guns, built from their parts
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const tube = (r0, r1, len, seg = 12) => rod(r0, r1, len, seg);
export function makeGun(key, mods = {}) {
  const m = { ...DEFAULT_MODS(key), ...mods };
  const fin = MODS.finish.opts[m.finish] || MODS.finish.opts.blued, wd = MODS.wood.opts[m.wood] || MODS.wood.opts.walnut;
  const metal = std(fin.metal[0], fin.metal[1], fin.metal[2]), dark = std(0x1c1d20, 0.5, 0.6), wood = std(wd.wood, m.wood === 'ivory' ? 0.35 : 0.55, 0);
  const bar = MODS.barrel.opts[m.barrel] || {}, L = bar.len || 1, inlay = MODS.engrave.opts[m.engrave]?.inlay;
  const inl = inlay != null ? std(inlay, 0.25, 0.95) : null;
  const g = new THREE.Group(), muzzle = new THREE.Object3D();
  let mz = 0, my = 0;
  const scope = (y, z0, len, r) => { add(g, tube(r, r, len, 14), dark, 0, y, z0); add(g, tube(r * 1.25, r, 0.05, 14), dark, 0, y, z0); add(g, tube(r, r * 1.3, 0.06, 14), dark, 0, y, z0 + len - 0.06); for (const z of [z0 + len * 0.25, z0 + len * 0.7]) add(g, box(0.02, 0.035, 0.02), metal, 0, y - r - 0.015, z); };
  if (key === 'pistol') {
    g.position.set(0, -0.025, 0.02);
    add(g, box(0.03, 0.1, 0.045), wood, 0, -0.045, -0.012, -0.28);                    // grip
    add(g, box(0.031, 0.034, 0.17), metal, 0, 0.022, 0.06);                            // slide
    add(g, box(0.028, 0.03, 0.12), metal, 0, -0.005, 0.04);                            // frame
    add(g, new THREE.TorusGeometry(0.02, 0.004, 5, 10, Math.PI), metal, 0, -0.02, 0.035, 0, Math.PI / 2, Math.PI);
    const bl = 0.05 * L; add(g, tube(0.007, 0.007, bl), metal, 0, 0.024, 0.145); mz = 0.145 + bl; my = 0.024;
    if (m.sight === 'peep') add(g, box(0.012, 0.016, 0.02), dark, 0, 0.046, 0.0);
    if (m.mag === 'ext') add(g, box(0.026, 0.05, 0.034), dark, 0, -0.11, -0.03, -0.28);
    if (inl) add(g, box(0.033, 0.006, 0.12), inl, 0, 0.03, 0.06);
  } else if (key === 'shotgun') {
    const bl = 0.66 * L;
    for (const x of [-0.013, 0.013]) add(g, tube(0.012, 0.012, bl), metal, x, 0.03, 0.06);
    add(g, box(0.05, 0.045, 0.1), metal, 0, 0.022, 0.0);                               // action
    add(g, box(0.04, 0.03, 0.26), wood, 0, 0.01, 0.17);                                 // fore-end
    add(g, box(0.035, 0.05, 0.08), wood, 0, -0.02, -0.06, 0.35);                        // wrist
    add(g, box(0.042, 0.09, 0.28), wood, 0, -0.035, -0.22, 0.12);                       // stock
    if (m.stock === 'padded') add(g, box(0.046, 0.1, 0.03), std(0x3a2416, 0.8), 0, -0.05, -0.37, 0.12);
    if (inl) add(g, box(0.052, 0.02, 0.08), inl, 0, 0.04, 0.0);
    mz = 0.06 + bl; my = 0.03;
  } else if (key === 'rifle') {
    const bl = 0.3 * L;
    add(g, box(0.045, 0.06, 0.3), metal, 0, 0.03, 0.04);                                // receiver
    add(g, box(0.04, 0.05, 0.2), wood, 0, 0.022, 0.26);                                  // handguard
    add(g, tube(0.009, 0.009, 0.2), metal, 0, 0.065, 0.2);                               // gas tube
    add(g, tube(0.009, 0.008, bl), metal, 0, 0.035, 0.36); mz = 0.36 + bl; my = 0.035;
    add(g, box(0.008, 0.035, 0.01), metal, 0, 0.065, 0.36 + bl - 0.04);                 // front sight
    add(g, box(0.03, 0.08, 0.04), wood, 0, -0.035, -0.02, -0.35);                        // pistol grip
    if (m.stock === 'folding') { add(g, tube(0.006, 0.006, 0.26), metal, 0.018, 0.035, -0.36); add(g, tube(0.006, 0.006, 0.26), metal, -0.018, 0.035, -0.36); add(g, box(0.045, 0.07, 0.012), metal, 0, 0.0, -0.36); }
    else add(g, box(0.04, 0.07, 0.26), wood, 0, 0.0, -0.24, 0.12);                       // stock
    if (m.stock === 'padded') add(g, box(0.044, 0.08, 0.025), std(0x3a2416, 0.8), 0, -0.02, -0.38, 0.12);
    // the magazine: curved banana, or a drum
    if (m.mag === 'drum') add(g, tube(0.06, 0.06, 0.05, 18), dark, 0, -0.04, 0.12).rotation.set(0, Math.PI / 2, 0);
    else { const n = m.mag === 'ext' ? 1.5 : 1; const curve = new THREE.TorusGeometry(0.18, 0.016, 5, 10, 0.55 * n); const mg = add(g, curve, dark, 0, -0.02 + 0.18, 0.12 + 0.03, 0, Math.PI / 2, -Math.PI / 2 - 0.05); mg.scale.set(1, 1, 1.5); }
    if (inl) add(g, box(0.047, 0.012, 0.18), inl, 0, 0.05, 0.04);
  } else if (key === 'sniper') {
    const bl = 0.42 * L;
    add(g, box(0.042, 0.05, 0.62), wood, 0, 0.0, 0.16);                                  // fore-stock
    add(g, box(0.035, 0.035, 0.22), metal, 0, 0.04, 0.0);                                // receiver
    add(g, tube(0.009, 0.008, bl), metal, 0, 0.035, 0.46); mz = 0.46 + bl; my = 0.035;
    add(g, box(0.036, 0.065, 0.07), wood, 0, -0.03, -0.08, 0.4);                         // wrist
    add(g, box(0.04, 0.09, 0.27), wood, 0, -0.04, -0.27, 0.1);                           // butt
    add(g, tube(0.006, 0.006, 0.05), metal, -0.03, 0.045, -0.05).rotation.set(0, -Math.PI / 2, 0);   // bolt handle
    add(g, new THREE.SphereGeometry(0.01, 6, 5), metal, -0.08, 0.045, -0.05);
    add(g, box(0.03, m.mag === 'ext' ? 0.07 : 0.045, 0.06), dark, 0, -0.04, 0.02);       // box magazine
    if (m.stock === 'padded') add(g, box(0.044, 0.1, 0.025), std(0x3a2416, 0.8), 0, -0.05, -0.41, 0.1);
    if (inl) add(g, box(0.037, 0.008, 0.2), inl, 0, 0.058, 0.0);
  } else if (key === 'rocket') {
    const olive = std(0x4a5236, 0.6, 0.25);
    add(g, tube(0.045, 0.045, 1.38, 14), m.finish === 'blued' ? olive : metal, 0, 0.09, -0.62); mz = 0.76; my = 0.09;
    add(g, tube(0.06, 0.047, 0.16, 14), m.finish === 'blued' ? olive : metal, 0, 0.09, -0.62);        // the flared mouth at the back
    add(g, box(0.03, 0.09, 0.04), wood, 0, -0.01, 0.0, -0.2);                            // grip
    add(g, box(0.03, 0.08, 0.04), wood, 0, 0.0, 0.3, -0.2);                              // front grip
    add(g, box(0.07, 0.1, 0.16), wood, 0, 0.02, -0.3);                                   // shoulder rest
    add(g, box(0.01, 0.06, 0.04), dark, 0.05, 0.13, 0.4);                                // sight frame
    if (m.warhead === 'heavy') add(g, new THREE.ConeGeometry(0.05, 0.12, 12), std(0x6a5a3a, 0.5, 0.4), 0, 0.09, 0.82, Math.PI / 2);
    else add(g, new THREE.ConeGeometry(0.04, 0.1, 12), std(0x6a6a5a, 0.5, 0.4), 0, 0.09, 0.81, Math.PI / 2);
    if (inl) add(g, tube(0.047, 0.047, 0.05), inl, 0, 0.09, 0.2);
  }
  if (m.barrel === 'silencer' && key !== 'shotgun' && key !== 'rocket') { add(g, tube(key === 'pistol' ? 0.014 : 0.018, key === 'pistol' ? 0.014 : 0.018, key === 'pistol' ? 0.11 : 0.17), dark, 0, my, mz); mz += key === 'pistol' ? 0.11 : 0.17; }
  const sg = MODS.sight.opts[m.sight];
  if (sg && sg.zoom && (key === 'rifle' || key === 'sniper')) { const len = sg.zoom >= 30 ? 0.16 : sg.zoom >= 16 ? 0.26 : 0.36; scope(key === 'rifle' ? 0.105 : 0.095, key === 'rifle' ? -0.02 : -0.08, len, sg.zoom >= 30 ? 0.016 : 0.02); }
  muzzle.position.set(0, my, mz); g.add(muzzle); g.userData.muzzle = muzzle;
  const flash = new THREE.Mesh(new THREE.SphereGeometry(key === 'rocket' ? 0.14 : key === 'shotgun' ? 0.09 : 0.06, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2.6, 1.0), transparent: true, opacity: 0.9, depthWrite: false }));
  flash.position.set(0, my, mz + 0.04); flash.scale.set(1, 1, 2.2); flash.visible = false; g.add(flash); g.userData.flash = flash;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
