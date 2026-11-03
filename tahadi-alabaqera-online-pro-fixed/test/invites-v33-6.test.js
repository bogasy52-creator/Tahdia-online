// 33.6.0: friend invitations that never arrived.
// 1. The board-game lobbies (jackaroo, zahra, snakes, dice) sent the room's mode («classic») with
//    every invitation, and the server turned away any mode but the journey's — so none was sent.
// 2. The phone dropped invitations to the challenge games (focus, cipher, wordbomb, chaos): their
//    pages were missing from the list of pages an invitation may open.
// 3. A challenge room between two rounds takes new players, so it takes invitations too.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { createSocialUserClass } from '../src/social/social-user.js';
import { handleSocialRequest } from '../src/social/social-api.js';

class FakeDurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }
class FakeStorage {
  constructor() { this.map = new Map(); this.queue = Promise.resolve(); }
  transaction(fn) { const work = this.queue.then(async () => { const before = structuredClone(this.map); try { return await fn(this); } catch (error) { this.map = before; throw error; } }); this.queue = work.catch(() => {}); return work; }
  async get(key) { return structuredClone(this.map.get(key)); }
  async put(key, value) { this.map.set(key, structuredClone(value)); }
  async delete(key) { if (Array.isArray(key)) { for (const k of key) this.map.delete(k); return key.length; } return this.map.delete(key); }
  async list({ prefix = '', limit = Infinity, reverse = false } = {}) {
    let entries = [...this.map.entries()].filter(([key]) => key.startsWith(prefix)).sort(([a], [b]) => a.localeCompare(b));
    if (reverse) entries.reverse();
    return new Map(entries.slice(0, limit).map(([k, v]) => [k, structuredClone(v)]));
  }
}
class FakeContext {
  constructor() { this.storage = new FakeStorage(); this.sockets = []; this.ready = Promise.resolve(); }
  blockConcurrencyWhile(fn) { const work = this.ready.then(fn); this.ready = work.catch(() => {}); return work; }
  getWebSockets() { return [...this.sockets]; }
  acceptWebSocket(ws) { this.sockets.push(ws); }
  waitUntil() {}
}
function environment(rooms) {
  const UserClass = createSocialUserClass(FakeDurableObject), users = new Map(), env = {};
  env.SOCIAL_USERS = { idFromName: (name) => String(name), get(id) { if (!users.has(id)) { const ctx = new FakeContext(); users.set(id, { ctx, user: new UserClass(ctx, env) }); } const h = users.get(id); return { async fetch(input, init) { await h.ctx.ready; return h.user.fetch(input instanceof Request ? input : new Request(input, init)); } }; } };
  const room = (namespace) => ({ idFromName: (name) => String(name), get: (id) => ({ fetch: async () => Response.json({ ok: true, ...rooms(namespace, id) }) }) });
  env.ROOMS = room('ROOMS'); env.BOARD_ROOMS = room('BOARD_ROOMS');
  return env;
}
async function social(env, path, { method = 'GET', token = '', body } = {}) {
  const headers = new Headers(); if (token) headers.set('authorization', 'Bearer ' + token); if (body) headers.set('content-type', 'application/json');
  const response = await handleSocialRequest(new Request('https://game.test' + path, { method, headers, body: body ? JSON.stringify(body) : undefined }), env);
  return { response, data: await response.json() };
}
async function friends(env) {
  const make = async (username, displayName) => (await social(env, '/api/social/signup', { method: 'POST', body: { username, displayName, password: 'very-secret-1' } })).data.token;
  const alice = await make('alice_1', 'أليس'), bob = await make('bob_2', 'بوب');
  await social(env, '/api/social/friends/request', { method: 'POST', token: alice, body: { username: 'bob_2' } });
  await social(env, '/api/social/friends/respond', { method: 'POST', token: bob, body: { username: 'alice_1', accept: true } });
  return { alice, bob };
}

test('an invitation from a board-game lobby carries the room, not its mode, and reaches the friend', async () => {
  const env = environment((namespace, id) => ({ game: 'jackaroo', status: 'lobby', players: 1, playerLimit: 4 }));
  const { alice, bob } = await friends(env);
  // what the jackaroo lobby sends: its mode came along with the room
  const sent = await social(env, '/api/social/invites', { method: 'POST', token: alice, body: { username: 'bob_2', game: 'jackaroo', roomCode: '123456', variant: 'classic' } });
  assert.equal(sent.response.status, 200, JSON.stringify(sent.data));
  assert.equal(sent.data.invite.joinPath, '/jackaroo?room=123456');
  assert.equal('variant' in sent.data.invite, false);
  const inbox = (await social(env, '/api/social/me', { token: bob })).data.notifications.filter((n) => n.type === 'game_invite');
  assert.equal(inbox.length, 1); assert.equal(inbox[0].roomCode, '123456');
  // the journey keeps its kind of challenge
  const journey = await social(env, '/api/social/invites', { method: 'POST', token: alice, body: { username: 'bob_2', game: 'journey', roomCode: '', variant: 'paths' } });
  assert.equal(journey.response.status, 200); assert.equal(journey.data.invite.joinPath, '/journey?game=paths');
});

test('a challenge room between rounds takes invitations; a round in play does not', async () => {
  let status = 'finished';
  const env = environment((namespace, id) => { assert.equal(namespace, 'ROOMS'); assert.equal(id, 'challenge:981234'); return { game: 'chaos', status, players: 3, playerLimit: 20 }; });
  const { alice } = await friends(env);
  const send = () => social(env, '/api/social/invites', { method: 'POST', token: alice, body: { username: 'bob_2', game: 'chaos', roomCode: '981234' } });
  const between = await send();
  assert.equal(between.response.status, 200, JSON.stringify(between.data)); assert.equal(between.data.invite.joinPath, '/chaos?room=981234');
  status = 'playing'; assert.equal((await send()).response.status, 409);
});

async function phone(notifications, { fullscreen = false } = {}) {
  const source = await readFile(new URL('../public/assets/js/social-client.js', import.meta.url), 'utf8');
  const cache = new Map([['bs_social_session', 'bob_2.secret'], ['bs_social_profile', JSON.stringify({ username: 'bob_2', displayName: 'بوب' })]]);
  const byId = new Map(), sent = [];
  class Element {
    constructor(tag = 'div') { this.tagName = tag; this.children = []; this.parentElement = null; this.classList = { add() {}, remove() {}, toggle() {} }; this.textContent = ''; }
    append(...nodes) { for (const node of nodes) { this.children.push(node); node.parentElement = this; if (node.id) byId.set(node.id, node); } }
    appendChild(node) { this.append(node); return node; }
    remove() { byId.delete(this.id); }
    setAttribute() {} addEventListener() {} querySelectorAll() { return []; }
    set innerHTML(_) { this.children = []; }
  }
  const body = new Element('body'), stage = new Element('section');
  const document = { body, hidden: false, fullscreenElement: fullscreen ? stage : null, createElement: (tag) => new Element(tag), querySelector: (q) => (q.startsWith('#') ? byId.get(q.slice(1)) || null : null), querySelectorAll: () => [], addEventListener() {} };
  const localStorage = { getItem: (k) => cache.get(k) || null, setItem: (k, v) => cache.set(k, v), removeItem: (k) => cache.delete(k) };
  const fetch = async (path, init = {}) => { sent.push({ path, body: init.body ? JSON.parse(init.body) : null }); return { ok: true, status: 200, json: async () => ({ ok: true, profile: { username: 'bob_2', displayName: 'بوب' }, notifications, unread: notifications.length, friends: [] }) }; };
  const window = { addEventListener() {}, dispatchEvent() {} };
  class CE extends Event { constructor(name, options) { super(name); this.detail = options?.detail; } }
  runInNewContext(source, { window, document, localStorage, Headers, fetch, EventTarget, CustomEvent: CE, console, location: { protocol: 'https:', host: 'game.test', pathname: '/', search: '' }, setTimeout: () => 1, setInterval: () => 1, clearTimeout() {}, clearInterval() {}, Date, JSON, Number, Error, Promise });
  await new Promise((resolve) => setTimeout(resolve, 30));
  return { card: byId.get('bsSocialInvite'), sent, window, stage, body };
}
const invite = (game, joinPath, roomCode) => ({ id: 'inv-' + game, type: 'game_invite', game, roomCode, joinPath, createdAt: Date.now(), expiresAt: Date.now() + 60000, read: false, from: { displayName: 'أليس' } });

for (const [game, path] of [['chaos', '/chaos?room=981234'], ['focus', '/focus?room=971234'], ['cipher', '/cipher?room=961234'], ['wordbomb', '/wordbomb?room=091234'], ['jackaroo', '/jackaroo?room=123456']]) {
  test('the phone shows an invitation to ' + game, async () => {
    const { card } = await phone([invite(game, path, path.slice(-6))]);
    assert.ok(card, 'the invitation card is on screen');
    assert.ok(card.children.some((x) => /دعوة من أليس/.test(x.textContent)));
    assert.equal(card.children.find((x) => x.className === 'bs-social-invite-actions').children[0].href, path);
  });
}

test('an invitation for a page that is not a game is still dropped', async () => {
  const { card } = await phone([invite('chaos', 'https://evil.invalid/?room=981234', '981234')]);
  assert.equal(card, undefined);
});

test('a full-screen game shows the invitation inside itself, above everything on the page', async () => {
  const { card, stage } = await phone([invite('chaos', '/chaos?room=981234', '981234')], { fullscreen: true });
  assert.equal(card.parentElement, stage);
  for (const file of ['public/assets/css/social.css', 'public/assets/css/platform.css']) assert.match(await readFile(new URL('../' + file, import.meta.url), 'utf8'), /\.bs-social-invite-card\{position:fixed;z-index:13000;/, file);
});

test('the phone sends a room mode only for the journey', async () => {
  const { sent, window } = await phone([]);
  await window.BS_SOCIAL.invite('alice_1', 'jackaroo', '123456', 'classic');
  await window.BS_SOCIAL.invite('alice_1', 'journey', '', 'jewels');
  const bodies = sent.filter((x) => x.path === '/api/social/invites').map((x) => x.body);
  assert.deepEqual(bodies, [{ username: 'alice_1', game: 'jackaroo', roomCode: '123456' }, { username: 'alice_1', game: 'journey', roomCode: '', variant: 'jewels' }]);
  assert.equal(window.BS_SOCIAL.gameLabel('chaos'), 'سباق الفوضى');
});
