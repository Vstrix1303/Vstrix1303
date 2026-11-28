// Third-person controller: on foot, in the saddle, at the paddle.
import * as THREE from 'three';
import { G } from './state.js';
import { Human, CAST, makeStick, makePaddle, makeBucket, makeRod } from './characters.js';
import { lookFor, OLD_OUTFITS } from './wardrobe.js';
import { WEAPONS, GUNS, makeWeapon, makeGun, makeShield, gunStats } from './weapons.js';
import { segmentBlocked } from './physics.js';
import { getHeight, PLAY_LIMIT } from './heightfield.js';
import { groundAt, resolve, pointInBox, interiorAt } from './physics.js';
import { clamp, damp, angleDamp, lerp, smoothstep } from './util.js';

export class Player {
  constructor(scene, camera) {
    this.scene = scene; this.camera = camera;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.stick = new THREE.Group();          // the right hand's holder; hidden while the hands are busy (fishing, riding)
    this.hand = new THREE.Group(); this.stick.add(this.hand);     // the weapon actually drawn
    this.shoulder = new THREE.Group(); this.root.add(this.shoulder);   // a long gun, carried or shouldered
    this.slung = new THREE.Group();          // on the back: the long gun or the staff
    this.holster = new THREE.Group();        // on the hip: the pistol, the billhook
    this.shield = makeShield(); this.shield.visible = false;
    this.rounds = 0; this.reloadT = 0; this.aiming = false; this.marmaN = 0; this.drawn = false; this.combatT = -99; this.fireT = 0;
    this.paddle = makePaddle(); this.paddle.visible = false;
    this.bucket = makeBucket(); this.bucket.visible = false;
    this.rod = makeRod(); this.rod.visible = false;
    this.bucketFull = false; this.blocking = false; this.blockStart = 0; this.poseOverride = null;
    this.buffs = {};
    this.setLook(lookFor(null));
    this.setWeapon('fists');
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

  // the old whole outfits still work, as sets of pieces
  setOutfit(key) { this.setLook(lookFor(null, { wear: OLD_OUTFITS[key] || OLD_OUTFITS.everyday })); }
  setLook(look) {
    const key = JSON.stringify(look);
    if (key === this.lookKey) return;
    this.lookKey = key;
    const old = this.h;
    this.h = new Human({ ...look, build: 1.03, hero: G.quality === 'high' || G.quality === 'ultra', protagonist: true });
    if (old) {
      this.root.remove(old.root); this.h.state = old.state; this.h.mountQ = old.mountQ;
      for (const m of [this.stick, this.paddle, this.rod, this.bucket, this.shield, this.slung, this.holster]) m?.parent?.remove(m);
    }
    this.h.near = true; this.h.grip = true; this.h.heroLOD = true;
    this.h.onStep = () => { if (this.mode === 'foot' && this.grounded && this.speedNow > 0.4) G.audio?.sfx(this.swimming || this.pos.y < -0.1 ? 'wade' : 'step', this.crouch ? 0.3 : this.speedNow > 5 ? 0.85 : 0.6); };
    this.root.add(this.h.root);
    this.h.hold(this.stick); this.h.hold(this.paddle); this.h.hold(this.rod); this.h.hold(this.bucket, false);
    if (this.shield) this.h.hold(this.shield, false);
    (this.h.chestAnchor || this.h.chest).add(this.slung); (this.h.hipAnchor || this.h.hips).add(this.holster);
    this.onLook?.();
  }
  setWeapon(key) {
    if (!WEAPONS[key]) key = 'fists';
    const st = G.story?.state;
    this.weapon = key;
    this.wdef = GUNS[key] ? gunStats(key, { ...(st?.mods?.[key] || {}), ...(this.previewMods || {}) }) : WEAPONS[key];
    this.hand.clear(); this.shoulder.clear();
    this.wmesh = GUNS[key] ? makeGun(key, this.wdef.mods) : makeWeapon(key);
    this.long = !!GUNS[key] && GUNS[key].pose !== 'pistol';
    (this.long ? this.shoulder : this.hand).add(this.wmesh);
    if (key === 'pistol') { this.wmesh.rotation.x = -Math.PI / 2; this.wmesh.position.set(0, -0.02, -0.14); }          // along the forearm, not across the fingers
    this.aiming = false; this.reloadT = 0;
    if (st && GUNS[key]) { st.mag = st.mag || {}; this.rounds = Math.min(st.mag[key] ?? 0, this.wdef.mag); }
    if (st && this.long) st.lastLong = key;
    if (key === 'fists') this.drawn = false;
    this.buildHolsters();
  }
  // what hangs on the body: the pistol at the hip, a long gun or the staff across the back
  buildHolsters() {
    const st = G.story?.state, owns = (k) => st?.weapons?.includes(k);
    this.slung.clear(); this.holster.clear();
    const mods = (k) => ({ ...(st?.mods?.[k] || {}) });
    if (owns('pistol') && !(this.weapon === 'pistol' && this.drawn)) {
      const g = makeGun('pistol', mods('pistol')); g.position.set(-0.2, -0.04, 0.03); g.rotation.set(Math.PI / 2 + 0.1, 0, 0); this.holster.add(g);
    }
    const W = WEAPONS[this.weapon];
    const back = this.long && !this.drawn ? this.weapon : (!GUNS[this.weapon] && this.weapon !== 'fists' && !this.drawn && !W.fists ? this.weapon : (st?.lastLong && owns(st.lastLong) && st.lastLong !== this.weapon ? st.lastLong : null));
    if (back) {
      const g = GUNS[back] ? makeGun(back, mods(back)) : makeWeapon(back);
      if (back === 'kathi' || back === 'cheruvadi' || back === 'otta') { g.position.set(0.19, -0.02, 0.0); g.rotation.set(Math.PI / 2 + 0.2, 0, 0); this.holster.add(g); }
      else { g.rotation.order = 'ZYX'; g.rotation.set(-Math.PI / 2, 0, back === 'rocket' ? 0.35 : 0.62); g.position.set(0, back === 'rocket' ? 0.02 : -0.08, -0.17); this.slung.add(g); }
    }
    this.slung.traverse((o) => { if (o.isMesh) o.castShadow = true; }); this.holster.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  }
  draw() {
    this.combatT = G.time;
    if (this.drawn || this.weapon === 'fists') return;
    this.drawn = true; this.buildHolsters();
    G.audio?.sfx(GUNS[this.weapon] ? 'reload' : 'swing', 0.3);
  }
  holsterWeapon() { if (!this.drawn) return; this.drawn = false; this.aiming = false; this.buildHolsters(); G.audio?.sfx('click', 0.6); }
  // a gun goes off: down the camera's line through the reticle, spread by how steady the aim is
  fire() {
    const st = G.story.state, W = this.wdef, key = this.weapon;
    if (this.reloadT > 0 || this.fireT > 0) return;
    if (!(this.rounds > 0)) {
      this.fireT = 0.3;
      if ((st.ammo?.[key] || 0) > 0) this.reload(); else { G.audio?.sfx('click'); G.ui.toast(`Click. No ${GUNS[key].ammo === 'rocket' ? 'rockets' : 'ammunition'} — the gunsmith sells it.`, 2.5); }
      return;
    }
    this.rounds--; st.mag[key] = this.rounds; this.fireT = W.rate;
    G.audio?.sfx(W.sup ? 'silenced' : key === 'shotgun' ? 'shotgun' : key === 'sniper' ? 'sniper' : key === 'rifle' ? 'rifleshot' : key === 'rocket' ? 'launch' : 'shot', key === 'rifle' ? 0.8 : 1);
    this.shake = Math.max(this.shake, key === 'rocket' ? 0.6 : key === 'shotgun' || key === 'sniper' ? 0.45 : 0.25);
    const fl = this.wmesh.userData.flash; if (fl) { fl.visible = true; fl.rotation.z = Math.random() * 3; setTimeout(() => (fl.visible = false), 45); }
    const cam = this.camera, o = cam.position.clone(), dir = new THREE.Vector3(); cam.getWorldDirection(dir);
    const muzzle = new THREE.Vector3(); (this.wmesh.userData.muzzle || this.wmesh).getWorldPosition(muzzle);
    const moving = Math.min(1, this.speedNow / 4);
    const spreadDeg = (this.aiming ? W.aim : W.hip) * (1 + moving * 0.8) * (this.crouch ? 0.7 : 1) * (1 + (this.heat || 0) * 1.5);
    const sp = (deg) => { const a = Math.random() * Math.PI * 2, r = Math.tan(deg * Math.PI / 180) * Math.sqrt(Math.random()); const up = new THREE.Vector3(0, 1, 0), right = new THREE.Vector3().crossVectors(dir, up).normalize(), u2 = new THREE.Vector3().crossVectors(right, dir); return dir.clone().addScaledVector(right, Math.cos(a) * r).addScaledVector(u2, Math.sin(a) * r).normalize(); };
    // start the ray at the player's shoulder plane so walls between camera and player don't eat it
    const fwd = new THREE.Vector3().subVectors(this.pos, o); const skip = Math.max(0, fwd.dot(dir) - 0.3); o.addScaledVector(dir, skip);
    if (key === 'rocket') G.combat.fireRocket(W, muzzle, sp(spreadDeg));
    else for (let i = 0; i < (W.pellets || 1); i++) G.combat.shoot(W, o, sp(spreadDeg), muzzle, this.pos);
    G.combat.noise(this.pos, key === 'rocket' ? 80 : 50, W.sup);
    // recoil kicks the aim up; sustained fire climbs and spreads
    this.camPitch -= W.recoil * (0.7 + Math.random() * 0.6); this.camYaw += (Math.random() - 0.5) * W.recoil * 0.6;
    this.heat = Math.min(1, (this.heat || 0) + (W.auto ? 0.09 : 0.2));
    if (!this.rounds && (st.ammo?.[key] || 0) > 0) setTimeout(() => this.reload(), 300);
    this.combatT = G.time;
    G.story.save();
  }
  reload() {
    const st = G.story.state, key = this.weapon;
    if (!GUNS[key] || this.reloadT > 0 || !((st.ammo?.[key] || 0) > 0) || this.rounds >= this.wdef.mag) return;
    this.reloadT = this.wdef.reload; G.audio?.sfx('reload');
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
    if (!horse.q) {               // a bicycle or a jeep: sit on it, the right way for each
      this.mode = 'horse'; this.mount = horse; horse.rider = this;
      horse.seatNode.add(this.root); this.root.position.set(...horse.seat); this.root.rotation.set(0, 0, 0);
      this.h.state = horse.pose; this.crouch = false; this.h.mountQ = null; this.h.mountT = null;
      this.stick.visible = false; this.holsterWeapon();
      G.audio?.sfx(horse.engine ? 'horn' : 'cycbell', 0.25);
      return;
    }
    this.mode = 'horse'; this.mount = horse; horse.rider = this;
    horse.q.body.add(this.root);          // sit on the moving back, not the ground point beneath it
    this.root.position.set(0, horse.q.seatY - horse.q.baseY, -0.06); this.root.rotation.set(0, 0, 0);
    this.h.state = 'ride'; this.crouch = false; this.h.mountQ = horse.q; this.h.mountT = 0;
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
    this.h.mountQ = null; this.h.mountT = null; if (!silent) this.h.land = 1;
    this.h.state = 'idle'; this.stick.visible = true; this.paddle.visible = false;
    this.vel.set(0, 0, 0); this.vy = 0;
    this.root.position.copy(this.pos); this.root.rotation.set(0, this.yaw, 0);
    if (!silent) G.audio?.sfx('step');
  }

  damage(n, fromX, fromZ, attacker) {
    if (this.health <= 0 || G.story?.invulnerable) return 'none';
    if (this.buffs.guard > 0) n *= 0.6;
    if (this.blocking && fromX != null) {
      const dx = fromX - this.pos.x, dz = fromZ - this.pos.z, d = Math.hypot(dx, dz) || 1;
      if ((dx * Math.sin(this.yaw) + dz * Math.cos(this.yaw)) / d > 0.1) {
        G.audio?.sfx('clang');
        if (G.time - this.blockStart < (this.wdef.parry || 0.32)) { this.shake = Math.max(this.shake, 0.2); return 'parry'; }
        n *= this.wdef.guard; this.stamina = Math.max(0, this.stamina - 16); this.shake = Math.max(this.shake, 0.3);
        this.health -= n; this.hurtT = 0;
        if (this.health <= 0) { this.health = 0; this.h.state = 'ko'; G.story?.fail('You were beaten down.'); }
        return 'block';
      }
    }
    this.health -= n; this.hurtT = 0; this.shake = Math.max(this.shake, 0.5);
    if (fromX != null) this.h.flinch(fromX, fromZ, 1.2);
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
    if (!this.cine && !G.wheelOpen) {
      const sens = this.aiming ? (this.wdef.zoom || 44) / 60 : 1;
      this.camYaw -= inp.dx * 0.0026 * sens;
      this.camPitch = clamp(this.camPitch + inp.dy * 0.0022 * sens, -0.6, 1.25);
      this.zoom = clamp(this.zoom + inp.wheel * 0.08, 0.6, 1.8);
    }
    // a telescope never sits still; Shift holds the breath and steadies it, at a cost
    if (this.scoped) {
      const steady = inp.sprint() && this.stamina > 4, amp = (steady ? 0.15 : 1) * 0.0035 * (16 / (this.wdef.zoom || 16));
      if (steady) this.stamina = Math.max(0, this.stamina - 14 * dt);
      this.camYaw += Math.cos(G.time * 0.8) * amp * dt * 6; this.camPitch += Math.sin(G.time * 1.25) * amp * dt * 5;
    }
    let [ix, iy] = free ? inp.move() : [0, 0];
    const sprintKey = free && inp.sprint();
    const fx = -Math.sin(this.camYaw), fz = -Math.cos(this.camYaw);
    const rx = Math.cos(this.camYaw), rz = -Math.sin(this.camYaw);
    const wx = rx * ix + fx * iy, wz = rz * ix + fz * iy;
    const wl = Math.hypot(wx, wz);
    this.strikeCd -= dt; this.hurtT += dt;
    for (const k in this.buffs) { this.buffs[k] -= dt; if (this.buffs[k] <= 0) delete this.buffs[k]; }

    if (this.mode === 'foot') {
      if (free && inp.consume('KeyC')) this.crouch = !this.crouch;
      const deepWater = getHeight(this.pos.x, this.pos.z) < -1.15 && !this.onDeck;
      this.swimming = deepWater && this.pos.y < 0.1;
      if (this.stamina <= 0) this.sprintLock = true;
      if (this.stamina > 25) this.sprintLock = false;
      const rmb = free && (inp.down('Block') || inp.down('KeyQ')) && !this.swimming && !G.wheelOpen;
      const gun = !!this.wdef.gun && this.stick.visible;
      if (rmb && this.weapon !== 'fists') this.draw();
      const wasAiming = this.aiming;
      this.aiming = gun && rmb && !this.h.carry;
      if (this.aiming && !wasAiming) this.aimAssist();
      this.h.aim = this.aiming && !this.long;
      this.h.longGun = this.long && this.drawn && this.stick.visible ? (this.aiming ? (this.weapon === 'rocket' ? 3 : 2) : 1) : 0;
      this.heat = Math.max(0, (this.heat || 0) - dt * (this.wdef.auto ? 2.2 : 1.4));
      this.fireT -= dt;
      // put the weapon away after a while without a fight
      if (this.drawn && !this.aiming && this.h.strikeT < 0 && G.time - this.combatT > (gun ? 12 : 8) && !this.nearestHostile(14)) this.holsterWeapon();
      const wantBlock = rmb && !gun && this.stamina > 1;
      if (wantBlock && !this.blocking) this.blockStart = G.time;
      this.blocking = wantBlock; this.h.blocking = wantBlock;
      const sprinting = sprintKey && wl > 0.1 && !this.sprintLock && !this.crouch && !this.swimming && !this.blocking && !this.h.carry;
      let sp = this.crouch ? 1.9 : sprinting ? 7.2 : this.blocking ? 2.0 : this.h.carry ? 3.9 : 4.3;
      if (this.swimming) sp = 2.1;
      else if (getHeight(this.pos.x, this.pos.z) < -0.25 && !this.onDeck) sp *= 0.62;
      if (sprinting) this.stamina = Math.max(0, this.stamina - (this.buffs.wind > 0 ? 0 : 11) * dt); else this.stamina = Math.min(100, this.stamina + (wl > 0.1 ? 8 : 16) * dt);
      // momentum: it takes a stride or two to get going, and to pull up
      const cur = Math.hypot(this.vel.x, this.vel.z), k = !this.grounded ? 2.5 : wl * sp > cur ? 6.5 : 8.5;
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
      if (this.aiming) this.yaw = angleDamp(this.yaw, this.camYaw + Math.PI, 18, dt);
      else if (this.blocking) { const tgt = this.nearestHostile(6); if (tgt) this.yaw = angleDamp(this.yaw, Math.atan2(tgt.pos.x - this.pos.x, tgt.pos.z - this.pos.z), 14, dt); }
      else if (wl > 0.1 && this.h.strikeT < 0) this.yaw = angleDamp(this.yaw, Math.atan2(wx, wz), hsp > 5 ? 6.5 : 10, dt);
      this.h.speed = hsp;
      if (this.health > 0) this.h.state = this.poseOverride || (this.swimming ? 'swim' : this.crouch ? 'crouch' : hsp > 0.25 ? 'move' : 'idle');
      this.root.position.copy(this.pos); this.root.rotation.set(0, this.yaw, 0);
      // attack
      if (this.reloadT > 0) {
        this.reloadT -= dt;
        if (this.reloadT <= 0 && GUNS[this.weapon]) { const st = G.story.state, k = this.weapon, take = Math.min(this.wdef.mag - this.rounds, st.ammo?.[k] || 0); st.ammo[k] -= take; this.rounds += take; st.mag[k] = this.rounds; G.audio?.sfx('reload'); G.story.save(); }
      }
      if (free && gun && inp.consume('KeyR')) this.reload();
      if (free && gun && !G.wheelOpen && !this.swimming && !this.h.carry) {
        const tap = inp.consume('Attack') | inp.consume('KeyF');
        if (tap || (this.wdef.auto && (inp.down('AttackHeld') || inp.down('KeyF')) && this.drawn)) { const was = this.drawn; this.draw(); if (was || tap) this.fire(); }
      } else if (free && !G.wheelOpen && (inp.consume('Attack') || inp.consume('KeyF')) && this.strikeCd <= 0 && !this.swimming && this.stamina > 6 && !this.blocking && !this.h.carry) {
        const W = this.wdef;
        this.draw();
        this.h.punch = !!W.fists;
        this.h.strikeDur = W.dur; this.h.strikeT = 0; this.strikeCd = W.cd; this.pendingHit = W.dur * 0.4; this.stamina -= 7 * Math.max(0.6, W.dur / 0.42); this.crouch = false;
        // face the camera direction when striking from standstill
        if (wl < 0.1) { const tgt = this.nearestHostile(this.wdef.reach + 1); if (tgt) this.yaw = Math.atan2(tgt.pos.x - this.pos.x, tgt.pos.z - this.pos.z); }
        G.audio?.sfx('swing');
      }
      if (this.pendingHit >= 0) {
        this.pendingHit -= dt;
        if (this.pendingHit < 0) this.resolveHit();
      }
      // footsteps
      if (this.grounded && hsp > 0.5 && this.h.ik < 0.5) {
        this.footT -= dt * (2.2 + hsp * 0.42);
        if (this.footT <= 0) { this.footT = 1; G.audio?.sfx(this.swimming || ground < -0.1 ? 'wade' : 'step', this.crouch ? 0.3 : 0.7); }
      }
    } else if (this.mode === 'horse') {
      const m = this.mount;
      m.drive(dt, free ? wx : 0, free ? wz : 0, sprintKey, this.gallopMax || 12.6);
      this.h.speed = m.speed; this.speedNow = m.speed;
      this.pos.copy(m.pos); this.yaw = m.yaw;
      this.stamina = Math.min(100, this.stamina + 10 * dt);
      if (free && m.horn && (inp.consume('Attack') || inp.consume('KeyF'))) m.horn();
      if (m.q && m.speed > 1) {
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
    if (this.buffs.mend > 0 && this.health > 0) this.health = Math.min(100, this.health + 5 * dt);
    if (this.mode === 'foot') {
      this.h.setWorld(this.pos.x, this.pos.y, this.pos.z, this.yaw);
      this.h.air = !this.grounded && !this.swimming && this.health > 0;
      // glance at whoever is close by
      this.gazeT = (this.gazeT || 0) - dt;
      if (this.gazeT <= 0) {
        this.gazeT = 0.4; let best = null, bd = 5.5;
        for (const n of G.npcs) { if (!n.active || n.ko) continue; const d = Math.hypot(n.pos.x - this.pos.x, n.pos.z - this.pos.z); if (d < bd) { bd = d; best = n; } }
        this.h.gaze = best ? { x: best.pos.x, y: best.pos.y + 1.55 * best.h.S, z: best.pos.z } : null;
      }
    } else { this.h.air = false; this.h.gaze = null; }
    const out = this.stick.visible && this.mode === 'foot' && this.drawn;
    this.hand.visible = out; this.shoulder.visible = out && this.long;
    this.slung.visible = this.holster.visible = this.mode !== 'boat' || true;
    if (this.shoulder.visible) {
      // a long gun: shouldered along the aim when aiming, otherwise carried low across the body
      const lg = this.h.longGun;
      if (lg >= 2) {
        const dy = this.camera.getWorldDirection(this._cd || (this._cd = new THREE.Vector3())).y;
        this.shoulder.position.set(-0.15, lg === 3 ? 1.5 : 1.38, lg === 3 ? -0.02 : 0.16);
        this.shoulder.rotation.set(-Math.asin(clamp(dy, -0.9, 0.9)), 0.03, 0);
      } else { this.shoulder.position.set(-0.2, 0.98, 0.24); this.shoulder.rotation.set(0.62, 0.35, -0.1); }
    }
    this.h.staff = out && !!this.wdef.low;
    this.shield.visible = out && !!this.wdef.shield;
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
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), W = this.wdef;
    let any = false;
    const inReach = [];
    for (const n of G.npcs) {
      if (n.ko || !n.active || n.attached || n.noHit) continue;          // anyone can be struck, not only enemies
      const dx = n.pos.x - this.pos.x, dz = n.pos.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d > W.reach) continue;
      if (d > 0.4 && (dx * fx + dz * fz) / d < W.arc) continue;
      inReach.push([d, n]);
    }
    inReach.sort((a, b) => a[0] - b[0]);
    // the otta finds a vital point every few blows
    let dmg = W.dmg;
    if (W.marma && inReach.length) { this.marmaN = (this.marmaN + 1) % W.marma; if (!this.marmaN) { dmg *= 3; G.ui.toast('<b>Marma!</b>', 1.2); } }
    for (const [, n] of (W.multi ? inReach : inReach.slice(0, 2))) if (n.takeHit(dmg, this.pos.x, this.pos.z)) any = true;
    if (any) { G.audio?.sfx(W.fists ? 'punch' : 'thud'); this.shake = Math.max(this.shake, 0.25); this.combatT = G.time; }
  }
  // starting to aim snaps toward the nearest enemy in front, the way a revolver finds its man
  aimAssist() {
    const cam = this.camera, dir = cam.getWorldDirection(new THREE.Vector3());
    let best = null, ba = 0.42;
    for (const n of G.npcs) {
      if (!n.hostile || n.ko || !n.active) continue;
      const v = new THREE.Vector3(n.pos.x - cam.position.x, n.pos.y + 1.3 * (n.h.S || 1) - cam.position.y, n.pos.z - cam.position.z), d = v.length();
      if (d > this.wdef.range) continue; v.divideScalar(d);
      const a = Math.acos(clamp(v.dot(dir), -1, 1)); if (a < ba) { ba = a; best = v; }
    }
    if (best) { this.camYaw = Math.atan2(-best.x, -best.z); this.camPitch = clamp(-Math.asin(best.y) + 0.05, -0.32, 1.25); }
  }

  updateCamera(dt) {
    const cam = this.camera;
    const focus = this.worldPos(new THREE.Vector3());
    const mode = this.mode;
    const headY = mode === 'horse' ? (this.mount.camHead ?? 2.35) : mode === 'boat' ? 1.25 : this.crouch ? 1.15 : 1.55;
    this.scoped = this.aiming && !!this.wdef.scoped;
    const baseDist = (mode === 'horse' ? (this.mount.camDist ?? 6.2) : mode === 'boat' ? (this.mount.chundan ? 13.5 : 7.6) : this.scoped ? 0.05 : this.aiming ? (this.long ? 1.5 : 1.9) : 3.7) * (this.aiming ? 1 : this.zoom);
    this.h.root.visible = !this.scoped;
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
    const room = mode === 'foot' ? interiorAt(focus.x, focus.z, focus.y) : null;
    let dist = room ? Math.min(baseDist, 2.5) : baseDist * (this.photo ? 1.5 : 1);
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      const d = dist * i / steps;
      const px = this.camTarget.x + dir.x * d, py = this.camTarget.y + dir.y * d, pz = this.camTarget.z + dir.z * d;
      const b = pointInBox(px, pz, 0.25);
      if ((b && py < b.top + 0.3) || py < getHeight(px, pz) + 0.3) { dist = Math.max(0.9, dist * (i - 1) / steps); break; }
    }
    this.camDistCur = this.snapCam ? dist : (dist < this.camDistCur ? damp(this.camDistCur, dist, 20, dt) : damp(this.camDistCur, dist, 4, dt));
    const side = mode === 'foot' && !this.photo ? (this.scoped ? 0.12 : this.aiming ? 0.62 : 0.42) : 0;
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
    let fov = this.aiming ? (this.wdef.zoom || 44) : 60 + sprintFov;

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
