import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const script = fileURLToPath(new URL('../../.github/scripts/apply-zip-update.sh', import.meta.url));
const gameName = 'tahadi-alabaqera-online-pro-fixed';
const workflowTest=existsSync(script)?test:test.skip;

async function writeProject(root, marker) {
  await mkdir(join(root, 'public'), { recursive: true });
  await mkdir(join(root, 'src'), { recursive: true });
  await writeFile(join(root, 'package.json'), '{"name":"zip-fixture"}\n');
  await writeFile(join(root, 'wrangler.jsonc'), '{"name":"zip-fixture"}\n');
  await writeFile(join(root, 'public', 'index.html'), `${marker}\n`);
  await writeFile(join(root, 'src', 'index.js'), `export default ${JSON.stringify(marker)};\n`);
}

function createZip(source, destination) {
  const result = spawnSync('zip', ['-qr', destination, '.'], {
    cwd: source,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
}

function applyZip(repo, zip, game) {
  return spawnSync('bash', [script, zip, game], {
    cwd: repo,
    encoding: 'utf8',
  });
}

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'busraj-zip-update-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const repo = join(root, 'repo');
  const game = join(repo, gameName);
  await writeProject(game, 'old version');
  return { root, repo, game };
}

workflowTest('applies a ZIP whose project files are at the archive root', async (t) => {
  const { root, repo, game } = await fixture(t);
  const payload = join(root, 'payload');
  const zip = join(repo, 'update.zip');
  await writeProject(payload, 'direct update');
  createZip(payload, zip);

  const result = applyZip(repo, zip, game);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(await readFile(join(game, 'public', 'index.html'), 'utf8'), 'direct update\n');
  await assert.rejects(readFile(zip));
});

workflowTest('finds the project inside wrapper folders before applying it', async (t) => {
  const { root, repo, game } = await fixture(t);
  const payload = join(root, 'payload');
  const wrappedProject = join(payload, 'phone-download', gameName);
  const zip = join(repo, 'wrapped.zip');
  await writeProject(wrappedProject, 'wrapped update');
  createZip(payload, zip);

  const result = applyZip(repo, zip, game);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(await readFile(join(game, 'public', 'index.html'), 'utf8'), 'wrapped update\n');
  await assert.rejects(readFile(zip));
});

workflowTest('preserves the deployed Worker configuration while applying a ZIP', async (t) => {
  const { root, repo, game } = await fixture(t);
  const payload = join(root, 'payload');
  const zip = join(repo, 'update.zip');
  const deployedConfig = '{"name":"deployed-worker","migrations":[{"tag":"v1"}]}\n';
  await writeFile(join(game, 'wrangler.jsonc'), deployedConfig);
  await writeProject(payload, 'updated game');
  await writeFile(join(payload, 'wrangler.jsonc'), '{"name":"replacement-worker"}\n');
  createZip(payload, zip);

  const result = applyZip(repo, zip, game);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(await readFile(join(game, 'wrangler.jsonc'), 'utf8'), deployedConfig);
  assert.equal(await readFile(join(game, 'public', 'index.html'), 'utf8'), 'updated game\n');
});

workflowTest('rejects an invalid ZIP without touching the current project', async (t) => {
  const { root, repo, game } = await fixture(t);
  const payload = join(root, 'payload');
  const zip = join(repo, 'invalid.zip');
  await mkdir(payload, { recursive: true });
  await writeFile(join(payload, 'readme.txt'), 'not a project\n');
  createZip(payload, zip);

  const result = applyZip(repo, zip, game);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /valid project/i);
  assert.equal(await readFile(join(game, 'public', 'index.html'), 'utf8'), 'old version\n');
  assert.equal(dirname(zip), repo);
  assert.equal(await readFile(zip).then((value) => value.length > 0), true);
});
