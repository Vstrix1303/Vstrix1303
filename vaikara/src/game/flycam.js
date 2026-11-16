// Free-fly camera (F): survey the whole region.
import * as THREE from 'three/webgpu';
import { Input } from './input.js';
import { getHeight } from '../world/data.js';

export class FlyCam {
  constructor(camera) {
    this.camera = camera; this.enabled = false;
    this.pos = new THREE.Vector3(); this.yaw = 0; this.pitch = -0.2; this.speed = 60;
  }
  enable(on, from) {
    this.enabled = on;
    document.body.classList.toggle('fly', on);
    if (on && from) {
      this.pos.copy(from.position);
      const d = new THREE.Vector3(); from.getWorldDirection(d);
      this.yaw = Math.atan2(-d.x, -d.z); this.pitch = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1));
    }
  }
  update(dt) {
    this.yaw -= Input.dx * 0.0022; this.pitch = THREE.MathUtils.clamp(this.pitch - Input.dy * 0.0022, -1.5, 1.5);
    if (Input.wheel) this.speed = THREE.MathUtils.clamp(this.speed * (Input.wheel < 0 ? 1.25 : 0.8), 4, 2000);
    const f = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    const r = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const v = new THREE.Vector3();
    if (Input.down('KeyW')) v.add(f); if (Input.down('KeyS')) v.sub(f);
    if (Input.down('KeyD')) v.add(r); if (Input.down('KeyA')) v.sub(r);
    if (Input.down('Space') || Input.down('KeyE')) v.y += 1; if (Input.down('KeyC') || Input.down('KeyQ')) v.y -= 1;
    const sp = this.speed * (Input.down('ShiftLeft') || Input.down('ShiftRight') ? 4 : 1);
    this.pos.addScaledVector(v, sp * dt);
    this.pos.y = Math.max(this.pos.y, Math.max(getHeight(this.pos.x, this.pos.z), 0) + 1.5);
    this.camera.position.copy(this.pos);
    this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
  }
}
