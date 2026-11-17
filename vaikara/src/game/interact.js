// One "E" interaction system: finds the nearest thing you can use and shows a
// prompt. Today: board / leave a vallam canoe.
import { Input } from './input.js';

const $ = (id) => document.getElementById(id);

export class Interact {
  constructor(scene, player) { this.scene = scene; this.player = player; this.text = ''; }

  update() {
    const p = this.player;
    let label = '', act = null;
    if (p.mode === 'boat') {
      if (p.canDisembark()) { label = 'Step ashore'; act = () => p.disembark(); }
      else label = '';
    } else if (!p.swimming || true) {
      let best = null, bd = 4.2;
      for (const b of this.scene.userData.boats || []) {
        const d = Math.hypot(b.position.x - p.pos.x, b.position.z - p.pos.z);
        if (d < bd && !b.userData.boarded) { bd = d; best = b; }
      }
      if (best) { label = 'Board the vallam'; act = () => p.board(best); }
    }
    if (label !== this.text) {
      this.text = label;
      const el = $('prompt');
      el.innerHTML = label ? `<b style="color:#d9b465;font-family:ui-monospace,monospace;margin-right:8px">E</b>${label}` : '';
      el.classList.toggle('on', !!label);
    }
    if (act && Input.hit('KeyE')) act();
  }
}
