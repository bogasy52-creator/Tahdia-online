import test from 'node:test';import assert from 'node:assert/strict';
import {createPoolSimulationClient} from '../public/assets/js/billiards/simulation-client-v33-11-6.js';import {runPoolJob} from '../public/assets/js/billiards/simulation-jobs-v33-11-6.js';import {createPoolGame,playPoolShot} from '../public/assets/js/engines/pool-engine.js';
class WorkerMock{constructor(){this.dead=false;}postMessage(job){setTimeout(()=>{if(!this.dead)this.onmessage({data:{id:job.id,result:runPoolJob(job.type,job.args)}});},5);}terminate(){this.dead=true;}}
test('off-thread shots preserve authoritative results and reuse their recorded simulation',async()=>{
 const jobs=createPoolSimulationClient({WorkerClass:WorkerMock}),s=createPoolGame(['a','b'],{first:0}),input={dir:[1,0],power:.6};const result=await jobs.play(s,0,input);assert.deepEqual(result,playPoolShot(s,0,input));const before=jobs.metrics.worker;assert.ok((await jobs.simulate(result.shot)).frames.length);assert.equal(jobs.metrics.worker,before);jobs.dispose();
});
test('leaving cancels in-flight jobs, and a new match starts with a fresh worker',async()=>{
 const jobs=createPoolSimulationClient({WorkerClass:WorkerMock}),s=createPoolGame(['a','b'],{first:0}),pending=jobs.play(s,0,{dir:[1,0],power:.5});jobs.clear();await assert.rejects(pending,{name:'AbortError'});const next=await jobs.play(s,0,{dir:[1,0],power:.3});assert.equal(next.shots,1);jobs.dispose();
});
test('unsupported workers yield once and use identical local physics',async()=>{
 const jobs=createPoolSimulationClient({WorkerClass:null}),s=createPoolGame(['a','b'],{first:0}),input={dir:[1,0],power:.4};assert.deepEqual(await jobs.play(s,0,input),playPoolShot(s,0,input));assert.equal(jobs.metrics.fallback,1);jobs.dispose();
});
