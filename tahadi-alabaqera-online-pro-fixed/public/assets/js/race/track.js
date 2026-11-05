// Turbo Kart — track building (pure: no DOM, so the tests and the renderer share it).
export const SEG_LEN = 200;      // world length of one road segment
export const ROAD_W = 2000;      // half the road width in world units
export const RUMBLE = 3;         // segments per rumble-strip colour
export const CAM_H = 1000;       // camera height above the road
export const FOV = 100;          // degrees
export const CAM_DEPTH = 1 / Math.tan((FOV / 2) * Math.PI / 180);
export const PLAYER_Z = CAM_H * CAM_DEPTH; // how far in front of the camera the player's kart is drawn

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lerp = (a, b, p) => a + (b - a) * p;
const easeIn = (a, b, p) => a + (b - a) * p * p;
const easeInOut = (a, b, p) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5);

// Three tracks. `lay` is a list of [kind, ...numbers]; every kind is expanded by buildTrack.
export const TRACKS = [
  {
    id: 'dunes', name: 'صحراء الشروق', blurb: 'منحنيات واسعة وتلال ناعمة. تبدأ منها.', stars: 1,
    theme: {
      skyTop: '#2b1b5a', skyMid: '#ff7a59', skyLow: '#ffd37a', sun: '#fff1b8', sunY: 0.40, fog: '#f2b377',
      grass: ['#d9a15a', '#cf964d'], rumble: ['#fff4e0', '#d4492f'], road: ['#5a5560', '#625d69'], lane: '#f6e7c1',
      far: ['#9a5a64', '#7d4764'], near: ['#6b3f5e', '#4e3258'], scenery: ['cactus', 'rock', 'palm'], lamp: false,
    },
    lay: [['straight', 20], ['curve', 18, 18, 18, 2.2, 0], ['hill', 25, 25, 25, 0, 28], ['curve', 22, 22, 22, -3, -14], ['straight', 24],
      ['scurve'], ['hill', 20, 20, 20, 1.4, 40], ['curve', 26, 26, 26, 3.4, -42], ['straight', 18], ['curve', 22, 18, 22, -2.6, 8],
      ['scurve'], ['hill', 16, 16, 16, 0, -10], ['curve', 30, 24, 30, 3.8, 0], ['straight', 32]],
  },
  {
    id: 'neon', name: 'مدينة النيون', blurb: 'ليل، أضواء، ومنعطفات حادة. للمحترفين.', stars: 2,
    theme: {
      skyTop: '#05061a', skyMid: '#1b0f4a', skyLow: '#7b2cbf', sun: '#7df9ff', sunY: 0.36, fog: '#2a1458',
      grass: ['#0e1230', '#0b0f28'], rumble: ['#00f0ff', '#ff2bd6'], road: ['#1d1f33', '#232640'], lane: '#7df9ff',
      far: ['#1a1450', '#150f3d'], near: ['#241a66', '#1b1350'], scenery: ['tower', 'pylon', 'billboard'], lamp: true,
    },
    lay: [['straight', 26], ['curve', 14, 14, 14, 4.2, 0], ['curve', 14, 14, 14, -4.2, 0], ['straight', 18], ['scurve'], ['scurve'],
      ['curve', 18, 22, 18, 5, 0], ['straight', 14], ['hill', 14, 14, 14, 0, 22], ['curve', 18, 14, 18, -4.6, -22], ['straight', 16],
      ['curve', 14, 10, 14, 4.8, 0], ['curve', 14, 10, 14, -4.8, 0], ['straight', 20], ['scurve'], ['curve', 22, 18, 22, 3.6, 0], ['straight', 30]],
  },
  {
    id: 'peak', name: 'قمة الجليد', blurb: 'مرتفعات طويلة ونزلات سريعة.', stars: 3,
    theme: {
      skyTop: '#16345f', skyMid: '#5b9bd5', skyLow: '#dff1ff', sun: '#ffffff', sunY: 0.30, fog: '#cfe6f7',
      grass: ['#eef6ff', '#e0eefb'], rumble: ['#ffffff', '#3b7fd1'], road: ['#4b5568', '#525d71'], lane: '#e8f3ff',
      far: ['#8fb2d6', '#7da2c9'], near: ['#6d92ba', '#5c80aa'], scenery: ['pine', 'iceRock', 'pine'], lamp: false,
    },
    lay: [['straight', 22], ['hill', 30, 30, 30, 0, 60], ['curve', 26, 20, 26, 3.2, 20], ['hill', 20, 24, 20, -2.6, -70], ['straight', 20],
      ['curve', 30, 26, 30, -3.8, 30], ['scurve'], ['hill', 26, 26, 26, 2.2, 54], ['hill', 18, 20, 18, 0, -62], ['curve', 26, 22, 26, 4.2, 0],
      ['straight', 22], ['scurve'], ['hill', 22, 22, 22, -3, 28], ['curve', 28, 22, 28, 2.8, -26], ['straight', 36]],
  },
];

export function buildTrack(def, seed = 7) {
  const rng = mulberry32(seed + def.id.length * 977);
  const segs = [];
  let lastY = 0;
  const add = (curve, y) => {
    const n = segs.length;
    segs.push({
      index: n, curve,
      p1: { world: { y: lastY, z: n * SEG_LEN }, camera: {}, screen: {} },
      p2: { world: { y, z: (n + 1) * SEG_LEN }, camera: {}, screen: {} },
      shade: Math.floor(n / RUMBLE) % 2, scenery: [], padX: null, frame: -1, clip: 0, looped: false, fog: 1,
    });
    lastY = y;
  };
  const K = 1.7; // every stretch is longer than its recipe so a lap takes ~35-45 seconds
  const road = (en, ho, le, curve, hill) => {
    const enter = Math.round(en * K), hold = Math.round(ho * K), leave = Math.round(le * K);
    const startY = lastY, endY = startY + hill * SEG_LEN, total = enter + hold + leave;
    for (let i = 0; i < enter; i++) add(easeIn(0, curve, i / enter), easeInOut(startY, endY, i / total));
    for (let i = 0; i < hold; i++) add(curve, easeInOut(startY, endY, (enter + i) / total));
    for (let i = 0; i < leave; i++) add(easeInOut(curve, 0, i / leave), easeInOut(startY, endY, (enter + hold + i) / total));
  };
  for (const part of def.lay) {
    const [kind, a, b, c, d, e] = part;
    if (kind === 'straight') road(a, a, a, 0, 0);
    else if (kind === 'curve') road(a, b, c, d, e);
    else if (kind === 'hill') road(a, b, c, d, e);
    else if (kind === 'scurve') { road(14, 14, 14, -2.4, 0); road(14, 14, 14, 3.2, 8); road(14, 14, 14, -3.4, -8); }
  }
  // bring the road back to the start height so the lap closes
  const back = Math.floor(-lastY / SEG_LEN);
  road(30, 30, 30, 0, back);
  const N = segs.length;
  segs[N - 1].p2.world.y = 0;

  // scenery, boost pads, item boxes
  const sceneryTypes = def.theme.scenery;
  for (let i = 8; i < N; i += 3 + Math.floor(rng() * 5)) {
    const side = rng() < 0.5 ? -1 : 1, type = sceneryTypes[Math.floor(rng() * sceneryTypes.length)];
    segs[i].scenery.push({ type, x: side * (1.35 + rng() * 2.6), s: 0.8 + rng() * 0.6 });
    if (rng() < 0.35) segs[i].scenery.push({ type: sceneryTypes[Math.floor(rng() * sceneryTypes.length)], x: -side * (1.5 + rng() * 3), s: 0.7 + rng() * 0.6 });
  }
  if (def.theme.lamp) for (let i = 6; i < N; i += 14) { segs[i].scenery.push({ type: 'lamp', x: -1.18, s: 1 }); segs[i].scenery.push({ type: 'lamp', x: 1.18, s: 1 }); }
  segs[2].scenery.push({ type: 'arch', x: 0, s: 1 });
  for (let k = 1; k <= 3; k++) { const i = Math.floor((N * k) / 4); segs[i].scenery.push({ type: 'banner', x: 0, s: 1 }); }

  const pads = [];
  for (let k = 0; k < 5; k++) {
    const start = Math.floor(N * (0.1 + k * 0.18 + rng() * 0.05)), x = [-0.5, 0, 0.5][k % 3];
    for (let i = 0; i < 6; i++) segs[(start + i) % N].padX = x;
    pads.push({ z: start * SEG_LEN, x });
  }
  const boxes = [];
  for (let k = 0; k < 9; k++) {
    const z = Math.floor(N * (0.07 + k * 0.105)) * SEG_LEN;
    for (const x of [-0.55, 0, 0.55]) boxes.push({ z, x, taken: 0 });
  }
  return { id: def.id, def, theme: def.theme, segs, length: N * SEG_LEN, count: N, pads, boxes };
}

export const segIndex = (track, z) => Math.floor(((z % track.length) + track.length) % track.length / SEG_LEN);
export const segAt = (track, z) => track.segs[segIndex(track, z)];

// The road seen from above, for the mini-map. Returns points scaled into 0..1.
export function minimapPoints(track) {
  let x = 0, y = 0, h = 0;
  const pts = [];
  for (const s of track.segs) { h += s.curve * 0.0046; x += Math.sin(h); y -= Math.cos(h); pts.push([x, y]); }
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  return pts.map(([px, py]) => [(px - minX) / span + (1 - (maxX - minX) / span) / 2, (py - minY) / span + (1 - (maxY - minY) / span) / 2]);
}
export { lerp };
