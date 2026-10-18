import test from 'node:test';
import assert from 'node:assert/strict';
import {compactSerpentFrame,applySerpentFrame} from '../public/assets/js/serpent-network.js';
import {createSerpentGame,addSerpentBots,stepSerpent,serpentSnapshot} from '../public/assets/js/engines/serpent-engine.js';
test('compact frames retain food additions/removals and bound visible position error',()=>{
 const g=createSerpentGame([{id:'a'},{id:'b'}],{seed:41});addSerpentBots(g,4);const old={round:1,game:serpentSnapshot(g)};
 stepSerpent(g,.05);stepSerpent(g,.05);g.food.shift();g.food.push({id:'new',x:200,y:300,value:2,radius:4,hue:0});const current={round:1,game:serpentSnapshot(g)},packet=compactSerpentFrame(current,old),next=applySerpentFrame(old,packet);
 assert.deepEqual(next.game.food,current.game.food);assert.equal(next.game.tick,current.game.tick);assert.equal(next.game.snakes.length,6);
 next.game.snakes.forEach((s,i)=>{assert.ok(Math.abs(s.x-current.game.snakes[i].x)<=.05);s.segments.forEach((p,j)=>assert.ok(Math.abs(p.y-current.game.snakes[i].segments[j].y)<=.05));});
 assert.ok(JSON.stringify(packet).length<JSON.stringify({type:'state',state:current}).length*.4);assert.equal(applySerpentFrame(next,packet),null);
});
test('negotiated long-body packets preserve every segment within half a world unit and cut payload size',()=>{
 const g=createSerpentGame(Array.from({length:10},(_,i)=>({id:'s'+i})),{collisionMode:'arena-v23',foodCount:260});for(const s of g.snakes){s.mass=720;s.segments=Array.from({length:720},(_,i)=>({x:900+300*Math.cos(i/100+s.angle),y:900+300*Math.sin(i/100+s.angle)}));}
 const previous={round:1,game:serpentSnapshot(g)};g.tick=2;const current={round:1,game:serpentSnapshot(g)},packed=compactSerpentFrame(current,previous,true),legacy=compactSerpentFrame(current,previous),restored=applySerpentFrame(previous,packed);
 assert.ok(JSON.stringify(packed).length<JSON.stringify(legacy).length*.4);
 restored.game.snakes.forEach((s,k)=>{assert.equal(s.segments.length,720);s.segments.forEach((p,i)=>{assert.ok(Math.abs(p.x-current.game.snakes[k].segments[i].x)<=.25);assert.ok(Math.abs(p.y-current.game.snakes[k].segments[i].y)<=.25);});});assert.deepEqual(restored.game.food,current.game.food);assert.deepEqual(restored.game.snakes[0].powers,current.game.snakes[0].powers);
 assert.ok(Array.isArray(legacy.state.game.snakes[0].segments));assert.equal(legacy.state.game.snakes[0].body,undefined);
});
test('a malformed packed body requests resynchronization instead of crashing the client',()=>{
 const g=createSerpentGame([{id:'a'}],{foodCount:0});g.snakes[0].segments=Array.from({length:180},(_,i)=>({x:500-i*5,y:500}));const previous={round:1,game:serpentSnapshot(g)};g.tick=2;const packet=compactSerpentFrame({round:1,game:serpentSnapshot(g)},previous,true);packet.state.game.snakes[0].body.data='invalid!';assert.equal(applySerpentFrame(previous,packet),null);
});
