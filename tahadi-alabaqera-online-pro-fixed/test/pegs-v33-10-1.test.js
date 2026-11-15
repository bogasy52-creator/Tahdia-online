// 33.10.1: «شطرنج الذاكرة» — the engine, the room (hidden colours, the look, the computer seats) and the page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PEGS, PEG_HOLES, createPegsGame, rollPegs, pickPegs, peekPegs, pegsTimeout, choosePegsMove } from '../public/assets/js/engines/pegs-engine.js';
import { TABLE_GAMES, MAX_SEATS, chosenSeats, seatsFor, startTable, playerMove, timeoutMove, tableOver, stepsTime } from '../src/games/board-tables.js';
import { ROOM_FAMILIES, gameOfCode, roomCodeFor } from '../src/rooms/room-codes.js';
import { environment, api } from './worker-harness.mjs';

const seeded = (seed) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('the board: 24 holes, four pawns of each of six colours, and a first player', () => {
  const s = createPegsGame(['أ', 'ب', 'ج'], { rng: seeded(3) });
  assert.equal(PEG_HOLES.length, 24);
  assert.equal(s.pegs.length, 24);
  for (let c = 0; c < 6; c++) assert.equal(s.pegs.filter((p) => p.c === c).length, 4);
  assert.equal(s.players.length, 3);
  assert.ok(s.turn >= 0 && s.turn < 3);
  assert.equal(s.phase, 'roll');
  assert.ok(s.lookUntil > Date.now());
});

test('a right pawn is kept and the same player rolls again; a wrong one is shown and the turn passes', () => {
  let s = createPegsGame(['أ', 'ب'], { rng: seeded(5), first: 0 });
  assert.throws(() => pickPegs(s, 0, 0), /not_pick/);
  assert.throws(() => rollPegs(s, 1), /wrong_turn/);
  s = rollPegs(s, 0, seeded(9));
  assert.equal(s.phase, 'pick');
  const right = s.pegs.findIndex((p) => p.c === s.die);
  s = pickPegs(s, 0, right);
  assert.equal(s.last.ok, true); assert.equal(s.turn, 0); assert.equal(s.players[0].score, 1); assert.equal(s.pegs[right].taken, 0);
  s = rollPegs(s, 0, seeded(11));
  const wrong = s.pegs.findIndex((p) => p.taken === null && p.c !== s.die);
  s = pickPegs(s, 0, wrong);
  assert.equal(s.last.ok, false); assert.equal(s.turn, 1); assert.equal(s.pegs[wrong].taken, null);
  assert.equal(s.reveals.at(-1).peg, wrong);
});

test('three right in a row make every pawn worth two; the die never lands on a colour that is gone', () => {
  let s = createPegsGame(['أ', 'ب'], { rng: seeded(7), first: 0 }), rng = seeded(13);
  for (let k = 0; k < 5; k++) { s = rollPegs(s, 0, rng); s = pickPegs(s, 0, s.pegs.findIndex((p) => p.taken === null && p.c === s.die)); }
  assert.equal(s.players[0].streak, 5);
  assert.equal(s.players[0].score, 1 + 1 + 2 + 2 + 2);
  // empty a colour, then roll many times
  for (const p of s.pegs) if (p.c === 0) p.taken = 1;
  for (let k = 0; k < 40; k++) { const r = rollPegs({ ...s, phase: 'roll', turn: 0 }, 0, rng); assert.notEqual(r.die, 0); }
  assert.equal(PEGS.HOT, 3);
});

test('«عين الصقر» once a game; games always end, the challenge table swaps, and the computer levels differ', () => {
  let s = createPegsGame(['أ', 'ب'], { rng: seeded(2), first: 0 });
  s = peekPegs(s, 0, 4);
  assert.deepEqual([s.peek.peg, s.peek.c], [4, s.pegs[4].c]);
  assert.throws(() => peekPegs(s, 0, 5), /no_peeks/);
  const rate = (level) => {
    let right = 0, all = 0, swaps = 0;
    for (let g = 0; g < 60; g++) {
      const rng = seeded(100 + g); let t = createPegsGame(['أ', 'ب', 'ج'], { rng, swaps: true }); t.salt = g;
      for (let n = 0; n < 3000 && t.winner === null; n++) { const m = choosePegsMove(t, level, rng); t = m.type === 'roll' ? rollPegs(t, t.turn, rng) : pickPegs(t, t.turn, m.peg, rng); if (t.last.type === 'pick') { all++; if (t.last.ok) right++; if (t.last.swapped) swaps++; } }
      assert.notEqual(t.winner, null); assert.equal(t.pegs.every((p) => p.taken !== null), true);
    }
    assert.ok(swaps > 0);
    return right / all;
  };
  const easy = rate('easy'), hard = rate('hard');
  assert.ok(easy > 0.2 && hard > easy + 0.2, easy + ' / ' + hard);
});

test('the rooms seat 2 to 4, codes start with 05, and a move during the look is refused', () => {
  assert.ok(TABLE_GAMES.includes('pegs'));
  assert.equal(MAX_SEATS.pegs, 4);
  assert.equal(chosenSeats('pegs', 3), 3);
  assert.equal(seatsFor('pegs', 1, true, 4), 4);
  assert.deepEqual(ROOM_FAMILIES.pegs, { from: 5, to: 5, page: '/pegs' });
  assert.equal(gameOfCode(roomCodeFor('pegs')), 'pegs');
  const rng = seeded(21), now = Date.now();
  const room = { game: 'pegs', status: 'lobby', version: 1, players: { h: { id: 'h', name: 'سعد', ready: true, connected: true } }, order: ['h'], tableSeats: 3, variant: 'classic' };
  const steps = startTable(room, { quick: true, rng, roll: () => 3, now });
  assert.equal(room.order.length, 3);
  assert.ok(stepsTime(room, steps) >= PEGS.PEEK_MS, 'the opening look is part of the first clock');
  const me = room.order.indexOf('h');
  if (room.state.turn === me) assert.throws(() => playerMove(room, me, { type: 'pegs_roll' }, rng, () => 3, now + 1000), /look_phase/);
  let t = now + PEGS.PEEK_MS + 1000;
  for (let n = 0; n < 600 && !tableOver(room); n++) {
    if (room.state.turn === me) playerMove(room, me, room.state.phase === 'roll' ? { type: 'pegs_roll' } : { type: 'pegs_pick', peg: room.state.pegs.findIndex((p) => p.taken === null) }, rng, () => 3, t);
    else timeoutMove(room, rng, () => 3);
    t += 1000;
  }
  assert.equal(tableOver(room), true);
});

test('the room never sends a hidden colour: only the look, and «عين الصقر» to its owner', async () => {
  const src = await read('src/index.js');
  assert.match(src, /this\.room\.game === "pegs"/);
  assert.match(src, /state\.seq === 0 && Date\.now\(\) < Number\(state\.lookUntil/);
  assert.match(src, /state\.reveals = \[\]/);
  assert.match(src, /delete state\.salt/);
  assert.match(src, /state\.peek\.seat !== me/);
  assert.match(src, /'pegs_roll','pegs_pick','pegs_peek'\]\.includes\(msg\.type\)/);
  // a real room of the worker, asked to mask a state the way it masks every broadcast
  const env = environment(), health = await api(env, '/api/board/health');
  assert.ok(health.data.games.includes('pegs'));
  const fake = Object.create(Object.getPrototypeOf(env.BOARD_ROOMS.peek('pegs-mask').instance));
  const state = createPegsGame(['أ', 'ب'], { rng: seeded(4), now: Date.now() - 60_000, first: 0 });
  state.salt = 9; Object.assign(state, peekPegs(state, 0, 2)); state.seq = 1;
  fake.room = { game: 'pegs', order: ['a', 'b'], players: { a: { id: 'a' }, b: { id: 'b' } } };
  const forA = fake.maskGameState(state, 'a'), forB = fake.maskGameState(state, 'b');
  assert.equal(forA.pegs.filter((p) => p.c >= 0).length, 0);
  assert.equal(forA.peek.c, state.pegs[2].c);
  assert.equal(forB.peek.c, -1);
  assert.equal('salt' in forB, false);
});

test('the page: three ways to play, the die, the look, «عين الصقر», and it is on the home page and in the menus', async () => {
  const html = await read('public/pegs.html');
  for (const id of ['pegsMenu', 'gameMenu', 'pegsGame', 'pegsBoard', 'pegsDie', 'pegsPeek', 'pegsLook', 'pegsResult', 'players', 'status']) assert.match(html, new RegExp('id="' + id + '"'));
  for (const mode of ['online', 'ai', 'hotseat']) assert.match(html, new RegExp('data-mode="' + mode + '"'));
  assert.match(html, /assets\/js\/pegs\/main\.js/);
  assert.doesNotMatch(html, /بوت/);
  const main = await read('public/assets/js/pegs/main.js');
  assert.match(main, /createTable\(\{\s*game: 'pegs'/);
  assert.match(main, /'pegs_pick'/); assert.match(main, /'pegs_peek'/);
  assert.doesNotMatch(main, /بوت/);
  const home = await read('public/index.html');
  assert.match(home, /href="\/pegs" class="home-game"/);
  const menu = await read('public/assets/js/game-menu-v33.js');
  assert.match(menu, /\['pegs',5,5,'\/pegs'\]/);
  const profile = await read('public/assets/js/profile-core.js');
  assert.match(profile, /'tanks','pegs'\]/);
  for (const name of ['lift', 'right', 'wrong', 'place', 'streak', 'look', 'hide', 'peek', 'swap', 'tick']) await readFile(new URL('../public/assets/sounds/pegs-v33-10-1/' + name + '.wav', import.meta.url));
});
