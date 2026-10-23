import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createDOM,MiniElement} from './dom-harness.mjs';
import {CATEGORIES} from '../src/questions.js';
import * as engine from '../public/assets/js/engines/quiz-relay-v28.js';
MiniElement.prototype.getContext=()=>null;

async function local(saved){
 let clock=1000000,fail=false;const clips=[],cues=[],settings={muted:false,volume:.6};
 class Audio{constructor(src){this.src=src;this.paused=true;clips.push(this);}play(){if(fail)return Promise.reject(Error('blocked'));this.paused=false;this.onplay?.();return Promise.resolve();}pause(){this.paused=true;}}
 const d=await createDOM('local.html',{Audio,BS_QUIZ_CATEGORIES:CATEGORIES,Date:class extends Date{static now(){return clock;}},requestAnimationFrame:()=>1,BS_AUDIO:{getSettings:()=>settings,play:x=>cues.push(x),timerTick(){},timerEnd(){}}});
 if(saved)for(const [key,value]of saved)d.storage.set(key,value);
 await d.runFile('assets/js/quiz-team-v28.js',{engine});await d.runFile('assets/js/quiz-visuals-v28.js');
 const code=[...d.html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('function openQuestion('));
 vm.runInContext(code.replace(/\}\)\(\);\s*$/,"window.__qa={start:ids=>{selected=ids;$('#start').onclick();},open:(id,index=0)=>{const cat=DATA.find(c=>c.id===id);openQuestion(cat,formed[id][index],document.querySelectorAll('.tile').find(t=>t.dataset.qid===formed[id][index].id));},get:()=>({current,teams,turn,left,deadline}),awardTo,tick,readCheckpoint};})();"),d.context);
 return{...d,qa:d.context.__qa,settings,clips,cues,setClock:n=>clock=n,fail:v=>fail=v};
}
function select(id){return[id,...CATEGORIES.filter(c=>c.id!==id).slice(0,5).map(c=>c.id)];}
function normalThree(d){const id=CATEGORIES[0].id;d.qa.start(select(id));for(let i=0;i<3;i++){d.qa.open(id,i);d.doc.getElementById('revealBtn').click();d.qa.awardTo(0);}d.qa.open(id,3);}
test('local question audio charges only successful plays, honors mute, and rejects busy or revealed replays',async()=>{
 const d=await local();d.qa.start(select('sounds'));d.qa.open('sounds');const button=d.doc.querySelector('.playSound');
 d.fail(true);await button.onclick();assert.equal(d.qa.get().current.soundPlays||0,0);
 const failedCount=d.clips.length;d.settings.muted=true;d.context.BS_QUIZ_AUDIO={enable:()=>{d.settings.muted=false;return d.settings;}};await button.onclick();assert.equal(d.settings.muted,false);assert.equal(d.clips.length,failedCount+1);
 d.settings.muted=false;d.fail(false);await button.onclick();assert.equal(d.qa.get().current.soundPlays,1);assert.equal(d.clips.at(-1).volume,.6);
 await button.onclick();assert.equal(d.qa.get().current.soundPlays,1);d.clips.at(-1).onended();
 d.doc.getElementById('revealBtn').click();const count=d.clips.length;await button.onclick();assert.equal(d.clips.length,count);
});
test('zoom reveal fits the full image, locks the old hint and opens a dismissible inspector',async()=>{
 const d=await local();d.qa.start(select('zoom'));d.qa.open('zoom');const image=d.doc.querySelector('.zoomFrame img'),hint=d.doc.querySelector('.zoomTools button');
 d.doc.getElementById('revealBtn').click();assert.equal(image.style.objectFit,'contain');assert.equal(image.style.transform,'scale(1)');assert.equal(hint.disabled,true);hint.onclick();assert.equal(image.style.transform,'scale(1)');
 d.doc.querySelector('.quiz-image-inspect').click();const dialog=d.doc.querySelector('.quiz-image-viewer');assert.equal(dialog.getAttribute('aria-label'),'استكشاف الصورة الكاملة');dialog.querySelectorAll('button').at(-1).click();assert.equal(d.doc.querySelector('.quiz-image-viewer'),null);
});
test('local relay hands off private parts, ignores a stale button and commits the shared total only once',async()=>{
 const d=await local();d.doc.getElementById('relayLocal').checked=true;normalThree(d);
 assert.ok(d.qa.get().current.relay);assert.equal(d.doc.querySelector('.relay-clue'),null);const before=d.qa.get().teams[d.qa.get().turn].score,team=d.qa.get().turn,value=d.qa.get().current.q.v;
 d.doc.querySelector('.relay-ready').click();const r=d.qa.get().current.relay,stale=d.doc.querySelectorAll('.relay-choice')[r.steps[0].correctIndex];stale.click();
 assert.equal(r.stage,1);assert.equal(d.doc.querySelector('.relay-clue'),null);stale.onclick();assert.equal(r.stage,1);assert.equal(d.qa.get().current.revealed,false);
 d.doc.querySelector('.relay-ready').click();d.doc.querySelectorAll('.relay-choice')[r.steps[1].correctIndex].click();const finish=d.doc.querySelector('.relay-finish');finish.click();assert.equal(d.qa.get().teams[team].score-before,value+50);finish.onclick();assert.equal(d.qa.get().teams[team].score-before,value+50);
});
test('a three-member relay resumes its next owner and original deadline, then expires without granting extra time',async()=>{
 const d=await local();d.doc.getElementById('relayLocal').checked=true;d.doc.getElementById('relayLocalSize').value='3';normalThree(d);d.doc.querySelector('.relay-ready').click();let r=d.qa.get().current.relay;d.doc.querySelectorAll('.relay-choice')[r.steps[0].correctIndex].click();const deadline=d.qa.get().deadline;
 const copy=await local(d.storage);copy.setClock(1005000);copy.doc.getElementById('resumeQuiz').click();r=copy.qa.get().current.relay;assert.equal(r.stage,1);assert.equal(r.members.length,3);assert.equal(copy.qa.get().deadline,deadline);assert.equal(copy.doc.querySelector('.relay-clue'),null);
 copy.setClock(deadline+1);copy.qa.tick();assert.equal(copy.qa.get().current.revealed,true);assert.ok(copy.doc.querySelector('.relay-finish'));assert.match(copy.doc.querySelector('.relay-status').textContent,/انتهى الوقت/);
});

const players=['a0','b0','a1','b1'].map((id,i)=>({id,name:id,team:id[0].toUpperCase(),score:0,role:i?'guest':'host',connected:true,powers:{double:true,time:true,block:true}}));
function state(extra={}){return{code:'123456',status:'playing',mode:'teams-4',playerLimit:4,players,teamScores:[{team:'A',score:0},{team:'B',score:0}],roundIndex:0,roundCount:12,serverNow:1000000,matchId:'match-28',...extra};}
function current(extra={}){return{question:'سؤال',category:{name:'فئة'},value:100,mode:'buzzer',phase:'buzzer',answers:{},options:['أ','ب','ج','د'],startedAt:1000000,deadline:1015000,...extra};}
async function online(globals={}){
 const cues=[],session=new Map(),d=await createDOM('online.html',{Date:class extends Date{static now(){return 1000000;}},requestAnimationFrame:()=>1,BS_AUDIO:{play:x=>cues.push(x),timerTick(){},timerEnd(){}},sessionStorage:{getItem:k=>session.get(k)||null,setItem:(k,v)=>session.set(k,v)},...globals});
 await d.runFile('assets/js/quiz-team-v28.js',{engine});const code=[...d.html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('function renderFinished('));
 vm.runInContext(code.replace(/\}\)\(\);\s*$/,"window.__qa={set:s=>{state=s;myId='a0';render();},renderMedia};})();"),d.context);return{...d,qa:d.context.__qa,cues,session};
}
test('a teammate success uses the correct cue and balanced team score placement',async()=>{
 const d=await online(),s=state({lastReveal:{roundIndex:0,mode:'buzzer',category:{name:'فئة'},value:100,question:'سؤال',correctAnswer:'أ',nextAt:1005000,results:{a1:{correct:true,gain:100}}}});d.qa.set(s);for(const t of [...d.timers.values()].filter(t=>t.ms===120))t.fn();assert.ok(d.cues.includes('correct'));assert.ok(!d.cues.includes('wrong'));assert.equal(d.doc.querySelector('.matchTop').children[1].id,'roundBadge');assert.ok(d.doc.querySelector('.matchTop').classList.contains('is-teams'));
});
test('buzzer phases do not replay a round cue and delayed feedback cannot spill into a new match',async()=>{
 const d=await online();d.qa.set(state({current:current()}));const n=d.cues.length;d.qa.set(state({current:current({phase:'buzzer_answer',buzzWinner:'a1'})}));assert.equal(d.cues.length,n);assert.match(d.doc.getElementById('action').textContent,/زميلك/);
 d.qa.set(state({lastReveal:{roundIndex:0,category:{name:'فئة'},value:100,question:'س',correctAnswer:'أ',nextAt:1005000,results:{a1:{correct:true}}}}));const deferred=[...d.timers.values()].find(t=>t.ms===120);d.qa.set(state({matchId:'another-match',current:current()}));const before=d.cues.length;deferred.fn();assert.equal(d.cues.length,before);
});
test('online relay shows only the active member clue and hides ordinary powers',async()=>{
 const d=await online(),r=engine.createRelay({members:['a0','a1'],now:1000000});d.qa.set(state({roundIndex:3,current:current({mode:'relay',phase:'relay',relay:engine.relayView(r,'a0')})}));assert.ok(d.doc.querySelector('.relay-clue'));assert.equal(d.doc.getElementById('powers').children.length,0);
 engine.answerRelay(r,{playerId:'a0',choice:r.steps[0].correctIndex,stageId:engine.relayStageId(r),now:1000001});d.qa.set(state({roundIndex:3,current:current({mode:'relay',phase:'relay',relay:engine.relayView(r,'a0')})}));assert.equal(d.doc.querySelector('.relay-clue'),null);assert.match(d.doc.querySelector('.relay-status').textContent,/a1/);
});
test('all image and sound alternatives use distinct families and new AI images are explicitly identified',()=>{
 for(const id of ['zoom','sounds']){const cat=CATEGORIES.find(c=>c.id===id);for(const q of cat.questions){assert.equal(q.distractors.length,3);if(q.kind==='audio_pattern'){assert.equal(new Set([q.a,...q.distractors]).size,4);continue;}const families=[q.mediaFamily];for(const a of q.distractors){const other=cat.questions.find(x=>x.a===a);assert.ok(other);families.push(other.mediaFamily);}assert.equal(new Set(families).size,4,q.id);}}
 const images=CATEGORIES.find(c=>c.id==='zoom').questions.filter(q=>q.id.startsWith('ai-zoom-'));assert.equal(images.length,4);for(const q of images){assert.equal(q.generated,true);assert.equal(q.revealSrc,q.src);assert.match(q.credit,/مولّدة/);}
});
test('a failed replacement image exposes retry and a successful retry removes the error controls',async()=>{
 const d=await local(),frame=d.doc.createElement('div'),image=d.doc.createElement('img');frame.append(image);d.doc.body.append(frame);d.context.BS_QUIZ_VISUALS.attach(image,frame);image.dispatchEvent({type:'load'});image.dispatchEvent({type:'error'});assert.ok(frame.querySelector('.quiz-image-status'));assert.ok(frame.querySelector('.quiz-image-retry'));image.dispatchEvent({type:'load'});assert.equal(frame.querySelector('.quiz-image-status'),null);assert.equal(frame.querySelector('.quiz-image-retry'),null);
});


test('create and join buttons normalize names, preserve the selected team size and navigate to the actual room',async()=>{
 const requests=[];const d=await online({fetch:async(url,opts)=>{requests.push({url,opts});return Response.json(url.endsWith('/api/health')?{ok:true,online:true}:{ok:true,code:'123456',hostKey:'test-host-key'});}});
 d.doc.getElementById('playerLimit').value='6';d.doc.getElementById('createName').value='\u0001فريق الاختبار  ';await d.doc.getElementById('createBtn').onclick();
 const request=requests.find(x=>x.url.endsWith('/api/rooms'));assert.ok(request);assert.deepEqual(JSON.parse(request.opts.body),{name:'فريق الاختبار',playerLimit:6});assert.match(d.context.location.href,/online\.html\?room=123456/);assert.equal(d.storage.get('hostKey:123456'),'test-host-key');
 const guest=await online();guest.doc.getElementById('joinCode').value='654321';guest.doc.getElementById('joinBtn').onclick();assert.match(guest.context.location.href,/room=654321/);assert.match(guest.doc.getElementById('joinName').value,/عبقري/);
});
