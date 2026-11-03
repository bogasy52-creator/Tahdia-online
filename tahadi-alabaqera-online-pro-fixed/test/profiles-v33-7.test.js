// 33.7.0: «ملف اللاعب» — every room knows which player is which account, and an account's card
// (level, wins, games and the look, never the coins) opens from any room, with «أضف صديق».
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { environment, api, signup } from './worker-harness.mjs';
import { challengeView, createChallenge } from '../public/assets/js/engines/challenge-core.js';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

function sockets(t) {
  const originalPair = globalThis.WebSocketPair, OriginalResponse = globalThis.Response;
  globalThis.WebSocketPair = class { constructor() { for (let i = 0; i < 2; i++) this[i] = { sent: [], send(m) { this.sent.push(JSON.parse(m)); }, serializeAttachment(v) { this.attachment = v; }, deserializeAttachment() { return this.attachment; }, close() {} }; } };
  globalThis.Response = class extends OriginalResponse { constructor(body, init) { if (init?.status === 101) { super(null, { status: 200, headers: init.headers }); Object.defineProperty(this, 'status', { value: 101 }); this.webSocket = init.webSocket; } else super(body, init); } };
  t.after(() => { globalThis.WebSocketPair = originalPair; globalThis.Response = OriginalResponse; });
}

test('a board room tells its players who is an account (and only that)', async (t) => {
  sockets(t);
  const env = environment(), holder = env.BOARD_ROOMS.peek('cards-table');
  await holder.ctx.ready;
  const res = await holder.instance.fetch(new Request('https://board.internal/init', { method: 'POST', body: JSON.stringify({ code: '400777', hostKey: 'h'.repeat(64), game: 'zahra', playerLimit: 4, variant: 'classic' }) }));
  assert.equal(res.status, 201);
  const board = holder.instance;
  const join = async (name, account, host = false) => {
    const headers = { upgrade: 'websocket', 'sec-websocket-protocol': 'busraj-v1' + (host ? ', hk.' + 'h'.repeat(64) : '') };
    if (account) headers['x-bs-account'] = account;
    const response = await board.fetch(new Request('https://board.internal/ws?name=' + encodeURIComponent(name), { headers }));
    assert.equal(response.status, 101, name + ' joins');
    return holder.ctx.sockets.at(-1).deserializeAttachment().playerId;
  };
  const host = await join('سعد', 'saad_card', true), guest = await join('ضيف');
  const view = JSON.parse(JSON.stringify(board.publicState(guest)));
  assert.equal(view.players.find((p) => p.id === host).username, 'saad_card');
  assert.equal('username' in view.players.find((p) => p.id === guest), false, 'a guest has no account to show');
});

test('the public card of an account: level, wins, games and the look — never the coins', async () => {
  const env = environment();
  const me = await signup(env, 'card_owner');
  const res = await api(env, '/api/social/users/card_owner');
  assert.equal(res.response.status, 200);
  const card = res.data.profile.card;
  assert.deepEqual(Object.keys(card).sort(), ['character', 'games', 'level', 'title', 'wins']);
  assert.equal(card.level, 1); assert.equal(card.wins, 0); assert.equal(card.character, 'character-fox');
  assert.equal(JSON.stringify(res.data).includes('coins'), false);
  assert.ok(me.data.token);
  assert.equal((await api(env, '/api/social/users/nobody_here')).response.status, 404);
});

test('the challenge rooms and the party send the accounts with their players', async () => {
  assert.match(await read('src/challenges/challenge-room.js'), /players:r\.players\.map\(p=>\(\{id:p\.id,name:p\.name,username:p\.bot\?undefined:p\.username\|\|undefined,/);
  assert.match(await read('src/party/party-engine.js'), /return\{id:p\.id,name:p\.name,username:p\.username\|\|undefined,role:p\.role,/);
  assert.match(await read('src/games/baloot-server.js'), /name: p\.name, username: p\.username \|\| undefined, role: p\.role,/);
  // the match itself carries no accounts: the page joins them by player id
  const m = createChallenge('focus', [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], 3, 1e6);
  assert.equal(JSON.stringify(challengeView(m, 'a', 1e6 + 10)).includes('username'), false);
});

test('the card opens from every list of players, and a computer opponent or a guest gets a word instead of the button', async () => {
  const card = await read('public/assets/js/player-card-v33-7.js');
  assert.match(card, /window\.BS_PLAYER_CARD = Object\.freeze\(\{ open, close \}\);/);
  assert.match(card, /'المنافس الآلي ما ينضاف للأصدقاء، بس تقدر تغلبه\.'/);
  assert.match(card, /'ضيف · ما عنده حساب'/);
  for (const text of ['أضف صديق', 'صديقك ✓', 'طلبك مرسل ✓', 'اقبل طلب صداقته', 'انرسل طلب الصداقة ✓', 'صرتوا أصدقاء ✓']) assert.ok(card.includes(text), text);
  assert.match(card, /window\.BS_SOCIAL\.requestFriend\(info\.username\)/);
  assert.match(card, /window\.BS_SOCIAL\.respondFriend\(info\.username, true\)/);
  // the hosts: the rows of the board tables and the faces on the board, the scoreboard of the challenges, the seats of Baloot, the party
  assert.match(await read('public/assets/js/board-table-v33.js'), /event\.target\.closest\?\.\('\[data-player-tag\]'\),row=tag\?null:event\.target\.closest\?\.\('#players > \*'\)/);
  assert.match(await read('public/assets/js/challenge-client.js'), /document\.getElementById\('chPlayers'\)\?\.addEventListener\('click',/);
  assert.match(await read('public/assets/js/baloot-table.js'), /const box = event\.target\.closest\?\.\('\.bl-seat'\);/);
  assert.match(await read('public/assets/js/party-v29.js'), /data-pcard-id="\$\{esc\(p\.id\)\}"/);
  const api = await read('src/social/social-api.js');
  assert.match(api, /const profile = await publicProfile\(env, profileMatch\[1\], true\);/);
});
