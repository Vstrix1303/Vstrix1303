// Sky, sun & moon, time of day, monsoon weather, rain, fireflies.
import * as THREE from 'three';
import { G, QUALITY } from './state.js';
import { TEX } from './textures.js';
import { clamp, lerp, smoothstep, damp, makeRng } from './util.js';
import { terrainU, heightTex, GLSL_HUV } from './terrain.js';

// hour, zenith, horizon, light colour, light intensity, hemi sky, hemi intensity, fog colour, fog density
const KEYS = [
  [0.0, '#0a1228', '#1c2c4e', '#8fb0ee', 1.15, '#3d5488', 1.0, '#131d33', 0.0014],
  [4.8, '#0b142c', '#1e2f52', '#8fb0ee', 1.15, '#3d5488', 1.0, '#141f36', 0.0016],
  [5.6, '#1b2850', '#c8755a', '#ffb089', 0.35, '#56668f', 0.6, '#59506a', 0.0026],
  [6.3, '#3d6ba8', '#ffb873', '#ffb070', 2.3, '#93a6c4', 0.8, '#d7aa8c', 0.0026],
  [7.5, '#3276c6', '#bcd6ea', '#ffe6c4', 3.2, '#a9c2de', 1.0, '#bccfdc', 0.0016],
  [10.0, '#2a6ec4', '#aed2f0', '#fff6e6', 3.7, '#b0c8e8', 1.1, '#afcbe2', 0.0010],
  [13.0, '#2468c0', '#a8cfee', '#fffaf0', 3.8, '#b0c8e8', 1.15, '#a9c6dd', 0.0010],
  [16.3, '#2f6db8', '#c7d6dc', '#ffe9c0', 3.4, '#aebfd6', 1.0, '#bccad0', 0.0011],
  [17.6, '#3b5f9e', '#ffab5e', '#ff9f52', 2.7, '#9d93aa', 0.85, '#e2a574', 0.0015],
  [18.4, '#2c376a', '#ec6a3e', '#ff7036', 1.3, '#7a6f96', 0.7, '#a5645a', 0.0018],
  [19.1, '#141f44', '#4a3a5c', '#8fb0ee', 0.3, '#3f4f80', 0.8, '#222840', 0.0017],
  [20.2, '#0a1228', '#1c2c4e', '#8fb0ee', 1.15, '#3d5488', 1.0, '#131d33', 0.0014],
  [24.0, '#0a1228', '#1c2c4e', '#8fb0ee', 1.15, '#3d5488', 1.0, '#131d33', 0.0014],
].map((k) => ({ t: k[0], zen: new THREE.Color(k[1]), hor: new THREE.Color(k[2]), sun: new THREE.Color(k[3]), sunI: k[4], hemi: new THREE.Color(k[5]), hemiI: k[6], fog: new THREE.Color(k[7]), fogD: k[8] }));

const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main(){
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;
const SKY_FRAG = /* glsl */`
uniform vec3 uSunDir, uMoonDir, uZenith, uHorizon, uFog, uSunColor, uCloudLit, uCloudDark;
uniform float uCover, uTime, uStars, uSunDisc, uFlash;
uniform sampler2D uNoise;
varying vec3 vDir;
float hash3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
void main(){
  vec3 d = normalize(vDir);
  float h = max(d.y, 0.0);
  vec3 col = mix(uHorizon, uZenith, pow(h, 0.42));
  col = mix(uFog, col, smoothstep(0.0, 0.09, d.y));
  float sd = max(dot(d, uSunDir), 0.0);
  // sun glow & disc
  col += uSunColor * (pow(sd, 6.0) * 0.10 + pow(sd, 60.0) * 0.35) * uSunDisc;
  col += uSunColor * smoothstep(0.99955, 0.99985, sd) * 14.0 * uSunDisc;
  // moon
  float md = max(dot(d, uMoonDir), 0.0);
  col += vec3(0.75, 0.82, 1.0) * (smoothstep(0.9993, 0.9996, md) * 2.2 + pow(md, 240.0) * 0.25) * uStars;
  // stars
  if (uStars > 0.01 && d.y > 0.0) {
    vec3 p = d * 190.0; vec3 ip = floor(p); vec3 fp = fract(p) - 0.5;
    float hs = hash3(ip);
    float s = step(0.988, hs) * smoothstep(0.32, 0.0, length(fp));
    col += vec3(0.9, 0.95, 1.0) * s * (0.6 + 0.4 * sin(uTime * 2.5 + hs * 90.0)) * uStars * 1.6;
  }
  // clouds
  if (d.y > -0.02) {
    vec2 cuv = d.xz / (d.y + 0.2) + uTime * vec2(0.006, 0.002);
    float c = texture2D(uNoise, cuv * 0.09).r * 0.56 + texture2D(uNoise, cuv * 0.23 + 0.37).g * 0.30 + texture2D(uNoise, cuv * 0.71).a * 0.14;
    float lo = mix(0.74, 0.16, uCover);
    float dens = smoothstep(lo, lo + 0.26, c) * smoothstep(-0.01, 0.13, d.y);
    float c2 = texture2D(uNoise, cuv * 0.09 + uSunDir.xz * 0.02).r;
    float shade = clamp(0.55 + (c - c2) * 5.0, 0.0, 1.0);
    vec3 cc = mix(uCloudDark, uCloudLit, shade * (1.0 - dens * 0.55));
    cc += uSunColor * pow(sd, 10.0) * 0.5 * (1.0 - dens) * uSunDisc;
    col = mix(col, cc, dens * 0.96);
  }
  col += vec3(0.7, 0.75, 1.0) * uFlash * 0.6;
  gl_FragColor = vec4(col, 1.0);
}`;

const RAIN_VERT = /* glsl */`
uniform vec3 uCam; uniform float uTime, uRain;
attribute float aEnd; attribute float aSeed;
varying float vA;
void main(){
  vec3 p = position;
  p.y = mod(p.y - uTime * (21.0 + aSeed * 9.0), 30.0);
  p.xz = mod(p.xz - uCam.xz, 44.0) - 22.0;
  vec3 wp = vec3(uCam.x + p.x, uCam.y - 9.0 + p.y, uCam.z + p.z);
  wp.y += aEnd * (0.7 + aSeed * 0.5);
  wp.x += aEnd * 0.16;
  vA = step(aSeed, uRain) * 0.42 * (1.0 - aEnd * 0.6);
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`;
const RAIN_FRAG = /* glsl */`
uniform vec3 uColor; varying float vA;
void main(){ if (vA < 0.01) discard; gl_FragColor = vec4(uColor, vA); }`;

const FLY_VERT = /* glsl */`
uniform vec3 uCam; uniform float uTime, uNight; uniform sampler2D uHeight;
attribute float aSeed; varying float vA;
${GLSL_HUV}
void main(){
  vec3 p = position;
  p.xz = mod(p.xz - uCam.xz, 60.0) - 30.0;
  vec2 w = uCam.xz + p.xz;
  w += vec2(sin(uTime * 0.6 + aSeed * 40.0), cos(uTime * 0.5 + aSeed * 31.0)) * 1.4;
  float h = texture2D(uHeight, huv(w)).r;
  float y = max(h, 0.0) + 0.5 + aSeed * 2.6 + sin(uTime * 0.9 + aSeed * 60.0) * 0.4;
  vec4 mv = viewMatrix * vec4(w.x, y, w.y, 1.0);
  gl_Position = projectionMatrix * mv;
  float blink = smoothstep(0.2, 1.0, sin(uTime * (1.5 + aSeed * 2.0) + aSeed * 100.0));
  vA = blink * uNight * smoothstep(30.0, 20.0, length(p.xz)) * step(0.3, h);
  gl_PointSize = (46.0 + aSeed * 34.0) / max(-mv.z, 1.0);
}`;
const FLY_FRAG = /* glsl */`
varying float vA;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d) * vA;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vec3(0.75, 1.0, 0.35) * 2.0, a);
}`;

export class Env {
  constructor(scene) {
    this.scene = scene;
    this.hour = 6.4;
    this.dayRate = 1 / 55;       // game hours per real second
    this.frozen = false;
    this.rain = 0; this.rainTarget = 0;
    this.flash = 0; this.nextFlash = 6;
    this.wet = 0;
    this.sunDir = new THREE.Vector3(1, 0.3, 0).normalize();
    this.moonDir = new THREE.Vector3(0.3, 0.8, -0.4).normalize();
    this.lightDir = new THREE.Vector3(1, 1, 0).normalize();
    this.night = 0;
    const q = QUALITY[G.quality];

    scene.fog = new THREE.FogExp2(0x9fb8cc, 0.001);
    this.hemi = new THREE.HemisphereLight(0xb0c8e8, 0x3a3524, 1);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(q.shadow, q.shadow);
    const sc = this.sun.shadow.camera;
    sc.left = -62; sc.right = 62; sc.top = 62; sc.bottom = -62; sc.near = 1; sc.far = 420;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.09;
    scene.add(this.sun); scene.add(this.sun.target);

    // shared uniforms for custom shaders (grass, water)
    this.u = {
      uTime: { value: 0 },
      uCam: { value: new THREE.Vector3() },
      uSunDir: { value: this.lightDir },
      uSunCol: { value: new THREE.Color() },   // already divided by PI
      uAmb: { value: new THREE.Color() },      // already divided by PI
      uFogCol: { value: scene.fog.color },
      uFogDen: { value: 0.001 },
      uRain: { value: 0 },
      uZenith: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uWind: { value: 0.3 },
    };

    this.skyU = {
      uSunDir: { value: this.sunDir }, uMoonDir: { value: this.moonDir },
      uZenith: this.u.uZenith, uHorizon: this.u.uHorizon, uFog: { value: scene.fog.color },
      uSunColor: { value: new THREE.Color() }, uCloudLit: { value: new THREE.Color() }, uCloudDark: { value: new THREE.Color() },
      uCover: { value: 0.4 }, uTime: this.u.uTime, uStars: { value: 0 }, uSunDisc: { value: 1 }, uFlash: { value: 0 },
      uNoise: { value: TEX.noise },
    };
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(1, 32, 16),
      new THREE.ShaderMaterial({ uniforms: this.skyU, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false })
    );
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    this.sky.onBeforeRender = (r, s, cam) => { this.sky.position.copy(cam.position); this.sky.updateMatrixWorld(); };
    scene.add(this.sky);

    // rain streaks
    {
      const n = q.rain, rng = makeRng(77);
      const pos = new Float32Array(n * 6), end = new Float32Array(n * 2), seed = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) {
        const x = rng() * 44, y = rng() * 30, z = rng() * 44, s = rng();
        pos.set([x, y, z, x, y, z], i * 6);
        end[i * 2] = 0; end[i * 2 + 1] = 1; seed[i * 2] = seed[i * 2 + 1] = s;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
      g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
      this.rainU = { uCam: this.u.uCam, uTime: this.u.uTime, uRain: this.u.uRain, uColor: { value: new THREE.Color(0.7, 0.78, 0.85) } };
      this.rainMesh = new THREE.LineSegments(g, new THREE.ShaderMaterial({ uniforms: this.rainU, vertexShader: RAIN_VERT, fragmentShader: RAIN_FRAG, transparent: true, depthWrite: false, fog: false }));
      this.rainMesh.frustumCulled = false; this.rainMesh.layers.set(1); this.rainMesh.renderOrder = 5;
      scene.add(this.rainMesh);
    }
    // fireflies
    {
      const n = 320, rng = makeRng(99);
      const pos = new Float32Array(n * 3), seed = new Float32Array(n);
      for (let i = 0; i < n; i++) { pos[i * 3] = rng() * 60; pos[i * 3 + 2] = rng() * 60; seed[i] = rng(); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
      this.flyU = { uCam: this.u.uCam, uTime: this.u.uTime, uNight: { value: 0 }, uHeight: { value: heightTex } };
      this.flies = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: this.flyU, vertexShader: FLY_VERT, fragmentShader: FLY_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      this.flies.frustumCulled = false; this.flies.layers.set(1);
      scene.add(this.flies);
    }
    this._c = { zen: new THREE.Color(), hor: new THREE.Color(), sun: new THREE.Color(), hemi: new THREE.Color(), fog: new THREE.Color(), grey: new THREE.Color() };
    this.sunI = 3; this.hemiI = 1; this.dayLight = 1;
  }

  setTime(h) { this.hour = ((h % 24) + 24) % 24; }
  setRain(v, instant = false) { this.rainTarget = v; if (instant) { this.rain = v; this.wet = v; } }

  update(dt, camera, focus) {
    if (!this.frozen) this.hour = (this.hour + dt * this.dayRate) % 24;
    const h = this.hour;
    this.rain = damp(this.rain, this.rainTarget, 0.25, dt);
    if (Math.abs(this.rain - this.rainTarget) < 0.01) this.rain = this.rainTarget;
    this.wet = this.rain > this.wet ? damp(this.wet, this.rain, 0.5, dt) : damp(this.wet, this.rain, 0.03, dt);
    const rain = this.rain;

    // interpolate keys
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].t <= h) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const t = clamp((h - a.t) / (b.t - a.t), 0, 1);
    const c = this._c;
    c.zen.copy(a.zen).lerp(b.zen, t); c.hor.copy(a.hor).lerp(b.hor, t);
    c.sun.copy(a.sun).lerp(b.sun, t); c.hemi.copy(a.hemi).lerp(b.hemi, t); c.fog.copy(a.fog).lerp(b.fog, t);
    let sunI = lerp(a.sunI, b.sunI, t), hemiI = lerp(a.hemiI, b.hemiI, t), fogD = lerp(a.fogD, b.fogD, t);

    // celestial directions
    const ang = (h - 6) / 12.75 * Math.PI;
    this.sunDir.set(Math.cos(ang), Math.sin(ang) * 0.92, 0.3 * Math.sin(ang) + 0.08).normalize();
    const np = (((h - 19) % 24) + 24) % 24 / 11;
    const ma = lerp(0.28, 0.72, clamp(np, 0, 1)) * Math.PI;
    this.moonDir.set(Math.cos(ma) * 0.7, Math.sin(ma) * 0.75 + 0.2, -0.45).normalize();
    const sunUp = this.sunDir.y > -0.02;
    if (sunUp) { this.lightDir.copy(this.sunDir); this.lightDir.y = Math.max(this.lightDir.y, 0.07); this.lightDir.normalize(); sunI *= smoothstep(-0.02, 0.09, this.sunDir.y); }
    else { this.lightDir.copy(this.moonDir); sunI *= smoothstep(-0.02, 0.09, -this.sunDir.y); }
    const day = smoothstep(-0.08, 0.15, this.sunDir.y);
    this.night = 1 - day;
    this.dayLight = day;

    // weather: overcast greys everything
    const lum = (c.zen.r + c.zen.g + c.zen.b) / 3 + (c.hor.r + c.hor.g + c.hor.b) / 6;
    c.grey.setRGB(lum * 0.82, lum * 0.9, lum * 0.98);
    c.zen.lerp(c.grey, rain * 0.85); c.hor.lerp(c.grey, rain * 0.8); c.fog.lerp(c.grey, rain * 0.85);
    sunI *= 1 - rain * 0.8; hemiI *= 1 - rain * 0.25;
    fogD = lerp(fogD, 0.0048, rain * 0.85);

    // lightning
    if (rain > 0.7) {
      this.nextFlash -= dt;
      if (this.nextFlash <= 0) {
        this.nextFlash = 7 + Math.random() * 16;
        this.flash = 1;
        G.audio?.thunder(0.6 + Math.random() * 2.2);
      }
    }
    this.flash = Math.max(0, this.flash - dt * (this.flash > 0.5 ? 9 : 2.2));
    const fl = this.flash * (0.6 + 0.4 * Math.sin(G.time * 70));

    // apply
    this.sunI = sunI; this.hemiI = hemiI;
    this.sun.color.copy(c.sun); this.sun.intensity = sunI;
    this.hemi.color.copy(c.hemi); this.hemi.intensity = hemiI * (1 + fl * 5);
    this.hemi.groundColor.copy(c.hemi).multiplyScalar(0.28).lerp(new THREE.Color(0.12, 0.09, 0.05), 0.4);
    this.scene.fog.color.copy(c.fog);
    this.scene.fog.density = fogD;
    this.sun.target.position.set(Math.round(focus.x / 2) * 2, focus.y, Math.round(focus.z / 2) * 2);
    this.sun.position.copy(this.sun.target.position).addScaledVector(this.lightDir, 200);

    const u = this.u;
    u.uTime.value = G.time;
    u.uCam.value.copy(camera.position);
    u.uSunCol.value.copy(c.sun).multiplyScalar(sunI / Math.PI);
    u.uAmb.value.copy(c.hemi).multiplyScalar(hemiI * (1 + fl * 5) / Math.PI);
    u.uFogDen.value = fogD;
    u.uRain.value = rain;
    u.uZenith.value.copy(c.zen); u.uHorizon.value.copy(c.hor);
    u.uWind.value = 0.3 + rain * 0.9;

    const s = this.skyU;
    s.uSunColor.value.copy(c.sun).multiplyScalar(sunUp ? Math.max(sunI, 0.3) : 0);
    s.uSunDisc.value = sunUp ? (1 - rain * 0.9) : 0;
    s.uStars.value = this.night * (1 - rain * 0.9);
    s.uCover.value = lerp(0.42, 1.0, rain);
    s.uFlash.value = fl;
    const litK = sunUp ? sunI * 0.27 : 0.035;
    s.uCloudLit.value.copy(c.sun).multiplyScalar(litK).add(c.zen.clone().multiplyScalar(0.45)).multiplyScalar(1 - rain * 0.45);
    s.uCloudDark.value.copy(s.uCloudLit.value).multiplyScalar(0.42).lerp(c.fog, 0.25);
    this.sky.scale.setScalar(camera.far * 0.9);

    terrainU.uWet.value = this.wet;
    this.rainMesh.visible = rain > 0.02;
    this.rainU.uColor.value.setRGB(0.55, 0.62, 0.7).multiplyScalar(0.25 + day * 0.9 + fl * 2);
    this.flyU.uNight.value = this.night * (1 - rain);
    this.flies.visible = this.night > 0.05;
  }

  // sun position in screen uv (for god rays); returns strength 0..1
  sunScreen(camera, out) {
    const v = new THREE.Vector3().copy(camera.position).addScaledVector(this.sunDir, 1000).project(camera);
    out.set(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5);
    const fwd = camera.getWorldDirection(new THREE.Vector3());
    const facing = smoothstep(0.25, 0.8, fwd.dot(this.sunDir));
    return facing * this.dayLight * (1 - this.rain) * smoothstep(-0.02, 0.05, this.sunDir.y) * (v.z < 1 ? 1 : 0);
  }
}
