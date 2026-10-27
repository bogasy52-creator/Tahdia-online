import {cognitiveQuestion} from './cognitive-v34.js';
export const PUZZLE_GOAL=Object.freeze([1,2,3,4,5,6,7,8,0]);
export function adjacent(a,b){return Number.isInteger(a)&&Number.isInteger(b)&&a>=0&&b>=0&&a<9&&b<9&&Math.abs(Math.floor(a/3)-Math.floor(b/3))+Math.abs(a%3-b%3)===1}
export const puzzleSolved=tiles=>tiles.length===9&&tiles.every((x,i)=>x===PUZZLE_GOAL[i]);
export function puzzleSolvable(tiles){if(tiles.length!==9||new Set(tiles).size!==9||!tiles.every(x=>Number.isInteger(x)&&x>=0&&x<=8))return false;const values=tiles.filter(Boolean);let inversions=0;for(let i=0;i<values.length;i++)for(let j=i+1;j<values.length;j++)if(values[i]>values[j])inversions++;return inversions%2===0}
export function generatePuzzle(rng=Math.random,shuffleSteps=160){const steps=Math.max(12,Math.min(400,Math.round(Number(shuffleSteps)||160))),tiles=[...PUZZLE_GOAL];let blank=8,previous=-1;for(let step=0;step<steps;step++){const next=[0,1,2,3,4,5,6,7,8].filter(i=>adjacent(blank,i)&&i!==previous);const idx=next[Math.min(next.length-1,Math.floor(rng()*next.length))];[tiles[blank],tiles[idx]]=[tiles[idx],tiles[blank]];previous=blank;blank=idx}if(puzzleSolved(tiles)){[tiles[7],tiles[8]]=[tiles[8],tiles[7]]}return tiles}
export function movePuzzle(tiles,index){const blank=tiles.indexOf(0);if(!adjacent(blank,index))return {tiles:[...tiles],moved:false,solved:false};const next=[...tiles];[next[index],next[blank]]=[next[blank],next[index]];return {tiles:next,moved:true,solved:puzzleSolved(next)}}
export function shuffled(items,rng=Math.random){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.min(i,Math.floor(rng()*(i+1)));[a[i],a[j]]=[a[j],a[i]]}return a}
export function accuracyHit(state,now){if(!state.active||now>=state.deadline)return {...state,active:state.active&&now<state.deadline,accepted:false};return {...state,score:state.score+1,accepted:true}}
export function memoryPair(state,index){if(!state.active||state.locked||state.open.includes(index)||state.matched.includes(index)||index<0||index>=state.deck.length)return {...state,accepted:false};const open=[...state.open,index];if(open.length<2)return {...state,open,accepted:true};const moves=state.moves+1;if(state.deck[open[0]]===state.deck[open[1]]){const matched=[...state.matched,...open];return {...state,open:[],matched,moves,active:matched.length<state.deck.length,won:matched.length===state.deck.length,accepted:true}}return {...state,open,moves,locked:true,accepted:true}}
export const logicQuestion=cognitiveQuestion;
export function arcadeRules(game,level='standard'){
 const index=Math.max(0,['casual','standard','expert'].indexOf(level));
 const values={memory:{pairs:[6,8,12],seconds:[100,90,75]},accuracy:{target:[80,64,46],seconds:[40,30,30],goal:[8,10,15]},reaction:{trials:[3,5,7]},logic:{questions:[6,10,15],seconds:[180,120,90]},puzzle:{shuffle:[30,160,320]}};
 return Object.freeze(Object.fromEntries(Object.entries(values[game]||{}).map(([key,list])=>[key,list[index]])));
}
