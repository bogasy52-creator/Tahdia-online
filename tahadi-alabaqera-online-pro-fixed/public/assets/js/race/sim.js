// Turbo Kart — the race itself (pure: state in, state out; the page only feeds it input and draws it).
import { SEG_LEN, mulberry32, segAt, segIndex } from './track.js';

export const MAX_SPEED = 10500;
const ACCEL = MAX_SPEED / 4.2, BRAKE = MAX_SPEED * 0.9, DECEL = MAX_SPEED / 6;
const OFFROAD_DECEL = MAX_SPEED * 0.45, OFFROAD_LIMIT = MAX_SPEED * 0.3;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const KART_COLORS = ['#ff4d4d', '#34d1ff', '#ffd23f', '#7cff6b', '#c77dff', '#ff9f43'];
const AI_NAMES = ['الصقر', 'النمر', 'الذيب', 'الفهد', 'الغزال'];
export const DIFFICULTY = {
  easy: { skill: [0.78, 0.87], band: 0.05 },
  mid: { skill: [0.87, 0.94], band: 0.07 },
  hard: { skill: [0.93, 1.0], band: 0.09 },
};
export const ITEMS = ['turbo', 'shield', 'rocket', 'oil'];
export const ITEM_NAMES = { turbo: 'تيربو', shield: 'درع', rocket: 'صاروخ', oil: 'زيت' };
export const DRIFT_LEVELS = [0.9, 1.9, 3.0];
const MINI_TURBO = [0.8, 1.4, 2.1];

const wrapDiff = (len, a, b) => { let d = (a - b) % len; if (d > len / 2) d -= len; if (d < -len / 2) d += len; return d; };

function newKart(id, name, color, isPlayer, slot, track) {
  return {
    id, name, color, isPlayer, slot,
    z: track.length - 500 - Math.floor(slot / 2) * 560, x: slot % 2 ? 0.42 : -0.42, speed: 0, lap: -1, progress: 0,
    steer: 0, boost: 0, shield: 0, spin: 0, spinAngle: 0, item: null, itemWait: 0, padCool: 0, bumpCool: 0,
    drift: { on: false, dir: 0, charge: 0, level: 0 },
    finished: false, finishTime: 0, lapStart: 0, bestLap: Infinity, place: slot + 1,
    skill: 0.9, laneX: 0, laneT: 0,
  };
}

export function createRace({ track, difficulty = 'mid', laps = 3, color = KART_COLORS[0], seed = 1, playerName = 'أنت', racers = 6 }) {
  const rng = mulberry32(seed);
  const d = DIFFICULTY[difficulty] || DIFFICULTY.mid;
  const palette = KART_COLORS.filter((c) => c !== color);
  const playerSlot = Math.max(0, racers - 2);
  const karts = [];
  let ai = 0;
  for (let s = 0; s < racers; s++) {
    if (s === playerSlot) karts.push(newKart('p', playerName, color, true, s, track));
    else {
      const k = newKart('ai' + ai, AI_NAMES[ai % AI_NAMES.length], palette[ai % palette.length], false, s, track);
      k.skill = d.skill[0] + rng() * (d.skill[1] - d.skill[0]);
      karts.push(k); ai++;
    }
  }
  for (const k of karts) k.progress = k.lap * track.length + k.z;
  return {
    track, laps, difficulty, rng, karts, player: karts.find((k) => k.isPlayer), projectiles: [], hazards: [],
    boxes: track.boxes.map((b) => ({ ...b })), phase: 'countdown', countdown: 3.2, lastCount: 4, time: 0,
    events: [], finishOrder: [], playerFinishAt: 0, done: false, band: d.band,
  };
}

function rankOf(race, k) {
  let r = 1;
  for (const o of race.karts) if (o !== k && (o.finished === k.finished ? (o.finished ? o.finishTime < k.finishTime : o.progress > k.progress) : o.finished)) r++;
  return r;
}

function pickItem(race, k) {
  const place = rankOf(race, k), n = race.karts.length, t = (place - 1) / Math.max(1, n - 1); // 0 leader .. 1 last
  const w = { turbo: 20 + 25 * t, shield: 40 - 30 * t, rocket: 10 + 32 * t, oil: 30 - 22 * t };
  let total = 0; for (const key of ITEMS) total += w[key];
  let r = race.rng() * total;
  for (const key of ITEMS) { r -= w[key]; if (r <= 0) return key; }
  return 'turbo';
}

function hitKart(race, k, cause) {
  if (k.finished) return;
  if (k.shield > 0) { k.shield = 0; race.events.push({ type: 'shield-pop', id: k.id }); return; }
  k.spin = 1.25; k.speed *= 0.35; k.boost = 0; k.drift.on = false; k.drift.charge = 0;
  race.events.push({ type: 'spin', id: k.id, cause });
}

export function useItem(race, k) {
  const item = k.item;
  if (!item || k.spin > 0 || race.phase !== 'racing') return false;
  k.item = null;
  if (item === 'turbo') { k.boost = Math.max(k.boost, 1.7); race.events.push({ type: 'boost', id: k.id, why: 'item' }); }
  else if (item === 'shield') { k.shield = 7; race.events.push({ type: 'shield', id: k.id }); }
  else if (item === 'rocket') {
    let target = null, best = Infinity;
    for (const o of race.karts) { const diff = o.progress - k.progress; if (o !== k && diff > 0 && diff < best) { best = diff; target = o; } }
    race.projectiles.push({ z: k.z + SEG_LEN * 2, x: k.x, speed: MAX_SPEED * 1.6, owner: k.id, target: target ? target.id : null, life: 6 });
    race.events.push({ type: 'rocket', id: k.id });
  } else if (item === 'oil') {
    race.hazards.push({ z: k.z - SEG_LEN * 3, x: k.x, until: race.time + 25 });
    race.events.push({ type: 'oil', id: k.id });
  }
  return true;
}

function advance(race, k, dt) {
  const len = race.track.length;
  k.z += k.speed * dt;
  if (k.z >= len) {
    k.z -= len; k.lap++;
    if (k.lap >= 0) {
      const lapTime = race.time - k.lapStart;
      if (k.lap >= 1) { k.bestLap = Math.min(k.bestLap, lapTime); if (k.isPlayer) race.events.push({ type: 'lap', lap: k.lap, time: lapTime, best: k.bestLap }); }
      k.lapStart = race.time;
    }
    if (k.lap >= race.laps && !k.finished) {
      k.finished = true; k.finishTime = race.time; race.finishOrder.push(k.id);
      race.events.push({ type: 'finish', id: k.id, isPlayer: k.isPlayer, order: race.finishOrder.length });
      if (k.isPlayer) race.playerFinishAt = race.time;
    }
  }
  k.progress = k.lap * len + k.z;
}

function trackEffects(race, k, dt) {
  const track = race.track, len = track.length;
  k.padCool = Math.max(0, k.padCool - dt); k.bumpCool = Math.max(0, k.bumpCool - dt);
  const seg = segAt(track, k.z);
  if (seg.padX !== null && Math.abs(k.x - seg.padX) < 0.4 && k.padCool <= 0) {
    k.boost = Math.max(k.boost, 1.1); k.padCool = 1.2;
    race.events.push({ type: 'boost', id: k.id, why: 'pad' });
  }
  if (!k.item && !k.finished) {
    for (const b of race.boxes) {
      if (race.time < b.taken) continue;
      if (Math.abs(wrapDiff(len, b.z, k.z)) < SEG_LEN * 1.3 && Math.abs(b.x - k.x) < 0.3) {
        b.taken = race.time + 5; k.item = pickItem(race, k); k.itemWait = 0.8 + race.rng() * 2;
        race.events.push({ type: 'pickup', id: k.id, item: k.item });
        break;
      }
    }
  }
  for (let i = race.hazards.length - 1; i >= 0; i--) {
    const h = race.hazards[i];
    if (race.time > h.until) { race.hazards.splice(i, 1); continue; }
    if (Math.abs(wrapDiff(len, h.z, k.z)) < SEG_LEN * 0.9 && Math.abs(h.x - k.x) < 0.28 && k.spin <= 0) { hitKart(race, k, 'oil'); race.hazards.splice(i, 1); }
  }
  // solid roadside objects
  if (Math.abs(k.x) > 1.15 && k.speed > MAX_SPEED * 0.3) {
    for (const o of seg.scenery) {
      if (['lamp', 'banner', 'arch'].includes(o.type) && o.type !== 'lamp') continue;
      if (Math.abs(o.x - k.x) < 0.3 * o.s + 0.08) {
        k.speed = Math.min(k.speed, MAX_SPEED * 0.2); k.x += (k.x > 0 ? -0.2 : 0.2);
        if (k.bumpCool <= 0) { k.bumpCool = 0.6; race.events.push({ type: 'bump', id: k.id, hard: true }); }
        break;
      }
    }
  }
}

function drivePlayer(race, k, dt, inp) {
  const seg = segAt(race.track, k.z), sp = k.speed / MAX_SPEED;
  k.boost = Math.max(0, k.boost - dt); k.shield = Math.max(0, k.shield - dt);
  let ctl = inp;
  if (k.spin > 0) { k.spin -= dt; k.spinAngle += dt * 13; ctl = { steer: 0, gas: false, brake: false, drift: false }; } else k.spinAngle = 0;
  if (k.finished) ctl = { steer: clamp(-k.x * 1.2, -0.6, 0.6), gas: true, brake: false, drift: false }; // autopilot after the flag
  k.steer += (clamp(ctl.steer, -1, 1) - k.steer) * Math.min(1, dt * 10);
  const dr = k.drift;
  if (ctl.drift && !dr.on && sp > 0.45 && Math.abs(k.steer) > 0.25) { dr.on = true; dr.dir = Math.sign(k.steer); dr.charge = 0; dr.level = 0; race.events.push({ type: 'drift-start' }); }
  if (dr.on) {
    if (!ctl.drift || sp < 0.3) {
      if (dr.level > 0) { k.boost = Math.max(k.boost, MINI_TURBO[dr.level - 1]); race.events.push({ type: 'mini-turbo', level: dr.level }); }
      dr.on = false; dr.charge = 0; dr.level = 0;
    } else {
      dr.charge += dt * (k.steer * dr.dir > 0.1 ? 1.35 : k.steer * dr.dir < -0.1 ? 0.65 : 1);
      const lv = DRIFT_LEVELS.filter((t) => dr.charge >= t).length;
      if (lv > dr.level) { dr.level = lv; race.events.push({ type: 'drift-level', level: lv }); }
    }
  }
  const dx = dt * 2 * Math.max(sp, 0.1);
  let steerEff = k.steer;
  if (dr.on) steerEff = clamp(dr.dir * 0.55 + k.steer * 0.8, -1.2, 1.2);
  k.x += steerEff * dx * (dr.on ? 1.35 : 1);
  k.x -= dx * sp * seg.curve * (dr.on ? 0.14 : 0.3);
  const maxEff = MAX_SPEED * (k.boost > 0 ? 1.32 : 1) * (dr.on ? 0.95 : 1);
  if (ctl.gas) k.speed += ACCEL * (k.boost > 0 ? 2.4 : 1) * dt;
  else if (ctl.brake) k.speed -= BRAKE * dt;
  else k.speed -= DECEL * dt;
  if (Math.abs(k.x) > 1 && k.boost <= 0 && k.speed > OFFROAD_LIMIT) k.speed -= OFFROAD_DECEL * dt;
  if (k.speed > maxEff) k.speed = Math.max(maxEff, k.speed - MAX_SPEED * 0.6 * dt);
  k.speed = Math.max(0, k.speed);
  k.x = clamp(k.x, -2.4, 2.4);
}

function driveAI(race, k, dt) {
  const track = race.track, seg = segAt(track, k.z), len = track.length;
  k.boost = Math.max(0, k.boost - dt); k.shield = Math.max(0, k.shield - dt);
  if (k.spin > 0) { k.spin -= dt; k.spinAngle += dt * 13; k.speed = Math.max(k.speed - MAX_SPEED * 0.8 * dt, MAX_SPEED * 0.1); }
  else k.spinAngle = 0;
  const ahead = segAt(track, k.z + SEG_LEN * 22);
  let target = MAX_SPEED * k.skill * (1 - Math.min(Math.abs(ahead.curve) * 0.05, 0.3));
  const gap = race.player.progress - k.progress; // positive: the player is in front
  if (gap > len * 0.08) target *= 1 + race.band; else if (gap < -len * 0.1) target *= 1 - race.band * 1.2;
  if (k.boost > 0) target = MAX_SPEED * 1.3;
  if (k.finished) target = MAX_SPEED * 0.6;
  if (k.spin <= 0) {
    if (k.speed < target) k.speed += ACCEL * (k.boost > 0 ? 2.4 : 1) * dt; else k.speed -= DECEL * 1.4 * dt;
    if (k.speed > target && k.boost <= 0) k.speed = Math.max(target, k.speed - DECEL * 2 * dt);
  }
  // lane choice and hazard dodging
  k.laneT -= dt;
  if (k.laneT <= 0) { k.laneT = 2.5 + race.rng() * 4; k.laneX = (race.rng() * 2 - 1) * 0.75; }
  let want = k.laneX;
  for (const h of race.hazards) { const dz = wrapDiff(len, h.z, k.z); if (dz > 0 && dz < 1800 && Math.abs(h.x - k.x) < 0.4) want = h.x + (h.x > k.x ? -0.5 : 0.5); }
  const inside = seg.curve * 0.12; // hug the inside of a bend
  k.x += clamp(clamp(want - inside, -0.9, 0.9) - k.x, -1, 1) * dt * 1.1;
  k.x = clamp(k.x, -1.0, 1.0);
  // items
  if (k.item && !k.finished && race.phase === 'racing') {
    k.itemWait -= dt;
    if (k.itemWait <= 0) {
      let use = false;
      if (k.item === 'turbo') use = Math.abs(seg.curve) < 1.2;
      else if (k.item === 'shield') use = k.itemWait < -1;
      else if (k.item === 'rocket') use = race.karts.some((o) => o !== k && o.progress - k.progress > 0 && o.progress - k.progress < 3200) || k.itemWait < -7;
      else if (k.item === 'oil') use = race.karts.some((o) => o !== k && k.progress - o.progress > 0 && k.progress - o.progress < 2200) || k.itemWait < -6;
      if (use) useItem(race, k);
    }
  }
}

function updateProjectiles(race, dt) {
  const len = race.track.length;
  for (let i = race.projectiles.length - 1; i >= 0; i--) {
    const p = race.projectiles[i];
    p.life -= dt; p.z = (p.z + p.speed * dt) % len;
    const t = p.target && race.karts.find((k) => k.id === p.target);
    if (t) p.x += clamp(t.x - p.x, -1, 1) * dt * 2.2;
    let hit = null;
    for (const k of race.karts) {
      if (k.id === p.owner || k.finished) continue;
      if (Math.abs(wrapDiff(len, p.z, k.z)) < SEG_LEN * 1.6 && Math.abs(p.x - k.x) < 0.3) { hit = k; break; }
    }
    if (hit) { hitKart(race, hit, 'rocket'); race.projectiles.splice(i, 1); }
    else if (p.life <= 0) race.projectiles.splice(i, 1);
  }
}

function collideKarts(race) {
  const len = race.track.length, ks = race.karts;
  for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) {
    const a = ks[i], b = ks[j], dz = wrapDiff(len, a.z, b.z);
    if (Math.abs(dz) < 300 && Math.abs(a.x - b.x) < 0.24) {
      const rear = dz < 0 ? a : b, front = dz < 0 ? b : a;
      rear.speed = Math.min(rear.speed, front.speed * 0.93);
      const push = (a.x >= b.x ? 1 : -1) * 0.012;
      a.x = clamp(a.x + push, -2.4, 2.4); b.x = clamp(b.x - push, -2.4, 2.4);
      for (const k of [a, b]) if (k.isPlayer && k.bumpCool <= 0) { k.bumpCool = 0.5; race.events.push({ type: 'bump', id: k.id, hard: false }); }
    }
  }
}

export function step(race, dt, input) {
  race.events.length = 0;
  dt = Math.min(dt, 1 / 20);
  if (race.phase === 'countdown') {
    race.countdown -= dt;
    const n = Math.ceil(race.countdown - 0.2);
    if (n !== race.lastCount && n >= 1) { race.lastCount = n; race.events.push({ type: 'count', n }); }
    if (race.countdown <= 0.2 && race.lastCount !== 0) { race.lastCount = 0; race.phase = 'racing'; race.events.push({ type: 'go' }); }
    return race;
  }
  race.time += dt;
  for (const k of race.karts) {
    if (k.isPlayer) drivePlayer(race, k, dt, input); else driveAI(race, k, dt);
    advance(race, k, dt);
    trackEffects(race, k, dt);
  }
  updateProjectiles(race, dt);
  collideKarts(race);
  for (const k of race.karts) k.place = rankOf(race, k);
  if (race.player.finished && !race.done && (race.karts.every((k) => k.finished) || race.time - race.playerFinishAt > 6)) {
    race.done = true; race.phase = 'finished'; race.events.push({ type: 'results' });
  }
  return race;
}

export function standings(race) {
  return race.karts.slice().sort((a, b) => (a.finished && b.finished ? a.finishTime - b.finishTime : a.finished ? -1 : b.finished ? 1 : b.progress - a.progress));
}
export { rankOf, segIndex };
