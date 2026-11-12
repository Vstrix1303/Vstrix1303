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

// ---------------------------------------------------------------------------
// Lofted-surface builder with optional skinning data. A "loft" sweeps a ring
// of `seg` vertices through a list of elliptical cross-sections, which is how
// every organic model in the game (people, horses, elephants) is made.
//   ring: { c:[x,y,z], ax:[x,y,z], az:[x,y,z], v:0..1, w:[[bone,weight],…] | fn, mod:fn(theta)->scale }
//   vertex = c + ax*sin(theta)*m + az*cos(theta)*m, theta = 2πk/seg + π  (k=0 is the back seam)
export class SGB {
  constructor(texSize = 512) { this.p = []; this.n = []; this.uv = []; this.si = []; this.sw = []; this.i = []; this.T = texSize; }
  get count() { return this.p.length / 3; }
  _skin(w) {
    const a = [0, 0, 0, 0], b = [0, 0, 0, 0];
    let s = 0;
    for (let k = 0; k < Math.min(4, w.length); k++) { a[k] = w[k][0]; b[k] = w[k][1]; s += w[k][1]; }
    if (s <= 0) { b[0] = 1; s = 1; }
    this.si.push(a[0], a[1], a[2], a[3]); this.sw.push(b[0] / s, b[1] / s, b[2] / s, b[3] / s);
  }
  loft(rings, seg, region, o = {}) {
    const base = this.count, W = seg + 1, R = rings.length, T = this.T;
    const [x0, y0, x1, y1] = region;
    const P = [];
    for (let j = 0; j < R; j++) {
      const r = rings[j];
      for (let k = 0; k <= seg; k++) {
        const th = (k / seg) * Math.PI * 2 + Math.PI;
        const m = r.mod ? r.mod(th, k / seg) : 1;
        const s = Math.sin(th) * m, c = Math.cos(th) * m;
        const zv = c < 0 && r.azB ? r.azB : r.az;
        P.push([r.c[0] + r.ax[0] * s + zv[0] * c, r.c[1] + r.ax[1] * s + zv[1] * c, r.c[2] + r.ax[2] * s + zv[2] * c]);
      }
    }
    const at = (j, k) => P[j * W + (((k % seg) + seg) % seg)];
    // orientation test on the widest ring
    let flip = false;
    {
      const j = Math.min(R - 2, Math.max(0, (R / 2) | 0)), k = (seg / 4) | 0;
      const a = at(j, k), b = at(j, k + 1), d = at(j + 1, k), c = rings[j].c;
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      flip = nx * (a[0] - c[0]) + ny * (a[1] - c[1]) + nz * (a[2] - c[2]) < 0;
    }
    for (let j = 0; j < R; j++) {
      const r = rings[j];
      for (let k = 0; k <= seg; k++) {
        const p = P[j * W + k];
        const a = at(j, k - 1), b = at(j, k + 1), d0 = P[Math.max(0, j - 1) * W + k], d1 = P[Math.min(R - 1, j + 1) * W + k];
        const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d1[0] - d0[0], vy = d1[1] - d0[1], vz = d1[2] - d0[2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        let l = Math.hypot(nx, ny, nz);
        if (l < 1e-9) { nx = p[0] - r.c[0]; ny = p[1] - r.c[1]; nz = p[2] - r.c[2]; l = Math.hypot(nx, ny, nz) || 1; }
        else if (flip) { nx = -nx; ny = -ny; nz = -nz; }
        this.p.push(p[0], p[1], p[2]); this.n.push(nx / l, ny / l, nz / l);
        const u = o.mirrorU ? 1 - k / seg : k / seg;
        this.uv.push((x0 + (x1 - x0) * u) / T, 1 - (y0 + (y1 - y0) * r.v) / T);
        const th = (k / seg) * Math.PI * 2 + Math.PI;
        this._skin(typeof r.w === 'function' ? r.w(th, p) : (r.w || [[0, 1]]));
      }
    }
    for (let j = 0; j < R - 1; j++) for (let k = 0; k < seg; k++) {
      const a = base + j * W + k, b = a + 1, d = a + W, c = d + 1;
      if (flip) this.i.push(a, d, b, b, d, c); else this.i.push(a, b, d, b, c, d);
    }
    const cap = (j, h, end) => {
      const r = rings[j];
      // axis from neighbouring ring
      const nb = rings[end ? j - 1 : j + 1];
      let ax = r.c[0] - nb.c[0], ay = r.c[1] - nb.c[1], az = r.c[2] - nb.c[2];
      const l = Math.hypot(ax, ay, az) || 1; ax /= l; ay /= l; az /= l;
      const ci = this.count;
      this.p.push(r.c[0] + ax * h, r.c[1] + ay * h, r.c[2] + az * h); this.n.push(ax, ay, az);
      this.uv.push((x0 + (x1 - x0) * 0.5) / T, 1 - (y0 + (y1 - y0) * r.v) / T);
      this._skin(typeof r.w === 'function' ? r.w(0, r.c) : (r.w || [[0, 1]]));
      for (let k = 0; k < seg; k++) {
        const a = base + j * W + k, b = a + 1;
        if (end !== flip) this.i.push(a, b, ci); else this.i.push(a, ci, b);
      }
    };
    if (o.capStart != null) cap(0, o.capStart, false);
    if (o.capEnd != null) cap(R - 1, o.capEnd, true);
    return this;
  }
  build(skinned = true) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    if (skinned) {
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
      g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    }
    g.setIndex(this.i);
    g.computeBoundingSphere();
    return g;
  }
}
