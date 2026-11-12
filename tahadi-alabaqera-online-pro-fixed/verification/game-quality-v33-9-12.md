# Verification — 33.9.12

## Automated release gate

`npm run verify:release` passed after the table, music and gameplay changes:

- 1,502 tests passed; 0 failed, skipped or cancelled.
- 1,134 local static asset references passed validation.
- Offline Worker runtime and configuration checks passed.
- Release verifier passed: 487 JS modules, 13 inline scripts, 186 CSS asset references.
- 49 offline-core resources total 998,886 bytes; music remains on demand.
- `npm run check:cloudflare` passed as a dry run with the existing GameRoom, BoardRoom, QuickArena and Assets bindings. No production deployment was performed.
- `git diff --check` passed.

## Gameplay evidence

Regression cases cover Jackaroo capture on printed stars, entry captures, own-stone blocking, King path captures, protected starts, Jack swaps, mandatory use of a playable card, whole dead-hand burning, opposing-five gate movement and matching board-picker targets. Complete four- and six-player simulations finished without overlapping live stones on the common track.

Carrom cases cover non-finite coordinates, the easy difficulty, opponent aim validation, deterministic replay from either seat, the precision controls, duplicate-strike prevention, pause and exit during playback. UNO cases cover 20 distinct private seats, a 40-card hand, presentation sorting, color-dialog focus and timeout after drawing. Billiards cases cover finite spin, very large finite input normalization, exact shot replay and match-ending foul totals. Jewels cases cover keyboard swaps, secondary pointers, server-pending action locks and leaving during a cascade.

## Visual and audio checks

The real canvas renderers were rendered with a native Canvas implementation and inspected at 1,200 × 670 and 390 × 714 for billiards, and 900 × 900 for both Carrom materials. The renderers keep the physics coordinates, shop equipment and input transforms. These are renderer checks, not a full-page browser playtest.

All 16 original scores are present. Audio-controller tests verify the new route-specific files, musical loop positions, mute, and a short music dip during table strikes. The pool recording measured −19.53 LUFS integrated and −3.29 dBTP. Decoded pool, Carrom and lobby recordings peaked at −3.29, −5.22 and −2.88 dBFS. Their sample discontinuities at the loop boundary were 0.0021, 0.0022 and 0.0010 respectively, with no silent padding inside the declared loop.

## Update installation

The installed workflow's actual Python patch applier accepted and installed the cumulative 120-file update on both the original 33.9.10 snapshot and the recovered 33.9.11 snapshot. All resulting payload hashes matched the release. A deliberately changed local file was rejected before installation. An extra owner file and the deployed `wrangler.jsonc` remained unchanged.

## Remaining checks

Headless Chromium launch failed because its process-singleton Unix socket was denied (`Operation not permitted`). The shared browser could not connect to the local preview (`ERR_CONNECTION_REFUSED`). No further privilege escalation was used. Full-page browser layout, real audio listening on a phone, and live matches across separate devices remain unverified. Musical taste and perceived visual quality require the user's judgment.

The complete source and cumulative patch include these limitations alongside the passing checks.
