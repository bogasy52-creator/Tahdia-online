import test from 'node:test';
import assert from 'node:assert/strict';
import {createChallenge,applyChallenge,advanceChallenge,challengeView,botAction} from '../public/assets/js/engines/challenge-core.js';
const ps=[{id:'a',name:'A'},{id:'b',name:'B'}],start=100000;
function answer(m){const t=m.task;return t.type==='sequence'?{round:m.round,values:t.sequence}: {round:m.round,choice:t.type==='opposite'?(t.target+2)%4:t.type==='word'?t.word:t.type==='parity'?t.number%2:t.target};}
test('focus streak bonuses increase only after correct answers, cap at 100 and reset after a mistake',()=>{
 const m=createChallenge('focus',ps,19,start);const bonuses=[];
 for(let i=0;i<9;i++){if(m.task.type!=='hold'){applyChallenge(m,'a',answer(m),m.task.opensAt+240);bonuses.push(m.answers.a.combo);assert.equal(m.answers.a.elapsed,240);}advanceChallenge(m,m.task.deadline);}
 assert.deepEqual(bonuses.slice(0,3),[0,25,50]);assert.equal(bonuses.at(-1),100);assert.equal(m.players[0].focus.bestMs,240);assert.equal(m.players[0].focus.correct,9);
 // Round 9 is a no-go: pressing is a mistake, not a free streak.
 applyChallenge(m,'a',{round:m.round,choice:0},m.task.opensAt+400);assert.equal(m.players[0].focus.streak,0);assert.equal(m.answers.a.gain,-40);advanceChallenge(m,m.task.deadline);applyChallenge(m,'a',answer(m),m.task.opensAt+300);assert.equal(m.answers.a.combo,0);assert.equal(m.players[0].focus.wrong,1);
});
test('focus personal statistics remain private and duplicate answers cannot inflate them',()=>{const m=createChallenge('focus',ps,7,start);applyChallenge(m,'a',answer(m),m.task.opensAt+125);assert.throws(()=>applyChallenge(m,'a',answer(m),m.task.opensAt+200));assert.equal(m.players[0].focus.correct,1);assert.equal(challengeView(m,'a').me.focus.bestMs,125);const other=challengeView(m,'b');assert.equal(other.me.focus,null);assert.equal(other.players[0].focus,undefined);});
test('territory bot attacks a surrounded rival when no neutral expansion remains and obeys energy cost',()=>{const m=createChallenge('territory',ps,1,start);m.board.owners.fill(1);for(const c of[0,2,10])m.board.owners[c]=0;m.board.crystals=[1];const action=botAction(m,'a',start);assert.equal(action.to,1);applyChallenge(m,'a',action,start);assert.equal(m.board.owners[1],0);assert.equal(m.players[0].energy,0);assert.equal(botAction(m,'a',start),null);});
test('all four survival hazard families allow every warned position to reach refuge before collapse at every grid size',()=>{
 for(const count of[2,8,20])for(let seed=1;seed<=24;seed++){
  const m=createChallenge('survival',Array.from({length:count},(_,i)=>({id:'p'+i,name:'P'+i})),seed,start);m.endsAt=start+10000000;const names=new Set();
  for(let round=0;round<16;round++){
   m.round=round-1;m.board.collapsed=true;m.board.recoverAt=start+round*10000;advanceChallenge(m,m.board.recoverAt);const b=m.board,n=b.size,safe=Array.from({length:n*n},(_,i)=>i).filter(i=>!b.unsafe.includes(i));assert.ok(safe.length);names.add(b.hazardName);
   for(const at of b.unsafe){const distance=Math.min(...safe.map(to=>Math.abs(at%n-to%n)+Math.abs(Math.floor(at/n)-Math.floor(to/n))));assert.ok(distance*180+600<b.collapseAt-b.warningStartedAt);}
  }assert.equal(names.size,4);
 }
});
