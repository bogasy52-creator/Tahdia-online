import test from 'node:test';
import assert from 'node:assert/strict';
import { environment, api } from './worker-harness.mjs';
import { seatsFor, seatPlan, startTable, playerMove, timeoutMove, runBots, tableOver, winnerSeats, cleanLook, pickBotLevel, MAX_SEATS, QUICK_SEATS, STEP_MS, DEFAULT_LOOK } from '../src/games/board-tables.js';
import { gameOfCode, roomCodeFor } from '../src/rooms/room-codes.js';

function seeded(seed) { return () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; }; }
function room(game, humans = 1, variant = 'classic') {
  const r = { code: '400000', game, variant, status: 'lobby', players: {}, order: [], state: null, pendingRoll: null, version: 3 };
  for (let i = 0; i < humans; i++) { const id = 'h' + i; r.players[id] = { id, name: 'لاعب ' + i, role: i ? 'guest' : 'host', connected: true, look: cleanLook({}) }; r.order.push(id); }
  return r;
}
// Plays a whole match for the people with the plain choices, as a client would.
function playOut(r, rng, limit = 4000) {
  let moves = 0;
  while (!tableOver(r) && moves++ < limit) {
    const seat = r.state.turn, id = r.order[seat];
    assert.equal(r.players[id].bot, undefined, 'after every batch the turn is a person\'s');
    let msg;
    if (r.game === 'snakes') msg = { type: 'roll' };
    else if (r.game === 'zahra') msg = r.pendingRoll === null ? { type: 'roll' } : { type: 'ludo_move', token: 0 };
    else if (r.game === 'dice') msg = r.state.turnTotal >= 15 ? { type: 'dice_bank' } : { type: 'dice_roll' };
    else { const steps = timeoutMove(r, rng); assert.ok(steps); continue; }
    if (r.game === 'zahra' && msg.type === 'ludo_move') {
      const legal = r.state.players[seat].tokens.map((_, i) => i);
      for (const token of legal) { try { playerMove(r, seat, { type: 'ludo_move', token }, rng); msg = null; break; } catch {} }
      if (msg) throw new Error('no legal zahra move');
      continue;
    }
    playerMove(r, seat, msg, rng);
  }
  return moves;
}

test('table sizes: rooms seat whoever came, quick tables fill up, Jackaroo keeps its teams', () => {
  assert.deepEqual([1, 2, 3, 7].map((n) => seatsFor('snakes', n)), [2, 2, 3, 7]);
  assert.deepEqual([1, 2, 5].map((n) => seatsFor('snakes', n, true)), [4, 4, 5]);
  assert.deepEqual([1, 3, 4, 5, 6].map((n) => seatsFor('jackaroo', n)), [4, 4, 4, 6, 6]);
  assert.equal(seatsFor('zahra', 9), MAX_SEATS.zahra);
  assert.equal(seatsFor('dice', 1, true), QUICK_SEATS.dice);
  assert.deepEqual(seatPlan('jackaroo', ['a', 'b', 'c'], 4), ['a', 'c', 'b', null], 'the first two in sit as partners');
  assert.deepEqual(seatPlan('jackaroo', ['a', 'b', 'c', 'd', 'e'], 6), ['a', 'd', 'b', 'e', 'c', null]);
  assert.deepEqual(seatPlan('snakes', ['a', 'b'], 4), ['a', 'b', null, null]);
});

test('bots come in every strength and look like players from the shop', () => {
  const rng = seeded(7), levels = new Set();
  for (let i = 0; i < 200; i++) levels.add(pickBotLevel(rng));
  assert.deepEqual([...levels].sort(), ['easy', 'hard', 'medium']);
  const r = room('snakes', 1);
  startTable(r, { quick: true, rng: seeded(3) });
  const bots = r.order.map((id) => r.players[id]).filter((p) => p.bot);
  assert.equal(bots.length, 3);
  assert.equal(new Set(bots.map((b) => b.name)).size, 3, 'no two bots share a name');
  for (const b of bots) { assert.ok(['easy', 'medium', 'hard'].includes(b.level)); assert.match(b.look.dice, /^dice-/); assert.match(b.look.pawn, /^pawn-/); }
  assert.deepEqual(cleanLook({ dice: 'dice-ruby', pawn: 'pawn-gold', character: 'character-samurai' }), { dice: 'dice-ruby', pawn: 'pawn-gold', character: 'samurai' });
  assert.deepEqual(cleanLook({ dice: 'x', pawn: '<b>', character: 'nobody' }), DEFAULT_LOOK);
});

for (const game of ['snakes', 'zahra', 'jackaroo', 'dice']) {
  test(`${game}: a person against bots plays a whole match; every bot move is a step to animate`, () => {
    const rng = seeded(game.length * 977 + 1);
    const r = room(game, 1, game === 'snakes' ? 'adventure' : 'classic');
    const startSteps = startTable(r, { quick: true, rng });
    assert.equal(r.status, 'playing');
    assert.equal(startSteps.list[0].version, 4, 'the starting position is the first step');
    assert.deepEqual(startSteps.list.map((s) => s.version), startSteps.list.map((_, i) => 4 + i), 'steps are numbered one by one');
    assert.equal(r.version, startSteps.list.at(-1).version);
    const moves = playOut(r, rng);
    assert.ok(tableOver(r), 'the match ends');
    assert.ok(moves > 3);
    assert.ok(winnerSeats(r).length >= 1);
    assert.ok(STEP_MS[game] > 0);
  });
}

test('steps carry each Zahra roll before its move, and a person is never played for while on time', () => {
  const rng = seeded(11), r = room('zahra', 1);
  startTable(r, { quick: false, rng });
  assert.equal(r.order.length, 2);
  // bring the turn to the person
  if (r.players[r.order[r.state.turn]].bot) runBots(r, { from: r.version, list: [] }, rng);
  const seat = r.state.turn;
  const steps = playerMove(r, seat, { type: 'roll' }, rng);
  if (r.pendingRoll !== null) {
    assert.equal(steps.list.length, 1, 'with a move to choose, nothing else happens yet');
    assert.equal(steps.list[0].pendingRoll, r.pendingRoll);
    assert.throws(() => playerMove(r, seat, { type: 'roll' }, rng), /move_first/);
  }
  assert.throws(() => playerMove(r, (seat + 1) % 2, { type: 'roll' }, rng), /wrong_turn|move_first/);
});

test('the dice race: bank needs points, a timeout banks or rolls for the person', () => {
  const rng = seeded(5), r = room('dice', 2);
  startTable(r, { rng });
  assert.equal(r.order.length, 2, 'two friends: no bot');
  assert.ok(r.order.every((id) => !r.players[id].bot));
  assert.throws(() => playerMove(r, r.state.turn, { type: 'dice_bank' }, rng), /roll_first/);
  const steps = timeoutMove(r, rng);
  assert.equal(steps.list.length, 1);
});

test('codes name their game; board quick tables start after the lobby with bots in the empty seats', async () => {
  for (const game of ['snakes', 'zahra', 'jackaroo', 'dice', 'baloot', 'quiz', 'party']) assert.equal(gameOfCode(roomCodeFor(game)), game);
  const env = environment();
  const first = await api(env, '/api/board/quick', { game: 'snakes', variant: 'adventure' });
  assert.equal(first.data.ok, true, JSON.stringify(first.data));
  assert.equal(gameOfCode(first.data.code), 'snakes');
  const second = await api(env, '/api/board/quick', { game: 'snakes', variant: 'adventure' });
  assert.equal(second.data.code, first.data.code, 'the next player joins the same open table');
  const classic = await api(env, '/api/board/quick', { game: 'snakes' });
  assert.notEqual(classic.data.code, first.data.code, 'each way of playing has its own tables');
  assert.equal((await api(env, '/api/board/quick', { game: 'chess' })).response.status, 400);
  const entry = env.BOARD_ROOMS.peek(first.data.code);
  await entry.ctx.ready;
  const board = entry.instance;
  assert.equal(board.room.publicMatch, true);
  assert.equal(board.room.variant, 'adventure');
  const person = board.addPlayer('سعد', 'guest');
  const sent = [];
  entry.ctx.sockets.push({ deserializeAttachment: () => ({ playerId: person.id }), send: (m) => sent.push(JSON.parse(m)) });
  board.room.lobbyDeadline = Date.now() - 1;
  await board.alarm();
  assert.equal(board.room.status, 'playing');
  assert.equal(board.room.order.length, 4, 'a quick table fills to four');
  const view = sent.at(-1).state;
  assert.equal(view.players.filter((p) => p.bot).length, 3);
  assert.ok(view.steps?.length >= 1, 'the start goes out as steps');
  assert.equal(view.steps.at(-1).version, view.version);
  assert.equal(view.players[0].look.dice, DEFAULT_LOOK.dice);
  // a friends' room has no player count and starts with whoever is in
  const made = await api(env, '/api/board/rooms', { game: 'dice', name: 'سعد', playerLimit: 2 });
  assert.equal(made.data.ok, true);
  assert.equal(made.data.playerLimit, MAX_SEATS.dice, 'the room takes as many as come');
  assert.equal(gameOfCode(made.data.code), 'dice');
  const resolved = await api(env, '/api/rooms/resolve/' + made.data.code);
  assert.deepEqual({ ok: resolved.data.ok, game: resolved.data.game, page: resolved.data.page }, { ok: true, game: 'dice', page: '/dice' });
  assert.equal((await api(env, '/api/rooms/resolve/' + '440000')).response.status, 404);
});

test('Jackaroo steps never show another player\'s cards', async () => {
  const env = environment();
  const made = await api(env, '/api/board/rooms', { game: 'jackaroo', name: 'سعد' });
  const entry = env.BOARD_ROOMS.peek(made.data.code);
  await entry.ctx.ready;
  const board = entry.instance;
  const host = board.addPlayer('سعد', 'host');
  const sent = [];
  entry.ctx.sockets.push({ deserializeAttachment: () => ({ playerId: host.id }), send: (m) => sent.push(JSON.parse(m)) });
  await board.webSocketMessage(entry.ctx.sockets[0], JSON.stringify({ type: 'start' }));
  assert.equal(board.room.status, 'playing');
  const view = sent.at(-1).state, me = view.me.index;
  for (const step of view.steps) step.state.hands.forEach((hand, seat) => { if (seat !== me) assert.ok(hand.every((c) => c === '?')); });
  assert.ok(view.state.hands[me].every((c) => c !== '?'));
});
