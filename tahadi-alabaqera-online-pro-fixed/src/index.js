
import { DurableObject } from "cloudflare:workers";
import { CATEGORIES } from "./questions.js";
import { createSnakesGame, playSnakesRoll } from "../public/assets/js/engines/snakes-engine.js";
import { createLudoGame, getLegalLudoMoves, applyLudoMove, passLudoTurn } from "../public/assets/js/engines/ludo-engine.js";
import { createJackarooGame, getJackarooActions, playJackarooAction } from "../public/assets/js/engines/jackaroo-engine.js";
import { handleSocialRequest } from "./social/social-api.js";
import { createSocialUserClass } from "./social/social-user.js";

class SocialDelegateBase {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; }
}
const BoardSocialUser = createSocialUserClass(SocialDelegateBase);

const CATEGORY_MAP = new Map(CATEGORIES.map((c) => [c.id, c]));
const ROOM_RE = /^\d{6}$/;
const DISCONNECT_GRACE_MS = 45_000;
const TURN_TIMEOUT_MS = 60_000;
const MOVE_TIMEOUT_MS = 25_000;
const RATE_BUCKETS = new Map();

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
      const socialOnline = Boolean(env.SOCIAL_USERS || env.BOARD_ROOMS);
      if (!quizOnline || !boardOnline) {
        return json({ ok: false, online: false, quizOnline, boardOnline, socialOnline, error: "Durable Object binding missing", version: "3.2.0" }, 503);
      }
      return json({ ok: true, online: true, quizOnline, boardOnline, socialOnline, service: "tahadi-alabaqera-online", version: "3.2.0" });
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
            body: JSON.stringify({ code, hostKey, name }),
          });
          if (res.status === 201) return json({ ok: true, code, hostKey });
        }
        return json({ ok: false, error: "تعذر إنشاء غرفة الآن" }, 503);
      } catch (err) {
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
        if (!["snakes", "zahra", "jackaroo"].includes(game)) return json({ ok: false, error: "اللعبة غير مدعومة" }, 400);
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
        if (this.room.order.length >= 2) return json({ ok: false, error: "الغرفة ممتلئة — اللاعب المنقطع لديه مهلة للعودة" }, 409);
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
    const p = {
      id,
      token: token(),
      name: cleanName(name),
      role,
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
          if (this.room.order.length !== 2) return this.sendError(ws, "يلزم لاعبان");
          if (!this.room.order.every((id) => this.room.players[id]?.connected)) return this.sendError(ws, "انتظر اتصال اللاعبين");
          if (!this.room.order.every((id) => this.room.players[id]?.ready)) return this.sendError(ws, "اللاعبان لازم يكونان جاهزين");
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
        id: p.id, name: p.name, role: p.role, score: p.score,
        ready: p.ready, connected: Boolean(p.connected),
        powers: p.id === playerId ? p.powers : {
          double: p.powers.double, time: p.powers.time, block: p.powers.block
        },
      };
    });

    const out = {
      code: this.room.code,
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
    this.room.status = "finished";
    this.room.current = null;
    this.room.lastReveal = null;
    const [a, b] = this.room.order;
    if (a && b) {
      const sa = this.room.players[a].score;
      const sb = this.room.players[b].score;
      this.room.winnerId = sa === sb ? null : (sa > sb ? a : b);
    }
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
      if (!["snakes", "zahra", "jackaroo"].includes(game)) return json({ ok: false, error: "invalid_game" }, 400);
      const now = Date.now();
      this.room = {
        code: body.code, hostKey: body.hostKey, game,
        playerLimit: game === "jackaroo" ? 4 : Math.min(4, Math.max(2, Number(body.playerLimit) || 2)),
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
        return await this.startGame();
      }
      if (msg.type === "rematch") {
        if (player.role !== "host") return this.sendError(ws, "الإعادة للمضيف فقط");
        if (this.room.status !== "finished") return;
        return await this.resetForRematch();
      }
      if (this.room.status !== "playing" || !this.room.state) return this.sendError(ws, "المباراة غير نشطة");
      const actor = this.playerIndex(player.id);
      if (actor !== this.room.state.turn && this.room.game !== "jackaroo") return this.sendError(ws, "مو دورك الآن");
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
      this.sendError(ws, "أمر غير معروف");
    } catch (err) {
      console.error("board room message error", err);
      this.sendError(ws, "تعذر تنفيذ الحركة");
    }
  }

  async startGame() {
    const names = this.room.order.map((id) => this.room.players[id].name);
    if (this.room.game === "snakes") this.room.state = createSnakesGame(names);
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
