/* The race predicts the room's movement between snapshots and renders it through the track camera. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const COLORS=['#5de2c2','#f5c76e','#84baff','#f796b2','#bca3ff','#ff9875','#96db68','#66d8ed','#f4a6ff','#e9da81','#77a6ed','#d0a47a','#99bdb3','#e5a6ae','#bdca72','#c595dd','#64bca3','#debd99','#9ba3d9','#d58b70'];
const POWERS={
 boost:['تيربو','سرعة أكثر 3 ثواني'],shield:['درع','يصد أول ضربة'],
 sticky:['لزقة','ترميها وراك'],rocket:['صاروخ','يقفز 10 خطوات'],storm:['عاصفة','تبطّئ اللي قدّامك']
};
const ICONS={
 left:'m14 6-6 6 6 6M8 12h12',right:'m10 6 6 6-6 6m6-6H4',
 box:'m12 2 9 10-9 10L3 12Z M12 8v8m-4-4h8',
 boost:'m13 2-8 12h6l-1 8 9-12h-6Z',
 shield:'m12 3 8 3v6c0 5-5 8-8 9-3-1-8-4-8-9V6Z m-4 9 3 3 5-5',
 sticky:'M12 3c3 4 7 7 7 11a7 7 0 1 1-14 0c0-4 4-7 7-11Z m-4 12a4 4 0 0 0 3 3',
 rocket:'M7 15c1-6 7-12 14-12 0 7-6 13-12 14Z m0-4-4 2 2 4m8 1-2 3-4-2m9-9h.01M5 19l-2 2',
 storm:'M3 6h15a2 2 0 1 0-2-2M2 11h19M6 16h9a2 2 0 1 1-2 2'
};
function icon(node,name){
 if(node.dataset.icon===name)return;
 node.dataset.icon=name;node.setAttribute('aria-hidden','true');
 node.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="'+ICONS[name]+'"/></svg>';
}
const PLACES=['الأول','الثاني','الثالث','الرابع','الخامس','السادس','السابع','الثامن','التاسع','العاشر'];
const SAY={wall:'اصطدمت بحاجز',gate:'البوابة مسكّرة',mud:'طحت بالطين',spring:'الزنبرك رجّعك',sticky:'لزقة! بطّأتك',storm:'عاصفة عليك',shield:'الدرع صدّها',box:'صندوق!',finish:'وصلت خط النهاية'};
const stageArt=window.BS_RACE_STAGE;
const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)');
let mounted=false,current=null,hooks=null,engine=null,predicted=null,track=null,paused=false,frame=0;
let canvas=null,ctx=null,size={w:0,h:0,dpr:1},view=[],lastFrame=0,pendingLane=null;
let heard=new Map(),seenEvent=-1,banner={text:'',until:0,kind:''},countdownSaid=-1,resizeObserver=null;
let runnerLayer=null,runnerActors=new Map(),pointer=null,lastPress=0,podiumKey='',podiumActors=[],hudNodes=null;
function clear(){
 resizeObserver?.disconnect();resizeObserver=null;window.removeEventListener?.('resize',resize);
 document.removeEventListener?.('keydown',onKey);
 for(const row of runnerActors.values())window.BS_CHARACTERS?.dispose?.(row.actor);
 for(const actor of podiumActors)window.BS_CHARACTERS?.dispose?.(actor);
 runnerActors.clear();runnerLayer?.remove();runnerLayer=null;podiumActors=[];podiumKey='';
 $('raceRecap')?.replaceChildren();
 if(frame)cancelAnimationFrame(frame);
 frame=0;mounted=false;current=null;hooks=null;engine=null;predicted=null;track=null;paused=false;
 canvas=null;ctx=null;view=[];lastFrame=0;pendingLane=null;heard.clear();seenEvent=-1;
 banner={text:'',until:0,kind:''};countdownSaid=-1;pointer=null;lastPress=0;hudNodes=null;
}
const now=()=>hooks?.now?.()??Date.now();
function sound(name){if(!document.hidden)window.BS_AUDIO?.play?.(name);}
const mine=()=>current?.players.find(p=>p.id===hooks.me);
function drawActor(player,p,width,runner,t,own,z){
 if(!player||!runnerLayer)return;
 const characters=window.BS_CHARACTERS;
 let row=runnerActors.get(player.id);
 if(row&&row.hero!==player.hero){
  characters?.dispose?.(row.actor);row.node.remove();runnerActors.delete(player.id);row=null;
 }
 if(!row){
  const node=el('div','ch-runner-body'),actor=characters?.actor?.(player.hero,{piece:true,staticIdle:true});
  node.append(actor||el('span','ch-runner-fallback',player.name.slice(0,1)),el('b','ch-runner-name',own?'أنت':player.name));
  node.style.setProperty('--runner-color',own?'#83f7df':COLORS[player.slot%20]);
  node.classList.toggle('self',own);runnerLayer.append(node);
  row={node,actor,hero:player.hero,pose:null};runnerActors.set(player.id,row);
 }
 if(row.node.hidden)row.node.hidden=false;
 row.node.style.left=p.x+'px';row.node.style.top=p.y+'px';row.node.style.width=width+'px';row.node.style.zIndex=String(z);
 const pose=runner.place===1?'win':paused||runner.done!==null||runner.wait||t<predicted.startAt||t<runner.stun?'idle':'walk';
 if(row.pose!==pose&&row.actor){row.pose=pose;characters.setState(row.actor,pose,{loop:pose==='walk',returnIdle:pose!=='win'});}
 row.node.classList.toggle('winner',runner.place===1);
 row.node.classList.toggle('shielded',t<runner.shield);
 row.node.classList.toggle('boosting',t<Math.max(runner.boost,runner.pad,runner.rocket));
}
function onKey(e){
 if(!mounted||['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName))return;
 const k=e.key.toLowerCase();
 if(k==='arrowleft'||k==='a'){e.preventDefault();lane(-1);}
 else if(k==='arrowright'||k==='d'){e.preventDefault();lane(1);}
 else if((k===' '||k==='arrowup')&&e.target?.tagName!=='BUTTON'){e.preventDefault();usePower();}
}
function mountHUD(){
 const hud=el('div','ch-race-hud'),dash=el('div','race-dash');
 const place=el('b','ch-race-place'),time=el('b','race-time'),progress=el('span','ch-race-progress');
 const rank=el('div','race-stat race-rank'),clock=el('div','race-stat race-clock');
 rank.append(el('small','','المركز'),place);clock.append(el('small','','الوقت'),time);
 const mark=el('div','race-trackmark');mark.append(el('strong','','حلبة السراب'),el('small','','MIRAGE / 98'));
 dash.append(rank,mark,clock);
 const meter=el('div','race-meter');
 meter.setAttribute('role','progressbar');meter.setAttribute('aria-label','المسافة المقطوعة');
 meter.setAttribute('aria-valuemin','0');meter.setAttribute('aria-valuemax','100');
 meter.append(el('i'));
 const distance=el('div','race-distance');distance.append(progress,meter);
 const alert=el('span','ch-race-banner');alert.hidden=true;
 hud.append(dash,distance,alert);hudNodes={place,time,progress,meter,alert};
 return hud;
}
function mount(){
 const board=$('chBoard');board.className='ch-board ch-race';
 const stage=el('div','ch-race-stage');canvas=el('canvas','ch-race-canvas');canvas.setAttribute('role','img');canvas.setAttribute('aria-label','مضمار السباق');
 runnerLayer=el('div','ch-race-runners');runnerLayer.setAttribute('aria-hidden','true');
 stage.append(canvas,runnerLayer,mountHUD());board.replaceChildren(stage);
 const left=el('button','ch-race-key ch-race-left'),right=el('button','ch-race-key ch-race-right');
 for(const [button,side,caption] of [[left,'left','يسار'],[right,'right','يمين']]){
  button.type='button';button.setAttribute('aria-label','تبديل المسار '+caption);
  const arrow=el('span','race-key-icon');icon(arrow,side);button.append(arrow,el('small','',caption));
 }
 const power=el('button','ch-race-power');power.type='button';
 const powerCopy=el('span','race-power-copy');
 powerCopy.append(el('b','ch-race-power-name'),el('small','ch-race-power-say'));
 power.append(el('span','ch-race-power-icon'),powerCopy);
 left.addEventListener('click',()=>lane(-1));right.addEventListener('click',()=>lane(1));power.addEventListener('click',usePower);
 const keys=el('div','ch-race-keys');keys.append(left,power,right);
 $('chControls').replaceChildren(keys);
 $('chTactics').replaceChildren(el('div','ch-race-feed'));
 // a swipe or a tap on either side of the track moves you a lane that way
 canvas.addEventListener('pointerdown',e=>{pointer={id:e.pointerId,x:e.clientX,y:e.clientY};});
 canvas.addEventListener('pointerup',e=>{const p=pointer;pointer=null;if(!p||p.id!==e.pointerId)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;if(Math.abs(dx)>28&&Math.abs(dx)>Math.abs(dy)){lane(dx>0?1:-1);return;}if(Math.abs(dx)<12&&Math.abs(dy)<12){const r=canvas.getBoundingClientRect?.();if(r&&r.width)lane(e.clientX-r.left<r.width/2?-1:1);}});
 canvas.addEventListener('pointercancel',()=>{pointer=null;});
 document.addEventListener('keydown',onKey);
 mounted=true;resize();
 if(typeof ResizeObserver!=='undefined'){resizeObserver=new ResizeObserver(resize);resizeObserver.observe(stage);}else window.addEventListener?.('resize',resize);
}
function resize(){if(!canvas)return;const box=canvas.parentElement||canvas,r=box.getBoundingClientRect?.()||{width:360,height:480},dpr=Math.min(2,window.devicePixelRatio||1);size={w:Math.max(1,r.width),h:Math.max(1,r.height),dpr};canvas.width=Math.round(size.w*dpr);canvas.height=Math.round(size.h*dpr);ctx=canvas.getContext?.('2d')||null;}
const meIndex=()=>mine()?.slot??0;
function playable(){const race=predicted;if(!race||current?.phase!=='playing'||paused||document.hidden)return false;const R=race.runners[meIndex()];return now()>=race.startAt&&R&&R.done===null&&!race.over;}
function lane(dir){
 if(!playable())return;const t=now();if(t-lastPress<110)return;const R=predicted.runners[meIndex()],to=R.lane+dir;if(to<0||to>=engine.RACE_LANES)return;
 // only a choice that actually left for the room shows on screen
 if(hooks.act({type:'lane',lane:to})===false)return;lastPress=t;
 const Q=predicted.runners[meIndex()];if(Q.lane!==to)engine.changeLane(predicted,meIndex(),to,t,0);pendingLane={lane:to,at:t};
}
function usePower(){if(!playable())return;const R=predicted.runners[meIndex()];if(!R.power)return;const power=R.power;if(hooks.act({type:'power'})===false)return;const Q=predicted.runners[meIndex()];if(Q.power)engine.usePower(predicted,meIndex(),now());sound(power==='rocket'||power==='boost'?'correct':'select');say(POWERS[power][0],'power');powerButton();}
function say(text,kind,ms=1400){banner={text,kind,until:now()+ms};}
function render(m,next){
 current=m;hooks=next;engine=next.engine;if(!m.race||!engine)return;if(!mounted)mount();
 track=engine.raceTrack(m.race.seed);
 predicted=structuredClone(m.race);
 // your own choice the room has not answered yet stays on your screen
 const me=meIndex(),R=predicted.runners[me];if(pendingLane){if(R.lane===pendingLane.lane||now()-pendingLane.at>1200)pendingLane=null;else if(R.done===null){R.lane=pendingLane.lane;R.lastLane=pendingLane.at;R.wait=false;}}
 news(m);powerButton();if(!frame)loop();
}
function news(m){
 const area=$('chTactics').querySelector('.ch-race-feed');if(!area)return;const fresh=m.race.events.filter(e=>e.id>seenEvent);if(seenEvent<0){seenEvent=m.race.eventId;return show(m,area);}seenEvent=m.race.eventId;
 for(const e of fresh){if(e.kind==='finish'&&e.i!==meIndex())sound('pop');}
 show(m,area);
}
function show(m,area){
 const name=i=>i===meIndex()?'أنت':m.players[i]?.name||'',lines=[...m.race.events].reverse().filter(e=>['finish','power','wall','spring','storm','sticky'].includes(e.kind)).slice(0,3).map(e=>{const row=el('p','ch-race-news'+(e.i===meIndex()?' mine':''));row.style.setProperty('--hit',COLORS[m.players[e.i]?.slot%20||0]);const text=e.kind==='finish'?' وصل '+(PLACES[e.place-1]||''):e.kind==='power'?' استخدم '+(POWERS[e.power]?.[0]||''):e.kind==='wall'?' اصطدم بحاجز':e.kind==='spring'?' رجّعه الزنبرك':e.kind==='storm'?' جته عاصفة':' علِق بلزقة';row.append(el('i'),el('b','',name(e.i)),el('span','',e.i===meIndex()?text.replace('وصل','وصلت').replace('استخدم','استخدمت').replace('اصطدم','اصطدمت').replace('رجّعه','رجّعك').replace('جته','جتك').replace('علِق','علِقت'):text));return row;});
 area.replaceChildren(...lines);if(!lines.length)area.append(el('p','ch-race-news empty','اللي ورا ياخذ قدرات أقوى وريح تدفّه، فلا توقف.'));
}
function powerButton(){
 const button=$('chControls').querySelector('.ch-race-power');if(!button||!predicted)return;const R=predicted.runners[meIndex()],info=R?.power?POWERS[R.power]:null;
 icon(button.querySelector('.ch-race-power-icon'),info?R.power:'box');
 button.querySelector('.ch-race-power-name').textContent=info?info[0]:'خانة القدرة';
 button.querySelector('.ch-race-power-say').textContent=info?info[1]:'التقط بلورة من المضمار';
 button.disabled=!info||!playable();button.classList.toggle('ready',!!info);
}
function tick(m,next){
 if(!mounted||!m.race)return;
 paused=!!next.paused;
 for(const k of $('chControls').querySelectorAll('.ch-race-key'))k.disabled=!playable();
 powerButton();
 if(!frame&&current?.phase==='playing')loop();
}
function loop(){
 if(!ctx)return;
 frame=requestAnimationFrame(at=>{
  frame=0;step(at);
  if(ctx&&current&&(current.phase==='playing'||now()-(current.finishedAt||0)<4000))loop();
 });
}
function step(at){
 if(!predicted||!engine)return;
 const t=now();
 if(current.phase==='playing'&&!paused){
  const before=predicted.eventId;
  engine.raceSim(predicted,current.players.map(p=>p.bot),t);
  if(predicted.eventId!==before)mineEvents(before);
 }
 const dt=Math.min(60,Math.max(0,at-(lastFrame||at-16)));
 lastFrame=at;
 countdown(t);draw(t,dt);hud(t);
}
function mineEvents(before){
 for(const e of predicted.events){if(e.id<=before||e.i!==meIndex())continue;const key=e.kind+':'+Math.round(e.t/300);if(heard.has(key))continue;heard.set(key,e.t);if(heard.size>40)heard.delete(heard.keys().next().value);
  if(e.kind==='box'){sound('capture');say('قدرة جديدة · '+(POWERS[e.power]?.[0]||''),'box');powerButton();}
  else if(e.kind==='finish'){sound(e.place===1?'win':'finish');say('وصلت '+(PLACES[e.place-1]||''),'finish',3000);}
  else if(e.kind==='shield'){sound('select');say(SAY.shield,'good');}
  else if(SAY[e.kind]&&e.kind!=='power'){sound('wrong');say(SAY[e.kind],'bad');if(navigator.vibrate)try{navigator.vibrate(40);}catch{}}
 }
}
function countdown(t){const race=predicted;if(t>=race.startAt+900){return;}const n=Math.min(3,Math.ceil((race.startAt-t)/1000));if(n!==countdownSaid){countdownSaid=n;if(n>0){sound('count');say(String(n),'count',1000);}else{sound('go');say('انطلق!','go',900);}}}
function write(node,text){if(node.textContent!==text)node.textContent=text;}
function timeText(seconds){
 return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
}
function hud(t){
 const race=predicted,me=meIndex(),R=race.runners[me];
 const place=engine.raceOrder(race).indexOf(me)+1,percent=Math.min(100,Math.round(R.pos/engine.RACE_ROWS*100));
 const left=Math.max(0,Math.ceil((race.endsAt-Math.max(t,race.startAt))/1000));
 write(hudNodes.place,place+' / '+race.runners.length);write(hudNodes.time,timeText(left));
 write(hudNodes.progress,percent+'٪');
 if(hudNodes.meter.getAttribute('aria-valuenow')!==String(percent)){
  hudNodes.meter.setAttribute('aria-valuenow',String(percent));
  hudNodes.meter.style.setProperty('--race-progress',percent+'%');
 }
 let text=banner.until>t?banner.text:'',kind=banner.until>t?banner.kind:'';
 if(!text&&t>=race.startAt&&!race.over){
  const into=(t-race.startAt)%engine.CHAOS_EVERY,left=engine.CHAOS_EVERY-into;
  if(left<=engine.CHAOS_WARN){text='المضمار يتغيّر بعد '+Math.ceil(left/1000);kind='chaos';}
  else if(into<900&&t-race.startAt>engine.CHAOS_EVERY){text='تغيّرت الحواجز';kind='chaos';}
 }
 if(!text&&R.wind&&R.done===null){text='ريح تدفّك';kind='good';}
 write(hudNodes.alert,text);hudNodes.alert.dataset.kind=kind;hudNodes.alert.hidden=!text;
}

function draw(t,dt){
 if(!ctx||document.hidden||!stageArt)return;
 const race=predicted,me=meIndex(),{w,h,dpr}=size;
 const follow=reduced?.matches?1:1-Math.exp(-dt/62);
 for(const [i,R] of race.runners.entries()){
  const shown=view[i]??(view[i]={lane:R.lane,pos:R.pos});
  shown.lane+=(R.lane-shown.lane)*follow;shown.pos+=(R.pos-shown.pos)*follow;
 }
 const camera=view[me].pos,point=stageArt.projection(w,h,camera);
 ctx.setTransform(dpr,0,0,dpr,0,0);
 stageArt.paint(ctx,size,point,camera,view[me].lane,race,track,engine,t);
 const visible=new Set();
 const order=view.map((_,i)=>i).sort((a,b)=>view[b].pos-view[a].pos||Number(a===me)-Number(b===me));
 for(const [z,i] of order.entries()){
  const Q=race.runners[i],shown=view[i],distance=shown.pos-camera;
  if(distance < -2.85||distance > 34)continue;
  const spread=i===me?0:((i*11)%7-3)*.033;
  const p=point(shown.pos,(shown.lane-1)*2/3+spread);
  const width=Math.min(w*.33,h*.35,168)*p.scale*(i===me?1:.88);
  ctx.beginPath();ctx.ellipse(p.x,p.y,width*.29,width*.068,0,0,Math.PI*2);
  ctx.fillStyle='#080c18c7';ctx.fill();
  ctx.strokeStyle=i===me?'#83f7df':COLORS[i%20]+'90';ctx.lineWidth=i===me?1.7:1;ctx.stroke();
  const player=current.players[i];
  if(player){visible.add(player.id);drawActor(player,p,width,Q,t,i===me,z+1);}
 }
 for(const [id,row] of runnerActors)if(!visible.has(id)&&!row.node.hidden)row.node.hidden=true;
}

function podium(m,me){
 const area=$('raceRecap');if(!area||!stageArt)return;
 const key=m.race.seed+':'+m.race.startAt+':'+m.finishedAt;
 if(podiumKey===key)return;
 for(const actor of podiumActors)window.BS_CHARACTERS?.dispose?.(actor);
 podiumActors=[];podiumKey=key;
 const entries=stageArt.podiumPlaces(m),own=m.players.find(p=>p.id===me),runner=m.race.runners[own?.slot];
 const list=el('div','race-podium');list.style.setProperty('--places',String(Math.max(1,entries.length)));
 for(const {player,place,seconds} of entries){
  const seat=el('div','race-podium-seat');seat.dataset.place=String(place);
  const art=el('div','race-podium-art'),actor=window.BS_CHARACTERS?.actor?.(player.hero,{piece:true,staticIdle:true});
  if(actor){
   art.append(actor);podiumActors.push(actor);
   if(place===1)window.BS_CHARACTERS.setState(actor,'win',{loop:false,returnIdle:false});
  }
  const stand=el('div','race-podium-stand');
  stand.append(el('span','race-medal',String(place)),el('b','race-podium-name',player.name),el('small','race-podium-time',seconds.toFixed(2)+' ث'));
  seat.append(art,stand);list.append(seat);
 }
 const status=!runner?'':runner.done!==null?'مركزك '+runner.place+' من '+m.players.length:'قطعت '+Math.round(runner.pos/engine.RACE_ROWS*100)+'٪ من المضمار';
 area.replaceChildren(list,el('p','race-own-result',status));
}

window.BS_CHAOS={render,tick,clear,podium};
})();
