/* Tahdia 33.10.5 — «لودو»: the classic cross board, drawn as one SVG.
   The four yards sit in the corners (red, green, blue, yellow, clockwise from the top left); each
   colour starts on the coloured square next to its yard, walks clockwise round 51 squares, turns at
   the arrow into its own column and ends in its triangle in the middle. The whole board turns so the
   player holding the phone always has his yard at the bottom left, nearest to him; the pawns stay
   upright. Pawns hop square by square when they move, and a taken pawn flies home. */
import { ludoGeometry, globalLudoPosition } from '../engines/ludo-engine.js?v=33.10.6-classic1';

export const LUDO_COLORS = Object.freeze(['#ef3340', '#22b04b', '#1f7cf0', '#f7c51e']);
export const LUDO_NAMES = Object.freeze(['الأحمر', 'الأخضر', 'الأزرق', 'الأصفر']);
const DEEP = ['#8f0f1c', '#0f6a2a', '#0b3f8f', '#a77a00'], LIGHT = ['#ff8a92', '#7ff0a0', '#86c3ff', '#ffe58a'];
const NS = 'http://www.w3.org/2000/svg', C = 40, SIZE = 600;
let ID = 'lb-', serial = 0; // gradient ids of the board being drawn (each board has its own)

// the 52 squares round the board, from red's start, clockwise (row, column)
export const LUDO_PATH = Object.freeze([
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], [0, 7], [0, 8],
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14], [7, 14], [8, 14],
  [8, 13], [8, 12], [8, 11], [8, 10], [8, 9], [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8], [14, 7], [14, 6],
  [13, 6], [12, 6], [11, 6], [10, 6], [9, 6], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0], [7, 0], [6, 0],
].map(Object.freeze));
const HOME_COLUMN = [
  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]], [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]], [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
];
const YARD_ORIGIN = [[0, 0], [0, 360], [360, 360], [360, 0]]; // [top, left] of each corner's yard, in px
const YARD_SPOTS = [[78, 78], [78, 162], [162, 78], [162, 162]];
const FINISH = [[300, 252], [252, 300], [300, 348], [348, 300]].map(([y, x], c) => ({ x, y, c })); // the triangle of each corner
const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

const el = (tag, attrs = {}, kids = []) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) n.setAttribute(k, String(v)); for (const k of kids) n.append(k); return n; };
const cellXY = (r, c) => ({ x: c * C + C / 2, y: r * C + C / 2 });
/** How far the board turns (quarter turns, clockwise) so `corner` comes to the bottom left. */
export const turnsFor = (corner) => (((3 - corner) % 4) + 4) % 4;
const rotate = ({ x, y }, k) => { for (let i = 0; i < k; i++) [x, y] = [SIZE - y, x]; return { x, y }; };

/** Where a pawn stands, before the board is turned. */
export function ludoSpot(state, seat, token, progress = state.players[seat].tokens[token]) {
  const g = ludoGeometry(state), corner = g.corners[seat];
  if (progress < 0) { const [oy, ox] = YARD_ORIGIN[corner], [sy, sx] = YARD_SPOTS[token]; return { x: ox + sx, y: oy + sy, where: 'yard' }; }
  if (progress >= g.finish) { const f = FINISH[corner], spread = (token - 1.5) * 13; return { x: f.x + (corner % 2 ? spread : 0), y: f.y + (corner % 2 ? 0 : spread), where: 'home', small: true }; }
  if (progress >= g.lane) { const [r, c] = HOME_COLUMN[corner][progress - g.lane]; return { ...cellXY(r, c), where: 'lane' }; }
  const [r, c] = LUDO_PATH[globalLudoPosition(seat, progress, state)]; return { ...cellXY(r, c), where: 'track', cell: globalLudoPosition(seat, progress, state) };
}

function defs(root) {
  const d = el('defs');
  const lin = (id, stops, x2 = 0, y2 = 1) => d.append(el('linearGradient', { id, x1: 0, y1: 0, x2, y2 }, stops.map(([o, c]) => el('stop', { offset: o, 'stop-color': c }))));
  const rad = (id, stops, cx = .35, cy = .3, r = .75) => d.append(el('radialGradient', { id, cx, cy, r }, stops.map(([o, c]) => el('stop', { offset: o, 'stop-color': c }))));
  lin(ID + 'gold', [[0, '#fff1b8'], [.25, '#e8b84a'], [.5, '#8a5a12'], [.75, '#f2cd6b'], [1, '#7a4c0c']], 1, 1);
  lin(ID + 'tile', [[0, '#ffffff'], [1, '#d7deea']]);
  rad(ID + 'bed', [[0, '#16305e'], [1, '#081631']], .5, .5, .8);
  rad(ID + 'gem', [[0, '#fff6cc'], [.4, '#f3c548'], [1, '#8a5a0c']], .35, .3, .8);
  LUDO_COLORS.forEach((color, i) => {
    lin(ID + 'c' + i, [[0, LIGHT[i]], [.45, color], [1, DEEP[i]]]);
    rad(ID + 'yard' + i, [[0, color + '55'], [1, DEEP[i] + 'ee']], .5, .45, .8);
    rad(ID + 'pawn' + i, [[0, '#ffffff'], [.18, LIGHT[i]], [.55, color], [1, DEEP[i]]], .35, .28, .85);
  });
  const glow = el('filter', { id: ID + 'glow', x: '-30%', y: '-30%', width: '160%', height: '160%' }, [el('feGaussianBlur', { stdDeviation: 6, result: 'b' }), el('feMerge', {}, [el('feMergeNode', { in: 'b' }), el('feMergeNode', { in: 'SourceGraphic' })])]);
  d.append(glow);
  root.append(d);
}

// Everything is drawn where it shows once the board has turned, so the light stays on top: the
// tiles keep their shine on the upper edge and the shields stand upright whichever way you sit.
function tile(g, P, r, c, fill) {
  const { x, y } = P(cellXY(r, c)), h = C / 2;
  g.append(el('rect', { x: x - h + 2.5, y: y - h + 4, width: C - 5, height: C - 5, rx: 7, fill: '#00000055' }));
  g.append(el('rect', { x: x - h + 2.5, y: y - h + 2, width: C - 5, height: C - 5, rx: 7, fill }));
  g.append(el('rect', { x: x - h + 6, y: y - h + 4.5, width: C - 12, height: 6, rx: 3, fill: '#ffffff', opacity: .35 }));
}
function shield(g, P, r, c) {
  const { x, y } = P(cellXY(r, c));
  g.append(el('path', { d: `M${x} ${y - 11} L${x + 10} ${y - 7} V${y + 1} C${x + 10} ${y + 7} ${x + 5} ${y + 10} ${x} ${y + 12} C${x - 5} ${y + 10} ${x - 10} ${y + 7} ${x - 10} ${y + 1} V${y - 7} Z`, fill: '#1b2233', stroke: '#e6b445', 'stroke-width': 2.2, 'stroke-linejoin': 'round' }));
  g.append(el('path', { d: `M${x} ${y - 6} L${x + 5.5} ${y - 3.6} V${y + 1} C${x + 5.5} ${y + 4.5} ${x + 2.5} ${y + 6} ${x} ${y + 7} Z`, fill: '#e6b445', opacity: .9 }));
}
/** An arrow on a square, pointing along `dir` (0 right, 1 down, 2 left, 3 up) on the unturned board. */
function arrow(g, P, k, r, c, dir, color, double = false) {
  const { x, y } = P(cellXY(r, c)), a = ((dir + k) % 4) * 90, chev = (dx) => `M${-6 + dx} -8 L${2 + dx} 0 L${-6 + dx} 8`;
  g.append(el('path', { d: double ? chev(-4) + ' ' + chev(5) : 'M-9 0 H7 M1 -7 L8 0 L1 7', transform: `translate(${x} ${y}) rotate(${a})`, fill: 'none', stroke: color, 'stroke-width': 4.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
}

function drawBoard(k, active) {
  const P = (pt) => rotate(pt, k), g = el('g', { 'data-ludo-board': '' });
  // the frame: gold rim, dark bed, a gem in each corner
  g.append(el('rect', { x: -16, y: -16, width: 632, height: 632, rx: 30, fill: 'url(#' + ID + 'bed)', stroke: 'url(#' + ID + 'gold)', 'stroke-width': 10 }));
  g.append(el('rect', { x: -7, y: -7, width: 614, height: 614, rx: 22, fill: 'none', stroke: '#ffffff22', 'stroke-width': 1.5 }));
  for (const [x, y] of [[-16, -16], [616, -16], [616, 616], [-16, 616]]) g.append(el('rect', { x: x - 13, y: y - 13, width: 26, height: 26, rx: 6, transform: `rotate(45 ${x} ${y})`, fill: 'url(#' + ID + 'gem)', stroke: '#6b430a', 'stroke-width': 1.5 }));
  // the yards
  for (let corner = 0; corner < 4; corner++) {
    const [oy, ox] = YARD_ORIGIN[corner], mid = P({ x: ox + 120, y: oy + 120 }), on = active === corner;
    const yard = el('g', { 'data-yard': corner, class: on ? 'ludo-yard on' : 'ludo-yard' });
    yard.append(el('rect', { x: mid.x - 108, y: mid.y - 108, width: 216, height: 216, rx: 34, fill: 'url(#' + ID + 'yard' + corner + ')', stroke: 'url(#' + ID + 'c' + corner + ')', 'stroke-width': 16, filter: on ? 'url(#' + ID + 'glow)' : undefined }));
    yard.append(el('rect', { x: mid.x - 86, y: mid.y - 86, width: 172, height: 172, rx: 24, fill: DEEP[corner], opacity: .55, stroke: '#ffffff22', 'stroke-width': 1.5 }));
    for (const [sy, sx] of YARD_SPOTS) { const s = P({ x: ox + sx, y: oy + sy }); yard.append(el('circle', { cx: s.x, cy: s.y + 3, r: 23, fill: '#00000055' }), el('circle', { cx: s.x, cy: s.y, r: 22, fill: LUDO_COLORS[corner], opacity: .22, stroke: LIGHT[corner], 'stroke-opacity': .5, 'stroke-width': 2 })); }
    g.append(yard);
  }
  // the track, the coloured columns and the starts
  const track = el('g');
  LUDO_PATH.forEach(([r, c], i) => { const start = [0, 13, 26, 39].indexOf(i); tile(track, P, r, c, start >= 0 ? 'url(#' + ID + 'c' + start + ')' : 'url(#' + ID + 'tile)'); });
  HOME_COLUMN.forEach((cells, corner) => cells.forEach(([r, c]) => tile(track, P, r, c, 'url(#' + ID + 'c' + corner + ')')));
  g.append(track);
  const marks = el('g', { 'pointer-events': 'none' });
  // starts: a white arrow the way the colour walks
  [[6, 1, 0], [1, 8, 1], [8, 13, 2], [13, 6, 3]].forEach(([r, c, dir]) => arrow(marks, P, k, r, c, dir, '#ffffff'));
  // the mouth of each column: a coloured double arrow on the square where the colour turns home
  [[7, 0, 0, 0], [0, 7, 1, 1], [7, 14, 2, 2], [14, 7, 3, 3]].forEach(([r, c, dir, corner]) => arrow(marks, P, k, r, c, dir, LUDO_COLORS[corner], true));
  for (const i of SAFE) if (![0, 13, 26, 39].includes(i)) shield(marks, P, ...LUDO_PATH[i]);
  g.append(marks);
  // the middle: four triangles, one for each colour, and a gold gem where they meet
  const mid = el('g', { 'data-center': '' });
  const tri = [[240, 240, 240, 360], [240, 240, 360, 240], [360, 240, 360, 360], [240, 360, 360, 360]];
  tri.forEach(([x1, y1, x2, y2], corner) => { const a = P({ x: x1, y: y1 }), b = P({ x: x2, y: y2 }); mid.append(el('polygon', { points: `${a.x},${a.y} ${b.x},${b.y} 300,300`, fill: 'url(#' + ID + 'c' + corner + ')', stroke: '#0a1530', 'stroke-width': 2, 'stroke-linejoin': 'round' })); });
  mid.append(el('rect', { x: 289, y: 289, width: 22, height: 22, rx: 5, transform: 'rotate(45 300 300)', fill: 'url(#' + ID + 'gem)', stroke: '#6b430a', 'stroke-width': 1.5 }));
  g.append(mid);
  return g;
}

/** A glossy pawn standing on (0,0): base, body and head, in the colour of its corner. */
function pawn(seat, number, small) {
  const s = small ? .62 : 1, g = el('g', { class: 'ludo-pawn', transform: `scale(${s})` });
  g.append(el('ellipse', { cx: 0, cy: 12, rx: 15, ry: 5.5, fill: '#000000', opacity: .45 }));
  g.append(el('path', { d: 'M-13 10 C-13 4 -8 2 -6 1 C-8 -4 -7 -9 -5 -12 L5 -12 C7 -9 8 -4 6 1 C8 2 13 4 13 10 C13 13 -13 13 -13 10 Z', fill: 'url(#' + ID + 'pawn' + seat + ')', stroke: DEEP[seat], 'stroke-width': 1.4 }));
  g.append(el('ellipse', { cx: 0, cy: 9.5, rx: 12, ry: 3, fill: 'none', stroke: '#ffffff', 'stroke-opacity': .35, 'stroke-width': 1 }));
  g.append(el('circle', { cx: 0, cy: -17, r: 8.5, fill: 'url(#' + ID + 'pawn' + seat + ')', stroke: DEEP[seat], 'stroke-width': 1.4 }));
  g.append(el('ellipse', { cx: -3, cy: -20, rx: 3.2, ry: 2.2, fill: '#ffffff', opacity: .8 }));
  g.append(el('path', { d: 'M-4 -9 C-3 -4 -3 0 -6 4', fill: 'none', stroke: '#ffffff', 'stroke-opacity': .45, 'stroke-width': 2, 'stroke-linecap': 'round' }));
  if (number) g.append(el('text', { x: 0, y: 8.5, 'text-anchor': 'middle', 'font-size': 8, 'font-weight': 800, fill: '#ffffff', stroke: DEEP[seat], 'stroke-width': .8, 'paint-order': 'stroke', 'font-family': 'system-ui,sans-serif' }, [document.createTextNode(String(number))]));
  return g;
}

/**
 * Draws the board into `host`.
 * options: { viewer (seat at the bottom left), active (seat whose turn it is), legal (tokens of the
 * active seat that can move), onPick(token), move: {seat, token, from, to, captured} to animate }
 * Returns a promise that settles when the move animation is over.
 */
export function renderLudoBoard(host, state, options = {}) {
  const g0 = ludoGeometry(state), viewer = Number.isInteger(options.viewer) && options.viewer >= 0 ? options.viewer : 0;
  const k = turnsFor(g0.corners[viewer] ?? 0), active = Number.isInteger(options.active) ? g0.corners[options.active] : -1;
  host.ludoCleanup?.();
  ID = 'lb' + (++serial).toString(36) + '-';
  const svg = el('svg', { viewBox: '-24 -24 648 648', class: 'ludo-svg', role: 'img', 'aria-label': 'لوحة اللودو' });
  defs(svg);
  svg.append(drawBoard(k, active));
  const layer = el('g', { 'data-pawns': '' });
  svg.append(layer);
  host.replaceChildren(svg);
  host.dataset.turns = String(k);
  // the pawns, upright, at the board's turned positions; pawns that share a square stand side by side
  const spots = [];
  state.players.forEach((p, seat) => p.tokens.forEach((progress, token) => spots.push({ seat, token, ...ludoSpot(state, seat, token, progress) })));
  const groups = new Map();
  for (const s of spots) if (s.where === 'track' || s.where === 'lane') { const key = s.x + ':' + s.y; groups.set(key, [...(groups.get(key) || []), s]); }
  for (const list of groups.values()) if (list.length > 1) list.forEach((s, i) => { s.x += (i - (list.length - 1) / 2) * 11; s.squeeze = true; });
  const legal = new Set(options.legal || []), nodes = [];
  // draw the far pawns first so the near ones stand in front
  const placed = spots.map((s) => ({ ...s, at: rotate(s, k) })).sort((a, b) => a.at.y - b.at.y);
  for (const s of placed) {
    const node = el('g', { class: 'ludo-pawn-at', 'data-seat': s.seat, 'data-token': s.token, transform: `translate(${s.at.x.toFixed(1)} ${s.at.y.toFixed(1)})` });
    const canPick = s.seat === options.active && legal.has(s.token);
    if (canPick) { node.classList.add('can-pick'); node.append(el('circle', { r: 21, class: 'ludo-pick-ring', fill: 'none', stroke: '#ffffff', 'stroke-width': 3 })); }
    node.append(el('g', { class: 'ludo-bob' }, [pawn(g0.corners[s.seat] ?? s.seat, s.token + 1, s.small || s.squeeze)]));
    if (canPick) {
      const hit = el('circle', { r: 26, fill: 'transparent', class: 'ludo-hit', tabindex: 0, role: 'button', 'aria-label': `حرّك الحجر ${s.token + 1}` });
      hit.addEventListener('click', (e) => { e.stopPropagation(); options.onPick?.(s.token); });
      hit.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); options.onPick?.(s.token); } });
      node.append(hit);
    }
    layer.append(node); nodes.push({ node, ...s });
  }
  // a tap on a square with a movable pawn moves it too (a fingertip misses a small pawn)
  if (legal.size && options.onPick) svg.addEventListener('click', (e) => {
    const pt = svg.createSVGPoint?.(); if (!pt) return; pt.x = e.clientX; pt.y = e.clientY;
    const local = pt.matrixTransform(svg.getScreenCTM().inverse());
    let best = null, bestD = 34;
    for (const n of nodes) if (n.seat === options.active && legal.has(n.token)) { const d = Math.hypot(n.at.x - local.x, n.at.y - local.y); if (d < bestD) { bestD = d; best = n; } }
    if (best) options.onPick(best.token);
  });
  // the move: the pawn hops from where it was, square by square
  let motion = Promise.resolve();
  const m = options.move;
  if (m && !matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    const mover = nodes.find((n) => n.seat === m.seat && n.token === m.token);
    if (mover) {
      const path = [], from = m.from, to = m.to;
      if (from < 0) path.push(ludoSpot(state, m.seat, m.token, -1), ludoSpot(state, m.seat, m.token, 0));
      else for (let p = from; p <= to; p++) path.push(ludoSpot(state, m.seat, m.token, p));
      const pts = path.map((s) => rotate(s, k));
      pts[pts.length - 1] = mover.at;
      motion = new Promise((resolve) => {
        let i = 0;
        const hop = () => {
          if (i >= pts.length - 1 || !mover.node.isConnected) { mover.node.setAttribute('transform', `translate(${mover.at.x} ${mover.at.y})`); resolve(); return; }
          const a = pts[i], b = pts[i + 1], t0 = performance.now(), dur = from < 0 ? 260 : 150;
          const frame = (now) => {
            const t = Math.min(1, (now - t0) / dur), x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t - Math.sin(t * Math.PI) * 14;
            mover.node.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
            if (t < 1) requestAnimationFrame(frame); else { i++; options.onStep?.(i); hop(); }
          };
          requestAnimationFrame(frame);
        };
        mover.node.setAttribute('transform', `translate(${pts[0].x} ${pts[0].y})`);
        hop();
      });
      // a pawn that was taken: it stood where the mover landed, and now flies home
      for (const c of m.captured || []) {
        const back = nodes.find((n) => n.seat === c.player && n.token === c.token);
        if (!back) continue;
        const land = rotate(ludoSpot(state, m.seat, m.token, m.to), k);
        back.node.setAttribute('transform', `translate(${land.x} ${land.y})`);
        motion = motion.then(() => new Promise((resolve) => {
          const t0 = performance.now(), dur = 520;
          const frame = (now) => {
            const t = Math.min(1, (now - t0) / dur), e = 1 - (1 - t) ** 3, x = land.x + (back.at.x - land.x) * e, y = land.y + (back.at.y - land.y) * e - Math.sin(t * Math.PI) * 60;
            back.node.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
            if (t < 1 && back.node.isConnected) requestAnimationFrame(frame); else resolve();
          };
          requestAnimationFrame(frame);
        }));
      }
    }
  }
  host.ludoCleanup = () => { host.ludoCleanup = null; };
  return motion;
}

/** Where a corner of the board shows on screen once the board is turned: 'tl', 'tr', 'br' or 'bl'. */
export function screenCorner(state, seat, viewer) {
  const g = ludoGeometry(state), k = turnsFor(g.corners[viewer] ?? 0);
  return ['tl', 'tr', 'br', 'bl'][(g.corners[seat] + k) % 4];
}
