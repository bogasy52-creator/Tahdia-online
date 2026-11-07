// 33.6.0: «سباق الفوضى», the Jackaroo star board, invitations that arrive, joining any room
// from the home page, and the challenge games counting for your career and daily missions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Career } from '../src/career/core.js';
import { ChallengeRoom } from '../src/challenges/challenge-room.js';
import { createRace } from '../public/assets/js/engines/chaos-core.js';
import { createChallenge, advanceChallenge } from '../public/assets/js/engines/challenge-core.js';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('the 33.6.0 notes say what changed', async () => {
  const notes = await read('RELEASE_V33_6_AR.md');
  for (const words of ['سباق الفوضى', 'جاكارو', 'الدعوات', 'ادخل غرفة برمز', 'المهام اليومية']) assert.ok(notes.includes(words), words);
});

test('home: «ادخل غرفة برمز» opens a sheet only when asked; the page never jumps to it', async () => {
  const home = await read('public/index.html');
  assert.match(home, /<button id="homeJoinOpen" class="bs-btn home-join-open" type="button" aria-haspopup="dialog" aria-controls="homeJoinSheet">/);
  assert.match(home, /<div id="homeJoinSheet" class="home-join-sheet" hidden><form id="homeJoinForm"/);
  assert.doesNotMatch(home, /autofocus/);
  assert.doesNotMatch(home, /id="homeRoomJoin"|id="homeRoomCode"/, 'the old box that pulled the page down stays gone');
  assert.match(home, /assets\/js\/home-join-v33-6\.js\?v=/);
  const script = await read('public/assets/js/home-join-v33-6.js');
  assert.match(script, /await m\.joinAnywhere\(code, \{ game: null,/);
  assert.match(script, /input\.focus\(\{ preventScroll: true \}\)/);
  assert.ok(JSON.parse(await read('scripts/style-bundles.json'))['index.html'].includes('assets/css/home-join-v33-6.css'));
  assert.match(await read('public/assets/css/app-index.css'), /\.home-join-sheet\[hidden\]\{display:none\}/);
});

test('the challenge games pay XP and coins and have daily missions', () => {
  for (const game of ['focus', 'cipher', 'wordbomb', 'chaos']) {
    const p = Career.reward(Career.normalize({}), { id: 'r:' + game, game, win: true, verified: true });
    assert.equal(p.games, 1, game); assert.ok(p.coins > 0);
  }
  const days = Array.from({ length: 40 }, (_, i) => Career.gameMissionsFor(Career.riyadhDay(Date.parse('2026-11-01T12:00:00Z') + i * 86400000))[1].game);
  for (const game of ['chaos', 'wordbomb', 'cipher']) assert.ok(days.includes(game), game + ' comes round');
});

test('the shop sends a mission of a new game to its game', async () => {
  const shop = await read('public/assets/js/shop-v31.js');
  assert.match(shop, /chaos:\{name:'أونو',href:'\/chaos'\},wordbomb:\{name:'صيد الكلمات',href:'\/wordbomb'\},cipher:\{name:'ساحة الشفرات',href:'\/cipher'\}/);
});

function challengeRoom(fail = 0) {
  const posts = [];
  const storage = { map: new Map(), async get(k) { return this.map.get(k); }, async put(k, v) { if (typeof k === 'object') for (const [a, b] of Object.entries(k)) this.map.set(a, b); else this.map.set(k, v); }, async delete() {}, async deleteAll() {}, async setAlarm() {}, transaction(fn) { return fn(this); } };
  const ctx = { storage, getWebSockets: () => [], blockConcurrencyWhile: (fn) => fn() };
  const env = { SOCIAL_USERS: { idFromName: (n) => n, get: (name) => ({ fetch: async (url, init) => { if (fail-- > 0) return new Response('{}', { status: 503 }); posts.push({ name, url, body: JSON.parse(init.body) }); return Response.json({ ok: true }); } }) } };
  return { room: new ChallengeRoom(ctx, env), posts };
}
function finishedRace(humans, ms = 70000) {
  const players = [...Array.from({ length: humans }, (_, i) => ({ id: 'h' + i, name: 'لاعب ' + i })), ...Array.from({ length: 4 - humans }, (_, i) => ({ id: 'b' + i, name: 'آلي', bot: true }))];
  const m = createChallenge('chaos', players, 5, 1000);
  m.phase = 'finished'; m.finishedAt = m.startedAt + ms; m.winners = ['h0'];
  return { code: '981234', game: 'chaos', round: 3, match: m, players: players.map((p, i) => ({ ...p, username: p.bot ? null : i === 1 ? null : 'user_' + i })), expiresAt: Date.now() + 60000 };
}

test('a challenge room pays a round two people played — each account once, the winner a win', async () => {
  const { room, posts } = challengeRoom();
  await room.ready; room.room = finishedRace(3);
  await room.reward(); await room.reward();
  assert.deepEqual(posts.map((p) => p.name), ['user:user_0', 'user:user_2'], 'the guest has no account; the computer runners are not paid');
  assert.ok(posts.every((p) => p.url === 'https://social.internal/career/verified'));
  assert.deepEqual(posts.map((p) => [p.body.game, p.body.win]), [['chaos', true], ['chaos', false]]);
  assert.match(posts[0].body.id, /^chaos:981234:3:\d+:h0$/);
  assert.equal(room.room.rewardedRound, 3);
});

test('a room alone with the computer, or a round over in seconds, pays nothing; a failed payment tries again', async () => {
  let x = challengeRoom(); await x.room.ready; x.room.room = finishedRace(1); await x.room.reward(); assert.equal(x.posts.length, 0);
  x = challengeRoom(); await x.room.ready; x.room.room = finishedRace(3, 8000); await x.room.reward(); assert.equal(x.posts.length, 0);
  x = challengeRoom(1); await x.room.ready; x.room.room = finishedRace(2); await x.room.reward();
  assert.equal(x.posts.length, 0); assert.ok(x.room.room.rewardAt > Date.now(), 'a retry is booked');
  x.room.room.rewardAt = Date.now() - 1; await x.room.reward();
  assert.equal(x.posts.length, 1); assert.equal(x.room.room.rewardAt, null);
  const src = await read('src/challenges/challenge-room.js');
  assert.match(src, /this\.room\.reportAt\|\|Infinity,this\.room\.rewardAt\|\|Infinity,/, 'the retry wakes the room');
});

test('the challenge page records practice and guest rounds, and refreshes a paid round', async () => {
  const client = await read('public/assets/js/challenge-client.js');
  assert.match(client, /if\(!played\.has\(key\)\)\{played\.add\(key\);career\(m,won\);/);
  assert.match(client, /if\(!local&&signed&&humans>=2\)\{setTimeout\(\(\)=>\{\(window\.BS_PRO\?\.onlineResult/);
  assert.match(client, /\(window\.BS_PRO\?\.record\|\|window\.BS_CAREER\?\.record\)\?\.\(\{id,game,win:won\}\)/);
  // practice runs on the page's own clock
  assert.match(client, /if\(local\)\{const t=now\(\);advanceChallenge\(local,t\);applyChallenge\(local,'me',action,t\);/);
});

test('a race advanced by the room keeps its winner for the career', () => {
  const m = createChallenge('chaos', [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], 9, 1000);
  delete m.uno;m.race=createRace(m.players,9,1000);m.endsAt=m.race.endsAt;
  m.race.runners[0].pos = 219.6; m.race.runners[0].lane = 0;
  advanceChallenge(m, m.race.startAt + 400);
  advanceChallenge(m, m.race.startAt + 400 + 26000);
  assert.equal(m.phase, 'finished'); assert.deepEqual(m.winners, ['a']);
});
