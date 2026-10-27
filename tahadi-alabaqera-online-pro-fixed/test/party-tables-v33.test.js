import test from 'node:test';
import assert from 'node:assert/strict';
import { environment } from './worker-harness.mjs';
import { createLinkedRoom } from '../src/party/party-link.js';
import { PARTY_TABLE_WAIT_MS } from '../src/games/board-tables.js';

// 33.0.0: a table the group room opens starts by itself: as soon as all of its
// players are in, or 30 seconds after the first one came (bots take the empty seats).
const LINK = { code: '654321', round: '0f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a', token: 'T'.repeat(64) };

function sockets(t) {
  const originalPair = globalThis.WebSocketPair, OriginalResponse = globalThis.Response;
  globalThis.WebSocketPair = class { constructor() { for (let i = 0; i < 2; i++) this[i] = { sent: [], send(m) { this.sent.push(JSON.parse(m)); }, serializeAttachment(v) { this.attachment = v; }, deserializeAttachment() { return this.attachment; }, close() {} }; } };
  globalThis.Response = class extends OriginalResponse { constructor(body, init) { if (init?.status === 101) { super(null, { status: 200, headers: init.headers }); Object.defineProperty(this, 'status', { value: 101 }); this.webSocket = init.webSocket; } else super(body, init); } };
  t.after(() => { globalThis.WebSocketPair = originalPair; globalThis.Response = OriginalResponse; });
}

async function partyTable(t, { game = 'snakes', expected = 3, playerLimit = expected } = {}) {
  sockets(t);
  const env = environment(), holder = env.BOARD_ROOMS.peek('party-table');
  await holder.ctx.ready;
  const res = await holder.instance.fetch(new Request('https://board.internal/init', { method: 'POST', body: JSON.stringify({ code: '400123', hostKey: 'h'.repeat(64), game, playerLimit, expected, variant: 'classic', party: LINK }) }));
  assert.equal(res.status, 201);
  const board = holder.instance;
  const join = async (name) => {
    const response = await board.fetch(new Request('https://board.internal/ws?name=' + encodeURIComponent(name), { headers: { upgrade: 'websocket', 'sec-websocket-protocol': 'busraj-v1' } }));
    assert.equal(response.status, 101, name + ' joins');
    const ws = holder.ctx.sockets.at(-1);
    return { ws, id: ws.deserializeAttachment().playerId };
  };
  return { env, holder, board, join };
}

test('the group room tells each board table how many of its players to wait for', async () => {
  const calls = [];
  const env = { BOARD_ROOMS: { idFromName: (n) => n, get: (name) => ({ fetch: async (url, init) => { calls.push({ name, body: JSON.parse(init.body) }); return new Response('{}', { status: 201 }); } }) } };
  for (const [game, count, limit] of [['snakes', 3, 3], ['zahra', 2, 2], ['jackaroo', 3, 4], ['jackaroo', 5, 6]]) {
    const res = await createLinkedRoom(env, game, { count, link: LINK });
    assert.equal(res.ok, true);
    const body = calls.at(-1).body;
    assert.equal(body.expected, count, game + ' waits for its ' + count + ' players');
    assert.equal(body.playerLimit, limit);
    assert.deepEqual(body.party, LINK);
  }
});

test('a group table starts the moment its last player is in, and nobody can start it early', async (t) => {
  const { board, join } = await partyTable(t, { expected: 3 });
  const a = await join('سعد');
  assert.equal(board.room.status, 'lobby');
  assert.ok(board.room.lobbyDeadline >= Date.now() + PARTY_TABLE_WAIT_MS - 1000, 'the wait starts with the first player');
  assert.deepEqual(board.publicState(a.id).party, { expected: 3, first: true });
  await join('نورة');
  // the first one in hosts the room but cannot start the table before the others come
  await board.webSocketMessage(a.ws, JSON.stringify({ type: 'start' }));
  assert.equal(board.room.status, 'lobby');
  assert.match(a.ws.sent.at(-1).message, /لحالها/);
  await join('ريم');
  assert.equal(board.room.status, 'playing', 'everyone came: it starts right away');
  assert.deepEqual(board.room.order.map((id) => board.room.players[id].name), ['سعد', 'نورة', 'ريم']);
  assert.equal(board.room.order.some((id) => board.room.players[id].bot), false);
  assert.equal(board.publicState(a.id).party.first, false);
});

test('when someone does not come, the table starts after the wait with a bot in the seat', async (t) => {
  const { board, join } = await partyTable(t, { game: 'jackaroo', expected: 4, playerLimit: 4 });
  await join('سعد'); await join('نورة'); await join('ريم');
  assert.equal(board.room.status, 'lobby');
  const realNow = Date.now, at = board.room.lobbyDeadline;
  Date.now = () => at + 1;
  try { await board.alarm(); } finally { Date.now = realNow; }
  assert.equal(board.room.status, 'playing');
  const seats = board.room.order.map((id) => board.room.players[id]);
  assert.equal(seats.length, 4);
  assert.equal(seats.filter((p) => p.bot).length, 1, 'one bot takes the missing seat');
});

test('a group table nobody is in at the deadline waits for the next one instead of closing', async (t) => {
  const { board, holder, join } = await partyTable(t, { expected: 2 });
  const a = await join('سعد');
  holder.ctx.sockets.splice(holder.ctx.sockets.indexOf(a.ws), 1); // a closed socket is gone from the runtime's list
  await board.webSocketClose(a.ws);
  const realNow = Date.now, at = board.room.lobbyDeadline;
  Date.now = () => at + 1;
  try { await board.alarm(); } finally { Date.now = realNow; }
  assert.equal(board.room.status, 'lobby');
  assert.equal(board.room.lobbyDeadline, null);
  // the next one in starts the wait again
  await join('نورة');
  assert.ok(board.room.lobbyDeadline > Date.now());
});

test('the page shows a group table as a countdown that waits for its players', async () => {
  const fs = await import('node:fs/promises');
  const source = await fs.readFile(new URL('../public/assets/js/board-table-v33.js', import.meta.url), 'utf8');
  assert.match(source, /next\.party\?\.first/);
  assert.match(source, /طاولتك في الجمعة/);
  assert.match(source, /canStart:false/);
  const menu = await fs.readFile(new URL('../public/assets/js/game-menu-v33.js', import.meta.url), 'utf8');
  assert.match(menu, /ringSeconds/);
  assert.match(menu, /openSeat/);
});

test('a group room arena (حلبة الثعابين) also starts by itself when its players are in', async (t) => {
  sockets(t);
  const { SerpentRoom, PARTY_ARENA_WAIT_MS } = await import('../src/serpent/serpent-room.js');
  const values = new Map(), list = [];
  const storage = { async get(k) { return structuredClone(values.get(k)); }, async put(k, v) { values.set(k, structuredClone(v)); }, async delete(k) { values.delete(k); }, async setAlarm(at) { this.alarm = at; }, async deleteAlarm() { this.alarm = null; } };
  const ctx = { storage, id: { toString: () => 'serpent:party' }, getWebSockets: () => list, acceptWebSocket: (s) => list.push(s), blockConcurrencyWhile: (fn) => fn(), waitUntil: (p) => p.catch(() => {}) };
  const room = new SerpentRoom(ctx, {});
  const res = await room.fetch(new Request('https://serpent.internal/init', { method: 'POST', body: JSON.stringify({ code: '350123', hostKey: 'h'.repeat(43), playerLimit: 3, duration: 120, botCount: 0, difficulty: 'mixed', matchMode: 'timed', expected: 3, party: LINK }) }));
  assert.equal(res.status, 201);
  const join = async (name) => {
    const r = await room.fetch(new Request('https://serpent.internal/ws?name=' + encodeURIComponent(name), { headers: { upgrade: 'websocket', 'sec-websocket-protocol': 'busraj-serpent-v1' } }));
    assert.equal(r.status, 101);
    return list.at(-1);
  };
  const first = await join('سعد');
  assert.equal(room.room.status, 'lobby');
  assert.ok(room.room.lobbyDeadline >= Date.now() + PARTY_ARENA_WAIT_MS - 1000);
  assert.deepEqual(room.publicState().party, { expected: 3, first: true });
  await room.webSocketMessage(first, JSON.stringify({ type: 'start' }));
  assert.equal(room.room.status, 'lobby', 'nobody starts it early');
  await join('نورة');
  // one does not come: after the wait it starts with the two who came
  const realNow = Date.now, at = room.room.lobbyDeadline;
  Date.now = () => at + 1;
  try { await room.alarm(); } finally { Date.now = realNow; }
  room.stop();
  assert.equal(room.room.status, 'playing');
  assert.equal(room.room.game.snakes.filter((s) => !s.bot).length, 2);
});
