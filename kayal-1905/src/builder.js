// Accumulates all static architecture into a handful of merged meshes
// (one per material) so the whole built world costs ~10 draw calls.
import * as THREE from 'three';
import { GB, TRS, boxGeo, hipRoofGeo, gableRoofGeo, gableEndGeo } from './geo.js';
import { TEX } from './textures.js';
import { getHeight } from './heightfield.js';
import { addBox, addPlatform, addRamp, addCircle, addInterior } from './physics.js';
import { REAL, hasReal, realMaterial } from './assets.js';

export function makeMaterials() {
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, vertexColors: true, ...o });
  const mats = baseMaterials(std);
  if (hasReal()) {
    // photo-scanned surfaces; repeat values put each texture at its real-world scale
    Object.assign(mats, {
      wall: realMaterial('plaster', { repeat: 0.8, tint: [1.22, 1.22, 1.2], bump: 0.9 }),
      laterite: realMaterial('laterite', { repeat: 1.1, tint: [1.12, 0.62, 0.46], bump: 1.2 }),
      roof: realMaterial('roof', { repeat: 0.5, side: THREE.DoubleSide, bump: 1.3, tint: [1.08, 1.0, 0.96] }),
      thatch: realMaterial('thatch', { repeat: 0.7, side: THREE.DoubleSide, tint: [1.25, 1.08, 0.8], bump: 1.4 }),
      plank: realMaterial('plank', { repeat: 0.8, tint: [1.15, 1.05, 0.95] }),
      wood: realMaterial('wood', { repeat: 1.2, tint: [0.48, 0.34, 0.26] }),
      stone: realMaterial('stone', { repeat: 0.8, tint: [1.22, 1.1, 0.92] }),
      sack: realMaterial('sack', { repeat: 2.5, tint: [1.1, 1.0, 0.85] }),
    });
  }
  return mats;
}
function baseMaterials(std) {
  return {
    wall: std({ map: TEX.wall, roughness: 0.95 }),
    laterite: std({ map: TEX.laterite, bumpMap: TEX.laterite, bumpScale: 1.2 }),
    wood: std({ map: TEX.wood, roughness: 0.75 }),
    roof: std({ map: TEX.roof, bumpMap: TEX.roof, bumpScale: 2.5, side: THREE.DoubleSide, roughness: 0.85 }),
    thatch: std({ map: TEX.thatch, bumpMap: TEX.thatch, bumpScale: 2, side: THREE.DoubleSide, roughness: 1 }),
    stone: std({ map: TEX.stone, roughness: 0.9 }),
    plank: std({ map: TEX.plank, roughness: 0.9 }),
    sack: std({ map: TEX.sack, roughness: 1 }),
    sign: std({ map: TEX.signs, roughness: 0.9 }),
    poster: std({ map: TEX.posters, roughness: 0.85 }),
    slogan: std({ map: TEX.slogans, roughness: 0.95 }),
    ads: std({ map: TEX.ads, roughness: 0.35, metalness: 0.1 }),
    plaque: std({ map: TEX.plaques, roughness: 0.9 }),
    gable: std({ map: TEX.gable, roughness: 0.8, side: THREE.DoubleSide }),
    mural: std({ map: TEX.mural, roughness: 0.9 }),
    jali: std({ map: TEX.jali, roughness: 0.75, side: THREE.DoubleSide }),
    tin: std({ map: TEX.tin, roughness: 0.55, metalness: 0.35, side: THREE.DoubleSide }),
    paint: std({ roughness: 0.8 }),
    brass: std({ color: 0xffffff, roughness: 0.32, metalness: 0.55, emissive: 0x3a2606, emissiveIntensity: 0.6 }),
    leaf: std({ map: TEX.leaves, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9 }),
    net: std({ map: TEX.net, transparent: true, alphaTest: 0.2, side: THREE.DoubleSide, depthWrite: false }),
  };
}

const TILE = 150;
export class Builder {
  constructor() {
    this.g = {};
    this.m = new THREE.Matrix4();
    this.ox = 0; this.oy = 0; this.oz = 0; this.ry = 0;
    this.yards = []; this.keepClear = []; this.marks = []; this.lamps = []; this.smokes = [];
  }
  // geometry is merged per material *per 150 m tile*, so whatever is off-screen or outside the
  // shadow camera is skipped instead of the whole world being drawn every pass
  gb(mat) { const k = mat + '@' + Math.floor(this.ox / TILE) + ',' + Math.floor(this.oz / TILE); return this.g[k] || (this.g[k] = new GB()); }
  place(x, z, ry = 0, y = null) {
    this.ox = x; this.oz = z; this.ry = ry; this.oy = y ?? getHeight(x, z);
    this.m = TRS(x, this.oy, z, 0, ry, 0);
    return this;
  }
  world(x, y, z) { return new THREE.Vector3(x, y, z).applyMatrix4(this.m); }
  // box sitting on local y
  box(mat, w, h, d, x, y, z, o = {}) {
    const geo = boxGeo(w, h, d, o.tile || 2);
    const m = this.m.clone().multiply(TRS(x, y + h / 2, z, o.rx || 0, o.ry || 0, o.rz || 0));
    this.gb(mat).add(geo, m, o.col);
    geo.dispose();
    return this;
  }
  cyl(mat, rt, rb, h, x, y, z, o = {}) {
    const geo = new THREE.CylinderGeometry(rt, rb, h, o.seg || 8, 1, o.open || false);
    const m = this.m.clone().multiply(TRS(x, y + h / 2, z, o.rx || 0, o.ry || 0, o.rz || 0));
    this.gb(mat).add(geo, m, o.col, o.uv || [Math.max(1, Math.round(rb * 3)), Math.max(1, h / 2)]);
    geo.dispose();
    return this;
  }
  sphere(mat, r, x, y, z, o = {}) {
    const geo = new THREE.SphereGeometry(r, o.seg || 8, o.rings || 6);
    const m = this.m.clone().multiply(TRS(x, y, z, 0, 0, 0, o.sx || 1, o.sy || 1, o.sz || 1));
    this.gb(mat).add(geo, m, o.col, [1, 1]);
    geo.dispose();
    return this;
  }
  cone(mat, r, h, x, y, z, o = {}) {
    const geo = new THREE.ConeGeometry(r, h, o.seg || 8);
    const m = this.m.clone().multiply(TRS(x, y + h / 2, z, o.rx || 0, o.ry || 0, o.rz || 0));
    this.gb(mat).add(geo, m, o.col, [1, 1]);
    geo.dispose();
    return this;
  }
  geo(mat, geo, lm, col) {
    this.gb(mat).add(geo, this.m.clone().multiply(lm), col);
    return this;
  }
  roofHip(mat, w, d, h, ridge, x, y, z, ry = 0, col) {
    return this.geo(mat, hipRoofGeo(w, d, h, ridge), TRS(x, y, z, 0, ry, 0), col);
  }
  roofGable(mat, w, d, h, x, y, z, ry = 0, endMat = 'wall', col) {
    this.geo(mat, gableRoofGeo(w, d, h), TRS(x, y, z, 0, ry, 0), col);
    if (endMat) {
      const e = gableEndGeo(d - 0.3, h - 0.15);
      this.geo(endMat, e, TRS(x, y, z, 0, ry, 0).multiply(TRS(w / 2 - 0.25, 0, 0)));
      this.geo(endMat, e, TRS(x, y, z, 0, ry, 0).multiply(TRS(-w / 2 + 0.25, 0, 0, 0, Math.PI, 0)));
    }
    return this;
  }
  // a turned object (pots, lamps, baskets): profile = [[radius, height], …]
  lathe(mat, profile, x, y, z, o = {}) {
    const geo = new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(r, h)), o.seg || 10);
    const s = o.s || 1;
    const m = this.m.clone().multiply(TRS(x, y, z, o.rx || 0, o.ry || 0, o.rz || 0, s));
    this.gb(mat).add(geo, m, o.col, o.uv || [2, 1]);
    geo.dispose();
    return this;
  }
  // a painted triangular pediment facing local +Z (rotated by ry)
  tri(mat, w, h, x, y, z, ry = 0, col) {
    const g = new GB();
    const a = g.vert(-w / 2, 0, 0, 0, 0, 1, 0, 0), c = g.vert(w / 2, 0, 0, 0, 0, 1, 1, 0), d = g.vert(0, h, 0, 0, 0, 1, 0.5, 1);
    g.tri(a, c, d);
    return this.geo(mat, g.build(false), TRS(x, y, z, 0, ry, 0), col);
  }
  // a flat painted panel facing local +Z
  panel(mat, w, h, x, y, z, ry = 0, uv = [1, 1]) {
    const geo = new THREE.PlaneGeometry(w, h);
    const u = geo.attributes.uv; for (let k = 0; k < u.count; k++) u.setXY(k, u.getX(k) * uv[0], u.getY(k) * uv[1]);
    return this.geo(mat, geo, TRS(x, y + h / 2, z, 0, ry, 0));
  }
  interior(x, z, hw, hd, ceil, floor = null) {
    const p = this.world(x, 0, z);
    addInterior(p.x, p.z, hw, hd, this.ry, this.oy + ceil, floor == null ? -1e9 : this.oy + floor);
    return this;
  }
  // a thin square bar between two WORLD points (wires, rails, ropes)
  beamW(mat, a, c, t, col) {
    const len = a.distanceTo(c);
    if (len < 0.01) return this;
    const geo = boxGeo(t, t, len, 2);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), c.clone().sub(a).normalize());
    const m = new THREE.Matrix4().compose(a.clone().add(c).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
    this.gb(mat).add(geo, m, col);
    geo.dispose();
    return this;
  }
  // hand-painted signboard i from the atlas, facing local +Z
  sign(i, w, h, x, y, z, ry = 0) {
    const geo = new THREE.PlaneGeometry(w, h);
    const R = 1 / 16, uv = geo.attributes.uv, u0 = (i % 2) * 0.5, v1 = 1 - Math.floor(i / 2) * R;      // 2 x 16 atlas
    for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) * 0.5, v1 - R + uv.getY(k) * R);
    const m = TRS(x, y, z, 0, ry, 0);
    this.geo('sign', geo, m);
    this.geo('wood', boxGeo(w + 0.14, h + 0.14, 0.05, 2), m.clone().multiply(TRS(0, 0, -0.035)), [0.5, 0.42, 0.36]);
    return this;
  }
  // a flat picture from an atlas of cols x rows (posters, slogans) laid on a wall
  decal(mat, i, cols, rows, w, h, x, y, z, ry = 0) {
    const geo = new THREE.PlaneGeometry(w, h), uv = geo.attributes.uv, u0 = (i % cols) / cols, v1 = 1 - Math.floor(i / cols) / rows;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) / cols, v1 - 1 / rows + uv.getY(k) / rows);
    this.geo(mat, geo, TRS(x, y, z, 0, ry, 0));
    return this;
  }
  collider(x, z, hw, hd, ry = 0, top = 50, bot = null) {
    const p = this.world(x, 0, z);
    return addBox(p.x, p.z, hw, hd, this.ry + ry, this.oy + top, bot == null ? -1e9 : this.oy + bot);
    return this;
  }
  circle(x, z, r) { const p = this.world(x, 0, z); addCircle(p.x, p.z, r); return this; }
  ramp(x, z, hw, hd, y0, y1) {
    const p = this.world(x, 0, z);
    addRamp(p.x, p.z, hw, hd, this.ry, this.oy + y0, this.oy + y1);
    return this;
  }
  platform(x, z, hw, hd, y) {
    const p = this.world(x, 0, z);
    addPlatform(p.x, p.z, hw, hd, this.ry, this.oy + y);
    return this;
  }
  yard(r, s = 0.8, x = 0, z = 0) { const p = this.world(x, 0, z); this.yards.push({ x: p.x, z: p.z, r, s }); return this; }
  clear(r, x = 0, z = 0) { const p = this.world(x, 0, z); this.keepClear.push({ x: p.x, z: p.z, r }); return this; }
  mark(w, d, x = 0, z = 0) { const p = this.world(x, 0, z); this.marks.push({ x: p.x, z: p.z, w, d, rot: this.ry }); return this; }
  smoke(x, y, z) { const p = this.world(x, y, z); this.smokes.push(p); return this; }
  lamp(x, y, z, size = 1, light = 0) {
    const p = this.world(x, y, z);
    this.lamps.push({ x: p.x, y: p.y, z: p.z, size, light });
    return this;
  }
  finish(scene, mats) {
    const out = {};
    for (const k in this.g) {
      const mat = k.split('@')[0];
      const mesh = new THREE.Mesh(this.g[k].build(), mats[mat]);
      mesh.castShadow = mat !== 'net' && mat !== 'leaf';
      mesh.boundingSphere = mesh.geometry.boundingSphere;          // world space: the reflection pass culls by it
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      scene.add(mesh);
      out[k] = mesh;
    }
    return out;
  }
}
