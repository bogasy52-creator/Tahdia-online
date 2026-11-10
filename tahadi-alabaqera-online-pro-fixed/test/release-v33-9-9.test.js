// 33.9.9: the jewels duel arena — painted gems on one sheet, a gold-framed board, player cards with the
// moves between them, charge tanks, the VS meeting and the new end.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const read = (file) => readFile(new URL('../' + file, import.meta.url), 'utf8');

test('jewels: the painted gem sheet is loaded and used, with the drawn gems kept as a fallback', async () => {
  const main = await read('public/assets/js/jewels/main.js');
  assert.ok((await stat(new URL('../public/assets/jewels/gems-v33-9-9.webp', import.meta.url))).size > 20000);
  assert.match(main, /\/assets\/jewels\/gems-v33-9-9\.webp/);
  assert.match(main, /function fromSheet\(/); assert.match(main, /else if \(s === 'bomb'\) fromSheet\(g, c, 1, px\)/);
  assert.match(main, /drawGem\(g, c, r\)/);
});

test('jewels: the arena page — cards, moves, tanks, the meeting and the ribbon', async () => {
  const [html, main, css, bundles] = await Promise.all(['public/jewels.html', 'public/assets/js/jewels/main.js', 'public/assets/css/jewels-mm-v33-9-9.css', 'scripts/style-bundles.json'].map(read));
  assert.match(html, /id="jwMoves"/); assert.match(html, /id="jwIntro"/); assert.match(html, /class="mm-ribbon"/); assert.match(html, /class="mm-bg"/);
  assert.match(main, /function showIntro\(/); assert.match(main, /class="mm-tank"/); assert.match(main, /'combo'\)/);
  assert.match(css, /\.mm2 \.jw-boost \.mm-liquid\{/); assert.match(css, /@keyframes mmSlam/);
  assert.ok(JSON.parse(bundles)['jewels.html'].includes('assets/css/jewels-mm-v33-9-9.css'));
});
