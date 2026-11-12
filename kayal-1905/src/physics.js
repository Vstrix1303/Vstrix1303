// Tiny 2.5D collision world: tree trunks are circles, buildings are oriented
// boxes, jetties and bridges are walkable platforms above the terrain.
import { getHeight } from './heightfield.js';

const CELLSZ = 16;
const hash = new Map();
const key = (cx, cz) => cx * 73856093 ^ cz * 19349663;
export const boxes = [];
export const platforms = [];

function insert(obj, x, z, r) {
  const x0 = Math.floor((x - r) / CELLSZ), x1 = Math.floor((x + r) / CELLSZ);
  const z0 = Math.floor((z - r) / CELLSZ), z1 = Math.floor((z + r) / CELLSZ);
  for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
    const k = key(cx, cz);
    let arr = hash.get(k);
    if (!arr) hash.set(k, (arr = []));
    arr.push(obj);
  }
}

export function addCircle(x, z, r) {
  insert({ t: 0, x, z, r }, x, z, r);
}

// Oriented box. rot = rotation about Y (same convention as three.js)
export function addBox(x, z, hw, hd, rot = 0, top = 50) {
  const b = { t: 1, x, z, hw, hd, c: Math.cos(rot), s: Math.sin(rot), top };
  boxes.push(b);
  insert(b, x, z, Math.hypot(hw, hd));
  return b;
}

export function addPlatform(x, z, hw, hd, rot, y) {
  platforms.push({ x, z, hw, hd, c: Math.cos(rot), s: Math.sin(rot), y });
}

// world -> box local (inverse of rotation about Y by rot)
function toLocal(b, x, z) {
  const dx = x - b.x, dz = z - b.z;
  return [dx * b.c - dz * b.s, dx * b.s + dz * b.c];
}

export function groundAt(x, z, curY = 1e9) {
  let h = getHeight(x, z);
  for (let i = 0; i < platforms.length; i++) {
    const p = platforms[i];
    if (Math.abs(x - p.x) > 60 || Math.abs(z - p.z) > 60) continue;
    const [lx, lz] = toLocal(p, x, z);
    if (Math.abs(lx) <= p.hw && Math.abs(lz) <= p.hd && p.y > h && curY > p.y - 1.2) h = p.y;
  }
  return h;
}

export function onPlatform(x, z) {
  for (let i = 0; i < platforms.length; i++) {
    const p = platforms[i];
    const [lx, lz] = toLocal(p, x, z);
    if (Math.abs(lx) <= p.hw && Math.abs(lz) <= p.hd) return p;
  }
  return null;
}

// Push a circle (pos.x,pos.z,r) out of every obstacle
export function resolve(pos, r, y = 0) {
  const cx = Math.floor(pos.x / CELLSZ), cz = Math.floor(pos.z / CELLSZ);
  for (let ix = cx - 1; ix <= cx + 1; ix++) for (let iz = cz - 1; iz <= cz + 1; iz++) {
    const arr = hash.get(key(ix, iz));
    if (!arr) continue;
    for (let i = 0; i < arr.length; i++) {
      const o = arr[i];
      if (o.t === 0) {
        const dx = pos.x - o.x, dz = pos.z - o.z;
        const d2 = dx * dx + dz * dz, rr = r + o.r;
        if (d2 < rr * rr && d2 > 1e-8) {
          const d = Math.sqrt(d2), push = (rr - d) / d;
          pos.x += dx * push; pos.z += dz * push;
        }
      } else {
        if (y > o.top) continue;
        const [lx, lz] = toLocal(o, pos.x, pos.z);
        const ex = o.hw + r, ez = o.hd + r;
        if (Math.abs(lx) < ex && Math.abs(lz) < ez) {
          const px = ex - Math.abs(lx), pz = ez - Math.abs(lz);
          let nlx = lx, nlz = lz;
          if (px < pz) nlx = Math.sign(lx || 1) * ex; else nlz = Math.sign(lz || 1) * ez;
          // local -> world
          pos.x = o.x + nlx * o.c + nlz * o.s;
          pos.z = o.z - nlx * o.s + nlz * o.c;
        }
      }
    }
  }
}

export function pointInBox(x, z, pad = 0) {
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (Math.abs(x - b.x) > 40 || Math.abs(z - b.z) > 40) continue;
    const [lx, lz] = toLocal(b, x, z);
    if (Math.abs(lx) < b.hw + pad && Math.abs(lz) < b.hd + pad) return b;
  }
  return null;
}

// Line of sight between two points against buildings (2D)
export function segmentBlocked(ax, az, bx, bz) {
  const len = Math.hypot(bx - ax, bz - az);
  const steps = Math.max(2, Math.ceil(len / 0.8));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (pointInBox(ax + (bx - ax) * t, az + (bz - az) * t)) return true;
  }
  return false;
}

// Roofed interiors: the camera pulls in close and stays under the ceiling.
export const interiors = [];
export function addInterior(x, z, hw, hd, rot, ceil) {
  interiors.push({ x, z, hw, hd, c: Math.cos(rot), s: Math.sin(rot), ceil });
}
export function interiorAt(x, z) {
  for (let i = 0; i < interiors.length; i++) {
    const b = interiors[i];
    if (Math.abs(x - b.x) > 40 || Math.abs(z - b.z) > 40) continue;
    const [lx, lz] = toLocal(b, x, z);
    if (Math.abs(lx) < b.hw && Math.abs(lz) < b.hd) return b;
  }
  return null;
}
