# Tahdia 26 Implementation Plan

> Execute inline using the executing-plans workflow and retain a progress ledger.

Goal: deliver the requested upgrade as a complete, tested source archive.
Architecture: preserve vanilla JS engines and Cloudflare Durable Objects; change the existing shared presentation and network clients rather than introduce a second app.
Spec: design.md

Global constraints: Arabic RTL; no account/progress reset; no new DO binding or migration; no shooting; no cosmetic competitive advantage; no production success claim without production evidence.

Review focus: half-open sockets, account changes during requests, stale invites, older owned shop items, small-screen control access.

1. Catalog and entitlement: add behavioral tests for retired purchases, new dice and authenticated manager skin. Observe failures, implement in profile-core/account-policy/art renderers, run the focused and existing catalog tests.
2. Network recovery: test six-digit normalization, welcome state, terminal rejection, old-socket disposal and session-switch responses. Implement board/social recovery, matching server heartbeat and invitation deduplication. Run focused tests and actual Worker/WebSocket integration.
3. Interface: rebuild home, shared theme, store presentation and game setup hierarchy; replace accuracy with a compatibility redirect and remove its menu/engine/catalog entries. Check actual navigation, game starts and mobile layouts.
4. Release: unify version references, rebuild styles/offline/checksums, run all regression/static/Worker tests, browser and integration checks. Review the branch, resolve material findings, package the complete source and Arabic verification notes.
