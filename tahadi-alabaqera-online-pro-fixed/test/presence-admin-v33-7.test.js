import test from 'node:test';
import assert from 'node:assert/strict';
import { environment, signup, api } from './worker-harness.mjs';

const befriend = async (env, a, b) => {
  const ta = (await signup(env, a)).data.token, tb = (await signup(env, b)).data.token;
  assert.equal((await api(env, '/api/social/friends/request', { username: b }, ta)).response.status, 201);
  assert.equal((await api(env, '/api/social/friends/respond', { username: a, accept: true }, tb)).response.status, 200);
  return { ta, tb };
};
// a socket that is open on the server, as a phone that has just connected would be
const openSocket = async (env, name, connectedAt) => {
  const holder = env.BOARD_ROOMS.peek('social:user:' + name), user = await holder.instance.socialDelegate();
  holder.ctx.waitUntil = (p) => { Promise.resolve(p).catch(() => {}); }; // the test double has none
  const ws = { closed: null, attachment: { username: name, connectedAt }, serializeAttachment(v) { this.attachment = v; }, deserializeAttachment() { return this.attachment; }, send() {}, close(code, reason) { this.closed = [code, reason]; holder.ctx.sockets = holder.ctx.sockets.filter((w) => w !== this); } };
  holder.ctx.sockets.push(ws); user.lastPing = connectedAt; await user.setPresence(true);
  return { holder, user, ws };
};
const friendsOf = async (env, token) => (await api(env, '/api/social/me', undefined, token)).data.friends;

test('a friend who is still beating shows as online', async (t) => {
  const now = 1790000000000; t.mock.method(Date, 'now', () => now);
  const env = environment(), { ta } = await befriend(env, 'pres_a', 'pres_b');
  await openSocket(env, 'pres_b', now);
  assert.equal((await friendsOf(env, ta)).find((f) => f.username === 'pres_b').online, true);
});

test('a friend whose connection died without a goodbye stops showing as online, and the dead socket is closed', async (t) => {
  let now = 1790000000000; t.mock.method(Date, 'now', () => now);
  const env = environment(), { ta } = await befriend(env, 'dead_a', 'dead_b');
  const { ws, user } = await openSocket(env, 'dead_b', now);
  assert.equal((await friendsOf(env, ta)).find((f) => f.username === 'dead_b').online, true);
  now += 120_000; // two minutes of silence: no ping ever came
  const friend = (await friendsOf(env, ta)).find((f) => f.username === 'dead_b');
  assert.equal(friend.online, false, 'the copy of the status kept by the other account is corrected');
  assert.deepEqual(ws.closed, [4004, 'stale'], 'the dead socket is closed');
  assert.equal(user.presence.online, false);
  assert.ok(friend.lastSeen && friend.lastSeen <= now - 100_000, 'last seen is the last beat, not now');
});

test('a ping keeps the account online past the limit', async (t) => {
  let now = 1790000000000; t.mock.method(Date, 'now', () => now);
  const env = environment(), { ta } = await befriend(env, 'beat_a', 'beat_b');
  const { user } = await openSocket(env, 'beat_b', now);
  for (let i = 0; i < 6; i++) { now += 25_000; user.lastPing = now; } // a page that is open pings every 25 s
  assert.equal((await friendsOf(env, ta)).find((f) => f.username === 'beat_b').online, true);
});

test('the sweep alarm closes a dead connection by itself', async (t) => {
  let now = 1790000000000; t.mock.method(Date, 'now', () => now);
  const env = environment(); await signup(env, 'sweep_a');
  const { ws, user, holder } = await openSocket(env, 'sweep_a', now);
  user.armSweep(now); await user.defer?.(Promise.resolve());
  assert.ok(holder.ctx.storage.alarm && holder.ctx.storage.alarm > now, 'an alarm is armed');
  now += 100_000; await user.alarm();
  assert.equal(user.presence.online, false); assert.deepEqual(ws.closed, [4004, 'stale']);
});

const ownerCall = (env, token, body) => api(env, '/api/social/admin/action', { requestId: 'adm-' + Math.random().toString(36).slice(2), ...body }, token);

test('the owner can rename an account, and the name reaches the friends', async () => {
  const env = environment(), owner = (await signup(env, 'bosrag')).data.token, { ta, tb } = await befriend(env, 'ren_a', 'ren_b');
  const r = await ownerCall(env, owner, { username: 'ren_a', action: 'rename', text: 'اسم جديد', reason: 'اسم مخالف' });
  assert.equal(r.response.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.account.profile.displayName, 'اسم جديد');
  assert.equal((await ownerCall(env, owner, { username: 'ren_a', action: 'rename', text: 'x' })).response.status, 400, 'too short');
  assert.equal((await ownerCall(env, owner, { username: 'bosrag', action: 'rename', text: 'اسم آخر' })).response.status, 400, 'the owner is protected');
  assert.equal((await api(env, '/api/social/me', undefined, ta)).response.status, 200, 'renaming does not sign the player out');
  const audit = (await api(env, '/api/social/admin', undefined, owner)).data.audit;
  assert.ok(audit.some((e) => e.action === 'rename' && e.text === 'اسم جديد'));
});

test('the owner can take an item back, but not a free starter item', async () => {
  const env = environment(), owner = (await signup(env, 'bosrag')).data.token; await signup(env, 'lock_a');
  await ownerCall(env, owner, { username: 'lock_a', action: 'unlock-item', item: 'dice-gold' });
  let acc = (await api(env, '/api/social/admin/account?username=lock_a', undefined, owner)).data.account;
  assert.ok(acc.career.owned.includes('dice-gold'));
  const r = await ownerCall(env, owner, { username: 'lock_a', action: 'lock-item', item: 'dice-gold' });
  assert.equal(r.response.status, 200, JSON.stringify(r.data)); assert.ok(!r.data.account.career.owned.includes('dice-gold'));
  assert.equal((await ownerCall(env, owner, { username: 'lock_a', action: 'lock-item', item: 'dice-gold' })).response.status, 409, 'it is no longer owned');
  assert.equal((await ownerCall(env, owner, { username: 'lock_a', action: 'lock-item', item: 'character-fox' })).response.status, 400, 'a free starter stays');
});

test('an announcement can expire, and carries its tone', async (t) => {
  let now = 1790000000000; t.mock.method(Date, 'now', () => now);
  const env = environment(), owner = (await signup(env, 'bosrag')).data.token;
  const r = await ownerCall(env, owner, { action: 'announcement', text: 'صيانة قصيرة الليلة', hours: 6, level: 'warn' });
  assert.equal(r.response.status, 200, JSON.stringify(r.data)); assert.equal(r.data.announcement.level, 'warn'); assert.equal(r.data.announcement.expiresAt, now + 6 * 3600000);
  assert.equal((await api(env, '/api/social/announcement')).data.announcement.text, 'صيانة قصيرة الليلة');
  now += 7 * 3600000;
  assert.equal((await api(env, '/api/social/announcement')).data.announcement, null, 'after six hours it is gone');
});

test('only the owner may use the new powers', async () => {
  const env = environment(), a = (await signup(env, 'plain_a')).data.token; await signup(env, 'plain_b');
  for (const body of [{ username: 'plain_b', action: 'rename', text: 'اسم' }, { username: 'plain_b', action: 'lock-item', item: 'dice-gold' }, { action: 'announcement', text: 'مرحبا' }]) assert.equal((await ownerCall(env, a, body)).response.status, 403);
});
