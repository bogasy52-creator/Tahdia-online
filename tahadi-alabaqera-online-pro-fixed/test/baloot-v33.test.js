import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { environment, api } from './worker-harness.mjs';
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
  assert.deepEqual(voiceLines('سرا و خمسين و مية'), ['sira', 'and', 'fifty', 'and', 'hundred']);
  assert.deepEqual(voiceLines('حكم شريا'), ['hokom_C']);
  assert.deepEqual(voiceLines('ثاني هاص'), ['thani_H']);
  assert.deepEqual(voiceLines('قهوة ☕'), ['gahwa'], 'emoji and vowel marks do not matter');
  assert.deepEqual(voiceLines('شي ما نعرفه'), [], 'nothing is said for an unknown line');
  // the table speaks these exact names
  assert.match(table, /const SUIT_SAY = \{ S: 'سبيت', H: 'هاص', D: 'ديمن', C: 'شريا' \}/);
  assert.match(table, /const PROJECT_NAME = \{ sira: 'سرا', fifty: 'خمسين', hundred: 'مية', fourHundred: 'أربعمية' \}/);
});

test('the voices are one recorded sound file, not the device speech', async () => {
  const voice = await read('public/assets/js/baloot-voice.js');
  assert.doesNotMatch(voice, /speechSynthesis|SpeechSynthesisUtterance/);
  assert.match(voice, /const SPRITE = '\/assets\/audio\/baloot-voice-v33\.mp3'/);
  const size = (await stat(new URL('../public/assets/audio/baloot-voice-v33.mp3', import.meta.url))).size;
  assert.ok(size > 100_000 && size < 600_000, 'one small file: ' + size);
  // every recording sits inside the file, one after the other
  const lines = JSON.parse(voice.match(/const LINES = Object\.freeze\((\{[\s\S]*?\})\);/)[1]);
  let end = 0;
  for (const [id, [start, length]] of Object.entries(lines).sort((a, b) => a[1][0] - b[1][0])) {
    assert.ok(start >= end && length > 0.1 && length < 2.5, id);
    end = start + length;
  }
  assert.ok(end < 50, 'the file is under a minute');
});

test('a tap plays a card the rules allow at once; a cut needs a second tap', async () => {
  const table = await read('public/assets/js/baloot-table.js');
  assert.match(table, /انتظر دورك/, 'a tap out of turn says so');
  assert.match(table, /ui\.queued = card/, 'a tap while the table moves is kept and played after');
  assert.match(table, /cuttable/, 'cuts are marked apart from the cards the rules allow');
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
