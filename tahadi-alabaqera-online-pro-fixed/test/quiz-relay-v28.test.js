import test from 'node:test';
import assert from 'node:assert/strict';
import {createRelay,relayView,relayStageId,answerRelay,relayResults,restoreRelay} from '../public/assets/js/engines/quiz-relay-v28.js';
import './worker-harness.mjs';
const {GameRoom}=await import('../src/index.js');

const solvePart=r=>answerRelay(r,{playerId:r.members[r.stage],choice:r.steps[r.stage].correctIndex,stageId:relayStageId(r),now:1001});
test('all twelve relay puzzles have integer linked solutions and unique options for two or three members',()=>{
 for(let seed=0;seed<12;seed++)for(const count of [2,3]){
  const members=Array.from({length:count},(_,i)=>'p'+i),r=createRelay({seed,members,now:1000});
  assert.equal(r.steps.length,count);for(const step of r.steps){assert.ok(Number.isInteger(Number(step.answer)));assert.equal(new Set(step.options).size,4);assert.equal(step.options[step.correctIndex],step.answer);}
  while(!r.complete){const stage=r.stage;if(stage)assert.ok(r.steps[stage].prompt.includes(r.steps[stage-1].answer));assert.equal(solvePart(r).correct,true);}
  assert.equal(r.stage,count);assert.equal(Object.values(relayResults(r,200)).reduce((n,x)=>n+x.gain,0),250);
 }
});
test('relay views expose only the current member clue and never the private answer keys',()=>{
 const r=createRelay({members:['a','b','c'],now:1000}),own=relayView(r,'a'),waiting=relayView(r,'b');
 assert.ok(own.clue);assert.equal(own.options.length,4);assert.equal(waiting.clue,null);assert.equal(waiting.options,null);assert.equal(relayView(r,'opponent'),null);
 for(const view of [own,waiting])assert.doesNotMatch(JSON.stringify(view),/correctIndex|"steps"|"answers"/);
});
test('wrong member and stale stage submissions cannot advance or fail a teammate’s part',()=>{
 const r=createRelay({members:['a','b'],now:1000}),before=structuredClone(r),oldId=relayStageId(r);
 assert.equal(answerRelay(r,{playerId:'b',choice:0,stageId:oldId,now:1001}).accepted,false);assert.deepEqual(r,before);solvePart(r);const next=structuredClone(r);
 assert.equal(answerRelay(r,{playerId:'a',choice:0,stageId:oldId,now:1002}).error,'stage_changed');assert.deepEqual(r,next);
});
test('only distinct wrong choices consume the three shared mistakes and partial points are conserved',()=>{
 const r=createRelay({members:['a','b','c'],now:1000});solvePart(r);const wrong=[0,1,2,3].filter(i=>i!==r.steps[r.stage].correctIndex);
 for(const choice of wrong){const msg={playerId:'b',choice,stageId:relayStageId(r),now:1002};answerRelay(r,msg);const mistakes=r.mistakes;assert.equal(answerRelay(r,msg).accepted,false);assert.equal(r.mistakes,mistakes);}
 assert.equal(r.failed,true);assert.equal(r.mistakes,3);assert.equal(Object.values(relayResults(r,300)).reduce((n,x)=>n+x.gain,0),50);
});
test('a saved relay restores the same owner, partial progress, wrong options and deadline',()=>{
 const r=createRelay({seed:7,members:['a','b','c'],now:1000});solvePart(r);answerRelay(r,{playerId:'b',choice:(r.steps[1].correctIndex+1)%4,stageId:relayStageId(r),now:1002});
 const restored=restoreRelay(JSON.parse(JSON.stringify(r)));assert.deepEqual(restored,r);assert.equal(relayView(restored,'b').ownerId,'b');
 const forged=structuredClone(r);forged.answers[0]=(forged.answers[0]+1)%4;assert.equal(restoreRelay(forged),null);
 const before=structuredClone(r);assert.equal(answerRelay(r,{playerId:'b',choice:0,stageId:relayStageId(r),now:r.deadline}).accepted,false);assert.deepEqual(r,before);
});

function fixture(count=4){
 const g=Object.create(GameRoom.prototype);g.ctx={getWebSockets:()=>[],storage:{get:async()=>null,put:async()=>{},setAlarm:async t=>{g.nextAlarm=t;}}};
 const order=count===6?['a0','b0','a1','b1','a2','b2']:['a0','b0','a1','b1'];
 g.room={code:'123456',status:'playing',mode:'teams-'+count,playerLimit:count,relayEnabled:true,selectedCategories:['saudi','geography','history','world','science','space'],roundCount:12,matchId:'v28-match',roundIndex:3,expiresAt:Date.now()+86400000,order,players:{},current:null};
 for(const id of order)g.room.players[id]={id,name:id,role:id==='a0'?'host':'guest',team:id[0].toUpperCase(),connected:true,ready:true,score:0,powers:{double:true,time:true,block:true}};
 g.persistAndBroadcast=async()=>{};g.syncConnectedFlags=()=>{};g.errors=[];g.sendError=(_socket,error)=>g.errors.push(error);g.broadcastState=()=>{};
 return g;
}
function beginRelay(g){const now=Date.now();g.room.current={mode:'relay',phase:'relay',category:{id:'relay',name:'سلسلة الفريق'},value:200,question:'تعاون',deadline:now+60000,startedAt:now,answers:{},options:[],double:{},blocked:{},relays:Object.fromEntries(['A','B'].map(team=>[team,createRelay({seed:3,members:g.room.order.filter(id=>g.room.players[id].team===team),now})]))};}
test('buzzer timeout gives the steal to a connected opponent rather than a teammate',async()=>{
 const g=fixture();g.room.current={mode:'buzzer',phase:'buzzer_answer',buzzWinner:'a1',answers:{},blocked:{},deadline:Date.now()-1};g.room.players.b0.connected=false;
 await g.alarm();assert.equal(g.room.current.stealPlayer,'b1');
});
test('replacing a disconnected seat restores balanced teams in four and six player lobbies',()=>{
 for(const count of [4,6]){const g=fixture(count);g.room.status='lobby';Object.assign(g.room.players.a1,{connected:false,disconnectedAt:Date.now()-46000});g.cleanupLobbySeats();g.addPlayer('replacement','guest');assert.equal(g.room.order.filter(id=>g.room.players[id].team==='A').length,count/2);assert.equal(g.room.order.filter(id=>g.room.players[id].team==='B').length,count/2);}
});
test('finished quiz retries pending rewards when its retry alarm fires',async()=>{
 const g=fixture();Object.assign(g.room,{status:'finished',current:null,rewardsComplete:false,rewardRetryAt:Date.now()-1});let retries=0;g.saveQuizRewards=async()=>{retries++;g.room.rewardsComplete=true;g.room.rewardRetryAt=null;};await g.alarm();assert.equal(retries,1);assert.equal(g.room.rewardsComplete,true);assert.ok(g.nextAlarm>Date.now());
});
test('authoritative team relay requires round and stage context even for a legacy socket',async()=>{
 const g=fixture();beginRelay(g);const relay=g.room.current.relays.A,ws={deserializeAttachment:()=>({playerId:'a0'})};const base={type:'relay_answer',stageId:relayStageId(relay),choice:relay.steps[0].correctIndex};
 await g.webSocketMessage(ws,JSON.stringify(base));assert.equal(relay.stage,0);assert.equal(g.errors.length,1);
 await g.webSocketMessage(ws,JSON.stringify({...base,matchId:g.room.matchId,roundIndex:g.room.roundIndex}));assert.equal(relay.stage,1);
 await g.webSocketMessage(ws,JSON.stringify({...base,matchId:g.room.matchId,roundIndex:g.room.roundIndex}));assert.equal(relay.stage,1);assert.equal(g.errors.length,2);
 assert.equal(g.publicState('a1').current.relay.ownerId,'a1');assert.equal(g.publicState('a0').current.relay.clue,null);assert.ok(g.publicState('a1').current.relay.clue);
});
test('team relay awards shared totals only once when both teams finish',async()=>{
 const g=fixture();beginRelay(g);for(const team of ['A','B']){const r=g.room.current.relays[team];while(!r.complete){const id=r.members[r.stage];await g.handleRelayAnswer(g.room.players[id],{choice:r.steps[r.stage].correctIndex,stageId:relayStageId(r)},{});}}
 assert.equal(g.room.current,null);assert.equal(g.room.lastReveal.mode,'relay');assert.equal(g.room.lastReveal.relay.length,2);
 assert.equal(g.room.players.a0.score+g.room.players.a1.score,250);assert.equal(g.room.players.b0.score+g.room.players.b1.score,250);
 await g.finalizeRelay();assert.equal(g.room.players.a0.score+g.room.players.a1.score,250);
});
test('relay deadline settles partial work without skipping a disconnected member',async()=>{
 const g=fixture();beginRelay(g);const r=g.room.current.relays.A;await g.handleRelayAnswer(g.room.players.a0,{choice:r.steps[0].correctIndex,stageId:relayStageId(r)},{});g.room.players.a1.connected=false;g.room.current.deadline=Date.now()-1;await g.alarm();assert.equal(g.room.current,null);assert.equal(g.room.lastReveal.results.a0.gain,50);assert.equal(g.room.lastReveal.results.a1.gain,0);
});
