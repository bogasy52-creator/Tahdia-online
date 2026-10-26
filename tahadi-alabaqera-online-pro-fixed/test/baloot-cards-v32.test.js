import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const load = async (...files) => {
  const context = vm.createContext({ encodeURIComponent, Math, Map, Object, String, Number });
  for (const file of files) vm.runInContext(await readFile(new URL('../public/assets/js/' + file, import.meta.url), 'utf8'), context);
  return context;
};
const SUITS = ['S', 'H', 'D', 'C'], RANKS = ['7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

test('the twelve court figures are there, drawn with deck colour tokens only', async () => {
  const { BS_COURTS } = await load('card-courts.js');
  assert.deepEqual([...BS_COURTS.size], [302, 482]);
  for (const rank of ['J', 'Q', 'K']) for (const suit of SUITS) {
    const art = BS_COURTS.get(rank + suit);
    assert.ok(art.length > 2000, rank + suit + ' has a figure');
    assert.equal(/#[0-9a-f]{3,8}/i.test(art), false, rank + suit + ' uses the deck palette, not fixed colours');
    assert.equal(/<script|on[a-z]+=|href=/i.test(art), false, 'artwork carries no script or links');
    assert.equal((art.match(/<g/g) || []).length >= (art.match(/<\/g>/g) || []).length, true);
  }
  assert.equal(BS_COURTS.get('AS'), '');
});

test('every deck draws all 32 cards and the back as well-formed SVG; courts use the real figures', async () => {
  const { BS_CARDS } = await load('card-courts.js', 'baloot-cards.js');
  for (const deck of Object.keys(BS_CARDS.DECKS)) {
    for (const suit of SUITS) for (const rank of RANKS) {
      const svg = BS_CARDS.face(rank + suit, deck);
      assert.match(svg, /^<svg[^>]+viewBox="0 0 250 350"/);
      assert.equal(svg.includes('%'), false, `${deck} ${rank}${suit}: every colour token is filled`);
      assert.equal(/undefined|NaN/.test(svg), false, `${deck} ${rank}${suit}`);
      if ('JQK'.includes(rank)) assert.ok(svg.includes('clip-path'), `${deck} ${rank}${suit} shows the court figure in its window`);
    }
    assert.match(BS_CARDS.back(deck), /^<svg/);
    assert.match(BS_CARDS.url('KH', deck), /^data:image\/svg\+xml;charset=utf-8,/);
    const plain = (u) => decodeURIComponent(u).replace(/id="[^"]+"/g, '').replace(/url\(#[^)]+\)/g, '');
    assert.equal(plain(BS_CARDS.url('??', deck)), plain(BS_CARDS.url('back', deck)), 'a hidden card shows the back');
  }
  const ids = new Set([...BS_CARDS.face('QS').matchAll(/id="([^"]+)"/g), ...BS_CARDS.face('QS').matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  assert.ok(ids.size >= 2, 'each face gets its own ids, so several cards on one page never share a gradient or clip');
});

test('without the court file the cards still draw (a large suit mark in the window)', async () => {
  const { BS_CARDS } = await load('baloot-cards.js');
  const svg = BS_CARDS.face('JD');
  assert.match(svg, /^<svg/);
  assert.equal(svg.includes('undefined'), false);
});
