// Third-person traveller. Placeholder body: the Xbot mannequin from the
// three.js examples, with idle / walk / run blended by speed. Walks, runs,
// jumps, wades and swims; collides with buildings, walls and trunks; can
// stand on decks (bridge, jetties, plinths, ghat steps).
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { G } from '../state.js';
import { Input } from './input.js';
import { getHeight, getSlope } from '../world/data.js';
import { WORLD_W, WORLD_H } from '../world/layout.js';

const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const angDamp = (a, b, k, dt) => { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * (1 - Math.exp(-k * dt)); };

export class Player {
  constructor(scene, camera) {
    this.scene = scene; this.camera = camera;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.vy = 0; this.yaw = 0; this.grounded = true; this.swimming = false; this.wading = 0;
    this.camYaw = 0; this.camPitch = 0.18; this.camDist = 5.2; this.camCur = new THREE.Vector3();
    this.speed = 0;
  }

  async load() {
    try {
      const gltf = await new GLTFLoader().loadAsync(`${G.base}models/Xbot.glb`);
      const model = gltf.scene;
      model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
      this.root.add(model);
      this.mixer = new THREE.AnimationMixer(model);
      const clip = (n) => gltf.animations.find((a) => a.name.toLowerCase() === n);
      this.actions = {};
      for (const n of ['idle', 'walk', 'run']) {
        const c = clip(n);
        if (!c) continue;
        const a = this.mixer.clipAction(c);
        a.play(); a.setEffectiveWeight(n === 'idle' ? 1 : 0);
        this.actions[n] = a;
      }
    } catch (e) {
      console.warn('placeholder model failed, using a capsule', e);
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 1.1, 6, 12), new THREE.MeshStandardNodeMaterial({ color: 0xc8a070 }));
      m.position.y = 0.9; m.castShadow = true;
      this.root.add(m);
    }
  }

  teleport(x, z) {
    this.pos.set(x, Math.max(getHeight(x, z), G.colliders?.deckHeight(x, z, 1e4) ?? -1e9, -1.2), z);
    this.vy = 0; this.vel.set(0, 0, 0);
    this.camCur.set(0, 0, 0);
  }

  groundAt(x, z, footY) {
    const t = getHeight(x, z);
    const d = G.colliders.deckHeight(x, z, footY);
    return Math.max(t, d);
  }

  update(dt) {
    // camera orbit
    this.camYaw -= Input.dx * 0.0024;
    this.camPitch = THREE.MathUtils.clamp(this.camPitch + Input.dy * 0.0024, -0.5, 1.2);
    if (Input.wheel) this.camDist = THREE.MathUtils.clamp(this.camDist * (Input.wheel > 0 ? 1.15 : 0.87), 2.2, 26);

    // input → desired velocity (camera-relative)
    let ix = 0, iz = 0;
    if (Input.down('KeyW')) iz -= 1; if (Input.down('KeyS')) iz += 1;
    if (Input.down('KeyA')) ix -= 1; if (Input.down('KeyD')) ix += 1;
    const len = Math.hypot(ix, iz);
    const run = Input.down('ShiftLeft') || Input.down('ShiftRight');
    let target = 0;
    const dir = new THREE.Vector3();
    if (len > 0) {
      ix /= len; iz /= len;
      const c = Math.cos(this.camYaw), s = Math.sin(this.camYaw);
      dir.set(ix * c + iz * s, 0, -ix * s + iz * c);
      target = this.swimming ? (run ? 2.8 : 1.6) : run ? 6.4 : 2.3;
      target *= 1 - this.wading * 0.45;
      this.yaw = angDamp(this.yaw, Math.atan2(dir.x, dir.z), 10, dt);
    }
    this.speed = damp(this.speed, target, len > 0 ? 6 : 9, dt);
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const nx = this.pos.x + fx * this.speed * dt, nz = this.pos.z + fz * this.speed * dt;

    // slope limit: refuse to walk up cliffs
    const hNow = getHeight(this.pos.x, this.pos.z), hNext = getHeight(nx, nz);
    const step = this.speed * dt;
    const tooSteep = !this.swimming && step > 1e-4 && (hNext - hNow) / step > 1.3 && getSlope(nx, nz) > 0.9;
    if (!tooSteep) { this.pos.x = nx; this.pos.z = nz; }
    G.colliders.resolve(this.pos, 0.36, this.pos.y);
    const hw = WORLD_W / 2 - 20, hh = WORLD_H / 2 - 20;
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, -hw, hw);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, -hh, hh);

    // vertical: ground, decks, water
    const ground = this.groundAt(this.pos.x, this.pos.z, this.pos.y);
    const waterDepth = -ground;           // sea-level water everywhere below 0
    this.wading = THREE.MathUtils.clamp((waterDepth - 0.2) / 1.0, 0, 1);
    const swimY = -1.25;
    this.swimming = waterDepth > 1.35 && this.pos.y <= swimY + 0.3;
    if (this.swimming) {
      this.vy = 0;
      this.pos.y = damp(this.pos.y, swimY + Math.sin(G.time * 2.2) * 0.05, 6, dt);
      if (Input.down('Space')) this.pos.y = Math.min(this.pos.y + dt, swimY + 0.2);
      this.grounded = false;
    } else {
      if (this.grounded && Input.hit('Space')) { this.vy = 5.2; this.grounded = false; }
      this.vy -= 20 * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= ground) {
        // step up small ledges smoothly, fall otherwise
        this.pos.y = this.grounded && ground - this.pos.y < 0.7 ? damp(this.pos.y, ground, 25, dt) : ground;
        if (this.pos.y < ground) this.pos.y = ground;
        this.vy = 0; this.grounded = true;
      } else if (this.grounded && this.pos.y - ground < 0.45 && this.vy <= 0) {
        this.pos.y = ground; this.vy = 0;          // stick to slopes going down
      } else this.grounded = false;
      if (waterDepth > 1.35 && this.pos.y < swimY) { this.pos.y = swimY; this.vy = 0; }
    }

    // body
    this.root.position.copy(this.pos);
    this.root.rotation.set(this.swimming ? 1.25 : 0, this.yaw, 0, 'YXZ');
    if (this.swimming) this.root.position.y += 0.9;
    if (this.mixer) {
      const sp = this.speed;
      const wWalk = this.swimming ? 1 : THREE.MathUtils.clamp(sp / 2.3, 0, 1) * (1 - THREE.MathUtils.clamp((sp - 2.3) / 3, 0, 1));
      const wRun = this.swimming ? 0 : THREE.MathUtils.clamp((sp - 2.3) / 3, 0, 1);
      const wIdle = Math.max(0, 1 - wWalk - wRun);
      this.actions.idle?.setEffectiveWeight(wIdle);
      this.actions.walk?.setEffectiveWeight(wWalk);
      this.actions.run?.setEffectiveWeight(wRun);
      if (this.actions.walk) this.actions.walk.timeScale = this.swimming ? 0.5 : Math.max(0.6, sp / 1.9);
      if (this.actions.run) this.actions.run.timeScale = Math.max(0.7, sp / 6);
      this.mixer.update(dt);
    }

    // camera follow with terrain avoidance
    const tgt = new THREE.Vector3(this.pos.x, this.pos.y + (this.swimming ? 0.5 : 1.55), this.pos.z);
    const cd = this.camDist;
    const off = new THREE.Vector3(Math.sin(this.camYaw) * Math.cos(this.camPitch), Math.sin(this.camPitch), Math.cos(this.camYaw) * Math.cos(this.camPitch)).multiplyScalar(cd);
    const want = tgt.clone().add(off);
    // pull in if the terrain is in the way
    for (let t = 0.2; t <= 1.0; t += 0.2) {
      const p = tgt.clone().lerp(want, t);
      const g = Math.max(getHeight(p.x, p.z), -0.5) + 0.35;
      if (p.y < g) { want.y += (g - p.y); }
    }
    if (this.camCur.lengthSq() === 0) this.camCur.copy(want);
    this.camCur.lerp(want, 1 - Math.exp(-14 * dt));
    this.camera.position.copy(this.camCur);
    this.camera.lookAt(tgt);
  }
}
