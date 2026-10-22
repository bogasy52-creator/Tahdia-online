// Local integration check. Control routes exist only in the temporary test bundle.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions,Log,LogLevel} from 'miniflare';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRelay} from '../public/assets/js/engines/quiz-relay-v28.js';

const root=fileURLToPath(new URL('../',import.meta.url)),temp=await mkdtemp(join(tmpdir(),'tahdia-quiz-v28-'));
const config=JSON.parse(await readFile(join(root,'wrangler.jsonc'),'utf8')),bundle=join(temp,'test-worker.mjs');
await build({stdin:{contents:`
 import worker,{GameRoom as Original,BoardRoom,QuickArena} from './src/index.js';
 export default worker; export {BoardRoom,QuickArena};
 export class GameRoom extends Original {
  async fetch(request){
   const p=new URL(request.url).pathname;
   if(p==='/__test/fourth'){
    this.room.roundIndex=2;await this.startNextRound();
    return Response.json({mode:this.room.current.mode});
   }
   if(p==='/__test/expire'){
    this.room.current.deadline=Date.now()+250;
    for(const r of Object.values(this.room.current.relays))r.deadline=this.room.current.deadline;
    await this.persistAndBroadcast();await this.ctx.storage.setAlarm(this.room.current.deadline);
    return Response.json({ok:true});
   }
   return super.fetch(request);
  }
 }`,resolveDir:root,sourcefile:'quiz-v28-test-entry.js'},outfile:bundle,bundle:true,format:'esm',platform:'browser',target:'es2022',external:['cloudflare:workers'],logLevel:'silent'});
let mf,url;const sockets=[],checks=[];
async function boot(){
 mf=new Miniflare(convertV4MiniflareOptions({name:config.name,modules:true,modulesRoot:temp,scriptPath:bundle,compatibilityDate:config.compatibility_date,cf:false,host:'127.0.0.1',port:0,log:new Log(LogLevel.ERROR),resourcePersistencePath:join(temp,'storage'),durableObjects:Object.fromEntries(config.durable_objects.bindings.map(b=>[b.name,{className:b.class_name,useSQLite:true}])),serviceBindings:{ASSETS:()=>new Response('local test',{status:404})}}));
 url=String(await mf.ready);
}
async function control(code,action){const ns=await mf.getDurableObjectNamespace('ROOMS');const response=await ns.get(ns.idFromName(code)).fetch('https://room.internal/__test/'+action);assert.equal(response.status,200);return response.json();}
async function create(count){const response=await mf.dispatchFetch(new URL('/api/rooms',url),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({playerLimit:count})});assert.equal(response.status,200);return response.json();}
async function joinRoom(code,protocols=[]){
 const response=await mf.dispatchFetch(new URL('/api/rooms/'+code+'/ws?name=QuizTester',url),{headers:{Upgrade:'websocket','sec-websocket-protocol':['busraj-v1','qc.round-v21',...protocols].join(',')}});assert.equal(response.status,101);
 const socket=response.webSocket,queue=[],waiters=[];socket.accept();sockets.push(socket);const peer={socket,latest:null};
 socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.state)peer.latest=m.state;const i=waiters.findIndex(w=>w.match(m));if(i<0){queue.push(m);if(queue.length>200)queue.shift();}else{const w=waiters.splice(i,1)[0];clearTimeout(w.timer);w.resolve(m);}});
 peer.next=(match,ms=8000)=>{const i=queue.findIndex(match);if(i>=0)return Promise.resolve(queue.splice(i,1)[0]);return new Promise((resolve,reject)=>{const w={match,resolve,timer:setTimeout(()=>{waiters.splice(waiters.indexOf(w),1);reject(Error('Quiz socket deadline: '+match.toString()));},ms)};waiters.push(w);});};
 const welcome=await peer.next(m=>m.type==='welcome');peer.id=welcome.playerId;peer.token=welcome.token;peer.latest=welcome.state;
 peer.send=(type,data={})=>socket.send(JSON.stringify({type,...data}));
 peer.state=async predicate=>{if(predicate(peer.latest))return peer.latest;return(await peer.next(m=>m.type==='state'&&predicate(m.state))).state;};
 return peer;
}
function answer(peer,view,extra={}){const seed=Number(view.stageId.match(/^r(\d+):/)[1]),r=createRelay({seed,members:view.members});peer.send('relay_answer',{choice:r.steps[view.stage].correctIndex,stageId:view.stageId,matchId:peer.latest.matchId,roundIndex:peer.latest.roundIndex,...extra});}
async function setup(count){
 const created=await create(count),peers=[];
 for(let i=0;i<count;i++)peers.push(await joinRoom(created.code,i?[]:['hk.'+created.hostKey]));
 const host=peers[0],guest=peers[1];
 console.log('Checking guest relay control',count);guest.send('set_relay',{enabled:false});await guest.next(m=>m.type==='error');
 host.send('set_relay',{enabled:false});await host.state(s=>!s.relayEnabled);
 host.send('set_relay',{enabled:true});await host.state(s=>s.relayEnabled&&s.players.every(p=>!p.ready));
 for(const p of peers)p.send('ready',{ready:true});await host.state(s=>s.players.length===count&&s.players.every(p=>p.ready));host.send('start');await host.state(s=>s.status==='playing');
 assert.equal((await control(created.code,'fourth')).mode,'relay');
 for(const p of peers){const s=await p.state(s=>s.roundIndex===3&&s.current?.mode==='relay'),v=s.current.relay;assert.ok(v);assert.equal(Boolean(v.clue),v.ownerId===p.id);assert.doesNotMatch(JSON.stringify(v),/correctIndex|"steps"|"answers"|"relays"/);}
 return{...created,peers};
}
try{
 await boot();
 const room=await setup(4);let peers=room.peers,host=peers[0];checks.push('4-player room: host controls relay, readiness resets, current-member-only clues');
 console.log('Checking round and member validation');const initial=host.latest,view=initial.current.relay,waiting=peers.find(p=>p.id!==view.ownerId&&view.members.includes(p.id));
 console.log('Checking wrong member',waiting.id,view.ownerId);waiting.send('relay_answer',{choice:0,stageId:view.stageId,matchId:initial.matchId,roundIndex:3});await waiting.next(m=>m.type==='error');
 console.log('Checking stale round');answer(host,view,{roundIndex:2});await host.next(m=>m.type==='error');
 answer(host,view);const advanced=await host.state(s=>s.current?.relay?.stage===1);assert.equal(advanced.current.relay.clue,null);checks.push('Wrong-member and stale-round submissions rejected; solving passes the part to a teammate');
 const saved={match:advanced.matchId,deadline:advanced.current.deadline,stage:advanced.current.relay.stage,ids:peers.map(p=>p.id),tokens:peers.map(p=>p.token)};
 console.log('Restarting persisted runtime');await mf.dispose();await boot();peers=[];
 for(let i=0;i<4;i++){const p=await joinRoom(room.code,['rt.'+saved.tokens[i]]);assert.equal(p.id,saved.ids[i]);assert.equal(p.latest.matchId,saved.match);assert.equal(p.latest.current.deadline,saved.deadline);peers.push(p);}
 host=peers[0];assert.equal(host.latest.current.relay.stage,1);checks.push('Cold runtime restart and SQLite reload preserve all seats, match, progress and original deadline');
 for(const team of ['A','B']){
  const members=peers.filter(p=>p.latest.players.find(x=>x.id===p.id).team===team);
  for(let stage=team==='A'?1:0;stage<2;stage++){
   const p=members[stage],s=await p.state(s=>s.current?.relay?.stage===stage&&s.current.relay.ownerId===p.id);answer(p,s.current.relay);
   if(!(team==='B'&&stage===1))await p.state(s=>s.current?.relay?.stage===stage+1);
  }
 }
 const result=await host.state(s=>s.lastReveal?.mode==='relay');
 for(const score of result.teamScores)assert.equal(score.score,result.lastReveal.value+50);
 const repeatedPeer=peers[3];repeatedPeer.send('relay_answer',{choice:0,stageId:'r0:0',matchId:result.matchId,roundIndex:3});
 const rejoined=await joinRoom(room.code,['rt.'+host.token]);assert.deepEqual(rejoined.latest.teamScores,result.teamScores);checks.push('Both teams complete linked parts; shared base points plus 50 bonus awarded once');
 const six=await setup(6),p=six.peers[0];answer(p,p.latest.current.relay);await p.state(s=>s.current?.relay?.stage===1);await control(six.code,'expire');
 const expired=await p.state(s=>s.lastReveal?.mode==='relay');const value=expired.lastReveal.value;
 assert.equal(expired.teamScores.find(x=>x.team==='A').score,Math.floor(value/6));assert.equal(expired.teamScores.find(x=>x.team==='B').score,0);checks.push('6-player room: real Durable Object alarm settles partial progress at shared deadline');
 console.log(JSON.stringify({runtime:'native workerd / persistent SQLite / real WebSockets',published:false,controlled:'Test-only route advances to round 4 and shortens the final timeout; gameplay, validation and scoring use production code.',checks},null,2));
}finally{for(const s of sockets)try{s.close(1000,'complete');}catch{}if(mf)await mf.dispose();await rm(temp,{recursive:true,force:true});}
