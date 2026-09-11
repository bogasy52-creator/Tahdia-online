import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../', import.meta.url).pathname;
const pub = `${root}public/`;

async function loadStoreController() {
  const catalog = await readFile(`${pub}assets/js/store-catalog.js`, 'utf8');
  const source = await readFile(`${pub}assets/js/store.js`, 'utf8').catch(() => '');
  const window = { addEventListener() {} };
  vm.runInNewContext(catalog, { window, Map, Object });
  vm.runInNewContext(source, { window, document: null, Date, Math, Set, Map, Object });
  return window;
}

test('catalog contains the complete approved cosmetic inventory with unique stable IDs', async () => {
  const window = await loadStoreController();
  const counts = Object.fromEntries(['avatar', 'frame', 'table', 'entrance', 'victory', 'sound'].map((category) => [
    category,
    window.TAHADI_STORE_CATALOG.filter((item) => item.category === category).length,
  ]));
  assert.deepEqual(counts, { avatar: 12, frame: 8, table: 6, entrance: 6, victory: 6, sound: 5 });
  assert.equal(new Set(window.TAHADI_STORE_CATALOG.map((item) => item.id)).size, 43);
});

test('daily rotation is deterministic, includes every category, and changes by day', async () => {
  const window = await loadStoreController();
  const first = window.TAHADI_STORE_UI.rotationForDate('2026-09-10');
  const repeated = window.TAHADI_STORE_UI.rotationForDate('2026-09-10');
  const next = window.TAHADI_STORE_UI.rotationForDate('2026-09-11');
  assert.deepEqual(first, repeated);
  assert.equal(first.length, 6);
  assert.deepEqual(new Set(first.map((item) => item.category)), new Set(['avatar', 'frame', 'table', 'entrance', 'victory', 'sound']));
  assert.notDeepEqual(first.map((item) => item.id), next.map((item) => item.id));
});

test('item status distinguishes equipped, owned, level-locked, affordable, and owner access', async () => {
  const window = await loadStoreController();
  const item = window.TAHADI_STORE_CATALOG.find((entry) => entry.id === 'frame-gold');
  assert.equal(window.TAHADI_STORE_UI.statusForItem(item, { level: 2, coins: 500, inventory: [], equipped: {} }, false).kind, 'level_locked');
  assert.equal(window.TAHADI_STORE_UI.statusForItem(item, { level: 3, coins: 100, inventory: [], equipped: {} }, false).kind, 'insufficient');
  assert.equal(window.TAHADI_STORE_UI.statusForItem(item, { level: 3, coins: 500, inventory: [], equipped: {} }, false).kind, 'buy');
  assert.equal(window.TAHADI_STORE_UI.statusForItem(item, { level: 3, coins: 0, inventory: ['frame-gold'], equipped: {} }, false).kind, 'owned');
  assert.equal(window.TAHADI_STORE_UI.statusForItem(item, { level: 3, coins: 0, inventory: ['frame-gold'], equipped: { frame: 'frame-gold' } }, false).kind, 'equipped');
  assert.equal(window.TAHADI_STORE_UI.statusForItem(item, { level: 1, coins: 0, inventory: [], equipped: {} }, true).kind, 'owner');
});

test('shop page exposes accessible navigation, preview, rewards, missions, and history', async () => {
  const html = await readFile(`${pub}store.html`, 'utf8');
  const css = await readFile(`${pub}assets/css/store.css`, 'utf8');
  assert.match(html, /id="shopGrid"/);
  assert.match(html, /id="shopPreview"/);
  assert.match(html, /id="dailyReward"/);
  assert.match(html, /id="weeklyMissions"/);
  assert.match(html, /id="purchaseHistory"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /assets\/js\/store-catalog\.js/);
  assert.match(html, /assets\/js\/progression\.js/);
  assert.match(html, /assets\/js\/store\.js/);
  assert.match(css, /\.sr-only\{[^}]*clip-path:inset\(50%\)/);
});

test('home page makes the shop visible on desktop, mobile, and quick actions', async () => {
  const html = await readFile(`${pub}index.html`, 'utf8');
  const links = html.match(/href="\/store"/g) || [];
  assert.ok(links.length >= 3);
  assert.match(html, /assets\/js\/store-catalog\.js[\s\S]*assets\/js\/progression\.js/);
});
