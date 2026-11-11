// Shared mutable game context. Modules attach their systems here so that
// nothing needs a circular import.
export const G = {
  renderer: null,
  scene: null,
  camera: null,
  quality: 'high',
  time: 0,          // real seconds since start
  dt: 0.016,
  paused: true,
  started: false,
  env: null,
  world: null,
  player: null,
  ui: null,
  audio: null,
  story: null,
  input: null,
  npcs: [],
  interactables: [],
  updaters: [],     // fn(dt, t) called every frame
  debug: {},
};

export const QUALITY = {
  low: { pixelRatio: 0.75, shadow: 1024, msaa: 0, reflection: 0, grass: 9000, bloom: false, rain: 2500, treeScale: 0.6 },
  medium: { pixelRatio: 1, shadow: 2048, msaa: 2, reflection: 384, grass: 22000, bloom: true, rain: 5000, treeScale: 0.85 },
  high: { pixelRatio: 1.25, shadow: 2048, msaa: 4, reflection: 640, grass: 42000, bloom: true, rain: 8000, treeScale: 1 },
};
