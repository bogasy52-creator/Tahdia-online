import test from 'node:test';
import assert from 'node:assert/strict';
import {environment,api,signup} from './worker-harness.mjs';
import {Career} from '../src/career/core.js';
test('bosrag receives all cosmetics and owner access without changing existing progress',async()=>{
 const env=environment(),owner=await signup(env,'bosrag'),holder=env.BOARD_ROOMS.peek('social:user:bosrag');
 await holder.ctx.storage.put('career',{coins:567,xp:1200,owned:['dice-copper'],equipped:{dice:'dice-copper'}});
 const res=await api(env,'/api/social/career',undefined,owner.data.token);
 assert.equal(res.response.status,200);assert.equal(res.data.access.role,'owner');assert.equal(res.data.career.coins,567);assert.equal(res.data.career.xp,1200);
 assert.equal(res.data.career.equipped.dice,'dice-copper');assert.equal(res.data.career.owned.length,Career.CATALOG.length);
 assert.equal(res.data.career.equipped.title,'title-manager');
 const again=await api(env,'/api/social/career/purchase',{id:'dice-gold'},owner.data.token);assert.equal(again.data.career.coins,567);
});
test('manager routes reject guests, other accounts, forged names, roles and sessions',async()=>{
 const env=environment(),a=await signup(env,'playera');await signup(env,'bosrag');
 assert.equal((await api(env,'/api/social/admin',undefined)).response.status,401);
 assert.equal((await api(env,'/api/social/admin',undefined,a.data.token)).response.status,403);
 const fake='bosrag.'+a.data.token.split('.')[1];assert.equal((await api(env,'/api/social/admin',undefined,fake)).response.status,401);
 const forged=await api(env,'/api/social/career',undefined,a.data.token);assert.equal(forged.data.access.role,'player');assert.notEqual(forged.data.career.owned.length,Career.CATALOG.length);
 const grant=await api(env,'/api/social/admin/action',{username:'bosrag',role:'owner',action:'coins',amount:99999,requestId:'fake-id-001'},a.data.token);assert.equal(grant.response.status,403);
});
test('mission rewards are computed by the server once and cannot be forged or claimed early',async()=>{
 const env=environment(),a=await signup(env),token=a.data.token;
 assert.equal((await api(env,'/api/social/career/claim',{id:'daily-play',coins:9999},token)).response.status,400);
 for(let i=0;i<3;i++)await api(env,'/api/social/career/practice',{id:'mission:'+i,game:'snakes',win:true,verified:true},token);
 const before=(await api(env,'/api/social/career',undefined,token)).data.career;
 const replies=await Promise.all([1,2,3].map(()=>api(env,'/api/social/career/claim',{id:'daily-play',coins:9999,username:'bosrag'},token)));
 for(const r of replies)assert.equal(r.response.status,200);
 const after=(await api(env,'/api/social/career',undefined,token)).data.career;
 assert.equal(after.coins,before.coins+30);assert.equal(after.rankedXP,0);
 assert.equal((await api(env,'/api/social/career/claim',{id:'weekly-online'},token)).response.status,400);
});
test('manager grants are idempotent, audited, bounded and applied to the requested existing account',async()=>{
 const env=environment(),owner=await signup(env,'bosrag'),a=await signup(env),token=owner.data.token;
 const body={username:'playera',action:'coins',amount:250,requestId:'grant-test-001',reason:'مكافأة بطولة'};
 const replies=await Promise.all([1,2,3].map(()=>api(env,'/api/social/admin/action',body,token)));
 for(const r of replies)assert.equal(r.response.status,200,JSON.stringify(r.data));
 assert.equal((await api(env,'/api/social/career',undefined,a.data.token)).data.career.coins,350);
 assert.equal((await api(env,'/api/social/admin/action',{...body,amount:500},token)).response.status,409);
 const invalid=await api(env,'/api/social/admin/action',{...body,requestId:'grant-test-002',amount:1e12},token);assert.equal(invalid.response.status,400);
 const unlock=await api(env,'/api/social/admin/action',{username:'playera',action:'unlock-all',requestId:'unlock-test-001'},token);assert.equal(unlock.data.account.career.owned.length,Career.CATALOG.length-1);assert.equal(unlock.data.account.career.owned.includes('title-manager'),false);
 const audit=(await api(env,'/api/social/admin',undefined,token)).data.audit;assert.equal(audit.filter(x=>x.requestId===body.requestId).length,1);
 assert.equal((await api(env,'/api/social/admin/action',{username:'missing',action:'unlock-all',requestId:'missing-test-001'},token)).response.status,404);
 const lookup=await api(env,'/api/social/admin/account?username=playera',undefined,token);assert.equal(lookup.data.account.profile.username,'playera');assert.equal(lookup.data.account.profile.password,undefined);
});
test('manager can suspend, revoke and restore accounts while owner access stays protected',async()=>{
 const env=environment(),owner=await signup(env,'bosrag'),a=await signup(env),token=owner.data.token;
 const blocked=await api(env,'/api/social/admin/action',{username:'playera',action:'suspend',requestId:'suspend-001'},token);assert.equal(blocked.response.status,200);
 assert.equal((await api(env,'/api/social/career',undefined,a.data.token)).response.status,401);
 assert.equal((await api(env,'/api/social/login',{username:'playera',password:'StrongPass123!'})).response.status,403);
 const restore=await api(env,'/api/social/admin/action',{username:'playera',action:'restore',requestId:'restore-001'},token);assert.equal(restore.response.status,200);
 const login=await api(env,'/api/social/login',{username:'playera',password:'StrongPass123!'});assert.equal(login.response.status,200);
 assert.equal((await api(env,'/api/social/admin/action',{username:'bosrag',action:'suspend',requestId:'owner-ban-001'},token)).response.status,403);
});
test('store bundles ignore client prices and support partial ownership on the actual Worker',async()=>{
 const env=environment(),owner=await signup(env,'bosrag'),a=await signup(env);
 await api(env,'/api/social/admin/action',{username:'playera',action:'coins',amount:5000,requestId:'bundle-funds-001'},owner.data.token);
 const bundle=Career.BUNDLES[0],before=(await api(env,'/api/social/career',undefined,a.data.token)).data.career,quote=Career.bundleQuote(before,bundle.id);
 const buy=await api(env,'/api/social/career/bundle',{id:bundle.id,price:0},a.data.token);assert.equal(buy.response.status,200);assert.equal(buy.data.career.coins,before.coins-quote.price);
 const again=await api(env,'/api/social/career/bundle',{id:bundle.id},a.data.token);assert.equal(again.data.career.coins,buy.data.career.coins);
});
test('manager announcement is published safely and kept in the audit log',async()=>{
 const env=environment(),owner=await signup(env,'bosrag');
 const res=await api(env,'/api/social/admin/action',{action:'announcement',text:'مكافآت المتجر الجديدة جاهزة',requestId:'news-test-001'},owner.data.token);assert.equal(res.response.status,200);
 const news=await api(env,'/api/social/announcement');assert.equal(news.data.announcement.text,'مكافآت المتجر الجديدة جاهزة');
 assert.equal((await api(env,'/api/social/admin/action',{action:'announcement',text:' ',requestId:'news-test-002'},owner.data.token)).response.status,400);
});
test('retry after an audit storage failure cannot grant coins twice',async()=>{
 const env=environment(),owner=await signup(env,'bosrag'),a=await signup(env),holder=env.BOARD_ROOMS.peek('social:user:bosrag');
 const original=holder.ctx.storage.put.bind(holder.ctx.storage);let fail=true;
 holder.ctx.storage.put=async(key,value)=>{if(fail&&key.startsWith('admin:receipt:')){fail=false;throw new Error('storage interrupted')}return original(key,value)};
 const command={username:'playera',action:'coins',amount:250,requestId:'lost-audit-001'};
 await assert.rejects(()=>api(env,'/api/social/admin/action',command,owner.data.token),/storage interrupted/);
 const again=await api(env,'/api/social/admin/action',command,owner.data.token);assert.equal(again.response.status,200);
 assert.equal((await api(env,'/api/social/career',undefined,a.data.token)).data.career.coins,350);
 assert.equal((await api(env,'/api/social/admin',undefined,owner.data.token)).data.audit.filter(x=>x.requestId===command.requestId).length,1);
});
test('manager self grants do not deadlock and ownership survives a Durable Object restart',async()=>{
 const env=environment(),owner=await signup(env,'bosrag'),token=owner.data.token,holder=env.BOARD_ROOMS.peek('social:user:bosrag');
 const res=await api(env,'/api/social/admin/action',{username:'bosrag',action:'coins',amount:200,requestId:'self-funds-001'},token);assert.equal(res.response.status,200);assert.equal(res.data.account.career.coins,300);
 holder.instance=new holder.instance.constructor(holder.ctx,env);await holder.ctx.ready;
 const restored=await api(env,'/api/social/career',undefined,token);assert.equal(restored.data.access.role,'owner');assert.equal(restored.data.career.owned.length,Career.CATALOG.length);assert.equal(restored.data.career.coins,300);
});
test('replaying an old manager request returns the current balance without replaying its grant',async()=>{
 const env=environment(),owner=await signup(env,'bosrag');await signup(env);
 const first={username:'playera',action:'coins',amount:250,requestId:'fresh-balance-001'};
 await api(env,'/api/social/admin/action',first,owner.data.token);await api(env,'/api/social/admin/action',{...first,amount:100,requestId:'fresh-balance-002'},owner.data.token);
 const repeat=await api(env,'/api/social/admin/action',first,owner.data.token);assert.equal(repeat.data.replayed,true);assert.equal(repeat.data.account.career.coins,450);
});
test('manager can remove an obsolete announcement and store refuses a mismatched quote',async()=>{
 const env=environment(),owner=await signup(env,'bosrag'),a=await signup(env);
 await api(env,'/api/social/admin/action',{action:'announcement',text:'خبر قديم',requestId:'remove-news-001'},owner.data.token);
 const remove=await api(env,'/api/social/admin/action',{action:'clear-announcement',requestId:'remove-news-002'},owner.data.token);assert.equal(remove.response.status,200);assert.equal((await api(env,'/api/social/announcement')).data.announcement,null);
 await api(env,'/api/social/career/daily',{},a.data.token);const before=(await api(env,'/api/social/career',undefined,a.data.token)).data.career.coins;
 const buy=await api(env,'/api/social/career/purchase',{id:'pawn-jade',expectedPrice:1},a.data.token);assert.equal(buy.response.status,400);assert.equal(buy.data.error,'price_changed');assert.equal((await api(env,'/api/social/career',undefined,a.data.token)).data.career.coins,before);
});
