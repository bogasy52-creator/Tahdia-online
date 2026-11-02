// 33.1.0: no text selection anywhere, neon board snakes with readable numbers,
// the Baloot claim button never pushed off-screen, voice notes in the voice studio.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { NEON_SNAKE_COLORS, drawNeonBody, drawNeonHead } from '../public/assets/js/neon-snakes-v33.js';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('every page bundle stops long-press selection, and typing fields stay selectable', async () => {
  const bundles = JSON.parse(await read('scripts/style-bundles.json'));
  for (const [page, list] of Object.entries(bundles)) assert.ok(list.includes('assets/css/game-interaction-v34.css'), page + ' misses the no-selection rules');
  const css = await read('public/assets/css/game-interaction-v34.css');
  assert.match(css, /^\*\{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none\}/m);
  assert.match(css, /^input,textarea,select,[^{]*\[data-selectable\] \*\{-webkit-user-select:text;user-select:text/m);
  // accuracy.html only redirects home, so build-styles leaves its old bundle alone
  for (const file of (await readdir(new URL('public/assets/css/', root))).filter((f) => /^app-.*\.css$/.test(f) && f !== 'app-accuracy.css')) {
    const text = await read('public/assets/css/' + file);
    assert.match(text, /\*\{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none\}/, file);
  }
  const offline = await read('public/offline.html');
  assert.match(offline, /body,body \*\{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none\}/);
});

test('the long-press guard script runs on every page once, and leaves editable text alone', async () => {
  const premium = await read('public/assets/js/tahdia-premium-v25.js'), platform = await read('public/assets/js/platform.js');
  for (const source of [premium, platform]) {
    assert.match(source, /__BS_NO_SELECT__/);
    assert.match(source, /selectstart/);
    assert.match(source, /nodeType\s*===\s*3/);
  }
  const html = (await readdir(new URL('public/', root))).filter((f) => f.endsWith('.html') && !['offline.html', 'accuracy.html', 'labyrinth.html', 'survival.html', 'territory.html'].includes(f));
  for (const page of html) {
    const text = await read('public/' + page);
    if (/http-equiv="refresh"/.test(text)) continue;
    assert.ok(/tahdia-premium-v25\.js|platform\.js/.test(text), page + ' loads no long-press guard');
  }
});

test('the board snakes are eight different neon colours with lit heads', () => {
  const colours = Object.values(NEON_SNAKE_COLORS);
  for (const id of ['snake-wild', 'snake-gold', 'snake-aurora', 'snake-toxic', 'snake-ice', 'snake-plasma', 'snake-coral', 'snake-aqua', 'snake-sovereign']) assert.ok(NEON_SNAKE_COLORS[id], id);
  assert.equal(new Set(colours).size, colours.length, 'no two snakes share a colour');
  const calls = [];
  const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : typeof k === 'string' && /^[a-z]/i.test(k) && !['fillStyle', 'strokeStyle', 'lineWidth', 'globalAlpha', 'lineCap', 'lineJoin'].includes(k) ? (...args) => { calls.push(k); return k.startsWith('create') ? { addColorStop() {} } : undefined; } : t[k]), set: (t, k, v) => { t[k] = v; return true; } });
  const points = Array.from({ length: 30 }, (_, i) => ({ x: i * 4, y: Math.sin(i / 4) * 8 }));
  drawNeonBody(ctx, points, 'snake-coral', 6, false);
  drawNeonHead(ctx, 'snake-aqua', 12);
  assert.ok(calls.filter((c) => c === 'fill').length > 6 && calls.filter((c) => c === 'stroke').length > 4);
  assert.ok(!calls.includes('drawImage') && !calls.includes('clip'), 'drawn shapes only: no image sheet');
});

test('the board shows every snake colour once and keeps its numbers above the art', async () => {
  const arena = await read('public/assets/js/neon-arena.js');
  assert.match(arena, /const SPECIES=\['snake-wild','snake-gold','snake-aurora','snake-toxic','snake-ice','snake-plasma','snake-coral','snake-aqua'\]/);
  assert.match(arena, /'snake-coral':\[/);
  assert.match(arena, /cyber:\{dark:'#13293a'/);
  const css = await read('public/assets/css/app-snakes.css');
  assert.match(css, /#board \.snake-cell>b\{z-index:12!important/);
  assert.match(css, /arena-live-creatures\.v31\{[^}]*z-index:10!important/);
});

test('the Baloot projects bar takes its own row so «سجّل» stays on screen', async () => {
  const css = await read('public/assets/css/app-baloot.css'), page = await read('public/baloot.html');
  assert.match(css, /\.bl-tools \.bl-project-picker\{grid-column:1\/-1;order:-1/);
  assert.match(page, /id="projectPicker"[\s\S]*id="claimBtn"/);
});

test('the voice studio takes a voice note from a file, shaped like a recording', async () => {
  const admin = await read('public/admin.html'), studio = await read('public/assets/js/admin-voice-studio.js');
  assert.match(admin, /id="voiceFile"[^>]*>أو اختر ملف صوتي من جوالك<\/button><input id="voiceFileInput" type="file" accept="audio\/\*/);
  assert.match(studio, /async function fromFile\(file\)/);
  assert.match(studio, /MAX_FILE_BYTES = 12 \* 1024 \* 1024/);
  assert.match(studio, /if \(clip\.length \/ RATE > MAX_KEPT_SECONDS\) throw new Error\('file_long'\)/);
  assert.match(admin, /<div class="admin-table-wrap" data-selectable>/);
});

test('the home footer shows the release of the project, whatever it is', async () => {
  const pkg = JSON.parse(await read('package.json')), home = await read('public/index.html');
  assert.match(pkg.version, /^33\.\d+\.\d+$/);
  assert.ok(home.includes('الإصدار ' + pkg.version), 'footer ' + pkg.version);
});
