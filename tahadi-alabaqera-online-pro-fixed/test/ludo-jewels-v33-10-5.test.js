// 33.10.5: «لودو» on the classic cross board (the right start squares, your colour in front of you),
// «ماستر الجواهر» in the duel-arena look with five boosters and three stars, and every game in الجمعة.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createLudoGame, ludoGeometry, globalLudoPosition, getLegalLudoMoves, applyLudoMove } from '../public/assets/js/engines/ludo-engine.js';
import { tableVariant, seatLimit, chosenSeats, seatsFor, startTable } from '../src/games/board-tables.js';
import { LINKED_GAMES, LINK_ONLY, createLinkedRoom } from '../src/party/party-link.js';
import { PARTY_GAMES } from '../public/assets/js/engines/party-catalog-v29.js';
import * as J from '../public/assets/js/engines/jewels-race-engine.js';
import { BOOSTERS, chargesOf } from '../public/assets/js/engines/jewels-duel-engine.js';
import { TanksRoom, TANK_PARTY_WAIT_MS } from '../src/tanks/tanks-room.js';
import { HockeyRoom } from '../src/hockey/hockey-room.js';
import { presencePage } from '../src/presence/presence-registry.js';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');
// the 52 squares in board order, as the page draws them (row, column)
const PATH = [[6, 1], [6, 2], [6, 3], [6, 4], [6, 5], [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], [0, 7], [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14], [7, 14], [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9], [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8], [14, 7], [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0], [7, 0], [6, 0]];

test('لودو: each colour starts on the square next to its own yard and turns home at its own column', () => {
  const s = createLudoGame(['أ', 'ب', 'ج', 'د'], { layout: 'classic' }), g = ludoGeometry(s);
  assert.equal(s.layout, 'classic');
  assert.deepEqual(g.starts, [0, 13, 26, 39]);
  // red top left starts at (6,1), green top right (1,8), blue bottom right (8,13), yellow bottom left (13,6)
  assert.deepEqual(g.starts.map((i) => PATH[i]), [[6, 1], [1, 8], [8, 13], [13, 6]]);
  // the last square before home is the middle of the arm the colour started from
  assert.deepEqual([0, 1, 2, 3].map((seat) => PATH[globalLudoPosition(seat, g.lane - 1, s)]), [[7, 0], [0, 7], [7, 14], [14, 7]]);
  assert.equal(globalLudoPosition(0, g.lane, s), null, 'inside its column nobody can reach it');
  assert.deepEqual([...g.safe].sort((a, b) => a - b), [0, 8, 13, 21, 26, 34, 39, 47]);
  assert.throws(() => createLudoGame(['1', '2', '3', '4', '5'], { layout: 'classic' }), /2_3_4_or_6/);
});

test('لودو: two players sit in opposite corners, a 6 brings a stone out, a capture and a stone home throw again', () => {
  const two = createLudoGame(['أ', 'ب'], { layout: 'classic' });
  assert.deepEqual(ludoGeometry(two).corners, [0, 2]);
  assert.deepEqual(getLegalLudoMoves(two, 5), []);
  assert.deepEqual(getLegalLudoMoves(two, 6), [0, 1, 2, 3]);
  // a capture on a plain square
  const s = createLudoGame(['أ', 'ب'], { layout: 'classic' });
  s.players[0].tokens = [3, -1, -1, -1]; s.players[1].tokens = [30, -1, -1, -1]; // seat 1 starts at 26: 30 → square 4
  const c = applyLudoMove(s, 0, 1);
  assert.deepEqual(c.lastEvent.captured, [{ player: 1, token: 0 }]); assert.equal(c.turn, 0, 'another throw');
  // a stone that reaches the middle throws again
  const h = createLudoGame(['أ', 'ب'], { layout: 'classic' });
  h.players[0].tokens = [52, -1, -1, -1];
  const after = applyLudoMove(h, 0, 4);
  assert.equal(after.players[0].tokens[0], 56); assert.equal(after.lastEvent.home, true); assert.equal(after.turn, 0);
  // the old الزهرة table keeps its rules
  const z = createLudoGame(['أ', 'ب']); z.players[0].tokens = [52, -1, -1, -1];
  assert.equal('layout' in z, false);
});

test('لودو is played on the tables of الزهرة: its variants, 2 to 4 seats, its own quick tables', () => {
  assert.equal(tableVariant('zahra', 'ludo'), 'ludo'); assert.equal(tableVariant('zahra', 'ludo-quick'), 'ludo-quick');
  assert.equal(tableVariant('dice', 'ludo'), 'classic');
  assert.equal(seatLimit('zahra', 'ludo', 6), 6); assert.equal(seatLimit('zahra', 'classic', 6), 6);
  assert.equal(chosenSeats('zahra', 3, 'ludo'), 3); assert.equal(chosenSeats('zahra', 3), null);
  assert.equal(seatsFor('zahra', 6, true, null, 'ludo'), 6, 'six-player Ludo uses the extended classic table');
  const room = { game: 'zahra', variant: 'ludo-quick', tableSeats: 3, order: ['a'], players: { a: { id: 'a', name: 'سعد', role: 'host' } } };
  startTable(room, { quick: true, rng: () => 0.3 });
  assert.equal(room.state.layout, 'classic'); assert.equal(room.state.quick, true); assert.equal(room.state.players.length, 3);
  assert.equal(presencePage('/ludo').label, 'لودو');
});

test('the ludo board turns so the one holding the phone has his yard at the bottom left', async () => {
  const src = await read('public/assets/js/ludo/board.js');
  assert.match(src, /export const turnsFor = \(corner\) => \(\(\(3 - corner\) % 4\) \+ 4\) % 4;/);
  const { turnsFor, screenCorner } = await import('../public/assets/js/ludo/board.js');
  const four = createLudoGame(['أ', 'ب', 'ج', 'د'], { layout: 'classic' }), two = createLudoGame(['أ', 'ب'], { layout: 'classic' });
  for (let seat = 0; seat < 4; seat++) assert.equal(screenCorner(four, seat, seat), 'bl', 'seat ' + seat);
  assert.equal(screenCorner(two, 1, 1), 'bl'); assert.equal(screenCorner(two, 0, 1), 'tr', 'the other player sits across');
  assert.equal(turnsFor(3), 0, 'yellow already sits at the bottom left');
  const page = await read('public/ludo.html'), main = await read('public/assets/js/ludo/main.js');
  assert.match(page, /<title>لودو — بوسراج<\/title>/); assert.doesNotMatch(page, /بوت/);
  for (const corner of ['tl', 'tr', 'bl', 'br']) assert.match(page, new RegExp('id="die-' + corner + '"'));
  assert.match(main, /game: 'zahra', page: '\/ludo', title: 'لودو'/);
  assert.match(main, /\{ id: 'ludo', label: 'الكلاسيك'/); assert.match(main, /seats: \[2, 3, 4, 6\]/);
  assert.match(await read('public/zahra.html'), /location\.replace\("\/ludo\?room=" \+ encodeURIComponent\(next\.code\)\)/, 'a ludo room opened from الزهرة goes to its page');
  const bundles = JSON.parse(await read('scripts/style-bundles.json'));
  assert.ok(bundles['ludo.html'].includes('assets/css/ludo-v33-10-5.css'));assert.equal(bundles['ludo.html'].at(-1),'assets/css/ludo-polish-v33-11-6.css');
  assert.ok((await stat(new URL('../public/assets/brand/ludo-cover-v33-10-5.webp', import.meta.url))).size > 20000);
  assert.match(await read('public/index.html'), /<a href="\/ludo" class="home-game"/);
});

test('ماستر الجواهر: five boosters; the beak breaks one gem for free, the mix plants three special gems', () => {
  assert.deepEqual(BOOSTERS.map((b) => b.id), ['hammer', 'cross', 'storm', 'pick', 'shuffle'], 'the first three keep their places');
  assert.deepEqual(chargesOf({ charge: [22, 26, 32] }), [22, 26, 32, 0, 0], 'a match from before the update keeps its charges');
  let s = J.createJewelsRace(['أ', 'ب'], { seed: 5, durationMs: 0 });
  s.players[0].charge = [0, 0, 0, 14, 18];
  const picked = J.playJewelsRaceBooster(s, 0, 'pick', 30);
  assert.equal(picked.players[0].used, 0, 'no move'); assert.equal(picked.players[0].remaining, 25); assert.equal(picked.players[0].last.free, true);
  assert.equal(picked.players[0].charge[3], 0);
  const mixed = J.playJewelsRaceBooster(picked, 0, 'shuffle', 0);
  assert.equal(mixed.players[0].used, 1);
  assert.equal(mixed.players[0].board.filter((t) => t.s).length, 3);
  assert.equal(J.legalRaceSwaps(mixed, 0).length > 0, true);
  assert.equal(mixed.players[0].last.phases[0].shuffle, true);
  assert.throws(() => J.playJewelsRaceBooster(mixed, 0, 'shuffle', 0), /not_charged/);
  assert.deepEqual(J.JR.STARS, [100, 200, 300]); assert.equal(J.starsOf(199), 1); assert.equal(J.starsOf(300), 3);
});

test('ماستر الجواهر looks like a duel: VS under a crown, star bars, candies, five square boosters, settings and chat', async () => {
  const page = await read('public/jewels.html'), main = await read('public/assets/js/jewels/main.js'), art = await read('public/assets/js/jewels/studio-renderer.js');
  assert.match(page, /class="release-v26 jewels-page jw-studio mm5"/);
  assert.match(page, /<svg class="mm-crown"/); assert.match(page, /id="jwSettingsOpen"/); assert.match(page, /class="mm-round mm-chat" type="button" data-reactions-open/);
  assert.match(main, /class=\\"mm-starbar\\"|class="mm-starbar"/); assert.match(main, /'⭐ أول نجمة!'/);
  assert.match(main, /window\.BS_TABLE=Object\.freeze/);
  assert.match(art, /function candyPath\(ctx,color,r\)/); assert.match(art, /function sprinkleBall\(ctx,r\)/);
  assert.match(art, /else if\(index===3\)/); assert.match(art, /else if\(index===4\)/);
  const bundles = JSON.parse(await read('scripts/style-bundles.json'));
  assert.equal(bundles['jewels.html'].at(-1), 'assets/css/jewels-mm-v33-10-5.css');
  assert.ok((await stat(new URL('../public/assets/brand/jewels-cover-v33-10-5.webp', import.meta.url))).size > 20000);
});

const LINK = { code: '153000', round: '0b2f8c5e-1111-4a2b-9c3d-123456789abc', token: 'T'.repeat(48) };
const recorder = (statuses = [201]) => { const calls = []; let n = 0; return { calls, idFromName: (name) => name, get: (name) => ({ fetch: async (url, init) => { calls.push({ name, url, body: JSON.parse(init.body) }); return new Response('{}', { status: statuses[Math.min(n++, statuses.length - 1)] }); } }) }; };

test('الجمعة has every game: لودو, billiards, carrom, شطرنج الذاكرة, tanks and air hockey open their own rooms', async () => {
  for (const id of ['ludo', 'billiards', 'carrom', 'pegs', 'tanks', 'hockey']) {
    assert.ok(PARTY_GAMES.some((g) => g.id === id), id + ' is in the list');
    assert.ok(LINKED_GAMES[id] && LINK_ONLY.has(id), id + ' is played in its room');
  }
  const board = recorder(), env = { ROOMS: recorder(), BOARD_ROOMS: board };
  const ludo = await createLinkedRoom(env, 'ludo', { settings: {}, count: 3, link: LINK });
  assert.equal(ludo.page, '/ludo'); assert.equal(board.calls[0].body.game, 'zahra'); assert.equal(board.calls[0].body.variant, 'ludo');
  assert.match(ludo.code, /^4[5-9]\d{4}$/, 'a ludo table has the code of الزهرة');
  for (const game of ['billiards', 'carrom', 'pegs']) { const b = recorder(); await createLinkedRoom({ ROOMS: recorder(), BOARD_ROOMS: b }, game, { settings: {}, count: 2, link: LINK }); assert.equal(b.calls[0].body.game, game); }
  const rooms = recorder(), tanks = await createLinkedRoom({ ROOMS: rooms }, 'tanks', { settings: {}, count: 3, link: LINK });
  assert.equal(tanks.page, '/tanks'); assert.match(rooms.calls[0].url, /tanks\.internal\/init$/); assert.equal(rooms.calls[0].body.capacity, 3); assert.deepEqual(rooms.calls[0].body.party, LINK);
  const hk = recorder(), hockey = await createLinkedRoom({ ROOMS: hk }, 'hockey', { settings: {}, count: 1, link: LINK });
  assert.equal(hockey.page, '/hockey'); assert.equal(hk.calls[0].name, 'hockey:' + hk.calls[0].body.code); assert.equal(hk.calls[0].body.quick, true);
  for (const file of ['ludo', 'billiards', 'race', 'pegs', 'tanks', 'hockey']) assert.match(await read('public/' + file + '.html'), /party-link-v32\.js/, file);
});

function context() { const values = new Map(), sockets = []; return { values, sockets, storage: { async get(k) { return structuredClone(values.get(k)); }, async put(k, v) { values.set(k, structuredClone(v)); }, async delete(k) { values.delete(k); }, async setAlarm(t) { this.alarm = t; } }, blockConcurrencyWhile: (fn) => Promise.resolve().then(fn), acceptWebSocket(ws) { sockets.push(ws); }, getWebSockets() { return sockets; } }; }

test('a tanks table of الجمعة starts with whoever came, fills with computer tanks and reports the ranking', async (t) => {
  const OriginalResponse = globalThis.Response, OriginalPair = globalThis.WebSocketPair;
  globalThis.WebSocketPair = class { constructor() { for (let i = 0; i < 2; i++) this[i] = { sent: [], send(raw) { this.sent.push(JSON.parse(raw)); }, serializeAttachment(a) { this.a = a; }, deserializeAttachment() { return this.a; }, close() {} }; } };
  globalThis.Response = class extends OriginalResponse { constructor(body, init) { if (init?.status === 101) { super(null, { status: 200 }); Object.defineProperty(this, 'status', { value: 101 }); } else super(body, init); } };
  t.after(() => { globalThis.Response = OriginalResponse; globalThis.WebSocketPair = OriginalPair; });
  let now = 2_000_000; t.mock.method(Date, 'now', () => now);
  const reports = []; const env = { ROOMS: { idFromName: (n) => n, get: () => ({ fetch: async (url, init) => { reports.push(JSON.parse(init.body)); return new Response('{}', { status: 200 }); } }) } };
  const room = new TanksRoom(context(), env); room.run = () => {}; await room.ready;
  const init = await room.fetch(new Request('https://tanks.internal/init', { method: 'POST', body: JSON.stringify({ code: '071111', hostKey: 'h'.repeat(40), capacity: 2, mode: 'ffa', expected: 2, party: LINK }) }));
  assert.equal(init.status, 201);
  const res = await room.fetch(new Request('https://tanks.internal/ws?name=سعد', { headers: { Upgrade: 'websocket', 'sec-websocket-protocol': 'bs-tanks-v1' } }));
  assert.equal(res.status, 101, 'nobody needs the host key at a group table');
  assert.equal(room.r.status, 'lobby', 'waits for the second player');
  now += TANK_PARTY_WAIT_MS + 10; await room.alarm();
  assert.equal(room.r.status, 'playing');
  assert.equal(room.r.players.length, 2); assert.equal(room.r.g.players[1].bot, true, 'a computer tank took the empty seat');
  room.r.g.phase = 'finished'; room.r.g.winners = [0]; room.r.status = 'finished'; await room.save();
  assert.equal(room.r.partyReported, true); assert.equal(reports[0].game, 'tanks'); assert.equal(reports[0].standings.length, 1, 'only people are ranked');
  assert.equal(reports[0].standings[0].won, true);
});

test('an air hockey table of الجمعة is a quick table that reports its result', async () => {
  const reports = []; const env = { ROOMS: { idFromName: (n) => n, get: () => ({ fetch: async (url, init) => { reports.push(JSON.parse(init.body)); return new Response('{}', { status: 200 }); } }) } };
  const room = new HockeyRoom(context(), env); await room.ready;
  const res = await room.fetch(new Request('https://hockey.internal/init', { method: 'POST', body: JSON.stringify({ code: '951111', hostKey: 'h'.repeat(40), quick: true, expected: 2, party: LINK }) }));
  assert.equal(res.status, 201); assert.equal(room.r.quick, true); assert.equal(room.r.expected, 2); assert.deepEqual(room.r.partyLink, LINK);
  room.r.players = [{ id: 'a', name: 'سعد', username: null }, { id: 'b', name: 'منافس', bot: true }];
  room.r.g = { score: [5, 2], winner: 0 }; room.r.status = 'finished'; await room.save();
  assert.equal(reports[0].game, 'hockey'); assert.deepEqual(reports[0].standings.map((r) => [r.name, r.score, r.won]), [['سعد', 5, true]]);
});

test('the release is 33.10.5 or later with its notes', async () => {
  assert.match(JSON.parse(await read('package.json')).version, /^33\.(?:10\.(?:[5-9]|\d{2,})|(?:1[1-9]|[2-9]\d)\.\d+)$/);
  const notes = await read('RELEASE_V33_10_5_AR.md');
  for (const word of ['لودو', 'ماستر الجواهر', 'الجمعة', 'المنقار', 'الخلطة', 'نجوم', 'الدبابات', 'الهوكي']) assert.match(notes, new RegExp(word));
  assert.doesNotMatch(notes, /بوت(?!ن)/);
  assert.match(await read('README-AR.md'), /RELEASE_V33_10_5_AR\.md/);
});
