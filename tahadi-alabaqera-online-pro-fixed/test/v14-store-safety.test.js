import test from 'node:test';
import assert from 'node:assert/strict';
import {createDOM} from './dom-harness.mjs';
import {Career} from '../src/career/core.js';
const KEY='busraj-career-v6';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
async function guest(coins=2000){
 const h=await createDOM('shop.html');h.storage.set(KEY,JSON.stringify(Career.normalize({coins})));
 await h.runFile('assets/js/profile-core.js');await h.runFile('assets/js/career-client.js');await h.context.BS_CAREER.refresh();return h;
}
test('guest storage failure rejects purchase without changing memory or persisted coins',async()=>{
 const h=await guest(),before=h.context.BS_CAREER.get(),stored=h.storage.get(KEY),set=h.context.localStorage.setItem;
 h.context.localStorage.setItem=(key,value)=>{if(key===KEY){const error=new Error('quota');error.name='QuotaExceededError';throw error}set(key,value)};
 await assert.rejects(h.context.BS_CAREER.purchase('pawn-jade'),/quota/);
 assert.deepEqual(h.context.BS_CAREER.get(),before);assert.equal(h.storage.get(KEY),stored);
});
test('a pending account purchase rejects after switching sessions and preserves the new account',async()=>{
 const h=await createDOM('shop.html'),a=Career.normalize({coins:2000}),b=Career.normalize({coins:222}),tokenA='playera.'+'a'.repeat(43),tokenB='playerb.'+'b'.repeat(43);
 h.storage.set('bs_social_session',tokenA);h.storage.set('busraj-account-career-v6:playera',JSON.stringify(a));h.storage.set('busraj-account-career-v6:playerb',JSON.stringify(b));
 let finish,posted=false;
 h.context.fetch=async(_url,options={})=>{if(options.method==='POST'){posted=true;return new Promise(resolve=>{finish=()=>resolve(Response.json({username:'playera',career:Career.purchase(a,'pawn-jade'),access:{role:'player'}}))})}return Response.json({username:options.headers.authorization.includes('playerb')?'playerb':'playera',career:options.headers.authorization.includes('playerb')?b:a,access:{role:'player'}})};
 await h.runFile('assets/js/profile-core.js');await h.runFile('assets/js/career-client.js');await h.context.BS_CAREER.refresh();
 const operation=h.context.BS_CAREER.purchase('pawn-jade'),rejected=assert.rejects(operation,/account_changed/);
 for(let i=0;i<10&&!posted;i++)await flush();assert.equal(posted,true);
 h.storage.set('bs_social_session',tokenB);h.context.dispatchEvent({type:'bs-social-session'});finish();await rejected;await h.context.BS_CAREER.refresh();
 assert.equal(h.context.BS_CAREER.account(),'playerb');assert.equal(h.context.BS_CAREER.get().coins,222);assert.equal(h.context.BS_CAREER.get().owned.includes('pawn-jade'),false);
});
test('switching accounts while a guest storage lock waits cannot spend guest coins',async()=>{
 const h=await guest();let release;h.context.navigator.locks={request:(_key,callback)=>new Promise((resolve,reject)=>{release=()=>{try{resolve(callback())}catch(error){reject(error)}}})};
 const before=h.storage.get(KEY),operation=h.context.BS_CAREER.purchase('pawn-jade'),rejected=assert.rejects(operation,/account_changed/);
 for(let i=0;i<10&&!release;i++)await flush();h.storage.set('bs_social_session','playerb.'+'b'.repeat(43));release();await rejected;assert.equal(h.storage.get(KEY),before);
});
test('a displayed daily offer cannot silently charge the full price after Riyadh midnight',async()=>{
 const h=await createDOM('shop.html');let time=Date.parse('2026-10-12T20:59:59Z');const RealDate=Date;
 h.context.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[time]))}static now(){return time}};
 h.storage.set(KEY,JSON.stringify(Career.normalize({coins:5000})));await h.runFile('assets/js/profile-core.js');await h.runFile('assets/js/career-client.js');await h.context.BS_CAREER.refresh();await h.runFile('assets/js/shop.js');
 const offer=Career.dailyOffer(time),before=h.context.BS_CAREER.get(),opener=h.doc.querySelector('[data-item="'+offer.id+'"] .item-inspect');opener.onclick();const button=h.doc.getElementById('itemAction');assert.ok(button&&!button.disabled);
 time+=2000;assert.notEqual(Career.itemPrice(offer.id,time),Career.itemPrice(offer.id,time-2000));await button.onclick();
 assert.deepEqual(h.context.BS_CAREER.get(),before);assert.ok(h.doc.getElementById('storeMessage').textContent.includes('تغيّر سعر العرض'));
});
test('the inspector restores focus to the new connected opener after purchase and rerender',async()=>{
 const h=await guest();await h.runFile('assets/js/shop.js');const opener=h.doc.querySelector('[data-item="pawn-jade"] .item-inspect');opener.focus();opener.onclick();
 assert.equal(h.doc.querySelector('main').inert,true);assert.equal(h.doc.activeElement.id,'itemClose');await h.doc.getElementById('itemAction').onclick();assert.equal(opener.isConnected,false);
 h.doc.getElementById('itemClose').onclick();assert.equal(h.doc.querySelector('main').inert,false);assert.equal(h.doc.activeElement.isConnected,true);assert.equal(h.doc.activeElement.closest('[data-item]').dataset.item,'pawn-jade');assert.equal(h.doc.activeElement.dataset.control,'inspect');
});
test('inspector keyboard trap recovers escaped focus and Escape restores the page',async()=>{
 const h=await guest();await h.runFile('assets/js/shop.js');h.doc.querySelector('[data-item="snake-gold"] .item-inspect').onclick();h.doc.activeElement=h.doc.body;
 const tab={type:'keydown',key:'Tab',preventDefault(){this.prevented=true}};h.doc.dispatchEvent(tab);assert.equal(tab.prevented,true);assert.equal(h.doc.activeElement.id,'itemClose');
 h.doc.dispatchEvent({type:'keydown',key:'Escape',preventDefault(){}});assert.equal(h.doc.getElementById('itemDialog').classList.contains('hidden'),true);assert.equal(h.doc.activeElement.dataset.control,'inspect');
});
test('inventory exposes all equipped appearances and clear filters recovers empty results',async()=>{
 const h=await guest();await h.runFile('assets/js/shop.js');assert.equal(h.doc.querySelectorAll('[data-loadout]').length,9);
 for(const type of ['snake','character','pawn','dice','board','table','trail','victory','title'])assert.ok(h.doc.querySelector('[data-loadout="'+type+'"]'));
 h.doc.getElementById('storeSearch').dispatchEvent({type:'input',target:{value:'اسم غير موجود إطلاقا'}});assert.equal(h.doc.querySelectorAll('[data-item]').length,0);assert.equal(h.doc.getElementById('storeEmpty').classList.contains('hidden'),false);
 h.doc.getElementById('storeReset').onclick();assert.ok(h.doc.querySelectorAll('[data-item]').length>9);assert.equal(h.doc.getElementById('storeSearch').value,'');assert.equal(h.doc.activeElement.id,'storeSearch');
});
