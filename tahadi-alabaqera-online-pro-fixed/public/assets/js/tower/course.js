/* لعبة العباقرة 33.18.0 — «برج التحديات»: the courses.
   One pure module the page, the 3D scene and the server share: six worlds, twenty-one kinds of
   challenge, a hundred levels that each lead with a different challenge (no two levels are the same
   mix), and the course a level or an online round is built from. Everything that moves does so as a
   function of the round's clock, so every player in a room sees the same hammer at the same moment. */

export const TOWER_VERSION = 1;
export const GRAVITY = 30, JUMP = 11, RUN = 6.2, PLAYER_R = 0.42, PLAYER_H = 1.55;

export const WORLDS = Object.freeze([
  { id: 'forest', name: 'الغابة', from: 1, to: 17, g: 1, sky: ['#8fd3ff', '#e9f8ff'], fog: '#cdeefa', floor: '#7cc46a', edge: '#4f8a3c', stone: '#b98a5a', accent: '#ffcf4a', glow: '#fff3b0' },
  { id: 'ice', name: 'الجليد', from: 18, to: 34, g: 1, sky: ['#7fb6ff', '#f2fbff'], fog: '#dcefff', floor: '#e9f6ff', edge: '#8cc4ec', stone: '#a9c9e6', accent: '#55c9ff', glow: '#e8fbff', icy: true },
  { id: 'candy', name: 'الحلوى', from: 35, to: 51, g: 1, sky: ['#ff9fd8', '#fff0fa'], fog: '#ffd9f1', floor: '#ffb3dc', edge: '#ff6fb7', stone: '#fff1c9', accent: '#7ee7d0', glow: '#fffaf0', jelly: true },
  { id: 'desert', name: 'الصحراء', from: 52, to: 68, g: 1, sky: ['#ffb46b', '#fff1d6'], fog: '#ffe3bd', floor: '#f1c27d', edge: '#c98b45', stone: '#d9a066', accent: '#2fb5a8', glow: '#fff0c8', gusty: true },
  { id: 'space', name: 'الفضاء', from: 69, to: 84, g: 0.72, sky: ['#05031a', '#2b1a6b'], fog: '#1b1048', floor: '#8b86ff', edge: '#4f45d6', stone: '#6c6fa8', accent: '#59f3ff', glow: '#b9f7ff', stars: true },
  { id: 'lava', name: 'الحمم البركانية', from: 85, to: 100, g: 1, sky: ['#2a0b0b', '#8a2a12'], fog: '#4a160c', floor: '#5b4a52', edge: '#ff6a1f', stone: '#3b2f36', accent: '#ffb02e', glow: '#ffd08a', lava: true },
]);
export const worldOf = (n) => WORLDS.find((w) => n >= w.from && n <= w.to) || WORLDS[0];
export const worldById = (id) => WORLDS.find((w) => w.id === id) || WORLDS[0];

export const CHALLENGES = Object.freeze({
  steps: { name: 'درج القفز', tip: 'اقفز من درجة لدرجة واطلع فوق' },
  gaps: { name: 'الفجوات', tip: 'خذ مسافة واقفز قبل الحافة' },
  movers: { name: 'المنصات المتحركة', tip: 'انتظر المنصة تقرب منك' },
  lifts: { name: 'المصاعد', tip: 'اركب المصعد واقفز وهو فوق' },
  spinners: { name: 'الأقراص الدوارة', tip: 'القرص يلفّك، امشِ عكسه' },
  sweeper: { name: 'الذراع الدوار', tip: 'اقفز فوق الذراع وقت ما يوصلك' },
  hammers: { name: 'المطارق', tip: 'اعبر بعد ما تمر المطرقة' },
  conveyor: { name: 'السير العكسي', tip: 'السير يرجعك، لا توقف' },
  crumble: { name: 'البلاط الهش', tip: 'البلاط يطيح بعد ما تدوسه، لا تتأخر' },
  doors: { name: 'الأبواب الخادعة', tip: 'بعض الأبواب مقفلة، جرّب غيرها' },
  pads: { name: 'النطّاطات', tip: 'دس على النطاط عشان تطير فوق' },
  pistons: { name: 'المكابس', tip: 'المكابس تدفّك برا الطريق' },
  wind: { name: 'العاصفة', tip: 'الريح تدفّك على الجنب، قاومها' },
  beams: { name: 'العارضة الضيقة', tip: 'امشِ بالنص ولا تستعجل' },
  rollers: { name: 'البراميل المتدحرجة', tip: 'اقفز فوق البراميل وأنت طالع' },
  pillars: { name: 'الأعمدة', tip: 'نط من عمود لعمود' },
  blink: { name: 'المنصات الوامضة', tip: 'المنصة تختفي وترجع، امشِ على الإيقاع' },
  cannons: { name: 'المدافع', tip: 'الكور تطير من الجنب، اعبر بين الطلقات' },
  bumpers: { name: 'الصدّامات', tip: 'الصدّامات ترميك بعيد' },
  slide: { name: 'المزلقة', tip: 'الأرض زلقة، خفف وأنت تلف' },
  gates: { name: 'البوابات المتحركة', tip: 'الفتحة تتحرك، اعبر وقت ما تكون قدامك' },
});
export const CHALLENGE_IDS = Object.freeze(Object.keys(CHALLENGES));
/** 33.19.0: the boss at the summit of each world */
export const BOSSES = Object.freeze({
  forest: { id: 'bossroll', name: 'الجذع العملاق', tip: 'اقفز فوق الجذوع وأنت طالع، وكل وحدة أكبر من اللي قبلها' },
  ice: { id: 'bosssweep', name: 'الذراع الجليدي', tip: 'ذراع تحت وذراع فوق، والأرض زلقة' },
  candy: { id: 'bossham', name: 'مطارق الحلوى', tip: 'المطارق عملاقة، اعبر بعد ما تمر' },
  desert: { id: 'bossrise', name: 'الرمال المتحركة', tip: 'الرمل يرتفع وراك، اطلع بسرعة' },
  space: { id: 'bossspin', name: 'المدار', tip: 'الأقراص تلف والأذرع تكنس، والجاذبية خفيفة' },
  lava: { id: 'bossrise', name: 'الحمم ترتفع', tip: 'الحمم ترتفع وراك، لا توقف' },
});
const BOSS_NAMES = Object.freeze(Object.fromEntries(Object.values(BOSSES).map((b) => [b.id, b.name])));
export const sectionName = (kind, world) => CHALLENGES[kind]?.name || (world && BOSSES[world]?.id === kind ? BOSSES[world].name : BOSS_NAMES[kind]) || '';
export const sectionTip = (kind, world) => CHALLENGES[kind]?.tip || (world && BOSSES[world]?.id === kind ? BOSSES[world].tip : Object.values(BOSSES).find((b) => b.id === kind)?.tip) || '';

/* ------------------------------------------------------------------ randomness */
export function rng(seed) {
  let a = seed >>> 0;
  const next = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  next.range = (lo, hi) => lo + (hi - lo) * next();
  next.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * next());
  next.pick = (list) => list[Math.floor(next() * list.length)];
  next.sign = () => (next() < 0.5 ? -1 : 1);
  return next;
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const TAU = Math.PI * 2;

/* ------------------------------------------------------------------ the hundred levels */
// each world teaches in its own order; the rotation keeps a level's lead challenge new
const WORLD_ORDER = {
  forest: ['steps', 'gaps', 'movers', 'rollers', 'spinners', 'pillars', 'hammers', 'beams', 'lifts', 'doors', 'pads', 'sweeper', 'crumble', 'bumpers', 'gates', 'conveyor', 'wind'],
  ice: ['slide', 'crumble', 'movers', 'beams', 'sweeper', 'pillars', 'blink', 'spinners', 'cannons', 'doors', 'hammers', 'lifts', 'gates', 'pads', 'conveyor', 'pistons', 'gaps'],
  candy: ['pads', 'bumpers', 'spinners', 'blink', 'doors', 'conveyor', 'rollers', 'gates', 'lifts', 'movers', 'sweeper', 'pistons', 'pillars', 'crumble', 'cannons', 'beams', 'hammers'],
  desert: ['wind', 'rollers', 'pistons', 'gaps', 'hammers', 'cannons', 'conveyor', 'doors', 'beams', 'sweeper', 'blink', 'lifts', 'movers', 'bumpers', 'spinners', 'crumble', 'gates'],
  space: ['lifts', 'blink', 'pads', 'spinners', 'cannons', 'gates', 'pillars', 'movers', 'sweeper', 'crumble', 'bumpers', 'beams', 'wind', 'hammers', 'slide', 'doors'],
  lava: ['crumble', 'blink', 'hammers', 'pistons', 'sweeper', 'cannons', 'pillars', 'rollers', 'gates', 'movers', 'beams', 'spinners', 'lifts', 'wind', 'bumpers', 'doors'],
};
const EASY = ['steps', 'gaps', 'pillars', 'movers', 'spinners', 'pads', 'slide'];

function makeLevels() {
  const out = [], seen = new Set();
  for (const world of WORLDS) {
    const size = world.to - world.from + 1, order = WORLD_ORDER[world.id];
    for (let k = 0; k < size; k++) {
      const n = world.from + k, r = rng(n * 7919 + 17), lead = order[k % order.length];
      const d = clamp(0.06 + 0.5 * (n - 1) / 99 + 0.36 * k / (size - 1), 0, 1);
      const finale = k === size - 1;
      const count = n <= 2 ? 1 : n <= 8 ? 2 : finale ? 4 : n <= 40 ? 2 + (k % 2) : 3;
      const pool = order.slice(0, Math.max(4, k + 2)).filter((c) => c !== lead);
      let support, key, tries = 0;
      do {
        support = [];
        const bag = (n <= 12 ? pool.filter((c) => EASY.includes(c) || order.indexOf(c) < k) : pool).slice();
        while (support.length < count && bag.length) support.push(bag.splice(Math.floor(r() * bag.length), 1)[0]);
        key = [lead, ...support.slice().sort()].join('+');
      } while (seen.has(key) && ++tries < 40);
      seen.add(key);
      // the lead challenge sits in the middle of the course, where it is hardest to miss
      const list = support.slice(); list.splice(Math.min(1, list.length), 0, lead);
      if (finale) list.push(BOSSES[world.id].id);
      out.push(Object.freeze({ n, world: world.id, lead, challenges: Object.freeze(list), d: Math.round(d * 1000) / 1000, finale, seed: n * 104729 + 3, boss: finale ? BOSSES[world.id].name : null, title: finale ? 'قمة ' + world.name + ': ' + BOSSES[world.id].name : CHALLENGES[lead].name }));
    }
  }
  return Object.freeze(out);
}
export const LEVELS = makeLevels();
export const levelInfo = (n) => LEVELS[clamp(Math.floor(n) || 1, 1, LEVELS.length) - 1];

/* ------------------------------------------------------------------ building a course */
// A course runs along +z and climbs. A box's y is its top; `mv` moves it, `bl` makes it blink.
// cursor: c.z = the far edge of the last solid ground, c.y = its top, c.x = its middle.
function section(kind, c) {
  const { r, d, P } = c, W = c.world;
  const plat = (x, y, z, w, dd, o = {}) => P({ k: 'box', x, y, z, w, h: o.h || 0.9, d: dd, m: o.m || 'floor', ...o });
  const land = (len = 4, w = 7) => { plat(c.x, c.y, c.z + len / 2, w, len); c.z += len; };
  const spine = (x, y, z, t, jump = 0) => c.S.push({ x, y, z, t: (c.t += t), j: jump });
  const gem = (x, y, z) => c.G.push({ x, y: y + 1.1, z });
  const icy = W.icy && r() < 0.5 ? 'ice' : 'floor';
  const g = GRAVITY * W.g;
  switch (kind) {
    case 'steps': {
      const n = 5 + Math.round(3 * d);
      for (let i = 0; i < n; i++) {
        const gap = 0.7 + 1.0 * d * r(), depth = 3.3 - 0.7 * d, x = c.x + (i % 2 ? 1 : -1) * (0.6 + 1.6 * d) * r();
        c.y += 0.8 + 0.4 * r(); c.z += gap;
        plat(x, c.y, c.z + depth / 2, 4.4 - 1.4 * d, depth, { m: icy }); c.z += depth; spine(x, c.y, c.z - depth / 2, 0.75, 1);
        if (i === 2) gem(x, c.y, c.z - depth / 2);
      }
      c.x = 0; break;
    }
    case 'gaps': {
      const n = 4 + Math.round(3 * d);
      for (let i = 0; i < n; i++) {
        const gap = 1.2 + 1.6 * d * (0.6 + 0.4 * r()), size = 3.7 - 1.2 * d, x = clamp(c.x + r.range(-2, 2) * (0.4 + d), -3, 3);
        c.z += gap; c.y += r.range(-0.3, 0.5);
        plat(x, c.y, c.z + size / 2, size, size, { m: icy }); c.z += size; c.x = x; spine(x, c.y, c.z - size / 2, 0.8, 1);
        if (i === n - 2) gem(x, c.y, c.z - size / 2);
      }
      c.x = 0; break;
    }
    case 'movers': {
      const n = 3 + Math.round(2 * d), amp = 2.2 + 1.2 * d, p = 3.8 - 1.0 * d;
      for (let i = 0; i < n; i++) {
        c.z += 1.3; const z = c.z + 1.6;
        plat(0, c.y, z, 3.2, 3.2, { mv: { ax: [amp, 0, 0], p, ph: i * 0.37 } }); c.z += 3.2; spine(0, c.y, z, 1.2, 1);
        if (i === 1) gem(0, c.y, z);
      }
      break;
    }
    case 'lifts': {
      const n = 2 + Math.round(2 * d), p = 3.4 - 0.8 * d;
      for (let i = 0; i < n; i++) {
        c.z += 1.1; c.y += 1.9; const z = c.z + 1.5;
        plat(c.x, c.y - 0.9, z, 3, 3, { mv: { ax: [0, 1.25, 0], p, ph: i * 0.5 } }); c.z += 3; spine(c.x, c.y, z, 1.6, 1);
      }
      c.z += 1.1; c.y += 1.2; plat(0, c.y, c.z + 2, 6, 4); gem(1.8, c.y, c.z + 2); c.z += 4; spine(0, c.y, c.z - 2, 0.8, 1);
      break;
    }
    case 'spinners': {
      const n = 3 + Math.round(d), rad = 2.9 - 0.6 * d;
      for (let i = 0; i < n; i++) {
        c.z += 1.2; const z = c.z + rad;
        P({ k: 'disk', x: 0, y: c.y, z, r: rad, h: 0.9, w: (i % 2 ? -1 : 1) * (0.55 + 0.9 * d) }); c.z += rad * 2; spine(0, c.y, z, 1.1, 1);
        if (i === 1) gem(rad * 0.6, c.y, z);
      }
      break;
    }
    case 'sweeper': {
      const R = 6, z = c.z + 1 + R;
      P({ k: 'disk', x: 0, y: c.y, z, r: R, h: 1, w: 0, m: icy });
      P({ k: 'bar', x: 0, y: c.y + 0.55, z, len: R - 0.2, r: 0.32, w: 1.1 + 1.3 * d, ph: r() * TAU, arms: d > 0.4 ? 2 : 1 });
      if (d > 0.7) P({ k: 'bar', x: 0, y: c.y + 2.4, z, len: R - 0.6, r: 0.3, w: -(0.9 + 0.8 * d), ph: r() * TAU, arms: 1 });
      gem(-3.5, c.y, z); c.z = z + R; spine(0, c.y, z, 3.2, 0); spine(0, c.y, c.z, 1.6, 0);
      break;
    }
    case 'hammers': {
      const n = 3 + Math.round(2 * d), w = 3.4 - 0.9 * d, len = n * 3.6 + 2;
      plat(0, c.y, c.z + len / 2, w, len, { m: icy });
      for (let i = 0; i < n; i++) P({ k: 'ham', x: 0, y: c.y + 6.2, z: c.z + 2.6 + i * 3.6, L: 5.2, hr: 0.9, amp: 1.05, p: 2.6 - 0.7 * d, ph: i * 0.29 });
      gem(0, c.y, c.z + len * 0.55); c.z += len; spine(0, c.y, c.z, len / 4.2, 0);
      break;
    }
    case 'conveyor': {
      const len = 16 + 4 * d, v = 2 + 2.6 * d;
      plat(0, c.y, c.z + len / 2, 7, len, { m: 'conv', cv: [0, -v] });
      const blocks = 2 + Math.round(3 * d);
      for (let i = 0; i < blocks; i++) plat(r.range(-2.4, 2.4), c.y + 1.1, c.z + 3 + i * (len - 5) / blocks, 1.6, 1.2, { m: 'wall', h: 1.1 });
      gem(-2.6, c.y, c.z + len * 0.7); c.z += len; spine(0, c.y, c.z, len / (RUN - v) * 0.9, 0);
      break;
    }
    case 'crumble': {
      const rows = 5 + Math.round(3 * d), cols = 3, s = 2.2, gap = 0.35, delay = 0.5 - 0.25 * d;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) plat((i - 1) * (s + gap), c.y, c.z + 0.4 + s / 2 + j * (s + gap), s, s, { m: 'crumble', cr: delay, h: 0.5 });
      gem(s + gap, c.y, c.z + rows * (s + gap) * 0.5); c.z += rows * (s + gap) + 0.4; spine(0, c.y, c.z, rows * 0.45, 0);
      break;
    }
    case 'doors': {
      const rows = 2 + Math.round(1.6 * d), n = 5, w = 1.7, len = rows * 5 + 2;
      plat(0, c.y, c.z + len / 2, n * w + 0.6, len);
      for (let j = 0; j < rows; j++) {
        const real = new Set(); const want = d > 0.6 ? 2 : 3; while (real.size < want) real.add(r.int(0, n - 1));
        for (let i = 0; i < n; i++) P({ k: 'door', x: (i - (n - 1) / 2) * w, y: c.y, z: c.z + 3 + j * 5, w: w - 0.12, h: 2.7, d: 0.4, open: real.has(i) });
      }
      gem(0, c.y, c.z + len - 1.6); c.z += len; spine(0, c.y, c.z, len / 3, 0);
      break;
    }
    case 'pads': {
      const n = 2 + Math.round(1.5 * d);
      for (let i = 0; i < n; i++) {
        plat(c.x, c.y, c.z + 2, 4, 4); P({ k: 'pad', x: c.x, y: c.y, z: c.z + 2.4, r: 0.9, pw: Math.sqrt(2 * g * 4.6) }); c.z += 4;
        c.z += 2.2; c.y += 3.6; c.x = clamp(c.x + r.range(-1.5, 1.5), -2, 2); plat(c.x, c.y, c.z + 1.6, 4.4, 3.2); c.z += 3.2; spine(c.x, c.y, c.z - 1.6, 1.4, 2);
        if (i === n - 1) gem(c.x, c.y, c.z - 1.6);
      }
      c.x = 0; break;
    }
    case 'pistons': {
      const n = 3 + Math.round(2 * d), len = n * 3.4 + 2.4, p = 2.6 - 0.8 * d;
      plat(0, c.y, c.z + len / 2, 5, len, { m: icy });
      for (let i = 0; i < n; i++) { const side = i % 2 ? 1 : -1; P({ k: 'box', x: side * 4.6, y: c.y + 1.8, z: c.z + 2.2 + i * 3.4, w: 4, h: 1.8, d: 1.6, m: 'push', mv: { ax: [-side * 2.6, 0, 0], p, ph: i * 0.21, pulse: 1 } }); }
      gem(0, c.y, c.z + len * 0.4); c.z += len; spine(0, c.y, c.z, len / 4.4, 0);
      break;
    }
    case 'wind': {
      const len = 16 + 4 * d, w = 3 - 0.9 * d;
      plat(0, c.y, c.z + len / 2, w, len);
      P({ k: 'wind', x: 0, z: c.z + len / 2, w: 14, d: len, y0: c.y - 1, y1: c.y + 4, f: 9 + 9 * d, p: 3.4 - d, ph: r() });
      gem(0, c.y, c.z + len * 0.6); c.z += len; spine(0, c.y, c.z, len / 4.6, 0);
      break;
    }
    case 'beams': {
      const n = 3 + Math.round(1.5 * d), bw = 1.5 - 0.5 * d;
      for (let i = 0; i < n; i++) {
        const len = 5 + 2 * d, x = (i % 2 ? 1 : -1) * 1.6;
        c.z += 0.9; plat(x, c.y, c.z + len / 2, bw, len, { m: icy === 'ice' && i % 2 ? 'ice' : 'floor' }); spine(x, c.y, c.z + 0.6, 0.6, 1); c.z += len; spine(x, c.y, c.z, len / 4.5, 0);
        c.z += 0.9; plat(x, c.y, c.z + 1, 2.2, 2); c.z += 2; spine(x, c.y, c.z - 1, 0.5, 1);
        if (i === 1) gem(x, c.y, c.z - 1);
      }
      break;
    }
    case 'rollers': {
      const steps = 14 + Math.round(4 * d), rise = 0.32, depth = 1.15, z0 = c.z, y0 = c.y;
      for (let i = 0; i < steps; i++) plat(0, c.y + rise * (i + 1), c.z + depth * (i + 0.5), 7, depth, { h: 0.9 + rise * (i + 1) });
      c.z += steps * depth; c.y += steps * rise;
      const n = 2 + Math.round(2 * d);
      for (let i = 0; i < n; i++) P({ k: 'roll', x: 0, z0: c.z - 0.5, z1: z0, y0: c.y, y1: y0, w: 6.6, r: 0.6, p: 3.2 - 0.8 * d, ph: i / n });
      gem(2.6, c.y, c.z - 1); spine(0, c.y, c.z, steps * depth / 4.2, 0);
      break;
    }
    case 'pillars': {
      const n = 5 + Math.round(3 * d);
      for (let i = 0; i < n; i++) {
        const gap = 1.2 + 1.1 * d * r(), s = 2 - 0.5 * d, x = clamp(c.x + r.range(-1.8, 1.8), -2.6, 2.6);
        c.z += gap; c.y += r.range(-0.2, 0.7); P({ k: 'box', x, y: c.y, z: c.z + s / 2, w: s, h: 7, d: s, m: 'pillar' }); c.z += s; c.x = x; spine(x, c.y, c.z - s / 2, 0.8, 1);
        if (i === 3) gem(x, c.y, c.z - s / 2);
      }
      c.x = 0; break;
    }
    case 'blink': {
      const n = 4 + Math.round(3 * d), p = 2.6 - 0.6 * d, on = 0.62 - 0.12 * d;
      for (let i = 0; i < n; i++) {
        c.z += 1.4; const x = (i % 3 - 1) * 1.4 * d;
        plat(x, c.y, c.z + 1.5, 3, 3, { m: 'blink', bl: { p, on, ph: -i * 0.22 } }); c.z += 3; spine(x, c.y, c.z - 1.5, 1.1, 1);
        if (i === 2) gem(x, c.y, c.z - 1.5);
      }
      break;
    }
    case 'cannons': {
      const len = 16 + 4 * d, n = 3 + Math.round(2 * d), p = 2.6 - 0.7 * d;
      plat(0, c.y, c.z + len / 2, 7, len, { m: icy });
      for (let i = 0; i < n; i++) { const side = i % 2 ? 1 : -1, z = c.z + 2.4 + i * (len - 4) / n; P({ k: 'ball', x0: side * 9, x1: -side * 9, y: c.y + 0.85, z, r: 0.75, p, ph: r() }); P({ k: 'cannon', x: side * 9.4, y: c.y, z, side }); }
      gem(2.4, c.y, c.z + len * 0.5); c.z += len; spine(0, c.y, c.z, len / 4.4, 0);
      break;
    }
    case 'bumpers': {
      const len = 15 + 3 * d, n = 6 + Math.round(4 * d);
      plat(0, c.y, c.z + len / 2, 8.4, len, { m: W.jelly ? 'jelly' : 'floor' });
      for (let i = 0; i < n; i++) P({ k: 'bump', x: r.range(-3.2, 3.2), y: c.y, z: c.z + 2.2 + i * (len - 4) / n, r: 0.75 + 0.2 * r(), h: 1.3, mv: d > 0.45 && i % 2 ? { ax: [1.6, 0, 0], p: 2.8, ph: r() } : null });
      gem(-3.4, c.y, c.z + len * 0.35); c.z += len; spine(0, c.y, c.z, len / 4.6, 0);
      break;
    }
    case 'slide': {
      const n = 3 + Math.round(1.5 * d);
      for (let i = 0; i < n; i++) {
        const len = 6, x = (i % 2 ? 1 : -1) * (1.4 + 1.2 * d);
        c.z += 1 + 0.8 * d; plat(x, c.y, c.z + len / 2, 3.4 - 0.8 * d, len, { m: 'ice' }); spine(x, c.y, c.z + 0.8, 0.6, 1); c.z += len; spine(x, c.y, c.z - 0.6, 1.2, 0);
        if (i === 1) gem(x, c.y, c.z - 2);
      }
      break;
    }
    case 'gates': {
      const rows = 3 + Math.round(1.6 * d), len = rows * 4 + 2, w = 8;
      plat(0, c.y, c.z + len / 2, w, len);
      for (let j = 0; j < rows; j++) {
        const z = c.z + 2.5 + j * 4, ph = r(), p = 3.4 - 0.9 * d, gap = 2.6 - 0.7 * d, amp = 2.2;
        // two wall halves that keep a gap between them, sliding together
        P({ k: 'box', x: -(gap / 2 + 4), y: c.y + 2.2, z, w: 8, h: 2.2, d: 0.6, m: 'wall', mv: { ax: [amp, 0, 0], p, ph } });
        P({ k: 'box', x: gap / 2 + 4, y: c.y + 2.2, z, w: 8, h: 2.2, d: 0.6, m: 'wall', mv: { ax: [amp, 0, 0], p, ph } });
      }
      gem(-2.8, c.y, c.z + len - 1.4); c.z += len; spine(0, c.y, c.z, len / 3.4, 0);
      break;
    }
    // 33.19.0: the summit of every world ends with its boss
    case 'bossroll': { // الجذع العملاق: a long climb with giant logs rolling down it
      const steps = 22, rise = 0.3, depth = 1.2, z0 = c.z, y0 = c.y;
      for (let i = 0; i < steps; i++) plat(0, c.y + rise * (i + 1), c.z + depth * (i + 0.5), 9, depth, { h: 0.9 + rise * (i + 1) });
      c.z += steps * depth; c.y += steps * rise;
      for (let i = 0; i < 4; i++) P({ k: 'roll', x: 0, z0: c.z - 0.5, z1: z0, y0: c.y, y1: y0, w: 8.6, r: 1.15, p: 3.3, ph: i / 4, giant: true });
      gem(3.4, c.y, c.z - 1); spine(0, c.y, c.z, steps * depth / 3.6, 0); break;
    }
    case 'bosssweep': { // الذراع الجليدي: a wide icy ring with a low and a high arm
      const R = 8.5, z = c.z + 1 + R;
      P({ k: 'disk', x: 0, y: c.y, z, r: R, h: 1.2, w: 0, m: 'ice' });
      P({ k: 'bar', x: 0, y: c.y + 0.55, z, len: R - 0.2, r: 0.45, w: 1.5, ph: 0, arms: 2, giant: true });
      P({ k: 'bar', x: 0, y: c.y + 2.5, z, len: R - 0.8, r: 0.4, w: -1.05, ph: 0.8, arms: 1, giant: true });
      gem(-4.5, c.y, z); c.z = z + R; spine(0, c.y, z, 4, 0); spine(0, c.y, c.z, 2, 0); break;
    }
    case 'bossham': { // مطارق الحلوى: giant hammers over a wide bridge
      const len = 26; plat(0, c.y, c.z + len / 2, 6, len, { m: W.jelly ? 'jelly' : 'floor' });
      for (let i = 0; i < 4; i++) P({ k: 'ham', x: 0, y: c.y + 9, z: c.z + 3.5 + i * 6, L: 8, hr: 1.7, amp: 0.95, p: 3.2, ph: i * 0.37, giant: true });
      gem(0, c.y, c.z + len * 0.5); c.z += len; spine(0, c.y, c.z, len / 3.6, 0); break;
    }
    case 'bossspin': { // المدار: big turning discs with arms, under light gravity
      for (let i = 0; i < 3; i++) {
        const R = 4.2; c.z += 1.4; c.y += 0.6; const z = c.z + R;
        P({ k: 'disk', x: 0, y: c.y, z, r: R, h: 1, w: (i % 2 ? -1 : 1) * 0.7 });
        P({ k: 'bar', x: 0, y: c.y + 0.5, z, len: R - 0.3, r: 0.36, w: (i % 2 ? 1 : -1) * 1.3, ph: i, arms: 2, giant: true });
        c.z += R * 2; spine(0, c.y, z, 2.6, 1);
      }
      gem(2, c.y, c.z - 3); break;
    }
    case 'bossrise': { // الحمم ترتفع / الرمال المتحركة: climb before the floor catches you
      const n = 9, zStart = c.z, yStart = c.y;
      for (let i = 0; i < n; i++) { const x = (i % 3 - 1) * 2.6; c.z += 1.3; c.y += 1.05; plat(x, c.y, c.z + 1.4, 3, 2.8); c.z += 2.8; spine(x, c.y, c.z - 1.4, 0.95, 1); if (i === 4) gem(x, c.y, c.z - 1.4); }
      P({ k: 'rise', x: 0, z0: zStart + 1, z1: c.z + 1, y0: yStart - 3.5, v: 0.8 + 0.2 * d, w: 14, lava: Boolean(W.lava) }); // the reference path clears it with ~5 s to spare
      break;
    }
    default: land(6);
  }
}

/**
 * The course for a level or an online round.
 * `challenges`: ids in order; `d`: difficulty 0..1; `seed`; `world`: id; `players`: the start line.
 */
export function buildCourse({ challenges = ['steps'], d = 0.3, seed = 1, world = 'forest', players = 1 } = {}) {
  const W = worldById(world), r = rng(seed), pieces = [], S = [], G = [];
  const c = { r, d, world: W, P: (p) => { p.id = pieces.length; pieces.push(p); return p; }, S, G, x: 0, y: 0, z: 0, t: 0 };
  const cps = [];
  // the start: wide enough for eight
  const startDepth = players > 1 ? 8 : 6;
  c.P({ k: 'box', x: 0, y: 0, z: startDepth / 2 - 1, w: 12, h: 1.2, d: startDepth, m: 'start' });
  c.z = startDepth - 1; S.push({ x: 0, y: 0, z: 0, t: 0, j: 0 }); cps.push({ i: 0, x: 0, y: 0, z: 0.5 });
  challenges.forEach((kind, i) => {
    section(kind, c);
    // a resting platform and a checkpoint after every challenge
    c.z += 1.2; c.y += 0.4;
    c.P({ k: 'box', x: 0, y: c.y, z: c.z + 2.2, w: 7.5, h: 1, d: 4.4, m: i === challenges.length - 1 ? 'finish' : 'rest' });
    S.push({ x: 0, y: c.y, z: c.z + 2.2, t: (c.t += 1), j: 1 });
    if (i < challenges.length - 1) cps.push({ i: cps.length, x: 0, y: c.y, z: c.z + 2.2 });
    c.z += 4.4;
  });
  const fin = { x: 0, y: c.y, z: c.z - 1.4, w: 7 };
  // the top of the tower: a gate over the last platform
  pieces.push({ k: 'fin', id: pieces.length, ...fin });
  // three gems, spread over the course
  const gems = [];
  if (G.length) for (let i = 0; i < 3; i++) { const at = G[Math.min(G.length - 1, Math.round((i + 0.5) * G.length / 3 - 0.5))]; gems.push({ i, x: at.x + (i - 1) * 0.6, y: at.y, z: at.z }); }
  const par = Math.round(c.t * 1.35 + 6), gold = Math.round(par * 0.72);
  let low = 0; for (const p of pieces) if (p.k === 'box' || p.k === 'disk') low = Math.min(low, p.y);
  return { world: W.id, g: W.g, seed, d, challenges: challenges.slice(), pieces, spine: S, checkpoints: cps, gems, finish: fin, length: c.z, top: c.y, kill: low - 14, par, gold, nominal: c.t };
}

/** The course of a level of the solo tower. */
export const levelCourse = (n) => { const L = levelInfo(n); return buildCourse({ challenges: L.challenges, d: L.d, seed: L.seed, world: L.world }); };

/** An online round: a mix of four challenges at middling difficulty, from the room's seed. */
export function roundCourse(seed, round = 0, players = 8, { mode, world } = {}) {
  const r = rng(seed + round * 977), randomWorld = WORLDS[r.int(0, WORLDS.length - 1)].id, bag = CHALLENGE_IDS.slice(), list = [];
  const length = mode === 'sprint' ? 2 : 4;
  while (list.length < length) list.push(bag.splice(r.int(0, bag.length - 1), 1)[0]);
  return buildCourse({ challenges: list, d: 0.42 + 0.12 * round, seed: seed ^ (round * 7919), world: world || randomWorld, players });
}

/* ------------------------------------------------------------------ 33.19.0: the day and the season */
const RIYADH_MS = 3 * 3_600_000;
export const dayKey = (now = Date.now()) => new Date(now + RIYADH_MS).toISOString().slice(0, 10);
export const monthKey = (now = Date.now()) => new Date(now + RIYADH_MS).toISOString().slice(0, 7);
export const nextDayAt = (now = Date.now()) => { const d = new Date(now + RIYADH_MS); d.setUTCHours(24, 0, 0, 0); return d.getTime() - RIYADH_MS; };
const hash = (text) => { let h = 2166136261; for (const ch of String(text)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
/** One level for everybody today: four challenges in a world that changes every day. */
export function dailyLevel(day = dayKey()) {
  const seed = hash('tower-day:' + day), r = rng(seed), world = WORLDS[Math.floor(Date.parse(day + 'T00:00:00Z') / 86_400_000) % WORLDS.length].id, bag = CHALLENGE_IDS.slice(), list = [];
  while (list.length < 4) list.push(bag.splice(r.int(0, bag.length - 1), 1)[0]);
  return Object.freeze({ key: 'day:' + day, day, world, challenges: Object.freeze(list), d: 0.55, seed, title: 'مرحلة اليوم' });
}
export const dailyCourse = (day = dayKey()) => { const L = dailyLevel(day); return buildCourse({ challenges: L.challenges, d: L.d, seed: L.seed, world: L.world }); };

/** A season a month, each with its own idea, ten levels and an outfit you can only earn that month. */
export const SEASONS = Object.freeze([
  { id: 'storm', name: 'موسم العاصفة', world: 'desert', sign: ['wind', 'cannons', 'pistons'], reward: 'pinwheel', about: 'الريح ما توقف، والمدافع تطلق من الجنبين' },
  { id: 'moon', name: 'موسم القمر', world: 'space', sign: ['blink', 'lifts', 'pads'], reward: 'halo', about: 'منصات تختفي ومصاعد تحت جاذبية خفيفة' },
  { id: 'speed', name: 'موسم السرعة', world: 'forest', sign: ['conveyor', 'movers', 'gates'], reward: 'racer', about: 'كل شي يتحرك، والوقت الذهبي أقصر' },
  { id: 'giants', name: 'موسم العمالقة', world: 'lava', sign: ['hammers', 'sweeper', 'rollers'], reward: 'wings', about: 'كل مرحلة فيها عملاق، والأخيرة أكبرهم' },
]);
export function seasonOf(now = Date.now()) {
  const month = monthKey(now), [y, m] = month.split('-').map(Number), S = SEASONS[((y * 12 + m) % SEASONS.length + SEASONS.length) % SEASONS.length];
  const end = Date.UTC(y, m, 1) - RIYADH_MS;
  return Object.freeze({ ...S, month, key: S.id + ':' + month, endsAt: end });
}
export function seasonLevel(season, i) {
  const r = rng(hash(season.key + ':' + i)), others = CHALLENGE_IDS.filter((c) => !season.sign.includes(c)), list = [season.sign[i % season.sign.length]];
  while (list.length < (i < 3 ? 2 : 3)) { const pick = r.pick(i % 2 ? others : season.sign); if (!list.includes(pick)) list.push(pick); }
  if (i === 9 || season.id === 'giants' && i % 3 === 2) list.push(BOSSES[season.world].id);
  return Object.freeze({ key: season.key + ':' + i, i, world: season.world, challenges: Object.freeze(list), d: 0.3 + 0.06 * i, seed: hash(season.key + '#' + i), title: season.name + ' · ' + (i + 1) });
}
export const seasonCourse = (season, i) => { const L = seasonLevel(season, i), c = buildCourse({ challenges: L.challenges, d: L.d, seed: L.seed, world: L.world }); if (season.id === 'speed') c.gold = Math.round(c.gold * 0.9); return c; };

/* ------------------------------------------------------------------ where things are at time t */
export function offset(p, t) {
  const m = p.mv; if (!m) return [0, 0, 0];
  let s = Math.sin(TAU * (t / m.p + m.ph));
  if (m.pulse) s = s > 0 ? Math.min(1, s * 2.2) : s * 0.5; // a piston strikes fast and draws back slowly
  return [m.ax[0] * s, m.ax[1] * s, m.ax[2] * s];
}
export const blinkOn = (p, t) => !p.bl || ((((t / p.bl.p + p.bl.ph) % 1) + 1) % 1) < p.bl.on;
/** A hammer's head: the angle and the point. */
export function hammerAt(p, t) { const a = p.amp * Math.sin(TAU * (t / p.p + p.ph)); return { a, x: p.x + Math.sin(a) * p.L, y: p.y - Math.cos(a) * p.L, z: p.z }; }
export function rollAt(p, t) { const f = ((((t / p.p + p.ph) % 1) + 1) % 1); return { f, x: p.x, y: p.y0 + (p.y1 - p.y0) * f + p.r, z: p.z0 + (p.z1 - p.z0) * f }; }
export function ballAt(p, t) { const f = ((((t / p.p + p.ph) % 1) + 1) % 1); return { f, x: p.x0 + (p.x1 - p.x0) * f, y: p.y, z: p.z }; }
export const barAngle = (p, t) => p.ph + p.w * t;
export const windAt = (p, t) => p.f * Math.sin(TAU * (t / p.p + p.ph));

/** Where a runner is after `time` seconds on the course's spine (for players the server fills in). */
export function spineAt(course, time) {
  const S = course.spine; if (time <= 0) return { ...S[0], i: 0, done: false };
  for (let i = 1; i < S.length; i++) {
    if (time <= S[i].t) {
      const a = S[i - 1], b = S[i], f = (time - a.t) / Math.max(0.01, b.t - a.t);
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f + (b.j ? Math.sin(Math.PI * f) * 1.2 * b.j : 0), z: a.z + (b.z - a.z) * f, i, done: false };
    }
  }
  const last = S[S.length - 1]; return { x: last.x, y: last.y, z: course.finish.z, i: S.length - 1, done: true };
}
/** The checkpoint a z belongs to. */
export const checkpointOf = (course, z) => { let k = 0; for (const c of course.checkpoints) if (z >= c.z - 0.5) k = c.i; return k; };

/* ------------------------------------------------------------------ stars and rewards */
export const STAR_MAX = LEVELS.length * 3;
export function starsFor(course, time, gemsTaken) { if (!(time > 0)) return 0; if (time <= course.gold && gemsTaken >= 3) return 3; if (time <= course.par) return 2; return 1; }
