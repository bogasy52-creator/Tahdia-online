// 33.18.0: «برج التحديات» (a 3D obstacle tower: 100 levels in six worlds, races for 2 to 8 in public
// or private rooms, three modes, weekly and all-time boards), a full-screen start page for every game,
// and pages that tell Android's forced dark mode to leave the cards alone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import * as T from '../public/assets/js/tower/course.js';
import { Runner } from '../public/assets/js/tower/physics.js';
import { TowerRoom, towerWeek } from '../src/tower/tower-room.js';
import { ROOM_FAMILIES, roomCodeFor, gameOfCode } from '../src/rooms/room-codes.js';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('the tower: a hundred levels in six worlds, each led by a new challenge and no two alike', () => {
  assert.equal(T.LEVELS.length, 100); assert.equal(T.WORLDS.length, 6); assert.equal(T.CHALLENGE_IDS.length, 21);
  assert.deepEqual(T.WORLDS.map((w) => w.name), ['الغابة', 'الجليد', 'الحلوى', 'الصحراء', 'الفضاء', 'الحمم البركانية']);
  const mixes = new Set(); let prev = '';
  for (const L of T.LEVELS) {
    const mix = L.lead + '+' + L.challenges.filter((c) => c !== L.lead).sort().join('+');
    assert.ok(!mixes.has(mix), 'level ' + L.n + ' repeats a mix'); mixes.add(mix);
    assert.notEqual(L.lead, prev, 'level ' + L.n + ' leads with the same challenge as the one before'); prev = L.lead;
    assert.ok(L.challenges.includes(L.lead) && L.d >= 0 && L.d <= 1);
    const c = T.levelCourse(L.n);
    assert.equal(c.gems.length, 3, 'level ' + L.n);
    assert.equal(c.checkpoints.length, L.challenges.length);
    assert.ok(c.finish.z > 40 && c.gold < c.par && c.kill < 0, 'level ' + L.n);
  }
  assert.ok(T.LEVELS.filter((L) => L.finale).length === 6, 'every world ends with its summit');
  for (const id of T.CHALLENGE_IDS) assert.ok(T.LEVELS.some((L) => L.lead === id), id + ' never leads a level');
  assert.equal(T.worldOf(69).id, 'space'); assert.ok(T.worldById('space').g < 1, 'space has lighter gravity');
  // an online round is the same course on every phone
  assert.deepEqual(T.roundCourse(77, 1, 8).challenges, T.roundCourse(77, 1, 8).challenges);
  assert.equal(T.roundCourse(77, 1, 8).challenges.length, 4);
});

test('the runner: stands, walks across seams, steps up, jumps about two metres and is thrown by a hammer', () => {
  const box = (x, y, z, w, d, m = 'floor', h = 1) => ({ k: 'box', x, y, z, w, h, d, m });
  const course = { g: 1, pieces: [box(0, 0, 2, 6, 6, 'start'), box(0, 0, 8, 6, 6), box(0, 0.32, 12, 6, 2), box(0, 0.4, 15, 6, 4, 'rest')], checkpoints: [{ i: 0, x: 0, y: 0, z: 0.5 }, { i: 1, x: 0, y: 0.4, z: 15 }], gems: [], finish: { x: 0, y: 0.4, z: 30, w: 6 }, kill: -14 };
  course.pieces.forEach((p, i) => { p.id = i; });
  const r = new Runner(course); let t = 0;
  for (let i = 0; i < 80; i++) { r.update(1 / 60, t, { x: 0, z: 1, jump: false }); t += 1 / 60; }
  assert.ok(r.z > 6 && r.z < 10.5 && r.grounded && r.ground.id === 1 && Math.abs(r.y) < 1e-6, 'walked from the start onto the next platform without catching on the seam');
  for (let i = 0; i < 70 && r.z < 15.5; i++) { r.update(1 / 60, t, { x: 0, z: 1, jump: false }); t += 1 / 60; }
  assert.ok(r.y >= 0.32 - 1e-6, 'stepped up the low ledge');
  assert.equal(r.cp, 1, 'the checkpoint counts once you stand past it');
  const apex = T.JUMP * T.JUMP / (2 * T.GRAVITY); assert.ok(apex > 1.9 && apex < 2.2);
  const h = new Runner({ ...course, pieces: [box(0, 0, 0, 10, 10), { k: 'ham', id: 9, x: 0, y: 5.2, z: 0.5, L: 4.2, hr: 0.9, amp: 1.05, p: 2, ph: 0 }] });
  h.update(1 / 60, 0.01, { x: 0, z: 0, jump: false });
  assert.ok(h.events.some((e) => e.type === 'hit') && Math.abs(h.vx) > 10, 'the hammer knocks the runner sideways');
});

function context() { const values = new Map(), sockets = []; return { values, sockets, storage: { async get(k) { return structuredClone(values.get(k)); }, async put(k, v) { values.set(k, structuredClone(v)); }, async delete(k) { values.delete(k); }, async setAlarm(t) { this.alarm = t; } }, blockConcurrencyWhile: (fn) => Promise.resolve().then(fn), acceptWebSocket(ws) { sockets.push(ws); }, getWebSockets() { return sockets; } }; }
function sockets(t) {
  const OriginalResponse = globalThis.Response, OriginalPair = globalThis.WebSocketPair;
  globalThis.WebSocketPair = class { constructor() { for (let i = 0; i < 2; i++) this[i] = { sent: [], send(raw) { this.sent.push(JSON.parse(raw)); }, serializeAttachment(a) { this.a = a; }, deserializeAttachment() { return this.a; }, close() {} }; } };
  globalThis.Response = class extends OriginalResponse { constructor(body, init) { if (init?.status === 101) { super(null, { status: 200 }); Object.defineProperty(this, 'status', { value: 101 }); } else super(body, init); } static json(v, i) { return new OriginalResponse(JSON.stringify(v), { ...i, headers: { 'content-type': 'application/json' } }); } };
  t.after(() => { globalThis.Response = OriginalResponse; globalThis.WebSocketPair = OriginalPair; });
}
const join = async (room, name, { hk, user } = {}) => {
  const headers = { Upgrade: 'websocket', 'sec-websocket-protocol': ['bs-tower-v1', ...(hk ? ['hk.' + hk] : [])].join(', ') }; if (user) headers['x-bs-account'] = user;
  const res = await room.fetch(new Request('https://tower.internal/ws?name=' + encodeURIComponent(name), { headers }));
  return { res, ws: room.ctx.sockets.at(-1) };
};
const say = (room, ws, m) => room.webSocketMessage(ws, JSON.stringify(m));

test('a private room: only the host starts, finishes must be earned, places and the board follow', async (t) => {
  sockets(t); let now = 9_000_000; t.mock.method(Date, 'now', () => now);
  const board = new TowerRoom(context(), {}), env = { ROOMS: { idFromName: (n) => n, get: (n) => ({ fetch: (url, init) => (n === 'tower:board' ? board.fetch(new Request(url, init)) : Promise.resolve(new Response('{}'))) }) } };
  const room = new TowerRoom(context(), env); room.run = () => {}; await room.ready;
  assert.equal((await room.fetch(new Request('https://tower.internal/init', { method: 'POST', body: JSON.stringify({ code: '041234', hostKey: 'k'.repeat(40), mode: 'race', capacity: 4 }) }))).status, 201);
  assert.equal((await join(room, 'دخيل')).res.status, 403, 'the first one in needs the host key');
  const host = await join(room, 'سعد', { hk: 'k'.repeat(40), user: 'saad' }), guest = await join(room, 'ريم', { user: 'reem' });
  assert.equal(host.res.status, 101); assert.equal(guest.res.status, 101);
  await say(room, guest.ws, { type: 'start' }); assert.equal(room.r.status, 'lobby', 'a guest cannot start');
  await say(room, host.ws, { type: 'start' }); assert.equal(room.r.status, 'playing');
  assert.equal(room.r.players.filter((p) => p.bot).length, 0, 'a room with friends is only friends');
  const c = T.roundCourse(room.r.seed, 0, 2), [saad, reem] = room.r.players;
  now = room.r.startAt + 1000; await say(room, host.ws, { type: 'fin' }); assert.equal(saad.fin, null, 'no finish without the checkpoints');
  await say(room, guest.ws, { type: 'pos', x: 0, y: 0, z: 500, cp: c.checkpoints.length - 1 }); assert.equal(reem.pos[2], 0, 'a first report far from the start is ignored');
  for (const cp of c.checkpoints) { now += 4000; await say(room, host.ws, { type: 'pos', x: 0, y: cp.y, z: cp.z, ry: 0, a: 1, cp: cp.i }); }
  now += 3000; await say(room, host.ws, { type: 'pos', x: 0, y: c.finish.y, z: c.finish.z, ry: 0, a: 1, cp: c.checkpoints.length - 1 });
  now = Math.max(now, room.r.startAt + c.nominal * 1000); await say(room, host.ws, { type: 'fin' });
  assert.ok(saad.fin > 0);
  now += 26_000; await room.tick();
  assert.equal(room.r.status, 'finished'); assert.equal(saad.place, 1); assert.equal(saad.points, 100); assert.equal(reem.points, 10);
  const res = await board.fetch(new Request('https://tower.internal/board?period=week&me=saad')), d = await res.json();
  assert.deepEqual(d.rows.map((r) => [r.name, r.points, r.wins]), [['سعد', 100, 1], ['ريم', 10, 0]]);
  assert.deepEqual(d.me, { rank: 1, points: 100 }); assert.equal(d.week, towerWeek(now));
  await say(room, host.ws, { type: 'start' }); assert.equal(room.r.status, 'playing', 'the host can run another race in the same room');
});

test('public races fill the empty seats with named runners; إقصاء ends with one, فرق splits evenly', async (t) => {
  sockets(t); let now = 20_000_000; t.mock.method(Date, 'now', () => now);
  const env = { ROOMS: { idFromName: (n) => n, get: () => ({ fetch: async () => new Response('{}') }) } };
  for (const mode of ['elim', 'teams']) {
    const room = new TowerRoom(context(), env); room.run = () => {}; await room.ready;
    await room.fetch(new Request('https://tower.internal/init', { method: 'POST', body: JSON.stringify({ code: '045555', quick: true, mode, capacity: 8 }) }));
    await join(room, 'لاعب'); assert.ok(room.r.lobbyUntil > now, 'a public race waits a few seconds for more players');
    now = room.r.lobbyUntil + 1; await room.step();
    assert.equal(room.r.status, 'playing'); assert.ok(room.r.players.length >= 6);
    const filled = room.r.players.filter((p) => p.bot);
    assert.ok(filled.length >= 5 && filled.every((p) => p.name && !/بوت|كمبيوتر|bot/i.test(p.name)), 'filled seats carry people names');
    if (mode === 'teams') { const teams = [0, 0]; room.r.players.forEach((p) => teams[p.team]++); assert.equal(teams[0], teams[1]); }
    let guard = 0; while (room.r.status !== 'finished' && guard++ < 8000) { now += 100; if (room.r.status === 'between') await room.step(); else await room.tick(); }
    assert.equal(room.r.status, 'finished');
    const places = room.r.players.map((p) => p.place).sort((a, b) => a - b); assert.deepEqual(places, room.r.players.map((_, i) => i + 1));
    if (mode === 'elim') assert.ok(room.r.round >= 1, 'إقصاء ran more than one round');
    if (mode === 'teams') assert.ok([0, 1].includes(room.r.winnerTeam));
  }
});

test('the tower is wired in: its code family, routes, page, home card and menus', async () => {
  assert.deepEqual(ROOM_FAMILIES.tower, { from: 4, to: 4, page: '/tower' });
  for (let i = 0; i < 20; i++) assert.equal(gameOfCode(roomCodeFor('tower')), 'tower');
  const index = await read('src/index.js');
  for (const route of ['/api/tower/quick', '/api/tower/rooms', '/api/tower/board', "tower:queue:", 'towerDelegate', "hostname==='tower.internal'"]) assert.ok(index.includes(route), route);
  assert.match(index, /\(04\\d\{4\}\)/);
  const wrangler = await read('wrangler.jsonc'); assert.doesNotMatch(wrangler, /Tower/, 'no new Durable Object class');
  const page = await read('public/tower.html');
  assert.match(page, /<script type="module" src="assets\/js\/tower\/main\.js\?v=/); assert.match(page, /app-tower\.css/);
  for (const id of ['twCanvas', 'twLevels', 'twWardGrid', 'twQuick', 'twCreate', 'twJoin', 'twBoardList', 'twStickZone', 'twJump', 'twResult', 'twRound']) assert.ok(page.includes('id="' + id + '"'), id);
  const home = await read('public/index.html'); assert.match(home, /<a href="\/tower" class="home-game home-tower"/);
  assert.ok((await stat(new URL('../public/assets/brand/tower-cover-v33-18.webp', import.meta.url))).size > 5000);
  const menu = await read('public/assets/js/game-menu-v33.js'); assert.match(menu, /\['tower',4,4,'\/tower'\]/); assert.match(menu, /tower:'برج التحديات'/);
  for (const file of ['public/assets/js/tower/main.js', 'public/assets/js/tower/course.js', 'public/assets/js/tower/scene.js', 'src/tower/tower-room.js', 'public/tower.html']) assert.doesNotMatch(await read(file), /بوت|كمبيوتر/, file);
  const main = await read('public/assets/js/tower/main.js');
  assert.match(main, /#twBoard \[data-tw-board\]/, 'the board tabs are found inside the board, not on <body data-board>');
  assert.doesNotMatch(main, /querySelectorAll\('\[data-/);
});

test('every game opens on a full-screen start page that comes up early and stays until the game is on', async () => {
  const js = await read('public/assets/js/instant-play-v33-12.js'), css = await read('public/assets/css/instant-play-v33-12.css');
  assert.match(js, /function domReady\(fn\)/); assert.match(js, /domReady\(\(\) => \{ if \(game\.groups\?\.length\) \{ clearTimeout\(safety\); sheet\(\); \} \}\);/);
  assert.match(js, /await loaded;/); assert.match(js, /نجهّز اللعبة…/); assert.match(js, /await start\(chosen\); box\.remove\(\);/);
  assert.match(js, /const ABOUT = Object\.freeze\(\{/);
  assert.match(css, /\.ip-card\{[^}]*min-height:100%/); assert.match(css, /\.ip-cover\{[^}]*height:min\(44vh,380px\)/); assert.match(css, /\.ip-play\{position:sticky;/);
});

test('pages ask forced dark mode to leave them alone, and the snakes game has its name everywhere', async () => {
  const pages = (await readdir(new URL('../public/', import.meta.url))).filter((f) => f.endsWith('.html'));
  assert.ok(pages.length >= 50);
  for (const page of pages) { const html = await read('public/' + page); assert.equal((html.match(/<meta name="color-scheme" content="only light">/g) || []).length, 1, page); }
  for (const file of ['public/snakes.html', 'public/index.html', 'public/assets/js/game-menu-v33.js', 'public/assets/js/instant-play-v33-12.js', 'public/assets/js/profile-core.js', 'public/assets/js/shop-v31.js', 'src/presence/presence-registry.js', 'src/games/board-tables.js']) {
    const text = await read(file); assert.doesNotMatch(text, /الثعبان والسلالم/, file);
  }
  assert.match(await read('public/assets/js/instant-play-v33-12.js'), /الثعابين والسلالم/);
});
