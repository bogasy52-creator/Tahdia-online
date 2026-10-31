import {loadChallenge,persistChallenge,historyWrites,readHistory} from './challenge-storage.js';
import {cleanPartyLink,reportPartyLink,standings} from '../party/party-link.js';
import {roomCodeFor} from '../rooms/room-codes.js';
import {CHALLENGES,HEROES,createChallenge,applyChallenge,advanceChallenge,challengeView,nextChallengeAlarm} from '../../public/assets/js/engines/challenge-core.js';
const reply=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'no-store'}});
const clean=value=>String(value||'لاعب').normalize('NFKC').replace(/[<>\u0000-\u001f\u202a-\u202e\u2066-\u2069]/g,'').trim().slice(0,20)||'لاعب';
export class ChallengeRoom{
 constructor(ctx,env){this.ctx=ctx;this.env=env;this.room=null;this.ready=ctx.blockConcurrencyWhile(async()=>{this.room=await loadChallenge(ctx.storage);if(this.room?.match&&!this.room.match.rules){this.room.match.phase='finished';this.room.match.winners=[];this.room.match.log=['قواعد الجولة تغيرت؛ ابدأ جولة جديدة'];}});}
 async save(extra={}){await persistChallenge(this.ctx.storage,this.room,extra);await this.ctx.storage.setAlarm(Math.min(this.room.expiresAt,this.room.match?.phase==='playing'?nextChallengeAlarm(this.room.match):this.room.startsAt||Infinity,this.room.reportAt||Infinity));}
 snapshot(id){const r=this.room;return{code:r.code,game:r.game,hostId:r.hostId,round:r.round,quick:!!r.quick,party:!!r.partyLink,startsAt:r.startsAt||null,capacity:CHALLENGES[r.game]?.players||20,status:r.match?.phase||'lobby',players:r.players.map(p=>({id:p.id,name:p.name,hero:p.hero,connected:!!p.connection,ready:!!p.ready,bot:!!p.bot})),me:id,serverNow:Date.now(),match:r.match?challengeView(r.match,id):null};}
 broadcast(){for(const ws of this.ctx.getWebSockets()){const a=ws.deserializeAttachment();if(a?.challenge&&this.room?.players.some(p=>p.id===a.id&&p.connection===a.connection))try{ws.send(JSON.stringify({type:'state',state:this.snapshot(a.id)}));}catch{}}}
 async expire(){if(!this.room||Date.now()<this.room.expiresAt)return false;for(const ws of this.ctx.getWebSockets())try{ws.close(4000,'expired');}catch{}await this.ctx.storage.deleteAll();this.room=null;return true;}
 async fetch(request){await this.ready;return this.ctx.blockConcurrencyWhile(async()=>{
  const u=new URL(request.url),b=request.method==='POST'?await request.json().catch(()=>({})):{};
  if(u.pathname==='/init'){if(this.room)return reply({ok:false},409);if(!CHALLENGES[b.game]||!/^\d{6}$/.test(b.code)||typeof b.hostKey!=='string'||b.hostKey.length<32)return reply({ok:false},400);this.room={code:b.code,game:b.game,hostKey:b.hostKey,hostId:null,players:[],round:0,quick:b.quick===true,expected:Math.min(20,Math.max(1,Number(b.expected)||0)),partyLink:cleanPartyLink(b.party),expiresAt:Date.now()+3600000};await this.save();return reply({ok:true},201);}
  if(!this.room||await this.expire())return reply({ok:false,error:'انتهت الغرفة؛ أنشئ غرفة جديدة'},404);
  if(u.pathname==='/status')return reply({ok:true,game:this.room.game,status:this.room.match?.phase||'lobby',players:this.room.players.length});
  if(u.pathname!=='/ws')return reply({ok:false},404);
  if(request.headers.get('upgrade')?.toLowerCase()!=='websocket')return reply({ok:false,error:'يلزم اتصال مباشر'},426);
  const protocols=String(request.headers.get('sec-websocket-protocol')||'').split(',').map(s=>s.trim()),read=prefix=>protocols.find(s=>s.startsWith(prefix))?.slice(prefix.length)||'';
  if(!protocols.includes('tahdia-challenge-v1'))return reply({ok:false,error:'حدّث الصفحة'},426);
  const r=this.room,resume=read('rt.'),username=request.headers.get('x-bs-account')||null;let p=r.players.find(p=>p.token===resume);
  if(resume&&!p)return reply({ok:false,error:'انتهت الجلسة'},403);
  if(p&&r.match?.phase==='playing'&&!r.match.players.some(x=>x.id===p.id))return reply({ok:false,error:'لم تدخل قبل بداية الجولة'},409);
  if(p?.username&&p.username!==username)return reply({ok:false,error:'ارجع بالحساب نفسه'},403);
  if(!p){if(r.match?.phase==='playing')return reply({ok:false,error:'الجولة بدأت'},409);if(r.players.length>=CHALLENGES[r.game].players)return reply({ok:false,error:'الغرفة ممتلئة'},409);if(username&&r.players.some(p=>p.username===username))return reply({ok:false,error:'حسابك موجود في الغرفة'},409);if(!r.players.length&&!r.quick&&!r.partyLink&&read('hk.')!==r.hostKey)return reply({ok:false,error:'بانتظار المضيف'},403);
   const hero=request.headers.get('x-bs-character');p={id:crypto.randomUUID(),token:crypto.randomUUID()+crypto.randomUUID(),name:clean(request.headers.get('x-bs-name')||u.searchParams.get('name')),hero:HEROES.includes(hero)?hero:'fox',username,seq:0};r.players.push(p);if(!r.hostId)r.hostId=p.id;
  }
  if((r.quick||r.partyLink)&&!r.match&&!r.startsAt){r.startsAt=Date.now()+12000;r.firstJoinAt=Date.now();}const previous=p.connection;p.connection=crypto.randomUUID();for(const ws of this.ctx.getWebSockets())if(ws.deserializeAttachment()?.connection===previous)try{ws.close(4001,'reconnected');}catch{}
  const pair=new WebSocketPair(),ws=pair[1];this.ctx.acceptWebSocket(ws);ws.serializeAttachment({challenge:true,id:p.id,connection:p.connection});await this.save();ws.send(JSON.stringify({type:'welcome',token:p.token,seq:p.seq,state:this.snapshot(p.id)}));this.broadcast();return new Response(null,{status:101,webSocket:pair[0],headers:{'sec-websocket-protocol':'tahdia-challenge-v1'}});
 });}
 async webSocketMessage(ws,raw){await this.ready;return this.ctx.blockConcurrencyWhile(async()=>{
  if(!this.room||await this.expire())return;const a=ws.deserializeAttachment(),r=this.room,p=r.players.find(p=>p.id===a.id&&p.connection===a.connection);if(!p)return;
  const text=typeof raw==='string'?raw:new TextDecoder().decode(raw);if(text.length>2048)return this.error(ws,'الطلب كبير');let b;try{b=JSON.parse(text);}catch{return this.error(ws,'طلب غير صالح');}if(!b||typeof b!=='object')return;
  const second=Math.floor(Date.now()/1000);if(p.second!==second){p.second=second;p.count=0;}if(++p.count>16)return this.error(ws,'تمهّل قليلًا');
  await this.advance();
  if(b.type==='history'){if(r.game!=='cipher'||!r.match||b.round!==r.round||!r.match.players.some(x=>x.id===b.target)||!Number.isSafeInteger(b.start)||b.start<0||!Number.isSafeInteger(b.requestId))return this.error(ws,'طلب سجل غير صالح');const me=r.match.players.find(x=>x.id===p.id),rows=me?.intel[b.target]||[],total=me?.historyCounts?.[b.target]??rows.length;if(b.start>total)return this.error(ws,'صفحة غير موجودة');const history=await readHistory(this.ctx.storage,r.round,p.id,b.target,b.start,30,total,rows);ws.send(JSON.stringify({type:'history',round:r.round,target:b.target,requestId:b.requestId,...history}));return;}
  if(b.type==='ping'){await this.save();return this.broadcast();}
  if(!Number.isSafeInteger(b.seq)||b.seq<1)return this.error(ws,'ترتيب الطلب غير صالح');if(b.seq<=p.seq){ws.send(JSON.stringify({type:'ack',seq:b.seq,state:this.snapshot(p.id)}));return;}
  if(b.seq!==p.seq+1)return this.error(ws,'أعد الاتصال لاستعادة الجولة');
  const checkpoint=structuredClone(this.room);let extra={};p.seq=b.seq;
  try{
   if(b.type==='ready'){if(r.match?.phase==='playing')throw Error('الجولة بدأت');if(r.game==='cipher'){if(!Array.isArray(b.secret)||b.secret.length!==4||b.secret.some(x=>!Number.isInteger(x)||x<0||x>9))throw Error('اختر شفرتك من أربعة رموز');p.secret=[...b.secret];}p.ready=!p.ready;}
   else if(b.type==='start'){if(r.quick||r.partyLink)throw Error('الجولة تبدأ تلقائيًا');if(r.hostId!==p.id)throw Error('المضيف يبدأ الجولة');if(r.match?.phase==='playing')throw Error('الجولة بدأت');if(r.players.filter(p=>p.connection).length<2||r.players.some(p=>p.connection&&!p.ready))throw Error('بانتظار جاهزية اللاعبين');this.start();}
   else if(b.type==='action'){if(!r.match||b.round!==r.round)throw Error('الجولة تغيّرت');if(r.game==='labyrinth'&&b.version!==r.match.version)throw Error('تغيّرت اللوحة؛ جرّب الآن');applyChallenge(r.match,p.id,b.action);if(r.game==='cipher'){const me=r.match.players.find(x=>x.id===p.id),target=b.action.target;extra=await historyWrites(this.ctx.storage,r.round,p.id,target,me.intel[target],me.historyCounts[target]);}}
   else if(b.type==='leave'){p.connection=null;p.ready=false;ws.close(1000,'left');if(r.match?.phase!=='playing'){r.players=r.players.filter(x=>x.id!==p.id);if(r.hostId===p.id)r.hostId=r.players[0]?.id||null;}}
   else throw Error('طلب غير صالح');
  }catch(e){this.room=checkpoint;this.room.players.find(x=>x.id===p.id).seq=b.seq;await this.save();ws.send(JSON.stringify({type:'error',seq:b.seq,message:e.message,state:this.snapshot(p.id)}));return this.broadcast();}
  try{await this.save(extra);}catch{this.room=checkpoint;return this.error(ws,'تعذر حفظ الحركة؛ لم تُسجّل. أعد المحاولة');}if(r.partyLink&&r.match?.phase==='finished'){await this.report();await this.save();}if(b.type!=='leave')ws.send(JSON.stringify({type:'ack',seq:b.seq,state:this.snapshot(p.id)}));this.broadcast();
 });}
 error(ws,message){try{const a=ws.deserializeAttachment(),p=this.room?.players.find(p=>p.id===a.id&&p.connection===a.connection);ws.send(JSON.stringify({type:'error',message,...(p?{serverSeq:p.seq,state:this.snapshot(p.id)}:{})}));}catch{}}
 async webSocketClose(ws){await this.ready;return this.ctx.blockConcurrencyWhile(async()=>{if(!this.room)return;const a=ws.deserializeAttachment(),p=this.room.players.find(p=>p.id===a.id&&p.connection===a.connection);if(p){p.connection=null;p.ready=false;if(this.room.hostId===p.id&&this.room.match?.phase!=='playing')this.room.hostId=this.room.players.find(p=>p.connection)?.id||p.id;await this.save();this.broadcast();}});}
 start(){const r=this.room;let players=r.players.filter(p=>p.connection||p.bot);if(players.length<2){const bot={id:'bot:'+crypto.randomUUID(),name:'المنافس الآلي',hero:'robot',bot:true,ready:true};r.players.push(bot);players=[...players,bot];}r.match=createChallenge(r.game,players,crypto.getRandomValues(new Uint32Array(1))[0]);r.round++;r.startsAt=null;r.expiresAt=Date.now()+3600000;for(const p of r.players)p.ready=false;}
 async advance(){const r=this.room;if(!r)return;const now=Date.now();if(!r.match&&r.startsAt&&now>=r.startsAt){const count=r.players.filter(p=>p.connection).length;if(!count)r.startsAt=null;else if(r.partyLink&&count<r.expected&&now-r.firstJoinAt<30000)r.startsAt=now+1000;else this.start();}if(r.match)advanceChallenge(r.match,now);await this.report();}
 async report(){const r=this.room,m=r?.match;if(!r?.partyLink||r.partyReported||m?.phase!=='finished')return;const ranked=m.players.filter(p=>!p.bot).sort((a,b)=>Number(m.winners.includes(b.id))-Number(m.winners.includes(a.id))||Number(b.alive)-Number(a.alive)||b.score-a.score||(b.eliminatedAt||0)-(a.eliminatedAt||0));const rows=standings(ranked.map(p=>({...p,username:r.players.find(x=>x.id===p.id)?.username,won:m.winners.length===1&&m.winners.includes(p.id)})),(a,b)=>a.won===b.won&&a.alive===b.alive&&a.score===b.score&&a.eliminatedAt===b.eliminatedAt);if(await reportPartyLink(this.env,r.partyLink,r.game,rows)){r.partyReported=true;r.reportAt=null;}else{r.reportTries=(r.reportTries||0)+1;r.reportAt=r.reportTries<6?Date.now()+5000:null;if(!r.reportAt)r.partyReported=true;}}
 async alarm(){await this.ready;return this.ctx.blockConcurrencyWhile(async()=>{if(!this.room||await this.expire())return;await this.advance();await this.save();this.broadcast();});}
}

export class ChallengeQueue{
 constructor(ctx,env){this.ctx=ctx;this.env=env;}
 async fetch(request){return this.ctx.blockConcurrencyWhile(async()=>{const b=await request.json().catch(()=>({}));if(!CHALLENGES[b.game])return reply({ok:false,error:'لعبة غير معروفة'},400);let entry=await this.ctx.storage.get('challengeQueue');
 if(entry&&entry.expiresAt>Date.now()){const stub=this.env.ROOMS.get(this.env.ROOMS.idFromName('challenge:'+entry.code)),res=await stub.fetch('https://challenge.internal/status'),status=await res.json();if(res.ok&&status.status==='lobby'&&status.players<CHALLENGES[b.game].players)return reply({ok:true,code:entry.code});}
 for(let i=0;i<6;i++){const code=roomCodeFor(b.game),hostKey=crypto.randomUUID()+crypto.randomUUID(),stub=this.env.ROOMS.get(this.env.ROOMS.idFromName('challenge:'+code));const res=await stub.fetch('https://challenge.internal/init',{method:'POST',body:JSON.stringify({game:b.game,code,hostKey,quick:true})});if(res.status===201){await this.ctx.storage.put('challengeQueue',{code,expiresAt:Date.now()+60000});return reply({ok:true,code,hostKey});}}
 return reply({ok:false,error:'تعذر تجهيز المواجهة'},503);
 });}
}
