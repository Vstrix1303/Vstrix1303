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

// ---------------------------------------------------------------- Malayalam voices
// Lines are voiced in Malayalam from recordings made by tools/voice/make.py (assets/voice: one file per line
// per voice — m, f, c — keyed by a hash of the English line, which stays on screen as the subtitle).
// G.voiceLang: 'ml' (default: recorded Malayalam; lines with no recording are left silent), 'en' (the system's
// English voices, as before), 'off'.
let MLV = null, cur = null;
export async function loadMalayalam() {
  if (location.protocol === 'file:') return;
  try { const r = await fetch('assets/voice/manifest.json'); if (r.ok) MLV = (await r.json()).lines; } catch (e) { /* no voices */ }
}
// SHA-1, first 12 hex digits, of the UTF-8 text: the same key make.py uses
function sha1(str) {
  const b = new TextEncoder().encode(str), l = b.length, n = ((l + 8 >> 6) + 1) * 16, w = new Uint32Array(n);
  for (let i = 0; i < l; i++) w[i >> 2] |= b[i] << (24 - (i % 4) * 8);
  w[l >> 2] |= 0x80 << (24 - (l % 4) * 8); w[n - 1] = l * 8;
  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
  const W = new Uint32Array(80);
  for (let i = 0; i < n; i += 16) {
    for (let t = 0; t < 16; t++) W[t] = w[i + t];
    for (let t = 16; t < 80; t++) { const x = W[t - 3] ^ W[t - 8] ^ W[t - 14] ^ W[t - 16]; W[t] = (x << 1) | (x >>> 31); }
    let a = h0, b2 = h1, c = h2, d = h3, e = h4;
    for (let t = 0; t < 80; t++) {
      const f = t < 20 ? (b2 & c) | (~b2 & d) : t < 40 ? b2 ^ c ^ d : t < 60 ? (b2 & c) | (b2 & d) | (c & d) : b2 ^ c ^ d;
      const k = t < 20 ? 0x5a827999 : t < 40 ? 0x6ed9eba1 : t < 60 ? 0x8f1bbcdc : 0xca62c1d6;
      const tmp = (((a << 5) | (a >>> 27)) + f + e + k + W[t]) >>> 0; e = d; d = c; c = (b2 << 30) | (b2 >>> 2); b2 = a; a = tmp;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b2) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
  }
  return [h0, h1, h2, h3, h4].map((x) => x.toString(16).padStart(8, '0')).join('').slice(0, 12);
}
function speakML(name, text, kind, preset, vol) {
  if (!MLV) return;
  const k = sha1(text); if (!MLV[k]) return;               // no recording: the subtitle alone
  if (kind === 'bark' && cur && !cur.paused && cur.kind === 'line') return;
  if (cur) { cur.pause(); cur = null; }
  const prof = preset ? { female: !!preset.female, child: !!preset.child, old: !!(preset.age || preset.grey) } : profileFor(name);
  const v = prof.child ? 'c' : prof.female ? 'f' : 'm';
  const url = `assets/voice/${k}_${v}.ogg`, r = hash((name || 'narrator') + (preset ? `${preset.skin}|${preset.shirt}` : ''));
  const rate = (prof.old ? 0.92 : prof.narrator ? 0.95 : 1) * (0.97 + r * 0.07);
  const ctx = G.audio?.ctx;
  const token = cur = { kind, stop: null, paused: false, pause() { this.paused = true; this.stop?.(); } };
  G.voiceLine = kind === 'line';
  const done = () => { if (cur === token) { cur = null; G.voiceLine = false; } };
  if (ctx) {
    // through the game's own mixer: decoded once, kept for next time
    const play = (buf) => {
      if (token.paused) return;
      const src = ctx.createBufferSource(), g = ctx.createGain();
      src.buffer = buf; src.playbackRate.value = rate; g.gain.value = Math.max(0, Math.min(1.4, vol * 1.25));
      src.connect(g); g.connect(G.audio.master || ctx.destination); src.onended = done; src.start();
      token.stop = () => { try { src.stop(); } catch (e) { /* stopped */ } };
    };
    const hit = BUFS.get(url);
    if (hit) play(hit);
    else fetch(url).then((res) => res.arrayBuffer()).then((ab) => ctx.decodeAudioData(ab)).then((buf) => { BUFS.set(url, buf); if (BUFS.size > 80) BUFS.delete(BUFS.keys().next().value); play(buf); }).catch(done);
  } else {
    const a = new Audio(url); a.preservesPitch = false; a.playbackRate = rate; a.volume = Math.max(0, Math.min(1, vol));
    token.stop = () => a.pause(); a.onended = done; a.play().catch(done);
  }
}
const BUFS = new Map();

// kind: 'line' (dialogue: replaces anything playing) or 'bark' (a passing remark: never cuts a line)
export function speak(name, text, kind = 'line', preset = null, vol = 0.95) {
  if (!text || G.voiceOff || (G.audio && G.audio.enabled === false) || G.voiceLang === 'off') return;
  if ((G.voiceLang || 'ml') === 'ml') { speakML(name, clean(text) === text ? text : text, kind, preset, vol); return; }
  if (!S) return;
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
export function hush() { if (S) { try { S.cancel(); } catch (e) { /* ignore */ } } if (cur) { cur.pause(); cur = null; } G.voiceLine = false; }
