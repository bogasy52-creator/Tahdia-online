import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { mergeWorkerConfig, parseJsonc } from '../scripts/merge-worker-config.mjs';
const apply = fileURLToPath(new URL('../scripts/apply-zip-update.sh', import.meta.url));
const original = {
  name: 'tahdia-online', vars: { FEATURE: 'keep' },
  durable_objects: { bindings: [{ name: 'ROOMS', class_name: 'GameRoom' }] },
  migrations: [{ tag: 'v1', new_sqlite_classes: ['GameRoom'] }],
};
const incoming = {
  name: 'ignored-upload-name', vars: { FEATURE: 'overwrite' },
  durable_objects: { bindings: [...original.durable_objects.bindings, { name: 'QUICK_ARENA', class_name: 'QuickArena' }] },
  migrations: [...original.migrations, { tag: 'v6', new_sqlite_classes: ['QuickArena'] }],
};
test('keeps deployed settings and history while adding the V6 namespace once', () => {
  const merged = mergeWorkerConfig(original, incoming);
  assert.equal(merged.name, original.name);
  assert.deepEqual(merged.vars, original.vars);
  assert.deepEqual(merged.migrations, incoming.migrations);
  assert.deepEqual(merged.durable_objects.bindings, incoming.durable_objects.bindings);
  assert.deepEqual(mergeWorkerConfig(merged, incoming), merged);
  assert.equal(original.migrations.length, 1);
});
test('JSONC parser preserves URLs, escaped quotes and comment-like strings', () => {
  const config = parseJsonc('/* comment */ {"url":"https://game.test/a//b", "text":"/*keep*/ \\"yes\\"", // comment\n "values": [1, 2,],}');
  assert.equal(config.url, 'https://game.test/a//b');
  assert.equal(config.text, '/*keep*/ "yes"');
  assert.deepEqual(config.values, [1, 2]);
});
test('rejects rewriting a deployed migration or namespace', () => {
  const changed = structuredClone(incoming);
  changed.migrations[0].new_sqlite_classes = ['Replacement'];
  assert.throws(() => mergeWorkerConfig(original, changed), /rewrite deployed migration/);
  changed.migrations = structuredClone(incoming.migrations);
  changed.durable_objects.bindings[0].class_name = 'Replacement';
  assert.throws(() => mergeWorkerConfig(original, changed), /replace deployed.*binding/);
});
test('rejects class recreation, duplicate tags, missing migrations and destructive changes', () => {
  const changed = structuredClone(incoming);
  changed.migrations[1].new_sqlite_classes = ['GameRoom'];
  assert.throws(() => mergeWorkerConfig(original, changed), /recreates/);
  changed.migrations = [...incoming.migrations, incoming.migrations[1]];
  assert.throws(() => mergeWorkerConfig(original, changed), /duplicate/);
  changed.migrations = original.migrations;
  assert.throws(() => mergeWorkerConfig(original, changed), /no class migration/);
  changed.migrations = [...original.migrations, { tag: 'delete', deleted_classes: ['GameRoom'] }];
  assert.throws(() => mergeWorkerConfig(original, changed), /additive/);
});
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'v6-zip-installer-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const game = join(root, 'game'), payload = join(root, 'payload', 'snake_final');
  for (const project of [game, payload]) {
    await mkdir(join(project, 'public'), { recursive: true });
    await mkdir(join(project, 'src'), { recursive: true });
    await writeFile(join(project, 'package.json'), '{"name":"fixture"}\n');
    await writeFile(join(project, 'public/index.html'), project === game ? 'old' : 'v6');
    await writeFile(join(project, 'src/index.js'), 'export default {};\n');
  }
  await writeFile(join(game, 'wrangler.jsonc'), JSON.stringify(original));
  await writeFile(join(payload, 'wrangler.jsonc'), JSON.stringify(incoming));
  const zip = join(root, 'update.zip');
  function run() {
    const archive = spawnSync('zip', ['-qr', zip, '.'], { cwd: join(root, 'payload'), encoding: 'utf8' });
    assert.equal(archive.status, 0, archive.stderr);
    return spawnSync('bash', [apply, zip, game], { cwd: root, encoding: 'utf8' });
  }
  return { root, game, payload, zip, run };
}
test('installs one complete release, removes stale tests and merges its Worker config', async t => {
  const f = await fixture(t);
  await mkdir(join(f.game, 'test'));
  await writeFile(join(f.game, 'test/obsolete.test.js'), 'old test');
  await writeFile(join(f.game, 'obsolete.js'), 'old source');
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(await readFile(join(f.game, 'public/index.html'), 'utf8'), 'v6');
  await assert.rejects(readFile(join(f.game, 'test/obsolete.test.js')));
  await assert.rejects(readFile(join(f.game, 'obsolete.js')));
  await assert.rejects(readFile(f.zip));
  assert.deepEqual(JSON.parse(await readFile(join(f.game, 'wrangler.jsonc'), 'utf8')), mergeWorkerConfig(original, incoming));
});
test('a conflicting migration leaves the old release and upload intact', async t => {
  const f = await fixture(t);
  const conflict = structuredClone(incoming);
  conflict.migrations[0].new_sqlite_classes = ['WrongClass'];
  await writeFile(join(f.payload, 'wrangler.jsonc'), JSON.stringify(conflict));
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /rewrite deployed migration/);
  assert.equal(await readFile(join(f.game, 'public/index.html'), 'utf8'), 'old');
  assert.deepEqual(JSON.parse(await readFile(join(f.game, 'wrangler.jsonc'), 'utf8')), original);
  assert.ok((await readFile(f.zip)).length > 0);
});
