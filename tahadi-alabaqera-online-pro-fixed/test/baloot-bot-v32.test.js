import test from 'node:test';
import assert from 'node:assert/strict';
import { createBalootMatch, applyBalootAction, balootActions, balootView } from '../public/assets/js/engines/baloot-engine.js';
import { chooseBalootAction } from '../public/assets/js/engines/baloot-bot.js';

function seeded(seed = 1) {
  return () => { seed |= 0; seed = seed + 0x6d2b79f5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

function playMatch(levels, seed) {
  const rng = seeded(seed);
  let s = createBalootMatch({ rng });
  let actions = 0;
  while (s.phase !== 'finished' && actions < 8000) {
    if (s.phase === 'scored') { s = applyBalootAction(s, null, { type: 'next' }, rng).state; continue; }
    const seat = s.turn;
    const level = levels[seat % 2];
    let action;
    if (level === 'random') {
      const all = balootActions(s);
      action = all[Math.floor(rng() * all.length)];
      if (s.phase !== 'playing' && rng() < 0.75) action = all.find((a) => a.bid === 'pass' || a.call === 'pass') || action;
    } else {
      const view = balootView(s, seat);
      action = chooseBalootAction(view, seat, { level, rng });
      const legal = balootActions(s).map((a) => JSON.stringify(a));
      assert.ok(legal.includes(JSON.stringify(action)), 'bot action is legal: ' + JSON.stringify(action));
    }
    s = applyBalootAction(s, seat, action, rng).state;
    actions++;
  }
  return s;
}

test('bots only take legal actions, read only their own seat, and finish matches', () => {
  for (const seed of [3, 4, 5]) {
    const s = playMatch(['hard', 'medium'], seed);
    assert.equal(s.phase, 'finished');
  }
  // the bot never sees other hands
  const s = createBalootMatch({ rng: seeded(8) });
  const view = balootView(s, s.turn);
  assert.ok(view.hands.filter((_, i) => i !== s.turn).every((h) => h.every((c) => c === '??')));
  assert.ok(chooseBalootAction(view, s.turn, { level: 'hard', rng: seeded(1) }));
});

test('hard bots clearly beat random play', () => {
  let wins = 0;
  for (let g = 0; g < 10; g++) if (playMatch(['hard', 'random'], 100 + g).winner === 0) wins++;
  assert.ok(wins >= 9, 'hard bots won ' + wins + ' of 10');
});
