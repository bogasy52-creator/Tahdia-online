/* لعبة العباقرة 33.19.0 — «برج التحديات»: music and sound.
   No sound files: everything is played live by the browser. Every world has its own scale, tempo and
   instruments (the desert plucks an oud-like string on maqam Hijaz), the boss of a summit doubles the
   drums, and the effects are layered (a whoosh and a blip for a jump, a bell for a gem). */
import { rng } from './course.js?v=33.21.3';

const STYLE = Object.freeze({
  forest: { bpm: 112, root: 62, scale: [0, 2, 4, 7, 9], lead: 'pluck', bass: 'triangle', drums: 'light', pad: false },
  ice: { bpm: 92, root: 64, scale: [0, 2, 4, 6, 7, 9, 11], lead: 'bell', bass: 'sine', drums: 'soft', pad: true },
  candy: { bpm: 128, root: 65, scale: [0, 2, 4, 5, 7, 9, 11], lead: 'square', bass: 'square', drums: 'clap', pad: false },
  desert: { bpm: 100, root: 62, scale: [0, 1, 4, 5, 7, 8, 10], lead: 'oud', bass: 'triangle', drums: 'darbuka', pad: false },
  space: { bpm: 84, root: 57, scale: [0, 3, 5, 7, 10], lead: 'bell', bass: 'sine', drums: 'none', pad: true },
  lava: { bpm: 118, root: 52, scale: [0, 1, 4, 5, 7, 8, 10], lead: 'saw', bass: 'saw', drums: 'heavy', pad: false },
});
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

export class TowerAudio {
  constructor() { this.ctx = null; this.music = true; this.sfx = true; this.world = null; this.timer = null; this.step = 0; this.next = 0; this.boss = 0; }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return this.ctx; }
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext; if (!AC) return null;
    const c = this.ctx = new AC();
    this.out = c.createDynamicsCompressor(); this.out.threshold.value = -14; this.out.ratio.value = 3; this.out.connect(c.destination);
    this.mbus = c.createGain(); this.mbus.gain.value = 0.3; this.mbus.connect(this.out);
    this.sbus = c.createGain(); this.sbus.gain.value = 0.75; this.sbus.connect(this.out);
    // a small room for everything to ring in
    const len = c.sampleRate * 1.6, ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    this.verb = c.createConvolver(); this.verb.buffer = ir; const vg = c.createGain(); vg.gain.value = 0.28; this.verb.connect(vg).connect(this.out);
    this.noise = c.createBuffer(1, c.sampleRate, c.sampleRate); const nd = this.noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    return c;
  }
  /* ---------------------------------------------------------------- building blocks */
  env(g, t, a, peak, dec, end = 0.0001) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(end, t + a + dec); }
  osc(type, f, t, dur, peak, bus, { slide = 0, a = 0.005, verb = 0, detune = 0, filter = 0, q = 1 } = {}) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (detune) o.detune.value = detune;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + dur);
    let head = o; if (filter) { const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(filter, t); lp.Q.value = q; o.connect(lp); head = lp; }
    head.connect(g); g.connect(bus); if (verb) { const s = c.createGain(); s.gain.value = verb; g.connect(s).connect(this.verb); }
    this.env(g, t, a, peak, dur); o.start(t); o.stop(t + a + dur + 0.05);
  }
  hiss(t, dur, peak, bus, { type = 'bandpass', f = 1200, f2 = 0, q = 1, verb = 0 } = {}) {
    const c = this.ctx, n = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain(); n.buffer = this.noise;
    bp.type = type; bp.frequency.setValueAtTime(f, t); if (f2) bp.frequency.exponentialRampToValueAtTime(f2, t + dur); bp.Q.value = q;
    n.connect(bp).connect(g).connect(bus); if (verb) { const s = c.createGain(); s.gain.value = verb; g.connect(s).connect(this.verb); }
    this.env(g, t, 0.004, peak, dur); n.start(t, Math.random() * 0.5); n.stop(t + dur + 0.05);
  }
  /* ---------------------------------------------------------------- music */
  play(world) {
    if (!this.music) { this.stop(); return; }
    if (!this.ensure()) return;
    if (this.world === world && this.timer) return;
    this.stop(); this.world = world; this.style = STYLE[world] || STYLE.forest; this.step = 0; this.next = this.ctx.currentTime + 0.1;
    const r = rng(world.length * 977 + 13), sc = this.style.scale;
    // a four-bar tune, its bass and chords, from the world's own scale
    this.tune = Array.from({ length: 64 }, (_, i) => (i % 2 === 0 && r() < 0.62) || i % 8 === 0 ? sc[r.int(0, sc.length - 1)] + 12 * (r() < 0.25 ? 1 : 0) : null);
    this.chords = [0, sc[Math.min(3, sc.length - 1)], sc[Math.min(4, sc.length - 1)], sc[Math.min(2, sc.length - 1)]];
    this.mbus.gain.setTargetAtTime(0.3, this.ctx.currentTime, 0.3);
    this.timer = setInterval(() => this.schedule(), 25);
  }
  stop() { clearInterval(this.timer); this.timer = null; this.world = null; if (this.ctx) this.mbus.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.15); }
  intensity(boss) { this.boss = boss ? 1 : 0; }
  schedule() {
    const c = this.ctx; if (!c) return;
    const S = this.style, sixteenth = 60 / (S.bpm * (this.boss ? 1.12 : 1)) / 4;
    while (this.next < c.currentTime + 0.12) { this.note(this.step, this.next, sixteenth); this.next += sixteenth; this.step = (this.step + 1) % 64; }
  }
  note(i, t, s) {
    const S = this.style, root = S.root, bar = Math.floor(i / 16), chord = this.chords[bar], m = this.mbus, beat = i % 16;
    // drums
    const kick = () => { this.osc('sine', 150, t, 0.22, 0.9, m, { slide: 0.33 }); };
    const snare = (p = 0.35) => this.hiss(t, 0.12, p, m, { f: 1800, q: 0.7, verb: 0.2 });
    const hat = (p = 0.12) => this.hiss(t, 0.035, p, m, { type: 'highpass', f: 7000 });
    if (S.drums === 'light') { if (beat % 8 === 0) kick(); if (beat % 8 === 4) snare(0.22); if (beat % 2 === 0) hat(0.07); }
    if (S.drums === 'soft') { if (beat === 0) kick(); if (beat % 4 === 2) hat(0.05); }
    if (S.drums === 'clap') { if (beat % 4 === 0) kick(); if (beat % 8 === 4) this.hiss(t, 0.09, 0.4, m, { f: 1400, q: 1.4, verb: 0.3 }); if (beat % 2 === 1) hat(0.08); }
    if (S.drums === 'darbuka') { // doum … tak-tak, the Gulf beat a darbuka would play
      if ([0, 6, 10].includes(beat)) this.osc('sine', 110, t, 0.2, 0.8, m, { slide: 0.6 });
      if ([3, 4, 8, 12, 14].includes(beat)) this.hiss(t, 0.05, 0.3, m, { f: 3200, q: 2 });
      if (beat % 2 === 1) hat(0.04);
    }
    if (S.drums === 'heavy') { if (beat % 4 === 0 || beat === 10) kick(); if (beat % 8 === 4) snare(0.4); if (beat % 2 === 0) hat(0.06); if (beat === 14) this.osc('sine', 90, t, 0.25, 0.6, m, { slide: 0.5 }); }
    if (this.boss && beat % 4 === 2) this.osc('sine', 120, t, 0.15, 0.5, m, { slide: 0.4 });
    // bass on the beat, from the bar's chord
    if (beat % 4 === 0 || (S.drums === 'heavy' && beat % 2 === 0)) this.osc(S.bass, hz(root - 12 + chord), t, s * 3, S.bass === 'sine' ? 0.35 : 0.18, m, { filter: 600, q: 2 });
    // pads hold the chord for the bar
    if (S.pad && beat === 0) for (const k of [0, 4, 7]) this.osc('sawtooth', hz(root + chord + k), t, s * 15, 0.04, m, { a: 0.6, filter: 1200, detune: (k - 3) * 4, verb: 0.6 });
    // the tune
    const n = this.tune[i]; if (n == null) return;
    const f = hz(root + 12 + n);
    if (S.lead === 'pluck') this.osc('triangle', f, t, s * 2.2, 0.16, m, { verb: 0.3 });
    if (S.lead === 'bell') { this.osc('sine', f, t, s * 6, 0.12, m, { verb: 0.6 }); this.osc('sine', f * 2.76, t, s * 2, 0.03, m, { verb: 0.6 }); }
    if (S.lead === 'square') this.osc('square', f, t, s * 1.4, 0.07, m, { filter: 2600, verb: 0.2 });
    if (S.lead === 'oud') { this.osc('triangle', f, t, s * 2.6, 0.2, m, { verb: 0.35, filter: 2400 }); this.osc('sawtooth', f, t, s * 1.2, 0.05, m, { detune: 7, filter: 1800 }); }
    if (S.lead === 'saw') this.osc('sawtooth', f, t, s * 1.8, 0.07, m, { filter: 1500, q: 3, verb: 0.2 });
  }
  /* ---------------------------------------------------------------- effects */
  fx(name) {
    if (!this.sfx || !this.ensure()) return;
    const t = this.ctx.currentTime + 0.005, b = this.sbus;
    switch (name) {
      case 'jump': this.hiss(t, 0.18, 0.25, b, { f: 600, f2: 2400, q: 1.2 }); this.osc('triangle', 520, t, 0.12, 0.12, b, { slide: 1.6 }); break;
      case 'land': this.osc('sine', 95, t, 0.12, 0.35, b, { slide: 0.55 }); this.hiss(t, 0.08, 0.12, b, { type: 'lowpass', f: 700 }); break;
      case 'pad': this.osc('sine', 220, t, 0.45, 0.25, b, { slide: 3.6, verb: 0.3 }); this.hiss(t, 0.35, 0.18, b, { f: 500, f2: 3000 }); break;
      case 'bounce': this.osc('sine', 260, t, 0.25, 0.22, b, { slide: 2.2 }); break;
      case 'gem': [0, 0.07].forEach((d, k) => { this.osc('sine', [1318, 1975][k], t + d, 0.5, 0.16, b, { verb: 0.5 }); this.osc('sine', [1318, 1975][k] * 3.01, t + d, 0.15, 0.04, b); }); break;
      case 'hit': this.osc('sine', 120, t, 0.2, 0.45, b, { slide: 0.5 }); this.hiss(t, 0.12, 0.3, b, { f: 2500, q: 0.8 }); break;
      case 'fall': this.osc('sine', 900, t, 0.8, 0.16, b, { slide: 0.22, verb: 0.3 }); break;
      case 'cp': [0, 0.08, 0.16].forEach((d, k) => this.osc('sine', [784, 988, 1318][k], t + d, 0.4, 0.13, b, { verb: 0.5 })); break;
      case 'dash': this.hiss(t, 0.2, 0.3, b, { f: 1800, f2: 500, q: 1.5 }); break;
      case 'bump': this.osc('sine', 200, t, 0.1, 0.3, b, { slide: 0.6 }); break;
      case 'shoved': this.osc('square', 180, t, 0.18, 0.12, b, { slide: 0.5, filter: 1200 }); this.hiss(t, 0.15, 0.2, b, { f: 900 }); break;
      case 'crack': this.hiss(t, 0.08, 0.25, b, { f: 3500, q: 3 }); break;
      case 'door': this.osc('triangle', 330, t, 0.12, 0.1, b, { slide: 1.3 }); break;
      case 'tick': this.osc('sine', 880, t, 0.12, 0.18, b, { verb: 0.2 }); break;
      case 'go': [523, 659, 784].forEach((f) => this.osc('sawtooth', f, t, 0.45, 0.06, b, { filter: 2400, verb: 0.4 })); break;
      case 'win': [523, 659, 784, 1047].forEach((f, k) => { this.osc('sawtooth', f, t + k * 0.12, 0.35, 0.07, b, { filter: 2200, verb: 0.4 }); this.osc('triangle', f / 2, t + k * 0.12, 0.35, 0.08, b); }); this.hiss(t + 0.3, 1.4, 0.12, b, { f: 1200, q: 0.4, verb: 0.5 }); break;
      case 'wave': this.osc('triangle', 660, t, 0.1, 0.12, b); this.osc('triangle', 880, t + 0.1, 0.12, 0.12, b); break;
      case 'laugh': [0, 0.09, 0.18, 0.27].forEach((d, k) => this.osc('square', 700 - k * 60, t + d, 0.07, 0.06, b, { filter: 1800 })); break;
      case 'dance': [0, 0.12, 0.24, 0.36].forEach((d, k) => this.osc('triangle', k % 2 ? 784 : 523, t + d, 0.1, 0.1, b)); break;
      case 'boss': this.osc('sawtooth', 110, t, 1.1, 0.12, b, { filter: 600, verb: 0.6 }); this.osc('sine', 55, t, 1.2, 0.3, b); this.hiss(t, 1, 0.08, b, { f: 300, q: 0.5, verb: 0.5 }); break;
      default: break;
    }
  }
}
