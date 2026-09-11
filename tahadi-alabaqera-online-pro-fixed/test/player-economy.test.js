import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import vm from 'node:vm';

const root = new URL('../', import.meta.url).pathname;
const publicDir = join(root, 'public');
const catalogSource = await readFile(join(publicDir, 'assets/js/store-catalog.js'), 'utf8').catch(() => '');
const progressionSource = await readFile(join(publicDir, 'assets/js/progression.js'), 'utf8');

function makeStorage(seed = new Map()) {
  return {
    values: seed,
    getItem(key) { return seed.has(key) ? seed.get(key) : null; },
    setItem(key, value) { seed.set(key, String(value)); },
    removeItem(key) { seed.delete(key); },
  };
}

function boot(storage = makeStorage()) {
  const events = [];
  const window = {
    dispatchEvent(event) { events.push(event); },
    addEventListener() {},
  };
  const context = vm.createContext({
    window,
    localStorage: storage,
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    Date,
    Set,
    Map,
    Math,
    JSON,
    structuredClone,
    crypto: { randomUUID: () => 'generated-tx' },
  });
  vm.runInContext(catalogSource, context);
  vm.runInContext(progressionSource, context);
  return { api: window.TAHADI_PROGRESS, catalog: window.TAHADI_STORE_CATALOG, storage, events };
}

test('a new profile receives the 500 coin starter grant only once', () => {
  const storage = makeStorage();
  const first = boot(storage);
  assert.equal(first.api.read().coins, 500);
  assert.equal(first.api.read().starterGrantClaimed, true);

  const reloaded = boot(storage);
  assert.equal(reloaded.api.read().coins, 500);
});

test('purchase is atomic, rejects duplicate ownership, and equips an owned item', () => {
  const { api } = boot();
  const before = api.read().coins;
  const bought = api.purchase('avatar-orbit', 'tx-avatar-1');
  assert.equal(bought.ok, true);
  assert.equal(bought.profile.coins, before - 180);
  assert.ok(bought.profile.inventory.includes('avatar-orbit'));
  assert.equal(bought.profile.purchaseLog.filter((entry) => entry.txId === 'tx-avatar-1').length, 1);

  const replay = api.purchase('avatar-orbit', 'tx-avatar-1');
  assert.equal(replay.ok, false);
  assert.equal(replay.error, 'already_owned');
  assert.equal(api.read().coins, before - 180);

  const equipped = api.equip('avatar-orbit');
  assert.equal(equipped.ok, true);
  assert.equal(equipped.profile.equipped.avatar, 'avatar-orbit');
});

test('failed purchases and invalid equipment leave the balance unchanged', () => {
  const { api } = boot();
  const profile = api.read();
  profile.coins = 5;
  api.save(profile);

  const expensive = api.purchase('avatar-orbit', 'tx-poor');
  assert.equal(expensive.ok, false);
  assert.equal(expensive.error, 'insufficient_coins');
  assert.equal(api.read().coins, 5);

  const locked = api.equip('table-royal');
  assert.equal(locked.ok, false);
  assert.equal(locked.error, 'not_owned');
  assert.equal(api.read().equipped.table, 'table-midnight');
});

test('unknown cosmetic identifiers are discarded when the catalog is available', () => {
  const { api } = boot();
  const profile = api.read();
  profile.inventory.push('avatar-forged', 'table-does-not-exist');
  profile.equipped.avatar = 'avatar-forged';
  const saved = api.save(profile);
  assert.equal(saved.inventory.includes('avatar-forged'), false);
  assert.equal(saved.inventory.includes('table-does-not-exist'), false);
  assert.equal(saved.equipped.avatar, 'avatar-nova');
});

test('daily rewards can be claimed once per UTC day and advance the streak', () => {
  const today = new Date().toISOString().slice(0, 10);
  const yesterdayDate = new Date(`${today}T00:00:00Z`);
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
  const yesterday = yesterdayDate.toISOString().slice(0, 10);
  const { api } = boot();
  const first = api.claimDaily(today);
  assert.equal(first.ok, true);
  assert.equal(first.reward, 60);
  const duplicate = api.claimDaily(today);
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.error, 'already_claimed');

  const second = boot();
  const profile = second.api.read();
  profile.dailyReward = { lastClaim: yesterday, streak: 1 };
  second.api.save(profile);
  const next = second.api.claimDaily(today);
  assert.equal(next.ok, true);
  assert.equal(next.reward, 80);
  const older = second.api.claimDaily(yesterday);
  assert.equal(older.ok, false);
  assert.equal(older.error, 'invalid_claim_date');
});

test('weekly mission rewards require their target and can only be claimed once', () => {
  const { api } = boot();
  const blocked = api.claimWeekly('games', '2026-09-10');
  assert.equal(blocked.ok, false);
  assert.equal(blocked.error, 'mission_incomplete');

  api.recordMission({ date: '2026-09-10', games: 7, wins: 3, score: 5000 });
  const before = api.read().coins;
  const claimed = api.claimWeekly('games', '2026-09-10');
  assert.equal(claimed.ok, true);
  assert.equal(claimed.reward, 160);
  assert.equal(api.read().coins, before + 160);
  assert.equal(api.claimWeekly('games', '2026-09-10').error, 'already_claimed');
});

test('merge preserves owned cosmetics and the strongest progression values', () => {
  const { api } = boot();
  api.purchase('avatar-orbit', 'tx-local');
  const merged = api.merge({
    revision: 9,
    updatedAt: Date.now() + 1000,
    xp: 4200,
    level: 8,
    wins: 19,
    games: 25,
    coins: 900,
    inventory: ['frame-gold'],
    purchaseLog: [{ txId: 'remote-1', itemId: 'frame-gold', price: 240, at: 10 }],
    equipped: { frame: 'frame-gold' },
  });
  assert.equal(merged.level, 8);
  assert.equal(merged.xp, 4200);
  assert.equal(merged.wins, 19);
  assert.ok(merged.inventory.includes('avatar-orbit'));
  assert.ok(merged.inventory.includes('frame-gold'));
  assert.equal(merged.equipped.frame, 'frame-gold');
});

test('merging an older account snapshot never restores coins already spent locally', () => {
  const { api } = boot();
  const bought = api.purchase('avatar-orbit', 'tx-no-resurrection');
  assert.equal(bought.profile.coins, 320);
  const merged = api.merge({ revision: 1, updatedAt: 1, coins: 900 });
  assert.equal(merged.coins, 320);
});

test('an award event is idempotent across reconnects', () => {
  const { api } = boot();
  const first = api.award({ game: 'snakes', score: 500, win: true, eventId: 'online:snakes:123456:9:p1' });
  const second = api.award({ game: 'snakes', score: 500, win: true, eventId: 'online:snakes:123456:9:p1' });
  assert.equal(second.duplicate, true);
  assert.equal(api.read().games, first.games);
  assert.equal(api.read().coins, first.coins);
});

test('owner entitlement is memory-only, unlocks the catalog, and never decrements coins', () => {
  const storage = makeStorage();
  const { api, catalog } = boot(storage);
  const before = api.read().coins;
  api.setEntitlements({ owner: true, infiniteCoins: true, unlockAll: true, username: 'bosrag' });
  assert.equal(api.balanceLabel(), '∞');
  assert.equal(api.isOwned('table-royal'), true);
  assert.equal(api.availableItems().length, catalog.length);
  assert.equal(api.purchase('table-royal', 'owner-tx').ok, true);
  assert.equal(api.read().coins, before);

  const afterReload = boot(storage);
  assert.equal(afterReload.api.balanceLabel(), String(before));
  assert.equal(afterReload.api.isOwner(), false);
});
