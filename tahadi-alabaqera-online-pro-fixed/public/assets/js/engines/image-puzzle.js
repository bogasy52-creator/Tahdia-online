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
