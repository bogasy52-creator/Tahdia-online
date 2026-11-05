import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { TRACKS, buildTrack, minimapPoints, SEG_LEN } from '../public/assets/js/race/track.js';
import { createRace, step, useItem, standings, MAX_SPEED } from '../public/assets/js/race/sim.js';

const read = (p) => readFile(new URL('../public/' + p, import.meta.url), 'utf8');
const bot = (race) => {
  const p = race.player, seg = race.track.segs[Math.floor(p.z / SEG_LEN) % race.track.count];
  return { steer: Math.max(-1, Math.min(1, -p.x * 1.1 + seg.curve * 0.07)), gas: true, brake: false, drift: false };
};
const run = (race, seconds, input = bot) => { for (let t = 0; t < seconds && !race.done; t += 1 / 60) step(race, 1 / 60, typeof input === 'function' ? input(race) : input); return race; };

test('every track is a closed loop with a 30 to 50 second lap', () => {
  assert.equal(new Set(TRACKS.map((t) => t.id)).size, TRACKS.length);
  for (const def of TRACKS) {
    const tr = buildTrack(def);
    assert.equal(tr.segs.at(-1).p2.world.y, 0, def.id + ' ends at the starting height');
    assert.equal(tr.segs[0].p1.world.y, 0);
    const lap = tr.length / MAX_SPEED;
    assert.ok(lap > 30 && lap < 50, `${def.id} lap ${lap.toFixed(1)}s`);
    assert.ok(tr.segs.some((s) => s.scenery.some((o) => o.type === 'arch')), 'a finish arch');
    assert.ok(tr.segs.filter((s) => s.padX !== null).length >= 20, 'boost pads');
    assert.ok(tr.boxes.length >= 24, 'item boxes');
    const pts = minimapPoints(tr);
    assert.ok(pts.every(([x, y]) => x >= 0 && x <= 1 && y >= 0 && y <= 1), 'the mini-map fits its box');
  }
});

test('the race is deterministic for a given seed and the same input', () => {
  const tr = buildTrack(TRACKS[0]);
  const a = run(createRace({ track: tr, seed: 5 }), 30), b = run(createRace({ track: tr, seed: 5 }), 30);
  assert.deepEqual(a.karts.map((k) => [k.z, k.x, k.speed]), b.karts.map((k) => [k.z, k.x, k.speed]));
});

test('a countdown holds everyone on the line, then the race starts', () => {
  const race = createRace({ track: buildTrack(TRACKS[0]), seed: 1 });
  const seen = [];
  for (let t = 0; t < 2.9; t += 1 / 60) { step(race, 1 / 60, { steer: 0, gas: true }); for (const e of race.events) seen.push(e.type + (e.n || '')); }
  assert.equal(race.phase, 'countdown');
  assert.ok(race.karts.every((k) => k.speed === 0));
  for (let t = 0; t < 0.5; t += 1 / 60) { step(race, 1 / 60, { steer: 0, gas: true }); for (const e of race.events) seen.push(e.type + (e.n || '')); }
  assert.equal(race.phase, 'racing');
  assert.deepEqual(seen.filter((x) => x.startsWith('count') || x === 'go'), ['count3', 'count2', 'count1', 'go']);
});

test('every track can be raced to the end and the standings list all six', () => {
  for (const def of TRACKS) {
    const race = run(createRace({ track: buildTrack(def), difficulty: 'mid', seed: 3 }), 420);
    assert.ok(race.done, def.id + ' finishes');
    assert.ok(race.player.finished && race.player.lap >= race.laps);
    const rows = standings(race);
    assert.equal(rows.length, 6);
    assert.equal(new Set(rows.map((k) => k.id)).size, 6);
    assert.ok(rows[0].finished, 'the winner has crossed the line');
  }
});

test('an idle player loses to the field, a competent one does not come last', () => {
  const tr = buildTrack(TRACKS[0]);
  const idle = run(createRace({ track: tr, seed: 9 }), 90, { steer: 0, gas: false, brake: false, drift: false });
  assert.equal(idle.player.place, 6);
  const good = run(createRace({ track: tr, seed: 9 }), 90);
  assert.ok(good.player.place < 6);
});

test('drifting charges a mini-turbo that is released on letting go', () => {
  const race = createRace({ track: buildTrack(TRACKS[0]), seed: 2 });
  run(race, 5, { steer: 0, gas: true });
  race.player.speed = MAX_SPEED * 0.9;
  const events = [];
  for (let t = 0; t < 2.2; t += 1 / 60) { race.player.speed = MAX_SPEED * 0.9; step(race, 1 / 60, { steer: 1, gas: true, drift: true }); events.push(...race.events.map((e) => e.type)); }
  assert.ok(race.player.drift.on && race.player.drift.level >= 2, 'level ' + race.player.drift.level);
  step(race, 1 / 60, { steer: 1, gas: true, drift: false });
  assert.ok(race.events.some((e) => e.type === 'mini-turbo'));
  assert.ok(race.player.boost > 1);
});

test('items: turbo boosts, shield absorbs one hit, rocket and oil put hazards on the road', () => {
  const race = createRace({ track: buildTrack(TRACKS[1]), seed: 4 });
  run(race, 4, { steer: 0, gas: true });
  const p = race.player;
  p.item = 'turbo'; assert.ok(useItem(race, p)); assert.ok(p.boost >= 1.6 && p.item === null);
  p.item = 'shield'; useItem(race, p); assert.ok(p.shield > 5);
  race.projectiles.push({ z: p.z + 100, x: p.x, speed: 0, owner: 'ai0', target: null, life: 5 });
  step(race, 1 / 60, { steer: 0, gas: true });
  assert.equal(p.shield, 0, 'the shield popped');
  assert.equal(p.spin, 0, 'and nothing hit the driver');
  p.item = 'oil'; useItem(race, p); assert.equal(race.hazards.length, 1);
  p.item = 'rocket'; useItem(race, p); assert.equal(race.projectiles.length >= 1, true);
  const hz = race.hazards[0]; const other = race.karts.find((k) => !k.isPlayer);
  other.z = hz.z; other.x = hz.x; step(race, 1 / 60, { steer: 0, gas: true });
  assert.ok(other.spin > 0, 'a kart driving over oil spins');
});

test('the former racing entry now opens the Carrom table', async () => {
 const page=await read('race.html'),home=await read('index.html');
 assert.match(page,/assets\/js\/carrom\/main\.js\?v=/);
 assert.match(home,/href="\/carrom" class="home-game"/);
 assert.doesNotMatch(page,/TURBO KART/);
});
