# Baloot and opponent stability — 33.0.0

Update the supplied project in place. Keep package/lockfile versions, Worker release,
deployment bindings, databases, game rules, accounts and purchases compatible.

The selected approach is a focused repair of the existing renderer and strategies.
A renderer rewrite or new speech provider would add unnecessary migration and
dependency risk. No deployment is requested.

1. Keep each remaining Baloot card in its original slot for the current deal.
   Reflow only when a new deal arrives or the viewport changes. Repeated snapshots,
   project selection and removing a card must preserve the remaining card nodes.
2. Finish an active complete voice call when a hand ends. Discard queued old calls;
   explicit mute, leaving the table and a new session still stop immediately.
   A scored server snapshot must not silence the animations that precede scoring.
3. Generate a bounded private Baloot style per automated seat at match start,
   keeping it stable during that match and varying it for later matches. Never
   inspect hidden hands. Existing easy/medium/hard levels remain valid.
4. Correct Jackaroo strategy for all four/six seats, board geometry and public
   pieces. Avoid consuming cards or shuffling while evaluating candidate moves.
5. Replace automated-opponent labels in playable menus, player rows and canvas
   names with neutral player names/copy, without altering internal protocol keys
   or the valid Baloot word «كبوت». Keep one clear description of computer-filled
   seats in game help; never describe those seats as connected human users.
6. Rebuild generated styles/offline metadata/checksums without a version bump.

Natural Gulf speech remains dependent on real approved recordings. Preserve the
existing honest pending state and recording-import workflow; do not silently
reactivate previously rejected synthetic speech or mislabel it as human.

Validation: DOM regression tests, seeded engine/server simulations, all existing
tests, offline/static/Worker verification, Chromium at desktop/mobile widths and
real Web Audio timing fixtures. A browser fixture does not prove speech quality
or constitute a physical-phone test.
