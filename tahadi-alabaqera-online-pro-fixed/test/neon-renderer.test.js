import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

async function renderer(){
 const frames=[],timers=new Map(),events=new Map(),calls=[],proxy={dataset:{}},canvas={dataset:{},setAttribute(){}};
 let wall=0,nextTimer=0;
 const ctx={setTransform(){},clearRect(){calls.push('clear')},save(){},restore(){},translate(){},rotate(){},drawImage(...args){assert.ok(args.slice(1).every(Number.isFinite));calls.push('raster')}};
 canvas.getContext=()=>ctx;
 const board={getBoundingClientRect:()=>({width:390,height:490})},game={classList:{contains:()=>false}},wrap={appendChild(){}};
 const document={hidden:false,documentElement:{dataset:{}},getElementById:id=>({board,game,boardWrap:wrap}[id]),createElement:()=>canvas,querySelector:()=>proxy,addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name)};
 class Image{constructor(){this.complete=true;this.naturalWidth=1024;this.naturalHeight=1536;}addEventListener(){}set src(value){this.url=value;if(value.includes('objects')){this.naturalWidth=2048;this.naturalHeight=768}}}
 const context=vm.createContext({document,Image,devicePixelRatio:1,matchMedia:()=>({matches:false}),performance:{now:()=>wall},requestAnimationFrame:fn=>{frames.push(fn);return frames.length},setTimeout:(fn,ms)=>{timers.set(++nextTimer,{fn,ms});return nextTimer},clearTimeout:id=>timers.delete(id)});
 context.window=context;context.BS_PRO={paused:false};context.addEventListener=(name,fn)=>events.set(name,fn);context.removeEventListener=name=>events.delete(name);
 vm.runInContext(await readFile(new URL('../public/assets/js/neon-arena.js',import.meta.url),'utf8'),context);
 context.BS_ARENA.layout([{from:17,to:7,index:0,a:{x:300,y:800},b:{x:600,y:900}},{from:4,to:14,index:1,a:{x:200,y:900},b:{x:500,y:800}}]);
 return {context,canvas,proxy,calls,timers,events,step(ms){wall=ms;frames.shift()?.(ms)},time(ms){wall=ms}};
}
test('arena renders independent raster snakes and ladders, and does not clear skipped frames',async()=>{
 const h=await renderer();h.step(100);assert.equal(h.canvas.dataset.assets,'ready');assert.equal(h.canvas.dataset.snakes,1);assert.equal(h.canvas.dataset.ladders,1);assert.ok(h.calls.filter(x=>x==='raster').length>=65);
 const clears=h.calls.filter(x=>x==='clear').length;h.step(115);assert.equal(h.calls.filter(x=>x==='clear').length,clears,'throttled frames must retain the previous drawing');
});
test('the visible creature grows, freezes while paused, and returns to its original scale',async()=>{
 const h=await renderer();h.step(100);h.context.BS_ARENA.phase(17,'digesting');for(let i=1;i<=9;i++)h.step(100+i*50);
 const grown=Number(h.proxy.dataset.visualScale);assert.ok(grown>1.4);h.context.BS_PRO.paused=true;h.step(4000);assert.equal(Number(h.proxy.dataset.visualScale),grown);
 h.context.BS_PRO.paused=false;h.context.BS_ARENA.phase(17,null);h.step(4050);assert.equal(Number(h.proxy.dataset.visualScale),1);assert.equal(h.proxy.dataset.visualPhase,'idle');
});
test('growth completion is independent of render frames and excludes paused time',async()=>{
 const h=await renderer();let done=false;const waiting=h.context.BS_ARENA.wait(900).then(()=>done=true);assert.equal([...h.timers.values()][0].ms,900);
 h.time(200);h.context.BS_PRO.paused=true;h.events.get('bs-match-pause')();assert.equal(h.timers.size,0);
 h.time(10000);h.context.BS_PRO.paused=false;h.events.get('bs-match-pause')();assert.equal([...h.timers.values()][0].ms,700);
 [...h.timers.values()][0].fn();await waiting;assert.ok(done);assert.equal(h.events.size,0);
});
