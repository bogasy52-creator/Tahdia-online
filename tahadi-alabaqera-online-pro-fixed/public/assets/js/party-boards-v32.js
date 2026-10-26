/* Tahdia 32.1.0 — the turn games of the group games, rebuilt.
   Snakes & Ladders gets the main game's board: glass tiles from emerald to
   ruby, the living snakes and gold ladders (neon-arena.js), the 3D die
   (pro-dice.js) and studio stones that hop cell by cell, climb ladders and
   get swallowed by snakes. The dice race gets the same die, a track to the
   target for every player and the last throws. Up to ten players. Every roll
   comes from the server; the page only animates what already happened. */

export const SEAT_COLORS = Object.freeze(['#2f86e8', '#8b5cf6', '#f0b429', '#22a565', '#e5484d', '#14b8a6', '#f97316', '#ec4899', '#84cc16', '#94a3b8']);
// glass tiles, bottom row first (emerald) to the top row (ruby), with a deeper alternate
const ROW_TILES = [['#0f5e4f', '#0c4f43'], ['#0e5c66', '#0b4d56'], ['#10537a', '#0d4567'], ['#173f85', '#133571'], ['#2a368c', '#232d77'], ['#3f2f8a', '#352776'], ['#552985', '#482271'], ['#6a2478', '#5a1e66'], ['#7c2163', '#6a1c54'], ['#8a2347', '#761d3c']];

const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, reduced() ? 0 : ms));
const cue = (name, options) => { try { window.BS_AUDIO?.play?.(name, options); } catch {} };
const seatColor = (i) => SEAT_COLORS[((i % SEAT_COLORS.length) + SEAT_COLORS.length) % SEAT_COLORS.length];
function node(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }
function pawnIcon(color) {
  try { if (window.BS_PIECES) return window.BS_PIECES.icon(document, { design: 'classic', item: 'pawn-classic', color, className: 'pb-pawn-svg' }); } catch {}
  const dot = node('i', 'pb-pawn-dot'); dot.style.background = color; return dot;
}
function mountDie(el) { try { window.BS_DICE?.mount?.(el); } catch {} }
function rollDie(el, value) {
  if (!Number.isInteger(value) || value < 1 || value > 6) return Promise.resolve();
  try { return Promise.resolve(window.BS_DICE?.roll?.(el, value)).catch(() => {}); } catch { return Promise.resolve(); }
}
function setDie(el, value) { if (Number.isInteger(value) && value >= 1 && value <= 6) try { window.BS_DICE?.set?.(el, value); } catch {} }
function firstName(name) { return String(name || 'لاعب'); }

/* ---------- Snakes & Ladders ---------- */
let snakes = null;

function buildSnakes(roundId) {
  const root = node('div', 'pb-snakes');
  const banner = node('div', 'pb-banner');
  const wrap = node('div', 'pb-board-wrap'); wrap.id = 'boardWrap';
  const board = node('div', 'pb-board'); board.id = 'board'; board.dir = 'ltr';
  for (let r = 9; r >= 0; r--) {
    const row = Array.from({ length: 10 }, (_, i) => r * 10 + i + 1);
    if (r % 2) row.reverse();
    row.forEach((n, i) => {
      const cell = node('div', 'snake-cell pb-cell'); cell.dataset.n = n;
      cell.style.setProperty('--t', ROW_TILES[r][(r + i) % 2]);
      if (n === 1) cell.classList.add('pb-start');
      if (n === 100) cell.classList.add('pb-goal');
      cell.append(node('b', '', String(n)));
      board.append(cell);
    });
  }
  const pawns = node('div', 'pb-pawns'); board.append(pawns);
  wrap.append(board);
  const dock = node('div', 'pb-dock');
  const dieBox = node('div', 'pb-die-box'); const die = node('div', 'die'); die.dataset.value = '1'; dieBox.append(die);
  const note = node('p', 'pb-note'); note.setAttribute('role', 'status'); note.setAttribute('aria-live', 'polite');
  const lane = node('div', 'pb-lane');
  dock.append(dieBox, node('div', 'pb-dock-text'));
  dock.lastChild.append(note, lane);
  const players = node('div', 'pb-players');
  root.append(banner, wrap, dock, players);
  return { round: roundId, root, banner, wrap, board, pawns, die, note, lane, players, pieces: [], shown: null, count: -1, chain: Promise.resolve(), animating: false, layoutKey: '', ro: null, meals: new Map(), lastText: '' };
}

function cellCenter(v, n) {
  const cell = v.board.querySelector(`.pb-cell[data-n="${n}"]`); const w = v.board.clientWidth || 1, h = v.board.clientHeight || 1;
  if (!cell) return { x: 50, y: 50, size: 10 };
  return { x: (cell.offsetLeft + cell.offsetWidth / 2) / w * 100, y: (cell.offsetTop + cell.offsetHeight / 2) / h * 100, size: cell.offsetWidth / w * 100 };
}

// The living snakes and ladders of the main game, drawn on this board.
function layoutCreatures(v, jumps) {
  if (!v.root.isConnected || !window.BS_ARENA?.layout) return;
  const w = v.board.clientWidth, h = v.board.clientHeight; if (!w || !h) return;
  const key = w + 'x' + h + ':' + JSON.stringify(jumps || {});
  if (key === v.layoutKey && v.wrap.querySelector('canvas')) return;
  v.layoutKey = key;
  const center = (n) => { const c = cellCenter(v, n); return { x: c.x * 10, y: c.y * 10 }; };
  window.BS_ARENA.layout(Object.entries(jumps || {}).map(([from, to]) => ({ from: Number(from), to: Number(to), a: center(Number(from)), b: center(Number(to)) })));
  for (const [from, meals] of v.meals) window.BS_ARENA.meal?.(from, meals);
}

function markJumps(v, jumps) {
  for (const cell of v.board.querySelectorAll('.pb-cell')) {
    const n = Number(cell.dataset.n), to = Number(jumps?.[n]);
    cell.classList.toggle('pb-ladder-foot', to > n);
    cell.classList.toggle('pb-snake-head', to > 0 && to < n);
  }
}

// Stones that share a cell stand side by side; more stones, smaller stones.
function placePawns(v, positions, moving = -1, movingAt = null) {
  const occupants = new Map();
  positions.forEach((pos, i) => {
    const at = i === moving && movingAt !== null ? movingAt : pos;
    if (at > 0) { if (!occupants.has(at)) occupants.set(at, []); occupants.get(at).push(i); }
  });
  positions.forEach((pos, i) => {
    const piece = v.pieces[i]; if (!piece) return;
    const at = i === moving && movingAt !== null ? movingAt : pos;
    piece.classList.toggle('off-board', !(at > 0));
    if (!(at > 0)) return;
    const list = occupants.get(at), k = list.length, idx = list.indexOf(i), c = cellCenter(v, at);
    const cols = k <= 1 ? 1 : k <= 4 ? 2 : 3, rows = Math.ceil(k / cols), scale = k <= 1 ? 0.8 : k <= 4 ? 0.56 : 0.42;
    const step = c.size * (k <= 4 ? 0.36 : 0.3);
    const dx = ((idx % cols) - (cols - 1) / 2) * step, dy = (Math.floor(idx / cols) - (rows - 1) / 2) * step * 0.9;
    piece.style.left = (c.x + dx) + '%'; piece.style.top = (c.y + dy + c.size * 0.18) + '%';
    piece.style.setProperty('--pw', (c.size * scale) + '%');
    piece.style.zIndex = String(10 + Math.round(c.y + dy));
  });
}

function renderLane(v, positions, names) {
  const waiting = positions.map((pos, i) => (pos > 0 ? null : i)).filter((i) => i !== null);
  v.lane.replaceChildren();
  if (!waiting.length) return;
  const label = node('span', 'pb-lane-label', 'خارج اللوحة'); v.lane.append(label);
  for (const i of waiting) { const chip = node('span', 'pb-lane-pawn'); chip.title = names[i] || ''; chip.append(pawnIcon(seatColor(i))); v.lane.append(chip); }
}

function ensurePieces(v, count, names) {
  while (v.pieces.length < count) {
    const i = v.pieces.length, piece = node('span', 'pb-pawn'); piece.dataset.seat = i;
    piece.style.setProperty('--seat', seatColor(i)); piece.append(pawnIcon(seatColor(i)));
    v.pawns.append(piece); v.pieces.push(piece);
  }
  v.pieces.forEach((piece, i) => { piece.title = names[i] || ''; piece.hidden = i >= count; });
}

function say(v, text) { v.note.textContent = text || ''; }

async function glide(v, seat, to, duration) {
  const piece = v.pieces[seat]; if (!piece) return;
  piece.classList.add('gliding'); piece.style.setProperty('--glide', (reduced() ? 0 : duration) + 'ms');
  const positions = v.shown.slice(); positions[seat] = to; placePawns(v, positions);
  await sleep(duration); piece.classList.remove('gliding');
}

async function animateSnakesMove(v, t, names) {
  const e = t.lastEvent;
  if (!e || !v.shown) return;
  const seat = e.player, name = firstName(names[seat]);
  v.animating = true;
  try {
    await rollDie(v.die, t.lastRoll);
    if (e.waitingEntry) { say(v, `${name} رمى ${t.lastRoll}؛ يحتاج 6 للدخول`); return; }
    if (e.blocked) { say(v, `${name} يحتاج الرقم المضبوط للوصول إلى 100`); return; }
    let at = e.entered ? 0 : e.from;
    if (at === 0) { at = 1; v.shown[seat] = 1; placePawns(v, v.shown); cue('step', { volume: 0.4 }); await sleep(260); }
    v.pieces[seat]?.classList.add('hopping');
    for (let n = at + 1; n <= e.landed; n++) { v.shown[seat] = n; placePawns(v, v.shown); cue('step', { volume: 0.3 }); await sleep(170); }
    v.pieces[seat]?.classList.remove('hopping');
    const arena = window.BS_ARENA;
    if (e.jumpType === 'ladder') {
      say(v, `سلّم! ${name} يصعد من ${e.landed} إلى ${e.to}`);
      arena?.ladder?.(e.landed, 'wake'); await sleep(320);
      arena?.ladder?.(e.landed, 'climbing'); cue('ladderClimb', { volume: 0.5 });
      await glide(v, seat, e.to, 820); v.shown[seat] = e.to;
      arena?.ladder?.(e.landed, null); cue('ladderLand', { volume: 0.4 });
    } else if (e.jumpType === 'snake') {
      say(v, `ثعبان! ${name} ينزل من ${e.landed} إلى ${e.to}`);
      arena?.phase?.(e.landed, 'tracking'); await sleep(380);
      arena?.phase?.(e.landed, 'attacking'); cue('snakeBite', { volume: 0.9 });
      v.pieces[seat]?.classList.add('swallowed'); await sleep(420);
      arena?.phase?.(e.landed, 'swallowing'); cue('snakeSwallow', { volume: 0.6 }); await sleep(700);
      const meals = Math.min(5, (v.meals.get(e.landed) || 0) + 1); v.meals.set(e.landed, meals); arena?.meal?.(e.landed, meals);
      arena?.phase?.(e.landed, 'releasing'); cue('snakeRelease', { volume: 0.5 });
      v.shown[seat] = e.to; placePawns(v, v.shown); await sleep(60);
      v.pieces[seat]?.classList.remove('swallowed'); await sleep(420);
      arena?.phase?.(e.landed, null);
    } else {
      say(v, e.extraTurn ? `${name} رمى 6؛ رمية إضافية` : `${name} رمى ${t.lastRoll} ووصل ${e.to}`);
    }
    if (t.winner !== null && t.winner !== undefined) cue('win');
  } finally {
    v.shown = t.players.map((p) => p.position); placePawns(v, v.shown);
    v.animating = false;
  }
}

export function renderPartySnakes(stage, controls, { roundId, t, me, myId, yourTurn, onRoll, onSettled }) {
  if (!snakes || snakes.round !== roundId) { try { snakes?.ro?.disconnect(); } catch {} snakes = buildSnakes(roundId); }
  const v = snakes, names = t.members.map((m) => (m.id === myId ? 'أنت' : m.name)), fullNames = t.members.map((m) => m.name);
  stage.append(v.root);
  if (!v.die.dataset.proDie) { mountDie(v.die); setDie(v.die, t.lastRoll || 1); }
  ensurePieces(v, t.players.length, fullNames);
  markJumps(v, t.jumps);
  if (!window.BS_ARENA && !v.waitingArena) { v.waitingArena = true; addEventListener('bs-arena-ready', () => { v.layoutKey = ''; layoutCreatures(v, v.jumps); }, { once: true }); }
  if (!v.ro && typeof ResizeObserver === 'function') {
    v.ro = new ResizeObserver(() => { v.layoutKey = ''; layoutCreatures(v, v.jumps); placePawns(v, v.shown || []); });
    v.ro.observe(v.board);
  }
  v.jumps = t.jumps;
  requestAnimationFrame(() => { layoutCreatures(v, t.jumps); if (v.shown && !v.animating) placePawns(v, v.shown); });
  const positions = t.players.map((p) => p.position), count = Number(t.moveCount ?? t.actions ?? 0);
  if (!v.shown) { v.shown = positions.slice(); v.count = count; placePawns(v, v.shown); if (t.lastEvent) say(v, t.lastRoll ? `آخر رمية: ${t.lastRoll}` : ''); }
  else if (count !== v.count) {
    const jump = count - v.count; v.count = count;
    const snapshot = structuredClone(t);
    v.chain = v.chain.then(() => (jump === 1 && v.root.isConnected ? animateSnakesMove(v, snapshot, fullNames) : (() => { v.shown = snapshot.players.map((p) => p.position); placePawns(v, v.shown); setDie(v.die, snapshot.lastRoll); })())).catch(() => {}).then(() => { paintSnakesChrome(v, snapshot, me, myId, names, yourTurn); renderLane(v, v.shown, fullNames); onSettled?.(); });
  }
  renderLane(v, v.shown, fullNames);
  paintSnakesChrome(v, t, me, myId, names, yourTurn);
  const roll = node('button', 'party-primary pb-roll', yourTurn ? 'ارمِ النرد 🎲' : 'بانتظار دورك');
  roll.type = 'button'; roll.disabled = !yourTurn || v.animating;
  roll.onclick = () => { if (roll.disabled) return; roll.disabled = true; v.die.classList.add('is-rolling'); onRoll(); setTimeout(() => v.die.classList.remove('is-rolling'), 900); };
  v.die.onclick = () => { if (!roll.disabled) roll.click(); };
  v.die.style.cursor = yourTurn ? 'pointer' : 'default';
  controls.append(roll);
}

function paintSnakesChrome(v, t, me, myId, names, yourTurn) {
  if (!v.root.isConnected && v.lastText) return;
  const turn = t.turn, mine = t.members[turn]?.id === myId, winner = t.winner;
  v.banner.replaceChildren();
  const dot = node('i', 'pb-seat-dot'); dot.style.background = seatColor(turn);
  const text = node('b', '', winner !== null && winner !== undefined ? `🏆 ${names[winner]} وصل 100` : mine ? 'دورك! ارمِ النرد' : `دور ${names[turn] || '—'}`);
  v.banner.append(dot, text);
  const left = Math.max(0, Math.ceil(((t.turnDeadline || 0) - Date.now()) / 1000));
  if (winner === null || winner === undefined) { const timer = node('span', 'pb-turn-time', left ? left + 'ث' : ''); v.banner.append(timer); }
  v.banner.classList.toggle('mine', Boolean(mine && yourTurn));
  v.players.replaceChildren(...t.members.map((m, i) => {
    const chip = node('div', 'pb-player' + (i === turn && (winner === null || winner === undefined) ? ' turn' : '') + (i === winner ? ' winner' : '') + (m.id === myId ? ' me' : ''));
    chip.style.setProperty('--seat', seatColor(i));
    const icon = node('span', 'pb-player-pawn'); icon.append(pawnIcon(seatColor(i)));
    const label = node('span', 'pb-player-name', m.id === myId ? m.name + ' · أنت' : m.name);
    const pos = t.players[i]?.position || 0;
    const where = node('span', 'pb-player-pos', pos > 0 ? String(pos) : '٠');
    where.title = pos > 0 ? 'الخانة ' + pos : 'خارج اللوحة';
    chip.append(icon, label, where); return chip;
  }));
  v.lastText = v.banner.textContent;
}

/* ---------- Dice race ---------- */
let race = null;

function buildRace(roundId) {
  const root = node('div', 'pb-race');
  const banner = node('div', 'pb-banner');
  const center = node('div', 'pb-race-center');
  const dieBox = node('div', 'pb-die-box big'); const die = node('div', 'die'); die.dataset.value = '1'; dieBox.append(die);
  const pot = node('div', 'pb-pot'); pot.append(node('small', '', 'رصيد الرمية'), node('b', '', '0'));
  center.append(dieBox, pot);
  const note = node('p', 'pb-note'); note.setAttribute('role', 'status'); note.setAttribute('aria-live', 'polite');
  const track = node('div', 'pb-track');
  const log = node('div', 'pb-log');
  root.append(banner, center, note, track, log);
  return { round: roundId, root, banner, die, pot, note, track, log, count: -1, chain: Promise.resolve(), animating: false };
}

function describe(h, names) {
  const name = firstName(names[h.player]);
  if (h.type === 'bust') return { text: `${name} رمى 1 وخسر ${h.total}`, kind: 'bust' };
  if (h.type === 'bank') return { text: `${name} ثبّت ${h.gain} (صار ${h.score})`, kind: 'bank' };
  return { text: `${name} رمى ${h.roll}`, kind: 'roll' };
}

export function renderPartyDice(stage, controls, { roundId, t, myId, yourTurn, onRoll, onBank, onSettled }) {
  if (!race || race.round !== roundId) race = buildRace(roundId);
  const v = race, names = t.members.map((m) => m.name), count = Number(t.actions || 0);
  stage.append(v.root);
  if (!v.die.dataset.proDie) { mountDie(v.die); setDie(v.die, t.lastRoll || 1); }
  const last = (t.history || []).at(-1);
  if (v.count < 0) v.count = count;
  else if (count !== v.count) {
    const jump = count - v.count; v.count = count;
    if (last && last.type !== 'bank' && jump === 1) {
      v.animating = true;
      v.chain = v.chain.then(async () => { await rollDie(v.die, t.lastRoll); if (last.type === 'bust') { v.root.classList.remove('busted'); void v.root.offsetWidth; v.root.classList.add('busted'); cue('wrong'); } }).catch(() => {}).then(() => { v.animating = false; onSettled?.(); });
    } else { setDie(v.die, t.lastRoll); if (last?.type === 'bank') cue('reward', { volume: 0.5 }); }
  }
  const turn = t.turn, mine = t.members[turn]?.id === myId, winner = t.winner;
  v.banner.replaceChildren();
  const dot = node('i', 'pb-seat-dot'); dot.style.background = seatColor(turn);
  v.banner.append(dot, node('b', '', winner !== null && winner !== undefined ? `🏆 ${names[winner]} وصل ${t.target}` : mine ? 'دورك! ارمِ أو ثبّت' : `دور ${names[turn] || '—'}`));
  const left = Math.max(0, Math.ceil(((t.turnDeadline || 0) - Date.now()) / 1000));
  if (winner === null || winner === undefined) v.banner.append(node('span', 'pb-turn-time', left ? left + 'ث' : ''));
  v.banner.classList.toggle('mine', Boolean(mine && yourTurn));
  v.pot.lastChild.textContent = String(t.turnTotal || 0);
  v.note.textContent = last ? describe(last, names).text : `أول من يوصل ${t.target} يفوز. الرقم 1 يضيّع رصيد الرمية.`;
  v.track.replaceChildren(...t.players.map((p, i) => {
    const row = node('div', 'pb-lane-row' + (i === turn && (winner === null || winner === undefined) ? ' turn' : '') + (i === winner ? ' winner' : '') + (t.members[i]?.id === myId ? ' me' : ''));
    row.style.setProperty('--seat', seatColor(i));
    const share = Math.max(0, Math.min(1, (p.score || 0) / (t.target || 1)));
    const pending = i === turn ? Math.max(0, Math.min(1 - share, (t.turnTotal || 0) / (t.target || 1))) : 0;
    row.style.setProperty('--share', share); row.style.setProperty('--pending', pending);
    const name = node('span', 'pb-lane-name', t.members[i]?.id === myId ? names[i] + ' · أنت' : names[i]);
    const bar = node('span', 'pb-lane-bar'); bar.append(node('i', 'done'), node('i', 'pending'));
    const icon = node('span', 'pb-bar-pawn'); icon.append(pawnIcon(seatColor(i))); bar.append(icon);
    const score = node('b', 'pb-lane-score', String(p.score || 0));
    row.append(name, bar, score); return row;
  }));
  v.log.replaceChildren(...(t.history || []).slice(-6).reverse().map((h) => { const d = describe(h, names); return node('span', 'pb-log-item ' + d.kind, d.text); }));
  const roll = node('button', 'party-primary pb-roll', 'ارمِ النرد 🎲'); roll.type = 'button';
  const bank = node('button', 'party-secondary pb-bank', `ثبّت ${t.turnTotal || 0}`); bank.type = 'button';
  roll.disabled = !yourTurn || v.animating; bank.disabled = !yourTurn || v.animating || !(t.turnTotal > 0);
  roll.onclick = () => { if (roll.disabled) return; roll.disabled = bank.disabled = true; onRoll(); };
  bank.onclick = () => { if (bank.disabled) return; roll.disabled = bank.disabled = true; onBank(); };
  v.die.onclick = () => { if (!roll.disabled) roll.click(); };
  controls.append(roll, bank);
}
