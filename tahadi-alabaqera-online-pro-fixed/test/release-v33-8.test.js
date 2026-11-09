// 33.8.0: Jackaroo played on the board (a card, then the marble; a menu by the marble when it has
// several moves), burning one card or the whole hand, the ten that burns the next player's card;
// a bigger Jackaroo on the phone; spoken phrases in every room; air hockey online that always finds
// an opponent; «الصدام» in snakes & ladders; drawn, animated emoji; and the home page as a lobby.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createDOM } from './dom-harness.mjs';
import { Career } from '../src/career/core.js';
import { createJackarooGame, getJackarooActions, playJackarooAction, jackarooHandDead, burnJackarooHand } from '../public/assets/js/engines/jackaroo-engine.js';
import { choicesFor } from '../public/assets/js/jackaroo-play-v33-8.js';
import { playerMove } from '../src/games/board-tables.js';
import { createClashGame, playClashTurn, clashTargets, CLASH_BACK } from '../public/assets/js/engines/snakes-clash.js';
import { createSnakesServerGame, rollSnakesServer, normalizeSnakesVariant } from '../src/games/snakes-server.js';
import { HockeyRoom, HOCKEY_BOT_WAIT } from '../src/hockey/hockey-room.js';
import { VOICE_LINES, STUDIO_LINES } from '../public/assets/js/baloot-voice-pack.js';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('the 33.8.0 notes say what changed (the release itself has moved on)', async () => {
  assert.match(JSON.parse(await read('package.json')).version, /^33\.(?:[89]|\d{2,})\.\d+$/);
  const notes = await read('RELEASE_V33_8_AR.md');
  for (const words of ['جاكارو', 'احرق الكل', 'العشرة', 'السلام عليكم', 'الهوكي', 'منافس آلي', 'الصدام', 'الإيموجي', 'الرئيسية', 'صيد الكلمات', 'الاقتراح اللي نفذته']) assert.ok(notes.includes(words), words);
  assert.match(await read('public/service-worker.js'), /const CACHE_NAME = 'busraj-games-v66-release-33-\d+-\d+';/);
});

/* ---------- Jackaroo ---------- */
function jack() { const s = createJackarooGame(['سعد', 'فهد', 'ريم', 'نورة']); s.turn = 0; return s; }
test('a hand that cannot move anything may be burnt at once; a hand that can, may not', () => {
  let s = jack(); s.players[0].marbles = [-1, -1, -1, -1]; s.hands[0] = ['2S', '3H', '9D', '6C'];
  assert.equal(jackarooHandDead(s, 0), true);
  const after = burnJackarooHand(s, 0);
  assert.equal(after.hands[0].length, 0); assert.equal(after.lastEvent.action.type, 'burnAll'); assert.equal(after.lastEvent.burnt, 4);
  assert.equal(after.discard.slice(-4).join(), '2S,3H,9D,6C'); assert.equal(after.turn, 3, '33.9.0: the turn goes to the right');
  assert.throws(() => burnJackarooHand(s, 1), /wrong_turn/);
  s = jack(); s.players[0].marbles = [-1, -1, -1, -1]; s.hands[0] = ['AS', '3H'];
  assert.equal(jackarooHandDead(s, 0), false); assert.throws(() => burnJackarooHand(s, 0), /hand_can_move/);
});
test('the burnt hand is skipped until the next deal, and the ten still burns the next card and skips that player', () => {
  let s = jack(); s.players[0].marbles = [-1, -1, -1, -1]; s.hands[0] = ['2S', '3H'];
  // 33.9.0: the turn goes to the right (seat − 1)
  s = burnJackarooHand(s, 0); s.turn = 1; s.hands[1] = ['2C']; s.players[1].marbles = [-1, -1, -1, -1];
  s = playJackarooAction(s, 0, { type: 'discard' }, 1);
  assert.equal(s.turn, 3, 'the player with no cards is passed over');
  let t = jack(); t.hands[0] = ['10C', '2S']; t.hands[3] = ['5H', '6H'];
  const burn = getJackarooActions(t, 0, 0).find((a) => a.type === 'burn');
  assert.deepEqual(burn, { type: 'burn', target: 3 });
  t = playJackarooAction(t, 0, burn, 0);
  assert.equal(t.hands[3].length, 1); assert.equal(t.turn, 2, 'the next player is skipped');
});
test('the room takes «احرق الكل» only from the player whose turn it is', () => {
  const s = jack(); s.players[0].marbles = [-1, -1, -1, -1]; s.hands[0] = ['2S', '3H', '9D'];
  const room = { game: 'jackaroo', status: 'playing', state: s, version: 1, players: {}, order: [] };
  assert.throws(() => playerMove(room, 1, { type: 'jackaroo_burn_all' }), /wrong_turn/);
  playerMove(room, 0, { type: 'jackaroo_burn_all' });
  assert.equal(room.state.hands[0].length, 0); assert.equal(room.state.lastEvent.action.type, 'burnAll');
});
test('the choices of a marble: the ace one or eleven, the seven a split in two steps', () => {
  const s = jack(); s.players[0].marbles = [8, 20, -1, -1]; s.hands[0] = ['AH', '7S'];
  const ace = choicesFor(s, getJackarooActions(s, 0, 0), 0, 0).map((o) => o.label).sort();
  assert.deepEqual(ace, ['+1', '+11']);
  const seven = choicesFor(s, getJackarooActions(s, 1, 0), 0, 0);
  assert.ok(seven.some((o) => o.label === '+7' && o.act));
  const split = seven.find((o) => o.label === '+3');
  assert.ok(split.then?.length >= 1); assert.equal(split.then[0].stone[1], 1); assert.equal(split.then[0].label, '+4');
});
test('the Jackaroo page: moves chosen on the board, a faded card that can only burn, both burns and their question', async () => {
  const page = await read('public/jackaroo.html');
  // 33.9.0: the menu by the marble gave way to taps on the board (release-v33-9)
  assert.match(page, /import \{ createBoardPicker, createJackFx[^}]*\} from "\.\/assets\/js\/jackaroo-play-v33-8\.js\?v=/);
  assert.match(page, /b\.textContent = "🔥 احرق الورقة";/);
  assert.match(page, /all\.textContent = "🔥 احرق الكل \(" \+ myHand\(\)\.length \+ "\)";/);
  assert.match(page, /<b>تحرق كل أوراقك؟<\/b>/);
  assert.match(page, /table\.send\("jackaroo_burn_all", \{\}\)/);
  assert.match(page, /b\.classList\.add\("jk-dead"\);/);
  assert.match(page, /"🔥 احرق ورقة " \+ \(state\.players\[burnNext\.target\]\?\.name \|\| "التالي"\) \+ " وتخطّاه"/);
  const css = await read('public/assets/css/jackaroo-v33-8.css');
  assert.match(css, /--jk-card:clamp\(48px,min\(calc\(\(100vw - 30px - \(var\(--jk-n\) - 1\) \* 8px\) \/ var\(--jk-n\)\),11\.5svh\),94px\)/);
  assert.ok(JSON.parse(await read('scripts/style-bundles.json'))['jackaroo.html'].includes('assets/css/jackaroo-v33-8.css'));
  assert.match(await read('public/assets/js/board-fit-pro.js'), /Math\.min\(r\.height,r\.width\*1\.1\)/);
});

/* ---------- talk in every room ---------- */
test('the phrases of the Baloot table are free reactions in every room, and the ones with a recording speak', async () => {
  const spoken = Career.REACTIONS.filter((it) => it.voice);
  assert.ok(spoken.length >= 17);
  for (const it of spoken) { assert.equal(it.type, 'phrase'); assert.equal(it.price, 0, it.id); assert.ok(Object.hasOwn(VOICE_LINES, it.voice), it.voice); }
  assert.equal(Career.reactionOf('phrase-hello').voice, 'p17');
  assert.deepEqual([...STUDIO_LINES], ['p17', 'p18', 'p19', 'p20', 'p21', 'p22']);
  const reactions = await read('public/assets/js/reactions-v31.js'), table = await read('public/assets/js/baloot-table.js');
  const spec = reactions.match(/import\('(\/assets\/js\/baloot-voice\.js\?v=[^']+)'\)/)[1], used = table.match(/from '\.\/(baloot-voice\.js\?v=[^']+)'/)[1];
  assert.equal(spec, '/assets/js/' + used, 'the rooms and the Baloot table share one voice player');
  assert.match(reactions, /if\(it\.voice\)speak\(it\);/);
  assert.match(reactions, /const TABS=\[\['emote','إيموجي'\],\['phrase','كلام'\],\['move','حركات'\]\];/);
});

/* ---------- air hockey ---------- */
function hockeyRoom() {
  const values = new Map(), sent = [];
  const ctx = { storage: { get: async (k) => structuredClone(values.get(k)), put: async (k, v) => values.set(k, structuredClone(v)), setAlarm: async (t) => { ctx.alarm = t; }, delete: async (k) => values.delete(k) }, getWebSockets: () => [], blockConcurrencyWhile: (fn) => fn() };
  return { room: new HockeyRoom(ctx, {}), ctx, sent };
}
test('a quick hockey match alone gets a computer opponent after the wait, and a rematch starts at once', async () => {
  const h = hockeyRoom(); await h.room.ready;
  h.room.r = { code: '950123', hostKey: 'k', quick: true, target: 3, round: 0, status: 'lobby', expiresAt: Date.now() + 60000, botAt: Date.now() + 5000, players: [{ id: 'a', token: 'ta', name: 'سعد', connected: true, ready: true, seq: 0, connection: 'c1' }] };
  await h.room.alarm(); assert.equal(h.room.r.players.length, 1, 'not before the wait');
  h.room.r.botAt = Date.now() - 1; await h.room.alarm();
  const r = h.room.r; clearTimeout(h.room.timer); h.room.timer = 'stopped';
  assert.equal(r.status, 'playing'); assert.equal(r.players.length, 2); assert.equal(r.players[1].bot, true);
  assert.ok(['easy', 'mid'].includes(r.g.bot[1])); assert.equal(r.g.bot[0], null);
  assert.ok(r.players[1].token && r.players[1].token !== r.players[0].token, 'a new player can never take the computer\'s seat');
  const view = h.room.state('a'); assert.equal(view.players[1].bot, true); assert.equal(view.botIn, null);
  assert.ok(HOCKEY_BOT_WAIT >= 5000 && HOCKEY_BOT_WAIT <= 12000);
  r.status = 'finished'; r.g.phase = 'over';
  const ws = { deserializeAttachment: () => ({ id: 'a', connection: 'c1' }), send() {} };
  await h.room.webSocketMessage(ws, JSON.stringify({ type: 'ready' })); clearTimeout(h.room.timer);
  assert.equal(r.status, 'playing'); assert.equal(r.round, 2);
  assert.equal(r.status, 'playing'); r.status = 'finished';
});
test('the hockey page: a cover, three ways to play on the first screen, the wait counted down, the computer named', async () => {
  const page = await read('public/hockey.html'), main = await read('public/assets/js/hockey/main.js');
  assert.match(page, /<h1>هوكي الهواء<\/h1>/); assert.doesNotMatch(page, /AIR HOCKEY · ARENA|LIVE MATCH/);
  assert.match(page, /<p id="hkSearch" class="hk-search" role="status" hidden><\/p>/);
  assert.match(main, /يلعب معك منافس آلي/); assert.match(main, /dataset\.bot = String\(Boolean\(online\?\.state\?\.players\?\.\[1 - online\.seat\]\?\.bot\)\)/);
  assert.match(main, /const NAME_KEY='bs-player-name-v33';/);
  assert.ok(JSON.parse(await read('scripts/style-bundles.json'))['hockey.html'].includes('assets/css/hockey-v33-8.css'));
});

/* ---------- snakes: «الصدام» ---------- */
test('«الصدام»: landing on opponents pushes each back ten (never below 1); a six rolls again; 100 needs the exact number', () => {
  let s = createClashGame(['أ', 'ب', 'ج']); s.players[0].position = 4; s.players[1].position = 7; s.players[2].position = 7;
  let n = playClashTurn(s, 3);
  assert.deepEqual(n.players.map((p) => p.position), [7, 1, 1]); assert.equal(n.lastEvent.bumped.length, 2); assert.equal(n.bumps[0], 2); assert.equal(n.turn, 1);
  s = createClashGame(['أ', 'ب']); s.players[0].position = 30; s.players[1].position = 36;
  n = playClashTurn(s, 6); assert.equal(n.players[1].position, 36 - CLASH_BACK); assert.equal(n.turn, 0, 'a six rolls again');
  s = createClashGame(['أ', 'ب']); s.players[0].position = 97; s.players[1].position = 99;
  n = playClashTurn(s, 4); assert.equal(n.players[0].position, 97); assert.deepEqual(n.lastEvent.bumped, []);
  n = playClashTurn(s, 2); assert.equal(n.players[1].position, 99 - CLASH_BACK);
  assert.equal(createClashGame(['أ', 'ب']).entrySix, false, 'a direct start');
  const reach = clashTargets(createClashGame(['أ', 'ب']), 0); assert.equal(reach.length, 6);
});
test('the server plays «الصدام», quick tables offer it, and the page lists it in place of «اختيار المصير»', async () => {
  assert.equal(normalizeSnakesVariant('clash'), 'clash');
  const s = createSnakesServerGame(['أ', 'ب'], { variant: 'clash' }); assert.equal(s.variant, 'clash');
  const out = rollSnakesServer(s, 0, () => 0.5); assert.equal(out.state.lastEvent.total, 4);
  assert.throws(() => rollSnakesServer(s, 0, () => 0.5, { power: 'double' }), /invalid_power/);
  assert.match(await read('src/index.js'), /\['adventure','strategy','clash'\]\.includes\(body\.variant\)/);
  const page = await read('public/snakes.html');
  assert.match(page, /\{ id: "clash", label: "الصدام", hint: "وقّف على خصمك"/);
  assert.doesNotMatch(page, /\{id:"choice",label:"اختيار المصير"/);
  assert.match(page, /function renderClashReach\(\)/);
  assert.match(await read('public/assets/js/snakes-v4-fx.js'), /for\(const hit of event\.bumped\|\|\[\]\)duration\+=260\+walk\(hit\.from,hit\.to\);/);
});

/* ---------- emoji ---------- */
test('every emoji reaction is drawn and animated; the rarest come with a legendary entrance', async () => {
  const h = await createDOM('snakes.html');
  await h.runFile('assets/js/emoji-faces-v33-8.js');
  const art = h.context.BS_EMOJI_ART;
  for (const it of Career.REACTIONS.filter((x) => x.type === 'emote')) {
    assert.ok(art.has(it), it.id);
    const node = art.make(it);
    assert.match(node.innerHTML, /^<svg class="bsf[^"]*" viewBox="0 0 100 100"/, it.id);
  }
  assert.equal(art.make({ type: 'move', fx: 'cinema-wave' }), null, 'the performances keep their cast');
  const kit = await read('public/assets/js/emoji-faces-v33-8.js');
  assert.match(kit, /\.rx-emote\.tier-legendary::before\{/);
  assert.match(kit, /@media \(prefers-reduced-motion:reduce\)\{\.bsf \*\{animation:none!important\}/);
  const cast = await read('public/assets/js/reaction-performers.js');
  assert.match(cast, /if\(it\?\.type==='emote'&&window\.BS_EMOJI_ART\?\.has\?\.\(it\)\)return window\.BS_EMOJI_ART\.make\(it\);/);
  assert.match(cast, /s\.src='\/assets\/js\/emoji-faces-v33-8\.js\?v=/);
  const shell = (await read('public/service-worker.js')).match(/const\s+APP_SHELL\s*=\s*\[([\s\S]*?)\];/)[1];
  assert.doesNotMatch(shell, /emoji-faces-v33-8/, 'the drawings stay outside the offline core');
});

/* ---------- home and word hunt ---------- */
test('home: tonight\'s tables on a strip of covers, the new Jackaroo cover, compact game cards', async () => {
  const home = await read('public/index.html');
  assert.match(home, /<div class="home-featured" role="list" aria-label="طاولات الليلة">/);
  for (const href of ['/baloot', '/jackaroo', '/snakes', '/hockey', '/uno']) assert.match(home, new RegExp('<a role="listitem" class="home-feature" href="' + href + '">'));
  assert.equal((home.match(/jackaroo-cover-v33-8\.webp/g) || []).length, 2);
  assert.doesNotMatch(home, /jackaroo-table-v17\.webp/);
  assert.ok((await stat(new URL('../public/assets/brand/jackaroo-cover-v33-8.webp', import.meta.url))).size > 20000);
  assert.ok(JSON.parse(await read('scripts/style-bundles.json'))['index.html'].includes('assets/css/home-v33-8.css'));
  assert.match(await read('public/assets/css/app-index.css'), /\.home-featured\{display:flex;/);
});
test('the word hunt strikes a found word through in the colour of whoever found it', async () => {
  const css = await read('public/assets/css/wordhunt-v33-5.css');
  assert.match(css, /\.ch-hunt-word\.found \.ch-hunt-label::after\{content:'';position:absolute;inset-inline:-5px;top:50%;height:3px;/);
  assert.doesNotMatch(css, /content:'✓'/);
});
