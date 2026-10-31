import test from 'node:test';
import assert from 'node:assert/strict';
import {ChallengeRoom} from '../src/challenges/challenge-room.js';
import {createChallenge} from '../public/assets/js/engines/challenge-core.js';
function fixture(){
 const data=new Map(),sockets=[];let alarm;
 const storage={get:async k=>structuredClone(data.get(k)),put:async obj=>{for(const[k,v]of Object.entries(obj))data.set(k,structuredClone(v));},delete:async k=>data.delete(k),transaction:async fn=>fn(storage),setAlarm:async t=>{alarm=t;}};
 const ctx={storage,blockConcurrencyWhile:fn=>fn(),getWebSockets:()=>sockets};const room=new ChallengeRoom(ctx,{});
 const add=(id,connected=true)=>{const p={id,name:id,hero:'fox',token:id,seq:0,ready:true,connection:connected?id:null,...(!connected?{disconnectedAt:Date.now()}: {})};room.room.players.push(p);const messages=[],ws={deserializeAttachment:()=>({challenge:true,id,connection:id}),send:v=>messages.push(JSON.parse(v)),close(){}};sockets.push(ws);return{p,ws,messages};};
 return {room,add,data,alarm:()=>alarm};
}
async function lobby(){const f=fixture();await f.room.ready;f.room.room={game:'focus',code:'961234',players:[],hostId:'a',round:0,expiresAt:Date.now()+3600000};return f;}
test('disconnected lobby seats have a grace period, free capacity after 45 seconds and survive reload before expiry',async()=>{
 const f=await lobby(),a=f.add('a'),b=f.add('b');await f.room.webSocketClose(a.ws);assert.equal(a.p.connection,null);assert.equal(f.alarm(),a.p.disconnectedAt+45000);
 f.room.pruneLobby(a.p.disconnectedAt+44999);assert.equal(f.room.room.players.length,2);
 f.room.pruneLobby(a.p.disconnectedAt+45000);assert.equal(f.room.room.players.length,1);assert.equal(f.room.room.hostId,b.p.id);await f.room.save();const next=new ChallengeRoom(f.room.ctx,{});await next.ready;assert.deepEqual(next.room.players.map(p=>p.id),['b']);
});
test('an obsolete socket cannot disconnect a resumed lobby player',async()=>{const f=await lobby(),a=f.add('a');a.p.connection='replacement';await f.room.webSocketClose(a.ws);assert.equal(a.p.connection,'replacement');assert.equal(a.p.ready,true);});
test('lobby pruning never removes a participant or cipher history during a live match',async()=>{const f=await lobby(),a=f.add('a'),b=f.add('b',false);f.room.room.match=createChallenge('focus',f.room.room.players,1);b.p.disconnectedAt=Date.now()-100000;assert.equal(f.room.pruneLobby(),false);assert.equal(f.room.room.players.length,2);await f.room.webSocketClose(a.ws);assert.ok(f.alarm()>Date.now());});
test('room status exposes real capacity and prunes expired seats for the quick queue and invitations',async()=>{const f=await lobby();f.add('a');const b=f.add('b',false);b.p.disconnectedAt=Date.now()-45001;const r=await f.room.fetch(new Request('https://challenge.internal/status'));const s=await r.json();assert.equal(s.players,1);assert.equal(s.playerLimit,20);});

test('challenge APIs reject JSON null, arrays and primitives with a controlled 400 response',async()=>{
 const {environment}=await import('./worker-harness.mjs');const Worker=await import('../src/index.js');
 for(const path of ['/api/challenges/quick','/api/challenges/rooms'])for(const value of [null,[],3,'cipher']){
  const r=await Worker.default.fetch(new Request('https://game.test'+path,{method:'POST',headers:{origin:'https://game.test','content-type':'application/json'},body:JSON.stringify(value)}),environment());assert.equal(r.status,400,path+' '+JSON.stringify(value));
 }
});

test('a newcomer to a completed cipher waits safely for a rematch and never sees a previous player secret',async()=>{
 const f=await lobby();f.room.room.game='cipher';f.add('a');f.add('b');const m=f.room.room.match=createChallenge('cipher',f.room.room.players,1);m.phase='finished';m.winners=['a'];f.add('newcomer');
 const snapshot=f.room.snapshot('newcomer');assert.equal(snapshot.match,null);assert.equal(snapshot.players.length,3);assert.ok(!JSON.stringify(snapshot).includes('secrets'));f.room.start();assert.equal(f.room.snapshot('newcomer').match.me.id,'newcomer');
});
