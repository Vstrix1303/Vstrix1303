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
    sm(this.droneG.gain, musicOn ? 1 : 0, 1.5);
    sm(this.musicBus.gain, this.musicVol * (s.paused ? 0.4 : 1), 0.5);
    // ambient creatures
    this.nextBird -= dt;
    if (this.nextBird <= 0) {
      this.nextBird = 2 + Math.random() * 7;
      if (s.night > 0.6) { if (s.rain > 0.3 || s.nearWater > 0.5) this.sfx('frog', 1); }
      else if (s.rain < 0.6) { const r = Math.random(); this.sfx(r < 0.3 ? 'koel' : r < 0.5 ? 'crow' : 'chirp', 0.6 + Math.random() * 0.5); }
    }
    // ---- the score
    if (!musicOn) return;
    const song = SONGS[this.mood] || SONGS.calm, scale = RAGAS[this.mood] || RAGAS.calm;
    const beat = 60 / song.bpm, q = this.seq;
    if (q.mood !== this.mood) { q.mood = this.mood; q.pi = 0; q.ni = 0; q.t = now + 0.6; q.last = 0; this.beatT = now + 0.6; this.beatI = 0; }
    // tanpura: Pa, Sa, Sa, low Sa — one string every 1.3 s
    if (now >= this.tanT) {
      const str = [0.75, 1, 1, 0.5][this.tanI++ % 4];
      this.tanpura(this.tonic * str, 0.02);
      this.tanT = Math.max(now, this.tanT) + (this.mood === 'chase' ? 0.87 : 1.3);
    }
    if (song.drums) {
      while (this.beatT < now + 0.15) {
        const pat = [1, 0, 0.5, 0.5, 1, 0, 0.5, 0, 1, 0.5, 0, 0.5, 1, 0.5, 0.5, 0.5][this.beatI++ % 16];
        if (pat > 0) this.drum(Math.max(0, this.beatT - now), pat === 1);
        this.beatT += beat / 2;
      }
    }
    // melody: schedule a little ahead, phrase by phrase
    while (q.t < now + 0.25) {
      const ph = PHRASES[song.form[q.pi % song.form.length]];
      const [deg, beats] = ph[q.ni];
      const dur = beats * beat, when = Math.max(0, q.t - now);
      if (deg != null) {
        const f = this.tonic * 2 * Math.pow(2, (scale[deg % 5] + 12 * Math.floor(deg / 5)) / 12);
        if (song.voice === 'flute') this.flute(f, 0.085, when, dur * 0.96, q.last && q.ni > 0 ? q.last : null);
        else this.pluck(f, this.mood === 'chase' ? 0.15 : 0.2, when, q.last && q.ni > 0 && this.mood !== 'chase' ? q.last : null);
        q.last = f;
      }
      q.t += dur;
      if (++q.ni >= ph.length) { q.ni = 0; q.pi++; q.t += song.gap * beat; q.last = 0; }
    }
  }
}
