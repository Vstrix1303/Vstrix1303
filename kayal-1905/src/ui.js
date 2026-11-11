// HUD, dialogue, cards, minimap and menus (plain DOM over the canvas).
import * as THREE from 'three';
import { G } from './state.js';
import { clamp } from './util.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.el = {};
    for (const id of ['hud', 'chapterTag', 'objText', 'minimap', 'clock', 'hp', 'st', 'prompt', 'toast', 'marker', 'markerDist', 'subs', 'subName', 'subText', 'subHint',
      'bark', 'barkName', 'barkText', 'card', 'cardSmall', 'cardBig', 'cardSub', 'fade', 'hurt', 'menu', 'pause', 'loading', 'loadBar', 'loadText', 'letterTop', 'letterBot', 'detect', 'photoTip', 'dead', 'deadText']) this.el[id] = $(id);
    this.mctx = this.el.minimap.getContext('2d');
    this.markerPos = null; this.markerLabel = '';
    this.toastT = 0; this.barkT = 0; this.hurtV = 0;
    this.subResolve = null; this.typing = null;
    this.hudHidden = false;
    this.beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 70, 8, 1, true),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.6, 0.5), transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide }));
    this.beacon.layers.set(1); this.beacon.visible = false; this.beacon.renderOrder = 4;
    this._v = new THREE.Vector3();
    const adv = () => this.advance();
    this.el.subs.addEventListener('click', adv);
    this.el.subs.addEventListener('touchstart', (e) => { e.preventDefault(); adv(); }, { passive: false });
  }
  attach(scene) { scene.add(this.beacon); }

  loading(p, text) { this.el.loadBar.style.width = Math.round(p * 100) + '%'; if (text) this.el.loadText.textContent = text; }
  hideLoading() { this.el.loading.classList.add('gone'); setTimeout(() => (this.el.loading.style.display = 'none'), 900); }

  setObjective(tag, text) {
    this.el.chapterTag.textContent = tag || '';
    if (this.el.objText.textContent !== text) {
      this.el.objText.textContent = text || '';
      this.el.objText.classList.remove('pulse'); void this.el.objText.offsetWidth; this.el.objText.classList.add('pulse');
    }
  }
  setMarker(pos, label = '') {
    this.markerPos = pos ? pos.clone() : null; this.markerLabel = label;
    this.beacon.visible = !!pos;
    if (pos) this.beacon.position.set(pos.x, pos.y + 34, pos.z);
  }
  toast(text, dur = 5) { this.el.toast.innerHTML = text; this.el.toast.classList.add('on'); this.toastT = dur; }
  prompt(text) {
    if (text) { if (this.el.prompt.dataset.t !== text) { this.el.prompt.dataset.t = text; this.el.prompt.innerHTML = `<b>${G.input.isTouch ? 'E' : 'E'}</b> ${text}`; } this.el.prompt.classList.add('on'); }
    else this.el.prompt.classList.remove('on');
  }
  bark(name, text, dur = 4) {
    this.el.barkName.textContent = name; this.el.barkText.textContent = text;
    this.el.bark.classList.add('on'); this.barkT = dur;
  }
  hurt() { this.hurtV = 1; }

  // blocking dialogue line; resolves when the player advances
  say(name, text) {
    return new Promise((res) => {
      this.el.bark.classList.remove('on');
      this.el.subs.classList.add('on');
      this.el.subName.textContent = name;
      this.el.subText.textContent = '';
      this.el.subHint.style.opacity = 0;
      let i = 0;
      clearInterval(this.typing);
      this.full = text;
      this.typing = setInterval(() => {
        i += 2;
        this.el.subText.textContent = text.slice(0, i);
        if (i >= text.length) { clearInterval(this.typing); this.typing = null; this.el.subHint.style.opacity = 1; }
      }, 22);
      G.audio?.sfx('page');
      this.subResolve = res;
      this.subAt = performance.now();
    });
  }
  advance() {
    if (!this.subResolve) return false;
    if (performance.now() - this.subAt < 250) return true;
    if (this.typing) { clearInterval(this.typing); this.typing = null; this.el.subText.textContent = this.full; this.el.subHint.style.opacity = 1; return true; }
    const r = this.subResolve; this.subResolve = null;
    this.el.subs.classList.remove('on');
    r();
    return true;
  }
  cancelSay() { clearInterval(this.typing); this.typing = null; this.subResolve = null; this.el.subs.classList.remove('on'); }

  letterbox(on) { document.body.classList.toggle('cine', on); }
  fade(to, dur = 1) {
    this.el.fade.style.transition = `opacity ${dur}s ease`;
    this.el.fade.style.opacity = to;
    return new Promise((r) => setTimeout(r, dur * 1000 + 30));
  }
  card(small, big, sub = '', dur = 4) {
    this.el.cardSmall.textContent = small; this.el.cardBig.textContent = big; this.el.cardSub.textContent = sub;
    this.el.card.classList.add('on');
    return new Promise((r) => setTimeout(() => { this.el.card.classList.remove('on'); setTimeout(r, 900); }, dur * 1000));
  }
  showDead(text) { this.el.deadText.textContent = text; this.el.dead.classList.add('on'); }
  hideDead() { this.el.dead.classList.remove('on'); }
  setHud(v) { this.hudHidden = !v; document.body.classList.toggle('nohud', !v); }

  update(dt) {
    const p = G.player, cam = G.camera;
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) this.el.toast.classList.remove('on'); }
    if (this.barkT > 0) { this.barkT -= dt; if (this.barkT <= 0) this.el.bark.classList.remove('on'); }
    this.hurtV = Math.max(0, this.hurtV - dt * 1.4);
    this.el.hp.style.width = p.health + '%';
    this.el.st.style.width = p.stamina + '%';
    const h = G.env.hour, hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
    const ap = hh >= 12 ? 'PM' : 'AM', h12 = ((hh + 11) % 12) + 1;
    this.el.clock.textContent = `${h12}:${String(mm).padStart(2, '0')} ${ap}`;
    // detection indicator
    let maxAlert = 0, hostile = false;
    for (const n of G.npcs) if (n.guard && n.active && !n.ko) { if (n.hostile) hostile = true; if (n.perceive) maxAlert = Math.max(maxAlert, n.alert); }
    const det = this.el.detect;
    if (hostile) { det.className = 'on red'; det.textContent = 'SPOTTED'; }
    else if (maxAlert > 0.05) { det.className = 'on'; det.textContent = 'SUSPICIOUS'; det.style.setProperty('--a', maxAlert); }
    else det.className = '';
    // world marker
    const mk = this.el.marker;
    if (this.markerPos && !this.hudHidden) {
      const v = this._v.copy(this.markerPos); v.y += 2.2;
      const pp = p.worldPos();
      const dist = Math.hypot(pp.x - this.markerPos.x, pp.z - this.markerPos.z);
      v.project(cam);
      let x = v.x, y = v.y;
      const behind = v.z > 1;
      if (behind) { x = -x; y = -y; }
      const off = behind || Math.abs(x) > 0.92 || Math.abs(y) > 0.86;
      if (off) { const m = Math.max(Math.abs(x) / 0.92, Math.abs(y) / 0.86, 1e-3); x /= m; y /= m; if (behind && Math.abs(y) < 0.8) y = -0.8; }
      mk.style.display = 'block';
      mk.style.transform = `translate(${(x * 0.5 + 0.5) * innerWidth}px, ${(-y * 0.5 + 0.5) * innerHeight}px)`;
      mk.classList.toggle('off', off);
      this.el.markerDist.textContent = dist > 6 ? `${Math.round(dist)} m` : '';
      this.beacon.material.opacity = clamp((dist - 8) / 40, 0, 1) * 0.22;
    } else mk.style.display = 'none';
    this.drawMap();
  }

  drawMap() {
    const W = G.world; if (!W || !W.mapImage || this.hudHidden) return;
    const ctx = this.mctx, S = 200, c = S / 2, R = 94;
    const p = G.player, pp = p.worldPos();
    const scale = p.mode === 'horse' ? 0.42 : 0.6;       // px per metre
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath(); ctx.arc(c, c, R, 0, 7); ctx.clip();
    ctx.fillStyle = '#5d8088'; ctx.fillRect(0, 0, S, S);
    ctx.translate(c, c); ctx.rotate(p.camYaw);
    const k = scale / 0.32;
    ctx.scale(k, k);
    ctx.translate(-(pp.x + 800) * 0.32, -(pp.z + 800) * 0.32);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(W.mapImage, 0, 0);
    ctx.restore();
    const cs = Math.cos(p.camYaw), sn = Math.sin(p.camYaw);
    const tm = (x, z, clampEdge) => {
      let dx = (x - pp.x) * scale, dz = (z - pp.z) * scale;
      let mx = dx * cs - dz * sn, mz = dx * sn + dz * cs;
      const l = Math.hypot(mx, mz);
      if (l > R - 6) { if (!clampEdge) return null; mx *= (R - 6) / l; mz *= (R - 6) / l; }
      return [c + mx, c + mz];
    };
    // vignette ring
    const grd = ctx.createRadialGradient(c, c, R * 0.6, c, c, R);
    grd.addColorStop(0, 'rgba(40,25,10,0)'); grd.addColorStop(1, 'rgba(40,25,10,0.45)');
    ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(c, c, R, 0, 7); ctx.fill();
    // actors
    for (const n of G.npcs) {
      if (!n.active || n.ko) continue;
      if (!(n.hostile || (n.guard && n.perceive))) continue;
      const m = tm(n.pos.x, n.pos.z, false); if (!m) continue;
      ctx.fillStyle = n.hostile ? '#d8261c' : '#e0a030';
      ctx.beginPath(); ctx.arc(m[0], m[1], 3.2, 0, 7); ctx.fill();
    }
    for (const r of W.riders) { if (!r.active) continue; const m = tm(r.pos.x, r.pos.z, true); ctx.fillStyle = '#d8261c'; ctx.beginPath(); ctx.arc(m[0], m[1], 3.6, 0, 7); ctx.fill(); }
    const icon = (pos, col, ok) => { if (!ok) return; const m = tm(pos.x, pos.z, false); if (!m) return; ctx.fillStyle = col; ctx.strokeStyle = '#1a120a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.rect(m[0] - 3, m[1] - 3, 6, 6); ctx.fill(); ctx.stroke(); };
    icon(W.boat.pos, '#6fc3d6', W.boat.usable && p.mode !== 'boat');
    icon(W.horse.pos, '#c9a070', W.horse.usable && p.mode !== 'horse');
    if (this.markerPos) {
      const m = tm(this.markerPos.x, this.markerPos.z, true);
      ctx.fillStyle = '#f2c14e'; ctx.strokeStyle = '#3a2408'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(m[0], m[1] - 6); ctx.lineTo(m[0] + 5, m[1]); ctx.lineTo(m[0], m[1] + 6); ctx.lineTo(m[0] - 5, m[1]); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // player arrow
    const a = Math.atan2(Math.sin(p.yaw) * cs - Math.cos(p.yaw) * sn, -(Math.sin(p.yaw) * sn + Math.cos(p.yaw) * cs));
    ctx.save(); ctx.translate(c, c); ctx.rotate(a);
    ctx.fillStyle = '#fff6e0'; ctx.strokeStyle = '#1a120a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(5.5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5.5, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    // north
    const nx = c + (0 * cs - (-1) * sn) * (R - 9), nz = c + (0 * sn + (-1) * cs) * (R - 9);
    ctx.fillStyle = '#f4e6c0'; ctx.font = 'bold 12px Georgia'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('N', nx, nz);
    // rim
    ctx.strokeStyle = 'rgba(244,230,192,0.85)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(c, c, R, 0, 7); ctx.stroke();
  }
}
