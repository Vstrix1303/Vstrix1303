// How people move. Poses are layered: a base pose for what the character is
// doing; a gait whose feet are planted on the ground and solved with inverse
// kinematics (so nothing slides, slopes and steps are respected, and stopping
// or turning produces real corrective steps); the pelvis mechanics of walking
// and running; then weight and life on top — lean into acceleration, bank
// into turns, breathing that quickens with effort, shifting weight, glances,
// blinks, fidgets, recoil from blows, and cloth that lags behind the body.
import * as THREE from 'three';
import { RIG } from './body.js';
import { groundAt } from './physics.js';
import { damp, clamp, lerp, smoothstep, angleDiff } from './util.js';

const TAU = Math.PI * 2;
const frac = (x) => x - Math.floor(x);
const ease = (s) => s * s * (3 - 2 * s);
const L1 = RIG.thigh, L2 = RIG.shin, LMAX = (L1 + L2) * 0.996;
const _d = new THREE.Vector3(), _t = new THREE.Vector3(), _n = new THREE.Vector3(), _m = new THREE.Vector3(), _x = new THREE.Vector3(), _p = new THREE.Vector3(), _hj = new THREE.Vector3();
const _mat = new THREE.Matrix4(), _q = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _qi = new THREE.Quaternion(), _e = new THREE.Euler();

const BASE = () => ({
  legL: 0, legR: 0, kneeL: 0.03, kneeR: 0.03, legLz: 0, legRz: 0,
  armL: 0, armR: 0, elL: -0.14, elR: -0.14, armLz: -0.07, armRz: 0.07, clavL: 0, clavR: 0, wristL: 0, wristR: 0, fingL: 0.35, fingR: 0.35,
  spine: 0, twist: 0, sway: 0, head: 0, headY: 0, headZ: 0,
  hipY: RIG.hipY, hipX: 0, hipZ: 0, pelvX: 0, pelvY: 0, pelvZ: 0, bodyX: 0, bodyY: 0,
});

export function initMotion(h) {
  h.j = BASE();
  h.state = 'idle';
  h.phase = Math.random() * 6; h.t = Math.random() * 10; h.speed = 0;
  h.strikeT = -1; h.strikeDur = 0.42; h.strikeN = 0; h.blocking = false; h.carry = false;
  h.w = { x: 0, y: 0, z: 0, yaw: 0, ok: false, had: false, px: 0, pz: 0, pyaw: 0, vx: 0, vz: 0 };
  h.gait = 0; h.moving = false; h.ik = 0; h.air = false; h.lod = 0; h.near = false;
  h.feet = [0, 1].map(() => ({ x: 0, z: 0, gy: 0, sw: -1, fx: 0, fz: 0, fy: 0, dur: 0.25, yaw: 0, fyaw: 0, idle: false, ax: 0, ay: RIG.ankle, az: 0, pitch: 0, stance: 0 }));
  h.stepCd = 0;
  h.vf = 0; h.vs = 0; h.af = 0; h.omega = 0; h.lean = 0; h.bank = 0;
  h.exert = 0; h.breath = Math.random() * 6;
  h.shiftSeed = Math.random() * 100;
  h.gaze = null; h.lookYaw = 0; h.lookPitch = 0; h.glance = 0; h.glanceT = 2 + Math.random() * 4;
  h.blinkT = 1 + Math.random() * 4; h.blink = false;
  h.fidget = null; h.fidgetT = 5 + Math.random() * 12;
  h.gest = null; h.gestT = 0;
  h.imp = { x: 0, z: 0, vx: 0, vz: 0 };
  h.hemP = { x: 0, z: 0, vx: 0, vz: 0 };
  h.koT = 0; h.koVar = Math.random();
  h.land = 0; h.dangles = [];
}

// a blow: the body recoils away from where it came from (local direction)
export function flinch(h, lx, lz, k = 1) {
  h.imp.vx += -lz * 5.5 * k; h.imp.vz += lx * 5.5 * k;
}

function resetFeet(h) {
  const w = h.w, S = h.S, c = Math.cos(w.yaw), s = Math.sin(w.yaw);
  for (let i = 0; i < 2; i++) {
    const f = h.feet[i], lx = (i ? 1 : -1) * 0.085;
    f.x = w.x + lx * c * S; f.z = w.z - lx * s * S; f.gy = w.y; f.sw = -1; f.yaw = w.yaw; f.idle = false;
    f.ax = lx; f.ay = RIG.ankle; f.az = 0; f.pitch = 0;
  }
}

const GESTURES = [
  { armR: -0.75, elR: -1.15, armRz: 0.2, wristR: -0.3, fingR: 0.1 },                                   // open palm, offered
  { armR: -0.5, elR: -1.5, armRz: -0.15, armL: -0.5, elL: -1.5, armLz: 0.15, fingL: 0.1, fingR: 0.1 },   // both hands, weighing it
  { armR: -1.1, elR: -0.7, armRz: 0.1, fingR: 1.0 },                                                   // pointing ahead
  { armR: -0.35, elR: -2.0, armRz: -0.35, fingR: 0.2 },                                                // hand to the chest
  { armL: -0.6, elL: -1.2, armLz: -0.25, fingL: 0.1, armR: -0.1, elR: -0.3 },                            // the other hand
  { armR: -0.2, elR: -0.5, armL: -0.2, elL: -0.5, clavL: 0.1, clavR: 0.1, armLz: -0.3, armRz: 0.3 },     // a shrug
];
const FIDGETS = [
  { d: 2.6, p: { armR: -2.3, elR: -2.1, armRz: 0.25, head: 0.18, headY: -0.2, fingR: 0.7 } },            // scratch the back of the head
  { d: 3.0, p: { armL: -0.35, elL: -1.5, armLz: 0.5, armR: -0.35, elR: -1.5, armRz: -0.5, head: 0.3, fingL: 0.9, fingR: 0.9 } },   // re-tuck the mundu
  { d: 2.2, p: { armL: -1.9, elL: -2.2, armLz: 0.45, head: 0.12, fingL: 0.2 } },                         // wipe the brow
  { d: 4.5, p: { armL: 0.25, elL: -1.5, armLz: -0.75, armR: 0.25, elR: -1.5, armRz: 0.75, spine: -0.05 } },   // hands on hips
  { d: 3.2, p: { clavL: 0.16, clavR: 0.16, armL: 0.4, armR: 0.4, spine: -0.1, head: -0.25 } },           // roll the shoulders, stretch
];

export function updateMotion(h, dt) {
  dt = Math.min(dt, 0.1);
  h.t += dt;
  const s = h.state, t = h.t, S = h.S, w = h.w;
  const sp = h.speed / S;                 // speed in the figure's own scale
  const g = BASE();
  let k = 12;

  // ---- how the body is travelling through the world
  let jumped = false;
  if (w.ok) {
    if (!w.had || Math.hypot(w.x - w.px, w.z - w.pz) > 2.5 * Math.max(1, sp * dt * 3)) { jumped = true; w.vx = 0; w.vz = 0; }
    else { w.vx = (w.x - w.px) / dt; w.vz = (w.z - w.pz) / dt; }
    const c = Math.cos(w.yaw), sn = Math.sin(w.yaw);
    const vf = (w.vx * sn + w.vz * c) / S, vs = (w.vx * c - w.vz * sn) / S;
    const af = jumped ? 0 : (vf - h.vf) / dt;
    h.af = damp(h.af, clamp(af, -10, 10), 4, dt);
    h.vf = vf; h.vs = vs;
    h.omega = damp(h.omega, jumped ? 0 : clamp(angleDiff(w.pyaw, w.yaw) / dt, -6, 6), 8, dt);
    w.px = w.x; w.pz = w.z; w.pyaw = w.yaw;
  } else { h.af = damp(h.af, 0, 6, dt); h.omega = damp(h.omega, 0, 8, dt); }
  const upright = s === 'idle' || s === 'talk' || s === 'cheer' || s === 'move' || s === 'crouch' || s === 'work' || s === 'fish' || s === 'pray';
  const wantIK = upright && w.ok && h.lod === 0 && !h.air && Math.abs(h.j.bodyX) < 0.08;
  if (wantIK && (jumped || h.ik < 0.01)) resetFeet(h);
  h.ik = damp(h.ik, wantIK ? 1 : 0, wantIK ? 14 : 30, dt);
  if (!wantIK) h.ik = h.ik < 0.02 ? 0 : h.ik;
  h.exert = clamp(h.exert + (sp > 5.5 && s === 'move' ? 0.22 : -0.07) * dt, 0, 1);

  // ---- base pose for the activity
  const moving = (s === 'move' || s === 'crouch') && sp > 0.2;
  const runT = smoothstep(2.4, 5.2, sp), walkA = clamp(sp / 1.2, 0, 1);
  if (s === 'idle' || s === 'talk' || s === 'cheer') {
    g.spine = 0.02;
    if (s === 'talk') {
      h.gestT -= dt;
      if (h.gestT <= 0) { h.gestT = 0.9 + Math.random() * 1.5; h.gest = Math.random() < 0.2 ? null : GESTURES[(Math.random() * GESTURES.length) | 0]; }
      if (h.gest) Object.assign(g, h.gest);
      const beat = Math.sin(t * 6.3) * 0.06;
      g.armR += beat; g.elR += beat * 1.5; g.head = Math.sin(t * 2.1) * 0.05 + (h.talking ? Math.sin(t * 5.2) * 0.03 : 0); g.headZ = Math.sin(t * 0.9) * 0.05;
      k = 7;
    }
    if (s === 'cheer') { const wv = Math.sin(t * 9); g.armL = -2.7 + wv * 0.25; g.armR = -2.7 - wv * 0.25; g.elL = g.elR = -0.3; g.armLz = -0.35; g.armRz = 0.35; g.hipY = RIG.hipY - 0.03 + Math.abs(Math.sin(t * 4.5)) * 0.05; g.head = -0.2; g.fingL = g.fingR = 1.2; g.clavL = g.clavR = 0.2; }
  } else if (s === 'move' || s === 'crouch') {
    const crouch = s === 'crouch';
    // arms swing against the legs; elbows fold up as the pace rises
    const ph = TAU * h.gait, A = lerp(0.34, 0.85, runT) * walkA * (h.carry ? 0.5 : 1);
    g.armL = A * Math.cos(ph) + 0.05 * runT; g.armR = -A * Math.cos(ph) + 0.05 * runT;
    const eb = lerp(0.22, 1.45, runT);
    g.elL = -eb - Math.max(0, -Math.cos(ph - 0.5)) * lerp(0.3, 0.35, runT) * walkA; g.elR = -eb - Math.max(0, Math.cos(ph - 0.5)) * lerp(0.3, 0.35, runT) * walkA;
    g.armLz = -0.07 - 0.07 * runT; g.armRz = 0.07 + 0.07 * runT;
    g.fingL = g.fingR = lerp(0.4, 1.25, runT);
    if (h.staff) { g.armR = -0.12 - A * 0.35 * Math.cos(ph); g.elR = -0.38 - 0.25 * runT; g.armRz = 0.14; }      // a staff is carried low at the side
    g.spine = 0.02 + sp * 0.017 + runT * 0.02;
    g.twist = -lerp(0.07, 0.14, runT) * walkA * Math.cos(ph) * 1.2;      // shoulders counter the pelvis
    g.hipY = RIG.hipY - 0.012 * walkA - 0.03 * runT;
    g.head = -g.spine * 0.5;
    if (crouch) { g.hipY -= 0.18; g.spine += 0.55; g.elL = g.elR = -0.95; g.armL *= 0.5; g.armR *= 0.5; g.head = -0.42; g.armLz = -0.2; g.armRz = 0.2; }
    if (h.ik < 0.5) {          // far away or off the ground: a plain swinging gait
      h.phase += dt * (4.0 + sp * 0.86);
      const p = h.phase, amp = clamp(0.3 + sp * 0.115, 0, 1.08) * (sp > 0.05 ? 1 : 0);
      g.legL = -Math.sin(p) * amp; g.legR = Math.sin(p) * amp;
      g.kneeL = Math.max(0, Math.cos(p)) * amp * 1.35 + 0.05; g.kneeR = Math.max(0, -Math.cos(p)) * amp * 1.35 + 0.05;
      g.armL = Math.sin(p) * amp * 0.8; g.armR = -Math.sin(p) * amp * 0.8;
      g.hipY += Math.abs(Math.sin(p)) * 0.035 * amp;
      if (crouch) { g.legL -= 0.75; g.legR -= 0.75; g.kneeL += 1.25; g.kneeR += 1.25; }
    }
    k = 16;
  } else if (s === 'sit' || s === 'ride') {
    g.legL = g.legR = -1.25; g.kneeL = g.kneeR = 1.25; g.legLz = -0.42; g.legRz = 0.42;
    h.phase += dt * (3 + sp * 0.9);
    const q = h.mountQ, qc = q ? (q.cyc || 0) * TAU : h.phase;
    const gal = q ? Math.max(q.wC || 0, q.wG || 0) : smoothstep(6, 10, sp), trot = (q ? (q.wT || 0) : clamp(sp / 4, 0, 1)) * (1 - gal);
    const post = q ? Math.cos(qc * 2) : Math.sin(h.phase * 2);
    g.armL = g.armR = -0.28 - gal * 0.3; g.elL = g.elR = -1.2 + post * 0.06 * trot; g.armLz = 0.2; g.armRz = -0.2; g.fingL = g.fingR = 1.3;
    g.spine = 0.06 + gal * 0.42 + post * 0.035 * Math.min(1, sp * 0.2) + clamp(h.af * 0.02, -0.12, 0.12);
    g.bodyY = post * 0.035 * trot + Math.sin(qc - 0.9) * 0.03 * gal;
    if (q) { g.spine += -Math.cos(qc) * 0.07 * gal; g.sway = clamp((q.turn || 0) * -0.05, -0.15, 0.15); g.elL = g.elR = -1.2 + Math.cos(qc) * 0.14 * gal + post * 0.06 * trot; }
    g.head = -gal * 0.3;
    if (s === 'ride') { g.kneeL = g.kneeR = 1.1 + gal * 0.3; g.legL = g.legR = -1.1 + gal * 0.15; }
    if (h.mountT != null) {          // swinging up into the saddle
      h.mountT += dt;
      const u = h.mountT / 0.62;
      if (u >= 1) { h.mountT = null; h.mountOff = null; }
      else { const e = ease(u), arc = Math.sin(Math.PI * u); h.mountOff = [lerp(-0.62, 0, e), lerp(-0.85, 0, e) + 0.2 * arc]; g.legRz += 1.15 * arc; g.legR += 0.5 * arc; g.kneeR -= 0.6 * arc; g.spine += 0.35 * (1 - e); g.armL = g.armR = -1.5; g.elL = g.elR = -0.5; k = 20; }
    }
  } else if (s === 'bench' || s === 'sidesaddle') {
    g.legL = g.legR = -1.42; g.kneeL = g.kneeR = 1.45; g.spine = 0.08 + Math.sin(t * 0.33 + h.shiftSeed) * 0.04;
    g.armL = -0.5; g.armR = -0.5; g.elL = g.elR = -0.85; g.armLz = 0.12; g.armRz = -0.12; g.fingL = g.fingR = 0.6;
    g.legLz = -0.06; g.legRz = 0.06; g.kneeL += Math.sin(t * 0.21 + h.shiftSeed) * 0.08;
    if (s === 'sidesaddle') { g.armR = -0.9; g.elR = -0.5; h.phase += dt * (3 + sp * 0.9); g.spine = 0.12 + Math.sin(h.phase * 2) * 0.03; }
  } else if (s === 'paddle' || s === 'boat') {
    g.legL = g.legR = -1.45; g.kneeL = g.kneeR = 1.5; g.hipY = 0.5;
    const pd = s === 'paddle' ? 1 : 0;
    h.phase += dt * (h.rowRate || 4.2) * pd;
    const p = h.phase, pull = Math.sin(p), reach = Math.cos(p);
    g.spine = 0.2 + pull * 0.2 * pd;                                   // reach forward, haul back
    g.armR = -1.0 + pull * 0.6 * pd; g.armL = -1.3 + pull * 0.45 * pd;
    g.elR = -0.45 - Math.max(0, -reach) * 0.55 * pd; g.elL = -0.75 + Math.max(0, reach) * 0.2 * pd; g.armLz = 0.38; g.armRz = 0.08;
    g.twist = pull * 0.3 * pd; g.sway = -reach * 0.05 * pd; g.head = -0.1 - pull * 0.1 * pd; g.fingL = g.fingR = 1.3;
    if (!pd) { g.armR = -0.7; g.armL = -0.9; g.elL = g.elR = -0.6; }
  } else if (s === 'swim') {
    const stroke = clamp(sp / 1.2, 0, 1);
    h.phase += dt * lerp(2.2, 4.6, stroke);
    const p = h.phase;
    if (stroke > 0.25) {                                              // a rolling crawl
      g.bodyX = 1.15; g.bodyY = -0.32;
      g.armL = -2.5 + Math.sin(p) * 1.5; g.armR = -2.5 - Math.sin(p) * 1.5; g.elL = -0.25 - Math.max(0, Math.cos(p)) * 0.9; g.elR = -0.25 - Math.max(0, -Math.cos(p)) * 0.9;
      g.sway = Math.sin(p) * 0.22; g.twist = Math.sin(p) * 0.25;
      g.legL = Math.sin(p * 2) * 0.3; g.legR = -Math.sin(p * 2) * 0.3; g.kneeL = 0.2 + Math.max(0, Math.sin(p * 2)) * 0.3; g.kneeR = 0.2 + Math.max(0, -Math.sin(p * 2)) * 0.3;
      g.head = -0.75; g.headY = Math.sin(p) * 0.3;
    } else {                                                          // treading water
      g.bodyX = 0.25; g.bodyY = -0.2 + Math.sin(p) * 0.03;
      g.armL = -0.9 + Math.sin(p) * 0.3; g.armR = -0.9 - Math.sin(p) * 0.3; g.armLz = -0.7 - Math.cos(p) * 0.3; g.armRz = 0.7 + Math.cos(p) * 0.3; g.elL = g.elR = -0.6;
      g.legL = -0.3 + Math.sin(p * 1.5) * 0.4; g.legR = -0.3 - Math.sin(p * 1.5) * 0.4; g.kneeL = 0.7 + Math.cos(p * 1.5) * 0.3; g.kneeR = 0.7 - Math.cos(p * 1.5) * 0.3; g.head = -0.2;
    }
    g.fingL = g.fingR = 0.05;
  } else if (s === 'ko') {
    k = 0;        // set directly below
  } else if (s === 'work') {
    // bend, gather, straighten the back — not a metronome
    const c = frac(t / 4.4 + h.shiftSeed), down = c < 0.72 ? ease(clamp(c / 0.12, 0, 1)) : 1 - ease(clamp((c - 0.72) / 0.14, 0, 1));
    const pick = Math.sin(t * 5.2) * down;
    g.spine = 0.12 + down * 0.82; g.hipY = RIG.hipY - down * 0.1; g.hipZ = -down * 0.1;
    g.armL = -0.25 - down * 0.75 + pick * 0.28; g.armR = -0.25 - down * 0.75 - pick * 0.28; g.elL = g.elR = -0.35 - down * 0.2 + Math.abs(pick) * 0.2;
    g.head = -down * 0.35; g.fingL = g.fingR = 0.6 + pick * 0.5;
    if (c > 0.88) { g.armR = -0.2; g.elR = -1.8; g.armRz = -0.5; g.spine = -0.08; g.head = -0.12; }      // a hand to the small of the back
    k = 6;
  } else if (s === 'fish') {
    g.armR = -1.0 + Math.sin(t * 0.8) * 0.04; g.elR = -0.7; g.armL = -0.7; g.elL = -1.0; g.spine = 0.05; g.fingL = g.fingR = 1.3; g.armLz = 0.2;
  } else if (s === 'cower') {
    g.hipY = 0.6; g.legL = g.legR = -1.2; g.kneeL = g.kneeR = 2.0; g.spine = 0.7; g.armL = g.armR = -2.3; g.elL = g.elR = -1.9; g.head = 0.3;
    g.sway = Math.sin(t * 17) * 0.012;
  } else if (s === 'pray') {
    g.armL = g.armR = -0.95; g.elL = g.elR = -1.75; g.armLz = 0.42; g.armRz = -0.42; g.head = 0.24; g.spine = 0.1; g.fingL = g.fingR = 0.02;
  }

  // ---- things in the hands
  if (h.umbrella && (s === 'idle' || s === 'move' || s === 'talk')) { g.armR = -0.75; g.elR = -1.9; g.armRz = 0.1; g.fingR = 1.3; }
  if (h.headLoad && (s === 'idle' || s === 'move')) { g.armL = -3.02; g.elL = -0.22; g.armLz = 0.16; g.sway *= 0.4; g.headY = 0; g.fingL = 0.2; g.twist *= 0.3; }
  if (h.carry && (s === 'idle' || s === 'move')) { g.armL = -0.08; g.elL = -0.22; g.armLz = -0.24; g.fingL = 1.3; g.clavL = -0.08; g.sway += 0.03; }
  if (h.grip) g.fingR = 1.3;
  if (h.gripL) g.fingL = 1.3;

  // ---- fighting
  if (h.blocking && h.strikeT < 0) {
    g.armR = -1.35; g.elR = -1.5; g.armRz = -0.3; g.armL = -1.2; g.elL = -1.4; g.armLz = 0.3; g.spine += 0.14; g.hipY -= 0.07; g.fingL = g.fingR = 1.3; g.twist = -0.25; g.head = -0.1;
    k = 26;
  }
  if (h.strikeT >= 0) {
    h.strikeT += dt;
    const u = h.strikeT / h.strikeDur, wind = h.strikeDur > 0.6 ? 0.6 : 0.35;
    if (u >= 1) { h.strikeT = -1; h.strikeN++; }
    else {
      const side = h.strikeN % 2 === 1;               // alternate an overhead cut with a swing from the shoulder
      const a = u < wind ? ease(u / wind) : 1, b = u < wind ? 0 : ease(Math.min(1, (u - wind) / (0.3 * (1 - wind) + 0.08))), rec = u < wind ? 0 : clamp((u - wind - 0.45 * (1 - wind)) / (0.55 * (1 - wind)), 0, 1);
      const hit = b * (1 - rec * 0.6);
      g.armR = lerp(lerp(-0.6, side ? -1.7 : -3.0, a), side ? -1.15 : -0.2, b);
      g.armRz = side ? lerp(lerp(0.25, 1.15, a), -0.75, b) : 0.25 - b * 0.2;
      g.elR = lerp(-0.9 * a - 0.35, -0.2, b); g.fingR = 1.3; g.wristR = lerp(-0.4 * a, 0.35, b);
      g.armL = lerp(-0.5 * a, 0.5, b) ; g.elL = -0.9; g.armLz = -0.3 - 0.2 * a;
      g.spine += lerp(-0.14 * a, 0.34, b) * (1 - rec * 0.5);
      g.twist = lerp(-0.5 * a, 0.55, b) * (1 - rec * 0.6);
      g.hipZ = lerp(-0.05 * a, 0.13, b) * (1 - rec); g.hipY -= 0.03 * a + 0.07 * hit; g.pelvY = lerp(-0.2 * a, 0.25, b) * (1 - rec);
      g.head = lerp(-0.1 * a, 0.08, b);
      k = 30;
    }
  }

  // ---- knocked down: buckle, fall, settle
  if (s === 'ko') {
    h.koT += dt;
    const kt = h.koT, v = h.koVar;
    const buckle = ease(clamp(kt / 0.28, 0, 1)), fall = clamp((kt - 0.18) / 0.5, 0, 1), fl = fall * fall, down = kt > 0.68;
    const bounce = down ? Math.exp(-(kt - 0.68) * 7) * Math.sin((kt - 0.68) * 22) * 0.09 : 0;
    Object.assign(g, {
      bodyX: -1.52 * fl + bounce, bodyY: 0.14 * fl - 0.06 * buckle * (1 - fl), hipY: RIG.hipY - 0.2 * buckle * (1 - fl),
      spine: -0.3 * buckle * (1 - fl) + (down ? 0.04 : 0), head: -0.45 * buckle * (1 - fl) + (down ? 0.1 : 0), headY: down ? lerp(-0.6, 0.6, v) : 0,
      armL: lerp(-1.4, 0.1, fl) * buckle, armR: lerp(-1.2, -0.3 * v, fl) * buckle, armLz: -0.5 - 0.7 * fl, armRz: 0.4 + 0.9 * fl * (0.6 + v * 0.4), elL: -0.9 + 0.6 * fl, elR: -0.8 + 0.5 * fl,
      legL: -0.5 * buckle * (1 - fl) - 0.05, legR: -0.7 * buckle * (1 - fl) + (down ? -0.25 * v : 0), kneeL: 0.9 * buckle * (1 - fl) + 0.08, kneeR: 1.1 * buckle * (1 - fl) + (down ? 0.25 + 0.5 * v : 0.1),
      legLz: -0.14 - 0.1 * v, legRz: 0.2 + 0.12 * (1 - v), fingL: 0.5, fingR: 0.5,
    });
    k = 26;
  } else if (h.koT > 0) { h.koT = 0; h.koVar = Math.random(); k = 5; }
  if (h.air) {            // off the ground: gather the legs, arms out for balance
    g.legL = -0.55; g.legR = 0.15; g.kneeL = 0.95; g.kneeR = 0.6; g.armL = -0.5; g.armR = -0.3; g.armLz = -0.55; g.armRz = 0.55; g.elL = g.elR = -0.6; g.spine = 0.12; g.fingL = g.fingR = 0.3;
    h.land = 1; k = 14;
  } else if (h.land > 0) { h.land = Math.max(0, h.land - dt * 3.2); g.hipY -= 0.14 * Math.sin(Math.PI * Math.min(1, h.land)) * (h.land > 0.5 ? 1 : 2 * h.land); g.spine += 0.18 * h.land; }

  // ---- idle life: weight on one leg then the other, small restless things
  const calm = (s === 'idle' || s === 'talk' || s === 'pray' || s === 'fish') && !moving;
  if (calm && h.lod === 0) {
    const n = Math.sin(t * 0.21 + h.shiftSeed) + 0.5 * Math.sin(t * 0.53 + h.shiftSeed * 1.7), wsh = clamp(n * 1.3, -1, 1);
    g.hipX += 0.032 * wsh; g.pelvZ += 0.035 * wsh; g.hipY -= 0.012 * Math.abs(wsh); g.sway += -0.03 * wsh; g.headZ += 0.03 * wsh; g.pelvY += 0.04 * wsh;
    if (s === 'idle' && !h.carry && !h.umbrella && !h.headLoad && !h.blocking && h.strikeT < 0 && !h.noFidget) {
      h.fidgetT -= dt;
      if (h.fidget) {
        const f = h.fidget, u = f.t / f.d; f.t += dt;
        const e = ease(clamp(u / 0.22, 0, 1)) * ease(clamp((1 - u) / 0.22, 0, 1));
        for (const key in f.p) g[key] = lerp(g[key], f.p[key] + (key === 'armR' || key === 'armL' ? Math.sin(t * 9) * 0.05 * e : 0), e);
        if (u >= 1) h.fidget = null;
        k = 8;
      } else if (h.fidgetT <= 0) { h.fidgetT = 9 + Math.random() * 16; const f = FIDGETS[(Math.random() * FIDGETS.length) | 0]; h.fidget = { ...f, t: 0 }; }
    } else h.fidget = null;
  } else h.fidget = null;

  // ---- damp toward the pose
  const j = h.j;
  if (k > 0) for (const key in g) j[key] = damp(j[key] ?? g[key], g[key], k, dt);

  // ---- weight: lean into acceleration, bank into turns
  const onFeet = upright && !h.air;
  h.lean = damp(h.lean, onFeet ? clamp(h.af * 0.012, -0.1, 0.12) : 0, 5, dt);
  h.bank = damp(h.bank, onFeet ? clamp(-h.omega * sp * 0.022 - h.vs * 0.03, -0.22, 0.22) : 0, 6, dt);
  // recoil spring
  const im = h.imp;
  im.vx += (-im.x * 90 - im.vx * 10) * dt; im.vz += (-im.z * 90 - im.vz * 10) * dt; im.x += im.vx * dt; im.z += im.vz * dt;
  // breathing
  h.breath += dt * TAU * (0.24 + h.exert * 0.55);
  const br = Math.sin(h.breath) * (0.012 + 0.03 * h.exert);
  // where the eyes go
  let ly = 0, lp = 0;
  if (h.gaze && w.ok && h.lod === 0 && (upright || s === 'bench' || s === 'sit')) {
    const dx = h.gaze.x - w.x, dz = h.gaze.z - w.z, dy = (h.gaze.y - (w.y + 1.6 * S));
    const c = Math.cos(w.yaw), sn = Math.sin(w.yaw), lx = dx * c - dz * sn, lz = dx * sn + dz * c;
    const yaw = Math.atan2(lx, lz), dist = Math.hypot(lx, lz);
    if (Math.abs(yaw) < 1.9 && dist > 0.3) { ly = clamp(yaw, -1.15, 1.15); lp = clamp(-Math.atan2(dy, dist), -0.5, 0.6); }
  } else if (h.lod === 0 && (calm || s === 'bench')) {
    h.glanceT -= dt;
    if (h.glanceT <= 0) { h.glanceT = 1.5 + Math.random() * 5; h.glance = Math.random() < 0.35 ? 0 : (Math.random() - 0.5) * 1.3; h.glanceP = (Math.random() - 0.4) * 0.25; }
    ly = h.glance; lp = h.glanceP || 0;
  } else if (moving) ly = clamp(h.omega * 0.22, -0.5, 0.5);
  h.lookYaw = damp(h.lookYaw, ly, 5, dt); h.lookPitch = damp(h.lookPitch, lp, 5, dt);
  // blink
  if (h.near) {
    h.blinkT -= dt;
    const b = h.blinkT < 0.11;
    if (h.blinkT < 0) h.blinkT = 1.8 + Math.random() * 4.5 + (Math.random() < 0.15 ? -1.5 : 0);
    const bl = b && h.expr === 'neutral' && !h.mouthOpen;
    if (bl !== h.blink) { h.blink = bl; h.refreshFace(); }
  } else if (h.blink) { h.blink = false; h.refreshFace(); }

  // ---- gait: planted feet
  let pvX = j.pelvX, pvY = j.pelvY, pvZ = j.pelvZ, hx = j.hipX, hy = j.hipY, hz = j.hipZ;
  const feet = h.feet;
  if (h.ik > 0) {
    const crouch = s === 'crouch';
    const cy = Math.cos(w.yaw), sy = Math.sin(w.yaw);
    const duty = sp < 3.6 ? lerp(0.62, 0.37, smoothstep(1.8, 3.6, sp)) : lerp(0.37, 0.27, smoothstep(3.6, 7.5, sp));
    const stride = crouch ? clamp(0.7 + 0.4 * sp, 0.7, 1.6) : clamp(0.75 + 0.5 * sp, 0.8, 3.9);
    const base = (crouch ? 0.13 : lerp(0.085, 0.045, runT));
    const wasMoving = h.moving;
    h.moving = moving;
    if (moving) {
      if (!wasMoving) h.gait = duty + 0.001;                   // step off with the left foot
      h.gait = frac(h.gait + sp / stride * dt);
      const vl = Math.hypot(w.vx, w.vz) || 1, dxw = vl > 0.05 ? w.vx / vl : sy, dzw = vl > 0.05 ? w.vz / vl : cy;
      for (let i = 0; i < 2; i++) {
        const f = feet[i], ph = frac(h.gait + i * 0.5), side = i ? 1 : -1;
        f.idle = false;
        if (ph < duty) {
          if (f.sw >= 0) { f.sw = -1; h.onStep?.(i); }
          f.stance = ph / duty;
        } else {
          if (f.sw < 0) { f.fx = f.x; f.fz = f.z; f.fy = f.gy; f.fyaw = f.yaw; }
          const sw = (ph - duty) / (1 - duty), tRem = (1 - sw) * (1 - duty) * stride / Math.max(sp, 0.3);
          const reach = lerp(0.5, 0.46, runT) * duty * stride * S;
          const tx = w.x + w.vx * tRem + dxw * reach + side * base * cy * S, tz = w.z + w.vz * tRem + dzw * reach - side * base * sy * S;
          const e = ease(Math.pow(sw, lerp(1, 1.35, runT)));
          f.x = lerp(f.fx, tx, e); f.z = lerp(f.fz, tz, e); f.yaw = f.fyaw + angleDiff(f.fyaw, w.yaw) * e; f.sw = sw;
        }
      }
    } else {
      // standing: a foot that has been left behind steps back under the body
      h.stepCd -= dt;
      let worst = -1, we = 0;
      for (let i = 0; i < 2; i++) {
        const f = feet[i], side = i ? 1 : -1, lx = side * (crouch ? 0.14 : 0.09) + j.hipX * 0.5, lz = side * -0.015;
        const hxw = w.x + (lx * cy + lz * sy) * S, hzw = w.z + (-lx * sy + lz * cy) * S;
        f.hx = hxw; f.hz = hzw;
        if (f.sw >= 0) {
          if (!f.idle) { f.idle = true; f.fx = f.x; f.fz = f.z; f.fy = f.gy; f.fyaw = f.yaw; f.sw = 0; f.dur = 0.2; }
          f.sw += dt / f.dur;
          const e = ease(Math.min(1, f.sw));
          f.x = lerp(f.fx, hxw, e); f.z = lerp(f.fz, hzw, e); f.yaw = f.fyaw + angleDiff(f.fyaw, w.yaw) * e;
          if (f.sw >= 1) { f.sw = -1; f.idle = false; h.stepCd = 0.07; h.onStep?.(i); }
        } else {
          const err = Math.hypot(f.x - hxw, f.z - hzw) / S + Math.abs(angleDiff(f.yaw, w.yaw)) * 0.22;
          if (err > we) { we = err; worst = i; }
        }
        f.stance = 0.4;
      }
      if (worst >= 0 && we > 0.13 && h.stepCd <= 0 && feet[1 - worst].sw < 0) { const f = feet[worst]; f.idle = true; f.fx = f.x; f.fz = f.z; f.fy = f.gy; f.fyaw = f.yaw; f.sw = 0; f.dur = clamp(0.2 + we * 0.25, 0.2, 0.36); }
    }
    // ankle targets in the figure's own space
    const amp = moving ? walkA : 0;
    let low = 1e9;
    for (let i = 0; i < 2; i++) {
      const f = feet[i];
      f.gy = groundAt(f.x, f.z, w.y + 0.55 * S);
      const dx = (f.x - w.x) / S, dz = (f.z - w.z) / S;
      let ax = dx * cy - dz * sy, az = dx * sy + dz * cy;
      let gy = clamp((f.gy - w.y) / S, -0.5, 0.5), pitch = 0, lift = 0;
      if (f.sw >= 0) {
        const sw = Math.min(1, f.sw);
        gy = lerp(clamp((f.fy - w.y) / S, -0.5, 0.5), gy, sw);
        const H = f.idle ? 0.055 : lerp(0.055, 0.3, runT) + (crouch ? 0.04 : 0);
        lift = H * Math.sin(Math.PI * Math.pow(sw, lerp(0.8, 0.62, runT)));
        pitch = f.idle ? -0.25 * Math.sin(Math.PI * sw) : sw < 0.4 ? lerp(-0.8 - 0.3 * runT, -0.35, sw / 0.4) : lerp(-0.35, 0.24, (sw - 0.4) / 0.6);
        pitch *= f.idle ? 1 : amp;
      } else if (moving) {
        const u = f.stance;
        if (u < 0.14) pitch = lerp(0.24 * (1 - runT), 0, u / 0.14) * amp;
        else if (u > 0.6) { const r = ease((u - 0.6) / 0.4); pitch = -(0.8 + 0.3 * runT) * r * amp; az += 0.1 * r * amp; }
      }
      const heel = pitch < 0 && f.sw < 0 ? 0.105 * Math.sin(-pitch) : 0;
      const ty = gy + RIG.ankle + lift + heel;
      const kk = f.sw >= 0 || jumped ? 40 : 60;
      f.ax = jumped ? ax : damp(f.ax, ax, kk, dt); f.ay = jumped ? ty : damp(f.ay, ty, kk, dt); f.az = jumped ? az : damp(f.az, az, kk, dt);
      f.pitch = damp(f.pitch, pitch, 30, dt);
      if (f.sw < 0) { const hd2 = (f.ax - (hx + (i ? 1 : -1) * RIG.hipX)) ** 2 + (f.az - hz) ** 2; low = Math.min(low, f.ay + RIG.hipDrop + Math.sqrt(Math.max(0.02, LMAX * LMAX - hd2))); }
    }
    // pelvis: rises over the standing leg, drops and turns with the stride
    if (moving) {
      const psi = TAU * (h.gait - duty / 2);
      hy += walkA * lerp(0.016, -0.032, runT) * Math.cos(2 * psi);
      hx += -0.022 * (1 - 0.6 * runT) * walkA * Math.cos(psi);
      pvY += lerp(0.07, 0.14, runT) * walkA * Math.cos(TAU * h.gait);
      pvZ += -0.04 * (1 - 0.4 * runT) * walkA * Math.cos(psi);
      pvX += 0.02 * runT;
    }
    const drop = Math.max(0, hy - low);
    h.reach = damp(h.reach || 0, Math.min(drop, 0.5), drop > (h.reach || 0) ? 30 : 8, dt);
    hy -= h.reach * h.ik;
  }
  h.walkAmp = walkA;

  // ---- pose the skeleton
  const lean = h.lean, bank = h.bank;
  h.hips.position.set(hx, hy, hz);
  h.hips.rotation.set(pvX, pvY - j.twist * 0.4, pvZ + j.sway);
  h.spine.rotation.set(j.spine * 0.55 + lean * 0.5 + im.x * 0.4, j.twist * 0.5 - pvY * 0.6 + h.lookYaw * 0.1, -j.sway - pvZ * 0.7 + bank * 0.5 + im.z * 0.4);
  h.chest.rotation.set(j.spine * 0.45 + lean * 0.5 - br + im.x * 0.4, j.twist * 0.6 - pvY * 0.5 + h.lookYaw * 0.15, -j.sway * 0.5 - pvZ * 0.3 + bank * 0.5 + im.z * 0.3);
  h.neck.rotation.set(j.head * 0.4 + h.lookPitch * 0.4 - lean * 0.3 + br * 0.5 + im.x * 0.3, (j.headY - j.twist * 0.5) * 0.4 + h.lookYaw * 0.3, j.headZ * 0.5 - bank * 0.3);
  h.head.rotation.set(j.head * 0.6 + h.lookPitch * 0.6 - lean * 0.3 + im.x * 0.5, (j.headY - j.twist * 0.5) * 0.6 + h.lookYaw * 0.45, j.headZ * 0.5 + j.sway * 0.5 - bank * 0.3 + im.z * 0.3);
  h.armL.cl.rotation.z = -j.clavL - br * 1.2; h.armR.cl.rotation.z = j.clavR + br * 1.2;
  h.armL.sh.rotation.set(j.armL, 0, j.armLz + j.clavL); h.armR.sh.rotation.set(j.armR, 0, j.armRz - j.clavR);
  h.armL.el.rotation.x = j.elL; h.armR.el.rotation.x = j.elR;
  h.armL.hand.rotation.x = j.wristL; h.armR.hand.rotation.x = j.wristR;
  h.armL.fing.rotation.z = j.fingL; h.armR.fing.rotation.z = -j.fingR;
  h.body.rotation.x = j.bodyX; h.body.position.set(h.mountOff ? h.mountOff[0] : 0, j.bodyY + (h.mountOff ? h.mountOff[1] : 0), 0);

  // legs: forward kinematics, then pulled onto the planted feet
  const legs = [h.legL, h.legR];
  for (let i = 0; i < 2; i++) {
    const leg = legs[i], side = i ? 1 : -1, f = feet[i];
    const fkHip = i ? j.legR : j.legL, fkKnee = i ? j.kneeR : j.kneeL, fkZ = i ? j.legRz : j.legLz;
    if (h.ik <= 0) {
      leg.hp.rotation.set(fkHip, 0, fkZ); leg.kn.rotation.x = fkKnee;
      leg.ft.rotation.set(clamp(-(fkHip + fkKnee) * 0.55, -0.7, 0.5), 0, 0); leg.toe.rotation.x = 0;
      continue;
    }
    _e.set(pvX, pvY - j.twist * 0.4, pvZ + j.sway); _qp.setFromEuler(_e); _qi.copy(_qp).invert();
    _hj.set(side * RIG.hipX, -RIG.hipDrop, 0).applyQuaternion(_qp); _hj.x += hx; _hj.y += hy; _hj.z += hz;
    _d.set(f.ax - _hj.x, f.ay - _hj.y, f.az - _hj.z).applyQuaternion(_qi);
    let len = _d.length();
    len = clamp(len, 0.22, LMAX); _d.normalize();
    const rel = clamp(angleDiff(w.yaw, f.yaw), -0.7, 0.7) * 0.8 + side * (s === 'crouch' ? 0.35 : 0.12);
    _p.set(Math.sin(rel), 0, Math.cos(rel)).applyQuaternion(_qi);
    _n.copy(_p).addScaledVector(_d, -_p.dot(_d));
    if (_n.lengthSq() < 1e-6) _n.set(0, 0, 1); _n.normalize();
    const cosK = clamp((L1 * L1 + L2 * L2 - len * len) / (2 * L1 * L2), -1, 1), beta = Math.PI - Math.acos(cosK);
    const alpha = Math.acos(clamp((L1 * L1 + len * len - L2 * L2) / (2 * L1 * len), -1, 1));
    _t.copy(_d).multiplyScalar(Math.cos(alpha)).addScaledVector(_n, Math.sin(alpha));
    _m.copy(_n).multiplyScalar(Math.cos(alpha)).addScaledVector(_d, -Math.sin(alpha));
    _x.crossVectors(_m, _t);
    _mat.makeBasis(_x, _t.clone().negate(), _m); _q.setFromRotationMatrix(_mat);
    if (h.ik < 0.999) { _e.set(fkHip, 0, fkZ); leg.hp.quaternion.setFromEuler(_e).slerp(_q, h.ik); leg.kn.rotation.x = lerp(fkKnee, beta, h.ik); }
    else { leg.hp.quaternion.copy(_q); leg.kn.rotation.x = beta; }
    // keep the sole on the ground: undo the pitch of the shin, then roll heel-to-toe
    _x.copy(_t).multiplyScalar(Math.cos(beta)).addScaledVector(_m, -Math.sin(beta)).applyQuaternion(_qp);
    const chi = Math.atan2(-_x.z * Math.cos(rel) - _x.x * Math.sin(rel), -_x.y);
    leg.ft.rotation.set(clamp(-chi - f.pitch, -1.0, 1.25) * h.ik, 0, 0);
    leg.toe.rotation.x = f.sw < 0 ? clamp(f.pitch, -0.9, 0) * 0.9 : 0;
  }

  // ---- cloth and hair lag behind the body
  const hp = h.hemP;
  const tx = clamp(-h.vs * 0.012 - h.omega * 0.012, -0.07, 0.07), tz = clamp(-h.vf * 0.014 - h.af * 0.004, -0.09, 0.05);
  hp.vx += ((tx - hp.x) * 60 - hp.vx * 7) * dt; hp.vz += ((tz - hp.z) * 60 - hp.vz * 7) * dt; hp.x += hp.vx * dt; hp.z += hp.vz * dt;
  h.hem.position.set(hp.x, RIG.hem, hp.z);
  for (const dg of h.dangles) {
    const txr = clamp(h.af * 0.03 + h.vf * 0.02 + j.spine * -0.6, -0.9, 0.9) * dg.k, tzr = clamp(h.omega * 0.08 + h.vs * 0.05, -0.6, 0.6) * dg.k;
    dg.vx += ((txr - dg.x) * 45 - dg.vx * 5) * dt; dg.vz += ((tzr - dg.z) * 45 - dg.vz * 5) * dt; dg.x += dg.vx * dt; dg.z += dg.vz * dt;
    dg.obj.rotation.x = dg.x; dg.obj.rotation.z = dg.z;
  }
  w.had = w.ok; w.ok = false;
}
