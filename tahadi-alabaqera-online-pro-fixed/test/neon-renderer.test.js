import {drawNeonBody,drawNeonHead,sampleNeonSpine} from '../public/assets/js/neon-snakes-v33.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {snakeGeometry} from '../public/assets/js/arena-geometry.js';
import {recolorBluePixels,ARENA_HUES,cosmeticSnakeHue} from '../public/assets/js/arena-palette.js';
import {readFile} from 'node:fs/promises';

async function renderer(){
 const frames=[],timers=new Map(),events=new Map(),calls=[],proxy={dataset:{}},canvas={dataset:{},setAttribute(){}};
 let wall=0,nextTimer=0;
 const ctx={quadraticCurveTo(){},bezierCurveTo(){},fillRect(){},setTransform(){},clearRect(){calls.push('clear')},save(){},restore(){},translate(){},rotate(){},scale(){},beginPath(){},moveTo(){},lineTo(){},bezierCurveTo(){},quadraticCurveTo(){},arc(){},ellipse(){},closePath(){},clip(){},fill(){},fillText(){},stroke(){calls.push('body')},createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}}),drawImage(...args){assert.ok(args.slice(1).every(Number.isFinite));assert.ok(args[3]>0&&args[4]>0&&args[7]>0&&args[8]>0);calls.push('raster')}};
 ctx.getImageData=()=>({data:new Uint8ClampedArray([0,100,255,255])});ctx.putImageData=()=>{};
 canvas.getContext=()=>ctx;
 const board={getBoundingClientRect:()=>({width:390,height:490})},game={classList:{contains:()=>false}},wrap={appendChild(){}};
 let made=0;
 const document={hidden:false,documentElement:{dataset:{}},getElementById:id=>({board,game,boardWrap:wrap}[id]),createElement:tag=>tag!=='canvas'?{setAttribute(){}}:++made===1?canvas:{width:0,height:0,setAttribute(){},getContext:()=>ctx},querySelector:()=>proxy,addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name)};
 class Image{constructor(){this.complete=true;this.naturalWidth=1024;this.naturalHeight=1536;}addEventListener(){}set src(value){this.url=value;if(value.includes('objects')){this.naturalWidth=2048;this.naturalHeight=768}}}
 const context=vm.createContext({drawNeonBody,drawNeonHead,snakeGeometry,recolorBluePixels,ARENA_HUES,cosmeticSnakeHue,document,Image,devicePixelRatio:1,matchMedia:()=>({matches:false}),performance:{now:()=>wall},requestAnimationFrame:fn=>{frames.push(fn);return frames.length},setTimeout:(fn,ms)=>{timers.set(++nextTimer,{fn,ms});return nextTimer},clearTimeout:id=>timers.delete(id)});
 context.window=context;context.BS_PRO={paused:false};context.addEventListener=(name,fn)=>events.set(name,fn);context.removeEventListener=name=>events.delete(name);
 vm.runInContext((await readFile(new URL('../public/assets/js/neon-arena.js',import.meta.url),'utf8')).replace(/^import .*?;\n/gm,''),context);
 context.BS_ARENA.layout([{from:17,to:7,index:0,a:{x:300,y:800},b:{x:600,y:900}},{from:4,to:14,index:1,a:{x:200,y:900},b:{x:500,y:800}}]);
 return {context,canvas,proxy,calls,timers,events,step(ms){wall=ms;frames.shift()?.(ms)},time(ms){wall=ms}};
}
test('without the arena art helper the board still draws its snakes and ladders, and throttled frames keep the last drawing',async()=>{
 const h=await renderer();h.step(100);assert.equal(h.canvas.dataset.assets,'ready');assert.equal(h.canvas.dataset.snakes,1);assert.equal(h.canvas.dataset.ladders,1);assert.equal(h.calls.filter(x=>x==='raster').length,0);assert.ok(h.calls.filter(x=>x==='body').length>8);
 const clears=h.calls.filter(x=>x==='clear').length;h.step(115);assert.equal(h.calls.filter(x=>x==='clear').length,clears,'throttled frames must retain the previous drawing');
});
test('the visible creature grows, freezes while paused, and returns to its original scale',async()=>{
 const h=await renderer();h.step(100);h.context.BS_ARENA.phase(17,'digesting');for(let i=1;i<=9;i++)h.step(100+i*50);
 const grown=Number(h.proxy.dataset.visualScale);assert.ok(grown>1.22);h.context.BS_PRO.paused=true;h.step(4000);assert.equal(Number(h.proxy.dataset.visualScale),grown);
 h.context.BS_PRO.paused=false;h.context.BS_ARENA.phase(17,null);h.step(4050);assert.equal(Number(h.proxy.dataset.visualScale),1);assert.equal(h.proxy.dataset.visualPhase,'idle');
});
test('growth completion is independent of render frames and excludes paused time',async()=>{
 const h=await renderer();let done=false;const waiting=h.context.BS_ARENA.wait(900).then(()=>done=true);assert.equal([...h.timers.values()][0].ms,900);
 h.time(200);h.context.BS_PRO.paused=true;h.events.get('bs-match-pause')();assert.equal(h.timers.size,0);
 h.time(10000);h.context.BS_PRO.paused=false;h.events.get('bs-match-pause')();assert.equal([...h.timers.values()][0].ms,700);
 [...h.timers.values()][0].fn();await waiting;assert.ok(done);assert.equal(h.events.size,0);
});
test('every shop stone becomes its 3D piece in the player colour, and characters keep their sheet',async()=>{
 const h=await renderer(),made=[],shapes={'pawn-jade':'gem','pawn-gold':'crown','pawn-orb':'orb'};h.context.BS_COSMETIC_ART={paint(){throw new Error('old stones must not be replaced')}};
 h.context.BS_PIECES={equipped:()=>h.context.document.documentElement.dataset.pawn,designFor:id=>shapes[id]||'classic',icon:(doc,opts)=>{made.push(opts);return {opts};}};
 for(const pawn of ['pawn-classic','pawn-jade','pawn-gold','pawn-orb']){h.context.document.documentElement.dataset.pawn=pawn;const node=h.context.BS_ARENA.crystal({appendChild(){}},1);assert.equal(node.opts.color,h.context.BS_ARENA.PLAYER_COLORS[1]);}
 assert.deepEqual(made.map(o=>o.design),['classic','gem','crown','orb']);
 h.context.document.documentElement.dataset.pieceArt='characters';h.context.BS_STONES={draw:()=>true};const c=h.context.BS_ARENA.crystal({appendChild(){}},0);assert.equal(c.width,144);assert.equal(c.height,180);
 assert.equal(h.calls.filter(c=>c==='raster').length,0);
});

test('scale sampling follows arc length through uneven and repeated knots and preserves endpoints',()=>{const points=[{x:0,y:0},{x:1,y:0},{x:1,y:0},{x:10,y:0},{x:10,y:7}],out=sampleNeonSpine(points,2);assert.deepEqual(out[0],points[0]);assert.deepEqual(out.at(-1),points.at(-1));assert.deepEqual(out.slice(0,6),[0,2,4,6,8,10].map(x=>({x,y:0})));assert.deepEqual(out.slice(6),[2,4,6,7].map(y=>({x:10,y})));for(const spacing of [0,-1,NaN,Infinity])assert.throws(()=>sampleNeonSpine(points,spacing),RangeError);});
