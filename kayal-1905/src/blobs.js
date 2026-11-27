// Contact shadows: a soft dark patch on the ground under everyone who stands or walks — people,
// animals, carts — drawn as one instanced batch. Close up they deepen the sun shadow where feet and
// hooves meet the ground; beyond the sun shadow's range they are what keeps people from floating.
import * as THREE from 'three';
import { G } from './state.js';
import { groundAt } from './physics.js';

const MAX = 260;
export function setupBlobs(scene) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(0,0,0,0.62)'); grd.addColorStop(0.45, 'rgba(0,0,0,0.42)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: true });
  mat.color.setRGB(1, 1, 1);
  const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const im = new THREE.InstancedMesh(geo, mat, MAX);
  im.frustumCulled = false; im.renderOrder = 1; im.count = 0; im.layers.set(1); im.castShadow = false; im.receiveShadow = false;
  scene.add(im);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), pp = new THREE.Vector3();
  let n = 0;
  const put = (x, y, z, w, l, yaw) => {
    if (n >= MAX) return;
    q.setFromAxisAngle(up, yaw || 0); p.set(x, y + 0.035, z); s.set(w, 1, l);
    m.compose(p, q, s); im.setMatrixAt(n++, m);
  };
  // people on stools and benches: their blob goes on whatever they are sitting above
  const seatY = new WeakMap();
  G.updaters.push(() => {
    n = 0;
    const cam = G.camera.position, far = 70;
    const near = (o) => Math.abs(o.x - cam.x) < far && Math.abs(o.z - cam.z) < far;
    const pl = G.player;
    if (pl.mode === 'foot' && pl.root.visible !== false) { pl.worldPos(pp); put(pp.x, pl.grounded ? pp.y : groundAt(pp.x, pp.z, pp.y + 0.2), pp.z, 0.95, 0.95); }
    for (const nc of G.npcs) {
      if (!nc.active || !nc.root.visible || nc.attached || !near(nc.pos)) continue;
      let y = nc.pos.y;
      if (nc.fixedY) { if (!seatY.has(nc)) seatY.set(nc, groundAt(nc.pos.x, nc.pos.z, nc.pos.y + 1.2)); y = seatY.get(nc); }
      const S = nc.h.S || 1;
      if (nc.ko) put(nc.pos.x, y, nc.pos.z, 0.9 * S, 1.9 * S, nc.yaw); else put(nc.pos.x, y, nc.pos.z, 0.95 * S, 0.95 * S);
    }
    for (const t of G.world?.traffic || []) {
      if (!t.active || !near(t.pos) || t.kind === 'boat') continue;
      if (t.kind === 'walker') put(t.pos.x, t.pos.y, t.pos.z, 0.95, 0.95);
      else if (t.kind === 'motor') put(t.pos.x, t.pos.y, t.pos.z, t.wid + 0.35, t.len + 0.4, t.yaw);
      else if (t.kind === 'cyclist') put(t.pos.x, t.pos.y, t.pos.z, 0.55, 1.9, t.yaw);
      else if (t.kind === 'rider') put(t.pos.x, t.pos.y, t.pos.z, 1.1, 2.4, t.yaw);
      else { const fx = Math.sin(t.yaw), fz = Math.cos(t.yaw), L = t.len || 2.4; put(t.pos.x + fx * L * 0.55, t.pos.y, t.pos.z + fz * L * 0.55, 2.1, L * 2.2, t.yaw); }
    }
    for (const a of G.world?.animals || []) {
      if (!a.o || !a.o.root.visible || !near(a.pos)) continue;
      const big = a.o.type ? 1 : 2.1;                     // the elephants have no 'type'; cows and horses do
      put(a.pos.x, a.pos.y, a.pos.z, 1.0 * big, 2.2 * big, a.yaw);
    }
    for (const r of G.world?.rides || []) if (near(r.pos)) put(r.pos.x, r.pos.y, r.pos.z, r.kind === 'bicycle' ? 0.55 : r.spec.radius * 1.8, r.kind === 'bicycle' ? 1.9 : (r.spec.len || 3.6) + 0.4, r.yaw);
    const h = G.world?.horse;
    if (h && h.root.visible !== false && h.usable !== false && near(h.pos)) put(h.pos.x, h.pos.y, h.pos.z, 1.0, 2.4, h.yaw);
    im.count = n;
    im.instanceMatrix.needsUpdate = true;
  });
}
