import {COLORS} from './engines/journey-engine.js?v=27.0.0';
export function boardMetrics(state, width) { return {cell: width / state.size, size: state.size}; }
function shape(c, x, y, r, kind) {
  c.beginPath();
  if (kind === 0) c.roundRect(x - r * .78, y - r * .78, r * 1.56, r * 1.56, r * .4);
  else if (kind === 1) { for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 3; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; i ? c.lineTo(px, py) : c.moveTo(px, py); } c.closePath(); }
  else if (kind === 2) { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .5 : r; i ? c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : c.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); }
  else if (kind === 3) c.arc(x, y, r * .85, 0, Math.PI * 2);
  else if (kind === 4) { c.moveTo(x, y - r); c.lineTo(x + r * .85, y); c.lineTo(x, y + r); c.lineTo(x - r * .85, y); c.closePath(); }
  else { for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; i ? c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.closePath(); }
}
export function drawBoard(canvas, state, selected = [], {hover = -1, flash = []} = {}) {
  const c = canvas.getContext('2d'); if (!c || !state) return;
  const w = canvas.width, {cell, size} = boardMetrics(state, w), point = i => ({x: (i % size + .5) * cell, y: (Math.floor(i / size) + .5) * cell});
  c.clearRect(0, 0, w, w); c.fillStyle = '#0c1828'; c.fillRect(0, 0, w, w);
  for (let i = 0; i < size * size; i++) { const {x, y} = point(i); c.beginPath(); c.roundRect(x - cell * .46, y - cell * .46, cell * .92, cell * .92, cell * .17); c.fillStyle = (Math.floor(i / size) + i % size) % 2 ? '#14253a' : '#172b40'; c.fill(); }
  if (state.game === 'jewels') {
    for (let i = 0; i < state.board.length; i++) {
      const {x, y} = point(i), kind = state.board[i], color = COLORS[kind], chosen = selected.includes(i), r = cell * (chosen ? .37 : .31);
      c.save(); c.shadowColor = '#0008'; c.shadowBlur = cell * .12; c.shadowOffsetY = cell * .045;
      shape(c, x, y + cell * .06, r, kind); c.fillStyle = '#020c1b'; c.fill();
      const g = c.createLinearGradient(x - r, y - r, x + r, y + r); g.addColorStop(0, '#ffffff'); g.addColorStop(.22, color); g.addColorStop(1, color + 'a0');
      shape(c, x, y, r, kind); c.fillStyle = g; c.fill(); c.shadowBlur = 0; c.strokeStyle = chosen ? '#ffffff' : color; c.lineWidth = chosen ? cell * .045 : cell * .018; c.stroke();
      c.globalAlpha = .5; shape(c, x - r * .1, y - r * .12, r * .58, kind); c.strokeStyle = '#ffffff'; c.lineWidth = cell * .018; c.stroke(); c.restore();
    }
    if (selected.length > 1) { c.beginPath(); selected.forEach((p, i) => { const {x, y} = point(p); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.strokeStyle = '#fff5'; c.lineWidth = cell * .11; c.lineJoin = c.lineCap = 'round'; c.stroke(); }
  } else {
    for(const i of state.walls||[]){const {x,y}=point(i);c.fillStyle='#07101a';c.fillRect(x-cell*.45,y-cell*.45,cell*.9,cell*.9);c.strokeStyle='#627084';c.lineWidth=cell*.04;c.beginPath();c.moveTo(x-cell*.15,y-cell*.15);c.lineTo(x+cell*.15,y+cell*.15);c.moveTo(x+cell*.15,y-cell*.15);c.lineTo(x-cell*.15,y+cell*.15);c.stroke();}
    const paths = {...state.paths}; if (selected.length) paths.selected = selected;
    for (const [key, path] of Object.entries(paths)) {
      if (!path.length) continue; const color = key === 'selected' ? state.pairs.findIndex(pair => pair.includes(path[0])) : Number(key);
      c.beginPath(); path.forEach((p, i) => { const {x, y} = point(p); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.strokeStyle = COLORS[color] || COLORS[0]; c.lineWidth = cell * .24; c.lineCap = c.lineJoin = 'round'; c.stroke();
      c.strokeStyle = '#fff3'; c.lineWidth = cell * .055; c.stroke();
    }
    (state.gates||[]).forEach((cells,color)=>cells.forEach(p=>{const {x,y}=point(p);c.beginPath();c.arc(x,y,cell*.13,0,Math.PI*2);c.strokeStyle=COLORS[color];c.lineWidth=cell*.05;c.stroke();}));
    state.pairs.forEach((pair, color) => pair.forEach(p => { const {x, y} = point(p); c.beginPath(); c.arc(x, y, cell * .31, 0, Math.PI * 2); c.fillStyle = '#091422'; c.fill(); c.strokeStyle = COLORS[color]; c.lineWidth = cell * .055; c.stroke(); c.fillStyle = COLORS[color]; c.font = 'bold ' + Math.round(cell * .3) + 'px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(color + 1), x, y + cell * .01); }));
  }
  for (const i of flash) { const {x, y} = point(i); c.beginPath(); c.arc(x, y, cell * .39, 0, Math.PI * 2); c.strokeStyle = '#fff'; c.lineWidth = cell * .035; c.stroke(); }
  if (hover >= 0 && hover < size * size) { const {x, y} = point(hover); c.strokeStyle = '#fff'; c.lineWidth = cell * .025; c.strokeRect(x - cell * .43, y - cell * .43, cell * .86, cell * .86); }
}
