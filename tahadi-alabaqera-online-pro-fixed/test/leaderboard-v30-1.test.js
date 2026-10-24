import test from 'node:test';
import assert from 'node:assert/strict';
import {environment,api,signup} from './worker-harness.mjs';
const Worker=await import('../src/index.js');
import {LeaderboardStore,periodBounds,riyadhWeekKey,seasonKey,LEADERBOARD_POINTS} from '../src/leaderboard/leaderboard.js';
import {SudokuRoom} from '../src/sudoku/sudoku-room.js';
import {PathsRoom} from '../src/paths/paths-room.js';

function store(){
 const values=new Map();
 const ctx={storage:{get:async k=>structuredClone(values.get(k)),put:async(k,v)=>void values.set(k,structuredClone(v)),delete:async keys=>{for(const k of [].concat(keys))values.delete(k)},list:async({prefix=''}={})=>new Map([...values].filter(([k])=>k.startsWith(prefix)).sort(([a],[b])=>a.localeCompare(b)))},blockConcurrencyWhile:fn=>fn()};
 return {board:new LeaderboardStore(ctx),values};
}
const RIYADH=3*3600000;

test('weeks start on Monday and seasons on the 1st, both at midnight in Riyadh',()=>{
 const sunday=Date.UTC(2026,9,25,20,59);// 23:59 Sunday in Riyadh
 assert.equal(riyadhWeekKey(sunday),'2026-10-19');assert.equal(riyadhWeekKey(sunday+60000),'2026-10-26');
 const w=periodBounds('week',sunday);assert.equal(w.endsAt,Date.UTC(2026,9,26)-RIYADH);assert.equal(w.previous,'2026-10-12');
 assert.equal(seasonKey(Date.UTC(2026,9,31,20,59)),'2026-10');assert.equal(seasonKey(Date.UTC(2026,9,31,21,0)),'2026-11');
 const s=periodBounds('season',Date.UTC(2026,0,10));assert.equal(s.key,'2026-01');assert.equal(s.previous,'2025-12');assert.equal(s.endsAt,Date.UTC(2026,1,1)-RIYADH);
});

test('a verified win is worth 250 and any other verified finish 80, counted once per receipt',async()=>{
 const {board}=store(),now=Date.UTC(2026,9,24,12);
 assert.deepEqual(LEADERBOARD_POINTS,{win:250,play:80});
 await board.record({username:'fahad',name:'فهد',receipt:'quiz:a:1',win:true,at:now},now);
 await board.record({username:'fahad',name:'فهد',receipt:'quiz:a:1',win:true,at:now},now);
 await board.record({username:'fahad',name:'فهد',receipt:'snakes:b:2',win:false,at:now},now);
 const week=await board.top('week','fahad',now),season=await board.top('season',null,now);
 assert.equal(week.players[0].points,330);assert.equal(week.players[0].wins,1);assert.equal(week.players[0].games,2);
 assert.equal(week.me.rank,1);assert.equal(season.players[0].points,330);assert.equal(season.me,null);
});

test('ranking uses points, then wins, then who reached the score first; invalid input is refused',async()=>{
 const {board}=store(),now=Date.UTC(2026,9,24,12);
 await board.record({username:'late_win',receipt:'r1',win:true,at:now+2000},now+2000);
 await board.record({username:'early_win',receipt:'r2',win:true,at:now+1000},now+2000);
 for(let i=0;i<4;i++)await board.record({username:'grinder',receipt:'g'+i,win:false,at:now},now+2000);
 const top=await board.top('week',null,now+2000);
 assert.deepEqual(top.players.map(p=>p.username),['grinder','early_win','late_win']);
 assert.equal((await board.record({username:'Bad Name!',receipt:'x'})).ok,false);
 assert.equal((await board.record({username:'okname',receipt:''})).ok,false);
});

test('the board keeps the best 100, reports outsiders without a rank, and shows last period champions',async()=>{
 const {board}=store(),lastWeek=Date.UTC(2026,9,15,12),now=Date.UTC(2026,9,24,12);
 for(const [i,name] of ['gold','silver','bronze','fourth'].entries())for(let n=0;n<4-i;n++)await board.record({username:name,receipt:name+n,win:true,at:lastWeek},lastWeek);
 for(let i=0;i<101;i++)await board.record({username:'p'+String(i).padStart(3,'0'),receipt:'r'+i,win:i<100,at:now},now);
 const view=await board.top('week','p100',now);
 assert.equal(view.players.length,100);assert.equal(view.me.rank,null);assert.equal(view.me.points,80);
 assert.deepEqual(view.previous.players.map(p=>p.username),['gold','silver','bronze']);
});

test('old weeks are pruned while finished seasons keep only their final standings',async()=>{
 const {board,values}=store(),week=7*86400000;let at=Date.UTC(2026,0,5,12);
 for(let i=0;i<6;i++,at+=week)await board.record({username:'steady',receipt:'w'+i,win:true,at},at);
 const weeks=new Set([...values.keys()].filter(k=>k.startsWith('week:')).map(k=>k.split(':')[1]));
 assert.equal(weeks.size,3);
 for(const month of [1,2,3,4])await board.record({username:'steady',receipt:'m'+month,win:true,at:Date.UTC(2026,month,10)},Date.UTC(2026,month,10));
 assert.ok(values.has('season:2026-01:top'),'the January podium is kept');assert.ok(!values.has('season:2026-01:p:steady'),'January player rows are removed');
});

test('a verified match reaches the public board once; practice and the public API cannot add points',async()=>{
 const env=environment(),player=await signup(env,'fahad_7');assert.equal(player.response.status,201);
 const account=env.BOARD_ROOMS.get('social:user:fahad_7');
 const verified=()=>account.fetch('https://social.internal/career/verified',{method:'POST',body:JSON.stringify({id:'quiz:room1:1700000000000:p1',game:'quiz',win:true})});
 assert.equal((await verified()).status,200);assert.equal((await verified()).status,200);
 await api(env,'/api/social/career/practice',{id:'practice-1',game:'memory',win:true},player.data.token);
 await Worker.default.fetch(new Request('https://game.test/api/leaderboard/record',{method:'POST',headers:{Origin:'https://game.test','content-type':'application/json'},body:JSON.stringify({username:'fahad_7',receipt:'forged',win:true})}),env);
 const board=await api(env,'/api/leaderboard?period=week&player=fahad_7');
 assert.equal(board.response.status,200);assert.equal(board.data.players.length,1);
 assert.equal(board.data.players[0].username,'fahad_7');assert.equal(board.data.players[0].points,250);assert.equal(board.data.me.rank,1);
 const season=await api(env,'/api/leaderboard?period=season');assert.equal(season.data.players[0].points,250);assert.equal(season.data.me,null);
});

test('the owner account is marked on the board so it can be shown with its royal badge',async()=>{
 const env=environment();await signup(env,'bosrag');
 await env.BOARD_ROOMS.get('social:user:bosrag').fetch('https://social.internal/career/verified',{method:'POST',body:JSON.stringify({id:'serpent:x:1:o',game:'serpent',win:false})});
 const board=await api(env,'/api/leaderboard?period=week');assert.equal(board.data.players[0].owner,true);
});

function roomFixture(Room,prefix){
 let now=1_000_000,fail=false;const values=new Map(),sockets=[],calls=[];
 const env={BOARD_ROOMS:{idFromName:name=>name,get:name=>({fetch:async(url,init)=>{calls.push({name,url:String(url),body:JSON.parse(init.body)});return new Response('{}',{status:fail?503:200});}})}};
 const ctx={storage:{get:async k=>structuredClone(values.get(k)),put:async(k,v)=>values.set(k,structuredClone(v)),setAlarm:async t=>{ctx.alarmAt=t},deleteAll:async()=>values.clear()},blockConcurrencyWhile:fn=>Promise.resolve().then(fn),getWebSockets:()=>sockets};
 const room=new Room(ctx,env),original=Date.now;Date.now=()=>now;
 return {room,ctx,calls,time:t=>{now=t},fail:v=>{fail=v},restore:()=>{Date.now=original},
  async init(capacity=4){await room.ready;assert.equal((await room.fetch(new Request(`https://${prefix}.internal/init`,{method:'POST',body:JSON.stringify({code:'123456',hostKey:'h'.repeat(40),capacity,difficulty:1})}))).status,201);},
  add(id,role='guest'){const p={id,role,name:id,token:id,connection:id,connected:true,joinedAt:now,username:'user_'+id};room.room.players[id]=p;room.room.order.push(id);const messages=[],socket={deserializeAttachment:()=>({[prefix]:true,playerId:id,connection:id}),send:v=>messages.push(JSON.parse(v)),close(){}};sockets.push(socket);return {p,messages,send:m=>room.webSocketMessage(socket,JSON.stringify(m))};}};
}
async function playToDeadline(f,host){await host.send({type:'start'});f.time(f.room.room.startsAt);await f.room.alarm();assert.equal(f.room.room.status,'playing');f.time(f.room.room.deadline);await f.room.alarm();assert.equal(f.room.room.status,'finished');}

for(const [Room,game] of [[SudokuRoom,'sudoku'],[PathsRoom,'paths']]){
 test(`${game} friend rooms issue one verified result per account with a stable receipt`,async()=>{
  const f=roomFixture(Room,game);try{
   await f.init();const host=f.add('host','host');f.add('guest');await playToDeadline(f,host);
   const r=f.room.room;assert.equal(r.rewardsComplete,true);assert.equal(f.calls.length,2);
   for(const c of f.calls){assert.match(c.url,/career\/verified$/);assert.equal(c.body.game,game);assert.equal(c.body.id,`${game}:123456:${r.startsAt}:${c.body.id.split(':').at(-1)}`);}
   assert.deepEqual(f.calls.map(c=>c.name).sort(),['social:user:user_guest','social:user:user_host']);
  }finally{f.restore();}
 });
 test(`${game} solo rooms stay practice and never issue verified results`,async()=>{
  const f=roomFixture(Room,game);try{await f.init(1);const host=f.add('host','host');await playToDeadline(f,host);assert.equal(f.calls.length,0);assert.equal(f.room.room.rewardsComplete,true);}finally{f.restore();}
 });
 test(`${game} retries a failed result, blocks the rematch meanwhile, and gives up after a bounded number of tries`,async()=>{
  const f=roomFixture(Room,game);try{
   await f.init();const host=f.add('host','host');f.add('guest');f.fail(true);await playToDeadline(f,host);
   const r=f.room.room,first=f.calls[0].body.id;assert.equal(r.rewardsComplete,false);assert.ok(r.rewardRetryAt>Date.now());
   await host.send({type:'rematch'});assert.equal(f.room.room.status,'finished');assert.match(host.messages.at(-1).message,/حفظ/);
   f.fail(false);f.time(r.rewardRetryAt);await f.room.alarm();assert.equal(f.room.room.rewardsComplete,true);
   assert.equal(f.calls.filter(c=>c.body.id===first).length,2,'the retry reuses the same receipt');
   const g=roomFixture(Room,game);try{await g.init();const h=g.add('host','host');g.add('guest');g.fail(true);await playToDeadline(g,h);
    for(let i=0;i<10&&g.room.room.rewardsComplete===false;i++){g.time(g.room.room.rewardRetryAt);await g.room.alarm();}
    assert.equal(g.room.room.rewardsComplete,true);assert.equal(g.room.room.rewardAttempts,6);}finally{g.restore();}
  }finally{f.restore();}
 });
 test(`${game} keeps a player who left mid-match until their result is saved`,async()=>{
  const f=roomFixture(Room,game);try{
   await f.init();const host=f.add('host','host'),guest=f.add('guest');
   await host.send({type:'start'});f.time(f.room.room.startsAt);await f.room.alarm();
   const sockets=f.ctx.getWebSockets();sockets.splice(sockets.findIndex(s=>s.deserializeAttachment().playerId==='guest'),1);
   Object.assign(f.room.room.players.guest,{connected:false,disconnectedAt:Date.now()});
   f.fail(true);f.time(f.room.room.deadline);await f.room.alarm();
   const r=f.room.room;assert.equal(r.rewardsComplete,false);
   // Another alarm fires after the reconnect grace but before the retry time.
   f.time(Math.max(f.room.room.players.guest.disconnectedAt+60000,r.deadline+1000));r.rewardRetryAt=Date.now()+5000;await f.room.alarm();
   assert.ok(f.room.room.order.includes('guest'),'the absent player is not removed while the result is pending');
   f.fail(false);f.time(f.room.room.rewardRetryAt);await f.room.alarm();
   assert.equal(f.room.room.rewardsComplete,true);
   assert.ok(f.calls.some(c=>c.name==='social:user:user_guest'&&c.body.game===game),'the absent player still gets the verified result');
   f.time(Date.now()+1000);await f.room.alarm();assert.ok(!f.room.room.order.includes('guest'),'normal cleanup resumes afterwards');
  }finally{f.restore();}
 });
}
