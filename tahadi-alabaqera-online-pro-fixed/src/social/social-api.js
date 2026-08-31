import {
  cleanDisplayName,
  normalizeGame,
  normalizeRoomCode,
  normalizeUsername,
  parseSessionToken,
  validUsername,
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

function socialNamespace(env) {
  return env?.SOCIAL_USERS || env?.BOARD_ROOMS || null;
}

function socialObjectName(env, username) {
  const normalized = normalizeUsername(username);
  return env?.SOCIAL_USERS ? `user:${normalized}` : `social:user:${normalized}`;
}

function stubFor(env, username) {
  const namespace = socialNamespace(env);
  if (!namespace) return null;
  const normalized = normalizeUsername(username);
  if (!validUsername(normalized)) return null;
  return namespace.get(namespace.idFromName(socialObjectName(env, normalized)));
}

async function readJson(response) {
  return response.json().catch(() => ({}));
}

function bearer(request) {
  const value = String(request.headers.get("authorization") || "");
  return value.toLowerCase().startsWith("bearer ") ? value.slice(7).trim() : "";
}

async function authenticate(request, env) {
  const parsed = parseSessionToken(bearer(request));
  if (!parsed) return null;
  const stub = stubFor(env, parsed.username);
  if (!stub) return null;
  const response = await stub.fetch("https://social.internal/validate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ secret: parsed.secret }),
  });
  if (!response.ok) return null;
  const data = await readJson(response);
  return { ...parsed, stub, profile: data.profile };
}

async function requireAuth(request, env) {
  const auth = await authenticate(request, env);
  if (!auth) return { response: json({ ok: false, error: "unauthorized" }, 401), auth: null };
  return { response: null, auth };
}

async function publicProfile(env, username) {
  const stub = stubFor(env, username);
  if (!stub) return null;
  const response = await stub.fetch("https://social.internal/public");
  if (!response.ok) return null;
  const data = await readJson(response);
  return data.profile || null;
}

async function call(stub, path, body = {}) {
  const response = await stub.fetch(`https://social.internal${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { response, data: await readJson(response) };
}

async function validateInviteRoom(env, game, roomCode) {
  const namespace = game === "quiz" ? env?.ROOMS : env?.BOARD_ROOMS;
  if (!namespace) return { ok: false, status: 503, error: "محرك الغرفة غير متاح" };
  try {
    const stub = namespace.get(namespace.idFromName(roomCode));
    const response = await stub.fetch(game === "quiz" ? "https://room.internal/status" : "https://board.internal/status");
    const data = await readJson(response);
    if (!response.ok || !data.ok) return { ok: false, status: 404, error: "الغرفة غير موجودة" };
    if (game !== "quiz" && data.game !== game) return { ok: false, status: 409, error: "رمز الغرفة يخص لعبة أخرى" };
    if (data.status !== "lobby") return { ok: false, status: 409, error: "لا يمكن إرسال دعوة بعد بدء المباراة" };
    return { ok: true };
  } catch {
    return { ok: false, status: 503, error: "تعذر التحقق من الغرفة" };
  }
}

export async function handleSocialRequest(request, env, options = {}) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/social")) return null;
  if (!socialNamespace(env)) return json({ ok: false, error: "نظام الأصدقاء غير مفعّل على السيرفر" }, 503);

  const authPath = ["/api/social/signup", "/api/social/login"].includes(url.pathname);
  const limited = options.rateLimit
    ? await options.rateLimit(request, env, authPath ? "social-auth" : "social-api", authPath ? 30 : 180, 60_000)
    : null;
  if (limited) return limited;

  if (request.method === "POST" && url.pathname === "/api/social/signup") {
    const body = await request.json().catch(() => ({}));
    const username = normalizeUsername(body.username);
    const stub = stubFor(env, username);
    if (!stub) return json({ ok: false, error: "اسم المستخدم غير صالح" }, 400);
    return stub.fetch("https://social.internal/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, displayName: body.displayName, password: body.password }),
    });
  }

  if (request.method === "POST" && url.pathname === "/api/social/login") {
    const body = await request.json().catch(() => ({}));
    const username = normalizeUsername(body.username);
    const stub = stubFor(env, username);
    if (!stub) return json({ ok: false, error: "بيانات الدخول غير صحيحة" }, 401);
    return stub.fetch("https://social.internal/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: body.password }),
    });
  }

  if (request.method === "POST" && url.pathname === "/api/social/logout") {
    const parsed = parseSessionToken(bearer(request));
    if (!parsed) return json({ ok: true });
    const stub = stubFor(env, parsed.username);
    if (stub) await call(stub, "/logout", { secret: parsed.secret });
    return json({ ok: true });
  }

  if (request.method === "GET" && url.pathname === "/api/social/me") {
    const { response, auth } = await requireAuth(request, env);
    if (response) return response;
    const result = await call(auth.stub, "/dashboard", { secret: auth.secret });
    return json(result.data, result.response.status);
  }

  const profileMatch = url.pathname.match(/^\/api\/social\/users\/([a-zA-Z0-9_]{3,20})$/);
  if (request.method === "GET" && profileMatch) {
    const profile = await publicProfile(env, profileMatch[1]);
    return profile ? json({ ok: true, profile }) : json({ ok: false, error: "الحساب غير موجود" }, 404);
  }

  if (request.method === "POST" && url.pathname === "/api/social/friends/request") {
    const { response, auth } = await requireAuth(request, env);
    if (response) return response;
    const body = await request.json().catch(() => ({}));
    const targetUsername = normalizeUsername(body.username);
    if (!validUsername(targetUsername) || targetUsername === auth.username) return json({ ok: false, error: "اسم المستخدم غير صالح" }, 400);
    const targetProfile = await publicProfile(env, targetUsername);
    if (!targetProfile) return json({ ok: false, error: "الحساب غير موجود" }, 404);
    const targetStub = stubFor(env, targetUsername);
    const inbound = await call(targetStub, "/friend/incoming", { username: auth.username, displayName: auth.profile.displayName });
    if (!inbound.response.ok) return json(inbound.data, inbound.response.status);
    if (inbound.data.alreadyFriends) return json({ ok: true, alreadyFriends: true });
    const outgoing = await call(auth.stub, "/friend/outgoing", { username: targetUsername, displayName: targetProfile.displayName });
    if (!outgoing.response.ok) {
      await call(targetStub, "/friend/remove-incoming", { username: auth.username });
      return json(outgoing.data, outgoing.response.status);
    }
    return json({ ok: true, request: { username: targetUsername, displayName: targetProfile.displayName } }, 201);
  }

  if (request.method === "POST" && url.pathname === "/api/social/friends/respond") {
    const { response, auth } = await requireAuth(request, env);
    if (response) return response;
    const body = await request.json().catch(() => ({}));
    const otherUsername = normalizeUsername(body.username);
    if (!validUsername(otherUsername)) return json({ ok: false, error: "اسم المستخدم غير صالح" }, 400);
    const otherProfile = await publicProfile(env, otherUsername);
    if (!otherProfile) return json({ ok: false, error: "الحساب غير موجود" }, 404);
    const currentDashboard = await call(auth.stub, "/dashboard", { secret: auth.secret });
    if (!currentDashboard.response.ok) return json({ ok: false, error: "unauthorized" }, 401);
    const hasIncoming = (currentDashboard.data.incoming || []).some((item) => item.username === otherUsername);
    if (!hasIncoming) return json({ ok: false, error: "لا يوجد طلب صداقة وارد من هذا المستخدم" }, 409);
    const otherStub = stubFor(env, otherUsername);
    if (!body.accept) {
      await Promise.allSettled([
        call(auth.stub, "/friend/remove-incoming", { username: otherUsername }),
        call(otherStub, "/friend/remove-outgoing", { username: auth.username }),
      ]);
      return json({ ok: true, accepted: false });
    }

    const currentPublic = await publicProfile(env, auth.username);
    const addOther = await call(otherStub, "/friend/add", {
      username: auth.username,
      displayName: currentPublic?.displayName || auth.profile.displayName,
      online: currentPublic?.online,
      lastSeen: currentPublic?.lastSeen,
    });
    if (!addOther.response.ok) return json(addOther.data, addOther.response.status);

    const addCurrent = await call(auth.stub, "/friend/add", {
      username: otherUsername,
      displayName: otherProfile.displayName,
      online: otherProfile.online,
      lastSeen: otherProfile.lastSeen,
    });
    if (!addCurrent.response.ok) {
      await call(otherStub, "/friend/remove", { username: auth.username });
      return json(addCurrent.data, addCurrent.response.status);
    }
    return json({ ok: true, accepted: true, friend: addCurrent.data.friend });
  }

  const friendMatch = url.pathname.match(/^\/api\/social\/friends\/([a-zA-Z0-9_]{3,20})$/);
  if (request.method === "DELETE" && friendMatch) {
    const { response, auth } = await requireAuth(request, env);
    if (response) return response;
    const other = normalizeUsername(friendMatch[1]);
    const otherStub = stubFor(env, other);
    await Promise.allSettled([
      call(auth.stub, "/friend/remove", { username: other }),
      otherStub ? call(otherStub, "/friend/remove", { username: auth.username }) : Promise.resolve(),
    ]);
    return json({ ok: true });
  }

  if (request.method === "POST" && url.pathname === "/api/social/block") {
    const { response, auth } = await requireAuth(request, env);
    if (response) return response;
    const body = await request.json().catch(() => ({}));
    const other = normalizeUsername(body.username);
    if (!validUsername(other) || other === auth.username) return json({ ok: false, error: "اسم المستخدم غير صالح" }, 400);
    const otherStub = stubFor(env, other);
    await call(auth.stub, "/friend/block", { username: other });
    if (otherStub) {
      await Promise.allSettled([
        call(otherStub, "/friend/remove", { username: auth.username }),
        call(otherStub, "/friend/remove-incoming", { username: auth.username }),
        call(otherStub, "/friend/remove-outgoing", { username: auth.username }),
      ]);
    }
    return json({ ok: true });
  }

  if (request.method === "POST" && url.pathname === "/api/social/unblock") {
    const { response, auth } = await requireAuth(request, env);
    if (response) return response;
    const body = await request.json().catch(() => ({}));
    const result = await call(auth.stub, "/friend/unblock", { username: body.username });
    return json(result.data, result.response.status);
  }

  if (request.method === "POST" && url.pathname === "/api/social/settings") {
    const { response, auth } = await requireAuth(request, env);
    if (response) return response;
    const body = await request.json().catch(() => ({}));
    const result = await call(auth.stub, "/settings", {
      secret: auth.secret,
      allowInvites: body.allowInvites,
      showOnline: body.showOnline,
    });
    return json(result.data, result.response.status);
  }

  if (request.method === "POST" && url.pathname === "/api/social/invites") {
    const { response, auth } = await requireAuth(request, env);
    if (response) return response;
    const body = await request.json().catch(() => ({}));
    const targetUsername = normalizeUsername(body.username);
    const game = normalizeGame(body.game);
    const roomCode = normalizeRoomCode(body.roomCode);
    if (!validUsername(targetUsername) || !game || !roomCode) return json({ ok: false, error: "بيانات الدعوة غير صالحة" }, 400);
    const targetStub = stubFor(env, targetUsername);
    if (!targetStub || !(await publicProfile(env, targetUsername))) return json({ ok: false, error: "الحساب غير موجود" }, 404);
    const room = await validateInviteRoom(env, game, roomCode);
    if (!room.ok) return json({ ok: false, error: room.error }, room.status);
    const result = await call(targetStub, "/invite/incoming", {
      username: auth.username,
      displayName: cleanDisplayName(auth.profile.displayName),
      game,
      roomCode,
    });
    return json(result.data, result.response.status);
  }

  if (request.method === "POST" && url.pathname === "/api/social/notifications/read") {
    const { response, auth } = await requireAuth(request, env);
    if (response) return response;
    const body = await request.json().catch(() => ({}));
    const result = await call(auth.stub, "/notifications/read", { ids: body.ids });
    return json(result.data, result.response.status);
  }

  if (request.method === "GET" && url.pathname === "/api/social/ws") {
    if (request.headers.get("Upgrade") !== "websocket") return json({ ok: false, error: "WebSocket required" }, 426);
    const protocols = String(request.headers.get("Sec-WebSocket-Protocol") || "")
      .split(",").map((x) => x.trim()).filter(Boolean);
    if (!protocols.includes("busraj-social-v1")) return json({ ok: false, error: "WebSocket protocol required" }, 426);
    const token = protocols.find((x) => x.startsWith("st."))?.slice(3) || "";
    const parsed = parseSessionToken(token);
    if (!parsed) return json({ ok: false, error: "unauthorized" }, 401);
    const stub = stubFor(env, parsed.username);
    if (!stub) return json({ ok: false, error: "unauthorized" }, 401);
    const valid = await call(stub, "/validate", { secret: parsed.secret });
    if (!valid.response.ok) return json({ ok: false, error: "unauthorized" }, 401);
    const headers = new Headers(request.headers);
    headers.set("x-social-auth", "1");
    headers.set("Sec-WebSocket-Protocol", "busraj-social-v1");
    return stub.fetch(new Request("https://social.internal/ws", { method: "GET", headers }));
  }

  return json({ ok: false, error: "not_found" }, 404);
}
