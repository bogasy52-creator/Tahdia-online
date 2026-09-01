import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();

test('reference arena uses the supplied portrait frame as the final skin', async () => {
  const html = await readFile(join(root, 'public', 'snakes.html'), 'utf8');
  const css = await readFile(join(root, 'public', 'assets', 'css', 'snake-reference-skin.css'), 'utf8');
  assert.match(html, /assets\/css\/snake-reference-skin\.css/);
  assert.match(css, /background-image:\s*url\('\.\.\/snake-reference-skin\.png'\)/);
  assert.match(css, /grid-template-rows:\s*8\.98%\s+9\.31%/);
  assert.match(css, /#game\.reference-skin\.has-rolled \.die/);
  assert.match(html, /function launchConfetti\(\)/);
});

test('reference frame is a valid 709 x 1536 PNG for Cloudflare assets', async () => {
  const bytes = await readFile(join(root, 'public', 'assets', 'snake-reference-skin.png'));
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(bytes.readUInt32BE(16), 709);
  assert.equal(bytes.readUInt32BE(20), 1536);
});

test('snake turn has a keyboard-safe action path and no stale overlay badge', async () => {
  const html = await readFile(join(root, 'public', 'snakes.html'), 'utf8');
  assert.match(html, /function rollTurn\(\)/);
  assert.match(html, /document\.addEventListener\('keydown'/);
  assert.match(html, /classList\.add\('has-rolled'\)/);
  assert.match(html, /console\.error\('Snake turn failed'/);
});
