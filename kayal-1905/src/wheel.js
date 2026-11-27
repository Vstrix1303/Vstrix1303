// The weapon wheel, in the manner of the big westerns: hold Tab and the world slows; eight segments in a
// ring — bare hands, the melee weapon, the five guns and the satchel — the one under the mouse lights up and
// its name, rounds and handling show in the middle. Let go to draw it. 1–7 choose directly; the mouse wheel
// over the melee segment cycles the kalari weapons you own.
// Also here: the reticle (red over an enemy, a cross when a shot lands), the weapon and its rounds at the
// lower right, and the telescope's view.
import { G } from './state.js';
import { WEAPONS, GUNS, MELEE, MELEE_ORDER, gunRatings } from './weapons.js';

const CSS = `
#wheel{position:fixed;inset:0;z-index:26;display:none;align-items:center;justify-content:center;background:radial-gradient(circle,rgba(0,0,0,.15) 20%,rgba(0,0,0,.62) 70%);pointer-events:none}
#wheel.on{display:flex}
#wheel svg.ring{width:min(600px,86vmin);height:min(600px,86vmin);overflow:visible}
#wheel .seg{fill:rgba(12,10,8,.72);stroke:rgba(244,236,214,.28);stroke-width:1.5;transition:fill .08s}
#wheel .seg.sel{fill:rgba(240,234,220,.88)}
#wheel .seg.off{fill:rgba(12,10,8,.4)}
#wheel .seg.cur{stroke:#c9302c;stroke-width:3}
#wheel .ico{pointer-events:none}
#wheel .ico.off{opacity:.25}
#wheel .lbl{font:700 13px var(--hud);fill:#f4ecd6;text-anchor:middle;letter-spacing:.08em;paint-order:stroke fill;stroke:#0b0806;stroke-width:3px}
#wheel .lbl.dk{fill:#1a140e;stroke:none}
#wheel .mid{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(250px,36vmin);text-align:center;color:#f4ecd6}
#wheel .w-name{font:800 21px var(--hud);letter-spacing:.02em;-webkit-text-stroke:4px #0b0806;paint-order:stroke fill;line-height:1.1}
#wheel .w-ml{font-size:14px;color:#c9a85a;margin:3px 0 8px}
#wheel .w-ammo{font:800 26px var(--hud);-webkit-text-stroke:4px #0b0806;paint-order:stroke fill;margin-bottom:8px}
#wheel .w-ammo small{font-size:15px;opacity:.75}
#wheel .w-stats{display:grid;grid-template-columns:auto 1fr;gap:4px 8px;align-items:center;font:700 10px var(--hud);letter-spacing:.12em;text-transform:uppercase;color:#d9d0b8;text-align:right}
#wheel .w-bar{height:6px;background:rgba(244,236,214,.18);position:relative}
#wheel .w-bar i{position:absolute;left:0;top:0;bottom:0;background:#f4ecd6}
#wheel .w-desc{font-size:12.5px;line-height:1.4;color:#d9d0b8;margin-top:8px;text-shadow:0 1px 3px #000}
#wheel .w-hint{position:absolute;left:50%;bottom:6vh;transform:translateX(-50%);font:700 12px var(--hud);letter-spacing:.14em;color:#d9d0b8;-webkit-text-stroke:3px #0b0806;paint-order:stroke fill;white-space:nowrap}
#xhair{position:fixed;left:50%;top:50%;width:6px;height:6px;margin:-3px 0 0 -3px;border-radius:50%;background:#f4ecd6;box-shadow:0 0 0 1.5px rgba(11,8,6,.85);z-index:11;display:none;pointer-events:none}
#xhair.on{display:block}
#xhair.foe{background:#d8261c}
#xhair.wide{width:10px;height:10px;margin:-5px 0 0 -5px;background:transparent;box-shadow:0 0 0 2px #f4ecd6,0 0 0 3.5px rgba(11,8,6,.7)}
#xhair.wide.foe{box-shadow:0 0 0 2px #d8261c,0 0 0 3.5px rgba(11,8,6,.7)}
#hitmark{position:fixed;left:50%;top:50%;width:26px;height:26px;margin:-13px 0 0 -13px;z-index:12;pointer-events:none;opacity:0;transition:opacity .15s}
#hitmark.on{opacity:1;transition:none}
#hitmark i{position:absolute;left:12px;top:0;width:2px;height:8px;background:#f4ecd6;box-shadow:0 0 0 1px #0b0806;transform-origin:1px 13px}
#hitmark.kill i{background:#d8261c}
#scope{position:fixed;inset:0;z-index:11;display:none;pointer-events:none;background:radial-gradient(circle at 50% 50%,transparent 0,transparent calc(min(42vw,42vh) - 2px),#000 calc(min(42vw,42vh) + 1px))}
#scope.on{display:block}
#scope::before,#scope::after{content:'';position:absolute;background:rgba(10,10,10,.85)}
#scope::before{left:50%;top:8vh;bottom:8vh;width:1.5px;margin-left:-.75px}
#scope::after{top:50%;left:calc(50vw - min(42vw,42vh));right:calc(50vw - min(42vw,42vh));height:1.5px;margin-top:-.75px}
#scope b{position:absolute;left:50%;top:50%;width:min(16vw,16vh);height:3px;margin:-1.5px 0 0 calc(-1 * min(42vw,42vh));background:#111}
#whud{position:absolute;right:28px;bottom:26px;display:flex;align-items:center;gap:10px;opacity:0;transition:opacity .4s}
#whud.on{opacity:1}
#whud .wi{width:64px;height:64px;filter:drop-shadow(0 1px 2px #000)}
#whud .wi svg{width:64px;height:64px}
#whud .wa{font:800 26px var(--hud);color:#f4ecd6;-webkit-text-stroke:4px #0b0806;paint-order:stroke fill;min-width:70px;text-align:right}
#whud .wa small{font-size:16px;opacity:.75}
#whud .wa.low{color:#e8a23a}
#whud .wa.empty{color:#d8261c}
`;

const SLOTS = [
  { id: 'fists', label: 'UNARMED' }, { id: 'melee', label: 'MELEE' }, { id: 'pistol', label: 'PISTOL' }, { id: 'shotgun', label: 'SHOTGUN' },
  { id: 'rifle', label: 'RIFLE' }, { id: 'sniper', label: 'SNIPER' }, { id: 'rocket', label: 'LAUNCHER' }, { id: 'items', label: 'SATCHEL' },
];
const NS = 'http://www.w3.org/2000/svg';
const sector = (cx, cy, r0, r1, a0, a1) => {
  const p = (r, a) => `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`, large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${p(r1, a0)} A${r1},${r1} 0 ${large} 1 ${p(r1, a1)} L${p(r0, a1)} A${r0},${r0} 0 ${large} 0 ${p(r0, a0)} Z`;
};

export function setupWheel(EQUIP) {
  const st0 = document.createElement('style'); st0.textContent = CSS; document.head.appendChild(st0);
  const el = document.createElement('div'); el.id = 'wheel';
  el.innerHTML = `<svg class="ring" viewBox="0 0 600 600"></svg><div class="mid"><div class="w-name"></div><div class="w-ml"></div><div class="w-ammo"></div><div class="w-stats"></div><div class="w-desc"></div></div><div class="w-hint">MOUSE choose · WHEEL cycle melee · RELEASE TAB to draw</div>`;
  document.body.appendChild(el);
  const svg = el.querySelector('svg');
  const xh = document.createElement('div'); xh.id = 'xhair'; document.body.appendChild(xh);
  const hm = document.createElement('div'); hm.id = 'hitmark'; hm.innerHTML = [45, 135, 225, 315].map((a) => `<i style="transform:rotate(${a}deg)"></i>`).join(''); document.body.appendChild(hm);
  const sc = document.createElement('div'); sc.id = 'scope'; sc.innerHTML = '<b></b>'; document.body.appendChild(sc);
  const wh = document.createElement('div'); wh.id = 'whud'; wh.innerHTML = '<div class="wa"></div><div class="wi"></div>'; document.getElementById('hud').appendChild(wh);

  const N = SLOTS.length, gap = 0.035;
  const segs = SLOTS.map((s, i) => {
    const a0 = -Math.PI / 2 - Math.PI / N + i * 2 * Math.PI / N + gap, a1 = a0 + 2 * Math.PI / N - gap * 2, am = (a0 + a1) / 2;
    const path = document.createElementNS(NS, 'path'); path.setAttribute('d', sector(300, 300, 150, 290, a0, a1)); path.setAttribute('class', 'seg'); svg.appendChild(path);
    const g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'ico'); g.setAttribute('transform', `translate(${300 + Math.cos(am) * 222 - 34},${300 + Math.sin(am) * 222 - 40}) scale(1.06)`); svg.appendChild(g);
    const t = document.createElementNS(NS, 'text'); t.setAttribute('class', 'lbl'); t.setAttribute('x', 300 + Math.cos(am) * 222); t.setAttribute('y', 300 + Math.sin(am) * 222 + 40); t.textContent = s.label; svg.appendChild(t);
    return { ...s, a: am, path, g, t };
  });
  const st = () => G.story?.state;
  const owned = (k) => st()?.weapons.includes(k);
  const meleeOwned = () => MELEE_ORDER.filter(owned);
  const meleeKey = () => { const m = st()?.melee; return m && owned(m) ? m : meleeOwned()[0]; };
  const keyOf = (s) => (s.id === 'melee' ? meleeKey() : s.id === 'items' ? null : s.id);
  const has = (s) => s.id === 'items' || s.id === 'fists' || !!(keyOf(s) && owned(keyOf(s)));
  const canChoose = () => G.started && !G.paused && !G.mapOpen && !G.shopOpen && !G.story?.busy && G.player.mode === 'foot' && !G.player.locked && G.player.health > 0;
  const iconFor = (k) => EQUIP[WEAPONS[k]?.icon] || '';
  const ammoText = (k) => { const s = st(); if (!GUNS[k]) return ''; const loaded = G.player.weapon === k ? G.player.rounds : (s.mag?.[k] || 0); return `${loaded}<small> | ${s.ammo?.[k] || 0}</small>`; };

  let sel = -1, mx = 0, my = 0;
  const show = (i) => {
    sel = i;
    segs.forEach((s, k) => {
      const ok = has(s), cur = keyOf(s) === G.player.weapon || (s.id === 'fists' && G.player.weapon === 'fists');
      s.path.classList.toggle('sel', k === i); s.path.classList.toggle('off', !ok); s.path.classList.toggle('cur', cur);
      s.g.innerHTML = (s.id === 'items' ? (EQUIP.satchel || '') : iconFor(keyOf(s) || s.id)).replace(/^<svg[^>]*>|<\/svg>$/g, '');
      s.g.classList.toggle('off', !ok); s.t.classList.toggle('dk', k === i);
    });
    const s = segs[i >= 0 ? i : 0], k = i >= 0 ? keyOf(s) : G.player.weapon;
    const q = (c) => el.querySelector(c);
    if (i >= 0 && s.id === 'items') { q('.w-name').textContent = 'Satchel'; q('.w-ml').textContent = 'സഞ്ചി'; q('.w-ammo').innerHTML = ''; q('.w-stats').innerHTML = ''; q('.w-desc').textContent = 'Eat or drink the best thing you carry for your wounds.'; return; }
    if (i >= 0 && !has(s)) { q('.w-name').textContent = s.label; q('.w-ml').textContent = '— not owned —'; q('.w-ammo').innerHTML = ''; q('.w-stats').innerHTML = ''; q('.w-desc').textContent = s.id === 'melee' ? 'The kalari and the blacksmith sell blades and sticks.' : 'The gunsmith behind the Puthenthura godown, and the arms dealer at the bus stand, sell guns.'; return; }
    const W = GUNS[k] ? (G.player.weapon === k ? G.player.wdef : WEAPONS[k]) : WEAPONS[k];
    q('.w-name').textContent = W.name; q('.w-ml').textContent = W.ml || '';
    q('.w-ammo').innerHTML = ammoText(k);
    const R = GUNS[k] ? gunRatings(W) : { Damage: Math.min(1, W.dmg / 70), Reach: Math.min(1, W.reach / 3.2), Speed: Math.min(1, 0.3 / W.cd) };
    q('.w-stats').innerHTML = Object.entries(R).map(([n, v]) => `<span>${n}</span><div class="w-bar"><i style="width:${Math.round(v * 100)}%"></i></div>`).join('');
    q('.w-desc').textContent = W.desc;
  };
  const choose = (s) => {
    const p = G.player;
    if (s.id === 'items') { G.act?.quickUse(); return; }
    if (!has(s)) return;
    const k = keyOf(s);
    if (s.id === 'melee') st().melee = k;
    if (p.weapon !== k) { p.setWeapon(k); st().weapon = k; G.story.save(); }
    if (k !== 'fists') p.draw(); else p.holsterWeapon();
    G.hud?.flashWeapon();
  };
  G.equip = (k) => { const s = segs.find((x) => keyOf(x) === k || x.id === k); if (s) choose(s); };
  G.wheelOpen = false;
  const open = () => { if (G.wheelOpen || !canChoose()) return; G.wheelOpen = true; mx = my = 0; el.classList.add('on'); show(-1); G.audio?.sfx('page'); };
  const close = () => { if (!G.wheelOpen) return; G.wheelOpen = false; el.classList.remove('on'); if (sel >= 0) choose(segs[sel]); };
  addEventListener('keydown', (e) => {
    if (e.code === 'Tab') { e.preventDefault(); if (!e.repeat) open(); return; }
    const m = /^Digit([1-7])$/.exec(e.code);
    if (m && canChoose() && !e.repeat && !document.getElementById('choice')?.offsetParent) { const s = segs[+m[1] - 1]; if (has(s)) choose(s); else G.ui.toast(`<b>${s.label}</b> — not owned yet.`, 2); }
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
    segs.forEach((s, i) => { const d = Math.abs(((a - s.a) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI); if (d < bd) { bd = d; bi = i; } });
    if (bi !== sel) { show(bi); G.audio?.sfx('ui'); }
  });
  addEventListener('wheel', (e) => {
    if (!G.wheelOpen || sel < 0 || segs[sel].id !== 'melee') return;
    const own = meleeOwned(); if (own.length < 2) return;
    const i = own.indexOf(meleeKey()); st().melee = own[(i + (e.deltaY > 0 ? 1 : -1) + own.length) % own.length]; show(sel); G.audio?.sfx('ui');
  }, { passive: true });
  // without a mouse: cycle through what you own
  G.cycleWeapon = () => { if (!canChoose()) return; const own = segs.filter((s) => s.id !== 'items' && has(s)); const i = own.findIndex((s) => keyOf(s) === G.player.weapon); choose(own[(i + 1) % own.length]); G.ui.toast(`<b>${G.player.wdef.name}</b>`, 1.5); };

  // ---- the HUD pieces, every frame
  let flashT = 0, hmT = 0;
  G.hud = {
    flashWeapon: () => { flashT = 3; },
    hitMark: (kill, head) => { hm.classList.add('on'); hm.classList.toggle('kill', !!kill); hmT = kill ? 0.35 : 0.18; G.audio?.sfx('click', head ? 0.8 : 0.4); },
  };
  let foeT = 0;
  G.updaters.push((dt) => {
    const p = G.player, W = p.wdef, gun = !!W?.gun && p.mode === 'foot' && p.drawn && p.stick.visible;
    const hidden = G.ui.hudHidden || G.story?.busy || G.shopOpen;
    xh.classList.toggle('on', !hidden && (p.aiming || gun) && !p.scoped);
    xh.classList.toggle('wide', gun && !p.aiming);
    sc.classList.toggle('on', !!p.scoped && !hidden);
    // red over an enemy (checked a few times a second)
    if ((foeT -= dt) <= 0 && (p.aiming || gun) && G.combat) {
      foeT = 0.1;
      const cam = p.camera, d = cam.getWorldDirection(p._fd || (p._fd = cam.position.clone()));
      const hit = G.combat.pick(cam.position, d, W.range || 40, null);
      xh.classList.toggle('foe', !!(hit && (hit.n.hostile || hit.n.canBeHit)));
    }
    if (hmT > 0) { hmT -= dt; if (hmT <= 0) hm.classList.remove('on'); }
    // weapon and rounds at the lower right while it is out (and briefly after changing)
    flashT -= dt;
    const showW = !hidden && p.mode === 'foot' && (p.drawn || flashT > 0) && p.weapon !== 'fists' || (flashT > 0 && !hidden);
    wh.classList.toggle('on', showW);
    if (showW) {
      const key = p.weapon, ico = EQUIP[W.icon] || '';
      if (wh.dataset.k !== key + (W.icon || '')) { wh.dataset.k = key + (W.icon || ''); wh.querySelector('.wi').innerHTML = ico; }
      const a = wh.querySelector('.wa');
      if (GUNS[key]) { const spare = st().ammo?.[key] || 0; a.innerHTML = p.reloadT > 0 ? '<small>reloading</small>' : `${p.rounds}<small> | ${spare}</small>`; a.className = 'wa' + (p.rounds === 0 ? ' empty' : p.rounds <= Math.ceil(W.mag / 4) ? ' low' : ''); }
      else { a.textContent = ''; a.className = 'wa'; }
    }
  });
}
