/* Tahdia 33.9.0 — 8-ball pool (بلياردو): the table, the physics, the rules and the computer player.
   One module for the page (practice, two on one phone) and the server (online tables in BoardRoom).

   The table is a 9-foot table in centimetres: 254 × 127, balls of 5.715 cm. A shot is simulated in
   fixed steps of 1/60 s (light enough for a Durable Object, one frame each on the page); inside a
   step every contact (ball, cushion, jaw, pocket) is found exactly
   by its time of impact, so a fast ball never passes through another and a cut goes where the
   guide line said. The simulation uses only + − × ÷ and Math.sqrt, which every JavaScript engine
   computes the same, so the server's shot replays on each phone to the same final positions.

   Balls: 0 the cue ball, 1–7 solids (السادة), 8 the black, 9–15 stripes (المخططة).
   Rules (as the popular mobile games play them): the break from the kitchen (behind the head
   string); an open table until someone pots a ball of a group; a ball of your group first, then a
   ball potted or any ball to a cushion; a foul gives the other player the cue ball anywhere; the 8
   wins once your group is cleared, and loses if it drops early or with a foul (on the break it is
   spotted again). */

export const POOL = Object.freeze({ L: 254, W: 127, R: 2.8575, DT: 1 / 60, FRAME: 1 / 60, MIN_SPEED: 30, MAX_SPEED: 800, MAX_TIME: 16 });
const L = POOL.L, W = POOL.W, R = POOL.R, D = 2 * R, D2 = D * D, DT = POOL.DT;
const ROLL = 18, DRAG = 0.42, STOP = 0.6;           // rolling resistance (cm/s²), drag (1/s), stop speed (cm/s)
const BALL_E = 0.94, RAIL_E = 0.76, RAIL_GRIP = 0.97; // restitution between balls and off the cushions
const BEND = 900, TOP_KEEP = 0.62, SIDE_KICK = 0.3;   // follow/draw and side spin
const SQRT3 = 1.7320508075688772;
export const HEAD_X = L / 4, FOOT = Object.freeze([L * 0.75, W / 2]);

/* ---------- the table: cushions, jaws and pockets ---------- */
const CM = 9.4, SM = 6.6;                     // the corner and side mouths (from the corner / the middle)
const seg = (ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, len = Math.sqrt(dx * dx + dy * dy); return { ax, ay, bx, by, tx: dx / len, ty: dy / len, len }; };
function buildWalls() {
  const s = [], mid = L / 2;
  // the six cushions (their noses)
  s.push(seg(CM, 0, mid - SM, 0), seg(mid + SM, 0, L - CM, 0), seg(CM, W, mid - SM, W), seg(mid + SM, W, L - CM, W), seg(0, CM, 0, W - CM), seg(L, CM, L, W - CM));
  // the jaws into each pocket
  const j = 4.2;
  s.push(seg(CM, 0, CM - j, -j), seg(0, CM, -j, CM - j), seg(L - CM, 0, L - CM + j, -j), seg(L, CM, L + j, CM - j));
  s.push(seg(CM, W, CM - j, W + j), seg(0, W - CM, -j, W - CM + j), seg(L - CM, W, L - CM + j, W + j), seg(L, W - CM, L + j, W - CM + j));
  s.push(seg(mid - SM, 0, mid - SM + 1.1, -5.2), seg(mid + SM, 0, mid + SM - 1.1, -5.2), seg(mid - SM, W, mid - SM + 1.1, W + 5.2), seg(mid + SM, W, mid + SM - 1.1, W + 5.2));
  return s;
}
export const WALLS = Object.freeze(buildWalls());
// the shape the page draws: corner and side mouths, jaw depths
export const SHAPE = Object.freeze({ corner: CM, side: SM, jaw: 4.2, sideJaw: Object.freeze([1.1, 5.2]) });
// pocket centres and the radius a ball's centre must reach to drop
export const POCKETS = Object.freeze([
  { x: -0.6, y: -0.6, r: 7.6, side: false }, { x: L / 2, y: -3, r: 6.2, side: true }, { x: L + 0.6, y: -0.6, r: 7.6, side: false },
  { x: -0.6, y: W + 0.6, r: 7.6, side: false }, { x: L / 2, y: W + 3, r: 6.2, side: true }, { x: L + 0.6, y: W + 0.6, r: 7.6, side: false },
].map(Object.freeze));
// where a computer player aims to pot into each pocket (a little inside the mouth)
const AIM = Object.freeze([[2.2, 2.2], [L / 2, -0.6], [L - 2.2, 2.2], [2.2, W - 2.2], [L / 2, W + 0.6], [L - 2.2, W - 2.2]]);

export const groupOf = (n) => (n >= 1 && n <= 7 ? 'solid' : n >= 9 && n <= 15 ? 'stripe' : null);
export const GROUP_NAME = Object.freeze({ solid: 'السادة', stripe: 'المخططة' });

/* ---------- the rack ---------- */
export function rackBalls(rng = Math.random) {
  const balls = Array(16).fill(null);
  balls[0] = [HEAD_X - 10, W / 2];
  const spots = [];
  for (let row = 0; row < 5; row++) for (let k = 0; k <= row; k++) spots.push([FOOT[0] + row * (R * SQRT3 + 0.02), FOOT[1] + (k - row / 2) * (D + 0.02)]);
  // the 8 in the middle of the third row, a solid and a stripe in the back corners, the rest at random
  const solids = [1, 2, 3, 4, 5, 6, 7], stripes = [9, 10, 11, 12, 13, 14, 15];
  const take = (list) => list.splice(Math.floor(rng() * list.length), 1)[0];
  const order = Array(15).fill(0);
  order[4] = 8;
  const solidBack = rng() < 0.5;
  order[10] = solidBack ? take(solids) : take(stripes);
  order[14] = solidBack ? take(stripes) : take(solids);
  const rest = [...solids, ...stripes];
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  for (let i = 0; i < 15; i++) if (!order[i]) order[i] = rest.pop();
  order.forEach((n, i) => { balls[n] = spots[i].slice(); });
  return balls;
}

/* ---------- the physics ---------- */
// Each wall's box grown by a ball radius, and each pocket's box, to skip the far ones quickly.
const WALL_BOX = WALLS.map((w) => [Math.min(w.ax, w.bx) - R, Math.max(w.ax, w.bx) + R, Math.min(w.ay, w.by) - R, Math.max(w.ay, w.by) + R]);
const POCKET_BOX = POCKETS.map((p) => [p.x - p.r, p.x + p.r, p.y - p.r, p.y + p.r]);
let hitT = 0, hitNx = 0, hitNy = 0;
// When a moving ball first touches a cushion line or a jaw tip (within tmax): sets hitT/hitNx/hitNy.
function wallTOI(b, w, tmax) {
  const px = b.x - w.ax, py = b.y - w.ay, along = px * w.tx + py * w.ty;
  let nx = -w.ty, ny = w.tx, dist = px * nx + py * ny;
  if (dist < 0) { nx = -nx; ny = -ny; dist = -dist; }
  let found = false, best = tmax;
  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) {
    const t = dist <= R ? 0 : (dist - R) / -vn;
    if (t <= best) {
      const at = along + (b.vx * w.tx + b.vy * w.ty) * t;
      if (at >= 0 && at <= w.len && (dist > R - 1e-9 || (at > 0 && at < w.len))) { found = true; best = t; hitNx = nx; hitNy = ny; }
    }
  }
  for (let k = 0; k < 2; k++) {
    const ex = k ? w.bx : w.ax, ey = k ? w.by : w.ay;
    const t = circleTOI(b.x - ex, b.y - ey, b.vx, b.vy, R);
    if (t !== null && t <= best && (!found || t < best)) {
      const cx = b.x + b.vx * t - ex, cy = b.y + b.vy * t - ey, len = Math.sqrt(cx * cx + cy * cy) || 1;
      found = true; best = t; hitNx = cx / len; hitNy = cy / len;
    }
  }
  if (found) hitT = best;
  return found;
}
// when a point at (dx, dy) moving at (vx, vy) first comes within `reach` of the origin (approaching only)
function circleTOI(dx, dy, vx, vy, reach) {
  const b = dx * vx + dy * vy;
  if (b >= 0) return null;
  const a = vx * vx + vy * vy, c = dx * dx + dy * dy - reach * reach;
  if (c <= 0) return 0;
  const disc = b * b - a * c;
  if (disc < 0) return null;
  return (-b - Math.sqrt(disc)) / a;
}

// Every touching pair that still closes in gets its push, pass after pass, until none does: the
// impulse spreads through a rack the way it does on a real table instead of one ball at a time.
const TOUCH = D + 0.06;
function settle(ball) {
  const pushes = [];
  for (let pass = 0; pass < 16; pass++) {
    let any = false;
    for (let i = 0; i < ball.length; i++) {
      const a = ball[i]; if (a.in) continue;
      for (let j = i + 1; j < ball.length; j++) {
        const b = ball[j]; if (b.in || (!a.moving && !b.moving)) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        if (dx > TOUCH || dx < -TOUCH || dy > TOUCH || dy < -TOUCH) continue;
        const d2 = dx * dx + dy * dy; if (d2 > TOUCH * TOUCH) continue;
        const len = Math.sqrt(d2) || 1, nx = dx / len, ny = dy / len, rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (rel <= 1e-6) continue;
        const k = (1 + BALL_E) / 2 * rel;
        a.vx -= k * nx; a.vy -= k * ny; b.vx += k * nx; b.vy += k * ny; a.moving = true; b.moving = true;
        pushes.push([a, b, rel]); any = true;
      }
    }
    if (!any) break;
  }
  return pushes;
}

/**
 * Plays one shot. `balls` are the positions before it (index = ball number, null = off the table);
 * shot = { dir:[x,y] (unit), speed, spin:[side, top] }. Returns the final positions, what happened
 * (the first ball the cue ball touched, cushions after it, the potted balls in order) and, when
 * asked, frames every 1/60 s and timed events for the page to animate and sound.
 */
export function simulate(start, shot, { record = false } = {}) {
  const ball = [];
  for (let n = 0; n < 16; n++) if (start[n]) ball.push({ n, x: start[n][0], y: start[n][1], vx: 0, vy: 0, moving: false, in: false, pocket: -1 });
  const cue = ball.find((b) => b.n === 0);
  const out = { first: null, rail: false, railBeforeHit: false, potted: [], pockets: [], events: [], frames: record ? [] : null, ms: 0, cueHits: 0 };
  if (!cue) throw new Error('no_cue_ball');
  cue.vx = shot.dir[0] * shot.speed; cue.vy = shot.dir[1] * shot.speed; cue.moving = shot.speed > 0;
  let top = Number(shot.spin?.[1]) || 0, side = Number(shot.spin?.[0]) || 0, pend = 0, pdx = 0, pdy = 0;
  let t = 0, nextFrame = 0;
  const snap = () => { const f = new Array(16).fill(null); for (const b of ball) if (!b.in) f[b.n] = [b.x, b.y]; out.frames.push(f); };
  if (record) { snap(); nextFrame += POOL.FRAME; }
  const ev = (type, a, b, speed) => { if (record) out.events.push({ t: Math.round(t * 1000), type, a, b, speed: Math.round(speed) }); };
  let steps = 0;
  const nB = ball.length, spd = new Float64Array(nB);
  while (t < POOL.MAX_TIME) {
    let any = false;
    for (let i = 0; i < nB; i++) if (ball[i].moving) { any = true; break; }
    if (!any) break;
    let left = DT, iter = 0;
    while (left > 1e-12 && iter++ < 96) {
      let when = left, hit = null;
      for (let i = 0; i < nB; i++) { const b = ball[i]; spd[i] = b.moving ? Math.sqrt(b.vx * b.vx + b.vy * b.vy) : 0; }
      for (let i = 0; i < nB; i++) {
        const a = ball[i];
        if (!a.moving || a.in) continue;
        const reachA = spd[i] * left;
        // other balls (a pair of moving balls is looked at once)
        for (let j = 0; j < nB; j++) {
          if (j === i) continue;
          const b = ball[j];
          if (b.in || (b.moving && j < i)) continue;
          const dx = b.x - a.x, dy = b.y - a.y, reach = D + reachA + spd[j] * left + 0.01;
          if (dx > reach || dx < -reach || dy > reach || dy < -reach) continue;
          const tt = circleTOI(a.x - b.x, a.y - b.y, a.vx - b.vx, a.vy - b.vy, D);
          if (tt !== null && tt <= when) { when = tt; hit = { kind: 'ball', a, b }; }
        }
        // cushions, jaws and pockets whose box the ball can reach in this step
        const x0 = a.x - reachA, x1 = a.x + reachA, y0 = a.y - reachA, y1 = a.y + reachA;
        if (x0 > R && x1 < L - R && y0 > R && y1 < W - R && x0 > 9 && x1 < L - 9 && !(x1 > L / 2 - 9 && x0 < L / 2 + 9 && (y0 < 7 || y1 > W - 7))) {
          // well inside the cushions and away from every pocket
        } else {
          for (let k = 0; k < WALLS.length; k++) {
            const box = WALL_BOX[k];
            if (x1 < box[0] || x0 > box[1] || y1 < box[2] || y0 > box[3]) continue;
            if (wallTOI(a, WALLS[k], when) && hitT <= when) { when = hitT; hit = { kind: 'wall', a, nx: hitNx, ny: hitNy }; }
          }
          for (let p = 0; p < POCKETS.length; p++) {
            const box = POCKET_BOX[p];
            if (x1 < box[0] || x0 > box[1] || y1 < box[2] || y0 > box[3]) continue;
            const pk = POCKETS[p], tt = circleTOI(a.x - pk.x, a.y - pk.y, a.vx, a.vy, pk.r);
            if (tt !== null && tt <= when) { when = tt; hit = { kind: 'pocket', a, p }; }
          }
        }
      }
      for (const b of ball) if (b.moving) { b.x += b.vx * when; b.y += b.vy * when; }
      left -= when; t += when;
      if (!hit) break;
      const a = hit.a;
      if (hit.kind === 'ball') {
        const b = hit.b;
        let nx = b.x - a.x, ny = b.y - a.y; const len = Math.sqrt(nx * nx + ny * ny) || 1; nx /= len; ny /= len;
        const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (rel <= 0) continue;
        const cueIn = a === cue ? a : b === cue ? b : null;
        let inSpeed = 0, idx = 0, idy = 0;
        if (cueIn && out.first === null) { inSpeed = Math.sqrt(cue.vx * cue.vx + cue.vy * cue.vy); idx = cue.vx / (inSpeed || 1); idy = cue.vy / (inSpeed || 1); }
        const j = (1 + BALL_E) / 2 * rel;
        a.vx -= j * nx; a.vy -= j * ny; b.vx += j * nx; b.vy += j * ny;
        a.moving = true; b.moving = true;
        if (cueIn) {
          out.cueHits++;
          if (out.first === null) {
            out.first = (cueIn === a ? b : a).n;
            // follow or draw: the spin left on the cue ball pulls it along the line of the shot
            pend = top * inSpeed * TOP_KEEP; pdx = idx; pdy = idy; top = 0;
          }
          side *= 0.8;
        }
        ev('ball', a.n, b.n, rel);
        // the balls touching these (a rack, a frozen cluster) share the push at the same instant
        for (const [p, q, push] of settle(ball)) { if (p === cue || q === cue) out.cueHits++; if (push > 25) ev('ball', p.n, q.n, push); }
      } else if (hit.kind === 'wall') {
        const vn = a.vx * hit.nx + a.vy * hit.ny;
        if (vn >= 0) continue;
        const sp = Math.sqrt(a.vx * a.vx + a.vy * a.vy) || 1, ix = a.vx / sp, iy = a.vy / sp;
        let vx = a.vx - (1 + RAIL_E) * vn * hit.nx, vy = a.vy - (1 + RAIL_E) * vn * hit.ny;
        const tn = vx * hit.nx + vy * hit.ny;
        vx = tn * hit.nx + (vx - tn * hit.nx) * RAIL_GRIP; vy = tn * hit.ny + (vy - tn * hit.ny) * RAIL_GRIP;
        if (a === cue && side !== 0) {
          // side spin: the ball comes off the cushion towards the side it was hit on
          const kick = side * SIDE_KICK * -vn;
          vx += -iy * kick; vy += ix * kick;
          side *= 0.55;
        }
        if (a === cue) top *= 0.6;
        a.vx = vx; a.vy = vy;
        if (out.first !== null) out.rail = true; else if (a === cue) out.railBeforeHit = true;
        ev('rail', a.n, -1, -vn);
      } else {
        a.in = true; a.moving = false; a.vx = 0; a.vy = 0; a.pocket = hit.p;
        out.potted.push(a.n); out.pockets.push(hit.p);
        ev('pocket', a.n, hit.p, 0);
      }
    }
    // the cloth slows every moving ball; spin bends the cue ball
    for (const b of ball) {
      if (!b.moving) continue;
      if (b === cue && pend !== 0) {
        const step = Math.min(pend > 0 ? pend : -pend, BEND * DT), sign = pend > 0 ? 1 : -1;
        b.vx += pdx * step * sign; b.vy += pdy * step * sign; pend -= step * sign;
        if ((pend > 0 ? pend : -pend) < 1e-9) pend = 0;
      }
      if (b === cue && out.first === null && top !== 0) top -= top * 0.5 * DT;
      const s = Math.sqrt(b.vx * b.vx + b.vy * b.vy), dec = (ROLL + DRAG * s) * DT;
      if (s <= dec + STOP * DT && !(b === cue && pend !== 0)) { b.vx = 0; b.vy = 0; b.moving = false; continue; }
      if (s <= dec) { b.vx = 0; b.vy = 0; continue; }
      const f = (s - dec) / s; b.vx *= f; b.vy *= f;
    }
    t = (++steps) * DT;
    if (record) while (t + 1e-9 >= nextFrame) { snap(); nextFrame += POOL.FRAME; }
  }
  const end = new Array(16).fill(null);
  for (const b of ball) if (!b.in) end[b.n] = [b.x, b.y];
  out.balls = end;
  out.ms = Math.round(t * 1000);
  if (record) snap();
  return out;
}

/* ---------- the match ---------- */
export function createPoolGame(names, { rng = Math.random, first = 0 } = {}) {
  return {
    game: 'pool', v: 1,
    players: names.slice(0, 2).map((name) => ({ name: String(name || 'لاعب'), group: null })),
    balls: rackBalls(rng),
    turn: first, phase: 'break', inHand: true, kitchen: true, open: true, winner: null,
    shots: 0, shotsBySeat: [0, 0], fouls: [0, 0], last: null, shot: null,
  };
}
const clone = (s) => JSON.parse(JSON.stringify(s));
const onTable = (state, n) => Boolean(state.balls[n]);
export const remaining = (state, group) => [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15].filter((n) => groupOf(n) === group && onTable(state, n));
/** The balls this player may hit first. */
export function legalTargets(state, seat = state.turn) {
  if (state.phase === 'break') return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].filter((n) => onTable(state, n));
  const group = state.players[seat]?.group;
  if (!group) return [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15].filter((n) => onTable(state, n));
  const mine = remaining(state, group);
  return mine.length ? mine : [8];
}
export const onEight = (state, seat = state.turn) => Boolean(state.players[seat]?.group) && !remaining(state, state.players[seat].group).length;

/** Whether the cue ball may be put here (ball in hand; behind the head string on the break). */
export function canPlace(state, x, y, kitchen = state.kitchen) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  if (x < R || x > L - R || y < R || y > W - R) return false;
  if (kitchen && x > HEAD_X) return false;
  for (const pk of POCKETS) { const dx = pk.x - x, dy = pk.y - y; if (dx * dx + dy * dy < (pk.r + 1.5) * (pk.r + 1.5)) return false; }
  for (let n = 1; n < 16; n++) { const b = state.balls[n]; if (!b) continue; const dx = b[0] - x, dy = b[1] - y; if (dx * dx + dy * dy < (D + 0.05) * (D + 0.05)) return false; }
  return true;
}
/** A free spot for the cue ball near (x, y) (used when the page drops it on another ball). */
export function nearestPlace(state, x, y, kitchen = state.kitchen) {
  const cx = Math.min(kitchen ? HEAD_X : L - R, Math.max(R, x)), cy = Math.min(W - R, Math.max(R, y));
  if (canPlace(state, cx, cy, kitchen)) return [cx, cy];
  for (let r = 1; r < 60; r += 1) for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2, px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
    if (canPlace(state, px, py, kitchen)) return [px, py];
  }
  return null;
}

/** Power (0–1) to the cue ball's speed in cm/s: fine at the bottom, strong at the top. */
export const speedOf = (power) => { const p = Math.max(0, Math.min(1, Number(power) || 0)); return POOL.MIN_SPEED + (POOL.MAX_SPEED - POOL.MIN_SPEED) * (0.45 * p + 0.55 * p * p); };
export const powerFor = (speed) => { const k = Math.max(0, Math.min(1, (speed - POOL.MIN_SPEED) / (POOL.MAX_SPEED - POOL.MIN_SPEED))); return Math.max(0, Math.min(1, (-0.45 + Math.sqrt(0.2025 + 2.2 * k)) / 1.1)); };

/** Cleans a shot from a player: a unit direction, power 0–1, spin inside the cue ball, the cue placement. */
export function cleanShot(state, input = {}) {
  let dx = Number(input.dir?.[0]), dy = Number(input.dir?.[1]);
  if (Number.isFinite(Number(input.angle))) { dx = Math.cos(Number(input.angle)); dy = Math.sin(Number(input.angle)); }
  const len = Math.sqrt(dx * dx + dy * dy);
  if (!Number.isFinite(len) || len < 1e-6) throw new Error('invalid_shot');
  const power = Number(input.power);
  if (!Number.isFinite(power) || power <= 0 || power > 1) throw new Error('invalid_shot');
  let sx = Number(input.spin?.[0] ?? 0), sy = Number(input.spin?.[1] ?? 0);
  if (!Number.isFinite(sx) || !Number.isFinite(sy)) throw new Error('invalid_shot');
  const scale = Math.max(1, Math.abs(sx), Math.abs(sy));
  sx /= scale; sy /= scale;
  const sl = Math.hypot(sx, sy);
  if (sl > 1) { sx /= sl; sy /= sl; }
  let cue = state.balls[0];
  if (state.inHand && Array.isArray(input.cue)) {
    const [x, y] = input.cue.map(Number);
    if (!canPlace(state, x, y)) throw new Error('bad_place');
    cue = [x, y];
  } else if (state.inHand && !cue) throw new Error('place_first');
  if (!cue) throw new Error('place_first');
  return { dir: [dx / len, dy / len], speed: speedOf(power), power, spin: [Math.round(sx * 100) / 100, Math.round(sy * 100) / 100], cue: [cue[0], cue[1]] };
}

/** Plays a shot for `seat` and applies the rules. Returns the next state (the input is untouched). */
export function playPoolShot(state, seat, input) {
  if (state.winner !== null && state.winner !== undefined) throw new Error('match_over');
  if (seat !== state.turn) throw new Error('wrong_turn');
  const shot = cleanShot(state, input);
  const next = clone(state);
  const before = next.balls.map((b) => (b ? b.slice() : null));
  before[0] = shot.cue.slice();
  const sim = simulate(before, shot);
  const other = 1 - seat, me = next.players[seat], wasBreak = next.phase === 'break', targets = legalTargets(state, seat), wasOnEight = onEight(state, seat);
  next.balls = sim.balls;
  const potted = sim.potted, cueIn = potted.includes(0), objects = potted.filter((n) => n !== 0), eight = objects.includes(8);
  let foul = null;
  if (sim.first === null) foul = 'no_hit';
  else if (!targets.includes(sim.first)) foul = sim.first === 8 ? 'eight_first' : 'wrong_first';
  else if (!objects.length && !sim.rail) foul = 'no_rail';
  if (cueIn) foul = 'scratch';
  const last = { seq: state.shots + 1, by: seat, potted: objects, first: sim.first, rail: sim.rail, foul, group: null, result: 'pass', ms: sim.ms, spotted: false };
  next.shots = state.shots + 1;
  // Old room snapshots know only the overall total; do not invent their earlier seat history.
  if (Array.isArray(next.shotsBySeat)) next.shotsBySeat[seat] += 1;
  if (foul) next.fouls[seat] += 1;
  next.shot = { seq: next.shots, by: seat, cue: shot.cue, dir: shot.dir, speed: shot.speed, spin: shot.spin, before };
  next.phase = 'play';
  next.kitchen = false;
  if (cueIn) next.balls[0] = null;
  if (eight && wasBreak) {
    // the 8 on the break comes back to the foot spot (or the nearest free place behind it)
    let x = FOOT[0], y = FOOT[1];
    const free = () => [...Array(16).keys()].every((n) => { const b = next.balls[n]; if (n === 8 || !b) return true; const dx = b[0] - x, dy = b[1] - y; return dx * dx + dy * dy >= (D + 0.05) * (D + 0.05); });
    while (!free() && x < L - R) x += 0.5;
    next.balls[8] = [x, y];
    last.spotted = true;
  } else if (eight) {
    next.winner = wasOnEight && !foul ? seat : other;
    last.result = next.winner === seat ? 'win' : 'loss';
    next.phase = 'over';
    next.inHand = false;
    next.last = last;
    return next;
  }
  // the first ball of a group potted (not on the break) decides the groups
  if (next.open && !wasBreak && !foul) {
    const firstGroup = objects.map(groupOf).find(Boolean);
    if (firstGroup) {
      me.group = firstGroup; next.players[other].group = firstGroup === 'solid' ? 'stripe' : 'solid';
      next.open = false; last.group = firstGroup;
    }
  }
  const mine = me.group ? objects.filter((n) => groupOf(n) === me.group) : objects.filter((n) => n !== 8);
  if (foul) {
    next.turn = other; next.inHand = true; last.result = 'foul';
  } else if (mine.length || (wasBreak && objects.length)) {
    next.turn = seat; next.inHand = false; last.result = 'again';
  } else {
    next.turn = other; next.inHand = false; last.result = 'pass';
  }
  next.last = last;
  return next;
}

/** Time ran out: a foul, the other player gets the cue ball in hand (on the break: their break). */
export function poolTimeout(state) {
  if (state.winner !== null && state.winner !== undefined) return state;
  const next = clone(state), seat = state.turn;
  next.fouls[seat] += 1;
  next.turn = 1 - seat;
  next.inHand = true;
  next.kitchen = state.phase === 'break';
  next.shot = null;
  next.last = { seq: state.shots, by: seat, potted: [], first: null, rail: false, foul: 'time', group: null, result: 'foul', ms: 0, spotted: false };
  return next;
}

/** How far a seat got: its group cleared (7), and the black on top. */
export function poolProgress(state, seat) {
  const group = state?.players?.[seat]?.group;
  if (state?.winner === seat) return 8;
  if (!group) return 0;
  return 7 - remaining(state, group).length;
}

/* ---------- the guide line ---------- */
/** Where the cue ball goes along `dir`: the first ball it meets (with the ghost ball and both
    balls' paths after the hit), or the cushion. */
export function aimGuide(balls, from, dir) {
  const [cx, cy] = from, [dx, dy] = dir;
  let best = Infinity, hit = null;
  for (let n = 1; n < 16; n++) {
    const b = balls[n]; if (!b) continue;
    const t = rayCircle(cx, cy, dx, dy, b[0], b[1], D);
    if (t !== null && t < best) { best = t; hit = n; }
  }
  // the cushions as the box the ball centre lives in
  let wall = Infinity, wx = 0, wy = 0;
  if (dx > 0) { const t = (L - R - cx) / dx; if (t < wall) { wall = t; wx = -1; wy = 0; } }
  if (dx < 0) { const t = (R - cx) / dx; if (t < wall) { wall = t; wx = 1; wy = 0; } }
  if (dy > 0) { const t = (W - R - cy) / dy; if (t < wall) { wall = t; wx = 0; wy = -1; } }
  if (dy < 0) { const t = (R - cy) / dy; if (t < wall) { wall = t; wx = 0; wy = 1; } }
  if (hit !== null && best <= wall) {
    const gx = cx + dx * best, gy = cy + dy * best, b = balls[hit];
    let ox = b[0] - gx, oy = b[1] - gy; const ol = Math.sqrt(ox * ox + oy * oy) || 1; ox /= ol; oy /= ol;
    const cut = dx * ox + dy * oy; // cos of the cut
    let tx = dx - cut * ox, ty = dy - cut * oy; const tl = Math.sqrt(tx * tx + ty * ty);
    if (tl > 1e-6) { tx /= tl; ty /= tl; } else { tx = 0; ty = 0; }
    return { kind: 'ball', n: hit, ghost: [gx, gy], ball: [b[0], b[1]], objectDir: [ox, oy], cueDir: [tx, ty], cut: Math.max(0, cut), length: best };
  }
  const t = Math.max(0, wall), x = cx + dx * t, y = cy + dy * t;
  const rx = wx ? -dx : dx, ry = wy ? -dy : dy;
  return { kind: 'rail', at: [x, y], bounce: [rx, ry], length: t };
}
function rayCircle(cx, cy, dx, dy, bx, by, r) {
  const ox = cx - bx, oy = cy - by, b = ox * dx + oy * dy, c = ox * ox + oy * oy - r * r;
  if (c < 0) return 0;
  if (b > 0) return null;
  const disc = b * b - c;
  if (disc < 0) return null;
  return -b - Math.sqrt(disc);
}

/* ---------- the computer player ---------- */
const LEVEL = Object.freeze({ easy: { aim: 0.03, power: 0.14, pick: 4 }, medium: { aim: 0.013, power: 0.08, pick: 2 }, hard: { aim: 0.0045, power: 0.04, pick: 1 } });
const gauss = (rng) => { let u = 0, v = 0; while (u === 0) u = rng(); while (v === 0) v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
// the cushion-free distance a ball covers from speed v (the cloth's law above)
const travel = (v) => v / DRAG - (ROLL / (DRAG * DRAG)) * Math.log(1 + (DRAG * v) / ROLL);
function speedToCover(d) { let lo = 0, hi = 2000; for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (travel(mid) < d) lo = mid; else hi = mid; } return hi; }
function clearPath(balls, ax, ay, bx, by, skip, width = D) {
  const dx = bx - ax, dy = by - ay, len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-6) return true;
  const ux = dx / len, uy = dy / len;
  for (let n = 0; n < 16; n++) {
    if (skip.includes(n)) continue;
    const b = balls[n]; if (!b) continue;
    const px = b[0] - ax, py = b[1] - ay, along = px * ux + py * uy;
    if (along < -width || along > len + width) continue;
    const side = Math.abs(px * uy - py * ux);
    if (side < width - 0.05 && along > -R && along < len + R) return false;
  }
  return true;
}
function potCandidates(state, cue, targets, balls, inHand = false) {
  const out = [];
  for (const n of targets) {
    const o = balls[n];
    if (!o) continue;
    for (let p = 0; p < 6; p++) {
      const [ax, ay] = AIM[p], pk = POCKETS[p];
      let ux = ax - o[0], uy = ay - o[1]; const dO = Math.sqrt(ux * ux + uy * uy); ux /= dO; uy /= dO;
      // a side pocket takes a ball only from the front
      if (pk.side) { const into = pk.y < 0 ? -uy : uy; if (into < 0.5) continue; }
      else { const ix = pk.x < 0 ? -ux : ux, iy = pk.y < 0 ? -uy : uy; if (ix < 0.12 || iy < 0.12) continue; }
      const gx = o[0] - ux * D, gy = o[1] - uy * D;
      if (gx < R || gx > L - R || gy < R || gy > W - R) continue;
      if (!clearPath(balls, o[0], o[1], ax, ay, inHand ? [n, 0] : [n])) continue;
      out.push({ n, p, ux, uy, gx, gy, dO });
    }
  }
  return out;
}
function scoreShot(c, cue, balls) {
  let vx = c.gx - cue[0], vy = c.gy - cue[1]; const dC = Math.sqrt(vx * vx + vy * vy); if (dC < 1e-6) return null; vx /= dC; vy /= dC;
  const cut = vx * c.ux + vy * c.uy;
  if (cut < 0.2) return null;
  if (!clearPath(balls, cue[0], cue[1], c.gx, c.gy, [0, c.n])) return null;
  const difficulty = (1 - cut) * 2.4 + c.dO / 220 + dC / 320 + (POCKETS[c.p].side ? 0.25 : 0);
  return { ...c, vx, vy, dC, cut, difficulty };
}
function powerForShot(s) {
  const objectSpeed = speedToCover(s.dO * 1.25 + 18) + 25;
  const atContact = objectSpeed / (((1 + BALL_E) / 2) * Math.max(0.25, s.cut));
  const start = atContact + (ROLL / Math.max(40, atContact) + DRAG) * s.dC;
  return Math.max(0.08, Math.min(1, powerFor(start)));
}
/** A shot for the computer: { dir, power, spin, cue? } (cue when it has the ball in hand). */
export function choosePoolShot(state, level = 'medium', rng = Math.random) {
  if (state.winner !== null && state.winner !== undefined) return null;
  const lv = LEVEL[level] || LEVEL.medium, seat = state.turn, balls = state.balls;
  const jitter = (v) => { const a = gauss(rng) * lv.aim, c = Math.cos(a), s = Math.sin(a); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c]; };
  const powerJitter = (p) => Math.max(0.06, Math.min(1, p * (1 + gauss(rng) * lv.power)));
  if (state.phase === 'break') {
    const cue = [HEAD_X - 8 - rng() * 14, W / 2 + (rng() - 0.5) * 20];
    const apex = balls[[...Array(16).keys()].slice(1).sort((a, b) => (balls[a]?.[0] ?? 1e9) - (balls[b]?.[0] ?? 1e9))[0]] || FOOT;
    let dx = apex[0] - cue[0], dy = apex[1] - cue[1] + (rng() - 0.5) * 0.8; const len = Math.sqrt(dx * dx + dy * dy);
    return { cue, dir: jitter([dx / len, dy / len]), power: level === 'easy' ? 0.82 : level === 'medium' ? 0.92 : 1, spin: [0, 0] };
  }
  const targets = legalTargets(state, seat);
  let cue = balls[0], place = null;
  const cands = [];
  if (state.inHand || !cue) {
    // ball in hand: behind a straight-ish shot at the best distance
    for (const c of potCandidates(state, null, targets, balls, true)) {
      for (const dist of [16, 28, 42]) for (const turn of [0, 0.35, -0.35]) {
        const co = Math.cos(turn), si = Math.sin(turn), bx = c.ux * co - c.uy * si, by = c.ux * si + c.uy * co;
        const px = c.gx - bx * dist, py = c.gy - by * dist;
        if (!canPlace(state, px, py, false)) continue;
        const s = scoreShot(c, [px, py], { ...balls, 0: null });
        if (s) cands.push({ ...s, place: [px, py], difficulty: s.difficulty + Math.abs(turn) * 0.2 });
      }
    }
  } else {
    for (const c of potCandidates(state, cue, targets, balls)) { const s = scoreShot(c, cue, balls); if (s) cands.push(s); }
  }
  cands.sort((a, b) => a.difficulty - b.difficulty);
  if (cands.length) {
    let pick = cands[Math.min(cands.length - 1, Math.floor(rng() * Math.min(lv.pick, cands.length)))];
    if (level === 'hard' && !(state.inHand || !cue)) {
      // a good player checks the cue ball does not follow the object ball in
      for (const c of cands.slice(0, 3)) {
        const spins = [[0, 0], [0, -0.45]];
        let ok = null;
        for (const spin of spins) {
          const sim = simulate(balls, { dir: [c.vx, c.vy], speed: speedOf(powerForShot(c)), spin });
          if (!sim.potted.includes(0) && sim.potted.includes(c.n)) { ok = spin; break; }
        }
        if (ok) { pick = { ...c, spin: ok }; break; }
      }
    }
    place = pick.place || null;
    const shot = { dir: jitter([pick.vx, pick.vy]), power: powerJitter(powerForShot(pick)), spin: pick.spin || [0, 0] };
    if (place) shot.cue = place;
    return shot;
  }
  // nothing to pot: a safe hit on one of ours, straight or off one cushion
  const from = cue || nearestPlace(state, L * 0.3, W / 2, false);
  if (!cue) place = from;
  const direct = targets.map((n) => ({ n, b: balls[n] })).filter(({ n, b }) => b && clearPath(balls, from[0], from[1], b[0], b[1], [0, n], D)).sort((a, b) => (a.b[0] - from[0]) ** 2 + (a.b[1] - from[1]) ** 2 - ((b.b[0] - from[0]) ** 2 + (b.b[1] - from[1]) ** 2));
  let dir = null, power = 0.4;
  if (direct.length) { const b = direct[0].b; const dx = b[0] - from[0], dy = b[1] - from[1], len = Math.sqrt(dx * dx + dy * dy); dir = [dx / len, dy / len]; power = Math.min(0.75, 0.25 + len / 400); }
  else {
    for (const n of targets) {
      const b = balls[n]; if (!b) continue;
      const mirrors = [[b[0], 2 * R - b[1]], [b[0], 2 * (W - R) - b[1]], [2 * R - b[0], b[1]], [2 * (L - R) - b[0], b[1]]];
      for (const [mx, my] of mirrors) {
        const dx = mx - from[0], dy = my - from[1], len = Math.sqrt(dx * dx + dy * dy);
        const g = aimGuide({ ...balls, 0: null }, from, [dx / len, dy / len]);
        if (g.kind === 'rail') { dir = [dx / len, dy / len]; power = Math.min(0.85, 0.35 + len / 450); break; }
      }
      if (dir) break;
    }
  }
  if (!dir) { const b = balls[targets[0]] || FOOT; const dx = b[0] - from[0], dy = b[1] - from[1], len = Math.sqrt(dx * dx + dy * dy) || 1; dir = [dx / len, dy / len]; }
  const shot = { dir: jitter(dir), power: powerJitter(power), spin: [0, 0] };
  if (place) shot.cue = place;
  return shot;
}
