# Zoom challenge renders (32.0.0)

Twenty everyday objects for the zoom quiz category, modelled as signed distance
fields and ray marched in a WebGL fragment shader (`objects-shader.js`) with a
perspective camera over a seamless studio sweep. Glass (the bulb, the hourglass)
is traced in two passes: its surface, then what lies behind it.

1. `python3 make-jobs.py` — writes `jobs-zoom.json` (20 objects at 1350 × 900).
2. `node studio.cjs jobs-zoom.json out` — renders them in headless Chromium.
3. `python3 pack.py out ../../public/assets/quiz_render_v32` — 1200 × 800 WebP.

The questions live in `src/questions.js` (category `zoom`, ids `zoom-3d-*`, with
`rendered: true`); `npm run sync:quiz` copies them to the browser bank.
