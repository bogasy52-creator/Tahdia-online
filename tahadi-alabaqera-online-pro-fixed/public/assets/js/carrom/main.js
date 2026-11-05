import {createCarrom,placeStriker,shootCarrom,stepCarrom,chooseCarromShot,carromScore,FIXED_DT} from './engine.js';
import {createCarromRenderer} from './render.js';
const $=id=>document.getElementById(id),KEY='bs-carrom-settings-v1';
let saved={};try{saved=JSON.parse(localStorage.getItem(KEY))||{};}catch{}
const prefs={mode:saved.mode==='hotseat'?'hotseat':'ai',theme:saved.theme==='club'?'club':'walnut',difficulty:saved.difficulty==='expert'?'expert':'normal',muted:!!saved.muted,wins:Number(saved.wins)||0};
const persist=()=>{try{localStorage.setItem(KEY,JSON.stringify(prefs));}catch{}};
const canvas=$('carromBoard'),renderer=createCarromRenderer(canvas);
let state=null,running=false,paused=false,frame=0,last=0,accumulator=0,angle=-Math.PI/2,power=.55,viewSeat=0,turnSeen=-1,botAt=0,botPlan=null,pointer=null,resultTimer=0;
let audio=null,lastSound=0;
function tone(kind,strength=1){
 if(prefs.muted)return;
 try{
  audio??=new (window.AudioContext||window.webkitAudioContext)();
  if(audio.state==='suspended')audio.resume();
  const now=audio.currentTime;
  if(kind==='collision'&&now-lastSound<.045)return;
  lastSound=now;
  const osc=audio.createOscillator(),gain=audio.createGain();
  osc.type=kind==='win'?'sine':'triangle';osc.frequency.setValueAtTime(kind==='pocket'?260:kind==='win'?660:kind==='strike'?145:420,now);
  osc.frequency.exponentialRampToValueAtTime(kind==='pocket'?95:kind==='win'?880:90,now+.11);
  gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.045*Math.max(.15,strength),now+.005);gain.gain.exponentialRampToValueAtTime(.0001,now+.15);
  osc.connect(gain);gain.connect(audio.destination);osc.start(now);osc.stop(now+.17);
 }catch{}
}
function canPlay(){return running&&!paused&&state?.phase==='aim'&&(state.mode==='hotseat'||state.turn===0);}
function draw(){if(state)renderer.draw(state,{angle,power,seat:viewSeat,aim:state.phase==='aim'&&!paused});}
function resize(){
 const box=$('carromSurface').getBoundingClientRect();
 if(box.width&&box.height){renderer.resize(box.width,box.height);draw();}
}
new ResizeObserver(resize).observe($('carromSurface'));
function names(){return state?.mode==='hotseat'?['اللاعب الأول','اللاعب الثاني']:['أنت','الكمبيوتر'];}
function controls(){
 const enabled=canPlay();
 for(const id of ['strikerPosition','shotPower','shoot'])$(id).disabled=!enabled;
 $('shoot').textContent=state?.phase==='moving'?'الأحجار تتحرك…':enabled?'اضرب':'الكمبيوتر يصوّب…';
 $('powerValue').textContent=Math.round(power*100)+'٪';
 $('shotPower').value=String(Math.round(power*100));
 if(!state)return;
 const scores=carromScore(state),labels=names();
 for(let i=0;i<2;i++){
  $('player'+i).classList.toggle('active',state.turn===i&&state.phase!=='finished');
  $('name'+i).textContent=labels[i];
  $('score'+i).textContent=scores[i].coins+' / 9';
  $('due'+i).textContent=scores[i].due?'جزاء '+scores[i].due:scores[i].queen?'الملكة +3':i===0?'أبيض':'أسود';
 }
 $('carromStatus').textContent=state.message;
 $('queenStatus').textContent=state.queen.status==='covered'?'الملكة مغطّاة':state.queen.pending!==null?'بانتظار التغطية':'الملكة';
 $('queenStatus').classList.toggle('pending',state.queen.pending!==null);
}
function onTurn(){
 if(state.turnNo===turnSeen)return;
 turnSeen=state.turnNo;viewSeat=state.mode==='hotseat'?state.turn:0;
 angle=state.turn===0?-Math.PI/2:Math.PI/2;
 $('strikerPosition').value=String(viewSeat?1000-state.striker.x:state.striker.x);
 pointer=null;
 if(state.mode==='ai'&&state.turn===1&&state.phase==='aim'){
  botPlan=chooseCarromShot(state);placeStriker(state,botPlan.x);
  angle=botPlan.angle;power=botPlan.power;botAt=performance.now()+900;
  state.message='الكمبيوتر يجهّز ضربته…';
 }else{botPlan=null;power=.55;}
 controls();
}
function start(){
 clearTimeout(resultTimer);cancelAnimationFrame(frame);frame=0;
 prefs.mode=$('carromMode').value;prefs.theme=$('carromTheme').value;prefs.difficulty=$('carromDifficulty').value;persist();
 state=createCarrom(prefs);running=true;paused=false;turnSeen=-1;accumulator=0;pointer=null;
 $('carromMenu').hidden=true;$('carromGame').hidden=false;$('carromPause').hidden=true;$('carromResult').hidden=true;
 renderer.setTheme(prefs.theme);resize();onTurn();last=performance.now();frame=requestAnimationFrame(loop);
}
function menu(){
 running=false;paused=false;clearTimeout(resultTimer);cancelAnimationFrame(frame);frame=0;
 $('carromGame').hidden=true;$('carromMenu').hidden=false;$('carromPause').hidden=true;$('carromResult').hidden=true;
 pointer=null;
}
function pause(value){
 if(!running||state?.phase==='finished')return;
 paused=value;$('carromPause').hidden=!value;pointer=null;
 cancelAnimationFrame(frame);frame=0;
 if(!value){last=performance.now();botAt=last+700;accumulator=0;frame=requestAnimationFrame(loop);}
 controls();
}
function fire(){
 if(!canPlay())return;
 try{shootCarrom(state,{x:state.striker.x,angle,power});tone('strike',power);pointer=null;controls();}
 catch(e){$('carromStatus').textContent=e.message;}
}
function finish(){
 if(resultTimer||!running)return;
 const winner=names()[state.winner],scores=carromScore(state);
 if(state.mode==='ai'&&state.winner===0){prefs.wins++;persist();}
 $('carromWinner').textContent=winner+' فاز بالطاولة';
 $('carromResultCopy').textContent='9 أحجار'+(scores[state.winner].queen?' · الملكة مغطّاة +3':'')+' · '+state.shots[state.winner]+' ضربات';
 $('carromWinnerDisc').className='cm-winner-disc '+(state.winner===0?'light':'dark');
 tone('win');
 resultTimer=setTimeout(()=>{$('carromResult').hidden=false;resultTimer=0;},550);
}
function loop(now){
 frame=0;if(!running||paused)return;
 const delta=Math.max(0,Math.min(.08,(now-last)/1000));last=now;
 if(state.phase==='moving'){
  accumulator=Math.min(.15,accumulator+delta);
  while(accumulator>=FIXED_DT&&state.phase==='moving'){
   stepCarrom(state,FIXED_DT);accumulator-=FIXED_DT;
   for(const e of state.events)if(['collision','pocket'].includes(e.type))tone(e.type,e.strength||.8);
  }
  if(state.phase==='aim'){accumulator=0;onTurn();controls();}
  if(state.phase==='finished'){controls();finish();}
 }else if(state.phase==='aim'&&botPlan&&now>=botAt){
  try{shootCarrom(state,botPlan);tone('strike',botPlan.power);botPlan=null;controls();}
  catch{botPlan=chooseCarromShot(state);placeStriker(state,botPlan.x);botAt=now+500;}
 }
 draw();
 if(state.phase!=='finished')frame=requestAnimationFrame(loop);
}
function updateAim(point,pull=false){
 const dx=pull?state.striker.x-point.x:point.x-state.striker.x,dy=pull?state.striker.y-point.y:point.y-state.striker.y;
 if(Math.hypot(dx,dy)<8)return;
 angle=Math.atan2(dy,dx);
 if(pull)power=Math.max(.08,Math.min(1,Math.hypot(dx,dy)/220));
 controls();draw();
}
canvas.addEventListener('pointerdown',e=>{
 if(!canPlay())return;e.preventDefault();
 const p=renderer.point(e.clientX,e.clientY,viewSeat);
 pointer={id:e.pointerId,pull:Math.hypot(p.x-state.striker.x,p.y-state.striker.y)<100,start:p,moved:false};
 canvas.setPointerCapture(e.pointerId);
 if(!pointer.pull)updateAim(p);
});
canvas.addEventListener('pointermove',e=>{
 if(!pointer||pointer.id!==e.pointerId||!canPlay())return;
 const p=renderer.point(e.clientX,e.clientY,viewSeat);pointer.moved=Math.hypot(p.x-pointer.start.x,p.y-pointer.start.y)>25;
 updateAim(p,pointer.pull);
});
canvas.addEventListener('pointerup',e=>{
 if(!pointer||pointer.id!==e.pointerId)return;
 const shot=pointer.pull&&pointer.moved;pointer=null;if(shot)fire();
});
canvas.addEventListener('pointercancel',()=>{pointer=null;});
canvas.addEventListener('lostpointercapture',()=>{pointer=null;});
$('strikerPosition').addEventListener('input',()=>{
 if(canPlay()){const x=Number($('strikerPosition').value);placeStriker(state,viewSeat?1000-x:x);draw();}
});
$('shotPower').addEventListener('input',()=>{if(canPlay()){power=Number($('shotPower').value)/100;controls();draw();}});
$('shoot').onclick=fire;$('carromStart').onclick=start;$('carromExit').onclick=menu;
$('carromPauseButton').onclick=()=>pause(true);$('carromResume').onclick=()=>pause(false);
$('carromRestart').onclick=start;$('carromAgain').onclick=start;$('carromBackMenu').onclick=menu;
$('carromMute').onclick=()=>{prefs.muted=!prefs.muted;persist();$('carromMute').setAttribute('aria-pressed',String(prefs.muted));$('carromMute').textContent=prefs.muted?'الصوت مغلق':'الصوت';};
$('carromFullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('carromGame').requestFullscreen();}catch{}};
for(const [id,value] of [['carromMode',prefs.mode],['carromTheme',prefs.theme],['carromDifficulty',prefs.difficulty]])$(id).value=value;
$('carromMute').setAttribute('aria-pressed',String(prefs.muted));
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause(true);});
document.addEventListener('keydown',e=>{
 if(!running||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
 if(e.key==='Escape'||e.key.toLowerCase()==='p'){e.preventDefault();pause(!paused);return;}
 if(!canPlay())return;
 if((e.key==='Enter'||e.key===' ')&&e.target.closest('button,a'))return;
 if(['ArrowLeft','ArrowRight'].includes(e.key)){
  e.preventDefault();const viewX=(viewSeat?1000-state.striker.x:state.striker.x)+(e.key==='ArrowLeft'?-15:15);
  placeStriker(state,viewSeat?1000-viewX:viewX);$('strikerPosition').value=String(viewSeat?1000-state.striker.x:state.striker.x);draw();
 }else if(['a','d'].includes(e.key.toLowerCase())){angle+=(e.key.toLowerCase()==='a'?-.045:.045);draw();}
 else if(e.key==='Enter'||e.key===' '){e.preventDefault();fire();}
});
if(new URLSearchParams(location.search).has('debug'))window.BS_CARROM={get state(){return state;},start,fire,pause,renderer,get angle(){return angle;},setAim(a,p){angle=a;power=p;controls();draw();}};
