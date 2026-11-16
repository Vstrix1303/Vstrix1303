// The weapon wheel (hold Tab, point with the mouse, let go), number keys 1–7, the aiming dot and the
// revolver's rounds. Choosing is only possible on foot and outside cutscenes.
import { G } from './state.js';
import { WEAPONS, ORDER } from './weapons.js';

const CSS = `
#wheel{position:fixed;inset:0;z-index:26;display:none;align-items:center;justify-content:center;background:radial-gradient(circle,rgba(8,6,4,.35),rgba(8,6,4,.72));pointer-events:none}
#wheel.on{display:flex}
#wheel .wh-ring{position:relative;width:min(520px,80vmin);height:min(520px,80vmin)}
#wheel .wh-slot{position:absolute;width:92px;height:92px;margin:-46px 0 0 -46px;border-radius:50%;border:3px solid #0b0806;background:rgba(20,14,8,.82);display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 1px rgba(244,230,192,.25);transition:transform .08s}
#wheel .wh-slot svg{width:58px;height:58px}
#wheel .wh-slot.off{opacity:.25}
#wheel .wh-slot.cur{box-shadow:0 0 0 2px #9fbf8a}
#wheel .wh-slot.sel{transform:scale(1.18);background:rgba(244,230,192,.9);box-shadow:0 0 0 2px #e9c15a}
#wheel .wh-n{position:absolute;right:4px;bottom:2px;font:800 12px var(--hud);color:#e9c15a;-webkit-text-stroke:3px #0b0806;paint-order:stroke fill}
#wheel .wh-mid{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:46%;text-align:center}
#wheel .wh-name{font:800 22px var(--hud);color:#f4e6c0;-webkit-text-stroke:4px #0b0806;paint-order:stroke fill}
#wheel .wh-ml{font-size:15px;color:#e9c15a;margin:2px 0 6px}
#wheel .wh-desc{font-size:13px;line-height:1.4;color:#d9cca6;text-shadow:0 1px 3px #000}
#xhair{position:fixed;left:50%;top:50%;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;background:#f4e6c0;box-shadow:0 0 0 2px #0b0806;z-index:11;display:none;pointer-events:none}
#xhair.on{display:block}
#ammo{position:absolute;left:4px;bottom:2px;font:800 13px var(--hud);color:#f4e6c0;-webkit-text-stroke:3px #0b0806;paint-order:stroke fill;pointer-events:none}
#equip{position:relative}
`;

export function setupWheel(EQUIP) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const el = document.createElement('div'); el.id = 'wheel';
  el.innerHTML = '<div class="wh-ring"><div class="wh-mid"><div class="wh-name"></div><div class="wh-ml"></div><div class="wh-desc"></div></div></div>';
  document.body.appendChild(el);
  const xh = document.createElement('div'); xh.id = 'xhair'; document.body.appendChild(xh);
  const ring = el.querySelector('.wh-ring');
  const slots = ORDER.map((k, i) => {
    const a = -Math.PI / 2 + i / ORDER.length * Math.PI * 2;
    const d = document.createElement('div'); d.className = 'wh-slot';
    d.style.left = 50 + Math.cos(a) * 38 + '%'; d.style.top = 50 + Math.sin(a) * 38 + '%';
    d.innerHTML = (EQUIP[WEAPONS[k].icon] || '') + `<span class="wh-n">${i + 1}</span>`;
    ring.appendChild(d);
    return { k, a, d };
  });
  const owned = (k) => G.story?.state.weapons.includes(k);
  const canChoose = () => G.started && !G.paused && !G.mapOpen && !G.shopOpen && !G.story?.busy && G.player.mode === 'foot' && !G.player.locked && G.player.health > 0;
  let sel = -1, mx = 0, my = 0;
  const show = (i) => {
    sel = i;
    slots.forEach((s, k) => { s.d.classList.toggle('sel', k === i); s.d.classList.toggle('off', !owned(s.k)); s.d.classList.toggle('cur', G.player.weapon === s.k); });
    const W = WEAPONS[slots[i >= 0 ? i : ORDER.indexOf(G.player.weapon)].k];
    const has = owned(slots[i >= 0 ? i : 0].k) || i < 0;
    el.querySelector('.wh-name').textContent = has ? W.name : '— not owned —';
    el.querySelector('.wh-ml').textContent = has ? W.ml : W.name;
    el.querySelector('.wh-desc').textContent = has ? W.desc + (W.gun ? `  Rounds ${G.player.rounds} · spare ${G.story.state.ammo || 0}.` : '') : 'Sold by ' + ({ kollan: 'the blacksmith in the bazaar', kalari: 'the kalari master by the banyan', gun: 'a trader behind the Puthenthura godown' }[W.at] || '—') + '.';
  };
  const equip = (k) => {
    if (!owned(k) || G.player.weapon === k) return;
    G.player.setWeapon(k); G.story.state.weapon = k; G.story.save();
    G.audio?.sfx('swing', 0.35);
  };
  G.equip = equip;
  G.wheelOpen = false;
  const open = () => { if (G.wheelOpen || !canChoose()) return; G.wheelOpen = true; mx = my = 0; el.classList.add('on'); show(-1); };
  const close = () => { if (!G.wheelOpen) return; G.wheelOpen = false; el.classList.remove('on'); if (sel >= 0) equip(slots[sel].k); };
  addEventListener('keydown', (e) => {
    if (e.code === 'Tab') { e.preventDefault(); if (!e.repeat) open(); return; }
    const m = /^Digit([1-7])$/.exec(e.code);
    if (m && canChoose() && !e.repeat) { const k = ORDER[+m[1] - 1]; if (owned(k)) equip(k); else G.ui.toast(`<b>${WEAPONS[k].name}</b> — not owned yet.`, 2); }
  });
  addEventListener('keyup', (e) => { if (e.code === 'Tab') close(); });
  addEventListener('blur', close);
  addEventListener('mousemove', (e) => {
    if (!G.wheelOpen) return;
    mx += e.movementX || 0; my += e.movementY || 0;
    const l = Math.hypot(mx, my); if (l > 160) { mx *= 160 / l; my *= 160 / l; }
    if (l < 30) return;
    const a = Math.atan2(my, mx);
    let bi = 0, bd = 9;
    slots.forEach((s, i) => { let d = Math.abs(((a - s.a) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI); if (d < bd) { bd = d; bi = i; } });
    if (bi !== sel) { show(bi); G.audio?.sfx('ui'); }
  });
  // without a mouse: cycle through what you own
  G.cycleWeapon = () => { if (!canChoose()) return; const own = ORDER.filter(owned); equip(own[(own.indexOf(G.player.weapon) + 1) % own.length]); G.ui.toast(`<b>${G.player.wdef.name}</b>`, 1.5); };

  // the aiming dot and the rounds, drawn every frame
  let ammoEl = null;
  G.updaters.push(() => {
    const p = G.player;
    xh.classList.toggle('on', !!p.aiming && !G.ui.hudHidden);
    const gun = p.wdef?.gun && p.mode === 'foot' && p.stick.visible;
    if (gun && !ammoEl) { const eq = document.getElementById('equip'); ammoEl = document.createElement('div'); ammoEl.id = 'ammo'; eq.appendChild(ammoEl); }
    if (ammoEl) {
      if (!gun || !document.getElementById('equip').contains(ammoEl)) { ammoEl.remove(); ammoEl = null; }
      else ammoEl.textContent = p.reloadT > 0 ? '…' : `${p.rounds}/${G.story.state.ammo || 0}`;
    }
  });
}
