// 33.9.2: the victim of a ten chooses the burned card, Jackaroo numbers sit outside the path and
// the board stays still, reactions keep their tiles under the finger, smoother hockey, one gold
// coin everywhere, and no sign anywhere that an opponent is automated.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createJackarooGame, getJackarooActions, playJackarooAction, jackarooNext } from '../public/assets/js/engines/jackaroo-engine.js';
import { chooseJackarooMove } from '../public/assets/js/engines/bot-strategy.js';

const read = (file) => readFile(new URL('../' + file, import.meta.url), 'utf8');

function tenTable() {
  const s = createJackarooGame(['أ', 'ب', 'ج', 'د'], { rng: () => 0.42 });
  const actor = s.turn, target = jackarooNext(s, actor);
  s.hands[actor] = ['10H', '3S'];
  s.hands[target] = ['AS', '5D', 'KC'];
  return { s, actor, target };
}

test('a ten asks the next player to choose which card burns', () => {
  const { s, actor, target } = tenTable();
  const burn = getJackarooActions(s, 0, actor).find((a) => a.type === 'burn');
  assert.ok(burn);
  const asked = playJackarooAction(s, 0, burn, actor);
  assert.deepEqual(asked.burnPick, { target, by: actor });
  assert.equal(asked.turn, target);
  assert.equal(asked.hands[target].length, 3, 'nothing burns until the player chooses');
  assert.deepEqual(getJackarooActions(asked, 0, actor), [], 'only the asked player may answer');
  assert.deepEqual(getJackarooActions(asked, 1, target), [{ type: 'burnPick' }]);
  const done = playJackarooAction(asked, 1, { type: 'burnPick' }, target);
  assert.deepEqual(done.hands[target], ['AS', 'KC']);
  assert.equal(done.burnPick, undefined);
  assert.equal(done.lastEvent.type, 'burnPick');
  assert.notEqual(done.turn, target, 'the burned player loses the turn');
});

test('the computer picks a card to burn when it is asked', () => {
  const { s, actor, target } = tenTable();
  const asked = playJackarooAction(s, 0, getJackarooActions(s, 0, actor).find((a) => a.type === 'burn'), actor);
  const move = chooseJackarooMove(asked, 'hard', () => 0.5);
  assert.equal(move.action.type, 'burnPick');
  assert.ok(asked.hands[target][move.cardIndex]);
});

test('Jackaroo numbers sit outside the path and the board does not jump', async () => {
  const petals = await read('public/assets/js/board-petals-v29.js');
  assert.match(petals, /data-seat-ring/);
  assert.doesNotMatch(petals, /trackHole/);
  const fit = await read('public/assets/js/board-fit-pro.js');
  assert.match(fit, /Math\.min\(r\.height,r\.width\)/);
  const css = await read('public/assets/css/jackaroo-v33-9.css');
  assert.match(css, /#actions[^}]*height:46px/);
  assert.match(css, /:empty\{visibility:hidden\}/);
  const page = await read('public/jackaroo.html');
  assert.match(page, /احرقها/);
});

test('reactions only rebuild their grid when something visible changes', async () => {
  const rx = await read('public/assets/js/reactions-v31.js');
  assert.match(rx, /gridKey/);
});

test('no word, mark or icon tells a player the opponent is automated', async () => {
  const files = ['public/assets/js/hockey/main.js', 'public/hockey.html', 'public/assets/js/billiards/main.js', 'public/assets/js/challenge-client.js', 'public/assets/js/player-card-v33-7.js', 'public/online.html', 'src/challenges/challenge-room.js', 'public/assets/css/hockey-v33-8.css'];
  for (const file of files) {
    const text = await read(file);
    assert.doesNotMatch(text, /منافس آلي|رجل آلي|لاعب آلي|'آلي'|بوت(?!ن)/, file);
  }
  assert.doesNotMatch(await read('public/assets/css/hockey-v33-8.css'), /data-bot=true/);
});

test('hockey glides the opponent between updates', async () => {
  assert.match(await read('public/assets/js/hockey/main.js'), /1-Math\.exp\(-dt\*22\)/);
});

test('one gold coin everywhere and tidy balances', async () => {
  const css = await read('public/assets/css/game-interaction-v34.css');
  assert.match(css, /--bs-coin:url\("data:image\/svg\+xml/);
  assert.match(css, /\.coin-chip \[data-career-coins\]::before/);
  assert.match(css, /\.sx-coin/);
  for (const file of ['public/assets/js/shop.js', 'public/assets/js/shop-v31.js', 'public/assets/js/atelier-shop-v30.js', 'public/assets/js/baloot-tables.js', 'public/assets/js/pro-experience.js', 'public/index.html']) assert.doesNotMatch(await read(file), /◈/, file);
  assert.match(await read('public/assets/js/career-client.js'), /toLocaleString\('en-US'\)/);
});

test('the release is 33.9.2 or later with its notes', async () => {
  assert.match(JSON.parse(await read('package.json')).version, /^33\.(?:9\.(?:[2-9]|\d{2,})|\d{2,}\.\d+)$/);
  const notes = await read('RELEASE_V33_9_2_AR.md');
  for (const word of ['جاكارو', 'تختار الورقة', 'خارج المسار', 'الفيسات', 'الهوكي', 'العملات']) assert.match(notes, new RegExp(word));
  assert.doesNotMatch(notes, /بوت(?!ن)/);
  assert.doesNotMatch(notes, /السلم والثعبان/);
  assert.match(await read('README-AR.md'), /RELEASE_V33_9_2_AR\.md/);
});
