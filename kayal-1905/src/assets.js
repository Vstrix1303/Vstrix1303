// Photo-scanned surface textures (CC0, from Poly Haven), shipped with the desktop app.
// If they are not present — the browser build — the game keeps its hand-painted textures.
import * as THREE from 'three';

export const REAL = {};
let ok = false;
export const hasReal = () => ok;

export async function loadRealTextures(renderer, onProgress) {
  let man;
  if (location.protocol === 'file:') return false;          // a page opened straight from disk can't use them
  try { const r = await fetch('assets/tex/manifest.json'); if (!r.ok) return false; man = await r.json(); } catch { return false; }
  const loader = new THREE.TextureLoader(), aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const jobs = Object.entries(man.textures).flatMap(([slot, maps]) => maps.map((m) => [slot, m]));
  let done = 0;
  try {
    await Promise.all(jobs.map(([slot, m]) => loader.loadAsync(`assets/tex/${slot}_${m}.jpg`).then((t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso;
      if (m === 'c') t.colorSpace = THREE.SRGBColorSpace;
      (REAL[slot] || (REAL[slot] = {}))[m] = t;
      onProgress?.(++done / jobs.length);
    })));
  } catch (e) { console.warn('real textures unavailable', e); for (const k in REAL) delete REAL[k]; return false; }
  return (ok = true);
}

// a physically based material from one texture set; `repeat` = repeats per unit of the geometry's UVs
export function realMaterial(slot, o = {}) {
  const t = REAL[slot];
  const tex = (x) => { if (!x) return null; const c = x.clone(); c.repeat.set(o.repeat ?? 1, o.repeat ?? 1); c.needsUpdate = true; return c; };
  const m = new THREE.MeshStandardMaterial({
    map: tex(t.c), normalMap: tex(t.n), roughnessMap: tex(t.arm), aoMap: tex(t.arm), aoMapIntensity: o.ao ?? 0.7,
    normalScale: new THREE.Vector2(o.bump ?? 1, o.bump ?? 1), roughness: o.rough ?? 1, metalness: 0,
    vertexColors: o.vertexColors ?? true, side: o.side ?? THREE.FrontSide,
  });
  if (o.tint) m.color.setRGB(...o.tint);
  return m;
}
