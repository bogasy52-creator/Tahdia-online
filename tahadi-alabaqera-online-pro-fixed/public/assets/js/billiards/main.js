/* Tahdia 33.9.0 — بلياردو (8-ball pool): the page.
   The table is drawn on a canvas from the same geometry the physics uses (pool-engine.js): walnut
   rails with brass sights, cloth under a lamp, leather pockets, and balls that roll — their numbers
   and stripes turn with the distance they travel. A shot is simulated once and played back at
   60 frames a second with its sounds; online, the server's shot replays here to the same end.
   Three ways to play: online (a person, or a computer player when nobody comes), against the
   computer, and two players on one phone. */
import { POOL, POCKETS, SHAPE, HEAD_X, FOOT, simulate, createPoolGame, playPoolShot, choosePoolShot, aimGuide, canPlace, nearestPlace, legalTargets, onEight, remaining, groupOf, GROUP_NAME } from '../engines/pool-engine.js?v=33.9.0-pool1';
import { createTable } from '../board-table-v33.js?v=33.9.0';

const { L, W, R } = POOL;
const RAIL = 14, CUSHION = 4;
const $ = (s) => document.querySelector(s);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const BALL = { 1: '#f4c21b', 2: '#1e4fd6', 3: '#d9262d', 4: '#5b2a8e', 5: '#f2791a', 6: '#13884a', 7: '#7d1f24', 8: '#141414' };
const colorOf = (n) => BALL[n > 8 ? n - 8 : n] || '#f7f4ec';
const SOLIDS = [1, 2, 3, 4, 5, 6, 7], STRIPES = [9, 10, 11, 12, 13, 14, 15];

/* ---------- sound: synthesised, so every click and drop is light and instant ---------- */
const Sound = (() => {
  let ctx = null, noise = null;
  const settings = () => window.BS_AUDIO?.getSettings?.() || { muted: false, effects: true, volume: 0.72 };
  const on = () => { const s = settings(); return !s.muted && s.effects !== false; };
  function ac() {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
      try { ctx = new C(); } catch { return null; }
      const len = Math.floor(ctx.sampleRate * 0.6); noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  function burst(freq, q, dur, gain, type = 'bandpass', delay = 0) {
    const c = ac(); if (!c) return;
    const t = c.currentTime + delay, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = noise; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain * settings().volume), t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(c.destination); src.start(t, Math.random() * 0.3); src.stop(t + dur + 0.02);
  }
  function ping(freq, dur, gain, delay = 0, end = null) {
    const c = ac(); if (!c) return;
    const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(freq, t); if (end) o.frequency.exponentialRampToValueAtTime(end, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain * settings().volume), t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  return {
    unlock: () => { if (on()) ac(); },
    ball(speed) { if (!on()) return; const v = Math.min(1, speed / 420); burst(3300 + v * 900, 3, 0.05, 0.06 + v * 0.55); ping(1850 + v * 500, 0.04, 0.03 + v * 0.16); },
    rail(speed) { if (!on()) return; const v = Math.min(1, speed / 450); burst(380, 0.9, 0.11, 0.05 + v * 0.42, 'lowpass'); ping(120, 0.09, 0.03 + v * 0.12, 0, 80); },
    pocket() { if (!on()) return; ping(170, 0.2, 0.42, 0, 70); burst(700, 0.8, 0.12, 0.3, 'lowpass'); burst(260, 0.7, 0.4, 0.12, 'lowpass', 0.09); },
    cue(power) { if (!on()) return; burst(1600, 1.2, 0.06, 0.18 + power * 0.42); ping(980, 0.035, 0.08 + power * 0.1); },
    foul() { if (!on()) return; ping(240, 0.2, 0.16, 0, 170); ping(180, 0.26, 0.14, 0.14, 120); },
    good() { if (!on()) return; ping(660, 0.1, 0.12); ping(990, 0.14, 0.1, 0.08); },
    win() { if (!on()) return; [523, 659, 784, 1046].forEach((f, i) => ping(f, 0.22, 0.13, i * 0.11)); },
  };
})();

/* ---------- 3D roll of each ball: an orientation (three axes) turned by the distance it rolls ---------- */
function freshAxes(rng = Math.random) {
  const a = rng() * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
  return { x: [c, s, 0], y: [-s, c, 0], z: [0, 0, 1], n: 0 };
}
function rollAxes(o, dx, dy) {
  const d = Math.sqrt(dx * dx + dy * dy); if (d < 1e-6) return;
  const ux = -dy / d, uy = dx / d, th = d / R, c = Math.cos(th), s = Math.sin(th);
  for (const v of [o.x, o.y, o.z]) {
    // Rodrigues about (ux, uy, 0)
    const cx = uy * v[2], cy = -ux * v[2], cz = ux * v[1] - uy * v[0], dot = ux * v[0] + uy * v[1];
    const nx = v[0] * c + cx * s + ux * dot * (1 - c), ny = v[1] * c + cy * s + uy * dot * (1 - c), nz = v[2] * c + cz * s;
    v[0] = nx; v[1] = ny; v[2] = nz;
  }
  if (++o.n % 24 === 0) {
    const n = (v) => { const l = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1; v[0] /= l; v[1] /= l; v[2] /= l; };
    n(o.x); const d1 = o.x[0] * o.z[0] + o.x[1] * o.z[1] + o.x[2] * o.z[2]; for (let i = 0; i < 3; i++) o.z[i] -= d1 * o.x[i]; n(o.z);
    o.y[0] = o.z[1] * o.x[2] - o.z[2] * o.x[1]; o.y[1] = o.z[2] * o.x[0] - o.z[0] * o.x[2]; o.y[2] = o.z[0] * o.x[1] - o.z[1] * o.x[0];
  }
}

/* ---------- the table view ---------- */
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
class TableView {
  constructor(canvas) {
    this.canvas = canvas; this.g = canvas.getContext('2d'); this.table = document.createElement('canvas');
    this.balls = Array(16).fill(null); this.axes = new Map(); this.sinking = []; this.flash = [];
    this.s = 1; this.dpr = 1; this.vertical = false; this.m = [1, 0, 0, 1, 0, 0];
  }
  fit(cssW, cssH, vertical, { focus = null, flip = false } = {}) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.dpr = dpr; this.vertical = vertical; this.cssW = cssW; this.cssH = cssH;
    this.canvas.width = Math.max(2, Math.round(cssW * dpr)); this.canvas.height = Math.max(2, Math.round(cssH * dpr));
    // the part of the table to show (the whole table with its rails unless a cover asks for a close-up)
    const [fx0, fy0, fx1, fy1] = focus || [-RAIL, -RAIL, L + RAIL, W + RAIL], fw = fx1 - fx0, fh = fy1 - fy0;
    const sx = vertical ? fh : fw, sy = vertical ? fw : fh;
    const s = focus ? Math.max(this.canvas.width / sx, this.canvas.height / sy) : Math.min(this.canvas.width / sx, this.canvas.height / sy);
    this.s = s;
    const cx = (fx0 + fx1) / 2, cy = (fy0 + fy1) / 2;
    // the focus centre lands in the middle of the canvas
    this.flip = !vertical && flip;
    this.m = vertical ? [0, -s, s, 0, this.canvas.width / 2 - cy * s, this.canvas.height / 2 + cx * s] : this.flip ? [-s, 0, 0, -s, this.canvas.width / 2 + cx * s, this.canvas.height / 2 + cy * s] : [s, 0, 0, s, this.canvas.width / 2 - cx * s, this.canvas.height / 2 - cy * s];
    this.prerender();
  }
  toScreen(x, y) { const m = this.m; return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }
  toWorld(px, py) { const m = this.m, s = this.s; return this.vertical ? [(m[5] - py) / s, (px - m[4]) / s] : this.flip ? [(m[4] - px) / s, (m[5] - py) / s] : [(px - m[4]) / s, (py - m[5]) / s]; }
  screenDir(vx, vy) { return this.vertical ? [vy, -vx] : this.flip ? [-vx, -vy] : [vx, vy]; }
  px(n) { return (n * this.dpr) / this.s; } // n css pixels in table centimetres
  axesOf(n) { if (!this.axes.has(n)) this.axes.set(n, freshAxes()); return this.axes.get(n); }

  prerender() {
    const c = this.table; c.width = this.canvas.width; c.height = this.canvas.height;
    const g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height);
    g.setTransform(...this.m);
    // the table's shadow on the floor
    g.save(); g.shadowColor = 'rgba(0,0,0,.65)'; g.shadowBlur = 34 * this.dpr; g.shadowOffsetY = 14 * this.dpr;
    roundRect(g, -RAIL, -RAIL, L + 2 * RAIL, W + 2 * RAIL, 7); g.fillStyle = '#3a1d0e'; g.fill(); g.restore();
    // walnut rails
    const wood = g.createLinearGradient(0, -RAIL, 0, W + RAIL);
    wood.addColorStop(0, '#7a4423'); wood.addColorStop(0.08, '#5a2f17'); wood.addColorStop(0.5, '#4a2512'); wood.addColorStop(0.92, '#5a2f17'); wood.addColorStop(1, '#7a4423');
    roundRect(g, -RAIL, -RAIL, L + 2 * RAIL, W + 2 * RAIL, 7); g.fillStyle = wood; g.fill();
    // grain
    g.save(); roundRect(g, -RAIL, -RAIL, L + 2 * RAIL, W + 2 * RAIL, 7); g.clip();
    let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    g.lineWidth = 0.18;
    for (let i = 0; i < 70; i++) {
      const horizontal = i % 2 === 0, off = rnd() * (RAIL - CUSHION - 1) + CUSHION + 0.5, far = rnd() < 0.5;
      g.strokeStyle = `rgba(${rnd() < 0.5 ? '255,214,170' : '20,8,2'},${0.05 + rnd() * 0.08})`;
      g.beginPath();
      if (horizontal) { const y = far ? W + off : -off; g.moveTo(-RAIL, y); for (let x = -RAIL; x <= L + RAIL; x += 12) g.lineTo(x, y + Math.sin(x * 0.05 + i) * 0.35); }
      else { const x = far ? L + off : -off; g.moveTo(x, -RAIL); for (let y = -RAIL; y <= W + RAIL; y += 10) g.lineTo(x + Math.sin(y * 0.07 + i) * 0.3, y); }
      g.stroke();
    }
    g.restore();
    // bevels
    g.lineWidth = this.px(1.2); g.strokeStyle = 'rgba(255,220,180,.28)'; roundRect(g, -RAIL + 0.6, -RAIL + 0.6, L + 2 * RAIL - 1.2, W + 2 * RAIL - 1.2, 6.4); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,.45)'; g.strokeRect(-CUSHION - 0.4, -CUSHION - 0.4, L + 2 * CUSHION + 0.8, W + 2 * CUSHION + 0.8);
    // cloth on the cushions, then the bed under the lamp
    g.fillStyle = '#0a5539'; g.fillRect(-CUSHION, -CUSHION, L + 2 * CUSHION, W + 2 * CUSHION);
    const bed = g.createRadialGradient(L / 2, W / 2, 6, L / 2, W / 2, L * 0.62);
    bed.addColorStop(0, '#1aa577'); bed.addColorStop(0.45, '#11845d'); bed.addColorStop(1, '#09553b');
    g.fillStyle = bed; g.fillRect(0, 0, L, W);
    // the cushion noses: a lighter edge along each, angled into the pockets
    const { corner: CM, side: SM, jaw: J, sideJaw: [SJx, SJy] } = SHAPE, mid = L / 2, d = CUSHION, sx = (SJx * d) / SJy;
    const cush = [
      [[CM, 0], [mid - SM, 0], [mid - SM + sx, -d], [CM - d, -d]], [[mid + SM, 0], [L - CM, 0], [L - CM + d, -d], [mid + SM - sx, -d]],
      [[CM, W], [mid - SM, W], [mid - SM + sx, W + d], [CM - d, W + d]], [[mid + SM, W], [L - CM, W], [L - CM + d, W + d], [mid + SM - sx, W + d]],
      [[0, CM], [0, W - CM], [-d, W - CM + d], [-d, CM - d]], [[L, CM], [L, W - CM], [L + d, W - CM + d], [L + d, CM - d]],
    ];
    for (const poly of cush) {
      g.beginPath(); poly.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
      g.fillStyle = '#0c6142'; g.fill();
      g.beginPath(); g.moveTo(...poly[0]); g.lineTo(...poly[1]); g.lineWidth = this.px(1.4); g.strokeStyle = 'rgba(160,255,210,.16)'; g.stroke();
    }
    // the pockets: a hole under a leather liner, cut into rail and cushion
    const holes = [[-1.7, -1.7, 6.7], [mid, -4.4, 6.0], [L + 1.7, -1.7, 6.7], [-1.7, W + 1.7, 6.7], [mid, W + 4.4, 6.0], [L + 1.7, W + 1.7, 6.7]];
    for (const [x, y, r] of holes) {
      g.beginPath(); g.arc(x, y, r + 1.7, 0, Math.PI * 2); g.fillStyle = '#20140c'; g.fill();
      const hole = g.createRadialGradient(x, y, 0, x, y, r);
      hole.addColorStop(0, '#000'); hole.addColorStop(0.75, '#050505'); hole.addColorStop(1, '#1d1d1d');
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = hole; g.fill();
    }
    void J;
    // brass sights on the rails
    const sight = (x, y) => { g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.fillStyle = '#f2e3bd'; g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 2 * this.dpr; g.fillRect(-0.75, -0.75, 1.5, 1.5); g.restore(); };
    const rm = CUSHION + (RAIL - CUSHION) / 2;
    for (const k of [1, 2, 3, 5, 6, 7]) { sight((L * k) / 8, -rm); sight((L * k) / 8, W + rm); }
    for (const k of [1, 2, 3]) { sight(-rm, (W * k) / 4); sight(L + rm, (W * k) / 4); }
    // the head string and the spots
    g.strokeStyle = 'rgba(255,255,255,.1)'; g.lineWidth = this.px(1); g.beginPath(); g.moveTo(HEAD_X, 0); g.lineTo(HEAD_X, W); g.stroke();
    for (const [x, y] of [[HEAD_X, W / 2], FOOT]) { g.beginPath(); g.arc(x, y, 0.55, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.4)'; g.fill(); }
    // cloth weave
    g.setTransform(1, 0, 0, 1, 0, 0);
    const [ax, ay] = this.toScreen(0, 0), [bx, by] = this.toScreen(L, W), x0 = Math.min(ax, bx), y0 = Math.min(ay, by), w = Math.abs(bx - ax), h = Math.abs(by - ay);
    const tile = document.createElement('canvas'); tile.width = tile.height = 48; const tg = tile.getContext('2d'), img = tg.createImageData(48, 48);
    for (let i = 0; i < img.data.length; i += 4) { const v = (Math.random() * 255) | 0; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 10; }
    tg.putImageData(img, 0, 0);
    g.fillStyle = g.createPattern(tile, 'repeat'); g.fillRect(x0, y0, w, h);
  }

  /* one frame */
  draw({ aim = null, cue = null, placing = null, kitchen = false, guide = true, illegal = false, ghostOnly = false } = {}) {
    const g = this.g; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    g.drawImage(this.table, 0, 0);
    if (kitchen) {
      g.setTransform(...this.m); g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(0, 0, HEAD_X, W);
      g.strokeStyle = 'rgba(255,240,200,.45)'; g.lineWidth = this.px(1.5); g.setLineDash([this.px(6), this.px(5)]); g.beginPath(); g.moveTo(HEAD_X, 0); g.lineTo(HEAD_X, W); g.stroke(); g.setLineDash([]);
    }
    const now = performance.now();
    // pocket flashes
    g.setTransform(...this.m);
    this.flash = this.flash.filter((f) => now - f.t < 650);
    for (const f of this.flash) { const k = (now - f.t) / 650, p = POCKETS[f.p]; g.beginPath(); g.arc(p.x, p.y, 7 + k * 9, 0, Math.PI * 2); g.strokeStyle = `rgba(246,220,150,${0.75 * (1 - k)})`; g.lineWidth = this.px(3 * (1 - k) + 1); g.stroke(); }
    if (aim && guide && cue) this.drawGuide(aim, cue, illegal, ghostOnly);
    // balls: shadows first, then the balls
    const list = [];
    for (let n = 0; n < 16; n++) { const b = n === 0 && placing ? placing.at : this.balls[n]; if (b) list.push([n, b[0], b[1], 1, 1]); }
    this.sinking = this.sinking.filter((s) => now - s.t < 260);
    for (const s of this.sinking) { const k = Math.min(1, (now - s.t) / 260), p = POCKETS[s.p]; list.push([s.n, s.x + (p.x - s.x) * k, s.y + (p.y - s.y) * k, 1 - 0.45 * k, 1 - k]); }
    g.setTransform(1, 0, 0, 1, 0, 0);
    const [cxs, cys] = this.toScreen(L / 2, W / 2);
    for (const [, x, y, sc, al] of list) {
      const [X, Y] = this.toScreen(x, y), r = R * this.s * sc;
      let dx = X - cxs, dy = Y - cys; const dl = Math.sqrt(dx * dx + dy * dy) || 1; dx /= dl; dy /= dl;
      g.globalAlpha = 0.42 * al; g.fillStyle = '#000'; g.beginPath(); g.ellipse(X + dx * r * 0.28, Y + dy * r * 0.28 + r * 0.1, r * 1.05, r * 0.95, 0, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1;
    for (const [n, x, y, sc, al] of list) this.drawBall(n, x, y, sc, al);
    if (placing) this.drawPlacing(placing);
    if (aim && cue && aim.stick !== false) this.drawCue(cue, aim.dir, aim.pull || 0, aim.alpha ?? 1);
  }

  drawBall(n, x, y, scale = 1, alpha = 1) {
    const g = this.g, [X, Y] = this.toScreen(x, y), r = R * this.s * scale, o = this.axesOf(n);
    g.save(); g.globalAlpha = alpha;
    g.beginPath(); g.arc(X, Y, r, 0, Math.PI * 2);
    const stripe = n >= 9, base = n === 0 ? '#f6f3ea' : stripe ? '#f3efe4' : colorOf(n);
    g.fillStyle = base; g.fill(); g.clip();
    const proj = (v) => { const [sx, sy] = this.screenDir(v[0], v[1]); return [X + sx * r, Y + sy * r]; };
    if (stripe) {
      g.strokeStyle = colorOf(n); g.lineWidth = r * 1.1; g.lineCap = 'butt'; g.lineJoin = 'round'; g.beginPath();
      let pen = false;
      for (let k = 0; k <= 36; k++) {
        const a = (k / 36) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
        const q = [c * o.x[0] + s * o.z[0], c * o.x[1] + s * o.z[1], c * o.x[2] + s * o.z[2]];
        if (q[2] > -0.25) { const [px, py] = proj(q); if (pen) g.lineTo(px, py); else g.moveTo(px, py); pen = true; } else pen = false;
      }
      g.stroke();
    }
    if (n === 0) {
      for (const sg of [1, -1]) { const p = [o.z[0] * sg, o.z[1] * sg, o.z[2] * sg]; if (p[2] <= 0) continue; const [px, py] = proj(p); g.beginPath(); g.arc(px, py, r * 0.13 * (0.4 + 0.6 * p[2]), 0, Math.PI * 2); g.fillStyle = '#d4313a'; g.fill(); }
    } else {
      // the number, on a white disc, on both sides
      for (const sg of [1, -1]) {
        const p = [o.z[0] * sg, o.z[1] * sg, o.z[2] * sg]; if (p[2] <= 0.04) continue;
        const [px, py] = proj(p), [rx, ry] = this.screenDir(p[0], p[1]), rad = Math.atan2(ry, rx), [ax, ay] = this.screenDir(o.x[0] * sg, o.x[1] * sg);
        g.save(); g.translate(px, py); g.rotate(rad); g.scale(Math.max(0.05, p[2]), 1); g.rotate(-rad);
        g.beginPath(); g.arc(0, 0, r * 0.5, 0, Math.PI * 2); g.fillStyle = '#fbf8ef'; g.fill();
        g.rotate(Math.atan2(ay, ax) + Math.PI / 2);
        g.fillStyle = '#151515'; g.font = `700 ${Math.round(r * (n > 9 ? 0.6 : 0.7))}px Tajawal, system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(String(n), 0, r * 0.04);
        g.restore();
      }
    }
    g.restore();
    // the lamp on the ball
    g.save(); g.globalAlpha = alpha;
    const shine = g.createRadialGradient(X - r * 0.34, Y - r * 0.4, r * 0.04, X - r * 0.1, Y - r * 0.12, r * 1.08);
    shine.addColorStop(0, 'rgba(255,255,255,.85)'); shine.addColorStop(0.16, 'rgba(255,255,255,.22)'); shine.addColorStop(0.5, 'rgba(255,255,255,0)'); shine.addColorStop(0.86, 'rgba(0,0,0,.18)'); shine.addColorStop(1, 'rgba(0,0,0,.42)');
    g.beginPath(); g.arc(X, Y, r, 0, Math.PI * 2); g.fillStyle = shine; g.fill();
    g.restore();
  }

  drawGuide(aim, cue, illegal, ghostOnly) {
    const g = this.g; g.setTransform(...this.m);
    const gd = aimGuide(this.balls, cue, aim.dir), lw = this.px(1.7);
    g.lineCap = 'round'; g.lineWidth = lw;
    const line = (ax, ay, bx, by, alpha, dash = null) => { g.strokeStyle = `rgba(255,255,255,${alpha})`; g.setLineDash(dash || []); g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke(); g.setLineDash([]); };
    if (gd.kind === 'ball') {
      const [gx, gy] = gd.ghost;
      if (!ghostOnly) line(cue[0], cue[1], gx, gy, 0.85);
      g.beginPath(); g.arc(gx, gy, R, 0, Math.PI * 2); g.strokeStyle = illegal ? 'rgba(255,110,95,.95)' : 'rgba(255,255,255,.9)'; g.lineWidth = lw; g.stroke();
      if (illegal) { const k = R * 0.55; line(gx - k, gy - k, gx + k, gy + k, 0); g.strokeStyle = 'rgba(255,110,95,.95)'; g.beginPath(); g.moveTo(gx - k, gy - k); g.lineTo(gx + k, gy + k); g.moveTo(gx + k, gy - k); g.lineTo(gx - k, gy + k); g.stroke(); return; }
      if (ghostOnly) return;
      const [ox, oy] = gd.objectDir, [bx, by] = gd.ball, len = 14 + gd.cut * 62;
      line(bx, by, bx + ox * len, by + oy * len, 0.9);
      const [tx, ty] = gd.cueDir, tl = 8 + (1 - gd.cut) * 34;
      if (tx || ty) line(gx, gy, gx + tx * tl, gy + ty * tl, 0.45, [this.px(4), this.px(4)]);
    } else {
      const [x, y] = gd.at;
      if (!ghostOnly) line(cue[0], cue[1], x, y, 0.8);
      g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = lw; g.stroke();
      if (!ghostOnly) line(x, y, x + gd.bounce[0] * 16, y + gd.bounce[1] * 16, 0.35, [this.px(4), this.px(4)]);
    }
  }

  drawPlacing({ at, ok }) {
    const g = this.g, [X, Y] = this.toScreen(at[0], at[1]), r = R * this.s, t = performance.now() / 1000;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.beginPath(); g.arc(X, Y, r * (1.75 + Math.sin(t * 4) * 0.12), 0, Math.PI * 2);
    g.strokeStyle = ok ? 'rgba(246,220,150,.95)' : 'rgba(255,100,90,.95)'; g.lineWidth = 2 * this.dpr; g.stroke();
    g.fillStyle = ok ? 'rgba(246,220,150,.95)' : 'rgba(255,100,90,.95)';
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2, ex = X + Math.cos(a) * r * 2.35, ey = Y + Math.sin(a) * r * 2.35, s = r * 0.42;
      g.beginPath(); g.moveTo(ex + Math.cos(a) * s, ey + Math.sin(a) * s); g.lineTo(ex + Math.cos(a + 2.2) * s, ey + Math.sin(a + 2.2) * s); g.lineTo(ex + Math.cos(a - 2.2) * s, ey + Math.sin(a - 2.2) * s); g.closePath(); g.fill();
    }
  }

  drawCue(cue, dir, pull, alpha) {
    const g = this.g; g.setTransform(...this.m); g.globalAlpha = alpha;
    const [dx, dy] = dir, nx = -dy, ny = dx, gap = R + 0.9 + pull;
    const at = (d, w) => { const x = cue[0] - dx * (gap + d), y = cue[1] - dy * (gap + d); return [[x + nx * w, y + ny * w], [x - nx * w, y - ny * w]]; };
    const piece = (d0, d1, w0, w1, colors) => {
      const [a0, b0] = at(d0, w0), [a1, b1] = at(d1, w1);
      const grad = g.createLinearGradient(a0[0], a0[1], b0[0], b0[1]);
      colors.forEach((c, i) => grad.addColorStop(i / (colors.length - 1), c));
      g.beginPath(); g.moveTo(...a0); g.lineTo(...a1); g.lineTo(...b1); g.lineTo(...b0); g.closePath(); g.fillStyle = grad; g.fill();
    };
    // shadow
    g.save(); g.translate(1.6, 2.2); g.globalAlpha = alpha * 0.35;
    const [s0, t0] = at(0, 0.7), [s1, t1] = at(146, 1.5); g.beginPath(); g.moveTo(...s0); g.lineTo(...s1); g.lineTo(...t1); g.lineTo(...t0); g.closePath(); g.fillStyle = '#000'; g.fill(); g.restore();
    g.globalAlpha = alpha;
    const w = (d) => 0.62 + (d / 146) * 0.85;
    piece(0, 0.9, w(0), w(0.9), ['#2c64c9', '#6aa4ff', '#2c64c9']);
    piece(0.9, 3.2, w(0.9), w(3.2), ['#cfc8b6', '#fffdf6', '#cfc8b6']);
    piece(3.2, 92, w(3.2), w(92), ['#b98f55', '#f1d9a8', '#b98f55']);
    piece(92, 94, w(92), w(94), ['#a8822e', '#f7df93', '#a8822e']);
    piece(94, 128, w(94), w(128), ['#120a06', '#5a2f18', '#120a06']);
    piece(128, 131, w(128), w(131), ['#a8822e', '#f7df93', '#a8822e']);
    piece(131, 146, w(131), w(146), ['#0b0705', '#2b170c', '#0b0705']);
    g.globalAlpha = 1;
  }
}

/* ---------- the game ---------- */
const view = new TableView($('#biTable'));
const ctl = {
  mode: null, state: null, me: 0, level: 'medium', names: ['', ''], bots: [false, false],
  aim: { dir: [1, 0], spin: [0, 0] }, display: null, place: null, power: 0,
  busy: false, anim: null, shownSeq: 0, lastKey: '', pending: null, receipt: '', rewarded: false, remote: null, endShown: false,
};
let table = null, room = null, loopOn = false, dirty = true, ended = false;
const humanSeat = () => (ctl.mode === 'online' ? ctl.me : ctl.mode === 'ai' ? 0 : ctl.state?.turn ?? 0);
// whose turn it is by the rules (a person here), and whether that person can act right now
const humanTurn = () => { const s = ctl.state; if (!s || s.winner !== null) return false; return ctl.mode === 'two' || (ctl.mode === 'ai' ? s.turn === 0 : s.turn === ctl.me); };
const myTurn = () => humanTurn() && !ctl.busy && !ctl.anim && (ctl.mode !== 'online' || (room?.status === 'playing' && !table?.busy));
const cuePos = () => (ctl.state?.inHand && ctl.place ? ctl.place : ctl.state?.balls?.[0] || null);

function invalidate() { dirty = true; if (!loopOn) { loopOn = true; requestAnimationFrame(loop); } }
function loop(now) {
  const animating = stepAnimation(now);
  const placing = ctl.state?.inHand && myTurn() && ctl.place;
  if (dirty || animating || placing || view.sinking.length || view.flash.length) { dirty = false; render(); }
  updateClock();
  if (animating || placing || view.sinking.length || view.flash.length || ctl.display?.moving || ctl.remote || (ctl.mode === 'online' && room?.turnDeadline)) requestAnimationFrame(loop);
  else loopOn = false;
}

function render() {
  const s = ctl.state; if (!s) return;
  const mine = myTurn(), cue = ctl.display ? view.balls[0] : cuePos();
  let aim = null, illegal = false;
  if (ctl.display) aim = { dir: ctl.display.dir, pull: ctl.display.pull || 0 };
  else if (mine && cue) aim = { dir: ctl.aim.dir, pull: ctl.power * 30 };
  else if (ctl.remote && cue) aim = { dir: ctl.remote.dir, pull: (ctl.remote.power || 0) * 30, alpha: 0.85 };
  if (aim && mine && !ctl.display) {
    const gd = aimGuide(view.balls, cue, aim.dir);
    illegal = gd.kind === 'ball' && !legalTargets(s, s.turn).includes(gd.n);
  }
  const placing = s.inHand && mine && ctl.place ? { at: ctl.place, ok: canPlace(s, ctl.place[0], ctl.place[1]) } : null;
  const remotePlace = !mine && ctl.remote?.cue && s.inHand ? ctl.remote.cue : null;
  if (remotePlace) view.balls[0] = remotePlace;
  view.draw({ aim, cue: remotePlace || cue, placing, kitchen: s.inHand && s.kitchen && (mine || remotePlace), guide: Boolean(aim) && !ctl.anim && (mine || ctl.display?.guide), illegal, ghostOnly: Boolean(ctl.remote && !mine) });
}

/* ---------- shot playback ---------- */
function stepAnimation(now) {
  const a = ctl.anim; if (!a) return false;
  if (a.strike) {
    const k = Math.min(1, (now - a.start) / a.strike);
    ctl.display = { dir: a.shot.dir, pull: (1 - k) * a.pull - k * 1.2, guide: false };
    if (k < 1) return true;
    a.strike = 0; a.start = now; ctl.display = null; Sound.cue(a.power || 0.5);
  }
  const frames = a.sim.frames, fi = (now - a.start) / (1000 / 60), i0 = Math.floor(fi), k = fi - i0;
  const el = now - a.start;
  while (a.ei < a.sim.events.length && a.sim.events[a.ei].t <= el) {
    const e = a.sim.events[a.ei++];
    if (e.type === 'ball') Sound.ball(e.speed); else if (e.type === 'rail') Sound.rail(e.speed);
    else if (e.type === 'pocket') { Sound.pocket(); view.flash.push({ p: e.b, t: now }); try { window.BS_AUDIO?.vibrate?.(18); } catch {} }
  }
  const last = frames.length - 1, f0 = frames[Math.min(i0, last)], f1 = frames[Math.min(i0 + 1, last)];
  for (let n = 0; n < 16; n++) {
    const p0 = f0[n], p1 = f1[n], prev = view.balls[n];
    let pos = null;
    if (p0 && p1) pos = [p0[0] + (p1[0] - p0[0]) * k, p0[1] + (p1[1] - p0[1]) * k];
    else if (p0) pos = p0;
    if (!pos && prev) { const pe = a.sim.events.find((e) => e.type === 'pocket' && e.a === n); view.sinking.push({ n, x: prev[0], y: prev[1], p: pe ? pe.b : nearestPocket(prev), t: now }); }
    if (pos && prev) rollAxes(view.axesOf(n), pos[0] - prev[0], pos[1] - prev[1]);
    view.balls[n] = pos;
  }
  if (i0 >= last) { const done = a.done; ctl.anim = null; done(); return false; }
  return true;
}
const nearestPocket = (b) => { let best = 0, d = Infinity; POCKETS.forEach((p, i) => { const dd = (p.x - b[0]) ** 2 + (p.y - b[1]) ** 2; if (dd < d) { d = dd; best = i; } }); return best; };
/** Plays a shot (from its starting positions) and ends on `next`'s positions. */
function animateShot(shot, next, { pull = 0.4 } = {}) {
  const sim = simulate(shot.before, shot, { record: true });
  view.balls = shot.before.map((b) => (b ? b.slice() : null));
  return new Promise((resolve) => {
    const finish = () => { view.balls = next.balls.map((b) => (b ? b.slice() : null)); invalidate(); resolve(sim); };
    if (reduced() || document.hidden) { finish(); for (const e of sim.events) if (e.type === 'pocket') { Sound.pocket(); break; } return; }
    ctl.anim = { sim, shot, start: performance.now(), ei: 0, strike: 110, pull: Math.max(6, pull * 30), power: pull, done: finish };
    invalidate();
  });
}

/* ---------- the plates, the status, the toast ---------- */
function seatOfPlate(i) { return ctl.mode === 'online' ? (i === 0 ? ctl.me : 1 - ctl.me) : i; }
function renderPlates() {
  const s = ctl.state; if (!s) return;
  for (let i = 0; i < 2; i++) {
    const seat = seatOfPlate(i), el = $('#plate' + i), p = s.players[seat] || {};
    el.classList.toggle('turn', s.winner === null && s.turn === seat);
    const name = ctl.names[seat] || p.name || 'لاعب';
    el.querySelector('.bi-who b').textContent = name;
    const tag = ctl.mode === 'ai' && seat === 1 ? { easy: 'سهل', medium: 'متوسط', hard: 'محترف' }[ctl.level] : ctl.bots[seat] ? 'آلي' : (ctl.mode === 'online' && seat === ctl.me) || (ctl.mode === 'ai' && seat === 0) ? 'أنت' : '';
    el.querySelector('.bi-who small').textContent = tag;
    el.querySelector('.bi-face i').textContent = (name.trim()[0] || '؟');
    const rack = el.querySelector('.bi-rack');
    const list = p.group ? (p.group === 'solid' ? SOLIDS : STRIPES) : null;
    const eight = p.group && onEight(s, seat);
    rack.innerHTML = list ? list.map((n) => `<i class="${n > 8 ? 'stripe' : ''}${s.balls[n] ? '' : ' gone'}" style="--c:${colorOf(n)}"></i>`).join('') + (eight ? '<i class="eight"></i>' : '') : '<i class="open"></i>'.repeat(7);
    el.setAttribute('aria-label', name + (p.group ? '، ' + GROUP_NAME[p.group] + '، باقي ' + remaining(s, p.group).length : ''));
  }
}
function setStatus(html) { $('#biStatus').innerHTML = html; }
function renderStatus() {
  const s = ctl.state; if (!s) return;
  $('#game').classList.toggle('idle', !myTurn());
  $('#biPower').classList.toggle('off', !myTurn());
  // while the balls roll the old line would mislead; the toast says what happened when they stop
  if (s.winner !== null || ctl.anim || (ctl.busy && ctl.mode !== 'ai')) { setStatus(''); return; }
  const name = ctl.names[s.turn] || s.players[s.turn]?.name || 'لاعب';
  const mine = (ctl.mode === 'online' && s.turn === ctl.me) || (ctl.mode === 'ai' && s.turn === 0) || ctl.mode === 'two';
  const who = ctl.mode === 'two' ? 'دور ' + esc(name) : mine ? 'دورك' : 'دور ' + esc(name);
  let hint = '';
  if (mine) {
    if (s.inHand && s.kitchen) hint = 'حط البيضاء ورا الخط واكسر';
    else if (s.inHand) hint = 'البيضاء بيدك: حرّكها وين ما تبي';
    else if (onEight(s, s.turn)) hint = 'باقي الثمانية!';
    else if (s.players[s.turn].group) hint = 'كراتك ' + GROUP_NAME[s.players[s.turn].group];
    else hint = 'الطاولة مفتوحة';
  } else if (ctl.mode === 'ai') hint = 'يفكر…';
  setStatus(`${who}${hint ? ' <small>· ' + hint + '</small>' : ''}`);
}
let toastTimer = 0;
function toast(html, kind = '', ms = 1900) {
  const t = $('#biToast'); t.innerHTML = html; t.className = 'bi-toast show ' + kind;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.className = 'bi-toast ' + kind; }, ms);
}
const FOUL = { scratch: 'البيضاء دخلت', no_hit: 'ما لمست ولا كرة', wrong_first: 'لمس كرة مو من كراته أول', eight_first: 'لمس الثمانية قبل وقتها', no_rail: 'ولا كرة وصلت الحافة', time: 'خلص الوقت' };
const FOUL_ME = { scratch: 'البيضاء دخلت', no_hit: 'ما لمست ولا كرة', wrong_first: 'لمست كرة مو من كراتك أول', eight_first: 'لمست الثمانية قبل وقتها', no_rail: 'ولا كرة وصلت الحافة', time: 'خلص وقتك' };
function announce(s) {
  const l = s.last; if (!l) return;
  const key = l.seq + ':' + l.result + ':' + (l.foul || '') + ':' + s.turn; if (key === ctl.lastKey) return; ctl.lastKey = key;
  const byMe = ctl.mode !== 'two' && l.by === humanSeat(), name = (seat) => esc(ctl.names[seat] || s.players[seat]?.name || 'لاعب');
  // «لـ» before a name; «الكمبيوتر» → «للكمبيوتر»
  const toName = (seat) => { const n = name(seat); return n.startsWith('ال') ? 'لل' + n.slice(2) : 'لـ' + n; };
  const nextName = s.turn === humanSeat() && ctl.mode !== 'two' ? 'لك' : toName(s.turn);
  if (l.result === 'win' || l.result === 'loss') return;
  if (l.foul) { Sound.foul(); toast(`خطأ: ${byMe ? FOUL_ME[l.foul] : FOUL[l.foul]}<small>البيضاء ${nextName} وين ما ${s.turn === humanSeat() && ctl.mode !== 'two' ? 'تبي' : 'يبي'}</small>`, 'foul', 2300); return; }
  if (l.group) { Sound.good(); const g = s.players[l.by].group; toast(`${byMe ? 'كراتك' : 'كرات ' + name(l.by)}: ${GROUP_NAME[g]} ${g === 'solid' ? '(من 1 إلى 7)' : '(من 9 إلى 15)'}`, 'good', 2200); return; }
  if (l.spotted) { toast('الثمانية دخلت في الكسر ورجعت مكانها'); return; }
  if (l.result === 'again' && l.potted.length) { if (byMe || ctl.mode === 'two') Sound.good(); toast(byMe || ctl.mode === 'two' ? 'دخلت! كمّل' : `${name(l.by)} دخّل وكمّل`, 'good', 1200); return; }
  if (l.result === 'pass' && ctl.mode !== 'ai') toast('الدور ' + nextName, '', 1100);
}

/* ---------- the clock (online) ---------- */
function updateClock() {
  for (let i = 0; i < 2; i++) {
    const el = $('#plate' + i), ring = el.querySelector('.bi-ring');
    const seat = seatOfPlate(i), s = ctl.state;
    let frac = 0;
    if (ctl.mode === 'online' && room?.status === 'playing' && room.turnDeadline && s && s.turn === seat && s.winner === null && !ctl.bots[seat]) {
      const base = Number(room.serverNow) || Date.now(), got = Number(room.clientReceivedAt) || Date.now(), now = base + (Date.now() - got);
      const total = Number(room.turnTotal) || 35000; frac = Math.max(0, Math.min(1, (Number(room.turnDeadline) - now) / total));
    }
    ring.style.strokeDashoffset = String(125.7 * (1 - frac));
    el.classList.toggle('late', frac > 0 && frac < 0.25);
  }
}

/* ---------- aiming and shooting ---------- */
function defaultAim() {
  const s = ctl.state, cue = cuePos(); if (!s || !cue) return;
  const targets = legalTargets(s, s.turn).map((n) => s.balls[n]).filter(Boolean);
  if (s.phase === 'break') { const dx = FOOT[0] - cue[0], dy = FOOT[1] - cue[1], l = Math.hypot(dx, dy) || 1; ctl.aim.dir = [dx / l, dy / l]; return; }
  let best = null, bd = Infinity;
  for (const b of targets) { const d = Math.hypot(b[0] - cue[0], b[1] - cue[1]); if (d < bd && d > R) { bd = d; best = b; } }
  if (best) { const dx = best[0] - cue[0], dy = best[1] - cue[1], l = Math.hypot(dx, dy); ctl.aim.dir = [dx / l, dy / l]; }
}
function startPlacing() {
  const s = ctl.state; if (!s?.inHand) { ctl.place = null; return; }
  const was = s.balls[0];
  if (s.kitchen) ctl.place = canPlace(s, HEAD_X - 14, W / 2) ? [HEAD_X - 14, W / 2] : nearestPlace(s, HEAD_X - 14, W / 2);
  else ctl.place = was && canPlace(s, was[0], was[1]) ? was.slice() : nearestPlace(s, L * 0.25, W / 2);
}
function beginTurn() {
  ctl.power = 0; setPower(0); ctl.remote = null;
  if (ctl.state?.inHand) startPlacing(); else ctl.place = null;
  if (humanTurn()) defaultAim();
  renderPlates(); renderStatus(); invalidate();
}
function setPower(p) { ctl.power = p; const el = $('#biPower'); el.style.setProperty('--p', p.toFixed(3)); el.setAttribute('aria-valuenow', String(Math.round(p * 100))); el.classList.toggle('on', p > 0.02); el.querySelector('b').textContent = p > 0.02 ? Math.round(p * 100) + '%' : 'اسحب العصا وأفلتها'; }
let aimSent = 0, aimTimer = 0;
function shareAim() {
  if (ctl.mode !== 'online' || !myTurn()) return;
  const send = () => { aimSent = Date.now(); table?.send('pool_aim', { dir: ctl.aim.dir.map((v) => Math.round(v * 1000) / 1000), power: Math.round(ctl.power * 100) / 100, cue: ctl.state?.inHand && ctl.place ? ctl.place.map((v) => Math.round(v * 10) / 10) : null }); };
  clearTimeout(aimTimer);
  const gap = Date.now() - aimSent; if (gap > 260) send(); else aimTimer = setTimeout(send, 260 - gap);
}
async function shoot(power) {
  if (!myTurn() || power < 0.02) { setPower(0); invalidate(); return; }
  const s = ctl.state, seat = s.turn, input = { dir: ctl.aim.dir.slice(), power, spin: ctl.aim.spin.slice() };
  if (s.inHand) {
    if (!ctl.place || !canPlace(s, ctl.place[0], ctl.place[1])) { toast('ما تقدر تحط البيضاء هنا', 'foul'); setPower(0); invalidate(); return; }
    input.cue = ctl.place.slice();
  }
  Sound.unlock();
  let next;
  try { next = playPoolShot(s, seat, input); } catch { toast('الضربة ما تنفع، جرّب مرة ثانية', 'foul'); setPower(0); return; }
  setPower(0);
  if (ctl.mode === 'online') {
    if (!table?.send('pool_shot', { dir: input.dir, power: input.power, spin: input.spin, cue: input.cue })) { invalidate(); return; }
    ctl.busy = true; ctl.place = null; renderStatus();
    const pending = { seq: next.shots, prev: s, next };
    ctl.pending = pending;
    pending.done = animateShot(next.shot, next, { pull: power });
    pending.timer = setTimeout(() => { if (ctl.pending === pending) { revertPending('تأخر الاتصال بالطاولة'); } }, 20000);
    return;
  }
  ctl.busy = true; ctl.place = null; renderStatus();
  await animateShot(next.shot, next, { pull: power });
  ctl.state = next; ctl.busy = false;
  afterShot();
}
function revertPending(message) {
  const p = ctl.pending; if (!p) return;
  clearTimeout(p.timer); ctl.pending = null;
  if (ctl.anim) { const done = ctl.anim.done; ctl.anim = null; done(); }
  ctl.state = p.prev; view.balls = p.prev.balls.map((b) => (b ? b.slice() : null)); ctl.busy = false;
  toast(esc(message || 'ما وصلت الضربة'), 'foul'); beginTurn();
}
function afterShot() {
  const s = ctl.state;
  announce(s); renderPlates();
  if (s.winner !== null) { showEnd(); return; }
  beginTurn();
  if (ctl.mode === 'ai' && s.turn === 1) aiTurn();
}

/* ---------- the computer player (practice) ---------- */
async function aiTurn() {
  if (ctl.mode !== 'ai' || ctl.state?.turn !== 1 || ctl.state.winner !== null || ended) return;
  ctl.busy = true; renderStatus();
  const s = ctl.state;
  await wait(reduced() ? 120 : 520);
  if (ctl.mode !== 'ai' || ended) return;
  const shot = choosePoolShot(s, ctl.level, Math.random);
  // the player puts the cue ball down, turns the cue onto the line, draws it back, strikes
  if (shot.cue) await glide(s.balls[0] || [L * 0.25, W / 2], shot.cue, 420);
  const from = ctl.aim.dir.slice();
  await turnTo(from, shot.dir, reduced() ? 60 : 640);
  await pullBack(shot.power, reduced() ? 60 : 380);
  const next = playPoolShot(s, 1, shot);
  ctl.display = null;
  await animateShot(next.shot, next, { pull: shot.power });
  ctl.state = next; ctl.busy = false;
  afterShot();
}
function tween(ms, fn) { return new Promise((resolve) => { const t0 = performance.now(); const tick = (now) => { const k = Math.min(1, (now - t0) / ms); fn(k * k * (3 - 2 * k)); invalidate(); if (k < 1) requestAnimationFrame(tick); else resolve(); }; requestAnimationFrame(tick); }); }
function glide(from, to, ms) { return tween(ms, (k) => { view.balls[0] = [from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k]; }); }
function turnTo(a, b, ms) {
  const a0 = Math.atan2(a[1], a[0]); let d = Math.atan2(b[1], b[0]) - a0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  ctl.display = { dir: a.slice(), pull: 0, guide: true, moving: true };
  return tween(ms, (k) => { const t = a0 + d * k; ctl.display.dir = [Math.cos(t), Math.sin(t)]; }).then(() => { ctl.display.dir = b.slice(); ctl.aim.dir = b.slice(); });
}
function pullBack(power, ms) { return tween(ms, (k) => { if (ctl.display) ctl.display.pull = k * power * 30; }); }

/* ---------- input ---------- */
function canvasPoint(ev) { const r = view.canvas.getBoundingClientRect(); return view.toWorld((ev.clientX - r.left) * view.dpr, (ev.clientY - r.top) * view.dpr); }
let drag = null;
view.canvas.addEventListener('pointerdown', (ev) => {
  Sound.unlock();
  if (!myTurn()) return;
  const [x, y] = canvasPoint(ev), s = ctl.state;
  view.canvas.setPointerCapture?.(ev.pointerId);
  if (s.inHand && ctl.place && Math.hypot(x - ctl.place[0], y - ctl.place[1]) < R * 3.4) { drag = { kind: 'place', dx: ctl.place[0] - x, dy: ctl.place[1] - y }; return; }
  drag = { kind: 'aim' }; aimAt(x, y);
});
view.canvas.addEventListener('pointermove', (ev) => {
  if (!drag || !myTurn()) return;
  const [x, y] = canvasPoint(ev);
  if (drag.kind === 'place') {
    const s = ctl.state, kx = s.kitchen ? HEAD_X : L - R;
    ctl.place = [Math.max(R, Math.min(kx, x + drag.dx)), Math.max(R, Math.min(W - R, y + drag.dy))];
    shareAim(); invalidate();
  } else aimAt(x, y);
});
const endDrag = () => {
  if (drag?.kind === 'place' && ctl.state?.inHand && ctl.place && !canPlace(ctl.state, ctl.place[0], ctl.place[1])) {
    const near = nearestPlace(ctl.state, ctl.place[0], ctl.place[1]); if (near) ctl.place = near;
  }
  drag = null; invalidate();
};
view.canvas.addEventListener('pointerup', endDrag); view.canvas.addEventListener('pointercancel', endDrag);
function aimAt(x, y) {
  const cue = cuePos(); if (!cue) return;
  const dx = x - cue[0], dy = y - cue[1], l = Math.hypot(dx, dy); if (l < R * 0.8) return;
  ctl.aim.dir = [dx / l, dy / l]; shareAim(); invalidate();
}
function rotateAim(a) { const [x, y] = ctl.aim.dir, c = Math.cos(a), s = Math.sin(a); const nx = x * c - y * s, ny = x * s + y * c, l = Math.hypot(nx, ny); ctl.aim.dir = [nx / l, ny / l]; shareAim(); invalidate(); }
// fine aim
{
  const el = $('#biFine'); let last = null, off = 0;
  el.addEventListener('pointerdown', (ev) => { if (!myTurn()) return; last = ev.clientX; el.setPointerCapture?.(ev.pointerId); });
  el.addEventListener('pointermove', (ev) => { if (last === null || !myTurn()) return; const dx = ev.clientX - last; last = ev.clientX; off += dx; el.style.setProperty('--fine', off + 'px'); rotateAim(dx * 0.0011); });
  const up = () => { last = null; }; el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('keydown', (ev) => { if (!myTurn()) return; if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') { ev.preventDefault(); rotateAim((ev.key === 'ArrowRight' ? 1 : -1) * (ev.shiftKey ? 0.002 : 0.008)); } });
}
// power: pull the cue down, let go to strike
{
  // a groove under the table (pull the cue sideways) or a rail at the side (pull it down)
  const el = $('#biPower'); let from = null;
  el.addEventListener('pointerdown', (ev) => { Sound.unlock(); if (!myTurn()) return; from = [ev.clientX, ev.clientY]; el.setPointerCapture?.(ev.pointerId); });
  el.addEventListener('pointermove', (ev) => {
    if (from === null || !myTurn()) return;
    const r = el.getBoundingClientRect(), tall = r.height > r.width;
    const p = tall ? (ev.clientY - from[1]) / (r.height * 0.82) : Math.abs(ev.clientX - from[0]) / (r.width * 0.8);
    setPower(Math.max(0, Math.min(1, p))); shareAim(); invalidate();
  });
  const up = () => { if (from === null) return; from = null; shoot(ctl.power); };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', () => { from = null; setPower(0); invalidate(); });
  el.addEventListener('keydown', (ev) => {
    if (!myTurn()) return;
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') { ev.preventDefault(); setPower(Math.max(0, Math.min(1, ctl.power + (ev.key === 'ArrowDown' ? 0.05 : -0.05)))); invalidate(); }
    else if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); shoot(ctl.power || 0.5); }
  });
}
view.canvas.addEventListener('keydown', (ev) => {
  if (!myTurn()) return;
  if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') { ev.preventDefault(); rotateAim((ev.key === 'ArrowRight' ? 1 : -1) * (ev.shiftKey ? 0.002 : 0.012)); }
  else if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') { ev.preventDefault(); setPower(Math.max(0, Math.min(1, ctl.power + (ev.key === 'ArrowDown' ? 0.05 : -0.05)))); invalidate(); }
  else if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); shoot(ctl.power || 0.5); }
});
// spin
{
  const sheet = $('#biSpinSheet'), ball = $('#biSpinBall'), btn = $('#biSpinBtn');
  const paint = () => { for (const el of [ball, btn]) { el.style.setProperty('--sx', ctl.aim.spin[0].toFixed(3)); el.style.setProperty('--sy', ctl.aim.spin[1].toFixed(3)); } };
  const setFrom = (ev) => { const r = ball.getBoundingClientRect(); let sx = ((ev.clientX - r.left) / r.width - 0.5) / 0.39, sy = -((ev.clientY - r.top) / r.height - 0.5) / 0.39; const l = Math.hypot(sx, sy); if (l > 1) { sx /= l; sy /= l; } ctl.aim.spin = [Math.round(sx * 100) / 100, Math.round(sy * 100) / 100]; paint(); };
  let on = false;
  btn.addEventListener('click', () => { if (!myTurn()) return; sheet.hidden = false; paint(); ball.focus(); });
  ball.addEventListener('pointerdown', (ev) => { on = true; ball.setPointerCapture?.(ev.pointerId); setFrom(ev); });
  ball.addEventListener('pointermove', (ev) => { if (on) setFrom(ev); });
  ball.addEventListener('pointerup', () => { on = false; });
  ball.addEventListener('keydown', (ev) => { const k = { ArrowUp: [0, 0.1], ArrowDown: [0, -0.1], ArrowLeft: [-0.1, 0], ArrowRight: [0.1, 0] }[ev.key]; if (!k) return; ev.preventDefault(); let [sx, sy] = [ctl.aim.spin[0] + k[0], ctl.aim.spin[1] + k[1]]; const l = Math.hypot(sx, sy); if (l > 1) { sx /= l; sy /= l; } ctl.aim.spin = [Math.round(sx * 100) / 100, Math.round(sy * 100) / 100]; paint(); });
  $('#biSpinReset').addEventListener('click', () => { ctl.aim.spin = [0, 0]; paint(); });
  $('#biSpinDone').addEventListener('click', () => { sheet.hidden = true; btn.focus(); });
  sheet.addEventListener('click', (ev) => { if (ev.target === sheet) sheet.hidden = true; });
  paint();
}

/* ---------- screens ---------- */
function fitTable() {
  const wrap = $('#biWrap'), r = wrap.getBoundingClientRect(); if (r.width < 10 || r.height < 10) return;
  view.canvas.style.width = r.width + 'px'; view.canvas.style.height = r.height + 'px';
  view.fit(r.width, r.height, r.height > r.width * 1.05);
  invalidate();
}
new ResizeObserver(() => { if (!$('#game').hidden) fitTable(); }).observe($('#biWrap'));
function showGame() {
  if ($('#game').hidden) { $('#game').hidden = false; document.body.classList.add('bi-playing'); requestAnimationFrame(fitTable); }
  $('#biEnd').hidden = true;
}
function showMenu() {
  $('#game').hidden = true; $('#biEnd').hidden = true; $('#biSpinSheet').hidden = true; document.body.classList.remove('bi-playing');
  ctl.anim = null; ctl.display = null; ctl.busy = false; ended = true; drawHero();
}
function startLocal(mode) {
  ended = false; ctl.mode = mode; ctl.endShown = false; ctl.rewarded = false; ctl.receipt = 'billiards:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const me = window.BS_GAME_MENU?.playerName?.() || 'أنت';
  ctl.names = mode === 'ai' ? [me, 'الكمبيوتر'] : [$('#biName1').value.trim() || 'لاعب 1', $('#biName2').value.trim() || 'لاعب 2'];
  ctl.bots = mode === 'ai' ? [false, true] : [false, false];
  ctl.state = createPoolGame(ctl.names, { first: mode === 'ai' ? (Math.random() < 0.5 ? 0 : 1) : 0 });
  ctl.lastKey = ''; ctl.shownSeq = 0; view.axes.clear(); view.balls = ctl.state.balls.map((b) => (b ? b.slice() : null));
  showGame(); beginTurn();
  toast(ctl.state.turn === 0 || mode === 'two' ? (mode === 'two' ? 'يكسر ' + esc(ctl.names[0]) : 'أنت تكسر') : 'الكمبيوتر يكسر', '', 1300);
  if (mode === 'ai' && ctl.state.turn === 1) aiTurn();
}
function showEnd() {
  if (ctl.endShown) return; ctl.endShown = true;
  const s = ctl.state, l = s.last, w = s.winner, card = $('#biEnd .bi-sheet-card');
  const iWon = ctl.mode === 'two' ? true : w === humanSeat();
  const name = esc(ctl.names[w] || s.players[w]?.name || 'لاعب');
  $('#biEndTitle').innerHTML = ctl.mode === 'two' ? `${name} فاز` : iWon ? 'فزت!' : `${name} فاز`;
  const loser = esc(ctl.names[1 - w] || s.players[1 - w]?.name || '');
  $('#biEndText').innerHTML = l?.result === 'win' ? (ctl.mode === 'two' || !iWon ? `${name} نظّف كراته ودخّل الثمانية.` : 'نظّفت كراتك ودخّلت الثمانية.') : (l?.foul ? `الثمانية دخلت مع خطأ من ${loser}.` : `الثمانية دخلت قبل وقتها من ${loser}.`);
  card.classList.toggle('won', iWon);
  $('#biAgain').textContent = ctl.mode === 'online' ? (room?.publicMatch ? 'مباراة جديدة' : room?.me?.role === 'host' ? 'جولة جديدة' : 'بانتظار المضيف') : 'مباراة جديدة';
  $('#biAgain').disabled = ctl.mode === 'online' && !room?.publicMatch && room?.me?.role !== 'host';
  setTimeout(() => { if (ctl.endShown) $('#biEnd').hidden = false; }, 700);
  if (iWon) Sound.win(); else Sound.foul();
  if (!ctl.rewarded) {
    ctl.rewarded = true;
    if (ctl.mode === 'online') window.BS_CAREER?.refresh?.()?.catch?.(() => {});
    else if (ctl.mode === 'ai') window.BS_CAREER?.record?.({ id: ctl.receipt, game: 'billiards', win: w === 0 })?.catch?.(() => {});
  }
}
$('#biAgain').addEventListener('click', () => { $('#biEnd').hidden = true; if (ctl.mode === 'online') table?.again(); else startLocal(ctl.mode); });
$('#biToMenu').addEventListener('click', () => { if (ctl.mode === 'online') table?.leave(); showMenu(); });
let exitArmed = 0;
$('#biExit').addEventListener('click', () => {
  const live = ctl.state && ctl.state.winner === null && ctl.state.shots > 0;
  if (live && Date.now() - exitArmed > 2500) { exitArmed = Date.now(); toast('اضغط ✕ مرة ثانية للخروج', '', 1600); return; }
  if (ctl.mode === 'online') table?.leave(); showMenu();
});

/* ---------- online: one table among the board tables ---------- */
async function apply(next, { animate }) {
  room = next;
  const s = next.state; if (!s || s.game !== 'pool') return;
  if (ctl.mode !== 'online' || $('#game').hidden || ctl.match !== (next.startedAt || 0)) {
    ctl.match = next.startedAt || 0;
    ended = false; ctl.mode = 'online'; ctl.endShown = false; ctl.rewarded = false; ctl.shownSeq = s.shot ? s.shot.seq - (next.stepOf ? 1 : 0) : 0; ctl.lastKey = ''; view.axes.clear();
    ctl.state = s; view.balls = (s.shot && next.stepOf ? s.shot.before : s.balls).map((b) => (b ? b.slice() : null)); showGame();
  }
  ctl.me = next.me?.index ?? 0;
  ctl.names = [0, 1].map((i) => next.players?.find((p) => p.index === i)?.name || s.players[i]?.name || 'لاعب');
  ctl.bots = [0, 1].map((i) => Boolean(next.players?.find((p) => p.index === i)?.bot));
  if (s.shot && s.shot.seq > ctl.shownSeq) {
    if (ctl.pending && ctl.pending.seq === s.shot.seq) { clearTimeout(ctl.pending.timer); await ctl.pending.done; ctl.pending = null; }
    else if (animate && !document.hidden) { ctl.remote = null; ctl.busy = true; await animateShot(s.shot, s, { pull: 0.5 }); }
    ctl.shownSeq = s.shot.seq;
  }
  ctl.state = s; ctl.busy = Boolean(ctl.pending);
  if (!ctl.anim) view.balls = s.balls.map((b) => (b ? b.slice() : null));
  announce(s); renderPlates();
  if (s.winner !== null) { showEnd(); return; }
  if (!ctl.pending) beginTurn();
  // the room's step player is still finishing this state: look again once it has
  setTimeout(() => { renderStatus(); invalidate(); }, 0);
}
window.addEventListener('bs-pool-aim', (ev) => {
  const d = ev.detail, s = ctl.state; if (ctl.mode !== 'online' || !s || d.seat !== s.turn || d.seat === ctl.me || ctl.anim) return;
  ctl.remote = { dir: d.dir, power: d.power, cue: d.cue }; invalidate();
});
try {
  table = createTable({
    game: 'billiards',
    quickNote: 'طاولة لاثنين: لاعب حقيقي، وإذا ما حصلنا أحد خلال 10 ثواني يلعب معك منافس آلي.',
    roomNote: 'أنشئ غرفة وارسل الرمز لخويّك.',
    lobbyNote: (next, isPublic) => (isPublic ? 'تبدأ بعد العد. إذا ما دخل أحد يلعب معك منافس آلي.' : 'أرسل الرمز لخويّك. تبدأ إذا ضغطت «ابدأ»، وإذا ما حضر يلعب منافس آلي.'),
    apply,
    onLobby: () => { if (!$('#game').hidden) showMenu(); setMode('online'); },
    onMenu: () => { if (!$('#game').hidden) showMenu(); },
    onStatus: () => {},
    onError: (message) => { if (ctl.pending) revertPending(message); else window.BS_PLATFORM?.toast?.(message); },
  });
} catch (error) { console.error('billiards online unavailable', error); }

/* ---------- the menu ---------- */
function setMode(mode) {
  for (const b of document.querySelectorAll('.bi-modes button')) b.setAttribute('aria-checked', String(b.dataset.mode === mode));
  for (const p of document.querySelectorAll('.bi-panel')) p.hidden = p.dataset.panel !== mode;
  try { localStorage.setItem('bs-billiards-mode', mode); } catch {}
}
for (const b of document.querySelectorAll('.bi-modes button')) b.addEventListener('click', () => setMode(b.dataset.mode));
function setLevel(v) { ctl.level = v; for (const b of document.querySelectorAll('#biLevel button')) b.setAttribute('aria-checked', String(b.dataset.v === v)); try { localStorage.setItem('bs-billiards-level', v); } catch {} }
for (const b of document.querySelectorAll('#biLevel button')) b.addEventListener('click', () => setLevel(b.dataset.v));
$('#biStartAi').addEventListener('click', () => { Sound.unlock(); startLocal('ai'); });
$('#biStartTwo').addEventListener('click', () => { Sound.unlock(); startLocal('two'); });
{
  let mode = 'online', level = 'medium';
  try { mode = localStorage.getItem('bs-billiards-mode') || 'online'; level = localStorage.getItem('bs-billiards-level') || 'medium'; } catch {}
  if (/[?&]room=\d{6}/.test(location.search)) mode = 'online';
  setMode(['online', 'ai', 'two'].includes(mode) ? mode : 'online'); setLevel(['easy', 'medium', 'hard'].includes(level) ? level : 'medium');
}
// sound buttons
function paintMute() { const muted = Boolean(window.BS_AUDIO?.getSettings?.().muted); for (const id of ['#biMute', '#biSound']) { const b = $(id); if (!b) continue; b.textContent = muted ? '🔇' : '🔊'; b.setAttribute('aria-pressed', String(muted)); } }
for (const id of ['#biMute', '#biSound']) $(id)?.addEventListener('click', () => { window.BS_AUDIO?.toggleMuted?.(); paintMute(); Sound.unlock(); });
paintMute();

/* ---------- the cover on the menu ---------- */
const hero = new TableView($('#biHero'));
function drawHero() {
  const c = $('#biHero'), w = c.clientWidth || 360, h = Math.round((w * 420) / 760);
  hero.fit(w, h, false, { focus: [100, 6, L + 12, W - 6], flip: true });
  let seed = 5; const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const g = createPoolGame(['', ''], { rng });
  hero.balls = g.balls.map((b) => (b ? b.slice() : null)); hero.balls[0] = [138, W / 2 + 11];
  hero.axes.clear(); for (let n = 1; n < 16; n++) rollAxes(hero.axesOf(n), (rng() - 0.5) * 2.6, (rng() - 0.5) * 2.6);
  const dx = FOOT[0] - hero.balls[0][0], dy = FOOT[1] - hero.balls[0][1], l = Math.hypot(dx, dy);
  hero.draw({ aim: { dir: [dx / l, dy / l], pull: 7 }, cue: hero.balls[0], guide: true });
}
new ResizeObserver(() => { if ($('#game').hidden) drawHero(); }).observe($('#biHero'));
if (document.fonts?.ready) document.fonts.ready.then(() => { if ($('#game').hidden) drawHero(); });
drawHero();
document.addEventListener('visibilitychange', () => { if (!document.hidden) invalidate(); });
window.BS_BILLIARDS = {
  ctl, view, get room() { return room; }, startLocal, shoot, setPower, rotateAim, begin: beginTurn, drawHero, heroView: hero,
  rack: (seed) => { let x = seed || 5; const rng = () => { x = (x * 16807) % 2147483647; return x / 2147483647; }; return createPoolGame(['', ''], { rng }).balls.map((b) => (b ? b.slice() : null)); },
  tiltHero: (seed) => { let x = seed || 5; const rng = () => { x = (x * 16807) % 2147483647; return x / 2147483647; }; hero.axes.clear(); for (let n = 1; n < 16; n++) rollAxes(hero.axesOf(n), (rng() - 0.5) * 2.6, (rng() - 0.5) * 2.6); },
};
