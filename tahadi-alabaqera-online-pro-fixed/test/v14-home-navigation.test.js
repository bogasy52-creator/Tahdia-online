import test from 'node:test';
import assert from 'node:assert/strict';
import {createDOM} from './dom-harness.mjs';
async function home(){const h=await createDOM('index.html');await h.runFile('assets/js/home-v14.js');return h}
test('Arabic game search and categories combine and empty results can be reset',async()=>{
 // 33.7.0: twenty games with «تيربو كارت»
 const h=await home();assert.equal(h.doc.querySelectorAll('.home-game').filter(card=>!card.classList.contains('hidden')).length,21);
 h.doc.getElementById('gameSearch').value='الذَاكـرة';h.doc.getElementById('gameSearch').dispatchEvent({type:'input'});assert.equal(h.doc.querySelectorAll('.home-game').filter(card=>!card.classList.contains('hidden')).length,1);
 h.doc.getElementById('gameFilters').dispatchEvent({type:'click',target:h.doc.querySelector('[data-category="friends"]')});assert.equal(h.doc.getElementById('gameEmpty').classList.contains('hidden'),false);
 h.doc.getElementById('gameReset').onclick();assert.equal(h.doc.querySelectorAll('.home-game').filter(card=>!card.classList.contains('hidden')).length,21);assert.equal(h.doc.activeElement.id,'gameSearch');
});
test('the home page opens on the games: no room box, no unnamed online panel (33.4.0)',async()=>{
 const h=await home();
 for(const id of ['homeQuickPlay','homeRoomJoin','homeRoomCode'])assert.equal(h.doc.getElementById(id),null,id);
 assert.equal(h.doc.querySelector('.home-companion'),null);
 assert.equal(h.doc.querySelector('.bs-party-entry-v29'),null,'the party room is a card among the games now');
 assert.ok(h.doc.querySelector('.home-game[href="/party"]'));
});
test('last-game links only remember known game routes',async()=>{
 const h=await home();h.doc.querySelector('.home-serpent').click();assert.equal(h.storage.get('tahdia-last-game-v14'),'/serpent');
 const restored=await createDOM('index.html');restored.storage.set('tahdia-last-game-v14','javascript:alert(1)');await restored.runFile('assets/js/home-v14.js');assert.equal(restored.doc.getElementById('lastGame').classList.contains('hidden'),true);
});
