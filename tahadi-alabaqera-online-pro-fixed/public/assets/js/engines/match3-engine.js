/* V18: deterministic swap / resolve / gravity engine, shared with reward verification.
   Rendering consumes immutable event snapshots; it never drives game rules. */
export const MATCH3_VERSION = 2;
export const GEM_COLORS = ['#40d879','#ffce32','#b66dff','#ff5179','#39bcff','#ff9c34'];
export const BOOST_COST = 8;
export const MAX_ACTIONS = 60;
function hash(value) { let n=2166136261; for(const c of String(value)) n=Math.imul(n^c.charCodeAt(0),16777619); return n>>>0||1; }
function random(s) { let n=s.seed; n^=n<<13;n^=n>>>17;n^=n<<5;s.seed=n>>>0||1;return s.seed/4294967296; }
export function neighbors(a,b,size=7) { return Number.isInteger(a)&&Number.isInteger(b)&&a>=0&&b>=0&&a<size*size&&b<size*size&&Math.abs(a%size-b%size)+Math.abs((a/size|0)-(b/size|0))===1; }
const colorAt=(board,i)=>board[i]?.special==='prism'?-1:board[i]?.color??-1;
const tile=(s,color,special='')=>({id:++s.serial,color,special});
function freshBoard(s) {
  const board=[];
  for(let i=0;i<s.size*s.size;i++) {
    const choices=[];
    for(let c=0;c<s.colors;c++) if(!(i%s.size>1&&colorAt(board,i-1)===c&&colorAt(board,i-2)===c)&&!(i>=s.size*2&&colorAt(board,i-s.size)===c&&colorAt(board,i-s.size*2)===c)) choices.push(c);
    board.push(tile(s,choices[Math.floor(random(s)*choices.length)]));
  }
  return board;
}
export function findMatches(board,size=7) {
  const runs=[];
  for(let axis=0;axis<2;axis++) for(let line=0;line<size;line++) {
    let start=0;
    while(start<size) {
      const at=k=>axis? k*size+line:line*size+k,c=colorAt(board,at(start));let end=start+1;
      while(c>=0&&end<size&&colorAt(board,at(end))===c)end++;
      if(c>=0&&end-start>=3)runs.push({axis,cells:Array.from({length:end-start},(_,j)=>at(start+j))});
      start=end;
    }
  }
  const groups=[];
  for(const run of runs) {
    const touching=groups.filter(g=>run.cells.some(i=>g.cells.has(i)));
    const group={cells:new Set(run.cells),runs:[run]};
    for(const old of touching){for(const i of old.cells)group.cells.add(i);group.runs.push(...old.runs);groups.splice(groups.indexOf(old),1);}
    groups.push(group);
  }
  return groups.map(g=>({...g,cells:[...g.cells]}));
}
function matchesAt(board,index,size) {
  const c=colorAt(board,index);if(c<0)return false;
  const x=index%size,y=index/size|0;
  let count=1;
  for(let n=x-1;n>=0&&colorAt(board,y*size+n)===c;n--)count++;
  for(let n=x+1;n<size&&colorAt(board,y*size+n)===c;n++)count++;
  if(count>=3)return true;count=1;
  for(let n=y-1;n>=0&&colorAt(board,n*size+x)===c;n--)count++;
  for(let n=y+1;n<size&&colorAt(board,n*size+x)===c;n++)count++;
  return count>=3;
}
export function legalSwaps(s) {
  if(!s||s.over)return [];
  const board=s.board.slice(),moves=[];
  for(let a=0;a<board.length;a++)for(const b of [a%s.size<s.size-1?a+1:-1,a+s.size<board.length?a+s.size:-1]) {
    if(b<0)continue;
    if(board[a].special||board[b].special){moves.push([a,b]);continue;}
    if(board[a].color===board[b].color)continue;
    [board[a],board[b]]=[board[b],board[a]];
    if(matchesAt(board,a,s.size)||matchesAt(board,b,s.size))moves.push([a,b]);
    [board[a],board[b]]=[board[b],board[a]];
  }
  return moves;
}
function ensurePlayable(s,events) {
  if(legalSwaps({...s,over:false}).length)return;
  const before=s.board;
  // Preserve specials, try bounded shuffles, then generate a fresh productive board.
  for(let attempt=0;attempt<20;attempt++) {
    const board=before.slice();
    for(let i=board.length-1;i>0;i--){const j=Math.floor(random(s)*(i+1));[board[i],board[j]]=[board[j],board[i]];}
    s.board=board;if(!findMatches(board,s.size).length&&legalSwaps({...s,over:false}).length)break;
    if(attempt===19){do{s.board=freshBoard(s);}while(!legalSwaps({...s,over:false}).length);}
  }
  events?.push({type:'shuffle',before,after:s.board.slice()});
}
export function createMatch3(level=1,daily='') {
  if(!Number.isInteger(level)||level<1||level>60||daily&&!/^\d{4}-\d{2}-\d{2}$/.test(daily))throw Error('invalid_stage');
  const number=daily?19+hash(daily+'jewels')%30:level;
  const s={game:'jewels',engineVersion:MATCH3_VERSION,level,daily,number,chapter:(level-1)/12|0,size:7,colors:number<9?5:6,seed:hash('tahdia-match3-18:'+ (daily||level)),serial:0,moves:0,limit:20,extraMoves:0,boosterUses:0,charge:0,score:0,collected:0,colorCount:0,targetColor:4,goal:30+Math.floor(number*.6),colorGoal:5+Math.floor(number/9),iceGoal:0,iceCleared:0,ice:Array(49).fill(0),board:[],log:[],won:false,over:false};
  s.board=freshBoard(s);ensurePlayable(s);
  if(number>=13){const count=4+Math.floor(number/6),spots=Array.from({length:49},(_,i)=>i);for(let i=0;i<count;i++){const j=Math.floor(random(s)*spots.length),cell=spots.splice(j,1)[0];s.ice[cell]=number>=43?2:1;s.iceGoal+=s.ice[cell];}}
  return s;
}
function blast(cells,center,kind,size) {
  const x=center%size,y=center/size|0;
  if(kind==='row'||kind==='cross')for(let i=0;i<size;i++)cells.add(y*size+i);
  if(kind==='column'||kind==='cross')for(let i=0;i<size;i++)cells.add(i*size+x);
  if(kind==='bomb'||kind==='mega') {const radius=kind==='mega'?2:1;for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++)if(x+dx>=0&&x+dx<size&&y+dy>=0&&y+dy<size)cells.add((y+dy)*size+x+dx);}
}
function expandSpecials(s,cells,protectedCells,prismColor=-1) {
  const activated=[],seen=new Set();let remaining=true;
  while(remaining) {
    remaining=false;
    for(const i of cells) {
      const gem=s.board[i];if(!gem?.special||seen.has(i)||protectedCells.has(i))continue;
      seen.add(i);activated.push({cell:i,special:gem.special});remaining=true;
      if(gem.special==='prism') {const target=prismColor>=0?prismColor:s.targetColor;for(let k=0;k<s.board.length;k++)if(s.board[k]?.color===target)cells.add(k);}
      else blast(cells,i,gem.special,s.size);
    }
  }
  return activated;
}
function collapse(s,events,noMatches=false) {
  const before=s.board.slice(),motions=[],after=Array(before.length).fill(null);
  for(let x=0;x<s.size;x++) {
    let row=s.size-1;
    for(let y=s.size-1;y>=0;y--){const gem=before[y*s.size+x];if(!gem)continue;const to=row--*s.size+x;after[to]=gem;if(to!==y*s.size+x)motions.push({tile:gem,from:y*s.size+x,to});}
    let above=-1;
    while(row>=0){const to=row--*s.size+x,gem=tile(s,Math.floor(random(s)*s.colors));after[to]=gem;motions.push({tile:gem,from:above--*s.size+x,to});}
  }
  s.board=after;
  // A pathological cascade is settled with bounded, match-free refill.
  if(noMatches){s.board=freshBoard(s);events?.push({type:'shuffle',before,after:s.board.slice()});}
  else events?.push({type:'fall',before,after:s.board.slice(),motions,iceBefore:s.ice.slice()});
}
export function moveMatch3(raw,action,{events=true}={}) {
  const invalid=()=>({state:raw,accepted:false,events:[]});
  if(!raw||raw.over||raw.engineVersion!==MATCH3_VERSION||raw.log.length>=MAX_ACTIONS)return invalid();
  const swap=action?.swap,boost=action?.boost,usingBoost=Number.isInteger(boost);
  if(usingBoost?(boost<0||boost>=49||raw.charge<BOOST_COST||raw.boosterUses>=10):!Array.isArray(swap)||swap.length!==2||!neighbors(swap[0],swap[1],raw.size))return invalid();
  const s={...raw,board:raw.board.slice(),ice:raw.ice.slice(),log:raw.log.slice()},timeline=events?[]:null;
  let forced=new Set(),prismColor=-1,groups=[],extra=false;
  if(usingBoost) {s.charge-=BOOST_COST;s.boosterUses++;blast(forced,boost,'cross',s.size);blast(forced,boost,'bomb',s.size);s.log.push({boost});}
  else {
    const [a,b]=swap,before=s.board.slice(),first=s.board[a],second=s.board[b];[s.board[a],s.board[b]]=[second,first];
    groups=findMatches(s.board,s.size);
    if(!first.special&&!second.special&&!groups.length)return invalid();
    timeline?.push({type:'swap',before,after:s.board.slice(),swap:[a,b],iceBefore:s.ice.slice()});
    if(first.special||second.special) {
      forced.add(a);forced.add(b);
      if(first.special==='prism'||second.special==='prism'){
        const other=first.special==='prism'?second:first;prismColor=other.color;
        for(let i=0;i<s.board.length;i++)if(other.special==='prism'||s.board[i].color===prismColor){forced.add(i);if(other.special&&other.special!=='prism')blast(forced,i,other.special,s.size);}
      } else if(first.special&&second.special) {blast(forced,a,first.special==='bomb'&&second.special==='bomb'?'mega':'cross',s.size);blast(forced,b,'cross',s.size);}
    }
    s.moves++;s.log.push({swap:[a,b]});
  }
  let cascade=0,clearedTotal=0,specialsTotal=0;
  while(forced.size||groups.length) {
    const before=s.board.slice(),iceBefore=s.ice.slice(),cleared=new Set(forced),created=[],protectedCells=new Set();
    for(const group of groups) {
      for(const i of group.cells)cleared.add(i);
      const long=group.runs.find(r=>r.cells.length>=5),cross=new Set(group.runs.map(r=>r.axis)).size>1,four=group.runs.find(r=>r.cells.length>=4);
      const special=long?'prism':cross?'bomb':four?(four.axis?'column':'row'):'';
      if(special) {
        if(!cascade)extra=true;
        const anchor=swap?.slice().reverse().find(i=>group.cells.includes(i)&&!s.board[i].special)??group.cells.find(i=>!s.board[i].special);
        if(anchor!=null){created.push({cell:anchor,tile:tile(s,s.board[anchor].color,special)});protectedCells.add(anchor);}
      }
    }
    // Existing special pieces fire even when a new piece is created in the same match.
    const activated=expandSpecials(s,cleared,protectedCells,prismColor);specialsTotal+=activated.length;
    for(const i of cleared) {
      if(!s.board[i])continue;
      s.collected++;if(s.board[i].color===s.targetColor){s.colorCount++;s.charge=Math.min(BOOST_COST,s.charge+1);}
      if(s.ice[i]){s.ice[i]--;s.iceCleared++;}
      s.board[i]=null;
    }
    for(const item of created)s.board[item.cell]=item.tile;
    const points=cleared.size*(10+Math.min(cascade,6)*5)+activated.length*50+created.length*30;
    s.score+=points;clearedTotal+=cleared.size;
    timeline?.push({type:'clear',before,after:s.board.slice(),cleared:[...cleared],created,activated,iceBefore,iceAfter:s.ice.slice(),points,cascade});
    collapse(s,timeline,++cascade>=24);
    if(cascade>=24)break;
    forced=new Set();groups=findMatches(s.board,s.size);
  }
  if(extra&&s.extraMoves<10){s.extraMoves++;s.limit++;}
  s.won=s.collected>=s.goal&&s.colorCount>=s.colorGoal&&s.iceCleared>=s.iceGoal;
  s.over=s.won||s.moves>=s.limit||s.log.length>=MAX_ACTIONS;
  if(!s.over)ensurePlayable(s,timeline);
  return {state:s,accepted:true,events:timeline||[],cleared:clearedTotal,cascades:cascade,specials:specialsTotal,extraMove:extra&&s.extraMoves>raw.extraMoves};
}
export function match3Stars(s) { return s?.won?(s.moves<=12?3:s.moves<=17?2:1):0; }
export function restoreMatch3(proof,{requireWin=false}={}) {
  if(proof?.engineVersion!==MATCH3_VERSION||proof.game!=='jewels'||!Array.isArray(proof.log)||proof.log.length>MAX_ACTIONS)throw Error('invalid_proof');
  let s=createMatch3(proof.level,proof.daily||'');
  for(const action of proof.log){const result=moveMatch3(s,action,{events:false});if(!result.accepted)throw Error('invalid_move');s=result.state;}
  if(requireWin&&!s.won)throw Error('stage_incomplete');return s;
}
