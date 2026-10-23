import test from 'node:test';import assert from 'node:assert/strict';
import {createDOM} from './dom-harness.mjs';import{markSudokuError,clearSudokuError}from'../public/assets/js/sudoku-feedback-v29-1.js';
test('reduced motion and disabled optional effects keep the red Sudoku error; a retry replaces its expiry',async()=>{
 const h=await createDOM('sudoku.html',{matchMedia:()=>({matches:true})}),sounds=[],cell=h.doc.createElement('button');h.context.BS_AUDIO={getSettings:()=>({effects:false,muted:true}),play:name=>sounds.push(name)};
 h.doc.body.appendChild(cell);markSudokuError(cell,h.context);markSudokuError(cell,h.context);
 assert.equal(cell.dataset.sudokuError,'true');assert.equal(cell.getAttribute('aria-invalid'),'true');assert.equal(cell.classList.contains('sudoku-error-pulse'),false);
 assert.equal([...h.timers.values()].filter(t=>t.ms===1100).length,1);assert.deepEqual(sounds,['buzzer','buzzer']);
 clearSudokuError(cell,h.context);assert.equal(cell.dataset.sudokuError,undefined);assert.equal([...h.timers.values()].filter(t=>t.ms===1100).length,0);
});
test('clearing a flash preserves an existing invalid entry and never edits the number',async()=>{
 const h=await createDOM('sudoku.html'),cell=h.doc.createElement('button');cell.textContent='8';cell.classList.add('conflict');markSudokuError(cell,h.context);
 [...h.timers.values()].find(t=>t.ms===1100).fn();assert.equal(cell.getAttribute('aria-invalid'),'true');assert.equal(cell.textContent,'8');assert.equal(cell.dataset.sudokuError,undefined);
});
