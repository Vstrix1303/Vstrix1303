// Kerala domestic architecture you can walk into: village houses and huts,
// the courtyard manor (nalukettu / ettukettu), and the spice warehouse.
// Walls are real thin slabs with door and window openings; floors are
// walkable plinths; each building registers an interior zone for the camera.
import * as THREE from 'three';

const DOOR = [0.55, 0.42, 0.34], BRASS = [0.95, 0.72, 0.28], DARKWOOD = [0.34, 0.26, 0.2], PALE = [1.5, 1.35, 1.1];
const CLAY = [0.62, 0.3, 0.17], SOOT = [0.1, 0.09, 0.08], DADO = [0.82, 0.37, 0.24], MUD = [0.86, 0.66, 0.46];

// turned profiles [radius, height]
export const PROFILE = {
  pot: [[0.001, 0], [0.16, 0.02], [0.3, 0.2], [0.33, 0.36], [0.26, 0.52], [0.15, 0.6], [0.19, 0.68], [0.17, 0.7]],
  urn: [[0.001, 0], [0.2, 0.03], [0.42, 0.4], [0.44, 0.75], [0.3, 1.05], [0.22, 1.12], [0.26, 1.2]],
  lamp: [[0.001, 0], [0.2, 0], [0.2, 0.04], [0.07, 0.1], [0.045, 0.2], [0.06, 0.45], [0.04, 0.62], [0.05, 0.7], [0.2, 0.76], [0.21, 0.8], [0.06, 0.82], [0.035, 0.95], [0.05, 1.0], [0.001, 1.1]],
  koodu: [[0.42, 0], [0.4, 0.1], [0.3, 0.5], [0.2, 0.75], [0.17, 0.85], [0.19, 0.9]],
  basket: [[0.001, 0], [0.22, 0.02], [0.3, 0.3], [0.32, 0.34]],
  kindi: [[0.001, 0], [0.1, 0.01], [0.17, 0.1], [0.17, 0.2], [0.08, 0.3], [0.06, 0.38], [0.1, 0.44]],
};
export const P = {
  pot: (b, x, y, z, s = 1, col = CLAY) => b.lathe('paint', PROFILE.pot, x, y, z, { s, col }),
  urn: (b, x, y, z, s = 1) => b.lathe('paint', PROFILE.urn, x, y, z, { s, col: [0.5, 0.26, 0.16], seg: 12 }),
  koodu: (b, x, y, z, s = 1) => b.lathe('thatch', PROFILE.koodu, x, y, z, { s, col: [1.0, 0.9, 0.7], uv: [4, 1] }),
  basket: (b, x, y, z, s = 1, fill) => { b.lathe('thatch', PROFILE.basket, x, y, z, { s, col: [0.95, 0.85, 0.65], uv: [4, 1] }); if (fill) b.cone('paint', 0.27 * s, 0.2 * s, x, y + 0.26 * s, z, { seg: 10, col: fill }); },
  kindi: (b, x, y, z, s = 1) => { b.lathe('brass', PROFILE.kindi, x, y, z, { s, col: [0.85, 0.45, 0.25] }); b.cyl('brass', 0.015 * s, 0.03 * s, 0.26 * s, x + 0.2 * s, y + 0.12 * s, z, { seg: 5, rz: -0.9, col: [0.85, 0.45, 0.25] }); },
  // nilavilakku: the standing brass oil lamp
  lamp: (b, x, y, z, s = 1, light = 0) => { b.lathe('brass', PROFILE.lamp, x, y, z, { s, col: BRASS, seg: 12 }); b.lamp(x + 0.19 * s, y + 0.84 * s, z, 0.55, light); },
  rope: (b, x, y, z, s = 1) => { for (let i = 0; i < 3; i++) b.geo('sack', new THREE.TorusGeometry((0.3 - i * 0.03) * s, 0.045 * s, 5, 12), new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(x, y + 0.05 * s + i * 0.08 * s, z), [0.6, 0.42, 0.26]); },
  chest: (b, x, y, z, ry = 0, s = 1) => {
    b.box('plank', 0.9 * s, 0.45 * s, 0.5 * s, x, y, z, { ry, tile: 0.8, col: [0.75, 0.62, 0.5] }); b.box('plank', 0.94 * s, 0.1 * s, 0.54 * s, x, y + 0.45 * s, z, { ry, tile: 0.8, col: [0.6, 0.5, 0.4] });
    b.box('paint', 0.08 * s, 0.12 * s, 0.03, x, y + 0.36 * s, z, { ry, col: [0.2, 0.2, 0.22] });
  },
  mat: (b, x, y, z, ry = 0, l = 1.9, w = 0.95) => b.box('thatch', l, 0.025, w, x, y, z, { ry, tile: 0.5, col: [1.15, 1.05, 0.8] }),
  // three-stone hearth with a blackened pot and a glow
  hearth: (b, x, y, z) => {
    for (let i = 0; i < 3; i++) { const a = i * 2.1; b.box('stone', 0.2, 0.2, 0.2, x + Math.cos(a) * 0.26, y, z + Math.sin(a) * 0.26, { ry: a, col: [0.35, 0.32, 0.3] }); }
    b.lathe('paint', PROFILE.pot, x, y + 0.18, z, { s: 0.8, col: SOOT });
    b.box('paint', 0.3, 0.03, 0.3, x, y + 0.02, z, { col: [1.6, 0.5, 0.1] });
    b.lamp(x, y + 0.12, z, 0.7, 0);
    for (let i = 0; i < 4; i++) b.cyl('wood', 0.035, 0.04, 0.7, x + 0.55, y + 0.04 + i * 0.07, z - 0.25 + (i % 2) * 0.12, { seg: 5, rx: Math.PI / 2 });
  },
  // nets drying on a bamboo frame
  netFrame: (b, x, z, ry = 0) => {
    const c = Math.cos(ry), s = Math.sin(ry);
    for (const e of [-1.5, 1.5]) for (const k of [-1, 1]) b.cyl('wood', 0.03, 0.04, 2.3, x + c * e + s * k * 0.35, 0, z - s * e + c * k * 0.35, { seg: 5, rx: -k * 0.3 * c, rz: k * 0.3 * s, col: [0.9, 0.8, 0.5] });
    b.box('wood', 3.3, 0.05, 0.05, x, 2.05, z, { ry, col: [0.9, 0.8, 0.5] });
    b.box('net', 2.9, 1.6, 0.02, x, 0.42, z, { ry, tile: 0.3 });
  },
};

// A wall slab in LOCAL space from (x0,z0) to (x1,z1) (axis-aligned, increasing),
// with openings: { at: distance along, w, kind: 'door' | 'window' | 'gap', h, sill }.
export function wall(b, mat, x0, z0, x1, z1, y0, h, ops = [], o = {}) {
  const t = o.t ?? 0.24, ax = Math.abs(x1 - x0) > Math.abs(z1 - z0), out = o.out ?? 1;
  const len = ax ? x1 - x0 : z1 - z0;
  const put = (m, l, hh, th, mid, yb, off, col, tile) => (ax ? b.box(m, l, hh, th, x0 + mid, yb, z0 + off, { col, tile }) : b.box(m, th, hh, l, x0 + off, yb, z0 + mid, { col, tile }));
  const hit = (mid, l) => (ax ? b.collider(x0 + mid, z0, l / 2, t / 2 + 0.03) : b.collider(x0, z0 + mid, t / 2 + 0.03, l / 2));
  const seg = (a, c, yb, hh, collide) => {
    const l = c - a;
    if (l < 0.02 || hh < 0.02) return;
    put(mat, l, hh, t, (a + c) / 2, yb, 0, o.col, o.tile);
    if (o.dado && yb === y0 && hh > 0.9) put(mat, l, 0.64, t + 0.04, (a + c) / 2, yb, 0, o.dado);
    if (collide) hit((a + c) / 2, l);
  };
  let cur = 0;
  for (const op of [...ops].sort((p, q) => p.at - q.at)) {
    const a = op.at - op.w / 2, c = op.at + op.w / 2;
    seg(cur, a, y0, h, true);
    if (op.kind === 'door') {
      const dh = op.h ?? 2.05;
      seg(a, c, y0 + dh, h - dh, false);
      put('wood', 0.1, dh, t + 0.08, a + 0.03, y0, 0, DARKWOOD); put('wood', 0.1, dh, t + 0.08, c - 0.03, y0, 0, DARKWOOD);
      put('wood', op.w + 0.18, 0.13, t + 0.1, op.at, y0 + dh - 0.05, 0, DARKWOOD);
      if (op.leaf !== false) {
        // two leaves folded back against the inner face
        const lw = op.w * 0.5;
        for (const e of [a - lw / 2 + 0.02, c + lw / 2 - 0.02]) put('wood', lw, dh - 0.12, 0.05, e, y0, -out * (t / 2 + 0.05), op.col || DOOR);
      }
    } else if (op.kind === 'window') {
      const sill = op.sill ?? 0.95, wh = op.h ?? 1.0;
      seg(a, c, y0, sill, false); seg(a, c, y0 + sill + wh, h - sill - wh, false);
      hit(op.at, op.w);
      put('wood', op.w + 0.16, 0.08, t + 0.12, op.at, y0 + sill - 0.07, 0, PALE); put('wood', op.w + 0.16, 0.08, t + 0.12, op.at, y0 + sill + wh - 0.01, 0, PALE);
      for (let k = -1; k <= 1; k++) put('paint', 0.035, wh, 0.035, op.at + k * op.w * 0.26, y0 + sill, 0, [0.13, 0.12, 0.11]);
      if (op.shutters !== false) for (const e of [a - op.w * 0.25, c + op.w * 0.25]) put('wood', op.w * 0.48, wh, 0.04, e, y0 + sill, out * (t / 2 + 0.04), o.shutter || [0.5, 0.36, 0.26]);
    }
    cur = c;
  }
  seg(cur, len, y0, h, true);
}

// The ordinary village house or hut — now with a door you can walk through.
export function house(b, x, z, ry, o = {}) {
  const w = o.w || 8, d = o.d || 6, wallH = o.wallH || 2.7, ov = o.overhang ?? 1.4;
  const roof = o.roof || 'roof', hsh = Math.abs(Math.round(x * 3.1 + z * 7.7));
  const mud = o.mud ?? (roof === 'thatch' && hsh % 2 === 0), wm = mud ? 'wall' : (o.wall || 'wall');
  const wcol = mud ? MUD : o.col, dado = !mud && wm === 'wall' ? DADO : null;
  b.place(x, z, ry);
  const y0 = 0.5, hw = w / 2, hd = d / 2, pw = w + ov * 2 - 0.5, pd = d + ov * 2 - 0.5;
  b.box('laterite', pw, 2.0, pd, 0, -1.5, 0);
  b.box('paint', w - 0.26, 0.03, d - 0.26, 0, y0, 0, { col: mud ? [0.5, 0.36, 0.24] : [0.42, 0.18, 0.13] });
  b.platform(0, 0, pw / 2, pd / 2, y0);
  const dx = o.doorX || 0;
  const F = [{ at: hw + dx, w: 1.15, kind: 'door' }];
  if (w >= 6.4) for (const s of [-1, 1]) if (Math.abs(s * w * 0.32 - dx) > 1.3) F.push({ at: hw + s * w * 0.32, w: 0.9, kind: 'window' });
  const wo = { col: wcol, dado };
  wall(b, wm, -hw, hd, hw, hd, y0, wallH, F, { ...wo, out: 1 });
  wall(b, wm, -hw, -hd, hw, -hd, y0, wallH, [{ at: hw, w: 0.9, kind: 'window' }], { ...wo, out: -1 });
  wall(b, wm, -hw, -hd, -hw, hd, y0, wallH, [{ at: hd, w: 0.9, kind: 'window' }], { ...wo, out: -1 });
  wall(b, wm, hw, -hd, hw, hd, y0, wallH, [{ at: hd, w: 0.9, kind: 'window' }], { ...wo, out: 1 });
  // ---- roof: steep hip with a little gable let into each end
  const rh = (hd + ov) * (o.pitch || 0.82), ridge = Math.max(w - d, w * 0.3), yr = y0 + wallH - 0.2, tiled = roof === 'roof';
  b.roofHip(roof, w + ov * 2, d + ov * 2, rh, ridge, 0, yr, 0);
  b.box(roof, ridge + 0.3, 0.14, 0.34, 0, yr + rh - 0.05, 0, { col: [0.6, 0.55, 0.5], tile: 1 });
  if (tiled) {
    const hg = rh * 0.36, k = (hw + ov - ridge / 2) / rh, L = hg * k, dW = 2 * (hd + ov) * hg / rh;
    for (const s of [-1, 1]) {
      b.roofGable(roof, L, dW, hg, s * (ridge / 2 + L / 2), yr + rh - hg, 0, 0, null);
      b.tri('gable', dW - 0.1, hg - 0.04, s * (ridge / 2 + L - 0.02), yr + rh - hg, 0, s * Math.PI / 2);
      b.cone('wood', 0.06, 0.42, s * (ridge / 2 + L - 0.1), yr + rh - 0.02, 0, { seg: 6, col: DARKWOOD });
    }
  }
  // ---- verandah posts, steps, and (on the better houses) a gabled porch
  const np = Math.max(2, Math.round(w / 2.6));
  for (let i = 0; i <= np; i++) b.cyl('wood', 0.08, 0.1, wallH - 0.25, -hw - ov + 0.5 + i * (w + ov * 2 - 1) / np, y0, hd + ov - 0.45, { seg: 7, col: mud ? [0.95, 0.85, 0.55] : undefined });
  const porch = o.porch ?? (tiled && w >= 7);
  if (porch) {
    const pz = hd + ov + 0.65, pwid = 3.0, ph = 1.0, py = y0 + wallH - 0.5;
    b.box('laterite', pwid + 0.4, 2.0, 2.3, dx, -1.5, pz);
    b.platform(dx, pz, pwid / 2 + 0.2, 1.15, y0);
    b.roofGable(roof, 3.4, pwid + 1.0, ph, dx, py, pz - 0.35, Math.PI / 2, null);
    b.tri('gable', pwid + 0.7, ph - 0.06, dx, py + 0.02, pz + 1.34, 0);
    b.cone('wood', 0.06, 0.4, dx, py + ph - 0.04, pz + 1.3, { seg: 6, col: DARKWOOD });
    for (const s of [-1, 1]) b.cyl('wood', 0.09, 0.11, py - y0 + 0.05, dx + s * pwid / 2, y0, pz + 0.95, { seg: 8 });
    for (let i = 0; i < 2; i++) b.box('stone', 1.9, 0.26, 0.5, dx, 0.24 - i * 0.24, pz + 1.4 + i * 0.5);
  } else for (let i = 0; i < 2; i++) b.box('stone', 1.8, 0.26, 0.5, dx, 0.24 - i * 0.24, hd + ov - 0.02 + i * 0.5);
  if (o.awning) awning(b, 0, hd + ov - 0.35, w * 0.92, y0 + wallH - 0.6, 2.3, hsh, dx);
  if (tiled && (o.mural ?? hsh % 3 === 0)) for (const s of [-1, 1]) b.panel('mural', 1.0, 1.3, s * (hw + 0.15), y0 + 0.78, s * hd * 0.62, s * Math.PI / 2);
  // ---- inside
  const fy = y0 + 0.03;
  P.mat(b, -hw + 1.25, fy, -hd + 0.8);
  if (hsh % 2) P.mat(b, -hw + 1.25, fy, -hd + 1.9);
  P.hearth(b, hw - 0.8, fy, -hd + 0.8);
  P.pot(b, hw - 0.5, fy, -hd + 1.9, 0.9); P.pot(b, hw - 0.55, fy, -hd + 2.6, 0.7, hsh % 3 ? CLAY : [0.75, 0.58, 0.22]);
  if (w >= 6) P.chest(b, -hw + 0.6, fy, hd - 1.0, Math.PI / 2);
  if (hsh % 3 === 0) P.rope(b, hw - 0.6, fy, hd - 0.7); else P.basket(b, hw - 0.6, fy, hd - 0.7, 1, hsh % 2 ? [0.85, 0.8, 0.55] : null);
  if (!mud && w >= 7) P.lamp(b, -hw + 0.6, fy, 0.3, 0.8);
  b.box('paint', 0.1, 0.16, 0.1, 0, y0 + wallH - 0.35, 0, { col: [0.2, 0.18, 0.14] }); b.lamp(0, y0 + wallH - 0.5, 0, 0.8, 0);
  if (o.fisher) {
    for (let i = 0; i < 5; i++) b.box('paint', 0.06, 0.3, 0.12, -hw + 0.2, y0 + 1.5, -1 + i * 0.3, { col: [0.6, 0.6, 0.56] });
    P.rope(b, -hw + 0.5, fy, hd - 0.6);
  }
  // ---- outside
  P.pot(b, -hw + 0.4, y0, hd + ov - 0.9, 0.85); if (hsh % 2) P.pot(b, hw - 0.4, y0, hd + ov - 0.9, 1.0);
  b.interior(0, 0, hw, hd, y0 + wallH + 0.55);
  b.yard(Math.max(w, d) * 0.75 + 5, 0.7).clear(Math.max(w, d) * 0.62 + 2).mark(w + 2, d + 2);
  if (o.lamp) b.lamp(dx ? dx + 1.2 : 1.4, y0 + 1.9, hd + ov - 0.5, 1, 0);
  if (o.smoke ?? (hsh % 3 < 1)) b.smoke(w * 0.25, yr + rh * 0.55, -d * 0.2);
  // woven palm-leaf fence along the front of the yard
  if (o.fence ?? (hsh % 5 < 3)) {
    const fz = hd + ov + (porch ? 4.6 : 3.0), fx = hw + ov + 1.6;
    for (const [a, c] of [[-fx, dx - 1.5], [dx + 1.5, fx]]) {
      b.box('thatch', c - a, 1.0, 0.05, (a + c) / 2, 0.08, fz, { tile: 1.2, col: [0.8, 0.74, 0.62] });
      b.box('wood', c - a, 0.06, 0.07, (a + c) / 2, 1.0, fz);
      for (let px = a; px <= c + 0.01; px += (c - a) / Math.max(1, Math.round((c - a) / 1.7))) b.cyl('wood', 0.045, 0.055, 1.3, px, 0, fz, { seg: 5 });
      b.collider((a + c) / 2, fz, (c - a) / 2, 0.08, 0, 1.2);
    }
    b.box('thatch', 0.05, 1.0, fz + hd, -fx, 0.08, (fz - hd) / 2, { tile: 1.2, col: [0.8, 0.74, 0.62] });
    b.collider(-fx, (fz - hd) / 2, 0.08, (fz + hd) / 2, 0, 1.2);
  }
  if (o.washing ?? (hsh % 4 === 1)) {
    const lx = hw + ov + 1.2, lz = -d / 4;
    for (const sz of [-1.7, 1.7]) b.cyl('wood', 0.04, 0.05, 1.9, lx, 0, lz + sz, { seg: 5 });
    b.box('paint', 0.015, 0.015, 3.4, lx, 1.82, lz, { col: [0.2, 0.18, 0.15] });
    const cc = [[0.92, 0.9, 0.82], [0.62, 0.16, 0.14], [0.2, 0.32, 0.5], [0.9, 0.86, 0.7]];
    for (let k = 0; k < 4; k++) b.box('paint', 0.02, 0.62 + (k % 2) * 0.22, 0.6, lx, 1.82 - 0.63 - (k % 2) * 0.22, lz - 1.15 + k * 0.76, { col: cc[(hsh + k) % 4] });
  }
  return { y0, porch };
}

// The courtyard house. One court = nalukettu, two = ettukettu.
export function kettu(b, x, z, ry, o = {}) {
  const W = o.W || 15, D = o.D || 15, wallH = 3.0, y0 = 0.6, t = 0.26, V = 1.5;
  const courts = (o.courts || [{ cx: 0, cw: 5.5, cd: 5.5 }]).slice().sort((p, q) => p.cx - q.cx);
  const hw = W / 2, hd = D / 2, cd = courts[0].cd, wf = hd - cd / 2;
  b.place(x, z, ry);
  b.box('laterite', W + V * 2, 2.2, D + V * 2, 0, -1.6, 0);
  b.box('paint', W - 0.3, 0.03, D - 0.3, 0, y0, 0, { col: [0.4, 0.17, 0.12] });
  b.platform(0, 0, hw + V, hd + V, y0);
  const wo = { t, dado: DADO };
  const wins = (len, skip) => { const r = []; const n = Math.max(1, Math.round(len / 3.6)); for (let i = 0; i < n; i++) { const at = (i + 0.5) * len / n; if (!skip || Math.abs(at - len / 2) > skip) r.push({ at, w: 0.95, kind: 'window' }); } return r; };
  wall(b, 'wall', -hw, hd, hw, hd, y0, wallH, [{ at: hw, w: 1.6, kind: 'door', h: 2.25 }, ...wins(W, 3.4)], { ...wo, out: 1 });
  wall(b, 'wall', -hw, -hd, hw, -hd, y0, wallH, [{ at: hw, w: 1.3, kind: 'door' }, ...wins(W, 2.4)], { ...wo, out: -1 });
  wall(b, 'wall', -hw, -hd, -hw, hd, y0, wallH, wins(D), { ...wo, out: -1 });
  wall(b, 'wall', hw, -hd, hw, hd, y0, wallH, wins(D), { ...wo, out: 1 });
  for (const s of [-1, 1]) b.panel('mural', 1.5, 1.75, s * 1.95, y0 + 0.68, hd + t / 2 + 0.02, 0);
  // ---- courts: sunk stone paving open to the rain, pillars at the edge
  courts.forEach((c, ci) => {
    b.box('stone', c.cw, 0.05, c.cd, c.cx, y0 + 0.0, 0, { col: [0.62, 0.62, 0.6] });
    for (const s of [-1, 1]) { b.box('stone', c.cw + 0.3, 0.14, 0.16, c.cx, y0, s * c.cd / 2); b.box('stone', 0.16, 0.14, c.cd + 0.3, c.cx + s * c.cw / 2, y0, 0); }
    for (const [px, pz] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const X = c.cx + px * c.cw / 2, Z = pz * c.cd / 2;
      b.cyl('wood', 0.13, 0.16, wallH - 0.05, X, y0, Z, { seg: 8 }); b.box('stone', 0.4, 0.22, 0.4, X, y0, Z); b.circle(X, Z, 0.17);
    }
    if (ci === 0) {
      // the tulsi thara
      b.box('stone', 0.9, 0.95, 0.9, c.cx, y0, 0); b.box('stone', 1.1, 0.14, 1.1, c.cx, y0 + 0.95, 0);
      for (let i = 0; i < 5; i++) b.cone('paint', 0.1 + (i % 2) * 0.04, 0.42, c.cx + Math.cos(i * 1.3) * 0.13, y0 + 1.05 + (i % 3) * 0.06, Math.sin(i * 1.3) * 0.13, { seg: 6, rz: Math.cos(i * 1.3) * 0.3, rx: -Math.sin(i * 1.3) * 0.3, col: [0.16, 0.36 + (i % 2) * 0.06, 0.14] });
      b.lamp(c.cx, y0 + 1.15, 0.62, 0.7, 0); b.circle(c.cx, 0, 0.62);
    } else {
      b.cyl('stone', 0.75, 0.8, 0.55, c.cx, y0, 0, { seg: 12, open: true }); b.cyl('paint', 0.7, 0.7, 0.04, c.cx, y0 + 0.4, 0, { seg: 12, col: [0.12, 0.2, 0.2] }); b.circle(c.cx, 0, 0.8);
    }
  });
  // end rooms: a partition toward the court, with a doorway
  const cl = courts[0], cr = courts[courts.length - 1];
  wall(b, 'wall', cl.cx - cl.cw / 2 - 0.9, -cd / 2, cl.cx - cl.cw / 2 - 0.9, cd / 2, y0, wallH, [{ at: cd / 2, w: 1.2, kind: 'door', leaf: false }], { t: 0.2, out: 1 });
  wall(b, 'wall', cr.cx + cr.cw / 2 + 0.9, -cd / 2, cr.cx + cr.cw / 2 + 0.9, cd / 2, y0, wallH, [{ at: cd / 2, w: 1.2, kind: 'door', leaf: false }], { t: 0.2, out: -1 });
  // ---- roofs: a gabled range over every wing, eaves dripping into the courts
  const eo = V + 0.55, ei = 0.7, dR = wf + eo + ei, hR = dR * 0.42, yR = y0 + wallH - 0.15;
  const zc = (cd / 2 - ei + hd + eo) / 2;
  for (const s of [-1, 1]) {
    b.roofGable('roof', W + 2 * eo, dR, hR, 0, yR, s * zc, 0, 'gable');
    b.box('roof', W + 2 * eo + 0.2, 0.14, 0.36, 0, yR + hR - 0.05, s * zc, { col: [0.6, 0.55, 0.5], tile: 1 });
    for (const e of [-1, 1]) b.cone('wood', 0.07, 0.5, e * (hw + eo), yR + hR - 0.02, s * zc, { seg: 6, col: DARKWOOD });
  }
  const edges = [-hw, ...courts.flatMap((c) => [c.cx - c.cw / 2, c.cx + c.cw / 2]), hw];
  for (let i = 0; i < edges.length; i += 2) {
    const a = edges[i], c = edges[i + 1], lo = i === 0 ? eo : ei, ro = i === edges.length - 2 ? eo : ei;
    const dep = c - a + lo + ro;
    b.roofGable('roof', cd + 1.9, dep, dep * 0.42, (a - lo + c + ro) / 2, yR, 0, Math.PI / 2, null);
  }
  // ---- upper storey of teak slats over the front range
  let top = yR + hR;
  if (o.upper) {
    const uw = o.upperW || W * 0.5, ud = wf - 0.3, uz = hd - wf / 2, uy = yR + 0.2, uh = hR + 1.9;
    b.box('jali', uw, uh, ud, 0, uy, uz, { tile: 2.2 });
    b.roofGable('roof', uw + 2.6, ud + 2.8, 2.2, 0, uy + uh - 0.1, uz, 0, 'gable');
    b.roofGable('roof', ud / 2 + 2.6, 4.8, 1.8, 0, uy + uh - 0.1, uz + ud / 4 + 1.3, Math.PI / 2, null);
    b.tri('gable', 4.5, 1.7, 0, uy + uh - 0.08, uz + ud / 2 + 2.58, 0);
    b.cone('brass', 0.08, 0.6, 0, uy + uh + 1.66, uz + ud / 2 + 2.5, { seg: 6, col: BRASS });
    top = uy + uh + 2.1;
  }
  // ---- poomukham: the pillared entrance porch with its carved gable
  const pz0 = hd + V, pl = 3.2, pwid = 4.6;
  b.box('laterite', pwid, 2.2, pl, 0, -1.6, pz0 + pl / 2);
  b.platform(0, pz0 + pl / 2, pwid / 2, pl / 2, y0);
  for (const sx of [-1, 1]) {
    for (const sz of [0.3, pl - 0.3]) b.cyl('wood', 0.14, 0.18, 2.5, sx * (pwid / 2 - 0.25), y0, pz0 + sz, { seg: 8 });
    b.box('wood', 0.5, 0.42, pl - 1.0, sx * (pwid / 2 - 0.45), y0, pz0 + pl / 2, { col: DARKWOOD });
    b.box('wood', 0.08, 0.5, pl - 1.0, sx * (pwid / 2 - 0.2), y0 + 0.42, pz0 + pl / 2, { rz: sx * 0.25, col: DARKWOOD });
    b.collider(sx * (pwid / 2 - 0.4), pz0 + pl / 2, 0.3, pl / 2 - 0.5, 0, 1.2);
  }
  b.roofGable('roof', pl + 1.6, pwid + 1.3, 1.65, 0, y0 + 2.45, pz0 + pl / 2 - 0.1, Math.PI / 2, null);
  b.tri('gable', pwid + 1.0, 1.55, 0, y0 + 2.48, pz0 + pl + 0.68, 0);
  b.cone('brass', 0.07, 0.5, 0, y0 + 4.05, pz0 + pl + 0.6, { seg: 6, col: BRASS });
  for (let i = 0; i < 3; i++) b.box('stone', 2.8, 0.22, 0.5, 0, 0.4 - i * 0.2, pz0 + pl + 0.22 + i * 0.5);
  P.lamp(b, pwid / 2 - 1.1, y0, pz0 + pl - 0.5, 1.0, 1);
  // verandah posts round the front and sides
  for (let i = 0; i <= Math.round(W / 2.8); i++) { const px = -hw - V + 0.3 + i * (W + V * 2 - 0.6) / Math.round(W / 2.8); if (Math.abs(px) > pwid / 2) b.cyl('wood', 0.11, 0.14, wallH - 0.2, px, y0, hd + V - 0.3, { seg: 8 }); }
  for (const s of [-1, 1]) for (let i = 1; i < Math.round(D / 3); i++) b.cyl('wood', 0.11, 0.14, wallH - 0.2, s * (hw + V - 0.3), y0, -hd + i * D / Math.round(D / 3), { seg: 8 });
  // ---- furnishing
  const fy = y0 + 0.03, zf = hd - wf / 2, zb = -zf;
  // front hall: swing-cot, lamps, a bench
  b.box('plank', 2.0, 0.07, 0.8, cl.cx, y0 + 0.55, zf, { tile: 0.8, col: [0.7, 0.55, 0.42] });
  for (const sx of [-0.92, 0.92]) for (const sz of [-0.34, 0.34]) b.box('paint', 0.02, wallH - 0.6, 0.02, cl.cx + sx, y0 + 0.6, zf + sz, { col: [0.3, 0.22, 0.14] });
  b.collider(cl.cx, zf, 1.0, 0.4, 0, 1.3);
  P.lamp(b, 1.4, fy, hd - 0.7, 1.2, 1); P.lamp(b, -1.4, fy, hd - 0.7, 1.2, 0);
  P.chest(b, hw - 0.8, fy, zf, Math.PI / 2, 1.5); P.mat(b, cr.cx, fy, zf + 0.4, 0, 2.2, 1.1);
  P.kindi(b, cr.cx + 1.4, fy, zf + 0.3, 1.3);
  // back range: kitchen at one end, granary at the other
  P.hearth(b, -hw + 1.0, fy, zb - 0.3); P.hearth(b, -hw + 2.1, fy, zb - 0.3);
  P.urn(b, -hw + 0.8, fy, zb + 1.3); P.pot(b, -hw + 1.7, fy, zb + 1.5, 1.1); P.pot(b, -hw + 2.5, fy, zb + 1.4, 0.8, [0.75, 0.58, 0.22]);
  b.box('plank', 2.4, 1.3, 1.1, hw - 1.6, fy, zb, { tile: 1, col: [0.55, 0.42, 0.32] }); b.box('plank', 2.5, 0.1, 1.2, hw - 1.6, fy + 1.3, zb, { tile: 1, col: [0.45, 0.34, 0.26] });   // pathayam (grain chest)
  b.collider(hw - 1.6, zb, 1.25, 0.6, 0, 2);
  P.urn(b, hw - 3.6, fy, zb - 0.4, 0.9); P.basket(b, hw - 4.4, fy, zb + 0.5, 1.2, [0.85, 0.8, 0.55]); P.rope(b, 0.5, fy, zb + 0.9);
  P.mat(b, 0, fy, zb - 0.6, 0, 2.2, 1.1);
  // side rooms
  P.mat(b, -hw + 1.1, fy, 0, Math.PI / 2); P.chest(b, -hw + 0.6, fy, -1.6, Math.PI / 2); P.lamp(b, -hw + 0.6, fy, 1.8, 0.8, 0);
  P.mat(b, hw - 1.1, fy, 0.6, Math.PI / 2); P.mat(b, hw - 1.1, fy, -0.7, Math.PI / 2); P.pot(b, hw - 0.6, fy, 2.0, 0.8);
  b.smoke(-hw + 1.5, yR + hR * 0.7, zb * 0.9);
  b.interior(0, 0, hw, hd, y0 + wallH + 0.55);
  b.mark(W + 3, D + 3);
  return { y0, top, front: pz0 + pl, hw, hd, V };
}

// A Mappila merchant's spice house: open arcade below, carved teak above.
export function spiceHouse(b, x, z, ry) {
  const W = 13, D = 8, y0 = 0.55, gh = 3.2, hw = W / 2, hd = D / 2, dark = [0.5, 0.46, 0.5];
  b.place(x, z, ry);
  b.box('laterite', W + 2.4, 2.1, D + 2.4, 0, -1.55, 0);
  b.box('paint', W - 0.3, 0.03, D - 0.3, 0, y0, 0, { col: [0.36, 0.3, 0.26] });
  b.platform(0, 0, hw + 1.2, hd + 1.2, y0);
  wall(b, 'laterite', -hw, -hd, hw, -hd, y0, gh, [{ at: 3, w: 0.9, kind: 'window' }, { at: W - 3, w: 0.9, kind: 'window' }], { col: dark, out: -1 });
  wall(b, 'laterite', -hw, -hd, -hw, hd, y0, gh, [{ at: 2, w: 0.9, kind: 'window' }], { col: dark, out: -1 });
  wall(b, 'laterite', hw, -hd, hw, hd, y0, gh, [{ at: 2, w: 0.9, kind: 'window' }], { col: dark, out: 1 });
  // strong-room wall with the brass-studded door
  wall(b, 'laterite', -hw, 0, hw, 0, y0, gh, [{ at: hw, w: 1.7, kind: 'door', h: 2.4, col: [0.22, 0.2, 0.2] }], { col: dark, out: 1 });
  for (let i = 0; i < 8; i++) for (const s of [-1, 1]) b.sphere('brass', 0.035, s * (0.95 + (i % 2) * 0.5), y0 + 0.5 + Math.floor(i / 2) * 0.48, -0.2, { seg: 5, rings: 4, col: BRASS });
  // arcade posts
  for (let i = 0; i <= 6; i++) { const px = -hw + 0.2 + i * (W - 0.4) / 6; if (Math.abs(px) > 1.2) { b.cyl('wood', 0.13, 0.16, gh, px, y0, hd - 0.15, { seg: 8 }); b.circle(px, hd - 0.15, 0.17); } }
  for (const s of [-1, 1]) { b.cyl('wood', 0.15, 0.18, gh, s * 1.25, y0, hd + 0.95, { seg: 8 }); b.circle(s * 1.25, hd + 0.95, 0.18); }
  // goods under the arcade and in the strong-room
  const fy = y0 + 0.03, heap = [[0.9, 0.62, 0.1], [0.72, 0.13, 0.08], [0.1, 0.09, 0.08], [0.45, 0.3, 0.14], [0.55, 0.6, 0.2], [0.8, 0.5, 0.2]];
  for (let i = 0; i < 6; i++) { const sx = i < 3 ? -1 : 1, k = i % 3; P.basket(b, sx * (2.4 + k * 1.15), fy, hd - 1.0, 1.25, heap[i]); }
  for (let i = 0; i < 10; i++) { const sx = i % 2 ? -1 : 1; b.sphere('sack', 0.42, sx * (2.6 + (i % 3) * 0.9), fy + 0.28 + (i > 5 ? 0.5 : 0), 1.0 + Math.floor(i / 2) % 2 * 0.8, { sx: 1.3, sy: 0.7, sz: 0.9 }); }
  for (const sx of [-1, 1]) b.collider(sx * 3.5, 1.4, 1.4, 0.8, 0, 1.4);
  for (let i = 0; i < 8; i++) b.sphere('sack', 0.42, -hw + 1 + (i % 4) * 0.95, fy + 0.28 + Math.floor(i / 4) * 0.5, -hd + 0.8, { sx: 1.3, sy: 0.7, sz: 0.9 });
  P.chest(b, hw - 1.0, fy, -hd + 0.7, 0, 1.4); P.urn(b, hw - 0.8, fy, -1.2); P.urn(b, hw - 1.8, fy, -1.0, 0.85);
  b.box('plank', 1.6, 0.8, 0.7, 2.6, fy, -2.6, { tile: 0.8 }); P.lamp(b, 3.6, fy, -2.6, 0.9, 1);   // the counting desk
  b.box('paint', 0.34, 0.06, 0.26, 2.6, fy + 0.8, -2.6, { col: [0.3, 0.22, 0.16], ry: 0.2 });
  b.collider(2.6, -2.6, 0.85, 0.4, 0, 1.4);
  // skirt roof between the floors
  b.roofHip('roof', W + 4.4, D + 4.4, 1.15, W + 1.6, 0, y0 + gh - 0.1, 0);
  // upper floor: carved screens, a balcony over the door
  const uy = y0 + gh + 0.15, uh = 2.7;
  b.box('jali', W - 0.4, uh, D - 0.4, 0, uy, 0, { tile: 2.7 });
  b.box('plank', 4.2, 0.1, 1.5, 0, uy + 0.25, hd + 0.5, { tile: 1 });
  b.box('jali', 4.2, 0.95, 0.06, 0, uy + 0.35, hd + 1.22, { tile: 2.7 });
  for (const s of [-1, 1]) b.box('jali', 0.06, 0.95, 1.5, s * 2.1, uy + 0.35, hd + 0.5, { tile: 2.7 });
  b.roofHip('roof', W + 2.6, D + 2.6, 2.9, W - D + 1.5, 0, uy + uh - 0.12, 0);
  b.roofGable('roof', D / 2 + 2.6, 5.2, 1.9, 0, uy + uh - 0.1, hd / 2 + 1.0, Math.PI / 2, null);
  b.tri('gable', 4.9, 1.8, 0, uy + uh - 0.08, hd + 2.28, 0);
  b.cone('brass', 0.08, 0.6, 0, uy + uh + 1.75, hd + 2.2, { seg: 6, col: BRASS });
  for (const s of [-1, 1]) b.cone('wood', 0.07, 0.5, s * (W - D + 1.5) / 2, uy + uh + 2.75, 0, { seg: 6, col: DARKWOOD });
  for (let i = 0; i < 3; i++) b.box('stone', 3.0, 0.2, 0.5, 0, 0.36 - i * 0.18, hd + 1.4 + i * 0.5);
  b.lamp(1.6, y0 + 2.4, hd + 0.9, 1.2, 1);
  b.interior(0, 0, hw, hd, y0 + gh - 0.15);
  b.yard(13, 0.7).clear(11).mark(W + 2, D + 2);
  return { y0, hd };
}

// A Syrian Christian (Nasrani) house: L-shaped, carved gables, a pillared
// verandah in the angle, and the family's stone cross in the yard.
export function nasraniHouse(b, x, z, ry) {
  const y0 = 0.5, h = 2.8, wo = { dado: [0.5, 0.42, 0.36], shutter: [0.36, 0.3, 0.26] };
  b.place(x, z, ry);
  b.box('laterite', 12, 2.0, 7.5, 0, -1.5, 0); b.box('laterite', 6.4, 2.0, 6.4, -2.8, -1.5, 5.9); b.box('laterite', 6.8, 2.0, 3.2, 3.0, -1.5, 4.3);
  b.platform(0, 0, 6, 3.75, y0); b.platform(-2.8, 5.9, 3.2, 3.2, y0); b.platform(3.0, 4.3, 3.4, 1.6, y0);
  b.box('paint', 9.7, 0.03, 5.2, 0, y0, 0, { col: [0.42, 0.18, 0.13] }); b.box('paint', 4.1, 0.03, 5.3, -2.8, y0, 5.35, { col: [0.42, 0.18, 0.13] });
  wall(b, 'wall', -5, -2.75, 5, -2.75, y0, h, [{ at: 2.5, w: 0.9, kind: 'window' }, { at: 7.5, w: 0.9, kind: 'window' }], { ...wo, out: -1 });
  wall(b, 'wall', 5, -2.75, 5, 2.75, y0, h, [{ at: 2.75, w: 0.9, kind: 'window' }], { ...wo, out: 1 });
  wall(b, 'wall', -0.6, 2.75, 5, 2.75, y0, h, [{ at: 2.0, w: 1.2, kind: 'door' }, { at: 4.3, w: 0.9, kind: 'window' }], { ...wo, out: 1 });
  wall(b, 'wall', -0.6, 2.75, -0.6, 8, y0, h, [{ at: 2.9, w: 0.9, kind: 'window' }], { ...wo, out: 1 });
  wall(b, 'wall', -5, 8, -0.6, 8, y0, h, [{ at: 2.2, w: 1.3, kind: 'window', h: 1.2 }], { ...wo, out: 1 });
  wall(b, 'wall', -5, -2.75, -5, 8, y0, h, [{ at: 2.75, w: 0.9, kind: 'window' }, { at: 8, w: 0.9, kind: 'window' }], { ...wo, out: -1 });
  const yr = y0 + h - 0.15;
  b.roofGable('roof', 12.6, 8.2, 2.7, 0, yr, 0, 0, 'gable');
  b.roofGable('roof', 7.6, 6.9, 2.4, -2.8, yr, 5.6, Math.PI / 2, null);
  b.tri('gable', 6.5, 2.3, -2.8, yr + 0.03, 9.36, 0);
  b.cone('wood', 0.07, 0.5, -2.8, yr + 2.35, 9.3, { seg: 6, col: DARKWOOD });
  for (const s of [-1, 1]) b.cone('wood', 0.07, 0.5, s * 6.2, yr + 2.65, 0, { seg: 6, col: DARKWOOD });
  // verandah in the angle
  b.box('roof', 6.9, 0.12, 3.5, 2.9, y0 + 2.08, 4.5, { rx: 0.26, tile: 1.4 });
  for (let i = 0; i < 4; i++) { b.cyl('wall', 0.14, 0.17, 2.0, 0.2 + i * 1.95, y0, 5.7, { seg: 10 }); b.circle(0.2 + i * 1.95, 5.7, 0.18); }
  b.box('wood', 2.2, 0.42, 0.45, 4.2, y0, 3.25, { col: DARKWOOD });
  for (let i = 0; i < 2; i++) b.box('stone', 2.0, 0.26, 0.5, 1.4, 0.24 - i * 0.24, 6.1 + i * 0.5);
  // inside: a cot, the family chest, the lamp before the icon
  const fy = y0 + 0.03;
  b.box('plank', 1.9, 0.08, 0.95, -3.6, y0 + 0.42, 6.6, { tile: 0.8 }); for (const sx of [-0.85, 0.85]) for (const sz of [-0.4, 0.4]) b.box('wood', 0.08, 0.42, 0.08, -3.6 + sx, y0, 6.6 + sz);
  b.collider(-3.6, 6.6, 0.95, 0.5, 0, 1.3);
  P.chest(b, -4.4, fy, -1.9, Math.PI / 2, 1.3); P.mat(b, -2.8, fy, 3.6);
  b.box('plank', 1.5, 0.75, 0.8, 3.4, fy, -2.0, { tile: 0.8 }); b.collider(3.4, -2.0, 0.8, 0.45, 0, 1.3);
  b.box('wood', 0.07, 0.7, 0.03, 0, y0 + 1.5, -2.6, { col: DARKWOOD }); b.box('wood', 0.42, 0.07, 0.03, 0, y0 + 1.95, -2.6, { col: DARKWOOD });
  P.lamp(b, 0, fy, -2.2, 0.75, 0.8); P.hearth(b, 4.3, fy, 1.9); P.pot(b, 4.4, fy, 0.7, 0.9); P.urn(b, -4.3, fy, 0.6, 0.8);
  b.interior(0, 0, 5, 2.75, y0 + h + 0.5); b.interior(-2.8, 5.4, 2.2, 2.65, y0 + h + 0.5);
  // the kurisu on its stepped plinth
  const kx = 4.6, kz = 11.5;
  for (let i = 0; i < 3; i++) b.box('stone', 1.9 - i * 0.5, 0.3, 1.9 - i * 0.5, kx, i * 0.3, kz);
  b.box('stone', 0.3, 2.3, 0.3, kx, 0.9, kz); b.box('stone', 1.3, 0.3, 0.3, kx, 2.35, kz); b.box('stone', 0.44, 0.12, 0.44, kx, 3.2, kz);
  b.lamp(kx, 1.05, kz + 0.4, 0.6, 0); b.collider(kx, kz, 0.95, 0.95, 0, 3);
  // pepper vines trained up standards
  for (let i = 0; i < 5; i++) {
    const vx = 8.4, vz = -2 + i * 2.6;
    b.cyl('wood', 0.07, 0.09, 3.4, vx, 0, vz, { seg: 6 });
    b.cyl('paint', 0.17, 0.2, 2.9, vx, 0.25, vz, { seg: 7, col: [0.08, 0.2, 0.08] });
    for (let k = 0; k < 14; k++) b.sphere('paint', 0.13 + (k % 3) * 0.03, vx + Math.sin(k * 2.4) * 0.2, 0.4 + k * 0.2, vz + Math.cos(k * 2.4) * 0.2, { sy: 1.3, seg: 6, rings: 4, col: [0.1 + (k % 2) * 0.04, 0.26 + (k % 3) * 0.05, 0.09] });
    b.circle(vx, vz, 0.2);
  }
  b.yard(15, 0.7, 0, 3).clear(13, 0, 3).mark(12, 8).mark(6, 6, -2.8, 5.9);
  return { y0 };
}

// ---------------------------------------------------------------- street life
// a palm-leaf umbrella (olakkuda) propped against something
export function olakkuda(b, x, y, z, lean = 0.5, ry = 0) {
  b.cyl('wood', 0.014, 0.016, 1.25, x, y, z, { seg: 5, rz: lean, ry, col: DARKWOOD });
  b.cone('thatch', 0.55, 0.2, x - Math.sin(lean) * 0.62, y + Math.cos(lean) * 0.6 + 0.45, z, { seg: 12, rz: lean, col: [1.1, 1.0, 0.7] });
}
export function barrel(b, x, y, z, s = 1) {
  b.lathe('plank', [[0.001, 0], [0.26, 0], [0.33, 0.4], [0.26, 0.8], [0.001, 0.8]], x, y, z, { s, seg: 12, uv: [3, 1], col: [0.7, 0.58, 0.46] });
  for (const h of [0.14, 0.66]) b.cyl('paint', 0.3 * s, 0.3 * s, 0.035 * s, x, y + h * s, z, { seg: 12, open: true, col: [0.2, 0.2, 0.22] });
  b.circle(x, z, 0.36 * s);
}
export function toolbox(b, x, y, z, ry = 0) {
  b.box('plank', 0.62, 0.2, 0.28, x, y, z, { ry, tile: 0.6, col: [0.72, 0.6, 0.48] });
  b.box('wood', 0.03, 0.2, 0.03, x - Math.cos(ry) * 0.27, y + 0.2, z + Math.sin(ry) * 0.27, { ry }); b.box('wood', 0.03, 0.2, 0.03, x + Math.cos(ry) * 0.27, y + 0.2, z - Math.sin(ry) * 0.27, { ry });
  b.box('wood', 0.6, 0.035, 0.035, x, y + 0.38, z, { ry });
  b.box('paint', 0.3, 0.03, 0.05, x + 0.05, y + 0.2, z, { ry: ry + 0.3, col: [0.3, 0.3, 0.33] });
}
// a cast net heaped up with its lead weights showing
export function castNet(b, x, y, z, s = 1) {
  b.sphere('sack', 0.42 * s, x, y + 0.1 * s, z, { sy: 0.42, col: [0.55, 0.6, 0.52] });
  b.box('net', 1.3 * s, 0.02, 1.3 * s, x, y + 0.03, z, { ry: 0.6, tile: 0.25 });
  for (let i = 0; i < 9; i++) b.sphere('paint', 0.03 * s, x + Math.cos(i * 0.7) * 0.5 * s, y + 0.04, z + Math.sin(i * 0.7) * 0.5 * s, { seg: 5, rings: 4, col: [0.3, 0.3, 0.32] });
}
// punting poles and paddles stood against a rail
export function poles(b, x, y, z, ry = 0, n = 3) {
  for (let i = 0; i < n; i++) b.cyl('wood', 0.022, 0.028, 4.2 - i * 0.5, x + Math.cos(ry) * i * 0.16, y, z - Math.sin(ry) * i * 0.16, { seg: 5, rz: 0.1 + i * 0.03, rx: 0.06, col: [1.1, 0.95, 0.6] });
}
// shop awning of corrugated tin on two posts, with wares set out beneath
export function awning(b, x, z, w, y, depth = 2.2, goods = 0, skipX = 99) {
  b.box('tin', w, 0.04, depth + 0.3, x, y, z + depth / 2 - 0.1, { rx: 0.2, tile: 1.6 });
  for (const s of [-1, 1]) { b.cyl('wood', 0.05, 0.06, y - 0.25, x + s * (w / 2 - 0.15), 0, z + depth - 0.25, { seg: 6 }); b.circle(x + s * (w / 2 - 0.15), z + depth - 0.25, 0.1); }
  const heap = [[0.9, 0.62, 0.1], [0.72, 0.13, 0.08], [0.45, 0.3, 0.14], [0.55, 0.6, 0.2], [0.8, 0.8, 0.7], [0.3, 0.42, 0.2]];
  for (let i = 0; i < 4; i++) {
    const gx = x - w / 2 + 0.6 + i * (w - 1.2) / 3;
    if (Math.abs(gx - skipX) < 1.1) continue;
    if ((i + goods) % 3 === 0) b.sphere('sack', 0.36, gx, 0.24, z + depth * 0.45, { sx: 1.25, sy: 0.7 });
    else P.basket(b, gx, 0, z + depth * 0.45, 1.05, heap[(i + goods * 2) % 6]);
  }
}
// laterite compound wall round the current building, creepers trailing over it
export function compound(b, X, Zf, Zb, rng, gate = 2.2, h = 1.4) {
  const run = (x0, z0, x1, z1) => {
    const ax = Math.abs(x1 - x0) > Math.abs(z1 - z0), len = Math.hypot(x1 - x0, z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    b.box('laterite', ax ? len : 0.45, h + 1, ax ? 0.45 : len, cx, -1, cz);
    b.box('laterite', ax ? len : 0.6, 0.12, ax ? 0.6 : len, cx, h, cz, { col: [0.75, 0.7, 0.68] });
    b.collider(cx, cz, ax ? len / 2 : 0.23, ax ? 0.23 : len / 2, 0, h + 0.4);
    for (let i = 0, n = Math.round(len / 3.2); i < n; i++) {
      if (rng() < 0.45) continue;
      const u = (i + rng()) / n, px = x0 + (x1 - x0) * u, pz = z0 + (z1 - z0) * u;
      const gc = [0.11 + rng() * 0.06, 0.26 + rng() * 0.08, 0.09];
      b.sphere('paint', 0.45 + rng() * 0.25, px, h, pz, { sx: ax ? 1.5 : 0.8, sy: 0.6, sz: ax ? 0.8 : 1.5, col: gc });
      b.sphere('paint', 0.4, px + (ax ? 0.3 : 0.32), h - 0.5, pz + (ax ? 0.32 : 0.3), { sx: ax ? 1.1 : 0.35, sy: 1.1, sz: ax ? 0.35 : 1.1, col: gc });
      if (rng() < 0.4) b.sphere('paint', 0.15, px + 0.25, h + 0.22, pz + 0.25, { col: rng() < 0.5 ? [0.9, 0.35, 0.5] : [0.95, 0.8, 0.2] });
    }
  };
  run(-X, Zf, -gate, Zf); run(gate, Zf, X, Zf); run(-X, Zb, -X, Zf); run(X, Zb, X, Zf);
  for (const s of [-1, 1]) { b.box('laterite', 0.7, h + 1.7, 0.7, s * (gate + 0.2), -1, Zf); b.cone('laterite', 0.5, 0.35, s * (gate + 0.2), h + 0.7, Zf, { seg: 4, ry: Math.PI / 4, col: [0.75, 0.7, 0.68] }); b.collider(s * (gate + 0.2), Zf, 0.38, 0.38); }
}
