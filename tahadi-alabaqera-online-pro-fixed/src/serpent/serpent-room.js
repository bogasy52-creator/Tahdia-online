import {createSerpentGame,addSerpentBots,steerSerpent,stepSerpent,serpentSnapshot} from '../../public/assets/js/engines/serpent-engine.js';
import {getSocialStub} from '../social/social-api.js';
import {compactSerpentFrame} from '../../public/assets/js/serpent-network.js';

const TTL=30*60_000,PROTOCOL='busraj-serpent-v1';
const json=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store'}});
const clean=value=>String(value||'لاعب').replace(/[<>\u0000-\u001f]/g,'').trim().slice(0,24)||'لاعب';
const secret=()=>crypto.randomUUID()+crypto.randomUUID();
const isOpen=ws=>!ws.closed&&(ws.readyState===undefined||ws.readyState===1);

export class SerpentRoom {
 constructor(ctx,env){
  this.ctx=ctx;this.env=env;this.room=null;this.timer=null;this.lastSave=0;this.saving=null;this.finishedWork=null;
  this.ready=ctx.blockConcurrencyWhile(async()=>{this.room=await ctx.storage.get('serpent')||null;if(this.room){this.syncConnections();this.run();}});
 }
 syncConnections(){
  if(!this.room)return;const ids=new Set(this.ctx.getWebSockets().filter(isOpen).map(ws=>{try{return ws.deserializeAttachment()?.playerId}catch{return null}}));
  for(const p of this.room.players)p.connected=ids.has(p.id);
 }
 async save(){if(this.room)await this.ctx.storage.put('serpent',this.room);}
 async schedule(){if(!this.room)return;const at=this.room.publicMatch&&this.room.status==='lobby'&&this.room.lobbyDeadline?Math.min(this.room.expiresAt,this.room.lobbyDeadline):this.room.status==='finished'&&!this.room.rewardsComplete?Math.min(this.room.expiresAt,Date.now()+10_000):this.room.expiresAt;await this.ctx.storage.setAlarm(at);}
 publicState(){
  if(!this.room)return null;const r=this.room;
  return {code:r.code,status:r.status,round:r.round,playerLimit:r.playerLimit,publicMatch:r.publicMatch===true,lobbyDeadline:r.lobbyDeadline||null,serverNow:Date.now(),botCount:r.botCount||0,difficulty:r.difficulty||'medium',duration:r.duration,matchMode:r.matchMode||'timed',rewardsComplete:r.rewardsComplete,players:r.players.map(({id,name,role,ready,connected,skin})=>({id,name,role,ready,connected,skin})),game:r.game?serpentSnapshot(r.game):null};
 }
 broadcast(full=false){const state=this.publicState();const packet=!full&&state?.status==='playing'&&this.lastFrame?.round===state.round&&this.lastFrame?.game?compactSerpentFrame(state,this.lastFrame):{type:'state',state};const payload=JSON.stringify(packet);this.lastFrame=state;for(const ws of this.ctx.getWebSockets())if(isOpen(ws))try{ws.send(payload)}catch{}}
 error(ws,message){try{ws.send(JSON.stringify({type:'error',message}))}catch{}}
 stop(){if(this.timer!==null)clearInterval(this.timer);this.timer=null;}
 run(){
  if(this.timer!==null||this.room?.status!=='playing'||!this.room.players.some(p=>p.connected))return;
  this.lastSave=Date.now();this.timer=setInterval(()=>this.tick(),50);this.timer.unref?.();
 }
 tick(){
  if(this.room?.status!=='playing')return this.stop();this.syncConnections();
  if(!this.room.players.some(p=>p.connected))return this.stop();
  const g=this.room.game;stepSerpent(g,.05);this.pendingEvents=[...(this.pendingEvents||[]),...g.events.map((e,i)=>({...e,eventId:g.tick+':'+i}))].slice(-64);if(g.tick%2===0||g.status==='finished'){g.events=this.pendingEvents;this.broadcast();this.pendingEvents=[];}
  if(g.status==='finished'){this.room.status='finished';this.stop();this.finishedWork=this.finish().catch(()=>this.schedule());this.ctx.waitUntil?.(this.finishedWork);return;}
  if(Date.now()-this.lastSave>=5000&&!this.saving){this.lastSave=Date.now();this.saving=this.save().finally(()=>{this.saving=null});this.ctx.waitUntil?.(this.saving);}
 }
 async finish(){
  if(!this.room)return;this.room.status='finished';this.stop();await this.save();
  if(!this.room.rewardsComplete){
   // Results are issued only by the server and their receipts are idempotent.
   const g=this.room.game,eligible=g&&g.elapsed>=30;
   for(const p of this.room.players){if(!eligible||!p.username)continue;const stub=getSocialStub(this.env,p.username);if(!stub)throw new Error('career_unavailable');
    const res=await stub.fetch('https://social.internal/career/verified',{method:'POST',body:JSON.stringify({id:'serpent:'+this.ctx.id.toString()+':'+this.room.round+':'+p.id,game:'serpent',win:g.winners.length===1&&g.winners[0]===p.id})});if(!res.ok)throw new Error('career_reward_failed');
   }
   this.room.rewardsComplete=true;await this.save();
  }
  await this.schedule();this.broadcast();
 }
 async fetch(request){
  await this.ready;const url=new URL(request.url);
  if(url.pathname==='/init'&&request.method==='POST'){
   const body=await request.json().catch(()=>({}));
   if(this.room&&this.room.expiresAt>Date.now())return json({ok:false,error:'room_exists'},409);
   const count=body.playerLimit??2,duration=body.duration??120,botCount=body.botCount??0,difficulty=body.difficulty??'medium',matchMode=body.matchMode??'timed';
   if(!Number.isInteger(count)||count<2||count>8||!Number.isInteger(botCount)||botCount<0||botCount>Math.min(6,10-count)||!['easy','medium','hard'].includes(difficulty)||!['timed','survival'].includes(matchMode)||![60,120,180].includes(duration)||!/^\d{6}$/.test(body.code||'')||typeof body.hostKey!=='string'||body.hostKey.length<32)return json({ok:false,error:'إعدادات الغرفة غير صالحة'},400);
   this.stop();this.room={code:body.code,hostKey:body.hostKey,originalHost:null,status:'lobby',playerLimit:count,publicMatch:body.publicMatch===true,lobbyDeadline:null,collisionMode:'predator',botCount,difficulty,duration,matchMode,players:[],round:0,game:null,rewardsComplete:true,expiresAt:Date.now()+TTL};
   await this.save();await this.schedule();return json({ok:true},201);
  }
  if(!this.room||this.room.expiresAt<=Date.now())return json({ok:false,error:'الغرفة غير موجودة أو انتهت'},404);
  if(url.pathname==='/reserve'&&request.method==='POST'&&this.room.publicMatch){
   if(this.room.status!=='lobby'||this.room.lobbyDeadline&&this.room.lobbyDeadline<=Date.now()||this.room.players.length>=this.room.playerLimit)return json({ok:false,error:'lobby_closed'},409);
   const body=await request.json().catch(()=>({}));if(body.username&&this.room.players.some(p=>p.username===body.username))return json({ok:false,error:'أنت داخل هذا اللوبي بالفعل'},400);
   const p=this.addPlayer(body.name,'guest',body.username||null);p.connected=false;p.ready=true;
   this.room.lobbyDeadline??=Date.now()+15000;await this.save();await this.schedule();return json({ok:true,token:p.token,playerId:p.id,lobbyDeadline:this.room.lobbyDeadline},201);
  }
  if(url.pathname==='/status')return json({ok:true,game:'serpent',code:this.room.code,status:this.room.status,players:this.room.players.length,playerLimit:this.room.playerLimit,botCount:this.room.botCount||0});
  if(url.pathname==='/ws')return this.connect(request,url);
  return json({ok:false,error:'not_found'},404);
 }
 async connect(request,url){
  if(request.headers.get('upgrade')?.toLowerCase()!=='websocket')return json({ok:false,error:'WebSocket required'},426);
  const protocols=String(request.headers.get('sec-websocket-protocol')||'').split(',').map(s=>s.trim());if(!protocols.includes(PROTOCOL))return json({ok:false,error:'protocol_required'},426);
  const reconnect=protocols.find(s=>s.startsWith('rt.'))?.slice(3),hostKey=protocols.find(s=>s.startsWith('hk.'))?.slice(3),username=request.headers.get('x-bs-account')||null;
  let p=reconnect?this.room.players.find(p=>p.token===reconnect):null;
  if(this.room.publicMatch&&!p)return json({ok:false,error:'ادخل من زر المواجهة السريعة'},403);
  if(!p&&hostKey===this.room.hostKey){p=this.room.players.find(p=>p.id===this.room.originalHost);if(!p&&this.room.players.length===0){p=this.addPlayer(url.searchParams.get('name'),'host',username);this.room.originalHost=p.id;}}
  if(!p){
   if(this.room.status!=='lobby')return json({ok:false,error:'المباراة بدأت؛ ارجع من جهازك السابق أو انتظر جولة جديدة'},409);
   if(!this.room.players.length)return json({ok:false,error:'بانتظار دخول المضيف'},409);
   if(this.room.players.length>=this.room.playerLimit)return json({ok:false,error:'الغرفة ممتلئة'},409);
   if(username&&this.room.players.some(p=>p.username===username))return json({ok:false,error:'الحساب داخل الغرفة بالفعل'},409);
   p=this.addPlayer(url.searchParams.get('name'),'guest',username);
  }
  if(username&&p.username&&username!==p.username)return json({ok:false,error:'account_mismatch'},403);
  if(username){p.username=username;p.skin=request.headers.get('x-bs-skin')||'snake-wild';}
  for(const old of this.ctx.getWebSockets())try{if(old.deserializeAttachment()?.playerId===p.id)old.close(4001,'reconnected')}catch{}
  const pair=new WebSocketPair(),client=pair[0],server=pair[1];this.ctx.acceptWebSocket(server);server.serializeAttachment({serpent:true,playerId:p.id});
  p.connected=true;p.disconnectedAt=null;this.room.expiresAt=Date.now()+TTL;await this.save();await this.schedule();
  server.send(JSON.stringify({type:'welcome',playerId:p.id,token:p.token,state:this.publicState()}));this.broadcast();this.run();
  return new Response(null,{status:101,webSocket:client,headers:{'sec-websocket-protocol':PROTOCOL}});
 }
 addPlayer(name,role,username){const p={id:crypto.randomUUID(),name:clean(name),role,username,token:secret(),skin:'snake-wild',connected:true,ready:false,disconnectedAt:null};this.room.players.push(p);return p;}
 async webSocketMessage(ws,raw){
  await this.ready;if(!this.room)return;let attachment;try{attachment=ws.deserializeAttachment()}catch{return}const p=this.room.players.find(p=>p.id===attachment?.playerId);if(!p)return;
  const text=typeof raw==='string'?raw:new TextDecoder().decode(raw);if(text.length>1024)return this.error(ws,'الرسالة أكبر من المسموح');let msg;try{msg=JSON.parse(text)}catch{return this.error(ws,'رسالة غير صالحة')}
  if(!msg||typeof msg!=='object'||Array.isArray(msg))return this.error(ws,'رسالة غير صالحة');
  if(msg.type==='resync'){const now=Date.now();if(!p.resyncAt||now-p.resyncAt>=500){p.resyncAt=now;this.broadcast(true);}return;}
  if(msg.type==='configure'){
   if(p.role!=='host')return this.error(ws,'تعديل البوتات للمضيف فقط');if(this.room.status!=='lobby')return;
   const matchMode=msg.matchMode??this.room.matchMode??'timed',duration=msg.duration??this.room.duration;
   if(!Number.isInteger(msg.botCount)||msg.botCount<0||msg.botCount>Math.min(6,10-this.room.playerLimit)||!['easy','medium','hard'].includes(msg.difficulty)||!['timed','survival'].includes(matchMode)||![60,120,180].includes(duration))return this.error(ws,'اختر عدد بوتات وصعوبة وطريقة لعب صالحة؛ الحد الكلي عشرة');
   if(this.room.botCount===msg.botCount&&this.room.difficulty===msg.difficulty&&(this.room.matchMode||'timed')===matchMode&&this.room.duration===duration)return;
   this.room.botCount=msg.botCount;this.room.difficulty=msg.difficulty;this.room.matchMode=matchMode;this.room.duration=duration;for(const player of this.room.players)player.ready=false;await this.save();this.broadcast();return;
  }
  if(msg.type==='input'){
   if(this.room.status!=='playing')return;const now=Date.now();if(p.lastInputAt&&now-p.lastInputAt<30){if(msg.boost===false){const snake=this.room.game.snakes.find(s=>s.id===p.id);if(snake)snake.boost=false;}return;}p.lastInputAt=now;
   steerSerpent(this.room.game,p.id,{angle:msg.angle,boost:msg.boost===true});this.run();return;
  }
  if(msg.type==='ready'&&this.room.status==='lobby'){p.ready=msg.ready===true;await this.save();this.broadcast();return;}
  if(this.room.publicMatch&&['configure','start','rematch'].includes(msg.type))return this.error(ws,'المواجهة السريعة تبدأ تلقائيًا؛ اختر مواجهة جديدة بعد انتهائها');
  if(msg.type==='start'){
   if(p.role!=='host')return this.error(ws,'بدء الجولة للمضيف فقط');if(this.room.status!=='lobby')return;
   this.syncConnections();if(this.room.players.length!==this.room.playerLimit||!this.room.players.every(p=>p.ready&&p.connected))return this.error(ws,'انتظر اكتمال الغرفة وجاهزية الجميع');
   this.room.round++;this.room.game=createSerpentGame(this.room.players,{collisionMode:this.room.collisionMode,width:1400,height:1400,foodCount:260,matchMode:this.room.matchMode||'timed',duration:this.room.duration,difficulty:this.room.difficulty||'medium',seed:crypto.getRandomValues(new Uint32Array(1))[0]});addSerpentBots(this.room.game,this.room.botCount||0);this.room.status='playing';this.room.rewardsComplete=false;
   await this.save();await this.schedule();this.broadcast();this.run();return;
  }
  if(msg.type==='rematch'){
   if(p.role!=='host')return this.error(ws,'إعادة الجولة للمضيف فقط');if(this.room.status!=='finished')return;if(!this.room.rewardsComplete)return this.error(ws,'جاري حفظ النتيجة؛ أعد المحاولة بعد قليل');
   this.room.status='lobby';this.room.game=null;for(const player of this.room.players)player.ready=false;await this.save();await this.schedule();this.broadcast();return;
  }
  if(msg.type==='leave'&&this.room.status==='lobby'){
   this.room.players=this.room.players.filter(player=>player.id!==p.id);if(p.role==='host'){const next=this.room.players.find(player=>player.connected)||this.room.players[0];if(next)next.role='host';this.room.hostKey=secret();this.room.originalHost=next?.id||null;}
   ws.close(1000,'left');await this.save();this.broadcast();
  }
 }
 async webSocketClose(ws){
  await this.ready;if(!this.room)return;let id;try{id=ws.deserializeAttachment()?.playerId}catch{return}
  const replacement=this.ctx.getWebSockets().some(other=>other!==ws&&isOpen(other)&&other.deserializeAttachment()?.playerId===id);if(replacement)return;
  const p=this.room.players.find(p=>p.id===id);if(p){p.connected=false;p.disconnectedAt=Date.now();if(this.room.game)steerSerpent(this.room.game,id,{angle:this.room.game.snakes.find(s=>s.id===id)?.angle||0,boost:false});}
  if(!this.room.players.some(p=>p.connected))this.stop();await this.save();await this.schedule();this.broadcast();
 }
 async webSocketError(ws){return this.webSocketClose(ws);}
 async alarm(){
  await this.ready;if(!this.room)return;
  if(this.room.publicMatch&&this.room.status==='lobby'&&this.room.lobbyDeadline&&this.room.lobbyDeadline<=Date.now()){
   this.syncConnections();this.room.players=this.room.players.filter(p=>p.connected);
   if(!this.room.players.length){this.room.lobbyDeadline=null;this.room.expiresAt=Date.now()+60000;await this.save();await this.schedule();return;}
   this.room.botCount=Math.max(0,this.room.playerLimit-this.room.players.length);this.room.round++;this.room.game=createSerpentGame(this.room.players,{collisionMode:'predator',width:1200,height:1200,foodCount:260,matchMode:'survival',difficulty:'medium',seed:crypto.getRandomValues(new Uint32Array(1))[0]});addSerpentBots(this.room.game,this.room.botCount);this.room.status='playing';this.room.rewardsComplete=false;await this.save();await this.schedule();this.broadcast(true);this.run();return;
  }
  this.syncConnections();if(this.room.expiresAt<=Date.now()&&this.room.status==='playing'&&this.room.players.some(p=>p.connected)){this.room.expiresAt=Date.now()+TTL;await this.save();await this.schedule();return;}
  if(this.room.expiresAt<=Date.now()){this.stop();for(const ws of this.ctx.getWebSockets())try{ws.close(1000,'room_expired')}catch{}await this.ctx.storage.delete('serpent');await this.ctx.storage.deleteAlarm();this.room=null;return;}
  if(this.room.status==='finished'&&!this.room.rewardsComplete){try{await this.finish()}catch{await this.schedule()}}else await this.schedule();
 }
}
