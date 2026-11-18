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
try{
 const room=await api('/api/board/rooms',{game:'zahra',variant:'ludo',seats:6,name:'Classic Six QA'}),peers=[];
 for(let i=0;i<6;i++)peers.push(await connect('/api/board/rooms/'+room.code+'/ws?game=zahra&name=Ludo'+i+'&dice=dice-eclipse&frame=frame-eclipse',['busraj-v1',...(i===0?['hk.'+room.hostKey]:[])]));
 peers[0].send('start');let state=await peers[0].wait(s=>s.status==='playing');assert.equal(state.state.players.length,6);assert.equal(state.state.layout,'classic');assert.equal(state.tableSeats,6);
 assert.ok(state.players.every(p=>p.look.frame!=='frame-eclipse'&&p.look.dice!=='dice-eclipse'),'a guest cannot equip paid items through URL parameters');
 for(let move=0;move<45;move++){
  const actor=peers.find(p=>p.id===state.players.find(p=>p.index===state.state.turn).id);actor.send('resync');const current=(await actor.next(m=>m.type==='state'&&m.state.version===state.version)).state;
  const pending=current.pendingRoll;if(pending){const legal=getLegalLudoMoves(current.state,pending);assert.ok(legal.length);actor.send('ludo_move',{expectedVersion:current.version,token:legal[0]});}else actor.send('roll',{expectedVersion:current.version});
  state=await actor.wait(s=>s.version>current.version);assert.equal(state.state.layout,'classic');assert.equal(state.state.players.length,6);
 }
 const actor=peers.find(p=>p.id===state.players.find(p=>p.index===state.state.turn).id);actor.send('resync');const before=(await actor.next(m=>m.type==='state'&&m.state.version===state.version)).state;
 actor.send('roll',{expectedVersion:before.version-1});await actor.next(m=>m.type==='error');assert.equal(actor.latest.version,before.version);
 actor.socket.close(1000,'resume test');const resumed=await connect('/api/board/rooms/'+room.code+'/ws?game=zahra',['busraj-v1','rt.'+actor.token]);assert.equal(resumed.id,actor.id);assert.equal(resumed.latest.version,before.version);assert.deepEqual(resumed.latest.state.players,before.state.players);
 checks.push('Six real sockets play 45 classic Ludo commands, preserve six-seat board on resume, reject stale commands and guest paid-cosmetic spoofing');
 const group=await api('/api/party/rooms',{capacity:20,playlist:[{game:'ludo',mode:'ludo-quick'}]}),friends=[];
 for(let i=0;i<3;i++)friends.push(await connect('/api/party/rooms/'+group.code+'/ws?name=ClassicFriend'+i,['tahdia-party-v29',...(i===0?['hk.'+group.hostKey]:[])]));
 for(const p of friends)p.send('ready',{ready:true});await friends[0].wait(s=>s.players.length===3&&s.players.every(p=>p.ready));await new Promise(r=>setTimeout(r,45));friends[0].send('start');
 const round=await friends[0].wait(s=>s.status==='playing'&&s.round?.game==='ludo'&&s.round.link?.status==='open');assert.equal(round.round.link.page,'/ludo');const table=round.round.link.list[0],children=[];
 for(let i=0;i<3;i++)children.push(await connect('/api/board/rooms/'+table.code+'/ws?game=zahra&name=ClassicFriend'+i,['busraj-v1']));
 const actual=await children[0].wait(s=>s.status==='playing');assert.equal(actual.state.layout,'classic');assert.equal(actual.state.players.length,6);assert.equal(actual.state.quick,true);assert.equal(actual.players.filter(p=>p.bot).length,3);
 checks.push('Party Ludo opens /ludo with six classic seats and the selected quick rules, filling three empty seats with bots');
 console.log(JSON.stringify({runtime:'workerd / SQLite / real WebSockets',published:false,checks},null,2));
}finally{for(const s of sockets)try{s.close(1000,'verified');}catch{}await runtime.dispose();}
