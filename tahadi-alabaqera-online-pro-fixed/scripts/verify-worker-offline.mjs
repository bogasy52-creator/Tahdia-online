import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
const config = JSON.parse(await readFile(join(root, 'wrangler.jsonc'), 'utf8'));
assert.equal(config.name, 'tahdia-online');
assert.equal(config.main, 'src/index.js');
assert.equal(config.assets?.directory, './public');
assert.equal(config.assets?.binding, 'ASSETS');
assert.ok(config.durable_objects?.bindings?.some((b) => b.name === 'ROOMS' && b.class_name === 'GameRoom'));
assert.ok(config.durable_objects?.bindings?.some((b) => b.name === 'BOARD_ROOMS' && b.class_name === 'BoardRoom'));
assert.ok(config.migrations?.some((m) => (m.new_sqlite_classes || []).includes('GameRoom')));
assert.ok(config.migrations?.some((m) => (m.new_sqlite_classes || []).includes('BoardRoom')));

const srcPath = join(root, 'src/index.js');
const tmpPath = join(root, 'src/.verify-index.mjs');
const stubPath = join(root, 'scripts/.verify-cloudflare-stub.mjs');
const source = await readFile(srcPath, 'utf8');
assert.match(source, /export default\s*\{/);
assert.match(source, /export class GameRoom extends DurableObject/);
assert.match(source, /export class BoardRoom extends DurableObject/);
await writeFile(stubPath, 'export class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }\n');
await writeFile(tmpPath, source.replace('from "cloudflare:workers"', 'from "../scripts/.verify-cloudflare-stub.mjs"'));

try {
  const mod = await import(pathToFileURL(tmpPath).href + `?v=${Date.now()}`);
  const assets = { fetch: async (request) => new Response(`asset:${new URL(request.url).pathname}`) };
  const binding = {};
  const env = { ROOMS: binding, BOARD_ROOMS: binding, ASSETS: assets };

  let response = await mod.default.fetch(new Request('https://game.test/api/health'), env);
  assert.equal(response.status, 200);
  let body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.online, true);
  assert.equal(body.version, '2.5.0');

  response = await mod.default.fetch(new Request('https://game.test/api/catalog'), env);
  assert.equal(response.status, 200);
  body = await response.json();
  assert.equal(body.categories.length, 23);

  response = await mod.default.fetch(new Request('https://game.test/index.html'), env);
  assert.equal(await response.text(), 'asset:/index.html');

  response = await mod.default.fetch(new Request('https://game.test/api/health', {
    headers: { Origin: 'https://foreign.example' },
  }), env);
  assert.equal(response.status, 403);

  assert.equal(typeof mod.GameRoom.prototype.fetch, 'function');
  assert.equal(typeof mod.BoardRoom.prototype.fetch, 'function');
  console.log('Offline Worker runtime/config verification passed.');
} finally {
  await Promise.allSettled([unlink(tmpPath), unlink(stubPath)]);
}
