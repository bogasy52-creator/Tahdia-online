import test from 'node:test';
import assert from 'node:assert/strict';
import {api,environment} from './worker-harness.mjs';

test('serpent rooms use the existing isolated namespace and return no host key in public status',async()=>{
 const env=environment();let name,initBody;
 env.ROOMS={idFromName:n=>n,get:n=>({fetch:async(request,init)=>{const url=new URL(typeof request==='string'?request:request.url);if(url.pathname==='/rate')return Response.json({ok:true});name=n;if(url.pathname==='/init'){initBody=JSON.parse(init.body);return Response.json({ok:true},{status:201})}return Response.json({ok:true,status:'lobby',players:0})}})};
 const r=await api(env,'/api/serpent/rooms',{name:'Host',playerLimit:4,duration:120});assert.equal(r.response.status,200);assert.match(r.data.code,/^\d{6}$/);assert.ok(r.data.hostKey.length>=32);assert.equal(name,'__serpent__:'+r.data.code);assert.equal(initBody.playerLimit,4);
 const status=await api(env,'/api/serpent/rooms/'+r.data.code+'/status');assert.equal(status.response.status,200);assert.equal(status.data.hostKey,undefined);
});
test('serpent create rejects invalid limits and cross-origin requests',async()=>{
 const env=environment();env.ROOMS={idFromName:n=>n,get:()=>({fetch:async()=>Response.json({ok:true})})};
 for(const playerLimit of [1,21,2.5]){const r=await api(env,'/api/serpent/rooms',{playerLimit});assert.equal(r.response.status,400);}
 const {default:Worker}=await import('../src/index.js');const r=await Worker.fetch(new Request('https://game.test/api/serpent/rooms',{method:'POST',headers:{Origin:'https://evil.test'},body:'{}'}),env);assert.equal(r.status,403);
});
