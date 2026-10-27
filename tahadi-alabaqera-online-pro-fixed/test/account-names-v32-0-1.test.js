import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { environment, api } from './worker-harness.mjs';
const Worker = await import('../src/index.js');
const { accountCareer } = await import('../src/social/account-policy.js');

const root = new URL('../', import.meta.url).pathname;
const read = (file) => readFile(root + file, 'utf8');

// Rooms are replaced by a recorder: the test sees exactly what the Worker forwards.
function recorder(log) {
  return {
    idFromName: (name) => name,
    get: (name) => ({
      fetch: async (input, init) => {
        const request = input instanceof Request ? input : new Request(input, init);
        const url = new URL(request.url);
        if (url.pathname.endsWith('/ws')) log.push({ object: name, name: url.searchParams.get('name'), account: request.headers.get('x-bs-account') });
        if (url.pathname.endsWith('/join')) log.push({ object: name, body: JSON.parse(await request.text()) });
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
      },
    }),
  };
}

async function signedInEnvironment() {
  const env = environment();
  env.SOCIAL_USERS = env.BOARD_ROOMS; // accounts keep their own namespace
  const { data } = await api(env, '/api/social/signup', { username: 'saad_q', displayName: 'سعد الحساب', password: 'StrongPass123!' });
  assert.ok(data.token);
  const log = [];
  env.ROOMS = recorder(log);
  env.BOARD_ROOMS = recorder(log);
  env.QUICK_ARENA = recorder(log);
  return { env, token: data.token, log };
}

function socket(path, protocols) {
  return new Request('https://game.test' + path + '?name=' + encodeURIComponent('ضيف قديم'), {
    headers: { upgrade: 'websocket', 'sec-websocket-protocol': protocols.join(', '), origin: 'https://game.test', 'cf-connecting-ip': '127.0.0.' + Math.floor(Math.random() * 250) },
  });
}

test('32.0.1: a signed-in player joins every kind of room under the account name', async () => {
  const { env, token, log } = await signedInEnvironment();
  const rooms = [
    ['/api/rooms/123456/ws', 'busraj-v1'],
    ['/api/board/rooms/123456/ws', 'busraj-v1'],
    ['/api/party/rooms/123456/ws', 'tahdia-party-v29'],
    ['/api/paths/rooms/123456/ws', 'tahdia-paths-v1'],
    ['/api/sudoku/rooms/123456/ws', 'tahdia-sudoku-v1'],
    ['/api/picture/rooms/123456/ws', 'tahdia-picture-v1'],
    ['/api/serpent/rooms/123456/ws', 'busraj-serpent-v1'],
  ];
  for (const [path, protocol] of rooms) {
    log.length = 0;
    await Worker.default.fetch(socket(path, [protocol, 'st.' + token]), env);
    const sent = log.find((x) => 'name' in x);
    assert.ok(sent, path + ' reached its room');
    assert.equal(sent.name, 'سعد الحساب', path + ': the account name, not the name the page sent');
    assert.equal(sent.account, 'saad_q', path);
    // a guest keeps the name typed on the page
    log.length = 0;
    await Worker.default.fetch(socket(path, [protocol]), env);
    const guest = log.find((x) => 'name' in x);
    assert.equal(guest.name, 'ضيف قديم', path + ' guest');
    assert.equal(guest.account, null, path + ' guest has no account');
  }
  // quick matches use the same cleaned account name
  log.length = 0;
  const quick = new Request('https://game.test/api/quick/join', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token, origin: 'https://game.test', 'cf-connecting-ip': '127.0.0.9' }, body: JSON.stringify({ name: 'ضيف قديم' }) });
  await Worker.default.fetch(quick, env);
  assert.equal(log.find((x) => x.body)?.body.name, 'سعد الحساب');
});

test('32.0.1: the account career always carries the account display name', () => {
  const career = accountCareer({ name: 'اسم قديم', coins: 50 }, { username: 'saad_q', displayName: 'سعد الحساب' });
  assert.equal(career.name, 'سعد الحساب');
  assert.equal(career.coins, 50);
  assert.equal(accountCareer({ name: 'لاعب' }, { username: 'ghost' }).name, 'لاعب', 'no display name: nothing to copy');
});

test('32.0.1: every game name field shows the account name and is locked while signed in', async () => {
  // 33.0.0: the online games share one menu; its name is the account's, then the party's,
  // then the guest's own — and only a guest can change it
  const fields = {
    'public/party.html': ['name'], 'public/paths-online.html': ['pathName'],
    'public/sudoku.html': ['soName'], 'public/picture.html': ['playerName'],
  };
  for (const [file, ids] of Object.entries(fields)) {
    const html = await read(file);
    for (const id of ids) assert.match(html, new RegExp('<input id="' + id + '" data-account-name'), file + '#' + id);
  }
  const menu = await read('public/assets/js/game-menu-v33.js');
  assert.match(menu, /const name=accountName\(\)\|\|root\.BS_PARTY_LINK\?\.name\|\|store\.get\(NAME_KEY\)/);
  assert.match(menu, /if\(!account&&!root\.BS_PARTY_LINK\?\.name\)\{/, 'only a guest outside a party edits the name');
  for (const file of ['public/online.html', 'public/snakes.html', 'public/zahra.html', 'public/jackaroo.html', 'public/dice.html', 'public/baloot.html', 'public/serpent.html']) {
    const html = await read(file);
    assert.match(html, /game-menu-v33\.js/, file + ' uses the shared menu');
    assert.doesNotMatch(html, /id="(?:createName|joinName|onlineName|nameBots|nameQuick|nameRoom|arenaName)"/, file + ' has no name field of its own');
  }
  const social = await read('public/assets/js/social-client.js');
  assert.match(social, /function bindAccountNames\(profile\)/);
  assert.match(social, /accountName: \(\) => accountName\(\)/);
  assert.match(social, /profile: \(\) => \(token\(\) \? cachedProfile\(\) : null\)/, 'a profile left behind after sign-out is not an account');
  assert.match(social, /signedOutElsewhere\(session\)/);
  // pages prefer the account name and never save it as their guest name
  const baloot = await read('public/assets/js/baloot-table.js');
  assert.match(baloot, /const name = window\.BS_GAME_MENU\?\.playerName\?\.\(\) \|\| accountName\(\)/);
  assert.match(await read('public/assets/js/party-v29.js'), /\$\('name'\)\.value=window\.BS_SOCIAL\?\.accountName\?\.\(\)\|\|localStorage\.getItem\('bs_party_name'\)/);
  // 32.1.0: inside a party round a guest plays under the party name; the account name still comes first
  assert.match(await read('public/assets/js/picture-ui.js'), /url\.searchParams\.set\('name',accountName\(\)\|\|(?:window\.BS_PARTY_LINK\?\.name\?\.slice\(0,20\)\|\|)?read\('bs-picture-name'\)/);
  assert.match(await read('public/online.html'), /const account=cleanName\(window\.BS_SOCIAL\?\.accountName\?\.\(\)\);if\(account\)return account;/);
  const career = await read('public/assets/js/career-client.js');
  assert.match(career, /name:accountName\|\|cached\.name/);
  assert.match(career, /window\.BS_SOCIAL\?\.me\?\.\(true\)/, 'a rename refreshes the account name right away');
});

test('32.0.1: the quiz final results are ranked by points with places', async () => {
  const html = await read('public/online.html');
  const source = html.match(/const PLACE_NAMES=[^\n]+/)[0] + '\n' + html.match(/function rankByScore[^\n]+/)[0] + '\n' + html.match(/function placeLabel[^\n]+/)[0];
  const ctx = {};
  vm.runInNewContext(source + '\nthis.rankByScore=rankByScore;this.placeLabel=placeLabel;', ctx);
  const ranked = ctx.rankByScore([{ id: 'a', score: 300 }, { id: 'b', score: 900 }, { id: 'c', score: 900 }, { id: 'd', score: 120 }]);
  assert.deepEqual(Array.from(ranked, (p) => p.id + p.place), ['b0', 'c0', 'a2', 'd3'], 'equal points share a place');
  assert.equal(ctx.placeLabel(0), '🥇 الأول');
  assert.equal(ctx.placeLabel(1), '🥈 الثاني');
  assert.equal(ctx.placeLabel(2), '🥉 الثالث');
  assert.equal(ctx.placeLabel(3), 'الرابع');
  assert.equal(ctx.placeLabel(20), 'رقم 21');
  assert.match(html, /function rankRow\(place,name,score,mine,note='',mineLabel='أنت'\)/);
  assert.match(html, /\$\('#finished'\)\.scrollIntoView\(/, 'the ranking comes into view when the match ends');
  assert.match(html, /for\(const p of rankByScore\(state\.players\)\)rows\.push\(rankRow/);
  assert.match(html, /ترتيب الفرق/);
});
