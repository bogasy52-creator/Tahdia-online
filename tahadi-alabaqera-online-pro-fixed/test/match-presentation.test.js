import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../public/', import.meta.url);
const pages = ['memory','reaction','logic','puzzle','draw','secret','order','auction','cipher','local','online','spotdiff','snakes','zahra','jackaroo','dice','letters'];

test('every game applies equipped cosmetics and account progress', async () => {
  for (const page of pages) {
    const html = await readFile(new URL(`${page}.html`, root), 'utf8');
    assert.match(html, /assets\/js\/store-catalog\.js/, `${page} misses catalog`);
    assert.match(html, /assets\/css\/match-presentation\.css/, `${page} misses presentation styles`);
    assert.match(html, /assets\/js\/match-presentation\.js/, `${page} misses presentation runtime`);
    assert.match(html, /assets\/js\/social-client\.js/, `${page} misses account sync`);
  }
});

test('professional match presentation uses equipped table, avatar, frame, entrance and victory', async () => {
  const source = await readFile(new URL('assets/js/match-presentation.js', root), 'utf8').catch(() => '');
  assert.match(source, /TAHADI_PROGRESS/);
  for (const category of ['table','avatar','frame','entrance','victory']) assert.match(source, new RegExp(`equipped\\.${category}`));
  assert.match(source, /showEntrance/);
  assert.match(source, /showVictory/);
  assert.match(source, /tahadi-award/);
  assert.match(source, /MutationObserver/);
});

test('equipped sound pack changes the audio performance profile', async () => {
  const source = await readFile(new URL('assets/js/audio-manager.js', root), 'utf8');
  assert.match(source, /equippedSoundPack/);
  for (const profile of ['classic','arcade','royal','cyber','calm']) assert.match(source, new RegExp(`${profile}:`));
});

test('professional overlays provide countdown, skip, actions, completion, and cleanup', async () => {
  const source = await readFile(new URL('assets/js/match-presentation.js', root), 'utf8');
  assert.match(source, /tahadi-fx-countdown/);
  assert.match(source, /data-fx-skip/);
  assert.match(source, /data-fx-replay/);
  assert.match(source, /options\.onComplete/);
  assert.match(source, /cleanup/);
});

test('online results save progress without presenting a loss as a victory', async () => {
  const presentation = await readFile(new URL('assets/js/match-presentation.js', root), 'utf8');
  assert.doesNotMatch(presentation, /\.winner-overlay,\.sd-over,#qmFinished,#resultPanel/);
  for (const page of ['snakes', 'zahra', 'jackaroo', 'spotdiff']) {
    const html = await readFile(new URL(`${page}.html`, root), 'utf8');
    assert.match(html, /onlineAwarded/);
    assert.match(html, /TAHADI_PROGRESS\?\.award/);
    assert.match(html, /eventId:`online:/);
  }
  const quick = await readFile(new URL('assets/js/quick-match-game.js', root), 'utf8');
  const finished = quick.match(/function renderFinished[\s\S]*?\n}\n\nfunction failArena/)?.[0] || '';
  assert.match(finished, /TAHADI_PROGRESS\?\.award/);
  assert.match(finished, /eventId: `online:quiz:/);
});
