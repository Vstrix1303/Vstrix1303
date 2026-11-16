// Weapons of the kalari and the road, and one from the Company's world.
// Each is built along +z from the grip (the hand holds the origin), the way the staff always was.
import * as THREE from 'three';

const std = (color, rough = 0.6, metal = 0, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...o });
const WOOD = () => std(0x6a4a2a, 0.7), DARK = () => std(0x3a2616, 0.6), STEEL = () => std(0xb8bcc0, 0.32, 0.85), BRASS = () => std(0xc9a13a, 0.35, 0.8);

// stats — dmg: per hit; reach: metres; arc: cos of the half-angle hit; dur: swing length; cd: time between swings;
// multi: hits everyone in the arc (else the nearest); guard: what a block lets through; knock: knockback scale
export const WEAPONS = {
  staff: { name: 'Lathi', ml: 'വടി', desc: 'A long staff of seasoned bamboo, bound with brass. Long reach, steady blows — the weapon you came home with.', price: 0, dmg: 50, reach: 2.15, arc: 0.3, dur: 0.42, cd: 0.62, guard: 0.15, knock: 1, low: true, icon: 'staff' },
  cheruvadi: { name: 'Cheruvadi', ml: 'ചെറുവടി', desc: 'The short stick of the kalari, a forearm and a half long. Quick strikes, one after another, close in.', price: 80, dmg: 30, reach: 1.65, arc: 0.4, dur: 0.28, cd: 0.36, guard: 0.2, knock: 0.6, icon: 'short', at: 'kalari' },
  otta: { name: 'Otta', ml: 'ഒറ്റ', desc: 'A curved stick shaped like an elephant\'s tusk, aimed at the body\'s vital points. Every third blow lands on a marma and drops a man.', price: 160, dmg: 40, reach: 1.7, arc: 0.35, dur: 0.38, cd: 0.52, guard: 0.18, knock: 1.2, marma: 3, icon: 'otta', at: 'kalari' },
  kathi: { name: 'Vettukathi', ml: 'വെട്ടുകത്തി', desc: 'The coconut-climber\'s billhook. Heavy in the hand and very sharp; short reach.', price: 60, dmg: 62, reach: 1.6, arc: 0.4, dur: 0.38, cd: 0.6, guard: 0.3, knock: 1.1, icon: 'kathi', at: 'kollan' },
  val: { name: 'Val and paricha', ml: 'വാളും പരിചയും', desc: 'A straight sword and a round shield of hide over cane, the kalari\'s classic pairing. Blocks with the shield hardly hurt, and a well-timed one opens the enemy wide.', price: 360, dmg: 66, reach: 1.95, arc: 0.3, dur: 0.4, cd: 0.6, guard: 0.04, parry: 0.45, knock: 1.1, shield: true, icon: 'val', at: 'kollan' },
  urumi: { name: 'Urumi', ml: 'ഉറുമി', desc: 'The flexible sword: a coil of thin steel that unrolls into a whip-blade. Slow and dangerous to its owner, it cuts everyone around you in one sweep.', price: 640, dmg: 48, reach: 3.2, arc: -0.25, dur: 0.66, cd: 1.0, guard: 0.45, knock: 1.4, multi: true, icon: 'urumi', at: 'kalari', need: 4 },
  revolver: { name: 'Webley revolver', ml: 'തോക്ക്', desc: 'A British service revolver, sold quietly at the back of a godown. Six rounds. Every guard within earshot comes running when it fires. Hold right mouse to aim.', price: 1280, dmg: 120, reach: 32, gun: true, shots: 6, reload: 2.4, cd: 0.55, guard: 0.6, knock: 1.6, icon: 'gun', at: 'gun', need: 5 },
};
export const AMMO = { price: 4, n: 6, name: 'Cartridges (6)', desc: '.455 cartridges, wrapped in oilcloth. Six to a packet.' };
export const ORDER = ['staff', 'cheruvadi', 'otta', 'kathi', 'val', 'urumi', 'revolver'];

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
  } else if (key === 'revolver') {
    g.position.set(0, -0.03, 0.02);
    const steel = std(0x2a2c30, 0.35, 0.8);
    add(g, new THREE.BoxGeometry(0.03, 0.09, 0.05), std(0x3a2414, 0.6), 0, -0.05, -0.01, -0.35);    // grip
    add(g, new THREE.BoxGeometry(0.032, 0.05, 0.07), steel, 0, 0.01, 0.04);
    add(g, new THREE.CylinderGeometry(0.024, 0.024, 0.045, 10), steel, 0, 0.012, 0.075, Math.PI / 2);
    add(g, rod(0.009, 0.008, 0.15), steel, 0, 0.022, 0.08);
    const flash = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2.6, 1.0), transparent: true, opacity: 0.9, depthWrite: false }));
    flash.position.set(0, 0.022, 0.25); flash.visible = false; g.add(flash); g.userData.flash = flash;
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
