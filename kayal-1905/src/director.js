// The dialogue camera, shot like film rather than like a game camera.
// One side of the line between the two speakers is chosen and kept (the 180° rule), so
// screen direction never flips. The scene opens on a two-shot on a long lens with both
// people in frame; lines then cut to over-the-shoulder shots that keep the listener's
// shoulder in the foreground, so both are still seen; the two-shot returns to let a scene
// breathe. Shots are hard cuts, never camera flights, and each one creeps slowly in.
import * as THREE from 'three';
import { getHeight } from './heightfield.js';
import { segmentBlocked, interiorAt } from './physics.js';

const UP = 1.52;           // eye height on a standing figure
const tmp = new THREE.Vector3();

export class Director {
  constructor(player) { this.p = player; this.reset(); }
  reset() { this.side = 0; this.n = 0; this.last = null; this.runOnSame = 0; }

  // a, b: world positions (feet) of the two characters; speaker: 'a' | 'b'
  shot(a, b, speaker) {
    const ax = b.x - a.x, az = b.z - a.z, sep = Math.hypot(ax, az) || 1;
    const nx = ax / sep, nz = az / sep;
    const ha = a.y + UP * (a.scale || 1), hb = b.y + UP * (b.scale || 1);
    const mid = new THREE.Vector3((a.x + b.x) / 2, (ha + hb) / 2, (a.z + b.z) / 2);
    const indoors = interiorAt(mid.x, mid.z);
    // choose the side of the line once per conversation: the one the camera can see from
    if (!this.side) {
      this.side = 1;
      const test = (s) => { const px = -nz * s, pz = nx * s, d = Math.min(4.5, sep * 1.2 + 1.8); const cx = mid.x + px * d, cz = mid.z + pz * d; return !segmentBlocked(cx, cz, mid.x, mid.z) && getHeight(cx, cz) > -0.6; };
      if (!test(1) && test(-1)) this.side = -1;
    }
    const px = -nz * this.side, pz = nx * this.side;
    const changed = speaker !== this.last;
    this.runOnSame = changed ? 0 : this.runOnSame + 1;
    // the scene opens wide, returns wide every few lines, otherwise over the listener's shoulder
    const wide = this.n === 0 || (this.n % 4 === 3) || this.runOnSame >= 2;
    this.n++; this.last = speaker;
    let pos, look, fov, push;
    if (wide) {
      const d = indoors ? Math.min(2.6, sep * 1.1 + 1.2) : Math.min(6.5, Math.max(2.8, sep * 1.25 + 1.7));
      pos = new THREE.Vector3(mid.x + px * d, mid.y - 0.12, mid.z + pz * d);
      look = new THREE.Vector3(mid.x, mid.y - 0.06, mid.z);
      fov = indoors ? 46 : 30; push = 0.05;
    } else {
      // over the listener's shoulder, on the chosen side, looking at the speaker
      const S = speaker === 'a' ? a : b, L = speaker === 'a' ? b : a, hs = speaker === 'a' ? ha : hb, hl = speaker === 'a' ? hb : ha;
      const ux = (L.x - S.x) / sep, uz = (L.z - S.z) / sep;
      const back = indoors ? 0.6 : 0.95, out = indoors ? 0.4 : 0.55;
      pos = new THREE.Vector3(L.x + ux * back + px * out, hl - 0.04, L.z + uz * back + pz * out);
      look = new THREE.Vector3(S.x + (L.x - S.x) * 0.16, hs - 0.04, S.z + (L.z - S.z) * 0.16);
      fov = indoors ? 42 : 34; push = 0.035;
    }
    // keep the lens out of walls and the ground
    if (segmentBlocked(pos.x, pos.z, look.x, look.z)) { pos.lerp(look, 0.45); }
    pos.y = Math.max(pos.y, getHeight(pos.x, pos.z) + 0.5);
    if (indoors && pos.y > indoors.ceil - 0.15) pos.y = indoors.ceil - 0.15;
    const start = pos.clone(), dir = look.clone().sub(pos).normalize(), drift = new THREE.Vector3(px, 0, pz).multiplyScalar(0.012);
    const cine = { hard: true, pos: pos.clone(), look, fov, t: 0 };
    cine.update = (dt) => { cine.t += dt; const k = Math.min(cine.t, 8); cine.pos.copy(start).addScaledVector(dir, push * k).addScaledVector(drift, k); };
    return cine;
  }
}
