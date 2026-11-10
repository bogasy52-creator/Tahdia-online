// 33.9.7: part five fixes — jackaroo gate hole, glass marbles, fixed board, capture effect, emote
// names, a softer turn sound; the player bar with paid changes; a straight hockey puck; the bright
// jewels skin.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as Jack from '../public/assets/js/engines/jackaroo-engine.js';

const read = (file) => readFile(new URL('../' + file, import.meta.url), 'utf8');

test('jackaroo: the hole before home is stepped over by its owner, not by an opponent five', () => {
  const s = Jack.createJackarooGame(['أ', 'ب', 'ج', 'د'], { arm: 19, home: 'fill' });
  s.turn = 0; s.players[0].marbles = [72, -1, -1, -1];
  s.hands[0] = ['3S'];
  const a = Jack.getJackarooActions(s, 0).find((x) => x.type === 'move' && x.marble === 0);
  assert.ok(a, 'a three from 15 goes home');
  const next = Jack.playJackarooAction(s, 0, a);
  assert.equal(next.players[0].marbles[0], 76, '15 → 16, 17, then the first home hole');
});

test('jackaroo page: fixed board, capture shake and red flash, the emote target name, soft turn sound', async () => {
  const [css, html, online, audio] = await Promise.all(['public/assets/css/jackaroo-v33-9.css', 'public/jackaroo.html', 'public/assets/js/board-online.js', 'public/assets/js/audio-manager.js'].map(read));
  assert.match(css, /--jk-n:5!important/); assert.match(css, /@keyframes jkShake/); assert.match(css, /jk-hit-me::after/);
  assert.match(html, /انشال حجرك!/);
  assert.match(online, /msg\.to\?\{to:msg\.to\}/);
  assert.match(audio, /yourTurn-soft\.wav/);
});

test('profile: the player bar replaces the brand and changes cost coins after the first', async () => {
  const [pro, user] = await Promise.all(['public/assets/js/profile-pro-v33-9-4.js', 'src/social/social-user.js'].map(read));
  assert.match(pro, /function renderBar/); assert.match(pro, /function openProfile/);
  assert.match(user, /export const CHANGE_PRICE = 250;/);
});

test('hockey: spin no longer bends the puck path', async () => {
  const core = await read('public/assets/js/hockey/core.js');
  assert.doesNotMatch(core, /p\.vx \+= p\.spin \* p\.vy/);
});

test('jewels: the bright skin with plates, VS coin and a booster bar', async () => {
  const [html, css] = await Promise.all(['public/jewels.html', 'public/assets/css/jewels-v33-9-5.css'].map(read));
  assert.match(html, /mm-skin/); assert.match(html, /class="jw-hud"/); assert.match(html, /id="jwBoostBar"/);
  assert.match(css, /body\.jewels-page\.mm-skin/);
});
