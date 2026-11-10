// 33.9.4: a picture for every player (ready or uploaded, with reports and the owner's review),
// any player opens their card with a tap, and levels and trophies for playing and winning.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile, stat } from 'node:fs/promises';
import { environment, signup, api as call } from './worker-harness.mjs';
const { default: Worker } = await import('../src/index.js');
const { decodePhoto, PHOTO_PRESETS, PHOTO_REPORTS_TO_HIDE } = await import('../src/social/social-user.js');

const read = (file) => readFile(new URL('../' + file, import.meta.url), 'utf8');
const api = (env, path, { method, token, body } = {}) => call(env, path, method === 'POST' ? body || {} : undefined, token);
const raw = (env, path) => Worker.fetch(new Request('https://game.test' + path, { headers: { Origin: 'https://game.test' } }), env);
function webp() { const b = Buffer.alloc(400); b.write('RIFF', 0); b.write('WEBP', 8); return b.toString('base64'); }

test('the ready pictures exist and an upload must really be a small JPG or WebP', async () => {
  for (const url of Object.values(PHOTO_PRESETS)) assert.ok((await stat(new URL('../public' + url, import.meta.url))).size > 1000, url);
  assert.equal(Object.keys(PHOTO_PRESETS).length, 20);
  assert.equal(PHOTO_PRESETS['g-princess-pink'], '/assets/avatars-v33-9-4/princess-pink.webp');
  assert.ok(decodePhoto(webp(), 'image/webp'));
  assert.equal(decodePhoto(webp(), 'image/jpeg'), null, 'the bytes must match the type');
  assert.equal(decodePhoto(Buffer.from('<svg onload=alert(1)>'.repeat(30)).toString('base64'), 'image/webp'), null);
  assert.equal(decodePhoto(webp(), 'image/svg+xml'), null);
  assert.equal(decodePhoto(Buffer.alloc(120000).toString('base64'), 'image/jpeg'), null, 'too big');
});

test('set, show, report three times to hide, and the owner keeps or removes', async () => {
  const env = environment();
  const owner = await signup(env, 'bosrag'), b = await signup(env, 'photo_b');
  const reporters = [await signup(env, 'rep_one'), await signup(env, 'rep_two'), await signup(env, 'rep_three')];
  let r = await api(env, '/api/social/photo', { method: 'POST', token: b.data.token, body: { photo: { kind: 'upload', type: 'image/webp', data: webp() } } });
  assert.equal(r.response.status, 200); assert.equal(r.data.photo.kind, 'upload');
  const shown = await raw(env, '/api/social/photo/photo_b');
  assert.equal(shown.status, 200); assert.equal(shown.headers.get('content-type'), 'image/webp');
  const card = await api(env, '/api/social/users/photo_b');
  assert.equal(card.data.profile.photo.kind, 'upload');
  // the same reporter counts once
  for (let i = 0; i < 2; i++) assert.equal((await api(env, '/api/social/report', { method: 'POST', token: reporters[0].data.token, body: { username: 'photo_b' } })).response.status, 200);
  assert.equal((await raw(env, '/api/social/photo/photo_b')).status, 200);
  for (const x of reporters.slice(1)) await api(env, '/api/social/report', { method: 'POST', token: x.data.token, body: { username: 'photo_b' } });
  assert.equal(PHOTO_REPORTS_TO_HIDE, 3);
  assert.equal((await raw(env, '/api/social/photo/photo_b')).status, 404, 'hidden after three players');
  assert.equal((await api(env, '/api/social/users/photo_b')).data.profile.photo, null);
  assert.equal((await api(env, '/api/social/moderation', { token: b.data.token })).response.status, 403);
  const list = await api(env, '/api/social/moderation', { token: owner.data.token });
  assert.deepEqual(list.data.reports.map((x) => [x.username, x.reports, x.hidden]), [['photo_b', 3, true]]);
  await api(env, '/api/social/moderation', { method: 'POST', token: owner.data.token, body: { username: 'photo_b', action: 'remove' } });
  assert.equal((await raw(env, '/api/social/photo/photo_b')).status, 404);
  assert.deepEqual((await api(env, '/api/social/moderation', { token: owner.data.token })).data.reports, []);
  // a ready picture
  // 33.9.7: the first change is free, the next one costs coins (the owner never pays)
  r = await api(env, '/api/social/photo', { method: 'POST', token: b.data.token, body: { photo: { kind: 'preset', id: 'h-falcon' } } });
  assert.equal(r.response.status, 400); assert.match(r.data.error, /250 عملة/);
  r = await api(env, '/api/social/photo', { method: 'POST', token: owner.data.token, body: { photo: { kind: 'preset', id: 'h-falcon' } } });
  assert.deepEqual(r.data.photo, { kind: 'preset', id: 'h-falcon' });
  const preset = await raw(env, '/api/social/photo/bosrag');
  assert.equal(preset.status, 302); assert.equal(preset.headers.get('location'), '/assets/heroes/face/falcon.webp');
  assert.equal((await api(env, '/api/social/photo', { method: 'POST', token: owner.data.token, body: { photo: { kind: 'preset', id: 'h-nope' } } })).response.status, 400);
  assert.equal((await api(env, '/api/social/report', { method: 'POST', token: reporters[0].data.token, body: { username: 'photo_b' } })).response.status, 404, 'only an uploaded photo is reported');
});

test('games and wins of each game are kept for the trophies', async () => {
  const sandbox = { window: {} }; sandbox.window = sandbox; vm.runInNewContext(await read('public/assets/js/profile-core.js'), sandbox);
  const C = sandbox.BS_CAREER_CORE;
  let p = C.normalize({});
  p = C.reward(p, { id: 'r1', game: 'baloot', win: true }); p = C.reward(p, { id: 'r2', game: 'baloot' }); p = C.reward(p, { id: 'r3', game: 'hockey', win: true });
  assert.deepEqual(JSON.parse(JSON.stringify(p.stats)), { baloot: [2, 1], hockey: [1, 1] });
  assert.deepEqual(JSON.parse(JSON.stringify(C.normalize({ stats: { baloot: [3, 9], nope: [1, 1], hockey: 'x' } }).stats)), { baloot: [3, 3] });
});

test('levels have names and trophies have four grades', async () => {
  const code = await read('public/assets/js/profile-pro-v33-9-4.js');
  const sandbox = { window: {}, document: { head: null, querySelector: () => null, readyState: 'complete', addEventListener() {}, createElement: () => ({}) }, addEventListener() {}, setTimeout() {}, Intl };
  sandbox.window = sandbox; vm.runInNewContext(code, sandbox);
  const P = sandbox.BS_PROFILE_PRO;
  assert.equal(P.levelInfo({ xp: 0 }).tier, 'مبتدئ');
  assert.equal(P.levelInfo({ xp: 9500 }).tier, 'محترف');
  assert.equal(P.levelInfo({ xp: 49999 }).tier, 'أسطورة');
  assert.equal(P.levelInfo({ xp: 1250 }).need, 750);
  const got = P.earned({ wins: 60, games: 120, rankedWins: 0, xp: 5000, streak: 3, stats: { baloot: [40, 30] } }).map((t) => t.id + ':' + t.tier);
  assert.deepEqual([...got].sort(), ['game-baloot:1', 'games:1', 'level:0', 'streak:0', 'wins:1']);
  assert.equal(P.presetUrl('h-falcon'), '/assets/heroes/face/falcon.webp');
  assert.equal(P.photoUrl('saad_1', { kind: 'upload', v: 5 }), '/api/social/photo/saad_1?v=5');
});

test('any player opens their card with a tap: rooms, friends and the leaderboard', async () => {
  assert.match(await read('public/assets/js/profile-pro-v33-9-4.js'), /closest\?\.\('\[data-player-username\]'\)/);
  assert.match(await read('public/social.html'), /who\.dataset\.playerUsername=person\.username/);
  assert.match(await read('public/assets/js/leaderboard-v30-1.js'), /li\.dataset\.playerUsername=row\.username/);
  const card = await read('public/assets/js/player-card-v33-7.js');
  assert.match(card, /P\.report\(profile\.username/);
  assert.match(card, /P\.shelf\(card/);
  assert.match(card, /'أضف صديق'/);
});

test('the release is 33.9.4 or later with its notes', async () => {
  assert.match(JSON.parse(await read('package.json')).version, /^33\.(?:9\.(?:[4-9]|\d{2,})|\d{2,}\.\d+)$/);
  const notes = await read('RELEASE_V33_9_4_AR.md');
  for (const word of ['صورة جاهزة', 'بلّغ عن الصورة', 'أضف|تضيفه', 'مستوى', 'الكؤوس', 'ماسي']) assert.match(notes, new RegExp(word));
  assert.doesNotMatch(notes, /بوت(?!ن)/);
  assert.doesNotMatch(notes, /السلم والثعبان/);
  assert.match(await read('README-AR.md'), /RELEASE_V33_9_4_AR\.md/);
});
