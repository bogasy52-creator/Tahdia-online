import assert from 'node:assert/strict';
import {createRuntime} from './local-runtime-v26.mjs';
const runtime=await createRuntime(),sockets=[],checks=[];
const pause=ms=>new Promise(r=>setTimeout(r,Math.max(0,ms)));
async function api(path,body,token){const response=await runtime.mf.dispatchFetch(new URL(path,runtime.url),{method:body?'POST':'GET',headers:{...(body?{'content-type':'application/json'}:{}),...(token?{authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});return {response,data:await response.json()};}
async function signup(username){const r=await api('/api/social/signup',{username,displayName:username,password:'Runtime-only-password123!'});assert.equal(r.response.status,201);return r.data.token;}
async function connect(code,{hostKey,token,resume}={}){
 const protocols=['busraj-v1',...(hostKey?['hk.'+hostKey]:[]),...(token?['st.'+token]:[]),...(resume?['rt.'+resume]:[])];
 const response=await runtime.mf.dispatchFetch(new URL('/api/board/rooms/'+code+'/ws?game=pegs',runtime.url),{headers:{Upgrade:'websocket','sec-websocket-protocol':protocols.join(',')}});assert.equal(response.status,101);
 const socket=response.webSocket,queue=[],waiters=[],peer={socket,latest:null};sockets.push(socket);
 socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.state)peer.latest=m.state;const i=waiters.findIndex(w=>w.match(m));if(i>=0){const w=waiters.splice(i,1)[0];clearTimeout(w.timer);w.resolve(m);}else queue.push(m);});socket.accept();
 peer.next=match=>{const i=queue.findIndex(match);if(i>=0)return Promise.resolve(queue.splice(i,1)[0]);return new Promise((resolve,reject)=>{const w={match,resolve,timer:setTimeout(()=>{waiters.splice(waiters.indexOf(w),1);reject(Error('pegs runtime socket deadline: '+JSON.stringify(peer.latest)));},10000)};waiters.push(w);});};
 const welcome=await peer.next(m=>m.type==='welcome');return Object.assign(peer,welcome);
}
async function create(variant,seats){const r=await api('/api/board/rooms',{game:'pegs',variant,seats,open:false,name:'فحص الذاكرة'});assert.equal(r.response.status,200);return r.data;}
async function start(peer){peer.socket.send(JSON.stringify({type:'start'}));return (await peer.next(m=>m.type==='state'&&m.state.status==='playing')).state;}
async function command(peer,type,more={}){
 const old=peer.latest,seq=old.state.seq;
 peer.socket.send(JSON.stringify({type,expectedVersion:old.version,seq,...more}));
 const m=await peer.next(m=>m.type==='error'||m.type==='state'&&m.state.state?.seq>seq);
 assert.notEqual(m.type,'error',m.error);return m.state;
}
try{
 const [alice,bob]=await Promise.all(['pegsalice','pegsbob'].map(signup));
 const room=await create('large',6),peers=[];
 for(let i=0;i<6;i++)peers.push(await connect(room.code,{...(i===0?{hostKey:room.hostKey,token:alice}:i===1?{token:bob}:{})}));
 let state=await start(peers[0]);assert.equal(state.state.pegs.length,48);assert.equal(state.players.length,6);
 const colors=state.state.pegs.map(p=>p.c);assert.ok(colors.every(c=>c>=0));
 await pause(state.state.lookUntil-Date.now()+40);
 const actor=peers[state.state.turn];state=await command(actor,'pegs_roll');const peg=colors.findIndex(c=>c===state.state.die);
 state=await command(actor,'pegs_pick',{peg});assert.equal(state.state.pegs[peg].taken,state.me.index);assert.equal(state.state.players[state.me.index].score,1);
 const seat=state.me.index;actor.socket.close(1000,'reconnect check');await pause(50);
 const resumed=await connect(room.code,{resume:actor.token,token:seat===0?alice:seat===1?bob:undefined});
 assert.equal(resumed.state.me.index,seat);assert.equal(resumed.state.state.pegs[peg].taken,seat);assert.equal(resumed.state.state.pegs.filter(p=>p.taken===null).length,47);assert.ok(resumed.state.state.pegs.filter(p=>p.taken===null).every(p=>p.c===-1));
 checks.push('Six real sockets: 48 pieces; capture survives disconnect with the same seat, score and hidden remaining colors');
 const race=await create('race',2),a=await connect(race.code,{hostKey:race.hostKey,token:alice});
 assert.equal((await api('/api/social/friends/request',{username:'pegsbob'},alice)).response.status,201);
 assert.equal((await api('/api/social/friends/respond',{username:'pegsalice',accept:true},bob)).response.status,200);
 const invitation=await api('/api/social/invites',{username:'pegsbob',game:'pegs',roomCode:race.code},alice);assert.equal(invitation.response.status,200);
 const inbox=await api('/api/social/me',undefined,bob);assert.ok(inbox.data.notifications.some(n=>n.game==='pegs'&&n.joinPath==='/pegs?room='+race.code));
 checks.push('A real memory invitation reaches the recipient account dashboard with its correct room link');
 const b=await connect(race.code,{token:bob});state=await start(a);await b.next(m=>m.type==='state'&&m.state.status==='playing');
 const layout=state.state.pegs.map(p=>p.c);await pause(state.state.lookUntil-Date.now()+40);
 const version=state.version;
 for(const p of [a,b])p.socket.send(JSON.stringify({type:'pegs_roll',seq:0,expectedVersion:version}));
 await a.next(m=>m.type==='state'&&m.state.state?.seq===1);await b.next(m=>m.type==='state'&&m.state.state?.seq===1);
 assert.equal(a.latest.state.die,b.latest.state.die);assert.equal(a.latest.state.runs,undefined);assert.equal(a.latest.state.order,undefined);
 const captured=new Set();
 for(let i=0;i<12;i++){
  if(i){await pause(a.latest.state.race.cooldownUntil-Date.now()+30);await command(a,'pegs_roll');}
  await pause(a.latest.state.race.cooldownUntil-Date.now()+30);
  const target=a.latest.state.die,index=layout.findIndex((c,j)=>c===target&&!captured.has(j));assert.ok(index>=0);captured.add(index);
  state=await command(a,'pegs_pick',{peg:index});
 }
 assert.equal(state.status,'finished');assert.equal(state.state.players[0].score,12);assert.equal(state.state.players[1].score,0);
 a.socket.close(1000,'finished reconnect');await pause(30);const final=await connect(race.code,{resume:a.token,token:alice});assert.equal(final.state.state.players[0].score,12);assert.equal(final.state.state.pegs.filter(p=>p.taken===null).length,12);
 checks.push('Both racers roll against the same room version; private boards progress independently and 12 captures finish once, including reconnect');
 const teams=await create('teams',6),teamPeers=[];for(let i=0;i<6;i++)teamPeers.push(await connect(teams.code,i===0?{hostKey:teams.hostKey}:{}));
 const team=await start(teamPeers[0]);assert.equal(team.state.teams,true);assert.equal(team.state.pegs.length,48);assert.equal(team.players.length,6);
 checks.push('A six-person team table starts with all 48 pieces and no bot seats');
 console.log(JSON.stringify({runtime:'native workerd / SQLite / real WebSockets',published:false,checks},null,2));
}finally{for(const socket of sockets)try{socket.close(1000,'verified');}catch{}await runtime.dispose();}
