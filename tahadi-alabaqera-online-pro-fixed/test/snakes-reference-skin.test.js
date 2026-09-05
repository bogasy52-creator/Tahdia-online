import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();

test('snake board no longer overlays the mismatched static reference frame', async () => {
  const html = await readFile(join(root, 'public', 'snakes.html'), 'utf8');
  assert.doesNotMatch(html, /reference-skin/);
  assert.doesNotMatch(html, /snake-reference-skin\.css/);
  assert.match(html, /function launchConfetti\(\)/);
});

test('snakes page exposes resilient interaction handlers', async () => {
  const html = await readFile(join(root, 'public', 'snakes.html'), 'utf8');
  assert.match(html, /async function rollTurn\(\)/);
  assert.match(html, /finally\{[^}]*busy=false;render\(\)/s);
  assert.match(html, /document\.addEventListener\('keydown'/);
  assert.match(html, /classList\.add\('has-rolled'\)/);
});
