import {markSudokuError,clearSudokuError} from '../public/assets/js/sudoku-feedback-v29-1.js';
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import{readFile}from'node:fs/promises';
import{createDOM}from'./dom-harness.mjs';import{PARTY_GAMES,PARTY_COUNTDOWN_MS,partyGame,playlistCapacity,gameCapacity,tableSize,playersLabel,limitingGame,capacityMessage}from'../public/assets/js/engines/party-catalog-v29.js';import{createParty,addPartyPlayer,startPartyRound,partySnapshot,applyPartyAction,openPartyLink}from'../src/party/party-engine.js';
async function ui(extra={}){const d=await createDOM('party.html',{markSudokuError,clearSudokuError,PARTY_GAMES,PARTY_COUNTDOWN_MS,partyGame,playlistCapacity,gameCapacity,tableSize,playersLabel,limitingGame,capacityMessage,history:{replaceState(){}},sessionStorage:{getItem(){return null},setItem(){}},Audio:class{play(){return Promise.resolve()}pause(){}},SerpentRenderer:class{reset(){}setGame(){}draw(){}resize(){}},applySerpentFrame(){return null},requestAnimationFrame:()=>1,cancelAnimationFrame(){},BS_AUDIO:{play(){},getSettings:()=>({volume:.72,muted:false}),registerContent:()=>()=>{}},...extra});const code=await readFile(new URL('../public/assets/js/party-v29.js',import.meta.url),'utf8');vm.runInContext(code.replace(/import[\s\S]*?from\s*['"][^'"]+['"];?/g,'')+'\nwindow.PARTY_TEST={show:(s,id)=>{myId=id;roomReady=true;setSnapshot(s);},get:()=>({state,me,selected}),transport:value=>{socket=value;roomReady=true;}};',vm.createContext(d.context));return d;}
for(const game of PARTY_GAMES)test('room UI renders real server state without exceptions: '+game.id,async()=>{const d=await ui(),r=createParty({code:'123456',hostKey:'x'.repeat(40),playlist:[game.id]});for(let i=0;i<r.capacity;i++)addPartyPlayer(r,{name:'P'+i});r.roster=[...r.order];startPartyRound(r,Date.now(),42);const id=r.order[0];d.context.PARTY_TEST.show(partySnapshot(r,id),id);assert.equal(d.doc.querySelectorAll('.party-player-row').length,r.capacity);assert.equal(d.doc.getElementById('roomCode').textContent,'123456');assert.ok(d.doc.getElementById('gameStage').children.length>0);if(['jackaroo','zahra'].includes(game.id)){/* 33.0.0: twenty players sit at several tables; the page draws its own */const seats=r.round.tables.find(t=>t.members.includes(id)).members.length,stones=d.doc.querySelectorAll('[data-stone]');assert.ok(r.round.tables.length>1);assert.equal(stones.length,seats*4);assert.equal(new Set(stones.map(n=>n.dataset.stone)).size,seats*4);}if(game.id==='sudoku')assert.equal(d.doc.querySelectorAll('.sudoku .party-cell').length,81);if(game.id==='picture')assert.equal(d.doc.querySelectorAll('.party-picture-tray .party-cell').length,9);});
test('lobby exposes actual friend picker, ordered playlist controls, and complete 20-place standings',async()=>{const d=await ui(),r=createParty({code:'123456',hostKey:'x'.repeat(40),playlist:['quiz','memory']});for(let i=0;i<20;i++)addPartyPlayer(r,{name:'P'+i});let invite;d.context.BS_SOCIAL.openInvitePicker=options=>invite=options;d.context.PARTY_TEST.show(partySnapshot(r),r.order[0]);d.doc.getElementById('invite').click();assert.equal(invite.game,'party');assert.equal(invite.roomCode,'123456');d.doc.getElementById('editPlaylist').click();assert.equal(d.doc.getElementById('playlistDialog').open,true);assert.equal(d.doc.querySelectorAll('.party-editor-row').length,2);assert.equal(d.doc.querySelectorAll('.party-rank-table tbody tr').length,20);});

test('host sees an actionable offline-seat control and guests do not',async()=>{
 const d=await ui({confirm:()=>true}),r=createParty({code:'123456',hostKey:'x'.repeat(40),playlist:['memory']});for(let i=0;i<3;i++)addPartyPlayer(r,{name:'P'+i});r.players[r.order[2]].connected=false;
 const sent=[];d.context.PARTY_TEST.transport({readyState:1,send:value=>sent.push(JSON.parse(value))});d.context.PARTY_TEST.show(partySnapshot(r),r.order[0]);
 const buttons=d.doc.querySelectorAll('[data-remove-player]');assert.ok(buttons.length>=1);assert.ok(buttons.every(b=>b.dataset.removePlayer===r.order[2]),'only the offline seat can be cleared (rail and 32.1.0 seat grid)');d.doc.getElementById('roster').onclick({target:buttons[0]});assert.equal(sent[0].type,'remove');assert.equal(sent[0].playerId,r.order[2]);
 d.context.PARTY_TEST.show(partySnapshot(r),r.order[1]);assert.equal(d.doc.querySelectorAll('[data-remove-player]').length,0);
});
test('shared memory keeps its illustrated tiles through private flips and never exposes unopened faces',async()=>{
 const d=await ui(),room=createParty({code:'123456',hostKey:'x'.repeat(40),playlist:['memory']});addPartyPlayer(room,{name:'أطلس'});room.roster=[...room.order];startPartyRound(room,Date.now(),42);const id=room.order[0],r=room.round,deck=r.participants[id].state.deck,pair=deck.indexOf(deck[0],1);
 d.context.PARTY_TEST.show(partySnapshot(room,id),id);const tile=d.doc.querySelector('.memory-tile-v30');assert.equal(d.doc.querySelectorAll('.memory-front-v30').some(e=>e.dataset.face!==undefined),false);
 for(const[cell,seq]of[[0,1],[pair,2]]){applyPartyAction(room,id,{sessionId:room.sessionId,roundId:r.id,seq,action:{cell}},Date.now());d.context.PARTY_TEST.show(partySnapshot(room,id),id);assert.equal(d.doc.querySelector('.memory-tile-v30'),tile);}
 assert.equal(d.doc.querySelectorAll('.memory-tile-v30.matched').length,2);assert.match(tile.getAttribute('aria-label'),/زوج مطابق/);assert.equal(d.doc.querySelectorAll('.memory-front-v30').filter(e=>e.dataset.face!==undefined).length,2);assert.match(d.doc.querySelector('.party-memory-stats-v30').textContent,/1 \/ 8/);
});
test('leaving a lobby forgets its deleted resume seat',async()=>{
 const forgotten=[],d=await ui({sessionStorage:{getItem:()=>null,setItem(){},removeItem:key=>forgotten.push(key)}}),r=createParty({code:'123456',hostKey:'x'.repeat(40),playlist:['memory']});addPartyPlayer(r,{name:'P'});
 d.context.PARTY_TEST.transport({readyState:1,send(){},close(){}});d.context.PARTY_TEST.show(partySnapshot(r),r.order[0]);d.doc.getElementById('leave').click();
 assert.equal(forgotten.length,1);assert.ok(forgotten[0].endsWith(':123456'));assert.equal(d.context.PARTY_TEST.get().state,null);assert.equal(d.doc.getElementById('entry').hidden,false);
});
test('leaving an active series keeps its resume seat for a later return',async()=>{
 const forgotten=[],d=await ui({confirm:()=>true,sessionStorage:{getItem:()=>null,setItem(){},removeItem:key=>forgotten.push(key)}}),r=createParty({code:'123456',hostKey:'x'.repeat(40),playlist:['memory']});addPartyPlayer(r,{name:'P'});r.roster=[...r.order];startPartyRound(r,Date.now(),42);
 d.context.PARTY_TEST.transport({readyState:1,send(){},close(){}});d.context.PARTY_TEST.show(partySnapshot(r,r.order[0]),r.order[0]);d.doc.getElementById('leave').click();assert.equal(forgotten.length,0);
});
test('first arena welcome retains its full frame before the next network packet',async()=>{
 const frames=[],d=await ui({SerpentRenderer:class{reset(){}setGame(game){frames.push(game);}draw(){}resize(){}}}),r=createParty({code:'123456',hostKey:'x'.repeat(40),playlist:['serpent']});addPartyPlayer(r,{name:'P'});r.roster=[...r.order];startPartyRound(r,Date.now(),42);
 d.context.PARTY_TEST.show(partySnapshot(r,r.order[0]),r.order[0]);assert.ok(frames.length>0);assert.equal(frames.at(-1).snakes[0].id,r.order[0]);
});

test('shared-room Sudoku acknowledgement flashes the submitted cell red and plays one buzzer',async()=>{
 let socket;const sounds=[];class Socket{constructor(){socket=this;this.readyState=1;this.sent=[];}send(value){this.sent.push(JSON.parse(value));}close(){}}
 const d=await ui({location:{href:'https://game.test/party?room=123456',search:'?room=123456',origin:'https://game.test',protocol:'https:',host:'game.test'},WebSocket:Socket,BS_AUDIO:{play:name=>sounds.push(name),getSettings:()=>({volume:.72,muted:false})}});
 const room=createParty({code:'123456',hostKey:'x'.repeat(40),playlist:['sudoku']});addPartyPlayer(room,{name:'Player'});room.roster=[...room.order];startPartyRound(room,Date.now(),42);const id=room.order[0],state=partySnapshot(room,id),cell=state.round.me.initial.findIndex(v=>!v);
 socket.onmessage({data:JSON.stringify({type:'welcome',playerId:id,token:'resume',state})});
 d.doc.querySelector('[data-sudoku-cell="'+cell+'"]').click();d.doc.querySelector('.party-num-pad').children[0].click();const action=socket.sent.at(-1);assert.equal(action.type,'action');assert.equal(action.action.cell,cell);
 socket.onmessage({data:JSON.stringify({type:'ack',roundId:state.round.id,seq:action.seq,feedback:'wrong'})});
 const marked=d.doc.querySelector('[data-sudoku-cell="'+cell+'"]');assert.equal(marked.dataset.sudokuError,'true');assert.deepEqual(sounds,['buzzer']);
 socket.onmessage({data:JSON.stringify({type:'ack',roundId:state.round.id,seq:action.seq,feedback:'wrong'})});assert.equal(sounds.length,1);
});
// 33.0.0: twenty play a table game on two real tables; every page gets the same shared
// state from the room, and each player must go to the room of their own table.
test('a big group on several tables: each page goes to its own table',async()=>{
 const d=await ui({location:{href:'https://game.test/party?room=123456',search:'?room=123456',origin:'https://game.test',protocol:'https:',host:'game.test'}});
 const r=createParty({code:'123456',hostKey:'x'.repeat(40),playlist:['snakes','quiz'],links:true});
 for(let i=0;i<20;i++)addPartyPlayer(r,{name:'P'+i});
 for(const id of r.order)r.players[id].connected=true;
 r.roster=[...r.order];startPartyRound(r,Date.now(),42);
 assert.equal(r.round.link.tables.length,2);
 r.round.link.tables.forEach((t,i)=>openPartyLink(r,{code:'40000'+(i+1),page:'/snakes'},Date.now(),t.id));
 const shared=partySnapshot(r,null);
 for(const t of r.round.link.tables)for(const id of [t.players[0],t.players.at(-1)]){
  d.context.PARTY_TEST.show(shared,id);
  assert.match(d.doc.querySelector('.party-link-code').textContent,new RegExp('رمز طاولتك\\s*'+t.code));
  assert.match(d.doc.querySelector('.party-link-card p').textContent,/طاولتين/);
  d.doc.querySelector('.party-link-go').click();
  assert.equal(d.context.location.href,'/snakes?room='+t.code+'&party=123456');
 }
});
