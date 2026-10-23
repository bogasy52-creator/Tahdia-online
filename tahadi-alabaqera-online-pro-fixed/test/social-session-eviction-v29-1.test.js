import test from 'node:test';
import assert from 'node:assert/strict';
import {environment,signup,api} from './worker-harness.mjs';
import {parseSessionToken,sha256} from '../src/social/social-core.js';

test('new login retains its session and evicts the oldest record rather than a hash-sorted key',async t=>{
 const now=1790000000000;t.mock.method(Date,'now',()=>now);
 const env=environment();await signup(env,'sessiontest');const {instance,ctx}=env.BOARD_ROOMS.peek('social:user:sessiontest');
 for(const key of(await ctx.storage.list({prefix:'session:'})).keys())await ctx.storage.delete(key);
 for(let i=0;i<8;i++)await ctx.storage.put('session:~legacy'+i,{createdAt:now-1000-i*1000,expiresAt:now+86400000});
 const user=await instance.socialDelegate(),fresh=await user.createSession(),parsed=parseSessionToken(fresh.token),key='session:'+await sha256(parsed.secret);
 assert.equal(await user.sessionValid(parsed.secret),true);assert.ok(await ctx.storage.get(key));assert.equal(await ctx.storage.get('session:~legacy7'),undefined);
 assert.equal((await ctx.storage.list({prefix:'session:'})).size,8);
});
test('expired sessions are removed before applying the active-session limit',async t=>{
 const now=1790000000000;t.mock.method(Date,'now',()=>now);
 const env=environment();await signup(env,'sessionexpiry');const {instance,ctx}=env.BOARD_ROOMS.peek('social:user:sessionexpiry');
 await ctx.storage.put('session:~expired',{createdAt:now+1000,expiresAt:now-1});await(await instance.socialDelegate()).createSession();assert.equal(await ctx.storage.get('session:~expired'),undefined);
});

test('two simultaneous signups cannot overwrite the same account',async()=>{
 const env=environment();const replies=await Promise.all(['First','Second'].map(name=>api(env,'/api/social/signup',{username:'signup_race',displayName:name,password:name+'-test-password'})));
 assert.deepEqual(replies.map(r=>r.response.status).sort(),[201,409]);
});
