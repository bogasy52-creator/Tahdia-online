import { createSnakesGame, playSnakesRoll } from '../../public/assets/js/engines/snakes-engine.js';

export function createSnakesServerGame(names) {
  return createSnakesGame(names);
}

export function serverDiceRoll(rng = Math.random) {
  const value = Number(rng());
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('invalid_rng');
  return Math.floor(value * 6) + 1;
}

export function rollSnakesServer(state, actorSeat, rng = Math.random) {
  if (state.winner !== null) throw new Error('match_finished');
  if (actorSeat !== state.turn) throw new Error('wrong_turn');
  const roll = serverDiceRoll(rng);
  const next = playSnakesRoll(state, roll);
  return { state: next, event: { type: 'roll', roll, ...next.lastEvent } };
}
