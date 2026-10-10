import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('snakes UI exposes the live arena, solo AI and saved-round resume',async()=>{const html=await readFile(new URL('../public/snakes.html',import.meta.url),'utf8');assert.match(html,/pro-arena/);assert.match(html,/تدريب فردي ضد الذكاء الاصطناعي/);assert.match(html,/runSoloAi/);assert.match(html,/busraj-snakes-resume-v6/);assert.doesNotMatch(html,/reference-skin/)});
