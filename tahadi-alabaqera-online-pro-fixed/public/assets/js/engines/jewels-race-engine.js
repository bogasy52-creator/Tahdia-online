/* Independent score runs: the same opening and random stream, a separate board
   per player, and an equal action budget. The server resolves every action. */
import {BOOSTERS,adjacent,createJewelsDuel,playJewelsSwap,playJewelsBooster,chooseJewelsMove,legalSwaps} from './jewels-duel-engine.js';
export {BOOSTERS,adjacent};
export const JR=Object.freeze({W:8,H:8,MOVES:25,DURATION_MS:180000});
const clone=value=>structuredClone(value);
const stats=p=>({name:p?.name||'لاعب',score:p?.score||0,charge:[...(p?.charge||[0,0,0])],best:p?.best||0,specials:p?.specials||0});

export function createJewelsRace(names=['لاعب 1','لاعب 2'],{seed,rng=Math.random,now=Date.now(),durationMs=JR.DURATION_MS,moves=JR.MOVES}={}){
 if(!Array.isArray(names)||names.length!==2)throw Error('requires_two_players');
 if(!Number.isFinite(now)||!Number.isSafeInteger(durationMs)||durationMs<0||durationMs>900000||!Number.isSafeInteger(moves)||moves<1||moves>100)throw Error('invalid_race_options');
 const initialSeed=(seed??Math.floor(rng()*4294967295))>>>0||7;
 const opening=createJewelsDuel(names,{seed:initialSeed,first:0});
 return{game:'jewels',v:2,mode:'race',initialSeed,moves,seq:0,startedAt:now,durationMs,endsAt:durationMs?now+durationMs:null,finished:false,winner:null,last:null,
  players:opening.players.map(p=>({...stats(p),board:clone(opening.board),seed:opening.seed,serial:opening.serial,used:0,remaining:moves,done:false,seq:0,last:null}))};
}

function player(state,seat){
 if(!Number.isSafeInteger(seat)||seat<0||seat>=state.players.length)throw Error('invalid_seat');
 return state.players[seat];
}
function authorize(state,seat,{expectedSeq,now=Date.now()}={}){
 const p=player(state,seat);
 if(state.finished)throw Error('match_over');
 if(p.done||p.remaining<=0)throw Error('run_finished');
 if(!Number.isFinite(now))throw Error('invalid_time');
 if(state.endsAt!==null&&now>=state.endsAt)throw Error('match_expired');
 if(expectedSeq!==undefined&&(!Number.isSafeInteger(expectedSeq)||expectedSeq!==p.seq))throw Error('stale_move');
 return p;
}

/** Adapt one run to the mature match/special-resolution implementation. */
export function jewelsRaceSolo(state,seat){
 const p=player(state,seat);
 return{game:'jewels',v:1,seed:p.seed,serial:p.serial,players:state.players.map(stats),first:seat,turn:seat,round:1,moves:Math.max(1,p.remaining),extras:2,winner:null,seq:p.seq,last:null,board:clone(p.board)};
}
export function legalRaceSwaps(state,seat){
 if(!state||state.finished)return[];
 const p=player(state,seat);return p.done||!Array.isArray(p.board)?[]:legalSwaps(p.board);
}

function closeIfReady(s){
 if(!s.players.every(p=>p.done))return s;
 s.finished=true;
 const [a,b]=s.players;s.winner=a.score===b.score?-1:a.score>b.score?0:1;
 return s;
}
function accept(state,seat,resolved){
 const next=clone(state),previous=state.players[seat],p=resolved.players[seat];
 const remaining=previous.remaining-1;
 next.players[seat]={...previous,...stats(p),board:resolved.board,seed:resolved.seed,serial:resolved.serial,
  seq:previous.seq+1,used:previous.used+1,remaining,done:remaining===0,last:{...resolved.last,extra:false}};
 next.seq++;next.last={seq:next.seq,seat,kind:resolved.last.kind};
 return closeIfReady(next);
}
export function playJewelsRaceSwap(state,seat,a,b,options={}){
 authorize(state,seat,options);
 if(!adjacent(a,b))throw Error('not_adjacent');
 return accept(state,seat,playJewelsSwap(jewelsRaceSolo(state,seat),seat,a,b));
}
export function playJewelsRaceBooster(state,seat,id,cell,options={}){
 authorize(state,seat,options);
 if(!Number.isSafeInteger(cell))throw Error('bad_cell');
 return accept(state,seat,playJewelsBooster(jewelsRaceSolo(state,seat),seat,id,cell));
}

/** Closing one local/online run never closes the other player's run early. */
export function finishJewelsRace(state,{seat,expectedSeq,now=Date.now(),force=false}={}){
 if(state.finished)return state;
 if(seat!==undefined){
  const p=player(state,seat);
  if(p.done)return state;
  if(expectedSeq!==undefined&&(!Number.isSafeInteger(expectedSeq)||expectedSeq!==p.seq))throw Error('stale_move');
  const s=clone(state);s.players[seat].done=true;s.players[seat].seq++;s.players[seat].last=null;s.seq++;
  return closeIfReady(s);
 }
 if(!force&&!(state.endsAt!==null&&Number.isFinite(now)&&now>=state.endsAt))return closeIfReady(clone(state));
 const s=clone(state);for(const p of s.players){p.done=true;p.last=null;}s.seq++;
 return closeIfReady(s);
}
export function advanceJewelsRace(state,now=Date.now()){
 return !state.finished&&state.endsAt!==null&&now>=state.endsAt?finishJewelsRace(state,{now,force:true}):state;
}
export function chooseJewelsRaceMove(state,seat,level='medium',rng=Math.random){
 const p=player(state,seat);if(state.finished||p.done)return null;
 return chooseJewelsMove(jewelsRaceSolo(state,seat),level,rng);
}

/** The other player's board, refill seed and replay never leave the room. */
export function publicJewelsRace(state,viewer){
 const s=clone(state);
 delete s.initialSeed;
 s.players=s.players.map((p,i)=>{const {seed,serial,...visible}=p;if(i===viewer)return visible;const {board,last,...summary}=visible;return summary;});
 return s;
}
