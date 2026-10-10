import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();

test('snake gameplay does not load the retired portrait skin or overlapping effect layers',async()=>{const html=await readFile(join(root,'public/snakes.html'),'utf8');assert.match(html,/pro-games\.css/);assert.match(html,/pro-dice\.js/);assert.doesNotMatch(html,/snake-reference-skin\.png|snake-pro-upgrade\.js|v5-ultimate-expansion\.js/);assert.match(html,/await runSoloAi\(\)/)});

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
