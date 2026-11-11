// Minimal geometry builder used for all hand-made meshes.
import * as THREE from 'three';

export class GB {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.i = []; }
  get count() { return this.p.length / 3; }
  vert(x, y, z, nx, ny, nz, u, v, r = 1, g = 1, b = 1) {
    this.p.push(x, y, z); this.n.push(nx, ny, nz); this.uv.push(u, v); this.c.push(r, g, b);
    return this.p.length / 3 - 1;
  }
  tri(a, b, c) { this.i.push(a, b, c); }
  quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); }

  // tube along a path. pathFn(t)->[x,y,z], radFn(t)->r
  tube(pathFn, radFn, rings, rad, vLen = 1, col = [1, 1, 1], uRep = 2, cap = false) {
    const base = this.count;
    const P = [];
    for (let j = 0; j <= rings; j++) P.push(pathFn(j / rings));
    for (let j = 0; j <= rings; j++) {
      const t = j / rings, c = P[j];
      // frame: tangent from neighbours
      const a = P[Math.max(0, j - 1)], b = P[Math.min(rings, j + 1)];
      const tan = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
      const ref = Math.abs(tan.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      const bx = new THREE.Vector3().crossVectors(ref, tan).normalize();
      const bz = new THREE.Vector3().crossVectors(tan, bx).normalize();
      const r = radFn(t);
      for (let k = 0; k <= rad; k++) {
        const ang = k / rad * Math.PI * 2, cs = Math.cos(ang), sn = Math.sin(ang);
        const nx = bx.x * cs + bz.x * sn, ny = bx.y * cs + bz.y * sn, nz = bx.z * cs + bz.z * sn;
        this.vert(c[0] + nx * r, c[1] + ny * r, c[2] + nz * r, nx, ny, nz, k / rad * uRep, t * vLen, col[0], col[1], col[2]);
      }
    }
    const w = rad + 1;
    for (let j = 0; j < rings; j++) for (let k = 0; k < rad; k++) {
      const a = base + j * w + k, b = a + 1, d = a + w, c = d + 1;
      this.i.push(a, b, d, b, c, d);
    }
    if (cap) {
      const c = P[rings];
      const ci = this.vert(c[0], c[1], c[2], 0, 1, 0, 0.5, 0.5, col[0], col[1], col[2]);
      for (let k = 0; k < rad; k++) this.i.push(base + rings * w + k, base + rings * w + k + 1, ci);
    }
    return this;
  }

  // append a three geometry transformed by matrix
  add(geo, matrix, col = [1, 1, 1], uvScale = null) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
    const v = new THREE.Vector3(), n = new THREE.Vector3();
    const nm = matrix ? new THREE.Matrix3().getNormalMatrix(matrix) : null;
    const base = this.count;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i); n.fromBufferAttribute(nor, i);
      if (matrix) { v.applyMatrix4(matrix); n.applyMatrix3(nm).normalize(); }
      let u = uv ? uv.getX(i) : 0, w = uv ? uv.getY(i) : 0;
      if (uvScale) { u *= uvScale[0]; w *= uvScale[1]; }
      this.vert(v.x, v.y, v.z, n.x, n.y, n.z, u, w, col[0], col[1], col[2]);
    }
    for (let i = 0; i < pos.count; i++) this.i.push(base + i);
    return this;
  }

  build(withColor = true) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    if (withColor) g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : this.i);
    g.computeBoundingSphere();
    return g;
  }
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
export function TRS(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  _e.set(rx, ry, rz, 'YXZ');
  _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}

// Box whose UVs tile in world units (texel density independent of size)
export function boxGeo(w, h, d, tile = 2) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k;
    uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile);
  }
  return g;
}

// Hip roof: base (w x d) at y=0, ridge of length `ridge` along X at height h
export function hipRoofGeo(w, d, h, ridge, tile = 1.6) {
  const g = new GB();
  const hw = w / 2, hd = d / 2, hr = ridge / 2;
  const slopeL = Math.hypot(hd, h), endL = Math.hypot(hw - hr, h);
  const face = (pts, uvs) => {
    const a = new THREE.Vector3(...pts[0]), b = new THREE.Vector3(...pts[1]), c = new THREE.Vector3(...pts[2]);
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    const idx = pts.map((p, i) => g.vert(p[0], p[1], p[2], n.x, n.y, n.z, uvs[i][0] / tile, uvs[i][1] / tile));
    g.tri(idx[0], idx[1], idx[2]);
    if (idx.length === 4) g.tri(idx[0], idx[2], idx[3]);
  };
  // front (+z) and back (-z) trapezoids
  face([[-hw, 0, hd], [hw, 0, hd], [hr, h, 0], [-hr, h, 0]], [[-hw, 0], [hw, 0], [hr, slopeL], [-hr, slopeL]]);
  face([[hw, 0, -hd], [-hw, 0, -hd], [-hr, h, 0], [hr, h, 0]], [[-hw, 0], [hw, 0], [hr, slopeL], [-hr, slopeL]]);
  // hip ends
  face([[hw, 0, hd], [hw, 0, -hd], [hr, h, 0]], [[-hd, 0], [hd, 0], [0, endL]]);
  face([[-hw, 0, -hd], [-hw, 0, hd], [-hr, h, 0]], [[-hd, 0], [hd, 0], [0, endL]]);
  return g.build(false);
}

// Gable roof: ridge along X full width, plus optional closed gable triangles (separate geometry)
export function gableRoofGeo(w, d, h, tile = 1.6) {
  const g = new GB();
  const hw = w / 2, hd = d / 2, sl = Math.hypot(hd, h);
  const ny = hd / sl, nz = h / sl;
  let a = g.vert(-hw, 0, hd, 0, ny, nz, -hw / tile, 0), b = g.vert(hw, 0, hd, 0, ny, nz, hw / tile, 0);
  let c = g.vert(hw, h, 0, 0, ny, nz, hw / tile, sl / tile), e = g.vert(-hw, h, 0, 0, ny, nz, -hw / tile, sl / tile);
  g.quad(a, b, c, e);
  a = g.vert(hw, 0, -hd, 0, ny, -nz, -hw / tile, 0); b = g.vert(-hw, 0, -hd, 0, ny, -nz, hw / tile, 0);
  c = g.vert(-hw, h, 0, 0, ny, -nz, hw / tile, sl / tile); e = g.vert(hw, h, 0, 0, ny, -nz, -hw / tile, sl / tile);
  g.quad(a, b, c, e);
  return g.build(false);
}
export function gableEndGeo(d, h, tile = 2) {
  // triangle in the YZ plane facing +X
  const g = new GB();
  const hd = d / 2;
  const a = g.vert(0, 0, hd, 1, 0, 0, hd / tile, 0), b = g.vert(0, 0, -hd, 1, 0, 0, -hd / tile, 0), c = g.vert(0, h, 0, 1, 0, 0, 0, h / tile);
  g.tri(a, b, c);
  return g.build(false);
}
