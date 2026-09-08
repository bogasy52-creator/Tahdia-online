import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import vm from 'node:vm';

const root = new URL('../', import.meta.url).pathname;
const publicDir = join(root, 'public');
const games = ['memory', 'reaction', 'logic', 'puzzle'];

test('all four retained arcade challenges are playable pages, not placeholders', async () => {
  for (const game of games) {
    const page = await readFile(join(publicDir, `${game}.html`), 'utf8');
    assert.doesNotMatch(page, /قيد التجهيز|قريبًا/);
    assert.match(page, /data-arcade-game=/);
    assert.match(page, /assets\/js\/progression\.js/);
    assert.match(page, /assets\/js\/arcade-games\.js/);
  }
  await access(join(publicDir, 'assets/css/arcade.css'));
  await access(join(publicDir, 'assets/js/arcade-games.js'));
});

test('removed pressure-aim mode is no longer a playable game', async () => {
  const page = await readFile(join(publicDir, 'accuracy.html'), 'utf8');
  assert.doesNotMatch(page, /data-arcade-game="accuracy"/);
  assert.match(page, /url=\/spotdiff/);
});

test('selected social strategy games ship as playable pages with progression', async () => {
  const games = ['draw', 'secret', 'order', 'auction', 'cipher'];
  for (const game of games) {
    const page = await readFile(join(publicDir, `${game}.html`), 'utf8');
    assert.doesNotMatch(page, /قيد التجهيز|قريبًا/);
    assert.match(page, new RegExp(`data-new-game="${game}"`));
    assert.match(page, /assets\/js\/new-games\.js/);
    assert.match(page, /assets\/css\/new-games\.css/);
  }
  await access(join(publicDir, 'assets/js/new-games.js'));
  await access(join(publicDir, 'assets/css/new-games.css'));
});

test('arcade runtime tolerates optional shell elements and cancels false-start timers', async () => {
  const source = await readFile(join(publicDir, 'assets/js/arcade-games.js'), 'utf8');
  assert.match(source, /if\(name\)name\.textContent/);
  assert.match(source, /if\(signalTimer\)\{clearTimeout\(signalTimer\);timers\.delete\(signalTimer\)/);
  assert.match(source, /href="\/matchmaking"/);
  new vm.Script(source);
});

test('progression awards XP, coins, ranks, daily progress and per-game bests', async () => {
  const source = await readFile(join(publicDir, 'assets/js/progression.js'), 'utf8');
  const values = new Map();
  const window = { dispatchEvent() {}, addEventListener() {} };
  const context = {
    window,
    localStorage: { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    Date,
    Set,
  };
  vm.runInNewContext(source, context);
  const first = window.TAHADI_PROGRESS.award({ game: 'logic', score: 800, win: true });
  assert.equal(first.games, 1);
  assert.equal(first.wins, 1);
  assert.equal(first.bestByGame.logic, 800);
  assert.ok(first.xp > 0);
  assert.ok(first.coins > 0);
  assert.ok(first.titles.includes('عبقري المنطق'));
  assert.equal(first.daily.games, 1);
  assert.equal(window.TAHADI_PROGRESS.rankFor(15), 'GOLD');
  assert.ok(window.TAHADI_PROGRESS.xpProgress(first) >= 0);
});

test('matchmaking is server-backed and packaged in the Worker configuration', async () => {
  const [configRaw, worker, matching, client] = await Promise.all([
    readFile(join(root, 'wrangler.jsonc'), 'utf8'),
    readFile(join(root, 'src/index.js'), 'utf8'),
    readFile(join(root, 'src/matchmaking.js'), 'utf8'),
    readFile(join(publicDir, 'assets/js/matchmaking.js'), 'utf8'),
  ]);
  const config = JSON.parse(configRaw);
  assert.ok(config.durable_objects.bindings.some((binding) => binding.name === 'BOARD_ROOMS' && binding.class_name === 'BoardRoom'));
  assert.match(worker, /api\/matchmaking\/join/);
  assert.match(matching, /class MatchmakingRoom extends DurableObject/);
  assert.match(matching, /x\?\.status === 'waiting' && x\.game === game/);
  assert.doesNotMatch(matching, /Math\.abs\(Number\(x\.level\) - level\)/);
  assert.match(client, /MAX_WAIT=90_000/);
  assert.match(client, /localStorage\.setItem\('online_name'/);
});

test('PWA shell includes every new arcade and matchmaking route', async () => {
  const sw = await readFile(join(publicDir, 'service-worker.js'), 'utf8');
  for (const route of ['/matchmaking', ...games.map((game) => `/${game}`), '/assets/css/arcade.css', '/assets/js/progression.js', '/assets/js/arcade-games.js']) {
    assert.ok(sw.includes(`'${route}'`) || sw.includes(`"${route}"`), `missing ${route} from PWA shell`);
  }
});
