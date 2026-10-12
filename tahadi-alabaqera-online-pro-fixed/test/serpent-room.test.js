import test from 'node:test';
import assert from 'node:assert/strict';
import {SerpentRoom} from '../src/serpent/serpent-room.js';

function setup(){
 const values=new Map(),sockets=[];
 const storage={async get(k){return structuredClone(values.get(k))},async put(k,v){values.set(k,structuredClone(v))},async delete(k){values.delete(k)},async setAlarm(t){this.alarm=t},async deleteAlarm(){this.alarm=null}};
 const ctx={storage,id:{toString:()=> 'serpent:test'},getWebSockets:()=>sockets,acceptWebSocket:s=>sockets.push(s),blockConcurrencyWhile:fn=>fn(),waitUntil:p=>p.catch(()=>{})};
 const room=new SerpentRoom(ctx,{});return {room,ctx,values,sockets};
}
const init=room=>room.fetch(new Request('https://serpent.internal/init',{method:'POST',body:JSON.stringify({code:'123456',hostKey:'h'.repeat(43),playerLimit:2,duration:120})}));
function peer(h,id,role='guest'){
 const player={id,name:id,role,token:'token-'+id,connected:true,ready:false,skin:'snake-wild',username:null};h.room.room.players.push(player);
 const messages=[],ws={closed:false,send:raw=>messages.push(JSON.parse(raw)),deserializeAttachment:()=>({serpent:true,playerId:id}),close(){this.closed=true}};
 h.sockets.push(ws);return {player,ws,messages};
}
test('initialization rejects malformed settings and duplicate rooms',async()=>{
 const h=setup();let r=await h.room.fetch(new Request('https://serpent.internal/init',{method:'POST',body:JSON.stringify({code:'123456',hostKey:'h'.repeat(43),playerLimit:99})}));assert.equal(r.status,400);assert.equal(h.values.has('serpent'),false);
 assert.equal((await init(h.room)).status,201);assert.equal((await init(h.room)).status,409);assert.ok(h.ctx.storage.alarm>Date.now()+60000);
});
test('only a connected ready host can start with all real players',async()=>{
 const h=setup();await init(h.room);const a=peer(h,'a','host'),b=peer(h,'b');
 await h.room.webSocketMessage(b.ws,JSON.stringify({type:'start'}));assert.equal(h.room.room.status,'lobby');
 await h.room.webSocketMessage(a.ws,JSON.stringify({type:'start'}));assert.equal(h.room.room.status,'lobby');
 await h.room.webSocketMessage(a.ws,JSON.stringify({type:'ready',ready:true}));await h.room.webSocketMessage(b.ws,JSON.stringify({type:'ready',ready:true}));
 await h.room.webSocketMessage(a.ws,JSON.stringify({type:'start'}));assert.equal(h.room.room.status,'playing');assert.equal(h.room.room.game.snakes.length,2);assert.equal(h.room.room.game.snakes.some(s=>s.bot),false);h.room.stop();
});
test('steering never accepts client position, mass or score',async()=>{
 const h=setup();await init(h.room);const a=peer(h,'a','host'),b=peer(h,'b');a.player.ready=b.player.ready=true;await h.room.webSocketMessage(a.ws,JSON.stringify({type:'start'}));h.room.stop();
 const s=h.room.room.game.snakes[0],x=s.x;await h.room.webSocketMessage(a.ws,JSON.stringify({type:'input',angle:.2,boost:true,x:0,mass:999,score:999}));
 assert.ok(Math.abs(s.targetAngle-.2)<1e-10);assert.equal(s.x,x);assert.equal(s.score,0);assert.equal(s.mass,28);h.room.stop();
});
test('disconnecting the last socket stops simulation and releases boost',async()=>{
 const h=setup();await init(h.room);const a=peer(h,'a','host'),b=peer(h,'b');a.player.ready=b.player.ready=true;await h.room.webSocketMessage(a.ws,JSON.stringify({type:'start'}));
 await h.room.webSocketMessage(a.ws,JSON.stringify({type:'input',angle:0,boost:true}));
 a.ws.closed=true;await h.room.webSocketClose(a.ws);b.ws.closed=true;await h.room.webSocketClose(b.ws);
 assert.equal(h.room.timer,null);assert.equal(h.room.room.game.snakes[0].boost,false);assert.equal(h.room.room.players.filter(p=>p.connected).length,0);assert.ok(h.ctx.storage.alarm>Date.now()+60000);
});
test('public room snapshots exclude all credentials and reset readiness on rematch',async()=>{
 const h=setup();await init(h.room);const a=peer(h,'a','host'),b=peer(h,'b');a.player.ready=b.player.ready=true;await h.room.webSocketMessage(a.ws,JSON.stringify({type:'start'}));h.room.stop();
 const state=h.room.publicState();assert.equal(state.hostKey,undefined);assert.equal(state.players[0].token,undefined);assert.equal(state.players[0].username,undefined);
 h.room.room.status='finished';h.room.room.game.status='finished';h.room.room.rewardsComplete=true;
 await h.room.webSocketMessage(a.ws,JSON.stringify({type:'rematch'}));assert.equal(h.room.room.status,'lobby');assert.equal(h.room.room.players.every(p=>!p.ready),true);
});
test('expired rooms delete their checkpoint and disable alarms',async()=>{
 const h=setup();await init(h.room);h.room.room.expiresAt=Date.now()-1;await h.room.alarm();assert.equal(h.room.room,null);assert.equal(h.values.has('serpent'),false);assert.equal(h.ctx.storage.alarm,null);
});
test('a throttled steering packet still releases boost immediately',async()=>{
 const h=setup();await init(h.room);const a=peer(h,'a','host'),b=peer(h,'b');a.player.ready=b.player.ready=true;await h.room.webSocketMessage(a.ws,JSON.stringify({type:'start'}));h.room.stop();
 const s=h.room.room.game.snakes[0],angle=s.targetAngle;s.boost=true;a.player.lastInputAt=Date.now();
 await h.room.webSocketMessage(a.ws,JSON.stringify({type:'input',angle:0,boost:false}));assert.equal(s.boost,false);assert.equal(s.targetAngle,angle);
});
