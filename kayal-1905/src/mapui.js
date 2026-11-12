// The survey map (press M): pan, zoom, set a waypoint, take a ferry.
import { G } from './state.js';
import { PLACES } from './places.js';
import { MISSIONS, fmtMoney } from './story.js';
import { clamp } from './util.js';

const $ = (id) => document.getElementById(id);

export class MapUI {
  constructor() {
    this.el = $('mapScreen'); this.cv = $('mapCanvas'); this.ctx = this.cv.getContext('2d'); this.side = $('mapSide');
    this.isOpen = false; this.mode = 'map'; this.zoom = 1; this.cx = 0; this.cz = 0;
    let drag = null, moved = 0;
    const pt = (e) => { const r = this.cv.getBoundingClientRect(); const t = e.touches ? e.touches[0] || e.changedTouches[0] : e; return [t.clientX - r.left, t.clientY - r.top]; };
    const down = (e) => { drag = pt(e); moved = 0; };
    const move = (e) => {
      if (!drag) return;
      const q = pt(e), s = this.scale();
      this.cx -= (q[0] - drag[0]) / s; this.cz -= (q[1] - drag[1]) / s;
      moved += Math.abs(q[0] - drag[0]) + Math.abs(q[1] - drag[1]);
      drag = q; this.clampView();
      if (e.cancelable) e.preventDefault();
    };
    const up = (e) => { if (drag && moved < 6) this.click(pt(e)); drag = null; };
    this.cv.addEventListener('mousedown', down); addEventListener('mousemove', move); addEventListener('mouseup', up);
    this.cv.addEventListener('touchstart', down, { passive: true }); this.cv.addEventListener('touchmove', move, { passive: false }); this.cv.addEventListener('touchend', up);
    this.cv.addEventListener('wheel', (e) => { this.zoom = clamp(this.zoom * (e.deltaY < 0 ? 1.15 : 0.87), 0.8, 5); this.clampView(); e.preventDefault(); }, { passive: false });
    $('mapClose').onclick = () => this.close();
  }
  scale() { const r = this.cv.getBoundingClientRect(); return Math.min(r.width, r.height) / 1640 * this.zoom; }
  clampView() { const m = 800 - 420 / this.zoom; this.cx = clamp(this.cx, -Math.max(0, m), Math.max(0, m)); this.cz = clamp(this.cz, -Math.max(0, m), Math.max(0, m)); }
  toScreen(x, z) { const r = this.cv.getBoundingClientRect(), s = this.scale(); return [r.width / 2 + (x - this.cx) * s, r.height / 2 + (z - this.cz) * s]; }
  toWorld(px, py) { const r = this.cv.getBoundingClientRect(), s = this.scale(); return [this.cx + (px - r.width / 2) / s, this.cz + (py - r.height / 2) / s]; }

  open(o = {}) {
    if (this.isOpen) return;
    this.mode = o.ferry ? 'ferry' : 'map'; this.from = o.from;
    this.isOpen = true; G.mapOpen = true;
    const pp = G.player.worldPos();
    this.zoom = o.ferry ? 1.3 : 1.7; this.cx = o.ferry ? -380 : pp.x; this.cz = o.ferry ? -60 : pp.z; this.clampView();
    this.el.classList.add('on'); document.body.classList.add('mapopen');
    G.input.enabled = false; G.input.releaseLock();
    G.audio?.sfx('page');
    this.fillSide();
  }
  close() {
    if (!this.isOpen) return;
    this.isOpen = false; G.mapOpen = false;
    this.el.classList.remove('on'); document.body.classList.remove('mapopen');
    G.input.enabled = true; G.input.requestLock();
    G.audio?.sfx('page');
  }
  fillSide() {
    const S = G.story, st = S.state;
    const nx = MISSIONS[st.done];
    const act = st.done < 4 ? 'Act I — The Red Ledger' : st.done < 9 ? 'Act II — The House of Harrow' : 'The story is told';
    const row = (a, b) => `<div class="mrow"><span>${a}</span><b>${b}</b></div>`;
    const places = PLACES.filter((p) => p.r).length;
    this.side.innerHTML = this.mode === 'ferry'
      ? `<h3>The Ferry</h3><p>Choose a jetty marked <i class="k f">⚓</i> on the map. The fare is <b>4 annas</b>.</p><p class="dim">Esc — stay here</p>`
      : `<h3>${act}</h3>
         <p>${S.mode === 'mission' ? `<b>${MISSIONS[S.mi].name}</b><br>${G.ui.el.objText.textContent}` : nx ? `Next: <b>${nx.name}</b><br><span class="dim">${nx.where}</span>` : 'Free roam.'}</p>
         <div class="msep"></div>
         ${row('Purse', fmtMoney(st.annas))}${row('Missions', `${st.done} / ${MISSIONS.length}`)}${row('Places found', `${st.places.length} / ${places}`)}${row('Ledger pages', `${st.pages.length} / 12`)}${row('Fish landed', st.fish)}${row('Cargo runs', st.jobs)}
         <div class="msep"></div>
         <div class="leg"><i class="k m">R</i> mission &nbsp; <i class="k f">⚓</i> ferry &nbsp; <i class="k b"></i> vallam<br><i class="k h"></i> Sultan &nbsp; <i class="k s">≈</i> fishing &nbsp; <i class="k w"></i> waypoint</div>
         <p class="dim">Click the map to set a waypoint · wheel to zoom · drag to pan · <b>M</b> / Esc to close</p>`;
  }
  click(q) {
    const W = G.world;
    if (this.mode === 'ferry') {
      let best = -1, bd = 22;
      W.ferries.forEach((f, i) => { const s = this.toScreen(f.pos.x, f.pos.z), d = Math.hypot(s[0] - q[0], s[1] - q[1]); if (d < bd && i !== this.from) { bd = d; best = i; } });
      if (best >= 0) { this.close(); G.act.ferryTo(best); }
      return;
    }
    const [x, z] = this.toWorld(q[0], q[1]);
    if (Math.abs(x) > 790 || Math.abs(z) > 790) return;
    const ui = G.ui;
    if (ui.waypoint && Math.hypot(ui.waypoint.x - x, ui.waypoint.z - z) * this.scale() < 14) ui.setWaypoint(null);
    else { const v = G.player.pos.clone(); v.set(x, 0, z); ui.setWaypoint(v); }
    G.audio?.sfx('ui');
  }

  draw() {
    if (!this.isOpen) return;
    const W = G.world, cv = this.cv, ctx = this.ctx, r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    if (cv.width !== Math.round(r.width * dpr) || cv.height !== Math.round(r.height * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = r.width, h = r.height, s = this.scale();
    ctx.fillStyle = '#cdbb8f'; ctx.fillRect(0, 0, w, h);
    const [x0, y0] = this.toScreen(-800, -800), sz = 1600 * s;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(W.mapImage, x0, y0, sz, sz);
    // neat-line & graticule
    ctx.strokeStyle = 'rgba(60,40,20,0.75)'; ctx.lineWidth = 2; ctx.strokeRect(x0, y0, sz, sz);
    ctx.strokeStyle = 'rgba(60,40,20,0.13)'; ctx.lineWidth = 1;
    for (let g = -600; g <= 600; g += 200) { const a = this.toScreen(g, -800), b = this.toScreen(g, 800); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); const c = this.toScreen(-800, g), d = this.toScreen(800, g); ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.stroke(); }
    // place names
    const st = G.story.state;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const p of PLACES) {
      const q = this.toScreen(p.x, p.z);
      const known = !p.r || st.places.includes(p.id);
      ctx.save(); ctx.translate(q[0], q[1]);
      if (p.vertical) ctx.rotate(-Math.PI / 2);
      const fs = (p.water || p.region) ? (p.small ? 11 : 15) : p.big ? 17 : 12.5;
      ctx.font = `${p.water || p.region ? 'italic ' : ''}${p.big ? 'bold ' : ''}${fs * clamp(0.75 + this.zoom * 0.22, 0.9, 1.5)}px Georgia, serif`;
      ctx.lineWidth = 3.2; ctx.strokeStyle = p.water ? 'rgba(150,180,180,0.6)' : 'rgba(226,210,164,0.85)';
      ctx.fillStyle = p.water ? 'rgba(36,66,78,0.8)' : known ? '#2c1a0a' : 'rgba(60,40,20,0.45)';
      const name = known ? p.name : '? ? ?';
      ctx.strokeText(name, 0, p.r && !p.region ? -13 : 0); ctx.fillText(name, 0, p.r && !p.region ? -13 : 0);
      ctx.restore();
    }
    const dot = (x, z, col, rad = 5, txt = '', tcol = '#1a120a') => {
      const q = this.toScreen(x, z);
      ctx.fillStyle = col; ctx.strokeStyle = '#1a120a'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(q[0], q[1], rad, 0, 7); ctx.fill(); ctx.stroke();
      if (txt) { ctx.fillStyle = tcol; ctx.font = `bold ${rad * 1.35}px Georgia`; ctx.fillText(txt, q[0], q[1] + 0.5); }
      return q;
    };
    for (const f of W.fishSpots) dot(f.x, f.z, '#9fc7c9', 6, '≈');
    W.ferries.forEach((f, i) => { const hot = this.mode === 'ferry' && i !== this.from; dot(f.pos.x, f.pos.z, hot ? '#ffd98a' : '#e6dcc0', hot ? 11 + Math.sin(G.time * 5) * 1.5 : 7, '⚓'); });
    if (W.boatsUnlocked) for (const b of W.vallams) dot(b.pos.x, b.pos.z, '#6fc3d6', 4);
    if (W.horse.usable) dot(W.horse.pos.x, W.horse.pos.z, '#c9a070', 4.5);
    const S = G.story;
    if (S.next) dot(S.next.pos.x, S.next.pos.z, '#f2c14e', 11, S.next.def.letter);
    else if (G.ui.markerPos) { const q = this.toScreen(G.ui.markerPos.x, G.ui.markerPos.z); ctx.fillStyle = '#f2c14e'; ctx.strokeStyle = '#3a2408'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(q[0], q[1] - 9); ctx.lineTo(q[0] + 7, q[1]); ctx.lineTo(q[0], q[1] + 9); ctx.lineTo(q[0] - 7, q[1]); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    if (G.ui.waypoint) dot(G.ui.waypoint.x, G.ui.waypoint.z, '#58b7e8', 7);
    // the player
    const pl = G.player, pp = pl.worldPos(), q = this.toScreen(pp.x, pp.z);
    ctx.save(); ctx.translate(q[0], q[1]); ctx.rotate(Math.PI - pl.yaw);
    ctx.fillStyle = '#fff6e0'; ctx.strokeStyle = '#1a120a'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(7.5, 8); ctx.lineTo(0, 4); ctx.lineTo(-7.5, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    // cartouche, compass, scale
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(226,210,164,0.86)'; ctx.fillRect(16, 14, 318, 58); ctx.strokeStyle = 'rgba(60,40,20,0.7)'; ctx.lineWidth = 1; ctx.strokeRect(16.5, 14.5, 318, 58); ctx.strokeRect(20.5, 18.5, 310, 50);
    ctx.fillStyle = '#2c1a0a'; ctx.font = 'bold 15px Georgia'; ctx.fillText('A SURVEY OF THE KAYAL COUNTRY', 32, 36);
    ctx.font = 'italic 12px Georgia'; ctx.fillText('Travancore · surveyed in the monsoon of 1905', 32, 56);
    const cx = 62, cy = h - 70;
    ctx.strokeStyle = '#2c1a0a'; ctx.fillStyle = '#2c1a0a'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(cx, cy, 26, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - 34); ctx.lineTo(cx + 6, cy); ctx.lineTo(cx, cy + 34); ctx.lineTo(cx - 6, cy); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - 34); ctx.lineTo(cx + 6, cy); ctx.lineTo(cx - 6, cy); ctx.closePath(); ctx.fill();
    ctx.textAlign = 'center'; ctx.font = 'bold 13px Georgia'; ctx.fillText('N', cx, cy - 44);
    const bar = 200 * s; ctx.fillRect(110, h - 44, bar, 3); ctx.fillRect(110, h - 50, 1.5, 9); ctx.fillRect(110 + bar - 1.5, h - 50, 1.5, 9);
    ctx.font = '11px Georgia'; ctx.fillText('200 m  (one furlong)', 110 + bar / 2, h - 58);
  }
}
