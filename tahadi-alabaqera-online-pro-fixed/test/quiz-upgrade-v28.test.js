import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createDOM,MiniElement} from './dom-harness.mjs';
import {CATEGORIES} from '../src/questions.js';
import * as engine from '../public/assets/js/engines/quiz-relay-v28.js';
MiniElement.prototype.getContext=()=>null;

// 33.0.0: the same-device quiz moved online; its board tests went with it (see
// quiz-ui-v19.test.js for where an old link goes now).

const players=['a0','b0','a1','b1'].map((id,i)=>({id,name:id,team:id[0].toUpperCase(),score:0,role:i?'guest':'host',connected:true,powers:{double:true,time:true,block:true}}));
function state(extra={}){return{code:'123456',status:'playing',mode:'teams-4',playerLimit:4,players,teamScores:[{team:'A',score:0},{team:'B',score:0}],roundIndex:0,roundCount:12,serverNow:1000000,matchId:'match-28',...extra};}
function current(extra={}){return{question:'سؤال',category:{name:'فئة'},value:100,mode:'secret',phase:'secret',answeredPlayers:[],options:['أ','ب','ج','د'],startedAt:1000000,deadline:1030000,...extra};}
async function online(globals={},{menu=false}={}){
 const cues=[],session=new Map(),d=await createDOM('online.html',{Date:class extends Date{static now(){return 1000000;}},requestAnimationFrame:()=>1,BS_AUDIO:{play:x=>cues.push(x),timerTick(){},timerEnd(){}},sessionStorage:{getItem:k=>session.get(k)||null,setItem:(k,v)=>session.set(k,v),removeItem:k=>session.delete(k)},...globals});
 await d.runFile('assets/js/quiz-team-v28.js',{engine});if(menu)await d.runFile('assets/js/game-menu-v33.js');const code=[...d.html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('function renderFinished('));
 vm.runInContext(code.replace(/\}\)\(\);\s*$/,"window.__qa={set:s=>{state=s;myId='a0';render();},renderMedia};})();"),d.context);return{...d,qa:d.context.__qa,cues,session};
}
test('a teammate success uses the correct cue and balanced team score placement',async()=>{
 const d=await online(),s=state({lastReveal:{roundIndex:0,mode:'secret',category:{name:'فئة'},value:100,question:'سؤال',correctAnswer:'أ',nextAt:1005000,results:{a1:{correct:true,gain:100}}}});d.qa.set(s);for(const t of [...d.timers.values()].filter(t=>t.ms===120))t.fn();assert.ok(d.cues.includes('correct'));assert.ok(!d.cues.includes('wrong'));assert.equal(d.doc.querySelector('.matchTop').children[1].id,'roundBadge');assert.ok(d.doc.querySelector('.matchTop').classList.contains('is-teams'));
});
test('updates within a secret round do not replay its cue and delayed feedback cannot spill into a new match',async()=>{
 const d=await online();d.qa.set(state({current:current()}));const n=d.cues.length;assert.equal(d.doc.querySelectorAll('#action .choice').length,4);d.qa.set(state({current:current({answeredPlayers:['a0','a1']})}));assert.equal(d.cues.length,n);assert.match(d.doc.getElementById('action').textContent,/تم إرسال إجابتك/);
 d.qa.set(state({lastReveal:{roundIndex:0,category:{name:'فئة'},value:100,question:'س',correctAnswer:'أ',nextAt:1005000,results:{a1:{correct:true}}}}));const deferred=[...d.timers.values()].find(t=>t.ms===120);d.qa.set(state({matchId:'another-match',current:current()}));const before=d.cues.length;deferred.fn();assert.equal(d.cues.length,before);
});
test('online relay shows only the active member clue and hides ordinary powers',async()=>{
 const d=await online(),r=engine.createRelay({members:['a0','a1'],now:1000000});d.qa.set(state({roundIndex:3,current:current({mode:'relay',phase:'relay',relay:engine.relayView(r,'a0')})}));assert.ok(d.doc.querySelector('.relay-clue'));assert.equal(d.doc.getElementById('powers').children.length,0);
 engine.answerRelay(r,{playerId:'a0',choice:r.steps[0].correctIndex,stageId:engine.relayStageId(r),now:1000001});d.qa.set(state({roundIndex:3,current:current({mode:'relay',phase:'relay',relay:engine.relayView(r,'a0')})}));assert.equal(d.doc.querySelector('.relay-clue'),null);assert.match(d.doc.querySelector('.relay-status').textContent,/a1/);
});
test('all image and sound alternatives use distinct families and new AI images are explicitly identified',()=>{
 // 32.0.0: zoom choices are look-alikes (an orange for a basketball); a choice
 // that names another picture in the bank must belong to a different family
 for(const id of ['zoom','sounds']){const cat=CATEGORIES.find(c=>c.id===id);for(const q of cat.questions){assert.equal(q.distractors.length,3);assert.equal(new Set([q.a,...q.distractors]).size,4,q.id);if(q.kind==='audio_pattern')continue;const families=[q.mediaFamily];for(const a of q.distractors){const other=cat.questions.find(x=>x.a===a);if(id==='sounds')assert.ok(other);if(other)families.push(other.mediaFamily);}assert.equal(new Set(families).size,families.length,q.id);}}
 const images=CATEGORIES.find(c=>c.id==='zoom').questions.filter(q=>q.id.startsWith('ai-zoom-'));assert.equal(images.length,4);for(const q of images){assert.equal(q.generated,true);assert.equal(q.revealSrc,q.src);assert.match(q.credit,/مولّدة/);}
});
test('a failed replacement image exposes retry and a successful retry removes the error controls',async()=>{
 const d=await online();await d.runFile('assets/js/quiz-visuals-v28.js');const frame=d.doc.createElement('div'),image=d.doc.createElement('img');frame.append(image);d.doc.body.append(frame);d.context.BS_QUIZ_VISUALS.attach(image,frame);image.dispatchEvent({type:'load'});image.dispatchEvent({type:'error'});assert.ok(frame.querySelector('.quiz-image-status'));assert.ok(frame.querySelector('.quiz-image-retry'));image.dispatchEvent({type:'load'});assert.equal(frame.querySelector('.quiz-image-status'),null);assert.equal(frame.querySelector('.quiz-image-retry'),null);
});


test('33.0.0: the shared menu opens a room (no player count) and a quiz code joins it',async()=>{
 const requests=[];const answer=async(url,opts)=>{requests.push({url,opts});return Response.json(url.endsWith('/api/health')?{ok:true,online:true}:url.includes('/api/rooms/resolve/')?{ok:true,game:'quiz'}:{ok:true,code:'123456',hostKey:'test-host-key'});};
 const d=await online({fetch:answer,AbortSignal},{menu:true});
 assert.equal(d.doc.getElementById('playerLimit'),null,'no player count to choose');
 d.doc.querySelector('.gm33-create').click();for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));
 const request=requests.find(x=>x.url.endsWith('/api/rooms'));assert.ok(request);assert.deepEqual(JSON.parse(request.opts.body),{name:'A',playerLimit:20,teams:false});
 assert.match(d.context.location.href,/online\.html\?room=123456/);assert.equal(d.storage.get('hostKey:123456'),'test-host-key');
 const guest=await online({fetch:answer,AbortSignal},{menu:true});const form=guest.doc.querySelector('.gm33-join');form.querySelector('input').value='١٠٤٣٢١';
 form.dispatchEvent({type:'submit',preventDefault(){}});for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));
 assert.match(guest.context.location.href,/online\.html\?room=104321/);
});
