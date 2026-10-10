import test from 'node:test';
import assert from 'node:assert/strict';
import {createDOM} from './dom-harness.mjs';
import {Career} from '../src/career/core.js';
const token='playera.'+'a'.repeat(43);
async function harness(){const h=await createDOM('shop.html');h.context.AbortSignal=AbortSignal;h.storage.set('bs_social_session',token);h.storage.set('bs_social_profile',JSON.stringify({username:'playera',displayName:'A'}));h.storage.set('busraj-account-career-v6:playera',JSON.stringify(Career.normalize({name:'A',coins:100})));await h.runFile('assets/js/profile-core.js');return h}

test('offline practice survives a reload and reconnect syncs two results without awarding twice',async()=>{
 const h=await harness();h.context.fetch=async()=>{throw new TypeError('offline')};await h.runFile('assets/js/career-client.js');
 await h.context.BS_CAREER.record({id:'offline-1',game:'memory',win:true});await h.context.BS_CAREER.record({id:'offline-2',game:'puzzle',win:true});
 assert.equal(JSON.parse(h.storage.get('busraj-practice-outbox-v6:playera')).length,2);assert.equal(h.context.BS_CAREER.get().coins,100);
 let server=Career.normalize({name:'A'}),posts=0;
 h.context.fetch=async(_url,options)=>{if(options.method==='POST'){posts++;server=Career.reward(server,JSON.parse(options.body))}return new Response(JSON.stringify({username:'playera',career:server}),{status:200})};
 await h.runFile('assets/js/career-client.js');await h.context.BS_CAREER.refresh();await h.context.BS_CAREER.refresh();
 assert.equal(h.storage.has('busraj-practice-outbox-v6:playera'),false);assert.equal(posts,2);assert.equal(h.context.BS_CAREER.get().xp,200);assert.equal(h.context.BS_CAREER.get().coins,140);assert.equal(h.context.BS_CAREER.get().rankedXP,0);
});

test('an old account response cannot overwrite the new account or send it another users pending rounds',async()=>{
 const h=await harness();let release;const blocked=new Promise(r=>release=r);
 h.context.fetch=async()=>{await blocked;return new Response(JSON.stringify({username:'playera',career:Career.normalize({name:'A',xp:9000})}),{status:200})};await h.runFile('assets/js/career-client.js');
 const old=h.context.BS_CAREER.refresh();h.storage.set('bs_social_session','playerb.'+'b'.repeat(43));h.storage.set('bs_social_profile',JSON.stringify({username:'playerb',displayName:'B'}));h.storage.set('busraj-practice-outbox-v6:playera',JSON.stringify([{id:'only-a',game:'memory',win:true}]));release();await old;
 let posts=0;h.context.fetch=async(_url,options)=>{if(options.method==='POST')posts++;return new Response(JSON.stringify({username:'playerb',career:Career.normalize({name:'B',xp:0})}),{status:200})};await h.context.BS_CAREER.refresh();
 assert.equal(h.context.BS_CAREER.account(),'playerb');assert.equal(h.context.BS_CAREER.get().xp,0);assert.equal(posts,0);assert.equal(JSON.parse(h.storage.get('busraj-practice-outbox-v6:playera')).length,1);
});

test('a timed out response replays one durable receipt and the server grants one reward',async()=>{
 const h=await harness();let server=Career.normalize(),lost=true;
 h.context.fetch=async(_url,options)=>{if(options.method==='POST'){server=Career.reward(server,JSON.parse(options.body));if(lost){lost=false;throw new TypeError('lost response')}}return new Response(JSON.stringify({username:'playera',career:server}),{status:200})};await h.runFile('assets/js/career-client.js');await h.context.BS_CAREER.record({id:'once',game:'logic',win:true});
 assert.equal(JSON.parse(h.storage.get('busraj-practice-outbox-v6:playera')).length,1);await h.context.BS_CAREER.refresh();assert.equal(server.games,1);assert.equal(h.context.BS_CAREER.get().xp,100);assert.equal(h.storage.has('busraj-practice-outbox-v6:playera'),false);
});
