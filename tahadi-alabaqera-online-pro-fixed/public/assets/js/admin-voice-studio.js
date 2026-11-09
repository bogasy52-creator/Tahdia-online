/* Tahdia 33.1.0 — the Baloot voice studio (manager only).
   The manager records every call the Baloot table says, with the phone's own
   microphone: no key and no outside service. A take is trimmed, evened out and
   kept as a small WAV on the server; every table then plays it for that call.
   «سجّل الكل» walks through the calls one by one: say it, listen, keep it, next.
   A call can also come from a sound file (a voice note someone with a clear Gulf
   voice recorded): it goes through the same trimming and evening out.
   33.8.0: no noise gate on the microphone and a gentler cut, so no word loses its first or last sound. */
import { VOICE_LINES } from './baloot-voice-pack.js?v=33.9.0-baloot2';
import { BalootVoice } from './baloot-voice.js?v=33.9.0-baloot2';

const $ = (id) => document.getElementById(id);
const RATE = 22050, MAX_SECONDS = 5, MAX_FILE_BYTES = 12 * 1024 * 1024, MAX_KEPT_SECONDS = 6.5;
const token = () => { try { return localStorage.getItem('bs_social_session') || ''; } catch { return ''; } };
export const GROUPS = [
  ['الشراء والدبل', (id) => /^(pass|sun|ashkal|hokom_[SHDC]|thani_[SHDC]|double|double_locked|triple|four|four_locked|gahwa)$/.test(id)],
  ['المشاريع', (id) => /^(sira|fifty|hundred|fourHundred|and|baloot|projects_\w+)$/.test(id)],
  ['التسجيل والمراجعة', (id) => /^(claim|claim_ok|caught|wrong|kaboot|review_\w+)$/.test(id)],
  ['عبارات الطاولة', (id) => /^p\d+$/.test(id)],
];
const ERRORS = {
  unauthorized: 'سجّل الدخول بحساب BoSraG.', forbidden: 'هذي الأداة لحساب المدير فقط.', too_long: 'التسجيل طويل: خلّه أقصر من 5 ثوانٍ.',
  invalid_audio: 'ما قدرنا نقرأ التسجيل. جرّب مرة ثانية.', invalid_line: 'هذا النداء غير معروف.', not_found: 'ما فيه تسجيل محفوظ لهذا النداء.',
  mic: 'اسمح للمتصفح يستخدم المايك (من إعدادات الموقع) وجرّب مرة ثانية.', silent: 'ما سمعنا صوت. قرّب الجوال وقلها بصوت واضح.',
  file_big: 'الملف كبير. اختر مقطع قصير فيه النداء بس.', file_long: 'المقطع طويل بعد قص السكوت: لازم يكون أقل من 6 ثوانٍ وفيه النداء بس.', file_kind: 'ما قدرنا نقرأ هذا الملف. جرّب MP3 أو M4A أو WAV أو فويس نوت.',
};
let pack = null, busy = false, ac = null, stream = null, recorder = null, parts = [], stopTimer = null, take = null, walk = null;

function node(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function say(text) { $('voiceMessage').textContent = text || ''; }
function context() { if (!ac) { const AC = window.AudioContext || window.webkitAudioContext; ac = AC ? new AC() : null; } return ac; }
const decode = (data) => new Promise((resolve, reject) => { const done = context().decodeAudioData(data, resolve, reject); if (done?.then) done.then(resolve, reject); });

async function call(path, { body, raw } = {}) {
  const headers = { authorization: 'Bearer ' + token() };
  if (!raw) headers['content-type'] = 'application/json';
  const res = await fetch('/api/baloot/voice/' + path, { method: 'POST', headers, body: raw || JSON.stringify(body || {}), cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const error = new Error(data.error || 'request_failed'); error.status = res.status; throw error; }
  return data;
}

/* ---------- A take: microphone → one channel, 22 kHz, quiet ends cut, level evened → WAV ---------- */
/** Where the voice is in a take: the quiet before and after it is left out. */
export function trimOf(samples, rate, threshold) {
  let a = 0, b = samples.length - 1;
  while (a < b && Math.abs(samples[a]) < threshold) a++;
  while (b > a && Math.abs(samples[b]) < threshold) b--;
  if (b <= a) return { from: 0, to: samples.length };
  // 33.8.0: a longer margin on both sides: the soft start (هـ، ال) and the fading end of a word stay whole
  return { from: Math.max(0, a - Math.round(rate * 0.12)), to: Math.min(samples.length, b + Math.round(rate * 0.25)) };
}
/** 16-bit mono PCM WAV. */
export function encodeWav(samples, rate = RATE) {
  const out = new ArrayBuffer(44 + samples.length * 2), v = new DataView(out);
  const text = (at, s) => { for (let i = 0; i < s.length; i++) v.setUint8(at + i, s.charCodeAt(i)); };
  text(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); text(8, 'WAVE'); text(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); text(36, 'data'); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, samples[i])) * 0x7fff), true);
  return out;
}
/** Cut, even out and fade one take (samples at RATE). */
export function shapeTake(mono) {
  let peak = 0;
  for (const x of mono) peak = Math.max(peak, Math.abs(x));
  if (peak < 0.02) throw new Error('silent');
  const { from, to } = trimOf(mono, RATE, Math.max(0.006, peak * 0.035));
  const clip = mono.slice(from, to), gain = 0.89 / peak, fade = Math.max(1, Math.min(clip.length / 4, RATE * 0.015));
  for (let i = 0; i < clip.length; i++) clip[i] = clip[i] * gain * Math.max(0, Math.min(1, i / fade, (clip.length - 1 - i) / fade));
  return clip;
}
async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('mic');
  try { await context()?.resume?.(); } catch {}
  try { stream ||= await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: true } }); }
  catch { throw new Error('mic'); }
  parts = [];
  recorder = new MediaRecorder(stream);
  const done = new Promise((resolve) => { recorder.onstop = () => resolve(new Blob(parts, { type: recorder.mimeType || 'audio/webm' })); });
  recorder.ondataavailable = (e) => { if (e.data?.size) parts.push(e.data); };
  recorder.start();
  clearTimeout(stopTimer);
  stopTimer = setTimeout(stopRecording, MAX_SECONDS * 1000);
  return done;
}
function stopRecording() { clearTimeout(stopTimer); if (recorder?.state === 'recording') recorder.stop(); }
const recording = () => recorder?.state === 'recording';
async function prepare(blob) {
  const decoded = await decode(await blob.arrayBuffer());
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const off = new OAC(1, Math.max(1, Math.ceil(decoded.duration * RATE)), RATE);
  const src = off.createBufferSource();
  src.buffer = decoded; src.connect(off.destination); src.start();
  const clip = shapeTake((await off.startRendering()).getChannelData(0));
  if (clip.length / RATE > MAX_KEPT_SECONDS) throw new Error('file_long');
  return { wav: encodeWav(clip), seconds: clip.length / RATE };
}
async function playWav(bytes) {
  const buffer = await decode(bytes.slice(0)), src = context().createBufferSource();
  src.buffer = buffer; src.connect(context().destination); src.start();
}

/* ---------- The list ---------- */
const kept = (id) => Boolean(pack?.lines?.[id]);
function render() {
  if (!pack) return;
  $('voiceReady').textContent = String(pack.ready);
  $('voiceTotal').textContent = 'من ' + pack.total + ' نداء بصوتك';
  $('voiceMeter').style.width = Math.round((pack.ready / Math.max(1, pack.total)) * 100) + '%';
  $('voiceGuided').textContent = pack.ready ? (pack.ready < pack.total ? 'كمّل تسجيل الباقي' : 'سجّل الكل من جديد') : 'سجّل الكل خطوة بخطوة';
  const list = $('voiceList');
  list.replaceChildren();
  for (const [title, test] of GROUPS) {
    const box = node('section', 'admin-voice-group');
    box.append(node('h3', null, title));
    for (const id of Object.keys(VOICE_LINES).filter(test)) {
      const row = node('article', 'admin-voice-row' + (kept(id) ? ' is-kept' : ''));
      const copy = node('div');
      copy.append(node('b', null, VOICE_LINES[id]), node('small', null, kept(id) ? '🎙 بصوتك' : 'ما سُجّل بعد'));
      const tools = node('nav'), listen = node('button', null, '▶'), rec = node('button', 'rec', '🎙 سجّل'), back = node('button', null, 'احذف');
      for (const b of [listen, rec, back]) b.type = 'button';
      listen.setAttribute('aria-label', 'اسمع «' + VOICE_LINES[id] + '»');
      listen.hidden = back.hidden = !kept(id);
      listen.onclick = () => BalootVoice.previewLine(id);
      rec.onclick = () => openRecorder([id]);
      back.onclick = () => removeTake(id);
      tools.append(listen, rec, back);
      row.append(copy, tools);
      box.append(row);
    }
    list.append(box);
  }
  setBusy(busy);
}
function setBusy(value) {
  busy = value;
  for (const b of document.querySelectorAll('#adminVoice button')) if (!b.closest('#voiceDialog')) b.disabled = value;
}
async function load() {
  try { pack = await call('status'); $('adminVoice').hidden = false; render(); }
  catch (error) { if (error.status === 401 || error.status === 403) { $('adminVoice').hidden = true; return; } $('adminVoice').hidden = false; say('تعذر تحميل الأصوات. تأكد أن السيرفر محدّث.'); }
}
async function removeTake(id) {
  if (busy || !window.confirm?.('تحذف تسجيل «' + VOICE_LINES[id] + '»؟')) return;
  setBusy(true);
  try { pack = await call('remove', { body: { id } }); await BalootVoice.reload(); say('حذفنا تسجيل «' + VOICE_LINES[id] + '».'); }
  catch (error) { say(ERRORS[error.message] || 'تعذر الحذف.'); }
  finally { setBusy(false); render(); }
}

/* ---------- The recorder: one call, or every call one after another ---------- */
function openRecorder(ids) {
  if (!ids.length) return;
  walk = { ids, at: 0 };
  take = null;
  $('voiceDialog').hidden = false;
  showLine();
  $('voiceRec').focus();
}
function closeRecorder() { stopRecording(); walk = null; take = null; $('voiceDialog').hidden = true; render(); }
function showLine() {
  const id = walk.ids[walk.at];
  $('voiceStep').textContent = walk.ids.length > 1 ? `${walk.at + 1} من ${walk.ids.length}` : 'نداء واحد';
  $('voiceText').textContent = VOICE_LINES[id];
  $('voiceRec').textContent = recording() ? '⏹ وقّف' : take ? '🎙 أعد التسجيل' : '🎙 ابدأ التسجيل';
  $('voiceFile').disabled = recording();
  $('voiceTake').hidden = !take;
  $('voiceNext').textContent = walk.at < walk.ids.length - 1 ? 'احفظ وكمّل' : 'احفظ';
  $('voiceSkip').hidden = walk.ids.length < 2;
  $('voiceState').textContent = take ? `تسجيلك ${take.seconds.toFixed(1)} ث. اسمعه، واحفظه إذا عجبك.` : 'اضغط «ابدأ التسجيل» وقلها بصوتك وبلهجتك، وبعدها «وقّف».';
}
async function toggleRec() {
  if (recording()) { stopRecording(); return; }
  const id = walk.ids[walk.at];
  take = null;
  try {
    const finished = startRecording();
    $('voiceRec').textContent = '⏹ وقّف';
    $('voiceRec').classList.add('live');
    $('voiceTake').hidden = true;
    $('voiceState').textContent = 'نسجّل… قلها الحين (أقصى شي 5 ثوانٍ)';
    const blob = await finished;
    $('voiceRec').classList.remove('live');
    $('voiceState').textContent = 'نجهّز التسجيل…';
    take = { id, ...(await prepare(blob)) };
    await playWav(take.wav);
  } catch (error) {
    take = null;
    $('voiceRec').classList.remove('live');
    showLine();
    $('voiceState').textContent = ERRORS[error.message] || 'تعذر التسجيل. جرّب مرة ثانية.';
    return;
  }
  showLine();
}
async function keep() {
  if (!take || busy) return;
  busy = true;
  $('voiceNext').disabled = true;
  try {
    pack = await call('save?id=' + encodeURIComponent(take.id), { raw: take.wav });
    await BalootVoice.reload();
    take = null;
    if (walk.at < walk.ids.length - 1) { walk.at += 1; showLine(); }
    else { say('حفظنا صوتك، وصار يتسمع على كل طاولات البلوت.'); closeRecorder(); }
  } catch (error) { $('voiceState').textContent = ERRORS[error.message] || 'تعذر الحفظ. جرّب مرة ثانية.'; }
  finally { busy = false; $('voiceNext').disabled = false; }
}
/** A sound file for this call: same shaping as a take, then listen and keep. */
async function fromFile(file) {
  if (!file || !walk || recording()) return;
  const id = walk.ids[walk.at];
  take = null;
  $('voiceTake').hidden = true;
  try {
    if (file.size > MAX_FILE_BYTES) throw new Error('file_big');
    $('voiceState').textContent = 'نجهّز الملف…';
    try { await context()?.resume?.(); } catch {}
    let shaped;
    try { shaped = await prepare(file); }
    catch (error) { throw new Error(['silent', 'file_long'].includes(error.message) ? error.message : 'file_kind'); }
    take = { id, ...shaped };
    showLine();
    await playWav(take.wav);
  } catch (error) {
    take = null;
    showLine();
    $('voiceState').textContent = ERRORS[error.message] || ERRORS.file_kind;
  }
}
function skip() { stopRecording(); take = null; if (walk.at < walk.ids.length - 1) { walk.at += 1; showLine(); } else closeRecorder(); }

function init() {
  if (typeof document === 'undefined' || !$('adminVoice')) return;
  $('voiceGuided').onclick = () => {
    const missing = Object.keys(VOICE_LINES).filter((id) => !kept(id));
    openRecorder(missing.length ? missing : Object.keys(VOICE_LINES));
  };
  $('voiceRefresh').onclick = () => { say(''); load(); };
  $('voiceRec').onclick = toggleRec;
  $('voiceFile').onclick = () => { $('voiceFileInput').value = ''; $('voiceFileInput').click(); };
  $('voiceFileInput').onchange = (e) => fromFile(e.target.files?.[0]);
  $('voicePlay').onclick = () => take && playWav(take.wav);
  $('voiceNext').onclick = keep;
  $('voiceSkip').onclick = skip;
  $('voiceClose').onclick = closeRecorder;
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('voiceDialog').hidden) closeRecorder(); });
  if (token()) load();
}
init();
if (typeof window !== 'undefined') window.BS_ADMIN_VOICE = Object.freeze({ load, get pack() { return pack; } });
