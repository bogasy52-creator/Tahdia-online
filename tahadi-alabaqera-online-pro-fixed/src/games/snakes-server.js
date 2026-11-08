import {createChoiceGame,openChoiceTurn} from '../../public/assets/js/engines/snakes-choice.js';
import {createPortalGame,playPortalTurn} from '../../public/assets/js/engines/snakes-portals.js';
import { createSnakesGame, playSnakesRoll, TACTICS_JUMPS } from '../../public/assets/js/engines/snakes-engine.js';
import { createEnhancedGame, playEnhancedTurn, enhancedLanding, BONUS_CELLS, createAdventureGame, playAdventureTurn } from '../../public/assets/js/engines/snakes-adventure.js';

export function normalizeSnakesVariant(variant = 'classic') {
  if (!['classic','adventure','strategy','portals','choice'].includes(variant)) throw new Error('invalid_variant');
  return variant;
}

export function createSnakesServerGame(names, { variant = 'classic' } = {}) {
  if(normalizeSnakesVariant(variant)==='choice')return createChoiceGame(names);
  if(normalizeSnakesVariant(variant)==='portals')return createPortalGame(names);
  if(normalizeSnakesVariant(variant)==='strategy'){const s=createAdventureGame(names);s.variant='strategy';s.rulesVersion=3;s.jumps={...TACTICS_JUMPS};return s;}
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
  if(state.variant==='choice'){
    if(power)throw Error('invalid_power');
    if(state.pendingChoice)throw Error('choose_first');
    const next=openChoiceTurn(state,[serverDiceRoll(rng),serverDiceRoll(rng)]);
    return {state:next,event:{type:'choice_offer',rolls:next.pendingChoice.rolls}};
  }
  if(state.variant==='portals'){
    if(power&&!['shield','double'].includes(power))throw Error('invalid_power');
    if(power&&!(state.players[actorSeat][power]>0))throw Error('power_unavailable');
    const roll=serverDiceRoll(rng),next=playPortalTurn(state,roll,{power});return{state:next,event:{type:'roll',roll,...next.lastEvent}};
  }
  if(state.variant==='strategy'){
    const player=state.players[actorSeat];if(power&&!['shield','double'].includes(power))throw new Error('invalid_power');if(power&&!(player[power]>0))throw new Error('power_unavailable');
    const rolls=[serverDiceRoll(rng)];if(power==='double')rolls.push(serverDiceRoll(rng));
    const next=playAdventureTurn(state,rolls,{power,event:null});return{state:next,event:{type:'roll',roll:rolls[0],...next.lastEvent}};
  }
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
