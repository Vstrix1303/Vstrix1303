// Named places: shown on the survey map and announced when first visited.
import { LOC } from './heightfield.js';

export const PLACES = [
  { id: 'village', name: 'Thekkumkara', x: -40, z: 8, r: 70, big: true },
  { id: 'home', name: 'The Tharavadu', x: LOC.home.x, z: LOC.home.z, r: 26 },
  { id: 'temple', name: 'Temple & Tank', x: LOC.temple.x, z: LOC.temple.z - 20, r: 34 },
  { id: 'jetty', name: 'Village Jetty', x: -205, z: 40, r: 22 },
  { id: 'pepper', name: 'Pepper Garden', x: LOC.pepper.x, z: LOC.pepper.z, r: 36 },
  { id: 'paddy', name: 'Kuttanad Paddy', x: 0, z: 360, r: 90, region: true },
  { id: 'toddy', name: 'Toddy Shop', x: LOC.toddy.x, z: LOC.toddy.z, r: 16 },
  { id: 'falls', name: 'Lotus Falls', x: 184, z: 190, r: 26 },
  { id: 'kavu', name: 'Sarpa Kavu', x: LOC.kavu.x, z: LOC.kavu.z, r: 18 },
  { id: 'port', name: 'Puthenthura', x: -404, z: -372, r: 60, big: true },
  { id: 'compound', name: 'Harrow & Finch', x: -478, z: -346, r: 30 },
  { id: 'cutcherry', name: 'The Cutcherry', x: LOC.cutcherry.x, z: LOC.cutcherry.z + 8, r: 40 },
  { id: 'estate', name: 'Kannimala Estate', x: LOC.estate.x, z: LOC.estate.z, r: 46 },
  { id: 'island', name: 'Shrine Island', x: LOC.island.x, z: LOC.island.z, r: 22 },
  { id: 'light', name: 'Azhimukham Light', x: LOC.lighthouse.x, z: LOC.lighthouse.z, r: 26 },
  { id: 'hamlet', name: 'Azhikkal', x: LOC.hamlet.x, z: LOC.hamlet.z, r: 34 },
  { id: 'fort', name: 'Kottappuram Ruin', x: LOC.fort.x, z: LOC.fort.z, r: 26 },
  { id: 'kayal', name: 'T H E   K A Y A L', x: -400, z: 150, water: true },
  { id: 'sea', name: 'A R A B I A N   S E A', x: -768, z: -300, water: true, vertical: true },
  { id: 'bar', name: 'The Bar', x: -640, z: 40, water: true, small: true },
  { id: 'ghats', name: 'W E S T E R N   G H A T S', x: 640, z: 60, region: true, vertical: true },
];
