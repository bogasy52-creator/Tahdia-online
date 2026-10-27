import test from 'node:test';
import assert from 'node:assert/strict';
import {ArenaGestures} from '../public/assets/js/arena-gestures.js';
import {SerpentRenderer} from '../public/assets/js/serpent-renderer.js';
import {createSerpentGame,addSerpentBots,stepSerpent} from '../public/assets/js/engines/serpent-engine.js';
import {createDOM} from './dom-harness.mjs';
import * as Snakes from '../public/assets/js/engines/snakes-engine.js';
import * as Enhanced from '../public/assets/js/engines/snakes-adventure.js';
import * as FX from '../public/assets/js/snakes-v4-fx.js';
import {environment,api} from './worker-harness.mjs';

const rect={left:0,top:0,width:390,height:844};
const pointer=(clientX,clientY)=>({pointerId:1,clientX,clientY});
test('joystick holds its intended heading when the thumb jitters around one side',()=>{
 const angles=[],g=new ArenaGestures({mode:'joystick',steer:(_i,a)=>angles.push(a)});
 g.start(pointer(100,100),rect);g.move(pointer(140,100));g.move(pointer(135,103));
 assert.ok(angles.length>0);assert.ok(angles.every(a=>Math.abs(a)<.15),'thumb noise must not turn a rightward snake back to the left');
 g.move(pointer(100,150));assert.ok(Math.abs(angles.at(-1)-Math.PI/2)<.15);
});
test('joystick thumb movement within the dead zone does not issue a direction',()=>{
 const angles=[],g=new ArenaGestures({mode:'joystick',steer:(_i,a)=>angles.push(a)});
 g.start(pointer(100,100),rect);g.move(pointer(105,102));assert.equal(angles.length,0);
});
test('a fresh network snapshot does not pull the rendered head backwards',t=>{
 globalThis.window={devicePixelRatio:1};t.after(()=>delete globalThis.window);
 const r=new SerpentRenderer({getContext:()=>({}),getBoundingClientRect:()=>({width:390,height:844})});
 const snake=x=>({id:'self',x,y:200,angle:0,targetAngle:0,mass:28,score:0,kills:0,alive:true,boost:false,segments:[{x:x-5,y:200}]});
 r.setGame({status:'playing',tick:1,snakes:[snake(100)]},['self'],true);r.received=0;r.setInput('self',0,false);r.updatePresentation(0,16);r.updatePresentation(90,16);
 const before=r.poses.get('self').x;
 r.setGame({status:'playing',tick:2,snakes:[snake(105)]},['self'],true);r.received=90;r.updatePresentation(106,16);
 assert.ok(r.poses.get('self').x>before,'ordinary server reconciliation must keep forward motion continuous');
 assert.ok(r.poses.get('self').x-before<5);
});
test('survival continues past the selected timed duration while opponents remain',()=>{
 const g=createSerpentGame([{id:'a'},{id:'b'}],{matchMode:'survival',duration:.1,foodCount:0});
 stepSerpent(g,.1);assert.equal(g.status,'playing');assert.equal(serpentMode(g),'survival');
});
test('a stalled snapshot stream holds the predicted head instead of moving then snapping back',t=>{
 globalThis.window={devicePixelRatio:1};t.after(()=>delete globalThis.window);
 const r=new SerpentRenderer({getContext:()=>({}),getBoundingClientRect:()=>({width:390,height:844})});
 const snake={id:'a',x:100,y:200,angle:0,mass:28,score:0,kills:0,alive:true,boost:false,segments:[{x:95,y:200}]};
 r.setGame({status:'playing',tick:1,snakes:[snake]},['a'],true);r.received=0;r.setInput('a',0,false);
 let held;for(let i=0;i<150;i++){r.updatePresentation(i*16,16);if(i===30)held=r.poses.get('a').x;if(i>30)assert.ok(Math.abs(r.poses.get('a').x-held)<.001,'prediction must stop when authoritative frames stop');}
});
test('boost sheds the same amount of food at local60Hz and server20Hz',()=>{
 const simulate=step=>{const g=createSerpentGame([{id:'a'}],{foodCount:0,duration:120});const s=g.snakes[0];s.x=s.y=900;s.angle=s.targetAngle=0;s.mass=100;s.boost=true;s.segments=Array.from({length:100},(_,i)=>({x:900-i*5,y:900}));for(let i=0;i<Math.round(1/step);i++)stepSerpent(g,step);return g.food.length;};
 assert.equal(simulate(1/60),simulate(.05));assert.equal(simulate(.05),4);
});
function serpentMode(g){return g.matchMode;}
test('survival waits for bots as well as human players and rewards the last living snake',()=>{
 const g=createSerpentGame([{id:'a'},{id:'b'}],{matchMode:'survival',foodCount:0});addSerpentBots(g,2);
 g.snakes[1].alive=false;g.snakes[1].score=500;stepSerpent(g,.01);assert.equal(g.status,'playing');
 g.snakes[2].alive=g.snakes[3].alive=false;g.snakes[2].respawnAt=g.snakes[3].respawnAt=0;
 stepSerpent(g,.01);assert.equal(g.status,'finished');assert.deepEqual(g.winners,['a']);
});
test('eliminated survival bots stay eliminated instead of respawning after three seconds',()=>{
 const g=createSerpentGame([{id:'a'},{id:'b'}],{matchMode:'survival',foodCount:0});addSerpentBots(g,2);
 g.snakes[2].alive=false;g.snakes[2].respawnAt=0;stepSerpent(g,.05);assert.equal(g.snakes[2].alive,false);
});
test('the seeded food pool contains recognizable food types and multiple rewards',()=>{
 const g=createSerpentGame([{id:'a'}],{seed:71,foodCount:300});
 assert.ok(new Set(g.food.map(f=>f.kind)).size>=5);assert.ok(new Set(g.food.map(f=>f.value)).size>=3);
 assert.ok(g.food.every(f=>typeof f.kind==='string'&&f.radius>=6));
});
function roomApiEnv(){const env=environment();env.ROOMS={idFromName:n=>n,get:()=>({fetch:async(request)=>Response.json({ok:true},{status:new URL(typeof request==='string'?request:request.url).pathname==='/init'?201:200})})};return env;}
test('room creation preserves the survival rules in the public response',async()=>{
 const h=await api(roomApiEnv(),'/api/serpent/rooms',{matchMode:'survival',playerLimit:2,duration:120});
 assert.equal(h.response.status,200);assert.equal(h.data.matchMode,'survival');
});
test('room creation rejects unknown survival rules instead of silently changing the mode',async()=>{
 const h=await api(roomApiEnv(),'/api/serpent/rooms',{matchMode:'forged',playerLimit:2,duration:120});assert.equal(h.response.status,400);
});
test('an online pawn stays on its original cell until the die finishes',async()=>{
 // 33.0.0: the table (board-table-v33.js) hands the page each move to animate
 const h=await createDOM('snakes.html',{...Snakes,...Enhanced,...FX});
 await h.runInline('');const table=h.context.tables.at(-1);
 const room=(state,version)=>({code:'401234',status:'playing',variant:'classic',me:{id:'a',index:0},players:[{id:'a',index:0,name:'A'},{id:'b',index:1,name:'B'}],version,state});
 const before=Snakes.createSnakesGame(['A','B']);before.players[0].position=22;await table.apply(room(before,1));
 let release;h.context.BS_DICE.roll=()=>new Promise(resolve=>release=resolve);
 const next=Snakes.playSnakesRoll(before,3);
 const moving=table.apply(room(next,2),{animate:true});await new Promise(r=>setImmediate(r));
 const jumped=Boolean(h.doc.querySelector('.snake-cell[data-n="25"] .snake-token')),held=Boolean(h.doc.querySelector('.snake-cell[data-n="22"] .snake-token'));
 release();await moving;assert.equal(jumped,false,'the final cell must not show a pawn while the die is still rolling');assert.equal(held,true);assert.ok(h.doc.querySelector('.snake-cell[data-n="25"] .snake-token'));
});
