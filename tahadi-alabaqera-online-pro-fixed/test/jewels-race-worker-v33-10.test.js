import test from 'node:test';
import assert from 'node:assert/strict';
import {environment,api,signup} from './worker-harness.mjs';
import {legalRaceSwaps,createJewelsRace} from '../public/assets/js/engines/jewels-race-engine.js';
async function setup(humans=2){
 const env=environment(),made=await api(env,'/api/board/rooms',{game:'jewels',name:'أ'});assert.equal(made.data.ok,true);
 const entry=env.BOARD_ROOMS.peek(made.data.code);await entry.ctx.ready;const board=entry.instance,sockets=[];
 for(let i=0;i<humans;i++){const player=board.addPlayer('لاعب '+i,i?'guest':'host'),sent=[],ws={readyState:1,deserializeAttachment:()=>({playerId:player.id}),send:raw=>sent.push(JSON.parse(raw)),close(){this.readyState=3;}};entry.ctx.sockets.push(ws);sockets.push({ws,sent,player});}
 await board.webSocketMessage(sockets[0].ws,JSON.stringify({type:'start'}));assert.equal(board.room.status,'playing');return{env,entry,board,sockets};
}
async function play(board,socket,seat,expectedVersion=board.room.version){const[a,b]=legalRaceSwaps(board.room.state,seat)[0];await board.webSocketMessage(socket.ws,JSON.stringify({type:'jewels_swap',a,b,seq:board.room.state.players[seat].seq,expectedVersion}));}
test('independent socket sequences accept both players despite stale global versions, without extending time',async()=>{
 const{board,sockets}=await setup(),v=board.room.version,end=board.room.state.endsAt;await play(board,sockets[0],0,v);await play(board,sockets[1],1,v);await play(board,sockets[0],0,v);
 assert.deepEqual(board.room.state.players.map(p=>p.used),[2,1]);assert.equal(board.room.turnDeadline,end);assert.equal(sockets.flatMap(s=>s.sent).filter(m=>m.type==='error').length,0);
});
test('snapshots expose own board only, hide refill RNG and omit opponent animation steps',async()=>{
 const{board,sockets}=await setup();await play(board,sockets[0],0);
 for(let seat=0;seat<2;seat++){const v=sockets[seat].sent.filter(m=>m.type==='state').at(-1).state;assert.equal(v.state.players[seat].board.length,64);assert.equal('seed' in v.state.players[seat],false);assert.equal('initialSeed' in v.state,false);for(const k of['board','seed','serial','last'])assert.equal(k in v.state.players[1-seat],false,k);assert.equal(v.steps,undefined);}
});
test('duplicate or missing own sequence spends no action and returns a recovery state',async()=>{
 const{board,sockets}=await setup(),[a,b]=legalRaceSwaps(board.room.state,0)[0];await play(board,sockets[0],0);const before=structuredClone(board.room.state);
 for(const seq of[0,undefined])await board.webSocketMessage(sockets[0].ws,JSON.stringify({type:'jewels_swap',a,b,seq,expectedVersion:board.room.version}));assert.deepEqual(board.room.state,before);assert.equal(sockets[0].sent.filter(m=>m.type==='error').length,2);assert.equal(sockets[0].sent.at(-1).type,'state');
});
test('bot alarms progress alone and expiry closes actual scores without spending human moves',async()=>{
 const{board,entry}=await setup(1),end=board.room.state.endsAt;assert.equal(entry.ctx.storage.alarm,board.room.jewelsBotAt);board.room.jewelsBotAt=Date.now()-1;await board.alarm();assert.deepEqual(board.room.state.players.map(p=>p.used),[0,1]);assert.equal(board.room.turnDeadline,end);
 board.room.state.endsAt=Date.now()-1;board.room.turnDeadline=board.room.state.endsAt;await board.alarm();assert.equal(board.room.status,'finished');assert.equal(board.room.state.finished,true);assert.deepEqual(board.room.state.players.map(p=>p.used),[0,1]);assert.equal(board.room.jewelsBotAt,null);
});
test('disconnecting a player leaves the common deadline intact',async()=>{const{board,sockets}=await setup(),end=board.room.state.endsAt;await board.webSocketClose(sockets[0].ws);assert.equal(board.room.turnDeadline,end);});
test('a tied online room records both accounts without losses',async()=>{
 const{env,board,sockets}=await setup(),accounts=[await signup(env,'drawera'),await signup(env,'drawerb')];sockets.forEach((s,i)=>{board.room.players[s.player.id].username=i?'drawerb':'drawera';});board.room.state=createJewelsRace(['أ','ب'],{seed:713,moves:1});board.room.turnDeadline=board.room.state.endsAt;await play(board,sockets[0],0);await play(board,sockets[1],1);assert.equal(board.room.state.winner,-1);assert.equal(board.room.rewardsComplete,true);
 for(const account of accounts){const r=await api(env,'/api/social/career',undefined,account.data.token);assert.equal(r.data.career.games,1);assert.equal(r.data.career.losses,0);assert.equal(r.data.career.rankedLosses,0);}
});
