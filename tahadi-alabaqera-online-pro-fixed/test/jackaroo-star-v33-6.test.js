// 33.6.0: the Jackaroo board of the photo — an octagon with a neon edge in every player's colour,
// a star-shaped walk with eighteen numbered holes to every seat, the home lane in each corner
// finger, the yard (a plus of four holes) by each start, every player's portrait and name on their
// own side, and the last three cards played face up in the middle. Several looks, one board.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { boardGeometry } from '../public/assets/js/engines/board-geometry-v29.js';
import * as Jack from '../public/assets/js/engines/jackaroo-engine.js';
import { chooseJackarooMove } from '../public/assets/js/engines/bot-strategy.js';
import { createDOM } from './dom-harness.mjs';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');
const seeded = (s) => { let x = s >>> 0; return () => { x += 0x6D2B79F5; let t = x; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };

test('a table of four has eighteen holes to every seat; six seats and older games keep thirteen', () => {
  const four = Jack.createJackarooGame(['أ', 'ب', 'ج', 'د'], { arm: Jack.jackarooArm(4) });
  assert.equal(four.arm, 18);
  assert.deepEqual(boardGeometry(four).starts, [0, 18, 36, 54]);
  assert.equal(boardGeometry(four).track, 72); assert.equal(boardGeometry(four).finish, 76);
  const six = Jack.createJackarooGame(Array.from({ length: 6 }, (_, i) => 'P' + i), { arm: Jack.jackarooArm(6) });
  assert.equal(six.arm, 13); assert.equal(boardGeometry(six).track, 78);
  assert.equal('arm' in Jack.createJackarooGame(Array.from({ length: 6 }, (_, i) => 'P' + i), { arm: 18 }), false, 'six seats never take the big board');
  const old = Jack.createJackarooGame(['أ', 'ب', 'ج', 'د']);
  assert.equal(boardGeometry(old).track, 52, 'a game saved before the update plays on as it was');
  assert.equal(boardGeometry({ players: [{}, {}, {}, {}], arm: 99 }).track, 52, 'a strange arm is ignored');
});

test('on the big board a marble goes round eighteen holes a seat and enters its own lane', () => {
  const s = Jack.createJackarooGame(['أ', 'ب', 'ج', 'د'], { arm: 18 });
  s.turn = 0; s.hands[0] = ['3S']; s.players[0].marbles = [70, -1, -1, -1];
  const move = Jack.getJackarooActions(s, 0).find((a) => a.type === 'move');
  const next = Jack.playJackarooAction(s, 0, move);
  assert.equal(next.players[0].marbles[0], 73, 'two holes round, then the second hole of the lane');
  // seat 1 starts at hole 18: a marble of seat 1 at its start sits on global hole 18
  assert.equal(Jack.globalJackarooPosition(1, 0, s), 18);
  // the computer finishes games on the big board
  for (let g = 1; g <= 4; g++) {
    const rng = seeded(g * 101); let t = Jack.createJackarooGame(['أ', 'ب', 'ج', 'د'], { rng, arm: 18 }), n = 0;
    while (t.winnerTeam === null && n < 2000) { const m = chooseJackarooMove(t, 'medium', rng); t = Jack.playJackarooAction(t, m.cardIndex, m.action); n++; }
    assert.notEqual(t.winnerTeam, null, 'game ' + g + ' ends');
  }
});

test('the rooms deal the big board, and the middle shows the last three cards played', async () => {
  assert.match(await read('src/games/board-tables.js'), /if \(game === 'jackaroo'\) return createJackarooGame\(names, \{ rng, arm: jackarooArm\(names\.length\) \}\);/);
  const worker = await read('src/index.js');
  assert.match(worker, /state\.discard = \(state\.discard \|\| \[\]\)\.map\(\(card, i, all\) => \(i >= all\.length - 3 \? card : "\?"\)\);/);
  assert.match(worker, /state\.deck = Array\(state\.deck\?\.length \|\| 0\)\.fill\("\?"\);/, 'the deck stays hidden');
  // the page loads the engine and its geometry at the same new address as the board
  const page = await read('public/jackaroo.html');
  assert.match(page, /engines\/jackaroo-engine\.js\?v=33\.\d+\.\d+"/);
  assert.match(await read('public/assets/js/engines/jackaroo-engine.js'), /from '\.\/board-geometry-v29\.js\?v=33\.\d+\.\d+'/);
  assert.match(await read('public/assets/js/board-petals-v29.js'), /from '\.\/engines\/board-geometry-v29\.js\?v=33\.\d+\.\d+'/);
});

async function board(state, options) {
  const h = await createDOM('jackaroo.html', { ...Jack });
  const target = h.doc.createElement('div');
  h.context.__args = { target, state, options };
  vm.runInContext('renderPetalBoard(__args.target,__args.state,__args.options)', h.context);
  const circles = (sel) => target.querySelectorAll(sel).map((c) => ({ x: +c.getAttribute('cx'), y: +c.getAttribute('cy'), r: +c.getAttribute('r') }));
  return { h, target, circles, svg: target.querySelector('svg') };
}
const sample = (seats, arm) => ({ turn: 1, ...(arm ? { arm } : {}), discard: ['?', '5D', '8S', 'JH'], lastEvent: { card: 'JH' }, players: Array.from({ length: seats }, (_, i) => ({ name: ['سعد', 'نورة', 'ماجد', 'فاطمة', 'خالد', 'ريم'][i], marbles: [i, -1, -1, -1] })) });
const apart = (a, b, gap) => a.every((p) => b.every((q) => Math.hypot(p.x - q.x, p.y - q.y) >= p.r + q.r + gap));

for (const [seats, arm] of [[4, 18], [4, 13], [6, 13]]) {
  test(`the ${seats}-seat star board with ${arm} holes a seat: numbered holes, lanes, yards and seats that never touch`, async () => {
    const { target, circles, svg } = await board(sample(seats, arm === 13 && seats === 4 ? 0 : arm), { game: 'jackaroo', viewer: 0, look: 'neon', avatars: ['fox', 'robot', 'princess', 'fairy', 'viking', 'samurai'].slice(0, seats).map((hero) => '/assets/characters-v33/portraits/' + hero + '.webp') });
    assert.equal(svg.getAttribute('data-arm'), String(arm));
    const track = circles('[data-track]'), lanes = circles('[data-home]'), cups = circles('[data-finish-cup]');
    assert.equal(track.length, seats * arm); assert.equal(lanes.length, seats * 4); assert.equal(cups.length, seats);
    // every seat's quarter is numbered 1..arm, starting at its own start
    const numbers = target.querySelectorAll('[data-track-number]').map((t) => Number(t.textContent));
    for (let n = 1; n <= arm; n++) assert.equal(numbers.filter((x) => x === n).length, seats, 'number ' + n);
    // the yards: four holes each, by the seat
    const yards = target.querySelectorAll('[data-pocket]');
    assert.equal(yards.length, seats);
    const yardHoles = yards.flatMap((g) => g.querySelectorAll('circle').filter((c) => !c.getAttribute('data-avatar')).map((c) => ({ x: +c.getAttribute('cx'), y: +c.getAttribute('cy'), r: +c.getAttribute('r') })).filter((c) => c.r < 4));
    assert.ok(yardHoles.length >= seats * 4);
    // nothing sits on top of anything else
    assert.ok(apart(lanes, track, .8), 'the lanes clear the walk');
    assert.ok(apart(cups, track, .8), 'the cups clear the walk');
    assert.ok(apart(yardHoles, track, .8), 'the yards clear the walk');
    assert.ok(apart(yardHoles, lanes, .8), 'the yards clear the lanes');
    for (let i = 0; i < track.length; i++) for (let j = i + 1; j < track.length; j++) assert.ok(Math.hypot(track[i].x - track[j].x, track[i].y - track[j].y) >= track[i].r + track[j].r + .4, `holes ${i} and ${j}`);
    // every player's portrait and name on their side
    assert.equal(target.querySelectorAll('[data-avatar]').length, seats);
    assert.equal(target.querySelectorAll('[data-name-plate]').length, seats);
    assert.ok(target.querySelectorAll('[data-avatar] image').length === seats, 'the characters, not letters');
    // the middle: the last three cards played, the newest with what it does
    assert.equal(target.querySelector('[data-pile-cards]').getAttribute('data-pile-cards'), '3');
    assert.ok(target.querySelector('[data-pile-act="swap"]'), 'the jack swaps');
    assert.equal(target.querySelectorAll('[data-quarter]').length, seats);
  });
}

test('your side is the bottom one: the board turns for every seat and the writing stays upright', async () => {
  for (const [seat, rot] of [[0, 180], [1, 90], [2, 0], [3, -90]]) {
    const { target } = await board(sample(4, 18), { game: 'jackaroo', viewer: seat, look: 'neon' });
    assert.equal(Number(target.querySelector('[data-board-root]').getAttribute('data-rot')), rot, 'seat ' + seat);
    if (rot) {
      const label = target.querySelector('[data-track-number]');
      assert.match(label.getAttribute('transform'), new RegExp(`^rotate\\(${-rot} `), 'numbers turn back upright');
      assert.match(target.querySelector('[data-pile-cards]').getAttribute('transform'), new RegExp(`^rotate\\(${-rot} 100\\.00 100\\.00\\)`));
    }
  }
});

test('several looks on one board; the shop tables bring their own; royal and majlis come with their tables', async () => {
  const board33 = await read('public/assets/js/board-petals-v29.js');
  for (const look of ['neon', 'carbon', 'ivory', 'emerald', 'royal', 'majlis']) {
    assert.match(board33, new RegExp(`  ${look}:\\{base:`), look);
    const { svg } = await board(sample(4, 18), { game: 'jackaroo', viewer: 0, look });
    assert.equal(svg.getAttribute('data-look'), look);
  }
  assert.match(board33, /const LOOK_OF=\{walnut:'emerald',club:'emerald',jade:'emerald',ivory:'ivory',carbon:'carbon',reactor:'carbon',royal:'royal',majlis:'majlis'\};/);
  assert.match(board33, /export const JACK_LOOKS=Object\.freeze\(\[\['neon','نيون'\],\['carbon','كربون'\],\['ivory','عاجي'\],\['emerald','زمردي'\],\['royal','ملكي','table-royal'\],\['majlis','مجلس','table-majlis'\]\]\);/);
  // the shop's preview of a table shows that table's look
  const { svg } = await board(sample(4, 18), { game: 'jackaroo', material: 'table-royal', preview: true });
  assert.equal(svg.getAttribute('data-look'), 'royal');
  const { h } = await board(sample(4, 18), { game: 'jackaroo' });
  assert.equal(vm.runInContext('jackLookOpen("royal")', h.context), false, 'royal waits for its table');
  assert.equal(vm.runInContext('jackLookOpen("ivory")', h.context), true);
  assert.equal(vm.runInContext('jackLook()', h.context), 'neon', 'everyone starts on neon');
});

test('the page: portraits on the board, the look picker on the menu and in the game, the board straight', async () => {
  const page = await read('public/jackaroo.html');
  assert.match(page, /avatars: state\.players\.map\(\(_, i\) => seatLook\(room, i\)\.character\),/);
  assert.match(page, /<div id="jackLooks" class="jk-looks" role="radiogroup" aria-label="شكل اللوحة">/);
  assert.match(page, /<button id="jackLookNext" class="bs-btn jk-look-next" type="button" aria-label="غيّر شكل اللوحة">🎨<\/button>/);
  assert.match(page, /\{ game: "jackaroo", preview: true, active: -1, viewer: 0, avatars: \["fox", "princess", "robot", "fairy"\], look: jackLook\(\) \}/);
  assert.match(await read('public/assets/js/jackaroo-cards.js'), /window\.BS_JACK_CARDS = Object\.freeze\(\{ INFO, ORDER, ICON, face, legend, info, rankOf \}\);/);
  const css = await read('public/assets/css/jackaroo-v33-6.css');
  assert.match(css, /body\.game-jackaroo \.tbl-hero-art\{transform:none;/);
  assert.match(css, /body\.game-jackaroo \.jack-board\{background:none!important;/);
  assert.ok(JSON.parse(await read('scripts/style-bundles.json'))['jackaroo.html'].includes('assets/css/jackaroo-v33-6.css'));
  assert.match(await read('public/assets/css/app-jackaroo.css'), /\.jk-looks-row\{/);
  // the menu draws the board with the page's own looks
  const h = await createDOM('jackaroo.html', { ...Jack });
  await h.runInline('');
  assert.ok(h.doc.querySelector('#tblHeroArt svg[data-arm="18"]'));
  assert.equal(h.doc.querySelectorAll('#jackLooks .jk-look').length, 6);
  assert.equal(h.doc.querySelectorAll('#jackLooks .jk-look.is-locked').length, 2);
});
