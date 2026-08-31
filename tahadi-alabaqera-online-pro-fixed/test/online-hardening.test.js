import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (rel) => readFile(new URL(rel, root), 'utf8');

test('long-lived websocket credentials are carried as subprotocols, not URL query params', async () => {
  const [board, quiz, worker] = await Promise.all([
    read('public/assets/js/board-online.js'),
    read('public/online.html'),
    read('src/index.js'),
  ]);
  assert.match(board, /protocols=\['busraj-v1'\]/);
  assert.match(quiz, /protocols=\['busraj-v1'\]/);
  assert.doesNotMatch(board, /q\.set\(['"](?:token|hostKey)/);
  assert.doesNotMatch(quiz, /url\.searchParams\.set\(['"](?:token|hostKey)/);
  assert.match(worker, /Sec-WebSocket-Protocol/);
  assert.match(worker, /read\("rt\."\)/);
  assert.match(worker, /read\("hk\."\)/);
});

test('a guest cannot become host by connecting before the creator', async () => {
  const worker = await read('src/index.js');
  const gates = worker.match(/this\.room\.order\.length === 0\) return json\(\{ ok: false, error: "بانتظار دخول المضيف أولًا"/g) || [];
  assert.equal(gates.length, 2);
  assert.doesNotMatch(worker, /this\.room\.order\.length === 0 \? "host" : "guest"/);
});

test('board rooms have disconnect grace, turn deadlines, and safe rematch lobby reset', async () => {
  const worker = await read('src/index.js');
  assert.match(worker, /DISCONNECT_GRACE_MS = 45_000/);
  assert.match(worker, /TURN_TIMEOUT_MS = 60_000/);
  assert.match(worker, /MOVE_TIMEOUT_MS = 25_000/);
  assert.match(worker, /serverNow: Date\.now\(\)/);
  assert.match(worker, /handleTurnTimeout\(\)/);
  assert.match(worker, /cleanupStaleLobbyGuests\(\)/);
  assert.match(worker, /msg\.type === "rematch"[\s\S]{0,220}resetForRematch\(\)/);
  assert.match(worker, /resetForRematch\(\)[\s\S]{0,320}ready = false/);
});

test('room creation and probing are protected by request throttles', async () => {
  const worker = await read('src/index.js');
  for (const bucket of ['quiz-create','quiz-status','quiz-ws','board-create','board-status','board-ws']) {
    assert.ok(worker.includes(`\"${bucket}\"`) || worker.includes(`"${bucket}"`), `missing ${bucket} limiter`);
  }
  assert.match(worker, /status: 429/);
});

test('quiz lobby recovers from disconnects and rooms expire cleanly', async () => {
  const worker = await read('src/index.js');
  assert.match(worker, /cleanupLobbySeats\(\)/);
  assert.match(worker, /scheduleLobbyAlarm\(\)/);
  assert.match(worker, /successor\.role = "host"/);
  assert.match(worker, /if \(now >= this\.room\.expiresAt\)/);
});

test('API and websocket entry points reject foreign origins', async () => {
  const worker = await read('src/index.js');
  assert.match(worker, /function sameOrigin\(request\)/);
  assert.match(worker, /cross_origin_forbidden/);
  assert.doesNotMatch(worker, /"access-control-allow-origin": "\*"/);
  const protocolGates = worker.match(/WebSocket protocol required/g) || [];
  assert.equal(protocolGates.length, 2);
});

test('local board UIs escape player names before using innerHTML', async () => {
  for (const rel of ['public/dice.html','public/snakes.html','public/zahra.html','public/jackaroo.html']) {
    const html = await read(rel);
    assert.match(html, /function escHtml\(/, rel);
  }
  const dice = await read('public/dice.html');
  const snakes = await read('public/snakes.html');
  const zahra = await read('public/zahra.html');
  const jack = await read('public/jackaroo.html');
  assert.match(dice, /\$\{escHtml\(p\.name\)\}/);
  assert.match(snakes, /\$\{escHtml\(x\.name\)\}/);
  assert.match(zahra, /\$\{escHtml\(p\.name\)\}/);
  assert.match(jack, /\$\{escHtml\(p\.name\)\}/);
  const boardOnline = await read('public/assets/js/board-online.js');
  assert.match(boardOnline, /escapeHtml\(\(p\.name\|\|'؟'\)\.slice\(0,1\)\)/);
  assert.match(boardOnline, /bindRoomCountdown/);
  assert.match(boardOnline, /estimatedServerNow/);
});
