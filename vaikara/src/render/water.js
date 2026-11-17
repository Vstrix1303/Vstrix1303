// Water: one camera-centred radial grid for everything at sea level (ocean,
// estuary, Kuttan lagoon, mangrove channels, salt pans) with Gerstner swell
// that dies away in sheltered water; a flowing ribbon for the Vellar stream
// whose steep section is Vellar Falls; mist at the plunge pool.
import * as THREE from 'three/webgpu';
import {
  Fn, uniform, vec2, vec3, vec4, float, positionLocal, positionWorld, texture, uv, mix, smoothstep, clamp, exp, max, min,
  normalize, dot, sin, cos, sqrt, length, varying, transformNormalToView, pow, abs, cameraPosition, fract, attribute,
} from 'three/tsl';
import { G, U } from '../state.js';
import { W } from '../world/data.js';
import { WORLD_W, WORLD_H } from '../world/layout.js';
import { waterNormalTexture, noiseTexture } from './textures.js';

let infoTex = null;
export function waterInfoTexture() {
  if (infoTex) return infoTex;
  const { QX, QZ, H, NX, COAST } = W;
  const data = new Uint16Array(QX * QZ * 4);
  for (let j = 0; j < QZ; j++) for (let i = 0; i < QX; i++) {
    const k = j * QX + i;
    const h = H[Math.min(W.NZ - 1, j * 4) * NX + Math.min(NX - 1, i * 4)];
    data[k * 4] = THREE.DataUtils.toHalfFloat(h);
    data[k * 4 + 1] = THREE.DataUtils.toHalfFloat(COAST[k] / 10);
    data[k * 4 + 2] = 0; data[k * 4 + 3] = THREE.DataUtils.toHalfFloat(1);
  }
  infoTex = new THREE.DataTexture(data, QX, QZ, THREE.RGBAFormat, THREE.HalfFloatType);
  infoTex.magFilter = infoTex.minFilter = THREE.LinearFilter;
  infoTex.needsUpdate = true;
  return infoTex;
}

// Gerstner waves: [dirX, dirZ, wavelength, amplitude, steepness]
const WAVES = [
  [1.0, 0.25, 64, 0.55, 0.55],
  [0.86, -0.45, 37, 0.32, 0.5],
  [0.92, 0.55, 21, 0.17, 0.45],
  [0.6, -0.8, 11, 0.07, 0.4],
  [0.98, 0.1, 6.5, 0.035, 0.35],
];

export class Water {
  constructor(scene) {
    this.scene = scene;
    this.offset = uniform(new THREE.Vector3());
    const nrm = waterNormalTexture(512);
    const noise = noiseTexture(256);
    const info = waterInfoTexture();

    // radial grid, dense at the centre
    const rings = [], segs = (G.Q.waterRing ?? 1.035) > 1.04 ? 128 : 192;
    for (let r = 0, s = 1.2, k = G.Q.waterRing ?? 1.035; r < 26000; r += s, s *= k) rings.push(r);
    const pos = [], idx = [];
    for (let i = 0; i < rings.length; i++) for (let k = 0; k < segs; k++) {
      const a = (k / segs) * Math.PI * 2;
      pos.push(Math.cos(a) * rings[i], 0, Math.sin(a) * rings[i]);
    }
    for (let i = 0; i < rings.length - 1; i++) for (let k = 0; k < segs; k++) {
      const a = i * segs + k, b = i * segs + ((k + 1) % segs), c = a + segs, d = b + segs;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);

    const m = new THREE.MeshPhysicalNodeMaterial({ transparent: true, depthWrite: true });
    const wxz = positionLocal.xz.add(this.offset.xz);
    const infoUV = (p) => vec2(p.x.sub(W.X0).div(WORLD_W), p.y.sub(W.Z0).div(WORLD_H));
    const infoV = texture(info, infoUV(wxz)).level(0);
    const open = smoothstep(-15.0, -500.0, infoV.g);         // 1 in the open sea
    const shore = smoothstep(-4.0, -60.0, infoV.g);
    const camD = length(positionLocal.xz);
    const amp = open.mul(0.85).add(shore.mul(0.12)).add(0.03).mul(smoothstep(3500.0, 600.0, camD)).mul(U.storm.mul(1.3).add(1));

    // Gerstner displacement + analytic slope (vertex stage)
    const t = U.time;
    let disp = vec3(0), dnx = float(0), dnz = float(0), crest = float(0);
    for (const [dx, dz, L, A, Q] of WAVES) {
      const l = Math.hypot(dx, dz), d = vec2(dx / l, dz / l);
      const k = (2 * Math.PI) / L, c = Math.sqrt(9.8 / k);
      const f = dot(d, wxz).sub(t.mul(c)).mul(k);
      const a = amp.mul(A);
      disp = disp.add(vec3(d.x.mul(cos(f)).mul(a).mul(Q), sin(f).mul(a), d.y.mul(cos(f)).mul(a).mul(Q)));
      dnx = dnx.add(d.x.mul(k).mul(a).mul(cos(f)));
      dnz = dnz.add(d.y.mul(k).mul(a).mul(cos(f)));
      crest = crest.add(sin(f).mul(A));
    }
    m.positionNode = positionLocal.add(disp);
    const vSlope = varying(vec2(dnx, dnz));
    const vCrest = varying(crest.mul(open));
    const vAmp = varying(amp);

    // fragment
    const p = positionWorld.xz;
    const infoF = texture(info, infoUV(p));
    const ground = infoF.r;
    const depth = max(positionWorld.y.sub(ground), 0.0);
    const openF = smoothstep(-15.0, -500.0, infoF.g);
    // four rotated, irrationally-scaled samples + a noise warp so the pattern never lines up
    const warp = texture(noise, p.mul(1 / 173)).rg.sub(0.5).mul(9.0);
    const rot = (q, a) => vec2(q.x.mul(Math.cos(a)).sub(q.y.mul(Math.sin(a))), q.x.mul(Math.sin(a)).add(q.y.mul(Math.cos(a))));
    const pw = p.add(warp);
    const ns = (sc, a, vx, vy) => texture(nrm, rot(pw, a).div(sc).add(vec2(t.mul(vx), t.mul(vy)))).xyz.mul(2).sub(1);
    const n1 = ns(19.3, 0.0, 0.013, 0.009);
    const n2 = ns(7.37, 1.13, -0.021, 0.017).add(ns(4.91, 2.71, 0.026, -0.011)).mul(0.5);
    const n3 = ns(61.7, 4.02, 0.004, -0.006);
    const camDist = length(positionWorld.sub(cameraPosition));
    const detail = smoothstep(1800.0, 60.0, camDist);
    const calm = mix(float(0.45), float(1.0), openF);
    const nT = n1.xy.add(n2.xy.mul(0.6)).add(n3.xy.mul(0.8)).mul(calm).mul(mix(float(0.25), float(0.55), detail));
    // rain: a fizz of tiny ripples over every surface
    const rr = ns(1.13, 0.7, 0.0, -0.9).xy.add(ns(0.71, 2.2, 0.6, 0.0).xy).mul(U.rain.mul(0.45)).mul(detail);
    const nWorld = normalize(vec3(vSlope.x.negate().add(nT.x).add(rr.x), 1.0, vSlope.y.negate().add(nT.y).add(rr.y)));
    m.normalNode = transformNormalToView(nWorld);

    // colour: backwater greens in the lagoon, Arabian Sea blues offshore
    const shallow = mix(vec3(0.09, 0.20, 0.10), vec3(0.04, 0.26, 0.26), openF);
    const deep = mix(vec3(0.012, 0.045, 0.028), vec3(0.004, 0.03, 0.065), openF);
    const absorb = exp(depth.mul(-0.32));
    let col = mix(deep, shallow, absorb);
    // sub-surface lift on wave faces facing the sun
    col = col.add(vec3(0.02, 0.09, 0.07).mul(max(vCrest, 0.0)).mul(openF).mul(0.6));
    // foam: lapping at the shore + whitecaps on swell crests
    const fz = texture(noise, p.mul(1 / 6).add(vec2(t.mul(0.03), 0))).r;
    const fz2 = texture(noise, p.mul(1 / 2.1).sub(vec2(0, t.mul(0.05)))).g;
    const shoreFoam = smoothstep(0.7, 0.0, depth).mul(smoothstep(0.35, 0.75, fz.add(sin(t.mul(1.3).add(depth.mul(9))).mul(0.25)))).mul(mix(float(0.35), float(1), openF));
    const capFoam = smoothstep(0.45, 0.9, vCrest).mul(smoothstep(0.5, 0.8, fz2)).mul(openF).mul(vAmp);
    const foam = clamp(shoreFoam.add(capFoam), 0, 1);
    col = mix(col, vec3(0.85, 0.88, 0.86), foam);
    m.colorNode = col;
    m.roughnessNode = mix(float(0.05), float(0.6), foam);
    m.metalness = 0;
    m.envMapIntensity = 2.2;
    // extra sky sheen at grazing angles (keeps distant water bright like the references)
    const V = normalize(cameraPosition.sub(positionWorld));
    const fres = pow(float(1).sub(max(dot(nWorld, V), 0.0)), 5.0);
    m.emissiveNode = mix(U.fogColor, vec3(0.45, 0.62, 0.8), 0.35).mul(fres).mul(0.55).mul(float(1).sub(foam)).mul(float(1).sub(U.night.mul(0.85)));
    m.ior = 1.333;
    m.specularIntensity = 0.75;
    // opacity: see the bed through clear shallows
    m.opacityNode = clamp(smoothstep(0.0, 2.2, depth).mul(0.7).add(0.22).add(foam), 0, 1);

    this.mat = m;
    this.mesh = new THREE.Mesh(g, m);
    this.mesh.frustumCulled = false; this.mesh.userData.cat = 'water';
    this.mesh.renderOrder = 2;
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);

    this.buildStream(nrm, noise);
  }

  buildStream(nrm, noise) {
    const pts = W.meta.streams.vellar;
    const fi = W.meta.streams.fallsIdx;
    const pos = [], uvs = [], steep = [], idx = [];
    let v = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x, z, y, hw] = pts[i];
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let tx = b[0] - a[0], tz = b[1] - a[1];
      const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      const w = Math.max(5, hw * 0.85);
      if (i > 0) v += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1], y - pts[i - 1][2]);
      const s = i > 0 ? Math.abs(y - pts[i - 1][2]) / Math.max(1, Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1])) : 0;
      // the falls: bow the sheet slightly outwards over the lip
      const fall = i > fi && i <= fi + 2;
      for (const side of [-1, 1]) {
        pos.push(x - tz * w * side + (fall ? tx * 2 : 0), y + 0.08, z + tx * w * side);
        uvs.push(side * 0.5 + 0.5, v / 10);
        steep.push(Math.min(1, s * 0.6) + (fall ? 1 : 0));
      }
      if (i > 0) { const k = (i - 1) * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setAttribute('steep', new THREE.Float32BufferAttribute(steep, 1));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.MeshPhysicalNodeMaterial({ transparent: true, side: THREE.DoubleSide });
    const st = attribute('steep');
    const speed = mix(float(0.35), float(3.2), clamp(st, 0, 1));
    const uvF = uv().add(vec2(0, U.time.mul(speed).negate()));
    const nn = texture(nrm, uvF.mul(vec2(1, 0.6))).xyz.mul(2).sub(1);
    const streak = texture(noise, uvF.mul(vec2(3, 0.25))).r;
    const white = clamp(st.sub(1.0), 0, 1).mul(smoothstep(0.25, 0.65, streak).mul(0.6).add(0.5)).add(clamp(st.sub(0.35), 0, 0.3).mul(smoothstep(0.5, 0.8, streak)));
    const edge = smoothstep(0.0, 0.18, uv().x).mul(smoothstep(1.0, 0.82, uv().x));
    m.colorNode = mix(vec3(0.03, 0.07, 0.05), vec3(0.88, 0.92, 0.92), white);
    m.normalNode = transformNormalToView(normalize(vec3(nn.x.mul(0.4), 1, nn.y.mul(0.4))));
    m.roughnessNode = mix(float(0.22), float(0.6), white);
    m.envMapIntensity = 0.55;
    m.opacityNode = edge.mul(mix(float(0.8), float(0.95), white));
    m.emissiveNode = vec3(0.05, 0.06, 0.06).mul(white).mul(float(1).sub(U.night.mul(0.8)));
    this.stream = new THREE.Mesh(g, m);
    this.stream.renderOrder = 3;
    this.scene.add(this.stream);

    // plunge-pool mist
    const base = pts[Math.min(pts.length - 1, fi + 3)];
    const n = 140, mp = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) { mp[i * 3] = base[0] + (Math.random() - 0.5) * 18; mp[i * 3 + 1] = base[2]; mp[i * 3 + 2] = base[1] + (Math.random() - 0.5) * 18; seed[i] = Math.random(); }
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.BufferAttribute(mp, 3));
    mg.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    const mm = new THREE.PointsNodeMaterial({ transparent: true, depthWrite: false, sizeAttenuation: false });
    const sd = attribute('seed');
    const life = fract(U.time.mul(0.18).add(sd));
    mm.positionNode = positionLocal.add(vec3(sin(sd.mul(40).add(U.time.mul(0.3))).mul(life).mul(8), life.mul(26), cos(sd.mul(31)).mul(life).mul(8)));
    mm.sizeNode = life.mul(14).add(4);
    mm.colorNode = vec4(vec3(0.9, 0.93, 0.95), smoothstep(0.0, 0.15, life).mul(smoothstep(1.0, 0.4, life)).mul(0.07));
    // (mist particles disabled: point sprites render inconsistently across backends)
    void mg; void mm;
    this.fallsPos = new THREE.Vector3(base[0], base[2], base[1]);
  }

  update(cam) {
    const s = 8;
    this.mesh.position.set(Math.round(cam.x / s) * s, 0, Math.round(cam.z / s) * s);
    this.offset.value.copy(this.mesh.position);
  }
}
