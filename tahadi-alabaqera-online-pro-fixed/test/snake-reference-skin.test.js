import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();

test('snake board renders the live interactive arena, not the mismatched static skin', async () => {
  const html = await readFile(join(root, 'public', 'snakes.html'), 'utf8');
  assert.doesNotMatch(html, /reference-skin/);
  assert.doesNotMatch(html, /snake-reference-skin\.css/);
  assert.match(html, /function launchConfetti\(\)/);
  assert.match(html, /function drawPaths\(\)/);
});

test('snake turn has a keyboard-safe action path and no stale overlay badge', async () => {
  const html = await readFile(join(root, 'public', 'snakes.html'), 'utf8');
  assert.match(html, /function rollTurn\(\)/);
  assert.match(html, /document\.addEventListener\('keydown'/);
  assert.match(html, /classList\.add\('has-rolled'\)/);
  assert.match(html, /console\.error\('Snake turn failed'/);
});
