// Static colliders: oriented boxes (buildings, walls) and circles (trunks,
// posts) in a spatial hash; the player capsule is resolved against them in XZ.
const CELL = 32;
export class Colliders {
  constructor() { this.hash = new Map(); this.decks = []; }
  key(i, j) { return i * 73856093 ^ j * 19349663; }
  insert(o, minx, minz, maxx, maxz) {
    for (let i = Math.floor(minx / CELL); i <= Math.floor(maxx / CELL); i++)
      for (let j = Math.floor(minz / CELL); j <= Math.floor(maxz / CELL); j++) {
        const k = this.key(i, j);
        if (!this.hash.has(k)) this.hash.set(k, []);
        this.hash.get(k).push(o);
      }
  }
  // box centred at (x,z), half sizes hx,hz, rotation ry; y range [y0,y1]
  addBox(x, z, hx, hz, ry, y0 = -100, y1 = 1000) {
    const c = Math.cos(ry), s = Math.sin(ry), r = Math.abs(hx * c) + Math.abs(hz * s), r2 = Math.abs(hx * s) + Math.abs(hz * c);
    this.insert({ t: 0, x, z, hx, hz, c, s, y0, y1 }, x - r, z - r2, x + r, z + r2);
  }
  addCircle(x, z, r, y0 = -100, y1 = 1000) { this.insert({ t: 1, x, z, r, y0, y1 }, x - r, z - r, x + r, z + r); }
  // walkable raised surfaces (bridge decks, jetties, plinths): box with a top height
  addDeck(x, z, hx, hz, ry, y) {
    const c = Math.cos(ry), s = Math.sin(ry), r = Math.abs(hx * c) + Math.abs(hz * s), r2 = Math.abs(hx * s) + Math.abs(hz * c);
    this.insert({ t: 2, x, z, hx, hz, c, s, y }, x - r, z - r2, x + r, z + r2);
  }
  // is a footprint of radius r at (x,z) free of buildings?
  blocked(x, z, r) {
    for (const o of this.near(x, z)) {
      if (o.t === 1) { if (Math.hypot(x - o.x, z - o.z) < o.r + r) return true; continue; }
      const dx = x - o.x, dz = z - o.z, lx = dx * o.c - dz * o.s, lz = dx * o.s + dz * o.c;
      if (Math.abs(lx) < o.hx + r && Math.abs(lz) < o.hz + r) return true;
    }
    return false;
  }
  near(x, z) { return this.hash.get(this.key(Math.floor(x / CELL), Math.floor(z / CELL))) || []; }
  deckHeight(x, z, footY) {
    let best = -Infinity;
    for (const o of this.near(x, z)) {
      if (o.t !== 2) continue;
      const dx = x - o.x, dz = z - o.z, lx = dx * o.c - dz * o.s, lz = dx * o.s + dz * o.c;
      if (Math.abs(lx) <= o.hx && Math.abs(lz) <= o.hz && o.y <= footY + 0.6) best = Math.max(best, o.y);
    }
    return best;
  }
  resolve(p, radius, y) {
    for (const o of this.near(p.x, p.z)) {
      if (o.t === 2 || y > o.y1 || y + 1.7 < o.y0) continue;
      if (o.t === 1) {
        const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), m = o.r + radius;
        if (d < m && d > 1e-5) { p.x = o.x + dx / d * m; p.z = o.z + dz / d * m; }
      } else {
        const dx = p.x - o.x, dz = p.z - o.z;
        const lx = dx * o.c - dz * o.s, lz = dx * o.s + dz * o.c;
        const cx = Math.max(-o.hx, Math.min(o.hx, lx)), cz = Math.max(-o.hz, Math.min(o.hz, lz));
        let ex = lx - cx, ez = lz - cz, d = Math.hypot(ex, ez);
        if (d < radius) {
          let nlx, nlz;
          if (d > 1e-5) { nlx = cx + ex / d * radius; nlz = cz + ez / d * radius; }
          else { // inside: push out the nearest face
            const px = o.hx - Math.abs(lx), pz = o.hz - Math.abs(lz);
            if (px < pz) { nlx = Math.sign(lx || 1) * (o.hx + radius); nlz = lz; } else { nlx = lx; nlz = Math.sign(lz || 1) * (o.hz + radius); }
          }
          p.x = o.x + nlx * o.c + nlz * o.s; p.z = o.z - nlx * o.s + nlz * o.c;
        }
      }
    }
  }
}
