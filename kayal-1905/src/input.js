// Keyboard + mouse (pointer-lock with drag fallback) + touch controls.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.hits = new Set();
    this.dx = 0; this.dy = 0; this.wheel = 0;
    this.locked = false;
    this.dragging = false;
    this.enabled = false;        // gameplay capture on/off
    this.touch = { active: false, mx: 0, my: 0, sprint: false };
    this.isTouch = false;

    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code); this.hits.add(e.code);
      if (this.enabled && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      if (!this.locked) { this.dragging = true; this.requestLock(); }
      else if (e.button === 0) this.hits.add('Attack');
      else if (e.button === 2) this.keys.add('Block');
    });
    addEventListener('mouseup', (e) => { this.dragging = false; if (e.button === 2) this.keys.delete('Block'); });
    addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      if (this.locked || this.dragging) { this.dx += e.movementX || 0; this.dy += e.movementY || 0; }
    });
    canvas.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); }, { passive: true });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; });
    document.addEventListener('pointerlockerror', () => { this.locked = false; });
    this.setupTouch();
  }

  requestLock() {
    if (this.isTouch) return;
    try {
      const p = this.canvas.requestPointerLock?.();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* sandboxed frame: fall back to drag-look */ }
  }
  releaseLock() { try { document.exitPointerLock?.(); } catch (e) { /* ignore */ } }

  setupTouch() {
    const pad = document.getElementById('touch');
    if (!pad) return;
    const stick = document.getElementById('stick'), knob = document.getElementById('knob');
    let moveId = null, lookId = null, ox = 0, oy = 0, lx = 0, ly = 0;
    const show = () => { if (!this.isTouch) { this.isTouch = true; document.body.classList.add('touch'); } };
    addEventListener('touchstart', show, { passive: true, once: true });
    this.canvas.addEventListener('touchstart', (e) => {
      if (!this.enabled) return;
      for (const t of e.changedTouches) {
        if (t.clientX < innerWidth * 0.4 && moveId === null) {
          moveId = t.identifier; ox = t.clientX; oy = t.clientY;
          stick.style.display = 'block'; stick.style.left = ox - 60 + 'px'; stick.style.top = oy - 60 + 'px';
          knob.style.transform = 'translate(0px,0px)';
        } else if (lookId === null) { lookId = t.identifier; lx = t.clientX; ly = t.clientY; }
      }
      e.preventDefault();
    }, { passive: false });
    this.canvas.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === moveId) {
          let dx = t.clientX - ox, dy = t.clientY - oy;
          const l = Math.hypot(dx, dy), m = 55;
          if (l > m) { dx *= m / l; dy *= m / l; }
          knob.style.transform = `translate(${dx}px,${dy}px)`;
          this.touch.mx = dx / m; this.touch.my = -dy / m; this.touch.active = true;
        } else if (t.identifier === lookId) {
          this.dx += (t.clientX - lx) * 1.6; this.dy += (t.clientY - ly) * 1.6;
          lx = t.clientX; ly = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === moveId) { moveId = null; this.touch.mx = this.touch.my = 0; this.touch.active = false; stick.style.display = 'none'; }
        if (t.identifier === lookId) lookId = null;
      }
    };
    this.canvas.addEventListener('touchend', end); this.canvas.addEventListener('touchcancel', end);
    pad.querySelectorAll('[data-key]').forEach((b) => {
      const code = b.dataset.key;
      b.addEventListener('touchstart', (e) => {
        e.preventDefault(); e.stopPropagation();
        if (code === 'Sprint') { this.touch.sprint = !this.touch.sprint; b.classList.toggle('on', this.touch.sprint); }
        else { this.hits.add(code); this.keys.add(code); }
      }, { passive: false });
      b.addEventListener('touchend', (e) => { e.preventDefault(); this.keys.delete(code); }, { passive: false });
    });
  }

  down(code) { return this.keys.has(code); }
  hit(code) { return this.hits.has(code); }
  consume(code) { const h = this.hits.has(code); this.hits.delete(code); return h; }

  // movement vector: x = strafe right, y = forward
  move() {
    let x = 0, y = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) y += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.touch.active) { x = this.touch.mx; y = this.touch.my; }
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return [x, y];
  }
  sprint() { return this.down('ShiftLeft') || this.down('ShiftRight') || this.touch.sprint; }

  endFrame() { this.hits.clear(); this.dx = 0; this.dy = 0; this.wheel = 0; }
}
