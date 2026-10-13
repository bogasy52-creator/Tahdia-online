import test from 'node:test';
import assert from 'node:assert/strict';
import {createDOM} from './dom-harness.mjs';
import {Career} from '../src/career/core.js';

async function store(){
 const h=await createDOM('shop.html');
 const events=new Map();h.context.addEventListener=(name,fn)=>{const list=events.get(name)||[];list.push(fn);events.set(name,list);};h.context.dispatchEvent=e=>{for(const fn of events.get(e.type)||[])fn(e);};
 await h.runFile('assets/js/profile-core.js');
 const p=Career.normalize({coins:1000});let account='first',calls=0;
 h.context.BS_CAREER={get:()=>p,catalog:Career.CATALOG,now:()=>Date.parse('2026-10-12'),account:()=>account,access:()=>({role:'player'}),purchase:async()=>{calls++;},equip:async()=>{calls++;}};
 await h.runFile('assets/js/shop.js');
 return {...h,profile:p,calls:()=>calls,account:value=>{account=value;h.context.dispatchEvent({type:'bs-career-change'});}};
}

test('Arabic search finds an item when hamza and vowel marks are omitted',async()=>{
 const h=await store(),search=h.doc.getElementById('storeSearch');
 search.value='افعى الشمس';search.dispatchEvent({type:'input',target:search});
 const cards=h.doc.querySelectorAll('.store-card');
 assert.equal(cards.length,1);assert.equal(cards[0].dataset.item,'snake-gold');
 search.value='أَفعى الشَّمـس';search.dispatchEvent({type:'input',target:search});
 assert.equal(h.doc.querySelectorAll('.store-card').length,1);
});

test('saving favourites is persistent and isolated between accounts without changing coins',async()=>{
 const h=await store(),before=JSON.stringify(h.profile);
 const favourite=h.doc.querySelector('[data-item="snake-gold"] .item-favorite');
 assert.ok(favourite,'each item needs a favourite control');favourite.onclick();
 h.doc.getElementById('storeTabs').dispatchEvent({type:'click',target:h.doc.querySelector('[data-filter="favorites"]')});
 assert.equal(h.doc.querySelectorAll('.store-card').length,1);
 assert.ok(h.storage.get('busraj-store-favorites-v13:first').includes('snake-gold'));
 h.account('second');assert.equal(h.doc.querySelectorAll('.store-card').length,0);
 h.account('first');assert.equal(h.doc.querySelectorAll('.store-card').length,1);
 assert.equal(JSON.stringify(h.profile),before);assert.equal(h.calls(),0);
});

test('snake inspection offers a real local trial without purchasing the skin',async()=>{
 const h=await store(),before=JSON.stringify(h.profile);
 h.doc.querySelector('[data-item="snake-gold"] .item-inspect').onclick();
 const trial=h.doc.getElementById('itemTry');assert.ok(trial,'trial must be available in inspection');
 assert.equal(trial.classList.contains('hidden'),false);
 assert.equal(trial.href,'/serpent?preview=snake-gold');
 h.doc.querySelector('[data-item="pawn-jade"] .item-inspect').onclick();
 assert.equal(trial.classList.contains('hidden'),true);
 assert.equal(JSON.stringify(h.profile),before);assert.equal(h.calls(),0);
});

test('opening equipped loadout clears incompatible search and rarity filters',async()=>{
 const h=await store(),rarity=h.doc.getElementById('storeRarity'),search=h.doc.getElementById('storeSearch');
 rarity.value='legendary';rarity.dispatchEvent({type:'change',target:rarity});
 search.value='افعى الشمس';search.dispatchEvent({type:'input',target:search});
 h.doc.querySelector('.loadout-item').onclick();
 assert.ok(h.doc.querySelector('[data-item="snake-wild"]'),'the equipped snake must be visible after opening its loadout');
 assert.equal(search.value,'');assert.equal(rarity.value,'all');
});
