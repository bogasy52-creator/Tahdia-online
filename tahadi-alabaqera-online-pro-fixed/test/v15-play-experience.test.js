import test from 'node:test';
import assert from 'node:assert/strict';
import {createDOM} from './dom-harness.mjs';
import * as snakes from '../public/assets/js/engines/snakes-engine.js';
import * as adventure from '../public/assets/js/engines/snakes-adventure.js';
import * as motion from '../public/assets/js/snakes-v4-fx.js';
import {chooseSnakePower} from '../public/assets/js/engines/bot-strategy.js';
async function board(){const h=await createDOM('snakes.html');h.context.requestAnimationFrame=()=>0;Object.assign(h.context,snakes,adventure,motion,{chooseSnakePower});await h.runFile('assets/js/play-insights-v15.js');await h.runInline('globalThis.playHooks={state:()=>state,journal,runAnimation};');return h;}
// 33.0.0: a match starts when the room sends its first state (no local presets any more)
async function start(h,variant='classic'){const state=variant==='adventure'?adventure.createEnhancedGame(['A','B']):snakes.createSnakesGame(['A','B']);await h.context.tables.at(-1).apply({code:'401234',status:'playing',variant,version:1,me:{id:'a',index:0},players:[{id:'a',index:0,name:'A'},{id:'b',index:1,name:'B',bot:true,level:'easy'}],state});}
test('both rule sets (عادي and مطوّر) are the menu\'s modes and reach the board from the room',async()=>{
 const modes=Array.from((await board()).context.tables.at(-1).options.modes,m=>m.id);assert.deepEqual(modes,['classic','adventure']);
 for(const [variant,enhanced]of [['classic',false],['adventure',true]]){
  const h=await board();await start(h,variant);const state=h.context.playHooks.state();assert.equal(state.players.length,2);assert.equal(state.rulesVersion===2,enhanced);assert.equal(h.doc.getElementById('setup').classList.contains('hidden'),true);assert.equal(h.doc.querySelectorAll('.snake-cell').length,100);
 }
});
test('board journal deduplicates redraws, distinguishes jumps and survives a saved-round restore',async()=>{
 const h=await board(),journal=h.context.BS_PLAY_INSIGHTS.board();let state=snakes.createSnakesGame(['A','B']);state=snakes.playSnakesRoll(state,6);journal.observe(state);journal.observe(state);assert.equal(journal.players[0].rolls,1);
 state.players[0].position=3;state.turn=0;state=snakes.playSnakesRoll(state,1);journal.observe(state);assert.equal(journal.players[0].ladders,1);assert.equal(journal.rows[0].kind,'ladder');
 const resumed=h.context.BS_PLAY_INSIGHTS.board();resumed.restore(journal.snapshot());resumed.observe(state);assert.equal(resumed.players[0].rolls,2);assert.equal(resumed.rows.length,2);
 const gap=structuredClone(state);gap.moveCount+=3;resumed.observe(gap);assert.equal(resumed.partial,true);assert.equal(resumed.rows.length,3);
});
test('help keeps an online match going, traps keyboard focus, and stays inside fullscreen',async()=>{
 const h=await board();await start(h);await h.runFile('assets/js/pro-experience.js');const stage=h.doc.getElementById('game');h.doc.fullscreenElement=stage;h.doc.dispatchEvent({type:'fullscreenchange'});
 assert.equal(h.doc.getElementById('boardHelpDialog').parentElement,stage);const opener=h.doc.getElementById('boardHelp');opener.focus();opener.onclick();
 // 33.0.0: the room does not stop for one reader, so the board keeps showing the other moves
 assert.equal(h.context.BS_PRO.paused,false);assert.match(h.doc.getElementById('boardHelpNote').textContent,/المباراة تستمر/);assert.equal(h.doc.activeElement.id,'boardHelpClose');
 h.doc.dispatchEvent({type:'keydown',key:'Escape',preventDefault(){}});assert.equal(h.doc.getElementById('boardHelpDialog').classList.contains('hidden'),true);assert.equal(h.doc.activeElement,opener);
});
test('snakes keeps moderate motion under an old global fast preference without changing state or dice',async()=>{
 const h=await board();await start(h);const before=structuredClone(h.context.playHooks.state());h.context.BS_PLAY_INSIGHTS.setTempo('fast');const element=h.doc.createElement('div');let duration;
 element.animate=(_frames,options)=>{duration=options.duration;return {finished:Promise.resolve()}};await h.context.playHooks.runAnimation(element,[],{duration:1000});assert.equal(duration,1000);assert.deepEqual(h.context.playHooks.state(),before);assert.equal(h.storage.get('tahdia-board-tempo-v15'),'fast');
});
test('arena insights use actual scores and kills, bound graph samples, and reset between rounds',async()=>{
 const h=await board(),journal=h.context.BS_PLAY_INSIGHTS.arena(),game={tick:0,elapsed:0,status:'playing',snakes:[{id:'a',name:'A',score:0,kills:0,alive:true,boost:false}]};journal.reset(game,['a']);journal.observe(game,['a']);
 game.tick=1;game.elapsed=1;Object.assign(game.snakes[0],{score:37,kills:2,boost:true});journal.observe(game,['a']);journal.observe(game,['a']);const summary=journal.summary(game)[0];assert.equal(summary.gathered,17);assert.equal(summary.kills,2);assert.equal(summary.boosted,true);assert.equal(journal.samples.length,2);
 for(let i=2;i<600;i++){game.tick=i;game.elapsed=i;game.snakes[0].score=i;journal.observe(game,['a']);}assert.equal(journal.samples.length,360);for(const point of journal.curve().split(' ')){const [x,y]=point.split(',').map(Number);assert.ok(x>=8&&x<=272&&y>=12&&y<=68);}
 game.tick=0;game.elapsed=0;game.snakes[0].score=0;game.snakes[0].kills=0;journal.observe(game,['a']);assert.equal(journal.samples.length,1);assert.equal(journal.summary(game)[0].gathered,0);
});
