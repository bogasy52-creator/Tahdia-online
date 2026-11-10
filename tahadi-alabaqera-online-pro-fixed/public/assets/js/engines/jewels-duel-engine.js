/* Tahdia 33.9.5 — «ماستر الجواهر»: a match-3 duel on one shared board, the way the popular duel
   games play it. One module for the page (vs the computer, two on one phone) and the server
   (online tables in BoardRoom): every random number comes from the state's own seed, so the
   server's move replays the same on each phone.

   Rules
   - Two players share one 8×8 board and take turns. A turn is 2 moves; 5 rounds each.
   - Every gem you break is a point for you, cascades included. The last round counts double.
   - Four in a line makes a rocket (clears its line), an L or T makes a bomb (3×3), five in a line
     makes a light gem (clears every gem of the colour it is swapped with). Swapping two special
     gems fires them together. Making a special gem gives one extra move (two at most in a turn).
   - Three boosters charge from the gems of their colour you break: the hammer (red, a 3×3 blast
     where you tap), the twin rockets (blue, a row and a column) and the storm (purple, every gem
     of the colour you tap). A booster costs no move.
   - The board is shuffled when nobody can move. A draw goes to the bigger single move, then to
     the player who moved second. */

export const JD = Object.freeze({ W: 8, H: 8, COLORS: 6, ROUNDS: 5, MOVES: 2, LAST_DOUBLE: true });
export const GEM_NAMES = Object.freeze(['أحمر', 'أصفر', 'أخضر', 'أزرق', 'بنفسجي', 'برتقالي']);
export const BOOSTERS = Object.freeze([
  Object.freeze({ id: 'hammer', color: 0, need: 22, name: 'المطرقة', text: 'تفجّر 3×3 وين ما تضغط' }),
  Object.freeze({ id: 'cross', color: 3, need: 26, name: 'الصاروخين', text: 'تمسح الصف والعمود' }),
  Object.freeze({ id: 'storm', color: 4, need: 32, name: 'العاصفة', text: 'تمسح كل جواهر اللون اللي تضغطه' }),
]);
const W = JD.W, H = JD.H, N = W * H;
const clone = (s) => JSON.parse(JSON.stringify(s));
const xOf = (i) => i % W, yOf = (i) => (i / W) | 0, at = (x, y) => y * W + x;
const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
export const adjacent = (a, b) => Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b >= 0 && a < N && b < N && Math.abs(xOf(a) - xOf(b)) + Math.abs(yOf(a) - yOf(b)) === 1;

function rnd(s) { let n = s.seed >>> 0 || 1; n ^= n << 13; n >>>= 0; n ^= n >>> 17; n ^= n << 5; n >>>= 0; s.seed = n || 1; return s.seed / 4294967296; }
const gem = (s, c, sp = '') => ({ i: ++s.serial, c, s: sp });
const colorAt = (b, i) => (b[i] && b[i].s !== 'ball' ? b[i].c : -1);

/* ---------- matches ---------- */
function runsOf(b) {
  const runs = [];
  for (let axis = 0; axis < 2; axis++) {
    const lines = axis ? W : H, len = axis ? H : W;
    for (let line = 0; line < lines; line++) {
      let k = 0;
      while (k < len) {
        const cell = (j) => (axis ? at(line, j) : at(j, line)), c = colorAt(b, cell(k));
        let e = k + 1;
        while (c >= 0 && e < len && colorAt(b, cell(e)) === c) e++;
        if (c >= 0 && e - k >= 3) runs.push({ axis, c, cells: Array.from({ length: e - k }, (_, j) => cell(k + j)) });
        k = e;
      }
    }
  }
  return runs;
}
/** Groups of touching runs of one colour: each becomes one clear (and maybe one special gem). */
export function findGroups(b) {
  const groups = [];
  for (const run of runsOf(b)) {
    const touching = groups.filter((g) => g.c === run.c && run.cells.some((i) => g.set.has(i)));
    const g = { c: run.c, set: new Set(run.cells), runs: [run] };
    for (const o of touching) { for (const i of o.set) g.set.add(i); g.runs.push(...o.runs); groups.splice(groups.indexOf(o), 1); }
    groups.push(g);
  }
  return groups.map((g) => ({ c: g.c, cells: [...g.set], runs: g.runs }));
}
function specialFor(group) {
  const longest = Math.max(...group.runs.map((r) => r.cells.length));
  const axes = new Set(group.runs.map((r) => r.axis));
  if (longest >= 5) return 'ball';
  if (axes.size > 1 && group.cells.length >= 5) return 'bomb';
  if (longest === 4) return group.runs.find((r) => r.cells.length === 4).axis ? 'rv' : 'rh';
  return '';
}
const hasMatchAt = (b, i) => {
  const c = colorAt(b, i); if (c < 0) return false;
  const x = xOf(i), y = yOf(i); let n = 1;
  for (let k = x - 1; k >= 0 && colorAt(b, at(k, y)) === c; k--) n++;
  for (let k = x + 1; k < W && colorAt(b, at(k, y)) === c; k++) n++;
  if (n >= 3) return true; n = 1;
  for (let k = y - 1; k >= 0 && colorAt(b, at(x, k)) === c; k--) n++;
  for (let k = y + 1; k < H && colorAt(b, at(x, k)) === c; k++) n++;
  return n >= 3;
};
const isSpecial = (t) => Boolean(t && t.s);
/** Every swap that does something: a match, a light gem, or two special gems. */
export function legalSwaps(stateOrBoard) {
  const b = Array.isArray(stateOrBoard) ? stateOrBoard : stateOrBoard.board, out = [];
  for (let i = 0; i < N; i++) for (const j of [i + 1, i + W]) {
    if (j >= N || (j === i + 1 && xOf(j) === 0) || !b[i] || !b[j]) continue;
    if (b[i].s === 'ball' || b[j].s === 'ball' || (isSpecial(b[i]) && isSpecial(b[j]))) { out.push([i, j]); continue; }
    const t = b[i]; b[i] = b[j]; b[j] = t;
    const ok = hasMatchAt(b, i) || hasMatchAt(b, j);
    b[j] = b[i]; b[i] = t;
    if (ok) out.push([i, j]);
  }
  return out;
}

/* ---------- the board ---------- */
function freshBoard(s) {
  for (let tries = 0; tries < 60; tries++) {
    const b = [];
    for (let i = 0; i < N; i++) {
      const x = xOf(i), y = yOf(i), bad = new Set();
      if (x > 1 && b[i - 1].c === b[i - 2].c) bad.add(b[i - 1].c);
      if (y > 1 && b[i - W].c === b[i - 2 * W].c) bad.add(b[i - W].c);
      const choices = [...Array(JD.COLORS).keys()].filter((c) => !bad.has(c));
      b.push(gem(s, choices[Math.floor(rnd(s) * choices.length)]));
    }
    if (legalSwaps(b).length >= 3) return b;
  }
  throw new Error('board_failed');
}
function shuffle(s) {
  const tiles = s.board.filter(Boolean);
  for (let tries = 0; tries < 80; tries++) {
    for (let i = tiles.length - 1; i > 0; i--) { const j = Math.floor(rnd(s) * (i + 1)); [tiles[i], tiles[j]] = [tiles[j], tiles[i]]; }
    const b = tiles.slice();
    if (!findGroups(b).length && legalSwaps(b).length) { s.board = b; return; }
  }
  s.board = freshBoard(s);
}

/* ---------- what a special gem breaks ---------- */
function mostColor(b, except = -1) {
  const n = Array(JD.COLORS).fill(0);
  for (const t of b) if (t && t.s !== 'ball' && t.c !== except) n[t.c]++;
  return n.indexOf(Math.max(...n));
}
function area(cx, cy, r) { const out = []; for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (inside(x, y)) out.push(at(x, y)); return out; }
const row = (y) => Array.from({ length: W }, (_, x) => at(x, y)), col = (x) => Array.from({ length: H }, (_, y) => at(x, y));
function blastOf(b, i, fx) {
  const t = b[i]; if (!t) return [];
  if (t.s === 'rh') { fx.push(['rh', i]); return row(yOf(i)); }
  if (t.s === 'rv') { fx.push(['rv', i]); return col(xOf(i)); }
  if (t.s === 'bomb') { fx.push(['bomb', i]); return area(xOf(i), yOf(i), 1); }
  if (t.s === 'ball') { const c = mostColor(b); fx.push(['ball', i, c]); return b.map((g, k) => (g && g.c === c && g.s !== 'ball' ? k : -1)).filter((k) => k >= 0); }
  return [];
}
/** Clear a set of cells; special gems inside it go off too (a chain). Returns the cells broken. */
function detonate(b, start, fx, keep = new Set()) {
  const out = new Set(), queue = [...start], fired = new Set();
  while (queue.length) {
    const i = queue.shift();
    if (i < 0 || i >= N || out.has(i) || keep.has(i) || !b[i]) continue;
    out.add(i);
    if (b[i].s && !fired.has(i)) { fired.add(i); for (const k of blastOf(b, i, fx)) if (!out.has(k)) queue.push(k); }
  }
  return [...out];
}

/* ---------- a move: clear, fall, refill, again ---------- */
function settle(s, seat, first, opts) {
  const phases = [], mult = JD.LAST_DOUBLE && s.round === JD.ROUNDS ? 2 : 1;
  let made = 0, total = 0, clearSet = first.clear, makeList = first.make || [], fx = first.fx || [];
  for (let guard = 0; guard < 40; guard++) {
    const b = s.board, keep = new Set(makeList.map(([i]) => i));
    const broken = detonate(b, clearSet, fx, keep);
    if (!broken.length && !makeList.length) break;
    const colors = Array(JD.COLORS).fill(0);
    for (const i of broken) if (b[i].c >= 0 && b[i].s !== 'ball') colors[b[i].c]++;
    const points = broken.length * mult;
    total += points;
    const p = s.players[seat];
    p.score += points;
    BOOSTERS.forEach((bo, k) => { if (opts.charge !== k) p.charge[k] = Math.min(bo.need, p.charge[k] + colors[bo.color]); });
    for (const i of broken) b[i] = null;
    for (const [i, sp, c] of makeList) { b[i] = gem(s, c, sp); made++; }
    p.specials += makeList.length;
    // gravity, then new gems from the top
    for (let x = 0; x < W; x++) {
      let write = H - 1;
      for (let y = H - 1; y >= 0; y--) { const t = b[at(x, y)]; if (t) { b[at(x, y)] = null; b[at(x, write)] = t; write--; } }
      for (let y = write; y >= 0; y--) b[at(x, y)] = gem(s, Math.floor(rnd(s) * JD.COLORS));
    }
    phases.push({ clear: broken, made: makeList.map(([i, sp]) => [i, sp]), fx, pts: points, board: clone(b) });
    // the next cascade
    const groups = findGroups(b);
    if (!groups.length) break;
    clearSet = []; makeList = []; fx = [];
    for (const g of groups) {
      const sp = specialFor(g);
      if (sp) {
        const spot = g.cells.slice().sort((p1, p2) => yOf(p2) - yOf(p1) || xOf(p1) - xOf(p2))[Math.floor(g.cells.length / 2)];
        makeList.push([spot, sp, sp === 'ball' ? -1 : g.c]);
        clearSet.push(...g.cells.filter((i) => i !== spot));
      } else clearSet.push(...g.cells);
    }
  }
  if (!legalSwaps(s).length) { shuffle(s); phases.push({ shuffle: true, clear: [], made: [], fx: [], pts: 0, board: clone(s.board) }); }
  return { phases, made, total };
}

function finishMove(s, seat, result, { usedMove }) {
  const p = s.players[seat];
  p.best = Math.max(p.best, result.total);
  if (!usedMove) return;
  s.moves -= 1;
  if (result.made > 0 && s.extras < 2) { s.moves += 1; s.extras += 1; s.last.extra = true; }
  if (s.moves > 0) return;
  // the turn passes
  s.extras = 0;
  s.turn = 1 - s.turn;
  if (s.turn === s.first) s.round += 1;
  s.moves = JD.MOVES;
  if (s.round > JD.ROUNDS) {
    s.round = JD.ROUNDS;
    s.moves = 0;
    const [a, b] = s.players;
    s.winner = a.score !== b.score ? (a.score > b.score ? 0 : 1) : a.best !== b.best ? (a.best > b.best ? 0 : 1) : 1 - s.first;
  }
}

/* ---------- public API ---------- */
export function createJewelsDuel(names = ['لاعب 1', 'لاعب 2'], { seed, rng = Math.random, first } = {}) {
  const s = {
    game: 'jewels', v: 1, seed: (seed ?? Math.floor(rng() * 4294967295)) >>> 0 || 7, serial: 0,
    players: names.slice(0, 2).map((name) => ({ name: String(name || 'لاعب').slice(0, 20), score: 0, charge: [0, 0, 0], best: 0, specials: 0 })),
    first: first ?? (rng() < 0.5 ? 0 : 1), turn: 0, round: 1, moves: JD.MOVES, extras: 0, winner: null, seq: 0, last: null, board: [],
  };
  s.turn = s.first;
  s.board = freshBoard(s);
  return s;
}

export function playJewelsSwap(state, seat, a, b) {
  if (state.winner !== null) throw new Error('match_over');
  if (seat !== state.turn) throw new Error('wrong_turn');
  a = Number(a); b = Number(b);
  if (!adjacent(a, b)) throw new Error('not_adjacent');
  const s = clone(state), B = s.board, ta = B[a], tb = B[b];
  if (!ta || !tb) throw new Error('empty');
  const before = clone(B);
  let first;
  B[a] = tb; B[b] = ta;
  // special swaps fire at once
  const A = B[b], Bt = B[a]; // A: the gem that moved to b (the one dragged), Bt: the gem now at a
  if (A.s === 'ball' || Bt.s === 'ball') {
    const ball = A.s === 'ball' ? b : a, other = ball === b ? a : b, o = B[other], fx = [];
    let clear;
    if (o.s === 'ball') { fx.push(['all', b]); clear = [...Array(N).keys()]; B[ball].s = ''; B[other].s = ''; }
    else if (o.s) {
      const c = o.c, kind = o.s;
      fx.push(['ball', ball, c]);
      B[ball].s = ''; B[ball].c = -1;
      clear = [ball];
      B.forEach((g, k) => { if (g && g.c === c && g.s !== 'ball') { g.s = kind === 'bomb' ? 'bomb' : (rnd(s) < 0.5 ? 'rh' : 'rv'); clear.push(k); } });
    } else { fx.push(['ball', ball, o.c]); B[ball].s = ''; B[ball].c = -1; clear = [ball, ...B.map((g, k) => (g && g.c === o.c && g.s !== 'ball' ? k : -1)).filter((k) => k >= 0)]; }
    first = { clear, fx };
  } else if (A.s && Bt.s) {
    const kinds = [A.s, Bt.s].sort().join('+'), x = xOf(b), y = yOf(b), fx = [], clear = new Set([a, b]);
    A.s = ''; Bt.s = '';
    if (kinds === 'bomb+bomb') { fx.push(['bomb2', b]); area(x, y, 2).forEach((k) => clear.add(k)); }
    else if (kinds.includes('bomb')) { fx.push(['bombline', b]); for (const d of [-1, 0, 1]) { if (inside(0, y + d)) row(y + d).forEach((k) => clear.add(k)); if (inside(x + d, 0)) col(x + d).forEach((k) => clear.add(k)); } }
    else { fx.push(['cross', b]); row(y).forEach((k) => clear.add(k)); col(x).forEach((k) => clear.add(k)); }
    first = { clear: [...clear], fx };
  } else {
    const groups = findGroups(B);
    if (!groups.length) throw new Error('no_match');
    const clear = [], make = [];
    for (const g of groups) {
      const sp = specialFor(g);
      if (sp) {
        const spot = g.cells.includes(b) ? b : g.cells.includes(a) ? a : g.cells[Math.floor(g.cells.length / 2)];
        make.push([spot, sp, sp === 'ball' ? -1 : g.c]);
        clear.push(...g.cells.filter((i) => i !== spot));
      } else clear.push(...g.cells);
    }
    first = { clear, make };
  }
  s.seq += 1;
  s.last = { seq: s.seq, seat, kind: 'swap', a, b, before, round: s.round, extra: false };
  const result = settle(s, seat, first, {});
  Object.assign(s.last, { phases: result.phases, total: result.total, made: result.made });
  finishMove(s, seat, result, { usedMove: true });
  return s;
}

export function playJewelsBooster(state, seat, id, cell) {
  if (state.winner !== null) throw new Error('match_over');
  if (seat !== state.turn) throw new Error('wrong_turn');
  const k = BOOSTERS.findIndex((b) => b.id === id); cell = Number(cell);
  if (k < 0) throw new Error('unknown_booster');
  if (!Number.isInteger(cell) || cell < 0 || cell >= N) throw new Error('bad_cell');
  if (state.players[seat].charge[k] < BOOSTERS[k].need) throw new Error('not_charged');
  const s = clone(state), B = s.board, x = xOf(cell), y = yOf(cell), fx = [[id, cell]];
  let clear;
  if (id === 'hammer') clear = area(x, y, 1);
  else if (id === 'cross') clear = [...new Set([...row(y), ...col(x)])];
  else { const c = B[cell]?.s === 'ball' ? mostColor(B) : B[cell]?.c; clear = B.map((g, i) => (g && g.c === c ? i : -1)).filter((i) => i >= 0); }
  s.players[seat].charge[k] = 0;
  s.seq += 1;
  s.last = { seq: s.seq, seat, kind: 'booster', booster: id, cell, before: clone(B), round: s.round, extra: false };
  const result = settle(s, seat, { clear, fx }, { charge: k });
  Object.assign(s.last, { phases: result.phases, total: result.total, made: result.made });
  finishMove(s, seat, result, { usedMove: false });
  return s;
}

/* ---------- the computer player ---------- */
function scoreSwap(state, seat, a, b, deep) {
  try {
    if (!deep) {
      const B = state.board.slice(); const t = B[a]; B[a] = B[b]; B[b] = t;
      if (B[a].s === 'ball' || B[b].s === 'ball') return 18;
      if (B[a].s && B[b].s) return 22;
      let pts = 0, bonus = 0;
      for (const g of findGroups(B)) { pts += g.cells.length; const sp = specialFor(g); bonus += sp === 'ball' ? 12 : sp === 'bomb' ? 8 : sp ? 6 : 0; for (const i of g.cells) if (B[i].s) bonus += 6; }
      return pts + bonus;
    }
    const after = playJewelsSwap(state, seat, a, b);
    return after.players[seat].score - state.players[seat].score + (after.turn === seat && state.moves === 1 ? 8 : 0) + after.last.made * 3;
  } catch { return -1; }
}
function bestBoosterCell(state, k) {
  const B = state.board, id = BOOSTERS[k].id; let best = -1, cell = 0;
  for (let i = 0; i < N; i++) {
    const x = xOf(i), y = yOf(i);
    let n;
    if (id === 'hammer') n = area(x, y, 1).length + area(x, y, 1).filter((j) => B[j]?.s).length * 4;
    else if (id === 'cross') n = row(y).length + col(x).length + [...row(y), ...col(x)].filter((j) => B[j]?.s).length * 4;
    else { const c = B[i]?.c; n = B.filter((g) => g && g.c === c).length + B.filter((g) => g && g.c === c && g.s).length * 4; }
    if (n > best) { best = n; cell = i; }
  }
  return cell;
}
/** The computer's move: {type:'booster', id, cell} or {type:'swap', a, b}. */
export function chooseJewelsMove(state, level = 'medium', rng = Math.random) {
  const seat = state.turn, p = state.players[seat];
  const ready = BOOSTERS.findIndex((b, k) => p.charge[k] >= b.need);
  if (ready >= 0 && (level !== 'easy' || rng() < 0.5)) return { type: 'booster', id: BOOSTERS[ready].id, cell: bestBoosterCell(state, ready) };
  const swaps = legalSwaps(state);
  if (!swaps.length) return null;
  const deep = level === 'hard';
  const scored = swaps.map(([a, b]) => ({ a, b, v: scoreSwap(state, seat, a, b, deep) + rng() * 0.5 })).sort((x, y) => y.v - x.v);
  const pick = level === 'easy' ? scored[Math.floor(rng() * Math.min(scored.length, Math.max(3, scored.length / 2)))] : level === 'medium' && rng() < 0.3 ? scored[Math.min(scored.length - 1, 1 + Math.floor(rng() * 3))] : scored[0];
  return { type: 'swap', a: pick.a, b: pick.b };
}
export function playJewelsAuto(state, level = 'medium', rng = Math.random) {
  const m = chooseJewelsMove(state, level, rng);
  if (!m) { const s = clone(state); shuffle(s); return s; }
  return m.type === 'booster' ? playJewelsBooster(state, state.turn, m.id, m.cell) : playJewelsSwap(state, state.turn, m.a, m.b);
}
/** A person out of time: the server makes a plain move for them (never a booster). */
export function jewelsTimeout(state) {
  const swaps = legalSwaps(state);
  if (!swaps.length) { const s = clone(state); shuffle(s); return s; }
  const scored = swaps.map(([a, b]) => ({ a, b, v: scoreSwap(state, state.turn, a, b, false) })).sort((x, y) => y.v - x.v);
  return playJewelsSwap(state, state.turn, scored[scored.length >> 1].a, scored[scored.length >> 1].b);
}
export const jewelsProgress = (state, seat) => Number(state?.players?.[seat]?.score) || 0;
/** The milliseconds a move needs on screen (each cascade is a beat). */
export const jewelsMoveMs = (last) => (last ? 420 + (last.phases?.length || 0) * 520 + (last.fx?.length || 0) * 120 : 300);
