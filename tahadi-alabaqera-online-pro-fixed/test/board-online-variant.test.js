import test from 'node:test';
import assert from 'node:assert/strict';
import {BoardOnlineClient} from '../public/assets/js/board-online.js';
import {environment,api} from './worker-harness.mjs';

test('the actual room client sends the enhanced selection through the Worker create API',async t=>{
 const env=environment();t.mock.method(globalThis,'fetch',async(path,options)=>{const result=await api(env,path,JSON.parse(options.body));return Response.json(result.data,{status:result.response.status})});
 const client=new BoardOnlineClient('snakes');client.connect=async code=>code;
 const code=await client.create('A',2,{variant:'adventure'});
 const entry=env.BOARD_ROOMS.peek(code);await entry.ctx.ready;
 assert.equal(entry.instance.room.variant,'adventure');
});

test('a stale server cannot silently replace a requested enhanced room with classic',async t=>{
 t.mock.method(globalThis,'fetch',async()=>Response.json({ok:true,code:'123456',hostKey:'h'}));
 const client=new BoardOnlineClient('snakes');let connected=false;client.connect=async()=>{connected=true};
 await assert.rejects(client.create('A',2,{variant:'adventure'}),/المطوّر|المطورة|تحديث/);
 assert.equal(connected,false);
});
