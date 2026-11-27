// The shop counter: a panel at the right of the screen with the keeper's wares in tabs, while the
// camera turns to look at Madhavan so anything to wear can be seen on him before it is bought.
// The same panel serves the satchel (what he carries), the barber and the weapon-sellers.
import * as THREE from 'three';
import { G } from './state.js';
import { fmtMoney } from './story.js';
import { segmentBlocked, pointInBox } from './physics.js';
import { getHeight } from './heightfield.js';

const CSS = `
#shop{position:fixed;top:0;right:0;bottom:0;width:min(440px,92vw);z-index:36;display:none;flex-direction:column;background:linear-gradient(90deg,rgba(10,7,4,.0),rgba(10,7,4,.86) 9%,rgba(10,7,4,.93));padding:26px 26px 18px 52px;color:#eadfbf;font-family:var(--serif)}
#shop.on{display:flex}
#shop .sh-title{font-family:var(--hud);font-weight:800;font-size:30px;letter-spacing:.03em;color:#f4e6c0;-webkit-text-stroke:5px #0b0806;paint-order:stroke fill;line-height:1.05}
#shop .sh-ml{font-size:16px;color:#e9c15a;margin:2px 0 2px}
#shop .sh-sub{font-size:14px;color:#b9ab86;font-style:italic;margin-bottom:12px;min-height:18px}
#shop .sh-tabs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
#shop .sh-tab{font:700 12px var(--hud);letter-spacing:.12em;text-transform:uppercase;padding:6px 10px;border:1px solid rgba(244,230,192,.3);color:#d9cca6;cursor:pointer;background:none;min-width:0;border-radius:2px}
#shop .sh-tab.on{background:#f4e6c0;color:#0b0806;border-color:#f4e6c0}
#shop .sh-list{flex:1;overflow:auto;margin-right:-10px;padding-right:10px}
#shop .sh-row{display:flex;align-items:center;gap:10px;padding:9px 10px;border-left:3px solid transparent;cursor:pointer;border-radius:2px}
#shop .sh-row:hover{background:rgba(244,230,192,.07)}
#shop .sh-row.sel{background:rgba(244,230,192,.13);border-left-color:#e9c15a}
#shop .sh-sw{width:22px;height:22px;border-radius:3px;border:2px solid #0b0806;flex:none;box-shadow:0 0 0 1px rgba(244,230,192,.35)}
#shop .sh-name{flex:1;font-size:16px}
#shop .sh-tag{font:700 12px var(--hud);letter-spacing:.06em;color:#e9c15a;white-space:nowrap}
#shop .sh-tag.own{color:#9fbf8a}
#shop .sh-tag.worn{color:#0b0806;background:#9fbf8a;padding:2px 6px;border-radius:2px}
#shop .sh-desc{min-height:66px;font-size:14px;line-height:1.45;color:#d9cca6;border-top:1px solid rgba(244,230,192,.2);padding-top:10px;margin-top:8px}
#shop .sh-stat{font:700 12px var(--hud);letter-spacing:.06em;color:#9fbf8a;margin-top:4px}
#shop .sh-foot{display:flex;align-items:center;gap:10px;margin-top:10px}
#shop .sh-money{flex:1;white-space:nowrap;font:800 19px var(--hud);color:#e9c15a;-webkit-text-stroke:4px #0b0806;paint-order:stroke fill}
#shop .sh-btn{font:800 14px var(--hud);letter-spacing:.08em;padding:9px 16px;min-width:0;border-radius:2px;cursor:pointer;border:0;background:#f4e6c0;color:#0b0806}
#shop .sh-btn[disabled]{opacity:.35;cursor:default}
#shop .sh-btn.ghost{background:none;color:#d9cca6;border:1px solid rgba(244,230,192,.35)}
#shop .sh-keys{font-size:11px;letter-spacing:.08em;color:#8f8366;margin-top:8px}
@media (max-width:760px){#shop{width:100vw;top:auto;height:62vh;background:rgba(10,7,4,.92);padding:16px}}
`;
const hex = (c) => '#' + (c >>> 0).toString(16).padStart(6, '0');

export class Shop {
  constructor() {
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const el = this.el = document.createElement('div'); el.id = 'shop';
    el.innerHTML = '<div class="sh-title"></div><div class="sh-ml"></div><div class="sh-sub"></div><div class="sh-tabs"></div><div class="sh-list"></div><div class="sh-desc"></div><div class="sh-foot"><div class="sh-money"></div><button class="sh-btn ghost sh-close">Leave</button><button class="sh-btn sh-act"></button></div><div class="sh-keys">W/S choose · A/D tab · E / Enter buy or use · Esc leave</div>';
    document.body.appendChild(el);
    this.q = (s) => el.querySelector(s);
    this.q('.sh-close').onclick = () => this.close();
    this.q('.sh-act').onclick = () => this.act();
    this.isOpen = false;
    addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      const k = e.code;
      if (k === 'Escape' || k === 'Backspace') { e.preventDefault(); e.stopImmediatePropagation(); this.close(); }
      else if (k === 'KeyS' || k === 'ArrowDown') { e.preventDefault(); this.select(this.sel + 1); }
      else if (k === 'KeyW' || k === 'ArrowUp') { e.preventDefault(); this.select(this.sel - 1); }
      else if (k === 'KeyD' || k === 'ArrowRight') { e.preventDefault(); this.tab(this.ti + 1); }
      else if (k === 'KeyA' || k === 'ArrowLeft') { e.preventDefault(); this.tab(this.ti - 1); }
      else if ((k === 'KeyE' || k === 'Enter' || k === 'Space') && !e.repeat) { e.preventDefault(); this.act(); }
    }, true);
  }

  // o: { title, ml, sub, tabs: [{ name, items: () => [...] }], camera: true, onClose }
  // item: { name, desc, price, swatch, tag(): {text, cls}, can(): bool, label(): str, act(), preview() }
  open(o) {
    if (this.isOpen) this.close(true);
    this.o = o; this.isOpen = true; this.ti = 0; this.sel = 0;
    G.shopOpen = true; G.uiT = performance.now();
    const p = G.player;
    this.wasLocked = p.locked; p.locked = true;
    G.input.enabled = false; G.input.releaseLock();
    document.body.classList.add('shopopen', 'nohud');
    this.q('.sh-title').textContent = o.title; this.q('.sh-ml').textContent = o.ml || ''; this.q('.sh-sub').textContent = (o.sub || '') + (o.camera !== false && G.priceNote ? G.priceNote() : '');
    if (o.camera && p.mode === 'foot') {
      // a portrait of Madhavan, standing to the left of the panel: he turns to the most open side
      let best = null;
      for (const a of [Math.PI, Math.PI - 0.7, Math.PI + 0.7, Math.PI / 2, -Math.PI / 2, 0.6, -0.6, 0]) {
        const y = p.yaw + a, cx = p.pos.x + Math.sin(y) * 2.9, cz = p.pos.z + Math.cos(y) * 2.9;
        if (segmentBlocked(p.pos.x, p.pos.z, cx, cz) || pointInBox(cx, cz, 0.35) || getHeight(cx, cz) > p.pos.y + 0.9) continue;
        best = y; break;
      }
      if (best != null) { p.yaw = best; p.root.rotation.y = best; }
      const f = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw)), r = new THREE.Vector3(Math.cos(p.yaw), 0, -Math.sin(p.yaw));
      const c = p.pos.clone().addScaledVector(f, 2.9).addScaledVector(r, -0.55); c.y = p.pos.y + 1.32;
      const look = p.pos.clone().addScaledVector(r, 0.62); look.y = p.pos.y + 1.0;
      p.setCine({ hard: true, pos: c, look, fov: 40 });
      this.cam = true;
    } else this.cam = false;
    this.el.classList.add('on');
    this.drawTabs(); this.tab(0);
    G.audio?.sfx('page');
  }
  close(quiet) {
    if (!this.isOpen) return;
    this.isOpen = false; G.shopOpen = false; G.uiT = performance.now();
    this.el.classList.remove('on');
    document.body.classList.remove('shopopen');
    if (!G.ui.hudHidden) document.body.classList.remove('nohud');
    const p = G.player;
    if (this.cam) p.setCine(null);
    p.locked = this.wasLocked;
    G.input.enabled = true; if (!quiet) G.input.requestLock();
    const o = this.o; this.o = null;
    o?.onClose?.();
    if (!quiet) G.audio?.sfx('page');
  }
  drawTabs() {
    const box = this.q('.sh-tabs'); box.innerHTML = '';
    if (this.o.tabs.length < 2) { box.style.display = 'none'; return; }
    box.style.display = '';
    this.o.tabs.forEach((t, i) => { const b = document.createElement('button'); b.className = 'sh-tab'; b.textContent = t.name; b.onclick = () => this.tab(i); box.appendChild(b); });
  }
  tab(i) {
    const n = this.o.tabs.length; this.ti = ((i % n) + n) % n;
    this.q('.sh-tabs').querySelectorAll('.sh-tab').forEach((b, k) => b.classList.toggle('on', k === this.ti));
    this.items = this.o.tabs[this.ti].items();
    const start = Math.max(0, this.items.findIndex((it) => it.tag && it.tag().cls === 'worn'));
    this.render(); this.select(start, true);
  }
  render() {
    const list = this.q('.sh-list'); list.innerHTML = '';
    if (!this.items.length) { list.innerHTML = '<div class="sh-row" style="cursor:default;color:#8f8366">' + (this.o.tabs[this.ti].empty || 'Nothing here.') + '</div>'; }
    this.items.forEach((it, i) => {
      const row = document.createElement('div'); row.className = 'sh-row';
      const tag = it.tag ? it.tag() : { text: fmtMoney(it.price), cls: '' };
      row.innerHTML = (it.swatch != null ? `<span class="sh-sw" style="background:${hex(it.swatch)}"></span>` : '') + `<span class="sh-name"></span><span class="sh-tag ${tag.cls || ''}"></span>`;
      row.querySelector('.sh-name').textContent = it.name; row.querySelector('.sh-tag').textContent = tag.text;
      row.onclick = () => this.select(i);
      row.ondblclick = () => { this.select(i); this.act(); };
      list.appendChild(row);
    });
    this.q('.sh-money').textContent = fmtMoney(G.story.state.annas);
  }
  select(i, first) {
    if (!this.items.length) { this.q('.sh-desc').textContent = ''; const b = this.q('.sh-act'); b.textContent = '—'; b.disabled = true; return; }
    const n = this.items.length; this.sel = ((i % n) + n) % n;
    const rows = this.q('.sh-list').querySelectorAll('.sh-row');
    rows.forEach((r, k) => r.classList.toggle('sel', k === this.sel));
    rows[this.sel]?.scrollIntoView({ block: 'nearest' });
    const it = this.items[this.sel];
    const d = this.q('.sh-desc'); d.textContent = it.desc || '';
    if (it.stat) { const s = document.createElement('div'); s.className = 'sh-stat'; s.textContent = it.stat; d.appendChild(s); }
    const b = this.q('.sh-act'); b.textContent = it.label ? it.label() : 'Buy'; b.disabled = it.can ? !it.can() : false;
    if (it.preview) it.preview();
    if (!first) G.audio?.sfx('ui');
  }
  act() {
    const it = this.items && this.items[this.sel]; if (!it) return;
    if (it.can && !it.can()) { G.audio?.sfx('ui'); return; }
    const keep = this.sel;
    it.act();
    if (!this.isOpen) return;
    this.items = this.o.tabs[this.ti].items();
    this.render(); this.select(Math.min(keep, this.items.length - 1), true);
  }
  refresh() { if (this.isOpen) { this.items = this.o.tabs[this.ti].items(); this.render(); this.select(this.sel, true); } }
}
