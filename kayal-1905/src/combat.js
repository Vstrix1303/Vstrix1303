// Gunfire: bullets traced from the camera through the reticle, tracers and dust where they land, rockets
// in flight and the explosions they make, and the street's reaction to all of it.
import * as THREE from 'three';
import { G } from './state.js';
import { groundAt, pointInBox, segmentBlocked } from './physics.js';

const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();

export class Combat {
  constructor(scene) {
    this.scene = scene; this.tracers = []; this.rockets = []; this.blasts = [];
    this.tracerMat = new THREE.LineBasicMaterial({ color: new THREE.Color(3, 2.4, 1.4), transparent: true, opacity: 0.9, depthWrite: false });
    this.flashMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 0.75, 0.28), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    this.light = new THREE.PointLight(0xffa850, 0, 30, 2); this.light.layers.enableAll(); scene.add(this.light);
    this.lightT = 0;
  }
  // where a ray from o along d first meets the ground or a wall, up to max metres
  march(o, d, max) {
    const step = 0.6;
    for (let t = 1; t < max; t += step) {
      const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
      if (y < groundAt(x, z, y + 0.5) - 0.02) return t;
      const b = pointInBox(x, z, 0.02); if (b && y < b.top) return t;
    }
    return max;
  }
  // the nearest NPC a ray passes within reach of (a capsule round each body); returns { n, t, head }
  pick(o, d, max, from) {
    let best = null;
    for (const n of G.npcs) {
      if (!n.active || n.ko || !n.root.visible || n.attached) continue;
      const S = n.h.S || 1, r = 0.34 * S, y0 = n.pos.y + 0.1, y1 = n.pos.y + 1.75 * S;
      // closest approach of the ray to the body's axis
      const cx = n.pos.x - o.x, cz = n.pos.z - o.z, hl = Math.hypot(d.x, d.z) || 1e-6;
      const t = (cx * d.x + cz * d.z) / (hl * hl); if (t < 0.4 || t > max) continue;
      const px = o.x + d.x * t - n.pos.x, pz = o.z + d.z * t - n.pos.z;
      if (px * px + pz * pz > r * r) continue;
      const y = o.y + d.y * t; if (y < y0 || y > y1) continue;
      if (!best || t < best.t) best = { n, t, head: y > n.pos.y + 1.5 * S };
    }
    if (best && from && segmentBlocked(from.x, from.z, best.n.pos.x, best.n.pos.z)) return null;
    return best;
  }
  tracer(a, b) {
    const g = new THREE.BufferGeometry().setFromPoints([a.clone(), b.clone()]);
    const l = new THREE.Line(g, this.tracerMat.clone()); l.layers.set(1); l.frustumCulled = false;
    this.scene.add(l); this.tracers.push({ l, t: 0.07 });
  }
  impact(p, big = 1) { G.fx?.dust(p, Math.ceil(2 * big), 0.5 * big); }
  // one shot from the player: returns the NPC hit (if any)
  shoot(W, origin, dir, muzzle, from) {
    const hit = this.pick(origin, dir, W.range, from);
    const wallT = this.march(origin, dir, hit ? hit.t : W.range);
    const end = tmp.copy(origin).addScaledVector(dir, Math.min(wallT, hit ? hit.t : wallT));
    if (Math.random() < (W.pellets ? 0.35 : 0.7)) this.tracer(muzzle, end);
    if (hit && hit.t <= wallT + 0.01) {
      const mult = hit.head ? (W.head || 2.2) : 1;
      const falloff = W.pellets ? Math.max(0.25, 1 - hit.t / W.range) : 1;
      const dmg = W.dmg * mult * falloff;
      if (!hit.n.noHit) {
        if (!hit.n.canBeHit && !hit.n.guard) hit.n.shot = true;        // a villager shot: worse than a fist
        hit.n.takeHit(dmg, from.x, from.z);
        if (!hit.n.hostile && !hit.n.ko && hit.n.guard) hit.n.becomeHostile(false);
        G.hud?.hitMark(hit.n.ko, hit.head);
      }
      G.fx?.dust(tmp2.set(hit.n.pos.x, hit.n.pos.y + 1.1, hit.n.pos.z), 1, 0.35);
      return hit.n;
    }
    if (wallT < W.range) this.impact(end, W.pellets ? 0.5 : 1);
    return null;
  }
  fireRocket(W, muzzle, dir) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 8).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5a5a4a, roughness: 0.5, metalness: 0.4 }));
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), this.flashMat); glow.position.z = -0.3;
    g.add(body, glow); g.position.copy(muzzle); g.lookAt(tmp.copy(muzzle).add(dir));
    g.traverse((o) => o.layers.set(1)); this.scene.add(g);
    this.rockets.push({ g, v: dir.clone().multiplyScalar(W.speed), W, t: 0, smoke: 0 });
  }
  explode(p, W) {
    const R = W.radius;
    G.audio?.sfx('boom');
    const fl = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), this.flashMat.clone()); fl.position.copy(p); fl.layers.set(1); this.scene.add(fl);
    this.blasts.push({ m: fl, t: 0, R });
    this.light.position.copy(p); this.light.position.y += 1.5; this.light.intensity = 60; this.lightT = 0.4;
    const fx = G.fx;
    if (fx) { for (let i = 0; i < 6; i++) fx.fire({ x: p.x + (Math.random() - 0.5) * R * 0.5, y: p.y, z: p.z + (Math.random() - 0.5) * R * 0.5 }, 3, 1.6); fx.smoke(p, 10, { size: 1.6, dark: 0.18, alpha: 0.5, rise: 2, life: 7 }); fx.dust(p, 12, 2.2); }
    for (const n of G.npcs) {
      if (!n.active || n.ko) continue;
      const d = n.pos.distanceTo(p); if (d > R) continue;
      if (!n.noHit) { n.takeHit(W.dmg * (1 - d / R) + 20, p.x, p.z); n.kx = (n.kx || 0) * 2.5; n.kz = (n.kz || 0) * 2.5; G.hud?.hitMark(n.ko, false); }
    }
    this.scare(p, 40);
    const pl = G.player, pd = pl.worldPos(tmp).distanceTo(p);
    if (pd < R) pl.damage(70 * (1 - pd / R), p.x, p.z);
    pl.shake = Math.max(pl.shake, Math.max(0, 1.4 - pd / 30));
    for (const n of G.npcs) if (n.guard && n.active && !n.ko && !n.hostile && n.pos.distanceTo(p) < 70) n.becomeHostile(false);
  }
  // gunfire nearby: villagers duck and cover for a while; guards within earshot come running
  noise(p, loud, silenced) {
    const hear = silenced ? 9 : loud;
    for (const n of G.npcs) if (n.guard && n.active && !n.ko && !n.hostile && n.pos.distanceTo(p) < hear) n.becomeHostile(false);
    this.scare(p, silenced ? 6 : loud * 0.55);
  }
  scare(p, r) {
    for (const n of G.npcs) {
      if (!n.active || n.ko || n.hostile || n.guard || n.attached || n.canBeHit) continue;
      if (n.pos.distanceTo(p) > r) continue;
      if (n.scaredT == null || n.scaredT <= 0) n.prevPose = n.pose;
      n.pose = 'cower'; n.scaredT = 9 + Math.random() * 4;
    }
  }
  update(dt) {
    for (let i = this.tracers.length - 1; i >= 0; i--) { const tr = this.tracers[i]; tr.t -= dt; tr.l.material.opacity = Math.max(0, tr.t / 0.07); if (tr.t <= 0) { this.scene.remove(tr.l); tr.l.geometry.dispose(); this.tracers.splice(i, 1); } }
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i]; r.t += dt; r.v.y -= 1.5 * dt;
      const p = r.g.position, prev = tmp2.copy(p);
      p.addScaledVector(r.v, dt); r.g.lookAt(tmp.copy(p).add(r.v));
      if ((r.smoke -= dt) <= 0) { r.smoke = 0.03; G.fx?.smoke(prev, 1, { size: 0.35, dark: 0.75, alpha: 0.35, life: 2.5 }); }
      let boom = r.t * r.W.speed > r.W.range || p.y < groundAt(p.x, p.z, p.y + 0.5);
      const b = pointInBox(p.x, p.z, 0.1); if (b && p.y < b.top) boom = true;
      if (!boom) for (const n of G.npcs) if (n.active && !n.ko && n.root.visible && Math.hypot(n.pos.x - p.x, n.pos.z - p.z) < 0.6 && p.y > n.pos.y && p.y < n.pos.y + 1.9) { boom = true; break; }
      if (boom) { this.scene.remove(r.g); this.rockets.splice(i, 1); this.explode(p.clone(), r.W); }
    }
    for (let i = this.blasts.length - 1; i >= 0; i--) {
      const b = this.blasts[i]; b.t += dt; const u = b.t / 0.3;
      b.m.scale.setScalar(0.4 + b.R * 0.45 * Math.sqrt(u)); b.m.material.opacity = 0.7 * Math.max(0, 1 - u) * Math.max(0, 1 - u);
      if (u >= 1) { this.scene.remove(b.m); this.blasts.splice(i, 1); }
    }
    if (this.lightT > 0) { this.lightT -= dt; this.light.intensity = Math.max(0, this.lightT / 0.4) * 60; }
    // how hot things are, for the score: an enemy close by, or a gun just fired
    { const pl = G.player, pp = pl.pos; let hot = G.time - (pl.combatT || -99) < 6 && pl.drawn && !!pl.wdef?.gun;
      if (!hot) for (const n of G.npcs) if (n.hostile && !n.ko && n.active && Math.abs(n.pos.x - pp.x) < 35 && Math.abs(n.pos.z - pp.z) < 35) { hot = true; break; }
      G.combatHeat = Math.max(0, Math.min(1, (G.combatHeat || 0) + (hot ? dt * 2 : -dt / 10))); }
    // the frightened get up again
    for (const n of G.npcs) if (n.scaredT > 0) { n.scaredT -= dt; if (n.scaredT <= 0) n.pose = n.prevPose || 'idle'; }
  }
}
