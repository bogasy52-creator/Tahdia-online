/* Tahdia 32.0.0 — playing cards for Baloot (and any table game).
   Every face and back is an SVG drawn here, so cards stay sharp at any size
   and look the same on every phone. Indices are drawn as strokes (no font),
   courts carry an emblem instead of a portrait: a crown for the King, a
   jewelled tiara for the Queen and a falcon for the Jack.
   window.BS_CARDS.face(card, deck) / back(deck) return SVG markup;
   url(card, deck) returns a cached data URL. Cards are 'AS', 'TH', '7C'…  */
(function () {
  const W = 250, H = 350;
  const DECKS = {
    'deck-classic': { name: 'كلاسيك بوسراج', face: ['#fffdf7', '#f4ecdc'], edge: '#d8ccb3', red: '#c4253a', black: '#1c2230', gold: ['#f6dd8e', '#c99a3c', '#8c6420'], court: '#fbf3e0', back: 'sadu' },
    'deck-night': { name: 'ليل المجلس', face: ['#1d2740', '#121a2e'], edge: '#3c4b70', red: '#ff6b7d', black: '#e9eefb', gold: ['#ffe7a3', '#e0b354', '#9a6d1e'], court: '#1a2440', back: 'arabesque', dark: true },
    'deck-emerald': { name: 'الزمرد', face: ['#fffdf6', '#f1ece0'], edge: '#cfc6ad', red: '#b5243a', black: '#0f3b33', gold: ['#f3dd9a', '#bf9440', '#7e5a1c'], court: '#eef6f0', back: 'emerald' },
    'deck-four': { name: 'أربعة ألوان', face: ['#ffffff', '#f3f4f7'], edge: '#cfd5e1', red: '#d4283e', black: '#161a24', blue: '#1f6fd6', green: '#178a4e', gold: ['#ffe5a0', '#cfa14a', '#8f6a23'], court: '#f6f8fc', back: 'slate', four: true },
    'deck-royal': { name: 'الذهب الأسود', face: ['#16130f', '#0b0a08'], edge: '#6b5426', red: '#f0c25c', black: '#f7e3a8', gold: ['#fff1b8', '#e3b450', '#8a6416'], court: '#14110c', back: 'royal', dark: true, foil: true },
  };
  const RANK_LABEL = { A: 'A', K: 'K', Q: 'Q', J: 'J', T: '10', 9: '9', 8: '8', 7: '7' };
  let uid = 0;

  // Suit shapes in a 100 × 100 box, centred on (50, 50).
  const SUIT = {
    H: 'M50 90C22 68 5 50 5 31 5 15 16 5 30 5 40 5 47 11 50 19 53 11 60 5 70 5 84 5 95 15 95 31 95 50 78 68 50 90Z',
    D: 'M50 3Q68 28 91 50 68 72 50 97 32 72 9 50 32 28 50 3Z',
    S: 'M50 4C40 18 5 38 5 59 5 73 15 82 28 82 38 82 45 77 48 71 47 81 42 90 33 96H67C58 90 53 81 52 71 55 77 62 82 72 82 85 82 95 73 95 59 95 38 60 18 50 4Z',
    C: 'M50 6A21 21 0 0 1 66 41 21 21 0 1 1 55 75C56 84 60 91 67 96H33C40 91 44 84 45 75A21 21 0 1 1 34 41 21 21 0 0 1 50 6Z',
  };

  // Stroke glyphs for the indices, drawn in a 40 × 60 box.
  const GLYPH = {
    A: 'M4 58L20 3 36 58M10 39H30',
    K: 'M7 3V57M33 3L8 34M17 25L34 57',
    Q: 'M20 4C8 4 4 16 4 30S8 56 20 56 36 44 36 30 32 4 20 4ZM24 42L36 58',
    J: 'M30 3V40C30 52 24 57 17 57 10 57 5 52 4 44',
    1: 'M3 12L12 4V57',
    0: 'M13 4C6 4 3 16 3 30S6 56 13 56 23 44 23 30 20 4 13 4Z',
    9: 'M34 24C34 12 28 4 19 4 10 4 5 12 5 21S11 37 19 37 34 31 34 22V36C34 50 27 57 18 57 12 57 8 54 6 49',
    8: 'M20 30C11 30 6 24 6 17S12 4 20 4 34 10 34 17 29 30 20 30ZM20 30C10 30 4 37 4 44S11 57 20 57 36 51 36 44 30 30 20 30Z',
    7: 'M5 5H35L15 57',
  };

  function colorOf(deck, suit) {
    if (deck.four) return { S: deck.black, H: deck.red, D: deck.blue, C: deck.green }[suit];
    return suit === 'H' || suit === 'D' ? deck.red : deck.black;
  }

  function suitShape(suit, x, y, size, fill, rotate = 0) {
    const s = size / 100;
    return `<path d="${SUIT[suit]}" fill="${fill}" transform="translate(${x - size / 2} ${y - size / 2}) ${rotate ? `rotate(180 ${size / 2} ${size / 2})` : ''} scale(${s})"/>`;
  }

  // Big corner indices: in a fanned hand only the left edge of a card shows.
  function index(rank, suit, fill, deck) {
    const glyphs = RANK_LABEL[rank].split('');
    const widths = { 1: 15, 0: 26 };
    const total = glyphs.reduce((n, g) => n + (widths[g] || 40), 0) + (glyphs.length - 1) * 2;
    let x = 35 - total / 2;
    let out = '';
    for (const g of glyphs) {
      out += `<path d="${GLYPH[g]}" transform="translate(${x.toFixed(1)} 14)" fill="none" stroke="${fill}" stroke-width="8.6" stroke-linecap="round" stroke-linejoin="round"/>`;
      x += (widths[g] || 40) + 2;
    }
    out += suitShape(suit, 35, 100, 36, fill);
    return `<g>${out}</g><g transform="rotate(180 ${W / 2} ${H / 2})">${out}</g>`;
  }

  const PIPS = {
    7: [[0, 0], [2, 0], [0, 2], [2, 2], [0, 4], [2, 4], [1, 1]],
    8: [[0, 0], [2, 0], [0, 2], [2, 2], [0, 4], [2, 4], [1, 1], [1, 3]],
    9: [[0, 0], [2, 0], [0, 1.333], [2, 1.333], [0, 2.667], [2, 2.667], [0, 4], [2, 4], [1, 2]],
    T: [[0, 0], [2, 0], [0, 1.333], [2, 1.333], [0, 2.667], [2, 2.667], [0, 4], [2, 4], [1, 0.667], [1, 3.333]],
  };

  function pips(rank, suit, fill) {
    let out = '';
    for (const [col, row] of PIPS[rank]) {
      const x = 87 + col * 38, y = 88 + row * 43.5;
      out += suitShape(suit, x, y, 40, fill, row > 2 ? 1 : 0);
    }
    return out;
  }

  function goldGradient(id, deck) {
    const [a, b, c] = deck.gold;
    return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".45" stop-color="${b}"/><stop offset=".7" stop-color="${a}"/><stop offset="1" stop-color="${c}"/></linearGradient>`;
  }

  // Emblems in a 100 × 70 box.
  function emblem(rank, gold, ink) {
    if (rank === 'K') {
      return `<path d="M14 56L8 18 31 36 50 8 69 36 92 18 86 56Z" fill="${gold}" stroke="${ink}" stroke-width="2.4" stroke-linejoin="round"/>
        <rect x="13" y="56" width="74" height="11" rx="3" fill="${gold}" stroke="${ink}" stroke-width="2.4"/>
        <circle cx="8" cy="16" r="5" fill="${gold}" stroke="${ink}" stroke-width="2"/><circle cx="50" cy="6" r="6" fill="${gold}" stroke="${ink}" stroke-width="2"/><circle cx="92" cy="16" r="5" fill="${gold}" stroke="${ink}" stroke-width="2"/>
        <circle cx="50" cy="45" r="5.5" fill="${ink}"/><circle cx="30" cy="48" r="3.4" fill="${ink}" opacity=".85"/><circle cx="70" cy="48" r="3.4" fill="${ink}" opacity=".85"/>`;
    }
    if (rank === 'Q') {
      return `<path d="M8 58C20 40 34 32 50 32S80 40 92 58L86 64C74 52 62 48 50 48S26 52 14 64Z" fill="${gold}" stroke="${ink}" stroke-width="2.4" stroke-linejoin="round"/>
        <path d="M50 4L62 22 50 40 38 22Z" fill="${ink}" stroke="${gold}" stroke-width="2.6" stroke-linejoin="round"/>
        <path d="M22 26L30 36 22 46 14 36Z M78 26L86 36 78 46 70 36Z" fill="${ink}" stroke="${gold}" stroke-width="2" stroke-linejoin="round" opacity=".9"/>
        <circle cx="50" cy="22" r="3.4" fill="${gold}"/>`;
    }
    // Jack: a falcon's head in profile.
    return `<path d="M18 62C14 44 20 24 36 14 48 6 64 6 74 14 82 20 86 28 92 32 86 34 80 34 76 32 78 38 76 44 70 46 74 50 74 56 70 62Z" fill="${gold}" stroke="${ink}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M74 14C82 18 88 24 92 32 86 34 80 34 76 32" fill="${ink}" opacity=".92"/>
      <circle cx="62" cy="24" r="5.4" fill="${ink}"/><circle cx="63.6" cy="22.6" r="1.6" fill="${gold}"/>
      <path d="M56 32C50 40 44 46 34 50M50 40C46 48 40 54 30 58" fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round" opacity=".7"/>`;
  }

  function court(rank, suit, deck, ids) {
    const ink = colorOf(deck, suit);
    const gold = `url(#${ids.gold})`;
    const hatch = `<pattern id="${ids.gold}h" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V10" stroke="${ink}" stroke-width="1.4" opacity=".07"/></pattern>`;
    const panel = `<defs>${hatch}</defs><rect x="62" y="34" width="126" height="282" rx="12" fill="${deck.court}" stroke="${gold}" stroke-width="5"/>
      <rect x="62" y="34" width="126" height="282" rx="12" fill="url(#${ids.gold}h)"/>
      <rect x="70" y="42" width="110" height="266" rx="8" fill="none" stroke="${gold}" stroke-width="1.6" opacity=".8"/>
      <path d="M70 175H180" stroke="${gold}" stroke-width="3"/>`;
    const half = `<g transform="translate(77 66) scale(0.96)">${emblem(rank, gold, ink)}</g>${suitShape(suit, 125, 150, 24, ink)}`;
    return panel + `<g>${half}</g><g transform="rotate(180 125 175)">${half}</g>`;
  }

  function ace(suit, deck, ids) {
    const ink = colorOf(deck, suit);
    const gold = `url(#${ids.gold})`;
    return `<circle cx="125" cy="175" r="78" fill="none" stroke="${gold}" stroke-width="3"/>
      <circle cx="125" cy="175" r="70" fill="none" stroke="${ink}" stroke-width="1" opacity=".3"/>
      ${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<circle cx="${125 + Math.cos(a * Math.PI / 180) * 78}" cy="${175 + Math.sin(a * Math.PI / 180) * 78}" r="4" fill="${gold}"/>`).join('')}
      ${suitShape(suit, 125, 175, 104, ink)}`;
  }

  function face(card, deckId = 'deck-classic') {
    const deck = DECKS[deckId] || DECKS['deck-classic'];
    const rank = card[0], suit = card[1];
    const ink = colorOf(deck, suit);
    const id = 'c' + (uid++).toString(36);
    const ids = { gold: id + 'g', paper: id + 'p' };
    let body;
    if (rank === 'A') body = ace(suit, deck, ids);
    else if (rank === 'K' || rank === 'Q' || rank === 'J') body = court(rank, suit, deck, ids);
    else body = pips(rank, suit, ink);
    const sheen = deck.dark ? `<rect x="3" y="3" width="${W - 6}" height="${H - 6}" rx="15" fill="url(#${id}s)" opacity=".5"/>` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs>${goldGradient(ids.gold, deck)}<linearGradient id="${ids.paper}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${deck.face[0]}"/><stop offset="1" stop-color="${deck.face[1]}"/></linearGradient><linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
      <rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="17" fill="url(#${ids.paper})" stroke="${deck.foil ? `url(#${ids.gold})` : deck.edge}" stroke-width="${deck.foil ? 3 : 2}"/>
      ${body}${index(rank, suit, ink, deck)}${sheen}</svg>`;
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
      <rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="17" fill="${deck.dark ? '#0b0d14' : '#fbf6ea'}" stroke="${deck.edge}" stroke-width="2"/>${art}</svg>`;
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
