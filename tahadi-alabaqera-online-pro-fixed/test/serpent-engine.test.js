import test from 'node:test';
import assert from 'node:assert/strict';
import {createSerpentGame,steerSerpent,stepSerpent,serpentSnapshot,addSerpentBots} from '../public/assets/js/engines/serpent-engine.js';

const game=(options={})=>createSerpentGame([{id:'a',name:'A'},{id:'b',name:'B'}],{seed:41,foodCount:0,duration:120,...options});
test('food grows the actual snake and credits its score only once',()=>{
 const g=game(),s=g.snakes[0],mass=s.mass;g.food.push({id:'meal',x:s.x,y:s.y,radius:4,value:3});
 stepSerpent(g,0.01);assert.equal(s.score,3);assert.equal(s.mass,mass+3);assert.equal(g.food.some(f=>f.id==='meal'),false);
 stepSerpent(g,0.01);assert.equal(s.score,3);
});
test('defeated snake becomes edible food and cannot keep moving',()=>{
 const g=game(),s=g.snakes[0];s.x=4;s.y=200;s.angle=Math.PI;s.targetAngle=Math.PI;const before=g.food.length;
 stepSerpent(g,0.05);assert.equal(s.alive,false);assert.ok(g.food.length>before);const x=s.x;stepSerpent(g,0.05);assert.equal(s.x,x);
});
test('colliding with another body kills the attacker and credits the defender',()=>{
 const g=game(),[a,b]=g.snakes;a.x=250;a.y=250;a.angle=0;a.targetAngle=0;b.x=900;b.y=900;b.segments=Array.from({length:30},()=>({x:255,y:250}));
 stepSerpent(g,0.01);assert.equal(a.alive,false);assert.equal(b.kills,1);
});
test('head collision lets a larger snake consume a smaller snake',()=>{
 const g=game(),[a,b]=g.snakes;a.mass=100;a.x=400;a.y=400;b.x=409;b.y=400;a.segments=[];b.segments=[];
 stepSerpent(g,0.01);assert.equal(a.alive,true);assert.equal(b.alive,false);assert.equal(a.kills,1);
});
test('boost burns mass and cannot continue at the minimum mass',()=>{
 const g=game(),s=g.snakes[0];s.mass=40;steerSerpent(g,'a',{angle:s.angle,boost:true});const x=s.x,y=s.y;
 for(let i=0;i<10;i++)stepSerpent(g,0.05);assert.ok(s.mass<40);assert.ok(Math.hypot(s.x-x,s.y-y)>55);
 s.mass=24;steerSerpent(g,'a',{angle:s.angle,boost:true});stepSerpent(g,0.05);assert.equal(s.boost,false);assert.equal(s.mass,24);
});
test('malformed input cannot mutate coordinates, score or steering',()=>{
 const g=game(),s=g.snakes[0],snapshot=structuredClone(s);assert.equal(steerSerpent(g,'a',{angle:NaN,x:99999,score:5000}),false);
 assert.deepEqual(s,snapshot);assert.equal(steerSerpent(g,'unknown',{angle:0}),false);
 assert.equal(steerSerpent(g,'a',{angle:1,boost:true,score:5000,x:0}),true);assert.equal(s.score,0);assert.equal(s.x,snapshot.x);
});
test('large frame deltas are bounded and seeded bots are deterministic',()=>{
 const a=game({foodCount:80}),b=game({foodCount:80});addSerpentBots(a,4);addSerpentBots(b,4);
 for(let i=0;i<80;i++){stepSerpent(a,0.05);stepSerpent(b,0.05)}assert.deepEqual(serpentSnapshot(a),serpentSnapshot(b));
 const c=game(),d=game();stepSerpent(c,999);stepSerpent(d,0.1);assert.deepEqual(serpentSnapshot(c),serpentSnapshot(d));
 assert.equal(a.snakes.filter(s=>s.bot).length,4);
});
test('a finished match freezes and reports a single authoritative result',()=>{
 const g=game({duration:0.1});g.snakes[0].score=20;stepSerpent(g,0.1);assert.equal(g.status,'finished');assert.deepEqual(g.winners,['a']);
 const snapshot=serpentSnapshot(g);stepSerpent(g,0.1);assert.deepEqual(serpentSnapshot(g),snapshot);
});
test('snapshots expose no simulation RNG or mutable references',()=>{
 const g=game({foodCount:2}),s=serpentSnapshot(g);assert.equal(s.randomState,undefined);s.snakes[0].score=900;assert.equal(g.snakes[0].score,0);
});
test('adding bots spaces all initial snakes without overlapping a human spawn',()=>{
 const g=game();addSerpentBots(g,6);
 for(let i=0;i<g.snakes.length;i++)for(let j=i+1;j<g.snakes.length;j++)assert.ok(Math.hypot(g.snakes[i].x-g.snakes[j].x,g.snakes[i].y-g.snakes[j].y)>120);
});
test('solo scores compete with bots instead of automatically awarding the human a win',()=>{
 const g=createSerpentGame([{id:'a',name:'A'}],{foodCount:0,duration:.1});addSerpentBots(g,2);g.snakes[0].score=3;g.snakes[1].score=30;stepSerpent(g,.1);assert.deepEqual(g.winners,['bot-1']);
});

test('arena eating grows beyond the old 180 limit with a continuous finite body; legacy caps stay unchanged',()=>{
 const g=createSerpentGame([{id:'long'}],{collisionMode:'arena-v23',width:2400,height:2400,foodCount:0,duration:120});const s=g.snakes[0];Object.assign(s,{x:500,y:1200,angle:0,targetAngle:0,mass:179,segments:Array.from({length:179},(_,i)=>({x:500-i*5,y:1200}))});
 for(let i=0;i<120;i++){g.food=[{id:'growth-'+i,x:s.x+5,y:s.y,value:5,radius:6}];stepSerpent(g,.05);}
 assert.equal(s.mass,720);assert.ok(s.score>=600);stepSerpent(g,.05);assert.equal(s.segments.length,720);
 for(let i=1;i<s.segments.length;i++){const p=s.segments[i];assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));assert.ok(Math.hypot(p.x-s.segments[i-1].x,p.y-s.segments[i-1].y)<=5.00001);}
 const old=createSerpentGame([{id:'old'}],{foodCount:0});old.snakes[0].mass=180;old.food=[{id:'old-food',x:old.snakes[0].x,y:old.snakes[0].y,value:5,radius:20}];stepSerpent(old,.05);assert.equal(old.snakes[0].mass,180);
});
