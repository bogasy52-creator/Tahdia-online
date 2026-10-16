import {createMatch3,moveMatch3,legalSwaps,BOOST_COST} from '../public/assets/js/engines/match3-engine.js';
export function solveMatch3(level=1,daily='',attempts=16){
 let last;
 for(let attempt=0;attempt<attempts;attempt++){
  let s=createMatch3(level,daily),seed=attempt+733;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  while(!s.over){
   const actions=s.charge>=BOOST_COST&&s.boosterUses<10?Array.from({length:49},(_,boost)=>({boost})):legalSwaps(s).map(swap=>({swap}));
   const scored=actions.map(action=>{const result=moveMatch3(s,action,{events:false}),v=result.state;return {result,merit:(v.won?1e6:0)+(v.iceCleared-s.iceCleared)*170+Math.min(Math.max(0,s.colorGoal-s.colorCount),v.colorCount-s.colorCount)*13+Math.min(Math.max(0,s.goal-s.collected),v.collected-s.collected)*3+(v.score-s.score)*.3+(v.extraMoves-s.extraMoves)*40+random()*(attempt?70:0)};}).sort((a,b)=>b.merit-a.merit);
   if(!scored.length)break;s=scored[0].result.state;
  }
  last=s;if(s.won)return s;
 }
 return last;
}
