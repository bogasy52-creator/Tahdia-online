import test from 'node:test';
import assert from 'node:assert/strict';
import {createDOM} from './dom-harness.mjs';
import {loadAtelier} from './atelier-harness.mjs';
import {Career} from '../src/career/core.js';
const now=Date.parse('2026-10-24T12:00:00Z');

async function shop(profile=Career.normalize({coins:3000}),globals={}){
 const h=await createDOM('shop.html',globals);let p=profile,calls=0;
 h.context.BS_CAREER={get:()=>p,now:()=>now,account:()=>null,purchase:async(id,o)=>{calls++;p=Career.purchase(p,id,{now,...o});h.context.dispatchEvent({type:'bs-career-change'});},equip:async id=>{p=Career.equip(p,id);},bundle:async(id,o)=>{p=Career.purchaseBundle(p,id,{now,...o});},cart:async(ids,o)=>{p=Career.purchaseCart(p,ids,{now,...o});},claim:async()=>{},daily:async()=>{}};
 await loadAtelier(h);return {...h,get:()=>p,calls:()=>calls,$:id=>h.doc.getElementById(id)};
}

test('character preview keeps one original image and attaches effect controls to it',async()=>{
 const h=await shop();await h.runFile('assets/js/hero-effects.js');
 h.doc.querySelector('[data-item="character-cat"] [data-control="inspect"]').click();const art=h.$('previewArt'),original=art.querySelector('.sx-character-art');
 assert.equal(h.$('previewDialog').open,true);assert.equal(original.src,Career.heroArt('cat'));assert.equal(art.querySelectorAll('img').length,1);assert.equal(h.doc.querySelectorAll('.hero-rig,.hero-arm,.hero-leg').length,0);
 const controls=h.doc.querySelectorAll('.hero-signature-controls button');assert.equal(controls.length,3);controls[1].click();assert.equal(art.querySelector('.hero-preview-overlay').dataset.pose,'move');assert.equal(art.querySelector('.sx-character-art'),original);controls[2].click();assert.equal(art.querySelectorAll('.hero-preview-overlay').length,1);assert.equal(art.querySelector('.hero-preview-overlay').dataset.pose,'win');assert.equal(art.querySelectorAll('img').length,1);
 assert.ok(h.doc.querySelector('.hero-signature-sound'));assert.doesNotMatch(h.$('previewOptions').textContent,/رقصة|المشي/);
 h.doc.querySelector('[data-item="character-robot"] [data-control="inspect"]').click();assert.equal(h.doc.querySelectorAll('.hero-signature-panel').length,1);assert.equal(h.$('previewArt').querySelector('.sx-character-art').src,Career.heroArt('robot'));h.$('previewDialog').close();assert.equal(h.doc.querySelectorAll('.hero-signature-panel').length,0);
});

test('reactions are sold in their own shelves and stay owned without taking a slot',async()=>{
 const h=await shop();
 for(const type of ['emote','phrase','move'])assert.ok(h.doc.querySelector('[data-section="'+type+'"]'),type);
 const card=h.doc.querySelector('[data-item="emote-crown"]');assert.ok(card.classList.contains('tier-legendary'));
 const before=structuredClone(h.get().equipped);await card.querySelector('[data-control="buy"]').onclick();
 assert.equal(h.calls(),1);assert.equal(h.get().coins,3000-Career.itemPrice('emote-crown',now));assert.ok(h.get().owned.includes('emote-crown'));assert.deepEqual(h.get().equipped,before);
 const after=h.doc.querySelector('[data-item="emote-crown"] [data-control="buy"]');assert.equal(after.textContent,'مملوك');assert.equal(after.disabled,true);
 assert.match(h.$('shopMessage').textContent,/زر التفاعل/);
});

test('a link from the game opens the matching shelf and the rail shows each count',async()=>{
 const h=await shop(undefined,{location:{search:'?filter=move',href:'https://game.test/shop?filter=move',pathname:'/shop',hash:'#collection',origin:'https://game.test'}});
 const sections=h.doc.querySelectorAll('[data-section]');assert.equal(sections.length,1);assert.equal(sections[0].dataset.section,'move');
 assert.equal(h.doc.querySelectorAll('.atelier-product').length,Career.REACTIONS.filter(i=>i.type==='move'&&!i.source).length);
 const rail=h.doc.querySelector('[data-filter="move"]');assert.equal(rail.getAttribute('aria-pressed'),'true');assert.match(rail.textContent,/حركات/);
});

test('the daily offer is the hero, priced at the offer and bought at that price',async()=>{
 const h=await shop(),offer=Career.dailyOffer(now),item=Career.CATALOG.find(i=>i.id===offer.id);
 const hero=h.$('shopHero');assert.equal(hero.dataset.offer,offer.id);assert.match(hero.textContent,new RegExp(item.name));assert.match(hero.textContent,new RegExp(String(offer.price)));assert.match(hero.textContent,/يتجدد العرض بعد/);
 await hero.querySelector('[data-offer-action="buy"]').onclick();assert.equal(h.get().coins,3000-offer.price);assert.ok(h.get().owned.includes(offer.id));
});

test('the manager sees the manager snake and move; a player never does',async()=>{
 const player=await shop();for(const id of ['snake-sovereign','move-sovereign','title-manager'])assert.ok(!player.doc.querySelector('[data-item="'+id+'"]'),id);
 const owner=await shop(Career.normalize({coins:10,owned:Career.CATALOG.map(i=>i.id)}));for(const id of ['snake-sovereign','move-sovereign','title-manager'])assert.ok(owner.doc.querySelector('[data-item="'+id+'"]'),id);
 assert.ok(owner.doc.querySelector('[data-item="snake-sovereign"] img'));
});
