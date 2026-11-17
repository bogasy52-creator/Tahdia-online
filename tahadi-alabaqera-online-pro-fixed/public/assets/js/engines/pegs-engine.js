/* Tahdia 33.10.1 — «شطرنج الذاكرة»: the wooden memory pawns. Twenty-four pawns stand in the holes of a
   round board, each with a coloured foot hidden in its hole — six colours, four pawns of each. The player
   rolls the colour die, picks a pawn and turns it over: the right colour is theirs and they roll again;
   the wrong one is shown to everyone and goes back, and the turn passes. The board starts face up for a
   few seconds to be learnt by heart. A streak of three or more makes every right pawn worth two.
   Shared by the pages (local games) and the rooms (online), so nothing here touches the page. */

export const PEGS = Object.freeze({ COLORS: 6, EACH: 4, COUNT: 24, PEEKS: 1, PEEK_MS: 7000, SHOW_MS: 1600, HOT: 3 });
export const PEG_COLORS = Object.freeze([
  { id: 'red', name: 'أحمر', hex: '#e8323f', dark: '#8e0f1c' },
  { id: 'yellow', name: 'أصفر', hex: '#ffcf24', dark: '#a87500' },
  { id: 'green', name: 'أخضر', hex: '#22b35b', dark: '#0d5c2b' },
  { id: 'blue', name: 'أزرق', hex: '#2a7fe8', dark: '#0d3c8a' },
  { id: 'white', name: 'أبيض', hex: '#f6f3ec', dark: '#9a9486' },
  { id: 'black', name: 'أسود', hex: '#2b2b30', dark: '#000000' },
  { id: 'orange', name: 'برتقالي', hex: '#ff832b', dark: '#a23e0d' },
  { id: 'purple', name: 'بنفسجي', hex: '#a271f4', dark: '#5427a0' },
]);
/** Where the holes are on a board of radius 1: twelve round the edge, eight inside them, four in the middle. */
export const pegsHoles=(large=false)=>large
  ? Array.from({length:48},(_,i)=>Object.freeze({x:((i%6)-2.5)*.27,y:(Math.floor(i/6)-3.5)*.265}))
  : [4,5,6,5,4].flatMap((n,row)=>Array.from({length:n},(_,col)=>Object.freeze({x:(col-(n-1)/2)*.29,y:(row-2)*.31})));
export const PEG_HOLES=Object.freeze(pegsHoles());
export const PEG_SYMBOLS=Object.freeze(['triangle','star','plus','diamond','circle','square','hexagon','moon']);
export const PEG_VARIANTS=Object.freeze(['classic','large','teams','race','race-large']);
export const pegsOptions=variant=>({large:['large','teams','race-large'].includes(variant),teams:variant==='teams'});


const clone = (s) => structuredClone(s);
const live = (s) => s.pegs.filter((p) => p.taken === null);
const left = (s, c) => s.pegs.some((p) => p.taken === null && p.c === c);
const nextSeat = (s, seat) => (seat + 1) % s.players.length;
function shuffle(list, rng) { for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; } return list; }

/** A new board: the colours shuffled into the holes, the first player chosen, the opening look. */
export function createPegsGame(names = ['لاعب 1', 'لاعب 2'], { rng = Math.random, first = null, showMs = PEGS.PEEK_MS, now = Date.now(), swaps = false, large = false, teams = false } = {}) {
  const n = Math.max(2, Math.min(6, names.length));
  if(teams&&![4,6].includes(n))throw Error('teams_require_even_seats');
  const colorCount=large?8:6;
  const colors = shuffle(Array.from({ length: large?48:24 }, (_, i) => i % colorCount), rng);
  return {
    game: 'pegs', seq: 0, turnNo: 0, large, teams, colorCount, winnerTeam:null,
    players: names.slice(0, n).map((name, i) => ({ name: String(name || 'لاعب ' + (i + 1)).slice(0, 24), score: 0, pegs: [], streak: 0, best: 0, peeks: PEGS.PEEKS, wrong: 0 })),
    pegs: colors.map((c) => ({ c, taken: null })),
    turn: first === null ? Math.floor(rng() * n) : Math.max(0, Math.min(n - 1, first)),
    phase: 'roll', die: null, winner: null, ties: [],
    lookUntil: now + Math.max(0, showMs), showMs: Math.max(0, showMs),
    swaps: Boolean(swaps), misses: 0, reveals: [], last: null, peek: null,
  };
}

/** Roll the colour die. A colour with no pawns left on the board rolls again (every face is kept for the show). */
export function rollPegs(state, seat, rng = Math.random) {
  if (state.winner !== null) throw new Error('match_over');
  if (seat !== state.turn) throw new Error('wrong_turn');
  if (state.phase !== 'roll') throw new Error('not_roll');
  const s = clone(state), faces = [];
  for (let k = 0; k < 40; k++) { const c = Math.floor(rng() * (s.colorCount||6)); faces.push(c); if (left(s, c)) break; }
  let c = faces[faces.length - 1];
  if (!left(s, c)) { c = live(s)[0].c; faces.push(c); }
  s.die = c; s.phase = 'pick'; s.seq++; s.peek = null;
  s.last = { seq: s.seq, type: 'roll', seat, color: c, faces, ms: 1300 + (faces.length - 1) * 500 };
  return s;
}

/** Turn a pawn over. The right colour is kept (and the same player rolls again); the wrong one is shown and the turn passes. */
export function pickPegs(state, seat, index, rng = Math.random) {
  if (state.winner !== null) throw new Error('match_over');
  if (seat !== state.turn) throw new Error('wrong_turn');
  if (state.phase !== 'pick') throw new Error('not_pick');
  const i = Number(index), peg = state.pegs[i];
  if (!Number.isInteger(i) || !peg || peg.taken !== null) throw new Error('invalid_peg');
  const s = clone(state), p = s.players[seat], ok = s.pegs[i].c === s.die;
  let gained = 0, swapped = null;
  if (ok) {
    p.streak++; p.best = Math.max(p.best, p.streak);
    gained = s.teams ? 1 : p.streak >= PEGS.HOT ? 2 : 1; p.score += gained;
    s.pegs[i].taken = seat; p.pegs.push(s.pegs[i].c);
    s.phase = 'roll';
  } else {
    p.streak = 0; p.wrong++; s.misses++;
    s.reveals = [...(s.reveals || []), { peg: i, c: s.pegs[i].c, turn: s.turnNo }].slice(-60);
    s.turn = nextSeat(s, seat); s.turnNo++; s.phase = 'roll';
    // the challenge table: after every third miss two pawns trade places (everyone sees which)
    if (s.swaps && s.misses % 3 === 0) {
      const free = live(s).map((x) => s.pegs.indexOf(x)).filter((k) => k !== i);
      if (free.length >= 2) { shuffle(free, rng); const [a, b] = free; [s.pegs[a], s.pegs[b]] = [s.pegs[b], s.pegs[a]]; swapped = [a, b]; s.reveals = s.reveals.map((r) => (r.peg === a ? { ...r, peg: b } : r.peg === b ? { ...r, peg: a } : r)); }
    }
  }
  const die = s.die; s.die = null; s.seq++; s.peek = null;
  s.last = { seq: s.seq, type: 'pick', seat, peg: i, color: state.pegs[i].c, die, ok, gained, streak: ok ? p.streak : 0, swapped, ms: ok ? 1500 : swapped ? 3200 : 2300 };
  if (!live(s).length) finish(s);
  return s;
}

/** «عين الصقر»: once a game, a player looks under one pawn alone. The rooms show its colour only to them. */
export function peekPegs(state, seat, index) {
  if (state.winner !== null) throw new Error('match_over');
  if (seat !== state.turn) throw new Error('wrong_turn');
  const i = Number(index), peg = state.pegs[i], p = state.players[seat];
  if (!Number.isInteger(i) || !peg || peg.taken !== null) throw new Error('invalid_peg');
  if (!(p.peeks > 0)) throw new Error('no_peeks');
  const s = clone(state); s.players[seat].peeks--; s.seq++;
  s.peek = { seat, peg: i, c: s.pegs[i].c };
  s.last = { seq: s.seq, type: 'peek', seat, peg: i, ms: 1200 };
  return s;
}

/** Out of time: a roll is rolled, a pick is made at random. */
export function pegsTimeout(state, rng = Math.random) {
  if (state.winner !== null) return state;
  if (state.phase === 'roll') return rollPegs(state, state.turn, rng);
  const free = state.pegs.map((p, i) => (p.taken === null ? i : -1)).filter((i) => i >= 0);
  return pickPegs(state, state.turn, free[Math.floor(rng() * free.length)], rng);
}

function finish(s) {
  if(s.teams){const count=s.players.length/2,totals=Array.from({length:count},(_,team)=>s.players.reduce((n,p,i)=>n+(i%count===team?p.pegs.length:0),0)),top=Math.max(...totals),winners=totals.map((n,i)=>n===top?i:-1).filter(i=>i>=0);s.winnerTeam=winners.length===1?winners[0]:-1;const seats=s.players.map((_,i)=>i).filter(i=>winners.includes(i%count));s.ties=winners.length>1?seats:[];s.winner=seats[0];s.phase='over';return;}
  const top = Math.max(...s.players.map((p) => p.score));
  let best = s.players.map((p, i) => i).filter((i) => s.players[i].score === top);
  if (best.length > 1) { const streak = Math.max(...best.map((i) => s.players[i].best)); best = best.filter((i) => s.players[i].best === streak); }
  s.winner = best[0]; s.ties = best.length > 1 ? best : []; s.phase = 'over';
}

export function pegsProgress(state, seat) { return state.players[seat]?.score || 0; }

/* ---------- the computer: a memory that holds what it saw, more or less well ---------- */
// tuned on 400 games each: a player who remembers nothing turns the right pawn 20% of the time;
// easy about 31%, medium about 54%, hard about 70%
const LEVELS = Object.freeze({ easy: { look: 0.05, keep: 1, slip: 0.4 }, medium: { look: 0.18, keep: 4, slip: 0.2 }, hard: { look: 0.38, keep: 16, slip: 0.06 } });
function hash(a, b) { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
/** What a computer player at `level` believes is under each pawn (-1 when it does not know). */
export function pegsMemory(state, seat, level = 'medium') {
  const L = LEVELS[level] || LEVELS.medium, know = state.pegs.map(() => -1);
  state.pegs.forEach((p, i) => { if (p.taken === null && hash(i + 1, (seat + 1) * 97 + (state.salt || 0)) < L.look) know[i] = p.c; });
  for (const r of state.reveals || []) if (state.turnNo - r.turn <= L.keep && state.pegs[r.peg]?.taken === null) know[r.peg] = r.c;
  return know;
}
/** The computer's next move: roll, or pick the pawn it believes has the die's colour. */
export function choosePegsMove(state, level = 'medium', rng = Math.random) {
  if (state.phase === 'roll') return { type: 'roll' };
  const L = LEVELS[level] || LEVELS.medium, know = pegsMemory(state, state.turn, level);
  const free = state.pegs.map((p, i) => (p.taken === null ? i : -1)).filter((i) => i >= 0);
  const sure = free.filter((i) => know[i] === state.die);
  if (sure.length && rng() > L.slip) return { type: 'pick', peg: sure[Math.floor(rng() * sure.length)] };
  const unknown = free.filter((i) => know[i] === -1);
  const pool = unknown.length ? unknown : free;
  return { type: 'pick', peg: pool[Math.floor(rng() * pool.length)] };
}
