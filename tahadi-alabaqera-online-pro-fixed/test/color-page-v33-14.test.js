import test from 'node:test';import assert from 'node:assert/strict';import {createDOM,MiniElement} from './dom-harness.mjs';
import * as Colors from '../public/assets/js/engines/color-tables-v33-14.js';
async function page(){
 const h=await createDOM('colorbluff.html',Colors);const store=new Map();h.context.sessionStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
 h.doc.createTextNode=t=>{const n=new MiniElement('#text');n.textContent=t;return n;};h.context.createTable=options=>({menu:{setMode(){}},leave(){options.onMenu?.();},send(){return true;},again(){},options});
 await h.runFile('assets/js/color-table-page-v33-14.js');return h;
}
test('a shared phone conceals the color through both handoffs and shows only the current player decision',async()=>{
 const h=await page();h.doc.getElementById('ctLocal').value='pass';h.doc.getElementById('ctStart').click();
 assert.equal(h.doc.getElementById('ctCurtain').hidden,false);assert.equal(h.doc.getElementById('ctSecret').textContent,'');assert.equal(h.doc.querySelector('main').inert,true);
 h.doc.getElementById('ctReveal').click();assert.equal(h.doc.getElementById('ctCurtain').hidden,true);assert.equal(h.doc.querySelector('main').inert,false);
 const before=h.context.BS_COLOR_TABLE.state;assert.ok(Number.isInteger(before.secretColor));assert.ok(h.doc.getElementById('ctSecret').textContent.length>0);
 h.context.BS_COLOR_TABLE.action('color_claim',{color:before.secretColor});assert.equal(h.doc.getElementById('ctCurtain').hidden,false);assert.equal(h.doc.getElementById('ctSecret').textContent,'');assert.equal('secretColor' in h.context.BS_COLOR_TABLE.state,false);
 h.doc.getElementById('ctReveal').click();assert.equal(h.doc.getElementById('ctAnswer').hidden,false);assert.equal(h.doc.getElementById('ctColors').hidden,true);
 h.context.BS_COLOR_TABLE.action('color_answer',{answer:'trust'});assert.equal(h.context.BS_COLOR_TABLE.state.players[1].score,1);assert.equal(h.context.BS_COLOR_TABLE.state.turnNo,1);
 h.doc.getElementById('ctExit').click();assert.ok(h.doc.getElementById('game').classList.contains('hidden'));assert.equal(h.doc.querySelector('main').inert,false);
});
test('vault has a distinct playable local board and the correct capture controls',async()=>{
 const h=await page();h.doc.querySelector('[data-color-mode="vault"]').click();h.doc.getElementById('ctStart').click();
 assert.equal(h.context.BS_COLOR_TABLE.state.mode,'vault');assert.equal(h.doc.getElementById('ctBoard').children.length,24);
 assert.equal(h.doc.getElementById('ctBluff').hidden,true);assert.equal(h.doc.getElementById('ctVault').hidden,false);assert.equal(h.doc.getElementById('ctRoll').disabled,true,'opening memory preview must finish first');
});
