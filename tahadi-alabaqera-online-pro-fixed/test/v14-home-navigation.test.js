import test from 'node:test';
import assert from 'node:assert/strict';
import {createDOM} from './dom-harness.mjs';
async function home(){const h=await createDOM('index.html');h.context.TahdiaMatchmaking={join:async()=>{}};await h.runFile('assets/js/home-v14.js');return h}
test('Arabic game search and categories combine and empty results can be reset',async()=>{
 const h=await home();assert.equal(h.doc.querySelectorAll('.home-game').filter(card=>!card.classList.contains('hidden')).length,19);
 h.doc.getElementById('gameSearch').value='الذَاكـرة';h.doc.getElementById('gameSearch').dispatchEvent({type:'input'});assert.equal(h.doc.querySelectorAll('.home-game').filter(card=>!card.classList.contains('hidden')).length,1);
 h.doc.getElementById('gameFilters').dispatchEvent({type:'click',target:h.doc.querySelector('[data-category="friends"]')});assert.equal(h.doc.getElementById('gameEmpty').classList.contains('hidden'),false);
 h.doc.getElementById('gameReset').onclick();assert.equal(h.doc.querySelectorAll('.home-game').filter(card=>!card.classList.contains('hidden')).length,19);assert.equal(h.doc.activeElement.id,'gameSearch');
});
test('quick matching ignores duplicate clicks and unlocks after failure',async()=>{
 const h=await home();let calls=0,reject;h.context.TahdiaMatchmaking.join=()=>{calls++;return new Promise((_resolve,fail)=>{reject=fail})};const button=h.doc.getElementById('homeQuickPlay');
 const first=button.onclick();await button.onclick();assert.equal(calls,1);assert.equal(button.disabled,true);reject(new Error('offline'));await first;assert.equal(button.disabled,false);assert.equal(button.getAttribute('aria-busy'),'false');
});
test('last-game links only remember known game routes',async()=>{
 const h=await home();h.doc.querySelector('.home-serpent').click();assert.equal(h.storage.get('tahdia-last-game-v14'),'/serpent');
 const restored=await createDOM('index.html');restored.storage.set('tahdia-last-game-v14','javascript:alert(1)');await restored.runFile('assets/js/home-v14.js');assert.equal(restored.doc.getElementById('lastGame').classList.contains('hidden'),true);
});
