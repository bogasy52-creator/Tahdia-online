/* Tahdia 32.1.0 — the Baloot table speaks Arabic.
   Calls (حكم، صن، بس، دبل…), projects, claims and table phrases are read with
   the device's own Arabic voice; each seat gets its own pitch so you can tell
   who is talking. Silent when the sound is muted, when the player turns the
   voices off, or when the device has no Arabic voice (the bubbles still show). */
const KEY = 'bs_baloot_voice';
// relative to you: you, the player on your right, your partner, the player on your left
const TONE = [{ pitch: 1, rate: 1.02 }, { pitch: 0.78, rate: 0.96 }, { pitch: 1.18, rate: 1.05 }, { pitch: 0.9, rate: 0.99 }];
let voice = null, scanned = false, unlocked = false;

const synth = () => { try { return 'speechSynthesis' in window ? window.speechSynthesis : null; } catch { return null; } };
function settings() { try { return window.BS_AUDIO?.getSettings?.() || {}; } catch { return {}; } }
function readEnabled() { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } }
let enabled = readEnabled();

function scan() {
  const s = synth(); if (!s) return null;
  const list = s.getVoices?.() || [];
  if (!list.length) return null;
  scanned = true;
  const arabic = list.filter((v) => /^ar([-_]|$)/i.test(v.lang || ''));
  voice = arabic.find((v) => /SA/i.test(v.lang) && v.localService) || arabic.find((v) => /SA/i.test(v.lang)) || arabic.find((v) => v.localService) || arabic[0] || null;
  return voice;
}
try { const s = synth(); if (s) { scan(); s.addEventListener?.('voiceschanged', scan); } } catch {}

export const BalootVoice = {
  supported() { return Boolean(synth()); },
  hasArabic() { return Boolean(voice || scan()); },
  get enabled() { return enabled; },
  setEnabled(on) { enabled = Boolean(on); try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch {} if (!enabled) synth()?.cancel?.(); },
  // iOS speaks only after a first utterance made inside a tap
  unlock() {
    const s = synth(); if (!s || unlocked) return; unlocked = true;
    try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; if (voice || scan()) u.voice = voice; s.speak(u); } catch {}
  },
  /** Say a short line for a seat position (0 you, 1 right, 2 partner, 3 left). */
  say(text, position = 0, { urgent = false } = {}) {
    const s = synth(); if (!s || !enabled || !text) return false;
    const opts = settings();
    if (opts.muted === true || opts.effects === false) return false;
    if (!voice && !scanned) scan();
    if (!voice) return false;
    try {
      if (urgent) s.cancel();
      else if (s.pending) return false; // never let the voice fall behind the table
      const u = new SpeechSynthesisUtterance(String(text).replace(/[\u{1F000}-\u{1FAFF}☀-➿️]/gu, '').trim());
      const tone = TONE[((position % 4) + 4) % 4];
      u.voice = voice; u.lang = voice.lang; u.pitch = tone.pitch; u.rate = tone.rate;
      u.volume = Math.max(0.2, Math.min(1, Number(opts.volume ?? 0.8) || 0.8));
      s.speak(u);
      return true;
    } catch { return false; }
  },
  stop() { try { synth()?.cancel?.(); } catch {} },
};
