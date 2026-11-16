// Life and props: moored and cruising boats (vallam canoes, kettuvallam rice
// boats, sailing ships offshore), Chinese fishing nets, an elephant herd,
// rocks, cannons on the fort, a train at Karimulam, teak logs, birds.
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { vec3, vec4, uv, texture, positionLocal, sin, float, attribute, instanceIndex, hash } from 'three/tsl';
import { G, U } from '../state.js';
import { getHeight, getSlope, getBiome, W } from '../world/data.js';
import { placeById as P, toWorld } from '../world/layout.js';
import { makeRng } from '../world/noise.js';
import { pbr } from './textures.js';
import { materials } from './buildings/kit.js';

const TAU = Math.PI * 2;
const loader = new GLTFLoader();
async function model(id) {
  try {
    const g = await loader.loadAsync(`${G.base}models/${id}/${id}.gltf`);
    g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material.map) o.material.map.colorSpace = THREE.SRGBColorSpace; } });
    return g.scene;
  } catch (e) { console.warn('model', id, e); return null; }
}

// Lofted boat hull: length L, beam B, depth D; upturned ends (Kerala style).
function hullGeometry(L, B, D, rise = 0.5, seg = 18) {
  const P = [], I = [], UV = [];
  const ring = 9;
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, x = (t - 0.5) * L;
    const w = Math.sin(Math.PI * t) ** 0.7 * B / 2 + 0.02;
    const end = Math.pow(Math.abs(t - 0.5) * 2, 3);
    const top = D + end * rise;
    for (let k = 0; k <= ring; k++) {
      const a = (k / ring) * Math.PI; // 0..π across the hull bottom
      const y = top - Math.sin(a) * D * (0.4 + 0.6 * Math.sin(Math.PI * t));
      const z = Math.cos(a) * w;
      P.push(x, y, z); UV.push(t * L / 2, k / ring);
    }
  }
  for (let i = 0; i < seg; i++) for (let k = 0; k < ring; k++) {
    const a = i * (ring + 1) + k, b = a + 1, c = a + ring + 1, d = c + 1;
    I.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  g.setIndex(I); g.computeVertexNormals();
  return g;
}

export class Props {
  constructor(scene) { this.scene = scene; this.movers = []; this.bobbers = []; this.herd = []; this.birds = null; }

  async build() {
    const M = materials();
    const wood = new THREE.MeshStandardNodeMaterial({ ...(() => { const s = pbr('wood'); return { map: s.map, normalMap: s.normalMap, roughnessMap: s.arm }; })(), color: 0x5a3f2c, side: THREE.DoubleSide, roughness: 1 });
    this.wood = wood;
    // ── boat templates
    const vallam = new THREE.Group();
    { const h = new THREE.Mesh(hullGeometry(7, 0.9, 0.45, 0.45), wood); h.castShadow = true; vallam.add(h);
      for (let i = -2; i <= 2; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.8), wood); b.position.set(i * 1.1, 0.38, 0); vallam.add(b); } }
    const kettu = new THREE.Group();
    { const h = new THREE.Mesh(hullGeometry(18, 3.2, 1.3, 1.1, 24), wood); h.castShadow = true; kettu.add(h);
      const can = new THREE.CylinderGeometry(1.75, 1.75, 11, 18, 1, true, 0, Math.PI);
      can.rotateZ(Math.PI / 2); can.rotateX(Math.PI / 2);
      const uvA = can.attributes.uv; for (let k = 0; k < uvA.count; k++) uvA.setXY(k, uvA.getX(k) * 4, uvA.getY(k) * 3);
      const c = new THREE.Mesh(can, M.thatch); c.position.y = 1.15; c.castShadow = true; kettu.add(c);
      const deck = new THREE.Mesh(new THREE.BoxGeometry(12, 0.12, 2.9), M.planks); deck.position.y = 1.15; kettu.add(deck); }
    // ── boats at every jetty and along village shores
    const rnd = makeRng(88);
    const jetties = (this.scene.userData.jetties) || [];
    const shorePts = [];
    for (const pl of [P.muthalappuzha, P.veliyathura, P.kayalore, P.southern_ferry, P.kalliyar_ferry, P.river_ghat, P.karimulam, P.thenga_paddy, P.mangrove]) {
      for (let i = 0; i < 40 && shorePts.filter((s) => s.pl === pl).length < 6; i++) {
        const a = rnd() * TAU, d = rnd() * pl.r * 1.3;
        const x = pl.x + Math.cos(a) * d, z = pl.z + Math.sin(a) * d;
        const h = getHeight(x, z);
        if (h < -0.6 && h > -3.5) shorePts.push({ x, z, pl });
      }
    }
    for (const s of shorePts) {
      const b = (rnd() < 0.75 ? vallam : kettu).clone();
      b.position.set(s.x, 0, s.z); b.rotation.y = rnd() * TAU;
      this.scene.add(b); this.bobbers.push({ o: b, ph: rnd() * TAU, base: 0 });
    }
    void jetties;
    // cruising rice boats on the Kuttan lagoon and canoes on the estuary
    const river = W.meta.rivers.vaikara;
    for (let i = 0; i < 7; i++) {
      const b = (i < 4 ? kettu : vallam).clone();
      this.scene.add(b);
      this.movers.push({ o: b, path: river, t: rnd(), speed: (i < 4 ? 0.0035 : 0.008) * (rnd() < 0.5 ? 1 : -1), lane: (rnd() - 0.5) * 0.5, ph: rnd() * TAU });
    }
    // sailing ships offshore + one at Veliyathura
    const ship = await model('dutch_ship_medium');
    if (ship) {
      const box = new THREE.Box3().setFromObject(ship); const size = box.getSize(new THREE.Vector3());
      const sc = 26 / Math.max(size.x, size.z);
      for (const [px, py, ry] of [[150, 380, 0.4], [90, 620, 2.2], [210, 760, 1.2], [300, 120, 2.8], [190, 540, 0.9]]) {
        const s = ship.clone(); s.scale.setScalar(sc);
        const [x, z] = toWorld(px, py);
        s.position.set(x, -box.min.y * sc * 0.25 - 1.2, z); s.rotation.y = ry;
        this.scene.add(s); this.bobbers.push({ o: s, ph: rnd() * TAU, base: s.position.y, roll: 0.03 });
      }
    }
    // ── Chinese fishing nets at Muthalappuzha and the estuary mouth
    this.buildNets(M, rnd);
    // ── rocks: Black Rock Pass, Lighthouse Point, the highlands
    await this.buildRocks(rnd);
    // ── cannons on the fort bastions
    if (this.scene.userData.cannons) {
      for (const [x, y, z, ry] of this.scene.userData.cannons) {
        const c = new THREE.Group();
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 2.6, 12), M.iron); barrel.rotation.x = Math.PI / 2 - 0.08; barrel.position.set(0, 0.9, 0.6);
        const carriage = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 1.8), this.wood); carriage.position.y = 0.45;
        c.add(barrel, carriage);
        for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.12, 12), this.wood); w.rotation.z = Math.PI / 2; w.position.set(sx * 0.52, 0.38, 0); c.add(w); }
        c.traverse((o) => { if (o.isMesh) o.castShadow = true; });
        c.position.set(x, y, z); c.rotation.y = ry; this.scene.add(c);
      }
    }
    // ── elephants in the Elephant Forest
    this.buildHerd(rnd);
    // ── train at Karimulam
    if (this.scene.userData.station) this.buildTrain(this.scene.userData.station, M);
    // ── teak logs
    this.buildLogs(rnd, wood);
    // ── birds over the backwaters
    this.buildBirds(rnd);
  }

  buildNets(M, rnd) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'); x.strokeStyle = 'rgba(40,32,24,0.9)'; x.lineWidth = 1.2;
    for (let i = 0; i <= 128; i += 8) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 128); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(128, i); x.stroke(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 5);
    const netMat = new THREE.MeshStandardNodeMaterial({ map: t, transparent: true, alphaTest: 0.2, side: THREE.DoubleSide, roughness: 1 });
    const spots = [];
    for (let i = 0; i < 400 && spots.length < 6; i++) {
      const base = i < 200 ? P.muthalappuzha : P.veliyathura;
      const a = rnd() * TAU, d = 60 + rnd() * base.r;
      const px = base.x + Math.cos(a) * d, pz = base.z + Math.sin(a) * d;
      if (getHeight(px, pz) > 0.8 && getHeight(px, pz) < 2.5) {
        // facing water
        let best = 0, bh = 99; for (let b = 0; b < TAU; b += 0.2) { const h = getHeight(px + Math.cos(b) * 14, pz + Math.sin(b) * 14); if (h < bh) { bh = h; best = b; } }
        if (bh < -0.8 && spots.every((s) => Math.hypot(s[0] - px, s[1] - pz) > 40)) spots.push([px, pz, best]);
      }
    }
    for (const [px, pz, a] of spots) {
      const g = new THREE.Group();
      const pole = (len, ang) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, len, 6), this.wood); m.geometry.translate(0, len / 2, 0); m.rotation.z = ang; m.castShadow = true; return m; };
      const p1 = pole(13, -0.95), p2 = pole(13, -0.95); p1.position.z = -1.2; p2.position.z = 1.2; p1.rotation.x = 0.12; p2.rotation.x = -0.12;
      g.add(p1, p2);
      const net = new THREE.Mesh(new THREE.PlaneGeometry(8, 8, 6, 6), netMat);
      const pos = net.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) { const u = pos.getX(i), v = pos.getY(i); pos.setZ(i, -(16 - u * u - v * v) * 0.12); }
      net.rotation.x = -Math.PI / 2; net.position.set(10, 1.2, 0);
      g.add(net);
      const back = pole(6, 0.9); back.position.x = 0; g.add(back);
      for (let k = 0; k < 4; k++) { const st = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 4), M.sandstone); st.position.set(-3 - k * 0.3, 4.2 - k * 0.5, 0); g.add(st); }
      g.position.set(px, getHeight(px, pz), pz);
      g.rotation.y = -a;
      this.scene.add(g);
    }
  }

  async buildRocks(rnd) {
    // procedural rocks: noise-displaced icosahedra with real rock textures
    const { makeNoise } = await import('../world/noise.js');
    const nz = makeNoise(5);
    const variants = [];
    for (let v = 0; v < 5; v++) {
      const g = new THREE.IcosahedronGeometry(1, 3);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const n = nz(x * 1.3 + v * 7, z * 1.3 + y * 0.9) * 0.28 + nz(x * 3.1 + v, y * 3.1 - z) * 0.1;
        const f = 1 + n;
        p.setXYZ(i, x * f * (1 + v * 0.08), Math.max(-0.35, y * f * (0.65 + 0.1 * v)), z * f);
      }
      g.computeVertexNormals();
      g.translate(0, 0.3, 0);
      variants.push(g);
    }
    const mk = (name, color) => { const s = pbr(name); return new THREE.MeshStandardNodeMaterial({ map: s.map, normalMap: s.normalMap, roughnessMap: s.arm, aoMap: s.arm, roughness: 1, color }); };
    const mats = { light: mk('rock', 0x9a9088), dark: mk('darkrock', 0x6a6460) };
    const zones = [
      { c: P.black_rock_pass, r: 280, n: 220, dark: true, scale: 5 },
      { c: P.lighthouse_point, r: 150, n: 60, scale: 2.5 },
      { c: P.kurumala, r: 700, n: 260, dark: true, scale: 8 },
      { c: P.vellar_falls, r: 160, n: 80, scale: 3.5 },
      { c: P.veliyathura, r: 170, n: 50, scale: 2.5 },
      { c: P.fort, r: 160, n: 40, scale: 2.5 },
      { c: P.elephant_forest, r: 400, n: 60, scale: 3 },
    ];
    const _q = new THREE.Quaternion(), _e = new THREE.Euler();
    const lists = { light: variants.map(() => []), dark: variants.map(() => []) };
    for (const z of zones) for (let i = 0; i < z.n; i++) {
      const a = rnd() * TAU, d = Math.sqrt(rnd()) * z.r;
      const x = z.c.x + Math.cos(a) * d, zz = z.c.z + Math.sin(a) * d;
      const h = getHeight(x, zz);
      if (h < -1) continue;
      const k = Math.floor(rnd() * variants.length);
      const s = z.scale * (0.3 + Math.pow(rnd(), 2) * 1.4);
      _e.set((rnd() - 0.5) * 0.5, rnd() * TAU, (rnd() - 0.5) * 0.5); _q.setFromEuler(_e);
      lists[z.dark ? 'dark' : 'light'][k].push(new THREE.Matrix4().compose(new THREE.Vector3(x, h - s * 0.25, zz), _q, new THREE.Vector3(s, s * (0.7 + rnd() * 0.5), s * (0.8 + rnd() * 0.4))));
      if (s > 1.2) G.colliders.addCircle(x, zz, s * 0.85, h - 1, h + s);
    }
    for (const kind of ['light', 'dark']) variants.forEach((g, k) => {
      const L = lists[kind][k];
      if (!L.length) return;
      const im = new THREE.InstancedMesh(g, mats[kind], L.length);
      L.forEach((m, i) => im.setMatrixAt(i, m));
      im.castShadow = true; im.receiveShadow = true;
      im.computeBoundingSphere();
      this.scene.add(im);
    });
  }

  buildHerd(rnd) {
    const mat = new THREE.MeshStandardNodeMaterial({ color: 0x4a4440, roughness: 0.95 });
    const make = (s) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), mat); body.scale.set(1.9, 1.35, 1.25); body.position.y = 2.2;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.85, 14, 10), mat); head.position.set(2.0, 2.7, 0); head.scale.set(1, 1.05, 0.9);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.32, 2.2, 8), mat); trunk.position.set(2.75, 1.7, 0); trunk.rotation.z = 0.25;
      g.add(body, head, trunk);
      for (const sz of [-1, 1]) { const ear = new THREE.Mesh(new THREE.CircleGeometry(0.75, 10), mat); ear.material = mat; ear.position.set(1.7, 2.8, sz * 0.75); ear.rotation.y = sz * 0.5 + Math.PI / 2; g.add(ear); }
      const legs = [];
      for (const [lx, lz] of [[1.2, 0.55], [1.2, -0.55], [-1.2, 0.55], [-1.2, -0.55]]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 1.9, 8), mat);
        leg.geometry.translate(0, -0.95, 0); leg.position.set(lx, 1.9, lz); g.add(leg); legs.push(leg);
      }
      g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      g.scale.setScalar(s);
      return { g, legs };
    };
    const c = P.elephant_forest;
    for (let i = 0; i < 6; i++) {
      const e = make(i === 5 ? 0.55 : 0.9 + rnd() * 0.2);
      const a = rnd() * TAU, d = rnd() * 60;
      e.x = c.x + Math.cos(a) * d; e.z = c.z + Math.sin(a) * d; e.h = rnd() * TAU; e.ph = rnd() * TAU;
      this.scene.add(e.g); this.herd.push(e);
    }
    this.herdC = { x: c.x, z: c.z };
  }

  buildTrain(st, M) {
    const g = new THREE.Group();
    const black = M.iron, red = new THREE.MeshStandardNodeMaterial({ color: 0x5a1e16, roughness: 0.7 });
    const boiler = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 6, 16), black); boiler.rotation.z = Math.PI / 2; boiler.position.set(0, 2.2, 0);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.6, 2.6), black); cab.position.set(-3.8, 2.7, 0);
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.25, 1.5, 10), black); stack.position.set(2.2, 3.7, 0);
    g.add(boiler, cab, stack);
    for (let i = -2; i <= 1; i++) for (const sz of [-1, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.2, 14), red); w.rotation.x = Math.PI / 2; w.position.set(i * 1.6 + 0.4, 0.95, sz * 1.0); g.add(w); }
    for (let c = 0; c < 3; c++) {
      const car = new THREE.Mesh(new THREE.BoxGeometry(9, 2.8, 2.8), c % 2 ? red : M.planks); car.position.set(-10 - c * 10, 2.6, 0); g.add(car);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.2, 3.1), black); roof.position.set(-10 - c * 10, 4.1, 0); g.add(roof);
    }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    const line = W.meta.rail;
    const [ax, az] = line[1], [bx, bz] = line[2];
    const ry = Math.atan2(-(bz - az), bx - ax);
    g.position.set((ax + bx) / 2, getHeight((ax + bx) / 2, (az + bz) / 2) + 0.25, (az + bz) / 2);
    g.rotation.y = ry;
    this.scene.add(g);
    void st;
  }

  buildLogs(rnd, wood) {
    const c = P.teak_reserve;
    const s = pbr('bark');
    const bark = new THREE.MeshStandardNodeMaterial({ map: s.map, normalMap: s.normalMap, roughness: 1, color: 0x8a7a68 });
    const parts = [];
    for (let p = 0; p < 8; p++) {
      const a = rnd() * TAU, d = rnd() * 200;
      const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
      if (getSlope(x, z) > 0.3) continue;
      const y = getHeight(x, z), ry = rnd() * TAU;
      for (let row = 0; row < 3; row++) for (let k = 0; k < 4 - row; k++) {
        const g = new THREE.CylinderGeometry(0.42, 0.45, 8, 10); g.rotateZ(Math.PI / 2);
        g.translate(0, 0.45 + row * 0.8, (k - (3 - row) / 2) * 0.9);
        g.rotateY(ry); g.translate(x, y, z);
        parts.push(g);
      }
      G.colliders.addBox(x, z, 4.2, 2, ry, y, y + 3);
    }
    if (parts.length) { const m = new THREE.Mesh(mergeGeometries(parts.map((g) => g.toNonIndexed())), bark); m.castShadow = true; m.receiveShadow = true; this.scene.add(m); }
    void wood;
  }

  buildBirds(rnd) {
    const n = 90;
    const g = new THREE.BufferGeometry();
    const P2 = [], seed = [];
    for (let i = 0; i < n; i++) {
      // a simple "V": two triangles sharing the body point
      P2.push(-0.6, 0, -0.2, 0, 0, 0.2, 0, 0, -0.1, 0.6, 0, -0.2, 0, 0, 0.2, 0, 0, -0.1);
      for (let k = 0; k < 6; k++) seed.push(i);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(P2, 3));
    g.setAttribute('seed', new THREE.Float32BufferAttribute(seed, 1));
    const m = new THREE.MeshBasicNodeMaterial({ color: 0x1a1612, side: THREE.DoubleSide });
    const sd = attribute('seed', 'float');
    const t = U.time;
    const flock = sd.mod(3);
    const ang = t.mul(0.06).add(sd.mul(0.37));
    const r = float(140).add(sd.mul(7.3).mod(120));
    const centres = [toWorld(560, 560), toWorld(980, 720), toWorld(380, 400)];
    const cx = flock.equal(0).select(centres[0][0], flock.equal(1).select(centres[1][0], centres[2][0]));
    const cz = flock.equal(0).select(centres[0][1], flock.equal(1).select(centres[1][1], centres[2][1]));
    const flap = sin(t.mul(9).add(sd)).mul(positionLocal.x.abs()).mul(0.5);
    m.positionNode = vec3(
      positionLocal.x.mul(2.2).add(cx).add(ang.cos().mul(r)),
      positionLocal.y.add(flap).add(45).add(sin(t.mul(0.3).add(sd)).mul(10)),
      positionLocal.z.mul(2.2).add(cz).add(ang.sin().mul(r)),
    );
    const mesh = new THREE.Mesh(g, m);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    void rnd;
  }

  update(dt) {
    const t = G.time;
    for (const b of this.bobbers) {
      b.o.position.y = b.base + Math.sin(t * 1.3 + b.ph) * 0.06;
      b.o.rotation.z = Math.sin(t * 0.9 + b.ph) * (b.roll || 0.025);
    }
    for (const m of this.movers) {
      const n = m.path.length - 1;
      m.t += m.speed * dt * 0.1;
      if (m.t > 1 || m.t < 0.18) { m.speed *= -1; m.t = Math.min(1, Math.max(0.18, m.t)); }
      const f = m.t * n, i = Math.min(n - 1, Math.floor(f)), u = f - i;
      const a = m.path[i], b = m.path[i + 1];
      const x = a[0] + (b[0] - a[0]) * u, z = a[1] + (b[1] - a[1]) * u, w = a[2] + (b[2] - a[2]) * u;
      const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
      const ox = -dz / l * w * m.lane * 0.8, oz = dx / l * w * m.lane * 0.8;
      m.o.position.set(x + ox, Math.sin(t * 1.2 + m.ph) * 0.05, z + oz);
      m.o.rotation.y = Math.atan2(-dz, dx) + (m.speed < 0 ? Math.PI : 0);
    }
    // the herd ambles around its glade
    for (const e of this.herd) {
      e.h += Math.sin(t * 0.05 + e.ph) * dt * 0.08;
      const dx = this.herdC.x - e.x, dz = this.herdC.z - e.z;
      if (Math.hypot(dx, dz) > 90) e.h = Math.atan2(-dz, dx) * -1 + Math.PI / 2 * 0;
      const sp = 0.7;
      e.x += Math.cos(e.h) * sp * dt; e.z -= Math.sin(e.h) * sp * dt;
      if (Math.hypot(this.herdC.x - e.x, this.herdC.z - e.z) > 100) { e.h = Math.atan2(-(this.herdC.z - e.z), this.herdC.x - e.x); }
      e.g.position.set(e.x, getHeight(e.x, e.z) - 0.1, e.z);
      e.g.rotation.y = e.h;
      const sw = Math.sin(t * 2.2 + e.ph);
      e.legs.forEach((l, k) => { l.rotation.z = sw * 0.25 * (k % 2 ? 1 : -1) * (k < 2 ? 1 : -1); });
    }
  }
}
void vec4; void uv; void texture; void instanceIndex; void hash; void getBiome;
