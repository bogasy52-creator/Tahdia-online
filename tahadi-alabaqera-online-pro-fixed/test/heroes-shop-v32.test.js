import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import vm from 'node:vm';
import { environment, api } from './worker-harness.mjs';
import '../public/assets/js/profile-core.js';

const Core = globalThis.BS_CAREER_CORE;
const pub = new URL('../public/', import.meta.url).pathname;
const read = (file) => readFile(pub + file, 'utf8');
const exists = async (file) => { try { await access(pub + file); return true; } catch { return false; } };

test('twelve 3D heroes replace the old characters and keep every purchase', async () => {
  const heroes = Core.CATALOG.filter((item) => item.type === 'character');
  assert.equal(heroes.length, 12);
  assert.deepEqual(heroes.filter((item) => item.price === 0).map((item) => item.id), ['character-fox']);
  // the ids bought before 32.0.0 still exist, now with hero art
  for (const id of ['fox', 'cat', 'robot', 'princess', 'fairy', 'astronaut']) assert.ok(Core.heroOf('character-' + id), id);
  assert.equal(Core.heroOf('fox').name, 'الملثّم');
  assert.equal(Core.heroOf('princess').art, 'knight');
  for (const hero of Core.HEROES) {
    assert.ok(await exists('assets/heroes/' + hero.art + '.webp'), hero.art);
    assert.ok(await exists('assets/heroes/face/' + hero.art + '.webp'), hero.art + ' face');
    assert.doesNotMatch(hero.name, /قطة|أميرة|جنيّة|ثعلب/);
  }
  assert.equal(Core.heroArt('character-samurai'), '/assets/heroes/samurai.webp');
  assert.equal(Core.heroFace('viking'), '/assets/heroes/face/viking.webp');
  assert.equal(Core.heroFace('../../forged'), '');
  // every bot seat gets a hero, and seats look different
  assert.ok(new Set([0, 1, 2, 3].map(Core.botHeroFace)).size === 4);
  const stones = await read('assets/js/royal-stones.js');
  assert.match(stones, /'\/assets\/heroes\/'/);
  assert.doesNotMatch(stones, /assets\/characters\//);
  const shop = await read('assets/js/shop-v31.js');
  assert.match(shop, /'\/assets\/heroes\/'\+\(item\.asset\|\|'desert'\)/);
});

test('a room accepts a new hero the account owns and refuses one it does not', async (t) => {
  const originalPair = globalThis.WebSocketPair, OriginalResponse = globalThis.Response;
  globalThis.WebSocketPair = class { constructor() { for (let i = 0; i < 2; i++) this[i] = { send() {}, serializeAttachment(v) { this.attachment = v; }, deserializeAttachment() { return this.attachment; }, close() {} }; } };
  globalThis.Response = class extends OriginalResponse { constructor(body, init) { if (init?.status === 101) { super(null, { status: 200, headers: init.headers }); Object.defineProperty(this, 'status', { value: 101 }); this.webSocket = init.webSocket; } else super(body, init); } };
  t.after(() => { globalThis.WebSocketPair = originalPair; globalThis.Response = OriginalResponse; });
  for (const game of ['snakes', 'baloot']) {
    const env = environment();
    const res = await api(env, '/api/board/rooms', { game, name: 'A', playerLimit: 2 });
    const entry = env.BOARD_ROOMS.peek(res.data.code); await entry.ctx.ready;
    const board = entry.instance;
    const ws = (character, owned) => board.fetch(new Request('https://board.internal/ws?name=' + character, { headers: { upgrade: 'websocket', 'sec-websocket-protocol': 'busraj-v1, hk.' + board.room.hostKey, 'x-bs-character': character, 'x-bs-characters': JSON.stringify(owned) } }));
    assert.equal((await ws('samurai', ['samurai'])).status, 101);
    const host = Object.values(board.room.players)[0];
    assert.equal(host.character, 'samurai', game);
    await ws('cyber', ['samurai']);
    assert.equal(Object.values(board.room.players)[0].character, 'fox', game + ': a hero the account does not own falls back to the free one');
  }
});

test('Baloot decks are sold in the shop and equipped on their own slot', async () => {
  const decks = Core.CATALOG.filter((item) => item.type === 'deck');
  assert.deepEqual(decks.map((item) => item.id).sort(), ['deck-classic', 'deck-emerald', 'deck-four', 'deck-night', 'deck-royal']);
  assert.ok(Core.SLOTS.includes('deck'));
  const fresh = Core.normalize({});
  assert.equal(fresh.equipped.deck, 'deck-classic');
  assert.ok(fresh.owned.includes('deck-classic'));
  assert.throws(() => Core.equip(fresh, 'deck-royal'), /not_owned/);
  const bought = Core.purchase(Core.normalize({ coins: 2000 }), 'deck-royal', { now: 0 });
  assert.equal(bought.equipped.deck, 'deck-royal');
  assert.equal(Core.normalize(bought).equipped.deck, 'deck-royal');
  for (const id of decks.map((d) => d.id)) assert.ok(Core.STOREFRONT.includes(id), id);
  // every deck sold has a face and a back in the card renderer
  const context = { window: {}, document: {}, btoa: (s) => Buffer.from(s, 'binary').toString('base64'), unescape, encodeURIComponent };
  vm.runInNewContext(await read('assets/js/baloot-cards.js'), context);
  for (const deck of decks) {
    assert.ok(context.window.BS_CARDS.DECKS[deck.id], deck.id);
    assert.match(context.window.BS_CARDS.url('AS', deck.id), /^data:image\/svg\+xml/);
    assert.match(context.window.BS_CARDS.url('back', deck.id), /^data:image\/svg\+xml/);
  }
  const shop = await read('assets/js/shop-v31.js');
  assert.match(shop, /\['deck','ورق البلوت'/);
  assert.match(shop, /function deckArt\(stage,item,live\)/);
  assert.match(await read('shop.html'), /assets\/js\/baloot-cards\.js\?v=\d+\.\d+\.\d+/);
  const bundles = Core.BUNDLES.filter((b) => ['heroes-set', 'baloot-set'].includes(b.id));
  assert.equal(bundles.length, 2);
  for (const b of bundles) for (const id of b.items) assert.ok(Core.CATALOG.some((item) => item.id === id), id);
});

test('the free snakes board has calm neon tiles; paid lava and galaxy boards stay available', async () => {
  const forest = Core.CATALOG.find((item) => item.id === 'board-forest');
  assert.equal(forest.price, 0);
  assert.equal(forest.name, 'لوحة النيون');
  for (const id of ['board-lava', 'board-galaxy']) {
    const item = Core.CATALOG.find((x) => x.id === id);
    assert.ok(item && item.price > 0 && Core.STOREFRONT.includes(id), id);
  }
  const css = await read('assets/css/snakes-board-v32.css');
  // The default has two muted colours, without row-by-row rainbow overrides.
  assert.match(css,/--snl-tile:#18323e;--snl-tile-alt:#213f4a/);
  assert.doesNotMatch(css,/#board>\.snake-cell:nth-child\(n\+91\)/);
  for (const theme of ['board-royal', 'board-lava', 'board-galaxy']) assert.match(css, new RegExp('html\\[data-board=' + theme + '\\]\\{'));
  // the light cream tiles of 31.x are gone from the default board
  assert.doesNotMatch(css.split('/* ---------- palace')[0], /#f8ecd4|#ecd3a4|#eedcb6/);
  const bundle = await read('assets/css/app-snakes.css');
  assert.ok(bundle.indexOf('snakes-board-v32.css') > bundle.indexOf('snakes-board-v31-1.css'));
  const arena = await read('assets/js/neon-arena.js');
  assert.match(arena, /ember:\{/);
  assert.match(arena, /cosmic:\{/);
  assert.match(arena, /\/lava\/\.test\(id\)\?'ember'/);
  for (const name of ['forest', 'royal', 'cyber', 'lava', 'galaxy']) assert.ok(await exists('assets/previews/board-v32-' + name + '.webp'), name);
});
