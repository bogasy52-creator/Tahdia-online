import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {SerpentRenderer,arenaMapLayout} from '../public/assets/js/serpent-renderer.js';
import * as current from '../public/assets/js/engines/serpent-engine.js';
import * as prior from './fixtures/serpent-v135-reference.mjs';
async function art(failed=false){const calls=[],ctx=new Proxy({createLinearGradient:()=>({addColorStop(){}})},{get:(target,key)=>key in target?target[key]:(...args)=>calls.push([key,...args])});const scope={Image:class{set src(value){this.naturalWidth=768;this.naturalHeight=512;queueMicrotask(()=>failed?this.onerror():this.onload());}},document:{createElement:()=>({getContext:()=>ctx})},console};scope.window=scope;vm.runInContext(await readFile(new URL('../public/assets/js/serpent-art-v16.js',import.meta.url),'utf8'),vm.createContext(scope));await scope.BS_SERPENT_ART.ready;return {api:scope.BS_SERPENT_ART,ctx,calls};}
test('six heads occupy distinct normalized atlas cells and material caches stay bounded',async()=>{
 const {api,ctx,calls}=await art();for(const id of api.IDS){api.head(ctx,id,35);assert.equal(api.material(id),api.material(id));}assert.equal(new Set(calls.filter(c=>c[0]==='drawImage').map(c=>c[2]+':'+c[3])).size,6);for(const draw of calls.filter(c=>c[0]==='drawImage')){assert.equal(draw[4],256);assert.equal(draw[5],256);}assert.equal(api.material('unknown'),api.material('snake-wild'));
});
test('a missing atlas still draws a visible head without invalid drawImage calls',async()=>{
 const {api,ctx,calls}=await art(true);api.head(ctx,'snake-plasma',32);assert.ok(calls.some(c=>c[0]==='ellipse'));assert.ok(!calls.some(c=>c[0]==='drawImage'));
});
test('malformed, duplicate and excessive body points are sanitized with stable endpoints',async()=>{
 const {api,ctx,calls}=await art(),points=Array.from({length:2000},(_,i)=>({x:i,y:i%80}));points.splice(3,0,{x:NaN,y:4},{x:Infinity,y:3},{x:2,y:2},null,{x:1e15,y:3});const clean=api.pathPoints(points,1e9);assert.equal(clean.length,160);assert.equal(clean[0].x,0);assert.equal(clean.at(-1).x,1999);assert.ok(clean.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));api.body(ctx,[{x:0,y:0},{x:0,y:0}], 'snake-wild');assert.equal(calls.length,0);
});
test('adaptive detail preserves aim and viewport coordinates; maps fit short split screens',t=>{
 globalThis.window={devicePixelRatio:2};t.after(()=>delete globalThis.window);const canvas={getContext:()=>({}),getBoundingClientRect:()=>({width:390,height:844})},r=new SerpentRenderer(canvas);r.ids=['a'];r.game={snakes:[{id:'a',x:300,y:300,mass:28}]};const aim=r.aimAt(0,370,700);for(let i=0;i<260;i++)r.sampleFrame(35);assert.equal(r.dpr,1);assert.equal(r.aimAt(0,370,700),aim);assert.equal(r.width,390);assert.equal(r.height,844);r.setQuality('high');assert.equal(r.dpr,2);for(const height of [180,240,320,422,844]){const view={x:0,y:height,w:390,h:height},map=arenaMapLayout(view,true,390);if(map){assert.ok(map.y>=view.y+108);assert.ok(map.y+map.size<=view.y+view.h-46);assert.ok(map.x+map.size<=390);}}assert.equal(arenaMapLayout({x:0,y:0,w:390,h:130},true,390),null);
});
test('new bot appearances preserve installed 13.5 authoritative physics and random state identical for 300 steps',()=>{
 const a=current.createSerpentGame([{id:'a'}],{seed:171,collisionMode:'tail-guard',matchMode:'timed'}),b=prior.createSerpentGame([{id:'a'}],{seed:171,collisionMode:'tail-guard',matchMode:'timed'});current.addSerpentBots(a,6);prior.addSerpentBots(b,6);assert.equal(new Set(a.snakes.filter(s=>s.bot).map(s=>s.skin)).size,6);const clean=game=>{const clone=structuredClone(game);for(const snake of clone.snakes){delete snake.skin;delete snake.color;}return clone;};for(let i=0;i<300;i++){const input={angle:Math.sin(i/40),boost:i%80<15};current.steerSerpent(a,'a',input);prior.steerSerpent(b,'a',input);current.stepSerpent(a,1/60);prior.stepSerpent(b,1/60);}assert.deepEqual(clean(a),clean(b));
});
