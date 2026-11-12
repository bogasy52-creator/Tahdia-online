import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createDOM} from './dom-harness.mjs';
import * as engine from '../public/assets/js/carrom/engine.js';

async function setup() {
 const h=await createDOM('race.html',{
  ...engine, requestAnimationFrame:()=>1,cancelAnimationFrame(){},
  createCarromRenderer:()=>({draw(){},setTheme(){},resize(){},point:(x,y)=>({x,y})}),
  createTable:()=>({send:()=>true,leave(){},again(){}}),
 });
 h.context.location.search='?debug=1';
 const source=(await readFile(new URL('../public/assets/js/carrom/main.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/gm,'');
 vm.runInContext(source,h.context);
 return {...h,api:h.context.BS_CARROM};
}

test('precision controls place one legal shot and prevent a duplicate strike',async()=>{
 const h=await setup();h.api.startLocal('hotseat');
 const angle=h.doc.getElementById('cmAngle'),power=h.doc.getElementById('cmPower');
 angle.value='25';angle.dispatchEvent({type:'input'});
 power.value='68';power.dispatchEvent({type:'input'});
 assert.equal(h.doc.getElementById('cmAngleValue').textContent,'25°');
 assert.equal(h.doc.getElementById('cmPowerValue').textContent,'68%');
 h.doc.getElementById('cmFire').click();
 assert.equal(h.api.state.phase,'moving');
 const accepted=structuredClone(h.api.state);
 h.doc.getElementById('cmFire').click();
 assert.deepEqual(h.api.state,accepted);
 assert.equal(h.api.canPlay(),false);
});

test('pause disables firing and resuming requires a deliberately prepared shot',async()=>{
 const h=await setup();h.api.startLocal('hotseat');
 h.doc.getElementById('carromPauseButton').click();
 assert.equal(h.api.ctl.paused,true);assert.equal(h.api.canPlay(),false);
 h.api.fire(-Math.PI/2,.7);assert.equal(h.api.state.phase,'aim');
 h.doc.getElementById('carromResume').click();
 assert.equal(h.api.canPlay(),true);assert.equal(h.doc.getElementById('cmFire').disabled,true);
 h.doc.getElementById('cmFire').click();assert.equal(h.api.state.phase,'aim');
});

test('exit settles the unfinished shot and a new table keeps its own turn',async()=>{
 const h=await setup();h.api.startLocal('hotseat');h.api.fire(-Math.PI/2,.6);
 h.doc.getElementById('carromExit').click();h.doc.getElementById('carromExit').click();
 assert.equal(h.api.ctl.animDone,null);
 h.api.startLocal('hotseat');
 await Promise.resolve();await Promise.resolve();
 assert.equal(h.api.state.phase,'aim');assert.equal(h.api.ctl.anim,null);assert.equal(h.api.canPlay(),true);
});
