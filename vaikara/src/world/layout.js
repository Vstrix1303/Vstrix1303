// VAIKARA — Malabar Coast, c.1905.
// Every feature of the parchment map, hand-traced in map pixels (the map is
// 1536 × 1024 px) and converted to world metres. Shared by the offline bake
// (scripts/bake.mjs) and the game itself, so the two always agree.
//
// World: 8000 m (x, west→east) × 5333 m (z, north→south). Origin = map centre.
// North is −Z, so "up" on the map is "forward" in three.js default view.

export const MAP_W = 1536;
export const MAP_H = 1024;
export const WORLD_W = 8000;
export const WORLD_H = WORLD_W * MAP_H / MAP_W; // 5333.3
export const PX = WORLD_W / MAP_W;               // 5.208 m per map pixel
export const SEA_LEVEL = 0;

export const toWorld = (px, py) => [(px - MAP_W / 2) * PX, (py - MAP_H / 2) * PX];
export const toMap = (x, z) => [x / PX + MAP_W / 2, z / PX + MAP_H / 2];

const W = (pts) => pts.map(([x, y, ...r]) => [...toWorld(x, y), ...r.map((v) => v * PX)]);

// ── Mainland coast (land polygon, clockwise from the north edge). Everything
// outside it is the Arabian Sea. The estuary and the lagoon are carved
// separately as rivers.
export const COAST = W([
  [372, -40], [376, 0], [384, 50], [392, 95], [410, 128], [398, 160], [384, 190], [404, 222],
  [394, 250], [412, 284], [384, 302], [334, 318], [292, 345], [264, 382], [262, 425],
  [282, 462], [300, 490], [296, 520], [292, 536], [252, 542], [214, 556], [198, 586],
  [220, 622], [244, 656], [262, 700], [282, 746], [306, 790], [336, 826], [372, 852],
  [414, 872], [462, 878], [506, 872], [546, 884], [584, 906], [632, 930], [680, 944],
  [742, 956], [800, 976], [850, 1010], [870, 1070], [1600, 1070], [1600, -40],
]);

// Offshore islets west of Muthalappuzha and the Lighthouse Point rocks.
export const ISLETS = W([
  [350, 205, 16], [338, 262, 11], [366, 140, 9], [318, 300, 8], [452, 300, 10], [430, 330, 7],
]);

// ── Water courses: [x, y, width] in map px. Carved below sea level unless
// they are above it (the Vellar stream comes down from the hills).
export const RIVERS = {
  // Vaikara river: the estuary from the sea, past the ghat and the bridge,
  // opening into the long Kuttan lagoon.
  vaikara: W([
    [140, 498, 70], [230, 503, 74], [320, 512, 72], [410, 524, 66], [500, 540, 60],
    [570, 560, 56], [640, 585, 58], [720, 612, 82], [800, 645, 108], [900, 686, 122],
    [1000, 726, 124], [1100, 765, 112], [1180, 798, 88], [1235, 822, 56], [1268, 836, 22],
  ]),
  // Channel from the lagoon south through the paddy to the Southern Ferry bay.
  ferry: W([
    [905, 728, 12], [880, 772, 11], [845, 820, 11], [800, 868, 12], [752, 912, 16], [712, 948, 26], [690, 980, 40],
  ]),
  // Vellar stream: from the Kurumala heights, over Vellar Falls, to the lagoon.
  vellar: W([
    [1500, 300, 5], [1462, 352, 6], [1430, 398, 7], [1418, 430, 7], [1404, 470, 8],
    [1368, 520, 9], [1320, 572, 10], [1270, 630, 11], [1226, 700, 12], [1200, 760, 14], [1186, 800, 18],
  ]),
  // Creek behind Muthalappuzha.
  muthal: W([[560, 230, 6], [520, 248, 7], [480, 262, 9], [440, 280, 12], [400, 292, 16]]),
};

// Index along the Vellar stream where the falls drop (between these two points).
export const FALLS = { a: toWorld(1424, 408), b: toWorld(1416, 452), top: 205, bottom: 140 };

// Mangrove coast: a low maze of islets and channels.
export const MANGROVE = W([
  [262, 330], [330, 300], [420, 300], [470, 330], [480, 400], [450, 470], [400, 500], [300, 498], [258, 440],
]);

// Mountain front: east/north of this line the land climbs into the Kurumala
// Highlands and the forested hills of the Elephant Forest.
export const MOUNTAIN_FRONT = W([
  [860, -40], [930, 60], [1010, 170], [1070, 270], [1140, 360], [1210, 450], [1250, 560],
  [1300, 680], [1360, 800], [1440, 880], [1600, 930],
]);

// Black Rock Pass: the North Coast Road climbs over a saddle here.
export const PASS = { p: toWorld(1228, 228), r: 70 * PX };

// ── Fields
export const PADDY = W([
  [560, 700], [640, 668], [760, 700], [880, 740], [930, 790], [920, 870], [840, 890], [720, 870], [620, 850], [560, 800],
]);
export const SALT_PANS = W([[380, 610], [520, 600], [560, 640], [550, 720], [430, 726], [370, 680]]);
export const TEA = W([
  [990, 360], [1090, 330], [1190, 360], [1220, 430], [1170, 480], [1060, 490], [980, 450],
]);
export const TEAK = W([[1250, 640], [1420, 610], [1536, 640], [1536, 800], [1420, 760], [1300, 740]]);
export const ELEPHANT = W([[1280, 500], [1420, 480], [1536, 470], [1536, 640], [1400, 640], [1280, 600]]);

// ── Roads: [x, y] map px. type: main | road | trail
export const ROADS = [
  { name: 'North Coast Road', type: 'main', pts: W([[420, 60], [500, 80], [600, 98], [720, 112], [850, 128], [980, 140], [1080, 152], [1150, 180], [1205, 215], [1250, 235], [1320, 245], [1420, 230], [1536, 220]]) },
  { name: 'Puliyur Road', type: 'main', pts: W([[742, 120], [740, 180], [708, 240], [680, 310], [662, 380], [664, 440], [680, 480]]) },
  { name: 'Bazaar Street', type: 'main', pts: W([[690, 486], [650, 500], [612, 516], [592, 540], [592, 552]]) },
  { name: 'Bridge Road', type: 'main', pts: W([[680, 490], [668, 530], [664, 568]]) },
  { name: 'Estate Road', type: 'main', pts: W([[700, 492], [780, 502], [850, 512], [960, 500], [1040, 470], [1110, 440], [1150, 412], [1190, 360], [1215, 290], [1225, 235]]) },
  { name: 'Temple Way', type: 'road', pts: W([[668, 450], [720, 420], [770, 398], [808, 386]]) },
  { name: 'Church Lane', type: 'road', pts: W([[662, 430], [630, 415], [604, 410]]) },
  { name: 'Hill Road', type: 'road', pts: W([[742, 180], [820, 196], [905, 214], [916, 270], [980, 300], [1060, 330], [1100, 380]]) },
  { name: 'Fishing Village Road', type: 'road', pts: W([[700, 112], [640, 160], [590, 210], [540, 240], [478, 258]]) },
  { name: 'Southern Road', type: 'main', pts: W([[650, 620], [632, 670], [628, 720], [640, 760], [680, 820], [716, 880], [722, 920]]) },
  { name: 'Fort Road', type: 'road', pts: W([[628, 740], [580, 780], [536, 812], [480, 838], [420, 852], [396, 858]]) },
  { name: 'Karimulam Road', type: 'road', pts: W([[722, 905], [800, 905], [880, 898], [960, 890], [1000, 884], [1080, 880], [1180, 870], [1300, 860], [1400, 860]]) },
  { name: 'Veliyathura Road', type: 'road', pts: W([[250, 572], [300, 590], [356, 612], [420, 640], [500, 660], [560, 652], [620, 626], [646, 612]]) },
  { name: 'Ghat Steps Lane', type: 'trail', pts: W([[592, 552], [590, 560]]) },
  { name: 'Lighthouse Path', type: 'trail', pts: W([[420, 60], [412, 66]]) },
  { name: 'Ferry Lane', type: 'trail', pts: W([[850, 512], [838, 560], [832, 612]]) },
  { name: 'Kalliyar South', type: 'trail', pts: W([[786, 692], [760, 720], [720, 744], [640, 760]]) },
  { name: 'Teak Trail', type: 'trail', pts: W([[1300, 860], [1320, 790], [1350, 720], [1380, 660], [1400, 600], [1410, 520], [1420, 460]]) },
  { name: 'Falls Trail', type: 'trail', pts: W([[1190, 360], [1260, 380], [1330, 400], [1390, 430]]) },
  { name: 'Shrine Path', type: 'trail', pts: W([[905, 214], [910, 205]]) },
];

// Historic railway, coming in from the south-east to Karimulam station.
export const RAILWAY = W([[1010, 905], [1060, 925], [1120, 942], [1200, 962], [1300, 984], [1420, 1002], [1536, 1012], [1600, 1016]]);

// ── Places (points of interest). r = radius of the area in metres.
const P = (id, name, sub, px, py, r, extra = {}) => {
  const [x, z] = toWorld(px, py);
  return { id, name, sub, x, z, r, ...extra };
};
export const PLACES = [
  P('lighthouse_point', 'Lighthouse Point', 'The northern light', 412, 64, 160),
  P('muthalappuzha', 'Muthalappuzha', 'Fishing Village', 470, 258, 300),
  P('mangrove', 'Mangrove Coast', 'A hidden network', 360, 400, 450),
  P('veliyathura', 'Veliyathura', 'Harbour & Lighthouse', 246, 572, 260),
  P('salt_pans', 'Salt Pan Flats', 'White gold of the coast', 462, 664, 360),
  P('kayalore', 'Kayalore', 'Southern Coast', 396, 856, 260),
  P('fort', 'Abandoned Fort', 'A forgotten past, still watching', 520, 818, 200),
  P('southern_ferry', 'Southern Ferry', 'People, goods and stories cross here', 718, 924, 200),
  P('karimulam', 'Karimulam', 'A village with deep roots and old secrets', 990, 884, 280),
  P('thenga_paddy', 'Thenga Paddy', 'Fertile fields and waterways', 700, 780, 500),
  P('kuttan_canal', 'Kuttan Canal', 'Life moves with the water', 1080, 760, 600),
  P('kalliyar_ferry', 'Kalliyar Ferry', 'The crossing', 822, 640, 160),
  P('bridge', 'Vaikara Bridge', 'Connecting people, trade and opportunity', 655, 590, 200),
  P('river_ghat', 'River Ghat', 'Steps to the water', 592, 552, 110),
  P('old_bazaar', 'Old Bazaar', 'Spices, cloth and rumours', 612, 512, 150),
  P('vaikara_town', 'Vaikara Town', 'The heart of the region', 690, 486, 320),
  P('st_thomas', 'St. Thomas Church', 'Faith on the hill', 604, 405, 100),
  P('juma_mosque', 'Juma Mosque', 'Call across the rooftops', 722, 420, 100),
  P('ponnambalam', 'Ponnambalam Temple', 'Faith, tradition and community', 810, 384, 150),
  P('district_court', 'District Court', 'Justice, influence and money', 852, 512, 120),
  P('residency', 'Colonial Residency', 'The symbol of British authority', 962, 498, 150),
  P('puliyur', 'Puliyur', 'The northern village', 742, 182, 260),
  P('monsoon_shrine', 'Monsoon Shrine', 'Where the rains are prayed for', 910, 206, 90),
  P('hill_trading_post', 'Hill Trading Post', 'Last stop before the hills', 916, 272, 110),
  P('black_rock_pass', 'Black Rock Pass', 'The road over the ridge', 1228, 228, 200),
  P('kurumala', 'Kurumala Highlands', 'The forgotten heights', 1360, 170, 700),
  P('kanmala', 'Kanmala Tea Estate', 'The green hills', 1110, 410, 450),
  P('vellar_falls', 'Vellar Falls', 'A hidden gem in the highlands', 1420, 428, 160),
  P('elephant_forest', 'Elephant Forest', 'Untamed and full of life', 1400, 560, 500),
  P('teak_reserve', 'Old Teak Reserve', 'Guarded by nature and men', 1380, 700, 450),
  P('north_coast_road', 'North Coast Road', 'The long way north', 990, 140, 250),
];
export const placeById = Object.fromEntries(PLACES.map((p) => [p.id, p]));
