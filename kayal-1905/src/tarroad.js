// The tarred roads of 1957: the trunk road through Thekkumkara and the road north to the port are
// black-topped, a little narrower than their laterite beds so a red shoulder shows on either side;
// the village lanes stay earth. The tar is its own surface laid over the ground, following it along
// and across the road, its edges ragged and darker where the tar thins out. White milestones with
// yellow caps stand by the trunk road every two hundred metres.
import * as THREE from 'three';
import { ROADS, getHeight } from './heightfield.js';
import { REAL, hasReal, realMaterial } from './assets.js';
import { addCircle } from './physics.js';
import { makeRng } from './util.js';

const TAR = { main: 5.0, north: 4.2, quay: 5.0, ptMain: 5.0, ptCross: 4.2, ptEast: 3.8 };

// a drawn asphalt for the browser build: dark grain, patches, cracks
function drawnAsphalt() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'), rng = makeRng(57);
  g.fillStyle = '#3a3936'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 26000; i++) { const v = 40 + rng() * 50 | 0; g.fillStyle = `rgba(${v},${v - 2},${v - 5},0.5)`; g.fillRect(rng() * 512, rng() * 512, 1 + rng() * 2, 1 + rng() * 2); }
  for (let i = 0; i < 14; i++) { const v = 44 + rng() * 22 | 0; g.fillStyle = `rgba(${v},${v},${v - 3},0.55)`; g.beginPath(); g.ellipse(rng() * 512, rng() * 512, 20 + rng() * 60, 12 + rng() * 40, rng() * 3, 0, 7); g.fill(); }
  g.strokeStyle = 'rgba(18,17,15,0.55)'; g.lineWidth = 1.2;
  for (let i = 0; i < 30; i++) { let x = rng() * 512, y = rng() * 512; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (rng() - 0.5) * 30; y += (rng() - 0.5) * 30; g.lineTo(x, y); } g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export function buildTarRoads(scene) {
  const rng = makeRng(1957);
  const pos = [], col = [], uv = [], idx = [];
  const COLS = 5;                                  // vertices across the road, so it follows the camber of the ground
  for (const key in TAR) {
    const pts = ROADS[key]; if (!pts) continue;
    const half = TAR[key] / 2;
    let run = 0, base = -1;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)];
      let tx = q[0] - o[0], tz = q[1] - o[1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
      if (i) run += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
      const wet = getHeight(p[0], p[1]) < 0.15;       // over water: the bridges carry the road, not the tar
      if (wet) { base = -1; continue; }
      const row = pos.length / 3;
      const jl = (rng() - 0.5) * 0.3, jr = (rng() - 0.5) * 0.3;
      for (let k = 0; k < COLS; k++) {
        const f = k / (COLS - 1), off = -half - jl + (2 * half + jl + jr) * f;
        const x = p[0] + tz * off, z = p[1] - tx * off;
        pos.push(x, getHeight(x, z) + 0.035, z);
        const edge = Math.min(f, 1 - f) * (COLS - 1), shade = edge < 0.5 ? 0.72 + rng() * 0.08 : 0.92 + rng() * 0.08;
        col.push(shade, shade, shade);
        uv.push(f * TAR[key] / 4, run / 4);
      }
      if (base >= 0) for (let k = 0; k < COLS - 1; k++) { const a = base + k, b = row + k; idx.push(a, b, a + 1, a + 1, b, b + 1); }
      base = row;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
  const mat = hasReal() && REAL.asphalt ? realMaterial('asphalt', { repeat: 1, ao: 0.4, tint: [0.46, 0.44, 0.42] }) : new THREE.MeshStandardMaterial({ map: drawnAsphalt(), vertexColors: true, roughness: 0.92 });
  mat.polygonOffset = true; mat.polygonOffsetFactor = -2; mat.polygonOffsetUnits = -2;
  const road = new THREE.Mesh(g, mat);
  road.receiveShadow = true; road.layers.set(1);
  scene.add(road);

  // milestones along the trunk road
  const stone = new THREE.Group();
  const ms = [], pts = ROADS.main || [];
  let run = 0, next = 60;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    while (next <= run + seg) {
      const t = (next - run) / seg, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t, tx = (b[0] - a[0]) / seg, tz = (b[1] - a[1]) / seg;
      const mx = x + tz * 3.6, mz = z - tx * 3.6;
      if (getHeight(mx, mz) > 0.3) ms.push([mx, getHeight(mx, mz), mz, Math.atan2(tx, tz)]);
      next += 200;
    }
    run += seg;
  }
  if (ms.length) {
    const body = new THREE.BoxGeometry(0.42, 0.55, 0.18).translate(0, 0.275, 0), cap = new THREE.CylinderGeometry(0.21, 0.21, 0.18, 10, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).translate(0, 0.55, 0);
    const white = new THREE.InstancedMesh(body, new THREE.MeshStandardMaterial({ color: 0xece8dc, roughness: 0.85 }), ms.length);
    const yellow = new THREE.InstancedMesh(cap, new THREE.MeshStandardMaterial({ color: 0xd8a830, roughness: 0.7 }), ms.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
    ms.forEach(([x, y, z, ry], i) => { m4.compose(v.set(x, y - 0.05, z), q.setFromAxisAngle(up, ry), one); white.setMatrixAt(i, m4); yellow.setMatrixAt(i, m4); addCircle(x, z, 0.25); });
    for (const im of [white, yellow]) { im.castShadow = true; im.receiveShadow = true; im.layers.set(1); stone.add(im); }
    scene.add(stone);
  }
  return road;
}
