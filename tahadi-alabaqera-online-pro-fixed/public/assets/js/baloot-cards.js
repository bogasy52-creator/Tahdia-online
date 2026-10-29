/* Tahdia 32.1.0 — playing cards for Baloot (and any table game).
   Every face and back is an SVG drawn here, so cards stay sharp at any size
   and look the same on every phone. The faces follow a real deck: serif
   indices (glyph outlines from DejaVu Serif Condensed Bold), classic suit
   shapes (Latin Modern), standard pip layouts, and the traditional English
   pattern courts (card-courts.js) in a framed window, recoloured per deck.
   window.BS_CARDS.face(card, deck) / back(deck) return SVG markup;
   url(card, deck) returns a cached data URL. Cards are 'AS', 'TH', '7C'…  */
(function () {
  const W = 250, H = 350;
  // court: the palette of the court artwork (yellow, blue, red, black, white) and its frame
  const DECKS = {
    'deck-classic': { name: 'كلاسيك بوسراج', face: ['#fffefa', '#f5efe2'], edge: '#d8ccb3', red: '#c4253a', black: '#1c2230', gold: ['#f6dd8e', '#c99a3c', '#8c6420'], court: { Y: '#ebb847', B: '#24427f', R: '#c8283c', K: '#1a1d26', W: '#fffdf8', frame: '#1c2230' }, back: 'sadu' },
    'deck-night': { name: 'ليل المجلس', face: ['#fffef8', '#e8edf4'], edge: '#a7bad3', red: '#b91d38', black: '#15283f', gold: ['#ffe7a3', '#e0b354', '#9a6d1e'], court: { Y: '#d5a735', B: '#2a3c78', R: '#bc2441', K: '#141a2c', W: '#fffdf6', frame: '#253b59' }, back: 'arabesque', backDark: true },
    'deck-emerald': { name: 'الزمرد', face: ['#fffdf6', '#f1ece0'], edge: '#cfc6ad', red: '#b5243a', black: '#0f3b33', gold: ['#f3dd9a', '#bf9440', '#7e5a1c'], court: { Y: '#e4c46a', B: '#0f5a4a', R: '#b5243a', K: '#0c2c26', W: '#fffdf6', frame: '#0f3b33' }, back: 'emerald' },
    'deck-four': { name: 'أربعة ألوان', face: ['#ffffff', '#f3f4f7'], edge: '#cfd5e1', red: '#d4283e', black: '#161a24', blue: '#1f6fd6', green: '#178a4e', gold: ['#ffe5a0', '#cfa14a', '#8f6a23'], court: { Y: '#efbe4c', B: '#1f4fa8', R: '#d4283e', K: '#161a24', W: '#ffffff', frame: '#161a24' }, back: 'slate', four: true },
    'deck-royal': { name: 'الذهب الأسود', face: ['#16130f', '#0b0a08'], edge: '#6b5426', red: '#f0c25c', black: '#f7e3a8', gold: ['#fff1b8', '#e3b450', '#8a6416'], court: { Y: '#e3b450', B: '#5c4520', R: '#a3192d', K: '#16120b', W: '#f6ead0', frame: '#e3b450' }, back: 'royal', dark: true, foil: true },
  };
  let uid = 0;

  // Suit shapes in a 100 × 100 box, centred on (50, 50).
  const SUIT = {"S": "M88.9 61.1c0-13.4-8.1-22.7-18.9-32.6-6-5.5-11.4-10.5-17.4-25.9-.6-1.5-1-2.6-2.6-2.6-1.6 0-2.1 1.3-2.3 2-3.4 8.7-7.3 16.9-15.8 24.6-10.8 9.9-20.8 19.7-20.8 34.5 0 8.2 1.6 26.3 15.7 26.3 .9 0 14.4 0 15-10.7h5.9c-.2 6.1-.6 11.4-3 19.7-.3.8-.3 1.3-.3 1.3 0 2.3 2.2 2.3 3.8 2.3h3.6c1.6 0 3.8 0 3.8-2.3 0 0 0-.5-.5-2-2.5-8.8-2.8-15.1-2.8-19h5.9c.4 9.9 12.5 10.7 15 10.7 13.9 0 15.7-17.6 15.7-26.3z", "H": "M94.5 30.3c0-16.9-6.7-30.3-22.2-30.3-7.9 0-17 4.3-22.3 14.8-5.5-10.8-14.7-14.8-22.3-14.8-15.9 0-22.2 14-22.2 30.3 0 17.4 11.7 31.6 24.3 43.5 9.7 8.8 12.5 11.5 17.8 24.6 .3.7 1.1 1.6 2.4 1.6 1.9 0 2.4-1.5 2.7-2.3 3-7.7 5.6-12.8 13.2-19.9 13.7-13 28.6-27.3 28.6-47.5z", "D": "M87.4 50c0-.9-.4-1.5-1-2-5.7-5.3-21.2-19.9-34.3-46.4-.2-.6-.8-1.6-2.1-1.6-1.3 0-1.7.7-2.6 2.5-10.3 20.9-23.4 35.8-31.7 43.6-.4.4-1.7 1.5-2.2 2-.6.6-.9 1.2-.9 1.9 0 .7.3 1.3.9 1.9 6.2 5.7 21.4 20.2 34.4 46.5 .2.6.8 1.6 2.1 1.6 1.3 0 1.7-.7 2.6-2.5 10.3-20.9 23.4-35.8 31.7-43.6 .4-.4 1.7-1.5 2.2-2 .5-.6.9-1.1.9-1.9z", "C": "M92.1 64.5c0-11.2-6-22.6-17-22.6-5.6 0-9.1 2.9-10.7 4.9l-2.6-5.3c5.4-4.3 8.9-11.2 8.9-18.7 0-12.3-9-22.8-20.7-22.8-11.8 0-20.7 10.6-20.7 22.8 0 7.2 3.3 14.3 8.9 18.6l-2.4 5.4c-1.7-1.9-5.3-4.9-10.9-4.9-11 0-17 11.4-17 22.6 0 12.4 8.3 22.9 19.9 22.9 4.9 0 13.8-2.2 14-10.7h5.9c-.2 6.1-.6 11.4-3 19.7-.3.8-.3 1.3-.3 1.3 0 2.3 2.2 2.3 3.8 2.3h3.6c1.6 0 3.8 0 3.8-2.3 0 0 0-.5-.5-2-2.5-8.8-2.8-15.1-2.8-19h5.9c.2 8.5 9.1 10.7 14 10.7 11.6 0 19.9-10.5 19.9-22.9z"};
  // Index glyphs: cap height 100, top of the capitals at y = 0.
  const RANK = {"A": {"d": "M0 100v-8.1h7.3l33.9-91.9h14.4l34 91.9h8.5v8.1h-42.1v-8.1h8.8l-7.5-20.4h-33.7l-7.6 20.4h10.7v8.1zm26.5-36.6h27.9l-13.9-38.3z", "w": 98.1}, "K": {"d": "M0 100v-8.1h11.5v-83.8h-11.5v-8.1h46.3v8.1h-11.5v36.5l38.1-36.5h-9.7v-8.1h33.7v8.1h-12l-32.4 30.9 44 52.9h8.9v8.1h-30.6l-40-48.6v40.5h11.5v8.1z", "w": 105.4}, "Q": {"d": "M48.2 101.9q-22.8-.4-35.5-14-12.7-13.7-12.7-37.8 0-24.2 13-38.1 12.9-13.8 35.6-13.8 22.7 0 35.6 13.8 12.9 13.8 12.9 38.1 0 21.3-10 34.6-9.9 13.2-28.2 16.4 3.2 3.8 7.8 5.5 4.6 1.6 11.9 1.6h3v16.5h-1.7q-11.4 0-19.1-5.5-7.7-5.5-12.6-17.3zm.4-8.1q11.5 0 17.1-10.7 5.6-10.8 5.6-33 0-22.2-5.6-33-5.6-10.8-17.1-10.8-11.5 0-17.1 10.9-5.6 10.9-5.6 32.9 0 22 5.6 32.9 5.6 10.8 17.1 10.8z", "w": 97.1}, "J": {"d": "M0 124v-15.8h7.8q.4 6.3 2.7 9.3 2.4 2.9 6.9 2.9 5.8 0 8.2-5 2.3-5 2.3-18.7v-88.6h-13.1v-8.1h48v8.1h-11.6v89.2q0 16.2-7.3 23.7-7.4 7.5-23.5 7.5-5.1 0-10.1-1.1-5.1-1.1-10.3-3.4z", "w": 62.8}, "1": {"d": "M1.9 100v-8.1h16.9v-80.9l-18.8 12.3v-10l22.6-15.1h19v93.7h16.9v8.1z", "w": 58.5}, "0": {"d": "M37.2 94.1q7.3 0 10-7.3 2.6-7.3 2.6-36.7 0-29.2-2.6-36.6-2.7-7.5-10-7.5-7.2 0-9.9 7.3-2.7 7.3-2.7 36.8 0 29.4 2.7 36.7 2.7 7.3 9.9 7.3zm0 7.8q-18 0-27.6-13.3-9.6-13.4-9.6-38.5 0-25.1 9.6-38.5 9.6-13.4 27.6-13.4 18 0 27.6 13.4 9.5 13.4 9.5 38.5 0 25.1-9.5 38.5-9.6 13.3-27.6 13.3z", "w": 74.3}, "9": {"d": "M35.4 6q-6.2 0-8.8 5.9-2.7 5.8-2.7 20.3 0 14.5 2.7 20.3 2.6 5.9 8.8 5.9 6.2 0 8.8-5.9 2.7-5.8 2.7-20.3 0-14.5-2.7-20.3-2.6-5.9-8.8-5.9zm13.4 53.3q-3.9 3.5-8.8 5.3-4.8 1.8-10.5 1.8-13.8 0-21.6-9-7.9-8.9-7.9-24.6 0-16.7 8.8-25.6 8.8-9 25.2-9 18.4 0 27.9 12.4 9.5 12.4 9.5 36.3 0 27.2-10.5 41.1-10.6 13.9-31.3 13.9-5.4 0-11.6-1-6.3-1-13.4-3v-17.7h7.3q1.6 6.9 5.7 10.4 4.2 3.5 10.9 3.5 10.6 0 15.4-8.2 4.9-8.2 4.9-26.6z", "w": 71.4}, "7": {"d": "M65.9 17l-37.2 83h-12.2l36.1-81h-44.4v13.5h-8.2v-32.5h65.9z", "w": 65.9}, "8": {"d": "M51 46.8q10.8 1.9 16.3 8.7 5.6 6.9 5.6 17.9 0 13.8-9.3 21.2-9.4 7.3-27.1 7.3-17.7 0-27.1-7.3-9.4-7.4-9.4-21.2 0-11 5.6-17.9 5.7-6.8 16.3-8.7-9.4-2.5-14.2-8.1-4.7-5.7-4.7-14.4 0-12.7 8.6-19.4 8.6-6.7 24.9-6.7 16.3 0 24.9 6.7 8.5 6.7 8.5 19.4 0 8.7-4.7 14.4-4.7 5.6-14.2 8.1zm-4.4-22.2q0-10.6-2.3-14.6-2.2-4-7.8-4-5.6 0-7.9 4-2.2 4-2.2 14.6 0 10.5 2.2 14.4 2.3 3.9 7.9 3.9 5.6 0 7.9-3.9 2.2-3.9 2.2-14.4zm2.4 47.7q0-12.3-2.9-16.9-2.8-4.6-9.6-4.6-7 0-9.7 4.6-2.8 4.6-2.8 16.9 0 12.4 2.8 17.1 2.8 4.7 9.7 4.7 6.8 0 9.6-4.7 2.9-4.7 2.9-17.1z", "w": 72.9}};

  function colorOf(deck, suit) {
    if (deck.four) return { S: deck.black, H: deck.red, D: deck.blue, C: deck.green }[suit];
    return suit === 'H' || suit === 'D' ? deck.red : deck.black;
  }

  function suitShape(suit, x, y, size, fill, rotate = 0) {
    const s = size / 100;
    return `<path d="${SUIT[suit]}" fill="${fill}" transform="translate(${(x - size / 2).toFixed(2)} ${(y - size / 2).toFixed(2)})${rotate ? ` rotate(180 ${size / 2} ${size / 2})` : ''} scale(${s.toFixed(4)})"/>`;
  }

  // Corner index: the rank over its suit, readable in a fanned hand.
  function index(rank, suit, fill) {
    const cap = 44, k = cap / 100, cx = 29;
    const chars = rank === 'T' ? ['1', '0'] : [rank];
    // wide letters and the two-digit 10 are narrowed to fit the column beside the court frame
    const squeeze = rank === 'T' ? 0.66 : ['A', 'K', 'Q'].includes(rank) ? 0.84 : 1;
    const widths = chars.map((c) => RANK[c].w * k * squeeze), gap = rank === 'T' ? 1 : 0;
    const total = widths.reduce((a, b) => a + b, 0) + gap * (chars.length - 1);
    let x = cx - total / 2, out = '';
    chars.forEach((c, i) => {
      out += `<path d="${RANK[c].d}" fill="${fill}" transform="translate(${x.toFixed(2)} 14) scale(${(k * squeeze).toFixed(4)} ${k.toFixed(4)})"/>`;
      x += widths[i] + gap;
    });
    out += suitShape(suit, cx, 14 + cap + 28, 30, fill);
    return `<g>${out}</g><g transform="rotate(180 ${W / 2} ${H / 2})">${out}</g>`;
  }

  // Standard pip layouts on a 3 × 5 grid (rows 0–4; the lower half is upside down).
  const PIPS = {
    7: [[0, 0], [2, 0], [0, 2], [2, 2], [0, 4], [2, 4], [1, 1]],
    8: [[0, 0], [2, 0], [0, 2], [2, 2], [0, 4], [2, 4], [1, 1], [1, 3]],
    9: [[0, 0], [2, 0], [0, 4 / 3], [2, 4 / 3], [0, 8 / 3], [2, 8 / 3], [0, 4], [2, 4], [1, 2]],
    T: [[0, 0], [2, 0], [0, 4 / 3], [2, 4 / 3], [0, 8 / 3], [2, 8 / 3], [0, 4], [2, 4], [1, 2 / 3], [1, 10 / 3]],
  };
  function pips(rank, suit, fill) {
    let out = '';
    for (const [col, row] of PIPS[rank]) {
      const x = 80 + col * 45, y = 66 + row * 54.5;
      out += suitShape(suit, x, y, 46, fill, row > 2 ? 1 : 0);
    }
    return out;
  }

  function goldGradient(id, deck) {
    const [a, b, c] = deck.gold;
    return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".45" stop-color="${b}"/><stop offset=".7" stop-color="${a}"/><stop offset="1" stop-color="${c}"/></linearGradient>`;
  }

  // The court: the classic double-headed figure in a framed window.
  const FRAME = { x: 54, y: 44, w: 142, h: 262 };
  function court(rank, suit, deck, ids) {
    const pal = deck.court;
    const art = globalThis.BS_COURTS?.get?.(rank + suit) || '';
    const { x, y, w, h } = FRAME;
    const s = h / 482, aw = 302 * s;
    const window_ = `<clipPath id="${ids.clip}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5"/></clipPath>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="${pal.W}"/>`;
    const figure = art
      ? `<g clip-path="url(#${ids.clip})"><g transform="translate(${(W / 2 - aw / 2).toFixed(2)} ${y}) scale(${s.toFixed(5)})">${art.replace(/%([YBRKW])%/g, (_, c) => pal[c])}</g></g>`
      : suitShape(suit, W / 2, H / 2, 70, colorOf(deck, suit));
    const ink = colorOf(deck, suit);
    // a small suit pip in the window's corners, as on a real deck
    const corner = suitShape(suit, x + 14, y + 15, 17, ink) + suitShape(suit, x + w - 14, y + h - 15, 17, ink, 1);
    return window_ + figure + corner + `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="none" stroke="${pal.frame}" stroke-width="2.4"/>`;
  }

  function ace(suit, deck, ids) {
    const ink = colorOf(deck, suit);
    if (suit !== 'S') return suitShape(suit, W / 2, H / 2, 112, ink);
    // the Ace of Spades carries the deck's seal
    const gold = `url(#${ids.gold})`;
    return `<circle cx="125" cy="175" r="80" fill="none" stroke="${gold}" stroke-width="3"/>
      <circle cx="125" cy="175" r="72" fill="none" stroke="${ink}" stroke-width="1" opacity=".35"/>
      ${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<circle cx="${(125 + Math.cos(a * Math.PI / 180) * 80).toFixed(1)}" cy="${(175 + Math.sin(a * Math.PI / 180) * 80).toFixed(1)}" r="4" fill="${gold}"/>`).join('')}
      ${suitShape('S', 125, 172, 118, ink)}`;
  }

  function face(card, deckId = 'deck-classic') {
    const deck = DECKS[deckId] || DECKS['deck-classic'];
    const rank = card[0], suit = card[1];
    const ink = colorOf(deck, suit);
    const id = 'c' + (uid++).toString(36);
    const ids = { gold: id + 'g', paper: id + 'p', clip: id + 'k' };
    let body;
    if (rank === 'A') body = ace(suit, deck, ids);
    else if (rank === 'K' || rank === 'Q' || rank === 'J') body = court(rank, suit, deck, ids);
    else body = pips(rank, suit, ink);
    const sheen = deck.dark ? `<rect x="3" y="3" width="${W - 6}" height="${H - 6}" rx="15" fill="url(#${id}s)" opacity=".5"/>` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs>${goldGradient(ids.gold, deck)}<linearGradient id="${ids.paper}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${deck.face[0]}"/><stop offset="1" stop-color="${deck.face[1]}"/></linearGradient><linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
      <rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="17" fill="url(#${ids.paper})" stroke="${deck.foil ? `url(#${ids.gold})` : deck.edge}" stroke-width="${deck.foil ? 3 : 2}"/>
      ${body}${index(rank, suit, ink)}${sheen}</svg>`;
  }

  /* ---------- Backs ---------- */

  function saduBand(y, h, colors) {
    // Bedouin weaving: rows of triangles and diamonds.
    let out = `<rect x="0" y="${y}" width="${W}" height="${h}" fill="${colors[0]}"/>`;
    const step = 22;
    for (let x = -step; x < W + step; x += step) {
      out += `<path d="M${x} ${y + h}L${x + step / 2} ${y + 3}L${x + step} ${y + h}Z" fill="${colors[1]}"/>`;
      out += `<path d="M${x + step / 2} ${y + h / 2 - 4}L${x + step / 2 + 4} ${y + h / 2}L${x + step / 2} ${y + h / 2 + 4}L${x + step / 2 - 4} ${y + h / 2}Z" fill="${colors[2]}"/>`;
    }
    return out;
  }

  function back(deckId = 'deck-classic') {
    const deck = DECKS[deckId] || DECKS['deck-classic'];
    const id = 'b' + (uid++).toString(36);
    const gold = `url(#${id}g)`;
    let art = '';
    if (deck.back === 'sadu') {
      art = `<rect x="14" y="14" width="${W - 28}" height="${H - 28}" rx="10" fill="#7d1424"/>`;
      for (let i = 0; i < 6; i++) art += saduBand(22 + i * 54, 40, i % 2 ? ['#1f1416', '#f3e6cf', '#c9283c'] : ['#a3192d', '#1f1416', '#f3e6cf']);
      art += `<rect x="14" y="14" width="${W - 28}" height="${H - 28}" rx="10" fill="none" stroke="${gold}" stroke-width="5"/>`;
    } else {
      const base = { arabesque: ['#132040', '#1d2e57'], emerald: ['#0d3b30', '#145244'], slate: ['#2a3140', '#394254'], royal: ['#0d0b08', '#1d1810'] }[deck.back];
      art = `<rect x="14" y="14" width="${W - 28}" height="${H - 28}" rx="10" fill="${base[0]}"/>
        <pattern id="${id}p" width="36" height="36" patternUnits="userSpaceOnUse"><rect width="36" height="36" fill="${base[0]}"/>
          <path d="M18 2L34 18 18 34 2 18Z" fill="none" stroke="${base[1]}" stroke-width="2.4"/>
          <path d="M18 10L26 18 18 26 10 18Z" fill="${base[1]}"/><circle cx="0" cy="0" r="3" fill="${gold}" opacity=".7"/><circle cx="36" cy="36" r="3" fill="${gold}" opacity=".7"/></pattern>
        <rect x="14" y="14" width="${W - 28}" height="${H - 28}" rx="10" fill="url(#${id}p)"/>
        <rect x="14" y="14" width="${W - 28}" height="${H - 28}" rx="10" fill="none" stroke="${gold}" stroke-width="5"/>`;
    }
    // Centre medallion with the Busraj mark.
    art += `<circle cx="125" cy="175" r="46" fill="${deck.back === 'sadu' ? '#1f1416' : 'rgba(0,0,0,.35)'}" stroke="${gold}" stroke-width="4"/>
      <circle cx="125" cy="175" r="38" fill="none" stroke="${gold}" stroke-width="1.2" opacity=".6"/>
      <path d="M125 143L157 175 125 207 93 175Z" fill="none" stroke="${gold}" stroke-width="3"/>
      <path d="M112 162H128C135 162 138 166 138 170S135 175 129 175H112ZM112 175H131C138 175 141 180 141 185S137 190 130 190H112Z" fill="none" stroke="${gold}" stroke-width="3.6" stroke-linejoin="round"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs>${goldGradient(id + 'g', deck)}</defs>
      <rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="17" fill="${deck.dark || deck.backDark ? '#0b0d14' : '#fbf6ea'}" stroke="${deck.edge}" stroke-width="2"/>${art}</svg>`;
  }

  const cache = new Map();
  function url(card, deckId = 'deck-classic') {
    const key = deckId + ':' + card;
    if (!cache.has(key)) {
      const svg = card === 'back' || card === '??' ? back(deckId) : face(card, deckId);
      cache.set(key, 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
    }
    return cache.get(key);
  }

  const api = { face, back, url, DECKS, W, H, SUIT, suitPath: (suit) => SUIT[suit] };
  if (typeof window !== 'undefined') window.BS_CARDS = api;
  if (typeof globalThis !== 'undefined') globalThis.BS_CARDS = api;
})();
