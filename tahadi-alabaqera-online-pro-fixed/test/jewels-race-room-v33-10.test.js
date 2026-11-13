import test from 'node:test';
import assert from 'node:assert/strict';
import {startTable,playerMove,timeoutMove,tableOver,winnerSeats} from '../src/games/board-tables.js';
import {legalRaceSwaps} from '../public/assets/js/engines/jewels-race-engine.js';

function room(humans=2){
 const r={game:'jewels',variant:'classic',status:'lobby',players:{a:{id:'a',name:'أ',connected:true}},order:['a'],version:0};
 if(humans===2){r.players.b={id:'b',name:'ب',connected:true};r.order.push('b');}
 startTable(r,{rng:()=>.24,now:1000});return r;
}
function play(r,seat){const [a,b]=legalRaceSwaps(r.state,seat)[0];return playerMove(r,seat,{type:'jewels_swap',a,b,seq:r.state.players[seat].seq},()=>.4,undefined,1100);}

test('rooms create independent score runs and accept either player without a turn gate',()=>{
 const r=room();assert.equal(r.state.mode,'race');assert.equal(r.state.endsAt,181000);
 play(r,1);play(r,1);play(r,0);
 assert.equal(r.state.players[1].used,2);assert.equal(r.state.players[0].used,1);
 assert.equal(r.status,'playing');
});
test('a duplicated own sequence is rejected after an opponent update without spending a second action',()=>{
 const r=room();const [a,b]=legalRaceSwaps(r.state,0)[0];play(r,0);play(r,1);
 const before=structuredClone(r.state);
 assert.throws(()=>playerMove(r,0,{type:'jewels_swap',a,b,seq:0},()=>.4,undefined,1100),/stale_move/);
 assert.deepEqual(r.state,before);
});
test('one run finishing does not finish the room; a score tie has no fictitious winner seat',()=>{
 const r=room();
 for(let n=0;n<25;n++)play(r,0);
 assert.equal(tableOver(r),false);
 for(let n=0;n<25;n++)play(r,1);
 assert.equal(tableOver(r),true);assert.equal(r.state.winner,-1);assert.deepEqual(winnerSeats(r),[]);
});
test('bots progress on their own schedule and never spend a human action',()=>{
 const r=room(1);assert.equal(r.state.players[0].used,0);assert.equal(r.state.players[1].used,0);
 assert.ok(r.jewelsBotAt>1000&&r.jewelsBotAt<r.state.endsAt);
 timeoutMove(r,()=>.4,undefined,r.jewelsBotAt);
 assert.equal(r.state.players[1].used,1);assert.equal(r.state.players[0].used,0);
 play(r,0);assert.equal(r.state.players[1].used,1);
});
test('the match deadline stops unfinished runs rather than auto-playing human moves',()=>{
 const r=room();play(r,0);
 timeoutMove(r,()=>.4,undefined,r.state.endsAt);
 assert.equal(tableOver(r),true);assert.equal(r.state.winner,0);
 assert.equal(r.state.players[0].used,1);assert.equal(r.state.players[1].used,0);
});
test('human and bot each finish 25 actions without a shared turn or an extended deadline',()=>{
 const r=room(1),end=r.state.endsAt;for(let n=0;n<25;n++)play(r,0);assert.equal(r.state.players[1].used,0);
 let alarms=0;while(!tableOver(r)&&alarms++<30){assert.ok(r.jewelsBotAt<end);timeoutMove(r,()=>.4,undefined,r.jewelsBotAt);}
 assert.equal(alarms,25);assert.equal(tableOver(r),true);assert.deepEqual(r.state.players.map(p=>p.used),[25,25]);assert.equal(r.jewelsBotAt,null);
});
