// Time gates are paired. A landing makes one transit only; no recursive teleport loops.
export const TIME_GATES=Object.freeze({8:32,32:8,24:58,58:24,61:87,87:61});
export const TIME_JUMPS=Object.freeze({4:16,37:54,70:86,18:6,49:34,92:77,...TIME_GATES});
export function createPortalGame(names){
 const clean=names.slice(0,10).map((name,id)=>({id,name:String(name||`لاعب ${id+1}`).slice(0,20),position:0,shield:1,double:2}));
 if(clean.length<2)throw Error('snakes_requires_2_players');
 return{variant:'portals',rulesVersion:4,entrySix:false,players:clean,turn:0,winner:null,lastRoll:null,lastEvent:null,jumps:{...TIME_JUMPS},portalCells:{...TIME_GATES},moveCount:0};
}
export function playPortalTurn(state,roll,{power=null}={}){
 if(!Number.isInteger(roll)||roll<1||roll>6)throw Error('invalid_roll');
 if(state.winner!==null)throw Error('match_finished');
 if(power&&!['shield','double'].includes(power))throw Error('invalid_power');
 if(power&&!(state.players[state.turn][power]>0))throw Error('power_unavailable');
 const n=structuredClone(state),actor=n.turn,p=n.players[actor],from=p.position;
 if(power)p[power]--;
 const total=roll+(power==='double'?3:0),blocked=from+total>100,landed=blocked?from:from+total;
 const portal=!blocked&&Object.hasOwn(n.portalCells,landed),destination=blocked?from:(n.jumps[landed]??landed);
 const protectedJump=power==='shield'&&(portal||destination<landed),to=protectedJump?landed:destination;
 p.position=to;n.lastRoll=roll;n.moveCount++;
 if(to===100)n.winner=actor;
 const extraTurn=roll===6&&n.winner===null;
 n.lastEvent={player:actor,from,landed,to,rolls:[roll],total,blocked,protected:protectedJump,portal:portal&&!protectedJump,jumpType:portal?null:to>landed?'ladder':to<landed?'snake':null,power,boosted:power==='double',extraTurn,event:null};
 if(!extraTurn&&n.winner===null)n.turn=(actor+1)%n.players.length;
 return n;
}
