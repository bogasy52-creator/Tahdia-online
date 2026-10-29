// Temporary local Workerd/SQLite. No merchant API calls, charges or deployment.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRuntime} from './local-runtime-v26.mjs';
import {signBillingGrant} from '../src/billing/proof.js';
const secret='sk_test_local_fixture',runtime=await createRuntime({bindings:{MOYASAR_SECRET_KEY:secret}}),checks=[],sockets=[];
async function api(path,body,token){const headers={'content-type':'application/json',origin:new URL(runtime.url).origin};if(token)headers.authorization='Bearer '+token;const response=await runtime.mf.dispatchFetch(new URL(path,runtime.url),{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined});return{response,data:await response.json()};}
async function until(work){for(let i=0;i<100;i++){if(await work())return;await new Promise(r=>setTimeout(r,20));}throw Error('presence did not settle');}
try{
 for(const [path,match]of [['/reaction',/id="reactionMode"/],['/shop',/character-commerce\.js/],['/social',/id="playerProfileCard"/],['/admin',/data-admin-tab="store"/],['/party',/hero-effects\.js/]])assert.match(await(await runtime.mf.dispatchFetch(new URL(path,runtime.url))).text(),match);
 checks.push('new game, character store, profile and owner dashboard assets served by the real Worker');
 const alice=await api('/api/social/signup',{username:'characteruser',displayName:'Character User',password:'RuntimeTestPass123!'}),owner=await api('/api/social/signup',{username:'bosrag',displayName:'Owner',password:'RuntimeTestPass123!'});assert.equal(alice.response.status,201);assert.equal(owner.response.status,201);
 assert.equal((await api('/api/billing/catalog')).data.enabled,false);assert.equal((await api('/api/billing/checkout',{item:'character-cat'})).response.status,401);assert.equal((await api('/api/billing/checkout',{item:'character-cat',requestId:'runtime-purchase-0001',expectedAmount:499},alice.data.token)).response.status,503);
 checks.push('cash payments stay disabled without explicit merchant activation, and checkout requires an account');
 assert.equal((await api('/api/billing/admin',undefined,alice.data.token)).response.status,403);const summary=await api('/api/billing/admin',undefined,owner.data.token);assert.equal(summary.response.status,200);assert.deepEqual(summary.data.metrics,{paid:0,revenue:0});assert.ok(!JSON.stringify(summary.data).includes(secret));
 checks.push('owner-only billing totals persist in SQLite; regular players cannot read them and no secret is returned');
 const env=await runtime.mf.getBindings(),user=env.BOARD_ROOMS.get(env.BOARD_ROOMS.idFromName('social:user:characteruser')),claim={username:'characteruser',invoiceId:crypto.randomUUID(),item:'character-cat',amount:499};
 let r=await user.fetch('https://social.internal/billing/grant',{method:'POST',body:JSON.stringify(claim)});assert.equal(r.status,403);const proof=await signBillingGrant(secret,claim);
 for(let i=0;i<2;i++){r=await user.fetch('https://social.internal/billing/grant',{method:'POST',body:JSON.stringify({...claim,proof})});assert.equal(r.status,200);}
 const career=(await api('/api/social/career',undefined,alice.data.token)).data.career;assert.equal(career.owned.filter(v=>v==='character-cat').length,1);assert.equal(career.coins,100);assert.equal(career.games,0);assert.equal((await api('/api/social/billing/grant',{...claim,proof},alice.data.token)).response.status,404);
 checks.push('native Web Crypto verifies signed fulfillment; duplicate receipts grant once without changing game coins or results; private grants have no public route');
 const wsResponse=await runtime.mf.dispatchFetch(new URL('/api/social/ws',runtime.url),{headers:{upgrade:'websocket','sec-websocket-protocol':'busraj-social-v1, st.'+alice.data.token}});assert.equal(wsResponse.status,101);const ws=wsResponse.webSocket;ws.accept();sockets.push(ws);
 await until(async()=>(await api('/api/social/users/characteruser',undefined,owner.data.token)).data.profile.online);ws.close(1000,'test complete');
 await until(async()=>{const p=(await api('/api/social/users/characteruser',undefined,owner.data.token)).data.profile;return p.online===false&&p.lastSeen>0;});
 await api('/api/social/settings',{showOnline:false},alice.data.token);const hidden=(await api('/api/social/users/characteruser',undefined,owner.data.token)).data.profile;assert.equal(hidden.online,false);assert.equal(hidden.lastSeen,null);
 checks.push('real social WebSocket updates online/last-seen on disconnect and the privacy setting hides both');
 const result={release:'33.0.0',runtime:'native Workerd / SQLite / real WebSocket / Web Crypto',published:false,browser_tested:false,physical_phone_tested:false,merchant_api_called:false,checks};await mkdir(new URL('../verification/characters/',import.meta.url),{recursive:true});await writeFile(new URL('../verification/characters/runtime.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}finally{for(const ws of sockets)try{ws.close(1000,'done');}catch{}await runtime.dispose();}
