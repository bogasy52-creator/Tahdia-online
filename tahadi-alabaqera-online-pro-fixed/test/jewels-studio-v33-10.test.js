import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createDOM, MiniElement } from './dom-harness.mjs';

const page = new URL('../public/jewels.html', import.meta.url);
test('Jewels explains equal independent runs and provides a private device handover', async () => {
  const html = await readFile(page, 'utf8');
  assert.match(html, /نفس البداية/);
  assert.match(html, /25 حركة/);
  assert.match(html, /id="jwHandover"/);
  assert.match(html, /id="jwHandoverStart"/);
  assert.doesNotMatch(html, /حركتين في دوره|لوحة وحدة|النقاط دبل|حركة زيادة/);
});

async function setup({ motion = false, network = false } = {}) {
  const engine = await import('../public/assets/js/engines/jewels-race-engine.js');
  const duel = await import('../public/assets/js/engines/jewels-duel-engine.js');
  const frames = new Map(), sent = [], sockets = [];
  let resolveQuick = null;
  let frameId = 0, table;
  const drawing = new Proxy({
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    createConicGradient: () => ({ addColorStop() {} }),
    measureText: text => ({ width: String(text).length * 8 }),
  }, { get: (target, key) => target[key] ?? (() => {}), set: (target, key, value) => (target[key] = value, true) });
  MiniElement.prototype.getContext = () => drawing;
  const h = await createDOM('jewels.html', {
    ...engine, ...duel, innerWidth: 390, innerHeight: 844, devicePixelRatio: 1,
    matchMedia: () => ({ matches: !motion }),
    requestAnimationFrame: fn => { frames.set(++frameId, fn); return frameId; },
    cancelAnimationFrame: id => frames.delete(id),
    createTable: options => (table = { options, client: { send: (type, payload) => { sent.push({ type, ...payload }); return true; } }, again() {}, leave() {} }),
  });
  const strip = source => source.replace(/^import[^\n]+\n/gm, '').replace(/\bexport /g, '');
  if (network) {
    h.context.removeEventListener = () => {};
    h.context.DOMException = DOMException;
    h.context.fetch = url => url === '/api/board/quick' ? new Promise(resolve => { resolveQuick = () => resolve({ ok: true, status: 200, json: async () => ({ ok: true, code: '851234' }) }); }) : Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
    h.context.WebSocket = class {
      static OPEN = 1;
      constructor(url) { this.url = url; this.readyState = 0; this.closed = false; sockets.push(this); }
      send() {}
      close() { this.readyState = 3; this.closed = true; }
    };
    for (const file of ['online/connection-utils.js', 'board-online.js', 'game-menu-v33.js', 'board-table-v33.js']) vm.runInContext(strip(await readFile(new URL('../public/assets/js/' + file, import.meta.url), 'utf8')), h.context);
    const actualTable = h.context.createTable;
    h.context.createTable = options => (table = actualTable(options));
  }
  vm.runInContext(strip(await readFile(new URL('../public/assets/js/jewels/studio-renderer.js', import.meta.url), 'utf8')), h.context);
  vm.runInContext(strip(await readFile(new URL('../public/assets/js/jewels/main.js', import.meta.url), 'utf8')), h.context);
  const canvas = h.doc.getElementById('jwBoard'), grid = h.doc.getElementById('jwWrap');
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: parseFloat(canvas.style.width) || 320, height: parseFloat(canvas.style.height) || 320 });
  const paint = () => { const jobs = [...frames.values()]; frames.clear(); for (const fn of jobs) fn(1000); };
  const key = (key, extra = {}) => grid.dispatchEvent({ type: 'keydown', key, preventDefault() {}, ...extra });
  const pointer = (type, cell, extra = {}) => {
    const { size, pad, cell: unit } = h.context.BS_JEWELS.geometry;
    canvas.dispatchEvent({ type, pointerId: 1, isPrimary: true, button: 0, clientX: pad + (cell % 8 + .5) * unit, clientY: pad + (Math.floor(cell / 8) + .5) * unit, preventDefault() {}, ...extra });
  };
  const start = mode => { h.doc.getElementById(mode === 'ai' ? 'jwStartAi' : 'jwStartTwo').click(); paint(); paint(); };
  return { ...h, engine, table, sent, sockets, releaseQuick: () => resolveQuick?.(), canvas, grid, paint, key, pointer, start, api: h.context.BS_JEWELS };
}
const flush = async () => { for (let i = 0; i < 180; i++) await Promise.resolve(); };

test('independent run keeps the first player active and exposes keyboard cell selection', async () => {
  const h = await setup(); h.start('two');
  h.grid.focus(); h.key('ArrowRight'); h.key('Enter');
  assert.equal(h.grid.getAttribute('aria-activedescendant'), 'jwCell-1');
  assert.equal(h.doc.getElementById('jwCell-1').getAttribute('aria-selected'), 'true');
  h.key('Escape');
  for (let i = 0; i < 3; i++) { const [a, b] = h.api.legal()[0]; await h.api.swap(a, b); await flush(); }
  assert.equal(h.api.seat, 0);
  assert.equal(h.api.state.players[0].used, 3);
  assert.equal(h.api.state.players[1].used, 0);
  assert.equal(h.doc.querySelectorAll('[role="gridcell"]').length, 64);
  assert.equal(h.grid.getAttribute('aria-busy'), 'false');
});

test('device handover hides the first run and restarts the identical board for player two', async () => {
  const h = await setup(); h.start('two');
  const initial = JSON.stringify(h.api.state.players[1].board);
  while (!h.api.state.players[0].done) { const [a, b] = h.api.legal()[0]; await h.api.swap(a, b); await flush(); }
  assert.equal(h.doc.getElementById('jwHandover').hidden, false);
  assert.equal(h.grid.inert, true);
  const before = h.api.state.players[0].used;
  await h.api.swap(0, 1);
  assert.equal(h.api.state.players[0].used, before);
  h.doc.getElementById('jwHandoverStart').click(); await flush();
  assert.equal(h.api.seat, 1);
  assert.equal(h.api.state.players[1].used, 0);
  assert.equal(JSON.stringify(h.api.state.players[1].board), initial);
  assert.equal(h.doc.getElementById('jwHandover').hidden, true);
  while (!h.api.state.players[1].done) { const [a, b] = h.api.legal()[0]; await h.api.swap(a, b); await flush(); }
  assert.equal(h.api.state.finished, true);
  assert.equal(h.api.state.winner, -1, 'same choices on equal openings must tie');
  assert.equal(h.api.state.players[1].used, 25);
  assert.equal(h.doc.getElementById('jwEnd').hidden, false);
});

test('online opponent progress leaves selection intact; pending own commands use the player sequence', async () => {
  const h = await setup();
  const state = h.engine.createJewelsRace(['أنت', 'خصم'], { seed: 123, now: Date.now() });
  const room = { state, startedAt: state.startedAt, me: { index: 0, role: 'host' }, players: [{ index: 0, name: 'أنت' }, { index: 1, name: 'خصم' }] };
  await h.table.options.apply(room, { animate: false });
  h.key('Enter');
  const foePair = h.engine.legalRaceSwaps(state, 1)[0];
  const foeMove = h.engine.playJewelsRaceSwap(state, 1, ...foePair);
  await h.table.options.apply({ ...room, state: foeMove }, { animate: true });
  assert.equal(h.doc.getElementById('jwCell-0').getAttribute('aria-selected'), 'true');
  assert.equal(h.api.busy, false);
  const [a, b] = h.api.legal()[0], before = JSON.stringify(h.api.state);
  await h.api.swap(a, b); await h.api.swap(a, b);
  assert.equal(h.sent.length, 1);
  assert.deepEqual(h.sent[0], { type: 'jewels_swap', a, b, seq: 0 });
  assert.equal(JSON.stringify(h.api.state), before);
  assert.equal(h.api.busy, true);
  h.table.options.onError('تم رفض الحركة'); await flush();
  assert.equal(h.api.busy, false);
  assert.equal(JSON.stringify(h.api.state), before);
});

test('secondary pointers cannot hijack a drag, and leaving cancels a pending cascade', async () => {
  const h = await setup(); h.start('two');
  const [a, b] = h.api.legal()[0];
  h.pointer('pointerdown', a, { button: 2 }); h.pointer('pointerup', b, { button: 2 });
  assert.equal(h.api.state.players[0].used, 0);
  h.pointer('pointerdown', a); h.pointer('pointermove', b, { pointerId: 2, isPrimary: false }); h.pointer('pointerup', b, { pointerId: 2, isPrimary: false });
  assert.equal(h.api.state.players[0].used, 0);
  h.pointer('pointermove', b); h.pointer('pointerup', b); await flush();
  assert.equal(h.api.state.players[0].used, 1);
  const task = h.api.swap(...h.api.legal()[0]);
  h.doc.getElementById('jwExit').click(); h.doc.getElementById('jwExit').click();
  await assert.doesNotReject(task);
  assert.equal(h.api.state, null);
  assert.equal(h.doc.getElementById('game').hidden, true);
});


test('aborting a queued online replay snaps to its authoritative board and releases input', async () => {
  const h = await setup({ motion: true });
  const state = h.engine.createJewelsRace(['أنت', 'خصم'], { seed: 321 });
  const room = { state, startedAt: state.startedAt, me: { index: 0, role: 'host' }, players: [{ index: 0, name: 'أنت' }, { index: 1, name: 'خصم' }] };
  await h.table.options.apply(room, { animate: false });
  const accepted = h.engine.playJewelsRaceSwap(state, 0, ...h.engine.legalRaceSwaps(state, 0)[0]);
  const abort = new AbortController();
  const task = h.table.options.apply({ ...room, state: accepted }, { animate: true, signal: abort.signal });
  assert.equal(h.api.busy, true);
  abort.abort();
  await task;
  assert.equal(h.api.busy, false);
  assert.equal(h.api.state.players[0].seq, accepted.players[0].seq);
  assert.equal(h.grid.getAttribute('aria-busy'), 'false');
  assert.equal(h.doc.getElementById('plateBottom').querySelector('.jw-score').textContent, String(accepted.players[0].score));
});

test('opponent progress during an own cascade preserves the replay and its final score', async () => {
  const h = await setup({ motion: true });
  const state = h.engine.createJewelsRace(['أنت', 'خصم'], { seed: 987 });
  const room = { state, startedAt: state.startedAt, me: { index: 0, role: 'host' }, players: [{ index: 0, name: 'أنت' }, { index: 1, name: 'خصم' }] };
  await h.table.options.apply(room, { animate: false });
  const accepted = h.engine.playJewelsRaceSwap(state, 0, ...h.engine.legalRaceSwaps(state, 0)[0]);
  const task = h.table.options.apply({ ...room, state: accepted }, { animate: true });
  const foe = h.engine.playJewelsRaceSwap(accepted, 1, ...h.engine.legalRaceSwaps(accepted, 1)[0]);
  await h.table.options.apply({ ...room, state: foe }, { animate: true });
  assert.equal(h.api.busy, true);
  for (let i = 0; i < 50 && h.api.busy; i++) { h.paint(); await flush(); }
  await task;
  assert.equal(h.api.busy, false);
  assert.equal(h.api.state.players[0].score, accepted.players[0].score);
  assert.equal(h.api.state.players[1].score, foe.players[1].score);
  assert.equal(h.doc.getElementById('plateBottom').querySelector('.jw-score').textContent, String(accepted.players[0].score));
});

function finishPracticeComputation(h) {
  for (let step = 0; step < 40; step++) {
    const entry = [...h.timers.entries()].find(([, timer]) => timer.ms === 30 || timer.ms === 12);
    if (!entry) return;
    h.timers.delete(entry[0]); entry[1].fn();
  }
  throw new Error('practice calculation did not terminate');
}
function expirePractice(h) {
  const expiredAt = h.api.state.endsAt + 10;
  h.context.Date = { now: () => expiredAt };
  h.context.dispatchEvent({ type: 'visibilitychange' });
}
function assertFinalScoreWinner(h) {
  const [own, foe] = h.api.state.players;
  const expected = own.score === foe.score ? -1 : own.score > foe.score ? 0 : 1;
  assert.equal(h.api.state.finished, true);
  assert.equal(foe.remaining, 0, 'the computer must finish the full equal action budget');
  assert.equal(h.api.state.winner, expected, 'winner must agree with the final scores displayed');
  assert.equal(h.doc.getElementById('plateTop').querySelector('.jw-score').textContent, String(foe.score));
}

test('practice expiry with zero actions settles the completed computer score before choosing the winner', async () => {
  const h = await setup(); h.start('ai');
  finishPracticeComputation(h);
  assert.equal(h.api.state.players[1].used, 0, 'precomputation stays visually quiet until play');
  expirePractice(h); await flush();
  assertFinalScoreWinner(h);
  assert.equal(h.api.state.winner, 1);
});

test('practice expiry after partial play chooses the winner from the final displayed scores', async () => {
  const h = await setup(); h.start('ai');
  await h.api.swap(...h.api.legal()[0]); await flush();
  finishPracticeComputation(h);
  expirePractice(h); await flush();
  assertFinalScoreWinner(h);
  assert.equal(h.api.state.players[0].used, 1);
});

test('practice expiry locks human input while an unfinished computer calculation completes', async () => {
  const h = await setup(); h.start('ai');
  expirePractice(h); await flush();
  assert.equal(h.api.state.players[0].done, true);
  assert.equal(h.api.state.finished, false, 'a computer run still in calculation must not use its partial score as a final result');
  await h.api.swap(0, 1);
  assert.equal(h.api.state.players[0].used, 0);
  finishPracticeComputation(h); await flush();
  assertFinalScoreWinner(h);
  assert.equal(h.api.state.winner, 1);
});

for (const scenario of ['waiting lobby', 'pending quick request']) test(`starting practice closes the actual shared room transport from a ${scenario}`, async () => {
  const h = await setup({ network: true });
  h.doc.querySelector('.gm33-quick').click(); await flush();
  let lateMessage = null;
  if (scenario === 'waiting lobby') {
    h.releaseQuick(); await flush();
    const socket = h.sockets[0];
    assert.ok(socket, 'the actual online client opened the quick room transport');
    socket.readyState = 1; socket.onopen?.();
    socket.onmessage({ data: JSON.stringify({ type: 'welcome', token: 'test-token', state: { game: 'jewels', code: '851234', version: 1, status: 'lobby', publicMatch: true, players: [{ id: 'a', index: 0, name: 'أنت', connected: true }], me: { id: 'a', index: 0, role: 'player' } } }) });
    await flush(); lateMessage = socket.onmessage;
  }
  h.doc.querySelector('.jw-modes [data-mode="ai"]').click();
  h.start('ai'); await flush();
  await h.api.swap(...h.api.legal()[0]); await flush();
  const local = JSON.stringify(h.api.state);
  if (scenario === 'waiting lobby') {
    assert.equal(h.sockets[0].closed, true);
    const online = h.engine.createJewelsRace(['أنت', 'منافس قديم'], { seed: 112233 });
    lateMessage({ data: JSON.stringify({ type: 'state', state: { state: online, startedAt: online.startedAt, version: 2, status: 'playing', players: [{ index: 0, name: 'أنت' }, { index: 1, name: 'منافس قديم' }], me: { index: 0 } } }) });
  } else h.releaseQuick();
  await flush();
  assert.equal(JSON.stringify(h.api.state), local, 'a late online result must not replace the practice run');
  assert.equal(h.api.state.players[0].used, 1);
  assert.equal(h.doc.getElementById('game').hidden, false);
  if (scenario === 'pending quick request') assert.equal(h.sockets.length, 0);
});
