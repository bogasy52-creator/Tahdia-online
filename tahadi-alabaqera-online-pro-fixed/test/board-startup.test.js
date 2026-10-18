import test from 'node:test';
import assert from 'node:assert/strict';
import {environment,api} from './worker-harness.mjs';
import {BoardOnlineClient} from '../public/assets/js/board-online.js';
test('board engine health checks the actual Durable Object without creating a game room',async()=>{
 const env=environment(),res=await api(env,'/api/board/health');assert.equal(res.response.status,200);assert.equal(res.data.engine,'BoardRoom');assert.equal(res.data.release,'23.0.0');
 const holder=env.BOARD_ROOMS.peek('__board_health__');assert.equal(holder.instance.room,null);assert.equal(await holder.ctx.storage.get('room'),undefined);assert.equal(holder.ctx.storage.alarm,null);
});
test('board health distinguishes an absent binding from an obsolete engine',async()=>{
 const env=environment();delete env.BOARD_ROOMS;const missing=await api(env,'/api/board/health');assert.equal(missing.response.status,503);assert.equal(missing.data.code,'BOARD_BINDING_MISSING');
 env.BOARD_ROOMS={idFromName:name=>name,get:()=>({fetch:async()=>Response.json({error:'not_found'},{status:404})})};const old=await api(env,'/api/board/health');assert.equal(old.response.status,503);assert.equal(old.data.code,'BOARD_ENGINE_OUTDATED');
});
test('game rooms initialize without loading account records or the social delegate',async()=>{
 const env=environment(),holder=env.BOARD_ROOMS.peek('standalone-room');await holder.ctx.ready;const keys=[],get=holder.ctx.storage.get.bind(holder.ctx.storage);holder.ctx.storage.get=async key=>{keys.push(key);return get(key)};
 holder.instance=new holder.instance.constructor(holder.ctx,env);await holder.ctx.ready;assert.equal(keys.includes('profile'),false);assert.equal(keys.includes('presence'),false);
 const res=await holder.instance.fetch(new Request('https://board.internal/init',{method:'POST',body:JSON.stringify({code:'123456',game:'snakes',variant:'adventure',hostKey:'h'})}));assert.equal(res.status,201);
});
test('failed room initialization rolls back storage and a retry can initialize the same room',async()=>{
 const env=environment(),holder=env.BOARD_ROOMS.peek('retry-room');await holder.ctx.ready;const original=holder.ctx.storage.setAlarm.bind(holder.ctx.storage);let fail=true;holder.ctx.storage.setAlarm=async time=>{if(fail){fail=false;throw new Error('alarm temporarily unavailable')}return original(time)};
 const init=()=>holder.instance.fetch(new Request('https://board.internal/init',{method:'POST',body:JSON.stringify({code:'123456',game:'snakes',variant:'adventure',hostKey:'h'})}));
 const first=await init();assert.equal(first.status,503);assert.equal((await first.json()).code,'ROOM_INITIALIZATION_FAILED');assert.equal(holder.instance.room,null);assert.equal(await holder.ctx.storage.get('room'),undefined);
 const second=await init();assert.equal(second.status,201);assert.equal(holder.instance.room.variant,'adventure');
});
test('create API retries only code collisions and preserves engine startup failures',async()=>{
 const env=environment();let calls=0;env.BOARD_ROOMS={idFromName:name=>name,get:()=>({fetch:async()=>{calls++;return Response.json({error:'unavailable',code:'ROOM_INITIALIZATION_FAILED'},{status:503})}})};
 const res=await api(env,'/api/board/rooms',{game:'snakes',name:'A',variant:'adventure'});assert.equal(res.response.status,503);assert.equal(res.data.code,'ROOM_INITIALIZATION_FAILED');assert.equal(calls,1);assert.ok(res.data.requestId);
});
test('actual online client explains an unavailable room engine using the health response',async t=>{
 const paths=[];t.mock.method(globalThis,'fetch',async path=>{paths.push(path);return path==='/api/board/health'?Response.json({ok:false,code:'BOARD_ENGINE_OUTDATED'},{status:503}):Response.json({error:'تعذر تشغيل غرفة اللعبة'},{status:503})});
 const client=new BoardOnlineClient('snakes');client.connect=async()=>{throw Error('must not connect')};await assert.rejects(()=>client.create('A',2),/السيرفر|تحديث/);assert.ok(paths.includes('/api/board/health'));
});
