// 33.9.8: batch one — jackaroo swap from the base and landing holes that match the engine, a knock on
// captures, a compact reactions sheet that confirms, no name asked when signed in, and hockey hits
// decided by the striker's own page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as Jack from '../public/assets/js/engines/jackaroo-engine.js';
import { createGame, remoteHit, step, L } from '../public/assets/js/hockey/core.js';

const read = (file) => readFile(new URL('../' + file, import.meta.url), 'utf8');

test('jackaroo: both marbles on their own bases remain protected from swaps', () => {
  const s = Jack.createJackarooGame(['أ', 'ب', 'ج', 'د'], { arm: 19, home: 'fill' });
  s.turn = 0; s.players.forEach((p) => { p.marbles = [-1, -1, -1, -1]; });
  s.players[0].marbles[0] = 0; s.players[1].marbles[0] = 5; s.players[3].marbles[0] = 0; s.hands[0] = ['JS'];
  const swaps = Jack.getJackarooActions(s, 0).filter((a) => a.type === 'swap');
  assert.ok(!swaps.some((a) => a.marble === 0), 'your marble on its own base is protected');
  assert.ok(!swaps.some((a) => a.otherOwner === 3), 'a marble on its own base is protected');
});

test('jackaroo page: the knock sound is loaded and played for every capture', async () => {
  const [html, audio] = await Promise.all(['public/jackaroo.html', 'public/assets/js/audio-manager.js'].map(read));
  assert.match(audio, /samples\.knock='assets\/sounds\/fx-v33-9-3\/knock\.wav'/);
  assert.match(html, /BS_AUDIO\.prime\?\.\(\["knock"/);
  assert.match(html, /if \(caps\.length\) \{/);
});

test('reactions: the sheet closes on send and says it went', async () => {
  const [js, css] = await Promise.all(['public/assets/js/reactions-v31.js', 'public/assets/css/reactions-premium-v33-7.css'].map(read));
  assert.match(js, /toggle\(false\);sentNote\(it,target\)/);
  assert.match(js, /✓ انرسل/);
  assert.match(css, /\.rx-sent\{/);
});

test('names: signed in, the name fields hide', async () => {
  const social = await read('public/assets/js/social-client.js');
  assert.match(social, /box\.style\.display = name \? 'none' : ''/);
  for (const page of ['hockey', 'chaos', 'cipher', 'focus', 'reaction', 'wordbomb', 'billiards', 'jewels']) assert.match(await read('public/' + page + '.html'), /data-account-name/, page);
});

test('hockey: a page\'s word of its own strike is taken by the room, checked, and the room does not strike for it', () => {
  const g = createGame({ mode: 'two' }); g.phase = 'play'; g.remote = [true, true];
  g.puck.x = 300; g.puck.y = 900; g.puck.vx = 0; g.puck.vy = 0;
  // the striker sits on the puck: the room no longer moves it by itself
  g.strikers[0].x = g.strikers[0].tx = 300; g.strikers[0].y = g.strikers[0].ty = 960; step(g, 1 / 60);
  assert.equal(g.puck.vy, 0);
  const e = remoteHit(g, 0, { x: 300, y: 880, vx: 100, vy: -1500, strike: true }, 0);
  assert.equal(e.type, 'hit'); assert.equal(g.puck.vy, -1500);
  assert.equal(remoteHit(g, 0, { x: 300, y: 200, vx: 0, vy: -100 }, 0), false, 'not on the other half');
  assert.equal(remoteHit(g, 1, { x: 300, y: 880, vx: 0, vy: 9000 }, 0), false, 'not faster than a strike');
  assert.ok(L > 0);
});
