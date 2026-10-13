import test from 'node:test';
import assert from 'node:assert/strict';
import {ArenaGestures} from '../public/assets/js/arena-gestures.js';
import {SerpentRenderer} from '../public/assets/js/serpent-renderer.js';
const rect={left:10,top:20,width:390,height:844};
const event=(x,y)=>({pointerId:1,clientX:x,clientY:y});
test('a short reverse swipe turns left immediately after a long right swipe',()=>{
 const moves=[],g=new ArenaGestures({steer:(_,angle)=>moves.push(angle)});
 g.start(event(100,200),rect);g.move(event(180,200));g.move(event(164,200));
 assert.equal(Math.cos(moves.at(-1)),-1);
});
test('changing direction uses the latest finger motion rather than the old pad centre',()=>{
 const moves=[],g=new ArenaGestures({steer:(_,angle)=>moves.push(angle)});
 g.start(event(100,200),rect);g.move(event(180,200));g.move(event(180,180));
 assert.equal(moves.at(-1),-Math.PI/2);g.move(event(180,202));assert.equal(moves.at(-1),Math.PI/2);
});
test('mouse aiming is relative to the rendered head in a split viewport',t=>{
 globalThis.window={devicePixelRatio:1};t.after(()=>delete globalThis.window);
 const r=new SerpentRenderer({getContext:()=>({}),getBoundingClientRect:()=>({width:800,height:400})});
 r.setGame({snakes:[{id:'a',x:400,y:400},{id:'b',x:900,y:400}]},['a','b']);
 r.poses.set('b',{x:920,y:410});r.cameras.set('b',{x:900,y:400,zoom:.5});
 assert.equal(typeof r.aimAt,'function');
 assert.equal(r.aimAt(1,610,405),Math.PI/2);
 assert.equal(r.aimAt(1,650,205),0);
});
