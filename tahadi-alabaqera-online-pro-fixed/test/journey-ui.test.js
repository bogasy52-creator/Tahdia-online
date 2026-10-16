import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
import {createDOM} from './dom-harness.mjs';import * as engine from '../public/assets/js/engines/journey-engine.js';
async function moduleIn(h,name,imports={},expose=''){Object.assign(h.context,imports);const source=(await readFile(new URL('../public/assets/js/'+name,import.meta.url),'utf8')).replace(/import[\s\S]*?from\s*['"][^'"]+['"];?/g,'').replace(/^export\s+/gm,'');vm.runInContext('(function(){'+source+'\n'+expose+'\n})();',vm.createContext(h.context));await Promise.resolve();}
async function board(game='paths'){
 const h=await createDOM('journey.html',{history:{replaceState(){}}});h.context.location.search='?game='+game;let saved=engine.normalizeJourney(),completions=0;
 const progress={get:()=>saved,stats:()=>engine.journeyStats(saved),today:()=>engine.dayKey(),pendingCount:()=>0,ready:Promise.resolve(),complete:async proof=>{completions++;const result=engine.commitJourney(saved,proof);saved=result.journey;return result;}};
 await h.runFile('assets/js/journey-ui.js',{...engine,progress,drawBoard(){}});const canvas=h.doc.getElementById('stageCanvas');canvas.getBoundingClientRect=()=>({left:0,top:0,width:350,height:350});
 h.doc.getElementById('journeyContinue').onclick();return {...h,canvas,progress,completions:()=>completions};
}
function pointer(h,type,cell,size){h.canvas.dispatchEvent({type,pointerId:1,button:0,clientX:(cell%size+.5)*350/size,clientY:(Math.floor(cell/size)+.5)*350/size,preventDefault(){}});}
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
test('dragging all actual paths completes the stage once and opens the next stage',async()=>{
 const h=await board(),state=engine.createPaths();assert.equal(h.doc.getElementById('journeyPlay').open,true);
 for(const path of state.solution){pointer(h,'pointerdown',path[0],state.size);for(const cell of path.slice(1,-1))pointer(h,'pointermove',cell,state.size);pointer(h,'pointerup',path.at(-1),state.size);}
 await flush();assert.equal(h.completions(),1);assert.equal(h.doc.getElementById('resultStars').textContent,'★★★');assert.equal(h.progress.get().stages.paths[1],3);assert.equal(h.doc.querySelector('.stage-workspace').inert,true);
 h.doc.getElementById('resultNext').onclick();assert.ok(h.doc.getElementById('stageTitle').textContent.includes('2'));assert.equal(h.doc.querySelector('.stage-workspace').inert,false);
});
test('jewel dragging consumes one move and closing restores the exact round',async()=>{
 const h=await board('jewels'),initial=engine.createJewels(),path=engine.jewelPaths(initial)[0];pointer(h,'pointerdown',path[0],initial.size);for(const cell of path.slice(1))pointer(h,'pointermove',cell,initial.size);pointer(h,'pointerup',path.at(-1),initial.size);
 assert.equal(h.doc.getElementById('stageMoves').textContent,'19');h.doc.getElementById('stageClose').onclick();assert.equal(h.doc.getElementById('journeyPlay').open,false);h.doc.getElementById('journeyContinue').onclick();assert.equal(h.doc.getElementById('stageMoves').textContent,'19');assert.match(h.doc.getElementById('stageMessage').textContent,/آخر حركة/);assert.equal(h.completions(),0);
});
test('tap-to-connect can finish an endpoint without discarding the current path',async()=>{
 const h=await board(),state=engine.createPaths(),path=state.solution[0];for(const cell of path){pointer(h,'pointerdown',cell,state.size);pointer(h,'pointerup',cell,state.size);}assert.equal(h.doc.getElementById('stageMoves').textContent,'1 / 3');assert.equal(h.completions(),0);
});
test('guest completion persists stages and grants a reward once',async()=>{
 const h=await createDOM('journey.html');await moduleIn(h,'journey-client.js',engine,'window.JOURNEY={get,complete,refresh,ready,pendingCount};');const api=h.context.JOURNEY;await api.ready;
 let state=engine.createPaths();for(let i=0;i<state.pairs.length;i++)state=engine.movePaths(state,i,state.solution[i]).state;const proof={game:'paths',level:1,log:state.log};
 await Promise.all([api.complete(proof),api.complete(proof)]);assert.equal(api.get().stages.paths[1],3);assert.equal(h.records.length,1);assert.equal(api.pendingCount(),0);
});
test('a lost response retains the result and retry does not duplicate a server reward',async()=>{
 const h=await createDOM('journey.html');h.storage.set('bs_social_session','playera.'+'a'.repeat(43));h.context.BS_CAREER.account=()=> 'playera';let server=engine.normalizeJourney(),offline=true,lost=true,awards=0;
 h.context.fetch=async(_url,options)=>{if(offline)throw new TypeError('offline');const {proof}=JSON.parse(options.body);if(proof){const result=engine.commitJourney(server,proof);server=result.journey;if(result.first)awards++;if(lost){lost=false;throw new TypeError('response lost');}}return Response.json({journey:server});};
 await moduleIn(h,'journey-client.js',engine,'window.JOURNEY={get,complete,refresh,ready,pendingCount};');const api=h.context.JOURNEY;await api.ready;
 let state=engine.createPaths();for(let i=0;i<state.pairs.length;i++)state=engine.movePaths(state,i,state.solution[i]).state;await api.complete({game:'paths',level:1,log:state.log});await flush();assert.equal(api.pendingCount(),1);assert.equal(api.get().stages.paths[1],3);
 offline=false;await assert.rejects(api.refresh(),/response lost/);assert.equal(awards,1);assert.equal(api.pendingCount(),1);await api.refresh();assert.equal(awards,1);assert.equal(api.pendingCount(),0);assert.equal(api.get().stages.paths[1],3);
});
test('an old account response cannot overwrite the next account progress',async()=>{
 const h=await createDOM('journey.html');let name='playera',release;
 h.context.BS_CAREER.account=()=>name;h.storage.set('bs_social_session','playera.'+'a'.repeat(43));
 const old=engine.normalizeJourney({stages:{paths:{1:3}}});
 h.context.fetch=async(_url,options)=>{if(options.headers.authorization.includes('playera.'))return new Promise(resolve=>release=()=>resolve(Response.json({journey:old})));return Response.json({journey:engine.normalizeJourney()});};
 await moduleIn(h,'journey-client.js',engine,'window.JOURNEY={get,refresh,ready};');await flush();assert.ok(release);
 name='playerb';h.storage.set('bs_social_session','playerb.'+'b'.repeat(43));h.context.dispatchEvent(new h.context.CustomEvent('bs-social-session'));release();await h.context.JOURNEY.ready;await h.context.JOURNEY.refresh();assert.deepEqual(Object.keys(h.context.JOURNEY.get().stages.paths),[]);assert.equal(h.storage.has('tahdia-journey-v17:playera'),false);
});
