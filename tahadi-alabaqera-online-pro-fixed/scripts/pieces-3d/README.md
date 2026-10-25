# 3D stones (31.1.0)

The stones in `public/assets/pieces-3d/` are studio renders of signed-distance
models, ray marched in a WebGL fragment shader (`pieces-shader.js`).

1. `python3 make-jobs.py` — writes `jobs-all.json` (14 stones × 6 colours, 5 marbles × 6 colours).
2. `node studio.cjs jobs-all.json out` — renders each job at double size in headless Chromium.
3. `python3 pack.py out ../../public/assets/pieces-3d` — downsamples to the large (`l`) and small (`s/`) WebP sprites.

`public/assets/js/pieces-v31.js` maps every shop stone and player colour to its sprite.
The die is not a sprite: `public/assets/js/dice-3d-v31-1.js` renders it live on the GPU.
