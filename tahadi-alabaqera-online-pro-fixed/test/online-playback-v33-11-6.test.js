import test from 'node:test';import assert from 'node:assert/strict';import {createStepPlayer} from '../public/assets/js/board-online.js';
const tick=()=>new Promise(r=>setTimeout(r,5));
test('resync cancels an active animation, discards queued history and applies the snapshot without animation',async()=>{
 const seen=[];let aborted=false;const player=createStepPlayer(async(r,{signal,animate})=>{seen.push([r.version,animate]);if(r.version===1)await new Promise(resolve=>signal.addEventListener('abort',()=>{aborted=true;resolve();}));});
 player.push({version:1});player.push({version:2});player.push({version:3});player.push({version:4,resync:true,steps:[{version:2}]});await tick();assert.equal(aborted,true);assert.deepEqual(seen,[[1,true],[4,false]]);assert.equal(player.busy,false);
});
test('same-version presence changes coalesce while an animation is active',async()=>{
 const seen=[];let release;const p=createStepPlayer(async r=>{seen.push(r);if(r.version===1)await new Promise(ok=>release=ok);});p.push({version:1});for(let i=0;i<30;i++)p.push({version:2,presence:i});release();await tick();assert.equal(seen.length,2);assert.equal(seen[1].presence,29);
});
test('a slow client catches up to the newest state when its queue exceeds the limit',async()=>{
 const seen=[];let release;const p=createStepPlayer(async(r,opts)=>{seen.push([r.version,opts.animate]);if(r.version===1)await new Promise(ok=>release=ok);},{maxBacklog:3});p.push({version:1});for(let i=2;i<10;i++)p.push({version:i});release();await tick();assert.deepEqual(seen,[[1,true],[9,false]]);
});
