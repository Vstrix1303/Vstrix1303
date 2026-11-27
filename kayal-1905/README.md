# RAAPAKAL — Kerala, 1957

*രാപ്പകൽ (raapakal): night and day. An open-world game set in the backwaters of Kerala in 1957. (It began as KAYAL — Travancore, 1905, which lives on the `kayal-1905-final` branch.)*

A single-player, story-driven **open-world** adventure set on the Malabar coast in the monsoon of 1905.
You are **Madhavan**, a boatman's son home after six years on the Bombay docks, to find the family
pepper garden about to be seized by a trading company's forged debt ledger. Walk, ride and paddle
across a hand-built slice of old Travancore to set it right — and then face the Company's senior
partner when he comes from Madras to undo it.

It is a browser game: **one self-contained file, no installs, no downloads, no image or audio assets** —
every texture, model, animation, sound effect and note of music is generated procedurally at load time.


> **RAAPAKAL (രാപ്പകൽ, "night and day") — Kerala, 1957.** The game has a new name and has moved fifty years on. The 1905 game, with its nine missions,
> is kept complete on the `kayal-1905-final` branch. The 1957 game is free roam for now, and the story will come later.

## Version 15 — Madhavan rearmed, and a new HUD

- **Hands free.** You start with nothing in your hands: left-click punches (jab left, jab right), and right-click
  keeps your guard up. Weapons hang on the body until you use them: the pistol in a hip holster, a long gun or the
  lathi across the back. They come out the moment you aim or strike, and go back after a quiet spell.
- **Five guns.** Each has its own ammunition, handling and sound:
  - a Colt .45 automatic
  - a double-barrel 12-bore
  - a Kalashnikov assault rifle (hold to keep firing)
  - a Lee-Enfield No. 4 (T) sniper rifle with a telescope view (Shift holds your breath)
  - an M9 bazooka whose rockets throw everything about
- **How shooting works:**
  - Bullets go through the reticle. Headshots count extra. Recoil climbs and spread grows while you keep firing.
  - The dot turns red over an enemy, and a cross marks a hit (red for a knock-down).
  - Starting to aim snaps onto the nearest enemy in front.
  - Gunfire brings guards running and sends villagers ducking for cover. A suppressor keeps it quiet.
- **The gunsmith.** The trader behind the Puthenthura godown, and a new arms dealer by the bus stand, sell guns,
  ammunition and parts. Every part shows in Madhavan's hands before you pay, with what it does to the gun's numbers:
  - finish: blued, black, nickel, case-hardened or gold
  - wood: walnut, teak, rosewood or ebony, or ivory grips
  - barrels: long, cut-down or suppressor
  - telescopes: 2.5x, 4x or 8x
  - extended or drum magazines
  - recoil pads, a folding stock, a heavy rocket warhead, and gold or silver engraving
- **The weapon wheel.**
  - Hold **Tab** and the world slows. Eight segments: unarmed, melee, pistol, shotgun, rifle, sniper, launcher and the
    satchel.
  - The middle shows the weapon's rounds and its damage, range, fire rate and accuracy.
  - The mouse wheel cycles your melee weapons. **1–7** choose directly.
- **The HUD:**
  - a round radar with the time beneath it
  - health and stamina cores above it, which empty as a ring and pulse red when low
  - prompts at the lower right, with the weapon and its rounds beneath them while it is out
  - the objective at the foot of the screen when it changes
  - tips in a box at the top left
- **New clothes to start in:** a mustard camp-collar shirt with a brown windowpane check, over an old checked lungi.
  Shirts can now carry woven checks and stripes.

## Version 14 — every building open, and strangers on the road

- **Walk into the big buildings.**
  - These are all hollow now, with doorways and furnished rooms:
    - the mosque: prayer mats, the mimbar and a clock
    - the church: pews, the altar and candles
    - the Taluk Office: the Tahsildar's raised desk, clerks' desks, record shelves and a punkah
    - the co-operative's godown: coir bales, rope and a weighing scale
    - the co-op office: the secretary's desk, ledgers and a safe
    - Lakshmi Talkies: benches, a stage and a lit screen
    - the party offices
    - the tea estate's bungalow, factory and store shed
    - the six one-room homes of the coolie lines
  - Bazaar shophouses have a family room upstairs with a door onto the balcony. The panchayat's upper floor opens onto
    its verandah roof. **E** at a staircase goes up or down.
  - The lighthouse door takes you up to the lamp gallery for the view. The temple sanctum stays closed: only the priest
    goes in.
- **Strangers (random encounters).**
  - Every couple of minutes of free roam, somebody up the road gets into trouble. You hear them first, and a white **!**
    blip pulses on the minimap. Walk over and talk, or ignore them.
  - The encounters:
    - a purse-snatcher to run down: tackle him or knock him out, then return the purse or keep it
    - a snakebite: draw the poison by pressing **E** quickly, or race to the vaidyasala against the clock
    - a lost child to find by his crying and walk home
    - a drunk spoiling for a fight: calm him, pay his bus fare, or fight
    - a man lying in the road who is bait for dacoits
    - a milkman's bicycle chain to fix
    - election posters to paste for the C.P.I. or the Congress
    - an urgent telegram to deliver: good news or bad
  - Dialogue choices are picked with **1–4**.
  - How you behave changes your **standing**, shown in the satchel (**I**). It runs from Respected to Not trusted.
  - A mission starting, dying, or walking 250 m away ends an encounter cleanly.

## Version 13 — 1957 buildings and real clothes

- **Buildings:**
  - The bazaar is two-storey shophouses in colour-washed plaster, with balconies, shuttered windows, tin awnings and
    folding plank shutters. Some have tiled roofs; others have flat roofs behind parapets dated 1948–1957.
    Enamel boards advertise beedis, soap, tea and torches.
  - The party offices and the reading room are plastered blocks with square-column verandahs and stepped parapets
    carrying their boards. The panchayat is a two-storey office.
  - Lakshmi Talkies is now an Art Deco picture house: a stepped, finned tower over the entrance, speed-line bands,
    a concrete marquee and the week's posters in frames.
- **Clothes are real garments now (desktop app):**
  - Collared, buttoned shirts with long sleeves or cut to half-sleeve. They are worn out over the mundu, or
    tucked into belted trousers.
  - Khaki shorts for the police, a jacket, shirt and tie for officials, and leather shoes.
  - Women wear a fitted blouse cropped under the bust with a neriyathu draped over the left shoulder
    (gold-bordered with a kasavu mundu); Nasrani women wear the chatta.
  - The garments are MakeHuman's free clothes (CC0), fitted to each body and skinned to its skeleton by
    `tools/mh-build.mjs`, then dyed in the game. The skin they cover is hidden, so nothing pokes through.
  - Beyond 25 m people switch back to painted clothes, and garments cast no shadow of their own, so crowds cost
    about what they did before.
  - Rebuilding the garments: extract the clothes from a MakeHuman 1.1 data folder with
    `python3 tools/mh-clothes.py <makehuman/data> <dir>`, then run `node tools/mh-build.mjs <makehuman/data> <dir>`.

## Kerala, 1957 (version 12)

- **The time:** April 1957. Kerala is a year old and has just voted in a communist government, one of the first anywhere to
  come to power through the ballot box. Land reform is the talk of every tea shop, and the decimal naya paisa
  has just replaced the anna (money is shown in rupees and naye paise).
- **The village:**
  - Electric poles and wires along the roads, with street bulbs.
  - A bus stand with a timetable.
  - Lakshmi Talkies, the cinema, with posters for 1950s Malayalam films.
  - A ration shop, a reading room and the panchayat office.
  - It's election season: the C.P.I. and Congress offices fly their flags, slogans are painted on walls,
    and bunting is strung across the bazaar.
  - The 1905 colonial cast is gone. The trading company's compound is now the coir workers' co-operative, and
    the royal court building is the Taluk Office.
- **Vehicles:**
  - In traffic: state transport buses (they stop at the bus stand), lorries, a jeep, saloon cars, cyclists everywhere, and a
    passenger launch on the canal. Bullock carts are still on the road.
  - Yours to use: a **bicycle** outside the tharavadu gate and the **panchayat's jeep** by its office. E gets on or
    off, WASD steers relative to the camera, holding the jeep's opposite direction reverses it, and
    left-click or F sounds the horn or the bell.
- **People:**
  - Madhavan now wears a short crop and a half-sleeve shirt over his mundu.
  - Villagers wear shirts, trousers and bush shirts, and women wear saris alongside the set-mundu.
  - Police wear khaki shirts, shorts and puttees, with a lathi.
  - The wardrobe adds trousers, bush shirts, a vest and a Gandhi cap.

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
| Left click / `F` | Strike · fire the revolver |
| Right click / `Q` | Block — block just as a blow lands to stagger the attacker · aim the revolver |
| `Tab` (hold) / `1`–`7` | Weapon wheel · choose a weapon · `R` reloads the revolver |
| `I` / `V` | Satchel · eat or drink the best thing for your wounds |
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

- **Thekkumkara** — the home village, the family *tharavadu* (a two-courtyard manor with its bathing pond), a temple with lamp tower and stepped tank, a toddy shop on the canal towpath. Houses can be entered.
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

## Version 4 — walk inside, the reference sheets, new music

Built from twelve hand-supplied reference sheets (cast, expressions, outfits, houses, props, street scenes).

- **Buildings you can enter.** Walls are now real slabs with door and window openings, floors are
  walkable plinths, and the camera pulls in under the roof. Every village house and hut has a furnished
  room (hearth, mats, chest, pots, lamp).
- **The family home is an *ettukettu*** — a two-courtyard manor with a pillared *poomukham* porch, carved
  and painted gables, a slatted upper storey, a *tulsi* plinth in the court, a kitchen wing and granary,
  a thatched gatehouse (*padippura*), a stone-lined bathing pond (*kulam*) with steps into the water, and a
  serpent grove (*sarpa kavu*) left wild in the corner.
- **New house types**: two *nalukettu* (single-courtyard houses) in the village, Moideen's two-storey
  **spice warehouse** on the quay (open arcade, brass-studded strong-room door, carved teak screens),
  a Syrian Christian house with its stone cross and pepper vines, mud-and-thatch fishermen's huts with
  nets on drying frames.
- **Cast redrawn from the sheet**: the patriarch with his stick, a Nair woman with a jasmine braid, a
  Syrian Christian woman in white *chatta*, the Mappila trader in checked *lungi* with a shoulder bag,
  a Namboothiri priest, a fisherwoman carrying her basket, the colonial officer in white drill and tall
  boots, and children with slates.
- **Madhavan** now matches his turnaround sheet (hair knot, moustache, charm on a cord, shoulder cloth,
  long cream *mundu* with waist knot and centre pleat) and has the five outfits of the outfit sheet:
  everyday, boatman, travel, monsoon (palm-leaf rain cape), festival.
- **Facial expressions** — neutral, determined, laughing, worried, angry, grieving — plus talking mouths.
  Faces follow the dialogue and the action (a fight, a wound, a storm, a passed mission).
- **Props and street life**: brass oil lamps, clay pots, urns, *kindi*, fish baskets, rope coils, cast
  nets, toolboxes, punting poles, palm-leaf umbrellas, barrels, shop awnings, creeper-hung compound
  walls, mural panels. People sit out on verandahs; walkers put up umbrellas when it rains.
- **Music rewritten.** The old generative drone is replaced by composed phrases in pentatonic modes
  over a soft *tanpura*-style drone — a flute by day, a plucked string at night, a faster drum-led
  pattern for chases — with a touch of reverb.

## Version 5 — people who look and move like people

- **Bodies rebuilt to human proportions.** The broad action-figure build is gone: figures are about
  seven and a half heads tall with real shoulder, chest, waist and hip widths, shaped limbs (deltoid,
  biceps, the belly of the calf), hands with a thumb and fingers that close round what they hold, and
  feet that bend at the toes.
- **Faces with relief.** The head is no longer a painted egg: brow ridge, eye sockets, a nose with a
  bridge and nostrils, lips, chin and jaw are modelled, with separate ears and hair that has volume.
  Eyes blink.
- **A fuller skeleton** — 24 joints instead of 16 (neck, collar-bones, finger and toe joints, a bone for
  the hem of the *mundu*).
- **Feet that plant.** Walking and running are no longer a looping leg-swing: each foot is placed on the
  ground, stays where it lands, and the legs are solved backwards from the feet (inverse kinematics).
  Nothing slides; steps, plinths and slopes are stepped on properly; stopping or turning on the spot
  produces real corrective steps. Stride length and rhythm change continuously from stroll to sprint.
- **Weight.** The pelvis rises over the standing leg and turns with the stride, shoulders counter-rotate,
  the body leans into acceleration and banks into turns, landings are absorbed, movement has momentum.
- **Life at rest.** Breathing (heavier after a sprint), weight shifting from leg to leg, glances,
  looking at whoever is near, small habits — scratching the head, re-tucking the *mundu*, hands on hips.
  People talking use a vocabulary of gestures rather than one loop; field workers bend, gather and
  straighten their backs.
- **Fighting and falling.** Strikes have wind-up, a lunge and follow-through and alternate between
  cuts; blows make the body recoil; a knocked-down man buckles, falls and settles instead of tipping over.
- **Riding.** Horses have four distinct gaits with correct footfall order — walk, trot, canter, gallop —
  and lean into turns, rock at the canter, rest a hind leg when standing, swish and stream their tails.
  The rider sits on the moving back, rises to the trot, and swings up into the saddle.
- **Other animals**: cattle share the gait system, the elephant ambles with a rolling body, egrets flap
  in bursts and glide.

## Version 6 — the models

The remaining block-built models were rebuilt as smooth, shaped surfaces.

- **Horses and cattle** are modelled anatomically: barrel with withers, back and croup, shoulder and
  haunch swelling out of the same skin, a neck with crest and throat, a head with jaw, muzzle, nostrils,
  eyes and ears, and legs with knee, hock, fetlock, pastern and hoof (each joint animated). Horses have
  a mane, forelock, full tail, saddle with girth and stirrups, and a bridle; the cattle are humped zebu
  with dewlap and horns.
- **The elephant** has the arched back and twin-domed head of the Asian elephant, fan ears, curved
  tusks, a tapering trunk that curls, pillar legs with knees and toenails, creased hide, and — for the
  temple elephant — a gilded *nettipattam* and a bordered saddle-cloth.
- **Egrets** have a body, a drawn-back neck, trailing legs and two-jointed wings with spread primaries.
- **Trees** fork into limbs and boughs and carry their leaves in many small sprays instead of a few
  large cards; trunks flare at the foot. Palms have round, ringed trunks and longer-jointed fronds.
- **Boats** have round-bilged hulls with gunwale rails, stem and stern posts and ribs.
- **The bullock cart** has spoked wheels, a slatted bed, pole and yoke, and a hooped mat cover.
- **Creepers and pepper vines** are leaf sprays rather than green blobs.

## Version 7 — materials and light

- **No primitive-built characters or animals.** Hair is a shell lofted over the skull with a real
  hairline; hats and head-cloths are turned on smooth profiles; ears are cupped; the braid is plaited;
  the satchel is a soft pouch; hooves, saddle, saddle-cloth and tack are shaped. The only simple solids
  left are things that are that shape — beads, eyeballs, rings, a walking stick.
- **Image-based lighting.** The sky itself (and the lit ground below the horizon) is captured as an
  environment map and lights and reflects in every surface, so roughness and metalness read as
  materials. It is re-captured as the hour and weather change.
- **Per-part finish.** Each character carries a roughness/metalness map — skin with a soft sheen, wet
  eyes, matte cloth, polished boots, gold thread and jewellery that is actually metallic — and a relief
  (normal) map derived from the painted folds and creases. Hair, wound cloth and woven cloth have their
  own fine normal maps; horse coats and elephant hide have relief too.
- Soft shadow-mapped sunlight and ACES filmic tone mapping (both already in place since version 1).

## Version 8 — real surfaces (desktop app)

- **Photo-scanned textures** (from Poly Haven, all CC0 — public domain): leafy grass, red laterite soil
  for the roads, mud on the slopes and banks, coastal sand, weathered whitewash, laterite block walls,
  aged clay roof tiles, thatch, weathered planks, teak, granite steps, palm and tree bark, hessian sacks.
  Each comes with colour, surface-relief (normal) and roughness/ambient-occlusion maps, at its real-world
  scale; the ground mixes two scales of every texture so the repeat never shows.
- **Ambient occlusion** on High and Ultra (N8AO): soft contact shadow where walls meet the ground, under
  eaves and verandahs, between objects — with SMAA edge smoothing.
- **Ultra preset**: higher resolution, 4096 px shadows, sharper reflections, denser grass and forest.
  Choose it with the *Graphics* button on the title screen.
- The browser version keeps the hand-painted textures (the photo-scanned set is 36 MB).

## Version 9 — realistic people (desktop app)

- **Bodies from MakeHuman** (makehumancommunity.org; base mesh, morph targets, skeleton and skin weights
  are all CC0). `tools/mh-build.mjs` blends MakeHuman's sex, age, muscle, weight and ancestry targets into
  ten body types — young, lean, heavy and older men, young and older women, a boy and a girl, and two
  European builds for the Company men — re-poses them from MakeHuman's A-pose to the game's rest pose, and
  folds MakeHuman's 163 bones onto the game's animation rig, so every movement built earlier drives them.
- **Each body's own skeleton**: joints sit where that body's joints are, and the walking/foot-planting
  code reads each character's own leg lengths.
- **Clothing drawn by a shader on the body's surface** (from its rest-pose position): mundu, kasavu
  borders, checked lungi, shirts, kurtas, coats with lapels and buttons, uniforms with belts and
  cross-straps, blouses with the neriyathu, the chatta, the shoulder cloth, sacred thread, charms, bangles,
  rosaries, trousers, boots, puttees, sandals — no texture per outfit, sharp at any distance. Faces get
  lips, eyebrows, moustaches, beards and forehead marks the same way.
- **Hair** grown as a shell from each body's own scalp and trimmed along a soft hairline; the mundu is a
  separate cloth fitted to each body's hips and legs; real eyes; a jaw that moves when people talk and
  eyelids that blink and narrow with expressions.
- **Three levels of detail** (27,000 / 8,000 / 2,700 triangles) chosen by distance, so a street full of
  people stays affordable on integrated graphics.
- **Integrated GPUs** (Radeon Vega, Intel UHD/Iris) are detected and start on Medium with the costliest
  effects trimmed; **F3** shows the frame rate.
- The browser version keeps the drawn figures.

## Version 10 — a working village, and dialogue shot like film

- **Thekkumkara's bazaar**: the main road through the village is now a street of shophouses with open
  fronts, counters and Malayalam signboards. There's a provisions store, a cloth shop (Balaramapuram mundu and
  kasavu), a bell-metal vessel shop, the vaidyasala (an Ayurvedic dispensary), the anchal office (Travancore's
  own postal service) and a potter. Every shop has a keeper behind the counter, and most have a customer haggling in front.
- **The market** (*chantha*): a tiled pavilion with vegetable, banana, coconut and fish stalls, sellers
  calling out and buyers picking through baskets.
- **The village school** (*pallikkoodam*): an open thatched hall where the asan sits on his stool facing
  rows of children on benches with their slates.
- **The square**: a banyan on its stone *aalthara* platform with a lamp, old men arguing politics beside
  it, and a small roadside shrine.
- **New lanes** east, south and west of the bazaar, each lined with houses, fences and washing lines, with
  people walking them under umbrellas or carrying head-loads. The old street props now stay clear of the new buildings.
- **Bullock carts** travel the main road: a yoked pair of oxen, a driver on the bed, wheels that turn.
  They keep to the left, wait at each end and stop for anyone standing in the road.
- **Dialogue camera, rebuilt like film**. Conversations no longer jump between the player's eyes and a
  far camera:
  - **The 180° rule**: one side of the line between the two speakers is chosen and kept, so screen direction never flips.
  - **Shot order**: each scene opens on a **two-shot** with a long lens and both people in frame. Lines then cut to
    **over-the-shoulder** shots that keep the listener's shoulder in the foreground, and the two-shot returns
    every few lines.
  - **Cuts and movement**: hard cuts, with a slow creep-in on each shot.
  - **Clean framing**: the camera stays out of walls, and tightens up indoors.

## Version 11 — traffic, shopping, a wardrobe, the barber and weapons

- **Traffic on every road.** Bullock carts loaded with sacks, coconuts or hay; the *jutka*, the light
  one-horse carriage of South Indian roads; riders, among them Company peons; people on foot carrying
  umbrellas or head-loads; boatmen paddling cargo along the canal.
  - **How it runs:** travellers appear on the roads around you, mostly coming toward you and never where you'd
    see them pop in. They disappear once far behind, so the roads feel busy without the whole map being
    simulated, which keeps it light on integrated graphics.
  - **How they behave:** they keep to the left, follow one road into the next at junctions, queue behind slower traffic,
    stop for anyone in the way (and tell you to move), and flinch and shout if you gallop past.
- **Shops in the bazaar.** Talk to a keeper to open the counter.
  - **Cloth shop:** mundus, lungis, shirts, shoulder cloths, headwear, extras.
  - **Provisions:** food for the road.
  - **Vaidyasala:** Ayurvedic medicines.
  - **Blacksmith:** blades.
  - **Market:** fruit and jaggery.
  - **Tea shop:** chaya and hot food.
  - **Tailor at Puthenthura:** keeps the finer pieces (kurta, Bombay jacket, crimson turban, sandals).
- **Dress piece by piece.** Clothes are bought by the piece in four slots (mundu & lungi, upper cloth, headwear,
  extras) and combined freely. The camera turns to Madhavan so every piece can be tried on before it's
  bought. Anything you own can be changed for free at the teak wardrobe in the tharavadu. Old saves keep
  their outfits, converted into pieces.
- **The barber** under the banyan in the square has five hairstyles:
  - knotted behind (as you started)
  - short crop
  - loose to the shoulders
  - kudumi, the old shaved head with a front tuft
  - shaved clean

  He also does five moustache and beard styles, including the great upturned *komban meesha*.
- **The satchel (I).** Bananas, puttu and kadala, rice and fish curry, jaggery and ginger (sprint without tiring), kashayam
  (full health, then faster healing) and marma oil (blows hurt less). **V** eats the cheapest thing that
  covers your wounds.
- **Weapons, with a weapon wheel (hold Tab) or keys 1–7:**
  1. **Lathi**: the long staff you start with.
  2. **Cheruvadi**: a short stick, very fast.
  3. **Otta**: the curved kalari stick; every third blow lands on a *marma* (vital point) for triple damage.
  4. **Vettukathi**: a heavy billhook.
  5. **Val and paricha**: sword and shield; blocks hardly hurt and the parry window is wider.
  6. **Urumi**: the flexible coiled sword; slow, but it cuts everyone around you.
  7. **Webley revolver**: hold right mouse to aim with a crosshair, R to reload, six rounds. Every guard within earshot comes running.

  Where to get them:
  - **The kalari master by the banyan:** the short stick, the otta, the urumi and marma oil.
  - **The blacksmith in the bazaar:** the billhook and the sword.
  - **A trader behind the Puthenthura godown:** the revolver and cartridges, later in the story.
- **Smaller fixes:** the mundu hangs looser below the hips, so thighs no longer show through it, and small
  sums show as annas ("4 as") rather than "Rs 0 · 4 as".

## Performance — 40 fps on integrated graphics

Measured at the busiest spot in the game (the bazaar at dusk, with traffic and about 50 people in range), per frame:

| | Before | After |
|---|---|---|
| Triangles, main view | 5.1 million | 1.6 million |
| Triangles, shadow pass | 1.5 million | 0.8 million |
| Draw calls (main + shadow) | 1,234 | ~800 |
| Script time | 6.7 ms | ~3 ms |

- **Trees:** palms and trees have a light build with the same silhouette, drawn beyond 65 m. Before, all
  ~2,000 triangles of every tree were drawn out to the horizon.
- **Buildings:** they're merged per 150 m tile instead of across the whole map, so buildings that are
  off-screen or outside the shadow area are skipped. Far tiles are hidden.
- **People:**
  - They're now culled when off-screen (they never were).
  - They switch to lighter models sooner.
  - Eyes and small parts are dropped past 22 m.
  - Far figures animate at a reduced rate and stop casting shadows.
- **Shadows and lights:** on integrated graphics the shadow map is redrawn every other frame, and two night lights are used instead of four.
- **Automatic quality:** it aims for at least **40 fps**. It first lowers the resolution (integrated GPUs start at
  85%), then switches off bloom, redraws shadows less often, drops the water reflection, and shortens the shadow range.
  **F3** shows the frame rate, the resolution and how much has been trimmed.

## A note on the setting

Travancore in 1905 was a princely state under a British Resident; its district officers were the Dewan
*Peishkars*, sitting at the *Cutcherry*. Pepper — "black gold" — and the other spices of the Malabar
coast were traded through European agency houses. The village, the port, the company and every
character in this story are fictional.

## A note on scope

This is a browser game built by one author in two passes. It aims for the *feel* of a cinematic
open-world game with stylised procedural art — roughly early-2000s character fidelity under modern
lighting. It is not the product of a few hundred artists and several years.

## Desktop app (Windows)

KAYAL runs as an installable Windows application — its own window, fullscreen by default (**F11** or
**Alt+Enter** to toggle), *Quit to desktop* in the menus, the fast GPU preferred on laptops, saves kept on
the computer — and only the desktop app has the photo-scanned surfaces described under version 8.

**Getting it.** Every push builds the app on GitHub: open the repository's **Actions** tab → the latest
*KAYAL desktop app* run → **Artifacts** → `Kayal-1905-windows`. Inside are an installer
(`Kayal-1905-…-win-x64.exe`) and a portable `…-win-x64.zip` (unzip and run `Kayal 1905.exe`).

The app is not code-signed (that needs a paid certificate), so Windows SmartScreen warns on first launch:
click *More info* → *Run anyway*. Saves made in a browser do not carry over to the desktop app.

**From source** (needs Node.js): `cd kayal-1905/desktop && npm install && npm start` runs it (the textures
download on first run); `npm run dist:win` packages it into `desktop/dist/`.

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
