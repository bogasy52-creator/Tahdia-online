import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import * as Jack from '../public/assets/js/engines/jackaroo-engine.js';
import {boardGeometry} from '../public/assets/js/engines/board-geometry-v29.js';
import {chooseJackarooMove} from '../public/assets/js/engines/bot-strategy.js';
import {createDOM} from './dom-harness.mjs';
import {petalStonePoint} from '../public/assets/js/board-petals-v29.js';
import {startTable,seatPlan,playerMove,chosenSeats,seatsFor} from '../src/games/board-tables.js';
const names=['أ','ب','ج','د','هـ','و'];
const six=()=>Jack.createJackarooGame(names,{arm:19,home:'fill'});
const seeded=s=>()=>{s|=0;s=s+0x6d2b79f5|0;let t=Math.imul(s^s>>>15,1|s);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296;};

test('six-seat home requires twelve distinct team marbles, and a finished player helps both teammates',()=>{
 const s=six(),{track,finish}=boardGeometry(s);assert.equal(track,114);assert.equal(finish,117);
 s.turn=0;s.hands[0]=['AS'];s.players[0].marbles=[114,115,116,117];
 assert.ok(Jack.getJackarooActions(s,0).some(a=>a.type==='enter'&&a.owner===2));
 s.players[2].marbles=[114,115,116,117];
 assert.equal(Jack.teamWinner(s),null);assert.ok(Jack.getJackarooActions(s,0).some(a=>a.type==='enter'&&a.owner===4));
 s.players[4].marbles=[114,115,116,117];assert.equal(Jack.teamWinner(s),0);
});
test('six-seat gate skips the last track hole, cannot jump occupied homes, and a seven splits legally',()=>{
 const s=six();s.turn=0;s.hands[0]=['2S','7S'];s.players[0].marbles=[112,4,-1,-1];
 const a=Jack.getJackarooActions(s,0).find(a=>a.type==='move'&&a.marble===0);assert.ok(a);
 assert.equal(Jack.playJackarooAction(s,0,a).players[0].marbles[0],115);
 const split=Jack.getJackarooActions(s,1).find(a=>a.type==='split7'&&a.first.marble===0&&a.first.steps===3&&a.second.marble===1);
 assert.ok(split);const after=Jack.playJackarooAction(s,1,split);assert.deepEqual(after.players[0].marbles.slice(0,2),[116,8]);
 s.players[0].marbles=[112,114,-1,-1];assert.equal(Jack.getJackarooActions(s,0).some(a=>a.type==='move'&&a.marble===0),false);
 assert.throws(()=>Jack.playJackarooAction(s,0,a,1),/wrong_turn/);
});
test('new six-seat classic matches finish with legal positions, no duplicate cards or live track overlaps',()=>{
 for(let seed=1;seed<=3;seed++){
  const rng=seeded(seed*991);let s=Jack.createJackarooGame(names,{rng,arm:19,home:'fill'}),turns=0;
  while(s.winnerTeam===null&&turns++<4000){
   const m=chooseJackarooMove(s,'medium',rng);s=Jack.playJackarooAction(s,m.cardIndex,m.action);
   const live=new Set();for(let seat=0;seat<6;seat++)for(const p of s.players[seat].marbles){assert.ok(Number.isInteger(p)&&p>=-1&&p<=117);if(p>=0&&p<114){const pos=Jack.globalJackarooPosition(seat,p,s);assert.ok(!live.has(pos),'track cannot contain overlapping live marbles');live.add(pos);}}
   const cards=[...s.deck,...s.hands.flat(),...s.discard];assert.equal(new Set(cards).size,cards.length,'no duplicate card after six-player redeals');
  }
  assert.notEqual(s.winnerTeam,null,'six-player match '+seed+' finishes');
 }
});
test('six-seat choice reaches the actual board and the first three humans are teammates',()=>{
 assert.equal(chosenSeats('jackaroo',6),6);assert.equal(chosenSeats('zahra',6),6);assert.equal(chosenSeats('zahra',6,'ludo'),6);
 assert.equal(seatsFor('jackaroo',3,false,6),6);assert.equal(seatsFor('jackaroo',1,true),6);assert.equal(seatsFor('jackaroo',1,true,4),4);assert.deepEqual(seatPlan('jackaroo',['a','b','c','d','e','f'],6),['a','d','b','e','c','f']);
 for(const game of ['zahra','jackaroo']){
  const room={game,variant:'classic',tableSeats:6,status:'lobby',version:0,order:['a','b'],players:{a:{name:'A',connected:true},b:{name:'B',connected:true}}};
  startTable(room,{rng:seeded(101)});assert.equal(room.state.players.length,6);if(game==='jackaroo'){assert.equal(room.state.arm,19);assert.equal(room.state.home,'fill');}
 }
});
test('every six-seat track and home position lands on the corresponding drawn hole',async()=>{
 const h=await createDOM('jackaroo.html',{...Jack}),target=h.doc.createElement('div'),state=six();
 h.context.args={target,state,options:{game:'jackaroo',viewer:0}};
 vm.runInContext('renderPetalBoard(args.target,args.state,args.options)',h.context);
 assert.equal(target.querySelectorAll('[data-track]').length,114);assert.equal(target.querySelectorAll('[data-home]').length,24);
 assert.equal(target.querySelectorAll('[data-yard]').length,24);assert.equal(target.querySelectorAll('[data-finish-cup]').length,0);
 assert.equal(target.querySelectorAll('[data-player-tag]').length,6);assert.equal(target.querySelectorAll('[data-track-number]').length,108);
 for(let seat=0;seat<6;seat++)for(let progress=0;progress<=117;progress++){
  state.players[seat].marbles[0]=progress;
  const point=petalStonePoint(state,seat,0,'jackaroo');
  const hole=target.querySelector(progress<114?'[data-track="'+Jack.globalJackarooPosition(seat,progress,state)+'"]':'[data-home="'+seat+':'+(progress-114)+'"]');
  assert.ok(Math.hypot(point.x-Number(hole.getAttribute('cx')),point.y-Number(hole.getAttribute('cy')))<.001,seat+':'+progress);
  state.players[seat].marbles[0]=-1;
 }
});
test('die tap and keyboard cannot send duplicate rolls, bank without points, or roll out of turn',async()=>{
 const h=await createDOM('dice.html');await h.runInline();const table=h.context.tables[0];
 const state={players:[{name:'A',score:0},{name:'B',score:0}],turn:0,turnTotal:0,target:50,winner:null};
 const room={code:'550001',status:'playing',version:1,me:{id:'a',index:0,role:'host'},players:[{id:'a',name:'A',index:0},{id:'b',name:'B',index:1}],state};
 await table.apply(room);const die=h.doc.getElementById('myDieBox');assert.equal(die.getAttribute('aria-disabled'),'false');
 die.click();die.click();assert.equal(table.sent.length,1);assert.equal(table.sent[0].type,'dice_roll');assert.equal(die.getAttribute('aria-disabled'),'true');
 state.turn=1;await table.apply({...room,version:2,state});die.onkeydown({key:'Enter',preventDefault(){}});assert.equal(table.sent.length,1);
 state.turn=0;await table.apply({...room,version:3,state});die.onkeydown({key:' ',preventDefault(){}});assert.equal(table.sent.length,2);
 assert.equal(h.doc.getElementById('bank').disabled,true);
});
