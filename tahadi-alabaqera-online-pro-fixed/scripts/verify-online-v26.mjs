import assert from 'node:assert/strict';
import {createRuntime} from './local-runtime-v26.mjs';
const runtime=await createRuntime(),checks=[],sockets=[];
async function api(path,body,token){
 const response=await runtime.mf.dispatchFetch(runtime.url.replace(/\/$/,'')+path,{method:body?'POST':'GET',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});
 return{response,data:await response.json()};
}
async function join(code,protocols=[]){
 const response=await runtime.mf.dispatchFetch(runtime.url.replace(/\/$/,'')+'/api/board/rooms/'+code+'/ws?game=snakes&name=Player',{headers:{Upgrade:'websocket','sec-websocket-protocol':['busraj-v1',...protocols].join(',')}});
 assert.equal(response.status,101);
 const socket=response.webSocket,queue=[],waiters=[];socket.accept();sockets.push(socket);
 socket.addEventListener('message',event=>{const data=JSON.parse(event.data),index=waiters.findIndex(w=>w.match(data));if(index<0)queue.push(data);else{const w=waiters.splice(index,1)[0];clearTimeout(w.timer);w.resolve(data);}});
 const next=match=>{const index=queue.findIndex(match);if(index>=0)return Promise.resolve(queue.splice(index,1)[0]);return new Promise((resolve,reject)=>{const waiter={match,resolve,timer:setTimeout(()=>{waiters.splice(waiters.indexOf(waiter),1);reject(Error('WebSocket deadline'));},7000)};waiters.push(waiter);});};
 const welcome=await next(m=>m.type==='welcome');return{socket,next,...welcome};
}
try{
 const health=await api('/api/health');assert.equal(health.data.release,'29.1.0');checks.push('Worker and frontend release agree');
 const signup=async(username)=>(await api('/api/social/signup',{username,displayName:username,password:'Runtime-test-only-2026'})).data.token;
 const a=await signup('alice26'),b=await signup('bob26'),owner=await signup('bosrag');
 await api('/api/social/friends/request',{username:'bob26'},a);await api('/api/social/friends/respond',{username:'alice26',accept:true},b);
 const pathChallenge=await api('/api/social/invites',{username:'bob26',game:'journey',variant:'paths'},a),jewelChallenge=await api('/api/social/invites',{username:'bob26',game:'journey',variant:'jewels'},a);
 assert.equal(pathChallenge.response.status,200);assert.equal(pathChallenge.data.invite.joinPath,'/journey?game=paths');assert.equal(jewelChallenge.data.invite.joinPath,'/journey?game=jewels');assert.notEqual(pathChallenge.data.invite.id,jewelChallenge.data.invite.id);
 const invalidVariant=await api('/api/social/invites',{username:'bob26',game:'journey',variant:'https://evil.invalid'},a);assert.equal(invalidVariant.response.status,400);checks.push('Direct friend challenges preserve paths versus jewels and reject arbitrary destinations');
 const created=await api('/api/board/rooms',{game:'snakes',name:'Alice',playerLimit:2,variant:'adventure'});assert.equal(created.response.status,200);const {code,hostKey}=created.data;
 const host=await join(code,['hk.'+hostKey,'st.'+a]);
 const invite=await api('/api/social/invites',{username:'bob26',game:'snakes',roomCode:code},a);assert.equal(invite.response.status,200);
 const duplicate=await api('/api/social/invites',{username:'bob26',game:'snakes',roomCode:code},a);assert.equal(duplicate.data.invite.id,invite.data.invite.id);
 const inbox=await api('/api/social/me',undefined,b);assert.equal(inbox.data.notifications.filter(n=>n.type==='game_invite'&&n.game==='snakes').length,1);checks.push('Offline invitation persists once despite rapid repeats');
 const guest=await join(code,['st.'+b]);host.socket.send(JSON.stringify({type:'ping'}));assert.equal((await host.next(m=>m.type==='pong')).type,'pong');checks.push('Board heartbeat replies without mutating game state');
 host.socket.send(JSON.stringify({type:'ready',ready:true}));guest.socket.send(JSON.stringify({type:'ready',ready:true}));await host.next(m=>m.type==='state'&&m.state.players.every(p=>p.ready));
 host.socket.send(JSON.stringify({type:'start'}));const started=(await host.next(m=>m.type==='state'&&m.state.status==='playing')).state;assert.equal(started.players.length,2);checks.push('Two real WebSocket players ready and start an enhanced board');
 const resumed=await join(code,['rt.'+host.token,'st.'+a]);assert.equal(resumed.playerId,host.playerId);assert.equal(resumed.state.status,'playing');checks.push('Reconnect preserves the player seat and authoritative match');
 const late=await api('/api/social/invites',{username:'bob26',game:'snakes',roomCode:code},a);assert.equal(late.response.status,409);checks.push('Invites to a match that already started are rejected');
 const privileged=await api('/api/social/career',undefined,owner);assert.equal(privileged.data.career.equipped.snake,'snake-sovereign');assert.equal(privileged.data.access.role,'owner');const ordinary=await api('/api/social/career',undefined,b);assert.ok(!ordinary.data.career.owned.includes('snake-sovereign'));checks.push('Manager serpent is granted by authenticated server policy');
 console.log(JSON.stringify({runtime:'native workerd / SQLite / real WebSockets',published:false,checks},null,2));
}finally{for(const socket of sockets)try{socket.close(1000,'complete');}catch{}await runtime.dispose();}
