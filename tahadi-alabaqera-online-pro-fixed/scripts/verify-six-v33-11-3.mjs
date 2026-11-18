import assert from 'node:assert/strict';import {getJackarooActions}from'../public/assets/js/engines/jackaroo-engine.js';import {createRuntime}from'./local-runtime-v26.mjs';
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
 const started=[];
 for(const game of ['zahra','jackaroo']){
  const room=await api('/api/board/rooms',{game,variant:'classic',seats:6,name:'QA six'}),peers=[];
  for(let i=0;i<6;i++)peers.push(await connect('/api/board/rooms/'+room.code+'/ws?game='+game+'&name=Six'+i,['busraj-v1',...(i===0?['hk.'+room.hostKey]:[])]));
  peers[0].send('start');let state=await peers[0].wait(s=>s.status==='playing');assert.equal(state.state.players.length,6);assert.equal(state.tableSeats,6);
  if(game==='jackaroo'){
   assert.equal(state.state.arm,19);assert.equal(state.state.home,'fill');
   for(let move=0;move<30;move++){
    const id=state.players.find(p=>p.index===state.state.turn).id,actor=peers.find(p=>p.id===id);actor.send('resync');const current=(await actor.next(m=>m.type==='state'&&m.state.version===state.version)).state;
    let choice;for(let card=0;card<current.state.hands[current.me.index].length;card++){const action=getJackarooActions(current.state,card,current.me.index)[0];if(action){choice={cardIndex:card,action};break;}}
    assert.ok(choice);actor.send('jackaroo_play',{expectedVersion:current.version,...choice});state=await actor.wait(s=>s.version>current.version);
    assert.ok(state.state.hands.flat().filter(c=>c!=='?').length<=5,'only own hand is visible');
   }
  }else{
   const actor=peers.find(p=>p.id===state.players.find(p=>p.index===state.state.turn).id);actor.send('roll',{expectedVersion:state.version});state=await actor.wait(s=>s.version>state.version);
  }
  const old=state.version,actor=peers.find(p=>p.id===state.players.find(p=>p.index===state.state.turn).id);actor.send('resync');await actor.next(m=>m.type==='state'&&m.state.version===old);
  actor.send(game==='zahra'?'roll':'jackaroo_play',{expectedVersion:old-1,cardIndex:0,action:{type:'enter',owner:0,marble:0}});await actor.next(m=>m.type==='error');assert.equal(actor.latest.version,old);
  const before=JSON.stringify(actor.latest.state.players);actor.socket.close(1000,'resume QA');
  const resumed=await connect('/api/board/rooms/'+room.code+'/ws?game='+game,['busraj-v1','rt.'+actor.token]);
  assert.equal(resumed.latest.version,old);assert.equal(JSON.stringify(resumed.latest.state.players),before);assert.equal(resumed.id,actor.id);
  checks.push(game+': six real sockets, legal moves, private hand, stale command rejected, and same seat/board after reconnection');started.push(room.code);
 }
 const dice=await api('/api/board/rooms',{game:'dice',variant:'classic',name:'Dice QA'}),peers=[];
 for(let i=0;i<2;i++)peers.push(await connect('/api/board/rooms/'+dice.code+'/ws?game=dice&name=Dice'+i,['busraj-v1',...(i===0?['hk.'+dice.hostKey]:[])]));
 peers[0].send('start');let state=await peers[0].wait(s=>s.status==='playing'),turn=state.state.turn,old=state.version;
 const wrong=peers.find(p=>p.id!==state.players.find(p=>p.index===turn).id);wrong.send('dice_roll',{expectedVersion:old});await wrong.next(m=>m.type==='error');
 const right=peers.find(p=>p.id===state.players.find(p=>p.index===turn).id);right.send('dice_roll',{expectedVersion:old});state=await right.wait(s=>s.version>old);const version=state.version;
 right.send('dice_roll',{expectedVersion:old});await right.next(m=>m.type==='error');assert.equal(right.latest.version,version);
 checks.push('Dice: real roll accepted once, out-of-turn and duplicate-version commands rejected');
 const group=await api('/api/party/rooms',{capacity:20,playlist:[{game:'zahra',mode:'quick'},{game:'jackaroo',mode:'quick'}]}),friends=[];
 for(let i=0;i<3;i++)friends.push(await connect('/api/party/rooms/'+group.code+'/ws?name=Group'+i,['tahdia-party-v29',...(i===0?['hk.'+group.hostKey]:[])]));
 for(const p of friends)p.send('ready',{ready:true});await friends[0].wait(s=>s.players.length===3&&s.players.every(p=>p.ready));await new Promise(r=>setTimeout(r,45));friends[0].send('start');
 for(const game of ['zahra','jackaroo']){
  const party=await friends[0].wait(s=>s.status==='playing'&&s.round?.game===(game==='zahra'?'ludo':game)&&s.round.link?.status==='open'),child=party.round.link.list[0],players=[];
  for(let i=0;i<3;i++)players.push(await connect('/api/board/rooms/'+child.code+'/ws?game='+game+'&name=Group'+i,['busraj-v1']));
  const table=await players[0].wait(s=>s.status==='playing');assert.equal(table.state.players.length,6);assert.equal(table.state.quick,true);assert.equal(table.players.filter(p=>p.bot).length,3);
  checks.push('Party '+game+': three people start their selected quick mode on six seats, with three bots');
  if(game==='zahra')friends[0].send('skip');
 }
 console.log(JSON.stringify({runtime:'workerd / SQLite / real WebSockets',published:false,checks},null,2));
}finally{for(const s of sockets)try{s.close(1000,'verified');}catch{}await runtime.dispose();}
