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
