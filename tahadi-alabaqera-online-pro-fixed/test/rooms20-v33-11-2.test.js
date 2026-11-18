import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import{readFile}from'node:fs/promises';
import * as catalog from '../public/assets/js/engines/party-catalog-v29.js';
import * as modes from '../public/assets/js/engines/party-modes.js';
import {createParty,addPartyPlayer,startPartyRound,partySnapshot,applyPartyAction,advanceParty,configureParty,openPartyLink,applyLinkResult,failPartyLink}from'../src/party/party-engine.js';
import {createLinkedRoom,linkedGame,linkTables}from'../src/party/party-link.js';
import {createChallenge,applyChallenge}from'../public/assets/js/engines/challenge-core.js';
import {unoDeck,unoLegal}from'../public/assets/js/engines/uno-core.js';
import {createDOM}from'./dom-harness.mjs';
const link={code:'654321',round:'0f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a',token:'T'.repeat(64)};
function party(game='memory',n=20,mode){const room=createParty({code:'654321',hostKey:'h'.repeat(40),links:true,continuous:true,playlist:[{game,...(mode?{mode}:{}),duration:180},'logic'],now:1000});for(let i=0;i<n;i++)addPartyPlayer(room,{name:'P'+i,now:1000+i});room.roster=[...room.order];startPartyRound(room,2000,42);return room;}
test('every listed mode survives validation, editing and the real-room initialization body',async()=>{
 const calls=[],ns={idFromName:n=>n,get:()=>({fetch:async(url,init)=>{calls.push(JSON.parse(init.body));return new Response('{}',{status:201});}})},env={ROOMS:ns,BOARD_ROOMS:ns};
 for(const game of catalog.PARTY_GAMES)for(const mode of modes.partyModes(game.id)){
  const [row]=catalog.normalizePlaylist([{game:game.id,mode:mode.id}]);assert.equal(row.mode,mode.id);
  if(!linkedGame(game.id))continue;
  assert.equal((await createLinkedRoom(env,game.id,{settings:row,count:2,link})).ok,true);const body=calls.at(-1);
  if(['snakes','jackaroo','ludo','pegs','jewels','dice','billiards','carrom'].includes(game.id))assert.equal(body.variant,mode.id);
  if(game.id==='chaos')assert.equal(body.unoMode,mode.id);
  if(game.id==='tanks')assert.equal(body.mode,mode.id);
  if(game.id==='quiz')assert.equal(body.teams===true,mode.id==='teams');
  if(game.id==='serpent')assert.equal(body.matchMode,mode.id);
  if(game.id==='picture')assert.equal(body.size,Number(mode.id));
  if(game.id==='hockey')assert.equal(body.target,mode.id==='quick'?3:mode.id==='long'?7:5);
 }
 assert.throws(()=>catalog.normalizePlaylist([{game:'pegs',mode:'unavailable'}]),/طور/);
 const [memory]=catalog.normalizePlaylist([{game:'memory',mode:'sequence',memoryMode:'pairs'}]);assert.equal(memory.memoryMode,'sequence');
});
test('twenty people have complete, distinct and bounded table assignments, including UNO and Jewels',()=>{
 const ids=Array.from({length:20},(_,i)=>'p'+i);
 for(const game of catalog.PARTY_GAMES)if(linkedGame(game.id))for(const mode of modes.partyModes(game.id)){
  const groups=linkTables(game.id,ids,{mode:mode.id}),limit=game.id==='quiz'&&mode.id==='teams'?6:linkedGame(game.id).tables?linkedGame(game.id).max:20;
  assert.equal(groups.flat().length,20);assert.equal(new Set(groups.flat()).size,20);assert.ok(groups.every(g=>g.length<=limit));
 }
 const uno=party('chaos');assert.deepEqual(uno.round.link.tables.map(t=>t.count),[7,7,6]);
 const gems=party('jewels');assert.equal(gems.round.link.page,'/jewels');assert.equal(gems.round.link.tables.length,10);assert.equal(gems.round.local,undefined);
 const pegs=party('pegs',20,'race-large');assert.equal(pegs.round.settings.mode,'race-large');assert.equal(pegs.round.link.tables.length,4);
});
test('all memory results finish the round early, count once and open the next game after five seconds',()=>{
 const room=party(),round=room.round;
 for(const [i,id]of room.order.entries()){
  applyPartyAction(room,id,{sessionId:room.sessionId,roundId:round.id,seq:1,action:{report:{progress:1,score:10000,done:true,won:true}}},3000+i*100);
  advanceParty(room,3000+i*100);
  if(i<19)assert.equal(room.status,'playing');
 }
 assert.equal(room.status,'intermission');assert.ok(room.nextAt<round.deadline);assert.equal(room.history.length,1);
 const at=room.nextAt;advanceParty(room,at);assert.equal(room.round.game,'logic');assert.equal(room.history.length,1);
});
test('a mode edit cannot mutate the current round and a failed game cannot substitute old Jewels',()=>{
 const room=party('pegs',4,'large'),old=structuredClone(room.round.settings),host=room.order[0];
 configureParty(room,host,{type:'playlist',playlistRevision:room.playlistRevision,playlist:[{game:'chaos',mode:'quick'}]},3000);
 assert.deepEqual(room.round.settings,old);assert.equal(room.playlist[1].mode,'quick');
 const gems=party('jewels');failPartyLink(gems,3000);assert.equal(gems.status,'intermission');assert.equal(gems.round.local,undefined);assert.doesNotThrow(()=>partySnapshot(gems,gems.order[0]));
});
test('every UNO mode allows +4 defensive stacking despite matching color and settles +12 once',()=>{
 for(const mode of ['classic','stack','quick']){
  const players=Array.from({length:4},(_,slot)=>({id:'p'+slot,name:'P'+slot})),m=createChallenge('chaos',players,42,1000,{unoMode:mode}),u=m.uno;
  const card=(id,color,face)=>({id,color,face});u.discard=[card('top','red','5')];u.color='red';u.deck=unoDeck().slice(20,70);
  u.hands=[[card('a','wild','draw4'),card('ab','blue','2')],[card('b','wild','draw4'),card('bb','blue','2')],[card('c','wild','draw4'),card('cg','green','2')],[card('d','gold','1'),card('db','blue','2')]];
  for(const [i,color]of ['blue','green','gold'].entries()){
   assert.ok(unoLegal(u,i).includes(['a','b','c'][i]));applyChallenge(m,'p'+i,{type:'play',card:['a','b','c'][i],color,uno:true},1100+i*100);assert.equal(u.pending,(i+1)*4);
  }
  applyChallenge(m,'p3',{type:'draw'},1500);assert.equal(u.hands[3].length,14);assert.equal(u.pending,0);assert.equal(u.turn,0);
  assert.throws(()=>applyChallenge(m,'p3',{type:'draw'},1600),/دورك/);assert.equal(u.hands[3].length,14);
 }
});
async function ui(){
 const peers=[];class Socket{constructor(){this.readyState=1;this.sent=[];peers.push(this);}send(s){this.sent.push(JSON.parse(s));}close(){}}
 const d=await createDOM('party.html',{...catalog,...modes,history:{replaceState(){}},sessionStorage:{getItem:()=>null,setItem(){}},location:{protocol:'https:',host:'game.test',origin:'https://game.test',pathname:'/party',search:''},WebSocket:Socket,requestAnimationFrame:()=>1,cancelAnimationFrame(){},Audio:class{play(){return Promise.resolve()}pause(){}},SerpentRenderer:class{},applySerpentFrame(){return null},BS_AUDIO:{play(){},getSettings:()=>({muted:false})}});
 const source=(await readFile(new URL('../public/assets/js/party-v29.js',import.meta.url),'utf8')).replace(/import[\s\S]*?from\s*['"][^'"]+['"];?/g,'');
 vm.runInContext(source+`\nwindow.TEST={connect:c=>{code=c;connect();},report:r=>{queueReport(r,state.round.id);sendReport();},flush:sendReport,get:()=>({state,me,pending,localReport,draft}),editor:rows=>{draft=structuredClone(rows);renderEditor();}};`,vm.createContext(d.context));
 return {...d,peers,test:d.context.TEST};
}
test('the actual editor offers each game mode and keeps mode values as strings when saving',async()=>{
 const d=await ui();d.test.editor(catalog.PARTY_GAMES.map(g=>({game:g.id,difficulty:2,duration:180,worldId:'classic'})));
 const rows=d.doc.querySelectorAll('.party-editor-row');assert.equal(rows.length,catalog.PARTY_GAMES.length);
 rows.forEach((row,i)=>{const input=row.querySelector('[data-field="mode"]');assert.ok(input);assert.equal(input.querySelectorAll('option').length,modes.partyModes(catalog.PARTY_GAMES[i].id).length);});
 const index=catalog.PARTY_GAMES.findIndex(g=>g.id==='pegs'),input=rows[index].querySelector('[data-field="mode"]');input.value='race-large';
 d.doc.getElementById('playlistEditor').onchange({target:input});assert.equal(d.test.get().draft[index].mode,'race-large');
});
test('the real client preserves a terminal memory report when ACK precedes private state',async()=>{
 const d=await ui(),room=party('memory',1),id=room.order[0];d.test.connect(room.code);const socket=d.peers[0];
 socket.onmessage({data:JSON.stringify({type:'welcome',playerId:id,token:'resume',state:partySnapshot(room,id,2000)})});
 d.test.report({progress:.5,score:5000});assert.equal(socket.sent.at(-1).seq,1);
 d.test.report({progress:1,score:10000,done:true,won:true});assert.equal(d.test.get().localReport.report.done,true);
 applyPartyAction(room,id,socket.sent.at(-1),3000);
 socket.onmessage({data:JSON.stringify({type:'ack',roundId:room.round.id,seq:1,feedback:'silent'})});d.test.flush();
 const final=socket.sent.at(-1);assert.equal(final.seq,2);assert.equal(final.action.report.done,true);applyPartyAction(room,id,final,3100);advanceParty(room,3100);assert.equal(room.status,'intermission');
});
test('an unsuccessful final report is retried with the authoritative sequence after resync',async()=>{
 const d=await ui(),room=party('memory',1),id=room.order[0];d.test.connect(room.code);const socket=d.peers[0];
 socket.onmessage({data:JSON.stringify({type:'welcome',playerId:id,token:'resume',state:partySnapshot(room,id,2000)})});d.test.report({progress:1,score:10000,done:true,won:true});
 socket.onmessage({data:JSON.stringify({type:'error',seq:1,message:'retry'})});socket.onmessage({data:JSON.stringify({type:'snapshot',state:partySnapshot(room,id,3000)})});d.test.flush();
 const retry=socket.sent.at(-1);assert.equal(retry.seq,1);assert.equal(retry.action.report.done,true);applyPartyAction(room,id,retry,3200);advanceParty(room,3200);assert.equal(room.status,'intermission');
});
test('every linked mode is accepted by the actual server room, including team bots for odd tables',async()=>{
 const {environment}=await import('./worker-harness.mjs'),env=environment();const {GameRoom}=await import('../src/index.js');env.ROOMS=new env.BOARD_ROOMS.constructor(GameRoom,env);
 for(const game of catalog.PARTY_GAMES)if(linkedGame(game.id))for(const mode of modes.partyModes(game.id)){
  const settings={mode:mode.id,difficulty:2,duration:180},result=await createLinkedRoom(env,game.id,{settings,count:2,link});assert.equal(result.ok,true,game.id+':'+mode.id);
 }
 const tank=await createLinkedRoom(env,'tanks',{settings:{mode:'teams'},count:3,link}),tankRoom=await env.ROOMS.peek('tanks:'+tank.code).instance.tanksDelegate();
 assert.equal(tankRoom.r.mode,'teams');assert.equal(tankRoom.r.capacity,4);tankRoom.r.players=Array.from({length:3},(_,i)=>({id:'p'+i,name:'P'+i,connected:true}));tankRoom.partyStart();assert.equal(tankRoom.r.players.length,4);assert.equal(tankRoom.r.players.filter(p=>p.bot).length,1);assert.equal(tankRoom.r.g.mode,'teams');
 const quiz=await createLinkedRoom(env,'quiz',{settings:{mode:'teams'},count:5,link}),quizRoom=env.ROOMS.peek(quiz.code).instance;
 for(let i=0;i<5;i++){const id='p'+i;quizRoom.room.order.push(id);quizRoom.room.players[id]={id,name:'P'+i,connected:true};}
 assert.equal(quizRoom.seatForMatch(),null);assert.equal(quizRoom.room.order.length,6);assert.equal(quizRoom.room.order.filter(id=>quizRoom.room.players[id].team==='A').length,3);
});
