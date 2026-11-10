// 33.9.6: carrom and billiards look new and play with easier hands: the striker slides under the
// finger, a tap on a coin or ball aims for you, a fine-aim strip, a power bar pulled down and let go,
// and a magnifier while aiming at the pool table.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const read = (file) => readFile(new URL('../' + file, import.meta.url), 'utf8');

test('carrom: the new board and coins, and the new cover on the page and the home page', async () => {
  const render = await read('public/assets/js/carrom/render.js');
  assert.match(render, /function grainLayer/); assert.match(render, /function noise2/);
  assert.match(render, /turned grooves/);
  assert.ok((await stat(new URL('../public/assets/brand/carrom-cover-v33-9-6.webp', import.meta.url))).size > 20000);
  for (const page of ['public/race.html', 'public/index.html']) { const html = await read(page); assert.match(html, /carrom-cover-v33-9-6\.webp/, page); assert.doesNotMatch(html, /carrom-cover-v33-7\.svg/, page); }
});

test('carrom: the striker rail and the slingshot replaced the fine strip and the pull-down bar (33.9.10)', async () => {
  const [html, main] = await Promise.all(['public/race.html', 'public/assets/js/carrom/main.js'].map(read));
  assert.match(html, /id="cmSlider"/); assert.doesNotMatch(html, /id="cmFine"|id="cmPower"/);
  assert.match(main, /h\.kind === 'sling' && power >= 0\.08/);
});

test('billiards: a richer table, tap a ball to aim at a pocket, the loupe and a pull-down power', async () => {
  const [main, html] = await Promise.all(['public/assets/js/billiards/main.js', 'public/billiards.html'].map(read));
  assert.match(main, /const RAIL = 12, CUSHION = 4;/);
  assert.match(main, /two lamps over the bed/); assert.match(main, /the lacquer/);
  assert.match(main, /function potAim\(n\)/); assert.match(main, /if \(hit > 0\) potAim\(hit\)/);
  assert.match(main, /drawLoupe\(cue, dir\)/); assert.match(main, /view\.loupe = true/);
  assert.match(main, /\(ev\.clientY - from\[1\]\) \/ 190/);
  assert.match(html, /اسحب لتحت وأفلت/); assert.match(html, /عدسة تكبّر/);
});

test('the release is 33.9.6 or later with its notes', async () => {
  assert.match(JSON.parse(await read('package.json')).version, /^33\.(?:9\.(?:[6-9]|\d{2,})|\d{2,}\.\d+)$/);
  const notes = await read('RELEASE_V33_9_6_AR.md');
  for (const word of ['الكيرم', 'البلياردو', 'الدافع', 'عدسة', 'لتحت', 'صورة جديدة']) assert.match(notes, new RegExp(word));
  assert.doesNotMatch(notes, /بوت(?!ن)/);
  assert.match(await read('README-AR.md'), /RELEASE_V33_9_6_AR\.md/);
});
