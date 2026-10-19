import {ARENA_POWERS,powerActive} from '../public/assets/js/engines/arena-drops-v24.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createDOM} from './dom-harness.mjs';
import {createSerpentGame,serpentSnapshot,serpentSteeringAngle} from '../public/assets/js/engines/serpent-engine.js';
import {ArenaGestures} from '../public/assets/js/arena-gestures.js';
import {applySerpentFrame} from '../public/assets/js/serpent-network.js';
import {arenaTelemetry,resolveTrialSkin} from '../public/assets/js/serpent-renderer.js';
import * as serpentWorlds from '../public/assets/js/serpent-worlds-v25-2.js';
async function ui(){
 const peers=[],h=await createDOM('serpent.html');h.context.requestAnimationFrame=()=>0;
 h.context.AbortSignal=AbortSignal;Object.assign(h.context,{ARENA_POWERS,powerActive});
 h.context.ArenaGestures=ArenaGestures;h.context.serpentSteeringAngle=serpentSteeringAngle;
 h.context.applySerpentFrame=applySerpentFrame;Object.assign(h.context,serpentWorlds);
 h.context.arenaTelemetry=arenaTelemetry;h.context.resolveTrialSkin=resolveTrialSkin;
 h.context.SerpentRenderer=class{constructor(){this.cameras=new Map()}reset(){this.cameras.clear();}resize(){}setQuality(){}setGame(){}draw(){}};
 h.context.WebSocket=class{static OPEN=1;constructor(){this.readyState=0;peers.push(this)}close(){}send(){}};
 h.context.fetch=async()=>Response.json({ok:true,status:'playing'});h.context.BS_CAREER={get:()=>({name:'A'}),account:()=>null};
 const source=(await readFile(new URL('../public/assets/js/serpent-ui.js',import.meta.url),'utf8')).replace(/^import .*?;\n/gm,'');
 vm.runInContext(source+'\nglobalThis.hooks={acceptRoom,connectRoom,network:()=>networkActive,init:()=>{online=true;selfId="a";mode="online";networkActive=true;}};',vm.createContext(h.context));
 vm.runInContext(`globalThis.shortSwipe=(g)=>{online=true;selfId="a";game=g;lastInput=100;globalThis.sent=[];socket={readyState:1,send:v=>sent.push(JSON.parse(v))};gestures.start({pointerId:1,clientX:100,clientY:100},{left:0,top:0,width:390,height:844});gestures.move({pointerId:1,clientX:100,clientY:140});applyInputs(116);gestures.stop(1);applyInputs(151);};`,h.context);
 return {...h,peers};
}
test('resuming a finished online room reveals results and the host rematch control',async()=>{
 const h=await ui();h.context.hooks.init();const g=createSerpentGame([{id:'a',name:'A'},{id:'b',name:'B'}]);g.status='finished';g.winners=['a'];
 h.context.hooks.acceptRoom({code:'123456',round:1,status:'finished',rewardsComplete:true,players:[{id:'a',role:'host'},{id:'b',role:'guest'}],game:serpentSnapshot(g)});
 assert.equal(h.doc.getElementById('arenaPlay').classList.contains('hidden'),false);assert.equal(h.doc.getElementById('arenaResults').classList.contains('hidden'),false);assert.equal(h.doc.getElementById('arenaAgain').disabled,false);
});
test('a failed reconnect preserves intent for the remaining bounded retries',async()=>{
 const h=await ui();h.context.hooks.init();const attempt=h.context.hooks.connectRoom('123456',{token:'valid-reconnect-token'});const rejection=assert.rejects(attempt,/تعذر/);
 for(let i=0;i<5&&!h.peers.length;i++)await new Promise(r=>setImmediate(r));assert.equal(h.peers.length,1);h.peers[0].onerror();await rejection;assert.equal(h.context.hooks.network(),true);
});

test('a brief online swipe retains its desired direction between network sends',async()=>{const h=await ui(),g=createSerpentGame([{id:'a'}],{collisionMode:'predator',foodCount:0});g.snakes[0].angle=g.snakes[0].targetAngle=0;g.snakes[0].x=g.snakes[0].y=500;h.context.shortSwipe(serpentSnapshot(g));assert.equal(h.context.sent.length,1);assert.ok(Math.abs(h.context.sent[0].angle-Math.PI/2)<1e-8);});
test('a silent open connection is closed for reconnection instead of leaving a frozen arena forever',async()=>{
 const h=await ui();vm.runInContext(`online=true;networkActive=true;connectionWelcomed=true;lastNetworkMessage=1;lastHeartbeat=1;globalThis.closed=[];socket={readyState:1,bufferedAmount:0,send(){},close:(...args)=>closed.push(args)};`,h.context);
 h.setTime(3000);vm.runInContext('networkTick()',h.context);assert.equal(h.context.closed.length,0);h.setTime(6001);vm.runInContext('networkTick()',h.context);assert.equal(h.context.closed[0][0],4000);assert.equal(h.context.closed[0][1],'stale_connection');
});
test('a congested socket skips old steering while retaining the newest input after it drains',async()=>{
 const h=await ui(),g=serpentSnapshot(createSerpentGame([{id:'a'}],{collisionMode:'arena-v23',foodCount:0}));h.context.testGame=g;
 vm.runInContext(`online=true;selfId='a';game=testGame;globalThis.inputs=[];socket={readyState:1,bufferedAmount:20000,send:raw=>inputs.push(JSON.parse(raw))};controls[0].angle=.3;applyInputs(100);controls[0].angle=.7;applyInputs(200);socket.bufferedAmount=0;applyInputs(300);`,h.context);
 assert.equal(h.context.inputs.length,1);assert.equal(h.context.inputs[0].angle,.7);
});
