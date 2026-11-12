import test from 'node:test';import assert from 'node:assert/strict';
import {createJackarooGame,getJackarooActions,playJackarooAction,teamWinner,globalJackarooPosition} from '../public/assets/js/engines/jackaroo-engine.js';
function withHand(rank){const s=createJackarooGame(['أ','ب','ج','د']);s.hands[0]=[rank];s.turn=0;return s}
test('ace can enter or move 1/11',()=>{let s=withHand('A');let actions=getJackarooActions(s,0);assert.ok(actions.some(a=>a.type==='enter'));s.players[0].marbles[0]=3;actions=getJackarooActions(s,0);assert.ok(actions.some(a=>a.type==='move'&&a.steps===1));assert.ok(actions.some(a=>a.type==='move'&&a.steps===11))});
test('four moves backward and jack swaps eligible marbles',()=>{let s=withHand('4');s.players[0].marbles[0]=10;let a=getJackarooActions(s,0).find(x=>x.type==='move');s=playJackarooAction(s,0,a);assert.equal(s.players[0].marbles[0],6);s=withHand('J');s.players[0].marbles[0]=5;s.players[1].marbles[0]=7;const swap=getJackarooActions(s,0).find(x=>x.type==='swap');s=playJackarooAction(s,0,swap);assert.equal(globalJackarooPosition(0,s.players[0].marbles[0]),20);assert.equal(globalJackarooPosition(1,s.players[1].marbles[0]),5)});
test('seven can split across two marbles',()=>{let s=withHand('7');s.players[0].marbles[0]=2;s.players[0].marbles[1]=8;const split=getJackarooActions(s,0).find(a=>a.type==='split7'&&a.first.steps===3&&a.second.steps===4);assert.ok(split);s=playJackarooAction(s,0,split);assert.deepEqual(s.players[0].marbles.slice(0,2),[5,12])});

test('seven can move a single marble the full seven steps',()=>{let s=withHand('7');s.players[0].marbles[0]=9;const move=getJackarooActions(s,0).find(a=>a.type==='move'&&a.steps===7);assert.ok(move);s=playJackarooAction(s,0,move);assert.equal(s.players[0].marbles[0],16)});
test('team win requires all eight partner marbles complete',()=>{const s=createJackarooGame(['أ','ب','ج','د']);s.players[0].marbles.fill(56);s.players[2].marbles.fill(56);assert.equal(teamWinner(s),0)});

test('five can move your own marble from a safe square, but cannot move an opponent from safety',()=>{
 let s=withHand('5');s.players[0].marbles[0]=0;s.players[1].marbles[0]=0;
 const actions=getJackarooActions(s,0);
 assert.ok(actions.some(a=>a.type==='moveAny5'&&a.owner===0&&a.marble===0));
 assert.ok(!actions.some(a=>a.type==='moveAny5'&&a.owner===1&&a.marble===0));
 s=playJackarooAction(s,0,actions.find(a=>a.type==='moveAny5'&&a.owner===0));
 assert.equal(s.players[0].marbles[0],5);
});
test('jack can swap a printed-star marble but cannot swap a protected own start',()=>{
 const s=withHand('J');s.players[0].marbles[0]=8;s.players[1].marbles[0]=7;s.players[1].marbles[1]=0;
 const swaps=getJackarooActions(s,0).filter(a=>a.type==='swap');
 assert.ok(swaps.some(a=>a.owner===0&&a.marble===0&&a.otherMarble===0));
 assert.ok(!swaps.some(a=>a.otherOwner===1&&a.otherMarble===1));
});
test('five never targets a marble already in its home lane',()=>{
 const s=createJackarooGame(['أ','ب','ج','د'],{arm:19,home:'fill'});s.turn=0;s.hands[0]=['5S'];s.players[1].marbles[0]=s.arm*4;
 assert.ok(!getJackarooActions(s,0).some(a=>a.type==='moveAny5'&&a.owner===1));
});
