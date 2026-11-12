import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../public/assets/js/carrom/engine.js';
const { createCarrom, placeStriker, chooseCarromShot, playCarromShot, createCarromDuel, replayCarromShot, stepCarrom, FIXED_DT } = engine;
import { createCarromRenderer } from '../public/assets/js/carrom/render.js';

test('the selected easy level reaches the computer planner instead of becoming normal', () => {
  const easy = chooseCarromShot(createCarrom({ difficulty: 'easy', seed: 27 }));
  const expected = chooseCarromShot(createCarrom({ seed: 27 }), 'easy');
  const normal = chooseCarromShot(createCarrom({ difficulty: 'normal', seed: 27 }));
  assert.deepEqual(easy, expected);
  assert.ok(Math.abs(easy.angle - normal.angle) > 0.001);
});

test('non-finite striker placement cannot reset or displace a prepared shot', () => {
  const s = createCarrom();
  placeStriker(s, 360);
  for (const x of [NaN, Infinity, -Infinity, undefined, null, '', 'not a number']) {
    const before = structuredClone(s);
    assert.equal(placeStriker(s, x), false, String(x));
    assert.deepEqual(s, before);
  }
});

test('a hidden or collapsed board cannot produce an infinite pointer coordinate', () => {
  const canvas = { getContext: () => ({}), getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }) };
  const renderer = createCarromRenderer(canvas);
  assert.equal(renderer.point(25, 50), null);
});

test('opponent aim rejects malformed coordinates, seats and charge before it reaches the canvas', () => {
  assert.equal(typeof engine.readCarromAim, 'function');
  const { readCarromAim } = engine;
  const valid = { seat: 1, x: 480, angle: 1.25, power: 0.68 };
  assert.deepEqual(readCarromAim(valid), valid);
  for (const patch of [{ x: 100 }, { x: Infinity }, { angle: NaN }, { angle: undefined }, { power: -1 }, { power: 2 }, { power: '0.5' }, { seat: 2 }, { seat: '1' }]) {
    assert.equal(readCarromAim({ ...valid, ...patch }), null);
  }
  assert.equal(readCarromAim(null), null);
});

test('display transforms preserve both seats without changing authoritative shot replay', () => {
  const canvas = { getContext: () => ({}), getBoundingClientRect: () => ({ left: 100, top: 20, width: 500, height: 500 }) };
  const renderer = createCarromRenderer(canvas);
  assert.deepEqual(renderer.point(210, 432.5), { x: 220, y: 825 });
  assert.deepEqual(renderer.point(210, 432.5, 1), { x: 780, y: 175 });
  const start = createCarromDuel(['أ', 'ب'], { rng: () => 0.25, first: 1 });
  const before = structuredClone(start);
  const result = playCarromShot(start, 1, { x: 420, angle: 1.3, power: 0.65 });
  assert.deepEqual(start, before);
  const replay = replayCarromShot(result.shotRec);
  for (let n = 0; replay.phase === 'moving' && n < 2000; n++) stepCarrom(replay, FIXED_DT);
  assert.equal(replay.phase, result.phase);
  assert.equal(replay.turn, result.turn);
  assert.deepEqual(replay.coins, result.coins);
  assert.deepEqual(replay.striker, result.striker);
});
