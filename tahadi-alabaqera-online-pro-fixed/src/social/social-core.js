export const SOCIAL_SESSION_DAYS = 30;
export const SOCIAL_MAX_FRIENDS = 100;
export const SOCIAL_MAX_REQUESTS = 100;
export const SOCIAL_MAX_NOTIFICATIONS = 60;
export const SOCIAL_INVITE_TTL_MS = 5 * 60 * 1000;
export const SOCIAL_ONLINE_GAMES = new Set(["quiz", "jackaroo", "snakes", "zahra"]);

export function normalizeUsername(value) {
  return String(value || "").normalize("NFKC").trim().toLowerCase().replace(/\s+/g, "");
}

export function validUsername(value) {
  return /^[a-z0-9_]{3,20}$/.test(normalizeUsername(value));
}

export function cleanDisplayName(value) {
  const cleaned = String(value || "")
    .normalize("NFKC")
    .trim()
    .replace(/[\u0000-\u001F\u007F<>]/g, "")
    .replace(/\s{2,}/g, " ")
    .slice(0, 24);
  return cleaned || "لاعب";
}

export function validatePassword(value) {
  const password = String(value || "");
  if (password.length < 8) return "كلمة المرور يجب أن تكون 8 أحرف على الأقل";
  if (password.length > 72) return "كلمة المرور طويلة جدًا";
  return "";
}

export function createRandomSecret(bytes = 32) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return base64Url(data);
}

export function createSessionToken(username, secret = createRandomSecret()) {
  const normalized = normalizeUsername(username);
  if (!validUsername(normalized)) throw new Error("invalid_username");
  return `${normalized}.${secret}`;
}

export function parseSessionToken(value) {
  const token = String(value || "").trim();
  const dot = token.indexOf(".");
  if (dot < 3) return null;
  const username = normalizeUsername(token.slice(0, dot));
  const secret = token.slice(dot + 1);
  if (!validUsername(username) || !/^[A-Za-z0-9_-]{32,128}$/.test(secret)) return null;
  return { username, secret, token };
}

export function normalizeRoomCode(value) {
  const code = String(value || "").replace(/\D/g, "").slice(0, 6);
  return /^\d{6}$/.test(code) ? code : "";
}

export function normalizeGame(value) {
  const game = String(value || "").trim().toLowerCase();
  return SOCIAL_ONLINE_GAMES.has(game) ? game : "";
}

export function gameJoinPath(game, roomCode) {
  const normalizedGame = normalizeGame(game);
  const code = normalizeRoomCode(roomCode);
  if (!normalizedGame || !code) return "";
  if (normalizedGame === "quiz") return `/online?room=${encodeURIComponent(code)}`;
  return `/${normalizedGame}?room=${encodeURIComponent(code)}`;
}

export function publicProfile(profile, presence = {}) {
  if (!profile) return null;
  return {
    username: profile.username,
    displayName: profile.displayName,
    createdAt: profile.createdAt,
    online: Boolean(presence.online),
    lastSeen: Number(presence.lastSeen) || null,
  };
}

export function base64Url(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function fromBase64Url(value) {
  const padded = String(value || "").replace(/-/g, "+").replace(/_/g, "/") + "===".slice((String(value || "").length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export async function sha256(value) {
  const data = new TextEncoder().encode(String(value));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64Url(new Uint8Array(digest));
}

export async function hashPassword(password, saltBase64 = createRandomSecret(16), iterations = 100_000) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(String(password)),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: fromBase64Url(saltBase64), iterations, hash: "SHA-256" },
    material,
    256,
  );
  return { salt: saltBase64, iterations, hash: base64Url(new Uint8Array(bits)) };
}

export async function verifyPassword(password, record) {
  if (!record?.salt || !record?.hash) return false;
  const derived = await hashPassword(password, record.salt, Number(record.iterations) || 100_000);
  const a = new TextEncoder().encode(derived.hash);
  const b = new TextEncoder().encode(String(record.hash));
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
