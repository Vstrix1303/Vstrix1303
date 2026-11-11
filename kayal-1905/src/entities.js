// Rideable horse and paddled vallam (canoe).
import * as THREE from 'three';
import { G } from './state.js';
import { Quadruped, makeVallam } from './characters.js';
import { getHeight } from './heightfield.js';
import { groundAt, resolve, platforms } from './physics.js';
import { clamp, damp, angleDiff } from './util.js';

const toward = (a, b, step) => (a < b ? Math.min(b, a + step) : Math.max(b, a - step));

export class Horse {
  constructor(scene, x, z, yaw, o = {}) {
    this.q = new Quadruped('horse', { saddle: true, ...o });
    this.root = this.q.root;
    this.pos = new THREE.Vector3(x, getHeight(x, z), z);
    this.yaw = yaw; this.speed = 0; this.pitch = 0;
    this.rider = null;
    this.name = o.name || 'horse';
    scene.add(this.root);
    this.sync();
  }
  drive(dt, wx, wz, sprint, maxGallop = 12.6) {
    const wl = Math.hypot(wx, wz);
    let target = 0;
    if (wl > 0.1) {
      const diff = angleDiff(this.yaw, Math.atan2(wx, wz));
      const rate = 2.7 * (1 - this.speed / 45);
      this.yaw += clamp(diff, -rate * dt, rate * dt);
      target = (sprint ? maxGallop : 6) * Math.min(1, wl) * clamp(1.25 - Math.abs(diff) / 1.6, 0.3, 1);
    }
    this.speed = toward(this.speed, target, (target > this.speed ? 5.5 : 9) * dt);
    this.step(dt);
  }
  step(dt) {
    if (this.speed > 0.01) {
      const nx = this.pos.x + Math.sin(this.yaw) * this.speed * dt, nz = this.pos.z + Math.cos(this.yaw) * this.speed * dt;
      if (getHeight(nx, nz) < -0.75 || Math.abs(nx) > 745 || Math.abs(nz) > 745) this.speed = Math.max(0, this.speed - 30 * dt);
      else {
        const ox = this.pos.x, oz = this.pos.z;
        this.pos.x = nx; this.pos.z = nz;
        resolve(this.pos, 0.7, this.pos.y);
        const moved = Math.hypot(this.pos.x - ox, this.pos.z - oz);
        if (moved < this.speed * dt * 0.4) this.speed *= 0.9;
      }
    }
    const g = groundAt(this.pos.x, this.pos.z, this.pos.y + 0.5);
    this.pos.y = damp(this.pos.y, g, 16, dt);
    const f = 0.9, hf = getHeight(this.pos.x + Math.sin(this.yaw) * f, this.pos.z + Math.cos(this.yaw) * f), hb = getHeight(this.pos.x - Math.sin(this.yaw) * f, this.pos.z - Math.cos(this.yaw) * f);
    this.pitch = damp(this.pitch, clamp(-Math.atan2(hf - hb, 2 * f), -0.45, 0.45), 6, dt);
  }
  sync() {
    this.root.position.copy(this.pos);
    this.root.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
  update(dt) {
    if (!this.rider && this.speed > 0) { this.speed = toward(this.speed, 0, 8 * dt); this.step(dt); }
    this.q.speed = this.speed;
    this.q.update(dt);
    this.sync();
  }
}

export class Boat {
  constructor(scene, x, z, yaw) {
    const v = makeVallam();
    this.root = v.root; this.cargo = v.cargo;
    this.pos = new THREE.Vector3(x, 0, z);
    this.yaw = yaw; this.speed = 0; this.roll = 0; this.yawRate = 0;
    this.rider = null; this.t = Math.random() * 10;
    scene.add(this.root);
    this.update(0);
  }
  drive(dt, wx, wz, sprint) {
    const wl = Math.hypot(wx, wz);
    let target = 0;
    this.yawRate = 0;
    if (wl > 0.1) {
      const diff = angleDiff(this.yaw, Math.atan2(wx, wz));
      this.yawRate = clamp(diff, -1, 1) * 1.3 * (0.4 + Math.min(1, this.speed / 3) * 0.6);
      this.yaw += this.yawRate * dt;
      target = (sprint ? 7.8 : 6.2) * Math.min(1, wl) * (0.3 + 0.7 * Math.max(0, Math.cos(diff)));
    }
    this.speed = toward(this.speed, target, (target > this.speed ? 2.4 : 1.5) * dt);
    this.paddling = wl > 0.1;
  }
  update(dt) {
    this.t += dt;
    if (!this.rider) { this.speed = toward(this.speed, 0, 1.5 * dt); this.yawRate = 0; }
    if (this.speed > 0.01) {
      const nx = this.pos.x + Math.sin(this.yaw) * this.speed * dt, nz = this.pos.z + Math.cos(this.yaw) * this.speed * dt;
      const bow = 2.2;
      const hb = getHeight(nx + Math.sin(this.yaw) * bow, nz + Math.cos(this.yaw) * bow);
      if (hb > -0.45 || getHeight(nx, nz) > -0.5 || Math.abs(nx) > 740 || Math.abs(nz) > 740) this.speed = toward(this.speed, 0, 14 * dt);
      else { this.pos.x = nx; this.pos.z = nz; }
    }
    this.roll = damp(this.roll, -this.yawRate * 0.22, 3, dt);
    this.root.position.set(this.pos.x, 0.03 + Math.sin(this.t * 1.3) * 0.025, this.pos.z);
    this.root.rotation.set(Math.sin(this.t * 0.9) * 0.015 - this.speed * 0.006, this.yaw, this.roll + Math.sin(this.t * 1.1) * 0.02, 'YXZ');
  }
  // nearest place to step out, or null
  landing() {
    let best = null, bd = 1e9;
    for (const p of platforms) {
      const dx = this.pos.x - p.x, dz = this.pos.z - p.z;
      const lx = clamp(dx * p.c - dz * p.s, -p.hw + 0.5, p.hw - 0.5), lz = clamp(dx * p.s + dz * p.c, -p.hd + 0.5, p.hd - 0.5);
      const wx = p.x + lx * p.c + lz * p.s, wz = p.z - lx * p.s + lz * p.c;
      const d = Math.hypot(wx - this.pos.x, wz - this.pos.z);
      if (d < 3.6 && d < bd) { bd = d; best = new THREE.Vector3(wx, p.y, wz); }
    }
    if (best) return best;
    for (let r = 2; r <= 5.5; r += 0.7) for (let a = 0; a < 12; a++) {
      const x = this.pos.x + Math.cos(a / 12 * 6.283) * r, z = this.pos.z + Math.sin(a / 12 * 6.283) * r;
      const h = getHeight(x, z);
      if (h > 0.25) return new THREE.Vector3(x, h, z);
    }
    return null;
  }
}
