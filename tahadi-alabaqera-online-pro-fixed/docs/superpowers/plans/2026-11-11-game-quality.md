# Game quality Implementation Plan

**Goal:** Correct Jackaroo and make the new games usable and polished on mobile and desktop.

**Architecture:** Preserve shared room integration and deterministic engines. Independent game repairs can run concurrently, with root owning release integration.

**Tech Stack:** Existing JavaScript modules, CSS, Node test runner, Playwright.

**Spec:** docs/superpowers/specs/2026-11-11-game-quality-design.md

## Global constraints

Preserve account data, cosmetics, Worker bindings, migrations, current board geometry and game routes. Arabic copy. No new runtime dependencies. Release 33.9.12. New CSS files are integrated into style-bundles.json by root. Agents do not change release/package/cache/generated bundles.

## Review focus

Jackaroo must never overlap two live stones at a track cell; no discarding when another card can move. UNO must fit hands and opponents up to advertised counts. Carrom must not accept a shot twice or move while paused. Billiards feedback must reflect the actual resolved shot. Reconnecting players must retain the authoritative room state.

## Tasks

- [x] Jackaroo: add failing rule fixtures; repair protection, own-stone blocking, capture/King, mandatory moves, opponent-five home entry; update picker only where necessary; simulate full games and enforce occupancy invariants.
- [x] Carrom: fix easy difficulty normalization and other reproduced input defects; add precise accessible aiming/power controls, guidance and visual refinement; test engine and browser local modes.
- [x] UNO: fix timeout after a drawn card; support 20 distinct seats and large hands; improve hand organization and keyboard/color dialog controls; test engine and browser practice.
- [x] Billiards: inspect numeric shot validation and other demonstrated defects; improve current-shot context/feedback and game presentation; test replay and local play.
- [x] Integration: add consistent compact visual treatment, integrate styles, update rules copy and cache/release, repair relevant pre-existing release check failures, run verify and browser tests, independent review, package cumulative sparse update supporting raw 33.9.10 and patched 33.9.11 with hash guards.

Each engine fix follows a real failing behavior test, repair, and targeted green run. The final suite and visual checks validate integration.

Verification completed in 33.9.12 with 1,502 passing tests, static/Worker/release checks, exact Canvas renderer exports and two-base patch installation. Full-page browser checks remain blocked; see verification/game-quality-v33-9-12.md.
