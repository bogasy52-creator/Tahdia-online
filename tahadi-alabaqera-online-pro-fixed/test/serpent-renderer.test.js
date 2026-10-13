import test from 'node:test';
import assert from 'node:assert/strict';
import {SerpentRenderer} from '../public/assets/js/serpent-renderer.js';
test('a long visible body is drawn even when its head is outside the camera',t=>{
 const seen=[],ctx=new Proxy({createRadialGradient:()=>({addColorStop(){}})},{get(o,k){return k in o?o[k]:()=>{}}});
 globalThis.window={devicePixelRatio:1,BS_COSMETIC_ART:{body(_ctx,_points,id){seen.push(id)},head(){}}};t.after(()=>{delete globalThis.window;});
 const canvas={getContext:()=>ctx,getBoundingClientRect:()=>({width:400,height:400}),dataset:{}},r=new SerpentRenderer(canvas);
 const snake=(id,x,y,segments)=>({id,name:id,skin:id,x,y,angle:0,mass:80,score:0,alive:true,segments,boost:false});
 r.setGame({tick:1,width:1800,height:1800,food:[],snakes:[snake('self',400,400,[{x:395,y:400}]),snake('long',1200,400,[{x:1100,y:400},{x:950,y:400},{x:800,y:400},{x:600,y:400}])] },['self']);r.draw(0);assert.ok(seen.includes('long'));
});
test('own steering is visible immediately, is bounded, and never changes authoritative state',t=>{
 globalThis.window={devicePixelRatio:1};t.after(()=>delete globalThis.window);
 const r=new SerpentRenderer({getContext:()=>({}),getBoundingClientRect:()=>({width:390,height:844})});
 const s={id:'self',x:100,y:100,angle:0,mass:28,score:17,alive:true,segments:[{x:95,y:100},{x:90,y:100}]},game={status:'playing',snakes:[s]};r.setGame(game,['self'],true);r.received=100;r.setInput('self',Math.PI/2,true);
 const before=structuredClone(game),predicted=r.interpolate(s,150);assert.ok(predicted.angle>0);assert.ok(predicted.x>100);assert.deepEqual(game,before);assert.equal(predicted.score,17);
 assert.deepEqual(r.interpolate(s,1000),r.interpolate(s,200));game.status='finished';assert.equal(r.interpolate(s,150),s);
});

test('a new round immediately draws opponents at their new spawn instead of the previous round',t=>{
 globalThis.window={devicePixelRatio:1};t.after(()=>delete globalThis.window);
 const r=new SerpentRenderer({getContext:()=>({}),getBoundingClientRect:()=>({width:390,height:844})});
 const snake=(id,x)=>({id,x,y:300,angle:0,mass:28,score:0,alive:true,segments:[{x,y:300}]});
 r.setGame({status:'playing',tick:100,snakes:[snake('self',100),snake('opponent',200)]},['self'],true);
 const next={status:'playing',tick:0,snakes:[snake('self',100),snake('opponent',1400)]};
 r.setGame(next,['self'],true);assert.equal(r.interpolate(next.snakes[1],r.received).x,1400);
});
