// Tahdia 33.1.0 — the Baloot calls the manager records in the voice studio.
// The manager records each call with the phone's own microphone in the admin
// page: no key, no outside service. One Durable Object instance keeps one clip
// per call (split below the storage value limit) and an index; every table
// reads the index and fetches a call the first time it is said (each clip is
// cached for good by its own timestamp). Only the manager may save or remove a
// clip: the Worker checks the session before it forwards those requests.
import { VOICE_LINES } from '../../public/assets/js/baloot-voice-pack.js';

export const BALOOT_VOICE_OBJECT = '__baloot_voice__:v1';
export const VOICE_IDS = Object.freeze(Object.keys(VOICE_LINES));
export const MAX_CLIP_BYTES = 320_000;
const CHUNK = 60_000, INDEX = 'voice:index';
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const chunkKey = (id, i) => 'voice:clip:' + id + ':' + i;
export const voiceId = (id) => (VOICE_IDS.includes(String(id)) ? String(id) : null);

/** The kind of a sound file from its first bytes: WAV or MP3 (else null). */
export function audioKind(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  if (b.length < 16) return null;
  const tag = String.fromCharCode(...b.slice(0, 4)), wave = String.fromCharCode(...b.slice(8, 12));
  if (tag === 'RIFF' && wave === 'WAVE') return 'audio/wav';
  if (tag.startsWith('ID3') || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return 'audio/mpeg';
  return null;
}

export class BalootVoiceBank {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; }
  async index() {
    const value = await this.ctx.storage.get(INDEX);
    return value && typeof value === 'object' && value.lines ? value : { rev: 0, lines: {} };
  }
  async pack() {
    const idx = await this.index(), lines = {};
    for (const id of VOICE_IDS) if (idx.lines[id]) lines[id] = { at: idx.lines[id].at, bytes: idx.lines[id].length };
    return { ok: true, rev: idx.rev || 0, total: VOICE_IDS.length, ready: Object.keys(lines).length, lines };
  }
  async clip(id) {
    const meta = voiceId(id) && (await this.index()).lines[id];
    if (!meta) return json({ ok: false, error: 'not_found' }, 404);
    const parts = await Promise.all(Array.from({ length: meta.chunks }, (_, i) => this.ctx.storage.get(chunkKey(id, i))));
    const out = new Uint8Array(meta.length);
    let offset = 0;
    for (const part of parts) {
      if (!part) return json({ ok: false, error: 'not_found' }, 404);
      const bytes = new Uint8Array(part);
      if (offset + bytes.length > out.length) return json({ ok: false, error: 'not_found' }, 404);
      out.set(bytes, offset);
      offset += bytes.length;
    }
    if (offset !== out.length) return json({ ok: false, error: 'not_found' }, 404);
    return new Response(out, { headers: { 'content-type': meta.type, 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' } });
  }
  async save(id, input) {
    if (!voiceId(id)) return json({ ok: false, error: 'invalid_line' }, 400);
    const bytes = new Uint8Array(input || []), type = audioKind(bytes);
    if (!type) return json({ ok: false, error: 'invalid_audio' }, 400);
    if (bytes.length > MAX_CLIP_BYTES) return json({ ok: false, error: 'too_long' }, 413);
    const chunks = Math.ceil(bytes.length / CHUNK), entries = {};
    for (let i = 0; i < chunks; i++) entries[chunkKey(id, i)] = bytes.slice(i * CHUNK, (i + 1) * CHUNK);
    await this.ctx.storage.put(entries);
    const idx = await this.index(), old = idx.lines[id];
    if (old && old.chunks > chunks) await this.ctx.storage.delete(Array.from({ length: old.chunks - chunks }, (_, k) => chunkKey(id, chunks + k)));
    // the timestamp names this take: a new take is a new address, so no device keeps the old one
    idx.lines[id] = { at: Math.max(Date.now(), (old?.at || 0) + 1), length: bytes.length, chunks, type };
    idx.rev = (idx.rev || 0) + 1;
    await this.ctx.storage.put(INDEX, idx);
    return json({ ...(await this.pack()), saved: id });
  }
  async remove(id) {
    const idx = await this.index(), meta = voiceId(id) && idx.lines[id];
    if (!meta) return json({ ok: false, error: 'not_found' }, 404);
    await this.ctx.storage.delete(Array.from({ length: meta.chunks }, (_, i) => chunkKey(id, i)));
    delete idx.lines[id];
    idx.rev = (idx.rev || 0) + 1;
    await this.ctx.storage.put(INDEX, idx);
    return json({ ...(await this.pack()), removed: id });
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/pack' && request.method === 'GET') return json(await this.pack());
    if (url.pathname === '/clip' && request.method === 'GET') return this.clip(url.searchParams.get('id'));
    if (request.method !== 'POST') return json({ ok: false, error: 'not_found' }, 404);
    // The Worker sets this header only after it verified the manager's session.
    if (request.headers.get('x-bs-owner') !== '1') return json({ ok: false, error: 'forbidden' }, 403);
    if (url.pathname === '/save') return this.save(url.searchParams.get('id'), await request.arrayBuffer());
    const body = await request.json().catch(() => ({}));
    if (url.pathname === '/remove') return this.remove(String(body?.id || ''));
    return json({ ok: false, error: 'not_found' }, 404);
  }
}
