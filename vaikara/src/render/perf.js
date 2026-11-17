// Performance: GPU detection (picks the Laptop preset on integrated graphics),
// automatic resolution that holds the target frame rate, LOD scaling under
// sustained load, and the F3 overlay.
import { G } from '../state.js';

// Integrated GPUs share memory bandwidth with the CPU: Intel UHD/Iris/Xe, AMD
// "Radeon Graphics" APUs, Apple silicon, Qualcomm.
const INTEGRATED = /intel|iris|uhd|\bxe\b|gen-?\d+|apple|m1|m2|m3|m4|radeon\(tm\) graphics|radeon graphics|vega \d+ graphics|adreno|mali|integrated/i;

export async function detectGPU() {
  let name = '';
  try {
    if (navigator.gpu) {
      const a = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      const i = a?.info || (await a?.requestAdapterInfo?.()) || {};
      name = [i.vendor, i.architecture, i.device, i.description].filter(Boolean).join(' ');
    }
  } catch { /* ignore */ }
  if (!name) {
    try {
      const gl = document.createElement('canvas').getContext('webgl2');
      const ext = gl?.getExtension('WEBGL_debug_renderer_info');
      name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER) || '';
    } catch { /* ignore */ }
  }
  const discrete = /nvidia|geforce|rtx|gtx|radeon rx|radeon pro|arc a\d/i.test(name);
  return { name, integrated: !discrete && INTEGRATED.test(name) };
}

export class Perf {
  constructor(renderer, scene) {
    this.renderer = renderer; this.scene = scene;
    this.base = Math.min(devicePixelRatio, 2);
    this.scale = G.Q.pixelRatio;            // current render scale (≤ preset maximum)
    this.min = Math.min(0.5, G.Q.pixelRatio);
    this.max = G.Q.pixelRatio;
    this.auto = true; this.target = 60;
    try { const s = JSON.parse(localStorage.getItem('vaikara.perf') || '{}'); if (s.auto === false) this.auto = false; if (s.target) this.target = s.target; } catch { /* ignore */ }
    this.ms = 16.7; this.slow = 0; this.fast = 0; this.floorT = 0;
    this.warm = 5; // ignore the first seconds (shader compilation hitches)
    this.sim = +(new URLSearchParams(location.search).get('perfsim') || 0); // debug: pretend frames take this many ms
    this.el = document.getElementById('perf');
    this.cats = {}; this.catT = 0;
    this.apply();
  }

  save() { try { localStorage.setItem('vaikara.perf', JSON.stringify({ auto: this.auto, target: this.target })); } catch { /* ignore */ } }
  apply() { this.renderer.setPixelRatio(this.base * this.scale); }

  frame(dt) {
    const ms = this.sim || dt * 1000;
    this.ms += (ms - this.ms) * 0.08;
    const fps = 1000 / this.ms, lo = this.target * 0.87, hi = this.target * 0.97;
    this.warm -= dt;
    if (this.auto && this.warm <= 0) {
      if (fps < lo) { this.slow += dt; this.fast = 0; } else if (fps > hi) { this.fast += dt; this.slow = 0; } else { this.slow = 0; this.fast = 0; }
      if (this.slow > 1.5) {
        this.slow = 0;
        if (this.scale > this.min + 0.01) { this.scale = Math.max(this.min, +(this.scale - 0.1).toFixed(2)); this.apply(); }
        else this.floorT += 1.5;
      }
      if (this.floorT >= 10 && G.lodScale > 0.7) { G.lodScale = +(G.lodScale - 0.1).toFixed(2); this.floorT = 0; }
      if (this.fast > 4) {
        this.fast = 0; this.floorT = 0;
        if (G.lodScale < 1) G.lodScale = +(Math.min(1, G.lodScale + 0.1)).toFixed(2);
        else if (this.scale < this.max - 0.01) { this.scale = Math.min(this.max, +(this.scale + 0.1).toFixed(2)); this.apply(); }
      }
    }
    this.hud(dt);
  }

  // F3 overlay with a per-category triangle estimate (visible meshes × instances)
  hud(dt) {
    if (!this.el || this.el.classList.contains('hidden')) return;
    this.catT -= dt;
    if (this.catT <= 0) {
      this.catT = 1;
      const c = {};
      this.scene.traverseVisible((o) => {
        if (!o.isMesh) return;
        const cat = o.userData.cat || o.parent?.userData.cat || 'other';
        const g = o.geometry, t = (g.index ? g.index.count : g.attributes.position?.count || 0) / 3;
        c[cat] = (c[cat] || 0) + t * (o.isInstancedMesh ? o.count : 1);
      });
      this.cats = c;
    }
    const i = this.renderer.info.render;
    const cats = Object.entries(this.cats).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / 1e6).toFixed(2)}M`).join(' · ');
    this.el.textContent = `${(1000 / this.ms).toFixed(0)} fps  ${this.ms.toFixed(1)} ms  ${G.backend} ${G.quality}\n`
      + `render scale ${(this.scale * 100).toFixed(0)}% ${this.auto ? `(auto → ${this.target} fps)` : '(fixed)'}   LOD ${(G.lodScale * 100).toFixed(0)}%\n`
      + `${(i.triangles / 1e6).toFixed(2)}M tris drawn · ${i.calls} draw calls\n${cats}`;
  }
}
