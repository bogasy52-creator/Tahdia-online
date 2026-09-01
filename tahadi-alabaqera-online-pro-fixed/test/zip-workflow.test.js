import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const findZipScript = join(repoRoot, '.github', 'scripts', 'find-uploaded-zip.sh');
const verifyUpdateScript = join(repoRoot, '.github', 'scripts', 'verify-project-update.sh');
const findZipTest=existsSync(findZipScript)?test:test.skip;
const verifyUpdateTest=existsSync(verifyUpdateScript)?test:test.skip;

async function temporaryDirectory(t, prefix) {
  const root = await mkdtemp(join(tmpdir(), prefix));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

findZipTest('finds a root ZIP whose name contains Arabic text and spaces', async (t) => {
  const repo = await temporaryDirectory(t, 'busraj-find-zip-');
  const zipName = '\u200fتحديث اللعبة.zip';
  await writeFile(join(repo, zipName), 'fixture');

  const result = spawnSync('bash', [findZipScript], {
    cwd: repo,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, `${zipName}\n`);
});

verifyUpdateTest('installs project dev dependencies before verification', async (t) => {
  const project = await temporaryDirectory(t, 'busraj-verify-update-');
  const dependency = join(project, 'fixture-checker');
  await mkdir(dependency, { recursive: true });
  await writeFile(join(dependency, 'package.json'), JSON.stringify({
    name: 'fixture-checker',
    version: '1.0.0',
    bin: { 'fixture-check': 'cli.cjs' },
  }));
  await writeFile(join(dependency, 'cli.cjs'), [
    '#!/usr/bin/env node',
    "require('node:fs').writeFileSync('verified.txt', 'verified\\n');",
    '',
  ].join('\n'));
  await chmod(join(dependency, 'cli.cjs'), 0o755);
  await writeFile(join(project, 'package.json'), JSON.stringify({
    name: 'verification-fixture',
    version: '1.0.0',
    private: true,
    scripts: { verify: 'fixture-check' },
    devDependencies: { 'fixture-checker': 'file:./fixture-checker' },
  }));

  const result = spawnSync('bash', [verifyUpdateScript, project], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(await readFile(join(project, 'verified.txt'), 'utf8'), 'verified\n');
});
