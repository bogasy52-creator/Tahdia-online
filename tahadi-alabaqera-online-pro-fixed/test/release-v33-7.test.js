// 33.7.0: the Jackaroo board of the picture and its boards in the shop, one clear clock in every
// room with the tension of the last seconds, a card for every player with «أضف صديق», more focus
// challenges and word-hunt themes (and the secret word), and the fixes: the word-hunt list spelled
// as the board, the cipher shown in the order it was picked, the room-code box above the keyboard.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('the 33.7.0 notes say what changed', async () => {
  const notes = await read('RELEASE_V33_7_AR.md');
  for (const words of ['جاكارو', 'لوحات الجاكارو', 'عداد واحد واضح', 'قرب يفوز', 'أضف صديق', 'مواجهة التركيز', 'الكلمة السرية', 'إظهار شفرتي', 'ادخل رمز الغرفة', 'الاقتراح اللي نفذته']) assert.ok(notes.includes(words), words);
});

test('the cipher shows your own code in the order you picked it, even on a page written right to left', async () => {
  const client = await read('public/assets/js/challenge-client.js');
  assert.match(client, /code=el\('bdi','ch-secret-digits',secretVisible\?\(m\.me\.secret\|\|\[\]\)\.map\(x=>x\+offset\)\.join\(' '\):'• • • •'\);code\.dir='ltr';/);
});

test('the word-hunt list: the words as the board spells them, a found word struck through, boxes for a hidden one', async () => {
  const css = await read('public/assets/css/wordhunt-v33-5.css'), ui = await read('public/assets/js/wordbomb-ui.js');
  // 33.8.0: the strike is back (drawn across, in the finder's colour), in place of the tick
  assert.match(css, /\.ch-hunt-word\.found \.ch-hunt-label::after\{content:'';/);
  assert.match(css, /\.ch-hunt-mask i\{display:grid;place-items:center;box-sizing:border-box;flex:0 1 17px;/);
  assert.match(ui, /pick\.textContent=shown&&shown\.length>1\?shown\.map\(c=>h\.grid\[c\]\)\.join\(''\):/, 'the letters you drag over read as one word');
  assert.match(await read('public/assets/js/engines/wordbank-ar.js'), /word:huntLetters\(label\)/);
});

test('home: the room-code box opens at the top of a phone and keeps clear of the keyboard', async () => {
  const css = await read('public/assets/css/home-join-v33-6.css'), js = await read('public/assets/js/home-join-v33-6.js');
  assert.match(css, /@media \(max-width:520px\)\{\.home-join-sheet\{place-items:start center;/);
  assert.match(css, /\.home-join-sheet\.fit-keyboard\{inset:auto 0;top:var\(--join-top,0px\);height:var\(--join-height,100%\)\}/);
  assert.match(js, /const view = window\.visualViewport;/);
  assert.match(js, /view\?\.addEventListener\('resize', fit\); view\?\.addEventListener\('scroll', fit\);/);
  assert.match(await read('public/assets/css/app-index.css'), /\.home-join-sheet\.fit-keyboard\{/);
});

test('your turn: a soft call, and the tab says so while you are away', async () => {
  const clock = await read('public/assets/js/room-clock-v33-7.js');
  assert.match(clock, /document\.title = '⏰ دورك! · ' \+ title;/);
  assert.match(clock, /if \(spec\.mine && end > \(spec\.clock \? Number\(spec\.clock\(\)\) : Date\.now\(\)\) \+ 1500\) yourTurn\(\);/);
});

test('the offline core stays under one megabyte', async () => {
  const { stat } = await import('node:fs/promises');
  const sw = await read('public/service-worker.js'), shell = sw.match(/const\s+APP_SHELL\s*=\s*\[([\s\S]*?)\];/)[1];
  const paths = [...shell.matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
  let bytes = 0;
  for (const path of paths) bytes += (await stat(new URL('../public/' + (path === '/' ? 'index.html' : path.slice(1).split('?')[0]), import.meta.url))).size;
  assert.ok(bytes < 1_000_000, String(bytes));
});
