import {getJackarooActions,playJackarooAction} from './jackaroo-engine.js?v=13.5.0';
import {getLegalLudoMoves,applyLudoMove,globalLudoPosition,LUDO_SAFE} from './ludo-engine.js?v=13.5.0';

function pick(scored,difficulty,rng){
 if(!scored.length)return null;
 if(difficulty==='easy')return scored[Math.min(scored.length-1,Math.floor(rng()*scored.length))].value;
 scored.sort((a,b)=>b.score-a.score);
 return scored[0].value;
}

export function chooseJackarooMove(state,difficulty='medium',rng=Math.random){
 const actor=state.turn,team=actor%2,scored=[];
 state.hands[actor].forEach((_,cardIndex)=>{
  for(const action of getJackarooActions(state,cardIndex,actor)){
   let score=action.type==='discard'?-100:0;
   if(difficulty!=='easy'){
    const next=playJackarooAction(state,cardIndex,action),event=next.lastEvent;
    for(let owner=0;owner<4;owner++){
     const sign=owner%2===team?1:-1;
     for(let mi=0;mi<4;mi++){
      const before=state.players[owner].marbles[mi],after=next.players[owner].marbles[mi];
      if(before===after)continue;
      if(after===56)score+=sign*600;
      else if(after===-1)score-=sign*95;
      else if(before===-1)score+=sign*55;
      else score+=sign*((after>=52?100:0)+(after-before)*2);
     }
    }
    if(next.winnerTeam===team)score+=10000;
    if(difficulty==='hard'){
     // Look only at public pieces. Private opponents' cards are never read.
     for(const owner of [actor,(actor+2)%4])for(const m of next.players[owner].marbles){
      if(m>0&&m<52){const global=(owner*13+m)%52;
       for(let op=0;op<4;op++)if(op%2!==team)for(const om of next.players[op].marbles){
        if(om>=0&&om<52){const gap=(global-(op*13+om)%52+52)%52;if(gap>0&&gap<=13)score-=4}
       }
      }
     }
     if(action.type==='enter')score+=12;
    }
    if(event.type==='discard')score-=cardCost(state.hands[actor][cardIndex]);
   }
   scored.push({value:{cardIndex,action},score});
  }
 });
 return pick(scored,difficulty,rng);
}
function cardCost(card){return /^[AK]/.test(card)?10:/^7/.test(card)?8:1}

export function chooseLudoMove(state,roll,difficulty='medium',rng=Math.random){
 const actor=state.turn;
 return pick(getLegalLudoMoves(state,roll).map(token=>{
  const next=applyLudoMove(state,token,roll),event=next.lastEvent;
  let score=event.to===56?600:event.to>=52?150+event.to:event.from===-1?65:event.to;
  score+=(event.captured?.length||0)*110;
  if(difficulty==='hard'&&event.to<=51){
   const global=globalLudoPosition(actor,event.to);
   if(LUDO_SAFE.has(global))score+=35;
   else for(let op=0;op<state.players.length;op++)if(op!==actor)for(const m of next.players[op].tokens){
    if(m>=0&&m<=51){const gap=(global-globalLudoPosition(op,m)+52)%52;if(gap>0&&gap<=6)score-=18}
   }
  }
  return{value:token,score};
 }),difficulty,rng);
}

export function chooseSnakePower(state,difficulty='medium',rng=Math.random){
 const p=state.players[state.turn];
 if(difficulty==='easy')return rng()<.3?(p.double>0?'double':p.shield>0?'shield':null):null;
 let loss=0;
 for(let r=1;r<=6;r++){const n=p.position+r,jump=state.jumps[n];if(jump<n)loss+=n-jump}
 if(p.shield>0&&loss>=(difficulty==='hard'?12:30))return 'shield';
 if(p.double>0&&p.position<=87){
  let single=0,double=0;
  for(let a=1;a<=6;a++){
   single+=(state.jumps[p.position+a]??p.position+a)/6;
   for(let b=1;b<=6;b++)double+=(state.jumps[p.position+a+b]??p.position+a+b)/36;
  }
  if(double>single+1)return 'double';
 }
 return null;
}

export function shouldBankDice(state,difficulty='medium'){
 const p=state.players[state.turn],total=state.turnTotal;
 if(p.score+total>=state.target)return true;
 const leader=Math.max(...state.players.filter((_,i)=>i!==state.turn).map(p=>p.score));
 const threshold=difficulty==='easy'?10:difficulty==='hard'?(p.score>leader?14:leader-p.score>12?25:20):16;
 return total>=threshold;
}
