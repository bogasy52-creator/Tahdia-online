import {ARENA_POWERS,powerActive} from '../public/assets/js/engines/arena-drops-v24.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createDOM} from './dom-harness.mjs';
import * as serpent from '../public/assets/js/engines/serpent-engine.js';
import * as snakes from '../public/assets/js/engines/snakes-engine.js';
import * as adventure from '../public/assets/js/engines/snakes-adventure.js';
import * as movement from '../public/assets/js/snakes-v4-fx.js';
import {chooseSnakePower} from '../public/assets/js/engines/bot-strategy.js';
import {ArenaGestures} from '../public/assets/js/arena-gestures.js';
import {applySerpentFrame} from '../public/assets/js/serpent-network.js';
import {arenaTelemetry,resolveTrialSkin} from '../public/assets/js/serpent-renderer.js';
import * as serpentWorlds from '../public/assets/js/serpent-worlds-v25-2.js';
import {installExperienceHarness} from './arena-experience-harness.mjs';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
async function ui(){
 const h=await createDOM('serpent.html'),peers=[],inputs=[];h.context.requestAnimationFrame=()=>0;
 Object.assign(h.context,serpentWorlds);
 await installExperienceHarness(h);
 Object.assign(h.context,serpent,{ARENA_POWERS,powerActive,ArenaGestures,applySerpentFrame,arenaTelemetry,resolveTrialSkin,steerSerpent:(_game,id,input)=>inputs.push({id,...input})});
 h.context.SerpentRenderer=class{constructor(){this.cameras=new Map()}reset(){}resize(){}setQuality(){}setGame(){}draw(){}};
 h.context.WebSocket=class{static OPEN=1;constructor(){this.readyState=0;peers.push(this)}close(code,reason){this.readyState=3;queueMicrotask(()=>this.onclose?.({code,reason}))}send(){}};
 h.context.fetch=async()=>Response.json({ok:true,status:'playing'});h.context.BS_CAREER={get:()=>({name:'A'}),account:()=>null};
 const source=(await readFile(new URL('../public/assets/js/serpent-ui.js',import.meta.url),'utf8')).replace(/^import .*?;\n/gm,'');
 vm.runInContext(source+'\nglobalThis.hooks={connectRoom,quickJoin,createRoom,quit,scheduleReconnect,acceptRoom,selectMode,applyInputs,keys,init:()=>{online=true;selfId="a";mode="online";networkActive=true;},duo:()=>{online=false;mode="duo";selfId="local-1";game=createSerpentGame([{id:"local-1",name:"A"},{id:"local-2",name:"B"}]);show("arenaPlay");},network:()=>networkActive};',vm.createContext(h.context));return {...h,peers,inputs};
}
function room(round=1,rewardsComplete=true){const game=serpent.createSerpentGame([{id:'a',name:'A'},{id:'b',name:'B'}]);game.elapsed=35;game.status='finished';game.winners=['a'];return {code:'123456',round,status:'finished',rewardsComplete,players:[{id:'a',role:'host'},{id:'b',role:'guest'}],game:serpent.serpentSnapshot(game)}}
test('duo boost keys control exactly one player and release on keyup',async()=>{
 const h=await ui();h.context.hooks.duo();for(const [key,expected] of [['Space',[true,false]],['ShiftLeft',[false,true]],['ShiftRight',[false,true]]]){
  h.context.dispatchEvent({type:'keydown',code:key,preventDefault(){}});h.context.hooks.applyInputs(100);assert.deepEqual(h.inputs.slice(-2).map(input=>input.boost),expected);
  h.context.dispatchEvent({type:'keyup',code:key});h.context.hooks.applyInputs(150);assert.deepEqual(h.inputs.slice(-2).map(input=>input.boost),[false,false]);
 }
});
test('quitting during a pending room status request cannot resurrect a websocket',async()=>{
 const h=await ui();let resolve;h.context.fetch=()=>new Promise(done=>{resolve=done});const operation=h.context.hooks.connectRoom('123456'),rejected=assert.rejects(operation,/connection_cancelled/);
 h.context.hooks.quit();resolve(Response.json({ok:true}));await rejected;assert.equal(h.peers.length,0);assert.equal(h.context.hooks.network(),false);assert.equal(h.doc.getElementById('arenaMenu').classList.contains('hidden'),false);
});
test('cancelled create and quick tickets do not remember or join a room after mode change',async()=>{
 for(const action of ['createRoom','quickJoin']){const h=await ui();let resolve;h.context.fetch=()=>new Promise(done=>{resolve=done});const operation=h.context.hooks[action]();h.context.hooks.selectMode('duo');resolve(Response.json({ok:true,code:'123456',hostKey:'secret',token:'secret'}));await operation;
  assert.equal(h.peers.length,0);assert.equal(h.storage.has('busraj-serpent-room-v12'),false);assert.equal(h.doc.getElementById('arenaStart').disabled,false);
 }
});
test('a superseded connection opens only the latest socket',async()=>{
 const h=await ui(),responses=[];h.context.fetch=()=>new Promise(resolve=>responses.push(resolve));const first=h.context.hooks.connectRoom('123456'),rejected=assert.rejects(first,/connection_cancelled/),second=h.context.hooks.connectRoom('654321');
 responses[0](Response.json({ok:true}));responses[1](Response.json({ok:true}));await rejected;await flush();assert.equal(h.peers.length,1);
 const state=room();state.code='654321';h.peers[0].readyState=1;h.peers[0].onmessage({data:JSON.stringify({type:'welcome',playerId:'a',token:'reconnect',state})});await second;assert.equal(h.context.hooks.network(),true);h.context.hooks.quit();
});
test('quitting a reconnect invalidates the pending status result and all retry timers',async()=>{
 const h=await ui();h.context.hooks.init();h.storage.set('busraj-serpent-room-v12',JSON.stringify({code:'123456',token:'resume'}));let resolve;h.context.fetch=()=>new Promise(done=>{resolve=done});h.context.hooks.scheduleReconnect();
 const timer=[...h.timers.values()].find(value=>value.ms===1000);assert.ok(timer);const reconnect=timer.fn();h.context.hooks.quit();resolve(Response.json({ok:true}));await reconnect;
 assert.equal(h.peers.length,0);assert.equal(h.context.hooks.network(),false);assert.equal(h.timers.size,0);
});
test('finished snapshots refresh rewards once after completion and once again for a new round',async()=>{
 const h=await ui();let refreshed=0;h.context.BS_CAREER={get:()=>({name:'A'}),account:()=> 'playera',refresh:async()=>{refreshed++}};h.context.hooks.init();
 h.context.hooks.acceptRoom(room(1,false));assert.equal(refreshed,0);for(let i=0;i<4;i++)h.context.hooks.acceptRoom(room(1,true));await flush();assert.equal(refreshed,1);
 h.context.hooks.acceptRoom(room(2,true));await flush();assert.equal(refreshed,2);
});
test('arena quit exits stage fullscreen and does not steal Space from pause dialog buttons',async()=>{
 const h=await ui();h.context.hooks.duo();let exits=0;h.doc.fullscreenElement=h.doc.getElementById('arenaPlay');h.doc.exitFullscreen=async()=>{exits++;h.doc.fullscreenElement=null};h.doc.getElementById('arenaPause').onclick();
 assert.equal(h.doc.activeElement.id,'arenaContinue');let prevented=false;h.context.dispatchEvent({type:'keydown',code:'Space',preventDefault(){prevented=true}});assert.equal(prevented,false);
 h.context.hooks.quit();assert.equal(exits,1);assert.equal(h.doc.getElementById('arenaPlay').classList.contains('hidden'),true);
});
test('the enhanced bonus remains interactive in fullscreen and returns to body on exit',async()=>{
 const h=await createDOM('snakes.html');Object.assign(h.context,snakes,adventure,movement,{chooseSnakePower});h.context.requestAnimationFrame=()=>0;h.context.BS_DICE.mountBonus=()=>{};
 await h.runInline('globalThis.testBonus=showBonusDie;');await h.runFile('assets/js/pro-experience.js');const stage=h.doc.getElementById('game'),overlay=h.doc.getElementById('bonusOverlay'),button=h.doc.getElementById('bonusRoll');
 h.doc.fullscreenElement=stage;h.doc.dispatchEvent({type:'fullscreenchange'});assert.equal(overlay.parentElement,stage);
 const bonus=h.context.testBonus(3,0);assert.equal(overlay.classList.contains('hidden'),false);button.click();await flush();assert.equal(button.textContent,'متابعة اللعب');button.click();await bonus;assert.equal(overlay.classList.contains('hidden'),true);
 h.doc.fullscreenElement=null;h.doc.dispatchEvent({type:'fullscreenchange'});assert.equal(overlay.parentElement,h.doc.body);
});
test('board animation waits for an active pause before starting a new phase',async()=>{
 const h=await createDOM('snakes.html');Object.assign(h.context,snakes,adventure,movement,{chooseSnakePower});h.context.requestAnimationFrame=()=>0;
 await h.runInline('globalThis.testAnimation=runAnimation;');await h.runFile('assets/js/pro-experience.js');let started=0;
 const piece=h.doc.createElement('div');h.doc.getElementById('game').appendChild(piece);piece.animate=()=>{started++;return {finished:Promise.resolve()}};
 h.context.BS_PRO.setPaused(true);const animation=h.context.testAnimation(piece,[],{duration:10});await flush();assert.equal(started,0);h.context.BS_PRO.setPaused(false);await animation;assert.equal(started,1);
});
