// Lightweight particle effects: hearth smoke, fire & embers, hoof dust,
// paddle spray, waterfall mist. Two pooled point clouds (lit + additive).
import * as THREE from 'three';
import { G } from './state.js';
import { TEX } from './textures.js';

const VERT = /* glsl */`
attribute float aSize; attribute vec4 aColor;
varying vec4 vColor;
void main(){
  vColor = aColor;
  vec4 mv = viewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * 520.0 / max(-mv.z, 0.5);
}`;
const FRAG = /* glsl */`
uniform sampler2D uTex; uniform vec3 uFogCol; uniform float uFogDen;
varying vec4 vColor;
void main(){
  float a = texture2D(uTex, gl_PointCoord).a * vColor.a;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor.rgb, a);
}`;

class Pool {
  constructor(scene, n, additive) {
    this.n = n; this.i = 0; this.additive = additive;
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 4); this.size = new Float32Array(n);
    this.vel = new Float32Array(n * 3); this.life = new Float32Array(n); this.max = new Float32Array(n);
    this.grow = new Float32Array(n); this.s0 = new Float32Array(n); this.grav = new Float32Array(n); this.a0 = new Float32Array(n); this.drag = new Float32Array(n);
    this.rgb = new Float32Array(n * 3);
    const g = this.geo = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: TEX.glow } }, vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false,
    });
    this.pts = new THREE.Points(g, m);
    this.pts.frustumCulled = false; this.pts.layers.set(1); this.pts.renderOrder = additive ? 7 : 6;
    scene.add(this.pts);
    this.alive = 0;
  }
  emit(x, y, z, vx, vy, vz, life, size, grow, r, g, b, a, grav = 0, drag = 0.4) {
    const i = this.i; this.i = (i + 1) % this.n;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.max[i] = life; this.s0[i] = size; this.grow[i] = grow; this.grav[i] = grav; this.a0[i] = a; this.drag[i] = drag;
    this.rgb[i * 3] = r; this.rgb[i * 3 + 1] = g; this.rgb[i * 3 + 2] = b;
  }
  update(dt, light) {
    let alive = 0;
    const wind = G.env ? G.env.u.uWind.value : 0.3;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { this.size[i] = 0; continue; }
      alive++;
      this.life[i] -= dt;
      const k = Math.max(0, this.life[i] / this.max[i]), d = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] = this.vel[i * 3] * d + wind * 0.5 * dt * (this.additive ? 0.3 : 1); this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.grav[i] * dt; this.vel[i * 3 + 2] *= d;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] = this.s0[i] + this.grow[i] * (1 - k);
      const fade = Math.min(1, k * 2.5) * Math.min(1, (1 - k) * 8);
      const L = this.additive ? 1 : light;
      this.col[i * 4] = this.rgb[i * 3] * L; this.col[i * 4 + 1] = this.rgb[i * 3 + 1] * L; this.col[i * 4 + 2] = this.rgb[i * 3 + 2] * L;
      this.col[i * 4 + 3] = this.a0[i] * fade;
    }
    this.alive = alive;
    this.pts.visible = alive > 0;
    if (alive > 0 || this._dirty) {
      this.geo.attributes.position.needsUpdate = true; this.geo.attributes.aColor.needsUpdate = true; this.geo.attributes.aSize.needsUpdate = true;
    }
    this._dirty = alive > 0;
  }
}

export class FX {
  constructor(scene) {
    this.soft = new Pool(scene, 700, false);
    this.glow = new Pool(scene, 500, true);
    this.emitters = [];
    this.fireLight = new THREE.PointLight(0xff7a2a, 0, 46, 1.4);
    scene.add(this.fireLight);
    this.fireHeat = 0;
  }
  r(a = 1) { return (Math.random() - 0.5) * 2 * a; }
  smoke(p, n = 1, o = {}) {
    const s = o.size ?? 0.5, dark = o.dark ?? 0.55;
    for (let i = 0; i < n; i++) this.soft.emit(p.x + this.r(0.2), p.y, p.z + this.r(0.2), this.r(0.25), 0.9 + Math.random() * 0.7 + (o.rise || 0), this.r(0.25), o.life ?? (4 + Math.random() * 3), s, s * 4.5, dark, dark, dark * 1.02, o.alpha ?? 0.22, -0.05, 0.25);
  }
  fire(p, n = 2, sc = 1) {
    for (let i = 0; i < n; i++) {
      const hot = Math.random();
      this.glow.emit(p.x + this.r(0.55 * sc), p.y + Math.random() * 0.3, p.z + this.r(0.55 * sc), this.r(0.3), 1.6 + Math.random() * 1.8, this.r(0.3), 0.5 + Math.random() * 0.6, (0.5 + Math.random() * 0.4) * sc, -0.3 * sc, 2.4, 0.7 + hot * 0.9, 0.12 + hot * 0.3, 0.8, -0.6, 0.6);
    }
    if (Math.random() < 0.35) this.glow.emit(p.x + this.r(0.5), p.y + 0.6, p.z + this.r(0.5), this.r(1.2), 2.5 + Math.random() * 3, this.r(1.2), 1.2 + Math.random() * 1.5, 0.06, 0, 3, 1.4, 0.3, 1, 1.2, 0.3);
    if (Math.random() < 0.5) this.smoke({ x: p.x, y: p.y + 1.6, z: p.z }, 1, { size: 0.8 * sc, dark: 0.16, alpha: 0.4, rise: 1.4, life: 5 });
  }
  dust(p, n = 2, sc = 1) {
    for (let i = 0; i < n; i++) this.soft.emit(p.x + this.r(0.3), p.y + 0.1, p.z + this.r(0.3), this.r(0.8), 0.3 + Math.random() * 0.6, this.r(0.8), 0.9 + Math.random() * 0.8, 0.25 * sc, 1.2 * sc, 0.62, 0.45, 0.32, 0.22, 0.2, 1.2);
  }
  splash(p, n = 6, sc = 1) {
    for (let i = 0; i < n; i++) this.soft.emit(p.x + this.r(0.3 * sc), p.y + 0.05, p.z + this.r(0.3 * sc), this.r(1.4 * sc), 1.2 + Math.random() * 2.2 * sc, this.r(1.4 * sc), 0.5 + Math.random() * 0.5, 0.12 * sc, 0.3 * sc, 0.95, 0.97, 1, 0.5, 7, 0.4);
  }
  steam(p, n = 8) {
    for (let i = 0; i < n; i++) this.soft.emit(p.x + this.r(0.6), p.y + Math.random(), p.z + this.r(0.6), this.r(0.6), 1.5 + Math.random() * 1.5, this.r(0.6), 1.6 + Math.random(), 0.5, 2.4, 0.95, 0.95, 0.95, 0.35, -0.3, 0.6);
  }
  mist(p, n = 1) {
    for (let i = 0; i < n; i++) this.soft.emit(p.x + this.r(1.5), p.y + Math.random() * 0.8, p.z + this.r(2.5), -0.6 + this.r(0.5), 0.5 + Math.random() * 0.8, this.r(0.6), 2 + Math.random() * 2, 0.7, 3.2, 0.95, 0.97, 1, 0.16, -0.02, 0.5);
  }
  // persistent emitter: {pos, type, rate, cond?}
  addEmitter(e) { e.acc = Math.random(); this.emitters.push(e); return e; }
  removeEmitter(e) { const i = this.emitters.indexOf(e); if (i >= 0) this.emitters.splice(i, 1); }
  update(dt) {
    const env = G.env, cam = G.camera.position;
    let heat = 0, hx = 0, hy = 0, hz = 0;
    for (const e of this.emitters) {
      const d2 = (e.pos.x - cam.x) ** 2 + (e.pos.z - cam.z) ** 2;
      if (d2 > 260 * 260 || (e.cond && !e.cond())) continue;
      e.acc += dt * e.rate * (e.scale ?? 1);
      while (e.acc >= 1) {
        e.acc -= 1;
        if (e.type === 'smoke') this.smoke(e.pos, 1, e.o);
        else if (e.type === 'fire') this.fire(e.pos, 1, e.scale ?? 1);
        else if (e.type === 'mist') this.mist(e.pos, 1);
      }
      if (e.type === 'fire') { const w = e.scale ?? 1; heat += w; hx += e.pos.x * w; hy += e.pos.y * w; hz += e.pos.z * w; }
    }
    const light = env ? Math.min(1.2, (env.sunI * 0.22 + env.hemiI * 0.55)) : 1;
    this.soft.update(dt, light); this.glow.update(dt, 1);
    this.fireHeat += (heat - this.fireHeat) * Math.min(1, dt * 3);
    if (heat > 0.01) this.fireLight.position.set(hx / heat, hy / heat + 2.2, hz / heat);
    this.fireLight.intensity = this.fireHeat > 0.02 ? Math.min(3.5, this.fireHeat) * (150 + Math.sin(G.time * 17) * 30 + Math.sin(G.time * 31) * 20) : 0;
  }
}
