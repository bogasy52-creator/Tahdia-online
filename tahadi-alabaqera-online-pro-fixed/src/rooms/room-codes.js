// 33.0.0: a room code tells which game it belongs to, so a player can type any
// code anywhere and land in the right game. The first two digits name the game;
// the other four are random. Codes made before 33.0.0 were random everywhere:
// those are found by asking each kind of room in turn (they live a day at most).
export const ROOM_FAMILIES = Object.freeze({
  quiz: { from: 10, to: 14, page: '/online' },
  party: { from: 15, to: 19, page: '/party' },
  sudoku: { from: 20, to: 24, page: '/sudoku' },
  paths: { from: 25, to: 29, page: '/paths-online' },
  picture: { from: 30, to: 34, page: '/picture' },
  serpent: { from: 35, to: 39, page: '/serpent' },
  snakes: { from: 40, to: 44, page: '/snakes' },
  zahra: { from: 45, to: 49, page: '/zahra' },
  jackaroo: { from: 50, to: 54, page: '/jackaroo' },
  dice: { from: 55, to: 59, page: '/dice' },
  baloot: { from: 60, to: 64, page: '/baloot' },
  memory: { from: 65, to: 69, page: '/memory' },
  logic: { from: 70, to: 74, page: '/logic' },
  puzzle: { from: 75, to: 79, page: '/puzzle' },
  reaction: { from: 80, to: 84, page: '/reaction' },
  jewels: { from: 85, to: 89, page: '/journey' },
  colors: { from: 90, to: 94, page: '/journey' },
});

const random = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n;

/** A fresh code for a game: its two-digit prefix plus four random digits. */
export function roomCodeFor(game) {
  const family = ROOM_FAMILIES[game];
  if (!family) return String(100000 + random(900000));
  const prefix = family.from + random(family.to - family.from + 1);
  return String(prefix) + String(random(10000)).padStart(4, '0');
}

/** The game a code was made for (by its prefix), or null. */
export function gameOfCode(code) {
  if (!/^\d{6}$/.test(String(code || ''))) return null;
  const prefix = Number(String(code).slice(0, 2));
  for (const [game, family] of Object.entries(ROOM_FAMILIES)) if (prefix >= family.from && prefix <= family.to) return game;
  return null;
}

export const pageOfGame = (game) => ROOM_FAMILIES[game]?.page || null;

// Where each kind of room lives, and how to ask it whether a code exists.
// Board rooms (snakes, zahra, jackaroo, dice, baloot) share one namespace and
// say their game in their status.
function probeFor(kind, env, code) {
  const usable = (ns) => typeof ns?.idFromName === 'function' && typeof ns?.get === 'function';
  if (kind === 'board') return usable(env.BOARD_ROOMS) && { stub: env.BOARD_ROOMS.get(env.BOARD_ROOMS.idFromName(code)), url: 'https://board.internal/status' };
  const names = { quiz: [code, 'https://room.internal/status'], party: ['party:' + code, 'https://party.internal/status'], sudoku: ['sudoku:' + code, 'https://sudoku.internal/status'], paths: ['paths:' + code, 'https://paths.internal/status'], picture: ['picture:' + code, 'https://picture.internal/status'], serpent: ['__serpent__:' + code, 'https://serpent.internal/status'], duel: ['duel:' + code, 'https://duel.internal/status'] };
  const [name, url] = names[kind] || [];
  return name && usable(env.ROOMS) && { stub: env.ROOMS.get(env.ROOMS.idFromName(name)), url };
}
const BOARD_GAMES = new Set(['snakes', 'zahra', 'jackaroo', 'dice', 'baloot']);
const kindOf = (game) => (BOARD_GAMES.has(game) ? 'board' : ['memory', 'logic', 'puzzle', 'reaction', 'jewels', 'colors'].includes(game) ? 'duel' : game);

async function probe(kind, env, code) {
  const target = probeFor(kind, env, code);
  if (!target) return null;
  try {
    const res = await target.stub.fetch(target.url);
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    if (data?.ok === false) return null;
    if (kind === 'board') return BOARD_GAMES.has(data.game) ? data.game : null;
    if (kind === 'duel') return data.game || null;
    return kind;
  } catch (error) {
    if (/exceeded allowed volume of requests/i.test(String(error?.message || ''))) throw error;
    return null;
  }
}

// Rooms live a day at most, so codes from before 33.0.0 are gone soon after it ships;
// after this date an unknown code is not searched for in every kind of room.
export const LEGACY_CODES_UNTIL = Date.UTC(2026, 11, 31);

/** Finds the live room behind a code: { game, page } or null. */
export async function resolveRoomCode(env, code, now = Date.now()) {
  if (!/^\d{6}$/.test(String(code || ''))) return null;
  const guess = gameOfCode(code);
  const tried = new Set();
  const ask = async (kind) => { if (tried.has(kind)) return null; tried.add(kind); return probe(kind, env, code); };
  if (guess) {
    const game = await ask(kindOf(guess));
    if (game) return { game, page: pageOfGame(game) };
  }
  if (now > LEGACY_CODES_UNTIL) return null;
  // a code from before 33.0.0: ask every kind of room, the busiest first
  for (const kind of ['board', 'quiz', 'party', 'serpent', 'sudoku', 'paths', 'picture', 'duel']) {
    const game = await ask(kind);
    if (game) return { game, page: pageOfGame(game) };
  }
  return null;
}
