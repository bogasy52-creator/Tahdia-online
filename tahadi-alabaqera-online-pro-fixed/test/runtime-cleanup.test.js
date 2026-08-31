import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const pub = join(root, 'public');

test('legacy board-room runtime paths are inert compatibility shims', async () => {
  const legacy = await Promise.all([
    readFile(join(pub, 'assets/js/online/room-client.js'), 'utf8'),
    readFile(join(pub, 'assets/js/games/snakes-ui.js'), 'utf8'),
    readFile(join(pub, 'assets/js/games/jackaroo-ui.js'), 'utf8'),
  ]);
  for (const source of legacy) {
    assert.match(source, /compatibility shim/i);
    assert.doesNotMatch(source, /WebSocket\s*\(/);
    assert.doesNotMatch(source, /\/api\/games\/rooms/);
    assert.doesNotMatch(source, /searchParams\.set\(['"](?:token|hostKey)/);
  }

  const board = await readFile(join(pub, 'assets/js/board-online.js'), 'utf8');
  assert.match(board, /\/api\/board\/rooms/);
  assert.doesNotMatch(board, /\/api\/games\/rooms/);
  assert.match(board, /protocols=\['busraj-v1'\]/);
  assert.doesNotMatch(board, /searchParams\.set\(['"](?:token|hostKey)/);
});
