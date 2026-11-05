// Turbo Kart — pseudo-3D road renderer. Everything is drawn from code (no image files).
import { SEG_LEN, ROAD_W, CAM_H, CAM_DEPTH, PLAYER_Z, mulberry32 } from './track.js';

const DRAW = 230, FOG = 3.4;
const lerp = (a, b, p) => a + (b - a) * p;
const shade = (hex, amt) => {
  const n = parseInt(hex.slice(1), 16), f = (v) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(f).map((v) => v.toString(16).padStart(2, '0')).join('');
};
const WORLD_W = { pine: 900, cactus: 560, rock: 760, palm: 780, tower: 1100, pylon: 320, billboard: 1500, iceRock: 800, lamp: 190 };

function ridge(seed, count, amp, jag) {
  const r = mulberry32(seed), out = []; let h = 0.5;
  for (let i = 0; i < count; i++) { h = jag ? Math.max(0.1, Math.min(1, h + (r() - 0.5) * jag)) : 0.5 + Math.sin(i * 0.31 + seed) * 0.28 + Math.sin(i * 0.9) * 0.1; out.push(h * amp); }
  return out;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  let W = canvas.width, H = canvas.height, frame = 0;
  const layers = {};
  const layerFor = (theme) => layers[theme.id] || (layers[theme.id] = {
    far: ridge(11, 160, 1, theme.id === 'peak' ? 0.5 : 0), near: ridge(29, 160, 1, theme.id === 'peak' ? 0.4 : 0),
    stars: Array.from({ length: 70 }, (_, i) => { const r = mulberry32(i * 7 + 3); return [r(), r() * 0.45, r() * 1.6 + 0.4]; }),
    city: Array.from({ length: 80 }, (_, i) => { const r = mulberry32(i * 13 + 5); return [r() * 0.8 + 0.4, r() * 0.9 + 0.3]; }),
  });
  let bgFar = 0, bgNear = 0;

  function resize(w, h) { canvas.width = w; canvas.height = h; W = w; H = h; }

  function project(p, camX, camY, camZ) {
    p.camera.x = (p.world.x || 0) - camX; p.camera.y = p.world.y - camY; p.camera.z = p.world.z - camZ;
    const s = CAM_DEPTH / p.camera.z;
    p.screen.scale = s; p.screen.x = Math.round(W / 2 + s * p.camera.x * W / 2);
    p.screen.y = Math.round(H / 2 - s * p.camera.y * H / 2); p.screen.w = Math.round(s * ROAD_W * W / 2);
  }
  function poly(x1, y1, x2, y2, x3, y3, x4, y4, c) {
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4); ctx.closePath(); ctx.fill();
  }

  function background(theme, time) {
    const L = layerFor(theme), hz = H * 0.5;
    const g = ctx.createLinearGradient(0, 0, 0, hz);
    g.addColorStop(0, theme.skyTop); g.addColorStop(0.62, theme.skyMid); g.addColorStop(1, theme.skyLow);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, hz + 2);
    if (theme.id === 'neon') { ctx.fillStyle = '#fff'; for (const [x, y, s] of L.stars) { ctx.globalAlpha = 0.35 + 0.35 * Math.sin(time * 2 + x * 40); ctx.fillRect(((x * W - bgFar * 0.05) % W + W) % W, y * hz, s, s); } ctx.globalAlpha = 1; }
    const sx = W * 0.62 - bgFar * 0.04, sy = H * theme.sunY, sr = H * (theme.id === 'neon' ? 0.085 : 0.075);
    const sg = ctx.createRadialGradient(sx, sy, sr * 0.2, sx, sy, sr * 3.2);
    sg.addColorStop(0, theme.sun); sg.addColorStop(0.18, theme.sun); sg.addColorStop(0.19, theme.sun + '55'); sg.addColorStop(1, theme.sun + '00');
    ctx.fillStyle = sg; ctx.fillRect(sx - sr * 3.2, sy - sr * 3.2, sr * 6.4, sr * 6.4);
    const mt = (arr, off, color, amp, step, base) => {
      ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, hz + 2);
      for (let x = 0; x <= W + step; x += step) { const i = Math.floor(((x + off) / step) % arr.length + arr.length) % arr.length; ctx.lineTo(x, hz - base - arr[i] * amp); }
      ctx.lineTo(W, hz + 2); ctx.closePath(); ctx.fill();
    };
    const step = Math.max(8, Math.round(W / 70));
    mt(L.far, bgFar * 0.2, theme.far[0], H * 0.13, step, 0);
    if (theme.id === 'neon') {
      ctx.fillStyle = theme.near[0];
      const bw = Math.max(10, W / 38);
      for (let i = 0; i < 80; i++) {
        const x = (((i * bw * 0.93 - bgNear * 0.45) % (W + bw * 6)) + W + bw * 6) % (W + bw * 6) - bw * 3, h = L.city[i][1] * H * 0.2 + H * 0.03;
        ctx.fillStyle = theme.near[i % 2]; ctx.fillRect(x, hz - h, bw * 0.9, h + 2);
        ctx.fillStyle = i % 3 ? '#7df9ff' : '#ff2bd6'; ctx.globalAlpha = 0.55;
        for (let wy = hz - h + 6; wy < hz - 4; wy += 9) { if (((i * 31 + Math.floor(wy)) % 5) < 2) ctx.fillRect(x + 3, wy, bw * 0.25, 3); }
        ctx.globalAlpha = 1;
      }
    } else mt(L.near, bgNear * 0.45, theme.near[0], H * 0.1, step, 0);
    ctx.fillStyle = theme.fog; ctx.fillRect(0, hz, W, H - hz);
  }

  function drawSegment(seg, theme, x1, y1, w1, x2, y2, w2, fog) {
    const t = seg.shade;
    ctx.fillStyle = theme.grass[t]; ctx.fillRect(0, y2, W, y1 - y2);
    const r1 = w1 / 6, r2 = w2 / 6;
    poly(x1 - w1 - r1, y1, x1 - w1, y1, x2 - w2, y2, x2 - w2 - r2, y2, theme.rumble[t]);
    poly(x1 + w1 + r1, y1, x1 + w1, y1, x2 + w2, y2, x2 + w2 + r2, y2, theme.rumble[t]);
    poly(x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2, theme.road[t]);
    if (!t) {
      const l1 = w1 / 32, l2 = w2 / 32, lw1 = w1 * 2 / 3, lw2 = w2 * 2 / 3;
      let lx1 = x1 - w1 + lw1, lx2 = x2 - w2 + lw2;
      for (let i = 1; i < 3; i++, lx1 += lw1, lx2 += lw2) poly(lx1 - l1 / 2, y1, lx1 + l1 / 2, y1, lx2 + l2 / 2, y2, lx2 - l2 / 2, y2, theme.lane);
    }
    if (seg.padX !== null) {
      const cx1 = x1 + seg.padX * w1, cx2 = x2 + seg.padX * w2, pw1 = w1 * 0.32, pw2 = w2 * 0.32;
      poly(cx1 - pw1, y1, cx1 + pw1, y1, cx2 + pw2, y2, cx2 - pw2, y2, t ? '#00e5ff' : '#ffe14d');
      poly(cx1 - pw1 * 0.5, y1, cx1 + pw1 * 0.5, y1, cx2 + pw2 * 0.5, y2, cx2 - pw2 * 0.5, y2, t ? '#ffffffaa' : '#ff9f1c');
    }
    if (seg.index < 3 || seg.index === seg.count) { /* start line handled by the arch */ }
    if (fog < 1) { ctx.globalAlpha = 1 - fog; ctx.fillStyle = theme.fog; ctx.fillRect(0, y2, W, y1 - y2); ctx.globalAlpha = 1; }
  }

  // ----- sprites (all vector art; (x, y) is the point on the road, w the on-screen width) -----
  const S = {
    cactus(x, y, w) { ctx.fillStyle = '#3f8f4e'; const t = w * 0.26; rr(x - t / 2, y - w * 1.7, t, w * 1.7, t / 2); ctx.fill(); rr(x - w * 0.5, y - w * 1.05, t * 0.8, w * 0.6, t / 2); ctx.fill(); rr(x - w * 0.5, y - w * 1.05, w * 0.5, t * 0.8, t / 2); ctx.fill(); rr(x + w * 0.24, y - w * 1.3, t * 0.8, w * 0.55, t / 2); ctx.fill(); rr(x, y - w * 0.8 - t * 0.2, w * 0.5, t * 0.8, t / 2); ctx.fill(); ctx.fillStyle = '#ffffff22'; ctx.fillRect(x - t * 0.25, y - w * 1.65, t * 0.2, w * 1.6); },
    rock(x, y, w) { ctx.fillStyle = '#8a6a5c'; ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x - w * 0.36, y - w * 0.5); ctx.lineTo(x - w * 0.05, y - w * 0.62); ctx.lineTo(x + w * 0.3, y - w * 0.42); ctx.lineTo(x + w / 2, y); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#00000028'; ctx.beginPath(); ctx.moveTo(x, y - w * 0.6); ctx.lineTo(x + w * 0.3, y - w * 0.42); ctx.lineTo(x + w / 2, y); ctx.lineTo(x + w * 0.1, y); ctx.closePath(); ctx.fill(); },
    palm(x, y, w) { ctx.strokeStyle = '#7a4b2a'; ctx.lineWidth = Math.max(2, w * 0.1); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + w * 0.1, y - w * 0.9, x + w * 0.02, y - w * 1.7); ctx.stroke(); ctx.fillStyle = '#2f9a56'; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(x + w * 0.02, y - w * 1.7); ctx.quadraticCurveTo(x + i * w * 0.34, y - w * 2.05 + Math.abs(i) * w * 0.12, x + i * w * 0.5, y - w * 1.55 + Math.abs(i) * w * 0.12); ctx.quadraticCurveTo(x + i * w * 0.3, y - w * 1.85, x + w * 0.02, y - w * 1.7); ctx.fill(); } },
    pine(x, y, w) { ctx.fillStyle = '#5b3d2a'; ctx.fillRect(x - w * 0.05, y - w * 0.3, w * 0.1, w * 0.3); for (let i = 0; i < 3; i++) { const by = y - w * 0.25 - i * w * 0.42, bw = w * (0.55 - i * 0.13); ctx.fillStyle = '#1f6b4a'; tri(x, by - w * 0.62, bw, by); ctx.fillStyle = '#f4faff'; tri(x, by - w * 0.62, bw * 0.55, by - w * 0.3); } },
    iceRock(x, y, w) { ctx.fillStyle = '#a8c9e6'; ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x - w * 0.22, y - w * 0.7); ctx.lineTo(x + w * 0.05, y - w * 0.46); ctx.lineTo(x + w * 0.25, y - w * 0.85); ctx.lineTo(x + w / 2, y); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#ffffff99'; tri(x + w * 0.25, y - w * 0.85, w * 0.16, y - w * 0.55); },
    tower(x, y, w) { const h = w * 4; ctx.fillStyle = '#17123d'; ctx.fillRect(x - w * 0.35, y - h, w * 0.7, h); ctx.fillStyle = '#7df9ff'; ctx.globalAlpha = 0.85; for (let wy = y - h + w * 0.2; wy < y - w * 0.2; wy += w * 0.3) { ctx.fillRect(x - w * 0.27, wy, w * 0.16, w * 0.09); ctx.fillRect(x + w * 0.05, wy + w * 0.1, w * 0.16, w * 0.09); } ctx.globalAlpha = 1; ctx.fillStyle = '#ff2bd6'; ctx.fillRect(x - w * 0.35, y - h, w * 0.7, Math.max(2, w * 0.05)); glow(x, y - h, w * 0.5, '#ff2bd6'); },
    pylon(x, y, w) { ctx.fillStyle = '#2b2f55'; ctx.fillRect(x - w * 0.09, y - w * 3, w * 0.18, w * 3); ctx.strokeStyle = '#00f0ff'; ctx.lineWidth = Math.max(2, w * 0.12); ctx.beginPath(); ctx.arc(x, y - w * 3, w * 0.55, 0, 6.3); ctx.stroke(); glow(x, y - w * 3, w * 0.9, '#00f0ff'); },
    billboard(x, y, w) { ctx.fillStyle = '#2b2f55'; ctx.fillRect(x - w * 0.34, y - w * 0.95, w * 0.07, w * 0.95); ctx.fillRect(x + w * 0.27, y - w * 0.95, w * 0.07, w * 0.95); const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0); g.addColorStop(0, '#ff2bd6'); g.addColorStop(1, '#00f0ff'); ctx.fillStyle = g; rr(x - w / 2, y - w * 1.55, w, w * 0.62, w * 0.04); ctx.fill(); ctx.fillStyle = '#ffffffcc'; ctx.fillRect(x - w * 0.38, y - w * 1.39, w * 0.76, w * 0.07); ctx.fillRect(x - w * 0.38, y - w * 1.2, w * 0.5, w * 0.07); },
    lamp(x, y, w) { ctx.fillStyle = '#333a66'; ctx.fillRect(x - w * 0.12, y - w * 5.5, w * 0.24, w * 5.5); glow(x, y - w * 5.6, w * 1.6, '#7df9ff'); ctx.fillStyle = '#e8ffff'; ctx.beginPath(); ctx.arc(x, y - w * 5.6, w * 0.4, 0, 6.3); ctx.fill(); },
    arch(x, y, w, seg, time) { const pw = w * 0.05, h = w * 0.55; ctx.fillStyle = '#e9edf7'; ctx.fillRect(x - w / 2 - pw, y - h, pw, h); ctx.fillRect(x + w / 2, y - h, pw, h); const g = ctx.createLinearGradient(0, y - h, 0, y - h + w * 0.16); g.addColorStop(0, '#222a55'); g.addColorStop(1, '#10152e'); ctx.fillStyle = g; ctx.fillRect(x - w / 2 - pw, y - h, w + pw * 2, w * 0.16); const cs = w * 0.025; for (let i = 0; i < 28; i++) for (let j = 0; j < 3; j++) { ctx.fillStyle = (i + j) % 2 ? '#fff' : '#111'; ctx.fillRect(x - w / 2 + i * (w / 28), y - h + j * cs * 1.2 + w * 0.17, w / 28, cs * 1.2); } ctx.fillStyle = '#ffd23f'; ctx.font = '800 ' + Math.max(8, w * 0.085) + 'px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText('TURBO KART', x, y - h + w * 0.12); },
    banner(x, y, w) { const pw = w * 0.03, h = w * 0.4; ctx.fillStyle = '#c9d3ea'; ctx.fillRect(x - w / 2 - pw, y - h, pw, h); ctx.fillRect(x + w / 2, y - h, pw, h); ctx.fillStyle = '#5b8def'; ctx.fillRect(x - w / 2, y - h, w, w * 0.07); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - w / 2, y - h + w * 0.03, w, w * 0.012); },
  };
  function rr(x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)); else ctx.rect(x, y, w, h); }
  function tri(cx, topY, halfW, baseY) { ctx.beginPath(); ctx.moveTo(cx, topY); ctx.lineTo(cx + halfW, baseY); ctx.lineTo(cx - halfW, baseY); ctx.closePath(); ctx.fill(); }
  function glow(x, y, r, c) { if (r < 3) return; const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, c + 'aa'); g.addColorStop(1, c + '00'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); }

  function drawKart(x, y, w, k, o = {}) {
    if (w < 3) return;
    const c = k.color, dark = shade(c, -0.22), light = shade(c, 0.2);
    ctx.save();
    ctx.translate(x, y);
    if (o.tilt) ctx.rotate(o.tilt);
    if (k.spin > 0) { const sc = Math.abs(Math.cos(k.spinAngle)) * 0.85 + 0.15; ctx.translate(0, -w * 0.3); ctx.scale(sc, 1); ctx.translate(0, w * 0.3); }
    ctx.fillStyle = '#00000055'; ctx.beginPath(); ctx.ellipse(0, w * 0.02, w * 0.56, w * 0.1, 0, 0, 6.3); ctx.fill();
    if (w < 16) { ctx.fillStyle = c; ctx.fillRect(-w * 0.4, -w * 0.5, w * 0.8, w * 0.5); ctx.restore(); return; }
    ctx.fillStyle = '#15171f'; rr(-w * 0.5, -w * 0.36, w * 0.22, w * 0.36, w * 0.06); ctx.fill(); rr(w * 0.28, -w * 0.36, w * 0.22, w * 0.36, w * 0.06); ctx.fill();
    ctx.fillStyle = '#3a3f52'; rr(-w * 0.46, -w * 0.33, w * 0.07, w * 0.3, w * 0.03); ctx.fill(); rr(w * 0.39, -w * 0.33, w * 0.07, w * 0.3, w * 0.03); ctx.fill();
    const bg = ctx.createLinearGradient(0, -w * 0.5, 0, 0); bg.addColorStop(0, light); bg.addColorStop(0.5, c); bg.addColorStop(1, dark);
    ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(-w * 0.4, -w * 0.06); ctx.lineTo(-w * 0.27, -w * 0.46); ctx.lineTo(w * 0.27, -w * 0.46); ctx.lineTo(w * 0.4, -w * 0.06); ctx.quadraticCurveTo(0, w * 0.04, -w * 0.4, -w * 0.06); ctx.fill();
    ctx.fillStyle = '#10121a'; rr(-w * 0.17, -w * 0.22, w * 0.34, w * 0.1, w * 0.03); ctx.fill();
    ctx.fillStyle = o.brake ? '#ff3b3b' : '#a01a1a'; ctx.fillRect(-w * 0.36, -w * 0.2, w * 0.13, w * 0.05); ctx.fillRect(w * 0.23, -w * 0.2, w * 0.13, w * 0.05);
    if (o.brake) glow(0, -w * 0.18, w * 0.5, '#ff3b3b');
    ctx.fillStyle = '#10121a'; ctx.fillRect(-w * 0.2, -w * 0.62, w * 0.04, w * 0.18); ctx.fillRect(w * 0.16, -w * 0.62, w * 0.04, w * 0.18);
    ctx.fillStyle = dark; rr(-w * 0.36, -w * 0.7, w * 0.72, w * 0.1, w * 0.03); ctx.fill(); ctx.fillStyle = light; ctx.fillRect(-w * 0.36, -w * 0.7, w * 0.72, w * 0.025);
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, -w * 0.52, w * 0.15, 0, 6.3); ctx.fill();
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, -w * 0.54, w * 0.15, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#10121a'; ctx.fillRect(-w * 0.1, -w * 0.5, w * 0.2, w * 0.04);
    if (o.boost > 0) {
      const f = 0.75 + Math.random() * 0.5;
      for (const sx of [-0.2, 0.2]) { const g = ctx.createRadialGradient(sx * w, -w * 0.1, 0, sx * w, -w * 0.1, w * 0.3 * f); g.addColorStop(0, '#fff7c2'); g.addColorStop(0.35, '#ffb02e'); g.addColorStop(1, '#ff4d0000'); ctx.fillStyle = g; ctx.fillRect(sx * w - w * 0.3, -w * 0.4, w * 0.6, w * 0.6); }
    }
    if (k.shield > 0) { const a = k.shield < 1.5 ? 0.35 + 0.35 * Math.sin(frame * 0.6) : 0.7; ctx.strokeStyle = '#7df9ff'; ctx.globalAlpha = a; ctx.lineWidth = Math.max(2, w * 0.035); ctx.beginPath(); ctx.arc(0, -w * 0.35, w * 0.72, 0, 6.3); ctx.stroke(); ctx.fillStyle = '#7df9ff'; ctx.globalAlpha = a * 0.18; ctx.fill(); ctx.globalAlpha = 1; }
    if (k.spin > 0) { ctx.fillStyle = '#ffe14d'; for (let i = 0; i < 3; i++) { const a = frame * 0.25 + i * 2.1; ctx.beginPath(); ctx.arc(Math.cos(a) * w * 0.3, -w * 0.9 + Math.sin(a) * w * 0.07, w * 0.04, 0, 6.3); ctx.fill(); } }
    ctx.restore();
  }

  function drawBox(x, y, w, time) {
    const bob = Math.sin(time * 4 + x) * w * 0.06, s = w * 0.9;
    ctx.save(); ctx.translate(x, y - w * 0.7 + bob);
    glow(0, 0, w * 1.1, '#7df9ff');
    ctx.rotate(Math.sin(time * 2 + x) * 0.18);
    const g = ctx.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2);
    g.addColorStop(0, `hsl(${(time * 120) % 360},95%,62%)`); g.addColorStop(1, `hsl(${(time * 120 + 140) % 360},95%,58%)`);
    ctx.fillStyle = g; rr(-s / 2, -s / 2, s, s, s * 0.2); ctx.fill();
    ctx.strokeStyle = '#ffffffcc'; ctx.lineWidth = Math.max(1.5, w * 0.05); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '800 ' + Math.max(8, s * 0.7) + 'px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', 0, s * 0.04);
    ctx.restore(); ctx.textBaseline = 'alphabetic';
  }
  function drawOil(x, y, w) { ctx.fillStyle = '#0b0d14'; ctx.beginPath(); ctx.ellipse(x, y - w * 0.06, w * 0.5, w * 0.17, 0, 0, 6.3); ctx.fill(); ctx.fillStyle = '#6a5acd66'; ctx.beginPath(); ctx.ellipse(x - w * 0.12, y - w * 0.1, w * 0.18, w * 0.05, 0, 0, 6.3); ctx.fill(); ctx.fillStyle = '#23d5ab55'; ctx.beginPath(); ctx.ellipse(x + w * 0.15, y - w * 0.05, w * 0.12, w * 0.035, 0, 0, 6.3); ctx.fill(); }
  function drawRocket(x, y, w) { glow(x, y - w * 0.4, w * 1.3, '#ff7a1a'); ctx.fillStyle = '#e8edf7'; rr(x - w * 0.16, y - w * 0.8, w * 0.32, w * 0.7, w * 0.12); ctx.fill(); ctx.fillStyle = '#ff3b3b'; ctx.beginPath(); ctx.arc(x, y - w * 0.78, w * 0.16, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#ffb02e'; ctx.beginPath(); ctx.arc(x, y - w * 0.1, w * 0.12 + Math.random() * w * 0.08, 0, 6.3); ctx.fill(); }

  // ----- the frame -----
  function draw(race, view) {
    frame++;
    const { track } = race, p = race.player, theme = track.theme, segs = track.segs, N = track.count, len = track.length;
    theme.id = track.id;
    const baseIdx = Math.floor(p.z / SEG_LEN) % N, base = segs[baseIdx], basePct = (p.z % SEG_LEN) / SEG_LEN;
    const pSeg = segs[Math.floor((p.z + PLAYER_Z) / SEG_LEN) % N], pPct = ((p.z + PLAYER_Z) % SEG_LEN) / SEG_LEN;
    const pY = lerp(pSeg.p1.world.y, pSeg.p2.world.y, pPct);
    const sp = p.speed / 10500;
    bgFar += base.curve * sp * 5; bgNear += base.curve * sp * 5;
    ctx.save();
    if (view.shake > 0) ctx.translate((Math.random() - 0.5) * view.shake, (Math.random() - 0.5) * view.shake);
    background(theme, view.time);
    let maxY = H, x = 0, dx = -(base.curve * basePct);
    for (let n = 0; n < DRAW; n++) {
      const seg = segs[(baseIdx + n) % N];
      seg.count = N; seg.looped = seg.index < baseIdx; seg.fog = Math.exp(-((n / DRAW) ** 2) * FOG); seg.frame = frame; seg.clip = maxY;
      const camZ = p.z - (seg.looped ? len : 0);
      project(seg.p1, p.x * ROAD_W - x, pY + CAM_H, camZ);
      project(seg.p2, p.x * ROAD_W - x - dx, pY + CAM_H, camZ);
      x += dx; dx += seg.curve;
      if (seg.p1.camera.z <= CAM_DEPTH || seg.p2.screen.y >= seg.p1.screen.y || seg.p2.screen.y >= maxY) { seg.skip = true; continue; }
      seg.skip = false;
      drawSegment(seg, theme, seg.p1.screen.x, seg.p1.screen.y, seg.p1.screen.w, seg.p2.screen.x, seg.p2.screen.y, seg.p2.screen.w, seg.fog);
      maxY = seg.p1.screen.y;
    }
    // things standing on the road, bucketed by segment
    const buckets = new Map();
    const put = (z, ent) => { const i = Math.floor(((z % len) + len) % len / SEG_LEN) % N; (buckets.get(i) || buckets.set(i, []).get(i)).push(ent); };
    for (const k of race.karts) if (!k.isPlayer) put(k.z, { kind: 'kart', x: k.x, z: k.z, k });
    for (const b of race.boxes) if (race.time >= b.taken) put(b.z, { kind: 'box', x: b.x, z: b.z });
    for (const h of race.hazards) put(h.z, { kind: 'oil', x: h.x, z: h.z });
    for (const r of race.projectiles) put(r.z, { kind: 'rocket', x: r.x, z: r.z });
    for (let n = DRAW - 1; n >= 0; n--) {
      const seg = segs[(baseIdx + n) % N];
      if (seg.frame !== frame) continue;
      const s1 = seg.p1.screen, s2 = seg.p2.screen, put2 = (ent, worldW, fn) => {
        const pct = ((ent.z ?? seg.p1.world.z) % SEG_LEN) / SEG_LEN;
        const scale = lerp(s1.scale, s2.scale, pct), sx = lerp(s1.x, s2.x, pct) + scale * ent.x * ROAD_W * W / 2, sy = lerp(s1.y, s2.y, pct);
        const w = worldW * scale * W / 2;
        if (w < 1.5 || sx < -w * 3 || sx > W + w * 3) return;
        const clip = seg.clip;
        if (sy > clip) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, clip); ctx.clip(); fn(sx, sy, w); ctx.restore(); } else fn(sx, sy, w);
      };
      const fogA = 1 - seg.fog;
      for (const o of seg.scenery) {
        const type = o.type;
        const ww = type === 'arch' || type === 'banner' ? ROAD_W * 2.1 : (WORLD_W[type] || 600) * o.s;
        ctx.globalAlpha = Math.max(0.15, 1 - fogA * 0.95);
        put2({ x: o.x, z: seg.p1.world.z }, ww, (sx, sy, w) => S[type](sx, sy, w, seg, view.time));
        ctx.globalAlpha = 1;
      }
      const list = buckets.get(seg.index);
      if (list) for (const e of list) {
        ctx.globalAlpha = Math.max(0.2, 1 - fogA);
        if (e.kind === 'kart') put2(e, 470, (sx, sy, w) => drawKart(sx, sy, w, e.k, { boost: e.k.boost }));
        else if (e.kind === 'box') put2(e, 400, (sx, sy, w) => drawBox(sx, sy, w, view.time));
        else if (e.kind === 'oil') put2(e, 540, (sx, sy, w) => drawOil(sx, sy, w));
        else put2(e, 280, (sx, sy, w) => drawRocket(sx, sy, w));
        ctx.globalAlpha = 1;
      }
    }
    // speed lines while boosting
    if (view.boost > 0) {
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1, W / 480);
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * 6.283 + frame * 0.01, r0 = Math.min(W, H) * (0.32 + ((i * 37) % 10) / 40), r1 = r0 + Math.min(W, H) * (0.18 + view.boost * 0.22);
        ctx.globalAlpha = (0.12 + ((frame + i * 3) % 9) / 40) * view.boost;
        ctx.beginPath(); ctx.moveTo(W / 2 + Math.cos(a) * r0 * 1.5, H / 2 + Math.sin(a) * r0); ctx.lineTo(W / 2 + Math.cos(a) * r1 * 1.5, H / 2 + Math.sin(a) * r1); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // the player's kart
    const portrait = H > W * 1.1, kw = portrait ? W * 0.36 : Math.min(W * 0.24, H * 0.52), bounce = (Math.random() - 0.5) * sp * H * 0.006 + (p.speed > 100 ? Math.sin(frame * 0.7) * sp * H * 0.002 : 0);
    const kx = W / 2 + p.steer * W * 0.012 + (p.drift.on ? -p.drift.dir * W * 0.018 : 0), ky = H * (portrait ? 0.8 : 0.955) + bounce;
    drawKart(kx, ky, kw, p, { tilt: p.steer * 0.05 + (p.drift.on ? p.drift.dir * 0.11 : 0), boost: p.boost, brake: view.brake });
    view.kart = { x: kx, y: ky, w: kw };
    ctx.restore();
  }
  return { resize, draw, get size() { return { W, H }; } };
}
