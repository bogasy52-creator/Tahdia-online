import {partyMode} from '../../public/assets/js/engines/party-modes.js';
// 32.1.0: a group (party) round can be played in the real game itself.
// The party room opens a normal room of that game (the same page, rules and
// screens players know), everyone plays it there, and when the match ends the
// game's own room reports the final standings back to the party, which turns
// them into round points. Games with no online room stay inside the party.
import { roomCodeFor } from '../rooms/room-codes.js';

export const PARTY_LINK_WAIT_MS = 45 * 60_000;   // the longest a party waits for a linked game
export const PARTY_RETURN_MS = 60_000;           // after a linked game, time for everyone to come back

export const LINKED_GAMES = Object.freeze({
  wordbomb:{page:'/wordbomb',min:1,max:20},
  chaos:{page:'/uno',min:1,max:8,tables:true},
  focus:{page:'/focus',min:1,max:20},
  cipher:{page:'/cipher',min:1,max:20},
  quiz: { page: '/online', min: 1, max: 20 },
  sudoku: { page: '/sudoku', min: 1, max: 20 },
  'paths-online': { page: '/paths-online', min: 1, max: 20 },
  picture: { page: '/picture', min: 1, max: 20 },
  serpent: { page: '/serpent', min: 1, max: 20 },
  // 33.0.0: the table games start with whoever is there (bots fill the table) and a
  // bigger party plays them on several tables, each its own real room
  snakes: { page: '/snakes', min: 1, max: 10, tables: true },
  jackaroo: { page: '/jackaroo', min: 1, max: 6, tables: true },
  // 33.9.1: the dice race is played on its own table too, ten to a table
  dice: { page: '/dice', min: 1, max: 10, tables: true },
  // 33.10.5: every table game of the site: لودو (the cross board, on the tables of الزهرة),
  // billiards and carrom two to a table, شطرنج الذاكرة four to a table
  ludo: { page: '/ludo', min: 1, max: 6, tables: true, board: 'zahra', variant: 'ludo' },
  billiards: { page: '/billiards', min: 1, max: 2, tables: true },
  carrom: { page: '/carrom', min: 1, max: 2, tables: true },
  pegs: { page: '/pegs', min: 1, max: 6, tables: true },
  jewels: { page:'/jewels',min:1,max:2,tables:true },
  // tanks four to a table and air hockey two; computer players take the seats nobody came for
  tanks: { page: '/tanks', min: 1, max: 4, tables: true },
  hockey: { page: '/hockey', min: 1, max: 2, tables: true },
});
/** 33.10.5: games the group room can only play in their own room (it has no copy of them). */
export const LINK_ONLY = Object.freeze(new Set(['zahra','ludo', 'billiards', 'carrom', 'pegs', 'tanks', 'hockey', 'jewels']));

// 33.9.1: the games with no online room are played on their own page inside the group
// room: every player gets the same board (one seed for all) and each page sends its
// result back to the room as it plays.
// 33.12.0: جسر الألوان and عشر ثواني are played the same way, everyone on the same seed
export const LOCAL_GAMES = Object.freeze({ memory: '/memory', logic: '/logic', puzzle: '/puzzle', jewels: '/journey', bridge: '/bridge', ten: '/ten' });
export function localGame(game) { return LOCAL_GAMES[game] || null; }

// 33.10.6: الزهرة made way for لودو; a round that still names it is played as لودو
export function linkedGame(game) { return LINKED_GAMES[game==='zahra'?'ludo':game] || null; }
/** Can this many players start the real game? (board games need their table full) */
export function linkable(game, count) {
  const g = linkedGame(game);
  return Boolean(g) && Number.isInteger(count) && count >= g.min && (count <= g.max || Boolean(g.tables));
}
/** The players of a linked round, split into tables no bigger than the game's (balanced). */
export function linkTables(game, players,settings={}) {
  const g = linkedGame(game), size = game==='quiz'&&partyMode(game,settings)==='teams'?6:g?.tables ? g.max : Infinity, count = Math.max(1, Math.ceil(players.length / size));
  const tables = Array.from({ length: count }, () => []);
  players.forEach((id, i) => tables[i % count].push(id));
  return tables;
}

export function cleanPartyLink(value) {
  if (!value || typeof value !== 'object') return null;
  const code = String(value.code || ''), round = String(value.round || ''), token = String(value.token || '');
  return /^\d{6}$/.test(code) && /^[0-9a-f-]{36}$/i.test(round) && /^[A-Za-z0-9_-]{24,96}$/.test(token) ? { code, round, token } : null;
}

// 33.0.0: the code carries the game (see rooms/room-codes.js)
const FAMILY = { quiz: 'quiz', sudoku: 'sudoku', 'paths-online': 'paths', picture: 'picture', serpent: 'serpent', snakes: 'snakes', zahra: 'zahra', jackaroo: 'jackaroo', dice: 'dice', ludo: 'zahra', billiards: 'billiards', carrom: 'carrom', pegs: 'pegs', jewels:'jewels', tanks: 'tanks', hockey: 'hockey' };
const roomCode = (game) => roomCodeFor(FAMILY[game] || game);
const secret = () => crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');

// The init body of each game's room, the same as its own "create room" button sends.
// `count` players are here now; `seats` is the whole party, so someone who was
// reconnecting when the round began still finds a seat (board tables use `count`).
function initFor(game, settings, count, code, hostKey, party, seats = count) {
  const mode=partyMode(game,settings||{});
  const difficulty = Math.min(5, Math.max(1, Number(settings?.difficulty) || 2));
  const room = Math.max(1, Math.min(20, Math.max(count, Number(seats) || 0)));
  if(['focus','cipher','wordbomb','chaos'].includes(game))return{ns:'ROOMS',name:'challenge:'+code,url:'https://challenge.internal/init',body:{game,code,hostKey,party,expected:count,capacity:room,...(game==='chaos'?{unoMode:mode}:{})}};
  // 33.10.5: tanks and air hockey have rooms of their own
  if (game === 'tanks') return { ns: 'ROOMS', name: 'tanks:' + code, url: 'https://tanks.internal/init', body: { code, hostKey, capacity: Math.max(2, Math.min(4, count)), mode, expected: count, party } };
  if (game === 'hockey') return { ns: 'ROOMS', name: 'hockey:' + code, url: 'https://hockey.internal/init', body: { code, hostKey, quick: true, target: mode==='quick'?3:mode==='long'?7:5, expected: count, party } };
  if (game === 'quiz') {
    // 4 and 6 open a team match; a party plays everyone against everyone
    const playerLimit = Math.min(20, Math.max(2, [4, 6].includes(room) ? room + 1 : room));
    // 33.10.6: the host may pick the categories (several); none picked means six at random
    const categories = Array.isArray(settings?.categories) ? settings.categories.slice(0, 40) : undefined;
    return { ns: 'ROOMS', name: code, url: 'https://room.internal/init', body: { code, hostKey, name: 'party', playerLimit, expected: count, party, ...(categories?.length ? { categories } : {}),...(mode==='teams'?{teams:true}:{}) } };
  }
  // 33.9.1: these start by themselves too, once the players the room sent are in
  if (game === 'sudoku') return { ns: 'ROOMS', name: 'sudoku:' + code, url: 'https://sudoku.internal/init', body: { code, hostKey, difficulty, capacity: room, expected: count, party } };
  if (game === 'paths-online') return { ns: 'ROOMS', name: 'paths:' + code, url: 'https://paths.internal/init', body: { code, hostKey, difficulty, capacity: room, expected: count, party } };
  if (game === 'picture') return { ns: 'ROOMS', name: 'picture:' + code, url: 'https://picture.internal/init', body: { code, hostKey, capacity: room, expected: count, size:Number(mode), party } };
  if (game === 'serpent') {
    const duration = [60, 120, 180].includes(Number(settings?.duration)) ? Number(settings.duration) : 120;
    const playerLimit = Math.max(2, room), botCount = count < 2 ? 1 : 0;
    return { ns: 'ROOMS', name: '__serpent__:' + code, url: 'https://serpent.internal/init', body: { code, hostKey, playerLimit, duration, botCount, difficulty: 'mixed', matchMode:mode, worldId: settings?.worldId || 'classic', expected: count, party } };
  }
  // snakes, zahra, jackaroo, dice, ludo, billiards, carrom, pegs: a board room for the players of
  // this table (bots fill the rest)
  const table = linkedGame(game) || {};
  return { ns: 'BOARD_ROOMS', name: code, url: 'https://board.internal/init', body: { code, hostKey, game: table.board || game, playerLimit: game === 'jackaroo' ? 6 : count,...(['jackaroo','zahra','ludo'].includes(game)?{seats:6}:{}), expected: count, name: '', variant:mode, party } };
}

/** Opens the real room. Returns { ok, code, page } or { ok: false }. */
export async function createLinkedRoom(env, game, { settings, count, seats = count, link, reservations }) {
  if(game==='zahra'){game='ludo';settings={...settings,mode:settings?.mode==='quick'?'ludo-quick':settings?.mode==='classic'?'ludo':settings?.mode||'ludo'};}
  const g = linkedGame(game);
  if (!g || !linkable(game, count)) return { ok: false, error: 'not_linkable' };
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = roomCode(game), hostKey = secret(), spec = initFor(game, settings, count, code, hostKey, link, seats);
    if (reservations) spec.body.reservations = reservations;
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
    return { ...(row.partyId ? { partyId: row.partyId } : {}), name: String(row.name || '').slice(0, 24), username: row.username || null, rank, score: Math.max(0, Math.round(Number(row.score) || 0)), won: Boolean(row.won) };
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
