import {initUno,applyUno,advanceUno,unoView} from './uno-core.js?v=33.9.12-quality1';
import {initWordHunt,applyWordHunt,advanceWordHunt,wordHuntBot,wordHuntView,wordHuntAlarm,upgradeWordHunt} from './wordbomb-core.js';
import {raceSim,usePower,changeLane,raceResult} from './chaos-core.js';
export {usePower as raceUsePower,changeLane as raceChangeLane};
export {upgradeWordHunt};
export {raceSim,raceTrack,raceItems,raceOrder,raceWave,gateOpen,shiftRace,RACE_ROWS,RACE_LANES,RACE_DT,RACE_COUNTDOWN,RACE_GRACE,CHAOS_EVERY,CHAOS_WARN,CHAOS_ZONES,GATE_CYCLE,GATE_OPEN} from './chaos-core.js';
// Deterministic rules shared by practice and authoritative rooms. No DOM or network dependencies.
export const CHALLENGES=Object.freeze({
 wordbomb:{title:'صيد الكلمات',tag:'عينك على الحروف. والكلمة لأسرع واحد.',color:'#ffa573',players:20},
 labyrinth:{title:'سباق المتاهة',tag:'خطوة تسبق خصمك',color:'#5de2c2',players:2},
 focus:{title:'مواجهة التركيز',tag:'فكّر بسرعة. واضغط بثقة.',color:'#f5c76e',players:20},
 cipher:{title:'ساحة الشفرات',tag:'كل تلميح يقرّبك',color:'#b6a0ff',players:20},
 territory:{title:'ميدان السيطرة',tag:'خطّط. توسّع. واحمِ حدودك.',color:'#f798b6',players:20},
 survival:{title:'ساحة البقاء',tag:'اقرأ الأرض. وابقَ واقفًا.',color:'#77c9ff',players:20},
 chaos:{title:'أونو',tag:'طابق اللون. اقلب الدور. ونادِ أونو.',color:'#efbd78',players:8}
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
export function cipherHint(secret,guess){let exact=0,near=0;for(let i=0;i<4;i++)if(secret[i]===guess[i])exact++;for(let d=0;d<10;d++)near+=Math.min(secret.filter(x=>x===d).length,guess.filter(x=>x===d).length);return{exact,near:near-exact};}
// 33.5.0: fourteen challenges. A match plays twelve of them in its own order (from its seed).
// 33.7.0: six more (أبكر وقت، عكس الكلمة، أيام الأسبوع، عدد الحروف، جدول الضرب، عدّ الأشكال): twenty in all,
// so a whole match hardly ever meets the same challenge twice
export const FOCUS_MODES=Object.freeze(['color','opposite','sequence','count','word','parity','max','match','sum','odd','missing','flash','majority','dots','clock','antonym','days','letters','times','shape']);
export const FOCUS_ANTONYMS=Object.freeze([['كبير','صغير'],['طويل','قصير'],['حار','بارد'],['سريع','بطيء'],['ثقيل','خفيف'],['قريب','بعيد'],['فوق','تحت'],['ليل','نهار'],['داخل','خارج'],['قوي','ضعيف'],['جديد','قديم'],['سهل','صعب'],['مفتوح','مسكّر'],['نظيف','وسخ'],['فرحان','زعلان'],['أول','آخر'],['يمين','يسار'],['صباح','مساء'],['واسع','ضيق'],['شجاع','جبان']]);
export const FOCUS_DAYS=Object.freeze(['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت']);
export const FOCUS_SHAPES=Object.freeze(['▲','●','■','◆']);
const shuffled=(r,values)=>{const out=[...values];for(let i=out.length-1;i>0;i--){const j=pick(r,i+1);[out[i],out[j]]=[out[j],out[i]];}return out;};
// «الكلمة الدخيلة»: three words of one family and one from another
export const FOCUS_FAMILIES=Object.freeze([
 ['تفاح','موز','عنب','برتقال','رمان','مشمش','خوخ','تمر'],
 ['أسد','نمر','فيل','زرافة','حصان','غزال','جمل','ذئب'],
 ['أحمر','أزرق','أخضر','أصفر','بنفسجي','أسود','أبيض','وردي'],
 ['سيارة','طائرة','قطار','سفينة','دراجة','حافلة','شاحنة','قارب'],
 ['يد','رجل','عين','أنف','أذن','رأس','قلب','كتف'],
 ['قلم','دفتر','كتاب','مسطرة','ممحاة','حقيبة','سبورة','ورقة'],
 ['كورة','سباحة','تنس','جري','ملاكمة','تزلج','غوص','رماية'],
 ['شمس','قمر','نجم','سحاب','مطر','رعد','ثلج','برق']]);
/** The challenge of a round: the match's own order of the fourteen, from its seed. */
export function focusModeOf(m,round=m.round){const order=shuffled(rng((m.seed^0x9e3779b9)>>>0),FOCUS_MODES);return order[round%order.length];}
export function focusAnswer(t){return t.type==='sequence'?[...t.sequence]:t.type==='opposite'?(t.target+2)%4:t.type==='word'?t.word:t.type==='parity'?t.number%2:t.type==='majority'?t.target:['count','max','match','sum','odd','missing','flash','dots','clock','antonym','days','letters','times','shape'].includes(t.type)?t.answer:t.target;}
function focusRound(m,now,r){
 const type=focusModeOf(m),target=pick(r,4),sequence=Array.from({length:Math.min(5,3+Math.floor(m.round/6))},()=>pick(r,4));
 const t={type,target,word:(target+1+pick(r,3))%4,number:1+pick(r,9),sequence,opensAt:now+1500+(type==='sequence'?sequence.length*650:type==='flash'?1400:0)};t.deadline=t.opensAt+6500;
 if(type==='count'){const count=1+pick(r,4);t.dots=shuffled(r,[...Array(count).fill(target),...Array.from({length:5},()=>((target+1+pick(r,3))%4))]);t.options=[1,2,3,4];t.answer=count-1;}
 if(type==='max'){const set=new Set();while(set.size<4)set.add(10+pick(r,90));t.options=[...set];t.answer=t.options.indexOf(Math.max(...t.options));}
 if(type==='match'){t.options=shuffled(r,['◆●▲','●◆▲','▲●◆','◆▲●','●▲◆','▲◆●']).slice(0,4);t.answer=pick(r,4);t.pattern=t.options[t.answer];}
 if(type==='sum'){t.left=2+pick(r,18);t.right=2+pick(r,18);const sum=t.left+t.right;t.options=shuffled(r,[sum,sum+1,sum+3,sum-2]);t.answer=t.options.indexOf(sum);}
 if(type==='odd'){const families=shuffled(r,FOCUS_FAMILIES.map((_,i)=>i)),main=FOCUS_FAMILIES[families[0]],other=FOCUS_FAMILIES[families[1]],words=[...shuffled(r,main).slice(0,3),other[pick(r,other.length)]];t.options=shuffled(r,words);t.answer=t.options.indexOf(words[3]);}
 if(type==='missing'){const step=2+pick(r,8),start=1+pick(r,20),terms=[0,1,2,3].map(i=>start+i*step),hole=1+pick(r,3),value=terms[hole];t.terms=terms.map((v,i)=>i===hole?null:v);const wrong=[value+1,value-1,value+step,value-step,value+2,value+step+1].filter((v,i,all)=>v>0&&v!==value&&all.indexOf(v)===i);t.options=shuffled(r,[value,...shuffled(r,wrong).slice(0,3)]);t.answer=t.options.indexOf(value);}
 if(type==='flash'){const value=100+pick(r,900),s=String(value),near=[Number(s[0]+s[2]+s[1]),value+(pick(r,2)?10:-10),value+(pick(r,2)?1:-1),value+100>999?value-100:value+100,value+(pick(r,2)?20:-20)].filter((v,i,all)=>v>=100&&v<=999&&v!==value&&all.indexOf(v)===i);t.flash=value;t.options=shuffled(r,[value,...shuffled(r,near).slice(0,3)]);while(t.options.length<4){const v=100+pick(r,900);if(!t.options.includes(v))t.options.push(v);}t.answer=t.options.indexOf(value);}
 if(type==='majority'){const others=[0,1,2,3].filter(d=>d!==target),lead=4+pick(r,2),arrows=Array(lead).fill(target);for(const d of others)for(let k=pick(r,3);k>0;k--)arrows.push(d);while(arrows.length<7)arrows.push(others[pick(r,3)]);const counts=[0,1,2,3].map(d=>arrows.filter(x=>x===d).length);for(const d of others)while(counts[d]>=counts[target]){arrows.splice(arrows.indexOf(d),1);counts[d]--;}t.arrows=shuffled(r,arrows);}
 if(type==='clock'){const h0=5+pick(r,6),set=new Set();while(set.size<4)set.add(h0*60+pick(r,36)*5);const mins=[...set];t.options=mins.map(v=>Math.floor(v/60)+':'+String(v%60).padStart(2,'0'));t.answer=mins.indexOf(Math.min(...mins));}
 if(type==='antonym'){const pairs=shuffled(r,FOCUS_ANTONYMS),[word,right]=pick(r,2)?pairs[0]:[pairs[0][1],pairs[0][0]],wrong=pairs.slice(1,4).map(p=>p[pick(r,2)]);t.prompt=word;t.options=shuffled(r,[right,...wrong]);t.answer=t.options.indexOf(right);}
 if(type==='days'){const day=pick(r,7),n=1+pick(r,3),back=pick(r,3)===0,shift=back?-n:n,right=FOCUS_DAYS[(day+shift+7)%7],near=[(day-shift+7)%7,(day+shift+1+7)%7,(day+shift-1+7)%7,(day+7)%7].map(i=>FOCUS_DAYS[i]).filter((d,i,all)=>d!==right&&all.indexOf(d)===i);t.prompt='اليوم '+FOCUS_DAYS[day]+'، '+(back?'قبل':'بعد')+' '+(n===1?'يوم':n===2?'يومين':n+' أيام');t.options=shuffled(r,[right,...near.slice(0,3)]);t.answer=t.options.indexOf(right);}
 if(type==='letters'){const family=FOCUS_FAMILIES[pick(r,FOCUS_FAMILIES.length)],word=family[pick(r,family.length)],n=[...word].length,base=Math.max(2,n-1-pick(r,2)),options=[base,base+1,base+2,base+3];t.prompt=word;t.options=shuffled(r,options);t.answer=t.options.indexOf(n);}
 if(type==='times'){t.left=3+pick(r,7);t.right=3+pick(r,7);const v=t.left*t.right,near=[v+t.left,v-t.right,v+t.right,v-t.left,v+1,v-1,v+10].filter((x,i,all)=>x>0&&x!==v&&all.indexOf(x)===i);t.options=shuffled(r,[v,...shuffled(r,near).slice(0,3)]);t.answer=t.options.indexOf(v);}
 if(type==='shape'){const count=1+pick(r,4),others=Array.from({length:4+pick(r,3)},()=>(target+1+pick(r,3))%4);t.shapes=shuffled(r,[...Array(count).fill(target),...others]);t.options=[1,2,3,4];t.answer=count-1;}
 if(type==='dots'){const set=new Set();while(set.size<4)set.add(4+pick(r,11));t.options=[...set];t.answer=t.options.indexOf(Math.max(...t.options));t.layouts=t.options.map(n=>{const cells=shuffled(r,Array.from({length:25},(_,i)=>i));return cells.slice(0,n);});}
 m.task=t;m.answers={};m.phaseAt=now;
}
export function upgradeFocus(m,now=Date.now()){
 if(m?.game!=='focus'||m.task?.type!=='hold')return false;
 if(m.phase==='playing'){for(const p of m.players){const old=m.answers?.[p.id];if(old){p.score-=old.gain;if(p.focus)p.focus.wrong=Math.max(0,p.focus.wrong-1);}}focusRound(m,now,rng(m.seed+m.version));}
 else m.task={...m.task,type:'color'};
 m.version++;return true;
}
/** Rooms saved by an older release: the focus «hold» task and «قنبلة الكلمات» move to the current rules. */
export function upgradeChallenge(m,now=Date.now()){const focus=upgradeFocus(m,now),hunt=upgradeWordHunt(m,now);return focus||hunt;}
function hazard(m,now,r){const n=m.board.size,round=m.round;let unsafe=[];
 // The warning includes the longest route to refuge at the server movement cooldown.
 const axis=pick(r,2),parity=pick(r,2);for(let c=0;c<n*n;c++){const x=c%n,y=Math.floor(c/n);if((axis?x:y)%2===parity)unsafe.push(c);}
 let hazardName='مسارات متبادلة';
 if(round%4===1){const hole=pick(r,n);unsafe=Array.from({length:n*n},(_,i)=>i).filter(i=>i%n!==hole&&Math.floor(i/n)!==hole);hazardName='ممر النجاة';}
 if(round%4===2){const sx=1+pick(r,n-2),sy=1+pick(r,n-2);unsafe=Array.from({length:n*n},(_,i)=>i).filter(i=>Math.abs(i%n-sx)>1||Math.abs(Math.floor(i/n)-sy)>1);hazardName='جزيرة آمنة';}
 if(round%4===3){const side=pick(r,4),cut=Math.floor(n/2);unsafe=Array.from({length:n*n},(_,i)=>i).filter(i=>side===0?i%n<cut:side===1?i%n>cut:side===2?Math.floor(i/n)<cut:Math.floor(i/n)>cut);hazardName='موجة جانبية';}
 m.board.hazardName=hazardName;m.board.warningStartedAt=now;m.board.unsafe=unsafe;const safe=Array.from({length:n*n},(_,i)=>i).filter(c=>!unsafe.includes(c)),distance=Math.max(0,...unsafe.map(c=>Math.min(...safe.map(to=>Math.abs(c%n-to%n)+Math.abs(Math.floor(c/n)-Math.floor(to/n))))));m.board.collapseAt=now+Math.max(2200,4200-round*110,distance*180+800);m.board.recoverAt=m.board.collapseAt+650;m.board.collapsed=false;
}
export function createChallenge(game,players,seed=1,now=Date.now(),options={}){
 if(!CHALLENGES[game]||players.length<2||players.length>CHALLENGES[game].players||new Set(players.map(p=>p.id)).size!==players.length)throw Error('invalid_players');
 const m={rules:2,retainHistory:options.retainHistory===true,game,seed:seed>>>0,phase:'playing',round:0,version:1,startedAt:now,endsAt:now+(game==='labyrinth'?240000:game==='cipher'?600000:game==='survival'?90000:game==='focus'?180000:100000),players:players.map((p,i)=>({id:p.id,name:p.name,hero:HEROES.includes(p.hero)?p.hero:'fox',bot:!!p.bot,score:0,alive:true,moves:0,lastMove:0,attempts:[],attemptCount:0,intel:{},historyCounts:{},kills:0,energy:3,energyAt:now,slot:i})),winners:[],log:[],nextBotAt:now+1200};
 const r=rng(m.seed);
 if(game==='labyrinth'){m.board={size:7,positions:[3,45],blocks:[],walls:[10,10]};m.turn=0;m.turnDeadline=now+18000;}
 if(game==='focus')focusRound(m,now,r);
 if(game==='wordbomb')initWordHunt(m,now);
 if(game==='chaos')initUno(m,options.unoMode,now);
 if(game==='cipher'){m.digits=10;m.secrets=Object.fromEntries(m.players.map((p,i)=>[p.id,validSecret(players[i].secret)?[...players[i].secret]:Array.from({length:4},()=>pick(r,10))]));m.nextGuess=Object.fromEntries(m.players.map(p=>[p.id,0]));}
 if(game==='territory'){const size=players.length>8?11:9,positions=spawnCells(players.length,size);m.board={size,owners:Array(size*size).fill(-1),crystals:Array.from({length:Math.floor(size*size/12)},(_,i)=>(i*17+Math.floor(size*size/2))%(size*size))};positions.forEach((c,i)=>m.board.owners[c]=i);territoryScores(m);}

 if(game==='patterns'){m.board={cards:cards(r)};m.nextGuess={};}
 if(game==='survival'){m.board={size:players.length>10?11:players.length>4?9:7,positions:players.length<=4?m.players.map((_,i)=>[16,18,30,32][i]):spawnCells(players.length,players.length>10?11:9)};hazard(m,now,r);}
 return m;
}
function finish(m,now,winners){m.phase='finished';m.finishedAt=now;m.winners=winners??(()=>{const best=Math.max(...m.players.map(p=>p.score));return m.players.filter(p=>p.score===best).map(p=>p.id);})();m.version++;}
function note(m,text){m.log.push(text);if(m.log.length>5)m.log.shift();}
export function applyChallenge(m,id,action,now=Date.now()){
 if(m.phase!=='playing')throw Error('الجولة انتهت');const p=m.players.find(p=>p.id===id);if(!p)throw Error('غير مصرح');if(!p.alive)throw Error('أُقصيت؛ تقدر تتابع المنافسين');
 if(!action||typeof action!=='object'||Array.isArray(action))throw Error('حركة غير صالحة');
 const r=rng(m.seed+m.version*7919);
 if(m.game==='wordbomb')applyWordHunt(m,p,action,now);
 if(m.game==='chaos'){if(m.uno)applyUno(m,p,action,now);else applyRace(m,p,action,now);}
 if(m.game==='labyrinth'){
  if(m.turn!==p.slot)throw Error('انتظر دورك');const b=m.board,s=p.slot;
  if(action.type==='step'){const to=action.to;if(!adjacent(b.positions[s],to,b.size)||b.blocks.includes(edge(b.positions[s],to))||b.positions[1-s]===to)throw Error('اختر مربعًا مجاورًا مفتوحًا');b.positions[s]=to;p.moves++;if(Math.floor(to/7)===(s===0?6:0)){p.score=100;finish(m,now,[id]);}}
  else if(action.type==='wall'){const{a,b:to}=action;if(!adjacent(a,to,7)||b.blocks.includes(edge(a,to))||b.walls[s]<=0)throw Error('الحاجز غير متاح');const blocks=[...b.blocks,edge(a,to)];if(!mazePath(b.positions[0],6,blocks)||!mazePath(b.positions[1],0,blocks))throw Error('لا يمكن إغلاق كل الطرق');b.blocks=blocks;b.walls[s]--;note(m,p.name+' وضع حاجزًا');}
  else throw Error('حركة غير صالحة');m.turn=1-m.turn;m.turnDeadline=now+18000;
 }
 if(m.game==='focus'){
  const t=m.task;if(action.round!==m.round)throw Error('الجولة تغيّرت');if(now<t.opensAt)throw Error('انتظر الإشارة');if(now>=t.deadline)throw Error('انتهى وقت السؤال');if(m.answers[id])throw Error('تم تسجيل إجابتك');
  let correct=false;if(t.type==='sequence'){if(!Array.isArray(action.values)||action.values.length!==t.sequence.length||action.values.some(v=>!Number.isInteger(v)||v<0||v>3))throw Error('أكمل التسلسل');correct=action.values.every((v,i)=>v===t.sequence[i]);}
  else{if(!Number.isInteger(action.choice)||action.choice<0||action.choice>3)throw Error('إجابة غير صالحة');correct=action.choice===focusAnswer(t);}
  const elapsed=Math.max(0,now-t.opensAt);const stats=p.focus??={correct:0,wrong:0,streak:0,bestStreak:0,totalMs:0,bestMs:null};stats.streak=correct?stats.streak+1:0;stats.bestStreak=Math.max(stats.bestStreak,stats.streak);if(correct){stats.correct++;stats.totalMs+=elapsed;stats.bestMs=stats.bestMs===null?elapsed:Math.min(stats.bestMs,elapsed);}else stats.wrong++;const combo=correct?Math.min(4,stats.streak-1)*25:0;const gain=correct?100+Math.floor(Math.max(0,t.deadline-now)/100)+combo:-40;p.score+=gain;m.answers[id]={correct,gain,elapsed,combo,streak:stats.streak};if(m.players.every(x=>m.answers[x.id]))t.deadline=Math.min(t.deadline,now+900);
 }
 if(m.game==='cipher'){
  const target=m.players.find(x=>x.id===action.target);if(!target||target.id===id||!target.alive)throw Error('اختر خصمًا ما زال في الجولة');if(now<m.nextGuess[id])throw Error('انتظر تجهيز المحاولة التالية');const g=action.guess;if(!validSecret(g,m.digits||6))throw Error('اختر أربعة أرقام من 0 إلى 9');
  const hint=cipherHint(m.secrets[target.id],g);p.intel[target.id]??=[];p.historyCounts??={};p.historyCounts[target.id]=(p.historyCounts[target.id]??p.intel[target.id].length)+1;p.intel[target.id].push({guess:[...g],...hint,number:p.historyCounts[target.id],at:now});if(!m.retainHistory&&p.intel[target.id].length>30)p.intel[target.id].shift();p.attemptCount=(p.attemptCount??p.attempts.length)+1;p.attempts.push({target:target.id});if(p.attempts.length>30)p.attempts.shift();m.nextGuess[id]=now+1400;
  if(hint.exact===4){target.alive=false;target.eliminatedAt=now;target.eliminatedBy=id;p.kills++;p.score+=1000;note(m,p.name+' فك شفرة '+target.name+' وأقصاه');const alive=m.players.filter(x=>x.alive);if(alive.length===1)finish(m,now,[alive[0].id]);}
 }
 if(m.game==='territory'){
  const b=m.board,to=action.to;if(!Number.isInteger(to)||to<0||to>=b.owners.length)throw Error('اختر مربعًا داخل الميدان');if(now-p.lastMove<650)throw Error('انتظر تجهيز الحركة');
  const near=[to-1,to+1,to-b.size,to+b.size].filter(c=>adjacent(c,to,b.size)),friendly=near.filter(c=>b.owners[c]===p.slot).length;if(!friendly||b.owners[to]===p.slot)throw Error('اختر مربعًا ملاصقًا لحدودك');const enemy=b.owners[to]>=0,cost=enemy?3:1,energy=Math.min(3,p.energy+Math.floor((now-p.energyAt)/1200));if(energy<cost)throw Error('طاقتك لا تكفي؛ الهجوم يحتاج 3');if(enemy&&friendly<2)throw Error('الهجوم يحتاج حدّين ملاصقين من منطقتك');
  p.energy=energy-cost;p.energyAt=now;p.lastMove=now;p.moves++;b.owners[to]=p.slot;territoryScores(m);for(const x of m.players)if(x.score===0){x.alive=false;x.eliminatedAt=now;}const alive=m.players.filter(x=>x.alive);if(alive.length===1)finish(m,now,[alive[0].id]);
 }

 if(m.game==='patterns'){
  if(action.round!==m.round)throw Error('تغيّرت البطاقات');if(now<(m.nextGuess[id]||0))throw Error('انتظر قليلًا قبل المحاولة');const ids=action.cards;if(!Array.isArray(ids)||ids.length!==3||new Set(ids).size!==3||ids.some(x=>!m.board.cards.some(c=>c.id===x)))throw Error('اختر ثلاث بطاقات');
  const chosen=ids.map(id=>m.board.cards.find(c=>c.id===id));if(setValid(chosen)){p.score+=100;m.round++;m.board.cards=cards(r);note(m,p.name+' اكتشف النمط');if(m.round>=12)finish(m,now);}else{p.score-=25;m.nextGuess[id]=now+1400;note(m,p.name+' خسر 25 نقطة');}
 }
 if(m.game==='survival'){
  if(!p.alive)throw Error('أنت تشاهد الجولة');if(now-p.lastMove<180)throw Error('تمهّل قليلًا');const to=action.to,b=m.board,from=b.positions[p.slot],dash=action.dash===true,mid=Number.isInteger(to)?(from+to)/2:-1;const legal=dash?Number.isInteger(mid)&&adjacent(from,mid,b.size)&&adjacent(mid,to,b.size)&&(from%b.size===to%b.size||Math.floor(from/b.size)===Math.floor(to/b.size))&&now-(p.lastDash||0)>=8000&&!(b.collapsed&&b.unsafe.includes(mid)):adjacent(from,to,b.size);if(!legal||b.collapsed&&b.unsafe.includes(to))throw Error('هذا المربع غير متاح');b.positions[p.slot]=to;p.lastMove=now;if(dash)p.lastDash=now;p.moves++;
 }
 m.version++;return m;
}
// «سباق الفوضى»: the room carries the race to now before every choice and on its alarms
function advanceRace(m,now){
 const race=m.race,finished=race.finished,second=Math.floor((race.simAt-race.t0)/1000);
 raceSim(race,m.players.map(p=>p.bot),now);
 race.runners.forEach((R,i)=>{m.players[i].score=Math.floor(R.pos);});m.endsAt=race.endsAt;
 if(race.over){const result=raceResult(race);for(const row of result.points)m.players[row.i].score=row.score;m.phase='finished';m.finishedAt=race.overAt;m.winners=result.winners.map(i=>m.players[i].id);m.version++;return;}
 if(race.finished!==finished||Math.floor((race.simAt-race.t0)/1000)!==second)m.version++;
}
function applyRace(m,p,a,now){
 const race=m.race;raceSim(race,m.players.map(x=>x.bot),now);
 if(race.over)throw Error('السباق خلص');if(now<race.startAt)throw Error('استنى إشارة الانطلاق');
 const R=race.runners[p.slot];if(R.done!==null)throw Error('وصلت خط النهاية؛ تابع الباقين');
 if(a.type==='lane'){if(!changeLane(race,p.slot,a.lane,now))throw Error('ما تقدر تغيّر المسار الحين');p.moves++;return;}
 if(a.type==='power'){if(!usePower(race,p.slot,now))throw Error('ما عندك قدرة الحين');p.moves++;return;}
 throw Error('حركة غير صالحة');
}
function cipherWinners(m){const solved=m.players.filter(p=>p.solvedAt).sort((a,b)=>a.attempts.length-b.attempts.length||a.solvedAt-b.solvedAt);return solved.length?[solved[0].id]:[];}
export function advanceChallenge(m,now=Date.now()){
 if(m.phase!=='playing')return m;
 upgradeChallenge(m,now);
 if(m.game==='wordbomb'){advanceWordHunt(m,now);if(m.phase!=='playing')return m;}
 if(m.game==='chaos'){if(m.uno)advanceUno(m,now);else advanceRace(m,now);return m;}
 if(now>=m.endsAt&&m.game==='cipher'&&m.players.filter(p=>p.alive).length>1){m.overtime=true;m.endsAt=now+60000;m.version++;}
 if(now>=m.endsAt){if(m.game==='cipher')finish(m,now,m.players.filter(p=>p.alive).length===1?m.players.filter(p=>p.alive).map(p=>p.id):[]);else if(m.game==='survival')finish(m,now,m.players.filter(p=>p.alive).map(p=>p.id));else if(m.game==='labyrinth'){const d=m.players.map((p,i)=>mazePath(m.board.positions[i],i===0?6:0,m.board.blocks)?.length??999);finish(m,now,d[0]===d[1]?m.players.map(p=>p.id):[m.players[d[0]<d[1]?0:1].id]);}else finish(m,now);return m;}
 const r=rng(m.seed+m.round*3571+m.version);
 if(m.game==='labyrinth'&&now>=m.turnDeadline){note(m,'انتهى وقت الدور');m.turn=1-m.turn;m.turnDeadline=now+18000;m.version++;}
 if(m.game==='focus'&&now>=m.task.deadline){m.round++;if(m.round>=12)finish(m,now);else focusRound(m,now+700,r);m.version++;}
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
 if(m.game==='wordbomb')return wordHuntBot(m,p,now);
 if(m.game==='chaos')return null;   // the race steers its computer runners itself
 if(m.game==='focus'){const think=1100+Math.floor(rng((m.seed+m.round*131+p.slot*7)>>>0)()*2400);if(now<m.task.opensAt+think||m.answers[id])return null;return m.task.type==='sequence'?{round:m.round,values:m.task.sequence.map(v=>r()<.86?v:pick(r,4))}:{round:m.round,choice:r()<.78?focusAnswer(m.task):pick(r,4)};}
 if(m.game==='cipher'){
  // 33.5.0: it thinks at a person's pace — a first look of about ten seconds, then a guess every
  // 15 to 22 seconds — and half of its guesses lean only on its latest two clues.
  const pace=rng((m.seed^Math.imul(p.slot+1,0x9e3779b1)^Math.imul((p.attemptCount||0)+1,7919))>>>0);
  if(!p.nextThink){p.nextThink=now+8000+Math.floor(pace()*4000);return null;}
  if(now<p.nextThink)return null;p.nextThink=now+15000+Math.floor(pace()*7000);const targets=m.players.filter(x=>x.alive&&x.id!==id);if(!targets.length)return null;const target=targets.sort((a,b)=>(p.intel[b.id]?.length||0)-(p.intel[a.id]?.length||0))[0],history=p.intel[target.id]||[];
  const radix=m.digits||6,consistent=clues=>{const out=[];for(let code=0;code<radix**4;code++){const g=[code%radix,Math.floor(code/radix)%radix,Math.floor(code/(radix**2))%radix,Math.floor(code/(radix**3))];if(clues.every(a=>{const h=cipherHint(g,a.guess);return h.exact===a.exact&&h.near===a.near;}))out.push(g);}return out;};
  let candidates=pace()<.5?consistent(history.slice(-2)):consistent(history);if(!candidates.length)candidates=consistent(history);return{target:target.id,guess:candidates[pick(r,candidates.length)]};
 }
 if(m.game==='territory'){const b=m.board,candidates=[],energy=Math.min(3,p.energy+Math.floor((now-p.energyAt)/1200));for(let to=0;to<b.owners.length;to++){const owner=b.owners[to];if(owner===p.slot)continue;const friendly=[to-1,to+1,to-b.size,to+b.size].filter(c=>adjacent(c,to,b.size)&&b.owners[c]===p.slot).length,enemy=owner>=0;if(!friendly||energy<(enemy?3:1)||enemy&&friendly<2)continue;const value=(b.crystals.includes(to)?8:0)+(enemy?4:0)+friendly+(enemy?(m.players[owner]?.score||0)/100:0);candidates.push({to,value});}candidates.sort((a,b)=>b.value-a.value||a.to-b.to);return candidates.length?{to:candidates[0].to}:null;}

 if(m.game==='patterns'){if(now<(p.nextThink||0))return null;p.nextThink=now+3500+pick(r,2000);return{round:m.round,cards:patternSet(m.board.cards)};}
 if(m.game==='survival'){const b=m.board,start=b.positions[p.slot];if(!b.unsafe.includes(start))return null;const queue=[[start]],seen=new Set([start]);for(let i=0;i<queue.length;i++){const path=queue[i],at=path.at(-1);if(!b.unsafe.includes(at))return{to:path[1]};for(const to of [at-b.size,at+b.size,at-1,at+1])if(adjacent(at,to,b.size)&&!seen.has(to)){seen.add(to);queue.push([...path,to]);}}}
 return null;
}
export function challengeView(m,id,now=Date.now()){
 const p=m.players.find(p=>p.id===id);if(!p)throw Error('forbidden');const view={digits:m.digits||6,game:m.game,phase:m.phase,phaseAt:m.phaseAt,overtime:!!m.overtime,round:m.round,version:m.version,startedAt:m.startedAt,endsAt:m.endsAt,serverNow:now,winners:m.winners,log:m.log,turn:m.turn,turnDeadline:m.turnDeadline,board:m.board?structuredClone(m.board):null,players:m.players.map(x=>({id:x.id,name:x.name,hero:x.hero,bot:x.bot,score:x.score,alive:x.alive,moves:x.moves,slot:x.slot,kills:x.kills||0,eliminatedBy:x.eliminatedBy||null,eliminatedAt:x.eliminatedAt||null,solved:!!x.solvedAt,hearts:x.hearts,words:x.words,attemptCount:x.attemptCount??x.attempts.length})),me:{id,slot:p.slot,focus:p.focus?structuredClone(p.focus):null,attempts:structuredClone(p.attempts),answered:!!m.answers?.[id],energy:Math.min(3,p.energy+Math.floor((now-p.energyAt)/1200)),energyRaw:p.energy,energyAt:p.energyAt,lastDash:p.lastDash||0,nextGuess:m.nextGuess?.[id]||0}};
 if(m.game==='wordbomb')view.hunt=wordHuntView(m,id);
 if(m.game==='chaos'){if(m.uno)view.uno=unoView(m,id);else view.race=structuredClone(m.race);}
 if(m.game==='focus'){view.answerCount=Object.keys(m.answers).length;view.task={...m.task};delete view.task.answer;if(now>=m.task.opensAt||m.phase==='finished'){delete view.task.sequence;delete view.task.flash;}view.me.answer=m.answers[id]||null;}
 if(m.game==='cipher'&&m.rules===2){view.me.secret=[...m.secrets[id]];view.me.intel=Object.fromEntries(Object.entries(p.intel).map(([id,rows])=>[id,structuredClone(rows.slice(-30))]));view.me.historyCounts={...p.historyCounts};const threat=m.players.filter(x=>x.id!==id&&x.alive).map(x=>({id:x.id,name:x.name,exact:Math.max(0,...((x.intel||{})[id]||[]).map(r=>r.exact||0))})).sort((a,b)=>b.exact-a.exact)[0];view.me.pressure=threat?.exact>0?threat:null;view.revealed=m.players.filter(x=>x.id!==id&&x.alive).map(x=>({id:x.id,digits:m.secrets[x.id].map((v,i)=>i<(m.overtime?4:Math.min(3,Math.floor((now-m.startedAt)/90000)))?v:null)}));}return view;
}
export function nextChallengeAlarm(m,now=Date.now()){
 if(m.phase!=='playing')return now+60000;const times=[m.endsAt];if(m.players.some(p=>p.bot)&&m.game!=='chaos')times.push(m.nextBotAt);if(m.game==='wordbomb')times.push(wordHuntAlarm(m));if(m.game==='chaos'){if(m.uno)times.push(m.players[m.uno.turn].bot?m.uno.thinkAt:m.uno.deadline);else times.push(now<m.race.startAt?m.race.startAt:Math.min(m.race.endsAt,now+2000));}if(m.game==='focus')times.push(m.task.deadline);if(m.game==='labyrinth')times.push(m.turnDeadline);if(m.game==='survival')times.push(m.board.collapsed?m.board.recoverAt:m.board.collapseAt);return Math.max(now+10,Math.min(...times));
}

export const validSecret=(s,radix=10)=>Array.isArray(s)&&s.length===4&&s.every(x=>Number.isInteger(x)&&x>=0&&x<radix);
export function spawnCells(count,size){const cols=Math.ceil(Math.sqrt(count)),rows=Math.ceil(count/cols);return Array.from({length:count},(_,i)=>Math.round((i%cols+1)*(size-1)/(cols+1))+Math.round((Math.floor(i/cols)+1)*(size-1)/(rows+1))*size);}
function territoryScores(m){for(const p of m.players)p.score=m.board.owners.reduce((v,o,i)=>v+(o===p.slot?(m.board.crystals.includes(i)?4:1):0),0);}
