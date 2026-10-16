import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
import {createDOM} from './dom-harness.mjs';import * as engine from '../public/assets/js/engines/journey-engine.js';
import * as match3 from '../public/assets/js/engines/match3-engine.js';import {BoardRenderer} from '../public/assets/js/match3-renderer.js';
async function moduleIn(h,name,imports={},expose=''){Object.assign(h.context,imports);const source=(await readFile(new URL('../public/assets/js/'+name,import.meta.url),'utf8')).replace(/import[\s\S]*?from\s*['"][^'"]+['"];?/g,'').replace(/^export\s+/gm,'');vm.runInContext('(function(){'+source+'\n'+expose+'\n})();',vm.createContext(h.context));await Promise.resolve();}
async function board(game='paths',Renderer=BoardRenderer){
 const h=await createDOM('journey.html',{history:{replaceState(){}}});h.context.location.search='?game='+game;let saved=engine.normalizeJourney(),completions=0;
 const progress={get:()=>saved,stats:()=>engine.journeyStats(saved),today:()=>engine.dayKey(),pendingCount:()=>0,ready:Promise.resolve(),complete:async proof=>{completions++;const result=engine.commitJourney(saved,proof);saved=result.journey;return result;}};
 await h.runFile('assets/js/journey-ui.js',{...engine,...match3,progress,BoardRenderer:Renderer});const canvas=h.doc.getElementById('stageCanvas');canvas.getBoundingClientRect=()=>({left:0,top:0,width:350,height:350});
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
test('a real adjacent swap consumes one move and closing restores the exact V18 round',async()=>{
 const h=await board('jewels'),initial=match3.createMatch3(),swap=match3.legalSwaps(initial)[0],next=match3.moveMatch3(initial,{swap}).state;
 pointer(h,'pointerdown',swap[0],7);pointer(h,'pointermove',swap[1],7);pointer(h,'pointerup',swap[1],7);await flush();
 const moves=String(next.limit-next.moves);assert.equal(h.doc.getElementById('stageMoves').textContent,moves);h.doc.getElementById('stageClose').onclick();assert.equal(h.doc.getElementById('journeyPlay').open,false);h.doc.getElementById('journeyContinue').onclick();assert.equal(h.doc.getElementById('stageMoves').textContent,moves);assert.equal(h.doc.getElementById('stageScore').textContent,String(next.score));assert.match(h.doc.getElementById('stageMessage').textContent,/آخر حركة/);assert.equal(h.completions(),0);
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
test('tap swaps reject nonmatches for free, accept legal pairs, and never interpret a jewel chain',async()=>{
 const h=await board('jewels'),s=match3.createMatch3(),moves=match3.legalSwaps(s),valid=new Set(moves.map(p=>p.join(':'))),miss=Array.from({length:48},(_,a)=>[a,a+1]).find(p=>p[0]%7!==6&&!valid.has(p.join(':')));
 for(const cell of miss){pointer(h,'pointerdown',cell,7);pointer(h,'pointerup',cell,7);}await flush();assert.equal(h.doc.getElementById('stageMoves').textContent,'20');assert.match(h.doc.getElementById('stageMessage').textContent,/بدون خصم/);
 const swap=moves[0];for(const cell of swap){pointer(h,'pointerdown',cell,7);pointer(h,'pointerup',cell,7);}await flush();const expected=match3.moveMatch3(s,{swap}).state;assert.equal(h.doc.getElementById('stageScore').textContent,String(expected.score));
});
test('a straight fast path swipe fills missed samples and cancel does not commit it',async()=>{
 const h=await board(),s=engine.createPaths(),original=s.solution.find(row=>row.some((_,i)=>i+2<row.length&&row[i+2]-row[i+1]===row[i+1]-row[i])),path=original?.slice();assert.ok(path);const skip=path.findIndex((_,i)=>i+2<path.length&&path[i+2]-path[i+1]===path[i+1]-path[i]);
 pointer(h,'pointerdown',path[0],s.size);for(const cell of path.slice(1,skip+1))pointer(h,'pointermove',cell,s.size);pointer(h,'pointermove',path[skip+2],s.size);pointer(h,'pointercancel',path[skip+2],s.size);assert.equal(h.doc.getElementById('stageMoves').textContent,'0 / 3');assert.equal(h.completions(),0);
 pointer(h,'pointerdown',path[0],s.size);for(const cell of path.slice(1,skip+1))pointer(h,'pointermove',cell,s.size);pointer(h,'pointermove',path[skip+2],s.size);for(const cell of path.slice(skip+3,-1))pointer(h,'pointermove',cell,s.size);pointer(h,'pointerup',path.at(-1),s.size);assert.equal(h.doc.getElementById('stageMoves').textContent,'1 / 3');
});
test('help prevents interaction with the board and returns keyboard focus when dismissed',async()=>{const h=await board('jewels');h.doc.getElementById('stageHelp').onclick();assert.equal(h.doc.querySelector('.stage-workspace').inert,true);assert.equal(h.doc.querySelector('.stage-topbar').inert,true);assert.equal(h.doc.activeElement.id,'stageHelpClose');h.doc.getElementById('stageHelpClose').onclick();assert.equal(h.doc.querySelector('.stage-workspace').inert,false);assert.equal(h.doc.activeElement.id,'stageCanvas');});
test('career refreshes do not rebuild the campaign map while a round is open',async()=>{const h=await board(),map=h.doc.getElementById('journeyMap'),first=map.firstChild;for(let i=0;i<40;i++)h.context.dispatchEvent(new h.context.CustomEvent('bs-career-change'));assert.equal(map.firstChild,first);h.doc.getElementById('stageClose').onclick();assert.notEqual(map.firstChild,first);});
test('closing during gravity cancels the old round and resumes the final deterministic board',async()=>{
 let pending;class DeferredRenderer{constructor(){this.frames=0;}setState(){}cancel(){pending?.(false);pending=null;}snap(){this.cancel();}animate(){return new Promise(resolve=>pending=resolve);}}
 const h=await board('jewels',DeferredRenderer),s=match3.createMatch3(),swap=match3.legalSwaps(s)[0],expected=match3.moveMatch3(s,{swap}).state;
 pointer(h,'pointerdown',swap[0],7);pointer(h,'pointermove',swap[1],7);pointer(h,'pointerup',swap[1],7);assert.equal(h.canvas.getAttribute('aria-busy'),'true');h.doc.getElementById('stageClose').onclick();await flush();assert.equal(h.doc.getElementById('journeyPlay').open,false);h.doc.getElementById('journeyContinue').onclick();assert.equal(h.doc.getElementById('stageScore').textContent,String(expected.score));assert.equal(h.canvas.getAttribute('aria-busy'),'false');assert.equal(h.completions(),0);
});
