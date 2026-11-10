/* Tahdia 33.9.10 — the looks bought in the shop for the cue games: carrom strikers and billiards cues.
   One place draws them, so the shop's preview and the table show the same thing. */
(function (root) {
  'use strict';
  const CUES = Object.freeze({
    'cue-classic': { tip: ['#2c64c9', '#6aa4ff', '#2c64c9'], ferrule: ['#cfc8b6', '#fffdf6', '#cfc8b6'], shaft: ['#b98f55', '#f1d9a8', '#b98f55'], ring: ['#a8822e', '#f7df93', '#a8822e'], butt: ['#120a06', '#5a2f18', '#120a06'], end: ['#0b0705', '#2b170c', '#0b0705'] },
    'cue-ebony': { tip: ['#1f2a44', '#4a5d8a', '#1f2a44'], ferrule: ['#d9dde3', '#ffffff', '#d9dde3'], shaft: ['#2a211c', '#6b5a4c', '#2a211c'], ring: ['#9aa3ad', '#f2f5f8', '#9aa3ad'], butt: ['#050505', '#2a2a2e', '#050505'], end: ['#0a0a0c', '#3a3a40', '#0a0a0c'] },
    'cue-desert': { tip: ['#1a7f8a', '#4fd1d9', '#1a7f8a'], ferrule: ['#efe6d2', '#fffaf0', '#efe6d2'], shaft: ['#d6b47c', '#fbe8c2', '#d6b47c'], ring: ['#1a9aa6', '#7ff0f5', '#1a9aa6'], butt: ['#a8562a', '#e08a4c', '#a8562a'], end: ['#5a2a12', '#8a4a24', '#5a2a12'] },
    'cue-neon': { tip: ['#00b8ff', '#9ff0ff', '#00b8ff'], ferrule: ['#c9f6ff', '#ffffff', '#c9f6ff'], shaft: ['#141a2a', '#3a4a6a', '#141a2a'], ring: ['#00e0ff', '#c8ffff', '#00e0ff'], butt: ['#ff2fb0', '#ff8fd8', '#ff2fb0'], end: ['#18082a', '#4a1a6a', '#18082a'], glow: '#22d8ff' },
    'cue-dragon': { tip: ['#8a0f1c', '#ff5a6a', '#8a0f1c'], ferrule: ['#ffd98a', '#fff4d0', '#ffd98a'], shaft: ['#3a0a10', '#8a1a24', '#3a0a10'], ring: ['#c9901c', '#ffe08a', '#c9901c'], butt: ['#0a0a0a', '#3a1010', '#0a0a0a'], end: ['#c9901c', '#ffe08a', '#c9901c'], glow: '#ff4a2a' },
    'cue-royal': { tip: ['#4a1a8a', '#a07aff', '#4a1a8a'], ferrule: ['#ffffff', '#ffffff', '#e6e0f0'], shaft: ['#ece6d8', '#ffffff', '#ece6d8'], ring: ['#c9901c', '#ffe08a', '#c9901c'], butt: ['#3a1470', '#7a3ad0', '#3a1470'], end: ['#c9901c', '#ffe08a', '#c9901c'], glow: '#c79bff' },
  });
  const STRIKERS = Object.freeze({
    'striker-classic': { face: ['#ffffff', '#eef2f2', '#c4d0d0'], edge: '#8aa0a0', mark: '#1c8a86', markEdge: '#0d5552', dot: '#f6d38f', groove: '#5f8d8a99' },
    'striker-ruby': { face: ['#ffe6ea', '#ff5a72', '#b3122e'], edge: '#5a0614', mark: '#fff2f4', markEdge: '#7a0a1c', dot: '#ffd36b', groove: '#5a061499' },
    'striker-ocean': { face: ['#e6fbff', '#4fc8f0', '#0b6aa8'], edge: '#053a5c', mark: '#ffffff', markEdge: '#0b4a78', dot: '#ffe08a', groove: '#053a5c99' },
    'striker-gold': { face: ['#fff8d6', '#ffd23f', '#b07a00'], edge: '#6a4500', mark: '#7a4a00', markEdge: '#3a2200', dot: '#ffffff', groove: '#6a450099', shine: true },
    'striker-galaxy': { face: ['#c8b8ff', '#5a2bd0', '#14063f'], edge: '#0a0326', mark: '#ffffff', markEdge: '#2a0a6a', dot: '#7af0ff', groove: '#0a032699', stars: true },
    'striker-falcon': { face: ['#ffffff', '#e8edf2', '#9aa8b8'], edge: '#3a4654', mark: '#1b1f26', markEdge: '#000000', dot: '#e0283f', groove: '#3a465499', wings: true },
  });
  const equipped = (slot, fallback) => { try { return root.BS_CAREER?.get?.()?.equipped?.[slot] || fallback; } catch { return fallback; } };
  function circle(c, x, y, r, fill) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = fill; c.fill(); }
  /** A striker seen from above, centred at x, y, of radius r. */
  function drawStriker(c, x, y, r, id) {
    const L = STRIKERS[id] || STRIKERS['striker-classic'];
    c.save(); c.shadowColor = '#000a'; c.shadowBlur = r * 0.16; c.shadowOffsetX = r * 0.05; c.shadowOffsetY = r * 0.11; circle(c, x, y + r * 0.05, r, '#000'); c.restore();
    circle(c, x, y + r * 0.05, r, L.edge);
    const face = c.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.1, x, y, r * 1.05); face.addColorStop(0, L.face[0]); face.addColorStop(0.45, L.face[1]); face.addColorStop(1, L.face[2]);
    circle(c, x, y, r * 0.985, face);
    for (const k of [0.84, 0.6]) { c.beginPath(); c.arc(x, y, r * k, 0, Math.PI * 2); c.lineWidth = r * 0.04; c.strokeStyle = L.groove; c.stroke(); }
    if (L.stars) for (let i = 0; i < 9; i++) { const a = i * 2.39, d = r * (0.25 + (i % 4) * 0.17); circle(c, x + Math.cos(a) * d, y + Math.sin(a) * d, r * 0.035, '#ffffffcc'); }
    const pts = []; for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8 - Math.PI / 2, rad = i % 2 ? r * 0.2 : r * 0.46; pts.push([x + Math.cos(a) * rad, y + Math.sin(a) * rad]); }
    if (L.wings) { c.save(); c.translate(x, y); c.fillStyle = L.mark; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(0, -r * 0.05); c.quadraticCurveTo(s * r * 0.45, -r * 0.45, s * r * 0.72, -r * 0.1); c.quadraticCurveTo(s * r * 0.4, -r * 0.05, s * r * 0.1, r * 0.25); c.closePath(); c.fill(); } c.restore(); }
    else { c.beginPath(); pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.closePath(); c.fillStyle = L.mark; c.fill(); c.lineWidth = r * 0.03; c.strokeStyle = L.markEdge; c.stroke(); }
    circle(c, x, y, r * 0.1, L.dot);
    c.beginPath(); c.arc(x, y, r * 0.94, 0, Math.PI * 2); c.lineWidth = r * 0.06; c.strokeStyle = L.mark; c.globalAlpha = 0.85; c.stroke(); c.globalAlpha = 1;
    const hi = c.createRadialGradient(x - r * 0.38, y - r * 0.48, 0, x - r * 0.3, y - r * 0.4, r * 0.75); hi.addColorStop(0, '#ffffffcc'); hi.addColorStop(0.35, '#ffffff40'); hi.addColorStop(1, '#ffffff00');
    circle(c, x, y, r * 0.97, hi);
  }
  /** A cue laid flat from (x0, y) to (x1, y), tip on the left — for the shop's picture. */
  function drawCue(c, x0, x1, y, h, id) {
    const L = CUES[id] || CUES['cue-classic'], len = x1 - x0;
    const parts = [[0, 0.006, L.tip], [0.006, 0.022, L.ferrule], [0.022, 0.63, L.shaft], [0.63, 0.645, L.ring], [0.645, 0.877, L.butt], [0.877, 0.897, L.ring], [0.897, 1, L.end]];
    const w = (t) => h * (0.42 + t * 0.58);
    if (L.glow) { c.save(); c.shadowColor = L.glow; c.shadowBlur = h * 1.4; }
    for (const [a, b, cols] of parts) {
      const xa = x0 + a * len, xb = x0 + b * len, wa = w(a) / 2, wb = w(b) / 2;
      const g = c.createLinearGradient(0, y - wb, 0, y + wb); cols.forEach((col, i) => g.addColorStop(i / (cols.length - 1), col));
      c.beginPath(); c.moveTo(xa, y - wa); c.lineTo(xb, y - wb); c.lineTo(xb, y + wb); c.lineTo(xa, y + wa); c.closePath(); c.fillStyle = g; c.fill();
    }
    if (L.glow) c.restore();
  }
  root.BS_LOOKS = Object.freeze({
    CUES, STRIKERS, drawStriker, drawCue,
    cue: () => { const id = equipped('cue', 'cue-classic'); return { id, look: CUES[id] || CUES['cue-classic'] }; },
    striker: () => equipped('striker', 'striker-classic'),
    frame: () => equipped('frame', 'frame-none'),
  });
})(window);
