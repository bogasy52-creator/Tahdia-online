# Tables and music implementation plan

Goal: respond to the user's request for materially better billiards/Carrom tables and music suited to the games and interface, within the ongoing authorized improvements.

Design: preserve exact physics and pointer geometry. Give billiards a tournament cloth, layered rail construction, leather pocket liners, pearl sights and polished resin balls. Give Carrom pale fine-grain maple, mitered dark timber, recessed pockets and less plastic-looking wooden discs. Keep equipped shop objects working. Refine the existing canvas renderers instead of replacing them with a background illustration whose pockets may not align.

Music: compose original instrumental loops for all existing music routes using a coherent lounge palette, with distinct arrangements for pool, Carrom, the lobby, focused games and faster games. Render sampled instruments through FluidSynth, normalize with headroom, and keep music on-demand. Preserve existing mute/volume settings and use a short, reversible music dip during strikes.

Validation: render the real canvas code to PNG at desktop and phone sizes for visual review; use the existing browser limitation disclosure for full-page browser checks. Measure audio duration, loop boundaries, loudness and clipping. Test route-to-track loading and strike ducking in the real sound controller. Re-run the complete release checks after changes. Deliver both the cumulative patch and complete project, tested against 33.9.10 and 33.9.11 snapshots.

- [x] Inspect and render current tables.
- [x] Refine table materials, pockets, discs and ball lighting; render and inspect.
- [x] Compose and master new music; integrate routes and short strike ducking.
- [x] Verify gameplay geometry, audio controls, release/cache and update installation.
- [ ] Save the reviewed update and complete project.
