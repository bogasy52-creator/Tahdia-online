import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/assets/js/profile-core.js';
import {createSerpentGame,addSerpentBots,stepSerpent} from '../public/assets/js/engines/serpent-engine.js';
const Core=globalThis.BS_CAREER_CORE;
test('only one character is free and paid characters require purchase before equip',()=>{
 const items=Core.CATALOG.filter(i=>i.type==='character');assert.equal(items.length,12);assert.deepEqual(items.filter(i=>i.price===0).map(i=>i.id),['character-fox']);
 const fresh=Core.normalize();assert.equal(fresh.equipped.character,'character-fox');assert.equal(fresh.owned.filter(id=>id.startsWith('character-')).length,1);assert.throws(()=>Core.equip(fresh,'character-princess'),/not_owned/);
 const paid=Core.purchase(Core.normalize({coins:1000}),'character-princess',{now:0});assert.equal(paid.equipped.character,'character-princess');assert.equal(paid.coins,1000-Core.itemPrice('character-princess',0));assert.equal(Core.purchase(paid,'character-princess',{now:0}).coins,paid.coins);
});
function game(){return createSerpentGame([{id:'a'},{id:'b'}],{collisionMode:'tail-guard',matchMode:'survival',foodCount:0,width:1000,height:1000,seed:17})}
test('tail guard permits head and middle-body contact but kills a head touching the protected tail',()=>{
 const g=game(),[a,b]=g.snakes;Object.assign(a,{x:500,y:500,angle:0,targetAngle:0});Object.assign(b,{x:500,y:500,angle:0,targetAngle:0});a.segments=Array.from({length:28},()=>({x:200,y:200}));b.segments=Array.from({length:28},(_,i)=>({x:i<20?500:850,y:i<20?500:850}));stepSerpent(g,.001);assert.ok(a.alive&&b.alive,'head and front body do not kill');
 b.segments=b.segments.map((p,i)=>i>=20?{x:a.x,y:a.y}:p);stepSerpent(g,.001);assert.equal(a.alive,false);assert.equal(b.alive,true);assert.equal(b.kills,1);
});
test('touching a wall in tail guard keeps the player alive and inside the arena',()=>{
 const g=game(),s=g.snakes[0];Object.assign(s,{x:12,y:500,angle:Math.PI,targetAngle:Math.PI});stepSerpent(g,.05);assert.equal(s.alive,true);assert.ok(s.x>=7+Math.sqrt(s.mass)*.55);
});
test('medium bots use a stable forward target and think less often than simulation ticks',()=>{
 const g=createSerpentGame([{id:'a'}],{collisionMode:'tail-guard',matchMode:'survival',foodCount:0,width:1000,height:1000,difficulty:'medium'});addSerpentBots(g,1);const bot=g.snakes[1];Object.assign(bot,{x:500,y:500,angle:0,targetAngle:0});g.food=[{id:'behind',x:460,y:500,value:5,radius:5},{id:'front',x:650,y:500,value:1,radius:5}];
 for(let i=0;i<15;i++)stepSerpent(g,1/60);assert.ok(Math.abs(bot.targetAngle)<.6,'a nearby food behind must not cause circling');assert.ok(bot.botThinkCount<=2,'AI should not scan all food every render tick');assert.ok(bot.x<524,'medium bot should be slower and approachable');
});
test('survival periodically spawns an actual treasure event with bonus food',()=>{
 const g=game();g.elapsed=14.99;stepSerpent(g,.05);assert.ok(g.events.some(e=>e.type==='treasure'));assert.ok(g.food.filter(f=>f.kind==='gem'||f.kind==='star').length>=8);
});
