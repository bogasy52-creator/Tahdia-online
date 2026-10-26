// 32.1.0: who is on the site right now, for the owner's dashboard.
// Every open tab sends a small heartbeat while it is visible (see client-health.js),
// and a goodbye when it closes. Beats live in memory; a compact snapshot is
// written at most once a minute so a restarted object does not start empty.
export const PRESENCE_OBJECT = '__presence__:v1';
export const PRESENCE_BEAT_MS = 120_000;          // the page beats every two minutes while visible
export const PRESENCE_TTL_MS = 5 * 60_000;        // a tab that stops beating is gone after five minutes
const MAX_ENTRIES = 3000, SNAPSHOT_ENTRIES = 700, SAVE_EVERY_MS = 60_000, MIN_GAP_MS = 15_000, LIST_LIMIT = 300;

// Page → the game (or area) it belongs to, with the name players know it by.
export const PRESENCE_PAGES = Object.freeze({
  index: { key: 'home', label: 'الصفحة الرئيسية' },
  quiz: { key: 'quiz', label: 'تحدي العباقرة' },
  online: { key: 'quiz', label: 'تحدي العباقرة' },
  local: { key: 'quiz-local', label: 'تحدي العباقرة · جهاز واحد' },
  v5: { key: 'quiz-local', label: 'تحدي العباقرة · جهاز واحد' },
  picture: { key: 'picture', label: 'سباق الصور' },
  baloot: { key: 'baloot', label: 'البلوت' },
  snakes: { key: 'snakes', label: 'السلم والثعبان' },
  zahra: { key: 'zahra', label: 'الزهرة' },
  jackaroo: { key: 'jackaroo', label: 'جاكارو' },
  serpent: { key: 'serpent', label: 'حلبة الثعبان' },
  party: { key: 'party', label: 'الألعاب الجماعية' },
  sudoku: { key: 'sudoku', label: 'سودوكو' },
  'paths-online': { key: 'paths', label: 'توصيل الأرقام' },
  journey: { key: 'journey', label: 'رحلة النجوم' },
  memory: { key: 'memory', label: 'تحدي الذاكرة' },
  logic: { key: 'logic', label: 'تحدي المنطق' },
  puzzle: { key: 'puzzle', label: 'ترتيب الأرقام' },
  reaction: { key: 'reaction', label: 'سرعة الاستجابة' },
  dice: { key: 'dice', label: 'تحدي النرد' },
  shop: { key: 'shop', label: 'المتجر' },
  social: { key: 'social', label: 'الأصدقاء والحساب' },
  leaderboard: { key: 'leaderboard', label: 'الأبطال' },
  admin: { key: 'admin', label: 'لوحة المدير' },
});
const OTHER = { key: 'other', label: 'صفحات أخرى' };

export function presencePage(path) {
  const name = String(path || '/').split('?')[0].replace(/\/+$/, '').replace(/\.html$/, '').split('/').pop() || 'index';
  return Object.hasOwn(PRESENCE_PAGES, name) ? { page: name, ...PRESENCE_PAGES[name] } : { page: 'other', ...OTHER };
}

const cleanText = (value, max) => String(value ?? '').normalize('NFKC').replace(/[\u0000-\u001f\u007f<>‪-‮⁦-⁩]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
const ID = /^[a-z0-9]{8,24}$/;
const DEFAULT_NAMES = new Set(['لاعب العباقرة', 'لاعب', 'ضيف']); // the name a guest never chose

/** Validates one heartbeat from the page. Identity (user/name/verified) is set by the Worker only. */
export function cleanBeat(body, { country = '' } = {}) {
  if (!body || typeof body !== 'object') return null;
  const cid = String(body.cid || '').toLowerCase(), did = String(body.did || '').toLowerCase();
  if (!ID.test(cid) || !ID.test(did)) return null;
  const vis = ['visible', 'hidden', 'leave'].includes(body.vis) ? body.vis : 'visible';
  const { page } = presencePage(body.path);
  const room = /^\d{6}$/.test(String(body.room || '')) ? String(body.room) : '';
  const dev = ['m', 't', 'd'].includes(body.dev) ? body.dev : '';
  const cc = /^[A-Z]{2}$/.test(String(country || '')) ? String(country) : '';
  const guestName = cleanText(body.name, 20);
  return { cid, did, page, room, vis, dev, cc, guestName: DEFAULT_NAMES.has(guestName) ? '' : guestName, signedOut: body.user === '' };
}

export class PresenceRegistry {
  constructor(ctx) { this.ctx = ctx; this.entries = new Map(); this.loaded = null; this.savedAt = 0; this.dirty = false; }

  load() {
    this.loaded ??= (async () => {
      try {
        const saved = await this.ctx.storage.get('presence');
        const now = Date.now();
        for (const row of Array.isArray(saved?.entries) ? saved.entries : []) if (row?.cid && now - row.last < PRESENCE_TTL_MS) this.entries.set(row.cid, row);
        this.savedAt = Number(saved?.at) || 0;
      } catch {}
    })();
    return this.loaded;
  }

  prune(now = Date.now()) {
    let removed = 0;
    for (const [cid, row] of this.entries) if (now - row.last >= PRESENCE_TTL_MS) { this.entries.delete(cid); removed++; }
    if (removed) this.dirty = true;
  }

  beat(beat, identity = null, now = Date.now()) {
    if (beat.vis === 'leave') { if (this.entries.delete(beat.cid)) this.dirty = true; return { ok: true }; }
    const old = this.entries.get(beat.cid);
    // a tab keeps the account it proved; it loses it only when it signs out
    let user = old?.user || '', name = old?.user ? old.name : beat.guestName, verified = Boolean(old?.verified);
    if (identity?.user) { user = identity.user; name = identity.name || identity.user; verified = true; }
    else if (beat.signedOut && old?.user) { user = ''; name = beat.guestName; verified = false; }
    else if (!old?.user) name = beat.guestName;
    const same = old && old.page === beat.page && old.room === beat.room && old.vis === beat.vis && old.user === user;
    if (same && now - old.last < MIN_GAP_MS) return { ok: true, throttled: true };
    if (!old && this.entries.size >= MAX_ENTRIES) {
      let oldest = null; for (const row of this.entries.values()) if (!oldest || row.last < oldest.last) oldest = row;
      if (oldest) this.entries.delete(oldest.cid);
    }
    const since = old && old.page === beat.page && old.room === beat.room ? old.since : now;
    this.entries.set(beat.cid, { cid: beat.cid, did: beat.did, page: beat.page, room: beat.room, vis: beat.vis, dev: beat.dev || old?.dev || '', cc: beat.cc || old?.cc || '', user, name, verified, first: old?.first || now, since, last: now });
    this.dirty = true;
    return { ok: true, verified, user: verified ? user : '' };
  }

  async save(now = Date.now(), force = false) {
    if (!this.dirty || (!force && now - this.savedAt < SAVE_EVERY_MS)) return;
    this.savedAt = now; this.dirty = false;
    const entries = [...this.entries.values()].sort((a, b) => b.last - a.last).slice(0, SNAPSHOT_ENTRIES);
    try { await this.ctx.storage.put('presence', { at: now, entries }); } catch { this.dirty = true; }
  }

  summary(now = Date.now()) {
    this.prune(now);
    const rows = [...this.entries.values()];
    const people = new Map(); // one person per device: the most recent tab wins
    for (const row of rows) { const seen = people.get(row.did); if (!seen || row.last > seen.last || (row.vis !== 'hidden' && seen.vis === 'hidden')) people.set(row.did, row); }
    const persons = [...people.values()];
    const games = new Map(), rooms = new Map();
    for (const row of persons) {
      const { key, label } = presencePage(row.page);
      const g = games.get(key) || { key, label, people: 0, signed: 0, guests: 0, rooms: new Set() };
      g.people++; if (row.verified) g.signed++; else g.guests++; if (row.room) g.rooms.add(row.room); games.set(key, g);
      if (row.room) {
        const id = key + ':' + row.room, r = rooms.get(id) || { key, label, room: row.room, people: 0, names: [] };
        r.people++; if (r.names.length < 20) r.names.push(row.verified ? row.name || row.user : (row.name ? 'ضيف · ' + row.name : 'ضيف')); rooms.set(id, r);
      }
    }
    const list = persons.sort((a, b) => Number(b.verified) - Number(a.verified) || b.last - a.last).slice(0, LIST_LIMIT).map(row => {
      const { key, label } = presencePage(row.page);
      return { name: row.verified ? row.name || row.user : row.name || '', user: row.verified ? row.user : '', signed: Boolean(row.verified), game: key, label, room: row.room, device: row.dev, country: row.cc, state: row.vis === 'hidden' ? 'background' : 'active', since: row.since, first: row.first, last: row.last };
    });
    return {
      ok: true, now, beatMs: PRESENCE_BEAT_MS, ttlMs: PRESENCE_TTL_MS,
      people: persons.length, tabs: rows.length,
      signed: persons.filter(r => r.verified).length, guests: persons.filter(r => !r.verified).length,
      active: persons.filter(r => r.vis !== 'hidden').length, background: persons.filter(r => r.vis === 'hidden').length,
      inRooms: persons.filter(r => r.room).length,
      games: [...games.values()].map(g => ({ ...g, rooms: g.rooms.size })).sort((a, b) => b.people - a.people || a.label.localeCompare(b.label, 'ar')),
      rooms: [...rooms.values()].sort((a, b) => b.people - a.people || a.room.localeCompare(b.room)),
      list,
    };
  }

  async fetch(request) {
    await this.load();
    const url = new URL(request.url), now = Date.now();
    const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
    if (url.pathname === '/beat' && request.method === 'POST') {
      const body = await request.json().catch(() => null);
      const beat = cleanBeat(body?.beat, { country: body?.beat?.cc });
      if (!beat) return json({ ok: false, error: 'invalid' }, 400);
      const identity = body?.identity?.user && /^[a-z0-9_]{3,20}$/.test(body.identity.user) ? { user: body.identity.user, name: cleanText(body.identity.name, 24) } : null;
      const result = this.beat(beat, identity, now);
      if (Math.random() < 0.02) this.prune(now);
      await this.save(now, beat.vis === 'leave' && this.entries.size === 0);
      return json({ ...result, next: PRESENCE_BEAT_MS });
    }
    if (url.pathname === '/summary' && request.method === 'GET') { const data = this.summary(now); await this.save(now); return json(data); }
    return json({ ok: false, error: 'not_found' }, 404);
  }
}
