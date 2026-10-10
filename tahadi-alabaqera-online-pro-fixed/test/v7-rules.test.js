import test from 'node:test';
import assert from 'node:assert/strict';
import * as Adventure from '../public/assets/js/engines/snakes-adventure.js';
import {chooseJackarooMove,chooseLudoMove,chooseSnakePower} from '../public/assets/js/engines/bot-strategy.js';
import {createJackarooGame,getJackarooActions} from '../public/assets/js/engines/jackaroo-engine.js';
import {createLudoGame,getLegalLudoMoves} from '../public/assets/js/engines/ludo-engine.js';
import {Career} from '../src/career/core.js';

test('shield prevents one snake fall without changing the die',()=>{
 const s=Adventure.createAdventureGame(['A','B']);s.players[0].position=16;s.players[0].shield=1;
 const n=Adventure.playAdventureTurn(s,[1],{power:'shield',event:null});
 assert.equal(n.players[0].position,17);assert.equal(n.players[0].shield,0);assert.equal(n.lastRoll,1);assert.equal(n.lastEvent.protected,true);assert.equal(s.players[0].position,16);
});
test('boost and shortcut cannot bypass exact finish',()=>{
 const s=Adventure.createAdventureGame(['A','B']);s.players[0].position=92;
 const n=Adventure.playAdventureTurn(s,[5],{event:'boost'});
 assert.equal(n.players[0].position,100);assert.equal(n.winner,0);
});
test('freeze skips exactly one upcoming turn',()=>{
 const s=Adventure.createAdventureGame(['A','B']);s.players[1].frozen=1;
 const n=Adventure.playAdventureTurn(s,[2],{event:null});
 assert.equal(n.turn,0);assert.equal(n.players[1].frozen,0);assert.deepEqual(n.lastEvent.skipped,[1]);
});
test('double dice requires inventory and uses both fair results',()=>{
 const s=Adventure.createAdventureGame(['A','B']);s.players[0].position=92;s.players[0].double=1;
 const n=Adventure.playAdventureTurn(s,[6,2],{power:'double',event:null});
 assert.equal(n.players[0].position,100);assert.equal(n.players[0].double,0);assert.equal(n.winner,0);
 const empty=Adventure.createAdventureGame(['A','B']);empty.players[0].double=0;assert.throws(()=>Adventure.playAdventureTurn(empty,[6,2],{power:'double'}),/power_unavailable/);
});
test('adventure simulation completes and never leaves the board',()=>{
 for(let g=0;g<30;g++){
  let s=Adventure.createAdventureGame(['A','B','C']);
  for(let i=0;i<4000&&s.winner===null;i++){
   const roll=(i*7+g*3)%6+1;s=Adventure.playAdventureTurn(s,[roll],{event:i%8===0?'boost':null});
   assert.ok(s.players.every(p=>p.position>=0&&p.position<=100));
  }
 }
});
test('hard Jackaroo bot prefers finishing and returns an action in its own legal hand',()=>{
 const s=createJackarooGame(['A','B','C','D']);s.turn=0;s.hands[0]=['QS','AS'];s.players[0].marbles=[44,-1,-1,-1];
 const pick=chooseJackarooMove(s,'hard',()=>0);
 assert.equal(pick.cardIndex,0);assert.equal(pick.action.marble,0);
 assert.ok(getJackarooActions(s,pick.cardIndex).some(a=>JSON.stringify(a)===JSON.stringify(pick.action)));
});
test('Ludo bot prioritizes finishing and handles no legal moves',()=>{
 const s=createLudoGame(['A','B']);s.players[0].tokens=[54,-1,-1,-1];
 assert.equal(chooseLudoMove(s,2,'hard'),0);assert.equal(chooseLudoMove(createLudoGame(['A','B']),2,'hard'),null);
 assert.ok(getLegalLudoMoves(s,2).includes(chooseLudoMove(s,2,'medium')));
});
test('Snake bot uses shield near a costly snake and cannot invent inventory',()=>{
 const s=Adventure.createAdventureGame(['A','B']);s.players[0].position=83;
 assert.equal(chooseSnakePower(s,'hard'),'shield');s.players[0].shield=0;s.players[0].double=0;
 assert.equal(chooseSnakePower(s,'hard'),null);
});
test('daily reward is once per Riyadh day and increases on consecutive days',()=>{
 const time=Date.parse('2026-10-10T22:00:00Z'),p=Career.claimDaily(Career.normalize(),{now:time}),twice=Career.claimDaily(p,{now:time+1000});
 assert.equal(p.dailyDay,'2026-10-11');assert.equal(p.coins,130);assert.equal(twice.coins,130);
 const next=Career.claimDaily(p,{now:time+86400000});assert.equal(next.dailyStreak,2);assert.equal(next.coins,170);
 const gap=Career.claimDaily(next,{now:time+86400000*3});assert.equal(gap.dailyStreak,1);
});
test('daily offer is real, affordable purchase uses shared discounted price',()=>{
 const now=Date.parse('2026-10-11T03:00:00Z'),offer=Career.dailyOffer(now),item=Career.CATALOG.find(i=>i.id===offer.id);
 assert.ok(item.price>=300);assert.equal(offer.price,Math.floor(item.price*.8));
 const p=Career.purchase({coins:offer.price},item.id,{now});assert.equal(p.coins,0);assert.ok(p.owned.includes(item.id));
 assert.throws(()=>Career.purchase({coins:offer.price-1},item.id,{now}),/insufficient_coins/);
});
