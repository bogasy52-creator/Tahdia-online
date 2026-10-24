import test from 'node:test';
import assert from 'node:assert/strict';
import {environment,api} from './worker-harness.mjs';
import {BoardOnlineClient} from '../public/assets/js/board-online.js';

function abandonedRoom(now,status='lobby'){
 return {code:'123456',game:'snakes',status,expiresAt:now+86400000,players:{host:{id:'host',name:'A',role:'host',connected:false,disconnectedAt:now-46000}},order:['host'],rewardsComplete:true};
}
for(const status of ['lobby','finished'])test(`abandoned ${status} room parks its alarm at expiry after host grace, without a rapid loop`,async t=>{
 const now=Date.now();t.mock.method(Date,'now',()=>now);
 const env=environment(),{instance,ctx}=env.BOARD_ROOMS.peek('123456');await ctx.ready;instance.room=abandonedRoom(now,status);
 await instance.alarm();assert.equal(ctx.storage.alarm,instance.room.expiresAt);assert.ok(instance.room.players.host,'host may reconnect');
 await instance.alarm();assert.equal(ctx.storage.alarm,instance.room.expiresAt);
});
test('a disconnected host gets one grace alarm, and a connected guest can inherit the room',async t=>{
 const now=Date.now();t.mock.method(Date,'now',()=>now);
 const env=environment(),{instance,ctx}=env.BOARD_ROOMS.peek('123456');await ctx.ready;instance.room=abandonedRoom(now);instance.room.players.host.disconnectedAt=now;
 await instance.scheduleNextAlarm();assert.equal(ctx.storage.alarm,now+45000);
 instance.room.players.host.disconnectedAt=now-46000;instance.room.players.guest={id:'guest',name:'B',role:'guest',connected:true};instance.room.order.push('guest');ctx.sockets.push({deserializeAttachment:()=>({playerId:'guest'}),send(){}});
 await instance.alarm();assert.equal(instance.room.players.host,undefined);assert.equal(instance.room.players.guest.role,'host');assert.equal(ctx.storage.alarm,instance.room.expiresAt);
});
test('an empty quick queue stops cleanup alarms after deleting the last expired ticket',async t=>{
 const now=Date.now();t.mock.method(Date,'now',()=>now);
 const env=environment(),{instance,ctx}=env.QUICK_ARENA.peek('queue:v6');await ctx.ready;
 await ctx.storage.put('ticket:a',{id:'a',createdAt:now-100000,expiresAt:now-1});await ctx.storage.setAlarm(now);await instance.alarm();
 assert.equal((await ctx.storage.list({prefix:'ticket:'})).size,0);assert.equal(ctx.storage.alarm,null);
});
test('a matched quick queue schedules cleanup at ticket expiry rather than every 30 seconds',async()=>{
 const env=environment();await api(env,'/api/quick/join',{name:'A'});await api(env,'/api/quick/join',{name:'B'});
 const {instance,ctx}=env.QUICK_ARENA.peek('queue:v6');await instance.alarm();const tickets=await ctx.storage.list({prefix:'ticket:'});
 assert.equal(ctx.storage.alarm,Math.min(...[...tickets.values()].map(t=>t.expiresAt)));
});
test('queue cleanup also schedules live tickets beyond the first storage page',async t=>{
 const now=Date.now();t.mock.method(Date,'now',()=>now);
 const env=environment(),{instance,ctx}=env.QUICK_ARENA.peek('queue:v6');await ctx.ready;
 for(let i=0;i<1001;i++){const id=String(i).padStart(4,'0');await ctx.storage.put('ticket:'+id,{id,createdAt:now-100000,expiresAt:i===1000?now+600000:now-1})}
 await instance.alarm();assert.equal(ctx.storage.alarm,now+600000);assert.equal((await ctx.storage.list({prefix:'ticket:'})).size,1);
});
test('quota exhaustion returns the real cause and stops further DO calls until the daily reset',async t=>{
 let now=Date.UTC(2026,9,11,23,5),calls=0;t.mock.method(Date,'now',()=>now);
 const env=environment();env.BOARD_ROOMS={idFromName:name=>name,get:()=>({fetch:async()=>{calls++;throw Error('Exceeded allowed volume of requests in Durable Objects free tier.')}})};
 const first=await api(env,'/api/board/rooms',{game:'snakes',name:'A'});assert.equal(first.response.status,503);assert.equal(first.data.code,'DURABLE_REQUEST_LIMIT');assert.equal(first.data.resetAt,Date.UTC(2026,9,12));assert.match(first.data.error,/٣|3/);
 const second=await api(env,'/api/board/rooms',{game:'snakes',name:'A'});assert.equal(second.data.code,'DURABLE_REQUEST_LIMIT');assert.equal(calls,1);
 now=Date.UTC(2026,9,12)+1;env.BOARD_ROOMS={idFromName:name=>name,get:()=>({fetch:async()=>{calls++;return Response.json({ok:true},{status:201})}})};
 assert.equal((await api(env,'/api/board/rooms',{game:'snakes',name:'A'})).response.status,200);assert.equal(calls,2);
});
test('quota failure in the global rate guard is reported without another DO request',async()=>{
 // Since 30.1.0 only password and paid-generation routes use the Durable Object guard.
 const env=environment();let calls=0;env.ROOMS={idFromName:name=>name,get:()=>({fetch:async()=>{calls++;throw Error('Exceeded allowed volume of requests in Durable Objects free tier.')}})};
 const res=await api(env,'/api/social/login',{username:'playera',password:'StrongPass123!'});assert.equal(res.data.code,'DURABLE_REQUEST_LIMIT');assert.equal(calls,1);assert.equal(env.BOARD_ROOMS.objects.size,0);
});
test('ordinary game routes no longer depend on the global Durable Object rate guard',async()=>{
 const env=environment();let calls=0;env.ROOMS={idFromName:name=>name,get:()=>({fetch:async()=>{calls++;throw Error('Exceeded allowed volume of requests in Durable Objects free tier.')}})};
 const res=await api(env,'/api/board/rooms',{game:'snakes',name:'A'});assert.equal(res.response.status,200,JSON.stringify(res.data));assert.equal(calls,0);
});
test('party routes respect an exhausted quota without repeatedly calling the room service',async()=>{
 const env=environment();let calls=0;env.ROOMS={idFromName:name=>name,get:()=>({fetch:async()=>{calls++;throw Error('Exceeded allowed volume of requests in Durable Objects free tier.');}})};
 for(let i=0;i<3;i++){const res=await api(env,'/api/party/rooms',{capacity:20,playlist:['memory']});assert.equal(res.response.status,503);assert.equal(res.data.code,'DURABLE_REQUEST_LIMIT');}
 assert.equal(calls,1);
});
for(const data of [
 {ok:false,code:'DURABLE_REQUEST_LIMIT',error:'وصلت خدمة الأونلاين إلى حد الطلبات اليومي. تعود بعد الساعة ٣:٠٠ صباحًا بتوقيت السعودية.'},
 {ok:false,error:'تعذر تشغيل غرفة اللعبة — Exceeded allowed volume of requests in Durable Objects free tier.'}
])test('the online client recognizes quota exhaustion without sending another health probe',async t=>{
 const paths=[];t.mock.method(globalThis,'fetch',async path=>{paths.push(path);return Response.json(data,{status:503})});
 const client=new BoardOnlineClient('snakes');client.connect=async()=>{throw Error('must not connect')};
 await assert.rejects(()=>client.create('A',4),error=>error.code==='DURABLE_REQUEST_LIMIT'&&/٣|3/.test(error.message));assert.deepEqual(paths,['/api/board/rooms']);
});
