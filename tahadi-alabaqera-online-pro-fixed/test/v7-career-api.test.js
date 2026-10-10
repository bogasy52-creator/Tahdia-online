import test from 'node:test';
import assert from 'node:assert/strict';
import {environment,api,signup} from './worker-harness.mjs';
import '../public/assets/js/profile-core.js';
const Career=globalThis.BS_CAREER_CORE;

test('authenticated daily reward is credited once under simultaneous requests',async()=>{
 const env=environment(),account=await signup(env),token=account.data.token;
 const replies=await Promise.all(Array.from({length:4},()=>api(env,'/api/social/career/daily',{},token)));
 for(const reply of replies)assert.equal(reply.response.status,200);
 const career=(await api(env,'/api/social/career',undefined,token)).data.career;
 assert.equal(career.coins,130);assert.equal(career.dailyStreak,1);
 assert.equal(career.dailyDay,Career.riyadhDay());
 assert.equal((await api(env,'/api/social/career/daily',{})).response.status,401);
});

test('daily reward stays with its account and ignores forged amounts',async()=>{
 const env=environment(),a=await signup(env,'playera'),b=await signup(env,'playerb');
 const reward=await api(env,'/api/social/career/daily',{coins:99999,username:'playerb',dailyStreak:7},a.data.token);
 assert.equal(reward.data.career.coins,130);
 assert.equal((await api(env,'/api/social/career',undefined,b.data.token)).data.career.coins,100);
});

test('the server charges the daily offer price once and equips the purchased item',async()=>{
 const env=environment(),account=await signup(env),token=account.data.token;
 await api(env,'/api/social/career/daily',{},token);
 for(let i=0;i<20;i++)await api(env,'/api/social/career/practice',{id:'offer:'+i,game:'snakes',win:true},token);
 const offer=Career.dailyOffer(),before=(await api(env,'/api/social/career',undefined,token)).data.career;
 const bought=await api(env,'/api/social/career/purchase',{id:offer.id,price:0},token);
 assert.equal(bought.response.status,200);assert.equal(bought.data.career.coins,before.coins-offer.price);
 assert.ok(bought.data.career.owned.includes(offer.id));
 const type=Career.CATALOG.find(item=>item.id===offer.id).type;
 assert.equal(bought.data.career.equipped[type],offer.id);
 const again=await api(env,'/api/social/career/purchase',{id:offer.id},token);
 assert.equal(again.data.career.coins,bought.data.career.coins);
});
