// Original Sudoku rules and solver. No network or third-party puzzle corpus.
export const SUDOKU_UNITS=Array.from({length:27},(_,u)=>Array.from({length:9},(_,i)=>u<9?u*9+i:u<18?i*9+u-9:(Math.floor((u-18)/3)*3+Math.floor(i/3))*9+((u-18)%3)*3+i%3));
export const SUDOKU_PEERS=Array.from({length:81},(_,i)=>[...new Set(SUDOKU_UNITS.filter(u=>u.includes(i)).flat())].filter(x=>x!==i));
export const bitCount=mask=>{let n=0;for(;mask;mask&=mask-1)n++;return n;};
export function validSudokuArray(board){return Array.isArray(board)&&board.length===81&&board.every(x=>Number.isInteger(x)&&x>=0&&x<=9);}
export function sudokuConflicts(board){if(!validSudokuArray(board))return [];const wrong=new Set();for(const unit of SUDOKU_UNITS){const seen=new Map();for(const i of unit){const n=board[i];if(!n)continue;if(seen.has(n)){wrong.add(i);wrong.add(seen.get(n));}else seen.set(n,i);}}return [...wrong].sort((a,b)=>a-b);}
export function sudokuCandidates(board){return board.map((value,i)=>{if(value)return 0;let mask=511;for(const p of SUDOKU_PEERS[i])if(board[p])mask&=~(1<<(board[p]-1));return mask;});}
export function solveSudoku(input,{limit=2,maxNodes=300000}={}){
  if(!validSudokuArray(input)||sudokuConflicts(input).length)return {count:0,solution:null,nodes:0,limited:false};
  const board=[...input],rows=new Uint16Array(9),cols=new Uint16Array(9),boxes=new Uint16Array(9);let count=0,solution=null,nodes=0,limited=false;
  const box=i=>Math.floor(i/27)*3+Math.floor(i%9/3);
  board.forEach((v,i)=>{if(v){rows[Math.floor(i/9)]|=1<<(v-1);cols[i%9]|=1<<(v-1);boxes[box(i)]|=1<<(v-1);}});
  function search(){if(count>=limit||limited)return;if(++nodes>maxNodes){limited=true;return;}let cell=-1,mask=0,best=10;for(let i=0;i<81;i++){if(board[i])continue;const m=511&~(rows[Math.floor(i/9)]|cols[i%9]|boxes[box(i)]),n=bitCount(m);if(!n)return;if(n<best){cell=i;mask=m;best=n;if(n===1)break;}}if(cell<0){count++;solution||=board.slice();return;}const r=Math.floor(cell/9),c=cell%9,b=box(cell);for(let bits=mask;bits&&count<limit&&!limited;bits&=bits-1){const bit=bits&-bits;board[cell]=Math.log2(bit)+1;rows[r]|=bit;cols[c]|=bit;boxes[b]|=bit;search();board[cell]=0;rows[r]&=~bit;cols[c]&=~bit;boxes[b]&=~bit;}}
  search();return {count,solution,nodes,limited};
}
export function sudokuLogicalStep(board){
  if(!validSudokuArray(board)||sudokuConflicts(board).length)return null;const masks=sudokuCandidates(board);let rank=1,elimination='';
  for(let pass=0;pass<100;pass++){
    for(let i=0;i<81;i++)if(!board[i]&&bitCount(masks[i])===1)return {cell:i,value:Math.log2(masks[i])+1,rank,method:rank>=4?'استبعاد زوج':rank===3?'مرشح محصور':'احتمال وحيد',reason:(elimination?elimination+' ':'')+'هذه الخانة لا تقبل إلا هذا الرقم بعد مراجعة صفها وعمودها ومربعها.'};
    for(let u=0;u<27;u++)for(let digit=1;digit<=9;digit++){const bit=1<<(digit-1),cells=SUDOKU_UNITS[u].filter(i=>!board[i]&&(masks[i]&bit));if(cells.length===1)return {cell:cells[0],value:digit,rank:Math.max(rank,2),method:'موضع وحيد',reason:(elimination?elimination+' ':'')+`الرقم ${digit} له موضع متاح واحد في ${u<9?'هذا الصف':u<18?'هذا العمود':'هذا المربع الصغير'}.`};}
    let changed=false;
    for(let b=18;b<27;b++)for(let digit=1;digit<=9;digit++){const bit=1<<(digit-1),cells=SUDOKU_UNITS[b].filter(i=>masks[i]&bit);if(cells.length<2)continue;for(const column of [false,true]){const line=column?cells[0]%9:Math.floor(cells[0]/9);if(!cells.every(i=>(column?i%9:Math.floor(i/9))===line))continue;const targets=SUDOKU_UNITS[(column?9:0)+line].filter(i=>!SUDOKU_UNITS[b].includes(i)&&(masks[i]&bit));for(const i of targets){masks[i]&=~bit;changed=true;rank=Math.max(rank,3);elimination=`حُصر الرقم ${digit} في خط واحد داخل مربع، فاستبعدناه من بقية الخط.`;}}}
    if(changed)continue;
    for(const unit of SUDOKU_UNITS){const pairs=new Map();for(const i of unit)if(bitCount(masks[i])===2){const list=pairs.get(masks[i])||[];list.push(i);pairs.set(masks[i],list);}for(const [mask,cells]of pairs){if(cells.length!==2)continue;for(const i of unit)if(!cells.includes(i)&&(masks[i]&mask)){masks[i]&=~mask;changed=true;rank=Math.max(rank,4);elimination='خانتان تحصران الرقمين نفسيهما؛ لذلك نستبعدهما من بقية المجموعة.';}}}
    if(!changed)return null;
  }return null;
}
export function gradeSudoku(input){const board=[...input];let rank=1,steps=0,hidden=0;while(board.includes(0)){const step=sudokuLogicalStep(board);if(!step)return {rank:5,steps,remaining:board.filter(x=>!x).length,hidden};rank=Math.max(rank,step.rank);hidden+=step.rank>1?1:0;board[step.cell]=step.value;steps++;}return {rank,steps,remaining:0,hidden};}
