import test from 'node:test';
import assert from 'node:assert/strict';
import {createDOM} from './dom-harness.mjs';
import * as Snakes from '../public/assets/js/engines/snakes-engine.js';
import * as Enhanced from '../public/assets/js/engines/snakes-adventure.js';
import * as FX from '../public/assets/js/snakes-v4-fx.js';

async function ui(){
 const h=await createDOM('snakes.html',{...Snakes,...Enhanced,...FX});
 h.context.BS_DICE.mountBonus=()=>{};
 await h.runInline(`window.TEST={setOnline(s){mode='online';room={code:'123456',variant:'adventure',status:'playing',me:{index:0},players:[]};state=s;enterGame()},rollTurn,flush:()=>onlineQueue,onRoomState,client(c){client=c},get:()=>state};`);
 return h;
}

test('enhanced online players see reward cells and can spend their earned double',async()=>{
 const h=await ui(),s=Enhanced.createEnhancedGame(['A','B']);Object.assign(s.players[0],{position:13,double:1});
 h.context.TEST.setOnline(s);
 assert.equal(h.doc.querySelectorAll('.bonus-cell').length,3);
 assert.equal(h.doc.getElementById('powerStrip').classList.contains('hidden'),false);
 const button=h.doc.getElementById('doublePower');assert.equal(button.disabled,false);
 button.onclick();const sent=[];h.context.TEST.client({send:(type,payload)=>{sent.push({type,payload});return true}});
 await h.context.TEST.rollTurn();
 assert.equal(sent[0].payload.power,'double');
});
test('a burst of online moves keeps only the latest pending state and never replays duplicates',async()=>{
 const h=await ui(),before=Enhanced.createEnhancedGame(['A','B']);before.players.forEach(p=>p.position=1);h.context.TEST.setOnline(before);
 let release,calls=0;h.context.BS_DICE.roll=()=>{calls++;return calls===1?new Promise(r=>release=r):Promise.resolve();};
 let state=before;for(const version of [2,3,4]){state=Enhanced.playEnhancedTurn(state,[1]);h.context.TEST.onRoomState({code:'123456',status:'playing',variant:'adventure',me:{index:0},version,state});}
 release();await h.context.TEST.flush();assert.equal(h.context.TEST.get().moveCount,state.moveCount);assert.equal(calls,1,'obsolete pending moves must not add more animation delay');
 h.context.TEST.onRoomState({code:'123456',status:'playing',version:4,state});await h.context.TEST.flush();assert.equal(calls,1);
});

test('online viewers automatically finish the reward animation and show both server dice',{timeout:1000},async()=>{
 const h=await ui(),before=Enhanced.createEnhancedGame(['A','B']);before.players[0].position=10;before.players[0].double=1;
 h.context.TEST.setOnline(before);
 const next=Enhanced.playEnhancedTurn(before,[1,1],{power:'double',bonusRoll:3});
 h.context.TEST.onRoomState({code:'123456',status:'playing',variant:'adventure',me:{index:1},version:2,state:next});
 await h.context.TEST.flush();
 assert.equal(h.doc.getElementById('bonusOverlay').classList.contains('hidden'),true);
 assert.equal(h.doc.getElementById('die2').classList.contains('hidden'),false);
 assert.equal(h.doc.getElementById('die2').dataset.value,'1');
 assert.equal(h.doc.getElementById('roll').disabled,false);
});
test('same-version lobby updates still reveal newly joined friends',async()=>{
 const h=await ui();h.context.renderRoomPlayers=(el,room)=>{el.dataset.count=room.players.length};
 const lobby={code:'123456',status:'lobby',variant:'classic',version:3,playerLimit:2,me:{id:'a',role:'host'},players:[{id:'a',role:'host',ready:false,connected:true}]};
 h.context.TEST.onRoomState(lobby);await h.context.TEST.flush();assert.equal(h.doc.getElementById('roomPlayers').dataset.count,'1');
 h.context.TEST.onRoomState({...lobby,players:[...lobby.players,{id:'b',role:'guest',ready:false,connected:true}]});await h.context.TEST.flush();assert.equal(h.doc.getElementById('roomPlayers').dataset.count,'2');
});
