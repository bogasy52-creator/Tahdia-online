# Remove incomplete character update

> **For agentic workers:** Execute this small rollback directly in the current isolated checkout. Keep the existing game implementation and Baloot improvements.

**Goal:** Remove the incomplete Gcartoon update requested by the user and deliver one compatible sparse patch for release 33.0.0.

**Architecture:** Restore the two existing character/shop tests to the uploaded working baseline. The installed sparse updater overlays files but cannot delete them, so run an explicit, hash-checked cleanup before release verification to delete only the two known new test files from commit 7b177c73. Keep the complete baseline suite and release verification enabled.

**Tech stack:** Node.js 24, existing npm scripts, Python ZIP packaging, existing GitHub sparse updater.

**Constraints:** Preserve version 33.0.0, locked dependencies, current character runtime/artwork/ownership, Worker settings, and all Baloot improvements. Do not import any partial character archive. Repository access is read-only; deliver an uploadable patch.

**Review focus:** Exact remote file hashes; refuse modified files before deleting either file; refuse symbolic links; allow reapplication; test the actual current repository snapshot through the real updater and full release command.

- [x] Record the current repository head and reproduce the character failures using the exact four remote tests.
- [x] Write and run cleanup tests against the real two retired artifacts; observe failure before implementing deletion.
- [x] Implement `removeIncompleteCharacterUpdate(root)` with exact hashes, complete preflight and idempotent deletion. Add its CLI before `preverify:release` and `prepare:release`.
- [x] Restore `test/characters-expansion-v33.test.js` and `test/shop-v31.test.js` from the original working upload in the patch payload.
- [x] Package the existing Baloot patch plus rollback, accepting original and previously delivered file hashes. Apply it with the unmodified repository updater to the exact remote snapshot.
- [x] Run updater tests, the cleanup regression checks, full `npm run verify:release`, Worker build and final checksums. Confirm both retired files are absent and existing character assets are byte-identical.
Delivery: provide the final ZIP with short Arabic upload instructions. Attempt persistent file saving and report any failure accurately.

Outcome: both the working tree and an exact copy of remote main passed all 1045 tests and the complete release verifier. Five cleanup regression checks and six updater tests passed. The Worker dry-run passed. The original 21 character-test failures were reproduced before rollback.
