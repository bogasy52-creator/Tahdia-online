import test from 'node:test';
import assert from 'node:assert/strict';
import {createJackarooGame, getJackarooActions, playJackarooAction, previewJackarooAction, jackarooHandDead, burnJackarooHand} from '../public/assets/js/engines/jackaroo-engine.js';
import {landingOf, landingSpot} from '../public/assets/js/jackaroo-play-v33-8.js';

function table(cards=['2S']) {
  const s=createJackarooGame(['أ','ب','ج','د'],{arm:19,home:'fill',dealer:1,rng:()=>.4});
  s.turn=0;s.hands=[cards,['2H'],['3H'],['6H']];
  return s;
}
const move=(s,card=0,marble=0)=>getJackarooActions(s,card).find(a=>a.type==='move'&&a.owner===0&&a.marble===marble);

test('a printed star is capturable and cannot contain two live marbles',()=>{
  const s=table();s.players[0].marbles[0]=6;s.players[1].marbles[0]=65; // global 8
  const next=playJackarooAction(s,0,move(s));
  assert.equal(next.players[0].marbles[0],8);
  assert.equal(next.players[1].marbles[0],-1);
  assert.deepEqual(next.lastEvent.move.captured,[{player:1,marble:0}]);
});
test('entry captures a visiting marble on the entering player\'s base',()=>{
  const s=table(['AS']);s.players[1].marbles[0]=57; // global 0, not its own base
  const enter=getJackarooActions(s,0).find(a=>a.type==='enter'&&a.marble===0);
  const next=playJackarooAction(s,0,enter);
  assert.equal(next.players[0].marbles[0],0);
  assert.equal(next.players[1].marbles[0],-1);
});
test('ordinary forward and backward moves cannot jump the owner\'s marble',()=>{
  const s=table(['3S','4S']);s.players[0].marbles=[3,5,9,-1];
  assert.equal(move(s,0,0),undefined);
  assert.equal(move(s,1,2),undefined);
});
test('the king removes own marbles and visiting marbles on printed stars',()=>{
  const s=table(['KS']);s.players[0].marbles=[3,5,16,-1];s.players[1].marbles[0]=65;
  const a=move(s);assert.ok(a,'King may land on its own unprotected marble');
  const next=playJackarooAction(s,0,a);
  assert.deepEqual(next.players[0].marbles,[16,-1,-1,-1]);
  assert.equal(next.players[1].marbles[0],-1);
  assert.equal(next.lastEvent.move.captured.length,3);
});
test('a marble on its own base blocks even the king, the jack and an opposing five',()=>{
  const s=table(['KS','JS','5S']);s.players[0].marbles=[7,8,-1,-1];s.players[1].marbles[0]=0;
  assert.equal(move(s,0,0),undefined);
  assert.ok(!getJackarooActions(s,1).some(a=>a.type==='swap'&&(a.otherOwner===1||a.owner===1)));
  assert.ok(!getJackarooActions(s,2).some(a=>a.type==='moveAny5'&&a.owner===1));
});
test('the jack can swap a marble on a printed star but not a protected own start',()=>{
  const s=table(['JS']);s.players[0].marbles=[8,0,-1,-1];s.players[1].marbles[0]=5;
  const swaps=getJackarooActions(s,0).filter(a=>a.type==='swap');
  assert.ok(swaps.some(a=>a.marble===0&&a.otherOwner===1));
  assert.ok(!swaps.some(a=>a.marble===1));
});
test('a dead selected card cannot be burned while another card can play',()=>{
  const s=table(['2S','AS']);
  assert.deepEqual(getJackarooActions(s,0),[]);
  assert.equal(jackarooHandDead(s),false);
  assert.throws(()=>playJackarooAction(s,0,{type:'discard'}),/illegal/);
  assert.throws(()=>burnJackarooHand(s),/hand_can_move/);
});
test('a wholly dead hand still permits a discard or one complete-hand burn',()=>{
  const s=table(['2S','3S']);
  assert.deepEqual(getJackarooActions(s,0),[{type:'discard'}]);
  const next=burnJackarooHand(s);
  assert.deepEqual(next.hands[0],[]);assert.equal(next.turn,3);
  assert.deepEqual(s.hands[0],['2S','3S']);
});
test('an opposing five carries a marble past its gate instead of into its home',()=>{
  const s=table(['5S']);s.players[1].marbles[0]=74;
  const a=getJackarooActions(s,0).find(a=>a.type==='moveAny5'&&a.owner===1);
  assert.ok(a);
  const next=playJackarooAction(s,0,a);
  assert.equal(next.players[1].marbles[0],3);
  assert.equal(previewJackarooAction(s,a,'5S').players[1].marbles[0],3);
});
test('home lane occupancy still blocks the king and exact home movement is required',()=>{
  const s=table(['KS','2S']);s.players[0].marbles=[65,77,-1,-1];
  assert.equal(move(s,0,0),undefined);
  s.players[0].marbles[0]=78;
  assert.equal(move(s,1,0),undefined);
});

test('the board picker puts an opposing five beyond the gate on the track',()=>{
  const s=table(['5S']);s.players[1].marbles[0]=74;
  assert.deepEqual(landingSpot(s,1,0,5,false,false,false),{kind:'track',at:22});
  assert.equal(landingOf({querySelector: selector=>selector},s,1,0,5,false,false),'[data-track="22"]');
});
