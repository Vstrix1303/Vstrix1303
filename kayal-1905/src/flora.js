// Coconut palms, jungle trees, banana plants, pepper vines, grass & lotus.
import * as THREE from 'three';
import { G, QUALITY } from './state.js';
import { GB } from './geo.js';
import { TEX } from './textures.js';
import { makeRng, fbm, clamp, lerp, TAU, smoothstep } from './util.js';
import { WORLD, HALF, LOC, getHeight, getSlope, canalZ } from './heightfield.js';
import { maskAt, heightTex, maskTex, GLSL_HUV } from './terrain.js';
import { addCircle, pointInBox } from './physics.js';

let windU = null;

function foliageMaterial(map, sway, alphaTest = 0.35) {
  const m = new THREE.MeshStandardMaterial({ map, alphaTest, side: THREE.DoubleSide, roughness: 0.78, metalness: 0, vertexColors: true });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = windU.uTime; sh.uniforms.uWind = windU.uWind;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ipos = instanceMatrix[3].xyz;
        #else
          vec3 ipos = vec3(0.0);
        #endif
        float ph = ipos.x * 0.31 + ipos.z * 0.23;
        ${sway}`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize(vNormal);');
  };
  return m;
}

// ---------------------------------------------------------------- palms
function palmGeo(rng, o) {
  const trunk = new GB(), fr = new GB();
  const H = o.height, ld = o.leanDir ?? rng() * TAU, lean = o.lean;
  const lx = Math.cos(ld) * lean, lz = Math.sin(ld) * lean;
  const path = (t) => [lx * t * t, H * t, lz * t * t];
  const tc = o.trunkCol || [1, 1, 1];
  trunk.tube(path, (t) => o.trunkR * (1 + 0.7 * (1 - smoothstep(0, 0.1, t))) * (1 - 0.32 * t), 6, 5, H / 1.6, tc, 2);
  const T = path(1);
  // crown bulge
  const n = o.fronds;
  for (let i = 0; i < n; i++) {
    const az = i * 2.39996 + rng() * 0.4;
    const age = i / (n - 1);
    const pitch0 = lerp(1.3, -0.45, Math.pow(age, 0.85));
    const L = o.frondLen * (0.82 + rng() * 0.3);
    const droop = lerp(0.8, 1.5, rng());
    const hw = o.frondW, seg = 5, fold = 0.5;
    const side = [-Math.sin(az), 0, Math.cos(az)];
    let px = T[0], py = T[1] - 0.1, pz = T[2];
    const shade = 0.72 + 0.28 * (1 - age) + rng() * 0.1;
    const col = age > 0.86 && rng() > 0.4 ? [0.95, 0.78, 0.4] : [shade, shade, shade * 0.95];
    const ring = [];
    for (let s = 0; s <= seg; s++) {
      const tt = s / seg;
      const pitch = pitch0 - droop * tt * tt;
      const d = [Math.cos(az) * Math.cos(pitch), Math.sin(pitch), Math.sin(az) * Math.cos(pitch)];
      // up = side x d
      const up = [side[1] * d[2] - side[2] * d[1], side[2] * d[0] - side[0] * d[2], side[0] * d[1] - side[1] * d[0]];
      const nx = up[0] * 0.6, ny = up[1] * 0.6 + 0.6, nz = up[2] * 0.6;
      const nl = Math.hypot(nx, ny, nz) || 1;
      const cf = Math.cos(fold) * hw, sf = Math.sin(fold) * hw;
      const Lv = fr.vert(px + side[0] * cf - up[0] * sf, py + side[1] * cf - up[1] * sf, pz + side[2] * cf - up[2] * sf, nx / nl, ny / nl, nz / nl, tt, 0, ...col);
      const Mv = fr.vert(px, py, pz, nx / nl, ny / nl, nz / nl, tt, 0.5, ...col);
      const Rv = fr.vert(px - side[0] * cf - up[0] * sf, py - side[1] * cf - up[1] * sf, pz - side[2] * cf - up[2] * sf, nx / nl, ny / nl, nz / nl, tt, 1, ...col);
      ring.push([Lv, Mv, Rv]);
      px += d[0] * L / seg; py += d[1] * L / seg; pz += d[2] * L / seg;
    }
    for (let s = 0; s < seg; s++) {
      const a = ring[s], b = ring[s + 1];
      fr.quad(a[1], a[0], b[0], b[1]);
      fr.quad(a[2], a[1], b[1], b[2]);
    }
  }
  // coconuts
  if (o.nuts) {
    const ico = new THREE.IcosahedronGeometry(0.16, 0);
    for (let i = 0; i < o.nuts; i++) {
      const a = rng() * TAU, r = 0.24 + rng() * 0.1;
      const m = new THREE.Matrix4().makeTranslation(T[0] + Math.cos(a) * r, T[1] - 0.35 - rng() * 0.25, T[2] + Math.sin(a) * r);
      trunk.add(ico, m, rng() > 0.5 ? [0.55, 0.75, 0.25] : [0.8, 0.62, 0.3], [0.05, 0.05]);
    }
  }
  // pepper vine wrapped around the trunk
  if (o.vine) {
    for (let i = 0; i < 16; i++) {
      const t = 0.06 + (i / 16) * 0.55, c = path(t), a = rng() * TAU;
      const s = 0.55 + rng() * 0.3, r = o.trunkR + 0.12;
      const cx = c[0] + Math.cos(a) * r, cz = c[2] + Math.sin(a) * r;
      const nx = Math.cos(a), nz = Math.sin(a);
      const tx = -nz, tz = nx;
      const col = [0.55, 0.75, 0.5];
      // quad facing outward, reuse the frond atlas' dense middle region
      const v0 = fr.vert(cx - tx * s, c[1] - s, cz - tz * s, nx, 0.3, nz, 0.3, 0.2, ...col);
      const v1 = fr.vert(cx + tx * s, c[1] - s, cz + tz * s, nx, 0.3, nz, 0.55, 0.2, ...col);
      const v2 = fr.vert(cx + tx * s, c[1] + s, cz + tz * s, nx, 0.3, nz, 0.55, 0.8, ...col);
      const v3 = fr.vert(cx - tx * s, c[1] + s, cz - tz * s, nx, 0.3, nz, 0.3, 0.8, ...col);
      fr.quad(v0, v1, v2, v3);
    }
  }
  return { trunk: trunk.build(), fronds: fr.build(), top: T };
}

// ---------------------------------------------------------------- broadleaf
function treeGeo(rng, o) {
  const trunk = new GB(), leaf = new GB();
  const H = o.height, R = o.canopy;
  const bend = [(rng() - 0.5) * 1.2, (rng() - 0.5) * 1.2];
  const path = (t) => [bend[0] * t * t, H * t, bend[1] * t * t];
  trunk.tube(path, (t) => o.trunkR * (1.5 - 0.5 * smoothstep(0, 0.15, t)) * (1 - 0.45 * t), 5, 6, H / 2, [1, 1, 1], 2);
  const top = path(1);
  const centers = [[top[0], top[1] + R * 0.25, top[2], R]];
  const nb = o.branches ?? 3;
  for (let i = 0; i < nb; i++) {
    const a = i / nb * TAU + rng(), t0 = 0.5 + rng() * 0.3, s = path(t0);
    const len = R * (0.7 + rng() * 0.5);
    const e = [s[0] + Math.cos(a) * len, s[1] + len * 0.75, s[2] + Math.sin(a) * len];
    trunk.tube((t) => [lerp(s[0], e[0], t), lerp(s[1], e[1], t) + Math.sin(t * 3.14) * 0.3, lerp(s[2], e[2], t)], (t) => o.trunkR * 0.5 * (1 - 0.6 * t), 3, 5, len / 2, [1, 1, 1], 1);
    centers.push([e[0], e[1] + R * 0.1, e[2], R * 0.72]);
  }
  const cards = o.cards;
  const cc = [top[0], top[1], top[2]];
  for (let i = 0; i < cards; i++) {
    const c = centers[i % centers.length];
    // random direction, biased upward
    let dx = rng() * 2 - 1, dy = rng() * 1.5 - 0.45, dz = rng() * 2 - 1;
    const dl = Math.hypot(dx, dy, dz) || 1; dx /= dl; dy /= dl; dz /= dl;
    const rr = c[3] * (0.5 + rng() * 0.5);
    const px = c[0] + dx * rr, py = c[1] + dy * rr * 0.72, pz = c[2] + dz * rr;
    // card plane normal: outward-ish with jitter
    const nrm = new THREE.Vector3(dx + (rng() - 0.5) * 0.9, dy + (rng() - 0.5) * 0.9, dz + (rng() - 0.5) * 0.9).normalize();
    const tan = new THREE.Vector3().crossVectors(nrm, Math.abs(nrm.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize();
    const bit = new THREE.Vector3().crossVectors(nrm, tan);
    const s = c[3] * (0.58 + rng() * 0.32);
    // shading normal: from canopy centre outward, lifted up
    const sn = new THREE.Vector3(px - cc[0], py - cc[1] + R * 0.5, pz - cc[2]).normalize();
    const depth = clamp((py - (cc[1] - R * 0.6)) / (R * 1.6), 0, 1);
    const sh = 0.55 + 0.5 * depth + rng() * 0.1;
    const col = [sh * o.tint[0], sh * o.tint[1], sh * o.tint[2]];
    const q = [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]].map(([a, b, u, v]) =>
      leaf.vert(px + (tan.x * a + bit.x * b) * s, py + (tan.y * a + bit.y * b) * s, pz + (tan.z * a + bit.z * b) * s, sn.x, sn.y, sn.z, u, v, ...col));
    leaf.quad(q[0], q[1], q[2], q[3]);
  }
  return { trunk: trunk.build(), leaves: leaf.build() };
}

function bananaGeo(rng) {
  const g = new GB();
  g.tube((t) => [0, 2.1 * t, 0], (t) => 0.15 * (1 - 0.4 * t), 3, 6, 1, [0.62, 0.72, 0.36], 0.02);
  // tube uvs sit at the texture centre (midrib colour)
  for (let i = 0; i < g.uv.length; i += 2) { g.uv[i] = 0.5; g.uv[i + 1] = 0.5; }
  const n = 7;
  for (let i = 0; i < n; i++) {
    const az = i * 2.39996 + rng(), pitch0 = lerp(1.35, 0.35, i / n), L = 2.1 + rng() * 0.8, droop = 1.1 + rng() * 0.8, hw = 0.4, seg = 5;
    const side = [-Math.sin(az), 0, Math.cos(az)];
    let px = 0, py = 2.0, pz = 0;
    const ring = [];
    for (let s = 0; s <= seg; s++) {
      const tt = s / seg, pitch = pitch0 - droop * tt * tt;
      const d = [Math.cos(az) * Math.cos(pitch), Math.sin(pitch), Math.sin(az) * Math.cos(pitch)];
      const up = [side[1] * d[2] - side[2] * d[1], side[2] * d[0] - side[0] * d[2], side[0] * d[1] - side[1] * d[0]];
      const nl = Math.hypot(up[0], up[1] + 0.5, up[2]) || 1;
      const sh = 0.85 + rng() * 0.2;
      const a = g.vert(px + side[0] * hw, py, pz + side[2] * hw, up[0] / nl, (up[1] + 0.5) / nl, up[2] / nl, tt, 0, sh, sh, sh);
      const b = g.vert(px - side[0] * hw, py, pz - side[2] * hw, up[0] / nl, (up[1] + 0.5) / nl, up[2] / nl, tt, 1, sh, sh, sh);
      ring.push([a, b]);
      px += d[0] * L / seg; py += d[1] * L / seg; pz += d[2] * L / seg;
    }
    for (let s = 0; s < seg; s++) g.quad(ring[s][1], ring[s][0], ring[s + 1][0], ring[s + 1][1]);
  }
  return g.build();
}

// ---------------------------------------------------------------- instancing
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
export function addInstanced(scene, geo, mat, list, { cast = true, receive = true, chunk = 200 } = {}) {
  const buckets = new Map();
  for (const it of list) {
    const k = Math.floor((it.x + 4000) / chunk) * 1000 + Math.floor((it.z + 4000) / chunk);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(it);
  }
  const meshes = [];
  for (const arr of buckets.values()) {
    const im = new THREE.InstancedMesh(geo, mat, arr.length);
    arr.forEach((it, i) => {
      _e.set(it.rx || 0, it.ry || 0, it.rz || 0, 'YXZ');
      _q.setFromEuler(_e);
      const s = it.s ?? 1;
      _m4.compose(_v.set(it.x, it.y, it.z), _q, _s.set(s, it.sy ?? s, s));
      im.setMatrixAt(i, _m4);
      if (it.tint) im.setColorAt(i, _c.setRGB(it.tint[0], it.tint[1], it.tint[2]));
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = cast; im.receiveShadow = receive;
    im.computeBoundingSphere();
    im.matrixAutoUpdate = false;
    scene.add(im);
    meshes.push(im);
    (G.reflCull || (G.reflCull = [])).push(im);
  }
  return meshes;
}

// ---------------------------------------------------------------- grass
const GRASS_S = 72;
const GRASS_VERT = /* glsl */`
attribute vec3 aOff;
uniform vec3 uCam, uSunCol, uAmb, uSunDir; uniform float uTime, uWind, uWet, uFogDen;
uniform sampler2D uHeight, uMask, uNoise;
varying vec2 vUv; varying vec3 vCol; varying float vFog;
${GLSL_HUV}
vec3 SRGB(float r, float g, float b) { return pow(vec3(r, g, b), vec3(2.2)); }
void main(){
  const float S = ${GRASS_S.toFixed(1)};
  vec2 rel = mod(aOff.xy - uCam.xz, S) - S * 0.5;
  vec2 w = uCam.xz + rel;
  float seed = aOff.z;
  float h = texture2D(uHeight, huv(w)).r;
  vec3 m = texture2D(uMask, w / ${WORLD.toFixed(1)} + 0.5).rgb;
  float dist = length(rel);
  float sc = smoothstep(S * 0.5, S * 0.3, dist) * step(0.36, h) * (1.0 - smoothstep(0.15, 0.45, m.r)) * (1.0 - m.b * 0.85);
  sc *= 1.0 - smoothstep(55.0, 95.0, h);
  float paddy = m.g;
  float ht = mix(0.22, 0.62, fract(seed * 7.31)) * (1.0 + paddy * 0.55) * sc;
  float a = seed * 6.2831;
  vec3 lp = position;
  vec2 xz = vec2(lp.x * cos(a) - lp.z * sin(a), lp.x * sin(a) + lp.z * cos(a)) * sc * 0.72;
  float sway = (sin(uTime * 1.8 + w.x * 0.35 + w.y * 0.27) + 0.5 * sin(uTime * 3.3 + w.x * 0.9 + seed * 9.0)) * 0.13 * uWind * lp.y * lp.y;
  vec3 wp = vec3(w.x + xz.x + sway, h + lp.y * ht - 0.03, w.y + xz.y + sway * 0.6);
  float pn = texture2D(uNoise, w * 0.0071).g;
  float n3 = texture2D(uNoise, w * 0.11).a;
  vec3 base = mix(SRGB(0.20, 0.31, 0.13), SRGB(0.34, 0.42, 0.19), smoothstep(0.3, 0.7, pn));
  vec3 tip = base * 1.22 + SRGB(0.30, 0.32, 0.10) * 0.18;
  base = mix(base, SRGB(0.22, 0.34, 0.12), paddy); tip = mix(tip, SRGB(0.40, 0.52, 0.20), paddy);
  float dry = smoothstep(0.55, 0.8, texture2D(uNoise, w * 0.031).r);
  tip = mix(tip, SRGB(0.56, 0.52, 0.30), dry * 0.45 * (1.0 - paddy));
  vCol = mix(base * 0.8, tip, lp.y * lp.y) * (0.78 + 0.44 * n3) * (uAmb * 1.05 + uSunCol * (0.18 + 0.8 * max(uSunDir.y, 0.0))) * (1.0 - 0.25 * uWet);
  vUv = uv;
  vec4 mv = viewMatrix * vec4(wp, 1.0);
  float d = length(mv.xyz);
  vFog = 1.0 - exp(-uFogDen * uFogDen * d * d);
  gl_Position = projectionMatrix * mv;
}`;
const GRASS_FRAG = /* glsl */`
uniform sampler2D uTex; uniform vec3 uFogCol;
varying vec2 vUv; varying vec3 vCol; varying float vFog;
void main(){
  vec4 t = texture2D(uTex, vUv);
  if (t.a < 0.4) discard;
  gl_FragColor = vec4(mix(vCol * (0.55 + 0.45 * t.r), uFogCol, vFog), 1.0);
}`;

function buildGrass(scene, env) {
  const q = QUALITY[G.quality], n = q.grass, rng = makeRng(31);
  const base = new GB();
  for (const rot of [0, Math.PI / 2]) {
    const c = Math.cos(rot) * 0.5, s = Math.sin(rot) * 0.5;
    const a = base.vert(-c, 0, -s, 0, 1, 0, 0, 0), b = base.vert(c, 0, s, 0, 1, 0, 1, 0);
    const d = base.vert(c, 1, s, 0, 1, 0, 1, 1), e = base.vert(-c, 1, -s, 0, 1, 0, 0, 1);
    base.quad(a, b, d, e);
  }
  const bg = base.build(false);
  const g = new THREE.InstancedBufferGeometry();
  g.index = bg.index; g.setAttribute('position', bg.attributes.position); g.setAttribute('uv', bg.attributes.uv);
  const off = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { off[i * 3] = rng() * GRASS_S; off[i * 3 + 1] = rng() * GRASS_S; off[i * 3 + 2] = rng(); }
  g.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 3));
  g.instanceCount = n;
  const u = {
    uCam: env.u.uCam, uSunCol: env.u.uSunCol, uSunDir: env.u.uSunDir, uAmb: env.u.uAmb, uTime: env.u.uTime, uWind: env.u.uWind,
    uFogDen: env.u.uFogDen, uFogCol: env.u.uFogCol, uWet: { value: 0 },
    uHeight: { value: heightTex }, uMask: { value: maskTex }, uNoise: { value: TEX.noise }, uTex: { value: TEX.grass },
  };
  const mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: u, vertexShader: GRASS_VERT, fragmentShader: GRASS_FRAG, side: THREE.DoubleSide, fog: false }));
  mesh.frustumCulled = false;
  mesh.layers.set(1);
  scene.add(mesh);
  G.updaters.push(() => { u.uWet.value = env.wet; });
  return mesh;
}

// ---------------------------------------------------------------- placement
export function buildFlora(scene, env, keepClear, bigTrees = []) {
  windU = { uTime: env.u.uTime, uWind: env.u.uWind };
  const q = QUALITY[G.quality];
  const rng = makeRng(424242);
  const frondMat = foliageMaterial(TEX.frond, `
    float sw = uv.x * uv.x;
    transformed.y += sin(uTime * 1.5 + ph + position.x * 0.5) * 0.22 * sw * uWind;
    transformed.x += sin(uTime * 1.1 + ph * 1.3 + position.z) * 0.3 * sw * uWind;
    transformed.z += cos(uTime * 0.9 + ph) * 0.2 * sw * uWind;`);
  const leafMat = foliageMaterial(TEX.leaves, `
    float lw = sin(uTime * 1.3 + ph + position.y * 0.6) * 0.08 * uWind;
    transformed.x += lw + sin(uTime * 3.1 + position.z * 2.0) * 0.02 * uWind;
    transformed.z += lw * 0.7;`, 0.4);
  const bananaMat = foliageMaterial(TEX.banana, `
    float bw = uv.x * uv.x;
    transformed.y += sin(uTime * 1.7 + ph + position.x) * 0.1 * bw * uWind;`, 0.3);
  const palmBark = new THREE.MeshStandardMaterial({ map: TEX.palmBark, roughness: 0.95, vertexColors: true });
  const bark = new THREE.MeshStandardMaterial({ map: TEX.bark, roughness: 0.95, vertexColors: true });

  const blocked = (x, z, pad) => {
    if (pointInBox(x, z, pad)) return true;
    for (const k of keepClear) if (Math.hypot(x - k.x, z - k.z) < k.r) return true;
    if (maskAt(x, z, 0) > 0.25 || maskAt(x + 2.5, z, 0) > 0.4 || maskAt(x - 2.5, z, 0) > 0.4 || maskAt(x, z + 2.5, 0) > 0.4 || maskAt(x, z - 2.5, 0) > 0.4) return true;
    return false;
  };

  // --- coconut palms
  const variants = [
    palmGeo(rng, { height: 10.5, lean: 1.4, trunkR: 0.2, fronds: 13, frondLen: 4.6, frondW: 0.8, nuts: 3 }),
    palmGeo(rng, { height: 13.5, lean: 2.6, trunkR: 0.21, fronds: 14, frondLen: 4.9, frondW: 0.82, nuts: 4 }),
    palmGeo(rng, { height: 8.5, lean: 0.8, trunkR: 0.19, fronds: 12, frondLen: 4.3, frondW: 0.78, nuts: 3 }),
  ];
  const shoreVar = palmGeo(rng, { height: 11.5, lean: 4.6, leanDir: 0, trunkR: 0.2, fronds: 13, frondLen: 4.7, frondW: 0.8, nuts: 3 });
  const lists = [[], [], []], shoreList = [];
  const palmAt = (x, z, force = false) => {
    const h = getHeight(x, z);
    if (h < 0.55 || h > 26) return false;
    if (!force && blocked(x, z, 1.5)) return false;
    if (maskAt(x, z, 1) > 0.3) return false;
    const s = 0.82 + rng() * 0.4;
    const tint = [0.86 + rng() * 0.2, 0.9 + rng() * 0.15, 0.82 + rng() * 0.2];
    if (h < 1.5 && rng() < 0.6) {
      // lean out over the water
      const gx = getHeight(x + 3, z) - getHeight(x - 3, z), gz = getHeight(x, z + 3) - getHeight(x, z - 3);
      shoreList.push({ x, y: h - 0.15, z, ry: Math.atan2(gz, -gx), s, tint });
    } else lists[(rng() * 3) | 0].push({ x, y: h - 0.15, z, ry: rng() * TAU, s, tint });
    addCircle(x, z, 0.32);
    return true;
  };
  const nPalm = Math.round(7200 * q.treeScale);
  for (let i = 0; i < nPalm; i++) {
    const x = (rng() * 2 - 1) * 770, z = (rng() * 2 - 1) * 770;
    const h = getHeight(x, z);
    if (h < 0.55) continue;
    const clump = fbm(x * 0.012, z * 0.012, 2, 55);
    let p = smoothstep(0.38, 0.62, clump) * 0.5 + 0.06;
    p += smoothstep(3.0, 0.8, h) * 0.6;                 // shores and banks
    p *= 1 - smoothstep(8, 24, h);
    if (rng() < p) palmAt(x, z);
  }
  // rows along the canal and paddy bunds
  for (let x = -230; x < 170; x += 7 + rng() * 5) {
    palmAt(x + rng() * 2, canalZ(x) - 13 - rng() * 3);
    palmAt(x + rng() * 2, canalZ(x) + 13 + rng() * 3);
  }
  for (let i = 0; i < 70; i++) palmAt(-181 + ((rng() * 9) | 0) * 46.5 + (rng() - 0.5), 231 + rng() * 270, true);
  variants.forEach((v, i) => {
    addInstanced(scene, v.trunk, palmBark, lists[i]);
    addInstanced(scene, v.fronds, frondMat, lists[i]);
  });
  addInstanced(scene, shoreVar.trunk, palmBark, shoreList);
  addInstanced(scene, shoreVar.fronds, frondMat, shoreList);

  // --- pepper garden: areca poles wrapped in vines
  {
    const vine = palmGeo(rng, { height: 9, lean: 0.3, trunkR: 0.1, fronds: 9, frondLen: 2.1, frondW: 0.45, nuts: 0, vine: true, trunkCol: [0.75, 0.85, 0.7] });
    const list = [];
    for (let gx = -6; gx <= 6; gx++) for (let gz = -6; gz <= 6; gz++) {
      const x = LOC.pepper.x + gx * 6.2 + (rng() - 0.5) * 1.6, z = LOC.pepper.z + gz * 6.2 + (rng() - 0.5) * 1.6;
      if (Math.hypot(x - LOC.pepper.x, z - LOC.pepper.z) > 39 || blocked(x, z, 1)) continue;
      list.push({ x, y: getHeight(x, z) - 0.1, z, ry: rng() * TAU, s: 0.85 + rng() * 0.3 });
      addCircle(x, z, 0.2);
    }
    addInstanced(scene, vine.trunk, palmBark, list);
    addInstanced(scene, vine.fronds, frondMat, list);
  }

  // --- broadleaf trees
  const tv = [
    treeGeo(rng, { height: 5.2, canopy: 3.6, trunkR: 0.3, cards: 30, tint: [1, 1, 1] }),
    treeGeo(rng, { height: 9.5, canopy: 4.4, trunkR: 0.36, cards: 33, tint: [0.92, 1, 0.9] }),
    treeGeo(rng, { height: 13, canopy: 5.2, trunkR: 0.45, cards: 36, tint: [0.85, 0.95, 0.85], branches: 4 }),
  ];
  const tl = [[], [], []];
  const treeAt = (x, z, vi) => {
    const h = getHeight(x, z);
    if (h < 0.9 || blocked(x, z, 3) || maskAt(x, z, 1) > 0.2 || maskAt(x, z, 2) > 0.35) return;
    if (getSlope(x, z) > 0.95) return;
    const s = 0.8 + rng() * 0.5;
    const b = 0.78 + rng() * 0.3;
    tl[vi].push({ x, y: h - 0.2, z, ry: rng() * TAU, s, tint: [b * (0.92 + rng() * 0.16), b, b * (0.85 + rng() * 0.2)] });
    addCircle(x, z, 0.42 * s);
  };
  const nTree = Math.round(9500 * q.treeScale);
  for (let i = 0; i < nTree; i++) {
    const x = (rng() * 2 - 1) * 780, z = (rng() * 2 - 1) * 780;
    const h = getHeight(x, z);
    if (h < 0.9) continue;
    const hill = smoothstep(7, 26, h);
    const n = fbm(x * 0.009, z * 0.009, 3, 77);
    const p = hill * (0.25 + 0.75 * smoothstep(0.3, 0.6, n)) + (1 - hill) * 0.05 * smoothstep(0.5, 0.7, n);
    if (rng() < p) treeAt(x, z, hill > 0.5 ? (rng() < 0.55 ? 2 : 1) : (rng() < 0.6 ? 0 : 1));
  }
  // shade trees in the village and port
  for (const [cx, cz, r, n] of [[LOC.village.x, LOC.village.z, 130, 26], [LOC.port.x - 30, LOC.port.z, 100, 16], [LOC.temple.x, LOC.temple.z, 40, 6]]) {
    for (let i = 0; i < n; i++) {
      const a = rng() * TAU, d = Math.sqrt(rng()) * r;
      treeAt(cx + Math.cos(a) * d, cz + Math.sin(a) * d, 0);
    }
  }
  for (const [x, z, vi, sc] of bigTrees) {
    const s = sc || 1.15;
    tl[vi].push({ x, y: getHeight(x, z) - 0.2, z, ry: rng() * TAU, s, tint: [1, 1, 1] });
    addCircle(x, z, 0.5 * s);
  }
  tv.forEach((v, i) => {
    addInstanced(scene, v.trunk, bark, tl[i]);
    addInstanced(scene, v.leaves, leafMat, tl[i]);
  });

  // --- banana plants
  {
    const bg = bananaGeo(rng), list = [];
    const tryB = (x, z) => {
      const h = getHeight(x, z);
      if (h < 0.7 || h > 14 || blocked(x, z, 1.2) || maskAt(x, z, 1) > 0.2) return;
      list.push({ x, y: h - 0.05, z, ry: rng() * TAU, s: 0.8 + rng() * 0.5 });
    };
    for (let i = 0; i < 420; i++) {
      const a = rng() * TAU, d = Math.sqrt(rng()) * 170;
      tryB(LOC.village.x + Math.cos(a) * d, LOC.village.z + Math.sin(a) * d);
    }
    for (let x = -230; x < 170; x += 9) { tryB(x, canalZ(x) - 10 - rng() * 2); if (rng() < 0.5) tryB(x + 4, canalZ(x) + 10 + rng() * 2); }
    for (let i = 0; i < 80; i++) { const a = rng() * TAU, d = Math.sqrt(rng()) * 90; tryB(LOC.port.x - 30 + Math.cos(a) * d, LOC.port.z - 10 + Math.sin(a) * d); }
    addInstanced(scene, bg, bananaMat, list, { receive: true });
  }

  // --- lotus
  {
    const pad = new THREE.CircleGeometry(0.42, 9); pad.rotateX(-Math.PI / 2);
    const padMat = new THREE.MeshStandardMaterial({ color: 0x3f7d3a, roughness: 0.6, side: THREE.DoubleSide });
    const fl = new THREE.ConeGeometry(0.16, 0.24, 7, 1, true); fl.rotateX(Math.PI); fl.translate(0, 0.14, 0);
    const flMat = new THREE.MeshStandardMaterial({ color: 0xf2a3c0, roughness: 0.6, side: THREE.DoubleSide, emissive: 0x402030, emissiveIntensity: 0.25 });
    const pads = [], flowers = [];
    const pond = (cx, cz, r, n) => {
      for (let i = 0; i < n; i++) {
        const a = rng() * TAU, d = Math.sqrt(rng()) * r, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
        if (getHeight(x, z) > -0.35) continue;
        pads.push({ x, y: 0.03, z, ry: rng() * TAU, s: 0.6 + rng() * 0.9 });
        if (rng() < 0.28) flowers.push({ x: x + 0.2, y: 0.02, z: z + 0.1, ry: rng() * TAU, s: 0.8 + rng() * 0.7 });
      }
    };
    pond(LOC.lotus.x, LOC.lotus.z, 15, 220);
    pond(LOC.tank.x, LOC.tank.z, 10, 60);
    for (let x = -220; x < 160; x += 4) if (rng() < 0.5) pond(x, canalZ(x) + (rng() - 0.5) * 9, 2.5, 5);
    addInstanced(scene, pad, padMat, pads, { cast: false });
    addInstanced(scene, fl, flMat, flowers, { cast: false });
  }

  // --- undergrowth: shrubs, ferns and crotons
  {
    const g = new GB();
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * Math.PI + rng() * 0.3, cx = Math.cos(a), sz = Math.sin(a), w = 0.75 + rng() * 0.25, h = 0.95 + rng() * 0.3, lean = (rng() - 0.5) * 0.3;
      const q = [[-1, 0, 0, 0], [1, 0, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]].map(([u, v, tu, tv]) => g.vert(cx * u * w + lean * v, v * h - 0.08, sz * u * w, cx * u * 0.3, 0.9, sz * u * 0.3, tu, tv, 0.8 + v * 0.3, 0.8 + v * 0.3, 0.8 + v * 0.3));
      g.quad(q[0], q[1], q[2], q[3]);
    }
    const sg = g.build(), list = [];
    const n = Math.round(5200 * q.treeScale);
    for (let i = 0; i < n; i++) {
      const x = (rng() * 2 - 1) * 770, z = (rng() * 2 - 1) * 770, h = getHeight(x, z);
      if (h < 0.8) continue;
      const hill = smoothstep(7, 26, h), nz = fbm(x * 0.02, z * 0.02, 2, 91);
      if (rng() > hill * 0.75 + (1 - hill) * 0.22 * smoothstep(0.45, 0.6, nz)) continue;
      if (maskAt(x, z, 0) > 0.2 || maskAt(x, z, 1) > 0.2 || maskAt(x, z, 2) > 0.4 || pointInBox(x, z, 1)) continue;
      const k = rng(), b = 0.75 + rng() * 0.4;
      const tint = k < 0.12 ? [1.25 * b, 0.75 * b, 0.55 * b] : k < 0.25 ? [1.15 * b, 1.15 * b, 0.6 * b] : [0.85 * b, b, 0.8 * b];
      list.push({ x, y: h, z, ry: rng() * TAU, s: 0.7 + rng() * 1.0, tint });
    }
    addInstanced(scene, sg, leafMat, list, { cast: false, receive: true });
  }
  // --- boulders on the slopes and shores
  {
    const rg = new THREE.IcosahedronGeometry(1, 1);
    const rp = rg.attributes.position;
    for (let i = 0; i < rp.count; i++) {
      const vx = rp.getX(i), vy = rp.getY(i), vz = rp.getZ(i);
      const k = 0.78 + 0.44 * fbm(vx * 1.7 + 3, vy * 1.7 + vz * 1.3, 2, 13);
      rp.setXYZ(i, vx * k * 1.15, vy * k * 0.72, vz * k);
    }
    rg.computeVertexNormals();
    const rm = new THREE.MeshStandardMaterial({ map: TEX.stone, roughness: 0.96 });
    const list = [];
    for (let i = 0; i < 2600; i++) {
      const x = (rng() * 2 - 1) * 770, z = (rng() * 2 - 1) * 770, h = getHeight(x, z);
      if (h < -0.4) continue;
      const sl = getSlope(x, z);
      const pr = h > 10 ? 0.1 + sl * 0.7 : (h < 1.3 ? 0.1 : 0.012);
      if (rng() > pr || maskAt(x, z, 0) > 0.2 || maskAt(x, z, 1) > 0.2 || pointInBox(x, z, 1.5)) continue;
      const s = 0.35 + rng() * rng() * 1.9, b = 0.75 + rng() * 0.3;
      list.push({ x, y: h - s * 0.2, z, ry: rng() * TAU, rx: (rng() - 0.5) * 0.5, s, tint: [b * 1.5, b * 1.5, b * 1.45] });
      if (s > 0.9) addCircle(x, z, s * 0.75);
    }
    addInstanced(scene, rg, rm, list, { cast: true, receive: true });
  }

  buildGrass(scene, env);
}
