import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createSerpentGame,stepSerpent,serpentSnapshot,addSerpentBots} from '../public/assets/js/engines/serpent-engine.js';
import {stepArenaWorld,validWorld} from '../public/assets/js/engines/arena-worlds-v27.js';
import {compactSerpentFrame,applySerpentFrame} from '../public/assets/js/serpent-network.js';
import {SerpentRoom} from '../src/serpent/serpent-room.js';

const game=id=>createSerpentGame([{id:'a',name:'A'},{id:'b',name:'B'}],{collisionMode:'arena-v23',worldId:id,seed:772,duration:120});
function place(s,x,y){s.x=x;s.y=y;s.segments=s.segments.map((_,i)=>({x:x-i*5,y}));}
function at(s,z){place(s,z.x,z.y);}
const mine=(g,type,id='a')=>g.events.filter(e=>e.type===type&&e.id===id).length;

test('glacier: the frost wave warns first, then slows only at its ring, with cooldown, immunity and reset',()=>{
 const g=game('glacier'),z=g.world.zones[0],s=g.snakes[0];place(g.snakes[1],40,40);
 g.elapsed=13;place(s,z.x+10,z.y);stepArenaWorld(g,.05);
 assert.equal(g.world.phase,'warning');assert.equal(z.pulse,0);assert.equal(s.worldSpeed,1);
 g.elapsed=17;place(s,z.x+Math.round(z.maxPulse*.5),z.y);stepArenaWorld(g,.05);
 assert.equal(g.world.phase,'active');assert.equal(z.pulse,Math.round(z.maxPulse*.5));assert.equal(s.worldSpeed,.55);assert.equal(mine(g,'frost'),1);
 stepArenaWorld(g,.05);assert.equal(mine(g,'frost'),1,'the frost message respects its cooldown');assert.equal(s.worldSpeed,.55,'but the slow-down lasts while touching the ring');
 place(s,z.x+10,z.y);stepArenaWorld(g,.05);assert.equal(s.worldSpeed,1,'inside the ring is safe');
 place(s,z.x+z.pulse,z.y);s.powers={shield:30};stepArenaWorld(g,.05);assert.equal(s.worldSpeed,1,'a shield protects against the ring');
 g.elapsed=21;s.powers={};place(s,z.x+Math.round(z.maxPulse*.5),z.y);stepArenaWorld(g,.05);
 assert.equal(g.world.phase,'calm');assert.equal(z.pulse,0);assert.equal(s.worldSpeed,1);
});

test('mirage: only the real oasis rewards, the fake one is flagged, and they swap every 12 seconds',()=>{
 const g=game('mirage'),s=g.snakes[0],[a,b]=g.world.zones;place(g.snakes[1],40,40);
 assert.equal(a.real,true);assert.equal(b.real,false);
 at(s,a);g.elapsed=1;const before=s.mass;stepArenaWorld(g,.05);assert.equal(s.mass,before+3);
 stepArenaWorld(g,.05);assert.equal(s.mass,before+3,'growth uses a simulation-time cooldown');
 at(s,b);g.elapsed=6;const m=s.mass;stepArenaWorld(g,.05);assert.equal(s.mass,m,'the mirage gives nothing');assert.equal(mine(g,'mirage'),1);
 g.elapsed=12.1;stepArenaWorld(g,.05);assert.equal(a.real,false);assert.equal(b.real,true);assert.ok(g.events.some(e=>e.type==='oasis'));
 at(s,b);g.elapsed=14.5;const n=s.mass;stepArenaWorld(g,.05);assert.equal(s.mass,n+3,'the oasis that became real now rewards');
});

test('both new maps run deterministically with bots and survive reconnect frames',()=>{
 for(const id of ['glacier','mirage']){
  const a=game(id),b=game(id);addSerpentBots(a,3);addSerpentBots(b,3);
  for(let i=0;i<1300;i++){stepSerpent(a,1/60);stepSerpent(b,1/60);}
  assert.deepEqual(serpentSnapshot(a),serpentSnapshot(b),id);
  const old={round:1,game:serpentSnapshot(a)};stepSerpent(a,.05);const next={round:1,game:serpentSnapshot(a)};
  assert.deepEqual(applySerpentFrame(old,compactSerpentFrame(next,old,true)).game.world,next.game.world);
 }
});

function legendary(world,humans){
 const g=createSerpentGame(humans.map(id=>({id,name:id})),{collisionMode:'arena-v23',worldId:world,trainingDifficulty:'legendary',seed:5,duration:120});
 addSerpentBots(g,2);return g;
}
const toward=(from,to)=>Math.atan2(to.y-from.y,to.x-from.x),gap=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
function pose(g,id,x,y){const s=g.snakes.find(q=>q.id===id);place(s,x,y);s.angle=s.targetAngle=0;return s;}

test('legendary bots split across humans instead of stacking on one target',()=>{
 const g=legendary('neon',['h1','h2']),bots=g.snakes.filter(s=>s.bot);
 const h1=pose(g,'h1',500,500),h2=pose(g,'h2',1520,500),b1=pose(g,bots[0].id,1000,300),b2=pose(g,bots[1].id,1000,700);
 stepSerpent(g,.02);
 const aims=[[b1,h1],[b1,h2],[b2,h1],[b2,h2]].map(([b,h])=>gap(b.targetAngle,toward(b,h))<.6);
 assert.ok((aims[0]&&aims[3])||(aims[1]&&aims[2]),'each bot hunts a different human');
});

test('legendary bots steer away from the expanding frost ring instead of crossing it',()=>{
 const g=legendary('glacier',['h']),z=g.world.zones[0],bot=g.snakes.find(s=>s.bot);
 g.snakes.filter(s=>s.bot&&s!==bot).forEach(s=>pose(g,s.id,60,60));
 g.elapsed=17;stepArenaWorld(g,.02);pose(g,'h',200,200);
 place(bot,z.x+z.pulse+20,z.y);bot.angle=bot.targetAngle=Math.PI;
 g.food=[{id:'f0',x:z.x,y:z.y,value:1,kind:'apple',radius:6}];
 stepSerpent(g,.02);
 assert.ok(Math.cos(bot.targetAngle)>0,'the bot turns away from the ring rather than through it to the food');
});

test('the server and the public rotation accept every map from one source of truth',async()=>{
 for(const id of ['glacier','mirage'])assert.equal(validWorld(id),true);assert.equal(validWorld('caves'),false);
 const index=await readFile(new URL('../src/index.js',import.meta.url),'utf8');
 assert.match(index,/if\(!validWorld\(worldId\)\)return json/);
 assert.doesNotMatch(index,/\['classic','neon','forest','crystals','volcano','ruins','storm'\]\.includes/);
 const storage=new Map(),ctx={storage:{get:async k=>storage.get(k),put:async(k,v)=>storage.set(k,v),setAlarm:async()=>{}},blockConcurrencyWhile:fn=>fn(),getWebSockets:()=>[]};
 const room=new SerpentRoom(ctx,{});await room.ready;
 assert.equal((await room.fetch(new Request('https://internal/init',{method:'POST',body:JSON.stringify({code:'123456',hostKey:'x'.repeat(64),playerLimit:2,worldId:'glacier'})}))).status,201);
 const host=room.addPlayer('H','host'),socket=p=>({deserializeAttachment:()=>({playerId:p.id}),send(){}});
 for(const worldId of ['mirage','glacier']){await room.webSocketMessage(socket(host),JSON.stringify({type:'configure',botCount:0,difficulty:'medium',worldId}));assert.equal(room.room.worldId,worldId);}
 const seen=new Set();for(let code=100000;code<100016;code++){const r=new SerpentRoom({...ctx,storage:{get:async()=>null,put:async()=>{},setAlarm:async()=>{}}},{});await r.ready;await r.fetch(new Request('https://internal/init',{method:'POST',body:JSON.stringify({code:String(code),hostKey:'x'.repeat(64),playerLimit:2,publicMatch:true})}));if(r.room)seen.add(r.room.worldId);}
 assert.ok(seen.has('glacier')&&seen.has('mirage'),'public matches rotate onto the new maps');
});

test('the arena menu lists both new maps',async()=>{
 const html=await readFile(new URL('../public/serpent.html',import.meta.url),'utf8');
 assert.ok(html.includes('value="glacier"')&&html.includes('value="mirage"'));
});
