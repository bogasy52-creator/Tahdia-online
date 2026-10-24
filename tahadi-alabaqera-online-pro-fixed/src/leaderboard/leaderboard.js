// Weekly and monthly ("season") ladders. Only server-verified online results
// reach this store (forwarded by the player's own account object), so local
// play and practice can never move a player up the board.
export const LEADERBOARD_OBJECT = '__leaderboard__:v1';
export const LEADERBOARD_POINTS = Object.freeze({ win: 250, play: 80 }); // mirrors verified career XP
const TOP = 100, RECENT = 40, HALL = 3, KEEP_PERIODS = 3;
const DAY = 86_400_000, RIYADH = 3 * 3_600_000;

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const cleanName = value => String(value || '').normalize('NFKC').replace(/[<>\u0000-\u001f‪-‮⁦-⁩]/g, '').trim().slice(0, 24);
const validUser = value => /^[a-z0-9_]{3,20}$/.test(value);

export function riyadhWeekKey(now = Date.now()) {
  const day = new Date(new Date(now + RIYADH).toISOString().slice(0, 10) + 'T00:00:00Z');
  day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
  return day.toISOString().slice(0, 10);
}
export function seasonKey(now = Date.now()) { return new Date(now + RIYADH).toISOString().slice(0, 7); }

/** Current period key, its Riyadh start/end instants and the previous key. */
export function periodBounds(period, now = Date.now()) {
  if (period === 'week') {
    const key = riyadhWeekKey(now), startsAt = Date.parse(key + 'T00:00:00Z') - RIYADH;
    return { key, startsAt, endsAt: startsAt + 7 * DAY, previous: riyadhWeekKey(startsAt - 1) };
  }
  const key = seasonKey(now), [year, month] = key.split('-').map(Number);
  const startsAt = Date.UTC(year, month - 1, 1) - RIYADH, endsAt = Date.UTC(year, month, 1) - RIYADH;
  return { key, startsAt, endsAt, previous: seasonKey(startsAt - 1) };
}

// Higher points first; equal points are split by wins, then by who got there first.
export function compareEntries(a, b) { return b.p - a.p || b.w - a.w || a.at - b.at || a.u.localeCompare(b.u); }
const publicRow = row => ({ username: row.u, name: row.n || row.u, points: row.p, wins: row.w, games: row.g, owner: Boolean(row.o) });

export class LeaderboardStore {
  constructor(ctx) { this.ctx = ctx; }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/record' && request.method === 'POST') {
      const body = await request.json().catch(() => null);
      const result = await this.ctx.blockConcurrencyWhile(() => this.record(body));
      return json(result, result.ok ? 200 : 400);
    }
    if (url.pathname === '/top' && request.method === 'GET') {
      return json(await this.top(url.searchParams.get('period'), url.searchParams.get('player')));
    }
    return json({ ok: false, error: 'not_found' }, 404);
  }

  async record(body, now = Date.now()) {
    const username = String(body?.username || '').toLowerCase(), receipt = String(body?.receipt || '').slice(0, 160);
    if (!validUser(username)) return { ok: false, error: 'invalid_player' };
    if (!receipt) return { ok: false, error: 'invalid_receipt' };
    const win = body.win === true, at = Number.isFinite(body.at) ? Math.min(Number(body.at), now) : now;
    const name = cleanName(body.name) || username, owner = body.owner === true;
    let applied = false;
    for (const period of ['week', 'season']) {
      const { key } = periodBounds(period, at);
      await this.prune(period, key);
      const entryKey = `${period}:${key}:p:${username}`;
      const entry = await this.ctx.storage.get(entryKey) || { u: username, p: 0, w: 0, g: 0, at, recent: [] };
      // The same verified match can be forwarded again when a room retries;
      // recent receipts make the store idempotent.
      if (entry.recent.includes(receipt)) continue;
      entry.recent = [...entry.recent, receipt].slice(-RECENT);
      entry.n = name; entry.o = owner; entry.p += win ? LEADERBOARD_POINTS.win : LEADERBOARD_POINTS.play;
      entry.w += win ? 1 : 0; entry.g += 1; entry.at = at;
      await this.ctx.storage.put(entryKey, entry);
      await this.updateTop(period, key, entry);
      applied = true;
    }
    return { ok: true, applied };
  }

  async updateTop(period, key, entry) {
    const topKey = `${period}:${key}:top`, top = await this.ctx.storage.get(topKey) || [];
    const row = { u: entry.u, n: entry.n, p: entry.p, w: entry.w, g: entry.g, o: entry.o, at: entry.at };
    const index = top.findIndex(item => item.u === entry.u);
    if (index >= 0) top[index] = row; else top.push(row);
    top.sort(compareEntries);
    await this.ctx.storage.put(topKey, top.slice(0, TOP));
  }

  // Keeps the current and two previous periods. Finished seasons keep their
  // final top list (a hall of fame); their per-player rows are removed.
  async prune(period, key) {
    const index = await this.ctx.storage.get('periods') || { week: [], season: [] };
    const list = index[period] || [];
    if (list.includes(key)) return;
    list.push(key); list.sort();
    while (list.length > KEEP_PERIODS) {
      const old = list.shift(), rows = await this.ctx.storage.list({ prefix: `${period}:${old}:` });
      const doomed = [...rows.keys()].filter(name => period === 'week' || name.includes(':p:'));
      for (let i = 0; i < doomed.length; i += 128) await this.ctx.storage.delete(doomed.slice(i, i + 128));
    }
    index[period] = list;
    await this.ctx.storage.put('periods', index);
  }

  async top(periodValue, playerValue, now = Date.now()) {
    const period = periodValue === 'season' ? 'season' : 'week', bounds = periodBounds(period, now);
    const top = await this.ctx.storage.get(`${period}:${bounds.key}:top`) || [];
    const previous = (await this.ctx.storage.get(`${period}:${bounds.previous}:top`) || []).slice(0, HALL);
    const player = String(playerValue || '').toLowerCase();
    let me = null;
    if (validUser(player)) {
      const entry = await this.ctx.storage.get(`${period}:${bounds.key}:p:${player}`), rank = top.findIndex(row => row.u === player);
      me = entry ? { ...publicRow(entry), rank: rank >= 0 ? rank + 1 : null } : { username: player, name: player, points: 0, wins: 0, games: 0, owner: false, rank: null };
    }
    return {
      ok: true, period, key: bounds.key, startsAt: bounds.startsAt, endsAt: bounds.endsAt, serverNow: now, points: LEADERBOARD_POINTS,
      players: top.map((row, i) => ({ rank: i + 1, ...publicRow(row) })), me,
      previous: { key: bounds.previous, players: previous.map((row, i) => ({ rank: i + 1, ...publicRow(row) })) },
    };
  }
}
