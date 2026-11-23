import {accountCareer} from '../social/account-policy.js';
export const POOL_ENTRY_AMOUNTS=Object.freeze([0,25,100,250,1000]);
export function poolEntryAmount(value=0){if(!Number.isSafeInteger(value)||!POOL_ENTRY_AMOUNTS.includes(value))throw Error('invalid_pool_entry');return value;}
/* Durable per-account receipts make retries and late requests harmless. No public HTTP route exposes this ledger. */
export async function poolLedger(storage,profile,{action,id,amount,award=0}){
 if(!profile||!/^[-a-z0-9:]{8,120}$/i.test(id||'')||!['hold','settle','refund'].includes(action))throw Error('invalid_pool_receipt');
 poolEntryAmount(amount);if(!amount||![0,amount,amount*2].includes(award))throw Error('invalid_pool_award');
 return storage.transaction(async tx=>{
  const key='pool-entry:'+id,old=await tx.get(key),career=accountCareer(await tx.get('career')||{},profile);
  if(old&&old.amount!==amount)throw Error('pool_receipt_conflict');
  if(action==='hold'){
   if(old)return old;
   if(career.coins<amount)throw Error('رصيد أحد اللاعبين ما يكفي لدخول الطاولة');
   career.coins-=amount;const receipt={id,amount,status:'held',at:Date.now()};await tx.put('career',career);await tx.put(key,receipt);return receipt;
  }
  const credit=action==='refund'?amount:award;
  if(old?.status==='settled'){if(old.award!==credit)throw Error('pool_settlement_conflict');return old;}
  // Cancellation arrives before a timed-out hold: close the receipt without minting coins.
  if(!old){if(action!=='refund')throw Error('pool_hold_missing');const closed={id,amount,status:'settled',award:amount,cancelledBeforeHold:true};await tx.put(key,closed);return closed;}
  career.coins+=credit;const receipt={...old,status:'settled',award:credit,settledAt:Date.now()};await tx.put('career',career);await tx.put(key,receipt);return receipt;
 });
}
async function call(resolve,username,body){const stub=resolve(username);if(!stub)throw Error('account_unavailable');const res=await stub.fetch('https://social.internal/pool/ledger',{method:'POST',body:JSON.stringify(body),signal:AbortSignal.timeout(5000)});const data=await res.json();if(!res.ok||!data.ok)throw Error(data.error||'pool_ledger_failed');return data.receipt;}
async function save(host){host.room.poolRetryAt=Date.now()+5000;await host.ctx.storage.put('room',host.room);await host.ctx.storage.setAlarm(host.room.poolRetryAt);}
export async function reservePoolEntry(host,resolve){
 const r=host.room,amount=poolEntryAmount(r.poolStake),players=r.order.map(id=>r.players[id]);if(!amount)return;
 if(players.length!==2||players.some(p=>!p?.username||p.bot||p.poolAccepted!==amount)||new Set(players.map(p=>p.username)).size!==2)throw Error('يحتاج لاعبين بحسابين مختلفين وموافقة الاثنين على مبلغ الدخول');
 if(r.poolEntry&&!['settled','refunded'].includes(r.poolEntry.phase))throw Error('جاري مراجعة دخول الطاولة');
 const entry=r.poolEntry={id:r.code+':'+crypto.randomUUID(),amount,players:players.map(p=>p.username),phase:'preparing'};await save(host);
 try{for(const username of entry.players){const receipt=await call(resolve,username,{action:'hold',id:entry.id,amount});if(receipt.status!=='held')throw Error('pool_entry_cancelled');}entry.phase='held';await save(host);}
 catch(error){entry.phase='refunding';entry.awards=[amount,amount];await save(host);try{await settlePoolEntry(host,resolve,{refund:true});}catch{}throw error;}
}
export async function settlePoolEntry(host,resolve,{refund=false}={}){
 const r=host.room,e=r.poolEntry;if(!e||['settled','refunded'].includes(e.phase))return;
 if(!e.awards){const winner=r.state?.winner,valid=!refund&&r.status==='finished'&&[0,1].includes(winner);e.refund=!valid;e.awards=e.players.map((_,i)=>valid?(i===winner?e.amount*2:0):e.amount);e.phase=valid?'paying':'refunding';await save(host);}
 for(let i=0;i<e.players.length;i++)await call(resolve,e.players[i],{action:e.phase==='refunding'?'refund':'settle',id:e.id,amount:e.amount,award:e.awards[i]});
 e.phase=e.phase==='refunding'?'refunded':'settled';r.poolRetryAt=null;await host.ctx.storage.put('room',r);
}
