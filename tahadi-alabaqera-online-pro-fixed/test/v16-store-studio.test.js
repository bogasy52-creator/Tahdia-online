import test from 'node:test';
import assert from 'node:assert/strict';
import {createDOM} from './dom-harness.mjs';
import {loadAtelier} from './atelier-harness.mjs';
import {Career} from '../src/career/core.js';
async function store(){const h=await createDOM('shop.html');h.storage.set('busraj-career-v6',JSON.stringify(Career.normalize({coins:2000})));await h.runFile('assets/js/profile-core.js');await h.runFile('assets/js/career-client.js');await h.context.BS_CAREER.refresh();await loadAtelier(h);return {...h,$:id=>h.doc.getElementById(id)};}
test('all six pawn previews offer every player colour using the actual sculpture',async()=>{
 const h=await store();for(const item of Career.COLLECTION.filter(i=>i.type==='pawn')){h.doc.querySelector('[data-item="'+item.id+'"] [data-control="inspect"]').onclick();const buttons=h.$('previewOptions').querySelectorAll('button');assert.equal(buttons.length,6);for(const button of buttons){assert.ok(button.getAttribute('aria-label'));button.onclick();assert.equal(h.$('previewArt').querySelectorAll('[data-piece-design]').length,1);assert.equal(h.$('previewArt').querySelector('[data-piece-design]').dataset.pieceDesign,h.context.BS_PIECES.designFor(item.id));}}
});
test('live dice preview uses a real six-face roll without buying the die',async()=>{
 const h=await store(),before=structuredClone(h.context.BS_CAREER.get());h.doc.querySelector('[data-item="dice-oxblood"] [data-control="inspect"]').onclick();const art=h.$('previewArt'),die=art.querySelector('.die');assert.equal(die.querySelectorAll('.pro-face').length,6);assert.equal(die.querySelectorAll('.pro-pip').length,21);await h.$('previewOptions').querySelector('button').onclick();assert.ok(Number(die.dataset.value)>=1&&Number(die.dataset.value)<=6);assert.equal(art.querySelector('.atelier-preview').style['--die-color'],Career.COSMETIC_STYLES['dice-oxblood']['--die-color']);assert.deepEqual(h.context.BS_CAREER.get(),before);
});
test('checkout failure is visible within the dialog and removing an item retains focus',async()=>{
 const h=await store();for(const id of ['pawn-rook','dice-smoke'])h.doc.querySelector('[data-item="'+id+'"] .atelier-add').onclick();h.$('bagOpen').onclick();const before=h.context.BS_CAREER.get().coins;h.context.BS_CAREER.cart=async()=>{throw Error('checkout_conflict')};await h.$('bagCheckout').onclick();assert.match(h.$('bagMessage').textContent,/تغيّرت السلة/);assert.equal(h.$('bagDialog').open,true);assert.equal(h.context.BS_CAREER.get().coins,before);const remove=h.$('bagItems').querySelector('.atelier-bag-remove');remove.focus();remove.onclick();assert.equal(h.doc.activeElement.className,'atelier-bag-remove');assert.equal(h.$('bagCount').textContent,'1');
});
