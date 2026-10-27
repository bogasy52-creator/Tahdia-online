/* Saudi Arabic neural speech: generated phrases, normalized volume, and whole-word boundaries. No borrowed commercial game recordings. */
import { BALOOT_PHRASES } from './engines/baloot-talk.js?v=33.0.0';

const KEY = 'bs_baloot_voice';
const SPRITE = '/assets/audio/baloot-voice-v33.mp3?r=saudi1';
// [start, length] in seconds inside the sound file
const LINES = Object.freeze({"pass":[0.25,1.872],"sun":[2.372,1.872],"ashkal":[4.494,1.872],"hokom_S":[6.616,2.16],"hokom_H":[9.026,1.944],"hokom_D":[11.22,2.112],"hokom_C":[13.582,2.136],"thani_S":[15.968,2.232],"thani_H":[18.45,2.208],"thani_D":[20.908,2.256],"thani_C":[23.414,2.136],"double":[25.8,1.872],"double_locked":[27.922,2.352],"triple":[30.524,1.872],"four":[32.646,1.872],"four_locked":[34.768,2.304],"gahwa":[37.322,1.872],"sira":[39.444,1.872],"fifty":[41.566,1.992],"hundred":[43.808,1.872],"fourHundred":[45.93,1.944],"and":[48.124,1.872],"baloot":[50.246,1.872],"claim":[52.368,1.896],"caught":[54.514,2.352],"wrong":[57.116,1.872],"kaboot":[59.238,1.872],"p1":[61.36,2.208],"p2":[63.818,2.064],"p3":[66.132,2.472],"p4":[68.854,2.16],"p5":[71.264,2.448],"p6":[73.962,2.16],"p7":[76.372,2.16],"p8":[78.782,2.4],"p9":[81.432,1.872],"p10":[83.554,2.328],"p11":[86.132,1.872],"p12":[88.254,2.4],"p13":[90.904,2.136],"p14":[93.29,2.616],"p15":[96.156,2.28],"p16":[98.686,3.168]});
// relative to you: you, the player on your right, your partner, the player on your left
const RATE = [1, 1, 1, 1];
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
  gain.gain.value = Math.max(0, Math.min(1, Number(opts.volume ?? 0.85)));
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
