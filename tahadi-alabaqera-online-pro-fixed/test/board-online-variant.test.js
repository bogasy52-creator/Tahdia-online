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
test('duplicate and older board snapshots do not replay a move or roll back the current version',async t=>{
 const peers=[],states=[],originals=new Map(['location','localStorage','WebSocket'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));t.after(()=>{for(const [k,descriptor]of originals)descriptor?Object.defineProperty(globalThis,k,descriptor):delete globalThis[k];});
 globalThis.location={protocol:'https:',host:'game.test'};globalThis.localStorage={getItem:()=>null,setItem(){}};globalThis.WebSocket=class{static OPEN=1;constructor(){peers.push(this)}close(){}};
 const client=new BoardOnlineClient('snakes',{onState:s=>states.push(s)});client.code='123456';const opening=client.openSocket(),ws=peers[0];
 ws.onmessage({data:JSON.stringify({type:'welcome',token:'t',state:{version:3}})});await opening;
 for(const version of [3,2,4,4])ws.onmessage({data:JSON.stringify({type:'state',state:{version}})});
 assert.deepEqual(states.map(s=>s.version),[3,4]);assert.equal(client.version,4);
 ws.onmessage({data:JSON.stringify({type:'state',state:{version:4,players:[{id:'new-friend',connected:true}]}})});
 assert.equal(states.length,3,'joining players can change the roster without advancing the gameplay version');assert.equal(states.at(-1).players[0].id,'new-friend');
});

test('a stale server cannot silently replace a requested enhanced room with classic',async t=>{
 t.mock.method(globalThis,'fetch',async()=>Response.json({ok:true,code:'123456',hostKey:'h'}));
 const client=new BoardOnlineClient('snakes');let connected=false;client.connect=async()=>{connected=true};
 await assert.rejects(client.create('A',2,{variant:'adventure'}),/المطوّر|المطورة|تحديث/);
 assert.equal(connected,false);
});
