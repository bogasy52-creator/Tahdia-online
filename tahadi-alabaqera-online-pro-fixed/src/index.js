import {PathsRoom,pathsSettings} from './paths/paths-room.js';
import {SudokuRoom,sudokuSettings} from './sudoku/sudoku-room.js';
import {ImageRoom} from './images/image-room.js';
import {imageGenerationConfig} from './images/generate.js';
import {clientErrorReport} from './diagnostics/client-errors.js';

import { DurableObject } from "cloudflare:workers";
import { CATEGORIES } from "./questions.js";
import { createSnakesServerGame, rollSnakesServer, normalizeSnakesVariant } from "./games/snakes-server.js";
import { createLudoGame, getLegalLudoMoves, applyLudoMove, passLudoTurn } from "../public/assets/js/engines/ludo-engine.js";
import { createJackarooGame, getJackarooActions, playJackarooAction } from "../public/assets/js/engines/jackaroo-engine.js";
import { handleSocialRequest, authenticate, getSocialStub } from "./social/social-api.js";
import { createQuickArenaClass } from "./quick/arena.js";
import { createSocialUserClass } from "./social/social-user.js";
import { generateSafeQuestions } from "./ai-questions.js";
import { SerpentRoom } from './serpent/serpent-room.js';

class SocialDelegateBase {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; }
}
const BoardSocialUser = createSocialUserClass(SocialDelegateBase);
export const QuickArena = createQuickArenaClass(DurableObject);

const RELEASE='25.0.0';
const BOARD_CHARACTERS=['princess','fairy','astronaut','fox','cat','robot'],DEFAULT_BOARD_CHARACTERS=['fox','fox','fox','fox'];
const CATEGORY_MAP = new Map(CATEGORIES.map((c) => [c.id, c]));
const ROOM_RE = /^\d{6}$/;
const DISCONNECT_GRACE_MS = 45_000;
const TURN_TIMEOUT_MS = 60_000;
const MOVE_TIMEOUT_MS = 25_000;
const RATE_BUCKETS = new Map();
const DURABLE_QUOTA_RESETS = new WeakMap();

function isDurableRequestQuotaError(error) {
  return /exceeded allowed volume of requests in durable objects free tier/i.test(String(error?.message || error || '').replace(/\s+/g, ' '));
}

function durableQuotaResponse(env) {
  const now = Date.now(), resetAt = DURABLE_QUOTA_RESETS.get(env) || (Math.floor(now / 86400000) + 1) * 86400000;
  DURABLE_QUOTA_RESETS.set(env, resetAt);
  return new Response(JSON.stringify({ok:false,online:false,code:'DURABLE_REQUEST_LIMIT',error:'وصلت خدمة الأونلاين إلى حد الطلبات اليومي. تعود بعد الساعة ٣:٠٠ صباحًا بتوقيت السعودية.',resetAt,release:RELEASE}), {
    status:503,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','retry-after':String(Math.max(1,Math.ceil((resetAt-now)/1000))),'x-content-type-options':'nosniff'}
  });
}

function memoryRateLimit(request, bucket, limit, windowMs) {
  const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() || "local";
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const current = RATE_BUCKETS.get(key);
  if (!current || now >= current.resetAt) {
    RATE_BUCKETS.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }
  current.count += 1;
  if (current.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    return new Response(JSON.stringify({ ok: false, error: "طلبات كثيرة جدًا، حاول بعد قليل" }), {
      status: 429,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "retry-after": String(retryAfter),
        "x-content-type-options": "nosniff",
      },
    });
  }
  if (RATE_BUCKETS.size > 5000) {
    for (const [k, v] of RATE_BUCKETS) if (now >= v.resetAt) RATE_BUCKETS.delete(k);
  }
  return null;
}

async function rateLimit(request, env, bucket, limit, windowMs) {
  if (!env?.ROOMS) return memoryRateLimit(request, bucket, limit, windowMs);
  const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() || "local";
  try {
    const id = env.ROOMS.idFromName(`__rate__:${ip}`);
    const stub = env.ROOMS.get(id);
    const res = await stub.fetch("https://room.internal/rate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bucket, limit, windowMs }),
    });
    if (res.status !== 429) return null;
    const data = await res.json().catch(() => ({}));
    const retryAfter = Math.max(1, Number(data.retryAfter) || 1);
    return new Response(JSON.stringify({ ok: false, error: "طلبات كثيرة جدًا، حاول بعد قليل" }), {
      status: 429,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "retry-after": String(retryAfter),
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    if (isDurableRequestQuotaError(error)) throw error;
    return memoryRateLimit(request, bucket, limit, windowMs);
  }
}

function webSocketAuth(request) {
  const protocols = String(request.headers.get("Sec-WebSocket-Protocol") || "")
    .split(",").map((x) => x.trim()).filter(Boolean);
  const read = (prefix) => protocols.find((x) => x.startsWith(prefix))?.slice(prefix.length) || "";
  return {
    reconnectToken: read("rt."),
    hostKey: read("hk."),
    protocol: protocols.includes("busraj-v1") ? "busraj-v1" : "",
  };
}

function webSocketResponse(client, protocol) {
  const headers = protocol ? { "Sec-WebSocket-Protocol": protocol } : undefined;
  return new Response(null, { status: 101, webSocket: client, headers });
}

function sameOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  try {
    const requestUrl = new URL(request.url);
    const originUrl = new URL(origin);
    return originUrl.protocol === requestUrl.protocol && originUrl.host === requestUrl.host;
  } catch {
    return false;
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "same-origin",
    },
  });
}

function cleanName(value) {
  return String(value || "").normalize("NFKC").trim().replace(/[\u0000-\u001F\u007F<>]/g, "").slice(0, 20) || "لاعب";
}

function shuffle(items) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const r = crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
    const j = Math.floor(r * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick(items) {
  return items[Math.floor((crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296) * items.length)];
}

function token() {
  return crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
}

function roomCode() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 900000;
  return String(100000 + n);
}

function buildChoices(cat, q) {
  const preferred = [...new Set((Array.isArray(q.distractors) ? q.distractors : [])
    .map((x) => String(x || "").trim()).filter((x) => x && x !== q.a))];
  const fallback = shuffle([...new Set(cat.questions.filter((x) => x.a !== q.a).map((x) => x.a))]);
  const wrong = [];
  for (const item of shuffle(preferred)) {
    if (!wrong.includes(item)) wrong.push(item);
    if (wrong.length === 3) break;
  }
  for (const item of fallback) {
    if (!wrong.includes(item)) wrong.push(item);
    if (wrong.length === 3) break;
  }
  const options = shuffle([q.a, ...wrong.slice(0, 3)]);
  return { options, correctIndex: options.indexOf(q.a) };
}

function questionRef(cat, q) {
  return `${cat.id}:${cat.questions.indexOf(q)}`;
}

function balancedModes(rounds) {
  const modes = Array.from({ length: rounds }, (_, i) => i < Math.ceil(rounds / 2) ? "secret" : "buzzer");
  for (let tries = 0; tries < 24; tries++) {
    const candidate = shuffle(modes);
    let streak = 1, ok = true;
    for (let i = 1; i < candidate.length; i++) {
      streak = candidate[i] === candidate[i - 1] ? streak + 1 : 1;
      if (streak > 2) { ok = false; break; }
    }
    if (ok) return candidate;
  }
  return modes.map((_, i) => i % 2 === 0 ? "secret" : "buzzer");
}

function makePlan(categoryIds, rounds = 12, recentQids = []) {
  const chosen = categoryIds.map((id) => CATEGORY_MAP.get(id)).filter(Boolean);
  if (!chosen.length) return [];
  const recent = new Set(Array.isArray(recentQids) ? recentQids : []);
  const plan = [];
  const addQuestion = (cat, value) => {
    const all = cat.questions.filter((q) => !value || q.v === value);
    const unused = all.filter((q) => !plan.some((p) => p.qid === questionRef(cat, q)));
    const fresh = unused.filter((q) => !recent.has(questionRef(cat, q)));
    const pool = fresh.length ? fresh : (unused.length ? unused : all);
    if (!pool.length) return false;
    const q = pick(pool);
    plan.push({ catId: cat.id, qid: questionRef(cat, q) });
    return true;
  };

  // Give every selected category a balanced spread of difficulties before filling extras.
  let cursor = 0;
  while (plan.length < rounds && cursor < rounds * 4) {
    const cat = chosen[cursor % chosen.length];
    const values = [100, 200, 300];
    addQuestion(cat, values[Math.floor(cursor / chosen.length) % values.length]);
    cursor += 1;
  }
  while (plan.length < rounds) addQuestion(pick(chosen), null);

  const order = shuffle(plan.slice(0, rounds));
  const modes = balancedModes(order.length);
  return order.map((x, i) => ({ ...x, mode: modes[i] }));
}

function qFromRef(catId, qid) {
  const cat = CATEGORY_MAP.get(catId);
  if (!cat) return null;
  const idx = Number(String(qid).split(":")[1]);
  const q = cat.questions[idx];
  return q ? { cat, q } : null;
}

function speedBonus(deadline, answeredAt) {
  const remain = Math.max(0, deadline - answeredAt);
  return Math.min(50, Math.max(0, Math.round(remain / 1000 * 2)));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {

    if (url.pathname.startsWith("/api/") && !sameOrigin(request)) {
      return json({ ok: false, error: "cross_origin_forbidden" }, 403);
    }

    const quotaReset = DURABLE_QUOTA_RESETS.get(env);
    if (quotaReset && quotaReset <= Date.now()) DURABLE_QUOTA_RESETS.delete(env);
    else if (quotaReset && /^\/api\/(?:health|board|rooms|social|quick|serpent|picture|sudoku|paths)(?:\/|$)/.test(url.pathname)) return durableQuotaResponse(env);

    if (url.pathname === '/api/client-errors') return clientErrorReport(request,{release:RELEASE});
    if (request.method === "GET" && url.pathname === "/api/health") {
      const quizOnline = Boolean(env.ROOMS);
      const boardOnline = Boolean(env.BOARD_ROOMS);
      const quickOnline=Boolean(env.QUICK_ARENA);
      const socialOnline = Boolean(env.SOCIAL_USERS || env.BOARD_ROOMS);
      if (!quizOnline || !boardOnline || !quickOnline) {
        return json({ ok: false, online: false, quizOnline, boardOnline, quickOnline, socialOnline, error: "Durable Object binding missing", version: "7.0.0" }, 503);
      }
      return json({ ok: true, online: true, quizOnline, boardOnline, quickOnline, socialOnline, service: "tahadi-alabaqera-online", version: "7.0.0",release:RELEASE });
    }

    if(request.method==='GET'&&url.pathname==='/api/board/health'){
      const limited=await rateLimit(request,env,'board-health',30,60000);if(limited)return limited;
      if(!env.BOARD_ROOMS||typeof env.BOARD_ROOMS.idFromName!=='function'||typeof env.BOARD_ROOMS.get!=='function')return json({ok:false,code:'BOARD_BINDING_MISSING',error:'محرك الغرف غير مربوط بالسيرفر. فعّل BOARD_ROOMS مع BoardRoom.',release:RELEASE},503);
      try{
        const stub=env.BOARD_ROOMS.get(env.BOARD_ROOMS.idFromName('__board_health__')),response=await stub.fetch('https://board.internal/health'),data=await response.json().catch(()=>({}));
        if(!response.ok||data.engine!=='BoardRoom'||!data.release)return json({ok:false,code:'BOARD_ENGINE_OUTDATED',error:'محرك الغرف على السيرفر قديم أو غير متوافق. انشر الحزمة كاملة مع السيرفر.',release:RELEASE},503);
        return json({...data,ok:true});
      }catch(error){if(isDurableRequestQuotaError(error))throw error;const requestId=crypto.randomUUID();console.error('board health failed',{requestId,error:error.message});return json({ok:false,code:'BOARD_ENGINE_UNAVAILABLE',error:'تعذر تشغيل محرك الغرف على السيرفر. راجع نشر BoardRoom وترحيلاته.',requestId,release:RELEASE},503)}
    }

    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
      const origin = request.headers.get("Origin");
      const headers = {
        "access-control-allow-headers": "content-type,authorization",
        "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
        "access-control-max-age": "86400",
        "vary": "Origin",
      };
      if (origin) headers["access-control-allow-origin"] = origin;
      return new Response(null, { status: 204, headers });
    }

    const socialResponse = await handleSocialRequest(request, env, { rateLimit });
    if (socialResponse) return socialResponse;

    if(url.pathname.startsWith('/api/paths/')){
      if(!env.ROOMS)return json({ok:false,error:'محرك الغرف غير مفعّل'},503);
      const limited=await rateLimit(request,env,'paths-api',120,60000);if(limited)return limited;
      if(url.pathname==='/api/paths/rooms'&&request.method==='POST'){
        if(Number(request.headers.get('content-length'))>1024)return json({ok:false,error:'طلب كبير'},413);
        const text=await request.text();if(text.length>1024)return json({ok:false,error:'طلب كبير'},413);
        let settings;try{settings=JSON.parse(text);}catch{return json({ok:false,error:'إعدادات غير صالحة'},400);}
        if(!pathsSettings(settings))return json({ok:false,error:'اختر الصعوبة من 1 إلى 5 وعدد اللاعبين من 1 إلى 10'},400);
        for(let i=0;i<8;i++){const code=roomCode(),hostKey=token(),stub=env.ROOMS.get(env.ROOMS.idFromName('paths:'+code));const res=await stub.fetch('https://paths.internal/init',{method:'POST',body:JSON.stringify({code,hostKey,difficulty:settings.difficulty,capacity:settings.capacity})});if(res.status===201)return json({ok:true,code,hostKey});}
        return json({ok:false,error:'تعذر إنشاء غرفة الآن'},503);
      }
      const m=url.pathname.match(/^\/api\/paths\/rooms\/(\d{6})\/(ws|status)$/);if(!m)return json({ok:false,error:'not_found'},404);
      if(request.method!=='GET')return json({ok:false,error:'method_not_allowed'},405);
      const headers=new Headers(request.headers);headers.delete('x-bs-account');
      if(m[2]==='ws'){
        const st=String(headers.get('sec-websocket-protocol')||'').split(',').map(x=>x.trim()).find(x=>x.startsWith('st.'))?.slice(3);
        const auth=await authenticate(st?new Request(request.url,{headers:{authorization:'Bearer '+st}}):request,env);
        if(st&&!auth)return json({ok:false,error:'انتهت جلسة الحساب؛ سجل الدخول مجددًا'},401);
        if(auth)headers.set('x-bs-account',auth.username);
      }
      return env.ROOMS.get(env.ROOMS.idFromName('paths:'+m[1])).fetch(new Request('https://paths.internal/'+m[2]+url.search,{headers}));
    }

    if(url.pathname.startsWith('/api/sudoku/')){
      if(!env.ROOMS)return json({ok:false,error:'محرك الغرف غير مفعّل'},503);
      const limited=await rateLimit(request,env,'sudoku-api',120,60000);if(limited)return limited;
      if(url.pathname==='/api/sudoku/rooms'&&request.method==='POST'){
        if(Number(request.headers.get('content-length'))>1024)return json({ok:false,error:'طلب كبير'},413);
        const text=await request.text();if(text.length>1024)return json({ok:false,error:'طلب كبير'},413);
        let settings;try{settings=JSON.parse(text);}catch{return json({ok:false,error:'إعدادات غير صالحة'},400);}
        if(!sudokuSettings(settings))return json({ok:false,error:'اختر الصعوبة من 1 إلى 5 وعدد اللاعبين من 1 إلى 10'},400);
        for(let i=0;i<8;i++){const code=roomCode(),hostKey=token(),stub=env.ROOMS.get(env.ROOMS.idFromName('sudoku:'+code));const res=await stub.fetch('https://sudoku.internal/init',{method:'POST',body:JSON.stringify({code,hostKey,difficulty:settings.difficulty,capacity:settings.capacity})});if(res.status===201)return json({ok:true,code,hostKey});}
        return json({ok:false,error:'تعذر إنشاء غرفة الآن'},503);
      }
      const m=url.pathname.match(/^\/api\/sudoku\/rooms\/(\d{6})\/(ws|status)$/);if(!m)return json({ok:false,error:'not_found'},404);
      if(request.method!=='GET')return json({ok:false,error:'method_not_allowed'},405);
      const headers=new Headers(request.headers);headers.delete('x-bs-account');
      if(m[2]==='ws'){
        const st=String(headers.get('sec-websocket-protocol')||'').split(',').map(x=>x.trim()).find(x=>x.startsWith('st.'))?.slice(3);
        const auth=await authenticate(st?new Request(request.url,{headers:{authorization:'Bearer '+st}}):request,env);
        if(st&&!auth)return json({ok:false,error:'انتهت جلسة الحساب؛ سجل الدخول مجددًا'},401);
        if(auth)headers.set('x-bs-account',auth.username);
      }
      return env.ROOMS.get(env.ROOMS.idFromName('sudoku:'+m[1])).fetch(new Request('https://sudoku.internal/'+m[2]+url.search,{headers}));
    }

    if(url.pathname.startsWith('/api/picture/')){
      if(url.pathname==='/api/picture/config'&&request.method==='GET')return json({ok:true,...imageGenerationConfig(env)});
      if(!env.ROOMS)return json({ok:false,error:'محرك الغرف غير مفعّل'},503);
      const limited=await rateLimit(request,env,'picture:'+ (url.pathname.endsWith('/generate')?'generate':'api'),url.pathname.endsWith('/generate')?12:120,60000);if(limited)return limited;
      if(url.pathname==='/api/picture/rooms'&&request.method==='POST'){
        for(let attempt=0;attempt<8;attempt++){const code=roomCode(),hostKey=token(),stub=env.ROOMS.get(env.ROOMS.idFromName('picture:'+code));const res=await stub.fetch('https://picture.internal/init',{method:'POST',body:JSON.stringify({code,hostKey})});if(res.status===201)return json({ok:true,code,hostKey});}return json({ok:false,error:'تعذر إنشاء غرفة الآن'},503);
      }
      const m=url.pathname.match(/^\/api\/picture\/rooms\/(\d{6})\/(ws|status|generate|art\/[a-f0-9-]{36})$/);if(!m)return json({ok:false,error:'not_found'},404);
      if(request.method!==(m[2]==='generate'?'POST':'GET'))return json({ok:false,error:'method_not_allowed'},405);
      const headers=new Headers(request.headers);headers.delete('x-bs-account');
      if(m[2]==='ws'||m[2]==='generate'){
        const st=m[2]==='ws'?String(headers.get('sec-websocket-protocol')||'').split(',').map(x=>x.trim()).find(x=>x.startsWith('st.'))?.slice(3):null;
        const auth=await authenticate(st?new Request(request.url,{headers:{authorization:'Bearer '+st}}):request,env);if(auth)headers.set('x-bs-account',auth.username);else if(m[2]==='generate')return json({ok:false,error:'سجّل الدخول لتوليد صورة'},401);
      }
      if(Number(headers.get('content-length'))>4096)return json({ok:false,error:'طلب كبير'},413);
      let payload;if(request.method==='POST'){payload=await request.text();if(payload.length>4096)return json({ok:false,error:'طلب كبير'},413);}const stub=env.ROOMS.get(env.ROOMS.idFromName('picture:'+m[1]));return stub.fetch(new Request('https://picture.internal/'+m[2]+url.search,{method:request.method,headers,body:payload}));
    }

    if (url.pathname.startsWith('/api/quick/')) {
      if(!env.QUICK_ARENA)return json({ok:false,error:'المواجهة السريعة تحتاج نشر محرك الإصدار السادس'},503);
      if(request.method!=='POST')return json({ok:false,error:'method_not_allowed'},405);
      const limited=await rateLimit(request,env,'quick-api',150,60000);if(limited)return limited;
      const body=await request.json().catch(()=>({}));
      let target='queue:v6',path;
      if(url.pathname==='/api/quick/join'){
        const auth=await authenticate(request,env);
        if(request.headers.has('authorization')&&!auth)return json({ok:false,error:'انتهت جلسة حسابك، سجل الدخول مجددًا'},401);
        body.username=auth?.username||null;body.name=auth?.profile?.displayName||cleanName(body.name);path='/join';
      } else if(url.pathname==='/api/quick/ticket')path='/ticket';
      else if(url.pathname==='/api/quick/leave')path='/leave';
      else {
        const match=url.pathname.match(/^\/api\/quick\/matches\/([a-f0-9-]{36})\/(state|answer)$/);
        if(!match)return json({ok:false,error:'not_found'},404);
        target='match:'+match[1];path='/'+match[2];
      }
      const stub=env.QUICK_ARENA.get(env.QUICK_ARENA.idFromName(target));
      try{return await stub.fetch('https://quick.internal'+path,{method:'POST',body:JSON.stringify(body)})}catch(error){if(isDurableRequestQuotaError(error))throw error;return json({ok:false,error:'تعذر الاتصال بالمواجهة، أعد المحاولة'},503)}
    }

    if (request.method === "POST" && url.pathname === "/api/ai/questions") {
      const limited = await rateLimit(request, env, "ai-questions", 6, 60_000);
      if (limited) return limited;
      try {
        const body = await request.json().catch(() => ({}));
        const questions = await generateSafeQuestions(env, body);
        return json({ ok:true, questions });
      } catch (error) {
        const code = error?.message || "ai_error";
        return json({ ok:false, error: code === 'ai_not_configured' ? 'مولد الأسئلة غير مفعّل على السيرفر' : 'تعذر توليد أسئلة موثوقة حاليًا' }, code === 'ai_not_configured' ? 503 : 502);
      }
    }

    if (request.method === "POST" && url.pathname === "/api/rooms") {
      const limited = await rateLimit(request, env, "quiz-create", 12, 60_000);
      if (limited) return limited;
      if (!env.ROOMS) return json({ ok: false, error: "محرك الغرف غير مفعّل على السيرفر" }, 503);
      try {
        let body = {};
        try { body = await request.json(); } catch {}
        const name = cleanName(body.name);
        for (let attempt = 0; attempt < 10; attempt++) {
          const code = roomCode();
          const id = env.ROOMS.idFromName(code);
          const stub = env.ROOMS.get(id);
          const hostKey = token();
          const res = await stub.fetch("https://room.internal/init", {
            method: "POST",
            headers: { "content-type": "application/json" },
          body: JSON.stringify({ code, hostKey, name, playerLimit: body.playerLimit }),
          });
          if (res.status === 201) return json({ ok: true, code, hostKey });
        }
        return json({ ok: false, error: "تعذر إنشاء غرفة الآن" }, 503);
      } catch (err) {
        if (isDurableRequestQuotaError(err)) throw err;
        console.error("create room failed", err);
        return json({ ok: false, error: "تعذر تشغيل محرك الغرف. تأكد من نشر Durable Object مع المشروع." }, 503);
      }
    }

    const match = url.pathname.match(/^\/api\/rooms\/(\d{6})(\/ws|\/status)?$/);
    if (match) {
      const limited = await rateLimit(request, env, match[2] === "/ws" ? "quiz-ws" : "quiz-status", match[2] === "/ws" ? 80 : 180, 60_000);
      if (limited) return limited;
      if (!env.ROOMS) return json({ ok: false, error: "محرك الغرف غير مفعّل على السيرفر" }, 503);
      try {
        const code = match[1];
        const suffix = match[2] || "/status";
        const id = env.ROOMS.idFromName(code);
        const stub = env.ROOMS.get(id);
        if (suffix === "/ws") {
          const headers=new Headers(request.headers);headers.delete('x-bs-account');
          const st=String(headers.get('sec-websocket-protocol')||'').split(',').map(x=>x.trim()).find(x=>x.startsWith('st.'))?.slice(3);
          if(st){const check=new Request(request.url,{headers:{authorization:'Bearer '+st}});const auth=await authenticate(check,env);if(auth)headers.set('x-bs-account',auth.username)}
          return await stub.fetch(new Request(request,{headers}));
        }
        return await stub.fetch("https://room.internal/status");
      } catch (err) {
        if (isDurableRequestQuotaError(err)) throw err;
        console.error("room route failed", err);
        return json({ ok: false, error: "تعذر الوصول لمحرك الغرفة" }, 503);
      }
    }

    if(request.method==='POST'&&url.pathname==='/api/serpent/quick'){
      if(!env.QUICK_ARENA||!env.ROOMS)return json({ok:false,error:'محرك المواجهات غير مفعّل'},503);
      const limited=await rateLimit(request,env,'serpent-quick',30,60000);if(limited)return limited;
      const body=await request.json().catch(()=>({})),auth=await authenticate(request,env);
      if(request.headers.has('authorization')&&!auth)return json({ok:false,error:'انتهت جلسة حسابك، سجل الدخول مجددًا'},401);
      const stub=env.QUICK_ARENA.get(env.QUICK_ARENA.idFromName('queue:serpent:v135'));
      return stub.fetch('https://quick.internal/serpent/join',{method:'POST',body:JSON.stringify({name:auth?.profile?.displayName||cleanName(body.name),username:auth?.username||null})});
    }
    if(request.method==='POST'&&url.pathname==='/api/serpent/rooms'){
      const limited=await rateLimit(request,env,'serpent-create',12,60_000);if(limited)return limited;
      if(!env.ROOMS||typeof env.ROOMS.idFromName!=='function')return json({ok:false,error:'محرك اللعب الجماعي غير مربوط؛ انشر الحزمة كاملة'},503);
      const body=await request.json().catch(()=>({})),playerLimit=body.playerLimit??2,duration=body.duration??120,botCount=body.botCount??0,difficulty=body.difficulty??'medium',matchMode=body.matchMode??'timed';
      if(!Number.isInteger(playerLimit)||playerLimit<2||playerLimit>8||!Number.isInteger(botCount)||botCount<0||botCount>Math.min(6,10-playerLimit)||!['easy','medium','hard'].includes(difficulty)||!['timed','survival'].includes(matchMode)||![60,120,180].includes(duration))return json({ok:false,error:'اختر من لاعبين إلى ثمانية؛ مجموع اللاعبين والبوتات لا يتجاوز عشرة'},400);
      for(let attempt=0;attempt<5;attempt++){
        const code=roomCode(),hostKey=token(),stub=env.ROOMS.get(env.ROOMS.idFromName('__serpent__:'+code));
        const response=await stub.fetch('https://serpent.internal/init',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code,hostKey,playerLimit,duration,botCount,difficulty,matchMode})});
        if(response.status===201)return json({ok:true,code,hostKey,playerLimit,duration,botCount,difficulty,matchMode});
        if(response.status!==409)return json({ok:false,error:'تعذر تشغيل الحلبة؛ تأكد من نشر السيرفر الجديد'},503);
      }
      return json({ok:false,error:'تعذر إنشاء الحلبة الآن'},503);
    }
    const serpentMatch=url.pathname.match(/^\/api\/serpent\/rooms\/(\d{6})(\/ws|\/status)?$/);
    if(serpentMatch){
      if(request.method!=='GET')return json({ok:false,error:'method_not_allowed'},405);
      const limited=await rateLimit(request,env,'serpent-connect',100,60_000);if(limited)return limited;
      if(!env.ROOMS||typeof env.ROOMS.idFromName!=='function')return json({ok:false,error:'محرك اللعب الجماعي غير مفعّل'},503);
      const stub=env.ROOMS.get(env.ROOMS.idFromName('__serpent__:'+serpentMatch[1]));
      if(serpentMatch[2]!=='/ws')return stub.fetch('https://serpent.internal/status');
      const headers=new Headers(request.headers);headers.delete('x-bs-account');headers.delete('x-bs-skin');
      const st=String(headers.get('sec-websocket-protocol')||'').split(',').map(s=>s.trim()).find(s=>s.startsWith('st.'))?.slice(3);
      if(st){const auth=await authenticate(new Request(request.url,{headers:{authorization:'Bearer '+st}}),env);if(auth){
        headers.set('x-bs-account',auth.username);
        const profile=await auth.stub.fetch('https://social.internal/career/get',{method:'POST',body:JSON.stringify({secret:auth.secret})});
        if(profile.ok){const data=await profile.json();headers.set('x-bs-skin',data.career?.equipped?.snake||'snake-wild');}
      }}
      const internal=new URL(request.url);internal.hostname='serpent.internal';internal.pathname='/ws';return stub.fetch(new Request(internal,{headers}));
    }

    if (request.method === "POST" && url.pathname === "/api/board/rooms") {
      const limited = await rateLimit(request, env, "board-create", 12, 60_000);
      if (limited) return limited;
      if (!env.BOARD_ROOMS||typeof env.BOARD_ROOMS.idFromName!=='function'||typeof env.BOARD_ROOMS.get!=='function') return json({ ok: false,code:'BOARD_BINDING_MISSING', error: "محرك الغرف غير مربوط بالسيرفر. فعّل BOARD_ROOMS مع BoardRoom." }, 503);
      try {
        let body = {};
        try { body = await request.json(); } catch {}
        const game = String(body.game || "");
        if (!["snakes", "zahra", "jackaroo"].includes(game)) return json({ ok: false, error: "اللعبة غير مدعومة" }, 400);
        let variant = 'classic';
        if (game === 'snakes') {
          try { variant = normalizeSnakesVariant(body.variant); }
          catch { return json({ ok: false, error: 'اختر الكلاسيك أو المطوّرة' }, 400); }
        }
        const playerLimit = game === "jackaroo" ? 4 : Math.min(4, Math.max(2, Number(body.playerLimit) || 2));
        const name = cleanName(body.name);
        for (let attempt = 0; attempt < 12; attempt++) {
          const code = roomCode();
          const id = env.BOARD_ROOMS.idFromName(code);
          const stub = env.BOARD_ROOMS.get(id);
          const hostKey = token();
          const res = await stub.fetch("https://board.internal/init", {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ code, hostKey, game, playerLimit, name, variant }),
          });
          if (res.status === 201) return json({ ok: true, code, hostKey, game, playerLimit, variant });
          if(res.status!==409){const failure=await res.json().catch(()=>({})),requestId=failure.requestId||crypto.randomUUID();return json({ok:false,code:failure.code==='ROOM_INITIALIZATION_FAILED'?'ROOM_INITIALIZATION_FAILED':'BOARD_ENGINE_UNAVAILABLE',error:'فشل تشغيل غرفة اللعبة على السيرفر. أعد المحاولة؛ إذا تكرر الخطأ افحص نشر محرك الغرف.',requestId,release:RELEASE},503)}
        }
        return json({ ok: false, error: "تعذر إنشاء غرفة الآن" }, 503);
      } catch (err) {
        if (isDurableRequestQuotaError(err)) throw err;
        const requestId=crypto.randomUUID();console.error("create board room failed",{requestId,error:err.message});
        return json({ ok: false,code:'BOARD_ENGINE_UNAVAILABLE',error: "تعذر تشغيل محرك الغرف على السيرفر. افحص نشر BoardRoom وترحيلاته.",requestId,release:RELEASE }, 503);
      }
    }

    const boardMatch = url.pathname.match(/^\/api\/board\/rooms\/(\d{6})(\/ws|\/status)?$/);
    if (boardMatch) {
      const limited = await rateLimit(request, env, boardMatch[2] === "/ws" ? "board-ws" : "board-status", boardMatch[2] === "/ws" ? 100 : 220, 60_000);
      if (limited) return limited;
      if (!env.BOARD_ROOMS) return json({ ok: false, error: "محرك ألعاب الجلسات غير مفعّل" }, 503);
      try {
        const code = boardMatch[1];
        const suffix = boardMatch[2] || "/status";
        const id = env.BOARD_ROOMS.idFromName(code);
        const stub = env.BOARD_ROOMS.get(id);
        if (suffix === "/ws") {
          const headers=new Headers(request.headers);headers.delete('x-bs-account');headers.delete('x-bs-characters');headers.delete('x-bs-character');
          const st=String(headers.get('sec-websocket-protocol')||'').split(',').map(x=>x.trim()).find(x=>x.startsWith('st.'))?.slice(3);
          if(st){const check=new Request(request.url,{headers:{authorization:'Bearer '+st}});const auth=await authenticate(check,env);if(auth){headers.set('x-bs-account',auth.username);const result=await auth.stub.fetch('https://social.internal/career/get',{method:'POST',body:JSON.stringify({secret:auth.secret})});if(result.ok){const data=await result.json(),owned=(data.career?.owned||[]).filter(id=>id.startsWith('character-')).map(id=>id.slice(10));headers.set('x-bs-characters',JSON.stringify(owned));headers.set('x-bs-character',(data.career?.equipped?.character||'character-fox').slice(10));}}}
          return await stub.fetch(new Request(request,{headers}));
        }
        return await stub.fetch("https://board.internal/status");
      } catch (err) {
        if (isDurableRequestQuotaError(err)) throw err;
        console.error("board room route failed", err);
        return json({ ok: false, error: "تعذر الوصول لغرفة اللعبة" }, 503);
      }
    }

    if (url.pathname === "/api/catalog") {
      return json({
        categories: CATEGORIES.map((c) => ({ id: c.id, name: c.name, icon: c.icon, desc: c.desc })),
      });
    }

    return env.ASSETS.fetch(request);
    } catch (error) {
      if (isDurableRequestQuotaError(error)) return durableQuotaResponse(env);
      throw error;
    }
  },
};

export class GameRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.room = null;
    this.ctx.blockConcurrencyWhile(async () => {
      this.room = (await this.ctx.storage.get("room")) || null;
      this.syncConnectedFlags();
    });
  }

  syncConnectedFlags() {
    if (!this.room?.players) return;
    const online = new Set();
    for (const ws of this.ctx.getWebSockets()) {
      try {
        const a = ws.deserializeAttachment();
        if (a?.playerId&&(!this.room.players[a.playerId]?.connection||this.room.players[a.playerId].connection===a.connection)) online.add(a.playerId);
      } catch {}
    }
    for (const p of Object.values(this.room.players)) p.connected = online.has(p.id);
  }

  async persist() {
    if (this.room) await this.ctx.storage.put("room", this.room);
  }

  async pathsDelegate(){if(!this.pathsRoom)this.pathsRoom=new PathsRoom(this.ctx,this.env);await this.pathsRoom.ready;return this.pathsRoom;}

  async sudokuDelegate(){if(!this.sudokuRoom)this.sudokuRoom=new SudokuRoom(this.ctx,this.env);await this.sudokuRoom.ready;return this.sudokuRoom;}

  async pictureDelegate(){if(!this.pictureRoom)this.pictureRoom=new ImageRoom(this.ctx,this.env);await this.pictureRoom.ready;return this.pictureRoom;}

  async serpentDelegate(){if(!this.serpentRoom)this.serpentRoom=new SerpentRoom(this.ctx,this.env);await this.serpentRoom.ready;return this.serpentRoom;}

  async fetch(request) {
    const url = new URL(request.url);
    if(url.hostname==='paths.internal')return (await this.pathsDelegate()).fetch(request);
    if(url.hostname==='sudoku.internal')return (await this.sudokuDelegate()).fetch(request);
    if(url.hostname==='picture.internal')return (await this.pictureDelegate()).fetch(request);
    if(url.hostname==='serpent.internal')return (await this.serpentDelegate()).fetch(request);

    if (url.pathname === "/rate" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const bucket = String(body.bucket || "default").slice(0, 48);
      const limit = Math.min(1000, Math.max(1, Number(body.limit) || 60));
      const windowMs = Math.min(3_600_000, Math.max(1000, Number(body.windowMs) || 60_000));
      const key = `rate:${bucket}`;
      const now = Date.now();
      let rec = await this.ctx.storage.get(key);
      if (!rec || now >= rec.resetAt) rec = { count: 0, resetAt: now + windowMs };
      rec.count += 1;
      await this.ctx.storage.put(key, rec);
      await this.ctx.storage.setAlarm(rec.resetAt + 5_000);
      if (rec.count > limit) return json({ ok: false, retryAfter: Math.max(1, Math.ceil((rec.resetAt - now) / 1000)) }, 429);
      return json({ ok: true });
    }

    if (url.pathname === "/init" && request.method === "POST") {
      if (this.room) return json({ ok: false, error: "room_exists" }, 409);
      const body = await request.json();
      const now = Date.now();
      this.room = {
        code: body.code,
        hostKey: body.hostKey,
        createdAt: now,
        updatedAt: now,
        status: "lobby",
        selectedCategories: shuffle(CATEGORIES.map((c) => c.id)).slice(0, 6),
        roundCount: 12,
        players: {},
        order: [],
        roundPlan: [],
        roundIndex: -1,
        current: null,
        lastReveal: null,
        recentQids: [],
        winnerId: null,
        mode: [4,6].includes(Number(body.playerLimit)) ? `teams-${Number(body.playerLimit)}` : 'free',
        playerLimit: [2,4,5,6,7,8].includes(Number(body.playerLimit)) ? Number(body.playerLimit) : 8,
        expiresAt: now + 24 * 60 * 60 * 1000,
      };
      await this.persist();
      await this.ctx.storage.setAlarm(this.room.expiresAt);
      return json({ ok: true }, 201);
    }

    if (url.pathname === "/status") {
      if (!this.room) return json({ ok: false, error: "الغرفة غير موجودة" }, 404);
      return json({ ok: true, status: this.room.status, players: this.room.order.length });
    }

    if (url.pathname.endsWith("/ws")) {
      if (!this.room) return json({ ok: false, error: "الغرفة غير موجودة" }, 404);
      if (request.headers.get("Upgrade") !== "websocket") return json({ ok: false, error: "WebSocket required" }, 426);

      if (this.room.status === "lobby" && this.cleanupLobbySeats()) await this.persist();

      const name = cleanName(url.searchParams.get("name"));
      const { reconnectToken, hostKey, protocol } = webSocketAuth(request);
      if (!protocol) return json({ ok: false, error: "WebSocket protocol required" }, 426);
      let player = null;
      const account=request.headers.get('x-bs-account')||null;
      const claimed=reconnectToken?Object.values(this.room.players).find(p=>p.token===reconnectToken):null;
      if(claimed?.username&&claimed.username!==account)return json({ok:false,error:'ارجع بالحساب نفسه'},403);
      if(!claimed&&account&&Object.values(this.room.players).some(p=>p.username===account))return json({ok:false,error:'حسابك موجود في الغرفة'},409);

      if (reconnectToken) {
        player = Object.values(this.room.players).find((p) => p.token === reconnectToken) || null;
      }

      if (!player && hostKey && hostKey === this.room.hostKey) {
        player = Object.values(this.room.players).find((p) => p.role === "host") || null;
        if (!player) player = this.addPlayer(name, "host");
      }

      if (!player) {
        if (this.room.order.length === 0) return json({ ok: false, error: "بانتظار دخول المضيف أولًا" }, 409);
        if (this.room.status !== "lobby") return json({ ok: false, error: "المباراة بدأت ولا يمكن دخول لاعب جديد" }, 409);
        this.cleanupLobbySeats();
        if (this.room.order.length >= (this.room.playerLimit || 8)) return json({ ok: false, error: `الغرفة ممتلئة (الحد الأقصى ${this.room.playerLimit || 8} لاعبين)` }, 409);
        player = this.addPlayer(name, "guest");
      } else if (name) {
        player.name = name;
      }

      if(request.headers.get('x-bs-account'))player.username=request.headers.get('x-bs-account');
      for (const old of this.ctx.getWebSockets()) {
        try {
          if (old.deserializeAttachment()?.playerId === player.id) old.close(4001, "reconnected");
        } catch {}
      }

      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      this.ctx.acceptWebSocket(server);
      player.connection=crypto.randomUUID();
      const roundContext=String(request.headers.get('sec-websocket-protocol')||'').split(',').map(x=>x.trim()).includes('qc.round-v21');
      server.serializeAttachment({ playerId: player.id,connection:player.connection,roundContext });
      player.connected = true;
      player.disconnectedAt = null;
      this.room.updatedAt = Date.now();
      await this.persist();

      server.send(JSON.stringify({
        type: "welcome",
        playerId: player.id,
        token: player.token,
        state: this.publicState(player.id),
      }));
      this.broadcastState();

      return webSocketResponse(client, protocol);
    }

    return json({ ok: false, error: "not_found" }, 404);
  }

  addPlayer(name, role) {
    const id = crypto.randomUUID();
    const p = {
      id,
      token: token(),
      name: cleanName(name),
      role,
      team: this.room.mode === 'teams-4' ? (this.room.order.length % 2 === 0 ? 'A' : 'B') : this.room.mode === 'teams-6' ? (this.room.order.length % 2 === 0 ? 'A' : 'B') : null,
      score: 0,
      ready: false,
      connected: true,
      disconnectedAt: null,
      powers: { double: true, time: true, block: true },
    };
    this.room.players[id] = p;
    this.room.order.push(id);
    return p;
  }

  playerForSocket(ws) {
    try {
      const a = ws.deserializeAttachment();
      const player=a?.playerId ? this.room?.players?.[a.playerId] : null;return player?.connection&&player.connection!==a.connection?null:player;
    } catch {
      return null;
    }
  }

  async webSocketMessage(ws, raw) {
    if(ws.deserializeAttachment()?.paths)return (await this.pathsDelegate()).webSocketMessage(ws, raw);
    if(ws.deserializeAttachment()?.sudoku)return (await this.sudokuDelegate()).webSocketMessage(ws, raw);
    if(ws.deserializeAttachment()?.picture)return (await this.pictureDelegate()).webSocketMessage(ws, raw);
    if(ws.deserializeAttachment()?.serpent)return (await this.serpentDelegate()).webSocketMessage(ws,raw);
    if (!this.room) return;
    const player = this.playerForSocket(ws);
    if (!player) return;

    const rawText = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
    if (rawText.length > 4096) return this.sendError(ws, "الرسالة أكبر من المسموح");
    let msg;
    try { msg = JSON.parse(rawText); }
    catch { return this.sendError(ws, "رسالة غير صالحة"); }

    if(['answer','buzz','power'].includes(msg.type)){const required=ws.deserializeAttachment()?.roundContext;if((required||Object.hasOwn(msg,'roundIndex')||Object.hasOwn(msg,'matchId'))&&(msg.matchId!==this.room.matchId||msg.roundIndex!==this.room.roundIndex))return this.sendError(ws,'تغير السؤال؛ انتظر تحديث الجولة');}

    try {
      switch (msg.type) {
        case "ready":
          if (this.room.status !== "lobby") break;
          player.ready = Boolean(msg.ready);
          await this.persistAndBroadcast();
          break;

        case "set_categories":
          if (player.role !== "host" || this.room.status !== "lobby") return this.sendError(ws, "للمضيف فقط");
          {
            const ids = [...new Set(Array.isArray(msg.categories) ? msg.categories : [])]
              .filter((id) => CATEGORY_MAP.has(id))
              .slice(0, 6);
            if (ids.length !== 6) return this.sendError(ws, "اختر 6 فئات");
            this.room.selectedCategories = ids;
            for(const p of Object.values(this.room.players))p.ready=false;
            await this.persistAndBroadcast();
          }
          break;

        case "set_round_count":
          if (player.role !== "host" || this.room.status !== "lobby") return this.sendError(ws, "للمضيف فقط");
          {
            const requested = Number(msg.roundCount);
            if (![12, 18, 24].includes(requested)) return this.sendError(ws, "عدد الجولات غير مدعوم");
            this.room.roundCount = requested;
            for (const id of this.room.order) this.room.players[id].ready = false;
            await this.persistAndBroadcast();
          }
          break;

        case "random_categories":
          if (player.role !== "host" || this.room.status !== "lobby") return this.sendError(ws, "للمضيف فقط");
          this.room.selectedCategories = shuffle(CATEGORIES.map((c) => c.id)).slice(0, 6);
          for(const p of Object.values(this.room.players))p.ready=false;
          await this.persistAndBroadcast();
          break;

        case "start":
          if (player.role !== "host") return this.sendError(ws, "للمضيف فقط");
          if (this.room.status !== "lobby") return;
          if (this.room.order.length < 2) return this.sendError(ws, "يلزم لاعبان على الأقل");
          if(this.room.mode!=='free'&&this.room.order.length!==this.room.playerLimit)return this.sendError(ws,"انتظر اكتمال الفريقين");
          if (!this.room.order.every((id) => this.room.players[id]?.connected)) return this.sendError(ws, "انتظر اتصال اللاعبين");
          if (!this.room.order.every((id) => this.room.players[id]?.ready)) return this.sendError(ws, "يجب أن يكون جميع اللاعبين جاهزين");
          if (this.room.selectedCategories.length !== 6) return this.sendError(ws, "اختر 6 فئات");
          await this.startMatch();
          break;

        case "answer":
          await this.handleAnswer(player, Number(msg.choice));
          break;

        case "buzz":
          await this.handleBuzz(player);
          break;

        case "power":
          await this.usePower(player, String(msg.power || ""));
          break;

        case "rematch":
          if (player.role !== "host" || this.room.status !== "finished") return this.sendError(ws, "للمضيف فقط");
          if(this.room.rewardsComplete===false)return this.sendError(ws,"جاري حفظ النتيجة");
          await this.resetForRematch();
          break;

        default:
          this.sendError(ws, "أمر غير معروف");
      }
    } catch (err) {
      console.error("room message error", err);
      this.sendError(ws, "تعذر تنفيذ الحركة");
    }
  }

  async webSocketClose(ws) {
    if(ws.deserializeAttachment()?.paths)return (await this.pathsDelegate()).webSocketClose(ws);
    if(ws.deserializeAttachment()?.sudoku)return (await this.sudokuDelegate()).webSocketClose(ws);
    if(ws.deserializeAttachment()?.picture)return (await this.pictureDelegate()).webSocketClose(ws);
    if(ws.deserializeAttachment()?.serpent)return (await this.serpentDelegate()).webSocketClose(ws);
    const p = this.playerForSocket(ws);
    if (p) {
      p.connected = false;
      p.disconnectedAt = Date.now();
      this.room.updatedAt = Date.now();
      await this.persist();
      this.broadcastState();
      if (this.room.status==='finished'&&this.room.rewardsComplete===false){await this.saveQuizRewards();this.broadcastState();}
    if (["lobby", "finished"].includes(this.room.status)) {
        await this.ctx.storage.setAlarm(Math.min(this.room.expiresAt, p.disconnectedAt + DISCONNECT_GRACE_MS));
      }
    }
  }

  async webSocketError(ws) {
    if(ws.deserializeAttachment()?.paths)return (await this.pathsDelegate()).webSocketError(ws);
    if(ws.deserializeAttachment()?.sudoku)return (await this.sudokuDelegate()).webSocketError(ws);
    if(ws.deserializeAttachment()?.picture)return (await this.pictureDelegate()).webSocketError(ws);
    if(ws.deserializeAttachment()?.serpent)return (await this.serpentDelegate()).webSocketError(ws);
    await this.webSocketClose(ws);
  }

  sendError(ws, message) {
    try { ws.send(JSON.stringify({ type: "error", message })); } catch {}
  }

  cleanupLobbySeats() {
    if (!this.room || !["lobby", "finished"].includes(this.room.status)) return false;
    this.syncConnectedFlags();
    const now = Date.now();
    let changed = false;

    for (const id of [...this.room.order]) {
      const p = this.room.players[id];
      if (p?.role === "guest" && !p.connected && p.disconnectedAt && now - p.disconnectedAt >= DISCONNECT_GRACE_MS) {
        delete this.room.players[id];
        this.room.order = this.room.order.filter((x) => x !== id);
        changed = true;
      }
    }

    const hostId = this.room.order.find((id) => this.room.players[id]?.role === "host");
    const host = hostId ? this.room.players[hostId] : null;
    if (host && !host.connected && host.disconnectedAt && now - host.disconnectedAt >= DISCONNECT_GRACE_MS) {
      const successorId = this.room.order.find((id) => id !== hostId && this.room.players[id]?.connected);
      if (successorId) {
        delete this.room.players[hostId];
        this.room.order = this.room.order.filter((id) => id !== hostId);
        const successor = this.room.players[successorId];
        successor.role = "host";
        successor.ready = false;
        this.room.hostKey = token();
        changed = true;
      }
    }

    return changed;
  }

  async scheduleLobbyAlarm() {
    if (!this.room || !["lobby", "finished"].includes(this.room.status)) return;
    const now = Date.now();
    const candidates = [this.room.expiresAt];
    if(this.room.status==='finished'&&this.room.rewardsComplete===false)candidates.push(this.room.rewardRetryAt||now+10000);
    for (const id of this.room.order) {
      const p = this.room.players[id];
      if (!p?.connected && p?.disconnectedAt) candidates.push(p.disconnectedAt + DISCONNECT_GRACE_MS);
    }
    const next = Math.min(...candidates.filter((ts) => Number.isFinite(ts) && ts > now));
    if (Number.isFinite(next)) await this.ctx.storage.setAlarm(next);
  }

  async persistAndBroadcast() {
    this.room.updatedAt = Date.now();
    await this.persist();
    this.broadcastState();
  }

  broadcastState() {
    if (!this.room) return;
    this.syncConnectedFlags();
    for (const ws of this.ctx.getWebSockets()) {
      const p = this.playerForSocket(ws);
      if (!p) continue;
      try { ws.send(JSON.stringify({ type: "state", state: this.publicState(p.id) })); } catch {}
    }
  }

  publicState(playerId) {
    const me = this.room.players[playerId];
    const players = this.room.order.map((id) => {
      const p = this.room.players[id];
      return {
        id: p.id, name: p.name, role: p.role, team:p.team, score: p.score,
        ready: p.ready, connected: Boolean(p.connected),
        powers: p.id === playerId ? p.powers : {
          double: p.powers.double, time: p.powers.time, block: p.powers.block
        },
      };
    });

    const out = {
      code: this.room.code,
      serverNow:Date.now(),matchId:this.room.matchId||'',mode:this.room.mode,playerLimit:this.room.playerLimit,rewardsComplete:this.room.rewardsComplete!==false,teamScores:['A','B'].map(team=>({team,score:this.room.order.reduce((n,id)=>n+(this.room.players[id]?.team===team?this.room.players[id].score:0),0)})),
      status: this.room.status,
      selectedCategories: this.room.selectedCategories,
      categories: CATEGORIES.map((c) => ({ id: c.id, name: c.name, icon: c.icon, desc: c.desc })),
      players,
      me: me ? { id: me.id, role: me.role, powers: me.powers } : null,
      roundIndex: this.room.roundIndex,
      roundCount: this.room.roundCount,
      winnerId: this.room.winnerId,
      lastReveal: this.room.lastReveal,
      current: null,
    };

    const c = this.room.current;
    if (c) {
      const base = {
        mode: c.mode,
        phase: c.phase,
        category: c.category,
        value: c.value,
        question: c.question,
        media: c.media || null,
        deadline: c.deadline,
        startedAt: c.startedAt,
        answerOpensAt: c.answerOpensAt || c.startedAt,
        buzzWinner: c.buzzWinner,
        stealPlayer: c.stealPlayer,
        answeredPlayers: Object.keys(c.answers || {}),
        blocked: Boolean(c.blocked?.[playerId]),
      };

      if (c.mode === "secret" && c.phase === "secret") base.options = c.options;
      if (c.mode === "buzzer" && c.phase === "buzzer_answer" && c.buzzWinner === playerId) base.options = c.options;
      if (c.mode === "buzzer" && c.phase === "steal" && c.stealPlayer === playerId) base.options = c.options;
      out.current = base;
    }
    return out;
  }

  async startMatch() {
    this.room.status = "playing";
    this.room.matchId=crypto.randomUUID();this.room.startedAt=Date.now();this.room.rewardsComplete=false;
    this.room.winnerId = null;
    this.room.lastReveal = null;
    this.room.roundIndex = -1;
    this.room.roundPlan = makePlan(this.room.selectedCategories, this.room.roundCount, this.room.recentQids || []);
    this.room.recentQids = [...new Set([
      ...this.room.roundPlan.map((x) => x.qid),
      ...(this.room.recentQids || []),
    ])].slice(0, 96);
    for (const id of this.room.order) {
      const p = this.room.players[id];
      p.score = 0;
      p.ready = true;
      p.powers = { double: true, time: true, block: true };
    }
    await this.startNextRound();
  }

  async startNextRound() {
    this.room.roundIndex += 1;
    this.room.lastReveal = null;

    if (this.room.roundIndex >= this.room.roundPlan.length) {
      await this.finishMatch();
      return;
    }

    const plan = this.room.roundPlan[this.room.roundIndex];
    const found = qFromRef(plan.catId, plan.qid);
    if (!found) {
      await this.startNextRound();
      return;
    }
    const { cat, q } = found;
    const { options, correctIndex } = buildChoices(cat, q);
    const now = Date.now();
    const isSecret = plan.mode === "secret";
    const previewMs = q.media === "memory" ? Math.min(8000, Math.max(2500, Number(q.memory?.previewMs) || 4500)) : 0;
    const answerOpensAt = now + previewMs;
    const responseMs = isSecret ? 30000 : 15000;
    this.room.current = {
      mode: plan.mode,
      phase: isSecret ? "secret" : "buzzer",
      category: { id: cat.id, name: cat.name, icon: cat.icon },
      value: q.v,
      question: q.q,
      media: q.media ? {
        type: q.media, src: q.src, zoom: q.zoom || null, hintZoom: q.hintZoom || null,
        focusX: Number.isFinite(q.focusX) ? q.focusX : 50,
        focusY: Number.isFinite(q.focusY) ? q.focusY : 50,
        replays: Number.isInteger(q.replays) ? q.replays : (q.media === "sound" ? 2 : null),
        credit: q.credit || "",
        memory: q.media === "memory" ? (q.memory || null) : null,
      } : null,
      options,
      correctIndex,
      correctAnswer: q.a,
      deadline: answerOpensAt + responseMs,
      startedAt: now,
      answerOpensAt,
      answers: {},
      buzzWinner: null,
      stealPlayer: null,
      double: {},
      blocked: {},
    };
    await this.persistAndBroadcast();
    await this.ctx.storage.setAlarm(this.room.current.deadline);
  }

  opponentId(playerId){const player=this.room.players[playerId];return this.room.order.find(id=>id!==playerId&&this.room.players[id]?.connected&&(!player?.team||this.room.players[id].team!==player.team))||null;}

  allowedToAnswer(playerId) {
    const c = this.room.current;
    if (!c) return false;
    if (c.mode === "secret" && c.phase === "secret") return !c.answers[playerId];
    if (c.mode === "buzzer" && c.phase === "buzzer_answer") return c.buzzWinner === playerId;
    if (c.mode === "buzzer" && c.phase === "steal") return c.stealPlayer === playerId;
    return false;
  }

  async handleAnswer(player, choice) {
    const c = this.room.current;
    if (this.room.status !== "playing" || !c || !this.allowedToAnswer(player.id)) return;
    if (!Number.isInteger(choice) || choice < 0 || choice >= c.options.length) return;
    const now = Date.now();
    if (now < (c.answerOpensAt || c.startedAt || 0)) return;
    if (now >= c.deadline) return;

    c.answers[player.id] = { choice, at: now, bonus: speedBonus(c.deadline, now) };

    if (c.mode === "secret") {
      if (Object.keys(c.answers).length >= this.room.order.length) await this.finalizeSecret();
      else await this.persistAndBroadcast();
      return;
    }

    if (c.phase === "buzzer_answer") {
      if (choice === c.correctIndex) {
        await this.finalizeBuzzer(player.id, true, false);
      } else {
        const opponentId = this.opponentId(player.id);
        if (!opponentId||c.blocked?.[opponentId]) {
          await this.finalizeBuzzer(player.id, false, false);
        } else {
          c.phase = "steal";
          c.stealPlayer = opponentId;
          c.deadline = Date.now() + 8000;
          await this.persistAndBroadcast();
          await this.ctx.storage.setAlarm(c.deadline);
        }
      }
      return;
    }

    if (c.phase === "steal") {
      await this.finalizeBuzzer(player.id, choice === c.correctIndex, true);
    }
  }

  async handleBuzz(player) {
    const c = this.room.current;
    if (this.room.status !== "playing" || !c || c.mode !== "buzzer" || c.phase !== "buzzer") return;
    if (Date.now() < (c.answerOpensAt || c.startedAt || 0)) return;
    if (Date.now() >= c.deadline) return;
    c.buzzWinner = player.id;
    c.phase = "buzzer_answer";
    c.deadline = Date.now() + 10000;
    await this.persistAndBroadcast();
    await this.ctx.storage.setAlarm(c.deadline);
  }

  async usePower(player, power) {
    const c = this.room.current;
    if (this.room.status !== "playing" || !c) return;
    if (Date.now() < (c.answerOpensAt || c.startedAt || 0)) return;
    if (Date.now() >= c.deadline) return;
    if (!["double", "time", "block"].includes(power)) return;
    if (!player.powers[power]) return;
    if (c.blocked?.[player.id]) return;

    const phaseOpen = ["secret", "buzzer", "buzzer_answer", "steal"].includes(c.phase);
    if (!phaseOpen) return;

    if (power === "double") {
      if (c.answers[player.id]) return;
      c.double[player.id] = true;
    } else if (power === "time") {
      if (c.answers[player.id]) return;
      if (c.mode === "buzzer" && c.phase === "buzzer_answer" && c.buzzWinner !== player.id) return;
      if (c.mode === "buzzer" && c.phase === "steal" && c.stealPlayer !== player.id) return;
      c.deadline += 7000;
      await this.ctx.storage.setAlarm(c.deadline);
    } else if (power === "block") {
      const opponentId = this.opponentId(player.id);
      if (!opponentId) return;
      c.blocked[opponentId] = true;
    }

    player.powers[power] = false;
    await this.persistAndBroadcast();
  }

  pointsFor(playerId, answer) {
    const c = this.room.current;
    let pts = c.value + (answer?.bonus ?? speedBonus(c.deadline, answer?.at || Date.now()));
    if (c.double[playerId]) pts *= 2;
    return pts;
  }

  async finalizeSecret() {
    const c = this.room.current;
    if (!c || c.mode !== "secret") return;
    const results = {};
    for (const id of this.room.order) {
      const a = c.answers[id];
      const correct = Boolean(a && a.choice === c.correctIndex);
      const gain = correct ? this.pointsFor(id, a) : 0;
      if (gain) this.room.players[id].score += gain;
      results[id] = { correct, gain, choice: a?.choice ?? null };
    }
    await this.revealRound(results);
  }

  async finalizeBuzzer(playerId, correct, stolen) {
    const c = this.room.current;
    const results = {};
    for (const id of this.room.order) results[id] = { correct: false, gain: 0, choice: c.answers[id]?.choice ?? null };
    if (correct) {
      const a = c.answers[playerId];
      const gain = this.pointsFor(playerId, a);
      this.room.players[playerId].score += gain;
      results[playerId] = { correct: true, gain, choice: a?.choice ?? null, stolen: Boolean(stolen) };
    }
    await this.revealRound(results);
  }

  async revealRound(results) {
    const c = this.room.current;
    if (!c) return;
    this.room.lastReveal = {
      roundIndex: this.room.roundIndex,
      category: c.category,
      value: c.value,
      mode: c.mode,
      question: c.question,
      media: c.media || null,
      options: c.options,
      correctIndex: c.correctIndex,
      correctAnswer: c.correctAnswer,
      results,
      nextAt: Date.now() + 5000,
    };
    this.room.current = null;
    await this.persistAndBroadcast();
    await this.ctx.storage.setAlarm(this.room.lastReveal.nextAt);
  }

  async finishMatch() {
    this.room.status='finished';this.room.current=null;this.room.lastReveal=null;this.room.finishedAt=Date.now();
    if(this.room.mode==='teams-4'||this.room.mode==='teams-6'){
      const scores=['A','B'].map(team=>({team,score:this.room.order.reduce((n,id)=>n+(this.room.players[id]?.team===team?this.room.players[id].score:0),0)})).sort((a,b)=>b.score-a.score);
      this.room.winnerId=scores[0].score===scores[1].score?null:'team:'+scores[0].team;
    }else{const list=this.room.order.map(id=>this.room.players[id]).sort((a,b)=>b.score-a.score);this.room.winnerId=list.length>1&&list[0].score===list[1].score?null:list[0]?.id||null;}
    this.room.expiresAt=Date.now()+86400000;
    await this.persistAndBroadcast();await this.saveQuizRewards();this.broadcastState();await this.scheduleLobbyAlarm();
  }
  async saveQuizRewards(){
    const r=this.room;if(!r||r.status!=='finished'||r.rewardsComplete!==false)return;
    try{if(r.matchId&&r.roundIndex>=12&&r.roundPlan.length>=12&&r.finishedAt-r.startedAt>=30000)for(const id of r.order){const p=r.players[id];if(!p.username)continue;const stub=getSocialStub(this.env,p.username);if(!stub)throw new Error('binding_missing');const res=await stub.fetch('https://social.internal/career/verified',{method:'POST',body:JSON.stringify({id:`quiz:${r.matchId}:${p.id}`,game:'quiz',win:r.winnerId===p.id||r.winnerId==='team:'+p.team})});if(!res.ok)throw new Error('reward_failed');}r.rewardsComplete=true;r.rewardRetryAt=null;}catch{r.rewardRetryAt=Date.now()+10000;}await this.persist();
  }

  async resetForRematch() {
    this.room.status = "lobby";
    this.room.roundIndex = -1;
    this.room.roundPlan = [];
    this.room.current = null;
    this.room.lastReveal = null;
    this.room.winnerId = null;
    for (const id of this.room.order) {
      const p = this.room.players[id];
      p.score = 0;
      p.ready = false;
      p.powers = { double: true, time: true, block: true };
    }
    await this.persistAndBroadcast();
    await this.scheduleLobbyAlarm();
  }

  async alarm() {
    if(this.pathsRoom||await this.ctx.storage.get('pathsRoom'))return (await this.pathsDelegate()).alarm();
    if(this.sudokuRoom||await this.ctx.storage.get('sudokuRoom'))return (await this.sudokuDelegate()).alarm();
    if(this.pictureRoom||await this.ctx.storage.get('imageRoom')||await this.ctx.storage.get('imageQuota'))return (await this.pictureDelegate()).alarm();
    if(this.serpentRoom||await this.ctx.storage.get('serpent'))return (await this.serpentDelegate()).alarm();
    if (!this.room) {
      const now = Date.now();
      const rateEntries = await this.ctx.storage.list({ prefix: "rate:" });
      const expired = [];
      let nextReset = Infinity;
      for (const [key, rec] of rateEntries) {
        if (!rec?.resetAt || now >= rec.resetAt) expired.push(key);
        else nextReset = Math.min(nextReset, rec.resetAt);
      }
      if (expired.length) await this.ctx.storage.delete(expired);
      if (Number.isFinite(nextReset)) await this.ctx.storage.setAlarm(nextReset + 5_000);
      return;
    }
    const now = Date.now();

    if (now >= this.room.expiresAt) {
      await this.ctx.storage.deleteAll();
      this.room = null;
      return;
    }

    if (["lobby", "finished"].includes(this.room.status)) {
      if (this.cleanupLobbySeats()) await this.persistAndBroadcast();
      await this.scheduleLobbyAlarm();
      return;
    }

    if (this.room.lastReveal && now >= this.room.lastReveal.nextAt) {
      await this.startNextRound();
      return;
    }

    const c = this.room.current;
    if (!c || now + 300 < c.deadline) {
      if (c) await this.ctx.storage.setAlarm(c.deadline);
      return;
    }

    if (c.mode === "secret" && c.phase === "secret") {
      await this.finalizeSecret();
      return;
    }

    if (c.mode === "buzzer" && c.phase === "buzzer") {
      const results = Object.fromEntries(this.room.order.map((id) => [id, { correct: false, gain: 0, choice: null }]));
      await this.revealRound(results);
      return;
    }

    if (c.mode === "buzzer" && c.phase === "buzzer_answer") {
      const opponentId = this.room.order.find((id) => id !== c.buzzWinner);
      if (opponentId && !c.blocked?.[opponentId]) {
        c.phase = "steal";
        c.stealPlayer = opponentId;
        c.deadline = Date.now() + 8000;
        await this.persistAndBroadcast();
        await this.ctx.storage.setAlarm(c.deadline);
      } else {
        await this.finalizeBuzzer(c.buzzWinner, false, false);
      }
      return;
    }

    if (c.mode === "buzzer" && c.phase === "steal") {
      await this.finalizeBuzzer(c.stealPlayer, false, true);
    }
  }
}


export class BoardRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.room = null;
    this.social = null;
    this.ctx.blockConcurrencyWhile(async () => {
      this.room = (await this.ctx.storage.get("room")) || null;
      this.syncConnected();
    });
  }

  async socialDelegate(){
    if(!this.social)this.social=new BoardSocialUser(this.ctx,this.env);
    await this.social.ready;return this.social;
  }

  async initializeRoom(body){
    if(this.room)return json({ok:false,error:'room_exists'},409);
    const game=String(body.game||'');if(!['snakes','zahra','jackaroo'].includes(game))return json({ok:false,error:'invalid_game'},400);
    let variant='classic';if(game==='snakes')try{variant=normalizeSnakesVariant(body.variant)}catch{return json({ok:false,error:'invalid_variant'},400)}
    const now=Date.now(),room={code:body.code,hostKey:body.hostKey,game,variant,playerLimit:game==='jackaroo'?4:Math.min(4,Math.max(2,Number(body.playerLimit)||2)),createdAt:now,updatedAt:now,expiresAt:now+24*60*60*1000,status:'lobby',players:{},order:[],state:null,pendingRoll:null,turnDeadline:null,version:0};
    try{await this.ctx.storage.put('room',room);await this.ctx.storage.setAlarm(room.expiresAt);this.room=room;return json({ok:true},201)}
    catch(error){const requestId=crypto.randomUUID();this.room=null;try{await this.ctx.storage.delete('room');await this.ctx.storage.deleteAlarm()}catch(rollback){console.error('board initialization rollback failed',{requestId,error:rollback.message})}console.error('board initialization failed',{requestId,error:error.message});return json({ok:false,code:'ROOM_INITIALIZATION_FAILED',error:'تعذر حفظ الغرفة على السيرفر. حاول مرة أخرى.',requestId},503)}
  }

  syncConnected() {
    if (!this.room?.players) return;
    const ids = new Set();
    for (const ws of this.ctx.getWebSockets()) {
      try { const a = ws.deserializeAttachment(); if (a?.playerId) ids.add(a.playerId); } catch {}
    }
    for (const p of Object.values(this.room.players)) p.connected = ids.has(p.id);
  }

  async persist() {
    if (!this.room) return;
    this.room.updatedAt = Date.now();
    await this.ctx.storage.put("room", this.room);
    if(this.room.status==='finished'&&!this.room.rewardsComplete){
      const endedAt=this.room.startedAt;
      const rewards=this.room.order.map((id,index)=>{const player=this.room.players[id];return {username:player.username,id:'board:'+this.room.code+':'+endedAt+':'+player.id,game:this.room.game,win:this.room.game==='jackaroo'?this.room.state.winnerTeam===index%2:this.room.state.winner===index}});
      try{
        for(const reward of rewards){
          if(!reward.username)continue;
          const stub=getSocialStub(this.env,reward.username);if(!stub)throw new Error('career_binding_missing');
          const result=await stub.fetch('https://social.internal/career/verified',{method:'POST',body:JSON.stringify(reward)});
          if(!result.ok)throw new Error('career_reward_failed');
        }
        if(this.room.startedAt===endedAt&&this.room.status==='finished'){this.room.rewardsComplete=true;this.room.rewardRetryAt=null;await this.ctx.storage.put('room',this.room)}
      }catch(error){if(this.room.startedAt===endedAt&&this.room.status==='finished'){this.room.rewardRetryAt=Date.now()+10000;await this.ctx.storage.put('room',this.room)}console.error('Board reward will retry',error.message)}
    }
  }

  addPlayer(name, role) {
    const id = crypto.randomUUID();
    const p = { id, token: token(), name: cleanName(name), role, ready: false, connected: true, disconnectedAt: null };
    this.room.players[id] = p;
    this.room.order.push(id);
    return p;
  }

  playerForSocket(ws) {
    try {
      const a = ws.deserializeAttachment();
      return a?.playerId ? this.room?.players?.[a.playerId] : null;
    } catch { return null; }
  }

  playerIndex(playerId) { return this.room?.order?.indexOf(playerId) ?? -1; }

  async leaveLobby(player, ws) {
    if (!this.room || this.room.status !== "lobby" || !player) return false;
    const wasHost = player.role === "host";
    delete this.room.players[player.id];
    this.room.order = this.room.order.filter((id) => id !== player.id);
    if (wasHost && this.room.order.length) {
      const successorId = this.room.order.find((id) => this.room.players[id]?.connected) || this.room.order[0];
      this.room.players[successorId].role = "host";
      this.room.players[successorId].ready = false;
      this.room.hostKey = token();
    }
    if (!this.room.order.length) {
      await this.ctx.storage.deleteAll();
      this.room = null;
      try { ws.close(1000, "left"); } catch {}
      return true;
    }
    await this.saveAndBroadcast();
    try { ws.close(1000, "left"); } catch {}
    return true;
  }

  randomDie() {
    return (crypto.getRandomValues(new Uint32Array(1))[0] % 6) + 1;
  }

  publicGameState(playerId) {
    if (!this.room?.state) return null;
    const state = structuredClone(this.room.state);
    if (this.room.game === "jackaroo") {
      const me = this.playerIndex(playerId);
      state.deck = Array(state.deck?.length || 0).fill("?");
      state.discard = Array(state.discard?.length || 0).fill("?");
      state.hands = (state.hands || []).map((hand, i) => i === me ? hand : Array(hand.length).fill("?"));
    }
    return state;
  }

  publicState(playerId) {
    if (!this.room) return null;
    const me = this.room.players[playerId];
    return {
      code: this.room.code,
      game: this.room.game,
      variant: this.room.variant || 'classic',
      serverNow: Date.now(),
      playerLimit: this.room.playerLimit,
      status: this.room.status,
      version: this.room.version || 0,
      startedAt: this.room.startedAt || null,
      players: this.room.order.map((id, index) => {
        const p = this.room.players[id];
        return { id: p.id, index, name: p.name, role: p.role, ready: Boolean(p.ready), connected: Boolean(p.connected),...(this.room.game==='snakes'?{character:p.character||DEFAULT_BOARD_CHARACTERS[index]}:{}) };
      }),
      me: me ? { id: me.id, index: this.playerIndex(me.id), role: me.role } : null,
      pendingRoll: this.room.pendingRoll,
      turnDeadline: this.room.turnDeadline || null,
      state: this.publicGameState(playerId),
    };
  }

  sendError(ws, message) { try { ws.send(JSON.stringify({ type: "error", message })); } catch {} }

  broadcast() {
    if (!this.room) return;
    this.syncConnected();
    for (const ws of this.ctx.getWebSockets()) {
      const p = this.playerForSocket(ws);
      if (!p) continue;
      try { ws.send(JSON.stringify({ type: "state", state: this.publicState(p.id) })); } catch {}
    }
  }

  setTurnDeadline(ms = TURN_TIMEOUT_MS) {
    this.room.turnDeadline = Date.now() + ms;
  }

  cleanupStaleLobbyGuests() {
    if (!this.room || !["lobby", "finished"].includes(this.room.status)) return false;
    const now = Date.now();
    let changed = false;
    const staleGuests = this.room.order.filter((id) => {
      const p = this.room.players[id];
      return p?.role === "guest" && !p.connected && p.disconnectedAt && now - p.disconnectedAt >= DISCONNECT_GRACE_MS;
    });
    for (const id of staleGuests) delete this.room.players[id];
    if (staleGuests.length) {
      this.room.order = this.room.order.filter((id) => !staleGuests.includes(id));
      changed = true;
    }
    const hostId = this.room.order.find((id) => this.room.players[id]?.role === "host");
    const host = hostId ? this.room.players[hostId] : null;
    if (host && !host.connected && host.disconnectedAt && now - host.disconnectedAt >= DISCONNECT_GRACE_MS) {
      const successorId = this.room.order.find((id) => id !== hostId && this.room.players[id]?.connected);
      if (successorId) {
        delete this.room.players[hostId];
        this.room.order = this.room.order.filter((id) => id !== hostId);
        this.room.players[successorId].role = "host";
        this.room.players[successorId].ready = false;
        this.room.hostKey = token();
        changed = true;
      }
    }
    return changed;
  }

  async scheduleNextAlarm() {
    if (!this.room) return;
    const now = Date.now();
    const candidates = [this.room.expiresAt];
    if (this.room.status === 'finished' && !this.room.rewardsComplete) candidates.push(this.room.rewardRetryAt || now + 10000);
    if (this.room.status === "playing" && this.room.turnDeadline) candidates.push(this.room.turnDeadline);
    if (["lobby", "finished"].includes(this.room.status)) {
      for (const id of this.room.order) {
        const p = this.room.players[id];
        // An expired host grace period has already been handled by cleanup.
        // Keep reconnection available until room expiry without a rapid loop.
        const graceAt = p?.disconnectedAt + DISCONNECT_GRACE_MS;
        if (!p?.connected && p?.disconnectedAt && graceAt > now) candidates.push(graceAt);
      }
    }
    const next = Math.min(...candidates.filter((x) => Number.isFinite(x)));
    if (Number.isFinite(next)) await this.ctx.storage.setAlarm(Math.max(now + 50, next));
  }

  async saveAndBroadcast() {
    await this.persist();
    this.broadcast();
    await this.scheduleNextAlarm();
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.hostname === "social.internal") return (await this.socialDelegate()).fetch(request);
    if(url.pathname==='/health'&&request.method==='GET')return json({ok:true,engine:'BoardRoom',release:RELEASE,games:['snakes','zahra','jackaroo'],snakesVariants:['classic','adventure']});
    if (url.pathname === "/init" && request.method === "POST") {
      const body=await request.json().catch(()=>({}));
      return this.ctx.blockConcurrencyWhile(()=>this.initializeRoom(body));
    }

    if (url.pathname === "/status") {
      if (!this.room) return json({ ok: false, error: "الغرفة غير موجودة" }, 404);
      return json({ ok: true, game: this.room.game, variant: this.room.variant || 'classic', status: this.room.status, players: this.room.order.length, playerLimit: this.room.playerLimit });
    }

    if (url.pathname.endsWith("/ws")) {
      if (!this.room) return json({ ok: false, error: "الغرفة غير موجودة" }, 404);
      if (request.headers.get("Upgrade") !== "websocket") return json({ ok: false, error: "WebSocket required" }, 426);
      const expectedGame = url.searchParams.get("game") || "";
      if (expectedGame && expectedGame !== this.room.game) return json({ ok: false, error: "رمز الغرفة يخص لعبة أخرى" }, 409);
      if (this.room.status === "lobby" && this.cleanupStaleLobbyGuests()) await this.persist();
      const name = cleanName(url.searchParams.get("name"));
      const { reconnectToken, hostKey, protocol } = webSocketAuth(request);
      if (!protocol) return json({ ok: false, error: "WebSocket protocol required" }, 426);
      let player = null;
      if (reconnectToken) player = Object.values(this.room.players).find((p) => p.token === reconnectToken) || null;
      if (!player && hostKey && hostKey === this.room.hostKey) {
        player = Object.values(this.room.players).find((p) => p.role === "host") || null;
        if (!player) player = this.addPlayer(name, "host");
      }
      if (!player) {
        if (this.room.order.length === 0) return json({ ok: false, error: "بانتظار دخول المضيف أولًا" }, 409);
        if (this.room.status !== "lobby") return json({ ok: false, error: "المباراة بدأت ولا يمكن دخول لاعب جديد" }, 409);
        this.syncConnected();
        this.cleanupStaleLobbyGuests();
        if (this.room.order.length >= this.room.playerLimit) return json({ ok: false, error: "الغرفة ممتلئة — اللاعب المنقطع لديه مهلة للعودة" }, 409);
        player = this.addPlayer(name, "guest");
      } else if (name) player.name = name;

      if(this.room.game==='snakes'){
        let owned=[];try{owned=JSON.parse(request.headers.get('x-bs-characters')||'[]')}catch{}
        player.allowedCharacters=['fox',...(Array.isArray(owned)?owned:[])].filter((id,index,list)=>BOARD_CHARACTERS.includes(id)&&list.indexOf(id)===index);
        const requested=url.searchParams.get('character'),equipped=request.headers.get('x-bs-character');
        if(this.room.status==='lobby')player.character=player.allowedCharacters.includes(equipped)?equipped:player.allowedCharacters.includes(requested)?requested:'fox';
      }
      if(request.headers.get('x-bs-account'))player.username=request.headers.get('x-bs-account');
      for (const old of this.ctx.getWebSockets()) {
        try { if (old.deserializeAttachment()?.playerId === player.id) old.close(4001, "reconnected"); } catch {}
      }
      const pair = new WebSocketPair(), client = pair[0], server = pair[1];
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({ playerId: player.id });
      player.connected = true;
      player.disconnectedAt = null;
      await this.persist();
      server.send(JSON.stringify({ type: "welcome", playerId: player.id, token: player.token, state: this.publicState(player.id) }));
      this.broadcast();
      return webSocketResponse(client, protocol);
    }
    return json({ ok: false, error: "not_found" }, 404);
  }

  async webSocketMessage(ws, raw) {
    try {
      if (ws.deserializeAttachment()?.username) return (await this.socialDelegate()).webSocketMessage(ws, raw);
    } catch {}
    if (!this.room) return;
    const player = this.playerForSocket(ws);
    if (!player) return;
    const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
    if (text.length > 8192) return this.sendError(ws, "الرسالة أكبر من المسموح");
    let msg; try { msg = JSON.parse(text); } catch { return this.sendError(ws, "رسالة غير صالحة"); }
    try {
      if (msg.type === "leave") {
        if (this.room.status === "lobby") return await this.leaveLobby(player, ws);
        return;
      }
      if(msg.type==='character'){
        if(this.room.game!=='snakes'||this.room.status!=='lobby')return;
        if(!BOARD_CHARACTERS.includes(msg.character)||!(player.allowedCharacters||['fox']).includes(msg.character))return this.sendError(ws,'اشترِ الشخصية وجهّزها من المتجر');
        if(player.character===msg.character)return;
        player.character=msg.character;player.ready=false;this.room.version++;return await this.saveAndBroadcast();
      }
      if (msg.type === "ready") {
        if (this.room.status !== "lobby") return;
        player.ready = Boolean(msg.ready);
        return await this.saveAndBroadcast();
      }
      if (msg.type === "start") {
        if (player.role !== "host") return this.sendError(ws, "بدء المباراة للمضيف فقط");
        if (this.room.status !== "lobby") return;
        if (this.room.order.length !== this.room.playerLimit) return this.sendError(ws, `يلزم ${this.room.playerLimit} لاعبين`);
        if (!this.room.order.every((id) => this.room.players[id]?.connected)) return this.sendError(ws, "انتظر اتصال جميع اللاعبين");
        if (!this.room.order.every((id) => this.room.players[id]?.ready)) return this.sendError(ws, "كل اللاعبين لازم يضغطون جاهز");
        return await this.startGame();
      }
      if (msg.type === "rematch") {
        if (player.role !== "host") return this.sendError(ws, "الإعادة للمضيف فقط");
        if (this.room.status !== "finished") return;
        if (!this.room.rewardsComplete) return this.sendError(ws, "جاري حفظ نتيجة الجولة — انتظر قليلًا ثم أعد المحاولة");
        return await this.resetForRematch();
      }
      if (this.room.status !== "playing" || !this.room.state) return this.sendError(ws, "المباراة غير نشطة");
      if(['roll','jackaroo_play','ludo_move'].includes(msg.type)&&msg.expectedVersion!==this.room.version)return this.sendError(ws,'تغيرت حالة الجولة — انتظر التحديث ثم حاول');
      const actor = this.playerIndex(player.id);
      if (actor !== this.room.state.turn && this.room.game !== "jackaroo") return this.sendError(ws, "مو دورك الآن");
      if (this.room.game === "snakes" && msg.type === "roll") {
        if (actor !== this.room.state.turn) return this.sendError(ws, "مو دورك الآن");
        const power = msg.power ?? null;
        const p = this.room.state.players[actor];
        if (power !== null && (power !== 'double' || this.room.state.rulesVersion !== 2 || !(p.double > 0) || p.position === 0))
          return this.sendError(ws, 'قدرة النردين غير متاحة الآن');
        this.room.state = rollSnakesServer(this.room.state, actor, () => (this.randomDie() - 1) / 6, { power }).state;
        this.room.version++;
        if (this.room.state.winner !== null) this.finishGame();
        else this.setTurnDeadline();
        return await this.saveAndBroadcast();
      }
      if (this.room.game === "zahra") {
        if (actor !== this.room.state.turn) return this.sendError(ws, "مو دورك الآن");
        if (msg.type === "roll") {
          if (this.room.pendingRoll !== null) return this.sendError(ws, "اختر الحجر أولًا");
          const roll = this.randomDie();
          const legal = getLegalLudoMoves(this.room.state, roll);
          if (!legal.length) {
            this.room.state = passLudoTurn(this.room.state, roll);
            this.room.pendingRoll = null;
          } else this.room.pendingRoll = roll;
          this.room.version++;
          this.setTurnDeadline(this.room.pendingRoll !== null ? MOVE_TIMEOUT_MS : TURN_TIMEOUT_MS);
          return await this.saveAndBroadcast();
        }
        if (msg.type === "ludo_move") {
          if (this.room.pendingRoll === null) return this.sendError(ws, "ارمِ الزهرة أولًا");
          this.room.state = applyLudoMove(this.room.state, Number(msg.token), this.room.pendingRoll);
          this.room.pendingRoll = null;
          this.room.version++;
          if (this.room.state.winner !== null) this.finishGame();
          else this.setTurnDeadline();
          return await this.saveAndBroadcast();
        }
      }
      if (this.room.game === "jackaroo" && msg.type === "jackaroo_play") {
        if (actor !== this.room.state.turn) return this.sendError(ws, "مو دورك الآن");
        const cardIndex = Number(msg.cardIndex);
        const action = msg.action;
        const legal = getJackarooActions(this.room.state, cardIndex, actor);
        const sig = JSON.stringify(action);
        if (!legal.some((a) => JSON.stringify(a) === sig)) return this.sendError(ws, "الحركة غير صالحة");
        this.room.state = playJackarooAction(this.room.state, cardIndex, action, actor);
        this.room.version++;
        if (this.room.state.winnerTeam !== null) this.finishGame();
        else this.setTurnDeadline();
        return await this.saveAndBroadcast();
      }
      this.sendError(ws, "أمر غير معروف");
    } catch (err) {
      console.error("board room message error", err);
      this.sendError(ws, "تعذر تنفيذ الحركة");
    }
  }

  async startGame() {
    this.room.startedAt=Date.now();this.room.rewardsComplete=false;
    const names = this.room.order.map((id) => this.room.players[id].name);
    if (this.room.game === "snakes") this.room.state = createSnakesServerGame(names, { variant: this.room.variant || 'classic' });
    else if (this.room.game === "zahra") this.room.state = createLudoGame(names);
    else this.room.state = createJackarooGame(names);
    this.room.status = "playing";
    this.room.pendingRoll = null;
    this.room.version++;
    this.setTurnDeadline();
    for (const id of this.room.order) this.room.players[id].ready = true;
    await this.saveAndBroadcast();
  }

  async resetForRematch() {
    this.room.status = "lobby";
    this.room.state = null;
    this.room.pendingRoll = null;
    this.room.turnDeadline = null;
    this.room.version++;
    for (const id of this.room.order) this.room.players[id].ready = false;
    await this.saveAndBroadcast();
  }

  async handleTurnTimeout() {
    if (!this.room || this.room.status !== "playing" || !this.room.state) return;
    const actor = this.room.state.turn;
    if (this.room.game === "snakes") {
      this.room.state = rollSnakesServer(this.room.state, actor, () => (this.randomDie() - 1) / 6).state;
      this.room.version++;
      if (this.room.state.winner !== null) this.finishGame();
      else this.setTurnDeadline();
      return await this.saveAndBroadcast();
    }
    if (this.room.game === "zahra") {
      let roll = this.room.pendingRoll;
      if (roll === null) roll = this.randomDie();
      const legal = getLegalLudoMoves(this.room.state, roll);
      if (legal.length) {
        const choice = pick(legal);
        this.room.state = applyLudoMove(this.room.state, choice, roll);
      } else {
        this.room.state = passLudoTurn(this.room.state, roll);
      }
      this.room.pendingRoll = null;
      this.room.version++;
      if (this.room.state.winner !== null) this.finishGame();
      else this.setTurnDeadline();
      return await this.saveAndBroadcast();
    }
    if (this.room.game === "jackaroo") {
      const candidates = [];
      const hand = this.room.state.hands?.[actor] || [];
      for (let cardIndex = 0; cardIndex < hand.length; cardIndex++) {
        for (const action of getJackarooActions(this.room.state, cardIndex, actor)) candidates.push({ cardIndex, action });
      }
      if (candidates.length) {
        const preferred = candidates.filter((x) => x.action.type !== "discard");
        const chosen = pick(preferred.length ? preferred : candidates);
        this.room.state = playJackarooAction(this.room.state, chosen.cardIndex, chosen.action, actor);
        this.room.version++;
        if (this.room.state.winnerTeam !== null) this.finishGame();
        else this.setTurnDeadline();
      } else {
        this.setTurnDeadline();
      }
      return await this.saveAndBroadcast();
    }
  }

  finishGame() {
    this.room.status = "finished";
    this.room.pendingRoll = null;
    this.room.turnDeadline = null;
    this.room.expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  }

  async webSocketClose(ws, code = 1000, reason = "closed") {
    try {
      if (ws.deserializeAttachment()?.username) return (await this.socialDelegate()).webSocketClose(ws, code, reason);
    } catch {}
    const p = this.playerForSocket(ws);
    if (!p || !this.room) return;
    p.connected = false;
    p.disconnectedAt = Date.now();
    await this.persist();
    this.broadcast();
    await this.scheduleNextAlarm();
  }
  async webSocketError(ws) {
    try {
      if (ws.deserializeAttachment()?.username) return (await this.socialDelegate()).webSocketError(ws);
    } catch {}
    await this.webSocketClose(ws);
  }

  async alarm() {
    if (!this.room) return;
    const now = Date.now();
    if (now >= this.room.expiresAt) {
      await this.ctx.storage.deleteAll();
      this.room = null;
      return;
    }
    if (this.room.status === "playing" && this.room.turnDeadline && now >= this.room.turnDeadline) {
      await this.handleTurnTimeout();
      return;
    }
    if (this.room.status === 'finished' && !this.room.rewardsComplete) await this.persist();
    if ((this.room.status === 'lobby' || this.room.status === 'finished' && this.room.rewardsComplete) && this.cleanupStaleLobbyGuests()) {
      await this.persist();
      this.broadcast();
    }
    await this.scheduleNextAlarm();
  }
}
