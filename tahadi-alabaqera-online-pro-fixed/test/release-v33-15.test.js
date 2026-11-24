// 33.15.0: «رص البلوكات» takes the place of «جسر الألوان»; «خدعة الألوان» and «خزنة الألوان» are retired;
// every page wears the royal purple and gold; practice rivals have names; Ludo stacks its finished stones.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile, access, stat } from 'node:fs/promises';
import * as Ludo from '../public/assets/js/engines/ludo-engine.js';
import * as Six from '../public/assets/js/ludo/six-layout.js';
import { partyGame, PARTY_GAMES } from '../public/assets/js/engines/party-catalog-v29.js';
import { PARTY_MODES } from '../public/assets/js/engines/party-modes.js';
import { LOCAL_GAMES } from '../src/party/party-link.js';
import { createParty, addPartyPlayer, startPartyRound } from '../src/party/party-engine.js';
import { createDOM, MiniElement } from './dom-harness.mjs';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('رص البلوكات: the page, its bundle, the art and the rules', async () => {
  const html = await read('public/blocks.html'), js = await read('public/assets/js/blocks-v33-15.js');
  assert.match(html, /<title>رص البلوكات — لعبة العباقرة<\/title>/);
  for (const id of ['bkPlay', 'bkBoard', 'bkTray', 'bkSwap', 'bkBomb', 'bkScore', 'bkBest', 'bkResult', 'bkAgain']) assert.match(html, new RegExp('id="' + id + '"'), id);
  assert.match(html, /data-bk-mode="classic"/); assert.match(html, /data-bk-mode="timed"/);
  assert.match(html, /href="\/party\?game=blocks"/);
  assert.doesNotMatch(html + js, /بوت|كمبيوتر/);
  assert.match(js, /link\.report\(\{ progress/);
  assert.match(js, /prefers-reduced-motion/);
  assert.match(js, /pointerdown/);
  const svg = await read('public/assets/brand/blocks-cover-v33-15.svg');
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.doesNotMatch(svg, /<script|<image|href="http/);
});

test('رص البلوكات plays: a board of 64, three pieces, every piece inside 5×5', async () => {
  const h = await createDOM('blocks.html');
  await h.runFile('assets/js/blocks-v33-15.js');
  const B = h.context.BS_BLOCKS;
  assert.ok(B.SHAPES.length >= 30, 'rotations of every base piece');
  for (const s of B.SHAPES) { assert.ok(s.every(([r, c]) => r >= 0 && c >= 0 && r < 5 && c < 5)); assert.equal(new Set(s.map(String)).size, s.length); }
  assert.deepEqual(Object.keys(B.MODES), ['classic', 'timed']);
  const grid = Array.from({ length: 8 }, () => Array(8).fill(null));
  assert.equal(B.fits(grid, [[0, 0], [0, 1]], 7, 6), true);
  assert.equal(B.fits(grid, [[0, 0], [0, 1]], 7, 7), false, 'off the edge');
  grid[3][3] = 1; assert.equal(B.fits(grid, [[0, 0]], 3, 3), false, 'a taken square');
  h.doc.getElementById('bkPlay').click();
  assert.equal(h.doc.getElementById('bkBoard').children.length, 64);
  assert.equal(h.doc.getElementById('bkTray').children.length, 3);
  assert.equal(h.doc.getElementById('bkIntro').hidden, true);
});

test('الغرف: everyone plays the same pieces on the clock; the bridge is gone from the rooms', () => {
  assert.ok(partyGame('blocks')); assert.ok(PARTY_MODES.blocks?.length);
  assert.equal(LOCAL_GAMES.blocks, '/blocks'); assert.equal(LOCAL_GAMES.bridge, undefined);
  assert.equal(partyGame('bridge'), null); assert.equal(PARTY_GAMES.some((g) => g.id === 'bridge'), false);
  const room = createParty({ code: '123456', hostKey: 'x'.repeat(40), capacity: 4, playlist: ['blocks'], now: 1000 });
  for (let i = 0; i < 3; i++) addPartyPlayer(room, { name: 'P' + i, now: 1000 + i });
  room.roster = [...room.order]; startPartyRound(room, 2000, 42);
  assert.equal(room.round.local.page, '/blocks'); assert.equal(room.round.local.seed, 42);
});

test('the colour bluff and vault are retired, and old addresses lead somewhere new', async () => {
  const home = await read('public/index.html'), pegs = await read('public/pegs.html'), modes = await read('public/assets/js/engines/party-modes.js'), worker = await read('src/index.js');
  assert.doesNotMatch(home, /colorbluff|خدعة الألوان|خزنة الألوان/);
  assert.doesNotMatch(pegs, /colorbluff/);
  assert.doesNotMatch(modes, /bluff|vault/);
  assert.equal(PARTY_MODES.pegs.some((m) => ['bluff', 'vault'].includes(m.id)), false);
  assert.match(worker, /const MOVED_PAGES=Object\.freeze\(\{'\/bridge':'\/blocks','\/colorbluff':'\/pegs','\/zahra':'\/ludo','\/crowd':'\/tanks','\/v5':'\/','\/reaction-classic':'\/reaction','\/local':'\/online'\}\);/);
  assert.match(worker, /to\.search=url\.search;return Response\.redirect\(to\.href,302\)/);
  assert.match(await read('public/assets/js/pegs/main.js'), /function openColorRoom\(\)\{ return false; \}/);
});

test('one royal look: the shared layer, the offline page and Arabic labels', async () => {
  const css = await read('public/assets/css/tahdia-premium-v25.css');
  assert.match(css, /33\.15\.0: one royal look on every page/);
  assert.match(css, /html body\.release-v26\{--bs-cyan:#ffe38a;--bs-green:#ffd24a;--bs-purple:#c99dff;--mint:#ffe38a/);
  assert.match(css, /:is\(html,#x\) body\.carrom-page\.cm-club\{/);
  const offline = await read('public/offline.html');
  assert.match(offline, /#3a1590/); assert.doesNotMatch(offline, /#b1dbba|#102331/);
  for (const page of ['chaos', 'memory', 'logic', 'puzzle', 'reaction', 'focus', 'cipher', 'wordbomb', 'snakes', 'admin']) assert.doesNotMatch(await read('public/' + page + '.html'), />(?:[A-Z][A-Z &/·0-9'-]{3,}|\d\d \/ [A-Z ]+)</, page + ' speaks Arabic');
});

test('practice rivals have names; no page calls them «الكمبيوتر»', async () => {
  for (const file of ['index.html', 'billiards.html', 'race.html', 'hockey.html', 'pegs.html', 'jewels.html', 'chaos.html', 'cipher.html', 'focus.html', 'reaction.html', 'wordbomb.html', 'baloot.html', 'leaderboard.html', 'tournament.html', 'zahra.html',
    'assets/js/game-menu-v33.js', 'assets/js/billiards/main.js', 'assets/js/carrom/main.js', 'assets/js/jewels/main.js', 'assets/js/hockey/main.js', 'assets/js/pegs/main.js', 'assets/js/tanks/main.js', 'assets/js/tanks/core.js', 'assets/js/challenge-client.js']) {
    assert.doesNotMatch(await read('public/' + file), /كمبيوتر/, file);
  }
  for (const file of ['billiards', 'carrom', 'jewels', 'hockey', 'pegs']) assert.match(await read('public/assets/js/' + file + '/main.js'), /const RIVAL_NAME=/);
});

test('لودو: new covers, and the finished stones of a colour stand together with a count', async () => {
  for (const file of ['ludo-cover-v33-15.webp', 'ludo-palace-v33-15.webp']) assert.ok((await stat(new URL('../public/assets/brand/' + file, import.meta.url))).size > 30000, file);
  const home = await read('public/index.html');
  assert.match(home, /assets\/brand\/ludo-palace-v33-15\.webp/); assert.match(home, /assets\/brand\/ludo-cover-v33-15\.webp/);
  assert.match(await read('public/ludo.html'), /المربعات بالنجمة ومربعات البداية آمنة/);
  const h = await createDOM('ludo.html', { ...Ludo, ...Six });
  h.doc.createTextNode = (t) => { const n = new MiniElement('#text'); n.textContent = t; return n; };
  await h.runFile('assets/js/ludo/board.js');
  const state = Ludo.createLudoGame(['A', 'B', 'C', 'D'], { layout: 'classic' });
  state.players[0].tokens = [56, 56, 56, 3];
  h.context.args = { host: h.doc.getElementById('board'), state, options: { viewer: 0, legal: [] } };
  await vm.runInContext('renderLudoBoard(args.host,args.state,args.options)', h.context);
  const pile = h.doc.querySelectorAll('[data-pawns] [data-seat="0"]').filter((n) => /translate\(/.test(n.getAttribute('transform')));
  const homes = pile.filter((n) => n.getAttribute('transform') === pile[0].getAttribute('transform'));
  assert.ok(homes.length >= 3, 'the three finished stones share one spot');
  const badge = h.doc.querySelector('[data-home-count="0"]');
  assert.ok(badge); assert.equal(badge.textContent, '3');
  await access(new URL('../public/assets/brand/ludo-royal-cover-v33-14.svg', import.meta.url));
});
