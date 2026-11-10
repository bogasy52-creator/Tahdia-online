// 33.7.0: the Jackaroo board of the user's picture — a plus-shaped walk with nineteen places a
// seat (the house and the holes 1..18), four lane holes that fill up, the yard by each start,
// every player's face on their own side, the board turned so your side is the bottom one;
// seven looks to buy in the shop (لوحات الجاكارو); new card faces drawn as SVG.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { boardGeometry } from '../public/assets/js/engines/board-geometry-v29.js';
import * as Jack from '../public/assets/js/engines/jackaroo-engine.js';
import { chooseJackarooMove } from '../public/assets/js/engines/bot-strategy.js';
import '../public/assets/js/profile-core.js';
import { createDOM } from './dom-harness.mjs';

const Career = globalThis.BS_CAREER_CORE;
const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');
const seeded = (s) => { let x = s >>> 0; return () => { x += 0x6D2B79F5; let t = x; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
const picture = (marbles = [[0, -1, -1, -1], [-1, -1, -1, -1], [-1, -1, -1, -1], [-1, -1, -1, -1]]) => ({ turn: 1, arm: 19, home: 'fill', discard: ['5D', '8S', 'JH'], lastEvent: { card: 'JH' }, players: marbles.map((m, i) => ({ name: ['سعد', 'نورة', 'ماجد', 'فاطمة'][i], marbles: m })) });

async function board(state, options) {
  const h = await createDOM('jackaroo.html', { ...Jack });
  const target = h.doc.createElement('div');
  h.context.__args = { target, state, options };
  vm.runInContext('renderPetalBoard(__args.target,__args.state,__args.options)', h.context);
  const circles = (sel) => target.querySelectorAll(sel).map((c) => ({ x: +c.getAttribute('cx'), y: +c.getAttribute('cy'), r: +c.getAttribute('r') }));
  return { h, target, circles, svg: target.querySelector('svg') };
}

test('the walk of the picture: a house and holes 1 to 18 for every seat, lanes of four, yards by the start', async () => {
  const { target, circles, svg } = await board(picture(), { game: 'jackaroo', viewer: 0, look: 'neon', avatars: ['fox', 'robot', 'princess', 'fairy'] });
  assert.equal(svg.getAttribute('data-arm'), '19');
  const holes = circles('[data-track]:not([data-house])'), houses = target.querySelectorAll('[data-house]');
  assert.equal(holes.length + houses.length, 76, 'nineteen places a seat');
  assert.equal(houses.length, 4, 'the start of every seat is its house');
  const numbers = target.querySelectorAll('[data-track-number]').map((t) => Number(t.textContent));
  for (let n = 1; n <= 18; n++) assert.equal(numbers.filter((x) => x === n).length, 4, 'number ' + n);
  assert.equal(target.querySelectorAll('[data-home]').length, 16, 'four lane holes a seat');
  assert.equal(target.querySelectorAll('[data-finish-cup]').length, 0, 'the lane itself is home: no cup');
  assert.equal(target.querySelectorAll('[data-pocket]').length, 4);
  // the holes never touch
  for (let i = 0; i < holes.length; i++) for (let j = i + 1; j < holes.length; j++) assert.ok(Math.hypot(holes[i].x - holes[j].x, holes[i].y - holes[j].y) >= holes[i].r + holes[j].r + .4, `holes ${i} and ${j}`);
  // every player's face and name on their side, a tap away from their card
  const tags = target.querySelectorAll('[data-player-tag]');
  assert.equal(tags.length, 4);
  assert.deepEqual(tags.map((t) => t.getAttribute('data-player-tag')).sort(), ['0', '1', '2', '3']);
  assert.ok(tags.every((t) => t.getAttribute('role') === 'button' && /^ملف /.test(t.getAttribute('aria-label'))));
  // the middle: the last three cards played
  assert.equal(target.querySelector('[data-pile-cards]').getAttribute('data-pile-cards'), '3');
});

test('every seat sees its own side at the bottom; numbers and faces stay upright', async () => {
  for (const [seat, rot] of [[0, 0], [1, -90], [2, 180], [3, 90]]) {
    const { target } = await board(picture(), { game: 'jackaroo', viewer: seat, look: 'gold' });
    assert.equal(Number(target.querySelector('[data-board-root]').getAttribute('data-rot')), rot, 'seat ' + seat);
    if (rot) assert.match(target.querySelector('[data-track-number]').getAttribute('transform'), new RegExp(`^rotate\\(${-rot} `));
    // the faces are drawn outside the turned board
    assert.ok(target.querySelector('[data-layer="players"] [data-player-tag]'));
  }
});

test('seven looks, one board: neon is everyone\'s, the other six are bought in the shop', async () => {
  const src = await read('public/assets/js/board-petals-v29.js');
  assert.match(src, /export const JACK_LOOKS=Object\.freeze\(\[\['neon','نيون','jboard-neon'\],\['gold','ذهب','jboard-gold'\],\['emerald','زمرد','jboard-emerald'\],\['marble','رخام','jboard-marble'\],\['carbon','كربون','jboard-carbon'\],\['royal','قصر','jboard-royal'\],\['majlis','مجلس','jboard-majlis'\]\]\);/);
  for (const look of ['neon', 'gold', 'emerald', 'marble', 'carbon', 'royal', 'majlis']) {
    const { svg } = await board(picture(), { game: 'jackaroo', viewer: 0, look });
    assert.equal(svg.getAttribute('data-look'), look);
  }
  const boards = Career.CATALOG.filter((i) => i.type === 'jboard');
  assert.deepEqual(boards.map((i) => i.id), ['jboard-neon', 'jboard-gold', 'jboard-emerald', 'jboard-marble', 'jboard-carbon', 'jboard-royal', 'jboard-majlis']);
  assert.equal(boards.find((i) => i.id === 'jboard-neon').price, 0);
  assert.ok(boards.filter((i) => i.id !== 'jboard-neon').every((i) => i.price >= 400), 'the others cost coins');
  assert.ok(boards.every((i) => Career.STOREFRONT.includes(i.id)), 'all of them are on the shelf');
  assert.ok(Career.SLOTS.includes('jboard'));
  const fresh = Career.normalize({});
  assert.equal(fresh.equipped.jboard, 'jboard-neon');
  // a table bought before 33.7.0 brings its Jackaroo board along
  const old = Career.normalize({ owned: ['table-royal', 'table-majlis'] });
  assert.ok(old.owned.includes('jboard-royal') && old.owned.includes('jboard-majlis'));
  const shop = await read('public/assets/js/shop-v31.js');
  assert.match(shop, /\['jboard','لوحات الجاكارو','🎯',/);
});

test('the lane fills up: one marble a hole, no jumping over your own marbles, and the bots still finish', () => {
  const s = Jack.createJackarooGame(['أ', 'ب', 'ج', 'د'], { arm: 19, home: 'fill' });
  const g = boardGeometry(s);
  assert.equal(g.track, 76); assert.equal(g.finish, 79);
  s.turn = 0; s.players[0].marbles = [74, 77, -1, -1];
  const moves = (card) => { s.hands[0] = [card]; return Jack.getJackarooActions(s, 0).filter((a) => a.type === 'move' && a.owner === 0); };
  assert.ok(moves('AS').some((a) => a.marble === 0 && a.steps === 1), '74 → the first lane hole (the gate hole is stepped over)');
  assert.ok(!moves('2S').some((a) => a.marble === 0), 'the second hole is taken by your own marble');
  assert.ok(!moves('4S').some((a) => a.marble === 0 && !a.backward), 'no jumping over your own marble in the lane');
  assert.ok(moves('2S').some((a) => a.marble === 1), 'a marble in the lane can still go deeper');
  assert.equal(Jack.jackarooHome(s, 76), true); assert.equal(Jack.jackarooHome(s, 75), false);
  for (let game = 1; game <= 6; game++) {
    const rng = seeded(game * 977); let t = Jack.createJackarooGame(['أ', 'ب', 'ج', 'د'], { rng, arm: 19, home: 'fill' }), n = 0;
    while (t.winnerTeam === null && n < 3000) { const m = chooseJackarooMove(t, 'hard', rng); t = Jack.playJackarooAction(t, m.cardIndex, m.action); n++; }
    assert.notEqual(t.winnerTeam, null, 'game ' + game + ' ends');
    const winners = t.players.filter((_, i) => i % 2 === t.winnerTeam);
    for (const p of winners) { assert.ok(p.marbles.every((m) => m >= 76 && m <= 79)); assert.equal(new Set(p.marbles).size, 4, 'one marble a hole'); }
  }
});

test('the cards of the picture: white faces drawn as SVG, a crown, a circlet and a cap for the courts', async () => {
  const src = await read('public/assets/js/jackaroo-cards.js');
  const h = await createDOM('jackaroo.html', { ...Jack });
  await h.runFile('assets/js/jackaroo-cards.js');
  const cards = h.context.BS_JACK_CARDS;
  for (const card of ['AH', '10S', 'JC', 'QD', 'KS', 'back']) assert.match(cards.url(card), /^data:image\/svg\+xml/, card);
  assert.equal(cards.url('JH'), cards.url('JH'), 'drawn once, then kept');
  const svg = decodeURIComponent(cards.url('JH').split(',')[1]);
  assert.match(svg, /fill="#e0b54a" stroke="#9b7a24"/, 'the court is drawn in gold');
  assert.doesNotMatch(src, /rank === 'J' \? 'none'/, 'the jack is no longer an outline');
});

test('each Jackaroo yard sits to the local left of its own nearby house', async () => {
  const { target } = await board(picture(), { game: 'jackaroo', viewer: 0, look: 'neon' });
  const houses=target.querySelectorAll('[data-house]');
  for(let seat=0;seat<4;seat++){
    const house=houses.find(n=>Number(n.getAttribute('data-house'))===seat);
    const circles=target.querySelector('[data-pocket="'+seat+'"]').querySelectorAll('circle');
    const x=circles.reduce((n,c)=>n+Number(c.getAttribute('cx')),0)/4-Number(house.getAttribute('cx'));
    const y=circles.reduce((n,c)=>n+Number(c.getAttribute('cy')),0)/4-Number(house.getAttribute('cy'));
    const localX=x*Math.cos(seat*Math.PI/2)+y*Math.sin(seat*Math.PI/2);
    assert.ok(localX< -12,'yard '+seat+' is on the left');
    assert.ok(Math.hypot(x,y)<35,'yard '+seat+' stays near its house');
  }
});

test('viewport fitting leaves the animated stone container free to move', async () => {
 const {h,target}=await board(picture(),{game:'jackaroo',viewer:1,look:'neon'});
 h.context.__target=target;
 vm.runInContext('fitJackarooViewport(__target,390,720)',h.context);
 const pieces=target.querySelectorAll('[data-stone]');
 assert.equal(pieces.length,16);
 for(const piece of pieces){
  assert.match(piece.getAttribute('transform'),/^translate\(/);
  assert.doesNotMatch(piece.getAttribute('transform'),/scale/);
  assert.ok(piece.querySelector('[data-viewport-piece]'));
 }
});
