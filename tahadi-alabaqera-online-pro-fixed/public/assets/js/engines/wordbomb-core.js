// «صيد الكلمات» (33.5.0, game id «wordbomb»): a grid of letters with hidden words. Everyone
// hunts at once; the first to mark a word takes its points. Three rounds, the last one with
// its words hidden and double points. Deterministic and shared by practice and the rooms.
import {HUNT_THEMES} from './wordbank-ar.js';
export const HUNT_ROUNDS=3,HUNT_BREAK_MS=4000,HUNT_MISS_MS=1200;
export const HUNT_ROUND_MS=Object.freeze([75000,75000,90000]);
export const HUNT_HINTS_MS=Object.freeze([20000,45000]);
// Cell 0 is the top right cell: [0,1] reads right to left, [1,0] top to bottom and [1,1]
// down to the left. The first round uses the first two; the next rounds add the diagonal.
const DIRS=[[0,1],[1,0],[1,1]];
const FILL='اااالللمممييينننووورررتتتببسسععدقكفهحجشصخطزغضثذظ';
function rand(seed){let x=seed>>>0;return()=>{x+=0x6D2B79F5;let t=x;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
const pick=(r,n)=>Math.floor(r()*n);
function shuffle(r,list){const out=[...list];for(let i=out.length-1;i>0;i--){const j=pick(r,i+1);[out[i],out[j]]=[out[j],out[i]];}return out;}
const reverse=w=>[...w].reverse().join('');
const clash=(a,b)=>a.includes(b)||b.includes(a)||a.includes(reverse(b))||b.includes(reverse(a));
/** 100 points for three letters, 25 more for every letter after that; doubled for the golden word and the last round. */
export const huntPoints=(word,double=false)=>(100+25*(word.length-3))*(double?2:1);
/** The cells from one letter to another in a straight line (any of the eight directions), or null. */
export function huntLine(from,to,size){
 if(!Number.isInteger(size)||![from,to].every(c=>Number.isInteger(c)&&c>=0&&c<size*size)||from===to)return null;
 const r0=Math.floor(from/size),c0=from%size,r1=Math.floor(to/size),c1=to%size,dr=r1-r0,dc=c1-c0;
 if(dr&&dc&&Math.abs(dr)!==Math.abs(dc))return null;
 const n=Math.max(Math.abs(dr),Math.abs(dc)),sr=Math.sign(dr),sc=Math.sign(dc);
 return Array.from({length:n+1},(_,i)=>(r0+sr*i)*size+c0+sc*i);
}
export const huntSize=count=>count>10?9:8;
export const huntWordCount=count=>count<=4?6:count<=10?7:8;
function themeOf(m,round){const order=shuffle(rand((m.seed^0x51ed27a3)>>>0),HUNT_THEMES.map((_,i)=>i));return HUNT_THEMES[order[round%order.length]];}
/** The grid of one round: its theme, letters and placed words. */
export function huntLayout(m,round){
 const size=huntSize(m.players.length),count=huntWordCount(m.players.length),theme=themeOf(m,round),dirs=DIRS.slice(0,round===0?2:3),r=rand((m.seed+round*7919+0x2545)>>>0);
 let best=null;
 for(let attempt=0;attempt<30;attempt++){
  const grid=Array(size*size).fill(''),placed=[],pool=shuffle(r,theme.words.filter(w=>w.word.length<=size)),chosen=[];
  for(const w of pool)if(chosen.length<count&&!chosen.some(c=>clash(c.word,w.word)))chosen.push(w);
  const order=[...chosen.sort((a,b)=>b.word.length-a.word.length),...pool.filter(w=>!chosen.includes(w))];
  for(const w of order){
   if(placed.length>=count)break;if(placed.some(p=>clash(p.word,w.word)))continue;
   const len=w.word.length;let spot=null;
   for(let k=0;k<160&&!spot;k++){const [dr,dc]=dirs[pick(r,dirs.length)],row=pick(r,size-dr*(len-1)),col=pick(r,size-dc*(len-1)),cells=Array.from({length:len},(_,i)=>(row+dr*i)*size+col+dc*i);if(cells.every((c,i)=>!grid[c]||grid[c]===w.word[i])&&!placed.some(p=>p.cells.join()===cells.join()))spot=cells;}
   if(!spot)continue;spot.forEach((c,i)=>grid[c]=w.word[i]);placed.push({label:w.label,word:w.word,cells:spot});
  }
  if(!best||placed.length>best.placed.length)best={grid,placed};
  if(placed.length>=count)break;
 }
 const letters=best.placed.map(p=>p.word).join('');
 for(let c=0;c<best.grid.length;c++)if(!best.grid[c])best.grid[c]=r()<.35?letters[pick(r,letters.length)]:FILL[pick(r,FILL.length)];
 return{size,theme:theme.name,grid:best.grid,words:best.placed,golden:round<HUNT_ROUNDS-1?pick(r,best.placed.length):-1};
}
function botDelay(m,p,step){const bots=m.players.filter(x=>x.bot).length,r=rand((m.seed+m.round*131+p.slot*977+step*61)>>>0);return Math.round((9000+r()*7000)*(1+.35*Math.max(0,bots-1)));}
function startRound(m,now,round){
 const layout=huntLayout(m,round),hidden=round===HUNT_ROUNDS-1;
 m.round=round;m.phaseAt=now;
 m.hunt={round,phase:'play',size:layout.size,theme:layout.theme,grid:layout.grid,hidden,startedAt:now,deadline:now+HUNT_ROUND_MS[round],nextAt:0,hint1At:hidden?now+HUNT_HINTS_MS[0]:0,hint2At:hidden?now+HUNT_HINTS_MS[1]:0,hint1:false,hint2:false,
  words:layout.words.map((w,i)=>({label:w.label,word:w.word,cells:w.cells,golden:i===layout.golden,points:huntPoints(w.word,hidden||i===layout.golden),by:null,name:null,at:0,found:null})),
  wait:{},miss:{},recent:m.hunt?.recent||[]};
 for(const p of m.players)if(p.bot)p.nextThink=now+2500+botDelay(m,p,0);
}
function finishHunt(m,now){const best=Math.max(...m.players.map(p=>p.score));m.phase='finished';m.finishedAt=now;m.winners=m.players.filter(p=>p.score===best).map(p=>p.id);m.version++;}
function endRound(m,now){const h=m.hunt;h.endedAt=now;if(h.round>=HUNT_ROUNDS-1){h.phase='done';finishHunt(m,now);}else{h.phase='break';h.nextAt=now+HUNT_BREAK_MS;}}
export function initWordHunt(m,now){m.endsAt=now+HUNT_ROUND_MS.reduce((a,b)=>a+b,0)+HUNT_BREAK_MS*(HUNT_ROUNDS-1)+5000;for(const p of m.players){p.words=0;p.misses=0;}m.hunt=null;startRound(m,now,0);}
/** A claim is {round, from, to}: the first and the last letter of a word, either way round. */
export function applyWordHunt(m,p,a,now){
 const h=m.hunt;
 if(!h||h.phase!=='play')throw Error('الجولة الجاية بتبدأ بعد شوي');
 if(a.round!==h.round)throw Error('الشبكة تغيّرت؛ دوّر في الجديدة');
 if(now>=h.deadline)throw Error('خلص وقت الجولة');
 if(now<(h.wait[p.id]||0))throw Error('استنى ثانية بعد الاختيار الغلط');
 const cells=huntLine(a.from,a.to,h.size);
 if(!cells||cells.length<3)throw Error('اختر من أول حرف لآخر حرف بخط مستقيم');
 const text=cells.map(c=>h.grid[c]).join(''),back=reverse(text),w=h.words.find(w=>w.word===text||w.word===back);
 if(w?.by)throw Error(w.by===p.id?'لقيتها من قبل':'سبقك لها '+w.name);
 // a wrong pick holds the player for a moment, so nobody can sweep the grid
 if(!w){h.wait[p.id]=now+HUNT_MISS_MS;h.miss[p.id]={at:now,cells};p.misses=(p.misses||0)+1;p.moves++;return;}
 w.by=p.id;w.name=p.name;w.at=now;w.found=cells;p.words=(p.words||0)+1;p.moves++;p.score+=w.points;
 h.recent.push({id:p.id,name:p.name,label:w.label,points:w.points,golden:w.golden,round:h.round,at:now});if(h.recent.length>8)h.recent.shift();
 if(h.words.every(x=>x.by))endRound(m,now);
}
export function advanceWordHunt(m,now){
 const h=m.hunt;if(!h||m.phase!=='playing')return;
 if(h.phase==='play'){
  if(h.hidden&&!h.hint1&&now>=h.hint1At){h.hint1=true;m.version++;}
  if(h.hidden&&!h.hint2&&now>=h.hint2At){h.hint2=true;m.version++;}
  if(now>=h.deadline){endRound(m,now);if(m.phase==='playing')m.version++;}
 }else if(h.phase==='break'&&now>=h.nextAt){startRound(m,now,h.round+1);m.version++;}
}
export function wordHuntBot(m,p,now){
 const h=m.hunt;if(!h||h.phase!=='play'||now<(p.nextThink||0))return null;
 const open=h.words.filter(w=>!w.by);if(!open.length)return null;
 p.nextThink=now+botDelay(m,p,(p.words||0)+1+h.words.length-open.length);
 const w=open[pick(rand((m.seed+m.version*31+p.slot*7)>>>0),open.length)];
 return{round:h.round,from:w.cells[0],to:w.cells.at(-1)};
}
/** The next moment the room must act on its own: the end of the round, a hint or the next round. */
export function wordHuntAlarm(m){const h=m.hunt;if(!h)return Infinity;if(h.phase==='break')return h.nextAt;if(h.phase!=='play')return Infinity;return Math.min(h.deadline,h.hidden&&!h.hint1?h.hint1At:Infinity,h.hidden&&!h.hint2?h.hint2At:Infinity);}
/** What a player sees: never where an unfound word is, until the round is over. */
export function wordHuntView(m,id){
 const h=m.hunt;if(!h)return null;const live=h.phase==='play'&&m.phase==='playing';
 return{round:h.round,rounds:HUNT_ROUNDS,phase:m.phase==='finished'?'done':h.phase,size:h.size,grid:[...h.grid],theme:h.theme,hidden:h.hidden,startedAt:h.startedAt,deadline:h.deadline,nextAt:h.nextAt,duration:HUNT_ROUND_MS[h.round],
  words:h.words.map((w,i)=>{const open=!h.hidden||!!w.by||!live;return{i,label:open?w.label:null,length:w.word.length,mask:open?null:[...w.word].map((c,k)=>h.hint1&&k===0||h.hint2&&k===w.word.length-1?c:null),golden:w.golden,points:w.points,by:w.by,name:w.name,cells:w.by?[...w.found]:live?null:[...w.cells]};}),
  found:h.words.filter(w=>w.by).length,recent:h.recent.map(x=>({...x})),wait:h.wait[id]||0,miss:h.miss[id]?{at:h.miss[id].at,cells:[...h.miss[id].cells]}:null,misses:m.players.find(p=>p.id===id)?.misses||0};
}
/** Rooms saved before 33.5.0 hold a «قنبلة الكلمات» match: a live one starts over as a hunt. */
export function upgradeWordHunt(m,now=Date.now()){
 if(m?.game!=='wordbomb'||m.hunt)return false;
 for(const key of ['prompt','usedWords','accepted','explosions','lastExplosion','turnId','turnStartedAt','turnDuration','turnDeadline','turn'])delete m[key];
 if(m.phase==='playing'){for(const p of m.players){p.score=0;p.alive=true;delete p.hearts;delete p.eliminatedAt;}initWordHunt(m,now);}
 else{for(const p of m.players){p.words=p.words||0;p.misses=0;delete p.hearts;}startRound(m,now,0);m.hunt.phase='done';}
 m.version++;return true;
}
