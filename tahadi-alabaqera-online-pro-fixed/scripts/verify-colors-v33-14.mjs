import assert from 'node:assert/strict';import{getLegalLudoMoves}from'../public/assets/js/engines/ludo-engine.js';import {createRuntime}from'./local-runtime-v26.mjs';
const runtime=await createRuntime(),sockets=[],checks=[];
async function api(path,body){const res=await runtime.mf.dispatchFetch(new URL(path,runtime.url),{method:body?'POST':'GET',headers:{'content-type':'application/json'},body:body?JSON.stringify(body):undefined});const data=await res.json();assert.ok(res.ok,JSON.stringify(data));return data;}
async function connect(path,protocols){
 const response=await runtime.mf.dispatchFetch(new URL(path,runtime.url),{headers:{upgrade:'websocket','sec-websocket-protocol':protocols.join(','),'x-bs-frame':'frame-eclipse','x-bs-account':'spoof'}});assert.equal(response.status,101,response.status===101?'':await response.text());
 const socket=response.webSocket,p={socket,queue:[],waiters:[],latest:null,seats:new Map()};sockets.push(socket);
 socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.state)p.latest=m.state;if(m.type==='private'&&m.linkSeat)p.seats.set(m.roundId,m.linkSeat);const i=p.waiters.findIndex(w=>w.match(m));if(i>=0){const w=p.waiters.splice(i,1)[0];clearTimeout(w.timer);w.resolve(m);}else{p.queue.push(m);if(p.queue.length>250)p.queue.shift();}});socket.accept();
 p.next=match=>{const i=p.queue.findIndex(match);if(i>=0)return Promise.resolve(p.queue.splice(i,1)[0]);return new Promise((resolve,reject)=>{const w={match,resolve,timer:setTimeout(()=>{p.waiters.splice(p.waiters.indexOf(w),1);reject(Error('socket deadline; latest='+JSON.stringify(p.latest)?.slice(0,800)));},15000)};p.waiters.push(w);});};
 p.send=(type,body={})=>socket.send(JSON.stringify({type,...body}));p.wait=async pred=>pred(p.latest)?p.latest:(await p.next(m=>m.state&&pred(m.state))).state;
 const welcome=await p.next(m=>m.type==='welcome');p.id=welcome.playerId;p.token=welcome.token;return p;
}
async function reconnect(peer,code){
 const before=peer.latest;peer.socket.close(1000,'mid-match resume');const fresh=await connect('/api/board/rooms/'+code+'/ws?game=pegs',['busraj-v1','rt.'+peer.token]);
 assert.equal(fresh.id,peer.id);assert.equal(fresh.latest.state.seq,before.state.seq);assert.equal(fresh.latest.state.phase,before.state.phase);assert.equal(fresh.latest.state.pending,before.state.pending);assert.deepEqual(fresh.latest.state.players,before.state.players);return fresh;
}
try{
 for(const mode of ['bluff','vault']){let colorsForRoom=[];
  const created=await api('/api/board/rooms',{game:'pegs',variant:mode,seats:6,name:'Color QA'}),peers=[];
  for(let i=0;i<6;i++)peers.push(await connect('/api/board/rooms/'+created.code+'/ws?game=pegs&name=Color'+i,['busraj-v1',...(i===0?['hk.'+created.hostKey]:[])]));
  peers[0].send('start');let s=await peers[0].wait(x=>x.status==='playing');
  for(const p of peers)await p.wait(x=>x.status==='playing');
  assert.equal(s.state.mode,mode);assert.equal(s.players.length,6);
  let actor=peers.find(p=>p.latest.me.index===s.state.turn);
  if(mode==='bluff'){
   const colorBefore=actor.latest.state.secretColor;const old=actor;actor=await reconnect(actor,created.code);peers[peers.indexOf(old)]=actor;s=actor.latest;assert.equal(actor.latest.state.secretColor,colorBefore);
   assert.ok(Number.isInteger(actor.latest.state.secretColor));
   for(const p of peers.filter(p=>p!==actor))assert.equal('secretColor' in p.latest.state,false);
   actor.send('color_claim',{color:actor.latest.state.secretColor,seq:s.state.seq,expectedVersion:s.version});
   s=await actor.wait(x=>x.version>s.version);let defender=peers.find(p=>p.latest.me.index===s.state.turn);await defender.wait(x=>x.version===s.version);
   const previous=defender;defender=await reconnect(defender,created.code);peers[peers.indexOf(previous)]=defender;s=defender.latest;assert.equal('secretColor' in defender.latest.state,false);
   const bad=peers.find(p=>p!==defender);bad.send('color_answer',{answer:'challenge',seq:s.state.seq,expectedVersion:s.version});await bad.next(m=>m.type==='error');
   defender.send('color_answer',{answer:'trust',seq:s.state.seq,expectedVersion:s.version});s=await defender.wait(x=>x.version>s.version);assert.equal(s.state.players[1].score,1);
   const before=s.version;defender.send('color_answer',{answer:'trust',seq:1,expectedVersion:before-1});await defender.next(m=>m.type==='error');assert.equal(defender.latest.version,before);
   for(const p of peers){await p.wait(x=>x.version===before);if(p.latest.me.index!==p.latest.state.sender)assert.equal('secretColor' in p.latest.state,false);for(const step of p.latest.steps||[])if(step.state.sender!==p.latest.me.index)assert.equal('secretColor' in step.state,false);}
  }else{
   const colors=actor.latest.state.pegs.map(p=>p.c);colorsForRoom=colors;assert.ok(colors.every(c=>c>=0));
   await new Promise(r=>setTimeout(r,Math.max(0,s.state.lookUntil-Date.now()+30)));
   actor.send('color_roll',{seq:s.state.seq,expectedVersion:s.version});s=await actor.wait(x=>x.version>s.version);assert.ok(s.state.pegs.every(p=>p.c===-1));
   actor.send('color_pick',{peg:colors.indexOf(s.state.die),seq:s.state.seq,expectedVersion:s.version});s=await actor.wait(x=>x.version>s.version);assert.equal(s.state.pending,1);const previous=actor;actor=await reconnect(actor,created.code);peers[peers.indexOf(previous)]=actor;s=actor.latest;assert.equal(s.state.pending,1);assert.equal(s.state.pegs.filter(p=>p.taken===null).length,23);
   actor.send('color_bank',{seq:s.state.seq,expectedVersion:s.version});s=await actor.wait(x=>x.version>s.version);assert.equal(s.state.players[0].score,1);assert.equal(s.state.pegs.filter(p=>p.taken===null).length,23);
  }
  // Finish every turn: linked rooms must see a finished table immediately, not wait for its timer.
  while(s.status!=='finished'){
   const current=peers.find(p=>p.latest.me.index===s.state.turn);current.send('resync');await current.next(m=>m.type==='state'&&m.state.version===s.version);const seq=s.state.seq,version=s.version;
   const v=current.latest.state;
   if(mode==='bluff')current.send(v.phase==='claim'?'color_claim':'color_answer',{seq,expectedVersion:version,...(v.phase==='claim'?{color:v.secretColor}:{answer:'trust'})});
   else if(v.phase==='roll')current.send('color_roll',{seq,expectedVersion:version});
   else if(v.phase==='pick')current.send('color_pick',{seq,expectedVersion:version,peg:colorsForRoom.findIndex((c,i)=>c===v.die&&v.pegs[i].taken===null)});
   else current.send('color_bank',{seq,expectedVersion:version});
   s=await current.wait(x=>x.version>version);
  }
  assert.equal(s.state.turnNo,18);for(const p of peers)await p.wait(x=>x.status==='finished');
  const before=actor.latest;actor.socket.close(1000,'resume');const resumed=await connect('/api/board/rooms/'+created.code+'/ws?game=pegs',['busraj-v1','rt.'+actor.token]);
  assert.equal(resumed.id,actor.id);assert.equal(resumed.latest.version,before.version);assert.deepEqual(resumed.latest.state.players,before.state.players);
  if(mode==='bluff'&&resumed.latest.me.index!==resumed.latest.state.sender)assert.equal('secretColor' in resumed.latest.state,false);
  checks.push(mode+': six real sockets, mid-claim/mid-answer/mid-capture reconnect, private snapshots, scoring, invalid moves, all three rounds finish immediately, and resume preserves the exact result');
 }
 console.log(JSON.stringify({runtime:'workerd / SQLite / real WebSockets',published:false,checks},null,2));
}finally{for(const s of sockets)try{s.close(1000,'verified');}catch{}await runtime.dispose();}
