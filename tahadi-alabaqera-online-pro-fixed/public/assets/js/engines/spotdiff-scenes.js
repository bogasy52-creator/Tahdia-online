// Shared "spot the differences" data — real photos from the project's own
// photo library (public/assets/quiz_photos), never generated art.
// Only pure, DOM-free helpers live here so this same file can be imported
// by the Cloudflare Worker (server, no canvas) and by the browser (client,
// which does the actual canvas drawing/pixel work in spotdiff.html).

export const PHOTO_BANK = [
  "assets/spot_difference_photos/astronaut.webp",
  "assets/spot_difference_photos/astronaut_glove.webp",
  "assets/spot_difference_photos/astronaut_helmet.webp",
  "assets/spot_difference_photos/astronaut_suit.webp",
  "assets/spot_difference_photos/brick.webp",
  "assets/spot_difference_photos/brick_close.webp",
  "assets/spot_difference_photos/camera.webp",
  "assets/spot_difference_photos/camera_lens.webp",
  "assets/spot_difference_photos/camera_tripod.webp",
  "assets/spot_difference_photos/cat.webp",
  "assets/spot_difference_photos/cat_ear.webp",
  "assets/spot_difference_photos/cat_eye.webp",
  "assets/spot_difference_photos/cat_nose.webp",
  "assets/spot_difference_photos/cell.webp",
  "assets/spot_difference_photos/cell_detail.webp",
  "assets/spot_difference_photos/cheetah.webp",
  "assets/spot_difference_photos/cheetah_eye.webp",
  "assets/spot_difference_photos/cheetah_spots.webp",
  "assets/spot_difference_photos/china_detail.webp",
  "assets/spot_difference_photos/china_roof.webp",
  "assets/spot_difference_photos/china_temple.webp",
  "assets/spot_difference_photos/clock.webp",
  "assets/spot_difference_photos/coffee.webp",
  "assets/spot_difference_photos/coffee_rim.webp",
  "assets/spot_difference_photos/coffee_spoon.webp",
  "assets/spot_difference_photos/coins.webp",
  "assets/spot_difference_photos/coins_close.webp",
  "assets/spot_difference_photos/coins_edge.webp",
  "assets/spot_difference_photos/eiffel.webp",
  "assets/spot_difference_photos/eiffel_close.webp",
  "assets/spot_difference_photos/eiffel_lattice.webp",
  "assets/spot_difference_photos/flower.webp",
  "assets/spot_difference_photos/flower_center.webp",
  "assets/spot_difference_photos/flower_petals.webp",
  "assets/spot_difference_photos/grass.webp",
  "assets/spot_difference_photos/grass_blades.webp",
  "assets/spot_difference_photos/gravel.webp",
  "assets/spot_difference_photos/gravel_detail.webp",
  "assets/spot_difference_photos/hubble.webp",
  "assets/spot_difference_photos/hubble_field.webp",
  "assets/spot_difference_photos/ihc.webp",
  "assets/spot_difference_photos/ihc_cells.webp",
  "assets/spot_difference_photos/lion.webp",
  "assets/spot_difference_photos/lion_eye.webp",
  "assets/spot_difference_photos/lion_mane.webp",
  "assets/spot_difference_photos/moon.webp",
  "assets/spot_difference_photos/moon_craters.webp",
  "assets/spot_difference_photos/moon_surface.webp",
  "assets/spot_difference_photos/motorcycle.webp",
  "assets/spot_difference_photos/motorcycle_engine.webp",
  "assets/spot_difference_photos/motorcycle_headlight.webp",
  "assets/spot_difference_photos/motorcycle_wheel.webp",
  "assets/spot_difference_photos/retina.webp",
  "assets/spot_difference_photos/retina_optic.webp",
  "assets/spot_difference_photos/retina_vessels.webp",
  "assets/spot_difference_photos/rocket.webp",
  "assets/spot_difference_photos/rocket_body.webp",
  "assets/spot_difference_photos/rocket_launchpad.webp",
  "assets/spot_difference_photos/pack01_alpine_lake.webp",
  "assets/spot_difference_photos/pack01_tropical_beach.webp",
  "assets/spot_difference_photos/pack01_forest_waterfall.webp",
  "assets/spot_difference_photos/pack01_desert_dunes.webp",
  "assets/spot_difference_photos/pack01_lavender_field.webp",
  "assets/spot_difference_photos/pack01_autumn_stream.webp",
  "assets/spot_difference_photos/pack01_snow_cabin.webp",
  "assets/spot_difference_photos/pack01_green_valley.webp",
  "assets/spot_difference_photos/pack01_ocean_cliffs.webp",
  "assets/spot_difference_photos/pack01_wildflower_meadow.webp",
  "assets/spot_difference_photos/pack02_lion_portrait.webp",
  "assets/spot_difference_photos/pack02_panda_bamboo.webp",
  "assets/spot_difference_photos/pack02_elephant_savannah.webp",
  "assets/spot_difference_photos/pack02_dolphin_jump.webp",
  "assets/spot_difference_photos/pack02_macaw_parrot.webp",
  "assets/spot_difference_photos/pack02_tabby_kitten.webp",
  "assets/spot_difference_photos/pack02_golden_retriever.webp",
  "assets/spot_difference_photos/pack02_tiger_portrait.webp",
  "assets/spot_difference_photos/pack02_giraffe_savannah.webp",
  "assets/spot_difference_photos/pack02_owl_branch.webp",
  "assets/spot_difference_photos/pack03_eiffel_tower.webp",
  "assets/spot_difference_photos/pack03_big_ben.webp",
  "assets/spot_difference_photos/pack03_dubai_skyline.webp",
  "assets/spot_difference_photos/pack03_colosseum.webp",
  "assets/spot_difference_photos/pack03_mount_fuji_pagoda.webp",
  "assets/spot_difference_photos/pack03_statue_of_liberty.webp",
  "assets/spot_difference_photos/pack03_santorini.webp",
  "assets/spot_difference_photos/pack03_nyc_empire_state.webp",
  "assets/spot_difference_photos/pack03_tower_bridge.webp",
  "assets/spot_difference_photos/pack03_petra_treasury.webp",
  "assets/spot_difference_photos/pack04_sports_car.webp",
  "assets/spot_difference_photos/pack04_classic_muscle_car.webp",
  "assets/spot_difference_photos/pack04_street_motorcycle.webp",
  "assets/spot_difference_photos/pack04_school_bus.webp",
  "assets/spot_difference_photos/pack04_mountain_train.webp",
  "assets/spot_difference_photos/pack04_airplane.webp",
  "assets/spot_difference_photos/pack04_cruise_ship.webp",
  "assets/spot_difference_photos/pack04_offroad_suv.webp",
  "assets/spot_difference_photos/pack04_city_bicycle.webp",
  "assets/spot_difference_photos/pack04_city_helicopter.webp",
  "assets/spot_difference_photos/pack05_cheeseburger.webp",
  "assets/spot_difference_photos/pack05_pizza.webp",
  "assets/spot_difference_photos/pack05_latte_art.webp",
  "assets/spot_difference_photos/pack05_fruit_basket.webp",
  "assets/spot_difference_photos/pack05_cupcakes.webp",
  "assets/spot_difference_photos/pack05_pancakes.webp",
  "assets/spot_difference_photos/pack05_salad_bowl.webp",
  "assets/spot_difference_photos/pack05_sushi_platter.webp",
  "assets/spot_difference_photos/pack05_ice_cream.webp",
  "assets/spot_difference_photos/pack05_grilled_steak.webp",
  "assets/spot_difference_photos/pack06_living_room.webp",
  "assets/spot_difference_photos/pack06_cozy_bedroom.webp",
  "assets/spot_difference_photos/pack06_modern_kitchen.webp",
  "assets/spot_difference_photos/pack06_home_office.webp",
  "assets/spot_difference_photos/pack06_reading_corner.webp",
  "assets/spot_difference_photos/pack06_luxury_bathroom.webp",
  "assets/spot_difference_photos/pack06_rustic_dining_room.webp",
  "assets/spot_difference_photos/pack06_kids_playroom.webp",
  "assets/spot_difference_photos/pack06_hotel_lobby.webp",
  "assets/spot_difference_photos/pack06_balcony_plants.webp",
  "assets/spot_difference_photos/pack07_red_rose.webp",
  "assets/spot_difference_photos/pack07_sunflower_field.webp",
  "assets/spot_difference_photos/pack07_pink_orchid.webp",
  "assets/spot_difference_photos/pack07_potted_cactus.webp",
  "assets/spot_difference_photos/pack07_bonsai_tree.webp",
  "assets/spot_difference_photos/pack07_tulip_field.webp",
  "assets/spot_difference_photos/pack07_monstera_plant.webp",
  "assets/spot_difference_photos/pack07_cherry_blossom.webp",
  "assets/spot_difference_photos/pack07_lavender_bundle.webp",
  "assets/spot_difference_photos/pack07_succulent_bowl.webp",
  "assets/spot_difference_photos/pack08_astronaut.webp",
  "assets/spot_difference_photos/pack08_rocket_launch.webp",
  "assets/spot_difference_photos/pack08_moon_surface.webp",
  "assets/spot_difference_photos/pack08_spiral_galaxy.webp",
  "assets/spot_difference_photos/pack08_observatory_dome.webp",
  "assets/spot_difference_photos/pack08_lab_microscope.webp",
  "assets/spot_difference_photos/pack08_microchip_board.webp",
  "assets/spot_difference_photos/pack08_humanoid_robot.webp",
  "assets/spot_difference_photos/pack08_earth_satellite.webp",
  "assets/spot_difference_photos/pack08_camera_lens.webp",
  "assets/spot_difference_photos/pack09_alarm_clock.webp",
  "assets/spot_difference_photos/pack09_coin_pile.webp",
  "assets/spot_difference_photos/pack09_acoustic_guitar.webp",
  "assets/spot_difference_photos/pack09_soccer_ball.webp",
  "assets/spot_difference_photos/pack09_paint_palette.webp",
  "assets/spot_difference_photos/pack09_book_stack.webp",
  "assets/spot_difference_photos/pack09_wrist_watch.webp",
  "assets/spot_difference_photos/pack09_sunglasses.webp",
  "assets/spot_difference_photos/pack09_tea_kettle.webp",
  "assets/spot_difference_photos/pack09_travel_backpack.webp",
  "assets/spot_difference_photos/pack10_market_street.webp",
  "assets/spot_difference_photos/pack10_temple_pagoda.webp",
  "assets/spot_difference_photos/pack10_hot_air_balloons.webp",
  "assets/spot_difference_photos/pack10_desert_camp.webp",
  "assets/spot_difference_photos/pack10_harbor_boats.webp",
  "assets/spot_difference_photos/pack10_snowy_village.webp",
  "assets/spot_difference_photos/pack10_camel_caravan.webp",
  "assets/spot_difference_photos/pack10_waterfall_viewpoint.webp",
  "assets/spot_difference_photos/pack10_hilltop_castle.webp",
  "assets/spot_difference_photos/pack10_tea_terrace.webp",
];

export function pickPhoto(exclude = []) {
  const pool = PHOTO_BANK.filter((p) => !exclude.includes(p));
  const list = pool.length ? pool : PHOTO_BANK;
  return list[Math.floor(Math.random() * list.length)];
}

// Deterministic sector placement — always returns exactly `count` points
// with guaranteed minimum separation (no rejection sampling, so it can
// never fall short or leave two points overlapping, unlike naive random
// placement + retry). Percentage space (0-100); r is also in percentage
// of the canvas's shorter side.
export function generateDiffPoints(count = 5, margin = 14, rMin = 7, rMax = 13) {
  // The phone round is intentionally balanced: four separate zones, large
  // enough to inspect without zooming and never stacked on one detail.
  if (count === 4) {
    const anchors = [[25, 27], [74, 30], [29, 72], [73, 70]];
    const radius = Math.max(rMin, Math.min(rMax, 13));
    return anchors.map(([x, y], i) => ({
      id: `d${i}`,
      x: Math.round((x + (Math.random() * 6 - 3)) * 10) / 10,
      y: Math.round((y + (Math.random() * 6 - 3)) * 10) / 10,
      r: radius,
    }));
  }
  const cols = Math.ceil(Math.sqrt(count * 1.3));
  const rows = Math.ceil(count / cols);
  const cellW = (100 - margin * 2) / cols;
  const cellH = (100 - margin * 2) / rows;
  const r = Math.max(rMin, Math.min(rMax, Math.min(cellW, cellH) * 0.28));
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

// Difficulty presets shared by server (validates/generates rounds) and
// client (renders the picker + labels). Easy = fewer, bigger, more time.
// Hard = more, smaller, less time.
export const DIFFICULTIES = {
  easy:   { key: "easy",   label: "متوازن", icon: "◉", count: 4, margin: 15, rMin: 12, rMax: 15, duration: 90_000 },
  medium: { key: "medium", label: "متوسط", icon: "😐", count: 5, margin: 14, rMin: 7,  rMax: 13, duration: 75_000 },
  hard:   { key: "hard",   label: "صعب",   icon: "🔥", count: 6, margin: 12, rMin: 5,  rMax: 9,  duration: 60_000 },
};

export function diffPointsForDifficulty(key) {
  const d = DIFFICULTIES[key] || DIFFICULTIES.medium;
  return { points: generateDiffPoints(d.count, d.margin, d.rMin, d.rMax), duration: d.duration, key: d.key };
}
