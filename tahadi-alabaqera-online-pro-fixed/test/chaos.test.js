// 33.6.0: «سباق الفوضى» — a deterministic three-lane race shared by practice, the rooms and every
// screen, with walls, timed gates, mud, springs, chaos waves, powers and computer runners.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { CHALLENGES, createChallenge, applyChallenge, advanceChallenge, challengeView, botAction, nextChallengeAlarm, adjacent, edge, raceSim, raceTrack, raceItems, raceOrder, raceWave, gateOpen, shiftRace, raceUsePower, raceChangeLane, RACE_ROWS, RACE_LANES, RACE_DT, RACE_COUNTDOWN, RACE_GRACE, CHAOS_EVERY, CHAOS_WARN, CHAOS_ZONES } from '../public/assets/js/engines/challenge-core.js';
import { createRace, raceResult } from '../public/assets/js/engines/chaos-core.js';
import { roomCodeFor, gameOfCode } from '../src/rooms/room-codes.js';
import { LINKED_GAMES } from '../src/party/party-link.js';
import { PARTY_GAMES } from '../public/assets/js/engines/party-catalog-v29.js';
import { createDOM } from './dom-harness.mjs';

const start = 1000;
const runners = (humans = 1, bots = 3) => [...Array.from({ length: humans }, (_, i) => ({ id: 'h' + i, name: 'لاعب ' + i })), ...Array.from({ length: bots }, (_, i) => ({ id: 'b' + i, name: 'آلي ' + i, bot: true }))];
const race = (seed = 7, humans = 1, bots = 3) => createChallenge('chaos', runners(humans, bots), seed, start);
const go = (m) => m.race.startAt + RACE_DT;
// an empty track keeps a test about one rule free of everything else on the way
function clearTrack(m) { const t = raceTrack(m.race.seed); t.fixed.clear(); for (const z of t.chaos) for (const w of z.waves) w.clear(); }
function place(m, row, lane, kind, extra = {}) { const t = raceTrack(m.race.seed); if (!t.fixed.has(row)) t.fixed.set(row, []); t.fixed.get(row).push({ row, lane, kind, ...extra }); }
const fresh = (seed) => { const m = race(seed, 1, 0 + 1); clearTrack(m); return m; };

test('a track: every row leaves a lane open, chaos waves differ, and the same seed deals the same track', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const t = raceTrack(seed * 977), m = { race: createRace([{}, {}], seed * 977, 0) };
    for (let row = 1; row < RACE_ROWS; row++) for (const wave of [0, 3, 7]) {
      const shut = raceItems(t, m.race, row, m.race.startAt + wave * CHAOS_EVERY).filter((x) => ['wall', 'gate', 'spring'].includes(x.kind)).map((x) => x.lane);
      assert.ok(new Set(shut).size < RACE_LANES, 'row ' + row + ' keeps a lane open');
    }
    assert.ok([...t.fixed.keys()].every((row) => row >= 10 && row < RACE_ROWS - 4), 'the start and the finish are clear');
    const zone = t.chaos[0], a = JSON.stringify([...zone.waves[0]]), b = JSON.stringify([...zone.waves[1]]);
    assert.notEqual(a, b, 'a wave of chaos re-deals its zone');
  }
  assert.equal(raceTrack(1234), raceTrack(1234));
  assert.equal(CHAOS_ZONES.length, 4);
});

test('the race starts after the countdown; everyone runs on their own', () => {
  const m = race(3, 1, 1);
  assert.equal(m.race.runners.length, 2);
  advanceChallenge(m, m.race.startAt - 1);
  assert.ok(m.race.runners.every((R) => R.pos === 0));
  assert.throws(() => applyChallenge(m, 'h0', { type: 'lane', lane: 1 }, m.race.startAt - 500), /إشارة الانطلاق/);
  advanceChallenge(m, m.race.startAt + 2000);
  assert.ok(m.race.runners.every((R) => R.pos > 5 && R.pos < 8), 'about 3.4 rows a second');
  assert.equal(nextChallengeAlarm(m, m.race.startAt + 2000), m.race.startAt + 4000, 'the room looks in every two seconds');
  assert.equal(nextChallengeAlarm(race(3), start), start + RACE_COUNTDOWN, 'and wakes for the start');
  assert.equal(botAction(m, 'b0', m.race.startAt + 2000), null, 'the race steers its computer runners itself');
});

test('lanes: one step at a time, inside the track, with a short cooldown', () => {
  const m = fresh(11), t = go(m), R = m.race.runners[0];
  advanceChallenge(m, t);
  applyChallenge(m, 'h0', { type: 'lane', lane: 1 }, t);
  assert.equal(R.lane === 1 || m.race.runners[0].lane === 1, true);
  assert.throws(() => applyChallenge(m, 'h0', { type: 'lane', lane: 2 }, t + 20), /المسار/);
  applyChallenge(m, 'h0', { type: 'lane', lane: 2 }, t + 100);
  for (const lane of [0, 3, -1, 1.5, '1']) assert.throws(() => applyChallenge(m, 'h0', { type: 'lane', lane }, t + 400));
  assert.throws(() => applyChallenge(m, 'h0', { type: 'jump' }, t + 500), /حركة غير صالحة/);
});

test('a wall stops you once, a closed gate holds you, mud slows you, a spring throws you back once', () => {
  // at 3.4 rows a second the runner reaches row 12 in the step that starts 3.5 seconds after the start
  const run = (kind, extra = {}) => { const m = fresh(21); const R = m.race.runners[0]; R.lane = 0; place(m, 12, 0, kind, extra); advanceChallenge(m, m.race.startAt + 4000); return { m, R }; };
  const wall = run('wall');
  assert.ok(wall.R.hits === 1 && wall.R.pos < 12 && wall.R.stun > wall.m.race.startAt + 4000, 'stopped at the wall');
  advanceChallenge(wall.m, wall.m.race.startAt + 7000);
  assert.ok(wall.R.pos > 13 && wall.R.hits === 1, 'and through it once the shock passes');
  // reached at +3.5 s: with phase 300 the gate is shut from +3.5 s until +4.5 s
  const gate = run('gate', { phase: 300 });
  assert.ok(gate.R.wait && gate.R.pos < 12, 'waiting at the closed gate');
  advanceChallenge(gate.m, gate.m.race.startAt + 9000);
  assert.ok(gate.R.pos > 12 && !gate.R.wait, 'the gate opens and the run goes on');
  const open = run('gate', { phase: 0 });
  assert.ok(open.R.pos > 12 && !open.R.wait, 'an open gate lets you through');
  const mud = run('mud');
  assert.ok(mud.R.slow > mud.m.race.startAt + 4000 && mud.R.hits === 1 && mud.R.pos > 12);
  const spring = run('spring');
  assert.ok(spring.R.hits === 1 && spring.R.pos < 9, 'thrown back five rows');
  advanceChallenge(spring.m, spring.m.race.startAt + 12000);
  assert.equal(spring.R.hits, 1, 'the second time over the spring you pass');
  assert.ok(spring.R.pos > 13);
});

test('powers: a box gives one, the leader gets guards and the last one the comeback powers', () => {
  const m = fresh(31), R = m.race.runners[0]; R.lane = 2; place(m, 12, 2, 'box');
  advanceChallenge(m, m.race.startAt + 4000);
  assert.ok(R.power && ['boost', 'shield', 'sticky', 'rocket', 'storm'].includes(R.power));
  // a pack of four: whoever trails draws rockets and storms, the leader never does
  const drawn = { lead: new Set(), last: new Set() };
  for (let seed = 1; seed < 200; seed++) {
    const p = createChallenge('chaos', runners(4, 0), seed, start); clearTrack(p);
    p.race.runners.forEach((Q, i) => { Q.pos = 100 - i * 20; Q.lane = 0; });
    place(p, 101, 0, 'box'); place(p, 41, 0, 'box');
    raceSim(p.race, [false, false, false, false], p.race.startAt + 600);
    if (p.race.runners[0].power) drawn.lead.add(p.race.runners[0].power);
    if (p.race.runners[3].power) drawn.last.add(p.race.runners[3].power);
  }
  assert.ok(!drawn.lead.has('rocket') && !drawn.lead.has('storm'), [...drawn.lead].join());
  assert.ok(drawn.last.has('rocket') && drawn.last.has('storm'), [...drawn.last].join());
});

test('each power does what it says', () => {
  // two people on an empty track: a computer runner would steer around the trap
  const at = (power, setup = () => {}) => { const m = race(41, 2, 0); clearTrack(m); const t = m.race.startAt + 1000; advanceChallenge(m, t); m.race.runners[0].power = power; setup(m); applyChallenge(m, 'h0', { type: 'power' }, t); return { m, t, R: m.race.runners[0], O: m.race.runners[1] }; };
  let x = at('boost'); assert.ok(x.R.boost > x.t);
  x = at('shield'); assert.ok(x.R.shield > x.t); place(x.m, 12, x.R.lane, 'wall'); advanceChallenge(x.m, x.t + 3000); assert.equal(x.R.hits, 0, 'the shield takes the wall'); assert.equal(x.R.shield, 0);
  x = at('rocket'); assert.ok(x.R.pos >= 10 && x.R.rocket > x.t);
  x = at('sticky', (m) => { m.race.runners[0].pos = 30; m.race.runners[0].lane = 1; m.race.runners[1].pos = 25; m.race.runners[1].lane = 1; });
  assert.equal(x.m.race.dropped.length, 1); assert.equal(x.m.race.dropped[0].row, 29);
  advanceChallenge(x.m, x.t + 3000); assert.ok(x.O.slow > x.t, 'the one behind sticks'); assert.equal(x.R.hits, 0, 'never the one who dropped it');
  x = at('storm', (m) => { m.race.runners[1].pos = 20; }); assert.ok(x.O.slow > x.t, 'the storm slows whoever is ahead');
  assert.throws(() => applyChallenge(x.m, 'h0', { type: 'power' }, x.t + 100), /قدرة/);
});

test('the race ends 25 seconds after the first runner finishes, or when everyone is in', () => {
  const m = race(5, 2, 2);
  m.race.runners[0].pos = RACE_ROWS - .5; m.race.runners[0].lane = 0;
  advanceChallenge(m, m.race.startAt + 500);
  const first = m.race.runners[0];
  assert.equal(first.place, 1); assert.equal(m.race.endsAt, first.done + RACE_GRACE);
  assert.equal(m.phase, 'playing');
  advanceChallenge(m, first.done + RACE_GRACE + RACE_DT);
  assert.equal(m.phase, 'finished');
  assert.deepEqual(m.winners, ['h0']);
  assert.equal(m.players[0].score, 40, 'points by place for the standings');
  assert.throws(() => applyChallenge(m, 'h1', { type: 'lane', lane: 1 }, first.done + RACE_GRACE + 500), /الجولة انتهت/);
});

test('computer runners steer, use powers and finish the race in about a minute', () => {
  const times = [], hits = [];
  for (let seed = 1; seed <= 12; seed++) {
    const m = race(seed * 131, 0, 4);
    let t = start; while (m.phase === 'playing' && t < start + 200000) { t += 250; advanceChallenge(m, t); }
    assert.equal(m.phase, 'finished');
    for (const R of m.race.runners) { if (R.done !== null) times.push((R.done - m.race.startAt) / 1000); hits.push(R.hits); }
  }
  times.sort((a, b) => a - b); hits.sort((a, b) => a - b);
  const median = (a) => a[Math.floor(a.length / 2)];
  assert.ok(median(times) > 50 && median(times) < 75, 'median finish ' + median(times));
  assert.ok(median(hits) >= 1 && median(hits) <= 8, 'they hit things too: ' + median(hits));
});

test('every screen carries the race forward exactly as the room does', () => {
  const m = race(77, 1, 3);
  advanceChallenge(m, m.race.startAt + 4000);
  applyChallenge(m, 'h0', { type: 'lane', lane: 1 }, m.race.startAt + 4050);
  const view = challengeView(m, 'h0', m.race.startAt + 4100), copy = structuredClone(view.race);
  const later = m.race.startAt + 30000;
  advanceChallenge(m, later);
  raceSim(copy, view.players.map((p) => p.bot), later);
  assert.deepEqual(copy.runners.map((R) => [R.pos, R.lane, R.hits, R.power]), m.race.runners.map((R) => [R.pos, R.lane, R.hits, R.power]));
  assert.ok(JSON.stringify(view).length < 8000, 'a snapshot stays small');
});

test('the practice pause moves every clock of the race', () => {
  const m = race(9), before = structuredClone(m.race);
  shiftRace(m.race, 5000);
  for (const key of ['t0', 'startAt', 'endsAt', 'simAt']) assert.equal(m.race[key], before[key] + 5000);
});

test('the race has its own code family, room, party seat and catalog card', async () => {
  for (let i = 0; i < 20; i++) { const code = roomCodeFor('chaos'); assert.match(code, /^98\d{4}$/); assert.equal(gameOfCode(code), 'chaos'); }
  assert.equal(CHALLENGES.chaos.title, 'سباق الفوضى'); assert.equal(CHALLENGES.chaos.players, 20);
  assert.deepEqual(LINKED_GAMES.chaos, { page: '/chaos', min: 1, max: 20 });
  assert.ok(PARTY_GAMES.some((g) => g.id === 'chaos'));
  const read = (p) => readFile(new URL('../' + p, import.meta.url), 'utf8');
  const room = await read('src/challenges/challenge-room.js');
  assert.match(room, /const active=game=>\['focus','cipher','wordbomb','chaos'\]\.includes\(game\);/);
  assert.match(room, /least=r\.game==='chaos'\?4:2/);
  const worker = await read('src/index.js');
  assert.equal((worker.match(/'focus','cipher','wordbomb','chaos'/g) || []).length, 2);
  const page = await read('public/chaos.html');
  assert.match(page, /data-challenge="chaos"/); assert.match(page, /chaos-ui\.js\?v=/); assert.match(page, /app-chaos\.css\?v=/);
  assert.match(await read('public/index.html'), /<a href="\/chaos" class="home-game"/);
  const bundles = JSON.parse(await read('scripts/style-bundles.json'));
  assert.ok(bundles['chaos.html'].includes('assets/css/chaos-v33-6.css'));
});

async function client() {
  const h = await createDOM('chaos.html', { WebSocket: class { static OPEN = 1; } });
  Object.assign(h.context, { CHALLENGES, createChallenge, applyChallenge, advanceChallenge, challengeView, adjacent, edge, raceSim, raceTrack, raceItems, raceOrder, raceWave, gateOpen, shiftRace, raceUsePower, raceChangeLane, RACE_ROWS, RACE_LANES, CHAOS_EVERY, CHAOS_WARN, CHAOS_ZONES });
  h.context.document.body.dataset.challenge = 'chaos';
  await h.runFile('assets/js/chaos-ui.js'); await h.runFile('assets/js/challenge-studio.js'); await h.runFile('assets/js/challenge-client.js');
  return { ...h, $: (id) => h.doc.getElementById(id), probe: (s) => vm.runInContext(s, h.context) };
}
test('the race page: practice with three computer runners, the keys move you a lane', async () => {
  const h = await client();
  h.$('chPractice').click();
  assert.equal(h.$('chPlay').hidden, false);
  assert.equal(h.probe('local.players.length'), 4);
  assert.deepEqual(Array.from(h.probe('local.players.map(p=>p.bot)')), [false, true, true, true]);
  assert.ok(h.$('chBoard').querySelector('.ch-race-canvas'));
  const keys = h.$('chControls').querySelectorAll('.ch-race-key');
  assert.equal(keys.length, 2);
  h.probe('Date.now=(n=>()=>n)(local.race.startAt+500);tick()');
  const lane = h.probe('local.race.runners[0].lane');
  h.$('chControls').querySelector('.ch-race-right').click();
  assert.equal(h.probe('local.race.runners[0].lane'), lane + 1);
  assert.match(h.$('chControls').querySelector('.ch-race-power').textContent, /ما عندك قدرة/);
});
