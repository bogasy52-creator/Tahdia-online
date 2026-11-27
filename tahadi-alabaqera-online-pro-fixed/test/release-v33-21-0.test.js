// 33.21.0: «عشر ثواني» is played live. In «الغرف» every player sits at the same table (it used to be
// each phone alone against made-up names), and the game page has a public table and a friends room.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { TenRoom, TEN_TARGET, TEN_LIMIT } from '../src/ten/ten-room.js';
import { createLinkedRoom, LINKED_GAMES, LINK_ONLY, localGame } from '../src/party/party-link.js';
import { roomCodeFor, ROOM_FAMILIES } from '../src/rooms/room-codes.js';
import { SOCIAL_ONLINE_GAMES, gameJoinPath } from '../src/social/social-core.js';
import { environment, api, signup } from './worker-harness.mjs';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');
function context() { const values = new Map(), sockets = []; return { values, sockets, storage: { async get(k) { return structuredClone(values.get(k)); }, async put(k, v) { values.set(k, structuredClone(v)); }, async delete(k) { values.delete(k); }, async setAlarm(t) { this.alarm = t; } }, blockConcurrencyWhile: (fn) => Promise.resolve().then(fn), acceptWebSocket(ws) { sockets.push(ws); }, getWebSockets() { return sockets; } }; }
function sockets(t) {
  const OriginalResponse = globalThis.Response, OriginalPair = globalThis.WebSocketPair;
  globalThis.WebSocketPair = class { constructor() { for (let i = 0; i < 2; i++) this[i] = { sent: [], send(raw) { this.sent.push(JSON.parse(raw)); }, serializeAttachment(a) { this.a = a; }, deserializeAttachment() { return this.a; }, close() {} }; } };
  globalThis.Response = class extends OriginalResponse { constructor(body, init) { if (init?.status === 101) { super(null, { status: 200 }); Object.defineProperty(this, 'status', { value: 101 }); } else super(body, init); } static json(v, i) { return new OriginalResponse(JSON.stringify(v), { ...i, headers: { 'content-type': 'application/json' } }); } };
  t.after(() => { globalThis.Response = OriginalResponse; globalThis.WebSocketPair = OriginalPair; });
}
const join = async (room, name, { hk, user } = {}) => {
  const headers = { Upgrade: 'websocket', 'sec-websocket-protocol': ['bs-ten-v1', ...(hk ? ['hk.' + hk] : [])].join(', ') }; if (user) headers['x-bs-account'] = user;
  const res = await room.fetch(new Request('https://ten.internal/ws?name=' + encodeURIComponent(name), { headers }));
  return { res, ws: room.ctx.sockets.at(-1) };
};
const say = (room, ws, m) => room.webSocketMessage(ws, JSON.stringify(m));
const last = (ws) => ws.sent.filter((m) => m.type === 'state').at(-1)?.state;
const goNow = (room) => { room.r.goAt = Date.now() - 1; };

test('a friends room: the owner starts, everyone stops their own clock, the farthest from ten leaves', async (t) => {
  sockets(t);
  const room = new TenRoom(context(), {}); room.run = () => {}; await room.ready;
  assert.equal((await room.fetch(new Request('https://ten.internal/init', { method: 'POST', body: JSON.stringify({ code: '031234', hostKey: 'k'.repeat(40), capacity: 8 }) }))).status, 201);
  assert.equal((await join(room, 'سعد')).res.status, 403, 'nobody gets in before the owner opens it');
  const host = await join(room, 'سعد', { hk: 'k'.repeat(40) }), a = await join(room, 'ريم'), b = await join(room, 'نوف');
  assert.equal(host.res.status, 101);
  await say(room, a.ws, { type: 'start' }); assert.equal(room.r.status, 'lobby', 'only the owner starts');
  await say(room, host.ws, { type: 'start' });
  assert.equal(room.r.status, 'count'); assert.equal(room.r.players.length, 3, 'a friends room is only the friends');
  assert.ok(room.r.players.every((p) => !p.bot));
  await say(room, host.ws, { type: 'stop', round: 1, ms: 10_000 }); assert.equal(room.r.players[0].last, null, 'pressing during the countdown does nothing');
  goNow(room);
  const [h, x, y] = room.r.players;
  room.r.goAt = Date.now() - 9_950; await say(room, host.ws, { type: 'stop', round: 1, ms: 9_980 });
  assert.equal(h.last, 9_980, 'the phone\'s own clock counts when it agrees with the room');
  // while the round runs nobody sees another player's time, and only those who stopped see who stopped
  const seen = last(a.ws); assert.equal(seen.players.find((p) => p.id === h.sid).last, null); assert.equal(seen.players.find((p) => p.id === h.sid).stopped, false);
  assert.equal(last(host.ws).players.find((p) => p.id === h.sid).last, 9_980);
  room.r.goAt = Date.now() - 4_000; await say(room, a.ws, { type: 'stop', round: 1, ms: 10_000 });
  assert.ok(Math.abs(x.last - 4_000) < 200, 'a claim far from the room\'s clock is replaced by it');
  assert.equal(last(a.ws).players.find((p) => p.id === h.sid).stopped, true);
  room.r.goAt = Date.now() - 11_000; await say(room, b.ws, { type: 'stop', round: 1, ms: 11_000 });
  assert.equal(room.r.status, 'reveal', 'the round ends when everyone has stopped');
  assert.deepEqual(room.r.leftThisRound, [x.sid], '4 seconds was the farthest from ten');
  assert.ok(x.out && !h.out && !y.out);
  const shown = last(b.ws); assert.equal(shown.players.find((p) => p.id === h.sid).last, 9_980, 'the reveal shows every time');
  room.r.nextAt = Date.now() - 1; await room.step();
  assert.equal(room.r.status, 'count'); assert.equal(room.r.round, 2);
  assert.ok(room.r.goAt > Date.now(), 'a countdown before every round');
  goNow(room); room.r.goAt = Date.now() - 10_000;
  await say(room, host.ws, { type: 'stop', round: 2, ms: 10_000 });
  await say(room, a.ws, { type: 'stop', round: 2, ms: 10_000 }); assert.equal(x.last, 4_000, 'a player who left watches: a press changes nothing');
  await say(room, b.ws, { type: 'stop', round: 2, ms: 10_000 + 900 });
  assert.equal(room.r.status, 'finished');
  assert.deepEqual(room.r.players.map((p) => p.place), [1, 3, 2]);
  await say(room, host.ws, { type: 'start' }); assert.equal(room.r.status, 'count', 'the owner can play again with the same room');
});

test('a player who drops is not waited for, and the time limit ends a round', async (t) => {
  sockets(t);
  const room = new TenRoom(context(), {}); room.run = () => {}; await room.ready;
  await room.fetch(new Request('https://ten.internal/init', { method: 'POST', body: JSON.stringify({ code: '031235', hostKey: 'k'.repeat(40) }) }));
  const host = await join(room, 'سعد', { hk: 'k'.repeat(40) }), a = await join(room, 'ريم'), b = await join(room, 'نوف');
  await say(room, host.ws, { type: 'start' }); goNow(room);
  await room.webSocketClose(b.ws);
  room.r.goAt = Date.now() - 10_000;
  await say(room, host.ws, { type: 'stop', round: 1, ms: 10_000 });
  await say(room, a.ws, { type: 'stop', round: 1, ms: 10_100 });
  assert.equal(room.r.status, 'reveal'); assert.equal(room.r.players[2].last, TEN_LIMIT); assert.ok(room.r.players[2].out);
  room.r.nextAt = 0; await room.step(); room.r.goAt = Date.now() - TEN_LIMIT - 2000; await room.step();
  assert.equal(room.r.status, 'finished', 'nobody pressed: the limit ends it');
  void TEN_TARGET;
});

test('«الغرف»: one live table for the whole group, starting by itself, reporting the places', async (t) => {
  sockets(t);
  assert.equal(LINKED_GAMES.ten.page, '/ten'); assert.ok(LINK_ONLY.has('ten')); assert.equal(localGame('ten'), null, 'no longer each phone alone');
  const OR = globalThis.Response, rooms = new Map(), reports = [];
  const env = { ROOMS: { idFromName: (n) => n, get: (n) => ({ fetch: async (url, init) => { if (n.startsWith('party:')) { reports.push(JSON.parse(init.body)); return new OR('{}'); } if (!rooms.has(n)) { const r = new TenRoom(context(), env); r.run = () => {}; rooms.set(n, r); } return rooms.get(n).fetch(new Request(url, init)); } }) } };
  const made = await createLinkedRoom(env, 'ten', { settings: {}, count: 3, link: { code: '151234', round: crypto.randomUUID(), token: 'x'.repeat(40) } });
  assert.equal(made.ok, true); assert.equal(made.page, '/ten'); assert.match(made.code, /^03\d{4}$/);
  const room = rooms.get('ten:' + made.code);
  const one = await join(room, 'سعد'), two = await join(room, 'ريم');
  assert.equal(one.res.status, 101, 'no owner key in a group round');
  await room.step(); assert.equal(room.r.status, 'lobby', 'waits for the third');
  const three = await join(room, 'نوف'); await room.step();
  assert.equal(room.r.status, 'count');
  assert.deepEqual(room.r.players.filter((p) => !p.bot).map((p) => p.name).sort(), ['ريم', 'سعد', 'نوف'], 'all three at the same table');
  assert.equal(room.r.players.length, 4, 'one seat filled so the table has its rounds');
  // play it out: the friends stop near ten, the filled seat plays its own time
  const sockets3 = { [one.ws.a.id]: one.ws, [two.ws.a.id]: two.ws, [three.ws.a.id]: three.ws };
  for (let g = 0; room.r.status !== 'finished' && g < 40; g++) {
    if (room.r.status === 'reveal') { room.r.nextAt = 0; await room.step(); continue; }
    room.r.goAt = Date.now() - 10_000;
    for (const p of room.r.players.filter((x) => !x.bot && !x.out)) await say(room, sockets3[p.sid], { type: 'stop', round: room.r.round, ms: 10_000 + (p.name.length * 37) });
    room.r.goAt = Date.now() - TEN_LIMIT - 2000; await room.step();
  }
  assert.equal(room.r.status, 'finished');
  const rows = reports.at(-1)?.standings; assert.ok(Array.isArray(rows)); assert.equal(rows.length, 3, 'the group room gets its three real players');
});

test('the public table: one open table at a time, filled to six, starting after a short wait', async (t) => {
  sockets(t);
  const OR = globalThis.Response, rooms = new Map();
  const env = { ROOMS: { idFromName: (n) => n, get: (n) => ({ fetch: async (url, init) => { if (!rooms.has(n)) { const r = new TenRoom(context(), env); r.run = () => {}; rooms.set(n, r); } return rooms.get(n).fetch(new Request(url, init)); } }) } };
  void OR;
  const q = () => env.ROOMS.get('ten:queue').fetch('https://ten.internal/queue', { method: 'POST', body: '{}' }).then((r) => r.json());
  const first = await q(), second = await q();
  assert.match(first.code, /^03\d{4}$/); assert.equal(second.code, first.code, 'the second player sits at the same table');
  const room = rooms.get('ten:' + first.code);
  await join(room, 'سعد'); await join(room, 'ريم');
  assert.ok(room.r.lobbyUntil > Date.now());
  room.r.lobbyUntil = Date.now() - 1; await room.step();
  assert.equal(room.r.status, 'count'); assert.equal(room.r.players.length, 6);
  const third = await q(); assert.notEqual(third.code, first.code, 'a started table is not handed out again');
});

test('codes, invites and the page', async () => {
  assert.deepEqual(ROOM_FAMILIES.ten, { from: 3, to: 3, page: '/ten' }); assert.match(roomCodeFor('ten'), /^03\d{4}$/);
  assert.ok(SOCIAL_ONLINE_GAMES.has('ten')); assert.equal(gameJoinPath('ten', '031234'), '/ten?room=031234');
  const api = await read('src/social/social-api.js'); assert.match(api, /'tower','ten'\]\.includes\(game\)/); assert.match(api, /ten:'ten:'/);
  const index = await read('src/index.js');
  assert.match(index, /\/api\/ten\/quick/); assert.match(index, /\\\/api\\\/ten\\\/rooms\\\/\(03\\d\{4\}\)/); assert.match(index, /hostname==='ten\.internal'/); assert.match(index, /\?\.ten\)return \(await this\.tenDelegate\(\)\)\.webSocketMessage/);
  assert.equal((index.match(/\?\.ten\)return \(await this\.tenDelegate\(\)\)\.webSocketClose/g) || []).length, 2);
  const menu = await read('public/assets/js/game-menu-v33.js'); assert.match(menu, /\['ten',3,3,'\/ten'\]/);
  const html = await read('public/ten.html'), js = await read('public/assets/js/ten-v33-12.js');
  for (const id of ['tsOnlineBtn', 'tsFriendsBtn', 'tsLobby', 'tsCode', 'tsLobbyPlayers', 'tsInvite', 'tsShare', 'tsStart', 'tsLeave', 'tsResultFriends', 'tsResultSolo', 'tsResultWait', 'tsIntroError']) { assert.match(html, new RegExp('id="' + id + '"'), id); assert.match(js, new RegExp("\\$\\('" + id + "'\\)"), id + ' is wired'); }
  assert.doesNotMatch(html, /href="\/party\?game=ten"/, 'the page no longer sends friends to the group room page');
  assert.ok(html.indexOf('social-client.js') < html.indexOf('ten-v33-12.js'));
  assert.match(js, /bs-ten-v1/); assert.match(js, /openInvitePicker\(\{ game: 'ten'/);
  const instant = await read('public/assets/js/instant-play-v33-12.js'); assert.match(instant, /key === 'ten' \? loc\.pathname \+ '\?play=room'/); assert.match(instant, /start: '#tsPlay', running: 'body\.ts-running', online: true \}/);
  const engine = await read('src/party/party-engine.js'); assert.match(engine, /const PAGE_ONLY=new Set\(\['blocks'\]\)/);
});

// 33.21.0: the owner (BoSraG) can set a new password for any account
test('the owner sets a new password for an account: old one stops, new one works, the account is signed out everywhere', async () => {
  const env = environment(), owner = await signup(env, 'bosrag'), player = await signup(env, 'playera');
  const id = () => 'pw-' + crypto.randomUUID();
  assert.equal((await api(env, '/api/social/career', undefined, player.data.token)).response.status, 200);
  // nobody else can do it
  const other = await signup(env, 'playerb');
  assert.equal((await api(env, '/api/social/admin/action', { username: 'playera', action: 'password', password: 'Taken12345', requestId: id() }, other.data.token)).response.status, 403);
  // too short is refused with the signup's own message
  const short = await api(env, '/api/social/admin/action', { username: 'playera', action: 'password', password: 'abc', requestId: id() }, owner.data.token);
  assert.equal(short.response.status, 400); assert.match(short.data.error, /8 أحرف/);
  const done = await api(env, '/api/social/admin/action', { username: 'playera', action: 'password', password: 'NewPass2026', reason: 'نسي كلمة المرور', requestId: id() }, owner.data.token);
  assert.equal(done.response.status, 200, JSON.stringify(done.data));
  assert.equal((await api(env, '/api/social/career', undefined, player.data.token)).response.status, 401, 'the old session is gone');
  assert.equal((await api(env, '/api/social/login', { username: 'playera', password: 'StrongPass123!' })).response.status, 401, 'the old password no longer works');
  const login = await api(env, '/api/social/login', { username: 'playera', password: 'NewPass2026' });
  assert.equal(login.response.status, 200); assert.ok(login.data.token);
  // the log says who and why, never the password
  const audit = await api(env, '/api/social/admin', undefined, owner.data.token);
  const entry = audit.data.audit.find((e) => e.action === 'password');
  assert.equal(entry.username, 'playera'); assert.equal(entry.reason, 'نسي كلمة المرور');
  assert.doesNotMatch(JSON.stringify(audit.data), /NewPass2026/);
  const ownerStore = env.BOARD_ROOMS.peek('social:user:bosrag').ctx.storage;
  const everything = JSON.stringify([...(await ownerStore.list()).values()]);
  assert.doesNotMatch(everything, /NewPass2026/, 'the owner\'s records keep no copy');
  // the owner changing their own password stays signed in where they did it
  const self = await api(env, '/api/social/admin/action', { username: 'bosrag', action: 'password', password: 'OwnerPass2026', requestId: id() }, owner.data.token);
  assert.equal(self.response.status, 200);
  assert.equal((await api(env, '/api/social/admin', undefined, owner.data.token)).response.status, 200);
  assert.equal((await api(env, '/api/social/login', { username: 'bosrag', password: 'OwnerPass2026' })).response.status, 200);
});

test('the admin page offers the password change and never keeps the password', async () => {
  const html = await read('public/admin.html'), js = await read('public/assets/js/admin.js');
  assert.match(html, /<option value="password">تغيير كلمة المرور<\/option>/); assert.match(html, /id="adminNewPassword"[^>]*autocomplete="new-password"/);
  assert.match(js, /if\(body\.action!=='password'\)localStorage\.setItem\(PENDING/);
  assert.match(js, /password:action==='password'\?\$\('adminNewPassword'\)\.value:undefined/);
});
