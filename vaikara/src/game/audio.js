// Ambient sound, generated with WebAudio (no files): rain hiss, wind, surf
// near the coast, and thunder. Starts on the first click or key press.
export class Audio {
  constructor() {
    this.ctx = null;
    const start = () => { this.init(); removeEventListener('pointerdown', start); removeEventListener('keydown', start); };
    addEventListener('pointerdown', start); addEventListener('keydown', start);
  }

  noiseBuffer(sec = 2, brown = false) {
    const ctx = this.ctx, b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return b;
  }

  loop(buffer, filterType, freq, q = 0.7) {
    const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = buffer; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f).connect(g).connect(this.master); src.start();
    return { g, f };
  }

  init() {
    if (this.ctx) return;
    try { this.ctx = new AudioContext(); } catch { return; }
    this.master = this.ctx.createGain(); this.master.gain.value = 0.6; this.master.connect(this.ctx.destination);
    const white = this.noiseBuffer(2), brown = this.noiseBuffer(4, true);
    this.rain = this.loop(white, 'bandpass', 2600, 0.5);
    this.drops = this.loop(white, 'highpass', 6000);
    this.wind = this.loop(brown, 'lowpass', 500);
    this.surf = this.loop(brown, 'lowpass', 320);
    this.brown = brown;
  }

  setWeather(w, coastDist = 1e4) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, set = (n, v) => n.g.gain.setTargetAtTime(v, t, 0.5);
    set(this.rain, w.rain * 0.35); set(this.drops, w.rain * 0.06);
    set(this.wind, 0.05 + w.storm * 0.4 + w.cloud * 0.06);
    set(this.surf, Math.max(0, 1 - coastDist / 400) * (0.25 + w.storm * 0.35));
    this.wind.f.frequency.setTargetAtTime(400 + w.storm * 500 + Math.sin(t * 0.3) * 120, t, 1);
  }

  thunder(delay, dist) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const src = ctx.createBufferSource(); src.buffer = this.brown;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(90, t + 3.5);
    const g = ctx.createGain(); const peak = Math.min(1.2, 2400 / dist);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + 0.08); g.gain.exponentialRampToValueAtTime(0.001, t + 4.5);
    src.connect(f).connect(g).connect(this.master); src.start(t, Math.random() * 2); src.stop(t + 5);
  }
}
