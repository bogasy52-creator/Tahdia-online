// Independent Algorithm X oracle: four exact-cover constraints, no production solver/peers/masks.
export function oracleSudoku(board,limit=2){
 if(!Array.isArray(board)||board.length!==81||board.some(n=>!Number.isInteger(n)||n<0||n>9))throw Error('invalid_board');
 const columns=new Map(Array.from({length:324},(_,i)=>[i,new Set()])),rows=new Map();
 for(let r=0;r<9;r++)for(let c=0;c<9;c++)for(let n=1;n<=9;n++){
  if(board[r*9+c]&&board[r*9+c]!==n)continue;
  const id=(r*9+c)*9+n-1,keys=[r*9+c,81+r*9+n-1,162+c*9+n-1,243+(Math.floor(r/3)*3+Math.floor(c/3))*9+n-1];
  rows.set(id,keys);for(const key of keys)columns.get(key).add(id);
 }
 const answers=[],chosen=[];let visits=0;
 function search(){
  if(answers.length>=limit)return;if(++visits>1000000)throw Error('oracle_budget');
  if(!columns.size){const solved=Array(81).fill(0);for(const id of chosen)solved[Math.floor(id/9)]=id%9+1;answers.push(solved);return;}
  let key=null,size=Infinity;for(const[k,set]of columns)if(set.size<size){key=k;size=set.size;if(size<=1)break;}
  if(!size)return;
  for(const row of [...columns.get(key)]){
   const removed=[];chosen.push(row);
   for(const col of rows.get(row)){
    const candidates=columns.get(col);columns.delete(col);removed.push([col,candidates]);
    for(const other of candidates)for(const linked of rows.get(other))if(columns.has(linked))columns.get(linked).delete(other);
   }
   search();
   for(let i=removed.length-1;i>=0;i--){const [col,candidates]=removed[i];columns.set(col,candidates);for(const other of candidates)for(const linked of rows.get(other))if(columns.has(linked))columns.get(linked).add(other);}
   chosen.pop();if(answers.length>=limit)return;
  }
 }
 search();return {count:answers.length,solution:answers[0]||null,visits};
}
export function assertSudokuSolution(board,givens,assert){
 const expected='123456789';
 for(let r=0;r<9;r++)assert.equal(board.slice(r*9,r*9+9).sort().join(''),expected,'row '+r);
 for(let c=0;c<9;c++)assert.equal(Array.from({length:9},(_,r)=>board[r*9+c]).sort().join(''),expected,'column '+c);
 for(let br=0;br<3;br++)for(let bc=0;bc<3;bc++)assert.equal(Array.from({length:9},(_,i)=>board[(br*3+Math.floor(i/3))*9+bc*3+i%3]).sort().join(''),expected,'box '+br+','+bc);
 givens.forEach((n,i)=>{if(n)assert.equal(board[i],n,'given '+i);});
}
