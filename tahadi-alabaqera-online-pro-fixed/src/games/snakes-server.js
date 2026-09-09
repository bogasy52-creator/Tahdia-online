import { createSnakesGame, playSnakesRoll } from '../../public/assets/js/engines/snakes-engine.js';

export function createSnakesServerGame(names) {
  return createSnakesGame(names);
}

export function serverDiceRoll(rng = Math.random, previous = null) {
  const value = Number(rng());
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('invalid_rng');
  let roll = Math.floor(value * 6) + 1;
  // Avoid a frustrating repeated result when the same player is rolling
  // quickly. This still preserves a uniform roll except for the immediately
  // repeated face, and keeps the rule deterministic for tests/replays.
  if (Number.isInteger(previous) && roll === previous) roll = roll === 6 ? 1 : roll + 1;
  return roll;
}

export function rollSnakesServer(state, actorSeat, rng = Math.random) {
  if (state.winner !== null) throw new Error('match_finished');
  if (actorSeat !== state.turn) throw new Error('wrong_turn');
  const roll = serverDiceRoll(rng, state.lastRoll);
  const next = playSnakesRoll(state, roll);
  return { state: next, event: { type: 'roll', roll, ...next.lastEvent } };
}
