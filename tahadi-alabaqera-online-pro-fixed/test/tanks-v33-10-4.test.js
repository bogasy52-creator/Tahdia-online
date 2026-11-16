// 33.10.4: معركة الدبابات with a longer life, a safe start, the homing missile, kill streaks, levels for the
// computer, and a screen that shows the fight (bars, a map that moves away, the story of the battle).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { TANKS, WEAPONS, createTankBattle, stepTankBattle, setTankInput } from '../public/assets/js/tanks/core.js';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');
const battle = (o) => { const g = createTankBattle(o); g.phase = 'battle'; g.roundTime = TANKS.SAFE + .4; g.walls = []; g.pickupAt = 1e9; return g; };
const run = (g, sec) => { for (let i = 0; i < Math.ceil(sec * 60); i++) stepTankBattle(g, 1 / 60); return g; };

test('a tank lives longer: 170, a bigger repair, a deeper shield', () => {
  assert.equal(TANKS.HP, 170);
  const g = battle(), p = g.players[0];
  assert.equal(p.hp, 170);
  p.hp = 40; g.pickups = [{ x: p.x, y: p.y, kind: 'repair' }]; run(g, 1 / 60); assert.equal(p.hp, 95);
  g.pickups = [{ x: p.x, y: p.y, kind: 'shield' }, { x: p.x, y: p.y, kind: 'shield' }]; run(g, 1 / 60); assert.equal(p.shield, TANKS.SHIELD);
  assert.ok(Math.ceil(TANKS.HP / WEAPONS.shell.damage) >= 5, 'five shells, not three');
});

test('the first moments of a round are safe', () => {
  const g = createTankBattle(); g.phase = 'battle'; g.roundTime = .2; g.walls = [];
  Object.assign(g.players[0], { x: 150, y: 300 }); Object.assign(g.players[1], { x: 360, y: 300 });
  setTankInput(g, 0, { mx: 0, my: 0, aim: 0, fire: true });
  for (let i = 0; i < 40; i++) stepTankBattle(g, 1 / 60);
  assert.ok(g.roundTime < TANKS.SAFE); assert.equal(g.players[1].hp, TANKS.HP);
});

test('the homing missile turns onto a tank it was not fired at', () => {
  const g = battle();
  Object.assign(g.players[0], { x: 150, y: 300, weapon: 'homing', weaponUntil: g.time + 30 });
  Object.assign(g.players[1], { x: 470, y: 470 });
  setTankInput(g, 0, { mx: 0, my: 0, aim: 0, fire: true }); run(g, .05); setTankInput(g, 0, { mx: 0, my: 0, aim: 0, fire: false });
  run(g, 1.6);
  assert.ok(g.events.some((e) => e.type === 'hit' && e.seat === 1 && e.damage === WEAPONS.homing.damage), 'it found the tank off its line');
  assert.ok(createTankBattle().players.length && /'homing'\]\[Math\.floor\(rnd\(g\)\*7\)\]/.test(String(stepTankBattle)), 'it lies on the field as a pickup');
});

test('a kill says first blood, two in a row and the streak', () => {
  const g = battle({ names: ['أ', 'ب', 'ج', 'د'] });
  const [a, b, c] = g.players;
  Object.assign(a, { x: 150, y: 300 }); Object.assign(b, { x: 360, y: 300, hp: 1 }); Object.assign(c, { x: 150, y: 600, hp: 1 }); Object.assign(g.players[3], { x: 1100, y: 1300 });
  setTankInput(g, 0, { mx: 0, my: 0, aim: 0, fire: true }); run(g, .7);
  const first = g.events.find((e) => e.type === 'kill' && e.seat === 1);
  assert.equal(first.owner, 0); assert.equal(first.first, true); assert.equal(first.streak, 1);
  setTankInput(g, 0, { mx: 0, my: 0, aim: Math.PI / 2, fire: true }); run(g, .7);
  const second = g.events.find((e) => e.type === 'kill' && e.seat === 2);
  assert.equal(second.first, false); assert.equal(second.streak, 2); assert.equal(second.multi, 2, 'two kills inside a few seconds');
});

test('the computer has a level: the hard one fires more than the easy one', () => {
  const shots = (level) => { const g = createTankBattle({ names: ['A', 'B'], bots: [true, true], seed: 9, level }); run(g, 30); return g.players.reduce((n, p) => n + p.shots, 0); };
  assert.equal(createTankBattle({ level: 5 }).level, 1);
  assert.ok(shots(2) > shots(0), 'hard ' + shots(2) + ' vs easy ' + shots(0));
});

test('the screen shows the fight: long bars, a map that moves away, arrows, the story, sticks under the thumb', async () => {
  const scene = await read('public/assets/js/tanks/scene.js');
  assert.match(scene, /a real health bar over every tank/);
  assert.match(scene, /right=selfQ\.x<w\/2/, 'the map goes to the corner away from your tank');
  assert.match(scene, /an enemy off the screen shows as an arrow/);
  assert.doesNotMatch(scene, /خريطة المعركة/, 'no caption under the map');
  const main = await read('public/assets/js/tanks/main.js');
  assert.match(main, /const aimPulled=\(\)=>Boolean\(aimStick&&Math\.hypot\(aimStick\.x,aimStick\.y\)>\.38\)/, 'a touch to aim does not fire');
  assert.match(main, /function lockOn\(\)/); assert.match(main, /aim=assist\(Math\.atan2\(v\.y,v\.x\)\)/);
  assert.match(main, /أول دم! 🩸/); assert.match(main, /ثنتين ورا بعض!/);
  assert.match(main, /level:Number\(\$\('tkPracticeLevel'\)\?\.value\?\?1\)/);
  const page = await read('public/tanks.html');
  for (const id of ['tkFeed', 'tkCallout', 'tkLife', 'tkPracticeLevel']) assert.match(page, new RegExp('id="' + id + '"'), id);
  const css = await read('public/assets/css/tanks-v33-10-4.css');
  assert.match(css, /\.tanks-page \.tk-dock\{background:none!important/, 'sideways, the dock no longer covers the arena');
  const bundles = JSON.parse(await read('scripts/style-bundles.json'));
  assert.equal(bundles['tanks.html'].at(-1), 'assets/css/tanks-v33-10-4.css');
});
