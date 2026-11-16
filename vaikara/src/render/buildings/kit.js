// Building kit: primitives with world-scale UVs, accumulated per material and
// merged into a handful of static meshes. Kerala hip-and-gable roofs, arcades,
// domes, towers, stairs.
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { float, vec3, mix, smoothstep, sin, positionWorld, texture, uv } from 'three/tsl';
import { pbr } from '../textures.js';
import { U } from '../../state.js';

const TILE = { roof: 2.2, thatch: 2.6, plaster: 3, yplaster: 3, laterite: 1.6, fortstone: 2.6, sandstone: 3, planks: 2, wood: 2, whitewash: 3, mud: 2.4 };

let MATS = null;
export function materials() {
  if (MATS) return MATS;
  const std = (name, o = {}) => {
    const s = pbr(name);
    return new THREE.MeshStandardNodeMaterial({ map: s.map, normalMap: s.normalMap, roughnessMap: s.arm, aoMap: s.arm, roughness: 1, metalness: 0, color: o.color ?? 0xffffff, side: o.side ?? THREE.FrontSide });
  };
  const win = new THREE.MeshStandardNodeMaterial({ color: 0x0c0907, roughness: 0.92 });
  // windows glow warm after dusk (only some of them: hash of position)
  const lit = sin(positionWorld.x.mul(1.7).add(positionWorld.z.mul(2.3))).mul(0.5).add(0.5);
  win.emissiveNode = vec3(1.0, 0.55, 0.22).mul(smoothstep(0.35, 0.6, lit)).mul(U.night).mul(1.6);
  MATS = {
    roof: std('roof', { side: THREE.DoubleSide, color: 0xd8b8a8 }),
    thatch: std('thatch', { side: THREE.DoubleSide, color: 0xb8a078 }),
    plaster: std('plaster', { color: 0xfff0dc }),
    whitewash: std('plaster', { color: 0xfff8f0 }),
    yplaster: std('yplaster', { color: 0xffe8b8 }),
    laterite: std('laterite', { color: 0xd89a80 }),
    mud: std('plaster', { color: 0xb08868 }),
    fortstone: std('fortstone', { color: 0xb0a490 }),
    sandstone: std('sandstone', { color: 0xc8b8a0 }),
    planks: std('planks', { color: 0x9a8070, side: THREE.DoubleSide }),
    wood: std('wood', { color: 0x6a4a34 }),
    window: win,
    gold: new THREE.MeshStandardNodeMaterial({ color: 0xd4a546, roughness: 0.35, metalness: 1 }),
    copper: new THREE.MeshStandardNodeMaterial({ color: 0x5f8f78, roughness: 0.55, metalness: 0.6 }),
    redcloth: new THREE.MeshStandardNodeMaterial({ color: 0x8a2a1c, roughness: 0.9, side: THREE.DoubleSide }),
    cloth: new THREE.MeshStandardNodeMaterial({ color: 0xc8b07a, roughness: 0.9, side: THREE.DoubleSide }),
    bluecloth: new THREE.MeshStandardNodeMaterial({ color: 0x2c4a6a, roughness: 0.9, side: THREE.DoubleSide }),
    iron: new THREE.MeshStandardNodeMaterial({ color: 0x2a2826, roughness: 0.5, metalness: 0.8 }),
    lamp: new THREE.MeshStandardNodeMaterial({ color: 0xfff0c0, roughness: 0.2, emissive: 0xffd890, emissiveIntensity: 0.2 }),
    salt: new THREE.MeshStandardNodeMaterial({ color: 0xf4f2ec, roughness: 0.85 }),
    red: std('plaster', { color: 0xa84a3a }),
    stripeRed: std('laterite', { color: 0xc06050 }),
  };
  MATS.lamp.emissiveNode = vec3(1.0, 0.85, 0.5).mul(U.night.mul(12).add(0.3));
  return MATS;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);

export class Kit {
  constructor() { this.parts = new Map(); }
  push(mat, geo, x, y, z, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    _e.set(rx, ry, rz); _q.setFromEuler(_e); _v.set(x, y, z); _s.set(sx, sy, sz);
    geo.applyMatrix4(_m.compose(_v, _q, _s));
    if (geo.index) geo = geo.toNonIndexed();
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    if (!this.parts.has(mat)) this.parts.set(mat, []);
    this.parts.get(mat).push(geo);
  }

  // Box with metre-scaled UVs. (x,z) centre, y = bottom.
  box(mat, x, y, z, w, h, d, ry = 0, tile = TILE[mat] || 2) {
    const g = new THREE.BoxGeometry(w, h, d);
    const uvA = g.attributes.uv;
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uvA.setXY(k, uvA.getX(k) * dims[f][0] / tile, uvA.getY(k) * dims[f][1] / tile);
    }
    this.push(mat, g, x, y + h / 2, z, ry);
  }

  // Box positioned in a local frame (ox along the building's x axis, oz along z) rotated by ry about (cx,cz).
  lbox(mat, cx, cz, ry, ox, y, oz, w, h, d, tile) {
    const c = Math.cos(ry), s = Math.sin(ry);
    this.box(mat, cx + ox * c + oz * s, y, cz - ox * s + oz * c, w, h, d, ry, tile);
  }

  cyl(mat, x, y, z, r0, r1, h, seg = 12, tile = TILE[mat] || 2, open = false) {
    const g = new THREE.CylinderGeometry(r1, r0, h, seg, 1, open);
    const uvA = g.attributes.uv;
    for (let k = 0; k < uvA.count; k++) uvA.setXY(k, uvA.getX(k) * (Math.PI * 2 * Math.max(r0, r1)) / tile, uvA.getY(k) * h / tile);
    this.push(mat, g, x, y + h / 2, z);
  }

  sphere(mat, x, y, z, r, phiLen = Math.PI * 2, thetaLen = Math.PI / 2, sy = 1, seg = 18) {
    const g = new THREE.SphereGeometry(r, seg, Math.max(6, seg >> 1), 0, phiLen, 0, thetaLen);
    this.push(mat, g, x, y, z, 0, 0, 0, 1, sy, 1);
  }

  // Kerala hip-and-gable roof. (x,z) centre, y = eave height, w (along ry x-axis) ≥ d.
  roof(mat, x, y, z, w, d, ry = 0, { pitch = 0.95, over = 1.0, gable = 0.72, flare = 0.25 } = {}) {
    if (d > w) { [w, d] = [d, w]; ry += Math.PI / 2; }
    const W = w / 2 + over, D = d / 2 + over, h = D * pitch;
    const hg = h * gable, Xg = W - D * (hg / h), Zg = D * (1 - hg / h);
    const P = [], UV = [];
    const tile = TILE[mat] || 2.2;
    const slope = Math.hypot(D, h);
    // eave flare: the lowest course turns outward a little (Kerala curve)
    const fl = flare;
    const tri = (a, b, c, ua, ub, uc) => { P.push(...a, ...b, ...c); UV.push(...ua, ...ub, ...uc); };
    const front = (sz) => {
      const E0 = [-W, -fl, sz * (D + fl)], E1 = [W, -fl, sz * (D + fl)], G1 = [Xg, hg, sz * Zg], G0 = [-Xg, hg, sz * Zg], R1 = [Xg, h, 0], R0 = [-Xg, h, 0];
      const uvp = (p) => [p[0] / tile, (D - Math.abs(p[2])) / D * slope / tile];
      const poly = sz > 0 ? [E0, E1, G1, R1, R0, G0] : [E1, E0, G0, R0, R1, G1];
      for (let i = 1; i < poly.length - 1; i++) tri(poly[0], poly[i], poly[i + 1], uvp(poly[0]), uvp(poly[i]), uvp(poly[i + 1]));
    };
    const side = (sx) => {
      const E1 = [sx * (W + fl), -fl, -(D)], E2 = [sx * (W + fl), -fl, D], G2 = [sx * Xg, hg, Zg], G1 = [sx * Xg, hg, -Zg];
      const uvp = (p) => [p[2] / tile, (W - Math.abs(p[0])) / Math.max(0.01, W - Xg) * Math.hypot(W - Xg, hg) / tile];
      const poly = sx > 0 ? [E2, E1, G1, G2] : [E1, E2, G2, G1];
      tri(poly[0], poly[1], poly[2], uvp(poly[0]), uvp(poly[1]), uvp(poly[2]));
      tri(poly[0], poly[2], poly[3], uvp(poly[0]), uvp(poly[2]), uvp(poly[3]));
    };
    front(1); front(-1); side(1); side(-1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
    g.computeVertexNormals();
    this.push(mat, g, x, y, z, ry);
    // the gable faces (wooden lattice "mukhappu") and ridge
    const GP = [];
    for (const sx of [-1, 1]) {
      const a = [sx * Xg, hg, -Zg], b = [sx * Xg, hg, Zg], c = [sx * (Xg + 0.15), h + 0.05, 0];
      if (sx > 0) GP.push(...a, ...c, ...b); else GP.push(...a, ...b, ...c);
    }
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(GP, 3));
    gg.setAttribute('uv', new THREE.Float32BufferAttribute(GP.map((v, i) => (i % 3 === 1 ? v : v) / 1.5).filter((_, i) => i % 3 !== 0), 2));
    gg.computeVertexNormals();
    this.push('planks', gg, x, y, z, ry);
    this.lbox('wood', x, z, ry, 0, y + h - 0.05, 0, Xg * 2 + 0.6, 0.18, 0.22, 1);
    // finials at the gable tips
    const c = Math.cos(ry), s = Math.sin(ry);
    for (const sx of [-1, 1]) this.cyl('gold', x + sx * (Xg + 0.2) * c, y + h, z - sx * (Xg + 0.2) * s, 0.06, 0.02, 0.6, 6);
    return h;
  }

  // simple pyramid / cone roof (huts, kiosks, towers)
  pyramid(mat, x, y, z, r, h, sides = 4, ry = Math.PI / 4) {
    const g = new THREE.ConeGeometry(r, h, sides, 1, true);
    const uvA = g.attributes.uv;
    for (let k = 0; k < uvA.count; k++) uvA.setXY(k, uvA.getX(k) * r * 4 / 2.4, uvA.getY(k) * Math.hypot(r, h) / 2.4);
    this.push(mat, g, x, y + h / 2, z, ry);
  }

  // Wall with a row of arches cut through it (arcades, bridges, fort gates).
  arcade(mat, cx, cz, ry, ox, y, oz, len, h, thick, n, archW, archH, archY = 0, tile = TILE[mat] || 2) {
    const sh = new THREE.Shape();
    sh.moveTo(-len / 2, 0); sh.lineTo(len / 2, 0); sh.lineTo(len / 2, h); sh.lineTo(-len / 2, h); sh.lineTo(-len / 2, 0);
    const step = len / n;
    for (let i = 0; i < n; i++) {
      const ax = -len / 2 + step * (i + 0.5), r = archW / 2;
      const hole = new THREE.Path();
      const spring = archY + archH - r;
      hole.moveTo(ax - r, archY);
      hole.lineTo(ax - r, spring);
      hole.absarc(ax, spring, r, Math.PI, 0, true);
      hole.lineTo(ax + r, archY);
      hole.lineTo(ax - r, archY);
      sh.holes.push(hole);
    }
    const g = new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: false, curveSegments: 10 });
    g.translate(0, 0, -thick / 2);
    const uvA = g.attributes.uv;
    for (let k = 0; k < uvA.count; k++) uvA.setXY(k, uvA.getX(k) / tile, uvA.getY(k) / tile);
    const c = Math.cos(ry), s = Math.sin(ry);
    this.push(mat, g, cx + ox * c + oz * s, y, cz - ox * s + oz * c, ry);
  }

  stairs(mat, cx, cz, ry, ox, y, oz, w, rise, run, steps) {
    for (let i = 0; i < steps; i++) this.lbox(mat, cx, cz, ry, ox, y + i * rise - (steps * rise), oz + i * run, w, steps * rise - i * rise + 0.01, run, 1.5);
  }

  build(scene, matSet, { castShadow = true } = {}) {
    const meshes = [];
    for (const [key, list] of this.parts) {
      const mat = typeof key === 'string' ? matSet[key] : key;
      if (!mat) { console.warn('kit: no material', key); continue; }
      for (let i = 0; i < list.length; i += 4000) {
        const g = mergeGeometries(list.slice(i, i + 4000), false);
        if (!g) continue;
        g.computeBoundingSphere();
        const m = new THREE.Mesh(g, mat);
        m.castShadow = castShadow; m.receiveShadow = true;
        m.matrixAutoUpdate = false;
        scene.add(m);
        meshes.push(m);
      }
    }
    this.parts.clear();
    return meshes;
  }
}
