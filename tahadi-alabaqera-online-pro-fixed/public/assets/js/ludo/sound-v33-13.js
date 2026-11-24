/* لعبة العباقرة 33.13.0 — the sounds of «لودو», made on the device (no recordings to load).
   A step that climbs a little with every hop, a capture that pops and whooshes back home, a
   chime for a stone in the middle, a bright ding for a six, a soft call when it is your turn,
   and a fanfare for the winner. The volume and the mute of the site's settings apply. The
   dice keep their own recorded sounds (each die skin has its own). */
let audio = null, noise = null;
const settings = () => globalThis.BS_AUDIO?.getSettings?.() || { volume: 0.72, muted: false };
function ctx() {
  const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext; if (!Ctx) throw new Error('no audio');
  audio ??= new Ctx();
  if (audio.state === 'suspended') audio.resume?.();
  return audio;
}
function tone(freq, ms, { type = 'sine', gain = 0.06, when = 0, to = null } = {}) {
  const s = settings(); if (s.muted || s.effects === false) return;
  try {
    const a = ctx(), t = a.currentTime + when, o = a.createOscillator(), g = a.createGain(), v = gain * Math.max(0, Math.min(1, s.volume ?? 0.72)) * 1.3;
    o.type = type; o.frequency.setValueAtTime(freq, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + ms / 1000);
    g.gain.setValueAtTime(Math.max(0.0001, v), t); g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + ms / 1000 + 0.02);
  } catch { /* no sound on this device */ }
}
function whoosh(ms, { gain = 0.07, when = 0, from = 2400, to = 300 } = {}) {
  const s = settings(); if (s.muted || s.effects === false) return;
  try {
    const a = ctx();
    if (!noise) { noise = a.createBuffer(1, a.sampleRate, a.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(), t = a.currentTime + when;
    src.buffer = noise; f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + ms / 1000);
    g.gain.setValueAtTime(gain * (s.volume ?? 0.72), t); g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    src.connect(f).connect(g).connect(a.destination); src.start(t); src.stop(t + ms / 1000 + 0.02);
  } catch { /* no sound */ }
}
export const ludoSound = Object.freeze({
  /** one hop; `n` is the hop number, so a long walk climbs */
  step(n = 1) { const f = 520 * Math.pow(1.045, Math.min(14, n)); tone(f, 70, { type: 'triangle', gain: 0.05 }); tone(f / 2, 60, { type: 'sine', gain: 0.03 }); },
  land() { tone(220, 120, { type: 'sine', gain: 0.07, to: 150 }); },
  out() { [523, 784].forEach((f, i) => tone(f, 140, { type: 'triangle', gain: 0.05, when: i * 0.07 })); },
  capture() { tone(880, 90, { type: 'square', gain: 0.04 }); tone(180, 260, { type: 'sawtooth', gain: 0.05, when: 0.04, to: 70 }); whoosh(420, { when: 0.08 }); },
  home() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 260, { type: 'triangle', gain: 0.05, when: i * 0.08 })); },
  six() { tone(1319, 160, { type: 'triangle', gain: 0.05 }); tone(1760, 220, { gain: 0.035, when: 0.06 }); },
  turn() { tone(660, 110, { type: 'sine', gain: 0.045 }); tone(990, 160, { type: 'sine', gain: 0.04, when: 0.1 }); },
  win() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 230, { type: 'triangle', gain: 0.06, when: i * 0.12 })); },
  lose() { [440, 392, 330, 262].forEach((f, i) => tone(f, 260, { type: 'sine', gain: 0.05, when: i * 0.15 })); },
});
