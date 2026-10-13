import test from 'node:test';
import assert from 'node:assert/strict';
import {ArenaGestures} from '../public/assets/js/arena-gestures.js';
const rect={left:0,top:0,width:390,height:844};
const event=(pointerId,clientX,clientY)=>({pointerId,clientX,clientY});
test('steering begins at any point, with a dead zone and a movable origin',()=>{
 const moves=[],ended=[],g=new ArenaGestures({steer:(i,a)=>moves.push([i,a]),end:i=>ended.push(i)});
 assert.equal(g.start(event(1,320,210),rect),0);g.move(event(1,322,211));assert.equal(moves.length,0);
 g.move(event(1,350,210));assert.deepEqual(moves.at(-1),[0,0]);
 g.move(event(1,380,210));g.move(event(1,328,180));assert.ok(moves.at(-1)[1]<-1.5,'dragging back changes direction without returning to a fixed joystick');
 g.stop(1);assert.deepEqual(ended,[0]);assert.equal(g.move(event(1,10,10)),null);
});
test('two fingers remain assigned to their original split view in portrait and landscape',()=>{
 const moves=[],g=new ArenaGestures({steer:(i,a)=>moves.push([i,a])});
 assert.equal(g.start(event(1,200,200),rect,true),0);assert.equal(g.start(event(2,200,650),rect,true),1);
 assert.equal(g.start(event(3,100,220),rect,true),null);g.move(event(1,200,680));g.move(event(2,170,650));
 assert.deepEqual(moves.map(x=>x[0]),[0,1]);g.clear();assert.equal(g.pointers.size,0);
 const wide={left:15,top:10,width:844,height:390};assert.equal(g.start(event(4,100,100),wide,true),0);assert.equal(g.start(event(5,700,100),wide,true),1);
});
test('cancellation and focus loss release every active player',()=>{
 const ended=[],g=new ArenaGestures({end:i=>ended.push(i)});g.start(event(1,80,100),rect,true);g.start(event(2,80,650),rect,true);g.clear();
 assert.deepEqual(ended,[0,1]);assert.equal(g.stop(1),null);
});
