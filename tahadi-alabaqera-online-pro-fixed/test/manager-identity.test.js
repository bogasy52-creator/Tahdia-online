import test from 'node:test';
import assert from 'node:assert/strict';
import {environment,api,signup} from './worker-harness.mjs';
import {createDOM} from './dom-harness.mjs';
import {Career} from '../src/career/core.js';
const ownerAccess={role:'owner',allItems:true,capabilities:['accounts.read','economy.manage']};
test('legacy mixed-case owner records and sessions retain authenticated management permissions',async()=>{
 const env=environment(),sign=await signup(env,'BoSraG'),holder=env.BOARD_ROOMS.peek('social:user:bosrag');
 const stored=await holder.ctx.storage.get('profile');stored.username='BoSraG';await holder.ctx.storage.put('profile',stored);holder.instance=new holder.instance.constructor(holder.ctx,env);await holder.ctx.ready;
 const mixed='BoSraG.'+sign.data.token.split('.')[1];
 const res=await api(env,'/api/social/career',undefined,mixed);assert.equal(res.response.status,200);assert.equal(res.data.access.role,'owner');assert.equal(res.data.career.owned.length,Career.CATALOG.length);
 assert.equal((await holder.ctx.storage.get('profile')).username,'bosrag');
 const self=await api(env,'/api/social/admin/action',{username:'BoSraG',action:'coins',amount:10,requestId:'case-self-001'},mixed);assert.equal(self.response.status,200);assert.equal(self.data.account.career.coins,110);
});
test('a display name BoSraG cannot turn a different authenticated account into a manager',async()=>{
 const env=environment(),sign=await api(env,'/api/social/signup',{username:'playera',displayName:'BoSraG',password:'StrongPass123!'});
 const res=await api(env,'/api/social/career',undefined,sign.data.token);assert.equal(res.data.access.role,'player');assert.equal((await api(env,'/api/social/admin',undefined,sign.data.token)).response.status,403);
});
async function client(fetch){const h=await createDOM('social.html');h.context.AbortSignal=AbortSignal;h.storage.set('bs_social_session','BoSraG.'+'x'.repeat(43));h.context.fetch=fetch;await h.runFile('assets/js/profile-core.js');await h.runFile('assets/js/career-client.js');await h.context.BS_CAREER.refresh();return h}
test('the client accepts a mixed-case owner session and displays the verified manager panel',async()=>{
 const h=await client(async()=>Response.json({username:'bosrag',career:Career.normalize(),access:ownerAccess}));
 assert.equal(h.context.BS_CAREER.account(),'bosrag');assert.equal(h.context.BS_CAREER.access().role,'owner');
 const panel=h.doc.querySelector('[data-manager-panel]');assert.ok(panel);assert.equal(panel.classList.contains('hidden'),false);assert.ok(panel.textContent.includes('صلاحيات المدير كاملة'));assert.equal(h.doc.querySelector('[data-manager-link]').classList.contains('hidden'),false);
});
test('an old backend is diagnosed visibly instead of silently hiding the manager entry',async()=>{
 const h=await client(async url=>url.includes('/admin')?Response.json({error:'not_found'},{status:404}):Response.json({username:'bosrag',career:Career.normalize()}));
 assert.equal(h.context.BS_CAREER.access().role,'player');assert.equal(h.doc.querySelector('[data-manager-panel]').classList.contains('hidden'),false);assert.ok(h.doc.querySelector('[data-manager-status]').textContent.includes('السيرفر'));
});
test('manager access is checked separately if career synchronization fails',async()=>{
 const h=await client(async url=>url.includes('/admin')?Response.json({ok:true,access:ownerAccess}):Response.json({error:'unavailable'},{status:503}));
 assert.equal(h.context.BS_CAREER.access().role,'owner');assert.equal(h.doc.querySelector('[data-manager-link]').classList.contains('hidden'),false);assert.ok(h.doc.querySelector('[data-manager-status]').textContent.includes('صلاحيات المدير كاملة'));
});
test('an expired mixed-case token shows a login instruction without granting permissions',async()=>{
 const h=await createDOM('shop.html');h.context.AbortSignal=AbortSignal;h.storage.set('bs_social_session','BoSraG.'+'z'.repeat(43));h.context.fetch=async()=>Response.json({error:'unauthorized'},{status:401});await h.runFile('assets/js/profile-core.js');await h.runFile('assets/js/career-client.js');await assert.rejects(()=>h.context.BS_CAREER.refresh());
 assert.equal(h.context.BS_CAREER.access().role,'player');assert.ok(h.doc.querySelector('[data-manager-status]').textContent.includes('الدخول'));assert.ok(h.doc.querySelector('[data-manager-panel]').textContent.includes('BoSraG'));
});
test('admin page explains an outdated server and provides a retry control',async()=>{
 const h=await createDOM('admin.html');h.context.AbortSignal=AbortSignal;h.storage.set('bs_social_session','BoSraG.'+'x'.repeat(43));h.context.fetch=async()=>new Response('old server',{status:404});await h.runFile('assets/js/admin.js');await h.context.BS_ADMIN.ready;
 assert.ok(h.doc.getElementById('adminAccessMessage').textContent.includes('السيرفر'));assert.ok(h.doc.getElementById('adminAccessRetry'));assert.equal(h.doc.getElementById('adminWorkspace').classList.contains('hidden'),true);
});
