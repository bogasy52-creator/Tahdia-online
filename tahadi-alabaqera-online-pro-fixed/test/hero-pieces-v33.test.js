import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

// 33.0.0: on the snakes board every seat walks with its owner's hero (a bot's, a
// friend's). The hero art loads once; when it lands, every piece is drawn again,
// and each one must keep its own hero instead of taking yours.
test('a seat drawn with its own hero keeps it when the hero art loads', async () => {
  const source = await readFile(new URL('../public/assets/js/royal-stones.js', import.meta.url), 'utf8');
  const images = [], canvases = [];
  const pen = new Proxy({}, {
    get: (target, key) => (key in target ? target[key] : () => ({ addColorStop() {} })),
    set: (target, key, value) => { target[key] = value; return true; },
  });
  const window = {
    document: {
      documentElement: { dataset: {} },
      getElementById: () => null,
      querySelectorAll: (selector) => (selector.includes('data-art="character"') ? canvases.filter((c) => c.dataset.art === 'character') : []),
    },
    localStorage: { getItem: () => null, setItem() {} },
    Image: class { constructor() { images.push(this); } },
    CustomEvent: class { constructor(type) { this.type = type; } },
    addEventListener() {},
    dispatchEvent() {},
    matchMedia: () => ({ matches: false }),
    BS_CAREER: { get: () => ({ owned: [], equipped: { character: 'character-fox' } }) },
  };
  window.window = window;
  vm.runInNewContext(source, window);
  const stones = window.BS_STONES;
  const canvas = () => { const c = { dataset: {}, getContext: () => pen }; canvases.push(c); return c; };
  const seat = (index, character) => {
    const c = canvas();
    assert.equal(stones.draw(c, 'pawn-character', index, { style: 'characters', preview: true, character }), true);
    return c;
  };
  const bot = seat(1, 'princess'), friend = seat(2, 'robot');
  const yours = canvas();
  stones.draw(yours, 'pawn-character', 0, { style: 'characters' });
  assert.equal(bot.dataset.character, 'princess');
  assert.equal(yours.dataset.character, 'fox');
  // the art arrives: every piece on the page is drawn again
  assert.ok(images.length > 0);
  for (const image of images) image.onload?.();
  assert.equal(bot.dataset.character, 'princess', 'the bot keeps its hero');
  assert.equal(friend.dataset.character, 'robot', 'the friend keeps theirs');
  assert.equal(yours.dataset.character, 'fox', 'a piece drawn without a hero of its own still follows yours');
});
