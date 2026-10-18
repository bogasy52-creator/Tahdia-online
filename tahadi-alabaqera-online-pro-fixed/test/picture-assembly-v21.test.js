import test from 'node:test';
import assert from 'node:assert/strict';
import {ImageRoom} from '../src/images/image-room.js';
import {createImageAssembly,placeImageTile,validImageAssembly,imageProgress,imageCellAtPoint,ASSEMBLY_MODE} from '../public/assets/js/engines/image-puzzle.js';
test('600 assembly puzzles start empty with every piece outside and solve only by correct placement',()=>{
 for(const size of [3,4,5])for(let seed=1;seed<=200;seed++){
  const puzzle=createImageAssembly(size,seed);let board=puzzle.board;assert.equal(imageProgress(board),0);assert.ok(validImageAssembly(board,puzzle.tray));assert.deepEqual(puzzle,createImageAssembly(size,seed));
  assert.throws(()=>placeImageTile(board,0,1),/wrong_slot/);assert.equal(imageProgress(board),0);
  for(const piece of puzzle.tray){const previous=board;board=placeImageTile(board,piece,piece);assert.notEqual(board,previous);assert.throws(()=>placeImageTile(board,piece,piece),/already_placed/);}
  assert.equal(imageProgress(board),size*size);assert.ok(validImageAssembly(board,puzzle.tray));
 }
 const p=createImageAssembly(3,1);assert.throws(()=>placeImageTile(p.board,'1',1));assert.throws(()=>placeImageTile(p.board,1,-1));assert.equal(validImageAssembly([1,...p.board.slice(1)],p.tray),false);assert.equal(validImageAssembly(p.board,p.tray.map(()=>0)),false);
});
test('touch coordinates identify every slot at phone, tablet and desktop widths without edge clamping',()=>{
 for(const viewport of [320,360,375,390,414,430,600,768,1024,1440])for(const size of [3,4,5]){
  const width=Math.min(700,viewport-24),rect={left:(viewport-width)/2,top:126,width,height:width};
  for(let cell=0;cell<size*size;cell++)assert.equal(imageCellAtPoint(rect,rect.left+(cell%size+.5)*width/size,rect.top+(Math.floor(cell/size)+.5)*width/size,size),cell);
  assert.equal(imageCellAtPoint(rect,rect.left-1,rect.top,size),-1);assert.equal(imageCellAtPoint(rect,rect.left+width,rect.top,size),-1);assert.equal(imageCellAtPoint(rect,rect.left,rect.top+width,size),-1);
 }
 assert.equal(imageCellAtPoint({left:0,top:0,width:0,height:0},0,0,4),-1);
});
async function roomFixture(){
 const map=new Map(),sockets=[],awards=[];const ctx={storage:{async get(k){return structuredClone(map.get(k))},async put(k,v){map.set(k,structuredClone(v))},async setAlarm(){},async delete(){}},getWebSockets:()=>sockets,blockConcurrencyWhile:fn=>Promise.resolve().then(fn)};
 const env={BOARD_ROOMS:{idFromName:v=>v,get:()=>({fetch:async(_url,init)=>{awards.push(JSON.parse(init.body));return Response.json({ok:true});}})}};
 const room=new ImageRoom(ctx,env);await room.ready;await room.fetch(new Request('https://picture.internal/init',{method:'POST',body:JSON.stringify({code:'123456',hostKey:'secret'})}));
 for(const [id,role] of [['a','host'],['b','guest']]){room.room.order.push(id);room.room.players[id]={id,role,name:id,username:'player_'+id,connection:id,token:'token-'+id,connected:true,ready:true,assembly:true};sockets.push({messages:[],deserializeAttachment:()=>({picture:true,playerId:id,connection:id}),send(raw){this.messages.push(JSON.parse(raw));}});}
 return {room,ctx,sockets,awards};
}
const send=(room,ws,m)=>room.webSocketMessage(ws,JSON.stringify(m));
test('server assembly validates each piece, sequence and round, restores progress and awards once',async()=>{
 const {room,ctx,sockets,awards}=await roomFixture(),ws=sockets[0];await send(room,ws,{type:'start'});const r=room.room,p=r.players.a;
 assert.equal(r.puzzleMode,ASSEMBLY_MODE);assert.equal(imageProgress(p.board),0);assert.deepEqual(p.tray,r.players.b.tray);assert.equal(room.snapshot('a').players[1].board,undefined);assert.equal(room.snapshot('a').players[1].tray,undefined);
 await send(room,ws,{type:'place',piece:0,cell:0,seq:1,round:1});assert.equal(p.seq,0);r.startsAt=Date.now()-11000;r.deadline=Date.now()+120000;
 for(const m of [{type:'swap',a:0,b:1,seq:1,round:1},{type:'place',piece:0,cell:1,seq:1,round:1},{type:'place',piece:0,cell:0,seq:'1',round:1},{type:'place',piece:0,cell:0,seq:1,round:0}]){await send(room,ws,m);assert.equal(p.seq,0);}
 await send(room,ws,{type:'place',piece:0,cell:0,seq:1,round:1});assert.equal(imageProgress(p.board),1);assert.equal(p.seq,1);
 await send(room,ws,{type:'place',piece:0,cell:0,seq:1,round:1});assert.equal(p.seq,1);await send(room,ws,{type:'place',piece:0,cell:0,seq:2,round:1});assert.equal(p.seq,1);
 const restored=new ImageRoom(ctx,room.env);await restored.ready;assert.deepEqual(restored.snapshot('a').me.board,p.board);assert.deepEqual(restored.snapshot('a').me.tray,p.tray);
 for(let piece=1;piece<16;piece++)await send(room,ws,{type:'place',piece,cell:piece,seq:p.seq+1,round:1,board:Array(16).fill(0),winnerId:'b',score:999});
 assert.equal(r.status,'finished');assert.equal(r.winnerId,'a');assert.equal(r.rewardsComplete,true);assert.equal(awards.length,2);assert.equal(awards[0].win,true);assert.equal(awards[1].win,false);await room.rewards();assert.equal(awards.length,2);
});
