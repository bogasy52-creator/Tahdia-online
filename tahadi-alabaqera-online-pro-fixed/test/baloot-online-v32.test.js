import test from 'node:test';
import assert from 'node:assert/strict';
import { environment, api } from './worker-harness.mjs';
import { chooseBalootAction } from '../public/assets/js/engines/baloot-bot.js';
import { balootActions } from '../public/assets/js/engines/baloot-engine.js';

async function makeRoom() {
  const env = environment();
  const res = await api(env, '/api/board/rooms', { game: 'baloot', name: 'سعد' });
  assert.equal(res.data.ok, true);
  const entry = env.BOARD_ROOMS.peek(res.data.code);
  await entry.ctx.ready;
  const board = entry.instance;
  const host = board.addPlayer('سعد', 'host');
  const sent = new Map();
  const socket = (p) => ({ deserializeAttachment: () => ({ playerId: p.id }), send: (s) => { const list = sent.get(p.id) || []; list.push(JSON.parse(s)); sent.set(p.id, list); } });
  return { env, res, board, host, socket, sent };
}

test('a private Baloot room seats friends as partners and fills the rest with bots', async () => {
  const h = await makeRoom();
  const guest = h.board.addPlayer('ماجد', 'guest');
  assert.equal(h.host.seat, 0);
  assert.equal(guest.seat, 2, 'the second player is the partner across the table');
  await h.board.webSocketMessage(h.socket(guest), JSON.stringify({ type: 'start' }));
  assert.equal(h.board.room.status, 'lobby', 'only the host starts');
  await h.board.webSocketMessage(h.socket(h.host), JSON.stringify({ type: 'start' }));
  assert.equal(h.board.room.status, 'playing');
  assert.deepEqual(h.board.room.bots.sort(), [1, 3]);
  const view = h.board.publicState(h.host.id);
  assert.equal(view.game, 'baloot');
  assert.equal(view.me.index, 0);
  assert.deepEqual(view.players.map((p) => [p.index, p.bot]), [[0, false], [1, true], [2, false], [3, true]]);
  assert.ok(view.state.hands[0].every((c) => c !== '??'));
  assert.ok(view.state.hands[1].every((c) => c === '??'), 'a bot hand stays hidden');
  assert.ok(view.state.hands[2].every((c) => c === '??'), 'so does the partner\'s');
  assert.ok(view.batch.events.some((e) => e.type === 'deal'));
});

test('humans act on their turn, bots answer at once, timeouts and new hands run on alarms', async () => {
  const h = await makeRoom();
  const guest = h.board.addPlayer('ماجد', 'guest');
  await h.board.webSocketMessage(h.socket(h.host), JSON.stringify({ type: 'start' }));
  const humans = { 0: h.host, 2: guest };
  let timeouts = 0;
  for (let step = 0; step < 3000 && h.board.room?.status === 'playing'; step++) {
    const room = h.board.room;
    const s = room.state;
    if (s.phase === 'scored') {
      room.nextHandAt = Date.now() - 1;
      await h.board.alarm();
      continue;
    }
    const player = humans[s.turn];
    assert.ok(player, 'only humans are waited for');
    if (step % 9 === 4) {
      // the player is away: the alarm plays for them
      room.turnDeadline = Date.now() - 1;
      await h.board.alarm();
      timeouts++;
      continue;
    }
    const view = h.board.publicState(player.id);
    const action = chooseBalootAction(view.state, s.turn, { level: 'hard' });
    // open play: a player may also claim (يسجّل) a cut it can prove; that is not a turn action
    assert.ok(action.type === 'claim' || balootActions(view.state, s.turn).some((a) => JSON.stringify(a) === JSON.stringify(action)));
    const before = room.version;
    await h.board.webSocketMessage(h.socket(player), JSON.stringify({ type: 'baloot', action, expectedVersion: room.version }));
    assert.equal(h.board.room.version, before + 1, 'every move is a new version');
  }
  assert.equal(h.board.room.status, 'finished');
  assert.ok(timeouts > 0);
  assert.ok([0, 1].includes(h.board.room.state.winner));
  assert.ok(Math.max(...h.board.room.state.scores) >= 152 || h.board.room.state.history.some((x) => x.contract?.gahwa));
});

test('moves out of turn, forged cards and stale versions are refused', async () => {
  const h = await makeRoom();
  const guest = h.board.addPlayer('ماجد', 'guest');
  await h.board.webSocketMessage(h.socket(h.host), JSON.stringify({ type: 'start' }));
  const s = h.board.room.state;
  const other = s.turn === 0 ? guest : h.host;
  const version = h.board.room.version;
  await h.board.webSocketMessage(h.socket(other), JSON.stringify({ type: 'baloot', action: { type: 'bid', bid: 'pass' }, expectedVersion: version }));
  assert.equal(h.board.room.version, version);
  assert.match(h.sent.get(other.id).at(-1).message, /دورك/);
  const mover = s.turn === 0 ? h.host : guest;
  await h.board.webSocketMessage(h.socket(mover), JSON.stringify({ type: 'baloot', action: { type: 'bid', bid: 'pass' }, expectedVersion: version - 1 }));
  assert.equal(h.board.room.version, version, 'a stale version does nothing');
  await h.board.webSocketMessage(h.socket(mover), JSON.stringify({ type: 'baloot', action: { type: 'play', card: 'AS' }, expectedVersion: version }));
  assert.equal(h.board.room.version, version, 'no card play during bidding');
});

test('quick Baloot hands out four seats per public table and starts it with bots', async (t) => {
  const originalPair = globalThis.WebSocketPair, OriginalResponse = globalThis.Response;
  globalThis.WebSocketPair = class { constructor() { for (let i = 0; i < 2; i++) this[i] = { send() {}, serializeAttachment(v) { this.attachment = v; }, deserializeAttachment() { return this.attachment; }, close() {} }; } };
  globalThis.Response = class extends OriginalResponse { constructor(body, init) { if (init?.status === 101) { super(null, { status: 200, headers: init.headers }); Object.defineProperty(this, 'status', { value: 101 }); this.webSocket = init.webSocket; } else super(body, init); } };
  t.after(() => { globalThis.WebSocketPair = originalPair; globalThis.Response = OriginalResponse; });
  const env = environment();
  const codes = [];
  for (let i = 0; i < 5; i++) codes.push((await api(env, '/api/baloot/quick', { name: 'لاعب' + i })).data.code);
  assert.equal(new Set(codes.slice(0, 4)).size, 1);
  assert.notEqual(codes[4], codes[0], 'the fifth player gets a new table');
  const entry = env.BOARD_ROOMS.peek(codes[0]);
  await entry.ctx.ready;
  const board = entry.instance;
  assert.equal(board.room.publicMatch, true);
  const response = await board.fetch(new Request('https://board.internal/ws?name=' + encodeURIComponent('أول') + '&game=baloot', { headers: { upgrade: 'websocket', 'sec-websocket-protocol': 'busraj-v1' } }));
  assert.equal(response.status, 101, 'a public table needs no host');
  assert.equal(Object.values(board.room.players)[0].seat, 0);
  board.room.lobbyDeadline = Date.now() - 1;
  await board.alarm();
  assert.equal(board.room.status, 'playing');
  assert.equal(board.room.bots.length, 3);
  // an empty public table closes itself
  const empty = env.BOARD_ROOMS.peek(codes[4]);
  await empty.ctx.ready;
  empty.instance.room.lobbyDeadline = Date.now() - 1;
  await empty.instance.alarm();
  assert.equal(empty.instance.room, null);
});

test('32.1.0: table talk carries only the fixed phrases and emoji, at a calm pace', async () => {
  const h = await makeRoom();
  const guest = h.board.addPlayer('ماجد', 'guest');
  const sockets = [h.socket(h.host), h.socket(guest)];
  h.env.BOARD_ROOMS.peek(h.res.data.code).ctx.sockets.push(...sockets);
  await h.board.webSocketMessage(sockets[0], JSON.stringify({ type: 'start' }));
  const talk = (who) => (h.sent.get(who.id) || []).filter((m) => m.type === 'talk');
  await h.board.webSocketMessage(sockets[1], JSON.stringify({ type: 'talk', kind: 'phrase', id: 'p3' }));
  assert.deepEqual(talk(h.host).map((m) => [m.kind, m.id, m.seat]), [['phrase', 'p3', guest.seat]], 'everyone at the table hears it');
  assert.equal(talk(guest).length, 1);
  await h.board.webSocketMessage(sockets[1], JSON.stringify({ type: 'talk', kind: 'emoji', id: 'e2' }));
  assert.equal(talk(h.host).length, 1, 'too soon after the last one');
  await h.board.webSocketMessage(sockets[0], JSON.stringify({ type: 'talk', kind: 'phrase', id: 'free text <b>' }));
  await h.board.webSocketMessage(sockets[0], JSON.stringify({ type: 'talk', kind: 'text', id: 'p1' }));
  assert.equal(talk(guest).length, 1, 'nothing but the fixed list is relayed');
});

test('32.1.0: a Baloot room plays open by default; a claim comes from any seat during play', async () => {
  const h = await makeRoom();
  const guest = h.board.addPlayer('ماجد', 'guest');
  await h.board.webSocketMessage(h.socket(h.host), JSON.stringify({ type: 'start' }));
  assert.equal(h.board.room.state.open, true);
  const claimFrom = async (player) => h.board.webSocketMessage(h.socket(player), JSON.stringify({ type: 'baloot', action: { type: 'claim' }, expectedVersion: h.board.room.version }));
  // during the bidding a claim is refused with a clear reason
  const v0 = h.board.room.version;
  await claimFrom(guest);
  assert.equal(h.board.room.version, v0);
  assert.match(h.sent.get(guest.id).at(-1).message, /التسجيل/);
  // play on until a card is on the table, then the player who is not on turn claims
  const humans = { 0: h.host, 2: guest };
  for (let step = 0; step < 60 && !(h.board.room.state.phase === 'playing' && h.board.room.state.played?.length); step++) {
    const s = h.board.room.state, player = humans[s.turn];
    const action = chooseBalootAction(h.board.publicState(player.id).state, s.turn, { level: 'hard', honest: true });
    await h.board.webSocketMessage(h.socket(player), JSON.stringify({ type: 'baloot', action, expectedVersion: h.board.room.version }));
  }
  const s = h.board.room.state;
  assert.equal(s.phase, 'playing');
  const notOnTurn = s.turn === 0 ? guest : h.host;
  const handNo = s.handNo;
  await claimFrom(notOnTurn);
  const result = h.board.room.state.history.find((x) => x.handNo === handNo && x.claim);
  assert.ok(result, 'the claim ended the hand');
  // the humans played by the rules; a bot may have cut, and then the claim is right
  const caught = (s.violations || []).some((v) => v.seat % 2 !== notOnTurn.seat % 2);
  assert.equal(result.claim.correct, caught);
  assert.equal(result.winnerTeam, caught ? notOnTurn.seat % 2 : 1 - (notOnTurn.seat % 2), 'a right claim wins the hand, a wrong one gives it away');
});
