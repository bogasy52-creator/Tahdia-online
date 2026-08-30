
import { DurableObject } from "cloudflare:workers";
import { CATEGORIES } from "./questions.js";
import { BoardGameRoom as BoardGameRoomBase } from "./rooms/board-game-room.js";

const CATEGORY_MAP = new Map(CATEGORIES.map((c) => [c.id, c]));
const ROOM_RE = /^\d{6}$/;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "GET,POST,OPTIONS",
    },
  });
}

function cleanName(value) {
  return String(value || "").trim().replace(/[<>]/g, "").slice(0, 20) || "لاعب";
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
  const wrong = shuffle(
    [...new Set(cat.questions.filter((x) => x.a !== q.a).map((x) => x.a))]
  ).slice(0, 3);
  const options = shuffle([q.a, ...wrong]);
  return { options, correctIndex: options.indexOf(q.a) };
}

function questionRef(cat, q) {
  return `${cat.id}:${cat.questions.indexOf(q)}`;
}

function makePlan(categoryIds, rounds = 12) {
  const chosen = categoryIds.map((id) => CATEGORY_MAP.get(id)).filter(Boolean);
  const plan = [];
  const perCategory = Math.max(1, Math.floor(rounds / chosen.length));
  for (const cat of chosen) {
    const values = shuffle([100, 200, 300]);
    for (let i = 0; i < perCategory; i++) {
      const v = values[i % values.length];
      const pool = cat.questions.filter((q) => q.v === v);
      const q = pick(pool);
      plan.push({ catId: cat.id, qid: questionRef(cat, q) });
    }
  }
  while (plan.length < rounds) {
    const cat = pick(chosen);
    const unused = cat.questions.filter((q) => !plan.some((p) => p.qid === questionRef(cat, q)));
    const q = pick(unused.length ? unused : cat.questions);
    plan.push({ catId: cat.id, qid: questionRef(cat, q) });
  }
  return shuffle(plan.slice(0, rounds)).map((x, i) => ({ ...x, mode: i % 2 === 0 ? "secret" : "buzzer" }));
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

    if (request.method === "GET" && url.pathname === "/api/health") {
      if (!env.ROOMS) {
        return json({ ok: false, online: false, error: "ROOMS binding missing", version: "2.0.0" }, 503);
      }
      return json({ ok: true, online: true, service: "tahadi-alabaqera-online", version: "2.0.0" });
    }

    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "content-type",
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-max-age": "86400",
        },
      });
    }

    if (request.method === "POST" && url.pathname === "/api/rooms") {
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

    if (request.method === "POST" && url.pathname === "/api/games/rooms") {
      if (!env.BOARD_ROOMS) return json({ ok: false, error: "محرك ألعاب الطاولة غير مفعّل على السيرفر" }, 503);
      try {
        let body = {};
        try { body = await request.json(); } catch {}
        const gameType = body.gameType === "jackaroo" ? "jackaroo" : body.gameType === "snakes" ? "snakes" : "";
        if (!gameType) return json({ ok: false, error: "نوع اللعبة غير صالح" }, 400);
        const name = cleanName(body.name);
        for (let attempt = 0; attempt < 10; attempt++) {
          const code = roomCode();
          const id = env.BOARD_ROOMS.idFromName(code);
          const stub = env.BOARD_ROOMS.get(id);
          const hostKey = token();
          const hostToken = token();
          const hostPlayerId = crypto.randomUUID();
          const res = await stub.fetch("https://board-room.internal/init", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ code, gameType, hostKey, hostToken, hostPlayerId, name }),
          });
          if (res.status === 201) return json({ ok: true, code, gameType, token: hostToken, hostKey, playerId: hostPlayerId });
        }
        return json({ ok: false, error: "تعذر إنشاء غرفة الآن" }, 503);
      } catch (err) {
        console.error("create board room failed", err);
        return json({ ok: false, error: "تعذر تشغيل محرك ألعاب الطاولة" }, 503);
      }
    }

    const boardMatch = url.pathname.match(/^\/api\/games\/rooms\/(\d{6})(\/ws|\/status)?$/);
    if (boardMatch) {
      if (!env.BOARD_ROOMS) return json({ ok: false, error: "محرك ألعاب الطاولة غير مفعّل على السيرفر" }, 503);
      try {
        const code = boardMatch[1];
        const suffix = boardMatch[2] || "/status";
        const id = env.BOARD_ROOMS.idFromName(code);
        const stub = env.BOARD_ROOMS.get(id);
        if (suffix === "/ws") return stub.fetch(request);
        return stub.fetch("https://board-room.internal/status");
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

export class BoardGameRoom extends BoardGameRoomBase {}

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

      const name = cleanName(url.searchParams.get("name"));
      const reconnectToken = url.searchParams.get("token") || "";
      const hostKey = url.searchParams.get("hostKey") || "";
      let player = null;

      if (reconnectToken) {
        player = Object.values(this.room.players).find((p) => p.token === reconnectToken) || null;
      }

      if (!player && hostKey && hostKey === this.room.hostKey) {
        player = Object.values(this.room.players).find((p) => p.role === "host") || null;
        if (!player) player = this.addPlayer(name, "host");
      }

      if (!player) {
        if (this.room.order.length >= 2) return json({ ok: false, error: "الغرفة ممتلئة" }, 409);
        player = this.addPlayer(name, this.room.order.length === 0 ? "host" : "guest");
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
      this.room.updatedAt = Date.now();
      await this.persist();

      server.send(JSON.stringify({
        type: "welcome",
        playerId: player.id,
        token: player.token,
        state: this.publicState(player.id),
      }));
      this.broadcastState();

      return new Response(null, { status: 101, webSocket: client });
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

        case "random_categories":
          if (player.role !== "host" || this.room.status !== "lobby") return this.sendError(ws, "للمضيف فقط");
          this.room.selectedCategories = shuffle(CATEGORIES.map((c) => c.id)).slice(0, 6);
          await this.persistAndBroadcast();
          break;

        case "start":
          if (player.role !== "host") return this.sendError(ws, "للمضيف فقط");
          if (this.room.status !== "lobby") return;
          if (this.room.order.length !== 2) return this.sendError(ws, "يلزم لاعبان");
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
      this.room.updatedAt = Date.now();
      await this.persist();
      this.broadcastState();
    }
  }

  async webSocketError(ws) {
    await this.webSocketClose(ws);
  }

  sendError(ws, message) {
    try { ws.send(JSON.stringify({ type: "error", message })); } catch {}
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
    this.room.roundPlan = makePlan(this.room.selectedCategories, this.room.roundCount);
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
    this.room.current = {
      mode: plan.mode,
      phase: isSecret ? "secret" : "buzzer",
      category: { id: cat.id, name: cat.name, icon: cat.icon },
      value: q.v,
      question: q.q,
      media: q.media ? { type: q.media, src: q.src, zoom: q.zoom || null, credit: q.credit || "" } : null,
      options,
      correctIndex,
      correctAnswer: q.a,
      deadline: now + (isSecret ? 30000 : 15000),
      startedAt: now,
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
    await this.ctx.storage.setAlarm(this.room.expiresAt);
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
  }

  async alarm() {
    if (!this.room) return;
    const now = Date.now();

    if (this.room.status === "finished" && now >= this.room.expiresAt) {
      await this.ctx.storage.deleteAll();
      this.room = null;
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
