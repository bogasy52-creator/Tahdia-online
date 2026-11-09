// 33.9.0: billiards (8-ball pool) — the physics (exact contacts, the same result every time and on
// every engine), the rules (break, groups, fouls, the 8), the computer player, and the online table
// in BoardRoom with the computer filling the second seat.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { POOL, HEAD_X, FOOT, POCKETS, simulate, createPoolGame, playPoolShot, poolTimeout, choosePoolShot, cleanShot, canPlace, legalTargets, onEight, aimGuide, speedOf, powerFor, rackBalls, poolProgress } from '../public/assets/js/engines/pool-engine.js';
import { TABLE_GAMES, MAX_SEATS, QUICK_SEATS, POOL_BOT_SHOTS, seatsFor, startTable, playerMove, timeoutMove, tableOver, winnerSeats, seatProgress, stepsTime, seatIsBot } from '../src/games/board-tables.js';
import { ROOM_FAMILIES, gameOfCode } from '../src/rooms/room-codes.js';

const { L, W, R } = POOL;
const seeded = (seed = 7) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const empty = () => Array(16).fill(null);
function stateWith(balls, patch = {}) {
  const s = createPoolGame(['سعد', 'ماجد'], { rng: seeded(3), first: 0 });
  return { ...s, balls, phase: 'play', inHand: false, kitchen: false, ...patch };
}
// a straight shot that pots ball `n` at (ox, oy) into pocket aim point (ax, ay)
function straight(o, aim, back = 40) {
  let ux = aim[0] - o[0], uy = aim[1] - o[1]; const l = Math.hypot(ux, uy); ux /= l; uy /= l;
  return { cue: [o[0] - ux * back, o[1] - uy * back], dir: [ux, uy] };
}

test('the rack: 15 balls in a triangle at the foot spot, the 8 in the middle, a solid and a stripe in the back corners', () => {
  for (let k = 1; k < 20; k++) {
    const b = rackBalls(seeded(k));
    assert.equal(b.filter(Boolean).length, 16);
    assert.deepEqual(b[0], [HEAD_X - 10, W / 2]);
    const apex = b.slice(1).reduce((best, p) => (p[0] < best[0] ? p : best));
    assert.ok(Math.abs(apex[0] - FOOT[0]) < 1e-9 && Math.abs(apex[1] - FOOT[1]) < 1e-9);
    const back = [...Array(16).keys()].slice(1).filter((n) => b[n][0] > FOOT[0] + 19 && Math.abs(Math.abs(b[n][1] - W / 2) - 2 * (2 * R + 0.02)) < 1e-6);
    assert.equal(back.length, 2);
    assert.notEqual(back[0] < 8, back[1] < 8, 'one solid and one stripe in the back corners');
    const eightRow = [...Array(16).keys()].slice(1).filter((n) => Math.abs(b[n][0] - b[8][0]) < 1e-6);
    assert.equal(eightRow.length, 3);
    assert.ok(Math.abs(b[8][1] - W / 2) < 1e-9);
    // no two balls overlap
    for (let i = 0; i < 16; i++) for (let j = i + 1; j < 16; j++) assert.ok(Math.hypot(b[i][0] - b[j][0], b[i][1] - b[j][1]) >= 2 * R);
  }
});

test('the same shot gives the same table every time, and the stored shot replays to the stored result', () => {
  const g = createPoolGame(['a', 'b'], { rng: seeded(11) });
  const next = playPoolShot(g, g.turn, { cue: [HEAD_X - 12, W / 2 + 4], dir: [1, -0.012], power: 1, spin: [0.2, -0.3] });
  const roundTrip = JSON.parse(JSON.stringify(next.shot));
  const replay = simulate(roundTrip.before, roundTrip, { record: true });
  assert.deepEqual(replay.balls, next.balls);
  assert.deepEqual(simulate(roundTrip.before, roundTrip).balls, replay.balls);
  assert.ok(replay.frames.length > 60 && replay.frames.length < 60 * POOL.MAX_TIME);
  assert.ok(replay.events.some((e) => e.type === 'ball'));
  // the break spreads the rack
  const spread = next.balls.slice(1).filter(Boolean).reduce((sum, b) => sum + Math.hypot(b[0] - FOOT[0], b[1] - FOOT[1]), 0) / next.balls.slice(1).filter(Boolean).length;
  assert.ok(spread > 35, 'a full break spreads the balls (' + spread.toFixed(1) + ' cm)');
});

test('the physics: a straight shot pots, the cue ball draws back and follows on, no ball passes through another', () => {
  const o = [200, 30], aim = [L - 2.2, 2.2], { cue, dir } = straight(o, aim);
  const balls = empty(); balls[0] = cue; balls[3] = o;
  const pot = simulate(balls, { dir, speed: speedOf(0.4), spin: [0, 0] });
  assert.deepEqual(pot.potted, [3]);
  assert.equal(pot.first, 3);
  // draw comes back towards the start, follow goes on past the contact point
  const b2 = empty(); b2[0] = [60, 63.5]; b2[5] = [110, 63.5];
  const stun = simulate(b2, { dir: [1, 0], speed: speedOf(0.35), spin: [0, 0] }).balls[0][0];
  const draw = simulate(b2, { dir: [1, 0], speed: speedOf(0.35), spin: [0, -0.9] }).balls[0][0];
  const follow = simulate(b2, { dir: [1, 0], speed: speedOf(0.35), spin: [0, 0.9] }).balls[0][0];
  assert.ok(draw < stun - 15, `draw ${draw} < stun ${stun}`);
  assert.ok(follow > stun + 15, `follow ${follow} > stun ${stun}`);
  // a very fast ball still meets a thin target
  const b3 = empty(); b3[0] = [20, 63.5]; b3[9] = [230, 63.5 + 2 * R - 0.3];
  const fast = simulate(b3, { dir: [1, 0], speed: POOL.MAX_SPEED, spin: [0, 0] });
  assert.equal(fast.first, 9);
  // every ball ends on the cloth (or in a pocket)
  for (const p of fast.balls) if (p) assert.ok(p[0] >= R - 1e-6 && p[0] <= L - R + 1e-6 && p[1] >= R - 1e-6 && p[1] <= W - R + 1e-6);
});

test('the guide line agrees with the shot: the first ball, the ghost ball and the object ball\'s path', () => {
  const o = [180, 80], aim = [L - 2.2, W - 2.2], { cue, dir } = straight(o, aim, 60);
  const balls = empty(); balls[0] = cue; balls[12] = o;
  const g = aimGuide(balls, cue, dir);
  assert.equal(g.kind, 'ball'); assert.equal(g.n, 12);
  assert.ok(Math.hypot(g.ghost[0] - (o[0] - dir[0] * 2 * R), g.ghost[1] - (o[1] - dir[1] * 2 * R)) < 1e-6);
  assert.ok(Math.abs(g.cut - 1) < 1e-9);
  assert.ok(Math.hypot(g.objectDir[0] - dir[0], g.objectDir[1] - dir[1]) < 1e-9);
  const rail = aimGuide(empty().map((v, n) => (n === 0 ? [100, 60] : null)), [100, 60], [0, -1]);
  assert.equal(rail.kind, 'rail'); assert.ok(Math.abs(rail.at[1] - R) < 1e-9); assert.deepEqual(rail.bounce, [0, 1]);
});

test('the break: from behind the head string; balls potted keep the turn and the table stays open; the 8 on the break comes back', () => {
  const g = createPoolGame(['a', 'b'], { rng: seeded(5), first: 1 });
  assert.equal(g.turn, 1); assert.equal(g.phase, 'break'); assert.ok(g.inHand && g.kitchen);
  assert.deepEqual(legalTargets(g).length, 15);
  assert.throws(() => cleanShot(g, { cue: [HEAD_X + 5, W / 2], dir: [1, 0], power: 1 }), /bad_place/);
  assert.throws(() => cleanShot(g, { cue: [HEAD_X - 10, W / 2], dir: [0, 0], power: 1 }), /invalid_shot/);
  assert.throws(() => cleanShot(g, { cue: [HEAD_X - 10, W / 2], dir: [1, 0], power: 2 }), /invalid_shot/);
  assert.throws(() => playPoolShot(g, 0, { cue: [HEAD_X - 10, W / 2], dir: [1, 0], power: 1 }), /wrong_turn/);
  // pockets and other balls are no place for the cue ball
  assert.equal(canPlace(g, 3, 3, false), false);
  assert.equal(canPlace(g, FOOT[0], FOOT[1], false), false);
  assert.equal(canPlace(g, 40, 40), true);
  // the 8 dropped on the break is spotted again, and the breaker shoots on
  const s = stateWith(empty(), { phase: 'break', inHand: true, kitchen: true });
  s.balls[8] = [L - 30, 12]; s.balls[2] = [150, 100];
  const { cue, dir } = straight(s.balls[8], [L - 2.2, 2.2], 60);
  s.balls[0] = null;
  const shotCue = [Math.min(cue[0], HEAD_X - 1), cue[1]];
  const d = [s.balls[8][0] - shotCue[0], s.balls[8][1] - shotCue[1]], dl = Math.hypot(...d);
  const after = playPoolShot({ ...s, balls: [shotCue, ...s.balls.slice(1)] }, 0, { cue: shotCue, dir: [d[0] / dl, d[1] / dl], power: 0.75 });
  if (after.last.potted.includes(8)) {
    assert.equal(after.last.spotted, true);
    assert.ok(after.balls[8]);
    assert.equal(after.winner, null);
  }
  void dir;
});

test('groups come with the first ball potted after the break, and a ball of yours keeps your turn', () => {
  const o = [200, 30], { cue, dir } = straight(o, [L - 2.2, 2.2]);
  const balls = empty(); balls[0] = cue; balls[11] = o; balls[2] = [80, 100]; balls[8] = [120, 90];
  const s = stateWith(balls);
  const after = playPoolShot(s, 0, { dir, power: 0.4 });
  assert.deepEqual(after.last.potted, [11]);
  assert.equal(after.last.group, 'stripe');
  assert.deepEqual(after.players.map((p) => p.group), ['stripe', 'solid']);
  assert.equal(after.turn, 0); assert.equal(after.last.result, 'again');
  assert.equal(after.open, false);
  assert.deepEqual(legalTargets(after, 0), [8]); // no stripes left: the 8 is next
  assert.equal(onEight(after, 0), true);
  assert.deepEqual(legalTargets(after, 1), [2]);
});

test('fouls: the cue ball in a pocket, no ball touched, the wrong ball first, no cushion — the other player gets the cue ball anywhere', () => {
  // scratch: a full-ball shot straight into a pocket line with the cue ball following
  const balls = empty(); balls[0] = [L / 2, 40]; balls[1] = [L / 2, 20];
  const s = stateWith(balls);
  const scratch = playPoolShot(s, 0, { dir: [0, -1], power: 0.6, spin: [0, 0.95] });
  assert.ok(scratch.last.potted.includes(1) || scratch.last.foul);
  if (scratch.last.foul === 'scratch') { assert.equal(scratch.turn, 1); assert.equal(scratch.inHand, true); assert.equal(scratch.kitchen, false); assert.equal(scratch.balls[0], null); }
  // no ball touched
  const b2 = empty(); b2[0] = [60, 60]; b2[9] = [200, 20];
  const miss = playPoolShot(stateWith(b2), 0, { dir: [0, 1], power: 0.3 });
  assert.equal(miss.last.foul, 'no_hit'); assert.equal(miss.turn, 1); assert.equal(miss.inHand, true);
  // the wrong ball first
  const b3 = empty(); b3[0] = [60, 63.5]; b3[10] = [120, 63.5]; b3[3] = [200, 20];
  const groups = stateWith(b3, { open: false, players: [{ name: 'a', group: 'solid' }, { name: 'b', group: 'stripe' }] });
  const wrong = playPoolShot(groups, 0, { dir: [1, 0], power: 0.3 });
  assert.equal(wrong.last.foul, 'wrong_first');
  // the 8 first while still on your group
  const b4 = empty(); b4[0] = [60, 63.5]; b4[8] = [120, 63.5]; b4[3] = [200, 20];
  assert.equal(playPoolShot(stateWith(b4, { open: false, players: [{ name: 'a', group: 'solid' }, { name: 'b', group: 'stripe' }] }), 0, { dir: [1, 0], power: 0.3 }).last.foul, 'eight_first');
  // a soft touch that leaves every ball short of the cushions
  const b5 = empty(); b5[0] = [100, 63.5]; b5[4] = [100 + 2 * R + 1, 63.5]; b5[9] = [200, 20];
  const soft = playPoolShot(stateWith(b5, { open: false, players: [{ name: 'a', group: 'solid' }, { name: 'b', group: 'stripe' }] }), 0, { dir: [1, 0], power: 0.03 });
  assert.equal(soft.last.foul, 'no_rail'); assert.equal(soft.fouls[0], 1);
  // the time runs out
  const late = poolTimeout(stateWith(b5));
  assert.equal(late.last.foul, 'time'); assert.equal(late.turn, 1); assert.equal(late.inHand, true);
  const lateBreak = poolTimeout(createPoolGame(['a', 'b'], { rng: seeded(2), first: 0 }));
  assert.equal(lateBreak.turn, 1); assert.equal(lateBreak.kitchen, true); assert.equal(lateBreak.phase, 'break');
});

test('the 8: potted after your group wins; potted early or with a foul loses', () => {
  const o = [200, 30], { cue, dir } = straight(o, [L - 2.2, 2.2]);
  const on = empty(); on[0] = cue; on[8] = o; on[12] = [60, 110];
  const groups = { open: false, players: [{ name: 'a', group: 'solid' }, { name: 'b', group: 'stripe' }] };
  const win = playPoolShot(stateWith(on, groups), 0, { dir, power: 0.4 });
  assert.equal(win.winner, 0); assert.equal(win.last.result, 'win'); assert.equal(win.phase, 'over');
  assert.equal(poolProgress(win, 0), 8);
  const early = on.slice(); early[5] = [60, 20];
  const lose = playPoolShot(stateWith(early, groups), 0, { dir, power: 0.4 });
  assert.equal(lose.winner, 1); assert.equal(lose.last.result, 'loss');
  // the 8 and the cue ball both down: a loss
  const both = empty(); both[0] = [L / 2, 50]; both[8] = [L / 2, 30];
  const r = playPoolShot(stateWith(both, groups), 0, { dir: [0, -1], power: 0.7, spin: [0, 1] });
  if (r.last.potted.includes(8)) assert.equal(r.winner, r.last.foul ? 1 : 0);
  assert.throws(() => playPoolShot(win, 1, { dir: [1, 0], power: 0.5 }), /match_over/);
});

test('the computer plays whole matches at every level, the strong one wins more, and decides fast', () => {
  const rng = seeded(21);
  const tally = { hard: 0, easy: 0 };
  let shots = 0, slowest = 0;
  for (let game = 0; game < 6; game++) {
    let s = createPoolGame(['hard', 'easy'], { rng, first: game % 2 });
    for (let k = 0; k < 220 && s.winner === null; k++) {
      const t0 = performance.now();
      const shot = choosePoolShot(s, s.turn === 0 ? 'hard' : 'easy', rng);
      slowest = Math.max(slowest, performance.now() - t0);
      s = playPoolShot(s, s.turn, shot); shots++;
    }
    assert.notEqual(s.winner, null, 'every match ends');
    tally[s.winner === 0 ? 'hard' : 'easy']++;
  }
  assert.ok(tally.hard >= 4, JSON.stringify(tally));
  assert.ok(shots / 6 < 80);
  assert.ok(slowest < 400, 'slowest decision ' + slowest.toFixed(1) + ' ms');
  // with the cue ball in hand it places it legally
  const s = createPoolGame(['a', 'b'], { rng: seeded(4) });
  const brk = choosePoolShot(s, 'medium', seeded(4));
  assert.ok(canPlace(s, brk.cue[0], brk.cue[1], true));
  const after = poolTimeout(playPoolShot(s, s.turn, brk));
  const placed = choosePoolShot(after, 'hard', seeded(9));
  assert.ok(placed.cue && canPlace(after, placed.cue[0], placed.cue[1], false));
});

test('power maps to speed and back', () => {
  for (const p of [0.05, 0.2, 0.5, 0.8, 1]) assert.ok(Math.abs(powerFor(speedOf(p)) - p) < 1e-9);
  assert.equal(speedOf(1), POOL.MAX_SPEED);
  assert.ok(speedOf(0.1) < 80);
  assert.equal(POCKETS.length, 6);
});

test('online: billiards is a board table of two; a quick table fills the second seat with a computer player', () => {
  assert.ok(TABLE_GAMES.includes('billiards'));
  assert.equal(MAX_SEATS.billiards, 2); assert.equal(QUICK_SEATS.billiards, 2);
  assert.equal(seatsFor('billiards', 1, true), 2); assert.equal(seatsFor('billiards', 2, false), 2);
  assert.deepEqual(ROOM_FAMILIES.billiards, { from: 99, to: 99, page: '/billiards' });
  assert.equal(gameOfCode('991234'), 'billiards');
  const rng = seeded(31);
  const room = { game: 'billiards', players: { a: { id: 'a', name: 'سعد', role: 'host', connected: true } }, order: ['a'], status: 'lobby', version: 0, variant: 'classic' };
  let steps = startTable(room, { quick: true, rng });
  assert.equal(room.order.length, 2);
  assert.equal(room.state.game, 'pool');
  const me = room.order.indexOf('a');
  // the computer never takes more than a few shots in one go; the alarm plays the rest
  for (let k = 0; k < 400 && !tableOver(room); k++) {
    const seat = room.state.turn;
    if (seatIsBot(room, seat)) { steps = timeoutMove(room, rng); }
    else {
      assert.equal(seat, me);
      if (k % 7 === 3) steps = timeoutMove(room, rng); // a person out of time: a foul
      else steps = playerMove(room, seat, { type: 'pool_shot', ...choosePoolShot(room.state, 'medium', rng) }, rng);
    }
    const shots = steps.list.filter((step) => step.state.shot).length;
    assert.ok(shots <= POOL_BOT_SHOTS + 1, 'shots in one go: ' + shots);
    assert.ok(stepsTime(room, steps) >= steps.list.reduce((t, step) => t + (step.state.last?.ms || 0), 0));
  }
  assert.ok(tableOver(room));
  assert.deepEqual(winnerSeats(room), [room.state.winner]);
  assert.ok(seatProgress(room, room.state.winner) === 8);
  assert.throws(() => playerMove({ ...room, status: 'playing', state: { ...room.state, winner: null }, game: 'billiards' }, room.state.turn, { type: 'roll' }, rng), /invalid_action/);
});

test('the page, the room code family and the home page know billiards', async () => {
  const [html, menu, home, presence, social, profile] = await Promise.all(['public/billiards.html', 'public/assets/js/game-menu-v33.js', 'public/index.html', 'src/presence/presence-registry.js', 'src/social/social-core.js', 'public/assets/js/profile-core.js'].map((f) => readFile(new URL('../' + f, import.meta.url), 'utf8')));
  assert.match(html, /<title>بلياردو — بوسراج<\/title>/);
  assert.match(html, /assets\/js\/billiards\/main\.js\?v=/);
  assert.match(html, /id="gameMenu"/);
  assert.doesNotMatch(html, /بوت/);
  assert.match(menu, /\['billiards',99,99,'\/billiards'\]/);
  assert.match(menu, /billiards:'بلياردو'/);
  assert.match(home, /href="\/billiards" class="home-game"/);
  assert.match(home, /class="home-feature" href="\/billiards"/);
  assert.match(presence, /billiards: \{ key: 'billiards', label: 'بلياردو' \}/);
  assert.match(social, /"hockey", "billiards"\]/);
  assert.match(profile, /'hockey','billiards'\]/);
  const main = await readFile(new URL('../public/assets/js/billiards/main.js', import.meta.url), 'utf8');
  assert.doesNotMatch(main, /بوت/);
  assert.match(main, /pool_aim/);
  assert.match(main, /createTable\(/);
});
