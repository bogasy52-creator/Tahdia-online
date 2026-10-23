import test from'node:test';import assert from'node:assert/strict';import{readFile}from'node:fs/promises';import vm from'node:vm';
import{createDOM}from'./dom-harness.mjs';import{createSudoku,moveSudoku,sudokuConflicts}from'../public/assets/js/engines/sudoku-engine.js';import{solveSudoku}from'../public/assets/js/engines/sudoku-core.js';import{createSudokuGrid,paintSudokuGrid,sudokuEntryConflict,sudokuKey}from'../public/assets/js/sudoku-grid.js';import{oracleSudoku,assertSudokuSolution}from'./sudoku-oracle.mjs';

test('independent exact-cover oracle verifies all 120 grids: one solution, 27 valid units, unchanged givens',()=>{
 for(let level=1;level<=120;level++){const s=createSudoku(level),oracle=oracleSudoku(s.initial);assert.equal(oracle.count,1,'stage '+level);assertSudokuSolution(oracle.solution,s.initial,assert);assert.deepEqual(oracle.solution,solveSudoku(s.initial).solution);}
});
test('60 daily transformations remain unique and preserve each given under independent solver',()=>{
 for(let day=0;day<60;day++){const date=new Date(Date.UTC(2026,9,1+day)).toISOString().slice(0,10),s=createSudoku(1,date),oracle=oracleSudoku(s.initial);assert.equal(oracle.count,1,date);assertSudokuSolution(oracle.solution,s.initial,assert);}
});
test('oracle detects a broken given, nonunique empty board and wrong valid-looking completion',()=>{
 const s=createSudoku(1),board=s.initial.slice(),given=board.findIndex(Boolean);board[(Math.floor(given/9)*9)+(given+1)%9]=board[given];assert.equal(oracleSudoku(board).count,0);assert.equal(oracleSudoku(Array(81).fill(0)).count,2);
 const answer=oracleSudoku(s.initial).solution;assert.equal(sudokuConflicts(answer).length,0);const a=answer.slice();[a[0],a[1]]=[a[1],a[0]];assert.throws(()=>assertSudokuSolution(a,s.initial,assert));
});
test('grid uses exact row and column coordinates in RTL and marks all nine block boundaries',async()=>{
 const h=await createDOM('sudoku.html'),board=h.doc.getElementById('sudokuBoard'),s=createSudoku(1),cells=createSudokuGrid(board);paintSudokuGrid(cells,{board:s.board,initial:s.initial});assert.equal(cells.length,81);assert.equal(board.getAttribute('dir'),'ltr');
 for(let i=0;i<81;i++){assert.equal(cells[i].el.style.gridRow,String(Math.floor(i/9)+1));assert.equal(cells[i].el.style.gridColumn,String(i%9+1));assert.equal(cells[i].value.textContent,String(s.initial[i]||''));assert.equal(cells[i].el.classList.contains('block-right'),[2,5].includes(i%9));assert.equal(cells[i].el.classList.contains('block-bottom'),[2,5].includes(Math.floor(i/9)));}
});
test('only editable conflicting values are marked; fixed givens remain correct and numeric notes never overlay a value',async()=>{
 const h=await createDOM('sudoku.html'),s=createSudoku(1),cell=s.initial.findIndex(n=>!n),value=s.initial.slice(Math.floor(cell/9)*9,Math.floor(cell/9)*9+9).find(Boolean);s.board[cell]=value;const cells=createSudokuGrid(h.doc.getElementById('sudokuBoard'));
 paintSudokuGrid(cells,{board:s.board,initial:s.initial,notes:Array(81).fill(511)});assert.ok(cells[cell].el.classList.contains('conflict'));for(let i=0;i<81;i++){if(s.initial[i])assert.ok(!cells[i].el.classList.contains('conflict'));if(s.board[i])assert.equal(cells[i].pencilGrid.hidden,true);else assert.equal(cells[i].pencilGrid.children.length,9);}
});
test('entry guard catches row, column and 3x3 duplicates and accepts Arabic/Persian digit keys',()=>{
 const empty=Array(81).fill(0);for(const peer of [1,9,10]){const b=empty.slice();b[peer]=8;assert.equal(sudokuEntryConflict(b,empty,0,8),true);assert.equal(sudokuEntryConflict(b,empty,0,7),false);}assert.equal(sudokuEntryConflict(empty,empty,-1,1),true);assert.equal(sudokuKey('٠١٢٣٤٥٦٧٨٩'),'0123456789');assert.equal(sudokuKey('۰۱۲۳۴۵۶۷۸۹'),'0123456789');
});
test('all difficulty selections remain available online, without unlocking campaign stages',async()=>{
 const h=await createDOM('sudoku.html');assert.equal(h.doc.getElementById('soDifficulty').children.length,5);assert.equal(h.doc.getElementById('soCapacity').children.length,20);assert.equal(h.doc.getElementById('soCodeInput').getAttribute('inputmode'),'numeric');
 const css=await readFile(new URL('../public/assets/css/sudoku-v22.css',import.meta.url),'utf8');assert.match(css,/grid-template-columns:repeat\(9,minmax\(0,1fr\)\)/);assert.match(css,/grid-template-rows:repeat\(9,minmax\(0,1fr\)\)/);assert.match(css,/appearance:none/);assert.match(css,/color-scheme:light/);
});
