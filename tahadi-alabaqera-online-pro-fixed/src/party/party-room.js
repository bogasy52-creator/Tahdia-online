import {loadParty,storeParty} from './party-storage.js';
import {createParty,addPartyPlayer,partySnapshot,partyRoundView,configureParty,applyPartyAction,advanceParty,openPartyLink,failPartyLink,applyLinkResult} from './party-engine.js';
import {createLinkedRoom} from './party-link.js';
import {steerSerpent,serpentSnapshot} from '../../public/assets/js/engines/serpent-engine.js';
import {compactSerpentFrame,compactSerpentKeyframe} from '../../public/assets/js/serpent-network.js';
const PROTOCOL='tahdia-party-v29',json=(value,status=200)=>Response.json(value,{status,headers:{'cache-control':'no-store'}});
const open=ws=>ws.readyState===undefined||ws.readyState===1;
export class PartyRoom{
 constructor(ctx,env){this.ctx=ctx;this.env=env;this.room=null;this.chain=Promise.resolve();this.timer=null;this.lastSavedAt=0;this.ready=ctx.blockConcurrencyWhile(async()=>{this.room=await loadParty(ctx.storage);if(this.room){this.syncConnections();if(this.room.status==='countdown'&&this.room.order.some(id=>!this.room.players[id].connected)){this.room.status='lobby';this.room.startsAt=0;for(const p of Object.values(this.room.players))if(!p.connected)p.ready=false;await this.save();await this.schedule();}this.run();}});}
 enqueue(fn){const work=this.chain.then(fn);this.chain=work.catch(()=>{});return work;}
 syncConnections(){if(!this.room)return;const ids=new Set();for(const ws of this.ctx.getWebSockets())try{const a=ws.deserializeAttachment(),p=this.room.players[a?.playerId];if(open(ws)&&p&&p.connection===a.connection)ids.add(p.id);}catch{}for(const p of Object.values(this.room.players)){const connected=ids.has(p.id);if(p.connected&&!connected)p.disconnectedAt=Date.now();p.connected=connected;}}
 async save(){if(this.room){this.room.updatedAt=Date.now();try{await storeParty(this.ctx.storage,this.room);this.lastSavedAt=Date.now();this.dirty=false;}catch(error){this.dirty=true;throw error;}}}
 async schedule(){const room=this.room;if(!room)return;const now=Date.now(),r=room.round;let next=room.expiresAt;
  if(room.status==='countdown')next=Math.min(next,room.startsAt);if(room.status==='intermission')next=Math.min(next,room.nextAt);
  // a round played in the real game only waits for its result (or opens that game's room)
  if(room.status==='playing'&&r.link&&r.link.status!=='failed'){next=Math.min(next,r.deadline);if(r.link.status==='creating')next=Math.min(next,now+50);}
  else if(room.status==='playing'){next=Math.min(next,r.deadline);if(['quiz','logic'].includes(r.game))next=Math.min(next,r.revealUntil||r.questionDeadline,now<r.answerOpensAt?r.answerOpensAt:Infinity);if(r.game==='reaction')next=Math.min(next,r.signal==='wait'?r.signalAt:r.signalDeadline);if(r.tables)next=Math.min(next,now+650);if(r.game==='memory')for(const p of Object.values(r.participants))if(p.unlockAt)next=Math.min(next,p.unlockAt);if(r.game==='serpent')next=Math.min(next,now+5000);}
  const host=room.order.map(id=>room.players[id]).find(p=>p.role==='host');if(host&&!host.connected&&host.disconnectedAt){const grace=host.disconnectedAt+60000;if(now<grace)next=Math.min(next,grace);else if(room.order.some(id=>room.players[id].connected))next=Math.min(next,now+20);}
  await this.ctx.storage.setAlarm(Math.max(now+20,next));
 }
 error(ws,error,seq=null){try{ws.send(JSON.stringify({type:'error',message:String(error?.message||error||'تعذر تنفيذ الحركة'),seq}));}catch{}}
 send(ws,value){try{if(open(ws))ws.send(typeof value==='string'?value:JSON.stringify(value));}catch{}}
 members(){return this.ctx.getWebSockets().filter(ws=>{try{const a=ws.deserializeAttachment();return a?.party&&open(ws)&&this.room?.players[a.playerId]?.connection===a.connection;}catch{return false;}});}
 broadcast(privateIds=[],full=false){if(!this.room)return;this.room.revision++;const common=partySnapshot(this.room,null);if(common.round?.arena)delete common.round.arena;const payload=JSON.stringify({type:'room',state:common}),all=this.members();for(const ws of all){this.send(ws,payload);const id=ws.deserializeAttachment().playerId;if(full||privateIds.includes(id))this.send(ws,{type:'private',sessionId:this.room.sessionId,roundId:this.room.round?.id||null,revision:this.room.revision,me:partyRoundView(this.room,id)?.me||null});}}
 promoteHost(now){const old=Object.values(this.room.players).find(p=>p.role==='host');if(old&&!old.connected&&old.disconnectedAt&&now-old.disconnectedAt>=60000){const next=this.room.order.map(id=>this.room.players[id]).find(p=>p.connected);if(next){old.role='guest';next.role='host';return true;}}return false;}
 run(){if(this.timer!==null||this.room?.status!=='playing'||this.room.round?.game!=='serpent'||!this.room.round.arena||!Object.values(this.room.players).some(p=>p.connected))return;this.lastFrame=null;this.timer=setInterval(()=>{if(this.tickBusy)return;this.tickBusy=true;this.enqueue(()=>this.step(Date.now(),true)).catch(()=>{this.stop();return this.ctx.storage.setAlarm(Date.now()+1000).catch(()=>{});}).finally(()=>this.tickBusy=false);},50);this.timer.unref?.();}
 stop(){if(this.timer!==null)clearInterval(this.timer);this.timer=null;this.lastFrame=null;}
 // 32.1.0: open the real game's room for a round that is played there
 async ensureLink(){
  const r=this.room?.round;if(this.room?.status!=='playing'||r?.link?.status!=='creating'||this.linkBusy===r.id)return false;
  this.linkBusy=r.id;
  try{const res=await createLinkedRoom(this.env,r.game,{settings:r.settings,count:r.link.count,seats:r.link.seats||r.link.count,link:{code:this.room.code,round:r.id,token:r.link.token}});if(this.room?.round!==r)return false;if(res.ok)return openPartyLink(this.room,res,Date.now());r.link.attempts=(r.link.attempts||0)+1;}
  catch{if(this.room?.round!==r)return false;r.link.attempts=(r.link.attempts||0)+1;}
  finally{if(this.linkBusy===r.id)this.linkBusy=null;}
  // two failures: the round is played inside the party instead
  return r.link.attempts>=2?failPartyLink(this.room,Date.now()):true;
 }
 async step(now,arenaTick=false){if(!this.room)return;if(this.dirty){await this.save();this.broadcast([],true);}const result=advanceParty(this.room,now),promoted=this.promoteHost(now);if(await this.ensureLink()){result.changed=true;result.full=true;}if(arenaTick&&this.room.status==='playing'&&this.room.round?.game==='serpent'&&this.room.round.arena){
  const arena=this.room.round.arena;if(arena.tick%2===0){const state={round:this.room.round.id,status:'playing',game:serpentSnapshot(arena)},full=!this.lastFrame||now-(this.lastKeyframeAt||0)>=2000,packet=full?compactSerpentKeyframe(state,'efficient'):compactSerpentFrame(state,this.lastFrame,'efficient');const payload=JSON.stringify({type:'arena',roundId:this.room.round.id,frame:packet});let legacyPayload;for(const ws of this.members()){if(!ws.deserializeAttachment().arenaKeyframes){legacyPayload??=JSON.stringify({type:'arena',roundId:this.room.round.id,frame:full?{type:'state',state}:compactSerpentFrame(state,this.lastFrame,'tight')});this.send(ws,legacyPayload);}else this.send(ws,payload);}this.lastFrame=state;if(full)this.lastKeyframeAt=now;}
  if(now-this.lastSavedAt>=5000||promoted){await this.save();if(promoted)this.broadcast();await this.schedule();}return;
 }
 if(this.room.status!=='playing'||this.room.round?.game!=='serpent'||!this.room.round.arena)this.stop();if(result.changed||promoted){await this.save();this.broadcast(result.privateIds,result.full);await this.schedule();this.run();}else if(!arenaTick)await this.schedule();}
 async fetch(request){await this.ready;const url=new URL(request.url);
  if(url.pathname==='/init'&&request.method==='POST')return this.enqueue(async()=>{if(this.room&&this.room.expiresAt>Date.now())return json({ok:false,error:'room_exists'},409);try{this.room=createParty({...await request.json(),links:true});await this.save();await this.schedule();return json({ok:true,capacity:this.room.capacity},201);}catch(e){return json({ok:false,error:e.message},400);}});
  if(!this.room||this.room.expiresAt<=Date.now())return json({ok:false,error:'الغرفة انتهت أو غير موجودة'},404);
  if(url.pathname==='/status')return json({ok:true,game:'party',code:this.room.code,status:this.room.status,players:this.room.order.length,playerLimit:this.room.capacity,version:29});
  // 32.1.0: the real game's room reports its final ranking
  if(url.pathname==='/link-result'&&request.method==='POST')return this.enqueue(async()=>{const body=await request.json().catch(()=>null);if(!applyLinkResult(this.room,body,Date.now()))return json({ok:false,error:'round_closed'},409);await this.save();this.broadcast([],true);await this.schedule();return json({ok:true});});
  if(url.pathname==='/ws')return this.enqueue(()=>this.connect(request,url));return json({ok:false,error:'not_found'},404);
 }
 async connect(request,url){if(request.headers.get('upgrade')?.toLowerCase()!=='websocket')return json({ok:false,error:'WebSocket required'},426);const protocols=String(request.headers.get('sec-websocket-protocol')||'').split(',').map(x=>x.trim());if(!protocols.includes(PROTOCOL))return json({ok:false,error:'protocol_required'},426);
  const resume=protocols.find(x=>x.startsWith('rt.'))?.slice(3),host=protocols.find(x=>x.startsWith('hk.'))?.slice(3),account=request.headers.get('x-bs-account')||null;let p=resume?Object.values(this.room.players).find(p=>p.token===resume):null;if(!p&&host===this.room.hostKey&&this.room.originalHost)p=this.room.players[this.room.originalHost];
  if(resume&&!p)return json({ok:false,error:'تعذر استعادة المقعد؛ رمز العودة غير صالح'},403);
  if(!p&&this.room.order.length===0&&host!==this.room.hostKey)return json({ok:false,error:'بانتظار المضيف'},409);
  if(!p&&account&&this.room.order.some(id=>this.room.players[id].username===account))return json({ok:false,error:'حسابك موجود؛ ارجع من نفس المتصفح لاستعادة المقعد'},409);
  if(!p)try{p=addPartyPlayer(this.room,{name:url.searchParams.get('name'),username:account});if(p.role==='host')this.room.originalHost=p.id;}catch(e){return json({ok:false,error:e.message},409);}
  if(p.username&&account!==p.username)return json({ok:false,error:'account_mismatch'},403);
  p.connection=crypto.randomUUID();for(const old of this.ctx.getWebSockets())try{if(old.deserializeAttachment()?.playerId===p.id)old.close(4001,'replaced');}catch{}
  const pair=new WebSocketPair(),client=pair[0],server=pair[1];this.ctx.acceptWebSocket(server);server.serializeAttachment({party:true,playerId:p.id,connection:p.connection,arenaKeyframes:url.searchParams.get('arena')==='keyframe-v1'});p.connected=true;p.disconnectedAt=null;this.room.expiresAt=Date.now()+24*3600000;await this.step(Date.now());await this.save();await this.schedule();this.send(server,{type:'welcome',playerId:p.id,token:p.token,state:partySnapshot(this.room,p.id)});this.lastFrame=null;this.broadcast([],false);this.run();return new Response(null,{status:101,webSocket:client,headers:{'sec-websocket-protocol':PROTOCOL}});
 }
 queueAction(ws,player,message){
  this.actionQueue??=[];if(this.actionQueue.length>=64){this.error(ws,'الغرفة تستقبل حركات كثيرة؛ أعد المحاولة',message.seq);return Promise.resolve();}
  const promise=new Promise(resolve=>this.actionQueue.push({ws,id:player.id,connection:player.connection,message,resolve}));
  if(!this.actionTimer)this.actionTimer=setTimeout(()=>{this.actionTimer=null;this.enqueue(()=>this.flushActions()).catch(()=>{});},12);
  return promise;
 }
 async flushActions(){
  const rows=this.actionQueue?.splice(0)||[];if(!rows.length||!this.room){for(const row of rows)row.resolve();return;}
  const before=structuredClone(this.room),now=Date.now(),progress=advanceParty(this.room,now),accepted=[],errors=[],privateIds=new Set(progress.privateIds);let full=progress.full;
  for(const row of rows){const p=this.room.players[row.id];if(!p||p.connection!==row.connection){row.resolve();continue;}
   try{if(now-(p.messageAt||0)<35)throw Error('انتظر لحظة بين الحركات');p.messageAt=now;const result=applyPartyAction(this.room,p.id,row.message,now);accepted.push({...row,result});privateIds.add(p.id);if(this.room.round?.tables)full=true;}
   catch(error){errors.push({...row,error});}
  }
  const after=advanceParty(this.room,now);full||=after.full;for(const id of after.privateIds)privateIds.add(id);
  try{if(accepted.length||progress.changed||after.changed){await this.save();for(const row of accepted)this.send(row.ws,{type:'ack',roundId:row.message.roundId,seq:row.message.seq,duplicate:Boolean(row.result.duplicate),feedback:row.result.feedback});this.broadcast([...privateIds],full);await this.schedule();this.run();}
   for(const row of errors){this.error(row.ws,row.error,row.message.seq);this.send(row.ws,{type:'snapshot',state:partySnapshot(this.room,row.id)});}
  }catch(error){this.room=before;this.lastFrame=null;for(const row of accepted){this.error(row.ws,'تعذر حفظ الحركة؛ لم تُسجّل، أعد المحاولة',row.message.seq);this.send(row.ws,{type:'snapshot',state:partySnapshot(this.room,row.id)});}throw error;}
  finally{for(const row of rows)row.resolve();}
 }
 async webSocketMessage(ws,raw){await this.ready;const text=typeof raw==='string'?raw:new TextDecoder().decode(raw);if(text.length>6000)return this.error(ws,'الرسالة أكبر من المسموح');let msg;try{msg=JSON.parse(text);}catch{return this.error(ws,'رسالة غير صالحة');}if(!msg||typeof msg!=='object'||Array.isArray(msg))return;
  const a=ws.deserializeAttachment(),p=this.room?.players[a?.playerId];if(!p||p.connection!==a.connection)return;
  if(msg.type==='ping'){this.send(ws,{type:'pong',sentAt:msg.sentAt,serverNow:Date.now()});return;}
  if(msg.type==='input'){const r=this.room.round;if(this.room.status!=='playing'||r?.game!=='serpent'||!r.arena||msg.roundId!==r.id||msg.sessionId!==this.room.sessionId)return;const now=Date.now();const snake=r.arena.snakes.find(s=>s.id===p.id),release=msg.boost===false&&snake?.boost;if(now-(p.inputAt||0)<30&&!release)return;if(!steerSerpent(r.arena,p.id,{angle:msg.angle,boost:msg.boost===true}))return;p.inputAt=now;r.participants[p.id].actions++;this.run();return;}
  if(msg.type==='action')return this.queueAction(ws,p,msg);
  return this.enqueue(async()=>{try{const now=Date.now();if(msg.type==='sync'){if(now-(p.syncAt||0)<500)return;p.syncAt=now;this.lastFrame=null;this.send(ws,{type:'snapshot',state:partySnapshot(this.room,p.id)});return;}
   if(now-(p.messageAt||0)<35)throw Error('انتظر لحظة بين الحركات');p.messageAt=now;await this.step(now);
   if(msg.type==='leave'&&this.room.status==='lobby'){this.room.order=this.room.order.filter(id=>id!==p.id);delete this.room.players[p.id];if(p.role==='host'&&this.room.order.length)this.room.players[this.room.order[0]].role='host';ws.close(1000,'left');await this.save();this.broadcast();return;}
   let result;if(msg.type==='action'){result=applyPartyAction(this.room,p.id,msg,now);this.send(ws,{type:'ack',roundId:this.room.round.id,seq:msg.seq,duplicate:Boolean(result.duplicate),feedback:result.feedback});}else configureParty(this.room,p.id,msg,now);
   const progress=advanceParty(this.room,now);await this.save();if(msg.type==='remove')for(const other of this.ctx.getWebSockets())if(other.deserializeAttachment()?.playerId===msg.playerId)other.close(4004,'seat_removed');this.broadcast(result?.privateIds||[],progress.full||Boolean(this.room.round?.tables));await this.schedule();this.run();
  }catch(e){this.error(ws,e,msg.type==='action'?msg.seq:null);this.send(ws,{type:'snapshot',state:partySnapshot(this.room,p.id)});}});
 }
 async webSocketClose(ws){await this.ready;return this.enqueue(async()=>{const a=ws.deserializeAttachment(),p=this.room?.players[a?.playerId];if(!p||p.connection!==a.connection)return;p.connected=false;p.disconnectedAt=Date.now();if(['lobby','countdown'].includes(this.room.status)){p.ready=false;if(this.room.status==='countdown'){this.room.status='lobby';this.room.startsAt=0;}}if(this.room.round?.arena)steerSerpent(this.room.round.arena,p.id,{angle:this.room.round.arena.snakes.find(s=>s.id===p.id)?.angle||0,boost:false});await this.save();this.broadcast();await this.schedule();if(!Object.values(this.room.players).some(p=>p.connected))this.stop();});}
 async webSocketError(ws){return this.webSocketClose(ws);}
 async alarm(){await this.ready;return this.enqueue(async()=>{if(!this.room)return;if(this.room.expiresAt<=Date.now()){this.stop();for(const ws of this.members())ws.close(4003,'room_expired');await this.ctx.storage.deleteAll();this.room=null;return;}await this.step(Date.now());this.run();});}
}
