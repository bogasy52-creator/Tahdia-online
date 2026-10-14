import test from 'node:test';
import assert from 'node:assert/strict';
import {environment,api} from './worker-harness.mjs';
import {createEnhancedGame} from '../public/assets/js/engines/snakes-adventure.js';

async function makeBoard(variant='adventure'){
 const env=environment();
 const res=await api(env,'/api/board/rooms',{game:'snakes',name:'A',playerLimit:2,variant});
 assert.equal(res.response.status,200);
 const entry=env.BOARD_ROOMS.peek(res.data.code);await entry.ctx.ready;
 const board=entry.instance;
 const a=board.addPlayer('A','host'),b=board.addPlayer('B','guest');a.ready=b.ready=true;
 const errors=[];
 const socket=p=>({deserializeAttachment:()=>({playerId:p.id}),send:s=>errors.push(JSON.parse(s))});
 await board.startGame();
 return {env,board,entry,a,b,errors,socket,res};
}

test('an owned board character is shared with peers and changing it resets readiness',async()=>{
 const h=await makeBoard('classic');h.board.room.status='lobby';h.a.ready=true;
 await h.board.webSocketMessage(h.socket(h.a),JSON.stringify({type:'character',character:'astronaut'}));
 assert.equal(h.board.publicState(h.b.id).players[0].character,'fox');assert.equal(h.a.ready,true,'a locked character cannot change readiness or appearance');
 h.a.allowedCharacters=['fox','astronaut'];
 await h.board.webSocketMessage(h.socket(h.a),JSON.stringify({type:'character',character:'astronaut'}));
 assert.equal(h.board.publicState(h.b.id).players[0].character,'astronaut');assert.equal(h.a.ready,false);
 const version=h.board.room.version;
 await h.board.webSocketMessage(h.socket(h.a),JSON.stringify({type:'character',character:'../../forged'}));
 assert.equal(h.board.publicState(h.b.id).players[0].character,'astronaut');assert.equal(h.board.room.version,version);
 h.board.room.status='playing';await h.board.webSocketMessage(h.socket(h.a),JSON.stringify({type:'character',character:'cat'}));
 assert.equal(h.board.publicState(h.b.id).players[0].character,'astronaut');
});
test('a stale client character cannot override the character equipped in the account',async(t)=>{
 const originalPair=globalThis.WebSocketPair,OriginalResponse=globalThis.Response;
 globalThis.WebSocketPair=class{constructor(){for(let i=0;i<2;i++)this[i]={send(){},serializeAttachment(v){this.attachment=v},deserializeAttachment(){return this.attachment},close(){}};}};
 globalThis.Response=class extends OriginalResponse{constructor(body,init){if(init?.status===101){super(null,{status:200,headers:init.headers});Object.defineProperty(this,'status',{value:101});this.webSocket=init.webSocket;}else super(body,init);}};
 t.after(()=>{globalThis.WebSocketPair=originalPair;globalThis.Response=OriginalResponse;});
 const h=await makeBoard('classic');h.board.room.status='lobby';
 const response=await h.board.fetch(new Request('https://board.internal/ws?character=fox&name=A',{headers:{upgrade:'websocket','sec-websocket-protocol':'busraj-v1, rt.'+h.a.token,'x-bs-character':'princess','x-bs-characters':'["fox","princess"]'}}));
 assert.equal(response.status,101);assert.equal(h.board.publicState(h.a.id).players[0].character,'princess');
});

test('creating an enhanced room keeps its rules in the API, lobby and initialized game',async()=>{
 const h=await makeBoard();
 assert.equal(h.res.data.variant,'adventure');
 assert.equal(h.board.publicState(h.a.id).variant,'adventure');
 assert.equal(h.board.room.state.rulesVersion,2);
 assert.deepEqual(h.board.room.state.bonusCells,[12,46,82]);
 const status=await api(h.env,`/api/board/rooms/${h.res.data.code}/status`);
 assert.equal(status.data.variant,'adventure');
});

test('rooms reject an unknown ruleset and preserve classic as the default',async()=>{
 const env=environment();
 const invalid=await api(env,'/api/board/rooms',{game:'snakes',variant:'forged'});
 assert.equal(invalid.response.status,400);
 const normal=await api(env,'/api/board/rooms',{game:'snakes',name:'A'});
 assert.equal(normal.data.variant,'classic');
 const h=await makeBoard('classic');
 assert.equal(h.board.room.state.entrySix,true);
 assert.equal(h.board.room.state.rulesVersion,undefined);
});

test('the Worker owns both dice and rewards even when the client forges their values',async()=>{
 const h=await makeBoard();h.board.room.state=createEnhancedGame(['A','B']);h.board.room.state.players[0].position=10;
 const dice=[2,3];h.board.randomDie=()=>{assert.ok(dice.length);return dice.shift()};
 await h.board.webSocketMessage(h.socket(h.a),JSON.stringify({type:'roll',expectedVersion:h.board.room.version,roll:6,bonusRoll:1,event:'shield'}));
 assert.deepEqual(h.board.room.state.lastEvent.rolls,[2]);
 assert.equal(h.board.room.state.lastEvent.bonusRoll,3);
 assert.equal(h.board.room.state.players[0].double,1);
 assert.equal(h.board.room.state.players[0].shield,0);
 assert.equal(dice.length,0);
});

test('an earned double rolls two server dice, is spent once, and rejects replay',async()=>{
 const h=await makeBoard();h.board.room.state=createEnhancedGame(['A','B']);
 Object.assign(h.board.room.state.players[0],{position:13,double:1});
 const version=h.board.room.version,dice=[1,2];h.board.randomDie=()=>{assert.ok(dice.length);return dice.shift()};
 const message=JSON.stringify({type:'roll',expectedVersion:version,power:'double',rolls:[6,6]});
 await h.board.webSocketMessage(h.socket(h.a),message);
 assert.deepEqual(h.board.room.state.lastEvent.rolls,[1,2]);
 assert.equal(h.board.room.state.players[0].position,16);
 assert.equal(h.board.room.state.players[0].double,0);
 await h.board.webSocketMessage(h.socket(h.a),message);
 assert.equal(h.board.room.state.moveCount,1);
 assert.ok(h.errors.some(x=>x.type==='error'));
});

test('unearned powers and the wrong seat cannot change the online state',async()=>{
 const h=await makeBoard();h.board.room.state=createEnhancedGame(['A','B']);h.board.room.state.players[0].position=13;
 let calls=0;h.board.randomDie=()=>{calls++;return 1};
 for(const [player,power] of [[h.a,'double'],[h.a,'shield'],[h.b,null]]){
  await h.board.webSocketMessage(h.socket(player),JSON.stringify({type:'roll',expectedVersion:h.board.room.version,power}));
 }
 assert.equal(h.board.room.state.moveCount,0);
 assert.equal(calls,0);
 assert.equal(h.errors.filter(x=>x.type==='error').length,3);
});

test('online shields and timeout rewards use the same enhanced rules as local games',async()=>{
 const h=await makeBoard();h.board.room.state=createEnhancedGame(['A','B']);
 Object.assign(h.board.room.state.players[0],{position:16,shield:1});h.board.randomDie=()=>1;
 await h.board.webSocketMessage(h.socket(h.a),JSON.stringify({type:'roll',expectedVersion:h.board.room.version}));
 assert.equal(h.board.room.state.players[0].position,17);
 assert.equal(h.board.room.state.players[0].shield,0);
 assert.equal(h.board.room.state.lastEvent.protected,true);
 h.board.room.state=createEnhancedGame(['A','B']);h.board.room.state.players[0].position=10;
 const dice=[2,2];h.board.randomDie=()=>dice.shift();
 await h.board.handleTurnTimeout();
 assert.equal(h.board.room.state.lastEvent.bonusRoll,2);
 assert.equal(h.board.room.state.turn,0);
 assert.equal(h.board.room.state.players[0].bonusTurns,1);
 const saved=await h.entry.ctx.storage.get('room');
 assert.deepEqual(saved.state,h.board.room.state);
 const restored=new h.board.constructor(h.entry.ctx,h.env);await h.entry.ctx.ready;
 assert.equal(restored.publicState(h.a.id).variant,'adventure');
 assert.equal(restored.publicState(h.a.id).state.players[0].bonusTurns,1);
 await h.board.resetForRematch();
 assert.equal(h.board.room.variant,'adventure');
 await h.board.startGame();
 assert.equal(h.board.room.state.rulesVersion,2);
 assert.equal(h.board.room.state.players[0].bonusTurns,0);
});
