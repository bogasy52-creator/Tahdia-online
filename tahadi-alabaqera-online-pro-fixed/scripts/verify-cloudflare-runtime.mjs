import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const sourceArg=process.argv.indexOf('--source'),sourceRoot=sourceArg>=0?resolve(process.argv[sourceArg+1]):root;
const dependencyRoot=process.env.BS_CLOUDFLARE_DEPS||root;
const require=createRequire(join(dependencyRoot,'package.json'));
const {build}=require('esbuild'),{Miniflare,convertV4MiniflareOptions,Log,LogLevel}=require('miniflare');
const config=JSON.parse(await readFile(join(sourceRoot,'wrangler.jsonc'),'utf8'));
const temporary=await mkdtemp(join(tmpdir(),'busraj-cloudflare-test-'));
const checks=[],sockets=[];let mf;
function options(scriptPath,quota=false){return convertV4MiniflareOptions({name:config.name,modules:true,modulesRoot:dirname(scriptPath),scriptPath,compatibilityDate:config.compatibility_date,cf:false,log:new Log(LogLevel.ERROR),
 durableObjects:Object.fromEntries(config.durable_objects.bindings.map(b=>[b.name,{className:b.class_name,useSQLite:true}])),
 bindings:{TEST_DO_QUOTA:quota},serviceBindings:{ASSETS:()=>new Response('asset')}
})}
async function api(path,body,token){const res=await mf.dispatchFetch('https://game.test'+path,{method:body?'POST':'GET',headers:{Origin:'https://game.test','content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});return {status:res.status,data:await res.json()}}
function feed(socket){const queue=[],waiting=[];
 socket.addEventListener('message',event=>{const message=JSON.parse(event.data);const index=waiting.findIndex(w=>w.matches(message));if(index<0)queue.push(message);else{const w=waiting.splice(index,1)[0];clearTimeout(w.timer);w.resolve(message)}});socket.accept();sockets.push(socket);
 return {socket,next(type,predicate=()=>true){const matches=m=>m.type===type&&predicate(m);const index=queue.findIndex(matches);if(index>=0)return Promise.resolve(queue.splice(index,1)[0]);return new Promise((resolve,reject)=>{const w={matches,resolve,timer:setTimeout(()=>{waiting.splice(waiting.indexOf(w),1);reject(Error('Timed out waiting for '+type))},5000)};waiting.push(w)})}};
}
async function playRoom(variant,count){
 const room=await api('/api/board/rooms',{game:'snakes',variant,name:'Host',playerLimit:count});assert.equal(room.status,200);assert.equal(room.data.variant,variant);
 const peers=[];
 for(let i=0;i<count;i++){
  const res=await mf.dispatchFetch(`https://game.test/api/board/rooms/${room.data.code}/ws?game=snakes&name=Player${i}`,{headers:{Upgrade:'websocket',Origin:'https://game.test','sec-websocket-protocol':'busraj-v1'+(i===0?', hk.'+room.data.hostKey:'')}});
  assert.equal(res.status,101);const peer=feed(res.webSocket);await peer.next('welcome');peers.push(peer);
 }
 for(const peer of peers)peer.socket.send(JSON.stringify({type:'ready',ready:true}));
 await peers[0].next('state',m=>m.state.players.length===count&&m.state.players.every(p=>p.ready));
 peers[0].socket.send(JSON.stringify({type:'start'}));
 const playing=await Promise.all(peers.map(peer=>peer.next('state',m=>m.state.status==='playing')));
 for(const message of playing){assert.equal(message.state.variant,variant);assert.equal(message.state.state.players.length,count);assert.equal(message.state.state.rulesVersion,variant==='adventure'?2:undefined)}
 peers[0].socket.send(JSON.stringify({type:'roll',expectedVersion:playing[0].state.version}));
 const rolled=await Promise.all(peers.map(peer=>peer.next('state',m=>m.state.version>playing[0].state.version)));
 for(const message of rolled)assert.deepEqual(message.state.state,rolled[0].state.state);
 for(const peer of peers)peer.socket.close(1000,'test_complete');
 checks.push({check:'create-join-ready-start-roll',game:'snakes',variant,players:count,result:'passed'});
}
try{
 // Test-only subclasses expose storage/alarm observations in this temporary
 // bundle. Production deployment uses src/index.js and contains no test routes.
 const fixture=`import Worker,{GameRoom,BoardRoom as BaseBoardRoom,QuickArena as BaseQuickArena} from ${JSON.stringify(join(sourceRoot,'src/index.js'))};
 export {GameRoom};let faultCalls=0;
 export class BoardRoom extends BaseBoardRoom{
  async fetch(request){const path=new URL(request.url).pathname;
   if(path==='/__test/abandoned'){const now=Date.now();this.room={code:'123456',game:'snakes',status:'lobby',expiresAt:now+86400000,rewardsComplete:true,order:['host'],players:{host:{id:'host',role:'host',name:'A',connected:false,disconnectedAt:now-46000}}};await this.ctx.storage.put('room',this.room);await this.alarm();return Response.json({now,alarm:await this.ctx.storage.getAlarm(),expiresAt:this.room.expiresAt})}
   if(path==='/__test/fault-count')return Response.json({count:faultCalls});
   if(path==='/init'&&this.env.TEST_DO_QUOTA){faultCalls++;throw Error('Exceeded allowed volume of requests in Durable Objects free tier.')}
   return super.fetch(request);
  }
 }
 export class QuickArena extends BaseQuickArena{
  async fetch(request){const path=new URL(request.url).pathname;
   if(path==='/__test/empty-queue'){await this.ctx.storage.put('ticket:expired',{id:'expired',createdAt:Date.now()-100000,expiresAt:Date.now()-1});await this.alarm();return Response.json({alarm:await this.ctx.storage.getAlarm(),tickets:(await this.ctx.storage.list({prefix:'ticket:'})).size})}
   return super.fetch(request);
  }
 }
 export default Worker;`;
 const entry=join(temporary,'fixture.mjs'),bundle=join(temporary,'worker.mjs');await writeFile(entry,fixture);
 await build({entryPoints:[entry],outfile:bundle,bundle:true,format:'esm',platform:'browser',target:'es2022',external:['cloudflare:workers'],logLevel:'silent'});
 mf=new Miniflare(options(bundle));await mf.ready;
 const env=await mf.getBindings();
 const alarm=await(await env.BOARD_ROOMS.get(env.BOARD_ROOMS.idFromName('__test_abandoned__')).fetch('https://board.internal/__test/abandoned')).json();
 assert.equal(alarm.alarm,alarm.expiresAt,'abandoned host must not schedule a 50 ms alarm loop');checks.push({check:'abandoned-room-alarm',result:'passed',nextAlarmInMs:alarm.alarm-alarm.now});
 const empty=await(await env.QUICK_ARENA.get(env.QUICK_ARENA.idFromName('__test_empty__')).fetch('https://quick.internal/__test/empty-queue')).json();assert.equal(empty.alarm,null);assert.equal(empty.tickets,0);checks.push({check:'empty-queue-hibernation',result:'passed'});
 await playRoom('classic',4);await playRoom('adventure',2);
 for(const game of ['jackaroo','zahra']){const room=await api('/api/board/rooms',{game,name:'Host',playerLimit:game==='jackaroo'?4:2});assert.equal(room.status,200);const status=await api('/api/board/rooms/'+room.data.code+'/status');assert.equal(status.data.game,game);checks.push({check:'create-and-status',game,result:'passed'})}
 const owner=await api('/api/social/signup',{username:'BoSraG',displayName:'BoSraG',password:'RuntimeTestPass123!'});assert.equal(owner.status,201);
 const career=await api('/api/social/career',undefined,owner.data.token),admin=await api('/api/social/admin',undefined,owner.data.token);assert.equal(career.data.access.role,'owner');assert.equal(career.data.career.owned.length,44);assert.equal(admin.status,200);assert.equal(admin.data.access.capabilities.length,6);checks.push({check:'mixed-case-owner-and-all-unlocks',result:'passed'});
 for(const socket of sockets)try{socket.close(1000,'test_complete')}catch{}await mf.dispose();mf=new Miniflare(options(bundle,true));await mf.ready;
 const first=await api('/api/board/rooms',{game:'snakes',name:'A'}),second=await api('/api/board/rooms',{game:'snakes',name:'A'});assert.equal(first.data.code,'DURABLE_REQUEST_LIMIT');assert.equal(second.data.code,'DURABLE_REQUEST_LIMIT');
 const faultEnv=await mf.getBindings(),count=await(await faultEnv.BOARD_ROOMS.get(faultEnv.BOARD_ROOMS.idFromName('__test_counter__')).fetch('https://board.internal/__test/fault-count')).json();assert.equal(count.count,1);checks.push({check:'injected-quota-error-and-circuit',result:'passed',failedInitCalls:count.count});
 console.log(JSON.stringify({runtime:'Cloudflare workerd + SQLite Durable Objects',source:sourceRoot,checks},null,2));
}finally{for(const socket of sockets)try{socket.close(1000,'test_complete')}catch{}if(mf)await mf.dispose();await rm(temporary,{recursive:true,force:true})}
