/* Tahdia 33.10.1 — «شطرنج الذاكرة»: the page. One controller for the three ways to play: online
   (the room keeps the colours and sends each step), against the computer, and friends on one phone.
   Every step — a roll, a pawn turned over, a look under a pawn — is shown the same way whoever made it. */
import { PEGS, PEG_COLORS, createPegsGame, rollPegs, pickPegs, peekPegs, choosePegsMove } from '../engines/pegs-engine.js?v=33.10.1';
import { createPegsBoard } from './board.js?v=33.10.1';
import { createTable } from '../board-table-v33.js?v=33.10.1-pegs1';

const $ = (id) => document.getElementById(id);
const SEATS = ['#ffc94d', '#5fd4ff', '#ff7ab6', '#8ee06a'];
const HEROES = ['robot', 'cyber', 'astronaut'];
const KEY = 'bs-pegs-v33-10-1';
const prefs = (() => { const base = { mode: 'online', level: 'medium', rivals: 1, local: 2, look: 7, swaps: false, wins: 0 }; try { return { ...base, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return base; } })();
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch {} };
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
const reduce = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
const easeOut = (k) => 1 - (1 - k) ** 3, easeIn = (k) => k * k * k, easeBack = (k) => 1 + 2.4 * (k - 1) ** 3 + 1.4 * (k - 1) ** 2;
const colorName = (c) => PEG_COLORS[c]?.name || '';

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
  pendingPeg: null, lastTurn: null, aiTimer: 0, scores: [], trays: [],
};
let room = null, table = null;
const fx = Array.from({ length: PEGS.COUNT }, () => ({}));
let particles = [], scan = null, hover = -1;

/* ---------- the board and its frame loop ---------- */
const canvas = $('pegsBoard'), board = createPegsBoard(canvas);
function resize() {
  const r = $('pegsStage').getBoundingClientRect();
  if (r.width > 10 && r.height > 10) { board.resize(Math.floor(r.width), Math.floor(r.height)); render(); }
}
if (typeof ResizeObserver === 'function') new ResizeObserver(resize).observe($('pegsStage'));
addEventListener('resize', resize, { passive: true });

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
function frame(t) { raf = 0; if (!ctl.running) return; render(t); if (!document.hidden) raf = requestAnimationFrame(frame); }
function render(t = performance.now()) {
  const s = ctl.state; if (!s) return;
  stepTweens(t);
  const picking = canPick() || (ctl.peeking && canAct());
  for (let i = 0; i < fx.length; i++) {
    const f = fx[i];
    if (f.verdict) { f.ring = f.verdict; continue; }
    f.ring = picking && s.pegs[i].taken === null ? (i === hover ? (ctl.peeking ? '#5fd4ff' : '#ffc94d') : 'rgba(255,244,224,.28)') : null;
  }
  board.draw({ pegs: s.pegs, fx, particles, time: t, scan });
  if (particles.length) particles = particles.filter((p) => t - p.start < p.life);
}
function resetFx() { for (const f of fx) for (const k of Object.keys(f)) delete f[k]; particles = []; scan = null; }

/* ---------- who may do what ---------- */
const isHuman = (seat) => (ctl.mode === 'online' ? seat === ctl.me : ctl.mode === 'ai' ? seat === 0 : true);
function canAct() {
  const s = ctl.state;
  if (!s || !ctl.running || ctl.paused || ctl.busy || ctl.look || ctl.waiting || s.winner !== null) return false;
  if (ctl.mode === 'online' && room?.status !== 'playing') return false;
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
function buildChips() {
  const host = $('players'), s = ctl.state; if (!s) return;
  host.replaceChildren();
  ctl.scores = s.players.map((p) => p.score); ctl.trays = s.players.map((p) => p.pegs.length);
  s.players.forEach((p, seat) => {
    const chip = document.createElement('div'); chip.className = 'pg-chip'; chip.id = 'chip' + seat; chip.style.setProperty('--seat', SEATS[seat]);
    if (ctl.mode === 'online') { chip.dataset.playerTag = String(seat); chip.tabIndex = 0; }
    const face = document.createElement('span'); face.className = 'pg-face'; face.append(faceOf(seat));
    const who = document.createElement('span'); who.className = 'pg-who'; who.textContent = ctl.names[seat] || 'لاعب';
    const score = document.createElement('strong'); score.className = 'pg-score'; score.textContent = String(p.score);
    const tray = document.createElement('span'); tray.className = 'pg-tray'; tray.setAttribute('aria-label', 'الأحجار اللي أخذها');
    for (const c of p.pegs) tray.append(dot(c));
    const badges = document.createElement('span'); badges.className = 'pg-badges';
    chip.append(face, who, score, tray, badges); host.append(chip);
  });
  if (!window.BS_PROFILE_PRO && !buildChips.retried) { buildChips.retried = true; setTimeout(() => { if (ctl.state && ctl.running) buildChips(); renderChips(); }, 1600); }
  renderChips();
}
function dot(c, fresh = false) { const i = document.createElement('i'); i.style.setProperty('--c', PEG_COLORS[c]?.hex || '#999'); if (fresh) i.className = 'new'; i.title = colorName(c); return i; }
function renderChips() {
  const s = ctl.state; if (!s) return;
  s.players.forEach((p, seat) => {
    const chip = $('chip' + seat); if (!chip) return;
    const active = s.winner === null && s.turn === seat && !ctl.look;
    chip.classList.toggle('active', active);
    chip.classList.toggle('hot', active && p.streak >= PEGS.HOT);
    const score = chip.querySelector('.pg-score');
    if (p.score !== ctl.scores[seat]) { score.textContent = String(p.score); score.classList.remove('bump'); void score.offsetWidth; score.classList.add('bump'); ctl.scores[seat] = p.score; }
    const tray = chip.querySelector('.pg-tray');
    if (p.pegs.length !== tray.children.length) { if (p.pegs.length < tray.children.length) tray.replaceChildren(); for (let k = tray.children.length; k < p.pegs.length; k++) tray.append(dot(p.pegs[k], true)); }
    const badges = chip.querySelector('.pg-badges'), list = [];
    if (active) list.push(['pg-turn', isHuman(seat) && ctl.mode !== 'hotseat' ? 'دورك' : 'دوره']);
    if (p.streak >= 2) list.push(['pg-flame', '🔥' + p.streak]);
    badges.replaceChildren(...list.map(([cls, text]) => Object.assign(document.createElement('span'), { className: cls, textContent: text })));
  });
}

/* ---------- the lines under the players and the dock ---------- */
function pill(c) { const i = document.createElement('i'); i.className = 'pg-pill'; i.style.setProperty('--c', PEG_COLORS[c]?.hex || '#999'); return i; }
function renderStatus() {
  const s = ctl.state, out = $('pegsStatus'); if (!s) return;
  const name = ctl.names[s.turn] || 'لاعب', mine = isHuman(s.turn), hot = ctl.mode === 'hotseat';
  const parts = [];
  if (ctl.look) parts.push('احفظ الألوان قبل ما تختفي');
  else if (s.winner !== null) parts.push('خلصت الأحجار');
  else if (ctl.peeking) parts.push('اختر حجر تشوف لونه بالسر');
  else if (s.phase === 'roll') parts.push(mine ? (hot ? 'دور ' + name + ': ارمِ النرد' : 'دورك: ارمِ النرد') : 'دور ' + name);
  else { parts.push(mine ? (hot ? name + ': اقلب حجر ' : 'اقلب حجر ') : name + ' يدوّر على '); parts.push(pill(s.die)); parts.push(colorName(s.die)); }
  out.replaceChildren(...parts.map((p) => (typeof p === 'string' ? document.createTextNode(p) : p)));
  const left = s.pegs.filter((p) => p.taken === null).length;
  $('pegsLeft').textContent = 'باقي ' + left + ' حجر';
  // the dock
  const die = $('pegsDie'), ready = canRoll();
  die.disabled = !ready; die.classList.toggle('ready', ready);
  const target = $('pegsTarget'), hint = $('pegsHint');
  if (ctl.look) { target.textContent = 'احفظ'; hint.textContent = 'الأحجار بترجع بعد شوي'; }
  else if (s.winner !== null) { target.textContent = 'انتهت الجولة'; hint.textContent = ''; }
  else if (s.phase === 'pick') { target.replaceChildren(document.createTextNode('دوّر على '), pill(s.die), document.createTextNode(colorName(s.die))); hint.textContent = mine ? (ctl.peeking ? 'اضغط حجر تشوفه بالسر' : 'اضغط على الحجر اللي تتوقعه') : 'ركّز وين يقلب'; }
  else { target.textContent = mine ? 'ارمِ النرد' : 'دور ' + name; hint.textContent = mine ? 'اضغط النرد' : 'انتظر دورك وتابع الأحجار'; }
  const peek = $('pegsPeek'), mineSeat = ctl.mode === 'online' ? ctl.me : ctl.mode === 'ai' ? 0 : s.turn, left2 = s.players[mineSeat]?.peeks || 0;
  peek.disabled = !(canPeek() || ctl.peeking); peek.setAttribute('aria-pressed', String(ctl.peeking));
  $('pegsPeekLeft').textContent = left2 > 0 ? 'مرة وحدة' : 'استخدمتها';
  $('pegsStage').classList.toggle('pick', canPick() || ctl.peeking);
}
function renderAll() { renderChips(); renderStatus(); render(); }

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

/* ---------- the colour die ---------- */
const FACE_TURN = [[0, 0], [0, -90], [0, 180], [0, 90], [-90, 0], [90, 0]];
const die = { x: 0, y: 0 };
function dieTo(c, quick = false) {
  const cube = $('pegsCube'), [tx, ty] = FACE_TURN[c] || [0, 0];
  const turns = quick ? 1 : 2, nx = Math.round((die.x - tx) / 360 + turns + 0.5) * 360 + tx, ny = Math.round((die.y - ty) / 360 + turns) * 360 + ty;
  cube.classList.remove('spin'); cube.classList.toggle('quick', quick);
  die.x = nx; die.y = ny; cube.style.transform = 'rotateX(' + nx + 'deg) rotateY(' + ny + 'deg)';
  return wait(reduce ? 150 : quick ? 450 : 900);
}
function dieSpin() { $('pegsCube').classList.add('spin'); }
function dieStop() { $('pegsCube').classList.remove('spin'); }

/* ---------- effects ---------- */
function burst(i, c) {
  const m = board.middle(i), col = PEG_COLORS[c]?.hex || '#fff', t = performance.now();
  for (let k = 0; k < 30; k++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, v = 120 + Math.random() * 220;
    particles.push({ x: m.x, y: m.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, start: t + Math.random() * 60, life: 700 + Math.random() * 500, size: 4 + Math.random() * 5, color: k % 3 ? col : '#ffe08a', spin: Math.random() - 0.5, round: k % 2 === 0 });
  }
  kick();
}
function float(i, text, color) {
  const m = board.middle(i), size = board.size.pawn * 0.5;
  particles.push({ x: m.x, y: m.y - size, vx: 0, vy: -70, fall: 0, start: performance.now(), life: 1100, size, text, color }); kick();
}
function confetti() {
  const { W } = board.size, t = performance.now();
  for (let k = 0; k < 90; k++) particles.push({ x: Math.random() * W, y: -10, vx: (Math.random() - 0.5) * 80, vy: 60 + Math.random() * 120, start: t + Math.random() * 700, life: 1800 + Math.random() * 900, size: 6 + Math.random() * 6, color: PEG_COLORS[k % 6].hex, spin: Math.random() - 0.5, fall: 0.5 });
  kick();
}

/* ---------- the opening look ---------- */
async function runLook(ms) {
  const gen = ctl.gen, s = ctl.state;
  if (ms < 600 || !s.pegs.some((p) => p.c >= 0)) { hideColors(); return; }
  ctl.look = true; renderAll();
  const order = s.pegs.map((p, i) => i).sort((a, b) => Math.atan2(board.foot(a).y - board.size.cy, board.foot(a).x - board.size.cx) - Math.atan2(board.foot(b).y - board.size.cy, board.foot(b).x - board.size.cx));
  sfx('look', 0.7);
  order.forEach((i, k) => { fx[i].color = s.pegs[i].c; setTimeout(() => { if (gen === ctl.gen) tween(fx[i], { lift: 0.3, tip: 0.86 }, 420, easeBack); }, reduce ? 0 : k * 28); });
  const box = $('pegsLook'), ring = $('pegsLookRing'), n = $('pegsLookN'), end = performance.now() + ms;
  box.hidden = false; $('pegsDie').hidden = true; let shown = -1;
  while (performance.now() < end - 650) {
    if (gen !== ctl.gen) return;
    const left = end - performance.now(), sec = Math.ceil(left / 1000);
    ring.style.strokeDashoffset = String(119.4 * (1 - left / ms));
    if (sec !== shown) { shown = sec; n.textContent = String(sec); if (sec <= 3) sfx('tick', 0.55); }
    await wait(80);
  }
  if (gen !== ctl.gen) return;
  sfx('hide', 0.6);
  order.forEach((i, k) => setTimeout(() => { if (gen === ctl.gen) tween(fx[i], { lift: 0, tip: 0 }, 300, easeIn); }, reduce ? 0 : k * 14));
  await wait(Math.max(0, end - performance.now()) + 120);
  if (gen !== ctl.gen) return;
  box.hidden = true; $('pegsDie').hidden = false; ring.style.strokeDashoffset = '0';
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
  if (!mine || !$('pegsCube').classList.contains('spin')) play('dice', 0.7);
  dieStop();
  for (let k = 0; k < L.faces.length; k++) {
    await dieTo(L.faces[k], k > 0); if (gen !== ctl.gen) return;
    play('diceImpact', 0.55);
    if (k < L.faces.length - 1) { banner('خلص ال' + colorName(L.faces[k]) + '، نرمي مرة ثانية', '', PEG_COLORS[L.faces[k]].hex); await wait(260); play('dice', 0.5); }
  }
  banner(colorName(L.color), '', PEG_COLORS[L.color].hex);
  await wait(200);
}
async function scanTo(i, seat) {
  const free = ctl.state.pegs.map((p, k) => (p.taken === null && k !== i ? k : -1)).filter((k) => k >= 0);
  const path = [...free.sort(() => Math.random() - 0.5).slice(0, 2), i], gen = ctl.gen;
  const first = board.middle(path[0]); scan = { x: first.x, y: first.y, color: SEATS[seat] };
  for (const k of path) { const m = board.middle(k); await tween(scan, { x: m.x, y: m.y }, 140); if (gen !== ctl.gen) return; }
  await wait(80); scan = null;
}
async function showPick(next, L, mine) {
  const gen = ctl.gen, i = L.peg, f = fx[i], early = ctl.pendingPeg === i;
  ctl.pendingPeg = null;
  if (!mine && !early) await scanTo(i, L.seat);
  if (gen !== ctl.gen) return;
  f.top = true; f.color = L.color;
  if (!early) sfx('lift', 0.7);
  await tween(f, { lift: 0.58 }, early ? 80 : 170);
  await tween(f, { tip: 1 }, 240);
  if (gen !== ctl.gen) return;
  if (L.ok) {
    const col = PEG_COLORS[L.color].hex;
    sfx('right', 0.8); buzz(14); f.glow = col; f.verdict = col; burst(i, L.color); float(i, '+' + L.gained, L.gained > 1 ? '#ffb23f' : '#fff4e0');
    if (L.streak === PEGS.HOT) { sfx('streak', 0.75); banner('🔥 حامي! كل حجر بنقطتين', 'hot'); }
    else if (L.streak > PEGS.HOT) banner('🔥 ' + L.streak + ' ورا بعض', 'hot');
    await wait(300); if (gen !== ctl.gen) return;
    await flyToChip(i, L.seat);
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
async function flyToChip(i, seat) {
  const f = fx[i], chip = $('chip' + seat), cr = canvas.getBoundingClientRect();
  const start = board.foot(i), from = board.toBoard(start.x, start.y);
  let to = { x: from.x, y: from.y - 1.4 };
  if (chip) { const r = chip.getBoundingClientRect(); to = board.toBoard(r.left + r.width / 2 - cr.left, r.top + r.height / 2 - cr.top + board.size.pawn * 0.2); }
  f.at = { ...from };
  await Promise.all([tween(f.at, to, 440, easeIn), tween(f, { scale: 0.4, alpha: 0.15, lift: 0.9 }, 440, easeIn)]);
  sfx('place', 0.35);
}
async function showSwap([a, b]) {
  const gen = ctl.gen, A = board.foot(a), B = board.foot(b), pa = board.toBoard(A.x, A.y), pb = board.toBoard(B.x, B.y);
  banner('تبادل حجرين مكانهم!', '', '#5fd4ff'); sfx('swap', 0.7);
  for (const [k, from] of [[a, pa], [b, pb]]) { fx[k].at = { ...from }; fx[k].glow = '#5fd4ff'; fx[k].top = true; }
  await Promise.all([tween(fx[a], { lift: 0.5 }, 200), tween(fx[b], { lift: 0.5 }, 200)]);
  await Promise.all([tween(fx[a].at, pb, 520), tween(fx[b].at, pa, 520)]);
  if (gen !== ctl.gen) return;
  await Promise.all([tween(fx[a], { lift: 0 }, 180, easeIn), tween(fx[b], { lift: 0 }, 180, easeIn)]);
  for (const k of [a, b]) { delete fx[k].at; delete fx[k].glow; fx[k].top = false; }
}
async function showPeek(next, L, mine) {
  const gen = ctl.gen, i = L.peg, f = fx[i];
  const seen = next.peek && next.peek.peg === i && next.peek.c >= 0 && (ctl.mode !== 'online' || next.peek.seat === ctl.me) ? next.peek.c : -1;
  ctl.pendingPeg = null;
  sfx('peek', 0.7); f.top = true; f.color = seen; f.glow = '#5fd4ff';
  banner(mine ? 'عين الصقر 👁' : (ctl.names[L.seat] || 'لاعب') + ' استخدم عين الصقر', '', '#5fd4ff');
  await tween(f, { lift: 0.45 }, 180); await tween(f, { tip: 0.95 }, 200);
  await wait(mine && ctl.mode !== 'online' ? 1100 : 560); if (gen !== ctl.gen) return;
  await tween(f, { tip: 0, lift: 0 }, 240, easeIn);
  delete f.color; delete f.glow; f.top = false;
}

/* ---------- local games ---------- */
async function act(make) {
  if (ctl.busy || !ctl.state) return;
  let next; try { next = make(ctl.state); } catch { return; }
  ctl.busy = true; renderStatus();
  const gen = ctl.gen;
  await present(next, isHuman(next.last?.seat ?? next.turn));
  if (gen !== ctl.gen) return;
  ctl.state = next; resetFx(); ctl.busy = false;
  afterStep();
}
function afterStep() {
  renderAll();
  const s = ctl.state; if (!s) return;
  if (s.winner !== null) { finish(); return; }
  announceTurn();
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
  const n = mode === 'ai' ? 1 + Math.max(1, Math.min(3, Number(prefs.rivals) || 1)) : Math.max(2, Math.min(4, Number(prefs.local) || 2));
  const meName = window.BS_GAME_MENU?.playerName?.() || 'أنت';
  ctl.names = mode === 'ai' ? [meName, ...Array.from({ length: n - 1 }, (_, k) => (n === 2 ? 'الكمبيوتر' : 'الكمبيوتر ' + (k + 1)))] : Array.from({ length: n }, (_, k) => 'اللاعب ' + (k + 1));
  ctl.users = mode === 'ai' ? [myUser(), ...HEROES.slice(0, n - 1).map((h) => ({ fallback: '/assets/heroes/face/' + h + '.webp' }))] : ctl.names.map(() => null);
  ctl.levels = ctl.names.map((_, k) => (mode === 'ai' && k > 0 ? prefs.level : null));
  const state = createPegsGame(ctl.names, { showMs: (Number(prefs.look) || 7) * 1000, swaps: Boolean(prefs.swaps), first: mode === 'ai' ? 0 : null });
  state.salt = Math.floor(Math.random() * 1e6);
  begin(mode, state);
  const gen = ctl.gen;
  ctl.receipt = 'pegs:' + Date.now().toString(36) + ':' + Math.floor(Math.random() * 1e9).toString(36);
  runLook(state.showMs).then(() => { if (gen === ctl.gen && ctl.state) { renderAll(); if (state.turn === 0 || mode === 'hotseat') banner(mode === 'hotseat' ? 'يبدأ ' + ctl.names[state.turn] : 'أنت تبدأ!', '', SEATS[state.turn]); ctl.lastTurn = state.turn; play('go', 0.5); afterStep(); } });
}
function begin(mode, state) {
  ctl.gen++; clearTimeout(ctl.aiTimer); tweens.clear(); resetFx();
  Object.assign(ctl, { mode, state, running: true, paused: false, busy: false, look: false, peeking: false, waiting: false, endShown: false, rewarded: false, pendingPeg: null, lastTurn: null, shownSeq: state.seq });
  hover = -1; dieStop(); $('pegsLook').hidden = true; $('pegsDie').hidden = false;
  showGame(); buildChips(); renderAll();
}

/* ---------- moves from the player ---------- */
function doRoll() {
  if (!canRoll()) return;
  primeSound();
  if (ctl.mode === 'online') { if (!table?.send('pegs_roll')) return; ctl.waiting = true; dieSpin(); play('dice', 0.7); renderStatus(); return; }
  act((s) => rollPegs(s, s.turn));
}
function doPick(i) {
  if (ctl.peeking) return doPeek(i);
  if (!canPick() || ctl.state.pegs[i]?.taken !== null) return;
  if (ctl.mode === 'online') {
    if (!table?.send('pegs_pick', { peg: i })) return;
    ctl.waiting = true; ctl.pendingPeg = i; fx[i].top = true; sfx('lift', 0.7); tween(fx[i], { lift: 0.4 }, 150); renderStatus(); return;
  }
  act((s) => pickPegs(s, s.turn, i));
}
function doPeek(i) {
  if (!canPeek() || ctl.state.pegs[i]?.taken !== null) return;
  ctl.peeking = false;
  if (ctl.mode === 'online') { if (!table?.send('pegs_peek', { peg: i })) { renderStatus(); return; } ctl.waiting = true; ctl.pendingPeg = i; renderStatus(); return; }
  act((s) => peekPegs(s, s.turn, i));
}
function pointAt(e) { const r = canvas.getBoundingClientRect(); return board.hit(e.clientX - r.left, e.clientY - r.top, ctl.state?.pegs || []); }
canvas.addEventListener('pointermove', (e) => { if (!ctl.state) return; const i = canPick() || ctl.peeking ? pointAt(e) : -1; if (i !== hover) { hover = i; render(); } });
canvas.addEventListener('pointerleave', () => { hover = -1; render(); });
canvas.addEventListener('click', (e) => { if (!ctl.state) return; const i = pointAt(e); if (i >= 0) { hover = i; doPick(i); } });
canvas.addEventListener('keydown', (e) => {
  const s = ctl.state; if (!s || !ctl.running) return;
  const free = s.pegs.map((p, i) => (p.taken === null ? i : -1)).filter((i) => i >= 0);
  if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && free.length) { e.preventDefault(); const at = free.indexOf(hover), step = e.key === 'ArrowLeft' ? 1 : -1; hover = free[(at + step + free.length) % free.length] ?? free[0]; render(); }
  else if (e.key === 'Enter' && hover >= 0) { e.preventDefault(); doPick(hover); }
  else if (e.key === ' ' || e.key.toLowerCase() === 'r') { e.preventDefault(); doRoll(); }
});
$('pegsDie').addEventListener('click', doRoll);
$('pegsPeek').addEventListener('click', () => { if (ctl.peeking) { ctl.peeking = false; } else if (canPeek()) { ctl.peeking = true; sfx('peek', 0.35); } renderAll(); });

/* ---------- the end ---------- */
function finish() {
  if (ctl.endShown || !ctl.state) return; ctl.endShown = true;
  const s = ctl.state, me = ctl.mode === 'online' ? ctl.me : 0, w = s.winner;
  const tie = s.ties.length > 1 && s.ties.includes(me) && ctl.mode !== 'hotseat';
  const won = ctl.mode === 'hotseat' || w === me;
  $('pegsWinner').textContent = ctl.mode === 'hotseat' ? (s.ties.length > 1 ? 'تعادل!' : ctl.names[w] + ' فاز!') : tie ? 'تعادل!' : won ? 'فزت!' : (ctl.names[w] || 'المنافس') + ' فاز';
  const mine = s.players[me];
  $('pegsResultCopy').textContent = ctl.mode === 'hotseat' ? 'أطول سلسلة: ' + Math.max(...s.players.map((p) => p.best)) : 'نقاطك ' + mine.score + ' · أطول سلسلة ' + mine.best + ' · أخطاء ' + mine.wrong;
  const rows = s.players.map((p, i) => ({ ...p, i })).sort((a, b) => b.score - a.score || b.best - a.best);
  $('pegsPodium').replaceChildren(...rows.map((p, k) => {
    const li = document.createElement('li'); li.style.setProperty('--seat', SEATS[p.i]); if (k === 0) li.className = 'first';
    const rank = Object.assign(document.createElement('span'), { className: 'pg-rank', textContent: k === 0 ? '👑' : String(k + 1) });
    const face = document.createElement('span'); face.className = 'pg-face'; face.append(faceOf(p.i));
    const line = document.createElement('span'); line.className = 'pg-line';
    line.append(Object.assign(document.createElement('b'), { textContent: ctl.names[p.i] || 'لاعب' }), Object.assign(document.createElement('small'), { textContent: p.pegs.length + ' حجر · أطول سلسلة ' + p.best }));
    return li.appendChild(rank), li.append(face, line, Object.assign(document.createElement('strong'), { className: 'pg-score', textContent: String(p.score) })), li;
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
async function apply(next, { animate } = {}) {
  room = next;
  const s = next.state; if (!s || s.game !== 'pegs' || !Array.isArray(s.pegs)) return;
  const n = s.players.length, seat = (i) => next.players?.find((p) => p.index === i);
  const fresh = ctl.mode !== 'online' || $('pegsGame').hidden || ctl.match !== (next.startedAt || 0);
  ctl.me = next.me?.index ?? 0;
  ctl.names = Array.from({ length: n }, (_, i) => seat(i)?.name || s.players[i]?.name || 'لاعب');
  ctl.users = Array.from({ length: n }, (_, i) => { const p = seat(i), hero = p?.look?.character; const fallback = hero ? '/assets/heroes/face/' + hero + '.webp' : ''; return p?.username ? { username: p.username, fallback } : fallback ? { fallback } : null; });
  if (fresh) {
    begin('online', s); ctl.match = next.startedAt || 0; ctl.shownSeq = s.seq;
    $('pegsPauseButton').hidden = true;
    if (s.seq === 0 && s.winner === null) {
      const got = Number(next.clientReceivedAt) || Date.now(), serverNow = (Number(next.serverNow) || got) + (Date.now() - got);
      const left = Number(s.lookUntil || 0) - serverNow;
      if (animate !== false && left > 600) await runLook(left); else hideColors();
      if (ctl.mode === 'online' && ctl.state) { banner(isHuman(ctl.state.turn) ? 'أنت تبدأ!' : 'يبدأ ' + (ctl.names[ctl.state.turn] || 'لاعب'), '', SEATS[ctl.state.turn]); play('go', 0.5); ctl.lastTurn = ctl.state.turn; }
    } else hideColors();
    renderAll(); if (ctl.state?.winner !== null) finish(); else announceTurn();
    return;
  }
  if (s.seq > ctl.shownSeq) {
    const gen = ctl.gen;
    if (animate && s.last && s.last.seq === s.seq && s.seq === ctl.shownSeq + 1) { ctl.busy = true; renderStatus(); await present(s, s.last.seat === ctl.me); ctl.busy = false; }
    if (gen !== ctl.gen) return;
    ctl.shownSeq = s.seq; ctl.state = s; ctl.waiting = false; ctl.pendingPeg = null; resetFx(); dieStop();
    if (s.phase === 'pick' && s.die !== null) dieShow(s.die);
  } else { ctl.state = { ...s, pegs: ctl.state?.pegs || s.pegs }; }
  renderAll();
  if (s.winner !== null) finish(); else announceTurn();
}
function dieShow(c) { const [tx, ty] = FACE_TURN[c] || [0, 0]; if (((die.x - tx) % 360 + 360) % 360 === 0 && ((die.y - ty) % 360 + 360) % 360 === 0) return; dieTo(c, true); }
try {
  table = createTable({
    game: 'pegs', seats: [2, 3, 4], seatsDefault: 2,
    quickNote: 'نلقى لك منافسين خلال ثواني، واختر كم لاعب على الطاولة.',
    roomNote: 'أنشئ غرفة وارسل الرمز للربع، من 2 إلى 4 لاعبين.',
    lobbyNote: (next, isPublic) => (isPublic ? 'تبدأ بعد العد.' : 'أرسل الرمز للربع. تبدأ إذا ضغطت «ابدأ».'),
    apply,
    onLobby: () => { if (!$('pegsGame').hidden) showMenu(); setMode('online'); },
    onMenu: () => { if (!$('pegsGame').hidden) showMenu(); },
    onStatus: () => {},
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
  requestAnimationFrame(resize); kick();
}
function showMenu() {
  ctl.gen++; clearTimeout(ctl.aiTimer); tweens.clear(); resetFx();
  ctl.running = false; ctl.state = null; ctl.mode = null; ctl.look = false; dieStop();
  $('pegsGame').hidden = true; $('pegsMenu').hidden = false; $('pegsResult').hidden = true; $('pegsPause').hidden = true; $('pegsLook').hidden = true; $('pegsDie').hidden = false;
  document.body.classList.remove('pegs-running', 'game-running');
  window.BS_LOCAL_REACTIONS = { active: false }; window.dispatchEvent(new Event('bs-reaction-refresh'));
}
function pause(on) {
  if (ctl.mode === 'online' || !ctl.running) return;
  ctl.paused = on; $('pegsPause').hidden = !on;
  if (!on) { renderAll(); if (ctl.mode === 'ai' && ctl.state?.turn !== 0 && !ctl.busy && ctl.state?.winner === null) thinkLater(); }
}

/* ---------- the menu ---------- */
function setMode(mode) {
  for (const b of document.querySelectorAll('.pg-modes button')) b.setAttribute('aria-checked', String(b.dataset.mode === mode));
  for (const p of document.querySelectorAll('.pg-panel')) p.hidden = p.dataset.panel !== mode;
  document.querySelector('[data-local-options]').hidden = mode === 'online';
  prefs.mode = mode; persist();
}
function seg(id, key, cast = String) {
  const paint = () => { for (const b of document.querySelectorAll('#' + id + ' button')) b.setAttribute('aria-checked', String(cast(b.dataset.v) === prefs[key])); };
  for (const b of document.querySelectorAll('#' + id + ' button')) b.addEventListener('click', () => { prefs[key] = cast(b.dataset.v); persist(); paint(); window.BS_AUDIO?.play?.('tap', { volume: 0.4 }); });
  if (![...document.querySelectorAll('#' + id + ' button')].some((b) => cast(b.dataset.v) === prefs[key])) prefs[key] = cast(document.querySelector('#' + id + ' button')?.dataset.v);
  paint();
}
seg('pegsLevel', 'level'); seg('pegsRivals', 'rivals', Number); seg('pegsLocal', 'local', Number); seg('pegsLookTime', 'look', Number);
$('pegsSwaps').checked = Boolean(prefs.swaps); $('pegsSwaps').addEventListener('change', (e) => { prefs.swaps = e.target.checked; persist(); });
for (const b of document.querySelectorAll('.pg-modes button')) b.addEventListener('click', () => setMode(b.dataset.mode));
for (const b of document.querySelectorAll('[data-start]')) b.addEventListener('click', () => startLocal(b.dataset.start));
setMode(/[?&]room=\d{6}/.test(location.search) ? 'online' : prefs.mode);
$('pegsExit').onclick = () => { if (ctl.mode === 'online') table?.leave(); showMenu(); };
$('pegsPauseButton').onclick = () => pause(true); $('pegsResume').onclick = () => pause(false);
$('pegsRestart').onclick = () => { $('pegsPause').hidden = true; startLocal(ctl.mode); };
$('pegsBackMenu').onclick = () => { if (ctl.mode === 'online') table?.leave(); showMenu(); };
$('pegsAgain').onclick = () => { $('pegsResult').hidden = true; if (ctl.mode === 'online') table?.again(); else startLocal(ctl.mode); };
function paintMute() { const muted = Boolean(window.BS_AUDIO?.getSettings?.().muted); for (const id of ['pegsMute', 'pegsSound']) { const b = $(id); if (!b) continue; b.textContent = muted ? '🔇' : '🔊'; b.setAttribute('aria-pressed', String(muted)); } }
for (const id of ['pegsMute', 'pegsSound']) $(id)?.addEventListener('click', () => { window.BS_AUDIO?.toggleMuted?.(); paintMute(); });
addEventListener('bs-audio-change', paintMute); paintMute();
document.addEventListener('visibilitychange', () => { if (document.hidden) { if (ctl.mode === 'ai' || ctl.mode === 'hotseat') pause(true); } else kick(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ctl.running) { if (ctl.peeking) { ctl.peeking = false; renderAll(); } else pause(!ctl.paused); } });
if (new URLSearchParams(location.search).has('debug')) window.BS_PEGS = { get ctl() { return ctl; }, get state() { return ctl.state; }, startLocal, doRoll, doPick, doPeek, board, fx };
