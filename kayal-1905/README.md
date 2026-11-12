# KAYAL — Travancore, 1905

*കായൽ (kayal): the backwaters of Kerala.*

A single-player, story-driven **open-world** adventure set on the Malabar coast in the monsoon of 1905.
You are **Madhavan**, a boatman's son home after six years on the Bombay docks, to find the family
pepper garden about to be seized by a trading company's forged debt ledger. Walk, ride and paddle
across a hand-built slice of old Travancore to set it right — and then face the Company's senior
partner when he comes from Madras to undo it.

It is a browser game: **one self-contained file, no installs, no downloads, no image or audio assets** —
every texture, model, animation, sound effect and note of music is generated procedurally at load time.

## Play

1. Open **`index.html`** in a recent desktop browser (Chrome, Edge, Firefox, Safari 17+).
   Double-clicking the file works; there is nothing to serve.
2. Click **New Game**. Click once more on the game to capture the mouse.

| Key | Action |
| --- | --- |
| `W A S D` | Move · steer the horse / boat (camera-relative) |
| Mouse / wheel | Look / zoom |
| `Shift` | Run · gallop · racing stroke (uses stamina) |
| `Space` / `C` | Jump / crouch (stealth) |
| `E` | Talk · begin a mission · gather · mount · board · dismount |
| Left click / `F` | Strike with your staff |
| Right click / `Q` | Block — block just as a blow lands to stagger the attacker |
| `M` | **The map**: drag to pan, wheel to zoom, click to set a waypoint |
| `X` | Whistle for your horse (once Sultan is yours) |
| `P` | Photo mode (orbit camera, HUD off; `[` `]` change the hour, `R` toggles rain) |
| `H` / `Esc` | Hide HUD / pause |

Touch devices get an on-screen stick and buttons, though a keyboard and mouse is the intended way to play.
The **Graphics** button on the title screen switches Low / Medium / High; the game also lowers its
resolution automatically if the frame rate drops.

## The story — nine missions in two acts

Between missions the world is yours. Each mission begins at a ring of light beside the person who
needs you (a lettered marker on the map).

**Act I — The Red Ledger**

| Mission | What you do |
| --- | --- |
| **Homecoming** | Arrive by boat at dawn and walk home through the village |
| **Black Gold** | Bring in the pepper harvest — and defend it |
| **The Backwater Run** | Paddle a loaded *vallam* across the lake as the monsoon breaks |
| **The Red Ledger** | Slip into the Company compound before dawn, then ride for the hill court with riders on your tail |

**Act II — The House of Harrow**

| Mission | What you do |
| --- | --- |
| **The Senior Partner** | Carry Devaki up to the Cutcherry on horseback; gather sworn receipts from three farmsteads |
| **Fire on the Quay** | Fight a warehouse fire with a bucket chain, then ride down the man who lit it |
| **Vallamkali** | Steer the village snake-boat in the regatta against the Company's hired crew |
| **The Elephant Road** | Free a witness from the tea estate at night — and walk your horse past a wild herd |
| **Storm over the Kayal** | A boat chase through a monsoon storm and a duel under the lighthouse |

## The open world

About 1.6 km × 1.6 km, with terrain to the horizon:

- **Thekkumkara** — the home village, the family *tharavadu*, a temple with lamp tower and stepped tank, a toddy shop on the canal towpath.
- **The kayal** — a great lake with an island shrine, drifting *kettuvallam* rice boats, lotus ponds, and **Lotus Falls** at the foot of the hills.
- **Puthenthura** — a spice port: market, Kerala-style mosque, Syrian Christian church, Chinese fishing nets, the walled Company compound.
- **The bar** — a sand-spit between lake and sea, cut by a tidal channel: the **Azhimukham lighthouse** and the fishing hamlet of **Azhikkal**.
- **The Western Ghats** — pepper gardens, rainforest, a serpent grove, wild elephants, **Kannimala tea estate** with its factory, and the hill-top Cutcherry.
- **Kottappuram** — a ruined Dutch fort on the south shore.

Things to do between missions: discover the named places · find the **12 lost ledger pages** ·
fish from the jetties · take **ferries** between jetties · run cargo for the quay clerk · buy a glass of
chaya · visit the **tailor** in Puthenthura for new clothes. Money is kept in rupees and annas.

## What changed in version 2

- **Characters rebuilt from scratch.** Every person is now a single skinned mesh lofted from anatomical
  cross-sections, wrapped in a painted texture (faces, hair, bare skin, shirts, jackets, uniforms,
  *mundu* with *kasavu* border). Clothing is part of the body surface and the *mundu* is weighted to both
  legs, so cloth no longer clips through limbs. Horses and cattle use the same construction.
- **Open-world structure** with mission markers, money, a save that remembers everything, a full-screen
  **map** and waypoints, and side activities.
- **Act II**: five new missions, new cast (Sir Edmund Harrow, Captain Dacre, Velu, the Assistant Resident),
  new mechanics (blocking and parrying, a boss duel, pillion riding, fire-fighting, a regatta, elephants).
- **New places**: lighthouse, fishing hamlet, sea channel, tea estate and factory, waterfall, fort ruin,
  serpent grove, toddy shop.
- **Visuals**: particle effects (hearth smoke, fire, embers, dust, spray, waterfall mist), undergrowth
  and boulders, richer buildings, a turning lighthouse beam.

## Version 3 — the visual pass

- **Atmosphere**: hazy, warm, ambient-heavy lighting with soft shadows and a gentle colour filter — the
  look of open-world games of the early 2000s — and long orange evenings.
- **Surfaces**: every texture is weathered (grain, damp, drip-streaks, cracks); the ground has real
  detail — trodden earth with pebbles and ruts, rough turf.
- **Street furniture**: a telegraph line from the port to the hill court, hand-painted signboards in
  English and Malayalam, palm-leaf fences, washing lines, barred and shuttered windows.
- **Characters**: heavier-set proportions and baked shading.
- **HUD**: status cluster top-right (what is in hand, stamina, health, purse), a square radar
  bottom-left, the place-name bottom-right, outlined type throughout.

## A note on the setting

Travancore in 1905 was a princely state under a British Resident; its district officers were the Dewan
*Peishkars*, sitting at the *Cutcherry*. Pepper — "black gold" — and the other spices of the Malabar
coast were traded through European agency houses. The village, the port, the company and every
character in this story are fictional.

## A note on scope

This is a browser game built by one author in two passes. It aims for the *feel* of a cinematic
open-world game with stylised procedural art — roughly early-2000s character fidelity under modern
lighting. It is not the product of a few hundred artists and several years.

## Build from source

The game is written as plain ES modules in `src/` on top of [three.js](https://threejs.org).

```sh
npm install
npm run build      # bundles everything into index.html
```

| File | Purpose |
| --- | --- |
| `heightfield.js`, `terrain.js`, `places.js` | The land: height function, splat mask, terrain shader, survey map, place names |
| `env.js`, `water.js`, `post.js`, `fx.js` | Sky, time of day, weather, reflective water, post-processing, particles |
| `flora.js`, `structures.js`, `builder.js`, `textures.js` | Vegetation, architecture, procedural textures |
| `human.js`, `characters.js`, `geo.js` | Skinned people and their painted textures; animals and boats; the loft builder |
| `npc.js`, `entities.js`, `player.js` | AI, horse and boats, the player controller |
| `story.js`, `missions.js`, `activities.js` | Mission framework, the nine mission scripts, side activities |
| `ui.js`, `mapui.js`, `audio.js`, `world.js`, `main.js` | HUD, the map, synthesised audio, world assembly, main loop |

Add `?q=low`, `?q=medium` or `?q=high` to the URL to force a graphics preset.
