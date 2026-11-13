import test from 'node:test';
import assert from 'node:assert/strict';
import {Career} from '../src/career/core.js';
import {environment,api,signup} from './worker-harness.mjs';
test('a Jewels draw records participation once without a win or loss',()=>{
 const before=Career.normalize({wins:2,losses:3,rankedWins:1,rankedLosses:2,games:5}),r={id:'draw:713',game:'jewels',draw:true,verified:true},after=Career.reward(before,r);
 assert.equal(after.games,6);assert.equal(after.wins,2);assert.equal(after.losses,3);assert.equal(after.rankedWins,1);assert.equal(after.rankedLosses,2);assert.equal(after.xp,before.xp+80);assert.equal(after.coins,before.coins+15);assert.deepEqual(after.stats.jewels,[1,0]);assert.deepEqual(Career.reward(after,r),after);
});
test('ordinary rewards remain unchanged; only a Jewels non-win can be a draw',()=>{
 const win=Career.reward({},{id:'r:win',game:'jewels',win:true,draw:true});assert.equal(win.wins,1);assert.equal(win.losses,0);assert.equal(win.xp,100);
 const loss=Career.reward({},{id:'r:loss',game:'jewels'});assert.equal(loss.losses,1);assert.equal(loss.xp,40);assert.equal(Career.reward({},{id:'r:other',game:'zahra',draw:true}).losses,1);
});
test('authenticated practice preserves a draw rather than recording a loss',async()=>{
 const env=environment(),a=await signup(env,'drawplayer'),r=await api(env,'/api/social/career/practice',{id:'p:draw',game:'jewels',draw:true,win:false},a.data.token);assert.equal(r.response.status,200);assert.equal(r.data.career.games,1);assert.equal(r.data.career.losses,0);assert.equal(r.data.career.wins,0);
});
