import test from 'node:test';
import assert from 'node:assert/strict';
import {createDOM} from './dom-harness.mjs';
import * as Snakes from '../public/assets/js/engines/snakes-engine.js';
import * as Enhanced from '../public/assets/js/engines/snakes-adventure.js';
import * as FX from '../public/assets/js/snakes-v4-fx.js';
import {createStepPlayer} from '../public/assets/js/board-online.js';

// 33.0.0: the snakes page is online only. board-table-v33.js owns the room and hands
// the page each state to draw (apply); the page sends its moves through the table.
async function ui(){
 const h=await createDOM('snakes.html',{...Snakes,...Enhanced,...FX});
 h.context.BS_DICE.mountBonus=()=>{};
 await h.runInline('window.TEST={get:()=>state,rollTurn};');
 const table=h.context.tables.at(-1);
 const room=(state,extra={})=>({code:'401234',variant:'adventure',status:'playing',version:2,me:{id:'a',index:0,role:'host'},players:[{id:'a',index:0,name:'A'},{id:'b',index:1,name:'B',bot:true,level:'hard'}],state,...extra});
 return {...h,table,room};
}

test('enhanced online players see reward cells and can spend their earned double',async()=>{
 const h=await ui(),s=Enhanced.createEnhancedGame(['A','B']);Object.assign(s.players[0],{position:13,double:1});
 await h.table.apply(h.room(s));
 assert.equal(h.doc.querySelectorAll('.bonus-cell').length,3);
 assert.equal(h.doc.getElementById('powerStrip').classList.contains('hidden'),false);
 const button=h.doc.getElementById('doublePower');assert.equal(button.disabled,false);
 button.onclick();await h.context.TEST.rollTurn();
 assert.deepEqual(h.table.sent.at(-1),{type:'roll',power:'double'});
});

test('the moves of a batch (yours and the bots\') play one after another, each once',async()=>{
 const played=[];let release;
 const player=createStepPlayer(async(next)=>{played.push(next.version);if(next.version===2)await new Promise(r=>release=r);});
 player.push({version:2,status:'playing',state:{n:2}});
 // while the first step animates, the server sends the bots' turns as steps of one update
 player.push({version:5,status:'playing',state:{n:5},steps:[{version:3,state:{n:3}},{version:4,state:{n:4}}]});
 player.push({version:5,status:'playing',state:{n:5}});
 release();for(let i=0;i<20;i++)await new Promise(r=>setImmediate(r));
 assert.deepEqual(played,[2,3,4,5,5],'every step in order; a repeated state is drawn again but never replays the moves');
 player.push({version:4,status:'playing',state:{n:4}});for(let i=0;i<5;i++)await new Promise(r=>setImmediate(r));
 assert.equal(played.length,5,'an older state is ignored');
});

test('an opponent\'s turn plays out by itself and shows both server dice',{timeout:2000},async()=>{
 const h=await ui(),before=Enhanced.createEnhancedGame(['A','B']);before.players[1].position=10;before.players[1].double=1;before.turn=1;
 await h.table.apply(h.room(before));
 const next=Enhanced.playEnhancedTurn(before,[1,1],{power:'double',bonusRoll:3});
 await h.table.apply(h.room(next,{version:3}),{animate:true});
 assert.equal(h.doc.getElementById('bonusOverlay').classList.contains('hidden'),true);
 assert.equal(h.doc.getElementById('dieOpp2').classList.contains('hidden'),false,'the second die shows on the opponent\'s side');
 assert.equal(h.doc.getElementById('dieOpp2').dataset.value,'1');
});

test('a lobby state goes to the shared menu and a match goes to the board',async()=>{
 const h=await ui();let lobbies=0;h.table.options.onLobby=()=>{lobbies++};
 await h.table.apply({code:'401234',status:'lobby',version:1,players:[{id:'a'}],me:{id:'a',role:'host'}});
 assert.equal(lobbies,1);assert.equal(h.doc.getElementById('game').classList.contains('hidden'),true);
 await h.table.apply(h.room(Enhanced.createEnhancedGame(['A','B'])));
 assert.equal(h.doc.getElementById('game').classList.contains('hidden'),false);
 assert.match(h.doc.getElementById('players').textContent,/بوت/,'a bot is tagged in the player list');
});

test('unchanged server snapshots reuse pawn art and roster nodes',async()=>{
 const h=await ui(),state=Enhanced.createEnhancedGame(['A','B']);await h.table.apply(h.room(state));
 const pawn=h.doc.querySelector('[data-player="0"]'),row=h.doc.getElementById('players').children[0];await h.table.apply(h.room(structuredClone(state),{version:3}));
 assert.equal(h.doc.querySelector('[data-player="0"]'),pawn);assert.equal(h.doc.getElementById('players').children[0],row);
});
test('leaving while dice animate cancels the old turn without altering a newly opened game',async()=>{
 const h=await ui(),before=Enhanced.createEnhancedGame(['A','B']);before.players[0].position=10;await h.table.apply(h.room(before));
 let release;h.context.BS_DICE.roll=()=>new Promise(r=>release=r);const next=Enhanced.playEnhancedTurn(before,[1]);const old=h.table.apply(h.room(next,{version:3}),{animate:true});
 await Promise.resolve();h.table.leave();const fresh=Enhanced.createEnhancedGame(['New A','New B']);await h.table.apply(h.room(fresh,{code:'999999',version:1}));release();await old;
 assert.equal(h.context.TEST.get().players[0].name,'New A');assert.equal(h.context.TEST.get().moveCount,0);assert.equal(h.doc.querySelectorAll('.snake-travel-pawn').length,0);
});
test('normal pawn movement uses moderate transform-only animations even with global fast motion enabled',async()=>{
 const h=await ui(),before=Enhanced.createEnhancedGame(['A','B']),animations=[];before.players[0].position=13;h.context.matchMedia=()=>({matches:false});h.context.BS_PLAY_INSIGHTS={motionScale:()=>.45,boardRender(){}};await h.table.apply(h.room(before));
 const prototype=Object.getPrototypeOf(h.doc.createElement('span')),original=prototype.animate;prototype.animate=function(frames,options){if(this.classList.contains('snake-travel-pawn'))animations.push({frames,options});return{finished:Promise.resolve(),cancel(){}};};
 try{await h.table.apply(h.room(Enhanced.playEnhancedTurn(before,[2]),{version:3}),{animate:true});}finally{prototype.animate=original;}
 assert.ok(animations.length);assert.ok(animations[0].options.duration>=420);assert.ok(animations.flatMap(a=>a.frames).every(frame=>!('left'in frame)&&!('top'in frame)));
});
