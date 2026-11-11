// KAYAL — Travancore, 1905. Entry point & main loop.
import * as THREE from 'three';
import { G, QUALITY } from './state.js';
import { UI } from './ui.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { Player } from './player.js';
import { buildWorld } from './world.js';
import { Post } from './post.js';
import { Story, loadSave, CHAPTER_NAMES } from './story.js';
import { getHeight, LOC } from './heightfield.js';
import { SPOTS } from './structures.js';
import { clamp, smoothstep, nextFrame } from './util.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
};

function pickQuality(gl) {
  const q = params.get('q') || store.get('kayal1905.quality');
  if (q && QUALITY[q]) return q;
  if (matchMedia('(pointer: coarse)').matches) return 'low';
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const r = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
    if (/SwiftShader|llvmpipe|Software/i.test(r)) return 'low';
    if (/NVIDIA|GeForce|RTX|GTX|Radeon (RX|Pro)|Apple M|Arc\(TM\)/i.test(r)) return 'high';
  } catch (e) { /* ignore */ }
  return 'medium';
}

async function boot() {
  const canvas = $('c');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
  } catch (e) {
    $('loadText').textContent = 'This game needs WebGL 2. Please try a recent desktop browser.';
    return;
  }
  G.renderer = renderer;
  G.quality = pickQuality(renderer.getContext());
  const q = QUALITY[G.quality];
  const basePR = () => (G.quality === 'low' ? 0.75 * Math.min(devicePixelRatio || 1, 1) : G.quality === 'medium' ? Math.min(devicePixelRatio || 1, 1) : Math.min(devicePixelRatio || 1, 1.5));
  let prScale = 1;
  renderer.setPixelRatio(basePR());
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = G.scene = new THREE.Scene();
  const camera = G.camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.25, 5200);
  camera.layers.enable(1);
  scene.add(camera);

  const ui = G.ui = new UI();
  const input = G.input = new Input(canvas);
  const audio = G.audio = new AudioSys();
  const player = G.player = new Player(scene, camera);

  await nextFrame();
  const W = await buildWorld(scene, async (p, t) => { ui.loading(p, t); await nextFrame(); await nextFrame(); });
  ui.attach(scene);
  const post = new Post(renderer, scene, camera);
  const story = G.story = new Story();
  const env = G.env, water = G.water;

  const resize = () => {
    renderer.setPixelRatio(basePR() * prScale);
    renderer.setSize(innerWidth, innerHeight);
    post.composer.setPixelRatio(basePR() * prScale);
    post.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  };
  addEventListener('resize', resize);
  resize();

  // ---------------- title screen ----------------
  env.setTime(6.45); env.frozen = true;
  player.teleport(SPOTS.homeGate.x, SPOTS.homeGate.z + 3, 0);
  player.locked = true;
  ui.setHud(false);
  const jx = LOC.villageJetty.x;
  const titleCine = { hard: true, pos: new THREE.Vector3(), look: new THREE.Vector3(jx + 30, 5, 30), fov: 44, a: 0 };
  titleCine.update = (dt) => {
    titleCine.a += dt * 0.022;
    const a = 2.5 + Math.sin(titleCine.a) * 0.5;
    titleCine.pos.set(jx - 16 + Math.cos(a) * 64, 5.5 + Math.sin(titleCine.a * 1.3) * 1.5, 46 + Math.sin(a) * 64);
    titleCine.look.set(jx + 34, 6, 34);
  };
  player.setCine(titleCine);

  const save = loadSave();
  const btnC = $('btnContinue');
  if (save && save.chapter > 0) { btnC.style.display = ''; btnC.textContent = `Continue — ${save.chapter < 5 ? 'Chapter ' + ['I', 'II', 'III', 'IV', 'V'][save.chapter] + ': ' : ''}${CHAPTER_NAMES[save.chapter]}`; }
  const qb = $('btnQuality');
  const qLabel = () => (qb.textContent = `Graphics: ${G.quality[0].toUpperCase() + G.quality.slice(1)}`);
  qLabel();
  qb.onclick = () => {
    const order = ['low', 'medium', 'high'];
    const next = order[(order.indexOf(G.quality) + 1) % 3];
    store.set('kayal1905.quality', next);
    qb.textContent = `Graphics: ${next[0].toUpperCase() + next.slice(1)} — reloading…`;
    setTimeout(() => location.reload(), 300);
  };

  let wasLocked = false;
  const start = async (ch) => {
    audio.init(); audio.resume(); audio.sfx('ui');
    $('menu').classList.add('gone');
    await ui.fade(1, 1.2);
    $('menu').style.display = 'none';
    G.started = true; input.enabled = true;
    input.requestLock();
    env.frozen = false;
    player.setCine(null);
    story.run(ch, false);
  };
  $('btnNew').onclick = () => start(0);
  btnC.onclick = () => start(save.chapter);

  const setPaused = (v) => {
    if (!G.started || G.paused === v) return;
    G.paused = v;
    $('pause').classList.toggle('on', v);
    input.enabled = !v;
    if (v) { input.releaseLock(); $('pauseChapter').textContent = story.tag || ''; }
    else { input.requestLock(); audio.resume(); }
  };
  $('btnResume').onclick = () => setPaused(false);
  $('btnRestart').onclick = () => { setPaused(false); ui.fade(1, 0.6).then(() => story.run(story.chapter, false)); };
  $('btnMute').onclick = () => { audio.enabled = !audio.enabled; if (audio.master) audio.master.gain.value = audio.enabled ? 0.8 : 0; $('btnMute').textContent = audio.enabled ? 'Sound: On' : 'Sound: Off'; };
  $('btnTitle').onclick = () => location.reload();
  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === canvas;
    if (!locked && wasLocked && G.started && !G.paused) setPaused(true);
    wasLocked = locked;
  });
  addEventListener('keydown', (e) => { if (e.code === 'Escape' && G.started && !wasLocked) setPaused(!G.paused); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && G.started) setPaused(true); });

  // ---------------- debug / automation hooks ----------------
  window.KAYAL = {
    G, THREE,
    tp: (x, z) => player.teleport(x, z, player.yaw),
    chapter: (n) => story.run(n, false),
    time: (h) => env.setTime(h),
    rain: (v) => env.setRain(v, true),
    spots: SPOTS,
  };

  ui.hideLoading();
  G.paused = false;
  if (params.has('auto')) {
    await start(parseInt(params.get('ch') || '0', 10));
  }

  // ---------------- main loop ----------------
  let last = performance.now(), landT = 0, landing = null, fpsT = 0, fpsN = 0;
  const sunUV = new THREE.Vector2();
  const tmp = new THREE.Vector3();

  function interactions(dt) {
    let label = null, act = null;
    const pp = player.worldPos(tmp);
    if (G.started && !player.locked && !story.busy && !player.photo && player.health > 0) {
      if (player.mode === 'foot') {
        let bd = 1e9;
        for (const it of G.interactables) {
          const d = Math.hypot(it.pos.x - pp.x, it.pos.z - pp.z);
          if (d < it.r && d < bd && (!it.cond || it.cond())) { bd = d; label = it.label; act = it.action; }
        }
      } else if (player.mode === 'horse') {
        if (player.mount.speed < 4 && !story.noDismount) { label = 'Dismount'; act = () => player.dismount(); }
      } else if (player.mode === 'boat') {
        landT -= dt;
        if (landT <= 0) { landT = 0.2; landing = player.mount.speed < 3.5 ? player.mount.landing() : null; }
        if (landing) { label = 'Step ashore'; const l = landing; act = () => player.dismount(false, l); }
      }
    }
    ui.prompt(label);
    if (act && input.consume('KeyE')) act();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const rawDt = (now - last) / 1000;
    last = now;
    const dt = Math.min(rawDt, 0.05);
    G.dt = dt;

    if (!G.paused) {
      const reps = G.debug.speed || 1;
      for (let rep = 0; rep < reps; rep++) {
        G.time += dt;
        // dialogue advance takes priority over everything
        if (ui.subResolve && (input.hit('KeyE') || input.hit('Space') || input.hit('Enter') || input.hit('Attack'))) {
          ui.advance();
          input.hits.delete('KeyE'); input.hits.delete('Space'); input.hits.delete('Attack');
        }
        if (G.started) {
          if (input.consume('KeyP') && !story.busy && !player.locked) {
            player.photo = !player.photo;
            ui.setHud(!player.photo); ui.letterbox(player.photo);
            $('photoTip').classList.toggle('on', player.photo);
          }
          if (player.photo) {
            if (input.consume('BracketRight')) env.setTime(env.hour + 0.5);
            if (input.consume('BracketLeft')) env.setTime(env.hour - 0.5);
            if (input.consume('KeyR')) env.setRain(env.rainTarget > 0.5 ? 0 : 1);
            if (input.consume('KeyT')) $('photoTip').classList.toggle('on');
          } else if (input.consume('KeyH')) ui.setHud(ui.hudHidden);
        }
        player.update(dt);
        for (let i = 0; i < G.npcs.length; i++) G.npcs[i].update(dt);
        for (let i = 0; i < G.updaters.length; i++) G.updaters[i](dt, G.time);
        const focus = player.worldPos(tmp);
        env.update(dt, camera, focus);
        story.update(dt);
        interactions(dt);
        ui.update(dt);
        const h = getHeight(focus.x, focus.z);
        audio.update(dt, { rain: env.rain, night: env.night, nearWater: player.mode === 'boat' ? 1 : smoothstep(2.2, 0.3, h), speed: player.speedNow, paused: false, muted: !G.started });
      }
    } else if (audio.ctx) {
      audio.update(dt, { rain: env.rain, night: env.night, nearWater: 0, speed: 0, paused: true, muted: false });
    }

    // post uniforms
    const u = post.u;
    u.uTime.value = G.time;
    u.uGod.value = env.sunScreen(camera, sunUV) * 0.9;
    u.uSun.value.copy(sunUV);
    u.uGodCol.value.copy(env.sun.color);
    u.uNight.value = env.night;
    u.uWarm.value = smoothstep(0.4, 0.06, env.sunDir.y) * env.dayLight * (1 - env.rain);
    u.uExposure.value = 1.0 + env.night * 0.55 + env.rain * 0.12 * env.dayLight;
    u.uSat.value = 0.96 - env.rain * 0.14;
    u.uHurt.value = Math.max(ui.hurtV, G.started ? smoothstep(45, 5, player.health) * 0.6 : 0);

    camera.updateMatrixWorld();
    renderer.shadowMap.autoUpdate = true;
    const refl = water.renderReflection(renderer, camera);
    if (refl) renderer.shadowMap.autoUpdate = false;
    post.render(dt);
    renderer.shadowMap.autoUpdate = true;
    input.endFrame();

    // adaptive resolution keeps slow machines playable
    if (G.started && !G.paused && !params.has('noadapt')) {
      fpsT += rawDt; fpsN++;
      if (fpsT > 2.5) {
        const fps = fpsN / fpsT; fpsT = 0; fpsN = 0;
        const old = prScale;
        if (fps < 27 && prScale > 0.5) prScale = Math.max(0.5, prScale * 0.85);
        else if (fps > 56 && prScale < 1) prScale = Math.min(1, prScale * 1.08);
        if (old !== prScale) resize();
      }
    }
  }
  requestAnimationFrame(frame);
}

boot().catch((e) => {
  console.error(e);
  const t = document.getElementById('loadText');
  if (t) t.textContent = 'Something went wrong while loading: ' + (e && e.message ? e.message : e);
});
