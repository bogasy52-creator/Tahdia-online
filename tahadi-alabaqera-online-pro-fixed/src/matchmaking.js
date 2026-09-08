import { DurableObject } from 'cloudflare:workers';

const WAIT_MS = 90_000;
const GAMES = new Set(['quiz', 'snakes', 'zahra', 'jackaroo']);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  });
}

function name(value) { return String(value || 'لاعب').normalize('NFKC').trim().replace(/[\u0000-\u001F\u007F<>]/g, '').slice(0, 20) || 'لاعب'; }
function roomCode() { return String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000)); }

/**
 * One Durable Object per game type. It keeps a short-lived queue and creates
 * a normal quiz/board room when two compatible players arrive. The game room
 * remains authoritative; matchmaking only pairs players and never trusts a
 * client-provided score.
 */
export class MatchmakingRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.tickets = {};
    this.ctx.blockConcurrencyWhile(async () => { this.tickets = (await this.ctx.storage.get('tickets')) || {}; });
  }

  prune(now = Date.now()) {
    let changed = false;
    for (const [id, ticket] of Object.entries(this.tickets)) {
      if (!ticket || now - Number(ticket.createdAt || 0) > WAIT_MS * 2) { delete this.tickets[id]; changed = true; }
    }
    return changed;
  }

  async persist() { await this.ctx.storage.put('tickets', this.tickets); }

  async createRoom(game, host, guest) {
    const board = game !== 'quiz';
    const binding = board ? this.env.BOARD_ROOMS : this.env.ROOMS;
    if (!binding) throw new Error('room_binding_missing');
    const hostKey = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = roomCode();
      const stub = binding.get(binding.idFromName(code));
      const path = board ? 'https://board.internal/init' : 'https://room.internal/init';
      const body = board
        ? { code, hostKey, game, playerLimit: game === 'jackaroo' ? 4 : 2, name: host.name }
        : { code, hostKey, name: host.name, playerLimit: 2 };
      const res = await stub.fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      if (res.status === 201) return { code, hostKey, playerLimit: body.playerLimit };
    }
    throw new Error('room_create_failed');
  }

  async fetch(request) {
    const url = new URL(request.url);
    const now = Date.now();
    if (this.prune(now)) await this.persist();

    if (url.pathname === '/join' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const game = String(body.game || 'quiz').toLowerCase();
      if (!GAMES.has(game)) return json({ ok: false, error: 'اللعبة غير مدعومة' }, 400);
      // المستوى/الخبرة قد تصل من عميل قديم، لكنها ليست معيارًا للمطابقة.
      // في بداية الإطلاق نريد إدخال اللاعب مع أول منافس متاح في نفس اللعبة
      // بدل إبقائه عالقًا بانتظار لاعب قريب منه بالنقاط أو الخبرة.
      const level = Math.max(1, Math.min(100, Number(body.level) || 1));
      const current = { id: crypto.randomUUID(), name: name(body.name), level, game, createdAt: now, status: 'waiting', result: null };
      const candidate = Object.values(this.tickets)
        .filter((x) => x?.status === 'waiting' && x.game === game)
        .sort((a, b) => Number(a.createdAt) - Number(b.createdAt))[0];
      if (!candidate) {
        this.tickets[current.id] = current;
        await this.persist();
        await this.ctx.storage.setAlarm(now + WAIT_MS);
        return json({ ok: true, ticket: current.id, status: 'searching', game });
      }

      const room = await this.createRoom(game, candidate, current);
      const matchedAt = Date.now();
      candidate.status = 'matched';
      candidate.result = { code: room.code, game, role: 'host', hostKey: room.hostKey, playerLimit: room.playerLimit, opponent: current.name, matchedAt };
      current.status = 'matched';
      current.result = { code: room.code, game, role: 'guest', hostKey: null, playerLimit: room.playerLimit, opponent: candidate.name, matchedAt };
      this.tickets[candidate.id] = candidate;
      this.tickets[current.id] = current;
      await this.persist();
      return json({ ok: true, ticket: current.id, status: 'matched', ...current.result });
    }

    if (url.pathname === '/status' && request.method === 'GET') {
      const ticket = String(url.searchParams.get('ticket') || '');
      const record = this.tickets[ticket];
      if (!record) return json({ ok: false, error: 'تذكرة البحث غير موجودة أو انتهت' }, 404);
      if (record.status === 'matched') return json({ ok: true, ticket, status: 'matched', ...record.result });
      return json({ ok: true, ticket, status: 'searching', game: record.game, waitedMs: Math.max(0, now - record.createdAt) });
    }

    if (url.pathname === '/cancel' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const ticket = String(body.ticket || '');
      if (this.tickets[ticket]) delete this.tickets[ticket];
      await this.persist();
      return json({ ok: true, status: 'cancelled' });
    }
    return json({ ok: false, error: 'not_found' }, 404);
  }

  async alarm() {
    if (this.prune()) await this.persist();
    const waiting = Object.values(this.tickets).filter((x) => x?.status === 'waiting');
    if (waiting.length) await this.ctx.storage.setAlarm(Date.now() + WAIT_MS);
  }
}
