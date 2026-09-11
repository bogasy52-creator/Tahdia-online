import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const publicRoot = new URL('../public/', import.meta.url);

async function bootSelector() {
  const source = await readFile(new URL('assets/js/match-game-selector.js', publicRoot), 'utf8').catch(() => '');
  const calls = [];
  const window = {
    TahdiaMatchmaking: { join: () => calls.push(['quiz']) },
    TAHADI_BOARD_MATCHMAKING: { join: (game) => calls.push(['board', game]) },
    BS_PLATFORM: { toast: (message) => calls.push(['toast', message]) },
  };
  vm.runInNewContext(source, { window, document: null, Object, Array });
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

test('the main online quick-play entry leads to the game picker', async () => {
  const html = await readFile(new URL('online.html', publicRoot), 'utf8');
  assert.match(html, /id="quickPlayBtn"[^>]*>[^<]*اختر اللعبة/);
  assert.match(html, /function quickPlay\(\)\s*\{\s*location\.href=['"]\/matchmaking['"]/);
});
