/* Tahdia 33.9.5 — «ماستر الجواهر»: the duel page. The engine decides; this file draws the board on a
   canvas, animates every move from the state's own record (swap, breaks, special gems, falls), and
   runs the three ways to play: online (a BoardRoom table), against the computer, two on one phone. */
import { JD, BOOSTERS, createJewelsDuel, playJewelsSwap, playJewelsBooster, chooseJewelsMove, legalSwaps, adjacent } from '../engines/jewels-duel-engine.js?v=33.9.9-jw1';
import { createTable } from '../board-table-v33.js?v=33.9.9';

const $ = (s) => document.querySelector(s);
const W = JD.W, H = JD.H, N = W * H;
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const reduced = () => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const play = (name, volume) => { try { window.BS_AUDIO?.play?.(name, volume ? { volume } : undefined); } catch {} };

/* ---------- the gems ---------- */
const GEMS = [
  { base: '#ff2f55', dark: '#a3001f', light: '#ffd0da', glow: '#ff6b85', shape: 'round' },
  { base: '#ffd21f', dark: '#c27a00', light: '#fff8c8', glow: '#ffe066', shape: 'star' },
  { base: '#36e27a', dark: '#078a3c', light: '#d2ffe4', glow: '#5cf59c', shape: 'emerald' },
  { base: '#2f9bff', dark: '#0a4fc0', light: '#d8eeff', glow: '#6cb8ff', shape: 'diamond' },
  { base: '#b74dff', dark: '#5e14b8', light: '#f0dcff', glow: '#c98cff', shape: 'trillion' },
  { base: '#ff8a1f', dark: '#b8470a', light: '#ffe2c2', glow: '#ffa95c', shape: 'hex' },
];
function poly(g, pts) { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); }
function shapePoints(shape, r) {
  if (shape === 'star') return Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.52 : r * 0.98; return [Math.cos(a) * rr, Math.sin(a) * rr + r * 0.04]; });
  if (shape === 'emerald') { const w = r * 0.8, h = r * 0.92, c = r * 0.3; return [[-w + c, -h], [w - c, -h], [w, -h + c], [w, h - c], [w - c, h], [-w + c, h], [-w, h - c], [-w, -h + c]]; }
  if (shape === 'diamond') return [[0, -r * 0.98], [r * 0.86, -r * 0.12], [0, r * 0.98], [-r * 0.86, -r * 0.12]];
  if (shape === 'trillion') return [[0, -r * 0.95], [r * 0.95, r * 0.72], [-r * 0.95, r * 0.72]];
  if (shape === 'hex') return Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 6 + i * Math.PI / 3; return [Math.cos(a) * r * 0.94, Math.sin(a) * r * 0.94]; });
  return null;
}
function drawGem(g, c, r) {
  const G = GEMS[c], pts = shapePoints(G.shape, r);
  const path = (scale = 1, dy = 0) => { if (pts) poly(g, pts.map(([x, y]) => [x * scale, y * scale + dy])); else { g.beginPath(); g.arc(0, dy, r * 0.88 * scale, 0, Math.PI * 2); } };
  g.save();
  g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = r * 0.22; g.shadowOffsetY = r * 0.1;
  path(); g.fillStyle = G.dark; g.fill();
  g.restore();
  let gr = g.createLinearGradient(-r, -r, r, r); gr.addColorStop(0, G.light); gr.addColorStop(0.35, G.base); gr.addColorStop(1, G.dark);
  path(); g.fillStyle = gr; g.fill();
  // a cartoon outline, thick and dark, like the toy-box gems of the duel games
  g.lineWidth = Math.max(1.5, r * 0.12); g.strokeStyle = '#1a0b3d'; g.stroke();
  // facets: the table on top and lines to its corners
  const inner = 0.52, dy = -r * 0.06;
  g.save(); path(); g.clip();
  g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = Math.max(0.8, r * 0.035);
  if (pts) { for (const [x, y] of pts) { g.beginPath(); g.moveTo(x, y); g.lineTo(x * inner, y * inner + dy); g.stroke(); } }
  else for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.beginPath(); g.moveTo(Math.cos(a) * r, Math.sin(a) * r); g.lineTo(Math.cos(a) * r * inner, Math.sin(a) * r * inner + dy); g.stroke(); }
  gr = g.createRadialGradient(-r * 0.2, -r * 0.3, r * 0.05, 0, 0, r * 0.7); gr.addColorStop(0, '#fff'); gr.addColorStop(0.35, G.light); gr.addColorStop(1, G.base);
  path(inner, dy); g.fillStyle = gr; g.globalAlpha = 0.92; g.fill(); g.globalAlpha = 1;
  g.lineWidth = Math.max(0.8, r * 0.04); g.strokeStyle = 'rgba(255,255,255,.45)'; g.stroke();
  // shine
  gr = g.createRadialGradient(-r * 0.38, -r * 0.45, 0, -r * 0.38, -r * 0.45, r * 0.55); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(-r, -r, r * 2, r * 2);
  g.restore();
  sparkle(g, -r * 0.42, -r * 0.5, r * 0.16, 0.95);
}
function sparkle(g, x, y, s, a = 1) {
  g.save(); g.globalAlpha = a; g.fillStyle = '#fff'; g.beginPath();
  g.moveTo(x, y - s); g.quadraticCurveTo(x, y, x + s, y); g.quadraticCurveTo(x, y, x, y + s); g.quadraticCurveTo(x, y, x - s, y); g.quadraticCurveTo(x, y, x, y - s); g.fill(); g.restore();
}
function drawRocket(g, c, r, vertical) {
  drawGem(g, c, r * 0.92);
  g.save(); if (vertical) g.rotate(Math.PI / 2);
  const gr = g.createLinearGradient(0, -r * 0.22, 0, r * 0.22); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(-r * 0.78, -r * 0.2, r * 1.56, r * 0.4);
  g.fillStyle = '#fff'; g.shadowColor = GEMS[c].glow; g.shadowBlur = r * 0.35;
  for (const s of [-1, 1]) { poly(g, [[s * r * 1.02, 0], [s * r * 0.66, -r * 0.3], [s * r * 0.66, r * 0.3]]); g.fill(); }
  g.restore();
}
function drawBomb(g, c, r) {
  const G = GEMS[c];
  g.save(); g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = r * 0.25; g.shadowOffsetY = r * 0.1;
  let gr = g.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 0.9); gr.addColorStop(0, '#5b5878'); gr.addColorStop(0.6, '#1b1930'); gr.addColorStop(1, '#07060f');
  g.beginPath(); g.arc(0, r * 0.06, r * 0.8, 0, Math.PI * 2); g.fillStyle = gr; g.fill(); g.restore();
  g.save(); g.beginPath(); g.arc(0, r * 0.06, r * 0.8, 0, Math.PI * 2); g.clip();
  gr = g.createLinearGradient(0, -r * 0.1, 0, r * 0.32); gr.addColorStop(0, G.light); gr.addColorStop(0.5, G.base); gr.addColorStop(1, G.dark);
  g.fillStyle = gr; g.fillRect(-r, -r * 0.1, r * 2, r * 0.36); g.restore();
  g.save(); g.shadowColor = G.glow; g.shadowBlur = r * 0.4; g.strokeStyle = G.light; g.lineWidth = r * 0.06; g.beginPath(); g.arc(0, r * 0.06, r * 0.8, 0, Math.PI * 2); g.stroke(); g.restore();
  g.strokeStyle = '#c9a36a'; g.lineWidth = r * 0.12; g.lineCap = 'round'; g.beginPath(); g.moveTo(r * 0.36, -r * 0.6); g.quadraticCurveTo(r * 0.55, -r * 0.95, r * 0.8, -r * 0.82); g.stroke();
  sparkle(g, r * 0.84, -r * 0.84, r * 0.26); g.fillStyle = '#ffd25e'; g.beginPath(); g.arc(r * 0.84, -r * 0.84, r * 0.09, 0, Math.PI * 2); g.fill();
  sparkle(g, -r * 0.34, -r * 0.3, r * 0.14, 0.8);
}
function drawBall(g, r) {
  g.save(); g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = r * 0.25; g.shadowOffsetY = r * 0.1;
  g.beginPath(); g.arc(0, 0, r * 0.84, 0, Math.PI * 2); g.fillStyle = '#2a1866'; g.fill(); g.restore();
  g.save(); g.beginPath(); g.arc(0, 0, r * 0.84, 0, Math.PI * 2); g.clip();
  if (g.createConicGradient) { const cg = g.createConicGradient(0, 0, 0); GEMS.forEach((G, i) => cg.addColorStop(i / GEMS.length, G.base)); cg.addColorStop(1, GEMS[0].base); g.fillStyle = cg; g.fillRect(-r, -r, r * 2, r * 2); }
  else GEMS.forEach((G, i) => { g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r, i * Math.PI / 3, (i + 1) * Math.PI / 3); g.fillStyle = G.base; g.fill(); });
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, r * 0.84); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(-r, -r, r * 2, r * 2); g.restore();
  g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = r * 0.07; g.beginPath(); g.arc(0, 0, r * 0.84, 0, Math.PI * 2); g.stroke();
  sparkle(g, 0, 0, r * 0.42); sparkle(g, -r * 0.4, -r * 0.42, r * 0.14, 0.9);
}
const sprites = new Map();
// 33.9.9: the gems are painted ahead (cut, bevelled and lit) on one sheet: six gems, six bombs, the light orb
const SHEET = { img: null, cell: 160 };
{
  const im = new Image(); im.decoding = 'async';
  im.onload = () => { SHEET.img = im; sprites.clear(); invalidate?.(); };
  im.src = '/assets/jewels/gems-v33-9-9.webp';
}
function fromSheet(g, col, row, px) { const k = SHEET.cell; g.drawImage(SHEET.img, col * k, row * k, k, k, -px / 2, -px / 2, px, px); }
function rocketMarks(g, c, r, vertical) {
  g.save(); if (vertical) g.rotate(Math.PI / 2);
  const gr = g.createLinearGradient(0, -r * 0.3, 0, r * 0.3); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(-r * 0.86, -r * 0.24, r * 1.72, r * 0.48);
  g.fillStyle = '#fff'; g.strokeStyle = '#1b0b4a'; g.lineWidth = Math.max(1.5, r * 0.07); g.lineJoin = 'round'; g.shadowColor = GEMS[c].glow; g.shadowBlur = r * 0.4;
  for (const s of [-1, 1]) { poly(g, [[s * r * 1.08, 0], [s * r * 0.64, -r * 0.36], [s * r * 0.64, r * 0.36]]); g.stroke(); g.fill(); }
  g.restore();
}
function sprite(c, s, px) {
  const key = c + ':' + s + ':' + px + ':' + (SHEET.img ? 1 : 0);
  if (sprites.has(key)) return sprites.get(key);
  const cv = document.createElement('canvas'); cv.width = cv.height = px;
  const g = cv.getContext('2d'); g.translate(px / 2, px / 2); const r = px * 0.4;
  if (SHEET.img) {
    if (s === 'ball') fromSheet(g, 6, 0, px);
    else if (s === 'bomb') fromSheet(g, c, 1, px);
    else { fromSheet(g, c, 0, px); if (s === 'rh' || s === 'rv') rocketMarks(g, c, r, s === 'rv'); }
  } else if (s === 'ball') drawBall(g, r); else if (s === 'bomb') drawBomb(g, c, r); else if (s === 'rh' || s === 'rv') drawRocket(g, c, r, s === 'rv'); else drawGem(g, c, r);
  sprites.set(key, cv); return cv;
}
function boosterIcon(cv, k, px = 60) {
  const b = BOOSTERS[k], g = cv.getContext('2d'); cv.width = cv.height = px; g.clearRect(0, 0, px, px); g.translate(px / 2, px / 2); const r = px * 0.46;
  g.lineCap = 'round'; g.lineJoin = 'round';
  const ink = (paint) => { g.save(); g.strokeStyle = '#1b0b4a'; g.lineWidth = r * 0.2; paint(true); g.restore(); g.save(); g.fillStyle = '#fff'; g.strokeStyle = '#fff'; paint(false); g.restore(); };
  g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowOffsetY = r * 0.06;
  if (b.id === 'hammer') ink((out) => { g.rotate(-0.6); const pad = out ? r * 0.08 : 0; g.beginPath(); g.roundRect?.(-r * 0.1 - pad, -r * 0.18 - pad, r * 0.2 + pad * 2, r * 0.95 + pad * 2, r * 0.08); if (!g.roundRect) g.rect(-r * 0.1 - pad, -r * 0.18 - pad, r * 0.2 + pad * 2, r * 0.95 + pad * 2); out ? g.stroke() : g.fill(); g.beginPath(); g.roundRect?.(-r * 0.55 - pad, -r * 0.62 - pad, r * 1.1 + pad * 2, r * 0.46 + pad * 2, r * 0.12); if (!g.roundRect) g.rect(-r * 0.55 - pad, -r * 0.62 - pad, r * 1.1 + pad * 2, r * 0.46 + pad * 2); out ? g.stroke() : g.fill(); });
  else if (b.id === 'cross') ink((out) => { g.lineWidth = out ? r * 0.36 : r * 0.18; g.beginPath(); g.moveTo(-r * 0.62, 0); g.lineTo(r * 0.62, 0); g.moveTo(0, -r * 0.62); g.lineTo(0, r * 0.62); g.stroke(); for (const a2 of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) { g.save(); g.rotate(a2); poly(g, [[r * 0.92, 0], [r * 0.56, -r * 0.26], [r * 0.56, r * 0.26]]); if (out) { g.lineWidth = r * 0.18; g.stroke(); } g.fill(); g.restore(); } });
  else ink((out) => { poly(g, [[r * 0.14, -r * 0.86], [-r * 0.46, r * 0.1], [-r * 0.04, r * 0.1], [-r * 0.18, r * 0.86], [r * 0.46, -r * 0.14], [r * 0.04, -r * 0.14]]); if (out) g.stroke(); g.fill(); });
}

/* ---------- the board view ---------- */
const canvas = $('#jwBoard'), g = canvas.getContext('2d'), wrap = $('#jwWrap');
const view = { size: 320, cell: 40, pad: 8, dpr: 1, tiles: new Map(), grid: Array(N).fill(null), fx: [], parts: [], sel: -1, hint: null, hintAt: 0, aimCell: -1, shake: 0, raf: 0 };
function fitBoard() {
  const vw = Math.min(window.innerWidth, 560) - 12;
  const used = ['#game .jw-bar', '.jw-hud', '#status', '#jwBoostBar'].reduce((n, s) => n + ($(s)?.offsetHeight || 0), 0) + 54;
  const size = Math.max(240, Math.min(vw, window.innerHeight - used, 520));
  view.dpr = Math.min(3, window.devicePixelRatio || 1); view.pad = Math.round(size * 0.042); view.cell = (size - view.pad * 2) / W; view.size = size;
  canvas.width = Math.round(size * view.dpr); canvas.height = Math.round(size * view.dpr); canvas.style.width = canvas.style.height = size + 'px';
  sprites.clear(); invalidate();
}
function setBoard(board) {
  view.tiles.clear(); view.grid = Array(N).fill(null);
  board.forEach((t, i) => { if (!t) return; view.tiles.set(t.i, { id: t.i, c: t.c, s: t.s, x: i % W, y: (i / W) | 0, scale: 1, alpha: 1 }); view.grid[i] = t.i; });
  invalidate();
}
function invalidate() { if (!view.raf) view.raf = requestAnimationFrame(frame); }
let animating = 0;
function frame(now) {
  view.raf = 0; draw(now || performance.now());
  if (animating > 0 || view.fx.length || view.parts.length || view.sel >= 0 || view.hint || ctl.aim >= 0) view.raf = requestAnimationFrame(frame);
}
const cellXY = (x, y) => [view.pad + (x + 0.5) * view.cell, view.pad + (y + 0.5) * view.cell];
function roundRect(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function draw(now) {
  const S = view.size, d = view.dpr; g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, S, S);
  let sx = 0, sy = 0; if (view.shake > 0) { sx = (Math.random() - 0.5) * view.shake; sy = (Math.random() - 0.5) * view.shake; view.shake *= 0.86; if (view.shake < 0.3) view.shake = 0; }
  g.translate(sx, sy);
  // the board
  // 33.9.9: a thick gold frame with a dark rim, a deep violet floor and raised tiles
  const p = view.pad, c = view.cell, f = p * 0.92;
  roundRect(1.5, 1.5, S - 3, S - 3, 26); g.fillStyle = '#1b0b4a'; g.fill();
  let gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, '#fff3a6'); gr.addColorStop(0.18, '#ffd23f'); gr.addColorStop(0.55, '#f0a915'); gr.addColorStop(1, '#b86400');
  roundRect(4, 4, S - 8, S - 8, 23); g.fillStyle = gr; g.fill();
  g.save(); roundRect(4, 4, S - 8, S - 8, 23); g.clip(); g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(0, 4, S, 3); g.restore();
  roundRect(f - 1, f - 1, S - 2 * f + 2, S - 2 * f + 2, 17); g.fillStyle = '#1b0b4a'; g.fill();
  gr = g.createLinearGradient(0, f, 0, S - f); gr.addColorStop(0, '#3a1d9a'); gr.addColorStop(1, '#22105e');
  roundRect(f + 1.5, f + 1.5, S - 2 * f - 3, S - 2 * f - 3, 15); g.fillStyle = gr; g.fill();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const tx = p + x * c + 1.6, ty = p + y * c + 1.6, tw = c - 3.2;
    roundRect(tx, ty, tw, tw, c * 0.2); g.fillStyle = (x + y) % 2 ? '#4a2bb8' : '#3d22a0'; g.fill();
    roundRect(tx, ty + tw * 0.55, tw, tw * 0.45, c * 0.2); g.fillStyle = 'rgba(20,6,60,.22)'; g.fill();
    g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(tx + c * 0.18, ty + 1, tw - c * 0.36, Math.max(1, c * 0.05));
  }
  // booster aim
  if (ctl.aim >= 0) {
    const cells = aimCells(BOOSTERS[ctl.aim].id, view.aimCell);
    g.fillStyle = 'rgba(255,255,255,' + (0.12 + 0.08 * Math.sin(now / 160)) + ')';
    for (const i of cells) { roundRect(p + (i % W) * c + 2, p + ((i / W) | 0) * c + 2, c - 4, c - 4, c * 0.2); g.fill(); }
  }
  // gems
  g.save(); roundRect(p, p, c * W, c * H, 14); g.clip();
  const px = Math.round(c * d * 1.12);
  const hintPulse = view.hint ? 1 + 0.08 * Math.sin(now / 120) : 1;
  for (const t of view.tiles.values()) {
    if (t.alpha <= 0) continue;
    let sc = t.scale; if (view.hint && (view.grid[view.hint[0]] === t.id || view.grid[view.hint[1]] === t.id)) sc *= hintPulse;
    const [cx, cy] = cellXY(t.x, t.y), sz = c * 1.12 * sc;
    g.globalAlpha = Math.max(0, Math.min(1, t.alpha));
    g.drawImage(sprite(t.c, t.s, px), cx - sz / 2, cy - sz / 2, sz, sz);
    if (t.s === 'ball') { g.save(); g.translate(cx, cy); g.rotate(now / 700); sparkle(g, c * 0.32, 0, c * 0.08, 0.8); g.restore(); }
  }
  g.globalAlpha = 1; g.restore();
  // selection
  if (view.sel >= 0) {
    const x = view.sel % W, y = (view.sel / W) | 0;
    g.save(); g.shadowColor = '#fff'; g.shadowBlur = 12; g.lineWidth = 2.5; g.strokeStyle = 'rgba(255,255,255,' + (0.7 + 0.3 * Math.sin(now / 140)) + ')';
    roundRect(p + x * c + 2, p + y * c + 2, c - 4, c - 4, c * 0.22); g.stroke(); g.restore();
  }
  drawFx(now); drawParts();
  g.setTransform(1, 0, 0, 1, 0, 0);
}
/* effects: beams, rings, bolts and shards */
function drawFx(now) {
  const c = view.cell;
  view.fx = view.fx.filter((f) => now - f.t0 < f.ms);
  for (const f of view.fx) {
    const t = (now - f.t0) / f.ms, a = 1 - t;
    g.save(); g.globalCompositeOperation = 'lighter';
    if (f.kind === 'beam') {
      const [cx, cy] = cellXY(f.x, f.y), len = view.size * 1.2 * Math.min(1, t * 3), w = c * (0.5 + 0.5 * a);
      const gr = f.vertical ? g.createLinearGradient(cx - w, 0, cx + w, 0) : g.createLinearGradient(0, cy - w, 0, cy + w);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, `rgba(255,255,255,${0.9 * a})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      if (f.vertical) g.fillRect(cx - w, cy - len, w * 2, len * 2); else g.fillRect(cx - len, cy - w, len * 2, w * 2);
    } else if (f.kind === 'ring') {
      const [cx, cy] = cellXY(f.x, f.y);
      g.strokeStyle = `rgba(255,230,160,${a})`; g.lineWidth = c * 0.4 * a + 1; g.beginPath(); g.arc(cx, cy, c * f.r * (0.3 + t), 0, Math.PI * 2); g.stroke();
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, c * f.r); gr.addColorStop(0, `rgba(255,255,255,${0.7 * a})`); gr.addColorStop(1, 'rgba(255,200,120,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, c * f.r, 0, Math.PI * 2); g.fill();
    } else if (f.kind === 'bolt') {
      const [x0, y0] = cellXY(f.x, f.y);
      g.strokeStyle = `rgba(255,255,255,${a})`; g.shadowColor = f.color; g.shadowBlur = 14; g.lineWidth = 2.2;
      for (const [x1, y1] of f.to) { const [tx, ty] = cellXY(x1, y1); g.beginPath(); g.moveTo(x0, y0); const k = 4; for (let i = 1; i < k; i++) { const u = i / k; g.lineTo(x0 + (tx - x0) * u + (Math.random() - 0.5) * c * 0.5, y0 + (ty - y0) * u + (Math.random() - 0.5) * c * 0.5); } g.lineTo(tx, ty); g.stroke(); }
    } else if (f.kind === 'flash') {
      g.fillStyle = `rgba(255,255,255,${0.35 * a})`; g.fillRect(0, 0, view.size, view.size);
    }
    g.restore();
  }
}
function drawParts() {
  const dt = 1 / 60;
  view.parts = view.parts.filter((p) => (p.life -= dt) > 0);
  for (const p of view.parts) {
    p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    g.save(); g.globalAlpha = Math.min(1, p.life * 2.2); g.translate(p.x, p.y); g.rotate(p.rot);
    if (p.star) sparkle(g, 0, 0, p.size, 1); else { g.fillStyle = p.color; poly(g, [[0, -p.size], [p.size * 0.7, 0], [0, p.size], [-p.size * 0.7, 0]]); g.fill(); }
    g.restore();
  }
}
function burst(x, y, c, n = 7) {
  if (reduced()) return;
  const [cx, cy] = cellXY(x, y), col = GEMS[c]?.base || '#fff';
  for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = 120 + Math.random() * 260; view.parts.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 180, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14, size: view.cell * (0.07 + Math.random() * 0.07), color: col, life: 0.5 + Math.random() * 0.35, star: i % 4 === 0 }); }
  if (view.parts.length > 260) view.parts.splice(0, view.parts.length - 260);
}
function aimCells(id, cell) {
  if (cell < 0) return [];
  const x = cell % W, y = (cell / W) | 0, out = [];
  if (id === 'hammer') { for (let j = y - 1; j <= y + 1; j++) for (let i = x - 1; i <= x + 1; i++) if (i >= 0 && j >= 0 && i < W && j < H) out.push(j * W + i); }
  else if (id === 'cross') { for (let i = 0; i < W; i++) out.push(y * W + i); for (let j = 0; j < H; j++) if (j !== y) out.push(j * W + x); }
  else { const c = view.tiles.get(view.grid[cell])?.c; view.grid.forEach((idd, i) => { if (view.tiles.get(idd)?.c === c) out.push(i); }); }
  return out;
}

/* ---------- tweens ---------- */
function tween(ms, fn) {
  if (document.hidden || reduced()) { fn(1); invalidate(); return Promise.resolve(); }
  animating++; invalidate();
  return new Promise((resolve) => {
    const t0 = performance.now();
    const step = (now) => { const t = Math.min(1, (now - t0) / ms); fn(t); invalidate(); if (t < 1) requestAnimationFrame(step); else { animating--; resolve(); } };
    requestAnimationFrame(step);
  });
}
const easeOut = (t) => 1 - (1 - t) * (1 - t);
const fallEase = (t) => (t < 0.82 ? (t / 0.82) ** 2 : 1 - Math.sin((t - 0.82) / 0.18 * Math.PI) * 0.05);

async function slideSwap(a, b, back = false) {
  const ta = view.tiles.get(view.grid[a]), tb = view.tiles.get(view.grid[b]); if (!ta || !tb) return;
  const ax = a % W, ay = (a / W) | 0, bx = b % W, by = (b / W) | 0;
  play('whoosh', 0.45);
  await tween(150, (t) => { const e = easeOut(t); ta.x = ax + (bx - ax) * e; ta.y = ay + (by - ay) * e; tb.x = bx + (ax - bx) * e; tb.y = by + (ay - by) * e; });
  if (back) { await tween(150, (t) => { const e = easeOut(t); ta.x = bx + (ax - bx) * e; ta.y = by + (ay - by) * e; tb.x = ax + (bx - ax) * e; tb.y = ay + (by - ay) * e; }); return; }
  view.grid[a] = tb.id; view.grid[b] = ta.id;
}

const COMBO_WORDS = ['', '', 'حلو!', 'رهيب!', 'خيالي!', 'أسطوري!'];
async function animateLast(last, { skipSwap = false } = {}) {
  view.sel = -1; view.hint = null;
  setBoard(last.before);
  if (last.kind === 'swap') {
    if (skipSwap) { const ia = view.grid[last.a], ib = view.grid[last.b], ta = view.tiles.get(ia), tb = view.tiles.get(ib); [ta.x, tb.x] = [tb.x, ta.x]; [ta.y, tb.y] = [tb.y, ta.y]; view.grid[last.a] = ib; view.grid[last.b] = ia; }
    else await slideSwap(last.a, last.b);
  } else {
    flashBooster(last.seat, last.booster);
    await sleep(reduced() ? 0 : 260);
  }
  let shown = 0;
  for (let k = 0; k < last.phases.length; k++) {
    const ph = last.phases[k];
    if (ph.shuffle) { await shuffleAnim(ph.board); continue; }
    // the special gems going off
    for (const f of ph.fx || []) fxOf(f);
    // breaking
    const gone = ph.clear.map((i) => view.tiles.get(view.grid[i])).filter(Boolean);
    for (const t of gone) burst(t.x, t.y, t.c, gone.length > 20 ? 3 : 7);
    if (ph.fx?.length) { view.shake = Math.min(14, 4 + ph.fx.length * 3); play(ph.fx.some((f) => f[0] === 'ball' || f[0] === 'all') ? 'combo' : ph.fx.some((f) => /bomb|hammer/.test(f[0])) ? 'hit' : 'whoosh', 0.6); }
    else play('pop', 0.35 + Math.min(0.3, k * 0.08));
    if (ph.made?.length) setTimeout(() => play('coin', 0.45), 160);
    popPoints(ph, last.seat, k);
    await tween(230, (t) => { for (const t2 of gone) { t2.scale = 1 + 0.35 * t; t2.alpha = 1 - t; } });
    for (const t of gone) view.tiles.delete(t.id);
    shown += ph.pts; bumpScore(last.seat, ph.pts);
    // falling
    const moves = [], fresh = Array(W).fill(0), made = new Set((ph.made || []).map(([m]) => m));
    ph.board.forEach((tile, i) => { if (!view.tiles.has(tile.i) && !made.has(i)) fresh[i % W]++; });
    ph.board.forEach((tile, i) => {
      const x = i % W, y = (i / W) | 0;
      let t = view.tiles.get(tile.i);
      if (!t) { t = { id: tile.i, c: tile.c, s: tile.s, x, y: y - fresh[x], scale: 1, alpha: 1, made: made.has(i) }; if (t.made) { t.y = y; t.scale = 0; } view.tiles.set(t.id, t); }
      t.c = tile.c; t.s = tile.s;
      moves.push({ t, x0: t.x, y0: t.y, x1: x, y1: y });
    });
    const far = Math.max(1, ...moves.map((m) => m.y1 - m.y0));
    await tween(Math.min(420, 150 + far * 45), (t) => { for (const m of moves) { if (m.t.made) { m.t.scale = easeOut(Math.min(1, t * 1.6)) * (1 + 0.15 * Math.sin(Math.min(1, t * 1.6) * Math.PI)); continue; } const e = fallEase(t); m.t.x = m.x0 + (m.x1 - m.x0) * e; m.t.y = m.y0 + (m.y1 - m.y0) * e; } });
    for (const m of moves) { m.t.x = m.x1; m.t.y = m.y1; m.t.scale = 1; }
    view.grid = ph.board.map((t) => t.i);
    if (k >= 2) banner(COMBO_WORDS[Math.min(COMBO_WORDS.length - 1, k)], false, 800, 'combo');
  }
  if (last.extra) { banner('حركة زيادة!', false, 900, 'gold'); play('combo', 0.5); }
  return shown;
}
function fxOf([kind, cell, color]) {
  const x = cell % W, y = (cell / W) | 0, t0 = performance.now();
  if (kind === 'rh' || kind === 'rv') view.fx.push({ kind: 'beam', x, y, vertical: kind === 'rv', t0, ms: 420 });
  else if (kind === 'cross') { view.fx.push({ kind: 'beam', x, y, vertical: false, t0, ms: 460 }, { kind: 'beam', x, y, vertical: true, t0, ms: 460 }); }
  else if (kind === 'bombline') { for (const d of [-1, 0, 1]) view.fx.push({ kind: 'beam', x, y: y + d, vertical: false, t0, ms: 460 }, { kind: 'beam', x: x + d, y, vertical: true, t0, ms: 460 }); }
  else if (kind === 'bomb' || kind === 'hammer') view.fx.push({ kind: 'ring', x, y, r: 1.7, t0, ms: 420 });
  else if (kind === 'bomb2') view.fx.push({ kind: 'ring', x, y, r: 3, t0, ms: 520 }, { kind: 'flash', t0, ms: 300 });
  else if (kind === 'ball' || kind === 'storm') {
    const c = kind === 'storm' ? view.tiles.get(view.grid[cell])?.c : color;
    const to = []; view.grid.forEach((id, i) => { const t = view.tiles.get(id); if (t && t.c === c && t.s !== 'ball') to.push([i % W, (i / W) | 0]); });
    view.fx.push({ kind: 'bolt', x, y, to, color: GEMS[c]?.glow || '#fff', t0, ms: 380 }, { kind: 'flash', t0, ms: 240 });
  } else if (kind === 'all') view.fx.push({ kind: 'flash', t0, ms: 500 }, { kind: 'ring', x, y, r: 6, t0, ms: 600 });
  invalidate();
}
async function shuffleAnim(board) {
  banner('ما فيه حركات · نخلط اللوحة');
  const target = new Map(board.map((t, i) => [t.i, i]));
  const moves = [...view.tiles.values()].map((t) => { const i = target.get(t.id) ?? 0; return { t, x0: t.x, y0: t.y, x1: i % W, y1: (i / W) | 0 }; });
  await tween(600, (t) => { const e = easeOut(t), sw = Math.sin(t * Math.PI) * 1.5; for (const m of moves) { m.t.x = m.x0 + (m.x1 - m.x0) * e + sw * (m.y0 > 3 ? 1 : -1) * 0.3; m.t.y = m.y0 + (m.y1 - m.y0) * e; } });
  setBoard(board);
}
function popPoints(ph, seat, k) {
  if (!ph.pts) return;
  let sx = 0, sy = 0; for (const i of ph.clear) { sx += i % W; sy += (i / W) | 0; }
  const n = Math.max(1, ph.clear.length), [cx, cy] = cellXY(sx / n, sy / n);
  floatText('+' + ph.pts, cx, cy, seat === mySeat() ? '#38d6ff' : '#ff5d93', ph.pts >= 15 || k >= 2);
}
function floatText(text, x, y, color, big = false) {
  const el = document.createElement('div'); el.className = 'jw-pop' + (big ? ' big' : ''); el.textContent = text; el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.setProperty('--c', color);
  $('#jwFloat').append(el); setTimeout(() => el.remove(), 1000);
}
let bannerTimer = 0;
function banner(text, foe = false, ms = 900, kind = '') {
  if (!text) return; const b = $('#jwBanner'); b.textContent = text;
  b.className = 'jw-banner' + (foe ? ' foe' : '') + (kind ? ' ' + kind : ''); void b.offsetWidth; b.classList.add('show');
  clearTimeout(bannerTimer); bannerTimer = setTimeout(() => b.classList.remove('show'), ms);
}

/* ---------- the match ---------- */
const ctl = { mode: 'ai', state: null, level: 'medium', names: ['أنت', 'الكمبيوتر'], bots: [false, true], users: [null, null], me: 0, busy: false, aim: -1, pending: null, shownSeq: 0, endShown: false, rewarded: false, receipt: '', match: 0, scores: [0, 0], lastTurn: null, idleTimer: 0, aiTimer: 0 };
let table = null, room = null;
const mySeat = () => (ctl.mode === 'online' ? ctl.me : ctl.mode === 'two' ? ctl.state?.turn ?? 0 : 0);
const humanTurn = () => { const s = ctl.state; if (!s || s.winner !== null) return false; if (ctl.mode === 'online') return s.turn === ctl.me; if (ctl.mode === 'two') return true; return s.turn === 0; };
const canAct = () => humanTurn() && !ctl.busy && !ctl.pending;
const bottomSeat = () => (ctl.mode === 'online' ? ctl.me : 0);

// 33.9.7: a duel head-up display like the big duel games: both players across the top (you first),
// the round between them, and your boosters as big round buttons under the board
// 33.9.9: a bright card for each player (face, name, score), the moves between them, and the
// boosters as charge tanks that fill with their gem's colour
function plateHTML(seat) {
  return `<span class="jw-face" data-player-tag="${seat}" role="button" tabindex="0" aria-label="ملف اللاعب"><span class="jw-pic"></span></span>
  <span class="jw-who"><b></b><small></small></span><b class="jw-score">0</b>
  <div class="jw-mini" aria-hidden="true">${BOOSTERS.map((b, k) => `<i data-k="${k}" style="--bc:${GEMS[b.color].base}"></i>`).join('')}</div>`;
}
function boostHTML() {
  return BOOSTERS.map((b, k) => `<button type="button" class="jw-boost" data-k="${k}" style="--bc:${GEMS[b.color].base};--bd:${GEMS[b.color].dark}"><span class="mm-tank"><i class="mm-liquid"></i><canvas></canvas></span><b>${b.name}</b><small></small></button>`).join('');
}
function faceOf(seat) {
  const user = ctl.users[seat], P = window.BS_PROFILE_PRO;
  if (P && (user?.username || user?.photo || user?.fallback)) return P.avatar({ username: user.username, photo: user.photo, name: ctl.names[seat], fallback: user.fallback || '' });
  return Object.assign(document.createElement('span'), { className: 'jw-letter', textContent: String(ctl.names[seat] || '؟').trim().slice(0, 1) });
}
function buildPlates() {
  for (const [id, seat] of [['#plateBottom', bottomSeat()], ['#plateTop', 1 - bottomSeat()]]) {
    const el = $(id); el.dataset.seat = seat; el.innerHTML = plateHTML(seat); el.classList.toggle('foe', seat !== bottomSeat()); el.classList.toggle('me', seat === bottomSeat());
    el.querySelector('.jw-pic').replaceWith(faceOf(seat));
  }
  const bar = $('#jwBoostBar'); bar.innerHTML = boostHTML();
  bar.querySelectorAll('.jw-boost canvas').forEach((cv, k) => boosterIcon(cv, k, 120));
  bar.querySelectorAll('.jw-boost').forEach((b) => b.addEventListener('click', () => boosterTap(barSeat(), Number(b.dataset.k))));
  ctl.scores = ctl.state ? ctl.state.players.map((p) => p.score) : [0, 0];
}
// whose boosters the bar shows: yours, or (two on one phone) whoever is playing
const barSeat = () => (ctl.mode === 'two' ? ctl.state?.turn ?? 0 : bottomSeat());
function bumpScore(seat, pts) {
  ctl.scores[seat] += pts;
  const el = document.querySelector(`.jw-plate[data-seat="${seat}"] .jw-score`); if (!el) return;
  el.textContent = ctl.scores[seat]; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
}
function renderPlates() {
  const s = ctl.state; if (!s) return;
  for (const el of document.querySelectorAll('.jw-plate')) {
    const seat = Number(el.dataset.seat), p = s.players[seat], on = s.winner === null && s.turn === seat;
    el.classList.toggle('on', on);
    el.querySelector('.jw-who b').textContent = ctl.names[seat] || p.name;
    el.querySelector('.jw-who small').innerHTML = on ? `<span>${ctl.mode !== 'two' && seat === mySeat() ? 'دورك' : 'يلعب'}</span>` : '';
    if (!ctl.busy) { ctl.scores[seat] = p.score; el.querySelector('.jw-score').textContent = p.score; }
    el.querySelectorAll('.jw-mini i').forEach((m, k) => { const need = BOOSTERS[k].need; m.style.setProperty('--c', Math.round(Math.min(need, p.charge[k]) / need * 100) + '%'); m.classList.toggle('ready', p.charge[k] >= need); });
  }
  const seat = barSeat(), p = s.players[seat], bar = $('#jwBoostBar');
  bar.dataset.seat = seat;
  bar.querySelectorAll('.jw-boost').forEach((b, k) => {
    const need = BOOSTERS[k].need, have = Math.min(need, p.charge[k]), ready = have >= need;
    b.style.setProperty('--charge', Math.round(have / need * 100));
    b.querySelector('small').textContent = ready ? 'جاهزة!' : have + '/' + need;
    b.classList.toggle('ready', ready); b.classList.toggle('aim', ctl.aim === k && s.turn === seat);
    const mine = ctl.mode === 'two' || !ctl.bots[seat];
    b.disabled = !(ready && mine && s.turn === seat && s.winner === null);
  });
  // the moves left, between the two players, in the colour of the one playing
  const mv = $('#jwMoves');
  if (mv) {
    const n = s.winner !== null ? 0 : Math.max(JD.MOVES, s.moves), had = mv.querySelectorAll('i.full').length;
    mv.className = 'mm-moves ' + (s.turn === bottomSeat() ? 'me' : 'foe');
    mv.innerHTML = Array.from({ length: n }, (_, i) => `<i class="${i < s.moves ? 'full' : had > s.moves && i < had ? 'used' : ''}"></i>`).join('');
    mv.setAttribute('aria-label', s.winner !== null ? '' : 'باقي ' + s.moves + ' حركات');
  }
  const r = $('#jwRound'), last = s.round === JD.ROUNDS;
  r.textContent = s.winner !== null ? 'انتهت المواجهة' : 'الجولة ' + s.round + ' من ' + JD.ROUNDS;
  r.parentElement.classList.toggle('last', last && s.winner === null);
  $('#jwRoundNote').textContent = last && s.winner === null ? 'الجولة الأخيرة · النقاط دبل' : '';
}
function statusText() {
  const s = ctl.state; if (!s) return '';
  if (s.winner !== null) return '';
  if (ctl.aim >= 0) return 'اضغط مكان ' + BOOSTERS[ctl.aim].name;
  const name = ctl.names[s.turn] || 'اللاعب';
  if (ctl.mode === 'two') return 'دور ' + name;
  if (humanTurn()) return 'دورك · ' + (s.moves === 1 ? 'باقي لك حركة' : 'باقي لك ' + (s.moves === 2 ? 'حركتين' : s.moves + ' حركات'));
  return 'دور ' + name + '…';
}
function renderStatus() {
  const box = $('#status'); let span = box.querySelector('.jw-say'); if (!span) { span = document.createElement('span'); span.className = 'jw-say'; box.prepend(span); }
  span.textContent = statusText(); box.classList.toggle('mine', humanTurn());
}
function turnBanner(prev) {
  const s = ctl.state; if (!s || s.winner !== null || !prev) return;
  if (prev.turn !== s.turn) {
    if (s.round === JD.ROUNDS && prev.round !== JD.ROUNDS) banner('الجولة الأخيرة · النقاط ×2', false, 1400, 'gold');
    else if (ctl.mode === 'two') banner('دور ' + (ctl.names[s.turn] || ''), s.turn === 1);
    else if (humanTurn()) { banner('دورك!'); if (ctl.mode !== 'online') play('yourTurn', 0.6); }
    else banner('دور ' + (ctl.names[s.turn] || 'الخصم'), true);
  }
}
function flashBooster(seat, id) {
  const k = BOOSTERS.findIndex((b) => b.id === id), el = document.querySelector(`#jwBoostBar[data-seat="${seat}"] .jw-boost[data-k="${k}"]`) || document.querySelector(`.jw-plate[data-seat="${seat}"] .jw-mini i[data-k="${k}"]`);
  if (el) { el.classList.add('aim'); setTimeout(() => el.classList.remove('aim'), 700); }
  banner(BOOSTERS[k]?.name + '!', seat !== mySeat(), 900, 'gold'); play('levelUp', 0.45);
}
function scheduleHint() {
  clearTimeout(ctl.idleTimer); view.hint = null;
  if (!canAct()) return;
  ctl.idleTimer = setTimeout(() => { if (!canAct()) return; const m = chooseJewelsMove({ ...ctl.state, players: ctl.state.players.map((p) => ({ ...p, charge: [0, 0, 0] })) }, 'medium', () => 0.5); if (m?.type === 'swap') { view.hint = [m.a, m.b]; invalidate(); } }, 7000);
}
function afterMove(prev) {
  renderPlates(); renderStatus(); turnBanner(prev); scheduleHint();
  const s = ctl.state;
  if (s.winner !== null) { showEnd(); return; }
  if (ctl.mode === 'ai' && s.turn === 1) { clearTimeout(ctl.aiTimer); ctl.aiTimer = setTimeout(aiMove, 900); }
}
async function runLocal(fn) {
  const prev = ctl.state; let next;
  try { next = fn(prev); } catch (e) { return false; }
  ctl.busy = true; ctl.aim = -1; view.aimCell = -1;
  ctl.state = next;
  try { await animateLast(next.last); } finally { ctl.busy = false; }
  setBoard(next.board); afterMove(prev); return true;
}
async function aiMove() {
  const s = ctl.state; if (!s || s.winner !== null || s.turn !== 1 || ctl.mode !== 'ai' || $('#game').hidden) return;
  const m = chooseJewelsMove(s, ctl.level);
  if (!m) return;
  if (m.type === 'booster') { await runLocal((st) => playJewelsBooster(st, 1, m.id, m.cell)); return; }
  view.sel = m.a; invalidate(); await sleep(260); view.sel = -1;
  await runLocal((st) => playJewelsSwap(st, 1, m.a, m.b));
}

/* ---------- input ---------- */
const legal = () => { const set = new Set(); for (const [a, b] of legalSwaps(ctl.state)) { set.add(a + ':' + b); set.add(b + ':' + a); } return set; };
async function trySwap(a, b) {
  view.sel = -1; view.hint = null;
  if (!adjacent(a, b) || !canAct()) return;
  if (!legal().has(a + ':' + b)) { ctl.busy = true; await slideSwap(a, b, true); ctl.busy = false; play('error', 0.3); return; }
  if (ctl.mode === 'online') {
    ctl.busy = true; await slideSwap(a, b); ctl.busy = false;
    ctl.pending = { seq: (ctl.state.seq || 0) + 1, a, b };
    if (!table?.client?.send('jewels_swap', { a, b })) revertPending();
    else ctl.pending.timer = setTimeout(() => revertPending('ما وصلت الحركة، جرّب مرة ثانية'), 8000);
    return;
  }
  await runLocal((s) => playJewelsSwap(s, s.turn, a, b));
}
async function revertPending(message) {
  const p = ctl.pending; if (!p) return; clearTimeout(p.timer); ctl.pending = null;
  setBoard(ctl.state.board); if (message) window.BS_PLATFORM?.toast?.(message); renderStatus();
}
function boosterTap(seat, k) {
  const s = ctl.state; if (!s || s.turn !== seat || !canAct()) return;
  if (s.players[seat].charge[k] < BOOSTERS[k].need) return;
  ctl.aim = ctl.aim === k ? -1 : k; view.aimCell = -1; view.sel = -1;
  renderPlates(); renderStatus(); invalidate();
  if (ctl.aim >= 0) play('open', 0.4);
}
async function useBooster(cell) {
  const k = ctl.aim, id = BOOSTERS[k].id; ctl.aim = -1;
  if (ctl.mode === 'online') {
    ctl.pending = { seq: (ctl.state.seq || 0) + 1, booster: id };
    if (!table?.client?.send('jewels_booster', { id, cell })) revertPending();
    else ctl.pending.timer = setTimeout(() => revertPending('ما وصلت الحركة، جرّب مرة ثانية'), 8000);
    renderPlates(); renderStatus(); return;
  }
  await runLocal((s) => playJewelsBooster(s, s.turn, id, cell));
}
function cellAt(ev) {
  const r = canvas.getBoundingClientRect(), x = Math.floor((ev.clientX - r.left - view.pad) / view.cell), y = Math.floor((ev.clientY - r.top - view.pad) / view.cell);
  return x >= 0 && y >= 0 && x < W && y < H ? y * W + x : -1;
}
let drag = null;
canvas.addEventListener('pointerdown', (ev) => {
  window.BS_AUDIO?.unlock?.();
  const i = cellAt(ev); if (i < 0 || !canAct()) return;
  ev.preventDefault();
  if (ctl.aim >= 0) { view.aimCell = i; invalidate(); drag = { aim: true, i }; return; }
  if (view.sel >= 0 && view.sel !== i && adjacent(view.sel, i)) { const a = view.sel; view.sel = -1; trySwap(a, i); return; }
  view.sel = i; drag = { i, x: ev.clientX, y: ev.clientY }; invalidate();
  try { canvas.setPointerCapture(ev.pointerId); } catch {}
});
canvas.addEventListener('pointermove', (ev) => {
  if (!drag) return;
  if (drag.aim) { const i = cellAt(ev); if (i >= 0) { view.aimCell = i; invalidate(); } return; }
  const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y, far = view.cell * 0.32;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < far) return;
  const x = drag.i % W, y = (drag.i / W) | 0;
  const [tx, ty] = Math.abs(dx) > Math.abs(dy) ? [x + Math.sign(dx), y] : [x, y + Math.sign(dy)];
  const from = drag.i; drag = null;
  if (tx >= 0 && ty >= 0 && tx < W && ty < H) trySwap(from, ty * W + tx); else view.sel = -1;
});
canvas.addEventListener('pointerup', (ev) => {
  if (drag?.aim) { const i = cellAt(ev); drag = null; if (i >= 0 && ctl.aim >= 0) useBooster(i); return; }
  drag = null;
});
canvas.addEventListener('pointercancel', () => { drag = null; });

/* ---------- start, end and the online table ---------- */
// 33.9.9: the meeting — both players slide in and VS lands, then the board drops in
let introTimer = 0;
function showIntro() {
  const box = $('#jwIntro'); if (!box || reduced()) return 0;
  const sides = [['.mm-side.me', bottomSeat()], ['.mm-side.foe', 1 - bottomSeat()]];
  for (const [sel, seat] of sides) {
    const side = box.querySelector(sel); side.querySelector('.mm-ava').replaceChildren(faceOf(seat));
    side.querySelector(':scope > b').textContent = ctl.names[seat] || 'لاعب';
    let note = '';
    if (ctl.mode === 'ai' && ctl.bots[seat]) note = { easy: 'سهل', medium: 'متوسط', hard: 'محترف' }[ctl.level] || '';
    else if (seat === bottomSeat() && ctl.mode !== 'two') { const L = window.BS_PROFILE_PRO?.levelInfo?.(window.BS_CAREER?.get?.() || {}); if (L) note = 'المستوى ' + L.level + ' · ' + L.tier; }
    side.querySelector(':scope > small').textContent = note;
  }
  clearTimeout(introTimer); box.classList.remove('out'); box.hidden = false; play('open', 0.5); setTimeout(() => play('hit', 0.5), 450);
  introTimer = setTimeout(() => { box.classList.add('out'); introTimer = setTimeout(() => { box.hidden = true; box.classList.remove('out'); }, 360); }, 1600);
  return 1900;
}
function showGame() { $('#menu').hidden = true; $('#game').hidden = false; $('#jwEnd').hidden = true; buildPlates(); requestAnimationFrame(fitBoard); renderPlates(); renderStatus(); document.body.classList.add('game-running'); }
function showMenu() { clearTimeout(ctl.aiTimer); clearTimeout(ctl.idleTimer); clearTimeout(introTimer); if ($('#jwIntro')) $('#jwIntro').hidden = true; ctl.state = null; ctl.pending = null; $('#game').hidden = true; $('#menu').hidden = false; $('#jwEnd').hidden = true; document.body.classList.remove('game-running'); }
function myUser() {
  const me = window.BS_SOCIAL?.isLoggedIn?.() ? window.BS_SOCIAL.profile?.() : null;
  return me ? { username: me.username, photo: me.photo || null } : null;
}
function startLocal(mode) {
  clearTimeout(ctl.aiTimer);
  ctl.mode = mode; ctl.endShown = false; ctl.rewarded = false; ctl.busy = false; ctl.pending = null; ctl.aim = -1;
  ctl.receipt = 'jewels:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const me = window.BS_GAME_MENU?.playerName?.() || 'أنت';
  ctl.names = mode === 'ai' ? [me, 'الكمبيوتر'] : [$('#jwName1').value.trim() || 'لاعب 1', $('#jwName2').value.trim() || 'لاعب 2'];
  ctl.bots = mode === 'ai' ? [false, true] : [false, false];
  ctl.users = mode === 'ai' ? [myUser(), { photo: { kind: 'preset', id: 'h-robot' } }] : [null, null];
  ctl.state = createJewelsDuel(ctl.names, { first: mode === 'ai' ? (Math.random() < 0.5 ? 0 : 1) : 0 });
  ctl.shownSeq = 0; setBoard(ctl.state.board); showGame();
  const wait = showIntro();
  setTimeout(() => { if (ctl.state?.winner !== null) return; play('go', 0.6); banner(mode === 'two' ? 'يبدأ ' + ctl.names[ctl.state.turn] : ctl.state.turn === 0 ? 'أنت تبدأ!' : 'الكمبيوتر يبدأ', ctl.state.turn === 1, 1200); }, wait);
  scheduleHint();
  if (mode === 'ai' && ctl.state.turn === 1) ctl.aiTimer = setTimeout(aiMove, 1400 + wait);
}
function showEnd() {
  if (ctl.endShown) return; ctl.endShown = true;
  const s = ctl.state, w = s.winner, card = $('#jwEnd .jw-sheet-card');
  const iWon = ctl.mode === 'two' ? true : w === mySeat();
  const name = esc(ctl.names[w] || s.players[w]?.name || 'لاعب');
  $('#jwEndTitle').innerHTML = ctl.mode === 'two' ? `${name} فاز!` : iWon ? 'فزت!' : 'خسرت';
  const a = bottomSeat(), b = 1 - a, diff = Math.abs(s.players[0].score - s.players[1].score);
  const card2 = (seat, side) => { const d = document.createElement('div'); d.className = 'mm-endp ' + side + (seat === w ? ' win' : ''); d.append(faceOf(seat)); d.insertAdjacentHTML('beforeend', `<b>${s.players[seat].score}</b><small>${esc(ctl.names[seat])}</small>`); return d; };
  const scoresBox = $('#jwEndScores'); scoresBox.replaceChildren(card2(a, 'me'), Object.assign(document.createElement('i'), { textContent: 'ضد' }), card2(b, 'foe'));
  $('#jwEndText').textContent = diff === 0 ? 'تعادل في النقاط، وحسمها صاحب أكبر ضربة.' : (ctl.mode === 'two' ? 'بفرق ' + diff + ' نقطة.' : iWon ? 'بفرق ' + diff + ' نقطة. أكبر ضربة لك: ' + s.players[mySeat()].best + ' نقطة.' : 'الفرق ' + diff + ' نقطة. المرة الجاية لك.');
  card.classList.toggle('won', iWon);
  $('#jwAgain').textContent = ctl.mode === 'online' ? (room?.publicMatch ? 'مواجهة جديدة' : room?.me?.role === 'host' ? 'جولة جديدة' : 'بانتظار المضيف') : 'مواجهة جديدة';
  $('#jwAgain').disabled = ctl.mode === 'online' && !room?.publicMatch && room?.me?.role !== 'host';
  setTimeout(() => { if (ctl.endShown) $('#jwEnd').hidden = false; }, 900);
  play(iWon ? 'victory' : 'defeat', 0.8);
  if (!ctl.rewarded) {
    ctl.rewarded = true;
    if (ctl.mode === 'online') window.BS_CAREER?.refresh?.()?.catch?.(() => {});
    else if (ctl.mode === 'ai') window.BS_CAREER?.record?.({ id: ctl.receipt, game: 'jewels', win: w === 0 })?.catch?.(() => {});
  }
}
$('#jwAgain').addEventListener('click', () => { $('#jwEnd').hidden = true; if (ctl.mode === 'online') table?.again(); else startLocal(ctl.mode); });
$('#jwToMenu').addEventListener('click', () => { if (ctl.mode === 'online') table?.leave(); showMenu(); });
let exitArmed = 0;
$('#jwExit').addEventListener('click', () => {
  const live = ctl.state && ctl.state.winner === null;
  if (live && Date.now() - exitArmed > 2500) { exitArmed = Date.now(); window.BS_PLATFORM?.toast?.('اضغط مرة ثانية عشان تطلع'); return; }
  if (ctl.mode === 'online') table?.leave(); showMenu();
});

async function apply(next, { animate }) {
  room = next;
  const s = next.state; if (!s || s.game !== 'jewels') return;
  const fresh = ctl.mode !== 'online' || $('#game').hidden || ctl.match !== (next.startedAt || 0);
  ctl.me = next.me?.index ?? 0;
  ctl.names = [0, 1].map((i) => next.players?.find((p) => p.index === i)?.name || s.players[i]?.name || 'لاعب');
  ctl.bots = [0, 1].map((i) => Boolean(next.players?.find((p) => p.index === i)?.bot));
  ctl.users = [0, 1].map((i) => { const p = next.players?.find((x) => x.index === i); const hero = p?.look?.character; return p?.username ? { username: p.username, fallback: hero ? '/assets/heroes/face/' + hero + '.webp' : '' } : hero ? { photo: null, fallback: '/assets/heroes/face/' + hero + '.webp', username: '' } : null; });
  if (fresh) {
    clearTimeout(ctl.aiTimer);
    ctl.match = next.startedAt || 0; ctl.mode = 'online'; ctl.endShown = false; ctl.rewarded = false; ctl.pending = null; ctl.aim = -1;
    ctl.shownSeq = s.last ? s.last.seq - (next.stepOf ? 1 : 0) : 0;
    ctl.state = next.stepOf && s.last ? { ...s, players: s.players } : s;
    setBoard(next.stepOf && s.last ? s.last.before : s.board); showGame();
    if (!s.last) { const wait = showIntro(); setTimeout(() => { play('go', 0.6); banner(s.turn === ctl.me ? 'أنت تبدأ!' : (ctl.names[s.turn] || 'الخصم') + ' يبدأ', s.turn !== ctl.me, 1200); }, wait); }
  }
  const prev = ctl.state;
  if (s.last && s.last.seq > ctl.shownSeq) {
    // the scores before this move, so the plates count up with it
    const before = s.players.map((p) => p.score); before[s.last.seat] -= s.last.total || 0;
    ctl.scores = before; document.querySelectorAll('.jw-plate').forEach((el) => { el.querySelector('.jw-score').textContent = before[Number(el.dataset.seat)]; });
    const mine = ctl.pending && ctl.pending.seq === s.last.seq;
    if (ctl.pending) { clearTimeout(ctl.pending.timer); ctl.pending = null; }
    if (animate && !document.hidden) { ctl.busy = true; try { await animateLast(s.last, { skipSwap: Boolean(mine && s.last.kind === 'swap') }); } finally { ctl.busy = false; } }
    ctl.shownSeq = s.last.seq;
  }
  ctl.state = s; setBoard(s.board);
  afterMove(prev);
}
try {
  table = createTable({
    game: 'jewels',
    quickNote: 'مواجهة 1 ضد 1: نلقى لك منافس خلال ثواني.',
    roomNote: 'أنشئ غرفة وارسل الرمز لخويّك.',
    lobbyNote: (next, isPublic) => (isPublic ? 'تبدأ بعد العد.' : 'أرسل الرمز لخويّك. تبدأ إذا ضغطت «ابدأ».'),
    apply,
    onLobby: () => { if (!$('#game').hidden) showMenu(); setMode('online'); },
    onMenu: () => { if (!$('#game').hidden) showMenu(); },
    onStatus: () => {},
    onError: (message) => { if (ctl.pending) revertPending(message); else window.BS_PLATFORM?.toast?.(message); },
  });
} catch (error) { console.error('jewels online unavailable', error); }

/* ---------- the menu ---------- */
function setMode(mode) {
  for (const b of document.querySelectorAll('.jw-modes button')) b.setAttribute('aria-checked', String(b.dataset.mode === mode));
  for (const p of document.querySelectorAll('.jw-panel')) p.hidden = p.dataset.panel !== mode;
  try { localStorage.setItem('bs-jewels-mode', mode); } catch {}
}
for (const b of document.querySelectorAll('.jw-modes button')) b.addEventListener('click', () => setMode(b.dataset.mode));
function setLevel(v) { ctl.level = v; for (const b of document.querySelectorAll('#jwLevel button')) b.setAttribute('aria-checked', String(b.dataset.v === v)); try { localStorage.setItem('bs-jewels-level', v); } catch {} }
for (const b of document.querySelectorAll('#jwLevel button')) b.addEventListener('click', () => setLevel(b.dataset.v));
$('#jwStartAi').addEventListener('click', () => { window.BS_AUDIO?.unlock?.(); startLocal('ai'); });
$('#jwStartTwo').addEventListener('click', () => { window.BS_AUDIO?.unlock?.(); startLocal('two'); });
{
  let mode = 'online', level = 'medium';
  try { mode = localStorage.getItem('bs-jewels-mode') || 'online'; level = localStorage.getItem('bs-jewels-level') || 'medium'; } catch {}
  if (/[?&]room=\d{6}/.test(location.search)) mode = 'online';
  setMode(['online', 'ai', 'two'].includes(mode) ? mode : 'online'); setLevel(['easy', 'medium', 'hard'].includes(level) ? level : 'medium');
}
function paintMute() { const muted = Boolean(window.BS_AUDIO?.getSettings?.().muted); for (const id of ['#jwMute', '#jwSound']) { const b = $(id); if (!b) continue; b.textContent = muted ? '🔇' : '🔊'; b.setAttribute('aria-pressed', String(muted)); } }
for (const id of ['#jwMute', '#jwSound']) $(id)?.addEventListener('click', () => { window.BS_AUDIO?.toggleMuted?.(); paintMute(); });
addEventListener('bs-audio-change', paintMute); paintMute();
addEventListener('resize', () => { if (!$('#game').hidden) fitBoard(); });

/* the menu picture: gems drifting on the night */
(function hero() {
  const cv = $('#jwHero'); if (!cv) return; const h = cv.getContext('2d');
  const gems = Array.from({ length: 26 }, (_, i) => ({ x: Math.random() * 760, y: Math.random() * 460, c: i % 6, s: i % 9 === 0 ? 'ball' : i % 7 === 0 ? 'bomb' : i % 5 === 0 ? 'rh' : '', r: 26 + Math.random() * 34, v: 8 + Math.random() * 16, a: Math.random() * 6, spin: (Math.random() - 0.5) * 0.6 }));
  let last = performance.now();
  function paint(now) {
    if ($('#menu').hidden) { requestAnimationFrame(paint); last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const gr = h.createRadialGradient(380, 120, 40, 380, 230, 520); gr.addColorStop(0, '#c37bff'); gr.addColorStop(0.45, '#6a28d8'); gr.addColorStop(1, '#22096a'); h.fillStyle = gr; h.fillRect(0, 0, 760, 460);
    for (const q of gems) {
      if (!reduced()) { q.y += q.v * dt; q.a += q.spin * dt; if (q.y > 500) { q.y = -40; q.x = Math.random() * 760; } }
      h.save(); h.translate(q.x, q.y); h.rotate(Math.sin(q.a) * 0.25); h.globalAlpha = 0.55 + 0.45 * Math.min(1, q.r / 60);
      const sp = sprite(q.c, q.s, 120); h.drawImage(sp, -q.r, -q.r, q.r * 2, q.r * 2); h.restore();
    }
    if (!reduced()) requestAnimationFrame(paint);
  }
  requestAnimationFrame(paint);
})();
// for the page's own checks: the state on screen and a move like a finger makes
window.BS_JEWELS = Object.freeze({ get state() { return ctl.state; }, get busy() { return ctl.busy || Boolean(ctl.pending); }, swap: (a, b) => trySwap(a, b), booster: (k, cell) => { boosterTap(ctl.state.turn, k); return ctl.aim >= 0 ? useBooster(cell) : null; }, legal: () => (ctl.state ? legalSwaps(ctl.state) : []) });
