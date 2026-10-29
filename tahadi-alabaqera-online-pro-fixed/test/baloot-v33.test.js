import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { environment, api } from './worker-harness.mjs';
import {VOICE_RECORDINGS} from '../public/assets/js/baloot-voice-clips-v33.js';
import { voiceLines } from '../public/assets/js/baloot-voice.js';
import { BALOOT_PHRASES } from '../public/assets/js/engines/baloot-talk.js';

// 33.0.0: the Baloot table speaks with recorded Gulf voices (one sound file), and
// «العب الحين» keeps open and strict tables apart.
const read = (file) => readFile(new URL('../' + file, import.meta.url), 'utf8');

test('every call, project, claim and phrase the table says has its recording', async () => {
  const table = await read('public/assets/js/baloot-table.js');
  // what the table says, as it writes it
  const said = ['بَسْ', 'صن', 'أشكل', 'دبل', 'دبل مقفول', 'ثري', 'فور', 'فور مقفول', 'قهوة', 'بلوت', 'سجّل', 'صح، قطع', 'غلط', 'كبوت', 'هلا والله'];
  for (const suit of ['سبيت', 'هاص', 'ديمن', 'شريا']) said.push('حكم ' + suit, 'ثاني ' + suit);
  for (const text of said) assert.ok(voiceLines(text).length > 0, text);
  for (const phrase of BALOOT_PHRASES) assert.deepEqual(voiceLines(phrase.id), [phrase.id], phrase.id);
  // projects come joined, with «و» between them
  assert.deepEqual(voiceLines('سرا و خمسين'), ['projects_sira_fifty']);
  assert.deepEqual(voiceLines('حكم شريا'), ['hokom_C']);
  assert.deepEqual(voiceLines('ثاني هاص'), ['thani_H']);
  assert.deepEqual(voiceLines('قهوة ☕'), ['gahwa'], 'emoji and vowel marks do not matter');
  assert.deepEqual(voiceLines('شي ما نعرفه'), [], 'nothing is said for an unknown line');
  // the table speaks these exact names
  assert.match(table, /const SUIT_SAY = \{ S: 'سبيت', H: 'هاص', D: 'ديمن', C: 'شريا' \}/);
  assert.match(table, /const PROJECT_NAME = \{ sira: 'سرا', fifty: 'خمسين', hundred: 'مية', fourHundred: 'أربعمية' \}/);
});

test('archived Gulf calls remain intact and the new player starts complete recordings',async()=>{
 const voice=await read('public/assets/js/baloot-voice.js'),player=await read('public/assets/js/baloot-voice-player.js');assert.doesNotMatch(voice+player,/speechSynthesis|SpeechSynthesisUtterance|source\.start\(at|playbackRate/);assert.match(player,/source\.start\(\)/);assert.doesNotMatch(voice,/baloot-gulf-v33|ar-KW-FahedNeural/);
 assert.ok(Object.keys(VOICE_RECORDINGS).length>=50);for(const [id,clip]of Object.entries(VOICE_RECORDINGS)){const size=(await stat(new URL('../public'+clip.src,import.meta.url))).size;assert.ok(size>1000,id);assert.ok(clip.seconds>.3&&clip.seconds<9,id);assert.ok(clip.text.length>2);}
});

test('open play permits a chosen cut without highlighting, warning or an extra tap',async()=>{
 const table=await read('public/assets/js/baloot-table.js');const tap=table.slice(table.indexOf('function onCardTap'),table.indexOf('/* ---------- Centre'));
 assert.match(tap,/ui\.queued\s*=\s*card/);assert.match(tap,/playHumanCard\(card\)/);assert.doesNotMatch(tap,/ruleSet|cut-note|اضغطها مرة ثانية/);assert.match(table,/!view\.open&&legal/);
});

test('«العب الحين» keeps open and strict tables apart', async () => {
  const env = environment();
  const open = await api(env, '/api/baloot/quick', { name: 'سعد', open: true });
  const strict = await api(env, '/api/baloot/quick', { name: 'ماجد', open: false });
  assert.equal(open.response.status, 200);
  assert.equal(strict.response.status, 200);
  assert.notEqual(open.data.code, strict.data.code, 'two kinds, two tables');
  const tableOf = (code) => env.BOARD_ROOMS.peek(code).instance.room;
  assert.equal(tableOf(open.data.code).open, true);
  assert.equal(tableOf(strict.data.code).open, false);
  // the next open player sits at the open table
  const again = await api(env, '/api/baloot/quick', { name: 'ريم', open: true });
  assert.equal(again.data.code, open.data.code);
});
