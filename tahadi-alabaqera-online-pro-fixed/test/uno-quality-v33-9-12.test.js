import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import * as Core from '../public/assets/js/engines/challenge-core.js';
import {createDOM} from './dom-harness.mjs';
import {initUno} from '../public/assets/js/engines/uno-core.js';

const card=(id,color='red',face='3')=>({id,color,face});
function game(n=4,mode='classic') {
 const players=Array.from({length:n},(_,i)=>({id:'p'+i,name:'لاعب '+(i+1)}));
 const m=Core.createChallenge('chaos',players.slice(0,8),7,1000,{unoMode:mode});
 if(n>8){m.players=players.map((p,slot)=>({...structuredClone(m.players[0]),...p,slot}));initUno(m,mode,1000);}
 m.uno.hands=Array.from({length:n},(_,i)=>[card('r'+i),card('b'+i,'blue','8'),card('g'+i,'green','2')]);
 m.uno.discard=[card('top','red','5')];m.uno.color='red';
 m.uno.deck=[card('stock-a','blue','6'),card('stock-b','gold','9'),card('stock-c','green','7'),card('drawn','red','9')];
 return m;
}
const act=(m,seat,a,t=1100)=>Core.applyChallenge(m,'p'+seat,a,t);
async function table(m=game(),viewer='p0') {
 const h=await createDOM('chaos.html');await h.runFile('assets/js/uno-ui.js');
 const actions=[];
 const render=()=>{
  h.context.__m=Core.challengeView(m,viewer,1200);
  h.context.__hooks={me:viewer,now:()=>1200,act:a=>{actions.push(a);act(m,Number(viewer.slice(1)),a,1200);render();return true;}};
  vm.runInContext('BS_UNO.render(__m,__hooks)',h.context);
 };
 render();return {...h,m,actions,render,clear:()=>vm.runInContext('BS_UNO.clear()',h.context)};
}
function key(node,key,extra={}){const e={type:'keydown',key,...extra};node.dispatchEvent(e);return e;}

test('an expired turn after drawing a playable card passes without drawing twice',()=>{
 for(const mode of ['classic','stack','quick'])for(const direction of [1,-1]){
  const m=game(3,mode);m.uno.direction=direction;
  act(m,0,{type:'draw'});
  assert.equal(m.uno.drawn,'drawn');
  const before=m.uno.hands[0].map(c=>c.id),stock=m.uno.deck.length;
  Core.advanceChallenge(m,m.uno.deadline+1);
  assert.deepEqual(m.uno.hands[0].map(c=>c.id),before,'a player who already drew owes no second card');
  assert.equal(m.uno.deck.length,stock);
  assert.equal(m.uno.turn,direction===1?1:2);
  assert.equal(m.uno.drawn,null);assert.equal(m.uno.event.kind,'timeout');
 }
});

test('an expired untouched turn still draws exactly its ordinary or accumulated penalty',()=>{
 for(const penalty of [0,4]){
  const m=game(3,'stack');m.uno.pending=penalty;m.uno.pendingFace=penalty?'draw2':null;
  const before=m.uno.hands[0].length;
  Core.advanceChallenge(m,m.uno.deadline+1);
  assert.equal(m.uno.hands[0].length,before+(penalty||1));
  assert.equal(m.uno.turn,1);assert.equal(m.uno.pending,0);assert.equal(m.uno.drawn,null);
 }
});

test('a full twenty-player table exposes each numbered opponent once in seat order',async()=>{
 const h=await table(game(20),'p7');
 const seats=h.doc.querySelector('.uno-seats');
 assert.equal(seats.getAttribute('role'),'list');
 const rivals=seats.querySelectorAll('.uno-rival');
 assert.equal(rivals.length,19);
 assert.deepEqual(rivals.map(n=>n.dataset.player),['p8','p9','p10','p11','p12','p13','p14','p15','p16','p17','p18','p19','p0','p1','p2','p3','p4','p5','p6']);
 assert.equal(new Set(rivals.map(n=>n.querySelector('.uno-seat-number')?.textContent)).size,19);
 assert.match(rivals.find(n=>n.dataset.player==='p0').getAttribute('aria-label'),/دوره/);
 assert.equal(rivals.find(n=>n.dataset.player==='p0').getAttribute('aria-current'),'true');
 assert.equal(seats.querySelectorAll('[data-card]').length,0,'opponents expose counts, never their cards');
 h.clear();
});

test('a crowded private hand becomes keyboard-scrollable and sorting preserves card actions',async()=>{
 const m=game();
 m.uno.hands[0]=[card('wild','wild','wild'),card('blue','blue','8'),...Array.from({length:38},(_,i)=>card('red-'+i,'red',String(i%10)))];
 const original=m.uno.hands[0].map(c=>c.id);
 const h=await table(m),hand=h.doc.querySelector('.uno-hand');
 assert.equal(hand.classList.contains('scrollable'),true);
 assert.equal(hand.getAttribute('tabindex'),'0');
 assert.equal(hand.querySelectorAll('.uno-hand-card').length,40);
 h.doc.querySelector('.uno-sort').click();
 assert.equal(h.doc.querySelector('.uno-sort').getAttribute('aria-pressed'),'true');
 assert.deepEqual(m.uno.hands[0].map(c=>c.id),original,'sorting changes the presentation only');
 assert.equal(hand.children[0].dataset.card,'red-0');
 hand.querySelector('[data-card="red-1"]').click();
 assert.equal(h.actions[0].card,'red-1');assert.equal(m.uno.discard.at(-1).id,'red-1');
 assert.equal(m.uno.hands[0].length,39);
 h.clear();
});

test('the color dialog traps keyboard focus and Escape restores the chosen card',async()=>{
 const m=game();m.uno.hands[0].push(card('wild','wild','wild'));
 const h=await table(m),source=h.doc.querySelector('[data-card="wild"]');
 source.focus();source.click();
 const picker=h.doc.querySelector('.uno-picker'),buttons=picker.querySelectorAll('button');
 assert.equal(picker.hidden,false);assert.ok(h.doc.activeElement===buttons[0],'first color has focus');
 buttons.at(-1).focus();key(picker,'Tab');assert.ok(h.doc.activeElement===buttons[0],'first color has focus');
 key(picker,'Tab',{shiftKey:true});assert.ok(h.doc.activeElement===buttons.at(-1),'reverse Tab wraps to cancel');
 buttons[0].focus();key(picker,'ArrowDown');assert.ok(h.doc.activeElement===buttons[2],'ArrowDown moves within the color grid');
 key(picker,'Escape');assert.equal(picker.hidden,true);assert.ok(h.doc.activeElement===source,'cancel restores the original card');
 assert.equal(h.actions.length,0);
 source.click();buttons[2].click();
 assert.equal(m.uno.color,'green');assert.equal(h.actions[0].card,'wild');
 assert.equal(picker.hidden,true);assert.ok(h.doc.activeElement===h.doc.querySelector('.uno-sort'),'closed dialog leaves focus on a stable hand control');
 h.clear();
});

test('a color dialog closes safely when the server advances the turn',async()=>{
 const m=game();m.uno.hands[0].push(card('wild','wild','wild'));
 const h=await table(m);h.doc.querySelector('[data-card="wild"]').click();
 Core.advanceChallenge(m,m.uno.deadline+1);h.render();
 assert.equal(h.doc.querySelector('.uno-picker').hidden,true);
 assert.equal(h.doc.querySelector('.uno-dock').inert,false);
 assert.ok(h.doc.activeElement===h.doc.querySelector('.uno-sort'),'closed dialog leaves focus on a stable hand control');
 h.clear();
});
