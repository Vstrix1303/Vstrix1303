# KAYAL — Travancore, 1905

*കായൽ (kayal): the backwaters of Kerala.*

A single-player, story-driven open-world adventure set on the Malabar coast in the monsoon of 1905.
You are **Madhavan**, a boatman's son home after six years on the Bombay docks, to find the family
pepper garden about to be seized by a trading company's forged debt ledger. Walk, ride and paddle
across a hand-built slice of old Travancore to set it right.

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
| `Shift` | Run · gallop · paddle hard |
| `Space` / `C` | Jump / crouch (stealth) |
| `E` | Talk · gather · mount · board · dismount |
| Left click / `F` | Strike with your staff |
| `P` | Photo mode (orbit camera, HUD off; `[` `]` change the hour, `R` toggles rain) |
| `H` / `Esc` | Hide HUD / pause |

Touch devices get an on-screen stick and buttons, though a keyboard and mouse is the intended way to play.
The **Graphics** button on the title screen switches Low / Medium / High; the game also lowers its
resolution automatically if the frame rate drops.

## The game

Five chapters (about 20–30 minutes), then free roam:

| | Chapter | What you do |
| --- | --- | --- |
| I | **Homecoming** | Arrive by boat at dawn and walk home through the village |
| II | **Black Gold** | Bring in the pepper harvest — and defend it |
| III | **The Backwater Run** | Paddle a loaded *vallam* across the lake as the monsoon breaks |
| IV | **The Red Ledger** | Slip into the Company compound before dawn (stealth) |
| V | **Ride for the Cutcherry** | A horseback chase into the hills as the sun comes up |

The world (about 1.6 km × 1.6 km, with terrain to the horizon):

- **Thekkumkara** — a backwater village: laterite and lime-washed houses under terracotta and thatch,
  the family *tharavadu* with its gate-house, a temple with lamp tower, flag mast and stepped tank.
- **The kayal** — a great lake with an island shrine, drifting *kettuvallam* rice boats, a canal and lotus ponds.
- **Puthenthura** — a spice port: market stalls, a Kerala-style mosque, a Syrian Christian church,
  Chinese fishing nets, and the walled compound of Harrow & Finch.
- **The foothills of the Western Ghats** — pepper gardens, rainforest, tea terraces, wild elephants,
  and the hill-top Cutcherry (district court).

Systems: full day/night cycle with sun, moon and stars · monsoon weather with rain, lightning, thunder
and wet ground · planar water reflections · dynamic shadows · wind-blown palms and grass · fireflies ·
oil lamps at night · third-person movement, swimming, riding and boating · staff combat · guard vision
cones and stealth · a dialogue and quest system with checkpoints · minimap · a generative score built on
Carnatic raga scales over a tanpura-style drone.

## A note on the setting

Travancore in 1905 was a princely state under a British Resident; its district officers were the Dewan
*Peishkars*, sitting at the *Cutcherry*. Pepper — "black gold" — and the other spices of the Malabar
coast were traded through European agency houses. The village, the port, the company and every
character in this story are fictional.

## A note on "AAA"

This was built in a single pass as a browser game. It aims for the *feel* of a cinematic open-world
western — golden-hour lighting, weather, a horse, a story — with stylised procedural art. It is not, and
could not be, the product of a few hundred artists and several years; think of it as a playable
vertical slice.

## Build from source

The game is written as plain ES modules in `src/` on top of [three.js](https://threejs.org).

```sh
npm install
npm run build      # bundles everything into index.html
```

| File | Purpose |
| --- | --- |
| `heightfield.js`, `terrain.js` | The land: analytic height function, splat mask, terrain shader, survey map |
| `env.js`, `water.js`, `post.js` | Sky, time of day, weather, reflective water, post-processing |
| `flora.js`, `structures.js`, `builder.js`, `textures.js` | Vegetation, architecture, procedural textures |
| `characters.js`, `npc.js`, `entities.js`, `player.js` | People, animals, AI, horse and boat, the player controller |
| `story.js`, `ui.js`, `audio.js`, `world.js`, `main.js` | Quest scripts, HUD, synthesised audio, world assembly, main loop |

Add `?q=low`, `?q=medium` or `?q=high` to the URL to force a graphics preset.
