import test from 'node:test';
import assert from 'node:assert/strict';
import {createDOM} from './dom-harness.mjs';
import {loadAtelier} from './atelier-harness.mjs';
import {Career} from '../src/career/core.js';
async function store(){
 const h=await createDOM('shop.html');let account='first',calls=0;const p=Career.normalize({coins:1000});
 h.context.BS_CAREER={get:()=>p,now:()=>Date.parse('2026-10-12'),account:()=>account,purchase:async()=>{calls++},equip:async()=>{calls++}};
 await loadAtelier(h);return {...h,profile:p,calls:()=>calls,account:value=>{account=value;h.context.dispatchEvent({type:'bs-career-change'})}};
}
test('Arabic search tolerates hamza, vowel marks and tatweel',async()=>{
 const h=await store(),search=h.doc.getElementById('collectionSearch');
 for(const value of ['اطلس','أَطـلَس']){search.value=value;search.dispatchEvent({type:'input',target:search});const cards=h.doc.querySelectorAll('.atelier-product');assert.equal(cards.length,1);assert.equal(cards[0].dataset.item,'pawn-atlas');}
});
test('favourites persist per account without spending or equipping',async()=>{
 const h=await store(),before=JSON.stringify(h.profile);h.doc.querySelector('[data-item="pawn-rook"] .atelier-favorite').onclick();
 h.doc.getElementById('collectionFilters').onclick({target:h.doc.querySelector('[data-filter="favorites"]')});
 assert.equal(h.doc.querySelectorAll('.atelier-product').length,1);assert.ok(h.storage.get('atelier30:favorites:first').includes('pawn-rook'));
 h.account('second');assert.equal(h.doc.querySelectorAll('.atelier-product').length,0);h.account('first');assert.equal(h.doc.querySelectorAll('.atelier-product').length,1);assert.equal(JSON.stringify(h.profile),before);assert.equal(h.calls(),0);
});
test('table preview changes the actual game geometry and seat count without purchasing',async()=>{
 const h=await store(),before=JSON.stringify(h.profile);h.doc.querySelector('[data-item="table-gallery"] [data-control="inspect"]').onclick();const art=h.doc.getElementById('previewArt'),options=h.doc.getElementById('previewOptions');
 assert.equal(art.querySelectorAll('[data-track]').length,52);assert.equal(art.querySelector('[data-material]').dataset.material,'ivory');options.querySelector('[data-board-game="zahra"]').onclick();assert.equal(art.querySelector('[data-game]').dataset.game,'zahra');options.children[2].onclick();assert.equal(art.querySelectorAll('[data-track]').length,78);assert.equal(art.querySelectorAll('[data-stone]').length,24);assert.equal(h.calls(),0);assert.equal(JSON.stringify(h.profile),before);
});
test('loadout opens an exact preview even when collection search has no results',async()=>{
 const h=await store(),search=h.doc.getElementById('collectionSearch');search.oninput({target:{value:'غير موجود'}});assert.equal(h.doc.querySelectorAll('.atelier-product').length,0);h.doc.querySelector('[data-loadout="pawn"]').onclick();assert.equal(h.doc.getElementById('previewName').textContent,'أطلس');assert.equal(h.doc.getElementById('previewDialog').open,true);assert.ok(h.doc.getElementById('previewArt').querySelector('[data-piece-design="spire"]'));
});
