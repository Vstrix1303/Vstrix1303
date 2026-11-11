// Villagers, guards (stealth + melee AI) and mounted pursuers.
import * as THREE from 'three';
import { G } from './state.js';
import { Human, CAST, makeStick, makeLantern, Quadruped } from './characters.js';
import { getHeight } from './heightfield.js';
import { groundAt, resolve, segmentBlocked } from './physics.js';
import { clamp, damp, angleDamp, angleDiff, lerp } from './util.js';

const coneGeo = (() => {
  const g = new THREE.BufferGeometry();
  const pts = [0, 0, 0], idx = [];
  const n = 14, half = 0.62;
  for (let i = 0; i <= n; i++) { const a = -half + (i / n) * half * 2; pts.push(Math.sin(a), 0, Math.cos(a)); }
  for (let i = 1; i <= n; i++) idx.push(0, i, i + 1);
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.setIndex(idx);
  return g;
})();

export class NPC {
  constructor(scene, name, preset, x, z, yaw = 0, o = {}) {
    this.scene = scene; this.name = name;
    this.h = new Human(preset);
    this.root = this.h.root;
    this.root.traverse((o) => o.layers.set(1));
    scene.add(this.root);
    this.pos = new THREE.Vector3(x, o.y ?? groundAt(x, z), z);
    this.fixedY = o.y != null;
    this.yaw = yaw; this.home = this.pos.clone(); this.homeYaw = yaw;
    this.pose = o.pose || 'idle';
    this.route = o.route || null; this.routeI = 0; this.wait = 0; this.walkSpeed = o.speed || 1.35;
    this.wander = o.wander || 0;
    this.lines = o.lines || null; this.lineI = 0;
    this.active = true; this.ko = false; this.hostile = false; this.canBeHit = false;
    this.health = 100; this.speed = 0;
    this.guard = !!o.guard;
    this.aiMode = this.route ? 'patrol' : 'idle';
    this.alert = 0; this.attackT = 0; this.stun = 0; this.lostT = 0;
    this.facePlayer = o.facePlayer ?? false;
    if (this.guard) {
      this.canBeHit = true;
      this.stick = this.h.hold(makeStick(1.5, 0x3a2a1a));
      this.lantern = this.h.hold(makeLantern(), false);
      this.root.traverse((o) => o.layers.set(1));
      this.cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, fog: false, blending: THREE.AdditiveBlending }));
      this.cone.layers.set(1);
      this.cone.renderOrder = 3;
      scene.add(this.cone);
      this.viewDist = o.viewDist || 13;
    }
    this.sync();
    G.npcs.push(this);
    if (this.lines) {
      this.inter = { pos: this.pos, r: 2.4, label: `Talk to ${o.title || name}`, cond: () => this.active && !this.hostile && !this.ko && !G.story.busy, action: () => this.speak() };
      G.interactables.push(this.inter);
    }
  }
  speak() {
    const l = this.lines[this.lineI % this.lines.length];
    this.lineI++;
    G.ui.bark(this.name, l, 4.5);
    this.talkT = 4;
  }
  setActive(v) {
    this.active = v; this.root.visible = v;
    if (this.cone) this.cone.visible = v && this.showCone;
  }
  place(x, z, yaw) {
    this.pos.set(x, groundAt(x, z), z); this.fixedY = false;
    if (yaw != null) this.yaw = yaw;
    this.home.copy(this.pos); this.homeYaw = this.yaw;
    this.sync();
  }
  reset() {
    this.ko = false; this.health = 100; this.hostile = false; this.alert = 0; this.stun = 0;
    this.aiMode = this.route ? 'patrol' : 'idle'; this.h.state = 'idle'; this.h.j.bodyX = 0; this.routeI = 0;
    if (this.route) this.pos.copy(this.route[0]); else this.pos.copy(this.home);
    this.yaw = this.homeYaw;
    this.sync();
  }
  sync() {
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
  }
  takeHit(dmg, fx, fz) {
    if (this.ko) return;
    this.health -= dmg; this.stun = 0.55;
    const d = Math.hypot(this.pos.x - fx, this.pos.z - fz) || 1;
    this.kx = (this.pos.x - fx) / d * 5; this.kz = (this.pos.z - fz) / d * 5;
    if (this.guard && !this.hostile) this.becomeHostile(true);
    if (this.health <= 0) {
      this.ko = true; this.h.state = 'ko'; this.hostile = false; this.aiMode = 'ko';
      if (this.cone) this.cone.visible = false;
      G.story?.onKO?.(this);
    }
  }
  becomeHostile(shout = true) {
    if (this.ko || this.hostile) return;
    this.hostile = true; this.aiMode = 'chase'; this.alert = 1;
    if (shout) G.story?.onAlert?.(this);
  }
  moveToward(tx, tz, sp, dt, collide = false) {
    const dx = tx - this.pos.x, dz = tz - this.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.05) { this.speed = 0; return d; }
    this.yaw = angleDamp(this.yaw, Math.atan2(dx, dz), 8, dt);
    const st = Math.min(d, sp * dt);
    this.pos.x += dx / d * st; this.pos.z += dz / d * st;
    if (collide) resolve(this.pos, 0.34, this.pos.y);
    this.speed = sp;
    return d;
  }
  update(dt) {
    if (!this.active) return;
    const pl = G.player, pp = pl.worldPos(this._pp || (this._pp = new THREE.Vector3()));
    const dxp = pp.x - this.pos.x, dzp = pp.z - this.pos.z, dp = Math.hypot(dxp, dzp);
    // cull distant actors entirely
    const vis = dp < 115;
    if (this.root.visible !== vis) this.root.visible = vis;
    if (!vis && !this.hostile) return;
    this.speed = 0;
    let state = this.pose;

    if (this.ko) { state = 'ko'; }
    else if (this.stun > 0) {
      this.stun -= dt;
      this.pos.x += (this.kx || 0) * dt; this.pos.z += (this.kz || 0) * dt;
      this.kx *= 0.85; this.kz *= 0.85;
      resolve(this.pos, 0.34, this.pos.y);
      state = 'idle';
    } else if (this.hostile) {
      // chase & strike
      this.attackT -= dt;
      if (pl.health <= 0) { state = 'idle'; }
      else if (dp > 1.55) {
        const mounted = pl.mode !== 'foot';
        this.moveToward(pp.x, pp.z, mounted ? 4.6 : 5.3, dt, true);
        state = 'move';
        if (dp > 70) { this.hostile = false; this.aiMode = this.route ? 'patrol' : 'idle'; this.alert = 0; }
      } else {
        this.yaw = angleDamp(this.yaw, Math.atan2(dxp, dzp), 10, dt);
        if (this.attackT <= 0) { this.attackT = 1.25; this.h.strikeT = 0; this.hitPending = 0.2; G.audio?.sfx('swing', 0.5); }
      }
      if (this.hitPending > 0) {
        this.hitPending -= dt;
        if (this.hitPending <= 0 && dp < 2.2 && pl.mode === 'foot') pl.damage(13, this.pos.x, this.pos.z);
      }
    } else if (this.aiMode === 'patrol' && this.route) {
      if (this.wait > 0) { this.wait -= dt; }
      else {
        const t = this.route[this.routeI];
        const d = this.moveToward(t.x, t.z, this.walkSpeed, dt);
        state = 'move';
        if (d < 0.3) { this.routeI = (this.routeI + 1) % this.route.length; this.wait = this.guard ? 1.6 + Math.random() * 1.5 : Math.random() * 2; }
      }
    } else if (this.wander > 0) {
      if (this.wait > 0) this.wait -= dt;
      else {
        if (!this.wt) { const a = Math.random() * 6.28, r = Math.random() * this.wander; this.wt = { x: this.home.x + Math.cos(a) * r, z: this.home.z + Math.sin(a) * r }; }
        const d = this.moveToward(this.wt.x, this.wt.z, this.walkSpeed, dt);
        state = 'move';
        if (d < 0.4 || getHeight(this.pos.x, this.pos.z) < 0.2) { this.wt = null; this.wait = 2 + Math.random() * 6; }
      }
    } else if (this.goal) {
      const d = this.moveToward(this.goal.x, this.goal.z, this.goal.speed || 2, dt, true);
      state = 'move';
      if (d < 0.4) { const g = this.goal; this.goal = null; if (g.yaw != null) this.yaw = g.yaw; g.done?.(); }
    } else if ((this.facePlayer || this.talkT > 0) && dp < 7) {
      this.yaw = angleDamp(this.yaw, Math.atan2(dxp, dzp), 5, dt);
    }
    if (this.talkT > 0) { this.talkT -= dt; if (state === 'idle') state = 'talk'; }

    // guard perception
    if (this.guard && !this.ko && !this.hostile && this.perceive) {
      const ang = Math.abs(angleDiff(this.yaw, Math.atan2(dxp, dzp)));
      const range = this.viewDist * (pl.crouch ? 0.55 : 1) * (pl.speedNow > 5 ? 1.25 : 1);
      let seen = false;
      if (pl.mode === 'foot' && dp < range && ang < 0.62 && !segmentBlocked(this.pos.x, this.pos.z, pp.x, pp.z)) seen = true;
      if (dp < 1.6 && !pl.crouch) seen = true;                       // bumped into
      if (dp < 6 && pl.speedNow > 5.5) seen = true;                  // heard running
      if (seen) this.alert += dt * lerp(2.4, 0.55, clamp(dp / range, 0, 1));
      else this.alert -= dt * 0.35;
      this.alert = clamp(this.alert, 0, 1);
      if (this.alert >= 1) this.becomeHostile(true);
      else if (this.alert > 0.35 && seen) { this.yaw = angleDamp(this.yaw, Math.atan2(dxp, dzp), 3, dt); if (state === 'move') { state = 'idle'; this.speed = 0; this.wait = Math.max(this.wait, 0.6); } }
    }
    if (this.cone) {
      const show = this.showCone && !this.ko && this.active;
      this.cone.visible = show;
      if (show) {
        this.cone.position.set(this.pos.x, this.pos.y + 0.12, this.pos.z);
        this.cone.rotation.y = this.yaw;
        const r = this.viewDist * (pl.crouch ? 0.55 : 1);
        this.cone.scale.set(r, 1, r);
        const c = this.cone.material.color;
        if (this.hostile) c.setRGB(1.6, 0.2, 0.12); else c.setRGB(1.3, lerp(0.95, 0.35, this.alert), lerp(0.5, 0.1, this.alert));
        this.cone.material.opacity = 0.3 + this.alert * 0.3;
      }
    }
    if (!this.fixedY) this.pos.y = damp(this.pos.y, groundAt(this.pos.x, this.pos.z, this.pos.y + 0.4), 14, dt);
    this.h.state = state; this.h.speed = this.speed;
    this.h.update(dt);
    this.sync();
  }
  dispose() {
    this.scene.remove(this.root);
    if (this.cone) this.scene.remove(this.cone);
    const i = G.npcs.indexOf(this); if (i >= 0) G.npcs.splice(i, 1);
    if (this.inter) { const k = G.interactables.indexOf(this.inter); if (k >= 0) G.interactables.splice(k, 1); }
  }
}

// A Company rider on horseback who hunts the player down the road.
export class Rider {
  constructor(scene, x, z, yaw, speed = 11.4) {
    this.scene = scene;
    this.q = new Quadruped('horse', { saddle: true, color: 0x2a1d16, dark: 0x0e0a08 });
    this.h = new Human(CAST.guard);
    this.q.root.add(this.h.root);
    this.h.root.position.set(0, this.q.seatY, -0.06);
    this.h.state = 'ride';
    this.h.hold(makeLantern(), false);
    scene.add(this.q.root);
    this.pos = new THREE.Vector3(x, getHeight(x, z), z);
    this.yaw = yaw; this.speed = 0; this.max = speed; this.active = true; this.nearT = 0;
  }
  update(dt) {
    if (!this.active) return;
    const pp = G.player.worldPos(this._pp || (this._pp = new THREE.Vector3()));
    const dx = pp.x - this.pos.x, dz = pp.z - this.pos.z, d = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz);
    this.yaw += clamp(angleDiff(this.yaw, want), -2.4 * dt, 2.4 * dt);
    // rubber-band a little so the chase stays tense but fair
    const target = this.halt ? 0 : d > 55 ? this.max + 2.2 : d < 7 ? Math.min(this.max, G.player.speedNow + 1.2) : this.max;
    this.speed = damp(this.speed, target, 1.6, dt);
    const nx = this.pos.x + Math.sin(this.yaw) * this.speed * dt, nz = this.pos.z + Math.cos(this.yaw) * this.speed * dt;
    if (getHeight(nx, nz) > -0.6) { this.pos.x = nx; this.pos.z = nz; resolve(this.pos, 0.6, this.pos.y); }
    this.pos.y = damp(this.pos.y, getHeight(this.pos.x, this.pos.z), 14, dt);
    this.q.speed = this.speed; this.q.update(dt);
    this.h.speed = this.speed; this.h.update(dt);
    this.q.root.position.copy(this.pos); this.q.root.rotation.y = this.yaw;
    this.nearT = d < 2.6 ? this.nearT + dt : Math.max(0, this.nearT - dt * 0.5);
    this.dist = d;
  }
  dispose() { this.scene.remove(this.q.root); this.active = false; }
}
