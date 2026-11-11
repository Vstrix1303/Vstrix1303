// Accumulates all static architecture into a handful of merged meshes
// (one per material) so the whole built world costs ~10 draw calls.
import * as THREE from 'three';
import { GB, TRS, boxGeo, hipRoofGeo, gableRoofGeo, gableEndGeo } from './geo.js';
import { TEX } from './textures.js';
import { getHeight } from './heightfield.js';
import { addBox, addPlatform, addCircle } from './physics.js';

export function makeMaterials() {
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, vertexColors: true, ...o });
  return {
    wall: std({ map: TEX.wall, roughness: 0.95 }),
    laterite: std({ map: TEX.laterite, bumpMap: TEX.laterite, bumpScale: 1.2 }),
    wood: std({ map: TEX.wood, roughness: 0.75 }),
    roof: std({ map: TEX.roof, bumpMap: TEX.roof, bumpScale: 2.5, side: THREE.DoubleSide, roughness: 0.85 }),
    thatch: std({ map: TEX.thatch, bumpMap: TEX.thatch, bumpScale: 2, side: THREE.DoubleSide, roughness: 1 }),
    stone: std({ map: TEX.stone, roughness: 0.9 }),
    plank: std({ map: TEX.plank, roughness: 0.9 }),
    sack: std({ map: TEX.sack, roughness: 1 }),
    paint: std({ roughness: 0.8 }),
    brass: std({ color: 0xffffff, roughness: 0.32, metalness: 0.55, emissive: 0x3a2606, emissiveIntensity: 0.6 }),
    net: std({ map: TEX.net, transparent: true, alphaTest: 0.2, side: THREE.DoubleSide, depthWrite: false }),
  };
}

export class Builder {
  constructor() {
    this.g = {};
    this.m = new THREE.Matrix4();
    this.ox = 0; this.oy = 0; this.oz = 0; this.ry = 0;
    this.yards = []; this.keepClear = []; this.marks = []; this.lamps = [];
  }
  gb(mat) { return this.g[mat] || (this.g[mat] = new GB()); }
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
  collider(x, z, hw, hd, ry = 0, top = 50) {
    const p = this.world(x, 0, z);
    addBox(p.x, p.z, hw, hd, this.ry + ry, this.oy + top);
    return this;
  }
  circle(x, z, r) { const p = this.world(x, 0, z); addCircle(p.x, p.z, r); return this; }
  platform(x, z, hw, hd, y) {
    const p = this.world(x, 0, z);
    addPlatform(p.x, p.z, hw, hd, this.ry, this.oy + y);
    return this;
  }
  yard(r, s = 0.8, x = 0, z = 0) { const p = this.world(x, 0, z); this.yards.push({ x: p.x, z: p.z, r, s }); return this; }
  clear(r, x = 0, z = 0) { const p = this.world(x, 0, z); this.keepClear.push({ x: p.x, z: p.z, r }); return this; }
  mark(w, d, x = 0, z = 0) { const p = this.world(x, 0, z); this.marks.push({ x: p.x, z: p.z, w, d, rot: this.ry }); return this; }
  lamp(x, y, z, size = 1, light = 0) {
    const p = this.world(x, y, z);
    this.lamps.push({ x: p.x, y: p.y, z: p.z, size, light });
    return this;
  }
  finish(scene, mats) {
    const out = {};
    for (const k in this.g) {
      const mesh = new THREE.Mesh(this.g[k].build(), mats[k]);
      mesh.castShadow = k !== 'net';
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      scene.add(mesh);
      out[k] = mesh;
    }
    return out;
  }
}
