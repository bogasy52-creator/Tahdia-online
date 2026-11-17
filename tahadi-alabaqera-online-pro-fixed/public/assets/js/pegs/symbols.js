const TAU = Math.PI * 2;
/** A symbol drawn on a 2D context, centred at (x, y), radius r. */
export function drawSymbol(g, kind, x, y, r) {
  g.beginPath();
  if (kind === 'triangle') { for (let k = 0; k < 3; k++) { const a = -Math.PI / 2 + k * TAU / 3; g[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r * 1.02 + r * 0.12); } }
  else if (kind === 'star') { for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; g[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr); } }
  else if (kind === 'plus') { const w = r * 0.36; g.moveTo(x - w, y - r); g.lineTo(x + w, y - r); g.lineTo(x + w, y - w); g.lineTo(x + r, y - w); g.lineTo(x + r, y + w); g.lineTo(x + w, y + w); g.lineTo(x + w, y + r); g.lineTo(x - w, y + r); g.lineTo(x - w, y + w); g.lineTo(x - r, y + w); g.lineTo(x - r, y - w); g.lineTo(x - w, y - w); }
  else if (kind === 'diamond') { g.moveTo(x, y - r); g.lineTo(x + r * 0.8, y); g.lineTo(x, y + r); g.lineTo(x - r * 0.8, y); }
  else if(kind==='hexagon'){for(let k=0;k<6;k++){const a=k*TAU/6;g[k?'lineTo':'moveTo'](x+Math.cos(a)*r,y+Math.sin(a)*r);}}
  else if(kind==='moon'){g.arc(x,y,r,Math.PI*.25,Math.PI*1.75);g.quadraticCurveTo(x+r*.05,y,x+r*.71,y+r*.71);}
  else if (kind === 'circle') g.arc(x, y, r * 0.82, 0, TAU);
  else { const s = r * 0.78; g.rect(x - s, y - s, s * 2, s * 2); }
  g.closePath();
}

