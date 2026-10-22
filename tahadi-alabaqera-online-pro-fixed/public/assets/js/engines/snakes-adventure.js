import {createSnakesGame} from './snakes-engine.js?v=28.0.0';

export const ADVENTURE_EVENTS = Object.freeze({
 boost:{icon:'⚡',name:'دفعة سرعة',text:'ثلاث خطوات إضافية'},
 shield:{icon:'◈',name:'درع حماية',text:'احفظه للنجاة من ثعبان'},
 double:{icon:'⚄',name:'نرد مزدوج',text:'ارمِ نردين في دورك القادم'},
 freeze:{icon:'❄',name:'تجميد',text:'يتخطّى الخصم دوره القادم'},
 shortcut:{icon:'↗',name:'اختصار مخفي',text:'قفزة خمس خطوات للأمام'},
 challenge:{icon:'↶',name:'تحدّي الواحد',text:'ثلاث خطوات للخلف'}
});

export function createAdventureGame(names){
 const s=createSnakesGame(names,{entrySix:false});s.variant='adventure';
 s.players=s.players.map(p=>({...p,shield:1,double:1,frozen:0}));return s;
}

export function randomAdventureEvent(roll,rng=Math.random){
 const r=rng();
 if(roll===1&&r<.32)return 'challenge';
 if(r>=.24)return null;
 return ['boost','shield','double','freeze','shortcut'][Math.min(4,Math.floor(r/.24*5))];
}

export function playAdventureTurn(state,rolls,{power=null,event=null}={}){
 if(state.winner!==null)return state;
 if(!Array.isArray(rolls)||!rolls.length||rolls.some(n=>!Number.isInteger(n)||n<1||n>6))throw new Error('invalid_roll');
 if(power&&!['shield','double'].includes(power))throw new Error('invalid_power');
 const s=structuredClone(state),actor=s.turn,p=s.players[actor];
 if(power&&!(p[power]>0))throw new Error('power_unavailable');
 if(rolls.length!==(power==='double'?2:1))throw new Error('invalid_roll_count');
 if(power)p[power]--;
 const from=p.position,total=rolls.reduce((a,b)=>a+b,0),blocked=from+total>100;
 let landed=blocked?from:from+total,to=landed,jumpType=null,protectedFall=false;
 if(!blocked){
  const jump=Number(s.jumps[landed]??landed);
  if(jump<landed&&power==='shield')protectedFall=true;
  else{to=jump;jumpType=jump<landed?'snake':jump>landed?'ladder':null}
 }
 p.position=to;
 let resolved=null,eventFrom=to,eventTo=to;
 if(!blocked&&to<100&&ADVENTURE_EVENTS[event]){
  resolved=event;
  if(event==='boost'||event==='shortcut'){
   const step=event==='boost'?3:5;
   if(to+step<=100)p.position=to+step;
  }else if(event==='shield'||event==='double')p[event]=Math.min(3,(p[event]||0)+1);
  else if(event==='freeze')s.players[(actor+1)%s.players.length].frozen=1;
  else if(event==='challenge')p.position=Math.max(0,to-3);
  eventTo=p.position;
 }
 if(p.position===100)s.winner=actor;
 const extra=rolls.includes(6)&&s.winner===null,skipped=[];
 if(!extra&&s.winner===null){
  s.turn=(actor+1)%s.players.length;
  for(let n=0;n<s.players.length&&s.players[s.turn].frozen>0;n++){
   s.players[s.turn].frozen=0;skipped.push(s.turn);s.turn=(s.turn+1)%s.players.length;
  }
 }
 s.moveCount++;s.lastRoll=rolls[0];
 s.lastEvent={player:actor,from,landed,to,jumpType,extraTurn:extra,blocked,rolls:[...rolls],total,power,protected:protectedFall,event:resolved,eventFrom,eventTo,skipped};
 return s;
}

// Three visible reward tiles, rather than invisible random events each turn.
export const BONUS_CELLS=Object.freeze([12,46,82]);
export const BONUS_FACES=Object.freeze([
 {key:'shield',name:'حماية واحدة',text:'تمنع ابتلاعًا واحدًا تلقائيًا'},
 {key:'turns',name:'دوران إضافيان',text:'العب مرتين إضافيتين'},
 {key:'double',name:'نردان',text:'قدرة نردين لرمية واحدة'},
 {key:'boost',name:'تقدّم 3',text:'تحرّك ثلاث خانات إضافية'},
 {key:'shortcut',name:'تقدّم 5',text:'تحرّك خمس خانات إضافية'},
 {key:'freeze',name:'تجميد الخصم',text:'يتخطّى اللاعب التالي دورًا واحدًا'}
]);
export function createEnhancedGame(names){
 const s=createSnakesGame(names);s.variant='adventure';s.rulesVersion=2;s.bonusCells=[...BONUS_CELLS];
 s.players=s.players.map(p=>({...p,shield:0,double:0,bonusTurns:0,frozen:0}));return s;
}
export function enhancedLanding(state,rolls){
 const from=state.players[state.turn].position,total=rolls.reduce((a,b)=>a+b,0);
 if(from===0)return rolls.includes(6)?1:0;
 return from+total<=100?from+total:from;
}
export function playEnhancedTurn(state,rolls,{power=null,bonusRoll=null}={}){
 if(state.winner!==null)return state;
 if(!Array.isArray(rolls)||!rolls.length||rolls.some(n=>!Number.isInteger(n)||n<1||n>6))throw new Error('invalid_roll');
 if(power&&power!=='double')throw new Error('invalid_power');
 const s=structuredClone(state),actor=s.turn,p=s.players[actor];
 if(power&&(!(p.double>0)||p.position===0))throw new Error('power_unavailable');
 if(rolls.length!==(power==='double'?2:1))throw new Error('invalid_roll_count');
 const from=p.position,total=rolls.reduce((a,b)=>a+b,0),waitingEntry=from===0&&!rolls.includes(6),entered=from===0&&!waitingEntry,blocked=from!==0&&from+total>100;
 if(power)p.double--;
 const landed=enhancedLanding(s,rolls);let protectedFall=false;
 const resolve=(cell)=>{const jump=Number(s.jumps[cell]??cell);if(jump<cell&&p.shield>0){p.shield--;protectedFall=true;return {to:cell,kind:null}}return {to:jump,kind:jump<cell?'snake':jump>cell?'ladder':null}};
 const main=!waitingEntry&&!blocked?resolve(landed):{to:from,kind:null};p.position=main.to;
 let reward=null,eventLanding=p.position,eventTo=p.position,bonusJumpType=null,resolvedRoll=null;
 if(!waitingEntry&&!blocked&&BONUS_CELLS.includes(landed)){
  if(!Number.isInteger(bonusRoll)||bonusRoll<1||bonusRoll>6)throw new Error('bonus_roll_required');
  resolvedRoll=bonusRoll;reward=BONUS_FACES[bonusRoll-1].key;
  if(reward==='shield')p.shield=1;
  else if(reward==='turns')p.bonusTurns=Math.min(4,(p.bonusTurns||0)+2);
  else if(reward==='double')p.double=Math.min(2,(p.double||0)+1);
  else if(reward==='freeze')s.players[(actor+1)%s.players.length].frozen=1;
  else{const steps=reward==='boost'?3:5;if(p.position+steps<=100){eventLanding=p.position+steps;const after=resolve(eventLanding);p.position=after.to;bonusJumpType=after.kind;}eventTo=p.position;}
 }
 if(p.position===100)s.winner=actor;
 let extra=rolls.includes(6)&&s.winner===null;
 if(!extra&&s.winner===null&&p.bonusTurns>0){p.bonusTurns--;extra=true;}
 const skipped=[];
 if(!extra&&s.winner===null){s.turn=(actor+1)%s.players.length;for(let i=0;i<s.players.length&&s.players[s.turn].frozen>0;i++){s.players[s.turn].frozen=0;skipped.push(s.turn);s.turn=(s.turn+1)%s.players.length;}}
 s.lastRoll=rolls[0];s.moveCount++;
 s.lastEvent={player:actor,from,landed,to:main.to,jumpType:main.kind,total,rolls:[...rolls],power,blocked,waitingEntry,entered,protected:protectedFall,bonusRoll:resolvedRoll,event:reward,eventFrom:main.to,eventLanding,eventTo,bonusJumpType,extraTurn:extra,skipped};
 return s;
}
