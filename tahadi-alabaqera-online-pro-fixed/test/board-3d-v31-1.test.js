import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,access} from 'node:fs/promises';
import {snakeGeometry} from '../public/assets/js/arena-geometry.js';
import {Career} from '../src/career/core.js';

const read=file=>readFile(new URL('../public/'+file,import.meta.url),'utf8');
const exists=file=>access(new URL('../public/'+file,import.meta.url)).then(()=>true,()=>false);

async function pieces(){
 const NS='http://www.w3.org/2000/svg';
 const node=tag=>({tagName:tag,attrs:{},children:[],textContent:'',setAttribute(k,v){this.attrs[k]=String(v)},setAttributeNS(_ns,k,v){this.attrs[k]=String(v)},getAttribute(k){return this.attrs[k]},appendChild(c){this.children.push(c);return c}});
 const context=vm.createContext({document:{createElementNS:(_ns,tag)=>node(tag),readyState:'complete',body:{classList:{contains:()=>false}}},Image:class{set src(v){context.loaded.push(v)}},loaded:[]});
 context.window=context;vm.runInContext(await read('assets/js/pieces-v31.js'),context);
 return context;
}

test('every stone in the shop is a 3D render in all six player colours, in two sizes',async()=>{
 const c=await pieces(),P=c.BS_PIECES;
 // «شخصيتي» (33.0.0) is drawn as the player's hero, not a stone render
 const stones=Career.CATALOG.filter(i=>i.type==='pawn'&&i.id!=='pawn-character').map(i=>i.id);
 assert.deepEqual([...P.ITEMS].sort(),[...stones].sort(),'one model per shop stone');
 for(const id of stones)for(const color of P.COLORS)for(const size of ['s','l']){
  const url=P.src('pawn',{item:id,color,size});assert.ok(await exists(url.slice(1)),url);
 }
 for(const style of P.STYLES)for(const color of P.COLORS)for(const size of ['s','l'])assert.ok(await exists(P.src('marble',{style,color,size}).slice(1)),style+color+size);
 // the piece keeps its old frame, so boards place it exactly as before
 const g=P.pawn(c.document,null,{item:'pawn-onyx',color:'#22a565'});
 assert.equal(g.attrs['data-piece-design'],'rook');assert.equal(g.attrs['data-piece-item'],'pawn-onyx');
 const img=g.children[0];assert.equal(img.tagName,'image');assert.deepEqual([img.attrs.x,img.attrs.y,img.attrs.width,img.attrs.height],['-7','-19.5','14','22']);
 assert.equal(img.attrs.href,'/assets/pieces-3d/s/pawn-onyx-3.webp');
 const big=P.icon(c.document,{design:'gem',item:'pawn-jade',color:'#8b5cf6',size:'l'});assert.equal(big.attrs.viewBox,'-7 -19.5 14 22');assert.equal(big.children[0].children[0].attrs.href,'/assets/pieces-3d/pawn-jade-4.webp');
 const m=P.marble(c.document,null,{style:'galaxy',color:'#f2711c'});assert.equal(m.children[0].attrs.href,'/assets/pieces-3d/s/marble-galaxy-5.webp');
 // older callers that only know the shape still get a stone
 assert.equal(P.pawn(c.document,null,{design:'crown',color:'#2f86e8'}).attrs['data-piece-item'],'pawn-gold');
 // any colour falls on the closest render
 assert.equal(P.colorIndex('#3a8cf0'),1);assert.equal(P.colorIndex('#e0474c'),0);
});

test('the GPU die always ends with the thrown face on top',async()=>{
 const context=vm.createContext({});context.window=context;vm.runInContext(await read('assets/js/dice-3d-v31-1.js'),context);
 const D=context.BS_DIE3D,N={1:[0,1,0],6:[0,-1,0],3:[1,0,0],4:[-1,0,0],2:[0,0,1],5:[0,0,-1]};
 const rotate=([x,y,z,w],v)=>{const u=[x,y,z],uv=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],uuv=[u[1]*uv[2]-u[2]*uv[1],u[2]*uv[0]-u[0]*uv[2],u[0]*uv[1]-u[1]*uv[0]];return v.map((c,i)=>c+2*(w*uv[i]+uuv[i]));};
 for(let value=1;value<=6;value++)for(const yaw of [0,.42,-1.1,2.7]){
  const up=rotate(D.faceUp(value,yaw),N[value]);
  assert.ok(Math.abs(up[0])<1e-9&&Math.abs(up[1]-1)<1e-9&&Math.abs(up[2])<1e-9,value+' '+yaw+' '+up);
 }
 // opposite faces add up to seven
 for(const [a,b] of [[1,6],[2,5],[3,4]])assert.deepEqual(N[a].map(x=>x===0?0:-x),N[b]);
 for(const id of Career.CATALOG.filter(i=>i.type==='dice').map(i=>i.id))assert.ok(D.SKINS[id],'a 3D finish for '+id);
 assert.equal(D.supported(),false,'no document: pro-dice keeps its CSS cube');
});

test('pro-dice hands rolls and faces to the GPU die when it is available',async()=>{
 const calls=[];
 const el={dataset:{},classList:{add(){},remove(){},contains:()=>false},setAttribute(){},querySelector:()=>null,append(){},appendChild(){},dispatchEvent(){},set innerHTML(_v){}};
 const doc={createElement:()=>({className:'',dataset:{},classList:{add(){}},setAttribute(){},appendChild(){},append(){},set innerHTML(_v){}}),querySelectorAll:()=>[]};
 const context=vm.createContext({document:doc,matchMedia:()=>({matches:false}),setTimeout:fn=>{fn();return 1},CustomEvent:class{constructor(t,o){this.type=t;this.detail=o?.detail}},crypto:{getRandomValues:a=>{a[0]=7;return a}}});
 context.window=context;context.BS_DIE3D={attach(target){target.__die3d={set:v=>calls.push(['set',v]),roll:(v,d)=>{calls.push(['roll',v,d]);return Promise.resolve();}};return target.__die3d;}};
 vm.runInContext(await read('assets/js/pro-dice.js'),context);
 context.BS_DICE.mount(el);await context.BS_DICE.roll(el,6,{quiet:true});
 assert.deepEqual(calls.filter(c=>c[0]==='roll'),[['roll',6,1040]]);
 assert.equal(calls.at(-1)[0],'set');assert.equal(calls.at(-1)[1],6);assert.equal(el.dataset.value,6);
});

async function board({withArt=true,snake='snake-gold'}={}){
 const art={ready:[],bodies:[],heads:[]},frames=[];let wall=0;
 const ctx={setTransform(){},clearRect(){},save(){},restore(){},translate(){},rotate(){},scale(){},beginPath(){},moveTo(){},lineTo(){},arc(){},ellipse(){},closePath(){},fill(){},stroke(){},createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})};
 const canvas={dataset:{},style:{props:{},setProperty(k,v,p){this.props[k]=[v,p]}},setAttribute(){},getContext:()=>ctx};
 const board={getBoundingClientRect:()=>({width:400,height:400}),offsetLeft:14,offsetTop:15},wrap={appendChild(){}},game={classList:{contains:()=>false}};
 const document={hidden:false,documentElement:{dataset:{snake}},getElementById:id=>({board,game,boardWrap:wrap}[id]),createElement:()=>canvas,querySelector:()=>null};
 const context=vm.createContext({snakeGeometry,document,Image:class{addEventListener(){}},devicePixelRatio:1,matchMedia:()=>({matches:false}),performance:{now:()=>wall},requestAnimationFrame:fn=>{frames.push(fn);return frames.length},setTimeout:()=>1,clearTimeout(){}});
 context.window=context;context.BS_PRO={paused:false};context.addEventListener=()=>{};context.removeEventListener=()=>{};
 if(withArt)context.BS_SERPENT_ART={get ready(){art.ready.push(1);return Promise.resolve(true);},body:(c,pts,id,r,boost,variant,budget,opts)=>art.bodies.push({id,r,opts,n:pts.length}),head:(c,id,size)=>art.heads.push({id,size})};
 vm.runInContext((await read('assets/js/neon-arena.js')).replace(/^import .*?;\n/gm,''),context);
 const routes=[{from:62,to:19,a:{x:150,y:350},b:{x:850,y:850}},{from:87,to:24,a:{x:650,y:150},b:{x:350,y:750}},{from:4,to:14,a:{x:350,y:950},b:{x:650,y:850}}];
 context.BS_ARENA.layout(routes);
 return {context,art,canvas,routes,step(ms){wall=ms;frames.shift()?.(ms)}};
}

test('board snakes are the arena species, with the equipped one first, and the head sheet loads once',async()=>{
 const h=await board();h.context.BS_ARENA.layout(h.routes);
 assert.equal(h.art.ready.length,1,'one request for the painted heads');
 h.step(100);
 assert.deepEqual(h.art.heads.map(x=>x.id),['snake-gold','snake-wild']);
 assert.ok(h.art.bodies.every(b=>b.opts.patternScale>0&&b.opts.patternScale<1),'scales shrink to the board');
 // the canvas lies exactly over the tiles
 assert.deepEqual(h.canvas.style.props.left,['14px','important']);assert.deepEqual(h.canvas.style.props.width,['400px','important']);assert.deepEqual(h.canvas.style.props.right,['auto','important']);
 const plain=await board({withArt:false});plain.step(100);assert.equal(Number(plain.canvas.dataset.snakes),2,'draws without the art helper too');
});

test('a snake that eats stays bigger for the rest of the match',async()=>{
 const h=await board();h.step(100);const before=h.art.bodies.find(b=>b.id==='snake-gold').r;
 h.context.BS_ARENA.meal(62,2);h.art.bodies.length=0;h.step(200);const fed=h.art.bodies.find(b=>b.id==='snake-gold').r;
 assert.ok(fed>before*1.15,'two meals make the body thicker');
 h.context.BS_ARENA.meal();h.art.bodies.length=0;h.step(300);assert.equal(h.art.bodies.find(b=>b.id==='snake-gold').r,before,'a new match starts lean');
});

test('the snakes page plays a clear eating sound, keeps the growth and resets it for a new match',async()=>{
 const page=await read('snakes.html'),audio=await read('assets/js/audio-manager.js');
 assert.match(audio,/samples\.snakeEat='assets\/sounds\/board-v31-1\/snake-eat\.wav'/);assert.ok(await exists('assets/sounds/board-v31-1/snake-eat.wav'));
 assert.match(page,/cuePhase\(strike\);\s*BS_AUDIO\.play\(["']snakeEat["']/);
 assert.match(page,/snakeMeals\.set\(Number\(fromPos\),\s*meals\);\s*window\.BS_ARENA\?\.meal\?\.\(fromPos,\s*meals\)/);
 assert.doesNotMatch(page,/snakeMeals\.delete\(/,'growth is kept after the stone is released');
 // 33.0.0: one place resets it — the first state of every match (a new one or a rematch)
 assert.equal(page.match(/snakeMeals\.clear\(\);\s*window\.BS_ARENA\?\.meal\?\.\(\);\s*BS_AUDIO\.prime/g).length,1);
 assert.match(page,/if \(!prev \|\| prev\.moveCount > state\.moveCount\) \{\s*journal\?\.reset\(state\);\s*snakeMeals\.clear\(\)/);
 assert.match(page,/classList\.add\(j\s*>\s*n\s*\?\s*["']ladder-foot-cell["']\s*:\s*["']snake-head-cell["']\)/);
 for(const p of ['dice.html','snakes.html','zahra.html','jackaroo.html','shop.html'])assert.match(await read(p),/dice-3d-v31-1\.js\?v=[\d.]+"><\/script><script[^>]*pro-dice\.js/,p+' loads the GPU die before pro-dice');
});

test('player names on the tables fit their seat: shrink, wrap, then an ellipsis',async()=>{
 const {fitName}=await import('../public/assets/js/board-petals-v29.js');
 const short=fitName('اللاعب الأول',50,3.2);assert.deepEqual(short.lines,['اللاعب الأول']);assert.equal(short.size,3.2);
 // a side seat of the Jackaroo ring: two lines, both inside the band
 const two=fitName('Mohammed Alqahtani',18.4,3.2,2);assert.equal(two.lines.length,2);assert.deepEqual(two.lines,['Mohammed','Alqahtani']);assert.ok(two.width<=18.4&&two.size>=3.2*.8,JSON.stringify(two));
 // one long word cannot wrap: it ends in an ellipsis
 const word=fitName('عبدالرحمنالشمريالقحطاني',18.4,3.2,2);assert.equal(word.lines.length,1);assert.ok(word.lines[0].endsWith('…'));assert.ok(word.width<=18.4);
 // Zahra's six-seat name plate never grows past its room
 for(const name of ['Mohammed Alqahtani','عبدالرحمن الشمري','سارة']){const fit=fitName(name,20.4,3);assert.equal(fit.lines.length,1);assert.ok(fit.width<=20.4,name);}
 assert.deepEqual(fitName('   ',20,3).lines,[]);
});

test('the shop shows each board as it plays',async()=>{
 const shop=await read('assets/js/shop-v31.js');
 // 32.0.0: the boards on sale have new pictures, the retired ones keep theirs
 const photos=Object.fromEntries([...shop.matchAll(/'(board-[a-z]+)':'(board-v3[0-9]+-[a-z]+)'/g)].map(m=>[m[1],m[2]]));
 for(const item of Career.CATALOG.filter(i=>i.type==='board')){assert.ok(photos[item.id],item.id);assert.ok(await exists('assets/previews/'+photos[item.id]+'.webp'),item.id);}
 for(const id of Career.STOREFRONT.filter(id=>id.startsWith('board-')))assert.match(photos[id],/^board-v32-/,id);
 assert.match(shop,/'\/assets\/previews\/'\+BOARD_PHOTOS\[item\.id\]\+'\.webp'/);
 assert.match(shop,/stage\.dataset\.diceSkin=item\.id/);
});
