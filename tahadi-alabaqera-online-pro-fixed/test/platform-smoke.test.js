import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const publicDir = join(root, 'public');

const requiredAssets = [
  'assets/css/platform.css',
  'assets/js/audio-manager.js',
  'assets/js/platform.js',
  'assets/js/board-online.js',
  'assets/css/board-premium.css',
  'snakes.html',
  'dice.html',
  'zahra.html',
  'jackaroo.html',
];

test('expanded platform assets exist', async () => {
  for (const rel of requiredAssets) await access(join(publicDir, rel));
});

test('home links every game and both quiz modes', async () => {
  const html = await readFile(join(publicDir, 'index.html'), 'utf8');
  for (const href of ['/local', '/online', '/snakes', '/dice', '/zahra', '/jackaroo']) {
    assert.match(html, new RegExp(`href=["']${href.replace('.', '\\.')}`));
  }
});

test('quiz pages load shared audio manager', async () => {
  for (const file of ['local.html', 'online.html']) {
    const html = await readFile(join(publicDir, file), 'utf8');
    assert.match(html, /assets\/js\/audio-manager\.js/);
  }
});

test('service worker pre-caches the complete game hub shell', async () => {
  const sw = await readFile(join(publicDir, 'service-worker.js'), 'utf8');
  for (const asset of [
    '/snakes', '/dice', '/zahra', '/jackaroo',
    '/assets/css/platform.css', '/assets/css/game-kit.css', '/assets/css/board-premium.css',
    '/assets/js/audio-manager.js', '/assets/js/platform.js', '/assets/js/board-online.js',
    '/assets/js/engines/snakes-engine.js', '/assets/js/engines/dice-engine.js',
    '/assets/js/engines/ludo-engine.js', '/assets/js/engines/jackaroo-engine.js',
  ]) {
    assert.ok(sw.includes(asset), `service worker must cache ${asset}`);
  }
});

test('package exposes repeatable test and verification commands', async () => {
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts.test, 'node --test test/*.test.js');
  assert.equal(pkg.scripts.verify, 'npm test && node scripts/verify-static.mjs && npm run check');
});

test('health endpoint reports the 2.2 platform release', async () => {
  const worker = await readFile(join(root, 'src/index.js'), 'utf8');
  assert.match(worker, /version:\s*["']2\.2\.0["']/);
});

test('wrangler deploys to the existing tahdia-online worker', async () => {
  const raw = await readFile(join(root, 'wrangler.jsonc'), 'utf8');
  const config = JSON.parse(raw.replace(/^\s*\/\/.*$/gm, ''));
  assert.equal(config.name, 'tahdia-online');
});

test('board games expose shared online room client', async () => {
  for (const file of ['snakes.html', 'zahra.html', 'jackaroo.html']) {
    const html = await readFile(join(publicDir, file), 'utf8');
    assert.match(html, /assets\/js\/board-online\.js/);
    assert.match(html, /createRoom/);
    assert.match(html, /joinRoom/);
  }
});

test('worker binds a dedicated durable object for online board games', async () => {
  const raw = await readFile(join(root, 'wrangler.jsonc'), 'utf8');
  const config = JSON.parse(raw.replace(/^\s*\/\/.*$/gm, ''));
  assert.ok(config.durable_objects.bindings.some((b) => b.name === 'BOARD_ROOMS' && b.class_name === 'BoardRoom'));
  assert.ok(config.migrations.some((m) => (m.new_sqlite_classes || []).includes('BoardRoom')));
});

test('jackaroo server masks opponent cards in online snapshots', async () => {
  const worker = await readFile(join(root, 'src/index.js'), 'utf8');
  assert.match(worker, /state\.hands\s*=\s*\(state\.hands\s*\|\|\s*\[\]\)\.map/);
  assert.match(worker, /i === me \? hand : Array\(hand\.length\)\.fill\("\?"\)/);
});
