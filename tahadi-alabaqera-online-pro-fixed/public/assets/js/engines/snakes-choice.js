import {createSnakesGame,playSnakesRoll,TACTICS_JUMPS} from './snakes-engine.js';

// The server offers two dice. Clients submit an index, never a die value.
export function createChoiceGame(names){
 const state=createSnakesGame(names,{entrySix:false});
 return {...state,variant:'choice',rulesVersion:5,jumps:{...TACTICS_JUMPS},pendingChoice:null};
}
export function openChoiceTurn(state,rolls){
 if(state.winner!==null)throw Error('match_finished');
 if(state.pendingChoice)throw Error('choose_first');
 if(!Array.isArray(rolls)||rolls.length!==2||rolls.some(n=>!Number.isInteger(n)||n<1||n>6))throw Error('invalid_roll');
 const next=structuredClone(state);
 next.pendingChoice={seat:state.turn,rolls:[...rolls],id:state.moveCount+1};
 next.lastEvent=null;
 return next;
}
export function choiceDestination(state,index){
 const pending=state.pendingChoice;
 if(!pending||!Number.isInteger(index)||index<0||index>1)throw Error('invalid_choice');
 const from=state.players[pending.seat].position,landed=from+pending.rolls[index];
 return landed>100?from:Number(state.jumps[landed]??landed);
}
export function chooseChoiceTurn(state,index){
 if(!state.pendingChoice)throw Error('roll_first');
 if(!Number.isInteger(index)||index<0||index>1)throw Error('invalid_choice');
 if(state.pendingChoice.seat!==state.turn)throw Error('wrong_turn');
 const offered=[...state.pendingChoice.rolls],next=playSnakesRoll(state,offered[index]);
 next.pendingChoice=null;
 Object.assign(next.lastEvent,{rolls:[offered[index]],total:offered[index],choice:index,offeredRolls:offered});
 return next;
}
export function bestChoice(state){
 const scores=[0,1].map(i=>choiceDestination(state,i)+(state.pendingChoice.rolls[i]===6?.4:0));
 return scores[1]>scores[0]?1:0;
}
