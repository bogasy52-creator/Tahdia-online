// Air Hockey — physics, goals and the computer opponent. Pure: no DOM, so the tests and the page share it.
// The table is always modelled upright: x runs across (0..W), y runs along (0..L).
// Player 0 defends the bottom goal (y = L), player 1 the top goal (y = 0).
export const W = 600, L = 1160;
export const GOAL_W = 230;                // the opening in each end wall
export const PUCK_R = 28, STRIKER_R = 46;
export const MAX_PUCK = 2000;             // units per second
export const WIN_SCORE = 7;
const FRICTION = 0.5;                    // fraction of speed kept per second (the air cushion is slick)
const WALL_BOUNCE = 0.92, STRIKER_BOUNCE = 1.0;
// 33.9.0: a hand's striker is where the hand is — it reaches it by the end of every frame, at the
// hand's own speed (spread over the sub-steps, so it still meets the puck on the way). Only a jump
// across the table (a finger put down somewhere else) is spread over a few frames.
export const HAND_SPEED = 6500;

export const DIFFICULTY = {
  easy: { speed: 520, react: 0.34, aim: 0.5, error: 80, attack: 0.5, slip: 0.22 },
  mid: { speed: 800, react: 0.2, aim: 0.78, error: 46, attack: 0.78, slip: 0.12 },
  hard: { speed: 1000, react: 0.1, aim: 0.92, error: 44, attack: 0.95, slip: 0.1 },
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, p) => a + (b - a) * p;

export function createGame({ mode = 'ai', difficulty = 'mid', target = WIN_SCORE, seed = 1 } = {}) {
  let s = seed >>> 0;
  const rng = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const g = {
    mode, difficulty, target, rng, time: 0, phase: 'serve', phaseT: 1.2, // serve: the puck is held a moment before it moves
    score: [0, 0], server: 0, last: 0, events: [], winner: -1, rally: 0, maxRally: 0,
    puck: { x: W / 2, y: L / 2, vx: 0, vy: 0, spin: 0 },
    // `tx, ty` is where the hand wants the striker; the striker chases it at a limited speed
    strikers: [
      { x: W / 2, y: L - 150, vx: 0, vy: 0, tx: W / 2, ty: L - 150, pid: -1 },
      { x: W / 2, y: 150, vx: 0, vy: 0, tx: W / 2, ty: 150, pid: -1 },
    ],
    ais: [{}, {}], bot: { 0: null, 1: mode === 'ai' ? difficulty : null },
  };
  placeServe(g, 0);
  return g;
}

function placeServe(g, who) {
  g.puck.x = W / 2; g.puck.y = who === 0 ? L * 0.66 : L * 0.34; g.puck.vx = g.puck.vy = 0; g.puck.spin = 0;
  g.phase = 'serve'; g.phaseT = 1.1; g.rally = 0; g.server = who;
}

// Where a striker may stand: its own half, clear of the walls.
function bounds(i) {
  return i === 0 ? { x0: STRIKER_R, x1: W - STRIKER_R, y0: L / 2 + STRIKER_R * 0.35, y1: L - STRIKER_R }
    : { x0: STRIKER_R, x1: W - STRIKER_R, y0: STRIKER_R, y1: L / 2 - STRIKER_R * 0.35 };
}

/** The step a hand's striker takes on each of `sub` sub-steps to reach the hand by the end of `dt`. */
function handStep(g, i, dt, sub) {
  const st = g.strikers[i], b = bounds(i), tx = clamp(Number.isFinite(st.tx) ? st.tx : st.x, b.x0, b.x1), ty = clamp(Number.isFinite(st.ty) ? st.ty : st.y, b.y0, b.y1);
  if (!(dt > 0) || !Number.isFinite(st.x) || !Number.isFinite(st.y)) { if (!Number.isFinite(st.x) || !Number.isFinite(st.y)) { st.x = tx; st.y = ty; } return { dx: 0, dy: 0, vx: 0, vy: 0 }; }
  let dx = tx - st.x, dy = ty - st.y; const d = Math.hypot(dx, dy), max = HAND_SPEED * dt;
  if (d > max) { dx *= max / d; dy *= max / d; }
  return { dx: dx / sub, dy: dy / sub, vx: dx / dt, vy: dy / dt };
}
function moveStriker(g, i, dt, maxSpeed) {
  const st = g.strikers[i], b = bounds(i);
  const tx = clamp(st.tx, b.x0, b.x1), ty = clamp(st.ty, b.y0, b.y1);
  const dx = tx - st.x, dy = ty - st.y, d = Math.hypot(dx, dy);
  const step = Math.min(d, maxSpeed * dt);
  const nx = d > 0.001 ? st.x + (dx / d) * step : st.x, ny = d > 0.001 ? st.y + (dy / d) * step : st.y;
  st.vx = (nx - st.x) / dt; st.vy = (ny - st.y) / dt; st.x = nx; st.y = ny;
}

function collideStriker(g, i) {
  const p = g.puck, st = g.strikers[i], dx = p.x - st.x, dy = p.y - st.y, d = Math.hypot(dx, dy), min = PUCK_R + STRIKER_R;
  if (d >= min || d === 0) return false;
  const nx = dx / d, ny = dy / d;
  p.x = st.x + nx * min; p.y = st.y + ny * min; // push the puck out of the striker
  const rel = (p.vx - st.vx) * nx + (p.vy - st.vy) * ny; // approach speed along the normal
  if (rel < 0) {
    p.vx -= (1 + STRIKER_BOUNCE) * rel * nx; p.vy -= (1 + STRIKER_BOUNCE) * rel * ny;
    // 33.9.7: the spin only turns the puck; it no longer bends its path (it swerved like a ball)
    p.spin = clamp((st.vx * -ny + st.vy * nx) * 0.004, -8, 8);
  }
  const sp = Math.hypot(p.vx, p.vy);
  if (sp > MAX_PUCK) { p.vx *= MAX_PUCK / sp; p.vy *= MAX_PUCK / sp; }
  g.last = i;
  // a real strike, not the puck resting against a striker: it must be approaching, and not just have been struck
  if (rel < -60 && g.time - (g.hitAt?.[i] || -1) > 0.12) {
    (g.hitAt ||= [-1, -1])[i] = g.time; g.rally++; g.maxRally = Math.max(g.maxRally, g.rally);
    g.events.push({ type: 'hit', who: i, power: clamp(Math.hypot(p.vx, p.vy) / MAX_PUCK, 0, 1), x: p.x - nx * PUCK_R, y: p.y - ny * PUCK_R });
  }
  return true;
}

function collideWalls(g) {
  const p = g.puck, gx0 = (W - GOAL_W) / 2, gx1 = (W + GOAL_W) / 2;
  const wall = (power, x, y) => g.events.push({ type: 'wall', power: clamp(power / MAX_PUCK, 0, 1), x, y });
  if (p.x < PUCK_R) { p.x = PUCK_R; if (p.vx < 0) { wall(-p.vx, 0, p.y); p.vx = -p.vx * WALL_BOUNCE; } }
  if (p.x > W - PUCK_R) { p.x = W - PUCK_R; if (p.vx > 0) { wall(p.vx, W, p.y); p.vx = -p.vx * WALL_BOUNCE; } }
  for (const top of [true, false]) {
    const edge = top ? PUCK_R : L - PUCK_R;
    const crossing = top ? p.y < edge : p.y > edge;
    if (!crossing) continue;
    const inGoal = p.x > gx0 + PUCK_R * 0.2 && p.x < gx1 - PUCK_R * 0.2;
    if (inGoal) continue; // the opening: the puck may pass — the goal is decided in step()
    // the goal posts are two small bumpers, then the flat wall
    const post = p.x <= gx0 + PUCK_R * 0.2 ? gx0 : gx1, dx = p.x - post, dy = p.y - (top ? 0 : L), d = Math.hypot(dx, dy);
    if (d < PUCK_R && Math.abs(dx) < PUCK_R && Math.abs(p.y - (top ? 0 : L)) < PUCK_R * 0.9 && (p.x < gx0 || p.x > gx1)) {
      const nx = dx / (d || 1), ny = dy / (d || 1), vn = p.vx * nx + p.vy * ny;
      if (vn < 0) { p.vx -= 2 * vn * nx * WALL_BOUNCE; p.vy -= 2 * vn * ny * WALL_BOUNCE; wall(-vn, p.x, p.y); }
      p.x = post + nx * PUCK_R; p.y = (top ? 0 : L) + ny * PUCK_R;
    } else { p.y = edge; if (top ? p.vy < 0 : p.vy > 0) { wall(Math.abs(p.vy), p.x, top ? 0 : L); p.vy = -p.vy * WALL_BOUNCE; } }
  }
}

// ----- the computer opponent -----
// One routine drives either striker: for the bottom one the table is mirrored so it always "sees" itself at the top.
function runAI(g, idx, dt, level) {
  const d = DIFFICULTY[level] || DIFFICULTY.mid, a = (g.ais ||= [{}, {}])[idx];
  if (a.wantX === undefined) Object.assign(a, { think: 0, wantX: W / 2, wantY: idx ? 150 : L - 150, mode: 'idle' });
  const f = idx === 0, st = g.strikers[idx], P = g.puck;
  const p = { x: P.x, y: f ? L - P.y : P.y, vx: P.vx, vy: f ? -P.vy : P.vy }, me = { x: st.x, y: f ? L - st.y : st.y };
  a.think -= dt;
  if (a.think <= 0) {
    a.think = d.react * (0.7 + g.rng() * 0.6);
    const cx = W / 2, homeY = 150 + (1 - d.aim) * 90, sloppy = g.rng() < d.slip ? 2.6 : 1;
    const speed = Math.hypot(p.vx, p.vy), onMySide = p.y < L / 2, behind = p.y < me.y - 8 && Math.abs(p.x - me.x) < 110;
    const incoming = p.vy < -60;
    if (onMySide && speed < 520 && !behind && g.rng() < d.attack) {
      a.mode = 'attack';
      const aimX = g.rng() < 0.45 ? (g.rng() < 0.5 ? 110 : W - 110) : cx + (g.rng() - 0.5) * GOAL_W * 0.7;
      const dirx = aimX - p.x, diry = L - p.y, dl = Math.hypot(dirx, diry) || 1, reach = STRIKER_R + PUCK_R - 8;
      a.wantX = p.x - (dirx / dl) * reach + (g.rng() - 0.5) * d.error * sloppy; a.wantY = p.y - (diry / dl) * reach;
    } else if (incoming) {
      a.mode = 'defend';
      const lineY = clamp(me.y, 80, L / 2 - 70), t = (lineY - p.y) / p.vy, span = W - 2 * PUCK_R;
      let px = p.x + p.vx * t; px = ((px - PUCK_R) % (2 * span) + 2 * span) % (2 * span); if (px > span) px = 2 * span - px; px += PUCK_R;
      a.wantX = lerp(cx, px, d.aim) + (g.rng() - 0.5) * d.error * 2 * sloppy; a.wantY = lerp(homeY, lineY, 0.55);
    } else { a.mode = 'idle'; a.wantX = lerp(cx, p.x, 0.5 * d.aim); a.wantY = homeY; }
  }
  st.tx = a.wantX; st.ty = f ? L - a.wantY : a.wantY;
  moveStriker(g, idx, dt, d.speed * (a.mode === 'attack' ? 1.2 : 1));
}

/**
 * One frame. `predict` is the online page between two words of the room: the puck and the hands move
 * and meet as here, but the room alone scores, serves and ends the match (its phase is left alone).
 */
export function step(g, dt, controls = {}, { predict = false } = {}) {
  g.events.length = 0;
  // a frame of no time (or a clock that stepped back) moves nothing
  if (!(dt > 0)) return g;
  dt = Math.min(dt, 1 / 20);
  g.time += dt;
  // hands first: the page writes strikers[i].tx / ty directly; `controls` lets tests drive them
  if (controls.p0) { g.strikers[0].tx = controls.p0.x; g.strikers[0].ty = controls.p0.y; }
  if (controls.p1) { g.strikers[1].tx = controls.p1.x; g.strikers[1].ty = controls.p1.y; }
  if (predict && g.phase !== 'play') { for (const i of [0, 1]) { const m = handStep(g, i, dt, 1), st = g.strikers[i]; st.x += m.dx; st.y += m.dy; st.vx = m.vx; st.vy = m.vy; } return g; }
  if (g.phase === 'over') return g;
  if (g.phase === 'goal') { g.phaseT -= dt; for (const i of [0, 1]) { if (g.bot[i]) { g.strikers[i].tx = W / 2; g.strikers[i].ty = i ? 150 : L - 150; } moveStriker(g, i, dt, 1000); }
    if (g.phaseT <= 0) { if (g.score[0] >= g.target || g.score[1] >= g.target) { g.phase = 'over'; g.winner = g.score[0] > g.score[1] ? 0 : 1; g.events.push({ type: 'over', winner: g.winner }); } else placeServe(g, g.conceded); }
    return g; }
  if (g.phase === 'serve') { g.phaseT -= dt; if (g.phaseT <= 0) { g.phase = 'play'; g.events.push({ type: 'play' }); } }
  const sub = Math.max(1, Math.ceil(dt / (1 / 240)));
  const h = dt / sub, hand = [0, 1].map((i) => (g.bot[i] ? null : handStep(g, i, dt, sub)));
  for (let k = 0; k < sub; k++) {
    for (const i of [0, 1]) { if (g.bot[i]) runAI(g, i, h, g.bot[i]); else { const st = g.strikers[i], m = hand[i]; st.x += m.dx; st.y += m.dy; st.vx = m.vx; st.vy = m.vy; } }
    const p = g.puck;
    if (g.phase === 'play' || g.phase === 'serve') {
      if (g.phase === 'play') { p.x += p.vx * h; p.y += p.vy * h; const f = Math.pow(FRICTION, h); p.vx *= f; p.vy *= f; p.spin *= Math.pow(0.5, h); }
      collideWalls(g);
      collideStriker(g, 0); collideStriker(g, 1);
      // keep a stalled puck from sitting in a corner for ever
      if (g.phase === 'play' && Math.hypot(p.vx, p.vy) < 25) { g.idle = (g.idle || 0) + h; if (g.idle > 5 && g.rally === 0) { p.vy += (p.y < L / 2 ? 1 : -1) * 60; } } else g.idle = 0;
      if (g.phase === 'play') {
        const gx0 = (W - GOAL_W) / 2, gx1 = (W + GOAL_W) / 2;
        // a prediction leaves the goal to the room: the puck stops in the mouth of the goal
        if (predict) { if (p.y > L + PUCK_R * 0.5 || p.y < -PUCK_R * 0.5) { p.y = clamp(p.y, -PUCK_R, L + PUCK_R); p.vx = p.vy = 0; } }
        else if (p.y > L + PUCK_R * 0.5 && p.x > gx0 && p.x < gx1) scoreGoal(g, 1, 0);
        else if (p.y < -PUCK_R * 0.5 && p.x > gx0 && p.x < gx1) scoreGoal(g, 0, 1);
      }
    }
    if (g.phase === 'goal') break;
  }
  return g;
}

/** 33.9.0: a puck alone on the table for `t` seconds — the walls and the air, no strikers. The online
    page carries the room's puck on to "now" with it before it compares it with its own. */
export function carryPuck(puck, t) {
  const g = { puck: { ...puck, spin: puck.spin || 0 }, events: [] }, p = g.puck, sub = Math.max(1, Math.ceil(Math.max(0, t) / (1 / 240))), h = Math.max(0, t) / sub;
  for (let k = 0; k < sub && h > 0; k++) {
    p.x += p.vx * h; p.y += p.vy * h; const f = Math.pow(FRICTION, h); p.vx *= f; p.vy *= f; p.spin *= Math.pow(0.5, h);
    collideWalls(g); p.y = clamp(p.y, -PUCK_R, L + PUCK_R);
  }
  return p;
}

function scoreGoal(g, scorer, conceded) {
  g.score[scorer]++; g.conceded = conceded; g.phase = 'goal'; g.phaseT = 1.8; g.lastScorer = scorer;
  g.events.push({ type: 'goal', scorer, score: g.score.slice(), x: g.puck.x, speed: Math.hypot(g.puck.vx, g.puck.vy) });
  g.puck.vx *= 0.15; g.puck.vy *= 0.15;
}
