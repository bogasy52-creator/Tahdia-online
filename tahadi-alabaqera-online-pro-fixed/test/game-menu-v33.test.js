import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { ROOM_FAMILIES, roomCodeFor, gameOfCode as serverGameOfCode } from '../src/rooms/room-codes.js';

// 33.0.0: one menu for every online game (game-menu-v33.js). These tests check its
// pure parts: codes, where a code leads, the name you play with, and your last match.
async function menu({ account = '', party = '', career = '', stored = {}, now = 1_000_000 } = {}) {
  const store = new Map(Object.entries(stored));
  const window = {
    document: { createElement: () => ({}) },
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    BS_SOCIAL: account ? { isLoggedIn: () => true, accountName: () => account } : undefined,
    BS_PARTY_LINK: party ? { name: party } : null,
    BS_CAREER: career ? { get: () => ({ name: career }) } : undefined,
    Date: class extends Date { static now() { return now; } },
  };
  window.window = window;
  const source = await readFile(new URL('../public/assets/js/game-menu-v33.js', import.meta.url), 'utf8');
  vm.runInNewContext(source, window);
  return { api: window.BS_GAME_MENU, store };
}

test('a code typed with Arabic or Persian digits, spaces or dashes is read as six digits', async () => {
  const { api } = await menu();
  assert.equal(api.normalizeCode('١٢٣٤٥٦'), '123456');
  assert.equal(api.normalizeCode('۴۰۱ ۲۳۴'), '401234');
  assert.equal(api.normalizeCode('12-34 56'), '123456');
  assert.equal(api.normalizeCode('12345'), '');
  assert.equal(api.normalizeCode('1234567'), '');
});

test('the page and the server agree on which game every code belongs to', async () => {
  const { api } = await menu();
  for (const game of Object.keys(ROOM_FAMILIES)) {
    for (let i = 0; i < 20; i++) {
      const code = roomCodeFor(game);
      assert.equal(serverGameOfCode(code), game);
      assert.equal(api.gameOfCode(code), game, game + ' ' + code);
    }
  }
  assert.equal(api.roomUrl('quiz', '104321'), '/online?room=104321');
  assert.equal(api.roomUrl('snakes', '401234'), '/snakes?room=401234');
  assert.equal(api.roomUrl('jewels', '851234'), '/journey?game=jewels&room=851234');
  assert.equal(api.gameOfCode('991234'), 'survival');assert.equal(api.gameOfCode('091234'),null,'unused prefix stays invalid');
});

test('you play under your account name, then the party name, then your own guest name', async () => {
  assert.equal((await menu({ account: 'سعد', party: 'ضيف', career: 'لاعب الحلبة' })).api.playerName(), 'سعد');
  assert.equal((await menu({ party: 'نورة', career: 'لاعب الحلبة' })).api.playerName(), 'نورة');
  const guest = await menu({ career: 'لاعب العباقرة' });
  assert.equal(guest.api.playerName(), 'لاعب', 'the default career name is not a name');
  assert.equal(guest.api.setGuestName('  <ريم>  '), 'ريم');
  assert.equal(guest.store.get('bs-player-name-v33'), 'ريم');
});

test('your last match comes back for three hours, and never once it is finished', async () => {
  const { api, store } = await menu({ now: Date.now() });
  api.remember('snakes', '401234', { status: 'playing' });
  assert.equal(api.lastMatch().code, '401234');
  assert.equal(api.lastMatch().page, '/snakes?room=401234');
  api.remember('snakes', '401234', { status: 'finished' });
  assert.equal(api.lastMatch(), null);
  store.set('bs-last-match-v33', JSON.stringify({ game: 'zahra', code: '451234', status: 'lobby', at: Date.now() - 4 * 3600_000 }));
  assert.equal(api.lastMatch(), null, 'too old');
  api.remember('baloot', '601234');
  api.forget('baloot', '601234');
  assert.equal(api.lastMatch(), null);
});
