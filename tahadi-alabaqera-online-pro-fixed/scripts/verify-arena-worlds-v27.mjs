import assert from 'node:assert/strict';
import {createRuntime} from './local-runtime-v26.mjs';
import {SERPENT_WORLDS} from '../public/assets/js/engines/arena-worlds-v27.js';
const runtime=await createRuntime(),sockets=[],checks=[];
async function api(body){const response=await runtime.mf.dispatchFetch(new URL('/api/serpent/rooms',runtime.url),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});return {response,data:await response.json()};}
async function join(code,protocols=[]){
 const response=await runtime.mf.dispatchFetch(new URL('/api/serpent/rooms/'+code+'/ws?name=WorldTester',runtime.url),{headers:{Upgrade:'websocket','sec-websocket-protocol':['busraj-serpent-v1','bs-serpent-body1',...protocols].join(',')}});assert.equal(response.status,101);
 const socket=response.webSocket,queue=[],waiters=[];socket.accept();sockets.push(socket);
 socket.addEventListener('message',event=>{const m=JSON.parse(event.data),i=waiters.findIndex(w=>w.match(m));if(i<0){queue.push(m);if(queue.length>160)queue.shift();}else{const w=waiters.splice(i,1)[0];clearTimeout(w.timer);w.resolve(m);}});
 const next=(match,ms=10000)=>{const i=queue.findIndex(match);if(i>=0)return Promise.resolve(queue.splice(i,1)[0]);return new Promise((resolve,reject)=>{const w={match,resolve,timer:setTimeout(()=>{waiters.splice(waiters.indexOf(w),1);reject(Error('World WebSocket deadline: '+match.toString()));},ms)};waiters.push(w);});};return {socket,next,welcome:await next(m=>m.type==='welcome')};
}
const state=m=>m.type==='state'||m.type==='frame'?m.state:null;
try{
 for(const id of Object.keys(SERPENT_WORLDS)){const {response,data}=await api({worldId:id,playerLimit:2,botCount:0,difficulty:'medium',matchMode:'timed',duration:60});assert.equal(response.status,200);assert.equal(data.worldId,id);}checks.push('Seven maps accepted by the actual Worker API');
 assert.equal((await api({worldId:'unknown',playerLimit:2})).response.status,400);checks.push('Unknown maps rejected');
 const {data}=await api({worldId:'neon',playerLimit:2,botCount:0,difficulty:'medium',matchMode:'timed',duration:60}),host=await join(data.code,['hk.'+data.hostKey]),guest=await join(data.code);
 const ready=()=>{host.socket.send(JSON.stringify({type:'ready',ready:true}));guest.socket.send(JSON.stringify({type:'ready',ready:true}));};
 ready();await host.next(m=>state(m)?.players.every(p=>p.ready));host.socket.send(JSON.stringify({type:'configure',worldId:'volcano',botCount:0,difficulty:'medium',matchMode:'timed',duration:60}));
 await host.next(m=>state(m)?.worldId==='volcano'&&state(m).players.every(p=>!p.ready));await guest.next(m=>state(m)?.worldId==='volcano');checks.push('Both clients receive host map choice and readiness reset');
 guest.socket.send(JSON.stringify({type:'configure',worldId:'storm',botCount:0,difficulty:'medium'}));await guest.next(m=>m.type==='error');checks.push('Guest cannot change map');
 ready();await host.next(m=>state(m)?.players.every(p=>p.ready));host.socket.send(JSON.stringify({type:'start'}));const started=state(await host.next(m=>state(m)?.status==='playing'));assert.equal(started.game.world.id,'volcano');assert.equal(started.game.world.zones.length,3);checks.push('Actual room runs the shared volcano simulation');
 host.socket.send(JSON.stringify({type:'input',angle:Math.PI/2,boost:false}));guest.socket.send(JSON.stringify({type:'input',angle:-Math.PI/2,boost:false}));
 const warned=state(await host.next(m=>state(m)?.game?.world?.phase==='warning',12000)),other=state(await guest.next(m=>state(m)?.game?.world?.phase==='warning',12000));assert.ok(warned.game.elapsed>=5);assert.equal(other.game.world.cycle,warned.game.world.cycle);
 const active=state(await host.next(m=>state(m)?.game?.world?.phase==='active',8000));assert.ok(active.game.elapsed>=8);checks.push('Two real WebSockets receive warning then active lava on server time');
 const resumed=await join(data.code,['rt.'+host.welcome.token]);assert.equal(resumed.welcome.playerId,host.welcome.playerId);assert.equal(resumed.welcome.state.game.world.id,'volcano');assert.equal(resumed.welcome.state.game.world.phase,'active');checks.push('Reconnect keeps seat, map and active event');
 console.log(JSON.stringify({runtime:'native workerd / SQLite / real WebSockets',published:false,checks},null,2));
}finally{for(const s of sockets)try{s.close(1000,'complete');}catch{}await runtime.dispose();}
