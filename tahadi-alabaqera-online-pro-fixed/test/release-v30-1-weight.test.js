import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {snakeGeometry} from '../public/assets/js/arena-geometry.js';
import {recolorBluePixels,ARENA_HUES,cosmeticSnakeHue} from '../public/assets/js/arena-palette.js';

// Ludo, Jackaroo, dice and the shop include the snakes/arena art helpers but
// never draw a cobra. Those 1.3 MB of sprite sheets must only be requested by
// the code that actually draws them.
function imageRecorder(){
 const requested=[];
 class Image{constructor(){this.complete=true;this.naturalWidth=1024;this.naturalHeight=1536;}addEventListener(_n,fn){this.onload=fn;}set src(value){this.url=value;requested.push(value);}get src(){return this.url||'';}}
 return {Image,requested};
}
const source=async file=>(await readFile(new URL('../public/assets/js/'+file,import.meta.url),'utf8')).replace(/^import .*?;\n/gm,'');

async function arenaHelpers({snakesPage=false}={}){
 const {Image,requested}=imageRecorder(),ctx={drawImage(){},getImageData:()=>({data:new Uint8ClampedArray(4)}),putImageData(){},setTransform(){},clearRect(){},save(){},restore(){}};
 const board={getBoundingClientRect:()=>({width:390,height:490})},game={classList:{contains:()=>false},querySelector:()=>null,prepend(){}},wrap={appendChild(){}};
 const canvas=()=>({width:0,height:0,dataset:{},className:'',setAttribute(){},getContext:()=>ctx});
 const events=new Map();
 const document={readyState:'loading',hidden:false,body:{classList:{contains:c=>snakesPage&&c==='game-snakes'}},documentElement:{dataset:{}},getElementById:id=>({board,game,boardWrap:wrap}[id]),createElement:tag=>tag==='canvas'?canvas():{setAttribute(){},className:''},querySelector:()=>null,addEventListener(){},removeEventListener(){}};
 const context=vm.createContext({snakeGeometry,recolorBluePixels,ARENA_HUES,cosmeticSnakeHue,document,Image,devicePixelRatio:1,matchMedia:()=>({matches:false}),performance:{now:()=>0},requestAnimationFrame:()=>1,setTimeout:fn=>{events.set('timeout',fn);return 1},clearTimeout(){},requestIdleCallback:fn=>{events.set('idle',fn);return 1}});
 context.window=context;context.addEventListener=(name,fn)=>events.set(name,fn);context.removeEventListener=()=>{};
 vm.runInContext(await source('neon-arena.js'),context);
 return {context,requested,events};
}

test('pages that only borrow the stone helper do not download the cobra, ladder or board sheets',async()=>{
 const h=await arenaHelpers();
 assert.deepEqual(h.requested,[]);
 h.context.BS_STONES={draw:()=>true};
 h.context.BS_ARENA.crystal({appendChild(){}},1);
 assert.deepEqual(h.requested,[],'the v30 stones draw without the old sprite sheet');
});

test('laying out the snakes board downloads no cobra, ladder or board sheets (only the arena head sheet, through its own helper)',async()=>{
 const h=await arenaHelpers();
 h.context.BS_ARENA.layout([{from:17,to:7,index:0,a:{x:300,y:800},b:{x:600,y:900}}]);
 h.context.BS_ARENA.layout([{from:17,to:7,index:0,a:{x:300,y:800},b:{x:600,y:900}}]);
 assert.deepEqual(h.requested,[]);
});

test('the snakes page warms nothing in the background; only the lobby portrait fetches its art',async()=>{
 const h=await arenaHelpers({snakesPage:true});
 assert.deepEqual(h.requested,[]);assert.equal(h.events.has('idle'),false);
 h.context.BS_ARENA.portrait({appendChild(){}});h.context.BS_ARENA.portrait({appendChild(){}});
 assert.deepEqual(h.requested,['assets/arena/neon-cobra.webp'],'one request however often the portrait is drawn');
});

test('the arena head sheet is fetched on first use, not when a page includes the helper',async()=>{
 const {Image,requested}=imageRecorder(),context=vm.createContext({Image,document:{createElement:()=>({getContext:()=>null})},Math});context.window=context;
 vm.runInContext(await source('serpent-art-v16.js'),context);
 assert.deepEqual(requested,[]);
 const ready=context.BS_SERPENT_ART.ready;assert.equal(typeof ready.then,'function');
 assert.deepEqual(requested,['assets/arena/v16/serpent-heads.webp']);
 void context.BS_SERPENT_ART.ready;assert.equal(requested.length,1,'only one download however often it is awaited');
});

test('the cosmetics helper no longer starts the arena download at start-up',async()=>{
 const text=await readFile(new URL('../public/assets/js/cosmetic-art.js',import.meta.url),'utf8');
 assert.doesNotMatch(text,/const ready=Promise\.resolve\(root\.BS_SERPENT_ART\?\.ready\)/);
 assert.match(text,/get ready\(\)\{return Promise\.resolve\(root\.BS_SERPENT_ART\?\.ready\);\}/);
 assert.match(text,/item\.type==='snake'\?root\.BS_SERPENT_ART\?\.ready:undefined/);
});
