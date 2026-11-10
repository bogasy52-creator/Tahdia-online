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
 if(prefs.muted||window.BS_AUDIO?.getSettings?.().muted===true)return;
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
function draw(){if(state)renderer.draw(state,{angle,power,seat:viewSeat,aim:canPlay()});}
function resize(){
 const field=$('carromSurface').parentElement.getBoundingClientRect(),size=Math.max(1,Math.floor(Math.min(field.width-12,field.height-8)));
 if(field.width&&field.height){$('carromSurface').style.width=size+'px';$('carromSurface').style.height=size+'px';}
 const box=$('carromSurface').getBoundingClientRect();
 if(box.width&&box.height){renderer.resize(box.width,box.height);draw();}
}
if(typeof ResizeObserver==='function')new ResizeObserver(resize).observe($('carromSurface'));
addEventListener('resize',resize,{passive:true});
function names(){return state?.mode==='hotseat'?['اللاعب الأول','اللاعب الثاني']:['أنت','الكمبيوتر'];}
// 33.9.0: each player's nine coins fill in as they drop, and what a shot did pops over the board
function pips(i,count){let box=$('player'+i).querySelector('.cm-pips');if(!box){box=document.createElement('span');box.className='cm-pips';box.setAttribute('aria-hidden','true');for(let k=0;k<9;k++)box.append(document.createElement('i'));$('player'+i).querySelector('span')?.append(box);}[...box.children].forEach((pip,k)=>pip.classList.toggle('on',k<count));}
let bannerTimer=0,lastMessage='';
function banner(text){
 if(!text||text===lastMessage||text==='الأحجار تتحرك…')return;lastMessage=text;
 let node=document.querySelector('.cm-banner');if(!node){node=document.createElement('div');node.className='cm-banner';node.setAttribute('aria-hidden','true');document.querySelector('.cm-playfield')?.append(node);}
 node.textContent=text;node.className='cm-banner '+(/خطأ|رجع|جزاء|ما تغطّت/.test(text)?'bad':/الملكة/.test(text)?'queen':/دخل|غطّيت|فاز/.test(text)?'good':'');
 void node.offsetWidth;node.classList.add('show');clearTimeout(bannerTimer);bannerTimer=setTimeout(()=>node.classList.remove('show'),1900);
}
function controls(){
 const enabled=canPlay();
 document.querySelector('.cm-dock')?.classList.toggle('idle',!enabled);
 paintPower();
 if(!state)return;
 const scores=carromScore(state),labels=names();
 for(let i=0;i<2;i++){
  $('player'+i).classList.toggle('active',state.turn===i&&state.phase!=='finished');
  $('name'+i).textContent=labels[i];
  $('score'+i).textContent=scores[i].coins+' / 9';pips(i,scores[i].coins);
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
 pointer=null;pull=0;
 if(state.mode==='ai'&&state.turn===1&&state.phase==='aim'){
  botPlan=chooseCarromShot(state);placeStriker(state,botPlan.x);
  angle=botPlan.angle;power=botPlan.power;botAt=performance.now()+900;
  state.message='الكمبيوتر يجهّز ضربته…';
 }else{botPlan=null;power=0;}
 controls();
}
function start(){
 lastMessage='';clearTimeout(resultTimer);cancelAnimationFrame(frame);frame=0;
 prefs.mode=$('carromMode').value;prefs.theme=$('carromTheme').value;prefs.difficulty=$('carromDifficulty').value;persist();
 state=createCarrom(prefs);running=true;paused=false;turnSeen=-1;accumulator=0;pointer=null;
 document.body.classList.add('carrom-running');window.BS_LOCAL_REACTIONS={active:true};window.dispatchEvent(new Event('bs-reaction-refresh'));
 $('carromMenu').hidden=true;$('carromGame').hidden=false;$('carromPause').hidden=true;$('carromResult').hidden=true;
 renderer.setTheme(prefs.theme);resize();onTurn();last=performance.now();frame=requestAnimationFrame(loop);
}
function menu(){
 document.body.classList.remove('carrom-running');window.BS_LOCAL_REACTIONS={active:false};window.dispatchEvent(new Event('bs-reaction-refresh'));
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
function fire(strength=power){
 if(!canPlay()||strength<.06)return;
 try{shootCarrom(state,{x:state.striker.x,angle,power:Math.max(.08,Math.min(1,strength))});tone('strike',strength);window.BS_AUDIO?.vibrate?.(14);pointer=null;power=0;controls();}
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
  if(state.phase==='aim'){accumulator=0;banner(state.message);onTurn();controls();}
  if(state.phase==='finished'){controls();finish();}
 }else if(state.phase==='aim'&&botPlan&&now>=botAt){
  try{shootCarrom(state,botPlan);tone('strike',botPlan.power);botPlan=null;controls();}
  catch{botPlan=chooseCarromShot(state);placeStriker(state,botPlan.x);botAt=now+500;}
 }
 draw();
 if(state.phase!=='finished')frame=requestAnimationFrame(loop);
}
// 33.9.6: easier hands: touch the striker and slide it on its line; drag anywhere else on the board
// and the aim follows your finger (a tap on a coin aims straight at it); the strip under the board
// turns the aim a hair; the power bar is pulled down and let go to strike (back up cancels).
let pull=0;
function updateAim(point){
 const dx=point.x-state.striker.x,dy=point.y-state.striker.y;
 if(Math.hypot(dx,dy)<8)return;
 angle=Math.atan2(dy,dx);controls();draw();
}
function nudge(rad){angle+=rad*(viewSeat?-1:1);draw();}
canvas.addEventListener('pointerdown',e=>{
 if(!canPlay())return;e.preventDefault();window.BS_AUDIO?.unlock?.();
 const p=renderer.point(e.clientX,e.clientY,viewSeat),near=Math.hypot(p.x-state.striker.x,p.y-state.striker.y)<state.striker.r*2.1;
 pointer={id:e.pointerId,place:near,start:p};
 try{canvas.setPointerCapture(e.pointerId);}catch{}
 if(!near)updateAim(p);
});
canvas.addEventListener('pointermove',e=>{
 if(!pointer||pointer.id!==e.pointerId||!canPlay())return;
 const p=renderer.point(e.clientX,e.clientY,viewSeat);
 if(pointer.place){placeStriker(state,p.x);draw();}else updateAim(p);
});
canvas.addEventListener('pointerup',e=>{
 if(!pointer||pointer.id!==e.pointerId)return;
 // a tap on a coin: aim at its centre
 const p=renderer.point(e.clientX,e.clientY,viewSeat);
 if(!pointer.place&&Math.hypot(p.x-pointer.start.x,p.y-pointer.start.y)<14){const coin=state.coins.find(c=>!c.pocketed&&Math.hypot(c.x-p.x,c.y-p.y)<c.r*1.8);if(coin)updateAim(coin);}
 pointer=null;
});
canvas.addEventListener('pointercancel',()=>{pointer=null;});
canvas.addEventListener('lostpointercapture',()=>{pointer=null;});
// fine aim
{
 const el=$('cmFine');let lastX=null,off=0;
 el.addEventListener('pointerdown',e=>{if(!canPlay())return;lastX=e.clientX;try{el.setPointerCapture(e.pointerId);}catch{}});
 el.addEventListener('pointermove',e=>{if(lastX===null||!canPlay())return;const dx=e.clientX-lastX;lastX=e.clientX;off+=dx;el.style.setProperty('--fine',off+'px');nudge(dx*.0016);});
 const up=()=>{lastX=null;};el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);
 el.addEventListener('keydown',e=>{if(!canPlay())return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();nudge((e.key==='ArrowRight'?1:-1)*(e.shiftKey?.003:.012));}});
}
// the power: pull down, let go
function paintPower(){const el=$('cmPower');if(!el)return;const shown=canPlay()?power:0;el.style.setProperty('--p',shown.toFixed(3));el.setAttribute('aria-valuenow',String(Math.round(power*100)));el.classList.toggle('on',shown>.02);el.querySelector('b').textContent=shown>.02?'القوة '+Math.round(power*100)+'%':canPlay()?'اسحب لتحت وأفلت عشان تضرب':state?.phase==='moving'?'الأحجار تتحرك…':state?.mode==='ai'&&state?.turn===1?'الكمبيوتر يصوّب…':'';}
{
 const el=$('cmPower');let from=null;
 el.addEventListener('pointerdown',e=>{if(!canPlay())return;window.BS_AUDIO?.unlock?.();from=e.clientY;try{el.setPointerCapture(e.pointerId);}catch{}});
 el.addEventListener('pointermove',e=>{if(from===null||!canPlay())return;power=Math.max(0,Math.min(1,(e.clientY-from)/170));paintPower();draw();});
 const up=()=>{if(from===null)return;from=null;if(power>=.06)fire(power);else{power=0;paintPower();draw();}};
 el.addEventListener('pointerup',up);el.addEventListener('pointercancel',()=>{from=null;power=0;paintPower();draw();});
 el.addEventListener('keydown',e=>{if(!canPlay())return;if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();power=Math.max(0,Math.min(1,power+(e.key==='ArrowDown'?.05:-.05)));paintPower();draw();}else if(e.key==='Enter'||e.key===' '){e.preventDefault();fire(power||.55);}});
}
$('carromStart').onclick=start;$('carromExit').onclick=menu;
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
  placeStriker(state,viewSeat?1000-viewX:viewX);draw();
 }else if(['a','d'].includes(e.key.toLowerCase())){angle+=(e.key.toLowerCase()==='a'?-.045:.045);draw();}
 else if(e.key==='Enter'||e.key===' '){e.preventDefault();fire(power||.55);}
});
if(new URLSearchParams(location.search).has('debug'))window.BS_CARROM={get state(){return state;},start,fire,pause,renderer,get angle(){return angle;},setAim(a,p){angle=a;power=p;controls();draw();},fire};
