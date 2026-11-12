// People. Each character is ONE skinned mesh lofted from anatomical
// cross-sections and wrapped in a hand-painted (procedural) texture atlas:
// face, hair, bare skin or shirt, mundu / trousers. Garments are part of the
// body surface — there is no skin underneath to poke through — and the mundu
// is weighted to both thighs so it swings with the stride.
import { TEX } from './textures.js';
import * as THREE from 'three';
import { SGB } from './geo.js';
import { damp, clamp, lerp, makeRng } from './util.js';

// ---- atlas layout (512 x 512)
const R_HEAD = [0, 0, 256, 192], R_TORSO = [0, 192, 256, 448], R_ARM = [256, 0, 384, 256], R_LEG = [384, 0, 512, 256];
const R_SKIRT = [256, 256, 512, 448], R_HAND = [2, 450, 62, 510], R_FOOT = [66, 450, 126, 510], R_CLOTH = [130, 450, 190, 510];

// ---- bones
const B = { hips: 0, spine: 1, chest: 2, head: 3, armL: 4, foreL: 5, handL: 6, armR: 7, foreR: 8, handR: 9, thighL: 10, shinL: 11, footL: 12, thighR: 13, shinR: 14, footR: 15 };

const hex = (c) => '#' + c.toString(16).padStart(6, '0');
function shade(c, k) {
  const r = clamp(((c >> 16) & 255) * k, 0, 255) | 0, g = clamp(((c >> 8) & 255) * k, 0, 255) | 0, b = clamp((c & 255) * k, 0, 255) | 0;
  return `rgb(${r},${g},${b})`;
}
function shadeN(c, k) { return (Math.min(255, ((c >> 16) & 255) * k) << 16) | (Math.min(255, ((c >> 8) & 255) * k) << 8) | Math.min(255, (c & 255) * k); }
function rgba(c, a) { return `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`; }

// =====================================================================
//  TEXTURE PAINTING
// =====================================================================
function paintSkin(g, R, skin, rng) {
  const [x0, y0, x1, y1] = R;
  g.fillStyle = hex(skin); g.fillRect(x0, y0, x1 - x0, y1 - y0);
  for (let i = 0; i < (x1 - x0) * (y1 - y0) / 90; i++) {
    g.fillStyle = rng() < 0.5 ? 'rgba(0,0,0,0.035)' : 'rgba(255,220,180,0.035)';
    g.beginPath(); g.arc(x0 + rng() * (x1 - x0), y0 + rng() * (y1 - y0), 1 + rng() * 5, 0, 7); g.fill();
  }
}
function folds(g, R, rng, n, alpha = 0.12, vertical = true) {
  const [x0, y0, x1, y1] = R;
  g.save(); g.beginPath(); g.rect(x0, y0, x1 - x0, y1 - y0); g.clip();
  for (let i = 0; i < n; i++) {
    const dark = rng() < 0.6;
    g.strokeStyle = dark ? `rgba(0,0,0,${alpha * (0.5 + rng())})` : `rgba(255,255,255,${alpha * 0.7 * rng()})`;
    g.lineWidth = 1.5 + rng() * 5;
    g.beginPath();
    if (vertical) { const x = x0 + rng() * (x1 - x0), w = (rng() - 0.5) * 14; g.moveTo(x, y0 + rng() * 20); g.bezierCurveTo(x + w, y0 + (y1 - y0) * 0.35, x - w, y0 + (y1 - y0) * 0.7, x + w * 0.5, y1); }
    else { const y = y0 + rng() * (y1 - y0), w = 20 + rng() * 60, x = x0 + rng() * (x1 - x0); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y + (rng() - 0.5) * 10, x + w, y + (rng() - 0.5) * 6); }
    g.stroke();
  }
  g.restore();
}

// facial expressions: brow offsets (inner / middle / outer), eye openness,
// mouth-corner drop (mc) and how far the mouth opens (mo)
export const EXPR = {
  neutral: { bi: 0, bm: 0, bo: 0, eye: 1, mc: 0, mo: 0 },
  determined: { bi: 2.8, bm: 1.2, bo: -0.6, eye: 0.8, mc: 0.9, mo: 0, furrow: 1 },
  laughing: { bi: -2.2, bm: -3.2, bo: -1.4, eye: 0.3, smile: 1, mc: -4.6, mo: 6.5, teeth: 1 },
  worried: { bi: -4.4, bm: -1.6, bo: 1.8, eye: 1.2, mc: 1.8, mo: 1.4, furrow: 1 },
  angry: { bi: 5.2, bm: 1.8, bo: -2.8, eye: 0.72, mc: 3.4, mo: 0, furrow: 2, snarl: 1 },
  grieving: { bi: -5.4, bm: -1, bo: 3.4, eye: 0.48, mc: 3.8, mo: 2.4, furrow: 1, tear: 1 },
};
function paintHead(g, o, rng) {
  const [x0, y0] = R_HEAD, cx = x0 + 128;
  const e = EXPR[o.expr] || EXPR.neutral;
  const skin = o.skin, hairC = o.grey ? 0xb4b0a6 : (o.hair ?? 0x15110e);
  paintSkin(g, R_HEAD, skin, rng);
  // soft modelling: cheeks, temples, jaw and neck in shadow
  let grd = g.createLinearGradient(cx - 70, 0, cx + 70, 0);
  grd.addColorStop(0, 'rgba(0,0,0,0.30)'); grd.addColorStop(0.28, 'rgba(0,0,0,0)'); grd.addColorStop(0.72, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,0.30)');
  g.fillStyle = grd; g.fillRect(cx - 70, y0 + 40, 140, 152);
  grd = g.createLinearGradient(0, y0 + 138, 0, y0 + 192);
  grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(0.35, 'rgba(0,0,0,0.34)'); grd.addColorStop(1, 'rgba(0,0,0,0.16)');
  g.fillStyle = grd; g.fillRect(x0, y0 + 138, 256, 54);
  g.fillStyle = 'rgba(255,225,190,0.10)'; g.beginPath(); g.ellipse(cx, y0 + 46, 30, 12, 0, 0, 7); g.fill();      // forehead light
  g.fillStyle = 'rgba(255,225,190,0.08)';
  g.beginPath(); g.ellipse(cx - 24, y0 + 92, 11, 8, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(cx + 24, y0 + 92, 11, 8, 0, 0, 7); g.fill();
  if (o.age) {         // lines of age
    g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 1;
    for (const yy of [38, 44, 50]) { g.beginPath(); g.moveTo(cx - 24, y0 + yy); g.quadraticCurveTo(cx, y0 + yy - 2, cx + 24, y0 + yy); g.stroke(); }
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * 9, y0 + 98); g.quadraticCurveTo(cx + s * 16, y0 + 112, cx + s * 14, y0 + 128); g.stroke(); }
  }
  // ears
  for (const s of [-1, 1]) {
    g.fillStyle = shade(skin, 0.86); g.beginPath(); g.ellipse(cx + s * 64, y0 + 82, 7, 15, 0, 0, 7); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1.3; g.beginPath(); g.ellipse(cx + s * 64, y0 + 82, 4, 10, 0, 0, 7); g.stroke();
  }
  // ---- hair
  const hl = o.receding ? 12 : 26;
  const hairY = (dx) => {
    if (o.bald) return dx < 52 ? -2 : dx < 74 ? 60 : 124;
    if (dx < 40) return hl + (dx / 40) * (dx / 40) * 9;
    if (dx < 50) return hl + 9 + (dx - 40) / 10 * (o.female ? 20 : 26);
    if (dx < 58) return o.female ? 70 : (o.sideburn ? 104 : 84);
    if (dx < 74) return 64;
    return o.female ? 150 : 126;
  };
  g.fillStyle = hex(hairC);
  g.beginPath(); g.moveTo(x0, y0);
  for (let x = 0; x <= 256; x += 2) g.lineTo(x0 + x, y0 + hairY(Math.abs(x - 128)));
  g.lineTo(x0 + 256, y0); g.closePath(); g.fill();
  g.save(); g.clip();
  for (let i = 0; i < 260; i++) {
    g.strokeStyle = rng() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.22)';
    g.lineWidth = 0.8 + rng() * 1.2;
    const x = x0 + rng() * 256, y = y0 + rng() * 150, dx = x - cx;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + dx * 0.06 + (rng() - 0.5) * 4, y + 10 + rng() * 16); g.stroke();
  }
  if (o.female) { g.strokeStyle = shade(skin, 0.8); g.lineWidth = 1.4; g.beginPath(); g.moveTo(cx, y0); g.lineTo(cx, y0 + hl + 2); g.stroke(); }
  g.restore();
  // ---- brows
  const browC = o.grey ? 0x8d8a82 : (o.hair ?? 0x15110e);
  g.strokeStyle = hex(browC); g.lineCap = 'round'; g.lineWidth = o.female ? 2.4 : 3.6;
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * 6.5, y0 + 61.5 + (o.stern ? 2 : 0) + e.bi); g.quadraticCurveTo(cx + s * 15, y0 + 56.5 + e.bm, cx + s * 24, y0 + 60.5 + e.bo); g.stroke(); }
  if (e.furrow) { g.strokeStyle = 'rgba(0,0,0,0.34)'; g.lineWidth = 1.2; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * 2.2, y0 + 55); g.lineTo(cx + s * (e.furrow > 1 ? 3.6 : 1.6), y0 + 64); g.stroke(); } }
  // ---- eyes
  for (const s of [-1, 1]) {
    const ex = cx + s * 15, ey = y0 + 72;
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(ex, ey + 1, 9.5, 6.5, 0, 0, 7); g.fill();          // socket
    if (e.smile) {         // eyes creased shut with laughter
      g.strokeStyle = '#120b08'; g.lineWidth = 2.3; g.beginPath(); g.moveTo(ex - 7, ey + 1.6); g.quadraticCurveTo(ex, ey - 3.8, ex + 7, ey + 1.6); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1; for (const k of [-1, 0, 1]) { g.beginPath(); g.moveTo(ex + s * 8.5, ey + k * 1.6); g.lineTo(ex + s * 12.5, ey + k * 3.4 - 0.6); g.stroke(); }
      continue;
    }
    const ry = 3.5 * e.eye;
    g.fillStyle = '#e9e3d8'; g.beginPath(); g.ellipse(ex, ey, 6.8, ry, 0, 0, 7); g.fill();
    g.save(); g.beginPath(); g.ellipse(ex, ey, 6.8, ry, 0, 0, 7); g.clip();
    g.fillStyle = hex(o.eye ?? 0x2b1a0f); g.beginPath(); g.arc(ex + s * 0.4, ey, 3.1, 0, 7); g.fill();
    g.fillStyle = '#060404'; g.beginPath(); g.arc(ex + s * 0.4, ey, 1.5, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(ex - 1.4, ey - 1.8, 1.3, 1.3);
    g.restore();
    g.strokeStyle = '#120b08'; g.lineWidth = e.eye < 0.9 ? 2.2 : 1.7; g.beginPath(); g.ellipse(ex, ey, 7, ry + 0.4, 0, Math.PI * 1.02, Math.PI * 1.98); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1; g.beginPath(); g.ellipse(ex, ey - 1.5, 7.6, 5, 0, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    if (o.female) { g.strokeStyle = '#0c0808'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(ex, ey, 7, ry + 0.1, 0, 0.1, Math.PI * 0.95); g.stroke(); }
    if (e.tear) { g.strokeStyle = 'rgba(214,232,255,0.6)'; g.lineWidth = 1.7; g.beginPath(); g.moveTo(ex - s * 3, ey + 4); g.quadraticCurveTo(ex - s * 4.5, ey + 16, ex - s * 2.5, ey + 27); g.stroke(); }
  }
  // ---- nose
  g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(cx - 3.5, y0 + 66); g.quadraticCurveTo(cx - 3, y0 + 84, cx - 7.5, y0 + 93); g.stroke();
  g.beginPath(); g.moveTo(cx + 3.5, y0 + 66); g.quadraticCurveTo(cx + 3, y0 + 84, cx + 7.5, y0 + 93); g.stroke();
  g.fillStyle = 'rgba(255,230,200,0.16)'; g.beginPath(); g.ellipse(cx, y0 + 84, 2.6, 9, 0, 0, 7); g.fill();
  g.fillStyle = 'rgba(20,8,4,0.6)';
  g.beginPath(); g.ellipse(cx - 4.6, y0 + 96, 2.6, 1.6, 0.3, 0, 7); g.fill(); g.beginPath(); g.ellipse(cx + 4.6, y0 + 96, 2.6, 1.6, -0.3, 0, 7); g.fill();
  g.fillStyle = 'rgba(0,0,0,0.16)'; g.beginPath(); g.ellipse(cx, y0 + 101, 9, 3, 0, 0, 7); g.fill();
  // ---- mouth
  const lip = o.female ? 0x8a3a34 : 0x5a2c22;
  const mo = Math.max(e.mo, o.mouthOpen ? 4.2 : 0), my = y0 + 122, cy = my + (o.stern ? -0.6 : 0.4) + e.mc, mw = e.smile ? 13 : 11.5;
  g.fillStyle = rgba(lip, 0.75); g.beginPath(); g.ellipse(cx, y0 + 121.5, 10.5, 2.4, 0, Math.PI, Math.PI * 2); g.fill();
  if (mo > 0.5) {
    g.fillStyle = '#1a0806'; g.beginPath(); g.moveTo(cx - mw, cy); g.quadraticCurveTo(cx, my + 0.5, cx + mw, cy); g.quadraticCurveTo(cx, my + 1.5 + mo * 2, cx - mw, cy); g.fill();
    if (e.teeth || mo > 3) { const ty = cy + (my - cy) * 0.4 + 0.5; g.fillStyle = 'rgba(236,230,214,0.92)'; g.beginPath(); g.moveTo(cx - mw * 0.72, ty); g.quadraticCurveTo(cx, my + 0.7, cx + mw * 0.72, ty); g.quadraticCurveTo(cx, my + 1.4 + mo * 0.55, cx - mw * 0.72, ty); g.fill(); }
    g.fillStyle = rgba(lip, 0.6); g.beginPath(); g.ellipse(cx, my + 1.2 + mo, 8.5, 2.6, 0, 0, Math.PI); g.fill();
  } else {
    g.fillStyle = rgba(lip, 0.6); g.beginPath(); g.ellipse(cx, y0 + 123, 9.5, 3.6, 0, 0, Math.PI); g.fill();
    g.strokeStyle = '#1c0d09'; g.lineWidth = e.snarl ? 1.9 : 1.3; g.beginPath(); g.moveTo(cx - mw, cy); g.quadraticCurveTo(cx, y0 + 123.4 - (e.mc > 2 ? 1.2 : 0), cx + mw, cy); g.stroke();
  }
  if (e.smile || e.snarl) { g.strokeStyle = 'rgba(0,0,0,0.24)'; g.lineWidth = 1.3; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * 10, y0 + 100); g.quadraticCurveTo(cx + s * 17, y0 + 110, cx + s * 15.5, y0 + 122); g.stroke(); } }
  g.fillStyle = 'rgba(0,0,0,0.14)'; g.beginPath(); g.ellipse(cx, y0 + 131, 9, 2.6, 0, 0, 7); g.fill();
  // ---- facial hair
  const fh = o.grey ? 0xbdb9ae : (o.hair ?? 0x15110e);
  if (o.beard) {
    g.fillStyle = rgba(fh, o.beard === 'stubble' ? 0.38 : 0.96);
    g.beginPath(); g.moveTo(cx - 58, y0 + 84);
    g.bezierCurveTo(cx - 56, y0 + 130, cx - 34, y0 + 162, cx, y0 + 166);
    g.bezierCurveTo(cx + 34, y0 + 162, cx + 56, y0 + 130, cx + 58, y0 + 84);
    g.bezierCurveTo(cx + 40, y0 + 108, cx + 22, y0 + 112, cx + 14, y0 + 114);
    g.lineTo(cx + 13, y0 + 128); g.quadraticCurveTo(cx, y0 + 134, cx - 13, y0 + 128); g.lineTo(cx - 14, y0 + 114);
    g.bezierCurveTo(cx - 22, y0 + 112, cx - 40, y0 + 108, cx - 58, y0 + 84); g.fill();
  }
  if (o.chops) {
    g.fillStyle = hex(fh);
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * 60, y0 + 80); g.bezierCurveTo(cx + s * 58, y0 + 120, cx + s * 40, y0 + 138, cx + s * 22, y0 + 128); g.bezierCurveTo(cx + s * 34, y0 + 118, cx + s * 44, y0 + 100, cx + s * 48, y0 + 80); g.fill(); }
  }
  if (o.moustache) {
    g.fillStyle = hex(fh);
    const big = o.moustache === 'big', w = big ? 19 : 14, t = big ? 7.5 : 5;
    g.beginPath(); g.moveTo(cx, y0 + 111);
    g.bezierCurveTo(cx + 8, y0 + 109, cx + w - 2, y0 + 113, cx + w + (big ? 4 : 0), y0 + 121 + (big ? -5 : 0));
    g.bezierCurveTo(cx + w - 6, y0 + 121, cx + 6, y0 + 112 + t, cx, y0 + 111 + t - 1);
    g.bezierCurveTo(cx - 6, y0 + 112 + t, cx - w + 6, y0 + 121, cx - w - (big ? 4 : 0), y0 + 121 + (big ? -5 : 0));
    g.bezierCurveTo(cx - w + 2, y0 + 113, cx - 8, y0 + 109, cx, y0 + 111); g.fill();
  }
  // ---- marks
  if (o.mark === 'chandanam') { g.fillStyle = 'rgba(232,206,140,0.85)'; g.fillRect(cx - 17, y0 + 42, 34, 3.2); g.fillRect(cx - 14, y0 + 47.5, 28, 2.4); g.fillStyle = '#9c1c16'; g.beginPath(); g.arc(cx, y0 + 53, 2.2, 0, 7); g.fill(); }
  if (o.mark === 'pottu') { g.fillStyle = '#a0141a'; g.beginPath(); g.arc(cx, y0 + 52, 3, 0, 7); g.fill(); }
  if (o.mark === 'bhasmam') { g.fillStyle = 'rgba(225,222,212,0.8)'; for (const yy of [40, 45, 50]) g.fillRect(cx - 18, y0 + yy, 36, 2.2); }
}

function paintTorso(g, o, rng) {
  const [x0, y0, x1, y1] = R_TORSO, cx = x0 + 128, H = y1 - y0;
  const Y = (h) => y0 + (1.49 - h) / (1.49 - 0.80) * H;      // body height (m) -> pixel row
  if (o.shirt == null) {
    paintSkin(g, R_TORSO, o.skin, rng);
    const d = (a) => `rgba(0,0,0,${a})`, l = (a) => `rgba(255,225,190,${a})`;
    // flanks & back
    let grd = g.createLinearGradient(x0, 0, x1, 0);
    grd.addColorStop(0, d(0.18)); grd.addColorStop(0.2, d(0.3)); grd.addColorStop(0.36, d(0)); grd.addColorStop(0.64, d(0)); grd.addColorStop(0.8, d(0.3)); grd.addColorStop(1, d(0.18));
    g.fillStyle = grd; g.fillRect(x0, y0, 256, H);
    if (!o.female) {
      const m = o.belly ? 0.5 : o.muscle ? 1.5 : 1;
      g.fillStyle = l(0.10 * m); g.beginPath(); g.ellipse(cx - 24, Y(1.335), 21, 15, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(cx + 24, Y(1.335), 21, 15, 0, 0, 7); g.fill();
      g.strokeStyle = d(0.3 * m); g.lineWidth = 2.6;
      g.beginPath(); g.arc(cx - 23, Y(1.345), 23, 0.25, 2.6); g.stroke(); g.beginPath(); g.arc(cx + 23, Y(1.345), 23, 0.54, 2.9); g.stroke();
      g.lineWidth = 1.8; g.beginPath(); g.moveTo(cx, Y(1.40)); g.lineTo(cx, Y(1.08)); g.stroke();
      g.fillStyle = 'rgba(40,16,10,0.55)'; g.beginPath(); g.arc(cx - 25, Y(1.305), 3, 0, 7); g.fill(); g.beginPath(); g.arc(cx + 25, Y(1.305), 3, 0, 7); g.fill();
      if (!o.belly) { g.strokeStyle = d(0.14); g.lineWidth = 1.6; for (const hh of [1.22, 1.15, 1.08]) { g.beginPath(); g.moveTo(cx - 17, Y(hh)); g.quadraticCurveTo(cx, Y(hh) + 3, cx + 17, Y(hh)); g.stroke(); } }
      else { g.fillStyle = l(0.09); g.beginPath(); g.ellipse(cx, Y(1.08), 34, 30, 0, 0, 7); g.fill(); }
    }
    g.fillStyle = 'rgba(20,8,4,0.6)'; g.beginPath(); g.ellipse(cx, Y(1.035), 2.6, 3.4, 0, 0, 7); g.fill();
    g.strokeStyle = d(0.26); g.lineWidth = 2;
    g.beginPath(); g.moveTo(cx - 6, Y(1.445)); g.quadraticCurveTo(cx - 30, Y(1.435) + 2, cx - 54, Y(1.455)); g.stroke();
    g.beginPath(); g.moveTo(cx + 6, Y(1.445)); g.quadraticCurveTo(cx + 30, Y(1.435) + 2, cx + 54, Y(1.455)); g.stroke();
    // spine & shoulder blades (back wraps across the seam)
    g.strokeStyle = d(0.22); g.lineWidth = 2.4;
    for (const bx of [x0 + 1, x1 - 1]) { g.beginPath(); g.moveTo(bx, Y(1.44)); g.lineTo(bx, Y(0.95)); g.stroke(); }
    g.lineWidth = 2; g.beginPath(); g.arc(x0 + 30, Y(1.33), 18, 1.2, 3.6); g.stroke(); g.beginPath(); g.arc(x1 - 30, Y(1.33), 18, -0.45, 1.95); g.stroke();
    if (o.thread) { g.strokeStyle = 'rgba(235,228,205,0.9)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(cx + 44, Y(1.45)); g.lineTo(cx - 40, Y(1.0)); g.stroke(); }
    if (o.muscle) { g.strokeStyle = d(0.16); g.lineWidth = 1.5; for (const s of [-1, 1]) for (const hh of [1.24, 1.19, 1.14]) { g.beginPath(); g.moveTo(cx + s * 34, Y(hh)); g.lineTo(cx + s * 46, Y(hh - 0.035)); g.stroke(); } }
    if (o.pendant) {         // a charm on a black cord
      g.strokeStyle = 'rgba(18,12,9,0.92)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(cx - 21, Y(1.487)); g.quadraticCurveTo(cx - 9, Y(1.39), cx, Y(1.365)); g.quadraticCurveTo(cx + 9, Y(1.39), cx + 21, Y(1.487)); g.stroke();
      g.fillStyle = '#c9a13a'; g.beginPath(); g.moveTo(cx, Y(1.372)); g.lineTo(cx + 4, Y(1.345)); g.lineTo(cx, Y(1.318)); g.lineTo(cx - 4, Y(1.345)); g.fill();
      g.fillStyle = 'rgba(255,240,190,0.7)'; g.fillRect(cx - 1, Y(1.352), 1.6, 3);
    }
    if (o.bag != null) { g.strokeStyle = hex(shadeN(o.bag, 0.8)); g.lineWidth = 7; g.beginPath(); g.moveTo(cx - 46, Y(1.47)); g.lineTo(cx + 50, Y(0.98)); g.stroke(); g.beginPath(); g.moveTo(x0 + 18, Y(1.47)); g.lineTo(x0, Y(1.38)); g.stroke(); g.beginPath(); g.moveTo(x1, Y(1.38)); g.lineTo(x1 - 62, Y(0.98)); g.stroke(); }
    if (o.female) { g.fillStyle = hex(o.blouse ?? 0x7a2f3a); g.fillRect(x0, Y(1.47), 256, Y(1.17) - Y(1.47)); }
    return;
  }
  // ---------- clothed
  const c = o.shirt;
  g.fillStyle = hex(c); g.fillRect(x0, y0, 256, H);
  let grd = g.createLinearGradient(x0, 0, x1, 0);
  grd.addColorStop(0, 'rgba(0,0,0,0.14)'); grd.addColorStop(0.2, 'rgba(0,0,0,0.26)'); grd.addColorStop(0.38, 'rgba(0,0,0,0)'); grd.addColorStop(0.62, 'rgba(0,0,0,0)'); grd.addColorStop(0.8, 'rgba(0,0,0,0.26)'); grd.addColorStop(1, 'rgba(0,0,0,0.14)');
  g.fillStyle = grd; g.fillRect(x0, y0, 256, H);
  folds(g, R_TORSO, rng, 38, 0.13, false); folds(g, R_TORSO, rng, 14, 0.1, true);
  const line = 'rgba(0,0,0,0.38)';
  if (o.style === 'jacket' || o.style === 'frock') {
    const dark = o.style === 'frock';
    // shirt-front & tie in the V
    g.fillStyle = '#e9e4d6'; g.beginPath(); g.moveTo(cx - 17, Y(1.49)); g.lineTo(cx, Y(1.19)); g.lineTo(cx + 17, Y(1.49)); g.fill();
    g.fillStyle = hex(o.tie ?? 0x3a2a48); g.beginPath(); g.moveTo(cx - 4, Y(1.47)); g.lineTo(cx + 4, Y(1.47)); g.lineTo(cx + 5.5, Y(1.25)); g.lineTo(cx, Y(1.21)); g.lineTo(cx - 5.5, Y(1.25)); g.fill();
    if (o.waistcoat != null) { g.fillStyle = hex(o.waistcoat); g.beginPath(); g.moveTo(cx - 13, Y(1.38)); g.lineTo(cx, Y(1.24)); g.lineTo(cx + 13, Y(1.38)); g.lineTo(cx + 15, Y(1.16)); g.lineTo(cx - 15, Y(1.16)); g.fill(); }
    // lapels
    for (const s of [-1, 1]) {
      g.fillStyle = shade(c, dark ? 1.25 : 0.9);
      g.beginPath(); g.moveTo(cx + s * 17, Y(1.49)); g.lineTo(cx + s * 34, Y(1.43)); g.lineTo(cx + s * 21, Y(1.36)); g.lineTo(cx + s * 2, Y(1.17)); g.lineTo(cx, Y(1.19)); g.fill();
      g.strokeStyle = line; g.lineWidth = 1.3; g.beginPath(); g.moveTo(cx + s * 34, Y(1.43)); g.lineTo(cx + s * 21, Y(1.36)); g.lineTo(cx + s * 2, Y(1.17)); g.stroke();
    }
    g.strokeStyle = line; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx + 2, Y(1.17)); g.lineTo(cx + 3, Y(0.80)); g.stroke();
    g.fillStyle = dark ? '#b9a25a' : '#5a4a3a';
    for (const hh of [1.12, 1.03, 0.94]) { g.beginPath(); g.arc(cx - 3, Y(hh), 2.4, 0, 7); g.fill(); }
    g.strokeStyle = line; g.lineWidth = 1.2; for (const s of [-1, 1]) { g.strokeRect(cx + s * 36 - 11, Y(1.0), 22, 3); }
    g.fillStyle = '#efe9da'; g.fillRect(cx + 26, Y(1.34), 12, 3);
  } else if (o.style === 'uniform') {
    g.strokeStyle = line; g.lineWidth = 1.4; g.beginPath(); g.moveTo(cx, Y(1.47)); g.lineTo(cx, Y(0.80)); g.stroke();
    g.fillStyle = '#c9a94a'; for (const hh of [1.42, 1.33, 1.24, 1.15, 1.06]) { g.beginPath(); g.arc(cx, Y(hh), 2.6, 0, 7); g.fill(); }
    g.fillStyle = shade(c, 0.8); g.fillRect(cx - 12, Y(1.49), 24, 9);
    g.fillStyle = '#3a2416'; g.fillRect(x0, Y(1.035), 256, 11);                      // belt
    g.fillStyle = '#c9a94a'; g.fillRect(cx - 6, Y(1.035) - 1, 12, 13);
    g.strokeStyle = '#3a2416'; g.lineWidth = 8; g.beginPath(); g.moveTo(cx + 52, Y(1.47)); g.lineTo(cx - 44, Y(1.04)); g.stroke();   // cross-strap
    for (const s of [-1, 1]) { g.strokeStyle = line; g.lineWidth = 1.2; g.strokeRect(cx + s * 30 - 10, Y(1.34), 20, 16); }
  } else if (o.style === 'kurta') {
    g.strokeStyle = line; g.lineWidth = 1.3; g.beginPath(); g.moveTo(cx, Y(1.47)); g.lineTo(cx, Y(1.2)); g.stroke();
    g.fillStyle = shade(c, 0.72); for (const hh of [1.42, 1.35, 1.28]) { g.beginPath(); g.arc(cx, Y(hh), 2, 0, 7); g.fill(); }
    g.strokeStyle = shade(c, 0.78); g.lineWidth = 3; g.beginPath(); g.arc(cx, Y(1.49), 15, 0.15, Math.PI - 0.15); g.stroke();
    if (o.bag != null) { g.strokeStyle = hex(shadeN(o.bag, 0.8)); g.lineWidth = 7; g.beginPath(); g.moveTo(cx - 46, Y(1.47)); g.lineTo(cx + 50, Y(0.98)); g.stroke(); g.beginPath(); g.moveTo(x0 + 18, Y(1.47)); g.lineTo(x0, Y(1.38)); g.stroke(); g.beginPath(); g.moveTo(x1, Y(1.38)); g.lineTo(x1 - 62, Y(0.98)); g.stroke(); }
  } else if (o.style === 'chatta') {
    // the Nasrani woman's white chatta: loose, V-necked, worn over the mundu
    g.fillStyle = hex(o.skin); g.beginPath(); g.moveTo(cx - 14, Y(1.49)); g.lineTo(cx, Y(1.36)); g.lineTo(cx + 14, Y(1.49)); g.fill();
    g.strokeStyle = shade(c, 0.72); g.lineWidth = 2.4; g.beginPath(); g.moveTo(cx - 14, Y(1.49)); g.lineTo(cx, Y(1.36)); g.lineTo(cx + 14, Y(1.49)); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 1.2; g.strokeRect(x0 - 2, Y(0.86), 260, 3);
    if (o.rosary) {
      g.fillStyle = '#2a1a12';
      for (let i = 0; i <= 22; i++) { const u = i / 22, a = u * Math.PI; g.beginPath(); g.arc(cx - Math.cos(a) * 19, Y(1.48) + Math.sin(a) * (Y(1.2) - Y(1.48)), 1.5, 0, 7); g.fill(); }
      g.fillStyle = '#c9a13a'; g.fillRect(cx - 1.4, Y(1.2), 2.8, 13); g.fillRect(cx - 4.5, Y(1.2) + 3, 9, 2.6);
    }
  } else if (o.style === 'wrap') {
    // a single dark cloth wound round the body and thrown over the left shoulder
    g.fillStyle = hex(o.skin);
    g.beginPath(); g.moveTo(cx + 10, Y(1.49)); g.lineTo(cx - 64, Y(1.30)); g.lineTo(x0, Y(1.40)); g.lineTo(x0, Y(1.49)); g.fill();
    g.strokeStyle = shade(c, 1.35); g.lineWidth = 3.5; g.beginPath(); g.moveTo(cx + 10, Y(1.49)); g.lineTo(cx - 64, Y(1.30)); g.lineTo(x0, Y(1.40)); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.2)'; g.lineWidth = 2; for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(cx + 10 + i * 9, Y(1.49)); g.lineTo(cx - 64 + i * 14, Y(1.26 - i * 0.03)); g.stroke(); }
  } else if (o.style === 'blouse') {
    // short blouse, bare midriff, neriyathu draped to the left shoulder
    paintSkin(g, [x0, Y(1.16) | 0, x1, y1], o.skin, rng);
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x0, Y(1.16), 256, 4);
    g.strokeStyle = shade(c, 0.7); g.lineWidth = 3; g.beginPath(); g.arc(cx, Y(1.49), 20, 0.1, Math.PI - 0.1); g.stroke();
    g.fillStyle = shade(c, 0.75); g.fillRect(x0, Y(1.17), 256, 3);
    const nc = o.neriyathu ?? 0xefe8d4;
    g.fillStyle = hex(nc);
    g.beginPath(); g.moveTo(cx + 62, Y(1.49)); g.lineTo(cx + 26, Y(1.49)); g.lineTo(cx - 70, Y(0.98)); g.lineTo(cx - 70, Y(0.80)); g.lineTo(cx - 20, Y(0.80)); g.lineTo(cx + 70, Y(1.32)); g.fill();
    g.strokeStyle = '#c9a13a'; g.lineWidth = 4.5; g.beginPath(); g.moveTo(cx + 26, Y(1.49)); g.lineTo(cx - 70, Y(0.98)); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.13)'; g.lineWidth = 2; for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(cx + 26 + i * 8, Y(1.49)); g.lineTo(cx - 70 + i * 12, Y(0.94)); g.stroke(); }
    // the same cloth falls down the back from the left shoulder
    g.fillStyle = hex(nc); g.fillRect(x1 - 62, Y(1.49), 62, H * 0.62);
    g.strokeStyle = '#c9a13a'; g.lineWidth = 3; g.beginPath(); g.moveTo(x1 - 62, Y(1.49)); g.lineTo(x1 - 62, Y(1.49) + H * 0.62); g.stroke();
  } else {
    // plain shirt / juba with placket
    g.strokeStyle = line; g.lineWidth = 1.4; g.beginPath(); g.moveTo(cx, Y(1.46)); g.lineTo(cx, Y(0.80)); g.stroke();
    g.fillStyle = 'rgba(40,30,20,0.6)'; for (let hh = 1.40; hh > 0.86; hh -= 0.095) { g.beginPath(); g.arc(cx + 2.5, Y(hh), 1.7, 0, 7); g.fill(); }
    g.fillStyle = shade(c, 0.86);
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx, Y(1.455)); g.lineTo(cx + s * 16, Y(1.49)); g.lineTo(cx + s * 22, Y(1.435)); g.lineTo(cx + s * 6, Y(1.40)); g.fill(); }
    g.strokeStyle = line; g.lineWidth = 1; g.strokeRect(cx + 20, Y(1.33), 18, 18);
  }
  if (o.dirty) { g.fillStyle = 'rgba(70,45,20,0.16)'; for (let i = 0; i < 26; i++) { g.beginPath(); g.arc(x0 + rng() * 256, y0 + rng() * H, 4 + rng() * 14, 0, 7); g.fill(); } }
  g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x0, y1 - 5, 256, 5);
}

function bakeTorso(g) {
  const [x0, y0, x1, y1] = R_TORSO, H = y1 - y0;
  const Y = (h) => y0 + (1.49 - h) / (1.49 - 0.80) * H;
  g.fillStyle = 'rgba(0,0,0,0.13)';
  for (const x of [x0 + 64, x0 + 192]) { g.beginPath(); g.ellipse(x, Y(1.34), 11, 36, 0, 0, 7); g.fill(); }
  let grd = g.createLinearGradient(0, Y(1.49), 0, Y(1.4));
  grd.addColorStop(0, 'rgba(0,0,0,0.28)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(x0, Y(1.49), 256, Y(1.4) - Y(1.49));
  grd = g.createLinearGradient(0, Y(1.02), 0, Y(0.9));
  grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,0.2)');
  g.fillStyle = grd; g.fillRect(x0, Y(1.02), 256, Y(0.9) - Y(1.02));
}
function paintArm(g, o, rng) {
  const [x0, y0, x1, y1] = R_ARM, H = y1 - y0, Wd = x1 - x0;
  const Y = (h) => y0 + (1.475 - h) / (1.475 - 0.752) * H;
  paintSkin(g, R_ARM, o.skin, rng);
  let grd = g.createLinearGradient(x0, 0, x1, 0);
  grd.addColorStop(0, 'rgba(0,0,0,0.22)'); grd.addColorStop(0.3, 'rgba(0,0,0,0)'); grd.addColorStop(0.7, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,0.22)');
  g.fillStyle = grd; g.fillRect(x0, y0, Wd, H);
  g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x0, Y(1.17), Wd, 7);
  if (o.shirt != null && o.sleeves !== false) {
    const end = o.longSleeves ? 0.93 : (o.style === 'blouse' ? 1.30 : 1.22);
    g.fillStyle = hex(o.shirt); g.fillRect(x0, y0, Wd, Y(end) - y0);
    folds(g, [x0, y0, x1, Y(end) | 0], rng, 12, 0.1, false);
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x0, Y(end) - 3, Wd, 3);
    if (o.cuffs != null) { g.fillStyle = hex(o.cuffs); g.fillRect(x0, Y(end) - 12, Wd, 10); }
  }
  if (o.bangles) { g.fillStyle = '#d2a63c'; g.fillRect(x0, Y(0.935), Wd, 3); g.fillRect(x0, Y(0.955), Wd, 2.5); }
  // hand swatch & knuckles
  paintSkin(g, [0, 448, 64, 512], o.skin, rng);
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(12 + i * 10, 478); g.lineTo(12 + i * 10, 510); g.stroke(); }
}

function paintLeg(g, o, rng) {
  const [x0, y0, x1, y1] = R_LEG, H = y1 - y0, Wd = x1 - x0;
  const Y = (h) => y0 + (0.96 - h) / (0.96 - 0.085) * H;
  if (o.trousers != null) {
    g.fillStyle = hex(o.trousers); g.fillRect(x0, y0, Wd, H);
    folds(g, R_LEG, rng, 9, 0.1, true);
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x0 + Wd / 2, y0); g.lineTo(x0 + Wd / 2, y1); g.stroke();
    g.fillStyle = 'rgba(0,0,0,0.14)'; g.fillRect(x0, Y(0.52), Wd, 9);
    if (o.puttees != null) { g.fillStyle = hex(o.puttees); g.fillRect(x0, Y(0.42), Wd, y1 - Y(0.42)); g.strokeStyle = 'rgba(0,0,0,0.25)'; for (let yy = Y(0.42); yy < y1; yy += 9) { g.beginPath(); g.moveTo(x0, yy); g.lineTo(x1, yy + 5); g.stroke(); } }
    if (o.boots != null) { const bt = o.tallBoots ? 0.5 : 0.30; g.fillStyle = hex(o.boots); g.fillRect(x0, Y(bt), Wd, y1 - Y(bt)); g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(x0 + Wd * 0.4, Y(bt), 8, y1 - Y(bt)); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x0, Y(bt), Wd, 3); }
  } else {
    paintSkin(g, R_LEG, o.skin, rng);
    let grd = g.createLinearGradient(x0, 0, x1, 0);
    grd.addColorStop(0, 'rgba(0,0,0,0.26)'); grd.addColorStop(0.3, 'rgba(0,0,0,0)'); grd.addColorStop(0.7, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,0.26)');
    g.fillStyle = grd; g.fillRect(x0, y0, Wd, H);
    g.fillStyle = 'rgba(0,0,0,0.16)'; g.beginPath(); g.ellipse(x0 + Wd / 2, Y(0.49), 16, 9, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,225,190,0.1)'; g.beginPath(); g.ellipse(x0 + Wd / 2, Y(0.35), 6, 34, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(60,40,20,0.1)'; g.fillRect(x0, Y(0.16), Wd, y1 - Y(0.16));       // dusty ankles
  }
  // foot swatch
  if (o.boots != null) { g.fillStyle = hex(o.boots); g.fillRect(64, 448, 64, 64); g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(64, 448, 64, 10); }
  else { paintSkin(g, [64, 448, 128, 512], o.skin, rng); g.fillStyle = 'rgba(60,40,20,0.28)'; g.fillRect(64, 448, 64, 64); if (o.sandals) { g.fillStyle = '#2a1a10'; g.fillRect(64, 468, 64, 6); g.fillRect(64, 492, 64, 5); g.fillRect(93, 448, 6, 64); } }
}

function paintSkirt(g, o, rng) {
  const [x0, y0, x1, y1] = R_SKIRT, Wd = x1 - x0, H = y1 - y0;
  const c = o.mundu ?? 0xe9e2cf;
  g.fillStyle = hex(c); g.fillRect(x0, y0, Wd, H);
  if (o.lungi) {
    g.fillStyle = rgba(o.lungi, 0.55);
    for (let x = 0; x < Wd; x += 18) g.fillRect(x0 + x, y0, 6, H);
    for (let y = 0; y < H; y += 18) g.fillRect(x0, y0 + y, Wd, 6);
    g.fillStyle = rgba(o.lungi, 0.5); for (let x = 0; x < Wd; x += 18) g.fillRect(x0 + x + 11, y0, 1.5, H);
  }
  // hanging folds
  for (let i = 0; i < 30; i++) {
    const x = x0 + rng() * Wd, w = 3 + rng() * 9;
    const grd = g.createLinearGradient(x, 0, x + w, 0);
    grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(0.5, `rgba(0,0,0,${0.12 + rng() * 0.16})`); grd.addColorStop(1, 'rgba(255,255,255,0.06)');
    g.fillStyle = grd; g.fillRect(x, y0, w, H);
  }
  let grd = g.createLinearGradient(x0, 0, x1, 0);
  grd.addColorStop(0, 'rgba(0,0,0,0.12)'); grd.addColorStop(0.22, 'rgba(0,0,0,0.2)'); grd.addColorStop(0.4, 'rgba(0,0,0,0)'); grd.addColorStop(0.6, 'rgba(0,0,0,0)'); grd.addColorStop(0.78, 'rgba(0,0,0,0.2)'); grd.addColorStop(1, 'rgba(0,0,0,0.12)');
  g.fillStyle = grd; g.fillRect(x0, y0, Wd, H);
  // waist roll
  g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x0, y0 + 9, Wd, 3); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x0, y0 + 2, Wd, 5);
  // the overlapping front edge
  g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x0 + Wd * 0.44, y0 + 8); g.lineTo(x0 + Wd * 0.41, y1); g.stroke();
  if (o.kasavu) {
    g.fillStyle = '#c9a13a'; g.fillRect(x0, y1 - 13, Wd, 8); g.fillRect(x0 + Wd * 0.41 + 2, y0 + 10, 7, H - 10);
    g.fillStyle = '#8a6a1c'; g.fillRect(x0, y1 - 14, Wd, 1.5); g.fillRect(x0, y1 - 5, Wd, 1.5);
  } else if (!o.lungi) { g.fillStyle = shade(c, 0.72); g.fillRect(x0, y1 - 7, Wd, 3); }
  if (o.knot) {
    const kx = x0 + Wd * 0.5;
    g.fillStyle = shade(c, 0.93); g.fillRect(kx - 10, y0 + 10, 20, H - 12);
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1.4; for (const dx of [-10, -3.5, 3.5, 10]) { g.beginPath(); g.moveTo(kx + dx, y0 + 14); g.lineTo(kx + dx * 1.25, y1 - 3); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(kx, y0 + 15, 15, 8, 0, 0, 7); g.fill();
    g.fillStyle = hex(c); g.beginPath(); g.ellipse(kx, y0 + 11, 14, 7.5, 0, 0, 7); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.32)'; g.lineWidth = 1.3; g.beginPath(); g.ellipse(kx, y0 + 11, 14, 7.5, 0, 0, 7); g.stroke(); g.beginPath(); g.moveTo(kx - 8, y0 + 8); g.quadraticCurveTo(kx, y0 + 14, kx + 8, y0 + 8); g.stroke();
    if (o.kasavu) { g.fillStyle = '#c9a13a'; g.fillRect(kx + 6, y0 + 18, 4, H - 22); }
  }
  if (!o.munduLong) { g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, y0 + H * 0.2); g.lineTo(x1, y0 + H * 0.22); g.stroke(); }
  if (o.dirty) { g.fillStyle = 'rgba(80,50,22,0.2)'; g.fillRect(x0, y1 - 40, Wd, 40); for (let i = 0; i < 16; i++) { g.beginPath(); g.arc(x0 + rng() * Wd, y1 - rng() * 60, 4 + rng() * 10, 0, 7); g.fill(); } }
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x0, y1 - 2.5, Wd, 2.5);
  // loose cloth swatch (shoulder cloth)
  g.fillStyle = hex(o.shoulderCloth ?? c); g.fillRect(128, 448, 64, 64);
  g.fillStyle = 'rgba(0,0,0,0.1)'; for (let i = 0; i < 6; i++) g.fillRect(128 + i * 11, 448, 3, 64);
  g.fillStyle = '#c9a13a'; g.fillRect(128, 448, 5, 64);
}

let _grain = null;
function grainCanvas() {
  if (_grain) return _grain;
  const c = _grain = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d'), im = g.createImageData(512, 512), d = im.data;
  for (let i = 0; i < d.length; i += 4) { const v = 100 + Math.random() * 56; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
  g.putImageData(im, 0, 0);
  return c;
}
const texCache = new Map();
function makeTexture(o) {
  const key = JSON.stringify(o);
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  let seed = 7; for (let i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) | 0;
  const rng = makeRng(seed);
  g.fillStyle = hex(o.skin); g.fillRect(0, 0, 512, 512);
  paintHead(g, o, rng); paintTorso(g, o, rng); bakeTorso(g); paintArm(g, o, rng); paintLeg(g, o, rng); paintSkirt(g, o, rng);
  // cloth-and-skin grain
  g.globalAlpha = 0.5; g.globalCompositeOperation = 'overlay'; g.drawImage(grainCanvas(), 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  // a little self-illumination keeps faces readable in shade, as hand-lit game characters were
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, metalness: 0, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.16 });
  m.userData = { canvas: c, seed, key };
  texCache.set(key, m);
  return m;
}
// the same character with another face: only the head region is repainted
function faceMaterial(o, expr, open) {
  const base = makeTexture(o);
  if ((!expr || expr === 'neutral') && !open) return base;
  const key = base.userData.key + '|' + expr + (open ? '|o' : '');
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  g.drawImage(base.userData.canvas, 0, 0);
  g.save(); g.beginPath(); g.rect(R_HEAD[0], R_HEAD[1], R_HEAD[2] - R_HEAD[0], R_HEAD[3] - R_HEAD[1]); g.clip();
  paintHead(g, { ...o, expr, mouthOpen: open }, makeRng(base.userData.seed));
  g.globalAlpha = 0.5; g.globalCompositeOperation = 'overlay'; g.drawImage(grainCanvas(), 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = base.clone(); m.map = t; m.emissiveMap = t;
  texCache.set(key, m);
  return m;
}

// =====================================================================
//  GEOMETRY
// =====================================================================
const X = [1, 0, 0], Zv = [0, 0, 1];
const geoCache = new Map();
function bodyGeometry(o) {
  const fem = !!o.female, belly = !!o.belly, skirt = o.trousers == null, long = !!o.munduLong;
  const shirtOver = o.shirt != null && o.style !== 'blouse';
  const bk = (o.build ?? 1) * (fem ? 1.05 : 1.17);
  const key = [fem, belly, skirt, long, shirtOver, o.boots != null, !!o.shoulderCloth, o.style === 'frock', bk, !!o.child].join('|');
  if (geoCache.has(key)) return geoCache.get(key);
  const g = new SGB(512);
  const ring = (y, rx, zf, zb, w, v, cx = 0, cz = 0, mod) => ({ c: [cx, y, cz], ax: [rx, 0, 0], az: [0, 0, zf], azB: [0, 0, zb], w, v, mod });

  // ---------------- torso
  const sw = fem ? 0.86 : 1;                     // shoulder scale
  const T = [
    // y, rx, zFront, zBack, weights
    [0.84, 0.135, 0.095, 0.098, [[B.hips, 1]]],
    [0.90, fem ? 0.168 : 0.160, 0.105, 0.112, [[B.hips, 1]]],
    [0.97, fem ? 0.158 : 0.157, 0.100, 0.105, [[B.hips, 0.6], [B.spine, 0.4]]],
    [1.04, fem ? 0.126 : 0.142, 0.092, 0.092, [[B.spine, 1]]],
    [1.13, fem ? 0.130 : 0.150, 0.100, 0.094, [[B.spine, 0.8], [B.chest, 0.2]]],
    [1.23, 0.170 * sw, fem ? 0.122 : 0.112, 0.100, [[B.spine, 0.4], [B.chest, 0.6]]],
    [1.32, 0.190 * sw, fem ? 0.134 : 0.122, 0.106, [[B.chest, 1]]],
    [1.40, 0.198 * sw, 0.110, 0.108, [[B.chest, 1]]],
    [1.455, 0.148 * sw, 0.084, 0.090, [[B.chest, 1]]],
    [1.49, 0.058, 0.054, 0.056, [[B.chest, 0.55], [B.head, 0.45]]],
  ];
  const tr = [];
  for (const [y, rx0, zf0, zb, w] of T) {
    let rx = rx0, zf = zf0;
    if (belly && y > 0.88 && y < 1.2) { const k = 1 - Math.abs(y - 1.05) / 0.17; zf += 0.05 * Math.max(0, k); rx += 0.016 * Math.max(0, k); }
    if (shirtOver && y < 1.0) { rx += 0.014; zf += 0.014; }
    const nk = y > 1.47 ? 1.1 : 1;
    tr.push(ring(y, rx * bk * nk, zf * bk * nk, (zb + (shirtOver && y < 1.0 ? 0.012 : 0)) * bk * nk, w, (1.49 - y) / 0.69));
  }
  if (shirtOver) {
    const hem = o.style === 'frock' ? 0.66 : 0.80;
    tr[0] = ring(hem, 0.192, 0.14, 0.14, [[B.hips, 1]], 1);
    if (o.style === 'frock') tr.splice(1, 0, ring(0.84, 0.184, 0.132, 0.134, [[B.hips, 1]], 0.94));
    g.loft(tr, 16, R_TORSO, {});
  } else g.loft(tr, 16, R_TORSO, { capStart: 0.01 });

  // ---------------- head
  const wrap = (th) => { let a = th % (Math.PI * 2); if (a > Math.PI) a -= Math.PI * 2; if (a < -Math.PI) a += Math.PI * 2; return a; };
  const face = (nose, ear, chin = 0) => (th) => {
    const a = wrap(th), s = Math.abs(a) - Math.PI / 2;
    return 1 + nose * Math.exp(-(a * a) / 0.045) + ear * Math.exp(-(s * s) / 0.03) + chin * Math.exp(-(a * a) / 0.2);
  };
  const hs = (fem ? 1.1 : 1.19) * (o.child ? 1.2 : 1), yTop = 1.776, yBot = 1.49;
  const Hd = [
    [1.49, 0.050, 0.052, 0.052, [[B.chest, 0.4], [B.head, 0.6]], null],
    [1.535, 0.050, 0.056, 0.053, [[B.head, 1]], null],
    [1.555, 0.050, 0.074, 0.058, [[B.head, 1]], face(0, 0, 0.05)],
    [1.585, 0.062, 0.088, 0.072, [[B.head, 1]], face(0.02, 0)],
    [1.612, 0.070, 0.092, 0.084, [[B.head, 1]], face(0.05, 0.05)],
    [1.640, 0.076, 0.093, 0.090, [[B.head, 1]], face(0.17, 0.12)],
    [1.665, 0.077, 0.092, 0.093, [[B.head, 1]], face(0.07, 0.12)],
    [1.700, 0.078, 0.091, 0.096, [[B.head, 1]], face(0.02, 0.03)],
    [1.735, 0.071, 0.081, 0.092, [[B.head, 1]], null],
    [1.762, 0.052, 0.058, 0.070, [[B.head, 1]], null],
  ];
  g.loft(Hd.map(([y, rx, zf, zb, w, mod]) => ring(y, rx * hs, zf * hs, zb * hs, w, (yTop - y) / (yTop - yBot), 0, 0.004, mod)), 18, R_HEAD, { capEnd: 0.014 });

  // ---------------- arms
  for (const s of [-1, 1]) {
    const up = s < 0 ? B.armL : B.armR, fo = s < 0 ? B.foreL : B.foreR, ha = s < 0 ? B.handL : B.handR;
    const k = (fem ? 1.0 : 1.2) * (o.build ?? 1), sx = 0.2 * (fem ? 0.9 : 1.06);
    const A = [
      [1.47, 0.02, 0.024, [[B.chest, 0.5], [up, 0.5]]],
      [1.458, 0.038, 0.042, [[B.chest, 0.5], [up, 0.5]]],
      [1.43, 0.049, 0.053, [[B.chest, 0.3], [up, 0.7]]],
      [1.39, 0.052, 0.055, [[B.chest, 0.15], [up, 0.85]]],
      [1.32, 0.049, 0.052, [[up, 1]]],
      [1.23, 0.043, 0.046, [[up, 1]]],
      [1.165, 0.038, 0.040, [[up, 0.5], [fo, 0.5]]],
      [1.11, 0.040, 0.043, [[fo, 1]]],
      [1.02, 0.036, 0.038, [[fo, 1]]],
      [0.915, 0.027, 0.030, [[fo, 0.8], [ha, 0.2]]],
      [0.885, 0.017, 0.031, [[ha, 1]]],
      [0.845, 0.019, 0.041, [[ha, 1]]],
      [0.795, 0.016, 0.037, [[ha, 1]]],
      [0.757, 0.010, 0.022, [[ha, 1]]],
    ];
    const rs = A.map(([y, rx, rz, w]) => ({ c: [s * (sx + 0.032 * (1.435 - y) / 0.55), y, 0.002], ax: [rx * k, 0, 0], az: [0, 0, rz * k], w, v: (1.475 - y) / (1.475 - 0.752) }));
    g.loft(rs, 10, R_ARM, { capStart: 0.004, capEnd: 0.006, mirrorU: s > 0 });
  }

  // ---------------- legs & feet
  const legFrom = skirt ? (long ? 0.19 : 0.61) : 1;
  for (const s of [-1, 1]) {
    const th = s < 0 ? B.thighL : B.thighR, sh = s < 0 ? B.shinL : B.shinR, ft = s < 0 ? B.footL : B.footR;
    const tk = (o.trousers != null ? 1.26 : (fem ? 1.02 : 1.24)) * (o.build ?? 1), bt = o.boots != null ? 1.26 : 1.14;
    const L = [
      [0.96, 0.080, 0.090, 0.090, [[B.hips, 0.6], [th, 0.4]]],
      [0.88, 0.084, 0.092, 0.094, [[B.hips, 0.2], [th, 0.8]]],
      [0.74, 0.072, 0.078, 0.080, [[th, 1]]],
      [0.60, 0.059, 0.063, 0.063, [[th, 1]]],
      [0.50, 0.052, 0.056, 0.054, [[th, 0.5], [sh, 0.5]]],
      [0.44, 0.050, 0.052, 0.054, [[sh, 1]]],
      [0.34, 0.053, 0.050, 0.064, [[sh, 1]]],
      [0.18, 0.038 * bt, 0.040 * bt, 0.042 * bt, [[sh, 1]]],
      [0.085, 0.033 * bt, 0.036 * bt, 0.036 * bt, [[sh, 0.6], [ft, 0.4]]],
    ].filter((r) => r[0] <= legFrom);
    if (L.length >= 2) g.loft(L.map(([y, rx, zf, zb, w]) => ring(y, rx * tk, zf * tk, zb * tk, w, (0.96 - y) / (0.96 - 0.085), s * 0.09, 0)), 10, R_LEG, { mirrorU: s > 0 });
    // foot (lofted heel -> toe)
    const F = [[-0.066, 0.040, 0.030, 0.038], [-0.012, 0.047, 0.037, 0.047], [0.07, 0.031, 0.043, 0.031], [0.14, 0.020, 0.044, 0.020], [0.186, 0.014, 0.034, 0.013]];
    g.loft(F.map(([z, cy, rx, ry], i) => ({ c: [s * 0.09, cy * bt, z * bt], ax: [rx * bt, 0, 0], az: [0, ry * bt, 0], w: [[ft, 1]], v: i / 4 })), 8, R_FOOT, { capStart: 0.012, capEnd: 0.012 });
  }

  // ---------------- mundu (wrap-around waist cloth)
  if (skirt) {
    const up = shirtOver ? 0.9 : 1;
    const S = [
      [1.02, 0.158 * up, 0.108 * up, 0, 0],
      [0.93, 0.178 * up, 0.125 * up, 0.25, 0],
      [0.82, 0.184, 0.132, 0.65, 0],
      [0.68, 0.188, 0.136, 1, 0],
      [0.55, 0.192, 0.140, 1, 0],
    ];
    if (long) S.push([0.42, 0.190, 0.138, 0.5, 0.5], [0.28, 0.186, 0.135, 0, 1], [0.115, 0.192, 0.14, 0, 1]);
    const yb = S[S.length - 1][0];
    g.loft(S.map(([y, rx, rz, wt, ws]) => ({
      c: [0, y, 0.004], ax: [rx * (fem ? 1.07 : 1.15), 0, 0], az: [0, 0, rz * (fem ? 1.05 : 1.15)], v: (1.02 - y) / (1.02 - yb),
      w: (th, p) => {
        const l = 0.5 - 0.5 * clamp(p[0] / (0.34 * rx), -1, 1);       // 1 = left (-x)
        const out = [], hip = 1 - wt - ws;
        if (hip > 0.001) out.push([B.hips, hip]);
        if (wt > 0) out.push([B.thighL, wt * l], [B.thighR, wt * (1 - l)]);
        if (ws > 0) out.push([B.shinL, ws * l], [B.shinR, ws * (1 - l)]);
        return out.filter((e) => e[1] > 0.001);
      },
    })), 18, R_SKIRT, {});
  }

  // ---------------- folded cloth over the left shoulder
  if (o.shoulderCloth != null) {
    const pts = [[0.118, 1.12], [0.128, 1.30], [0.112, 1.44], [0.03, 1.478], [-0.07, 1.452], [-0.112, 1.33], [-0.108, 1.14]];
    g.loft(pts.map(([z, y], i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let ty = b[1] - a[1], tz = b[0] - a[0]; const l = Math.hypot(ty, tz) || 1; ty /= l; tz /= l;
      return { c: [0.105 * sw, y, z], ax: [0.05, 0, 0], az: [0, tz * 0.007, -ty * 0.007], w: [[B.chest, 1]], v: i / 6 };
    }), 6, R_CLOTH, { capStart: 0.001, capEnd: 0.001 });
  }
  const geo = g.build(true);
  geoCache.set(key, geo);
  return geo;
}

// simple shared materials for rigid accessories
const accCache = new Map();
function AM(color, rough = 0.85, extra) {
  const k = color + '|' + rough + (extra ? JSON.stringify(extra) : '');
  if (!accCache.has(k)) accCache.set(k, new THREE.MeshStandardMaterial({ color, roughness: rough, ...(extra || {}) }));
  return accCache.get(k);
}
function addMesh(parent, geo, mat, x, y, z, sx = 1, sy = sx, sz = sx) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; parent.add(m); return m;
}
const G_SPH = new THREE.SphereGeometry(1, 14, 10), G_HEMI = new THREE.SphereGeometry(1, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2);
const G_CYL = new THREE.CylinderGeometry(1, 1, 1, 14), G_TORUS = new THREE.TorusGeometry(1, 0.42, 8, 16);
const G_BOX = new THREE.BoxGeometry(1, 1, 1);
const G_CAPE = new THREE.CylinderGeometry(0.21, 0.37, 1, 12, 3, true, Math.PI * 0.4, Math.PI * 1.2);
const G_HOOD = new THREE.ConeGeometry(0.2, 0.34, 12, 2, true);
const G_BASKET = new THREE.LatheGeometry([[0.001, 0], [0.13, 0.01], [0.2, 0.13], [0.215, 0.15]].map(([r, h]) => new THREE.Vector2(r, h)), 12);
const G_CANOPY = new THREE.ConeGeometry(0.62, 0.2, 14, 1, true);
let _leafMat = null;
function leafMat() { return _leafMat || (_leafMat = new THREE.MeshStandardMaterial({ color: 0xc2ab72, map: TEX.thatch || null, roughness: 1, side: THREE.DoubleSide })); }

// =====================================================================
//  THE CHARACTER
// =====================================================================
export class Human {
  constructor(o = {}) {
    o = { skin: 0x8d5b3c, ...o };
    this.preset = o;
    const { scale, ...look } = o;
    this.look = look; this.expr = 'neutral'; this.mouthOpen = false; this.talking = false; this.exprT = 0;
    this.root = new THREE.Group();
    this.root.scale.setScalar(scale ?? 1);
    this.body = new THREE.Group(); this.root.add(this.body);
    const bone = (parent, x, y, z) => { const b = new THREE.Bone(); b.position.set(x, y, z); parent.add(b); return b; };
    const fem = !!o.female, sx = 0.2 * (fem ? 0.9 : 1.06);
    const hips = this.hips = bone(this.body, 0, 0.94, 0);
    const spine = this.spine = bone(hips, 0, 0.09, 0);
    const chest = this.chest = bone(spine, 0, 0.21, 0);
    const head = this.head = bone(chest, 0, 0.275, 0);
    const arm = (s) => { const sh = bone(chest, s * sx, 0.195, 0); const el = bone(sh, s * 0.016, -0.285, 0); const hand = bone(el, s * 0.013, -0.265, 0); return { sh, el, hand }; };
    this.armL = arm(-1); this.armR = arm(1);
    const leg = (s) => { const hp = bone(hips, s * 0.09, -0.02, 0); const kn = bone(hp, 0, -0.44, 0); const ft = bone(kn, 0, -0.41, 0); return { hp, kn, ft }; };
    this.legL = leg(-1); this.legR = leg(1);
    const bones = [hips, spine, chest, head, this.armL.sh, this.armL.el, this.armL.hand, this.armR.sh, this.armR.el, this.armR.hand, this.legL.hp, this.legL.kn, this.legL.ft, this.legR.hp, this.legR.kn, this.legR.ft];

    const mesh = this.mesh = new THREE.SkinnedMesh(bodyGeometry(o), makeTexture(look));
    mesh.castShadow = true; mesh.frustumCulled = false;
    this.root.add(mesh);
    this.root.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(bones));

    // ---- rigid accessories on the head (crown of the skull is ~0.15 above the head bone)
    const hd = new THREE.Group(); hd.position.set(0, 0.15, 0.004); head.add(hd);
    const hairM = AM(o.grey ? 0xb4b0a6 : (o.hair ?? 0x15110e), 0.7);
    const gc = o.gearColor;
    if (o.bun) { addMesh(hd, G_SPH, hairM, 0, -0.02, -0.108, 0.055, 0.058, 0.05); if (o.flowers) addMesh(hd, G_TORUS, AM(0xf3efe2, 0.9), 0, -0.02, -0.112, 0.05, 0.05, 0.03); }
    if (o.headgear === 'turban') {
      addMesh(hd, G_SPH, AM(gc ?? 0xb02a22, 0.95), 0, 0.068, -0.008, 0.105, 0.07, 0.112);
      const t = addMesh(hd, G_TORUS, AM(gc ?? 0xb02a22, 0.95), 0, 0.045, -0.004, 0.082, 0.092, 0.06); t.rotation.x = Math.PI / 2 - 0.12;
      addMesh(hd, G_SPH, AM(gc ?? 0xb02a22, 0.95), -0.05, -0.06, -0.1, 0.02, 0.07, 0.012);
    } else if (o.headgear === 'thorthu') {
      const t = addMesh(hd, G_TORUS, AM(gc ?? 0xe7dfc8, 0.95), 0, 0.045, -0.004, 0.074, 0.086, 0.07); t.rotation.x = Math.PI / 2 - 0.1;
      addMesh(hd, G_SPH, AM(gc ?? 0xe7dfc8, 0.95), 0, 0.075, -0.008, 0.07, 0.035, 0.08);
      addMesh(hd, G_SPH, AM(gc ?? 0xe7dfc8, 0.95), 0.06, 0.0, -0.085, 0.018, 0.05, 0.02);
    } else if (o.headgear === 'cap') {
      addMesh(hd, G_CYL, AM(gc ?? 0xf0ece0, 0.9), 0, 0.078, -0.006, 0.079, 0.07, 0.09);
    } else if (o.headgear === 'topi') {
      addMesh(hd, G_HEMI, AM(gc ?? 0xd8cfb4, 0.9), 0, 0.04, -0.004, 0.092, 0.105, 0.106);
      const b = addMesh(hd, G_CYL, AM(gc ?? 0xd8cfb4, 0.9), 0, 0.045, 0.006, 0.142, 0.012, 0.16); b.rotation.x = 0.1;
      addMesh(hd, G_CYL, AM(0x6a5a3a, 0.9), 0, 0.058, -0.004, 0.094, 0.022, 0.108);
    } else if (o.headgear === 'tophat') {
      addMesh(hd, G_CYL, AM(gc ?? 0x18161a, 0.5), 0, 0.14, -0.006, 0.078, 0.15, 0.088);
      addMesh(hd, G_CYL, AM(gc ?? 0x18161a, 0.5), 0, 0.065, -0.006, 0.118, 0.012, 0.13);
      addMesh(hd, G_CYL, AM(0x3a3440, 0.6), 0, 0.085, -0.006, 0.08, 0.028, 0.09);
    } else if (o.headgear === 'slouch') {
      addMesh(hd, G_HEMI, AM(gc ?? 0x4a3d2c, 0.9), 0, 0.05, -0.006, 0.086, 0.085, 0.098);
      const b = addMesh(hd, G_CYL, AM(gc ?? 0x4a3d2c, 0.9), 0, 0.055, -0.004, 0.15, 0.01, 0.16); b.rotation.z = 0.12;
    } else if (o.headgear === 'fez') {
      addMesh(hd, new THREE.CylinderGeometry(0.066, 0.08, 0.1, 14), AM(gc ?? 0x8a1c1c, 0.9), 0, 0.105, -0.006);
    }
    if (o.tuft) addMesh(hd, G_SPH, hairM, 0, 0.012, 0.062, 0.03, 0.03, 0.036);            // the Namboothiri's forelock
    if (o.braid) {
      for (let i = 0; i < 9; i++) addMesh(chest, G_SPH, hairM, Math.sin(i * 1.9) * 0.006, 0.3 - i * 0.052, -0.118 - Math.sin(i * 0.4) * 0.012, 0.026 - i * 0.0012, 0.036, 0.024);
      addMesh(hd, G_SPH, hairM, 0, -0.06, -0.1, 0.05, 0.06, 0.04);
      if (o.flowers) for (let i = 0; i < 3; i++) addMesh(chest, G_TORUS, AM(0xf6f2e6, 0.9), 0, 0.33 - i * 0.075, -0.124, 0.03, 0.03, 0.022).rotation.x = Math.PI / 2;
    }
    if (o.bag != null) {
      addMesh(this.hips, G_BOX, AM(o.bag, 0.95), 0.215, 0.0, 0.02, 0.07, 0.23, 0.2);
      addMesh(this.hips, G_BOX, AM(shadeN(o.bag, 0.75), 0.95), 0.222, 0.075, 0.02, 0.072, 0.09, 0.205);
    }
    if (o.cape) {          // the woven palm-leaf rain cape of the monsoon
      const cp = addMesh(chest, G_CAPE, leafMat(), 0, -0.2, -0.005, 1, 0.98, 1); cp.rotation.x = 0.07;
      const hood = addMesh(hd, G_HOOD, leafMat(), 0, 0.085, -0.03, 1, 1, 1.12); hood.rotation.x = -0.32;
    }
    if (o.basketHead) { addMesh(hd, G_BASKET, leafMat(), 0, 0.072, 0, 1); addMesh(hd, G_TORUS, AM(0x8a7a5a, 1), 0, 0.062, 0, 0.07, 0.07, 0.03).rotation.x = Math.PI / 2; }
    if (o.earrings) for (const s of [-1, 1]) addMesh(hd, G_SPH, AM(0xd9a93a, 0.35, { metalness: 0.5 }), s * 0.081, -0.085, 0.0, 0.009);
    if (o.necklace) { const n = addMesh(chest, G_TORUS, AM(0xd9a93a, 0.35, { metalness: 0.5 }), 0, 0.205, 0.022, 0.062, 0.062, 0.02); n.rotation.x = Math.PI / 2 - 0.5; }

    this.state = 'idle';
    this.phase = Math.random() * 6; this.t = Math.random() * 10; this.speed = 0;
    this.strikeT = -1; this.strikeDur = 0.42; this.blocking = false; this.carry = false;
    this.j = { legL: 0, legR: 0, kneeL: 0, kneeR: 0, armL: 0, armR: 0, elL: 0, elR: 0, spine: 0, hipY: 0.94, armLz: 0, armRz: 0, legLz: 0, legRz: 0, bodyX: 0, bodyY: 0, twist: 0, head: 0, headY: 0, sway: 0 };
  }

  // facial expression: 'neutral' | 'determined' | 'laughing' | 'worried' | 'angry' | 'grieving'
  setExpression(e = 'neutral', hold = 0) {
    if (!EXPR[e]) e = 'neutral';
    this.exprT = hold;
    if (e === this.expr) return;
    this.expr = e; this.mesh.material = faceMaterial(this.look, this.expr, this.mouthOpen);
  }
  // a palm-leaf umbrella (olakkuda) carried when it rains
  setUmbrella(on) {
    if (on && !this.umb) {
      const u = this.umb = new THREE.Group();
      const sh = new THREE.Mesh(G_CYL, AM(0x4a3a26, 0.9)); sh.scale.set(0.011, 0.74, 0.011); sh.position.set(0.185, 0.45, 0.22); sh.rotation.set(-0.27, 0, 0.18); u.add(sh);
      const cn = new THREE.Mesh(G_CANOPY, leafMat()); cn.position.set(0.12, 0.84, 0.12); cn.castShadow = true; u.add(cn);
      const tip = new THREE.Mesh(G_SPH, AM(0x4a3a26, 0.9)); tip.scale.setScalar(0.022); tip.position.set(0.12, 0.95, 0.12); u.add(tip);
      this.chest.add(u);
    }
    if (this.umb) this.umb.visible = !!on;
    this.umbrella = !!on;
  }
  hold(obj, right = true) { (right ? this.armR : this.armL).hand.add(obj); return obj; }

  update(dt) {
    this.t += dt;
    const s = this.state, t = this.t, sp = this.speed;
    const g = { legL: 0, legR: 0, kneeL: 0.03, kneeR: 0.03, armL: 0, armR: 0, elL: -0.14, elR: -0.14, spine: 0, hipY: 0.94, armLz: -0.09, armRz: 0.09, legLz: 0, legRz: 0, bodyX: 0, bodyY: 0, twist: 0, head: 0, headY: 0, sway: 0 };
    let k = 12;
    if (s === 'idle' || s === 'talk' || s === 'cheer') {
      g.spine = Math.sin(t * 1.3) * 0.015;
      g.sway = Math.sin(t * 0.45) * 0.03;
      g.armL = Math.sin(t * 0.9) * 0.03; g.armR = -g.armL;
      g.headY = Math.sin(t * 0.31) * 0.12;
      if (s === 'talk') { g.armR = -0.6 + Math.sin(t * 3.1) * 0.22; g.elR = -1.05 + Math.sin(t * 2.3) * 0.25; g.head = Math.sin(t * 1.7) * 0.06; g.armL = -0.15; g.elL = -0.4; }
      if (s === 'cheer') { const w = Math.sin(t * 9); g.armL = -2.7 + w * 0.25; g.armR = -2.7 - w * 0.25; g.elL = g.elR = -0.3; g.armLz = -0.35; g.armRz = 0.35; g.hipY = 0.94 + Math.abs(Math.sin(t * 4.5)) * 0.04; g.head = -0.15; }
    } else if (s === 'move' || s === 'crouch') {
      const crouch = s === 'crouch';
      this.phase += dt * (4.0 + sp * 0.86);
      const p = this.phase, amp = clamp(0.3 + sp * 0.115, 0, 1.08) * (sp > 0.05 ? 1 : 0);
      g.legL = -Math.sin(p) * amp; g.legR = Math.sin(p) * amp;
      g.kneeL = Math.max(0, Math.cos(p)) * amp * 1.35 + 0.05; g.kneeR = Math.max(0, -Math.cos(p)) * amp * 1.35 + 0.05;
      g.armL = Math.sin(p) * amp * 0.8; g.armR = -Math.sin(p) * amp * 0.8;
      g.elL = -(0.2 + amp * 0.75) - Math.max(0, -Math.sin(p)) * amp * 0.4; g.elR = -(0.2 + amp * 0.75) - Math.max(0, Math.sin(p)) * amp * 0.4;
      g.spine = 0.03 + sp * 0.028;
      g.hipY = 0.94 - amp * 0.03 + Math.abs(Math.sin(p)) * 0.035 * amp;
      g.twist = Math.sin(p) * 0.12 * amp;
      g.sway = Math.cos(p) * 0.035 * amp;
      if (crouch) { g.hipY -= 0.26; g.spine += 0.5; g.legL -= 0.75; g.legR -= 0.75; g.kneeL += 1.25; g.kneeR += 1.25; g.elL = g.elR = -0.9; g.head = -0.4; }
      k = 16;
    } else if (s === 'sit' || s === 'ride') {
      g.legL = g.legR = -1.25; g.kneeL = g.kneeR = 1.25; g.legLz = -0.42; g.legRz = 0.42;
      g.armL = g.armR = -0.75; g.elL = g.elR = -0.55; g.armLz = -0.12; g.armRz = 0.12;
      g.spine = 0.08 + sp * 0.014 + Math.sin(this.phase * 2) * 0.03 * Math.min(1, sp * 0.2);
      this.phase += dt * (3 + sp * 0.9);
    } else if (s === 'bench' || s === 'sidesaddle') {
      // seated with knees together (bench, verandah edge, or pillion side-saddle)
      g.legL = g.legR = -1.42; g.kneeL = g.kneeR = 1.45; g.spine = 0.06 + Math.sin(t * 1.2) * 0.02;
      g.armL = -0.5; g.armR = -0.5; g.elL = g.elR = -0.8; g.headY = Math.sin(t * 0.4) * 0.15;
      if (s === 'sidesaddle') { g.armR = -0.9; g.elR = -0.5; g.spine = 0.12 + Math.sin(this.phase * 2) * 0.03; this.phase += dt * (3 + sp * 0.9); }
    } else if (s === 'paddle' || s === 'boat') {
      g.legL = g.legR = -1.45; g.kneeL = g.kneeR = 1.5; g.hipY = 0.5;
      const pd = s === 'paddle' ? 1 : 0;
      this.phase += dt * (this.rowRate || 4.2) * pd;
      const p = this.phase;
      g.spine = 0.18 + Math.sin(p) * 0.16 * pd;
      g.armR = -0.95 + Math.sin(p) * 0.55 * pd; g.armL = -1.25 + Math.sin(p) * 0.4 * pd;
      g.elR = -0.5 - Math.cos(p) * 0.3 * pd; g.elL = -0.7; g.armLz = 0.35; g.armRz = 0.1;
      g.twist = Math.sin(p) * 0.2 * pd;
    } else if (s === 'swim') {
      this.phase += dt * 5;
      const p = this.phase;
      g.bodyX = 1.1; g.bodyY = -0.3;
      g.armL = -2.4 + Math.sin(p) * 1.2; g.armR = -2.4 - Math.sin(p) * 1.2;
      g.legL = Math.sin(p * 1.5) * 0.35; g.legR = -Math.sin(p * 1.5) * 0.35; g.head = -0.7;
    } else if (s === 'ko') {
      g.bodyX = -1.5; g.bodyY = 0.14; g.armLz = -1.1; g.armRz = 1.2; g.legLz = -0.2; g.legRz = 0.25; g.kneeR = 0.5; g.headY = 0.5;
      k = 7;
    } else if (s === 'work') {
      g.spine = 0.85 + Math.sin(t * 2.2) * 0.08; g.armL = -0.9 + Math.sin(t * 4.4) * 0.3; g.armR = -0.9 - Math.sin(t * 4.4) * 0.3;
      g.elL = g.elR = -0.4; g.kneeL = g.kneeR = 0.25; g.legL = g.legR = -0.12; g.head = -0.3;
    } else if (s === 'fish') {
      g.armR = -1.0 + Math.sin(t * 0.8) * 0.04; g.elR = -0.7; g.armL = -0.7; g.elL = -1.0; g.spine = 0.05; g.headY = 0;
    } else if (s === 'cower') {
      g.hipY = 0.6; g.legL = g.legR = -1.2; g.kneeL = g.kneeR = 2.0; g.spine = 0.7; g.armL = g.armR = -2.3; g.elL = g.elR = -1.9; g.head = 0.3;
    } else if (s === 'pray') {
      g.armL = g.armR = -0.95; g.elL = g.elR = -1.75; g.armLz = 0.42; g.armRz = -0.42; g.head = 0.22; g.spine = 0.08;
    }
    if (this.exprT > 0) { this.exprT -= dt; if (this.exprT <= 0) this.setExpression('neutral'); }
    const mo = this.talking && (Math.sin(t * 17) + Math.sin(t * 7.3)) > 0.15;
    if (mo !== this.mouthOpen) { this.mouthOpen = mo; this.mesh.material = faceMaterial(this.look, this.expr, mo); }
    if (this.umbrella && (s === 'idle' || s === 'move' || s === 'talk')) { g.armR = -0.75; g.elR = -1.9; g.armRz = 0.1; }
    if (this.headLoad && (s === 'idle' || s === 'move')) { g.armL = -3.02; g.elL = -0.22; g.armLz = 0.16; g.sway *= 0.4; g.headY = 0; }
    if (this.carry && (s === 'idle' || s === 'move')) { g.armL = -0.1; g.elL = -0.25; g.armLz = -0.22; }
    if (this.blocking && this.strikeT < 0) { g.armR = -1.35; g.elR = -1.5; g.armRz = -0.3; g.armL = -1.2; g.elL = -1.4; g.armLz = 0.3; g.spine += 0.12; k = 26; }
    if (this.strikeT >= 0) {
      this.strikeT += dt;
      const u = this.strikeT / this.strikeDur, wind = this.strikeDur > 0.6 ? 0.6 : 0.35;
      if (u >= 1) this.strikeT = -1;
      else {
        const sw = u < wind ? lerp(-0.6, -3.0, u / wind) : lerp(-3.0, -0.15, (u - wind) / (1 - wind));
        g.armR = sw; g.elR = -0.35; g.armRz = 0.25;
        g.spine += u < wind ? -0.12 : 0.3; g.twist = u < wind ? -0.4 : 0.45;
        k = 30;
      }
    }
    const j = this.j;
    for (const key in g) j[key] = damp(j[key], g[key], k, dt);
    this.legL.hp.rotation.set(j.legL, 0, j.legLz); this.legR.hp.rotation.set(j.legR, 0, j.legRz);
    this.legL.kn.rotation.x = j.kneeL; this.legR.kn.rotation.x = j.kneeR;
    this.legL.ft.rotation.x = clamp(-(j.legL + j.kneeL) * 0.55, -0.7, 0.5); this.legR.ft.rotation.x = clamp(-(j.legR + j.kneeR) * 0.55, -0.7, 0.5);
    this.armL.sh.rotation.set(j.armL, 0, j.armLz); this.armR.sh.rotation.set(j.armR, 0, j.armRz);
    this.armL.el.rotation.x = j.elL; this.armR.el.rotation.x = j.elR;
    this.spine.rotation.set(j.spine * 0.6, j.twist * 0.5, -j.sway);
    this.chest.rotation.set(j.spine * 0.4, j.twist * 0.6, -j.sway * 0.5);
    this.hips.position.y = j.hipY;
    this.hips.rotation.set(0, -j.twist * 0.5, j.sway);
    this.head.rotation.set(j.head, j.headY - j.twist * 0.5, j.sway * 0.5);
    this.body.rotation.x = j.bodyX; this.body.position.y = j.bodyY;
  }
}

// =====================================================================
//  CAST
// =====================================================================
export const SKIN = [0x8d5b3c, 0x7a4b30, 0x9b6a48, 0x6e432b, 0x84553a, 0xa67650];
export const CAST = {
  // Madhavan, after the turnaround sheet: lean, hair knotted behind, moustache, charm on a cord,
  // a cloth on the left shoulder and a long cream mundu knotted at the waist
  madhavan: { skin: SKIN[0], mundu: 0xe9e0c8, munduLong: true, knot: true, moustache: true, bun: true, pendant: true, muscle: true, shoulderCloth: 0xe4dac0, build: 1.04 },
  ammavan: { skin: SKIN[1], mundu: 0xefe9d8, munduLong: true, kasavu: true, knot: true, grey: true, receding: true, moustache: 'big', belly: true, age: true, shoulderCloth: 0xefe9d8, mark: 'chandanam', thread: true, pendant: true, scale: 0.98 },
  devaki: { female: true, skin: SKIN[2], mundu: 0xf3edda, munduLong: true, kasavu: true, shirt: 0xf1ead6, style: 'blouse', neriyathu: 0xf3edda, braid: true, flowers: true, mark: 'pottu', bangles: true, earrings: true, necklace: true, scale: 0.93 },
  ouseph: { skin: SKIN[3], mundu: 0x4a6a8a, lungi: 0x24384c, beard: true, grey: true, age: true, headgear: 'thorthu', gearColor: 0xd8d0b8, pendant: true },
  moideen: { skin: SKIN[4], mundu: 0xd9d6c4, lungi: 0x2f5a4a, munduLong: true, shirt: 0xeae6da, style: 'kurta', longSleeves: true, beard: true, headgear: 'cap', belly: true, age: true, bag: 0x7a5a36, sandals: true },
  finch: { skin: 0xd9a98c, trousers: 0xcbbf9f, shirt: 0xd5cab0, style: 'jacket', longSleeves: true, moustache: 'big', hair: 0x8a6a3a, eye: 0x4a6a80, headgear: 'topi', boots: 0x3a2416, scale: 1.04 },
  harrow: { skin: 0xd6ad98, trousers: 0x2a2830, shirt: 0x23222a, style: 'frock', waistcoat: 0x5a5560, tie: 0x6a1420, longSleeves: true, grey: true, chops: true, moustache: true, age: true, stern: true, eye: 0x5a6a78, headgear: 'tophat', boots: 0x141214, belly: true, scale: 1.05 },
  dacre: { skin: 0xc99a80, trousers: 0x5a4c36, puttees: 0x6a5c44, shirt: 0x4a4436, style: 'jacket', tie: 0x2a2a20, longSleeves: true, hair: 0x3a2a1a, beard: 'stubble', moustache: true, stern: true, eye: 0x4a5a4a, headgear: 'slouch', boots: 0x2a1c10, scale: 1.09 },
  // the colonial officer of the sheet: white drill, pith helmet, tall brown boots
  carmichael: { skin: 0xddb49c, trousers: 0xece7d8, shirt: 0xeee9da, style: 'uniform', longSleeves: true, hair: 0x6a4a2a, moustache: 'big', eye: 0x4a6a80, headgear: 'topi', gearColor: 0xe9e3d0, boots: 0x4a2c16, tallBoots: true, scale: 1.03 },
  peishkar: { skin: SKIN[2], trousers: 0xe8e4d8, shirt: 0x24303e, style: 'frock', waistcoat: 0x24303e, tie: 0xe8e4d8, longSleeves: true, moustache: 'big', headgear: 'turban', gearColor: 0xe9d9a8, boots: 0x20140c, mark: 'chandanam', age: true },
  guard: { skin: SKIN[1], mundu: 0x8a7d5a, shirt: 0x8a7d5a, style: 'uniform', longSleeves: true, moustache: 'big', headgear: 'turban', gearColor: 0x9c2a20, stern: true },
  thug: { skin: SKIN[3], mundu: 0x5a4a3c, lungi: 0x2c241c, shirt: 0x3d3a34, dirty: true, moustache: 'big', beard: 'stubble', stern: true, headgear: 'thorthu', gearColor: 0x3a3028 },
  velu: { skin: SKIN[3], mundu: 0xd9d2bd, shirt: 0x9a9078, style: 'kurta', dirty: true, moustache: true, headgear: 'turban', gearColor: 0xd8d0b8 },
  // Namboothiri: bare chest, sacred thread, ash stripes, the forelock, a kasavu mundu
  priest: { skin: SKIN[5], mundu: 0xf2ecdc, munduLong: true, kasavu: true, knot: true, bald: true, tuft: true, mark: 'bhasmam', thread: true, belly: true },
  nasraniWoman: { female: true, skin: SKIN[2], mundu: 0xf4f0e4, munduLong: true, shirt: 0xf4f0e4, style: 'chatta', longSleeves: true, rosary: true, bun: true, earrings: true, age: true, scale: 0.92 },
  fisherwoman: { female: true, skin: SKIN[3], mundu: 0x2c3140, munduLong: true, shirt: 0x2c3140, style: 'wrap', sleeves: false, bun: true, bangles: true, basketHead: true, scale: 0.92 },
  child: { skin: SKIN[0], mundu: 0xd9cfb4, child: true, scale: 0.6 },
  childF: { female: true, skin: SKIN[2], mundu: 0x8a3a3a, munduLong: true, shirt: 0xe8dcc0, style: 'chatta', child: true, braid: true, scale: 0.58 },
  oarsman: [
    { skin: SKIN[0], mundu: 0xe6dfcb, headgear: 'thorthu', gearColor: 0xb8402c },
    { skin: SKIN[3], mundu: 0xe6dfcb, moustache: true, headgear: 'thorthu', gearColor: 0xb8402c },
  ],
  rival: { skin: SKIN[1], mundu: 0x2c3a52, shirt: 0x8a8272, sleeves: false, moustache: true, headgear: 'thorthu', gearColor: 0x1c2c4c },
  villagerM: [
    { skin: SKIN[0], mundu: 0xe6dfcb, moustache: true, pendant: true },
    { skin: SKIN[3], mundu: 0xb8b09a, lungi: 0x6a3a2a, headgear: 'thorthu', dirty: true },
    { skin: SKIN[1], mundu: 0xe9e2cf, munduLong: true, knot: true, moustache: 'big', shoulderCloth: 0xe6dfcb, age: true, grey: true },
    { skin: SKIN[4], mundu: 0xdcd6c2, lungi: 0x35506a, munduLong: true, shirt: 0xe6e0d0, style: 'kurta', headgear: 'cap', beard: true, sandals: true },
    { skin: SKIN[2], mundu: 0x35506a, lungi: 0x1c2c3c, grey: true, beard: true, age: true, receding: true },
    { skin: SKIN[5], mundu: 0xe2dac4, shirt: 0xcfc8b4, moustache: true, munduLong: true },
    { skin: SKIN[1], mundu: 0xd9d2bd, beard: 'stubble', headgear: 'thorthu', gearColor: 0x4a6a4a, dirty: true },
  ],
  villagerF: [
    { female: true, skin: SKIN[2], mundu: 0xefe9d8, munduLong: true, kasavu: true, shirt: 0x2f5a4a, style: 'blouse', bun: true, mark: 'pottu', bangles: true, earrings: true, scale: 0.92 },
    { female: true, skin: SKIN[0], mundu: 0xe9e1cc, munduLong: true, shirt: 0x7a3a5a, style: 'blouse', braid: true, flowers: true, mark: 'pottu', bangles: true, scale: 0.9 },
    { female: true, skin: SKIN[4], mundu: 0xe5ddc8, munduLong: true, kasavu: true, shirt: 0xb0862a, style: 'blouse', bun: true, earrings: true, necklace: true, age: true, grey: true, scale: 0.9 },
    { female: true, skin: SKIN[5], mundu: 0xf0e8d4, munduLong: true, shirt: 0x3a4a7a, style: 'blouse', neriyathu: 0xe8dcc0, bun: true, bangles: true, scale: 0.93 },
  ],
  // Madhavan's wardrobe, after the outfit sheet (the tailor in Puthenthura sells the rest)
  outfits: {
    everyday: { name: 'Everyday', price: 0, look: { skin: SKIN[0], mundu: 0xe9e0c8, munduLong: true, knot: true, moustache: true, bun: true, pendant: true, muscle: true, shoulderCloth: 0xe4dac0 } },
    boatman: { name: 'Boatman\'s daily wear', price: 0, look: { skin: SKIN[0], mundu: 0xe2d8be, knot: true, moustache: true, pendant: true, muscle: true, headgear: 'thorthu', gearColor: 0xe6dcc2 } },
    travel: { name: 'Travel wear', price: 64, look: { skin: SKIN[0], mundu: 0xe6dcc4, munduLong: true, knot: true, moustache: true, bun: true, pendant: true, muscle: true, bag: 0x7a6238, shoulderCloth: 0x9a8a62 } },
    monsoon: { name: 'Monsoon wear', price: 96, look: { skin: SKIN[0], mundu: 0x4a4c50, munduLong: true, knot: true, moustache: true, bun: true, pendant: true, muscle: true, cape: true } },
    festival: { name: 'Festival wear', price: 320, look: { skin: SKIN[0], mundu: 0xf6f0dc, munduLong: true, kasavu: true, knot: true, moustache: true, bun: true, pendant: true, muscle: true, shoulderCloth: 0xf6f0dc, mark: 'chandanam' } },
  },
};
