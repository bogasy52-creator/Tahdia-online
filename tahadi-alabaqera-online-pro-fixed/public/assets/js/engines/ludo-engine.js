import {boardGeometry,boardStonePosition} from './board-geometry-v29.js';
export const LUDO_STARTS=Object.freeze([0,13,26,39]);
export const LUDO_SAFE=Object.freeze(new Set([0,8,13,21,26,34,39,47]));
/* 33.10.5 «لودو»: the classic cross board. 52 squares round, each colour starts on the square next to
   its yard and walks 51 of them (0–50: the last one is the square at the mouth of its home column),
   then 5 squares up its own column (51–55) and into the middle (56). Two players sit facing each
   other (the opposite corners); three or four take the corners in turn. The safe squares are the four
   starts and the star eight squares after each. A stone that reaches the middle earns another throw. */
const CLASSIC_CORNERS=Object.freeze({2:[0,2],3:[0,1,2],4:[0,1,2,3],6:[0,1,2,3,4,5]});
export function ludoGeometry(state=4){
 if(state?.layout!=='classic'){const g=boardGeometry(state);return{...g,lane:g.track,corners:g.starts.map((_,i)=>i)};}
 if(state.players?.length===6)return{seats:6,arm:13,track:78,lane:77,finish:82,fill:false,classic:true,corners:[0,1,2,3,4,5],starts:[0,13,26,39,52,65],safe:new Set([0,8,13,21,26,34,39,47,52,60,65,73])};
 const corners=CLASSIC_CORNERS[state.players?.length]||CLASSIC_CORNERS[4];
 return{seats:4,arm:13,track:52,lane:51,finish:56,fill:false,classic:true,corners,starts:corners.map(c=>c*13),safe:new Set([0,8,13,21,26,34,39,47])};
}
export function createLudoGame(names=['لاعب 1','لاعب 2'],options={}){
 const classic=options.layout==='classic';
 if(!Array.isArray(names)||names.length<2||names.length>6||classic&&names.length===5)throw Error(classic?'ludo_requires_2_3_4_or_6_players':'ludo_requires_2_to_6_players');
 return{players:names.map((n,id)=>({id,name:String(n||`لاعب ${id+1}`).slice(0,20),tokens:[-1,-1,-1,-1]})),turn:0,lastRoll:null,lastEvent:null,winner:null,rollCount:0,...(options.quick===true?{quick:true}:{}),...(classic?{layout:'classic'}:{})};
}
export function globalLudoPosition(player,progress,state=4){
 if(state?.layout==='classic'){const g=ludoGeometry(state);return progress<0||progress>=g.lane?null:(g.starts[player]+progress)%g.track;}
 return boardStonePosition(player,progress,state);
}
export function getLegalLudoMoves(state,roll,playerIndex=state.turn){
 if(state.winner!==null||!Number.isInteger(roll)||roll<1||roll>6||!state.players[playerIndex])return[];
 const {finish}=ludoGeometry(state);return state.players[playerIndex].tokens.flatMap((pos,i)=>((pos===-1?roll===6:pos<finish&&pos+roll<=finish)?[i]:[]));
}
export function applyLudoMove(state,tokenIndex,roll){
 if(state.winner!==null)return state;if(!getLegalLudoMoves(state,roll).includes(tokenIndex))throw Error('illegal_ludo_move');
 const s=structuredClone(state),g=ludoGeometry(s),actor=s.turn,p=s.players[actor],from=p.tokens[tokenIndex],to=from===-1?0:from+roll,captured=[];p.tokens[tokenIndex]=to;
 if(to>=0&&to<g.lane){const cell=globalLudoPosition(actor,to,s);if(!g.safe.has(cell))s.players.forEach((op,pi)=>{if(pi===actor)return;op.tokens.forEach((pos,ti)=>{if(pos>=0&&pos<g.lane&&globalLudoPosition(pi,pos,s)===cell){op.tokens[ti]=-1;captured.push({player:pi,token:ti});}});});}
 if(s.quick?p.tokens.some(x=>x===g.finish):p.tokens.every(x=>x===g.finish))s.winner=actor;const home=g.classic&&to===g.finish,extra=(roll===6||captured.length>0||home)&&s.winner===null;s.lastRoll=roll;s.rollCount++;s.lastEvent={player:actor,token:tokenIndex,from,to,captured,extraTurn:extra,...(home?{home:true}:{})};if(!extra&&s.winner===null)s.turn=(s.turn+1)%s.players.length;return s;
}
export function passLudoTurn(state,roll){
 if(!Number.isInteger(roll)||roll<1||roll>6)throw Error('invalid_roll');
 if(getLegalLudoMoves(state,roll).length)throw Error('legal_move_available');
 const s=structuredClone(state);s.lastRoll=roll;s.rollCount++;s.lastEvent={player:s.turn,pass:true,roll};if(roll!==6)s.turn=(s.turn+1)%s.players.length;return s;
}
