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
  'snakes.html',
  'dice.html',
  'zahra.html',
  'jackaroo.html',
  'assets/js/online/room-client.js',
  'assets/js/online/room-lobby.js',
];

test('expanded platform assets exist', async () => {
  for (const rel of requiredAssets) await access(join(publicDir, rel));
});

test('home links every game through Cloudflare canonical routes', async () => {
  const html = await readFile(join(publicDir, 'index.html'), 'utf8');
  for (const route of ['local', 'online', 'snakes', 'dice', 'zahra', 'jackaroo']) {
    assert.match(html, new RegExp(`href=["']/${route}["']`));
    assert.doesNotMatch(html, new RegExp(`href=["'][^"']*${route}\\.html["']`));
  }
});

test('quiz pages load shared audio manager', async () => {
  for (const file of ['local.html', 'online.html']) {
    const html = await readFile(join(publicDir, file), 'utf8');
    assert.match(html, /assets\/js\/audio-manager\.js/);
  }
});

test('online room navigation and invitations keep the canonical route', async () => {
  const html = await readFile(join(publicDir, 'online.html'), 'utf8');
  assert.doesNotMatch(html, /online\.html/);
  assert.match(html, /new URL\('\/online',location\.origin\)/);
});

test('service worker pre-caches the complete game hub shell', async () => {
  const sw = await readFile(join(publicDir, 'service-worker.js'), 'utf8');
  assert.doesNotMatch(sw, /\.\/index\.html/);
  assert.match(sw, /caches\.match\('\.\/'\)/);
  for (const route of ['local', 'online', 'snakes', 'dice', 'zahra', 'jackaroo']) {
    assert.match(sw, new RegExp(`["']\\./${route}["']`));
    assert.doesNotMatch(sw, new RegExp(`["']\\./${route}\\.html["']`));
  }
  for (const asset of [
    './assets/css/platform.css', './assets/css/game-kit.css',
    './assets/js/audio-manager.js', './assets/js/platform.js',
    './assets/js/engines/snakes-engine.js', './assets/js/engines/dice-engine.js',
    './assets/js/engines/ludo-engine.js', './assets/js/engines/jackaroo-engine.js',
    './assets/js/online/room-client.js', './assets/js/online/room-lobby.js',
  ]) {
    assert.ok(sw.includes(asset), `service worker must cache ${asset}`);
  }
});

test('package exposes offline-safe and Cloudflare verification commands', async () => {
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts.test, 'node --test test/*.test.js');
  assert.equal(pkg.scripts.check, 'node scripts/verify-worker-config.mjs');
  assert.equal(pkg.scripts['check:cloudflare'], 'wrangler deploy --dry-run');
  assert.equal(pkg.scripts.verify, 'npm test && node scripts/verify-static.mjs && npm run check');
  assert.equal(pkg.scripts['verify:full'], 'npm run verify && npm run check:cloudflare');
});

test('health endpoint reports the 2.0 platform release', async () => {
  const worker = await readFile(join(root, 'src/index.js'), 'utf8');
  assert.match(worker, /version:\s*["']2\.0\.0["']/);
});

test('wrangler deploys to the existing tahdia-online worker', async () => {
  const raw = await readFile(join(root, 'wrangler.jsonc'), 'utf8');
  const config = JSON.parse(raw.replace(/^\s*\/\/.*$/gm, ''));
  assert.equal(config.name, 'tahdia-online');
});

test('board-game online room subsystem is wired separately from quiz rooms', async () => {
  const worker = await readFile(join(root, 'src/index.js'), 'utf8');
  const raw = await readFile(join(root, 'wrangler.jsonc'), 'utf8');
  const config = JSON.parse(raw.replace(/^\s*\/\/.*$/gm, ''));
  const binding = config.durable_objects.bindings.find((item) => item.name === 'BOARD_ROOMS');
  assert.equal(binding?.class_name, 'BoardGameRoom');
  assert.match(worker, /\/api\/games\/rooms/);
  assert.match(worker, /export class BoardGameRoom extends BoardGameRoomBase/);
  const boardRoom = await readFile(join(root, 'src/rooms/board-game-room.js'), 'utf8');
  assert.match(boardRoom, /export class BoardGameRoom extends DurableObject/);
  assert.ok(config.migrations.some((m) => (m.new_sqlite_classes || []).includes('BoardGameRoom')));
});

test('premium snakes page uses dedicated board assets and online lobby controls', async () => {
  for (const rel of [
    'assets/css/board-premium.css',
    'assets/css/snakes-premium.css',
    'assets/js/games/snakes-ui.js',
  ]) await access(join(publicDir, rel));
  const html = await readFile(join(publicDir, 'snakes.html'), 'utf8');
  assert.match(html, /assets\/css\/board-premium\.css/);
  assert.match(html, /assets\/css\/snakes-premium\.css/);
  assert.match(html, /assets\/js\/games\/snakes-ui\.js/);
  assert.match(html, /id=["']onlineSetup["']/);
  assert.match(html, /id=["']roomCode["']/);
  assert.match(html, /id=["']jumpOverlay["']/);
  assert.doesNotMatch(html, /🐍|🪜/);
});

test('premium jackaroo page uses board interaction instead of long action list', async () => {
  for (const rel of [
    'assets/css/jackaroo-premium.css',
    'assets/js/games/jackaroo-ui.js',
  ]) await access(join(publicDir, rel));
  const html = await readFile(join(publicDir, 'jackaroo.html'), 'utf8');
  assert.match(html, /assets\/css\/board-premium\.css/);
  assert.match(html, /assets\/css\/jackaroo-premium\.css/);
  assert.match(html, /assets\/js\/games\/jackaroo-ui\.js/);
  assert.match(html, /id=["']onlineSetup["']/);
  assert.match(html, /id=["']jackBoard["']/);
  assert.match(html, /id=["']hand["']/);
  assert.match(html, /id=["']moveHint["']/);
  assert.doesNotMatch(html, /class=["'][^"']*action-list/);
});

test('service worker version includes all premium board-game assets', async () => {
  const sw = await readFile(join(publicDir, 'service-worker.js'), 'utf8');
  assert.match(sw, /busraj-games-v6/);
  for (const asset of [
    './assets/css/board-premium.css',
    './assets/css/snakes-premium.css',
    './assets/css/jackaroo-premium.css',
    './assets/js/games/snakes-ui.js',
    './assets/js/games/jackaroo-ui.js',
    './assets/js/online/room-client.js',
    './assets/js/online/room-lobby.js',
  ]) assert.ok(sw.includes(asset), `service worker must cache ${asset}`);
});
