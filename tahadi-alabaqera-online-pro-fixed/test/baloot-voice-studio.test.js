import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { environment, api, signup } from './worker-harness.mjs';
import { BalootVoiceBank, VOICE_IDS, audioKind, MAX_CLIP_BYTES } from '../src/games/baloot-voice-bank.js';
import { VOICE_LINES } from '../public/assets/js/baloot-voice-pack.js';
import { encodeWav, shapeTake, trimOf, GROUPS } from '../public/assets/js/admin-voice-studio.js';

// 33.1.0: the manager records the Baloot calls in the admin page; every table plays them.
const wav = (seconds = 0.5, level = 0.5) => new Uint8Array(encodeWav(Float32Array.from({ length: Math.round(22050 * seconds) }, (_, i) => Math.sin(i / 7) * level)));
function bank() {
  const values = new Map();
  const storage = { async get(k) { return structuredClone(values.get(k)); }, async put(k, v) { if (typeof k === 'object') for (const [a, b] of Object.entries(k)) values.set(a, structuredClone(b)); else values.set(k, structuredClone(v)); }, async delete(k) { for (const x of [].concat(k)) values.delete(x); } };
  return { b: new BalootVoiceBank({ storage }, {}), values };
}
const owner = (path, init = {}) => new Request('https://balootvoice.internal' + path, { method: 'POST', ...init, headers: { 'x-bs-owner': '1', ...(init.headers || {}) } });

test('the studio records every call the table says', () => {
  assert.deepEqual(VOICE_IDS, Object.keys(VOICE_LINES));
  assert.ok(VOICE_IDS.length >= 56);
  // every call sits in exactly one group of the studio
  for (const id of VOICE_IDS) assert.equal(GROUPS.filter(([, test]) => test(id)).length, 1, id);
  for (const id of ['pass', 'sun', 'ashkal', 'hokom_S', 'thani_C', 'double', 'gahwa', 'sira', 'projects_sira_fifty', 'baloot', 'claim', 'caught', 'wrong', 'kaboot', 'review_claim', 'p16']) assert.ok(VOICE_IDS.includes(id), id);
});

test('a take is cut to the voice, evened out and kept as a small WAV', () => {
  const quiet = new Float32Array(22050), voice = Float32Array.from({ length: 11025 }, (_, i) => Math.sin(i / 5) * 0.3);
  const take = new Float32Array(quiet.length + voice.length + quiet.length);
  take.set(voice, quiet.length);
  const { from, to } = trimOf(take, 22050, 0.02);
  // 33.8.0: 0.12 s kept before the voice and 0.25 s after it, so a soft start or end is never cut
  assert.ok(from > 22050 - 2700 && from < 22050 - 2500 && to < 22050 + 11025 + 5600 && to > 22050 + 11025 + 5400, 'the quiet before and after is left out, with a margin');
  const shaped = shapeTake(take);
  assert.ok(shaped.length < 11025 + 8300);
  assert.ok(Math.max(...shaped.map(Math.abs)) > 0.8, 'the level is evened out');
  assert.throws(() => shapeTake(new Float32Array(22050)), /silent/);
  const bytes = new Uint8Array(encodeWav(shaped));
  assert.equal(audioKind(bytes), 'audio/wav');
  assert.equal(new DataView(bytes.buffer).getUint32(24, true), 22050);
});

test('the bank keeps, serves, replaces and removes one take per call', async () => {
  const { b } = bank();
  let res = await b.fetch(owner('/save?id=sun', { body: wav() }));
  assert.equal(res.status, 200);
  let pack = await res.json();
  assert.equal(pack.ready, 1);
  const first = pack.lines.sun.at;
  res = await b.fetch(new Request('https://balootvoice.internal/clip?id=sun'));
  assert.equal(res.headers.get('content-type'), 'audio/wav');
  assert.match(res.headers.get('cache-control'), /immutable/);
  assert.deepEqual(new Uint8Array(await res.arrayBuffer()), wav());
  // a new take of the same call gets a new timestamp (a new address for every device)
  pack = await (await b.fetch(owner('/save?id=sun', { body: wav(1) }))).json();
  assert.ok(pack.lines.sun.at > first);
  assert.equal((await (await b.fetch(new Request('https://balootvoice.internal/clip?id=sun'))).arrayBuffer()).byteLength, wav(1).length);
  // a long take is split below the storage limit and comes back whole
  const long = wav(3.5);
  assert.ok(long.length > 60_000);
  await b.fetch(owner('/save?id=p16', { body: long }));
  assert.deepEqual(new Uint8Array(await (await b.fetch(new Request('https://balootvoice.internal/clip?id=p16'))).arrayBuffer()), long);
  pack = await (await b.fetch(owner('/remove', { body: JSON.stringify({ id: 'sun' }) }))).json();
  assert.equal(pack.lines.sun, undefined);
  assert.equal((await b.fetch(new Request('https://balootvoice.internal/clip?id=sun'))).status, 404);
});

test('the bank refuses unknown calls, other files, long takes and anyone but the manager', async () => {
  const { b } = bank();
  assert.equal((await b.fetch(owner('/save?id=nope', { body: wav() }))).status, 400);
  assert.equal((await b.fetch(owner('/save?id=sun', { body: new TextEncoder().encode('<html>not a sound</html>') }))).status, 400);
  assert.equal((await b.fetch(owner('/save?id=sun', { body: wav(8) }))).status, 413, 'more than ' + MAX_CLIP_BYTES + ' bytes');
  assert.equal((await b.fetch(new Request('https://balootvoice.internal/save?id=sun', { method: 'POST', body: wav() }))).status, 403);
  assert.equal((await b.fetch(new Request('https://balootvoice.internal/remove', { method: 'POST', body: '{"id":"sun"}' }))).status, 403);
});

test('only the manager saves through the site; every table reads the calls', async () => {
  const env = environment();
  const player = await signup(env, 'player7');
  const manager = await signup(env, 'bosrag');
  const save = (token) => fetchWorker(env, '/api/baloot/voice/save?id=gahwa', { method: 'POST', headers: { authorization: 'Bearer ' + token }, body: wav() });
  assert.equal((await save(player.data.token)).status, 403);
  assert.equal((await save(manager.data.token)).status, 200);
  const pack = await api(env, '/api/baloot/voice/pack');
  assert.ok(pack.data.lines.gahwa.at > 0);
  const clip = await fetchWorker(env, '/api/baloot/voice/clip/gahwa');
  assert.equal(clip.status, 200);
  assert.equal(audioKind(new Uint8Array(await clip.arrayBuffer())), 'audio/wav');
  assert.equal((await fetchWorker(env, '/api/baloot/voice/clip/nope')).status, 404);
});
const Worker = await import('../src/index.js');
async function fetchWorker(env, path, init = {}) {
  return Worker.default.fetch(new Request('https://game.test' + path, { ...init, headers: { Origin: 'https://game.test', 'CF-Connecting-IP': '127.0.0.9', ...(init.headers || {}) } }), env);
}

test('the table plays the studio calls, and keeps the written calls for the rest', async () => {
  const voice = await readFile(new URL('../public/assets/js/baloot-voice.js', import.meta.url), 'utf8');
  assert.match(voice, /\/api\/baloot\/voice\/pack/);
  assert.match(voice, /\/api\/baloot\/voice\/clip\//);
  assert.match(voice, /const ready = \(\) => packReady \|\| studio > 0/);
  const admin = await readFile(new URL('../public/admin.html', import.meta.url), 'utf8');
  assert.match(admin, /data-admin-tab="voice"/);
  assert.match(admin, /admin-voice-studio\.js/);
  assert.doesNotMatch(await readFile(new URL('../public/assets/js/admin-voice-studio.js', import.meta.url), 'utf8'), /openai|api\.openai|apiKey/i, 'no outside service');
});
