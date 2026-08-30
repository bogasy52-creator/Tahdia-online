# Premium Board Games + Online Rooms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Upgrade Snakes & Ladders and Jackaroo to premium mobile-first local experiences and add secure server-authoritative online rooms without changing the existing quiz room system or worker URL.

**Architecture:** Keep the current no-framework HTML/CSS/JS stack. Add a separate `BoardGameRoom` Durable Object backed by pure, Node-testable room/game modules; expose `/api/games/rooms` routes; and use shared browser modules for reconnecting WebSocket rooms. Rebuild each board UI around the existing deterministic engines, with server-side randomness and hand privacy online.

**Tech Stack:** Cloudflare Worker + Durable Objects, WebSocket, vanilla ES modules, SVG/CSS animation, Node `node:test`.

**Spec:** `Busraj_Premium_Board_Games_Online_Design.md` (source specification supplied with this project handoff)

## Global Constraints

- Keep worker name `tahdia-online` and existing `/local` and `/online` quiz routes.
- No new frontend framework.
- Mobile-first; no sidebar that compresses the board on portrait phones.
- Online randomness is server-authoritative.
- Jackaroo private hands are filtered in server payloads.
- Support reconnect tokens and short disconnects without cancelling matches.
- Use SVG/vector treatment for snakes/ladders and premium CSS marbles/cards.
- Service Worker cache version must change when new board assets ship.

---

### Task 1: Pure board-game server core

**Files:**
- Create: `src/games/snakes-server.js`
- Create: `src/games/jackaroo-server.js`
- Create: `src/rooms/board-game-core.js`
- Test: `test/board-game-core.test.js`

**Interfaces:**
- Produces `createBoardRoom`, `addBoardPlayer`, `startBoardMatch`, `applyBoardCommand`, `boardPublicState`, `resetBoardMatch`.
- Reuses the existing client-side deterministic engines as shared pure logic.

- [x] Write failing tests for Snakes capacity/start rules, server roll range/turn validation, Jackaroo exactly-four start, illegal-turn rejection, private hand filtering, and rematch reset.
- [x] Run `node --test test/board-game-core.test.js` and confirm the imports/functions are missing.
- [x] Implement minimal pure modules and cryptographic/random-source injection.
- [x] Re-run focused tests, then `npm test`.

### Task 2: BoardGameRoom Durable Object and API routing

**Files:**
- Modify: `src/index.js`
- Modify: `wrangler.jsonc`
- Test: `test/platform-smoke.test.js`

**Interfaces:**
- `POST /api/games/rooms` -> `{ok, code, gameType, token, hostKey}`.
- `GET /api/games/rooms/:code/status` -> public room summary.
- `GET /api/games/rooms/:code/ws` -> Durable Object WebSocket upgrade.

- [x] Add failing static/config tests for `BOARD_ROOMS`, new routes, `BoardGameRoom`, and the new migration.
- [x] Run focused smoke tests and confirm failures.
- [x] Implement routing plus `BoardGameRoom` wrapper using the pure core, including message size/rate checks, ready/start/roll/play/rematch/ping, reconnect, broadcast, and expiry.
- [x] Run syntax checks and full tests.

### Task 3: Shared online browser client

**Files:**
- Create: `public/assets/js/online/room-client.js`
- Create: `public/assets/js/online/room-lobby.js`
- Test: `test/platform-smoke.test.js`

**Interfaces:**
- `BoardRoomClient.createRoom(gameType, name)`.
- `BoardRoomClient.connect({code,name,token,hostKey})` with automatic reconnect.
- Lobby helpers for 6-digit code normalization/copying and local identity persistence.

- [x] Add failing asset/import/service-worker tests.
- [x] Implement the shared client with EventTarget events, local token persistence, reconnect backoff, and safe send/close APIs.
- [x] Re-run smoke tests.

### Task 4: Premium Snakes & Ladders local + online UI

**Files:**
- Create: `public/assets/css/board-premium.css`
- Create: `public/assets/css/snakes-premium.css`
- Create: `public/assets/js/games/snakes-ui.js`
- Replace: `public/snakes.html`
- Test: `test/platform-smoke.test.js`

**Interfaces:**
- Local mode uses `crypto.getRandomValues` and existing engine.
- Online mode only sends `roll`; renders server state.

- [x] Add failing static assertions for launch menu, online controls, premium assets, and absence of snake/ladder emoji markers in the board implementation.
- [x] Implement premium wood board, SVG snake/ladder overlay, marble tokens, dice dock, step animation, jump animation, local/online lobby, reconnect status, winner/rematch states, responsive portrait layout.
- [x] Run tests and static verification.

### Task 5: Premium Jackaroo local + online UI

**Files:**
- Create: `public/assets/css/jackaroo-premium.css`
- Create: `public/assets/js/games/jackaroo-ui.js`
- Replace: `public/jackaroo.html`
- Test: `test/platform-smoke.test.js`

**Interfaces:**
- Local mode keeps pass-the-device privacy screen.
- Online mode uses only the viewer hand from server state and sends validated `play_card` actions.

- [x] Add failing static assertions for premium assets, online controls, and no long text action-list UI.
- [x] Implement marble board, carved holes, fan hand, card selection with legal marble/target highlighting on board, server-private online hand, team rails, capture/swap/home effects, lobby/reconnect/rematch.
- [x] Run tests and static verification.

### Task 6: Audio, motion, accessibility, cache

**Files:**
- Modify: `public/assets/js/audio-manager.js`
- Modify: `public/service-worker.js`
- Modify: `test/audio-manager.test.js`
- Modify: `test/platform-smoke.test.js`

**Interfaces:**
- Adds board-event sound names using existing samples/tones without broken asset URLs.
- Keeps mute/effects/haptics controls and `prefers-reduced-motion` behavior.

- [x] Add failing tests for board sound names and cache version/assets.
- [x] Implement aliases/tones and update cache shell/version.
- [x] Run full tests and static verification.

### Task 7: Release verification and handoff archive

**Files:**
- Update: `RELEASE-CHECKS-AR.txt` if needed.
- Create: final ZIP in `/mnt/data`.

- [x] Run `node --check` on all new JS modules and `src/index.js`.
- [x] Run `npm test`.
- [x] Run `node scripts/verify-static.mjs`.
- [x] Run `npm run check` if Wrangler is installed; otherwise record environment blocker without claiming deploy verification.
- [x] Package the complete updated project without `node_modules`.
