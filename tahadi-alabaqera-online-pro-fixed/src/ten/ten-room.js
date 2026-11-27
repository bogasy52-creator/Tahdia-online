// 33.21.0: «عشر ثواني» live. One table of up to eight: every round all players start their own clock
// at the same moment, stop it when they feel ten seconds, and the farthest from ten leaves. The last one
// standing wins. Played from the game page (a friends room or a public table) and in «الغرف».
// Lives inside GameRoom (instances 'ten:CODE' and 'ten:queue'), like the tower.
import { cleanPartyLink, settlePartyLink, standings as partyStandings } from '../party/party-link.js';

const json = (v, status = 200) => Response.json(v, { status, headers: { 'cache-control': 'no-store' } });
const clean = (v) => String(v || 'لاعب').normalize('NFKC').replace(/[<>\u0000-\u001f‪-‮⁦-⁩]/g, '').trim().slice(0, 20) || 'لاعب';
const rand = () => crypto.getRandomValues(new Uint32Array(1))[0];
const unit = () => rand() / 4294967296;

export const TEN_TARGET = 10_000, TEN_LIMIT = 20_000;
export const TEN_COUNTDOWN = 3200, TEN_REVEAL = 5200, TEN_GRACE = 1500, TEN_TICK = 100;
export const TEN_QUICK_WAIT = 12_000, TEN_PARTY_WAIT = 40_000, TEN_RECONNECT = 20_000;
export const TEN_POINTS = Object.freeze([100, 75, 60, 50, 40, 32, 26, 20]);
// how each round plays (the page shows the same thing): when the count disappears, how fast the ticks lie
export const TEN_ROUNDS = Object.freeze([
  { hideAt: 5000, tick: 1000, note: 'العدّاد يختفي بعد 5 ثواني' },
  { hideAt: 3000, tick: 1000, note: 'يختفي بعد 3 ثواني' },
  { hideAt: 1000, tick: 1000, note: 'ما تشوف إلا أول ثانية' },
  { hideAt: 1000, tick: 820, note: 'انتبه: التكتكة أسرع من الوقت' },
  { hideAt: 0, tick: 1230, note: 'بدون عدّاد، والتكتكة أبطأ' },
]);
const FILL_NAMES = ['فهد', 'نورة', 'سارة', 'ماجد', 'خالد', 'ريم', 'بدر', 'لطيفة', 'سعود', 'منيرة', 'حمد', 'دانة', 'سلطان', 'هيا', 'عبدالله', 'لولوة'];
const gauss = () => { let u = 0, v = 0; while (!u) u = unit(); while (!v) v = unit(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const off = (p) => (p.last == null ? TEN_LIMIT : Math.abs(p.last - TEN_TARGET));

export class TenRoom {
  constructor(ctx, env) {
    this.ctx = ctx; this.env = env; this.r = null; this.timer = null; this.chain = Promise.resolve();
    this.ready = ctx.blockConcurrencyWhile(async () => {
      this.r = (await ctx.storage.get('ten')) || null; if (!this.r) return;
      const live = new Set(ctx.getWebSockets().map((w) => w.deserializeAttachment()?.connection));
      for (const p of this.r.players) if (!p.bot) { p.connected = live.has(p.connection); if (!p.connected) p.awayAt ??= Date.now(); }
    });
  }
  enqueue(fn) { const job = this.chain.then(fn); this.chain = job.catch(() => {}); return job; }
  async save() {
    if (!this.r) return; await this.ctx.storage.put('ten', this.r);
    const r = this.r, now = Date.now();
    const next = r.status === 'lobby' && r.lobbyUntil ? r.lobbyUntil : r.status === 'count' || r.status === 'run' ? r.goAt + TEN_LIMIT + TEN_GRACE : r.status === 'reveal' ? r.nextAt : now + 60_000;
    await this.ctx.storage.setAlarm(Math.min(r.expiresAt, Math.max(now + 200, next)));
  }
  alive() { return this.r.players.filter((p) => !p.out); }
  plan() { return TEN_ROUNDS[Math.min(Math.max(0, this.r.round - 1), TEN_ROUNDS.length - 1)]; }

  // what one player sees: other players' times only once the round is over, and who has already
  // stopped only once you have stopped yourself (their stopping would tell you when ten seconds came)
  view(viewer) {
    const r = this.r, now = Date.now(), open = r.status === 'reveal' || r.status === 'finished' || r.status === 'lobby';
    const me = r.players.find((p) => p.sid === viewer), mineDone = !me || me.out || me.last != null;
    return {
      code: r.code, quick: r.quick, party: Boolean(r.partyLink), capacity: r.capacity, status: r.status, round: r.round, match: r.match,
      plan: r.round ? this.plan() : null, goIn: r.goAt ? r.goAt - now : null, startsIn: r.status === 'lobby' && r.lobbyUntil ? Math.max(0, r.lobbyUntil - now) : null,
      nextIn: r.status === 'reveal' ? Math.max(0, r.nextAt - now) : null, left: r.status === 'reveal' ? r.leftThisRound || [] : [],
      players: r.players.map((p) => {
        const stopped = r.status === 'run' && p.last != null && (p.sid === viewer || mineDone);
        return { id: p.sid, name: p.name, user: p.bot ? null : p.username || null, host: Boolean(p.host), connected: p.bot ? true : Boolean(p.connected), out: Boolean(p.out), outRound: p.outRound || 0,
          last: open || p.sid === viewer ? p.last ?? null : null, stopped, place: p.place ?? null, points: p.points || 0 };
      }),
    };
  }
  send(ws, m) { try { ws.send(JSON.stringify(m)); } catch { /* gone */ } }
  broadcast(m) {
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment(); if (!a?.ten) continue;
      this.send(ws, m || { type: 'state', state: this.view(a.id) });
    }
  }

  async fetch(req) {
    await this.ready;
    return this.enqueue(async () => {
      const u = new URL(req.url); let b = {};
      if (req.method === 'POST') { const raw = await req.text(); if (raw.length > 4096) return json({ ok: false }, 413); try { b = JSON.parse(raw || '{}'); } catch { return json({ ok: false }, 400); } }
      if (u.pathname === '/queue') return this.queue();
      if (u.pathname === '/init') {
        if (this.r && this.r.expiresAt > Date.now()) return json({ ok: false }, 409);
        const partyLink = cleanPartyLink(b.party), capacity = Math.max(2, Math.min(8, Math.floor(Number(b.capacity)) || 8));
        this.r = { code: String(b.code), hostKey: String(b.hostKey || ''), quick: Boolean(b.quick), capacity, status: 'lobby', players: [], round: 0, goAt: 0, nextAt: 0, match: 0, nextSid: 0,
          lobbyUntil: partyLink ? Date.now() + TEN_PARTY_WAIT : 0, createdAt: Date.now(), expiresAt: Date.now() + 3 * 3_600_000,
          ...(partyLink ? { partyLink, expected: Math.max(1, Math.min(8, Math.floor(Number(b.expected)) || 1)) } : {}) };
        await this.save(); return json({ ok: true }, 201);
      }
      const r = this.r;
      if (!r || r.expiresAt < Date.now()) return json({ ok: false, error: 'الغرفة انتهت' }, 404);
      if (this.releaseSeats()) { await this.save(); this.broadcast(); }
      if (u.pathname === '/status') return json({ ok: true, game: 'ten', status: r.status, players: r.players.filter((p) => !p.bot).length, playerLimit: r.capacity });
      if (u.pathname !== '/ws' || req.headers.get('upgrade') !== 'websocket') return json({ ok: false }, 404);
      const protocols = String(req.headers.get('sec-websocket-protocol') || '').split(',').map((v) => v.trim()), read = (k) => protocols.find((v) => v.startsWith(k))?.slice(k.length);
      if (!protocols.includes('bs-ten-v1')) return json({ ok: false }, 426);
      const username = req.headers.get('x-bs-account') || null, rt = read('rt.');
      let p = rt ? r.players.find((x) => x.token === rt) : null;
      if (!p && username) p = r.players.find((x) => x.username === username && !x.bot);
      if (!p && r.hostKey && read('hk.') === r.hostKey) p = r.players.find((x) => x.host && !x.bot) || null;
      if (p?.username && p.username !== username) return json({ ok: false, error: 'جلسة غير صالحة' }, 403);
      if (!p) {
        const humans = r.players.filter((x) => !x.bot);
        if (r.status !== 'lobby' && r.status !== 'finished') return json({ ok: false, error: 'started' , message: 'الجولة بدأت؛ انتظر اللي بعدها أو افتح غرفة ثانية' }, 409);
        if (humans.length >= r.capacity) return json({ ok: false, error: 'full', message: 'الغرفة ممتلئة' }, 409);
        const host = !r.quick && !r.partyLink && !humans.length;
        if (host && read('hk.') !== r.hostKey) return json({ ok: false, error: 'host', message: 'بانتظار صاحب الغرفة يفتحها' }, 403);
        p = { sid: 'p' + r.nextSid++, token: crypto.randomUUID() + crypto.randomUUID(), name: clean(req.headers.get('x-bs-name') || u.searchParams.get('name')), username, host, connected: false, bot: false, out: false, last: null, total: 0, points: 0 };
        if (r.players.some((x) => x.name === p.name)) p.name = (p.name + ' ' + (r.players.length + 1)).slice(0, 20);
        if (r.status === 'finished') r.players = r.players.filter((x) => !x.bot); // a new table after the last one
        r.players.push(p);
        if (r.quick && !r.lobbyUntil) r.lobbyUntil = Date.now() + TEN_QUICK_WAIT;
        if (r.quick && r.players.filter((x) => !x.bot).length >= r.capacity) r.lobbyUntil = Date.now() + 1500;
      }
      if (!p.username && username && r.status === 'lobby' && !r.players.some((x) => x.username === username)) { p.username = username; p.name = clean(req.headers.get('x-bs-name') || p.name); }
      const old = p.connection; p.connection = crypto.randomUUID(); p.connected = true; p.awayAt = null;
      for (const ws of this.ctx.getWebSockets()) if (ws.deserializeAttachment()?.connection === old) try { ws.close(4001, 'resumed'); } catch { /* gone */ }
      const pair = new WebSocketPair(), ws = pair[1]; this.ctx.acceptWebSocket(ws); ws.serializeAttachment({ ten: true, id: p.sid, connection: p.connection });
      await this.save();
      this.send(ws, { type: 'hello', id: p.sid, token: p.token, now: Date.now() });
      this.broadcast(); this.run();
      return new Response(null, { status: 101, webSocket: pair[0], headers: { 'sec-websocket-protocol': 'bs-ten-v1' } });
    });
  }

  /* ------------------------------------------------------------ the public table: one open at a time */
  async queue() {
    const q = await this.ctx.storage.get('tenQueue');
    if (q?.until > Date.now()) {
      try { const res = await this.env.ROOMS.get(this.env.ROOMS.idFromName('ten:' + q.code)).fetch('https://ten.internal/status'); const d = await res.json(); if (d.ok && d.status === 'lobby' && d.players < d.playerLimit) return json({ ok: true, code: q.code }); } catch { /* open a new one */ }
    }
    for (let i = 0; i < 6; i++) {
      const code = '03' + String(rand() % 10000).padStart(4, '0');
      const res = await this.env.ROOMS.get(this.env.ROOMS.idFromName('ten:' + code)).fetch('https://ten.internal/init', { method: 'POST', body: JSON.stringify({ code, quick: true, capacity: 8 }) });
      if (res.status === 201) { await this.ctx.storage.put('tenQueue', { code, until: Date.now() + TEN_QUICK_WAIT }); return json({ ok: true, code }); }
    }
    return json({ ok: false, error: 'ما قدرنا نفتح طاولة الحين' }, 503);
  }

  /* ------------------------------------------------------------ the match */
  canStart() { const r = this.r, n = r.players.filter((p) => !p.bot && p.connected).length; return ['lobby', 'finished'].includes(r.status) && n >= 2; }
  start() {
    const r = this.r;
    r.players = r.players.filter((p) => !p.bot && p.connected);
    // public and group tables: empty seats get players so a table of two still has its rounds
    if (r.quick || r.partyLink) {
      const want = Math.min(8, r.partyLink ? Math.max(4, r.expected || 0, r.players.length) : Math.max(6, r.players.length));
      const taken = new Set(r.players.map((p) => p.name)), names = FILL_NAMES.filter((n) => !taken.has(n));
      for (let k = 0; r.players.length < want; k++) r.players.push({ sid: 'p' + r.nextSid++, name: names.splice(rand() % names.length, 1)[0] || 'لاعب', bot: true, skill: 0.75 + unit() * 0.55 });
      for (let i = r.players.length - 1; i > 0; i--) { const j = rand() % (i + 1); [r.players[i], r.players[j]] = [r.players[j], r.players[i]]; }
    }
    r.players.forEach((p) => { p.out = false; p.outRound = 0; p.last = null; p.total = 0; p.place = null; p.points = 0; p.botAt = null; });
    r.round = 0; r.match++; r.reported = false; r.partyReported = false; r.lobbyUntil = 0;
    this.startRound();
  }
  startRound() {
    const r = this.r; r.round++; r.status = 'count'; r.goAt = Date.now() + TEN_COUNTDOWN; r.leftThisRound = [];
    for (const p of this.alive()) {
      p.last = null;
      if (p.bot) { const wobble = 600 * p.skill * (1 + 0.12 * (r.round - 1)); p.botAt = Math.round(Math.max(3000, Math.min(TEN_LIMIT, TEN_TARGET + gauss() * wobble))); }
    }
  }
  async stop(p, claimed) {
    const r = this.r, now = Date.now();
    if (!['count', 'run'].includes(r.status) || p.out || p.last != null || now < r.goAt) return;
    // the phone measures its own clock (fair on a slow line); the server only checks it is about right
    const seen = now - r.goAt, ms = Number.isFinite(claimed) && Math.abs(claimed - seen) <= TEN_GRACE ? Math.round(claimed) : seen;
    p.last = Math.max(0, Math.min(TEN_LIMIT, ms));
    r.status = 'run'; await this.save(); this.broadcast();
    if (this.roundDone()) await this.reveal();
  }
  roundDone() { return this.alive().every((p) => p.last != null || (!p.bot && !p.connected)); }
  async tick() {
    const r = this.r, now = Date.now();
    if (r.status === 'count' && now >= r.goAt) r.status = 'run';
    if (r.status !== 'run') return;
    let changed = false;
    for (const p of this.alive()) if (p.bot && p.last == null && now - r.goAt >= p.botAt) { p.last = p.botAt; changed = true; }
    if (now - r.goAt >= TEN_LIMIT + TEN_GRACE || this.roundDone()) return this.reveal();
    if (changed) { await this.save(); this.broadcast(); }
  }
  async reveal() {
    const r = this.r, alive = this.alive();
    for (const p of alive) { if (p.last == null) p.last = TEN_LIMIT; p.total += Math.max(0, 1000 - Math.abs(p.last - TEN_TARGET) / 2); }
    const ranked = [...alive].sort((a, b) => off(a) - off(b) || b.total - a.total);
    const leaving = ranked.slice(-(alive.length >= 7 ? 2 : 1));
    for (const p of leaving) { p.out = true; p.outRound = r.round; }
    r.leftThisRound = leaving.map((p) => p.sid);
    const standing = this.alive();
    // the match ends with one left, or when no real player is still in it (nobody to watch the rest)
    if (standing.length <= 1 || !standing.some((p) => !p.bot)) return this.finish();
    r.status = 'reveal'; r.nextAt = Date.now() + TEN_REVEAL; await this.save(); this.broadcast();
  }
  async finish() {
    const r = this.r;
    const ranked = [...r.players].sort((a, b) => (a.out - b.out) || (b.outRound - a.outRound) || (b.total - a.total));
    ranked.forEach((p, i) => { p.place = i + 1; p.points = TEN_POINTS[i] || 20; });
    r.status = 'finished'; r.nextAt = 0; await this.save(); this.broadcast();
    // settlePartyLink marks the round reported itself (marking it first would skip the report)
    if (r.partyLink && !r.partyReported) {
      await settlePartyLink(this.env, r, 'ten', partyStandings(ranked.filter((p) => !p.bot).map((p) => ({ name: p.name, username: p.username || null, score: p.points, won: p.place === 1 })), (a, b) => a.score === b.score));
      await this.save();
    }
  }

  async webSocketMessage(ws, raw) {
    await this.ready;
    return this.enqueue(async () => {
      const a = ws.deserializeAttachment(), r = this.r, p = r?.players.find((x) => x.sid === a?.id && x.connection === a.connection && x.connected);
      if (!p || typeof raw !== 'string' || raw.length > 300) return;
      let b; try { b = JSON.parse(raw); } catch { return; }
      if (b?.type === 'stop' && b.round === r.round) return this.stop(p, Number(b.ms));
      if (b?.type === 'start' && p.host && !r.quick && !r.partyLink && this.canStart()) { this.start(); await this.save(); this.broadcast(); this.run(); return; }
      if (b?.type === 'leave') { await this.depart(p, true); try { ws.close(1000, 'bye'); } catch { /* gone */ } return; }
      if (b?.type === 'ping') this.send(ws, { type: 'pong', now: Date.now() });
    });
  }
  async depart(p, explicit = false) {
    p.connected = false; p.awayAt = Date.now() - (explicit ? TEN_RECONNECT + 1 : 0);
    this.releaseSeats(); await this.save(); this.broadcast();
    if (['count', 'run'].includes(this.r.status) && this.roundDone()) await this.reveal();
  }
  releaseSeats(now = Date.now()) {
    const r = this.r;
    if (!r || !['lobby', 'finished'].includes(r.status)) return false;
    const players = r.players.filter((p) => p.bot || p.connected || !p.awayAt || now - p.awayAt < TEN_RECONNECT);
    if (players.length === r.players.length) return false;
    const hostLeft = r.players.some((p) => p.host && !players.includes(p));
    r.players = players;
    if (hostLeft) { const next = players.find((p) => !p.bot && p.connected) || players.find((p) => !p.bot); if (next) next.host = true; }
    return true;
  }
  run() {
    if (this.timer || !this.r || !['lobby', 'count', 'run', 'reveal'].includes(this.r.status) || !this.r.players.some((p) => !p.bot && p.connected)) return;
    this.timer = setTimeout(() => { this.timer = null; this.enqueue(() => this.step()).catch(console.error).finally(() => this.run()); }, ['count', 'run'].includes(this.r.status) ? TEN_TICK : 400);
  }
  async step() {
    const r = this.r; if (!r) return;
    if (this.releaseSeats()) { await this.save(); this.broadcast(); }
    const inRoom = r.players.filter((p) => !p.bot && p.connected).length;
    if (r.status === 'lobby' && (r.quick || r.partyLink) && r.lobbyUntil && inRoom && (Date.now() >= r.lobbyUntil || (r.partyLink && inRoom >= r.expected))) { this.start(); await this.save(); this.broadcast(); return; }
    if (r.status === 'reveal' && Date.now() >= r.nextAt) { this.startRound(); await this.save(); this.broadcast(); return; }
    if (r.status === 'count' || r.status === 'run') await this.tick();
  }
  async webSocketClose(ws) { await this.ready; return this.enqueue(async () => { const a = ws.deserializeAttachment(), p = this.r?.players.find((x) => x.sid === a?.id && x.connection === a.connection); if (p?.connected) await this.depart(p); }); }
  async alarm() {
    await this.ready;
    return this.enqueue(async () => {
      if (!this.r) return;
      if (this.r.expiresAt < Date.now()) { clearTimeout(this.timer); this.timer = null; this.r = null; await this.ctx.storage.delete('ten'); return; }
      await this.step(); await this.save(); this.run();
    });
  }
}
