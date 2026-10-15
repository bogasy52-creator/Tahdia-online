import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createDOM} from './dom-harness.mjs';
import * as engine from '../public/assets/js/engines/arcade-engine.js';
async function ui(game,level='standard'){
 const intervals=new Map();let id=0;const h=await createDOM(game+'.html',{setInterval:fn=>{intervals.set(++id,fn);return id;},clearInterval:key=>intervals.delete(key)});h.storage.set('tahdia-arcade-level-v16:'+game,level);await h.runFile('assets/js/arcade-games.js',engine);vm.runInContext('globalThis.probe=()=>({active,paused,round,rules,time:moment()});',h.context);return {...h,intervals,$:id=>h.doc.getElementById(id)};
}
function fire(h){const pair=[...h.timers.entries()].at(-1);assert.ok(pair);h.timers.delete(pair[0]);pair[1].fn();return pair[1];}
test('memory, reaction and logic difficulty change the actual playable round',async()=>{
 for(const [level,pairs,trials,questions]of [['casual',6,3,6],['standard',8,5,10],['expert',12,7,15]]){
  const memory=await ui('memory',level);memory.$('start').onclick();assert.equal(memory.$('arena').children.length,pairs*2);assert.equal(memory.context.probe().rules.pairs,pairs);
  const reaction=await ui('reaction',level);reaction.$('start').onclick();assert.match(reaction.$('time').textContent,new RegExp('^'+trials));
  const logic=await ui('logic',level);logic.$('start').onclick();assert.match(logic.$('roundLabel').textContent,new RegExp('/ '+questions+'$'));
 }
});
test('pausing freezes the real game deadline and blocks actions until resume',async()=>{
 const h=await ui('accuracy');h.$('start').onclick();h.setTime(3000);for(const tick of h.intervals.values())tick();assert.equal(h.$('time').textContent,'27 ث');h.$('arcadePause').focus();h.$('arcadePause').onclick();h.setTime(100000);h.$('target').onclick();for(const tick of h.intervals.values())tick();assert.equal(h.$('time').textContent,'27 ث');assert.equal(h.context.probe().round.score,0);assert.equal(h.doc.querySelector('main').inert,true);h.$('arcadeContinue').onclick();h.setTime(103000);for(const tick of h.intervals.values())tick();assert.equal(h.$('time').textContent,'24 ث');assert.equal(h.doc.activeElement.id,'arcadePause');
});
test('reaction delay resumes its remaining time and cancelled callbacks cannot change it',async()=>{
 const h=await ui('reaction');h.$('start').onclick();const old=[...h.timers.values()][0],original=old.ms;h.setTime(1000);h.$('arcadePause').onclick();h.setTime(11000);old.fn();assert.equal(h.context.probe().round.phase,'waiting');h.$('arcadeContinue').onclick();assert.equal([...h.timers.values()].at(-1).ms,original-1000);h.setTime(11000+original-1000);fire(h);assert.equal(h.context.probe().round.phase,'ready');
});
test('an old reaction callback cannot activate a replacement round',async()=>{
 const h=await ui('reaction');h.$('start').onclick();const old=[...h.timers.values()][0];h.$('start').onclick();old.fn();assert.equal(h.context.probe().round.phase,'waiting');assert.equal(h.context.probe().round.times.length,0);
});
test('backgrounding pauses a game and keyboard focus stays in the pause dialog',async()=>{
 const h=await ui('puzzle');h.$('start').onclick();h.doc.hidden=true;h.doc.dispatchEvent({type:'visibilitychange'});assert.equal(h.context.probe().paused,true);assert.equal(h.doc.activeElement.id,'arcadeContinue');let prevented=false;h.doc.dispatchEvent({type:'keydown',key:'Tab',preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(h.doc.activeElement.id,'arcadeContinue');h.doc.dispatchEvent({type:'keydown',key:'Escape',preventDefault(){}});assert.equal(h.context.probe().paused,false);
});
test('each puzzle difficulty generates nontrivial legal and solvable boards',()=>{
 for(const level of ['casual','standard','expert'])for(let seed=1;seed<=50;seed++){let state=seed;const rng=()=>((state=(state*1664525+1013904223)>>>0)/4294967296);const board=engine.generatePuzzle(rng,engine.arcadeRules('puzzle',level).shuffle);assert.equal(engine.puzzleSolvable(board),true);assert.equal(engine.puzzleSolved(board),false);assert.deepEqual([...board].sort(),[0,1,2,3,4,5,6,7,8]);}
});
test('accuracy target stays fully reachable after a narrow-screen resize',async()=>{
 const h=await ui('accuracy','expert');h.$('arena').getBoundingClientRect=()=>({width:290,height:220});h.$('start').onclick();for(let i=0;i<30;i++){h.context.dispatchEvent({type:'resize'});const x=parseFloat(h.$('target').style.left),y=parseFloat(h.$('target').style.top);assert.ok(x>=33&&x<=257);assert.ok(y>=33&&y<=187);}assert.equal(h.$('target').style.width,'46px');
});
test('reaction saves a single level record and an old reward failure cannot overwrite a new round',async()=>{
 const h=await ui('reaction','casual');let reject;h.context.BS_CAREER.record=()=>new Promise((_resolve,fail)=>{reject=fail;});h.$('start').onclick();let elapsed=0;
 for(let i=0;i<3;i++){const wait=[...h.timers.values()].at(-1).ms;elapsed+=wait;h.setTime(elapsed);fire(h);elapsed+=120;h.setTime(elapsed);h.$('reactionPad').onclick();if(i<2)h.$('reactionPad').onclick();}
 await Promise.resolve();assert.equal(h.context.probe().active,false);assert.equal(h.storage.get('tahdia-best-v16:reaction:casual'),'120');assert.equal(h.$('arcadeSummary').children.length,3);h.$('start').onclick();const before=h.$('status').textContent;reject(Error('network'));await new Promise(resolve=>setImmediate(resolve));assert.equal(h.$('status').textContent,before);assert.equal(h.context.probe().active,true);
});
