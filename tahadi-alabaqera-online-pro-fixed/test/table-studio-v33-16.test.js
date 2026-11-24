import test from 'node:test';
import assert from 'node:assert/strict';
import {createDOM} from './dom-harness.mjs';

test('changing a table preserves the live board and score, saves per game, and returns focus',async()=>{
  for(const page of ['jewels','memory','puzzle','logic','dice','blocks']){
    const h=await createDOM(page+'.html');
    const board=h.doc.getElementById(page==='blocks'?'bkBoard':page==='jewels'?'jwWrap':'arena')||h.doc.getElementById('game');
    const score=h.doc.getElementById(page==='blocks'?'bkScore':page==='jewels'?'jwMovesText':'score');
    if(score)score.textContent='123';
    const before=board?.innerHTML;
    const events=[];h.context.addEventListener('bs:table-change',e=>events.push(e.detail.id));
    await h.runFile('assets/js/table-studio-v33-16.js');
    const trigger=h.doc.querySelector('.ts-trigger');assert.ok(trigger,page);
    trigger.dispatchEvent({type:'click',target:trigger,currentTarget:trigger});
    const dialog=h.doc.querySelector('dialog.ts-dialog');assert.equal(dialog.open,true,page);
    const choices=dialog.querySelectorAll('[data-table-choice]');assert.equal(choices.length,6);
    const jade=choices.find(input=>input.value==='jade');jade.checked=true;jade.dispatchEvent({type:'change'});
    assert.equal(h.doc.documentElement.dataset.tableStudio,'jade');
    assert.equal(h.storage.get('bs_table_studio_v1:'+page),'jade');
    assert.equal(choices.filter(input=>input.checked).length,1);
    assert.equal(events.at(-1),'jade');
    assert.equal(board?.innerHTML,before,'a finish does not rebuild the game board');
    if(score)assert.equal(score.textContent,'123');
    dialog.querySelector('.ts-done').click();assert.equal(dialog.open,false);assert.equal(h.doc.activeElement,trigger);
    const restored=await createDOM(page+'.html');restored.storage.set('bs_table_studio_v1:'+page,'jade');
    await restored.runFile('assets/js/table-studio-v33-16.js');
    assert.equal(restored.doc.documentElement.dataset.tableStudio,'jade');
  }
});

test('unavailable or invalid saved preferences keep the game usable with a valid finish',async()=>{
  for(const blocked of [false,true]){
    const h=await createDOM('memory.html');h.storage.set('bs_table_studio_v1:memory','invalid-table');
    if(blocked)h.context.localStorage={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
    await h.runFile('assets/js/table-studio-v33-16.js');
    assert.equal(h.doc.documentElement.dataset.tableStudio,'royal');
    const trigger=h.doc.querySelector('.ts-trigger');trigger.dispatchEvent({type:'click',currentTarget:trigger});
    const radio=h.doc.querySelectorAll('[data-table-choice]').find(input=>input.value==='obsidian');
    radio.checked=true;radio.dispatchEvent({type:'change'});
    assert.equal(h.doc.documentElement.dataset.tableStudio,'obsidian');
  }
});
