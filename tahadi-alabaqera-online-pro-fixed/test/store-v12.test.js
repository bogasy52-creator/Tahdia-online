import test from 'node:test';
import assert from 'node:assert/strict';
import {createDOM} from './dom-harness.mjs';
import {Career} from '../src/career/core.js';
async function store(){const h=await createDOM('shop.html');await h.runFile('assets/js/profile-core.js');let p=Career.normalize({coins:3000}),calls=0;h.context.BS_CAREER={get:()=>p,catalog:Career.CATALOG,now:()=>Date.parse('2026-10-12'),access:()=>({role:'player'}),purchase:async id=>{calls++;await Promise.resolve();p=Career.purchase(p,id)},equip:async id=>{calls++;p=Career.equip(p,id)}};await h.runFile('assets/js/shop.js');return {...h,profile:()=>p,calls:()=>calls};}
test('inspecting an item does not debit or equip and shows the actual item',async()=>{
 const h=await store(),p=h.profile(),inspect=h.doc.querySelector('[data-item="snake-gold"] .item-inspect');assert.ok(inspect,'store must expose inspection');inspect.onclick();
 assert.equal(h.calls(),0);assert.equal(h.profile().coins,p.coins);assert.equal(h.profile().equipped.snake,'snake-wild');assert.equal(h.doc.getElementById('itemDialog').classList.contains('hidden'),false);assert.equal(h.doc.getElementById('itemName').textContent,'أفعى الشمس');
 h.doc.getElementById('itemClose').onclick();assert.equal(h.doc.getElementById('itemDialog').classList.contains('hidden'),true);
});
test('the inspection purchase uses the real store API once and updates ownership',async()=>{
 const h=await store(),inspect=h.doc.querySelector('[data-item="pawn-jade"] .item-inspect');assert.ok(inspect);inspect.onclick();const btn=h.doc.getElementById('itemAction');await Promise.all([btn.onclick(),btn.onclick()]);
 assert.equal(h.calls(),1);assert.equal(h.profile().coins,2880);assert.equal(h.profile().equipped.pawn,'pawn-jade');assert.ok(h.doc.getElementById('itemOwnership').textContent.includes('مجهّز'));
});
test('store cards and inspection use a static image without a canvas or native-dialog dependency',async()=>{
 const h=await store();h.doc.querySelector('[data-item="pawn-jade"] .item-inspect').onclick();
 const image=h.doc.getElementById('itemArt').querySelector('img');assert.ok(image);assert.equal(image.src,'assets/previews/pawn-jade.webp');
 assert.equal(h.doc.getElementById('itemArt').querySelector('canvas'),null);assert.equal(h.doc.getElementById('itemDialog').tagName,'DIV');
 assert.equal(h.doc.querySelector('[data-item="snake-gold"] img').src,'assets/previews/snake-gold.webp');
});
