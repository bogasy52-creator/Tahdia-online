/* لعبة العباقرة 33.15.0 — «رص البلوكات».
   An 8×8 board and three pieces at a time. Drag a piece onto the board; a full row or column
   clears. Clearing again within the next three pieces builds a combo; an empty board pays a
   big bonus. The game ends when none of the pieces left can fit (or when the clock runs out in
   «دقيقتين»). Two helps a game: new pieces, and a bomb that clears a 3×3 square.
   In a group room (الغرف) everyone gets the same pieces (the room's seed) on the clock, and the
   page reports its score with BS_PARTY_LINK.report(). Original game; no outside assets. */
(() => {
  'use strict';
  const doc = document, $ = (id) => doc.getElementById(id), N = 8;
  const link = window.BS_PARTY_LINK?.local ? window.BS_PARTY_LINK : null;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
  const now = () => performance.now();

  /* ---------------------------------------------------------------- the pieces */
  const COLOURS = ['#ef3b45', '#2f74ff', '#ffc21a', '#22b04b', '#9b4dff', '#ff8a1f', '#16c6d9'];
  const BASE = [
    [[0, 0]], [[0, 0], [0, 1]], [[0, 0], [0, 1], [0, 2]], [[0, 0], [0, 1], [0, 2], [0, 3]], [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]],
    [[0, 0], [0, 1], [1, 0], [1, 1]], [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]],
    [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]], [[0, 0], [1, 0], [1, 1]], [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]],
    [[0, 0], [1, 0], [2, 0], [2, 1]], [[0, 0], [0, 1], [0, 2], [1, 1]], [[0, 1], [0, 2], [1, 0], [1, 1]], [[0, 0], [0, 1], [1, 1], [1, 2]],
  ];
  const norm = (cells) => { const r0 = Math.min(...cells.map((c) => c[0])), c0 = Math.min(...cells.map((c) => c[1])); return cells.map(([r, c]) => [r - r0, c - c0]).sort((a, b) => a[0] - b[0] || a[1] - b[1]); };
  const turn = (cells) => norm(cells.map(([r, c]) => [c, -r]));
  const SHAPES = (() => {
    const seen = new Set(), out = [];
    for (const base of BASE) { let s = norm(base); for (let k = 0; k < 4; k++) { const key = JSON.stringify(s); if (!seen.has(key)) { seen.add(key); out.push(s); } s = turn(s); } }
    return out;
  })();
  const LEVELS = Object.freeze({
    casual: { label: 'سهل', w: { 1: 3, 2: 4, 3: 5, 4: 3.5, 5: 1.6, 6: 1.1, 9: .5 } },
    standard: { label: 'متوسط', w: { 1: 1.6, 2: 3, 3: 4, 4: 4, 5: 2.6, 6: 1.6, 9: 1 } },
    expert: { label: 'صعب', w: { 1: .8, 2: 2, 3: 3, 4: 4.4, 5: 3.6, 6: 2.4, 9: 1.8 } },
  });
  const MODES = Object.freeze({ classic: 'كلاسيك', timed: 'دقيقتين' });
  const times = (n) => '\u2066×' + n + '\u2069'; // ×2 stays ×2 inside Arabic text
  const TIMED_MS = 120000, LINE_POINTS = [0, 10, 30, 60, 100, 150, 210, 280, 360];

  function seeded(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }

  /* ---------------------------------------------------------------- the game */
  let game = null, timers = [];
  const later = (ms, fn) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
  const clearTimers = () => { timers.forEach((t) => { clearTimeout(t); clearInterval(t); }); timers = []; };

  function newGame(levelId, modeId, seed) {
    const level = LEVELS[levelId] ? levelId : 'standard';
    return { level, mode: MODES[modeId] ? modeId : 'classic', seed, random: seeded(seed), grid: Array.from({ length: N }, () => Array(N).fill(null)),
      tray: [null, null, null], score: 0, lines: 0, combo: 0, comboLeft: 0, best: Number(store.get(bestKey(level, modeId))) || 0,
      helps: { swap: 1, bomb: 1 }, bombArmed: false, over: false, startedAt: now(), endsAt: 0, moves: 0, clears: 0, bestCombo: 0 };
  }
  const bestKey = (level, mode) => 'bs-blocks-best-' + (MODES[mode] ? mode : 'classic') + '-' + (LEVELS[level] ? level : 'standard');
  const fits = (grid, shape, r0, c0) => shape.every(([r, c]) => { const R = r0 + r, C = c0 + c; return R >= 0 && R < N && C >= 0 && C < N && grid[R][C] === null; });
  const canFitAnywhere = (grid, shape) => { for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (fits(grid, shape, r, c)) return true; return false; };
  function pickShape(random, level) {
    const w = LEVELS[level].w, total = SHAPES.reduce((n, s) => n + (w[s.length] || 1), 0);
    let x = random() * total;
    for (const s of SHAPES) { x -= w[s.length] || 1; if (x <= 0) return s; }
    return SHAPES[0];
  }
  // three new pieces; at least one of them fits (the board is never unfair on purpose)
  function deal() {
    let set = null;
    for (let tries = 0; tries < 24; tries++) {
      set = [0, 1, 2].map(() => ({ shape: pickShape(game.random, game.level), colour: Math.floor(game.random() * COLOURS.length) }));
      if (set.some((p) => canFitAnywhere(game.grid, p.shape))) break;
    }
    if (!set.some((p) => canFitAnywhere(game.grid, p.shape))) set[0] = { shape: SHAPES[0], colour: set[0].colour };
    game.tray = set;
  }
  const noRoom = () => game.tray.every((p) => !p || !canFitAnywhere(game.grid, p.shape));
  function fullLines(grid) {
    const rows = [], cols = [];
    for (let i = 0; i < N; i++) { if (grid[i].every((v) => v !== null)) rows.push(i); if (grid.every((row) => row[i] !== null)) cols.push(i); }
    return { rows, cols };
  }
  // what a piece would clear if it were put at (r0, c0)
  function wouldClear(shape, r0, c0) {
    const grid = game.grid.map((row) => row.slice());
    shape.forEach(([r, c]) => { grid[r0 + r][c0 + c] = 0; });
    return fullLines(grid);
  }

  function place(index, r0, c0) {
    const piece = game.tray[index];
    if (!piece || game.over || !fits(game.grid, piece.shape, r0, c0)) return false;
    piece.shape.forEach(([r, c]) => { game.grid[r0 + r][c0 + c] = piece.colour; });
    game.tray[index] = null; game.moves++;
    let gained = piece.shape.length;
    const { rows, cols } = fullLines(game.grid), count = rows.length + cols.length;
    sounds.place(piece.shape.length);
    drawBoard({ pop: piece.shape.map(([r, c]) => [r0 + r, c0 + c]) });
    if (count) {
      game.combo = game.comboLeft > 0 ? game.combo + 1 : 1; game.comboLeft = 3; game.clears++; game.lines += count;
      game.bestCombo = Math.max(game.bestCombo, game.combo);
      const lineScore = LINE_POINTS[Math.min(count, LINE_POINTS.length - 1)], bonus = Math.round(lineScore * (1 + Math.min(6, game.combo - 1) * .5));
      gained += bonus;
      const cells = new Set();
      rows.forEach((r) => { for (let c = 0; c < N; c++) cells.add(r * N + c); });
      cols.forEach((c) => { for (let r = 0; r < N; r++) cells.add(r * N + c); });
      clearCells([...cells], count);
      const centre = [...cells].reduce((a, k) => [a[0] + Math.floor(k / N), a[1] + (k % N)], [0, 0]).map((v) => v / cells.size);
      floatText('+' + bonus, centre[0], centre[1], count >= 3 ? 'big' : '');
      if (game.combo >= 2) banner('كومبو ' + times(game.combo), 'combo'), sounds.combo(game.combo);
      else if (count >= 2) banner(count === 2 ? 'ممتاز!' : count === 3 ? 'رهيب!' : 'أسطوري!', 'lines');
      sounds.clear(count);
      buzz(count >= 3 ? [30, 40, 60] : [25]);
      if (count >= 3 && !reduce) shake();
      if (game.grid.every((row) => row.every((v) => v === null))) { gained += 300; later(420, () => { banner('لوحة نظيفة! +300', 'clean'); confetti(); sounds.clean(); }); }
    } else if (game.comboLeft > 0 && --game.comboLeft === 0) game.combo = 0;
    game.score += gained;
    if (game.tray.every((p) => !p)) deal();
    drawStats(); drawTray(); drawHelps();
    report();
    later(count ? 460 : 60, checkEnd);
    return true;
  }
  function clearCells(cells, count) {
    const board = $('bkBoard');
    cells.forEach((k, i) => {
      const r = Math.floor(k / N), c = k % N, el = board.children[k];
      game.grid[r][c] = null;
      if (!el) return;
      el.classList.add('is-clearing'); el.style.setProperty('--d', ((i % N) * 22) + 'ms');
      if (!reduce && i % 2 === 0) sparks(r, c, el.style.getPropertyValue('--c') || '#ffd25a');
    });
    later(reduce ? 0 : 430, () => { drawBoard(); drawTray(); });
  }
  function checkEnd() {
    if (!game || game.over) return;
    if (noRoom()) {
      if (game.helps.swap > 0 || game.helps.bomb > 0) { say('ما فيه مكان لهالقطع… استخدم مساعدة 👇', 'warn'); $('bkHelps').classList.add('is-call'); return; }
      finish('full');
    } else { $('bkHelps').classList.remove('is-call'); say(game.combo >= 2 ? 'كومبو ' + times(game.combo) + ' · كمّل تكسير' : 'اسحب قطعة للوحة'); }
  }

  /* ---------------------------------------------------------------- helps */
  function useSwap() {
    if (!game || game.over || game.helps.swap < 1) return;
    game.helps.swap--; sounds.swap(); deal(); drawTray(); drawHelps(); later(60, checkEnd);
  }
  function armBomb() {
    if (!game || game.over || game.helps.bomb < 1) return;
    game.bombArmed = !game.bombArmed; drawHelps();
    $('bkBoard').classList.toggle('is-bomb', game.bombArmed);
    say(game.bombArmed ? 'اختر مكان القنبلة 💣 تمسح مربع 3×3' : 'اسحب قطعة للوحة');
  }
  function dropBomb(r, c) {
    game.helps.bomb--; game.bombArmed = false; $('bkBoard').classList.remove('is-bomb');
    const cells = [];
    for (let R = r - 1; R <= r + 1; R++) for (let C = c - 1; C <= c + 1; C++) if (R >= 0 && R < N && C >= 0 && C < N && game.grid[R][C] !== null) cells.push(R * N + C);
    sounds.bomb(); buzz([60, 30, 80]); if (!reduce) shake();
    clearCells(cells, 1);
    drawHelps(); later(480, checkEnd);
  }

  /* ---------------------------------------------------------------- drawing */
  function drawBoard(opts = {}) {
    const board = $('bkBoard');
    if (board.children.length !== N * N) {
      board.replaceChildren(...Array.from({ length: N * N }, (_, k) => { const d = doc.createElement('i'); d.className = 'bk-cell'; d.dataset.r = Math.floor(k / N); d.dataset.c = k % N; return d; }));
    }
    const pop = new Set((opts.pop || []).map(([r, c]) => r * N + c));
    for (let k = 0; k < N * N; k++) {
      const el = board.children[k], v = game.grid[Math.floor(k / N)][k % N];
      el.className = 'bk-cell' + (v !== null ? ' is-filled' : '') + (pop.has(k) && !reduce ? ' is-pop' : '');
      if (v !== null) el.style.setProperty('--c', COLOURS[v]); else el.style.removeProperty('--c');
      el.style.removeProperty('--d');
    }
  }
  function pieceEl(piece, cell) {
    const rows = Math.max(...piece.shape.map((p) => p[0])) + 1, cols = Math.max(...piece.shape.map((p) => p[1])) + 1;
    const el = doc.createElement('div'); el.className = 'bk-piece';
    el.style.setProperty('--rows', rows); el.style.setProperty('--cols', cols); el.style.setProperty('--cell', cell + 'px'); el.style.setProperty('--c', COLOURS[piece.colour]);
    piece.shape.forEach(([r, c]) => { const b = doc.createElement('i'); b.style.gridRow = r + 1; b.style.gridColumn = c + 1; el.append(b); });
    return el;
  }
  function drawTray() {
    const tray = $('bkTray');
    tray.replaceChildren(...game.tray.map((piece, i) => {
      const slot = doc.createElement('button'); slot.type = 'button'; slot.className = 'bk-slot'; slot.dataset.slot = i;
      if (!piece) { slot.disabled = true; slot.setAttribute('aria-label', 'فاضي'); return slot; }
      const ok = canFitAnywhere(game.grid, piece.shape);
      slot.classList.toggle('is-dead', !ok);
      slot.setAttribute('aria-label', 'قطعة من ' + piece.shape.length + ' مربعات' + (ok ? '' : ' · ما لها مكان'));
      slot.append(pieceEl(piece, piece.shape.length >= 9 || piece.shape.some((p) => p[0] > 2 || p[1] > 2) ? 15 : 19));
      return slot;
    }));
  }
  function drawStats() {
    $('bkScore').textContent = game.score.toLocaleString('en-US');
    $('bkBest').textContent = Math.max(game.best, game.score).toLocaleString('en-US');
    const meter = $('bkCombo');
    meter.hidden = game.combo < 2; meter.textContent = times(game.combo);
  }
  function drawHelps() {
    const swap = $('bkSwap'), bomb = $('bkBomb');
    swap.querySelector('small').textContent = game.helps.swap; bomb.querySelector('small').textContent = game.helps.bomb;
    swap.disabled = game.over || game.helps.swap < 1; bomb.disabled = game.over || game.helps.bomb < 1;
    bomb.classList.toggle('is-armed', game.bombArmed);
  }
  function say(text, tone = '') { const s = $('bkStatus'); s.textContent = text; s.dataset.tone = tone; }

  /* ---------------------------------------------------------------- effects */
  const fx = () => $('bkFx');
  function cellCentre(r, c) {
    const b = $('bkBoard').getBoundingClientRect(), size = b.width / N;
    return { x: b.left + (c + .5) * size, y: b.top + (r + .5) * size, size };
  }
  function floatText(text, r, c, kind) {
    const { x, y } = cellCentre(r, c), el = doc.createElement('b');
    el.className = 'bk-float ' + kind; el.textContent = text; el.style.left = x + 'px'; el.style.top = y + 'px';
    fx().append(el); setTimeout(() => el.remove(), 1100);
  }
  function banner(text, kind) {
    const el = doc.createElement('div'); el.className = 'bk-banner ' + kind; el.textContent = text;
    fx().append(el); setTimeout(() => el.remove(), 1300);
  }
  function sparks(r, c, colour) {
    const { x, y } = cellCentre(r, c);
    for (let i = 0; i < 4; i++) {
      const s = doc.createElement('i'); s.className = 'bk-spark';
      const a = Math.random() * Math.PI * 2, d = 30 + Math.random() * 50;
      s.style.left = x + 'px'; s.style.top = y + 'px'; s.style.background = colour;
      s.style.setProperty('--x', Math.cos(a) * d + 'px'); s.style.setProperty('--y', Math.sin(a) * d - 20 + 'px');
      fx().append(s); setTimeout(() => s.remove(), 750);
    }
  }
  function confetti() {
    if (reduce) return;
    for (let i = 0; i < 40; i++) {
      const s = doc.createElement('i'); s.className = 'bk-confetti';
      s.style.left = (Math.random() * 100) + 'vw'; s.style.background = COLOURS[i % COLOURS.length];
      s.style.setProperty('--r', (Math.random() * 720 - 360) + 'deg'); s.style.animationDelay = (Math.random() * .4) + 's';
      fx().append(s); setTimeout(() => s.remove(), 2400);
    }
  }
  function shake() { const b = $('bkBoardWrap'); b.classList.remove('is-shake'); void b.offsetWidth; b.classList.add('is-shake'); }
  function buzz(pattern) { try { if (store.get('bs-blocks-sound') !== 'off') navigator.vibrate?.(pattern); } catch {} }

  /* ---------------------------------------------------------------- sounds (made on the device) */
  const sounds = (() => {
    let ctx = null, noise = null;
    const muted = () => store.get('bs-blocks-sound') === 'off' || window.BS_AUDIO?.getSettings?.()?.muted || window.BS_AUDIO?.getSettings?.()?.effects === false;
    const vol = () => Math.max(0, Math.min(1, window.BS_AUDIO?.getSettings?.()?.volume ?? .72));
    const audio = () => { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ctx ??= new C(); if (ctx.state === 'suspended') ctx.resume?.(); return ctx; };
    function tone(f, ms, { type = 'sine', gain = .06, when = 0, to = null } = {}) {
      if (muted()) return; try {
        const a = audio(); if (!a) return; const t = a.currentTime + when, o = a.createOscillator(), g = a.createGain();
        o.type = type; o.frequency.setValueAtTime(f, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + ms / 1000);
        g.gain.setValueAtTime(Math.max(.0001, gain * vol() * 1.3), t); g.gain.exponentialRampToValueAtTime(.0001, t + ms / 1000);
        o.connect(g).connect(a.destination); o.start(t); o.stop(t + ms / 1000 + .02);
      } catch {}
    }
    function hiss(ms, { gain = .08, when = 0, from = 1800, to = 200 } = {}) {
      if (muted()) return; try {
        const a = audio(); if (!a) return;
        if (!noise) { noise = a.createBuffer(1, a.sampleRate, a.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
        const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(), t = a.currentTime + when;
        s.buffer = noise; f.type = 'lowpass'; f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + ms / 1000);
        g.gain.setValueAtTime(gain * vol(), t); g.gain.exponentialRampToValueAtTime(.0001, t + ms / 1000);
        s.connect(f).connect(g).connect(a.destination); s.start(t); s.stop(t + ms / 1000 + .02);
      } catch {}
    }
    return {
      pick() { tone(660, 60, { type: 'triangle', gain: .04 }); },
      place(n) { tone(220 - Math.min(9, n) * 9, 110, { type: 'sine', gain: .09, to: 120 }); tone(880, 40, { type: 'triangle', gain: .025 }); },
      clear(lines) { [523, 659, 784, 1047, 1319].slice(0, 2 + Math.min(3, lines)).forEach((f, i) => tone(f, 220, { type: 'triangle', gain: .05, when: i * .05 })); hiss(260, { gain: .05, from: 6000, to: 900 }); },
      combo(n) { [784, 988, 1175, 1568].forEach((f, i) => tone(f * (1 + Math.min(4, n) * .04), 150, { type: 'square', gain: .025, when: .12 + i * .06 })); },
      clean() { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 260, { type: 'triangle', gain: .055, when: i * .08 })); },
      bomb() { tone(120, 380, { type: 'sawtooth', gain: .07, to: 40 }); hiss(520, { gain: .12, from: 2200, to: 120 }); },
      swap() { hiss(300, { gain: .06, from: 600, to: 4000 }); tone(440, 120, { type: 'triangle', gain: .04, when: .1, to: 880 }); },
      nope() { tone(150, 160, { type: 'square', gain: .03 }); },
      tick() { tone(1200, 40, { type: 'square', gain: .02 }); },
      over() { [392, 330, 262, 196].forEach((f, i) => tone(f, 280, { type: 'sine', gain: .05, when: i * .14 })); },
      best() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 230, { type: 'triangle', gain: .06, when: i * .11 })); },
    };
  })();

  /* ---------------------------------------------------------------- dragging */
  let drag = null;
  function boardMetrics() { const b = $('bkBoard').getBoundingClientRect(); return { left: b.left, top: b.top, size: b.width / N }; }
  function anchorAt(x, y, piece) {
    // the piece floats above the finger; its top-left square is where it lands
    const m = boardMetrics(), rows = Math.max(...piece.shape.map((p) => p[0])) + 1, cols = Math.max(...piece.shape.map((p) => p[1])) + 1;
    const lift = Math.max(56, m.size * 1.4);
    const left = x - (cols * m.size) / 2, top = y - lift - rows * m.size;
    return { r: Math.round((top - m.top) / m.size), c: Math.round((left - m.left) / m.size), left, top, size: m.size };
  }
  function showGhost(piece, r, c) {
    const board = $('bkBoard');
    for (const el of board.children) el.classList.remove('is-ghost', 'will-clear');
    if (r === null || !fits(game.grid, piece.shape, r, c)) return false;
    piece.shape.forEach(([dr, dc]) => { const el = board.children[(r + dr) * N + c + dc]; el.classList.add('is-ghost'); el.style.setProperty('--g', COLOURS[piece.colour]); });
    const { rows, cols } = wouldClear(piece.shape, r, c);
    rows.forEach((R) => { for (let C = 0; C < N; C++) board.children[R * N + C].classList.add('will-clear'); });
    cols.forEach((C) => { for (let R = 0; R < N; R++) board.children[R * N + C].classList.add('will-clear'); });
    return true;
  }
  function startDrag(event, index) {
    const piece = game?.tray[index];
    if (!piece || game.over) return;
    if (game.bombArmed) armBomb();
    event.preventDefault();
    const m = boardMetrics(), ghost = pieceEl(piece, m.size);
    ghost.classList.add('bk-drag'); fx().append(ghost);
    drag = { index, piece, ghost, id: event.pointerId, at: null };
    $('bkTray').children[index]?.classList.add('is-lifted');
    sounds.pick();
    moveDrag(event);
    try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch {}
  }
  function moveDrag(event) {
    if (!drag || event.pointerId !== drag.id) return;
    const a = anchorAt(event.clientX, event.clientY, drag.piece);
    drag.ghost.style.transform = `translate(${a.left}px, ${a.top}px)`;
    drag.at = showGhost(drag.piece, a.r, a.c) ? a : null;
    drag.ghost.classList.toggle('is-fit', Boolean(drag.at));
  }
  function endDrag(event) {
    if (!drag || (event && event.pointerId !== drag.id)) return;
    const { index, ghost, at } = drag; drag = null;
    for (const el of $('bkBoard').children) el.classList.remove('is-ghost', 'will-clear');
    ghost.remove();
    $('bkTray').children[index]?.classList.remove('is-lifted');
    if (at && event?.type === 'pointerup') place(index, at.r, at.c);
    else if (event?.type === 'pointerup') sounds.nope();
  }
  // without dragging: tap a piece, then the square for its top-left corner
  let picked = null;
  function tapSlot(index) {
    if (!game || game.over || !game.tray[index]) return;
    picked = picked === index ? null : index;
    [...$('bkTray').children].forEach((s, i) => s.classList.toggle('is-picked', i === picked));
    if (picked !== null) { sounds.pick(); say('اختر المربع اللي تبدأ منه القطعة'); }
  }
  function tapCell(r, c) {
    if (!game || game.over) return;
    if (game.bombArmed) { dropBomb(r, c); return; }
    if (picked === null) return;
    const i = picked; picked = null;
    if (!place(i, r, c)) { sounds.nope(); say('ما تركب هنا', 'warn'); drawTray(); }
  }

  /* ---------------------------------------------------------------- start and finish */
  let clock = null;
  function start(levelId, modeId) {
    clearTimers(); clearInterval(clock);
    const seed = link ? link.local.seed : (Math.random() * 4294967296) >>> 0;
    game = newGame(link ? link.local.level : levelId, link ? 'timed' : modeId, seed);
    picked = null;
    doc.body.classList.add('bk-running');
    doc.body.classList.toggle('bk-timed', game.mode === 'timed');
    $('bkIntro').hidden = true; $('bkGame').hidden = false; $('bkResult').hidden = true;
    $('bkLevel').textContent = MODES[game.mode] + ' · ' + LEVELS[game.level].label;
    $('bkHelps').classList.remove('is-call');
    deal(); drawBoard(); drawTray(); drawStats(); drawHelps();
    say('اسحب قطعة للوحة · كمّل صف أو عمود يتكسر');
    link?.live?.();
    if (game.mode === 'timed') {
      game.endsAt = now() + TIMED_MS;
      const tick = () => {
        if (!game || game.over) return;
        const left = Math.max(0, game.endsAt - now());
        $('bkClock').style.setProperty('--left', (left / TIMED_MS).toFixed(3));
        $('bkTime').textContent = Math.ceil(left / 1000);
        if (left <= 10000 && Math.ceil(left / 1000) !== game.lastTick) { game.lastTick = Math.ceil(left / 1000); sounds.tick(); }
        if (left <= 0) finish('time');
      };
      tick(); clock = setInterval(tick, 250); timers.push(clock);
    }
    $('bkGame').scrollIntoView?.({ block: 'start' });
  }
  function finish(why) {
    if (!game || game.over) return;
    game.over = true; clearInterval(clock);
    drawHelps();
    const best = game.score > game.best && game.score > 0;
    if (best) store.set(bestKey(game.level, game.mode), String(game.score));
    say(why === 'time' ? 'خلص الوقت! ⏱' : 'ما فيه مكان لأي قطعة', 'warn');
    $('bkBoardWrap').classList.add('is-over');
    later(why === 'time' ? 300 : 900, () => {
      $('bkBoardWrap').classList.remove('is-over');
      (best ? sounds.best : sounds.over)();
      if (best) confetti();
      $('bkResultTitle').textContent = best ? 'رقم قياسي جديد! 🏆' : why === 'time' ? 'خلص الوقت' : 'انتهت اللوحة';
      $('bkFinal').textContent = game.score.toLocaleString('en-US');
      $('bkResultNote').textContent = 'أفضل نتيجة: ' + Math.max(game.best, game.score).toLocaleString('en-US');
      const facts = [['صفوف وأعمدة', game.lines], ['أعلى كومبو', game.bestCombo ? times(game.bestCombo) : '—'], ['قطع', game.moves]];
      $('bkFacts').replaceChildren(...facts.map(([k, v]) => { const li = doc.createElement('li'); const b = doc.createElement('b'); b.textContent = v; const s = doc.createElement('small'); s.textContent = k; li.append(b, s); return li; }));
      $('bkResult').hidden = false; $('bkAgain').hidden = Boolean(link);
      if (!$('bkAgain').hidden) $('bkAgain').focus();
    });
    report(true);
  }
  let lastReport = 0;
  function report(done = false) {
    if (!link || !game) return;
    const t = now(); if (!done && t - lastReport < 1500) return; lastReport = t;
    const progress = game.mode === 'timed' ? Math.min(1, (t - game.startedAt) / TIMED_MS) : Math.min(1, game.score / 3000);
    link.report({ progress: done ? 1 : progress, score: game.score, mistakes: 0, done: done || game.over, won: false });
  }

  /* ---------------------------------------------------------------- the page */
  function init() {
    let level = LEVELS[store.get('bs-blocks-level')] ? store.get('bs-blocks-level') : 'standard';
    let mode = MODES[store.get('bs-blocks-mode')] ? store.get('bs-blocks-mode') : 'classic';
    const paint = () => {
      doc.querySelectorAll('[data-bk-level]').forEach((b) => { const on = b.dataset.bkLevel === level; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); });
      doc.querySelectorAll('[data-bk-mode]').forEach((b) => { const on = b.dataset.bkMode === mode; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); });
      const best = Number(store.get(bestKey(level, mode))) || 0;
      $('bkIntroBest').textContent = best ? 'أفضل نتيجة لك هنا: ' + best.toLocaleString('en-US') : 'ما عندك نتيجة هنا للحين';
    };
    doc.querySelectorAll('[data-bk-level]').forEach((b) => b.addEventListener('click', () => { level = b.dataset.bkLevel; store.set('bs-blocks-level', level); paint(); }));
    doc.querySelectorAll('[data-bk-mode]').forEach((b) => b.addEventListener('click', () => { mode = b.dataset.bkMode; store.set('bs-blocks-mode', mode); paint(); }));
    paint();
    $('bkPlay').addEventListener('click', () => start(level, mode));
    $('bkAgain').addEventListener('click', () => start(level, mode));
    $('bkQuit').addEventListener('click', () => { clearTimers(); clearInterval(clock); if (game && !game.over && link) finish('quit'); game = null; doc.body.classList.remove('bk-running', 'bk-timed'); $('bkGame').hidden = true; $('bkResult').hidden = true; $('bkIntro').hidden = false; paint(); });
    $('bkSwap').addEventListener('click', useSwap);
    $('bkBomb').addEventListener('click', armBomb);
    const sound = $('bkSound'), paintSound = () => { const off = store.get('bs-blocks-sound') === 'off'; sound.textContent = off ? '🔇' : '🔊'; sound.setAttribute('aria-pressed', String(!off)); };
    sound.addEventListener('click', () => { store.set('bs-blocks-sound', store.get('bs-blocks-sound') === 'off' ? 'on' : 'off'); paintSound(); });
    paintSound();
    const tray = $('bkTray');
    let tapStart = null;
    tray.addEventListener('pointerdown', (e) => { const slot = e.target.closest('.bk-slot'); if (!slot || slot.disabled) return; tapStart = { x: e.clientX, y: e.clientY, i: Number(slot.dataset.slot), moved: false }; startDrag(e, Number(slot.dataset.slot)); });
    // a press that never travels is a tap (pick the piece), even if the lifted piece hovers over a square
    const up = (e) => {
      if (drag && tapStart && !tapStart.moved && e.type === 'pointerup') { const i = tapStart.i; endDrag({ type: 'cancel', pointerId: e.pointerId }); tapSlot(i); tapStart = null; return; }
      tapStart = null; endDrag(e);
    };
    addEventListener('pointermove', (e) => { if (tapStart && Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y) > 10) tapStart.moved = true; }, { passive: true });
    addEventListener('pointermove', moveDrag, { passive: true });
    addEventListener('pointerup', up);
    addEventListener('pointercancel', (e) => { tapStart = null; endDrag({ type: 'cancel', pointerId: e.pointerId }); });
    tray.addEventListener('keydown', (e) => { const slot = e.target.closest('.bk-slot'); if (slot && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); tapSlot(Number(slot.dataset.slot)); } });
    $('bkBoard').addEventListener('click', (e) => { const cell = e.target.closest('.bk-cell'); if (cell) tapCell(Number(cell.dataset.r), Number(cell.dataset.c)); });
    addEventListener('visibilitychange', () => { if (doc.hidden) report(); });
    if (link) start(link.local.level, 'timed');
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
  window.BS_BLOCKS = Object.freeze({ SHAPES, LEVELS, MODES, LINE_POINTS, fits, seeded });
})();
