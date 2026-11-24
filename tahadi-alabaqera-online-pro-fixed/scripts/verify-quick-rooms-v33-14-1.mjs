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
 for(const [game,mode,seats]of [['ludo','ludo-quick',4],['ludo','ludo',6],['jackaroo','quick',4],['pegs','teams',6],['dice','classic',5]]){
  const group=await api('/api/party/rooms',{capacity:seats,playlist:[{game,mode,seats}]}),friends=[];
  for(let i=0;i<2;i++)friends.push(await connect('/api/party/rooms/'+group.code+'/ws?name=Quick'+i,['tahdia-party-v29',...(i===0?['hk.'+group.hostKey]:[])]));
  for(const p of friends)p.send('ready',{ready:true});await friends[0].wait(s=>s.players.length===2&&s.players.every(p=>p.ready));
  await new Promise(r=>setTimeout(r,80));friends[0].send('start');const round=await friends[0].wait(s=>s.status==='playing'&&s.round?.link?.status==='open');
  assert.equal(round.capacity,seats);assert.equal(round.playlist[0].mode,mode);assert.equal(round.playlist[0].seats,seats);
  const child=round.round.link.list[0],players=[],family=game==='ludo'?'zahra':game;
  for(let i=0;i<2;i++)players.push(await connect('/api/board/rooms/'+child.code+'/ws?game='+family+'&name=Quick'+i,['busraj-v1']));
  const actual=await players[0].wait(s=>s.status==='playing');assert.equal(actual.variant,mode);assert.equal(actual.state.players.length,seats);assert.equal(actual.players.filter(p=>p.bot).length,seats-2);assert.equal(actual.tableSeats,seats);
  if(game==='ludo'||game==='jackaroo')assert.equal(Boolean(actual.state.quick),mode.includes('quick'));if(game==='pegs')assert.equal(actual.state.teams,true);
  checks.push(game+' / '+mode+': chosen '+seats+' seats survive parent room, child initialization and match start');
 }
 console.log(JSON.stringify({runtime:'workerd / SQLite / real WebSockets',published:false,checks},null,2));
}finally{for(const socket of sockets)try{socket.close(1000,'verified');}catch{}await runtime.dispose();}
