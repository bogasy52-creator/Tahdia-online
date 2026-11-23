import {playPoolShot,simulate,choosePoolShot} from '../engines/pool-engine.js?v=33.9.12-quality1';
export function runPoolJob(type,args){
 if(type==='play'){const state=playPoolShot(...args);return {state,sim:simulate(state.shot.before,state.shot,{record:true})};}
 if(type==='simulate')return simulate(args[0].before,args[0],{record:true});
 if(type==='choose')return choosePoolShot(...args);
 throw Error('unknown_pool_job');
}
