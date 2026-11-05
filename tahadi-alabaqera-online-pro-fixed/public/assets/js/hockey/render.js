// Air Hockey — drawing. The table is painted in table units (x across 0..W, y along 0..L); a single transform turns it
// to fit a portrait screen (goals top and bottom) or a landscape one (goals left and right), so nothing else changes.
import { W, L, GOAL_W, PUCK_R, STRIKER_R } from './core.js';

export const FRAME = 46; // rail thickness around the playfield, in table units
export const THEMES = {
  neon: {
    name: 'نيون', surfaceA: '#0d1a3d', surfaceB: '#070d24', line: '#38e8ff', line2: '#ff3fd0', hole: '#7ad8ff', glowA: '#38e8ff', glowB: '#ff3fd0',
    railA: '#2b3a78', railB: '#10183a', railEdge: '#7ad8ff', goalA: '#ff3fd0', goalB: '#38e8ff', bg: '#050816', bg2: '#12204f', text: '#dff7ff', grid: true,
  },
  ice: {
    name: 'جليد', surfaceA: '#e9f6ff', surfaceB: '#bfe0f5', line: '#2f7fd1', line2: '#e0405a', hole: '#7fb2d8', glowA: '#6cc1ff', glowB: '#ff7a90',
    railA: '#f4f8fc', railB: '#8ea6bd', railEdge: '#ffffff', goalA: '#e0405a', goalB: '#2f7fd1', bg: '#0b2a4a', bg2: '#2e6a9e', text: '#0e2a45', grid: true,
  },
  royal: {
    name: 'ملكي', surfaceA: '#0f5a46', surfaceB: '#072e25', line: '#f2cf76', line2: '#f2cf76', hole: '#9be3c4', glowA: '#f2cf76', glowB: '#ffe9a8',
    railA: '#6a4a14', railB: '#241606', railEdge: '#f7dc8a', goalA: '#f2cf76', goalB: '#f2cf76', bg: '#06130f', bg2: '#0e3a2d', text: '#fff1c4', grid: false,
  },
};
export const PUCKS = [
  { id: 'crystal', name: 'كريستال' }, { id: 'gold', name: 'ذهب' }, { id: 'plasma', name: 'بلازما' }, { id: 'ember', name: 'جمر' },
];
export const STRIKER_COLORS = ['#ff4d5e', '#2fd6a1', '#39a7ff', '#ffc83d', '#b57cff', '#ff8a3d'];

const shade = (hex, amt) => {
  const n = parseInt(hex.slice(1), 16), f = (v) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(f).map((v) => v.toString(16).padStart(2, '0')).join('');
};
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }

// ---------- the table (static) ----------
export function paintTable(ctx, th) {
  const T = FRAME, gx0 = (W - GOAL_W) / 2, gx1 = (W + GOAL_W) / 2;
  // floor shadow
  ctx.save(); ctx.shadowColor = '#000b'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 18; ctx.fillStyle = th.railB; rr(ctx, -T, -T, W + 2 * T, L + 2 * T, 54); ctx.fill(); ctx.restore();
  // the rail: a bevelled frame
  let g = ctx.createLinearGradient(-T, -T, W + T, L + T); g.addColorStop(0, th.railA); g.addColorStop(0.5, th.railB); g.addColorStop(1, th.railA);
  ctx.fillStyle = g; rr(ctx, -T, -T, W + 2 * T, L + 2 * T, 54); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = th.railEdge; ctx.globalAlpha = 0.55; rr(ctx, -T + 3, -T + 3, W + 2 * T - 6, L + 2 * T - 6, 51); ctx.stroke(); ctx.globalAlpha = 1;
  ctx.lineWidth = 2; ctx.strokeStyle = '#0008'; rr(ctx, -T + 12, -T + 12, W + 2 * T - 24, L + 2 * T - 24, 44); ctx.stroke();
  // the playfield
  ctx.save(); rr(ctx, 0, 0, W, L, 26); ctx.clip();
  g = ctx.createLinearGradient(0, 0, 0, L); g.addColorStop(0, th.surfaceB); g.addColorStop(0.5, th.surfaceA); g.addColorStop(1, th.surfaceB); ctx.fillStyle = g; ctx.fillRect(0, 0, W, L);
  const v = ctx.createRadialGradient(W / 2, L / 2, 80, W / 2, L / 2, L * 0.7); v.addColorStop(0, '#ffffff12'); v.addColorStop(1, '#00000055'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, L);
  if (th.grid) { ctx.fillStyle = th.hole; ctx.globalAlpha = 0.11; for (let y = 14; y < L; y += 24) for (let x = (Math.floor(y / 24) % 2 ? 26 : 14); x < W; x += 24) { ctx.beginPath(); ctx.arc(x, y, 1.9, 0, 6.3); ctx.fill(); } ctx.globalAlpha = 1; }
  else { // royal: a fine woven pattern
    ctx.strokeStyle = th.line; ctx.globalAlpha = 0.045; ctx.lineWidth = 1; for (let i = -L; i < W + L; i += 22) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + L, L); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i + L, 0); ctx.lineTo(i, L); ctx.stroke(); } ctx.globalAlpha = 1; }
  // markings
  ctx.lineCap = 'round';
  const mark = (col, w, glow) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.shadowColor = glow || col; ctx.shadowBlur = glow === null ? 0 : 14; };
  mark(th.line, 5); ctx.beginPath(); ctx.moveTo(10, L / 2); ctx.lineTo(W - 10, L / 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(W / 2, L / 2, 92, 0, 6.3); ctx.stroke();
  ctx.shadowBlur = 0; ctx.fillStyle = th.line; ctx.beginPath(); ctx.arc(W / 2, L / 2, 10, 0, 6.3); ctx.fill();
  mark(th.line2, 5); ctx.beginPath(); ctx.arc(W / 2, 0, 150, 0.0, Math.PI); ctx.stroke(); ctx.beginPath(); ctx.arc(W / 2, L, 150, Math.PI, 2 * Math.PI); ctx.stroke(); ctx.shadowBlur = 0;
  ctx.fillStyle = th.line; ctx.globalAlpha = 0.8; for (const [x, y] of [[110, 250], [W - 110, 250], [110, L - 250], [W - 110, L - 250]]) { ctx.beginPath(); ctx.arc(x, y, 9, 0, 6.3); ctx.fill(); ctx.strokeStyle = th.line; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, 26, 0, 6.3); ctx.stroke(); } ctx.globalAlpha = 1;
  ctx.restore();
  // goal mouths (a recess in the end rail, glowing)
  for (const top of [true, false]) {
    const y0 = top ? -T + 6 : L - 4, h = T - 2;
    const gg = ctx.createLinearGradient(0, top ? 0 : L, 0, top ? -T : L + T); gg.addColorStop(0, '#000'); gg.addColorStop(1, '#000');
    ctx.fillStyle = '#04060c'; rr(ctx, gx0, top ? -T + 4 : L - 6, GOAL_W, T + 2, 12); ctx.fill();
    const col = top ? th.goalB : th.goalA, gl = ctx.createLinearGradient(0, top ? 0 : L, 0, top ? -T : L + T);
    gl.addColorStop(0, col + 'cc'); gl.addColorStop(1, col + '00'); ctx.fillStyle = gl; ctx.fillRect(gx0 + 6, top ? -T + 6 : L - 4, GOAL_W - 12, T - 4);
    ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.shadowColor = col; ctx.shadowBlur = 18; ctx.beginPath(); ctx.moveTo(gx0, top ? 0 : L); ctx.lineTo(gx1, top ? 0 : L); ctx.stroke(); ctx.shadowBlur = 0;
    // posts
    for (const px of [gx0, gx1]) { const py = top ? 0 : L, pg = ctx.createRadialGradient(px - 3, py - 3, 1, px, py, 15); pg.addColorStop(0, '#fff'); pg.addColorStop(0.4, th.railEdge); pg.addColorStop(1, th.railB); ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(px, py, 14, 0, 6.3); ctx.fill(); }
  }
}

// ---------- pucks and strikers ----------
export function drawPuck(ctx, x, y, r, skin, t, light, speed = 0) {
  const lx = light.x * r * 0.38, ly = light.y * r * 0.38;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = '#0007'; ctx.beginPath(); ctx.ellipse(-lx * 0.9, -ly * 0.9, r * 1.04, r * 1.04, 0, 0, 6.3); ctx.fill();
  const rim = { crystal: '#5fe6ff', gold: '#ffd35a', plasma: '#b57cff', ember: '#ff7a2e' }[skin] || '#ffffff';
  ctx.shadowColor = rim; ctx.shadowBlur = 12 + Math.min(18, speed / 90);
  let g;
  if (skin === 'gold') { g = ctx.createRadialGradient(lx, ly, 2, 0, 0, r); g.addColorStop(0, '#fff3b0'); g.addColorStop(0.45, '#f0b429'); g.addColorStop(1, '#8a5a06'); }
  else if (skin === 'plasma') { g = ctx.createRadialGradient(lx, ly, 2, 0, 0, r); g.addColorStop(0, '#3a2a7a'); g.addColorStop(1, '#0b0620'); }
  else if (skin === 'ember') { g = ctx.createRadialGradient(lx, ly, 2, 0, 0, r); g.addColorStop(0, '#ffd27a'); g.addColorStop(0.5, '#ff6a1f'); g.addColorStop(1, '#6b1500'); }
  else { g = ctx.createRadialGradient(lx, ly, 2, 0, 0, r); g.addColorStop(0, '#e9fdff'); g.addColorStop(0.5, '#6adcf5'); g.addColorStop(1, '#126b8c'); }
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.3); ctx.fill(); ctx.shadowBlur = 0;
  // rim + inner ring
  ctx.lineWidth = r * 0.12; ctx.strokeStyle = skin === 'plasma' ? `hsl(${(t * 140) % 360},95%,62%)` : shade(rim, -0.12); ctx.beginPath(); ctx.arc(0, 0, r * 0.93, 0, 6.3); ctx.stroke();
  ctx.lineWidth = r * 0.07; ctx.strokeStyle = skin === 'gold' ? '#fff3b055' : '#ffffff40'; ctx.beginPath(); ctx.arc(0, 0, r * 0.58, 0, 6.3); ctx.stroke();
  if (skin === 'crystal') { ctx.fillStyle = '#ffffff55'; ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.1); ctx.lineTo(0, -r * 0.62); ctx.lineTo(r * 0.45, -r * 0.05); ctx.lineTo(0, r * 0.16); ctx.closePath(); ctx.fill(); }
  if (skin === 'gold') { ctx.fillStyle = '#8a5a0666'; for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; ctx.fillRect(Math.cos(a) * r * 0.76 - 1.5, Math.sin(a) * r * 0.76 - 1.5, 3, 3); } }
  if (skin === 'plasma') { ctx.fillStyle = `hsl(${(t * 140 + 90) % 360},95%,65%)`; ctx.globalAlpha = 0.55 + 0.35 * Math.sin(t * 7); ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, 6.3); ctx.fill(); ctx.globalAlpha = 1; }
  if (skin === 'ember') { ctx.fillStyle = '#ffe9a8'; ctx.globalAlpha = 0.45 + 0.3 * Math.sin(t * 9); ctx.beginPath(); ctx.arc(0, 0, r * 0.34, 0, 6.3); ctx.fill(); ctx.globalAlpha = 1; }
  const sp = ctx.createRadialGradient(lx * 1.5, ly * 1.5, 0, lx * 1.5, ly * 1.5, r * 0.5); sp.addColorStop(0, '#ffffffcc'); sp.addColorStop(1, '#ffffff00'); ctx.fillStyle = sp; ctx.beginPath(); ctx.arc(lx * 1.5, ly * 1.5, r * 0.5, 0, 6.3); ctx.fill();
  ctx.restore();
}
export function drawStriker(ctx, x, y, r, color, light, active = false) {
  const lx = light.x, ly = light.y;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = '#0008'; ctx.beginPath(); ctx.arc(-lx * r * 0.2, -ly * r * 0.2, r * 1.04, 0, 6.3); ctx.fill();
  if (active) { ctx.shadowColor = color; ctx.shadowBlur = 26; }
  let g = ctx.createRadialGradient(lx * r * 0.3, ly * r * 0.3, r * 0.1, 0, 0, r); g.addColorStop(0, shade(color, 0.22)); g.addColorStop(0.7, color); g.addColorStop(1, shade(color, -0.3));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.3); ctx.fill(); ctx.shadowBlur = 0;
  ctx.lineWidth = r * 0.09; ctx.strokeStyle = shade(color, -0.38); ctx.beginPath(); ctx.arc(0, 0, r * 0.94, 0, 6.3); ctx.stroke();
  ctx.lineWidth = r * 0.05; ctx.strokeStyle = shade(color, 0.3) + 'aa'; ctx.beginPath(); ctx.arc(0, 0, r * 0.72, 0, 6.3); ctx.stroke();
  const k = r * 0.5; g = ctx.createRadialGradient(lx * k * 0.5, ly * k * 0.5, 1, 0, 0, k); g.addColorStop(0, shade(color, 0.42)); g.addColorStop(0.6, shade(color, 0.04)); g.addColorStop(1, shade(color, -0.35));
  ctx.fillStyle = '#0006'; ctx.beginPath(); ctx.arc(-lx * 3, -ly * 3, k, 0, 6.3); ctx.fill();
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, k, 0, 6.3); ctx.fill();
  const sp = ctx.createRadialGradient(lx * k * 0.55, ly * k * 0.55, 0, lx * k * 0.55, ly * k * 0.55, k * 0.55); sp.addColorStop(0, '#ffffffd0'); sp.addColorStop(1, '#ffffff00'); ctx.fillStyle = sp; ctx.beginPath(); ctx.arc(lx * k * 0.55, ly * k * 0.55, k * 0.55, 0, 6.3); ctx.fill();
  ctx.restore();
}

// ---------- the renderer ----------
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  let cw = 0, ch = 0, dpr = 1, cache = null, cacheKey = '', lay = null;

  function layout(w, h, hudTop, pad) {
    const landscape = w > h * 1.02, uw = (landscape ? L : W) + 2 * FRAME, uh = (landscape ? W : L) + 2 * FRAME;
    const availW = w - pad * 2, availH = h - hudTop - pad, s = Math.min(availW / uw, availH / uh);
    const ox = (w - uw * s) / 2 + FRAME * s, oy = hudTop + (availH - uh * s) / 2 + FRAME * s;
    // light comes from the top-left of the *screen*; give it in table units
    const light = landscape ? { x: 0.55, y: -0.8 } : { x: -0.55, y: -0.8 };
    // M maps table (x,y) → screen
    const M = landscape ? { a: 0, b: s, c: -s, d: 0, e: ox + L * s, f: oy } : { a: s, b: 0, c: 0, d: s, e: ox, f: oy };
    return (lay = { landscape, s, ox, oy, M, light, uw, uh });
  }
  function resize(w, h, ratio) { cw = w; ch = h; dpr = ratio; canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio); cache = null; }
  function apply(c, M) { c.setTransform(M.a * dpr, M.b * dpr, M.c * dpr, M.d * dpr, M.e * dpr, M.f * dpr); }
  // screen px → table units, and back
  function toTable(px, py) { const { M } = lay; const det = M.a * M.d - M.b * M.c; const X = px - M.e, Y = py - M.f; return { x: (M.d * X - M.c * Y) / det, y: (-M.b * X + M.a * Y) / det }; }
  function toScreen(x, y) { const { M } = lay; return { x: M.a * x + M.c * y + M.e, y: M.b * x + M.d * y + M.f }; }

  function background(th) {
    const g = ctx.createRadialGradient(cw / 2, ch * 0.4, 20, cw / 2, ch / 2, Math.max(cw, ch) * 0.8);
    g.addColorStop(0, th.bg2); g.addColorStop(1, th.bg); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function draw(g, view) {
    const th = THEMES[view.theme] || THEMES.neon, l = lay || layout(cw, ch, 56, 10);
    const key = view.theme + '|' + cw + 'x' + ch + '|' + l.landscape + '|' + l.s.toFixed(3);
    if (!cache || cacheKey !== key) {
      cache = document.createElement('canvas'); cache.width = canvas.width; cache.height = canvas.height; cacheKey = key;
      const c = cache.getContext('2d'); const save = ctx;
      // paint the backdrop and the table once
      c.setTransform(1, 0, 0, 1, 0, 0); const bg = c.createRadialGradient(cw / 2, ch * 0.4, 20, cw / 2, ch / 2, Math.max(cw, ch) * 0.8); bg.addColorStop(0, th.bg2); bg.addColorStop(1, th.bg); c.fillStyle = bg; c.fillRect(0, 0, cache.width, cache.height);
      apply(c, l.M); paintTable(c, th);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(cache, 0, 0);
    ctx.save();
    if (view.shake > 0) ctx.translate((Math.random() - 0.5) * view.shake * dpr, (Math.random() - 0.5) * view.shake * dpr);
    apply(ctx, l.M);
    // air shimmer: two slow bands of light across the surface
    ctx.save(); rr(ctx, 0, 0, W, L, 26); ctx.clip();
    const sh = ctx.createLinearGradient(0, ((view.time * 90) % (L * 2)) - L * 0.5, 0, ((view.time * 90) % (L * 2)) + L * 0.1); sh.addColorStop(0, '#ffffff00'); sh.addColorStop(0.5, '#ffffff0b'); sh.addColorStop(1, '#ffffff00'); ctx.fillStyle = sh; ctx.fillRect(0, 0, W, L);
    // serve marker
    if (g.phase === 'serve') { ctx.strokeStyle = th.line; ctx.globalAlpha = 0.4 + 0.3 * Math.sin(view.time * 8); ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(g.puck.x, g.puck.y, PUCK_R + 16 + 6 * Math.sin(view.time * 8), 0, 6.3); ctx.stroke(); ctx.globalAlpha = 1; }
    // score numerals, each facing its own player
    const num = (n, cx, cy, rot) => { ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.fillStyle = th.line; ctx.globalAlpha = 0.16; ctx.font = '900 150px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(n), 0, 0); ctx.restore(); };
    const faceBottom = l.landscape ? -Math.PI / 2 : 0, faceTop = faceBottom + Math.PI; // rotate so each reads upright from its side
    num(g.score[0], W * 0.5, L * 0.74, faceBottom); num(g.score[1], W * 0.5, L * 0.26, faceTop);
    ctx.restore();
    // trail
    for (const t of view.trail) { ctx.globalAlpha = t.a * 0.5; ctx.fillStyle = view.puckColor; ctx.beginPath(); ctx.arc(t.x, t.y, PUCK_R * (0.35 + 0.65 * t.a), 0, 6.3); ctx.fill(); }
    ctx.globalAlpha = 1;
    // strikers and the puck
    for (let i = 0; i < 2; i++) { const st = g.strikers[i]; drawStriker(ctx, st.x, st.y, STRIKER_R, view.strikerColors[i], l.light, view.activeHand[i]); }
    drawPuck(ctx, g.puck.x, g.puck.y, PUCK_R, view.puck, view.time, l.light, Math.hypot(g.puck.vx, g.puck.vy));
    // particles
    for (const p of view.fx) { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color; if (p.ring) { ctx.strokeStyle = p.color; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x, p.y, p.size + (1 - p.life / p.max) * p.grow, 0, 6.3); ctx.stroke(); } else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * p.life / p.max), 0, 6.3); ctx.fill(); } }
    ctx.globalAlpha = 1;
    ctx.restore();
    // a flash on a goal, in the scorer's colour
    if (view.flash > 0) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = Math.min(0.5, view.flash); ctx.fillStyle = view.flashColor; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.globalAlpha = 1; }
  }
  return { resize, layout, draw, toTable, toScreen, get lay() { return lay; }, get dpr() { return dpr; } };
}

// Menu previews: a small table, and single pucks / strikers
export function drawTablePreview(canvas, themeId, puck, color) {
  const c = canvas.getContext('2d'), th = THEMES[themeId], w = canvas.width = 220, h = canvas.height = 150;
  const g = c.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.7); g.addColorStop(0, th.bg2); g.addColorStop(1, th.bg); c.fillStyle = g; c.fillRect(0, 0, w, h);
  const s = Math.min((h - 14) / (W + 2 * FRAME), (w - 12) / (L + 2 * FRAME)); c.setTransform(0, s, -s, 0, w / 2 + (L * s) / 2, h / 2 - (W * s) / 2); paintTable(c, th);
  const light = { x: 0.55, y: -0.8 }; drawStriker(c, W / 2 - 60, L - 200, STRIKER_R, color, light); drawStriker(c, W / 2 + 90, 190, STRIKER_R, '#d8e2ff', light); drawPuck(c, W / 2 + 10, L * 0.5 + 120, PUCK_R, puck, 0, light);
}
export function drawPuckPreview(canvas, skin, t = 0) { const c = canvas.getContext('2d'), s = canvas.width = canvas.height = 96; c.clearRect(0, 0, s, s); drawPuck(c, s / 2, s / 2, 34, skin, t, { x: -0.55, y: -0.8 }, 0); }
export function drawStrikerPreview(canvas, color) { const c = canvas.getContext('2d'), s = canvas.width = canvas.height = 72; c.clearRect(0, 0, s, s); drawStriker(c, s / 2, s / 2, 28, color, { x: -0.55, y: -0.8 }); }
