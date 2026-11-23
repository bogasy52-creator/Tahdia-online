import test from 'node:test';import assert from 'node:assert/strict';
import {poolLedger,reservePoolEntry,settlePoolEntry,poolEntryAmount} from '../src/billiards/stakes.js';
import {createPoolEntryUI} from '../public/assets/js/billiards/entry-tables-v33-11-6.js';
import {createDOM} from './dom-harness.mjs';
class Store{
 constructor(coins){this.data=new Map([['career',{coins}]]);this.chain=Promise.resolve();}
 async get(k){return structuredClone(this.data.get(k));}async put(k,v){this.data.set(k,structuredClone(v));}async setAlarm(){}
 transaction(fn){const task=this.chain.then(async()=>{const saved=structuredClone(this.data);try{return await fn(this);}catch(e){this.data=saved;throw e;}});this.chain=task.catch(()=>{});return task;}
}
const profile={username:'tester',displayName:'Tester'},receipt={id:'pool:123456:match-1',amount:25};
test('concurrent holds and repeated settlement debit and credit exactly once',async()=>{
 const s=new Store(100);await Promise.all(Array.from({length:10},()=>poolLedger(s,profile,{...receipt,action:'hold'})));assert.equal((await s.get('career')).coins,75);
 await Promise.all(Array.from({length:10},()=>poolLedger(s,profile,{...receipt,action:'settle',award:50})));assert.equal((await s.get('career')).coins,125);
 await assert.rejects(poolLedger(s,profile,{...receipt,action:'settle',award:0}),/conflict/);assert.equal((await s.get('career')).coins,125);
});
test('a refund arriving before a late hold closes the receipt without granting or losing coins',async()=>{
 const s=new Store(100);const cancelled=await poolLedger(s,profile,{...receipt,action:'refund'});assert.ok(cancelled.cancelledBeforeHold);await poolLedger(s,profile,{...receipt,action:'hold'});assert.equal((await s.get('career')).coins,100);
});
test('invalid amounts, missing holds and insufficient balances cannot mutate the wallet',async()=>{
 for(const x of [-1,1,26,'25',NaN])assert.throws(()=>poolEntryAmount(x));
 const s=new Store(10);await assert.rejects(poolLedger(s,profile,{...receipt,action:'hold'}));await assert.rejects(poolLedger(s,profile,{...receipt,action:'settle',award:50}));assert.equal((await s.get('career')).coins,10);
});
function roomFixture(coins=[100,100],lostResponse=false){
 const stores=coins.map(x=>new Store(x)),host={ctx:{storage:new Store()},room:{code:'091234',poolStake:25,status:'lobby',order:['a','b'],players:{a:{username:'alpha',poolAccepted:25},b:{username:'bravo',poolAccepted:25}}}};
 let dropped=false;const resolve=u=>({async fetch(url,opts){const body=JSON.parse(opts.body),i=u==='alpha'?0:1;try{const value=await poolLedger(stores[i],{...profile,username:u},body);if(lostResponse&&i===0&&body.action==='hold'&&!dropped){dropped=true;throw Error('response_lost');}return Response.json({ok:true,receipt:value});}catch(e){return Response.json({ok:false,error:e.message},{status:409});}}});return {host,stores,resolve};
}
test('partial reservations and lost committed responses compensate both accounts',async()=>{
 for(const [coins,lost] of [[[100,0],false],[[100,100],true]]){const f=roomFixture(coins,lost);await assert.rejects(reservePoolEntry(f.host,f.resolve));assert.equal(f.host.room.poolEntry.phase,'refunded');for(let i=0;i<2;i++)assert.equal((await f.stores[i].get('career')).coins,coins[i]);}
});
test('a room restored after payout cannot pay twice or choose a different winner',async()=>{
 const f=roomFixture();await reservePoolEntry(f.host,f.resolve);assert.equal((await f.stores[0].get('career')).coins,75);f.host.room.status='finished';f.host.room.state={winner:1};await settlePoolEntry(f.host,f.resolve);const saved=structuredClone(f.host.room);f.host.room=saved;f.host.room.state.winner=0;await settlePoolEntry(f.host,f.resolve);assert.equal((await f.stores[0].get('career')).coins,75);assert.equal((await f.stores[1].get('career')).coins,125);
});
test('a paid room rejects bots, duplicate accounts and missing consent before any hold',async()=>{
 for(const mutate of [r=>r.players.b.bot=true,r=>r.players.b.username='alpha',r=>r.players.b.poolAccepted=0]){const f=roomFixture();mutate(f.host.room);await assert.rejects(reservePoolEntry(f.host,f.resolve));assert.equal((await f.stores[0].get('career')).coins,100);}
});
test('entry cards show matching quotes and a guest must explicitly consent to the actual room amount',async()=>{
 const h=await createDOM('billiards.html'),sent=[];let room={poolStake:100,status:'lobby',me:{id:'a'},players:[{id:'a',poolAccepted:0}]};const root={localStorage:{getItem:()=> 'signed'},BS_CAREER:{get:()=>({coins:1000})}};
 const ui=createPoolEntryUI({doc:h.doc,root,getRoom:()=>room,getClient:()=>({send:(type,payload)=>sent.push({type,...payload})})});assert.equal(h.doc.querySelectorAll('.pool-entry-table').length,5);assert.equal(ui.options().poolStake,0);h.doc.querySelector('[data-amount="250"]').click();assert.equal(ui.options().poolStake,250);assert.match(h.doc.querySelector('#poolEntryNotice').textContent,/500/);ui.frame(room);assert.deepEqual(sent,[]);h.doc.querySelector('#poolEntryAccept').click();assert.deepEqual(sent,[{type:'pool_accept_entry',amount:100}]);room.players[0].poolAccepted=100;ui.frame(room);assert.equal(h.doc.querySelector('#poolEntryAccept').disabled,true);
});
