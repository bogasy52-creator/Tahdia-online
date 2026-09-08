import test from 'node:test';
import assert from 'node:assert/strict';
import {createMotionScheduler,easeInOutCubic,easeOutCubic} from '../public/assets/js/snakes-motion-engine.js';

test('motion scheduler uses bounded easing and completes a timeline', async()=>{
  assert.equal(easeOutCubic(0),0);
  assert.equal(easeOutCubic(1),1);
  assert.equal(easeInOutCubic(0),0);
  assert.equal(easeInOutCubic(1),1);
  const scheduler=createMotionScheduler({reducedMotion:true});
  let frames=0,last=0;
  await scheduler.animate({duration:240,onFrame:(progress)=>{frames++;last=progress;}});
  assert.ok(frames>0);
  assert.equal(last,1);
  assert.equal(scheduler.activeCount(),0);
});

test('cancelling motion clears every pending job without leaving an active loop', async()=>{
  const scheduler=createMotionScheduler();
  const pending=scheduler.delay(5000).then(()=>false).catch((error)=>error.code==='motion_cancelled');
  scheduler.cancelAll();
  assert.equal(await pending,true);
  assert.equal(scheduler.activeCount(),0);
});
