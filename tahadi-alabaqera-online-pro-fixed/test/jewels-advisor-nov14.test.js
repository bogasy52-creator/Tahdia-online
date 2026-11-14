import test from 'node:test';
import assert from 'node:assert/strict';
import { createJewelsRace,legalRaceSwaps } from '../public/assets/js/engines/jewels-race-engine.js';
import { suggestJewelsSwap,analyzeJewelsSwap } from '../public/assets/js/jewels/advisor.js';
import { createJewelsRenderer } from '../public/assets/js/jewels/studio-renderer.js';
test('smart advice is legal on 80 real openings and leaves the visible board and match untouched',()=>{
  for(let seed=1;seed<=80;seed++){const s=createJewelsRace(['A','B'],{seed}),before=JSON.stringify(s),hint=suggestJewelsSwap(s.players[0].board);assert.ok(hint);assert.ok(legalRaceSwaps(s,0).some(([a,b])=>a===hint.pair[0]&&b===hint.pair[1]));assert.equal(JSON.stringify(s),before);s.seed=123456;s.initialSeed=999;s.players[1].score=99999;assert.deepEqual(suggestJewelsSwap(s.players[0].board),hint);}
  assert.equal(suggestJewelsSwap([]),null);assert.equal(analyzeJewelsSwap([],0,1),null);
});
test('smart advice prioritizes combining visible special gems over a basic match',()=>{
  const s=createJewelsRace(['A','B'],{seed:43}),b=s.players[0].board;b[0]={...b[0],s:'bomb'};b[1]={...b[1],s:'rh'};const before=JSON.stringify(b),hint=suggestJewelsSwap(b);assert.deepEqual(hint.pair,[0,1]);assert.match(hint.label,/مشتركة/);assert.equal(JSON.stringify(b),before);
});
test('light effects lower Canvas backing density without moving cells or changing the board',()=>{
  const ctx=new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)}),cv={width:0,height:0,style:{},getContext:()=>ctx};let light=false;const r=createJewelsRenderer({canvas:cv,lightEffects:()=>light,raf:()=>1}),board=createJewelsRace(['A','B'],{seed:4}).players[0].board;r.setBoard(board);const a=r.resize(380,3),full=cv.width;light=true;const b=r.resize(380,3);assert.deepEqual(a,b);assert.equal(full,950);assert.equal(cv.width,570);assert.equal(r.board,board);
});
