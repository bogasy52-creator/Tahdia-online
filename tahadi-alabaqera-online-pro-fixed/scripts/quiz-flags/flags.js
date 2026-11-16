// Flags for the «أعلام» quiz category (33.10.6). Each flag is drawn from its
// official proportions and colours as plain SVG, then waved on a pole by
// studio.html. Run: node scripts/quiz-flags/studio.cjs out && python3
// scripts/zoom-3d/pack.py out public/assets/quiz_flags_v33
(function () {
  const rect = (x, y, w, h, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
  const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 40}" height="${h * 40}">${body}</svg>`;
  const hStripes = (w, h, colours) => colours.map((c, i) => rect(0, i * h / colours.length, w, h / colours.length + 0.01, c)).join('');
  const vStripes = (w, h, colours) => colours.map((c, i) => rect(i * w / colours.length, 0, w / colours.length + 0.01, h, c)).join('');
  // a regular star: n points, outer radius r, inner radius ri, first point at angle a (radians, 0 = up)
  function star(cx, cy, r, c, n = 5, ri = r * 0.382, a = 0) {
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
      const rr = i % 2 ? ri : r, t = a + i * Math.PI / n;
      pts.push((cx + rr * Math.sin(t)).toFixed(4) + ',' + (cy - rr * Math.cos(t)).toFixed(4));
    }
    return `<polygon points="${pts.join(' ')}" fill="${c}"/>`;
  }
  // a crescent: outer disc minus an offset inner disc (offset along angle a, 0 = right)
  function crescent(id, cx, cy, r, ri, off, c, a = 0) {
    const ix = cx + off * Math.cos(a), iy = cy - off * Math.sin(a);
    return `<mask id="${id}"><rect x="-99" y="-99" width="999" height="999" fill="#fff"/><circle cx="${ix}" cy="${iy}" r="${ri}" fill="#000"/></mask><circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}" mask="url(#${id})"/>`;
  }
  function serrated(w, h, white, colour, points, valley, peak) {
    const pts = [`${w},0`, `${valley},0`];
    for (let i = 0; i < points; i++) { pts.push(`${peak},${(i + 0.5) * h / points}`); pts.push(`${valley},${(i + 1) * h / points}`); }
    pts.push(`${w},${h}`);
    return rect(0, 0, w, h, white) + `<polygon points="${pts.join(' ')}" fill="${colour}"/>`;
  }
  const RED = '#ce1126', GREEN = '#007a3d', BLACK = '#000000', WHITE = '#ffffff';
  const FLAGS = {
    japan: svg(3, 2, rect(0, 0, 3, 2, WHITE) + '<circle cx="1.5" cy="1" r="0.6" fill="#bc002d"/>'),
    kuwait: svg(2, 1, hStripes(2, 1, ['#007a3d', WHITE, RED]) + '<polygon points="0,0 0.5,0.3333 0.5,0.6667 0,1" fill="#000"/>'),
    uae: svg(2, 1, hStripes(2, 1, ['#00732f', WHITE, BLACK]) + rect(0, 0, 0.5, 1, '#ff0000')),
    france: svg(3, 2, vStripes(3, 2, ['#002395', WHITE, '#ed2939'])),
    germany: svg(5, 3, hStripes(5, 3, [BLACK, '#dd0000', '#ffce00'])),
    italy: svg(3, 2, vStripes(3, 2, ['#009246', WHITE, '#ce2b37'])),
    turkey: svg(1.5, 1, rect(0, 0, 1.5, 1, '#e30a17') + crescent('tr', 0.5, 0.5, 0.25, 0.2, 0.0625, WHITE) + star(0.98, 0.5, 0.125, WHITE, 5, 0.125 * 0.382, -Math.PI / 2)),
    china: svg(30, 20, rect(0, 0, 30, 20, '#ee1c25') + star(5, 5, 3, '#ffff00') + [[10, 2], [12, 4], [12, 7], [10, 9]].map(([x, y]) => star(x, y, 1, '#ffff00', 5, 0.382, Math.atan2(5 - x, -(5 - y)))).join('')),
    usa: (() => {
      const W = 1.9, H = 1, s = H / 13; let body = '';
      for (let i = 0; i < 13; i++) body += rect(0, i * s, W, s + 0.002, i % 2 ? WHITE : '#b22234');
      const cw = 0.76, ch = 7 * s; body += rect(0, 0, cw, ch, '#3c3b6e');
      for (let r = 0; r < 9; r++) { const n = r % 2 ? 5 : 6; for (let c = 0; c < n; c++) { const x = cw / 12 * (r % 2 ? 2 * c + 2 : 2 * c + 1), y = ch / 10 * (r + 1); body += star(x, y, 0.0308, WHITE); } }
      return svg(W, H, body);
    })(),
    qatar: svg(28, 11, serrated(28, 11, WHITE, '#8a1538', 9, 7, 9.4)),
    bahrain: svg(5, 3, serrated(5, 3, WHITE, RED, 5, 1, 1.5)),
    jordan: svg(2, 1, hStripes(2, 1, [BLACK, WHITE, '#007a3d']) + '<polygon points="0,0 1,0.5 0,1" fill="#ce1126"/>' + star(0.32, 0.5, 0.075, WHITE, 7, 0.075 * 0.5, 0)),
    palestine: svg(2, 1, hStripes(2, 1, [BLACK, WHITE, '#149954']) + '<polygon points="0,0 0.6667,0.5 0,1" fill="#e4312b"/>'),
    sudan: svg(2, 1, hStripes(2, 1, ['#d21034', WHITE, BLACK]) + '<polygon points="0,0 0.6667,0.5 0,1" fill="#007229"/>'),
    algeria: svg(3, 2, rect(0, 0, 1.5, 2, '#006233') + rect(1.5, 0, 1.5, 2, WHITE) + crescent('dz', 1.5, 1, 0.5, 0.4, 0.125, '#d21034') + star(1.72, 1, 0.25, '#d21034', 5, 0.25 * 0.382, -Math.PI / 2)),
    morocco: svg(3, 2, rect(0, 0, 3, 2, '#c1272d') + (() => { const r = 0.5, pts = []; for (let i = 0; i < 5; i++) { const t = i * 4 * Math.PI / 5; pts.push((1.5 + r * Math.sin(t)).toFixed(4) + ',' + (1.05 - r * Math.cos(t)).toFixed(4)); } return `<polygon points="${pts.join(' ')}" fill="none" stroke="#006233" stroke-width="0.075" stroke-linejoin="miter"/>`; })()),
    tunisia: svg(3, 2, rect(0, 0, 3, 2, '#e70013') + '<circle cx="1.5" cy="1" r="0.5" fill="#fff"/>' + crescent('tn', 1.5, 1, 0.375, 0.3, 0.09, '#e70013') + star(1.58, 1, 0.225, '#e70013', 5, 0.225 * 0.382, -Math.PI / 2)),
    uk: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 30" width="2400" height="1200"><clipPath id="s"><path d="M0,0 v30 h60 v-30 z"/></clipPath><clipPath id="t"><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z"/></clipPath><g clip-path="url(#s)"><path d="M0,0 v30 h60 v-30 z" fill="#012169"/><path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" stroke-width="6"/><path d="M0,0 L60,30 M60,0 L0,30" clip-path="url(#t)" stroke="#c8102e" stroke-width="4"/><path d="M30,0 v30 M0,15 h60" stroke="#fff" stroke-width="10"/><path d="M30,0 v30 M0,15 h60" stroke="#c8102e" stroke-width="6"/></g></svg>',
    india: svg(3, 2, hStripes(3, 2, ['#ff9933', WHITE, '#138808']) + (() => { let b = '<circle cx="1.5" cy="1" r="0.25" fill="none" stroke="#000080" stroke-width="0.03"/><circle cx="1.5" cy="1" r="0.045" fill="#000080"/>'; for (let i = 0; i < 24; i++) { const t = i * Math.PI / 12; b += `<line x1="1.5" y1="1" x2="${(1.5 + 0.235 * Math.cos(t)).toFixed(4)}" y2="${(1 + 0.235 * Math.sin(t)).toFixed(4)}" stroke="#000080" stroke-width="0.012"/>`; } return b; })()),
    libya: svg(2, 1, rect(0, 0, 2, 0.25, '#e70013') + rect(0, 0.25, 2, 0.5, BLACK) + rect(0, 0.75, 2, 0.25, '#239e46') + crescent('ly', 0.97, 0.5, 0.125, 0.1, 0.03, WHITE) + star(1.08, 0.5, 0.07, WHITE, 5, 0.07 * 0.382, -Math.PI / 2)),
    yemen: svg(3, 2, hStripes(3, 2, ['#ce1126', WHITE, BLACK])),
    pakistan: svg(3, 2, rect(0, 0, 0.75, 2, WHITE) + rect(0.75, 0, 2.25, 2, '#01411c') + crescent('pk', 1.875, 1, 0.6, 0.55, 0.18, WHITE, Math.PI / 4) + star(2.15, 0.72, 0.2, WHITE, 5, 0.2 * 0.382, Math.PI / 4)),
    sweden: svg(16, 10, rect(0, 0, 16, 10, '#006aa7') + rect(5, 0, 2, 10, '#fecc00') + rect(0, 4, 16, 2, '#fecc00')),
    switzerland: svg(32, 32, rect(0, 0, 32, 32, '#da291c') + rect(13, 6, 6, 20, WHITE) + rect(6, 13, 20, 6, WHITE)),
    greece: (() => { const W = 27, H = 18, s = 2; let b = ''; for (let i = 0; i < 9; i++) b += rect(0, i * s, W, s + 0.01, i % 2 ? WHITE : '#0d5eaf'); b += rect(0, 0, 10, 10, '#0d5eaf') + rect(4, 0, 2, 10, WHITE) + rect(0, 4, 10, 2, WHITE); return svg(W, H, b); })(),
    indonesia: svg(3, 2, hStripes(3, 2, ['#ce1126', WHITE])),
    mauritania: svg(3, 2, rect(0, 0, 3, 2, '#00a95c') + rect(0, 0, 3, 0.3, '#d01c1f') + rect(0, 1.7, 3, 0.3, '#d01c1f') + crescent('mr', 1.5, 0.95, 0.5, 0.5, 0.2, '#ffd700', Math.PI / 2) + star(1.5, 0.78, 0.17, '#ffd700'))
  };
  window.QUIZ_FLAGS = FLAGS;
}());
