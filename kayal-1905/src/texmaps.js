// Surface maps derived from painted colour: a tangent-space normal map from
// the relief implied by light and shade, so folds, creases, hair and hide
// catch the light instead of lying flat.
import * as THREE from 'three';

export function normalFromCanvas(src, N = 256, strength = 2.2, repeat = false) {
  const c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(src, 0, 0, N, N);
  const im = g.getImageData(0, 0, N, N), d = im.data, L = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) L[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) / 255;
  for (let y = 0; y < N; y++) {
    const y0 = y > 0 ? y - 1 : (repeat ? N - 1 : 0), y1 = y < N - 1 ? y + 1 : (repeat ? 0 : N - 1);
    for (let x = 0; x < N; x++) {
      const x0 = x > 0 ? x - 1 : (repeat ? N - 1 : 0), x1 = x < N - 1 ? x + 1 : (repeat ? 0 : N - 1);
      const dx = (L[y * N + x1] - L[y * N + x0]) * strength, dy = (L[y1 * N + x] - L[y0 * N + x]) * strength;
      const l = 1 / Math.sqrt(dx * dx + dy * dy + 1), i = (y * N + x) * 4;
      d[i] = (-dx * l * 0.5 + 0.5) * 255; d[i + 1] = (dy * l * 0.5 + 0.5) * 255; d[i + 2] = (l * 0.5 + 0.5) * 255; d[i + 3] = 255;
    }
  }
  g.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
