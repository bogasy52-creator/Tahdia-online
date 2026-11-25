/* لعبة العباقرة 33.18.0 — «برج التحديات»: how a runner moves.
   A runner is an upright cylinder. It stands on boxes and discs (and rides them when they move),
   steps up low ledges, slides on ice, is carried by belts, bounced by jelly and bumpers, and knocked
   about by bars, hammers, barrels and cannon balls. Everything is checked a few times per frame, so a
   fast hammer cannot pass through a runner on a slow phone. */
import { GRAVITY, JUMP, RUN, PLAYER_R as R, PLAYER_H as H, offset, blinkOn, hammerAt, rollAt, ballAt, barAngle, windAt } from './course.js?v=33.18.0';

const STEP = 1 / 120, STEP_UP = 0.42, COYOTE = 0.12, BUFFER = 0.14;
const near = (p, z, pad) => {
  switch (p.k) {
    case 'box': case 'door': return Math.abs(z - p.z) < p.d / 2 + pad + (p.mv ? Math.abs(p.mv.ax[2]) : 0);
    case 'disk': return Math.abs(z - p.z) < p.r + pad;
    case 'bar': return Math.abs(z - p.z) < p.len + pad;
    case 'roll': return z > Math.min(p.z0, p.z1) - pad && z < Math.max(p.z0, p.z1) + pad;
    case 'bump': case 'pad': case 'ham': case 'ball': return Math.abs(z - p.z) < 3 + pad;
    case 'wind': return Math.abs(z - p.z) < p.d / 2;
    default: return false;
  }
};

export class Runner {
  constructor(course, { cp = 0, slot = -1 } = {}) {
    this.course = course; this.g = GRAVITY * (course.g || 1);
    this.crumbled = new Map(); this.opened = new Set(); this.gems = new Set(); this.events = [];
    this.cp = cp; this.falls = 0; this.finished = false; this.slot = slot;
    this.spawn(true);
  }
  spawn(start = false) {
    const c = this.course.checkpoints[this.cp] || this.course.checkpoints[0];
    const col = Math.max(0, this.slot) % 4, row = Math.max(0, Math.floor(this.slot / 4));
    this.x = c.x + (start ? (this.slot < 0 ? 0 : (col - 1.5) * 2.2) : (Math.random() - 0.5) * 2); this.y = c.y + 0.02; this.z = c.z + (start ? row * 1.8 : 0);
    this.vx = 0; this.vy = 0; this.vz = 0; this.ry = 0; this.ground = null; this.grounded = true; this.coyote = 0; this.buffer = 0; this.stun = 0; this.airTime = 0; this.run = 0;
  }
  /** One frame. input: {x, z} from −1 to 1 (z forward), jump: true on the frame it is pressed. */
  update(dt, t, input) {
    if (input.jump) this.buffer = BUFFER;
    let left = Math.min(dt, 0.1);
    while (left > 1e-6) { const h = Math.min(STEP, left); this.step(h, t - left + h, input); left -= h; }
    const speed = Math.hypot(this.vx, this.vz);
    if (speed > 0.6 && this.stun <= 0) { const want = Math.atan2(this.vx, this.vz); let d = want - this.ry; d = Math.atan2(Math.sin(d), Math.cos(d)); this.ry += d * Math.min(1, dt * 14); }
    this.run += dt * speed * 1.7;
  }
  get anim() { return this.stun > 0 ? 'stun' : !this.grounded ? (this.vy > 0 ? 'jump' : 'fall') : Math.hypot(this.vx, this.vz) > 0.8 ? 'run' : 'idle'; }
  emit(type, data = {}) { this.events.push({ type, ...data }); }

  step(dt, t, input) {
    const course = this.course, pieces = course.pieces;
    // ride whatever we stand on
    let mat = 'air', belt = null;
    if (this.grounded && this.ground) {
      const p = this.ground;
      if (p.k === 'box' && p.mv) { const a = offset(p, t - dt), b = offset(p, t); this.x += b[0] - a[0]; this.y += b[1] - a[1]; this.z += b[2] - a[2]; }
      if (p.k === 'disk' && p.w) { const a = p.w * dt, dx = this.x - p.x, dz = this.z - p.z, c = Math.cos(a), s = Math.sin(a); this.x = p.x + dx * c + dz * s; this.z = p.z - dx * s + dz * c; this.ry -= a; }
      mat = p.m || 'floor'; if (p.cv) belt = p.cv;
    }
    // walking: quick on ground, softer in the air, slippery on ice
    const ctrl = this.stun > 0 ? 0.15 : 1, mag = Math.min(1, Math.hypot(input.x, input.z));
    let tx = input.x * RUN * ctrl, tz = input.z * RUN * ctrl;
    if (mag > 1) { tx /= mag; tz /= mag; }
    if (belt) { tx += belt[0]; tz += belt[1]; }
    const accel = !this.grounded ? 9 : mat === 'ice' ? 2.6 : this.stun > 0 ? 3 : 16;
    const k = 1 - Math.exp(-accel * dt);
    this.vx += (tx - this.vx) * k; this.vz += (tz - this.vz) * k;
    // wind
    for (const p of pieces) if (p.k === 'wind' && near(p, this.z, 0) && this.y > p.y0 && this.y < p.y1) this.vx += windAt(p, t) * dt;
    // jumping, with a moment of grace after leaving an edge and before landing
    this.coyote = this.grounded ? COYOTE : this.coyote - dt; this.buffer -= dt; this.stun -= dt;
    if (this.buffer > 0 && this.coyote > 0 && this.stun < 0.2) { this.vy = JUMP; this.grounded = false; this.ground = null; this.coyote = 0; this.buffer = 0; this.emit('jump'); }
    this.vy -= this.g * dt; if (this.vy < -38) this.vy = -38;
    const py = this.y;
    this.x += this.vx * dt; this.y += this.vy * dt; this.z += this.vz * dt;
    const wasGrounded = this.grounded; this.grounded = false; const oldGround = this.ground; this.ground = null;

    for (const p of pieces) {
      if (!near(p, this.z, 2)) continue;
      if (p.k === 'box') this.box(p, t, py, wasGrounded);
      else if (p.k === 'door') { if (p.open) { if (!this.opened.has(p.id) && Math.abs(this.z - p.z) < 1.2 && Math.abs(this.x - p.x) < p.w / 2 + R) { this.opened.add(p.id); this.emit('door', { id: p.id }); } } else this.box({ ...p, y: p.y + p.h }, t, py, false); }
      else if (p.k === 'disk') this.disk(p, py, wasGrounded);
      else if (p.k === 'bump') this.bumper(p, t);
      else if (p.k === 'bar') this.bar(p, t);
      else if (p.k === 'ham') this.hammer(p, t);
      else if (p.k === 'roll') this.roller(p, t);
      else if (p.k === 'ball') this.ball(p, t);
    }
    // pads fire when stood on
    if (this.grounded) for (const p of pieces) if (p.k === 'pad' && Math.abs(this.y - p.y) < 0.15 && Math.hypot(this.x - p.x, this.z - p.z) < p.r + R * 0.5) { this.vy = p.pw; this.grounded = false; this.ground = null; this.emit('pad'); }
    if (this.grounded) { this.airTime = 0; if (!wasGrounded) this.emit('land', { hard: this.lastVy < -14 }); } else this.airTime += dt;
    this.lastVy = this.vy;
    if (this.grounded && this.ground && this.ground !== oldGround && this.ground.m === 'crumble' && !this.crumbled.has(this.ground.id)) { this.crumbled.set(this.ground.id, t); this.emit('crack', { id: this.ground.id }); }
    // checkpoints: standing on a resting platform past one
    if (this.grounded) { let k = this.cp; for (const c of course.checkpoints) if (c.i > k && this.z >= c.z - 2.2 && this.y >= c.y - 0.6) k = c.i; if (k > this.cp) { this.cp = k; this.emit('checkpoint', { i: k }); } }
    // gems and the finish
    for (const gem of course.gems) if (!this.gems.has(gem.i) && Math.hypot(this.x - gem.x, this.y + 0.8 - gem.y, this.z - gem.z) < 1.15) { this.gems.add(gem.i); this.emit('gem', { i: gem.i }); }
    const f = course.finish;
    if (!this.finished && Math.abs(this.z - f.z) < 1.4 && Math.abs(this.x - f.x) < f.w / 2 && this.y > f.y - 0.4) { this.finished = true; this.emit('finish'); }
    if (this.y < course.kill) { this.falls++; this.emit('fall'); this.spawn(false); }
  }

  land(p, top, bounce = 0) {
    this.y = top; if (bounce && this.vy < -7) { this.vy = -this.vy * bounce; this.emit('bounce'); return; }
    this.vy = Math.max(0, this.vy); this.grounded = true; this.ground = p;
  }
  box(p, t, py, wasGrounded) {
    if (p.m === 'blink' && !blinkOn(p, t)) return;
    if (p.m === 'crumble') { const at = this.crumbled.get(p.id); if (at !== undefined) { if (t - at > p.cr + 3.6) this.crumbled.delete(p.id); else if (t - at > p.cr) return; } }
    const o = p.mv ? offset(p, t) : null, cx = p.x + (o ? o[0] : 0), cz = p.z + (o ? o[2] : 0), top = p.y + (o ? o[1] : 0), bottom = top - p.h;
    const hw = p.w / 2, hd = p.d / 2;
    const qx = Math.max(cx - hw, Math.min(this.x, cx + hw)), qz = Math.max(cz - hd, Math.min(this.z, cz + hd));
    const dx = this.x - qx, dz = this.z - qz, dist = Math.hypot(dx, dz);
    if (dist >= R) return;
    if (this.y >= top + 0.001 || this.y + H <= bottom) return;
    const inside = dist < 1e-6;
    // landing from above, walking across a seam, or stepping up a low ledge
    if (this.vy <= 0.5 && (py >= top - 0.06 || this.y >= top - 0.03 || (wasGrounded && top - this.y <= STEP_UP))) { this.land(p, top, p.m === 'jelly' ? 0.55 : 0); return; }
    if (this.y >= top - 0.03) return;
    // head against the underside
    if (this.vy > 0 && py + H <= bottom + 0.08) { this.y = bottom - H; this.vy = 0; return; }
    // pushed out sideways
    let nx, nz, pen;
    if (inside) { const ex = hw - Math.abs(this.x - cx), ez = hd - Math.abs(this.z - cz); if (ex < ez) { nx = Math.sign(this.x - cx) || 1; nz = 0; pen = ex + R; } else { nx = 0; nz = Math.sign(this.z - cz) || 1; pen = ez + R; } }
    else { nx = dx / dist; nz = dz / dist; pen = R - dist; }
    this.x += nx * pen; this.z += nz * pen;
    const vn = this.vx * nx + this.vz * nz; if (vn < 0) { this.vx -= vn * nx; this.vz -= vn * nz; }
    if (o) { // a moving wall carries you with it; a piston throws you
      const a = offset(p, t - 0.02), vx = (o[0] - a[0]) / 0.02, vz = (o[2] - a[2]) / 0.02, push = vx * nx + vz * nz;
      if (push > 0) { const kick = p.m === 'push' ? 1.6 : 1; this.vx += nx * push * kick; this.vz += nz * push * kick; if (p.m === 'push' && push > 4) { this.vy = Math.max(this.vy, 4.5); this.stun = 0.35; this.emit('hit', { by: 'push' }); } }
    }
  }
  disk(p, py, wasGrounded) {
    const d = Math.hypot(this.x - p.x, this.z - p.z), top = p.y, bottom = p.y - p.h;
    if (d >= p.r + R || this.y >= top + 0.001 || this.y + H <= bottom) return;
    if (this.vy <= 0.5 && (py >= top - 0.06 || this.y >= top - 0.03 || (wasGrounded && top - this.y <= STEP_UP))) { this.land(p, top, p.m === 'jelly' ? 0.55 : 0); return; }
    if (this.y >= top - 0.03) return;
    const nx = (this.x - p.x) / (d || 1), nz = (this.z - p.z) / (d || 1), pen = p.r + R - d;
    this.x += nx * pen; this.z += nz * pen;
  }
  bumper(p, t) {
    const o = p.mv ? offset(p, t) : [0, 0, 0], bx = p.x + o[0], bz = p.z + o[2], d = Math.hypot(this.x - bx, this.z - bz);
    if (d >= p.r + R || this.y > p.y + p.h || this.y + H < p.y) return;
    const nx = (this.x - bx) / (d || 1), nz = (this.z - bz) / (d || 1);
    this.x = bx + nx * (p.r + R); this.z = bz + nz * (p.r + R);
    this.vx = nx * 13; this.vz = nz * 13; this.vy = Math.max(this.vy, 4); this.stun = 0.3; this.emit('hit', { by: 'bump', id: p.id });
  }
  bar(p, t) {
    if (this.y > p.y + p.r || this.y + H < p.y - p.r) return;
    const base = barAngle(p, t);
    for (let k = 0; k < p.arms; k++) {
      const a = base + k * Math.PI / p.arms, ux = Math.cos(a), uz = Math.sin(a);
      const rx = this.x - p.x, rz = this.z - p.z, s = Math.max(-p.len, Math.min(p.len, rx * ux + rz * uz));
      const qx = p.x + ux * s, qz = p.z + uz * s, dx = this.x - qx, dz = this.z - qz, d = Math.hypot(dx, dz);
      if (d < p.r + R) {
        // the bar sweeps you along its turn
        const side = Math.sign(p.w) * Math.sign(s || 1), tx = -uz * side, tz = ux * side, sp = 7 + Math.abs(p.w * s) * 1.3;
        this.x = qx + (dx / (d || 1)) * (p.r + R); this.z = qz + (dz / (d || 1)) * (p.r + R);
        this.vx = tx * sp; this.vz = tz * sp; this.vy = Math.max(this.vy, 5.5); this.stun = 0.4; this.emit('hit', { by: 'bar' }); return;
      }
    }
  }
  hammer(p, t) {
    const h = hammerAt(p, t), b = hammerAt(p, t - 0.03), cy = Math.max(this.y + R, Math.min(h.y, this.y + H - R));
    if (Math.hypot(this.x - h.x, cy - h.y, this.z - h.z) >= p.hr + R) return;
    const dir = Math.sign(h.x - b.x) || Math.sign(this.x - h.x) || 1;
    this.vx = dir * 14; this.vy = 6.5; this.vz *= 0.3; this.stun = 0.55; this.emit('hit', { by: 'hammer' });
  }
  roller(p, t) {
    const o = rollAt(p, t); if (Math.abs(this.x - o.x) > p.w / 2 + R) return;
    const cy = Math.max(this.y + R, Math.min(o.y, this.y + H - R));
    if (Math.hypot(cy - o.y, this.z - o.z) >= p.r + R) return;
    this.vz = Math.sign(p.z1 - p.z0) * 9; this.vy = 6; this.stun = 0.45; this.emit('hit', { by: 'roll' });
  }
  ball(p, t) {
    const o = ballAt(p, t), cy = Math.max(this.y + R, Math.min(o.y, this.y + H - R));
    if (Math.hypot(this.x - o.x, cy - o.y, this.z - o.z) >= p.r + R) return;
    this.vx = Math.sign(p.x1 - p.x0) * 12; this.vy = 5; this.stun = 0.45; this.emit('hit', { by: 'ball' });
  }
}
