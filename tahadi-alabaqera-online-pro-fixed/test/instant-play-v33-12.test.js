// 33.12.0: every game opens straight into play; playing with friends happens in «الغرف»;
// the home games move; two new games: «جسر الألوان» and «عشر ثواني»; screens no longer cut.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile, access } from 'node:fs/promises';
import { createParty, addPartyPlayer, startPartyRound, applyPartyAction, advanceParty, partySnapshot } from '../src/party/party-engine.js';
import { PARTY_GAMES, partyGame } from '../public/assets/js/engines/party-catalog-v29.js';
import { PARTY_MODES } from '../public/assets/js/engines/party-modes.js';
import { LOCAL_GAMES, localGame } from '../src/party/party-link.js';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const GAME_PAGES = ['hockey', 'billiards', 'race', 'pegs', 'tanks', 'jewels', 'paths-online', 'ludo', 'picture', 'memory', 'logic', 'puzzle', 'reaction', 'focus', 'cipher', 'wordbomb', 'chaos', 'sudoku', 'snakes', 'dice', 'jackaroo', 'baloot', 'serpent', 'online', 'quiz', 'bridge', 'ten'];

function boot(path, { search = '', framed = false } = {}) {
  const classes = new Set(), replaced = [], appended = [];
  const documentElement = { classList: { add: (...c) => c.forEach((x) => classes.add(x)), remove: (...c) => c.forEach((x) => classes.delete(x)), contains: (c) => classes.has(c) } };
  const document = { documentElement, readyState: 'loading', head: { appendChild: (el) => appended.push(el) }, createElement: () => ({ style: {}, setAttribute() {}, append() {} }), querySelector: () => null };
  const window = { document, location: { pathname: path, search, replace: (url) => replaced.push(url) }, addEventListener() {}, setTimeout: () => 0 };
  window.top = framed ? {} : window; window.self = window;
  const source = this.source;
  vm.runInNewContext(source, { window, document, URLSearchParams, setTimeout: () => 0, clearTimeout() {}, Promise, Event: class {} });
  return { instant: window.BS_INSTANT, classes, replaced, appended };
}

test('every game page loads the instant start in its <head>, and its styles in the page bundle', async () => {
  const bundles = JSON.parse(await read('scripts/style-bundles.json'));
  for (const name of GAME_PAGES) {
    const html = await read('public/' + name + '.html');
    const head = html.slice(0, html.toLowerCase().indexOf('</head>'));
    assert.match(head, /<script src="\/assets\/js\/instant-play-v33-12\.js\?v=[^"]+"><\/script>/, name);
    assert.equal(bundles[name + '.html'][0], 'assets/css/instant-play-v33-12.css', name);
    const built = (await read('public/assets/css/app-' + name + '.css')) + (name === 'sudoku' ? await read('public/assets/css/app-sudoku-tail.css') : '');
    assert.ok(built.includes('.ip-ways'), name);
  }
  const index = await read('public/index.html');
  assert.doesNotMatch(index, /instant-play-v33-12/, 'the home page itself is not a game');
});

test('a plain visit plays at once; rooms, parties, frames and ?play=menu keep the page as it was', async () => {
  const source = await read('public/assets/js/instant-play-v33-12.js');
  const run = boot.bind({ source });
  const plain = run('/hockey');
  assert.equal(plain.instant.instant, true);
  assert.ok(plain.classes.has('ip-instant') && plain.classes.has('ip-boot'), 'the menu stays hidden while the game opens');
  for (const search of ['?room=951234', '?party=123456&round=x', '?play=menu', '?play=online', '?play=room', '?daily=1', '?level=3']) {
    const r = run('/hockey', { search });
    assert.equal(r.instant.instant, false, search);
    assert.ok(r.classes.has('ip-menu') && !r.classes.has('ip-boot'), search);
  }
  assert.equal(run('/hockey', { framed: true }).instant.instant, false, 'a game inside the group room is left to the room');
  assert.equal(run('/hockey', { search: '?utm_source=whatsapp' }).instant.instant, true);
  assert.deepEqual(run('/quiz').replaced, ['/online'], 'the questions open on the quick round');
  assert.equal(run('/baloot').instant.partyUrl, '/baloot?play=room', 'بلوت plays with friends in its own room');
  assert.equal(run('/uno').instant.partyUrl, '/party?game=chaos');
  assert.equal(run('/carrom').instant.page, 'carrom');
  assert.equal(run('/race.html').instant.page, 'carrom');
  assert.equal(run('/blocks').instant.partyUrl, '/party?game=blocks');
  assert.equal(run('/').instant, undefined, 'pages that are not games are untouched');
  // the page's own buttons, pressed in order; a failed step leaves the menu (the old behaviour)
  // 33.13.0: the page's own choices (opponent, level, goals) are offered first, then pressed in order
  assert.match(source, /hockey: \{ groups: \[OPPONENT\('\[data-v="ai"\]', '\[data-v="two"\]', \['#startBtn', '#startBtn'\]\)/);
  assert.match(source, /let safety = setTimeout\(show, 6500\)/);
  assert.match(source, /catch \{ \/\* the page's menu stays/);
});

test('rooms and online tables leave the game pages; two links stay; the page scrolls as a page', async () => {
  const css = await read('public/assets/css/instant-play-v33-12.css');
  assert.match(css, /^html\{overflow:visible!important\}/m, 'a body that was its own scroll box never moved on some phones');
  assert.match(css, /html\.ip-instant \.gm33-friends\{display:none!important\}/);
  assert.match(css, /html\.ip-menu \.ip-ways\{display:none\}/);
  assert.match(css, /body\.carrom-running \.cm-dock\{overflow-y:auto!important/);
  assert.match(css, /body\.bi-playing \.bi-dock \.bi-spin-btn\{width:52px!important;height:52px!important/);
  const js = await read('public/assets/js/instant-play-v33-12.js');
  assert.match(js, /'العب مع أصحابك'/);
  assert.match(js, /'الأوضاع والأونلاين'/);
});

test('الغرف opens with only the game it was asked for', async () => {
  const party = await read('public/assets/js/party-v29.js');
  assert.match(party, /let playlist=\(\(g\)=>g&&partyGame\(g\)\?\[settings\(partyGame\(g\)\.id\)\]:\[settings\('quiz'\),settings\('memory'\)\]\)/);
});

test('the newer games: their pages, art and rules (33.15: «رص البلوكات» took the bridge\'s place)', async () => {
  const bundles = JSON.parse(await read('scripts/style-bundles.json'));
  assert.deepEqual(bundles['blocks.html'], ['assets/css/instant-play-v33-12.css', 'assets/css/new-games-v33-12.css', 'assets/css/blocks-v33-15.css', 'assets/css/game-interaction-v34.css', 'assets/css/table-studio-v33-16.css', 'assets/css/game-craft-v33-16.css']);
  for (const [page, script, cover] of [['blocks', 'blocks-v33-15.js', 'blocks-cover-v33-15.svg'], ['ten', 'ten-v33-12.js', 'ten-cover-v33-12.svg']]) {
    const html = await read('public/' + page + '.html');
    assert.match(html, /<meta name="viewport" content="width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">/);
    assert.match(html, /assets\/js\/party-link-v32\.js/);
    if (page === 'ten') assert.deepEqual(bundles[page + '.html'], ['assets/css/instant-play-v33-12.css', 'assets/css/new-games-v33-12.css', 'assets/css/game-interaction-v34.css']);
    assert.match(html, new RegExp('assets/css/app-' + page + '\\.css\\?v='));
    assert.match(html, new RegExp('assets/js/' + script.replace('.', '\\.')));
    assert.match(html, /href="\/party\?game=/);
    const js = await read('public/assets/js/' + script);
    for (const text of [html, js]) assert.doesNotMatch(text, /بوت|كمبيوتر/, 'the other players are named players');
    assert.match(js, /link\.report\(\{ progress/);
    assert.match(js, /prefers-reduced-motion/);
    const svg = await read('public/assets/brand/' + cover);
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.doesNotMatch(svg, /<script|<image|href="http/);
  }
  const ten = await read('public/assets/js/ten-v33-12.js');
  assert.match(ten, /const TARGET = 10000/);
  assert.match(ten, /pointerdown/);
  assert.match(ten, /visibilitychange/);
});

test('a group room plays the new games on their own pages, the same seed for everyone', () => {
  for (const id of ['blocks', 'ten']) {
    assert.ok(partyGame(id), id);
    assert.ok(PARTY_MODES[id]?.length, id);
    assert.equal(localGame(id), '/' + id);
    assert.equal(LOCAL_GAMES[id], '/' + id);
    for (const continuous of [true, false]) {
      const room = createParty({ code: '123456', hostKey: 'x'.repeat(40), capacity: 4, playlist: [id], continuous, now: 1000 });
      for (let i = 0; i < 4; i++) addPartyPlayer(room, { name: 'P' + i, now: 1000 + i });
      room.roster = [...room.order];
      startPartyRound(room, 2000, 42);
      assert.equal(room.round.local.page, '/' + id);
      assert.equal(typeof room.round.local.seed, 'number');
      assert.equal(partySnapshot(room, room.order[0], 2100).round.local.seed, room.round.local.seed);
      room.order.forEach((player, i) => applyPartyAction(room, player, { sessionId: room.sessionId, roundId: room.round.id, seq: 1, action: { report: { progress: 1, score: 1000 * (4 - i), done: true, won: i === 0 } } }, 3000));
      advanceParty(room, 3100);
      assert.notEqual(room.status, 'playing', id + ': the round ends once everyone has a result');
    }
  }
  assert.ok(PARTY_GAMES.findIndex((g) => g.id === 'blocks') < PARTY_GAMES.findIndex((g) => g.id === 'logic'));
  assert.equal(partyGame('bridge'), null, 'the bridge is retired from the rooms');
});

test('home: the library in order, the newer games, the cards fit, and the games move', async () => {
  const home = await read('public/index.html');
  const order = [...home.matchAll(/<a href="([^"]+)" class="home-game/g)].map((m) => m[1]);
  // 33.15.0: «خدعة الألوان» and «خزنة الألوان» are retired, «رص البلوكات» replaced «جسر الألوان»
  assert.equal(order.length, 26);
  assert.deepEqual(order.slice(0, 7), ['/ludo', '/blocks', '/ten', '/jackaroo', '/baloot', '/uno', '/pegs']);
  assert.doesNotMatch(home, /href="\/(?:bridge|colorbluff)/);
  assert.equal(order.at(-1), '/party');
  assert.doesNotMatch(home, /table-feature/, 'the two wide table cards spilled off the phone');
  assert.match(home, /<h3>سر الألوان<\/h3>/);
  assert.match(home, /<script src="\/assets\/js\/home-motion-v33-12\.js\?v=[^"]+"><\/script>/);
  const motion = await read('public/assets/js/home-motion-v33-12.js');
  assert.match(motion, /hm-reel/);
  assert.match(motion, /doc\.hidden \|\| reduce\.matches/);
  const css = await read('public/assets/css/home-motion-v33-12.css');
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)/);
  assert.match(css, /\.hm-reel\.is-held \.hm-reel-track\{animation-play-state:paused\}/);
  const tail = await read('public/assets/css/app-index-tail.css');
  assert.ok(tail.includes('hm-reel-item'), 'the built home bundle carries the motion');
  for (const file of ['public/assets/brand/blocks-cover-v33-15.svg', 'public/assets/brand/ten-cover-v33-12.svg']) await access(new URL(file, root));
});
