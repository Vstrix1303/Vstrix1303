// Terrain mesh, splat mask, GPU height texture and the parchment map.
import * as THREE from 'three';
import { WORLD, HALF, GRID, CELL, N, heights, heightFn, getHeight, ROADS, LOC } from './heightfield.js';
import { TEX } from './textures.js';
import { clamp, lerp } from './util.js';

const MS = 2048;
let maskData = null;
export const terrainU = {
  uMask: { value: null },
  uNoise: { value: null },
  uWet: { value: 0 },
};
export let heightTex = null;
export let maskTex = null;

const ROAD_W = { main: 5, north: 4.6, hill: 4.2, south: 3.2, home: 3, quay: 6, temple: 4 };
const TEA = [[365, -120, 100, 72], [335, 95, 88, 78], [425, -480, 95, 64], [305, 335, 74, 62], [520, 120, 80, 90]];

export function maskAt(x, z, ch) {
  const px = Math.floor((x + HALF) / WORLD * MS), py = Math.floor((z + HALF) / WORLD * MS);
  if (px < 0 || py < 0 || px >= MS || py >= MS) return 0;
  return maskData[(py * MS + px) * 4 + ch] / 255;
}

function paintMask(yards) {
  const c = document.createElement('canvas');
  c.width = c.height = MS;
  const g = c.getContext('2d', { willReadFrequently: true });
  const P = (v) => (v + HALF) / WORLD * MS, S = MS / WORLD;
  g.fillStyle = '#000'; g.fillRect(0, 0, MS, MS);
  g.globalCompositeOperation = 'lighter';
  // paddy plots (green channel) separated by bunds
  g.fillStyle = '#00ff00';
  const x0 = -181, x1 = 191, z0 = 231, z1 = 501, cols = 8, rows = 6;
  const pw = (x1 - x0) / cols, ph = (z1 - z0) / rows;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    g.fillRect(P(x0 + i * pw + 1.1), P(z0 + j * ph + 1.1), (pw - 2.2) * S, (ph - 2.2) * S);
  }
  // tea estates (blue channel)
  for (const [x, z, rx, rz] of TEA) {
    const grd = g.createRadialGradient(P(x), P(z), 0, P(x), P(z), rx * S);
    grd.addColorStop(0, 'rgba(0,0,255,1)'); grd.addColorStop(0.75, 'rgba(0,0,255,1)'); grd.addColorStop(1, 'rgba(0,0,255,0)');
    g.fillStyle = grd;
    g.save(); g.translate(P(x), P(z)); g.scale(1, rz / rx); g.translate(-P(x), -P(z));
    g.beginPath(); g.arc(P(x), P(z), rx * S, 0, 7); g.fill(); g.restore();
  }
  // packed-earth yards
  for (const y of yards) {
    const grd = g.createRadialGradient(P(y.x), P(y.z), 0, P(y.x), P(y.z), y.r * S);
    const a = y.s ?? 0.8;
    grd.addColorStop(0, `rgba(255,0,0,${a})`); grd.addColorStop(0.6, `rgba(255,0,0,${a * 0.8})`); grd.addColorStop(1, 'rgba(255,0,0,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(P(y.x), P(y.z), y.r * S, 0, 7); g.fill();
  }
  // roads (red channel)
  g.strokeStyle = '#ff0000'; g.lineCap = 'round'; g.lineJoin = 'round';
  for (const k in ROADS) {
    g.lineWidth = (ROAD_W[k] || 4) * S;
    g.beginPath();
    ROADS[k].forEach((p, i) => (i ? g.lineTo(P(p[0]), P(p[1])) : g.moveTo(P(p[0]), P(p[1]))));
    g.stroke();
  }
  maskData = g.getImageData(0, 0, MS, MS).data;
  const t = new THREE.CanvasTexture(c);
  t.flipY = false;
  t.anisotropy = 4;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

const GLSL_COLOR = /* glsl */`
  vec2 muv = vWPos.xz / ${WORLD.toFixed(1)} + 0.5;
  vec3 tmask = vec3(0.0);
  float inside = step(0.0, muv.x) * step(muv.x, 1.0) * step(0.0, muv.y) * step(muv.y, 1.0);
  if (inside > 0.5) tmask = texture2D(uMask, muv).rgb;
  float n1 = texture2D(uNoise, vWPos.xz * 0.031).r;
  float n2 = texture2D(uNoise, vWPos.xz * 0.0071).g;
  float n3 = texture2D(uNoise, vWPos.xz * 0.37).b;
  float n4 = texture2D(uNoise, vWPos.xz * 0.11).a;
  float tslope = 1.0 - normalize(vWN).y;
  vec3 tcol = mix(SRGB(0.20, 0.31, 0.13), SRGB(0.34, 0.42, 0.19), smoothstep(0.3, 0.7, n2));
  tcol = mix(tcol, SRGB(0.50, 0.49, 0.26), smoothstep(0.55, 0.8, n1) * 0.45);
  float thill = smoothstep(10.0, 40.0, vWPos.y);
  tcol = mix(tcol, SRGB(0.19, 0.27, 0.12), thill * 0.75);
  tcol = mix(tcol, SRGB(0.13, 0.22, 0.09) * (0.5 + n4), (1.0 - inside) * thill);
  float teaM = tmask.b * smoothstep(9.0, 17.0, vWPos.y);
  float stripe = smoothstep(-0.25, 0.25, sin(vWPos.y * 3.3 + n4 * 1.6));
  tcol = mix(tcol, mix(SRGB(0.13, 0.25, 0.10), SRGB(0.24, 0.41, 0.15), stripe), teaM);
  tcol *= 0.72 + 0.56 * n3;
  tcol = mix(tcol, SRGB(0.42, 0.38, 0.33) * (0.7 + 0.6 * n4), smoothstep(0.2, 0.4, tslope + (n1 - 0.5) * 0.12));
  float shore = smoothstep(1.25, 0.25, vWPos.y + (n1 - 0.5) * 0.8);
  tcol = mix(tcol, SRGB(0.70, 0.61, 0.44) * (0.85 + 0.3 * n3), shore);
  tcol = mix(tcol, mix(SRGB(0.25, 0.30, 0.16), SRGB(0.30, 0.42, 0.14), n4) , tmask.g * (1.0 - shore * 0.4));
  float troad = smoothstep(0.25, 0.75, tmask.r + (n3 - 0.5) * 0.4);
  tcol = mix(tcol, mix(SRGB(0.44, 0.27, 0.19), SRGB(0.60, 0.34, 0.22), n4) * (0.85 + 0.3 * n1), troad);
  tcol = mix(tcol, SRGB(0.30, 0.25, 0.16), smoothstep(0.1, -1.2, vWPos.y));
  float tPuddle = max(uWet * troad * smoothstep(0.48, 0.6, n1), tmask.g * 0.55 * smoothstep(0.35, 0.6, n1));
  tcol *= 1.0 - 0.32 * uWet;
  diffuseColor.rgb = tcol;
`;

export function makeTerrainMaterial() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.96, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uMask = terrainU.uMask;
    sh.uniforms.uNoise = terrainU.uNoise;
    sh.uniforms.uWet = terrainU.uWet;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos; varying vec3 vWN;
        uniform sampler2D uMask; uniform sampler2D uNoise; uniform float uWet;
        vec3 SRGB(float r, float g, float b) { return pow(vec3(r, g, b), vec3(2.2)); }`)
      .replace('#include <map_fragment>', GLSL_COLOR)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.06, tPuddle);');
  };
  return mat;
}

export function buildTerrain(scene, yards) {
  maskTex = paintMask(yards);
  terrainU.uMask.value = maskTex;
  terrainU.uNoise.value = TEX.noise;

  const mat = makeTerrainMaterial();

  // playable terrain
  const geo = new THREE.PlaneGeometry(WORLD, WORLD, GRID, GRID);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heights[i]);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  mesh.layers.set(1);               // main view only
  scene.add(mesh);
  // half-resolution copy that only the water-reflection camera draws (layer 2)
  const LS = GRID / 2;
  const lgeo = new THREE.PlaneGeometry(WORLD, WORLD, LS, LS);
  lgeo.rotateX(-Math.PI / 2);
  const lp = lgeo.attributes.position;
  for (let i = 0; i < lp.count; i++) { const ix = i % (LS + 1), iz = Math.floor(i / (LS + 1)); lp.setY(i, heights[iz * 2 * N + ix * 2]); }
  lgeo.computeVertexNormals();
  const low = new THREE.Mesh(lgeo, mat);
  low.matrixAutoUpdate = false;
  low.layers.set(2);
  scene.add(low);

  // distant land (coarse) so the world never visibly ends
  const FAR = 6400, FS = 128;
  const fgeo = new THREE.PlaneGeometry(FAR, FAR, FS, FS);
  fgeo.rotateX(-Math.PI / 2);
  const fp = fgeo.attributes.position;
  for (let i = 0; i < fp.count; i++) {
    const x = fp.getX(i), z = fp.getZ(i);
    let h = heightFn(x, z);
    if (Math.abs(x) < HALF - 1 && Math.abs(z) < HALF - 1) h -= 40;
    fp.setY(i, h);
  }
  fgeo.computeVertexNormals();
  const far = new THREE.Mesh(fgeo, mat);
  far.matrixAutoUpdate = false;
  far.position.y = -0.35;
  far.updateMatrix();
  scene.add(far);

  // height texture for water / grass shaders
  const hd = new Uint16Array(N * N);
  for (let i = 0; i < N * N; i++) hd[i] = THREE.DataUtils.toHalfFloat(heights[i]);
  heightTex = new THREE.DataTexture(hd, N, N, THREE.RedFormat, THREE.HalfFloatType);
  heightTex.minFilter = heightTex.magFilter = THREE.LinearFilter;
  heightTex.wrapS = heightTex.wrapT = THREE.ClampToEdgeWrapping;
  heightTex.needsUpdate = true;
  return mesh;
}

// GLSL helper: world xz -> height texture uv
export const GLSL_HUV = `vec2 huv(vec2 p){ return (p / ${WORLD.toFixed(1)} + 0.5) * ${(GRID / N).toFixed(6)} + ${(0.5 / N).toFixed(6)}; }`;

// A parchment-style survey map used by the minimap
export function buildMapImage(marks = []) {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const img = g.createImageData(S, S);
  const d = img.data;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const x = -HALF + (i + 0.5) / S * WORLD, z = -HALF + (j + 0.5) / S * WORLD;
    const h = getHeight(x, z);
    let r, gg, b;
    if (h < 0) {
      const t = clamp(-h / 5, 0, 1);
      r = lerp(138, 92, t); gg = lerp(170, 132, t); b = lerp(168, 142, t);
    } else {
      const t = clamp(h / 110, 0, 1);
      r = lerp(214, 150, t); gg = lerp(198, 126, t); b = lerp(152, 84, t);
      const sh = clamp(0.5 + (getHeight(x - 4, z - 4) - getHeight(x + 4, z + 4)) * 0.035, 0.1, 0.9) + 0.5;
      r *= sh; gg *= sh; b *= sh;
      const pg = maskAt(x, z, 1), pr = maskAt(x, z, 0);
      if (pg > 0.5) { r = lerp(r, 176, 0.7); gg = lerp(gg, 186, 0.7); b = lerp(b, 110, 0.7); }
      if (pr > 0.55) { r = 118; gg = 70; b = 44; }
    }
    const k = (j * S + i) * 4;
    d[k] = r; d[k + 1] = gg; d[k + 2] = b; d[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  g.fillStyle = '#3b2616';
  for (const m of marks) {
    const px = (m.x + HALF) / WORLD * S, pz = (m.z + HALF) / WORLD * S;
    g.save(); g.translate(px, pz); g.rotate(-(m.rot || 0));
    const w = Math.max(2, m.w / WORLD * S), dd = Math.max(2, m.d / WORLD * S);
    g.fillRect(-w / 2, -dd / 2, w, dd);
    g.restore();
  }
  return c;
}

export { LOC, CELL };
