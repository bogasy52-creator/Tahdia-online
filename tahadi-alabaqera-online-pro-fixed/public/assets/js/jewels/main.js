/* Jewels Studio: independent, equal-opening score runs. The engine owns results;
   the local Canvas replay owns animation. Opponent progress never redraws this board. */
import { JR, BOOSTERS, adjacent, createJewelsRace, playJewelsRaceSwap, playJewelsRaceBooster, finishJewelsRace, chooseJewelsRaceMove, legalRaceSwaps, advanceJewelsRace } from '../engines/jewels-race-engine.js?v=33.10.0';
import { createTable } from '../board-table-v33.js?v=33.10.0';
import { createJewelsRenderer, drawStudioHero, drawBoosterIcon, GEM_COLORS } from './studio-renderer.js?v=33.10.0';

import { suggestJewelsSwap } from './advisor.js?v=33.10.0-nov14';

const $=selector=>document.querySelector(selector);
let lightEffects=false;try{lightEffects=localStorage.getItem('bs_jewels_light_effects')==='1';}catch{}
const W=JR.W,H=JR.H,N=W*H;
const escapeText=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const reduced=()=>Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
const cloneValue=value=>structuredClone(value);
const ctl={epoch:0,mode:'ai',state:null,level:'medium',names:['أنت','الكمبيوتر'],bots:[false,true],users:[null,null],me:0,seat:0,busy:false,pending:null,aim:-1,shownSeq:0,endShown:false,rewarded:false,receipt:'',match:0,scores:[0,0],idleTimer:0,botTimer:0,botHistory:[],botReady:false,clockTimer:0,clockOffset:0,deadline:null,handover:false,legacy:false,selected:-1,cursor:0,hint:null,aimCell:-1};
let table=null,room=null,drag=null,bannerTimer=0,endTimer=0,exitArmed=0,audioContext=null;
const canvas=$('#jwBoard'),wrap=$('#jwWrap');
const currentMatch=epoch=>epoch===ctl.epoch&&Boolean(ctl.state);
const mySeat=()=>ctl.mode==='online'?ctl.me:ctl.mode==='two'?ctl.seat:0;
const player=()=>ctl.state?.players?.[mySeat()];
const clockNow=()=>Date.now()+ctl.clockOffset;
const deadline=()=>ctl.mode==='two'?ctl.deadline:ctl.state?.endsAt;
const timedOut=()=>Boolean(deadline()&&clockNow()>=deadline());
const canAct=()=>Boolean(ctl.state&&!ctl.state.finished&&!player()?.done&&Array.isArray(player()?.board)&&!ctl.busy&&!ctl.pending&&!ctl.handover&&!ctl.legacy&&!timedOut());
function sound(name,volume=.5){try{window.BS_AUDIO?.play?.(name,{volume});}catch{}}
function unlock(){try{window.BS_AUDIO?.unlock?.();const Audio=window.AudioContext||window.webkitAudioContext;if(Audio&&!audioContext)audioContext=new Audio();audioContext?.resume?.();}catch{}}
function gemSound(kind,cascade=0){
  if(kind==='swap'){sound('whoosh',.24);return;}
  if(kind==='special')sound('combo',.44);else if(kind==='made')sound('coin',.32);
  if(!audioContext||window.BS_AUDIO?.getSettings?.().muted){if(kind==='match')sound('pop',.38);return;}
  try{const time=audioContext.currentTime,notes=kind==='made'?[784,1046,1318]:kind==='special'?[392,587,784,1174]:[523.25,659.25,783.99].map(n=>n*2**(Math.min(5,cascade)/12));notes.forEach((note,index)=>{const oscillator=audioContext.createOscillator(),gain=audioContext.createGain(),at=time+index*.035;oscillator.type=kind==='special'?'triangle':'sine';oscillator.frequency.setValueAtTime(note,at);oscillator.frequency.exponentialRampToValueAtTime(note*1.025,at+.12);gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.035,at+.008);gain.gain.exponentialRampToValueAtTime(.0001,at+.24);oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.start(at);oscillator.stop(at+.25);});}catch{}
}
function banner(text,quiet=false,combo=0){const element=$('#jwBanner');element.textContent=text;element.className='jw-banner show'+(combo>=2?' spectacular':'')+(quiet?' quiet':'');clearTimeout(bannerTimer);bannerTimer=setTimeout(()=>element.classList.remove('show'),quiet?1300:850);}
function bumpScore(seat,points){ctl.scores[seat]=(ctl.scores[seat]||0)+points;const element=document.querySelector(`.jw-plate[data-seat="${seat}"] .jw-score`);if(element){element.textContent=ctl.scores[seat];element.classList.remove('bump');void element.offsetWidth;element.classList.add('bump');}}
const renderer=createJewelsRenderer({canvas,reduceMotion:reduced,lightEffects:()=>lightEffects,onScore:bumpScore,onCascade:banner,onSound:gemSound});
function chooseHint(){const advice=suggestJewelsSwap(player()?.board);ctl.hintLabel=advice?.label||'';return advice?.pair||null;}
function paintSelection(){const help=$('#jwBoardHelp');if(help)help.textContent=ctl.hint?(ctl.hintLabel||'تبديل متاح على لوحتك'):'اسحب وطابق · الأسهم وEnter للعب';renderer.configure({selection:ctl.selected,cursor:ctl.cursor,hint:ctl.hint,aim:ctl.aim>=0?aimCells(BOOSTERS[ctl.aim].id,ctl.aimCell):[],focus:document.activeElement===wrap});syncGrid();}
function clearSelection(){drag=null;ctl.selected=-1;ctl.aim=-1;ctl.aimCell=-1;ctl.hint=null;paintSelection();renderHud();renderStatus();}
function aimCells(id,cell){if(cell<0||!player()?.board)return[];const x=cell%W,y=Math.floor(cell/W),out=[];if(id==='hammer'){for(let row=y-1;row<=y+1;row++)for(let col=x-1;col<=x+1;col++)if(row>=0&&col>=0&&row<H&&col<W)out.push(row*W+col);}else if(id==='cross'){for(let col=0;col<W;col++)out.push(y*W+col);for(let row=0;row<H;row++)if(row!==y)out.push(row*W+x);}else{const color=player().board[cell]?.c;player().board.forEach((tile,index)=>{if(tile?.c===color)out.push(index);});}return out;}
function fitBoard(){
  const parentWidth=$('.jw-stage')?.clientWidth||innerWidth;
  const width=Math.max(220,Math.min(548,innerWidth-24,parentWidth));
  const height=Math.max(220,innerHeight-(innerWidth<600?325:335));
  const size=Math.min(width,height);
  const geometry=renderer.resize(size,window.devicePixelRatio||1);wrap.style.width=wrap.style.height=geometry.size+'px';
  $('#game').style.setProperty('--jw-board-size',geometry.size+'px');
}
const GEM_LABELS=['حمراء','ذهبية','خضراء','زرقاء','بنفسجية','برتقالية'];
function syncGrid(){
  const box=$('#jwCells');if(!box.querySelector('#jwCell-0'))box.innerHTML=Array.from({length:H},(_,row)=>`<div role="row">${Array.from({length:W},(_,col)=>`<span id="jwCell-${row*W+col}" role="gridcell" aria-rowindex="${row+1}" aria-colindex="${col+1}"></span>`).join('')}</div>`).join('');
  const board=player()?.board||[];for(let index=0;index<N;index++){const tile=board[index],special={rh:'صاروخ أفقي',rv:'صاروخ عمودي',bomb:'قنبلة',ball:'جوهرة نور'}[tile?.s],cell=$('#jwCell-'+index);cell.setAttribute('aria-label',`الصف ${Math.floor(index/W)+1}، العمود ${index%W+1}: ${special||'جوهرة'} ${GEM_LABELS[tile?.c]||''}`);cell.setAttribute('aria-selected',String(ctl.selected===index));}
  wrap.setAttribute('aria-activedescendant','jwCell-'+ctl.cursor);wrap.setAttribute('aria-busy',String(ctl.busy||Boolean(ctl.pending)));wrap.setAttribute('aria-disabled',String(!canAct()));
  $('#jwCancel').hidden=ctl.selected<0&&ctl.aim<0;$('#jwHint').disabled=!canAct();
}
function faceOf(seat){
  const user=ctl.users[seat],profile=window.BS_PROFILE_PRO,self=ctl.mode!=='two'&&seat===mySeat();
  if(profile?.avatar&&(user?.username||user?.photo||user?.fallback||self))return profile.avatar({username:user?.username||'',photo:user?.photo||null,name:ctl.names[seat],fallback:user?.fallback||'',self});
  const face=document.createElement('span');face.className='jw-letter'+(self&&profile?.frameClass?.()?' bs-avatar '+profile.frameClass():'');face.textContent=ctl.bots[seat]?'✦':String(ctl.names[seat]||'؟').trim().slice(0,1);return face;
}
function plateHTML(seat){return `<span class="jw-face" data-player-tag="${seat}" role="button" tabindex="0" aria-label="ملف ${escapeText(ctl.names[seat])}"><span class="jw-pic"></span></span><span class="jw-who"><b></b><small></small></span><span class="jw-scorebox"><b class="jw-score">0</b><small>نقطة</small></span><span class="jw-player-track" aria-hidden="true"><i></i></span>`;}
function buildHud(){
  const own=mySeat();for(const[id,seat]of[['#plateBottom',own],['#plateTop',1-own]]){const plate=$(id);plate.dataset.seat=seat;plate.innerHTML=plateHTML(seat);plate.querySelector('.jw-pic').replaceWith(faceOf(seat));}
  const bar=$('#jwBoostBar');bar.innerHTML=BOOSTERS.map((booster,index)=>`<button type="button" class="jw-boost" data-k="${index}" style="--boost:${GEM_COLORS[booster.color].base};--boost-light:${GEM_COLORS[booster.color].glow}" aria-label="${escapeText(booster.name)}: ${escapeText(booster.text)}. تستخدم حركة واحدة"><span class="jw-boost-art"><i></i><canvas aria-hidden="true"></canvas><span class="jw-boost-ready" aria-hidden="true">✓</span></span><span class="jw-boost-copy"><b>${booster.name}</b><small></small><span class="jw-charge-track" aria-hidden="true"><i></i></span></span></button>`).join('');
  bar.querySelectorAll('canvas').forEach((cv,index)=>drawBoosterIcon(cv,index));bar.querySelectorAll('.jw-boost').forEach(button=>button.addEventListener('click',()=>{unlock();boosterTap(Number(button.dataset.k));}));
  ctl.scores=ctl.state?.players.map(p=>p.score)||[0,0];
}
function renderHud(){
  const state=ctl.state;if(!state)return;const own=mySeat(),p=state.players[own];
  for(const plate of document.querySelectorAll('.jw-plate')){
    const seat=Number(plate.dataset.seat),summary=state.players[seat],hidden=ctl.mode==='two'&&seat!==own&&!state.finished;
    plate.querySelector('.jw-who b').textContent=ctl.names[seat]||summary.name;
    plate.querySelector('.jw-who small').textContent=hidden?'النتيجة عند النهاية':summary.done?'اكتملت الجولة':seat===own?'أنت تلعب':`${summary.used||0} / ${state.moves} حركة`;
    if(!ctl.busy||seat!==own){ctl.scores[seat]=summary.score;plate.querySelector('.jw-score').textContent=hidden?'•••':summary.score;}
    plate.querySelector('.jw-player-track i').style.width=(hidden?0:Math.min(100,(summary.used||0)/state.moves*100))+'%';
    plate.classList.toggle('complete',summary.done);plate.classList.toggle('leading',!hidden&&summary.score>state.players[1-seat].score);
  }
  $('#jwMovesText').textContent=p.done?'اكتملت جولتك':p.remaining+' حركة متبقية';$('#jwMoves i').style.width=Math.max(0,p.remaining/state.moves*100)+'%';$('#jwMoves').classList.toggle('low',p.remaining<=5);$('#jwBoardTitle').textContent=ctl.mode==='two'?'لوحة '+ctl.names[own]:'لوحتك';
  $('#jwRoundNote').textContent='نفس البداية · '+state.moves+' حركة';$('#jwModeLabel').textContent=ctl.mode==='online'?'تحدٍ مباشر':ctl.mode==='two'?'جهاز واحد':'تدريب · '+({easy:'هادئ',medium:'منافس',hard:'محترف'}[ctl.level]);
  for(const button of $('#jwBoostBar').querySelectorAll('.jw-boost')){const index=Number(button.dataset.k),booster=BOOSTERS[index],have=Math.min(booster.need,p.charge?.[index]||0),ready=have>=booster.need;button.querySelector('small').textContent=ctl.aim===index?'اختر مكان الضربة':ready?'جاهزة · حركة واحدة':have+' / '+booster.need;button.querySelector('.jw-charge-track i').style.width=have/booster.need*100+'%';button.style.setProperty('--fill',have/booster.need*100+'%');button.classList.toggle('ready',ready);button.classList.toggle('aim',ctl.aim===index);button.disabled=!(ready&&canAct());}
  wrap.inert=ctl.handover||ctl.legacy;$('#jwBoostBar').inert=ctl.handover||ctl.legacy;syncGrid();
}
function renderStatus(){
  const state=ctl.state;if(!state)return;
  let text=ctl.aim>=0?BOOSTERS[ctl.aim].name+' · اختر جوهرة لتحديد الضربة':ctl.pending?'نؤكّد حركتك مع السيرفر…':timedOut()?'انتهى الوقت · نجهّز النتيجة':ctl.busy?'':player()?.done?'جولتك محفوظة':player()?.remaining<=5?'باقي القليل… اجعلها أقوى سلسلة!':'اصنع تطابقًا، وافتح سلسلة جديدة';
  let span=$('#status .jw-say');if(!span){span=document.createElement('span');span.className='jw-say';$('#status').prepend(span);}span.textContent=text;$('#status').classList.toggle('pending',Boolean(ctl.pending));$('#status').classList.toggle('aiming',ctl.aim>=0);syncGrid();
}
function scheduleHint(){clearTimeout(ctl.idleTimer);if(!canAct())return;const epoch=ctl.epoch;ctl.idleTimer=setTimeout(()=>{if(!currentMatch(epoch)||!canAct()||ctl.selected>=0||ctl.aim>=0)return;ctl.hint=chooseHint();paintSelection();},7500);}
function revealBot(){
  if(ctl.mode!=='ai'||!ctl.state)return;
  const own=ctl.state.players[0],index=own.done?ctl.botHistory.length-1:Math.min(own.used,ctl.botHistory.length-1),summary=ctl.botHistory[Math.max(0,index)];
  if(summary){ctl.state={...ctl.state,players:[own,cloneValue(summary)]};if(own.done&&ctl.botReady)ctl.state=finishJewelsRace(ctl.state);}
}
function prepareBot(){
  const epoch=ctl.epoch;let work=createJewelsRace(ctl.names,{seed:ctl.state.initialSeed,durationMs:0,moves:ctl.state.moves});ctl.botHistory=[cloneValue(work.players[1])];ctl.botReady=false;
  const step=()=>{if(!currentMatch(epoch)||ctl.mode!=='ai'||ctl.state.finished)return;try{const move=chooseJewelsRaceMove(work,1,ctl.level);work=move?.type==='booster'?playJewelsRaceBooster(work,1,move.id,move.cell):move?playJewelsRaceSwap(work,1,move.a,move.b):finishJewelsRace(work,{seat:1});ctl.botHistory.push(cloneValue(work.players[1]));ctl.botReady=work.players[1].done;revealBot();renderHud();if(ctl.state.players[0].done)afterRun();if(!ctl.botReady)ctl.botTimer=setTimeout(step,12);}catch(error){console.error('jewels practice run',error);ctl.botReady=true;work=finishJewelsRace(work,{seat:1});ctl.botHistory.push(cloneValue(work.players[1]));revealBot();afterRun();}};
  ctl.botTimer=setTimeout(step,30);
}
function renderClock(){
  if(!ctl.state)return;const end=deadline(),remaining=end?Math.max(0,Math.ceil((end-clockNow())/1000)):null,element=$('#jwMatchClock');element.textContent=remaining===null?'25 حركة':Math.floor(remaining/60)+':'+String(remaining%60).padStart(2,'0');element.classList.toggle('urgent',remaining!==null&&remaining<=20&&!ctl.state.finished);element.setAttribute('aria-label',remaining===null?'25 حركة لكل لاعب':remaining+' ثانية متبقية');
}
function tickClock(){
  renderClock();if(!ctl.state||ctl.state.finished||ctl.handover||!timedOut())return;
  if(ctl.mode==='online'){renderHud();renderStatus();return;}
  if(player()?.done)return;
  const seat=mySeat();ctl.state=finishJewelsRace(ctl.state,{seat});renderer.cancel();ctl.busy=false;clearTimeout(ctl.pending?.timer);ctl.pending=null;renderer.setBoard(player()?.board);renderHud();renderStatus();afterRun();
}
function afterRun(){
  if(!ctl.state)return;revealBot();renderHud();renderStatus();renderClock();
  if(ctl.state.finished){showEnd();return;}
  if(player()?.done){clearTimeout(ctl.idleTimer);if(ctl.mode==='two'&&ctl.seat===0){showHandover();return;}$('#jwWait').hidden=false;$('#jwWaitScore').textContent=player().score+' نقطة';$('#jwWaitText').textContent=ctl.mode==='ai'?'الكمبيوتر يكمل حساب نتيجته…':'الخصم يكمل حركاته. نتيجتك محفوظة.';}else{$('#jwWait').hidden=true;scheduleHint();}
}
async function runLocal(resolve){
  const epoch=ctl.epoch,seat=mySeat();if(!canAct())return false;let next;
  try{next=resolve(ctl.state);}catch{return false;}
  ctl.state=next;ctl.busy=true;ctl.aim=-1;ctl.selected=-1;ctl.aimCell=-1;ctl.hint=null;clearTimeout(ctl.idleTimer);paintSelection();renderHud();renderStatus();
  try{await renderer.animate(next.players[seat].last);}finally{if(currentMatch(epoch))ctl.busy=false;}
  if(!currentMatch(epoch))return false;
  renderer.setBoard(player()?.board);ctl.shownSeq=player()?.seq||0;afterRun();return true;
}
async function revertPending(message){
  const pending=ctl.pending;if(!pending)return;clearTimeout(pending.timer);ctl.pending=null;ctl.busy=false;if(!ctl.state)return;renderer.setBoard(player()?.board);ctl.selected=-1;ctl.aim=-1;paintSelection();renderHud();renderStatus();scheduleHint();if(message)window.BS_PLATFORM?.toast?.(message);
}
function sendAction(type,payload){
  ctl.pending={seq:player().seq,kind:type,timer:0};ctl.aim=-1;ctl.selected=-1;ctl.hint=null;clearTimeout(ctl.idleTimer);paintSelection();renderHud();renderStatus();
  if(!table?.client?.send(type,{...payload,seq:ctl.pending.seq})){revertPending('الاتصال غير جاهز، جرّب مرة ثانية');return;}
  const epoch=ctl.epoch;ctl.pending.timer=setTimeout(()=>{if(currentMatch(epoch))revertPending('تأخر تأكيد الحركة، جرّب مرة ثانية');},9000);
}
async function trySwap(a,b){
  if(!canAct()||!adjacent(a,b))return false;const epoch=ctl.epoch,seat=mySeat();ctl.selected=-1;ctl.hint=null;paintSelection();
  const pair=legalRaceSwaps(ctl.state,seat).some(([x,y])=>x===a&&y===b||x===b&&y===a);
  if(!pair){ctl.busy=true;renderHud();renderStatus();await renderer.swap(a,b,true);if(!currentMatch(epoch))return false;ctl.busy=false;renderHud();renderStatus();sound('error',.2);scheduleHint();return false;}
  if(ctl.mode==='online'){sendAction('jewels_swap',{a,b});return true;}
  return runLocal(state=>playJewelsRaceSwap(state,seat,a,b,{expectedSeq:state.players[seat].seq}));
}
function boosterTap(index){if(!canAct()||!BOOSTERS[index]||(player().charge?.[index]||0)<BOOSTERS[index].need)return;ctl.aim=ctl.aim===index?-1:index;ctl.selected=-1;ctl.aimCell=ctl.aim>=0?ctl.cursor:-1;ctl.hint=null;paintSelection();renderHud();renderStatus();if(ctl.aim>=0){sound('open',.25);wrap.focus({preventScroll:true});}}
async function useBooster(cell){if(!canAct()||ctl.aim<0||cell<0||cell>=N)return false;const index=ctl.aim,id=BOOSTERS[index].id,seat=mySeat();if(ctl.mode==='online'){sendAction('jewels_booster',{id,cell});return true;}banner(BOOSTERS[index].name+'!');return runLocal(state=>playJewelsRaceBooster(state,seat,id,cell,{expectedSeq:state.players[seat].seq}));}
function cellAt(event){const rect=canvas.getBoundingClientRect(),geo=renderer.geometry(),scale=geo.size/rect.width,x=Math.floor(((event.clientX-rect.left)*scale-geo.pad)/geo.cell),y=Math.floor(((event.clientY-rect.top)*scale-geo.pad)/geo.cell);return x>=0&&y>=0&&x<W&&y<H?y*W+x:-1;}
canvas.addEventListener('pointerdown',event=>{
  if(event.button!==0||event.isPrimary===false||drag)return;const index=cellAt(event);if(index<0||!canAct())return;event.preventDefault();unlock();ctl.cursor=index;wrap.focus({preventScroll:true});
  if(ctl.aim>=0){ctl.aimCell=index;drag={aim:true,index,pointerId:event.pointerId};paintSelection();try{canvas.setPointerCapture(event.pointerId);}catch{}return;}
  if(ctl.selected>=0&&ctl.selected!==index&&adjacent(ctl.selected,index)){const from=ctl.selected;trySwap(from,index);return;}
  ctl.selected=index;drag={index,x:event.clientX,y:event.clientY,pointerId:event.pointerId};paintSelection();sound('select',.12);try{canvas.setPointerCapture(event.pointerId);}catch{}
});
canvas.addEventListener('pointermove',event=>{
  if(!drag||drag.pointerId!==event.pointerId)return;if(drag.aim){const index=cellAt(event);if(index>=0){ctl.aimCell=index;paintSelection();}return;}
  const dx=event.clientX-drag.x,dy=event.clientY-drag.y,threshold=renderer.geometry().cell*.28;if(Math.max(Math.abs(dx),Math.abs(dy))<threshold)return;
  const col=drag.index%W,row=Math.floor(drag.index/W),[x,y]=Math.abs(dx)>Math.abs(dy)?[col+Math.sign(dx),row]:[col,row+Math.sign(dy)],from=drag.index;drag=null;if(x>=0&&x<W&&y>=0&&y<H)trySwap(from,y*W+x);else{ctl.selected=-1;paintSelection();}
});
canvas.addEventListener('pointerup',event=>{if(!drag||drag.pointerId!==event.pointerId||event.button!==0)return;const aiming=drag.aim;drag=null;if(aiming){const index=cellAt(event);if(index>=0)useBooster(index);}});
canvas.addEventListener('pointercancel',event=>{if(drag?.pointerId===event.pointerId)clearSelection();});
canvas.addEventListener('contextmenu',event=>event.preventDefault());
wrap.addEventListener('keydown',event=>{
  if(!ctl.state||ctl.handover||ctl.legacy)return;const col=ctl.cursor%W,row=Math.floor(ctl.cursor/W);let next=ctl.cursor;
  if(event.key==='ArrowRight')next=row*W+Math.min(W-1,col+1);else if(event.key==='ArrowLeft')next=row*W+Math.max(0,col-1);else if(event.key==='ArrowDown')next=Math.min(H-1,row+1)*W+col;else if(event.key==='ArrowUp')next=Math.max(0,row-1)*W+col;else if(event.key==='Home')next=event.ctrlKey?0:row*W;else if(event.key==='End')next=event.ctrlKey?N-1:row*W+W-1;else if(event.key==='Escape'){event.preventDefault();clearSelection();return;}else if(event.key==='Enter'||event.key===' '){event.preventDefault();if(!canAct())return;unlock();if(ctl.aim>=0)useBooster(ctl.cursor);else if(ctl.selected>=0&&adjacent(ctl.selected,ctl.cursor))trySwap(ctl.selected,ctl.cursor);else ctl.selected=ctl.selected===ctl.cursor?-1:ctl.cursor;paintSelection();return;}else return;
  event.preventDefault();ctl.cursor=next;if(ctl.aim>=0)ctl.aimCell=next;paintSelection();
});
wrap.addEventListener('focus',paintSelection);wrap.addEventListener('blur',paintSelection);
$('#jwCancel').addEventListener('click',clearSelection);
$('#jwHint').addEventListener('click',()=>{if(!canAct())return;ctl.hint=chooseHint();if(ctl.hint)ctl.cursor=ctl.hint[0];paintSelection();wrap.focus({preventScroll:true});});
function resetActivity(){ctl.epoch++;renderer.cancel();for(const timer of [ctl.idleTimer,ctl.botTimer,ctl.pending?.timer,bannerTimer,endTimer])clearTimeout(timer);clearInterval(ctl.clockTimer);ctl.pending=null;ctl.busy=false;ctl.aim=-1;ctl.selected=-1;ctl.cursor=0;ctl.hint=null;ctl.aimCell=-1;ctl.handover=false;ctl.legacy=false;ctl.endShown=false;ctl.deadline=null;ctl.botHistory=[];ctl.botReady=false;drag=null;$('#jwBanner').classList.remove('show');for(const id of ['#jwEnd','#jwHandover','#jwWait','#jwLegacy'])$(id).hidden=true;wrap.inert=false;$('#jwBoostBar').inert=false;}
function showGame(){
  $('#menu').hidden=true;$('#game').hidden=false;document.body.classList.add('game-running');buildHud();fitBoard();requestAnimationFrame(fitBoard);paintSelection();renderHud();renderStatus();renderClock();clearInterval(ctl.clockTimer);ctl.clockTimer=setInterval(tickClock,250);
}
function showMenu(){resetActivity();ctl.state=null;$('#game').hidden=true;$('#menu').hidden=false;document.body.classList.remove('game-running');renderer.setBoard([]);$('#jwTitle').focus?.({preventScroll:true});paintHero();}
function myUser(){const user=window.BS_SOCIAL?.isLoggedIn?.()?window.BS_SOCIAL.profile?.():null;return user?{username:user.username,photo:user.photo||null}:null;}
function startLocal(mode){
  table?.leave();
  resetActivity();ctl.mode=mode;ctl.me=0;ctl.seat=0;ctl.rewarded=false;ctl.receipt='jewels:'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);ctl.clockOffset=0;
  const name=window.BS_GAME_MENU?.playerName?.()||'أنت';ctl.names=mode==='ai'?[name,'الكمبيوتر']:[$('#jwName1').value.trim()||'اللاعب الأول',$('#jwName2').value.trim()||'اللاعب الثاني'];ctl.bots=mode==='ai'?[false,true]:[false,false];ctl.users=mode==='ai'?[myUser(),{photo:{kind:'preset',id:'h-robot'}}]:[myUser(),null];
  ctl.state=createJewelsRace(ctl.names,{durationMs:mode==='two'?0:JR.DURATION_MS});ctl.deadline=mode==='two'?Date.now()+JR.DURATION_MS:null;ctl.shownSeq=0;renderer.setBoard(player().board);showGame();scheduleHint();banner(mode==='two'?'جولتك يا '+ctl.names[0]:'25 حركة… اصنع نتيجتك!');sound('go',.38);if(mode==='ai')prepareBot();
}
function showHandover(){
  if(ctl.handover)return;ctl.handover=true;ctl.deadline=null;ctl.selected=-1;ctl.aim=-1;ctl.hint=null;renderer.cancel();$('#jwHandoverTitle').textContent='سلّم الجهاز إلى '+ctl.names[1];$('#jwHandover').hidden=false;$('#jwWait').hidden=true;renderHud();paintSelection();$('#jwHandoverStart').focus({preventScroll:true});
}
$('#jwHandoverStart').addEventListener('click',()=>{if(!ctl.state||ctl.mode!=='two'||!ctl.handover)return;unlock();ctl.handover=false;ctl.seat=1;ctl.cursor=0;ctl.shownSeq=0;ctl.deadline=Date.now()+JR.DURATION_MS;$('#jwHandover').hidden=true;renderer.setBoard(player().board);buildHud();renderHud();renderStatus();renderClock();paintSelection();scheduleHint();wrap.focus({preventScroll:true});banner('جولتك يا '+ctl.names[1]);sound('go',.38);});
function showEnd(){
  if(ctl.endShown||!ctl.state?.finished)return;ctl.endShown=true;clearInterval(ctl.clockTimer);clearTimeout(ctl.idleTimer);$('#jwWait').hidden=true;$('#jwHandover').hidden=true;const state=ctl.state,winner=state.winner,draw=winner===-1,own=mySeat(),won=winner===own,epoch=ctl.epoch;$('#jwEndTitle').textContent=draw?'تعادل جميل!':ctl.mode==='two'?ctl.names[winner]+' فاز!':won?'هذه لحظة فوزك!':'التحدّي القادم لك';$('#jwEndEyebrow').textContent=draw?'نفس النتيجة. نفس المهارة.':won||ctl.mode==='two'?'يا سلام على اللعب!':'كل سباق يعلّمك حركة';
  const result=(seat,side)=>{const element=document.createElement('div');element.className='jw-end-player '+side+(seat===winner?' winner':'');element.append(faceOf(seat));element.insertAdjacentHTML('beforeend',`<small>${escapeText(ctl.names[seat])}</small><b>${state.players[seat].score}</b><span>نقطة</span>`);return element;};
  const versus=document.createElement('i');versus.textContent='VS';$('#jwEndScores').replaceChildren(result(own,'me'),versus,result(1-own,'foe'));const diff=Math.abs(state.players[0].score-state.players[1].score);$('#jwEndText').textContent=draw?'تساوت النقاط؛ الفوز القادم ينتظر خطتك.':'حُسم السباق بفارق '+diff+' نقطة';const p=state.players[own];$('#jwEndStats').innerHTML=`<span><b>${p.best||0}</b><small>أكبر ضربة</small></span><span><b>${p.specials||0}</b><small>جواهر خاصة</small></span><span><b>${p.used||0}/${state.moves}</b><small>حركة مستخدمة</small></span>`;
  $('#jwEnd .jw-sheet-card').classList.toggle('won',won||ctl.mode==='two');$('#jwAgain').textContent=ctl.mode==='online'&&!room?.publicMatch?(room?.me?.role==='host'?'تحدٍ جديد':'بانتظار المضيف'):'تحدٍ جديد';$('#jwAgain').disabled=ctl.mode==='online'&&!room?.publicMatch&&room?.me?.role!=='host';
  const reveal=()=>{if(!currentMatch(epoch)||!ctl.endShown)return;$('#jwEnd').hidden=false;wrap.inert=true;$('#jwAgain').disabled?$('#jwToMenu').focus():$('#jwAgain').focus();};if(reduced())reveal();else endTimer=setTimeout(reveal,650);sound(draw?'levelUp':won||ctl.mode==='two'?'victory':'defeat',.55);
  if(!ctl.rewarded){ctl.rewarded=true;if(ctl.mode==='online')window.BS_CAREER?.refresh?.()?.catch?.(()=>{});else if(ctl.mode==='ai')window.BS_CAREER?.record?.({id:ctl.receipt,game:'jewels',win:winner===0,draw:winner===-1})?.catch?.(()=>{});}
}
$('#jwAgain').addEventListener('click',()=>{if(ctl.mode==='online')table?.again();else startLocal(ctl.mode);});
function leaveMatch(){if(ctl.mode==='online')table?.leave();showMenu();}
$('#jwToMenu').addEventListener('click',leaveMatch);$('#jwLegacyBack').addEventListener('click',leaveMatch);
$('#jwExit').addEventListener('click',()=>{if(ctl.state&&!ctl.state.finished&&Date.now()-exitArmed>2500){exitArmed=Date.now();window.BS_PLATFORM?.toast?.('اضغط مرة ثانية للخروج من السباق');return;}leaveMatch();});
for(const id of ['#jwEnd','#jwHandover','#jwLegacy'])$(id).addEventListener('keydown',event=>{if(event.key!=='Tab')return;const controls=Array.from($(id).querySelectorAll('button,a,input')).filter(element=>!element.disabled&&!element.hidden),first=controls[0],last=controls[controls.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}});
function incomingState(incoming){
  if(!ctl.state||ctl.mode!=='online')return incoming;return {...incoming,players:incoming.players.map((p,i)=>(p.seq||0)>=(ctl.state.players[i]?.seq||0)?p:ctl.state.players[i])};
}
async function apply(next,{animate=false,signal}={}){
  if(signal?.aborted)return;
  room=next;const incoming=next.state;if(!incoming||incoming.game!=='jewels')return;const match=next.startedAt||incoming.startedAt||0,fresh=ctl.mode!=='online'||$('#game').hidden||ctl.match!==match;
  if(incoming.v!==2||incoming.mode!=='race'){if(fresh){resetActivity();ctl.mode='online';ctl.state=incoming;ctl.match=match;$('#menu').hidden=true;$('#game').hidden=false;ctl.legacy=true;$('#jwLegacy').hidden=false;wrap.inert=true;$('#jwLegacyBack').focus();}return;}
  const seat=next.me?.index??0;if(!Array.isArray(incoming.players?.[seat]?.board))return;
  if(fresh){resetActivity();ctl.mode='online';ctl.me=seat;ctl.seat=seat;ctl.match=match;ctl.rewarded=false;ctl.state=null;}
  ctl.me=seat;ctl.clockOffset=(Number(next.serverNow)||Date.now())-(Number(next.clientReceivedAt)||Date.now());ctl.names=[0,1].map(i=>next.players?.find(p=>p.index===i)?.name||incoming.players[i]?.name||'لاعب');ctl.bots=[0,1].map(i=>Boolean(next.players?.find(p=>p.index===i)?.bot));ctl.users=[0,1].map(i=>{const p=next.players?.find(p=>p.index===i),character=p?.look?.character;return p?.username?{username:p.username,fallback:character?'/assets/heroes/face/'+character+'.webp':''}:character?{fallback:'/assets/heroes/face/'+character+'.webp'}:null;});
  const previous=ctl.state,state=incomingState(incoming),own=state.players[seat],oldSeq=previous?.players[seat]?.seq??-1;ctl.state=state;
  if(fresh){ctl.shownSeq=own.seq||0;renderer.setBoard(own.board);showGame();afterRun();return;}
  if(ctl.pending&&(own.seq>ctl.pending.seq||state.finished)){clearTimeout(ctl.pending.timer);ctl.pending=null;}
  if(own.seq===oldSeq){renderHud();renderStatus();renderClock();if(state.finished&&!ctl.busy)afterRun();return;}
  const epoch=ctl.epoch;ctl.selected=-1;ctl.hint=null;ctl.aim=-1;ctl.aimCell=-1;paintSelection();
  if(animate&&!document.hidden&&own.last&&own.last.seq>ctl.shownSeq){ctl.scores[seat]=Math.max(0,own.score-(own.last.total||0));const score=document.querySelector(`.jw-plate[data-seat="${seat}"] .jw-score`);if(score)score.textContent=ctl.scores[seat];ctl.busy=true;renderHud();renderStatus();const abortReplay=()=>{if(!currentMatch(epoch))return;renderer.cancel();renderer.setBoard(player()?.board);ctl.busy=false;ctl.shownSeq=Math.max(ctl.shownSeq,own.seq);renderHud();renderStatus();};signal?.addEventListener?.('abort',abortReplay,{once:true});try{await renderer.animate(own.last);}finally{signal?.removeEventListener?.('abort',abortReplay);if(currentMatch(epoch))ctl.busy=false;}}
  if(!currentMatch(epoch)||signal?.aborted)return;ctl.shownSeq=Math.max(ctl.shownSeq,own.seq);renderer.setBoard(player().board);paintSelection();afterRun();
}
try{table=createTable({game:'jewels',quickNote:'نفس البداية، 25 حركة، والنتيجة الأعلى تفوز.',roomNote:'أنشئ غرفة وشارك رمزها. كل لاعب يلعب جولته كاملة.',lobbyNote:(_next,isPublic)=>isPublic?'سباقك يبدأ بعد العد التنازلي.':'شارك الرمز، ثم ابدأ سباقًا بنفس لوحة البداية.',apply,onLobby:()=>{if(!$('#game').hidden)showMenu();setMode('online');},onMenu:()=>{if(!$('#game').hidden)showMenu();},onStatus:()=>{},onError:message=>{if(ctl.pending)revertPending(message);else window.BS_PLATFORM?.toast?.(message);}});}catch(error){console.error('jewels online unavailable',error);}
function setMode(mode){for(const button of document.querySelectorAll('.jw-modes button'))button.setAttribute('aria-checked',String(button.dataset.mode===mode));for(const panel of document.querySelectorAll('.jw-panel'))panel.hidden=panel.dataset.panel!==mode;try{localStorage.setItem('bs-jewels-mode',mode);}catch{}}
function setLevel(level){ctl.level=level;for(const button of document.querySelectorAll('#jwLevel button'))button.setAttribute('aria-checked',String(button.dataset.v===level));try{localStorage.setItem('bs-jewels-level',level);}catch{}}
for(const button of document.querySelectorAll('.jw-modes button'))button.addEventListener('click',()=>{sound('select',.2);setMode(button.dataset.mode);});for(const button of document.querySelectorAll('#jwLevel button'))button.addEventListener('click',()=>setLevel(button.dataset.v));
$('#jwStartAi').addEventListener('click',()=>{unlock();startLocal('ai');});$('#jwStartTwo').addEventListener('click',()=>{unlock();startLocal('two');});
{let mode='online',level='medium';try{mode=localStorage.getItem('bs-jewels-mode')||'online';level=localStorage.getItem('bs-jewels-level')||'medium';}catch{}if(/[?&]room=\d{6}/.test(location.search))mode='online';setMode(['online','ai','two'].includes(mode)?mode:'online');setLevel(['easy','medium','hard'].includes(level)?level:'medium');}
function paintMute(){const muted=Boolean(window.BS_AUDIO?.getSettings?.().muted),icon=muted?'<path d="m16 9 5 6m0-6-5 6"/>':'<path d="M16 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/>';for(const id of ['#jwMute','#jwSound']){const button=$(id);button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4Z"/>'+icon+'</svg>';button.setAttribute('aria-pressed',String(muted));button.setAttribute('aria-label',muted?'تشغيل الصوت':'كتم الصوت');}}
for(const id of ['#jwMute','#jwSound'])$(id).addEventListener('click',()=>{unlock();window.BS_AUDIO?.toggleMuted?.();paintMute();});addEventListener('bs-audio-change',paintMute);paintMute();addEventListener('resize',()=>{if(!$('#game').hidden)fitBoard();else paintHero();});addEventListener('visibilitychange',()=>{if(!document.hidden)tickClock();});
let heroFrame=0;
function coverReady(){return Boolean($('#jwCover')?.complete&&$('#jwCover')?.naturalWidth>0);}
function paintHero(){const cv=$('#jwHero');if(!cv||$('#menu').hidden||coverReady())return;drawStudioHero(cv.getContext('2d'),cv.width,cv.height,performance.now());}
function heroLoop(now){heroFrame=0;if($('#menu').hidden||reduced()||coverReady())return;const cv=$('#jwHero');drawStudioHero(cv.getContext('2d'),cv.width,cv.height,now);heroFrame=requestAnimationFrame(heroLoop);}
function paintPerformance(){document.body.classList.toggle('jw-light-effects',lightEffects);for(const b of document.querySelectorAll('[data-jw-performance]')){b.setAttribute('aria-pressed',String(lightEffects));b.setAttribute('aria-label',lightEffects?'إيقاف الوضع الخفيف':'تشغيل الوضع الخفيف لتقليل المؤثرات');b.title=lightEffects?'الوضع الخفيف مفعّل':'تقليل المؤثرات';}}
for(const b of document.querySelectorAll('[data-jw-performance]'))b.addEventListener('click',()=>{lightEffects=!lightEffects;try{localStorage.setItem('bs_jewels_light_effects',lightEffects?'1':'0');}catch{}paintPerformance();if(!$('#game').hidden)fitBoard();});paintPerformance();
$('#jwCover')?.addEventListener('load',()=>{if(heroFrame)cancelAnimationFrame(heroFrame);heroFrame=0;$('#jwHero').hidden=true;});
$('#jwCover')?.addEventListener('error',()=>{$('#jwCover').hidden=true;$('#jwHero').hidden=false;paintHero();});
if(coverReady())$('#jwHero').hidden=true;else{paintHero();if(!reduced())heroFrame=requestAnimationFrame(heroLoop);}
window.BS_JEWELS=Object.freeze({get state(){return ctl.state;},get busy(){return ctl.busy||Boolean(ctl.pending);},get seat(){return mySeat();},get geometry(){return renderer.geometry();},get lightEffects(){return lightEffects;},hint:()=>suggestJewelsSwap(player()?.board),swap:trySwap,booster:(index,cell)=>{boosterTap(index);return ctl.aim>=0?useBooster(cell):null;},legal:()=>ctl.state?.v===2?legalRaceSwaps(ctl.state,mySeat()):[]});
