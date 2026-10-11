import { createSnakesGame, playSnakesRoll } from '../../public/assets/js/engines/snakes-engine.js';
import { createEnhancedGame, playEnhancedTurn, enhancedLanding, BONUS_CELLS } from '../../public/assets/js/engines/snakes-adventure.js';

export function normalizeSnakesVariant(variant = 'classic') {
  if (variant !== 'classic' && variant !== 'adventure') throw new Error('invalid_variant');
  return variant;
}

export function createSnakesServerGame(names, { variant = 'classic' } = {}) {
  return normalizeSnakesVariant(variant) === 'adventure' ? createEnhancedGame(names) : createSnakesGame(names);
}

export function serverDiceRoll(rng = Math.random) {
  const value = Number(rng());
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('invalid_rng');
  return Math.floor(value * 6) + 1;
}

export function rollSnakesServer(state, actorSeat, rng = Math.random, { power = null } = {}) {
  if (state.winner !== null) throw new Error('match_finished');
  if (actorSeat !== state.turn) throw new Error('wrong_turn');
  const enhanced = state.rulesVersion === 2;
  const player = state.players[actorSeat];
  if (power && (!enhanced || power !== 'double')) throw new Error('invalid_power');
  if (power && (!(player.double > 0) || player.position === 0)) throw new Error('power_unavailable');
  const rolls = [serverDiceRoll(rng)];
  if (power === 'double') rolls.push(serverDiceRoll(rng));
  const landed = enhanced ? enhancedLanding(state, rolls) : null;
  const bonusRoll = enhanced && player.position > 0 && landed !== player.position && BONUS_CELLS.includes(landed)
    ? serverDiceRoll(rng) : null;
  const next = enhanced ? playEnhancedTurn(state, rolls, { power, bonusRoll }) : playSnakesRoll(state, rolls[0]);
  return { state: next, event: { type: 'roll', roll: rolls[0], ...next.lastEvent } };
}
