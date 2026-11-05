import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/assets/js/chaos-stage.js';

const { projection, podiumPlaces } = globalThis.BS_RACE_STAGE;

test('race camera keeps the lane order and shrinks distant obstacles and runners', () => {
  for (const [width, height] of [[360, 505], [844, 269], [1280, 690]]) {
    for (const camera of [0, 17.4, 91, 219]) {
      const point = projection(width, height, camera);
      const close = point(camera), far = point(camera + 24);
      assert.equal(close.x, width / 2);
      assert.ok(close.y > far.y && close.y < height);
      assert.ok(close.half > far.half && close.scale > far.scale);
      for (const row of [camera, camera + 11, camera + 24]) {
        const a = point(row, -2 / 3), b = point(row), c = point(row, 2 / 3);
        assert.ok(a.x > 0 && a.x < b.x && b.x < c.x && c.x < width);
        assert.equal(a.y, c.y);
      }
    }
  }
});

test('race podium reads final places and omits runners who never crossed the line', () => {
  const players = [0, 1, 2, 3, 4].map(slot => ({ slot, name: 'Player ' + slot }));
  const runners = [
    { place: 3, done: 84000 }, { place: 0, done: null },
    { place: 2, done: 81000 }, { place: 1, done: 70000 }, { place: 4, done: 85000 },
  ];
  const match = { players, race: { startAt: 5000, runners } };
  assert.deepEqual(podiumPlaces(match).map(p => [p.player.slot, p.place, p.seconds]), [[3, 1, 65], [2, 2, 76], [0, 3, 79]]);
  runners[0].done = null;
  runners[4].done = null;
  assert.deepEqual(podiumPlaces(match).map(p => p.place), [1, 2]);
});
