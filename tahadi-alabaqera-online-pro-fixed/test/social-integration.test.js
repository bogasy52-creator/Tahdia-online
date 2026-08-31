import test from 'node:test';
import assert from 'node:assert/strict';
import { createSocialUserClass } from '../src/social/social-user.js';
import { handleSocialRequest } from '../src/social/social-api.js';

class FakeDurableObject {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; }
}

class FakeStorage {
  constructor() { this.map = new Map(); }
  async get(key) { return structuredClone(this.map.get(key)); }
  async put(key, value) { this.map.set(key, structuredClone(value)); }
  async delete(key) {
    if (Array.isArray(key)) { let count = 0; for (const k of key) count += this.map.delete(k) ? 1 : 0; return count; }
    return this.map.delete(key);
  }
  async deleteAll() { this.map.clear(); }
  async list({ prefix = '', limit = Infinity, reverse = false } = {}) {
    let entries = [...this.map.entries()].filter(([key]) => key.startsWith(prefix));
    entries.sort(([a], [b]) => a.localeCompare(b));
    if (reverse) entries.reverse();
    entries = entries.slice(0, limit);
    return new Map(entries.map(([key, value]) => [key, structuredClone(value)]));
  }
}

class FakeContext {
  constructor() { this.storage = new FakeStorage(); this.sockets = []; this.waits = []; this.ready = Promise.resolve(); }
  blockConcurrencyWhile(fn) { this.ready = Promise.resolve().then(fn); return this.ready; }
  getWebSockets() { return [...this.sockets]; }
  acceptWebSocket(ws) { this.sockets.push(ws); }
  waitUntil(promise) { this.waits.push(Promise.resolve(promise)); }
}

function createEnvironment() {
  const UserClass = createSocialUserClass(FakeDurableObject);
  const instances = new Map();
  const env = {};
  const namespace = {
    idFromName(name) { return String(name); },
    get(id) {
      const key = String(id);
      if (!instances.has(key)) {
        const ctx = new FakeContext();
        const instance = new UserClass(ctx, env);
        instances.set(key, { ctx, instance });
      }
      const holder = instances.get(key);
      return {
        async fetch(input, init) {
          await holder.ctx.ready;
          const request = input instanceof Request ? input : new Request(input, init);
          return holder.instance.fetch(request);
        },
      };
    },
  };
  env.SOCIAL_USERS = namespace;
  const roomNamespace = (game = null) => ({
    idFromName(name) { return String(name); },
    get(id) {
      return {
        async fetch() {
          return new Response(JSON.stringify({ ok: true, ...(game ? { game } : {}), status: 'lobby', players: 1 }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        },
      };
    },
  });
  env.ROOMS = roomNamespace();
  env.BOARD_ROOMS = {
    idFromName(name) { return String(name); },
    get(id) {
      return {
        async fetch() {
          const game = id === '654321' ? 'zahra' : 'snakes';
          return new Response(JSON.stringify({ ok: true, game, status: 'lobby', players: 1 }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        },
      };
    },
  };
  return { env, instances };
}

async function social(env, path, { method = 'GET', token = '', body } = {}) {
  const headers = new Headers();
  if (token) headers.set('authorization', `Bearer ${token}`);
  if (body !== undefined) headers.set('content-type', 'application/json');
  const request = new Request(`https://game.test${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const response = await handleSocialRequest(request, env);
  assert.ok(response instanceof Response, `missing response for ${path}`);
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function signup(env, username, displayName) {
  const { response, data } = await social(env, '/api/social/signup', {
    method: 'POST',
    body: { username, displayName, password: 'strong-pass-123' },
  });
  assert.equal(response.status, 201, JSON.stringify(data));
  assert.ok(data.token);
  return data.token;
}

test('two users can become friends and exchange a room invitation', async () => {
  const { env } = createEnvironment();
  const alice = await signup(env, 'alice_1', 'أليس');
  const bob = await signup(env, 'bob_2', 'بوب');

  let result = await social(env, '/api/social/friends/request', {
    method: 'POST', token: alice, body: { username: 'bob_2' },
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.data));

  result = await social(env, '/api/social/me', { token: bob });
  assert.equal(result.data.incoming.length, 1);
  assert.equal(result.data.incoming[0].username, 'alice_1');

  result = await social(env, '/api/social/friends/respond', {
    method: 'POST', token: bob, body: { username: 'alice_1', accept: true },
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.accepted, true);

  const aliceDashboard = await social(env, '/api/social/me', { token: alice });
  const bobDashboard = await social(env, '/api/social/me', { token: bob });
  assert.deepEqual(aliceDashboard.data.friends.map((f) => f.username), ['bob_2']);
  assert.deepEqual(bobDashboard.data.friends.map((f) => f.username), ['alice_1']);
  assert.equal(aliceDashboard.data.outgoing.length, 0);
  assert.equal(bobDashboard.data.incoming.length, 0);

  result = await social(env, '/api/social/invites', {
    method: 'POST', token: alice, body: { username: 'bob_2', game: 'snakes', roomCode: '123456' },
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.invite.joinPath, '/snakes?room=123456');

  result = await social(env, '/api/social/me', { token: bob });
  const invite = result.data.notifications.find((n) => n.type === 'game_invite');
  assert.ok(invite);
  assert.equal(invite.from.username, 'alice_1');
  assert.equal(invite.roomCode, '123456');
});

test('friend acceptance requires a real incoming request', async () => {
  const { env } = createEnvironment();
  const alice = await signup(env, 'alice_1', 'أليس');
  const bob = await signup(env, 'bob_2', 'بوب');
  const result = await social(env, '/api/social/friends/respond', {
    method: 'POST', token: bob, body: { username: 'alice_1', accept: true },
  });
  assert.equal(result.response.status, 409);
  assert.match(result.data.error, /لا يوجد طلب/);

  const aliceDashboard = await social(env, '/api/social/me', { token: alice });
  assert.equal(aliceDashboard.data.friends.length, 0);
});

test('friends-only privacy rejects game invites after friendship is removed', async () => {
  const { env } = createEnvironment();
  const alice = await signup(env, 'alice_1', 'أليس');
  const bob = await signup(env, 'bob_2', 'بوب');
  await social(env, '/api/social/friends/request', { method: 'POST', token: alice, body: { username: 'bob_2' } });
  await social(env, '/api/social/friends/respond', { method: 'POST', token: bob, body: { username: 'alice_1', accept: true } });

  let result = await social(env, '/api/social/friends/alice_1', { method: 'DELETE', token: bob });
  assert.equal(result.response.status, 200);

  result = await social(env, '/api/social/invites', {
    method: 'POST', token: alice, body: { username: 'bob_2', game: 'quiz', roomCode: '654321' },
  });
  assert.equal(result.response.status, 403);
  assert.equal(result.data.error, 'invites_not_allowed');
});

test('hiding presence suppresses both online state and last-seen from public profile', async () => {
  const { env } = createEnvironment();
  const alice = await signup(env, 'alice_1', 'أليس');

  let result = await social(env, '/api/social/settings', {
    method: 'POST', token: alice, body: { showOnline: false },
  });
  assert.equal(result.response.status, 200);

  result = await social(env, '/api/social/users/alice_1');
  assert.equal(result.response.status, 200);
  assert.equal(result.data.profile.online, false);
  assert.equal(result.data.profile.lastSeen, null);
});

test('game invitations are rejected when the room belongs to a different game', async () => {
  const { env } = createEnvironment();
  const alice = await signup(env, 'alice_1', 'أليس');
  const bob = await signup(env, 'bob_2', 'بوب');
  await social(env, '/api/social/friends/request', { method: 'POST', token: alice, body: { username: 'bob_2' } });
  await social(env, '/api/social/friends/respond', { method: 'POST', token: bob, body: { username: 'alice_1', accept: true } });

  const result = await social(env, '/api/social/invites', {
    method: 'POST', token: alice, body: { username: 'bob_2', game: 'snakes', roomCode: '654321' },
  });
  assert.equal(result.response.status, 409);
  assert.match(result.data.error, /لعبة أخرى/);
});

test('duplicate signup and wrong password are rejected without leaking sessions', async () => {
  const { env } = createEnvironment();
  await signup(env, 'alice_1', 'أليس');
  let result = await social(env, '/api/social/signup', {
    method: 'POST', body: { username: 'ALICE_1', displayName: 'Other', password: 'strong-pass-123' },
  });
  assert.equal(result.response.status, 409);

  result = await social(env, '/api/social/login', {
    method: 'POST', body: { username: 'alice_1', password: 'definitely-wrong' },
  });
  assert.equal(result.response.status, 401);
  assert.equal(result.data.token, undefined);
});

test('blocking clears pending friendship state on both users', async () => {
  const { env } = createEnvironment();
  const alice = await signup(env, 'alice_1', 'أليس');
  const bob = await signup(env, 'bob_2', 'بوب');

  await social(env, '/api/social/friends/request', {
    method: 'POST', token: alice, body: { username: 'bob_2' },
  });

  let result = await social(env, '/api/social/block', {
    method: 'POST', token: alice, body: { username: 'bob_2' },
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.data));

  const aliceDashboard = await social(env, '/api/social/me', { token: alice });
  const bobDashboard = await social(env, '/api/social/me', { token: bob });
  assert.equal(aliceDashboard.data.outgoing.length, 0);
  assert.deepEqual(aliceDashboard.data.blocks.map((x) => x.username), ['bob_2']);
  assert.equal(bobDashboard.data.incoming.length, 0);
});

test('hidden presence masks both online state and last-seen from public and friend views', async () => {
  const { env, instances } = createEnvironment();
  const alice = await signup(env, 'alice_1', 'أليس');
  const bob = await signup(env, 'bob_2', 'بوب');
  await social(env, '/api/social/friends/request', { method: 'POST', token: alice, body: { username: 'bob_2' } });
  await social(env, '/api/social/friends/respond', { method: 'POST', token: bob, body: { username: 'alice_1', accept: true } });

  const aliceHolder = instances.get('user:alice_1');
  aliceHolder.instance.presence = { online: true, lastSeen: 123456 };
  await aliceHolder.ctx.storage.put('presence', aliceHolder.instance.presence);

  let result = await social(env, '/api/social/settings', {
    method: 'POST', token: alice, body: { showOnline: false },
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.data));
  await Promise.all(aliceHolder.ctx.waits);

  result = await social(env, '/api/social/users/alice_1');
  assert.equal(result.data.profile.online, false);
  assert.equal(result.data.profile.lastSeen, null);

  result = await social(env, '/api/social/me', { token: bob });
  const aliceFriend = result.data.friends.find((x) => x.username === 'alice_1');
  assert.ok(aliceFriend);
  assert.equal(aliceFriend.online, false);
  assert.equal(aliceFriend.lastSeen, null);
});


test('social API can store accounts in BOARD_ROOMS when no SOCIAL_USERS binding exists', async () => {
  const UserClass = createSocialUserClass(FakeDurableObject);
  const instances = new Map();
  const env = {};
  const boardNamespace = {
    idFromName(name) { return String(name); },
    get(id) {
      const key = String(id);
      if (key.startsWith('social:user:')) {
        if (!instances.has(key)) {
          const ctx = new FakeContext();
          const instance = new UserClass(ctx, env);
          instances.set(key, { ctx, instance });
        }
        const holder = instances.get(key);
        return {
          async fetch(input, init) {
            await holder.ctx.ready;
            const request = input instanceof Request ? input : new Request(input, init);
            return holder.instance.fetch(request);
          },
        };
      }
      return {
        async fetch() {
          return new Response(JSON.stringify({ ok: true, game: 'snakes', status: 'lobby', players: 1 }), {
            status: 200, headers: { 'content-type': 'application/json' },
          });
        },
      };
    },
  };
  env.BOARD_ROOMS = boardNamespace;
  env.ROOMS = { idFromName: (x) => String(x), get: () => ({ fetch: async () => new Response(JSON.stringify({ ok: true, status: 'lobby' }), { headers: { 'content-type': 'application/json' } }) }) };

  const token = await signup(env, 'mobile_1', 'جوال');
  assert.ok(token);
  const dashboard = await social(env, '/api/social/me', { token });
  assert.equal(dashboard.response.status, 200);
  assert.equal(dashboard.data.profile.username, 'mobile_1');
  assert.ok(instances.has('social:user:mobile_1'));
});
