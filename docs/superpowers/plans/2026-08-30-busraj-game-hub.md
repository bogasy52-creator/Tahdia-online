# Busraj Game Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the existing Cloudflare PWA into a professional Arabic game hub with a unified audio system and four complete local multiplayer games while preserving the existing quiz modes.

**Architecture:** Preserve the Cloudflare Worker and Durable Object backend. Add static reusable UI/audio modules and deterministic JavaScript game engines under `public/assets`, then wire separate responsive HTML pages to those engines. Unit-test pure game rules with Node's built-in test runner and verify static/PWA integrity plus Worker dry-run when dependencies are available.

**Tech Stack:** Cloudflare Workers, Durable Objects, static HTML/CSS/JavaScript, Web Audio API, PWA service worker, Node `node:test`.

**Spec:** `docs/superpowers/specs/2026-08-30-busraj-game-hub-design.md`

## Global Constraints
- Preserve the current online quiz WebSocket protocol and server-authoritative scoring.
- RTL Arabic UI and mobile-first responsive behavior are mandatory.
- Do not require new runtime packages or external CDNs.
- Audio must obey browser autoplay restrictions and persist user settings locally.
- Each game engine must be deterministic and separately testable.

---

### Task 1: Shared platform shell and audio
**Files:** Create `public/assets/css/platform.css`, `public/assets/js/audio-manager.js`, `public/assets/js/platform.js`; modify `public/index.html`, `public/manifest.webmanifest`.
**Interfaces:** `window.BS_AUDIO` provides `play`, `timerTick`, `timerEnd`, `setMuted`, `toggleMuted`, `vibrate`, and settings persistence.
- [ ] Add failing smoke tests for required shared asset paths and hub links.
- [ ] Implement shared tokens, header controls, settings panel, install flow, and audio manager.
- [ ] Redesign the home screen as a five-game launcher.
- [ ] Run smoke tests and HTML/JS syntax checks.

### Task 2: Quiz audio integration
**Files:** Modify `public/local.html`, `public/online.html`.
**Interfaces:** Consume `window.BS_AUDIO` from Task 1 without changing Worker protocol.
- [ ] Add failing checks that both quiz pages load the audio manager.
- [ ] Add full timer tick/final countdown, reveal, answer, buzzer and winner cues.
- [ ] Keep existing WAV question media behavior independent from app SFX mute.
- [ ] Run static checks.

### Task 3: Snakes & Ladders
**Files:** Create `public/assets/js/engines/snakes-engine.js`, `public/snakes.html`, tests.
**Interfaces:** `createSnakesGame`, `rollSnakesTurn`, `moveSnakesPlayer`, `resetSnakesGame`.
- [ ] Write failing engine tests for ladders, snakes, six extra-turn and exact finish.
- [ ] Implement minimal engine until tests pass.
- [ ] Build responsive 100-cell board and animated pass-and-play controller.
- [ ] Run engine and browser/static checks.

### Task 4: Dice Challenge
**Files:** Create `public/assets/js/engines/dice-engine.js`, `public/dice.html`, tests.
**Interfaces:** Highest-roll and race-to-50 pure state transition functions.
- [ ] Write failing tests for round scoring, ties, bust-on-one and banking.
- [ ] Implement engine and pass tests.
- [ ] Build polished dice animation, mode selection, score rail and win flow.
- [ ] Run checks.

### Task 5: Zahra / Ludo
**Files:** Create `public/assets/js/engines/ludo-engine.js`, `public/zahra.html`, tests.
**Interfaces:** `createLudoGame`, `getLegalLudoMoves`, `applyLudoMove`, `advanceLudoTurn`.
- [ ] Write failing tests for six-to-enter, capture, safe cells, home lane and win.
- [ ] Implement engine until tests pass.
- [ ] Build cross-board UI, piece selection, move animation and player state rail.
- [ ] Run checks.

### Task 6: Jackaroo
**Files:** Create `public/assets/js/engines/jackaroo-engine.js`, `public/jackaroo.html`, tests.
**Interfaces:** deck helpers, legal-action resolver, card play state transitions, team win evaluation.
- [ ] Write failing tests for entry, backward four, Ace 1/11, Jack swap, split seven and team win.
- [ ] Implement deterministic engine until tests pass.
- [ ] Build circular track, hands, staged actions for 5/7/J, team scores, dealer cycle and victory state.
- [ ] Run checks.

### Task 7: PWA and release verification
**Files:** Modify `public/service-worker.js`, `package.json`, `README-AR.md`.
- [ ] Add all new pages/assets to PWA cache with a new cache version.
- [ ] Add `npm test` and static verification scripts.
- [ ] Run all tests, JS syntax checks, link/file existence checks and `wrangler deploy --dry-run` if dependency installation is available.
- [ ] Package the verified project as a deployment ZIP and include a short deployment note.
