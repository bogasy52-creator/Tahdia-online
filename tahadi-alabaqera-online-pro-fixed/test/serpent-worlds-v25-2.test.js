import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SERPENT_WORLDS,setupSerpentWorld,advanceSerpentWorld,drawSerpentWorld,ownerAllowed} from '../public/assets/js/serpent-worlds-v25-2.js';
function game(preset='neon'){
 const w=SERPENT_WORLDS[preset];return {width:w.width,height:w.height,seed:123,elapsed:0,status:'playing',snakes:[{id:'human',x:150,y:150,angle:0,alive:true,bot:false,mass:28,segments:[{x:150,y:150},{x:145,y:150}]},{id:'bot-1',x:w.width-90,y:w.height-90,angle:0,mass:28,alive:true,bot:true,segments:[{x:w.width-90,y:w.height-90}]}],food:Array.from({length:70},(_,i)=>({id:'f'+i,x:25+i*4,y:50,value:1,kind:'apple',radius:6})),events:[],difficulty:'hard'};
}
test('seven maps have bounded dimensions and compact non-overlapping obstacles',()=>{
 assert.deepEqual(Object.keys(SERPENT_WORLDS),['classic','neon','forest','crystals','volcano','ruins','storm']);
 for(const p of Object.values(SERPENT_WORLDS)){
  assert.ok(p.width<=2400&&p.height<=2400&&p.foodCount<=350);
  const g=game(p.id),w=setupSerpentWorld(g,p.id);
  assert.equal(w.obstacles.length,p.obstacles);
  for(const o of w.obstacles){assert.ok(o.radius>=19&&o.radius<=43);assert.ok(g.snakes.every(s=>Math.hypot(s.x-o.x,s.y-o.y)>100));}
  for(let i=0;i<w.obstacles.length;i++)for(let j=0;j<i;j++)assert.ok(Math.hypot(w.obstacles[i].x-w.obstacles[j].x,w.obstacles[i].y-w.obstacles[j].y)>w.obstacles[i].radius+w.obstacles[j].radius+120);
 }
});
test('physical collision moves whole snake out, uses cooldown, and never instantly kills it',()=>{
 const g=game(),w=setupSerpentWorld(g,'neon'),o=w.obstacles[0],s=g.snakes[0];
 s.x=o.x+3;s.y=o.y+4;s.segments=[{x:s.x,y:s.y},{x:s.x-5,y:s.y}];
 const before=s.mass,events=advanceSerpentWorld(g);
 assert.ok(events.some(e=>e.type==='bump'));assert.ok(Math.hypot(s.x-o.x,s.y-o.y)>=o.radius+14);assert.ok(s.alive);assert.ok(s.mass<before);assert.equal(s.segments[0].x,s.x);
 const after=s.mass;advanceSerpentWorld(g);assert.equal(s.mass,after);
});
test('frenzy periodically gives rare food bonus, without uncollectible decorations',()=>{
 const g=game('crystals'),w=setupSerpentWorld(g,'crystals',{challenge:'treasure'});
 assert.ok(g.food.some(f=>f.kind==='gem'||f.kind==='star'));
 g.elapsed=18;g.food.push({id:'f1000',x:1000,y:1000,kind:'apple',value:1});advanceSerpentWorld(g);
 assert.ok(w.frenzy);assert.equal(w.lastFrenzyCycle,0);
 g.elapsed=27;advanceSerpentWorld(g);assert.equal(w.frenzy,false);
 assert.ok(g.food.every(f=>Number.isFinite(f.x)&&Number.isFinite(f.y)));
});
test("owner visual identity requires existing owner role and never changes starting mass",()=>{
 assert.equal(ownerAllowed({role:'guest'},[]),false);
 assert.equal(ownerAllowed({role:'moderator'},[]),false);
 assert.equal(ownerAllowed({role:'owner'},[]),true);
 assert.equal(ownerAllowed({},[]),false);
 const g=game();setupSerpentWorld(g,'neon',{ownerAllowed:ownerAllowed({role:'owner'},[]),ownerSnakeId:'human'});
 assert.equal(g.world.ownerBadge,true);assert.equal(g.snakes[0].mass,28);assert.equal(g.snakes[1].mass,28);
 const other=game();setupSerpentWorld(other,'neon',{ownerAllowed:ownerAllowed({role:'guest'},[]),ownerSnakeId:'human'});
 assert.equal(other.world.ownerBadge,false);assert.equal(other.snakes[0].mass,28);
});
test('legendary bots still pursue players',()=>{
 const g=game();g.snakes[1].x=192;g.snakes[1].y=169;setupSerpentWorld(g,'neon',{difficulty:'legendary'});
 assert.ok(g.snakes[1].mass>=44);g.elapsed=.4;advanceSerpentWorld(g);assert.ok(Number.isFinite(g.snakes[1].targetAngle));
});
test('renderer overlay safely exits when no camera is provided',()=>{
 const g=game();setupSerpentWorld(g,'classic');assert.doesNotThrow(()=>drawSerpentWorld({game:g}));
});
test('UI retains authenticated owner entitlement and uses shared online maps',async()=>{
 const s=await readFile(new URL('../public/assets/js/serpent-ui.js',import.meta.url),'utf8');
 assert.match(s,/ownerAllowed\(accountAccess/);
 assert.match(s,/source==='owner'/);
 assert.match(s,/worldId:world.id/);assert.match(s,/worldId:\$\('arenaWorld'\).value/);
 assert.match(s,/mode==='online'\?Math\.min\(6,10-Number/);
 assert.match(s,/difficulty==='legendary'\?'hard':difficulty/);
 const html=await readFile(new URL('../public/serpent.html',import.meta.url),'utf8');
 for(const token of ['value="classic"','value="neon"','value="forest"','value="crystals"','value="9"','value="legendary"','value="treasure"','arenaWorldStatus'])assert.ok(html.includes(token),token);
 assert.doesNotMatch(html,/value="caves"|مغارات/);
});


test('arena maps have distinct animated effects and owner has a unique void-wyrm identity, not a crown',async()=>{
 const source=await readFile(new URL('../public/assets/js/serpent-worlds-v25-2.js',import.meta.url),'utf8');
 assert.match(source,/function paintWorldEffects/);
 assert.match(source,/w\.id==='volcano'/);
 assert.match(source,/w\.id==='ruins'/);
 assert.match(source,/w\.id==='storm'/);
 assert.match(source,/Void Wyrm/);
 assert.match(source,/cyan eyes/);
 assert.doesNotMatch(source,/function paintRoyal[\s\S]{0,500}lineTo\(0,-48\)/);
});
