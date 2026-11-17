// Traffic: bullock carts plodding along the roads near the player, ferries
// crossing on a timetable, and canoes threading the mangrove channels.
import * as THREE from 'three/webgpu';
import { G } from '../state.js';
import { W, getHeight, nearestRoad } from '../world/data.js';
import { placeById as P, MANGROVE } from '../world/layout.js';
import { makeRng, pointInPoly } from '../world/noise.js';
import { pbr } from './textures.js';
import { materials } from './buildings/kit.js';
import { hullGeometry } from './props.js';

const TAU = Math.PI * 2;
const CARTS = 7, CART_R = 260;

function woodMat(color = 0x6a4a34) {
  const s = pbr('wood');
  return new THREE.MeshStandardNodeMaterial({ map: s.map, normalMap: s.normalMap, roughnessMap: s.arm, color, roughness: 1 });
}

function makeOx(mat, hornMat) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.15, 4, 10), mat); body.rotation.z = Math.PI / 2; body.position.y = 1.15;
  const hump = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), mat); hump.position.set(0.45, 1.6, 0);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.36, 0.32), mat); head.position.set(1.15, 1.25, 0); head.rotation.z = -0.5;
  g.add(body, hump, head);
  for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.42, 5), hornMat); h.position.set(1.12, 1.58, s * 0.13); h.rotation.x = s * 0.5; g.add(h); }
  const legs = [];
  for (const [lx, lz] of [[0.55, 0.22], [0.55, -0.22], [-0.55, 0.22], [-0.55, -0.22]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.95, 6), mat); leg.geometry.translate(0, -0.47, 0);
    leg.position.set(lx, 0.95, lz); g.add(leg); legs.push(leg);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { g, legs };
}

function makeCart(M, wood) {
  const root = new THREE.Group();
  const cart = new THREE.Group();
  const bed = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 1.5), M.planks); bed.position.y = 1.0;
  cart.add(bed);
  // arched thatch hood, like the rice boats
  const hood = new THREE.CylinderGeometry(0.85, 0.85, 2.2, 12, 1, true, 0, Math.PI); hood.rotateZ(Math.PI / 2); hood.rotateX(Math.PI / 2);
  const hm = new THREE.Mesh(hood, M.thatch); hm.position.set(-0.15, 1.08, 0); cart.add(hm);
  const wheels = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.1, 14), wood); w.rotation.x = Math.PI / 2; w.position.set(-0.2, 0.72, s * 0.85);
    cart.add(w); wheels.push(w);
    for (let k = 0; k < 3; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.06, 0.05), wood); sp.rotation.z = k * Math.PI / 3; w.add(sp); sp.rotation.set(0, 0, 0); sp.rotation.y = k * Math.PI / 3; }
  }
  const pole = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.1, 0.1), wood); pole.position.set(2.4, 1.05, 0); cart.add(pole);
  const yoke = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.5), wood); yoke.position.set(3.4, 1.55, 0); cart.add(yoke);
  cart.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  root.add(cart);
  const oxMat = new THREE.MeshStandardNodeMaterial({ color: 0xd8d2c6, roughness: 0.95 });
  const horn = new THREE.MeshStandardNodeMaterial({ color: 0x2a2018, roughness: 0.6 });
  const oxen = [-0.42, 0.42].map((z) => { const o = makeOx(oxMat, horn); o.g.position.set(3.0, 0, z); root.add(o.g); return o; });
  return { root, wheels, oxen };
}

export class Traffic {
  constructor(scene) { this.scene = scene; this.rnd = makeRng(4242); this.carts = []; this.ferries = []; this.canoes = []; }

  build() {
    const M = materials(), wood = woodMat();
    this.wood = wood;
    for (let i = 0; i < CARTS; i++) {
      const c = makeCart(M, wood);
      c.root.visible = false;
      this.scene.add(c.root);
      c.coll = { x: 0, z: 0, r: 1.6, y: -999 };
      G.colliders.dyn.push(c.coll);
      this.carts.push(c);
    }
    // ferries on their timetabled crossings
    const ud = this.scene.userData;
    const routes = [...(ud.ferries || [])];
    if (ud.namedJetty?.kalliyar_ferry && ud.namedJetty?.kalliyar_south) routes.push({ name: 'kalliyar', a: ud.namedJetty.kalliyar_ferry, b: ud.namedJetty.kalliyar_south });
    for (const r of routes) {
      const g = new THREE.Group();
      const hull = new THREE.Mesh(hullGeometry(11, 3.4, 0.9, 0.5, 18), wood); hull.castShadow = true;
      const deck = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.12, 3.0), M.planks); deck.position.y = 0.92;
      const can = new THREE.CylinderGeometry(1.5, 1.5, 4.5, 12, 1, true, 0, Math.PI); can.rotateZ(Math.PI / 2); can.rotateX(Math.PI / 2);
      const canopy = new THREE.Mesh(can, M.thatch); canopy.position.set(-1.5, 0.95, 0); canopy.castShadow = true;
      const poleM = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 4.5, 5), wood); poleM.position.set(4, 2.2, 0.8); poleM.rotation.z = 0.35;
      g.add(hull, deck, canopy, poleM);
      this.scene.add(g);
      this.ferries.push({ g, a: r.a, b: r.b, t: this.rnd() * 60, ph: this.rnd() * TAU });
    }
    // canoes in the mangrove maze
    const vallam = new THREE.Mesh(hullGeometry(6.5, 0.85, 0.42, 0.45), wood); vallam.castShadow = true;
    const m = P.mangrove;
    for (let i = 0; i < 6; i++) {
      for (let k = 0; k < 60; k++) {
        const a = this.rnd() * TAU, d = this.rnd() * m.r;
        const x = m.x + Math.cos(a) * d, z = m.z + Math.sin(a) * d;
        if (getHeight(x, z) < -0.5) {
          const b = vallam.clone(); this.scene.add(b);
          this.canoes.push({ o: b, x, z, h: this.rnd() * TAU, ph: this.rnd() * TAU, speed: 1.2 + this.rnd() * 0.8 });
          break;
        }
      }
    }
  }

  prefill(focus) { for (const c of this.carts) for (let k = 0; k < 20 && !c.active; k++) this.spawnCart(c, focus); }

  spawnCart(c, focus) {
    const r = this.rnd;
    const a = r() * TAU, d = 90 + r() * (CART_R - 100);
    const rd = nearestRoad(focus.x + Math.cos(a) * d, focus.z + Math.sin(a) * d);
    if (!rd.seg || rd.d > 60 || rd.seg.type === 'trail') return false;
    const line = W.meta.roads.find((q) => q.name === rd.seg.name).line;
    let k = 0, kd = Infinity;
    for (let i = 0; i < line.length; i++) { const dd = Math.hypot(line[i][0] - rd.px, line[i][1] - rd.pz); if (dd < kd) { kd = dd; k = i; } }
    c.line = line; c.i = k; c.dir = r() < 0.5 ? 1 : -1; c.side = -1.4 * c.dir; // keep left
    c.x = line[k][0]; c.z = line[k][1]; c.yaw = 0; c.speed = 1.3 + r() * 0.4; c.active = true; c.root.visible = true; c.wait = 0;
    return true;
  }

  update(dt, focus) {
    const t = G.time;
    // carts: only on the main roads near the player, a few at a time
    for (const c of this.carts) {
      if (!c.active) { if (this.rnd() < dt * 0.3) this.spawnCart(c, focus); continue; }
      const next = c.line[c.i + c.dir];
      if (!next || Math.hypot(c.x - focus.x, c.z - focus.z) > CART_R + 60) { c.active = false; c.root.visible = false; c.coll.y = -999; continue; }
      const a = c.line[c.i], tx = next[0] - a[0], tz = next[1] - a[1], l = Math.hypot(tx, tz) || 1;
      const gx = next[0] - tz / l * c.side, gz = next[1] + tx / l * c.side;
      const dx = gx - c.x, dz = gz - c.z, d = Math.hypot(dx, dz);
      // wait for the player standing in the way
      const pp = G.player?.pos;
      const block = pp && Math.hypot(pp.x - (c.x + Math.sin(c.yaw) * 4), pp.z - (c.z + Math.cos(c.yaw) * 4)) < 2.5;
      if (d < 1.5) c.i += c.dir;
      else if (!block) {
        c.x += dx / d * c.speed * dt; c.z += dz / d * c.speed * dt;
        const want = Math.atan2(dx, dz);
        const dy = ((want - c.yaw + Math.PI) % TAU + TAU) % TAU - Math.PI;
        c.yaw += dy * Math.min(1, dt * 1.5);
        c.wheelA = (c.wheelA || 0) + c.speed * dt / 0.72;
        c.step = (c.step || 0) + dt * c.speed * 2.2;
      }
      const y = Math.max(getHeight(c.x, c.z), G.colliders.deckHeight(c.x, c.z, getHeight(c.x, c.z) + 9) || -1e9);
      c.root.position.set(c.x, y, c.z);
      c.root.rotation.y = c.yaw - Math.PI / 2; // model faces +x
      for (const w of c.wheels) w.rotation.y = -(c.wheelA || 0);
      for (const o of c.oxen) o.legs.forEach((leg, k) => { leg.rotation.z = Math.sin((c.step || 0) + (k % 2 ? Math.PI : 0) + (k > 1 ? Math.PI / 2 : 0)) * 0.35; });
      c.coll.x = c.x + Math.sin(c.yaw) * 1.5; c.coll.z = c.z + Math.cos(c.yaw) * 1.5; c.coll.y = y;
    }
    // ferries: 25 s at each landing, ~50 s crossing
    for (const f of this.ferries) {
      f.t += dt;
      const cycle = 150, u = f.t % cycle;
      let s;
      if (u < 25) s = 0; else if (u < 75) s = (u - 25) / 50; else if (u < 100) s = 1; else s = 1 - (u - 100) / 50;
      const e = s * s * (3 - 2 * s);
      const ax = f.a.x, az = f.a.z, bx = f.b.x, bz = f.b.z;
      f.g.position.set(ax + (bx - ax) * e, Math.sin(t * 1.1 + f.ph) * 0.05, az + (bz - az) * e);
      f.g.rotation.y = Math.atan2(-(bz - az), bx - ax);
      f.g.rotation.z = Math.sin(t * 0.8 + f.ph) * 0.02;
    }
    // canoes: wander the channels, steering away from the banks
    for (const c of this.canoes) {
      const look = (ang, dist) => getHeight(c.x + Math.sin(ang) * dist, c.z + Math.cos(ang) * dist);
      if (look(c.h, 10) > -0.4) {
        const l = look(c.h - 0.6, 10), r = look(c.h + 0.6, 10);
        c.h += (l < r ? -1 : 1) * dt * 1.6;
      } else c.h += Math.sin(t * 0.13 + c.ph) * dt * 0.15;
      if (look(c.h, 2) < -0.3) { c.x += Math.sin(c.h) * c.speed * dt; c.z += Math.cos(c.h) * c.speed * dt; }
      if (!pointInPoly(c.x, c.z, MANGROVE) && Math.hypot(c.x - P.mangrove.x, c.z - P.mangrove.z) > P.mangrove.r) c.h = Math.atan2(P.mangrove.x - c.x, P.mangrove.z - c.z);
      c.o.position.set(c.x, Math.sin(t * 1.4 + c.ph) * 0.04, c.z);
      c.o.rotation.y = c.h - Math.PI / 2;
    }
  }
}
