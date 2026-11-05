import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import * as Core from '../public/assets/js/engines/challenge-core.js';
import {unoDeck,unoLegal} from '../public/assets/js/engines/uno-core.js';
import {createDOM} from './dom-harness.mjs';

const players=(n=4,bots=false)=>Array.from({length:n},(_,i)=>({id:'p'+i,name:'لاعب '+i,bot:bots}));
const game=(mode='classic',n=4)=>Core.createChallenge('chaos',players(n),7,1000,{unoMode:mode});
const card=(id,color,face)=>({id,color,face});
const act=(m,seat,a,t=1100)=>Core.applyChallenge(m,'p'+seat,a,t);
function setup(mode='classic',n=4){
 const m=game(mode,n),u=m.uno;
 u.discard=[card('top','red','5')];u.color='red';u.deck=unoDeck().slice(30,60);
 u.hands=Array.from({length:n},(_,i)=>[card('r'+i,'red','1'),card('b'+i,'blue','8'),card('g'+i,'green','3')]);
 return m;
}
test('Uno has a full deck and deals private hands for all three table modes',()=>{
 assert.equal(unoDeck().length,108);
 assert.equal(new Set(unoDeck(2).map(c=>c.id)).size,216);
 for(const mode of ['classic','stack','quick']){
  const m=game(mode),u=m.uno;
  assert.equal(u.hands[0].length,mode==='quick'?5:7);
  assert.equal(u.hands.flat().length+u.deck.length+u.discard.length,108);
  const view=Core.challengeView(m,'p0',1000);
  assert.deepEqual(view.uno.hand,u.hands[0]);
  for(const key of ['hands','deck','discard','random','thinkAt'])assert.equal(key in view.uno,false,key);
  assert.equal(view.uno.counts.length,4);
 }
});
test('legal plays, color selection and out-of-turn rejection preserve the hand',()=>{
 const m=setup(),u=m.uno;
 u.hands[0].push(card('w','wild','wild'),card('four','wild','draw4'));
 assert.ok(unoLegal(u,0).includes('r0'));
 assert.ok(!unoLegal(u,0).includes('four'));
 assert.throws(()=>act(m,1,{type:'play',card:'r1'}),/دورك/);
 const before=structuredClone(u);
 assert.throws(()=>act(m,0,{type:'play',card:'w',color:'pink'}),/اللون/);
 assert.deepEqual(u,before);
 act(m,0,{type:'play',card:'w',color:'green'});
 assert.equal(u.color,'green');assert.equal(u.turn,1);
});
test('reverse with two players, skip, draw-two and legal draw-four apply to the right seat',()=>{
 let m=setup('classic',2);m.uno.hands[0][0]=card('x','red','reverse');
 act(m,0,{type:'play',card:'x'});assert.equal(m.uno.turn,0);
 m=setup();m.uno.hands[0][0]=card('x','red','skip');
 act(m,0,{type:'play',card:'x'});assert.equal(m.uno.turn,2);
 m=setup();m.uno.hands[0][0]=card('x','red','draw2');
 act(m,0,{type:'play',card:'x'});assert.equal(m.uno.hands[1].length,5);assert.equal(m.uno.turn,2);
 m=setup();m.uno.hands[0]=[card('x','wild','draw4'),card('b','blue','3')];
 act(m,0,{type:'play',card:'x',color:'blue',uno:true});
 assert.equal(m.uno.hands[1].length,7);assert.equal(m.uno.turn,2);
});
test('a drawn matching card can be played or passed and no other card is legal after drawing',()=>{
 const m=setup(),u=m.uno;
 u.deck.push(card('new','red','9'));act(m,0,{type:'draw'});
 assert.equal(u.turn,0);assert.deepEqual(unoLegal(u,0),['new']);
 assert.throws(()=>act(m,0,{type:'play',card:'r0'}),/تطابق/);
 act(m,0,{type:'pass'});assert.equal(u.turn,1);
});
test('stack mode accumulates the same draw symbol and settles the penalty once',()=>{
 const m=setup('stack'),u=m.uno;
 u.hands[0][0]=card('a','red','draw2');u.hands[1][0]=card('b','blue','draw2');
 act(m,0,{type:'play',card:'a'});assert.equal(u.pending,2);
 act(m,1,{type:'play',card:'b'});assert.equal(u.pending,4);
 const before=u.hands[2].length;act(m,2,{type:'draw'});
 assert.equal(u.hands[2].length,before+4);assert.equal(u.pending,0);assert.equal(u.turn,3);
});
test('Uno can be announced, caught, and expires as a catch opportunity after the next move',()=>{
 let m=setup();m.uno.hands[0]=[card('a','red','7'),card('b','blue','1')];
 act(m,0,{type:'play',card:'a'});assert.equal(m.uno.missed,0);
 act(m,2,{type:'catch'});assert.equal(m.uno.hands[0].length,3);assert.equal(m.uno.turn,1);
 assert.throws(()=>act(m,2,{type:'catch'}),/لاعب/);
 m=setup();m.uno.hands[0]=[card('a','red','7'),card('b','blue','1')];
 act(m,0,{type:'play',card:'a',uno:true});assert.equal(m.uno.missed,null);
});
test('recycling preserves the top card and a final draw card settles before winning',()=>{
 const m=setup(),u=m.uno;
 u.deck=[];u.discard.unshift(card('recycle','green','4'));
 act(m,0,{type:'draw'});assert.equal(u.discard.at(-1).id,'top');
 assert.ok(u.hands[0].some(c=>c.id==='recycle'));
 const win=setup();win.uno.hands[0]=[card('last','red','draw2')];
 act(win,0,{type:'play',card:'last'});
 assert.equal(win.phase,'finished');assert.deepEqual(win.winners,['p0']);
 assert.equal(win.uno.hands[1].length,5);
 assert.throws(()=>act(win,1,{type:'draw'}),/انتهت/);
});
test('turn alarms and bots complete varied rounds without losing or duplicating cards',()=>{
 for(const mode of ['classic','stack','quick'])for(let seed=1;seed<=4;seed++){
  const m=Core.createChallenge('chaos',players(4,true),seed,1000,{unoMode:mode});
  let t=1000;
  while(m.phase==='playing'&&t<902000){
   t+=1500;Core.advanceChallenge(m,t);
   const all=[...m.uno.deck,...m.uno.discard,...m.uno.hands.flat()];
   assert.equal(all.length,108);assert.equal(new Set(all.map(c=>c.id)).size,108);
  }
  assert.equal(m.phase,'finished');assert.ok(m.winners.length);
 }
 const m=setup();Core.advanceChallenge(m,32000);assert.equal(m.uno.turn,1);
});
test('the table renders the private hand and uses its actual action handler',async()=>{
 const h=await createDOM('chaos.html');
 await h.runFile('assets/js/uno-ui.js');
 const m=game(),view=Core.challengeView(m,'p0',1100),actions=[];
 h.context.__m=view;h.context.__hooks={me:'p0',now:()=>1100,act:a=>actions.push(a)};
 vm.runInContext('BS_UNO.render(__m,__hooks)',h.context);
 assert.equal(h.doc.querySelectorAll('.uno-hand-card').length,7);
 assert.equal(h.doc.querySelectorAll('.uno-rival').length,3);
 h.doc.querySelector('.uno-draw').click();assert.equal(actions[0].type,'draw');
 vm.runInContext('BS_UNO.clear()',h.context);
});
