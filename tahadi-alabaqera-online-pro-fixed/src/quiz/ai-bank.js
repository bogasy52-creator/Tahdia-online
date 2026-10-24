// Tahdia 31.0.0 — the shared bank of AI quiz pictures.
// One Durable Object instance keeps the generated WebP files (split below the
// storage value limit) and an index. Only the manager can add or remove
// pictures; everyone can read the pack and the images.
import { AI_SUBJECTS, aiSubject, aiQuestion, aiCategory } from './ai-subjects.js';
import { imageGenerationConfig, generateQuizImage } from '../images/generate.js';

export const QUIZ_AI_OBJECT = '__quiz_ai__:v1';
const CHUNK = 60_000, INDEX = 'quizai:index', QUOTA = 'quizai:quota';
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const riyadhDay = (now = Date.now()) => new Date(now + 10_800_000).toISOString().slice(0, 10);
const chunkKey = (id, i) => 'quizai:img:' + id + ':' + i;
export function quizAiLimit(env) { return Math.min(60, Math.max(1, Math.floor(Number(env?.AI_QUIZ_DAILY_LIMIT) || 12))); }
// The next picture to make: the level with the fewest pictures first, then the
// least used group, so six pictures already open the category with variety.
export function nextAiSubject(index = {}) {
  const levels = {}, groups = {};
  for (const s of AI_SUBJECTS) if (index[s.id]) { levels[s.level] = (levels[s.level] || 0) + 1; groups[s.group] = (groups[s.group] || 0) + 1; }
  let best = null, score = Infinity;
  AI_SUBJECTS.forEach((s, i) => { if (index[s.id]) return; const value = (levels[s.level] || 0) * 1e6 + (groups[s.group] || 0) * 1e3 + i; if (value < score) { score = value; best = s; } });
  return best;
}

export class QuizImageBank {
  constructor(ctx, env, { generate = generateQuizImage } = {}) { this.ctx = ctx; this.env = env; this.generate = generate; this.busy = false; }
  async index() { const value = await this.ctx.storage.get(INDEX); return value && typeof value === 'object' ? value : {}; }
  async used() { const q = await this.ctx.storage.get(QUOTA); return q?.day === riyadhDay() ? q.used : 0; }
  async pack() {
    const idx = await this.index(), items = AI_SUBJECTS.filter((s) => idx[s.id]).map((s) => aiQuestion(s, idx[s.id].at));
    return { ok: true, enabled: imageGenerationConfig(this.env).enabled, limit: quizAiLimit(this.env), usedToday: await this.used(), total: AI_SUBJECTS.length, ready: items.length, category: Boolean(aiCategory(items)), items };
  }
  async image(id) {
    const subject = aiSubject(id), meta = subject && (await this.index())[subject.id];
    if (!meta) return json({ ok: false, error: 'not_found' }, 404);
    const parts = await Promise.all(Array.from({ length: meta.chunks }, (_, i) => this.ctx.storage.get(chunkKey(subject.id, i)))), out = new Uint8Array(meta.length);
    let offset = 0;
    for (const part of parts) { if (!part) return json({ ok: false, error: 'not_found' }, 404); const bytes = new Uint8Array(part); if (offset + bytes.length > out.length) return json({ ok: false, error: 'not_found' }, 404); out.set(bytes, offset); offset += bytes.length; }
    return new Response(out, { headers: { 'content-type': 'image/webp', 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' } });
  }
  async create(body) {
    if (!imageGenerationConfig(this.env).enabled) return json({ ok: false, error: 'not_configured' }, 503);
    if (this.busy) return json({ ok: false, error: 'busy' }, 409);
    const idx = await this.index(), subject = body?.id ? aiSubject(body.id) : nextAiSubject(idx);
    if (!subject) return json({ ok: false, error: body?.id ? 'invalid_subject' : 'complete' }, body?.id ? 400 : 409);
    const day = riyadhDay(), limit = quizAiLimit(this.env), used = await this.used();
    if (used >= limit) return json({ ok: false, error: 'daily_limit', limit }, 429);
    this.busy = true;
    await this.ctx.storage.put(QUOTA, { day, used: used + 1 });
    try {
      const out = await this.generate(this.env, subject), bytes = new Uint8Array(out.bytes), chunks = Math.ceil(bytes.length / CHUNK), entries = {};
      for (let i = 0; i < chunks; i++) entries[chunkKey(subject.id, i)] = bytes.slice(i * CHUNK, (i + 1) * CHUNK);
      await this.ctx.storage.put(entries);
      const next = await this.index(), old = next[subject.id];
      if (old && old.chunks > chunks) await this.ctx.storage.delete(Array.from({ length: old.chunks - chunks }, (_, k) => chunkKey(subject.id, chunks + k)));
      next[subject.id] = { at: Date.now(), length: bytes.length, chunks };
      await this.ctx.storage.put(INDEX, next);
      return json({ ...(await this.pack()), generated: subject.id });
    } catch (error) {
      const q = await this.ctx.storage.get(QUOTA);
      if (q?.day === day) await this.ctx.storage.put(QUOTA, { day, used: Math.max(0, q.used - 1) });
      return json({ ok: false, error: error?.message === 'not_configured' ? 'not_configured' : 'generation_failed' }, 502);
    } finally { this.busy = false; }
  }
  async remove(body) {
    const subject = aiSubject(body?.id), idx = await this.index(), meta = subject && idx[subject.id];
    if (!meta) return json({ ok: false, error: 'not_found' }, 404);
    await this.ctx.storage.delete(Array.from({ length: meta.chunks }, (_, i) => chunkKey(subject.id, i)));
    delete idx[subject.id];await this.ctx.storage.put(INDEX, idx);
    return json({ ...(await this.pack()), removed: subject.id });
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/pack' && request.method === 'GET') return json(await this.pack());
    if (url.pathname === '/image' && request.method === 'GET') return this.image(url.searchParams.get('id'));
    if (request.method !== 'POST') return json({ ok: false, error: 'not_found' }, 404);
    // The Worker sets this header only after it verified the manager's session.
    if (request.headers.get('x-bs-owner') !== '1') return json({ ok: false, error: 'forbidden' }, 403);
    const body = await request.json().catch(() => ({}));
    if (url.pathname === '/generate') return this.create(body);
    if (url.pathname === '/remove') return this.remove(body);
    return json({ ok: false, error: 'not_found' }, 404);
  }
}
