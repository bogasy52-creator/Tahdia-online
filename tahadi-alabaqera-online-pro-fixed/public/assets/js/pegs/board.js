import {drawSymbol} from './symbols.js?v=33.11.1';
import {PEG_SYMBOLS} from '../engines/pegs-engine.js?v=33.14.0';
/* Tahdia 33.10.1 — «شطرنج الذاكرة»: the round wooden board drawn on a canvas, seen from the table.
   Twenty-four beech pawns stand in their holes; a pawn that is lifted and tipped shows the colour
   painted under its foot. The page tells each pawn what to do (lift, tip, shake, fly) and this file
   only draws: it never knows a colour it was not told to show. */
import { PEG_COLORS, PEG_HOLES, pegsHoles } from '../engines/pegs-engine.js?v=33.14.0';

import {nearestPegsTarget} from './targets.js';
let TILT = 0.62; // how flat the board looks (1 = seen from straight above); set by the room the board has
const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

/** The pawn's outline: half-width at each height, foot at 0, crown at 1. */
const PROFILE = [
  [0, 0.3], [0.035, 0.305], [0.07, 0.29], [0.1, 0.25], [0.13, 0.215], [0.2, 0.19], [0.3, 0.155], [0.4, 0.128], [0.47, 0.118],
  [0.5, 0.17], [0.535, 0.185], [0.56, 0.16], [0.585, 0.1], [0.63, 0.095],
];
const HEAD = { y: 0.8, r: 0.185 };

function pawnSprite(px, ratio) {
  // a pawn of height px (css pixels), drawn once at the screen's resolution
  const w = Math.ceil(px * 0.72), h = Math.ceil(px * 1.08), c = document.createElement('canvas');
  c.width = Math.ceil(w * ratio); c.height = Math.ceil(h * ratio);
  const g = c.getContext('2d'); if (!g) return null;
  g.scale(ratio, ratio);
  const cx = w / 2, foot = h - px * 0.07, Y = (t) => foot - t * px * 0.86, X = (hw) => hw * px;
  const wood = (x0, x1) => {
    const lg = g.createLinearGradient(x0, 0, x1, 0);
    lg.addColorStop(0, '#9e8d74'); lg.addColorStop(0.16, '#d8c9af'); lg.addColorStop(0.38, '#fff6e5'); lg.addColorStop(0.5, '#fffdf2');
    lg.addColorStop(0.7, '#eadcc4'); lg.addColorStop(0.9, '#b5a58c'); lg.addColorStop(1, '#806b4b');
    return lg;
  };
  // the body, turned on a lathe
  g.beginPath();
  PROFILE.forEach(([t, hw], i) => (i ? g.lineTo(cx + X(hw), Y(t)) : g.moveTo(cx + X(hw), Y(t))));
  for (let i = PROFILE.length - 1; i >= 0; i--) { const [t, hw] = PROFILE[i]; g.lineTo(cx - X(hw), Y(t)); }
  g.closePath(); g.fillStyle = wood(cx - X(0.31), cx + X(0.31)); g.fill();
  // rounded front edge of the foot
  g.beginPath(); g.ellipse(cx, Y(0.012), X(0.3), X(0.3) * TILT * 0.55, 0, 0, Math.PI); g.fillStyle = wood(cx - X(0.3), cx + X(0.3)); g.fill();
  g.beginPath(); g.ellipse(cx, Y(0.012), X(0.3), X(0.3) * TILT * 0.55, 0, 0, Math.PI); g.strokeStyle = '#5b3818aa'; g.lineWidth = px * 0.012; g.stroke();
  // the turned rings: the step on the foot and the collar
  for (const [t, hw, a] of [[0.1, 0.25, 0.55], [0.535, 0.185, 0.9]]) {
    g.beginPath(); g.ellipse(cx, Y(t), X(hw), X(hw) * TILT * 0.45, 0, 0, TAU);
    const top = g.createLinearGradient(cx - X(hw), 0, cx + X(hw), 0); top.addColorStop(0, '#be9445'); top.addColorStop(0.45, '#fff0b1'); top.addColorStop(1, '#ad7b30');
    g.globalAlpha = a; g.fillStyle = top; g.fill(); g.globalAlpha = 1;
    g.beginPath(); g.ellipse(cx, Y(t), X(hw), X(hw) * TILT * 0.45, 0, 0, Math.PI); g.strokeStyle = '#806b4baa'; g.lineWidth = px * 0.01; g.stroke();
  }
  // the head
  const hy = Y(HEAD.y), hr = X(HEAD.r);
  const sphere = g.createRadialGradient(cx - hr * 0.38, hy - hr * 0.42, hr * 0.08, cx, hy, hr * 1.05);
  sphere.addColorStop(0, '#fff6e2'); sphere.addColorStop(0.35, '#fff2d5'); sphere.addColorStop(0.75, '#d2c09e'); sphere.addColorStop(1, '#887351');
  g.beginPath(); g.arc(cx, hy, hr, 0, TAU); g.fillStyle = sphere; g.fill();
  // grain: a few faint lines down the body
  g.save(); g.beginPath();
  PROFILE.forEach(([t, hw], i) => (i ? g.lineTo(cx + X(hw), Y(t)) : g.moveTo(cx + X(hw), Y(t))));
  for (let i = PROFILE.length - 1; i >= 0; i--) { const [t, hw] = PROFILE[i]; g.lineTo(cx - X(hw), Y(t)); }
  g.closePath(); g.clip(); g.strokeStyle = '#8a5a2c22'; g.lineWidth = px * 0.008;
  for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(cx + k * px * 0.05, Y(0)); g.bezierCurveTo(cx + k * px * 0.03 + px * 0.02, Y(0.25), cx + k * px * 0.02 - px * 0.015, Y(0.45), cx + k * px * 0.03, Y(0.64)); g.stroke(); }
  g.restore();
  // a soft light on the left of the body
  g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.18;
  g.beginPath(); g.ellipse(cx - X(0.07), Y(0.3), X(0.035), px * 0.14, 0, 0, TAU); g.fillStyle = '#fff'; g.fill(); g.restore();
  return { canvas: c, w, h, foot };
}

export function createPegsBoard(canvas) {
  const ctx = canvas.getContext('2d');
  let W = 1, H = 1, ratio = 1, cx = 0, cy = 0, R = 1, sprite = null, boardLayer = null, pawnPx = 1;
  let holes = PEG_HOLES,stretch=1;

  function toScreen(x, y) { return { x: cx + x * R, y: cy + y * R * TILT }; }
  const depth = (y) => 0.9 + (y + 1) * 0.1; // far pawns a little smaller

  function paintBoard() {
    const c = document.createElement('canvas'); c.width = Math.ceil(W * ratio); c.height = Math.ceil(H * ratio);
    const g = c.getContext('2d'); if (!g) return null; g.scale(ratio, ratio);
    const thick = R * 0.085;
    // the board's shadow on the table
    g.save(); g.filter = 'blur(' + Math.round(R * 0.06) + 'px)'; g.beginPath(); g.ellipse(cx, cy + thick + R * 0.06, R * 1.02, R * TILT * stretch * 1.02, 0, 0, TAU); g.fillStyle = '#00000088'; g.fill(); g.restore();
    // the rim (the board's edge, seen in front)
    const side = g.createLinearGradient(cx - R, 0, cx + R, 0);
    side.addColorStop(0, '#2c1608'); side.addColorStop(0.3, '#6a3a1a'); side.addColorStop(0.55, '#8b5129'); side.addColorStop(1, '#2a1406');
    g.beginPath(); g.ellipse(cx, cy + thick, R, R * TILT * stretch, 0, 0, Math.PI); g.lineTo(cx - R, cy); g.ellipse(cx, cy, R, R * TILT * stretch, 0, Math.PI, 0, true); g.closePath(); g.fillStyle = side; g.fill();
    // the top: walnut with the rings of the tree
    const top = g.createRadialGradient(cx - R * 0.25, cy - R * TILT * stretch * 0.4, R * 0.1, cx, cy, R * 1.05);
    top.addColorStop(0, '#a87245'); top.addColorStop(0.55, '#7d4c2c'); top.addColorStop(1, '#4c2d1e');
    g.beginPath(); g.ellipse(cx, cy, R, R * TILT * stretch, 0, 0, TAU); g.fillStyle = top; g.fill();
    g.save(); g.beginPath(); g.ellipse(cx, cy, R, R * TILT * stretch, 0, 0, TAU); g.clip();
    for (let i = 1; i < 26; i++) {
      const r = R * (0.08 + i * 0.037 + Math.sin(i * 1.7) * 0.006);
      g.beginPath(); g.ellipse(cx + Math.sin(i) * R * 0.012, cy + Math.cos(i * 0.7) * R * 0.008, r, r * TILT * stretch, 0, 0, TAU);
      g.strokeStyle = i % 3 ? '#4a2810' + (i % 2 ? '1c' : '14') : '#f0c08a12'; g.lineWidth = R * (0.004 + (i % 4) * 0.002); g.stroke();
    }
    // a light falling on the far side
    const sheen = g.createLinearGradient(0, cy - R * TILT * stretch, 0, cy + R * TILT); sheen.addColorStop(0, '#ffe2b733'); sheen.addColorStop(0.5, '#ffe2b700'); sheen.addColorStop(1, '#00000033');
    g.fillStyle = sheen; g.fillRect(cx - R, cy - R, R * 2, R * 2);
    g.restore();
    // the inlay round the edge: the six colours of the game
    const inlay = R * 0.935;
    const colorCount=holes.length===48?8:6;
    for (let k = 0; k < colorCount; k++) {
      g.beginPath(); g.ellipse(cx, cy, inlay, inlay * TILT * stretch, 0, -Math.PI / 2 + k * TAU / colorCount + 0.06, -Math.PI / 2 + (k + 1) * TAU / colorCount - 0.06);
      g.strokeStyle = PEG_COLORS[k].hex; g.globalAlpha = 0.78; g.lineWidth = R * 0.018; g.stroke(); g.globalAlpha = 1;
    }
    for (const r of [0.965, 0.905]) { g.beginPath(); g.ellipse(cx, cy, R * r, R * r * TILT * stretch, 0, 0, TAU); g.strokeStyle = '#2a14067a'; g.lineWidth = R * 0.006; g.stroke(); }
    // the centre medallion
    g.beginPath(); g.ellipse(cx, cy, R * 0.09, R * 0.09 * TILT, 0, 0, TAU); g.fillStyle = '#4a2a12'; g.fill();
    g.beginPath(); g.ellipse(cx, cy, R * 0.06, R * 0.06 * TILT, 0, 0, TAU); g.strokeStyle = '#e8b56c88'; g.lineWidth = R * 0.008; g.stroke();
    // the holes
    for (const h of holes) {
      const p = toScreen(h.x, h.y), s = depth(h.y), rx = R * 0.1 * s, ry = rx * TILT;
      g.beginPath(); g.ellipse(p.x, p.y + ry * 0.12, rx * 1.12, ry * 1.12, 0, 0, TAU); g.fillStyle = '#f4c48a22'; g.fill();
      const hole = g.createRadialGradient(p.x, p.y - ry * 0.4, rx * 0.1, p.x, p.y, rx);
      hole.addColorStop(0, '#120802'); hole.addColorStop(0.7, '#2a160a'); hole.addColorStop(1, '#4b2a14');
      g.beginPath(); g.ellipse(p.x, p.y, rx, ry, 0, 0, TAU); g.fillStyle = hole; g.fill();
      g.beginPath(); g.ellipse(p.x, p.y, rx, ry, 0, 0.15, Math.PI - 0.15); g.strokeStyle = '#d99a5a55'; g.lineWidth = R * 0.006; g.stroke();
    }
    return c;
  }

  function resize(width, height, dpr = Math.min(2.5, window.devicePixelRatio || 1)) {
    W = Math.max(1, width); H = Math.max(1, height); ratio = dpr;
    canvas.width = Math.ceil(W * ratio); canvas.height = Math.ceil(H * ratio);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    // a tall stage looks more from above (the pawns stand apart and are easier to tap), a wide one from the side
    const Rw = W * 0.47;
    TILT = clamp((H * 0.96 / Rw - 0.54) / 1.8, 0.6, 0.76);
    R = Math.min(Rw, (H * 0.96) / (1.8 * TILT * stretch + 0.54)); cx = W / 2;
    const top = (H - (1.8 * TILT * stretch + 0.54) * R) / 2; cy = top + (0.8 * TILT * stretch + 0.44) * R;
    pawnPx = R * (holes.length===48?.28:.36); sprite = pawnSprite(pawnPx, ratio); boardLayer = paintBoard();
  }

  /** Where pawn i stands (its foot), with any travel the page gave it. */
  function footOf(i, fx) {
    const h = holes[i];
    if (fx?.at) { const p = toScreen(fx.at.x, fx.at.y); return { x: p.x, y: p.y, s: depth(fx.at.y), wy: fx.at.y }; }
    const p = toScreen(h.x, h.y); return { x: p.x, y: p.y, s: depth(h.y), wy: h.y };
  }

  function drawPawn(i, fx, t) {
    const f = footOf(i, fx), s = f.s * (fx?.scale ?? 1), lift = (fx?.lift || 0) * pawnPx * 0.55, tip = clamp(fx?.tip || 0);
    const x = f.x + (fx?.dx || 0), foot = f.y - lift + (fx?.dy || 0), alpha = fx?.alpha ?? 1;
    if (alpha <= 0) return;
    ctx.save(); ctx.globalAlpha = alpha;
    // the shadow it throws on the board
    const sr = pawnPx * 0.3 * s * (1 + lift / (pawnPx * 2));
    ctx.beginPath(); ctx.ellipse(f.x + (fx?.dx || 0) + lift * 0.18, f.y + pawnPx * 0.02, sr, sr * TILT * stretch, 0, 0, TAU);
    ctx.fillStyle = 'rgba(20,8,2,' + (0.42 - Math.min(0.28, lift / pawnPx * 0.4)) + ')'; ctx.fill();
    // a ring of light for a pawn you can take, or the colour of a verdict
    if (fx?.ring) {
      const pulse = 0.65 + Math.sin(t / 260 + i) * 0.25;
      ctx.beginPath(); ctx.ellipse(f.x, f.y, pawnPx * 0.36 * s, pawnPx * 0.36 * s * TILT, 0, 0, TAU);
      ctx.strokeStyle = fx.ring; ctx.globalAlpha = alpha * pulse; ctx.lineWidth = Math.max(2, pawnPx * 0.05); ctx.stroke(); ctx.globalAlpha = alpha;
    }
    if (fx?.glow) {
      const gr = ctx.createRadialGradient(x, foot - pawnPx * 0.4 * s, 0, x, foot - pawnPx * 0.4 * s, pawnPx * 0.9 * s);
      gr.addColorStop(0, fx.glow + 'aa'); gr.addColorStop(1, fx.glow + '00');
      ctx.fillStyle = gr; ctx.fillRect(x - pawnPx, foot - pawnPx * 1.4 * s, pawnPx * 2, pawnPx * 2 * s);
    }
    // the pawn: tipping toward us shortens it and shows the foot
    if (sprite) {
      const sw = sprite.w * s, sh = sprite.h * s * (1 - tip * 0.42);
      ctx.drawImage(sprite.canvas, x - sw / 2, foot - (sprite.foot / sprite.h) * sh, sw, sh);
    }
    const color = fx?.color;
    if (tip > 0.02 && color !== undefined && color !== null) {
      const rx = pawnPx * 0.3 * s, ry = rx * (TILT * 0.55 + (0.92 - TILT * 0.55) * tip), cyFoot = foot + ry * 0.15;
      ctx.beginPath(); ctx.ellipse(x, cyFoot, rx * 1.06, ry * 1.06, 0, 0, TAU); ctx.fillStyle = '#887351'; ctx.fill();
      if (color >= 0) {
        const col = PEG_COLORS[color], disc = ctx.createRadialGradient(x - rx * 0.3, cyFoot - ry * 0.35, rx * 0.05, x, cyFoot, rx);
        disc.addColorStop(0, col.id === 'black' ? '#6a6a74' : '#ffffff'); disc.addColorStop(0.28, col.hex); disc.addColorStop(1, col.dark);
        ctx.beginPath(); ctx.ellipse(x, cyFoot, rx * 0.9, ry * 0.9, 0, 0, TAU); ctx.fillStyle = disc; ctx.fill();
        ctx.beginPath(); ctx.ellipse(x, cyFoot, rx * 0.9, ry * 0.9, 0, 0, TAU); ctx.strokeStyle = col.id === 'white' ? '#9a9486' : '#00000055'; ctx.lineWidth = Math.max(1, rx * 0.06); ctx.stroke();
        ctx.save();ctx.translate(x,cyFoot);ctx.scale(1,ry/rx);drawSymbol(ctx,PEG_SYMBOLS[color],0,0,rx*.48);ctx.fillStyle=col.id==='white'||col.id==='yellow'?'#403120':'#fff9e9';ctx.fill();ctx.restore();
        ctx.beginPath(); ctx.ellipse(x - rx * 0.12, cyFoot - ry * 0.22, rx * 0.5, ry * 0.32, -0.3, Math.PI * 1.05, Math.PI * 1.75); ctx.strokeStyle = '#ffffffaa'; ctx.lineWidth = Math.max(1, rx * 0.08); ctx.stroke();
      } else {
        // a pawn someone else looked under: you see that they looked, never the colour
        ctx.beginPath(); ctx.ellipse(x, cyFoot, rx * 0.9, ry * 0.9, 0, 0, TAU); ctx.fillStyle = '#2a1a3a'; ctx.fill();
        ctx.fillStyle = '#bfe8ff'; ctx.font = '800 ' + Math.round(ry * 1.2) + 'px Tajawal, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('؟', x, cyFoot + ry * 0.05);
      }
    }
    if (fx?.mark) {
      ctx.font = '900 ' + Math.round(pawnPx * 0.42 * s) + 'px Tajawal, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.direction = 'ltr'; ctx.lineWidth = pawnPx * 0.07; ctx.strokeStyle = '#2a0a0a'; ctx.strokeText(fx.mark, x, foot - pawnPx * 1.05 * s); ctx.fillStyle = fx.markColor || '#ff5b5b'; ctx.fillText(fx.mark, x, foot - pawnPx * 1.05 * s);
    }
    ctx.restore();
  }

  function drawParticles(list, t) {
    for (const p of list) {
      const k = clamp((t - p.start) / p.life); if (k <= 0 || k >= 1) continue;
      const x = p.x + p.vx * k * p.life / 1000, y = p.y + p.vy * k * p.life / 1000 + 260 * (k * p.life / 1000) ** 2 * (p.fall ?? 1);
      ctx.globalAlpha = 1 - k;
      if (p.text) {
        ctx.font = '900 ' + Math.round(p.size) + 'px Tajawal, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'ltr';
        ctx.lineWidth = p.size * 0.16; ctx.strokeStyle = '#2b1300'; ctx.strokeText(p.text, x, y); ctx.fillStyle = p.color; ctx.fillText(p.text, x, y);
      } else {
        ctx.save(); ctx.translate(x, y); ctx.rotate(p.spin * k * 6); ctx.fillStyle = p.color;
        if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, TAU); ctx.fill(); } else ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  /** view: { pegs, fx: [per pawn], particles, time, ring (a scan light {x, y}) } */
  function draw(view) {
    if (!ctx) return;
    const t = view.time || performance.now();
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, W, H);
    if (boardLayer) ctx.drawImage(boardLayer, 0, 0, W, H);
    // back to front, so near pawns cover far ones; a pawn in the air is drawn last
    const order = view.pegs.map((p, i) => i).filter((i) => (view.pegs[i].taken === null || view.fx[i]?.keep) && !view.fx[i]?.hidden);
    order.sort((a, b) => (view.fx[a]?.top ? 1 : 0) - (view.fx[b]?.top ? 1 : 0) || footOf(a, view.fx[a]).wy - footOf(b, view.fx[b]).wy);
    for (const i of order) drawPawn(i, view.fx[i], t);
    if (view.scan) {
      const p = view.scan, g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, pawnPx * 0.6);
      g.addColorStop(0, (p.color || '#ffd86b') + '66'); g.addColorStop(1, (p.color || '#ffd86b') + '00'); ctx.fillStyle = g; ctx.fillRect(p.x - pawnPx, p.y - pawnPx, pawnPx * 2, pawnPx * 2);
    }
    drawParticles(view.particles || [], t);
  }

  /** The pawn under a point (css pixels on the canvas), nearest first; -1 for none. */
  function hit(px,py,pegs){return nearestPegsTarget(px,py,holes.map((_,i)=>{const f=footOf(i);return {x:f.x,y:f.y-pawnPx*.78*f.s};}),pegs,Math.max(22,pawnPx*.43));}

  return {
    resize, draw, hit,
    setLayout(large){holes=pegsHoles(large);stretch=1;resize(W,H,ratio);},
    /** Screen point (css px) of pawn i's foot, and its middle. */
    foot: (i) => footOf(i), middle: (i) => { const f = footOf(i); return { x: f.x, y: f.y - pawnPx * 0.78 * f.s }; },
    /** The board point under a screen point (to fly a pawn to a player's tray). */
    toBoard: (x, y) => ({ x: (x - cx) / R, y: (y - cy) / (R * TILT) }),
    get size() { return { W, H, R, cx, cy, pawn: pawnPx }; },
  };
}
