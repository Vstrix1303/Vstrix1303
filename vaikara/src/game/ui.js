// HUD: area banner, compass, clock, map overlay (click to travel), travel
// list, help, graphics preset and debug stats.
import * as THREE from 'three/webgpu';
import { G } from '../state.js';
import { Input } from './input.js';
import { PLACES, toMap, toWorld, placeById } from '../world/layout.js';
import { getHeight, W } from '../world/data.js';

const $ = (id) => document.getElementById(id);
const fmt = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;

export class UI {
  constructor({ player, fly, sky, camera }) {
    Object.assign(this, { player, fly, sky, camera });
    this.started = false;
    this.area = null; this.bannerT = 0;
    this.mapImg = new Image();
    this.mapImg.src = `${G.base}baked/map.jpg`;
    // compass strip
    const marks = ['N', '·', 'NE', '·', 'E', '·', 'SE', '·', 'S', '·', 'SW', '·', 'W', '·', 'NW', '·'];
    $('compassStrip').innerHTML = [...marks, ...marks, ...marks].map((m) => `<b class="${m.length && m !== '·' ? 'c' : ''}">${m}</b>`).join('');
    // travel list
    const grid = $('tpGrid');
    for (const p of [...PLACES].sort((a, b) => a.name.localeCompare(b.name))) {
      const b = document.createElement('button');
      b.innerHTML = `${p.name}<small>${p.sub}</small>`;
      b.onclick = () => { this.travel(p.x, p.z); this.close(); };
      grid.appendChild(b);
    }
    const mc = $('mapCanvas');
    mc.addEventListener('click', (e) => {
      const r = mc.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width * 1536, py = (e.clientY - r.top) / r.height * 1024;
      const [x, z] = toWorld(px, py);
      this.travel(x, z); this.close();
    });
    for (const id of ['mapPanel', 'tpPanel']) $(id).addEventListener('click', (e) => { if (e.target.id === id) this.close(); });
  }

  travel(x, z) {
    // never drop the traveller into deep water: find nearby land
    let bx = x, bz = z;
    const deck = G.colliders.deckHeight(x, z, 1e4);
    if (getHeight(x, z) < 0.3 && !(deck > -1e9)) {
      outer: for (let r = 10; r < 600; r += 10) for (let a = 0; a < 6.283; a += 0.25) {
        const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        if (getHeight(px, pz) > 0.6) { bx = px; bz = pz; break outer; }
      }
    }
    // keep out of the Vellar stream (its water sits above sea level)
    const vel = W.meta.streams.vellar;
    for (let k = 0; k < 3; k++) for (let i = 1; i < vel.length; i++) {
      const [x0, z0, , hw] = vel[i];
      const d = Math.hypot(bx - x0, bz - z0);
      if (d < hw + 8) {
        const [x1, z1] = vel[i - 1];
        let nx = -(z0 - z1), nz = x0 - x1; const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
        if ((bx - x0) * nx + (bz - z0) * nz < 0) { nx = -nx; nz = -nz; }
        bx = x0 + nx * (hw + 14); bz = z0 + nz * (hw + 14);
      }
    }
    if (this.fly.enabled) { this.fly.pos.set(bx, getHeight(bx, bz) + 40, bz); }
    else this.player.teleport(bx, bz);
  }

  open(id) {
    this.close();
    $(id).classList.remove('hidden');
    this.panel = id;
    Input.suspended = true; Input.release();
    if (id === 'mapPanel') this.drawMap();
  }
  close() {
    if (!this.panel) return;
    $(this.panel).classList.add('hidden');
    this.panel = null;
    Input.suspended = false;
  }

  drawMap() {
    const c = $('mapCanvas'), x = c.getContext('2d');
    const draw = () => {
      x.drawImage(this.mapImg, 0, 0, 1536, 1024);
      // parchment wash + border
      x.fillStyle = 'rgba(232,212,168,0.18)'; x.fillRect(0, 0, 1536, 1024);
      x.strokeStyle = 'rgba(60,40,20,0.8)'; x.lineWidth = 6; x.strokeRect(10, 10, 1516, 1004);
      x.font = 'italic 34px Palatino, Georgia, serif'; x.fillStyle = 'rgba(40,60,80,0.75)'; x.textAlign = 'center';
      x.fillText('A R A B I A N   S E A', 120, 470);
      x.font = '48px Palatino, Georgia, serif'; x.fillStyle = 'rgba(50,30,15,0.85)';
      x.fillText('VAIKARA', 170, 80);
      x.font = 'italic 18px Palatino, Georgia, serif'; x.fillText('Malabar Coast, circa 1905', 170, 106);
      x.textAlign = 'center';
      for (const p of PLACES) {
        const [mx, my] = toMap(p.x, p.z);
        x.fillStyle = 'rgba(60,30,10,0.9)';
        x.beginPath(); x.arc(mx, my, 4, 0, 7); x.fill();
        x.font = `${p.r > 400 ? 'bold 19px' : '15px'} Palatino, Georgia, serif`;
        x.lineWidth = 4; x.strokeStyle = 'rgba(240,228,200,0.85)';
        x.strokeText(p.name.toUpperCase(), mx, my - 9); x.fillStyle = 'rgba(45,28,12,0.95)'; x.fillText(p.name.toUpperCase(), mx, my - 9);
      }
      // the traveller
      const pos = this.fly.enabled ? this.fly.pos : this.player.pos;
      const [px, py] = toMap(pos.x, pos.z);
      const yaw = this.fly.enabled ? this.fly.yaw : this.player.yaw + Math.PI;
      x.save(); x.translate(px, py); x.rotate(-yaw);
      x.fillStyle = '#b8241a'; x.strokeStyle = '#fff'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(0, -14); x.lineTo(9, 10); x.lineTo(0, 5); x.lineTo(-9, 10); x.closePath(); x.fill(); x.stroke();
      x.restore();
      // compass rose
      x.save(); x.translate(110, 900); x.strokeStyle = 'rgba(50,30,15,0.8)'; x.fillStyle = 'rgba(50,30,15,0.8)';
      x.beginPath(); x.moveTo(0, -60); x.lineTo(10, 0); x.lineTo(0, 60); x.lineTo(-10, 0); x.closePath(); x.fill();
      x.beginPath(); x.moveTo(-60, 0); x.lineTo(0, 10); x.lineTo(60, 0); x.lineTo(0, -10); x.closePath(); x.stroke();
      x.font = '22px Palatino, Georgia, serif'; x.fillText('N', 0, -68); x.restore();
    };
    if (this.mapImg.complete) draw(); else this.mapImg.onload = draw;
  }

  banner(p) {
    $('bannerName').textContent = p.name;
    $('bannerSub').textContent = p.sub;
    $('banner').classList.add('on');
    this.bannerT = 4.5;
    $('whereName').textContent = p.name; $('whereSub').textContent = p.sub;
  }

  update(dt) {
    // keys
    if (Input.hit('KeyM')) this.panel === 'mapPanel' ? this.close() : this.open('mapPanel');
    if (Input.hit('KeyT')) this.panel === 'tpPanel' ? this.close() : this.open('tpPanel');
    if (Input.hit('Escape')) this.close();
    if (Input.hit('KeyH')) $('help').classList.toggle('min');
    if (Input.hit('KeyU')) document.body.classList.toggle('nohud');
    if (Input.hit('KeyF')) {
      const on = !this.fly.enabled;
      this.fly.enable(on, this.camera);
      if (!on) this.player.teleport(this.fly.pos.x, this.fly.pos.z);
    }
    if (Input.down('BracketRight')) this.sky.setHour(G.hour + dt * 2.5);
    if (Input.down('BracketLeft')) this.sky.setHour(G.hour - dt * 2.5);
    if (Input.hit('KeyP')) G.timeScale = G.timeScale ? 0 : 1 / 40;
    if (Input.hit('KeyR') && this.weather) { this.weather.cycle(); this.toast?.(`Weather: ${this.weather.state}`); }
    if (Input.hit('KeyG')) {
      const order = ['low', 'laptop', 'medium', 'high', 'ultra'];
      const next = order[(order.indexOf(G.quality) + 1) % order.length];
      try { localStorage.setItem('vaikara.quality', next); } catch { /* ignore */ }
      const q = new URLSearchParams(location.search); q.set('q', next); location.search = q.toString();
    }
    // area detection
    const pos = this.fly.enabled ? this.fly.pos : this.player.pos;
    let best = null, bd = Infinity;
    for (const p of PLACES) {
      const d = Math.hypot(pos.x - p.x, pos.z - p.z) / p.r;
      if (d < 1 && d < bd) { bd = d; best = p; }
    }
    if (best && best !== this.area && this.started) this.banner(best);
    if (best) this.area = best;
    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) $('banner').classList.remove('on'); }
    // compass: heading of the camera
    const d = this.camera.getWorldDirection(this._v || (this._v = new THREE.Vector3()));
    const heading = Math.atan2(d.x, -d.z); // 0 = north
    const deg = ((heading * 180 / Math.PI) % 360 + 360) % 360;
    const strip = $('compassStrip');
    const W = 40 * 16;
    const wrap = $('compass').clientWidth;
    strip.style.left = `${wrap / 2 - 20 - (deg / 360) * W - W}px`;
    $('clockTime').textContent = fmt(G.hour) + (G.timeScale ? '' : ' ·') + (this.weather ? ` · ${this.weather.state}` : '');
  }

  stats(fps, info, people = 0) {
    $('stats').textContent = `${fps.toFixed(0)} fps · ${G.backend} · ${G.quality}\n${(info.render.triangles / 1e6).toFixed(2)}M tris · ${info.render.calls} calls · ${people} people`;
  }
}
void placeById;
