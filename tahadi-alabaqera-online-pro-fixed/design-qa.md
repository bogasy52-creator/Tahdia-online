# V8 design QA

Source: uploaded 709×1536 neon creature reference. Actual implementation: /snakes at CSS viewport 390×844, captured in the Cloud Browser. Source and rendered screenshot normalized to 390×844 and inspected side by side in qa/neon-comparison.jpg (internal evidence outside release).

Frame, board position, 10×10 grid, cyan/purple player panels, lower die area, turn strip, and Arabic roll button follow the reference composition. Live numbers and scores are DOM content; animated snakes and ladders are separate raster canvas objects; crystal pawns are live sprites. The die is a true six-face CSS cube.

Resolved: die/button overlap; canvas clear during skipped frames; timer hanging when drawing is throttled; oversized Jackaroo pieces caused by intrinsic canvas sizing in grid slots. Corrected crystal hues match the Jackaroo table corners. Browser views confirmed the Jackaroo table and Zahra crystal pieces at mobile width.

Accepted differences: generated creature art and empty frame are inspired by the reference, not pixel-identical. Snake and ladder endpoints match real engine routes, so individual poses differ. Reference scores 33/7 versus captured initial 0/0 reflect different match state. Animations and supplementary pause/fullscreen controls are live additions.

Interaction evidence: snake roll and inspection; resumed pending roll 86→87→24 completes tracking, attacking, swallowing, digesting, releasing, idle; roll re-enabled. Jackaroo card selection, legal no-move discard and next-player privacy screen; Zahra die roll and next turn. New renderer and path unit tests also pass. Historical extension errors are unrelated to application rendering; no new application failure observed after fixes.

Result: passed for reference-inspired layout and tested local interactions. Pixel-perfect art replication, all phone sizes and a deployed online match are not claimed.
