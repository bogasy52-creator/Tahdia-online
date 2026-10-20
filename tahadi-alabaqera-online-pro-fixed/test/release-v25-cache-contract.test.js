import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = async p => readFile(new URL('../' + p, import.meta.url), 'utf8');
test('v25 release verification and cache builder agree on the same version', async () => {
 const [packageText, verifier, builder] = await Promise.all([
  read('package.json'), read('scripts/verify-v7.mjs'), read('scripts/build-offline.mjs')
 ]);
 const version = JSON.parse(packageText).version;
 assert.equal(version, '26.0.0');
 assert.match(builder, /busraj-games-v55-release-26-0-0/);
 assert.match(verifier, /busraj-games-v55-release-26-0-0/);
 assert.match(verifier, /assert\.equal\(pkg\.version,'26\.0\.0'\)/);
});
