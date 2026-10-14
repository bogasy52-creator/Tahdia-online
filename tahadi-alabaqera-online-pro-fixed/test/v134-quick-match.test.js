import test from 'node:test';
import assert from 'node:assert/strict';
import {SerpentRoom} from '../src/serpent/serpent-room.js';
function setup(){const values=new Map(),sockets=[],storage={async get(k){return structuredClone(values.get(k))},async put(k,v){values.set(k,structuredClone(v))},async delete(k){values.delete(k)},async setAlarm(t){this.alarm=t},async deleteAlarm(){this.alarm=null}};const ctx={storage,id:{toString:()=> 'quick-serpent'},getWebSockets:()=>sockets,acceptWebSocket:s=>sockets.push(s),blockConcurrencyWhile:fn=>fn(),waitUntil:p=>p.catch(()=>{})};return {room:new SerpentRoom(ctx,{}),ctx,values,sockets}}
const post=(room,path,body)=>room.fetch(new Request('https://serpent.internal'+path,{method:'POST',body:JSON.stringify(body)}));
test('public lobby starts after fifteen seconds without host readiness and fills empty seats with bots',async()=>{
 const h=setup();await post(h.room,'/init',{code:'123456',hostKey:'h'.repeat(43),playerLimit:6,duration:120,publicMatch:true,matchMode:'survival'});const r=await post(h.room,'/reserve',{name:'A'});assert.equal(r.status,201);const ticket=await r.json();assert.ok(ticket.token);assert.ok(h.room.publicState().lobbyDeadline-Date.now()>14500);
 const p=h.room.room.players[0];p.connected=true;h.sockets.push({send(){},deserializeAttachment:()=>({serpent:true,playerId:p.id})});h.room.room.lobbyDeadline=Date.now()-1;await h.room.alarm();assert.equal(h.room.room.status,'playing');assert.equal(h.room.room.game.matchMode,'survival');assert.equal(h.room.room.game.collisionMode,'predator');assert.equal(h.room.room.game.snakes.length,6);assert.equal(h.room.room.game.snakes.filter(s=>s.bot).length,5);h.room.stop();
});
test('a cancelled or disconnected public lobby never starts a bot-only match',async()=>{
 const h=setup();await post(h.room,'/init',{code:'123456',hostKey:'h'.repeat(43),playerLimit:6,duration:120,publicMatch:true});await post(h.room,'/reserve',{name:'A'});h.room.room.lobbyDeadline=Date.now()-1;await h.room.alarm();assert.equal(h.room.room.status,'lobby');assert.equal(h.room.room.game,null);assert.equal(h.room.room.players.length,0);
});
test('reserve rejects a full public lobby and any private room',async()=>{
 const h=setup();await post(h.room,'/init',{code:'123456',hostKey:'h'.repeat(43),playerLimit:2,duration:120,publicMatch:true});assert.equal((await post(h.room,'/reserve',{name:'A'})).status,201);assert.equal((await post(h.room,'/reserve',{name:'B'})).status,201);assert.equal((await post(h.room,'/reserve',{name:'C'})).status,409);
 const privateRoom=setup();await post(privateRoom.room,'/init',{code:'654321',hostKey:'h'.repeat(43),playerLimit:2,duration:120});assert.equal((await post(privateRoom.room,'/reserve',{name:'A'})).status,404);
});
