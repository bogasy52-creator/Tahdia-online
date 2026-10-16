import test from 'node:test';
import assert from 'node:assert/strict';
import {createJewels,moveJewels,jewelPaths,createPaths,movePaths,hintPaths,clearPath,replayProof,commitJourney,normalizeJourney,nextStage,dayKey,journeyStats,starsFor,adjacent} from '../public/assets/js/engines/journey-engine.js';
import {environment,api,signup} from './worker-harness.mjs';
import {solveJewels} from './journey-helpers.mjs';
function pathsProof(level=1,daily=''){let state=createPaths(level,daily);for(let color=0;color<state.pairs.length;color++)state=movePaths(state,color,state.solution[color]).state;return {game:'paths',level,daily,log:state.log};}
test('all 60 path stages have continuous, non-overlapping, full-cover solutions',()=>{
  const boards=new Set();for(let level=1;level<=60;level++){let state=createPaths(level);assert.equal(new Set(state.solution.flat()).size,state.size*state.size);for(const path of state.solution)for(let i=1;i<path.length;i++)assert.ok(adjacent(path[i-1],path[i],state.size));for(let color=0;color<state.pairs.length;color++){const next=movePaths(state,color,state.solution[color]);assert.ok(next.accepted);state=next.state;}assert.ok(state.won);assert.equal(starsFor(state),3);boards.add(JSON.stringify(state.pairs));}assert.equal(boards.size,60);
});
test('jewel stages are deterministic, have legal moves and can be completed with legal chains',()=>{
  const failed=[];for(let level=1;level<=60;level++){const first=createJewels(level);assert.deepEqual(first,createJewels(level));assert.ok(jewelPaths(first).length);const solved=solveJewels(level);if(!solved.won)failed.push(level);else assert.ok(replayProof({game:'jewels',level,log:solved.log}).stars>=1);}assert.deepEqual(failed,[]);
});
test('chains reject wraps, repeated cells, wrong colours, short and out-of-range paths without mutation',()=>{
  const state=createJewels(1),before=structuredClone(state);for(const path of [[-1,0,1],[0,0,0],[0,1],[0,5,6],new Array(60).fill(0),[NaN,1,2]])assert.equal(moveJewels(state,path).accepted,false);assert.deepEqual(state,before);assert.equal(adjacent(5,6,6,true),false);const legal=jewelPaths(state)[0];assert.ok(moveJewels(state,legal).accepted);
});
test('path moves reject crossed paths, diagonal shortcuts and wrong endpoints',()=>{
  const state=createPaths(1),path=state.solution[0],first=movePaths(state,0,path);assert.ok(first.accepted);assert.equal(movePaths(first.state,1,path).accepted,false);assert.equal(movePaths(state,0,[path[0],path.at(-1)]).accepted,false);assert.equal(movePaths(state,0,[path[0],path[0],path.at(-1)]).accepted,false);assert.ok(movePaths(clearPath(first.state,0),0,path).accepted);
});
test('bounded hints solve a path, remove intersections, and are reproduced by the server',()=>{
  let state=createPaths(1);for(let i=0;i<3;i++)state=hintPaths(state).state;assert.ok(state.won);assert.equal(starsFor(state),1);assert.equal(hintPaths(state).accepted,false);assert.equal(replayProof({game:'paths',level:1,log:state.log}).stars,1);
});
test('stage advancement, best stars and completion receipts are idempotent',()=>{
  assert.throws(()=>commitJourney({},pathsProof(2)),/stage_locked/);const one=commitJourney({},pathsProof());assert.ok(one.first);assert.equal(nextStage(one.journey,'paths'),2);const twice=commitJourney(one.journey,pathsProof());assert.equal(twice.first,false);assert.equal(twice.stars,3);assert.equal(journeyStats(twice.journey).stars,3);assert.deepEqual(twice.journey,one.journey);assert.throws(()=>replayProof({...pathsProof(),level:undefined}),/invalid_proof/);
});
test('daily challenges rotate at Riyadh midnight and reject expired or future reward claims',()=>{
  const now=Date.parse('2026-10-15T21:00:00Z');assert.equal(dayKey(now),'2026-10-16');assert.equal(dayKey(now-1),'2026-10-15');assert.deepEqual(createPaths(1,dayKey(now)),createPaths(1,dayKey(now)));assert.notDeepEqual(createPaths(1,dayKey(now)).pairs,createPaths(1,dayKey(now-86400000)).pairs);assert.ok(commitJourney({},pathsProof(1,'2026-10-15'),{now}).first);assert.throws(()=>commitJourney({},pathsProof(1,'2026-10-17'),{now}),/daily_expired/);assert.throws(()=>commitJourney({},pathsProof(1,'2026-10-13'),{now}),/daily_expired/);
});
test('profile normalization bounds star data and daily history while preserving earned stages',()=>{
  const p=normalizeJourney({stages:{jewels:{1:3,2:999,0:2,61:1,bad:3},paths:{1:2}}});assert.deepEqual(p.stages.jewels,{'1':3});assert.equal(journeyStats(p).stars,5);assert.equal(journeyStats(p).completed,2);assert.equal(journeyStats({daily:{'2026-10-14':{paths:3},'2026-10-15':{jewels:2}}},Date.parse('2026-10-16T09:00Z')).streak,2);
});
test('authenticated results are replayed, isolated by account, and rewarded once under simultaneous submissions',async()=>{
  const env=environment(),a=await signup(env,'journeya'),b=await signup(env,'journeyb'),token=a.data.token,proof=pathsProof();
  assert.equal((await api(env,'/api/social/career/journey',{proof})).response.status,401);
  const replies=await Promise.all(Array.from({length:4},()=>api(env,'/api/social/career/journey',{proof,coins:999999,username:'journeyb'},token)));
  for(const reply of replies)assert.equal(reply.response.status,200);
  const saved=(await api(env,'/api/social/career/journey',{},token)).data;
  assert.equal(saved.journey.stages.paths[1],3);assert.equal(saved.career.coins,120);assert.equal(saved.career.games,1);
  assert.deepEqual((await api(env,'/api/social/career/journey',{},b.data.token)).data.journey.stages.paths,{});
  assert.equal((await api(env,'/api/social/career/journey',{proof:{...proof,level:3}},token)).response.status,400);
  const forged=await api(env,'/api/social/career/journey',{proof:{game:'jewels',level:1,log:[],score:999999,won:true}},token);assert.equal(forged.response.status,400);
});
test('exclusive journey titles unlock from server-verified stars and cannot be forged or purchased early',async()=>{
 const env=environment(),a=await signup(env,'starhunter'),token=a.data.token;
 const forged=await api(env,'/api/social/career/journey',{stars:9999,owned:['title-starfinder']},token);assert.ok(!forged.data.career.owned.includes('title-starfinder'));
 assert.equal((await api(env,'/api/social/career/purchase',{id:'title-starfinder',expectedPrice:0},token)).response.status,400);
 let reply;for(let level=1;level<=10;level++)reply=await api(env,'/api/social/career/journey',{proof:pathsProof(level)},token);
 assert.ok(reply.data.career.owned.includes('title-starfinder'));assert.ok(!reply.data.career.owned.includes('title-pathmaster'));
 const equipped=await api(env,'/api/social/career/equip',{id:'title-starfinder'},token);assert.equal(equipped.data.career.equipped.title,'title-starfinder');
});
