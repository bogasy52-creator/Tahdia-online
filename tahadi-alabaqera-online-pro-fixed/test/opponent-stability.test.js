import test from 'node:test';
import assert from 'node:assert/strict';
import * as bots from '../public/assets/js/engines/baloot-bot.js';
import {createBalootMatch,balootView,balootActions,applyBalootAction} from '../public/assets/js/engines/baloot-engine.js';
import {startBalootRoom,applyBalootMove,balootPlayers} from '../src/games/baloot-server.js';
import {chooseJackarooMove,chooseLudoMove} from '../public/assets/js/engines/bot-strategy.js';
import {createJackarooGame,getJackarooActions} from '../public/assets/js/engines/jackaroo-engine.js';
import {createLudoGame,getLegalLudoMoves} from '../public/assets/js/engines/ludo-engine.js';
import {boardGeometry} from '../public/assets/js/engines/board-geometry-v29.js';

function seeded(n){return()=>{n^=n<<13;n^=n>>>17;n^=n<<5;return(n>>>0)/4294967296;};}
const names=n=>Array.from({length:n},(_,i)=>'Player '+i);
test('Baloot styles are reproducible, bounded and varied within each difficulty',()=>{
  assert.equal(typeof bots.createBalootProfile,'function');
  for(const level of ['easy','medium','hard']){
    assert.deepEqual(bots.createBalootProfile(level,seeded(42)),bots.createBalootProfile(level,seeded(42)));
    const rng=seeded(104),styles=new Set();
    for(let i=0;i<40;i++){
      const profile=bots.createBalootProfile(level,rng);styles.add(JSON.stringify(profile));
      for(const key of ['noise','catch','cut'])assert.ok(Number.isFinite(profile[key])&&profile[key]>=0&&profile[key]<=1);
      assert.ok(profile.bid>.5&&profile.bid<2);assert.ok(profile.sun>3&&profile.sun<7);
    }
    assert.ok(styles.size>30);
  }
});
test('private Baloot styles affect bidding decisions without changing the permitted bids',()=>{
  let differing=0;
  for(let seed=1;seed<=120;seed++){
    const s=createBalootMatch({rng:seeded(seed)}),seat=s.turn,view=balootView(s,seat);
    const low={...bots.BOT_LEVELS.medium,bid:.82,sun:4.1},high={...bots.BOT_LEVELS.medium,bid:1.35,sun:5.2};
    const a=bots.chooseBalootAction(view,seat,{level:'medium',profile:low,rng:()=>.9});
    const b=bots.chooseBalootAction(view,seat,{level:'medium',profile:high,rng:()=>.9});
    assert.ok(balootActions(s,seat).some(x=>JSON.stringify(x)===JSON.stringify(a)));
    assert.ok(balootActions(s,seat).some(x=>JSON.stringify(x)===JSON.stringify(b)));
    if(JSON.stringify(a)!==JSON.stringify(b))differing++;
  }
  assert.ok(differing>10,'cautious and confident styles make different bids');
});
test('room styles persist through moves, remain private and refresh for a new match',()=>{
  const human={id:'h',name:'سعد',seat:0,role:'host',connected:true};
  const room={players:{h:human},open:false},rng=seeded(70);startBalootRoom(room,rng,1000);
  assert.equal(Object.keys(room.botProfiles||{}).length,3);
  const profiles=structuredClone(room.botProfiles);
  for(let n=0;n<16&&['bidding','doubling','playing'].includes(room.state.phase);n++){
    const action=balootActions(room.state).find(x=>x.bid==='pass'||x.call==='pass')||balootActions(room.state)[0];
    applyBalootMove(room,human,action,rng,2000+n);
    assert.deepEqual(room.botProfiles,profiles);
  }
  assert.ok(balootPlayers(room).every(player=>!('profile'in player)));
  startBalootRoom(room,seeded(71),3000);assert.notDeepEqual(room.botProfiles,profiles);
  delete room.botProfiles;assert.doesNotThrow(()=>applyBalootMove(room,human,balootActions(room.state)[0],rng,4000));
});
for(const seats of [4,6])for(const actor of [seats-2,seats-1]){
  test(`Jackaroo ${seats} seats: seat ${actor} values its actual finish above entry`,()=>{
    const s=createJackarooGame(names(seats),{rng:seeded(8)}),g=boardGeometry(s);s.turn=actor;
    s.players[actor].marbles=[g.finish-1,1,-1,-1];s.hands[actor]=['AS'];
    const move=chooseJackarooMove(s,'hard',()=>0);
    assert.deepEqual(move,{cardIndex:0,action:{type:'move',owner:actor,marble:0,steps:1,backward:false}});
    assert.ok(getJackarooActions(s,move.cardIndex).some(a=>JSON.stringify(a)===JSON.stringify(move.action)));
  });
}
test('Jackaroo move evaluation never deals or shuffles a speculative next hand',()=>{
  const s=createJackarooGame(names(6),{rng:seeded(9)});s.turn=4;s.players[4].marbles=[1,-1,-1,-1];
  s.hands=names(6).map((_,i)=>i===4?['AS']:[]);s.deck=[];const before=structuredClone(s);
  const original=Math.random;Math.random=()=>{throw Error('unexpected speculative shuffle');};
  try{assert.doesNotThrow(()=>chooseJackarooMove(s,'hard',()=>0));}finally{Math.random=original;}
  assert.deepEqual(s,before);
});
test('six-seat Zahra values finishing at 82 above merely reaching cell 56',()=>{
  const s=createLudoGame(names(6));s.turn=5;s.players[5].tokens=[81,55,-1,-1];
  assert.deepEqual(getLegalLudoMoves(s,1),[0,1]);assert.equal(chooseLudoMove(s,1,'hard',()=>0),0);
});
test('equally good Zahra moves vary instead of always choosing the first token',()=>{
  const s=createLudoGame(names(4));s.players[0].tokens=[10,10,-1,-1];
  assert.equal(chooseLudoMove(s,1,'hard',()=>0),0);assert.equal(chooseLudoMove(s,1,'hard',()=>.99),1);
});
test('varied Baloot profiles finish whole matches using only masked seat views',()=>{
  assert.equal(typeof bots.createBalootProfile,'function');
  for(const seed of [17,49,82]){
    const rng=seeded(seed),profiles=Array.from({length:4},(_,i)=>bots.createBalootProfile(['easy','medium','hard'][i%3],rng));
    let s=createBalootMatch({rng,open:false}),moves=0;
    while(s.phase!=='finished'&&moves++<8000){
      if(s.phase==='scored'){s=applyBalootAction(s,null,{type:'next'},rng).state;continue;}
      const view=balootView(s,s.turn);assert.ok(view.hands.filter((_,i)=>i!==s.turn).flat().every(c=>c==='??'));
      const action=bots.chooseBalootAction(view,s.turn,{profile:profiles[s.turn],rng,honest:true});
      s=applyBalootAction(s,s.turn,action,rng).state;
    }
    assert.equal(s.phase,'finished');
  }
});
