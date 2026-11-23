import {runPoolJob} from './simulation-jobs-v33-11-6.js';
export function createPoolSimulationClient({WorkerClass=globalThis.Worker,timeout=12000}={}){
 let worker=null,disabled=false,serial=0,epoch=0;const pending=new Map(),cache=new Map(),metrics={worker:0,fallback:0,cancelled:0};
 const aborted=()=>new DOMException('Cancelled','AbortError');
 const key=shot=>JSON.stringify([shot?.seq,shot?.before,shot?.dir,shot?.speed,shot?.spin]);
 function remember(shot,sim){cache.set(key(shot),sim);while(cache.size>2)cache.delete(cache.keys().next().value);return sim;}
 function clearWorker(error){worker?.terminate();worker=null;for(const task of [...pending.values()])task.reject(error);pending.clear();}
 function getWorker(){if(disabled||!WorkerClass)return null;if(worker)return worker;try{worker=new WorkerClass(new URL('./simulation-worker-v33-11-6.js',import.meta.url),{type:'module'});worker.onmessage=({data})=>{const task=pending.get(data.id);if(!task)return;data.error?task.reject(Error(data.error)):task.resolve(data.result);};worker.onerror=()=>{disabled=true;clearWorker(Error('pool_worker_failed'));};return worker;}catch{disabled=true;return null;}}
 async function run(type,args,{signal}={}){
  const generation=epoch;if(signal?.aborted)throw aborted();const w=getWorker();let result;
  if(w)try{result=await new Promise((resolve,reject)=>{
   const id=++serial,done=(fn,value)=>{clearTimeout(timer);signal?.removeEventListener('abort',cancel);pending.delete(id);fn(value);},cancel=()=>done(reject,aborted());
   const timer=setTimeout(()=>done(reject,Error('pool_worker_timeout')),timeout);
   pending.set(id,{resolve:r=>done(resolve,r),reject:e=>done(reject,e)});signal?.addEventListener('abort',cancel,{once:true});
   try{w.postMessage({id,type,args});}catch(e){done(reject,e);}
  });metrics.worker++;}catch(e){if(e.name==='AbortError'||epoch!==generation||signal?.aborted)throw aborted();disabled=true;clearWorker(e);}
  if(result===undefined){await new Promise(resolve=>setTimeout(resolve,0));if(epoch!==generation||signal?.aborted)throw aborted();metrics.fallback++;result=runPoolJob(type,args);}
  if(epoch!==generation||signal?.aborted)throw aborted();return result;
 }
 return {metrics,run,async play(state,seat,input,opts){const r=await run('play',[state,seat,input],opts);remember(r.state.shot,r.sim);return r.state;},async simulate(shot,opts){return cache.get(key(shot))||remember(shot,await run('simulate',[shot],opts));},choose:(state,level,opts)=>run('choose',[state,level],opts),cached:shot=>cache.get(key(shot)),clear(){epoch++;metrics.cancelled+=pending.size;clearWorker(aborted());cache.clear();},dispose(){this.clear();disabled=true;}};
}
