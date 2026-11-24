// 33.13.0: «الغرف» with two kinds (a quick room for one game, the room of twenty); every game asks
// its own modes before it starts; «جسر الألوان» wakes up (race, helps, effects); «لودو» gets the
// royal board for four and six, new pieces and its own sounds.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import * as Ludo from '../public/assets/js/engines/ludo-engine.js';
import * as Six from '../public/assets/js/ludo/six-layout.js';
import { partyGame } from '../public/assets/js/engines/party-catalog-v29.js';
import { createDOM, MiniElement } from './dom-harness.mjs';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');
async function board(state, options) {
  const h = await createDOM('ludo.html', { ...Ludo, ...Six });
  h.doc.createTextNode = (t) => { const n = new MiniElement('#text'); n.textContent = t; return n; };
  await h.runFile('assets/js/ludo/board.js');
  h.context.args = { host: h.doc.getElementById('board'), state, options };
  await vm.runInContext('renderLudoBoard(args.host,args.state,args.options)', h.context);
  return h.doc.querySelector('#board svg');
}

test('الغرف: a quick room for one game or the room of twenty, both one tap from the top', async () => {
  const page = await read('public/party.html'), js = await read('public/assets/js/party-v29.js');
  assert.match(page, /<title>الغرف — لعبة العباقرة<\/title>/);
  assert.match(page, /<b>الغرف<small>لعبة العباقرة<\/small><\/b>/);
  assert.match(page, /id="rmQuickTab"[^>]*data-room-kind="quick"/);
  assert.match(page, /id="rmTwentyTab"[^>]*data-room-kind="twenty"/);
  assert.match(page, /<section id="rmQuick"/); assert.match(page, /id="quickGames"/); assert.match(page, /<div id="rmTwenty" class="rm-twenty"[^>]*hidden>/);
  // a quick room: one game, as many seats as that game takes (never above twenty)
  assert.match(js, /const quickSeats=id=>Math\.min\(20,partyGame\(id\)\?\.maxPlayers\|\|8\);/);
  assert.match(js, /body:JSON\.stringify\(\{capacity:quickSeats\(id\),playlist\}\)/);
  for (const id of ['ludo', 'bridge', 'ten', 'quiz', 'memory']) assert.ok(partyGame(id), id + ' can open a quick room');
  const bundles = JSON.parse(await read('scripts/style-bundles.json'));
  assert.equal(bundles['party.html'].at(-1), 'assets/css/rooms-v33-13.css');
});

test('every game asks its own modes first; the words never give away who the rivals are', async () => {
  const js = await read('public/assets/js/instant-play-v33-12.js');
  for (const key of ['hockey', 'billiards', 'carrom', 'pegs', 'tanks', 'jewels', 'ludo', 'uno', 'bridge', 'ten', 'memory', 'logic']) assert.match(js, new RegExp('\\b' + key + ': \\{ (prep: [^\\n]*?)?groups: '), key);
  assert.match(js, /'⚙ كل الخيارات'/);
  assert.match(js, /localStorage/);
  assert.doesNotMatch(js, /كمبيوتر|بوت/);
  const ludo = await read('public/ludo.html');
  assert.doesNotMatch(ludo, /كمبيوتر|بوت/);
  assert.doesNotMatch(await read('public/assets/js/ludo/main.js'), /كمبيوتر|بوت/);
});

test('جسر الألوان: a race where everyone runs at once, two helps, and its own sounds and effects', async () => {
  const js = await read('public/assets/js/bridge-v33-12.js'), page = await read('public/bridge.html');
  assert.match(js, /const MODES = Object\.freeze\(\{ race: 'سباق', turns: 'بالدور' \}\);/);
  assert.match(page, /data-br-mode="race"/); assert.match(page, /data-br-mode="turns"/);
  assert.match(page, /id="brEye"/); assert.match(page, /id="brShield"/); assert.match(page, /id="brFx"/);
  assert.doesNotMatch(page + js, /كمبيوتر|بوت/);
});

test('لودو: the royal board — gold frame, crowned yards, a medallion, and four different pieces', async () => {
  assert.deepEqual([...(await import('../public/assets/js/ludo/board.js')).LUDO_NAMES], ['الأحمر', 'الأزرق', 'الأصفر', 'الأخضر', 'البنفسجي', 'البرتقالي']);
  const svg = await board(Ludo.createLudoGame(['A', 'B', 'C', 'D']), { viewer: 0, active: 0, legal: [] });
  assert.equal(svg.getAttribute('viewBox'), '-13 -13 626 626');
  assert.equal(svg.querySelectorAll('[data-yard]').length, 4);
  assert.equal(svg.querySelectorAll('[data-medallion]').length, 1);
  assert.equal(svg.querySelectorAll('[data-pawns] [data-token]').length, 16);
  // the yard pieces stand larger than the ones on the track
  assert.ok(svg.querySelectorAll('.ludo-pawn').every((p) => p.getAttribute('transform') === 'scale(1.3)'));
  const six = await board(Ludo.createLudoGame(['A', 'B', 'C', 'D', 'E', 'F']), { viewer: 2, active: 1, legal: [] });
  assert.equal(six.getAttribute('viewBox'), '29 45 542 510');
  assert.equal(six.querySelectorAll('[data-track]').length, 78); assert.equal(six.querySelectorAll('[data-home]').length, 30);
  assert.equal(six.querySelectorAll('[data-medallion]').length, 1);
});

test('لودو for six: the yards sit nearer, the board is larger and everything stays inside the frame', () => {
  for (const yard of Six.SIX_YARDS) assert.ok(Math.abs(Math.hypot(yard.x - 300, yard.y - 300) - 210) < 1e-6);
  // every tile, lane and yard seat, as seen by any player, inside the gold frame (inner 242, flat sides at 258)
  for (let viewer = 0; viewer < 6; viewer++) {
    const points = [...Six.SIX_TRACK, ...Six.SIX_LANES.flat(), ...Six.SIX_YARDS, ...Six.SIX_YARDS.flatMap((y) => y.slots)].map((p) => Six.sixRotate(p, viewer));
    for (const p of points) {
      assert.ok(Math.abs(p.x - 300) <= 258 - 13 + 1e-6, 'inside the flat sides');
      for (let side = 0; side < 6; side++) { const a = (side * 60 + 30) * Math.PI / 180; assert.ok((p.x - 300) * Math.cos(a) + (p.y - 300) * Math.sin(a) <= 242 - 13 + 1e-6, 'inside the slanted sides'); }
    }
  }
});

test('لودو sounds and the dock: its own sound kit, the reactions button beside the dice', async () => {
  const { ludoSound } = await import('../public/assets/js/ludo/sound-v33-13.js');
  for (const name of ['step', 'land', 'out', 'capture', 'home', 'six', 'turn', 'win', 'lose']) { assert.equal(typeof ludoSound[name], 'function', name); assert.doesNotThrow(() => ludoSound[name](3), name + ' is silent where there is no sound'); }
  const main = await read('public/assets/js/ludo/main.js'), page = await read('public/ludo.html'), sound = await read('public/assets/js/ludo/sound-v33-13.js');
  assert.match(main, /import \{ ludoSound \} from '\.\/sound-v33-13\.js/);
  assert.match(main, /onStep: \(n\) => ludoSound\.step\(n\)/);
  assert.match(sound, /s\.muted \|\| s\.effects === false/);
  assert.match(page, /<div class="ludo-dock">[^]*<button class="rx-fab ludo-rx" type="button" data-reactions-open hidden>/);
  const bundles = JSON.parse(await read('scripts/style-bundles.json'));
  assert.deepEqual(bundles['ludo.html'].slice(-2), ['assets/css/ludo-world-v33-13.css', 'assets/css/ludo-viewport-v33-11-8.css']);
});
