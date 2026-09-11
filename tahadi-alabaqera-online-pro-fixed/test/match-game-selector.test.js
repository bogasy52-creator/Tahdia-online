import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const publicRoot = new URL('../public/', import.meta.url);

async function bootSelector(search = '') {
  const source = await readFile(new URL('assets/js/match-game-selector.js', publicRoot), 'utf8').catch(() => '');
  const calls = [];
  const location = { search };
  const window = {
    location,
    TahdiaMatchmaking: { join: () => calls.push(['quiz']) },
    TAHADI_BOARD_MATCHMAKING: { join: (game) => calls.push(['board', game]) },
    BS_PLATFORM: { toast: (message) => calls.push(['toast', message]) },
  };
  vm.runInNewContext(source, { window, document: null, Object, Array, URLSearchParams });
  return { api: window.TAHADI_GAME_SELECTOR, calls };
}

test('online matchmaking offers every supported game and dispatches the selected one', async () => {
  const { api, calls } = await bootSelector();
  assert.ok(api);
  assert.deepEqual(Array.from(api.games, (game) => game.id), ['quiz', 'snakes', 'zahra', 'jackaroo', 'spotdiff']);
  assert.equal(api.launch('snakes'), true);
  assert.deepEqual(calls.pop(), ['board', 'snakes']);
  assert.equal(api.launch('quiz'), true);
  assert.deepEqual(calls.pop(), ['quiz']);
  assert.equal(api.launch('unknown'), false);
});

test('matchmaking page contains a visible selectable game grid', async () => {
  const html = await readFile(new URL('matchmaking.html', publicRoot), 'utf8');
  assert.match(html, /id="matchGamePicker"/);
  assert.match(html, /assets\/js\/match-game-selector\.js/);
  assert.match(html, /assets\/js\/board-matchmaking\.js/);
  assert.doesNotMatch(html, /لا توجد قوائم لعبة/);
});

test('player entry preserves the requested game before matchmaking starts', async () => {
  const { api } = await bootSelector('?game=snakes');
  assert.equal(api.selected(), 'snakes');

  const fallback = await bootSelector('?game=not-a-game');
  assert.equal(fallback.api.selected(), 'quiz');
});

test('the main online quick-play entry leads to the game picker', async () => {
  const html = await readFile(new URL('online.html', publicRoot), 'utf8');
  assert.match(html, /id="quickPlayBtn"[^>]*>[^<]*اختر اللعبة/);
  assert.match(html, /function quickPlay\(\)\s*\{\s*location\.href=['"]\/matchmaking\.html['"]/);
});

test('player entry links target a real HTML document on static hosting', async () => {
  const source = await readFile(new URL('assets/js/platform.js', publicRoot), 'utf8');
  const links = [
    { textContent: 'لاعب حقيقي', href: '/online' },
    { textContent: 'ابحث عن منافس', href: '/matchmaking' },
  ].map((link) => ({
    ...link,
    getAttribute(name) { return name === 'href' ? this.href : null; },
    setAttribute(name, value) { if (name === 'href') this.href = value; },
  }));
  const document = {
    readyState: 'complete',
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll(selector) { return selector === 'a[href]' ? links : []; },
  };
  const window = { addEventListener() {}, matchMedia() { return { matches: false }; } };
  const navigator = { userAgent: '', serviceWorker: null };
  vm.runInNewContext(source, { window, document, navigator, setTimeout, clearTimeout, Number });
  window.BS_PLATFORM.normalizePlayerLinks(document, 'quiz');
  assert.deepEqual(links.map((link) => link.href), [
    '/matchmaking.html?game=quiz',
    '/matchmaking.html?game=quiz',
  ]);
});
