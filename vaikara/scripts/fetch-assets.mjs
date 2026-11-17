// Downloads the CC0 assets Vaikara uses (Poly Haven + the three.js example
// mannequin) and packs the terrain layers into two texture-array strips.
//   npm run fetch-assets
import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'public/assets');
const API = 'https://api.polyhaven.com';
const RES = '1k';

// Terrain splat layers — order matters (index used by the bake + shader).
export const TERRAIN = [
  ['grass', 'leafy_grass'],
  ['forest', 'forest_leaves_02'],
  ['laterite', 'red_laterite_soil_stones'],
  ['road', 'red_dirt_mud_01'],
  ['sand', 'coast_sand_01'],
  ['mud', 'brown_mud_02'],
  ['rock', 'rock_face'],
  ['meadow', 'sparse_grass'],
];

// Material sets for buildings, trees and props.
const MATERIALS = [
  ['roof', 'clay_roof_tiles'],
  ['thatch', 'thatch_roof_angled'],
  ['plaster', 'white_plaster_rough_01'],
  ['yplaster', 'yellow_plaster'],
  ['laterite', 'castle_brick_02_red'],
  ['fortstone', 'mossy_stone_wall'],
  ['sandstone', 'large_sandstone_blocks'],
  ['planks', 'wood_planks_grey'],
  ['wood', 'rough_wood'],
  ['palmbark', 'palm_tree_bark'],
  ['bark', 'bark_brown_02'],
  ['rock', 'rock_face'],
  ['darkrock', 'dark_rock'],
];

const MODELS = ['fern_02', 'dutch_ship_medium'];

const exists = (p) => access(p).then(() => true, () => false);

async function get(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return Buffer.from(await r.arrayBuffer());
    } catch (e) {
      if (i === tries - 1) throw e;
      await new Promise((s) => setTimeout(s, 800 * 2 ** i));
    }
  }
}
const json = async (url) => JSON.parse((await get(url)).toString());

async function save(path, buf) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, buf);
}

function pick(files, keys) {
  for (const k of keys) if (files[k]?.[RES]?.jpg?.url) return files[k][RES].jpg.url;
  for (const k of keys) if (files[k]?.[RES]?.png?.url) return files[k][RES].png.url;
  return null;
}

async function textureSet(id) {
  const f = await json(`${API}/files/${id}`);
  const col = pick(f, ['Diffuse', 'diff', 'Color']);
  const nrm = pick(f, ['nor_gl', 'Normal']);
  const arm = pick(f, ['arm']);
  const rough = pick(f, ['Rough', 'rough']);
  const ao = pick(f, ['AO', 'ao']);
  const disp = pick(f, ['Displacement', 'disp']);
  const out = {};
  for (const [k, u] of Object.entries({ col, nrm, arm, rough, ao, disp })) if (u) out[k] = await get(u);
  return out;
}

const S = 1024;
const raw = (buf, ch) => sharp(buf).resize(S, S).removeAlpha().extractChannel(ch).raw().toBuffer();
const rgb = (buf) => sharp(buf).resize(S, S).removeAlpha().raw().toBuffer();

async function packTerrain() {
  const albedo = Buffer.alloc(S * S * TERRAIN.length * 4);
  const normal = Buffer.alloc(S * S * TERRAIN.length * 4);
  for (let L = 0; L < TERRAIN.length; L++) {
    const [name, id] = TERRAIN[L];
    console.log('  terrain', name, '←', id);
    const t = await textureSet(id);
    const c = await rgb(t.col);
    const n = await rgb(t.nrm);
    const r = t.arm ? await raw(t.arm, 1) : t.rough ? await raw(t.rough, 0) : Buffer.alloc(S * S, 200);
    const a = t.arm ? await raw(t.arm, 0) : t.ao ? await raw(t.ao, 0) : Buffer.alloc(S * S, 255);
    const h = t.disp ? await raw(t.disp, 0) : Buffer.alloc(S * S, 128);
    const o = L * S * S * 4;
    for (let i = 0; i < S * S; i++) {
      albedo[o + i * 4] = c[i * 3]; albedo[o + i * 4 + 1] = c[i * 3 + 1]; albedo[o + i * 4 + 2] = c[i * 3 + 2];
      albedo[o + i * 4 + 3] = r[i];
      normal[o + i * 4] = n[i * 3]; normal[o + i * 4 + 1] = n[i * 3 + 1];
      normal[o + i * 4 + 2] = a[i]; normal[o + i * 4 + 3] = h[i];
    }
  }
  const opts = { raw: { width: S, height: S * TERRAIN.length, channels: 4 } };
  await save(join(OUT, 'tex/terrain_albedo.webp'), await sharp(albedo, opts).webp({ quality: 88, alphaQuality: 90 }).toBuffer());
  await save(join(OUT, 'tex/terrain_normal.webp'), await sharp(normal, opts).webp({ quality: 92, alphaQuality: 92 }).toBuffer());
}

async function materials() {
  for (const [name, id] of MATERIALS) {
    const dir = join(OUT, 'tex', name);
    if (await exists(join(dir, 'col.jpg'))) continue;
    console.log('  material', name, '←', id);
    const t = await textureSet(id);
    await save(join(dir, 'col.jpg'), await sharp(t.col).resize(S, S).jpeg({ quality: 88 }).toBuffer());
    await save(join(dir, 'nrm.jpg'), await sharp(t.nrm).resize(S, S).jpeg({ quality: 92 }).toBuffer());
    let arm = t.arm;
    if (!arm) {
      const r = t.rough ? await raw(t.rough, 0) : Buffer.alloc(S * S, 200);
      const a = t.ao ? await raw(t.ao, 0) : Buffer.alloc(S * S, 255);
      const b = Buffer.alloc(S * S * 3);
      for (let i = 0; i < S * S; i++) { b[i * 3] = a[i]; b[i * 3 + 1] = r[i]; b[i * 3 + 2] = 0; }
      arm = await sharp(b, { raw: { width: S, height: S, channels: 3 } }).jpeg().toBuffer();
    }
    await save(join(dir, 'arm.jpg'), await sharp(arm).resize(S, S).jpeg({ quality: 90 }).toBuffer());
  }
}

async function models() {
  for (const id of MODELS) {
    const dir = join(OUT, 'models', id);
    if (await exists(join(dir, `${id}.gltf`))) continue;
    console.log('  model', id);
    const f = await json(`${API}/files/${id}`);
    const g = f.gltf[RES].gltf;
    await save(join(dir, `${id}.gltf`), await get(g.url));
    for (const [p, v] of Object.entries(g.include || {})) await save(join(dir, p), await get(v.url));
  }
  const xbot = join(OUT, 'models/Xbot.glb');
  if (!(await exists(xbot))) {
    console.log('  model Xbot (three.js examples)');
    await save(xbot, await get('https://raw.githubusercontent.com/mrdoob/three.js/r180/examples/models/gltf/Xbot.glb'));
  }
}

console.log('Fetching CC0 assets into public/assets …');
if (!(await exists(join(OUT, 'tex/terrain_albedo.webp')))) await packTerrain();
await materials();
await models();
console.log('done.');
