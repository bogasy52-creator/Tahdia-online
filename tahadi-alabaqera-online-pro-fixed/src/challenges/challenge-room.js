import {CHALLENGES,HEROES,createChallenge,applyChallenge,advanceChallenge,challengeView,nextChallengeAlarm} from '../../public/assets/js/engines/challenge-core.js';
const reply=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'no-store'}});
const clean=value=>String(value||'لاعب').normalize('NFKC').replace(/[<>\u0000-\u001f\u202a-\u202e\u2066-\u2069]/g,'').trim().slice(0,20)||'لاعب';
export class ChallengeRoom{
 constructor(ctx,env){this.ctx=ctx;this.env=env;this.room=null;this.ready=ctx.blockConcurrencyWhile(async()=>{this.room=await ctx.storage.get('challenge')||null;});}
 async save(){await this.ctx.storage.put('challenge',this.room);await this.ctx.storage.setAlarm(this.room.match?.phase==='playing'?nextChallengeAlarm(this.room.match):this.room.expiresAt);}
 snapshot(id){const r=this.room;return{code:r.code,game:r.game,hostId:r.hostId,round:r.round,status:r.match?.phase||'lobby',players:r.players.map(p=>({id:p.id,name:p.name,hero:p.hero,connected:!!p.connection,ready:!!p.ready})),me:id,serverNow:Date.now(),match:r.match?challengeView(r.match,id):null};}
 broadcast(){for(const ws of this.ctx.getWebSockets()){const a=ws.deserializeAttachment();if(a?.challenge&&this.room?.players.some(p=>p.id===a.id&&p.connection===a.connection))try{ws.send(JSON.stringify({type:'state',state:this.snapshot(a.id)}));}catch{}}}
 async expire(){if(!this.room||Date.now()<this.room.expiresAt)return false;for(const ws of this.ctx.getWebSockets())try{ws.close(4000,'expired');}catch{}await this.ctx.storage.deleteAll();this.room=null;return true;}
 async fetch(request){await this.ready;return this.ctx.blockConcurrencyWhile(async()=>{
  const u=new URL(request.url),b=request.method==='POST'?await request.json().catch(()=>({})):{};
  if(u.pathname==='/init'){if(this.room)return reply({ok:false},409);if(!CHALLENGES[b.game]||!/^\d{6}$/.test(b.code)||typeof b.hostKey!=='string'||b.hostKey.length<32)return reply({ok:false},400);this.room={code:b.code,game:b.game,hostKey:b.hostKey,hostId:null,players:[],round:0,expiresAt:Date.now()+3600000};await this.save();return reply({ok:true},201);}
  if(!this.room||await this.expire())return reply({ok:false,error:'انتهت الغرفة؛ أنشئ غرفة جديدة'},404);
  if(u.pathname==='/status')return reply({ok:true,game:this.room.game,status:this.room.match?.phase||'lobby',players:this.room.players.length});
  if(u.pathname!=='/ws')return reply({ok:false},404);
  if(request.headers.get('upgrade')?.toLowerCase()!=='websocket')return reply({ok:false,error:'يلزم اتصال مباشر'},426);
  const protocols=String(request.headers.get('sec-websocket-protocol')||'').split(',').map(s=>s.trim()),read=prefix=>protocols.find(s=>s.startsWith(prefix))?.slice(prefix.length)||'';
  if(!protocols.includes('tahdia-challenge-v1'))return reply({ok:false,error:'حدّث الصفحة'},426);
  const r=this.room,resume=read('rt.'),username=request.headers.get('x-bs-account')||null;let p=r.players.find(p=>p.token===resume);
  if(resume&&!p)return reply({ok:false,error:'انتهت الجلسة'},403);
  if(p?.username&&p.username!==username)return reply({ok:false,error:'ارجع بالحساب نفسه'},403);
  if(!p){if(r.match?.phase==='playing')return reply({ok:false,error:'الجولة بدأت'},409);if(r.players.length>=CHALLENGES[r.game].players)return reply({ok:false,error:'الغرفة ممتلئة'},409);if(username&&r.players.some(p=>p.username===username))return reply({ok:false,error:'حسابك موجود في الغرفة'},409);if(!r.players.length&&read('hk.')!==r.hostKey)return reply({ok:false,error:'بانتظار المضيف'},403);
   const hero=request.headers.get('x-bs-character');p={id:crypto.randomUUID(),token:crypto.randomUUID()+crypto.randomUUID(),name:clean(request.headers.get('x-bs-name')||u.searchParams.get('name')),hero:HEROES.includes(hero)?hero:'fox',username,seq:0};r.players.push(p);if(!r.hostId)r.hostId=p.id;
  }
  const previous=p.connection;p.connection=crypto.randomUUID();for(const ws of this.ctx.getWebSockets())if(ws.deserializeAttachment()?.connection===previous)try{ws.close(4001,'reconnected');}catch{}
  const pair=new WebSocketPair(),ws=pair[1];this.ctx.acceptWebSocket(ws);ws.serializeAttachment({challenge:true,id:p.id,connection:p.connection});await this.save();ws.send(JSON.stringify({type:'welcome',token:p.token,seq:p.seq,state:this.snapshot(p.id)}));this.broadcast();return new Response(null,{status:101,webSocket:pair[0],headers:{'sec-websocket-protocol':'tahdia-challenge-v1'}});
 });}
 async webSocketMessage(ws,raw){await this.ready;return this.ctx.blockConcurrencyWhile(async()=>{
  if(!this.room||await this.expire())return;const a=ws.deserializeAttachment(),r=this.room,p=r.players.find(p=>p.id===a.id&&p.connection===a.connection);if(!p)return;
  const text=typeof raw==='string'?raw:new TextDecoder().decode(raw);if(text.length>2048)return this.error(ws,'الطلب كبير');let b;try{b=JSON.parse(text);}catch{return this.error(ws,'طلب غير صالح');}if(!b||typeof b!=='object')return;
  const second=Math.floor(Date.now()/1000);if(p.second!==second){p.second=second;p.count=0;}if(++p.count>16)return this.error(ws,'تمهّل قليلًا');
  if(r.match)advanceChallenge(r.match);
  if(b.type==='ping'){await this.save();return this.broadcast();}
  if(!Number.isSafeInteger(b.seq)||b.seq<1)return this.error(ws,'ترتيب الطلب غير صالح');if(b.seq<=p.seq){ws.send(JSON.stringify({type:'ack',seq:b.seq,state:this.snapshot(p.id)}));return;}
  if(b.seq!==p.seq+1)return this.error(ws,'أعد الاتصال لاستعادة الجولة');
  p.seq=b.seq;
  try{
   if(b.type==='ready'){if(r.match?.phase==='playing')throw Error('الجولة بدأت');if(r.game==='cipher'){if(!Array.isArray(b.secret)||b.secret.length!==4||b.secret.some(x=>!Number.isInteger(x)||x<0||x>5))throw Error('اختر شفرتك من أربعة رموز');p.secret=[...b.secret];}p.ready=!p.ready;}
   else if(b.type==='start'){if(r.hostId!==p.id)throw Error('المضيف يبدأ الجولة');if(r.match?.phase==='playing')throw Error('الجولة بدأت');if(r.players.length<2||r.players.some(p=>!p.connection||!p.ready))throw Error('بانتظار جاهزية اللاعبين');r.match=createChallenge(r.game,r.players,crypto.getRandomValues(new Uint32Array(1))[0]);r.round++;r.expiresAt=Date.now()+3600000;for(const x of r.players)x.ready=false;}
   else if(b.type==='action'){if(!r.match||b.round!==r.round)throw Error('الجولة تغيّرت');if(r.game==='labyrinth'&&b.version!==r.match.version)throw Error('تغيّرت اللوحة؛ جرّب الآن');applyChallenge(r.match,p.id,b.action);}
   else if(b.type==='leave'){p.connection=null;p.ready=false;ws.close(1000,'left');if(r.match?.phase!=='playing'){r.players=r.players.filter(x=>x.id!==p.id);if(r.hostId===p.id)r.hostId=r.players[0]?.id||null;}}
   else throw Error('طلب غير صالح');
  }catch(e){await this.save();ws.send(JSON.stringify({type:'error',seq:b.seq,message:e.message,state:this.snapshot(p.id)}));return this.broadcast();}
  await this.save();if(b.type!=='leave')ws.send(JSON.stringify({type:'ack',seq:b.seq,state:this.snapshot(p.id)}));this.broadcast();
 });}
 error(ws,message){try{ws.send(JSON.stringify({type:'error',message}));}catch{}}
 async webSocketClose(ws){await this.ready;return this.ctx.blockConcurrencyWhile(async()=>{if(!this.room)return;const a=ws.deserializeAttachment(),p=this.room.players.find(p=>p.id===a.id&&p.connection===a.connection);if(p){p.connection=null;p.ready=false;if(this.room.hostId===p.id&&this.room.match?.phase!=='playing')this.room.hostId=this.room.players.find(p=>p.connection)?.id||p.id;await this.save();this.broadcast();}});}
 async alarm(){await this.ready;return this.ctx.blockConcurrencyWhile(async()=>{if(!this.room||await this.expire())return;if(this.room.match)advanceChallenge(this.room.match);await this.save();this.broadcast();});}
}
