import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const sourceUrl = new URL('../public/assets/js/board-matchmaking.js', import.meta.url);

async function boot(pathname = '/snakes') {
  const source = await readFile(sourceUrl, 'utf8');
  const window = {};
  const document = { readyState: 'loading', addEventListener() {} };
  const location = { pathname, search: '', origin: 'https://games.example' };
  vm.runInNewContext(source, {
    window, document, location, URL, URLSearchParams, Set, Object, String,
    setTimeout() {}, clearTimeout() {}, fetch() {}, console,
  });
  return window.TAHADI_BOARD_MATCHMAKING;
}

test('board quick-match keeps the page game when the click event is passed', async () => {
  const api = await boot('/snakes');
  assert.equal(api.resolveGame({ type: 'click' }), 'snakes');
  assert.equal(api.resolveGame('zahra'), 'zahra');
  assert.equal(api.resolveGame('unknown'), null);
  const concretePageApi = await boot('/snakes.html');
  assert.equal(concretePageApi.resolveGame({ type: 'click' }), 'snakes');
});

test('BOT fallback and real rooms both open canonical game routes without redirect hops', async () => {
  const api = await boot('/matchmaking');
  assert.equal(api.destinationFor('snakes', { bot: '1', difficulty: 'medium' }), 'https://games.example/snakes?bot=1&difficulty=medium');
  assert.equal(api.destinationFor('jackaroo', { room: 'ABCD', quick: '1' }), 'https://games.example/jackaroo?room=ABCD&quick=1');
  assert.equal(api.destinationFor('bad-game', { bot: '1' }), null);
});
