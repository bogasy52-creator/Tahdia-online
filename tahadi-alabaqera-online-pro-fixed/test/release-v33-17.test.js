// 33.17.0: billiards and dice sound new, balls roll into the pocket, «عشر ثواني» ticks for 3 seconds only,
// the six-player Ludo ring is continuous, the shop sells Ludo stones and block skins, and the royal look
// reaches the shop and the billiards/carrom screens.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile, stat } from 'node:fs/promises';
import * as Ludo from '../public/assets/js/engines/ludo-engine.js';
import * as Six from '../public/assets/js/ludo/six-layout.js';
import { Career } from '../src/career/core.js';
import { createDOM, MiniElement } from './dom-harness.mjs';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');
const size = async (path) => (await stat(new URL('../' + path, import.meta.url))).size;

async function ludo() {
  const h = await createDOM('ludo.html', { ...Ludo, ...Six });
  h.doc.createTextNode = (t) => { const n = new MiniElement('#text'); n.textContent = t; return n; };
  await h.runFile('assets/js/ludo/board.js');
  return h;
}

test('six-player Ludo: every bend of the ring is bridged, so the path never looks cut', async () => {
  const h = await ludo();
  h.context.args = { host: h.doc.getElementById('board'), state: Ludo.createLudoGame(['A', 'B', 'C', 'D', 'E', 'F']), options: { viewer: 0, active: 0, legal: [] } };
  await vm.runInContext('renderLudoBoard(args.host,args.state,args.options)', h.context);
  const bends = h.doc.querySelectorAll('#board svg [data-bend]');
  assert.deepEqual(bends.map((b) => b.getAttribute('data-bend')).sort(), ['0', '1', '2', '3', '4', '5']);
  for (const bend of bends) { assert.match(bend.getAttribute('d'), /^M[-\d.]+ [-\d.]+(L[-\d.]+ [-\d.]+){3}Z$/); assert.equal(bend.getAttribute('pointer-events'), 'none'); }
});

test('Ludo stones: four designs, a preview, and only the viewer wears their own set', async () => {
  const js = await read('public/assets/js/ludo/board.js');
  assert.match(js, /export function ludoPiecesPreview\(design = 'royal'\)/);
  assert.match(js, /'ludo-crystal': 'crystal', 'ludo-gold': 'gold', 'ludo-onyx': 'onyx'/);
  assert.match(js, /s\.seat === viewer \? mine : 'royal'/);
  const h = await ludo();
  for (const design of ['royal', 'crystal', 'gold', 'onyx']) {
    h.context.design = design;
    const svg = await vm.runInContext('ludoPiecesPreview(design)', h.context);
    assert.equal(svg.getAttribute('class'), 'ludo-pieces-preview', design);
    assert.ok(svg.querySelectorAll('g').length >= 4, design);
  }
});

test('the shop sells Ludo stones and block skins, free defaults are owned and equipped', () => {
  const ids = ['ludo-royal', 'ludo-crystal', 'ludo-gold', 'ludo-onyx', 'blocks-jewel', 'blocks-neon', 'blocks-candy', 'blocks-gold'];
  const items = ids.map((id) => Career.CATALOG.find((item) => item.id === id));
  items.forEach((item, i) => assert.ok(item, ids[i]));
  assert.ok(Career.SLOTS.includes('ludoset') && Career.SLOTS.includes('blockset'));
  for (const item of items) { assert.ok(Career.STOREFRONT.includes(item.id), item.id); assert.ok(item.description.length > 20, item.id); assert.doesNotMatch(item.name + item.description, /بوت|كمبيوتر/); }
  assert.deepEqual(items.filter((item) => item.price === 0).map((item) => item.id), ['ludo-royal', 'blocks-jewel']);
  const fresh = Career.normalize({});
  assert.equal(fresh.equipped.ludoset, 'ludo-royal');
  assert.equal(fresh.equipped.blockset, 'blocks-jewel');
  assert.ok(fresh.owned.includes('ludo-royal') && fresh.owned.includes('blocks-jewel'));
});

test('shop shelves, previews and royal styles are wired', async () => {
  const shop = await read('public/assets/js/shop-v31.js'), bundles = JSON.parse(await read('scripts/style-bundles.json'));
  assert.match(shop, /ludoset/); assert.match(shop, /blockset/);
  assert.match(shop, /ludoPiecesPreview/);
  assert.match(shop, /sx-blocks-art bk-skin-/);
  const shopStyles = JSON.stringify(bundles['shop.html'] || bundles), blocksStyles = JSON.stringify(bundles['blocks.html'] || bundles);
  assert.match(shopStyles, /shop-royal-v33-17\.css/); assert.match(shopStyles, /block-skins-v33-17\.css/);
  assert.match(blocksStyles, /block-skins-v33-17\.css/);
  const skins = await read('public/assets/css/block-skins-v33-17.css');
  for (const skin of ['neon', 'candy', 'gold']) assert.match(skins, new RegExp('bk-skin-' + skin));
  const blocks = await read('public/assets/js/blocks-v33-15.js');
  assert.match(blocks, /bs-career-change/);
});

test('«عشر ثواني»: the clock is heard for the first 3 seconds only', async () => {
  const js = await read('public/assets/js/ten-v33-12.js');
  assert.match(js, /const TICK_HEARD_MS = 3000;/);
  assert.match(js, /performance\.now\(\) - game\.startedAt < TICK_HEARD_MS\) sounds\.tick\(\)/);
});

test('billiards and dice have new recorded-style sounds; balls roll into the pocket', async () => {
  const audio = await read('public/assets/js/audio-manager.js');
  assert.match(audio, /assets\/sounds\/pool-v33-17\//); assert.match(audio, /assets\/sounds\/dice-v33-17\//);
  assert.doesNotMatch(audio, /pool-v33-9|dice-v31\//);
  for (const family of ['ball', 'rail', 'cue', 'pocket']) for (let i = 1; i <= 3; i++) {
    const bytes = await size('public/assets/sounds/pool-v33-17/' + family + '-' + i + '.wav');
    assert.ok(bytes > 2000 && bytes < 160000, family + i);
  }
  for (const id of ['soft-1', 'soft-2', 'wood-1', 'wood-2', 'crystal-1', 'crystal-2', 'land-soft', 'land-wood', 'land-crystal']) assert.ok(await size('public/assets/sounds/dice-v33-17/' + id + '.wav') > 2000, id);
  const main = await read('public/assets/js/billiards/main.js');
  assert.match(main, /const SINK_MS = 460;/);
  assert.match(main, /Roll\.set\(i0 >= last \? 0 : moving \/ 9\)/);
  assert.match(main, /نادي البلياردو/);
});

test('the royal look reaches billiards, carrom and the rooms; old brand names are gone', async () => {
  const premium = await read('public/assets/css/tahdia-premium-v25.css');
  for (const part of ['.bi-plate', '.bi-pocket-tray', '.cm-player', '.cm-dock', 'body.party-app .hero-entry']) assert.ok(premium.includes(part), part);
  assert.match(premium, /\.hero-entry\{pointer-events:none\}/);
  const files = ['public/assets/css/luxury-game-ui.css', 'public/assets/css/snakes-premium.css', 'public/assets/js/baloot-cards.js', 'public/assets/js/home-v33-10-3.js', 'public/assets/js/uno-ui.js', 'public/assets/js/carrom/render.js', 'public/assets/js/tanks/scene.js', 'public/assets/js/billiards/main.js'];
  for (const file of files) assert.doesNotMatch(await read(file), /تحدي العباقرة|بوسراج/, file);
});
