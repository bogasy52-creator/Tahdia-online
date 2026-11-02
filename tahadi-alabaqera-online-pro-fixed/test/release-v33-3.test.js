// 33.3.0: the Baloot winner always shows, zoom is locked and pages fit the phone,
// snakes & ladders fits one screen (bigger stones, quicker turns), a luxurious
// Baloot table, and Zahra / Jackaroo / the dice race fit the phone too.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createBoardMovePlan, createReactionPlan, snakesTurnDisplayMs } from '../public/assets/js/snakes-v4-fx.js';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('the end of a صكّة is never skipped: old batches, reconnects and the last sheet all lead to the winner', async () => {
  const table = await read('public/assets/js/baloot-table.js');
  assert.match(table, /const end = events\.slice\(index\)\.find\(\(x\) => x\.type === 'match_finished'\);\s*if \(end\) showMatchEnd\(end\.winner, end\.scores, after\);\s*return;/);
  assert.match(table, /if \(view\.phase === 'finished' && view\.winner != null && \$\('matchEnd'\)\.hidden && \$\('resultSheet'\)\.hidden\) showMatchEnd\(view\.winner, view\.scores, view\);/);
  assert.match(table, /setTimeout\(close, finished \? 3800 : 5200\);/);
  assert.match(table, /if \(ui\.endShownFor === key\) return;/);
  assert.match(table, /`الفايزين: \$\{names\.join\(' و'\)\}/);
});

test('every page locks zoom and never grows wider than the phone', async () => {
  for (const file of (await readdir(new URL('public/', root))).filter((f) => f.endsWith('.html'))) {
    const page = await read('public/' + file);
    assert.match(page, /<meta name="viewport" content="width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">/, file);
  }
  const css = await read('public/assets/css/game-interaction-v34.css');
  assert.match(css, /^html,body\{overflow-x:clip\}/m);
  assert.match(css, /^html\{touch-action:pan-x pan-y\}/m);
  for (const script of ['public/assets/js/tahdia-premium-v25.js', 'public/assets/js/platform.js']) {
    const source = await read(script);
    assert.match(source, /__BS_NO_ZOOM__/, script);
    assert.match(source, /'gesturestart',\s*'gesturechange',\s*'gestureend'|'gesturestart','gesturechange','gestureend'/, script);
  }
  // the two pages that were 22 px too wide on a 360 px phone
  assert.match(await read('public/assets/css/app-sudoku.css'), /\.sudoku-levels button\{min-width:0;min-height:0;aspect-ratio:1\.15;padding:6px\}/);
  assert.match(await read('public/assets/css/app-party.css'), /\.party-volume-label\{display:none!important\}/);
});

test('snakes & ladders: one screen on a phone, big stones, quicker turns and a turn cue', async () => {
  const bundles = JSON.parse(await read('scripts/style-bundles.json'));
  assert.ok(bundles['snakes.html'].includes('assets/css/snakes-screen-v33-3.css'));
  const css = await read('public/assets/css/app-snakes.css');
  assert.match(css, /--snl-board: min\(calc\(100vw - 16px\), calc\(100svh - 316px\), 600px\)/);
  assert.match(css, /\.snake-token > :is\(svg, canvas, img, \.crystal-sprite\) \{ scale: 1\.5;/);
  assert.match(css, /#game\.snl31 \{ align-content: start !important/);
  const walk = createBoardMovePlan(10, 16).duration;
  assert.ok(walk >= 600 && walk <= 760, 'six cells in about two thirds of a second, was ~950 ms');
  assert.ok(createReactionPlan('snake').total <= 1250 && createReactionPlan('ladder').total <= 800);
  assert.ok(snakesTurnDisplayMs({ from: 10, landed: 16, to: 16 }) < 2100, 'the server paces bots by the quicker turn');
  assert.match(await read('public/assets/js/pro-dice.js'), /const ROLL_MS=760;/);
  assert.match(await read('public/assets/js/snakes-v31.js'), /function turnCue\(\)/);
});

test('a luxurious Baloot table and the other tables fit the phone', async () => {
  const bundles = JSON.parse(await read('scripts/style-bundles.json'));
  assert.ok(bundles['baloot.html'].includes('assets/css/baloot-table-v33-3.css'));
  for (const page of ['zahra.html', 'jackaroo.html', 'dice.html']) assert.ok(bundles[page].includes('assets/css/tables-phone-v33-3.css'), page);
  const baloot = await read('public/assets/css/app-baloot.css');
  for (const theme of ['ivory', 'carbon', 'jade', 'royal', 'majlis']) assert.match(baloot, new RegExp(`body\\.game-baloot\\[data-felt="${theme}"\\] \\{ (--bl-trim: #[0-9a-f]{6}; )?--bl-frame-a:`), theme);
  assert.match(baloot, /body\.game-baloot \.bl-center::before \{/);
  assert.match(baloot, /--bl-card-w: clamp\(56px, min\(19vw, 10\.5svh\), 92px\)/);
  assert.match(await read('public/assets/css/hero-effects.css'), /\.hero-entry\{top:calc\(max\(8px,env\(safe-area-inset-top\)\) \+ 58px\);bottom:auto\}/);
});
