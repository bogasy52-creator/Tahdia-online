import { readFile, access } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function parseJsonc(raw) {
  return JSON.parse(raw.replace(/^\s*\/\/.*$/gm, ''));
}

function fail(message) {
  console.error(`Worker configuration verification failed: ${message}`);
  process.exit(1);
}

const config = parseJsonc(await readFile(join(root, 'wrangler.jsonc'), 'utf8'));
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const worker = await readFile(join(root, 'src/index.js'), 'utf8');

if (config.name !== 'tahdia-online') fail(`unexpected worker name: ${config.name}`);
if (config.main !== 'src/index.js') fail(`unexpected worker entry: ${config.main}`);
if (config.assets?.directory !== './public') fail(`unexpected assets directory: ${config.assets?.directory}`);
if (config.assets?.binding !== 'ASSETS') fail(`unexpected assets binding: ${config.assets?.binding}`);
if (!(config.assets?.run_worker_first || []).includes('/api/*')) fail('API routes must run through the Worker first');

const bindings = new Map((config.durable_objects?.bindings || []).map((item) => [item.name, item.class_name]));
if (bindings.get('ROOMS') !== 'GameRoom') fail('ROOMS / GameRoom binding is missing');
if (bindings.get('BOARD_ROOMS') !== 'BoardGameRoom') fail('BOARD_ROOMS / BoardGameRoom binding is missing');

const migrations = config.migrations || [];
const hasGameRoomMigration = migrations.some((m) => (m.new_sqlite_classes || []).includes('GameRoom'));
const hasBoardRoomMigration = migrations.some((m) => (m.new_sqlite_classes || []).includes('BoardGameRoom'));
if (!hasGameRoomMigration) fail('GameRoom migration is missing');
if (!hasBoardRoomMigration) fail('BoardGameRoom migration is missing');

for (const className of ['GameRoom', 'BoardGameRoom']) {
  if (!new RegExp(`export\\s+class\\s+${className}\\b`).test(worker)) fail(`${className} is not exported from src/index.js`);
}

await access(join(root, 'public'));
await access(join(root, 'src/rooms/board-game-room.js'));

if (pkg.devDependencies?.wrangler !== '4.127.1') fail(`Wrangler must stay pinned to 4.127.1 (found ${pkg.devDependencies?.wrangler || 'missing'})`);

console.log('Worker configuration verification passed (offline-safe).');
console.log('Cloudflare dry-run remains available via: npm run verify:full');
