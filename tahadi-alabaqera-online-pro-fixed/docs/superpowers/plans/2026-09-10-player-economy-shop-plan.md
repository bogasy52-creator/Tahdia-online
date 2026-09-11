# Player Economy and Shop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a persistent in-game economy, complete cosmetic shop, account synchronization, and the server-verified `bosrag` owner entitlement.

**Architecture:** Extend the existing local-first `TAHADI_PROGRESS` API with a versioned schema and transactional commerce methods. Keep the catalog in a separate browser-global data file, render the shop in its own page, and synchronize snapshots through the existing authenticated social account Durable Object.

**Tech Stack:** Vanilla HTML/CSS/JavaScript, Node test runner, Cloudflare Workers Durable Objects, localStorage.

**Spec:** `docs/superpowers/specs/2026-09-10-bots-shop-progression-design.md`

## Global Constraints

- Use one in-game coin currency only; no real-money payments.
- Grant 500 coins once to a new profile.
- Save locally immediately and sync to an authenticated account when available.
- Only the server-authenticated normalized username `bosrag` receives `owner: true`, infinite coins, and all cosmetics unlocked.
- Preserve all existing V5.0 profile fields and migrate old localStorage data safely.
- Use local SVG/CSS artwork and existing local audio assets so the PWA remains offline-capable.

---

### Task 1: Catalog and transactional local economy

**Files:**
- Create: `public/assets/js/store-catalog.js`
- Modify: `public/assets/js/progression.js`
- Test: `test/player-economy.test.js`

**Interfaces:**
- Produces: `window.TAHADI_STORE_CATALOG: Array<StoreItem>`.
- Produces: `TAHADI_PROGRESS.purchase(itemId, transactionId)`, `equip(itemId)`, `claimDaily(date)`, `recordMission(event)`, `merge(remote)`, `setEntitlements({owner})`, and `balanceLabel()`.
- `StoreItem` fields: `{id, category, name, price, rarity, level, preview, sound?}`.

- [ ] **Step 1: Write the failing economy tests**

```js
test('new profiles receive 500 coins exactly once', () => {
  const api = bootProgress();
  assert.equal(api.read().coins, 500);
  assert.equal(bootProgress(sharedStorage).read().coins, 500);
});

test('purchase is atomic and idempotent', () => {
  const api = bootProgress();
  const first = api.purchase('avatar-orbit', 'tx-1');
  const replay = api.purchase('avatar-orbit', 'tx-1');
  assert.equal(first.ok, true);
  assert.equal(replay.error, 'already_owned');
  assert.equal(api.read().purchaseLog.filter(x => x.txId === 'tx-1').length, 1);
});

test('owner entitlement unlocks catalog without decrementing coins', () => {
  const api = bootProgress();
  api.setEntitlements({owner:true, username:'bosrag'});
  const before = api.read().coins;
  assert.equal(api.purchase('table-royal', 'owner-tx').ok, true);
  assert.equal(api.read().coins, before);
  assert.equal(api.balanceLabel(), '∞');
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test test/player-economy.test.js`

Expected: FAIL because the catalog and commerce methods do not exist.

- [ ] **Step 3: Implement catalog and profile schema V3**

Create fixed IDs for 12 avatars, 8 frames, 6 tables, 6 entrances, 6 victory effects, and 5 sound packs. Add defaults:

```js
inventory: ['avatar-nova','frame-classic','table-midnight','entrance-focus','victory-crown','sound-classic'],
equipped: {avatar:'avatar-nova',frame:'frame-classic',table:'table-midnight',entrance:'entrance-focus',victory:'victory-crown',sound:'sound-classic'},
purchaseLog: [], starterGrantClaimed: true, revision: 1, updatedAt: Date.now(),
dailyReward: {lastClaim:'', streak:0}, weekly: {week:'', counters:{games:0,wins:0,score:0}, claimed:[]}
```

Implement validation, duplicate transaction protection, ownership checks, level gates, daily rewards `[60,80,100,130,160,200,300]`, and union/max merge rules from the spec.

- [ ] **Step 4: Run focused and existing progression tests**

Run: `node --test test/player-economy.test.js test/arcade-v5.test.js`

Expected: PASS with zero failures.

- [ ] **Step 5: Commit**

```bash
git add public/assets/js/store-catalog.js public/assets/js/progression.js test/player-economy.test.js
git commit -m "feat: add persistent player economy"
```

### Task 2: Authenticated cloud synchronization and owner entitlement

**Files:**
- Modify: `src/social/social-user.js`
- Modify: `src/social/social-api.js`
- Modify: `public/assets/js/social-client.js`
- Test: `test/progression-sync.test.js`
- Test: `test/social-integration.test.js`

**Interfaces:**
- Consumes: `TAHADI_PROGRESS.merge(remote)` and `save(profile)`.
- Produces: authenticated `GET /api/social/progress` and `PUT /api/social/progress`.
- Produces: dashboard field `entitlements: {owner:boolean, infiniteCoins:boolean, unlockAll:boolean}`.

- [ ] **Step 1: Write failing server authorization and sync tests**

```js
test('only authenticated bosrag receives owner entitlement', async () => {
  const bosrag = await signup(env, 'bosrag', 'بوسراج');
  const other = await signup(env, 'bosrag2', 'bosrag');
  assert.equal((await social(env, '/api/social/me', {token:bosrag})).data.entitlements.owner, true);
  assert.equal((await social(env, '/api/social/me', {token:other})).data.entitlements.owner, false);
});

test('progress endpoint rejects guests and preserves newer revisions', async () => {
  assert.equal((await social(env, '/api/social/progress')).response.status, 401);
  const token = await signup(env, 'alice_sync', 'أليس');
  await social(env, '/api/social/progress', {method:'PUT', token, body:{revision:4,xp:900,inventory:['avatar-nova']}});
  const stale = await social(env, '/api/social/progress', {method:'PUT', token, body:{revision:2,xp:10}});
  assert.equal(stale.response.status, 409);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test test/progression-sync.test.js test/social-integration.test.js`

Expected: FAIL because progress routes and entitlements are absent.

- [ ] **Step 3: Add validated Durable Object progress storage**

Store a sanitized snapshot under `progress`, cap arrays and strings, reject stale revisions with HTTP 409, and derive owner entitlement only from `this.profile.username === 'bosrag'`. Route requests through `requireAuth`; never trust a submitted username or owner flag.

- [ ] **Step 4: Add debounced client synchronization**

On authenticated dashboard load, set server entitlements, merge remote progress, and send the merged newer revision. On `tahadi-progress`, debounce PUT requests; keep local changes when offline and retry on the next dashboard/session refresh.

- [ ] **Step 5: Run focused integration tests**

Run: `node --test test/progression-sync.test.js test/social-integration.test.js`

Expected: PASS with zero authorization or revision failures.

- [ ] **Step 6: Commit**

```bash
git add src/social/social-user.js src/social/social-api.js public/assets/js/social-client.js test/progression-sync.test.js test/social-integration.test.js
git commit -m "feat: sync progression with account entitlements"
```

### Task 3: Complete responsive shop surface

**Files:**
- Create: `public/store.html`
- Create: `public/assets/css/store.css`
- Create: `public/assets/js/store.js`
- Modify: `public/index.html`
- Modify: `public/assets/css/home-shell.css`
- Test: `test/store-ui.test.js`

**Interfaces:**
- Consumes: `TAHADI_STORE_CATALOG` and all commerce methods from Task 1.
- Produces: accessible category filters, rotating daily showcase, preview modal, buy/equip states, daily reward, weekly missions, and purchase history.

- [ ] **Step 1: Write failing static UI tests**

```js
test('shop exposes all cosmetic categories and purchase states', async () => {
  const html = await readFile(join(pub,'store.html'),'utf8');
  for (const id of ['avatar','frame','table','entrance','victory','sound']) assert.match(html, new RegExp(`data-category="${id}"`));
  assert.match(html, /id="shopGrid"/);
  assert.match(html, /id="dailyReward"/);
  assert.match(html, /id="purchaseHistory"/);
});
```

- [ ] **Step 2: Run test and verify RED**

Run: `node --test test/store-ui.test.js`

Expected: FAIL because `store.html` does not exist.

- [ ] **Step 3: Implement the shop page and rendering controller**

Render the catalog from data, calculate the daily rotation deterministically from UTC date, preview selected items using CSS variables, require confirmation before purchase, and announce results through `aria-live`. Add direct Shop navigation to desktop and mobile home navigation.

- [ ] **Step 4: Run UI and platform tests**

Run: `node --test test/store-ui.test.js test/platform-smoke.test.js test/design-refresh.test.js`

Expected: PASS with the shop linked from the home page.

- [ ] **Step 5: Commit**

```bash
git add public/store.html public/assets/css/store.css public/assets/js/store.js public/index.html public/assets/css/home-shell.css test/store-ui.test.js
git commit -m "feat: add complete cosmetic shop"
```
