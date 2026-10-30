# Baloot stability implementation plan

> Execute inline under superpowers:executing-plans, with a final fresh review.

**Goal:** Stable Baloot cards, complete voice playback, varied fair opponents and
correct six-seat Jackaroo decisions in the supplied 33.0.0 project.

**Architecture:** Retain the shared client renderer and authoritative room engines.
Store card slots in the renderer and opponent styles privately in room state.

**Tech stack:** Browser JavaScript, Node test runner, Cloudflare Worker, Playwright.

**Spec:** ../specs/2026-10-30-baloot-stability-design.md

## Global constraints

- Version remains 33.0.0; package dependencies and hosting configuration unchanged.
- No invented human recordings, hidden-hand access, or protocol key renaming.
- Deliver a complete updated ZIP in the same directory structure.

## Review focus

- Reconnect/repeated state and removing first/middle/last cards preserve slots.
- Scored snapshots do not cut earlier audible calls; mute/leave still cancel.
- Existing serialized rooms without profiles continue to work.
- Six-seat moves assess allies/opponents in seats 4/5 and the 78-cell track.
- Menus remove automated-player badges without changing «كبوت» or quiz content.

### Task 1: Card layout and completed voice calls

Files: public/assets/js/baloot-table.js, baloot-voice-player.js, baloot-voice.js;
tests: test/baloot-stability.test.js, test/baloot-voice-player.test.js.

- [x] Add failing DOM tests for stable slots/nodes and scoring/audio ordering.
- [x] Add failing player tests for finishing current playback and discarding queues.
- [x] Preserve a deal's slot order; remove gap-closing animation.
- [x] Finish active playback at hand completion; defer cleanup to display ordering.
- [x] Run focused tests and the complete suite; commit.

### Task 2: Fair opponent variation and six-seat decisions

Files: public/assets/js/engines/baloot-bot.js, bot-strategy.js;
src/games/baloot-server.js; test/opponent-stability.test.js.

- [x] Add failing tests for private persistent match styles and six-seat choices.
- [x] Add createBalootProfile(level,rng), consumed by chooseBalootAction's optional
      profile; old rooms fall back to their original difficulty.
- [x] Evaluate Jackaroo with previewJackarooAction and boardGeometry; score every
      player's pieces without reading opponent hands or running a new deal.
- [x] Run seeded complete rounds, bot/rule tests and the complete suite; commit.

### Task 3: Player-facing copy, cache and release verification

Files: playable HTML, shared menus/player rows, server fallback display names,
scripts/build-offline.mjs and generated assets; test/player-copy-stability.test.js.

- [x] Add a regression check for player-facing automated-opponent labels/badges.
- [x] Update names/copy and remove the badges while preserving protocol metadata.
- [x] Build styles/offline metadata/checksums; verify same-release cache changes.
- [x] Run all tests, static/Worker checks, real Chromium interactions at mobile and
      desktop widths, and voice browser fixtures. Record actual limits.
- [x] Review the final diff, package the complete tree, compare release/configs
      to the source ZIP and save the deliverable.
