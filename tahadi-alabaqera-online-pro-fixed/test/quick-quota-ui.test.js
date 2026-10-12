import test from 'node:test';
import assert from 'node:assert/strict';
import {createDOM} from './dom-harness.mjs';

test('quick match polling stops immediately when the server reports its daily request quota',async()=>{
 const env=await createDOM('online.html');let calls=0;
 env.context.location.search='?quickMatch=test-match';
 env.context.TahdiaMatchmaking={session:()=>({id:'seat',secret:'test-secret',matchId:'test-match'}),request:async()=>{calls++;const e=new Error('وصلت خدمة الأونلاين إلى حد الطلبات اليومي');e.code='DURABLE_REQUEST_LIMIT';throw e}};
 await env.runFile('assets/js/quick-match-game.js');await new Promise(setImmediate);
 assert.equal(calls,1);assert.equal(env.timers.size,0);assert.match(env.doc.getElementById('qmStatus').textContent,/حد الطلبات/);
});
