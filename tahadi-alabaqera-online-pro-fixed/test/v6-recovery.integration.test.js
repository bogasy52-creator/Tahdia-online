import test from 'node:test';
import assert from 'node:assert/strict';
import {environment,api,signup} from './worker-harness.mjs';

test('a failed match initialization preserves both seats and reconnect retries the same match',async()=>{
 const env=environment(),base=env.QUICK_ARENA.get.bind(env.QUICK_ARENA);let fail=true;
 env.QUICK_ARENA.get=name=>{const stub=base(name);return {fetch:async(input,init)=>{if(name.startsWith('match:')&&new URL(input instanceof Request?input.url:input).pathname==='/init'&&fail){fail=false;return new Response('{}',{status:503})}return stub.fetch(input,init)}}};
 const a=(await api(env,'/api/quick/join',{name:'A'})).data,b=(await api(env,'/api/quick/join',{name:'B'})).data;
 assert.equal(b.status,'waiting');assert.equal(b.preparing,true);assert.ok(b.secret);
 const recovered=(await api(env,'/api/quick/ticket',a)).data;
 assert.equal(recovered.status,'matched');assert.equal(recovered.matchId,b.matchId);
 const rejoined=(await api(env,'/api/quick/join',b)).data;
 assert.equal(rejoined.id,b.id);assert.equal(rejoined.status,'matched');assert.equal(rejoined.matchId,b.matchId);
 const state=(await api(env,'/api/quick/matches/'+b.matchId+'/state',b)).data.state;
 assert.deepEqual(new Set(state.players.map(p=>p.id)),new Set([a.id,b.id]));
});

function failOneReward(env){const base=env.BOARD_ROOMS.get.bind(env.BOARD_ROOMS);let fail=true;env.BOARD_ROOMS.get=name=>{const stub=base(name);return {fetch:async(input,init)=>{const url=new URL(input instanceof Request?input.url:input);if(url.hostname==='social.internal'&&url.pathname==='/career/verified'&&fail){fail=false;return new Response('{}',{status:503})}return stub.fetch(input,init)}}}}

test('finished quick matches stay readable while a failed reward is retried exactly once',async()=>{
 const env=environment(),token=(await signup(env)).data.token;
 const a=(await api(env,'/api/quick/join',{name:'A'},token)).data,b=(await api(env,'/api/quick/join',{name:'B'})).data;
 const {instance,ctx}=env.QUICK_ARENA.peek('match:'+b.matchId);instance.match.phase='finished';instance.match.finishedAt=Date.now();instance.match.winners=[a.id];failOneReward(env);
 const result=await api(env,'/api/quick/matches/'+b.matchId+'/state',a,token);
 assert.equal(result.response.status,200);assert.equal(result.data.state.phase,'finished');assert.ok(ctx.storage.alarm<=Date.now()+10000);
 assert.equal((await api(env,'/api/social/career',undefined,token)).data.career.rankedWins,0);
 await instance.alarm();await instance.alarm();
 assert.equal((await api(env,'/api/social/career',undefined,token)).data.career.rankedWins,1);
});

test('board reward retries run on an alarm and a reconnect keeps one stable result identity',async()=>{
 const env=environment(),token=(await signup(env)).data.token,{instance,ctx}=env.BOARD_ROOMS.peek('123456');await ctx.ready;
 instance.room={code:'123456',game:'snakes',status:'finished',startedAt:12345,expiresAt:Date.now()+86400000,version:8,order:['a','b'],players:{a:{id:'a',username:'playera',name:'A'},b:{id:'b',name:'B'}},state:{winner:0},rewardsComplete:false};failOneReward(env);
 await instance.saveAndBroadcast();assert.equal(instance.room.rewardsComplete,false);assert.ok(ctx.storage.alarm<=Date.now()+10000);
 const first=instance.publicState('a');instance.room.version++;const next=instance.publicState('a');assert.equal(first.startedAt,next.startedAt);
 await instance.alarm();assert.equal(instance.room.rewardsComplete,true);await instance.alarm();
 assert.equal((await api(env,'/api/social/career',undefined,token)).data.career.rankedWins,1);
});
