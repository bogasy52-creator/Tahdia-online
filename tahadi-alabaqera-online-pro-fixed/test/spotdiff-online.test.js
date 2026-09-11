import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpotDiffGame, playSpotDiffClick, finishSpotDiffGame } from '../public/assets/js/engines/spotdiff-scenes.js';
import { readFile } from 'node:fs/promises';

test('online spot-the-difference creates a server-owned two-player round', () => {
  const state = createSpotDiffGame(2, 'easy');
  assert.equal(state.difficulty, 'easy');
  assert.equal(state.diffs.length, 4);
  assert.deepEqual(state.scores, [0, 0]);
  assert.deepEqual(state.misses, [0, 0]);
  assert.equal(state.winner, null);
  assert.match(state.photo, /^assets\/spot_difference_photos\//);
});

test('online spot-the-difference validates clicks and never accepts forged points', () => {
  const initial = createSpotDiffGame(2, 'easy');
  const target = initial.diffs[0];
  const hit = playSpotDiffClick(initial, 1, target.x, target.y);
  assert.equal(hit.diffs[0].foundBy, 1);
  assert.deepEqual(hit.scores, [0, 1]);
  const duplicate = playSpotDiffClick(hit, 0, target.x, target.y);
  assert.deepEqual(duplicate.scores, [0, 1]);
  assert.equal(duplicate.misses[0], 1);
  assert.throws(() => playSpotDiffClick(initial, 4, target.x, target.y), /invalid_player/);
  assert.throws(() => playSpotDiffClick(initial, 0, Infinity, 5), /invalid_coordinates/);
});

test('spot-the-difference resolves winner on completion or server timeout', () => {
  let state = createSpotDiffGame(2, 'easy');
  for (const target of state.diffs) state = playSpotDiffClick(state, 0, target.x, target.y);
  assert.equal(state.winner, 0);
  const timeout = finishSpotDiffGame({ ...createSpotDiffGame(2, 'easy'), scores: [2, 2] });
  assert.equal(timeout.winner, -1);
});

test('five incorrect online attempts end the round for that player', () => {
  let state = createSpotDiffGame(2, 'easy');
  for (let index = 0; index < 5; index += 1) state = playSpotDiffClick(state, 0, 0, 0);
  assert.equal(state.misses[0], 5);
  assert.equal(state.winner, 1);
});

test('worker routes and handles the online spot-the-difference game', async () => {
  const worker = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');
  assert.match(worker, /createSpotDiffGame/);
  assert.match(worker, /playSpotDiffClick/);
  assert.match(worker, /spotdiff_click/);
  assert.match(worker, /['"]spotdiff['"]/);
  assert.match(worker, /SPOTDIFF_CLICK_COOLDOWN_MS/);
  assert.match(worker, /Date\.now\(\)\s*>=\s*this\.room\.turnDeadline/);
  assert.match(worker, /lastSpotClickAt/);
});
