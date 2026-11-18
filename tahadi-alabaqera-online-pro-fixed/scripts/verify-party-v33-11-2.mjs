import assert from 'node:assert/strict';import {createRuntime}from'./local-runtime-v26.mjs';
const runtime=await createRuntime(),sockets=[],checks=[];
async function api(path,body){const res=await runtime.mf.dispatchFetch(new URL(path,runtime.url),{method:body?'POST':'GET',headers:{'content-type':'application/json'},body:body?JSON.stringify(body):undefined});const data=await res.json();assert.ok(res.ok,JSON.stringify(data));return data;}
async function connect(path,protocols){
 const response=await runtime.mf.dispatchFetch(new URL(path,runtime.url),{headers:{upgrade:'websocket','sec-websocket-protocol':protocols.join(',')}});assert.equal(response.status,101,response.status===101?'':await response.text());
 const socket=response.webSocket,p={socket,queue:[],waiters:[],latest:null,seats:new Map()};sockets.push(socket);
 socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.state)p.latest=m.state;if(m.type==='private'&&m.linkSeat)p.seats.set(m.roundId,m.linkSeat);const i=p.waiters.findIndex(w=>w.match(m));if(i>=0){const w=p.waiters.splice(i,1)[0];clearTimeout(w.timer);w.resolve(m);}else{p.queue.push(m);if(p.queue.length>250)p.queue.shift();}});socket.accept();
 p.next=match=>{const i=p.queue.findIndex(match);if(i>=0)return Promise.resolve(p.queue.splice(i,1)[0]);return new Promise((resolve,reject)=>{const w={match,resolve,timer:setTimeout(()=>{p.waiters.splice(p.waiters.indexOf(w),1);reject(Error('socket deadline; latest='+JSON.stringify(p.latest)?.slice(0,800)));},15000)};p.waiters.push(w);});};
 p.send=(type,body={})=>socket.send(JSON.stringify({type,...body}));p.wait=async pred=>pred(p.latest)?p.latest:(await p.next(m=>m.state&&pred(m.state))).state;
 const welcome=await p.next(m=>m.type==='welcome');p.id=welcome.playerId;p.token=welcome.token;return p;
}
try{
 const playlist=[{game:'memory',mode:'sequence',memoryTheme:'space',duration:180},{game:'pegs',mode:'race-large'},{game:'chaos',mode:'quick'},{game:'jewels',mode:'classic'}],room=await api('/api/party/rooms',{capacity:20,playlist}),peers=[];
 for(let i=0;i<20;i++)peers.push(await connect('/api/party/rooms/'+room.code+'/ws?name=RoomTester'+i,['tahdia-party-v29',...(i===0?['hk.'+room.hostKey]:[])]));
 for(const p of peers)p.send('ready',{ready:true});await peers[0].wait(s=>s.players.length===20&&s.players.every(p=>p.ready));await new Promise(r=>setTimeout(r,45));peers[0].send('start');
 const memory=await peers[0].wait(s=>s.status==='playing'&&s.round?.game==='memory');assert.equal(memory.round.local.mode,'sequence');assert.equal(memory.round.local.theme,'space');
 for(const p of peers)p.send('action',{sessionId:memory.sessionId,roundId:memory.round.id,seq:1,action:{report:{progress:1,score:10000,done:true,won:true}}});
 const between=await peers[0].wait(s=>s.status==='intermission');assert.equal(between.history.at(-1).rows.length,20);assert.ok(between.nextAt<memory.round.deadline-100000);
 checks.push('20 real party sockets preserve memory mode/theme and all final reports advance before the round timer expires');
 const pegs=await peers[0].wait(s=>s.status==='playing'&&s.round?.game==='pegs'&&s.round.link?.status==='open');assert.equal(pegs.round.settings.mode,'race-large');assert.equal(pegs.round.link.tables,4);
 const boardPeers=[];
 for(const p of peers){const table=pegs.round.link.list.find(t=>t.players.includes(p.id));const child=await connect('/api/board/rooms/'+table.code+'/ws?game=pegs&name='+memory.players.find(x=>x.id===p.id).name,['busraj-v1']);boardPeers.push(child);assert.equal(child.latest.variant,'race-large');}
 for(const child of boardPeers){const s=await child.wait(s=>s.status==='playing');assert.equal(s.state.mode,'race');assert.equal(s.state.pegs.length,48);}
 checks.push('The next game opens four actual large memory-race tables for all 20 people, with the selected mode and 48 pieces');
 peers[0].send('skip');const uno=await peers[0].wait(s=>s.status==='playing'&&s.round?.game==='chaos'&&s.round.link?.status==='open');assert.equal(uno.round.link.tables,3);assert.equal(uno.round.settings.mode,'quick');
 const unoPeers=[];
 for(const p of peers){if(!p.seats.has(uno.round.id))await p.next(m=>m.type==='private'&&m.roundId===uno.round.id&&m.linkSeat);const table=uno.round.link.list.find(t=>t.players.includes(p.id));const child=await connect('/api/challenges/rooms/'+table.code+'/ws',['tahdia-challenge-v1','rt.'+p.seats.get(uno.round.id)]);unoPeers.push(child);assert.equal(child.latest.unoMode,'quick');}
 for(const child of unoPeers){const s=await child.wait(s=>s.status==='playing');assert.ok(s.players.length<=8);assert.equal(s.match.uno.hand.length,5);assert.equal(s.match.uno.hands,undefined);}
 checks.push('All 20 players enter three reserved UNO tables (7/7/6), quick mode deals five private cards, and no room overflows');
 peers[0].send('skip');const jewels=await peers[0].wait(s=>s.status==='playing'&&s.round?.game==='jewels'&&s.round.link?.status==='open');assert.equal(jewels.round.link.page,'/jewels');assert.equal(jewels.round.link.tables,10);
 const table=jewels.round.link.list[0],pair=[];for(const id of table.players){const name=memory.players.find(p=>p.id===id).name;pair.push(await connect('/api/board/rooms/'+table.code+'/ws?game=jewels&name='+name,['busraj-v1']));}
 const actual=await pair[0].wait(s=>s.status==='playing');assert.equal(actual.state.game,'jewels');assert.ok(actual.state.players.length===2);assert.equal(jewels.round.local,undefined);
 checks.push('Master Jewels opens ten real duel rooms at /jewels, including a live two-player game, rather than the old journey puzzle');
 console.log(JSON.stringify({runtime:'workerd / SQLite / real WebSockets',published:false,checks},null,2));
}finally{for(const s of sockets)try{s.close(1000,'verified');}catch{}await runtime.dispose();}
