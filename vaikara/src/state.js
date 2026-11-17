// Shared runtime state.
import { uniform, vec3 } from 'three/tsl';
import * as THREE from 'three/webgpu';

// Presets. pixelRatio is the maximum render scale; auto resolution (perf.js)
// lowers it when frames run long. lod scales every LOD distance.
export const QUALITY_PRESETS = {
  low: { pixelRatio: 0.7, shadows: true, shadowMap: 1024, cascades: 1, shadowFar: 300, ao: false, bloom: false, treeNear: 110, treeFar: 2000, grass: 0.3, terrainLod: 0.6, npc: 10, waterRing: 1.07 },
  laptop: { pixelRatio: 0.8, shadows: true, shadowMap: 1024, cascades: 1, shadowFar: 380, ao: false, bloom: true, treeNear: 130, treeFar: 2600, grass: 0.45, terrainLod: 0.7, npc: 12, waterRing: 1.06 },
  medium: { pixelRatio: 1, shadows: true, shadowMap: 2048, cascades: 2, shadowFar: 700, ao: false, bloom: true, treeNear: 160, treeFar: 3200, grass: 0.6, terrainLod: 0.8, npc: 16, waterRing: 1.045 },
  high: { pixelRatio: 1, shadows: true, shadowMap: 2048, cascades: 3, shadowFar: 1200, ao: true, bloom: true, treeNear: 210, treeFar: 4200, grass: 1, terrainLod: 1, npc: 20, waterRing: 1.035 },
  ultra: { pixelRatio: 1.5, shadows: true, shadowMap: 4096, cascades: 4, shadowFar: 2400, ao: true, bloom: true, treeNear: 280, treeFar: 5200, grass: 1.4, terrainLod: 1.3, npc: 24, waterRing: 1.03 },
};

export const G = {
  renderer: null, scene: null, camera: null,
  quality: 'high', Q: QUALITY_PRESETS.high,
  base: './assets/',
  time: 0, dt: 0,
  hour: 7.2,           // time of day
  timeScale: 1 / 40,   // game hours per real second (≈ 16 min day)
  player: null,
  focus: new THREE.Vector3(), // what streaming systems centre on (player or free cam)
  colliders: null,
  lodScale: 1,   // 0.7..1: LOD distances, lowered by auto quality under load
};

// Global shader uniforms.
export const U = {
  time: uniform(0),
  sunDir: uniform(new THREE.Vector3(0.3, 0.8, 0.2)),
  sunColor: uniform(new THREE.Color(1, 0.95, 0.85)),
  wind: uniform(1),
  night: uniform(0),
  fogColor: uniform(new THREE.Color(0.7, 0.75, 0.8)),
  fogDensity: uniform(0.00012),
  mist: uniform(0),
  rain: uniform(0),
  storm: uniform(0),
  cloud: uniform(0),
  camPos: uniform(new THREE.Vector3()),
};
export const UP = vec3(0, 1, 0);
