import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('snakes UI exposes solo AI mode on the live interactive board', async()=>{
  const html=await readFile(new URL('../public/snakes.html',import.meta.url),'utf8');
  assert.doesNotMatch(html,/reference-skin/);
  assert.match(html,/تدريب فردي ضد الذكاء الاصطناعي/);
  assert.match(html,/runSoloAi/);
});
