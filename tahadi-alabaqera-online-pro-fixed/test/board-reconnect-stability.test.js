import test from 'node:test';
import assert from 'node:assert/strict';
import {environment,api} from './worker-harness.mjs';

async function fixture(game='baloot'){
  const env=environment(),created=await api(env,'/api/board/rooms',{game});
  const entry=env.BOARD_ROOMS.peek(created.data.code);await entry.ctx.ready;
  const board=entry.instance,player=board.addPlayer('سعد','host');
  return {board,player,ctx:entry.ctx};
}
function socket(f,readyState=2){
  return {readyState,closes:[],deserializeAttachment:()=>({playerId:f.player.id}),
    close(code,reason){this.closes.push({code,reason});this.readyState=3;f.ctx.sockets=f.ctx.sockets.filter(s=>s!==this);},send(){}};
}
test('a board server completes the peer close handshake so the client can reconnect',async()=>{
  const f=await fixture(),ws=socket(f);f.ctx.sockets=[ws];
  await f.board.webSocketClose(ws,4000,'reconnect');
  assert.deepEqual(ws.closes,[{code:4000,reason:'reconnect'}]);
});
test('a replaced socket cannot mark its already-reconnected player away or shorten the turn',async()=>{
  const f=await fixture('snakes'),old=socket(f),current=socket(f,1);f.ctx.sockets=[old,current];
  f.board.room.status='playing';f.board.room.state={turn:0};f.board.room.turnDeadline=Date.now()+60000;
  const deadline=f.board.room.turnDeadline;f.player.connected=true;f.player.disconnectedAt=null;
  await f.board.webSocketClose(old,4001,'reconnected');
  assert.equal(f.player.connected,true);assert.equal(f.player.disconnectedAt,null);
  assert.equal(f.board.room.turnDeadline,deadline);
});
