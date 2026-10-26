import test from 'node:test';
import assert from 'node:assert/strict';
import { environment, api, signup } from './worker-harness.mjs';
import { PresenceRegistry, cleanBeat, presencePage, PRESENCE_TTL_MS, PRESENCE_PAGES } from '../src/presence/presence-registry.js';
const Worker = await import('../src/index.js'); // after the harness has taught Node the Workers imports

const ID = (n) => ('tab' + n).padEnd(12, '0');
const DEV = (n) => ('dev' + n).padEnd(12, '0');
function registry() {
  const values = new Map();
  return new PresenceRegistry({ storage: { get: async (k) => structuredClone(values.get(k)), put: async (k, v) => values.set(k, structuredClone(v)) } });
}

test('pages map to the games players know', () => {
  assert.deepEqual(presencePage('/sudoku?room=123456'), { page: 'sudoku', ...PRESENCE_PAGES.sudoku });
  assert.equal(presencePage('/online.html').key, 'quiz');
  assert.equal(presencePage('/').key, 'home');
  assert.equal(presencePage('/party').label, 'الألعاب الجماعية');
  assert.equal(presencePage('/nope/../x').key, 'other');
});

test('a heartbeat is cleaned; identity can never come from the page', () => {
  assert.equal(cleanBeat(null), null);
  assert.equal(cleanBeat({ cid: 'x', did: DEV(1) }), null);
  const beat = cleanBeat({ cid: ID(1).toUpperCase(), did: DEV(1), path: '/snakes?room=654321', room: '654321', vis: 'visible', dev: 'm', name: ' <b>سعد</b> ', user: 'bosrag', verified: true }, { country: 'SA' });
  assert.deepEqual(beat, { cid: ID(1), did: DEV(1), page: 'snakes', room: '654321', vis: 'visible', dev: 'm', cc: 'SA', guestName: 'bسعد/b', signedOut: false });
  assert.equal(cleanBeat({ cid: ID(1), did: DEV(1), room: '12', vis: 'weird', name: 'لاعب العباقرة' }).room, '');
  assert.equal(cleanBeat({ cid: ID(1), did: DEV(1), name: 'لاعب العباقرة' }).guestName, '', 'a name nobody chose is not shown');
  assert.equal(cleanBeat({ cid: ID(1), did: DEV(1) }, { country: 'sa1' }).cc, '');
});

test('people are counted per device, per game and per room; a closed tab leaves at once', () => {
  const reg = registry(), now = 1_000_000;
  reg.beat(cleanBeat({ cid: ID(1), did: DEV(1), path: '/sudoku', room: '111111', name: 'نورة' }), null, now);
  reg.beat(cleanBeat({ cid: ID(2), did: DEV(1), path: '/', vis: 'hidden' }), null, now - 5000); // a second tab of the same device
  reg.beat(cleanBeat({ cid: ID(3), did: DEV(2), path: '/sudoku', room: '111111' }), { user: 'saad_1', name: 'سعد' }, now);
  reg.beat(cleanBeat({ cid: ID(4), did: DEV(3), path: '/baloot', vis: 'hidden' }), null, now);
  const s = reg.summary(now);
  assert.equal(s.people, 3); assert.equal(s.tabs, 4);
  assert.equal(s.signed, 1); assert.equal(s.guests, 2);
  assert.equal(s.background, 1); assert.equal(s.inRooms, 2);
  const sudoku = s.games.find((g) => g.key === 'sudoku');
  assert.deepEqual([sudoku.people, sudoku.signed, sudoku.guests, sudoku.rooms], [2, 1, 1, 1]);
  assert.deepEqual(s.rooms[0], { key: 'sudoku', label: 'سودوكو', room: '111111', people: 2, names: ['ضيف · نورة', 'سعد'] });
  assert.equal(s.list[0].signed, true, 'accounts first');
  assert.equal(s.list[0].user, 'saad_1');
  reg.beat(cleanBeat({ cid: ID(3), did: DEV(2), vis: 'leave' }), null, now + 1000);
  assert.equal(reg.summary(now + 1000).signed, 0);
});

test('a tab keeps the account it proved until it signs out, and silence ends a visit', () => {
  const reg = registry(), now = 5_000_000;
  reg.beat(cleanBeat({ cid: ID(1), did: DEV(1), path: '/zahra' }), { user: 'reem22', name: 'ريم' }, now);
  reg.beat(cleanBeat({ cid: ID(1), did: DEV(1), path: '/jackaroo', name: 'غيره' }), null, now + 20_000);
  let row = reg.summary(now + 20_000).list[0];
  assert.deepEqual([row.user, row.name, row.game], ['reem22', 'ريم', 'jackaroo']);
  reg.beat(cleanBeat({ cid: ID(1), did: DEV(1), path: '/jackaroo', name: 'ضيفة', user: '' }), null, now + 40_000);
  row = reg.summary(now + 40_000).list[0];
  assert.deepEqual([row.signed, row.name], [false, 'ضيفة']);
  assert.equal(reg.summary(now + 40_000 + PRESENCE_TTL_MS).people, 0, 'five quiet minutes and the visit is over');
});

test('repeated identical beats are throttled and the snapshot survives a restart', async () => {
  const values = new Map(), ctx = { storage: { get: async (k) => structuredClone(values.get(k)), put: async (k, v) => values.set(k, structuredClone(v)) } };
  const reg = new PresenceRegistry(ctx), now = Date.now();
  assert.equal(reg.beat(cleanBeat({ cid: ID(1), did: DEV(1), path: '/memory' }), null, now).throttled, undefined);
  assert.equal(reg.beat(cleanBeat({ cid: ID(1), did: DEV(1), path: '/memory' }), null, now + 1000).throttled, true);
  await reg.save(now, true);
  const again = new PresenceRegistry(ctx); await again.load();
  assert.equal(again.summary(now + 2000).people, 1);
});

test('heartbeats reach the registry; only the owner reads who is here', async () => {
  const env = environment();
  const owner = await signup(env, 'bosrag'), player = await signup(env, 'fahad_7');
  const beat = (body, token) => api(env, '/api/presence', body, token);
  let res = await beat({ cid: ID(1), did: DEV(1), path: '/sudoku', room: '222222', name: 'ضيف جديد' });
  assert.equal(res.response.status, 200); assert.equal(res.data.auth, 'none');
  res = await beat({ cid: ID(2), did: DEV(2), path: '/snakes' }, player.data.token);
  assert.equal(res.data.auth, 'ok'); assert.equal(res.data.user, 'fahad_7');
  res = await beat({ cid: ID(3), did: DEV(3), path: '/' }, 'not-a-token');
  assert.equal(res.data.auth, 'failed');
  assert.equal((await beat({ cid: 'bad', did: DEV(4) })).response.status, 400);
  const denied = await api(env, '/api/social/admin/live', null, player.data.token);
  assert.equal(denied.response.status, 403);
  assert.equal((await api(env, '/api/social/admin/live')).response.status, 401);
  const live = await api(env, '/api/social/admin/live', null, owner.data.token);
  assert.equal(live.response.status, 200);
  assert.equal(live.data.people, 3);
  assert.equal(live.data.signed, 1);
  assert.equal(live.data.rooms[0].room, '222222');
  assert.ok(live.data.list.some((row) => row.user === 'fahad_7' && row.label === 'السلم والثعبان'));
  const wrongMethod = await Worker.default.fetch(new Request('https://game.test/api/presence', { headers: { Origin: 'https://game.test' } }), env);
  assert.equal(wrongMethod.status, 405);
});
