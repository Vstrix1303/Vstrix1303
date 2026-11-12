// Every texture in the game is painted procedurally on a canvas at load
// time — the game ships with no image files at all.
import * as THREE from 'three';
import { makeRng, tfbm } from './util.js';

function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function tex(c, { repeat = true, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function speckle(ctx, w, h, rng, n, colors, minS, maxS, alpha = 0.25) {
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = alpha * (0.4 + rng() * 0.6);
    ctx.fillStyle = colors[(rng() * colors.length) | 0];
    const s = minS + rng() * (maxS - minS);
    ctx.beginPath();
    ctx.ellipse(rng() * w, rng() * h, s, s * (0.5 + rng()), rng() * 3, 0, 7);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Weathering pass: film-grain, damp blotches, drip streaks and hairline cracks.
function grit(c, rng, amt = 1, streaks = 0, cracks = 4) {
  const g = c.getContext('2d'), w = c.width, h = c.height;
  if (!grit.n) {
    const nc = grit.n = document.createElement('canvas'); nc.width = nc.height = 512;
    const ng = nc.getContext('2d'), im = ng.createImageData(512, 512), d = im.data;
    for (let i = 0; i < d.length; i += 4) { const v = 96 + rng() * 64; d[i] = v; d[i + 1] = v; d[i + 2] = v * 0.96; d[i + 3] = 255; }
    ng.putImageData(im, 0, 0);
  }
  g.globalAlpha = Math.min(1, 0.55 * amt); g.globalCompositeOperation = 'overlay';
  for (let y = 0; y < h; y += 512) for (let x = 0; x < w; x += 512) g.drawImage(grit.n, x, y);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 46; i++) {
    const x = rng() * w, y = rng() * h, r = 8 + rng() * w * 0.2, dark = rng() < 0.65;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, dark ? `rgba(30,22,12,${0.05 + rng() * 0.11 * amt})` : `rgba(255,245,225,${0.04 + rng() * 0.06})`); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < streaks; i++) {
    const x = rng() * w, y = rng() * h * 0.5, len = h * (0.2 + rng() * 0.6), ww = 2 + rng() * 7;
    const grd = g.createLinearGradient(0, y, 0, y + len);
    grd.addColorStop(0, `rgba(35,30,18,${0.1 + rng() * 0.14})`); grd.addColorStop(1, 'rgba(35,30,18,0)');
    g.fillStyle = grd; g.fillRect(x, y, ww, len);
  }
  g.lineWidth = 0.8;
  for (let i = 0; i < cracks; i++) {
    let x = rng() * w, y = rng() * h, a = rng() * 6.28;
    g.strokeStyle = `rgba(25,18,10,${0.25 + rng() * 0.3})`;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 14; k++) { a += (rng() - 0.5) * 1.1; x += Math.cos(a) * (4 + rng() * 9); y += Math.sin(a) * (4 + rng() * 9); g.lineTo(x, y); }
    g.stroke();
  }
}

export const TEX = {};

export function buildTextures() {
  if (TEX.noise) return TEX;
  const rng = makeRng(1905);

  // --- tileable RGBA noise (data, linear) ---
  {
    const S = 256, data = new Uint8Array(S * S * 4);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      data[i] = tfbm(x / S * 8, y / S * 8, 8, 4, 1) * 255;
      data[i + 1] = tfbm(x / S * 4, y / S * 4, 4, 3, 2) * 255;
      data[i + 2] = tfbm(x / S * 32, y / S * 32, 32, 2, 3) * 255;
      data[i + 3] = tfbm(x / S * 16, y / S * 16, 16, 3, 4) * 255;
    }
    const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true; t.needsUpdate = true;
    TEX.noise = t;
  }

  // --- water normal map ---
  {
    const S = 256, hgt = new Float32Array(S * S), data = new Uint8Array(S * S * 4);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) hgt[y * S + x] = tfbm(x / S * 6, y / S * 6, 6, 5, 7);
    const H = (x, y) => hgt[((y + S) % S) * S + ((x + S) % S)];
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * 14, dy = (H(x, y + 1) - H(x, y - 1)) * 14;
      const l = Math.hypot(dx, dy, 1), i = (y * S + x) * 4;
      data[i] = (-dx / l * 0.5 + 0.5) * 255; data[i + 1] = (-dy / l * 0.5 + 0.5) * 255;
      data[i + 2] = (1 / l * 0.5 + 0.5) * 255; data[i + 3] = 255;
    }
    const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true; t.needsUpdate = true;
    TEX.waterNormal = t;
  }

  // --- coconut frond ---
  {
    const [c, g] = mk(512, 128);
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < 82; i++) {
        const x = 6 + i * 6.1, t = x / 512;
        const len = 62 * Math.pow(Math.sin(Math.PI * (0.06 + 0.92 * t)), 0.45) * (0.85 + rng() * 0.2);
        const lean = 16 + t * 10;
        for (const sgn of [-1, 1]) {
          const hue = 78 + rng() * 26, lit = 17 + rng() * 14 + pass * 4, sat = 42 + rng() * 18;
          g.fillStyle = `hsl(${hue},${sat}%,${lit}%)`;
          g.beginPath();
          g.moveTo(x - 3.4, 64);
          g.quadraticCurveTo(x + lean * 0.4, 64 + sgn * len * 0.55, x + lean + rng() * 6, 64 + sgn * len);
          g.quadraticCurveTo(x + lean * 0.6 + 4, 64 + sgn * len * 0.5, x + 3.4, 64);
          g.fill();
        }
      }
    }
    const grd = g.createLinearGradient(0, 0, 512, 0);
    grd.addColorStop(0, '#8d8a44'); grd.addColorStop(1, '#6f8a3a');
    g.strokeStyle = grd; g.lineWidth = 5;
    g.beginPath(); g.moveTo(0, 64); g.lineTo(508, 64); g.stroke();
    TEX.frond = tex(c, { repeat: false });
  }

  // --- broad leaf cluster ---
  {
    const [c, g] = mk(256, 256);
    for (let i = 0; i < 150; i++) {
      const a = rng() * 7, r = Math.sqrt(rng()) * 104;
      const x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r;
      const depth = i / 150;
      g.save();
      g.translate(x, y); g.rotate(rng() * 7);
      g.fillStyle = `hsl(${88 + rng() * 34},${38 + rng() * 22}%,${15 + depth * 19 + rng() * 9}%)`;
      g.beginPath(); g.ellipse(0, 0, 21 + rng() * 9, 9 + rng() * 4, 0, 0, 7); g.fill();
      g.strokeStyle = 'rgba(190,210,120,0.22)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(-20, 0); g.lineTo(20, 0); g.stroke();
      g.restore();
    }
    TEX.leaves = tex(c, { repeat: false });
  }

  // --- banana leaf ---
  {
    const [c, g] = mk(256, 96);
    const grd = g.createLinearGradient(0, 0, 0, 96);
    grd.addColorStop(0, '#34632a'); grd.addColorStop(0.5, '#557f38'); grd.addColorStop(1, '#2f5c26');
    g.fillStyle = grd;
    g.beginPath(); g.ellipse(128, 48, 124, 44, 0, 0, 7); g.fill();
    g.strokeStyle = 'rgba(30,70,20,0.35)'; g.lineWidth = 1;
    for (let x = 10; x < 250; x += 5) { g.beginPath(); g.moveTo(x, 48); g.lineTo(x + 8, 4); g.moveTo(x, 48); g.lineTo(x + 8, 92); g.stroke(); }
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 9; i++) {
      const x = 30 + rng() * 200, up = rng() > 0.5 ? -1 : 1;
      g.beginPath(); g.moveTo(x, 48 + up * 50); g.lineTo(x + 5, 48 + up * 50); g.lineTo(x - 2, 48 + up * (10 + rng() * 14)); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    g.strokeStyle = '#b7c66a'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(0, 48); g.lineTo(252, 48); g.stroke();
    TEX.banana = tex(c, { repeat: false });
  }

  // --- grass tuft (greyscale, tinted in shader) ---
  {
    const [c, g] = mk(128, 128);
    for (let i = 0; i < 26; i++) {
      const bx = 64 + (rng() - 0.5) * 70, tip = bx + (rng() - 0.5) * 70, hgt = 50 + rng() * 74;
      const v = 150 + rng() * 105;
      g.strokeStyle = `rgb(${v},${v},${v})`;
      g.lineWidth = 3 + rng() * 3.5;
      g.lineCap = 'round';
      g.beginPath(); g.moveTo(bx, 128); g.quadraticCurveTo(bx, 128 - hgt * 0.6, tip, 128 - hgt); g.stroke();
    }
    TEX.grass = tex(c, { repeat: false });
  }

  // --- palm bark (ringed) ---
  {
    const [c, g] = mk(128, 256);
    g.fillStyle = '#857562'; g.fillRect(0, 0, 128, 256);
    speckle(g, 128, 256, rng, 500, ['#6b5d4d', '#9a8a74', '#5a4d40'], 1, 5, 0.4);
    for (let y = 0; y < 256; y += 16) {
      g.strokeStyle = 'rgba(40,30,22,0.55)'; g.lineWidth = 2 + rng() * 2;
      g.beginPath(); g.moveTo(0, y + 4); g.bezierCurveTo(40, y + 1, 90, y + 8, 128, y + 4); g.stroke();
    }
    TEX.palmBark = tex(c);
  }
  // --- tree bark ---
  {
    const [c, g] = mk(128, 256);
    g.fillStyle = '#4c3b2c'; g.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 160; i++) {
      g.strokeStyle = `rgba(${20 + rng() * 60},${15 + rng() * 40},${10 + rng() * 25},0.5)`;
      g.lineWidth = 1 + rng() * 3;
      const x = rng() * 128;
      g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 6, 80, x - 6, 170, x, 256); g.stroke();
    }
    speckle(g, 128, 256, rng, 120, ['#5d6a3a', '#6a5a44'], 2, 7, 0.25);
    TEX.bark = tex(c);
  }

  // --- terracotta roof tiles (weathered by a hundred monsoons) ---
  {
    const [c, g] = mk(256, 256);
    g.fillStyle = '#3d1f14'; g.fillRect(0, 0, 256, 256);
    const rows = 8, cols = 8, tw = 256 / cols, th = 256 / rows;
    for (let r = 0; r < rows; r++) for (let q = -1; q < cols; q++) {
      const x = q * tw + (r % 2) * tw * 0.5, y = r * th;
      const grd = g.createLinearGradient(0, y, 0, y + th);
      const l = 30 + rng() * 14, hue = 12 + rng() * 10;
      grd.addColorStop(0, `hsl(${hue},48%,${l * 0.45}%)`);
      grd.addColorStop(0.7, `hsl(${hue},52%,${l}%)`);
      grd.addColorStop(1, `hsl(${hue},45%,${l * 1.15}%)`);
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(x + 1, y); g.lineTo(x + tw - 1, y); g.lineTo(x + tw - 1, y + th * 0.72);
      g.quadraticCurveTo(x + tw / 2, y + th * 1.12, x + 1, y + th * 0.72);
      g.fill();
    }
    speckle(g, 256, 256, rng, 260, ['#1c1712', '#2a2a1c', '#3a3d24'], 4, 22, 0.3);
    TEX.roof = tex(c);
  }
  // --- palm thatch ---
  {
    const [c, g] = mk(256, 256);
    g.fillStyle = '#7d6a40'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) {
      const x = rng() * 256, y = rng() * 256, l = 14 + rng() * 30;
      g.strokeStyle = `hsl(${38 + rng() * 12},${30 + rng() * 25}%,${22 + rng() * 34}%)`;
      g.lineWidth = 1 + rng();
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rng() - 0.5) * 5, y + l); g.stroke();
    }
    for (let y = 0; y < 256; y += 64) {
      const grd = g.createLinearGradient(0, y, 0, y + 14);
      grd.addColorStop(0, 'rgba(20,14,6,0.55)'); grd.addColorStop(1, 'rgba(20,14,6,0)');
      g.fillStyle = grd; g.fillRect(0, y, 256, 14);
    }
    TEX.thatch = tex(c);
  }
  // --- lime-washed wall ---
  {
    const [c, g] = mk(256, 256);
    g.fillStyle = '#ddd4c0'; g.fillRect(0, 0, 256, 256);
    speckle(g, 256, 256, rng, 90, ['#c2b89f', '#ece6d6', '#b3a88c', '#a59c84'], 8, 46, 0.22);
    speckle(g, 256, 256, rng, 500, ['#8d846e', '#f4efe2'], 0.5, 2, 0.3);
    TEX.wall = tex(c);
  }
  // --- laterite block wall ---
  {
    const [c, g] = mk(256, 256);
    g.fillStyle = '#4a2a1e'; g.fillRect(0, 0, 256, 256);
    for (let r = 0; r < 8; r++) for (let q = -1; q < 4; q++) {
      const x = q * 64 + (r % 2) * 32, y = r * 32;
      g.fillStyle = `hsl(${10 + rng() * 10},${40 + rng() * 14}%,${27 + rng() * 11}%)`;
      g.fillRect(x + 1.5, y + 1.5, 61, 29);
    }
    speckle(g, 256, 256, rng, 900, ['#3a1f16', '#a5674a', '#5a3324'], 0.8, 3, 0.4);
    speckle(g, 256, 256, rng, 30, ['#2e2a1c', '#4b4a2a'], 8, 30, 0.2);
    TEX.laterite = tex(c);
  }
  // --- dark teak / wood ---
  {
    const [c, g] = mk(128, 128);
    g.fillStyle = '#4f3524'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 90; i++) {
      g.strokeStyle = `rgba(${10 + rng() * 80},${5 + rng() * 45},${rng() * 20},0.45)`;
      g.lineWidth = 0.6 + rng() * 2;
      const y = rng() * 128;
      g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(40, y + 3, 90, y - 3, 128, y); g.stroke();
    }
    TEX.wood = tex(c);
  }
  // --- weathered planks (jetties, carts) ---
  {
    const [c, g] = mk(256, 256);
    for (let i = 0; i < 8; i++) {
      g.fillStyle = `hsl(${28 + rng() * 10},${18 + rng() * 14}%,${30 + rng() * 14}%)`;
      g.fillRect(0, i * 32, 256, 31);
      for (let k = 0; k < 14; k++) {
        g.strokeStyle = 'rgba(30,20,10,0.3)'; g.lineWidth = 0.7 + rng();
        const y = i * 32 + rng() * 30;
        g.beginPath(); g.moveTo(0, y); g.lineTo(256, y + (rng() - 0.5) * 4); g.stroke();
      }
      g.fillStyle = '#1a120b'; g.fillRect(0, i * 32 + 31, 256, 1.5);
    }
    TEX.plank = tex(c);
  }
  // --- granite ---
  {
    const [c, g] = mk(256, 256);
    g.fillStyle = '#75716a'; g.fillRect(0, 0, 256, 256);
    speckle(g, 256, 256, rng, 1600, ['#55524c', '#8f8a80', '#3f3d39', '#a09a8e'], 0.6, 3, 0.4);
    speckle(g, 256, 256, rng, 40, ['#4a5238', '#5c5a50'], 10, 40, 0.18);
    g.strokeStyle = 'rgba(25,25,22,0.6)'; g.lineWidth = 2;
    for (let y = 0; y <= 256; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
    for (let r = 0; r < 4; r++) for (let x = (r % 2) * 64; x <= 256; x += 128) { g.beginPath(); g.moveTo(x, r * 64); g.lineTo(x, r * 64 + 64); g.stroke(); }
    TEX.stone = tex(c);
  }
  // --- corrugated iron (tea factory) ---
  {
    const [c, g] = mk(128, 128);
    for (let x = 0; x < 128; x += 8) {
      const grd = g.createLinearGradient(x, 0, x + 8, 0);
      grd.addColorStop(0, '#6f7477'); grd.addColorStop(0.5, '#a9aeb0'); grd.addColorStop(1, '#5d6265');
      g.fillStyle = grd; g.fillRect(x, 0, 8, 128);
    }
    speckle(g, 128, 128, rng, 70, ['#7a4a2a', '#5a3a22', '#8a5a34'], 3, 16, 0.3);
    TEX.tin = tex(c);
  }
  // --- fishing net ---
  {
    const [c, g] = mk(64, 64);
    g.strokeStyle = 'rgba(215,205,170,0.9)'; g.lineWidth = 2.2;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(64, 64); g.moveTo(64, 0); g.lineTo(0, 64); g.stroke();
    TEX.net = tex(c);
  }
  // --- soft glow sprite ---
  {
    const [c, g] = mk(64, 64);
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,220,150,0.55)');
    grd.addColorStop(1, 'rgba(255,160,60,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    TEX.glow = tex(c, { repeat: false });
  }
  // --- woven cloth / sack ---
  {
    const [c, g] = mk(64, 64);
    g.fillStyle = '#9a8660'; g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 64; i += 4) {
      g.fillStyle = 'rgba(60,45,20,0.25)'; g.fillRect(i, 0, 2, 64); g.fillRect(0, i, 64, 2);
    }
    TEX.sack = tex(c);
  }
  // ---- ground detail (linear, mid-grey mean): trodden earth and rough turf
  {
    const [c, g] = mk(512, 512);
    g.fillStyle = 'rgb(128,125,119)'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2600; i++) {
      const x = rng() * 512, y = rng() * 512, r = 0.8 + rng() * rng() * 6, v = 120 + rng() * 90;
      g.fillStyle = 'rgba(40,34,26,0.5)'; g.beginPath(); g.ellipse(x + 0.8, y + 1.1, r, r * 0.8, rng() * 3, 0, 7); g.fill();
      g.fillStyle = `rgb(${v},${v * 0.97},${v * 0.92})`; g.beginPath(); g.ellipse(x, y, r, r * 0.8, rng() * 3, 0, 7); g.fill();
    }
    grit(c, rng, 1.5, 0, 26);
    for (let i = 0; i < 40; i++) { g.strokeStyle = 'rgba(60,50,40,0.16)'; g.lineWidth = 2 + rng() * 5; const y = rng() * 512; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(170, y + (rng() - 0.5) * 40, 340, y + (rng() - 0.5) * 40, 512, y); g.stroke(); }
    TEX.gDirt = tex(c, { srgb: false });
  }
  {
    const [c, g] = mk(512, 512);
    g.fillStyle = 'rgb(112,118,104)'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 60; i++) { const x = rng() * 512, y = rng() * 512, r = 30 + rng() * 80; const grd = g.createRadialGradient(x, y, 0, x, y, r); grd.addColorStop(0, rng() < 0.5 ? 'rgba(70,84,60,0.35)' : 'rgba(170,160,110,0.25)'); grd.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = grd; g.fillRect(x - r, y - r, r * 2, r * 2); }
    g.lineCap = 'round';
    for (let i = 0; i < 9000; i++) {
      const x = rng() * 512, y = rng() * 512, l = 4 + rng() * 12, a = -1.57 + (rng() - 0.5) * 1.6, k = rng();
      g.strokeStyle = k < 0.12 ? `rgba(${185 + rng() * 40},${170 + rng() * 30},${105 + rng() * 30},0.8)` : k < 0.5 ? `rgba(${62 + rng() * 30},${82 + rng() * 30},${52 + rng() * 20},0.85)` : `rgba(${130 + rng() * 50},${150 + rng() * 45},${95 + rng() * 35},0.8)`;
      g.lineWidth = 0.8 + rng() * 1.4;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    grit(c, rng, 0.8, 0, 0);
    TEX.gGrass = tex(c, { srgb: false });
  }
  // ---- painted signboards (2 x 4 atlas)
  {
    const [c, g] = mk(1024, 512);
    const SG = [
      ['MOIDEEN & SONS', 'SPICES · PEPPER · GINGER', '#e8dcb8', '#3a1c10'], ['HARROW & FINCH', 'TRADING COMPANY · MADRAS', '#1e2c26', '#e6d9a8'],
      ['ചായക്കട', 'TEA & TIFFIN', '#7a1f18', '#f2e6c0'], ['കള്ള് ഷാപ്പ്', 'TODDY', '#e8dcb8', '#1a1a1a'],
      ['തയ്യൽക്കട', 'TAILOR & DRAPER', '#2a3c5a', '#f0e4c0'], ['PUTHENTHURA', 'JETTY  ·  FERRY', '#e8dcb8', '#1c2c4c'],
      ['KANNIMALA', 'TEA ESTATE · H. & F. Co.', '#243a2a', '#e8dca8'], ['CUTCHERRY', 'HUZUR · TRAVANCORE', '#e8dcb8', '#3a1c10'],
    ];
    SG.forEach(([a, b, bg, fg], i) => {
      const x = (i % 2) * 512, y = Math.floor(i / 2) * 128;
      g.fillStyle = bg; g.fillRect(x, y, 512, 128);
      g.strokeStyle = fg; g.lineWidth = 5; g.strokeRect(x + 9, y + 9, 494, 110); g.lineWidth = 1.5; g.strokeRect(x + 17, y + 17, 478, 94);
      g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `bold ${/[A-Z]/.test(a) ? 52 : 56}px Georgia, 'Noto Serif Malayalam', 'Nirmala UI', serif`; g.fillText(a, x + 256, y + 52, 450);
      g.font = 'bold 21px Georgia, serif'; g.fillText(b, x + 256, y + 96, 440);
    });
    grit(c, rng, 1.1, 30, 12);
    TEX.signs = tex(c, { repeat: false });
  }
  // weather every built surface
  for (const [k, a, st, cr] of [['wall', 1.2, 26, 10], ['laterite', 1.1, 10, 4], ['roof', 1.0, 12, 0], ['thatch', 0.8, 0, 0], ['wood', 0.9, 0, 5], ['plank', 1.0, 6, 6], ['stone', 1.0, 10, 8], ['bark', 0.8, 0, 0], ['palmBark', 0.8, 0, 0], ['tin', 1.0, 16, 0], ['sack', 0.8, 0, 0]]) grit(TEX[k].image, rng, a, st, cr);
  return TEX;
}
