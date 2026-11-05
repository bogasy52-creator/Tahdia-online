import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createGame, step, W, L, GOAL_W, PUCK_R, STRIKER_R, DIFFICULTY } from '../public/assets/js/hockey/core.js';
import { THEMES, PUCKS, STRIKER_COLORS } from '../public/assets/js/hockey/render.js';

const read = (p) => readFile(new URL('../public/' + p, import.meta.url), 'utf8');
const run = (g, seconds, controls = {}) => { for (let t = 0; t < seconds && g.phase !== 'over'; t += 1 / 60) step(g, 1 / 60, typeof controls === 'function' ? controls(g) : controls); return g; };
const play = (g) => { g.phase = 'play'; g.phaseT = 0; };

test('the puck bounces off the side walls and keeps most of its speed', () => {
  const g = createGame({ mode: 'two' }); play(g);
  Object.assign(g.puck, { x: 100, y: L / 2, vx: -900, vy: 0 });
  run(g, 0.3);
  assert.ok(g.puck.vx > 400, 'it came back');
  assert.ok(g.puck.x >= PUCK_R);
});

test('a striker drives the puck away and the strike is reported once', () => {
  const g = createGame({ mode: 'two' }); play(g);
  const s = g.strikers[0];
  Object.assign(s, { x: 300, y: L - 150, tx: 300, ty: L - 360 });
  Object.assign(g.puck, { x: 300, y: L - 300, vx: 0, vy: 0 });
  let hit = 0;
  for (let i = 0; i < 12; i++) { step(g, 1 / 60, {}); hit += g.events.filter((e) => e.type === 'hit').length; }
  assert.equal(hit, 1);
  assert.ok(g.puck.vy < -300, 'the puck is heading up the table');
});

test('a puck into the opening scores for the other side, then the next serve belongs to the one who conceded', () => {
  const g = createGame({ mode: 'two' }); play(g);
  Object.assign(g.puck, { x: W / 2, y: 140, vx: 0, vy: -1300 });
  run(g, 0.6);
  assert.deepEqual(g.score, [1, 0]);
  assert.equal(g.phase, 'goal');
  run(g, 2.1);
  assert.equal(g.phase, 'serve');
  assert.ok(g.puck.y < L / 2, 'the conceding side (top) serves from its half');
  assert.equal(g.puck.vx + g.puck.vy, 0);
});

test('a puck at the wall beside the opening bounces, it does not score', () => {
  const g = createGame({ mode: 'two' }); play(g);
  const edge = (W - GOAL_W) / 2 - 60;
  Object.assign(g.puck, { x: edge, y: 120, vx: 0, vy: -1300 });
  run(g, 0.8);
  assert.deepEqual(g.score, [0, 0]);
});

test('the first to the target wins and the game ends', () => {
  const g = createGame({ mode: 'two', target: 2 });
  for (let k = 0; k < 2; k++) { play(g); Object.assign(g.puck, { x: W / 2, y: L - 140, vx: 0, vy: 1300 }); run(g, 2.6); }
  assert.equal(g.phase, 'over'); assert.equal(g.winner, 1);
});

test('strikers stay in their own half', () => {
  const g = createGame({ mode: 'two' }); play(g);
  run(g, 1, { p0: { x: 10, y: 5 }, p1: { x: 590, y: L - 5 } });
  assert.ok(g.strikers[0].y > L / 2 && g.strikers[1].y < L / 2);
  assert.ok(g.strikers[0].x >= STRIKER_R - 0.5 && g.strikers[1].x <= W - STRIKER_R + 0.5);
});

test('the computer gets stronger with each level and every match can be finished', () => {
  const score = (level) => { let ai = 0, who = 0; for (let seed = 1; seed <= 4; seed++) { const g = createGame({ mode: 'ai', difficulty: 'mid', seed, target: 3 }); g.bot[0] = 'mid'; g.bot[1] = level; let t = 0; while (g.phase !== 'over' && t < 400) { step(g, 1 / 60, {}); t += 1 / 60; } ai += g.score[1]; who += g.score[0]; } return ai - who; };
  const easy = score('easy'), hard = score('hard');
  assert.ok(hard > easy, `hard (${hard}) beats mid by more than easy does (${easy})`);
  assert.deepEqual(Object.keys(DIFFICULTY), ['easy', 'mid', 'hard']);
});

test('the same seed plays the same game', () => {
  const a = run(createGame({ mode: 'ai', seed: 7 }), 20), b = run(createGame({ mode: 'ai', seed: 7 }), 20);
  assert.deepEqual([a.puck.x, a.puck.y, a.score], [b.puck.x, b.puck.y, b.score]);
});

test('three tables, four pucks and six striker colours are on offer', () => {
  assert.equal(Object.keys(THEMES).length, 3); assert.equal(PUCKS.length, 4); assert.equal(STRIKER_COLORS.length, 6);
});

test('the page works in a portrait and a landscape phone and is on the home screen', async () => {
  const page = await read('hockey.html'), home = await read('index.html'), css = await read('assets/css/app-hockey.css'), main = await read('assets/js/hockey/main.js');
  assert.match(page, /viewport-fit=cover/); assert.match(page, /assets\/js\/hockey\/main\.js\?v=33\.7\.0/);
  for (const id of ['table', 'conf', 'menu', 'startBtn', 'pauseBtn', 'fsBtn', 'result', 'banner', 'targetTxt']) assert.equal((page.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1, id);
  assert.match(css, /safe-area-inset-top/); assert.match(css, /orientation:\s*landscape/);
  assert.match(main, /orientationchange/); assert.match(main, /setPointerCapture/);
  assert.match(home, /href="\/hockey" class="home-game"/);
  await read('assets/brand/air-hockey-cover-v33-7.svg');
});
