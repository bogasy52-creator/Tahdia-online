import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('snakes UI exposes reference skin and solo AI mode', async()=>{
  const html=await readFile(new URL('../public/snakes.html',import.meta.url),'utf8');
  assert.match(html,/reference-skin/);
  assert.match(html,/تدريب فردي ضد الذكاء الاصطناعي/);
  assert.match(html,/runSoloAi/);
  assert.match(html,/snake-reference-skin\.png/);
});
