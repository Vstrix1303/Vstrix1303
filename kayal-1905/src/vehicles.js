// The machines of 1957 Kerala, built in code: the roadster bicycle, the jeep, the state transport bus
// with its long bonnet, the lorry, a rounded saloon car and the passenger launch. All original
// designs in the spirit of the period, not any particular maker's.
// Bicycles and jeeps can be ridden: Ride has the same shape as the horse (drive/step/update), so the
// player's riding, camera and dismounting all work with it.
import * as THREE from 'three';
import { G } from './state.js';
import { getHeight } from './heightfield.js';
import { groundAt, resolve } from './physics.js';
import { damp, clamp, angleDiff } from './util.js';
import { makeVallam } from './characters.js';

const matCache = new Map();
const M = (color, rough = 0.55, metal = 0.15) => {
  const k = color + '|' + rough + '|' + metal;
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }));
  return matCache.get(k);
};
const TYRE = () => M(0x161412, 0.9, 0), CHROME = () => M(0xd8d8d0, 0.25, 0.85), GLASS = () => M(0x1a2226, 0.15, 0.4), SEAT = () => M(0x2a1e16, 0.8, 0);
const mesh = (g, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
const box = (g, w, h, d, mat, x, y, z) => mesh(g, new THREE.BoxGeometry(w, h, d), mat, x, y, z);
// a tube between two points
const tube = (g, a, b, r, mat) => {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B);
  const m = mesh(g, new THREE.CylinderGeometry(r, r, len, 6), mat);
  m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  return m;
};
// a body extruded from its side profile: pts are [z, y] going round the outline
function sideBody(pts, width, mat, bevel = 0.06) {
  const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]);
  s.splineThru(pts.slice(1).map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 6, steps: 1 });
  g.rotateY(-Math.PI / 2); g.translate((width - bevel * 2) / 2, 0, 0);
  return new THREE.Mesh(g, mat);
}
// a wheel that rolls about x; returns the spinning part
function wheel(g, r, w, x, y, z, hub = 0xb8b4aa) {
  const piv = new THREE.Group(); piv.position.set(x, y, z); g.add(piv);
  const spin = new THREE.Group(); piv.add(spin);
  const t = mesh(spin, new THREE.CylinderGeometry(r, r, w, 16).rotateZ(Math.PI / 2), TYRE());
  mesh(spin, new THREE.CylinderGeometry(r * 0.62, r * 0.62, w + 0.02, 12).rotateZ(Math.PI / 2), M(hub, 0.4, 0.5));
  mesh(spin, new THREE.BoxGeometry(w + 0.03, r * 0.18, r * 0.9), M(0x3a3632, 0.5, 0.3));          // a spoke of the hub, so the turning shows
  t.castShadow = true;
  return { piv, spin, r };
}

// ---------------------------------------------------------------- models
export function makeBicycle(color = 0x14130f) {
  const root = new THREE.Group(), paint = M(color, 0.45, 0.3), black = M(0x101010, 0.6, 0.2);
  const ring = (z) => {
    const piv = new THREE.Group(); piv.position.set(0, 0.34, z); root.add(piv); const spin = new THREE.Group(); piv.add(spin);
    mesh(spin, new THREE.TorusGeometry(0.33, 0.016, 6, 28).rotateY(Math.PI / 2), TYRE());
    mesh(spin, new THREE.TorusGeometry(0.31, 0.008, 4, 28).rotateY(Math.PI / 2), CHROME());
    for (let i = 0; i < 9; i++) { const sp = mesh(spin, new THREE.CylinderGeometry(0.0025, 0.0025, 0.62, 3), CHROME()); sp.rotation.x = i / 9 * Math.PI; }
    mesh(spin, new THREE.CylinderGeometry(0.03, 0.03, 0.08, 8).rotateZ(Math.PI / 2), CHROME());
    return { piv, spin, r: 0.34 };
  };
  const rear = ring(-0.53);
  const BB = [0, 0.33, -0.02], SEATP = [0, 0.86, -0.2], HEAD = [0, 0.9, 0.38], HEADL = [0, 0.72, 0.42], RA = [0, 0.34, -0.53];
  tube(root, BB, SEATP, 0.019, paint); tube(root, SEATP, HEAD, 0.018, paint); tube(root, BB, HEADL, 0.02, paint); tube(root, HEADL, HEAD, 0.021, paint);
  for (const sx of [-0.05, 0.05]) { tube(root, [sx, 0.33, -0.02], [sx, 0.34, -0.53], 0.012, paint); tube(root, [sx, 0.85, -0.19], [sx, 0.34, -0.53], 0.011, paint); }
  // front: fork, wheel and handlebar turn together
  const steer = new THREE.Group(); steer.position.set(0, 0.9, 0.38); root.add(steer);
  const front = ring(0); root.remove(front.piv); front.piv.position.set(0, 0.34 - 0.9, 0.55 - 0.38); steer.add(front.piv);
  for (const sx of [-0.045, 0.045]) tube(steer, [sx, 0.02, 0.0], [sx, -0.56, 0.17], 0.012, paint);
  tube(steer, [0, 0, 0], [0, 0.13, -0.02], 0.016, CHROME());
  tube(steer, [-0.3, 0.14, -0.1], [0.3, 0.14, -0.1], 0.012, CHROME());
  for (const sx of [-0.3, 0.3]) tube(steer, [sx * 0.85, 0.14, -0.1], [sx, 0.13, -0.17], 0.016, black);
  mesh(steer, new THREE.SphereGeometry(0.035, 8, 6), CHROME(), 0.2, 0.15, -0.1);       // the bell
  // saddle, chain wheel, pedals, carrier, mudguards
  const saddle = mesh(root, new THREE.SphereGeometry(0.11, 10, 6), SEAT(), 0, 0.9, -0.22); saddle.scale.set(0.8, 0.32, 1.25);
  mesh(root, new THREE.CylinderGeometry(0.09, 0.09, 0.012, 16).rotateZ(Math.PI / 2), black, 0.06, 0.33, -0.02);
  const crank = new THREE.Group(); crank.position.set(0, 0.33, -0.02); root.add(crank);
  for (const s of [-1, 1]) { tube(crank, [s * 0.08, 0, 0], [s * 0.08, -0.17 * s, 0], 0.01, CHROME()); box(crank, 0.09, 0.02, 0.05, black, s * 0.13, -0.17 * s, 0); }
  tube(root, [-0.07, 0.72, -0.28], [-0.07, 0.72, -0.78], 0.008, black); tube(root, [0.07, 0.72, -0.28], [0.07, 0.72, -0.78], 0.008, black); box(root, 0.16, 0.012, 0.42, black, 0, 0.73, -0.55);
  return { root, wheels: [front, rear], steer, crank };
}

export function makeJeep(color = 0x4f5a3c) {
  const root = new THREE.Group(), body = M(color, 0.65, 0.2), dark = M(0x22241e, 0.7, 0.2);
  box(root, 1.42, 0.62, 2.1, body, 0, 0.78, -0.45);                     // the tub
  box(root, 1.08, 0.44, 1.25, body, 0, 0.88, 1.15);                     // bonnet
  box(root, 1.1, 0.48, 0.08, dark, 0, 0.84, 1.79);                      // grille
  for (let i = -3; i <= 3; i++) box(root, 0.05, 0.36, 0.02, M(0x8a8a80, 0.5, 0.4), i * 0.13, 0.84, 1.835);
  for (const sx of [-1, 1]) {
    box(root, 0.3, 0.05, 1.05, body, sx * 0.64, 0.98, 1.2);              // flat front fenders
    box(root, 0.3, 0.4, 0.05, body, sx * 0.64, 0.8, 1.7);
    mesh(root, new THREE.SphereGeometry(0.075, 10, 8), M(0xf0ead0, 0.3, 0.1), sx * 0.38, 0.98, 1.8);   // headlamps
    box(root, 0.05, 0.6, 0.04, dark, sx * 0.66, 1.4, 0.55);              // windscreen frame
  }
  box(root, 1.36, 0.05, 0.04, dark, 0, 1.7, 0.55); const gl = box(root, 1.28, 0.5, 0.02, GLASS(), 0, 1.42, 0.55); gl.material = M(0x7a8a8a, 0.1, 0.5); gl.material.transparent = true; gl.material.opacity = 0.35;
  box(root, 0.5, 0.12, 0.5, SEAT(), -0.35, 0.95, -0.05); box(root, 0.5, 0.5, 0.1, SEAT(), -0.35, 1.2, -0.3);
  box(root, 0.5, 0.12, 0.5, SEAT(), 0.35, 0.95, -0.05); box(root, 0.5, 0.5, 0.1, SEAT(), 0.35, 1.2, -0.3);
  box(root, 1.3, 0.12, 0.5, SEAT(), 0, 0.95, -1.05);
  const sw = mesh(root, new THREE.TorusGeometry(0.17, 0.018, 6, 20), dark, -0.35, 1.22, 0.32); sw.rotation.x = -0.9;
  const spare = wheel(root, 0.33, 0.2, 0, 0.95, -1.62); spare.piv.rotation.y = Math.PI / 2;
  const wheels = [[-0.68, 1.1], [0.68, 1.1], [-0.68, -1.0], [0.68, -1.0]].map(([x, z]) => wheel(root, 0.36, 0.24, x, 0.36, z));
  return { root, wheels, front: wheels.slice(0, 2) };
}

export function makeBus() {
  const root = new THREE.Group(), red = M(0x9c1e18, 0.55, 0.2), cream = M(0xe6dcc0, 0.6, 0.1), dark = M(0x1a1816, 0.7, 0.2);
  box(root, 2.3, 0.95, 6.9, red, 0, 1.1, -0.65);                        // lower body
  box(root, 2.3, 0.22, 6.9, cream, 0, 1.68, -0.65);
  box(root, 2.32, 0.62, 6.86, dark, 0, 2.08, -0.65);                    // the window band, open to the air
  for (let i = 0; i < 8; i++) box(root, 2.34, 0.62, 0.12, cream, 0, 2.08, -3.95 + i * 0.94);
  box(root, 2.3, 0.3, 6.9, cream, 0, 2.54, -0.65);
  const roof = mesh(root, new THREE.CylinderGeometry(1.2, 1.2, 6.9, 18, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2), cream, 0, 2.62, -0.65); roof.scale.y = 0.22;
  for (const sx of [-1, 1]) box(root, 0.04, 0.12, 5, M(0x5a5248, 0.5, 0.5), sx * 0.95, 2.95, -1.2);
  box(root, 1.0, 0.35, 0.7, M(0x6a5a3e, 0.8, 0), 0.3, 3.0, -1.8); box(root, 0.7, 0.3, 0.5, M(0x3a3a3a, 0.5, 0.4), -0.4, 2.98, -0.8);   // luggage
  // the bonnet at the front, the cab behind its windscreen
  box(root, 1.5, 0.85, 1.35, red, 0, 1.12, 3.55);
  box(root, 1.2, 0.7, 0.06, dark, 0, 1.12, 4.24);
  for (const sx of [-1, 1]) { box(root, 0.42, 0.06, 1.3, red, sx * 0.95, 0.92, 3.5); mesh(root, new THREE.SphereGeometry(0.11, 10, 8), M(0xf2ecd0, 0.3, 0.1), sx * 0.62, 1.36, 4.24); }
  box(root, 2.0, 0.6, 0.05, GLASS(), 0, 2.05, 2.86);
  box(root, 1.6, 0.26, 0.05, M(0xf2ecd8, 0.6, 0), 0, 2.5, 2.88);             // the destination board
  box(root, 0.05, 1.5, 0.75, dark, 1.16, 1.45, 2.2);                        // the door, on the left
  const wheels = [[-0.95, 3.35], [0.95, 3.35], [-0.95, -2.6], [0.95, -2.6]].map(([x, z]) => wheel(root, 0.5, 0.32, x, 0.5, z));
  return { root, wheels, front: wheels.slice(0, 2) };
}

export function makeLorry(color = 0x2c4a6a) {
  const root = new THREE.Group(), cab = M(color, 0.55, 0.2), dark = M(0x1a1816, 0.7, 0.2), wood = M(0x7a5a3a, 0.85, 0);
  box(root, 1.95, 1.25, 1.3, cab, 0, 1.55, 1.05);
  box(root, 1.75, 0.5, 0.05, GLASS(), 0, 1.85, 1.72);
  box(root, 1.4, 0.8, 1.35, cab, 0, 1.2, 2.4); box(root, 1.2, 0.65, 0.06, dark, 0, 1.2, 3.1);
  for (const sx of [-1, 1]) { box(root, 0.36, 0.06, 1.2, cab, sx * 0.9, 1.0, 2.3); mesh(root, new THREE.SphereGeometry(0.1, 10, 8), M(0xf2ecd0, 0.3, 0.1), sx * 0.55, 1.42, 3.1); }
  box(root, 2.2, 0.12, 3.8, wood, 0, 1.05, -1.4);
  for (const sx of [-1, 1]) box(root, 0.06, 0.6, 3.8, wood, sx * 1.07, 1.4, -1.4);
  box(root, 2.2, 0.6, 0.06, wood, 0, 1.4, -3.28); box(root, 2.2, 0.6, 0.06, wood, 0, 1.4, 0.45);
  for (let i = 0; i < 9; i++) { const s = mesh(root, new THREE.SphereGeometry(0.34, 8, 6), M(0xb8a888, 0.95, 0), ((i % 3) - 1) * 0.62, 1.42 + Math.floor(i / 6) * 0.3, -2.6 + Math.floor(i / 3) % 2 * 0.8 + (i > 5 ? 0.4 : 0)); s.scale.set(1.15, 0.6, 0.85); }
  const wheels = [[-0.88, 2.35], [0.88, 2.35], [-0.95, -2.0], [0.95, -2.0]].map(([x, z]) => wheel(root, 0.48, 0.3, x, 0.48, z));
  return { root, wheels, front: wheels.slice(0, 2) };
}

export function makeCar(color = 0x1a1a1c) {
  const root = new THREE.Group(), paint = M(color, 0.35, 0.45);
  const shell = sideBody([[-2.1, 0.32], [-2.18, 0.6], [-2.0, 0.88], [-1.4, 0.96], [-1.05, 1.02], [-0.82, 1.42], [0.36, 1.47], [0.85, 1.04], [1.6, 0.98], [2.12, 0.86], [2.16, 0.55], [2.05, 0.32], [1.6, 0.3], [-1.6, 0.3], [-2.1, 0.32]], 1.62, paint, 0.08);
  shell.castShadow = true; root.add(shell);
  const gl = sideBody([[-1.0, 1.03], [-0.79, 1.38], [0.34, 1.43], [0.8, 1.05], [-1.0, 1.03]], 1.66, GLASS(), 0.02); root.add(gl);
  for (const z of [-2.2, 2.2]) box(root, 1.66, 0.14, 0.1, CHROME(), 0, 0.42, z);
  for (const sx of [-1, 1]) mesh(root, new THREE.SphereGeometry(0.09, 10, 8), M(0xf2ecd0, 0.3, 0.1), sx * 0.58, 0.78, 2.14);
  box(root, 0.6, 0.3, 0.04, CHROME(), 0, 0.62, 2.17);
  const wheels = [[-0.72, 1.32], [0.72, 1.32], [-0.72, -1.32], [0.72, -1.32]].map(([x, z]) => wheel(root, 0.32, 0.2, x, 0.32, z, 0xd8d8d0));
  return { root, wheels, front: wheels.slice(0, 2) };
}

// the passenger launch of the backwaters: a long hull under a canopy, an engine thumping at the stern
export function makeLaunch() {
  const v = makeVallam({ L: 10, B: 1.15, D: 0.75, sheer: 0.4 });
  const root = v.root, wood = M(0x5a4030, 0.8, 0), roofM = M(0x2a4a6a, 0.6, 0.1);
  for (const z of [-3.2, -1.2, 0.8, 2.8]) for (const sx of [-1, 1]) { const p = mesh(root, new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6), wood, sx * 0.85, 0.65, z); p.castShadow = true; }
  box(root, 2.0, 0.08, 7.0, roofM, 0, 1.48, -0.2);
  box(root, 2.02, 0.22, 7.02, M(0xe6dcc0, 0.6, 0.1), 0, 1.36, -0.2);
  for (const z of [-2.6, -0.6, 1.4]) box(root, 1.5, 0.08, 0.35, wood, 0, 0.32, z);
  box(root, 0.6, 0.5, 0.7, M(0x2a2a2a, 0.5, 0.5), 0, 0.3, -4.2);
  return { root, wheels: [] };
}

// ---------------------------------------------------------------- engine sound (only for what the player drives)
class Engine {
  constructor() { this.on = false; }
  ensure() {
    const a = G.audio; if (this.osc || !a || !a.ctx) return !!this.osc;
    const c = a.ctx;
    this.osc = c.createOscillator(); this.osc.type = 'sawtooth';
    this.osc2 = c.createOscillator(); this.osc2.type = 'square';
    this.f = c.createBiquadFilter(); this.f.type = 'lowpass'; this.f.frequency.value = 420;
    this.g = c.createGain(); this.g.gain.value = 0;
    this.osc.connect(this.f); this.osc2.connect(this.f); this.f.connect(this.g); this.g.connect(a.master);
    this.osc.start(); this.osc2.start();
    return true;
  }
  set(speed, on) {
    if (!this.ensure()) return;
    const t = G.audio.ctx.currentTime, rpm = 28 + Math.abs(speed) * 4.5;
    this.osc.frequency.setTargetAtTime(rpm, t, 0.1); this.osc2.frequency.setTargetAtTime(rpm * 0.5, t, 0.1);
    this.g.gain.setTargetAtTime(on && G.audio.enabled !== false ? 0.05 + Math.min(0.06, Math.abs(speed) * 0.004) : 0, t, 0.15);
  }
}

// ---------------------------------------------------------------- what the player can ride
const SPEC = {
  bicycle: { make: makeBicycle, max: 5.2, sprint: 7.6, acc: 2.6, brake: 6, rev: 0, turn: 2.4, radius: 0.4, camDist: 4.4, camHead: 1.75, pose: 'cycle', seat: [0, 0.05, -0.16], icon: 'bike', on: 'Ride the bicycle', off: 'Get off the bicycle', bell: true },
  car: { make: makeCar, max: 13, sprint: 19, acc: 5, brake: 10, rev: 4, turn: 1.5, radius: 1.0, len: 4.4, camDist: 7.4, camHead: 2.0, pose: 'drive', seat: [-0.38, -0.25, 0.0], icon: 'jeep', on: 'Drive the car', off: 'Get out of the car', engine: true },
  lorry: { make: makeLorry, max: 10, sprint: 13.5, acc: 2.8, brake: 7, rev: 3, turn: 1.0, radius: 1.5, len: 6.6, camDist: 11, camHead: 3.3, pose: 'drive', seat: [-0.45, 0.4, 1.0], icon: 'jeep', on: 'Drive the lorry', off: 'Get out of the lorry', engine: true },
  bus: { make: makeBus, max: 9, sprint: 12, acc: 2.2, brake: 6, rev: 2.5, turn: 0.85, radius: 1.8, len: 8.4, camDist: 13.5, camHead: 3.8, pose: 'drive', seat: [-0.6, 0.5, 2.4], icon: 'jeep', on: 'Drive the bus', off: 'Get out of the bus', engine: true },
  jeep: { make: makeJeep, len: 3.6, max: 11, sprint: 16, acc: 4.5, brake: 9, rev: 3.5, turn: 1.6, radius: 1.05, camDist: 7.2, camHead: 2.1, pose: 'drive', seat: [-0.35, 0.14, -0.08], icon: 'jeep', on: 'Drive the jeep', off: 'Get out of the jeep', engine: true },
};
export class Ride {
  constructor(scene, kind, x, z, yaw, o = {}) {
    const S = this.spec = SPEC[kind], m = S.make(o.color);
    this.kind = kind; this.model = m; this.root = m.root; this.seatNode = m.root;
    this.pos = new THREE.Vector3(x, groundAt(x, z), z); this.yaw = yaw; this.speed = 0; this.pitch = 0; this.roll = 0; this.yawRate = 0; this.rider = null;
    this.camDist = S.camDist; this.camHead = S.camHead; this.pose = S.pose; this.seat = S.seat; this.icon = S.icon; this.offLabel = S.off;
    this.engine = S.engine ? new Engine() : null;
    this.root.traverse((ob) => ob.layers.set(1));
    scene.add(this.root);
    this.sync();
  }
  drive(dt, wx, wz, sprint) {
    const S = this.spec, wl = Math.hypot(wx, wz);
    let target = 0; this.yawRate = 0;
    if (wl > 0.1) {
      const want = Math.atan2(wx, wz), diff = angleDiff(this.yaw, want);
      if (S.rev && Math.abs(diff) > 2.3 && this.speed < 1.2) {          // asking to go back the way you face: reverse
        target = -S.rev * wl;
        const rd = angleDiff(this.yaw, want + Math.PI); this.yawRate = clamp(rd, -1, 1) * S.turn * 0.6 * Math.min(1, Math.abs(this.speed) / 1.5); this.yaw -= this.yawRate * dt;
      } else {
        const grip = Math.min(1, Math.abs(this.speed) / 2.2) * (1 - Math.min(0.55, Math.abs(this.speed) / 40));
        this.yawRate = clamp(diff, -1, 1) * S.turn * grip; this.yaw += this.yawRate * dt;
        target = (sprint ? S.sprint : S.max) * Math.min(1, wl) * clamp(1.25 - Math.abs(diff) / 1.6, 0.25, 1);
      }
    }
    const a = Math.sign(target - this.speed) === Math.sign(this.speed) || this.speed === 0 ? S.acc : S.brake;
    this.speed += clamp(target - this.speed, -a * dt, a * dt);
  }
  step(dt) {
    if (Math.abs(this.speed) > 0.01) {
      const nx = this.pos.x + Math.sin(this.yaw) * this.speed * dt, nz = this.pos.z + Math.cos(this.yaw) * this.speed * dt;
      if (getHeight(nx, nz) < -0.4 || Math.abs(nx) > 745 || Math.abs(nz) > 745) this.speed *= 0.5;
      else {
        const ox = this.pos.x, oz = this.pos.z;
        this.pos.x = nx; this.pos.z = nz; resolve(this.pos, this.spec.radius, this.pos.y);
        const moved = Math.hypot(this.pos.x - ox, this.pos.z - oz);
        if (moved < Math.abs(this.speed) * dt * 0.4) { if (Math.abs(this.speed) > 4) G.audio?.sfx('thud', 0.6); this.speed *= 0.6; }
        // run someone down at speed and they go flying
        if (this.rider && Math.abs(this.speed) > 3) for (const n of G.npcs) {
          if (!n.active || n.ko || n.attached || n.noHit) continue;
          const d = Math.hypot(n.pos.x - this.pos.x, n.pos.z - this.pos.z);
          if (d < this.spec.radius + 0.5) { n.takeHit(Math.abs(this.speed) * 9, this.pos.x, this.pos.z); n.kx = Math.sin(this.yaw) * this.speed; n.kz = Math.cos(this.yaw) * this.speed; G.audio?.sfx('thud'); }
        }
      }
    }
    this.pos.y = damp(this.pos.y, groundAt(this.pos.x, this.pos.z, this.pos.y + 0.6), 14, dt);
    const f = this.spec.len ? this.spec.len * 0.3 : 0.5, sx = Math.sin(this.yaw), cz = Math.cos(this.yaw);
    const hf = getHeight(this.pos.x + sx * f, this.pos.z + cz * f), hb = getHeight(this.pos.x - sx * f, this.pos.z - cz * f);
    this.pitch = damp(this.pitch, clamp(-Math.atan2(hf - hb, 2 * f), -0.35, 0.35), 6, dt);
    this.roll = damp(this.roll, this.kind === 'bicycle' ? clamp(-this.yawRate * Math.abs(this.speed) * 0.06, -0.35, 0.35) : 0, 5, dt);
    const m = this.model, ds = this.speed * dt;
    for (const w of m.wheels) w.spin.rotation.x += ds / w.r;
    if (m.crank) m.crank.rotation.x += ds / 0.34 * 0.55;
    const steer = clamp(this.yawRate * 0.5, -0.5, 0.5);
    if (m.steer) m.steer.rotation.y = steer; if (m.front) for (const w of m.front) w.piv.rotation.y = steer;
  }
  sync() { this.root.position.copy(this.pos); this.root.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ'); }
  horn() {
    G.audio?.sfx(this.spec.bell ? 'cycbell' : 'horn');
    for (const n of G.npcs) if (n.active && !n.hostile && Math.hypot(n.pos.x - this.pos.x, n.pos.z - this.pos.z) < 8) n.talkT = Math.max(n.talkT || 0, 1);
  }
  update(dt) {
    if (!this.rider) { this.speed = damp(this.speed, 0, 3, dt); this.yawRate = 0; }
    this.step(dt);
    this.sync();
    if (this.engine) this.engine.set(this.speed, !!this.rider);
    if (Math.abs(this.speed) > 8 && Math.random() < dt * 6) G.fx?.dust(this.pos, 1, 1.0);
  }
}
