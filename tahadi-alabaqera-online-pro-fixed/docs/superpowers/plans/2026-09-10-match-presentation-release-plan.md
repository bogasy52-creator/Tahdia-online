# Match Presentation and Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply equipped cosmetics across the platform, add professional match entry and victory experiences, then verify and package release V5.1.

**Architecture:** A shared presentation controller reads equipped items from `TAHADI_PROGRESS`, applies safe body data attributes, and owns short-lived entrance/victory overlays. Existing pages opt in with two shared assets; progression award events provide result data without coupling the controller to individual game internals.

**Tech Stack:** Vanilla HTML/CSS/JavaScript, Web Animations API, existing Audio Manager, PWA Service Worker, Node tests, browser playtest.

**Spec:** `docs/superpowers/specs/2026-09-10-bots-shop-progression-design.md`

## Global Constraints

- Entrance is skippable and reduced under `prefers-reduced-motion`.
- Victory effects never block action buttons and are cleaned up on replay/page exit.
- Equipped table, avatar, frame, entrance, victory, and sound pack persist across pages.
- All assets remain local and PWA-cacheable.
- Release cannot be called complete without full tests, static verification, Worker dry-run, and mobile/desktop browser checks.

---

### Task 1: Shared cosmetic and match-presentation controller

**Files:**
- Create: `public/assets/js/match-presentation.js`
- Create: `public/assets/css/match-presentation.css`
- Modify: `public/assets/js/progression.js`
- Test: `test/match-presentation.test.js`

**Interfaces:**
- Consumes: `TAHADI_PROGRESS.read().equipped`, catalog item metadata, and `tahadi-award` events.
- Produces: `TAHADI_PRESENTATION.apply()`, `showEntrance({game,player,opponent,onComplete})`, `showVictory({winner,score,rewards,onReplay})`, and `clear()`.

- [ ] **Step 1: Write failing presentation tests**

```js
test('presentation controller exposes cleanup-safe entry and victory APIs', async () => {
  assert.match(source, /showEntrance/);
  assert.match(source, /showVictory/);
  assert.match(source, /prefers-reduced-motion/);
  assert.match(source, /pagehide/);
});
```

- [ ] **Step 2: Run test and verify RED**

Run: `node --test test/match-presentation.test.js`

Expected: FAIL because the shared assets do not exist.

- [ ] **Step 3: Implement overlays and safe cosmetic attributes**

Use fixed catalog IDs converted to `data-avatar`, `data-frame`, and `data-table`. Build the VS overlay with player/opponent cards, 3–2–1 countdown, and skip button. Build the result overlay with reward chips, equipped victory class, replay/home/store actions, and pointer-safe decorative particles.

- [ ] **Step 4: Dispatch a normalized award event**

After `TAHADI_PROGRESS.award`, dispatch `{game, win, score, deltaXp, deltaCoins, unlocked}` exactly once. Ensure existing `tahadi-progress` listeners continue working.

- [ ] **Step 5: Run focused tests**

Run: `node --test test/match-presentation.test.js test/player-economy.test.js test/audio-manager.test.js`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add public/assets/js/match-presentation.js public/assets/css/match-presentation.css public/assets/js/progression.js test/match-presentation.test.js
git commit -m "feat: add shared match presentation"
```

### Task 2: Platform-wide integration and sound packs

**Files:**
- Modify: `public/index.html`
- Modify: `public/local.html`
- Modify: `public/online.html`
- Modify: `public/memory.html`
- Modify: `public/reaction.html`
- Modify: `public/logic.html`
- Modify: `public/puzzle.html`
- Modify: `public/accuracy.html`
- Modify: `public/letters.html`
- Modify: `public/draw.html`
- Modify: `public/secret.html`
- Modify: `public/order.html`
- Modify: `public/auction.html`
- Modify: `public/cipher.html`
- Modify: `public/spotdiff.html`
- Modify: `public/snakes.html`
- Modify: `public/zahra.html`
- Modify: `public/jackaroo.html`
- Modify: `public/dice.html`
- Modify: `public/assets/js/audio-manager.js`
- Modify: `public/assets/css/platform.css`
- Test: `test/all-games-presentation.test.js`
- Test: `test/audio-manager.test.js`

**Interfaces:**
- Consumes: Task 1 shared CSS/JS and equipped sound pack.
- Produces: consistent entry, table styling, avatars, and victory feedback across all playable routes.

- [ ] **Step 1: Write failing all-page asset tests**

```js
test('every playable page loads progression and presentation in order', async () => {
  const playablePages = ['local.html','online.html','memory.html','reaction.html','logic.html','puzzle.html','accuracy.html','letters.html','draw.html','secret.html','order.html','auction.html','cipher.html','spotdiff.html','snakes.html','zahra.html','jackaroo.html','dice.html'];
  for (const page of playablePages) {
    const html = await readFile(join(pub,page),'utf8');
    assert.ok(html.indexOf('progression.js') < html.indexOf('match-presentation.js'));
    assert.match(html, /match-presentation\.css/);
  }
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test test/all-games-presentation.test.js test/audio-manager.test.js`

Expected: FAIL because pages do not yet load the shared presentation.

- [ ] **Step 3: Integrate assets and game hooks**

Load catalog, progression, bot engine, and presentation in dependency order. Call `showEntrance` before the first playable action. For board wins that do not call progression yet, call `award` once using game-specific score summaries. Keep existing winner overlays as semantic fallback but hide duplicate visual effects when shared victory is active.

- [ ] **Step 4: Map sound packs through Audio Manager**

Map pack IDs to existing local cues and safe volume/pitch variants. Preserve independent timer/effects toggles and fall back to classic for unknown IDs.

- [ ] **Step 5: Run page and audio tests**

Run: `node --test test/all-games-presentation.test.js test/audio-manager.test.js test/platform-smoke.test.js test/mobile-board-ui.test.js`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add public test/all-games-presentation.test.js test/audio-manager.test.js
git commit -m "feat: apply cosmetics and presentation across games"
```

### Task 3: PWA release, documentation, and full verification

**Files:**
- Modify: `public/service-worker.js`
- Modify: `public/manifest.webmanifest`
- Modify: `package.json`
- Modify: `README-AR.md`
- Create: `CHANGELOG-5.1-BOTS-SHOP-AR.md`
- Modify: `SHA256SUMS.txt`
- Test: `test/release-5.1.test.js`

**Interfaces:**
- Consumes: all new static assets and routes.
- Produces: cache version `busraj-games-v22-bots-shop`, platform version `5.1.0`, and a reproducible release ZIP.

- [ ] **Step 1: Write failing release tests**

```js
test('V5.1 PWA caches every bot, store, and presentation asset', async () => {
  assert.match(sw, /busraj-games-v22-bots-shop/);
  for (const asset of ['/store','/assets/js/store-catalog.js','/assets/js/bot-engine.js','/assets/js/match-presentation.js','/assets/css/store.css']) assert.match(sw, new RegExp(asset.replaceAll('/','\\/')));
});
```

- [ ] **Step 2: Run test and verify RED**

Run: `node --test test/release-5.1.test.js`

Expected: FAIL on old version/cache metadata.

- [ ] **Step 3: Update PWA metadata, docs, and checksums**

Add all new assets to `APP_SHELL`, bump cache/version strings consistently, document bot fallback, store, sync, and owner behavior without exposing authentication internals, then run `node scripts/sync-quiz-data.mjs` and `node scripts/refresh-checksums.mjs`.

- [ ] **Step 4: Run full verification**

Run: `node --test test/*.test.js`

Run: `node scripts/verify-static.mjs`

Run: `node scripts/verify-worker-offline.mjs`

Run: `npx wrangler deploy --dry-run`

Expected: all commands exit 0 with no failures.

- [ ] **Step 5: Browser playtest**

Start `node scripts/dev-preview.mjs`, then verify at 390×844 and 1440×1000: open store, claim daily reward, buy/equip an item, launch a bot match, observe entrance, complete/force a result through normal UI, observe victory, replay, refresh, and confirm state persists. Record console errors; expected count is zero.

- [ ] **Step 6: Package and inspect ZIP**

Create `Tahdia-V5.1-BOTS-SHOP-PRO.zip` excluding `.git` and temporary files. List the archive and verify that `package.json`, `src/index.js`, `public/store.html`, bot assets, presentation assets, and tests are present.

- [ ] **Step 7: Commit**

```bash
git add public/service-worker.js public/manifest.webmanifest package.json README-AR.md CHANGELOG-5.1-BOTS-SHOP-AR.md SHA256SUMS.txt test/release-5.1.test.js
git commit -m "release: prepare V5.1 bots and shop"
```
