// 33.18.1: the home profile button shows the player's own picture (not the character) when there is
// one; «برج التحديات» shows profile pictures in its room, results and board; a room that fails to open
// says why (with a code) and is tried twice; the host key always gets the host seat back.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { TowerRoom } from '../src/tower/tower-room.js';
import { SOCIAL_ONLINE_GAMES, gameJoinPath } from '../src/social/social-core.js';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

async function homeAvatar({ photo = null, username = 'bosrag', character = 'ninja', fail = false } = {}) {
  const img = { attrs: {}, classList: { set: new Set(), toggle(c, on) { on ? this.set.add(c) : this.set.delete(c); }, remove(c) { this.set.delete(c); } }, getAttribute(k) { return this.attrs[k] ?? null; }, set src(v) { this.attrs.src = v; }, get src() { return this.attrs.src; } };
  const listeners = {};
  const window = { BS_CAREER: { get: () => ({ equipped: { character }, name: 'لاعب' }) }, BS_SOCIAL: { profile: () => ({ username, displayName: 'بوسراج', photo }) }, BS_CAREER_CORE: { heroFace: (id) => '/assets/heroes/face/' + id + '.webp' }, addEventListener: (k, fn) => { listeners[k] = fn; } };
  const document = { readyState: 'complete', querySelector: (sel) => (sel === '[data-palace-avatar]' ? img : null), querySelectorAll: () => [], addEventListener() {} };
  const context = vm.createContext({ window, document, setTimeout, clearTimeout, encodeURIComponent, Number, requestAnimationFrame: (fn) => fn() });
  vm.runInContext(await read('public/assets/js/palace-lobby-v33-11-6.js'), context);
  for (const fn of Object.values(listeners)) fn?.();
  if (fail) img.onerror?.();
  return img;
}

test('the home profile button shows your picture, and the character only when there is none', async () => {
  assert.equal((await homeAvatar()).src, '/assets/heroes/face/ninja.webp');
  const preset = await homeAvatar({ photo: { kind: 'preset', id: 'g-cat' } });
  assert.equal(preset.src, '/assets/avatars-v33-9-4/cat.webp'); assert.ok(preset.classList.set.has('is-photo'));
  assert.equal((await homeAvatar({ photo: { kind: 'preset', id: 'h-falcon' } })).src, '/assets/heroes/face/falcon.webp');
  assert.equal((await homeAvatar({ photo: { kind: 'upload', v: 77 } })).src, '/api/social/photo/bosrag?v=77');
  assert.equal((await homeAvatar({ photo: { kind: 'upload', v: 77, hidden: true } })).src, '/assets/heroes/face/ninja.webp', 'a hidden (reported) photo is not shown');
  assert.equal((await homeAvatar({ photo: { kind: 'upload', v: 77 }, fail: true })).src, '/assets/heroes/face/ninja.webp', 'a photo that fails to load falls back to the character');
});

function context() { const values = new Map(), sockets = []; return { values, sockets, storage: { async get(k) { return structuredClone(values.get(k)); }, async put(k, v) { values.set(k, structuredClone(v)); }, async delete(k) { values.delete(k); }, async setAlarm() {} }, blockConcurrencyWhile: (fn) => Promise.resolve().then(fn), acceptWebSocket(ws) { sockets.push(ws); }, getWebSockets() { return sockets; } }; }
function sockets(t) {
  const OriginalResponse = globalThis.Response, OriginalPair = globalThis.WebSocketPair;
  globalThis.WebSocketPair = class { constructor() { for (let i = 0; i < 2; i++) this[i] = { sent: [], send(raw) { this.sent.push(JSON.parse(raw)); }, serializeAttachment(a) { this.a = a; }, deserializeAttachment() { return this.a; }, close() {} }; } };
  globalThis.Response = class extends OriginalResponse { constructor(body, init) { if (init?.status === 101) { super(null, { status: 200 }); Object.defineProperty(this, 'status', { value: 101 }); } else super(body, init); } static json(v, i) { return new OriginalResponse(JSON.stringify(v), { ...i, headers: { 'content-type': 'application/json' } }); } };
  t.after(() => { globalThis.Response = OriginalResponse; globalThis.WebSocketPair = OriginalPair; });
}
const join = (room, name, { hk, user } = {}) => room.fetch(new Request('https://tower.internal/ws?name=' + encodeURIComponent(name), { headers: { Upgrade: 'websocket', 'sec-websocket-protocol': ['bs-tower-v1', ...(hk ? ['hk.' + hk] : [])].join(', '), ...(user ? { 'x-bs-account': user } : {}) } }));

test('the tower room shares who has an account, and the host key always gets the host seat back', async (t) => {
  sockets(t);
  const room = new TowerRoom(context(), {}); room.run = () => {}; await room.ready;
  await room.fetch(new Request('https://tower.internal/init', { method: 'POST', body: JSON.stringify({ code: '041111', hostKey: 'k'.repeat(40), mode: 'race', capacity: 4 }) }));
  assert.equal((await join(room, 'سعد', { hk: 'k'.repeat(40) })).status, 101);
  // the first try never heard back; the second try with the same key is the same host, not a new player
  assert.equal((await join(room, 'سعد', { hk: 'k'.repeat(40) })).status, 101);
  assert.equal(room.r.players.length, 1); assert.ok(room.r.players[0].host && room.r.players[0].connected);
  await join(room, 'ريم', { user: 'reem' });
  const view = room.view().players;
  assert.deepEqual(view.map((p) => [p.name, p.user]), [['سعد', null], ['ريم', 'reem']]);
  const board = new TowerRoom(context(), {}); await board.ready;
  await board.fetch(new Request('https://tower.internal/board/add', { method: 'POST', body: JSON.stringify({ rows: [{ username: 'reem', name: 'ريم', points: 75, win: false }] }) }));
  const d = await (await board.fetch(new Request('https://tower.internal/board?period=all'))).json();
  assert.deepEqual(d.rows.map((r) => [r.name, r.user, r.points]), [['ريم', 'reem', 75]]);
});

test('the tower page shows profile pictures, says why a room failed, and tries the socket twice', async () => {
  const js = await read('public/assets/js/tower/main.js'), css = await read('public/assets/css/tower-v33-18.css');
  assert.match(js, /function face\(user, look, name = ''\)/); assert.match(js, /'\/api\/social\/photo\/' \+ encodeURIComponent\(user\)/);
  assert.match(js, /face\(p\.user, p\.look, p\.name\)/); assert.match(js, /face\(r\.user, null, r\.name\)/);
  assert.match(js, /async join\(code\) \{ try \{ return await this\.connect\(code\); \}/);
  assert.match(js, /' \(' \+ res\.status \+ '\)'/); assert.match(js, /' \(' \+ \(ev\.code \|\| 0\) \+ '\)'/); assert.match(js, /\(مهلة\)/);
  assert.match(js, /b\.textContent = 'نفتح الغرفة…'/);
  assert.doesNotMatch(js, /if \(false\)/);
  assert.match(css, /\.tw-swatch img\{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:50%\}/);
});

test('a friend can be invited straight into a tower room, not only sent a link', async () => {
  assert.ok(SOCIAL_ONLINE_GAMES.has('tower'));
  assert.equal(gameJoinPath('tower', '041234'), '/tower?room=041234');
  const api = await read('src/social/social-api.js');
  assert.match(api, /\['party','quiz','serpent','picture','sudoku','paths','hockey','tanks','tower'(?:,'ten')?\]\.includes\(game\)/);
  assert.match(api, /tower:'tower:'/); assert.match(api, /tower:'tower'/);
  const client = await read('public/assets/js/social-client.js');
  assert.match(client, /\|tanks\|tower\|hockey\|/); assert.match(client, /tower: 'برج التحديات'/);
  assert.match(await read('src/presence/presence-registry.js'), /tower: \{ key: 'tower', label: 'برج التحديات' \}/);
  const page = await read('public/tower.html'), js = await read('public/assets/js/tower/main.js');
  assert.match(page, /id="twRoomFriend"[^>]*>ادعُ صديق</); assert.match(page, /id="twRoomShare"[^>]*>شارك الرابط</);
  assert.match(js, /BS_SOCIAL\.openInvitePicker\(\{ game: 'tower', roomCode: code, title: 'برج التحديات' \}\)/);
});

test('the owner has every runner and outfit, and the cast is twelve with their own looks', async () => {
  const js = await read('public/assets/js/tower/main.js');
  assert.match(js, /const isOwner = \(\) => \{ try \{ return globalThis\.BS_SOCIAL\?\.profile\?\.\(\)\?\.role === 'owner'; \}/);
  assert.match(js, /const charOpen = \(c\) => isOwner\(\) \|\| totalStars\(\) >= c\.stars;/);
  assert.match(js, /const hasOutfit = \(id\) => isOwner\(\) \|\| save\.owned\.includes\(id\);/);
  const scene = await read('public/assets/js/tower/scene.js'), list = scene.slice(scene.indexOf('export const CHARACTERS'), scene.indexOf(']);', scene.indexOf('export const CHARACTERS')));
  const ids = [...list.matchAll(/id: '([a-z]+)'/g)].map((m) => m[1]), stars = [...list.matchAll(/stars: (\d+)/g)].map((m) => +m[1]), about = [...list.matchAll(/about: '([^']+)'/g)];
  assert.equal(ids.length, 12); assert.equal(new Set(ids).size, 12); assert.equal(about.length, 12);
  assert.deepEqual(stars, stars.slice().sort((a, b) => a - b), 'unlocks climb in star order'); assert.equal(stars[0], 0);
  for (const id of ['mouj', 'sahab', 'neon', 'saqr']) assert.ok(ids.includes(id), id);
  assert.match(scene, /function placeArms\(fig\)/); assert.match(scene, /extra: 'cape'/);
  const room = await read('src/tower/tower-room.js'), looks = room.match(/const LOOKS = \[([^\]]+)\]/)[1].match(/'([a-z]+)'/g).map((v) => v.slice(1, -1));
  for (const id of looks) assert.ok(ids.includes(id), 'runners filling a race wear real characters: ' + id);
});
