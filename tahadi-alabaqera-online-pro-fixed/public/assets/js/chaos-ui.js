/* «سباق الفوضى» (33.6.0) — the race on screen. The room is the referee; this screen runs the
   same race simulation between two snapshots of the room, so every runner moves smoothly, and
   your own lane changes and powers show at once. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const COLORS=['#5de2c2','#f5c76e','#84baff','#f796b2','#bca3ff','#ff9875','#96db68','#66d8ed','#f4a6ff','#e9da81','#77a6ed','#d0a47a','#99bdb3','#e5a6ae','#bdca72','#c595dd','#64bca3','#debd99','#9ba3d9','#d58b70'];
const POWERS={boost:['⚡','تيربو','سرعة أكثر 3 ثواني'],shield:['🛡️','درع','يصد أول ضربة'],sticky:['🟢','لزقة','ترميها وراك على اللي يلحقونك'],rocket:['🚀','صاروخ','تقفز 10 خطوات لقدّام'],storm:['🌪️','عاصفة','تبطّئ اللي قدامك']};
const PLACES=['الأول','الثاني','الثالث','الرابع','الخامس','السادس','السابع','الثامن','التاسع','العاشر'];
const SAY={wall:'اصطدمت بحاجز',gate:'البوابة مسكّرة',mud:'طحت بالطين',spring:'الزنبرك رجّعك',sticky:'لزقة! بطّأتك',storm:'عاصفة عليك',shield:'الدرع صدّها',box:'صندوق!',finish:'وصلت خط النهاية'};
let keysBound=false,mounted=false,current=null,hooks=null,engine=null,predicted=null,snapshot=null,track=null,paused=false,frame=0,canvas=null,ctx=null,size={w:0,h:0,dpr:1},camera=null,shownLane=[],pendingLane=null,heard=new Map(),seenEvent=-1,banner={text:'',until:0,kind:''},countdownSaid=-1,resizeObserver=null,runnerLayer=null,runnerActors=new Map(),seenRunners=new Set(),pointer=null,lastPress=0;
function clear(){
 resizeObserver?.disconnect();resizeObserver=null;window.removeEventListener?.('resize',resize);
 for(const row of runnerActors.values())window.BS_CHARACTERS?.dispose?.(row.actor);
 runnerActors.clear();runnerLayer?.remove();runnerLayer=null;
 if(frame)cancelAnimationFrame(frame);frame=0;mounted=false;current=null;hooks=null;engine=null;predicted=null;snapshot=null;track=null;paused=false;canvas=null;ctx=null;camera=null;shownLane=[];pendingLane=null;heard=new Map();seenEvent=-1;banner={text:'',until:0,kind:''};countdownSaid=-1;pointer=null;lastPress=0;}
const now=()=>hooks?.now?.()??Date.now();
function sound(name){if(!document.hidden)window.BS_AUDIO?.play?.(name);}
const mine=()=>current?.players.find(p=>p.id===hooks.me);
function drawActor(player,x,y,r,runner,t,own){
 if(!player||!runnerLayer)return;
 const characters=window.BS_CHARACTERS;
 let row=runnerActors.get(player.id);
 if(row&&row.hero!==player.hero){characters?.dispose?.(row.actor);row.node.remove();runnerActors.delete(player.id);row=null;}
 if(!row){
  const node=el('div','ch-runner-body'),actor=characters?.actor?.(player.hero,{piece:true,staticIdle:true});
  node.append(actor||el('span','ch-runner-fallback',player.name.slice(0,1)),el('b','ch-runner-name',own?'أنت':player.name));
  node.style.setProperty('--runner-color',own?colors().accent:COLORS[player.slot%20]);
  node.classList.toggle('self',own);runnerLayer.append(node);row={node,actor,hero:player.hero,pose:null};
  runnerActors.set(player.id,row);
 }
 seenRunners.add(player.id);row.node.hidden=false;
 row.node.style.left=x+'px';row.node.style.top=y+'px';row.node.style.width=(r*4.5)+'px';
 const pose=runner.place===1?'win':runner.done!==null||runner.wait||t<predicted.startAt||t<runner.stun?'idle':'walk';
 if(row.pose!==pose&&row.actor){row.pose=pose;characters.setState(row.actor,pose,{loop:pose==='walk',returnIdle:pose!=='win'});}
 row.node.classList.toggle('winner',runner.place===1);
}
function mount(){
 const board=$('chBoard');board.className='ch-board ch-race';
 const stage=el('div','ch-race-stage');canvas=el('canvas','ch-race-canvas');canvas.setAttribute('role','img');canvas.setAttribute('aria-label','مضمار السباق');
 const hud=el('div','ch-race-hud');hud.append(el('b','ch-race-place'),el('span','ch-race-banner'),el('span','ch-race-progress'));
 runnerLayer=el('div','ch-race-runners');runnerLayer.setAttribute('aria-hidden','true');stage.append(canvas,runnerLayer,hud);board.replaceChildren(stage);
 const left=el('button','ch-race-key ch-race-left');left.type='button';left.setAttribute('aria-label','المسار اللي على اليسار');left.append(el('i','','◀'),el('small','','يسار'));
 const right=el('button','ch-race-key ch-race-right');right.type='button';right.setAttribute('aria-label','المسار اللي على اليمين');right.append(el('small','','يمين'),el('i','','▶'));
 const power=el('button','ch-race-power');power.type='button';power.append(el('i','ch-race-power-icon'),el('b','ch-race-power-name'),el('small','ch-race-power-say'));
 left.addEventListener('click',()=>lane(-1));right.addEventListener('click',()=>lane(1));power.addEventListener('click',usePower);
 const keys=el('div','ch-race-keys');keys.append(left,power,right);
 $('chControls').replaceChildren(keys);
 $('chTactics').replaceChildren(el('div','ch-race-feed'));
 // a swipe or a tap on either side of the track moves you a lane that way
 canvas.addEventListener('pointerdown',e=>{pointer={id:e.pointerId,x:e.clientX,y:e.clientY};});
 canvas.addEventListener('pointerup',e=>{const p=pointer;pointer=null;if(!p||p.id!==e.pointerId)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;if(Math.abs(dx)>28&&Math.abs(dx)>Math.abs(dy)){lane(dx>0?1:-1);return;}if(Math.abs(dx)<12&&Math.abs(dy)<12){const r=canvas.getBoundingClientRect?.();if(r&&r.width)lane(e.clientX-r.left<r.width/2?-1:1);}});
 canvas.addEventListener('pointercancel',()=>{pointer=null;});
 if(!keysBound){keysBound=true;document.addEventListener('keydown',e=>{if(!mounted||['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName))return;const k=e.key;if(k==='ArrowLeft'||k==='a'||k==='A'){e.preventDefault();lane(-1);}else if(k==='ArrowRight'||k==='d'||k==='D'){e.preventDefault();lane(1);}else if((k===' '||k==='ArrowUp')&&e.target?.tagName!=='BUTTON'){e.preventDefault();usePower();}});}
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
function usePower(){if(!playable())return;const R=predicted.runners[meIndex()];if(!R.power)return;const power=R.power;if(hooks.act({type:'power'})===false)return;const Q=predicted.runners[meIndex()];if(Q.power)engine.usePower(predicted,meIndex(),now());sound(power==='rocket'||power==='boost'?'correct':'select');say((POWERS[power]?.[0]||'')+' '+(POWERS[power]?.[1]||''),'power');powerButton();}
function say(text,kind,ms=1400){banner={text,kind,until:now()+ms};}
function render(m,next){
 current=m;hooks=next;engine=next.engine;if(!m.race||!engine)return;if(!mounted)mount();
 track=engine.raceTrack(m.race.seed);snapshot=m.race;
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
 const name=i=>i===meIndex()?'أنت':m.players[i]?.name||'',lines=[...m.race.events].reverse().filter(e=>['finish','power','wall','spring','storm','sticky'].includes(e.kind)).slice(0,3).map(e=>{const row=el('p','ch-race-news'+(e.i===meIndex()?' mine':''));row.style.setProperty('--hit',COLORS[m.players[e.i]?.slot%20||0]);const text=e.kind==='finish'?' وصل '+(PLACES[e.place-1]||'')+' 🏁':e.kind==='power'?' استخدم '+(POWERS[e.power]?.[0]||'')+' '+(POWERS[e.power]?.[1]||''):e.kind==='wall'?' اصطدم بحاجز':e.kind==='spring'?' رجّعه الزنبرك':e.kind==='storm'?' جته عاصفة':' علِق بلزقة';row.append(el('i'),el('b','',name(e.i)),el('span','',e.i===meIndex()?text.replace('وصل','وصلت').replace('استخدم','استخدمت').replace('اصطدم','اصطدمت').replace('رجّعه','رجّعك').replace('جته','جتك').replace('علِق','علِقت'):text));return row;});
 area.replaceChildren(...lines);if(!lines.length)area.append(el('p','ch-race-news empty','اللي ورا ياخذ قدرات أقوى وريح تدفّه، فلا توقف.'));
}
function powerButton(){
 const button=$('chControls').querySelector('.ch-race-power');if(!button||!predicted)return;const R=predicted.runners[meIndex()],info=R?.power?POWERS[R.power]:null;
 button.querySelector('.ch-race-power-icon').textContent=info?info[0]:'؟';button.querySelector('.ch-race-power-name').textContent=info?info[1]:'ما عندك قدرة';button.querySelector('.ch-race-power-say').textContent=info?info[2]:'خذ صندوق ؟ من المضمار';
 button.disabled=!info||!playable();button.classList.toggle('ready',!!info);
}
function tick(m,next){if(!mounted||!m.race)return;paused=!!next.paused;if(m.phase==='playing'){const race=predicted||m.race,t=now(),left=Math.max(0,race.endsAt-Math.max(t,race.startAt));$('chTime').textContent=t<race.startAt?'يبدأ بعد '+Math.ceil((race.startAt-t)/1000):Math.ceil(left/1000)+' ث';}for(const k of $('chControls').querySelectorAll('.ch-race-key'))k.disabled=!playable();powerButton();if(!frame&&current?.phase==='playing')loop();}
// no drawing surface (a test page), no frames to keep running
function loop(){if(!ctx)return;frame=requestAnimationFrame(()=>{frame=0;step();if(ctx&&current&&(current.phase==='playing'||Date.now()-(current.finishedAt||0)<4000))loop();});}
// —— the race moves on between snapshots ——
function step(){
 if(!predicted||!engine)return;const t=now();
 if(current.phase==='playing'&&!paused){const before=predicted.eventId;engine.raceSim(predicted,current.players.map(p=>p.bot),t);if(predicted.eventId!==before)mineEvents(before);}
 countdown(t);draw(t);hud(t);
}
function mineEvents(before){
 for(const e of predicted.events){if(e.id<=before||e.i!==meIndex())continue;const key=e.kind+':'+Math.round(e.t/300);if(heard.has(key))continue;heard.set(key,e.t);if(heard.size>40)heard.delete(heard.keys().next().value);
  if(e.kind==='box'){sound('capture');say('صندوق! '+(POWERS[e.power]?.[0]||'')+' '+(POWERS[e.power]?.[1]||''),'box');powerButton();}
  else if(e.kind==='finish'){sound(e.place===1?'win':'finish');say('وصلت '+(PLACES[e.place-1]||'')+' 🏁','finish',3000);}
  else if(e.kind==='shield'){sound('select');say(SAY.shield,'good');}
  else if(SAY[e.kind]&&e.kind!=='power'){sound('wrong');say(SAY[e.kind],'bad');if(navigator.vibrate)try{navigator.vibrate(40);}catch{}}
 }
}
function countdown(t){const race=predicted;if(t>=race.startAt+900){return;}const n=Math.min(3,Math.ceil((race.startAt-t)/1000));if(n!==countdownSaid){countdownSaid=n;if(n>0){sound('tick');say(String(n),'count',1000);}else{sound('turn');say('انطلق!','go',900);}}}
function hud(t){
 const race=predicted,me=meIndex(),order=engine.raceOrder(race),place=order.indexOf(me)+1,R=race.runners[me];
 const box=$('chBoard').querySelector('.ch-race-hud');if(!box)return;
 box.querySelector('.ch-race-place').textContent=R.done!==null?(PLACES[R.place-1]||R.place)+' 🏁':place+' من '+race.runners.length;
 box.querySelector('.ch-race-progress').textContent=Math.min(100,Math.round(R.pos/engine.RACE_ROWS*100))+'٪';
 // the next wave of chaos is announced
 let text=banner.until>t?banner.text:'',kind=banner.until>t?banner.kind:'';
 if(!text&&t>=race.startAt&&!race.over){const into=(t-race.startAt)%engine.CHAOS_EVERY,left=engine.CHAOS_EVERY-into;if(left<=engine.CHAOS_WARN){text='الفوضى بعد '+Math.ceil(left/1000);kind='chaos';}else if(into<900&&t-race.startAt>engine.CHAOS_EVERY){text='الفوضى! المضمار تغيّر';kind='chaos';}}
 if(!text&&R.wind&&R.done===null){text='🌬️ ريح تدفّك';kind='good';}
 const b=box.querySelector('.ch-race-banner');b.textContent=text;b.dataset.kind=kind;b.hidden=!text;
}
// —— drawing ——
const theme={};
function colors(){if(theme.ready)return theme;const cs=typeof getComputedStyle==='function'?getComputedStyle($('chBoard')):null,v=n=>cs?.getPropertyValue(n)?.trim();Object.assign(theme,{ready:true,accent:v('--ch-accent')||'#c6f25e',ink:v('--ch-ink')||'#f0f2e9',road:v('--ch-race-road')||'#17232d',line:v('--ch-line')||'#31424d',muted:v('--ch-muted')||'#afbec6'});return theme;}
function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function item(kind,x,y,w,h,t,it,ghost){
 ctx.save();if(ghost){ctx.globalAlpha=.55;ctx.setLineDash([4,4]);}
 const s=Math.min(w,h);
 if(kind==='wall'){rr(x-w*.4,y-h*.32,w*.8,h*.64,6);ctx.fillStyle=ghost?'transparent':'#e2574c';ctx.fill();ctx.strokeStyle='#ffb3a8';ctx.lineWidth=2;ctx.stroke();if(!ghost){ctx.strokeStyle='#ffffff55';ctx.lineWidth=1.5;for(const k of [-.15,.15]){ctx.beginPath();ctx.moveTo(x-w*.4,y+h*k);ctx.lineTo(x+w*.4,y+h*k);ctx.stroke();}}}
 else if(kind==='gate'){const open=engine.gateOpen(predicted,it,t);ctx.strokeStyle=open?'#7be0a3':'#ff6b5e';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x-w*.42,y+h*.3);ctx.lineTo(x-w*.42,y-h*.3);ctx.moveTo(x+w*.42,y+h*.3);ctx.lineTo(x+w*.42,y-h*.3);ctx.stroke();if(!open||ghost){ctx.lineWidth=3;for(const k of [-.12,.12]){ctx.beginPath();ctx.moveTo(x-w*.42,y+h*k);ctx.lineTo(x+w*.42,y+h*k);ctx.stroke();}}else{ctx.globalAlpha*=.6;ctx.beginPath();ctx.moveTo(x-w*.42,y-h*.3);ctx.lineTo(x+w*.42,y-h*.3);ctx.stroke();}}
 else if(kind==='mud'){ctx.fillStyle=ghost?'transparent':'#7a5233';ctx.strokeStyle='#b78659';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y,w*.38,h*.26,0,0,Math.PI*2);ctx.fill();ctx.stroke();if(!ghost){ctx.fillStyle='#a3744a';ctx.beginPath();ctx.ellipse(x-w*.12,y-h*.04,w*.1,h*.07,0,0,Math.PI*2);ctx.fill();}}
 else if(kind==='spring'){ctx.strokeStyle='#c9d3da';ctx.lineWidth=3;ctx.beginPath();for(let k=0;k<=6;k++){const px=x-w*.3+k*w*.1,py=y+(k%2?-1:1)*h*.18;k?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.stroke();ctx.fillStyle='#ff9b54';ctx.beginPath();ctx.arc(x,y-h*.3,s*.08,0,Math.PI*2);ctx.fill();}
 else if(kind==='pad'){ctx.strokeStyle=colors().accent;ctx.lineWidth=4;ctx.lineCap='round';for(const k of [-.14,.12]){ctx.beginPath();ctx.moveTo(x-w*.22,y+h*(k+.12));ctx.lineTo(x,y+h*(k-.08));ctx.lineTo(x+w*.22,y+h*(k+.12));ctx.stroke();}}
 else if(kind==='box'){rr(x-s*.26,y-s*.26,s*.52,s*.52,6);ctx.fillStyle=ghost?'transparent':'#f2c14e';ctx.fill();ctx.strokeStyle='#fff3c4';ctx.lineWidth=2;ctx.stroke();if(!ghost){ctx.fillStyle='#4a3209';ctx.font='800 '+Math.round(s*.36)+'px ChallengeArabic,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('؟',x,y+1);}}
 else if(kind==='sticky'){ctx.fillStyle='#55d16a';ctx.globalAlpha*=.85;ctx.beginPath();ctx.ellipse(x,y,w*.32,h*.22,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle=COLORS[(current.players[it.by]?.slot||0)%20];ctx.lineWidth=2;ctx.stroke();}
 ctx.restore();
}
function runner(i,x,y,r,t){
 const R=predicted.runners[i],p=current.players[i],me=i===meIndex(),color=COLORS[(p?.slot||0)%20];
 ctx.save();
 if(t<R.boost||t<R.pad||t<R.rocket){ctx.fillStyle=t<R.rocket?'#ffd36e':'#ff9b54';ctx.globalAlpha=.7;ctx.beginPath();ctx.moveTo(x-r*.55,y+r*.6);ctx.lineTo(x,y+r*(t<R.rocket?3.2:2.2));ctx.lineTo(x+r*.55,y+r*.6);ctx.fill();ctx.globalAlpha=1;}
 if(R.wind&&R.done===null){ctx.strokeStyle='#bfe9ff88';ctx.lineWidth=2;for(const k of [-.5,0,.5]){ctx.beginPath();ctx.moveTo(x+r*k,y+r*1.4);ctx.lineTo(x+r*k,y+r*2.2);ctx.stroke();}}
 ctx.beginPath();ctx.ellipse(x,y+3,r*1.05,r*.32,0,0,Math.PI*2);
 ctx.fillStyle='#07121ca8';ctx.fill();ctx.lineWidth=me?2.5:1.5;ctx.strokeStyle=me?colors().accent:color;ctx.stroke();
 drawActor(p,x,y,r,R,t,me);
 if(t<R.shield){ctx.strokeStyle='#7fe7ff';ctx.lineWidth=2.5;ctx.globalAlpha=.85;ctx.beginPath();ctx.arc(x,y,r+5,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
 if(t<R.stun||R.wait){ctx.fillStyle='#ffe066';ctx.font=Math.round(r*.7)+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(R.wait?'⏳':'✦',x+r*.85,y-r*.85);}
 if(t<R.slow){ctx.fillStyle='#8a5a32';ctx.beginPath();ctx.arc(x-r*.6,y+r*.95,r*.18,0,Math.PI*2);ctx.arc(x+r*.5,y+r,r*.14,0,Math.PI*2);ctx.fill();}
 if(R.done!==null){ctx.font=Math.round(r*.8)+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('🏁',x+r*.9,y-r*.8);}
 ctx.restore();
}
function draw(t){
 if(!ctx||document.hidden)return;const {w,h,dpr}=size,c=colors(),race=predicted,me=meIndex(),R=race.runners[me];
 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
 const rows=12.5,rowH=h/rows,margin=Math.max(10,w*.06),laneW=(w-margin*2)/engine.RACE_LANES,laneX=l=>margin+laneW*(l+.5);
 // the camera follows you, a little behind the screen's middle
 const target=Math.min(R.pos,engine.RACE_ROWS);camera=camera===null?target:camera+(target-camera)*.25;const camY=h*.74,yOf=row=>camY-(row-camera)*rowH;
 const road=ctx.createLinearGradient(0,0,w,h);
 road.addColorStop(0,'#10192e');road.addColorStop(.48,c.road);road.addColorStop(1,'#12162e');
 ctx.fillStyle=road;ctx.fillRect(0,0,w,h);
 ctx.fillStyle=c.accent+'13';ctx.fillRect(margin+laneW*R.lane,0,laneW,h);
 const first=Math.max(0,Math.floor(camera-3)),last=Math.min(engine.RACE_ROWS,Math.ceil(camera+rows));
 // chaos zones wear hazard stripes
 ctx.save();for(const [a,b] of engine.CHAOS_ZONES){const y1=yOf(b+.5),y2=yOf(a-.5);if(y2<0||y1>h)continue;ctx.fillStyle='#ff6b5e14';ctx.fillRect(margin,y1,w-margin*2,y2-y1);ctx.strokeStyle='#ff6b5e55';ctx.setLineDash([10,8]);ctx.lineWidth=2;ctx.strokeRect(margin+1,y1,w-margin*2-2,y2-y1);}ctx.restore();
 // edges and lanes
 ctx.fillStyle='#0b1218';ctx.fillRect(0,0,margin,h);ctx.fillRect(w-margin,0,margin,h);
 ctx.save();ctx.strokeStyle=c.line;ctx.lineWidth=2;ctx.setLineDash([rowH*.45,rowH*.55]);ctx.lineDashOffset=-((camera*rowH)%rowH);for(let l=1;l<engine.RACE_LANES;l++){ctx.beginPath();ctx.moveTo(margin+laneW*l,0);ctx.lineTo(margin+laneW*l,h);ctx.stroke();}ctx.restore();
 // Reflectors and distance markers make forward movement readable between obstacles.
 for(let row=Math.max(0,Math.floor(camera-4));row<=camera+rows;row++){
  const y=yOf(row),major=row%5===0;
  if(y<0||y>h)continue;
  ctx.fillStyle=major?'#68ddd45c':'#6c8e9c35';
  ctx.fillRect(margin-4,y,major?9:5,2);ctx.fillRect(w-margin-1,y,major?9:5,2);
  if(major&&row>0&&row<engine.RACE_ROWS){
   ctx.fillStyle='#a6bbd288';ctx.font='700 10px sans-serif';ctx.textAlign='left';
   ctx.fillText(String(row),margin+8,y-4);
  }
 }
 // the start and the finish
 for(const [row,label] of [[0,'البداية'],[engine.RACE_ROWS,'النهاية']]){const y=yOf(row);if(y<-rowH||y>h+rowH)continue;if(row){const sq=laneW/6;for(let k=0;k<Math.ceil((w-margin*2)/sq);k++)for(const j of [0,1]){ctx.fillStyle=(k+j)%2?'#f0f2e9':'#10161b';ctx.fillRect(margin+k*sq,y-sq+j*sq,sq,sq);}}else{ctx.fillStyle=c.accent;ctx.fillRect(margin,y-2,w-margin*2,4);}ctx.fillStyle=c.muted;ctx.font='700 11px ChallengeArabic,sans-serif';ctx.textAlign='center';ctx.fillText(label,w/2,y-(row?laneW/6+6:8));}
 // what is on the track now, and — before a wave — the shape of the next one
 const wave=engine.raceWave(race,t),into=t-race.startAt,nextAt=race.startAt+(wave+1)*engine.CHAOS_EVERY,warn=t>=race.startAt&&nextAt-t<=engine.CHAOS_WARN;
 for(let row=first;row<=last;row++){const y=yOf(row);for(const it of engine.raceItems(track,race,row,t))item(it.kind,laneX(it.lane),y,laneW,rowH,t,it,false);if(warn)for(const it of engine.raceItems(track,race,row,nextAt))if(it.wave===wave+1)item(it.kind,laneX(it.lane),y,laneW,rowH,t,it,true);}
 // the runners: lanes slide, and close runners step aside a little
 const r=Math.max(11,Math.min(laneW*.27,rowH*.42));
 const order=race.runners.map((_,i)=>i).filter(i=>i!==me).sort((a,b)=>race.runners[a].pos-race.runners[b].pos);
 seenRunners.clear();
 for(const i of [...order,me]){const Q=race.runners[i];shownLane[i]=shownLane[i]===undefined?Q.lane:shownLane[i]+(Q.lane-shownLane[i])*.35;const y=yOf(Math.min(Q.pos,engine.RACE_ROWS)),x=laneX(shownLane[i])+(i===me?0:((i*37)%11-5)*r*.32);if(y<-r*2||y>h+r*2)continue;runner(i,x,y,i===me?r*1.15:r*.9,t);}
 for(const [id,row] of runnerActors)if(!seenRunners.has(id))row.node.hidden=true;
 // the whole race on one bar
 const top=14,bottom=h-14;ctx.strokeStyle=c.line;ctx.lineWidth=4;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(w-margin/2,top);ctx.lineTo(w-margin/2,bottom);ctx.stroke();
 for(const i of order.concat(me)){const Q=race.runners[i],y=bottom-(bottom-top)*Math.min(1,Q.pos/engine.RACE_ROWS);ctx.fillStyle=i===me?c.accent:COLORS[(current.players[i]?.slot||0)%20];ctx.beginPath();ctx.arc(w-margin/2,y,i===me?5:3.5,0,Math.PI*2);ctx.fill();}
 if(into<0){ctx.fillStyle='#0008';ctx.fillRect(0,0,w,h);}
}
window.BS_CHAOS={render,tick,clear};
})();
