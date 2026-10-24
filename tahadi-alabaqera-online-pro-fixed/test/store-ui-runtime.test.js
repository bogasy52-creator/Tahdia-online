import {loadAtelier} from './atelier-harness.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createDOM} from './dom-harness.mjs';
import {Career} from '../src/career/core.js';
const now=Date.parse('2026-10-12T12:00:00Z');
async function store(profile=Career.normalize({coins:1000})){const h=await createDOM('shop.html');await h.runFile('assets/js/profile-core.js');let p=profile,calls=0;h.context.BS_CAREER={get:()=>p,catalog:Career.CATALOG,now:()=>now,account:()=>null,access:()=>({role:'player'}),purchase:async id=>{calls++;await Promise.resolve();p=Career.purchase(p,id,{now})},equip:async id=>{p=Career.equip(p,id)},bundle:async id=>{calls++;await Promise.resolve();p=Career.purchaseBundle(p,id,{now})},claim:async id=>{calls++;await Promise.resolve();p=Career.claimObjective(p,id,{now})}};await loadAtelier(h);return {...h,get:()=>p,calls:()=>calls}}
test('store shows actual bundles, earning progress and only accessible catalogue entries',async()=>{
 const h=await store(),shelf=new Set(Career.STOREFRONT),visible=Career.STOREFRONT.filter(id=>Career.CATALOG.find(i=>i.id===id).source!=='owner').length;
 assert.equal(h.doc.querySelectorAll('.atelier-set').length,Career.BUNDLES.filter(b=>b.items.every(id=>shelf.has(id))).length);assert.equal(h.doc.querySelectorAll('.atelier-product').length,visible);
 assert.ok(!h.doc.querySelector('[data-item="title-manager"]'));assert.equal(h.doc.getElementById('collectionCount').textContent,visible+' قطعة');assert.ok(h.doc.querySelector('[data-item="character-fox"]'));assert.ok(h.doc.querySelector('[data-item="pawn-monolith"]'));
 h.doc.querySelector('[data-view="rewards"]').onclick();assert.equal(h.doc.getElementById('rewardsSection').hidden,false);assert.equal(h.doc.querySelectorAll('.atelier-objective').length,12);
});
test('equipping a sculpture leaves unrelated legacy appearances and player preferences intact',async()=>{
 const h=await store(),character=h.get().equipped.character;h.storage.set('bs-piece-art','original');h.doc.querySelector('[data-item="pawn-rook"] [data-control="inspect"]').onclick();await h.doc.getElementById('previewAction').onclick();
 assert.equal(h.get().equipped.pawn,'pawn-rook');assert.equal(h.get().equipped.character,character);assert.equal(h.storage.get('bs-piece-art'),'original');
});
test('mission claim click credits once and updates the visible reward status',async()=>{
 let p=Career.normalize();for(let i=0;i<3;i++)p=Career.reward(p,{id:'ui:'+i,game:'snakes',win:true,now});const h=await store(p);h.doc.querySelector('[data-view="rewards"]').onclick();const button=h.doc.querySelector('[data-objective="daily-play"] button');
 assert.equal(button.disabled,false);const before=p.coins;await Promise.all([button.onclick(),button.onclick()]);assert.equal(h.calls(),1);assert.equal(h.get().coins,before+30);
 assert.ok(h.doc.querySelector('[data-objective="daily-play"]').textContent.includes('مستلمة'));
});
test('a new coordinated bundle buys its missing items once and equips its real materials',async()=>{
 const h=await store(Career.normalize({coins:5000})),button=h.doc.querySelector('[data-bundle="atelier-club"] button'),quote=Career.bundleQuote(h.get(),'atelier-club',{now});
 await Promise.all([button.onclick(),button.onclick()]);assert.equal(h.calls(),1);assert.equal(h.get().coins,5000-quote.price);
 assert.equal(h.doc.querySelector('[data-bundle="atelier-club"] button').textContent,'تجهيز المجموعة');
 assert.equal(h.get().equipped.pawn,'pawn-rook');assert.equal(h.get().equipped.dice,'dice-oxblood');assert.equal(h.get().equipped.trail,'trail-meteor');
});
test('authenticated cosmetics apply the actual die palette, trail and title to the game document',async()=>{
 const h=await createDOM('snakes.html');h.context.AbortSignal=AbortSignal;h.storage.set('bs_social_session','playera.'+'a'.repeat(43));
 const p=Career.normalize({owned:['dice-ruby','trail-plasma','title-champion'],equipped:{dice:'dice-ruby',trail:'trail-plasma',title:'title-champion'}});
 h.context.fetch=async()=>Response.json({username:'playera',career:p,access:{role:'player'},serverNow:Date.now()});await h.runFile('assets/js/profile-core.js');await h.runFile('assets/js/career-client.js');await h.context.BS_CAREER.refresh();
 assert.equal(h.doc.documentElement.dataset.dice,'dice-ruby');assert.equal(h.doc.documentElement.style['--die-pip'],'#fff3e0');assert.equal(h.doc.documentElement.dataset.trail,'trail-plasma');assert.equal(h.doc.documentElement.style['--trail-color'],'#e777ff');
});
test('manager UI relies on the server and does not trust a bosrag token prefix',async()=>{
 const h=await createDOM('admin.html');h.context.AbortSignal=AbortSignal;h.storage.set('bs_social_session','bosrag.'+'x'.repeat(43));h.context.fetch=async()=>Response.json({error:'unauthorized'},{status:401});
 await h.runFile('assets/js/admin.js');await h.context.BS_ADMIN.ready;assert.equal(h.doc.getElementById('adminWorkspace').classList.contains('hidden'),true);assert.ok(h.doc.getElementById('adminAccessMessage').textContent.includes('الدخول'));
});
test('manager form sends a unique audited operation and shows the returned server balance',async()=>{
 const h=await createDOM('admin.html');h.context.AbortSignal=AbortSignal;h.storage.set('bs_social_session','bosrag.'+'x'.repeat(43));await h.runFile('assets/js/profile-core.js');const sent=[];
 const account={profile:{username:'playera',displayName:'لاعب'},career:Career.normalize({coins:350}),suspended:false};
 h.context.fetch=async(url,options={})=>{if(url.includes('/action')){sent.push(JSON.parse(options.body));return Response.json({ok:true,account})}if(url.includes('/account'))return Response.json({ok:true,account});return Response.json({ok:true,access:{role:'owner'},audit:[]})};
 await h.runFile('assets/js/admin.js');await h.context.BS_ADMIN.ready;h.doc.getElementById('adminUsername').value='playera';await h.context.BS_ADMIN.search();
 h.doc.getElementById('adminAction').value='coins';h.doc.getElementById('adminAmount').value='250';await h.doc.getElementById('adminActionForm').onsubmit({preventDefault(){}});
 assert.equal(sent.length,1);assert.equal(sent[0].amount,250);assert.ok(sent[0].requestId.length>8);assert.ok(h.doc.getElementById('adminAccount').textContent.includes('350'));
});
test('manager retries a lost response with the same durable operation ID',async()=>{
 const h=await createDOM('admin.html');h.context.AbortSignal=AbortSignal;h.storage.set('bs_social_session','bosrag.'+'x'.repeat(43));await h.runFile('assets/js/profile-core.js');const sent=[];let lost=true;
 const account={profile:{username:'playera',displayName:'لاعب'},career:Career.normalize({coins:350}),suspended:false};
 h.context.fetch=async(url,options={})=>{if(url.includes('/action')){sent.push(JSON.parse(options.body));if(lost){lost=false;throw new TypeError('connection lost')}return Response.json({ok:true,account,replayed:true})}if(url.includes('/account'))return Response.json({ok:true,account});return Response.json({ok:true,access:{role:'owner'},audit:[]})};
 await h.runFile('assets/js/admin.js');await h.context.BS_ADMIN.ready;h.doc.getElementById('adminUsername').value='playera';await h.context.BS_ADMIN.search();h.doc.getElementById('adminAmount').value='250';
 await h.doc.getElementById('adminActionForm').onsubmit({preventDefault(){}});assert.equal(h.doc.getElementById('adminRetry').classList.contains('hidden'),false);
 await h.doc.getElementById('adminRetry').onclick();assert.equal(sent.length,2);assert.equal(sent[1].requestId,sent[0].requestId);assert.equal(h.storage.has('busraj-admin-pending-v11:bosrag'),false);
});
test('online victory refreshes server rewards and displays the equipped title without sending a practice result',async()=>{
 const h=await createDOM('snakes.html');await h.runFile('assets/js/profile-core.js');let posts=0;
 const before=Career.normalize({owned:['title-champion'],equipped:{title:'title-champion'}}),after=Career.reward(before,{id:'board:verified',game:'snakes',win:true,verified:true});
 h.context.BS_CAREER={get:()=>before,record:()=>{posts++},refresh:async()=>after};await h.runFile('assets/js/pro-experience.js');await h.context.BS_PRO.onlineResult(true);
 assert.equal(posts,0);assert.ok(h.doc.querySelector('.winner-reward').textContent.includes('+50'));assert.equal(h.doc.querySelector('.winner-card .career-title').textContent,'بطل الحلبة');assert.ok(h.doc.querySelector('.winner-missions').href.includes('/shop'));
});
test('equipped royal victory creates gold stars and respects reduced motion',async()=>{
 const h=await createDOM('snakes.html'),made=[];const create=h.doc.createElement;h.doc.createElement=tag=>{const e=create(tag);made.push(e);return e};h.context.matchMedia=()=>({matches:false});h.doc.documentElement.dataset.victory='victory-royal';await h.runFile('assets/js/pro-experience.js');h.context.BS_PRO.confetti();assert.equal(made.filter(e=>e.classList.contains('victory-star')).length,48);
 const count=made.length;h.context.matchMedia=()=>({matches:true});h.context.BS_PRO.confetti();assert.equal(made.length,count);
});
