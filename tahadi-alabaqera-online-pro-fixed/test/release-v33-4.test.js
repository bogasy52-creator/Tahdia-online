// 33.4.0: the home page opens on the games (rooms live inside each game), eight Baloot
// tables chosen inside Baloot, Jackaroo with the Baloot deck, card drawings and a
// numbered board turned to you, snakes & ladders for 2, 3 or 4 players, and the
// memory game on a screen of its own that fits the phone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { seatsFor, chosenSeats, startTable } from '../src/games/board-tables.js';
import { Career } from '../src/career/core.js';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('the home page opens on the games: no room code box, no unnamed «الأونلاين» panel', async () => {
  const home = await read('public/index.html');
  assert.doesNotMatch(home, /id="homeRoomJoin"|id="homeRoomCode"|class="home-companion"|id="homeQuickPlay"/);
  assert.doesNotMatch(home, /اللعب يحلى/);
  assert.doesNotMatch(home, /href="\/online"/, 'the quiz is reached by its own card');
  assert.match(home, /<div id="homeResume" class="home-resume-v33" hidden><\/div>/);
  assert.match(home, /<a href="\/party" class="home-game home-party"/);
  assert.match(home, /<a href="\/party">غرفة الأصدقاء<\/a>/);
  assert.doesNotMatch(await read('public/assets/js/home-v14.js'), /homeQuickPlay/);
  assert.doesNotMatch(await read('public/assets/js/home-v19.js'), /homeRoomJoin/);
  const premium = await read('public/assets/css/tahdia-premium-v25.css');
  assert.doesNotMatch(premium, /home-companion|home-join-v19/);
  assert.match(premium, /body\.home-v26 \.home-stage\{display:grid;grid-template-columns:minmax\(0,1fr\);/);
});

test('every table is a Baloot table of its own, picked inside the Baloot page', async () => {
  const css = await read('public/assets/css/app-baloot.css');
  for (const theme of ['diwan', 'club', 'ivory', 'night', 'garden', 'palace', 'majlis', 'reactor']) assert.match(css, new RegExp(`\\.bl-felt\\[data-table="${theme}"\\]\\{--t-rx:`), theme);
  const page = await read('public/baloot.html');
  assert.match(page, /<div id="tableChoice" class="blt-choice-host"><\/div>/);
  assert.match(page, /<button id="changeTable" type="button" class="bl-btn blt-change">غيّر الطاولة<\/button>/);
  assert.match(page, /<div id="felt" class="bl-felt" data-table="diwan">/);
  assert.match(page, /baloot-tables\.js\?v=[\d.]+"><\/script><script type="module" src="assets\/js\/baloot-table\.js/);
  const table = await read('public/assets/js/baloot-table.js');
  assert.match(table, /window\.BS_BALOOT_TABLES\.apply\(\$\('felt'\)\)/);
  assert.doesNotMatch(table, /dataset\.felt/);
  // the picker's preview seats never pass for the real seats the table script looks for
  const picker = await read('public/assets/js/baloot-tables.js');
  assert.doesNotMatch(picker, /'bl-seat|"bl-seat|bl-slot|bl-backs/);
  const window = { document: { readyState: 'complete', getElementById: () => null, createElement: () => ({ append() {}, setAttribute() {}, style: { setProperty() {} }, dataset: {} }) }, addEventListener() {}, BS_CAREER_CORE: Career };
  window.window = window;
  vm.runInNewContext(picker, window);
  const tables = window.BS_BALOOT_TABLES;
  assert.equal(tables.themeOf('table-walnut'), 'diwan');
  assert.equal(tables.themeOf('table-majlis'), 'majlis');
  assert.equal(tables.themeOf('table-cyber'), 'reactor');
  assert.equal(tables.themeOf('unknown'), 'diwan');
  assert.deepEqual([...tables.tables()], ['table-walnut', 'table-club', 'table-gallery', 'table-nocturne', 'table-botanic', 'table-royal', 'table-majlis']);
});

test('the majlis table is in the shop, and a table says it dresses Baloot first', async () => {
  const majlis = Career.CATALOG.find((item) => item.id === 'table-majlis');
  assert.ok(majlis && majlis.type === 'table' && majlis.price > 0);
  assert.ok(Career.STOREFRONT.includes('table-majlis'));
  assert.match(majlis.description, /طاولة بلوت/);
  const p = Career.purchase(Career.normalize({ coins: 1000 }), 'table-majlis', { now: Date.now(), expectedPrice: Career.itemPrice('table-majlis', Date.now()) });
  assert.equal(p.equipped.table, 'table-majlis');
  const shop = await read('public/assets/js/shop-v31.js');
  assert.match(shop, /\['table','الطاولات','🪵','طاولتك في البلوت/);
  assert.match(shop, /function balootArt\(stage,item,live\)/);
  assert.match(await read('public/shop.html'), /baloot-tables\.js\?v=[\d.]+"><\/script><script type="module" src="assets\/js\/shop-v31\.js/);
});

test('Jackaroo cards are the Baloot deck with a drawing of what each card does', async () => {
  const cards = await read('public/assets/js/baloot-cards.js');
  for (const rank of ['2', '3', '4', '5', '6']) assert.match(cards, new RegExp(`"${rank}": \\{"d": "M`), 'glyph ' + rank);
  assert.match(cards, /2: \[\[1, 0\], \[1, 4\]\],/);
  const window = { document: { readyState: 'complete', getElementById: () => null, addEventListener() {} } };
  window.window = window;
  vm.runInNewContext(await read('public/assets/js/jackaroo-cards.js'), window);
  const J = window.BS_JACK_CARDS;
  assert.equal(J.ORDER.length, 13);
  const act = (card) => J.info(card).act;
  assert.equal(act('AS'), 'exit'); assert.equal(act('KH'), 'king'); assert.equal(act('JD'), 'swap');
  assert.equal(act('7C'), 'split'); assert.equal(act('5S'), 'any'); assert.equal(act('4H'), 'back');
  assert.equal(act('10D'), 'step'); assert.equal(act('QC'), 'step'); assert.equal(act('2S'), 'step');
  for (const rank of J.ORDER) assert.ok(J.INFO[rank].say.length > 10, rank);
  const page = await read('public/jackaroo.html');
  assert.match(page, /card-courts\.js\?v=[\d.]+"><\/script><script src="assets\/js\/baloot-cards\.js\?v=[\d.]+"><\/script><script src="assets\/js\/jackaroo-cards\.js/);
  assert.match(page, /window\.BS_JACK_CARDS\.face\(card, \{ button: card !== "\?" \}\)/);
  assert.match(page, /viewer: me\(\),/);
  assert.match(page, /class="jk-board-info"[\s\S]*?id="cardGuide"/);
});

test('the Jackaroo board turns to you, numbers its holes from your start and has a design per table', async () => {
  const board = await read('public/assets/js/board-petals-v29.js');
  // 33.7.0: a table of four turns a quarter at a time, the board of six by its seats
  assert.match(board, /ROT=game!=='jackaroo'\|\|seat<0\?0:g\.seats===4\?\[0,-90,180,90\]\[seat\]:/);
  assert.match(board, /'data-track-number':num/);
  assert.match(board, /'data-quarter':s/);
  for (const key of ['club', 'majlis', 'reactor']) assert.match(board, new RegExp(`  ${key}:\\{label:`), key);
  assert.match(board, /'table-club':'club'/);
  assert.match(board, /'table-majlis':'majlis'/);
  // 33.6.0: the ring gave way to the star board of the photo; 33.7.0: its looks are Jackaroo boards
  // of their own from the shop (jboard), and the tables dress the Zahra board
  assert.match(board, /const BOARD_OF_ITEM=\{'jboard-neon':'neon',/);
  assert.match(board, /const host=svg\.querySelector\('\[data-board-root\]'\)\|\|svg/);
});

test('snakes & ladders: 2, 3 or 4 players; the empty seats are filled', async () => {
  assert.equal(chosenSeats('snakes', 3), 3);
  assert.equal(chosenSeats('snakes', 7), null);
  assert.equal(chosenSeats('zahra', 2), null, 'only snakes offers a size');
  assert.equal(seatsFor('snakes', 1, true, 2), 2);
  assert.equal(seatsFor('snakes', 1, true, 3), 3);
  assert.equal(seatsFor('snakes', 1, true), 4, 'the old quick table');
  assert.equal(seatsFor('snakes', 1, false, 4), 4);
  assert.equal(seatsFor('snakes', 3, false, 2), 3, 'friends who came all play');
  const room = { game: 'snakes', variant: 'classic', tableSeats: 3, players: { a: { id: 'a', name: 'سعد' } }, order: ['a'] };
  startTable(room, { quick: true, rng: () => 0.42 });
  assert.equal(room.order.length, 3);
  assert.equal(room.state.players.length, 3);
  const page = await read('public/snakes.html');
  assert.match(page, /seats: \[2, 3, 4\],\s*seatsDefault: 4,/);
  const menu = await read('public/assets/js/game-menu-v33.js');
  assert.match(menu, /options\.onQuick\?\.\(\{mode,seats,name:playerName\(\)\}\)/);
  assert.match(menu, /options\.onCreate\?\.\(\{mode,seats,name:playerName\(\)\}\)/);
  const worker = await read('src/index.js');
  assert.match(worker, /"quick:" \+ game \+ ":" \+ variant \+ \(seats \? ":s" \+ seats : ""\) \+ ":v33"/);
  assert.match(worker, /open\.assigned >= \(seats \|\| MAX_SEATS\[game\]\)/);
  assert.match(worker, /tableSeats: this\.room\.tableSeats \|\| null,/);
});

test('the memory game plays on its own screen: big square cards, no scrolling', async () => {
  const bundles = JSON.parse(await read('scripts/style-bundles.json'));
  assert.ok(bundles['memory.html'].includes('assets/css/memory-screen-v33-4.css'));
  const css = await read('public/assets/css/app-memory.css');
  assert.match(css, /body\.memory-playing \.memory-grid-v30\.memory-grid-v30\{grid-area:board;--gap:7px;--chrome:262px;/);
  assert.match(css, /grid-template-columns:repeat\(var\(--cols,4\),var\(--tw\)\)!important/);
  const arcade = await read('public/assets/js/arcade-games.js');
  assert.match(arcade, /function memoryLayout\(\)/);
  assert.match(arcade, /cols=round\.mode==='sequence'\?3:count<=12\?\(tall\?3:4\):count<=16\?4:\(tall\?4:6\)/);
  assert.match(arcade, /document\.body\.classList\.add\('memory-playing','memory-live'\)/);
  assert.match(arcade, /back\.id='memorySettings'/);
});
