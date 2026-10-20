import test from 'node:test';
import assert from 'node:assert/strict';
import {Career} from '../src/career/core.js';
import {createDOM} from './dom-harness.mjs';
import {environment,api,signup} from './worker-harness.mjs';
const now=Date.parse('2026-10-14T12:00:00Z'),ids=['pawn-jade','dice-porcelain'],requestId='checkout-regression-0001';
test('checkout buys the entire selection once, equips each type and preserves the input',()=>{
 const before=Career.normalize({coins:2000}),saved=structuredClone(before),quote=Career.cartQuote(before,ids,{now});
 const after=Career.purchaseCart(before,ids,{now,expectedPrice:quote.price,requestId});assert.deepEqual(before,saved);assert.equal(after.coins,2000-quote.price);
 assert.equal(after.equipped.pawn,ids[0]);assert.equal(after.equipped.dice,ids[1]);assert.equal(after.checkouts.length,1);assert.equal(after.receipts.length,0);
 assert.deepEqual(Career.purchaseCart(after,ids,{now:now+86400000,expectedPrice:quote.price,requestId}),after);
});
test('invalid, locked, duplicate, unaffordable and stale-price carts never partially purchase',()=>{
 const p=Career.normalize({coins:100}),saved=structuredClone(p);
 for(const items of [[],['missing'],['title-manager'],[ids[0],ids[0]],Array(13).fill(ids[0])])assert.throws(()=>Career.purchaseCart(p,items,{now,expectedPrice:0,requestId}));
 const quote=Career.cartQuote(p,ids,{now});assert.throws(()=>Career.purchaseCart(p,ids,{now,expectedPrice:quote.price,requestId}),/insufficient_coins/);
 const funded=Career.normalize({coins:2000});assert.throws(()=>Career.purchaseCart(funded,ids,{now,expectedPrice:1,requestId}),/price_changed/);assert.throws(()=>Career.purchaseCart(funded,ids,{now,requestId}),/price_changed/);assert.deepEqual(p,saved);
});
test('checkout identity cannot be reused for different items or forged by a game receipt',()=>{
 let p=Career.normalize({coins:2000,receipts:['checkout:'+requestId]});const quote=Career.cartQuote(p,ids,{now});p=Career.purchaseCart(p,ids,{now,expectedPrice:quote.price,requestId});assert.ok(p.owned.includes(ids[0]));
 assert.throws(()=>Career.purchaseCart(p,['snake-plasma'],{now,expectedPrice:quote.price,requestId}),/checkout_conflict/);
});
test('owned pieces cost nothing and the last selected appearance per type is equipped',()=>{
 const chosen=['pawn-jade','pawn-amethyst'],p=Career.normalize({coins:2000,owned:['pawn-jade']}),quote=Career.cartQuote(p,chosen,{now});assert.equal(quote.items[0].price,0);
 const after=Career.purchaseCart(p,chosen,{now,expectedPrice:quote.price,requestId});assert.equal(after.equipped.pawn,'pawn-amethyst');assert.equal(after.coins,2000-quote.price);
});
test('actual Worker checkout is authenticated, server-priced, atomic and retry-safe',async()=>{
 const env=environment(),account=await signup(env,'playera'),token=account.data.token,holder=env.BOARD_ROOMS.peek('social:user:playera');await holder.ctx.storage.put('career',Career.normalize({coins:2000}));
 const before=(await api(env,'/api/social/career',undefined,token)).data.career,quote=Career.cartQuote(before,ids),body={ids,expectedPrice:quote.price,requestId};
 assert.equal((await api(env,'/api/social/career/cart',body)).response.status,401);
 assert.equal((await api(env,'/api/social/career/cart',{...body,expectedPrice:0},token)).response.status,400);
 assert.equal((await api(env,'/api/social/career',undefined,token)).data.career.coins,2000);
 for(const response of await Promise.all([api(env,'/api/social/career/cart',body,token),api(env,'/api/social/career/cart',body,token)]))assert.equal(response.response.status,200);
 const after=(await api(env,'/api/social/career',undefined,token)).data.career;assert.equal(after.coins,2000-quote.price);assert.equal(after.checkouts.length,1);assert.ok(ids.every(id=>after.owned.includes(id)));
 assert.equal((await api(env,'/api/social/career/cart',{...body,ids:['snake-plasma']},token)).data.error,'checkout_conflict');
});
test('store basket persists, checkout debits once and closing the drawer restores focus',async()=>{
 const h=await createDOM('shop.html');h.storage.set('busraj-career-v6',JSON.stringify(Career.normalize({coins:2000})));await h.runFile('assets/js/profile-core.js');await h.runFile('assets/js/career-client.js');await h.context.BS_CAREER.refresh();await h.runFile('assets/js/shop.js');
 for(const id of ids)h.doc.querySelector('[data-item="'+id+'"] .cart-add-v15').onclick();assert.equal(h.doc.getElementById('cartCount').textContent,'2');assert.equal(JSON.parse(h.storage.get('tahdia-cart-v15:guest')).ids.length,2);
 const opener=h.doc.getElementById('cartOpen');opener.focus();opener.onclick();assert.equal(h.doc.activeElement.id,'cartClose');assert.equal(h.doc.querySelector('main').inert,true);
 const price=Number(h.doc.getElementById('cartTotal').textContent),checkout=h.doc.getElementById('cartCheckout');await Promise.all([checkout.onclick(),checkout.onclick()]);assert.equal(h.context.BS_CAREER.get().coins,2000-price);assert.equal(h.doc.getElementById('cartCount').textContent,'0');assert.equal(h.doc.getElementById('cartDialog').classList.contains('hidden'),true);assert.equal(h.doc.activeElement,opener);
});
