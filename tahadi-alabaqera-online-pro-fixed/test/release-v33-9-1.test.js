// 33.9.1: the friends room plays every game as itself, inside the room: the five-second count,
// rooms that start once everyone is in, the games with no online room on their own page with
// one board for all, and the cipher hunt where whoever is caught leaves until one is left.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PARTY_GAMES, PARTY_COUNTDOWN_MS } from '../public/assets/js/engines/party-catalog-v29.js';
import { LINKED_GAMES, LOCAL_GAMES } from '../src/party/party-link.js';
import { createParty, addPartyPlayer, startPartyRound, applyPartyAction, advanceParty, partySnapshot, CONTINUOUS_BREAK_MS } from '../src/party/party-engine.js';
import { SudokuRoom, PARTY_LOBBY_MS, PARTY_WAIT_MS } from '../src/sudoku/sudoku-room.js';
import { PathsRoom } from '../src/paths/paths-room.js';
import { ImageRoom } from '../src/images/image-room.js';
import { ChallengeRoom } from '../src/challenges/challenge-room.js';
import { PARTY_TABLE_WAIT_MS } from '../src/games/board-tables.js';
import { PARTY_ARENA_WAIT_MS } from '../src/serpent/serpent-room.js';

const read = (file) => readFile(new URL('../' + file, import.meta.url), 'utf8');
const LINK = { code: '654321', round: '0f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a', token: 'T'.repeat(64) };
function recorder() {
  const calls = [];
  return { calls, idFromName: (name) => name, get(name) { return { fetch: async (url, init) => { calls.push({ name, url: String(url), body: init?.body ? JSON.parse(init.body) : null }); return new Response('{}', { status: 200 }); } }; } };
}
function group(playlist, players = 2) {
  const room = createParty({ code: '123456', hostKey: 'h'.repeat(40), links: true, continuous: true, playlist });
  for (let i = 0; i < players; i++) addPartyPlayer(room, { name: 'لاعب ' + (i + 1) });
  room.roster = [...room.order];
  return room;
}

test('the release is 33.9.1 or later with its notes', async () => {
  assert.match(JSON.parse(await read('package.json')).version, /^33\.(?:9\.(?:[1-9]|\d{2,})|\d{2,}\.\d+)$/);
  const notes = await read('RELEASE_V33_9_1_AR.md');
  for (const word of ['غرفة الأصدقاء', 'بشكلها الأصلي', '5 ثواني', 'ساحة الشفرات', 'لين يبقى واحد']) assert.match(notes, new RegExp(word));
  assert.doesNotMatch(notes, /بوت(?!ن)/);
  assert.doesNotMatch(notes, /السلم والثعبان/);
  assert.match(await read('README-AR.md'), /RELEASE_V33_9_1_AR\.md/);
});

test('five seconds before the first game and between games; a missing player is waited 15 seconds', () => {
  assert.equal(PARTY_COUNTDOWN_MS, 5000);
  assert.equal(CONTINUOUS_BREAK_MS, 5000);
  assert.equal(PARTY_TABLE_WAIT_MS, 15000);
  assert.equal(PARTY_ARENA_WAIT_MS, 15000);
  assert.equal(PARTY_WAIT_MS, 15000);
  assert.equal(PARTY_LOBBY_MS, 3000);
});

test('every game in the friends room is played as itself: its own room or its own page', () => {
  for (const g of PARTY_GAMES) {
    assert.equal(g.real, true, g.id);
    const room = group([g.id]);
    startPartyRound(room, 1000, 77);
    const r = room.round;
    if (LINKED_GAMES[g.id]) {
      assert.equal(r.link?.status, 'creating', g.id + ' opens its own room');
      assert.equal(r.link.page, LINKED_GAMES[g.id].page);
      const view = partySnapshot(room, room.order[0]).round;
      assert.equal(view.link.embedded, ['focus', 'cipher', 'wordbomb', 'chaos'].includes(g.id), g.id + ': the page knows whether a seat token comes');
    } else {
      assert.equal(r.local?.page, LOCAL_GAMES[g.id], g.id + ' plays its own page');
      assert.equal(r.link, undefined);
    }
  }
  // the dice race has a table of its own now, ten to a table
  assert.deepEqual(LINKED_GAMES.dice, { page: '/dice', min: 1, max: 10, tables: true });
});

test('a game with no online room: one board for everyone, results only go up, the round ends once everyone here is done', () => {
  const room = group([{ game: 'memory', memoryMode: 'sequence', memoryTheme: 'space' }, 'jewels'], 3);
  const [a, b, c] = room.order;
  room.players[c].connected = false;
  startPartyRound(room, 1000, 4242);
  const local = partySnapshot(room, a).round.local;
  assert.deepEqual(local, { page: '/memory', seed: 4242, level: 'standard', mode: 'sequence', theme: 'space' });
  assert.deepEqual(partySnapshot(room, b).round.local, local, 'the same seed for everyone');
  const send = (id, seq, report, at) => applyPartyAction(room, id, { sessionId: room.sessionId, roundId: room.round.id, seq, action: { report } }, at);
  send(a, 1, { progress: 0.5, score: 5000 }, 2000);
  send(a, 2, { progress: 0.2, score: 2000 }, 2100); // a reload starts over: what was reached stays
  assert.equal(room.round.participants[a].progress, 0.5);
  assert.equal(room.round.participants[a].score, 5000);
  send(a, 3, { progress: 1, score: 99999999, done: true, won: true }, 3000);
  assert.equal(room.round.participants[a].score, 1000000, 'a score is bounded');
  assert.throws(() => send(a, 4, { progress: 1, score: 1 }, 3100), /اكتملت نتيجتك/);
  assert.throws(() => send(b, 1, null, 3200), /حركة غير صالحة/);
  advanceParty(room, 3300);
  assert.equal(room.status, 'playing', 'still waiting for the second player');
  send(b, 1, { progress: 0.75, score: 7500, done: true, won: false }, 4000);
  advanceParty(room, 4001);
  assert.equal(room.status, 'intermission', 'the player who is away does not hold the round');
  const rows = room.history.at(-1).rows;
  assert.deepEqual(rows.map((row) => [row.id, row.rank, row.points]), [[a, 1, 20], [b, 2, 19], [c, 3, 0]]);
  // the jewels stage follows the playlist's difficulty
  advanceParty(room, 4001 + CONTINUOUS_BREAK_MS);
  assert.equal(room.round.local.page, '/journey');
  assert.ok(room.round.local.stage >= 13 && room.round.local.stage <= 18);
});

function roomFixture(Room, kind, body) {
  let now = 1_000_000; const actual = Date.now; Date.now = () => now;
  const values = new Map(), sockets = [];
  const ctx = { storage: { get: async (k) => structuredClone(values.get(k)), put: async (k, v) => values.set(k, structuredClone(v)), setAlarm: async (t) => { ctx.alarmAt = t; }, deleteAll: async () => values.clear() }, blockConcurrencyWhile: (fn) => Promise.resolve().then(fn), getWebSockets: () => sockets, acceptWebSocket: (ws) => sockets.push(ws) };
  const room = new Room(ctx, { ROOMS: recorder() });
  return {
    room, ctx, time: (t) => { now = t; }, now: () => now, restore: () => { Date.now = actual; },
    async init() { await room.ready; const res = await room.fetch(new Request(`https://${kind}.internal/init`, { method: 'POST', body: JSON.stringify({ code: '123456', hostKey: 'h'.repeat(64), party: LINK, ...body }) })); assert.equal(res.status, 201); },
    add(id, name) { const p = { id, role: room.room.order.length ? 'guest' : 'host', name, username: null, token: id, connection: id, connected: true, joinedAt: now, ready: false }; room.room.players[id] = p; room.room.order.push(id); sockets.push({ deserializeAttachment: () => ({ [kind]: true, playerId: id, connection: id }), send() {}, close() {} }); return p; },
  };
}

for (const [Room, kind] of [[SudokuRoom, 'sudoku'], [PathsRoom, 'paths']]) {
  test(`${kind}: the room the friends room opened starts by itself, with a short count`, async () => {
    const f = roomFixture(Room, kind, { difficulty: 1, capacity: 3, expected: 2 });
    try {
      await f.init();
      assert.equal(f.room.room.partyExpected, 2);
      f.add('a', 'سعد'); await f.room.partyArrival();
      assert.equal(f.room.room.status, 'lobby');
      assert.equal(f.room.room.lobbyDeadline, f.now() + PARTY_WAIT_MS);
      f.add('b', 'نورة'); await f.room.partyArrival();
      assert.equal(f.room.room.status, 'countdown', 'everyone is in: no «ابدأ» needed');
      assert.equal(f.room.room.startsAt, f.now() + PARTY_LOBBY_MS);
      assert.equal(f.room.snapshot('a').lobbyMs, PARTY_LOBBY_MS);
      f.time(f.room.room.startsAt); await f.room.alarm();
      assert.equal(f.room.room.status, 'playing');
    } finally { f.restore(); }
  });
  test(`${kind}: a late player is waited 15 seconds, then the round starts with whoever came`, async () => {
    const f = roomFixture(Room, kind, { difficulty: 1, capacity: 3, expected: 3 });
    try {
      await f.init();
      f.add('a', 'سعد'); await f.room.partyArrival();
      f.time(f.room.room.lobbyDeadline); await f.room.alarm();
      assert.equal(f.room.room.status, 'countdown');
    } finally { f.restore(); }
  });
}

test('the picture race the friends room opened starts by itself, at the difficulty of the playlist', async () => {
  const f = roomFixture(ImageRoom, 'picture', { capacity: 2, expected: 2, size: 3 });
  try {
    await f.init();
    assert.equal(f.room.room.size, 3);
    f.add('a', 'سعد'); await f.room.partyArrival();
    assert.equal(f.room.room.status, 'lobby');
    f.add('b', 'نورة'); await f.room.partyArrival();
    assert.equal(f.room.room.status, 'playing');
    assert.equal(f.room.room.startsAt, f.now() + 3000);
    assert.ok(f.room.room.order.every((id) => f.room.room.players[id].ready));
  } finally { f.restore(); }
});

test('cipher: whoever stayed in longer ranks higher in the friends room', async () => {
  const ROOMS = recorder();
  const fake = { env: { ROOMS }, room: { game: 'cipher', partyLink: LINK, partyReserved: true, players: [
    { id: 'a', partyJoined: true }, { id: 'b', partyJoined: true }, { id: 'c', partyJoined: true }, { id: 'd', partyJoined: true }],
  match: { phase: 'finished', winners: ['a'], players: [
    { id: 'a', name: 'سعد', alive: true, score: 1000, eliminatedAt: 0 },
    { id: 'b', name: 'نورة', alive: false, score: 2000, eliminatedAt: 100 },
    { id: 'c', name: 'ريم', alive: false, score: 0, eliminatedAt: 300 },
    { id: 'd', name: 'فهد', alive: false, score: 0, eliminatedAt: 200 }] } } };
  await ChallengeRoom.prototype.report.call(fake);
  assert.deepEqual(ROOMS.calls[0].body.standings.map((row) => [row.name, row.rank]), [['سعد', 1], ['ريم', 2], ['فهد', 3], ['نورة', 4]]);
});

test('cipher page: the caught player leaves the hunt; the rest carry on', async () => {
  const [client, css, bundles] = await Promise.all([read('public/assets/js/challenge-client.js'), read('public/assets/css/cipher-v33-9-1.css'), read('scripts/style-bundles.json')]);
  const start = client.indexOf('function renderCipher('), fn = client.slice(start, client.indexOf('\nfunction ', start + 10));
  assert.ok(fn.length > 500);
  assert.match(fn, /enemies=m\.players\.filter\(p=>p\.id!==state\.me&&\(p\.alive\|\|!playing\)\)/);
  assert.match(fn, /if\(!enemies\.some\(p=>p\.id===targetId\)\)\{const next=enemies\.find\(p=>p\.alive\)/);
  assert.match(fn, /طلعت من الساحة/);
  assert.match(fn, /يكملون لين يبقى واحد/);
  assert.match(css, /\.ch-cipher-hunt\.ch-cipher-gone>:not\(\.ch-out\)\{display:none!important\}/);
  assert.ok(JSON.parse(bundles)['cipher.html'].includes('assets/css/cipher-v33-9-1.css'));
});

test('the room page: the game takes the screen in a frame; pages report back', async () => {
  const [party, link, arcade, journey, css, bundles] = await Promise.all(['public/assets/js/party-v29.js', 'public/assets/js/party-link-v32.js', 'public/assets/js/arcade-games.js', 'public/assets/js/journey-ui.js', 'public/assets/css/party-v33-9-1.css', 'scripts/style-bundles.json'].map(read));
  assert.match(party, /function renderLocal\(r\)/);
  assert.match(party, /data\.type==='tahdia-party-report'/);
  assert.match(party, /if\(r\.local\)\{me=r\.me\|\|me;renderLocal\(r\);sendReport\(\);return;\}/);
  assert.match(css, /#room\[data-framed=true\] \.party-game-frame\{height:calc\(100dvh - 58px\)/);
  assert.ok(JSON.parse(bundles)['party.html'].includes('assets/css/party-v33-9-1.css'));
  assert.match(link, /if \(framed && params\.get\('local'\) === '1'\)/);
  assert.match(link, /say\('tahdia-party-live', \{ room \}\)/);
  assert.match(arcade, /rand=party\?seededRandom\(party\.local\.seed\):Math\.random/);
  assert.match(journey, /openStage\(party\.local\.stage,'',false\);party\.live\(\)/);
  for (const page of ['dice', 'memory', 'logic', 'puzzle', 'journey']) assert.match(await read('public/' + page + '.html'), /assets\/js\/party-link-v32\.js/, page);
});
