import {sha256,verifyPassword,hashPassword,validatePassword} from './social-core.js';
const TTL=180*86400000,WINDOW=15*60000,LIMIT=6;
const json=(value,status=200)=>Response.json(value,{status,headers:{'cache-control':'no-store'}});
const failed=()=>json({ok:false,error:'تعذّر الاسترجاع. تحقق من اسم المستخدم والرمز وصلاحيته.'},400);
const normalize=code=>typeof code==='string'&&code.length<=40?code.toUpperCase().replace(/[ -]/g,''):'';
async function allow(storage,key,now){const old=await storage.get(key),r=old?.until>now?old:{count:0,until:now+WINDOW};if(r.count>=LIMIT)return false;r.count++;await storage.put(key,r);return true;}
export async function issueRecovery(user,body,now=Date.now()){
 if(!(await user.sessionValid(body.secret)))return json({ok:false,error:'unauthorized'},401);
 if(!(await allow(user.ctx.storage,'recovery:issue-attempts',now)))return json({ok:false,error:'محاولات كثيرة؛ انتظر 15 دقيقة.'},429);
 if(!(await verifyPassword(String(body.password||''),user.profile.password)))return json({ok:false,error:'كلمة المرور الحالية غير صحيحة.'},401);
 const codes=Array.from({length:6},()=>Array.from(crypto.getRandomValues(new Uint8Array(12)),b=>b.toString(16).padStart(2,'0')).join('').toUpperCase().match(/.{4}/g).join('-'));
 await user.ctx.storage.put('recovery:codes',{hashes:await Promise.all(codes.map(c=>sha256(normalize(c)))),createdAt:now,expiresAt:now+TTL});
 return json({ok:true,codes,expiresAt:now+TTL});
}
export async function recoveryStatus(user,body,now=Date.now()){
 if(!(await user.sessionValid(body.secret)))return json({ok:false,error:'unauthorized'},401);
 const r=await user.ctx.storage.get('recovery:codes');return json({ok:true,remaining:r?.expiresAt>now?r.hashes.length:0,expiresAt:r?.expiresAt||null});
}
export async function resetWithRecovery(user,body,now=Date.now()){
 const storage=user.ctx.storage;if(!(await allow(storage,'recovery:reset-attempts',now)))return json({ok:false,error:'محاولات كثيرة؛ انتظر 15 دقيقة.'},429);
 const code=normalize(body.code),hash=await sha256(code),saved=await storage.get('recovery:codes');
 if(!user.profile||user.profile.suspended||!/^[A-F0-9]{24}$/.test(code)||!saved||saved.expiresAt<=now||!saved.hashes.includes(hash))return failed();
 const invalid=validatePassword(body.password);if(invalid)return json({ok:false,error:invalid},400);
 const next={...user.profile,password:await hashPassword(String(body.password)),updatedAt:now};
 await storage.transaction(async tx=>{const r=await tx.get('recovery:codes');if(!r?.hashes.includes(hash)||r.expiresAt<=now)throw Error('recovery_consumed');await tx.put('profile',next);await tx.put('recovery:codes',{...r,hashes:r.hashes.filter(h=>h!==hash)});const sessions=await tx.list({prefix:'session:'});if(sessions.size)await tx.delete([...sessions.keys()]);await tx.delete('recovery:reset-attempts');});
 user.profile=next;for(const ws of user.ctx.getWebSockets())try{ws.close(1008,'password_reset');}catch{}
 return json({ok:true});
}
