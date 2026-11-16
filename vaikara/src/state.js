// Shared runtime state.
import { uniform, vec3 } from 'three/tsl';
import * as THREE from 'three/webgpu';

export const QUALITY_PRESETS = {
  low: { pixelRatio: 0.75, shadows: false, shadowMap: 1024, cascades: 2, ao: false, bloom: false, treeNear: 140, treeFar: 2200, grass: 0.35, terrainLod: 0.6 },
  medium: { pixelRatio: 1, shadows: true, shadowMap: 1024, cascades: 3, ao: false, bloom: true, treeNear: 200, treeFar: 3200, grass: 0.6, terrainLod: 0.8 },
  high: { pixelRatio: 1, shadows: true, shadowMap: 2048, cascades: 3, ao: true, bloom: true, treeNear: 250, treeFar: 4200, grass: 1, terrainLod: 1 },
  ultra: { pixelRatio: 1.5, shadows: true, shadowMap: 4096, cascades: 4, ao: true, bloom: true, treeNear: 330, treeFar: 5200, grass: 1.4, terrainLod: 1.3 },
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
  camPos: uniform(new THREE.Vector3()),
};
export const UP = vec3(0, 1, 0);
