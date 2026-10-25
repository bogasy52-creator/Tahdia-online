import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import './worker-harness.mjs';
const { GameRoom } = await import('../src/index.js');
const { CATEGORIES } = await import('../src/questions.js');

const root = new URL('../', import.meta.url).pathname;
const read = (file) => readFile(root + file, 'utf8');

function room() {
  const g = Object.create(GameRoom.prototype);
  g.ctx = { getWebSockets: () => [], storage: { get: async () => null, put: async () => {}, setAlarm: async (t) => { g.nextAlarm = t; } } };
  const order = ['a0', 'b0', 'a1', 'b1'];
  g.room = { code: '123456', status: 'playing', mode: 'teams-4', playerLimit: 4, selectedCategories: CATEGORIES.slice(0, 6).map((c) => c.id), roundCount: 12, matchId: 'm-32-0-1', roundIndex: -1, order, players: {}, current: null };
  for (const id of order) g.room.players[id] = { id, name: id, role: id === 'a0' ? 'host' : 'guest', team: id[0].toUpperCase(), connected: true, ready: true, score: 0, powers: { double: true, time: true, block: true } };
  g.persistAndBroadcast = async () => {};
  g.errors = []; g.sendError = (_ws, error) => g.errors.push(error);
  return g;
}

test('32.0.1: every quiz round is answered in secret; nobody can grab a question with a buzzer', async () => {
  const worker = await read('src/index.js');
  assert.doesNotMatch(worker, /handleBuzz|finalizeBuzzer|case "buzz"/);
  assert.equal(GameRoom.prototype.handleBuzz, undefined);
  // a plan saved by an older build may still say "buzzer": it is played in secret
  const g = room();
  const cat = CATEGORIES.find((c) => c.questions.some((q) => !q.media));
  const index = cat.questions.findIndex((q) => !q.media);
  g.room.roundPlan = [{ catId: cat.id, qid: cat.id + ':' + index, mode: 'buzzer' }, { catId: cat.id, qid: cat.id + ':' + index, mode: 'secret' }];
  await g.startNextRound();
  assert.equal(g.room.current.mode, 'secret');
  assert.equal(g.room.current.phase, 'secret');
  assert.ok(g.room.current.deadline - g.room.current.answerOpensAt >= 30000);
  const view = g.publicState('b0');
  assert.equal(view.current.options.length, 4, 'every player sees the choices at once');
  assert.equal('buzzWinner' in view.current, false);
  // a "buzz" from an old page is refused and changes nothing
  const ws = { deserializeAttachment: () => ({ playerId: 'a0' }) };
  g.playerForSocket = () => g.room.players.a0;
  const before = JSON.stringify(g.room.current);
  await g.webSocketMessage(ws, JSON.stringify({ type: 'buzz' }));
  assert.equal(JSON.stringify(g.room.current), before);
  // everyone answers, then the round is revealed
  for (const id of g.room.order) await g.handleAnswer(g.room.players[id], g.room.current.correctIndex);
  assert.equal(g.room.current, null);
  assert.ok(Object.values(g.room.lastReveal.results).every((r) => r.correct && r.gain > 0));
});

test('32.0.1: the quiz pages no longer show a buzzer', async () => {
  const online = await read('public/online.html');
  assert.doesNotMatch(online, /بازر|send\('buzz'\)|class="buzzer"|className='buzzer'/);
  assert.match(online, /c\.mode==='relay'\?'سلسلة الفريق':'إجابة سرية'/);
  // the reveal tells a wrong answer apart from no answer
  assert.match(online, /rr\.correct\?'✅ صحيح':rr\.choice!=null\?'❌ خطأ':'⌛ ما جاوب'/);
  assert.doesNotMatch(online, /لم يسجل/);
  // memory questions come up online too: the page has its own renderer, timed by the server clock
  assert.match(online, /function mountMemoryChallenge\(memory,area,opts=\{\}\)\{/);
  assert.match(online, /const guard=mediaVersion,end=opts\.endAt\|\|serverNow\(\)\+memoryPreviewMs\(mem\)/);
  const hub = await read('public/quiz.html');
  assert.doesNotMatch(hub, /بازر/);
});
