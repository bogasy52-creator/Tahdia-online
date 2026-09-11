import test from 'node:test';
import assert from 'node:assert/strict';
import { createSocialUserClass } from '../src/social/social-user.js';
import { handleSocialRequest } from '../src/social/social-api.js';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

class FakeDurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }
class FakeStorage {
  constructor() { this.map = new Map(); }
  async get(key) { return structuredClone(this.map.get(key)); }
  async put(key, value) { this.map.set(key, structuredClone(value)); }
  async delete(key) {
    if (Array.isArray(key)) { let count = 0; for (const item of key) count += this.map.delete(item) ? 1 : 0; return count; }
    return this.map.delete(key);
  }
  async list({ prefix = '', limit = Infinity, reverse = false } = {}) {
    let entries = [...this.map.entries()].filter(([key]) => key.startsWith(prefix)).sort(([a], [b]) => a.localeCompare(b));
    if (reverse) entries.reverse();
    return new Map(entries.slice(0, limit).map(([key, value]) => [key, structuredClone(value)]));
  }
}
class FakeContext {
  constructor() { this.storage = new FakeStorage(); this.waits = []; this.ready = Promise.resolve(); }
  blockConcurrencyWhile(fn) { this.ready = Promise.resolve().then(fn); return this.ready; }
  getWebSockets() { return []; }
  waitUntil(promise) { this.waits.push(Promise.resolve(promise)); }
}

function environment(overrides = {}) {
  const User = createSocialUserClass(FakeDurableObject);
  const holders = new Map();
  const env = { ...overrides };
  env.SOCIAL_USERS = {
    idFromName(value) { return String(value); },
    get(id) {
      const key = String(id);
      if (!holders.has(key)) {
        const ctx = new FakeContext();
        holders.set(key, { ctx, user: new User(ctx, env) });
      }
      const holder = holders.get(key);
      return { fetch: async (input, init) => { await holder.ctx.ready; return holder.user.fetch(input instanceof Request ? input : new Request(input, init)); } };
    },
  };
  return env;
}

async function request(env, path, { method = 'GET', token = '', body } = {}) {
  const headers = new Headers();
  if (token) headers.set('authorization', `Bearer ${token}`);
  if (body !== undefined) headers.set('content-type', 'application/json');
  const response = await handleSocialRequest(new Request(`https://game.test${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  }), env);
  return { response, data: await response.json() };
}

async function signup(env, username, displayName = username, extra = {}) {
  const result = await request(env, '/api/social/signup', {
    method: 'POST', body: { username, displayName, password: 'strong-pass-123', ...extra },
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.data));
  return result.data.token;
}

test('only the authenticated bosrag username receives owner store entitlements', async () => {
  const env = environment({ BOSRAG_OWNER_SECRET: 'deployment-owner-secret-32-characters' });
  const blocked = await request(env, '/api/social/signup', {
    method: 'POST', body: { username: 'bosrag', displayName: 'المدير', password: 'strong-pass-123' },
  });
  assert.equal(blocked.response.status, 403);
  const owner = await signup(env, 'BoSrAg', 'المدير', { ownerSecret: 'deployment-owner-secret-32-characters' });
  const lookalike = await signup(env, 'bosrag2', 'bosrag');

  const ownerMe = await request(env, '/api/social/me', { token: owner });
  assert.deepEqual(ownerMe.data.entitlements, { owner: true, infiniteCoins: true, unlockAll: true });
  const otherMe = await request(env, '/api/social/me', { token: lookalike });
  assert.deepEqual(otherMe.data.entitlements, { owner: false, infiniteCoins: false, unlockAll: false });
});

test('progress sync requires authentication and rejects an older revision', async () => {
  const env = environment();
  const guest = await request(env, '/api/social/progress');
  assert.equal(guest.response.status, 401);

  const token = await signup(env, 'sync_user');
  const first = await request(env, '/api/social/progress', {
    method: 'PUT', token,
    body: { revision: 4, updatedAt: 100, level: 8, xp: 4200, coins: 900, inventory: ['avatar-nova', 'frame-gold'], equipped: { frame: 'frame-gold' } },
  });
  assert.equal(first.response.status, 200, JSON.stringify(first.data));
  assert.equal(first.data.progress.revision, 4);
  assert.equal(first.data.progress.serverRevision, 1);

  const stale = await request(env, '/api/social/progress', {
    method: 'PUT', token, body: { revision: 2, level: 1, xp: 10, coins: 1 },
  });
  assert.equal(stale.response.status, 409);
  assert.equal(stale.data.progress.revision, 4);

  const loaded = await request(env, '/api/social/progress', { token });
  assert.equal(loaded.response.status, 200);
  assert.equal(loaded.data.progress.xp, 4200);
  assert.deepEqual(loaded.data.progress.inventory, ['avatar-nova', 'frame-gold']);
});

test('server revision compare-and-swap rejects concurrent device overwrites', async () => {
  const env = environment();
  const token = await signup(env, 'two_devices');
  const initial = await request(env, '/api/social/progress', {
    method: 'PUT', token, body: { progress: { revision: 3, coins: 500 }, expectedRevision: 0 },
  });
  assert.equal(initial.response.status, 200);

  const firstDevice = await request(env, '/api/social/progress', {
    method: 'PUT', token, body: { progress: { revision: 4, serverRevision: 1, coins: 620 }, expectedRevision: 1 },
  });
  assert.equal(firstDevice.response.status, 200);
  assert.equal(firstDevice.data.progress.serverRevision, 2);

  const staleDevice = await request(env, '/api/social/progress', {
    method: 'PUT', token, body: { progress: { revision: 4, serverRevision: 1, coins: 310 }, expectedRevision: 1 },
  });
  assert.equal(staleDevice.response.status, 409);
  assert.equal(staleDevice.data.progress.serverRevision, 2);
  assert.equal(staleDevice.data.progress.coins, 620);
});

test('session pruning is based on creation time and preserves the newest login', async () => {
  const source = await readFile(new URL('../src/social/social-user.js', import.meta.url), 'utf8');
  assert.match(source, /sort\(\(a, b\) => Number\(b\[1\]\?\.createdAt/);
  assert.match(source, /filter\(\(\[key\]\) => key !== currentKey\)/);
});

test('progress sanitizer strips submitted owner flags and caps untrusted arrays', async () => {
  const env = environment();
  const token = await signup(env, 'normal_user');
  const items = Array.from({ length: 260 }, (_, index) => `item-${index}`);
  const saved = await request(env, '/api/social/progress', {
    method: 'PUT', token,
    body: { revision: 1, owner: true, infiniteCoins: true, inventory: items, purchaseLog: items.map((id, index) => ({ txId: `tx-${index}`, itemId: id, price: index, at: index })) },
  });
  assert.equal(saved.response.status, 200);
  assert.equal(Object.hasOwn(saved.data.progress, 'owner'), false);
  assert.equal(saved.data.progress.inventory.length, 200);
  assert.equal(saved.data.progress.purchaseLog.length, 120);
  assert.equal(saved.data.entitlements.owner, false);
});

test('social client applies authenticated entitlements and uploads later local revisions', async () => {
  const source = await readFile(new URL('../public/assets/js/social-client.js', import.meta.url), 'utf8');
  const stored = new Map([
    ['bs_social_session', 'session-token'],
    ['bs_social_profile', JSON.stringify({ username: 'bosrag', displayName: 'المدير' })],
  ]);
  const listeners = new Map();
  const calls = [];
  const applied = { entitlements: null, merged: null };
  let profile = { revision: 8, updatedAt: 20, xp: 800, inventory: ['avatar-nova'] };
  const window = {
    TAHADI_PROGRESS: {
      setEntitlements(value) { applied.entitlements = value; },
      merge(value) { applied.merged = value; profile = { ...profile, ...value, revision: Math.max(profile.revision, value.revision) + 1 }; return profile; },
      read() { return profile; },
    },
    addEventListener(type, fn) { listeners.set(type, fn); },
    dispatchEvent() {},
  };
  const document = { querySelectorAll: () => [], querySelector: () => null, body: { appendChild() {} } };
  const fetch = async (path, options = {}) => {
    calls.push({ path, method: options.method || 'GET', body: options.body });
    if (path === '/api/social/me') return new Response(JSON.stringify({
      ok: true,
      profile: { username: 'bosrag', displayName: 'المدير' },
      progress: { revision: 7, updatedAt: 10, xp: 700, inventory: ['frame-gold'] },
      entitlements: { owner: true, infiniteCoins: true, unlockAll: true },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
    if (path === '/api/social/progress') return new Response(JSON.stringify({ ok: true, progress: profile, entitlements: { owner: true, infiniteCoins: true, unlockAll: true } }), { status: 200, headers: { 'content-type': 'application/json' } });
    throw new Error(`unexpected path ${path}`);
  };
  const context = vm.createContext({
    window, document, fetch, localStorage: {
      getItem: (key) => stored.get(key) || null,
      setItem: (key, value) => stored.set(key, String(value)),
      removeItem: (key) => stored.delete(key),
    },
    Headers, Response, URL, EventTarget, CustomEvent,
    location: { protocol: 'https:', host: 'game.test', pathname: '/', search: '' },
    setTimeout, clearTimeout, console,
  });
  vm.runInContext(source, context);
  await window.BS_SOCIAL.me(true);
  assert.equal(applied.entitlements.owner, true);
  assert.equal(applied.entitlements.username, 'bosrag');
  assert.equal(applied.merged.xp, 700);

  profile = { ...profile, revision: 10, xp: 1000 };
  listeners.get('tahadi-progress')?.({ detail: profile });
  await new Promise((resolve) => setTimeout(resolve, 450));
  const upload = calls.find((entry) => entry.path === '/api/social/progress' && entry.method === 'PUT');
  assert.ok(upload);
  const uploadBody = JSON.parse(upload.body);
  assert.equal(uploadBody.progress.revision, 10);
  assert.equal(uploadBody.expectedRevision, 0);
});
