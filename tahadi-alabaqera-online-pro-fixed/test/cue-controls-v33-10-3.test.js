// 33.10.3: the cue tables aim like a hand means — turn round the ball without a jump, a fine ruler, a pull to strike.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createDOM, MiniElement } from './dom-harness.mjs';
import * as engine from '../public/assets/js/carrom/engine.js';
import * as pool from '../public/assets/js/engines/pool-engine.js';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');
const ev = (type, x, y, extra = {}) => ({ type, clientX: x, clientY: y, pointerId: 1, button: 0, ...extra });

async function carrom() {
  const h = await createDOM('race.html', {
    ...engine, requestAnimationFrame: () => 1, cancelAnimationFrame() {},
    createCarromRenderer: () => ({ draw() {}, setTheme() {}, resize() {}, point: (x, y) => ({ x, y }) }),
    createTable: () => ({ send: () => true, leave() {}, again() {} }),
  });
  h.context.location.search = '?debug=1';
  await h.runFile('assets/js/cue-controls-v33-10-3.js');
  const source = (await read('public/assets/js/carrom/main.js')).replace(/^import[^\n]+\n/gm, '');
  vm.runInContext(source, h.context);
  const $ = (id) => h.doc.getElementById(id);
  return { ...h, $, api: h.context.BS_CARROM, degrees: () => Number($('cmAngleValue').textContent.replace('°', '')) };
}

test('carrom: a finger on the board turns the aim round the striker and never jumps to the touch', async () => {
  const h = await carrom(); h.api.startLocal('hotseat');
  const s = h.api.state, board = h.$('carromBoard');
  assert.equal(h.$('cmPowerValue').textContent, '0%', 'a turn starts with no strength: the pull sets it');
  assert.equal(h.$('cmFire').disabled, true);
  board.dispatchEvent(ev('pointerdown', 500, 300));
  assert.equal(h.degrees(), 0, 'touching does not move the aim');
  board.dispatchEvent(ev('pointermove', 560, 300)); board.dispatchEvent(ev('pointermove', 620, 300));
  const turned = h.degrees();
  assert.ok(turned > 10 && turned < 40, 'the aim follows the finger round the striker: ' + turned);
  board.dispatchEvent(ev('pointerup', 620, 300));
  assert.equal(s.phase, 'aim', 'turning never strikes');
  // a tap on a coin points at it
  const coin = s.coins.find((c) => !c.pocketed && Math.abs(c.x - 500) > 20);
  board.dispatchEvent(ev('pointerdown', coin.x, coin.y)); board.dispatchEvent(ev('pointerup', coin.x, coin.y));
  const want = Math.atan2(coin.y - s.striker.y, coin.x - s.striker.x) - -Math.PI / 2;
  assert.ok(Math.abs(h.degrees() - want * 180 / Math.PI) < 0.11, 'aimed at the coin');
});

test('carrom: the ruler turns a hair at a time, and the pull strikes when let go (or cancels back at the start)', async () => {
  const h = await carrom(); h.api.startLocal('hotseat');
  const ruler = h.$('cmRuler'), [less, more] = ruler.querySelectorAll('.cue-nudge');
  assert.ok(ruler.classList.contains('cue-ruler')); assert.equal(ruler.getAttribute('dir'), 'ltr', '‹ on the left, › on the right');
  const before = h.degrees();
  more.click(); more.click();
  assert.ok(Math.abs(h.degrees() - before - 0.4) < 0.11, '› turns with the clock, 0.2° a tap');
  less.click();
  assert.ok(Math.abs(h.degrees() - before - 0.2) < 0.11);
  const pull = h.$('cmPull');
  assert.equal(pull.getAttribute('role'), 'slider');
  pull.dispatchEvent(ev('pointerdown', 300, 10)); pull.dispatchEvent(ev('pointermove', 290, 10)); pull.dispatchEvent(ev('pointermove', 300, 10)); pull.dispatchEvent(ev('pointerup', 300, 10));
  assert.equal(h.api.state.phase, 'aim', 'back at the start cancels');
  assert.equal(h.$('cmPowerValue').textContent, '0%');
  pull.dispatchEvent(ev('pointerdown', 300, 10)); pull.dispatchEvent(ev('pointermove', 280, 10));
  assert.equal(h.$('cmPowerValue').textContent, '50%', 'the pull is the strength while it is held');
  assert.equal(pull.querySelector('.cue-pull-text').textContent, 'أفلت للضربة');
  pull.dispatchEvent(ev('pointerup', 280, 10));
  assert.equal(h.api.state.phase, 'moving', 'letting go strikes');
  assert.equal(h.api.canPlay(), false);
  const accepted = structuredClone(h.api.state);
  pull.dispatchEvent(ev('pointerdown', 300, 10)); pull.dispatchEvent(ev('pointermove', 280, 10)); pull.dispatchEvent(ev('pointerup', 280, 10));
  assert.deepEqual(h.api.state, accepted, 'no second strike while the stones move');
});

test('carrom: pulling the striker itself still slings, and the numbers stay under «أرقام واختصارات»', async () => {
  const h = await carrom(); h.api.startLocal('hotseat');
  const s = h.api.state, board = h.$('carromBoard'), x = s.striker.x, y = s.striker.y;
  board.dispatchEvent(ev('pointerdown', x, y)); board.dispatchEvent(ev('pointermove', x, y + 30)); board.dispatchEvent(ev('pointermove', x, y + 120)); board.dispatchEvent(ev('pointerup', x, y + 120));
  assert.equal(h.api.state.phase, 'moving');
  const html = await read('public/race.html');
  assert.match(html, /<details class="cm-control-help"><summary>أرقام واختصارات<\/summary><fieldset id="cmShotControls"/);
  assert.ok(html.indexOf('id="cmRuler"') < html.indexOf('id="cmPull"'));
  assert.match(html, /<script src="\/assets\/js\/cue-controls-v33-10-3\.js\?v=[^"]+"><\/script><script type="module" src="assets\/js\/carrom\/main\.js\?v=[^"]+-cue1"><\/script>/);
});

async function billiards() {
  let id = 0; const frames = new Map();
  const drawing = new Proxy({ createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }), createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), createPattern: () => '', measureText: (t) => ({ width: String(t).length * 8 }) }, { get: (o, k) => o[k] ?? (() => {}), set: (o, k, v) => ((o[k] = v), true) });
  MiniElement.prototype.getContext = () => drawing;
  const h = await createDOM('billiards.html', { ...pool, innerWidth: 390, innerHeight: 844, devicePixelRatio: 1, matchMedia: () => ({ matches: true }), ResizeObserver: class { observe() {} }, requestAnimationFrame: (fn) => (frames.set(++id, fn), id), cancelAnimationFrame: (i) => frames.delete(i), createTable: () => ({ send: () => true, leave() {}, again() {} }) });
  await h.runFile('assets/js/cue-controls-v33-10-3.js');
  await h.runFile('assets/js/billiards/main.js');
  return { ...h, api: h.context.BS_BILLIARDS };
}

test('billiards: turning on the cloth is relative, the ruler is always there, a tap lines up a ball', async () => {
  const h = await billiards(); h.api.startLocal('two');
  const angle = () => Math.atan2(h.api.ctl.aim.dir[1], h.api.ctl.aim.dir[0]);
  const fine = h.doc.getElementById('biFine'), canvas = h.api.view.canvas;
  assert.ok(fine.classList.contains('cue-ruler')); assert.equal(fine.getAttribute('role'), 'group');
  assert.equal(fine.querySelectorAll('.cue-nudge').length, 2);
  const a0 = angle();
  fine.querySelectorAll('.cue-nudge')[1].click();
  assert.ok(Math.abs(angle() - a0 - 0.0026) < 1e-6, '› turns the cue a hair with the clock');
  const a1 = angle();
  canvas.dispatchEvent(ev('pointerdown', 4, 4));
  assert.equal(angle(), a1, 'a touch does not swing the cue to the finger');
  canvas.dispatchEvent(ev('pointermove', 26, 4)); canvas.dispatchEvent(ev('pointermove', 26, 26));
  assert.notEqual(angle(), a1, 'dragging turns it');
  canvas.dispatchEvent(ev('pointerup', 26, 26));
  const main = await read('public/assets/js/billiards/main.js');
  assert.match(main, /if \(!\(hit > 0 && potAim\(hit\)\)\) aimAt\(p\.x, p\.y\)/, 'a tap on a ball pots it, on the cloth aims there');
  assert.match(main, /claim: \(p\) => !nearCueInHand\(p\.x, p\.y\)/, 'the white in hand is still moved by dragging it');
  const css = await read('public/assets/css/cue-controls-v33-10-3.css');
  assert.match(css, /\.billiards-page \.bi-game\.bi-expanded \.bi-fine\{display:grid\}/, 'the ruler shows on phones too');
  const html = await read('public/billiards.html');
  assert.ok(html.indexOf('cue-controls-v33-10-3.js') < html.indexOf('billiards/main.js'));
  assert.match(html, /عدسة تكبّر/); assert.match(html, /اسحب وأفلت للضرب/);
});

test('the cue controls ship in both tables\' bundles, after every older sheet', async () => {
  const bundles = JSON.parse(await read('scripts/style-bundles.json'));
  for (const page of ['race.html', 'billiards.html']) assert.equal(bundles[page].at(-1), 'assets/css/cue-controls-v33-10-3.css', page);
  assert.match(await read('scripts/build-styles.mjs'), /'assets\/css\/cue-controls-v33-10-3\.css'/);
  for (const file of ['public/assets/js/cue-controls-v33-10-3.js', 'public/assets/js/carrom/main.js', 'public/race.html']) assert.doesNotMatch(await read(file), /بوت/, file);
});

test('the release is 33.10.3 or later with its notes', async () => {
  assert.match(JSON.parse(await read('package.json')).version, /^33\.(?:10\.(?:[3-9]|\d{2,})|(?:1[1-9]|[2-9]\d)\.\d+)$/);
  const notes = await read('RELEASE_V33_10_3_AR.md');
  for (const word of ['الواجهة الرئيسية', 'الكيرم', 'البلياردو', 'بدون ما ينط', 'شريط التصويب الدقيق', 'أفلت', 'يلعبون']) assert.match(notes, new RegExp(word));
  assert.doesNotMatch(notes, /بوت(?!ن)/);
  assert.match(await read('README-AR.md'), /RELEASE_V33_10_3_AR\.md/);
});
