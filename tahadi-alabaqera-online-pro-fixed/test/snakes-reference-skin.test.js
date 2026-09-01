import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();

test('reference arena keeps the supplied frame as the final visual layer', async () => {
  const html = await readFile(join(root, 'public', 'snakes.html'), 'utf8');
  const css = await readFile(join(root, 'public', 'assets', 'css', 'snake-reference-skin.css'), 'utf8');
  const image = await readFile(join(root, 'public', 'assets', 'snake-reference-skin.png'));

  assert.match(html, /assets\/css\/snake-reference-skin\.css/);
  assert.match(css, /#game\.reference-skin[\s\S]*background-image:\s*url\('\.\.\/snake-reference-skin\.png'\)/);
  assert.match(css, /\.snake-board-wrap[\s\S]*height:\s*58\.80%/);
  assert.match(css, /#game\.reference-skin #roll[\s\S]*color:\s*transparent/);
  assert.match(html, /function launchConfetti\(\)/);

  // PNG signature + IHDR dimensions (the uploaded frame is 709 × 1536).
  assert.deepEqual([...image.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(image.readUInt32BE(16), 709);
  assert.equal(image.readUInt32BE(20), 1536);
});

test('snakes page exposes resilient interaction handlers', async () => {
  const html = await readFile(join(root, 'public', 'snakes.html'), 'utf8');
  assert.match(html, /async function rollTurn\(\)/);
  assert.match(html, /finally\{[^}]*busy=false;render\(\)/s);
  assert.match(html, /document\.addEventListener\('keydown'/);
  assert.match(html, /classList\.add\('has-rolled'\)/);
});
