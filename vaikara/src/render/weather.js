// Monsoon weather: clear → cloudy → rain → storm → clearing, with GPU rain
// streaks around the camera, lightning and thunder. Drives U.rain / U.storm /
// U.cloud / U.wind, which the sky, water, terrain and materials read.
import * as THREE from 'three/webgpu';
import { attribute, positionLocal, vec3, vec4, float, uv, mod, smoothstep, mix } from 'three/tsl';
import { G, U } from '../state.js';
import { makeRng } from '../world/noise.js';
import { getCoast } from '../world/data.js';

export const STATES = ['clear', 'cloudy', 'rain', 'storm'];
const TARGET = {
  clear: { cloud: 0, rain: 0, storm: 0 },
  cloudy: { cloud: 0.65, rain: 0, storm: 0 },
  rain: { cloud: 0.9, rain: 0.8, storm: 0 },
  storm: { cloud: 1, rain: 1, storm: 1 },
};
const NEXT = { clear: ['clear', 'cloudy', 'cloudy'], cloudy: ['clear', 'rain', 'rain'], rain: ['cloudy', 'storm', 'rain'], storm: ['rain'] };

export class Weather {
  constructor(scene, sky, audio) {
    this.scene = scene; this.sky = sky; this.audio = audio;
    this.rnd = makeRng(1905);
    this.state = 'clear'; this.timer = 120;
    this.w = { cloud: 0, rain: 0, storm: 0, flash: 0 };
    this.nextStrike = 6;
    this.buildRain();
    this.buildBolt();
  }

  set(state, instant = false) {
    this.state = state; this.timer = 120 + this.rnd() * 240;
    if (instant) Object.assign(this.w, TARGET[state]);
  }
  cycle() { this.set(STATES[(STATES.indexOf(this.state) + 1) % STATES.length]); }

  buildRain() {
    const N = Math.round(9000 * Math.min(1.4, G.Q.grass + 0.2));
    const BOX = 46, H = 28;
    // one thin vertical quad per drop, offset per instance
    const base = new THREE.PlaneGeometry(0.018, 0.75);
    base.translate(0, 0.375, 0);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index; g.attributes.position = base.attributes.position; g.attributes.uv = base.attributes.uv;
    const off = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) { off[i * 4] = this.rnd() * BOX; off[i * 4 + 1] = this.rnd() * H; off[i * 4 + 2] = this.rnd() * BOX; off[i * 4 + 3] = this.rnd(); }
    g.setAttribute('iOff', new THREE.InstancedBufferAttribute(off, 4));
    g.instanceCount = N;
    const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const o = attribute('iOff', 'vec4');
    const cam = U.camPos;
    const fall = U.time.mul(float(13).add(o.w.mul(4)));
    // wrap drops in a box that follows the camera through world space (no swimming with the view)
    const wind = vec3(U.storm.mul(3).add(0.6), 0, U.storm.mul(1.2));
    const local = vec3(
      mod(o.x.sub(cam.x).add(fall.mul(wind.x).mul(0.08)), BOX).sub(BOX / 2),
      mod(o.y.sub(fall).sub(cam.y), H).sub(H / 2),
      mod(o.z.sub(cam.z).add(fall.mul(wind.z).mul(0.08)), BOX).sub(BOX / 2),
    );
    // face the quad roughly towards the camera by rotating it about Y per drop
    const ang = o.w.mul(6.283);
    const px = positionLocal.x.mul(ang.cos()), pz = positionLocal.x.mul(ang.sin());
    const lean = positionLocal.y.mul(wind.x.mul(0.08));
    m.positionNode = cam.add(local).add(vec3(px.add(lean), positionLocal.y, pz));
    const v = uv().y;
    m.colorNode = vec4(vec3(0.75, 0.8, 0.86).mul(float(1).sub(U.night.mul(0.75))), smoothstep(0.0, 0.5, v).mul(smoothstep(1.0, 0.6, v)).mul(U.rain.mul(0.32)));
    this.rain = new THREE.Mesh(g, m);
    this.rain.frustumCulled = false;
    this.rain.renderOrder = 5;
    this.rain.visible = false;
    this.scene.add(this.rain);
  }

  buildBolt() {
    this.boltMat = new THREE.MeshBasicNodeMaterial({ color: 0xdfe8ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    this.bolt = new THREE.Mesh(new THREE.BufferGeometry(), this.boltMat);
    this.bolt.frustumCulled = false; this.bolt.visible = false;
    this.scene.add(this.bolt);
  }

  strike(camPos) {
    const r = this.rnd;
    const a = r() * Math.PI * 2, d = 1200 + r() * 2600;
    const x0 = camPos.x + Math.cos(a) * d, z0 = camPos.z + Math.sin(a) * d;
    // jagged ribbon from the cloud base to the ground, facing the camera
    const pts = []; let x = x0, y = 1400, z = z0;
    while (y > 0) { pts.push([x, y, z]); x += (r() - 0.5) * 110; z += (r() - 0.5) * 110; y -= 60 + r() * 90; }
    pts.push([x, 0, z]);
    const rx = -(z0 - camPos.z) / d, rz = (x0 - camPos.x) / d, w = 6;
    const P = [], I = [];
    pts.forEach(([px, py, pz], i) => { P.push(px - rx * w, py, pz - rz * w, px + rx * w, py, pz + rz * w); if (i) { const k = (i - 1) * 2; I.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I);
    this.bolt.geometry.dispose(); this.bolt.geometry = g;
    this.bolt.visible = true; this.boltT = 0.18;
    this.w.flash = 1;
    this.audio?.thunder(d / 343, d);
  }

  update(dt, camPos) {
    this.timer -= dt;
    if (this.timer <= 0) { const opts = NEXT[this.state]; this.set(opts[Math.floor(this.rnd() * opts.length)]); }
    const t = TARGET[this.state], k = 1 - Math.exp(-dt / 12);
    for (const key of ['cloud', 'rain', 'storm']) this.w[key] += (t[key] - this.w[key]) * k;
    // lightning in storms
    if (this.w.storm > 0.5) { this.nextStrike -= dt; if (this.nextStrike <= 0) { this.strike(camPos); this.nextStrike = 4 + this.rnd() * 10; } }
    this.w.flash *= Math.exp(-dt * 7);
    if (this.boltT > 0) { this.boltT -= dt; if (this.boltT <= 0) this.bolt.visible = false; }
    U.rain.value = this.w.rain; U.storm.value = this.w.storm; U.cloud.value = this.w.cloud;
    U.wind.value = 1 + this.w.rain * 0.6 + this.w.storm * 2.2;
    this.rain.visible = this.w.rain > 0.02;
    this.sky.wx = this.w;
    this.audio?.setWeather(this.w, Math.abs(getCoast(camPos.x, camPos.z)));
  }
}
void mix;
