import {PARTY_CAPACITY,PARTY_COUNTDOWN_MS,PARTY_BREAK_MS,partyGame,normalizePlaylist,playlistCapacity} from '../../public/assets/js/engines/party-catalog-v29.js';
import {CATEGORIES} from '../questions.js';
import {createSudoku,moveSudoku} from '../../public/assets/js/engines/sudoku-engine.js';
import {solveSudoku,SUDOKU_PEERS} from '../../public/assets/js/engines/sudoku-core.js';
import {createStrictPaths,moveStrictPaths} from '../../public/assets/js/engines/paths-v20.js';
import {createMatch3,moveMatch3} from '../../public/assets/js/engines/match3-engine.js';
import {createImageAssembly,placeImageTile,imageProgress,PICTURE_THEMES} from '../../public/assets/js/engines/image-puzzle.js';
import {shuffled,generatePuzzle,movePuzzle,memoryPair,logicQuestion} from '../../public/assets/js/engines/arcade-engine.js';
import {createSnakesServerGame,rollSnakesServer} from '../games/snakes-server.js';
import {createLudoGame,getLegalLudoMoves,applyLudoMove,passLudoTurn} from '../../public/assets/js/engines/ludo-engine.js';
import {createJackarooGame,getJackarooActions,playJackarooAction} from '../../public/assets/js/engines/jackaroo-engine.js';
import {createRaceDiceGame,rollRaceDice,bankRaceDice} from '../../public/assets/js/engines/dice-engine.js';
import {createSerpentGame,steerSerpent,stepSerpent,serpentSnapshot} from '../../public/assets/js/engines/serpent-engine.js';

export const PARTY_VERSION=29;
export const partyName=value=>String(value||'لاعب').normalize('NFKC').replace(/[<>\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,'').trim().slice(0,24)||'لاعب';
export function seeded(seed=1){return()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};}
const clone=value=>structuredClone(value),sum=rows=>rows.reduce((a,b)=>a+b,0);
const uuid=()=>crypto.randomUUID();
export function createParty({code,hostKey,capacity=20,playlist=['quiz','memory'],now=Date.now()}={}){
 if(!/^\d{6}$/.test(code||'')||typeof hostKey!=='string'||hostKey.length<32||!Number.isInteger(capacity)||capacity<1||capacity>PARTY_CAPACITY)throw Error('إعدادات الغرفة غير صالحة');
 return{format:PARTY_VERSION,id:uuid(),code,hostKey,capacity:Math.min(capacity,playlistCapacity(normalizePlaylist(playlist))),playlist:normalizePlaylist(playlist),playlistRevision:1,status:'lobby',order:[],players:{},cursor:-1,history:[],sessionId:uuid(),revision:0,round:null,createdAt:now,updatedAt:now,expiresAt:now+24*3600000};
}
export function addPartyPlayer(room,{name,username=null,now=Date.now()}={}){
 if(room.status!=='lobby')throw Error('القائمة بدأت؛ العودة متاحة للمشاركين أنفسهم');
 if(room.order.length>=room.capacity)throw Error('الغرفة ممتلئة');
 if(username&&room.order.some(id=>room.players[id].username===username))throw Error('الحساب موجود في الغرفة');
 const p={id:uuid(),token:uuid()+uuid(),name:partyName(name),username,role:room.order.length?'guest':'host',joinedAt:now,ready:false,connected:true,score:0,wins:0,seq:0,actions:0,disconnectedAt:null};
 room.players[p.id]=p;room.order.push(p.id);return p;
}
export function partyRanking(room){
 const rows=room.order.map(id=>room.players[id]).sort((a,b)=>b.score-a.score||b.wins-a.wins||a.joinedAt-b.joinedAt||a.id.localeCompare(b.id));let last=null,rank=0;
 return rows.map((p,i)=>{const key=p.score+':'+p.wins;if(last!==key)rank=i+1;last=key;return{id:p.id,name:p.name,role:p.role,ready:p.ready,connected:p.connected,score:p.score,wins:p.wins,rank,rounds:room.history.filter(h=>h.rows.some(r=>r.id===p.id)).length};});
}
function choices(q,category,random){const wrong=[...new Set([...(q.distractors||[]),...shuffled(category.questions,random).map(x=>x.a)].filter(a=>a!==q.a))].slice(0,3);const options=shuffled([q.a,...wrong],random);return{...q,options,correctIndex:options.indexOf(q.a)};}
function quizPack(game,seed){const random=seeded(seed);
 if(game==='logic')return Array.from({length:8},(_,i)=>{const q=logicQuestion(i,random);return{id:'logic:'+i,q:'ما العدد التالي؟ '+q.sequence.join('، '),a:String(q.answer),options:q.options.map(String),correctIndex:q.options.indexOf(q.answer),explanation:q.explanation};});
 const categories=shuffled(CATEGORIES,random),out=[];for(let i=0;i<8;i++){const cat=categories[i%categories.length],q=shuffled(cat.questions,random)[0];out.push({...choices(q,cat,random),category:cat.name});}return out;
}
function resetQuizQuestion(r,now){r.questionStartedAt=now;r.answerOpensAt=now+(r.questions[r.questionIndex]?.media==='memory'?Math.min(8000,Math.max(2500,r.questions[r.questionIndex].memory?.previewMs||4500)):0);r.questionDeadline=Math.min(r.deadline,r.answerOpensAt+Math.max(7000,Math.floor(r.settings.duration*1000/r.questions.length)-2500));r.revealUntil=0;for(const p of Object.values(r.participants)){p.choice=null;p.listenCount=0;}}
function tableGroups(room,r,random){
 const ids=shuffled(room.roster,random),count=1,groups=Array.from({length:count},()=>[]);ids.forEach((id,i)=>groups[i%count].push(id));
 return groups.map((members,index)=>{const min=r.game==='jackaroo'?(members.length>4?6:4):2;while(members.length<min)members.push('bot:'+index+':'+members.length);const names=members.map((id,i)=>room.players[id]?.name||'بوت '+(i+1));let state;
  if(r.game==='jackaroo')state=createJackarooGame(names,{rng:random});else if(r.game==='zahra')state=createLudoGame(names);else if(r.game==='dice')state=createRaceDiceGame(names,40);else state=createSnakesServerGame(names,{variant:'adventure'});
  return{id:index,members,state,pendingRoll:null,turnDeadline:r.startedAt+20000,finished:false,actions:0};});
}
export function startPartyRound(room,now=Date.now(),seed=crypto.getRandomValues(new Uint32Array(1))[0]){
 room.cursor++;if(room.cursor>=room.playlist.length){room.status='finished';room.round=null;room.finishedAt=now;return;}
 const settings=room.playlist[room.cursor],game=settings.game,random=seeded(seed),r={id:uuid(),game,settings:clone(settings),seed,startedAt:now,deadline:now+settings.duration*1000,participants:{},events:[],revision:0};
 room.round=r;room.status='playing';for(const id of room.roster){r.participants[id]={id,seq:0,actions:0,score:0,progress:0,done:false,won:false,mistakes:0,faults:0};room.players[id].seq=0;}
 const level=1+(settings.difficulty-1)*24+seed%12;
 if(game==='sudoku'){const board=createSudoku(Math.min(120,level));r.solution=solveSudoku(board.initial).solution;if(!r.solution)throw Error('تعذر تجهيز سودوكو');for(const p of Object.values(r.participants))p.state=clone(board);}
 else if(['paths','paths-online'].includes(game)){const board=createStrictPaths(Math.min(120,level));for(const p of Object.values(r.participants))p.state=clone(board);}
 else if(game==='jewels'){const board=createMatch3(Math.min(60,1+(settings.difficulty-1)*12+seed%6));for(const p of Object.values(r.participants))p.state=clone(board);}
 else if(game==='picture'){r.size=settings.difficulty<=2?3:settings.difficulty===3?4:5;r.image=PICTURE_THEMES[seed%PICTURE_THEMES.length].src;const board=createImageAssembly(r.size,seed);for(const p of Object.values(r.participants))Object.assign(p,{board:[...board.board],tray:[...board.tray]});}
 else if(game==='memory'){const pairs=settings.difficulty>=4?12:8;r.columns=pairs===12?6:4;const deck=shuffled(Array.from({length:pairs*2},(_,i)=>Math.floor(i/2)),random);for(const p of Object.values(r.participants))p.state={deck:[...deck],open:[],matched:[],moves:0,active:true,locked:false};}
 else if(game==='puzzle'){const tiles=generatePuzzle(random,30+settings.difficulty*40);for(const p of Object.values(r.participants))p.tiles=[...tiles];}
 else if(['quiz','logic'].includes(game)){r.questions=quizPack(game,seed);r.questionIndex=0;resetQuizQuestion(r,now);}
 else if(game==='reaction'){r.trial=0;r.trials=5;r.signal='wait';r.signalAt=now+1500+Math.floor(random()*2200);r.signalDeadline=r.signalAt+5000;for(const p of Object.values(r.participants)){p.times=[];p.trialChoice=null;}}
 else if(partyGame(game).kind==='board'){r.tables=tableGroups(room,r,random);}
 else if(game==='serpent'){r.arena=createSerpentGame(room.roster.map(id=>({id,name:room.players[id].name,skin:room.players[id].skin||'snake-wild'})),{seed,worldId:settings.worldId,collisionMode:'arena-v23',duration:settings.duration,difficulty:'medium'});r.lastSimulationAt=now;r.stepCarry=0;}
 for(const p of Object.values(r.participants)){p.updatedAt=now;p.finishedAt=0;}
}
const completed=(p,now,won=true)=>{p.done=true;p.won=won;p.finishedAt=now;};
function requireActionIndex(value,max){if(!Number.isInteger(value)||value<0||value>=max)throw Error('اختيار غير صالح');return value;}
export function applyPartyAction(room,id,message,now=Date.now()){
 const r=room.round,p=r?.participants[id];if(room.status!=='playing'||!p||message.sessionId!==room.sessionId||message.roundId!==r.id)throw Error('تغيرت اللعبة؛ جار تحديث الغرفة');
 if(now>=r.deadline)throw Error('انتهى وقت اللعبة');
 if(!Number.isInteger(message.seq)||message.seq<1||message.seq>6000)throw Error('تسلسل الحركة غير صالح');
 if(message.seq<=p.seq)return{duplicate:true,privateIds:[id]};if(message.seq!==p.seq+1)throw Error('انتظر وصول الحركة السابقة');
 const action=message.action;if(!action||typeof action!=='object'||Array.isArray(action))throw Error('حركة غير صالحة');
 if(p.done)throw Error('اكتملت نتيجتك؛ تابع أصحابك من الترتيب');
 const game=r.game;let feedback='move';
 if(game==='sudoku'){
  const cell=requireActionIndex(action.cell,81),value=requireActionIndex(action.value,10);if(p.state.initial[cell]||p.state.board[cell]===value)throw Error('اختر خانة قابلة للتعديل');
  if(value&&SUDOKU_PEERS[cell].some(i=>p.state.board[i]===value)){p.mistakes++;feedback='wrong';}
  else{const result=moveSudoku(p.state,{cell,value});if(!result.accepted)throw Error('لا يمكن تنفيذ الإدخال');p.state=result.state;if(value&&r.solution[cell]!==value){p.mistakes++;feedback='wrong';}else feedback=value?'correct':'move';}
  p.progress=p.state.board.reduce((n,v,i)=>n+(!p.state.initial[i]&&v===r.solution[i]?1:0),0)/p.state.initial.filter(v=>!v).length;p.score=Math.floor(p.progress*10000);if(p.progress===1)completed(p,now);else if(p.mistakes>=5)completed(p,now,false);p.state.log=[];p.state.history=[];
 }else if(['paths','paths-online'].includes(game)){
  const base=p.state;if(action.reset===true){p.state=createStrictPaths(base.level);p.faults++;feedback='wrong';}
  else if(Number.isInteger(action.clear)){if(!base.paths[action.clear])throw Error('اختر مسارًا موصولًا');delete base.paths[action.clear];}
  else{if(!Array.isArray(action.path)||action.path.length>81)throw Error('مسار غير صالح');const result=moveStrictPaths(base,action.color,action.path);if(!result.accepted){p.state=createStrictPaths(base.level);p.faults++;feedback='wrong';}else{p.state=result.state;feedback='correct';}}
  p.state.log=[];p.progress=new Set(Object.values(p.state.paths).flat()).size/(p.state.size*p.state.size-p.state.walls.length);p.score=Math.floor(p.progress*10000);if(p.state.won)completed(p,now);
 }else if(game==='jewels'){
  const result=moveMatch3(p.state,action,{events:false});if(!result.accepted)throw Error('بدّل قطعتين متجاورتين تصنعان تطابقًا');p.state=result.state;p.state.log=[];p.progress=Math.min(1,Math.min(p.state.collected/p.state.goal,p.state.colorCount/p.state.colorGoal,p.state.iceGoal?p.state.iceCleared/p.state.iceGoal:1));p.score=p.state.score;if(p.state.over)completed(p,now,p.state.won);feedback='correct';
 }else if(game==='picture'){
  const next=placeImageTile(p.board,action.piece,action.cell);p.board=next;p.progress=imageProgress(next)/next.length;p.score=Math.floor(p.progress*10000);if(p.progress===1)completed(p,now);feedback='correct';
 }else if(game==='memory'){
  const previousMatches=p.state.matched.length,result=memoryPair(p.state,requireActionIndex(action.cell,p.state.deck.length));if(!result.accepted)throw Error('انتظر إغلاق البطاقتين أو اختر بطاقة أخرى');p.state=result;p.progress=result.matched.length/result.deck.length;p.score=Math.floor(p.progress*10000);if(result.locked){p.unlockAt=now+900;feedback='wrong';}else feedback=result.matched.length>previousMatches?'correct':'flip';if(result.won)completed(p,now);
 }else if(game==='puzzle'){
  const result=movePuzzle(p.tiles,requireActionIndex(action.cell,9));if(!result.moved)throw Error('حرّك رقمًا بجانب الفراغ');p.tiles=result.tiles;p.progress=p.tiles.filter((v,i)=>v&&v===i+1).length/8;p.score=Math.floor(p.progress*10000);if(result.solved)completed(p,now);feedback='move';
 }else if(['quiz','logic'].includes(game)){
  if(message.questionIndex!==r.questionIndex||r.revealUntil||now<r.answerOpensAt||now>=r.questionDeadline)throw Error('انتظر وقت الإجابة أو السؤال التالي');
  const q=r.questions[r.questionIndex];
  if(action.listen===true){if(q.media!=='sound'||p.listenCount>=2)throw Error('انتهت مرات الاستماع');p.listenCount++;feedback='silent';}
  else{if(p.choice!==null)throw Error('سبق تسجيل إجابتك');const choice=requireActionIndex(action.choice,q.options.length);p.choice=choice;const correct=choice===q.correctIndex;if(correct)p.score+=100+Math.max(0,Math.floor((r.questionDeadline-now)/(r.questionDeadline-r.answerOpensAt)*25));p.correct=(p.correct||0)+(correct?1:0);p.progress=(r.questionIndex+1)/r.questions.length;feedback='locked';}
 }else if(game==='reaction'){
  if(message.trial!==r.trial||p.trialChoice!==null)throw Error('وصلت محاولة جديدة أو سبق تسجيل ضغطتك');p.trialChoice=now;const elapsed=now-r.signalAt;if(r.signal!=='green'||elapsed<0){p.times.push(6000);feedback='wrong';}else{p.times.push(Math.min(6000,elapsed));feedback='correct';}p.progress=p.times.length/r.trials;p.score=Math.floor(sum(p.times.map(t=>Math.max(0,6000-t)))/r.trials);
 }else if(partyGame(game).kind==='board'){
  const table=r.tables.find(t=>t.members.includes(id));if(!table||table.finished||table.members[table.state.turn]!==id)throw Error('الدور عند لاعب آخر');applyTableAction(room,r,table,action,now);feedback=action.roll?'dice':'move';
 }else throw Error('نوع الحركة غير متاح');
 p.seq=message.seq;p.actions++;p.updatedAt=now;r.revision++;return{feedback,privateIds:[id]};
}
function tableProgress(r,t,seat){const s=t.state,player=s.players[seat];if(r.game==='jackaroo')return sum(player.marbles.map(x=>Math.max(0,x)))/(4*(s.players.length>4?82:56));if(r.game==='zahra')return sum(player.tokens.map(x=>Math.max(0,x)))/(4*(s.players.length>4?82:56));if(r.game==='dice')return Math.min(1,player.score/s.target);return player.position/100;}
function updateTableParticipants(room,r,t,now){
 const s=t.state,finished=r.game==='jackaroo'?s.winnerTeam!==null:s.winner!==null;t.finished=finished;
 t.members.forEach((id,seat)=>{const p=r.participants[id];if(!p)return;p.progress=tableProgress(r,t,seat);const winner=finished&&(r.game==='jackaroo'?seat%2===s.winnerTeam:seat===s.winner);p.score=winner?10000:Math.floor(p.progress*9000);if(finished)completed(p,now,winner);});
}
function applyTableAction(room,r,t,action,now,automatic=false){
 const s=t.state,seat=s.turn;let next;
 if(r.game==='jackaroo'){const card=requireActionIndex(action.card,s.hands[seat].length),legal=getJackarooActions(s,card);const index=requireActionIndex(action.option,legal.length);next=playJackarooAction(s,card,legal[index],seat);}
 else if(r.game==='zahra'){
  if(action.roll===true){if(t.pendingRoll!==null)throw Error('اختر حجرًا أولًا');const roll=1+Math.floor(secureRandom()*6),legal=getLegalLudoMoves(s,roll);if(legal.length){t.pendingRoll=roll;t.turnDeadline=now+15000;t.actions++;return;}next=passLudoTurn(s,roll);}
  else{if(t.pendingRoll===null)throw Error('ارم النرد أولًا');next=applyLudoMove(s,action.token,t.pendingRoll);t.pendingRoll=null;}
 }else if(r.game==='dice'){if(action.bank===true){if(s.turnTotal<1)throw Error('ارم النرد قبل التثبيت');next=bankRaceDice(s);}else if(action.roll===true)next=rollRaceDice(s,1+Math.floor(secureRandom()*6));else throw Error('اختر رمية أو تثبيت');next.history=next.history.slice(-30);}
 else{if(action.roll!==true)throw Error('ارم النرد');next=rollSnakesServer(s,seat,secureRandom).state;}
 t.state=next;t.actions++;t.turnDeadline=now+20000;updateTableParticipants(room,r,t,now);
 if(!automatic&&r.participants[t.members[seat]])r.participants[t.members[seat]].boardMoves=(r.participants[t.members[seat]].boardMoves||0)+1;
}
function secureRandom(){return crypto.getRandomValues(new Uint32Array(1))[0]/4294967296;}
function automaticTable(room,r,t,now){
 const s=t.state,seat=s.turn,id=t.members[seat],bot=id.startsWith('bot:'),offline=!room.players[id]?.connected;
 if(!bot&&now<t.turnDeadline&&(!offline||now<(room.players[id]?.disconnectedAt||now)+10000))return false;
 let action;
 if(r.game==='jackaroo'){const cards=s.hands[seat].map((_,i)=>({card:i,legal:getJackarooActions(s,i)})),best=cards.find(x=>x.legal.some(a=>a.type==='enter'))||cards.find(x=>x.legal.some(a=>a.type!=='discard'))||cards[0];if(!best)return false;action={card:best.card,option:Math.max(0,best.legal.findIndex(a=>a.type==='enter'))};}
 else if(r.game==='zahra')action=t.pendingRoll===null?{roll:true}:{token:getLegalLudoMoves(s,t.pendingRoll)[0]};
 else action=r.game==='dice'&&s.turnTotal>=12?{bank:true}:{roll:true};
 applyTableAction(room,r,t,action,now,true);return true;
}
function roundRows(room,r,now){
 if(r.game==='serpent')for(const snake of r.arena.snakes){const p=r.participants[snake.id];if(p){p.score=Math.floor(snake.score||0);p.progress=snake.alive?1:0;p.won=r.arena.winners?.includes(snake.id)||false;p.done=true;p.finishedAt=snake.alive?now:(snake.diedAt||now);}}
 const rows=room.roster.map(id=>{const p=r.participants[id];return{id,name:room.players[id].name,won:p.won,score:p.score||0,progress:p.progress||0,actions:p.actions||0,mistakes:p.mistakes||0,faults:p.faults||0,finishedAt:p.finishedAt||0};});
 const comparison=(a,b)=>Number(b.won)-Number(a.won)||b.score-a.score||(a.won&&b.won?(a.finishedAt||now)-(b.finishedAt||now):0)||a.mistakes-b.mistakes||a.faults-b.faults;
 rows.sort((a,b)=>comparison(a,b)||room.roster.indexOf(a.id)-room.roster.indexOf(b.id));let rank=0,prior=null;
 return rows.map((row,i)=>{if(!prior||comparison(row,prior)!==0)rank=i+1;prior=row;return{...row,rank,points:row.actions>0&&row.score>0?Math.max(1,21-rank):0};});
}
export function finishPartyRound(room,now=Date.now(),aborted=false){
 const r=room.round;if(room.status!=='playing'||!r||room.history.some(h=>h.id===r.id))return false;
 const rows=roundRows(room,r,now);if(aborted)for(const p of rows)p.points=0;
 for(const row of rows){const p=room.players[row.id];p.score+=row.points;if(!aborted&&row.rank===1&&row.points>0)p.wins++;}
 room.history.push({id:r.id,game:r.game,name:partyGame(r.game).name,rows,aborted,finishedAt:now});room.status='intermission';room.nextAt=now+PARTY_BREAK_MS;r.finishedAt=now;return true;
}
export function advanceParty(room,now=Date.now()){
 let full=false,changed=false;const privateIds=new Set();
 if(room.status==='countdown'&&now>=room.startsAt){startPartyRound(room,room.startsAt);full=changed=true;}
 if(room.status==='intermission'&&now>=room.nextAt){startPartyRound(room,Math.max(room.nextAt,now));full=changed=true;}
 if(room.status!=='playing')return{changed,full,privateIds:[...privateIds]};
 const r=room.round;
 if(r.game==='serpent'){
  const elapsed=Math.max(0,Math.min(200,now-r.lastSimulationAt));r.lastSimulationAt=now;r.stepCarry=Math.min(200,r.stepCarry+elapsed);const count=Math.floor(r.stepCarry/50);r.stepCarry-=count*50;
  for(let i=0;i<count&&r.arena.status==='playing';i++)stepSerpent(r.arena,.05);changed=changed||count>0;
  for(const s of r.arena.snakes){const p=r.participants[s.id];if(p){p.score=Math.floor(s.score||0);p.progress=s.alive?1:0;}}
  if(r.arena.status==='finished'){finishPartyRound(room,now);full=changed=true;}
 }else if(['quiz','logic'].includes(r.game)){
  if(now>=r.answerOpensAt&&r.answerOpened!==r.questionIndex){r.answerOpened=r.questionIndex;full=changed=true;}
  const answered=Object.values(r.participants).every(p=>p.choice!==null);
  if(!r.revealUntil&&(now>=r.questionDeadline||answered)){r.revealUntil=now+2500;full=changed=true;}
  if(r.revealUntil&&now>=r.revealUntil){r.questionIndex++;if(r.questionIndex>=r.questions.length){for(const p of Object.values(r.participants))completed(p,now,p.score>0);finishPartyRound(room,now);}else resetQuizQuestion(r,now);full=changed=true;}
 }else if(r.game==='reaction'){
  if(r.signal==='wait'&&now>=r.signalAt){r.signal='green';r.signalAt=now;r.signalDeadline=now+5000;full=changed=true;}
  if(now>=r.signalDeadline||Object.values(r.participants).every(p=>p.trialChoice!==null)){
   for(const p of Object.values(r.participants))if(p.trialChoice===null)p.times.push(6000);
   r.trial++;if(r.trial>=r.trials){for(const p of Object.values(r.participants)){p.score=Math.floor(sum(p.times.map(t=>Math.max(0,6000-t)))/r.trials);completed(p,now,p.score>0);}finishPartyRound(room,now);}else{r.signal='wait';r.signalAt=now+1500+Math.floor(secureRandom()*2200);r.signalDeadline=r.signalAt+5000;for(const p of Object.values(r.participants))p.trialChoice=null;}full=changed=true;
  }
 }else if(r.tables){for(const t of r.tables)if(!t.finished){if(t.members[t.state.turn].startsWith('bot:')&&now<(t.botAt||0))continue;if(automaticTable(room,r,t,now)){t.botAt=now+650;full=changed=true;}}}
 else if(r.game==='memory')for(const p of Object.values(r.participants))if(p.unlockAt&&now>=p.unlockAt){p.state.open=[];p.state.locked=false;p.unlockAt=0;privateIds.add(p.id);changed=true;}
 if(room.status==='playing'&&(now>=r.deadline||Object.values(r.participants).every(p=>p.done))){finishPartyRound(room,now);full=changed=true;}
 return{changed,full,privateIds:[...privateIds]};
}
export function configureParty(room,id,message,now=Date.now()){
 const p=room.players[id];if(!p)throw Error('المقعد غير موجود');
 if(message.type==='ready'){
  if(!['lobby','countdown'].includes(room.status))throw Error('الاستعداد متاح قبل البداية');p.ready=message.ready===true;if(!p.ready&&room.status==='countdown'){room.status='lobby';room.startsAt=0;}return;
 }
 if(p.role!=='host')throw Error('هذا الخيار للمضيف فقط');
 if(message.type==='remove'){
  const target=room.players[message.playerId];
  if(room.status!=='lobby'||!target||target.id===id||target.connected)throw Error('يمكن إخلاء مقعد لاعب منقطع في اللوبي فقط');
  room.order=room.order.filter(key=>key!==target.id);delete room.players[target.id];if(room.roster)room.roster=room.roster.filter(key=>key!==target.id);return;
 }
 if(message.type==='playlist'){
  if(message.playlistRevision!==room.playlistRevision)throw Error('تغيرت القائمة؛ أعد تحميلها');const rows=normalizePlaylist(message.playlist);if(room.order.length>playlistCapacity(rows))throw Error('الجاكارو والزهرة حدهم 6 لاعبين؛ عدد الغرفة الحالي أكبر');
  if(room.status==='lobby'||room.status==='finished')room.playlist=rows;else{const prefix=room.playlist.slice(0,room.cursor+1);if(prefix.length+rows.length>20)throw Error('حد القائمة 20 لعبة');room.playlist=[...prefix,...rows];}
  room.capacity=Math.min(room.capacity,playlistCapacity(room.playlist.slice(Math.max(0,room.cursor+1))));room.playlistRevision++;if(room.status==='lobby')for(const x of Object.values(room.players))x.ready=false;return;
 }
 if(message.type==='capacity'){
  if(room.status!=='lobby'||!Number.isInteger(message.capacity)||message.capacity<room.order.length||message.capacity>playlistCapacity(room.playlist))throw Error('اختر سعة تستوعب المشاركين حتى 20');room.capacity=message.capacity;return;
 }
 if(message.type==='start'){
  if(room.status!=='lobby')throw Error('المنافسة بدأت');if(!room.order.length||!room.order.every(key=>room.players[key].connected&&room.players[key].ready))throw Error('انتظر اتصال واستعداد الجميع');
  room.roster=[...room.order];room.status='countdown';room.startsAt=now+PARTY_COUNTDOWN_MS;room.sessionId=uuid();room.cursor=-1;room.history=[];for(const x of Object.values(room.players)){x.score=0;x.wins=0;}return;
 }
 if(message.type==='cancel'&&room.status==='countdown'){room.status='lobby';room.startsAt=0;return;}
 if(message.type==='next'&&room.status==='intermission'){room.nextAt=now;advanceParty(room,now);return;}
 if(message.type==='skip'&&room.status==='playing'){finishPartyRound(room,now,true);return;}
 if(message.type==='rematch'&&room.status==='finished'){room.status='lobby';room.cursor=-1;room.round=null;room.roster=[];room.history=[];room.sessionId=uuid();for(const x of Object.values(room.players)){x.score=0;x.wins=0;x.ready=false;}return;}
 throw Error('الخيار غير متاح في هذه المرحلة');
}
function publicParticipant(r,p,now){
 if(!p)return null;const base={id:p.id,seq:p.seq,score:p.score,progress:p.progress,done:p.done,won:p.won,mistakes:p.mistakes,faults:p.faults,actions:p.actions,finishedAt:p.finishedAt};
 if(r.game==='sudoku')return{...base,board:p.state.board,initial:p.state.initial};
 if(['paths','paths-online'].includes(r.game)){const s=p.state;return{...base,paths:s.paths,size:s.size,pairs:s.pairs,walls:s.walls,gates:s.gates};}
 if(r.game==='jewels'){const {log,history,seed,...state}=p.state;return{...base,state};}
 if(r.game==='picture')return{...base,board:p.board,tray:p.tray,size:r.size,image:r.image};
 if(r.game==='memory')return{...base,deck:p.state.deck.map((v,i)=>p.state.open.includes(i)||p.state.matched.includes(i)?v:null),matched:p.state.matched,open:p.state.open,locked:p.state.locked,columns:r.columns};
 if(r.game==='puzzle')return{...base,tiles:p.tiles};
 if(['quiz','logic'].includes(r.game))return{...base,choice:p.choice,listenCount:p.listenCount||0};
 if(r.game==='reaction')return{...base,times:p.times,pressed:p.trialChoice!==null};
 if(r.tables){const t=r.tables.find(t=>t.members.includes(p.id)),seat=t.members.indexOf(p.id),s=t.state;return{...base,tableId:t.id,seat,hand:r.game==='jackaroo'?s.hands[seat]:undefined,cardActions:r.game==='jackaroo'&&s.turn===seat?s.hands[seat].map((_,i)=>getJackarooActions(s,i)):undefined,legal:r.game==='zahra'&&s.turn===seat&&t.pendingRoll?getLegalLudoMoves(s,t.pendingRoll):[]};}
 return base;
}
export function partyRoundView(room,id=null,now=Date.now()){
 const r=room.round;if(!r)return null;const view={id:r.id,game:r.game,name:partyGame(r.game).name,startedAt:r.startedAt,deadline:r.deadline,settings:r.settings,revision:r.revision,me:publicParticipant(r,r.participants[id],now)};
 if(['quiz','logic'].includes(r.game)&&r.questionIndex<r.questions.length){const q=r.questions[r.questionIndex],preview=now<r.answerOpensAt,revealed=Boolean(r.revealUntil);view.quiz={index:r.questionIndex,count:r.questions.length,question:preview?'احفظ ما يظهر…':q.q,options:preview?[]:q.options,opensAt:r.answerOpensAt,deadline:r.questionDeadline,revealUntil:r.revealUntil,answer:revealed?q.a:null,explanation:revealed?q.explanation||'':null,media:q.media?{type:q.media,src:revealed?q.revealSrc||q.src:q.src,zoom:revealed?1:q.zoom||4,hintZoom:q.hintZoom,focusX:q.focusX,focusY:q.focusY,generated:Boolean(q.generated),credit:q.credit,memory:q.media==='memory'&&(preview||revealed)?q.memory:null}:null};}
 if(r.game==='reaction')view.reaction={trial:r.trial,trials:r.trials,signal:r.signal};
 if(r.tables)view.tables=r.tables.map(t=>({id:t.id,members:t.members.map(id=>({id,name:room.players[id]?.name||'بوت',connected:room.players[id]?.connected??true})),finished:t.finished,turn:t.state.turn,turnDeadline:t.turnDeadline,pendingRoll:t.pendingRoll,players:t.state.players,jumps:t.state.jumps,bonusCells:t.state.bonusCells,lastRoll:t.state.lastRoll,lastEvent:t.state.lastEvent,winner:t.state.winner,winnerTeam:t.state.winnerTeam,turnTotal:t.state.turnTotal,target:t.state.target}));
 if(r.game==='serpent')view.arena=serpentSnapshot(r.arena);
 return view;
}
export function partySnapshot(room,id=null,now=Date.now()){
 return{format:PARTY_VERSION,code:room.code,capacity:room.capacity,status:room.status,revision:room.revision,serverNow:now,sessionId:room.sessionId,playlist:room.playlist,playlistRevision:room.playlistRevision,cursor:room.cursor,startsAt:room.startsAt||0,nextAt:room.nextAt||0,players:partyRanking(room),round:partyRoundView(room,id,now),history:room.history,finishedAt:room.finishedAt||0};
}
