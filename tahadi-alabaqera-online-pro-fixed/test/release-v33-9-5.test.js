// 33.9.5: «ماستر الجواهر» is a match-3 duel: one board, two moves a turn, five rounds, special gems,
// boosters that charge from their colour, the last round counting double, and online tables.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { JD, BOOSTERS, createJewelsDuel, playJewelsSwap, playJewelsBooster, legalSwaps, findGroups, chooseJewelsMove, playJewelsAuto, jewelsTimeout } from '../public/assets/js/engines/jewels-duel-engine.js';
import { startTable, playerMove, seatProgress, tableOver, TABLE_GAMES, stepsTime } from '../src/games/board-tables.js';

const read = (file) => readFile(new URL('../' + file, import.meta.url), 'utf8');
const t = (c, s = '') => ({ i: Math.random(), c, s });
function boardFrom(rows) { let id = 0; return rows.join('').split('').map((ch) => ({ i: ++id, c: '012345'.indexOf(ch) })); }

test('a new board has no match, has moves, and the same seed gives the same game', () => {
  const a = createJewelsDuel(['أ', 'ب'], { seed: 99, first: 0 }), b = createJewelsDuel(['أ', 'ب'], { seed: 99, first: 0 });
  assert.equal(a.board.length, 64); assert.equal(findGroups(a.board).length, 0); assert.ok(legalSwaps(a).length > 0);
  const [x, y] = legalSwaps(a)[0];
  assert.deepEqual(playJewelsSwap(a, 0, x, y), playJewelsSwap(b, 0, x, y));
});

test('two moves a turn, then the other player; five rounds and a winner', () => {
  let s = createJewelsDuel(['أ', 'ب'], { seed: 5, first: 0 });
  assert.throws(() => playJewelsSwap(s, 1, ...legalSwaps(s)[0]), /wrong_turn/);
  let guard = 0;
  while (s.winner === null && guard++ < 100) {
    const before = s.turn, m = legalSwaps(s)[0];
    s = playJewelsSwap(s, s.turn, m[0], m[1]);
    if (s.winner === null && !s.last.extra && s.turn === before) assert.equal(s.moves, 1);
    assert.equal(findGroups(s.board).length, 0, 'the board settles after every move');
  }
  assert.ok(s.winner === 0 || s.winner === 1);
  assert.equal(s.round, JD.ROUNDS);
  assert.ok(guard >= JD.ROUNDS * 2 * 2 - 1, 'at least two moves per turn');
});

test('a swap that makes nothing is refused; four in a line makes a rocket and an extra move', () => {
  // row 0: 0 0 1 0 0 …  → swapping (0,1)-(0,2)? build a sure four
  const s = createJewelsDuel(['أ', 'ب'], { seed: 3, first: 0 });
  s.board = boardFrom(['00103452', '12345012', '23450123', '34501234', '45012345', '50123450', '01234501', '12345012']);
  s.board[11] = { i: 999, c: 0, s: '' }; // under the gap: (3,1) is 0 → swapping with (2,0)? use (2,0)<->(2,1)
  const swaps = legalSwaps(s).map((m) => m.join(':'));
  assert.ok(swaps.length);
  const bad = [...Array(63).keys()].find((i) => (i % 8) < 7 && !swaps.includes(i + ':' + (i + 1)));
  assert.throws(() => playJewelsSwap(s, 0, bad, bad + 1), /no_match/);
  const four = { ...s, board: boardFrom(['00203452', '12045012', '23450123', '34501234', '45012345', '50123450', '01234501', '12345012']) };
  four.board[10] = { i: 998, c: 0, s: '' };
  const after = playJewelsSwap(four, 0, 2, 10);
  assert.ok(after.last.made >= 1 || after.last.phases[0].made.length >= 1, 'a special gem was made');
  assert.equal(after.last.extra, true); assert.equal(after.moves, 2, 'one move used, one extra given');
  assert.ok(after.players[0].score >= 3);
});

test('boosters charge from their colour, cost no move, and the last round counts double', () => {
  let s = createJewelsDuel(['أ', 'ب'], { seed: 11, first: 0 });
  assert.throws(() => playJewelsBooster(s, 0, 'hammer', 20), /not_charged/);
  s.players[0].charge = BOOSTERS.map((b) => b.need);
  const used = playJewelsBooster(s, 0, 'hammer', 27);
  assert.equal(used.moves, s.moves, 'no move spent'); assert.equal(used.players[0].charge[0], 0);
  assert.ok(used.players[0].score >= 9, 'a 3×3 blast');
  const storm = playJewelsBooster(s, 0, 'storm', 0);
  assert.ok(storm.last.phases[0].clear.length >= 6);
  s.round = JD.ROUNDS; const m = legalSwaps(s)[0], last = playJewelsSwap(s, 0, m[0], m[1]);
  assert.equal(last.last.phases[0].pts, last.last.phases[0].clear.length * 2);
});

test('the computer plays every level to the end, and a timeout moves for a person', () => {
  for (const level of ['easy', 'medium', 'hard']) {
    let s = createJewelsDuel(['أ', 'ب'], { seed: 21, first: 1 }), guard = 0;
    while (s.winner === null && guard++ < 120) s = playJewelsAuto(s, level, () => 0.4);
    assert.notEqual(s.winner, null, level);
  }
  const s = createJewelsDuel(['أ', 'ب'], { seed: 8, first: 0 });
  assert.equal(jewelsTimeout(s).seq, 1);
  assert.ok(['swap', 'booster'].includes(chooseJewelsMove(s, 'hard').type));
});

test('stored version-one Jewels rooms keep validation and ranking compatibility', () => {
  assert.ok(TABLE_GAMES.includes('jewels'));
  const room = { game: 'jewels', status: 'lobby', players: { p1: { id: 'p1', name: 'سعد' } }, order: ['p1'], version: 0 };
  startTable(room, { rng: () => 0.3 });
  assert.equal(room.order.length, 2); assert.equal(room.state.game, 'jewels');
  const mine = room.order.indexOf('p1');
  room.state=createJewelsDuel(room.order.map(id=>room.players[id].name),{seed:123,first:mine});
  const steps={from:room.version,list:[]};
  assert.ok(stepsTime(room, steps) >= 0);
  const [a, b] = legalSwaps(room.state)[0];
  const next = playerMove(room, mine, { type: 'jewels_swap', a, b }, () => 0.5);
  assert.ok(next.list.length >= 1);
  assert.throws(() => playerMove(room, 1 - mine, { type: 'jewels_swap', a: 0, b: 1 }, () => 0.5), /wrong_turn/);
  assert.throws(() => playerMove(room, mine, { type: 'jewels_booster', id: 'hammer', cell: 3 }, () => 0.5), /not_charged|wrong_turn/);
  assert.equal(seatProgress(room, mine), room.state.players[mine].score);
  assert.equal(tableOver(room), room.state.winner !== null);
});

test('the page, the codes and the home page know the duel', async () => {
  const [html, menu, home, codes, presence, main, sound] = await Promise.all(['public/jewels.html', 'public/assets/js/game-menu-v33.js', 'public/index.html', 'src/rooms/room-codes.js', 'src/presence/presence-registry.js', 'public/assets/js/jewels/main.js', 'public/assets/js/sound-v33-9-3.js'].map(read));
  assert.match(html, /<title>ماستر الجواهر — بوسراج<\/title>/); assert.match(html, /id="gameMenu"/); assert.match(html, /assets\/js\/jewels\/main\.js\?v=/);
  assert.doesNotMatch(html + main, /بوت(?!ن)|Match Masters|ماستر ماتش/);
  assert.match(menu, /\['jewels',85,89,'\/jewels'\]/);
  assert.match(codes, /jewels: \{ from: 85, to: 89, page: '\/jewels' \}/);
  assert.match(home, /href="\/jewels" class="home-game"/);
  assert.match(presence, /jewels: \{ key: 'jewels', label: 'ماستر الجواهر' \}/);
  assert.match(main, /createTable\(/); assert.match(main, /jewels_swap/); assert.match(main, /jewels_booster/);
  assert.match(sound, /jewels: \['jewels'\]/);
  assert.ok((await stat(new URL('../public/assets/music/v33-9-3/jewels.mp3', import.meta.url))).size > 200000);
  assert.ok((await stat(new URL('../public/assets/brand/jewels-duel-cover-v33-9-5.webp', import.meta.url))).size > 10000);
});

test('the release is 33.9.5 or later with its notes', async () => {
  assert.match(JSON.parse(await read('package.json')).version, /^33\.(?:9\.(?:[5-9]|\d{2,})|\d{2,}\.\d+)$/);
  const notes = await read('RELEASE_V33_9_5_AR.md');
  for (const word of ['1 ضد 1', 'حركتين', '5 جولات', 'الصاروخ', 'القنبلة', 'المساعدات', 'دبل', 'أونلاين']) assert.match(notes, new RegExp(word));
  assert.doesNotMatch(notes, /بوت(?!ن)/); assert.doesNotMatch(notes, /السلم والثعبان/);
  assert.match(await read('README-AR.md'), /RELEASE_V33_9_5_AR\.md/);
});
