// Third-person controller: on foot, in the saddle, at the paddle.
import * as THREE from 'three';
import { G } from './state.js';
import { Human, CAST, makeStick, makePaddle, makeBucket, makeRod } from './characters.js';
import { getHeight, PLAY_LIMIT } from './heightfield.js';
import { groundAt, resolve, pointInBox, interiorAt } from './physics.js';
import { clamp, damp, angleDamp, lerp, smoothstep } from './util.js';

export class Player {
  constructor(scene, camera) {
    this.scene = scene; this.camera = camera;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.stick = makeStick(1.45);
    this.paddle = makePaddle(); this.paddle.visible = false;
    this.bucket = makeBucket(); this.bucket.visible = false;
    this.rod = makeRod(); this.rod.visible = false;
    this.bucketFull = false; this.blocking = false; this.blockStart = 0; this.poseOverride = null;
    this.setOutfit('everyday');
    this.pos = new THREE.Vector3(0, 3, 0);
    this.vel = new THREE.Vector3();
    this.vy = 0; this.yaw = 0; this.grounded = true;
    this.mode = 'foot'; this.mount = null;
    this.health = 100; this.stamina = 100; this.hurtT = 99; this.sprintLock = false;
    this.crouch = false; this.swimming = false;
    this.locked = false;          // story freezes controls
    this.camYaw = Math.PI; this.camPitch = 0.22; this.camDist = 4.2; this.camDistCur = 4.2; this.zoom = 1;
    this.camTarget = new THREE.Vector3(); this.camPos = new THREE.Vector3();
    this.cine = null; this.cineBlend = 0;
    this.photo = false; this.photoAng = 0;
    this.strikeCd = 0; this.pendingHit = -1;
    this.shake = 0; this.fov = 55;
    this.speedNow = 0;
    this.footT = 0;
    this.canDismount = true;
  }

  setOutfit(key) {
    if (!CAST.outfits[key]) key = 'everyday';
    const def = CAST.outfits[key];
    const old = this.h;
    this.h = new Human({ ...def.look, build: 1.06 });
    if (old) { this.root.remove(old.root); this.h.state = old.state; }
    this.root.add(this.h.root);
    this.h.hold(this.stick); this.h.hold(this.paddle); this.h.hold(this.rod); this.h.hold(this.bucket, false);
    this.outfit = key;
  }
  setCarry(what) {
    this.bucket.visible = what === 'bucket';
    this.bucket.userData.water.visible = this.bucketFull;
    this.h.carry = !!what;
    if (!what) this.bucketFull = false;
  }

  teleport(x, z, yaw = 0, y = null) {
    if (this.mount) this.dismount(true);
    this.pos.set(x, y ?? groundAt(x, z), z);
    this.vel.set(0, 0, 0); this.vy = 0; this.yaw = yaw;
    this.camYaw = yaw + Math.PI; this.camPitch = 0.2;
    this.root.position.copy(this.pos); this.root.rotation.y = yaw;
    this.snapCam = true;
  }

  mountHorse(horse) {
    if (this.mount) return;
    this.mode = 'horse'; this.mount = horse; horse.rider = this;
    horse.root.add(this.root);
    this.root.position.set(0, horse.q.seatY, -0.06); this.root.rotation.set(0, 0, 0);
    this.h.state = 'ride'; this.crouch = false;
    this.stick.visible = false;
    G.audio?.sfx('mount');
  }
  mountBoat(boat) {
    if (this.mount) return;
    this.mode = 'boat'; this.mount = boat; boat.rider = this;
    boat.root.add(this.root);
    this.root.position.set(boat.seat[0], boat.seat[1], boat.seat[2]); this.root.rotation.set(0, 0, 0);
    this.h.state = 'boat'; this.crouch = false;
    this.stick.visible = false; this.paddle.visible = true;
    G.audio?.sfx('splash');
  }
  dismount(silent = false, at = null) {
    const m = this.mount;
    if (!m) return;
    this.scene.add(this.root);
    if (this.mode === 'horse') {
      const side = at || new THREE.Vector3(m.pos.x - Math.cos(m.yaw) * 1.2, 0, m.pos.z + Math.sin(m.yaw) * 1.2);
      this.pos.set(side.x, groundAt(side.x, side.z), side.z);
      this.yaw = m.yaw;
    } else {
      const land = at || m.landing() || new THREE.Vector3(m.pos.x, 0, m.pos.z);
      this.pos.copy(land);
      this.yaw = Math.atan2(land.x - m.pos.x, land.z - m.pos.z);
    }
    m.rider = null; this.mount = null; this.mode = 'foot';
    this.h.state = 'idle'; this.stick.visible = true; this.paddle.visible = false;
    this.vel.set(0, 0, 0); this.vy = 0;
    this.root.position.copy(this.pos); this.root.rotation.set(0, this.yaw, 0);
    if (!silent) G.audio?.sfx('step');
  }

  damage(n, fromX, fromZ, attacker) {
    if (this.health <= 0 || G.story?.invulnerable) return 'none';
    if (this.blocking && fromX != null) {
      const dx = fromX - this.pos.x, dz = fromZ - this.pos.z, d = Math.hypot(dx, dz) || 1;
      if ((dx * Math.sin(this.yaw) + dz * Math.cos(this.yaw)) / d > 0.1) {
        G.audio?.sfx('clang');
        if (G.time - this.blockStart < 0.32) { this.shake = Math.max(this.shake, 0.2); return 'parry'; }
        n *= 0.15; this.stamina = Math.max(0, this.stamina - 16); this.shake = Math.max(this.shake, 0.3);
        this.health -= n; this.hurtT = 0;
        if (this.health <= 0) { this.health = 0; this.h.state = 'ko'; G.story?.fail('You were beaten down.'); }
        return 'block';
      }
    }
    this.health -= n; this.hurtT = 0; this.shake = Math.max(this.shake, 0.5);
    G.ui?.hurt();
    G.audio?.sfx('hit');
    if (fromX != null) { const d = Math.hypot(this.pos.x - fromX, this.pos.z - fromZ) || 1; this.vel.x += (this.pos.x - fromX) / d * 4; this.vel.z += (this.pos.z - fromZ) / d * 4; }
    if (this.health <= 0) { this.health = 0; this.h.state = 'ko'; G.story?.fail('You were beaten down.'); }
    return 'hit';
  }

  worldPos(out = new THREE.Vector3()) {
    if (this.mount) return out.copy(this.mount.pos);
    return out.copy(this.pos);
  }

  // the face follows what is happening: a fight, a wound, a storm
  autoFace(dt) {
    this.faceT = (this.faceT || 0) - dt;
    const h = this.h;
    if (this.faceT > 0 || h.exprT > 0 || h.talking || G.story?.busy) return;
    this.faceT = 0.3;
    let e = 'neutral';
    if (this.health <= 0) e = 'grieving';
    else if (h.strikeT >= 0) e = 'angry';
    else if (this.blocking || this.nearestHostile(11)) e = 'determined';
    else if (this.health < 38) e = 'worried';
    else if (this.mode === 'boat' && G.env.rain > 0.6) e = 'determined';
    h.setExpression(e);
  }

  update(dt) {
    this.autoFace(dt);
    const inp = G.input;
    const free = !this.locked && !this.photo && this.health > 0 && G.input.enabled;
    // --- camera angles
    if (!this.cine) {
      this.camYaw -= inp.dx * 0.0026;
      this.camPitch = clamp(this.camPitch + inp.dy * 0.0022, -0.32, 1.25);
      this.zoom = clamp(this.zoom + inp.wheel * 0.08, 0.6, 1.8);
    }
    let [ix, iy] = free ? inp.move() : [0, 0];
    const sprintKey = free && inp.sprint();
    const fx = -Math.sin(this.camYaw), fz = -Math.cos(this.camYaw);
    const rx = Math.cos(this.camYaw), rz = -Math.sin(this.camYaw);
    const wx = rx * ix + fx * iy, wz = rz * ix + fz * iy;
    const wl = Math.hypot(wx, wz);
    this.strikeCd -= dt; this.hurtT += dt;

    if (this.mode === 'foot') {
      if (free && inp.consume('KeyC')) this.crouch = !this.crouch;
      const deepWater = getHeight(this.pos.x, this.pos.z) < -1.15 && !this.onDeck;
      this.swimming = deepWater && this.pos.y < 0.1;
      if (this.stamina <= 0) this.sprintLock = true;
      if (this.stamina > 25) this.sprintLock = false;
      const wantBlock = free && (inp.down('Block') || inp.down('KeyQ')) && !this.swimming && this.stamina > 1;
      if (wantBlock && !this.blocking) this.blockStart = G.time;
      this.blocking = wantBlock; this.h.blocking = wantBlock;
      const sprinting = sprintKey && wl > 0.1 && !this.sprintLock && !this.crouch && !this.swimming && !this.blocking && !this.h.carry;
      let sp = this.crouch ? 1.9 : sprinting ? 7.2 : this.blocking ? 2.0 : this.h.carry ? 3.9 : 4.3;
      if (this.swimming) sp = 2.1;
      else if (getHeight(this.pos.x, this.pos.z) < -0.25 && !this.onDeck) sp *= 0.62;
      if (sprinting) this.stamina = Math.max(0, this.stamina - 11 * dt); else this.stamina = Math.min(100, this.stamina + (wl > 0.1 ? 8 : 16) * dt);
      const k = this.grounded ? 11 : 2.5;
      this.vel.x = damp(this.vel.x, wx * sp, k, dt); this.vel.z = damp(this.vel.z, wz * sp, k, dt);
      if (this.health <= 0) { this.vel.x = damp(this.vel.x, 0, 8, dt); this.vel.z = damp(this.vel.z, 0, 8, dt); }
      this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
      this.pos.x = clamp(this.pos.x, -PLAY_LIMIT, PLAY_LIMIT); this.pos.z = clamp(this.pos.z, -PLAY_LIMIT, PLAY_LIMIT);
      resolve(this.pos, 0.34, this.pos.y);
      let ground = groundAt(this.pos.x, this.pos.z, this.pos.y + 0.3);
      this.onDeck = ground > getHeight(this.pos.x, this.pos.z) + 0.05;
      if (this.swimming) ground = -0.25;
      if (free && inp.consume('Space') && this.grounded && !this.swimming) { this.vy = 6.2; this.grounded = false; this.crouch = false; G.audio?.sfx('step'); }
      if (!this.grounded) {
        this.vy -= 21 * dt; this.pos.y += this.vy * dt;
        if (this.pos.y <= ground) { this.pos.y = ground; this.vy = 0; this.grounded = true; if (ground < -0.3) G.audio?.sfx('splash'); }
      } else if (this.pos.y - ground > 0.7) { this.grounded = false; this.vy = 0; }
      else this.pos.y = damp(this.pos.y, ground, 22, dt);
      const hsp = Math.hypot(this.vel.x, this.vel.z);
      this.speedNow = hsp;
      if (this.blocking) { const tgt = this.nearestHostile(6); if (tgt) this.yaw = angleDamp(this.yaw, Math.atan2(tgt.pos.x - this.pos.x, tgt.pos.z - this.pos.z), 14, dt); }
      else if (wl > 0.1 && this.h.strikeT < 0) this.yaw = angleDamp(this.yaw, Math.atan2(wx, wz), 12, dt);
      this.h.speed = hsp;
      if (this.health > 0) this.h.state = this.poseOverride || (this.swimming ? 'swim' : this.crouch ? 'crouch' : hsp > 0.25 ? 'move' : 'idle');
      this.root.position.copy(this.pos); this.root.rotation.set(0, this.yaw, 0);
      // attack
      if (free && (inp.consume('Attack') || inp.consume('KeyF')) && this.strikeCd <= 0 && !this.swimming && this.stamina > 6 && !this.blocking && !this.h.carry) {
        this.h.strikeDur = 0.42; this.h.strikeT = 0; this.strikeCd = 0.62; this.pendingHit = 0.17; this.stamina -= 7; this.crouch = false;
        // face the camera direction when striking from standstill
        if (wl < 0.1) { const tgt = this.nearestHostile(3.2); if (tgt) this.yaw = Math.atan2(tgt.pos.x - this.pos.x, tgt.pos.z - this.pos.z); }
        G.audio?.sfx('swing');
      }
      if (this.pendingHit >= 0) {
        this.pendingHit -= dt;
        if (this.pendingHit < 0) this.resolveHit();
      }
      // footsteps
      if (this.grounded && hsp > 0.5) {
        this.footT -= dt * (2.2 + hsp * 0.42);
        if (this.footT <= 0) { this.footT = 1; G.audio?.sfx(this.swimming || ground < -0.1 ? 'wade' : 'step', this.crouch ? 0.3 : 0.7); }
      }
    } else if (this.mode === 'horse') {
      const m = this.mount;
      m.drive(dt, free ? wx : 0, free ? wz : 0, sprintKey, this.gallopMax || 12.6);
      this.h.speed = m.speed; this.speedNow = m.speed;
      this.pos.copy(m.pos); this.yaw = m.yaw;
      this.stamina = Math.min(100, this.stamina + 10 * dt);
      if (m.speed > 1) {
        this.footT -= dt * (1.5 + m.speed * 0.42);
        if (this.footT <= 0) { this.footT = 1; G.audio?.sfx('hoof', clamp(m.speed / 12, 0.3, 1)); }
      }
    } else if (this.mode === 'boat') {
      const m = this.mount;
      if (this.stamina <= 0) this.sprintLock = true;
      if (this.stamina > 30) this.sprintLock = false;
      const hard = sprintKey && !this.sprintLock && wl > 0.1;
      m.drive(dt, free ? wx : 0, free ? wz : 0, hard);
      this.h.state = m.paddling ? 'paddle' : 'boat';
      this.h.rowRate = hard ? 5.6 : 4.2;
      this.speedNow = m.speed;
      this.pos.copy(m.pos); this.yaw = m.yaw;
      this.stamina = hard ? Math.max(0, this.stamina - 7.5 * dt) : Math.min(100, this.stamina + 13 * dt);
      if (m.paddling) { this.footT -= dt * 0.67; if (this.footT <= 0) { this.footT = 1; G.audio?.sfx('paddle', 0.6); } }
    }
    if (this.hurtT > 6 && this.health > 0) this.health = Math.min(100, this.health + 7 * dt);
    this.h.update(dt);
    this.updateCamera(dt);
  }

  nearestHostile(maxD) {
    let best = null, bd = maxD;
    for (const n of G.npcs) {
      if (!n.hostile || n.ko || !n.active) continue;
      const d = Math.hypot(n.pos.x - this.pos.x, n.pos.z - this.pos.z);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }
  resolveHit() {
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    let any = false;
    for (const n of G.npcs) {
      if (!n.canBeHit || n.ko || !n.active) continue;
      const dx = n.pos.x - this.pos.x, dz = n.pos.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d > 2.15) continue;
      if (d > 0.4 && (dx * fx + dz * fz) / d < 0.3) continue;
      if (n.takeHit(50, this.pos.x, this.pos.z)) any = true;
    }
    if (any) { G.audio?.sfx('thud'); this.shake = Math.max(this.shake, 0.25); }
  }

  updateCamera(dt) {
    const cam = this.camera;
    const focus = this.worldPos(new THREE.Vector3());
    const mode = this.mode;
    const headY = mode === 'horse' ? 2.35 : mode === 'boat' ? 1.25 : this.crouch ? 1.15 : 1.55;
    const baseDist = (mode === 'horse' ? 6.2 : mode === 'boat' ? (this.mount.chundan ? 13.5 : 7.6) : 3.7) * this.zoom;
    if (this.photo) {
      this.photoAng += dt * 0.12;
      this.camYaw += dt * 0.12;
    }
    const tgt = new THREE.Vector3(focus.x, focus.y + headY, focus.z);
    if (this.snapCam) { this.camTarget.copy(tgt); } else {
      this.camTarget.x = damp(this.camTarget.x, tgt.x, 14, dt); this.camTarget.z = damp(this.camTarget.z, tgt.z, 14, dt);
      this.camTarget.y = damp(this.camTarget.y, tgt.y, 9, dt);
    }
    const cp = Math.cos(this.camPitch), sp = Math.sin(this.camPitch);
    const dir = new THREE.Vector3(Math.sin(this.camYaw) * cp, sp, Math.cos(this.camYaw) * cp);
    // collision: shorten the boom when a wall or the ground is in the way
    const room = mode === 'foot' ? interiorAt(focus.x, focus.z) : null;
    let dist = room ? Math.min(baseDist, 2.5) : baseDist * (this.photo ? 1.5 : 1);
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      const d = dist * i / steps;
      const px = this.camTarget.x + dir.x * d, py = this.camTarget.y + dir.y * d, pz = this.camTarget.z + dir.z * d;
      const b = pointInBox(px, pz, 0.25);
      if ((b && py < b.top + 0.3) || py < getHeight(px, pz) + 0.3) { dist = Math.max(0.9, dist * (i - 1) / steps); break; }
    }
    this.camDistCur = this.snapCam ? dist : (dist < this.camDistCur ? damp(this.camDistCur, dist, 20, dt) : damp(this.camDistCur, dist, 4, dt));
    const side = mode === 'foot' && !this.photo ? 0.42 : 0;
    const desired = new THREE.Vector3(
      this.camTarget.x + dir.x * this.camDistCur + Math.cos(this.camYaw) * side,
      this.camTarget.y + dir.y * this.camDistCur,
      this.camTarget.z + dir.z * this.camDistCur - Math.sin(this.camYaw) * side);
    const minY = Math.max(getHeight(desired.x, desired.z), 0) + 0.28;
    if (desired.y < minY) desired.y = minY;
    if (room && desired.y > room.ceil - 0.2) desired.y = room.ceil - 0.2;
    const look = new THREE.Vector3(this.camTarget.x + Math.cos(this.camYaw) * side, this.camTarget.y, this.camTarget.z - Math.sin(this.camYaw) * side);
    this.snapCam = false;

    this.shake = Math.max(0, this.shake - dt * 1.6);
    const sprintFov = mode === 'horse' ? smoothstep(6, 12, this.speedNow) * 9 : smoothstep(4.5, 7, this.speedNow) * 5;
    let fov = 60 + sprintFov;

    if (this.cine) {
      this.cineBlend = Math.min(1, this.cineBlend + dt / (this.cine.blend ?? 1.2));
      const c = this.cine;
      if (c.update) c.update(dt);
      const e = this.cineBlend * this.cineBlend * (3 - 2 * this.cineBlend);
      if (c.hard) { cam.position.copy(c.pos); this._look = (this._look || new THREE.Vector3()).copy(c.look); }
      else {
        cam.position.lerpVectors(desired, c.pos, e);
        this._look = (this._look || new THREE.Vector3()).lerpVectors(look, c.look, e);
      }
      fov = lerp(fov, c.fov ?? 42, c.hard ? 1 : e);
      cam.lookAt(this._look);
    } else {
      this.cineBlend = 0;
      cam.position.copy(desired);
      if (this.shake > 0) { cam.position.x += (Math.random() - 0.5) * this.shake * 0.12; cam.position.y += (Math.random() - 0.5) * this.shake * 0.12; }
      cam.lookAt(look);
    }
    this.fov = damp(this.fov, fov, 5, dt);
    if (Math.abs(cam.fov - this.fov) > 0.01) { cam.fov = this.fov; cam.updateProjectionMatrix(); }
  }

  setCine(c) { this.cine = c; this.cineBlend = c && c.hard ? 1 : 0; }
}
