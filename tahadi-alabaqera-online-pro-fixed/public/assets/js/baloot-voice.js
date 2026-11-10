import { BALOOT_PHRASES } from './engines/baloot-talk.js?v=33.9.3';
import { VOICE_LINES, VOICE_PACK, STUDIO_LINES } from './baloot-voice-pack.js?v=33.9.3-baloot2';
import { VOICE_RECORDINGS } from './baloot-voice-clips-v33.js?v=33.9.3';
import { createVoicePlayer } from './baloot-voice-player.js?v=33.9.3-audio1';

const KEY = 'bs_baloot_voice';
const plain = text => String(text || '').replace(/[ً-ْٰ]/g, '').replace(/[\u{1F000}-\u{1FAFF}☀-➿️]/gu, '').replace(/[،,؟?!.…]/g, ' ').replace(/\s+/g, ' ').trim();
const WORDS = { 'بس':'pass', 'صن':'sun', 'أشكل':'ashkal', 'اشكل':'ashkal', 'دبل':'double',
  'دبل مقفول':'double_locked', 'دبل مقفل':'double_locked', 'ثري':'triple', 'فور':'four',
  'فور مقفول':'four_locked', 'فور مقفل':'four_locked', 'قهوة':'gahwa', 'سرا':'sira',
  'خمسين':'fifty', 'مية':'hundred', 'أربعمية':'fourHundred', 'اربعمية':'fourHundred',
  'بلوت':'baloot', 'سجل':'claim', 'صح قطع':'caught', 'غلط':'wrong', 'كبوت':'kaboot', 'التسجيل صحيح':'claim_ok' };
for (const phrase of BALOOT_PHRASES) if (!WORDS[plain(phrase.say)]) WORDS[plain(phrase.say)] = phrase.id;
for (const [id, text] of Object.entries(VOICE_LINES)) if (!WORDS[plain(text)]) WORDS[plain(text)] = id;
const SUITS = { 'سبيت':'S', 'هاص':'H', 'ديمن':'D', 'شريا':'C' };
const PROJECTS = ['sira', 'fifty', 'hundred', 'fourHundred'];
export function voiceLines(text) {
  if (Object.hasOwn(VOICE_LINES, text)) return [text];
  const words = plain(text);
  if (Object.hasOwn(WORDS, words)) return [WORDS[words]];
  const call = words.match(/^(حكم|ثاني) (سبيت|هاص|ديمن|شريا)$/);
  if (call) return [(call[1] === 'حكم' ? 'hokom_' : 'thani_') + SUITS[call[2]]];
  const pair = words.split(/ و /).map(word => WORDS[word]);
  if (pair.length === 2 && pair.every(id => PROJECTS.includes(id))) {
    pair.sort((a, b) => PROJECTS.indexOf(a) - PROJECTS.indexOf(b));
    const id = 'projects_' + pair.join('_');
    return Object.hasOwn(VOICE_LINES, id) ? [id] : [];
  }
  return [];
}
function settings() { try { return window.BS_AUDIO?.getSettings?.() || {}; } catch { return {}; } }
function readEnabled() { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } }
export function humanPackReady(pack, lines = VOICE_LINES) {
  return pack?.kind === 'human' && pack.approved === true && typeof pack.voice === 'string' && Boolean(pack.voice.trim()) &&
    Object.keys(lines).every(id => {
      const clip = pack.recordings?.[id];
      return typeof clip?.src === 'string' && clip.src.startsWith('/assets/audio/baloot-human/') &&
        /^[a-f0-9]{64}$/.test(clip.sha256) && clip.text === lines[id] && clip.seconds > 0 && clip.seconds <= 12;
    });
}
const existingPack = {
  kind:'synthetic', voice:'ar-KW-FahedNeural', recordings:VOICE_RECORDINGS
};
// the archived calls cover every line but the newer studio-only ones
const existingReady = Object.keys(VOICE_LINES).filter(id => !STUDIO_LINES.includes(id)).every(id => {
  const clip = VOICE_RECORDINGS[id];
  return clip?.src === '/assets/audio/baloot-gulf-v33/' + id + '.mp3' && clip.seconds > 0 && clip.seconds <= 12;
});
const activePack = humanPackReady(VOICE_PACK) ? VOICE_PACK : existingReady ? existingPack : null;
const packReady = Boolean(activePack);
// 33.1.0: the calls the manager records in the admin voice studio (no key, nothing
// outside). Each one takes the place of its line; a line without one keeps the pack's.
const recordings = { ...activePack?.recordings };
let studio = 0;
const ready = () => packReady || studio > 0;
const synthetic = () => ready() ? activePack?.kind === 'synthetic' && studio < Object.keys(VOICE_LINES).length : null;
let enabled = readEnabled(), ctx = null, primed = false;
function supported() { return typeof window !== 'undefined' && Boolean(window.AudioContext || window.webkitAudioContext); }
function visible() { return typeof document === 'undefined' || !document.hidden; }
function allowed() { const s = settings(); return ready() && enabled && !s.muted && s.effects !== false; }
function context() {
  if (ctx?.state === 'closed') { ctx = null; primed = false; }
  if (ctx) return ctx;
  if (!supported() || !ready()) return null;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC({ latencyHint:'interactive' });
    ctx.addEventListener('statechange', () => { notify(); void player.drain(); });
    return ctx;
  } catch { return null; }
}
async function fetchClip(clip, signal) {
  const controller = new AbortController(), abort = () => controller.abort();
  if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once:true });
  const timeout = setTimeout(abort, 8000);
  try {
    const url = new URL(clip.src, window.location.origin);
    url.searchParams.set('v', clip.sha256 ? clip.sha256.slice(0, 16) : String(clip.rev || 0));
    const response = await fetch(url, { cache:'force-cache', signal:controller.signal });
    if (!response.ok) throw new Error('clip_unavailable');
    return await response.arrayBuffer();
  } finally { clearTimeout(timeout); signal.removeEventListener('abort', abort); }
}
const player = createVoicePlayer({ recordings, getContext:context,
  fetchClip, isAllowed:allowed, getVolume:() => settings().volume ?? .72, isVisible:visible, onChange:() => notify() });
function getStatus() {
  const detail = player.status(), s = settings();
  const state = !ready() ? 'awaiting-recordings' : !supported() ? 'unsupported' : !enabled ? 'disabled' :
    s.muted || s.effects === false || Number(s.volume ?? .72) <= 0 ? 'muted' :
    detail.state === 'error' ? 'error' : !ctx || ctx.state !== 'running' ? 'locked' : detail.state;
  return { ...detail, state, available:ready() && supported(), enabled, studio,
    lastText:recordings[detail.last]?.text ?? null, synthetic:synthetic() };
}
/** The studio's calls: which lines the manager recorded (one small request, cached a little). */
async function loadStudio({ fresh = false } = {}) {
  try {
    const response = await fetch('/api/baloot/voice/pack', { cache:fresh ? 'no-store' : 'default' });
    if (!response.ok) return studio;
    const pack = await response.json();
    let count = 0;
    for (const id of Object.keys(VOICE_LINES)) {
      const at = Number(pack?.lines?.[id]?.at) || 0;
      if (at) { recordings[id] = { src:'/api/baloot/voice/clip/' + id, rev:at, text:VOICE_LINES[id] }; count++; }
      else if (packReady) recordings[id] = activePack.recordings[id];
      else delete recordings[id];
    }
    if (count !== studio || fresh) player.forget();
    studio = count;
    notify();
  } catch { /* the calls stay written */ }
  return studio;
}
function notify() {
  try { window.dispatchEvent(new CustomEvent('bs-baloot-voice-change', { detail:getStatus() })); } catch {}
}
export const BalootVoice = {
  get voice() { return studio ? 'studio' : activePack?.voice ?? null; },
  get synthetic() { return synthetic(); },
  supported, hasArabic() { return ready() && supported(); }, get enabled() { return enabled; }, getStatus,
  /** The voice studio saved or removed a call: read the set again. */
  reload() { return loadStudio({ fresh:true }); },
  /** The voice studio: say one call as the tables say it now. */
  async previewLine(id) { await this.unlock(); return player.enqueue(id, { urgent:true }); },
  hasRecording(id) { return Boolean(recordings[id]?.src); },
  /** 33.8.0: fetch and decode recorded lines before they are needed (the table phrases), so each plays whole. */
  prime(ids = []) { if (!allowed()) return; try { void player.prime(ids.filter((id) => recordings[id]?.src)); } catch {} },
  setEnabled(on) {
    enabled = Boolean(on);
    try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch {}
    if (!enabled) player.stop(); else void this.unlock();
    notify();
  },
  async unlock() {
    if (!allowed() || !visible()) return false;
    const ac = context(); if (!ac) return false;
    try {
      if (ac.state !== 'running') await ac.resume();
      if (ac.state !== 'running') { notify(); return false; }
      void player.drain();
      if (!primed) { primed = true; void player.prime(['pass', 'sun', 'ashkal', 'hokom_S', 'hokom_H', 'hokom_D', 'hokom_C', 'thani_S', 'claim', 'review_claim']); }
      notify(); return true;
    } catch { notify(); return false; }
  },
  say(text, position = 0, options = {}) {
    if (!allowed() || !supported()) return false;
    const ids = voiceLines(text);
    return ids.reduce((accepted, id) => player.enqueue(id, { ...options,
      key:options.key == null ? undefined : `${options.key}:${position}:${id}` }) || accepted, false);
  },
  replay() { return player.replay(); },
  preview() { void this.unlock(); return this.say('pass', 0, { urgent:true }); },
  stop(options = { clearLast:true }) { player.stop(options); },
  finish(options) { player.finish(options); },
  dispose() { player.dispose(); try { void ctx?.close(); } catch {} ctx = null; }
};
try {
  if (typeof fetch === 'function' && typeof window !== 'undefined' && window.location?.origin) void loadStudio();
  addEventListener('pointerdown', () => { void BalootVoice.unlock(); }, { passive:true });
  addEventListener('keydown', () => { void BalootVoice.unlock(); });
  addEventListener('bs-audio-change', () => { player.refreshSettings(); notify(); });
  document.addEventListener('visibilitychange', () => {
    if (!visible()) player.stop({ clearLast:true }); else notify();
  });
  addEventListener('pagehide', () => player.stop({ clearLast:true }));
} catch { /* The text-to-call mapper is also used by server-side checks. */ }
