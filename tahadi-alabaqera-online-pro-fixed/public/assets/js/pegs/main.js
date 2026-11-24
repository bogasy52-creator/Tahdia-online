import {pegsDieFace,pegsDiePalette} from './presentation.js?v=33.11.1';
/* Tahdia 33.10.2 — «شطرنج الذاكرة»: the page. One controller for the three ways to play: online (the
   room keeps the colours and sends each step), against the computer, and friends on one phone. The
   board is the 3D table (stage3d.js) wherever WebGL runs, and the flat one (board.js) everywhere else;
   both take the same per-piece instructions, so every step is shown the same way whoever made it. */
import { PEGS, PEG_COLORS, pegsOptions, createPegsGame, rollPegs, pickPegs, peekPegs, choosePegsMove } from '../engines/pegs-engine.js?v=33.14.0';
import { createPegsBoard } from './board.js?v=33.11.7';
import { createTable } from '../board-table-v33.js?v=33.11.7';
import { guardPegs } from './guard.js?v=33.13.0';

import {createPegsRace,playPegsRace,advancePegsRace,choosePegsRaceMove,publicPegsRace} from '../engines/pegs-race-engine.js?v=33.11.1';
const $ = (id) => document.getElementById(id);
const SEATS = ['#ffc94d', '#5fd4ff', '#ff7ab6', '#8ee06a', '#c09bff', '#ff995a'];
const HEROES = ['robot', 'cyber', 'astronaut', 'samurai', 'viking'];
const KEY = 'bs-pegs-v33-10-1', TOUR_KEY = 'bs-pegs-tour-v1';
const prefs = (() => { const base = { mode: 'online', level: 'medium', rivals: 1, local: 2, look: 7, swaps: false, variant:'classic', wins: 0 }; try { return { ...base, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return base; } })();
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch {} };
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
const params = new URLSearchParams(location.search);
const reduce = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
const easeOut = (k) => 1 - (1 - k) ** 3, easeIn = (k) => k * k * k, easeBack = (k) => 1 + 2.4 * (k - 1) ** 3 + 1.4 * (k - 1) ** 2;
const colorName = (c) => PEG_COLORS[c]?.name || '';

/* ---------- the symbol under each colour (the same shapes as on the pieces and the die) ---------- */
const STAR = Array.from({ length: 10 }, (_, k) => { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 4 : 9; return (k ? 'L' : 'M') + (12 + Math.cos(a) * r).toFixed(2) + ' ' + (12 + Math.sin(a) * r).toFixed(2); }).join('') + 'Z';
const SYMBOL_PATHS = ['M12 3.5 21 19.5H3z', STAR, 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z', 'M12 2.5 19.5 12 12 21.5 4.5 12z', 'M12 4a8 8 0 1 0 0 16 8 8 0 1 0 0-16z', 'M5 5h14v14H5z','M12 2l8.7 5v10L12 22l-8.7-5V7z','M18 3a9 9 0 1 0 0 18A10 10 0 0 1 18 3z'];
function gem(c) {
  const el = document.createElement('i'); el.className = 'pg-gem' + (c === 1 || c === 4 ? ' light' : ''); el.style.setProperty('--c', PEG_COLORS[c]?.hex || '#999');
  el.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + SYMBOL_PATHS[c] + '"/></svg>';
  el.setAttribute('role', 'img'); el.setAttribute('aria-label', colorName(c));
  return el;
}

/* ---------- sounds: the game's own wooden kit, plus the shared dice and results ---------- */
const SFX = ['lift', 'right', 'wrong', 'place', 'streak', 'look', 'hide', 'peek', 'swap', 'tick'];
const sfxBuf = {};
const audioSettings = () => window.BS_AUDIO?.getSettings?.() || { muted: false, effects: true, volume: 0.8 };
function sfxLoad(name) {
  const ctx = window.BS_AUDIO?.context?.();
  if (!ctx?.decodeAudioData || sfxBuf[name] !== undefined || typeof fetch !== 'function') return;
  sfxBuf[name] = null;
  fetch('/assets/sounds/pegs-v33-10-1/' + name + '.wav').then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
    .then((b) => new Promise((ok, no) => ctx.decodeAudioData(b, ok, no))).then((b) => { sfxBuf[name] = b; }).catch(() => { sfxBuf[name] = false; });
}
function sfx(name, volume = 0.8) {
  const st = audioSettings(); if (st.muted || st.effects === false) return;
  const ctx = window.BS_AUDIO?.context?.(), b = sfxBuf[name], level = Math.max(0, Math.min(1, Number(st.volume ?? 0.8)));
  if (ctx && ctx.state === 'running' && b) {
    try { const n = ctx.createBufferSource(), g = ctx.createGain(); n.buffer = b; g.gain.value = volume * level * 1.25; n.connect(g).connect(ctx.destination); n.start(); return; } catch {}
  }
  if (b === undefined) sfxLoad(name);
  try { const a = new Audio('/assets/sounds/pegs-v33-10-1/' + name + '.wav'); a.volume = Math.min(1, volume * level); a.play().catch(() => {}); } catch {}
}
function primeSound() { window.BS_AUDIO?.unlock?.(); for (const name of SFX) sfxLoad(name); window.BS_AUDIO?.prime?.(['dice', 'diceImpact', 'victory', 'defeat', 'yourTurn']); }
const play = (name, volume) => window.BS_AUDIO?.play?.(name, volume === undefined ? {} : { volume });
const buzz = (pattern) => window.BS_AUDIO?.vibrate?.(pattern);

/* ---------- state ---------- */
const ctl = {
  mode: null, state: null, names: [], users: [], levels: [], me: 0,
  running: false, paused: false, busy: false, look: false, peeking: false, waiting: false,
  match: 0, shownSeq: -1, endShown: false, rewarded: false, receipt: null, gen: 0,
  pendingPeg: null, lastTurn: null, aiTimer: 0, scores: [],
};
let room = null, table = null,stageLarge=false,stageEpoch=0,raceTimer=0;
const fx = Array.from({ length: PEGS.COUNT }, () => ({}));
let particles = [], scan = null, hover = -1;

/* ---------- the board: flat first, then the 3D table as soon as it has loaded ---------- */
const flatCanvas = $('pegsBoard'), flat = createPegsBoard(flatCanvas);
let stage = flat;
$('pegsDie').hidden = false; // the flat board's die, until the 3D table (with its own die) is ready
function flatResize() { if (stage !== flat) return; const r = $('pegsStage').getBoundingClientRect(); if (r.width > 10 && r.height > 10) { flat.resize(Math.floor(r.width), Math.floor(r.height)); render(); } }
if (typeof ResizeObserver === 'function') new ResizeObserver(flatResize).observe($('pegsStage'));
addEventListener('resize', flatResize, { passive: true });
async function upgrade3d() {
  const ticket=++stageEpoch,large=stageLarge;
  if (params.has('flat')) return;
  try {
    const mod = await import('./stage3d.js?v=33.11.1');
    if (!mod.webglAvailable()) return;
    const s3 = mod.createPegsStage3D({large});
    if(ticket!==stageEpoch){s3.dispose?.();return;}
    s3.onLost = () => { ctl.gen++;tweens.clear();resetFx();ctl.busy=false;ctl.waiting=false;ctl.pendingPeg=null;stage = flat; $('pegsStage').classList.remove('is-3d'); $('pegsHero').classList.remove('is-3d'); $('pegsDie').hidden = false; s3.canvas.remove(); s3.overlay.remove(); flatResize(); };
    s3.onLand = (c, last) => { play('diceImpact', last ? 0.6 : 0.4); };
    stage = s3; $('pegsDie').hidden = true;
    if (ctl.running) { $('pegsStage').classList.add('is-3d'); s3.attach($('pegsStage')); }
    else { $('pegsHero').classList.add('is-3d'); s3.attach($('pegsHero'), { idle: true }); }
    render();
  } catch (error) { console.warn('pegs 3d unavailable', error); }
}
if (typeof IntersectionObserver === 'function') new IntersectionObserver(([e]) => stage.hold?.(!e.isIntersecting)).observe($('pegsHero'));

const tweens = new Set();
/** Moves numbers on `target` toward `props`; resolves on time even when no frame is drawn (a hidden tab). */
function tween(target, props, ms, ease = easeOut) {
  ms = reduce ? Math.min(ms, 120) : ms;
  const tw = { target, from: {}, props, start: performance.now(), ms, ease };
  for (const k in props) tw.from[k] = Number(target[k]) || 0;
  tweens.add(tw); kick();
  return new Promise((ok) => setTimeout(() => { if (tweens.delete(tw)) Object.assign(target, props); ok(); }, ms));
}
function stepTweens(t) {
  for (const tw of tweens) { const k = Math.min(1, Math.max(0, (t - tw.start) / tw.ms)), e = tw.ease(k); for (const key in tw.props) tw.target[key] = tw.from[key] + (tw.props[key] - tw.from[key]) * e; }
}
let raf = 0;
function kick() { if (!raf && ctl.running && !document.hidden) raf = requestAnimationFrame(frame); }
// a still table is drawn 30 times a second, a moving one every frame
let lastDraw = 0;
function frame(t) {
  raf = 0; if (!ctl.running) return;
  if (tweens.size || particles.length || scan || ctl.look || stage.animating || t - lastDraw > 32) { lastDraw = t; render(t); }
  if (!document.hidden) raf = requestAnimationFrame(frame);
}
function render(t = performance.now()) {
  const s = ctl.state; if (!s || !ctl.running) return;
  stepTweens(t);
  const picking = canPick() || (ctl.peeking && canAct());
  for (let i = 0; i < fx.length; i++) {
    const f = fx[i];
    if (f.verdict) { f.ring = f.verdict; continue; }
    f.ring = picking && s.pegs[i].taken === null ? (i === hover ? (ctl.peeking ? '#5fd4ff' : '#ffc94d') : 'rgba(255,244,224,.28)') : null;
  }
  stage.die?.ready(canRoll());
  stage.draw({ pegs: s.pegs, fx, particles, time: t, scan, hover: picking ? hover : -1 });
  if (particles.length) particles = particles.filter((p) => t - p.start < p.life);
  paintTimer();
}
function resetFx() { for (const f of fx) for (const k of Object.keys(f)) delete f[k]; particles = []; scan = null; }

/* ---------- who may do what ---------- */
const isHuman = (seat) => (ctl.mode === 'online' ? seat === ctl.me : ctl.mode === 'ai' ? seat === 0 : true);
function canAct() {
  const s = ctl.state;
  if (!s || !ctl.running || ctl.paused || ctl.busy || ctl.look || ctl.waiting || s.winner !== null) return false;
  // online, nothing is pressed while steps of the room are still being shown
  if(ctl.state?.race&&Date.now()+(ctl.mode==='online'?Number(room?.serverNow||Date.now())-Number(room?.clientReceivedAt||Date.now()):0)<ctl.state.race.cooldownUntil)return false;
  if (ctl.mode === 'online' && (room?.status !== 'playing' || ctl.connected===false || table?.busy)) return false;
  return isHuman(s.turn);
}
const canRoll = () => canAct() && ctl.state.phase === 'roll' && !ctl.peeking;
const canPick = () => canAct() && ctl.state.phase === 'pick' && !ctl.peeking;
const canPeek = () => canAct() && (ctl.state.players[ctl.state.turn]?.peeks || 0) > 0;

/* ---------- the players ---------- */
function myUser() { const me = window.BS_SOCIAL?.isLoggedIn?.() ? window.BS_SOCIAL.profile?.() : null; return me ? { username: me.username, photo: me.photo || null } : null; }
function faceOf(seat) {
  const user = ctl.users[seat], P = window.BS_PROFILE_PRO, self = ctl.mode !== 'hotseat' && seat === (ctl.mode === 'online' ? ctl.me : 0);
  if (P && (user?.username || user?.photo || user?.fallback)) { try { return P.avatar({ username: user.username || '', photo: user.photo || null, name: ctl.names[seat], fallback: user.fallback || '', self }); } catch {} }
  if (user?.fallback) return Object.assign(document.createElement('img'), { src: user.fallback, alt: '', loading: 'lazy' });
  return Object.assign(document.createElement('span'), { className: 'pg-letter', textContent: String(ctl.names[seat] || '؟').trim().slice(0, 1) });
}
function avatarOf(seat) {
  const box = document.createElement('div'); box.className = 'pg-avatar';
  const face = document.createElement('span'); face.className = 'pg-face'; face.append(faceOf(seat));
  box.append(face);
  box.insertAdjacentHTML('beforeend', '<svg class="pg-timer" viewBox="0 0 50 50" aria-hidden="true"><circle class="run" cx="25" cy="25" r="23"/></svg>');
  return box;
}
function dot(c, fresh = false) { const i = document.createElement('i'); i.style.setProperty('--c', PEG_COLORS[c]?.hex || '#999'); if (fresh) i.className = 'new'; i.title = colorName(c); return i; }
function buildSeats() {
  const host = $('players'), s = ctl.state; if (!s) return;
  host.replaceChildren(); host.dataset.n = String(s.players.length);
  ctl.scores = s.players.map((p) => p.score);
  s.players.forEach((p, seat) => {
    const card = document.createElement('div'); card.className = 'pg-seat'; card.id = 'chip' + seat; card.style.setProperty('--seat', SEATS[seat]);
    if (ctl.mode === 'online') { card.dataset.playerTag = String(seat); card.tabIndex = 0; }
    const name = Object.assign(document.createElement('div'), { className: 'pg-seat-name', textContent: ctl.names[seat] || 'لاعب' });
    const score = Object.assign(document.createElement('div'), { className: 'pg-seat-score', textContent: String(p.score) });
    const tray = document.createElement('div'); tray.className = 'pg-tray'; tray.setAttribute('aria-label', 'القطع اللي أخذها');
    for (const c of p.pegs) tray.append(dot(c));
    const badges = document.createElement('span'); badges.className = 'pg-badges';
    card.append(avatarOf(seat), name, score, tray, badges); host.append(card);
  });
  if (!window.BS_PROFILE_PRO && !buildSeats.retried) { buildSeats.retried = true; setTimeout(() => { if (ctl.state && ctl.running) buildSeats(); }, 1600); }
  renderSeats();
}
function renderSeats() {
  const s = ctl.state; if (!s) return;
  s.players.forEach((p, seat) => {
    const card = $('chip' + seat); if (!card) return;
    const active = s.winner === null && (s.race||s.turn === seat) && !ctl.look;
    card.classList.toggle('active', active);
    card.classList.toggle('hot', active && p.streak >= PEGS.HOT);
    const score = card.querySelector('.pg-seat-score');
    if (p.score !== ctl.scores[seat]) { score.textContent = String(p.score); score.classList.remove('bump'); void score.offsetWidth; score.classList.add('bump'); ctl.scores[seat] = p.score; }
    const tray = card.querySelector('.pg-tray');
    if (p.pegs.length !== tray.children.length) { if (p.pegs.length < tray.children.length) tray.replaceChildren(); for (let k = tray.children.length; k < p.pegs.length; k++) tray.append(dot(p.pegs[k], true)); }
    const list = [];
    if (active) list.push(['pg-turn', isHuman(seat) && ctl.mode !== 'hotseat' ? 'دورك' : 'دوره']);
    if(s.teams)list.push(['pg-team','الفريق '+(seat%(s.players.length/2)+1)]);
    if(s.race)list.push(['pg-race-score',p.pegs.length+' / '+s.race.goal]);
    if (p.streak >= 2) list.push(['pg-flame', '🔥' + p.streak]);
    card.querySelector('.pg-badges').replaceChildren(...list.map(([cls, text]) => Object.assign(document.createElement('span'), { className: cls, textContent: text })));
  });
}
/** The turn clock as a ring round the face of whoever is playing (online). */
function paintTimer() {
  const s = ctl.state; if (!s) return;
  if(s.race){const t=ctl.mode==='online'?(Number(room?.serverNow)||Date.now())+(Date.now()-(Number(room?.clientReceivedAt)||Date.now())):Date.now(),remaining=Math.max(0,Math.ceil((s.race.endsAt-t)/1000));$('pegsRaceClock').hidden=false;$('pegsRaceClock').textContent=Math.floor(remaining/60)+':'+String(remaining%60).padStart(2,'0');$('pegsRoll').disabled=!canRoll();$('pegsPeek').disabled=!(canPeek()||ctl.peeking);}else $('pegsRaceClock').hidden=true;
  const live = !s.race && ctl.mode === 'online' && room?.status === 'playing' && room.turnDeadline && !room.stepOf && s.winner === null && !ctl.look && !ctl.busy;
  const got = Number(room?.clientReceivedAt) || Date.now(), now = (Number(room?.serverNow) || got) + (Date.now() - got);
  s.players.forEach((_, seat) => {
    const card = $('chip' + seat), run = card?.querySelector('.pg-timer .run'); if (!run) return;
    const on = live && s.turn === seat, total = Number(room?.turnTotal) || 20000, left = on ? Math.max(0, Number(room.turnDeadline) - now) : 0;
    run.style.strokeDashoffset = String(on ? 144.5 * (1 - Math.min(1, left / total)) : 144.5);
    card.classList.toggle('urgent', on && left < 5000);
  });
}

/* ---------- the status line and the dock ---------- */
function renderStatus() {
  const s = ctl.state, out = $('pegsStatus'); if (!s) return;
  const name = ctl.names[s.turn] || 'لاعب', mine = isHuman(s.turn), hot = ctl.mode === 'hotseat';
  const parts = [];
  if (ctl.look) parts.push('احفظ الألوان قبل ما تختفي');
  else if (s.winner !== null) parts.push('انتهت الجولة');
  else if(s.race&&s.last?.type==='pick'&&!s.last.ok&&s.race.cooldownUntil>Date.now()+(ctl.mode==='online'?Number(room?.serverNow||Date.now())-Number(room?.clientReceivedAt||Date.now()):0))parts.push('ثانيتان وتكمل');
  else if (ctl.peeking) parts.push('اختر قطعة تشوف لونها بالسر');
  else if (s.phase === 'roll') parts.push(mine ? (hot ? 'دور ' + name + ': ارمِ النرد' : 'دورك: ارمِ النرد') : 'دور ' + name);
  else { parts.push(mine ? (hot ? name + ': اقلب قطعة ' : 'اقلب قطعة ') : name + ' يدوّر على '); parts.push(gem(s.die)); parts.push(colorName(s.die)); }
  out.replaceChildren(...parts.map((p) => (typeof p === 'string' ? document.createTextNode(p) : p)));
  $('pegsLeft').textContent = String(s.pegs.filter((p) => p.taken === null).length);
  // the dock shows the one thing to do now
  const action = $('pegsAction'), target = $('pegsTarget'), hint = $('pegsHint');
  let state = 'wait';
  if (ctl.look) state = 'look';
  else if (s.winner !== null) { target.replaceChildren(Object.assign(document.createElement('span'), { textContent: 'انتهت الجولة' })); }
  else if (s.phase === 'pick') {
    state = mine ? 'pick' : 'wait';
    const line = document.createElement('span'); line.append(document.createTextNode(mine ? 'دوّر على ' : name + ' يدوّر على '), document.createTextNode(colorName(s.die)));
    const sub = Object.assign(document.createElement('small'), { textContent: mine ? (ctl.peeking ? 'اضغط قطعة تشوفها بالسر' : 'اضغط على القطعة اللي تتوقعها') : 'ركّز وين يقلب' });
    const text = document.createElement('div'); text.append(line, sub);
    target.replaceChildren(gem(s.die), text);
  } else if (canRoll() || (mine && (ctl.busy || ctl.waiting))) state = 'roll';
  else { const text = document.createElement('div'); text.append(Object.assign(document.createElement('span'), { textContent: 'دور ' + name }), Object.assign(document.createElement('small'), { textContent: 'تابع وين تنقلب القطع' })); target.replaceChildren(text); }
  action.dataset.state = state;
  $('pegsRoll').disabled = !canRoll();
  hint.textContent = s.race?'سباق متزامن · أول '+s.race.goal+' قطعة يفوز':s.teams?'القطع تُجمع لفريقك · اضغط رأس القطعة':'اضغط رأس القطعة للاختيار الدقيق';
  // the flat board's die
  const die = $('pegsDie'); die.disabled = !canRoll(); die.classList.toggle('ready', canRoll());
  const peek = $('pegsPeek'), mineSeat = ctl.mode === 'online' ? ctl.me : ctl.mode === 'ai' ? 0 : s.turn, left = s.players[mineSeat]?.peeks || 0;
  peek.disabled = !(canPeek() || ctl.peeking); peek.setAttribute('aria-pressed', String(ctl.peeking));
  $('pegsPeekLeft').textContent = left > 0 ? 'مرة وحدة' : 'استخدمتها';
  $('pegsStage').classList.toggle('pick', canPick() || ctl.peeking);
  if (s.phase === 'roll' && !ctl.busy && !ctl.waiting) stage.die?.clear();
}
function renderAll() { renderSeats(); renderStatus(); render(); }

let bannerTimer = 0;
function banner(text, kind = '', color = '') {
  const b = $('pegsBanner'); clearTimeout(bannerTimer);
  b.hidden = true; void b.offsetWidth; b.className = 'pg-banner' + (kind ? ' ' + kind : ''); b.style.setProperty('--b', color || '');
  b.textContent = text; b.hidden = false; bannerTimer = setTimeout(() => { b.hidden = true; }, 1300);
}
function announceTurn() {
  const s = ctl.state; if (!s || s.winner !== null || ctl.look) return;
  if (ctl.lastTurn === s.turn) return; ctl.lastTurn = s.turn;
  if (ctl.mode === 'hotseat') { banner('دور ' + (ctl.names[s.turn] || 'لاعب'), '', SEATS[s.turn]); play('yourTurn', 0.5); }
  else if (isHuman(s.turn)) { banner('دورك!', '', SEATS[s.turn]); play('yourTurn', 0.55); buzz(20); }
}

/* ---------- the colour die (the flat board's CSS cube; the 3D table has its own) ---------- */
const FACE_TURN = [[0, 0], [0, -90], [0, 180], [0, 90], [-90, 0], [90, 0]];
const cssDie = { x: 0, y: 0 };
function cssDieTo(c, quick = false) {
  pegsDiePalette(c).forEach((color,i)=>{const side=$('pegsCube').querySelector('.s'+i);if(side){side.style.setProperty('--c',PEG_COLORS[color].hex);side.replaceChildren(gem(color));}});
  const cube = $('pegsCube'), [tx, ty] = FACE_TURN[pegsDieFace(c)];
  const turns = quick ? 1 : 2, nx = Math.round((cssDie.x - tx) / 360 + turns + 0.5) * 360 + tx, ny = Math.round((cssDie.y - ty) / 360 + turns) * 360 + ty;
  cube.classList.remove('spin'); cube.classList.toggle('quick', quick);
  cssDie.x = nx; cssDie.y = ny; cube.style.transform = 'rotateX(' + nx + 'deg) rotateY(' + ny + 'deg)';
  return wait(reduce ? 150 : quick ? 450 : 900);
}
function dieSpin() { if (stage.die) stage.die.spin(); else $('pegsCube').classList.add('spin'); }
function dieStop() { stage.die?.stop(); $('pegsCube').classList.remove('spin'); }
function dieShow(c) { if (stage.die) stage.die.show(c); else cssDieTo(c, true); }

/* ---------- effects ---------- */
function burst(i, c) {
  const m = stage.middle(i), col = PEG_COLORS[c]?.hex || '#fff', t = performance.now();
  for (let k = 0; k < 34; k++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, v = 120 + Math.random() * 240;
    particles.push({ x: m.x, y: m.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, start: t + Math.random() * 60, life: 700 + Math.random() * 500, size: 4 + Math.random() * 5, color: k % 3 ? col : '#ffe08a', spin: Math.random() - 0.5, round: k % 2 === 0 });
  }
  kick();
}
function float(i, text, color) {
  const m = stage.middle(i), size = Math.max(22, stage.size.pawn * 0.55);
  particles.push({ x: m.x, y: m.y - size * 1.2, vx: 0, vy: -70, fall: 0, start: performance.now(), life: 1100, size, text, color }); kick();
}
function confetti() {
  const { W } = stage.size, t = performance.now();
  for (let k = 0; k < 110; k++) particles.push({ x: Math.random() * W, y: -10, vx: (Math.random() - 0.5) * 80, vy: 60 + Math.random() * 120, start: t + Math.random() * 700, life: 1800 + Math.random() * 900, size: 6 + Math.random() * 6, color: PEG_COLORS[k % 6].hex, spin: Math.random() - 0.5, fall: 0.5 });
  kick();
}

/* ---------- the opening look ---------- */
async function runLook(ms) {
  const gen = ctl.gen, s = ctl.state;
  if (ms < 600 || !s.pegs.some((p) => p.c >= 0)) { hideColors(); return; }
  ctl.look = true; renderAll();
  const { cx, cy } = stage.size;
  const order = s.pegs.map((p, i) => i).sort((a, b) => Math.atan2(stage.foot(a).y - cy, stage.foot(a).x - cx) - Math.atan2(stage.foot(b).y - cy, stage.foot(b).x - cx));
  sfx('look', 0.7);
  order.forEach((i, k) => { fx[i].color = s.pegs[i].c; setTimeout(() => { if (gen === ctl.gen) tween(fx[i], { lift: 0.36, tip: 0.9 }, 440, easeBack); }, reduce ? 0 : k * 28); });
  const ring = $('pegsLookRing'), n = $('pegsLookN'), end = performance.now() + ms;
  let shown = -1;
  while (performance.now() < end - 650) {
    if (gen !== ctl.gen) return;
    const left = end - performance.now(), sec = Math.ceil(left / 1000);
    ring.style.strokeDashoffset = String(119.4 * (1 - left / ms));
    if (sec !== shown) { shown = sec; n.textContent = String(sec); if (sec <= 3) sfx('tick', 0.55); }
    await wait(80);
  }
  if (gen !== ctl.gen) return;
  sfx('hide', 0.6);
  order.forEach((i, k) => setTimeout(() => { if (gen === ctl.gen) tween(fx[i], { lift: 0, tip: 0 }, 320, easeIn); }, reduce ? 0 : k * 14));
  await wait(Math.max(0, end - performance.now()) + 140);
  if (gen !== ctl.gen) return;
  ring.style.strokeDashoffset = '0';
  for (const f of fx) { delete f.color; f.lift = 0; f.tip = 0; }
  hideColors(); ctl.look = false;
}
/** Online, the colours the room showed for the look are forgotten once it ends. */
function hideColors() { if (ctl.mode === 'online' && ctl.state) ctl.state = { ...ctl.state, pegs: ctl.state.pegs.map((p) => (p.taken === null ? { ...p, c: -1 } : p)) }; }

/* ---------- one step, shown ---------- */
async function present(next, mine) {
  const L = next.last; if (!L) return;
  if (L.type === 'roll') await showRoll(L, mine);
  else if (L.type === 'pick') await showPick(next, L, mine);
  else if (L.type === 'peek') await showPeek(next, L, mine);
}
async function showRoll(L, mine) {
  const gen = ctl.gen;
  if (!mine || !ctl.waiting) play('dice', 0.7);
  if (stage.die) {
    dieStop();
    if (L.faces.length > 1) setTimeout(() => { if (gen === ctl.gen) banner('خلص ال' + colorName(L.faces[0]) + '، نرمي مرة ثانية', '', PEG_COLORS[L.faces[0]].hex); }, 950);
    await stage.die.roll(L.faces);
  } else {
    dieStop();
    for (let k = 0; k < L.faces.length; k++) {
      await cssDieTo(L.faces[k], k > 0); if (gen !== ctl.gen) return;
      play('diceImpact', 0.55);
      if (k < L.faces.length - 1) { banner('خلص ال' + colorName(L.faces[k]) + '، نرمي مرة ثانية', '', PEG_COLORS[L.faces[k]].hex); await wait(260); play('dice', 0.5); }
    }
  }
  if (gen !== ctl.gen) return;
  await wait(160);
}
async function scanTo(i, seat) {
  const free = ctl.state.pegs.map((p, k) => (p.taken === null && k !== i ? k : -1)).filter((k) => k >= 0);
  const path = [...free.sort(() => Math.random() - 0.5).slice(0, 2), i], gen = ctl.gen;
  const first = stage.middle(path[0]); scan = { x: first.x, y: first.y, color: SEATS[seat] };
  for (const k of path) { const m = stage.middle(k); await tween(scan, { x: m.x, y: m.y }, 140); if (gen !== ctl.gen) return; }
  await wait(80); scan = null;
}
async function showPick(next, L, mine) {
  const gen = ctl.gen, i = L.peg, f = fx[i], early = ctl.pendingPeg === i;
  ctl.pendingPeg = null;
  if (!mine && !early) await scanTo(i, L.seat);
  if (gen !== ctl.gen) return;
  f.top = true; f.color = L.color;
  if (!early) sfx('lift', 0.7);
  await tween(f, { lift: 0.62 }, early ? 80 : 170);
  await tween(f, { tip: 1 }, 260);
  if (gen !== ctl.gen) return;
  if (L.ok) {
    const col = PEG_COLORS[L.color].hex;
    sfx('right', 0.8); buzz(14); f.glow = col; f.verdict = col; burst(i, L.color); float(i, '+' + L.gained, L.gained > 1 ? '#ffb23f' : '#fff4e0');
    if (!ctl.state?.race&&!ctl.state?.teams&&L.streak === PEGS.HOT) { sfx('streak', 0.75); banner('🔥 حامي! كل قطعة بنقطتين', 'hot'); }
    else if (L.streak > PEGS.HOT) banner('🔥 ' + L.streak + ' ورا بعض', 'hot');
    await wait(300); if (gen !== ctl.gen) return;
    await flyToSeat(i, L.seat);
  } else {
    sfx('wrong', 0.75); buzz([30, 40, 30]); f.mark = '✕'; f.verdict = '#ff5b5b';
    for (const dx of [9, -9, 6, -6, 3, 0]) { await tween(f, { dx }, 60); if (gen !== ctl.gen) return; }
    await wait(460); if (gen !== ctl.gen) return;
    delete f.mark; delete f.verdict;
    await tween(f, { tip: 0 }, 220); sfx('place', 0.6);
    await tween(f, { lift: 0 }, 180, easeIn);
    delete f.color; f.top = false;
    if (L.swapped) await showSwap(L.swapped);
  }
}
async function flyToSeat(i, seat) {
  const f = fx[i], card = $('chip' + seat), cr = (stage.is3d ? $('pegsStage') : flatCanvas).getBoundingClientRect();
  const start = stage.foot(i), from = stage.toBoard(start.x, start.y);
  let to = { x: from.x, y: from.y - 1.4, h: 0.8 };
  if (card) { const r = card.querySelector('.pg-avatar')?.getBoundingClientRect() || card.getBoundingClientRect(); to = stage.toBoard(r.left + r.width / 2 - cr.left, r.top + r.height / 2 - cr.top, 0.9); }
  f.at = { x: from.x, y: from.y, h: 0 };
  await Promise.all([tween(f.at, to, 460, easeIn), tween(f, { scale: 0.45, alpha: 0.15, lift: 0.4 }, 460, easeIn)]);
  sfx('place', 0.35);
}
async function showSwap([a, b]) {
  const gen = ctl.gen, A = stage.foot(a), B = stage.foot(b), pa = stage.toBoard(A.x, A.y), pb = stage.toBoard(B.x, B.y);
  banner('تبادلت قطعتين مكانهم!', '', '#5fd4ff'); sfx('swap', 0.7);
  for (const [k, from] of [[a, pa], [b, pb]]) { fx[k].at = { x: from.x, y: from.y, h: 0 }; fx[k].glow = '#5fd4ff'; fx[k].top = true; }
  await Promise.all([tween(fx[a], { lift: 0.55 }, 200), tween(fx[b], { lift: 0.55 }, 200)]);
  await Promise.all([tween(fx[a].at, { x: pb.x, y: pb.y }, 540), tween(fx[b].at, { x: pa.x, y: pa.y }, 540)]);
  if (gen !== ctl.gen) return;
  await Promise.all([tween(fx[a], { lift: 0 }, 180, easeIn), tween(fx[b], { lift: 0 }, 180, easeIn)]);
  for (const k of [a, b]) { delete fx[k].at; delete fx[k].glow; fx[k].top = false; }
}
async function showPeek(next, L, mine) {
  const gen = ctl.gen, i = L.peg, f = fx[i];
  const seen = next.peek && next.peek.peg === i && next.peek.c >= 0 && (ctl.mode !== 'online' || next.peek.seat === ctl.me) ? next.peek.c : -1;
  ctl.pendingPeg = null;
  sfx('peek', 0.7); f.top = true; f.color = seen; f.glow = '#5fd4ff';
  $('pegsBanner').hidden=true;
  const notice=$('pegsPeekNotice');if(notice){notice.textContent=mine?'عين الصقر · اللون ظاهر لك وحدك':(ctl.names[L.seat]||'لاعب')+' يستخدم عين الصقر';notice.hidden=false;}
  await tween(f, { lift: 0.5 }, 180); await tween(f, { tip: 0.95 }, 200);
  await wait(mine && ctl.mode !== 'online' ? 1100 : 560); if (gen !== ctl.gen) return;
  await tween(f, { tip: 0, lift: 0 }, 240, easeIn);
  delete f.color; delete f.glow; f.top = false;
  if(notice)notice.hidden=true;
}

/* ---------- local games ---------- */
async function act(make) {
  if (ctl.busy || !ctl.state) return;
  let next; try { next = make(ctl.state); } catch { return; }
  ctl.busy = true; renderStatus();
  const gen = ctl.gen;
  await present(next, isHuman(next.last?.seat ?? next.turn));
  if (gen !== ctl.gen) return;
  ctl.state = ctl.raceState?publicPegsRace(ctl.raceState,0):next; resetFx(); ctl.busy = false;
  afterStep();
}
function afterStep() {
  renderAll();
  const s = ctl.state; if (!s) return;
  if (s.winner !== null) { finish(); return; }
  announceTurn();
  if(ctl.raceState)return;
  if (ctl.mode === 'ai' && s.turn !== 0) thinkLater();
}
function thinkLater() {
  clearTimeout(ctl.aiTimer);
  const gen = ctl.gen, s = ctl.state, delay = s.phase === 'roll' ? 600 + Math.random() * 450 : 450 + Math.random() * 650;
  ctl.aiTimer = setTimeout(() => {
    if (gen !== ctl.gen || ctl.paused || !ctl.running || ctl.busy || ctl.look) return;
    const now = ctl.state, move = choosePegsMove(now, ctl.levels[now.turn] || 'medium');
    act((st) => (move.type === 'roll' ? rollPegs(st, st.turn) : pickPegs(st, st.turn, move.peg)));
  }, delay);
}
function startLocal(mode) {
  primeSound();
  let n = mode === 'ai' ? 1 + Math.max(1, Math.min(5, Number(prefs.rivals) || 1)) : Math.max(2, Math.min(6, Number(prefs.local) || 2));
  if(prefs.variant==='teams')n=n>4?6:4;
  const meName = window.BS_GAME_MENU?.playerName?.() || 'أنت';
  ctl.names = mode === 'ai' ? [meName, ...Array.from({ length: n - 1 }, (_, k) => (n === 2 ? 'الكمبيوتر' : 'الكمبيوتر ' + (k + 1)))] : Array.from({ length: n }, (_, k) => 'اللاعب ' + (k + 1));
  ctl.users = mode === 'ai' ? [myUser(), ...HEROES.slice(0, n - 1).map((h) => ({ fallback: '/assets/heroes/face/' + h + '.webp' }))] : ctl.names.map(() => null);
  ctl.levels = ctl.names.map((_, k) => (mode === 'ai' && k > 0 ? prefs.level : null));
  let state;ctl.raceState=null;clearTimeout(raceTimer);
  if(prefs.variant.startsWith('race')&&mode==='ai'){ctl.raceState=createPegsRace(ctl.names,{...pegsOptions(prefs.variant),showMs:(Number(prefs.look)||7)*1000});state=publicPegsRace(ctl.raceState,0);}else state = createPegsGame(ctl.names, { ...pegsOptions(prefs.variant),showMs: (Number(prefs.look) || 7) * 1000, swaps: Boolean(prefs.swaps), first: mode === 'ai' ? 0 : null });
  state.salt = Math.floor(Math.random() * 1e6);
  begin(mode, state);
  const gen = ctl.gen;
  ctl.receipt = 'pegs:' + Date.now().toString(36) + ':' + Math.floor(Math.random() * 1e9).toString(36);
  if(ctl.raceState)raceTimer=setTimeout(raceThink,1900);
  runLook(state.showMs).then(() => { if (gen === ctl.gen && ctl.state) { renderAll(); banner(mode === 'hotseat' ? 'يبدأ ' + ctl.names[state.turn] : 'أنت تبدأ!', '', SEATS[state.turn]); ctl.lastTurn = state.turn; play('go', 0.5); afterStep(); } });
}
function configureBoard(state){
  const large=state.pegs.length>24;
  while(fx.length<state.pegs.length)fx.push({});fx.length=state.pegs.length;
  if(stageLarge!==large){stageLarge=large;stageEpoch++;if(stage!==flat)stage.dispose?.();stage=flat;flat.setLayout?.(large);$('pegsStage').classList.remove('is-3d');$('pegsHero').classList.remove('is-3d');$('pegsDie').hidden=false;upgrade3d();}
  $('pegsGame').classList.toggle('pg-large',large);$('pegsGame').classList.toggle('pg-race',state.mode==='race');
}
function begin(mode, state) {
  configureBoard(state);
  ctl.gen++; clearTimeout(ctl.aiTimer); tweens.clear(); resetFx();
  Object.assign(ctl, { mode, state, running: true, paused: false, busy: false, look: false, peeking: false, waiting: false, endShown: false, rewarded: false, pendingPeg: null, lastTurn: null, shownSeq: state.seq });
  hover = -1; dieStop(); stage.die?.clear();
  showGame(); buildSeats(); renderAll();
}

/* ---------- moves from the player ---------- */
function doRoll() {
  if (!canRoll()) return;
  primeSound();
  if (ctl.mode === 'online') { if (!table?.send('pegs_roll',ctl.state.race?{seq:ctl.state.seq}:{})) return; ctl.waiting = true; dieSpin(); play('dice', 0.7); renderStatus(); return; }
  if(ctl.raceState)return raceAct({type:'pegs_roll'});
  act((s) => rollPegs(s, s.turn));
}
function doPick(i) {
  if (ctl.peeking) return doPeek(i);
  if (!canPick() || ctl.state.pegs[i]?.taken !== null) return;
  if (ctl.mode === 'online') {
    if (!table?.send('pegs_pick', { peg: i,...(ctl.state.race?{seq:ctl.state.seq}:{}) })) return;
    ctl.waiting = true; ctl.pendingPeg = i; fx[i].top = true; sfx('lift', 0.7); tween(fx[i], { lift: 0.4 }, 150); renderStatus(); return;
  }
  if(ctl.raceState)return raceAct({type:'pegs_pick',peg:i});
  act((s) => pickPegs(s, s.turn, i));
}
function doPeek(i) {
  if (!canPeek() || ctl.state.pegs[i]?.taken !== null) return;
  ctl.peeking = false;
  if (ctl.mode === 'online') { if (!table?.send('pegs_peek', { peg: i,...(ctl.state.race?{seq:ctl.state.seq}:{}) })) { renderStatus(); return; } ctl.waiting = true; ctl.pendingPeg = i; renderStatus(); return; }
  if(ctl.raceState)return raceAct({type:'pegs_peek',peg:i});
  act((s) => peekPegs(s, s.turn, i));
}
function raceAct(msg){
  act(()=>{ctl.raceState=playPegsRace(ctl.raceState,0,{...msg,seq:ctl.raceState.runs[0].seq});return publicPegsRace(ctl.raceState,0);});
}
function raceThink(){
  if(!ctl.raceState||!ctl.running)return;
  if(!ctl.paused){ctl.raceState=advancePegsRace(ctl.raceState);for(let seat=1;seat<ctl.names.length&&ctl.raceState.winner===null;seat++){const move=choosePegsRaceMove(ctl.raceState,seat,prefs.level);if(move)ctl.raceState=playPegsRace(ctl.raceState,seat,move);}
    if(!ctl.busy){ctl.state=publicPegsRace(ctl.raceState,0);renderAll();if(ctl.state.winner!==null)finish();}else{ctl.state.players=publicPegsRace(ctl.raceState,0).players;renderSeats();}}
  if(ctl.raceState.winner===null)raceTimer=setTimeout(raceThink,1900);
}
function pointer(e) { const r = (stage.is3d ? $('pegsStage') : flatCanvas).getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
const stageEl = $('pegsStage');
// 33.10.7: no screenshots of the colours (see guard.js)
guardPegs(stageEl, { toast: (m) => window.BS_PLATFORM?.toast?.(m) });
stageEl.addEventListener('pointermove', (e) => { if (!ctl.state || e.pointerType === 'touch') return; const p = pointer(e), i = canPick() || ctl.peeking ? stage.hit(p.x, p.y, ctl.state.pegs) : -1; if (i !== hover) { hover = i; render(); } });
stageEl.addEventListener('pointerleave', () => { hover = -1; render(); });
stageEl.addEventListener('click', (e) => {
  if (!ctl.state || e.target.closest('.pg-banner')) return;
  const p = pointer(e);
  if (stage.is3d && canRoll() && stage.hitDie(p.x, p.y)) { doRoll(); return; }
  const i = stage.hit(p.x, p.y, ctl.state.pegs); if (i >= 0) { hover = i; doPick(i); }
});
// the keyboard: ← → to move between the pieces, Enter to turn one over, Space or R to roll
document.addEventListener('keydown', (e) => {
  const s = ctl.state; if (!s || !ctl.running || e.target.closest?.('input,textarea,button,a,summary') || !(canPick() || ctl.peeking)) return;
  const free = s.pegs.map((p, i) => (p.taken === null ? i : -1)).filter((i) => i >= 0);
  if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && free.length) { e.preventDefault(); const at = free.indexOf(hover), step = e.key === 'ArrowLeft' ? 1 : -1; hover = free[(at + step + free.length) % free.length] ?? free[0]; render(); }
  else if (e.key === 'Enter' && hover >= 0) { e.preventDefault(); doPick(hover); }
});
document.addEventListener('keydown', (e) => {
  if (!ctl.running || e.target.closest?.('input,textarea')) return;
  if ((e.key === ' ' || e.key.toLowerCase() === 'r') && canRoll()) { e.preventDefault(); doRoll(); }
});
$('pegsDie').addEventListener('click', doRoll);
$('pegsRoll').addEventListener('click', doRoll);
$('pegsPeek').addEventListener('click', () => { if (ctl.peeking) { ctl.peeking = false; } else if (canPeek()) { ctl.peeking = true; sfx('peek', 0.35); } renderAll(); });

/* ---------- the end ---------- */
function finish() {
  if (ctl.endShown || !ctl.state) return; ctl.endShown = true;
  const s = ctl.state, me = ctl.mode === 'online' ? ctl.me : 0, w = s.winner;
  const tie = s.ties.length > 1 && s.ties.includes(me) && ctl.mode !== 'hotseat';
  const won = ctl.mode === 'hotseat' || (s.teams?s.winnerTeam>=0&&me%(s.players.length/2)===s.winnerTeam:w===me);
  if(s.teams)$('pegsWinner').textContent=s.winnerTeam<0?'تعادل الفرق':'الفريق '+(s.winnerTeam+1)+' فاز!';
  $('pegsWinner').textContent = ctl.mode === 'hotseat' ? (s.ties.length > 1 ? 'تعادل!' : ctl.names[w] + ' فاز!') : tie ? 'تعادل!' : won ? 'فزت!' : (ctl.names[w] || 'المنافس') + ' فاز';
  if(s.teams)$('pegsWinner').textContent=s.winnerTeam<0?'تعادل الفرق':'الفريق '+(s.winnerTeam+1)+' فاز!';
  $('pegsResultKicker').textContent = ctl.mode === 'hotseat' ? 'انتهت الجولة' : won || tie ? 'ذاكرة حديد' : 'قربت، المرة الجاية لك';
  document.querySelector('.pg-result').classList.toggle('lost', !won && !tie);
  const rows = s.players.map((p, i) => ({ ...p, i })).sort((a, b) => b.score - a.score || b.best - a.best);
  const order = rows.length >= 3 ? [rows[1], rows[0], rows[2], ...rows.slice(3)] : rows.length === 2 ? [rows[1], rows[0]] : rows;
  $('pegsPodium').replaceChildren(...order.map((p) => {
    const rank = rows.indexOf(p) + 1, step = document.createElement('div');
    step.className = 'pg-step r' + rank + (rank === 1 ? ' first' : ''); step.style.setProperty('--seat', SEATS[p.i]);
    const crown = Object.assign(document.createElement('span'), { className: 'pg-crown', textContent: rank === 1 ? '👑' : '' });
    const name = Object.assign(document.createElement('b'), { textContent: ctl.names[p.i] || 'لاعب' });
    const block = document.createElement('div'); block.className = 'pg-block';
    block.append(Object.assign(document.createElement('strong'), { textContent: String(p.score) }), Object.assign(document.createElement('small'), { textContent: p.pegs.length + ' قطعة' }));
    step.append(crown, avatarOf(p.i), name, block); return step;
  }));
  const focus = s.players[ctl.mode === 'hotseat' ? w : me], tries = focus.pegs.length + focus.wrong;
  $('pegsStats').replaceChildren(...[[String(focus.score), 'النقاط'], [String(focus.best), 'أطول سلسلة'], [(tries ? Math.round((focus.pegs.length / tries) * 100) : 0) + '%', 'الدقة']].map(([v, l]) => {
    const li = document.createElement('li'); li.append(Object.assign(document.createElement('b'), { textContent: v }), Object.assign(document.createElement('small'), { textContent: l })); return li;
  }));
  const again = $('pegsAgain');
  again.textContent = ctl.mode === 'online' ? (room?.publicMatch ? 'مباراة جديدة' : room?.me?.role === 'host' ? 'جولة جديدة' : 'بانتظار المضيف') : 'العب مرة ثانية';
  again.disabled = ctl.mode === 'online' && !room?.publicMatch && room?.me?.role !== 'host';
  if (won && !tie) confetti();
  play(won || tie ? 'victory' : 'defeat', 0.8);
  if (!ctl.rewarded) {
    ctl.rewarded = true;
    if (ctl.mode === 'online') window.BS_CAREER?.refresh?.()?.catch?.(() => {});
    else if (ctl.mode === 'ai') { if (won) { prefs.wins++; persist(); } window.BS_CAREER?.record?.({ id: ctl.receipt, game: 'pegs', win: won && !tie })?.catch?.(() => {}); }
  }
  renderAll();
  setTimeout(() => { if (ctl.endShown && ctl.running) $('pegsResult').hidden = false; }, 1100);
}

/* ---------- online ---------- */
function openColorRoom(next){
  if(!['bluff','vault'].includes(next?.state?.mode||next?.variant))return false;
  const target=new URL(location.href);target.pathname='/colorbluff';target.searchParams.set('room',next.code);location.replace(target.pathname+target.search+target.hash);return true;
}
async function apply(next, { animate, signal } = {}) {
  if(openColorRoom(next))return;
  if(signal?.aborted)return;
  if(ctl.mode==='online'&&ctl.match===(next.startedAt||0)&&next.state?.seq<ctl.shownSeq)return;
  room = next;ctl.raceState=null;
  const s = next.state; if (!s || s.game !== 'pegs' || !Array.isArray(s.pegs)) return;
  const n = s.players.length, seat = (i) => next.players?.find((p) => p.index === i);
  const fresh = Boolean(next.resync) || ctl.mode !== 'online' || $('pegsGame').hidden || ctl.match !== (next.startedAt || 0);
  if(next.resync)animate=false;
  ctl.me = next.me?.index ?? 0;
  ctl.names = Array.from({ length: n }, (_, i) => seat(i)?.name || s.players[i]?.name || 'لاعب');
  ctl.users = Array.from({ length: n }, (_, i) => { const p = seat(i), fallback = window.BS_CAREER_CORE?.heroFace?.(p?.look?.character) || ''; return p?.username ? { username: p.username, fallback } : fallback ? { fallback } : null; });
  if (fresh) {
    begin('online', s); ctl.match = next.startedAt || 0; ctl.shownSeq = s.seq;
    if (s.seq === 0 && s.winner === null) {
      const got = Number(next.clientReceivedAt) || Date.now(), serverNow = (Number(next.serverNow) || got) + (Date.now() - got);
      const left = Number(s.lookUntil || 0) - serverNow;
      if (animate !== false && left > 600) await runLook(left); else hideColors();
      if (ctl.mode === 'online' && ctl.state) { banner(isHuman(ctl.state.turn) ? 'أنت تبدأ!' : 'يبدأ ' + (ctl.names[ctl.state.turn] || 'لاعب'), '', SEATS[ctl.state.turn]); play('go', 0.5); ctl.lastTurn = ctl.state.turn; }
    } else { hideColors(); if (s.phase === 'pick' && s.die !== null) dieShow(s.die); }
    renderAll(); if (ctl.state?.winner !== null) finish(); else announceTurn();
    setTimeout(() => { if (ctl.running && ctl.mode === 'online') renderAll(); }, 0);
    return;
  }
  if (s.seq > ctl.shownSeq) {
    const gen = ctl.gen;
    if (animate && s.last && s.last.seq === s.seq && s.seq === ctl.shownSeq + 1) { ctl.busy = true; renderStatus(); await present(s, s.last.seat === ctl.me); ctl.busy = false; }
    if (gen !== ctl.gen) return;
    ctl.shownSeq = s.seq; ctl.state = s; ctl.waiting = false; ctl.pendingPeg = null; resetFx(); dieStop();
    if (s.phase === 'pick' && s.die !== null && !(s.last?.type === 'roll' && animate)) dieShow(s.die);
  } else { ctl.state = s; if(next.resync){resetFx();ctl.busy=false;ctl.waiting=false;ctl.pendingPeg=null;} }
  renderAll();
  if (s.winner !== null) finish(); else announceTurn();
  // once the room's steps are all shown, the buttons come back
  setTimeout(() => { if (ctl.running && ctl.mode === 'online') renderAll(); }, 0);
}
try {
  table = createTable({
    game: 'pegs', modes:[{id:'classic',label:'الكلاسيكي',hint:'24 قطعة · 6 ألوان'},{id:'large',label:'الطاولة الكبيرة',hint:'48 قطعة · 8 ألوان'},{id:'teams',label:'فرق',hint:'فريقان أو ثلاثة · قطعتك لفريقك',seats:[4,6]},{id:'race',label:'سباق الذاكرة',hint:'الكل يلعب معًا · أول 12 قطعة'},{id:'race-large',label:'السباق الكبير',hint:'48 قطعة · 8 ألوان · متزامن'}],seats: [2, 3, 4,5,6], seatsDefault: 2,
    quickNote: 'نلقى لك منافسين خلال ثواني، واختر كم لاعب على الطاولة.',
    roomNote: 'أنشئ غرفة وارسل الرمز للربع، من 2 إلى 6 لاعبين.',
    lobbyNote: (next, isPublic) => (isPublic ? 'تبدأ بعد العد.' : 'أرسل الرمز للربع. تبدأ إذا ضغطت «ابدأ».'),
    apply,
    onLobby: next => { if(openColorRoom(next))return;if (!$('pegsGame').hidden) showMenu(); setMode('online'); },
    onMenu: () => { if (!$('pegsGame').hidden) showMenu(); },
    onResync: () => {ctl.gen++;tweens.clear();clearTimeout(ctl.aiTimer);resetFx();ctl.busy=false;ctl.waiting=false;ctl.pendingPeg=null;ctl.look=false;dieStop();},
    onStatus: (status) => {ctl.connected=status.online;const node=$('pegsNetwork');if(node){node.hidden=Boolean(status.online)||ctl.mode!=='online';node.textContent=status.text||'';}if(ctl.running)renderAll();},
    onError: (message) => {
      if (ctl.waiting) { ctl.waiting = false; dieStop(); const i = ctl.pendingPeg; ctl.pendingPeg = null; if (i !== null && fx[i]) { tween(fx[i], { lift: 0 }, 160).then(() => { fx[i].top = false; }); } renderAll(); }
      window.BS_PLATFORM?.toast?.(message);
    },
  });
} catch (error) { console.error('pegs online unavailable', error); }

/* ---------- screens ---------- */
function showGame() {
  $('pegsMenu').hidden = true; $('pegsGame').hidden = false; $('pegsPause').hidden = true; $('pegsResult').hidden = true;
  $('pegsPauseButton').hidden = ctl.mode === 'online';
  document.body.classList.add('pegs-running', 'game-running');
  window.BS_LOCAL_REACTIONS = { active: ctl.mode !== 'online' }; window.dispatchEvent(new Event('bs-reaction-refresh'));
  if (stage.is3d) { $('pegsStage').classList.add('is-3d'); $('pegsHero').classList.remove('is-3d'); stage.attach($('pegsStage')); }
  else requestAnimationFrame(flatResize);
  kick();
}
function showMenu() {
  ctl.gen++; clearTimeout(ctl.aiTimer);clearTimeout(raceTimer);ctl.raceState=null;tweens.clear(); resetFx();
  ctl.running = false; ctl.state = null; ctl.mode = null; ctl.look = false; dieStop();
  $('pegsGame').hidden = true; $('pegsMenu').hidden = false; $('pegsResult').hidden = true; $('pegsPause').hidden = true;
  document.body.classList.remove('pegs-running', 'game-running');
  window.BS_LOCAL_REACTIONS = { active: false }; window.dispatchEvent(new Event('bs-reaction-refresh'));
  if (stage.is3d) { $('pegsStage').classList.remove('is-3d'); $('pegsHero').classList.add('is-3d'); stage.die.clear(); stage.attach($('pegsHero'), { idle: true }); }
}
function pause(on) {
  if (ctl.mode === 'online' || !ctl.running) return;
  if(on&&!ctl.paused)ctl.pausedAt=Date.now();
  if(!on&&ctl.paused&&ctl.raceState){const dt=Date.now()-(ctl.pausedAt||Date.now());ctl.raceState.endsAt+=dt;for(const r of ctl.raceState.runs){r.lookUntil+=dt;if(r.cooldownUntil)r.cooldownUntil+=dt;if(r.readyAt)r.readyAt+=dt;}ctl.state=publicPegsRace(ctl.raceState,0);}
  ctl.paused = on; $('pegsPause').hidden = !on;
  if (!on) { renderAll(); if (ctl.mode === 'ai' && ctl.state?.turn !== 0 && !ctl.busy && ctl.state?.winner === null) thinkLater(); }
}

/* ---------- the first-time tour ---------- */
const TOUR = [
  ['احفظ', 'أول الجولة القطع تنقلب وتوريك ألوانها ثواني. ركّز وين كل لون، بذاكرتك بس: التصوير ممنوع، ولو طلعت من الصفحة تتغطى اللوحة 🔒', '<span class="pawn"><svg viewBox="0 0 24 32"><use href="#i-pawn"/></svg><i style="--c:#ffcf24"></i></span><span class="pawn up"><svg viewBox="0 0 24 32"><use href="#i-pawn"/></svg><i style="--c:#e8323f"></i></span><span class="pawn"><svg viewBox="0 0 24 32"><use href="#i-pawn"/></svg><i style="--c:#2a7fe8"></i></span>'],
  ['ارمِ', 'اضغط «ارمِ النرد» أو النرد نفسه. اللون اللي يطلع هو اللي تدوّر عليه، وتحت كل لون رمز يساعدك تميّزه.', '<span class="tdie"><svg viewBox="0 0 24 24"><path d="M12 2.5 19.5 12 12 21.5 4.5 12z"/></svg></span>'],
  ['اقلب', 'صح؟ تاخذ القطعة وتكمل. غلط؟ تنكشف للكل والدور يروح. ثلاث صح ورا بعض تخلي كل قطعة بنقطتين 🔥، و«عين الصقر» توريك لون قطعة بالسر مرة وحدة.', '<span class="pawn up"><svg viewBox="0 0 24 32"><use href="#i-pawn"/></svg><i style="--c:#22b35b"></i></span><span class="tick">✓</span>'],
];
let tourAt = 0, tourResume = false;
function showTour(at = 0) {
  tourAt = at; const [title, text, art] = TOUR[at];
  $('pegsTourTitle').textContent = title; $('pegsTourText').textContent = text; $('pegsTourArt').innerHTML = art;
  [...$('pegsTourDots').children].forEach((d, k) => d.classList.toggle('on', k === at));
  $('pegsTourNext').textContent = at === TOUR.length - 1 ? 'يلا نلعب' : 'التالي';
  $('pegsTour').hidden = false;
  if (!ctl.running) stage.hold?.(true);
}
function closeTour() { $('pegsTour').hidden = true; if (!ctl.running) stage.hold?.(false); try { localStorage.setItem(TOUR_KEY, '1'); } catch {} if (tourResume) { tourResume = false; pause(false); } }
$('pegsTourNext').onclick = () => (tourAt < TOUR.length - 1 ? showTour(tourAt + 1) : closeTour());
$('pegsTourSkip').onclick = closeTour;
$('pegsHelpMenu').onclick = () => showTour(0);
$('pegsHelp').onclick = () => { if (ctl.mode !== 'online' && ctl.running && !ctl.paused) { ctl.paused = true; tourResume = true; } showTour(0); };

/* ---------- the menu ---------- */
function setMode(mode) {
  for (const b of document.querySelectorAll('.pg-modes button')) b.setAttribute('aria-checked', String(b.dataset.mode === mode));
  for (const p of document.querySelectorAll('.pg-panel')) p.hidden = p.dataset.panel !== mode;
  document.querySelector('[data-local-options]').hidden = mode === 'online';
  prefs.mode = mode;syncFormat();persist();
}
function seg(id, key, cast = String) {
  const paint = () => { for (const b of document.querySelectorAll('#' + id + ' button')) b.setAttribute('aria-checked', String(cast(b.dataset.v) === prefs[key])); };
  for (const b of document.querySelectorAll('#' + id + ' button')) b.addEventListener('click', () => { prefs[key] = cast(b.dataset.v); persist(); paint(); window.BS_AUDIO?.play?.('tap', { volume: 0.4 }); });
  if (![...document.querySelectorAll('#' + id + ' button')].some((b) => cast(b.dataset.v) === prefs[key])) prefs[key] = cast(document.querySelector('#' + id + ' button')?.dataset.v);
  paint();
}
function syncFormat(){const select=$('pegsFormat');if(!select)return;for(const o of select.options)o.disabled=prefs.mode==='hotseat'&&o.value.startsWith('race');if(prefs.mode==='hotseat'&&prefs.variant.startsWith('race'))prefs.variant='large';select.value=prefs.variant;const teams=prefs.variant==='teams';if(teams){prefs.local=prefs.local>4?6:4;prefs.rivals=prefs.rivals>3?5:3;}for(const [id,key]of [['pegsLocal','local'],['pegsRivals','rivals']])for(const b of document.querySelectorAll('#'+id+' button')){b.disabled=teams&&![4,6].includes(Number(b.dataset.v)+(key==='rivals'?1:0));b.setAttribute('aria-checked',String(Number(b.dataset.v)===prefs[key]));}}
$('pegsFormat').addEventListener('change',e=>{prefs.variant=e.target.value;syncFormat();persist();});
seg('pegsLevel', 'level'); seg('pegsRivals', 'rivals', Number); seg('pegsLocal', 'local', Number); seg('pegsLookTime', 'look', Number);
$('pegsSwaps').checked = Boolean(prefs.swaps); $('pegsSwaps').addEventListener('change', (e) => { prefs.swaps = e.target.checked; persist(); });
for (const b of document.querySelectorAll('.pg-modes button')) b.addEventListener('click', () => { setMode(b.dataset.mode); window.BS_AUDIO?.play?.('tap', { volume: 0.4 }); });
for (const b of document.querySelectorAll('[data-start]')) b.addEventListener('click', () => startLocal(b.dataset.start));
setMode(/[?&]room=\d{6}/.test(location.search) ? 'online' : prefs.mode);
$('pegsExit').onclick = () => { if (ctl.mode === 'online') table?.leave(); showMenu(); };
$('pegsPauseButton').onclick = () => pause(true); $('pegsResume').onclick = () => pause(false);
$('pegsRestart').onclick = () => { $('pegsPause').hidden = true; startLocal(ctl.mode); };
$('pegsQuit').onclick = () => showMenu();
$('pegsBackMenu').onclick = () => { if (ctl.mode === 'online') table?.leave(); showMenu(); };
$('pegsAgain').onclick = () => { $('pegsResult').hidden = true; if (ctl.mode === 'online') table?.again(); else startLocal(ctl.mode); };
function paintMute() {
  const muted = Boolean(window.BS_AUDIO?.getSettings?.().muted);
  for (const b of document.querySelectorAll('.pg-mute')) { b.classList.toggle('is-muted', muted); b.setAttribute('aria-pressed', String(muted)); b.querySelector('use')?.setAttribute('href', muted ? '#i-mute' : '#i-sound'); }
}
for (const b of document.querySelectorAll('.pg-mute')) b.addEventListener('click', () => { window.BS_AUDIO?.toggleMuted?.(); paintMute(); });
addEventListener('bs-audio-change', paintMute); paintMute();
document.addEventListener('visibilitychange', () => { if (document.hidden) { if (ctl.mode === 'ai' || ctl.mode === 'hotseat') pause(true); } else kick(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ctl.running) { if (ctl.peeking) { ctl.peeking = false; renderAll(); } else pause(!ctl.paused); } });
let firstTour = false; try { firstTour = !localStorage.getItem(TOUR_KEY); } catch {}
if (firstTour && !/[?&]room=\d{6}/.test(location.search) && !params.has('debug')) setTimeout(() => { if (!ctl.running) showTour(0); }, 900);
upgrade3d();
if (params.has('debug')) window.BS_PEGS = { get ctl() { return ctl; }, get state() { return ctl.state; }, get board() { return stage; }, startLocal, doRoll, doPick, doPeek, fx, showTour };
