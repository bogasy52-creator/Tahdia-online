# Execution ledger: docs/superpowers/plans/2026-10-12-v12.md

Baseline: V11.2 tests 265 passed, 6 skipped, 0 failures.
Workspace: fresh extracted copy; original ZIP preserved. No external repository is associated with this ZIP.
Authorization: prior explicit full upgrade / execute-now instruction; no additional approval gate is needed.
Preflight: tasks 1–3 share engine and room protocol as specified; no conflicts.
Testing: Browser plugin not available; use installed Playwright if a browser executable can be found.

Task 1: complete — 11 engine behavior tests passed.
Task 2: complete — room lifecycle, authoritative routes, quota and manager regressions passed.
Task 3: complete — store operations and nine native-browser/workerd flows passed at 1366×900, 1100×800, 390×844; screenshots inspected internally.
Final review: independent read-only reviewer identified four Important findings; each reproduced RED and fixed GREEN: boost release throttle, finished-room resume, long-body visibility and reconnect retry intent.
Final: Ruling: solo scores compete with bots — a human is not automatically declared winner — changes training outcome when a bot outscores the human.
Final: Ruling: easy/medium/hard use bounded lookahead and speed presets — transparent configurable training difficulty — tuning may be needed with player feedback.
Final: Ruling: disconnected lobby seats persist until expiry or explicit leave — prioritizes reconnect without unauthorized host takeover — another room is needed if a participant permanently disappears.
No deferred minor findings. Earlier bindings and migrations are unchanged.

Task 4: release checks 290 passed / 6 prior skips / 0 failed; static and Worker checks passed; dry-run passed. Native regression checks passed. Deliverable packaged separately from the input ZIP.
