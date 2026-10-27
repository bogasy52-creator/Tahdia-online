/* Tahdia 33.0.0 — the Baloot table speaks with recorded voices.
   Every call (بس، صن، أشكل، حكم سبيت، دبل، ثري، فور، قهوة…), project (سرا،
   خمسين، مية، أربعمية، بلوت), claim and table phrase is a short recording in
   one sound file, spoken with full vowels the way the table says it. The
   device's own speech voice is no longer used: it read the words wrongly and
   sounded robotic. Each seat speaks a little higher or lower so you can tell
   who called. Silent when the sound is muted, when the player turns the
   voices off, or before the file arrives (the bubbles still show). */
import { BALOOT_PHRASES } from './engines/baloot-talk.js?v=33.0.0';

const KEY = 'bs_baloot_voice';
const SPRITE = '/assets/audio/baloot-voice-v33.mp3';
// [start, length] in seconds inside the sound file
const LINES = Object.freeze({"pass":[0.3,0.342],"sun":[0.942,0.388],"ashkal":[1.63,0.469],"hokom_S":[2.399,0.741],"hokom_H":[3.44,1.034],"hokom_D":[4.774,1.003],"hokom_C":[6.077,1.206],"thani_S":[7.583,0.857],"thani_H":[8.74,0.951],"thani_D":[9.991,1.113],"thani_C":[11.404,1.151],"double":[12.855,0.473],"double_locked":[13.628,1.11],"triple":[15.038,0.406],"four":[15.744,0.32],"four_locked":[16.364,0.705],"gahwa":[17.37,0.319],"sira":[17.988,0.304],"fifty":[18.593,0.654],"hundred":[19.547,0.542],"fourHundred":[20.389,0.736],"and":[21.425,0.186],"baloot":[21.911,0.425],"claim":[22.636,0.314],"caught":[23.25,0.826],"wrong":[24.376,0.488],"kaboot":[25.164,0.645],"p1":[26.11,0.837],"p2":[27.246,0.493],"p3":[28.039,1.164],"p4":[29.504,0.96],"p5":[30.763,1.149],"p6":[32.212,0.764],"p7":[33.277,0.946],"p8":[34.523,1.282],"p9":[36.105,0.352],"p10":[36.756,1.278],"p11":[38.334,0.486],"p12":[39.12,1.097],"p13":[40.517,0.87],"p14":[41.687,1.422],"p15":[43.409,1.169],"p16":[44.878,2.023]});
// relative to you: you, the player on your right, your partner, the player on your left
const RATE = [1, 0.93, 1.06, 0.97];
const SUITS = { 'سبيت': 'S', 'هاص': 'H', 'ديمن': 'D', 'شريا': 'C' };
const WORDS = {
  'بس': 'pass', 'صن': 'sun', 'أشكل': 'ashkal', 'اشكل': 'ashkal',
  'دبل': 'double', 'دبل مقفول': 'double_locked', 'ثري': 'triple', 'فور': 'four', 'فور مقفول': 'four_locked', 'قهوة': 'gahwa',
  'سرا': 'sira', 'خمسين': 'fifty', 'مية': 'hundred', 'أربعمية': 'fourHundred', 'اربعمية': 'fourHundred',
  'بلوت': 'baloot', 'سجل': 'claim', 'صح قطع': 'caught', 'غلط': 'wrong', 'كبوت': 'kaboot',
};
// spoken text as the table writes it: no vowel marks, no punctuation or emoji
const plain = (text) => String(text || '').replace(/[ً-ْٰ]/g, '').replace(/[\u{1F000}-\u{1FAFF}☀-➿️]/gu, '').replace(/[،,؟?!.…]/g, ' ').replace(/\s+/g, ' ').trim();
// a table phrase is said by its id (p1…p16) or its words (a call keeps «قهوة»)
for (const p of BALOOT_PHRASES) if (LINES[p.id] && !WORDS[plain(p.say)]) WORDS[plain(p.say)] = p.id;

/** The recordings for a line the table wants said, in order (none when unknown). */
export function voiceLines(text) {
  if (LINES[text]) return [text];
  const words = plain(text);
  if (!words) return [];
  if (WORDS[words]) return [WORDS[words]];
  const call = words.match(/^(حكم|ثاني) (سبيت|هاص|ديمن|شريا)$/);
  if (call) return [(call[1] === 'حكم' ? 'hokom_' : 'thani_') + SUITS[call[2]]];
  // projects come joined: «سرا و خمسين»
  const parts = words.split(/ و /).map((part) => WORDS[part.trim()]);
  if (parts.length > 1 && parts.every(Boolean)) return parts.flatMap((id, i) => (i ? ['and', id] : [id]));
  return [];
}

function settings() { try { return window.BS_AUDIO?.getSettings?.() || {}; } catch { return {}; } }
function readEnabled() { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } }
let enabled = readEnabled();
let ctx = null, buffer = null, loading = null, failed = false, current = null, playing = [], waiting = [];

function context() {
  if (ctx) return ctx;
  try { const AC = window.AudioContext || window.webkitAudioContext; ctx = AC ? new AC() : null; } catch { ctx = null; }
  return ctx;
}
function load() {
  if (buffer || failed) return Promise.resolve(buffer);
  if (loading) return loading;
  const ac = context();
  if (!ac) { failed = true; return Promise.resolve(null); }
  loading = fetch(SPRITE, { cache: 'force-cache' })
    .then((res) => { if (!res.ok) throw new Error('voice_missing'); return res.arrayBuffer(); })
    .then((data) => new Promise((resolve, reject) => { const done = ac.decodeAudioData(data, resolve, reject); if (done?.then) done.then(resolve, reject); }))
    .then((decoded) => { buffer = decoded; return buffer; })
    .catch(() => { failed = true; return null; })
    .finally(() => { loading = null; });
  return loading;
}
function stopCurrent() { for (const src of playing) { try { src.onended = null; src.stop(); } catch {} } playing = []; current = null; waiting = []; }
function playIds(ids, position) {
  const ac = context();
  if (!ac || !buffer || !ids.length) return false;
  const opts = settings();
  const gain = ac.createGain();
  gain.gain.value = Math.max(0.25, Math.min(1, Number(opts.volume ?? 0.85) || 0.85));
  gain.connect(ac.destination);
  const rate = RATE[((position % 4) + 4) % 4];
  let at = ac.currentTime + 0.02, last = null;
  const sources = [];
  for (const id of ids) {
    const [start, length] = LINES[id] || [];
    if (start === undefined) continue;
    const src = ac.createBufferSource();
    src.buffer = buffer; src.playbackRate.value = rate; src.connect(gain);
    src.start(at, start, length);
    at += length / rate + 0.04;
    sources.push(src); last = src;
  }
  if (!last) return false;
  current = last; playing = sources;
  last.onended = () => { if (current === last) { current = null; playing = []; const next = waiting.shift(); if (next) playIds(next.ids, next.position); } };
  return true;
}

export const BalootVoice = {
  supported() { return Boolean(window.AudioContext || window.webkitAudioContext); },
  /** Kept for the table: true while the recordings can play (or are on their way). */
  hasArabic() { return !failed && this.supported(); },
  get enabled() { return enabled; },
  setEnabled(on) { enabled = Boolean(on); try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch {} if (!enabled) stopCurrent(); else load(); },
  // phones play sound only after a tap: resume inside one and fetch the voices
  unlock() {
    const ac = context();
    try { if (ac?.state === 'suspended') ac.resume(); } catch {}
    if (enabled) load();
  },
  /** Say a line for a seat position (0 you, 1 right, 2 partner, 3 left). */
  say(text, position = 0, { urgent = false } = {}) {
    if (!enabled || !text) return false;
    const opts = settings();
    if (opts.muted === true || opts.effects === false) return false;
    const ids = voiceLines(text);
    if (!ids.length) return false;
    if (!buffer) { load(); return false; }
    const ac = context();
    try { if (ac?.state === 'suspended') ac.resume(); } catch {}
    if (urgent) { stopCurrent(); return playIds(ids, position); }
    // never let the voices fall behind the table: one line may wait, older ones drop
    if (current) { waiting = [{ ids, position }]; return true; }
    return playIds(ids, position);
  },
  stop() { stopCurrent(); },
};
// the first tap anywhere wakes the sound and fetches the voices
try { addEventListener('pointerdown', () => BalootVoice.unlock(), { once: true, passive: true }); } catch {}
