// 33.9.0: Baloot (Sun over a Hokm before a double, «كوش», the Hokm mark in its true colour), Jackaroo
// (the turn to the right, the locked house, play on the board), hockey under the finger, faces and
// moves between two players, UNO's cards, the carrom and picture race screens, and billiards.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { Career } from '../src/career/core.js';
import { createBalootMatch, applyBalootAction, biddingOptions, canKosh } from '../public/assets/js/engines/baloot-engine.js';
import { createJackarooGame, jackarooNext, jackarooRoadShut, getJackarooActions, jackarooArm } from '../public/assets/js/engines/jackaroo-engine.js';
import { JK_LOCK } from '../public/assets/js/jackaroo-play-v33-8.js';
import { HAND_SPEED, createGame, step } from '../public/assets/js/hockey/core.js';

const read = (file) => readFile(new URL('../' + file, import.meta.url), 'utf8');
const seeded = (seed = 9) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

test('the release is 33.9.0 with its notes', async () => {
  const pkg = JSON.parse(await read('package.json'));
  assert.equal(pkg.version, '33.9.0');
  const notes = await read('RELEASE_V33_9_AR.md');
  for (const word of ['البلوت', 'الجاكارو', 'الهوكي', 'الفيسات', 'أونو', 'الكيرم', 'سباق الصور', 'بلياردو']) assert.match(notes, new RegExp(word));
  assert.doesNotMatch(notes, /بوت(?!ن)/);
  assert.doesNotMatch(notes, /السلم والثعبان/);
});

test('Baloot: the Hokm mark is the cards\' own suit, red or black as on the cards, everywhere it shows', async () => {
  const [ui, css, bundle, page] = await Promise.all([read('public/assets/js/baloot-table.js'), read('public/assets/css/baloot-v33-9.css'), read('public/assets/css/app-baloot.css'), read('scripts/style-bundles.json')]);
  const fn = ui.slice(ui.indexOf('function suitHtml('), ui.indexOf('/* ---------- Seats ---------- */'));
  assert.match(fn, /BS_CARDS\?\.suitPath\?\.\(suit\)/);
  assert.match(fn, /data-suit="\$\{suit\}"/);
  assert.match(fn, /RED\[suit\] \? 'red suit-red' : 'suit-black'/);
  assert.match(fn, /aria-label="\$\{SUIT_SAY\[suit\] \|\| ''\}"/);
  assert.match(ui, /اشترى حكم \$\{suitHtml\(view\.bidding\.hokm\.suit\)\}/);
  // the colour no longer comes from the bubble's or the banner's dark text
  assert.match(css, /\.suit\[data-suit\]\{--suit:#17181d;[^}]*color:var\(--suit\)!important/);
  assert.match(css, /\.suit\[data-suit\]\.suit-red\{--suit:#cc1b34\}/);
  assert.ok(bundle.includes('.suit[data-suit].suit-red{--suit:#cc1b34}'));
  assert.ok(JSON.parse(page)['baloot.html'].includes('assets/css/baloot-v33-9.css'));
});

test('Baloot: «كوش» with five low cards and no three in a row; the same dealer deals again', () => {
  const s = createBalootMatch({ rng: seeded(4), dealer: 0 });
  const seat = s.turn;
  s.hands[seat] = ['7S', '8H', '9D', '7C', '8S'];
  assert.equal(canKosh(s, seat), true);
  assert.ok(biddingOptions(s, seat).some((o) => o.bid === 'kosh'));
  for (const hand of [['7S', '8H', '9D', '7C', 'AS'], ['7S', '8S', '9S', '7C', '8H'], ['7S', '8H', '9D', '7C', 'JS']]) { s.hands[seat] = hand; assert.equal(canKosh(s, seat), false, hand.join()); }
  s.hands[seat] = ['7S', '8H', '9D', '7C', '8S'];
  const { state, events } = applyBalootAction(s, seat, { type: 'bid', bid: 'kosh' }, seeded(8));
  assert.equal(events[0].type, 'kosh');
  assert.equal(state.dealer, 0);
  assert.equal(state.handNo, s.handNo + 1);
  assert.equal(state.phase, 'bidding');
});

test('Baloot: a player who passed before the Hokm may pull it to Sun before anyone doubles', () => {
  let s = createBalootMatch({ rng: seeded(12), dealer: 3 });
  const first = s.turn, second = (first + 1) % 4;
  s = applyBalootAction(s, first, { type: 'bid', bid: 'pass' }).state;
  const hokm = biddingOptions(s, second).find((o) => o.bid === 'hokm');
  s = applyBalootAction(s, second, { type: 'bid', bid: 'hokm', suit: hokm.suit }).state;
  for (const seat of [(first + 2) % 4, (first + 3) % 4]) s = applyBalootAction(s, seat, { type: 'bid', bid: 'pass' }).state;
  assert.equal(s.turn, first, 'the first player is asked «تسحبها صن؟»');
  assert.deepEqual(biddingOptions(s, first), [{ bid: 'sun' }, { bid: 'pass' }]);
  const pulled = applyBalootAction(s, first, { type: 'bid', bid: 'sun' }).state;
  assert.equal(pulled.contract.type, 'sun');
  assert.equal(pulled.contract.buyer, first);
  // or lets it stand: the buyer confirms his Hokm
  const kept = applyBalootAction(s, first, { type: 'bid', bid: 'pass' }).state;
  assert.equal(kept.turn, second);
  assert.equal(kept.bidding.confirm, second);
});

test('Jackaroo: the turn goes to the right; a house with its owner on it is locked; the board picks the move', async () => {
  const g = createJackarooGame(['أ', 'ب', 'ج', 'د'], { rng: seeded(3), arm: jackarooArm(4), home: 'fill' });
  assert.equal(jackarooNext(g, 0), 3);
  assert.equal(jackarooNext(g, 3), 2);
  assert.equal(jackarooNext(g, 1, 2), 3);
  // the owner on its start shuts the road for every other marble
  const T = 4 * jackarooArm(4);
  g.players.forEach((p) => { p.marbles = [-1, -1, -1, -1]; });
  g.players[1].marbles[0] = 0;
  let shut = 0;
  for (let at = 0; at < T; at++) {
    g.players[0].marbles[0] = at;
    for (let steps = 1; steps <= 13; steps++) if (jackarooRoadShut(g, 0, 0, steps)) {
      shut++;
      const card = { 1: 'AS', 2: '2S', 3: '3S', 4: '4S', 5: '5S', 6: '6S', 7: '7S', 8: '8S', 9: '9S', 10: '10S', 11: 'AS', 12: 'QS', 13: 'KS' }[steps];
      if (steps === 4 || steps === 5 || steps === 7 || steps === 11 || steps === 13 || steps === 1) continue;
      g.hands[0] = [card]; g.turn = 0;
      assert.ok(!getJackarooActions(g, 0, 0).some((a) => a.type === 'move' && a.owner === 0 && a.marble === 0 && a.steps === steps), `no passing at ${at}+${steps}`);
    }
  }
  assert.ok(shut > 0, 'the locked house stops some moves');
  assert.equal(JK_LOCK, 'مقفل — صاحب البيت، لا يمكن المرور');
  const [page, petals, before] = await Promise.all([read('public/jackaroo.html'), read('public/assets/js/board-petals-v29.js'), read('public/assets/js/board-petals-v29.js')]);
  assert.match(page, /createBoardPicker/);
  assert.match(page, /الدور يمشي لليمين/);
  assert.match(petals, /export const LOCK_PHRASE='مقفل — صاحب البيت، لا يمكن المرور'/);
  assert.match(petals, /data-lock-badge/);
  void before;
});

test('hockey: the striker stays under the finger and a stalled frame never breaks the table', () => {
  assert.equal(HAND_SPEED, 6500);
  const g = createGame({ mode: 'two', seed: 3 });
  const before = JSON.stringify({ puck: g.puck, strikers: g.strikers, time: g.time });
  step(g, 0, {}); step(g, -0.02, {}); step(g, NaN, {});
  assert.equal(JSON.stringify({ puck: g.puck, strikers: g.strikers, time: g.time }), before);
  // the hand jumps 90 units: in one frame of 1/60 s the striker covers it (6500 units/s)
  const target = { x: g.strikers[0].x + 80, y: g.strikers[0].y - 40 };
  step(g, 1 / 60, { p0: target });
  assert.ok(Math.hypot(g.strikers[0].x - target.x, g.strikers[0].y - target.y) < 1, JSON.stringify(g.strikers[0]));
  for (const v of [g.puck.x, g.puck.y, g.strikers[0].x, g.strikers[1].y]) assert.ok(Number.isFinite(v));
});

test('faces and moves: laughing and angry faces, moves thrown at a player, quicker sending', async () => {
  const ids = new Set(Career.CATALOG.map((item) => item.id));
  for (const id of ['emote-cackle', 'emote-giggle', 'emote-rage', 'emote-grumpy', 'emote-pointlaugh', 'emote-fume', 'emote-explode']) assert.ok(ids.has(id), id);
  const moves = Career.CATALOG.filter((item) => item.type === 'move' && item.target);
  assert.ok(moves.length >= 7);
  const [index, reactions] = await Promise.all([read('src/index.js'), read('public/assets/js/reactions-v31.js')]);
  assert.match(index, /EMOTE_GAP_MS=450/);
  assert.match(reactions, /🎯 على لاعب/);
});

test('UNO, carrom and the picture race: their new screens are bundled and the host starts without a «ready»', async () => {
  const bundles = JSON.parse(await read('scripts/style-bundles.json'));
  assert.ok(bundles['chaos.html'].includes('assets/css/uno-v33-9.css'));
  assert.ok(bundles['race.html'].includes('assets/css/carrom-v33-9.css'));
  assert.ok(bundles['picture.html'].includes('assets/css/picture-v33-9.css'));
  const [uno, room] = await Promise.all([read('public/assets/js/uno-ui.js'), read('src/images/image-room.js')]);
  assert.match(uno, /BS_UNO/);
  assert.match(room, /p\.ready=true;\/\* 33\.9\.0: starting is the host's «جاهز» \*\//);
});

test('billiards: a page, a cover and a mission', async () => {
  for (const file of ['public/billiards.html', 'public/assets/js/billiards/main.js', 'public/assets/js/engines/pool-engine.js', 'public/assets/css/billiards-v33-9.css', 'public/assets/brand/billiards-cover-v33-9.webp']) assert.ok((await stat(new URL('../' + file, import.meta.url))).size > 1000, file);
  const profile = await read('public/assets/js/profile-core.js');
  assert.match(profile, /\['billiards','games',2,50,'طاولة البلياردو','العب مباراتين بلياردو اليوم\.'\]/);
  const shop = await read('public/assets/js/shop-v31.js');
  assert.match(shop, /billiards:\{name:'بلياردو',href:'\/billiards'\}/);
});

test('the snakes game is «الثعبان والسلالم» in every text a player reads', async () => {
  for (const file of ['public/assets/js/profile-core.js', 'public/assets/js/shop-v31.js', 'public/snakes.html', 'public/assets/js/table-viewport-v33-7.js', 'public/assets/js/play-feedback-v24-1.js', 'src/presence/presence-registry.js']) {
    const text = await read(file);
    assert.doesNotMatch(text, /السلم والثعبان|سلم وثعبان/, file);
  }
});
