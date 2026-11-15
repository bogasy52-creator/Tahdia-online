import test from 'node:test';import assert from 'node:assert/strict';
import * as pool from '../public/assets/js/engines/pool-engine.js';
import {createDOM,MiniElement} from './dom-harness.mjs';
async function setupPool(){
  let id=0,table;const frames=new Map(),drawing=new Proxy({createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}}),createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),createPattern:()=>'',measureText:t=>({width:String(t).length*8})},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
  MiniElement.prototype.getContext=()=>drawing;
  const h=await createDOM('billiards.html',{...pool,innerWidth:390,innerHeight:844,devicePixelRatio:1,matchMedia:()=>({matches:true}),ResizeObserver:class{observe(){}},requestAnimationFrame:fn=>(frames.set(++id,fn),id),cancelAnimationFrame:id=>frames.delete(id),createTable:options=>(table={options,busy:false,sent:[],send(type,payload){this.sent.push({type,...payload});return true;},leave(){},again(){}})});
  await h.runFile('assets/js/billiards/main.js');return{...h,api:h.context.BS_BILLIARDS,table,frame:now=>{const jobs=[...frames.values()];frames.clear();for(const fn of jobs)fn(now);}};
}
async function completedShot(h){h.api.startLocal('two');h.api.ctl.aim.dir=[1,0];await h.api.shoot(.55);assert.ok(h.api.ctl.state.shot);assert.equal(h.api.ctl.busy,false);return JSON.stringify(h.api.ctl.state);}
test('shot replay owns a separate table and cannot change the live result or send network commands',async()=>{
  const h=await setupPool(),before=await completedShot(h);assert.equal(h.api.openReplay(),true);assert.notEqual(h.api.replay.view,h.api.view);await h.api.shoot(.9);
  for(let t=100;t<30000;t+=33)h.frame(t);
  assert.equal(JSON.stringify(h.api.ctl.state),before);assert.equal(h.api.replay.paused,true);assert.deepEqual(JSON.parse(JSON.stringify(h.api.replay.view.balls)),JSON.parse(before).balls);assert.deepEqual(h.table.sent,[]);h.api.closeReplay();assert.equal(h.api.replay.frame,0);assert.equal(h.doc.getElementById('biReplaySheet').hidden,true);
});
test('replay seeks and changes speed, then cancels its frame when the page is hidden',async()=>{
  const h=await setupPool(),before=await completedShot(h);h.api.openReplay();h.doc.getElementById('biReplaySpeed').click();assert.equal(h.api.replay.speed,1);h.doc.getElementById('biReplaySpeed').click();assert.equal(h.api.replay.speed,.25);const seek=h.doc.getElementById('biReplaySeek');seek.value='500';seek.dispatchEvent({type:'input'});assert.ok(h.api.replay.elapsed>0);assert.equal(JSON.stringify(h.api.ctl.state),before);h.doc.hidden=true;h.doc.dispatchEvent({type:'visibilitychange'});assert.equal(h.api.replay.active,false);assert.equal(h.api.replay.frame,0);
});
test('an authoritative online match change closes a previous replay before applying the state',async()=>{
  const h=await setupPool();await completedShot(h);const state=structuredClone(h.api.ctl.state),room={startedAt:100,status:'playing',state,me:{index:0},players:[{index:0,name:'A'},{index:1,name:'B'}]};await h.table.options.apply(room,{animate:false});assert.equal(h.api.openReplay(),true);await h.table.options.apply({...room,startedAt:200},{animate:false});assert.equal(h.api.replay.active,false);assert.equal(h.api.ctl.state,state);assert.equal(h.api.ctl.mode,'online');assert.deepEqual(h.table.sent,[]);
});
