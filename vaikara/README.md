# VAIKARA — Malabar Coast, circa 1905

*Same waters. Same lands. Different stories.*

An open-world map of the fictional region of **Vaikara**, built in **three.js** with the **WebGPU** renderer
(it falls back to WebGL2 automatically). This is the world foundation: the whole hand-drawn map turned
into an 8 × 5.3 km landscape you can walk, swim and fly across. A placeholder character stands in until the
real cast is made.

## Run it

```bash
cd vaikara
npm install
npm run dev          # open the printed http://localhost:5173 link in Chrome or Edge
```

`npm run build` produces a static site in `dist/` that you can host anywhere (`npm run preview` serves it locally).
WebGPU needs a recent Chrome/Edge (or Safari 26+). Other browsers use the WebGL2 path with the same shaders.

### Controls

| Key | Action |
| --- | --- |
| `W A S D` | Walk (camera-relative) · `Shift` to run |
| `Space` | Jump · swim up |
| `E` | Board a moored vallam canoe / step ashore (`W A S D` to paddle, `Shift` to race) |
| `R` | Change the weather (clear → cloudy → rain → storm) |
| Mouse / wheel | Look / zoom (click the game to capture the mouse, `Esc` to release) |
| `M` | Map: click anywhere to travel there |
| `T` | Travel list: all 31 named places |
| `F` | Free-fly camera (`Space`/`C` up/down, wheel = speed, `Shift` = fast) |
| `[` `]` | Change the hour · `P` pause/resume time |
| `G` | Cycle graphics preset (Low / Medium / High / Ultra) |
| `H` | Help · `U` hide HUD |

Running and fast swimming use stamina (the bar at the bottom). The game autosaves every 10 s; the title screen offers **Continue**.

URL options for testing: `?at=vellar_falls` (start at a place), `?hour=18.2`, `?weather=storm`, `?q=ultra`, `?webgl` (force WebGL2),
`?cam=x,y,z,yaw,pitch` (start in fly-cam), `?board` (start in the nearest canoe).

## What's on the map

Every place on the parchment map is in the world, in the same arrangement:

- **Coast**: Lighthouse Point (red-and-white lighthouse), Muthalappuzha fishing village with Chinese fishing nets,
  the Mangrove Coast maze, Veliyathura harbour and its brick lighthouse, the Salt Pan Flats, Kayalore,
  the Abandoned Fort (bastions, breaches, cannons), the Southern Ferry.
- **River and backwaters**: the Vaikara river estuary, River Ghat steps, the 11-arch stone **Vaikara Bridge**,
  Kalliyar Ferry, and the long **Kuttan Canal** lagoon with cruising kettuvallam rice boats.
- **Vaikara Town**: a compact bazaar of terraced shophouse rows (shared roofs, lanes between them) around a town square with a banyan platform and well, walled house compounds along the lanes, the Old Bazaar stalls, **St. Thomas Church**,
  the **Juma Mosque**, the **Ponnambalam Temple** (gopuram, copper-roofed sreekovil, lamp pillar, temple tank),
  the **District Court** arcade and the **Colonial Residency** with its portico and walled garden.
- **Inland**: Thenga Paddy (rice fields with bunds), Puliyur, the Monsoon Shrine, Hill Trading Post, Karimulam
  with its railway station and train, the historic railway line.
- **Highlands**: the North Coast Road over **Black Rock Pass**, the **Kurumala Highlands** (up to ~670 m),
  the terraced **Kanmala Tea Estate** (bungalow, factory, workers' lines), **Vellar Falls** with its plunge-pool
  mist, the **Elephant Forest** (with a herd) and the **Old Teak Reserve**.

About 290,000 trees are placed from the map's biomes: coconut palms, jungle broadleaf, teak, mangroves and
banana; every house compound has its own garden. Near the camera you also get grass, rice, tea bushes and ferns.

**Life**: villagers walk the road edges, browse the bazaar and stand on the shore (busiest in the morning and
evening, fewer at night and in the rain); bullock carts plod the main roads; ferries cross at Kalliyar and the
southern channel on a timetable; canoes thread the mangroves; rice boats cruise the lagoon.

**Monsoon**: the weather drifts between clear, cloudy, rain and storm: an overcast sky, rain streaks, wet
glossy ground with puddles, ripples on the water, a heavier swell, lightning and thunder (sound is generated in
the browser: rain, wind, surf, thunder).

**Places to enter**: about 12 bazaar shops around the square (counters, shelves, sacks, a lamp) and 8 town
houses (two rooms, a cot, a chest, a lamp).

## How it's built

| Part | File(s) | Technique |
| --- | --- | --- |
| Map layout | `src/world/layout.js` | Coastline, rivers, roads, railway, zones and places traced by hand from the map (in map pixels → metres) |
| World bake | `scripts/bake.mjs` | Offline (Node): layout → 4097×2731 heightmap (≈2 m), splat maps, biome map, overview map. Rivers carved, roads and settlements flattened, a 46 m drop for Vellar Falls, tea terraces, paddy bunds, salt-pan grid |
| Terrain | `src/render/terrain.js` | Chunked LOD (2 m → 32 m) with skirts; 8-layer height-blended PBR splat (real CC0 textures), triplanar cliffs, macro variation, biome tint, wet shorelines; the map is mirrored past its edges so the horizon continues |
| Water | `src/render/water.js` | Camera-centred radial grid; Gerstner swell in the open sea that dies away in the sheltered lagoon; depth colour, shore foam, whitecaps, sky reflections; a flowing ribbon for the Vellar stream and falls |
| Sky & light | `src/render/sky.js` | Physical sky with clouds, day/night cycle (sunset over the Arabian Sea), moon, stars, cascaded shadow maps, sky-baked image-based light, distance haze and dawn mist |
| Post | `src/render/post.js` | GTAO ambient occlusion, bloom, ACES tone mapping, colour grade, vignette, FXAA |
| Flora | `src/render/trees.js`, `vegetation.js` | Procedural species with wind sway; full meshes near the camera, impostors (rendered from the real trees at load) far away, handed over per instance on the GPU |
| Buildings | `src/render/buildings/` | A kit of primitives (Kerala hip-and-gable roofs, arcades, domes, towers, stairs) merged into a few static meshes; every landmark has its own builder. Settlements are planned, not scattered: bazaar terraces only near the square, walled compounds every 40–70 m along lanes, fishing huts clustered on the shore facing the water, farmhouses on the paddy edge (~185 buildings in all) |
| Props | `src/render/props.js` | Boats, sailing ships, fishing nets, rocks, cannons, train, logs, elephants, birds |
| Player | `src/game/player.js`, `interact.js` | Placeholder Xbot mannequin (three.js examples) with idle/walk/run blending, collisions, decks (bridge, jetties, ghat), wading and swimming (sea and the Vellar stream), stamina, canoe paddling |
| Villagers | `src/game/npcs.js` | Pooled Xbot clones tinted by role; full skinned bodies near, instanced capsules far; routes from the road network |
| Traffic | `src/render/traffic.js` | Bullock carts, timetabled ferries, mangrove canoes |
| Weather | `src/render/weather.js`, `src/game/audio.js` | State machine driving shared uniforms (rain, storm, cloud, wind); GPU rain; overcast blended into the sky and environment light; WebAudio ambience |

### Changing the map

Edit `src/world/layout.js` (move a place, reshape the coast, add a road), then:

```bash
npm run bake     # ~30 s, rewrites public/assets/baked/
```

`npm run fetch-assets` re-downloads the CC0 textures and models (already included in `public/assets`).

## Credits

- Textures and the ship and fern models: [Poly Haven](https://polyhaven.com) (CC0). See `public/assets/CREDITS.md`.
- Placeholder character: `Xbot.glb` from the [three.js examples](https://github.com/mrdoob/three.js) (MIT).
- Everything else (terrain, trees, buildings, boats, water, sky) is generated in code.

## Next steps

- Replace the placeholder with the real character and an animation set.
- NPCs (traders, fishermen, officials) with daily routines in town and on the water.
- Interiors for key buildings, boats you can board, monsoon rain and storms.
- More hand-placed detail per landmark, matching each location sheet.
