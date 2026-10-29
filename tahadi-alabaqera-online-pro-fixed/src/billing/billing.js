import {signBillingGrant} from './proof.js';
import {Career} from '../career/core.js';
import {authenticate,getSocialStub} from '../social/social-api.js';
import {isOwner} from '../social/account-policy.js';
export const BILLING_OBJECT='__billing__:v1';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const json=(value,status=200)=>Response.json(value,{status,headers:{'cache-control':'no-store'}});
function config(env){let origin='';try{const u=new URL(env.PAYMENTS_PUBLIC_ORIGIN);if(u.protocol==='https:'&&u.pathname==='/'&&!u.username&&!u.password)origin=u.origin;}catch{}let overrides={},valid=true;try{overrides=JSON.parse(env.CHARACTER_PRICES_JSON||'{}');if(!overrides||Array.isArray(overrides)||typeof overrides!=='object')valid=false;for(const [id,value]of Object.entries(overrides))if(!Career.HERO_SIGNATURES[id]||!Number.isInteger(value)||value<100||value>100000)valid=false;}catch{valid=false;}return{enabled:env.PAYMENTS_ENABLED==='true'&&/^sk_(test|live)_/.test(env.MOYASAR_SECRET_KEY||'')&&Boolean(origin)&&valid,origin,overrides,valid};}
export function billingCatalog(env){const c=config(env);return{ok:true,enabled:c.enabled,currency:'SAR',mode:!env.MOYASAR_SECRET_KEY?'unconfigured':String(env.MOYASAR_SECRET_KEY).startsWith('sk_test_')?'test':'live',items:Career.HEROES.map(h=>({id:h.item,name:h.name,amount:c.overrides[h.id]??Career.HERO_SIGNATURES[h.id].cashPrice})).filter(i=>i.amount>0)};}
export function invoiceMatches(order,invoice){return Boolean(invoice&&invoice.id===order.invoiceId&&invoice.status==='paid'&&invoice.currency==='SAR'&&invoice.amount===order.amount&&invoice.metadata?.tahdia_order===order.id&&invoice.metadata?.tahdia_user===order.username&&invoice.metadata?.tahdia_item===order.item&&invoice.payments?.some(p=>(p.status==='paid'||p.status==='captured'&&p.captured===order.amount)&&p.invoice_id===order.invoiceId&&p.currency==='SAR'&&p.amount===order.amount&&p.refunded===0));}
function paymentURL(invoice){const u=new URL(invoice.url);if(u.protocol==='http:'&&u.hostname==='checkout.moyasar.com'&&!u.port)u.protocol='https:';if(u.origin!=='https://checkout.moyasar.com'||u.username||u.password||!(u.pathname==='/invoices/'+invoice.id||u.pathname==='/invoices/'+invoice.id+'/'))throw Error('invalid_provider_url');return u.href;}
export class BillingRegistry{
 constructor(ctx,env,fetcher=fetch){this.ctx=ctx;this.env=env;this.fetcher=fetcher;}
 async api(path,body){const response=await this.fetcher('https://api.moyasar.com/v1'+path,{method:body?'POST':'GET',headers:{authorization:'Basic '+btoa(this.env.MOYASAR_SECRET_KEY+':'),'content-type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(9000)});const data=await response.json().catch(()=>null);if(!response.ok||!data)throw Error('payment_provider_unavailable');return data;}
 publicOrder(order){return{ok:true,orderId:order.id,item:order.item,amount:order.amount,currency:'SAR',status:order.status,url:order.url||null};}
 async checkout(body){
  const cfg=config(this.env);if(!cfg.enabled)return json({ok:false,error:'payments_unavailable'},503);
  if(!/^[a-zA-Z0-9_-]{16,80}$/.test(body.requestId||''))return json({ok:false,error:'invalid_request_id'},400);
  const item=billingCatalog(this.env).items.find(i=>i.id===body.item);if(!item)return json({ok:false,error:'invalid_item'},400);
  const key='checkout:'+body.username+':'+body.requestId,activeKey='active:'+body.username+':'+item.id;let existingId=await this.ctx.storage.get(key);if(!existingId){const activeId=await this.ctx.storage.get(activeKey),active=activeId?await this.ctx.storage.get('order:'+activeId):null;if(active&&!['failed','refunded','canceled','expired','voided'].includes(active.status)){existingId=activeId;await this.ctx.storage.put(key,activeId);}}
  if(existingId){let old=await this.ctx.storage.get('order:'+existingId);if(old.item!==body.item)return json({ok:false,error:'checkout_conflict'},409);if(old.invoiceId){old=await this.verify(old);return json({...this.publicOrder(old),owned:old.status==='paid'});}
   // An unknown create outcome is reconciled; never create a second invoice on retry.
   const list=await this.api('/invoices?metadata[tahdia_order]='+encodeURIComponent(old.id));const invoice=list.invoices?.find(i=>i.metadata?.tahdia_order===old.id);if(invoice){old=await this.attach(old,invoice);return json(this.publicOrder(old));}return json({ok:false,error:'payment_reconciliation_pending',orderId:old.id},409);
  }
  if(body.expectedAmount!==item.amount)return json({ok:false,error:'price_changed'},409);
  const user=getSocialStub(this.env,body.username),res=await user.fetch('https://social.internal/career/get',{method:'POST',body:JSON.stringify({secret:body.secret})});const profile=await res.json();if(!res.ok)return json({ok:false,error:'unauthorized'},401);if(profile.career.owned.includes(item.id))return json({ok:true,owned:true});
  const order={id:crypto.randomUUID(),username:body.username,item:item.id,amount:item.amount,createdAt:Date.now(),status:'creating'};await this.ctx.storage.put({[key]:order.id,[activeKey]:order.id,['order:'+order.id]:order});
  try{const invoice=await this.api('/invoices',{amount:order.amount,currency:'SAR',description:'تحدي العباقرة · '+item.name,metadata:{tahdia_order:order.id,tahdia_user:order.username,tahdia_item:order.item},expired_at:new Date(Date.now()+30*60000).toISOString(),callback_url:cfg.origin+'/api/billing/callback',success_url:cfg.origin+'/shop?payment='+order.id,back_url:cfg.origin+'/shop?payment='+order.id});return json(this.publicOrder(await this.attach(order,invoice)));}
  catch{order.status='uncertain';await this.ctx.storage.put('order:'+order.id,order);return json({ok:false,error:'payment_reconciliation_pending',orderId:order.id},503);}
 }
 async attach(order,invoice){if(!UUID.test(invoice.id||'')||invoice.amount!==order.amount||invoice.currency!=='SAR'||invoice.metadata?.tahdia_order!==order.id||invoice.metadata?.tahdia_user!==order.username||invoice.metadata?.tahdia_item!==order.item)throw Error('invalid_invoice');const checkoutURL=paymentURL(invoice);order.invoiceId=invoice.id;order.url=checkoutURL;order.status='pending';await this.ctx.storage.put({['order:'+order.id]:order,['invoice:'+invoice.id]:order.id});return order;}
 async verify(order){if(order.status==='paid')return order;if(!order.invoiceId)return order;const invoice=await this.api('/invoices/'+order.invoiceId);if(invoiceMatches(order,invoice)){
   const user=getSocialStub(this.env,order.username);const response=await user.fetch('https://social.internal/billing/grant',{method:'POST',body:JSON.stringify({invoiceId:order.invoiceId,item:order.item,amount:order.amount,proof:await signBillingGrant(this.env.MOYASAR_SECRET_KEY,{username:order.username,invoiceId:order.invoiceId,item:order.item,amount:order.amount})})});if(!response.ok)throw Error('fulfillment_retry');
   order.status='paid';order.paidAt=Date.now();await this.ctx.storage.transaction(async tx=>{const stored=await tx.get('order:'+order.id);if(stored.status==='paid')return;const metrics=await tx.get('metrics')||{paid:0,revenue:0};metrics.paid++;metrics.revenue+=order.amount;await tx.put('metrics',metrics);await tx.put('order:'+order.id,order);});
  }else if(['failed','refunded','canceled','expired','voided'].includes(invoice.status)){order.status=invoice.status;await this.ctx.storage.put('order:'+order.id,order);}return order;}
 async fetch(request){const url=new URL(request.url),body=request.method==='POST'?await request.json().catch(()=>({})):{};
  try{
   if(url.pathname==='/checkout')return await this.checkout(body);
   if(url.pathname==='/status'){const order=UUID.test(body.orderId||'')?await this.ctx.storage.get('order:'+body.orderId):null;if(!order||order.username!==body.username)return json({ok:false,error:'not_found'},404);return json(this.publicOrder(await this.verify(order)));}
   if(url.pathname==='/callback'){if(!UUID.test(body.id||''))return json({ok:false,error:'invalid_invoice'},400);const id=await this.ctx.storage.get('invoice:'+body.id),order=id?await this.ctx.storage.get('order:'+id):null;if(!order)return json({ok:false,error:'not_found'},404);await this.verify(order);return json({ok:true});}
   if(url.pathname==='/admin'){const metrics=await this.ctx.storage.get('metrics')||{paid:0,revenue:0};return json({ok:true,...billingCatalog(this.env),metrics});}
  }catch{return json({ok:false,error:'payment_verification_retry'},503);}return json({ok:false,error:'not_found'},404);
 }
}
export async function handleBillingRequest(request,env,{rateLimit}={}){
 const u=new URL(request.url),path=u.pathname;if(path==='/api/billing/catalog'&&request.method==='GET')return json(billingCatalog(env));
 if(request.headers.get('origin')&&request.headers.get('origin')!==u.origin)return json({ok:false,error:'forbidden_origin'},403);
 if(!['/api/billing/checkout','/api/billing/status','/api/billing/callback','/api/billing/admin'].includes(path))return json({ok:false,error:'not_found'},404);
 if(request.method!==(path.endsWith('/admin')?'GET':'POST'))return json({ok:false,error:'method_not_allowed'},405);
 const limited=await rateLimit?.(request,env,'billing',path.endsWith('/callback')?60:12,60000);if(limited)return limited;
 if(!env.BOARD_ROOMS)return json({ok:false,error:'unavailable'},503);let body={};if(request.method==='POST'){const raw=await request.text();if(raw.length>131072)return json({ok:false,error:'too_large'},413);try{body=JSON.parse(raw);}catch{return json({ok:false,error:'invalid_json'},400);}}
 const action=path.split('/').pop();if(action!=='callback'){const auth=await authenticate(request,env);if(!auth)return json({ok:false,error:'unauthorized'},401);if(action==='admin'&&!isOwner(auth.profile))return json({ok:false,error:'forbidden'},403);body={...body,username:auth.username,secret:auth.secret};}
 const stub=env.BOARD_ROOMS.get(env.BOARD_ROOMS.idFromName(BILLING_OBJECT));return stub.fetch('https://billing.internal/'+action,{method:'POST',body:JSON.stringify(body)});
}
