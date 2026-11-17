// Keyboard + mouse (pointer lock) input.
export const Input = {
  keys: new Set(), pressed: new Set(),
  dx: 0, dy: 0, wheel: 0, locked: false, canvas: null,
  init(canvas) {
    this.canvas = canvas;
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code); this.pressed.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'Tab', 'F3'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('click', () => { if (!this.locked && !this.suspended) canvas.requestPointerLock?.(); });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; });
    addEventListener('mousemove', (e) => { if (this.locked) { this.dx += e.movementX; this.dy += e.movementY; } });
    addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); }, { passive: true });
  },
  down(c) { return this.keys.has(c); },
  hit(c) { return this.pressed.has(c); },
  endFrame() { this.pressed.clear(); this.dx = 0; this.dy = 0; this.wheel = 0; },
  release() { if (document.pointerLockElement) document.exitPointerLock(); },
};
