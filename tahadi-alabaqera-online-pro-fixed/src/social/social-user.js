import {Career} from '../career/core.js';
import {normalizeJourney,commitJourney,journeyStats} from '../../public/assets/js/engines/journey-engine.js';
import {OWNER_USERNAME,isOwner,accountAccess,accountCareer} from './account-policy.js';
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
        const hasSocialSockets = this.ctx.getWebSockets().some((ws) => {
          try { return Boolean(ws.deserializeAttachment()?.username); } catch { return false; }
        });
        if (this.presence.online !== hasSocialSockets) {
          this.presence.online = hasSocialSockets;
          if (!hasSocialSockets && !this.presence.lastSeen) this.presence.lastSeen = Date.now();
          await this.ctx.storage.put("presence", this.presence);
        }
      }
    });
  }

  async fetch(request) {
    const url = new URL(request.url);
    const body = request.method === "POST" || request.method === "PUT" || request.method === "DELETE"
      ? await request.json().catch(() => ({}))
      : {};

    if (url.pathname === "/signup" && request.method === "POST") return this.signup(body);
    if (url.pathname === "/login" && request.method === "POST") return this.login(body);
    if (url.pathname === "/validate" && request.method === "POST") return this.validateSession(body.secret);
    if (url.pathname === "/logout" && request.method === "POST") return this.logout(body.secret);
    if (url.pathname === "/public" && request.method === "GET") return this.publicData();
    if (url.pathname === "/dashboard" && request.method === "POST") return this.dashboard(body.secret);
    if (url.pathname === "/settings" && request.method === "POST") return this.updateSettings(body);
    if (url.pathname === '/announcement')return json({ok:true,announcement:await this.ctx.storage.get('admin:announcement')||null});
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
    if (url.pathname.startsWith('/career/')) {
      const action=url.pathname.split('/')[2];
      if (!['get','practice','purchase','equip','rename','verified','daily','claim','bundle','cart','journey'].includes(action)) return json({ok:false,error:'not_found'},404);
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
          if(action==='practice'||action==='verified')career=Career.reward(career,{id:body.id,game:body.game,win:body.win===true,verified:action==='verified'});
          if(action==='daily')career=Career.claimDaily(career);
          if(action==='purchase')career=Career.purchase(career,body.id,{expectedPrice:body.expectedPrice});
          if(action==='equip')career=Career.equip(career,body.id);
          if(action==='claim')career=Career.claimObjective(career,body.id);
          if(action==='bundle')career=Career.purchaseBundle(career,body.id,{expectedPrice:body.expectedPrice});
          if(action==='cart')career=Career.purchaseCart(career,body.ids,{expectedPrice:body.expectedPrice,requestId:body.requestId});
          if(action==='rename'){career=Career.normalize({...career,name:body.name});this.profile.displayName=career.name;await this.ctx.storage.put('profile',this.profile);}
        }catch(e){return json({ok:false,error:e.message},400)}
        await this.ctx.storage.put('career',career);
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
    await this.ctx.storage.put(`session:${hash}`, { createdAt, expiresAt });
    const sessions = await this.ctx.storage.list({ prefix: "session:", reverse: true });
    if (sessions.size > 8) {
      const keys = [...sessions.keys()].slice(8);
      if (keys.length) await this.ctx.storage.delete(keys);
    }
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
    }else if(['suspend','restore','revoke'].includes(action)){
      if(action!=='revoke'){nextProfile.suspended=action==='suspend';nextProfile.updatedAt=Date.now()}
      if(action!=='restore'){nextPresence.online=false;nextPresence.lastSeen=Date.now()}
    }else return json({ok:false,error:'invalid_action'},400);
    await this.ctx.storage.transaction(async tx=>{
      await tx.put('career',p);await tx.put(key,{fingerprint:body.fingerprint,at:Date.now()});
      if(['suspend','restore','revoke'].includes(action)){
        await tx.put('profile',nextProfile);await tx.put('presence',nextPresence);
        if(action!=='restore'){const sessions=await tx.list({prefix:'session:'});if(sessions.size)await tx.delete([...sessions.keys()])}
      }
    });
    this.profile=nextProfile;this.presence=nextPresence;
    if(['suspend','revoke'].includes(action))for(const ws of this.ctx.getWebSockets())try{if(ws.deserializeAttachment()?.username)ws.close(1008,'session_revoked')}catch{}
    return this.managedAccount();
  }

  async adminRequest(action,body) {
    if(action==='get'){
      const records=await this.ctx.storage.list({prefix:'admin:audit:',reverse:true,limit:100});
      return json({ok:true,access:accountAccess(this.profile),audit:[...records.values()],announcement:await this.ctx.storage.get('admin:announcement')||null});
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
    const command={actor:OWNER_USERNAME,username,action:body.action,amount:body.amount,item:body.item,requestId,reason,text};
    const fingerprint=await sha256(JSON.stringify(command)),key='admin:receipt:'+requestId,previous=await this.ctx.storage.get(key);
    if(previous){
      if(previous.fingerprint!==fingerprint)return json({ok:false,error:'request_conflict'},409);
      if(['announcement','clear-announcement'].includes(body.action))return json({ok:true,announcement:await this.ctx.storage.get('admin:announcement')||null,replayed:true});
      const response=username===this.profile.username?await this.managedAccount():await stub.fetch('https://social.internal/management/get',{method:'POST',body:JSON.stringify({actor:OWNER_USERNAME})});
      return json({...await response.json(),replayed:true},response.status);
    }
    let result;
    if(body.action==='clear-announcement')result={ok:true,announcement:null};
    else if(body.action==='announcement'){
      if(!text)return json({ok:false,error:'invalid_announcement'},400);
      const announcement={text,at:Date.now(),by:OWNER_USERNAME};result={ok:true,announcement};
    }else{
      if(!stub)return json({ok:false,error:'invalid_username'},400);
      let response;
      if(username===this.profile.username)response=await this.managementApply({...command,fingerprint});
      else response=await stub.fetch('https://social.internal/management/apply',{method:'POST',body:JSON.stringify({...command,fingerprint})});
      result=await response.json();if(!response.ok)return json(result,response.status);
    }
    const at=Date.now(),entry={requestId,action:body.action,username:['announcement','clear-announcement'].includes(body.action)?null:username,amount:body.amount||null,item:body.item||null,reason,at,actor:OWNER_USERNAME};
    await this.ctx.storage.transaction(async tx=>{
      if(result.announcement)await tx.put('admin:announcement',result.announcement);
      if(body.action==='clear-announcement')await tx.delete('admin:announcement');
      await tx.put('admin:audit:'+String(at).padStart(14,'0')+':'+requestId,entry);
      await tx.put(key,{fingerprint,at,action:body.action,username});
    });
    return json(result);
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

  async publicData() {
    if (!this.profile) return json({ ok: false, error: "الحساب غير موجود" }, 404);
    const visiblePresence = this.profile.settings?.showOnline === false
      ? { online: false, lastSeen: null }
      : this.presence;
    return json({ ok: true, profile: publicProfile(this.profile, visiblePresence) });
  }

  async listValues(prefix, limit = 100) {
    const map = await this.ctx.storage.list({ prefix, limit });
    return [...map.values()].map(clone);
  }

  async dashboard(secret) {
    if (!(await this.sessionValid(secret))) return json({ ok: false, error: "unauthorized" }, 401);
    const [friends, incoming, outgoing, blocks, notificationsMap] = await Promise.all([
      this.listValues("friend:", SOCIAL_MAX_FRIENDS + 1),
      this.listValues("incoming:", SOCIAL_MAX_REQUESTS + 1),
      this.listValues("outgoing:", SOCIAL_MAX_REQUESTS + 1),
      this.listValues("block:", SOCIAL_MAX_FRIENDS + 1),
      this.ctx.storage.list({ prefix: "notification:", reverse: true, limit: SOCIAL_MAX_NOTIFICATIONS }),
    ]);
    const now = Date.now();
    const notifications = [...notificationsMap.values()]
      .filter((item) => !item.expiresAt || item.expiresAt > now)
      .map(clone);
    return json({
      ok: true,
      profile: publicProfile(this.profile, this.presence),
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
    const joinPath = gameJoinPath(game, roomCode);
    if (!game || !joinPath) return json({ ok: false, error: "invalid_invite" }, 400);
    const existing=await this.ctx.storage.list({prefix:'notification:',reverse:true,limit:SOCIAL_MAX_NOTIFICATIONS});
    const duplicate=[...existing.values()].find(n=>n.type==='game_invite'&&n.from?.username===fromUsername&&n.game===game&&n.roomCode===roomCode&&!n.read&&n.expiresAt>Date.now()&&Date.now()-n.createdAt<15000);
    if(duplicate)return json({ok:true,invite:duplicate,deduplicated:true});
    const invite = {
      id: crypto.randomUUID(),
      type: "game_invite",
      from: { username: fromUsername, displayName: cleanDisplayName(body.displayName || fromUsername) },
      game,
      roomCode,
      joinPath,
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

  async openWebSocket(request) {
    if (request.headers.get("Upgrade") !== "websocket") return json({ ok: false, error: "WebSocket required" }, 426);
    if (request.headers.get("x-social-auth") !== "1" || !this.profile) return json({ ok: false, error: "unauthorized" }, 401);
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    const wasOnline = this.ctx.getWebSockets().length > 0;
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ username: this.profile.username, connectedAt: Date.now() });
    if (!wasOnline) await this.setPresence(true);
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
