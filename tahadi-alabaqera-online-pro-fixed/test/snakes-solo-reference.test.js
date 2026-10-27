import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// 33.0.0: no solo or same-device play any more: alone, you play bots on the server, and
// «ارجع لمباراتك» takes you back to the room you were in
test('snakes UI exposes the live arena, server bots and the way back to your match',async()=>{const html=await readFile(new URL('../public/snakes.html',import.meta.url),'utf8');assert.match(html,/pro-arena/);assert.doesNotMatch(html,/تدريب فردي ضد الذكاء الاصطناعي|runSoloAi|busraj-snakes-resume-v6/);assert.match(html,/botTag\(/);const table=await readFile(new URL('../public/assets/js/board-table-v33.js',import.meta.url),'utf8');assert.match(table,/BS_GAME_MENU\?\.remember\(game,next\.code/);assert.match(table,/onResume:async\(\{code\}\)=>/);assert.doesNotMatch(html,/reference-skin/)});
