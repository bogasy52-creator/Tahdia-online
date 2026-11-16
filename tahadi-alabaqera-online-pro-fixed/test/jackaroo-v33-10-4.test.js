// 33.10.4: «سريع» for جاكارو and الزهرة, the reasons a marble cannot move, the burnt turn, the bigger board,
// and +2 on +2 of any colour in أونو.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createJackarooGame, teamWinner, jackarooWhyNot, jackarooEnterWhyNot, getJackarooActions, playJackarooAction } from '../public/assets/js/engines/jackaroo-engine.js';
import { createLudoGame, applyLudoMove } from '../public/assets/js/engines/ludo-engine.js';
import { tableVariant } from '../src/games/board-tables.js';
import * as Core from '../public/assets/js/engines/challenge-core.js';
import { unoLegal } from '../public/assets/js/engines/uno-core.js';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');
const table = (quick) => createJackarooGame(['أ', 'ب', 'ج', 'د'], { arm: 19, home: 'fill', quick, rng: () => 0.42 });

test('جاكارو «سريع»: the first marble of a team in its home wins the match for the team', () => {
  const quick = table(true), classic = table(false);
  assert.equal(quick.quick, true); assert.equal('quick' in classic, false);
  for (const s of [quick, classic]) s.players[1].marbles = [76, -1, -1, -1];
  assert.equal(teamWinner(quick), 1, 'one marble home is enough');
  assert.equal(teamWinner(classic), null, 'the classic table needs all of them');
  // played: a marble one step from its lane walks in and the match ends there
  const s = table(true);
  s.turn = 0; s.players[0].marbles = [74, -1, -1, -1]; s.hands[0] = ['2S', '9H', '8D', '3C'];
  const card = 0, action = getJackarooActions(s, card, 0).find((a) => a.type === 'move' && a.marble === 0);
  const after = playJackarooAction(s, card, action, 0);
  assert.equal(after.winnerTeam, 0);
});

test('the reasons a marble does not move name what is in the way', () => {
  const s = table(false);
  s.players[0].marbles = [5, 8, -1, -1];
  assert.deepEqual(jackarooWhyNot(s, 0, 0, 9), { why: 'own', player: 0, marble: 1 }, 'your own marble on the way');
  assert.equal(jackarooWhyNot(s, 0, 1, 9), null);
  s.players[1].marbles = [0, -1, -1, -1];
  const start = 19; s.players[0].marbles = [start - 3, -1, -1, -1];
  assert.deepEqual(jackarooWhyNot(s, 0, 0, 6), { why: 'locked', player: 1, marble: 0 }, 'a marble on its own start shuts the road');
  s.players[1].marbles = [-1, -1, -1, -1];
  s.players[0].marbles = [76, 70, -1, -1];
  assert.equal(jackarooWhyNot(s, 0, 1, 8).why, 'lane-own', 'a marble inside the home blocks the way in');
  s.players[0].marbles = [79, 70, -1, -1];
  assert.equal(jackarooWhyNot(s, 0, 1, 12).why, 'too-far');
  assert.equal(jackarooWhyNot(s, 0, 2, 3).why, 'yard');
  s.players[0].marbles = [0, -1, -1, -1];
  assert.deepEqual(jackarooEnterWhyNot(s, 0), { why: 'start-own', player: 0, marble: 0 });
});

test('the board says why: a burnt turn, your marble in the way, the start that is shut', async () => {
  const play = await read('public/assets/js/jackaroo-play-v33-8.js');
  assert.match(play, /jackarooWhyNot, jackarooEnterWhyNot/);
  assert.match(play, /انحرقت عليك هالدورة: اختر ورقة من يدك تنحرق/);
  assert.match(play, /ما تتعدى حجرك/); assert.match(play, /الطريق مقفول/); assert.match(play, /حجرك واقف على البداية/);
  assert.match(play, /classList\.add\('jk-blocker'\)/, 'the marble in the way blinks');
  const page = await read('public/jackaroo.html');
  assert.match(page, /حرقك بالعشرة: اختر ورقة من يدك تنحرق، وتروح عليك هالدورة/);
  assert.match(page, /classList\.toggle\("is-burnt"/);
  assert.match(page, /\{ id: "quick", label: "سريع ⚡"/);
  assert.match(page, /zoom: boardZoom\(\)/);
});

test('the board is drawn bigger on a phone and its marbles are drawn tokens', async () => {
  const petals = await read('public/assets/js/board-petals-v29.js');
  assert.match(petals, /export function fitJackarooViewport\(target,width,height,zoom=1\)/);
  assert.match(petals, /ratio=Math\.max\(\.25,Math\.min\(3,height\/width\/z\)\)/, 'everything stays round');
  assert.match(petals, /function jackToken\(defs,prefix,seat,R,style='glass'\)/);
  const bundles = JSON.parse(await read('scripts/style-bundles.json'));
  assert.equal(bundles['jackaroo.html'].at(-1), 'assets/css/jackaroo-v33-10-4.css');
  const css = await read('public/assets/css/jackaroo-v33-10-4.css');
  assert.match(css, /#actions:empty\{display:none!important\}/, 'no empty row under the cards');
});

test('الزهرة «سريع»: the first stone home wins; the rooms keep the way they were opened', () => {
  const quick = createLudoGame(['أ', 'ب'], { quick: true }), classic = createLudoGame(['أ', 'ب']);
  for (const s of [quick, classic]) { s.players[0].tokens = [50, -1, -1, -1]; }
  const q = applyLudoMove(quick, 0, 6 - (quick.players[0].tokens[0] + 6 - 56)), c = applyLudoMove(classic, 0, 6 - (classic.players[0].tokens[0] + 6 - 56));
  assert.equal(q.winner, 0); assert.equal(c.winner, null);
  assert.equal(tableVariant('jackaroo', 'quick'), 'quick'); assert.equal(tableVariant('zahra', 'quick'), 'quick');
  assert.equal(tableVariant('jackaroo', 'nonsense'), 'classic'); assert.equal(tableVariant('dice', 'quick'), 'classic');
  assert.equal(tableVariant('snakes', 'strategy'), 'strategy');
});

test('أونو: a +2 is answered with a +2 of any colour and passes on; +4 still lands in the classic table', () => {
  const players = Array.from({ length: 3 }, (_, i) => ({ id: 'p' + i, name: 'لاعب ' + i, bot: false }));
  const m = Core.createChallenge('chaos', players, 7, 1000, { unoMode: 'classic' }), u = m.uno;
  const card = (id, color, face) => ({ id, color, face });
  u.discard = [card('top', 'red', '5')]; u.color = 'red';
  u.hands = [[card('a', 'red', 'draw2'), card('x', 'red', '1')], [card('b', 'blue', 'draw2'), card('y', 'green', '7')], [card('z', 'green', '3'), card('w', 'blue', '4')]];
  Core.applyChallenge(m, 'p0', { type: 'play', card: 'a' }, 1100);
  assert.equal(u.pending, 2); assert.equal(u.turn, 1);
  assert.deepEqual(unoLegal(u, 1), ['b'], 'a +2 of another colour answers it, nothing else');
  Core.applyChallenge(m, 'p1', { type: 'play', card: 'b' }, 1200);
  assert.equal(u.pending, 4); assert.equal(u.turn, 2);
  assert.match(u.event.text || JSON.stringify(u.event), /ردّها/);
  Core.applyChallenge(m, 'p2', { type: 'draw' }, 1300);
  assert.equal(u.hands[2].length, 6); assert.equal(u.pending, 0); assert.equal(u.turn, 0);
});

test('the release is 33.10.4 or later with its notes', async () => {
  assert.match(JSON.parse(await read('package.json')).version, /^33\.(?:10\.(?:[4-9]|\d{2,})|(?:1[1-9]|[2-9]\d)\.\d+)$/);
  const notes = await read('RELEASE_V33_10_4_AR.md');
  for (const word of ['طور سريع', 'جاكارو', 'الزهرة', 'أونو', 'الدبابات', 'ما تتعدى حجرك', 'حرقك بالعشرة', 'صاروخ موجّه']) assert.match(notes, new RegExp(word));
  assert.doesNotMatch(notes, /بوت(?!ن)/);
  assert.match(await read('README-AR.md'), /RELEASE_V33_10_4_AR\.md/);
});
