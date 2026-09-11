
import { DurableObject } from "cloudflare:workers";
import { CATEGORIES } from "./questions.js";
import { createSnakesGame, playSnakesRoll } from "../public/assets/js/engines/snakes-engine.js";
import { createLudoGame, getLegalLudoMoves, applyLudoMove, passLudoTurn } from "../public/assets/js/engines/ludo-engine.js";
import { createJackarooGame, getJackarooActions, playJackarooAction } from "../public/assets/js/engines/jackaroo-engine.js";
import { createSpotDiffGame, playSpotDiffClick, finishSpotDiffGame } from "../public/assets/js/engines/spotdiff-scenes.js";
import { handleSocialRequest } from "./social/social-api.js";
import { createSocialUserClass } from "./social/social-user.js";
import { generateSafeQuestions } from "./ai-questions.js";
import { MatchmakingRoom } from "./matchmaking.js";

class SocialDelegateBase {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; }
}
const BoardSocialUser = createSocialUserClass(SocialDelegateBase);

const CATEGORY_MAP = new Map(CATEGORIES.map((c) => [c.id, c]));
const ROOM_RE = /^\d{6}$/;
const DISCONNECT_GRACE_MS = 45_000;
const TURN_TIMEOUT_MS = 60_000;
const MOVE_TIMEOUT_MS = 25_000;
const SPOTDIFF_CLICK_COOLDOWN_MS = 180;
const RATE_BUCKETS = new Map();

const TEAM_GAME_MODES = new Set(["classic", "escape", "relay", "captain"]);
const TEAM_SPECIALTIES = [
  { id: "science", label: "العلوم", categories: ["science", "space", "inventions"] },
  { id: "history", label: "التاريخ", categories: ["history", "saudi", "gulf", "geo"] },
  { id: "sports", label: "الرياضة", categories: ["football", "sports", "cars"] },
  { id: "language", label: "الكلمات", categories: ["arabic", "meanings", "logic"] },
];

function normalizeTeamMode(value, playerLimit) {
  if (![4, 6, 8].includes(Number(playerLimit))) return "classic";
  const mode = String(value || "classic").toLowerCase();
  return TEAM_GAME_MODES.has(mode) ? mode : "classic";
}

function isTeamRoom(room) {
  return /^teams-(4|6|8)$/.test(String(room?.mode || ""));
}

function teamModeLabel(mode) {
  return ({
    classic: "مواجهة جماعية",
    escape: "غرفة الهروب",
    relay: "سباق التتابع",
    captain: "القائد والخبراء",
  })[mode] || "مواجهة جماعية";
}

function leagueWeekKey(timestamp = Date.now()) {
  const date = new Date(timestamp);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
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
  } catch {
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

    if (url.pathname.startsWith("/api/") && !sameOrigin(request)) {
      return json({ ok: false, error: "cross_origin_forbidden" }, 403);
    }

    if (request.method === "GET" && url.pathname === "/api/health") {
      const quizOnline = Boolean(env.ROOMS);
      const boardOnline = Boolean(env.BOARD_ROOMS);
      const matchmakingOnline = Boolean(env.MATCHMAKING);
      const socialOnline = Boolean(env.SOCIAL_USERS || env.BOARD_ROOMS);
      if (!quizOnline || !boardOnline) {
        return json({ ok: false, online: false, quizOnline, boardOnline, matchmakingOnline, socialOnline, error: "Durable Object binding missing", version: "5.1.0" }, 503);
      }
      return json({ ok: true, online: true, quizOnline, boardOnline, matchmakingOnline, socialOnline, service: "tahadi-alabaqera-online", version: "5.1.0" });
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
          body: JSON.stringify({
            code,
            hostKey,
            name,
            playerLimit: body.playerLimit,
            teamMode: normalizeTeamMode(body.teamMode, body.playerLimit),
            teamA: body.teamA,
            teamB: body.teamB,
          }),
          });
          if (res.status === 201) return json({ ok: true, code, hostKey });
        }
        return json({ ok: false, error: "تعذر إنشاء غرفة الآن" }, 503);
      } catch (err) {
        console.error("create room failed", err);
        return json({ ok: false, error: "تعذر تشغيل محرك الغرف. تأكد من نشر Durable Object مع المشروع." }, 503);
      }
    }

    if (request.method === "POST" && url.pathname === "/api/matchmaking/join") {
      const limited = await rateLimit(request, env, "matchmaking-join", 20, 60_000);
      if (limited) return limited;
      if (!env.MATCHMAKING) return json({ ok: false, error: "محرك البحث عن المنافسين غير مفعّل" }, 503);
      const body = await request.json().catch(() => ({}));
      const game = String(body.game || "quiz").toLowerCase();
      if (!["quiz", "snakes", "zahra", "jackaroo", "spotdiff"].includes(game)) return json({ ok: false, error: "اللعبة غير مدعومة للبحث السريع" }, 400);
      const stub = env.MATCHMAKING.get(env.MATCHMAKING.idFromName(game));
      return stub.fetch("https://match.internal/join", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, game }) });
    }

    const matchmakingStatus = url.pathname === "/api/matchmaking/status" || url.pathname === "/api/matchmaking/cancel";
    if (matchmakingStatus) {
      if (!env.MATCHMAKING) return json({ ok: false, error: "محرك البحث عن المنافسين غير مفعّل" }, 503);
      const game = String(url.searchParams.get("game") || "quiz").toLowerCase();
      if (!["quiz", "snakes", "zahra", "jackaroo", "spotdiff"].includes(game)) return json({ ok: false, error: "اللعبة غير مدعومة" }, 400);
      const stub = env.MATCHMAKING.get(env.MATCHMAKING.idFromName(game));
      if (url.pathname.endsWith("/cancel")) {
        const cancelBody = await request.json().catch(() => ({}));
        return stub.fetch("https://match.internal/cancel", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cancelBody) });
      }
      return stub.fetch("https://match.internal/status" + url.search);
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
        if (suffix === "/ws") return stub.fetch(request);
        return stub.fetch("https://room.internal/status");
      } catch (err) {
        console.error("room route failed", err);
        return json({ ok: false, error: "تعذر الوصول لمحرك الغرفة" }, 503);
      }
    }

    if (request.method === "POST" && url.pathname === "/api/board/rooms") {
      const limited = await rateLimit(request, env, "board-create", 12, 60_000);
      if (limited) return limited;
      if (!env.BOARD_ROOMS) return json({ ok: false, error: "محرك ألعاب الجلسات غير مفعّل" }, 503);
      try {
        let body = {};
        try { body = await request.json(); } catch {}
        const game = String(body.game || "");
        if (!["snakes", "zahra", "jackaroo", "spotdiff"].includes(game)) return json({ ok: false, error: "اللعبة غير مدعومة" }, 400);
        const playerLimit = game === "jackaroo" ? 4 : Math.min(4, Math.max(2, Number(body.playerLimit) || 2));
        const name = cleanName(body.name);
        for (let attempt = 0; attempt < 12; attempt++) {
          const code = roomCode();
          const id = env.BOARD_ROOMS.idFromName(code);
          const stub = env.BOARD_ROOMS.get(id);
          const hostKey = token();
          const res = await stub.fetch("https://board.internal/init", {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ code, hostKey, game, playerLimit, name }),
          });
          if (res.status === 201) return json({ ok: true, code, hostKey, game, playerLimit });
        }
        return json({ ok: false, error: "تعذر إنشاء غرفة الآن" }, 503);
      } catch (err) {
        console.error("create board room failed", err);
        return json({ ok: false, error: "تعذر تشغيل غرفة اللعبة" }, 503);
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
        if (suffix === "/ws") return stub.fetch(request);
        return stub.fetch("https://board.internal/status");
      } catch (err) {
        console.error("board room route failed", err);
        return json({ ok: false, error: "تعذر الوصول لغرفة اللعبة" }, 503);
      }
    }

    if (url.pathname === "/api/catalog") {
      return json({
        categories: CATEGORIES.map((c) => ({ id: c.id, name: c.name, icon: c.icon, desc: c.desc })),
      });
    }

    if (url.pathname === "/api/league" && env.ROOMS) {
      const limited = await rateLimit(request, env, "league", request.method === "POST" ? 30 : 120, 60_000);
      if (limited) return limited;
      const league = env.ROOMS.get(env.ROOMS.idFromName("__weekly-league__"));
      return league.fetch(new Request("https://league.internal/league", {
        method: request.method,
        headers: { "content-type": "application/json" },
        body: request.method === "POST" ? await request.text() : undefined,
      }));
    }

    return env.ASSETS.fetch(request);
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
        if (a?.playerId) online.add(a.playerId);
      } catch {}
    }
    for (const p of Object.values(this.room.players)) p.connected = online.has(p.id);
  }

  async persist() {
    if (this.room) await this.ctx.storage.put("room", this.room);
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/league") {
      const week = leagueWeekKey();
      let league = (await this.ctx.storage.get("league")) || { week, teams: {} };
      if (league.week !== week) league = { week, teams: {} };
      if (request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const team = cleanName(body.team).slice(0, 28);
        const points = Math.min(1_000_000, Math.max(0, Number(body.points) || 0));
        if (!team || !points) return json({ ok: false, error: "نتيجة غير صالحة" }, 400);
        const key = team.toLocaleLowerCase("ar");
        const existing = league.teams[key] || { name: team, points: 0, matches: 0, lastRoom: null };
        existing.name = team;
        existing.points += points;
        existing.matches += 1;
        existing.lastRoom = String(body.room || "").slice(0, 6) || null;
        league.teams[key] = existing;
        await this.ctx.storage.put("league", league);
      }
      const teams = Object.values(league.teams).sort((a, b) => b.points - a.points || b.matches - a.matches).slice(0, 50);
      return json({ ok: true, week, teams });
    }

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
        mode: [4,6,8].includes(Number(body.playerLimit)) ? `teams-${Number(body.playerLimit)}` : 'free',
        teamMode: normalizeTeamMode(body.teamMode, body.playerLimit),
        teamNames: { A: cleanName(body.teamA || "العباقرة الذهبي"), B: cleanName(body.teamB || "العباقرة البنفسجي") },
        teamPowers: { A: { hint: 1, combo: 1, revive: 1 }, B: { hint: 1, combo: 1, revive: 1 } },
        teamLives: { A: 3, B: 3 },
        teamFreezeNext: { A: false, B: false },
        teamProgress: { A: 0, B: 0 },
        relayStreak: { A: 0, B: 0 },
        playerLimit: [2,4,5,6,7,8].includes(Number(body.playerLimit)) ? Number(body.playerLimit) : 8,
        expiresAt: now + 24 * 60 * 60 * 1000,
      };
      await this.persist();
      await this.ctx.storage.setAlarm(this.room.expiresAt);
      return json({ ok: true }, 201);
    }

    if (url.pathname === "/status") {
      if (!this.room) return json({ ok: false, error: "الغرفة غير موجودة" }, 404);
      return json({ ok: true, status: this.room.status, players: this.room.order.length, mode: this.room.mode, teamMode: this.room.teamMode || "classic" });
    }

    if (url.pathname.endsWith("/ws")) {
      if (!this.room) return json({ ok: false, error: "الغرفة غير موجودة" }, 404);
      if (request.headers.get("Upgrade") !== "websocket") return json({ ok: false, error: "WebSocket required" }, 426);

      if (this.room.status === "lobby" && this.cleanupLobbySeats()) await this.persist();

      const name = cleanName(url.searchParams.get("name"));
      const { reconnectToken, hostKey, protocol } = webSocketAuth(request);
      if (!protocol) return json({ ok: false, error: "WebSocket protocol required" }, 426);
      if (url.searchParams.get("spectate") === "1" && this.room.status === "lobby") {
        return json({ ok: false, error: "المشاهدة تبدأ بعد بدء المباراة" }, 409);
      }
      if (url.searchParams.get("spectate") === "1" && this.room.status !== "lobby") {
        const pair = new WebSocketPair();
        const client = pair[0];
        const server = pair[1];
        this.ctx.acceptWebSocket(server);
        server.serializeAttachment({ spectator: true });
        server.send(JSON.stringify({ type: "welcome", spectator: true, playerId: null, state: this.publicState(null, true) }));
        return webSocketResponse(client, protocol);
      }
      let player = null;

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

      for (const old of this.ctx.getWebSockets()) {
        try {
          if (old.deserializeAttachment()?.playerId === player.id) old.close(4001, "reconnected");
        } catch {}
      }

      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({ playerId: player.id });
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
    const team = isTeamRoom(this.room)
      ? (this.room.order.length % 2 === 0 ? 'A' : 'B')
      : null;
    const teamSlot = team ? this.room.order.filter((existingId) => this.room.players[existingId]?.team === team).length : -1;
    const specialty = team && this.room.teamMode === "captain" && teamSlot > 0
      ? TEAM_SPECIALTIES[(teamSlot - 1 + TEAM_SPECIALTIES.length) % TEAM_SPECIALTIES.length]?.id || null
      : null;
    const p = {
      id,
      token: token(),
      name: cleanName(name),
      role,
      team,
      teamSlot,
      teamRole: team && this.room.teamMode === "captain" && teamSlot === 0 ? "captain" : (team ? "specialist" : null),
      specialty,
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
      return a?.playerId ? this.room?.players?.[a.playerId] : null;
    } catch {
      return null;
    }
  }

  teamMembers(team) {
    return this.room.order.filter((id) => this.room.players[id]?.team === team);
  }

  sendToPlayer(playerId, payload) {
    for (const socket of this.ctx.getWebSockets()) {
      try {
        if (socket.deserializeAttachment()?.playerId === playerId) {
          socket.send(JSON.stringify(payload));
          return true;
        }
      } catch {}
    }
    return false;
  }

  sendToTeam(team, payload, exceptId = null) {
    for (const socket of this.ctx.getWebSockets()) {
      try {
        const targetId = socket.deserializeAttachment()?.playerId;
        if (!targetId || targetId === exceptId || this.room.players[targetId]?.team !== team) continue;
        socket.send(JSON.stringify(payload));
      } catch {}
    }
  }

  forwardVoiceSignal(player, targetId, signal) {
    if (!isTeamRoom(this.room) || !player.team || !targetId || player.id === targetId) return;
    const target = this.room.players[targetId];
    if (!target || target.team !== player.team) return;
    const safeSignal = signal && typeof signal === "object" ? signal : null;
    if (!safeSignal || JSON.stringify(safeSignal).length > 3200) return;
    this.sendToPlayer(targetId, { type: "voice_signal", fromId: player.id, signal: safeSignal });
  }

  sendTeamReaction(player, reaction) {
    if (!isTeamRoom(this.room) || !player.team) return;
    const allowed = new Set(["highfive", "energy", "fire", "clap", "brain"]);
    if (!allowed.has(reaction)) return;
    this.sendToTeam(player.team, {
      type: "team_reaction",
      fromId: player.id,
      fromName: player.name,
      reaction,
      at: Date.now(),
    });
  }

  sendTeamVoiceLine(player, line) {
    if (!isTeamRoom(this.room) || !player.team) return;
    const lines = new Set(['bravo', 'focus', 'correct', 'wrong', 'hurry', 'nice']);
    if (!lines.has(line)) return;
    this.sendToTeam(player.team, {
      type: 'team_voice_line',
      fromId: player.id,
      fromName: player.name,
      line,
      at: Date.now(),
    });
  }

  async webSocketMessage(ws, raw) {
    if (!this.room) return;
    const player = this.playerForSocket(ws);
    if (!player) return;

    const rawText = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
    if (rawText.length > 4096) return this.sendError(ws, "الرسالة أكبر من المسموح");
    let msg;
    try { msg = JSON.parse(rawText); }
    catch { return this.sendError(ws, "رسالة غير صالحة"); }

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
          await this.persistAndBroadcast();
          break;

        case "start":
          if (player.role !== "host") return this.sendError(ws, "للمضيف فقط");
          if (this.room.status !== "lobby") return;
          if (this.room.order.length < 2) return this.sendError(ws, "يلزم لاعبان على الأقل");
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

        case "team_vote":
          await this.handleTeamVote(player, Number(msg.choice));
          break;

        case "team_power":
          await this.useTeamPower(player, String(msg.power || ""));
          break;

        case "team_ping":
          await this.teamPing(player, Number(msg.choice));
          break;

        case "voice_signal":
          this.forwardVoiceSignal(player, String(msg.targetId || ""), msg.signal);
          break;

        case "team_reaction":
          this.sendTeamReaction(player, String(msg.reaction || ""));
          break;

        case "team_voice_line":
          this.sendTeamVoiceLine(player, String(msg.line || ""));
          break;

        case "power":
          await this.usePower(player, String(msg.power || ""));
          break;

        case "rematch":
          if (player.role !== "host" || this.room.status !== "finished") return this.sendError(ws, "للمضيف فقط");
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
    const p = this.playerForSocket(ws);
    if (p) {
      p.connected = false;
      p.disconnectedAt = Date.now();
      this.room.updatedAt = Date.now();
      await this.persist();
      this.broadcastState();
      if (["lobby", "finished"].includes(this.room.status)) {
        await this.ctx.storage.setAlarm(Math.min(this.room.expiresAt, p.disconnectedAt + DISCONNECT_GRACE_MS));
      }
    }
  }

  async webSocketError(ws) {
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
      let attachment = null;
      try { attachment = ws.deserializeAttachment(); } catch {}
      const p = attachment?.playerId ? this.room.players[attachment.playerId] : null;
      if (!p && !attachment?.spectator) continue;
      try { ws.send(JSON.stringify({ type: "state", state: this.publicState(p?.id || null, Boolean(attachment?.spectator)) })); } catch {}
    }
  }

  publicState(playerId, spectator = false) {
    const me = this.room.players[playerId];
    const players = this.room.order.map((id) => {
      const p = this.room.players[id];
      return {
        id: p.id, name: p.name, role: p.role, score: p.score,
        team: p.team || null,
        teamRole: p.teamRole || null,
        specialty: p.specialty || null,
        ready: p.ready, connected: Boolean(p.connected),
        powers: p.id === playerId ? p.powers : {
          double: p.powers.double, time: p.powers.time, block: p.powers.block
        },
      };
    });

    const out = {
      code: this.room.code,
      status: this.room.status,
      mode: this.room.mode,
      teamMode: this.room.teamMode || "classic",
      teamModeLabel: teamModeLabel(this.room.teamMode || "classic"),
      teamNames: this.room.teamNames || { A: "العباقرة الذهبي", B: "العباقرة البنفسجي" },
      teamLives: this.room.teamLives || { A: 3, B: 3 },
      teamPowers: this.room.teamPowers || { A: { hint: 0, combo: 0, revive: 0 }, B: { hint: 0, combo: 0, revive: 0 } },
      teamProgress: this.room.teamProgress || { A: 0, B: 0 },
      relayStreak: this.room.relayStreak || { A: 0, B: 0 },
      teamScores: isTeamRoom(this.room) ? {
        A: this.room.order.reduce((sum, id) => sum + (this.room.players[id]?.team === 'A' ? this.room.players[id].score : 0), 0),
        B: this.room.order.reduce((sum, id) => sum + (this.room.players[id]?.team === 'B' ? this.room.players[id].score : 0), 0),
      } : null,
      selectedCategories: this.room.selectedCategories,
      categories: CATEGORIES.map((c) => ({ id: c.id, name: c.name, icon: c.icon, desc: c.desc })),
      players,
      me: me ? { id: me.id, role: me.role, team: me.team || null, teamRole: me.teamRole || null, specialty: me.specialty || null, powers: me.powers } : null,
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
        question: !spectator && this.room.teamMode === "escape" && playerId ? (c.escapeClues?.[playerId] || "جزء من الشفرة — تواصل مع فريقك") : c.question,
        sharedQuestion: this.room.teamMode === "escape" ? "اجمعوا أجزاء الشفرة من أعضاء فريقكم" : null,
        media: c.media || null,
        deadline: c.deadline,
        startedAt: c.startedAt,
        answerOpensAt: c.answerOpensAt || c.startedAt,
        buzzWinner: c.buzzWinner,
        stealPlayer: c.stealPlayer,
        answeredPlayers: Object.keys(c.answers || {}),
        blocked: Boolean(c.blocked?.[playerId]),
        relayPlayerId: c.relayPlayerByTeam?.[me?.team] || null,
        teamHinted: c.teamHints?.[me?.team] || [],
        teamFrozenUntil: c.teamFreezeUntil?.[me?.team] || 0,
        teamPing: c.teamPings?.[me?.team] || null,
        teamVote: c.teamVotes?.[me?.team] ? {
          counts: Object.values(c.teamVotes[me.team]).reduce((out, choice) => {
            const selected = Number(choice?.choice);
            out[selected] = (out[selected] || 0) + 1;
            return out;
          }, {}),
          submitted: Object.prototype.hasOwnProperty.call(c.teamVotes[me.team], playerId),
          total: this.room.order.filter((id) => this.room.players[id]?.team === me.team).length,
        } : null,
      };

      if (!spectator && c.mode === "secret" && c.phase === "secret") base.options = c.options;
      if (c.mode === "buzzer" && c.phase === "buzzer_answer" && c.buzzWinner === playerId) base.options = c.options;
      if (c.mode === "buzzer" && c.phase === "steal" && c.stealPlayer === playerId) base.options = c.options;
      out.current = base;
    }
    return out;
  }

  async startMatch() {
    this.room.status = "playing";
    if (this.room.teamMode === "relay") this.room.roundCount = 10;
    this.room.winnerId = null;
    this.room.lastReveal = null;
    this.room.roundIndex = -1;
    this.room.roundPlan = makePlan(this.room.selectedCategories, this.room.roundCount, this.room.recentQids || []);
    this.room.recentQids = [...new Set([
      ...this.room.roundPlan.map((x) => x.qid),
      ...(this.room.recentQids || []),
    ])].slice(0, 96);
    this.room.teamPowers = { A: { hint: 1, combo: 1, revive: 1 }, B: { hint: 1, combo: 1, revive: 1 } };
    this.room.teamLives = { A: 3, B: 3 };
    this.room.teamFreezeNext = { A: false, B: false };
    this.room.teamProgress = { A: 0, B: 0 };
    this.room.relayStreak = { A: 0, B: 0 };
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
    const relayPlayerByTeam = {};
    if (this.room.teamMode === "relay") {
      for (const team of ["A", "B"]) {
        const members = this.room.order.filter((id) => this.room.players[id]?.team === team);
        if (members.length) relayPlayerByTeam[team] = members[this.room.roundIndex % members.length];
      }
    }
    const teamFreezeUntil = {
      A: this.room.teamFreezeNext?.A ? now + 3000 : 0,
      B: this.room.teamFreezeNext?.B ? now + 3000 : 0,
    };
    this.room.teamFreezeNext = { A: false, B: false };
    const escapeClues = {};
    if (this.room.teamMode === "escape") {
      for (const team of ["A", "B"]) {
        const members = this.teamMembers(team);
        const words = String(q.q || "").split(/\s+/).filter(Boolean);
        members.forEach((id, index) => {
          const part = words.filter((_, wordIndex) => wordIndex % Math.max(1, members.length) === index).join(" ");
          escapeClues[id] = `جزءك من الشفرة: ${part || "تواصل مع فريقك"}`;
        });
      }
    }
    this.room.current = {
      mode: plan.mode,
      phase: isSecret ? "secret" : "buzzer",
      category: { id: cat.id, name: cat.name, icon: cat.icon },
      value: q.v,
      question: q.q,
      escapeClues,
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
      teamVotes: { A: {}, B: {} },
      teamAnswers: { A: null, B: null },
      teamResolved: { A: false, B: false },
      teamPings: { A: null, B: null },
      teamHints: { A: [], B: [] },
      teamCombo: { A: false, B: false },
      teamRevive: { A: false, B: false },
      teamFreezeUntil,
      relayPlayerByTeam,
      buzzWinner: null,
      stealPlayer: null,
      double: {},
      blocked: {},
    };
    await this.persistAndBroadcast();
    await this.ctx.storage.setAlarm(this.room.current.deadline);
  }

  allowedToAnswer(playerId) {
    const c = this.room.current;
    if (!c) return false;
    if (c.mode === "secret" && c.phase === "secret") return !c.answers[playerId];
    if (c.mode === "buzzer" && c.phase === "buzzer_answer") return c.buzzWinner === playerId;
    if (c.mode === "buzzer" && c.phase === "steal") return c.stealPlayer === playerId;
    return false;
  }

  async handleTeamVote(player, choice) {
    const c = this.room.current;
    if (!isTeamRoom(this.room) || this.room.status !== "playing" || !c || c.mode !== "secret" || c.phase !== "secret") return;
    if (!player.team || !Number.isInteger(choice) || choice < 0 || choice >= c.options.length) return;
    const now = Date.now();
    if (now < (c.answerOpensAt || c.startedAt || 0) || now > c.deadline + 1200) return;
    if (c.teamFreezeUntil?.[player.team] > now) return this.sendErrorForPlayer(player.id, "الفريق المنافس جمّد فريقك لثوانٍ قليلة");
    if (c.teamHints?.[player.team]?.includes(choice)) return this.sendErrorForPlayer(player.id, "هذا الخيار استبعده تلميح الفريق");
    const activeRelay = c.relayPlayerByTeam?.[player.team];
    if (this.room.teamMode === "relay" && activeRelay && activeRelay !== player.id) {
      return this.sendErrorForPlayer(player.id, "الدور الآن لزميلك في التتابع");
    }
    const votes = c.teamVotes[player.team] || (c.teamVotes[player.team] = {});
    if (votes[player.id]) return;
    votes[player.id] = { choice, at: now };
    const required = this.room.teamMode === "relay" && activeRelay ? [activeRelay] : this.teamMembers(player.team);
    if (required.every((id) => votes[id])) {
      const counts = new Map();
      for (const id of required) {
        const vote = votes[id];
        counts.set(vote.choice, (counts.get(vote.choice) || 0) + 1);
      }
      const highest = Math.max(...counts.values());
      const tied = [...counts.entries()].filter(([, count]) => count === highest).map(([option]) => Number(option));
      const captain = this.teamMembers(player.team).find((id) => this.room.players[id]?.teamRole === "captain");
      const captainChoice = captain && votes[captain] ? votes[captain].choice : null;
      const selected = tied.includes(captainChoice) ? captainChoice : tied.sort((a, b) => (votes[required.find((id) => votes[id]?.choice === a)]?.at || 0) - (votes[required.find((id) => votes[id]?.choice === b)]?.at || 0))[0];
      c.teamAnswers[player.team] = { choice: selected, at: Math.max(...required.map((id) => votes[id].at)), contributors: required };
      c.teamResolved[player.team] = true;
      for (const id of required) c.answers[id] = { choice: selected, at: votes[id].at, bonus: speedBonus(c.deadline, votes[id].at) };
    }
    if (["A", "B"].every((team) => c.teamResolved[team])) await this.finalizeTeamSecret();
    else await this.persistAndBroadcast();
  }

  sendErrorForPlayer(playerId, message) {
    this.sendToPlayer(playerId, { type: "error", message });
  }

  async teamPing(player, choice) {
    const c = this.room.current;
    if (!isTeamRoom(this.room) || !player.team || !c || c.mode !== "secret" || !Number.isInteger(choice) || choice < 0 || choice >= c.options.length) return;
    const now = Date.now();
    c.teamPings[player.team] = { choice, fromId: player.id, fromName: player.name, at: now };
    this.sendToTeam(player.team, { type: "team_ping", fromId: player.id, fromName: player.name, choice, at: now });
    await this.persistAndBroadcast();
  }

  async handleAnswer(player, choice) {
    const c = this.room.current;
    if (this.room.status !== "playing" || !c || !this.allowedToAnswer(player.id)) return;
    if (isTeamRoom(this.room) && c.mode === "secret") return this.handleTeamVote(player, choice);
    if (!Number.isInteger(choice) || choice < 0 || choice >= c.options.length) return;
    const now = Date.now();
    if (now < (c.answerOpensAt || c.startedAt || 0)) return;
    if (now > c.deadline + 1200) return;

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
        const opponentId = this.room.order.find((id) => id !== player.id);
        if (c.blocked?.[opponentId]) {
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
    if (Date.now() > c.deadline) return;
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
      const opponentId = this.room.order.find((id) => id !== player.id);
      if (!opponentId) return;
      c.blocked[opponentId] = true;
    }

    player.powers[power] = false;
    await this.persistAndBroadcast();
  }

  async useTeamPower(player, power) {
    const c = this.room.current;
    if (!isTeamRoom(this.room) || this.room.status !== "playing" || !c || !player.team) return;
    if (!['hint', 'combo', 'revive'].includes(power)) return;
    if (Date.now() < (c.answerOpensAt || c.startedAt || 0)) return;
    if (this.room.teamMode === "captain" && power === "combo" && player.teamRole !== "captain") {
      return this.sendErrorForPlayer(player.id, "قدرة الهجوم الجماعي للقائد فقط");
    }
    const pool = this.room.teamPowers?.[player.team];
    if (!pool || Number(pool[power] || 0) < 1) return this.sendErrorForPlayer(player.id, "استخدم فريقك هذه القدرة سابقًا");
    if (power === "hint") {
      if (c.teamResolved?.[player.team]) return;
      const wrong = c.options.map((_, index) => index).filter((index) => index !== c.correctIndex).slice(0, 2);
      c.teamHints[player.team] = wrong;
    } else if (power === "combo") {
      if (c.teamResolved?.[player.team]) return;
      c.teamCombo[player.team] = true;
    } else if (power === "revive") {
      if (player.score < 1 || c.teamResolved?.[player.team]) return this.sendErrorForPlayer(player.id, "تحتاج نقاطًا لاستخدام الإنعاش");
      player.score = Math.floor(player.score / 2);
      c.teamRevive[player.team] = true;
      this.room.teamLives[player.team] = Math.min(3, Number(this.room.teamLives[player.team] || 0) + 1);
    }
    pool[power] -= 1;
    await this.persistAndBroadcast();
  }

  async finalizeTeamSecret() {
    const c = this.room.current;
    if (!c || c.mode !== "secret" || !isTeamRoom(this.room)) return;
    this.room.teamFreezeNext ||= { A: false, B: false };
    this.room.teamProgress ||= { A: 0, B: 0 };
    this.room.relayStreak ||= { A: 0, B: 0 };
    this.room.teamLives ||= { A: 3, B: 3 };
    const results = Object.fromEntries(this.room.order.map((id) => [id, { correct: false, gain: 0, choice: null }]));
    for (const team of ["A", "B"]) {
      const answer = c.teamAnswers?.[team];
      const members = this.teamMembers(team);
      const contributors = answer?.contributors || [];
      const correct = Boolean(answer && answer.choice === c.correctIndex);
      let gain = correct ? c.value + speedBonus(c.deadline, answer.at || Date.now()) : 0;
      const specialist = contributors.some((id) => {
        const specialty = TEAM_SPECIALTIES.find((item) => item.id === this.room.players[id]?.specialty);
        return specialty?.categories.includes(c.category.id);
      });
      if (correct && this.room.teamMode === "captain" && specialist) gain *= 2;
      const times = contributors.map((id) => c.teamVotes?.[team]?.[id]?.at).filter(Boolean);
      const combo = Boolean(correct && c.teamCombo?.[team] && times.length > 1 && Math.max(...times) - Math.min(...times) <= 3000);
      if (combo) {
        gain += 100;
        this.room.teamFreezeNext[team === "A" ? "B" : "A"] = true;
      }
      if (correct) {
        this.room.teamProgress[team] = Math.min(10, Number(this.room.teamProgress[team] || 0) + 1);
        this.room.relayStreak[team] = Number(this.room.relayStreak[team] || 0) + 1;
      } else {
        this.room.relayStreak[team] = 0;
        if (this.room.teamMode === "escape") {
          if (c.teamRevive?.[team]) c.teamRevive[team] = false;
          else this.room.teamLives[team] = Math.max(0, Number(this.room.teamLives[team] || 0) - 1);
        }
      }
      const share = members.length ? Math.floor(gain / members.length) : 0;
      let remainder = members.length ? gain - share * members.length : 0;
      for (const id of members) {
        const playerGain = share + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder -= 1;
        if (playerGain) this.room.players[id].score += playerGain;
        results[id] = { correct, gain: playerGain, choice: answer?.choice ?? null, combo, specialist };
      }
    }
    await this.revealRound(results);
  }

  pointsFor(playerId, answer) {
    const c = this.room.current;
    let pts = c.value + (answer?.bonus ?? speedBonus(c.deadline, answer?.at || Date.now()));
    if (c.double[playerId]) pts *= 2;
    const player = this.room.players[playerId];
    const specialty = TEAM_SPECIALTIES.find((item) => item.id === player?.specialty);
    if (isTeamRoom(this.room) && this.room.teamMode === "captain" && specialty?.categories.includes(c.category.id)) pts *= 2;
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

  async recordLeagueScores(totals) {
    if (!this.env.ROOMS || !this.room?.teamNames) return;
    try {
      const league = this.env.ROOMS.get(this.env.ROOMS.idFromName("__weekly-league__"));
      for (const item of totals) {
        await league.fetch("https://league.internal/league", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ team: this.room.teamNames[item.team], points: item.score, room: this.room.code }),
        });
      }
    } catch (error) {
      console.error("league score failed", error);
    }
  }

  async finishMatch() {
    this.room.status = "finished";
    this.room.current = null;
    this.room.lastReveal = null;
    if (isTeamRoom(this.room)) {
      const totals = ['A','B'].map(team => ({team, score:this.room.order.reduce((s,id)=>s+(this.room.players[id]?.team===team?this.room.players[id].score:0),0)})).sort((a,b)=>b.score-a.score);
      this.room.winnerId = totals[0].score === totals[1].score ? null : `team:${totals[0].team}`;
      this.room.expiresAt = Date.now() + 24 * 60 * 60 * 1000;
      await this.recordLeagueScores(totals);
      await this.persistAndBroadcast(); await this.scheduleLobbyAlarm(); return;
    }
    const ranked = this.room.order.map((id) => this.room.players[id]).filter(Boolean).sort((x,y)=>(y.score||0)-(x.score||0));
    const top = ranked[0], tied = ranked.filter(p => (p.score||0) === (top?.score||0));
    this.room.winnerId = tied.length === 1 ? top.id : null;
    this.room.expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    await this.persistAndBroadcast();
    await this.scheduleLobbyAlarm();
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
      if (isTeamRoom(this.room)) await this.finalizeTeamSecret();
      else await this.finalizeSecret();
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

export { MatchmakingRoom };


export class BoardRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.room = null;
    this.social = new BoardSocialUser(ctx, env);
    this.ctx.blockConcurrencyWhile(async () => {
      this.room = (await this.ctx.storage.get("room")) || null;
      this.syncConnected();
    });
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
  }

  addPlayer(name, role) {
    const id = crypto.randomUUID();
    const p = { id, token: token(), name: cleanName(name), role, ready: false, connected: true, disconnectedAt: null, lastSpotClickAt: 0 };
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
    // Rejection sampling avoids modulo bias; repeated faces are deliberately
    // preserved so the server never massages a legitimate result.
    const ceiling = 0x1_0000_0000 - (0x1_0000_0000 % 6);
    const sample = new Uint32Array(1);
    do crypto.getRandomValues(sample); while (sample[0] >= ceiling);
    return (sample[0] % 6) + 1;
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
      serverNow: Date.now(),
      playerLimit: this.room.playerLimit,
      status: this.room.status,
      version: this.room.version || 0,
      players: this.room.order.map((id, index) => {
        const p = this.room.players[id];
        return { id: p.id, index, name: p.name, role: p.role, ready: Boolean(p.ready), connected: Boolean(p.connected) };
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
    if (this.room.status === "playing" && this.room.turnDeadline) candidates.push(this.room.turnDeadline);
    if (["lobby", "finished"].includes(this.room.status)) {
      for (const id of this.room.order) {
        const p = this.room.players[id];
        if (!p?.connected && p?.disconnectedAt) candidates.push(p.disconnectedAt + DISCONNECT_GRACE_MS);
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
    if (url.hostname === "social.internal") return this.social.fetch(request);
    if (url.pathname === "/init" && request.method === "POST") {
      if (this.room) return json({ ok: false, error: "room_exists" }, 409);
      const body = await request.json();
      const game = String(body.game || "");
      if (!["snakes", "zahra", "jackaroo", "spotdiff"].includes(game)) return json({ ok: false, error: "invalid_game" }, 400);
      const now = Date.now();
      this.room = {
        code: body.code, hostKey: body.hostKey, game,
        playerLimit: game === "jackaroo" ? 4 : game === "spotdiff" ? 2 : Math.min(4, Math.max(2, Number(body.playerLimit) || 2)),
        createdAt: now, updatedAt: now, expiresAt: now + 24 * 60 * 60 * 1000,
        status: "lobby", players: {}, order: [], state: null, pendingRoll: null, turnDeadline: null, version: 0,
      };
      await this.persist();
      await this.scheduleNextAlarm();
      return json({ ok: true }, 201);
    }

    if (url.pathname === "/status") {
      if (!this.room) return json({ ok: false, error: "الغرفة غير موجودة" }, 404);
      return json({ ok: true, game: this.room.game, status: this.room.status, players: this.room.order.length, playerLimit: this.room.playerLimit });
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
      if (ws.deserializeAttachment()?.username) return this.social.webSocketMessage(ws, raw);
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
        return await this.startGame(msg);
      }
      if (msg.type === "rematch") {
        if (player.role !== "host") return this.sendError(ws, "الإعادة للمضيف فقط");
        if (this.room.status !== "finished") return;
        return await this.resetForRematch();
      }
      if (this.room.status !== "playing" || !this.room.state) return this.sendError(ws, "المباراة غير نشطة");
      const actor = this.playerIndex(player.id);
      if (actor !== this.room.state.turn && !["jackaroo", "spotdiff"].includes(this.room.game)) return this.sendError(ws, "مو دورك الآن");
      if (this.room.game === "snakes" && msg.type === "roll") {
        if (actor !== this.room.state.turn) return this.sendError(ws, "مو دورك الآن");
        const roll = this.randomDie();
        this.room.state = playSnakesRoll(this.room.state, roll);
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
      if (this.room.game === "spotdiff" && msg.type === "spotdiff_click") {
        if (this.room.turnDeadline && Date.now() >= this.room.turnDeadline) {
          await this.handleTurnTimeout();
          return;
        }
        const clickedAt = Date.now();
        if (clickedAt - Number(player.lastSpotClickAt || 0) < SPOTDIFF_CLICK_COOLDOWN_MS) {
          return this.sendError(ws, "تمهّل قليلًا بين المحاولات");
        }
        if (Number(this.room.state.misses?.[actor] || 0) >= 5) return this.sendError(ws, "انتهت محاولاتك");
        player.lastSpotClickAt = clickedAt;
        this.room.state = playSpotDiffClick(this.room.state, actor, Number(msg.x), Number(msg.y));
        this.room.version++;
        if (this.room.state.winner !== null) this.finishGame();
        return await this.saveAndBroadcast();
      }
      this.sendError(ws, "أمر غير معروف");
    } catch (err) {
      console.error("board room message error", err);
      this.sendError(ws, "تعذر تنفيذ الحركة");
    }
  }

  async startGame(options = {}) {
    const names = this.room.order.map((id) => this.room.players[id].name);
    if (this.room.game === "snakes") this.room.state = createSnakesGame(names);
    else if (this.room.game === "zahra") this.room.state = createLudoGame(names);
    else if (this.room.game === "jackaroo") this.room.state = createJackarooGame(names);
    else this.room.state = createSpotDiffGame(names.length, options.difficulty);
    this.room.status = "playing";
    this.room.pendingRoll = null;
    this.room.version++;
    this.setTurnDeadline(this.room.game === "spotdiff" ? this.room.state.duration : TURN_TIMEOUT_MS);
    for (const id of this.room.order) {
      this.room.players[id].ready = true;
      this.room.players[id].lastSpotClickAt = 0;
    }
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
    if (this.room.game === "spotdiff") {
      this.room.state = finishSpotDiffGame(this.room.state);
      this.room.version++;
      this.finishGame();
      return await this.saveAndBroadcast();
    }
    const actor = this.room.state.turn;
    if (this.room.game === "snakes") {
      this.room.state = playSnakesRoll(this.room.state, this.randomDie());
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
      if (ws.deserializeAttachment()?.username) return this.social.webSocketClose(ws, code, reason);
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
      if (ws.deserializeAttachment()?.username) return this.social.webSocketError(ws);
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
    if (["lobby", "finished"].includes(this.room.status) && this.cleanupStaleLobbyGuests()) {
      await this.persist();
      this.broadcast();
    }
    await this.scheduleNextAlarm();
  }
}
