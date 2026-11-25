// 33.19.0: «برج التحديات» gets a summit boss in every world, a daily level with its own ranking, a monthly
// season with an exclusive outfit, the ghost of your best run, a دفّة that shoves other runners, quick
// gestures, music per world, a light graphics mode, and a place in «الغرف» party rooms.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as T from '../public/assets/js/tower/course.js';
import { Runner } from '../public/assets/js/tower/physics.js';
import { TowerRoom, verifyTowerRun } from '../src/tower/tower-room.js';
import { createLinkedRoom, LINKED_GAMES } from '../src/party/party-link.js';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('every world ends on its own summit boss, and the rising floor can be outrun', () => {
  const finales = T.LEVELS.filter((l) => l.finale);
  assert.equal(finales.length, 6);
  for (const l of finales) {
    const boss = T.BOSSES[l.world];
    assert.ok(boss, l.world);
    assert.equal(l.challenges.at(-1), boss.id, 'the boss is the last climb of level ' + l.n);
    assert.ok(l.title.includes(boss.name) && T.sectionName(boss.id, l.world) === boss.name && T.sectionTip(boss.id, l.world));
    const c = T.levelCourse(l.n);
    assert.ok(c.pieces.length > 20 && c.spine.length > 10);
  }
  assert.deepEqual(Object.values(T.BOSSES).map((b) => b.id).sort(), ['bossham', 'bossrise', 'bossrise', 'bossroll', 'bossspin', 'bosssweep']);
  for (const n of [68, 100]) {
    const c = T.levelCourse(n), p = c.pieces.find((q) => q.k === 'rise');
    assert.ok(p && p.v <= 1, 'the floor rises at most a metre a second');
    let t0 = null, margin = 99;
    for (let t = 0; t < c.spine.at(-1).t; t += 0.02) {
      const s = T.spineAt(c, t); if (t0 === null) { if (s.z > p.z0) t0 = t; continue; } if (s.z > p.z1) break;
      margin = Math.min(margin, s.y - (p.y0 + p.v * (t - t0) - 0.2));
    }
    assert.ok(margin / p.v > 3.5, 'the reference climb stays seconds ahead of the floor (' + (margin / p.v).toFixed(1) + ' s)');
  }
});

test('the daily level is the same for everyone on a day (Riyadh time) and changes the next day', () => {
  assert.equal(T.dayKey(Date.parse('2026-11-24T21:30:00Z')), '2026-11-25');
  assert.equal(T.dayKey(Date.parse('2026-11-24T20:30:00Z')), '2026-11-24');
  const a = T.dailyLevel('2026-11-25'), b = T.dailyLevel('2026-11-25'), c = T.dailyLevel('2026-11-26');
  assert.deepEqual(a, b);
  assert.notEqual(a.world, c.world, 'the world turns every day');
  assert.equal(a.challenges.length, 4); assert.equal(new Set(a.challenges).size, 4);
  assert.deepEqual(T.dailyCourse('2026-11-25').pieces.length, T.dailyCourse('2026-11-25').pieces.length);
  assert.ok(T.nextDayAt(Date.parse('2026-11-25T10:00:00Z')) === Date.parse('2026-11-25T21:00:00Z'));
});

test('a monthly season: ten levels in one world, a boss at the end and an outfit only it gives', async () => {
  const s = T.seasonOf(Date.parse('2026-11-25T10:00:00Z'));
  assert.ok(T.SEASONS.some((x) => x.id === s.id)); assert.equal(s.month, '2026-11');
  assert.ok(s.endsAt > Date.parse('2026-11-25T10:00:00Z'));
  const levels = Array.from({ length: 10 }, (_, i) => T.seasonLevel(s, i));
  assert.equal(new Set(levels.map((l) => l.key)).size, 10);
  assert.ok(levels.every((l) => l.world === s.world));
  assert.match(levels[9].challenges.at(-1), /^boss/);
  for (let i = 0; i < 10; i++) assert.ok(T.seasonCourse(s, i).pieces.length >= 8);
  assert.notEqual(T.seasonOf(Date.parse('2026-12-02T10:00:00Z')).id, s.id, 'next month brings another season');
  const scene = await read('public/assets/js/tower/scene.js');
  for (const x of T.SEASONS) assert.match(scene, new RegExp("id: '" + x.reward + "'[^}]*season: '" + x.id + "'"), x.reward);
  const main = await read('public/assets/js/tower/main.js');
  assert.match(main, /function finishSeason/); assert.match(main, /حصري/);
});

test('a daily time only counts when its path really climbs the course', () => {
  const c = T.dailyCourse('2026-11-25'), path = [];
  for (let t = 0; ; t += 0.1) { const p = T.spineAt(c, t); path.push([p.x, p.y, p.z]); if (p.done) break; }
  assert.equal(verifyTowerRun(c, path.length * 0.1, path), '');
  assert.notEqual(verifyTowerRun(c, 40 * 0.1, path.slice(0, 20).concat(path.slice(-20))), '');
  assert.notEqual(verifyTowerRun(c, path.length * 0.05, path), '');
  assert.notEqual(verifyTowerRun(c, 30, []), '');
});

const box = (x, y, z, w, d, m = 'floor', h = 1) => ({ k: 'box', x, y, z, w, h, d, m });
const flat = (extra = []) => { const course = { g: 1, pieces: [box(0, 0, 10, 8, 40, 'start'), ...extra], checkpoints: [{ i: 0, x: 0, y: 0, z: 0.5 }], gems: [], finish: { x: 0, y: 0, z: 60, w: 6 }, kill: -14 }; course.pieces.forEach((p, i) => { p.id = i; }); return course; };

test('the runner: a دفّة on a cooldown, a shove, nobody walks through anybody, and the rising floor', () => {
  const r = new Runner(flat()); let t = 0;
  for (let i = 0; i < 40; i++) { r.update(1 / 60, t, { x: 0, z: 1 }); t += 1 / 60; }
  const before = Math.hypot(r.vx, r.vz);
  r.update(1 / 60, t, { x: 0, z: 1, dash: true }); t += 1 / 60;
  assert.ok(Math.hypot(r.vx, r.vz) > before + 3 && r.anim === 'dash' && r.events.some((e) => e.type === 'dash'));
  r.events.length = 0; r.update(1 / 60, t, { x: 0, z: 1, dash: true }); t += 1 / 60;
  assert.ok(!r.events.some((e) => e.type === 'dash'), 'one دفّة at a time');

  const s = new Runner(flat()); s.shove(1, 0);
  assert.ok(s.vx > 5 && s.stun > 0 && s.events.some((e) => e.type === 'shoved'));

  const a = new Runner(flat()); a.x = 0; a.z = 5; a.others = [{ id: 'b', x: 0.3, y: 0, z: 5, vx: 0, vz: 0 }];
  a.update(1 / 60, 1, { x: 0, z: 0 });
  assert.ok(Math.hypot(a.x - 0.3, a.z - 5) >= 2 * T.PLAYER_R - 1e-6, 'pushed apart');
  const c = new Runner(flat()); c.x = 0; c.z = 5; c.others = [{ id: 'd', x: 0, y: 0, z: 4.4, vx: 0, vz: 9 }];
  c.update(1 / 60, 1, { x: 0, z: 0 });
  assert.ok(c.events.some((e) => e.type === 'bump') && c.vz > 3, 'a runner charging into you knocks you on');
  const p = new Runner(flat()); p.x = 0; p.z = 5; p.others = [{ id: 'e', x: 0, y: 0, z: 5.9, vx: 0, vz: 0 }];
  p.update(1 / 60, 1, { x: 0, z: 1, dash: true });
  assert.deepEqual(p.events.filter((e) => e.type === 'push').map((e) => e.id), ['e'], 'your دفّة pushes whoever it reaches');

  const lava = new Runner(flat([{ k: 'rise', x: 0, z0: 0, z1: 30, y0: -1, v: 1, w: 14, lava: true }]));
  lava.z = 3; t = 0;
  for (let i = 0; i < 60 * 3 && !lava.falls; i++) { lava.update(1 / 60, t, { x: 0, z: 0 }); t += 1 / 60; }
  assert.equal(lava.falls, 1, 'standing still, the floor catches you');
  assert.ok(lava.events.some((e) => e.type === 'fall' && e.by === 'rise'));
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

test('online: gestures reach everyone, and a دفّة shoves a nearby runner once a second', async (t) => {
  sockets(t);
  const room = new TowerRoom(context(), {}); room.run = () => {}; await room.ready;
  await room.fetch(new Request('https://tower.internal/init', { method: 'POST', body: JSON.stringify({ code: '041234', hostKey: 'k'.repeat(40), mode: 'race', capacity: 4 }) }));
  const host = await join(room, 'سعد', { hk: 'k'.repeat(40), user: 'saad' }), guest = await join(room, 'ريم', { user: 'reem' });
  await say(room, host.ws, { type: 'start' }); assert.equal(room.r.status, 'playing');
  guest.ws.sent.length = 0;
  await say(room, host.ws, { type: 'gesture', e: 'dance' });
  await say(room, host.ws, { type: 'gesture', e: 'dance' });
  await say(room, host.ws, { type: 'gesture', e: 'bomb' });
  assert.deepEqual(guest.ws.sent.filter((m) => m.type === 'gesture'), [{ type: 'gesture', id: host.ws.a.id, e: 'dance' }], 'once a second, and only the three gestures');
  assert.ok(!JSON.stringify({ type: 'gesture', e: 'dance' }).includes('emote'), 'the shared reaction relay in GameRoom does not swallow it');
  const [h, g] = room.r.players; h.pos = [0, 0, 5, 0, 1]; g.pos = [0.4, 0, 5.5, 0, 1];
  await say(room, host.ws, { type: 'push', id: g.sid, nx: 0.6, nz: 0.8 });
  await say(room, host.ws, { type: 'push', id: g.sid, nx: 0.6, nz: 0.8 });
  assert.equal(guest.ws.sent.filter((m) => m.type === 'pushed').length, 1);
  g.pos = [0, 0, 40, 0, 1];
  room.r.players[0].lastPush = 0;
  await say(room, host.ws, { type: 'push', id: g.sid, nx: 0, nz: 1 });
  assert.equal(guest.ws.sent.filter((m) => m.type === 'pushed').length, 1, 'too far away to reach');
});

test('«الغرف»: the tower opens as a linked race that starts itself and reports the places', async (t) => {
  sockets(t);
  assert.equal(LINKED_GAMES.tower.page, '/tower');
  const OR = globalThis.Response, rooms = new Map(), reports = [];
  const env = { ROOMS: { idFromName: (n) => n, get: (n) => ({ fetch: async (url, init) => { if (n.startsWith('party:')) { reports.push(JSON.parse(init.body)); return new OR('{}'); } if (!rooms.has(n)) { const r = new TowerRoom(context(), env); r.run = () => {}; rooms.set(n, r); } return rooms.get(n).fetch(new Request(url, init)); } }) } };
  const made = await createLinkedRoom(env, 'tower', { settings: {}, count: 2, link: { code: '151234', round: crypto.randomUUID(), token: 'x'.repeat(40) } });
  assert.equal(made.ok, true); assert.equal(made.page, '/tower'); assert.match(made.code, /^04\d{4}$/);
  const room = rooms.get('tower:' + made.code);
  assert.equal(room.r.mode, 'race'); assert.equal(room.r.expected, 2);
  assert.equal((await join(room, 'سعد')).res.status, 101, 'no host key needed');
  await room.step(); assert.equal(room.r.status, 'lobby', 'waits for the second player');
  assert.equal((await join(room, 'ريم')).res.status, 101);
  await room.step(); assert.equal(room.r.status, 'playing');
  assert.equal(room.r.players.length, 4, 'empty seats are filled for a lively race');
  for (let g = 0; room.r.status === 'playing' && g < 9000; g++) { room.r.startAt -= 100; await room.tick(); }
  assert.equal(room.r.status, 'finished');
  const rows = reports.at(-1)?.standings; assert.ok(Array.isArray(rows) && rows.length === 2, 'only the two real players are reported');
});

test('the daily board: one best per player, only for today or yesterday', async () => {
  const board = new TowerRoom(context(), {}); await board.ready;
  const day = T.dayKey(), c = T.dailyCourse(day), path = [];
  for (let t = 0; ; t += 0.1) { const p = T.spineAt(c, t); path.push([p.x, p.y, p.z]); if (p.done) break; }
  const post = (body) => board.fetch(new Request('https://tower.internal/board/day', { method: 'POST', body: JSON.stringify(body) }));
  assert.equal((await post({ day, time: path.length * 0.1, path, username: 'saad', name: 'سعد' })).status, 200);
  const slow = path.concat(Array.from({ length: 50 }, () => path.at(-1)));
  assert.equal((await post({ day, time: slow.length * 0.1, path: slow, username: 'saad', name: 'سعد' })).status, 200);
  assert.notEqual((await post({ day: '2020-01-01', time: path.length * 0.1, path, username: 'reem', name: 'ريم' })).status, 200);
  assert.notEqual((await post({ day, time: 3, path: path.slice(0, 30), username: 'reem', name: 'ريم' })).status, 200);
  const res = await (await board.fetch(new Request('https://tower.internal/board?period=day&me=saad'))).json();
  const rows = res.rows || res.board || [];
  assert.equal(rows.length, 1); assert.ok(Math.abs(rows[0].time - path.length * 0.1) < 0.2, 'the better time stays');
  const index = await read('src/index.js');
  assert.match(index, /\/api\/tower\/daily'&&request\.method==='POST'\)\{const auth=await authenticate/);
});

test('the page: daily and season screens, settings, دفّة and gestures, music per world and the light mode', async () => {
  const html = await read('public/tower.html');
  for (const id of ['twDailyBtn', 'twSeasonBtn', 'twSettingsBtn', 'twDaily', 'twDailyPlay', 'twDailyBoard', 'twSeason', 'twSeasonLevels', 'twSeasonReward', 'twDash', 'twMusic', 'twSound', 'twGfx', 'twGhostToggle', 'twRoundParty']) assert.match(html, new RegExp('id="' + id + '"'), id);
  for (const e of ['wave', 'laugh', 'dance']) assert.match(html, new RegExp('data-emote="' + e + '"'));
  const audio = await read('public/assets/js/tower/audio.js');
  assert.match(audio, /export class TowerAudio/);
  for (const w of T.WORLDS) assert.match(audio, new RegExp('\\b' + w.id + ':'), 'a style for ' + w.id);
  for (const fx of ['jump', 'land', 'gem', 'dash', 'shoved', 'wave', 'laugh', 'dance', 'boss', 'win']) assert.match(audio, new RegExp("case '" + fx + "'"));
  const scene = await read('public/assets/js/tower/scene.js'), main = await read('public/assets/js/tower/main.js');
  assert.match(scene, /setQuality\(mode\)/); assert.match(scene, /addGhost\(/); assert.match(scene, /emote\(id, kind\)/);
  assert.match(main, /bs-tower-ghost-v1:/); assert.match(main, /setQuality\('low'\)/); assert.match(main, /type: 'gesture'/);
  assert.match(main, /new TowerAudio\(\)/);
});

test('the tower is in «الغرف»: catalog, modes and the quick list', async () => {
  const catalog = await read('public/assets/js/engines/party-catalog-v29.js'), modes = await read('public/assets/js/engines/party-modes.js'), party = await read('public/assets/js/party-v29.js'), link = await read('src/party/party-link.js');
  assert.match(catalog, /id:\s*'tower'/); assert.match(modes, /tower:\s*rows\(\['race'/);
  assert.match(party, /QUICK_ORDER\s*=\s*\['ludo',\s*'tower'/);
  assert.match(link, /tower:\{page:'\/tower'|tower:\s*\{\s*page:\s*'\/tower'/);
  // the group room shows a game in its frame once the page says it is live: party-link-v32 says so
  const html = await read('public/tower.html'), main = await read('public/assets/js/tower/main.js'), css = await read('public/assets/css/tower-v33-18.css');
  assert.ok(html.indexOf('party-link-v32.js') > 0 && html.indexOf('party-link-v32.js') < html.indexOf('tower/main.js'), 'loaded before the game opens its socket');
  assert.match(main, /BS_PARTY_LINK/); assert.match(main, /tw-embedded/);
  assert.match(css, /tw-embedded :is\(#twOnline \.tw-back,#twRoomLeave,#twRoundLeave,#twRoundParty,#twQuit\)/);
});
