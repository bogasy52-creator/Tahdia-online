import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { environment, api } from './worker-harness.mjs';
import { planBotAnswers, dueBotAnswers, nextBotAnswer, makeQuizBots, pickQuizBotLevel } from '../src/quiz/quiz-bots.js';
import { createMatch, botsAct, advanceMatch, publicMatch } from '../src/quick/core.js';
import { QUICK_BOT_AFTER_MS } from '../src/quick/arena.js';
const { GameRoom } = await import('../src/index.js');
const { CATEGORIES } = await import('../src/questions.js');

// 33.0.0: the quiz is online. Nobody to meet → a bot; alone in a room → two bots.
function seeded(seed) { return () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; }; }

test('bots come in three strengths: a hard bot is quicker and right more often than an easy one', () => {
  const rng = seeded(11), levels = new Set();
  for (let i = 0; i < 300; i++) levels.add(pickQuizBotLevel(rng));
  assert.deepEqual([...levels].sort(), ['easy', 'hard', 'medium']);
  const bots = makeQuizBots(3, ['سعد'], seeded(5));
  assert.equal(new Set(bots.map((b) => b.name)).size, 3);
  assert.ok(bots.every((b) => b.bot && b.id.startsWith('bot-') && b.name !== 'سعد'));
  const tally = (level) => {
    let right = 0, time = 0;
    const rng = seeded(level.length * 97);
    for (let i = 0; i < 400; i++) {
      const plan = planBotAnswers({ opensAt: 0, deadline: 30000, options: 4, correct: 2 }, [{ id: 'b', level }], rng).b;
      right += plan.choice === 2; time += plan.at;
      assert.ok(plan.at >= 0 && plan.at < 30000);
    }
    return { right: right / 400, time: time / 400 };
  };
  const easy = tally('easy'), hard = tally('hard');
  assert.ok(hard.right > easy.right + 0.2, 'hard is right more often');
  assert.ok(hard.time < easy.time, 'hard answers sooner');
  const plan = { a: { at: 100, choice: 1 }, b: { at: 900, choice: 0 } };
  assert.deepEqual(dueBotAnswers(plan, {}, 500).map((x) => x.id), ['a']);
  assert.equal(nextBotAnswer(plan, { a: {} }), 900);
});

test('a quick match against a bot: the bot answers each question on its own clock', () => {
  const questions = Array.from({ length: 3 }, (_, i) => ({ text: 'س' + i, category: 'عام', options: ['أ', 'ب', 'ج', 'د'], correct: 1, value: 100 }));
  const [bot] = makeQuizBots(1, ['سعد']);
  const m = createMatch([{ id: 'me', name: 'سعد' }, bot], questions, 1000);
  const view = publicMatch(m, 'me', 1000);
  assert.deepEqual(view.players.map((p) => Boolean(p.bot)), [false, true]);
  assert.ok(['easy', 'medium', 'hard'].includes(view.players[1].level));
  const first = botsAct(m, 1000);
  assert.ok(first > 1000 && first < m.deadline, 'the bot has a moment to answer');
  botsAct(m, first);
  assert.ok(m.answers[bot.id], 'the bot answered at its moment');
  // play the rest: the person never answers, the bot always does; the match still ends
  let now = first;
  for (let i = 0; i < 40 && m.phase !== 'finished'; i++) { now += 4000; botsAct(m, now); advanceMatch(m, now); botsAct(m, now); }
  assert.equal(m.phase, 'finished');
});

test('«العب الحين» seats you against a bot when nobody comes within a few seconds', async (t) => {
  const env = environment(), real = Date.now;
  let clock = real();
  t.mock.method(Date, 'now', () => clock);
  const joined = await api(env, '/api/quick/join', { name: 'سعد' });
  assert.equal(joined.response.status, 200);
  assert.equal(joined.data.status, 'waiting');
  const session = { id: joined.data.id, secret: joined.data.secret };
  clock += 3000;
  assert.equal((await api(env, '/api/quick/ticket', session)).data.status, 'waiting', 'still looking for a person');
  clock += QUICK_BOT_AFTER_MS;
  const matched = await api(env, '/api/quick/ticket', session);
  assert.equal(matched.data.status, 'matched');
  const state = await api(env, '/api/quick/matches/' + matched.data.matchId + '/state', session);
  assert.equal(state.response.status, 200);
  const players = state.data.state.players;
  assert.equal(players.length, 2);
  assert.equal(players.filter((p) => p.bot).length, 1);
  assert.equal(players.find((p) => !p.bot).name, 'سعد');
  Date.now = real;
});

function quizRoom(people = 1) {
  const g = Object.create(GameRoom.prototype);
  g.alarms = [];
  g.ctx = { getWebSockets: () => [], storage: { get: async () => null, put: async () => {}, setAlarm: async (at) => { g.alarms.push(at); } } };
  const order = Array.from({ length: people }, (_, i) => 'p' + i);
  g.room = { code: '100123', status: 'lobby', mode: 'free', playerLimit: 20, selectedCategories: CATEGORIES.slice(0, 6).map((c) => c.id), roundCount: 12, roundIndex: -1, order, players: {}, current: null, expiresAt: Date.now() + 3600000 };
  for (const [i, id] of order.entries()) g.room.players[id] = { id, name: 'لاعب ' + i, role: i ? 'guest' : 'host', team: null, connected: true, ready: false, score: 0, powers: { double: true, time: true, block: true } };
  g.persistAndBroadcast = async () => {};
  g.persist = async () => {};
  g.syncConnectedFlags = () => {};
  g.errors = []; g.sendError = (_ws, error) => g.errors.push(error);
  g.playerForSocket = (ws) => g.room.players[ws.id];
  return g;
}
const socket = (id) => ({ id, deserializeAttachment: () => ({ playerId: id }), send() {} });

test('alone in a quiz room: the host starts and two bots of mixed strength play too, no «جاهز» step', async () => {
  const g = quizRoom(1);
  await g.webSocketMessage(socket('p0'), JSON.stringify({ type: 'start' }));
  assert.deepEqual(g.errors, []);
  assert.equal(g.room.status, 'playing');
  const bots = g.room.order.map((id) => g.room.players[id]).filter((p) => p.bot);
  assert.equal(bots.length, 2);
  assert.ok(g.room.current.botPlan, 'the bots have their answers planned');
  assert.equal('botPlan' in (g.publicState('p0').current || {}), false, 'nobody can see what the bots will answer');
  assert.ok(g.publicState('p0').players.some((p) => p.bot && p.level));
  // the bots answer when their moment comes (the alarm), the round ends when all answered
  const c = g.room.current, last = Math.max(...Object.values(c.botPlan).map((a) => a.at));
  await g.handleAnswer(g.room.players.p0, 0);
  const realNow = Date.now;
  Date.now = () => Math.max(last, c.answerOpensAt) + 1;
  try { await g.alarm(); } finally { Date.now = realNow; }
  assert.ok(g.room.lastReveal, 'everyone answered: the round is revealed');
  assert.equal(Object.keys(g.room.lastReveal.results).length, 3);
  // after the match the bots leave with it
  g.room.status = 'finished';
  await g.resetForRematch();
  assert.equal(g.room.order.length, 1);
});

test('a quiz room of friends starts with whoever came; two teams need 4 or 6 people', async () => {
  const two = quizRoom(2);
  await two.webSocketMessage(socket('p0'), JSON.stringify({ type: 'start' }));
  assert.equal(two.room.status, 'playing');
  assert.equal(two.room.order.some((id) => two.room.players[id].bot), false, 'two people: no bots');
  const teams = quizRoom(3);
  await teams.webSocketMessage(socket('p0'), JSON.stringify({ type: 'set_mode', mode: 'teams' }));
  assert.equal(teams.room.mode, 'teams-6');
  assert.deepEqual(teams.room.order.map((id) => teams.room.players[id].team), ['A', 'B', 'A']);
  await teams.webSocketMessage(socket('p0'), JSON.stringify({ type: 'start' }));
  assert.equal(teams.room.status, 'lobby');
  assert.match(teams.errors.at(-1), /4 أو 6/);
  const four = quizRoom(4);
  await four.webSocketMessage(socket('p0'), JSON.stringify({ type: 'set_mode', mode: 'teams' }));
  await four.webSocketMessage(socket('p0'), JSON.stringify({ type: 'start' }));
  assert.equal(four.room.status, 'playing');
  assert.equal(four.room.mode, 'teams-4', 'the teams are the people who came');
  await four.webSocketMessage(socket('p1'), JSON.stringify({ type: 'set_mode', mode: 'free' }));
  assert.match(four.errors.at(-1), /للمضيف/);
});

test('the quiz pages are online only: the shared menu, no player count, the same-device page sends you online', async () => {
  const read = (file) => readFile(new URL('../public/' + file, import.meta.url), 'utf8');
  const online = await read('online.html');
  assert.match(online, /id="gameMenu"/);
  assert.match(online, /game-menu-v33\.js/);
  assert.doesNotMatch(online, /id="playerLimit"|id="readyBtn"/);
  assert.match(online, /send\('set_mode'/);
  const local = await read('local.html');
  assert.match(local, /location\.replace\(target\)/);
  assert.match(local, /\/online/);
  const hub = await read('quiz.html');
  assert.doesNotMatch(hub, /href="\/local/);
  assert.match(await read('assets/js/quiz-hub.js'), /\/online\?categories=/);
});
