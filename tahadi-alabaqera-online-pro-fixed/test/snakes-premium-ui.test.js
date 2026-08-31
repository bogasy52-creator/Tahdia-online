import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const snakes = await readFile(new URL('../public/snakes.html', import.meta.url), 'utf8');
const sw = await readFile(new URL('../public/service-worker.js', import.meta.url), 'utf8');

test('snakes premium arcade UI exposes action HUD and player progress', () => {
  for (const marker of ['id="actionBanner"', 'id="actionFlash"', 'player-progress', 'actionFx(', 'launchConfetti(', 'snake-hit', 'ladder-hit']) {
    assert.ok(snakes.includes(marker), `missing premium UI marker: ${marker}`);
  }
});

test('PWA cache is bumped for the premium snakes release', () => {
  assert.match(sw, /CACHE_NAME\s*=\s*'busraj-games-v10'/);
});
