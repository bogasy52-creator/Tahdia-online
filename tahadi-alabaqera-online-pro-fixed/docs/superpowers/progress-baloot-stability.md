# SDD ledger — plan: docs/superpowers/plans/2026-10-30-baloot-stability.md

The uploaded ZIP remains untouched; work is in a separate extracted copy on
fix/baloot-stability. Existing bindings and package/lock versions are preserved.

Pre-flight: tasks share only the Baloot renderer/voice interface; finish() is
added to both the voice facade and player, with updated integration fixtures.

Task 1: complete — reproduced six original layout/audio failures and an extra
played-card resurrection failure before changing production code. Focused tests
41/41 passed; the whole project suite passed 1030/1030 after npm ci installed
the existing locked dependencies. No dependency or release version was changed.

Browser setup: default Playwright browser download produced a truncated archive.
Chromium 138.0.7204.0 from a separate QA-only installation runs successfully.
Wrangler dev hit the container's uv_interface_addresses restriction; local
preview and the Worker harness remain available for testing.


Task 2: complete — nine missing-behavior failures reproduced, then all eleven new
opponent tests and existing strategy/server simulations passed. The full suite
including the UI/cache work passed 1043/1043 before the reconnect regression fix.

Task 3: complete — removed labels/badges across playable surfaces; retained
internal protocol keys, named heroes and «كبوت». Same-release shared menu and
strategy cache regressions failed first, then passed. All original files remain;
package.json, package-lock.json and wrangler.jsonc match the uploaded ZIP bytes.

Browser discovery: peer-initiated board socket closure stalled recovery. Added
close-handshake and obsolete-socket regressions, both observed failing before the
fix. The server now reciprocates close and ignores disconnect callbacks belonging
to replaced sockets. A real browser returned to its exact seat with unchanged
card coordinates. The first browser run also found a two-pixel quiz toolbar
overflow at 360px; a scoped wrapping rule fixed it and the same assertion passed.

Final verification: npm run verify passed 1045/1045 tests, 738 static references
and offline Worker runtime/config checks. Wrangler deploy --dry-run passed with
no deployment. Four independent Chromium contexts completed bidding and twelve
real card clicks through native Workerd/SQLite, then reconnected successfully.
Six other game menus passed mobile rendering/label/overflow checks. Real Web
Audio fixtures passed ordered playback, replay, mute and lifecycle cleanup.

Browser environment: used isolated Miniflare/Workerd and browser in one command
network namespace, with a QA-only os.networkInterfaces shim. Runtime source and
production dependencies were not changed for this environment workaround. Voice
fixtures block Service Worker caching to ensure the test manifest is observed.
No physical-phone or human-speech-quality approval is claimed.

Final review: independent reviewer read the changes and reported no confirmed
introduced defect, but could not finish its final turn due to an unavailable
review resource. Author performed a separate final diff review; independent
approval is not claimed. No declined findings or deferred code changes.
