import {verifyBillingGrant} from '../billing/proof.js';
import {Career} from '../career/core.js';
import {normalizeJourney,commitJourney,journeyStats} from '../../public/assets/js/engines/journey-engine.js';
import {OWNER_USERNAME,isOwner,accountAccess,accountCareer} from './account-policy.js';
import {LEADERBOARD_OBJECT} from '../leaderboard/leaderboard.js';
import {
  SOCIAL_INVITE_TTL_MS,
  SOCIAL_MAX_FRIENDS,
  SOCIAL_MAX_NOTIFICATIONS,
  SOCIAL_MAX_REQUESTS,
  cleanDisplayName,
  createRandomSecret,
  createSessionToken,
  hashPassword,
  normalizeGame,
  normalizeRoomCode,
  normalizeUsername,
  publicProfile,
  sha256,
  validUsername,
  validatePassword,
  verifyPassword,
  gameJoinPath,
} from "./social-core.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

// 33.7.0: someone is "online" only while their page is still beating. The page pings every 25 seconds while it is open;
// a phone that lost its signal or closed the app never says goodbye, so an open socket alone proves nothing.
const LIVE_MS = 75_000;

// 33.9.4: ready pictures a player can pick, and the rules for an uploaded photo
export const PHOTO_PRESET_IDS = Object.freeze(["h-falcon", "h-desert", "g-princess", "g-fairy", "h-knight", "h-samurai", "g-princess-pink", "g-fairy-pink", "h-ninja", "h-viking", "g-princess-blue", "g-fairy-blue", "h-gladiator", "h-astronaut", "g-cat", "g-fox", "h-diver", "h-racer", "h-cyber", "h-robot"]);
export const photoPresetUrl = (id) => /^h-[a-z]+$/.test(id) ? "/assets/heroes/face/" + id.slice(2) + ".webp" : /^g-[a-z-]+$/.test(id) ? "/assets/avatars-v33-9-4/" + id.slice(2) + ".webp" : "";
export const PHOTO_PRESETS = Object.freeze(Object.fromEntries(PHOTO_PRESET_IDS.map((id) => [id, photoPresetUrl(id)])));
export const PHOTO_MAX_BYTES = 90_000;
// 33.9.7: the first new picture and the first new name are free; after that each change costs this
export const CHANGE_PRICE = 250;
export const PHOTO_REPORTS_TO_HIDE = 3;
export function decodePhoto(data, type) {
  if (!["image/webp", "image/jpeg"].includes(type) || typeof data !== "string" || data.length > PHOTO_MAX_BYTES * 1.4) return null;
  let bytes;
  try { bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0)); } catch { return null; }
  if (bytes.length < 200 || bytes.length > PHOTO_MAX_BYTES) return null;
  const webp = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if ((type === "image/webp" && !webp) || (type === "image/jpeg" && !jpeg)) return null;
  return bytes;
}
export function publicPhoto(profile) {
  const p = profile?.photo;
  if (!p || p.hidden) return null;
  return p.kind === "preset" ? { kind: "preset", id: p.id } : { kind: "upload", v: p.v };
}

function nowKey(prefix = "notification") {
  return `${prefix}:${String(Date.now()).padStart(14, "0")}:${crypto.randomUUID()}`;
}

function clone(value) {
  return value == null ? value : structuredClone(value);
}

export function createSocialUserClass(DurableObject) {
  return class SocialUser extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.profile = null;
    this.presence = { online: false, lastSeen: null };
    this.ready=this.ctx.blockConcurrencyWhile(async () => {
      this.profile = (await this.ctx.storage.get("profile")) || null;
      if(this.profile){
        const canonical=normalizeUsername(this.profile.username);
        if(validUsername(canonical)&&canonical!==this.profile.username){this.profile.username=canonical;await this.ctx.storage.put('profile',this.profile)}
      }
      this.presence = (await this.ctx.storage.get("presence")) || { online: false, lastSeen: null };
      if (this.profile) {
        this.lastPing = Number(this.presence.lastActiveAt) || 0;
        const live = this.liveSockets() && this.beatFresh();
        if (this.presence.online !== live) {
          this.presence.online = live;
          if (!live) this.presence.lastSeen = this.lastBeatAt() || this.presence.lastSeen || Date.now();
          await this.ctx.storage.put("presence", this.presence);
        }
        if (this.liveSockets() && !live) this.defer(this.ctx.storage.setAlarm(Date.now() + 1000));
      }
    });
  }

  async fetch(request) {
    const url = new URL(request.url);
    const body = request.method === "POST" || request.method === "PUT" || request.method === "DELETE"
      ? await request.json().catch(() => ({}))
      : {};

    if (url.pathname === "/signup" && request.method === "POST") return this.ctx.blockConcurrencyWhile(()=>this.signup(body));
    if (url.pathname === "/login" && request.method === "POST") return this.ctx.blockConcurrencyWhile(()=>this.login(body));
    if (url.pathname === "/validate" && request.method === "POST") return this.validateSession(body.secret);
    if (url.pathname === "/logout" && request.method === "POST") return this.logout(body.secret);
    if(url.pathname==='/reactions'&&request.method==='GET'){const p=accountCareer(await this.ctx.storage.get('career')||{},this.profile);return json({owned:p.owned.filter(id=>Career.reactionOf(id))});}
    if (url.pathname === "/public" && request.method === "GET") return this.publicData(url.searchParams.get("card") === "1");
    // 33.9.4: the player's picture: a ready one or an uploaded photo, reports and the owner's review
    if (url.pathname === "/photo/get" && request.method === "GET") return this.photoGet();
    if (url.pathname === "/photo/set" && request.method === "POST") return this.ctx.blockConcurrencyWhile(() => this.photoSet(body));
    if (url.pathname === "/photo/report" && request.method === "POST") return this.ctx.blockConcurrencyWhile(() => this.photoReport(body));
    if (url.pathname === "/photo/moderate" && request.method === "POST") return this.ctx.blockConcurrencyWhile(() => this.photoModerate(body));
    if (url.pathname.startsWith("/moderation/") && request.method === "POST") return this.ctx.blockConcurrencyWhile(() => this.moderationQueue(url.pathname.split("/")[2], body));
    if (url.pathname === "/dashboard" && request.method === "POST") return this.dashboard(body.secret);
    if (url.pathname === "/settings" && request.method === "POST") return this.updateSettings(body);
    if (url.pathname === '/announcement')return json({ok:true,announcement:await this.activeAnnouncement()});
    if (url.pathname.startsWith('/admin/')) {
      if(!(await this.sessionValid(body.secret)))return json({ok:false,error:'unauthorized'},401);
      if(!isOwner(this.profile))return json({ok:false,error:'forbidden'},403);
      const action=url.pathname.split('/')[2];
      return this.ctx.blockConcurrencyWhile(()=>this.adminRequest(action,body));
    }
    if (url.pathname.startsWith('/management/')) {
      if(body.actor!==OWNER_USERNAME)return json({ok:false,error:'forbidden'},403);
      if(!this.profile)return json({ok:false,error:'account_not_found'},404);
      return this.ctx.blockConcurrencyWhile(()=>url.pathname==='/management/get'?this.managedAccount():this.managementApply(body));
    }
    if(url.pathname==='/billing/grant'&&request.method==='POST'){
      if(!(await verifyBillingGrant(this.env.MOYASAR_SECRET_KEY,{username:this.profile?.username,invoiceId:body.invoiceId,item:body.item,amount:body.amount},body.proof)))return json({ok:false,error:'invalid_billing_proof'},403);
      if(!this.profile||!/^[-a-f0-9]{36}$/i.test(body.invoiceId||'')||!Career.CATALOG.some(i=>i.id===body.item&&i.type==='character')||!Number.isInteger(body.amount)||body.amount<100)return json({ok:false,error:'invalid_purchase'},400);
      return this.ctx.blockConcurrencyWhile(async()=>{const receipt='billing:invoice:'+body.invoiceId;await this.ctx.storage.transaction(async tx=>{const previous=await tx.get(receipt);if(previous){if(previous.item!==body.item)throw Error('purchase_conflict');return;}const career=accountCareer(await tx.get('career')||{name:this.profile.displayName},this.profile);const next=Career.normalize({...career,owned:[...career.owned,body.item]});await tx.put('career',next);await tx.put(receipt,{item:body.item,amount:body.amount,at:Date.now()});});return json({ok:true});});
    }
    if (url.pathname.startsWith('/career/')) {
      const action=url.pathname.split('/')[2];
      if (!['get','practice','purchase','equip','rename','verified','daily','claim','bundle','cart','journey','prize'].includes(action)) return json({ok:false,error:'not_found'},404);
      if(action!=='verified' && !(await this.sessionValid(body.secret)))return json({ok:false,error:'unauthorized'},401);
      if(!this.profile)return json({ok:false,error:'account_not_found'},404);
      return this.ctx.blockConcurrencyWhile(async()=>{
        let career=accountCareer(await this.ctx.storage.get('career')||{name:this.profile.displayName},this.profile);
        try{
          if(this.profile.suspended&&!isOwner(this.profile))throw new Error('account_suspended');
          if(action==='journey'){
            let journey=normalizeJourney(await this.ctx.storage.get('journey'));
            let result=null;
            if(body.proof){
              result=commitJourney(journey,body.proof);journey=result.journey;
              if(result.first)career=Career.reward(career,{id:result.receipt,game:body.proof.game,win:true});
              career=Career.unlockJourney(career,journeyStats(journey).stars);
              await this.ctx.storage.put({career,journey});
            }
            return json({ok:true,journey,career,stars:result?.stars,first:result?.first,access:accountAccess(this.profile),serverNow:Date.now()});
          }
          if(action==='practice'||action==='verified')career=Career.reward(career,{id:body.id,game:body.game,win:body.win===true,draw:body.draw===true,verified:action==='verified'});
          if(action==='daily')career=Career.claimDaily(career);
          // 33.2.0: a cup prize; only the Worker sends this, after the leaderboard confirmed the place
          if(action==='prize')career=Career.grant(career,{id:body.id,coins:body.coins});
          if(action==='purchase')career=Career.purchase(career,body.id,{expectedPrice:body.expectedPrice});
          if(action==='equip')career=Career.equip(career,body.id);
          if(action==='claim')career=Career.claimObjective(career,body.id);
          if(action==='bundle')career=Career.purchaseBundle(career,body.id,{expectedPrice:body.expectedPrice});
          if(action==='cart')career=Career.purchaseCart(career,body.ids,{expectedPrice:body.expectedPrice,requestId:body.requestId});
          if(action==='rename'){
            const next=Career.normalize({...career,name:body.name}),paid=(this.profile.renames||0)>=1&&!isOwner(this.profile);
            if(next.name===career.name)throw new Error('هذا اسمك الحين');
            if(paid&&career.coins<CHANGE_PRICE)throw new Error('تحتاج '+CHANGE_PRICE+' عملة عشان تغيّر اسمك');
            career=next;if(paid)career.coins-=CHANGE_PRICE;
            this.profile.renames=(this.profile.renames||0)+1;this.profile.displayName=career.name;await this.ctx.storage.put('profile',this.profile);
          }
        }catch(e){return json({ok:false,error:e.message},400)}
        await this.ctx.storage.put('career',career);
        if(action==='verified')await this.reportLeaderboard({receipt:String(body.id||''),game:body.game,win:body.win===true});
        return json({ok:true,career,access:accountAccess(this.profile),serverNow:Date.now()});
      });
    }

    if (url.pathname === "/friend/incoming" && request.method === "POST") return this.addIncomingRequest(body);
    if (url.pathname === "/friend/outgoing" && request.method === "POST") return this.addOutgoingRequest(body);
    if (url.pathname === "/friend/remove-incoming" && request.method === "POST") return this.removeRequest("incoming", body.username);
    if (url.pathname === "/friend/remove-outgoing" && request.method === "POST") return this.removeRequest("outgoing", body.username);
    if (url.pathname === "/friend/add" && request.method === "POST") return this.addFriend(body);
    if (url.pathname === "/friend/remove" && request.method === "POST") return this.removeFriend(body.username);
    if (url.pathname === "/friend/presence" && request.method === "POST") return this.friendPresence(body);
    if (url.pathname === "/live" && request.method === "GET") return this.liveStatus();
    if (url.pathname === "/friend/block" && request.method === "POST") return this.blockUser(body.username);
    if (url.pathname === "/friend/unblock" && request.method === "POST") return this.unblockUser(body.username);

    if (url.pathname === "/invite/incoming" && request.method === "POST") return this.incomingInvite(body);
    if (url.pathname === "/notifications/read" && request.method === "POST") return this.markNotificationsRead(body.ids);

    if (url.pathname === "/ws") return this.openWebSocket(request);
    return json({ ok: false, error: "not_found" }, 404);
  }

  async signup(body) {
    if (this.profile) return json({ ok: false, error: "اسم المستخدم مستخدم بالفعل" }, 409);
    const username = normalizeUsername(body.username);
    const displayName = cleanDisplayName(body.displayName || username);
    if (!validUsername(username)) return json({ ok: false, error: "اسم المستخدم 3–20 أحرف إنجليزية أو أرقام أو _" }, 400);
    const passwordError = validatePassword(body.password);
    if (passwordError) return json({ ok: false, error: passwordError }, 400);
    const createdAt = Date.now();
    const password = await hashPassword(String(body.password));
    this.profile = {
      username,
      displayName,
      password,
      createdAt,
      updatedAt: createdAt,
      settings: { allowInvites: "friends", showOnline: true },
    };
    await this.ctx.storage.put("profile", this.profile);
    await this.ctx.storage.put("presence", this.presence);
    const session = await this.createSession();
    return json({ ok: true, token: session.token, profile: publicProfile(this.profile, this.presence) }, 201);
  }

  async login(body) {
    if (!this.profile) return json({ ok: false, error: "الحساب غير موجود" }, 404);
    if(this.profile.suspended&&!isOwner(this.profile))return json({ok:false,error:'account_suspended'},403);
    const ok = await verifyPassword(String(body.password || ""), this.profile.password);
    if (!ok) return json({ ok: false, error: "بيانات الدخول غير صحيحة" }, 401);
    const session = await this.createSession();
    return json({ ok: true, token: session.token, profile: publicProfile(this.profile, this.presence) });
  }

  async createSession() {
    const secret = createRandomSecret(32);
    const hash = await sha256(secret);
    const createdAt = Date.now();
    const expiresAt = createdAt + 30 * 24 * 60 * 60 * 1000;
    const currentKey = `session:${hash}`;
    await this.ctx.storage.transaction(async tx => {
      await tx.put(currentKey, { createdAt, expiresAt });
      const sessions = await tx.list({ prefix: "session:" });
      const recent = [...sessions].filter(([key, record]) => key !== currentKey && Number(record?.expiresAt) > createdAt)
        .sort(([a, left], [b, right]) => Number(right.createdAt || 0) - Number(left.createdAt || 0) || a.localeCompare(b));
      const retained = new Set([currentKey, ...recent.slice(0, 7).map(([key]) => key)]);
      const removed = [...sessions.keys()].filter(key => !retained.has(key));
      if (removed.length) await tx.delete(removed);
    });
    return { token: createSessionToken(this.profile.username, secret), expiresAt };
  }

  async sessionValid(secret) {
    if (!this.profile || !secret || this.profile.suspended&&!isOwner(this.profile)) return false;
    const hash = await sha256(String(secret));
    const record = await this.ctx.storage.get(`session:${hash}`);
    if (!record) return false;
    if (Date.now() >= Number(record.expiresAt || 0)) {
      await this.ctx.storage.delete(`session:${hash}`);
      return false;
    }
    return true;
  }

  userStub(username) {
    const name=normalizeUsername(username),ns=this.env.SOCIAL_USERS||this.env.BOARD_ROOMS;
    return ns&&validUsername(name)?ns.get(ns.idFromName(this.env.SOCIAL_USERS?'user:'+name:'social:user:'+name)):null;
  }

  async activeAnnouncement() {
    const a = (await this.ctx.storage.get('admin:announcement')) || null;
    if (a && a.expiresAt && Date.now() >= a.expiresAt) { await this.ctx.storage.delete('admin:announcement'); return null; }
    return a;
  }

  async managedAccount() {
    const career=accountCareer(await this.ctx.storage.get('career')||{name:this.profile.displayName},this.profile);
    return json({ok:true,account:{profile:publicProfile(this.profile,this.presence),career,suspended:Boolean(this.profile.suspended),access:accountAccess(this.profile)}});
  }

  async managementApply(body) {
    const key='admin:applied:'+body.requestId,previous=await this.ctx.storage.get(key);
    if(previous){if(previous.fingerprint!==body.fingerprint)return json({ok:false,error:'request_conflict'},409);return this.managedAccount()}
    let p=accountCareer(await this.ctx.storage.get('career')||{name:this.profile.displayName},this.profile),nextProfile=clone(this.profile),nextPresence=clone(this.presence);
    const action=body.action;
    if(['suspend','revoke'].includes(action)&&isOwner(this.profile))return json({ok:false,error:'owner_protected'},403);
    if(action==='coins'||action==='xp'){
      const amount=body.amount;
      if(!Number.isSafeInteger(amount)||Math.abs(amount)>100000||amount===0||action==='xp'&&amount<0||p[action]+amount<0||p[action]+amount>100000000)return json({ok:false,error:'invalid_amount'},400);
      p=Career.normalize({...p,[action]:p[action]+amount});
    }else if(action==='unlock-all'){
      p=Career.normalize({...p,owned:[...p.owned,...Career.CATALOG.filter(i=>i.source!=='owner'||isOwner(this.profile)).map(i=>i.id)]});
    }else if(action==='unlock-item'){
      const item=Career.CATALOG.find(i=>i.id===body.item);
      if(!item||item.source==='owner'&&!isOwner(this.profile))return json({ok:false,error:'invalid_item'},400);
      p=Career.normalize({...p,owned:[...p.owned,item.id]});
    }else if(action==='lock-item'){
      // take back one item (a gift by mistake, a refund); the free starter items cannot be taken away
      const item=Career.CATALOG.find(i=>i.id===body.item);
      if(!item||isOwner(this.profile)||(item.price===0&&!item.source))return json({ok:false,error:'invalid_item'},400);
      if(!p.owned.includes(item.id))return json({ok:false,error:'not_owned'},409);
      p=Career.normalize({...p,owned:p.owned.filter(id=>id!==item.id)});
    }else if(action==='rename'){
      // a name that breaks the rules is replaced by the owner; the account keeps everything else
      const name=cleanDisplayName(body.text);
      if(isOwner(this.profile)||!name||name.length<2)return json({ok:false,error:'invalid_name'},400);
      nextProfile.displayName=name;nextProfile.updatedAt=Date.now();p=Career.normalize({...p,name});
    }else if(['suspend','restore','revoke'].includes(action)){
      if(action!=='revoke'){nextProfile.suspended=action==='suspend';nextProfile.updatedAt=Date.now()}
      if(action!=='restore'){nextPresence.online=false;nextPresence.lastSeen=Date.now()}
    }else return json({ok:false,error:'invalid_action'},400);
    await this.ctx.storage.transaction(async tx=>{
      await tx.put('career',p);await tx.put(key,{fingerprint:body.fingerprint,at:Date.now()});
      if(['suspend','restore','revoke','rename'].includes(action)){
        await tx.put('profile',nextProfile);await tx.put('presence',nextPresence);
        if(['suspend','revoke'].includes(action)){const sessions=await tx.list({prefix:'session:'});if(sessions.size)await tx.delete([...sessions.keys()])}
      }
    });
    this.profile=nextProfile;this.presence=nextPresence;
    if(action==='rename')this.defer(this.notifyFriendsPresence());
    if(['suspend','revoke'].includes(action))for(const ws of this.ctx.getWebSockets())try{if(ws.deserializeAttachment()?.username)ws.close(1008,'session_revoked')}catch{}
    return this.managedAccount();
  }

  async adminRequest(action,body) {
    if(action==='get'){
      const records=await this.ctx.storage.list({prefix:'admin:audit:',reverse:true,limit:100});
      return json({ok:true,access:accountAccess(this.profile),audit:[...records.values()],announcement:await this.activeAnnouncement()});
    }
    const username=normalizeUsername(body.username),stub=this.userStub(username);
    if(action==='account'){
      if(!stub)return json({ok:false,error:'invalid_username'},400);
      if(username===this.profile.username)return this.managedAccount();
      return stub.fetch('https://social.internal/management/get',{method:'POST',body:JSON.stringify({actor:OWNER_USERNAME})});
    }
    if(action!=='action')return json({ok:false,error:'not_found'},404);
    const requestId=String(body.requestId||'');if(!/^[a-zA-Z0-9:_-]{8,80}$/.test(requestId))return json({ok:false,error:'invalid_request_id'},400);
    const reason=String(body.reason||'').trim().replace(/[<>\u0000-\u001f]/g,'').slice(0,140);
    const text=String(body.text||'').trim().replace(/[<>\u0000-\u001f]/g,'').slice(0,240);
    const hours=Number.isFinite(body.hours)?Math.max(0,Math.min(720,Math.floor(body.hours))):0,level=['info','warn','success'].includes(body.level)?body.level:'info';
    const command={actor:OWNER_USERNAME,username,action:body.action,amount:body.amount,item:body.item,requestId,reason,text,...(['announcement'].includes(body.action)?{hours,level}:{})};
    const fingerprint=await sha256(JSON.stringify(command)),key='admin:receipt:'+requestId,previous=await this.ctx.storage.get(key);
    if(previous){
      if(previous.fingerprint!==fingerprint)return json({ok:false,error:'request_conflict'},409);
      if(['announcement','clear-announcement'].includes(body.action))return json({ok:true,announcement:await this.activeAnnouncement(),replayed:true});
      const response=username===this.profile.username?await this.managedAccount():await stub.fetch('https://social.internal/management/get',{method:'POST',body:JSON.stringify({actor:OWNER_USERNAME})});
      return json({...await response.json(),replayed:true},response.status);
    }
    let result;
    if(body.action==='clear-announcement')result={ok:true,announcement:null};
    else if(body.action==='announcement'){
      if(!text)return json({ok:false,error:'invalid_announcement'},400);
      const at0=Date.now(),announcement={text,at:at0,by:OWNER_USERNAME,level,expiresAt:hours?at0+hours*3600000:null};result={ok:true,announcement};
    }else{
      if(!stub)return json({ok:false,error:'invalid_username'},400);
      let response;
      if(username===this.profile.username)response=await this.managementApply({...command,fingerprint});
      else response=await stub.fetch('https://social.internal/management/apply',{method:'POST',body:JSON.stringify({...command,fingerprint})});
      result=await response.json();if(!response.ok)return json(result,response.status);
    }
    const at=Date.now(),entry={requestId,action:body.action,username:['announcement','clear-announcement'].includes(body.action)?null:username,amount:body.amount||null,item:body.item||null,reason,at,actor:OWNER_USERNAME,...(['rename','announcement'].includes(body.action)?{text:text.slice(0,80)}:{}),...(body.action==='announcement'&&hours?{hours}:{})};
    await this.ctx.storage.transaction(async tx=>{
      if(result.announcement)await tx.put('admin:announcement',result.announcement);
      if(body.action==='clear-announcement')await tx.delete('admin:announcement');
      await tx.put('admin:audit:'+String(at).padStart(14,'0')+':'+requestId,entry);
      await tx.put(key,{fingerprint,at,action:body.action,username});
    });
    return json(result);
  }

  // Verified online results also feed the weekly and season boards. This is
  // best effort: a ladder outage must never block or repeat a career reward,
  // and the board itself ignores a receipt it has already counted.
  async reportLeaderboard(result){
    const ns=this.env?.BOARD_ROOMS;if(!ns?.idFromName||!this.profile)return;
    try{
      const stub=ns.get(ns.idFromName(LEADERBOARD_OBJECT));
      await stub.fetch('https://leaderboard.internal/record',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...result,username:this.profile.username,name:this.profile.displayName,owner:isOwner(this.profile),at:Date.now()})});
    }catch(error){console.error('leaderboard record failed',error?.message||error);}
  }

  async validateSession(secret) {
    if (!(await this.sessionValid(secret))) return json({ ok: false, error: "unauthorized" }, 401);
    return json({ ok: true, profile: publicProfile(this.profile, this.presence) });
  }

  async logout(secret) {
    if (!secret) return json({ ok: true });
    const hash = await sha256(String(secret));
    await this.ctx.storage.delete(`session:${hash}`);
    return json({ ok: true });
  }

  async publicData(withCard = false) {
    if (!this.profile) return json({ ok: false, error: "الحساب غير موجود" }, 404);
    if (this.presence.online) await this.confirmOnline();
    const visiblePresence = this.profile.settings?.showOnline === false
      ? { online: false, lastSeen: null }
      : this.presence;
    const profile = publicProfile(this.profile, visiblePresence);
    profile.photo = publicPhoto(this.profile);
    // 33.7.0: the card a player opens from a room: level, wins, games and the look, never coins
    if (withCard) {
      try {
        const c = accountCareer(await this.ctx.storage.get("career") || { name: this.profile.displayName }, this.profile);
        profile.card = { level: c.level, xp: c.xp, wins: c.wins, games: c.games, rankedWins: c.rankedWins, streak: c.dailyStreak, stats: c.stats || {}, character: c.equipped?.character || null, title: c.equipped?.title || null };
      } catch {}
    }
    return json({ ok: true, profile });
  }

  async photoGet() {
    const photo = this.profile?.photo;
    if (!photo || photo.hidden) return new Response(null, { status: 404, headers: { "cache-control": "public, max-age=120" } });
    if (photo.kind === "preset") return new Response(null, { status: 302, headers: { location: PHOTO_PRESETS[photo.id] || "", "cache-control": "public, max-age=300" } });
    const data = await this.ctx.storage.get("photo-data");
    if (!data?.bytes) return new Response(null, { status: 404 });
    return new Response(data.bytes, { headers: { "content-type": data.type, "cache-control": "public, max-age=300", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'" } });
  }

  async photoSet(body) {
    if (!(await this.sessionValid(body.secret))) return json({ ok: false, error: "unauthorized" }, 401);
    const photo = body.photo || {};
    // a change after the first one costs coins (removing a picture is free)
    const paid = photo.kind !== "none" && (this.profile.photoChanges || 0) >= 1 && !isOwner(this.profile);
    let career = null;
    if (paid) {
      career = accountCareer(await this.ctx.storage.get("career") || { name: this.profile.displayName }, this.profile);
      if (career.coins < CHANGE_PRICE) return json({ ok: false, error: "تحتاج " + CHANGE_PRICE + " عملة عشان تغيّر صورتك" }, 400);
    }
    if (photo.kind === "none") { this.profile.photo = null; await this.ctx.storage.delete(["photo-data", "photo-reports"]); }
    else if (photo.kind === "preset") {
      if (!PHOTO_PRESETS[photo.id]) return json({ ok: false, error: "الصورة غير موجودة" }, 400);
      this.profile.photo = { kind: "preset", id: photo.id };
      await this.ctx.storage.delete(["photo-data", "photo-reports"]);
    } else if (photo.kind === "upload") {
      const bytes = decodePhoto(photo.data, photo.type);
      if (!bytes) return json({ ok: false, error: "الصورة لازم تكون JPG أو WebP وحجمها صغير" }, 400);
      const at = Date.now();
      await this.ctx.storage.put({ "photo-data": { type: photo.type, bytes }, "photo-reports": [] });
      this.profile.photo = { kind: "upload", v: at };
    } else return json({ ok: false, error: "invalid_photo" }, 400);
    if (photo.kind !== "none") this.profile.photoChanges = (this.profile.photoChanges || 0) + 1;
    if (paid) { career.coins -= CHANGE_PRICE; await this.ctx.storage.put("career", career); }
    this.profile.updatedAt = Date.now();
    await this.ctx.storage.put("profile", this.profile);
    return json({ ok: true, photo: publicPhoto(this.profile), paid: paid ? CHANGE_PRICE : 0, changes: { photo: this.profile.photoChanges || 0, name: this.profile.renames || 0 } });
  }

  async photoReport(body) {
    const reporter = normalizeUsername(body.reporter);
    const photo = this.profile?.photo;
    if (!photo || photo.kind !== "upload") return json({ ok: false, error: "ما عنده صورة مرفوعة" }, 404);
    if (!validUsername(reporter) || reporter === this.profile.username) return json({ ok: false, error: "invalid_reporter" }, 400);
    const reports = (await this.ctx.storage.get("photo-reports")) || [];
    const first = !reports.includes(reporter);
    if (first && reports.length < 50) reports.push(reporter);
    const hide = reports.length >= PHOTO_REPORTS_TO_HIDE && !photo.hidden && !photo.kept;
    if (hide) { photo.hidden = true; await this.ctx.storage.put("profile", this.profile); }
    await this.ctx.storage.put("photo-reports", reports);
    return json({ ok: true, first, reports: reports.length, hidden: Boolean(photo.hidden) });
  }

  async photoModerate(body) {
    if (body.actor !== OWNER_USERNAME) return json({ ok: false, error: "forbidden" }, 403);
    const photo = this.profile?.photo;
    if (photo?.kind === "upload") {
      if (body.action === "remove") { this.profile.photo = null; await this.ctx.storage.delete(["photo-data", "photo-reports"]); }
      else { photo.hidden = false; photo.kept = true; await this.ctx.storage.put("photo-reports", []); }
      await this.ctx.storage.put("profile", this.profile);
    }
    return json({ ok: true });
  }

  // kept by the owner's account: the photos players reported
  async moderationQueue(action, body) {
    if (!isOwner(this.profile)) return json({ ok: false, error: "forbidden" }, 403);
    const list = (await this.ctx.storage.get("moderation")) || [];
    const who = normalizeUsername(body.username);
    if (action === "add" && validUsername(who)) {
      const row = list.find((x) => x.username === who);
      if (row) { row.reports = Number(body.reports) || row.reports; row.at = Date.now(); row.hidden = Boolean(body.hidden); }
      else list.unshift({ username: who, reports: Number(body.reports) || 1, hidden: Boolean(body.hidden), at: Date.now() });
      await this.ctx.storage.put("moderation", list.slice(0, 200));
    }
    if (action === "done") await this.ctx.storage.put("moderation", list.filter((x) => x.username !== who));
    if (action === "list") {
      if (!(await this.sessionValid(body.secret))) return json({ ok: false, error: "unauthorized" }, 401);
      return json({ ok: true, reports: list });
    }
    return json({ ok: true });
  }

  async listValues(prefix, limit = 100) {
    const map = await this.ctx.storage.list({ prefix, limit });
    return [...map.values()].map(clone);
  }

  async dashboard(secret) {
    if (!(await this.sessionValid(secret))) return json({ ok: false, error: "unauthorized" }, 401);
    const [friendsRaw, incoming, outgoing, blocks, notificationsMap] = await Promise.all([
      this.listValues("friend:", SOCIAL_MAX_FRIENDS + 1),
      this.listValues("incoming:", SOCIAL_MAX_REQUESTS + 1),
      this.listValues("outgoing:", SOCIAL_MAX_REQUESTS + 1),
      this.listValues("block:", SOCIAL_MAX_FRIENDS + 1),
      this.ctx.storage.list({ prefix: "notification:", reverse: true, limit: SOCIAL_MAX_NOTIFICATIONS }),
    ]);
    const friends = await this.verifyFriendsOnline(friendsRaw);
    const now = Date.now();
    const notifications = [...notificationsMap.values()]
      .filter((item) => !item.expiresAt || item.expiresAt > now)
      .map(clone);
    return json({
      ok: true,
      profile: { ...publicProfile(this.profile, this.presence), photo: publicPhoto(this.profile), changes: { photo: this.profile.photoChanges || 0, name: this.profile.renames || 0 } },
      settings: clone(this.profile.settings || { allowInvites: "friends", showOnline: true }),
      friends,
      incoming,
      outgoing,
      blocks,
      notifications,
      unread: notifications.filter((x) => !x.read).length,
    });
  }

  async updateSettings(body) {
    if (!(await this.sessionValid(body.secret))) return json({ ok: false, error: "unauthorized" }, 401);
    const allowInvites = ["everyone", "friends", "nobody"].includes(body.allowInvites)
      ? body.allowInvites
      : this.profile.settings?.allowInvites || "friends";
    const showOnline = typeof body.showOnline === "boolean" ? body.showOnline : this.profile.settings?.showOnline !== false;
    const visibilityChanged = this.profile.settings?.showOnline !== showOnline;
    this.profile.settings = { allowInvites, showOnline };
    this.profile.updatedAt = Date.now();
    await this.ctx.storage.put("profile", this.profile);
    if (visibilityChanged) this.ctx.waitUntil(this.notifyFriendsPresence());
    return json({ ok: true, settings: clone(this.profile.settings) });
  }

  async isBlocked(username) {
    return Boolean(await this.ctx.storage.get(`block:${normalizeUsername(username)}`));
  }

  async hasFriend(username) {
    return Boolean(await this.ctx.storage.get(`friend:${normalizeUsername(username)}`));
  }

  async addIncomingRequest(body) {
    if (!this.profile) return json({ ok: false, error: "الحساب غير موجود" }, 404);
    const username = normalizeUsername(body.username);
    if (!validUsername(username) || username === this.profile.username) return json({ ok: false, error: "invalid_user" }, 400);
    if (await this.isBlocked(username)) return json({ ok: false, error: "لا يمكن إرسال الطلب لهذا المستخدم" }, 403);
    if (await this.hasFriend(username)) return json({ ok: true, alreadyFriends: true });
    const current = await this.ctx.storage.list({ prefix: "incoming:", limit: SOCIAL_MAX_REQUESTS + 1 });
    if (current.size >= SOCIAL_MAX_REQUESTS && !current.has(`incoming:${username}`)) return json({ ok: false, error: "طلبات الصداقة ممتلئة" }, 409);
    const request = {
      username,
      displayName: cleanDisplayName(body.displayName || username),
      createdAt: Date.now(),
    };
    await this.ctx.storage.put(`incoming:${username}`, request);
    await this.addNotification({ type: "friend_request", from: request });
    return json({ ok: true });
  }

  async addOutgoingRequest(body) {
    const username = normalizeUsername(body.username);
    if (!validUsername(username)) return json({ ok: false, error: "invalid_user" }, 400);
    if (await this.isBlocked(username)) return json({ ok: false, error: "blocked" }, 403);
    const request = { username, displayName: cleanDisplayName(body.displayName || username), createdAt: Date.now() };
    await this.ctx.storage.put(`outgoing:${username}`, request);
    return json({ ok: true });
  }

  async removeRequest(direction, username) {
    const normalized = normalizeUsername(username);
    if (validUsername(normalized)) await this.ctx.storage.delete(`${direction}:${normalized}`);
    return json({ ok: true });
  }

  async addFriend(body) {
    const username = normalizeUsername(body.username);
    if (!validUsername(username) || username === this.profile?.username) return json({ ok: false, error: "invalid_user" }, 400);
    if (await this.isBlocked(username)) return json({ ok: false, error: "blocked" }, 403);
    const friends = await this.ctx.storage.list({ prefix: "friend:", limit: SOCIAL_MAX_FRIENDS + 1 });
    if (friends.size >= SOCIAL_MAX_FRIENDS && !friends.has(`friend:${username}`)) return json({ ok: false, error: "وصلت للحد الأقصى من الأصدقاء" }, 409);
    const record = {
      username,
      displayName: cleanDisplayName(body.displayName || username),
      online: Boolean(body.online),
      lastSeen: Number(body.lastSeen) || null,
      since: Date.now(),
    };
    await this.ctx.storage.put(`friend:${username}`, record);
    await this.ctx.storage.delete([`incoming:${username}`, `outgoing:${username}`]);
    await this.addNotification({ type: "friend_accepted", friend: record });
    return json({ ok: true, friend: record });
  }

  async removeFriend(username) {
    const normalized = normalizeUsername(username);
    if (validUsername(normalized)) await this.ctx.storage.delete(`friend:${normalized}`);
    return json({ ok: true });
  }

  // 33.7.0: asked by a friend before it shows this account as online
  async liveStatus() {
    if (!this.profile) return json({ ok: false, online: false }, 404);
    const shown = this.profile.settings?.showOnline !== false;
    const online = shown && (await this.confirmOnline());
    return json({ ok: true, online, lastSeen: shown ? this.presence.lastSeen || null : null });
  }

  // The copy of a friend's status kept here only changes when that friend tells us. If a "goodbye" never arrived
  // (the phone lost its signal) the copy would say online for ever, so every friend marked online is checked now.
  async verifyFriendsOnline(list) {
    const ns = this.env?.SOCIAL_USERS || this.env?.BOARD_ROOMS, flagged = (list || []).filter((f) => f?.online && f.username);
    if (!ns || !flagged.length) return list;
    const results = await Promise.allSettled(flagged.slice(0, 60).map(async (f) => {
      const stub = ns.get(ns.idFromName(this.env?.SOCIAL_USERS ? `user:${f.username}` : `social:user:${f.username}`));
      const res = await stub.fetch("https://social.internal/live");
      return [f, await res.json()];
    }));
    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      const [friend, live] = r.value;
      if (live && live.ok && !live.online) {
        friend.online = false; friend.lastSeen = live.lastSeen || friend.lastSeen || Date.now();
        try { await this.ctx.storage.put(`friend:${friend.username}`, friend); } catch { /* try again on the next look */ }
      }
    }
    return list;
  }

  async friendPresence(body) {
    const username = normalizeUsername(body.username);
    const key = `friend:${username}`;
    const record = await this.ctx.storage.get(key);
    if (!record) return json({ ok: true, ignored: true });
    record.online = Boolean(body.online);
    if (Object.prototype.hasOwnProperty.call(body, "lastSeen")) {
      record.lastSeen = body.lastSeen == null ? null : (Number(body.lastSeen) || null);
    }
    if (body.displayName) record.displayName = cleanDisplayName(body.displayName);
    await this.ctx.storage.put(key, record);
    this.broadcast({ type: "friend_presence", friend: clone(record) });
    return json({ ok: true });
  }

  async blockUser(username) {
    const normalized = normalizeUsername(username);
    if (!validUsername(normalized) || normalized === this.profile?.username) return json({ ok: false, error: "invalid_user" }, 400);
    await this.ctx.storage.put(`block:${normalized}`, { username: normalized, createdAt: Date.now() });
    await this.ctx.storage.delete([`friend:${normalized}`, `incoming:${normalized}`, `outgoing:${normalized}`]);
    return json({ ok: true });
  }

  async unblockUser(username) {
    const normalized = normalizeUsername(username);
    if (validUsername(normalized)) await this.ctx.storage.delete(`block:${normalized}`);
    return json({ ok: true });
  }

  async incomingInvite(body) {
    if (!this.profile) return json({ ok: false, error: "الحساب غير موجود" }, 404);
    const fromUsername = normalizeUsername(body.username);
    if (!validUsername(fromUsername) || await this.isBlocked(fromUsername)) return json({ ok: false, error: "invites_not_allowed" }, 403);
    const settings = this.profile.settings || { allowInvites: "friends" };
    const isFriend = await this.hasFriend(fromUsername);
    if (settings.allowInvites === "nobody" || (settings.allowInvites === "friends" && !isFriend)) {
      return json({ ok: false, error: "invites_not_allowed" }, 403);
    }
    const game = normalizeGame(body.game);
    const roomCode = normalizeRoomCode(body.roomCode);
    const variant=game==='journey'&&['paths','jewels'].includes(body.variant)?body.variant:undefined;
    const joinPath = gameJoinPath(game, roomCode, variant);
    if (!game || !joinPath) return json({ ok: false, error: "invalid_invite" }, 400);
    const existing=await this.ctx.storage.list({prefix:'notification:',reverse:true,limit:SOCIAL_MAX_NOTIFICATIONS});
    const duplicate=[...existing.values()].find(n=>n.type==='game_invite'&&n.from?.username===fromUsername&&n.game===game&&n.roomCode===roomCode&&n.joinPath===joinPath&&!n.read&&n.expiresAt>Date.now()&&Date.now()-n.createdAt<15000);
    if(duplicate)return json({ok:true,invite:duplicate,deduplicated:true});
    const invite = {
      id: crypto.randomUUID(),
      type: "game_invite",
      from: { username: fromUsername, displayName: cleanDisplayName(body.displayName || fromUsername) },
      game,
      roomCode,
      joinPath,
      ...(variant?{variant}:{}),
      createdAt: Date.now(),
      expiresAt: Date.now() + SOCIAL_INVITE_TTL_MS,
      read: false,
    };
    await this.addNotification(invite);
    return json({ ok: true, invite });
  }

  async addNotification(payload) {
    const notification = {
      id: payload.id || crypto.randomUUID(),
      read: false,
      createdAt: payload.createdAt || Date.now(),
      ...clone(payload),
    };
    await this.ctx.storage.put(nowKey(), notification);
    const all = await this.ctx.storage.list({ prefix: "notification:", reverse: true });
    if (all.size > SOCIAL_MAX_NOTIFICATIONS) {
      const keys = [...all.keys()].slice(SOCIAL_MAX_NOTIFICATIONS);
      if (keys.length) await this.ctx.storage.delete(keys);
    }
    this.broadcast({ type: "notification", notification });
    return notification;
  }

  async markNotificationsRead(ids) {
    const wanted = new Set(Array.isArray(ids) ? ids.map(String) : []);
    const map = await this.ctx.storage.list({ prefix: "notification:", reverse: true, limit: SOCIAL_MAX_NOTIFICATIONS });
    const updates = [];
    for (const [key, item] of map) {
      if (!wanted.size || wanted.has(String(item.id))) {
        item.read = true;
        updates.push([key, item]);
      }
    }
    if (updates.length) await Promise.all(updates.map(([key, item]) => this.ctx.storage.put(key, item)));
    return json({ ok: true, updated: updates.length });
  }

  defer(promise) { const p = Promise.resolve(promise).catch(() => {}); if (typeof this.ctx.waitUntil === 'function') this.ctx.waitUntil(p); return p; }
  socialSockets() {
    return this.ctx.getWebSockets().filter((ws) => { try { return Boolean(ws.deserializeAttachment()?.username); } catch { return false; } });
  }
  liveSockets() { return this.socialSockets().length > 0; }
  // the newest sign of life: a ping, or the moment a socket was opened
  lastBeatAt() {
    let t = Number(this.lastPing) || 0;
    for (const ws of this.socialSockets()) { try { t = Math.max(t, Number(ws.deserializeAttachment()?.connectedAt) || 0); } catch { /* gone */ } }
    return t;
  }
  beatFresh(now = Date.now()) { return now - this.lastBeatAt() < LIVE_MS; }
  // true when this account is really there right now; sweeps a dead connection if it finds one
  async confirmOnline() {
    if (!this.profile || !this.presence.online) return false;
    if (this.liveSockets() && this.beatFresh()) return true;
    await this.expireStale();
    return false;
  }
  async expireStale() {
    for (const ws of this.socialSockets()) { try { ws.close(4004, 'stale'); } catch { /* gone */ } }
    const at = this.lastBeatAt() || Date.now();
    if (this.presence.online) {
      this.presence = { ...this.presence, online: false, lastSeen: Math.min(Date.now(), at) };
      await this.ctx.storage.put("presence", this.presence);
      this.defer(this.notifyFriendsPresence());
    }
  }
  async alarm() {
    await this.ready;
    if (!this.profile) return;
    if (this.liveSockets() && this.beatFresh()) { await this.ctx.storage.setAlarm(this.lastBeatAt() + LIVE_MS + 3000); return; }
    await this.expireStale();
  }
  armSweep(now = Date.now()) {
    if (now - (this.sweepArmedAt || 0) < 20000) return;
    this.sweepArmedAt = now;
    this.defer(this.ctx.storage.setAlarm(now + LIVE_MS + 3000));
  }

  async openWebSocket(request) {
    if (request.headers.get("Upgrade") !== "websocket") return json({ ok: false, error: "WebSocket required" }, 426);
    if (request.headers.get("x-social-auth") !== "1" || !this.profile) return json({ ok: false, error: "unauthorized" }, 401);
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    const wasOnline = this.ctx.getWebSockets().length > 0;
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ username: this.profile.username, connectedAt: Date.now() });
    this.lastPing = Date.now();
    if (!wasOnline || !this.presence.online) await this.setPresence(true);
    this.armSweep();
    try {
      server.send(JSON.stringify({
        type: "social_welcome",
        profile: publicProfile(this.profile, this.presence),
      }));
    } catch {}
    return new Response(null, {
      status: 101,
      webSocket: client,
      headers: { "Sec-WebSocket-Protocol": "busraj-social-v1" },
    });
  }

  async webSocketMessage(ws, message) {
    let data;
    try { data = JSON.parse(String(message)); } catch { return; }
    if (data.type === "ping") {
      const now=Date.now();this.lastPing=now;if(now-(this.presence.lastActiveAt||0)>=60000){this.presence.lastActiveAt=now;await this.ctx.storage.put("presence",this.presence);}
      if(!this.presence.online)await this.setPresence(true);
      this.armSweep(now);
      try { ws.send(JSON.stringify({ type: "pong", at: Date.now() })); } catch {}
    }
  }

  async webSocketClose(ws, code = 1000, reason = "closed") {
    const others = this.ctx.getWebSockets().filter((socket) => {
      if (socket === ws) return false;
      try { return Boolean(socket.deserializeAttachment()?.username); } catch { return false; }
    });
    if (others.length === 0) await this.setPresence(false);
    try { ws.close(code, reason); } catch {}
  }

  async webSocketError(ws) {
    const others = this.ctx.getWebSockets().filter((socket) => {
      if (socket === ws) return false;
      try { return Boolean(socket.deserializeAttachment()?.username); } catch { return false; }
    });
    if (others.length === 0) await this.setPresence(false);
  }

  async setPresence(online) {
    const next = Boolean(online);
    if (this.presence.online === next && (next || this.presence.lastSeen)) return;
    this.presence = {
      online: next,
      lastSeen: next ? this.presence.lastSeen || null : Date.now(),
      lastActiveAt: Date.now(),
    };
    await this.ctx.storage.put("presence", this.presence);
    this.ctx.waitUntil(this.notifyFriendsPresence());
  }

  async notifyFriendsPresence() {
    const namespace = this.env?.SOCIAL_USERS || this.env?.BOARD_ROOMS;
    if (!namespace || !this.profile) return;
    const friends = await this.ctx.storage.list({ prefix: "friend:", limit: SOCIAL_MAX_FRIENDS });
    const payload = JSON.stringify({
      username: this.profile.username,
      displayName: this.profile.displayName,
      online: this.profile.settings?.showOnline === false ? false : this.presence.online,
      lastSeen: this.profile.settings?.showOnline === false ? null : this.presence.lastSeen,
    });
    await Promise.allSettled([...friends.values()].map(async (friend) => {
      const objectName = this.env?.SOCIAL_USERS ? `user:${friend.username}` : `social:user:${friend.username}`;
      const id = namespace.idFromName(objectName);
      const stub = namespace.get(id);
      await stub.fetch("https://social.internal/friend/presence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload,
      });
    }));
  }

  broadcast(message) {
    const raw = JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.send(raw); } catch {}
    }
  }
  };
}
