// The doors: every leaf hung in a doorway, drawn as one batch. A door swings in when someone walks up to it —
// you, or a villager going about the day — and falls shut a little after they have gone through.
import * as THREE from 'three';
import { G } from './state.js';
import { DOORS } from './houses.js';

export function setupDoors(scene, woodMap) {
  const n = DOORS.length; if (!n) return;
  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0.5, 0.5, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, map: woodMap || null });
  const im = new THREE.InstancedMesh(geo, mat, n);
  im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
  const open = new Float32Array(n), hold = new Float32Array(n), c = new THREE.Color();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), pos = new THREE.Vector3(), sc = new THREE.Vector3();
  const set = (i) => {
    const d = DOORS[i], k = open[i] * open[i] * (3 - 2 * open[i]);
    let da = d.phiO - d.phiC; da = Math.atan2(Math.sin(da), Math.cos(da));
    q.setFromAxisAngle(up, d.phiC + da * k * 0.95);
    m4.compose(pos.set(d.x, d.y, d.z), q, sc.set(d.w, d.h, 0.05)); im.setMatrixAt(i, m4);
  };
  DOORS.forEach((d, i) => { set(i); c.setRGB(d.col[0], d.col[1], d.col[2]); im.setColorAt(i, c); });
  im.instanceColor.needsUpdate = true;
  scene.add(im);
  const near = [];
  G.updaters.push((dt) => {
    const pp = G.player.worldPos();
    near.length = 0;
    if (G.player.mode === 'foot') near.push(pp);
    for (const nc of G.npcs) if (nc.active && !nc.attached && Math.abs(nc.pos.x - pp.x) < 30 && Math.abs(nc.pos.z - pp.z) < 30) near.push(nc.pos);
    let dirty = false;
    for (let i = 0; i < n; i++) {
      const d = DOORS[i];
      if (open[i] === 0 && (Math.abs(d.cx - pp.x) > 32 || Math.abs(d.cz - pp.z) > 32)) continue;
      let want = false;
      for (const a of near) if (Math.abs(a.y - d.y) < 1.6 && (a.x - d.cx) ** 2 + (a.z - d.cz) ** 2 < 2.4) { want = true; break; }
      if (want) hold[i] = 1.6; else hold[i] = Math.max(0, hold[i] - dt);
      const target = hold[i] > 0 ? 1 : 0;
      if (open[i] === target) continue;
      if (target && open[i] === 0 && near[0] === pp && (pp.x - d.cx) ** 2 + (pp.z - d.cz) ** 2 < 2.4) G.audio?.sfx('door');
      open[i] = target ? Math.min(1, open[i] + dt * 2.8) : Math.max(0, open[i] - dt * 1.4);
      if (!target && open[i] === 0) G.audio?.sfx('doorShut', Math.max(0, 1 - Math.hypot(pp.x - d.cx, pp.z - d.cz) / 12));
      set(i); dirty = true;
    }
    if (dirty) im.instanceMatrix.needsUpdate = true;
  });
}
