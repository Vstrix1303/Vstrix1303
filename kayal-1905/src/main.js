// RAAPAKAL — Kerala, 1957. Entry point & main loop.
import * as THREE from 'three';
import { loadRealTextures, loadHumans } from './assets.js';
import { G, QUALITY } from './state.js';
import { UI, EQUIP } from './ui.js';
import { setupWheel } from './wheel.js';
import { setupBlobs } from './blobs.js';
import { hush, loadMalayalam } from './voice.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { Player } from './player.js';
import { buildWorld } from './world.js';
import { Post } from './post.js';
import { Story, loadSave, MISSIONS } from './story.js';
import { MapUI } from './mapui.js';
import { getHeight, LOC } from './heightfield.js';
import { SPOTS } from './structures.js';
import { clamp, smoothstep, nextFrame } from './util.js';
import { buildTextures } from './textures.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
};

function pickQuality(gl) {
  if (params.has('igpu')) G.integrated = true;          // testing: behave as on integrated graphics
  const q = params.get('q') || store.get('kayal1905.quality');
  if (q && QUALITY[q]) return q;
  if (matchMedia('(pointer: coarse)').matches) return 'low';
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const r = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
    G.gpuName = r;
    if (/SwiftShader|llvmpipe|Software/i.test(r)) return 'low';
    // graphics built into the processor (Radeon Vega / 'Radeon Graphics', Intel UHD / Iris): share system memory
    if (/Vega|Radeon\(TM\) Graphics|Radeon Graphics|Intel|UHD|Iris/i.test(r) && !/RX|Arc/i.test(r)) { G.integrated = true; return 'medium'; }
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
  // After a graphics-driver reset the game restarts lighter, one step at a time:
  // 1 = drawn figures instead of the realistic bodies, 2 = also built-in textures and Low,
  // 3 = also no screen effects. Shown on F3 and in the pause menu, where it can be reset.
  const compat = Math.min(3, parseInt(store.get('kayal1905.compat') || '0', 10) || 0);
  G.compat = compat;
  if (compat >= 2) G.quality = 'low';
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    if (G.contextLost) return;
    G.contextLost = true;
    const next = Math.min(3, compat + 1);
    store.set('kayal1905.compat', String(next));
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;text-align:center;background:#0b0704;color:#f4e6c0;font:18px Georgia,serif;line-height:1.6;padding:24px';
    d.innerHTML = '<div>The graphics driver reset.<br>Restarting with lighter graphics (compatibility level ' + next + ' of 3)…<br><span style="font-size:14px;opacity:.7">Your progress is saved. Choose Continue on the title screen.</span></div>';
    document.body.appendChild(d);
    setTimeout(() => location.reload(), 2500);
  }, false);
  if (G.integrated) {
    // integrated GPU: keep the look, drop what costs most — multisampling, reflection resolution, grass density
    for (const k of ['medium', 'high', 'ultra']) QUALITY[k] = { ...QUALITY[k], ao: false, msaa: 0, reflection: Math.min(QUALITY[k].reflection, 256), grass: Math.round(QUALITY[k].grass * 0.55), shadow: Math.min(QUALITY[k].shadow, 2048) };
  }
  const q = QUALITY[G.quality];
  // how far people are drawn, how far they cast shadows, how often the shadow map is redrawn
  const light = G.integrated || G.quality === 'low' || G.quality === 'medium';
  G.viewPeople = G.quality === 'low' ? 60 : G.integrated ? 70 : light ? 85 : 115;
  G.shadowPeople = G.quality === 'low' ? 26 : light ? 40 : 52;
  G.shadowEvery = 1;
  const basePR = () => (G.quality === 'low' ? 0.75 * Math.min(devicePixelRatio || 1, 1) : G.quality === 'medium' ? Math.min(devicePixelRatio || 1, 1) : Math.min(devicePixelRatio || 1, 1.5));
  let prScale = G.integrated ? 0.85 : 1, stage = 0, frameN = 0;
  renderer.setPixelRatio(basePR() * prScale);
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = G.scene = new THREE.Scene();
  const camera = G.camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.25, 5200);
  camera.layers.enable(1);
  scene.add(camera);

  const ui = G.ui = new UI();
  const input = G.input = new Input(canvas);
  const audio = G.audio = new AudioSys();
  buildTextures();
  ui.loading(0.02, 'Loading surfaces');
  if (compat < 2) await loadRealTextures(renderer, (p) => ui.loading(0.02 + p * 0.08, 'Loading surfaces'));
  if (compat < 1) await loadHumans((p) => ui.loading(0.1 + p * 0.04, 'Loading people'));
  await loadMalayalam();
  const player = G.player = new Player(scene, camera);

  await nextFrame();
  const W = await buildWorld(scene, async (p, t) => { ui.loading(p, t); await nextFrame(); await nextFrame(); });
  setupWheel(EQUIP);
  setupBlobs(scene);
  ui.attach(scene);
  const post = G.post = new Post(renderer, scene, camera);
  // screen effects can be switched off (pause menu), and switch themselves off if the frame comes out white
  const safeBtn = $('btnFx');
  const setSafe = (on, why) => {
    post.setSafe(on); G.safeRender = on; store.set('kayal1905.safe', on ? '1' : '0');
    if (safeBtn) safeBtn.textContent = 'Screen effects: ' + (on ? 'Off' : 'On');
    if (why) ui.toast(why, 7);
  };
  if (store.get('kayal1905.safe') === '1' || params.has('safe') || compat >= 3) setSafe(true);
  const cBtn = $('btnCompat');
  if (cBtn) {
    cBtn.style.display = compat ? '' : 'none';
    cBtn.textContent = `Graphics compatibility: level ${compat} — reset`;
    cBtn.onclick = () => { store.set('kayal1905.compat', '0'); store.set('kayal1905.safe', '0'); location.reload(); };
  }
  if (safeBtn) safeBtn.onclick = () => setSafe(!G.safeRender);
  const gl = renderer.getContext(), px = new Uint8Array(4);
  let whiteN = 0, whiteT = 0;
  const watchWhite = (dt) => {
    whiteT -= dt; if (whiteT > 0 || !G.started || G.paused) return;
    whiteT = 1.5;
    if (parseFloat(getComputedStyle($('fade')).opacity) > 0.3) { whiteN = 0; return; }
    let white = 0;
    for (const [fx, fy] of [[0.5, 0.5], [0.2, 0.6], [0.8, 0.4], [0.5, 0.85]]) {
      gl.readPixels(Math.floor(gl.drawingBufferWidth * fx), Math.floor(gl.drawingBufferHeight * fy), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      if (px[0] > 248 && px[1] > 248 && px[2] > 248) white++;
    }
    whiteN = white === 4 ? whiteN + 1 : 0;
    G.whiteFrames = whiteN;
    if (whiteN >= 3 && !G.safeRender) { whiteN = 0; setSafe(true, 'The screen came out blank on this graphics driver, so the screen effects (bloom, colour grading) were switched off. Turn them back on from the pause menu if you like.'); }
  };
  const story = G.story = new Story();
  story.attach(scene);
  const mapUI = G.mapUI = new MapUI();
  const env = G.env, water = G.water;

  // stage 1: no bloom, shadows every 3rd frame · 2: no water reflection, people nearer · 3: shadow casters only close by
  const base = { view: G.viewPeople, shadowP: G.shadowPeople, every: G.shadowEvery };
  const degrade = (st) => {
    if (post.bloom) post.bloom.enabled = st < 1;
    G.shadowEvery = st >= 2 ? 3 : st >= 1 ? 2 : base.every;
    water.enabled = st < 2 && !!water.wantEnabled;
    G.viewPeople = st >= 2 ? Math.min(base.view, 65) : base.view;
    G.shadowPeople = st >= 3 ? Math.min(base.shadowP, 26) : base.shadowP;
  };
  G.perf = () => ({ prScale, stage });
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
  if (save && save.done > 0) { btnC.style.display = ''; btnC.textContent = `Continue — ${save.done < MISSIONS.length ? 'next: ' + MISSIONS[save.done].name : 'free roam'}`; }
  const qb = $('btnQuality');
  const qLabel = () => (qb.textContent = `Graphics: ${G.quality[0].toUpperCase() + G.quality.slice(1)}`);
  qLabel();
  qb.onclick = () => {
    const order = ['low', 'medium', 'high', 'ultra'];
    const next = order[(order.indexOf(G.quality) + 1) % order.length];
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
    if (ch === 'new') story.newGame(); else if (ch === 'continue') story.continueGame(save); else { story.state.done = ch; if (ch < MISSIONS.length) story.startMission(ch); else story.enterFree({ fresh: true }); }
  };
  $('btnNew').onclick = () => start('new');
  btnC.onclick = () => start('continue');

  const setPaused = (v) => {
    if (!G.started || G.paused === v) return;
    G.paused = v;
    $('pause').classList.toggle('on', v);
    input.enabled = !v;
    if (v) { input.releaseLock(); $('pauseChapter').textContent = story.tag || ''; hush(); }
    else { input.requestLock(); audio.resume(); }
  };
  $('btnResume').onclick = () => setPaused(false);
  $('btnRestart').onclick = () => { setPaused(false); ui.fade(1, 0.6).then(() => (story.mode === 'mission' ? story.startMission(story.mi, story.cp) : story.enterFree({ fresh: true }))); };
  // voices: Malayalam recordings, the system's English voices, or none
  { const b = document.createElement('button'); b.className = 'small'; b.id = 'btnVoice';
    const lab = () => { b.textContent = 'Voices: ' + ({ ml: 'Malayalam', en: 'English', off: 'Off' }[G.voiceLang]); };
    try { G.voiceLang = localStorage.getItem('raapakal.voice') || 'ml'; } catch (e) { G.voiceLang = 'ml'; }
    lab(); b.onclick = () => { G.voiceLang = { ml: 'en', en: 'off', off: 'ml' }[G.voiceLang]; try { localStorage.setItem('raapakal.voice', G.voiceLang); } catch (e) { /* ignore */ } lab(); };
    $('btnMute').after(b); }
  $('btnMute').onclick = () => { audio.enabled = !audio.enabled; if (audio.master) audio.master.gain.value = audio.enabled ? 0.8 : 0; $('btnMute').textContent = audio.enabled ? 'Sound: On' : 'Sound: Off'; };
  $('btnTitle').onclick = () => location.reload();
  // running as the desktop application: offer fullscreen and a way out
  const D = window.kayalDesktop;
  if (D) {
    document.querySelectorAll('.desk').forEach((el) => { el.style.display = ''; });
    const fb = $('btnFull'), showFull = (on) => { fb.textContent = 'Fullscreen: ' + (on ? 'On' : 'Off'); };
    D.isFullscreen().then(showFull); D.onFullscreen(showFull);
    fb.onclick = () => D.toggleFullscreen();
    $('btnQuit').onclick = $('btnQuit2').onclick = () => D.quit();
  }
  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === canvas;
    if (!locked && wasLocked && G.started && !G.paused && !G.mapOpen && !G.shopOpen && !G.wheelOpen && performance.now() - (G.uiT || 0) > 700) setPaused(true);
    wasLocked = locked;
  });
  addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && G.mapOpen) { mapUI.close(); return; }
    if (G.shopOpen) return;
    if (e.code === 'KeyM' && G.started && !G.paused && !e.repeat) {
      if (G.mapOpen) mapUI.close(); else if (!story.busy && !ui.subResolve && !story.failing) mapUI.open();
      return;
    }
    if (e.code === 'Escape' && G.started && !wasLocked) setPaused(!G.paused);
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && G.started) setPaused(true); });

  // ---------------- debug / automation hooks ----------------
  window.KAYAL = {
    G, THREE,
    tp: (x, z) => player.teleport(x, z, player.yaw),
    chapter: (n) => { story.state.done = n; if (n < MISSIONS.length) story.startMission(n); else story.enterFree({ fresh: true }); },
    free: (n) => { story.state.done = n; story.enterFree({ fresh: true }); },
    time: (h) => env.setTime(h),
    rain: (v) => env.setRain(v, true),
    spots: SPOTS,
    encounter: (t) => G.world.encounter?.(t),
    h: getHeight,
  };

  ui.hideLoading();
  G.paused = false;
  if (params.has('auto')) {
    await start(params.has('ch') ? parseInt(params.get('ch'), 10) : 'new');
  }

  // ---------------- main loop ----------------
  let last = performance.now(), landT = 0, landing = null, fpsT = 0, fpsN = 0;
  // F3 shows the frame rate — useful for choosing a Graphics setting
  let fpsEl = null;
  addEventListener('keydown', (e) => {
    if (e.code !== 'F3') return;
    e.preventDefault();
    if (fpsEl) { fpsEl.remove(); fpsEl = null; return; }
    fpsEl = document.createElement('div');
    fpsEl.style.cssText = 'position:fixed;left:8px;top:8px;z-index:99;font:12px monospace;color:#fff;background:rgba(0,0,0,.55);padding:3px 7px;border-radius:3px;pointer-events:none';
    fpsEl.textContent = 'measuring…'; document.body.appendChild(fpsEl);
  });
  const sunUV = new THREE.Vector2();
  const tmp = new THREE.Vector3();

  function interactions(dt) {
    let label = null, act = null;
    const pp = player.worldPos(tmp);
    if (G.activity && G.activity.label) { label = G.activity.label; act = G.activity.action; }
    else if (G.started && !player.locked && !story.busy && !player.photo && player.health > 0) {
      if (player.mode === 'foot') {
        let bd = 1e9;
        for (const it of G.interactables) {
          const d = Math.hypot(it.pos.x - pp.x, it.pos.z - pp.z);
          if (d < it.r && (d < bd || it.prio) && (!it.cond || it.cond())) { bd = it.prio ? -1 : d; label = it.label; act = it.action; }
        }
      } else if (player.mode === 'horse') {
        if (player.mount.speed < 4 && !story.noDismount) { label = player.mount.offLabel || 'Dismount'; act = () => player.dismount(); }
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
    const dt = Math.min(rawDt, 0.05) * (G.wheelOpen ? 0.25 : 1);     // the weapon wheel slows the world
    G.dt = dt;

    if (G.mapOpen) mapUI.draw();
    if (!G.paused && !G.mapOpen) {
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
          if (input.consume('KeyX') && !player.locked && !story.busy) G.act.whistle();
          if (input.consume('Cycle')) G.cycleWeapon?.();
          if (input.consume('KeyI') && !player.locked && !story.busy && !G.activity) G.act.satchel();
          if (input.consume('KeyV') && !player.locked && player.health > 0) G.act.quickUse();
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
    u.uWarm.value = smoothstep(0.62, 0.1, env.sunDir.y) * env.dayLight * (1 - env.rain);
    u.uExposure.value = 1.04 + env.night * 0.5 + env.rain * 0.12 * env.dayLight;
    u.uSat.value = 0.9 - env.rain * 0.12;
    u.uHurt.value = Math.max(ui.hurtV, G.started ? smoothstep(45, 5, player.health) * 0.6 : 0);

    camera.updateMatrixWorld();
    // the shadow map is drawn from the main camera (so people cast shadows), every frame or every other one
    frameN++;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = false;
    water.renderReflection(renderer, camera);
    renderer.shadowMap.needsUpdate = frameN % (G.shadowEvery || 1) === 0 || frameN < 3;
    post.render(dt);
    watchWhite(rawDt);
    input.endFrame();

    // adaptive resolution keeps slow machines playable
    if (G.started && !G.paused && !params.has('noadapt')) {
      fpsT += rawDt; fpsN++;
      if (fpsT > 2.5) {
        const fps = fpsN / fpsT; fpsT = 0; fpsN = 0;
        const old = prScale;
        if (fpsEl) fpsEl.textContent = `${Math.round(fps)} fps · ${G.quality}${G.integrated ? ' (integrated GPU)' : ''} · ${Math.round(prScale * 100)}% resolution${stage ? ' · effects trimmed ' + stage : ''}${G.safeRender ? ' · screen effects off' : ''}${G.compat ? ' · compatibility ' + G.compat : ''} · ${(G.gpuName || 'unknown GPU').replace(/^ANGLE \(|\)$/g, '').slice(0, 70)}`;
        // aim for at least 40 frames a second: first lower the resolution, then trim the costliest effects
        if (fps < 41) {
          if (prScale > 0.6) prScale = Math.max(0.6, prScale * 0.88);
          else if (stage < 3) degrade(++stage);
        } else if (fps > 62) {
          if (stage > 0 && prScale >= 0.75) degrade(--stage);
          else if (prScale < 1) prScale = Math.min(1, prScale * 1.07);
        }
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
