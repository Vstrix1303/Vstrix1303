// Villagers: a small pool of people that live around the player. They walk the
// road edges between settlements, browse the bazaar shop fronts, stand on the
// shore by the fishing hamlets, and thin out at night. Placeholder bodies are
// clones of the Xbot mannequin, tinted by role.
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { G, U } from '../state.js';
import { W, getHeight, nearestRoad } from '../world/data.js';
import { PLACES, placeById as P } from '../world/layout.js';
import { makeRng } from '../world/noise.js';

const TAU = Math.PI * 2;
const MAX = 26, RADIUS = 160;
// clothing washes: white mundu, saffron, indigo, earth, khaki (officials), red
const ROLES = [
  { name: 'villager', body: 0xf2ece0, w: 4 }, { name: 'trader', body: 0xd89a3a, w: 2 },
  { name: 'fisher', body: 0x3a4f6e, w: 2 }, { name: 'farmer', body: 0x8a6a48, w: 2 },
  { name: 'official', body: 0xb8a878, w: 1 }, { name: 'pilgrim', body: 0xa83a2a, w: 1 },
];
// how lively each place is (0..1)
const LIVELY = { vaikara_town: 1, old_bazaar: 1, river_ghat: 0.9, district_court: 0.7, juma_mosque: 0.6, ponnambalam: 0.7, st_thomas: 0.5, puliyur: 0.6, karimulam: 0.6, muthalappuzha: 0.7, veliyathura: 0.6, kayalore: 0.5, southern_ferry: 0.5, kalliyar_ferry: 0.5, hill_trading_post: 0.4, thenga_paddy: 0.3, kanmala: 0.5, salt_pans: 0.3, residency: 0.3, bridge: 0.6 };

const hourFactor = (h) => {
  if (h < 5.5 || h > 21.5) return 0.05;
  if (h < 7) return 0.3 + (h - 5.5) / 1.5 * 0.5;
  if (h < 11) return 1;
  if (h < 15) return 0.6;
  if (h < 19) return 1;
  return 1 - (h - 19) / 2.5 * 0.85;
};

export class Villagers {
  constructor(scene) { this.scene = scene; this.pool = []; this.rnd = makeRng(77); this.timer = 0; }

  async load() {
    const gltf = await new GLTFLoader().loadAsync(`${G.base}models/Xbot.glb`);
    this.clips = {};
    for (const n of ['idle', 'walk']) this.clips[n] = gltf.animations.find((a) => a.name.toLowerCase() === n);
    // shared tinted material sets, one per role
    const sets = ROLES.map((r) => {
      const map = new Map();
      gltf.scene.traverse((o) => {
        if (!o.isMesh || map.has(o.material)) return;
        const m = o.material.clone();
        const joints = /joint/i.test(o.material.name || o.name);
        m.color = new THREE.Color(joints ? 0x3a2a20 : r.body);
        m.roughness = 0.85; m.metalness = 0;
        map.set(o.material, m);
      });
      return map;
    });
    const roleBag = ROLES.flatMap((r, i) => Array(r.w).fill(i));
    for (let i = 0; i < MAX; i++) {
      const root = skeletonClone(gltf.scene);
      const role = roleBag[i % roleBag.length];
      root.traverse((o) => {
        if (o.isMesh) { o.material = sets[role].get(o.material) || o.material; o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; }
      });
      root.scale.setScalar(0.92 + this.rnd() * 0.14);
      root.visible = false;
      this.scene.add(root);
      const mixer = new THREE.AnimationMixer(root);
      const idle = mixer.clipAction(this.clips.idle), walk = mixer.clipAction(this.clips.walk);
      idle.play(); walk.play();
      idle.time = this.rnd() * 3; walk.time = this.rnd() * 3;
      this.pool.push({ root, mixer, idle, walk, role: ROLES[role].name, active: false, coll: { x: 0, z: 0, r: 0.35, y: -999 } });
    }
    const ud = this.scene.userData;
    this.fronts = ud.shopFronts || [];
    this.shore = ud.shoreSpots || [];
  }

  liveliness(x, z) {
    let best = 0;
    for (const p of PLACES) {
      const L = LIVELY[p.id];
      if (!L) continue;
      const d = Math.hypot(x - p.x, z - p.z);
      best = Math.max(best, L * THREE.MathUtils.smoothstep(p.r * 1.5, p.r * 0.4, d));
    }
    return best;
  }

  // a walking route along the road edge, starting near (x, z)
  route(x, z) {
    const rd = nearestRoad(x, z);
    if (!rd.seg || rd.d > 40) return null;
    const line = W.meta.roads.find((r) => r.name === rd.seg.name).line;
    let k = 0, kd = Infinity;
    for (let i = 0; i < line.length; i++) { const d = Math.hypot(line[i][0] - rd.px, line[i][1] - rd.pz); if (d < kd) { kd = d; k = i; } }
    const dir = this.rnd() < 0.5 ? 1 : -1;
    const side = (this.rnd() < 0.5 ? -1 : 1) * ({ main: 3.6, road: 2.8, trail: 1.3 }[rd.seg.type] || 2.5);
    const pts = [];
    for (let i = k, n = 0; i >= 0 && i < line.length && n < 60; i += dir, n++) {
      const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)];
      const tx = b[0] - a[0], tz = b[1] - a[1], l = Math.hypot(tx, tz) || 1;
      pts.push([line[i][0] - tz / l * side, line[i][1] + tx / l * side]);
    }
    return pts.length > 2 ? pts : null;
  }

  spawn(n, focus) {
    const r = this.rnd;
    // where: 0 bazaar browser · 1 shore fisher · 2 road walker
    const kind = r();
    if (kind < 0.35 && this.fronts.length) {
      const f = this.fronts[Math.floor(r() * this.fronts.length)];
      const d = Math.hypot(f.x - focus.x, f.z - focus.z);
      if (d > RADIUS * 0.9 || d < 25) return false;
      Object.assign(n, { mode: 'idle', x: f.x + (r() - 0.5) * 2, z: f.z + (r() - 0.5) * 2, yaw: f.ry + Math.PI + (r() - 0.5) * 1.2, wait: 8 + r() * 25, after: 'wander' });
    } else if (kind < 0.5 && this.shore.length) {
      const s = this.shore[Math.floor(r() * this.shore.length)];
      const d = Math.hypot(s.x - focus.x, s.z - focus.z);
      if (d > RADIUS * 0.9 || d < 25 || getHeight(s.x, s.z) < 0.3) return false;
      Object.assign(n, { mode: 'idle', x: s.x, z: s.z, yaw: Math.atan2(Math.cos(s.face), Math.sin(s.face)), wait: 20 + r() * 60, after: 'wander' });
    } else {
      const a = r() * TAU, d = 40 + r() * (RADIUS - 50);
      const x = focus.x + Math.cos(a) * d, z = focus.z + Math.sin(a) * d;
      if (r() > this.liveliness(x, z) * 1.2) return false;
      const pts = this.route(x, z);
      if (!pts) return false;
      Object.assign(n, { mode: 'walk', pts, i: 0, x: pts[0][0], z: pts[0][1], yaw: 0, speed: 1.15 + r() * 0.45 });
    }
    n.active = true; n.root.visible = true; n.fade = 0;
    if (!G.colliders.dyn.includes(n.coll)) G.colliders.dyn.push(n.coll);
    return true;
  }

  // fill the neighbourhood at once (game start, after travelling)
  prefill(focus) {
    const target = Math.round(MAX * hourFactor(G.hour) * Math.min(1, this.liveliness(focus.x, focus.z) * 1.4 + 0.15));
    for (let tries = 0; tries < 400 && this.count < target; tries++) {
      const n = this.pool.find((q) => !q.active); if (!n) break;
      this.spawn(n, focus);
    }
    // stagger walkers along their routes
    for (const n of this.pool) if (n.active && n.mode === 'walk') { n.i = Math.floor(this.rnd() * Math.min(4, n.pts.length - 2)); [n.x, n.z] = n.pts[n.i]; }
  }

  retire(n) {
    n.active = false; n.root.visible = false; n.coll.y = -999;
  }

  update(dt, focus, camera) {
    if (!this.pool.length) return;
    const target = Math.round(MAX * hourFactor(G.hour) * (1 - U.rain.value * 0.75) * Math.min(1, this.liveliness(focus.x, focus.z) * 1.4 + 0.15));
    const active = this.pool.filter((n) => n.active);
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 0.4;
      if (active.length < target) { const n = this.pool.find((q) => !q.active); if (n) this.spawn(n, focus); }
      else if (active.length > target + 2) {
        // retire the farthest one that is out of sight
        const far = active.sort((a, b) => Math.hypot(b.x - focus.x, b.z - focus.z) - Math.hypot(a.x - focus.x, a.z - focus.z))[0];
        if (far && Math.hypot(far.x - focus.x, far.z - focus.z) > 70) this.retire(far);
      }
    }
    for (const n of active) {
      const dist = Math.hypot(n.x - focus.x, n.z - focus.z);
      if (dist > RADIUS + 30) { this.retire(n); continue; }
      let moving = 0;
      if (n.mode === 'walk') {
        const tgt = n.pts[n.i + 1];
        if (!tgt) { n.mode = 'idle'; n.wait = 3 + this.rnd() * 10; n.after = 'retireOrRoute'; }
        else {
          const dx = tgt[0] - n.x, dz = tgt[1] - n.z, d = Math.hypot(dx, dz);
          // give way to the player
          const px = G.player ? G.player.pos.x - n.x : 99, pz = G.player ? G.player.pos.z - n.z : 99;
          const blocked = Math.hypot(px, pz) < 1.4 && (px * dx + pz * dz) > 0;
          if (d < 0.8) n.i++;
          else if (!blocked) {
            const s = Math.min(d, n.speed * dt);
            n.x += dx / d * s; n.z += dz / d * s;
            const want = Math.atan2(dx, dz);
            let dy = ((want - n.yaw + Math.PI) % TAU + TAU) % TAU - Math.PI;
            n.yaw += dy * Math.min(1, dt * 6);
            moving = 1;
          }
        }
      } else {
        n.wait -= dt;
        if (n.wait <= 0) {
          const pts = this.route(n.x, n.z);
          if (pts && (n.after !== 'retireOrRoute' || this.rnd() < 0.6)) { n.mode = 'walk'; n.pts = pts; n.i = 0; n.speed = 1.1 + this.rnd() * 0.4; }
          else if (dist > 60) { this.retire(n); continue; }
          else n.wait = 5 + this.rnd() * 10;
        }
      }
      const y = Math.max(getHeight(n.x, n.z), G.colliders.deckHeight(n.x, n.z, getHeight(n.x, n.z) + 9) || -1e9);
      n.root.position.set(n.x, y, n.z);
      n.root.rotation.y = n.yaw;
      n.coll.x = n.x; n.coll.z = n.z; n.coll.y = y;
      // blend idle ↔ walk; animate only when reasonably close
      n.blend = THREE.MathUtils.damp(n.blend || 0, moving, 6, dt);
      n.walk.setEffectiveWeight(n.blend); n.idle.setEffectiveWeight(1 - n.blend);
      n.walk.timeScale = (n.speed || 1.2) / 1.25;
      if (dist < 90 || (n.lastAnim = (n.lastAnim || 0) + dt) > 0.1) { n.mixer.update(dist < 90 ? dt : n.lastAnim); n.lastAnim = 0; }
    }
    void camera; void P;
  }

  get count() { return this.pool.filter((n) => n.active).length; }
}
