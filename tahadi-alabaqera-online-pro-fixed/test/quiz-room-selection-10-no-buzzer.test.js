import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (rel) => readFile(new URL(rel, root), 'utf8');

test('quiz private rooms expose and accept a 10-player free-for-all option', async () => {
  const [html, worker] = await Promise.all([read('public/online.html'), read('src/index.js')]);
  assert.match(html, /<option value="10">منافسة فردية \(10\)<\/option>/);
  assert.match(worker, /\[2,4,5,6,7,8,10\]\.includes\(Number\(body\.playerLimit\)\)/);
});

test('starting a quiz room atomically uses the categories currently selected by the host', async () => {
  const [html, worker] = await Promise.all([read('public/online.html'), read('src/index.js')]);
  assert.match(html, /\$\('#startBtn'\)\.onclick=\(\)=>\{[\s\S]{0,260}send\('start',\{categories:\[\.\.\.hostSel\]\}\)[\s\S]{0,100}\}/);
  assert.match(worker, /case "start":[\s\S]{0,900}msg\.categories[\s\S]{0,900}this\.room\.selectedCategories = ids[\s\S]{0,900}startMatch\(\)/);
});

test('quiz room gameplay no longer exposes or generates buzzer rounds', async () => {
  const [html, worker] = await Promise.all([read('public/online.html'), read('src/index.js')]);
  assert.doesNotMatch(html, /اضغط البازر|مواجهة بازر|send\('buzz'\)|className='buzzer'/);
  assert.doesNotMatch(worker, /case "buzz"|handleBuzz\(|finalizeBuzzer\(|mode === "buzzer"|phase === "buzzer/);
  assert.match(worker, /return order\.map\(\(x\) => \(\{ \.\.\.x, mode: "secret" \}\)\);/);
});
