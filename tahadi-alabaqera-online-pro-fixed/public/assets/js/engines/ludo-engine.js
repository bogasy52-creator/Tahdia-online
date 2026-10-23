import {boardGeometry,boardStonePosition} from './board-geometry-v29.js';
export const LUDO_STARTS=Object.freeze([0,13,26,39]);
export const LUDO_SAFE=Object.freeze(new Set([0,8,13,21,26,34,39,47]));
export function createLudoGame(names=['لاعب 1','لاعب 2']){
 if(!Array.isArray(names)||names.length<2||names.length>6)throw Error('ludo_requires_2_to_6_players');
 return{players:names.map((n,id)=>({id,name:String(n||`لاعب ${id+1}`).slice(0,20),tokens:[-1,-1,-1,-1]})),turn:0,lastRoll:null,lastEvent:null,winner:null,rollCount:0};
}
export function globalLudoPosition(player,progress,state=4){return boardStonePosition(player,progress,state);}
export function getLegalLudoMoves(state,roll,playerIndex=state.turn){
 if(state.winner!==null||!Number.isInteger(roll)||roll<1||roll>6||!state.players[playerIndex])return[];
 const {finish}=boardGeometry(state);return state.players[playerIndex].tokens.flatMap((pos,i)=>((pos===-1?roll===6:pos<finish&&pos+roll<=finish)?[i]:[]));
}
export function applyLudoMove(state,tokenIndex,roll){
 if(state.winner!==null)return state;if(!getLegalLudoMoves(state,roll).includes(tokenIndex))throw Error('illegal_ludo_move');
 const s=structuredClone(state),g=boardGeometry(s),actor=s.turn,p=s.players[actor],from=p.tokens[tokenIndex],to=from===-1?0:from+roll,captured=[];p.tokens[tokenIndex]=to;
 if(to>=0&&to<g.track){const cell=globalLudoPosition(actor,to,s);if(!g.safe.has(cell))s.players.forEach((op,pi)=>{if(pi===actor)return;op.tokens.forEach((pos,ti)=>{if(pos>=0&&pos<g.track&&globalLudoPosition(pi,pos,s)===cell){op.tokens[ti]=-1;captured.push({player:pi,token:ti});}});});}
 if(p.tokens.every(x=>x===g.finish))s.winner=actor;const extra=(roll===6||captured.length>0)&&s.winner===null;s.lastRoll=roll;s.rollCount++;s.lastEvent={player:actor,token:tokenIndex,from,to,captured,extraTurn:extra};if(!extra&&s.winner===null)s.turn=(s.turn+1)%s.players.length;return s;
}
export function passLudoTurn(state,roll){
 if(!Number.isInteger(roll)||roll<1||roll>6)throw Error('invalid_roll');
 if(getLegalLudoMoves(state,roll).length)throw Error('legal_move_available');
 const s=structuredClone(state);s.lastRoll=roll;s.rollCount++;s.lastEvent={player:s.turn,pass:true,roll};if(roll!==6)s.turn=(s.turn+1)%s.players.length;return s;
}
