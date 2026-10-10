import {createSnakesGame} from './snakes-engine.js';

export const ADVENTURE_EVENTS = Object.freeze({
 boost:{icon:'⚡',name:'دفعة سرعة',text:'ثلاث خطوات إضافية'},
 shield:{icon:'◈',name:'درع حماية',text:'احفظه للنجاة من ثعبان'},
 double:{icon:'⚄',name:'نرد مزدوج',text:'ارمِ نردين في دورك القادم'},
 freeze:{icon:'❄',name:'تجميد',text:'يتخطّى الخصم دوره القادم'},
 shortcut:{icon:'↗',name:'اختصار مخفي',text:'قفزة خمس خطوات للأمام'},
 challenge:{icon:'↶',name:'تحدّي الواحد',text:'ثلاث خطوات للخلف'}
});

export function createAdventureGame(names){
 const s=createSnakesGame(names);s.variant='adventure';
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
