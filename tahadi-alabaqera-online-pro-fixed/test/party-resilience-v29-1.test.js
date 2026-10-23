import test from 'node:test';
import assert from 'node:assert/strict';
import {PartyRoom} from '../src/party/party-room.js';
import {createParty,addPartyPlayer,configureParty,startPartyRound,applyPartyAction,partySnapshot} from '../src/party/party-engine.js';
import * as network from '../public/assets/js/serpent-network.js';
const {compactSerpentFrame,applySerpentFrame}=network;
const compactSerpentKeyframe=(...args)=>network.compactSerpentKeyframe(...args);

async function fixture(t,game='memory'){
 let clock=100000; t.mock.method(Date,'now',()=>clock);
 const data=new Map(),sockets=[],storage={alarm:null,async get(k){return Array.isArray(k)?new Map(k.map(key=>[key,structuredClone(data.get(key))])):structuredClone(data.get(k));},async put(k,v){if(typeof k==='object')for(const[key,value]of Object.entries(k))data.set(key,structuredClone(value));else data.set(k,structuredClone(v));},async delete(keys){for(const key of Array.isArray(keys)?keys:[keys])data.delete(key);},async deleteAll(){data.clear();},async setAlarm(at){this.alarm=at;},async transaction(fn){const prior=structuredClone(data);try{return await fn(this);}catch(e){data.clear();for(const[k,v]of prior)data.set(k,v);throw e;}}};
 const ctx={storage,getWebSockets:()=>sockets,blockConcurrencyWhile:fn=>Promise.resolve().then(fn)};
 const unit=new PartyRoom(ctx,{});await unit.ready;
 unit.room=createParty({code:'123456',hostKey:'x'.repeat(40),playlist:[game,'memory'],now:clock});
 const peers=Array.from({length:3},(_,i)=>{const p=addPartyPlayer(unit.room,{name:'P'+i,now:clock});p.connection='c'+i;p.ready=true;const ws={readyState:1,sent:[],deserializeAttachment:()=>({party:true,playerId:p.id,connection:p.connection}),send(value){this.sent.push(JSON.parse(value));},close(code){this.readyState=3;this.closeCode=code;}};sockets.push(ws);return{p,ws};});
 t.after(()=>unit.stop());await unit.save();return{unit,peers,storage,clock:value=>{clock=value;}};
}

test('an abandoned party parks its host alarm at expiry after the grace period',async t=>{
 const f=await fixture(t);for(const{p,ws}of f.peers){p.connected=false;p.disconnectedAt=100000;ws.readyState=3;}
 f.clock(161000);await f.unit.step(161000);assert.equal(f.storage.alarm,f.unit.room.expiresAt);
});
test('a disconnect during countdown cancels the start and requires fresh readiness',async t=>{
 const f=await fixture(t);configureParty(f.unit.room,f.peers[0].p.id,{type:'start'},100000);assert.equal(f.unit.room.status,'countdown');
 f.clock(105000);await f.unit.webSocketClose(f.peers[1].ws);assert.equal(f.unit.room.status,'lobby');assert.equal(f.peers[1].p.ready,false);
});
test('the host can remove an offline lobby seat; guests cannot remove anyone or the host',async t=>{
 const f=await fixture(t),r=f.unit.room,[host,guest,absent]=f.peers;absent.p.connected=false;
 assert.throws(()=>configureParty(r,guest.p.id,{type:'remove',playerId:absent.p.id}));
 assert.throws(()=>configureParty(r,host.p.id,{type:'remove',playerId:host.p.id}));
 configureParty(r,host.p.id,{type:'remove',playerId:absent.p.id});assert.equal(r.players[absent.p.id],undefined);assert.equal(r.order.length,2);
 r.status='playing';assert.throws(()=>configureParty(r,host.p.id,{type:'remove',playerId:guest.p.id}));
});
test('host migration during a live arena is broadcast immediately',async t=>{
 const f=await fixture(t,'serpent'),r=f.unit.room;r.roster=[...r.order];startPartyRound(r,100000,42);
 f.peers[0].p.connected=false;f.peers[0].p.disconnectedAt=100000;f.peers[0].ws.readyState=3;f.clock(161000);
 await f.unit.step(161000,true);assert.equal(f.peers[1].p.role,'host');assert.ok(f.peers[1].ws.sent.some(m=>m.type==='room'&&m.state.players.find(p=>p.id===f.peers[1].p.id)?.role==='host'));
});
test('an arena keyframe restores a lost baseline and all 700 body points',async t=>{
 const f=await fixture(t,'serpent'),r=f.unit.room;r.roster=[...r.order];startPartyRound(r,100000,42);
 for(const s of r.round.arena.snakes){s.mass=700;s.segments=Array.from({length:700},(_,i)=>({x:500+i*.5,y:500}));}
 const original={round:r.round.id,game:partySnapshot(r).round.arena};r.round.arena.tick+=2;
 const fresh={round:r.round.id,game:partySnapshot(r).round.arena},delta=compactSerpentFrame(fresh,original,'tight');
 assert.equal(applySerpentFrame(null,delta),null);const key=compactSerpentKeyframe(fresh,'tight'),restored=applySerpentFrame(null,key);
 assert.equal(restored.game.snakes[0].segments.length,700);assert.equal(restored.game.tick,fresh.game.tick);assert.deepEqual(restored.game.food,fresh.game.food);
 assert.ok(JSON.stringify(key).length<JSON.stringify({type:'state',state:fresh}).length*.65);
 r.round.arena.tick+=2;const next={round:r.round.id,game:partySnapshot(r).round.arena};assert.equal(applySerpentFrame(restored,compactSerpentFrame(next,fresh,'tight')).game.tick,next.game.tick);
});
test('memory gives a correct effect only when a new pair is completed',async t=>{
 const f=await fixture(t),r=f.unit.room;r.roster=[...r.order];startPartyRound(r,100000,42);const p=r.round.participants[r.order[0]],deck=p.state.deck;
 const a=0,b=deck.findIndex((v,i)=>i!==a&&v===deck[a]),c=deck.findIndex((v,i)=>i!==a&&i!==b);
 const act=(cell,seq)=>applyPartyAction(r,r.order[0],{sessionId:r.sessionId,roundId:r.round.id,seq,action:{cell}},100000+seq*100);
 assert.equal(act(a,1).feedback,'flip');assert.equal(act(b,2).feedback,'correct');assert.equal(act(c,3).feedback,'flip');
});

test('failed persistence rolls back a move without acknowledging it, and a retry records it once',async t=>{
 const f=await fixture(t),r=f.unit.room;r.roster=[...r.order];startPartyRound(r,100000,42);await f.unit.save();const {p,ws}=f.peers[0],message={type:'action',sessionId:r.sessionId,roundId:r.round.id,seq:1,action:{cell:0}};
 const put=f.storage.put.bind(f.storage);f.storage.put=async()=>{throw Error('injected_write_failure');};
 f.unit.actionQueue=[{ws,id:p.id,connection:p.connection,message,resolve(){}}];await assert.rejects(()=>f.unit.flushActions(),/injected_write_failure/);
 assert.equal(f.unit.room.round.participants[p.id].seq,0);assert.deepEqual(f.unit.room.round.participants[p.id].state.open,[]);assert.equal(ws.sent.filter(m=>m.type==='ack').length,0);
 f.storage.put=put;f.clock(100100);f.unit.actionQueue=[{ws,id:p.id,connection:p.connection,message,resolve(){}}];await f.unit.flushActions();assert.equal(f.unit.room.round.participants[p.id].seq,1);assert.equal(ws.sent.filter(m=>m.type==='ack').length,1);
});
test('repeated non-boost input is rate limited while a boost release remains immediate',async t=>{
 const f=await fixture(t,'serpent'),r=f.unit.room;r.roster=[...r.order];startPartyRound(r,100000,42);const {p,ws}=f.peers[0];
 const input=boost=>f.unit.webSocketMessage(ws,JSON.stringify({type:'input',sessionId:r.sessionId,roundId:r.round.id,angle:0,boost}));
 await input(true);f.clock(100001);await input(false);f.clock(100002);await input(false);await input(false);
 assert.equal(r.round.participants[p.id].actions,2);assert.equal(r.round.arena.snakes.find(s=>s.id===p.id).boost,false);
});
test('arena resync resets the shared baseline and supports old and new clients',async t=>{
 const f=await fixture(t,'serpent'),r=f.unit.room;r.roster=[...r.order];startPartyRound(r,100000,42);
 const modern=f.peers[1];modern.ws.deserializeAttachment=()=>({party:true,playerId:modern.p.id,connection:modern.p.connection,arenaKeyframes:true});
 f.unit.lastFrame={game:{tick:-1}};await f.unit.webSocketMessage(modern.ws,JSON.stringify({type:'sync'}));assert.equal(f.unit.lastFrame,null);
 f.clock(100100);await f.unit.step(100100,true);
 assert.equal(modern.ws.sent.find(m=>m.type==='arena').frame.type,'keyframe');assert.equal(f.peers[0].ws.sent.find(m=>m.type==='arena').frame.type,'state');
 assert.ok(applySerpentFrame(null,modern.ws.sent.find(m=>m.type==='arena').frame));
});

test('a cold restart cancels a countdown whose sockets are gone',async t=>{
 const f=await fixture(t);configureParty(f.unit.room,f.peers[0].p.id,{type:'start'},100000);await f.unit.save();
 for(const {ws} of f.peers)ws.readyState=3;f.unit.stop();const restored=new PartyRoom(f.unit.ctx,{});t.after(()=>restored.stop());await restored.ready;
 assert.equal(restored.room.status,'lobby');assert.equal(restored.room.startsAt,0);assert.ok(Object.values(restored.room.players).every(p=>!p.connected&&!p.ready));
});
