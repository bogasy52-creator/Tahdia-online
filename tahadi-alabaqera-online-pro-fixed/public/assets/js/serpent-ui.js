import {ARENA_POWERS,powerActive} from './engines/arena-drops-v24.js';
import {createSerpentGame,addSerpentBots,steerSerpent,stepSerpent,serpentSteeringAngle} from './engines/serpent-engine.js?v=29.1.0';
import {SerpentRenderer,arenaTelemetry,resolveTrialSkin} from './serpent-renderer.js?v=29.1.0';
import {ArenaGestures} from './arena-gestures.js?v=29.1.0-s1';
import {applySerpentFrame} from './serpent-network.js?v=29.1.0';
import {SERPENT_WORLDS,ownerAllowed} from './engines/arena-worlds-v27.js';
import {installArenaExperience,updateArenaExperience,resetTraining} from './arena-experience-v27.js';

const $=id=>document.getElementById(id),SESSION='busraj-serpent-room-v12';
installArenaExperience();
const renderer=new SerpentRenderer($('arenaCanvas')),keys=new Set(),mousePointers=new Map(),headings=[null,null],controls=[{angle:null,boost:false},{angle:null,boost:false}];
const journal=window.BS_PLAY_INSIGHTS?.arena();renderer.mapVisible=true;
const trial=resolveTrialSkin(window.BS_CAREER?.catalog||[],location.search);
const gestures=new ArenaGestures({mode:'floating',steer:(index,angle)=>{controls[index].angle=angle;headings[index]=angle;},end:index=>{controls[index].angle=null;const ring=$('joystick'+(index+1));ring.classList.remove('steering');ring.classList.add('hidden');}});
let mode='quick',game=null,room=null,socket=null,selfId=null,paused=false,online=false,networkActive=false,reconnects=0,reconnectTimer=null,lastFrame=performance.now(),accumulator=0,lastInput=0,lastHud=0,receipt='',resultShown='',mouseAngle=null;
let lastNetworkMessage=0,lastHeartbeat=0,connectionWelcomed=false;
document.addEventListener('bs-ui-overlay',()=>{if(!online&&game?.status==='playing')pause(true);});
// A live round streams frames about ten times a second, so five silent seconds
// mean a dead link. Outside a round nothing is streamed: a slow heartbeat keeps
// the room open without spending a Durable Object request every two seconds.
const LIVE_SILENCE_MS=5000,IDLE_SILENCE_MS=45000,IDLE_HEARTBEAT_MS=20000;
function networkTick(){
 if(!networkActive||!online||!connectionWelcomed||!socket||socket.readyState!==WebSocket.OPEN||document.hidden)return;
 const now=performance.now(),live=room?.status==='playing';if(lastNetworkMessage&&now-lastNetworkMessage>(live?LIVE_SILENCE_MS:IDLE_SILENCE_MS)){socket.close(4000,'stale_connection');return;}
 if(!live&&now-lastHeartbeat>=IDLE_HEARTBEAT_MS&&(socket.bufferedAmount||0)<8192){lastHeartbeat=now;socket.send(JSON.stringify({type:'ping',sentAt:now}));}
}
// Steering is sent only when it changes (or once a second as a refresh), not on
// every animation frame: each message is a billed Durable Object request.
let lastSentInput=null;const INPUT_MIN_MS=50,INPUT_REFRESH_MS=1000,INPUT_ANGLE_EPSILON=.03;
function inputChanged(angle,boost){if(!lastSentInput)return true;if(lastSentInput.boost!==boost)return true;return Math.abs(Math.atan2(Math.sin(angle-lastSentInput.angle),Math.cos(angle-lastSentInput.angle)))>INPUT_ANGLE_EPSILON;}
setInterval(networkTick,1000);
let connectionEpoch=0,requestController=null,cancelConnect=null;const rewardRefreshes=new Set();
const show=(id,yes=true)=>{const el=$(id);if(!el)return;el.classList.toggle('hidden',!yes);if(el.classList.contains('arena-overlay')){el.hidden=!yes;el.inert=!yes;el.dataset.open=String(yes);el.setAttribute('aria-hidden',String(!yes));}};
function cancelled(){const error=new Error('connection_cancelled');error.name='AbortError';return error;}
function invalidateConnection(){connectionEpoch++;cancelConnect?.();cancelConnect=null;requestController?.abort();requestController=null;clearTimeout(reconnectTimer);return connectionEpoch;}
function beginConnection(){const epoch=invalidateConnection();if(socket){const old=socket;socket=null;old.close(1000,'switch_room');}requestController=new AbortController();return epoch;}
function activeAttempt(epoch){return epoch===connectionEpoch;}
function exitStageFullscreen(){if(document.fullscreenElement===$('arenaPlay'))Promise.resolve(document.exitFullscreen?.()).catch(()=>{});}
const say=text=>{const target=online&&room?.status==='lobby'?$('lobbyMessage'):$('arenaMessage');target.textContent=text;};
function saved(){try{return JSON.parse(localStorage.getItem(SESSION)||'null')}catch{return null}}
function remember(value){try{value?localStorage.setItem(SESSION,JSON.stringify(value)):localStorage.removeItem(SESSION)}catch{}show('arenaResume',!!value);}
function release(){gestures.clear();mousePointers.clear();renderer.inputs?.clear();keys.clear();mouseAngle=null;headings.fill(null);for(const c of controls){c.angle=null;c.boost=false;}for(const id of ['boost1','boost2'])$(id).classList.remove('active');document.querySelectorAll('.arena-joystick i').forEach(el=>el.style.transform='');if(online&&socket?.readyState===WebSocket.OPEN&&game){const mine=game.snakes.find(s=>s.id===selfId);if(mine){socket.send(JSON.stringify({type:'input',angle:mine.angle,boost:false}));lastSentInput={angle:mine.angle,boost:false};}}}
function selectMode(next){
 const previousMode=mode;if(mode!==next)quit(false);mode=next;if(mode==='solo'&&previousMode!==mode)$('arenaTraining').dispatchEvent(new Event('change'));$('arenaStart').disabled=false;$('arenaJoin').disabled=false;$('arenaModes').querySelectorAll('button').forEach(b=>{b.classList.toggle('selected',b.dataset.mode===mode);b.setAttribute('aria-pressed',String(b.dataset.mode===mode));});
 const quick=mode==='quick',net=mode==='online';show('arenaCoachField',mode==='solo');show('arenaOptions',!quick);show('secondNameField',mode==='duo');show('botsField',!quick);show('difficultyField',!quick);$('arenaMatchMode').closest('label').classList.toggle('hidden',quick);show('durationField',!quick&&$('arenaMatchMode').value!=='survival');show('onlineCountField',net);show('arenaWorldField',!quick&&!net);show('onlineJoin',net);show('localControlHint');if(net){$('arenaBots').value='0';if($('arenaDifficulty').value==='legendary')$('arenaDifficulty').value='hard';if($('arenaMatchMode').value==='treasure')$('arenaMatchMode').value='timed';}for(const item of $('arenaDifficulty').options)item.disabled=net&&item.value==='legendary';for(const item of $('arenaMatchMode').options)item.disabled=net&&item.value==='treasure';limitBots();
 show('arenaWorldPicker',!quick);show('arenaTrainingField',mode==='solo');
 $('arenaStart').textContent=quick?'مواجهة سريعة · 15 ثانية ↗':net?'أنشئ غرفة خاصة ↗':mode==='solo'?'ابدأ التدريب ↗':'ادخل الحلبة ↗';$('modeDescription').textContent=quick?'مواجهة عامة على خريطة يختارها السيرفر؛ البداية بعد 15 ثانية':net?'اختر خريطتك وواجه أصدقاءك بنفس خصائص التدريب':mode==='duo'?'شاشتان مستقلتان داخل الجهاز نفسه':'أكاديمية بثلاثة مسارات تدريب وسبع حلبات تفاعلية';
 $('localControlHint').querySelector('span').textContent=mode==='duo'?'كل لاعب يحرك إصبعه في أي مكان داخل نصفه. الكمبيوتر: الأول بالأسهم وSpace؛ الثاني بـWASD وShift.':'اسحب العصا من أي مكان؛ تظل ملاصقة لإصبعك. ارفعه ليكمل اتجاهه. ⚡ للتسريع. الكمبيوتر: الماوس أو الأسهم.';
 if(mode==='duo'&&!$('arenaBots').querySelector('[value="0"]')){const o=document.createElement('option');o.value='0';o.textContent='بدون بوت';$('arenaBots').prepend(o);$('arenaBots').value='0';}
 if(mode==='solo'&&$('arenaBots').value==='0')$('arenaBots').value='8';$('arenaMessage').textContent='';
}
function setPlay(){
 document.body.classList.add('serpent-active');show('arenaGuide',false);show('arenaCombatGuide',false);show('arenaPlay');show('arenaMenu',false);show('arenaLobby',false);show('arenaPauseCover',false);show('arenaResults',false);show('arenaPause',!online);
 gestures.mode=$('arenaControl')?.value||'floating';$('arenaPlay').dataset.control=gestures.mode;$('arenaPlay').dataset.duo=String(!online&&mode==='duo');show('joystick1',false);show('joystick2',false);show('arenaLeaderboard',false);$('arenaRanks').setAttribute('aria-expanded','false');show('boost2',!online&&mode==='duo');
 paused=false;lastFrame=performance.now();accumulator=0;resultShown='';resetTraining();$('arenaTrainingResult').textContent='';release();renderer.reset();journal?.reset(game,!online&&mode==='duo'?[selfId,'local-2']:[selfId]);renderer.resize();$('arenaHint').textContent='الأطول يحسم الرأس وأول 4 قطع. ابتعد عن نهاية الذيل.';show('arenaWorldStatus',false);
}
function localStart(){
 quit(false);online=false;room=null;selfId='local-1';const profile=window.BS_CAREER?.get?.(),accountAccess=window.BS_CAREER?.access?.(),owner=ownerAllowed(accountAccess,window.BS_CAREER?.catalog||[])&&!trial,royalSkin=(window.BS_CAREER?.catalog||[]).find(item=>item.type==='snake'&&item.source==='owner');const players=[{id:selfId,name:$('arenaName').value||'لاعب الحلبة',skin:owner&&royalSkin?.id||trial?.id||profile?.equipped?.snake||'snake-wild'}];
 if(mode==='duo')players.push({id:'local-2',name:$('arenaName2').value||'اللاعب الثاني',skin:'snake-wild'});
 const world=SERPENT_WORLDS[$('arenaWorld').value]||SERPENT_WORLDS.classic,challenge=$('arenaMatchMode').value,difficulty=$('arenaDifficulty').value;
 game=createSerpentGame(players,{collisionMode:'arena-v23',worldId:world.id,training:mode==='solo'?$('arenaTraining').value:'free',trainingDifficulty:difficulty,matchMode:challenge==='survival'?'survival':'timed',duration:Number($('arenaDuration').value),difficulty:difficulty==='legendary'?'hard':difficulty,seed:crypto.getRandomValues(new Uint32Array(1))[0]});addSerpentBots(game,Number($('arenaBots').value));
 receipt='serpent-local:'+(crypto.randomUUID?.()||Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join(''));setPlay();renderer.setGame(game,players.map(p=>p.id));updateHud();window.BS_AUDIO?.play?.('connect');
}
async function api(path,body,epoch){
 const signal=requestController&&activeAttempt(epoch)?(AbortSignal.any?AbortSignal.any([requestController.signal,AbortSignal.timeout(9000)]):AbortSignal.timeout(9000)):AbortSignal.timeout(9000);
 let response;try{response=await fetch(path,{method:body?'POST':'GET',headers:{...(body?{'content-type':'application/json'}:{}),...(localStorage.getItem('bs_social_session')?{authorization:'Bearer '+localStorage.getItem('bs_social_session')}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store',signal});}catch{if(epoch!=null&&!activeAttempt(epoch)||signal.aborted)throw cancelled();throw new Error('تعذر الوصول للسيرفر. تأكد من الاتصال وتشغيل النسخة الكاملة.');}
 const data=await response.json().catch(()=>({}));if(!response.ok||data.ok===false){const error=new Error(data.error||'تعذر الاتصال بالغرفة');error.code=data.code;throw error;}return data;
}
async function quickJoin(){
 const epoch=beginConnection();$('arenaStart').disabled=true;say('جاري دخول اللوبي العام…');try{const ticket=await api('/api/serpent/quick',{name:$('arenaName').value},epoch);if(!activeAttempt(epoch))return;remember({code:ticket.code,token:ticket.token});await connectRoom(ticket.code,{token:ticket.token},epoch);}catch(e){if(activeAttempt(epoch)&&e.name!=='AbortError')say(e.message);}finally{if(activeAttempt(epoch))$('arenaStart').disabled=false;}
}
async function createRoom(){
 const epoch=beginConnection();$('arenaStart').disabled=true;say('جاري إنشاء الحلبة…');try{const data=await api('/api/serpent/rooms',{worldId:$('arenaWorld').value,playerLimit:Number($('arenaPlayers').value),matchMode:$('arenaMatchMode').value,duration:Number($('arenaDuration').value),botCount:Number($('arenaBots').value),difficulty:$('arenaDifficulty').value},epoch);if(!activeAttempt(epoch))return;remember({code:data.code,hostKey:data.hostKey});await connectRoom(data.code,{hostKey:data.hostKey},epoch);}catch(e){if(activeAttempt(epoch)&&e.name!=='AbortError')say(e.message);}finally{if(activeAttempt(epoch))$('arenaStart').disabled=false;}
}
function limitBots(){const max=mode==='online'?Math.min(6,20-Number($('arenaPlayers').value)):mode==='duo'?8:9;for(const o of $('arenaBots').querySelectorAll('option'))o.disabled=Number(o.value)>max;if(Number($('arenaBots').value)>max)$('arenaBots').value=String(max);}
async function connectRoom(code,credentials={},attempt){
 if(!/^\d{6}$/.test(code))throw new Error('اكتب رمز الغرفة المكوّن من ستة أرقام');
 const epoch=attempt??beginConnection();if(!activeAttempt(epoch))throw cancelled();await api('/api/serpent/rooms/'+code+'/status',undefined,epoch);if(!activeAttempt(epoch))throw cancelled();
 if(socket){const old=socket;socket=null;old.close(1000,'switch_room');}
 const session=localStorage.getItem('bs_social_session'),protocols=['busraj-serpent-v1','bs-serpent-body1'];if(credentials.hostKey)protocols.push('hk.'+credentials.hostKey);if(credentials.token)protocols.push('rt.'+credentials.token);if(session)protocols.push('st.'+session);
 online=true;networkActive=true;connectionWelcomed=false;lastNetworkMessage=lastHeartbeat=performance.now();const ws=new WebSocket(location.origin.replace(/^http/,'ws')+'/api/serpent/rooms/'+code+'/ws?name='+encodeURIComponent($('arenaName').value||'لاعب الحلبة'),protocols);socket=ws;
 return new Promise((resolve,reject)=>{
  let welcomed=false;const cancel=()=>{clearTimeout(timeout);if(!welcomed)reject(cancelled());if(socket===ws)socket=null;ws.close(1000,'cancelled');};cancelConnect=cancel;const timeout=setTimeout(()=>{if(!welcomed){ws.close();reject(new Error('انتهت مهلة الاتصال. تأكد من الرمز ونشر السيرفر الجديد.'));}},9000);
  ws.onmessage=event=>{if(socket!==ws||!activeAttempt(epoch))return;let message;try{message=JSON.parse(event.data)}catch{return}lastNetworkMessage=performance.now();
   if(message.type==='welcome'){welcomed=true;lastSentInput=null;connectionWelcomed=true;clearTimeout(timeout);if(cancelConnect===cancel)cancelConnect=null;selfId=message.playerId;reconnects=0;remember({code,token:message.token,playerId:selfId});show('arenaConnection',false);acceptRoom(message.state);resolve();}
   else if(message.type==='state')acceptRoom(message.state);
   else if(message.type==='frame'){if(message.state?.game?.tick<=game?.tick)return;const next=applySerpentFrame(room,message);if(next)acceptRoom(next);else ws.send(JSON.stringify({type:'resync'}));}
   else if(message.type==='error')say(message.message);
   else if(message.type==='pong')return;
  };
  ws.onerror=()=>{if(!activeAttempt(epoch))return;if(!welcomed){if(cancelConnect===cancel)cancelConnect=null;clearTimeout(timeout);if(!credentials.token)networkActive=false;reject(new Error('تعذر الانضمام. الغرفة قد تكون ممتلئة أو بدأت، أو السيرفر يحتاج تحديثًا.'));}};
  ws.onclose=event=>{
   clearTimeout(timeout);if(cancelConnect===cancel)cancelConnect=null;if(socket!==ws||!activeAttempt(epoch))return;connectionWelcomed=false;socket=null;release();
   if(!welcomed)reject(new Error('لم يكتمل الدخول إلى الغرفة'));
   if(!networkActive||!welcomed)return;
   if(event.code===4001){networkActive=false;$('arenaConnection').textContent='الغرفة مفتوحة من نافذة أخرى. أغلقها ثم ارجع من القائمة.';show('arenaConnection');return;}
   if(event.reason==='room_expired'){remember(null);networkActive=false;quit();say('انتهت الغرفة. أنشئ حلبة جديدة.');return;}
   $('arenaConnection').textContent='انقطع الاتصال. جاري الرجوع إلى الحلبة…';show('arenaConnection');scheduleReconnect();
  };
 });
}
function scheduleReconnect(){
 const credentials=saved(),generation=connectionEpoch;if(!networkActive||!credentials)return;
 if(reconnects>=3){networkActive=false;$('arenaConnection').textContent='تعذر استعادة الاتصال. ارجع للقائمة واضغط «ارجع إلى غرفتك السابقة».';return;}
 clearTimeout(reconnectTimer);reconnectTimer=setTimeout(async()=>{if(!networkActive||!activeAttempt(generation))return;reconnects++;const epoch=beginConnection();try{await connectRoom(credentials.code,credentials,epoch)}catch(e){if(!activeAttempt(epoch)||e.name==='AbortError')return;if(e.code==='DURABLE_REQUEST_LIMIT'){networkActive=false;$('arenaConnection').textContent=e.message;return;}if(networkActive)scheduleReconnect();}},Math.min(4500,1000*reconnects+1000));
}
function send(data){if(socket?.readyState===WebSocket.OPEN){socket.send(JSON.stringify(data));return true;}say('انتظر عودة الاتصال أولًا');return false;}
function acceptRoom(state){
 if(!state)return;window.BS_INVITES?.set({game:'serpent',code:state.code,joinable:state.status==='lobby'&&!state.publicMatch});const newRound=!room||room.round!==state.round||room.status!==state.status;room=state;room.clientReceivedAt=Date.now();
 if(state.status==='lobby'){
  exitStageFullscreen();release();game=null;paused=false;show('arenaGuide',false);show('arenaCombatGuide',false);document.body.classList.remove('serpent-active');show('arenaPlay',false);show('arenaMenu',false);show('arenaLobby');$('roomCode').textContent=state.code;const publicMatch=state.publicMatch===true;$('arenaLobby').querySelector('.lobby-heading .arena-eyebrow').textContent=publicMatch?'PUBLIC ARENA':'PRIVATE ROOM';$('arenaLeaveLobby').textContent=publicMatch?'إلغاء البحث':'غادر الغرفة';$('lobbyNote').textContent=publicMatch?'حتى 6 لاعبين · البداية تلقائية ويكمل البوت العدد.':'البوتات تظهر بعلامة BOT، ويتحكم بها السيرفر. تعديلها يلغي الجاهزية حتى يوافق الجميع.';show('quickLobbyBanner',publicMatch);document.querySelector('.room-code-block').classList.toggle('hidden',publicMatch);document.querySelector('.arena-invite-actions').classList.toggle('hidden',publicMatch);document.querySelector('.arena-lobby-bots').classList.toggle('hidden',publicMatch);document.querySelector('.lobby-heading h1').textContent=publicMatch?'المنافسون يتجمعون.':'اجمع فريق المطاردة.';document.querySelector('.lobby-heading p').textContent=publicMatch?'البداية تلقائية. واجه الأقصر بمقدمتك، وابتعد عن نهاية الذيل.':'أرسل رمز الغرفة لأصدقائك، ثم اضغطوا جاهز.';
  const list=$('arenaRoomPlayers');list.replaceChildren();for(const p of state.players){const card=document.createElement('div');card.className='arena-room-player';card.dataset.ready=String(p.ready);const name=document.createElement('b'),status=document.createElement('span');name.textContent=p.name+(p.role==='host'?' · المضيف':'');status.textContent=!p.connected?'منقطع مؤقتًا':p.ready?'✓ جاهز':'بانتظار الجاهزية';card.append(name,status);list.appendChild(card);}
  const own=state.players.find(p=>p.id===selfId),full=state.players.length===state.playerLimit,ready=full&&state.players.every(p=>p.ready&&p.connected);$('arenaReady').textContent=own?.ready?'إلغاء الجاهزية':'أنا جاهز';show('arenaReady',!publicMatch);show('arenaHostStart',!publicMatch&&own?.role==='host');$('arenaHostStart').disabled=!ready;$('lobbyMessage').textContent=publicMatch?'دخل '+state.players.filter(p=>p.connected).length+' من '+state.playerLimit+' · المقاعد الباقية تُملأ ببوتات':ready?'الجميع جاهز. المضيف يقدر يبدأ الآن.':'وصل '+state.players.length+' من '+state.playerLimit+' — انتظر اكتمال الفريق والجاهزية.';
  $('lobbyWorld').value=state.worldId||'classic';$('lobbyBots').value=String(state.botCount||0);$('lobbyDifficulty').value=state.difficulty||'medium';$('lobbyMatchMode').value=state.matchMode||'timed';$('lobbyDuration').value=String(state.duration);show('lobbyDurationField',state.matchMode!=='survival');for(const field of ['lobbyWorld','lobbyBots','lobbyDifficulty','lobbyMatchMode','lobbyDuration'])$(field).disabled=own?.role!=='host'||publicMatch;for(const o of $('lobbyBots').querySelectorAll('option'))o.disabled=Number(o.value)>Math.min(6,20-state.playerLimit);$('lobbyBotsSummary').textContent=(SERPENT_WORLDS[state.worldId]?.name||'مدار الطاقة')+' · '+(state.botCount||0)+' بوتات + '+state.playerLimit+' أصدقاء';
 }else{
  game=state.game;if($('arenaPlay').classList.contains('hidden')||newRound&&state.status==='playing')setPlay();renderer.setGame(game,[selfId],true);if(newRound||state.status==='finished')updateHud();if(state.status==='finished'||game?.status==='finished')showResults();
 }
}
function updateHud(){
 if(!game)return;const ids=!online&&mode==='duo'?[selfId,'local-2']:[selfId];journal?.observe(game,ids);const mine=game.snakes.find(s=>s.id===selfId)||game.snakes[0],second=!online&&mode==='duo'?game.snakes.find(s=>s.id==='local-2'):null;
 $('hudName').textContent=second?mine.name+' / '+second.name:mine.name;$('hudScore').textContent=second?mine.score+' : '+second.score:mine.score;const remaining=Math.max(0,Math.ceil(game.duration-game.elapsed)),survival=game.matchMode==='survival';$('hudClockLabel').textContent=survival?'آخر ثعبان يبقى':'الوقت المتبقي';$('hudTime').textContent=survival?game.snakes.filter(s=>s.alive).length+' / '+game.snakes.length:Math.floor(remaining/60)+':'+String(remaining%60).padStart(2,'0');
 const info=arenaTelemetry(game,selfId);$('arenaPlay').dataset.danger=String(info.danger);$('hudRank').textContent='المركز '+info.rank+' · '+info.alive+' في الحلبة';
 $('boostFill').style.width=Math.round(info.boost*100)+'%';$('boostMeter').setAttribute('aria-valuenow',String(Math.round(info.boost*100)));$('boostStatus').textContent=!mine.alive?'خارج الجولة':mine.boost?'تسريع نشط':info.boost>0?'التسريع جاهز':'اجمع طاقة للتسريع';$('hudKills').textContent=info.kills+' افتراس';
 $('arenaHint').textContent=!mine.alive?'خرجت من الجولة. تابع المطاردة.':info.danger?'انتبه للحدود — التفّ إلى الداخل':mine.boost?'التسريع يستهلك من حجمك':mine.mass<=24?'اجمع طاقة أكثر للتسريع':'الرأس + 4 قطع: الأطول يفوز · نهاية الذيل قاتلة';
 updateArenaExperience(game,selfId,!online&&mode==='solo');
 const powerBar=$('arenaPowers');if(powerBar){const powers=Object.entries(ARENA_POWERS).filter(([kind])=>powerActive(mine,kind,game.elapsed));powerBar.replaceChildren(...powers.map(([kind,power])=>{const row=document.createElement('span');row.style.setProperty('--power-color',power.color);row.textContent=power.icon+' '+power.name;const time=document.createElement('b');time.textContent=Math.ceil(mine.powers[kind]-game.elapsed)+'ث';row.append(time);return row;}));}
 const coach=$('arenaCoachTask');if(coach){const guide=!online&&mode==='solo'&&$('arenaCoach')?.checked!==false,observed=journal?.summary(game).find(value=>value.id===selfId);coach.classList.toggle('hidden',!guide||game.status!=='playing'||game.elapsed>18);coach.textContent=!mine.alive?'جرّب مرة ثانية: تجنب نهاية ذيول الخصوم ووفّر التسريع للهرب.':mine.score<10?'التدريب · اجمع 10 طاقات لتكبر.':!observed?.boosted?'ممتاز! جرّب ضغط زر التسريع، ثم ارفعه.':game.elapsed<30?'التحكم صار لك · تجنب نهاية ذيول الخصوم حتى 30 ثانية.':'✓ أتقنت البداية · كمل المطاردة!';}
 const ranking=$('arenaRanking');ranking.replaceChildren();for(const s of [...game.snakes].sort((a,b)=>b.score-a.score).slice(0,4)){const row=document.createElement('li'),name=document.createElement('span'),score=document.createElement('b');row.dataset.self=String(s.id===selfId);name.textContent=s.name;if(s.bot){const mark=document.createElement('em');mark.textContent=' BOT';name.appendChild(mark);}score.textContent=s.score;row.append(name,score);ranking.appendChild(row);}
 for(let i=0;i<2;i++){const snake=i===0?mine:second;const button=$('boost'+(i+1));button.disabled=!snake?.alive||snake.mass<=24||paused;button.classList.toggle('active',!!snake?.boost);button.setAttribute('aria-label',snake?.mass<=24?'اجمع طاقة أكثر للتسريع':'تسريع'+(i?' اللاعب الثاني':''));}
}
function showResults(){
 if(!game)return;const key=online?room.code+':'+room.round+':'+selfId:receipt,first=resultShown!==key;show('arenaResults');const won=game.winners.length===1&&game.winners[0]===selfId;
 $('arenaResultTitle').textContent=game.winners.length>1?'مطاردة متعادلة':won?'الحلبة صارت لك.':'انتهت المطاردة.';
 const reason=game.snakes.find(s=>s.id===selfId)?.deathReason;$('arenaResultCopy').textContent=reason==='tail'?'اصطدمت بنهاية ذيل الخصم. النهاية المعلّمة بالأحمر قاتلة مهما كان طولك.':reason==='front'?'الخصم أطول عند مواجهة الرأس أو أول 4 قطع. اجمع الأكل ثم واجه الأقصر.':reason==='draw'?'تساوى الطول عند المقدمة؛ خرجتما معًا.':won?'حركة ذكية. وطاقة تستاهلها.':'كل مطاردة تعلّمك حركة جديدة. جرّب التفافًا أوسع في الجولة القادمة.';
 journal?.observe(game,!online&&mode==='duo'?[selfId,'local-2']:[selfId]);const ownStats=journal?.summary(game).find(value=>value.id===selfId);if($('arenaGatheredStat'))$('arenaGatheredStat').textContent=ownStats?.gathered??Math.max(0,(game.snakes.find(s=>s.id===selfId)?.score||0)-(game.snakes.find(s=>s.id===selfId)?.kills||0)*10);if($('arenaKillsStat'))$('arenaKillsStat').textContent=ownStats?.kills||0;if($('arenaDurationStat'))$('arenaDurationStat').textContent=Math.round(game.elapsed);$('arenaScoreLine')?.setAttribute('points',journal?.curve()||'');
 const scores=$('arenaFinalScores');scores.replaceChildren();for(const s of [...game.snakes].sort((a,b)=>b.score-a.score)){const row=document.createElement('div'),name=document.createElement('span'),score=document.createElement('b'),kills=document.createElement('small');name.textContent=s.name+(s.bot?' · BOT':'');kills.textContent=s.kills+' افتراس'+(s.alive?'':' · خارج الجولة');name.appendChild(kills);score.textContent=s.score+' طاقة';row.append(name,score);scores.appendChild(row);}
 const own=room?.players.find(p=>p.id===selfId);$('arenaAgain').disabled=online&&!room?.publicMatch&&(own?.role!=='host'||!room.rewardsComplete);$('arenaAgain').textContent=room?.publicMatch?'مواجهة سريعة جديدة ↗':online&&own?.role!=='host'?'بانتظار الجولة التالية من المضيف':'جولة ثانية ↗';
 if(first){resultShown=key;release();window.BS_AUDIO?.play?.(won?'win':'land');const winner=game.winners.length===1?game.snakes.find(s=>s.id===game.winners[0]):null;window.BS_GAME_FX?.celebrate?.(winner?.name||'تعادل',{key:'serpent:'+key,self:won,tie:game.winners.length!==1,subtitle:winner?'حسم الحلبة بالطول والتحكم.':'تساوت المطاردة حتى آخر لحظة.'});
  if(trial)$('arenaRewardMessage').textContent='هذه جولة تجربة. مقتنياتك ورصيدك لم يتغيرا.';
  else if(!online&&game.elapsed>=30){window.BS_CAREER?.record?.({id:receipt,game:'serpent',win:won}).then(()=>{if(resultShown===key&&game&&!$('arenaPlay').classList.contains('hidden'))$('arenaRewardMessage').textContent='تمت إضافة مكافأة جولتك إلى تقدمك.';});}
  else $('arenaRewardMessage').textContent='';
 }
 if(online&&room.rewardsComplete&&game.elapsed>=30&&window.BS_CAREER?.account?.()){
  const account=window.BS_CAREER.account(),rewardKey=key+':'+account;
  if(!rewardRefreshes.has(rewardKey)){rewardRefreshes.add(rewardKey);if(rewardRefreshes.size>64)rewardRefreshes.delete(rewardRefreshes.values().next().value);const current=()=>resultShown===key&&online&&game&&window.BS_CAREER.account()===account;
   window.BS_CAREER.refresh().then(()=>{if(current())$('arenaRewardMessage').textContent='نتيجتك ومكافأتك محفوظتان في حسابك.';}).catch(()=>{if(current())$('arenaRewardMessage').textContent='نتيجتك محفوظة؛ أعد تحديث رصيدك عند عودة الاتصال.';});
  }
 }

}
function quit(toMenu=true){
 window.BS_INVITES?.set?.({game:'serpent',code:'',joinable:false});
 invalidateConnection();exitStageFullscreen();$('arenaStart').disabled=false;$('arenaJoin').disabled=false;release();networkActive=false;clearTimeout(reconnectTimer);if(socket){const old=socket;socket=null;if(room?.status==='lobby'&&old.readyState===WebSocket.OPEN)old.send(JSON.stringify({type:'leave'}));old.close(1000,'user_left');}
 game=null;room=null;online=false;selfId=null;paused=false;resultShown='';accumulator=0;renderer.game=null;show('arenaConnection',false);
 if(toMenu){document.body.classList.remove('serpent-active');show('arenaPlay',false);show('arenaLobby',false);show('arenaMenu');show('arenaGuide');show('arenaCombatGuide');show('arenaResume',!!saved());$('arenaMessage').textContent='';}
}
function pause(next=!paused){if(online||!game||game.status!=='playing')return;paused=next;release();show('arenaPauseCover',paused);lastFrame=performance.now();accumulator=0;if(paused)$('arenaContinue').focus();else $('arenaPause').focus();}
function keyboardAngle(index){const p2=index===1,list=p2?['KeyA','KeyD','KeyW','KeyS']:['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'];let x=Number(keys.has(list[1]))-Number(keys.has(list[0])),y=Number(keys.has(list[3]))-Number(keys.has(list[2]));if(!p2&&mode!=='duo'){x+=Number(keys.has('KeyD'))-Number(keys.has('KeyA'));y+=Number(keys.has('KeyS'))-Number(keys.has('KeyW'));}return x||y?Math.atan2(y,x):null;}
function applyInputs(now){
 const ids=!online&&mode==='duo'?[selfId,'local-2']:[selfId];ids.forEach((id,index)=>{const s=game.snakes.find(s=>s.id===id);if(!s?.alive)return;const manual=controls[index].angle??keyboardAngle(index)??(index===0?mouseAngle:null);if(manual!==null)headings[index]=manual;else if(headings[index]!==null)headings[index]=serpentSteeringAngle(game,s,headings[index]);const angle=manual??headings[index]??s.targetAngle??s.angle,boost=controls[index].boost||(index===0?keys.has('Space')||(mode!=='duo'&&(keys.has('ShiftLeft')||keys.has('ShiftRight'))):keys.has('ShiftLeft')||keys.has('ShiftRight'));
  if(online){renderer.setInput?.(id,angle,boost);if(now-lastInput>=INPUT_MIN_MS&&(inputChanged(angle,boost)||now-lastInput>=INPUT_REFRESH_MS)&&socket?.readyState===WebSocket.OPEN&&(socket.bufferedAmount||0)<8192){socket.send(JSON.stringify({type:'input',angle,boost}));lastInput=now;lastSentInput={angle,boost};}}else steerSerpent(game,id,{angle,boost});
 });
}
function frame(now){
 const dt=Math.min(.1,Math.max(0,(now-lastFrame)/1000));lastFrame=now;
 if(game&&!document.hidden&&!$('arenaPlay').classList.contains('hidden')){
  if(!paused&&game.status==='playing'){applyInputs(now);if(!online){accumulator+=dt;while(accumulator>=1/60&&game.status==='playing'){stepSerpent(game,1/60);accumulator-=1/60;}renderer.setGame(game,!online&&mode==='duo'?[selfId,'local-2']:[selfId]);}}
  journal?.observe(game,!online&&mode==='duo'?[selfId,'local-2']:[selfId]);renderer.draw(now);if(now-lastHud>160){updateHud();lastHud=now;}if(game.status==='finished'&&!online&&resultShown!==receipt)showResults();
 }
 requestAnimationFrame(frame);
}
for(let i=0;i<2;i++){const boost=$('boost'+(i+1));boost.addEventListener('pointerdown',e=>{e.preventDefault();if(paused||!game||game.status!=='playing')return;boost.setPointerCapture(e.pointerId);controls[i].boost=true;boost.classList.add('active');});for(const event of ['pointerup','pointercancel','lostpointercapture'])boost.addEventListener(event,()=>{controls[i].boost=false;boost.classList.remove('active');});}
window.addEventListener('keydown',e=>{if(!game||$('arenaPlay').classList.contains('hidden'))return;if(paused||!$('arenaResults').classList.contains('hidden')){if(e.code==='Escape'&&!e.repeat){e.preventDefault();pause(false);}return;}if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft','ShiftRight'].includes(e.code)){e.preventDefault();keys.add(e.code);}if(e.code==='Escape'&&!e.repeat){e.preventDefault();pause();}});window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',release);document.addEventListener('bs-ui-overlay',release);document.addEventListener('visibilitychange',()=>{if(document.hidden){release();if(!online)pause(true);}else if(online&&socket?.readyState===WebSocket.OPEN){lastNetworkMessage=performance.now();socket.send(JSON.stringify({type:'resync'}));}});

function touchCue(index,e){
 const ring=$('joystick'+(index+1)),rect=$('arenaCanvas').getBoundingClientRect();
 const pointer=gestures.pointers.get(e.pointerId);
 ring.classList.remove('hidden');ring.classList.add('steering');
 const diameter=ring.getBoundingClientRect().width||112,half=diameter/2;
 const cx=(pointer?.originX??e.clientX)-rect.left,cy=(pointer?.originY??e.clientY)-rect.top;
 // The old -34px value offset a 112px ring by 22px, making touch feel inaccurate.
 ring.style.left=Math.max(0,Math.min(rect.width-diameter,cx-half))+'px';
 ring.style.top=Math.max(0,Math.min(rect.height-diameter,cy-half))+'px';
 const knob=ring.querySelector('i'),travel=Math.max(0,(diameter-(knob?.offsetWidth||38))/2-3);
 const dx=pointer?.knobX||0,dy=pointer?.knobY||0,magnitude=Math.hypot(dx,dy),scale=magnitude?Math.min(1,travel/magnitude):0;
 knob.style.transform=`translate(${(dx*scale).toFixed(1)}px,${(dy*scale).toFixed(1)}px)`;
}
// Public lobby countdown: a ring that empties, with the seconds drawn in the
// middle. The canvas is cleared and redrawn on every frame, so a new digit
// never keeps marks of the one before it (iPhone left parts of old glyphs
// behind when the number was plain text).
const LOBBY_MS=15000;let lobbyFrame=0;
function lobbyCountdown(){
 lobbyFrame=0;
 if(!room?.publicMatch||room.status!=='lobby')return;
 const left=room.lobbyDeadline?Math.max(0,room.lobbyDeadline-(room.serverNow+Date.now()-room.clientReceivedAt)):LOBBY_MS,seconds=Math.ceil(left/1000),label=$('quickCountdown'),canvas=$('quickCountdownRing');
 if(label&&label.textContent!==String(seconds))label.textContent=String(seconds);
 const c=canvas?.getContext?.('2d');
 if(c){
  const css=canvas.clientWidth||132,dpr=Math.min(3,window.devicePixelRatio||1),px=Math.round(css*dpr);
  if(canvas.width!==px){canvas.width=px;canvas.height=px;}
  const mid=css/2,r=mid-7,share=Math.min(1,left/Math.max(LOBBY_MS,left)),warm=seconds<=3;
  c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,css,css);c.lineWidth=8;c.lineCap='round';
  c.strokeStyle='rgba(255,255,255,.1)';c.beginPath();c.arc(mid,mid,r,0,Math.PI*2);c.stroke();
  if(share>0){const g=c.createLinearGradient(0,0,css,css);g.addColorStop(0,warm?'#ffd27a':'#9ff3cf');g.addColorStop(1,warm?'#ff8a5c':'#e9d27c');c.strokeStyle=g;c.beginPath();c.arc(mid,mid,r,-Math.PI/2,-Math.PI/2+share*Math.PI*2);c.stroke();}
  c.fillStyle=warm?'#ffe2b8':'#e6f7da';c.font='800 '+Math.round(css*.4)+'px Tajawal, system-ui, sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(String(seconds),mid,mid+css*.025);
 }
 if(left>0&&room.lobbyDeadline)lobbyFrame=requestAnimationFrame(lobbyCountdown);
}
setInterval(()=>{if(!lobbyFrame)lobbyCountdown();},400);
const arenaCanvas=$('arenaCanvas');
arenaCanvas.addEventListener('pointerdown',e=>{
 if(paused||!game||game.status!=='playing')return;e.preventDefault();
 if(e.pointerType==='mouse'){
  if(e.button!==0)return;
  const r=arenaCanvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,index=!online&&mode==='duo'?Number(r.width>r.height?x>=r.width/2:y>=r.height/2):0;
  mousePointers.set(e.pointerId,index);controls[index].angle=renderer.aimAt(index,x,y);arenaCanvas.setPointerCapture(e.pointerId);return;
 }
 const index=gestures.start(e,arenaCanvas.getBoundingClientRect(),!online&&mode==='duo');if(index!==null){arenaCanvas.setPointerCapture(e.pointerId);touchCue(index,e);}
});
arenaCanvas.addEventListener('pointermove',e=>{
 if(paused||!game||game.status!=='playing')return;
 if(e.pointerType==='mouse'){
  const r=arenaCanvas.getBoundingClientRect(),index=mousePointers.get(e.pointerId);
  if(index!==undefined)controls[index].angle=renderer.aimAt(index,e.clientX-r.left,e.clientY-r.top);
  else if(online||mode!=='duo')mouseAngle=renderer.aimAt(0,e.clientX-r.left,e.clientY-r.top);
  return;
 }
 const index=gestures.move(e);if(index!==null)touchCue(index,e);
});
for(const event of ['pointerup','pointercancel','lostpointercapture'])arenaCanvas.addEventListener(event,e=>{gestures.stop(e.pointerId);const index=mousePointers.get(e.pointerId);if(index!==undefined){controls[index].angle=null;mousePointers.delete(e.pointerId);}});
window.addEventListener('resize',()=>renderer.resize());window.addEventListener('beforeunload',release);
$('arenaModes').addEventListener('click',e=>{const b=e.target.closest('[data-mode]');if(b)selectMode(b.dataset.mode);});$('arenaStart').onclick=()=>mode==='quick'?quickJoin():mode==='online'?createRoom():localStart();$('arenaJoin').onclick=async()=>{const epoch=beginConnection(),button=$('arenaJoin');button.disabled=true;try{say('جاري الانضمام…');await connectRoom($('arenaCode').value.trim(),{},epoch);}catch(e){if(activeAttempt(epoch)&&e.name!=='AbortError')say(e.message);}finally{if(activeAttempt(epoch))button.disabled=false;}};$('arenaResume').onclick=async()=>{const old=saved();if(!old)return;selectMode('online');const epoch=beginConnection();try{await connectRoom(old.code,old,epoch);}catch(e){if(activeAttempt(epoch)&&e.name!=='AbortError')say(e.message);}};
$('arenaReady').onclick=()=>send({type:'ready',ready:!room?.players.find(p=>p.id===selfId)?.ready});$('arenaHostStart').onclick=()=>send({type:'start'});$('copyRoom').onclick=async()=>{try{await navigator.clipboard.writeText(room.code);$('copyRoom').textContent='تم النسخ ✓';}catch{$('lobbyMessage').textContent='رمز الغرفة: '+room.code;}};
$('arenaMatchMode').addEventListener('change',()=>show('durationField',$('arenaMatchMode').value!=='survival'));try{localStorage.removeItem('bs-arena-control')}catch{}$('arenaPlayers').addEventListener('change',limitBots);$('arenaWorld').addEventListener('change',()=>{const w=SERPENT_WORLDS[$('arenaWorld').value]||SERPENT_WORLDS.classic;$('arenaWorldDescription').textContent=w.description;});for(const id of ['lobbyWorld','lobbyBots','lobbyDifficulty','lobbyMatchMode','lobbyDuration'])$(id).addEventListener('change',()=>send({type:'configure',worldId:$('lobbyWorld').value,botCount:Number($('lobbyBots').value),difficulty:$('lobbyDifficulty').value,matchMode:$('lobbyMatchMode').value,duration:Number($('lobbyDuration').value)}));
$('arenaInviteFriends').onclick=()=>{if(room?.status==='lobby')window.BS_SOCIAL?.openInvitePicker?.({game:'serpent',roomCode:room.code});};
$('arenaShareRoom').onclick=async()=>{if(!room)return;const url=location.origin+'/serpent?room='+room.code;try{if(navigator.share)await navigator.share({title:'حلبة الثعبان',text:'تعال إلى غرفة المطاردة '+room.code,url});else{await navigator.clipboard.writeText(url);$('lobbyMessage').textContent='تم نسخ رابط الغرفة — أرسله لصديقك';}}catch(e){if(e.name!=='AbortError')$('lobbyMessage').textContent=url;}};
$('arenaRanks').onclick=()=>{const open=$('arenaLeaderboard').classList.contains('hidden');show('arenaLeaderboard',open);$('arenaRanks').setAttribute('aria-expanded',String(open));};
$('arenaMapToggle').onclick=()=>{renderer.mapVisible=renderer.mapVisible===false;$('arenaMapToggle').setAttribute('aria-pressed',String(renderer.mapVisible));};
$('arenaPause').onclick=()=>pause();$('arenaContinue').onclick=()=>pause(false);for(const id of ['arenaExit','arenaPauseExit','arenaResultExit','arenaLeaveLobby'])$(id).onclick=()=>quit();$('arenaAgain').onclick=()=>{if(room?.publicMatch){quit();selectMode('quick');quickJoin();}else if(online)send({type:'rematch'});else localStart();};$('arenaFullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('arenaPlay').requestFullscreen();renderer.resize();}catch{window.BS_PLATFORM?.toast?.('ملء الشاشة غير مدعوم في هذا المتصفح');}};
const portrait=document.createElement('canvas');portrait.width=840;portrait.height=504;portrait.setAttribute('aria-hidden','true');$('arenaPortrait').appendChild(portrait);let portraitSkin='snake-wild',portraitAt=0;const paintPortrait=stamp=>{if(portrait.isConnected&&!document.hidden&&!$('arenaMenu').classList.contains('hidden')&&stamp-portraitAt>80){window.BS_SERPENT_ART?.preview(portrait,portraitSkin,window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?0:stamp/1000);portraitAt=stamp;}requestAnimationFrame(paintPortrait);};requestAnimationFrame(paintPortrait);function equippedPreview(){const id=trial?.id||window.BS_CAREER?.get?.().equipped?.snake||'snake-wild',item=(window.BS_CAREER?.catalog||[]).find(item=>item.id===id&&item.type==='snake');portraitSkin=item?.id||'snake-wild';window.BS_SERPENT_ART?.ready.then(()=>window.BS_SERPENT_ART.preview(portrait,portraitSkin));if($('arenaEquippedArt'))$('arenaEquippedArt').src=portraitSkin==='snake-sovereign'?'assets/brand/sovereign-hero.webp':'assets/previews/'+portraitSkin+'.webp';if($('arenaEquippedName'))$('arenaEquippedName').textContent=item?.name||'الأفعى البرية';}equippedPreview();window.addEventListener('bs-career-change',equippedPreview);const name=window.BS_CAREER?.get?.().name;if(name)$('arenaName').value=name;show('arenaResume',!!saved());
try{$('arenaWorld').value=localStorage.getItem('bs-serpent-world-v25-3')||'classic';}catch{}
$('arenaWorld').dispatchEvent(new Event('change'));$('arenaWorld').addEventListener('change',()=>{try{localStorage.setItem('bs-serpent-world-v25-3',$('arenaWorld').value);}catch{}});
selectMode(mode);
const code=new URLSearchParams(location.search).get('room');if(code&&/^\d{6}$/.test(code)){selectMode('online');$('arenaCode').value=code;$('arenaMessage').textContent='دعوة للغرفة '+code+' — اكتب اسمك واضغط انضم';}
if(trial){document.body.dataset.trial=trial.id;show('arenaTrial');$('trialName').textContent=trial.name;for(const button of $('arenaModes').querySelectorAll('button'))button.disabled=button.dataset.mode!=='solo';show('arenaResume',false);selectMode('solo');$('modeDescription').textContent='تجربة محلية للمظهر — بدون شراء أو تغيير مقتنياتك';}
requestAnimationFrame(frame);

const quality=$('arenaQuality');if(quality){try{quality.value=localStorage.getItem('tahdia-arena-details-v16')||'auto';}catch{}renderer.setQuality(quality.value);quality.onchange=()=>{renderer.setQuality(quality.value);try{localStorage.setItem('tahdia-arena-details-v16',quality.value)}catch{}};}

const controlChoice=$('arenaControl');if(controlChoice){try{controlChoice.value=localStorage.getItem('tahdia-arena-control-v23')||'floating';}catch{}controlChoice.onchange=()=>{release();gestures.mode=controlChoice.value;try{localStorage.setItem('tahdia-arena-control-v23',controlChoice.value);}catch{}};}
