// 33.9.9: the jewels duel arena — painted gems on one sheet, a gold-framed board, player cards with the
// moves between them, charge tanks, the VS meeting and the new end.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const read = (file) => readFile(new URL('../' + file, import.meta.url), 'utf8');

test('jewels: scalable original crystal art replaces the live raster dependency', async () => {
  const [main,renderer] = await Promise.all(['public/assets/js/jewels/main.js','public/assets/js/jewels/studio-renderer.js'].map(read));
  assert.ok((await stat(new URL('../public/assets/jewels/gems-v33-9-9.webp', import.meta.url))).size > 20000);
  assert.match(main,/createJewelsRenderer/);assert.match(renderer,/export function drawStudioGem\(/);
  assert.doesNotMatch(main+renderer,/new Image\(|gems-v33-9-9\.webp/);
  for(const special of ['ball','bomb','rh','rv'])assert.ok(renderer.includes("'"+special+"'"));
});

test('jewels: the independent arena exposes actions, timing, boosters and private handover', async () => {
  const [html,main,bundles] = await Promise.all(['public/jewels.html','public/assets/js/jewels/main.js','scripts/style-bundles.json'].map(read));
  for(const id of ['jwMoves','jwMatchClock','jwBoostBar','jwHandover','jwEndScores'])assert.ok(html.includes('id="'+id+'"'));
  assert.match(main,/players\[seat\]\.seq/);assert.match(main,/renderClock\(/);assert.match(main,/'combo'/);
  const styles=JSON.parse(bundles)['jewels.html'];assert.ok(styles.includes('assets/css/jewels-studio-v33-10.css'));assert.ok(!styles.includes('assets/css/jewels-mm-v33-9-9.css'));
});
