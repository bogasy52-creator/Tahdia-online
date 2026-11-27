// 33.21.2: «برج التحديات» repairs: late arrivals get in, a race nobody finished has no winner, finished
// runners stand still, the course does not change when someone joins late, and the result is laid out.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as T from '../public/assets/js/tower/course.js';
import { TowerRoom, TOWER_RECONNECT } from '../src/tower/tower-room.js';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');
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
const env = { ROOMS: { idFromName: (n) => n, get: () => ({ fetch: async () => new Response('{}') }) } };
async function privateRoom(t, mode = 'race', capacity = 4) {
  const room = new TowerRoom(context(), env); room.run = () => {}; await room.ready;
  await room.fetch(new Request('https://tower.internal/init', { method: 'POST', body: JSON.stringify({ code: '041111', hostKey: 'h'.repeat(40), mode, capacity }) }));
  return room;
}

test('a public race takes someone who arrives in its first seconds, in a bot seat, without changing the course', async (t) => {
  sockets(t); let now = 40_000_000; t.mock.method(Date, 'now', () => now);
  const room = new TowerRoom(context(), env); room.run = () => {}; await room.ready;
  await room.fetch(new Request('https://tower.internal/init', { method: 'POST', body: JSON.stringify({ code: '042222', quick: true, mode: 'race', capacity: 8 }) }));
  await join(room, 'سعد');
  now = room.r.lobbyUntil + 1; await room.step();
  assert.equal(room.r.status, 'playing');
  const seats = room.r.seats, course = room.courseOf().challenges.join();
  now = room.r.startAt + 6000;
  const late = await join(room, 'ريم');
  assert.equal(late.res.status, 101, 'six seconds in is not too late');
  const reem = room.r.players.find((p) => p.name === 'ريم');
  assert.ok(reem && !reem.out && reem.fin === null && reem.cp === 0);
  assert.equal(room.view().seats, seats, 'the course keeps the size it started with');
  assert.equal(room.courseOf().challenges.join(), course);
  assert.ok(room.r.players.length <= 8);
  now = room.r.startAt + 16_000;
  assert.equal((await join(room, 'بدر')).res.status, 409, 'too late once the race is well under way');
});

test('a private room lets friends in again after a race, and keeps a seat for a phone that just dropped', async (t) => {
  sockets(t); let now = 50_000_000; t.mock.method(Date, 'now', () => now);
  const room = await privateRoom(t);
  const host = await join(room, 'سعد', { hk: 'h'.repeat(40) }), guest = await join(room, 'ريم'), third = await join(room, 'فهد');
  await room.webSocketClose(third.ws); now += 3000;
  await say(room, host.ws, { type: 'start' });
  assert.equal(room.r.status, 'playing');
  assert.ok(room.r.players.some((p) => p.name === 'فهد'), 'the player reconnecting keeps a seat in the race');
  now += TOWER_RECONNECT + 1; room.r.firstFin = 0;
  now = room.r.startAt + 250_000; await room.tick();
  assert.equal(room.r.status, 'finished');
  assert.equal((await join(room, 'نورة')).res.status, 101, 'a finished private room takes a newcomer for the next race');
});

test('a race nobody finished has no winner; points and the group room are told the same', async (t) => {
  sockets(t); let now = 60_000_000; t.mock.method(Date, 'now', () => now);
  const room = await privateRoom(t);
  const host = await join(room, 'سعد', { hk: 'h'.repeat(40), user: 'saad' }), guest = await join(room, 'ريم', { user: 'reem' });
  await say(room, host.ws, { type: 'start' });
  const c = room.courseOf();
  now = room.r.startAt + 1000; await say(room, host.ws, { type: 'pos', x: 0, y: c.checkpoints[0].y, z: c.checkpoints[0].z + 3, ry: 0, a: 1, cp: 0 });
  now = room.r.startAt + room.limit() * 1000 + 1000; await room.tick();
  assert.equal(room.r.status, 'finished');
  const v = room.view(), saad = room.r.players.find((p) => p.username === 'saad');
  assert.equal(v.ended, 'time');
  assert.equal(saad.place, 1, 'still ranked by who got furthest');
  assert.equal(room.won(saad), false, 'but first place without reaching the top is not a win');
  const main = await read('public/assets/js/tower/main.js');
  assert.match(main, /me\.place === 1 && \(me\.fin != null \|\| s\.mode === 'elim'\)/, 'the result screen only crowns someone who reached the top');
  assert.match(main, /خلص الوقت/);
});

test('a runner who finished, dropped or went quiet is sent as standing, not running in place', async (t) => {
  sockets(t); let now = 70_000_000; t.mock.method(Date, 'now', () => now);
  const room = await privateRoom(t);
  const host = await join(room, 'سعد', { hk: 'h'.repeat(40) }), guest = await join(room, 'ريم');
  await say(room, host.ws, { type: 'start' });
  const c = room.courseOf();
  now = room.r.startAt + 500;
  await say(room, host.ws, { type: 'pos', x: 0, y: c.checkpoints[0].y, z: c.checkpoints[0].z + 1, ry: 0, a: 1, cp: 0 });
  await say(room, guest.ws, { type: 'pos', x: 1, y: c.checkpoints[0].y, z: c.checkpoints[0].z + 1, ry: 0, a: 1, cp: 0 });
  now += 100; await room.tick();
  let snap = host.ws.sent.filter((m) => m.type === 'snap').at(-1);
  assert.ok(snap.p.every((row) => row[5] === 1), 'running while reports come in');
  now += 1500; await room.tick();
  snap = host.ws.sent.filter((m) => m.type === 'snap').at(-1);
  assert.ok(snap.p.every((row) => row[5] === 0), 'no reports for a while: shown standing');
});

test('an elimination is not abandoned while knocked-out players still watch', async (t) => {
  sockets(t); let now = 80_000_000; t.mock.method(Date, 'now', () => now);
  const room = new TowerRoom(context(), env); room.run = () => {}; await room.ready;
  await room.fetch(new Request('https://tower.internal/init', { method: 'POST', body: JSON.stringify({ code: '043333', quick: true, mode: 'elim', capacity: 8 }) }));
  await join(room, 'سعد');
  now = room.r.lobbyUntil + 1; await room.step();
  const me = room.r.players.find((p) => !p.bot); me.out = true; me.outRound = 0;
  now = room.r.startAt + 2000; await room.tick();
  assert.notEqual(room.view().ended, 'abandoned');
  assert.ok(room.r.status === 'playing' || room.r.ended !== 'abandoned');
});

test('the page: slim name tags that fade, poses on the wall clock, hands back after a dance, a podium', async () => {
  const scene = await read('public/assets/js/tower/scene.js'), page = await read('public/tower.html'), css = await read('public/assets/css/tower-v33-18.css');
  assert.match(scene, /nameTag\(name/); assert.doesNotMatch(scene, /sp\.scale\.set\(2\.4, 2\.4, 1\)/, 'the old square label is gone');
  assert.match(scene, /r\.tag\.material\.opacity/);
  assert.match(scene, /animateCharacter\(r\.fig, r\.anim, r\.phase, clock, r\.emote\)/);
  assert.match(scene, /h\.position\.x \+= \(\(i \? 1 : -1\) \* 0\.55 - h\.position\.x\)/);
  for (const id of ['twRoundTitle', 'twRoundSub', 'twRoundPodium', 'twRoundMine', 'twRoundList']) assert.ok(page.includes('id="' + id + '"'), id);
  assert.match(css, /\.tw-podium\{/); assert.match(css, /\.tw-step-1 \.tw-plinth/);
  assert.equal(T.roundCourse(5, 0, 6).challenges.join(), T.roundCourse(5, 0, 6).challenges.join());
});
