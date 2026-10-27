import test from 'node:test';
import assert from 'node:assert/strict';
import { LINKED_GAMES, linkable, linkTables, cleanPartyLink, standings, createLinkedRoom, reportPartyLink, settlePartyLink, PARTY_LINK_WAIT_MS, PARTY_RETURN_MS } from '../src/party/party-link.js';
import { createParty, addPartyPlayer, startPartyRound, applyPartyAction, advanceParty, openPartyLink, failPartyLink, applyLinkResult, partySnapshot, nameKey, PARTY_BACK_MS } from '../src/party/party-engine.js';
import { PartyRoom } from '../src/party/party-room.js';
import { SudokuRoom } from '../src/sudoku/sudoku-room.js';
import { PathsRoom } from '../src/paths/paths-room.js';
import { PARTY_GAMES } from '../public/assets/js/engines/party-catalog-v29.js';

const LINK = { code: '654321', round: '0f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a', token: 'T'.repeat(64) };

// A namespace that records every request and answers with the status the test asks for.
function recorder(statuses = []) {
  const calls = [];
  return {
    calls,
    idFromName: (name) => name,
    get(name) { return { fetch: async (url, init) => { const body = init?.body ? JSON.parse(init.body) : null; calls.push({ name, url: String(url), body }); const status = statuses.length ? statuses.shift() : 201; if (status instanceof Error) throw status; return new Response('{}', { status }); } }; },
  };
}

function party({ playlist = ['sudoku', 'memory'], players = 3, links = true, capacity = 20, now = 1000 } = {}) {
  const room = createParty({ code: '654321', hostKey: 'h'.repeat(40), capacity, playlist, links, now });
  for (let i = 0; i < players; i++) addPartyPlayer(room, { name: 'لاعب ' + (i + 1), now: now + i });
  room.roster = [...room.order];
  return room;
}

test('every linked game exists in the party catalog and opens its own page', () => {
  const ids = new Set(PARTY_GAMES.map((g) => g.id));
  for (const [game, spec] of Object.entries(LINKED_GAMES)) {
    assert.ok(ids.has(game), game + ' is a party game');
    assert.match(spec.page, /^\/[a-z-]+$/);
    assert.equal(PARTY_GAMES.find((g) => g.id === game).real, true, game + ' is marked as played in the real game');
  }
  for (const g of PARTY_GAMES) if (!LINKED_GAMES[g.id]) assert.notEqual(g.real, true, g.id + ' has no room of its own');
});

test('a game links with whoever is here: table games fill with bots and split a big party into tables', () => {
  for (let n = 1; n <= 20; n++) { assert.equal(linkable('quiz', n), true); assert.equal(linkable('sudoku', n), true); }
  assert.equal(linkable('quiz', 21), false);
  // 33.0.0: bots fill a table, and more players than one table seats play on several
  for (const n of [1, 2, 10, 11, 20]) assert.equal(linkable('snakes', n), true, 'snakes ' + n);
  for (const n of [1, 3, 5, 7, 20]) { assert.equal(linkable('zahra', n), true); assert.equal(linkable('jackaroo', n), true); }
  assert.deepEqual(linkTables('snakes', Array.from({ length: 20 }, (_, i) => i)).map((t) => t.length), [10, 10]);
  assert.deepEqual(linkTables('jackaroo', Array.from({ length: 20 }, (_, i) => i)).map((t) => t.length), [5, 5, 5, 5]);
  assert.deepEqual(linkTables('zahra', Array.from({ length: 7 }, (_, i) => i)).map((t) => t.length), [4, 3]);
  assert.deepEqual(linkTables('quiz', Array.from({ length: 20 }, (_, i) => i)).map((t) => t.length), [20]);
  assert.equal(linkable('memory', 5), false);
  assert.equal(linkable('quiz', 2.5), false);
});

test('a party link is accepted only in its exact shape', () => {
  assert.deepEqual(cleanPartyLink(LINK), LINK);
  assert.equal(cleanPartyLink({ ...LINK, code: '12345' }), null);
  assert.equal(cleanPartyLink({ ...LINK, round: 'not-a-round' }), null);
  assert.equal(cleanPartyLink({ ...LINK, token: 'short' }), null);
  assert.equal(cleanPartyLink(null), null);
  assert.equal(cleanPartyLink('x'), null);
});

test('standings share a rank only for a real tie', () => {
  const rows = standings([{ name: 'أ', score: 9 }, { name: 'ب', score: 9 }, { name: 'ج', score: 4, won: false }, { name: 'د'.repeat(40), score: -3 }], (a, b) => a.score === b.score);
  assert.deepEqual(rows.map((r) => r.rank), [1, 1, 3, 4]);
  assert.equal(rows[3].name.length, 24);
  assert.equal(rows[3].score, 0);
});

test('each game opens the room its own create button would, sized for the party', async () => {
  const cases = [
    ['sudoku', { count: 3, seats: 5 }, (c) => { assert.equal(c.name, 'sudoku:' + c.body.code); assert.match(c.url, /sudoku\.internal\/init$/); assert.equal(c.body.capacity, 5); }],
    ['paths-online', { count: 3, seats: 3 }, (c) => { assert.equal(c.name, 'paths:' + c.body.code); assert.equal(c.body.capacity, 3); }],
    ['picture', { count: 2, seats: 4 }, (c) => { assert.equal(c.name, 'picture:' + c.body.code); assert.equal(c.body.capacity, 4); }],
    ['quiz', { count: 4, seats: 4 }, (c) => { assert.equal(c.name, c.body.code); assert.equal(c.body.playerLimit, 5, '4 would open a team match'); }],
    ['quiz', { count: 6, seats: 6 }, (c) => assert.equal(c.body.playerLimit, 7)],
    ['quiz', { count: 1, seats: 1 }, (c) => assert.equal(c.body.playerLimit, 2)],
    ['serpent', { count: 1, seats: 1 }, (c) => { assert.equal(c.name, '__serpent__:' + c.body.code); assert.equal(c.body.botCount, 1); assert.equal(c.body.playerLimit, 2); }],
    ['serpent', { count: 5, seats: 7 }, (c) => { assert.equal(c.body.botCount, 0); assert.equal(c.body.playerLimit, 7); }],
  ];
  for (const [game, size, check] of cases) {
    const rooms = recorder([201]), env = { ROOMS: rooms, BOARD_ROOMS: recorder() };
    const res = await createLinkedRoom(env, game, { settings: { difficulty: 3, duration: 120 }, ...size, link: LINK });
    assert.equal(res.ok, true, game);
    assert.equal(res.page, LINKED_GAMES[game].page);
    assert.equal(rooms.calls.length, 1);
    const call = rooms.calls[0];
    assert.equal(call.body.code, res.code);
    assert.deepEqual(call.body.party, LINK);
    assert.ok(call.body.hostKey.length >= 32, 'nobody holds the host key: the first player in hosts');
    check(call);
  }
  for (const game of ['snakes', 'zahra', 'jackaroo']) {
    const board = recorder([201]), env = { ROOMS: recorder(), BOARD_ROOMS: board };
    const res = await createLinkedRoom(env, game, { settings: {}, count: 4, seats: 6, link: LINK });
    assert.equal(res.ok, true, game);
    assert.equal(board.calls[0].body.game, game);
    assert.equal(board.calls[0].body.playerLimit, 4, 'a board table seats exactly the players who are here');
  }
});

test('opening a room retries a taken code and gives up cleanly on anything else', async () => {
  const busy = recorder([409, 409, 201]);
  const res = await createLinkedRoom({ ROOMS: busy }, 'sudoku', { count: 2, link: LINK });
  assert.equal(res.ok, true); assert.equal(busy.calls.length, 3);
  assert.notEqual(busy.calls[0].body.hostKey, busy.calls[1].body.hostKey, 'every attempt is a new room');
  assert.equal(res.code, busy.calls[2].body.code);
  assert.deepEqual(await createLinkedRoom({ ROOMS: recorder([500]) }, 'sudoku', { count: 2, link: LINK }), { ok: false, error: 'init_failed' });
  assert.deepEqual(await createLinkedRoom({}, 'sudoku', { count: 2, link: LINK }), { ok: false, error: 'binding_missing' });
  assert.deepEqual(await createLinkedRoom({ ROOMS: recorder() }, 'jackaroo', { count: 5, link: LINK }), { ok: false, error: 'binding_missing' }, 'five play jackaroo at a table of six (a bot fills it)');
  const six = recorder([201]);
  assert.equal((await createLinkedRoom({ BOARD_ROOMS: six }, 'jackaroo', { count: 5, link: LINK })).ok, true);
  assert.equal(six.calls[0].body.playerLimit, 6);
  assert.deepEqual(await createLinkedRoom({ ROOMS: recorder() }, 'memory', { count: 5, link: LINK }), { ok: false, error: 'not_linkable' });
});

test('a finished room reports once to its party; a closed round is not retried', async () => {
  const parties = recorder([200]);
  const room = { partyLink: LINK };
  await settlePartyLink({ ROOMS: parties }, room, 'sudoku', [{ name: 'أ', rank: 1 }]);
  await settlePartyLink({ ROOMS: parties }, room, 'sudoku', [{ name: 'أ', rank: 1 }]);
  assert.equal(parties.calls.length, 1);
  assert.equal(parties.calls[0].name, 'party:654321');
  assert.match(parties.calls[0].url, /party\.internal\/link-result$/);
  assert.deepEqual({ ...parties.calls[0].body, standings: undefined }, { round: LINK.round, token: LINK.token, game: 'sudoku', standings: undefined });
  assert.equal(room.partyReported, true);
  const flaky = recorder([new Error('offline'), 200]);
  await settlePartyLink({ ROOMS: flaky }, { partyLink: LINK }, 'quiz', []);
  assert.equal(flaky.calls.length, 2, 'one retry after a failure');
  for (const status of [400, 404, 409]) assert.equal(await reportPartyLink({ ROOMS: recorder([status]) }, LINK, 'quiz', []), true);
  assert.equal(await reportPartyLink({ ROOMS: recorder([500]) }, LINK, 'quiz', []), false);
  const many = recorder([200]);
  await reportPartyLink({ ROOMS: many }, LINK, 'quiz', Array.from({ length: 60 }, (_, i) => ({ name: 'p' + i, rank: i + 1 })));
  assert.equal(many.calls[0].body.standings.length, 40);
  await settlePartyLink({ ROOMS: recorder() }, { partyLink: null }, 'quiz', []);
});

test('a party never seats two players under one name', () => {
  const room = createParty({ code: '654321', hostKey: 'h'.repeat(40), capacity: 20, playlist: ['quiz'], now: 1 });
  const names = ['لاعب', 'لاعب', ' لاعب ', 'سعد', 'abcdefghijklmnopqrstuvwx', 'abcdefghijklmnopqrstZZ'].map((name) => addPartyPlayer(room, { name }).name);
  assert.deepEqual(names, ['لاعب', 'لاعب 2', 'لاعب 3', 'سعد', 'abcdefghijklmnopqrstuvwx', 'abcdefghijklmnopq 2']);
  assert.equal(new Set(names.map(nameKey)).size, names.length);
  assert.equal(nameKey('  ABC   def<> '), 'abc def');
  assert.ok(names.every((n) => n.length <= 24));
});

test('a linked round waits for the real room; actions inside the party are refused', () => {
  const room = party({ players: 4 });
  room.players[room.order[3]].connected = false;
  startPartyRound(room, 5000, 7);
  const r = room.round;
  assert.equal(room.status, 'playing');
  assert.equal(r.link.status, 'creating');
  assert.equal(r.link.count, 3, 'only players here now');
  assert.equal(r.link.seats, 4, 'a seat for everyone in the party');
  assert.equal(r.deadline, 5000 + PARTY_LINK_WAIT_MS);
  assert.equal(r.solution, undefined, 'no party copy of the game is prepared');
  const view = partySnapshot(room, room.order[0], 5100).round;
  assert.deepEqual(view.link, { status: 'creating', page: '/sudoku', code: null, count: 3, tables: 1, table: 0, list: [{ id: 0, code: null, players: r.link.tables[0].players }] });
  assert.equal(JSON.stringify(partySnapshot(room, room.order[0], 5100)).includes(r.link.tables[0].token), false, 'the report token never reaches a page');
  assert.throws(() => applyPartyAction(room, room.order[0], { sessionId: room.sessionId, roundId: r.id, seq: 1, action: { cell: 0, value: 1 } }, 5200), /صفحتها الأصلية/);
  assert.equal(openPartyLink(room, { code: '777777', page: '/sudoku' }, 6000), true);
  assert.equal(openPartyLink(room, { code: '888888', page: '/sudoku' }, 6001), false, 'opens once');
  assert.deepEqual(partySnapshot(room, room.order[0], 6100).round.link, { status: 'open', page: '/sudoku', code: '777777', count: 3, tables: 1, table: 0, list: [{ id: 0, code: '777777', players: r.link.tables[0].players }] });
  assert.equal(partySnapshot(room, room.order[3], 6100).round.link.code, '777777', 'a player who was away is sent to a table too');
});

test('games without a room and parties without links stay inside; table games link with whoever is here', () => {
  const memory = party({ playlist: ['memory', 'quiz'] }); startPartyRound(memory, 5000, 1); assert.equal(memory.round.link, undefined);
  const jackaroo = party({ playlist: ['jackaroo', 'quiz'], players: 3 }); startPartyRound(jackaroo, 5000, 1); assert.equal(jackaroo.round.link.tables.length, 1, 'three play at one table; a bot takes the fourth seat');
  const snakesAlone = party({ playlist: ['snakes', 'quiz'], players: 2 }); snakesAlone.players[snakesAlone.order[1]].connected = false; startPartyRound(snakesAlone, 5000, 1); assert.equal(snakesAlone.round.link.count, 1);
  const old = party({ links: false }); startPartyRound(old, 5000, 1); assert.equal(old.round.link, undefined); assert.ok(old.round.solution);
  const inside = party({ playlist: ['jackaroo', 'quiz'], players: 20, links: false }); startPartyRound(inside, 5000, 1); assert.equal(inside.round.tables.length, 4, 'twenty play jackaroo inside the party on four tables');
});

test('twenty players and a table game: several real rooms, one result', () => {
  const room = party({ playlist: ['snakes', 'quiz'], players: 20 });
  startPartyRound(room, 5000, 2);
  const r = room.round;
  assert.equal(room.capacity, 20);
  assert.equal(r.link.tables.length, 2);
  assert.deepEqual(r.link.tables.map((t) => t.players.length), [10, 10]);
  assert.equal(new Set(r.link.tables.flatMap((t) => t.players)).size, 20, 'everyone sits at exactly one table');
  assert.equal(openPartyLink(room, { code: '400001', page: '/snakes' }, 5100, 0), true);
  assert.equal(r.link.status, 'creating', 'the round opens when every table has its room');
  assert.equal(openPartyLink(room, { code: '400002', page: '/snakes' }, 5200, 1), true);
  assert.equal(r.link.status, 'open');
  // each player is sent to the room of their own table
  for (const t of r.link.tables) for (const id of t.players) assert.equal(partySnapshot(room, id, 5300).round.link.code, t.id ? '400002' : '400001');
  // 33.0.0: the state the room sends to everyone lists each table with its players, so every
  // page finds its own table (and never the report tokens)
  const shared = partySnapshot(room, null, 5300).round.link;
  assert.equal(shared.list.length, 2);
  for (const t of r.link.tables) for (const id of t.players) assert.equal(shared.list.find((x) => x.players.includes(id)).code, t.id ? '400002' : '400001');
  assert.equal(JSON.stringify(shared).includes(r.link.tables[0].token) || JSON.stringify(shared).includes(r.link.tables[1].token), false);
  const report = (t) => applyLinkResult(room, { round: r.id, token: t.token, standings: t.players.map((id, i) => ({ name: room.players[id].name, rank: i + 1 })) }, 9000);
  const [first, second] = r.link.tables, winners = [first.players[0], second.players[0]];
  assert.equal(report(first), true);
  assert.equal(room.status, 'playing', 'the round waits for the other table');
  assert.equal(applyLinkResult(room, { round: r.id, token: 'T'.repeat(64), standings: [] }, 9100), false);
  assert.equal(report(second), true);
  assert.equal(room.status, 'intermission');
  const rows = room.history.at(-1).rows;
  assert.deepEqual(rows.filter((row) => row.rank === 1).map((row) => row.id).sort(), [...winners].sort(), 'both table winners share first place');
});

test('when the real room cannot open, the same round is played inside the party', () => {
  const room = party(); startPartyRound(room, 5000, 3);
  assert.equal(failPartyLink(room, 9000), true);
  assert.equal(room.round.link.status, 'failed');
  assert.ok(room.round.solution, 'the sudoku board is ready in the party');
  assert.equal(room.round.startedAt, 9000);
  assert.equal(room.round.deadline, 9000 + room.round.settings.duration * 1000);
  const id = room.order[0], cell = room.round.participants[id].state.initial.findIndex((v) => !v);
  const result = applyPartyAction(room, id, { sessionId: room.sessionId, roundId: room.round.id, seq: 1, action: { cell, value: room.round.solution[cell] } }, 9100);
  assert.ok(result);
  assert.equal(failPartyLink(room, 9200), false);
});

test('the real room ranking becomes the round result: accounts by username, guests by name', () => {
  const room = createParty({ code: '654321', hostKey: 'h'.repeat(40), capacity: 20, playlist: ['quiz', 'memory'], links: true, now: 1 });
  const guest = addPartyPlayer(room, { name: 'سعد' }), account = addPartyPlayer(room, { name: 'سعد', username: 'saad_1' }), longName = addPartyPlayer(room, { name: 'عبدالرحمن بن عبدالله الطويل' }), absent = addPartyPlayer(room, { name: 'نورة' });
  assert.equal(account.name, 'سعد 2');
  room.roster = [...room.order]; startPartyRound(room, 5000, 9); openPartyLink(room, { code: '777777', page: '/online' }, 5100);
  const r = room.round, token = r.link.tables[0].token;
  assert.equal(applyLinkResult(room, { round: r.id, token: 'x'.repeat(64), standings: [] }, 6000), false, 'a wrong token is refused');
  assert.equal(applyLinkResult(room, { round: 'other', token, standings: [] }, 6000), false, 'another round is refused');
  const rows = [
    { name: 'سعد', username: null, rank: 1, score: 80, won: true },       // the guest
    { name: 'سعد', username: 'saad_1', rank: 2, score: 50, won: false },  // the account kept its own row
    { name: 'عبدالرحمن بن عبدالله ال', username: null, rank: 3, score: 10 }, // cut at 20 characters by the game
    { name: 'غريب', username: null, rank: 4, score: 1 },                  // nobody in the party
  ];
  assert.equal(applyLinkResult(room, { round: r.id, token, standings: rows }, 7000), true);
  assert.equal(room.status, 'intermission');
  assert.equal(room.returnWait, true);
  assert.equal(room.nextAt, 7000 + PARTY_RETURN_MS);
  const result = room.history.at(-1);
  assert.ok(result);
  const p = r.participants;
  assert.deepEqual([p[guest.id].score, p[guest.id].won, p[guest.id].gameScore], [4, true, 80]);
  assert.deepEqual([p[account.id].score, p[account.id].won], [3, false]);
  assert.equal(p[longName.id].score, 2);
  assert.equal(p[absent.id].score, 0, 'a player who did not play gets nothing');
  assert.equal(applyLinkResult(room, { round: r.id, token, standings: rows }, 7100), false, 'a result counts once');
  assert.equal(JSON.stringify(partySnapshot(room, guest.id, 7200)).includes(token), false);
});

test('a shared first place is a draw unless the game named a winner', () => {
  const play = (standingsOf) => { const room = party({ playlist: ['paths-online', 'memory'], players: 2 }); startPartyRound(room, 5000, 1); openPartyLink(room, { code: '777777' }, 5100); applyLinkResult(room, { round: room.round.id, token: room.round.link.tables[0].token, standings: standingsOf }, 6000); return room.history.at(-1).rows.map((row) => [row.name, row.rank, row.won]); };
  assert.deepEqual(play([{ name: 'لاعب 1', rank: 1 }, { name: 'لاعب 2', rank: 1 }]), [['لاعب 1', 1, false], ['لاعب 2', 1, false]]);
  assert.deepEqual(play([{ name: 'لاعب 1', rank: 1 }, { name: 'لاعب 2', rank: 1, won: true }]), [['لاعب 2', 1, true], ['لاعب 1', 2, false]]);
  assert.deepEqual(play([{ name: 'لاعب 2', rank: 1 }, { name: 'لاعب 1', rank: 2 }]), [['لاعب 2', 1, true], ['لاعب 1', 2, false]]);
});

test('after a linked game the break waits for everyone, then shows the standings briefly', () => {
  const room = party({ players: 3 }); startPartyRound(room, 5000, 1); openPartyLink(room, { code: '777777' }, 5100);
  const t = 60000;
  applyLinkResult(room, { round: room.round.id, token: room.round.link.tables[0].token, standings: room.order.map((id, i) => ({ name: room.players[id].name, rank: i + 1 })) }, t);
  for (const id of room.order) room.players[id].connected = false; // everyone is on the game page
  advanceParty(room, t + 9000); assert.equal(room.status, 'intermission'); assert.equal(room.returnWait, true);
  room.players[room.order[0]].connected = true; room.players[room.order[1]].connected = true;
  advanceParty(room, t + 12000); assert.equal(room.returnWait, true, 'still one player away'); assert.equal(room.nextAt, t + PARTY_RETURN_MS);
  room.players[room.order[2]].connected = true;
  const step = advanceParty(room, t + 15000);
  assert.equal(step.changed, true);
  assert.equal(room.returnWait, false);
  assert.equal(room.nextAt, t + 15000 + PARTY_BACK_MS, 'a short look at the standings');
  advanceParty(room, t + 15000 + PARTY_BACK_MS); assert.equal(room.status, 'playing'); assert.equal(room.round.game, 'memory');
  // nobody comes back: the party moves on by itself
  const lonely = party({ players: 2 }); startPartyRound(lonely, 5000, 1); openPartyLink(lonely, { code: '777777' }, 5100);
  applyLinkResult(lonely, { round: lonely.round.id, token: lonely.round.link.tables[0].token, standings: [] }, t);
  for (const id of lonely.order) lonely.players[id].connected = false;
  advanceParty(lonely, t + PARTY_RETURN_MS - 1); assert.equal(lonely.status, 'intermission');
  advanceParty(lonely, t + PARTY_RETURN_MS); assert.equal(lonely.status, 'playing');
});

// ---------- the party room object: opening the room and taking the result ----------
function partyObject(env) {
  const values = new Map(), sockets = [];
  const ctx = { storage: { get: async (k) => structuredClone(values.get(k)), put: async (k, v) => { if (k && typeof k === 'object') for (const [a, b] of Object.entries(k)) values.set(a, structuredClone(b)); else values.set(k, structuredClone(v)); }, delete: async (k) => values.delete(k), list: async () => new Map(values), setAlarm: async (t) => { ctx.alarmAt = t; }, getAlarm: async () => ctx.alarmAt, deleteAll: async () => values.clear() }, blockConcurrencyWhile: (fn) => Promise.resolve().then(fn), getWebSockets: () => sockets, acceptWebSocket: (ws) => sockets.push(ws) };
  return new PartyRoom(ctx, env);
}

test('the party object opens the real room, then the room result ends the round', async () => {
  const rooms = recorder([201]), env = { ROOMS: rooms };
  const object = partyObject(env); await object.ready;
  object.room = party({ players: 2, now: Date.now() }); startPartyRound(object.room, Date.now(), 4);
  assert.equal(await object.ensureLink(), true);
  const r = object.room.round;
  assert.equal(r.link.status, 'open');
  assert.equal(rooms.calls[0].name, 'sudoku:' + r.link.code);
  assert.deepEqual(rooms.calls[0].body.party, { code: '654321', round: r.id, token: r.link.tables[0].token });
  const post = (body) => object.fetch(new Request('https://party.internal/link-result', { method: 'POST', body: JSON.stringify(body) }));
  assert.equal((await post({ round: r.id, token: 'bad'.repeat(20), standings: [] })).status, 409);
  const ok = await post({ round: r.id, token: r.link.tables[0].token, game: 'sudoku', standings: [{ name: 'لاعب 2', rank: 1, won: true }, { name: 'لاعب 1', rank: 2 }] });
  assert.equal(ok.status, 200);
  assert.equal(object.room.status, 'intermission');
  assert.equal(object.room.history.at(-1).rows[0].name, 'لاعب 2');
});

test('two failed openings play the round inside the party', async () => {
  const env = { ROOMS: recorder([500, 500]) };
  const object = partyObject(env); await object.ready;
  object.room = party({ players: 2, now: Date.now() }); startPartyRound(object.room, Date.now(), 4);
  assert.equal(await object.ensureLink(), true, 'first failure: try again');
  assert.equal(object.room.round.link.status, 'creating');
  assert.equal(await object.ensureLink(), true);
  assert.equal(object.room.round.link.status, 'failed');
  assert.ok(object.room.round.solution);
});

// ---------- the real rooms report their final ranking ----------
function roomFixture(Room, kind) {
  let now = 1_000_000; const actual = Date.now; Date.now = () => now;
  const values = new Map(), sockets = [], parties = recorder([200, 200, 200]);
  const ctx = { storage: { get: async (k) => structuredClone(values.get(k)), put: async (k, v) => values.set(k, structuredClone(v)), setAlarm: async (t) => { ctx.alarmAt = t; }, deleteAll: async () => values.clear() }, blockConcurrencyWhile: (fn) => Promise.resolve().then(fn), getWebSockets: () => sockets, acceptWebSocket: (ws) => sockets.push(ws) };
  const room = new Room(ctx, { ROOMS: parties });
  return {
    room, parties, time: (t) => { now = t; }, restore: () => { Date.now = actual; },
    async init() { await room.ready; const res = await room.fetch(new Request(`https://${kind}.internal/init`, { method: 'POST', body: JSON.stringify({ code: '123456', hostKey: 'h'.repeat(64), difficulty: 1, capacity: 3, party: LINK }) })); assert.equal(res.status, 201); },
    add(id, name, role = 'guest', username = null) { const p = { id, role, name, username, token: id, connection: id, connected: true, joinedAt: now }; room.room.players[id] = p; room.room.order.push(id); const socket = { deserializeAttachment: () => ({ [kind]: true, playerId: id, connection: id }), send() {}, close() {} }; sockets.push(socket); return { p, send: (m) => room.webSocketMessage(socket, JSON.stringify(m)) }; },
  };
}

for (const [Room, kind, game] of [[SudokuRoom, 'sudoku', 'sudoku'], [PathsRoom, 'paths', 'paths-online']]) {
  test(`${game} room created by a party reports its ranking once, when the match ends`, async () => {
    const f = roomFixture(Room, kind);
    try {
      await f.init();
      assert.deepEqual(f.room.room.partyLink, LINK);
      const host = f.add('a', 'سعد', 'host', 'saad_1'); f.add('b', 'نورة'); f.add('c', 'ريم');
      await host.send({ type: 'start' });
      f.time(f.room.room.startsAt); await f.room.alarm();
      assert.equal(f.room.room.status, 'playing');
      f.room.room.players.b.correct = 7; f.room.room.players.a.correct = 3;
      f.time(f.room.room.deadline + 1); await f.room.alarm();
      assert.equal(f.room.room.status, 'finished');
      assert.equal(f.parties.calls.length, 1);
      const sent = f.parties.calls[0];
      assert.equal(sent.name, 'party:' + LINK.code);
      assert.equal(sent.body.game, game);
      assert.equal(sent.body.token, LINK.token);
      assert.deepEqual(sent.body.standings.map((r) => [r.name, r.rank]), [['نورة', 1], ['سعد', 2], ['ريم', 3]]);
      assert.equal(sent.body.standings[1].username, 'saad_1');
      // a rematch is the players' own; it never reports again
      await host.send({ type: 'rematch' });
      assert.equal(f.parties.calls.length, 1);
    } finally { f.restore(); }
  });
}
