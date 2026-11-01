// 33.2.0: the weekly Baloot cup (points from server-run Baloot matches, top three
// claim coins once) and the day's game missions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { environment, api, signup } from './worker-harness.mjs';
import { LeaderboardStore, LEADERBOARD_OBJECT, CUP_POINTS, CUP_PRIZES, riyadhWeekKey } from '../src/leaderboard/leaderboard.js';
import { Career } from '../src/career/core.js';

const DAY = 86_400_000;
function store() {
  const values = new Map();
  const storage = {
    async get(k) { return structuredClone(values.get(k)); },
    async put(k, v) { if (k && typeof k === 'object') for (const [a, b] of Object.entries(k)) values.set(a, structuredClone(b)); else values.set(k, structuredClone(v)); },
    async delete(k) { for (const key of [].concat(k)) values.delete(key); },
    async list({ prefix = '' } = {}) { return new Map([...values].filter(([k]) => k.startsWith(prefix))); },
  };
  return { s: new LeaderboardStore({ storage, blockConcurrencyWhile: (fn) => fn() }), values };
}
const result = (username, win, receipt, at, game = 'baloot') => ({ username, name: username.toUpperCase(), win, receipt, at, game });

test('Baloot matches fill the week cup: 3 for a win, 1 for a match; other games and repeats do not count', async () => {
  const { s } = store(), now = Date.parse('2026-11-04T12:00:00Z');
  await s.record(result('saad', true, 'm1', now - 3600e3), now);
  await s.record(result('saad', false, 'm2', now - 3000e3), now);
  await s.record(result('saad', false, 'm2', now - 3000e3), now); // the room retried
  await s.record(result('majed', true, 'm1', now - 3600e3), now);
  await s.record(result('majed', true, 'm3', now - 2000e3), now);
  await s.record(result('turki', true, 's1', now - 2000e3, 'snakes'), now); // not Baloot
  const cup = await s.cup('saad', now);
  assert.deepEqual(cup.points, CUP_POINTS);
  assert.deepEqual(cup.players.map((p) => [p.username, p.points, p.wins, p.games]), [['majed', 6, 2, 2], ['saad', 4, 1, 2]]);
  assert.deepEqual([cup.me.rank, cup.me.points], [2, 4]);
  assert.equal(cup.key, riyadhWeekKey(now));
  assert.ok(cup.endsAt > now && cup.endsAt - cup.startsAt === 7 * DAY);
  assert.equal(cup.prize, null, 'nothing to claim while the week runs');
  // the weekly ladder still gets every verified game
  const week = await s.top('week', 'turki', now);
  assert.ok(week.players.some((p) => p.username === 'turki'));
});

test('a finished week names its champions; the top three claim their coins once, for two weeks', async () => {
  const { s } = store(), lastWeek = Date.parse('2026-10-28T12:00:00Z'), now = Date.parse('2026-11-04T12:00:00Z');
  const names = ['a_one', 'b_two', 'c_three', 'd_four'];
  for (const [i, name] of names.entries()) for (let k = 0; k < 4 - i; k++) await s.record(result(name, true, name + k, lastWeek + k), lastWeek + 10);
  const cup = await s.cup('c_three', now);
  assert.deepEqual(cup.champions.players.map((p) => [p.username, p.rank, p.coins]), [['a_one', 1, CUP_PRIZES[0]], ['b_two', 2, CUP_PRIZES[1]], ['c_three', 3, CUP_PRIZES[2]]]);
  assert.deepEqual(cup.prize, { week: riyadhWeekKey(lastWeek), rank: 3, coins: CUP_PRIZES[2] });
  assert.equal(await s.cupPrize('d_four', now), null, 'fourth place wins nothing');
  // still claimable the week after, gone the week after that
  assert.ok(await s.cupPrize('a_one', now + 7 * DAY));
  assert.equal(await s.cupPrize('a_one', now + 14 * DAY), null);
});

test('the day has a Baloot mission and one more game; both pay coins once', () => {
  const now = Date.parse('2026-11-02T12:00:00Z'), day = Career.riyadhDay(now);
  const [baloot, other] = Career.gameMissionsFor(day);
  assert.equal(baloot.game, 'baloot');
  assert.notEqual(other.game, 'baloot');
  let p = Career.normalize({});
  for (let i = 0; i < 3; i++) p = Career.reward(p, { id: 'b' + i, game: 'baloot', win: i === 0, verified: true, now });
  const row = Career.objectives(p, { now }).find((o) => o.id === baloot.id);
  assert.equal(row.ready, true);
  const coins = p.coins;
  p = Career.claimObjective(p, baloot.id, { now });
  assert.equal(p.coins - coins, baloot.coins);
  assert.equal(Career.objectives(p, { now }).find((o) => o.id === baloot.id).claimed, true);
  assert.throws(() => Career.claimObjective(p, other.id, { now }), /objective_incomplete/);
  // the next day starts again, with the other Baloot mission
  const next = Career.objectives(p, { now: now + DAY }).filter((o) => o.game);
  assert.equal(next.length, 2);
  assert.ok(next.every((o) => o.current === 0 && !o.claimed));
  assert.notEqual(next[0].id, baloot.id);
  // missions of other days cannot be claimed today
  const later = Career.gameMissionsFor(Career.riyadhDay(now + 3 * DAY)).find((o) => o.game !== 'baloot' && o.id !== other.id);
  if (later) assert.throws(() => Career.claimObjective(p, later.id, { now }), /objective_not_found/);
});

test('a prize is paid once per receipt and only with a prize receipt', () => {
  let p = Career.normalize({ coins: 100 });
  p = Career.grant(p, { id: 'prize:baloot-cup:2026-10-26', coins: 600 });
  assert.equal(p.coins, 700);
  p = Career.grant(p, { id: 'prize:baloot-cup:2026-10-26', coins: 600 });
  assert.equal(p.coins, 700);
  assert.throws(() => Career.grant(p, { id: 'board:x', coins: 5 }), /invalid_prize/);
});

test('the Worker shows the cup and pays a winner once; others get nothing', async () => {
  const env = environment();
  const winner = await signup(env, 'cupwinner'), other = await signup(env, 'cuplosing');
  const board = env.BOARD_ROOMS.get(LEADERBOARD_OBJECT), lastWeek = Date.now() - 7 * DAY;
  for (const [name, wins] of [['cupwinner', 3], ['cuplosing', 1]]) for (let k = 0; k < wins; k++) {
    const res = await board.fetch('https://leaderboard.internal/record', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: name, name, game: 'baloot', win: true, receipt: name + ':' + k, at: lastWeek + k }) });
    assert.equal(res.status, 200);
  }
  const view = await api(env, '/api/baloot/cup?player=cupwinner');
  assert.equal(view.response.status, 200);
  assert.equal(view.data.champions.players[0].username, 'cupwinner');
  assert.equal(view.data.prize.rank, 1);
  const anonymous = await api(env, '/api/baloot/cup/claim', {});
  assert.equal(anonymous.response.status, 401);
  const before = (await api(env, '/api/social/career', null, winner.data.token)).data.career.coins;
  const claim = await api(env, '/api/baloot/cup/claim', {}, winner.data.token);
  assert.equal(claim.response.status, 200, JSON.stringify(claim.data));
  assert.equal(claim.data.career.coins - before, CUP_PRIZES[0]);
  const again = await api(env, '/api/baloot/cup/claim', {}, winner.data.token);
  assert.equal(again.response.status, 404);
  assert.equal((await api(env, '/api/social/career', null, winner.data.token)).data.career.coins - before, CUP_PRIZES[0]);
  const second = await api(env, '/api/baloot/cup/claim', {}, other.data.token);
  assert.equal(second.response.status, 200, 'second place claims second prize');
  assert.equal(second.data.prize.coins, CUP_PRIZES[1]);
  // a client can never pay itself through the career API
  const forged = await api(env, '/api/social/career/prize', { id: 'prize:baloot-cup:x', coins: 99999 }, other.data.token);
  assert.equal(forged.response.status, 404);
});

test('the Baloot page carries the cup card, its script and styles; the missions links open the missions view', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');
  const page = await read('public/baloot.html'), table = await read('public/assets/js/baloot-table.js'), shop = await read('public/assets/js/shop-v31.js');
  assert.match(page, /<div id="gameMenu" class="bl-menu-v33"><\/div>\s*<section id="balootCup" class="bl-cup" aria-label="بطولة البلوت الأسبوعية" hidden><\/section>/);
  assert.match(page, /<p id="matchLine"><\/p><p id="matchCup" class="bl-end-cup" hidden><\/p>/);
  assert.match(page, /<script defer src="assets\/js\/baloot-cup\.js\?v=33\.\d+\.\d+"><\/script>/);
  assert.match(table, /window\.BS_BALOOT_CUP\?\.matchEnded\?\.\(won\)/);
  const bundles = JSON.parse(await read('scripts/style-bundles.json'));
  assert.ok(bundles['baloot.html'].includes('assets/css/baloot-cup-v33-2.css'));
  assert.match(await read('public/assets/css/app-baloot.css'), /\.bl-cup-prizes\{/);
  assert.match(shop, /else if\(initialView==='missions'\)view='rewards'/);
  assert.match(shop, /'مهمّة اليوم · '\+game\.name/);
  const home = await read('public/index.html');
  assert.match(home, /href="\/shop\?view=missions"/);
});
