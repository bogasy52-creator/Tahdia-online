import test from 'node:test';
import assert from 'node:assert/strict';
import {createSnakesGame,playSnakesRoll} from '../public/assets/js/engines/snakes-engine.js';
import * as enhanced from '../public/assets/js/engines/snakes-adventure.js';

test('a player outside the board must roll six; six enters cell one and keeps the turn',()=>{
 const original=createSnakesGame(['A','B']);
 for(const roll of [1,2,3,4,5]){
  const s=playSnakesRoll(original,roll);
  assert.equal(s.players[0].position,0);assert.equal(s.lastEvent.waitingEntry,true);assert.equal(s.turn,1);
 }
 const entered=playSnakesRoll(original,6);
 assert.equal(entered.players[0].position,1);assert.equal(entered.lastEvent.entered,true);assert.equal(entered.turn,0);
 assert.equal(playSnakesRoll(entered,2).players[0].position,3);assert.equal(original.players[0].position,0);
});
test('enhanced rewards only trigger on the three marked cells',()=>{
 assert.equal(typeof enhanced.createEnhancedGame,'function');
 assert.deepEqual(enhanced.BONUS_CELLS,[12,46,82]);
 const s=enhanced.createEnhancedGame(['A','B']);s.players[0].position=10;
 const normal=enhanced.playEnhancedTurn(s,[1],{bonusRoll:1});
 assert.equal(normal.lastEvent.bonusRoll,null);assert.equal(normal.players[0].shield,0);
 const bonus=enhanced.playEnhancedTurn(s,[2],{bonusRoll:1});
 assert.equal(bonus.lastEvent.bonusRoll,1);assert.equal(bonus.players[0].shield,1);
 assert.equal(bonus.players[0].position,12);
});
test('one earned shield is automatically consumed by one snake fall',()=>{
 const s=enhanced.createEnhancedGame(['A','B']);s.players[0].position=16;s.players[0].shield=1;
 const first=enhanced.playEnhancedTurn(s,[1]);
 assert.equal(first.players[0].position,17);assert.equal(first.players[0].shield,0);assert.equal(first.lastEvent.protected,true);
 first.turn=0;first.players[0].position=16;
 const second=enhanced.playEnhancedTurn(first,[1]);assert.equal(second.players[0].position,7);
});
test('the extra-turn symbol grants exactly two subsequent turns',()=>{
 const s=enhanced.createEnhancedGame(['A','B']);s.players[0].position=10;
 const a=enhanced.playEnhancedTurn(s,[2],{bonusRoll:2});assert.equal(a.turn,0);
 const b=enhanced.playEnhancedTurn(a,[1]);assert.equal(b.turn,0);
 const c=enhanced.playEnhancedTurn(b,[1]);assert.equal(c.turn,1);assert.equal(c.players[0].bonusTurns,0);
});
test('a reward cannot defeat entry gating or exact finish and double dice require inventory',()=>{
 const s=enhanced.createEnhancedGame(['A','B']);
 assert.equal(enhanced.playEnhancedTurn(s,[5],{bonusRoll:2}).players[0].position,0);
 assert.throws(()=>enhanced.playEnhancedTurn(s,[2,3],{power:'double'}),/power_unavailable/);
 s.players[0].position=97;
 assert.equal(enhanced.playEnhancedTurn(s,[4],{bonusRoll:4}).players[0].position,97);
});
test('reward movement resolves its destination snake and freeze skips just one turn',()=>{
 const s=enhanced.createEnhancedGame(['A','B']);s.players[0].position=80;
 const boosted=enhanced.playEnhancedTurn(s,[2],{bonusRoll:5});
 assert.equal(boosted.lastEvent.eventLanding,87);assert.equal(boosted.players[0].position,24);
 assert.equal(boosted.lastEvent.bonusJumpType,'snake');
 const frozen=enhanced.playEnhancedTurn(s,[2],{bonusRoll:6});assert.equal(frozen.turn,0);assert.equal(frozen.players[1].frozen,0);
 assert.deepEqual(frozen.lastEvent.skipped,[1]);
});

test('enhanced matches finish with earned powers and keep every player inside the board',()=>{
 let seed=9011;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed};
 const die=()=>random()%6+1;
 for(let match=0;match<80;match++){
  let state=enhanced.createEnhancedGame(['A','B','C']);
  for(let move=0;move<5000&&state.winner===null;move++){
   const player=state.players[state.turn],power=player.position>0&&player.double>0&&random()%2?'double':null;
   const rolls=power?[die(),die()]:[die()],landed=enhanced.enhancedLanding(state,rolls);
   state=enhanced.playEnhancedTurn(state,rolls,{power,bonusRoll:enhanced.BONUS_CELLS.includes(landed)?die():null});
   for(const p of state.players){assert.ok(p.position>=0&&p.position<=100);assert.ok(p.shield>=0&&p.shield<=1);assert.ok(p.double>=0&&p.double<=2);assert.ok(p.bonusTurns>=0&&p.bonusTurns<=4)}
  }
  assert.notEqual(state.winner,null,'enhanced match must finish');assert.equal(state.players[state.winner].position,100);
 }
});
