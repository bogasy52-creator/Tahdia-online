# All-Games Bot Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add medium, professional, and adaptive bots to every playable game, with a 12-second human-match fallback wherever real matchmaking exists.

**Architecture:** Put shared deterministic AI policy in one browser-global bot engine. Reuse each game's existing pure rules engine for legal actions, keep human online rooms unchanged, and activate local bot control through validated URL parameters when matchmaking times out.

**Tech Stack:** Vanilla JavaScript, existing game engines, Firebase matchmaking, Cloudflare Worker matchmaking, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-10-bots-shop-progression-design.md`

## Global Constraints

- Bots must be visibly labeled `BOT` and never impersonate real players.
- Difficulty values are exactly `auto`, `medium`, and `pro`.
- Adaptive mode resolves to medium below player level 8 and professional at level 8 or above.
- Bots use legal public game state only and never inspect a human's hidden hand.
- Human matchmaking remains authoritative; a bot match is local and begins only after cancellation of the waiting ticket.
- Existing random dice generation is not biased by difficulty.

---

### Task 1: Shared deterministic bot policy

**Files:**
- Create: `public/assets/js/bot-engine.js`
- Test: `test/bot-engine.test.js`

**Interfaces:**
- Produces: `TAHADI_BOTS.resolveDifficulty(value, level)`.
- Produces: `quizDecision(question, difficulty, rng) -> {correct, delayMs}`.
- Produces: `chooseLudoMove(state, roll, legalMoves, difficulty, rng) -> tokenIndex`.
- Produces: `chooseJackarooAction(state, cardIndex, actions, difficulty, rng) -> action`.
- Produces: `shouldBankDice(state, difficulty, rng) -> boolean`.
- Produces: `arcadeTarget(game, difficulty, context, rng) -> number`.

- [ ] **Step 1: Write failing policy tests**

```js
test('adaptive difficulty follows level boundary', () => {
  assert.equal(bots.resolveDifficulty('auto', 7), 'medium');
  assert.equal(bots.resolveDifficulty('auto', 8), 'pro');
});

test('professional ludo bot prefers a winning move', () => {
  assert.equal(bots.chooseLudoMove(stateWithFinish, 1, [0,1], 'pro', () => .5), 1);
});

test('jackaroo bot chooses only supplied legal actions', () => {
  const actions = [{type:'discard'},{type:'enter',marble:0}];
  assert.ok(actions.includes(bots.chooseJackarooAction(state, 0, actions, 'pro', () => .5)));
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test test/bot-engine.test.js`

Expected: FAIL because `TAHADI_BOTS` is undefined.

- [ ] **Step 3: Implement normalized policies and injected randomness**

Use weighted scoring plus small difficulty-dependent jitter. Clamp quiz accuracy and reaction delay to the approved ranges; do not encode answers outside the current question. Validate empty move lists and return `null` safely.

- [ ] **Step 4: Run focused tests**

Run: `node --test test/bot-engine.test.js`

Expected: PASS with deterministic RNG fixtures.

- [ ] **Step 5: Commit**

```bash
git add public/assets/js/bot-engine.js test/bot-engine.test.js
git commit -m "feat: add shared all-games bot policy"
```

### Task 2: Matchmaking timeout and quiz bot duel

**Files:**
- Modify: `public/assets/js/matchmaking.js`
- Modify: `public/matchmaking.html`
- Modify: `public/online.html`
- Modify: `public/assets/js/quick-match-game.js`
- Test: `test/bot-matchmaking.test.js`
- Test: `test/quick-match-firestore.test.js`

**Interfaces:**
- Consumes: `TAHADI_BOTS.quizDecision` and profile difficulty setting.
- Produces: `TahdiaMatchmaking.join({game, difficulty, fallbackUrl})` and `startBotFallback()`.
- Bot URL: `/online?bot=1&difficulty=<value>`.

- [ ] **Step 1: Write failing fallback tests**

```js
test('matchmaking offers a bot at twelve seconds and cancels the queue first', () => {
  assert.match(source, /BOT_WAIT_MS\s*=\s*12_000/);
  assert.match(source, /await this\.removeWaitingTicket/);
  assert.match(source, /startBotFallback/);
});

test('quick quiz bot is labeled and uses shared bot decisions', () => {
  assert.match(quick, /TAHADI_BOTS\.quizDecision/);
  assert.match(online, /BOT/);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test test/bot-matchmaking.test.js test/quick-match-firestore.test.js`

Expected: FAIL on missing bot fallback behavior.

- [ ] **Step 3: Add the timeout, cleanup, and local quiz match**

Change the overlay to show the chosen difficulty and countdown. At 12 seconds, remove the Firebase waiting document, unsubscribe listeners, stop audio/timers, and redirect. Add a local 10-question controller that schedules the bot answer independently of the human, scores both with the existing rules, and awards progression once at finish.

- [ ] **Step 4: Run focused tests**

Run: `node --test test/bot-matchmaking.test.js test/quick-match-firestore.test.js test/runtime-cleanup.test.js`

Expected: PASS and no leaked timer markers.

- [ ] **Step 5: Commit**

```bash
git add public/assets/js/matchmaking.js public/matchmaking.html public/online.html public/assets/js/quick-match-game.js test/bot-matchmaking.test.js test/quick-match-firestore.test.js
git commit -m "feat: fall back to quiz bot after matchmaking"
```

### Task 3: Arcade difficulty integration

**Files:**
- Modify: `public/assets/js/arcade-games.js`
- Modify: `public/assets/js/new-games.js`
- Modify: `public/assets/js/memory-pro.js`
- Modify: `public/assets/js/progression.js`
- Test: `test/arcade-bot-difficulty.test.js`

**Interfaces:**
- Consumes: `TAHADI_BOTS.arcadeTarget` and `TAHADI_PROGRESS.botDifficulty()`.
- Produces: visible difficulty selector shared by all arcade pages and persisted choice.

- [ ] **Step 1: Write failing arcade bot tests**

```js
test('arcade runtimes use the shared difficulty and never a fixed AI target', async () => {
  assert.match(arcade, /TAHADI_BOTS\.arcadeTarget/);
  assert.match(newGames, /TAHADI_PROGRESS\?\.botDifficulty/);
  assert.doesNotMatch(arcade, /aiScore\s*=\s*\d{3}/);
});
```

- [ ] **Step 2: Run test and verify RED**

Run: `node --test test/arcade-bot-difficulty.test.js`

Expected: FAIL because current runtimes synthesize AI scores internally.

- [ ] **Step 3: Route AI scoring through the shared policy**

Mount a compact Auto/Medium/Professional control before start, resolve adaptive mode from current player level, label the opponent with resolved difficulty, and keep all current award formulas unchanged.

- [ ] **Step 4: Run arcade regression tests**

Run: `node --test test/arcade-bot-difficulty.test.js test/arcade-v5.test.js test/runtime-cleanup.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/assets/js/arcade-games.js public/assets/js/new-games.js public/assets/js/memory-pro.js public/assets/js/progression.js test/arcade-bot-difficulty.test.js
git commit -m "feat: add adaptive arcade bot difficulty"
```

### Task 4: Board and dice bots

**Files:**
- Modify: `public/snakes.html`
- Modify: `public/zahra.html`
- Modify: `public/jackaroo.html`
- Modify: `public/dice.html`
- Test: `test/board-bots.test.js`
- Test: `test/snakes-solo-reference.test.js`

**Interfaces:**
- Consumes: existing `getLegalLudoMoves`, `getJackarooActions`, rules-engine mutations, and Task 1 bot policies.
- Produces: `?bot=1&difficulty=auto|medium|pro` startup for all four pages.

- [ ] **Step 1: Write failing page integration tests**

```js
test('every board page supports explicit bot startup', async () => {
  for (const page of ['snakes','zahra','jackaroo','dice']) {
    const html = await readFile(join(pub, `${page}.html`), 'utf8');
    assert.match(html, /TAHADI_BOTS/);
    assert.match(html, /difficulty/);
    assert.match(html, /BOT/);
  }
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test test/board-bots.test.js test/snakes-solo-reference.test.js`

Expected: FAIL for Zahra, Jackaroo, and Dice bot integration.

- [ ] **Step 3: Add legal local bot turns**

Snakes reuses the existing solo loop and only changes pacing by difficulty. Zahra auto-rolls and selects a legal token. Jackaroo creates `[human, BOT, BOT, BOT]`, runs each bot's own hand through `getJackarooActions`, and skips the privacy overlay for bots. Dice auto-rolls and banks using policy thresholds. Guard every loop with a match epoch so restart cancels stale turns.

- [ ] **Step 4: Add bot launch controls and URL startup**

Add one prominent “ضد البوت” action and a difficulty selector to each setup. Validate URL values and start only once after DOM initialization.

- [ ] **Step 5: Run board engine and integration tests**

Run: `node --test test/board-bots.test.js test/snakes-solo-reference.test.js test/ludo-engine.test.js test/jackaroo-engine.test.js test/dice-engine.test.js test/runtime-cleanup.test.js`

Expected: PASS with no illegal-action exceptions.

- [ ] **Step 6: Commit**

```bash
git add public/snakes.html public/zahra.html public/jackaroo.html public/dice.html test/board-bots.test.js test/snakes-solo-reference.test.js
git commit -m "feat: add legal bots to board games"
```
