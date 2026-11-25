// لعبة العباقرة 33.18.0 — «برج التحديات» online.
// A room lives inside GameRoom like the tanks room (no new Durable Object class). Players run the
// course on their own phones and report where they are ten times a second; the room relays it, keeps
// the clock, checks that a finish is believable (every checkpoint passed, not faster than the course
// allows) and decides the places. Modes: سباق (race), إقصاء (rounds until one is left) and فرق (two
// teams add up their places). Public races fill their empty seats with runners the room moves itself.
// The same class answers the queue (tower:queue:<mode>) and the leaderboard (tower:board).
import { roundCourse, spineAt, dailyCourse, dayKey } from '../../public/assets/js/tower/course.js';
import { cleanPartyLink, settlePartyLink, standings as partyStandings } from '../party/party-link.js';

const json = (v, status = 200) => Response.json(v, { status, headers: { 'cache-control': 'no-store' } });
const clean = (v) => String(v || 'لاعب').normalize('NFKC').replace(/[<>\u0000-\u001f‪-‮⁦-⁩]/g, '').trim().slice(0, 20) || 'لاعب';
const rand = () => crypto.getRandomValues(new Uint32Array(1))[0];
export const TOWER_MODES = Object.freeze(['race', 'elim', 'teams']);
export const TOWER_TICK = 100, TOWER_QUICK_WAIT = 12000, TOWER_COUNTDOWN = 4000, TOWER_RECONNECT = 20000, TOWER_BETWEEN = 6000;
export const TOWER_POINTS = Object.freeze([100, 75, 60, 50, 40, 32, 26, 20]);
export const TOWER_PARTY_WAIT = 40000;
const EMOTES = new Set(['wave', 'laugh', 'dance']);
/** 33.19.0: a daily run counts only if its recorded path could really have been run: ten samples a
    second, no jump faster than a pad or a shove allows (a fall back to a checkpoint is fine), every
    checkpoint passed in order, the last sample at the top, and as long as the time it claims. */
export function verifyTowerRun(course, time, path) {
  if (!Array.isArray(path) || path.length < 20 || path.length > 4000 || !(time > 0)) return 'path';
  if (Math.abs(path.length * 0.1 - time) > 0.6) return 'time';
  if (time < Math.max(8, course.nominal * 0.5)) return 'fast';
  let next = 1;
  for (let i = 0; i < path.length; i++) {
    const p = path[i]; if (!Array.isArray(p) || p.length < 3 || !p.every(Number.isFinite)) return 'path';
    if (i) { const q = path[i - 1], d = Math.hypot(p[0] - q[0], p[2] - q[2]), back = course.checkpoints.some((c) => Math.hypot(p[0] - c.x, p[2] - c.z) < 3.5); if (d > 2.4 && !back) return 'jump'; }
    const c = course.checkpoints[next]; if (c && p[2] >= c.z - 2.5 && p[1] >= c.y - 1.5) next++;
  }
  if (next < course.checkpoints.length) return 'checkpoints';
  const f = course.finish, last = path[path.length - 1];
  if (Math.abs(last[2] - f.z) > 3 || Math.abs(last[0] - f.x) > f.w / 2 + 1.5 || last[1] < f.y - 1) return 'finish';
  return '';
}
const GEMS = [30, 20, 15, 10, 8, 8, 8, 8];
const FILL_NAMES = ['فهد', 'نورة', 'سلطان', 'ريم', 'بدر', 'هيا', 'ماجد', 'دانة', 'خالد', 'لولوة', 'عبدالله', 'شهد'];
const LOOKS = ['zafran', 'nakhla', 'thalj', 'mouj', 'halawa', 'sahab', 'qamar', 'neon', 'jamra', 'saqr', 'sadu'], HATS = ['none', 'taqiya', 'cap', 'beanie', 'shmagh', 'horns'];
const cleanLook = (raw) => { let v = {}; try { v = JSON.parse(raw || '{}') || {}; } catch { /* default */ } const id = (x, d) => (typeof x === 'string' && /^[a-z]{2,12}$/.test(x) ? x : d); return { char: id(v.char, 'zafran'), hat: id(v.hat, 'none'), face: id(v.face, 'noface') }; };
const num = (v, lo, hi) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : null);
const DAY = 86_400_000, RIYADH = 3 * 3_600_000;
export function towerWeek(now = Date.now()) { const d = new Date(new Date(now + RIYADH).toISOString().slice(0, 10) + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7); return d.toISOString().slice(0, 10); }

export class TowerRoom {
  constructor(ctx, env) {
    this.ctx = ctx; this.env = env; this.r = null; this.timer = null; this.chain = Promise.resolve(); this.course = null;
    this.ready = ctx.blockConcurrencyWhile(async () => {
      this.r = (await ctx.storage.get('tower')) || null; if (!this.r) return;
      const live = new Set(ctx.getWebSockets().map((w) => w.deserializeAttachment()?.connection));
      for (const p of this.r.players) if (!p.bot) { p.connected = live.has(p.connection); if (!p.connected) p.awayAt ??= Date.now(); }
    });
  }
  enqueue(fn) { const job = this.chain.then(fn); this.chain = job.catch(() => {}); return job; }
  async save() {
    if (!this.r) return; await this.ctx.storage.put('tower', this.r);
    const r = this.r, next = r.status === 'lobby' && r.lobbyUntil ? r.lobbyUntil : r.status === 'between' ? r.nextAt : Date.now() + 60_000;
    await this.ctx.storage.setAlarm(Math.min(r.expiresAt, Math.max(Date.now() + 200, next)));
  }
  courseOf() { const r = this.r; if (!this.course || this.course.key !== r.seed + ':' + r.round) { this.course = roundCourse(r.seed, r.round, r.players.length); this.course.key = r.seed + ':' + r.round; } return this.course; }
  alive() { return this.r.players.filter((p) => !p.out); }
  view() {
    const r = this.r;
    return { code: r.code, quick: r.quick, party: Boolean(r.partyLink), mode: r.mode, capacity: r.capacity, status: r.status, round: r.round, seed: r.seed, startAt: r.startAt, startsIn: r.status === 'lobby' && (r.quick || r.partyLink) ? r.lobbyUntil : null, qualify: r.qualify, winnerTeam: r.winnerTeam ?? null,
      players: r.players.map((p) => ({ id: p.sid, name: p.name, user: p.bot ? null : p.username || null, look: p.look, host: Boolean(p.host), ready: Boolean(p.ready), team: p.team ?? null, fin: p.fin ?? null, place: p.place ?? null, out: Boolean(p.out), points: p.points || 0, gems: p.gems || 0, connected: p.bot ? true : Boolean(p.connected) })) };
  }
  send(ws, m) { try { ws.send(JSON.stringify(m)); } catch { /* gone */ } }
  broadcast(m) { const text = JSON.stringify(m || { type: 'state', state: this.view() }); for (const ws of this.ctx.getWebSockets()) { const a = ws.deserializeAttachment(); if (a?.tower) try { ws.send(text); } catch { /* gone */ } } }

  async fetch(req) {
    await this.ready;
    return this.enqueue(async () => {
      const u = new URL(req.url); let b = {};
      if (req.method === 'POST') { const raw = await req.text(); if (raw.length > (u.pathname === '/board/day' ? 120_000 : 8192)) return json({ ok: false }, 413); try { b = JSON.parse(raw || '{}'); } catch { return json({ ok: false }, 400); } }
      if (u.pathname === '/board' || u.pathname === '/board/add' || u.pathname === '/board/day') return this.board(u, b);
      if (u.pathname === '/queue') return this.queue(b);
      if (u.pathname === '/init') {
        if (this.r && this.r.expiresAt > Date.now()) return json({ ok: false }, 409);
        const mode = TOWER_MODES.includes(b.mode) ? b.mode : 'race', capacity = Math.max(2, Math.min(8, Number(b.capacity) || 8));
        const partyLink = cleanPartyLink(b.party);
        this.r = { code: String(b.code), hostKey: String(b.hostKey || ''), quick: Boolean(b.quick), mode: partyLink ? 'race' : mode, capacity, status: 'lobby', players: [], seed: rand(), round: 0, startAt: 0, qualify: 0, lobbyUntil: partyLink ? Date.now() + TOWER_PARTY_WAIT : 0, createdAt: Date.now(), expiresAt: Date.now() + 3 * 3_600_000, match: 0, nextSid: 0,
          ...(partyLink ? { partyLink, expected: Math.max(1, Math.min(8, Math.floor(Number(b.expected)) || 1)) } : {}) };
        await this.save(); return json({ ok: true }, 201);
      }
      const r = this.r;
      if (!r || r.expiresAt < Date.now()) return json({ ok: false, error: 'الغرفة انتهت' }, 404);
      if (u.pathname === '/status') return json({ ok: true, game: 'tower', status: r.status, mode: r.mode, players: r.players.filter((p) => !p.bot).length, playerLimit: r.capacity });
      if (u.pathname !== '/ws' || req.headers.get('upgrade') !== 'websocket') return json({ ok: false }, 404);
      const protocols = String(req.headers.get('sec-websocket-protocol') || '').split(',').map((v) => v.trim()), read = (k) => protocols.find((v) => v.startsWith(k))?.slice(k.length);
      if (!protocols.includes('bs-tower-v1')) return json({ ok: false }, 426);
      const username = req.headers.get('x-bs-account') || null, rt = read('rt.');
      let p = rt ? r.players.find((x) => x.token === rt) : null;
      if (!p && username) p = r.players.find((x) => x.username === username && !x.bot);
      // whoever holds the host key is the host, even if their first try never heard back
      if (!p && r.hostKey && read('hk.') === r.hostKey) p = r.players.find((x) => x.host && !x.bot) || null;
      if (p?.username && p.username !== username) return json({ ok: false, error: 'جلسة غير صالحة' }, 403);
      if (!p) {
        const humans = r.players.filter((x) => !x.bot);
        if (r.status !== 'lobby' || humans.length >= r.capacity) return json({ ok: false, error: 'الغرفة ممتلئة أو السباق بدأ' }, 409);
        const host = !r.quick && !r.partyLink && !humans.length;
        if (host && read('hk.') !== r.hostKey) return json({ ok: false, error: 'بانتظار صاحب الغرفة' }, 403);
        p = { sid: 'a' + r.nextSid++, token: crypto.randomUUID() + crypto.randomUUID(), name: clean(req.headers.get('x-bs-name') || u.searchParams.get('name')), username, look: cleanLook(u.searchParams.get('look')), host, ready: r.quick || Boolean(r.partyLink), connected: false, bot: false, pos: [0, 0, 0, 0, 0], cp: 0, fin: null, out: false, points: 0 };
        // two players with one name are told apart
        if (r.players.some((x) => x.name === p.name)) p.name = (p.name + ' ' + (r.players.length + 1)).slice(0, 20);
        r.players.push(p);
        if (r.quick && !r.lobbyUntil) r.lobbyUntil = Date.now() + TOWER_QUICK_WAIT;
        if (r.quick && r.players.filter((x) => !x.bot).length >= r.capacity) r.lobbyUntil = Date.now() + 1500;
      }
      const old = p.connection; p.connection = crypto.randomUUID(); p.connected = true; p.awayAt = null;
      for (const ws of this.ctx.getWebSockets()) if (ws.deserializeAttachment()?.connection === old) try { ws.close(4001, 'resumed'); } catch { /* gone */ }
      const pair = new WebSocketPair(), ws = pair[1]; this.ctx.acceptWebSocket(ws); ws.serializeAttachment({ tower: true, id: p.sid, connection: p.connection });
      await this.save();
      this.send(ws, { type: 'hello', id: p.sid, token: p.token, now: Date.now() });
      this.broadcast(); this.run();
      return new Response(null, { status: 101, webSocket: pair[0], headers: { 'sec-websocket-protocol': 'bs-tower-v1' } });
    });
  }

  /* ------------------------------------------------------------ the public queue */
  async queue(b) {
    const mode = TOWER_MODES.includes(b.mode) ? b.mode : 'race', key = 'towerQueue:' + mode, q = await this.ctx.storage.get(key);
    if (q?.until > Date.now()) {
      try { const res = await this.env.ROOMS.get(this.env.ROOMS.idFromName('tower:' + q.code)).fetch('https://tower.internal/status'); const d = await res.json(); if (d.ok && d.status === 'lobby' && d.players < d.playerLimit) return json({ ok: true, code: q.code }); } catch { /* make a new one */ }
    }
    for (let i = 0; i < 6; i++) {
      const code = '04' + String(rand() % 10000).padStart(4, '0');
      const res = await this.env.ROOMS.get(this.env.ROOMS.idFromName('tower:' + code)).fetch('https://tower.internal/init', { method: 'POST', body: JSON.stringify({ code, quick: true, mode, capacity: 8 }) });
      if (res.status === 201) { await this.ctx.storage.put(key, { code, until: Date.now() + TOWER_QUICK_WAIT }); return json({ ok: true, code }); }
    }
    return json({ ok: false, error: 'ما قدرنا نفتح سباق الحين' }, 503);
  }

  /* ------------------------------------------------------------ the leaderboard */
  async board(u, b) {
    const s = (await this.ctx.storage.get('towerBoard')) || { week: towerWeek(), weekRows: {}, all: {} };
    if (s.week !== towerWeek()) { s.week = towerWeek(); s.weekRows = {}; }
    // 33.19.0: today's level — the best time of each account, checked against the course
    s.days ||= {};
    for (const k of Object.keys(s.days)) if (k < dayKey(Date.now() - 2 * DAY)) delete s.days[k];
    if (u.pathname === '/board/day') {
      const day = String(b.day || ''), today = dayKey(), yesterday = dayKey(Date.now() - DAY);
      if (![today, yesterday].includes(day)) return json({ ok: false, error: 'انتهى يوم هالمرحلة' }, 409);
      if (!/^[a-z0-9_]{3,20}$/.test(b.username || '')) return json({ ok: false, error: 'سجّل دخول' }, 401);
      const time = Math.round(Number(b.time) * 100) / 100, why = verifyTowerRun(dailyCourse(day), time, b.path);
      if (why) return json({ ok: false, error: 'ما قدرنا نتحقق من الجولة (' + why + ')' }, 422);
      const table = (s.days[day] ||= {}), mine = table[b.username];
      if (!mine || time < mine.t) table[b.username] = { n: clean(b.name), t: time };
      await this.ctx.storage.put('towerBoard', s);
      const order = Object.entries(table).sort((x, y) => x[1].t - y[1].t), rank = order.findIndex(([k]) => k === b.username) + 1;
      return json({ ok: true, rank, best: table[b.username].t, players: order.length });
    }
    if (u.searchParams.get('period') === 'day') {
      const me = u.searchParams.get('me') || '', order = Object.entries(s.days[dayKey()] || {}).sort((x, y) => x[1].t - y[1].t), at = order.findIndex(([k]) => k === me);
      return json({ ok: true, day: dayKey(), rows: order.slice(0, 50).map(([k, e]) => ({ name: e.n, user: k, time: e.t, me: k === me })), me: at >= 0 ? { rank: at + 1, time: order[at][1].t } : null });
    }
    if (u.pathname === '/board/add') {
      for (const row of Array.isArray(b.rows) ? b.rows.slice(0, 8) : []) {
        if (!/^[a-z0-9_]{3,20}$/.test(row?.username || '')) continue;
        const pts = Math.max(0, Math.min(200, Number(row.points) || 0)), win = row.win ? 1 : 0;
        for (const table of [s.weekRows, s.all]) { const e = table[row.username] || { n: '', p: 0, w: 0, g: 0 }; e.n = clean(row.name); e.p += pts; e.w += win; e.g += 1; table[row.username] = e; }
      }
      for (const k of ['weekRows', 'all']) { const list = Object.entries(s[k]); if (list.length > 600) s[k] = Object.fromEntries(list.sort((a, b2) => b2[1].p - a[1].p).slice(0, 500)); }
      await this.ctx.storage.put('towerBoard', s); return json({ ok: true });
    }
    const table = u.searchParams.get('period') === 'all' ? s.all : s.weekRows, me = u.searchParams.get('me') || '';
    const sorted = Object.entries(table).sort((a, b2) => b2[1].p - a[1].p || b2[1].w - a[1].w);
    const rows = sorted.slice(0, 50).map(([k, e]) => ({ name: e.n, user: k, points: e.p, wins: e.w, me: k === me }));
    const at = sorted.findIndex(([k]) => k === me);
    return json({ ok: true, week: s.week, rows, me: at >= 0 ? { rank: at + 1, points: sorted[at][1].p } : null });
  }

  /* ------------------------------------------------------------ playing */
  start() {
    const r = this.r;
    // public races: seats nobody took are filled so the race is never empty
    if (r.quick || r.partyLink) {
      const humans = r.players.filter((p) => !p.bot && p.connected); r.players = humans;
      let want = r.partyLink ? Math.max(4, r.expected || 0, humans.length) : Math.max(6, humans.length); if (r.mode === 'teams' && want % 2) want++; want = Math.min(8, want);
      const taken = new Set(r.players.map((p) => p.name)), names = FILL_NAMES.filter((n) => !taken.has(n));
      for (let k = 0; r.players.length < want; k++) r.players.push({ sid: 'a' + r.nextSid++, name: names[(rand() + k) % names.length], bot: true, look: { char: LOOKS[rand() % LOOKS.length], hat: HATS[rand() % HATS.length], face: 'noface' }, pos: [0, 0, 0, 0, 0], cp: 0, fin: null, out: false, points: 0, sf: 0.74 + (rand() % 1000) / 1000 * 0.22 });
      for (let i = r.players.length - 1; i > 0; i--) { const j = rand() % (i + 1); [r.players[i], r.players[j]] = [r.players[j], r.players[i]]; }
    }
    r.players.forEach((p, i) => { p.team = r.mode === 'teams' ? i % 2 : null; p.out = false; p.points = 0; p.place = null; p.gems = 0; p.outRound = null; });
    r.seed = rand(); r.round = 0; r.match++; r.winnerTeam = null; r.reported = false;
    this.startRound();
  }
  startRound() {
    const r = this.r, alive = this.alive(), course = this.courseOf();
    r.status = 'playing'; r.startAt = Date.now() + TOWER_COUNTDOWN; r.firstFin = 0;
    const left = alive.length; r.final = r.mode !== 'elim' || left <= 3 || r.round >= 2;
    r.qualify = r.mode === 'elim' ? (r.final ? 1 : Math.max(1, Math.min(left - 1, Math.ceil(left * (r.round === 0 ? 0.6 : 0.5))))) : left;
    for (const p of alive) { p.fin = null; p.cp = 0; p.pos = [0, 0, 0, 0, 0]; p.last = 0; if (p.bot) { const falls = rand() % 3; p.slips = Array.from({ length: falls }, () => 4 + (rand() % 1000) / 1000 * course.nominal * 0.9).sort((a, b) => a - b); } }
  }
  botTime(p, elapsed) { let pen = 0; for (const s of p.slips || []) if (elapsed > s + pen) pen += Math.min(2.6, elapsed - s - pen); return Math.max(0, (elapsed - pen) * p.sf); }
  limit() { return Math.max(90, Math.min(240, this.courseOf().par * 2.6)); }
  async tick() {
    const r = this.r; if (r?.status !== 'playing') return;
    const now = Date.now(), elapsed = (now - r.startAt) / 1000, rows = [];
    const course = this.courseOf();
    for (const p of this.alive()) {
      if (p.bot && elapsed > 0) {
        if (p.fin == null) { const s = spineAt(course, this.botTime(p, elapsed)); const prev = p.pos; p.pos = [s.x, s.y, s.z, Math.atan2(s.x - prev[0], Math.max(0.01, s.z - prev[2])), s.z - prev[2] > 0.05 ? 1 : 0]; if (s.done) { p.fin = Math.round(elapsed * 10) / 10; r.firstFin ||= now; } }
        else p.pos[4] = 0;
      }
      rows.push([p.sid, ...p.pos.map((v, i) => (i < 4 ? Math.round(v * 100) / 100 : v))]);
    }
    this.broadcast({ type: 'snap', t: now, p: rows });
    // humans who left for good are out of this round
    for (const p of this.alive()) if (!p.bot && !p.connected && p.awayAt && now - p.awayAt > TOWER_RECONNECT && p.fin == null) p.gaveUp = true;
    const alive = this.alive(), done = alive.filter((p) => p.fin != null).length, waiting = alive.filter((p) => p.fin == null && !p.gaveUp);
    const enough = r.mode === 'elim' ? done >= r.qualify : waiting.length === 0;
    const grace = r.mode !== 'elim' && r.firstFin && now - r.firstFin > 25_000;
    if (enough || grace || elapsed > this.limit() || !alive.some((p) => !p.bot && p.connected)) await this.endRound();
  }
  progress(p) { return (p.fin != null ? 1e6 - p.fin * 100 : 0) + p.cp * 1000 + (p.pos?.[2] || 0); }
  async endRound() {
    const r = this.r, alive = this.alive().sort((a, b) => this.progress(b) - this.progress(a));
    if (r.mode === 'elim' && !r.final) {
      alive.forEach((p, i) => { if (i >= r.qualify) { p.out = true; p.outRound = r.round; p.outRank = i; } });
      r.status = 'between'; r.nextAt = Date.now() + TOWER_BETWEEN; r.round++;
      this.broadcast({ type: 'toast', text: 'تأهل ' + r.qualify + ' للجولة الجاية' });
      await this.save(); this.broadcast(); return;
    }
    // final places
    let ranked;
    if (r.mode === 'elim') { const out = r.players.filter((p) => p.out).sort((a, b) => b.outRound - a.outRound || a.outRank - b.outRank); ranked = [...alive, ...out]; }
    else ranked = alive;
    ranked.forEach((p, i) => { p.place = i + 1; p.points = p.fin != null || r.mode === 'elim' ? TOWER_POINTS[i] || 20 : 10; p.gems = GEMS[i] || 8; });
    if (r.mode === 'teams') {
      const sum = [0, 0]; for (const p of ranked) sum[p.team] += TOWER_POINTS[p.place - 1] || 10;
      r.winnerTeam = sum[1] > sum[0] ? 1 : 0; for (const p of ranked) if (p.team === r.winnerTeam) { p.points += 40; p.gems += 10; }
    }
    r.status = 'finished'; await this.save(); this.broadcast();
    await this.report(ranked);
    if (r.partyLink && !r.partyReported) { await settlePartyLink(this.env, r, 'tower', partyStandings(ranked.filter((p) => !p.bot).map((p) => ({ name: p.name, username: p.username || null, score: p.points, won: p.place === 1 })), (a, b) => a.score === b.score)); await this.save(); }
  }
  async report(ranked) {
    const r = this.r; if (r.reported) return; r.reported = true;
    const rows = ranked.filter((p) => !p.bot && p.username).map((p) => ({ username: p.username, name: p.name, points: p.points, win: r.mode === 'teams' ? p.team === r.winnerTeam : p.place === 1 }));
    if (rows.length && this.env.ROOMS) try { await this.env.ROOMS.get(this.env.ROOMS.idFromName('tower:board')).fetch('https://tower.internal/board/add', { method: 'POST', body: JSON.stringify({ rows }) }); } catch { r.reported = false; }
    await this.save();
  }
  canStart() { const r = this.r; return ['lobby', 'finished'].includes(r.status) && r.players.filter((p) => !p.bot && p.connected).length >= 2; }

  async webSocketMessage(ws, raw) {
    await this.ready;
    return this.enqueue(async () => {
      const a = ws.deserializeAttachment(), r = this.r, p = r?.players.find((x) => x.sid === a?.id && x.connection === a.connection && x.connected);
      if (!p || typeof raw !== 'string' || raw.length > 600) return;
      let b; try { b = JSON.parse(raw); } catch { return; }
      if (b?.type === 'pos') {
        if (r.status !== 'playing' || p.out || p.fin != null) return;
        const now = Date.now(); if (now - (p.last || 0) < 60) return;
        const x = num(b.x, -60, 60), y = num(b.y, -200, 400), z = num(b.z, -20, 600), ry = num(b.ry, -50, 50), an = Number.isInteger(b.a) ? Math.max(0, Math.min(5, b.a)) : 0;
        if (x === null || y === null || z === null) return;
        const course = this.courseOf(), dt = Math.max(0.06, (now - (p.last || now)) / 1000), moved = Math.hypot(x - p.pos[0], z - p.pos[2]);
        const back = course.checkpoints.some((c) => Math.abs(z - c.z) < 3); // a fall sends you back to a checkpoint
        if (p.last ? moved > 30 * dt + 4 && !back : z > course.checkpoints[0].z + 12) return;
        p.pos = [x, y, z, ry ?? 0, an]; p.last = now;
        const cp = Number.isInteger(b.cp) ? b.cp : p.cp; if (cp > p.cp && cp < course.checkpoints.length && z >= course.checkpoints[cp].z - 4) p.cp = cp;
        return;
      }
      if (b?.type === 'fin') {
        if (r.status !== 'playing' || p.out || p.fin != null) return;
        const course = this.courseOf(), elapsed = (Date.now() - r.startAt) / 1000;
        if (p.cp < course.checkpoints.length - 1 || p.pos[2] < course.finish.z - 4 || elapsed < Math.max(4, course.nominal * 0.5)) return;
        p.fin = Math.round(elapsed * 10) / 10; r.firstFin ||= Date.now(); await this.save(); this.broadcast(); return;
      }
      if (b?.type === 'start' && p.host && !r.quick && this.canStart()) { r.players = r.players.filter((x) => x.connected); this.start(); await this.save(); this.broadcast(); this.run(); return; }
      if (b?.type === 'leave') { await this.depart(p, true); try { ws.close(1000, 'bye'); } catch { /* gone */ } return; }
      // 'gesture', not 'emote': the shared room relay catches {type:'emote'} before it reaches the tower
      if (b?.type === 'gesture' && EMOTES.has(b.e)) { const now = Date.now(); if (now - (p.lastEmote || 0) < 1000) return; p.lastEmote = now; this.broadcast({ type: 'gesture', id: p.sid, e: b.e }); return; }
      if (b?.type === 'push' && r.status === 'playing' && !p.out && p.fin == null) {
        // a shove only lands on someone really next to you, once a second at most
        const now = Date.now(), target = r.players.find((x) => x.sid === b.id && !x.out && x.fin == null); if (!target || now - (p.lastPush || 0) < 1000) return;
        const d = Math.hypot(target.pos[0] - p.pos[0], target.pos[2] - p.pos[2]); if (d > 3 || Math.abs(target.pos[1] - p.pos[1]) > 2.5) return;
        p.lastPush = now; const nx = num(b.nx, -1, 1) ?? 0, nz = num(b.nz, -1, 1) ?? 0;
        if (target.bot) { const elapsed = (now - r.startAt) / 1000; (target.slips ||= []).push(elapsed); target.slips.sort((x, y) => x - y); return; }
        for (const w of this.ctx.getWebSockets()) { const a2 = w.deserializeAttachment(); if (a2?.tower && a2.id === target.sid) this.send(w, { type: 'pushed', from: p.sid, nx, nz }); }
        return;
      }
      if (b?.type === 'ping') this.send(ws, { type: 'pong', now: Date.now() });
    });
  }
  async depart(p, explicit = false) {
    const r = this.r; p.connected = false; p.awayAt = Date.now() - (explicit ? TOWER_RECONNECT + 1 : 0);
    if (r.status === 'lobby' || r.status === 'finished') {
      r.players = r.players.filter((x) => x !== p);
      if (p.host && r.players.length) r.players.find((x) => !x.bot).host = true;
    }
    await this.save(); this.broadcast();
  }
  run() {
    if (this.timer || !this.r || !['playing', 'lobby', 'between'].includes(this.r.status) || !this.r.players.some((p) => !p.bot && p.connected)) return;
    this.timer = setTimeout(() => { this.timer = null; this.enqueue(() => this.step()).finally(() => this.run()); }, this.r.status === 'playing' ? TOWER_TICK : 500);
  }
  async step() {
    const r = this.r; if (!r) return;
    const inRoom = r.players.filter((p) => !p.bot && p.connected).length;
    if (r.status === 'lobby' && (r.quick || r.partyLink) && r.lobbyUntil && inRoom && (Date.now() >= r.lobbyUntil || (r.partyLink && inRoom >= r.expected))) { this.start(); await this.save(); this.broadcast(); return; }
    if (r.status === 'between' && Date.now() >= r.nextAt) { this.startRound(); await this.save(); this.broadcast(); return; }
    if (r.status === 'playing') await this.tick();
  }
  async webSocketClose(ws) { await this.ready; return this.enqueue(async () => { const a = ws.deserializeAttachment(), p = this.r?.players.find((x) => x.sid === a?.id && x.connection === a.connection); if (p?.connected) await this.depart(p); }); }
  async alarm() {
    await this.ready;
    return this.enqueue(async () => {
      if (!this.r) return;
      if (this.r.expiresAt < Date.now()) { clearTimeout(this.timer); this.timer = null; this.r = null; await this.ctx.storage.delete('tower'); return; }
      await this.step(); await this.save(); this.run();
    });
  }
}
