/* Visible-board advice only: no refill seed, rival state or hidden future tiles. */
import { adjacent, findGroups, legalSwaps } from '../engines/jewels-duel-engine.js?v=33.10.0';
export function analyzeJewelsSwap(board,a,b){
  if(!Array.isArray(board)||board.length!==64||!adjacent(a,b)||!board[a]||!board[b])return null;
  const first=board[a],second=board[b];
  if(first.s&&second.s)return {pair:[a,b],rank:1000,label:'اجمع الجوهرتين الخاصتين لضربة مشتركة'};
  if(first.s==='ball'||second.s==='ball'){
    const color=first.s==='ball'?second.c:first.c,count=board.filter(tile=>tile?.c===color).length;
    return {pair:[a,b],rank:650+count,label:'فعّل جوهرة النور لمسح لون كامل'};
  }
  const swapped=board.slice();[swapped[a],swapped[b]]=[swapped[b],swapped[a]];
  const groups=findGroups(swapped);if(!groups.some(g=>g.cells.includes(a)||g.cells.includes(b)))return null;
  const clear=new Set(groups.flatMap(g=>g.cells)).size;let rank=clear,label='طابق '+clear+' جواهر لبدء سلسلة';
  for(const group of groups){const longest=Math.max(...group.runs.map(r=>r.cells.length));if(longest>=5&&rank<500+clear){rank=500+clear;label='طابق خمس جواهر لصنع جوهرة نور';}else if(new Set(group.runs.map(r=>r.axis)).size>1&&group.cells.length>=5&&rank<300+clear){rank=300+clear;label='اصنع قنبلة بتطابق على شكل L أو T';}else if(longest===4&&rank<100+clear){rank=100+clear;label='طابق أربع جواهر لصنع صاروخ';}}
  return {pair:[a,b],rank,clear,label};
}
export function suggestJewelsSwap(board){
  if(!Array.isArray(board)||board.length!==64)return null;let best=null;
  for(const[a,b]of legalSwaps(board.slice())){const hint=analyzeJewelsSwap(board,a,b);if(hint&&(!best||hint.rank>best.rank))best=hint;}
  return best;
}
