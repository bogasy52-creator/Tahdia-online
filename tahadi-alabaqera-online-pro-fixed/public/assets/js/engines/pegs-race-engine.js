import {createPegsGame,rollPegs,pickPegs,peekPegs,choosePegsMove} from './pegs-engine.js';
const clone=s=>structuredClone(s);
export function createPegsRace(names,{rng=Math.random,large=false,now=Date.now(),showMs=5000,durationMs=180000,goal=12}={}){
 const base=createPegsGame(names,{rng,large,showMs,now,first:0}),order=base.pegs.map(p=>p.c);
 for(let i=order.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
 return {game:'pegs',mode:'race',large,goal,seq:0,startedAt:now,endsAt:now+showMs+durationMs,winner:null,ties:[],order,
  players:base.players.map(p=>({...p})),runs:base.players.map((_,seat)=>({...clone(base),turn:seat,cooldownUntil:0,readyAt:0}))};
}
function finish(s){
 const top=Math.max(...s.players.map(p=>p.pegs.length)),winners=s.players.map((p,i)=>p.pegs.length===top?i:-1).filter(i=>i>=0);
 s.winner=winners[0];s.ties=winners.length>1?winners:[];return s;
}
export function advancePegsRace(state,now=Date.now()){
 if(state.winner!==null||now<state.endsAt)return state;
 const s=clone(state);return finish(s);
}
export function playPegsRace(state,seat,msg,{now=Date.now(),rng=Math.random}={}){
 const current=state.runs[seat];if(!current||state.winner!==null)throw Error('match_over');
 if(now>=state.endsAt)throw Error('match_over');
 if(now<current.lookUntil)throw Error('look_phase');
 if(now<Math.max(current.cooldownUntil,current.readyAt||0))throw Error('cooldown');
 if(!Number.isInteger(msg.seq)||msg.seq!==current.seq)throw Error('stale_action');
 const s=clone(state);let run=s.runs[seat];
 if(msg.type==='pegs_roll'){
  const target=s.order[run.players[seat].pegs.length];run=rollPegs(run,seat,()=>((target+.01)/(run.colorCount||6)));
 }else if(msg.type==='pegs_pick'){
  run=pickPegs(run,seat,Number(msg.peg),rng);run.turn=seat;
  if(!run.last.ok)run.cooldownUntil=now+2000;
  run.players[seat].score=run.players[seat].pegs.length;if(run.last.ok)run.last.gained=1;
 }else if(msg.type==='pegs_peek')run=peekPegs(run,seat,Number(msg.peg));
 else throw Error('invalid_action');
 run.readyAt=now+(run.last?.ms||0);
 s.runs[seat]=run;s.players[seat]=clone(run.players[seat]);s.players[seat].score=s.players[seat].pegs.length;s.seq++;
 if(s.players[seat].pegs.length>=s.goal){s.winner=seat;s.ties=[];}
 return s;
}
export function choosePegsRaceMove(state,seat,level='medium',rng=Math.random,now=Date.now()){
 const run=state.runs[seat];if(!run||state.winner!==null||now<run.lookUntil||now<Math.max(run.cooldownUntil,run.readyAt||0))return null;
 const m=choosePegsMove(run,level,rng);return {type:m.type==='roll'?'pegs_roll':'pegs_pick',peg:m.peg,seq:run.seq};
}
export function publicPegsRace(state,seat,now=Date.now()){
 const run=state.runs[seat];if(!run)return null;
 const out=clone(run),open=run.seq===0&&now<run.lookUntil;
 out.pegs=out.pegs.map(p=>p.taken===null&&!open?{...p,c:-1}:p);
 out.players=clone(state.players);out.reveals=[];delete out.salt;
 out.mode='race';out.winner=state.winner;out.ties=[...state.ties];if(state.winner!==null)out.phase='over';
 out.race={goal:state.goal,endsAt:state.endsAt,cooldownUntil:Math.max(run.cooldownUntil,run.readyAt||0),seat};
 return out;
}
