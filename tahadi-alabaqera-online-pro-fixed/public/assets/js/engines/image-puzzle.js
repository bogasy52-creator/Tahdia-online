export const PICTURE_THEMES = [
  {id:'garden',name:'الحديقة السرية',src:'/assets/ai-v19/garden.webp',scene:'a secret botanical conservatory garden, glass dome, arched footbridge, pond and lanterns'},
  {id:'space',name:'ميناء الفضاء',src:'/assets/ai-v19/space.webp',scene:'a whimsical moon space harbour, rocket, observatory and greenhouse'},
  {id:'ocean',name:'مدينة الأعماق',src:'/assets/ai-v19/garden.webp',scene:'an imaginative underwater city, coral arches, luminous fish and a glass research dome'},
  {id:'mountain',name:'قرية فوق السحاب',src:'/assets/ai-v19/space.webp',scene:'a miniature mountain village above the clouds, bridges, waterfall and an observatory'},
  {id:'heritage',name:'حكاية من التراث',src:'/assets/ai-v19/garden.webp',scene:'an original Arabian sandstone village, palm trees, winding stairs, canal and brass lanterns'},
];
export function createImageBoard(size=4,seed=1){
  if(![3,4,5].includes(size))throw new Error('invalid_size');
  let x=Number(seed)>>>0||1;
  const random=()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296};
  const board=Array.from({length:size*size},(_,i)=>i);
  for(let i=board.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[board[i],board[j]]=[board[j],board[i]];}
  if(imageProgress(board)>board.length/2)board.push(board.shift());
  return board;
}
export function swapImageTiles(board,a,b){
  if(!Array.isArray(board)||!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a>=board.length||b>=board.length||a===b)throw new Error('invalid_swap');
  const next=[...board];[next[a],next[b]]=[next[b],next[a]];return next;
}
export function imageProgress(board){return board.reduce((n,tile,i)=>n+(tile===i?1:0),0);}
export const ASSEMBLY_MODE='assembly-v21';
export function createImageAssembly(size=4,seed=1){const tray=createImageBoard(size,seed);return {board:Array(size*size).fill(-1),tray};}
export function validImageAssembly(board,tray){const count=board?.length;return [9,16,25].includes(count)&&Array.isArray(board)&&Array.from(board).every((value,index)=>value===-1||value===index)&&Array.isArray(tray)&&tray.length===count&&new Set(tray).size===count&&tray.every(value=>Number.isInteger(value)&&value>=0&&value<count);}
export function placeImageTile(board,piece,cell){
 if(!Array.isArray(board)||![9,16,25].includes(board.length)||!Array.from(board).every((value,index)=>value===-1||value===index)||!Number.isInteger(piece)||!Number.isInteger(cell)||piece<0||cell<0||piece>=board.length||cell>=board.length)throw new Error('invalid_placement');
 if(board[piece]!==-1||board[cell]!==-1)throw new Error('already_placed');
 if(piece!==cell)throw new Error('wrong_slot');
 const next=[...board];next[cell]=piece;return next;
}
export function imageCellAtPoint(rect,x,y,size){
 if(![3,4,5].includes(size)||![rect?.left,rect?.top,rect?.width,rect?.height,x,y].every(Number.isFinite)||rect.width<=0||rect.height<=0||x<rect.left||y<rect.top||x>=rect.left+rect.width||y>=rect.top+rect.height)return -1;
 return Math.floor((y-rect.top)/rect.height*size)*size+Math.floor((x-rect.left)/rect.width*size);
}
