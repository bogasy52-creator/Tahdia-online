/* Tahdia 33.9.10 — «نادي الكيرم». Three ways to play: online against a real player (a BoardRoom table:
   the room plays every shot to its end and the pages replay it), against the computer, or two on one
   phone. One pair of hands: the striker slides on the rail under the board (or is dragged on its line),
   and the shot is a slingshot — touch the board anywhere, pull back, let go. The line shows where the
   striker goes and what it hits; the ring round the striker shows the strength. */
import { createCarrom, placeStriker, shootCarrom, stepCarrom, chooseCarromShot, carromScore, replayCarromShot, readCarromAim, FIXED_DT } from './engine.js?v=33.9.12-quality1';
import { createCarromRenderer } from './render.js?v=33.9.12-quality1';
import { createTable } from '../board-table-v33.js?v=33.9.10';

const $ = (id) => document.getElementById(id), KEY = 'bs-carrom-settings-v1';
let saved = {}; try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch {}
const prefs = { mode: ['online', 'ai', 'hotseat'].includes(saved.mode) ? saved.mode : 'online', theme: saved.theme === 'club' ? 'club' : 'walnut', level: ['easy', 'normal', 'expert'].includes(saved.level) ? saved.level : saved.difficulty === 'expert' ? 'expert' : 'normal', wins: Number(saved.wins) || 0 };
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch {} };
const play = (name, volume) => { try { window.BS_AUDIO?.play?.(name, volume ? { volume } : undefined); } catch {} };
const reduced = () => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
const canvas = $('carromBoard'), renderer = createCarromRenderer(canvas);

const ctl = { mode: 'ai', state: null, anim: null, animDone: null, names: ['أنت', 'الكمبيوتر'], users: [null, null], bots: [false, true], me: 0, viewSeat: 0, pending: null, shownSeq: 0, match: 0, endShown: false, rewarded: false, receipt: '', turnSeen: -1, bot: null, running: false, paused: false };
let angle = -Math.PI / 2, power = 0, remote = null, table = null, room = null, frame = 0, last = 0, acc = 0;

/* ---------- who may play ---------- */
function canPlay() {
  const s = ctl.state;
  if (!ctl.running || ctl.paused || !s || s.phase !== 'aim' || ctl.anim || ctl.pending || ctl.bot) return false;
  if (ctl.mode === 'hotseat') return true;
  if (ctl.mode === 'ai') return s.turn === 0;
  return s.turn === ctl.me && room?.status === 'playing' && !room?.stepOf;
}

/* ---------- drawing ---------- */
function draw() {
  const s = ctl.anim || ctl.state; if (!s) return;
  let shown = s, aim = canPlay(), a = angle, p = power;
  // online: the other player's striker and aim as they set the shot
  if (!aim && ctl.mode === 'online' && remote && s === ctl.state && s.phase === 'aim' && remote.seat === s.turn && performance.now() - remote.t < 2500) {
    shown = { ...s, striker: { ...s.striker, x: remote.x } }; aim = true; a = remote.angle; p = remote.power;
  }
  // the computer setting its shot
  if (ctl.bot && s === ctl.state) { aim = true; a = ctl.bot.angle; p = ctl.bot.power * Math.min(1, ctl.bot.t); }
  renderer.draw(shown, { angle: a, power: p, seat: ctl.viewSeat, aim });
  paintSlider(); paintPowerTag(shown, p, aim); paintControls();
}
function resize() {
  const field = document.querySelector('.cm-playfield'); if (!field) return;
  const r = field.getBoundingClientRect(), size = Math.max(1, Math.floor(Math.min(r.width, r.height)));
  if (r.width && r.height) { $('carromSurface').style.width = size + 'px'; $('carromSurface').style.height = size + 'px'; renderer.resize(size, size); draw(); }
}
if (typeof ResizeObserver === 'function') new ResizeObserver(resize).observe(document.querySelector('.cm-playfield'));
addEventListener('resize', resize, { passive: true });

/* ---------- the cards ---------- */
function faceOf(seat) {
  const user = ctl.users[seat], P = window.BS_PROFILE_PRO, self = ctl.mode !== 'hotseat' && seat === (ctl.mode === 'online' ? ctl.me : 0);
  if (P && (user?.username || user?.photo || user?.fallback)) return P.avatar({ username: user.username, photo: user.photo, name: ctl.names[seat], fallback: user.fallback || '', self });
  return Object.assign(document.createElement('span'), { className: 'cc-letter' + (self && P?.frameClass?.() ? ' bs-avatar ' + P.frameClass() : ''), textContent: String(ctl.names[seat] || '؟').trim().slice(0, 1) });
}
function buildCards() {
  for (const seat of [0, 1]) {
    const card = $('player' + seat); card.querySelector('.cm-face').replaceChildren(faceOf(seat));
    const pips = card.querySelector('.cm-pips'); if (!pips.children.length) for (let k = 0; k < 9; k++) pips.append(document.createElement('i'));
  }
}
function renderCards() {
  const s = ctl.state; if (!s) return;
  const scores = carromScore(s);
  for (const seat of [0, 1]) {
    const card = $('player' + seat), sc = scores[seat];
    card.classList.toggle('active', s.turn === seat && s.winner === null);
    $('name' + seat).textContent = ctl.names[seat] || 'لاعب';
    $('score' + seat).textContent = String(sc.coins + sc.queen);
    $('due' + seat).textContent = sc.due ? 'عليه جزاء ' + sc.due : sc.queen ? 'الملكة +3' : seat === 0 ? 'الأبيض' : 'الأسود';
    [...card.querySelector('.cm-pips').children].forEach((pip, k) => pip.classList.toggle('on', k < sc.coins));
  }
  const q = $('queenStatus');
  q.textContent = s.queen.status === 'covered' ? 'الملكة مغطّاة' : s.queen.pending !== null ? 'غطّ الملكة!' : 'الملكة على الطاولة';
  q.classList.toggle('pending', s.queen.pending !== null);
}
function statusText() {
  const s = ctl.state; if (!s) return '';
  if (s.winner !== null) return 'انتهت الطاولة';
  if (ctl.anim) return 'الأحجار تتحرك…';
  if (ctl.pending) return 'الضربة طايرة…';
  if (ctl.bot) return 'الكمبيوتر يصوّب…';
  if (canPlay()) return ctl.mode === 'hotseat' ? 'دور ' + ctl.names[s.turn] + ' · اسحب لورا وأفلت' : 'دورك · اسحب لورا وأفلت';
  return 'دور ' + (ctl.names[s.turn] || 'الخصم') + '…';
}
function renderStatus() {
  $('carromStatus').textContent = statusText();
  $('status').classList.toggle('mine', canPlay());
  document.querySelector('.cm-dock')?.classList.toggle('idle', !canPlay());
  $('cmTurnHint').textContent = ctl.paused ? 'الطاولة متوقفة' : canPlay() ? (ctl.state.turn ? 'أحجارك السوداء' : 'أحجارك البيضاء') : 'بانتظار دورك';
}
let bannerTimer = 0, lastBanner = '';
function banner(text) {
  if (!text || text === 'الأحجار تتحرك…' || text === lastBanner) return; lastBanner = text;
  let node = document.querySelector('.cm-banner'); if (!node) { node = document.createElement('div'); node.className = 'cm-banner'; node.setAttribute('aria-hidden', 'true'); $('carromSurface').append(node); }
  node.textContent = text; node.className = 'cm-banner ' + (/خطأ|رجع|جزاء|ما تغطّت|الوقت/.test(text) ? 'bad' : /الملكة/.test(text) ? 'queen' : /دخل|غطّيت|فاز/.test(text) ? 'good' : '');
  void node.offsetWidth; node.classList.add('show'); clearTimeout(bannerTimer); bannerTimer = setTimeout(() => { node.classList.remove('show'); lastBanner = ''; }, 1800);
}

/* ---------- the rail ---------- */
const slider = $('cmSlider');
const viewX = (x) => (ctl.viewSeat ? 1000 - x : x);
let sliderPointer = null;
function paintSlider() {
  const s = ctl.state; if (!s) return;
  const x = ctl.bot && ctl.state === (ctl.anim || ctl.state) ? s.striker.x : remote && ctl.mode === 'online' && !canPlay() && remote.seat === s.turn && performance.now() - remote.t < 2500 ? remote.x : s.striker.x;
  const f = Math.max(0, Math.min(1, (viewX(x) - 220) / 560));
  slider.style.setProperty('--x', (f * 100).toFixed(2)); slider.setAttribute('aria-valuenow', String(Math.round(f * 100)));
  $('cmPositionValue').textContent = Math.round(f * 100) + '%';
  slider.setAttribute('aria-valuetext', Math.round(f * 100) + '% من خط الدافع');
  slider.setAttribute('aria-disabled', String(!canPlay())); slider.tabIndex = canPlay() ? 0 : -1;
}
function slideTo(clientX) {
  const r = slider.getBoundingClientRect(), f = Math.max(0, Math.min(1, (clientX - r.left - 20) / Math.max(1, r.width - 40)));
  const vx = 220 + f * 560; placeStriker(ctl.state, ctl.viewSeat ? 1000 - vx : vx); sendAim(); draw();
}
{
  slider.addEventListener('pointerdown', (e) => { if (!canPlay() || e.button !== 0 || e.isPrimary === false || sliderPointer !== null || hand) return; e.preventDefault(); window.BS_AUDIO?.unlock?.(); sliderPointer = e.pointerId; slider.classList.add('drag'); try { slider.setPointerCapture(sliderPointer); } catch {} slideTo(e.clientX); });
  slider.addEventListener('pointermove', (e) => { if (e.pointerId !== sliderPointer || !canPlay()) return; slideTo(e.clientX); });
  const up = (e) => { if (e.pointerId !== sliderPointer) return; sliderPointer = null; slider.classList.remove('drag'); };
  slider.addEventListener('pointerup', up); slider.addEventListener('pointercancel', up); slider.addEventListener('lostpointercapture', up);
  slider.addEventListener('keydown', (e) => { if (!canPlay() || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return; e.preventDefault(); e.stopPropagation(); moveStriker(e.key, e.shiftKey); });
}

function moveStriker(key, fine = false) {
  const vx = key === 'Home' ? 220 : key === 'End' ? 780 : viewX(ctl.state.striker.x) + (key === 'ArrowLeft' ? -1 : 1) * (fine ? 3 : 15);
  placeStriker(ctl.state, ctl.viewSeat ? 1000 - vx : vx); sendAim(); draw();
}

/* Precise controls share the same shot path as the slingshot, including online authority. */
const aimControl = $('cmAngle'), powerControl = $('cmPower');
function paintControls() {
  const ready = canPlay(), relative = angle - (ctl.viewSeat ? Math.PI / 2 : -Math.PI / 2);
  const degrees = Math.atan2(Math.sin(relative), Math.cos(relative)) * 180 / Math.PI;
  aimControl.value = String(Math.round(degrees)); powerControl.value = String(Math.round(power * 100));
  $('cmAngleValue').textContent = (Math.abs(degrees) < 0.05 ? '0' : Number(degrees.toFixed(1))) + '°';
  $('cmPowerValue').textContent = Math.round(power * 100) + '%';
  aimControl.setAttribute('aria-valuetext', $('cmAngleValue').textContent + ' من الأمام');
  powerControl.setAttribute('aria-valuetext', Math.round(power * 100) + '%');
  $('cmShotControls').disabled = !ready;
  $('cmFire').disabled = !ready || power < 0.08;
  $('cmCancel').disabled = !ready || (!hand && power === 0);
}
aimControl.addEventListener('input', () => {
  if (!canPlay()) return;
  const value = Number(aimControl.value); if (!Number.isFinite(value)) return;
  hand = null; angle = (ctl.viewSeat ? Math.PI / 2 : -Math.PI / 2) + Math.max(-180, Math.min(180, value)) * Math.PI / 180;
  sendAim(); draw();
});
powerControl.addEventListener('input', () => {
  if (!canPlay()) return;
  const value = Number(powerControl.value); if (!Number.isFinite(value)) return;
  hand = null; power = Math.max(0, Math.min(1, value / 100)); sendAim(); draw();
});
$('cmFire').addEventListener('click', () => { if (power >= 0.08) fire(angle, power); });
$('cmCancel').addEventListener('click', () => cancelAim());

/* ---------- the slingshot ---------- */
let hand = null;
const tag = $('cmPowerTag');
function paintPowerTag(s, p, aim) {
  if (!tag) return;
  if (!aim || !(p > 0.02) || !s) { tag.hidden = true; return; }
  const r = canvas.getBoundingClientRect(), box = $('carromSurface').getBoundingClientRect(), scale = Math.min(r.width, r.height) / 1000;
  const v = ctl.viewSeat ? { x: 1000 - s.striker.x, y: 1000 - s.striker.y } : s.striker;
  tag.hidden = false; tag.textContent = 'القوة ' + Math.round(p * 100) + '%';
  tag.style.left = (r.left - box.left + (r.width - 1000 * scale) / 2 + v.x * scale) + 'px'; tag.style.top = (r.top - box.top + (r.height - 1000 * scale) / 2 + (v.y - s.striker.r - 30) * scale) + 'px';
  tag.style.setProperty('--pc', p < 0.45 ? '#3ddc84' : p < 0.75 ? '#f2c94c' : '#ff6b55');
}
canvas.addEventListener('pointerdown', (e) => {
  if (!canPlay() || hand || sliderPointer !== null || e.button !== 0 || e.isPrimary === false) return;
  const p = renderer.point(e.clientX, e.clientY, ctl.viewSeat), s = ctl.state;
  if (!p) return;
  e.preventDefault(); window.BS_AUDIO?.unlock?.(); canvas.focus({ preventScroll: true });
  const onStriker = Math.hypot(p.x - s.striker.x, p.y - s.striker.y) < s.striker.r * 1.9;
  hand = { id: e.pointerId, sx: e.clientX, sy: e.clientY, p0: p, initialPower: power, kind: onStriker ? 'maybe' : 'sling', moved: false };
  try { canvas.setPointerCapture(e.pointerId); } catch {}
});
canvas.addEventListener('pointermove', (e) => {
  if (!hand || hand.id !== e.pointerId || !canPlay()) return;
  const dx = e.clientX - hand.sx, dy = e.clientY - hand.sy, far = Math.hypot(dx, dy);
  if (far > 6) hand.moved = true;
  // on the striker: sideways moves it on its line, anything else pulls it back
  if (hand.kind === 'maybe' && far > 10) hand.kind = Math.abs(dx) > Math.abs(dy) * 1.4 ? 'place' : 'sling';
  if (hand.kind === 'place') { const p = renderer.point(e.clientX, e.clientY, ctl.viewSeat); if (!p) { cancelAim(); return; } placeStriker(ctl.state, p.x); sendAim(); draw(); return; }
  if (hand.kind !== 'sling') return;
  const p = renderer.point(e.clientX, e.clientY, ctl.viewSeat); if (!p) { cancelAim(); return; }
  const bx = hand.p0.x - p.x, by = hand.p0.y - p.y;
  const full = Math.max(120, Math.min(200, canvas.getBoundingClientRect().width * 0.42));
  if (far < 12) { power = 0; draw(); return; }
  angle = Math.atan2(by, bx); power = Math.max(0, Math.min(1, (far - 12) / full));
  if (Math.round(power * 20) !== hand.step) { hand.step = Math.round(power * 20); if (hand.step % 4 === 0) play('tap', 0.12); }
  sendAim(); draw();
});
function release(e) {
  if (!hand || (e && hand.id !== e.pointerId)) return;
  const h = hand; hand = null;
  if (!canPlay()) { power = 0; draw(); return; }
  if (!h.moved) {
    const p = renderer.point(e.clientX, e.clientY, ctl.viewSeat);
    const coin = p && ctl.state.coins.find((c) => !c.pocketed && Math.hypot(c.x - p.x, c.y - p.y) < c.r * 1.8);
    if (coin) angle = Math.atan2(coin.y - ctl.state.striker.y, coin.x - ctl.state.striker.x);
    power = h.initialPower; sendAim(); draw();
    return;
  }
  if (h.kind === 'place') { power = h.initialPower; draw(); return; }
  if (h.kind === 'sling' && power >= 0.08) fire(angle, power);
  else { power = 0; draw(); }
}
canvas.addEventListener('pointerup', release);
function cancelAim() {
  const id = hand?.id; hand = null; power = 0;
  if (id !== undefined) { try { canvas.releasePointerCapture(id); } catch {} }
  sendAim(); draw();
}
const interrupted = (e) => { if (hand?.id === e.pointerId) cancelAim(); };
canvas.addEventListener('pointercancel', interrupted); canvas.addEventListener('lostpointercapture', interrupted);
addEventListener('blur', () => { if (hand) cancelAim(); sliderPointer = null; slider.classList.remove('drag'); });

let aimSent = 0;
function sendAim() {
  if (ctl.mode !== 'online' || !canPlay()) return;
  const now = Date.now(); if (now - aimSent < 150) return; aimSent = now;
  table?.send('carrom_aim', { x: Math.round(ctl.state.striker.x * 10) / 10, angle: Math.round(angle * 1000) / 1000, power: Math.round(power * 100) / 100 });
}
addEventListener('bs-carrom-aim', (e) => { const d = readCarromAim(e.detail); if (!d || ctl.mode !== 'online' || d.seat === ctl.me) return; remote = { ...d, t: performance.now() }; });

/* ---------- shots ---------- */
function animate(sim) { return new Promise((resolve) => { ctl.anim = sim; ctl.animDone = resolve; acc = 0; renderStatus(); }); }
function cancelPlayback() { const done = ctl.animDone; ctl.animDone = null; ctl.anim = null; clearTimeout(ctl.pending?.timer); ctl.pending = null; done?.(false); }
function fire(a, p) {
  if (!canPlay() || !Number.isFinite(a) || !Number.isFinite(p) || p < 0.08 || p > 1) return;
  const s = ctl.state, x = s.striker.x;
  if (ctl.mode === 'online') {
    const sim = structuredClone(s);
    try { shootCarrom(sim, { x, angle: a, power: p }, s.turn); } catch (error) { banner(error.message); return; }
    if (!table?.send('carrom_shot', { x, angle: a, power: p })) { banner('ما وصلت الضربة، جرّب مرة ثانية'); return; }
    hand = null; power = 0; window.dispatchEvent(new Event('bs-table-strike')); play('hit', 0.35 + p * 0.6); window.BS_AUDIO?.vibrate?.(14);
    ctl.pending = { seq: (s.seq || 0) + 1, done: animate(sim) };
    ctl.pending.timer = setTimeout(() => { if (ctl.pending) { cancelPlayback(); window.BS_PLATFORM?.toast?.('ما وصلت الضربة، جرّب مرة ثانية'); renderStatus(); draw(); } }, 15000);
    renderStatus(); return;
  }
  try { shootCarrom(s, { x, angle: a, power: p }, s.turn); } catch (error) { banner(error.message); return; }
  hand = null; power = 0; window.dispatchEvent(new Event('bs-table-strike')); play('hit', 0.35 + p * 0.6); window.BS_AUDIO?.vibrate?.(14);
  animate(s).then(completed => { if (completed && ctl.running && ctl.state === s) afterLocalShot(); });
}
function afterLocalShot() {
  if (!ctl.running || !ctl.state) return;
  const s = ctl.state; banner(s.message);
  if (s.winner !== null) { renderCards(); finish(); return; }
  onTurn();
}
function onTurn() {
  const s = ctl.state; if (!s) return;
  renderCards(); renderStatus();
  if (s.turnNo === ctl.turnSeen) { draw(); return; }
  ctl.turnSeen = s.turnNo;
  if (ctl.mode === 'hotseat') ctl.viewSeat = s.turn;
  angle = s.turn === 0 ? -Math.PI / 2 : Math.PI / 2; power = 0.55; hand = null; sliderPointer = null; slider.classList.remove('drag');
  if (ctl.mode === 'ai' && s.turn === 1 && s.phase === 'aim' && s.winner === null) {
    const plan = chooseCarromShot(s, prefs.level); placeStriker(s, plan.x);
    ctl.bot = { ...plan, t: 0, at: performance.now() };
  }
  if (canPlay() && ctl.mode !== 'online') play('yourTurn', 0.35);
  renderStatus(); draw();
}

/* ---------- the loop ---------- */
function loop(now) {
  frame = 0; if (!ctl.running) return;
  const dt = Math.max(0, Math.min(0.08, (now - last) / 1000)); last = now;
  if (!ctl.paused) {
    if (ctl.anim) {
      acc = Math.min(0.15, acc + dt); let collide = 0, pocket = 0;
      while (acc >= FIXED_DT && ctl.anim.phase === 'moving') {
        stepCarrom(ctl.anim, FIXED_DT); acc -= FIXED_DT;
        for (const e of ctl.anim.events) { if (e.type === 'collision') collide = Math.max(collide, e.strength || 0.5); if (e.type === 'pocket') pocket++; if (e.type === 'foul') play('error', 0.5); }
      }
      if (collide && now - (loop.click || 0) > 55) { loop.click = now; play('tap', 0.2 + collide * 0.7); }
      if (pocket) { play('capture', 0.8); window.BS_AUDIO?.vibrate?.(20); }
      if (ctl.anim.phase !== 'moving') { const done = ctl.animDone; ctl.anim = null; ctl.animDone = null; done?.(true); }
    } else if (ctl.bot) {
      // the computer turns its aim to the shot, then strikes
      const b = ctl.bot; b.t = Math.min(1.2, (now - b.at) / 900);
      angle = b.angle;
      if (b.t >= 1.2) { ctl.bot = null; const s = ctl.state; try { shootCarrom(s, b, 1); window.dispatchEvent(new Event('bs-table-strike')); play('hit', 0.4 + b.power * 0.5); animate(s).then(completed => { if (completed && ctl.running && ctl.state === s) afterLocalShot(); }); } catch { const plan = chooseCarromShot(s, prefs.level); placeStriker(s, plan.x); ctl.bot = { ...plan, t: 0, at: now }; } }
    }
  }
  draw();
  frame = requestAnimationFrame(loop);
}
function run() { if (!frame) { last = performance.now(); frame = requestAnimationFrame(loop); } }

/* ---------- start, pause, end ---------- */
function myUser() { const me = window.BS_SOCIAL?.isLoggedIn?.() ? window.BS_SOCIAL.profile?.() : null; return me ? { username: me.username, photo: me.photo || null } : null; }
function showGame() {
  $('carromMenu').hidden = true; $('carromGame').hidden = false; $('carromPause').hidden = true; $('carromResult').hidden = true;
  document.body.classList.add('carrom-running', 'game-running');
  window.BS_LOCAL_REACTIONS = { active: ctl.mode !== 'online' }; window.dispatchEvent(new Event('bs-reaction-refresh'));
  $('carromPauseButton').hidden = ctl.mode === 'online';
  renderer.setTheme(prefs.theme); buildCards(); ctl.running = true; ctl.paused = false; resize(); run();
}
function startLocal(mode) {
  cancelPlayback();
  ctl.mode = mode; prefs.mode = mode; persist();
  ctl.names = mode === 'ai' ? [window.BS_GAME_MENU?.playerName?.() || 'أنت', 'الكمبيوتر'] : ['اللاعب الأول', 'اللاعب الثاني'];
  ctl.users = mode === 'ai' ? [myUser(), { photo: { kind: 'preset', id: 'h-robot' } }] : [null, null];
  ctl.bots = mode === 'ai' ? [false, true] : [false, false];
  ctl.state = createCarrom({ mode: mode === 'hotseat' ? 'hotseat' : 'ai', difficulty: prefs.level, seed: (Math.random() * 4294967296) >>> 0 });
  ctl.anim = null; ctl.pending = null; ctl.bot = null; ctl.endShown = false; ctl.rewarded = false; ctl.turnSeen = -1; ctl.viewSeat = 0; lastBanner = '';
  ctl.receipt = 'carrom:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  showGame(); onTurn(); play('go', 0.5);
}
function showMenu() {
  cancelPlayback();
  clearTimeout(ctl.pending?.timer); hand = null; sliderPointer = null; power = 0; remote = null;
  ctl.running = false; ctl.anim = null; ctl.pending = null; ctl.bot = null; cancelAnimationFrame(frame); frame = 0;
  document.body.classList.remove('carrom-running', 'game-running');
  window.BS_LOCAL_REACTIONS = { active: false }; window.dispatchEvent(new Event('bs-reaction-refresh'));
  $('carromGame').hidden = true; $('carromMenu').hidden = false; $('carromPause').hidden = true; $('carromResult').hidden = true;
}
function pause(value) {
  if (!ctl.running || ctl.mode === 'online' || ctl.state?.winner !== null) return;
  ctl.paused = value; $('carromPause').hidden = !value; cancelAim(); sliderPointer = null; slider.classList.remove('drag'); last = performance.now();
  if (ctl.bot && !value) ctl.bot.at = performance.now();
  renderStatus(); if (!value) canvas.focus({ preventScroll: true }); else $('carromResume').focus();
}
function finish() {
  if (ctl.endShown) return; ctl.endShown = true;
  const s = ctl.state, w = s.winner, scores = carromScore(s), mine = ctl.mode === 'online' ? ctl.me : 0, won = ctl.mode === 'hotseat' || w === mine;
  $('carromWinner').textContent = ctl.mode === 'hotseat' ? ctl.names[w] + ' فاز!' : won ? 'فزت بالطاولة!' : (ctl.names[w] || 'الخصم') + ' فاز';
  $('carromResultCopy').textContent = '9 أحجار' + (scores[w].queen ? ' · الملكة مغطّاة +3' : '') + ' · ' + s.shots[w] + ' ضربات';
  $('carromWinnerDisc').className = 'cm-winner-disc ' + (w === 0 ? 'light' : 'dark');
  $('carromAgain').textContent = ctl.mode === 'online' ? (room?.publicMatch ? 'مباراة جديدة' : room?.me?.role === 'host' ? 'جولة جديدة' : 'بانتظار المضيف') : 'العب مرة ثانية';
  $('carromAgain').disabled = ctl.mode === 'online' && !room?.publicMatch && room?.me?.role !== 'host';
  play(won ? 'victory' : 'defeat', 0.8);
  if (!ctl.rewarded) {
    ctl.rewarded = true;
    if (ctl.mode === 'online') window.BS_CAREER?.refresh?.()?.catch?.(() => {});
    else if (ctl.mode === 'ai') { if (w === 0) { prefs.wins++; persist(); } window.BS_CAREER?.record?.({ id: ctl.receipt, game: 'carrom', win: w === 0 })?.catch?.(() => {}); }
  }
  setTimeout(() => { if (ctl.endShown) $('carromResult').hidden = false; }, 700);
}

/* ---------- online ---------- */
async function apply(next, { animate: moving }) {
  room = next;
  const s = next.state; if (!s || !Array.isArray(s.coins)) return;
  const fresh = ctl.mode !== 'online' || $('carromGame').hidden || ctl.match !== (next.startedAt || 0);
  ctl.me = next.me?.index ?? 0;
  ctl.names = [0, 1].map((i) => next.players?.find((p) => p.index === i)?.name || s.players?.[i]?.name || 'لاعب');
  ctl.bots = [0, 1].map((i) => Boolean(next.players?.find((p) => p.index === i)?.bot));
  ctl.users = [0, 1].map((i) => { const p = next.players?.find((x) => x.index === i); const hero = p?.look?.character; return p?.username ? { username: p.username, fallback: hero ? '/assets/heroes/face/' + hero + '.webp' : '' } : hero ? { photo: null, fallback: '/assets/heroes/face/' + hero + '.webp', username: '' } : null; });
  if (fresh) {
    cancelPlayback();
    ctl.mode = 'online'; ctl.match = next.startedAt || 0; ctl.endShown = false; ctl.rewarded = false; ctl.pending = null; ctl.anim = null; ctl.bot = null; ctl.turnSeen = -1; lastBanner = '';
    ctl.viewSeat = ctl.me;
    ctl.shownSeq = s.last ? s.last.seq - (next.stepOf ? 1 : 0) : 0;
    ctl.state = next.stepOf && s.shotRec ? structuredClone(s.shotRec.before) : s;
    showGame(); renderCards();
    if (!s.last) { banner(s.turn === ctl.me ? 'أنت تبدأ!' : (ctl.names[s.turn] || 'الخصم') + ' يبدأ'); play('go', 0.5); }
  }
  const match = ctl.match;
  if (s.last && s.last.seq > ctl.shownSeq) {
    const mine = ctl.pending && ctl.pending.seq === s.last.seq;
    if (mine) { clearTimeout(ctl.pending.timer); const completed = await ctl.pending.done; if (!completed) return; ctl.pending = null; }
    else if (s.shotRec && s.shotRec.seq === s.last.seq && moving && !document.hidden) { remote = null; window.dispatchEvent(new Event('bs-table-strike')); play('hit', 0.3 + (s.shotRec.power || 0.5) * 0.6); await animate(replayCarromShot(s.shotRec)); }
    if (!ctl.running || ctl.mode !== 'online' || ctl.match !== match) return;
    ctl.shownSeq = s.last.seq;
    banner(s.last.message);
  }
  ctl.state = s; ctl.anim = null; onTurn();
  if (s.winner !== null) finish();
}
try {
  table = createTable({
    game: 'carrom',
    quickNote: 'مواجهة 1 ضد 1: نلقى لك منافس خلال ثواني.',
    roomNote: 'أنشئ غرفة وارسل الرمز لخويّك.',
    lobbyNote: (next, isPublic) => (isPublic ? 'تبدأ بعد العد.' : 'أرسل الرمز لخويّك. تبدأ إذا ضغطت «ابدأ».'),
    apply,
    onLobby: () => { if (!$('carromGame').hidden) showMenu(); setMode('online'); },
    onMenu: () => { if (!$('carromGame').hidden) showMenu(); },
    onStatus: () => {},
    onError: (message) => { if (ctl.pending) { cancelPlayback(); renderStatus(); draw(); } window.BS_PLATFORM?.toast?.(message); },
  });
} catch (error) { console.error('carrom online unavailable', error); }

/* ---------- the menu ---------- */
function setMode(mode) {
  for (const b of document.querySelectorAll('.cm-modes button')) b.setAttribute('aria-checked', String(b.dataset.mode === mode));
  for (const p of document.querySelectorAll('.cm-panel')) p.hidden = p.dataset.panel !== mode;
  prefs.mode = mode; persist();
}
for (const b of document.querySelectorAll('.cm-modes button')) b.addEventListener('click', () => setMode(b.dataset.mode));
function setLevel(v) { prefs.level = v; for (const b of document.querySelectorAll('#carromLevel button')) b.setAttribute('aria-checked', String(b.dataset.v === v)); persist(); }
for (const b of document.querySelectorAll('#carromLevel button')) b.addEventListener('click', () => setLevel(b.dataset.v));
function setTheme(v) { prefs.theme = v; for (const b of document.querySelectorAll('.cm-themes button')) b.setAttribute('aria-checked', String(b.dataset.theme === v)); persist(); }
for (const b of document.querySelectorAll('.cm-themes button')) b.addEventListener('click', () => setTheme(b.dataset.theme));
for (const b of document.querySelectorAll('[data-start]')) b.addEventListener('click', () => { window.BS_AUDIO?.unlock?.(); startLocal(b.dataset.start); });
setMode(/[?&]room=\d{6}/.test(location.search) ? 'online' : prefs.mode); setLevel(prefs.level); setTheme(prefs.theme);
$('carromExit').onclick = () => { if (ctl.mode === 'online') table?.leave(); showMenu(); };
$('carromPauseButton').onclick = () => pause(true); $('carromResume').onclick = () => pause(false);
$('carromRestart').onclick = () => startLocal(ctl.mode); $('carromBackMenu').onclick = () => { if (ctl.mode === 'online') table?.leave(); showMenu(); };
$('carromAgain').onclick = () => { $('carromResult').hidden = true; if (ctl.mode === 'online') table?.again(); else startLocal(ctl.mode); };
function paintMute() { const muted = Boolean(window.BS_AUDIO?.getSettings?.().muted); for (const id of ['carromMute', 'carromSound']) { const b = $(id); if (!b) continue; b.textContent = muted ? '🔇' : '🔊'; b.setAttribute('aria-pressed', String(muted)); } }
for (const id of ['carromMute', 'carromSound']) $(id)?.addEventListener('click', () => { window.BS_AUDIO?.toggleMuted?.(); paintMute(); });
addEventListener('bs-audio-change', paintMute); paintMute();
document.addEventListener('visibilitychange', () => { if (document.hidden && ctl.mode !== 'online') pause(true); });
document.addEventListener('keydown', (e) => {
  if (!ctl.running || e.defaultPrevented) return;
  if (e.key === 'Escape') { e.preventDefault(); if (canPlay() && (hand || power > 0)) cancelAim(); else pause(!ctl.paused); return; }
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName) || e.target.closest('button,a,summary') || e.target.isContentEditable || !canPlay()) return;
  const key = e.key.toLowerCase();
  if (key === 'a' || key === 'd') { e.preventDefault(); angle += (key === 'a' ? -1 : 1) * (e.shiftKey ? 0.25 : 1) * Math.PI / 180; sendAim(); draw(); }
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); moveStriker(e.key, e.shiftKey); }
  else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); power = Math.max(0, Math.min(1, power + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 0.01 : 0.05))); sendAim(); draw(); }
  else if ((e.key === 'Enter' || e.key === ' ') && power >= 0.08 && !e.repeat) { e.preventDefault(); fire(angle, power); }
});
if (new URLSearchParams(location.search).has('debug')) window.BS_CARROM = { get state() { return ctl.state; }, get ctl() { return ctl; }, startLocal, fire: (a, p) => fire(a, p), setAim(a, p) { angle = a; power = p; draw(); }, renderer, canPlay };
