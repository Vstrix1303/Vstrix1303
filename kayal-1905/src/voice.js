// Spoken lines, through the speech voices installed on the machine (Windows has them built in;
// Indian English voices are used where present). Every speaker keeps one voice: chosen by sex and
// age, with a pitch and pace fixed from the name so two villagers never sound alike, the narrator
// slower and lower, the Company's men in an English voice when one is installed.
import { G } from './state.js';

const S = typeof window !== 'undefined' ? window.speechSynthesis : null;
const known = new Map();          // speaker name -> { female, child, old, english }
let voices = [];
const loadVoices = () => { voices = S ? S.getVoices() : []; };
if (S) { loadVoices(); S.onvoiceschanged = loadVoices; }

const FEMALE_NAMES = /devaki|mariamma|ammu|kunjipennu|woman|lady|seller.*f|fisherwoman|townswoman|amma|chechi|girl|wife|widow|pilgrim|plucker/i;
const ENGLISH = /finch|harrow|dacre|carmichael|captain|sir |mr\.|sahib/i;
const FEMALE_VOICE = /female|zira|heera|hazel|susan|kalpana|neerja|aria|jenny|sonia|libby|catherine|samantha|karen|veena|swara|woman/i;
const MALE_VOICE = /male|david|ravi|george|mark|hemant|prabhat|guy|ryan|daniel|alex|james|madhur|valluvar/i;

// called by NPCs and the cast so lines can be voiced by who is speaking
export function registerSpeaker(name, preset = {}) {
  if (!name || known.has(name)) return;
  known.set(name, { female: !!preset.female, child: !!preset.child, old: !!(preset.age || preset.grey), english: !!(preset.eye != null || preset.trousers != null && preset.headgear === 'topi') });
}
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; };

function pick(prof) {
  if (!voices.length) loadVoices();
  if (!voices.length) return null;
  const en = voices.filter((v) => /^en/i.test(v.lang));
  const pool = en.length ? en : voices;
  const want = prof.english ? /en-GB/i : /en-IN/i;
  const bySex = (list) => list.filter((v) => (prof.female ? FEMALE_VOICE.test(v.name) : MALE_VOICE.test(v.name) && !FEMALE_VOICE.test(v.name)));
  const regional = pool.filter((v) => want.test(v.lang));
  return bySex(regional)[0] || bySex(pool)[0] || regional[0] || pool[0];
}

function profileFor(name) {
  if (!name) return { narrator: true, female: false };
  if (name === 'Madhavan') return { female: false };
  const k = known.get(name);
  if (k) return k;
  return { female: FEMALE_NAMES.test(name), english: ENGLISH.test(name), child: /child|boy|pupil|unni|kuttan/i.test(name), old: /old|ammavan|hajji|asan|priest/i.test(name) };
}

const clean = (t) => String(t).replace(/<[^>]+>/g, '').replace(/[“”"«»]/g, '').replace(/\s+—\s+/g, ', ').trim();

// kind: 'line' (dialogue: replaces anything playing) or 'bark' (a passing remark: never cuts a line)
export function speak(name, text, kind = 'line', preset = null, vol = 0.95) {
  if (!S || !text || G.voiceOff || (G.audio && G.audio.enabled === false)) return;
  if (kind === 'bark' && S.speaking && G.voiceLine) return;
  S.cancel();
  const prof = preset ? { female: !!preset.female, child: !!preset.child, old: !!(preset.age || preset.grey), english: preset.eye != null } : profileFor(name);
  const u = new SpeechSynthesisUtterance(clean(text));
  const v = pick(prof);
  if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-IN';
  const r = hash((name || 'narrator') + (preset ? `${preset.skin}|${preset.mundu}|${preset.shirt}|${preset.headgear}` : ''));
  u.pitch = prof.narrator ? 0.82 : prof.child ? 1.45 + r * 0.2 : (prof.female ? 1.05 : 0.88) + (r - 0.5) * 0.22 - (prof.old ? 0.12 : 0);
  u.rate = prof.narrator ? 0.88 : (prof.old ? 0.88 : prof.child ? 1.05 : 0.96) + (r - 0.5) * 0.1;
  u.volume = vol;
  G.voiceLine = kind === 'line';
  u.onend = u.onerror = () => { G.voiceLine = false; };
  try { S.speak(u); } catch (e) { /* no speech on this system */ }
}
export function hush() { if (S) { try { S.cancel(); } catch (e) { /* ignore */ } } G.voiceLine = false; }
