// 33.9.10: carrom online (a BoardRoom table of two that plays every shot to its end), the slingshot hands,
// and the shop's frames, carrom strikers and billiards cues.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as E from '../public/assets/js/carrom/engine.js';
import { TABLE_GAMES, MAX_SEATS, startTable, playerMove, seatProgress } from '../src/games/board-tables.js';
import { gameOfCode, roomCodeFor } from '../src/rooms/room-codes.js';

const read = (file) => readFile(new URL('../' + file, import.meta.url), 'utf8');

test('carrom duel: a shot is played to its end on the room and replays the same from its record', () => {
  let s = E.createCarromDuel(['أ', 'ب'], { rng: () => 0.3, first: 0 });
  for (let n = 0; n < 12 && s.winner === null; n++) {
    const next = E.playCarromShot(s, s.turn, E.chooseCarromShot(structuredClone(s), 'hard'));
    const replay = E.replayCarromShot(next.shotRec); let k = 0;
    while (replay.phase === 'moving' && k < 2000) { E.stepCarrom(replay, E.FIXED_DT); k++; }
    assert.deepEqual(replay.coins.map((c) => [c.x, c.y, c.pocketed]), next.coins.map((c) => [c.x, c.y, c.pocketed]));
    assert.equal(next.seq, (s.seq || 0) + 1); assert.ok(next.last.ms > 0);
    s = next;
  }
  assert.throws(() => E.playCarromShot(s, 1 - s.turn, { x: 500, angle: 1, power: 0.5 }), /wrong_turn/);
  const t = E.carromTimeout(s); assert.equal(t.turn, 1 - s.turn); assert.equal(t.last.timeout, true);
});

test('carrom is a table of two with its own room codes, and a player\'s shot goes through the table', () => {
  assert.ok(TABLE_GAMES.includes('carrom')); assert.equal(MAX_SEATS.carrom, 2);
  const code = roomCodeFor('carrom'); assert.match(code, /^08\d{4}$/); assert.equal(gameOfCode(code), 'carrom');
  const room = { game: 'carrom', status: 'lobby', players: { p1: { id: 'p1', name: 'سعد' } }, order: ['p1'], version: 0 };
  startTable(room, { quick: true, rng: () => 0.2 });
  assert.equal(room.order.length, 2); assert.ok(Array.isArray(room.state.coins));
  const mine = room.order.indexOf('p1');
  if (room.state.turn === mine) {
    const steps = playerMove(room, mine, { type: 'carrom_shot', x: 500, angle: mine === 0 ? -Math.PI / 2 : Math.PI / 2, power: 0.6 }, () => 0.5);
    assert.ok(steps.list.length >= 1); assert.ok(steps.list[0].state.shotRec);
  }
  assert.equal(typeof seatProgress(room, 0), 'number');
});

test('carrom page: online menu, the rail and the slingshot, the club sheet', async () => {
  const [html, main, css, index] = await Promise.all(['public/race.html', 'public/assets/js/carrom/main.js', 'public/assets/css/carrom-club-v33-9-10.css', 'src/index.js'].map(read));
  assert.match(html, /id="gameMenu"/); assert.match(html, /data-mode="online"/); assert.match(html, /id="cmSlider"/);
  assert.match(main, /createTable\(\{/); assert.match(main, /carrom_shot/); assert.match(main, /replayCarromShot\(s\.shotRec\)/);
  assert.match(css, /body\.cm-club \.cm-slider/);
  assert.match(index, /'carrom_shot'/); assert.match(index, /relayCarromAim/);
});

test('shop: frames, strikers and cues are sold and equipped; the identity colours left the shelves', async () => {
  const sandbox = { window: {} }; sandbox.window = sandbox; vm.runInNewContext(await read('public/assets/js/profile-core.js'), sandbox);
  const C = sandbox.BS_CAREER_CORE;
  for (const slot of ['frame', 'striker', 'cue']) assert.ok(C.SLOTS.includes(slot), slot);
  const p = C.normalize({ coins: 1000 });
  assert.equal(p.equipped.frame, 'frame-none'); assert.equal(p.equipped.cue, 'cue-classic'); assert.equal(p.equipped.striker, 'striker-classic');
  const q = C.equip(C.purchase(p, 'striker-gold', { expectedPrice: 420 }), 'striker-gold');
  assert.equal(q.equipped.striker, 'striker-gold'); assert.equal(q.coins, 580);
  assert.ok(!C.STOREFRONT.some((id) => id.startsWith('stage-')));
  assert.ok(C.STOREFRONT.includes('frame-flame') && C.STOREFRONT.includes('cue-dragon'));
  const [looks, render, billiards, pro] = await Promise.all(['public/assets/js/looks-v33-9-10.js', 'public/assets/js/carrom/render.js', 'public/assets/js/billiards/main.js', 'public/assets/js/profile-pro-v33-9-4.js'].map(read));
  assert.match(looks, /function drawStriker\(/); assert.match(looks, /function drawCue\(/);
  assert.match(render, /window\.BS_LOOKS\.striker\(\)/); assert.match(billiards, /window\.BS_LOOKS\?\.cue\?\.\(\)\.look/);
  assert.match(pro, /function frameClass\(\)/);
});
