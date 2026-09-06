// Shared "spot the differences" data — real photos from the project's own
// photo library (public/assets/quiz_photos), never generated art.
// Only pure, DOM-free helpers live here so this same file can be imported
// by the Cloudflare Worker (server, no canvas) and by the browser (client,
// which does the actual canvas drawing/pixel work in spotdiff.html).

export const PHOTO_BANK = [
  "assets/quiz_photos/astronaut.webp",
  "assets/quiz_photos/astronaut_glove.webp",
  "assets/quiz_photos/astronaut_helmet.webp",
  "assets/quiz_photos/astronaut_suit.webp",
  "assets/quiz_photos/brick.webp",
  "assets/quiz_photos/brick_close.webp",
  "assets/quiz_photos/camera.webp",
  "assets/quiz_photos/camera_lens.webp",
  "assets/quiz_photos/camera_tripod.webp",
  "assets/quiz_photos/cat.webp",
  "assets/quiz_photos/cat_ear.webp",
  "assets/quiz_photos/cat_eye.webp",
  "assets/quiz_photos/cat_nose.webp",
  "assets/quiz_photos/cell.webp",
  "assets/quiz_photos/cell_detail.webp",
  "assets/quiz_photos/cheetah.webp",
  "assets/quiz_photos/cheetah_eye.webp",
  "assets/quiz_photos/cheetah_spots.webp",
  "assets/quiz_photos/china_detail.webp",
  "assets/quiz_photos/china_roof.webp",
  "assets/quiz_photos/china_temple.webp",
  "assets/quiz_photos/clock.webp",
  "assets/quiz_photos/coffee.webp",
  "assets/quiz_photos/coffee_rim.webp",
  "assets/quiz_photos/coffee_spoon.webp",
  "assets/quiz_photos/coins.webp",
  "assets/quiz_photos/coins_close.webp",
  "assets/quiz_photos/coins_edge.webp",
  "assets/quiz_photos/eiffel.webp",
  "assets/quiz_photos/eiffel_close.webp",
  "assets/quiz_photos/eiffel_lattice.webp",
  "assets/quiz_photos/flower.webp",
  "assets/quiz_photos/flower_center.webp",
  "assets/quiz_photos/flower_petals.webp",
  "assets/quiz_photos/grass.webp",
  "assets/quiz_photos/grass_blades.webp",
  "assets/quiz_photos/gravel.webp",
  "assets/quiz_photos/gravel_detail.webp",
  "assets/quiz_photos/hubble.webp",
  "assets/quiz_photos/hubble_field.webp",
  "assets/quiz_photos/ihc.webp",
  "assets/quiz_photos/ihc_cells.webp",
  "assets/quiz_photos/lion.webp",
  "assets/quiz_photos/lion_eye.webp",
  "assets/quiz_photos/lion_mane.webp",
  "assets/quiz_photos/moon.webp",
  "assets/quiz_photos/moon_craters.webp",
  "assets/quiz_photos/moon_surface.webp",
  "assets/quiz_photos/motorcycle.webp",
  "assets/quiz_photos/motorcycle_engine.webp",
  "assets/quiz_photos/motorcycle_headlight.webp",
  "assets/quiz_photos/motorcycle_wheel.webp",
  "assets/quiz_photos/retina.webp",
  "assets/quiz_photos/retina_optic.webp",
  "assets/quiz_photos/retina_vessels.webp",
  "assets/quiz_photos/rocket.webp",
  "assets/quiz_photos/rocket_body.webp",
  "assets/quiz_photos/rocket_launchpad.webp",
];

export function pickPhoto() {
  return PHOTO_BANK[Math.floor(Math.random() * PHOTO_BANK.length)];
}

// Deterministic sector placement — always returns exactly `count` points
// with guaranteed minimum separation (no rejection sampling, so it can
// never fall short or leave two points overlapping, unlike naive random
// placement + retry). Percentage space (0-100); r is also in percentage
// of the canvas's shorter side.
export function generateDiffPoints(count = 5, margin = 14) {
  const cols = Math.ceil(Math.sqrt(count * 1.3));
  const rows = Math.ceil(count / cols);
  const cellW = (100 - margin * 2) / cols;
  const cellH = (100 - margin * 2) / rows;
  const r = Math.max(7, Math.min(13, Math.min(cellW, cellH) * 0.28));
  const pad = r + 2;
  const cells = [];
  for (let ry = 0; ry < rows; ry++) for (let cx = 0; cx < cols; cx++) cells.push([cx, ry]);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  return cells.slice(0, count).map(([cx, cy], i) => {
    const baseX = margin + cx * cellW, baseY = margin + cy * cellH;
    const jitterW = Math.max(0, cellW - pad * 2), jitterH = Math.max(0, cellH - pad * 2);
    const x = baseX + pad + Math.random() * jitterW;
    const y = baseY + pad + Math.random() * jitterH;
    return { id: `d${i}`, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, r: Math.round(r * 10) / 10 };
  });
}
