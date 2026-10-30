import {BillingRegistry,handleBillingRequest} from './billing/billing.js';
import {PartyRoom} from './party/party-room.js';
import {normalizePlaylist} from '../public/assets/js/engines/party-catalog-v29.js';
import {PathsRoom,pathsSettings} from './paths/paths-room.js';
import {SudokuRoom,sudokuSettings} from './sudoku/sudoku-room.js';
import {ImageRoom} from './images/image-room.js';
import {imageGenerationConfig} from './images/generate.js';
import {clientErrorReport} from './diagnostics/client-errors.js';
import {PresenceRegistry,PRESENCE_OBJECT,cleanBeat} from './presence/presence-registry.js';
import {cleanPartyLink,settlePartyLink,standings as partyStandings} from './party/party-link.js';
import {roomCodeFor,resolveRoomCode} from './rooms/room-codes.js';

import { DurableObject } from "cloudflare:workers";
import { CATEGORIES } from "./questions.js";
import { createSnakesServerGame, rollSnakesServer, normalizeSnakesVariant } from "./games/snakes-server.js";
import { createLudoGame, getLegalLudoMoves, applyLudoMove, passLudoTurn } from "../public/assets/js/engines/ludo-engine.js";
import { createJackarooGame, getJackarooActions, playJackarooAction } from "../public/assets/js/engines/jackaroo-engine.js";
import { TABLE_GAMES, MAX_SEATS, TABLE_LOBBY_MS, PARTY_TABLE_WAIT_MS, TURN_MS as TABLE_TURN_MS, startTable, resetTable, playerMove, timeoutMove, tableOver, winnerSeats, seatProgress, stepsTime, cleanLook, seatIsBot, DEFAULT_LOOK, FREE_LOOK_ITEMS } from "./games/board-tables.js";
import { BALOOT_LOBBY_MS, freeBalootSeat, startBalootRoom, applyBalootMove, balootAlarm, balootPlayers, balootRoomView, balootWinFor } from "./games/baloot-server.js";
import { validTalk } from "../public/assets/js/engines/baloot-talk.js";
import { handleSocialRequest, authenticate, getSocialStub } from "./social/social-api.js";
import { createQuickArenaClass } from "./quick/arena.js";
import { createSocialUserClass } from "./social/social-user.js";
import { generateSafeQuestions } from "./ai-questions.js";
import {createRelay,relayView,answerRelay,relayResults,relayReveal} from '../public/assets/js/engines/quiz-relay-v28.js';
import { SerpentRoom } from './serpent/serpent-room.js';
import { validWorld } from '../public/assets/js/engines/arena-worlds-v27.js';
import { LeaderboardStore, LEADERBOARD_OBJECT } from './leaderboard/leaderboard.js';
import { Career } from './career/core.js';
import { QuizImageBank, QUIZ_AI_OBJECT } from './quiz/ai-bank.js';
import { aiCategory } from './quiz/ai-subjects.js';
import { makeQuizBots, planBotAnswers, dueBotAnswers, nextBotAnswer, hurryBotAnswers } from './quiz/quiz-bots.js';
import { isOwner } from './social/account-policy.js';

class SocialDelegateBase {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; }
}
const BoardSocialUser = createSocialUserClass(SocialDelegateBase);
export const QuickArena = createQuickArenaClass(DurableObject);

const RELEASE='33.0.0';
// 32.0.0: every hero in the catalogue (short ids: fox, samurai, …)
const BOARD_CHARACTERS=Career.HEROES?.length?Career.HEROES.map(hero=>hero.id):['princess','fairy','astronaut','fox','cat','robot'],DEFAULT_BOARD_CHARACTERS=['fox','fox','fox','fox'];
// Live reactions in board-game rooms: a fixed vocabulary, never free text.
// Free reactions work for everyone; paid ones only for the account that
// bought them (sent by the Worker at the WebSocket upgrade, never the client).
const FREE_REACTIONS=new Set(Career.REACTIONS.filter(item=>item.price===0&&!item.source).map(item=>item.id));
const PAID_REACTIONS=new Set(Career.REACTIONS.filter(item=>item.price>0||item.source).map(item=>item.id));
const EMOTE_GAP_MS=1500,EMOTE_PER_MINUTE=12,MOVE_GAP_MS=6000,MOVE_PER_MINUTE=4;
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
  return new Response(JSON.stringify({ok:false,online:false,code:'DURABLE_REQUEST_LIMIT',error:'وصلت خدمة الأونلاين إلى حد الطلبات اليومي. تعود بعد الساعة 3:00 صباحًا بتوقيت السعودية.',resetAt,release:RELEASE}), {
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

// Only abuse-sensitive buckets (password guessing, paid generation APIs) use the
// globally consistent Durable Object counter. Everything else is counted in the
// isolate's memory so ordinary play does not spend an extra Durable Object
// request on every API call (the free tier counts both requests).
const DURABLE_RATE_BUCKETS = new Set(['social-auth', 'ai-questions', 'picture:generate']);
function usesDurableRateLimit(bucket) { return DURABLE_RATE_BUCKETS.has(String(bucket)); }
async function rateLimit(request, env, bucket, limit, windowMs) {
  if (!env?.ROOMS || !usesDurableRateLimit(bucket)) return memoryRateLimit(request, bucket, limit, windowMs);
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

// 32.0.1: a signed-in player appears in every room under the account's display
// name. The name typed on the page, or remembered from guest play, is ignored.
function accountRoomName(auth) {
  return cleanName(auth?.profile?.displayName || auth?.username);
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

function secureUnit() {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
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

// 32.0.1: every question is answered in secret by all players at once. The
// buzzer (the first press took the question from everyone) was removed.
function roundModes(rounds) {
  return Array.from({ length: rounds }, () => "secret");
}

function makePlan(categoryIds, rounds = 12, recentQids = [], extra = null) {
  const chosen = categoryIds.map((id) => CATEGORY_MAP.get(id) || extra?.get(id)).filter(Boolean);
  if (!chosen.length) return [];
  const recent = new Set(Array.isArray(recentQids) ? recentQids : []);
  const plan = [];
  const addQuestion = (cat, value) => {
    const all = cat.questions.filter((q) => !value || q.v === value);
    const unused = all.filter((q) => !plan.some((p) => p.qid === questionRef(cat, q)));
    const diverse = unused.filter(q=>!q.mediaFamily||!plan.some(p=>p.mediaFamily===q.mediaFamily));
    const fresh = diverse.filter((q) => !recent.has(questionRef(cat, q)));
    const pool = fresh.length ? fresh : (diverse.length ? diverse : (unused.length ? unused : all));
    if (!pool.length) return false;
    const q = pick(pool);
    plan.push({ catId: cat.id, qid: questionRef(cat, q),mediaFamily:q.mediaFamily||null });
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
  const modes = roundModes(order.length);
  return order.map((x, i) => ({ ...x, mode: modes[i] }));
}

function qFromRef(catId, qid, extra = null) {
  const cat = CATEGORY_MAP.get(catId) || extra?.get(catId);
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
    else if (quotaReset && /^\/api\/(?:health|board|rooms|social|quick|serpent|picture|sudoku|paths|party|leaderboard|presence)(?:\/|$)/.test(url.pathname)) return durableQuotaResponse(env);

    if(url.pathname.startsWith('/api/billing/'))return handleBillingRequest(request,env,{rateLimit});
    if(['/accuracy','/accuracy.html'].includes(url.pathname))return Response.redirect(new URL('/#games',url),302);
    if (url.pathname === '/api/client-errors') return clientErrorReport(request,{release:RELEASE});
    // 32.1.0: live presence for the owner's dashboard (see src/presence/presence-registry.js)
    if (url.pathname === '/api/presence') {
      if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
      const limited = await rateLimit(request, env, 'presence', 40, 60_000); if (limited) return limited;
      if (!env?.BOARD_ROOMS) return json({ ok: false, error: 'unavailable' }, 503);
      const raw = await request.text(); if (raw.length > 2048) return json({ ok: false, error: 'too_large' }, 413);
      let body = null; try { body = JSON.parse(raw); } catch {}
      const beat = cleanBeat(body, { country: request.cf?.country });
      if (!beat) return json({ ok: false, error: 'invalid' }, 400);
      const asked = beat.vis !== 'leave' && Boolean(request.headers.get('authorization'));
      let identity = null;
      if (asked) { const auth = await authenticate(request, env).catch((error) => { if (isDurableRequestQuotaError(error)) throw error; return null; }); if (auth?.username) identity = { user: auth.username, name: auth.profile?.displayName || auth.username }; }
      const stub = env.BOARD_ROOMS.get(env.BOARD_ROOMS.idFromName(PRESENCE_OBJECT));
      const res = await stub.fetch('https://presence.internal/beat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ beat: { ...body, cc: beat.cc }, identity }) });
      const data = await res.json().catch(() => ({ ok: false }));
      return json({ ...data, auth: identity ? 'ok' : asked ? 'failed' : 'none' }, res.status);
    }
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

    if (request.method === 'GET' && url.pathname === '/api/leaderboard') {
      const limited = await rateLimit(request, env, 'leaderboard', 90, 60_000);
      if (limited) return limited;
      if (!env.BOARD_ROOMS?.idFromName) return json({ ok: false, error: 'لوحة الأبطال غير مفعّلة على السيرفر' }, 503);
      const period = url.searchParams.get('period') === 'season' ? 'season' : 'week';
      const player = String(url.searchParams.get('player') || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
      // The shared board (no personal row) is cached briefly, so popular page
      // views do not each wake the leaderboard object.
      const cache = player ? null : globalThis.caches?.default, cacheKey = new Request(url.origin + '/api/leaderboard?period=' + period);
      if (cache) { const hit = await cache.match(cacheKey).catch(() => null); if (hit) return hit; }
      try {
        const stub = env.BOARD_ROOMS.get(env.BOARD_ROOMS.idFromName(LEADERBOARD_OBJECT));
        const res = await stub.fetch('https://leaderboard.internal/top?period=' + period + (player ? '&player=' + player : ''));
        const data = await res.json();
        const response = new Response(JSON.stringify(data), { status: res.status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache ? 'public, max-age=30' : 'no-store', 'x-content-type-options': 'nosniff' } });
        if (cache && res.ok) await cache.put(cacheKey, response.clone()).catch(() => {});
        return response;
      } catch (error) {
        if (isDurableRequestQuotaError(error)) throw error;
        return json({ ok: false, error: 'تعذر تحميل لوحة الأبطال الآن، حاول بعد قليل' }, 503);
      }
    }

    if (url.pathname.startsWith('/api/quiz/ai/')) {
      if (!env.BOARD_ROOMS?.idFromName) return json({ ok: false, error: 'صور الذكاء غير مفعّلة على السيرفر' }, 503);
      const stub = env.BOARD_ROOMS.get(env.BOARD_ROOMS.idFromName(QUIZ_AI_OBJECT)), cache = globalThis.caches?.default, packKey = new Request(url.origin + '/api/quiz/ai/pack');
      const image = url.pathname.match(/^\/api\/quiz\/ai\/image\/([a-z0-9-]{2,30})\.webp$/);
      if (image && request.method === 'GET') {
        const limited = await rateLimit(request, env, 'quiz-ai-image', 240, 60_000); if (limited) return limited;
        if (cache) { const hit = await cache.match(request).catch(() => null); if (hit) return hit; }
        try { const res = await stub.fetch('https://quizai.internal/image?id=' + image[1]); if (cache && res.ok) await cache.put(request, res.clone()).catch(() => {}); return res; }
        catch (error) { if (isDurableRequestQuotaError(error)) throw error; return json({ ok: false, error: 'تعذر تحميل الصورة' }, 503); }
      }
      if (url.pathname === '/api/quiz/ai/pack' && request.method === 'GET') {
        const limited = await rateLimit(request, env, 'quiz-ai-pack', 120, 60_000); if (limited) return limited;
        if (cache) { const hit = await cache.match(packKey).catch(() => null); if (hit) return hit; }
        try {
          const res = await stub.fetch('https://quizai.internal/pack'), data = await res.json();
          const response = new Response(JSON.stringify(data), { status: res.status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache ? 'public, max-age=60' : 'no-store', 'x-content-type-options': 'nosniff' } });
          if (cache && res.ok) await cache.put(packKey, response.clone()).catch(() => {});
          return response;
        } catch (error) { if (isDurableRequestQuotaError(error)) throw error; return json({ ok: false, error: 'تعذر تحميل صور الذكاء' }, 503); }
      }
      if (request.method === 'POST' && ['/api/quiz/ai/generate', '/api/quiz/ai/remove', '/api/quiz/ai/status'].includes(url.pathname)) {
        const limited = await rateLimit(request, env, 'quiz-ai-admin', 20, 60_000); if (limited) return limited;
        const auth = await authenticate(request, env);
        if (!auth) return json({ ok: false, error: 'unauthorized' }, 401);
        if (!isOwner(auth.profile || { username: auth.username })) return json({ ok: false, error: 'forbidden' }, 403);
        const body = (await request.text()).slice(0, 512);
        if (url.pathname === '/api/quiz/ai/status') { const res = await stub.fetch('https://quizai.internal/pack'); return new Response(res.body, { status: res.status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } }); }
        const res = await stub.fetch('https://quizai.internal/' + url.pathname.split('/').pop(), { method: 'POST', headers: { 'content-type': 'application/json', 'x-bs-owner': '1' }, body });
        if (cache && res.ok) await cache.delete(packKey).catch(() => {});
        return res;
      }
      return json({ ok: false, error: 'not_found' }, 404);
    }

    if(url.pathname.startsWith('/api/party/')){
      if(!env.ROOMS)return json({ok:false,error:'محرك الغرف غير مفعّل'},503);
      const limited=await rateLimit(request,env,'party-api',240,60000);if(limited)return limited;
      if(url.pathname==='/api/party/rooms'&&request.method==='POST'){
        const text=await request.text();if(text.length>6000)return json({ok:false,error:'طلب كبير'},413);
        let body;try{body=JSON.parse(text);normalizePlaylist(body.playlist);if(!Number.isInteger(body.capacity)||body.capacity<1||body.capacity>20)throw Error('اختر عددًا من 1 إلى 20');}catch(e){return json({ok:false,error:e.message||'إعدادات غير صالحة'},400);}
        for(let i=0;i<8;i++){const code=roomCodeFor('party'),hostKey=token(),stub=env.ROOMS.get(env.ROOMS.idFromName('party:'+code)),res=await stub.fetch('https://party.internal/init',{method:'POST',body:JSON.stringify({code,hostKey,capacity:body.capacity,playlist:body.playlist})});if(res.status===201){const data=await res.json();return json({ok:true,code,hostKey,capacity:data.capacity});}if(res.status===400)return res;}
        return json({ok:false,error:'تعذر إنشاء غرفة الآن'},503);
      }
      const m=url.pathname.match(/^\/api\/party\/rooms\/(\d{6})\/(ws|status)$/);if(!m)return json({ok:false,error:'not_found'},404);if(request.method!=='GET')return json({ok:false,error:'method_not_allowed'},405);
      const headers=new Headers(request.headers);headers.delete('x-bs-account');
      if(m[2]==='ws'){const st=String(headers.get('sec-websocket-protocol')||'').split(',').map(x=>x.trim()).find(x=>x.startsWith('st.'))?.slice(3),auth=await authenticate(st?new Request(request.url,{headers:{authorization:'Bearer '+st}}):request,env);if(st&&!auth)return json({ok:false,error:'انتهت جلسة الحساب'},401);if(auth){headers.set('x-bs-account',auth.username);url.searchParams.set('name',accountRoomName(auth));}}
      return env.ROOMS.get(env.ROOMS.idFromName('party:'+m[1])).fetch(new Request('https://party.internal/'+m[2]+url.search,{headers}));
    }

    if(url.pathname.startsWith('/api/paths/')){
      if(!env.ROOMS)return json({ok:false,error:'محرك الغرف غير مفعّل'},503);
      const limited=await rateLimit(request,env,'paths-api',120,60000);if(limited)return limited;
      if(url.pathname==='/api/paths/rooms'&&request.method==='POST'){
        if(Number(request.headers.get('content-length'))>1024)return json({ok:false,error:'طلب كبير'},413);
        const text=await request.text();if(text.length>1024)return json({ok:false,error:'طلب كبير'},413);
        let settings;try{settings=JSON.parse(text);}catch{return json({ok:false,error:'إعدادات غير صالحة'},400);}
        if(!pathsSettings(settings))return json({ok:false,error:'اختر الصعوبة من 1 إلى 5 وعدد اللاعبين من 1 إلى 20'},400);
        for(let i=0;i<8;i++){const code=roomCodeFor('paths'),hostKey=token(),stub=env.ROOMS.get(env.ROOMS.idFromName('paths:'+code));const res=await stub.fetch('https://paths.internal/init',{method:'POST',body:JSON.stringify({code,hostKey,difficulty:settings.difficulty,capacity:settings.capacity})});if(res.status===201)return json({ok:true,code,hostKey});}
        return json({ok:false,error:'تعذر إنشاء غرفة الآن'},503);
      }
      const m=url.pathname.match(/^\/api\/paths\/rooms\/(\d{6})\/(ws|status)$/);if(!m)return json({ok:false,error:'not_found'},404);
      if(request.method!=='GET')return json({ok:false,error:'method_not_allowed'},405);
      const headers=new Headers(request.headers);headers.delete('x-bs-account');
      if(m[2]==='ws'){
        const st=String(headers.get('sec-websocket-protocol')||'').split(',').map(x=>x.trim()).find(x=>x.startsWith('st.'))?.slice(3);
        const auth=await authenticate(st?new Request(request.url,{headers:{authorization:'Bearer '+st}}):request,env);
        if(st&&!auth)return json({ok:false,error:'انتهت جلسة الحساب؛ سجل الدخول مجددًا'},401);
        if(auth){headers.set('x-bs-account',auth.username);url.searchParams.set('name',accountRoomName(auth));}
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
        if(!sudokuSettings(settings))return json({ok:false,error:'اختر الصعوبة من 1 إلى 5 وعدد اللاعبين من 1 إلى 20'},400);
        for(let i=0;i<8;i++){const code=roomCodeFor('sudoku'),hostKey=token(),stub=env.ROOMS.get(env.ROOMS.idFromName('sudoku:'+code));const res=await stub.fetch('https://sudoku.internal/init',{method:'POST',body:JSON.stringify({code,hostKey,difficulty:settings.difficulty,capacity:settings.capacity})});if(res.status===201)return json({ok:true,code,hostKey});}
        return json({ok:false,error:'تعذر إنشاء غرفة الآن'},503);
      }
      const m=url.pathname.match(/^\/api\/sudoku\/rooms\/(\d{6})\/(ws|status)$/);if(!m)return json({ok:false,error:'not_found'},404);
      if(request.method!=='GET')return json({ok:false,error:'method_not_allowed'},405);
      const headers=new Headers(request.headers);headers.delete('x-bs-account');
      if(m[2]==='ws'){
        const st=String(headers.get('sec-websocket-protocol')||'').split(',').map(x=>x.trim()).find(x=>x.startsWith('st.'))?.slice(3);
        const auth=await authenticate(st?new Request(request.url,{headers:{authorization:'Bearer '+st}}):request,env);
        if(st&&!auth)return json({ok:false,error:'انتهت جلسة الحساب؛ سجل الدخول مجددًا'},401);
        if(auth){headers.set('x-bs-account',auth.username);url.searchParams.set('name',accountRoomName(auth));}
      }
      return env.ROOMS.get(env.ROOMS.idFromName('sudoku:'+m[1])).fetch(new Request('https://sudoku.internal/'+m[2]+url.search,{headers}));
    }

    if(url.pathname.startsWith('/api/picture/')){
      if(url.pathname==='/api/picture/config'&&request.method==='GET')return json({ok:true,...imageGenerationConfig(env)});
      if(!env.ROOMS)return json({ok:false,error:'محرك الغرف غير مفعّل'},503);
      const limited=await rateLimit(request,env,'picture:'+ (url.pathname.endsWith('/generate')?'generate':'api'),url.pathname.endsWith('/generate')?12:120,60000);if(limited)return limited;
      if(url.pathname==='/api/picture/rooms'&&request.method==='POST'){
        const body=await request.json().catch(()=>({})),capacity=body.capacity??2;if(!Number.isInteger(capacity)||capacity<1||capacity>20)return json({ok:false,error:'اختر عدد اللاعبين من 1 إلى 20'},400);for(let attempt=0;attempt<8;attempt++){const code=roomCodeFor('picture'),hostKey=token(),stub=env.ROOMS.get(env.ROOMS.idFromName('picture:'+code));const res=await stub.fetch('https://picture.internal/init',{method:'POST',body:JSON.stringify({code,hostKey,capacity})});if(res.status===201)return json({ok:true,code,hostKey});}return json({ok:false,error:'تعذر إنشاء غرفة الآن'},503);
      }
      const m=url.pathname.match(/^\/api\/picture\/rooms\/(\d{6})\/(ws|status|generate|art\/[a-f0-9-]{36})$/);if(!m)return json({ok:false,error:'not_found'},404);
      if(request.method!==(m[2]==='generate'?'POST':'GET'))return json({ok:false,error:'method_not_allowed'},405);
      const headers=new Headers(request.headers);headers.delete('x-bs-account');
      if(m[2]==='ws'||m[2]==='generate'){
        const st=m[2]==='ws'?String(headers.get('sec-websocket-protocol')||'').split(',').map(x=>x.trim()).find(x=>x.startsWith('st.'))?.slice(3):null;
        const auth=await authenticate(st?new Request(request.url,{headers:{authorization:'Bearer '+st}}):request,env);if(auth){headers.set('x-bs-account',auth.username);if(m[2]==='ws')url.searchParams.set('name',accountRoomName(auth));}else if(m[2]==='generate')return json({ok:false,error:'سجّل الدخول لتوليد صورة'},401);
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
        body.username=auth?.username||null;body.name=auth?accountRoomName(auth):cleanName(body.name);path='/join';
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
          const code = roomCodeFor('quiz');
          const id = env.ROOMS.idFromName(code);
          const stub = env.ROOMS.get(id);
          const hostKey = token();
          const res = await stub.fetch("https://room.internal/init", {
            method: "POST",
            headers: { "content-type": "application/json" },
          body: JSON.stringify({ code, hostKey, name, playerLimit: body.playerLimit, teams: body.teams === true }),
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

    // 33.0.0: one box takes any room code: which game is it, and where is its page?
    const resolveMatch = url.pathname.match(/^\/api\/rooms\/resolve\/(\d{6})$/);
    if (resolveMatch) {
      if (request.method !== 'GET') return json({ ok: false, error: 'method_not_allowed' }, 405);
      const limited = await rateLimit(request, env, 'room-resolve', 40, 60_000); if (limited) return limited;
      const found = await resolveRoomCode(env, resolveMatch[1]);
      return json(found ? { ok: true, code: resolveMatch[1], ...found } : { ok: false, found: false, error: 'ما لقينا غرفة مفتوحة بهذا الرمز' }, found ? 200 : 404);
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
          let named=null;
          if(st){const check=new Request(request.url,{headers:{authorization:'Bearer '+st}});const auth=await authenticate(check,env);if(auth){headers.set('x-bs-account',auth.username);named=new URL(request.url);named.searchParams.set('name',accountRoomName(auth));}}
          return await stub.fetch(named?new Request(named,{method:request.method,headers}):new Request(request,{headers}));
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
      return stub.fetch('https://quick.internal/serpent/join',{method:'POST',body:JSON.stringify({name:auth?accountRoomName(auth):cleanName(body.name),username:auth?.username||null})});
    }
    if(request.method==='POST'&&url.pathname==='/api/serpent/rooms'){
      const limited=await rateLimit(request,env,'serpent-create',12,60_000);if(limited)return limited;
      if(!env.ROOMS||typeof env.ROOMS.idFromName!=='function')return json({ok:false,error:'محرك اللعب الجماعي غير مربوط؛ انشر الحزمة كاملة'},503);
      const body=await request.json().catch(()=>({})),playerLimit=body.playerLimit??20,duration=body.duration??120,botCount=body.botCount??3,difficulty=body.difficulty??'mixed',matchMode=body.matchMode??'timed',worldId=body.worldId??'classic';
      if(!validWorld(worldId))return json({ok:false,error:'خريطة الحلبة غير صالحة'},400);
      if(!Number.isInteger(playerLimit)||playerLimit<2||playerLimit>20||!Number.isInteger(botCount)||botCount<0||botCount>6||!['easy','medium','hard','mixed'].includes(difficulty)||!['timed','survival'].includes(matchMode)||![60,120,180].includes(duration))return json({ok:false,error:'إعدادات الحلبة غير صالحة: حتى 20 لاعبًا و6 منافسين إضافيين'},400);
      for(let attempt=0;attempt<5;attempt++){
        const code=roomCodeFor('serpent'),hostKey=token(),stub=env.ROOMS.get(env.ROOMS.idFromName('__serpent__:'+code));
        const response=await stub.fetch('https://serpent.internal/init',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code,hostKey,playerLimit,duration,botCount,difficulty,matchMode,worldId})});
        if(response.status===201)return json({ok:true,code,hostKey,playerLimit,duration,botCount,difficulty,matchMode,worldId});
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
      let accountName='';
      if(st){const auth=await authenticate(new Request(request.url,{headers:{authorization:'Bearer '+st}}),env);if(auth){
        headers.set('x-bs-account',auth.username);accountName=accountRoomName(auth);
        const profile=await auth.stub.fetch('https://social.internal/career/get',{method:'POST',body:JSON.stringify({secret:auth.secret})});
        if(profile.ok){const data=await profile.json();headers.set('x-bs-skin',data.career?.equipped?.snake||'snake-wild');}
      }}
      const internal=new URL(request.url);internal.hostname='serpent.internal';internal.pathname='/ws';if(accountName)internal.searchParams.set('name',accountName);return stub.fetch(new Request(internal,{headers}));
    }

    // Quick Baloot: a seat on an open public table; empty seats get bots.
    if (request.method === "POST" && url.pathname === "/api/baloot/quick") {
      const limited = await rateLimit(request, env, "baloot-quick", 20, 60_000);
      if (limited) return limited;
      if (!env.BOARD_ROOMS || typeof env.BOARD_ROOMS.idFromName !== "function") return json({ ok: false, code: "BOARD_BINDING_MISSING", error: "محرك الغرف غير مربوط بالسيرفر" }, 503);
      try {
        // 33.0.0: open and strict play each have their own public tables
        const body = await request.json().catch(() => ({}));
        const open = body?.open !== false;
        const stub = env.BOARD_ROOMS.get(env.BOARD_ROOMS.idFromName(open ? "quick:baloot:v32" : "quick:baloot:strict:v33"));
        return await stub.fetch("https://balootquick.internal/assign", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ open }) });
      } catch (err) {
        if (isDurableRequestQuotaError(err)) throw err;
        console.error("baloot quick failed", err);
        return json({ ok: false, error: "تعذر إيجاد طاولة الآن" }, 503);
      }
    }

    // 33.0.0 «العب الحين» for the board tables: a seat on an open public table.
    if (request.method === "POST" && url.pathname === "/api/board/quick") {
      const limited = await rateLimit(request, env, "board-quick", 24, 60_000);
      if (limited) return limited;
      if (!env.BOARD_ROOMS || typeof env.BOARD_ROOMS.idFromName !== "function") return json({ ok: false, code: "BOARD_BINDING_MISSING", error: "محرك الغرف غير مربوط بالسيرفر" }, 503);
      const body = await request.json().catch(() => ({}));
      const game = String(body.game || ""), variant = game === 'snakes' && body.variant === 'adventure' ? 'adventure' : 'classic';
      if (!TABLE_GAMES.includes(game)) return json({ ok: false, error: "اللعبة غير مدعومة" }, 400);
      try {
        const stub = env.BOARD_ROOMS.get(env.BOARD_ROOMS.idFromName("quick:" + game + ":" + variant + ":v33"));
        return await stub.fetch("https://tablequick.internal/assign", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ game, variant }) });
      } catch (err) {
        if (isDurableRequestQuotaError(err)) throw err;
        console.error("board quick failed", err);
        return json({ ok: false, error: "تعذر إيجاد طاولة الآن" }, 503);
      }
    }

    if (request.method === "POST" && url.pathname === "/api/board/rooms") {
      const limited = await rateLimit(request, env, "board-create", 12, 60_000);
      if (limited) return limited;
      if (!env.BOARD_ROOMS||typeof env.BOARD_ROOMS.idFromName!=='function'||typeof env.BOARD_ROOMS.get!=='function') return json({ ok: false,code:'BOARD_BINDING_MISSING', error: "محرك الغرف غير مربوط بالسيرفر. فعّل BOARD_ROOMS مع BoardRoom." }, 503);
      try {
        let body = {};
        try { body = await request.json(); } catch {}
        const game = String(body.game || "");
        if (!["snakes", "zahra", "jackaroo", "dice", "baloot"].includes(game)) return json({ ok: false, error: "اللعبة غير مدعومة" }, 400);
        let variant = 'classic';
        if (game === 'snakes') {
          try { variant = normalizeSnakesVariant(body.variant); }
          catch { return json({ ok: false, error: 'اختر الكلاسيك أو المطوّرة' }, 400); }
        }
        // 33.0.0: a room takes whoever comes, up to the game's table; nobody picks a count
        const playerLimit = game === "baloot" ? 4 : MAX_SEATS[game];
        const name = cleanName(body.name);
        for (let attempt = 0; attempt < 12; attempt++) {
          const code = roomCodeFor(game);
          const id = env.BOARD_ROOMS.idFromName(code);
          const stub = env.BOARD_ROOMS.get(id);
          const hostKey = token();
          const res = await stub.fetch("https://board.internal/init", {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ code, hostKey, game, playerLimit, name, variant, open: body.open !== false }),
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
          const headers=new Headers(request.headers);headers.delete('x-bs-account');headers.delete('x-bs-characters');headers.delete('x-bs-character');headers.delete('x-bs-reactions');headers.delete('x-bs-dice');headers.delete('x-bs-pawn');
          const st=String(headers.get('sec-websocket-protocol')||'').split(',').map(x=>x.trim()).find(x=>x.startsWith('st.'))?.slice(3);
          let named=null;
          if(st){const check=new Request(request.url,{headers:{authorization:'Bearer '+st}});const auth=await authenticate(check,env);if(auth){headers.set('x-bs-account',auth.username);named=new URL(request.url);named.searchParams.set('name',accountRoomName(auth));const result=await auth.stub.fetch('https://social.internal/career/get',{method:'POST',body:JSON.stringify({secret:auth.secret})});if(result.ok){const data=await result.json(),owned=(data.career?.owned||[]).filter(id=>id.startsWith('character-')).map(id=>id.slice(10));headers.set('x-bs-characters',JSON.stringify(owned));headers.set('x-bs-character',(data.career?.equipped?.character||'character-fox').slice(10));headers.set('x-bs-reactions',JSON.stringify((data.career?.owned||[]).filter(id=>PAID_REACTIONS.has(id))));headers.set('x-bs-dice',String(data.career?.equipped?.dice||''));headers.set('x-bs-pawn',String(data.career?.equipped?.pawn||''));}}}
          return await stub.fetch(named?new Request(named,{method:request.method,headers}):new Request(request,{headers}));
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
    this.aiPack = null;
    this.ctx.blockConcurrencyWhile(async () => {
      this.room = (await this.ctx.storage.get("room")) || null;
      this.aiPack = (await this.ctx.storage.get("aiPack")) || null;
      this.syncConnectedFlags();
    });
  }

  // AI pictures join the quiz only when the shared bank has enough of them.
  extraCategories() { const cat = this.aiPack ? aiCategory(this.aiPack) : null; return cat ? new Map([[cat.id, cat]]) : null; }
  categoryList() { const extra = this.extraCategories(); return [...CATEGORIES, ...(extra ? extra.values() : [])].map((c) => ({ id: c.id, name: c.name, icon: c.icon, desc: c.desc })); }
  hasCategory(id) { return CATEGORY_MAP.has(id) || Boolean(this.extraCategories()?.has(id)); }
  async loadAiPack() {
    try {
      if (!this.env?.BOARD_ROOMS?.idFromName) return;
      const stub = this.env.BOARD_ROOMS.get(this.env.BOARD_ROOMS.idFromName(QUIZ_AI_OBJECT));
      const res = await stub.fetch('https://quizai.internal/pack'), data = await res.json();
      const items = Array.isArray(data?.items) ? data.items.slice(0, 80) : [];
      this.aiPack = aiCategory(items) ? items : null;
      if (this.aiPack) await this.ctx.storage.put('aiPack', this.aiPack); else await this.ctx.storage.delete('aiPack');
    } catch (error) { if (isDurableRequestQuotaError(error)) throw error; this.aiPack = null; }
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
    for (const p of Object.values(this.room.players)) p.connected = p.bot ? true : online.has(p.id);
  }

  async persist() {
    if (this.room) await this.ctx.storage.put("room", this.room);
  }

  async partyDelegate(){if(!this.partyRoom)this.partyRoom=new PartyRoom(this.ctx,this.env);await this.partyRoom.ready;return this.partyRoom;}

  async pathsDelegate(){if(!this.pathsRoom)this.pathsRoom=new PathsRoom(this.ctx,this.env);await this.pathsRoom.ready;return this.pathsRoom;}

  async sudokuDelegate(){if(!this.sudokuRoom)this.sudokuRoom=new SudokuRoom(this.ctx,this.env);await this.sudokuRoom.ready;return this.sudokuRoom;}

  async pictureDelegate(){if(!this.pictureRoom)this.pictureRoom=new ImageRoom(this.ctx,this.env);await this.pictureRoom.ready;return this.pictureRoom;}

  async serpentDelegate(){if(!this.serpentRoom)this.serpentRoom=new SerpentRoom(this.ctx,this.env);await this.serpentRoom.ready;return this.serpentRoom;}

  async fetch(request) {
    const url = new URL(request.url);
    if(url.hostname==='party.internal')return (await this.partyDelegate()).fetch(request);
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
        // 33.0.0: «فريقين» opens a room for two teams (2 against 2 or 3 against 3, set by who
        // came); otherwise everyone plays for themselves, up to twenty
        mode: body.teams === true ? 'teams-6' : [4,6].includes(Number(body.playerLimit)) ? `teams-${Number(body.playerLimit)}` : 'free',
        relayEnabled: body.teams === true || [4,6].includes(Number(body.playerLimit)),
        playerLimit: body.teams === true ? 6 : Number.isInteger(body.playerLimit)&&body.playerLimit>=2&&body.playerLimit<=20 ? body.playerLimit : 20,
        expiresAt: now + 24 * 60 * 60 * 1000,
        // 32.1.0: opened by a group room, which gets the final ranking back
        partyLink: cleanPartyLink(body.party),
        partyExpected: cleanPartyLink(body.party) ? Math.max(1, Math.min(20, Number(body.expected) || 2)) : undefined,
      };
      await this.loadAiPack();
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
        if (this.room.order.length === 0 && !this.room.partyLink) return json({ ok: false, error: "بانتظار دخول المضيف أولًا" }, 409);
        if (this.room.status !== "lobby") return json({ ok: false, error: "المباراة بدأت ولا يمكن دخول لاعب جديد" }, 409);
        this.cleanupLobbySeats();
        if (this.room.order.length >= (this.room.playerLimit || 8)) return json({ ok: false, error: `الغرفة ممتلئة (الحد الأقصى ${this.room.playerLimit || 8} لاعبين)` }, 409);
        // a room opened by a group room (only there can nobody be in yet): the first player in hosts it
        const firstOfParty = Boolean(this.room.partyLink) && !this.room.order.length;
        player = this.addPlayer(name, firstOfParty ? "host" : "guest");
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
      await this.partyQuizArrival();

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
      team: ['teams-4','teams-6'].includes(this.room.mode) ? (this.room.order.filter(id=>this.room.players[id]?.team==='A').length<=this.room.order.filter(id=>this.room.players[id]?.team==='B').length?'A':'B') : null,
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
    if(ws.deserializeAttachment()?.party)return (await this.partyDelegate()).webSocketMessage(ws,raw);
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

    if(['answer','power','relay_answer'].includes(msg.type)){const required=msg.type==='relay_answer'||ws.deserializeAttachment()?.roundContext;if((required||Object.hasOwn(msg,'roundIndex')||Object.hasOwn(msg,'matchId'))&&(msg.matchId!==this.room.matchId||msg.roundIndex!==this.room.roundIndex))return this.sendError(ws,'تغير السؤال؛ انتظر تحديث الجولة');}

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
              .filter((id) => this.hasCategory(id))
              .slice(0, 6);
            if (ids.length !== 6) return this.sendError(ws, "اختر 6 فئات");
            this.room.selectedCategories = ids;
            for(const p of Object.values(this.room.players))p.ready=false;
            await this.persistAndBroadcast();
          }
          break;

        case "set_mode":
          // 33.0.0: the host picks in the room: everyone for themselves, or two teams
          if (player.role !== "host" || this.room.status !== "lobby") return this.sendError(ws, "للمضيف فقط");
          {
            const teams = msg.mode === 'teams', humans = this.room.order.filter((id) => !this.room.players[id]?.bot);
            if (teams && humans.length > 6) return this.sendError(ws, "الفريقين حتى 6 لاعبين");
            if (teams === String(this.room.mode || '').startsWith('teams-')) break;
            this.room.mode = teams ? 'teams-6' : 'free';
            this.room.playerLimit = teams ? 6 : 20;
            this.room.relayEnabled = teams;
            for (const [index, id] of humans.entries()) this.room.players[id].team = teams ? (index % 2 ? 'B' : 'A') : null;
            await this.persistAndBroadcast();
          }
          break;

        case "set_relay":
          if(player.role!=='host'||this.room.status!=='lobby')return this.sendError(ws,'للمضيف فقط');
          if(!['teams-4','teams-6'].includes(this.room.mode)||typeof msg.enabled!=='boolean')return this.sendError(ws,'سلسلة الفريق متاحة لفريقين من 4 أو 6 لاعبين');
          this.room.relayEnabled=msg.enabled;
          for(const p of Object.values(this.room.players))p.ready=false;
          await this.persistAndBroadcast();
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
          this.room.selectedCategories = shuffle(this.categoryList().map((c) => c.id)).slice(0, 6);
          for(const p of Object.values(this.room.players))p.ready=false;
          await this.persistAndBroadcast();
          break;

        case "start":
          if (player.role !== "host") return this.sendError(ws, "للمضيف فقط");
          if (this.room.status !== "lobby") return;
          if (!this.room.order.every((id) => this.room.players[id]?.connected)) return this.sendError(ws, "انتظر اتصال اللاعبين");
          if (this.room.selectedCategories.length !== 6) return this.sendError(ws, "اختر 6 فئات");
          if (this.room.partyLink && !this.room.matchId) return this.sendError(ws, "تبدأ الجولة لحالها أول ما يوصل أصحاب الجمعة");
          {
            const problem = this.seatForMatch();
            if (problem) return this.sendError(ws, problem);
          }
          await this.startMatch();
          break;

        case "answer":
          await this.handleAnswer(player, Number(msg.choice));
          break;

        case "relay_answer":
          await this.handleRelayAnswer(player,msg,ws);
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
    if(ws.deserializeAttachment()?.party)return (await this.partyDelegate()).webSocketClose(ws);
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
    if(ws.deserializeAttachment()?.party)return (await this.partyDelegate()).webSocketError(ws);
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
      const successorId = this.room.order.find((id) => id !== hostId && this.room.players[id]?.connected && !this.room.players[id]?.bot);
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
    if(this.room.status==='lobby'&&this.room.partyLink&&this.room.lobbyDeadline)candidates.push(Math.max(this.room.lobbyDeadline,now+50));
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
        ready: p.ready, connected: Boolean(p.connected), bot: Boolean(p.bot), level: p.bot ? p.level : undefined,
        powers: p.id === playerId ? p.powers : {
          double: p.powers.double, time: p.powers.time, block: p.powers.block
        },
      };
    });

    const out = {
      code: this.room.code,
      serverNow:Date.now(),matchId:this.room.matchId||'',mode:this.room.mode,relayEnabled:Boolean(this.room.relayEnabled),playerLimit:this.room.playerLimit,rewardsComplete:this.room.rewardsComplete!==false,teamScores:['A','B'].map(team=>({team,score:this.room.order.reduce((n,id)=>n+(this.room.players[id]?.team===team?this.room.players[id].score:0),0)})),
      status: this.room.status,
      selectedCategories: this.room.selectedCategories,
      categories: this.categoryList(),
      players,
      me: me ? { id: me.id, role: me.role, powers: me.powers } : null,
      roundIndex: this.room.roundIndex,
      roundCount: this.room.roundCount,
      winnerId: this.room.winnerId,
      lastReveal: this.room.lastReveal,
      party: this.room.partyLink ? { expected: this.room.partyExpected || 2, first: !this.room.matchId } : undefined,
      lobbyDeadline: this.room.lobbyDeadline || null,
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
        answeredPlayers: Object.keys(c.answers || {}),
        blocked: Boolean(c.blocked?.[playerId]),
      };

      if (c.mode === "secret" && c.phase === "secret") base.options = c.options;
      if(c.mode==='relay'){
        base.relay=relayView(c.relays?.[me?.team],playerId);
        base.teamProgress=Object.entries(c.relays||{}).map(([team,r])=>({team,stage:r.stage,count:r.members.length,complete:r.complete,failed:r.failed}));
      }
      out.current = base;
    }
    return out;
  }

  // 33.0.0: a room plays with whoever came — no player count to pick and no «جاهز» step.
  // Returns what stops the match, or null when it is set (bots added for someone alone).
  seatForMatch() {
    const humans = this.room.order.filter((id) => !this.room.players[id]?.bot);
    if (this.room.mode !== 'free') {
      // two teams of the people here: 2 against 2, or 3 against 3
      if (![4, 6].includes(humans.length)) return "الفريقين يحتاجون 4 أو 6 لاعبين — الحين " + humans.length;
      this.room.mode = 'teams-' + humans.length;
      if (['A', 'B'].some((team) => humans.filter((id) => this.room.players[id].team === team).length !== humans.length / 2))
        for (const [index, id] of humans.entries()) this.room.players[id].team = index % 2 ? 'B' : 'A';
    } else if (humans.length < 2) {
      // alone: two bots, each with its own strength, play with you
      for (const bot of makeQuizBots(2, humans.map((id) => this.room.players[id].name))) {
        this.room.players[bot.id] = { ...bot, role: 'guest', score: 0, ready: true, connected: true, disconnectedAt: null, powers: { double: false, time: false, block: false } };
        this.room.order.push(bot.id);
      }
    }
    return null;
  }

  // A quiz the group room opened starts by itself: once everyone it sent is in, or 30 seconds
  // after the first came (with whoever is here).
  async partyQuizArrival() {
    const r = this.room;
    if (!r?.partyLink || r.status !== 'lobby' || r.matchId) return;
    this.syncConnectedFlags();
    const here = r.order.filter((id) => r.players[id]?.connected && !r.players[id]?.bot).length;
    if (here >= (r.partyExpected || r.playerLimit || 2)) { r.lobbyDeadline = null; if (!this.seatForMatch()) await this.startMatch(); return; }
    if (here && !r.lobbyDeadline) { r.lobbyDeadline = Date.now() + PARTY_TABLE_WAIT_MS; await this.persistAndBroadcast(); await this.scheduleLobbyAlarm(); }
  }

  async startMatch() {
    this.room.status = "playing";
    this.room.matchId=crypto.randomUUID();this.room.startedAt=Date.now();this.room.rewardsComplete=false;
    this.room.winnerId = null;
    this.room.lastReveal = null;
    this.room.roundIndex = -1;
    this.room.roundPlan = makePlan(this.room.selectedCategories, this.room.roundCount, this.room.recentQids || [], this.extraCategories());
    if(this.room.relayEnabled&&['teams-4','teams-6'].includes(this.room.mode))this.room.roundPlan=this.room.roundPlan.map((round,index)=>({...round,mode:(index+1)%4===0?'relay':round.mode}));
    this.room.recentQids = [...new Set([
      ...this.room.roundPlan.map((x) => x.qid),
      ...(this.room.recentQids || []),
    ])].slice(0, 96);
    for (const id of this.room.order) {
      const p = this.room.players[id];
      p.score = 0;
      p.ready = true;
      p.powers = p.bot ? { double: false, time: false, block: false } : { double: true, time: true, block: true };
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
    const found = qFromRef(plan.catId, plan.qid, this.extraCategories());
    if (!found) {
      await this.startNextRound();
      return;
    }
    const { cat, q } = found;
    if(plan.mode==='relay'){
      const now=Date.now(),seed=this.room.roundIndex+this.room.matchId.split('').reduce((n,c)=>n+c.charCodeAt(0),0);
      const relays=Object.fromEntries(['A','B'].map(team=>[team,createRelay({seed,members:this.room.order.filter(id=>this.room.players[id]?.team===team),now})]));
      this.room.current={mode:'relay',phase:'relay',category:{id:'relay',name:'سلسلة الفريق',icon:'puzzle'},value:q.v,question:'كل عضو يحل جزءًا ويسلّم الناتج لزميله. اكملوا السلسلة معًا.',media:null,relays,deadline:now+60000,startedAt:now,answerOpensAt:now,answers:{},options:[],correctIndex:-1,correctAnswer:'سلسلة الفريق · نتائج الأجزاء أدناه',double:{},blocked:{}};
      await this.persistAndBroadcast();await this.ctx.storage.setAlarm(this.room.current.deadline);return;
    }
    const { options, correctIndex } = buildChoices(cat, q);
    const now = Date.now();
    const previewMs = q.media === "memory" ? Math.min(8000, Math.max(2500, Number(q.memory?.previewMs) || 4500)) : 0;
    const answerOpensAt = now + previewMs;
    const responseMs = 30000;
    // Rounds planned before 32.0.1 may still say "buzzer"; they are answered in secret too.
    this.room.current = {
      mode: "secret",
      phase: "secret",
      category: { id: cat.id, name: cat.name, icon: cat.icon },
      value: q.v,
      question: q.q,
      media: q.media ? {
        type: q.media, src: q.src, zoom: q.zoom || null, hintZoom: q.hintZoom || null,
        focusX: Number.isFinite(q.focusX) ? q.focusX : 50,
        focusY: Number.isFinite(q.focusY) ? q.focusY : 50,
        replays: Number.isInteger(q.replays) ? q.replays : (q.media === "sound" ? 2 : null),
        credit: q.credit || "",
        revealSrc: q.revealSrc || q.src || '',
        generated: Boolean(q.generated),
        memory: q.media === "memory" ? (q.memory || null) : null,
      } : null,
      options,
      correctIndex,
      correctAnswer: q.a,
      deadline: answerOpensAt + responseMs,
      startedAt: now,
      answerOpensAt,
      answers: {},
      double: {},
      blocked: {},
    };
    const bots = this.room.order.map((id) => this.room.players[id]).filter((p) => p?.bot);
    if (bots.length) this.room.current.botPlan = planBotAnswers({ opensAt: answerOpensAt, deadline: answerOpensAt + responseMs, options: options.length, correct: correctIndex }, bots);
    await this.persistAndBroadcast();
    await this.ctx.storage.setAlarm(Math.min(this.room.current.deadline, nextBotAnswer(this.room.current.botPlan, {})));
  }

  opponentId(playerId){const player=this.room.players[playerId];return this.room.order.find(id=>id!==playerId&&this.room.players[id]?.connected&&(!player?.team||this.room.players[id].team!==player.team))||null;}

  async handleRelayAnswer(player,msg,ws){
    const c=this.room.current;if(this.room.status!=='playing'||c?.mode!=='relay')return;
    const relay=c.relays?.[player.team];
    const result=answerRelay(relay,{playerId:player.id,choice:msg.choice,stageId:msg.stageId,now:Date.now()});
    if(!result.accepted)return this.sendError(ws,result.error==='wrong_member'?'هذا الجزء لزميلك':result.error==='stage_changed'?'وصلنا إلى جزء جديد؛ انتظر تحديث الفريق':'انتهى الوقت أو سبق إرسال هذا الاختيار');
    if(Object.values(c.relays).every(r=>r.complete||r.failed)){await this.finalizeRelay();return;}
    await this.persistAndBroadcast();await this.ctx.storage.setAlarm(c.deadline);
  }

  async finalizeRelay(){
    const c=this.room.current;if(c?.mode!=='relay')return;
    const results={};
    for(const relay of Object.values(c.relays))for(const [id,result]of Object.entries(relayResults(relay,c.value))){results[id]=result;if(this.room.players[id])this.room.players[id].score+=result.gain;}
    await this.revealRound(results);
  }

  allowedToAnswer(playerId) {
    const c = this.room.current;
    if (!c) return false;
    if (c.mode === "secret" && c.phase === "secret") return !c.answers[playerId];
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

    if (Object.keys(c.answers).length >= this.room.order.length) await this.finalizeSecret();
    else {
      // every person has answered: the bots do not keep them waiting
      if (c.botPlan && this.room.order.every((id) => this.room.players[id]?.bot || c.answers[id])) await this.ctx.storage.setAlarm(Math.min(c.deadline, hurryBotAnswers(c.botPlan, c.answers, now)));
      await this.persistAndBroadcast();
    }
  }

  async usePower(player, power) {
    const c = this.room.current;
    if (this.room.status !== "playing" || !c) return;
    if (Date.now() < (c.answerOpensAt || c.startedAt || 0)) return;
    if (Date.now() >= c.deadline) return;
    if (!["double", "time", "block"].includes(power)) return;
    if (!player.powers[power]) return;
    if (c.blocked?.[player.id]) return;

    if (c.phase !== "secret") return;

    if (power === "double") {
      if (c.answers[player.id]) return;
      c.double[player.id] = true;
    } else if (power === "time") {
      if (c.answers[player.id]) return;
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
      relay: c.mode==='relay'?Object.entries(c.relays).map(([team,r])=>({team,...relayReveal(r)})):null,
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
    await this.persistAndBroadcast();await this.saveQuizRewards();
    if(this.room.partyLink&&!this.room.partyReported){const rows=this.room.order.map(id=>this.room.players[id]).filter(p=>p&&!p.bot).sort((a,b)=>(b.score||0)-(a.score||0)).map(p=>({name:p.name,username:p.username,score:p.score||0,won:this.room.winnerId===p.id}));await settlePartyLink(this.env,this.room,'quiz',partyStandings(rows,(a,b)=>a.score===b.score));await this.persist();}
    this.broadcastState();await this.scheduleLobbyAlarm();
  }
  async saveQuizRewards(){
    const r=this.room;if(!r||r.status!=='finished'||r.rewardsComplete!==false)return;
    try{if(r.matchId&&r.roundIndex>=12&&r.roundPlan.length>=12&&r.finishedAt-r.startedAt>=30000)for(const id of r.order){const p=r.players[id];if(!p.username)continue;const stub=getSocialStub(this.env,p.username);if(!stub)throw new Error('binding_missing');const res=await stub.fetch('https://social.internal/career/verified',{method:'POST',body:JSON.stringify({id:`quiz:${r.matchId}:${p.id}`,game:'quiz',win:r.winnerId===p.id||r.winnerId==='team:'+p.team})});if(!res.ok)throw new Error('reward_failed');}r.rewardsComplete=true;r.rewardRetryAt=null;}catch{r.rewardRetryAt=Date.now()+10000;}await this.persist();
  }

  async resetForRematch() {
    for (const id of this.room.order) if (this.room.players[id]?.bot) delete this.room.players[id];
    this.room.order = this.room.order.filter((id) => this.room.players[id]);
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
    if(this.partyRoom||await this.ctx.storage.get('partyRoom'))return (await this.partyDelegate()).alarm();
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
      if (this.room.status === 'lobby' && this.room.partyLink && !this.room.matchId && this.room.lobbyDeadline && now >= this.room.lobbyDeadline) {
        this.syncConnectedFlags();
        this.room.lobbyDeadline = null;
        const away = this.room.order.filter((id) => !this.room.players[id]?.connected);
        if (away.length < this.room.order.length) {
          // those who left before it started give up their seats; someone here hosts it
          for (const id of away) delete this.room.players[id];
          this.room.order = this.room.order.filter((id) => this.room.players[id]);
          if (!this.room.order.some((id) => this.room.players[id].role === 'host')) this.room.players[this.room.order[0]].role = 'host';
          if (!this.seatForMatch()) { await this.startMatch(); return; }
        }
        await this.persistAndBroadcast();
      }
      if(this.room.status==='finished'&&this.room.rewardsComplete===false&&now>=(this.room.rewardRetryAt||0)){await this.saveQuizRewards();this.broadcastState();}
      if (this.cleanupLobbySeats()) await this.persistAndBroadcast();
      await this.scheduleLobbyAlarm();
      return;
    }

    if (this.room.lastReveal && now >= this.room.lastReveal.nextAt) {
      await this.startNextRound();
      return;
    }

    const c = this.room.current;
    if (c?.mode === "secret" && c.phase === "secret" && c.botPlan && now < c.deadline) {
      const due = dueBotAnswers(c.botPlan, c.answers, now);
      for (const a of due) {
        if (c.blocked?.[a.id]) { delete c.botPlan[a.id]; continue; }
        c.answers[a.id] = { choice: a.choice, at: a.at, bonus: speedBonus(c.deadline, a.at) };
      }
      if (due.length) {
        if (Object.keys(c.answers).length >= this.room.order.length) { await this.finalizeSecret(); return; }
        await this.persistAndBroadcast();
      }
    }
    if (!c || now + 300 < c.deadline) {
      if (c) await this.ctx.storage.setAlarm(Math.min(c.deadline, c.mode === "secret" ? nextBotAnswer(c.botPlan, c.answers) : Infinity));
      return;
    }

    if (c.mode === "secret" && c.phase === "secret") {
      await this.finalizeSecret();
      return;
    }

    if(c.mode==='relay'){await this.finalizeRelay();return;}

    // A buzzer round saved before 32.0.1 ends without points when its time is up.
    const results = Object.fromEntries(this.room.order.map((id) => [id, { correct: false, gain: 0, choice: null }]));
    await this.revealRound(results);
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
    const game=String(body.game||'');if(!['snakes','zahra','jackaroo','dice','baloot'].includes(game))return json({ok:false,error:'invalid_game'},400);
    let variant='classic';if(game==='snakes')try{variant=normalizeSnakesVariant(body.variant)}catch{return json({ok:false,error:'invalid_variant'},400)}
    const partyLink=game==='baloot'?null:cleanPartyLink(body.party);
    // 33.0.0: a room takes as many as come (up to the game's table); a group room
    // still opens a table sized for exactly its players.
    const playerLimit=game==='baloot'?4:partyLink?(game==='jackaroo'?(Number(body.playerLimit)===6?6:4):Math.min(MAX_SEATS[game],Math.max(2,Number(body.playerLimit)||2))):MAX_SEATS[game];
    const now=Date.now(),room={code:body.code,hostKey:body.hostKey,game,variant,playerLimit,createdAt:now,updatedAt:now,expiresAt:now+24*60*60*1000,status:'lobby',players:{},order:[],state:null,pendingRoll:null,turnDeadline:null,version:0};
    // A public table (Baloot quick, or «العب الحين») starts by itself after the lobby countdown.
    room.publicMatch=body.publicMatch===true;room.lobbyDeadline=room.publicMatch?now+(game==='baloot'?BALOOT_LOBBY_MS:TABLE_LOBBY_MS):null;
    if(game==='baloot'){room.bots=[];room.batch=null;room.nextHandAt=null;room.open=body.open!==false;}
    else{room.partyLink=partyLink;
      // 33.0.0: the players the group room sent to this table; it starts as soon as they are all in
      if(partyLink)room.partyExpected=Math.max(1,Math.min(playerLimit,Number(body.expected)||playerLimit));}
    try{await this.ctx.storage.put('room',room);await this.ctx.storage.setAlarm(room.publicMatch?room.lobbyDeadline:room.expiresAt);this.room=room;return json({ok:true},201)}
    catch(error){const requestId=crypto.randomUUID();this.room=null;try{await this.ctx.storage.delete('room');await this.ctx.storage.deleteAlarm()}catch(rollback){console.error('board initialization rollback failed',{requestId,error:rollback.message})}console.error('board initialization failed',{requestId,error:error.message});return json({ok:false,code:'ROOM_INITIALIZATION_FAILED',error:'تعذر حفظ الغرفة على السيرفر. حاول مرة أخرى.',requestId},503)}
  }

  syncConnected() {
    if (!this.room?.players) return;
    const ids = new Set();
    for (const ws of this.ctx.getWebSockets()) {
      try { const a = ws.deserializeAttachment(); if (a?.playerId) ids.add(a.playerId); } catch {}
    }
    for (const p of Object.values(this.room.players)) p.connected = p.bot ? true : ids.has(p.id);
  }

  async persist() {
    if (!this.room) return;
    this.room.updatedAt = Date.now();
    await this.ctx.storage.put("room", this.room);
    if(this.room.status==='finished'&&!this.room.rewardsComplete){
      const endedAt=this.room.startedAt;
      const rewards=this.room.order.map((id,index)=>{const player=this.room.players[id];return {username:player.username,id:'board:'+this.room.code+':'+endedAt+':'+player.id,game:this.room.game,win:this.room.game==='baloot'?balootWinFor(this.room,player):this.room.game==='jackaroo'?this.room.state.winnerTeam===index%2:this.room.state.winner===index}});
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
    if(this.room.status==='finished'&&this.room.partyLink&&!this.room.partyReported&&this.room.state){await settlePartyLink(this.env,this.room,this.room.game,this.boardStandings());await this.ctx.storage.put('room',this.room);}
  }
  // 32.1.0: the final ranking of a board match, for the group room that opened it
  boardStandings(){
    const r=this.room,winners=new Set(winnerSeats(r)),rows=r.order.map((id,i)=>({p:r.players[id]||{},i})).filter(({p})=>!p.bot).map(({p,i})=>({name:p.name,username:p.username,score:seatProgress(r,i),won:winners.has(i)}));
    rows.sort((a,b)=>Number(b.won)-Number(a.won)||b.score-a.score);
    return partyStandings(rows,(a,b)=>a.won===b.won&&(a.won||a.score===b.score));
  }

  addPlayer(name, role) {
    const id = crypto.randomUUID();
    const p = { id, token: token(), name: cleanName(name), role, ready: false, connected: true, disconnectedAt: null };
    if (this.room.game === 'baloot') p.seat = freeBalootSeat(this.room);
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
    return this.maskGameState(this.room.state, playerId);
  }
  // Jackaroo hands and deck stay private: each player sees only their own cards.
  maskGameState(source, playerId) {
    const state = structuredClone(source);
    if (this.room.game === "jackaroo") {
      const me = this.playerIndex(playerId);
      state.deck = Array(state.deck?.length || 0).fill("?");
      state.discard = Array(state.discard?.length || 0).fill("?");
      state.hands = (state.hands || []).map((hand, i) => i === me ? hand : Array(hand.length).fill("?"));
    }
    return state;
  }

  publicState(playerId, steps = null) {
    if (!this.room) return null;
    const me = this.room.players[playerId];
    if (this.room.game === 'baloot') {
      return {
        code: this.room.code, game: 'baloot', variant: 'classic', serverNow: Date.now(), playerLimit: 4,
        status: this.room.status, version: this.room.version || 0, startedAt: this.room.startedAt || null,
        players: balootPlayers(this.room),
        me: me ? { id: me.id, index: me.seat, role: me.role } : null,
        turnDeadline: this.room.turnDeadline || null,
        ...balootRoomView(this.room, me),
      };
    }
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
        const look = p.look || { ...DEFAULT_LOOK, character: p.character || DEFAULT_LOOK.character };
        return { id: p.id, index, name: p.name, role: p.role, ready: Boolean(p.ready), connected: Boolean(p.connected), bot: Boolean(p.bot), level: p.bot ? p.level : undefined, look, character: look.character };
      }),
      me: me ? { id: me.id, index: this.playerIndex(me.id), role: me.role } : null,
      publicMatch: Boolean(this.room.publicMatch),
      party: this.room.partyLink ? { expected: this.room.partyExpected || this.room.playerLimit, first: !this.room.startedAt } : undefined,
      lobbyDeadline: this.room.lobbyDeadline || null,
      pendingRoll: this.room.pendingRoll,
      turnDeadline: this.room.turnDeadline || null,
      turnTotal: this.room.turnTotal || null,
      state: this.publicGameState(playerId),
      // 33.0.0: the moves since the last update (the player's and the bots'), to animate in order
      steps: steps?.list?.length ? steps.list.map((step) => ({ version: step.version, pendingRoll: step.pendingRoll, state: this.maskGameState(step.state, playerId) })) : undefined,
    };
  }

  sendError(ws, message) { try { ws.send(JSON.stringify({ type: "error", message })); } catch {} }

  broadcast(steps = null) {
    if (!this.room) return;
    this.syncConnected();
    for (const ws of this.ctx.getWebSockets()) {
      const p = this.playerForSocket(ws);
      if (!p) continue;
      try { ws.send(JSON.stringify({ type: "state", state: this.publicState(p.id, steps) })); } catch {}
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
      const successorId = this.room.order.find((id) => id !== hostId && this.room.players[id]?.connected && !this.room.players[id]?.bot);
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
    if (this.room.status === 'lobby' && (this.room.publicMatch || this.room.partyLink) && this.room.lobbyDeadline) candidates.push(this.room.lobbyDeadline);
    if (this.room.game === 'baloot' && this.room.status === 'playing' && this.room.nextHandAt) candidates.push(this.room.nextHandAt);
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

  async saveAndBroadcast(steps = null) {
    await this.persist();
    this.broadcast(steps);
    await this.scheduleNextAlarm();
  }

  // 33.0.0: after any move on a board table: the clock for the next person, or the end.
  async settleTable(steps) {
    if (tableOver(this.room)) this.finishGame();
    else {
      const seat = this.room.state.turn, id = this.room.order[seat], person = this.room.players[id];
      const ms = person && !person.connected ? TABLE_TURN_MS.away : this.room.publicMatch ? TABLE_TURN_MS.quick : TABLE_TURN_MS.room;
      this.room.turnTotal = ms;
      this.room.turnDeadline = Date.now() + stepsTime(this.room, steps) + ms;
    }
    await this.saveAndBroadcast(steps);
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.hostname === "billing.internal") {this.billing ??= new BillingRegistry(this.ctx,this.env);return this.ctx.blockConcurrencyWhile(()=>this.billing.fetch(request));}
    if (url.hostname === "social.internal") return (await this.socialDelegate()).fetch(request);
    if (url.hostname === "leaderboard.internal") { this.leaderboard ??= new LeaderboardStore(this.ctx); return this.leaderboard.fetch(request); }
    if (url.hostname === "presence.internal") { this.presence ??= new PresenceRegistry(this.ctx); return this.presence.fetch(request); }
    if (url.hostname === "quizai.internal") { this.quizBank ??= new QuizImageBank(this.ctx, this.env); return this.quizBank.fetch(request); }
    if (url.hostname === "balootquick.internal") { const body = await request.json().catch(() => ({})); return this.ctx.blockConcurrencyWhile(() => this.balootQuick(body?.open !== false)); }
    if (url.hostname === "tablequick.internal") { const body = await request.json().catch(() => ({})); return this.ctx.blockConcurrencyWhile(() => this.tableQuick(String(body.game || ''), String(body.variant || 'classic'))); }
    if(url.pathname==='/health'&&request.method==='GET')return json({ok:true,engine:'BoardRoom',release:RELEASE,games:['snakes','zahra','jackaroo','dice','baloot'],snakesVariants:['classic','adventure']});
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
        if (this.room.order.length === 0 && !this.room.publicMatch && !this.room.partyLink) return json({ ok: false, error: "بانتظار دخول المضيف أولًا" }, 409);
        if (this.room.status !== "lobby") return json({ ok: false, error: "المباراة بدأت ولا يمكن دخول لاعب جديد" }, 409);
        this.syncConnected();
        this.cleanupStaleLobbyGuests();
        if (this.room.order.length >= this.room.playerLimit) return json({ ok: false, error: "الغرفة ممتلئة — اللاعب المنقطع لديه مهلة للعودة" }, 409);
        // a room opened by a group room: the first player in hosts it
        player = this.addPlayer(name, this.room.order.length === 0 && this.room.partyLink ? "host" : "guest");
      } else if (name) player.name = name;

      {
        let owned=[];try{owned=JSON.parse(request.headers.get('x-bs-characters')||'[]')}catch{}
        player.allowedCharacters=['fox',...(Array.isArray(owned)?owned:[])].filter((id,index,list)=>BOARD_CHARACTERS.includes(id)&&list.indexOf(id)===index);
        const requested=url.searchParams.get('character'),equipped=request.headers.get('x-bs-character');
        if(this.room.status==='lobby')player.character=player.allowedCharacters.includes(equipped)?equipped:player.allowedCharacters.includes(requested)?requested:'fox';
        // 33.0.0: the dice and stone a player equipped. An account's come from its career
        // (set by the Worker); a guest shows the free ones it picked.
        if(this.room.status==='lobby'){
          const account=Boolean(request.headers.get('x-bs-account')),free=new Set(FREE_LOOK_ITEMS);
          const want=(header,param)=>account?request.headers.get(header):(free.has(url.searchParams.get(param))?url.searchParams.get(param):'');
          player.look=cleanLook({dice:want('x-bs-dice','dice'),pawn:want('x-bs-pawn','pawn'),character:player.character});
        }
      }
      if(request.headers.get('x-bs-account'))player.username=request.headers.get('x-bs-account');
      {let bought=[];try{bought=JSON.parse(request.headers.get('x-bs-reactions')||'[]')}catch{}player.reactions=(Array.isArray(bought)?bought:[]).filter((id,index,list)=>PAID_REACTIONS.has(id)&&list.indexOf(id)===index);}
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
      await this.partyTableArrival();
      return webSocketResponse(client, protocol);
    }
    return json({ ok: false, error: "not_found" }, 404);
  }

  // Quick Baloot: one Durable Object hands out seats on an open public table
  // and opens a new one when it is full or about to start.
  async balootQuick(openPlay = true) {
    const now = Date.now();
    let open = (await this.ctx.storage.get('balootQuick')) || null;
    if (open && (open.assigned >= 4 || now >= open.closesAt)) open = null;
    if (!open) {
      for (let attempt = 0; attempt < 8 && !open; attempt++) {
        const code = roomCodeFor('baloot');
        const stub = this.env.BOARD_ROOMS.get(this.env.BOARD_ROOMS.idFromName(code));
        const res = await stub.fetch('https://board.internal/init', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code, hostKey: token(), game: 'baloot', playerLimit: 4, publicMatch: true, open: openPlay }) });
        if (res.status === 201) open = { code, createdAt: now, closesAt: now + BALOOT_LOBBY_MS - 3000, assigned: 0 };
        else if (res.status !== 409) break;
      }
      if (!open) return json({ ok: false, error: 'تعذر فتح طاولة الآن، حاول بعد لحظة' }, 503);
    }
    open.assigned += 1;
    await this.ctx.storage.put('balootQuick', open);
    return json({ ok: true, code: open.code });
  }

  // 33.0.0 «العب الحين»: one Durable Object per game hands out seats on an open
  // public table; the table starts by itself after its 10-second lobby and bots
  // take the seats nobody took.
  async tableQuick(game, variant) {
    if (!TABLE_GAMES.includes(game)) return json({ ok: false, error: 'اللعبة غير مدعومة' }, 400);
    if (game === 'snakes') try { variant = normalizeSnakesVariant(variant); } catch { variant = 'classic'; } else variant = 'classic';
    const now = Date.now(), key = 'tableQuick';
    let open = (await this.ctx.storage.get(key)) || null;
    if (open && (open.assigned >= MAX_SEATS[game] || now >= open.closesAt)) open = null;
    if (!open) {
      for (let attempt = 0; attempt < 8 && !open; attempt++) {
        const code = roomCodeFor(game);
        const stub = this.env.BOARD_ROOMS.get(this.env.BOARD_ROOMS.idFromName(code));
        const res = await stub.fetch('https://board.internal/init', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code, hostKey: token(), game, variant, publicMatch: true }) });
        if (res.status === 201) open = { code, createdAt: now, closesAt: now + TABLE_LOBBY_MS - 2500, assigned: 0 };
        else if (res.status !== 409) break;
      }
      if (!open) return json({ ok: false, error: 'تعذر فتح طاولة الآن، حاول بعد لحظة' }, 503);
    }
    open.assigned += 1;
    await this.ctx.storage.put(key, open);
    return json({ ok: true, code: open.code, game, variant });
  }

  // Reactions are relayed to everyone in the room and never touch the game
  // state, its version or storage. Each player is limited in memory.
  relayEmote(player,emote,ws){
    const item=typeof emote==='string'?Career.reactionOf(emote):null;if(!item)return;
    if(!FREE_REACTIONS.has(item.id)&&!(player.reactions||[]).includes(item.id)){try{ws?.send(JSON.stringify({type:'emote-locked',emote:item.id}))}catch{}return;}
    const move=item.type==='move',now=Date.now(),log=(this.emoteLog??=new Map()),recent=(log.get(player.id)||[]).filter(t=>now-t<60000),moves=(this.moveLog??=new Map()),recentMoves=(moves.get(player.id)||[]).filter(t=>now-t<60000);
    if(recent.length>=EMOTE_PER_MINUTE||recent.length&&now-recent.at(-1)<EMOTE_GAP_MS)return;
    if(move&&(recentMoves.length>=MOVE_PER_MINUTE||recentMoves.length&&now-recentMoves.at(-1)<MOVE_GAP_MS))return;
    recent.push(now);log.set(player.id,recent);if(move){recentMoves.push(now);moves.set(player.id,recentMoves);}
    // Older pages know the first eight by their short ids.
    const packet=JSON.stringify({type:'emote',from:player.id,name:player.name,emote:item.legacy||item.id,at:now});
    for(const socket of this.ctx.getWebSockets()){try{if(socket.deserializeAttachment()?.playerId)socket.send(packet);}catch{}}
  }

  // 32.1.0: Baloot table talk — only the catalogue's phrases and emoji, by id,
  // relayed like reactions (no storage, no version) and limited per player.
  relayTalk(player,msg){
    if(this.room?.game!=='baloot'||!Number.isInteger(player.seat)||!validTalk(msg.kind,msg.id))return;
    const now=Date.now(),log=(this.talkLog??=new Map()),recent=(log.get(player.id)||[]).filter(t=>now-t<60000);
    if(recent.length>=EMOTE_PER_MINUTE||recent.length&&now-recent.at(-1)<EMOTE_GAP_MS)return;
    recent.push(now);log.set(player.id,recent);
    const packet=JSON.stringify({type:'talk',from:player.id,seat:player.seat,kind:msg.kind,id:String(msg.id),at:now});
    for(const socket of this.ctx.getWebSockets()){try{if(socket.deserializeAttachment()?.playerId)socket.send(packet);}catch{}}
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
    if(msg.type==='ping'){try{ws.send(JSON.stringify({type:'pong',serverNow:Date.now()}))}catch{}return;}
    if(msg.type==='resync'){try{ws.send(JSON.stringify({type:'state',state:this.publicState(player.id)}))}catch{}return;}
    if(msg.type==='emote')return this.relayEmote(player,msg.emote,ws);
    if(msg.type==='talk')return this.relayTalk(player,msg);
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
      if (this.room.game === 'baloot' && msg.type === 'start') {
        if (player.role !== 'host' || this.room.publicMatch) return this.sendError(ws, 'بدء المباراة للمضيف فقط');
        if (this.room.status !== 'lobby') return;
        startBalootRoom(this.room, secureUnit, Date.now());
        for (const id of this.room.order) this.room.players[id].ready = true;
        this.room.version++;
        return await this.saveAndBroadcast();
      }
      if (this.room.game === 'baloot' && msg.type === 'baloot') {
        if (this.room.status !== 'playing' || !this.room.state) return this.sendError(ws, 'المباراة غير نشطة');
        if (msg.action?.type !== 'claim' && msg.expectedVersion !== undefined && msg.expectedVersion !== null && msg.expectedVersion !== this.room.version) return this.sendError(ws, 'تغيرت حالة الطاولة — انتظر التحديث');
        try { applyBalootMove(this.room, player, msg.action, secureUnit, Date.now()); }
        catch (error) {
          const code = String(error?.message || error);
          const messages = { wrong_turn: 'مو دورك الآن', illegal_card: 'هذي الورقة ما تنلعب الحين', illegal_bid: 'هذا الشراء غير متاح', illegal_double: 'هذا الدبل غير متاح', illegal_claim: 'التسجيل متاح أثناء اللعب فقط، مرة وحدة في الجولة', invalid_action: 'أمر غير معروف', review_required:'اختر الأكلات واعرض التسجيل للمراجعة أولًا', review_in_progress:'اللعب متوقف حتى تنتهي المراجعة', review_unavailable:'المراجعة متاحة أثناء اللعب فقط', select_claim_tricks:'اختر الأكلات التي تريد كشفها', select_claim_card:'اختر ورقة اللاعب من الأكلات المحددة', stale_review:'هذه المراجعة انتهت أو لا يحق لك تأكيدها', review_limit:'وصلت لحد المراجعات لهذه اليد', project_show_closed:'وقت عرض المشروع انتهى', invalid_claim_target:'اختر لاعبًا من الفريق المقابل', invalid_claim_reason:'اختر سبب التسجيل', invalid_claim_project:'اختر المشروع محل التسجيل' };
          return this.sendError(ws, messages[code] || 'تعذر تنفيذ الحركة');
        }
        this.room.version++;
        if (this.room.state.phase === 'finished') this.finishGame();
        return await this.saveAndBroadcast();
      }
      if (msg.type === "start") {
        if (player.role !== "host" || this.room.publicMatch) return this.sendError(ws, "بدء المباراة للمضيف فقط");
        if (this.room.status !== "lobby") return;
        if (this.room.partyLink && TABLE_GAMES.includes(this.room.game) && !this.room.startedAt) return this.sendError(ws, "تبدأ الطاولة لحالها أول ما يوصل أصحابها");
        // 33.0.0: the table starts with whoever is here; bots take the missing seats
        if (!this.room.order.every((id) => this.room.players[id]?.connected)) return this.sendError(ws, "انتظر اتصال جميع اللاعبين");
        return await this.startGame();
      }
      if (msg.type === "rematch") {
        if (player.role !== "host") return this.sendError(ws, "الإعادة للمضيف فقط");
        if (this.room.status !== "finished") return;
        if (!this.room.rewardsComplete) return this.sendError(ws, "جاري حفظ نتيجة الجولة — انتظر قليلًا ثم أعد المحاولة");
        return await this.resetForRematch();
      }
      if (this.room.status !== "playing" || !this.room.state) return this.sendError(ws, "المباراة غير نشطة");
      if(['roll','jackaroo_play','ludo_move','dice_roll','dice_bank'].includes(msg.type)&&msg.expectedVersion!==this.room.version)return this.sendError(ws,'تغيرت حالة الجولة — انتظر التحديث ثم حاول');
      if (TABLE_GAMES.includes(this.room.game)) {
        let steps;
        try { steps = playerMove(this.room, this.playerIndex(player.id), msg, secureUnit, () => this.randomDie()); }
        catch (error) {
          const code = String(error?.message || error);
          const messages = { wrong_turn: 'مو دورك الآن', move_first: 'اختر الحجر أولًا', roll_first: this.room.game === 'zahra' ? 'ارمِ الزهرة أولًا' : 'ارمِ النرد أولًا', power_unavailable: 'قدرة النردين غير متاحة الآن', illegal_move: 'الحركة غير صالحة', illegal_ludo_move: 'الحركة غير صالحة', invalid_action: 'أمر غير معروف', match_not_playing: 'المباراة غير نشطة' };
          return this.sendError(ws, messages[code] || 'تعذر تنفيذ الحركة');
        }
        return await this.settleTable(steps);
      }
      this.sendError(ws, "أمر غير معروف");
    } catch (err) {
      console.error("board room message error", err);
      this.sendError(ws, "تعذر تنفيذ الحركة");
    }
  }

  // 33.0.0: a table the group room opened starts by itself: the moment all its players
  // are in, or 30 seconds after the first one came (bots take the seats of the missing).
  async partyTableArrival() {
    const r = this.room;
    if (!r?.partyLink || r.status !== 'lobby' || r.startedAt || !TABLE_GAMES.includes(r.game)) return;
    this.syncConnected();
    const here = r.order.filter((id) => r.players[id] && !r.players[id].bot && r.players[id].connected).length;
    if (here >= (r.partyExpected || r.playerLimit)) { await this.startGame(); return; }
    if (here && !r.lobbyDeadline) { r.lobbyDeadline = Date.now() + PARTY_TABLE_WAIT_MS; await this.saveAndBroadcast(); }
  }

  async startGame(quick = false) {
    const steps = startTable(this.room, { quick, rng: secureUnit, roll: () => this.randomDie(), now: Date.now() });
    return await this.settleTable(steps);
  }

  async resetForRematch() {
    if (TABLE_GAMES.includes(this.room.game)) resetTable(this.room);
    this.room.status = "lobby";
    this.room.state = null;
    if (this.room.game === 'baloot') { this.room.bots = []; this.room.batch = null; this.room.nextHandAt = null; this.room.turnTotal = null; }
    this.room.pendingRoll = null;
    this.room.turnDeadline = null;
    this.room.version++;
    for (const id of this.room.order) this.room.players[id].ready = false;
    await this.saveAndBroadcast();
  }

  async handleTurnTimeout() {
    if (!this.room || this.room.status !== "playing" || !this.room.state) return;
    if (this.abandonIfEmpty()) return await this.saveAndBroadcast();
    const steps = timeoutMove(this.room, secureUnit, () => this.randomDie());
    if (!steps) { this.room.turnDeadline = Date.now() + TABLE_TURN_MS.room; return await this.saveAndBroadcast(); }
    return await this.settleTable(steps);
  }

  // A table whose people have all gone for a while stops instead of bots playing on alone.
  abandonIfEmpty(now = Date.now()) {
    const people = this.room.order.map((id) => this.room.players[id]).filter((p) => p && !p.bot);
    if (!people.length || people.some((p) => p.connected || !p.disconnectedAt || now - p.disconnectedAt < 90_000)) return false;
    this.finishGame();
    this.room.abandoned = true;
    return true;
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
    // Complete a peer-initiated close promptly, including runtimes which do
    // not automatically send the reciprocal Close frame. Safe if already closed.
    try { ws.close([1005,1006,1015].includes(code) ? 1000 : code, reason); } catch {}
    const p = this.playerForSocket(ws);
    if (!p || !this.room) return;
    // An old connection can finish closing after its replacement welcomed the
    // same seat. Its callback must not mark the live player away.
    const reconnected = this.ctx.getWebSockets().some(other => {
      try { return other !== ws && other.readyState === 1 && other.deserializeAttachment()?.playerId === p.id; }
      catch { return false; }
    });
    if (reconnected) return;
    p.connected = false;
    p.disconnectedAt = Date.now();
    // a player who left during their turn: the table does not wait the whole minute
    if (TABLE_GAMES.includes(this.room.game) && this.room.status === 'playing' && this.room.state && this.room.order[this.room.state.turn] === p.id && this.room.turnDeadline) this.room.turnDeadline = Math.min(this.room.turnDeadline, Date.now() + TABLE_TURN_MS.away);
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
    if (this.room.game === 'baloot') {
      const done = balootAlarm(this.room, secureUnit, now);
      if (done === 'empty') { await this.ctx.storage.deleteAll(); this.room = null; return; }
      if (done) {
        this.room.version++;
        if (this.room.state?.phase === 'finished') this.finishGame();
        await this.saveAndBroadcast();
        return;
      }
    }
    // 33.0.0: a public board table starts after its lobby with whoever is here, bots in the other seats
    if (TABLE_GAMES.includes(this.room.game) && this.room.status === 'lobby' && (this.room.publicMatch || this.room.partyLink) && this.room.lobbyDeadline && now >= this.room.lobbyDeadline) {
      this.syncConnected();
      const away = this.room.order.filter((id) => !this.room.players[id]?.connected);
      // a group table nobody is in right now waits for the next one to come back
      if (this.room.partyLink && away.length === this.room.order.length) { this.room.lobbyDeadline = null; await this.saveAndBroadcast(); return; }
      for (const id of away) { delete this.room.players[id]; this.room.order = this.room.order.filter((x) => x !== id); }
      if (!this.room.order.length) { await this.ctx.storage.deleteAll(); this.room = null; return; }
      if (this.room.partyLink && !this.room.order.some((id) => this.room.players[id]?.role === 'host')) this.room.players[this.room.order[0]].role = 'host';
      await this.startGame(Boolean(this.room.publicMatch));
      return;
    }
    if (this.room.status === "playing" && this.room.turnDeadline && now >= this.room.turnDeadline && this.room.game !== 'baloot') {
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
