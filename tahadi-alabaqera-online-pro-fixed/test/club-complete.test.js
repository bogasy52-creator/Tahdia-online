import test from 'node:test';import assert from 'node:assert/strict';
import {environment,api,signup} from './worker-harness.mjs';
import {SkillRatings,skillDeltas} from '../src/leaderboard/skill-ratings.js';
import {tankResult,settleTankResult} from '../src/tanks/tank-results.js';
import {TournamentRoom} from '../src/competition/tournament-room.js';
import {createEffectsChannel} from '../public/assets/js/audio-effects.js';
import {TANKS,createTankBattle,stepTankBattle,setTankInput,tankMap,circleTankWall} from '../public/assets/js/tanks/core.js';
import {makeTankCamera,projectTankPoint,unprojectTankPoint} from '../public/assets/js/tanks/scene.js';
import {POOL,createPoolGame,playPoolShot,simulate} from '../public/assets/js/engines/pool-engine.js';
import {Career} from '../src/career/core.js';

test('recovery requires the password, stores hashes, consumes one code and revokes all old sessions',async()=>{
 const env=environment(),token=(await signup(env,'recoverme')).data.token;
 const before=(await api(env,'/api/social/career',undefined,token)).data.career;
 assert.equal((await api(env,'/api/social/recovery/codes',{password:'wrong'},token)).response.status,401);
 const issued=await api(env,'/api/social/recovery/codes',{password:'StrongPass123!'},token);assert.equal(issued.data.codes.length,6);
 const {ctx}=env.BOARD_ROOMS.peek('social:user:recoverme'),saved=await ctx.storage.get('recovery:codes');
 for(const code of issued.data.codes){assert.match(code,/^(?:[A-F0-9]{4}-){5}[A-F0-9]{4}$/);assert.ok(!JSON.stringify(saved).includes(code.replaceAll('-','')));}
 const second=(await api(env,'/api/social/login',{username:'recoverme',password:'StrongPass123!'})).data.token;
 const reset=await api(env,'/api/social/recovery/reset',{username:'recoverme',code:issued.data.codes[0],password:'NewStrongPass456!'});assert.equal(reset.response.status,200);assert.equal(reset.data.token,undefined);
 for(const old of [token,second])assert.equal((await api(env,'/api/social/me',undefined,old)).response.status,401);
 assert.equal((await api(env,'/api/social/recovery/reset',{username:'recoverme',code:issued.data.codes[0],password:'BadReplacement123!'})).response.status,400);
 const fresh=(await api(env,'/api/social/login',{username:'recoverme',password:'NewStrongPass456!'})).data.token;
 assert.deepEqual((await api(env,'/api/social/career',undefined,fresh)).data.career,before);
 assert.equal((await api(env,'/api/social/recovery/status',{},fresh)).data.remaining,5);
});
test('recovery rotation, expiry and rate limits cannot be bypassed',async t=>{
 let now=Date.UTC(2026,10,15);t.mock.method(Date,'now',()=>now);const env=environment(),token=(await signup(env,'rotatecodes')).data.token;
 const issue=async()=>(await api(env,'/api/social/recovery/codes',{password:'StrongPass123!'},token)).data;
 const a=await issue(),b=await issue(),reset=code=>api(env,'/api/social/recovery/reset',{username:'rotatecodes',code,password:'NewPassword123!'});
 assert.equal((await reset(a.codes[0])).response.status,400);now=b.expiresAt+1;assert.equal((await reset(b.codes[0])).response.status,400);
 for(let i=0;i<6;i++)await reset('0000-0000-0000-0000-0000-0000');assert.equal((await reset(b.codes[1])).response.status,429);
});
test('Elo adjusts for opponent strength, excludes teammates, deduplicates and limits repeat opponents',async()=>{
 assert.deepEqual(skillDeltas([{team:0,score:1,rating:1000},{team:1,score:0,rating:1000}]),[16,-16]);
 assert.ok(skillDeltas([{team:0,score:1,rating:800},{team:1,score:0,rating:1200}])[0]>16);
 assert.deepEqual(skillDeltas([{team:0,score:1,rating:1000},{team:1,score:0,rating:1000},{team:0,score:1,rating:1000},{team:1,score:0,rating:1000}]),[16,-16,16,-16]);
 const {ctx}=environment().BOARD_ROOMS.peek('skill-fixture'),rating=new SkillRatings(ctx),match={id:'tanks:071234:match1',game:'tanks',players:[{username:'alice',team:0,score:1},{username:'bob',team:1,score:0}]};
 assert.equal((await rating.record(match)).applied,true);assert.equal((await rating.record(match)).applied,false);assert.equal((await rating.top('tanks','alice')).me.rating,1016);assert.equal((await rating.top('billiards','alice')).me.rating,1000);
 assert.equal((await rating.record({...match,players:[match.players[0],{...match.players[1],username:'alice'}]})).ok,false);
 for(let i=2;i<=5;i++)await rating.record({...match,id:'tanks:071234:match'+i});assert.equal((await rating.record({...match,id:'tanks:071234:match6'})).reason,'repeat_opponents');
});
test('tank receipts survive a partial delivery and never duplicate completed account rewards',async()=>{
 const room={code:'071234',match:1,startedAt:1000,mode:'teams',players:['alice','bob','charlie','david'].map(username=>({username,name:username})),g:{phase:'finished',winners:[0,2]}},result=tankResult(room,31000);
 assert.deepEqual(result.rewards.filter(p=>p.win).map(p=>p.username),['alice','charlie']);room.players=[];
 let fail=true;const calls=new Map(),env={SOCIAL_USERS:{idFromName:n=>n,get:n=>({fetch:async()=>{calls.set(n,(calls.get(n)||0)+1);return Response.json({ok:!fail||n!=='user:bob'},{status:fail&&n==='user:bob'?503:200});}})},BOARD_ROOMS:{idFromName:n=>n,get:()=>({fetch:async()=>Response.json({ok:true})})}};
 await settleTankResult(env,result,31000);assert.equal(result.complete,false);fail=false;await settleTankResult(env,result,40000);assert.equal(result.complete,true);assert.equal(calls.get('user:alice'),1);assert.equal(calls.get('user:bob'),2);await settleTankResult(env,result,50000);assert.equal(calls.get('user:bob'),2);
 const receipt={...result.rewards[0],verified:true},career=Career.reward({},receipt);assert.equal(career.stats.tanks[0],1);assert.deepEqual(Career.reward(career,receipt),career);
 assert.equal(tankResult({...room,players:[{username:'alice'}]},31000).complete,true);
});
test('asynchronous tank and hockey quota failures close the circuit for all online games',async()=>{
 for(const path of ['/api/tanks/rooms/071234/status','/api/hockey/rooms/951234/status']){const env=environment();let calls=0;env.ROOMS={idFromName:n=>n,get:()=>({fetch:async()=>{calls++;throw Error('Exceeded allowed volume of requests in Durable Objects free tier.');}})};assert.equal((await api(env,path)).data.code,'DURABLE_REQUEST_LIMIT');for(const p of ['/api/tanks/health','/api/hockey/health','/api/board/health'])assert.equal((await api(env,p)).data.online,false);assert.equal(calls,1);}
});
test('effect gain changes mute existing notes while music remains independently configured',()=>{
 let settings={muted:false,effects:true,volume:.4,musicVolume:.7},listener,context;class Audio{constructor(){context=this;this.state='running';this.currentTime=0;this.destination={};}createGain(){return {gain:{setValueAtTime:v=>{this.gain=v;}},connect(){}};}resume(){}}
 const channel=createEffectsChannel({AudioContext:Audio,BS_AUDIO:{getSettings:()=>settings},addEventListener:(_,fn)=>{listener=fn;}});channel.unlock();assert.equal(channel.enabled(),true);assert.equal(context.gain,.4);settings={...settings,effects:false};listener();assert.equal(context.gain,0);settings={...settings,effects:true,volume:0};listener();assert.equal(channel.enabled(),false);settings={...settings,volume:.8};listener();assert.equal(context.gain,.8);assert.equal(settings.musicVolume,.7);
});
test('larger pool balls rack without overlap and authoritative shots replay exactly',()=>{
 const game=createPoolGame(['A','B']);assert.equal(POOL.R,3.3);const balls=game.balls.filter(Boolean);for(let i=0;i<balls.length;i++)for(let j=i+1;j<balls.length;j++)assert.ok(Math.hypot(balls[i][0]-balls[j][0],balls[i][1]-balls[j][1])>=POOL.R*2-.001);
 const next=playPoolShot(game,0,{dir:[1,0],power:.7,spin:[0,0]});assert.deepEqual(simulate(next.shot.before,next.shot).balls,next.balls);
});
test('large maps retain connected spawn paths and free supply locations',()=>{
 assert.equal(TANKS.W*TANKS.H/(900*1050),1.96);
 for(let map=0;map<3;map++){const walls=tankMap(map),cols=Math.ceil(TANKS.W/35),rows=Math.ceil(TANKS.H/35),free=(x,y)=>x>27&&y>27&&x<TANKS.W-27&&y<TANKS.H-27&&!walls.some(w=>circleTankWall(x,y,27,w)),players=createTankBattle({names:['A','B','C','D']}).players;
  for(const p of players)assert.ok(free(p.x,p.y));const index=p=>Math.floor(p.y/35)*cols+Math.floor(p.x/35),start=index(players[0]),seen=new Set([start]),queue=[start];for(let k=0;k<queue.length;k++){const at=queue[k],x=at%cols,y=Math.floor(at/cols);for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy,n=yy*cols+xx;if(xx<0||xx>=cols||yy<0||yy>=rows||seen.has(n)||!free(xx*35+17.5,yy*35+17.5))continue;seen.add(n);queue.push(n);}}
  for(const p of players)assert.ok(seen.has(index(p)),'map '+map+' spawn connected');for(const[x,y]of[[630,448],[630,1022],[175,749],[1085,721],[630,140],[630,1330]])assert.ok(free(x,y),'map '+map+' supply '+x+','+y);
 }
});
test('repair, boost and heavy weapons are server simulated and camera input remains invertible',()=>{
 const game=()=>{const g=createTankBattle();g.phase='battle';g.roundTime=1;g.walls=[];g.pickupAt=1000;return g;};
 for(const kind of ['repair','boost','heavy']){const g=game(),p=g.players[0];p.hp=50;g.pickups=[{x:p.x,y:p.y,kind}];stepTankBattle(g,1/60);if(kind==='repair')assert.equal(p.hp,82);if(kind==='boost'){assert.ok(p.boostUntil>g.time);setTankInput(g,0,{mx:1,my:0,aim:0,fire:false});for(let i=0;i<60;i++)stepTankBattle(g,1/60);assert.ok(p.vx>TANKS.SPEED);for(let i=0;i<310;i++)stepTankBattle(g,1/60);assert.ok(p.vx<=TANKS.SPEED+1);}if(kind==='heavy')assert.equal(p.weapon,'heavy');}
 for(const[w,h]of[[390,540],[844,330]])for(const focus of [{x:160,y:200},{x:1000,y:1100}]){const v=makeTankCamera(w,h,{focus,zoom:1.55}),p=projectTankPoint(v,focus.x+84,focus.y-31),q=unprojectTankPoint(v,p.x,p.y);assert.ok(Math.abs(q.x-focus.x-84)<1e-6);assert.ok(Math.abs(q.y-focus.y+31)<1e-6);}
});

async function cupFixture(capacity=4){const data=new Map(),created=[],ctx={storage:{get:async k=>structuredClone(data.get(k)),put:async(k,v)=>data.set(k,structuredClone(v)),delete:async k=>data.delete(k),setAlarm:async()=>{}},blockConcurrencyWhile:fn=>fn()},ns={idFromName:n=>n,get:()=>({fetch:async(_,init)=>{created.push(JSON.parse(init.body));return Response.json({ok:true},{status:201});}})},env={ROOMS:ns,BOARD_ROOMS:ns},cup=new TournamentRoom(ctx,env);await cup.ready;const call=async(path,body)=>{const res=await cup.fetch(new Request('https://tournament.internal'+path,{method:body?'POST':'GET',body:body?JSON.stringify(body):undefined}));return {res,data:await res.json()};};await call('/init',{code:'061234',username:'alice',name:'Alice',game:'tanks',capacity});for(const username of ['bob','cathy','david','ellie','faris','ghada','hadi'].slice(0,capacity-1))await call('/join',{username,name:username});return {cup,ctx,env,call,created};}
test('tournament results are authenticated by match secret, idempotent and persist through the final',async()=>{
 const f=await cupFixture();assert.equal((await f.call('/start',{username:'bob'})).res.status,403);await f.call('/start',{username:'alice'});assert.equal(f.created.length,2);assert.ok(!JSON.stringify(f.cup.view()).includes('token'));
 const semifinals=f.cup.r.rounds[0];const report=m=>f.call('/result',{match:m.id,token:m.token,game:'tanks',winner:m.players[0]});assert.equal((await f.call('/result',{match:semifinals[0].id,token:'wrong',game:'tanks',winner:'alice'})).res.status,409);
 await report(semifinals[0]);await report(semifinals[0]);assert.equal(f.cup.r.rounds.length,1);await report(semifinals[1]);assert.equal(f.cup.r.rounds.length,2);
 const restored=new TournamentRoom(f.ctx,f.env);await restored.ready;await restored.alarm();assert.equal(f.created.length,3);const final=restored.r.rounds[1][0];assert.equal(final.status,'ready');await restored.fetch(new Request('https://tournament.internal/result',{method:'POST',body:JSON.stringify({match:final.id,token:final.token,game:'tanks',winner:final.players[0]})}));assert.equal(restored.r.status,'finished');assert.equal(restored.r.winner,final.players[0]);
});
test('a tournament draw creates a fresh replay and cannot advance an arbitrary player',async()=>{
 const f=await cupFixture(2);await f.call('/start',{username:'alice'});const match=f.cup.r.rounds[0][0];assert.equal((await f.call('/result',{match:match.id,token:match.token,game:'tanks',winner:'outsider'})).res.status,400);await f.call('/result',{match:match.id,token:match.token,game:'tanks',winner:null});assert.notEqual(f.cup.r.rounds[0][0].id,match.id);assert.equal(f.cup.r.rounds[0][0].draws,1);assert.equal(f.cup.r.status,'playing');await f.cup.alarm();assert.equal(f.created.length,2);
});

test('eight-player tournament advances through four quarterfinals and two semifinals to one champion',async()=>{
 const f=await cupFixture(8);await f.call('/start',{username:'alice'});assert.equal(f.created.length,4);
 while(f.cup.r.status!=='finished'){const round=[...f.cup.r.rounds.at(-1)];for(const match of round)await f.call('/result',{match:match.id,token:match.token,game:'tanks',winner:match.players[0]});await f.cup.alarm();}
 assert.equal(f.cup.r.rounds.length,3);assert.equal(f.created.length,7);assert.equal(f.cup.r.winner,f.cup.r.rounds[2][0].players[0]);
});
