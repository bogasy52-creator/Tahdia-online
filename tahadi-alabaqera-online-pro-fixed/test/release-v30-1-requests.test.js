import test from 'node:test';
import assert from 'node:assert/strict';
import {environment,api} from './worker-harness.mjs';
const Worker=await import('../src/index.js');

// The free Cloudflare tier counts every Durable Object request. A global rate
// counter in a Durable Object doubles the cost of each API call, so only
// abuse-sensitive routes may use it; ordinary game routes count in memory.
function countingRooms(env){
 const calls=[];
 env.ROOMS={idFromName:name=>name,get:name=>({fetch:async input=>{const url=String(input?.url||input);calls.push({name,url});return url.endsWith('/rate')?Response.json({ok:true}):Response.json({ok:true},{status:201});}})};
 return calls;
}
const rateCalls=calls=>calls.filter(c=>String(c.name).startsWith('__rate__:'));

test('ordinary game API calls do not spend a Durable Object request on rate limiting',async()=>{
 const env=environment(),calls=countingRooms(env);
 const board=await api(env,'/api/board/rooms',{game:'snakes',name:'A',playerLimit:2});
 assert.equal(board.response.status,200,JSON.stringify(board.data));
 await api(env,'/api/board/rooms/'+board.data.code+'/status');
 await api(env,'/api/rooms',{name:'A',categories:[]});
 assert.deepEqual(rateCalls(calls),[]);
});

test('password routes keep the globally consistent Durable Object rate limit',async()=>{
 const env=environment(),calls=countingRooms(env);
 await api(env,'/api/social/login',{username:'nobody',password:'wrong-password'});
 assert.equal(rateCalls(calls).length,1);
 assert.match(rateCalls(calls)[0].url,/\/rate$/);
});

test('in-memory limits still stop a flood of room creation from one address',async()=>{
 const env=environment();countingRooms(env);
 const headers={Origin:'https://game.test','CF-Connecting-IP':'203.0.113.9','content-type':'application/json'};
 let limited=0;
 for(let i=0;i<14;i++){const res=await Worker.default.fetch(new Request('https://game.test/api/board/rooms',{method:'POST',headers,body:JSON.stringify({game:'snakes',name:'A',playerLimit:2})}),env);if(res.status===429)limited++;}
 assert.ok(limited>=1,'the twelve-per-minute creation limit still applies');
});
