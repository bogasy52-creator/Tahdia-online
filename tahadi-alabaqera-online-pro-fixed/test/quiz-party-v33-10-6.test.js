// 33.10.6: الزهرة made way for لودو, تحدي العباقرة got easy one-word answers, a flags
// category and ten more studio pictures, and الجمعة lets the host pick quiz categories.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { CATEGORIES } from '../src/questions.js';
import { PARTY_GAMES, PLAYLIST_MAX, partyGame, normalizePlaylist, tablesFor } from '../public/assets/js/engines/party-catalog-v29.js';
import { LINKED_GAMES, linkedGame, linkTables, createLinkedRoom } from '../src/party/party-link.js';
import { createParty, addPartyPlayer, startPartyRound, retirePartyChallenges, partySnapshot } from '../src/party/party-engine.js';
import { PartyRoom } from '../src/party/party-room.js';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');
const pub = (path) => new URL('../public/' + path, import.meta.url);
const byId = (id) => CATEGORIES.find((c) => c.id === id);
const oneWord = (s) => /^\S+$/.test(String(s));

test('الزهرة is gone: no card, no party entry, old links and rounds become لودو', async () => {
  const home = await read('public/index.html');
  assert.doesNotMatch(home, /href="\/zahra"/);
  assert.match(home, /24 لعبة عربية/);
  assert.equal(PARTY_GAMES.some((g) => g.id === 'zahra'), false);
  assert.equal(partyGame('zahra').id, 'ludo');
  assert.equal(normalizePlaylist(['zahra'])[0].game, 'ludo');
  assert.equal('zahra' in LINKED_GAMES, false);
  assert.equal(linkedGame('zahra'), LINKED_GAMES.ludo);
  const moved = await read('public/assets/js/zahra-moved.js');
  assert.match(moved, /query\.get\('room'\)/, 'a room already open still finishes on its own page');
  assert.match(moved, /location\.replace\('\/ludo'/);
  // a saved party that still lists الزهرة plays لودو instead
  const room = createParty({ code: '150001', hostKey: 'k'.repeat(40), playlist: ['quiz', 'memory'], now: 1000 });
  room.playlist.push({ ...room.playlist[1], game: 'zahra' });
  retirePartyChallenges(room, 1000);
  assert.equal(room.playlist.at(-1).game, 'ludo');
  for (const file of ['public/assets/js/shop-v31.js', 'public/assets/js/game-menu-v33.js', 'src/presence/presence-registry.js']) {
    assert.doesNotMatch(await read(file), /'الزهرة'|"الزهرة"/, file);
  }
});

test('every quiz answer and every choice is one word', () => {
  assert.equal(CATEGORIES.length, 25);
  for (const c of CATEGORIES) for (const q of c.questions) {
    assert.ok(oneWord(q.a), `${q.id}: ${q.a}`);
    assert.equal(q.distractors.length, 3, q.id);
    for (const d of q.distractors) assert.ok(oneWord(d), `${q.id}: ${d}`);
    assert.equal(new Set([String(q.a), ...q.distractors.map(String)]).size, 4, q.id);
  }
  for (const c of CATEGORIES.filter((c) => !['sounds', 'zoom', 'memory', 'flags'].includes(c.id))) {
    assert.equal(c.questions.length, 27, c.id);
    for (const v of [100, 200, 300]) assert.equal(c.questions.filter((q) => q.v === v).length, 9, c.id + ' ' + v);
    assert.ok(c.questions.every((q) => !q.media && q.kind), c.id);
  }
  // Western digits only, as everywhere in the platform
  for (const c of CATEGORIES) for (const q of c.questions) assert.doesNotMatch(JSON.stringify([q.q, q.a, q.distractors]), /[٠-٩]/, q.id);
});

test('«أعلام» shows 27 waving flags: zoom on a part, then the whole flag', async () => {
  const flags = byId('flags');
  assert.ok(flags);
  assert.equal(flags.icon, 'flag');
  assert.equal(flags.questions.length, 27);
  assert.equal(new Set(flags.questions.map((q) => q.mediaFamily)).size, 27);
  for (const v of [100, 200, 300]) assert.equal(flags.questions.filter((q) => q.v === v).length, 9);
  for (const q of flags.questions) {
    assert.equal(q.media, 'zoom');
    assert.match(q.src, /^assets\/quiz_flags_v33\/[a-z]+\.webp$/);
    assert.equal(q.revealSrc, q.src);
    assert.ok(q.zoom > q.hintZoom && q.hintZoom >= 1, q.id);
    assert.ok(q.focusX >= 0 && q.focusX <= 100 && q.focusY >= 0 && q.focusY <= 100, q.id);
    assert.match(q.credit, /صورة/);
    await access(pub(q.src));
  }
  const catalog = JSON.parse(await read('public/assets/quiz-catalog.json'));
  assert.ok(catalog.some((c) => c.id === 'flags' && c.count === 27));
  assert.match(await read('public/online.html'), /flag:'<path/);
  assert.match(await read('public/assets/js/quiz-hub.js'), /flag:'⚑'/);
});

test('zoom: ten more studio objects, the answers are plain names', async () => {
  const zoom = byId('zoom');
  const added = ['apple', 'banana', 'egg', 'candle', 'carrot', 'lemon', 'crown', 'balloon', 'fanjan', 'key'];
  for (const name of added) {
    const q = zoom.questions.find((x) => x.mediaFamily === 'image:' + name);
    assert.ok(q && q.rendered, name);
    await access(pub(q.src));
  }
  assert.equal(zoom.questions.filter((q) => q.rendered).length, 30);
  assert.equal(zoom.questions.some((q) => q.mediaFamily === 'image:astronaut'), false, 'رائد فضاء is two words');
  assert.match(await read('scripts/zoom-3d/objects-shader.js'), /vec2 fanjan\(vec3 p\)/);
});

test('الجمعة: the host picks several quiz categories, and only real ones', async () => {
  assert.equal(PLAYLIST_MAX, 30);
  const [row] = normalizePlaylist([{ game: 'quiz', categories: ['flags', 'geo', 'flags', 'zoom'] }]);
  assert.deepEqual(row.categories, ['flags', 'geo', 'zoom']);
  assert.equal('categories' in normalizePlaylist([{ game: 'quiz', categories: [] }])[0], false, 'none picked means six at random');
  assert.throws(() => normalizePlaylist([{ game: 'quiz', categories: ['<b>'] }]));
  assert.throws(() => normalizePlaylist([{ game: 'quiz', categories: 'geo' }]));
  // played in the room itself, the questions come from the picked categories only
  const room = createParty({ code: '150002', hostKey: 'k'.repeat(40), playlist: [{ game: 'quiz', categories: ['flags', 'geo'] }], now: 1000 });
  for (let i = 0; i < 4; i++) addPartyPlayer(room, { name: 'P' + i, now: 1000 });
  room.roster = [...room.order]; startPartyRound(room, 2000, 9);
  assert.ok(room.round.questions.length > 0);
  assert.ok(room.round.questions.every((q) => ['أعلام', 'جغرافيا'].includes(q.category)));
  // played as a linked online room, the room gets the same list
  const calls = []; const env = { ROOMS: { idFromName: (n) => n, get: (name) => ({ fetch: async (url, init) => { calls.push({ name, url, body: JSON.parse(init.body) }); return new Response('{}', { status: 201 }); } }) } };
  const link = { code: '150002', round: '0b2f8c5e-1111-4a2b-9c3d-123456789abc', token: 'T'.repeat(48) };
  const made = await createLinkedRoom(env, 'quiz', { settings: { categories: ['flags', 'geo'] }, count: 20, link });
  assert.equal(made.ok, true);
  assert.deepEqual(calls[0].body.categories, ['flags', 'geo']);
  const worker = await read('src/index.js');
  assert.match(worker, /this\.room\.categoriesFixed = true/);
  assert.match(worker, /if \(this\.room\.categoriesFixed\) return this\.sendError\(ws, "الأقسام محددة من الجمعة"\);/);
  const page = await read('public/assets/js/party-v29.js');
  assert.match(page, /data-cats="all"/);
  assert.match(page, /flags:'🚩'/);
});

test('20 players: every table game seats all of them in balanced tables', () => {
  const ids = Array.from({ length: 20 }, (_, i) => 'p' + i);
  for (const game of Object.keys(LINKED_GAMES)) {
    const tables = linkTables(game, ids), max = LINKED_GAMES[game].tables ? LINKED_GAMES[game].max : 20;
    assert.equal(tables.flat().length, 20, game);
    assert.equal(new Set(tables.flat()).size, 20, game);
    assert.ok(tables.every((t) => t.length <= max), game);
    assert.ok(Math.max(...tables.map((t) => t.length)) - Math.min(...tables.map((t) => t.length)) <= 1, game + ' balanced');
  }
  assert.deepEqual(tablesFor('ludo', 20), [4, 4, 4, 4, 4]);
  // the party list is in the order players read it: quiz first, then the board games together
  const order = PARTY_GAMES.map((g) => g.id);
  assert.equal(order[0], 'quiz');
  assert.ok(order.indexOf('ludo') < order.indexOf('jackaroo') && order.indexOf('jackaroo') < order.indexOf('snakes'));
});

test('20 players: a busy room sends the long history once, not with every update', async (t) => {
  let clock = 100000; t.mock.method(Date, 'now', () => clock);
  const sockets = [], data = new Map();
  const storage = { async get(k) { return structuredClone(data.get(k)); }, async put(k, v) { if (typeof k === 'object') for (const [key, value] of Object.entries(k)) data.set(key, value); else data.set(k, v); }, async delete() {}, async deleteAll() {}, async setAlarm() {}, async transaction(fn) { return fn(this); } };
  const unit = new PartyRoom({ storage, getWebSockets: () => sockets, blockConcurrencyWhile: (fn) => Promise.resolve().then(fn) }, {});
  await unit.ready;
  unit.room = createParty({ code: '150003', hostKey: 'x'.repeat(40), playlist: ['memory', 'quiz'], now: clock });
  for (let i = 0; i < 20; i++) {
    const p = addPartyPlayer(unit.room, { name: 'P' + i, now: clock }); p.connection = 'c' + i;
    sockets.push({ readyState: 1, sent: [], deserializeAttachment: () => ({ party: true, playerId: p.id, connection: p.connection }), send(v) { this.sent.push(JSON.parse(v)); }, close() {} });
  }
  t.after(() => unit.stop());
  unit.room.history = Array.from({ length: 22 }, (_, i) => ({ game: 'quiz', rows: unit.room.order.map((id) => ({ id, points: i })) }));
  unit.broadcast(); unit.broadcast(); unit.broadcast();
  const rooms = sockets[0].sent.filter((m) => m.type === 'room');
  assert.equal(rooms.length, 3);
  assert.equal(rooms[0].state.history.length, 22);
  assert.equal(rooms[1].state.history, undefined);
  assert.equal(rooms[2].state.historyCount, 22);
  assert.ok(JSON.stringify(rooms[1]).length < JSON.stringify(rooms[0]).length / 2);
  unit.room.history.push({ game: 'memory', rows: [] });
  unit.broadcast();
  assert.equal(sockets[0].sent.filter((m) => m.type === 'room').at(-1).state.history.length, 23, 'a new round sends it again');
  assert.equal(partySnapshot(unit.room, null).history.length, 23, 'a resync still gets everything');
});
