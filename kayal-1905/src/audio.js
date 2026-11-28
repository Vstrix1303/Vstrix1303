// All sound is synthesised live with WebAudio: monsoon rain, wind, water,
// koels and crickets, thunder, footsteps, and a generative score built on
// Carnatic raga scales over a tanpura-like drone.
import { G } from './state.js';
import { clamp } from './util.js';

// Pentatonic ragas (semitones above the tonic). Phrases are written as scale
// degrees, so the same melodic shapes can be sung in any of them.
const RAGAS = {
  calm: [0, 2, 4, 7, 9],        // Mohanam
  dawn: [0, 2, 4, 7, 11],       // Hamsadhwani
  rain: [0, 2, 5, 7, 10],       // Megh / Madhyamavati
  night: [0, 2, 3, 7, 9],       // Shivaranjani
  chase: [0, 3, 5, 7, 10],      // Shuddha Dhanyasi
  none: [0, 2, 4, 7, 9],
};
// [degree, beats]; degree 0 = Sa, 5 = upper Sa; null = breath
const PHRASES = {
  A: [[2, 1], [3, 1], [4, 2], [3, 1], [2, 1], [1, 2]],
  B: [[2, 1], [1, 1], [0, 2], [1, 1], [2, 1], [3, 2]],
  C: [[3, 1], [4, 1], [5, 2], [4, 1], [3, 1], [2, 2]],
  D: [[5, 1.5], [4, 0.5], [3, 1], [2, 1], [1, 1], [2, 1], [0, 3]],
  E: [[4, 1], [5, 1], [6, 2], [5, 1], [4, 1], [3, 2]],
  F: [[2, 2], [3, 1], [2, 1], [1, 1], [0, 1], [0, 2]],
  G: [[0, 1], [1, 1], [2, 1], [3, 1], [4, 2], [3, 2]],
  H: [[5, 2], [4, 1], [5, 1], [4, 1], [3, 1], [2, 2]],
  // sparse, for night
  N1: [[0, 3], [2, 1], [1, 4]], N2: [[3, 3], [2, 1], [0, 4]], N3: [[4, 2], [3, 2], [2, 1], [1, 1], [0, 4]],
  // driving ostinati, for pursuit
  X1: [[0, 0.5], [0, 0.5], [2, 0.5], [0, 0.5], [3, 0.5], [2, 0.5], [0, 0.5], [1, 0.5]],
  X2: [[3, 0.5], [3, 0.5], [4, 0.5], [3, 0.5], [5, 0.5], [4, 0.5], [3, 0.5], [2, 0.5]],
};
const SONGS = {
  calm: { bpm: 66, voice: 'flute', form: ['A', 'B', 'A', 'D', 'C', 'E', 'C', 'D', 'G', 'F'], gap: 3 },
  dawn: { bpm: 60, voice: 'flute', form: ['G', 'C', 'H', 'D', 'A', 'E', 'H', 'F'], gap: 4 },
  rain: { bpm: 54, voice: 'flute', form: ['F', 'B', 'N3', 'A', 'D', 'N2'], gap: 4 },
  night: { bpm: 46, voice: 'veena', form: ['N1', 'N2', 'B', 'N3', 'N1', 'F'], gap: 5 },
  chase: { bpm: 138, voice: 'veena', form: ['X1', 'X1', 'X2', 'X1'], gap: 0, drums: true },
};

export class AudioSys {
  constructor() {
    this.ctx = null; this.mood = 'calm'; this.musicVol = 0.42; this.enabled = true;
    this.nextBird = 2; this.seq = { mood: '', pi: 0, ni: 0, t: 0, last: 0 }; this.tanT = 0; this.tanI = 0; this.beatT = 0; this.beatI = 0;
  }
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    try { this.ctx = new AC(); } catch (e) { this.enabled = false; return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = 0.8;
    const comp = c.createDynamicsCompressor();
    this.master.connect(comp); comp.connect(c.destination);
    // noise buffer
    const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    // a soft hall around the music (generated impulse response)
    this.musicBus = c.createGain(); this.musicBus.gain.value = this.musicVol;
    {
      const n = Math.floor(c.sampleRate * 2.6), ir = c.createBuffer(2, n, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const dd = ir.getChannelData(ch); for (let i = 0; i < n; i++) dd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6); }
      const conv = c.createConvolver(); conv.buffer = ir;
      const wet = c.createGain(); wet.gain.value = 0.38;
      const tone = c.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 3600;
      this.musicBus.connect(this.master);
      this.musicBus.connect(conv); conv.connect(tone); tone.connect(wet); wet.connect(this.master);
    }
    // ambience loops
    const loop = (type, freq, q) => {
      const s = c.createBufferSource(); s.buffer = buf; s.loop = true;
      const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = c.createGain(); g.gain.value = 0;
      s.connect(f); f.connect(g); g.connect(this.master); s.start(0, Math.random());
      return { f, g };
    };
    this.wind = loop('lowpass', 380, 0.4);
    this.rainHi = loop('highpass', 2400, 0.3);
    this.rainLo = loop('bandpass', 900, 0.5);
    this.water = loop('bandpass', 520, 1.2);
    // crickets
    {
      const o = c.createOscillator(); o.frequency.value = 4300; o.type = 'sine';
      const am = c.createGain(); am.gain.value = 0;
      const lfo = c.createOscillator(); lfo.frequency.value = 38; lfo.type = 'square';
      const lg = c.createGain(); lg.gain.value = 0.5;
      const g = c.createGain(); g.gain.value = 0;
      lfo.connect(lg); lg.connect(am.gain); o.connect(am); am.connect(g); g.connect(this.master);
      o.start(); lfo.start();
      this.crick = g;
    }
    // the tanpura's bus (plucked in a slow cycle from update)
    this.droneG = c.createGain(); this.droneG.gain.value = 0;
    this.droneG.connect(this.musicBus);
    this.tonic = 146.83;
  }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  setMood(m) { this.mood = m; }

  env(node, t, a, peak, dcy) {
    node.gain.cancelScheduledValues(t);
    node.gain.setValueAtTime(0.0001, t);
    node.gain.linearRampToValueAtTime(peak, t + a);
    node.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy);
  }
  burst(type, freq, q, vol, a, dcy, dest, when = 0, sweepTo = null) {
    const c = this.ctx, t = c.currentTime + when;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + a + dcy);
    const g = c.createGain(); this.env(g, t, a, vol, dcy);
    s.connect(f); f.connect(g); g.connect(dest || this.master);
    s.start(t, Math.random() * 1.5); s.stop(t + a + dcy + 0.05);
  }
  tone(type, f0, f1, vol, a, dcy, when = 0, dest = null) {
    const c = this.ctx, t = c.currentTime + when;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + a + dcy);
    const g = c.createGain(); this.env(g, t, a, vol, dcy);
    o.connect(g); g.connect(dest || this.master);
    o.start(t); o.stop(t + a + dcy + 0.05);
    return o;
  }

  sfx(name, v = 1) {
    if (!this.ctx || !this.enabled) return;
    switch (name) {
      case 'step': this.burst('lowpass', 500 + Math.random() * 300, 0.7, 0.16 * v, 0.004, 0.09); break;
      case 'wade': this.burst('bandpass', 900, 0.8, 0.2 * v, 0.02, 0.28, null, 0, 400); break;
      case 'splash': this.burst('bandpass', 1400, 0.6, 0.4 * v, 0.01, 0.55, null, 0, 350); break;
      case 'paddle': this.burst('bandpass', 700, 0.9, 0.28 * v, 0.08, 0.5, null, 0, 300); break;
      case 'hoof': this.tone('sine', 150, 60, 0.35 * v, 0.003, 0.09); this.burst('lowpass', 900, 0.6, 0.12 * v, 0.002, 0.05); this.tone('sine', 140, 55, 0.3 * v, 0.003, 0.09, 0.11); break;
      case 'swing': this.burst('bandpass', 700, 2, 0.22 * v, 0.03, 0.16, null, 0, 2600); break;
      case 'thud': this.tone('sine', 190, 55, 0.6 * v, 0.003, 0.16); this.burst('lowpass', 1300, 0.5, 0.35 * v, 0.002, 0.08); break;
      case 'hit': this.tone('triangle', 240, 70, 0.5 * v, 0.003, 0.2); this.burst('bandpass', 1800, 0.8, 0.25 * v, 0.002, 0.07); break;
      case 'mount': this.burst('lowpass', 700, 0.7, 0.25, 0.01, 0.15); this.tone('sine', 120, 70, 0.3, 0.004, 0.12, 0.08); break;
      case 'pickup': this.burst('highpass', 3000, 0.5, 0.12, 0.005, 0.12); this.tone('sine', 660, null, 0.12, 0.005, 0.2, 0.02); this.tone('sine', 990, null, 0.1, 0.005, 0.3, 0.1); break;
      case 'coin': [1320, 1760, 2640].forEach((f, i) => this.tone('sine', f, null, 0.1, 0.002, 0.4, i * 0.07)); break;
      case 'ui': this.tone('sine', 520, null, 0.08, 0.004, 0.12); break;
      case 'page': this.burst('highpass', 1800, 0.4, 0.12, 0.03, 0.2, null, 0, 5000); break;
      case 'bell': for (let k = 0; k < 6; k++) [620, 1245, 1870, 2610].forEach((f, i) => this.tone('sine', f * (1 + i * 0.003), null, 0.16 / (i + 1), 0.002, 1.1, k * 0.42)); break;
      case 'chapter': this.tone('sine', this.tonic, null, 0.25, 0.4, 3.2, 0, this.musicBus); this.tone('sine', this.tonic * 1.5, null, 0.16, 0.5, 3.2, 0.15, this.musicBus); this.tone('triangle', this.tonic * 2, null, 0.12, 0.5, 3.4, 0.4, this.musicBus); break;
      case 'koel': for (let k = 0; k < 4; k++) this.tone('sine', 900 + k * 60, 1500 + k * 90, 0.07 * v, 0.06, 0.26, k * 0.42); break;
      case 'crow': for (let k = 0; k < 3; k++) { const o = this.tone('sawtooth', 560, 430, 0.045 * v, 0.02, 0.17, k * 0.3); } break;
      case 'chirp': for (let k = 0; k < 3; k++) this.tone('sine', 3200 + Math.random() * 1400, 2600 + Math.random() * 800, 0.035 * v, 0.008, 0.06, k * 0.09); break;
      case 'frog': for (let k = 0; k < 4; k++) this.tone('square', 260, 210, 0.03 * v, 0.01, 0.07, k * 0.16); break;
      case 'elephant': this.tone('sawtooth', 300, 560, 0.14 * v, 0.2, 0.9); this.tone('square', 310, 590, 0.05 * v, 0.2, 0.9, 0.03); break;
      case 'shot': this.burst('lowpass', 2600, 0.5, 1.0 * v, 0.001, 0.32, null, 0, 300); this.tone('sine', 120, 38, 0.8 * v, 0.002, 0.3); this.burst('highpass', 3500, 0.4, 0.35 * v, 0.001, 0.08); this.burst('bandpass', 700, 0.6, 0.18 * v, 0.12, 1.4, null, 0.05, 200); break;
      case 'boom': this.burst('lowpass', 900, 0.5, 1.2 * v, 0.002, 1.6, null, 0, 120); this.tone('sine', 90, 30, 1.0 * v, 0.004, 1.2); this.burst('lowpass', 260, 0.6, 0.8 * v, 0.05, 2.8, null, 0.08, 60); this.burst('highpass', 3000, 0.4, 0.3 * v, 0.001, 0.2); break;
      case 'shotgun': this.burst('lowpass', 1600, 0.5, 1.1 * v, 0.001, 0.45, null, 0, 200); this.tone('sine', 100, 34, 0.9 * v, 0.002, 0.35); this.burst('bandpass', 600, 0.6, 0.25 * v, 0.1, 1.2, null, 0.05, 160); break;
      case 'rifleshot': this.burst('lowpass', 3200, 0.5, 0.8 * v, 0.001, 0.22, null, 0, 400); this.tone('sine', 140, 50, 0.5 * v, 0.002, 0.18); break;
      case 'sniper': this.burst('lowpass', 2400, 0.5, 1.1 * v, 0.001, 0.5, null, 0, 250); this.tone('sine', 110, 36, 0.9 * v, 0.002, 0.4); this.burst('bandpass', 500, 0.6, 0.25 * v, 0.2, 2.2, null, 0.1, 120); break;
      case 'silenced': this.burst('bandpass', 1400, 1.2, 0.35 * v, 0.001, 0.09, null, 0, 600); break;
      case 'launch': this.burst('bandpass', 900, 0.7, 0.7 * v, 0.01, 0.9, null, 0, 300); this.burst('highpass', 2500, 0.5, 0.3 * v, 0.02, 0.6); break;
      case 'door': this.burst('bandpass', 380, 3, 0.12 * v, 0.05, 0.35, null, 0, 520); this.tone('triangle', 210, 260, 0.03 * v, 0.08, 0.3); break;
      case 'doorShut': if (v > 0.05) { this.tone('sine', 140, 70, 0.3 * v, 0.003, 0.14); this.burst('lowpass', 700, 0.6, 0.2 * v, 0.002, 0.08); } break;
      case 'click': this.burst('highpass', 4200, 1.5, 0.18 * v, 0.001, 0.03); break;
      case 'punch': this.tone('sine', 160, 60, 0.45 * v, 0.002, 0.1); this.burst('lowpass', 900, 0.7, 0.25 * v, 0.002, 0.06); break;
      case 'reload': for (let k = 0; k < 3; k++) this.burst('highpass', 3800, 1.5, 0.16 * v, 0.001, 0.035, null, k * 0.11); break;
      case 'horn': this.tone('sawtooth', 392, null, 0.16 * v, 0.02, 0.42); this.tone('sawtooth', 494, null, 0.12 * v, 0.02, 0.42); break;
      case 'cycbell': for (let k = 0; k < 2; k++) [2380, 3170, 4400].forEach((f, i) => this.tone('sine', f, null, 0.09 * v / (i + 1), 0.002, 0.5, k * 0.16)); break;
      case 'clang': [1840, 2760, 3975].forEach((f, i) => this.tone('triangle', f, f * 0.98, 0.2 / (i + 1), 0.001, 0.22)); this.burst('highpass', 4000, 0.5, 0.2, 0.001, 0.06); break;
      case 'growl': this.tone('sawtooth', 120, 80, 0.2 * v, 0.08, 0.5); this.burst('bandpass', 500, 2, 0.14, 0.1, 0.5, null, 0, 1800); break;
      case 'hiss': this.burst('highpass', 3200, 0.4, 0.4, 0.02, 1.3, null, 0, 6000); break;
      case 'drum': this.drum(0, true); this.drum(0.16, false); break;
      case 'whistle': this.tone('sine', 1500, 2500, 0.16, 0.05, 0.22); this.tone('sine', 2500, 1700, 0.14, 0.03, 0.3, 0.26); break;
      case 'passed': [0, 4, 7, 12, 16].forEach((st, i) => this.pluck(this.tonic * 2 * Math.pow(2, st / 12), 0.22, i * 0.13)); this.tone('sine', this.tonic, null, 0.2, 0.3, 2.6, 0, this.musicBus); break;
    }
  }
  thunder(delay = 1) {
    if (!this.ctx) return;
    this.burst('lowpass', 220, 0.6, 0.9, 0.05, 3.2, null, delay, 60);
    this.burst('lowpass', 900, 0.5, 0.35, 0.01, 0.5, null, delay);
    this.burst('lowpass', 140, 0.6, 0.5, 0.4, 4.5, null, delay + 0.8, 50);
  }

  // one string of the tanpura: a slow-blooming buzz
  tanpura(freq, when) {
    const c = this.ctx, t = c.currentTime + when;
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq;
    const o2 = c.createOscillator(); o2.type = 'triangle'; o2.frequency.value = freq * 2.001;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(1900, t + 0.7); f.frequency.exponentialRampToValueAtTime(600, t + 5);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + 0.12); g.gain.exponentialRampToValueAtTime(0.0001, t + 5.5);
    const g2 = c.createGain(); g2.gain.value = 0.35;
    o.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(this.droneG);
    o.start(t); o2.start(t); o.stop(t + 5.6); o2.stop(t + 5.6);
  }
  // a plucked string (veena): clean, warm, quick to bloom and slow to fade
  pluck(freq, vol, when, slideFrom) {
    const c = this.ctx, t = c.currentTime + when;
    const o = c.createOscillator(); o.type = 'triangle';
    const o2 = c.createOscillator(); o2.type = 'sine';
    o.frequency.setValueAtTime(slideFrom || freq, t); o2.frequency.setValueAtTime((slideFrom || freq) * 2, t);
    if (slideFrom) { o.frequency.exponentialRampToValueAtTime(freq, t + 0.09); o2.frequency.exponentialRampToValueAtTime(freq * 2, t + 0.09); }
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.8;
    f.frequency.setValueAtTime(2600, t); f.frequency.exponentialRampToValueAtTime(700, t + 1.4);
    const g = c.createGain(); this.env(g, t, 0.008, vol, 2.0);
    const g2 = c.createGain(); g2.gain.value = 0.22;
    o.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(this.musicBus);
    o.start(t); o2.start(t); o.stop(t + 2.2); o2.stop(t + 2.2);
  }
  // a bamboo flute: breathy attack, late vibrato, glides from the previous note
  flute(freq, vol, when, dur, from) {
    const c = this.ctx, t = c.currentTime + when;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.09); g.gain.setValueAtTime(vol * 0.9, t + Math.max(0.1, dur - 0.12)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.22);
    g.connect(this.musicBus);
    const vib = c.createOscillator(); vib.frequency.value = 5; const vg = c.createGain();
    vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(freq * 0.005, t + Math.min(dur, 0.6));
    vib.connect(vg); vib.start(t); vib.stop(t + dur + 0.3);
    for (const [mult, amp] of [[1, 1], [2, 0.22], [3, 0.07]]) {
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime((from || freq) * mult, t); if (from) o.frequency.exponentialRampToValueAtTime(freq * mult, t + 0.07);
      vg.connect(o.frequency);
      const og = c.createGain(); og.gain.value = amp;
      o.connect(og); og.connect(g); o.start(t); o.stop(t + dur + 0.3);
    }
    this.burst('bandpass', freq * 2, 2.5, vol * 0.1, 0.03, 0.14, this.musicBus, when);
  }
  drum(when, strong) {
    this.tone('sine', strong ? 170 : 230, strong ? 90 : 150, strong ? 0.42 : 0.18, 0.002, strong ? 0.16 : 0.08, when, this.musicBus);
    this.burst('bandpass', strong ? 900 : 2200, 1.5, strong ? 0.18 : 0.1, 0.001, 0.05, this.musicBus, when);
  }

  update(dt, s) {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx, now = c.currentTime;
    const sm = (p, v, tc = 0.4) => p.setTargetAtTime(v, now, tc);
    sm(this.wind.g.gain, 0.05 + s.rain * 0.16 + s.speed * 0.006);
    sm(this.wind.f.frequency, 300 + s.rain * 300 + s.speed * 25);
    sm(this.rainHi.g.gain, s.rain * 0.16);
    sm(this.rainLo.g.gain, s.rain * 0.22);
    sm(this.water.g.gain, s.nearWater * 0.07 * (0.6 + 0.4 * Math.sin(G.time * 0.9)), 0.2);
    sm(this.crick.gain, s.night * (1 - s.rain * 0.7) * 0.012);
    const musicOn = this.mood !== 'none' && !s.muted;
    sm(this.droneG.gain, 0, 1.5);
    sm(this.musicBus.gain, this.musicVol * (s.paused ? 0.4 : 1), 0.5);
    // ambient creatures
    this.nextBird -= dt;
    if (this.nextBird <= 0) {
      this.nextBird = 2 + Math.random() * 7;
      if (s.night > 0.6) { if (s.rain > 0.3 || s.nearWater > 0.5) this.sfx('frog', 1); }
      else if (s.rain < 0.6) { const r = Math.random(); this.sfx(r < 0.3 ? 'koel' : r < 0.5 ? 'crow' : 'chirp', 0.6 + Math.random() * 0.5); }
    }
    // ---- the score (see score() below)
    if (!musicOn) return;
    this.score(now);
  }

  // ================================================================ RAAPAKAL's score
  // A live band in the manner of a 1950s Malayalam film orchestra meeting a Kerala temple ensemble:
  // chenda and veekku drum, maddalam, ilathalam cymbals, a walking bass, harmonium chords, a nadaswaram-like
  // reed lead (and a veena at night), brass stabs in a fight. Chords and melody are generated bar by bar.
  // Moods: explore (free roam by day), action (a fight, a chase, the police), night, rain, dawn.
  musicMood() {
    const m = this.mood;
    if (G.combatHeat > 0.5 || m === 'chase') return 'action';
    if (m === 'night') return 'night';
    if (m === 'rain') return 'rain';
    return 'explore';
  }
  // ---- instruments
  chenda(when, v, open) {          // the stick on the drum head: a dry crack with a pitched ring
    this.burst('bandpass', open ? 1400 : 2600, open ? 2 : 3.5, v * 0.5, 0.001, open ? 0.12 : 0.05, this.musicBus, when);
    this.tone('triangle', open ? 420 : 560, open ? 300 : 460, v * 0.18, 0.001, open ? 0.12 : 0.05, when, this.musicBus);
  }
  veekku(when, v) { this.tone('sine', 120, 48, v * 0.9, 0.003, 0.32, when, this.musicBus); this.burst('lowpass', 500, 0.7, v * 0.25, 0.002, 0.08, this.musicBus, when); }
  maddalam(when, v, hi) { this.tone('sine', hi ? 240 : 150, hi ? 180 : 95, v * 0.55, 0.002, hi ? 0.12 : 0.22, when, this.musicBus); }
  tabla(when, v, hi) { this.tone('sine', hi ? 520 : 180, hi ? 500 : 110, v * 0.35, 0.002, hi ? 0.14 : 0.18, when, this.musicBus); this.burst('bandpass', hi ? 3000 : 700, 4, v * 0.12, 0.001, 0.04, this.musicBus, when); }
  ilathalam(when, v) { this.burst('highpass', 6500, 0.8, v * 0.22, 0.001, 0.22, this.musicBus, when); for (const f of [3980, 5210]) this.tone('square', f, null, v * 0.012, 0.001, 0.18, when, this.musicBus); }
  bass(freq, when, dur, v) {
    const c = this.ctx, t = c.currentTime + when, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth'; o.frequency.value = freq; f.type = 'lowpass'; f.Q.value = 3; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(220, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.95);
    o.connect(f); f.connect(g); g.connect(this.musicBus); o.start(t); o.stop(t + dur + 0.05);
  }
  harmonium(freqs, when, dur, v) {          // reeds through a soft filter, a slow bellows swell
    const c = this.ctx, t = c.currentTime + when, g = c.createGain(), f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 1500; f.Q.value = 0.6;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.12); g.gain.setValueAtTime(v * 0.85, t + dur - 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.15);
    f.connect(g); g.connect(this.musicBus);
    for (const fr of freqs) for (const det of [-3, 4]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.detune.value = det; const og = c.createGain(); og.gain.value = 0.12; o.connect(og); og.connect(f); o.start(t); o.stop(t + dur + 0.2); }
  }
  reed(freq, when, dur, v, from) {          // the nadaswaram: a buzzing double reed, slides between notes, a wide late vibrato
    const c = this.ctx, t = c.currentTime + when, o = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter(), f2 = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth'; o2.type = 'square';
    for (const os of [o, o2]) { os.frequency.setValueAtTime(from || freq, t); if (from) os.frequency.exponentialRampToValueAtTime(freq, t + Math.min(0.09, dur * 0.4)); }
    const vib = c.createOscillator(), vg = c.createGain(); vib.frequency.value = 5.6; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(freq * 0.012, t + Math.min(dur, 0.45));
    vib.connect(vg); vg.connect(o.frequency); vg.connect(o2.frequency);
    f.type = 'bandpass'; f.frequency.value = Math.min(3200, freq * 3); f.Q.value = 1.4; f2.type = 'lowpass'; f2.frequency.value = 4200;
    const m2 = c.createGain(); m2.gain.value = 0.35;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.035); g.gain.setValueAtTime(v * 0.92, t + Math.max(0.05, dur - 0.06)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.12);
    o.connect(f); o2.connect(m2); m2.connect(f); f.connect(f2); f2.connect(g); g.connect(this.musicBus);
    for (const os of [o, o2, vib]) { os.start(t); os.stop(t + dur + 0.2); }
  }
  brass(freqs, when, v) { for (const fr of freqs) { this.tone('sawtooth', fr * 0.98, fr, v * 0.09, 0.02, 0.28, when, this.musicBus); } this.burst('bandpass', 1200, 1, v * 0.08, 0.01, 0.2, this.musicBus, when); }

  score(now) {
    const mood = this.musicMood();
    const SC = { explore: { bpm: 112, scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 5, 3, 4], lead: 'reed' },     // major, I–vi–IV–V
      action: { bpm: 150, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 6, 0, 0, 5, 3, 4], lead: 'reed' },              // minor, i–VI–VII–i
      night: { bpm: 78, scale: [0, 2, 3, 7, 9], prog: [0, 3, 0, 4], lead: 'veena' },
      rain: { bpm: 96, scale: [0, 2, 3, 5, 7, 9, 10], prog: [0, 3, 6, 4], lead: 'reed' } }[mood];
    const q = this.sq || (this.sq = { t: now + 0.3, step: 0, bar: 0, mood: '', last: 0, ph: null, phI: 0 });
    if (q.mood !== mood) { q.mood = mood; q.t = Math.max(q.t, now + 0.05); q.step = 0; q.bar = 0; q.ph = null; if (mood === 'action') this.brass([this.tonic, this.tonic * 1.5, this.tonic * 2], 0.02, 1); }
    const s16 = 60 / SC.bpm / 4, T = this.tonic * (mood === 'night' ? 1 : 1);
    const deg = (d, oct = 0) => { const n = SC.scale.length, o = Math.floor(d / n), k = ((d % n) + n) % n; return T * Math.pow(2, (SC.scale[k] + 12 * (o + oct)) / 12); };
    while (q.t < now + 0.2) {
      const when = Math.max(0, q.t - now), st = q.step % 16, beat = st % 4 === 0;
      const root = SC.prog[q.bar % SC.prog.length];
      // ---- percussion
      if (mood === 'action') {
        const roll = [1, .5, .7, .5, 1, .5, .7, .6, 1, .5, .7, .5, 1, .6, .8, .9][st];
        this.chenda(when, 0.5 * roll, st % 8 === 0); if (st % 2 === 1 && Math.random() < 0.4) this.chenda(when + s16 * 0.5, 0.25, false);
        if (st === 0 || st === 6 || st === 8 || st === 11) this.veekku(when, 0.55);
        if (st % 4 === 2) this.ilathalam(when, 0.6);
      } else if (mood === 'explore' || mood === 'rain') {
        if (st === 0 || st === 7 || st === 10) this.maddalam(when, mood === 'rain' ? 0.35 : 0.5, false);
        if (st === 4 || st === 12) this.tabla(when, 0.45, true);
        if (st % 2 === 0 && st !== 0) this.tabla(when, 0.16, st % 4 === 2);
        if (st === 8 && q.bar % 2 === 1) this.chenda(when, 0.3, true);
        if (st % 4 === 2 && mood === 'explore') this.ilathalam(when, 0.3);
      } else if (mood === 'night') {
        if (st === 0) this.maddalam(when, 0.22, false); if (st === 8) this.tabla(when, 0.12, true);
      }
      // ---- bass and chords
      if (mood !== 'night') {
        if (st === 0 || st === 6 || st === 10 || (mood === 'action' && st % 4 === 0)) this.bass(deg(root, -2), when, s16 * (st === 0 ? 4 : 2.5), mood === 'action' ? 0.2 : 0.16);
        if (st === 14 && mood === 'explore') this.bass(deg(root + 1, -2), when, s16 * 2, 0.12);
      } else if (st === 0) this.bass(deg(root, -2), when, s16 * 14, 0.08);
      if (st === 0) this.harmonium([deg(root, -1), deg(root + 2, -1), deg(root + 4, -1)], when, s16 * 16 * 0.98, mood === 'action' ? 0.045 : 0.06);
      if (mood === 'action' && (st === 0 || st === 10) && q.bar % 4 === 3) this.brass([deg(root), deg(root + 2), deg(root + 4)], when, 0.9);
      // ---- the lead: a phrase every other bar, chord tones on the beat, slides between notes
      if (st === 0 && q.bar % 2 === 0) {
        const len = mood === 'action' ? 8 : mood === 'night' ? 3 : 5, ph = [];
        let d = root + [0, 2, 4][Math.floor(Math.random() * 3)];
        for (let i = 0; i < len; i++) { ph.push(d); d += [-2, -1, -1, 1, 1, 2, 0, 3][Math.floor(Math.random() * 8)]; d = Math.max(root - 2, Math.min(root + 9, d)); }
        q.ph = ph; q.phI = 0;
      }
      const rhythm = mood === 'action' ? [0, 2, 4, 6, 8, 10, 12, 14] : mood === 'night' ? [0, 6, 12] : [0, 3, 6, 8, 12];
      if (q.ph && q.bar % 2 === 0 && rhythm.includes(st) && q.phI < q.ph.length) {
        const nx = rhythm[rhythm.indexOf(st) + 1] ?? 16, dur = (nx - st) * s16, f = deg(q.ph[q.phI++], mood === 'night' ? 0 : 1);
        if (SC.lead === 'veena') this.pluck(f, 0.16, when, q.last || null);
        else this.reed(f, when, dur * (mood === 'action' ? 0.85 : 0.95), mood === 'action' ? 0.07 : 0.06, q.last && Math.random() < 0.6 ? q.last : null);
        q.last = f;
      }
      if (q.bar % 2 === 1 && st === 0) q.last = 0;
      q.t += s16; q.step++;
      if (q.step % 16 === 0) q.bar++;
    }
  }
}
