import test from 'node:test';
import assert from 'node:assert/strict';
import {createDOM} from './dom-harness.mjs';
import * as engine from '../public/assets/js/engines/baloot-engine.js';
import * as talk from '../public/assets/js/engines/baloot-talk.js';
import {BalootVoice} from '../public/assets/js/baloot-voice.js';

async function table(voice=BalootVoice){
  const h=await createDOM('baloot.html',{getComputedStyle:()=>({getPropertyValue:()=>''}),devicePixelRatio:1});
  h.context.BS_CARDS={DECKS:{'deck-classic':{}},url:card=>'/cards/'+card+'.svg'};
  h.context.BS_GAME_MENU={mount:()=>({menu(){},setMode(){}}),remember(){},forget(){}};
  await h.runFile('assets/js/baloot-table.js',{...engine,...talk,BalootVoice:voice});
  // MiniElement does not reflect the native boolean hidden attribute.
  h.doc.getElementById('talkSheet').hidden=true;
  h.doc.getElementById('talkBtn').click();return h;
}
test('pending human recordings are accurately represented in the table controls',async()=>{
  const pending={getStatus:()=>({...BalootVoice.getStatus(),available:false,state:'awaiting-recordings'}),unlock(){}};
  const h=await table(pending),get=id=>h.doc.getElementById(id);
  assert.equal(get('talkSheet').hidden,false);assert.equal(get('voiceToggle').disabled,true);
  assert.equal(get('voiceToggle').getAttribute('aria-pressed'),'false');
  assert.equal(get('voicePreview').disabled,true);assert.equal(get('voiceReplay').disabled,true);
  assert.match(get('voiceNote').textContent,/التسجيلات البشرية/);
  assert.equal(get('voiceNote').getAttribute('role'),'status');
});
test('voice controls react to playback, replay availability and global mute without rebuilding phrase buttons',async()=>{
  let state={available:true,enabled:true,state:'ready',last:null,lastText:null},previews=0,replays=0,stops=0;
  const voice={enabled:true,getStatus:()=>state,unlock(){},preview(){previews++;},replay(){replays++;},stop(){stops++;},setEnabled(on){this.enabled=on;state={...state,enabled:on,state:on?'ready':'disabled'};}};
  const h=await table(voice),get=id=>h.doc.getElementById(id),first=get('talkGrid').children[0];
  assert.equal(get('voicePreview').disabled,false);assert.equal(get('voiceReplay').disabled,true);
  get('voicePreview').click();assert.equal(previews,1);
  const update=next=>{state={...state,...next};h.context.dispatchEvent({type:'bs-baloot-voice-change'});};
  update({last:'pass',lastText:'بس.',state:'playing'});assert.equal(get('voiceReplay').disabled,true);
  update({state:'ready'});assert.equal(get('voiceReplay').disabled,false);get('voiceReplay').click();assert.equal(replays,1);
  assert.equal(get('voiceLast').textContent,'آخر نداء: بس.');
  update({state:'muted'});assert.equal(get('voicePreview').disabled,true);assert.equal(get('voiceReplay').disabled,true);
  assert.equal(get('talkGrid').children[0],first,'status updates preserve phrase focus');
  get('leaveLobby').click();assert.equal(stops,1);assert.equal(get('talkSheet').hidden,true);
});

async function settle(h,promise){
  let finished=false;promise.then(()=>{finished=true;});
  for(let step=0;step<60&&!finished;step++){
    await new Promise(resolve=>setImmediate(resolve));
    for(const [id,timer]of [...h.timers]){h.timers.delete(id);timer.fn();}
  }
  assert.equal(finished,true,'table event queue settles');await promise;
}
function room(view,{id=1,age=0,seat=0,startedAt=1}={}){
  return {code:'123456',status:'playing',startedAt,serverNow:10000,me:{index:0},players:[],state:view,
    batch:{id,at:10000-age,events:[{type:'bid',bid:'pass',seat}]}};
}
function audibleVoice(calls,stops=[],finishes=[]){return {enabled:true,unlock(){},stop(){stops.push(true);},finish(){finishes.push(true);},say(text,position,options){calls.push({text,position,options});return true;},getStatus:()=>({available:true,enabled:true,state:'ready'})};}
test('room batches speak once, do not replay old reconnects, and allow the next player to pass',async()=>{
  const calls=[],h=await table(audibleVoice(calls)),ui=h.context.BS_BALOOT.ui;
  const view=engine.balootView(engine.createBalootMatch({dealer:3}),0);
  h.context.onRoomState(room(view));await settle(h,ui.pending);
  assert.equal(calls.length,1);assert.equal(calls[0].position,0);
  h.context.onRoomState(room(view));await settle(h,ui.pending);assert.equal(calls.length,1);
  h.context.onRoomState(room(view,{id:2,seat:1}));await settle(h,ui.pending);
  assert.equal(calls.length,2);assert.equal(calls[1].position,1);assert.notEqual(calls[0].options.key,calls[1].options.key);
  h.context.onRoomState(room(view,{id:3,age:5000}));await settle(h,ui.pending);assert.equal(calls.length,2);
  h.context.onRoomState(room(view,{startedAt:2}));await settle(h,ui.pending);assert.equal(calls.length,3);
});
test('an animation backlog catches up without speaking stale calls or losing the final state',async()=>{
  const calls=[],h=await table(audibleVoice(calls)),ui=h.context.BS_BALOOT.ui;
  let now=10000;h.context.Date={now:()=>now};
  const view=engine.balootView(engine.createBalootMatch({dealer:3}),0);
  h.context.onRoomState(room(view));now=15000;await settle(h,ui.pending);
  assert.equal(calls.length,0);assert.equal(ui.view,view);assert.equal(ui.busy,false);
});
test('a rematch cancels unfinished speech and no old animation can announce another call',async()=>{
  const calls=[],stops=[],h=await table(audibleVoice(calls,stops)),ui=h.context.BS_BALOOT.ui;
  const view=engine.balootView(engine.createBalootMatch({dealer:3}),0);
  h.context.onRoomState(room(view));await Promise.resolve();
  const old=ui.pending;
  h.context.onRoomState(room(view,{startedAt:2,seat:1}));
  await settle(h,Promise.all([old,ui.pending]));
  assert.equal(stops.length,2);assert.equal(ui.view,view);
  assert.equal(calls.filter(call=>call.position===0).length<=1,true);
  assert.equal(calls.filter(call=>call.position===1).length,1);
});

test('ending a hand finishes its active call and cancels a delayed reply even if its callback arrives late',async()=>{
 const calls=[],stops=[],finishes=[],h=await table(audibleVoice(calls,stops,finishes)),ui=h.context.BS_BALOOT.ui;
 ui.room={state:{phase:'playing',handNo:4},players:[{index:1,bot:true}]};ui.view={phase:'playing',handNo:4};h.doc.getElementById('table').hidden=false;
 h.context.botTalk('reply',[1],true);assert.equal(ui.botTalkTimers.size,1);const timer=h.timers.get([...ui.botTalkTimers][0]);
 h.context.endHandAudio();assert.equal(ui.botTalkTimers.size,0);assert.equal(stops.length,0);assert.equal(finishes.length,1);timer.fn();h.context.speak('pass',1);
 assert.equal(calls.length,0);assert.equal(h.doc.getElementById('talkSheet').hidden,true);
 h.context.resetVoiceSession();h.context.speak('pass',0);assert.equal(calls.length,1,'new hands can speak normally');
});
test('manual project taps choose exact cards without playing them, then send the selected project with the first play',async()=>{
 const h=await table(audibleVoice([])),ui=h.context.BS_BALOOT.ui,sent=[];let state=engine.createBalootMatch({dealer:3});state.phase='playing';state.turn=0;state.contract={type:'sun',buyer:0,trump:null,multiplier:1};state.hands[0]=['7S','8S','9S','TS','JS','AH','AD','AC'];state.startHands=state.hands.map(hand=>[...hand]);state.trick={leader:0,cards:[]};
 const view=engine.balootView(state,0);ui.view=view;ui.room={state:view};ui.client={send:(type,payload)=>{sent.push(payload.action);return true;}};h.doc.getElementById('table').hidden=false;
 h.context.renderProjectPicker(view);h.context.renderHand(view);const picker=h.doc.getElementById('projectPicker');picker.children.find(b=>b.textContent==='مشروع').click();for(const card of ['7S','8S','9S'])h.context.onCardTap(card);
 assert.equal(sent.length,0);assert.equal(h.doc.querySelectorAll('.project-selected').length,3);picker.children.find(b=>b.textContent==='اعتمد').click();h.context.onCardTap('AH');
 assert.equal(sent.length,1);assert.equal(sent[0].card,'AH');assert.deepEqual(JSON.parse(JSON.stringify(sent[0].projectCards)),[{type:'sira',cards:['7S','8S','9S']}]);
});
