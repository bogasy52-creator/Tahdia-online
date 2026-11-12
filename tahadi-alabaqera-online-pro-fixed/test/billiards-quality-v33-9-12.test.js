import test from 'node:test';
import assert from 'node:assert/strict';
import { createPoolGame, cleanShot, playPoolShot, poolTimeout, simulate, POOL } from '../public/assets/js/engines/pool-engine.js';

const fixture = (patch = {}) => ({
  ...createPoolGame(['سعد', 'ماجد'], { rng: () => 0.4 }),
  balls: Array.from({ length: 16 }, (_, n) => n === 0 ? [60, 63.5] : n === 3 ? [120, 63.5] : null),
  phase: 'play', inHand: false, kitchen: false, ...patch,
});

test('non-finite spin is rejected before it can corrupt a table or saved replay', () => {
  for (const bad of [Infinity, -Infinity, NaN, 'Infinity', 'not-a-number']) {
    for (const spin of [[bad, 0.2], [0.2, bad]]) {
      const state = fixture();
      const before = structuredClone(state);
      assert.throws(() => playPoolShot(state, 0, { dir: [1, 0], power: 0.3, spin }), /invalid_shot/);
      assert.deepEqual(state, before);
    }
  }
});

test('large finite spin is normalized without overflow and its stored shot replays exactly', () => {
  const state = fixture();
  const input = { dir: [1, 0], power: 0.3, spin: [Number.MAX_VALUE, -Number.MAX_VALUE] };
  assert.deepEqual(cleanShot(state, input).spin, [0.71, -0.71]);
  const next = playPoolShot(state, 0, input);
  const saved = JSON.parse(JSON.stringify(next.shot));
  assert.deepEqual(simulate(saved.before, saved).balls, next.balls);
  for (const ball of next.balls.filter(Boolean)) assert.ok(ball.every(Number.isFinite));
});

test('a foul while potting the match-ending eight is included once in the match totals', () => {
  const balls = Array(16).fill(null);
  balls[0] = [POOL.L / 2, 50]; balls[8] = [POOL.L / 2, 30];
  const state = fixture({ balls, open: false, players: [{ name: 'سعد', group: 'solid' }, { name: 'ماجد', group: 'stripe' }] });
  const next = playPoolShot(state, 0, { dir: [0, -1], power: 0.7, spin: [0, 1] });
  assert.equal(next.phase, 'over');
  assert.equal(next.last.foul, 'scratch');
  assert.equal(next.winner, 1);
  assert.deepEqual(next.fouls, [1, 0]);
  assert.deepEqual(state.fouls, [0, 0]);
});

test('per-player shot totals count strikes, while timeouts count only as fouls', () => {
  const state = fixture();
  const first = playPoolShot(state, 0, { dir: [0, 1], power: 0.3 });
  assert.deepEqual(first.shotsBySeat, [1, 0]);
  assert.deepEqual(state.shotsBySeat, [0, 0]);
  const timed = poolTimeout(first);
  assert.deepEqual(timed.shotsBySeat, [1, 0]);
  assert.deepEqual(timed.fouls, [1, 1]);
  const next = playPoolShot(timed, 0, { cue: [50, 60], dir: [1, 0], power: 0.3 });
  assert.deepEqual(next.shotsBySeat, [2, 0]);
  assert.equal(next.shots, 2);
});

test('older room snapshots remain playable without inventing per-player history', () => {
  const old = fixture({ shots: 9 });
  delete old.shotsBySeat;
  const next = playPoolShot(old, 0, { dir: [1, 0], power: 0.3 });
  assert.equal(next.shots, 10);
  assert.equal(next.shotsBySeat, undefined);
});
