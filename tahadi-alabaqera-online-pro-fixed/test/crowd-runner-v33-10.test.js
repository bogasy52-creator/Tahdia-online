import test from 'node:test';
import assert from 'node:assert/strict';
import { createDOM, MiniElement } from './dom-harness.mjs';
import * as engine from '../public/assets/js/engines/crowd-engine.js';
import { createCrowdPainter } from '../public/assets/js/crowd/render.js';
const {CROWD,applyCrowdGate,makeCrowdCourse,createCrowdRun,stepCrowdRun,crowdTarget,crowdDaySeed,normalizeCrowdProgress,recordCrowdRun}=engine;
test('crowd gates use whole soldiers, safe division and a bounded army',()=>{
  assert.equal(applyCrowdGate(10,{op:'+',value:777}),787);
  assert.equal(applyCrowdGate(9,{op:'×',value:3}),27);
  assert.equal(applyCrowdGate(9,{op:'÷',value:2}),4);
  assert.equal(applyCrowdGate(9,{op:'÷',value:0}),9);
  assert.equal(applyCrowdGate(9,{op:'−',value:50}),0);
  assert.equal(applyCrowdGate(9990,{op:'+',value:777}),CROWD.MAX_ARMY);
  assert.equal(applyCrowdGate(NaN,{op:'×',value:Infinity}),0);
});
test('crowd courses repeat from a seed, vary with it, and keep the +777 lane',()=>{
  assert.deepEqual(makeCrowdCourse(5,124),makeCrowdCourse(5,124));
  assert.notDeepEqual(makeCrowdCourse(5,124),makeCrowdCourse(5,125));
  for(let level=1;level<=CROWD.LEVELS;level++){const c=makeCrowdCourse(level);assert.equal(c.rows.length,12);assert.equal(c.rows[5].cells[2].label,'+777');assert.ok(c.boss.z>c.rows.at(-1).z);assert.ok(c.rows.every(r=>r.cells.length===3));}
  assert.equal(crowdDaySeed('2026-11-14'),crowdDaySeed('2026-11-14'));
  assert.notEqual(crowdDaySeed('2026-11-14'),crowdDaySeed('2026-11-15'));
});
test('a gate affects only the selected lane and only once at the visible crossing',()=>{
  const r=createCrowdRun();r.x=-1;r.steer=-1;const row=r.rows[0];row.cells=[{type:'gate',op:'+',value:100,label:'+100'},{type:'gate',op:'+',value:500,label:'+500'},{type:'gate',op:'+',value:777,label:'+777'}];r.distance=row.z-CROWD.CROSSING_Z-1;const before=r.army;stepCrowdRun(r,.05,-1);assert.equal(r.army,before);stepCrowdRun(r,.05,-1);assert.equal(r.army,before+100);assert.equal(row.passed,true);for(let i=0;i<20;i++)stepCrowdRun(r,.05,-1);assert.equal(r.army,before+100);assert.equal(r.gates,1);
});
test('invalid timing cannot teleport the army or create invalid steering',()=>{
  const r=createCrowdRun();stepCrowdRun(r,NaN,Infinity);assert.equal(r.distance,0);stepCrowdRun(r,-3,1);assert.equal(r.distance,0);stepCrowdRun(r,100,1);assert.ok(r.distance<=r.speed*.05);assert.ok(r.x>0&&r.x<1);stepCrowdRun(r,.016,'bad');assert.ok(Number.isFinite(r.x));r.status='lost';const before=JSON.stringify(r);stepCrowdRun(r,1);assert.equal(JSON.stringify(r),before);
});
test('auto fire targets an enemy in the current lane and counts its defeat once',()=>{
  const r=createCrowdRun();const row=r.rows[0];r.distance=row.z-30;r.x=-1;r.steer=-1;row.cells=[{type:'enemy',hp:4,maxHp:4,defeated:false},{type:'gate',op:'+',value:1},{type:'enemy',hp:100,maxHp:100,defeated:false}];assert.equal(crowdTarget(r).lane,0);for(let i=0;i<4;i++)stepCrowdRun(r,.05,-1);assert.equal(row.cells[0].defeated,true);assert.equal(row.cells[2].hp,100);assert.equal(r.kills,1);for(let i=0;i<5;i++)stepCrowdRun(r,.05,-1);assert.equal(r.kills,1);
});
test('an unbeaten barrier loses soldiers and ends a run without passing later gates',()=>{
  const r=createCrowdRun();const row=r.rows[2];r.rows.slice(0,2).forEach(x=>x.passed=true);r.distance=row.z-CROWD.CROSSING_Z;r.x=0;r.steer=0;r.army=10;row.cells[1]={type:'enemy',hp:1000,maxHp:1000,defeated:false};stepCrowdRun(r,.01);assert.equal(r.status,'lost');assert.equal(r.army,0);assert.equal(r.rows[3].passed,false);
});
function playVisibleGates(r){
  for(let tick=0;tick<6000&&r.status==='running';tick++){
    const row=r.rows.find(row=>!row.passed);let lane=1;
    if(row){let most=-1;row.cells.forEach((cell,index)=>{const count=cell.type==='gate'?applyCrowdGate(r.army,cell):r.army-Math.ceil(cell.hp*.36);if(count>most){most=count;lane=index;}});}
    stepCrowdRun(r,.025,lane-1);
  }return r;
}
test('all 30 actual stages can be won using only visible gate choices within the clock',()=>{
  for(let level=1;level<=30;level++){const r=playVisibleGates(createCrowdRun(level));assert.equal(r.status,'won','level '+level);assert.ok(r.army>0);assert.ok(r.elapsed<CROWD.LIMIT);assert.ok(r.stars>=1&&r.stars<=3);assert.ok(r.rows.every(row=>row.passed));}
});
test('progress is normalized, repeated results retain best scores, daily stays separate',()=>{
  const base=normalizeCrowdProgress({unlocked:Infinity,best:{1:{score:-8,stars:99},45:{score:9}}});assert.equal(base.unlocked,1);assert.deepEqual(base.best[1],{score:0,stars:3});assert.equal(base.best[45],undefined);const r=playVisibleGates(createCrowdRun(1)),p=recordCrowdRun(null,r);assert.equal(p.unlocked,2);assert.equal(p.best[1].score,r.score);const smaller={...r,score:1,stars:1};assert.equal(recordCrowdRun(p,smaller).best[1].score,r.score);const daily=recordCrowdRun(null,{...r,daily:true},'2026-11-14');assert.equal(daily.unlocked,1);assert.deepEqual(daily.best,{});assert.equal(daily.daily.score,r.score);assert.equal(recordCrowdRun(null,{...r,level:30}).unlocked,1);
});
async function setup({blocked=false}={}){
  const frames=new Map();let id=0,broken=false;
  const drawing=new Proxy({createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})}, {get:(obj,k)=>obj[k]??(()=>{if(broken)throw Error('test canvas failure');}),set:(o,k,v)=>(o[k]=v,true)});MiniElement.prototype.getContext=()=>drawing;
  const h=await createDOM('crowd.html',{...engine,createCrowdPainter,innerWidth:390,innerHeight:844,devicePixelRatio:3,requestAnimationFrame:fn=>(frames.set(++id,fn),id),cancelAnimationFrame:id=>frames.delete(id)});
  if(blocked)h.context.localStorage={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
  let account=null;h.context.BS_SOCIAL={profile:()=>account};
  await h.runFile('assets/js/crowd/main.js');const api=h.context.BS_CROWD;
  const frame=time=>{const pending=[...frames.values()];frames.clear();for(const fn of pending)fn(time);};
  return {...h,api,frames,frame,breakCanvas:value=>{broken=value;},account:username=>{account=username?{username}:null;h.context.dispatchEvent({type:'bs-social-session'});}};
}
test('real crowd controls start, steer by touch and keys, pause and resume without a time jump',async()=>{
  const h=await setup(),cv=h.doc.getElementById('crCanvas');h.doc.getElementById('crStart').click();assert.equal(h.api.state.level,1);h.frame(100);h.frame(120);h.doc.getElementById('crRight').click();h.frame(150);assert.ok(h.api.state.steer>0);cv.dispatchEvent({type:'pointerdown',pointerId:1,clientX:100,isPrimary:true,button:0,preventDefault(){}});cv.dispatchEvent({type:'pointermove',pointerId:1,clientX:20,preventDefault(){}});assert.ok(h.api.state.steer<1);cv.dispatchEvent({type:'pointerup',pointerId:1});h.context.dispatchEvent({type:'keydown',key:'ArrowLeft',preventDefault(){}});h.frame(175);h.context.dispatchEvent({type:'keyup',key:'ArrowLeft'});h.doc.getElementById('crPause').click();const t=h.api.state.elapsed;h.frame(8000);assert.equal(h.api.state.elapsed,t);assert.equal(h.api.paused,true);h.doc.getElementById('crResume').click();h.frame(9000);assert.equal(h.api.state.elapsed,t);h.frame(9025);assert.ok(h.api.state.elapsed>t);h.doc.hidden=true;h.doc.dispatchEvent({type:'visibilitychange'});assert.equal(h.api.paused,true);h.doc.getElementById('crBack').click();assert.equal(h.api.state,null);assert.equal(h.frames.size,0);
});
test('blocked storage remains playable and account changes cannot inherit guest progress',async()=>{
  const h=await setup({blocked:true});h.api.start(1);h.frame(100);h.api.state.boss.defeated=true;h.frame(125);assert.equal(h.api.progress.unlocked,2);h.api.menu();h.account('Ali');assert.equal(h.api.progress.unlocked,1);assert.equal(h.api.start(2),false);h.api.start(1);h.account('Omar');assert.equal(h.api.state,null);assert.equal(h.api.progress.unlocked,1);h.account(null);assert.equal(h.api.progress.unlocked,2);
});
test('a Canvas frame failure offers restart and restart can recover the real controller',async()=>{
  const h=await setup();h.api.start(1);h.frame(100);h.breakCanvas(true);h.frame(125);assert.equal(h.api.paused,true);assert.equal(h.frames.size,0);assert.equal(h.doc.getElementById('crResume').hidden,true);assert.match(h.doc.getElementById('crPauseTitle').textContent,/تعذّر/);h.breakCanvas(false);h.doc.getElementById('crRestart').click();h.frame(200);h.frame(225);assert.equal(h.api.paused,false);assert.equal(h.api.state.status,'running');assert.equal(h.doc.getElementById('crResume').hidden,false);
});
