import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createDOM, MiniElement } from './dom-harness.mjs';
import * as engine from '../public/assets/js/engines/jewels-duel-engine.js';

// The page's real DOM, input handlers and deterministic engine run together. Only the
// canvas drawing surface and the network transport are replaced; no gameplay is mocked.
async function setup() {
  const frames = new Map(), sent = [];
  let frameId = 0, table;
  const drawing = new Proxy({
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    createConicGradient: () => ({ addColorStop() {} }),
  }, { get: (target, key) => target[key] ?? (() => {}), set: (target, key, value) => (target[key] = value, true) });
  MiniElement.prototype.getContext = () => drawing;
  const h = await createDOM('jewels.html', {
    ...engine, innerWidth: 390, innerHeight: 844, devicePixelRatio: 1,
    Image: class {}, requestAnimationFrame: fn => { frames.set(++frameId, fn); return frameId; },
    createTable: options => (table = { options, client: { send: (type, payload) => { sent.push({ type, ...payload }); return true; } }, again() {}, leave() {} }),
  });
  const makeElement = h.doc.createElement;
  h.doc.createElement = tag => { const element = makeElement(tag); if (tag === 'canvas') element.getContext = () => drawing; return element; };
  for (const canvas of h.doc.querySelectorAll('canvas')) canvas.getContext = () => drawing;
  const canvas = h.doc.getElementById('jwBoard'), grid = h.doc.getElementById('jwWrap');
  canvas.getBoundingClientRect = () => {
    const size = parseFloat(canvas.style.width) || 320;
    return { left: 0, top: 0, width: size, height: size, right: size, bottom: size };
  };
  const source = (await readFile(new URL('../public/assets/js/jewels/main.js', import.meta.url), 'utf8')).replace(/^import[^\n]+\n/gm, '');
  vm.runInContext(source, h.context);
  function paint() { const jobs = [...frames.values()]; frames.clear(); for (const job of jobs) job(1000); }
  function key(key, extra = {}) { grid.dispatchEvent({ type: 'keydown', key, preventDefault() {}, ...extra }); }
  function pointer(type, cell, extra = {}) {
    const size = parseFloat(canvas.style.width) || 320, pad = Math.round(size * .042), unit = (size - 2 * pad) / 8;
    canvas.dispatchEvent({ type, pointerId: 1, isPrimary: true, button: 0, clientX: pad + (cell % 8 + .5) * unit, clientY: pad + (Math.floor(cell / 8) + .5) * unit, preventDefault() {}, ...extra });
  }
  function start() { h.doc.getElementById('jwStartTwo').click(); paint(); paint(); }
  return { ...h, table, sent, canvas, grid, key, pointer, start, api: h.context.BS_JEWELS };
}
const flush = async () => { for (let i = 0; i < 120; i++) await Promise.resolve(); };
function moveCursor(h, cell) { h.key('Home', { ctrlKey: true }); for (let i = 0; i < Math.floor(cell / 8); i++) h.key('ArrowDown'); for (let i = 0; i < cell % 8; i++) h.key('ArrowRight'); }

// Catches the previously focusable but inert canvas and inaccessible gem selection.
test('Jewels keyboard navigation names cells and can complete a legal swap', async () => {
  const h = await setup(); h.start(); h.grid.focus();
  h.key('ArrowRight');
  assert.equal(h.grid.getAttribute('aria-activedescendant'), 'jwCell-1');
  h.key('Enter');
  assert.equal(h.doc.getElementById('jwCell-1')?.getAttribute('aria-selected'), 'true');
  h.key('Escape');
  assert.equal(h.doc.getElementById('jwCell-1')?.getAttribute('aria-selected'), 'false');
  const [a, b] = h.api.legal()[0];
  moveCursor(h, a); h.key('Enter'); moveCursor(h, b); h.key('Enter');
  await flush();
  assert.equal(h.api.state.seq, 1);
  assert.ok(h.api.state.players[0].score > 0);
  assert.equal(h.grid.getAttribute('aria-busy'), 'false');
  assert.equal(h.doc.querySelectorAll('[role="gridcell"]').length, 64);
  assert.match(h.doc.getElementById('jwCell-0').getAttribute('aria-label'), /الصف 1.*العمود 1/);
});

// Catches right-clicks and a second finger hijacking the active pointer's move.
test('Jewels ignores secondary buttons and pointers without losing the primary drag', async () => {
  const h = await setup(); h.start();
  const [a, b] = h.api.legal()[0];
  h.pointer('pointerdown', a, { button: 2 }); h.pointer('pointerup', a, { button: 2 });
  h.pointer('pointerdown', b, { button: 2 }); h.pointer('pointerup', b, { button: 2 });
  await flush(); assert.equal(h.api.state.seq, 0, 'right-click must not play');
  h.pointer('pointerdown', a);
  h.pointer('pointerdown', a, { pointerId: 2, isPrimary: false });
  h.pointer('pointermove', b, { pointerId: 2, isPrimary: false });
  h.pointer('pointerup', b, { pointerId: 2, isPrimary: false });
  await flush(); assert.equal(h.api.state.seq, 0, 'another finger must not play');
  h.pointer('pointermove', b); h.pointer('pointerup', b);
  await flush(); assert.equal(h.api.state.seq, 1, 'the original drag still works');
});

// Catches enabled charged boosters and misleading turn feedback while the server owns
// an unresolved move; checks that prediction never changes authoritative scores/state.
test('Jewels locks pending online actions until the authoritative move or rejection', async () => {
  const h = await setup();
  const state = engine.createJewelsDuel(['أنت', 'خصم'], { seed: 123, first: 0 });
  state.players[0].charge = [22, 26, 32];
  const room = { state, startedAt: 123, me: { index: 0, role: 'host' }, players: [{ index: 0, name: 'أنت' }, { index: 1, name: 'خصم' }] };
  await h.table.options.apply(room, { animate: false });
  assert.equal(h.doc.querySelector('.jw-boost').disabled, false);
  const before = JSON.stringify(h.api.state), [a, b] = h.api.legal()[0];
  await h.api.swap(a, b);
  assert.equal(h.api.busy, true);
  assert.equal(JSON.stringify(h.api.state), before);
  assert.equal(h.doc.querySelector('.jw-boost').disabled, true);
  assert.match(h.doc.getElementById('status').textContent, /تأكيد|السيرفر/);
  await h.api.swap(a, b); h.api.booster(0, 0);
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0].type, 'jewels_swap');
  h.table.options.onError('تم رفض الحركة'); await flush();
  assert.equal(h.api.busy, false);
  assert.equal(JSON.stringify(h.api.state), before);
  assert.equal(h.doc.querySelector('.jw-boost').disabled, false);
  await h.api.swap(a, b);
  const accepted = engine.playJewelsSwap(state, 0, a, b);
  await h.table.options.apply({ ...room, state: accepted }, { animate: false });
  assert.equal(h.api.busy, false);
  assert.equal(h.api.state.seq, 1);
  assert.equal(h.api.state.players[0].score, accepted.players[0].score);
});

// Catches an old cascade resuming after Exit and dereferencing a cleared/new match.
test('leaving a Jewels match cancels its unfinished animation safely', async () => {
  const h = await setup(); h.start();
  const [a, b] = h.api.legal()[0], task = h.api.swap(a, b);
  h.doc.getElementById('jwExit').click(); h.doc.getElementById('jwExit').click();
  await assert.doesNotReject(task);
  assert.equal(h.api.state, null);
  assert.equal(h.doc.getElementById('game').hidden, true);
  h.start(); await flush();
  assert.equal(h.api.state.seq, 0);
  assert.equal(h.api.busy, false);
});
