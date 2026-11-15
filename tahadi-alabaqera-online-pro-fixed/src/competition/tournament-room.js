import {roomCodeFor} from '../rooms/room-codes.js';
const json=(v,status=200)=>Response.json(v,{status,headers:{'cache-control':'no-store'}}),valid=v=>typeof v==='string'&&/^[a-z0-9_]{3,20}$/.test(v);
const secret=()=>crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
const clean=v=>String(v||'لاعب').normalize('NFKC').replace(/[<>\u0000-\u001f\u202a-\u202e]/g,'').trim().slice(0,24);
export function cleanTournamentLink(v){return v&&/^06\d{4}$/.test(v.code)&&/^[a-f0-9-]{36}$/.test(v.match)&&/^[a-f0-9]{64}$/.test(v.token)&&Array.isArray(v.players)&&v.players.length===2&&v.players.every(valid)&&v.players[0]!==v.players[1]?{code:v.code,match:v.match,token:v.token,players:[...v.players]}:null;}
export async function reportTournament(env,link,game,winner){if(!link)return true;try{const res=await env.ROOMS.get(env.ROOMS.idFromName('tournament:'+link.code)).fetch('https://tournament.internal/result',{method:'POST',body:JSON.stringify({match:link.match,token:link.token,game,winner})});return res.ok||[400,404,409,410].includes(res.status);}catch{return false;}}
export class TournamentRoom{
 constructor(ctx,env){this.ctx=ctx;this.env=env;this.r=null;this.chain=Promise.resolve();this.ready=ctx.blockConcurrencyWhile(async()=>{this.r=await ctx.storage.get('tournament')||null;});}
 enqueue(fn){const task=this.chain.then(fn);this.chain=task.catch(()=>{});return task;}
 async save(){await this.ctx.storage.put('tournament',this.r);const pending=this.r.rounds.flat().filter(m=>m.status==='opening');await this.ctx.storage.setAlarm(pending.length?Math.min(...pending.map(m=>Math.max(Date.now()+1000,m.retryAt||0))):this.r.expiresAt);}
 view(){const r=this.r;return {ok:true,game:'tournament',code:r.code,sport:r.game,status:r.status,capacity:r.capacity,owner:r.owner,players:r.players.map(p=>({...p})),winner:r.winner||null,expiresAt:r.expiresAt,rounds:r.rounds.map(round=>round.map(({id,players,status,roomCode,winner,draws})=>({id,players,status,roomCode:status==='ready'?roomCode:null,winner:winner||null,draws:draws||0})))};}
 nextRound(players){const matches=[];for(let i=0;i<players.length;i+=2)matches.push({id:crypto.randomUUID(),players:players.slice(i,i+2),status:'opening',roomCode:null,token:secret(),winner:null,draws:0});this.r.rounds.push(matches);}
 async openMatches(){const r=this.r;if(r.status!=='playing')return;for(const m of r.rounds.at(-1)){
  if(m.status!=='opening'||m.retryAt>Date.now())continue;if(!m.roomCode){m.roomCode=roomCodeFor(r.game);await this.save();}
  const tournament={code:r.code,match:m.id,token:m.token,players:m.players},ns=r.game==='tanks'?this.env.ROOMS:this.env.BOARD_ROOMS;
  try{const res=await ns.get(ns.idFromName((r.game==='tanks'?'tanks:':'')+m.roomCode)).fetch('https://'+(r.game==='tanks'?'tanks':'board')+'.internal/init',{method:'POST',body:JSON.stringify({code:m.roomCode,hostKey:secret(),game:r.game,capacity:2,playerLimit:2,mode:'ffa',tournament})});if(res.status===201)m.status='ready';else if(res.status===409)m.roomCode=null;}catch{}
  if(m.status==='opening'){m.attempts=(m.attempts||0)+1;m.retryAt=Date.now()+Math.min(300000,5000*2**Math.min(6,m.attempts-1));}await this.save();
 }}
 async fetch(request){await this.ready;return this.enqueue(async()=>{
  const u=new URL(request.url),b=request.method==='POST'?await request.json().catch(()=>({})):{};
  if(u.pathname==='/init'){
   if(this.r&&this.r.expiresAt>Date.now())return json({ok:false},409);
   if(!/^06\d{4}$/.test(b.code)||!['tanks','billiards'].includes(b.game)||![2,4,8].includes(b.capacity)||!valid(b.username))return json({ok:false},400);
   this.r={code:b.code,game:b.game,capacity:b.capacity,owner:b.username,players:[{username:b.username,name:clean(b.name)}],status:'lobby',rounds:[],createdAt:Date.now(),expiresAt:Date.now()+86400000};await this.save();return json(this.view(),201);
  }
  const r=this.r;if(!r||r.expiresAt<=Date.now())return json({ok:false,error:'انتهت صلاحية البطولة.'},404);
  if(u.pathname==='/status')return json({ok:true,game:'tournament',status:r.status,players:r.players.length,playerLimit:r.capacity});
  if(u.pathname==='/view')return json(this.view());
  if(u.pathname==='/result'){
   const m=r.rounds.flat().find(m=>m.id===b.match);if(!m||b.game!==r.game||m.token!==b.token)return json({ok:false},409);if(m.status==='finished')return json({ok:true,duplicate:true});
   if(m.status!=='ready'||b.winner!==null&&!m.players.includes(b.winner))return json({ok:false},400);
   if(b.winner===null){const round=r.rounds.at(-1);round[round.indexOf(m)]={...m,id:crypto.randomUUID(),token:secret(),status:'opening',roomCode:null,retryAt:0,attempts:0,draws:(m.draws||0)+1};}
   else{m.winner=b.winner;m.status='finished';const last=r.rounds.at(-1);if(last.every(m=>m.status==='finished')){const winners=last.map(m=>m.winner);if(winners.length===1){r.status='finished';r.winner=winners[0];}else this.nextRound(winners);}}
   await this.save();return json({ok:true});
  }
  if(!valid(b.username))return json({ok:false,error:'سجّل الدخول أولًا.'},401);
  if(u.pathname==='/join'){
   if(!r.players.some(p=>p.username===b.username)){if(r.status!=='lobby'||r.players.length>=r.capacity)return json({ok:false,error:'البطولة بدأت أو اكتمل عددها.'},409);r.players.push({username:b.username,name:clean(b.name)});await this.save();}return json(this.view());
  }
  if(u.pathname==='/start'){
   if(b.username!==r.owner)return json({ok:false,error:'البدء لصاحب البطولة.'},403);if(r.status!=='lobby')return json(this.view());if(r.players.length!==r.capacity)return json({ok:false,error:'انتظر اكتمال العدد.'},409);
   const players=r.players.map(p=>p.username);for(let i=players.length-1;i>0;i--){const j=crypto.getRandomValues(new Uint32Array(1))[0]%(i+1);[players[i],players[j]]=[players[j],players[i]];}
   r.status='playing';this.nextRound(players);await this.save();await this.openMatches();return json(this.view());
  }
  return json({ok:false},404);
 });}
 async alarm(){await this.ready;return this.enqueue(async()=>{if(!this.r)return;if(this.r.expiresAt<=Date.now()){await this.ctx.storage.delete('tournament');this.r=null;return;}await this.openMatches();await this.save();});}
}
