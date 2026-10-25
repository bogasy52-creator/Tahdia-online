# Hero characters (32.0.0)

The characters in `public/assets/heroes/` are studio renders of signed-distance
models (helmets and masks on a bust and a plinth), ray marched in a WebGL
fragment shader (`heroes-shader.js`) with the same lights as the 3D stones.

1. `python3 make-jobs.py` — writes `jobs-heroes.json` (12 heroes).
2. `node studio.cjs jobs-heroes.json out` — renders each hero at double size in headless Chromium.
3. `python3 pack.py out ../../public/assets/heroes` — the bust (300 × 408) and the avatar face (`face/`, 160 × 160).

`public/assets/js/profile-core.js` lists the heroes (`HEROES`, `heroArt`, `heroFace`);
the short ids (`fox`, `cat`, … `samurai`) are the values rooms exchange, so older
purchases keep working under the new art.
