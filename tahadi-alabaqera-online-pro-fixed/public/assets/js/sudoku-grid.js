import {SUDOKU_PEERS,sudokuConflicts} from './engines/sudoku-core.js';

// A single coordinate mapping for the local and online boards, independent of RTL text.
export function createSudokuGrid(container,{select,key}={}){
  const document=container.ownerDocument;
  container.replaceChildren();
  container.setAttribute('dir','ltr');
  return Array.from({length:81},(_,i)=>{
    const el=document.createElement('button'),value=document.createElement('span'),pencilGrid=document.createElement('span');
    el.type='button';el.className='sudoku-cell';el.dataset.cell=i;
    el.style.gridRow=String(Math.floor(i/9)+1);el.style.gridColumn=String(i%9+1);
    el.setAttribute('role','gridcell');el.setAttribute('aria-rowindex',Math.floor(i/9)+1);el.setAttribute('aria-colindex',i%9+1);
    value.className='sudoku-value';pencilGrid.className='sudoku-notes-grid';pencilGrid.setAttribute('aria-hidden','true');
    el.append(value,pencilGrid);el.onclick=()=>select?.(i);el.onkeydown=e=>key?.(e,i);container.append(el);
    return {el,value,pencilGrid,mask:-1};
  });
}

export function paintSudokuGrid(cells,{board,initial,selected=0,notes=[],checked=[],hint=null,disabled=false}){
  const conflicts=new Set([...sudokuConflicts(board),...checked].filter(i=>!initial[i]));
  const peers=new Set(SUDOKU_PEERS[selected]),selectedValue=board[selected];
  board.forEach((value,i)=>{
    const row=cells[i],r=Math.floor(i/9),c=i%9;
    row.el.className='sudoku-cell'+(initial[i]?' given':'')+(c===2||c===5?' block-right':'')+(r===2||r===5?' block-bottom':'')+(peers.has(i)?' peer':'')+(selectedValue&&value===selectedValue?' same':'')+(conflicts.has(i)?' conflict':'')+(i===selected?' selected':'')+(hint?.cell===i?' hint-cell':'');
    row.el.tabIndex=i===selected?0:-1;row.el.disabled=disabled;
    row.el.setAttribute('aria-selected',String(i===selected));row.el.setAttribute('aria-readonly',String(Boolean(initial[i])));
    row.el.setAttribute('aria-label',`صف ${r+1}، عمود ${c+1}، ${value?'رقم '+value:'فارغة'}${initial[i]?'، ثابت':''}${conflicts.has(i)?'، راجع إدخالك':''}`);
    row.value.textContent=value||'';
    const mask=value?0:notes[i]||0;
    row.pencilGrid.hidden=!mask;
    if(row.mask!==mask){row.mask=mask;row.pencilGrid.replaceChildren();if(mask)for(let n=1;n<=9;n++){const s=row.el.ownerDocument.createElement('span');s.textContent=mask&(1<<(n-1))?n:'';row.pencilGrid.append(s);}}
  });
  return {filled:board.filter(Boolean).length,conflicts:[...conflicts]};
}

export function sudokuEntryConflict(board,initial,cell,value){
  if(!Number.isInteger(cell)||cell<0||cell>=81||!Number.isInteger(value)||value<0||value>9||initial[cell])return true;
  return value>0&&SUDOKU_PEERS[cell].some(i=>board[i]===value);
}
export function sudokuKey(key){
  return String(key).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776));
}
