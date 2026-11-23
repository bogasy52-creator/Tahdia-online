import assert from 'node:assert/strict';import {createRuntime} from './local-runtime-v26.mjs';
const runtime=await createRuntime(),sockets=[],checks=[];
async function api(path,body,token){const res=await runtime.mf.dispatchFetch(new URL(path,runtime.url),{method:body?'POST':'GET',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});return {status:res.status,data:await res.json()};}
async function signup(username){const r=await api('/api/social/signup',{username,displayName:username,password:'Pool-QA-only-password123!'});assert.equal(r.status,201,JSON.stringify(r.data));return r.data.token;}
async function coins(token){return (await api('/api/social/career',undefined,token)).data.career.coins;}
async function connect(room,token,{host=false,reconnect=''}={}){
 const res=await runtime.mf.dispatchFetch(new URL('/api/board/rooms/'+room.code+'/ws?game=billiards',runtime.url),{headers:{upgrade:'websocket','sec-websocket-protocol':['busraj-v1',...(token?['st.'+token]:[]),...(host?['hk.'+room.hostKey]:[]),...(reconnect?['rt.'+reconnect]:[])].join(',')}});
 if(res.status!==101)return {status:res.status,error:await res.text()};const socket=res.webSocket,p={queue:[],waiters:[],socket,latest:null};sockets.push(socket);
 socket.addEventListener('message',e=>{const msg=JSON.parse(e.data);if(msg.state)p.latest=msg.state;const i=p.waiters.findIndex(w=>w.match(msg));if(i>=0){const w=p.waiters.splice(i,1)[0];clearTimeout(w.timer);w.resolve(msg);}else p.queue.push(msg);});socket.accept();
 p.next=match=>{const i=p.queue.findIndex(match);if(i>=0)return Promise.resolve(p.queue.splice(i,1)[0]);return new Promise((resolve,reject)=>{const w={match,resolve,timer:setTimeout(()=>reject(Error('pool deadline '+JSON.stringify(p.latest)?.slice(0,180))),10000)};p.waiters.push(w);});};p.wait=pred=>pred(p.latest)?Promise.resolve(p.latest):p.next(m=>m.state&&pred(m.state)).then(m=>m.state);p.send=(type,opts={})=>socket.send(JSON.stringify({type,...opts}));const first=await p.next(m=>m.type==='welcome');p.token=first.token;return p;
}
try{
 const [a,b]=await Promise.all(['poolalpha','poolbravo'].map(signup));const before=[await coins(a),await coins(b)];
 assert.equal((await api('/api/board/rooms',{game:'billiards',poolStake:25})).status,401);
 const r=await api('/api/board/rooms',{game:'billiards',poolStake:25},a);assert.equal(r.status,200);const room=r.data;
 assert.equal((await connect(room,null)).status,401);const p=await connect(room,a,{host:true}),q=await connect(room,b);
 assert.equal((await connect(room,a)).status,409);p.send('start');p.send('resync');await p.next(m=>m.type==='state'&&m.state.status==='lobby');assert.equal(await coins(a),before[0]);
 p.send('pool_accept_entry',{amount:100});await p.next(m=>m.type==='error');p.send('pool_accept_entry',{amount:25});await q.wait(s=>s.players.some(p=>p.poolAccepted===25));assert.equal(await coins(a),before[0]);q.send('pool_accept_entry',{amount:25});const active=await p.wait(s=>s.status==='playing');assert.equal(active.poolStake,25);assert.equal(await coins(a),before[0]-25);assert.equal(await coins(b),before[1]-25);
 const returned=await connect(room,a,{reconnect:p.token});assert.equal(returned.latest.status,'playing');assert.equal(returned.latest.me.index,p.latest.me.index);assert.equal(await coins(a),before[0]-25);checks.push('Two authenticated accounts: explicit consent, exactly one entry per account, same seat and held funds on reconnect; guests and duplicate accounts rejected');
 returned.send('leave');const finished=await q.wait(s=>s.status==='finished'&&s.poolSettlement==='settled');assert.equal(finished.state.winner,1);const totals=[await coins(a),await coins(b)];q.send('resync');await q.next(m=>m.state&&m.state.status==='finished');assert.deepEqual([await coins(a),await coins(b)],totals);assert.ok(totals[1]>=before[1]+25);checks.push('Explicit withdrawal settles the opponent prize; repeated resync never pays twice');
 const free=await api('/api/board/quick',{game:'billiards',humansOnly:true},a),paid=await api('/api/board/quick',{game:'billiards',poolStake:25},a);assert.notEqual(free.data.code,paid.data.code);assert.equal((await api('/api/social/pool/ledger',{action:'settle',id:'forgery:1234',amount:25,award:50},a)).status,404);checks.push('Paid matchmaking is isolated from free tables and the account ledger has no public route');
 console.log(JSON.stringify({ok:true,checks},null,2));
}finally{for(const socket of sockets)try{socket.close(1000);}catch{}await runtime.dispose();}
