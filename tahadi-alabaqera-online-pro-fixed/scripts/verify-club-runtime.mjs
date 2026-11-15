import assert from 'node:assert/strict';
import {createRuntime} from './local-runtime-v26.mjs';
const runtime=await createRuntime(),sockets=[],checks=[];
async function api(path,body,token){const response=await runtime.mf.dispatchFetch(new URL(path,runtime.url),{method:body?'POST':'GET',headers:{...(body?{'content-type':'application/json'}:{}),...(token?{authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});return {response,data:await response.json()};}
async function signup(username){const r=await api('/api/social/signup',{username,displayName:username,password:'Runtime-only-password123!'});assert.equal(r.response.status,201);return r.data.token;}
async function connect(path,protocols){
 const res=await runtime.mf.dispatchFetch(new URL(path,runtime.url),{headers:{Upgrade:'websocket','sec-websocket-protocol':protocols.join(',')}});assert.equal(res.status,101);
 const socket=res.webSocket,queue=[],waiters=[];sockets.push(socket);
 socket.addEventListener('message',e=>{const m=JSON.parse(e.data),i=waiters.findIndex(w=>w.match(m));if(i>=0){const w=waiters.splice(i,1)[0];clearTimeout(w.timer);w.resolve(m);}else{queue.push(m);if(queue.length>128)queue.shift();}});socket.accept();
 const next=match=>{const i=queue.findIndex(match);if(i>=0)return Promise.resolve(queue.splice(i,1)[0]);return new Promise((resolve,reject)=>{const w={match,resolve,timer:setTimeout(()=>{waiters.splice(waiters.indexOf(w),1);reject(Error('runtime socket deadline'));},8000)};waiters.push(w);});};
 return {socket,next,...await next(m=>m.type==='welcome')};
}
try{
 const tokens=await Promise.all(['clubalice','clubbob','clubcathy','clubdavid','clubextra'].map(signup));
 const created=await api('/api/tournament/rooms',{game:'tanks',capacity:4},tokens[0]);assert.equal(created.response.status,201);const code=created.data.code;
 for(let i=1;i<4;i++)assert.equal((await api('/api/tournament/rooms/'+code+'/join',{},tokens[i])).response.status,200);
 const started=await api('/api/tournament/rooms/'+code+'/start',{},tokens[0]);assert.equal(started.response.status,200);assert.equal(started.data.rounds[0].length,2);assert.ok(started.data.rounds[0].every(m=>m.status==='ready'));assert.ok(!JSON.stringify(started.data).includes('token'));
 checks.push('Four authenticated accounts create and seed a persistent tank semifinal bracket');
 const match=started.data.rounds[0][0],users=['clubalice','clubbob','clubcathy','clubdavid'],pair=match.players.map(u=>tokens[users.indexOf(u)]);
 const tankPath='/api/tanks/rooms/'+match.roomCode+'/ws',a=await connect(tankPath,['bs-tanks-v1','st.'+pair[0]]),b=await connect(tankPath,['bs-tanks-v1','st.'+pair[1]]);
 const battle=(await a.next(m=>m.type==='state'&&m.state.status==='playing')).state;assert.equal(battle.players.length,2);assert.ok(battle.players.every(p=>p.username));assert.ok(battle.g.walls.some(w=>w.x+w.w>900));
 const denied=await runtime.mf.dispatchFetch(new URL(tankPath,runtime.url),{headers:{Upgrade:'websocket','sec-websocket-protocol':'bs-tanks-v1,st.'+tokens[4]}});assert.equal(denied.status,403);
 const resumed=await connect(tankPath,['bs-tanks-v1','st.'+pair[0],'rt.'+a.token]);assert.equal(resumed.state.me,a.state.me);assert.equal(resumed.state.match,battle.match);
 checks.push('Two real WebSockets enter a larger authoritative tank map, reject an outsider, and resume the same seat');
 const cup=await api('/api/tournament/rooms',{game:'billiards',capacity:2},tokens[2]);await api('/api/tournament/rooms/'+cup.data.code+'/join',{},tokens[3]);const seeded=await api('/api/tournament/rooms/'+cup.data.code+'/start',{},tokens[2]);const boardCode=seeded.data.rounds[0][0].roomCode;
 const poolPath='/api/board/rooms/'+boardCode+'/ws?game=billiards',p=await connect(poolPath,['busraj-v1','st.'+tokens[2]]);await connect(poolPath,['busraj-v1','st.'+tokens[3]]);const pool=(await p.next(m=>m.type==='state'&&m.state.status==='playing')).state;assert.equal(pool.players.length,2);assert.ok(pool.players.every(p=>!p.bot));
 checks.push('The billiards final opens the real pool engine with two reserved human accounts');
 const quick=await api('/api/board/quick',{game:'billiards',humansOnly:true});const q=await connect('/api/board/rooms/'+quick.data.code+'/ws?game=billiards',['busraj-v1','st.'+tokens[0]]);assert.equal(q.state.humansOnly,true);assert.equal(q.state.lobbyDeadline,null);
 const quick2=await api('/api/board/quick',{game:'billiards',humansOnly:true});assert.equal(quick2.data.code,quick.data.code);await connect('/api/board/rooms/'+quick.data.code+'/ws?game=billiards',['busraj-v1','st.'+tokens[1]]);const human=(await q.next(m=>m.type==='state'&&m.state.status==='playing')).state;assert.ok(human.players.every(p=>!p.bot));
 checks.push('Human-only matchmaking waits without a bot countdown and starts only when its second player arrives');
 const proof=await signup('clubrecovery'),codes=await api('/api/social/recovery/codes',{password:'Runtime-only-password123!'},proof);assert.equal(codes.data.codes.length,6);assert.equal((await api('/api/social/recovery/reset',{username:'clubrecovery',code:codes.data.codes[0],password:'New-runtime-password456!'})).response.status,200);assert.equal((await api('/api/social/me',undefined,proof)).response.status,401);
 const login=await api('/api/social/login',{username:'clubrecovery',password:'New-runtime-password456!'});assert.equal(login.response.status,200);assert.equal((await api('/api/social/recovery/status',{},login.data.token)).data.remaining,5);
 checks.push('SQLite-backed recovery consumes one code, invalidates the old session and accepts the new password');
 console.log(JSON.stringify({runtime:'native workerd / SQLite / real WebSockets',published:false,checks},null,2));
}finally{for(const socket of sockets)try{socket.close(1000,'verified');}catch{}await runtime.dispose();}
