// The dialogue camera, shot the way the big westerns shoot conversations:
// - one side of the line between the two speakers is chosen and kept (the 180° rule);
// - a scene opens on a low establishing shot with the place around them, then works in: medium two-shots,
//   over-the-shoulder singles framed on the thirds with the listener's shoulder soft in the foreground, and
//   long-lens close-ups for the lines that matter (a shout, a short hard line); now and then a cutaway
//   to the listener's face;
// - every shot moves: a slow push-in or a lateral dolly for parallax, under a faint handheld breathing;
// - the same framing is never used twice running.
import * as THREE from 'three';
import { getHeight } from './heightfield.js';
import { segmentBlocked, interiorAt } from './physics.js';

const UP = 1.52;           // eye height on a standing figure

export class Director {
  constructor(player) { this.p = player; this.reset(); }
  reset() { this.side = 0; this.n = 0; this.last = null; this.lastType = ''; this.runOnSame = 0; }

  // a, b: world positions (feet) of the two characters; speaker: 'a' | 'b'; text: the line (to pick the framing)
  shot(a, b, speaker, text = '') {
    const ax = b.x - a.x, az = b.z - a.z, sep = Math.hypot(ax, az) || 1;
    const nx = ax / sep, nz = az / sep;
    const ha = a.y + UP * (a.scale || 1), hb = b.y + UP * (b.scale || 1);
    const mid = new THREE.Vector3((a.x + b.x) / 2, (ha + hb) / 2, (a.z + b.z) / 2);
    const indoors = interiorAt(mid.x, mid.z, mid.y - 1.2);
    if (!this.side) {
      this.side = 1;
      const test = (s) => { const px = -nz * s, pz = nx * s, d = Math.min(4.5, sep * 1.2 + 1.8); const cx = mid.x + px * d, cz = mid.z + pz * d; return !segmentBlocked(cx, cz, mid.x, mid.z) && getHeight(cx, cz) > -0.6; };
      if (!test(1) && test(-1)) this.side = -1;
    }
    const px = -nz * this.side, pz = nx * this.side;
    const changed = speaker !== this.last;
    this.runOnSame = changed ? 0 : this.runOnSame + 1;
    const S = speaker === 'a' ? a : b, L = speaker === 'a' ? b : a, hs = speaker === 'a' ? ha : hb, hl = speaker === 'a' ? hb : ha;
    const ux = (L.x - S.x) / sep, uz = (L.z - S.z) / sep;          // from speaker toward listener
    // ---- which shot
    const loud = /!|\?!|ayyo|kallan/i.test(text), short = text.length > 0 && text.length < 34, long = text.length > 110;
    let type;
    if (this.n === 0) type = indoors ? 'two' : 'establish';
    else if (loud || (short && Math.random() < 0.5)) type = 'close';
    else if (this.runOnSame >= 2) type = 'cutaway';
    else if (long) type = Math.random() < 0.5 ? 'two' : 'ots';
    else type = Math.random() < 0.72 ? 'ots' : 'two';
    if (type === this.lastType && type !== 'ots') type = 'ots';
    if (type === 'ots' && this.lastType === 'ots' && !changed) type = 'close';
    this.n++; this.last = speaker; this.lastType = type;
    const scale = indoors ? 0.62 : 1;
    let pos, look, fov, move;
    if (type === 'establish') {
      // low and wide, a little off the line, the place around them in frame
      const d = Math.min(9.5, Math.max(5.5, sep * 2 + 4));
      pos = new THREE.Vector3(mid.x + px * d - nx * d * 0.35, mid.y - 0.85, mid.z + pz * d - nz * d * 0.35);
      look = new THREE.Vector3(mid.x, mid.y - 0.25, mid.z);
      fov = 40; move = { push: 0.09, slide: 0.06 };
    } else if (type === 'two') {
      // waist-up two-shot, square to the line
      const d = (Math.min(5, Math.max(2.4, sep * 1.25 + 1.4))) * scale;
      pos = new THREE.Vector3(mid.x + px * d, mid.y - 0.18, mid.z + pz * d);
      look = new THREE.Vector3(mid.x, mid.y - 0.12, mid.z);
      fov = indoors ? 44 : 32; move = { push: 0.04, slide: 0.03 };
    } else if (type === 'close') {
      // long-lens close-up of the speaker, from just off the listener's eyeline; the speaker on a third
      const d = 1.9 * scale + 0.6;
      pos = new THREE.Vector3(S.x + ux * d + px * 0.55 * scale, hs - 0.06, S.z + uz * d + pz * 0.55 * scale);
      look = new THREE.Vector3(S.x - px * 0.14, hs - 0.04, S.z - pz * 0.14);
      fov = indoors ? 30 : 22; move = { push: 0.025, slide: 0.008 };
    } else if (type === 'cutaway') {
      // the listener's face as they take it in
      const d = 1.8 * scale + 0.6;
      pos = new THREE.Vector3(L.x - ux * d + px * 0.5 * scale, hl - 0.05, L.z - uz * d + pz * 0.5 * scale);
      look = new THREE.Vector3(L.x - px * 0.12, hl - 0.04, L.z - pz * 0.12);
      fov = indoors ? 32 : 24; move = { push: 0.02, slide: 0.01 };
    } else {
      // over the listener's shoulder: their shoulder and the back of their head in the near third
      const back = 0.9 * scale + 0.15, out = 0.5 * scale + 0.08;
      pos = new THREE.Vector3(L.x + ux * back + px * out, hl - 0.02, L.z + uz * back + pz * out);
      look = new THREE.Vector3(S.x + (L.x - S.x) * 0.12 - px * 0.12, hs - 0.05, S.z + (L.z - S.z) * 0.12 - pz * 0.12);
      fov = indoors ? 40 : 30; move = { push: 0.03, slide: 0.015 };
    }
    // keep the lens out of walls, the ground and the ceiling
    if (segmentBlocked(pos.x, pos.z, look.x, look.z)) pos.lerp(look, 0.45);
    pos.y = Math.max(pos.y, getHeight(pos.x, pos.z) + 0.45);
    if (indoors && pos.y > indoors.ceil - 0.15) pos.y = indoors.ceil - 0.15;
    // ---- the move: push in along the lens, slide across it, breathe
    const start = pos.clone(), dir = look.clone().sub(pos).normalize(), across = new THREE.Vector3(px, 0, pz).multiplyScalar(Math.random() < 0.5 ? 1 : -1);
    const look0 = look.clone(), seed = Math.random() * 10;
    const cine = { hard: true, pos: pos.clone(), look: look.clone(), fov, t: 0 };
    cine.update = (dt) => {
      cine.t += dt; const k = Math.min(cine.t, 9), e = 1 - Math.exp(-k / 6);
      cine.pos.copy(start).addScaledVector(dir, move.push * 6 * e).addScaledVector(across, move.slide * 6 * e);
      const br = 0.006, t = cine.t + seed;
      cine.pos.y += Math.sin(t * 0.9) * br; cine.pos.x += Math.sin(t * 0.63) * br; cine.pos.z += Math.cos(t * 0.71) * br;
      cine.look.copy(look0); cine.look.y += Math.sin(t * 0.5) * br * 0.6;
    };
    return cine;
  }
}
