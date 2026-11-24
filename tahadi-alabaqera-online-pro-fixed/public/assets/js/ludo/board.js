import {SIX_CELL,SIX_TRACK,SIX_LANES,SIX_YARDS,sixAngle,sixRotate,sixSpot} from './six-layout.js?v=33.13.0';
/* Tahdia 33.10.5 — «لودو»: the classic cross board, drawn as one SVG.
   The four yards sit in the corners (red, green, blue, yellow, clockwise from the top left); each
   colour starts on the coloured square next to its yard, walks clockwise round 51 squares, turns at
   the arrow into its own column and ends in its triangle in the middle. The whole board turns so the
   player holding the phone always has his yard at the bottom left, nearest to him; the pawns stay
   upright. Pawns hop square by square when they move, and a taken pawn flies home. */
import { ludoGeometry, globalLudoPosition } from '../engines/ludo-engine.js?v=33.11.4';

// 33.13.0: the colours go red, blue, yellow, green round the board (then purple and orange for six)
export const LUDO_COLORS = Object.freeze(['#e8262f', '#1f63e6', '#f2b200', '#1f9d3d', '#8b3fe0', '#f27a1a']);
export const LUDO_NAMES = Object.freeze(['الأحمر', 'الأزرق', 'الأصفر', 'الأخضر', 'البنفسجي', 'البرتقالي']);
const DEEP = ['#8c0b14', '#0b2f8a', '#9c6200', '#0b5c20', '#4a178c', '#9c3f05'], LIGHT = ['#ff7a7f', '#74a8ff', '#ffdc5e', '#72e08c', '#c99dff', '#ffb36b'];
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
const YARD_SPOTS = [[80, 80], [80, 160], [160, 80], [160, 160]];
const FINISH = [[300, 252], [252, 300], [300, 348], [348, 300]].map(([y, x], c) => ({ x, y, c })); // the triangle of each corner
const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

const el = (tag, attrs = {}, kids = []) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) n.setAttribute(k, String(v)); for (const k of kids) n.append(k); return n; };
const cellXY = (r, c) => ({ x: c * C + C / 2, y: r * C + C / 2 });
/** How far the board turns (quarter turns, clockwise) so `corner` comes to the bottom left. */
export const turnsFor = (corner) => (((3 - corner) % 4) + 4) % 4;
const rotate = ({ x, y }, k) => { for (let i = 0; i < k; i++) [x, y] = [SIZE - y, x]; return { x, y }; };

/** Where a pawn stands, before the board is turned. */
export function ludoSpot(state, seat, token, progress = state.players[seat].tokens[token]) {
  if(state.players.length===6)return sixSpot(state,seat,token,progress);
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
  lin(ID + 'gold', [[0, '#fff3c0'], [.22, '#f4c752'], [.5, '#a8701a'], [.78, '#ffe18a'], [1, '#8a5810']], 1, 1);
  lin(ID + 'goldText', [[0, '#fff8d6'], [.5, '#ffd25a'], [1, '#c98a1e']]);
  lin(ID + 'bed', [[0, '#e6bd6c'], [.5, '#c48f3a'], [1, '#a8731f']], 1, 1);
  lin(ID + 'tile', [[0, '#ffffff'], [.6, '#f6f2f6'], [1, '#e3dbe4']]);
  rad(ID + 'purple', [[0, '#9a5be0'], [.55, '#5c1fa0'], [1, '#2b0a5a']], .5, .4, .7);
  rad(ID + 'gem', [[0, '#fff6cc'], [.4, '#f3c548'], [1, '#8a5a0c']], .35, .3, .8);
  LUDO_COLORS.forEach((color, i) => {
    lin(ID + 'c' + i, [[0, LIGHT[i]], [.5, color], [1, DEEP[i]]], 1, 1);
    lin(ID + 't' + i, [[0, LIGHT[i]], [.45, color], [1, DEEP[i]]]);
    rad(ID + 'y' + i, [[0, LIGHT[i]], [.4, color], [1, DEEP[i]]], .5, .42, .78);
    rad(ID + 'pawn' + i, [[0, '#ffffff'], [.18, LIGHT[i]], [.6, color], [1, DEEP[i]]], .35, .25, .9);
  });
  // a fine diamond lattice laid over the yards
  d.append(el('pattern', { id: ID + 'lattice', width: 14, height: 14, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, [el('path', { d: 'M0 0H14M0 0V14', stroke: '#ffffff', 'stroke-width': .8, opacity: .16 })]));
  const soft = el('filter', { id: ID + 'soft', x: '-20%', y: '-20%', width: '140%', height: '140%' }, [el('feDropShadow', { dx: 0, dy: 2, stdDeviation: 2.2, 'flood-color': '#000', 'flood-opacity': .28 })]);
  d.append(soft);
  root.append(d);
}

// 33.13.0: the royal board — a gold frame, rich coloured yards with a gold-edged court, a crown
// and laurels; white rounded tiles on a gold bed, the colour's column and a purple medallion in
// the middle. Everything is placed where it shows once the board has turned, so crowns and
// writing stay upright and the light stays on top.
const GOLD_LINE = '#7a4a0a';
/** A rounded rectangle centred on (0,0) with its own radius for each corner (tl, tr, br, bl). */
function roundRect(w, h, [tl, tr, br, bl]) {
  const x = -w / 2, y = -h / 2;
  return `M${x + tl} ${y}H${x + w - tr}Q${x + w} ${y} ${x + w} ${y + tr}V${y + h - br}Q${x + w} ${y + h} ${x + w - br} ${y + h}H${x + bl}Q${x} ${y + h} ${x} ${y + h - bl}V${y + tl}Q${x} ${y} ${x + tl} ${y}Z`;
}
/** One tile: a soft shadow and a glossy face; `turn` turns it (six-player arms). */
function tile(g, x, y, size, fill, { turn = 0, corners = null, attrs = {} } = {}) {
  const r = size * .2, d = roundRect(size, size, corners || [r, r, r, r]), at = `translate(${x.toFixed(1)} ${y.toFixed(1)})` + (turn ? ` rotate(${turn})` : '');
  g.append(el('path', { d, transform: at + ` translate(0 ${(size * .06).toFixed(1)})`, fill: '#5e3a0c', opacity: .42 }));
  g.append(el('path', { d, transform: at, fill, ...attrs }));
}
function star(g, x, y, r, fill, stroke = 'none') {
  const pts = Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r; return (x + Math.cos(a) * rr).toFixed(1) + ',' + (y + Math.sin(a) * rr).toFixed(1); }).join(' ');
  g.append(el('polygon', { points: pts, fill, stroke, 'stroke-width': 1.4, 'stroke-linejoin': 'round' }));
}
/** An arrow on a square, pointing along `dir` (0 right, 1 down, 2 left, 3 up) on the unturned board. */
function arrow(g, P, k, r, c, dir, color, double = false) {
  const { x, y } = P(cellXY(r, c)), a = ((dir + k) % 4) * 90, chev = (dx) => `M${-6 + dx} -8 L${2 + dx} 0 L${-6 + dx} 8`;
  g.append(el('path', { d: double ? chev(-4) + ' ' + chev(5) : 'M-9 0 H7 M1 -7 L8 0 L1 7', transform: `translate(${x} ${y}) rotate(${a})`, fill: 'none', stroke: color, 'stroke-width': 4.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
}
/** A gold crown standing on (x, y). */
function crown(g, x, y, s = 1) {
  const c = el('g', { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s})`, 'pointer-events': 'none' });
  c.append(el('path', { d: 'M-12 0L-13.5 -13L-6.5 -6L0 -16.5L6.5 -6L13.5 -13L12 0Z', fill: 'url(#' + ID + 'gold)', stroke: GOLD_LINE, 'stroke-width': 1, 'stroke-linejoin': 'round' }));
  c.append(el('rect', { x: -12.5, y: -1.5, width: 25, height: 5.5, rx: 2, fill: 'url(#' + ID + 'gold)', stroke: GOLD_LINE, 'stroke-width': 1 }));
  for (const [cx, cy] of [[-13.5, -13], [0, -16.5], [13.5, -13]]) c.append(el('circle', { cx, cy, r: 2.3, fill: '#fff4c8', stroke: GOLD_LINE, 'stroke-width': .8 }));
  c.append(el('circle', { cx: 0, cy: 1.2, r: 1.7, fill: '#e8262f' }));
  g.append(c);
}
/** A gold laurel branch, its foot at (x, y); `flip` mirrors it for the other side. */
function laurel(g, x, y, s = 1, flip = false) {
  const l = el('g', { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${flip ? -s : s} ${s})`, fill: 'url(#' + ID + 'gold)', 'pointer-events': 'none' });
  l.append(el('path', { d: 'M4 18C-5 9 -5 -9 3 -18', fill: 'none', stroke: '#eabb52', 'stroke-width': 1.8, 'stroke-linecap': 'round' }));
  for (const [lx, ly, a] of [[-1, 12, -40], [-3, 4, -18], [-3, -4, 8], [-1, -11, 32]]) l.append(el('ellipse', { cx: lx - 4, cy: ly, rx: 4.6, ry: 2, transform: `rotate(${a} ${lx} ${ly})` }));
  for (const [lx, ly, a] of [[1, 8, 40], [0, 0, 18], [1, -8, -8]]) l.append(el('ellipse', { cx: lx + 3.6, cy: ly, rx: 3.8, ry: 1.7, transform: `rotate(${a} ${lx} ${ly})` }));
  g.append(l);
}
/** The purple medallion in the middle: a gold-edged diamond (four) or hexagon (six) with «لودو». */
function medallion(g, r, six) {
  const shape = (rr) => six ? Array.from({ length: 6 }, (_, i) => { const a = i * Math.PI / 3; return (300 + Math.cos(a) * rr).toFixed(1) + ',' + (300 + Math.sin(a) * rr).toFixed(1); }).join(' ') : `300,${300 - rr} ${300 + rr},300 300,${300 + rr} ${300 - rr},300`;
  const m = el('g', { 'data-medallion': '', 'pointer-events': 'none' });
  m.append(el('polygon', { points: shape(r + 5), fill: 'url(#' + ID + 'gold)', stroke: GOLD_LINE, 'stroke-width': 1.2, 'stroke-linejoin': 'round', filter: 'url(#' + ID + 'soft)' }));
  m.append(el('polygon', { points: shape(r), fill: 'url(#' + ID + 'purple)', stroke: GOLD_LINE, 'stroke-width': 1, 'stroke-linejoin': 'round' }));
  m.append(el('polygon', { points: shape(r - 5), fill: 'none', stroke: '#f6d27a', 'stroke-width': 1, opacity: .7, 'stroke-linejoin': 'round' }));
  const u = r / 64;
  crown(m, 300, 300 - 15 * u, .62 * u);
  m.append(el('text', { x: 300, y: 300 + 10 * u, 'text-anchor': 'middle', 'font-size': (24 * u).toFixed(1), 'font-weight': 900, fill: 'url(#' + ID + 'goldText)', stroke: '#3a0f00', 'stroke-width': (1.6 * u).toFixed(2), 'paint-order': 'stroke', 'font-family': 'inherit' }, [document.createTextNode('لودو')]));
  // a gold rule with a small diamond under the name
  m.append(el('path', { d: `M${300 - 17 * u} ${300 + 21 * u}H${300 - 5 * u}M${300 + 5 * u} ${300 + 21 * u}H${300 + 17 * u}`, stroke: '#f6d27a', 'stroke-width': 1.6 * u, 'stroke-linecap': 'round' }));
  m.append(el('path', { d: `M300 ${300 + 16.5 * u}L${300 + 4 * u} ${300 + 21 * u}L300 ${300 + 25.5 * u}L${300 - 4 * u} ${300 + 21 * u}Z`, fill: 'url(#' + ID + 'gold)', stroke: GOLD_LINE, 'stroke-width': .6 }));
  g.append(m);
}

const INNER_CORNER = { '5,6': 3, '5,8': 2, '6,5': 1, '8,5': 2, '6,9': 0, '8,9': 3, '9,6': 0, '9,8': 1 }; // the tile corner that faces the middle (tl, tr, br, bl)
function drawBoard(k, active) {
  const P = (pt) => rotate(pt, k), g = el('g', { 'data-ludo-board': '' });
  // the frame: gold, a fine dark line, the gold bed the tiles sit on
  g.append(el('rect', { x: -11, y: -11, width: 622, height: 622, rx: 34, fill: 'url(#' + ID + 'gold)', stroke: GOLD_LINE, 'stroke-width': 1.5 }));
  g.append(el('rect', { x: -2, y: -2, width: 604, height: 604, rx: 26, fill: 'url(#' + ID + 'bed)', stroke: '#6b3f08', 'stroke-width': 1.5 }));
  // the yards: deep colour with a lattice, a gold-edged court, a crown on top, laurels on the sides
  for (let corner = 0; corner < 4; corner++) {
    const [oy, ox] = YARD_ORIGIN[corner], mid = P({ x: ox + 120, y: oy + 120 }), on = active === corner;
    const yard = el('g', { 'data-yard': corner, class: on ? 'ludo-yard on' : 'ludo-yard' });
    if (on) yard.append(el('rect', { x: mid.x - 117, y: mid.y - 117, width: 234, height: 234, rx: 32, fill: 'none', stroke: '#fff2b0', 'stroke-width': 7, class: 'lw-yard-glow' }));
    yard.append(el('rect', { x: mid.x - 113, y: mid.y - 113, width: 226, height: 226, rx: 30, fill: 'url(#' + ID + 'y' + corner + ')', stroke: 'url(#' + ID + 'gold)', 'stroke-width': 4 }));
    yard.append(el('rect', { x: mid.x - 111, y: mid.y - 111, width: 222, height: 222, rx: 28, fill: 'url(#' + ID + 'lattice)' }));
    yard.append(el('rect', { x: mid.x - 84, y: mid.y - 80, width: 168, height: 170, rx: 34, fill: 'none', stroke: '#ffe8a3', 'stroke-width': 7, opacity: .25 }));
    yard.append(el('rect', { x: mid.x - 84, y: mid.y - 80, width: 168, height: 170, rx: 34, fill: DEEP[corner], 'fill-opacity': .3, stroke: 'url(#' + ID + 'gold)', 'stroke-width': 3 }));
    crown(yard, mid.x, mid.y - 84, .95);
    laurel(yard, mid.x - 98, mid.y + 6, 1, false); laurel(yard, mid.x + 98, mid.y + 6, 1, true);
    for (const [sy, sx] of YARD_SPOTS) {
      const s = P({ x: ox + sx, y: oy + sy });
      yard.append(el('ellipse', { cx: s.x, cy: s.y + 15.5, rx: 20, ry: 7.5, fill: DEEP[corner], 'fill-opacity': .45, stroke: '#ffd667', 'stroke-width': 2.2 }));
    }
    g.append(yard);
  }
  // the middle, under the tiles: one colour flowing from each column into the medallion
  const mid = el('g', { 'data-center': '' });
  const tri = [[238, 238, 238, 362], [238, 238, 362, 238], [362, 238, 362, 362], [238, 362, 362, 362]];
  tri.forEach(([x1, y1, x2, y2], corner) => { const a = P({ x: x1, y: y1 }), b = P({ x: x2, y: y2 }); mid.append(el('polygon', { points: `${a.x},${a.y} ${b.x},${b.y} 300,300`, fill: 'url(#' + ID + 'c' + corner + ')' })); });
  g.append(mid);
  // the tiles: white round the board; the colour's start (with a star), its gate and its column
  const track = el('g');
  const at = (r, c, fill, extra = {}) => { const { x, y } = P(cellXY(r, c)), big = INNER_CORNER[r + ',' + c]; let corners = null; if (big !== undefined) { corners = [7.2, 7.2, 7.2, 7.2]; corners[(big + k) % 4] = 17; } tile(track, x, y, C - 4, fill, { corners, ...extra }); };
  LUDO_PATH.forEach(([r, c], i) => { const start = [0, 13, 26, 39].indexOf(i), gate = [50, 11, 24, 37].indexOf(i); at(r, c, start >= 0 ? 'url(#' + ID + 't' + start + ')' : gate >= 0 ? 'url(#' + ID + 't' + gate + ')' : 'url(#' + ID + 'tile)'); });
  HOME_COLUMN.forEach((cells, corner) => cells.forEach(([r, c]) => at(r, c, 'url(#' + ID + 't' + corner + ')')));
  g.append(track);
  const marks = el('g', { 'pointer-events': 'none' });
  // starts: a white star (a safe square); the other safe squares: a gold star
  [0, 13, 26, 39].forEach((i) => { const { x, y } = P(cellXY(...LUDO_PATH[i])); star(marks, x, y, 12, '#ffffff', '#00000033'); });
  for (const i of SAFE) if (![0, 13, 26, 39].includes(i)) { const { x, y } = P(cellXY(...LUDO_PATH[i])); star(marks, x, y, 12, '#f1dc9f', '#c39443'); }
  // the gate into each column, and the column's last square pointing at the middle
  [[7, 0, 0], [0, 7, 1], [7, 14, 2], [14, 7, 3]].forEach(([r, c, dir]) => arrow(marks, P, k, r, c, dir, '#ffffff'));
  [[7, 5, 0], [5, 7, 1], [7, 9, 2], [9, 7, 3]].forEach(([r, c, dir]) => arrow(marks, P, k, r, c, dir, '#ffffff', true));
  g.append(marks);
  medallion(g, 62, false);
  return g;
}

// the six-player frame: a hexagon with its left and right points cut flat (the yards sit there)
const SIX_FRAME = (inner, cut) => { const v = inner / Math.cos(Math.PI / 6), side = (v - cut) * Math.tan(Math.PI / 3); return [[300 + cut, 300 - side], [300 + v / 2, 300 - inner], [300 - v / 2, 300 - inner], [300 - cut, 300 - side], [300 - cut, 300 + side], [300 - v / 2, 300 + inner], [300 + v / 2, 300 + inner], [300 + cut, 300 + side]].map(([x, y]) => x.toFixed(1) + ',' + y.toFixed(1)).join(' '); };
function drawSix(P,active,viewer){
 const g=el('g',{'data-ludo-board':'','data-seats':6,'data-layout':'classic-arms'});
 g.append(el('polygon',{points:SIX_FRAME(250,266),fill:'url(#'+ID+'gold)',stroke:'url(#'+ID+'gold)','stroke-width':6,'stroke-linejoin':'round'}));
 g.append(el('polygon',{points:SIX_FRAME(242,258),fill:'url(#'+ID+'bed)',stroke:'#6b3f08','stroke-width':1.5,'stroke-linejoin':'round'}));
 const rotation=p=>(p.angle||0)+210-viewer*60,size=SIX_CELL-3;
 const square=(p,fill,attrs={})=>{const q=P(p);tile(g,q.x,q.y,size,fill,{turn:rotation(p),attrs});return q;};
 SIX_YARDS.forEach((yard,seat)=>{const p=P(yard),on=seat===active,plate=el('g',{transform:`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${rotation(yard)})`,'data-yard':seat,class:on?'ludo-yard on':'ludo-yard'});
  if(on)plate.append(el('rect',{x:-43,y:-43,width:86,height:86,rx:18,fill:'none',stroke:'#fff2b0','stroke-width':4,class:'lw-yard-glow'}));
  plate.append(el('rect',{x:-40,y:-40,width:80,height:80,rx:16,fill:'url(#'+ID+'y'+seat+')',stroke:'url(#'+ID+'gold)','stroke-width':2.6}));
  plate.append(el('rect',{x:-39,y:-39,width:78,height:78,rx:15,fill:'url(#'+ID+'lattice)'}));
  plate.append(el('rect',{x:-31,y:-31,width:62,height:62,rx:14,fill:DEEP[seat],'fill-opacity':.3,stroke:'url(#'+ID+'gold)','stroke-width':1.8}));g.append(plate);
  for(const slot of yard.slots){const q=P(slot);g.append(el('ellipse',{cx:q.x,cy:q.y+10,rx:11.5,ry:4.4,fill:DEEP[seat],'fill-opacity':.45,stroke:'#ffd667','stroke-width':1.4}));}});
 SIX_LANES.forEach((lane,seat)=>{const a=sixAngle(seat),left=P({x:300+Math.cos(a-.5)*64,y:300+Math.sin(a-.5)*64}),right=P({x:300+Math.cos(a+.5)*64,y:300+Math.sin(a+.5)*64});g.append(el('polygon',{points:`300,300 ${left.x},${left.y} ${right.x},${right.y}`,fill:'url(#'+ID+'c'+seat+')',stroke:'url(#'+ID+'gold)','stroke-width':1.5,'stroke-linejoin':'round','data-finish':seat}));});
 SIX_TRACK.forEach((p,i)=>{const seat=i%13===0?i/13:-1,gate=(i+2)%13===0?((i+2)/13)%6:-1,q=square(p,seat>=0?'url(#'+ID+'t'+seat+')':gate>=0?'url(#'+ID+'t'+gate+')':'url(#'+ID+'tile)',{'data-track':i});if(seat>=0)star(g,q.x,q.y,8,'#ffffff','#00000033');else if(i%13===8)star(g,q.x,q.y,8,'#f1dc9f','#c39443');});
 SIX_LANES.forEach((lane,seat)=>lane.forEach((p,h)=>square(p,'url(#'+ID+'t'+seat+')',{'data-home':seat+':'+h})));
 medallion(g,34,true);return g;
}

/** A royal piece standing on (0,0): a gold foot, a bell body with a gold diamond, and a head of
 *  its own — crown, gem, star or ball — so the four stones of a colour are told apart at a glance. */
function pawn(seat, number, scale = 1) {
  const s = scale, g = el('g', { class: 'ludo-pawn', transform: `scale(${s})` }), fill = 'url(#' + ID + 'pawn' + seat + ')', line = DEEP[seat], gold = 'url(#' + ID + 'gold)';
  const head = ((Number(number) || 4) - 1) % 4;
  g.append(el('ellipse', { cx: 0, cy: 14, rx: 13.5, ry: 4.6, fill: '#000000', opacity: .35 }));
  g.append(el('ellipse', { cx: 0, cy: 12, rx: 12.5, ry: 4.4, fill: gold, stroke: GOLD_LINE, 'stroke-width': .8 }));
  g.append(el('path', { d: 'M-11 11C-11 4 -6.5 0 -5 -6L5 -6C6.5 0 11 4 11 11C11 13 -11 13 -11 11Z', fill, stroke: line, 'stroke-width': 1.1 }));
  g.append(el('path', { d: 'M0 -1L3.2 4L0 9L-3.2 4Z', fill: gold, stroke: GOLD_LINE, 'stroke-width': .6 }));
  g.append(el('ellipse', { cx: 0, cy: -6.5, rx: 6.6, ry: 2.5, fill: gold, stroke: GOLD_LINE, 'stroke-width': .6 }));
  if (head === 0) { // crown
    g.append(el('circle', { cx: 0, cy: -11.5, r: 5.6, fill, stroke: line, 'stroke-width': .9 }));
    g.append(el('path', { d: 'M-8 -12L-9.5 -22L-4.5 -16.5L0 -24.5L4.5 -16.5L9.5 -22L8 -12Z', fill: gold, stroke: GOLD_LINE, 'stroke-width': .8, 'stroke-linejoin': 'round' }));
    for (const [cx, cy] of [[-9.5, -22], [0, -24.5], [9.5, -22]]) g.append(el('circle', { cx, cy, r: 1.7, fill: '#fff4c8', stroke: GOLD_LINE, 'stroke-width': .5 }));
  } else if (head === 1) { // gem
    g.append(el('path', { d: 'M-8 -17L-4.5 -22.5L4.5 -22.5L8 -17L0 -7.5Z', fill, stroke: line, 'stroke-width': 1, 'stroke-linejoin': 'round' }));
    g.append(el('path', { d: 'M-8 -17H8M-4.5 -22.5L-2.5 -17L0 -7.5M4.5 -22.5L2.5 -17L0 -7.5M-2.5 -17L0 -22.5L2.5 -17', fill: 'none', stroke: '#ffffff', 'stroke-opacity': .55, 'stroke-width': .7 }));
  } else if (head === 2) { // star
    const pts = Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 4.4 : 9.6; return (Math.cos(a) * rr).toFixed(1) + ',' + (-15.5 + Math.sin(a) * rr).toFixed(1); }).join(' ');
    g.append(el('polygon', { points: pts, fill, stroke: '#f6cf62', 'stroke-width': 1.5, 'stroke-linejoin': 'round' }));
  } else { // ball
    g.append(el('circle', { cx: 0, cy: -14, r: 8, fill, stroke: line, 'stroke-width': 1 }));
  }
  g.append(el('ellipse', { cx: -3.4, cy: head === 2 ? -17.5 : -17, rx: 2.8, ry: 1.7, fill: '#ffffff', opacity: .8 }));
  g.append(el('path', { d: 'M-7.5 9C-7.5 4 -4.5 1 -3.5 -3', fill: 'none', stroke: '#ffffff', 'stroke-opacity': .45, 'stroke-width': 1.4, 'stroke-linecap': 'round' }));
  return g;
}

/** Sparks where something happened: a capture (in the taker's colour) or a stone home (gold). */
function burst(layer, x, y, colour, big = false) {
  const g = el('g', { class: 'lw-burst', transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})`, 'pointer-events': 'none' });
  g.append(el('circle', { r: big ? 30 : 22, fill: 'none', stroke: colour, 'stroke-width': 4, class: 'lw-burst-ring' }));
  for (let i = 0; i < (big ? 14 : 10); i++) {
    const a = (i / (big ? 14 : 10)) * 360, spark = el('g', { transform: `rotate(${a})` });
    spark.append(el('circle', { cx: 0, cy: 0, r: big ? 4 : 3.4, fill: i % 2 ? '#ffffff' : colour, class: 'lw-spark', style: `--d:${big ? 46 : 34}px` }));
    g.append(spark);
  }
  layer.append(g);
  setTimeout(() => g.remove(), 900);
}

/**
 * Draws the board into `host`.
 * options: { viewer (seat at the bottom left), active (seat whose turn it is), legal (tokens of the
 * active seat that can move), onPick(token), move: {seat, token, from, to, captured} to animate }
 * Returns a promise that settles when the move animation is over.
 */
export function renderLudoBoard(host, state, options = {}) {
  const g0 = ludoGeometry(state), viewer = Number.isInteger(options.viewer) && options.viewer >= 0 ? options.viewer : 0;
  const six=state.players.length===6,P=pt=>six?sixRotate(pt,viewer):rotate(pt,k);
  const k = six?0:turnsFor(g0.corners[viewer] ?? 0), active = Number.isInteger(options.active) ? g0.corners[options.active] : -1;
  host.ludoCleanup?.();
  ID = 'lb' + (++serial).toString(36) + '-';
  const svg = el('svg', { viewBox: six ? '29 45 542 510' : '-13 -13 626 626', class: 'ludo-svg' + (six ? ' is-six' : ''), role: 'img', 'aria-label': 'لوحة اللودو' });
  defs(svg);
  svg.append(six?drawSix(P,active,viewer):drawBoard(k, active));
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
  const placed = spots.map((s) => ({ ...s, at: P(s) })).sort((a, b) => a.at.y - b.at.y);
  for (const s of placed) {
    const node = el('g', { class: 'ludo-pawn-at', 'data-seat': s.seat, 'data-token': s.token, transform: `translate(${s.at.x.toFixed(1)} ${s.at.y.toFixed(1)})` });
    const canPick = s.seat === options.active && legal.has(s.token);
    if (canPick) { node.classList.add('can-pick'); node.append(el('circle', { r: six?15:s.where==='yard'?26:21, class: 'ludo-pick-ring', fill: 'none', stroke: '#ffffff', 'stroke-width': 3 })); }
    node.append(el('g', { class: 'ludo-bob' }, [pawn(g0.corners[s.seat] ?? s.seat, s.token + 1, s.where === 'yard' ? (six ? .85 : 1.3) : s.small || s.squeeze || six ? .72 : 1)]));
    if (canPick) {
      const hit = el('circle', { r: six?18:s.where==='yard'?32:26, fill: 'transparent', class: 'ludo-hit', tabindex: 0, role: 'button', 'aria-label': `حرّك الحجر ${s.token + 1}` });
      hit.addEventListener('click', (e) => {if(six&&Number.isFinite(e.clientX)&&Number.isFinite(e.clientY))return; e.stopPropagation(); options.onPick?.(s.token); });
      hit.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); options.onPick?.(s.token); } });
      node.append(hit);
    }
    layer.append(node); nodes.push({ node, ...s });
  }
  // a tap on a square with a movable pawn moves it too (a fingertip misses a small pawn)
  if (legal.size && options.onPick) svg.addEventListener('click', (e) => {
    const pt = svg.createSVGPoint?.(); if (!pt) return; pt.x = e.clientX; pt.y = e.clientY;
    const local = pt.matrixTransform(svg.getScreenCTM().inverse());
    let best = null, bestD = six?23:34;
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
      const pts = path.map((s) => P(s));
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
        const land = P(ludoSpot(state, m.seat, m.token, m.to));
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
  if(m&&!matchMedia?.('(prefers-reduced-motion: reduce)').matches){const p=P(ludoSpot(state,m.seat,m.token,m.to)),home=m.to>=g0.finish,colour=LUDO_COLORS[g0.corners[m.seat]??m.seat];motion=motion.then(()=>{if(!layer.isConnected)return;if(m.captured?.length)burst(layer,p.x,p.y,colour);if(home)burst(layer,300,300,'#ffcc3e',true);});}
  if(m){const p=P(ludoSpot(state,m.seat,m.token,m.to)),fx=el('g',{'pointer-events':'none',class:'ludo-landing-fx'});fx.append(el('circle',{cx:p.x,cy:p.y,r:six?14:23,fill:'none',stroke:LIGHT[g0.corners[m.seat]??m.seat],'stroke-width':3}));layer.append(fx);motion=motion.then(()=>{if(fx.isConnected){fx.classList.add('arrived');setTimeout(()=>fx.remove(),650);}});}
  host.ludoCleanup = () => { host.ludoCleanup = null; };
  return motion;
}

/** Where a corner of the board shows on screen once the board is turned: 'tl', 'tr', 'br' or 'bl'. */
export function screenCorner(state, seat, viewer) {
  if(state.players.length===6)return ['bm','bl','tl','tm','tr','br'][((seat-viewer)%6+6)%6];
  const g = ludoGeometry(state), k = turnsFor(g.corners[viewer] ?? 0);
  return ['tl', 'tr', 'br', 'bl'][(g.corners[seat] + k) % 4];
}
