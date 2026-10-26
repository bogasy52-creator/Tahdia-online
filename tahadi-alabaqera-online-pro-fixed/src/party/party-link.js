// 32.1.0: a group (party) round can be played in the real game itself.
// The party room opens a normal room of that game (the same page, rules and
// screens players know), everyone plays it there, and when the match ends the
// game's own room reports the final standings back to the party, which turns
// them into round points. Games with no online room stay inside the party.
export const PARTY_LINK_WAIT_MS = 45 * 60_000;   // the longest a party waits for a linked game
export const PARTY_RETURN_MS = 60_000;           // after a linked game, time for everyone to come back

export const LINKED_GAMES = Object.freeze({
  quiz: { page: '/online', min: 1, max: 20 },
  sudoku: { page: '/sudoku', min: 1, max: 20 },
  'paths-online': { page: '/paths-online', min: 1, max: 20 },
  picture: { page: '/picture', min: 1, max: 20 },
  serpent: { page: '/serpent', min: 1, max: 20 },
  snakes: { page: '/snakes', min: 2, max: 10 },
  zahra: { page: '/zahra', min: 2, max: 6 },
  jackaroo: { page: '/jackaroo', min: 4, max: 6, exact: [4, 6] },
});

export function linkedGame(game) { return LINKED_GAMES[game] || null; }
/** Can this many players start the real game? (board games need their table full) */
export function linkable(game, count) {
  const g = linkedGame(game);
  if (!g || !Number.isInteger(count) || count < g.min || count > g.max) return false;
  return !g.exact || g.exact.includes(count);
}

export function cleanPartyLink(value) {
  if (!value || typeof value !== 'object') return null;
  const code = String(value.code || ''), round = String(value.round || ''), token = String(value.token || '');
  return /^\d{6}$/.test(code) && /^[0-9a-f-]{36}$/i.test(round) && /^[A-Za-z0-9_-]{24,96}$/.test(token) ? { code, round, token } : null;
}

const roomCode = () => String(100000 + crypto.getRandomValues(new Uint32Array(1))[0] % 900000);
const secret = () => crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');

// The init body of each game's room, the same as its own "create room" button sends.
// `count` players are here now; `seats` is the whole party, so someone who was
// reconnecting when the round began still finds a seat (board tables use `count`).
function initFor(game, settings, count, code, hostKey, party, seats = count) {
  const difficulty = Math.min(5, Math.max(1, Number(settings?.difficulty) || 2));
  const room = Math.max(1, Math.min(20, Math.max(count, Number(seats) || 0)));
  if (game === 'quiz') {
    // 4 and 6 open a team match; a party plays everyone against everyone
    const playerLimit = Math.min(20, Math.max(2, [4, 6].includes(room) ? room + 1 : room));
    return { ns: 'ROOMS', name: code, url: 'https://room.internal/init', body: { code, hostKey, name: 'party', playerLimit, party } };
  }
  if (game === 'sudoku') return { ns: 'ROOMS', name: 'sudoku:' + code, url: 'https://sudoku.internal/init', body: { code, hostKey, difficulty, capacity: room, party } };
  if (game === 'paths-online') return { ns: 'ROOMS', name: 'paths:' + code, url: 'https://paths.internal/init', body: { code, hostKey, difficulty, capacity: room, party } };
  if (game === 'picture') return { ns: 'ROOMS', name: 'picture:' + code, url: 'https://picture.internal/init', body: { code, hostKey, capacity: room, party } };
  if (game === 'serpent') {
    const duration = [60, 120, 180].includes(Number(settings?.duration)) ? Number(settings.duration) : 120;
    const playerLimit = Math.max(2, room), botCount = count < 2 ? 1 : 0;
    return { ns: 'ROOMS', name: '__serpent__:' + code, url: 'https://serpent.internal/init', body: { code, hostKey, playerLimit, duration, botCount, difficulty: 'medium', matchMode: 'timed', worldId: settings?.worldId || 'classic', party } };
  }
  // snakes, zahra, jackaroo: a board room sized for exactly the players who play
  return { ns: 'BOARD_ROOMS', name: code, url: 'https://board.internal/init', body: { code, hostKey, game, playerLimit: count, name: '', variant: 'classic', party } };
}

/** Opens the real room. Returns { ok, code, page } or { ok: false }. */
export async function createLinkedRoom(env, game, { settings, count, seats = count, link }) {
  const g = linkedGame(game);
  if (!g || !linkable(game, count)) return { ok: false, error: 'not_linkable' };
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = roomCode(), hostKey = secret(), spec = initFor(game, settings, count, code, hostKey, link, seats);
    const namespace = env?.[spec.ns];
    if (!namespace?.idFromName) return { ok: false, error: 'binding_missing' };
    const res = await namespace.get(namespace.idFromName(spec.name)).fetch(spec.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(spec.body) });
    if (res.status === 201) return { ok: true, code, page: g.page };
    if (res.status !== 409) return { ok: false, error: 'init_failed' };
  }
  return { ok: false, error: 'no_code' };
}

/** Ranks rows (best first) with shared ranks for ties, into the report format. */
export function standings(rows, same = () => false) {
  let rank = 0, prior = null;
  return rows.map((row, i) => {
    if (!prior || !same(row, prior)) rank = i + 1;
    prior = row;
    return { name: String(row.name || '').slice(0, 24), username: row.username || null, rank, score: Math.max(0, Math.round(Number(row.score) || 0)), won: Boolean(row.won) };
  });
}

export async function reportPartyLink(env, link, game, rows) {
  if (!link || !env?.ROOMS?.idFromName) return true;
  try {
    const stub = env.ROOMS.get(env.ROOMS.idFromName('party:' + link.code));
    const res = await stub.fetch('https://party.internal/link-result', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ round: link.round, token: link.token, game, standings: rows.slice(0, 40) }) });
    // a closed round or a finished party will never take this result: stop trying
    return res.ok || [400, 404, 409].includes(res.status);
  } catch { return false; }
}

/** Called by a room when its first match ends; tries twice, then gives up quietly
    (the party round still ends on its own deadline). Later rematches are not reported. */
export async function settlePartyLink(env, room, game, rows) {
  if (!room?.partyLink || room.partyReported) return;
  room.partyReported = true;
  for (let attempt = 0; attempt < 2; attempt++) if (await reportPartyLink(env, room.partyLink, game, rows)) return;
}
