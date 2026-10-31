// Deterministic rules shared by practice and authoritative rooms. No DOM or network dependencies.
export const CHALLENGES=Object.freeze({
 labyrinth:{title:'سباق المتاهة',tag:'خطوة تسبق خصمك',color:'#5de2c2',players:2},
 focus:{title:'مواجهة التركيز',tag:'فكّر بسرعة. واضغط بثقة.',color:'#f5c76e',players:4},
 cipher:{title:'شفرة الخصم',tag:'كل تلميح يقرّبك',color:'#b6a0ff',players:2},
 patterns:{title:'صائد الأنماط',tag:'عينك على العلاقة',color:'#f798b6',players:4},
 survival:{title:'ساحة البقاء',tag:'اقرأ الأرض. وابقَ واقفًا.',color:'#77c9ff',players:4}
});
export const HEROES=['fox','cat','robot','princess','fairy','astronaut','racer','diver','viking','gladiator','cyber','samurai'];
export function rng(seed=1){let x=seed>>>0;return()=>{x+=0x6D2B79F5;let t=x;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
const pick=(r,n)=>Math.floor(r()*n);
export const adjacent=(a,b,n)=>Number.isInteger(a)&&Number.isInteger(b)&&a>=0&&b>=0&&a<n*n&&b<n*n&&Math.abs(a%n-b%n)+Math.abs(Math.floor(a/n)-Math.floor(b/n))===1;
export const edge=(a,b)=>[a,b].sort((x,y)=>x-y).join(':');
export function mazePath(pos,goal,blocks,n=7){const queue=[[pos]],seen=new Set([pos]);for(let i=0;i<queue.length;i++){const path=queue[i],at=path.at(-1);if(Math.floor(at/n)===goal)return path;for(const to of [at-1,at+1,at-n,at+n])if(adjacent(at,to,n)&&!blocks.includes(edge(at,to))&&!seen.has(to)){seen.add(to);queue.push([...path,to]);}}return null;}
export function setValid(cards){return cards.length===3&&new Set(cards.map(c=>c.id)).size===3&&[0,1,2].every(k=>new Set(cards.map(c=>c.attrs[k])).size!==2);}
export function patternSet(cards){for(let a=0;a<cards.length;a++)for(let b=a+1;b<cards.length;b++)for(let c=b+1;c<cards.length;c++)if(setValid([cards[a],cards[b],cards[c]]))return[cards[a].id,cards[b].id,cards[c].id];return null;}
function cards(r){const deck=Array.from({length:27},(_,id)=>({id,attrs:[id%3,Math.floor(id/3)%3,Math.floor(id/9)]}));for(let i=deck.length-1;i>0;i--){const j=pick(r,i+1);[deck[i],deck[j]]=[deck[j],deck[i]];}const board=deck.slice(0,9);if(!patternSet(board)){const a=board[0].attrs,b=board[1].attrs,attrs=a.map((v,i)=>v===b[i]?v:3-v-b[i]);const id=attrs[0]+attrs[1]*3+attrs[2]*9;board[8]={id,attrs};}return board;}
export function cipherHint(secret,guess){let exact=0,near=0;for(let i=0;i<4;i++)if(secret[i]===guess[i])exact++;for(let d=0;d<6;d++)near+=Math.min(secret.filter(x=>x===d).length,guess.filter(x=>x===d).length);return{exact,near:near-exact};}
function focusRound(m,now,r){const type=['color','opposite','sequence','hold'][m.round%4],target=pick(r,4),sequence=Array.from({length:Math.min(5,3+Math.floor(m.round/6))},()=>pick(r,4));const opensAt=now+1500+(type==='sequence'?sequence.length*650:0);m.task={type,target,sequence,opensAt,deadline:opensAt+6500};m.answers={};m.phaseAt=now;}
function hazard(m,now,r){const n=m.board.size,round=m.round;let unsafe=[];
 // Every highlighted tile has a neighbouring refuge; the warning is generous enough for several steps.
 const axis=pick(r,2),parity=pick(r,2);for(let c=0;c<n*n;c++){const x=c%n,y=Math.floor(c/n);if((axis?x:y)%2===parity)unsafe.push(c);}
 if(round%3===2){const hole=pick(r,n);unsafe=Array.from({length:n*n},(_,i)=>i).filter(i=>i%n!==hole&&Math.floor(i/n)!==hole);}
 m.board.unsafe=unsafe;m.board.collapseAt=now+Math.max(2200,4200-round*110);m.board.recoverAt=m.board.collapseAt+650;m.board.collapsed=false;
}
export function createChallenge(game,players,seed=1,now=Date.now()){
 if(!CHALLENGES[game]||players.length<2||players.length>CHALLENGES[game].players||new Set(players.map(p=>p.id)).size!==players.length)throw Error('invalid_players');
 const m={game,seed:seed>>>0,phase:'playing',round:0,version:1,startedAt:now,endsAt:now+(game==='labyrinth'?240000:game==='cipher'?180000:game==='survival'?90000:game==='focus'?180000:100000),players:players.map((p,i)=>({id:p.id,name:p.name,hero:HEROES.includes(p.hero)?p.hero:'fox',bot:!!p.bot,score:0,alive:true,moves:0,lastMove:0,attempts:[],slot:i})),winners:[],log:[],nextBotAt:now+1200};
 const r=rng(m.seed);
 if(game==='labyrinth'){m.board={size:7,positions:[3,45],blocks:[],walls:[10,10]};m.turn=0;m.turnDeadline=now+18000;}
 if(game==='focus')focusRound(m,now,r);
 if(game==='cipher'){m.secrets=Object.fromEntries(m.players.map((p,i)=>{const secret=players[(i+1)%players.length].secret;return[p.id,Array.isArray(secret)&&secret.length===4&&secret.every(x=>Number.isInteger(x)&&x>=0&&x<6)?[...secret]:Array.from({length:4},()=>pick(r,6))];}));m.nextGuess=Object.fromEntries(m.players.map(p=>[p.id,0]));}
 if(game==='patterns'){m.board={cards:cards(r)};m.nextGuess={};}
 if(game==='survival'){m.board={size:7,positions:m.players.map((_,i)=>[16,18,30,32][i])};hazard(m,now,r);}
 return m;
}
function finish(m,now,winners){m.phase='finished';m.finishedAt=now;m.winners=winners??(()=>{const best=Math.max(...m.players.map(p=>p.score));return m.players.filter(p=>p.score===best).map(p=>p.id);})();m.version++;}
function note(m,text){m.log.push(text);if(m.log.length>5)m.log.shift();}
export function applyChallenge(m,id,action,now=Date.now()){
 if(m.phase!=='playing')throw Error('الجولة انتهت');const p=m.players.find(p=>p.id===id);if(!p)throw Error('غير مصرح');
 if(!action||typeof action!=='object'||Array.isArray(action))throw Error('حركة غير صالحة');
 const r=rng(m.seed+m.version*7919);
 if(m.game==='labyrinth'){
  if(m.turn!==p.slot)throw Error('انتظر دورك');const b=m.board,s=p.slot;
  if(action.type==='step'){const to=action.to;if(!adjacent(b.positions[s],to,b.size)||b.blocks.includes(edge(b.positions[s],to))||b.positions[1-s]===to)throw Error('اختر مربعًا مجاورًا مفتوحًا');b.positions[s]=to;p.moves++;if(Math.floor(to/7)===(s===0?6:0)){p.score=100;finish(m,now,[id]);}}
  else if(action.type==='wall'){const{a,b:to}=action;if(!adjacent(a,to,7)||b.blocks.includes(edge(a,to))||b.walls[s]<=0)throw Error('الحاجز غير متاح');const blocks=[...b.blocks,edge(a,to)];if(!mazePath(b.positions[0],6,blocks)||!mazePath(b.positions[1],0,blocks))throw Error('لا يمكن إغلاق كل الطرق');b.blocks=blocks;b.walls[s]--;note(m,p.name+' وضع حاجزًا');}
  else throw Error('حركة غير صالحة');m.turn=1-m.turn;m.turnDeadline=now+18000;
 }
 if(m.game==='focus'){
  const t=m.task;if(action.round!==m.round)throw Error('الجولة تغيّرت');if(now<t.opensAt)throw Error('انتظر الإشارة');if(now>=t.deadline)throw Error('انتهى وقت السؤال');if(m.answers[id])throw Error('تم تسجيل إجابتك');
  let correct=false;if(t.type==='sequence'){if(!Array.isArray(action.values)||action.values.length!==t.sequence.length||action.values.some(v=>!Number.isInteger(v)||v<0||v>3))throw Error('أكمل التسلسل');correct=action.values.every((v,i)=>v===t.sequence[i]);}
  else{if(!Number.isInteger(action.choice)||action.choice<0||action.choice>3)throw Error('إجابة غير صالحة');correct=t.type==='hold'?false:action.choice===(t.type==='opposite'?(t.target+2)%4:t.target);}
  const gain=correct?100+Math.floor(Math.max(0,t.deadline-now)/100):-40;p.score+=gain;m.answers[id]={correct,gain};
 }
 if(m.game==='cipher'){
  if(p.solvedAt||p.attempts.length>=10)throw Error('اكتملت محاولاتك');if(now<m.nextGuess[id])throw Error('تمهّل قليلًا');const g=action.guess;if(!Array.isArray(g)||g.length!==4||g.some(v=>!Number.isInteger(v)||v<0||v>5))throw Error('اختر أربعة رموز');
  const hint=cipherHint(m.secrets[id],g);p.attempts.push({guess:[...g],...hint});m.nextGuess[id]=now+700;p.score=hint.exact*10+hint.near;
  if(hint.exact===4){p.solvedAt=now;p.score=1000-p.attempts.length*40;}
  if(m.players.every(x=>x.solvedAt||x.attempts.length>=10))finish(m,now,cipherWinners(m));
 }
 if(m.game==='patterns'){
  if(action.round!==m.round)throw Error('تغيّرت البطاقات');if(now<(m.nextGuess[id]||0))throw Error('انتظر قليلًا قبل المحاولة');const ids=action.cards;if(!Array.isArray(ids)||ids.length!==3||new Set(ids).size!==3||ids.some(x=>!m.board.cards.some(c=>c.id===x)))throw Error('اختر ثلاث بطاقات');
  const chosen=ids.map(id=>m.board.cards.find(c=>c.id===id));if(setValid(chosen)){p.score+=100;m.round++;m.board.cards=cards(r);note(m,p.name+' اكتشف النمط');if(m.round>=12)finish(m,now);}else{p.score-=25;m.nextGuess[id]=now+1400;note(m,p.name+' خسر 25 نقطة');}
 }
 if(m.game==='survival'){
  if(!p.alive)throw Error('أنت تشاهد الجولة');if(now-p.lastMove<180)throw Error('تمهّل قليلًا');const to=action.to,b=m.board;if(!adjacent(b.positions[p.slot],to,b.size)||b.collapsed&&b.unsafe.includes(to))throw Error('هذا المربع غير متاح');b.positions[p.slot]=to;p.lastMove=now;p.moves++;
 }
 m.version++;return m;
}
function cipherWinners(m){const solved=m.players.filter(p=>p.solvedAt).sort((a,b)=>a.attempts.length-b.attempts.length||a.solvedAt-b.solvedAt);return solved.length?[solved[0].id]:[];}
export function advanceChallenge(m,now=Date.now()){
 if(m.phase!=='playing')return m;
 if(now>=m.endsAt){if(m.game==='cipher')finish(m,now,cipherWinners(m));else if(m.game==='survival')finish(m,now,m.players.filter(p=>p.alive).map(p=>p.id));else if(m.game==='labyrinth'){const d=m.players.map((p,i)=>mazePath(m.board.positions[i],i===0?6:0,m.board.blocks)?.length??999);finish(m,now,d[0]===d[1]?m.players.map(p=>p.id):[m.players[d[0]<d[1]?0:1].id]);}else finish(m,now);return m;}
 const r=rng(m.seed+m.round*3571+m.version);
 if(m.game==='labyrinth'&&now>=m.turnDeadline){note(m,'انتهى وقت الدور');m.turn=1-m.turn;m.turnDeadline=now+18000;m.version++;}
 if(m.game==='focus'&&now>=m.task.deadline){if(m.task.type==='hold')for(const p of m.players)if(!m.answers[p.id])p.score+=100;m.round++;if(m.round>=12)finish(m,now);else focusRound(m,now+700,r);m.version++;}
 if(m.game==='survival'){
  const b=m.board;if(!b.collapsed&&now>=b.collapseAt){b.collapsed=true;for(const p of m.players)if(p.alive){if(b.unsafe.includes(b.positions[p.slot])){p.alive=false;p.eliminatedAt=now;}else p.score+=100;}m.version++;const alive=m.players.filter(p=>p.alive);if(alive.length<=1){const survivors=alive.length?alive.map(p=>p.id):m.players.filter(p=>p.eliminatedAt===now).map(p=>p.id);finish(m,now,survivors);}}
  if(m.phase==='playing'&&b.collapsed&&now>=b.recoverAt){m.round++;hazard(m,now,r);m.version++;}
 }
 if(m.phase==='playing'&&now>=m.nextBotAt){m.nextBotAt=now+(m.game==='survival'?480:1100);for(const p of m.players.filter(p=>p.bot&&p.alive)){try{const a=botAction(m,p.id,now);if(a)applyChallenge(m,p.id,a,now);}catch{}}}
 return m;
}
export function botAction(m,id,now=Date.now()){
 const p=m.players.find(p=>p.id===id),r=rng(m.seed+m.version*71+p.slot*19);if(m.phase!=='playing')return null;
 if(m.game==='labyrinth'){if(m.turn!==p.slot)return null;const path=mazePath(m.board.positions[p.slot],p.slot===0?6:0,m.board.blocks);
  const other=1-p.slot,otherGoal=other===0?6:0,op=mazePath(m.board.positions[other],otherGoal,m.board.blocks);
  if(m.board.walls[p.slot]>0&&r()<.65&&op?.length>2){let best=null,bestGain=0;for(let i=0;i<Math.min(op.length-1,5);i++){const a=op[i],b=op[i+1],blocks=[...m.board.blocks,edge(a,b)],mine=mazePath(m.board.positions[p.slot],p.slot===0?6:0,blocks),theirs=mazePath(m.board.positions[other],otherGoal,blocks);if(!mine||!theirs)continue;const gain=theirs.length-op.length-(mine.length-path.length)*1.5;if(gain>bestGain){bestGain=gain;best={type:'wall',a,b};}}if(best)return best;}
  if(path?.[1]!==m.board.positions[1-p.slot])return{type:'step',to:path[1]};const alt=[-7,7,-1,1].map(d=>m.board.positions[p.slot]+d).filter(to=>adjacent(to,m.board.positions[p.slot],7)&&to!==m.board.positions[1-p.slot]&&!m.board.blocks.includes(edge(to,m.board.positions[p.slot])));return alt.length?{type:'step',to:alt[pick(r,alt.length)]}:null;}
 if(m.game==='focus'){if(now<m.task.opensAt+650||m.answers[id]||m.task.type==='hold')return null;return m.task.type==='sequence'?{round:m.round,values:m.task.sequence.map(v=>r()<.86?v:pick(r,4))}:{round:m.round,choice:r()<.78?(m.task.type==='opposite'?(m.task.target+2)%4:m.task.target):pick(r,4)};}
 if(m.game==='cipher'){if(p.solvedAt||now<(p.nextThink||0)||p.attempts.length>=10)return null;p.nextThink=now+3500;const candidates=[];for(let code=0;code<1296;code++){const g=[code%6,Math.floor(code/6)%6,Math.floor(code/36)%6,Math.floor(code/216)];if(p.attempts.every(a=>{const h=cipherHint(g,a.guess);return h.exact===a.exact&&h.near===a.near;}))candidates.push(g);}return{guess:candidates[pick(r,candidates.length)]};}
 if(m.game==='patterns'){if(now<(p.nextThink||0))return null;p.nextThink=now+3500+pick(r,2000);return{round:m.round,cards:patternSet(m.board.cards)};}
 if(m.game==='survival'){const b=m.board,start=b.positions[p.slot];if(!b.unsafe.includes(start))return null;const queue=[[start]],seen=new Set([start]);for(let i=0;i<queue.length;i++){const path=queue[i],at=path.at(-1);if(!b.unsafe.includes(at))return{to:path[1]};for(const to of [at-7,at+7,at-1,at+1])if(adjacent(at,to,7)&&!seen.has(to)){seen.add(to);queue.push([...path,to]);}}}
 return null;
}
export function challengeView(m,id,now=Date.now()){
 const p=m.players.find(p=>p.id===id);if(!p)throw Error('forbidden');const view={game:m.game,phase:m.phase,round:m.round,version:m.version,startedAt:m.startedAt,endsAt:m.endsAt,serverNow:now,winners:m.winners,log:m.log,turn:m.turn,turnDeadline:m.turnDeadline,board:m.board?structuredClone(m.board):null,players:m.players.map(x=>({id:x.id,name:x.name,hero:x.hero,bot:x.bot,score:x.score,alive:x.alive,moves:x.moves,slot:x.slot,solved:!!x.solvedAt,attemptCount:x.attempts.length})),me:{id,slot:p.slot,attempts:structuredClone(p.attempts),answered:!!m.answers?.[id],nextGuess:m.nextGuess?.[id]||0}};
 if(m.game==='focus'){view.task={...m.task};if(now>=m.task.opensAt||m.phase==='finished')delete view.task.sequence;view.me.answer=m.answers[id]||null;}
 if(m.game==='cipher'&&m.phase==='finished')view.me.secret=m.secrets[id];return view;
}
export function nextChallengeAlarm(m,now=Date.now()){
 if(m.phase!=='playing')return now+60000;const times=[m.endsAt];if(m.players.some(p=>p.bot))times.push(m.nextBotAt);if(m.game==='focus')times.push(m.task.deadline);if(m.game==='labyrinth')times.push(m.turnDeadline);if(m.game==='survival')times.push(m.board.collapsed?m.board.recoverAt:m.board.collapseAt);return Math.max(now+10,Math.min(...times));
}
