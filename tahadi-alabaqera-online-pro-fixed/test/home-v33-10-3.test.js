// 33.10.3: the home lobby (spotlight, quick doors, library), live counts, and the fixes found in the audit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { environment, api } from './worker-harness.mjs';
import { PresenceRegistry, cleanBeat, presencePage } from '../src/presence/presence-registry.js';

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');
const ID = (n) => ('tab' + n).padEnd(12, '0'), DEV = (n) => ('dev' + n).padEnd(12, '0');
function registry() { const values = new Map(); return new PresenceRegistry({ storage: { get: async (k) => structuredClone(values.get(k)), put: async (k, v) => values.set(k, structuredClone(v)) } }); }

test('the home offers a prominent Ludo table, other live games, room entry and the complete library', async () => {
 const home=await read('public/index.html');
 for(const marker of ['home-palace','palace-ludo','palace-jewels','palace-pool','palace-room-actions','id="homeJoinOpen"','id="games"','data-career-coins','data-career-xp','data-open-profile','data-invite-list'])assert.ok(home.includes(marker),marker);
 const cards=[...home.matchAll(/class="palace-game [^"]+" href="([^"]+)"/g)].map(m=>m[1]);assert.deepEqual(cards,['/ludo','/jewels','/billiards']);
 for(const href of ['/party','/tournament','/jackaroo','/social'])assert.ok(home.includes('href="'+href+'"'));
 assert.ok(home.indexOf('palace-room-actions')<home.indexOf('id="games"'));
 assert.doesNotMatch(home,/1,250,000|8,430|Lv\. 56/);
 const bundles=JSON.parse(await read('scripts/style-bundles.json'));assert.equal(bundles['index.html'].at(-1),'assets/css/palace-lobby-v33-11-7.css');
 const css=await read('public/assets/css/palace-lobby-v33-11-7.css');assert.match(css,/prefers-reduced-motion/);assert.match(css,/max-width:350px/);
});

// 33.10.6: الزهرة was the same game as لودو, so its card left the home page
// and old links to /zahra open لودو (rooms already open still finish there).
test('Home offers one Ludo card and older Zahra entry links redirect to it',async()=>{
 const home=await read('public/index.html');assert.doesNotMatch(home,/href="\/zahra"/);assert.match(home,/href="\/ludo"/);
 assert.match(await read('public/zahra.html'),/src="assets\/js\/zahra-moved\.js/);
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
