import test from 'node:test';
import assert from 'node:assert/strict';
import {createDOM} from './dom-harness.mjs';
import {loadAtelier} from './atelier-harness.mjs';
import {Career} from '../src/career/core.js';
async function store(){const h=await createDOM('shop.html');let p=Career.normalize({coins:3000}),calls=0;h.context.BS_CAREER={get:()=>p,now:()=>Date.parse('2026-10-12'),purchase:async(id,options)=>{calls++;await Promise.resolve();p=Career.purchase(p,id,options)},equip:async id=>{calls++;p=Career.equip(p,id)}};await loadAtelier(h);return {...h,profile:()=>p,calls:()=>calls};}
test('inspection does not debit or equip and closes its native dialog',async()=>{
 const h=await store(),p=structuredClone(h.profile());h.doc.querySelector('[data-item="pawn-rook"] [data-control="inspect"]').onclick();assert.equal(h.calls(),0);assert.deepEqual(h.profile(),p);assert.equal(h.doc.getElementById('previewDialog').open,true);assert.equal(h.doc.getElementById('previewName').textContent,'الحصن');h.doc.getElementById('previewClose').onclick();assert.equal(h.doc.getElementById('previewDialog').open,false);
});
test('preview purchase debits once, equips once and updates ownership visibly',async()=>{
 const h=await store();h.doc.querySelector('[data-item="pawn-rook"] [data-control="inspect"]').onclick();const button=h.doc.getElementById('previewAction'),price=Career.itemPrice('pawn-rook');await Promise.all([button.onclick(),button.onclick()]);assert.equal(h.calls(),1);assert.equal(h.profile().coins,3000-price);assert.equal(h.profile().equipped.pawn,'pawn-rook');assert.match(h.doc.getElementById('previewOwnership').textContent,/مجهّزة/);
});
test('product cards and preview render the exact sculpted SVG rather than a generic picture',async()=>{
 const h=await store();h.doc.querySelector('[data-item="pawn-rook"] [data-control="inspect"]').onclick();assert.ok(h.doc.getElementById('previewArt').querySelector('[data-piece-design="rook"]'));assert.equal(h.doc.getElementById('previewArt').querySelector('canvas'),null);assert.equal(h.doc.getElementById('previewDialog').tagName,'DIALOG');assert.ok(h.doc.querySelector('[data-item="pawn-lotus"] [data-piece-design="lotus"]'));assert.equal(h.doc.querySelector('[data-item="snake-gold"]'),null);
});
