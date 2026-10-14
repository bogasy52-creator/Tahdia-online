import {createSerpentGame,addSerpentBots,steerSerpent,stepSerpent} from './engines/serpent-engine.js?v=13.3.0';
import {SerpentRenderer,arenaTelemetry,resolveTrialSkin} from './serpent-renderer.js?v=13.3.0';
import {ArenaGestures} from './arena-gestures.js?v=13.3.0';
import {applySerpentFrame} from './serpent-network.js?v=13.3.0';

const $=id=>document.getElementById(id),SESSION='busraj-serpent-room-v12';
const renderer=new SerpentRenderer($('arenaCanvas')),keys=new Set(),mousePointers=new Map(),controls=[{angle:null,boost:false},{angle:null,boost:false}];
const trial=resolveTrialSkin(window.BS_CAREER?.catalog||[],location.search);
const gestures=new ArenaGestures({mode:'joystick',steer:(index,angle)=>{controls[index].angle=angle;},end:index=>{controls[index].angle=null;$('joystick'+(index+1)).classList.remove('steering');}});
let mode='solo',game=null,room=null,socket=null,selfId=null,paused=false,online=false,networkActive=false,reconnects=0,reconnectTimer=null,lastFrame=performance.now(),accumulator=0,lastInput=0,lastHud=0,receipt='',resultShown='',mouseAngle=null;
const show=(id,yes=true)=>$(id).classList.toggle('hidden',!yes);
const say=text=>{const target=online&&room?.status==='lobby'?$('lobbyMessage'):$('arenaMessage');target.textContent=text;};
function saved(){try{return JSON.parse(localStorage.getItem(SESSION)||'null')}catch{return null}}
function remember(value){try{value?localStorage.setItem(SESSION,JSON.stringify(value)):localStorage.removeItem(SESSION)}catch{}show('arenaResume',!!value);}
function release(){gestures.clear();mousePointers.clear();renderer.inputs?.clear();keys.clear();mouseAngle=null;for(const c of controls){c.angle=null;c.boost=false;}for(const id of ['boost1','boost2'])$(id).classList.remove('active');document.querySelectorAll('.arena-joystick i').forEach(el=>el.style.transform='');if(online&&socket?.readyState===WebSocket.OPEN&&game){const mine=game.snakes.find(s=>s.id===selfId);if(mine)socket.send(JSON.stringify({type:'input',angle:mine.angle,boost:false}));}}
function selectMode(next){
 mode=next;$('arenaModes').querySelectorAll('button').forEach(b=>{b.classList.toggle('selected',b.dataset.mode===mode);b.setAttribute('aria-pressed',String(b.dataset.mode===mode));});
 const net=mode==='online';show('secondNameField',mode==='duo');show('botsField');show('difficultyField');show('onlineCountField',net);show('onlineJoin',net);show('localControlHint',!net);if(net)$('arenaBots').value='0';limitBots();
 $('arenaStart').textContent=net?'أنشئ غرفة خاصة ↗':'ادخل الحلبة ↗';$('modeDescription').textContent=net?'من لاعبين إلى ثمانية أصدقاء، مع بوتات اختيارية':mode==='duo'?'شاشتان مستقلتان داخل الجهاز نفسه':'تدريب حقيقي بثلاثة مستويات صعوبة';
 $('localControlHint').querySelector('span').textContent=mode==='duo'?'الجوال: المس واسحب داخل نصفك للتوجيه بعصا ثابتة. الكمبيوتر: الأول بالأسهم وSpace؛ الثاني بـWASD وShift.':'الجوال: المس واسحب للتوجيه، واضغط ⚡ للتسريع. ارفع إصبعك ليكمل الثعبان اتجاهه. الكمبيوتر: الماوس أو الأسهم، وSpace للتسريع.';
 if(mode==='duo'&&!$('arenaBots').querySelector('[value="0"]')){const o=document.createElement('option');o.value='0';o.textContent='بدون بوت';$('arenaBots').prepend(o);$('arenaBots').value='0';}
 if(mode==='solo'&&$('arenaBots').value==='0')$('arenaBots').value='6';$('arenaMessage').textContent='';
}
function setPlay(){
 document.body.classList.add('serpent-active');show('arenaPlay');show('arenaMenu',false);show('arenaLobby',false);show('arenaPauseCover',false);show('arenaResults',false);show('arenaPause',!online);
 gestures.mode=$('arenaControl').value;$('arenaPlay').dataset.control=gestures.mode;$('arenaPlay').dataset.duo=String(!online&&mode==='duo');show('joystick2',!online&&mode==='duo');show('boost2',!online&&mode==='duo');
 paused=false;lastFrame=performance.now();accumulator=0;resultShown='';release();renderer.reset();renderer.resize();$('arenaHint').textContent='اجمع الطاقة. احمِ رأسك.';
}
function localStart(){
 quit(false);online=false;room=null;selfId='local-1';const profile=window.BS_CAREER?.get?.(),players=[{id:selfId,name:$('arenaName').value||'لاعب الحلبة',skin:trial?.id||profile?.equipped?.snake||'snake-wild'}];
 if(mode==='duo')players.push({id:'local-2',name:$('arenaName2').value||'اللاعب الثاني',skin:'snake-wild'});
 game=createSerpentGame(players,{matchMode:$('arenaMatchMode').value,duration:Number($('arenaDuration').value),difficulty:$('arenaDifficulty').value,seed:crypto.getRandomValues(new Uint32Array(1))[0]});addSerpentBots(game,Number($('arenaBots').value));
 receipt='serpent-local:'+crypto.randomUUID();setPlay();renderer.setGame(game,players.map(p=>p.id));updateHud();window.BS_AUDIO?.play?.('connect');
}
async function api(path,body){
 let response;try{response=await fetch(path,{method:body?'POST':'GET',headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(9000)});}catch{throw new Error('تعذر الوصول للسيرفر. تأكد من الاتصال وتشغيل النسخة الكاملة.');}
 const data=await response.json().catch(()=>({}));if(!response.ok||data.ok===false){const error=new Error(data.error||'تعذر الاتصال بالغرفة');error.code=data.code;throw error;}return data;
}
async function createRoom(){
 $('arenaStart').disabled=true;say('جاري إنشاء الحلبة…');try{const data=await api('/api/serpent/rooms',{playerLimit:Number($('arenaPlayers').value),matchMode:$('arenaMatchMode').value,duration:Number($('arenaDuration').value),botCount:Number($('arenaBots').value),difficulty:$('arenaDifficulty').value});remember({code:data.code,hostKey:data.hostKey});await connectRoom(data.code,{hostKey:data.hostKey});}catch(e){say(e.message);}finally{$('arenaStart').disabled=false;}
}
function limitBots(){const max=mode==='online'?Math.min(6,10-Number($('arenaPlayers').value)):mode==='duo'?6:6;for(const o of $('arenaBots').querySelectorAll('option'))o.disabled=Number(o.value)>max;if(Number($('arenaBots').value)>max)$('arenaBots').value=String(max);}
async function connectRoom(code,credentials={}){
 if(!/^\d{6}$/.test(code))throw new Error('اكتب رمز الغرفة المكوّن من ستة أرقام');
 await api('/api/serpent/rooms/'+code+'/status');
 if(socket){const old=socket;socket=null;old.close(1000,'switch_room');}
 const session=localStorage.getItem('bs_social_session'),protocols=['busraj-serpent-v1'];if(credentials.hostKey)protocols.push('hk.'+credentials.hostKey);if(credentials.token)protocols.push('rt.'+credentials.token);if(session)protocols.push('st.'+session);
 online=true;networkActive=true;const ws=new WebSocket(location.origin.replace(/^http/,'ws')+'/api/serpent/rooms/'+code+'/ws?name='+encodeURIComponent($('arenaName').value||'لاعب الحلبة'),protocols);socket=ws;
 return new Promise((resolve,reject)=>{
  let welcomed=false;const timeout=setTimeout(()=>{if(!welcomed){ws.close();reject(new Error('انتهت مهلة الاتصال. تأكد من الرمز ونشر السيرفر الجديد.'));}},9000);
  ws.onmessage=event=>{if(socket!==ws)return;let message;try{message=JSON.parse(event.data)}catch{return}
   if(message.type==='welcome'){welcomed=true;clearTimeout(timeout);selfId=message.playerId;reconnects=0;remember({code,token:message.token,playerId:selfId});show('arenaConnection',false);acceptRoom(message.state);resolve();}
   else if(message.type==='state')acceptRoom(message.state);
   else if(message.type==='frame'){if(message.state?.game?.tick<=game?.tick)return;const next=applySerpentFrame(room,message);if(next)acceptRoom(next);else ws.send(JSON.stringify({type:'resync'}));}
   else if(message.type==='error')say(message.message);
  };
  ws.onerror=()=>{if(!welcomed){clearTimeout(timeout);if(!credentials.token)networkActive=false;reject(new Error('تعذر الانضمام. الغرفة قد تكون ممتلئة أو بدأت، أو السيرفر يحتاج تحديثًا.'));}};
  ws.onclose=event=>{
   clearTimeout(timeout);if(socket!==ws)return;socket=null;release();
   if(!welcomed)reject(new Error('لم يكتمل الدخول إلى الغرفة'));
   if(!networkActive||!welcomed)return;
   if(event.code===4001){networkActive=false;$('arenaConnection').textContent='الغرفة مفتوحة من نافذة أخرى. أغلقها ثم ارجع من القائمة.';show('arenaConnection');return;}
   if(event.reason==='room_expired'){remember(null);networkActive=false;quit();say('انتهت الغرفة. أنشئ حلبة جديدة.');return;}
   $('arenaConnection').textContent='انقطع الاتصال. جاري الرجوع إلى الحلبة…';show('arenaConnection');scheduleReconnect();
  };
 });
}
function scheduleReconnect(){
 const credentials=saved();if(!networkActive||!credentials)return;
 if(reconnects>=3){networkActive=false;$('arenaConnection').textContent='تعذر استعادة الاتصال. ارجع للقائمة واضغط «ارجع إلى غرفتك السابقة».';return;}
 reconnectTimer=setTimeout(async()=>{reconnects++;try{await connectRoom(credentials.code,credentials)}catch(e){if(e.code==='DURABLE_REQUEST_LIMIT'){networkActive=false;$('arenaConnection').textContent=e.message;return;}if(networkActive)scheduleReconnect();}},Math.min(4500,1000*reconnects+1000));
}
function send(data){if(socket?.readyState===WebSocket.OPEN){socket.send(JSON.stringify(data));return true;}say('انتظر عودة الاتصال أولًا');return false;}
function acceptRoom(state){
 if(!state)return;const newRound=!room||room.round!==state.round||room.status!==state.status;room=state;
 if(state.status==='lobby'){
  game=null;paused=false;document.body.classList.remove('serpent-active');show('arenaPlay',false);show('arenaMenu',false);show('arenaLobby');$('roomCode').textContent=state.code;
  const list=$('arenaRoomPlayers');list.replaceChildren();for(const p of state.players){const card=document.createElement('div');card.className='arena-room-player';card.dataset.ready=String(p.ready);const name=document.createElement('b'),status=document.createElement('span');name.textContent=p.name+(p.role==='host'?' · المضيف':'');status.textContent=!p.connected?'منقطع مؤقتًا':p.ready?'✓ جاهز':'بانتظار الجاهزية';card.append(name,status);list.appendChild(card);}
  const own=state.players.find(p=>p.id===selfId),full=state.players.length===state.playerLimit,ready=full&&state.players.every(p=>p.ready&&p.connected);$('arenaReady').textContent=own?.ready?'إلغاء الجاهزية':'أنا جاهز';show('arenaHostStart',own?.role==='host');$('arenaHostStart').disabled=!ready;$('lobbyMessage').textContent=ready?'الجميع جاهز. المضيف يقدر يبدأ الآن.':'وصل '+state.players.length+' من '+state.playerLimit+' — انتظر اكتمال الفريق والجاهزية.';
  $('lobbyBots').value=String(state.botCount||0);$('lobbyDifficulty').value=state.difficulty||'medium';$('lobbyMatchMode').value=state.matchMode||'timed';$('lobbyDuration').value=String(state.duration);show('lobbyDurationField',state.matchMode!=='survival');for(const field of ['lobbyBots','lobbyDifficulty','lobbyMatchMode','lobbyDuration'])$(field).disabled=own?.role!=='host';for(const o of $('lobbyBots').querySelectorAll('option'))o.disabled=Number(o.value)>Math.min(6,10-state.playerLimit);$('lobbyBotsSummary').textContent=(state.botCount||0)+' بوتات + '+state.playerLimit+' أصدقاء · '+(state.matchMode==='survival'?'آخر ثعبان يبقى':'جولة بوقت');
 }else{
  game=state.game;if($('arenaPlay').classList.contains('hidden')||newRound&&state.status==='playing')setPlay();renderer.setGame(game,[selfId],true);updateHud();if(state.status==='finished'||game?.status==='finished')showResults();
 }
}
function updateHud(){
 if(!game)return;const mine=game.snakes.find(s=>s.id===selfId)||game.snakes[0],second=!online&&mode==='duo'?game.snakes.find(s=>s.id==='local-2'):null;
 $('hudName').textContent=second?mine.name+' / '+second.name:mine.name;$('hudScore').textContent=second?mine.score+' : '+second.score:mine.score;const remaining=Math.max(0,Math.ceil(game.duration-game.elapsed)),survival=game.matchMode==='survival';$('hudClockLabel').textContent=survival?'آخر ثعبان يبقى':'الوقت المتبقي';$('hudTime').textContent=survival?game.snakes.filter(s=>s.alive).length+' / '+game.snakes.length:Math.floor(remaining/60)+':'+String(remaining%60).padStart(2,'0');
 const info=arenaTelemetry(game,selfId);$('arenaPlay').dataset.danger=String(info.danger);$('hudRank').textContent='المركز '+info.rank+' · '+info.alive+' في الحلبة';
 $('boostFill').style.width=Math.round(info.boost*100)+'%';$('boostMeter').setAttribute('aria-valuenow',String(Math.round(info.boost*100)));$('boostStatus').textContent=!mine.alive?'خارج الجولة':mine.boost?'تسريع نشط':info.boost>0?'التسريع جاهز':'اجمع طاقة للتسريع';$('hudKills').textContent=info.kills+' افتراس';
 $('arenaHint').textContent=!mine.alive?'خرجت من الجولة. تابع المطاردة.':info.danger?'انتبه للحدود — التفّ إلى الداخل':mine.boost?'التسريع يستهلك من حجمك':mine.mass<=24?'اجمع طاقة أكثر للتسريع':'اجمع الطاقة. احمِ رأسك.';
 const ranking=$('arenaRanking');ranking.replaceChildren();for(const s of [...game.snakes].sort((a,b)=>b.score-a.score).slice(0,4)){const row=document.createElement('li'),name=document.createElement('span'),score=document.createElement('b');row.dataset.self=String(s.id===selfId);name.textContent=s.name;if(s.bot){const mark=document.createElement('em');mark.textContent=' BOT';name.appendChild(mark);}score.textContent=s.score;row.append(name,score);ranking.appendChild(row);}
 for(let i=0;i<2;i++){const snake=i===0?mine:second;const button=$('boost'+(i+1));button.disabled=!snake?.alive||snake.mass<=24||paused;button.classList.toggle('active',!!snake?.boost);button.setAttribute('aria-label',snake?.mass<=24?'اجمع طاقة أكثر للتسريع':'تسريع'+(i?' اللاعب الثاني':''));}
}
function showResults(){
 if(!game)return;const key=online?room.code+':'+room.round:receipt,first=resultShown!==key;show('arenaResults');const won=game.winners.length===1&&game.winners[0]===selfId;
 $('arenaResultTitle').textContent=game.winners.length>1?'مطاردة متعادلة':won?'الحلبة صارت لك.':'انتهت المطاردة.';
 $('arenaResultCopy').textContent=won?'حركة ذكية. وطاقة تستاهلها.':'كل مطاردة تعلّمك حركة جديدة. جرّب التفافًا أوسع في الجولة القادمة.';
 const scores=$('arenaFinalScores');scores.replaceChildren();for(const s of [...game.snakes].sort((a,b)=>b.score-a.score)){const row=document.createElement('div'),name=document.createElement('span'),score=document.createElement('b'),kills=document.createElement('small');name.textContent=s.name+(s.bot?' · BOT':'');kills.textContent=s.kills+' افتراس'+(s.alive?'':' · خارج الجولة');name.appendChild(kills);score.textContent=s.score+' طاقة';row.append(name,score);scores.appendChild(row);}
 const own=room?.players.find(p=>p.id===selfId);$('arenaAgain').disabled=online&&(own?.role!=='host'||!room.rewardsComplete);$('arenaAgain').textContent=online&&own?.role!=='host'?'بانتظار الجولة التالية من المضيف':'جولة ثانية ↗';
 if(first){resultShown=key;release();window.BS_AUDIO?.play?.(won?'win':'land');
  if(trial)$('arenaRewardMessage').textContent='هذه جولة تجربة. مقتنياتك ورصيدك لم يتغيرا.';
  else if(!online&&game.elapsed>=30){window.BS_CAREER?.record?.({id:receipt,game:'serpent',win:won}).then(()=>{$('arenaRewardMessage').textContent='تمت إضافة مكافأة جولتك إلى تقدمك.';});}
  else $('arenaRewardMessage').textContent='';
 }
 if(online&&room.rewardsComplete&&game.elapsed>=30&&window.BS_CAREER?.account?.())window.BS_CAREER.refresh().then(()=>{$('arenaRewardMessage').textContent='نتيجتك ومكافأتك محفوظتان في حسابك.';}).catch(()=>{$('arenaRewardMessage').textContent='نتيجتك محفوظة؛ أعد تحديث رصيدك عند عودة الاتصال.';});
}
function quit(toMenu=true){
 release();networkActive=false;clearTimeout(reconnectTimer);if(socket){const old=socket;socket=null;if(room?.status==='lobby'&&old.readyState===WebSocket.OPEN)old.send(JSON.stringify({type:'leave'}));old.close(1000,'user_left');}
 game=null;room=null;online=false;selfId=null;paused=false;renderer.game=null;show('arenaConnection',false);
 if(toMenu){document.body.classList.remove('serpent-active');show('arenaPlay',false);show('arenaLobby',false);show('arenaMenu');show('arenaResume',!!saved());$('arenaMessage').textContent='';}
}
function pause(next=!paused){if(online||!game||game.status!=='playing')return;paused=next;release();show('arenaPauseCover',paused);lastFrame=performance.now();}
function keyboardAngle(index){const p2=index===1,list=p2?['KeyA','KeyD','KeyW','KeyS']:['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'];let x=Number(keys.has(list[1]))-Number(keys.has(list[0])),y=Number(keys.has(list[3]))-Number(keys.has(list[2]));if(!p2&&mode!=='duo'){x+=Number(keys.has('KeyD'))-Number(keys.has('KeyA'));y+=Number(keys.has('KeyS'))-Number(keys.has('KeyW'));}return x||y?Math.atan2(y,x):null;}
function applyInputs(now){
 const ids=!online&&mode==='duo'?[selfId,'local-2']:[selfId];ids.forEach((id,index)=>{const s=game.snakes.find(s=>s.id===id);if(!s?.alive)return;const angle=controls[index].angle??keyboardAngle(index)??(index===0?mouseAngle:null)??s.targetAngle??s.angle,boost=controls[index].boost||keys.has(index===0?'Space':'ShiftLeft')||keys.has(index===0&&mode!=='duo'?'ShiftLeft':'ShiftRight');
  if(online){renderer.setInput?.(id,angle,boost);if(now-lastInput>=50&&socket?.readyState===WebSocket.OPEN){socket.send(JSON.stringify({type:'input',angle,boost}));lastInput=now;}}else steerSerpent(game,id,{angle,boost});
 });
}
function frame(now){
 const dt=Math.min(.1,Math.max(0,(now-lastFrame)/1000));lastFrame=now;
 if(game&&!document.hidden&&!$('arenaPlay').classList.contains('hidden')){
  if(!paused&&game.status==='playing'){applyInputs(now);if(!online){accumulator+=dt;while(accumulator>=1/60&&game.status==='playing'){stepSerpent(game,1/60);accumulator-=1/60;}renderer.setGame(game,!online&&mode==='duo'?[selfId,'local-2']:[selfId]);}}
  renderer.draw(now);if(now-lastHud>160){updateHud();lastHud=now;}if(game.status==='finished'&&!online&&resultShown!==receipt)showResults();
 }
 requestAnimationFrame(frame);
}
for(let i=0;i<2;i++){const boost=$('boost'+(i+1));boost.addEventListener('pointerdown',e=>{e.preventDefault();if(paused||!game||game.status!=='playing')return;boost.setPointerCapture(e.pointerId);controls[i].boost=true;boost.classList.add('active');});for(const event of ['pointerup','pointercancel','lostpointercapture'])boost.addEventListener(event,()=>{controls[i].boost=false;boost.classList.remove('active');});}
window.addEventListener('keydown',e=>{if(!game||$('arenaPlay').classList.contains('hidden'))return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft','ShiftRight'].includes(e.code)){e.preventDefault();keys.add(e.code);}if(e.code==='Escape')pause();});window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',release);document.addEventListener('visibilitychange',()=>{if(document.hidden){release();if(!online)pause(true);}});
const arenaCanvas=$('arenaCanvas');
arenaCanvas.addEventListener('pointerdown',e=>{
 if(paused||!game||game.status!=='playing')return;e.preventDefault();
 if(e.pointerType==='mouse'){
  const r=arenaCanvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,index=!online&&mode==='duo'?Number(r.width>r.height?x>=r.width/2:y>=r.height/2):0;
  mousePointers.set(e.pointerId,index);controls[index].angle=renderer.aimAt(index,x,y);arenaCanvas.setPointerCapture(e.pointerId);return;
 }
 const r=arenaCanvas.getBoundingClientRect(),index=gestures.start(e,r,!online&&mode==='duo');if(index===null)return;
 mouseAngle=null;arenaCanvas.setPointerCapture(e.pointerId);const pad=$('joystick'+(index+1));pad.style.left=(e.clientX-r.left-56)+'px';pad.style.top=(e.clientY-r.top-56)+'px';pad.classList.add('steering');
});
arenaCanvas.addEventListener('pointermove',e=>{
 if(paused||!game||game.status!=='playing')return;
 if(e.pointerType==='mouse'){
  const r=arenaCanvas.getBoundingClientRect(),index=mousePointers.get(e.pointerId);
  if(index!==undefined)controls[index].angle=renderer.aimAt(index,e.clientX-r.left,e.clientY-r.top);
  else if(online||mode!=='duo')mouseAngle=renderer.aimAt(0,e.clientX-r.left,e.clientY-r.top);
  return;
 }
 const index=gestures.move(e);if(index!==null){const p=gestures.pointers.get(e.pointerId),r=arenaCanvas.getBoundingClientRect(),pad=$('joystick'+(index+1));pad.style.left=(p.x-r.left-56)+'px';pad.style.top=(p.y-r.top-56)+'px';pad.querySelector('i').style.transform='translate('+(gestures.mode==='joystick'?p.knobX:Math.cos(p.angle||0)*12)+'px,'+(gestures.mode==='joystick'?p.knobY:Math.sin(p.angle||0)*12)+'px)';}
});
for(const event of ['pointerup','pointercancel','lostpointercapture'])arenaCanvas.addEventListener(event,e=>{gestures.stop(e.pointerId);const index=mousePointers.get(e.pointerId);if(index!==undefined){controls[index].angle=null;mousePointers.delete(e.pointerId);}});
window.addEventListener('resize',()=>renderer.resize());window.addEventListener('beforeunload',release);
$('arenaModes').addEventListener('click',e=>{const b=e.target.closest('[data-mode]');if(b)selectMode(b.dataset.mode);});$('arenaStart').onclick=()=>mode==='online'?createRoom():localStart();$('arenaJoin').onclick=async()=>{const button=$('arenaJoin');button.disabled=true;try{say('جاري الانضمام…');await connectRoom($('arenaCode').value.trim());}catch(e){say(e.message);}finally{button.disabled=false;}};$('arenaResume').onclick=async()=>{const old=saved();if(!old)return;selectMode('online');try{await connectRoom(old.code,old);}catch(e){say(e.message);}};
$('arenaReady').onclick=()=>send({type:'ready',ready:!room?.players.find(p=>p.id===selfId)?.ready});$('arenaHostStart').onclick=()=>send({type:'start'});$('copyRoom').onclick=async()=>{try{await navigator.clipboard.writeText(room.code);$('copyRoom').textContent='تم النسخ ✓';}catch{$('lobbyMessage').textContent='رمز الغرفة: '+room.code;}};
$('arenaMatchMode').addEventListener('change',()=>show('durationField',$('arenaMatchMode').value==='timed'));$('arenaControl').addEventListener('change',()=>{gestures.mode=$('arenaControl').value;release();try{localStorage.setItem('bs-arena-control',gestures.mode)}catch{}});try{$('arenaControl').value=localStorage.getItem('bs-arena-control')==='swipe'?'swipe':'joystick'}catch{}$('arenaPlayers').addEventListener('change',limitBots);for(const id of ['lobbyBots','lobbyDifficulty','lobbyMatchMode','lobbyDuration'])$(id).addEventListener('change',()=>send({type:'configure',botCount:Number($('lobbyBots').value),difficulty:$('lobbyDifficulty').value,matchMode:$('lobbyMatchMode').value,duration:Number($('lobbyDuration').value)}));
$('arenaInviteFriends').onclick=()=>{if(room?.status==='lobby')window.BS_SOCIAL?.openInvitePicker?.({game:'serpent',roomCode:room.code});};
$('arenaShareRoom').onclick=async()=>{if(!room)return;const url=location.origin+'/serpent?room='+room.code;try{if(navigator.share)await navigator.share({title:'حلبة الثعبان',text:'تعال إلى غرفة المطاردة '+room.code,url});else{await navigator.clipboard.writeText(url);$('lobbyMessage').textContent='تم نسخ رابط الغرفة — أرسله لصديقك';}}catch(e){if(e.name!=='AbortError')$('lobbyMessage').textContent=url;}};
$('arenaPause').onclick=()=>pause();$('arenaContinue').onclick=()=>pause(false);for(const id of ['arenaExit','arenaPauseExit','arenaResultExit','arenaLeaveLobby'])$(id).onclick=()=>quit();$('arenaAgain').onclick=()=>online?send({type:'rematch'}):localStart();$('arenaFullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('arenaPlay').requestFullscreen();renderer.resize();}catch{window.BS_PLATFORM?.toast?.('ملء الشاشة غير مدعوم في هذا المتصفح');}};
const portrait=document.createElement('img');portrait.src='assets/previews/snake-gold.webp';portrait.alt='';$('arenaPortrait').appendChild(portrait);const name=window.BS_CAREER?.get?.().name;if(name)$('arenaName').value=name;show('arenaResume',!!saved());
const code=new URLSearchParams(location.search).get('room');if(code&&/^\d{6}$/.test(code)){selectMode('online');$('arenaCode').value=code;$('arenaMessage').textContent='دعوة للغرفة '+code+' — اكتب اسمك واضغط انضم';}
if(trial){document.body.dataset.trial=trial.id;show('arenaTrial');$('trialName').textContent=trial.name;for(const button of $('arenaModes').querySelectorAll('button'))button.disabled=button.dataset.mode!=='solo';show('arenaResume',false);selectMode('solo');$('modeDescription').textContent='تجربة محلية للمظهر — بدون شراء أو تغيير مقتنياتك';}
requestAnimationFrame(frame);
