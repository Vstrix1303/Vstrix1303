// Sky, sun & moon, stars, time of day, cascaded shadows, image-based light
// re-baked from the sky, and atmospheric fog / morning mist.
import * as THREE from 'three/webgpu';
import {
  Fn, uniform, vec3, vec4, float, positionWorld, cameraPosition, length, exp, smoothstep, mix, clamp, max, normalize,
  dot, pow, fog, positionLocal, texture, uv, attribute, sin, time as tslTime,
} from 'three/tsl';
import { SkyMesh } from 'three/addons/objects/SkyMesh.js';
import { CSMShadowNode } from 'three/addons/csm/CSMShadowNode.js';
import { G, U } from '../state.js';
import { makeRng } from '../world/noise.js';

const C = (h) => new THREE.Color(h);
// hour → [sun light colour, sun intensity, ambient (hemi) intensity, fog colour, fog density, mist, exposure]
const KEYS = [
  [0, C('#8aa0d8'), 0.6, 0.28, C('#0d1424'), 0.00005, 0.15, 1.25],
  [4.6, C('#8aa0d8'), 0.55, 0.26, C('#121a2c'), 0.00006, 0.3, 1.25],
  [5.6, C('#ff9e6e'), 0.6, 0.3, C('#6e6470'), 0.00009, 0.55, 0.85],
  [6.4, C('#ffa860'), 2.6, 0.42, C('#c49470'), 0.00008, 0.45, 0.72],
  [7.6, C('#ffd8a8'), 3.4, 0.55, C('#ccc0a8'), 0.00006, 0.28, 0.7],
  [10, C('#fff2dc'), 4.0, 0.6, C('#c4ccd0'), 0.000045, 0.12, 0.66],
  [14, C('#fff4e0'), 4.1, 0.6, C('#c2cad0'), 0.00004, 0.0, 0.66],
  [16.5, C('#ffe2b0'), 3.6, 0.58, C('#d6ccb2'), 0.000045, 0.0, 0.68],
  [17.6, C('#ffb060'), 3.2, 0.48, C('#e6ae80'), 0.00006, 0.1, 0.74],
  [18.4, C('#ff8a4a'), 1.6, 0.35, C('#c98a6a'), 0.00008, 0.25, 0.8],
  [19.1, C('#8aa0d8'), 0.35, 0.22, C('#2c2a3c'), 0.00007, 0.2, 1.1],
  [20, C('#8aa0d8'), 0.6, 0.28, C('#0d1424'), 0.00005, 0.15, 1.25],
  [24, C('#8aa0d8'), 0.6, 0.28, C('#0d1424'), 0.00005, 0.15, 1.25],
];
function sample(h) {
  let a = KEYS[0], b = KEYS[1];
  for (let i = 0; i < KEYS.length - 1; i++) if (h >= KEYS[i][0] && h <= KEYS[i + 1][0]) { a = KEYS[i]; b = KEYS[i + 1]; break; }
  const t = (h - a[0]) / Math.max(1e-4, b[0] - a[0]);
  const s = t * t * (3 - 2 * t);
  return {
    sunCol: a[1].clone().lerp(b[1], s), sunI: a[2] + (b[2] - a[2]) * s, amb: a[3] + (b[3] - a[3]) * s,
    fog: a[4].clone().lerp(b[4], s), fogD: a[5] + (b[5] - a[5]) * s, mist: a[6] + (b[6] - a[6]) * s, exp: a[7] + (b[7] - a[7]) * s,
  };
}

export class Sky {
  constructor(scene, renderer, camera) {
    this.scene = scene; this.renderer = renderer; this.camera = camera;
    this.sky = new SkyMesh();
    this.sky.scale.setScalar(40000);
    this.sky.turbidity.value = 2.4;
    this.sky.rayleigh.value = 1.15;
    this.sky.mieCoefficient.value = 0.0025;
    this.sky.mieDirectionalG.value = 0.76;
    this.sky.cloudCoverage.value = 0.38;
    this.sky.cloudDensity.value = 0.5;
    this.sky.cloudScale.value = 0.00022;
    this.sky.frustumCulled = false;
    scene.add(this.sky);
    // monsoon overcast: blend the physical sky towards a low grey ceiling
    const overcast = (mesh) => {
      const base = mesh.material.colorNode;
      const dy = normalize(positionWorld.sub(cameraPosition)).y;
      const grey = mix(vec3(0.16, 0.175, 0.19), vec3(0.06, 0.068, 0.078), smoothstep(0.0, 0.5, dy)).mul(float(1).sub(U.storm.mul(0.35)));
      const k = U.cloud.mul(mix(float(0.88), float(0.98), smoothstep(-0.05, 0.4, dy))).mul(smoothstep(0.15, 0.6, U.cloud).mul(0.7).add(0.3));
      mesh.material.colorNode = vec4(mix(base.xyz, grey.mul(base.xyz.length().mul(0.25).add(0.75)).min(base.xyz.add(grey)), k), 1);
    };
    overcast(this.sky);
    this.overcast = overcast;

    // Night dome (stars + soft moonlit gradient), additive over the sky.
    this.night = this.makeNight();
    scene.add(this.night);
    this.moon = this.makeMoon();
    scene.add(this.moon);

    // Lights
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = G.Q.shadows;
    this.sun.shadow.mapSize.setScalar(G.Q.shadowMap);
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.normalBias = 0.35;
    this.sun.shadow.radius = 2;
    this.sun.shadow.camera.near = 1; this.sun.shadow.camera.far = 6000;
    scene.add(this.sun, this.sun.target);
    if (G.Q.shadows && (G.Q.cascades <= 1 || G.Q.csm === false)) {
      // one plain shadow map following the player: the cheapest option (Low / Laptop)
      const r = G.Q.shadowFar / 2, cam = this.sun.shadow.camera;
      cam.left = -r; cam.right = r; cam.top = r; cam.bottom = -r; cam.near = 1; cam.far = 5000; cam.updateProjectionMatrix();
      this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.6;
    } else if (G.Q.shadows) {
      this.csm = new CSMShadowNode(this.sun, { cascades: G.Q.cascades, maxFar: G.Q.shadowFar, mode: 'practical', lightMargin: 500 });
      this.csm.fade = true;
      this.sun.shadow.shadowNode = this.csm;
    }
    this.hemi = new THREE.HemisphereLight(0xbfd4ff, 0x3a3020, 0.4);
    scene.add(this.hemi);

    // Environment (IBL) from a sky-only scene
    this.envScene = new THREE.Scene();
    this.envSky = new SkyMesh();
    for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG', 'sunPosition']) this.envSky[k] = this.sky[k];
    this.envSky.cloudCoverage.value = 0; this.envSky.showSunDisc.value = 0;
    this.envSky.scale.setScalar(1000);
    this.overcast(this.envSky);
    this.envScene.add(this.envSky);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(900, 16, 8), new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, color: 0x0b1222 }));
    this.envNight = glow.material;
    this.envNight.transparent = true; this.envNight.blending = THREE.AdditiveBlending; this.envNight.depthWrite = false;
    this.envScene.add(glow);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envTarget = null;
    this.lastEnvHour = -99;

    // Fog: distance haze thickening into low mist near the water at dawn
    scene.fogNode = fog(U.fogColor, Fn(() => {
      const d = length(positionWorld.sub(cameraPosition));
      const hgt = max(positionWorld.y, 0);
      const haze = float(1).sub(exp(d.mul(U.fogDensity).negate()));
      const mist = float(1).sub(exp(d.mul(0.0022).negate())).mul(exp(hgt.mul(-0.14))).mul(U.mist).mul(0.6);
      return clamp(max(haze, mist), 0, 1);
    })());

    this.sunDir = new THREE.Vector3();
    this.setHour(G.hour, true);
  }

  makeNight() {
    const rnd = makeRng(7);
    const n = 4000, pos = new Float32Array(n * 3), size = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = rnd() * 2 - 1, t = rnd() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      const y = Math.abs(u) * 0.98 + 0.02;
      pos[i * 3] = r * Math.cos(t) * 30000; pos[i * 3 + 1] = y * 30000; pos[i * 3 + 2] = r * Math.sin(t) * 30000;
      size[i] = Math.pow(rnd(), 6) * 3 + 0.6;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('size', new THREE.BufferAttribute(size, 1));
    const m = new THREE.PointsNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: false });
    const tw = sin(tslTime.mul(2).add(positionLocal.x.mul(0.01))).mul(0.3).add(0.7);
    m.colorNode = vec4(vec3(0.85, 0.9, 1.0).mul(U.night).mul(tw), 1);
    m.sizeNode = attribute('size').mul(2.2);
    m.fog = false;
    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false; pts.renderOrder = -1;
    const dm = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const ny = normalize(positionLocal).y;
    dm.colorNode = vec4(mix(vec3(0.035, 0.05, 0.095), vec3(0.006, 0.012, 0.035), smoothstep(0.0, 0.6, ny)).mul(U.night), 1);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(31000, 32, 16), dm);
    dome.frustumCulled = false; dome.renderOrder = -2;
    pts.add(dome);

    return pts;
  }

  makeMoon() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(128, 128, 30, 128, 128, 128);
    gr.addColorStop(0, 'rgba(255,250,235,1)'); gr.addColorStop(0.36, 'rgba(255,248,230,1)'); gr.addColorStop(0.4, 'rgba(200,210,255,0.35)'); gr.addColorStop(1, 'rgba(120,140,220,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
    x.globalAlpha = 0.12; x.fillStyle = '#7a7466';
    for (const [a, b, r] of [[110, 110, 14], [150, 135, 10], [125, 150, 8], [138, 100, 6]]) { x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.SpriteNodeMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    m.colorNode = texture(t, uv()).mul(U.night.mul(4));
    const s = new THREE.Sprite(m);
    s.scale.setScalar(2200);
    s.renderOrder = -1;
    return s;
  }

  setHour(h, force = false) {
    G.hour = ((h % 24) + 24) % 24;
    const hr = G.hour;
    // Sun rises in the east (+x, over the Ghats) and sets over the Arabian Sea (−x).
    const a = ((hr - 6) / 12) * Math.PI;           // 0 at sunrise, π at sunset
    const elev = Math.sin(a) * 1.25;               // tropical: high noon
    const sd = this.sunDir.set(Math.cos(a), Math.max(-1, elev), 0.32).normalize();
    this.sky.sunPosition.value.copy(sd);
    const k = sample(hr);
    const nightF = THREE.MathUtils.smoothstep(-sd.y, -0.02, 0.18);
    U.night.value = nightF;
    // Moon roughly opposite the sun
    const md = new THREE.Vector3(-sd.x, Math.abs(sd.y) * 0.9 + 0.25, -0.35).normalize();
    this.moonDir = md;
    const lightDir = nightF > 0.5 ? md : sd;
    U.sunDir.value.copy(lightDir);
    this.sun.position.copy(lightDir).multiplyScalar(2000).add(G.focus);
    this.sun.target.position.copy(G.focus);
    this.sun.color.copy(k.sunCol);
    this.sun.intensity = k.sunI;
    U.sunColor.value.copy(k.sunCol).multiplyScalar(k.sunI / 3);
    this.hemi.intensity = k.amb * (nightF > 0.5 ? 0.9 : 0.24);
    this.hemi.color.set(nightF > 0.5 ? 0x5a6fa8 : 0xe8eef8);
    this.hemi.groundColor.set(nightF > 0.5 ? 0x0c0e14 : 0x4a3a24);
    U.fogColor.value.copy(k.fog);
    U.fogDensity.value = k.fogD;
    U.mist.value = k.mist;
    this.exposure = k.exp;
    this.base = { sunI: k.sunI, hemi: this.hemi.intensity, fog: k.fog.clone(), fogD: k.fogD, mist: k.mist, exp: k.exp };
    this.applyWeather();
    this.envNight.color.setRGB(0.03 * nightF, 0.05 * nightF, 0.11 * nightF);
    if (force || Math.abs(hr - this.lastEnvHour) > 0.25) this.bakeEnv();
  }

  bakeEnv() {
    this.lastEnvHour = G.hour;
    this.lastEnvCloud = U.cloud.value;
    const old = this.envTarget;
    this.envTarget = this.pmrem.fromScene(this.envScene, 0, 1, 2000);
    this.scene.environment = this.envTarget.texture;
    this.scene.environmentIntensity = (0.5 - 0.06 * (1 - U.night.value)) * (1 - 0.3 * U.cloud.value) + 0.12 * U.cloud.value;
    if (old && !location.search.includes('nobake')) old.dispose();
  }

  // Monsoon modifiers on top of the hour's lighting (weather.js sets this.wx).
  applyWeather() {
    const w = this.wx || { cloud: 0, rain: 0, storm: 0, flash: 0 };
    const b = this.base; if (!b) return;
    const dim = 1 - 0.72 * w.cloud - 0.15 * w.storm;
    this.sun.intensity = b.sunI * dim;
    U.sunColor.value.copy(this.sun.color).multiplyScalar(this.sun.intensity / 3);
    this.hemi.intensity = b.hemi * (1 + 0.6 * w.cloud) + w.flash * 6;
    const grey = new THREE.Color(0x5c6268).multiplyScalar((1 - U.night.value * 0.85) * (1 - 0.3 * w.storm));
    U.fogColor.value.copy(b.fog).lerp(grey, 0.75 * w.cloud);
    U.fogDensity.value = b.fogD * (1 + 2.5 * w.rain + 2 * w.storm);
    U.mist.value = Math.max(b.mist, 0.35 * w.rain);
    this.exposure = b.exp * (1 + 0.15 * w.cloud) * (1 + w.flash * 1.5);
    this.sky.cloudCoverage.value = 0.38 + 0.55 * w.cloud;
    this.sky.cloudDensity.value = 0.5 + 0.45 * w.cloud;
    this.sky.turbidity.value = 2.4 + 6 * w.cloud;
  }

  update(dt) {
    if (Math.abs(U.cloud.value - (this.lastEnvCloud ?? 0)) > 0.08) this.bakeEnv();
    if (G.timeScale > 0) this.setHour(G.hour + dt * G.timeScale);
    else {
      this.applyWeather(); this.sun.position.copy(U.sunDir.value).multiplyScalar(2000).add(G.focus); this.sun.target.position.copy(G.focus); }
    this.night.position.copy(this.camera.position);
    this.moon.position.copy(this.moonDir).multiplyScalar(26000).add(this.camera.position);
  }
}
