// Getting about inside: stairs between floors, the climb up the Azhimukham light, and the temple's
// sanctum (which only the priest enters).
import * as THREE from 'three';
import { G } from './state.js';
import { STAIRS } from './houses.js';
import { SPOTS } from './structures.js';

export function setupInteriors() {
  const p = () => G.player;
  const onFoot = () => p().mode === 'foot' && !G.activity && !G.story?.busy;
  const go = async (to, y, yaw) => {
    const pl = p(); pl.locked = true;
    G.audio?.sfx('step', 0.6);
    await G.ui.fade(1, 0.35);
    pl.teleport(to.x, to.z, yaw ?? pl.yaw, y);
    pl.snapCam = true;
    await G.ui.fade(0, 0.35);
    pl.snapCam = false; pl.locked = false;
  };
  // each staircase: a spot at its foot and one at its head, each usable only from its own floor
  for (const s of STAIRS) {
    G.interactables.push({ pos: s.lo, r: 1.5, label: 'Go upstairs', cond: () => onFoot() && Math.abs(p().pos.y - s.loY) < 0.8, action: () => go(s.hi, s.hiY) });
    G.interactables.push({ pos: s.hi, r: 1.5, label: 'Go downstairs', cond: () => onFoot() && Math.abs(p().pos.y - s.hiY) < 0.8, action: () => go(s.lo, s.loY) });
  }
  // the lighthouse: up the spiral to the lamp gallery, for the view over the bar and the sea
  if (SPOTS.lighthouseDoor) {
    G.interactables.push({
      pos: SPOTS.lighthouseDoor, r: 2.4, label: 'Climb to the lamp gallery', cond: onFoot,
      action: async () => {
        const pl = p(), top = SPOTS.lighthouseTop;
        pl.locked = true; G.story.busy = true; G.ui.prompt(null);
        await G.ui.fade(1, 0.6);
        let a = pl.camYaw + Math.PI, t = 0;
        const view = () => { t += 1 / 60; a += 0.0035; pl.setCine({ hard: true, pos: new THREE.Vector3(top.x + Math.sin(a) * 2.4, top.y, top.z + Math.cos(a) * 2.4), look: new THREE.Vector3(top.x + Math.sin(a) * 60, top.y - 9, top.z + Math.cos(a) * 60), fov: 55 }); };
        G.updaters.push(view);
        G.ui.letterbox(true);
        await G.ui.fade(0, 0.8);
        G.ui.bark('', 'A hundred and twelve steps. From the gallery the bar lies white below, the fishing boats beyond it, and the whole backwater behind.', 7);
        await new Promise((r) => setTimeout(r, 9000));
        await G.ui.fade(1, 0.6);
        const i = G.updaters.indexOf(view); if (i >= 0) G.updaters.splice(i, 1);
        pl.setCine(null); G.ui.letterbox(false);
        await G.ui.fade(0, 0.6);
        pl.locked = false; G.story.busy = false;
      },
    });
  }
  if (SPOTS.sreekovil) {
    G.interactables.push({ pos: SPOTS.sreekovil, r: 2.0, label: 'The sreekovil', cond: onFoot, action: () => G.ui.bark('', 'The sanctum door stands open on the lamp-lit idol. Only the priest goes in; the rest of us pray from the steps.', 6) });
  }
}
