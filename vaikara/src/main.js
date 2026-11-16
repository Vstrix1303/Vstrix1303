// VAIKARA — Malabar Coast, circa 1905. Entry point.
import * as THREE from 'three/webgpu';
import { G, U, QUALITY_PRESETS } from './state.js';
import { loadWorld, getHeight } from './world/data.js';
import { placeById } from './world/layout.js';
import { Terrain, terrainMaterial } from './render/terrain.js';
import { Sky } from './render/sky.js';
import { Water } from './render/water.js';
import { Post } from './render/post.js';
import { Vegetation } from './render/vegetation.js';
import { Settlements } from './render/buildings/settlements.js';
import { Props } from './render/props.js';
import { Input } from './game/input.js';
import { Player } from './game/player.js';
import { FlyCam } from './game/flycam.js';
import { UI } from './game/ui.js';
import { Colliders } from './game/physics.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const status = (t, p) => { $('status').textContent = t; if (p != null) $('bar').firstElementChild.style.width = `${Math.round(p * 100)}%`; };
const tick = () => new Promise((r) => setTimeout(r, 0));

function pickQuality() {
  let q = params.get('q');
  try { q = q || localStorage.getItem('vaikara.quality'); } catch { /* storage blocked */ }
  if (!QUALITY_PRESETS[q]) q = 'high';
  G.quality = q; G.Q = QUALITY_PRESETS[q];
  const box = $('qual');
  box.innerHTML = '';
  for (const k of Object.keys(QUALITY_PRESETS)) {
    const b = document.createElement('button');
    b.className = 'btn' + (k === q ? ' sel' : ''); b.textContent = k;
    b.onclick = () => { try { localStorage.setItem('vaikara.quality', k); } catch { /* ignore */ } location.search = new URLSearchParams({ ...Object.fromEntries(params), q: k }).toString(); };
    box.appendChild(b);
  }
}

async function boot() {
  pickQuality();
  status('Reading the survey of 1905…', 0.02);
  const world = loadWorld(G.base, (p) => status('Reading the survey of 1905…', 0.02 + p * 0.38));

  const canvas = $('c');
  const forceGL = params.has('webgl');
  let renderer = new THREE.WebGPURenderer({ canvas, antialias: false, forceWebGL: forceGL, powerPreference: 'high-performance' });
  try { await renderer.init(); } catch (e) {
    console.warn('WebGPU init failed, falling back to WebGL2', e);
    renderer = new THREE.WebGPURenderer({ canvas, antialias: false, forceWebGL: true });
    await renderer.init();
  }
  // if the GPU device is lost (driver reset), reload on the WebGL2 path
  renderer.backend.device?.lost?.then((info) => {
    if (info.reason === 'destroyed') return;
    console.warn('WebGPU device lost:', info.message);
    const q = new URLSearchParams(location.search); q.set('webgl', '1'); location.search = q.toString();
  });
  G.backend = renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL2';
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2) * G.Q.pixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = G.Q.shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  G.renderer = renderer;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.25, 32000);
  G.scene = scene; G.camera = camera;
  await world;

  status('Raising the land…', 0.42); await tick();
  const sky = new Sky(scene, renderer, camera);
  if (params.has('nosky')) sky.sky.visible = false;
  const tmat = await terrainMaterial();
  const terrain = new Terrain(scene, tmat);
  status('Filling the backwaters…', 0.5); await tick();
  const water = new Water(scene);
  G.colliders = new Colliders();

  status('Building Vaikara…', 0.56); await tick();
  const towns = new Settlements(scene);
  await towns.build((p) => status('Building Vaikara…', 0.56 + p * 0.14));
  status('Planting the coconut groves…', 0.7); await tick();
  const veg = new Vegetation(scene, renderer);
  await veg.build((p) => status('Planting the coconut groves…', 0.7 + p * 0.16));
  status('Launching the boats…', 0.87); await tick();
  const props = new Props(scene);
  await props.build();

  status('Waking the traveller…', 0.9); await tick();
  Input.init(canvas);
  const player = new Player(scene, camera);
  await player.load();
  G.player = player;
  const fly = new FlyCam(camera);
  const ui = new UI({ player, fly, sky, camera });

  // start: on Vaikara Bridge road looking over the river, or ?at=place / ?cam=x,y,z,yaw,pitch
  const start = placeById[params.get('at')] || placeById.vaikara_town;
  if (params.get('at')) ui.travel(start.x, start.z); else player.teleport(start.x - 60, start.z + 70);
  if (params.get('hour')) sky.setHour(+params.get('hour'), true);
  if (params.has('pause')) G.timeScale = 0;
  if (params.get('cam')) {
    const [x, y, z, yaw, pitch] = params.get('cam').split(',').map(Number);
    fly.enable(true); fly.pos.set(x, y, z); fly.yaw = yaw || 0; fly.pitch = pitch || 0;
  }

  status('Compiling shaders…', 0.94); await tick();
  const post = new Post(renderer, scene, camera);
  G.focus.copy(fly.enabled ? fly.pos : player.pos);
  terrain.buildAll(G.focus);
  try { await renderer.compileAsync(scene, camera); } catch (e) { console.warn(e); }
  status(`Ready · ${G.backend}`, 1);

  const enter = () => {
    $('title').classList.add('fade');
    setTimeout(() => $('title').classList.add('hidden'), 1300);
    canvas.focus();
    if (!params.has('shot')) canvas.requestPointerLock?.();
    ui.started = true;
  };
  if (params.has('shot')) enter();
  else { $('start').classList.add('on'); $('start').onclick = enter; $('start').focus(); }

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  const clock = new THREE.Timer();
  const _dir = new THREE.Vector3(); let glareS = 0;
  let frames = 0, fpsT = 0, fps = 0;
  window.__vaikara = { G, sky, terrain, veg, player, fly, ui, frame: 0 };
  renderer.setAnimationLoop(() => {
    clock.update(); const dt = Math.min(0.05, clock.getDelta());
    G.dt = dt; G.time += dt; U.time.value = G.time;
    ui.update(dt);
    if (fly.enabled) fly.update(dt); else player.update(dt);
    G.focus.copy(fly.enabled ? fly.pos : player.pos);
    U.camPos.value.copy(camera.position);
    sky.update(dt);
    // simple eye adaptation: stop down when looking into a low sun; soften the disc at dawn/dusk
    camera.getWorldDirection(_dir);
    const sd = sky.sunDir, low = 1 - THREE.MathUtils.smoothstep(sd.y, 0.08, 0.5);
    const glare = Math.pow(Math.max(0, _dir.dot(sd)), 6) * low * (1 - U.night.value);
    glareS += (glare - glareS) * Math.min(1, dt * 2.5);
    sky.sky.showSunDisc.value = 0.25 + 0.75 * THREE.MathUtils.smoothstep(sd.y, 0.06, 0.3);
    const hr = G.hour;
    post.warm.value = 1.4 * (THREE.MathUtils.smoothstep(hr, 5.8, 6.6) * (1 - THREE.MathUtils.smoothstep(hr, 7.6, 8.8)) + THREE.MathUtils.smoothstep(hr, 15.8, 17) * (1 - THREE.MathUtils.smoothstep(hr, 18.6, 19.3)));
    renderer.toneMappingExposure = sky.exposure * (1 - 0.5 * glareS) * (params.get('exp') ? +params.get('exp') : 1);
    terrain.update(camera.position);
    water.update(camera.position);
    veg.update(camera.position, dt);
    towns.update(dt);
    props.update(dt, camera.position);
    if (params.has('nopost')) renderer.render(scene, camera); else post.render();
    Input.endFrame();
    frames++; fpsT += dt; window.__vaikara.frame++;
    if (params.has('shot') && window.__vaikara.frame >= (+params.get('frames') || 8)) {
      renderer.setAnimationLoop(null); window.__vaikara.done = true;
      console.info('[vaikara] info', JSON.stringify({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles }));
      let rows = [];
      scene.traverse((o) => { if (o.isMesh && o.visible) { const g = o.geometry; const t = (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); if (t > 2e5) rows.push(`${o.name || o.material?.type || '?'}:${o.isInstancedMesh ? o.count + 'x' : ''}${(t / 1e6).toFixed(2)}M`); } });
      console.info('[vaikara] heavy', rows.join(' | '));
    }
    if (fpsT > 0.5) { fps = frames / fpsT; frames = 0; fpsT = 0; ui.stats(fps, renderer.info); }
  });
}

boot().catch((e) => {
  console.error(e);
  $('err').textContent = `Vaikara could not start: ${e.message}. A recent desktop Chrome or Edge with WebGPU (or WebGL2) is required.`;
});
void getHeight;
