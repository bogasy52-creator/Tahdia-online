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
