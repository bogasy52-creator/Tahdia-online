// 33.10.3: the home lobby (spotlight, quick doors, library), live counts, and the fixes found in the audit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { environment, api } from './worker-harness.mjs';
import { PresenceRegistry, cleanBeat, presencePage } from '../src/presence/presence-registry.js';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');
const ID = (n) => ('tab' + n).padEnd(12, '0'), DEV = (n) => ('dev' + n).padEnd(12, '0');
function registry() { const values = new Map(); return new PresenceRegistry({ storage: { get: async (k) => structuredClone(values.get(k)), put: async (k, v) => values.set(k, structuredClone(v)) } }); }

test('the home opens on a spotlight of five games, then four quick doors, then the library', async () => {
  const home = await read('public/index.html');
  assert.match(home, /<body class="[^"]*home-v26 home-v33103">/);
  const featured = home.slice(home.indexOf('<div class="home-featured"'), home.indexOf('data-spot-dots'));
  const order = [...featured.matchAll(/class="home-feature" href="([^"]+)"/g)].map((m) => m[1]);
  // 33.10.5: the new لودو and the new look of ماستر الجواهر lead the spotlight
  assert.deepEqual(order, ['/ludo', '/jewels', '/tanks', '/billiards', '/jackaroo'], 'the newest games lead the spotlight');
  for (const href of ['/party', '/tournament', '/leaderboard?period=skill']) assert.match(home, new RegExp('<a class="home-tile" href="' + href.replace('?', '\\?') + '"'));
  assert.match(home, /id="homeJoinOpen"[^>]*><span class="home-tile-icon" aria-hidden="true">#<\/span><b>ادخل برمز<\/b>/);
  assert.doesNotMatch(home, /<span class="game-number">\d+<\/span>/, 'running numbers on the cards are gone; «جديد» stays');
  assert.match(home, /<span class="game-number">جديد<\/span>/);
  assert.match(home, /assets\/js\/home-v33-10-3\.js\?v=/);
  assert.ok(home.indexOf('class="home-actions"') < home.indexOf('id="games"'));
  const bundles = JSON.parse(await read('scripts/style-bundles.json'));
  assert.equal(bundles['index.html'].at(-1), 'assets/css/home-v33-10-3.css');
  assert.match(await read('scripts/build-styles.mjs'), /'assets\/css\/home-v33-10-3\.css'\]\)finalStyles\.add/);
  const css = await read('public/assets/css/home-v33-10-3.css');
  assert.match(css, /scroll-snap-type:x mandatory/);
  assert.match(css, /\.home-feature:first-child\{grid-column:span 2;grid-row:span 2\}/, 'a bento on wide screens');
  assert.match(css, /prefers-reduced-motion/);
});

// 33.10.6: الزهرة was the same game as لودو, so its card left the home page
// and old links to /zahra open لودو (rooms already open still finish there).
test('the zahra card is gone and its page sends players to ludo', async () => {
  const home = await read('public/index.html');
  assert.doesNotMatch(home, /href="\/zahra"/);
  assert.match(home, /href="\/ludo"/);
  const page = await read('public/zahra.html');
  assert.match(page, /<meta charset="utf-8"><script src="assets\/js\/zahra-moved\.js\?v=[^"]+"><\/script>/);
  assert.match(await read('public/assets/js/zahra-moved.js'), /location\.replace\('\/ludo'/);
});

test('live counts: one person per device, counted by game; the endpoint sends numbers and never names', async () => {
  const reg = registry(), now = 2_000_000;
  reg.beat(cleanBeat({ cid: ID(1), did: DEV(1), path: '/pegs', name: 'نورة' }), null, now);
  reg.beat(cleanBeat({ cid: ID(2), did: DEV(1), path: '/', vis: 'hidden' }), null, now - 4000);
  reg.beat(cleanBeat({ cid: ID(3), did: DEV(2), path: '/pegs' }), { user: 'saad_1', name: 'سعد' }, now);
  reg.beat(cleanBeat({ cid: ID(4), did: DEV(3), path: '/uno' }), null, now);
  const live = reg.live(now);
  assert.deepEqual(live, { ok: true, people: 3, games: { pegs: 2, chaos: 1 } });
  assert.equal(presencePage('/uno').key, 'chaos', 'أونو counts as its game');
  const env = environment(), res = await api(env, '/api/presence/live');
  assert.equal(res.response.status, 200);
  assert.equal(res.data.ok, true);
  assert.deepEqual(Object.keys(res.data).sort(), ['games', 'ok', 'people']);
  const script = await read('public/assets/js/home-v33-10-3.js');
  assert.match(script, /fetch\('\/api\/presence\/live'/);
  assert.match(script, /n < 2/, 'a lonely «1 يلعب» is never shown');
});

test('audit fixes: hero faces from the catalogue, the zahra arrows, Western digits', async () => {
  for (const file of ['public/assets/js/profile-pro-v33-9-4.js', 'public/assets/js/carrom/main.js', 'public/assets/js/jewels/main.js', 'public/assets/js/pegs/main.js']) {
    const src = await read(file);
    assert.match(src, /BS_CAREER_CORE\?\.heroFace\?\./, file);
    assert.doesNotMatch(src, /'\/assets\/heroes\/face\/' ?\+ ?(?:me\.hero|hero|character) ?\+ ?'\.webp'/, file);
  }
  const zahra = await read('public/assets/js/zahra-studio-v33-10.js');
  assert.doesNotMatch(zahra, /-\(L\.seats===6\?p\.a:0,theme\)/, 'the stray comma that made the arrows rotate(NaN)');
  assert.match(zahra, /-\(L\.seats===6\?\(Number\(p\.a\)\|\|0\):0\)/);
  for (const file of ['public/zahra.html', 'public/race.html']) assert.doesNotMatch(await read(file), /[٠-٩]/, file);
  assert.doesNotMatch(await read('public/assets/js/admin.js'), /toLocaleString\('ar-SA'\)/);
});
