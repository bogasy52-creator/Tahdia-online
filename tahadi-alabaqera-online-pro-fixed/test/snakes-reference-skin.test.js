import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();

test('live arena replaces the portrait image with readable stateful cells',async()=>{const html=await readFile(join(root,'public/snakes.html'),'utf8'),css=await readFile(join(root,'public/assets/css/pro-games.css'),'utf8');assert.doesNotMatch(html,/reference-skin|snake-reference-skin\.png/);assert.match(html,/DEFAULT_SNAKES_JUMPS/);assert.match(html,/d\.dataset\.n\s*=\s*n/);assert.match(css,/grid-template-rows:repeat\(10,1fr\)/);assert.doesNotMatch(css,/#roll[^}]*color:transparent/)});

test('snakes page exposes resilient interaction handlers', async () => {
  const html = await readFile(join(root, 'public', 'snakes.html'), 'utf8');
  // 33.0.0: a roll is sent to the room; if the room does not answer, the page frees itself
  assert.match(html, /function rollTurn\(\)/);
  assert.match(html, /remoteTimeout = setTimeout\(\(\) => \{\s*busy = false;\s*render\(\);/);
  assert.match(html, /document\.addEventListener\(["']keydown["']/);
  assert.match(html, /classList\.add\(["']has-rolled["']\)/);
});
