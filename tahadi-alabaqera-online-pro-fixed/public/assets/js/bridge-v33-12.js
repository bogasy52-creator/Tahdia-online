/* لعبة العباقرة 33.12.0 / 33.13.0 — «جسر الألوان».
   A bridge of coloured glass: one tile in every row holds, the others break. The safe way
   lights up row by row at the start, then it is gone.
   · «سباق» (the default): everyone runs at once. Tap your way up; a wrong tile breaks for
     everybody and drops you back to the start for a moment. First across wins.
   · «بالدور»: one step each, in turn; a 15-second clock on yours.
   Two helps, once a game: «عين الصقر» lights your next three rows for a second, «درع» saves
   you from one fall. A safe step glows for a moment and goes back to looking like the rest:
   remembering who stepped where is half the game.
   In a group room (الغرف) every player gets the same bridge (the room's seed) and the
   page reports how far its player got. */
(function () {
  'use strict';
  const doc = document, $ = (id) => doc.getElementById(id);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LEVELS = Object.freeze({
    casual: { label: 'سهل', rows: 8, cols: 2, preview: 3600, memory: 0.45, recall: 0.75, pace: 1500 },
    standard: { label: 'متوسط', rows: 10, cols: 3, preview: 3000, memory: 0.58, recall: 0.85, pace: 1150 },
    expert: { label: 'صعب', rows: 12, cols: 4, preview: 2400, memory: 0.72, recall: 0.92, pace: 860 },
  });
  const MODES = Object.freeze({ race: 'سباق', turns: 'بالدور' });
  const PALETTE = Object.freeze([
    ['أحمر', '#ff4d6d'], ['أزرق', '#3fa7ff'], ['أخضر', '#2fd6a1'], ['ذهبي', '#ffc83d'], ['بنفسجي', '#b57cff'], ['برتقالي', '#ff8a3d'],
  ]);
  const RIVALS = Object.freeze(['فهد', 'نورة', 'سارة', 'ماجد', 'خالد', 'ريم', 'بدر', 'لطيفة', 'سعود', 'منيرة']);
  const SEATS = Object.freeze(['#ffcc3e', '#3fa7ff', '#ff4d6d', '#2fd6a1']);
  const TURN_MS = 15000, STUN_MS = 1300, STEP_MS = 260;
  const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };
  const link = window.BS_PARTY_LINK?.local ? window.BS_PARTY_LINK : null;

  function seeded(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }
  const shuffle = (list, random) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const myName = () => String(link?.name || store.get('bs-player-name-v33') || store.get('bs_player_name') || 'أنت').trim().slice(0, 16) || 'أنت';
  const now = () => performance.now();

  /* ---------------------------------------------------------------- sound: glass, wind and a fanfare */
  let audio = null, noise = null, muted = store.get('bs-new-games-mute') === '1';
  function ctx() { audio ??= new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume?.(); return audio; }
  function tone(freq, ms, { type = 'sine', gain = 0.06, when = 0, to = null } = {}) {
    if (muted) return;
    try {
      const a = ctx(), t = a.currentTime + when, o = a.createOscillator(), g = a.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + ms / 1000);
      g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
      o.connect(g).connect(a.destination); o.start(t); o.stop(t + ms / 1000 + 0.02);
    } catch { /* no sound on this device */ }
  }
  function hiss(ms, { gain = 0.08, when = 0, low = 900 } = {}) {
    if (muted) return;
    try {
      const a = ctx();
      if (!noise) { noise = a.createBuffer(1, a.sampleRate, a.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
      const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(), t = a.currentTime + when;
      s.buffer = noise; f.type = 'highpass'; f.frequency.value = low;
      g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
      s.connect(f).connect(g).connect(a.destination); s.start(t); s.stop(t + ms / 1000 + 0.02);
    } catch { /* no sound */ }
  }
  const sounds = {
    step(n = 0) { const f = 880 * Math.pow(1.06, n % 12); tone(f, 140, { type: 'triangle', gain: 0.05 }); tone(f * 2.01, 220, { gain: 0.025, when: 0.02 }); },
    crack() { hiss(380, { gain: 0.12, low: 1800 }); tone(160, 300, { type: 'sawtooth', gain: 0.05, to: 60 }); },
    fall() { tone(520, 600, { gain: 0.05, to: 90 }); },
    turn() { tone(620, 90, { gain: 0.035 }); },
    reveal(i) { tone(660 + i * 40, 110, { type: 'triangle', gain: 0.03 }); },
    power() { [784, 1175, 1568].forEach((f, i) => tone(f, 160, { type: 'triangle', gain: 0.04, when: i * 0.06 })); },
    shield() { tone(392, 260, { type: 'square', gain: 0.03 }); tone(784, 300, { gain: 0.04, when: 0.05 }); },
    win() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 260, { type: 'triangle', gain: 0.06, when: i * 0.11 })); },
    lose() { [392, 330, 262].forEach((f, i) => tone(f, 240, { gain: 0.05, when: i * 0.14 })); },
  };
  const buzz = (ms) => { try { if (!muted) navigator.vibrate?.(ms); } catch { /* no vibration */ } };

  /* ---------------------------------------------------------------- the game */
  let game = null, timers = [];
  const later = (ms, fn) => { const id = setTimeout(fn, ms); timers.push(id); return id; };
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  function newGame(levelId, modeId, seed) {
    const level = LEVELS[levelId] || LEVELS.standard, random = seeded(seed);
    const rows = [];
    for (let r = 0; r < level.rows; r++) {
      const colours = shuffle(PALETTE, random).slice(0, level.cols);
      rows.push({ colours, safe: Math.floor(random() * level.cols), broken: new Set(), seen: false });
    }
    const rivals = shuffle(RIVALS, seeded(seed ^ 0x9e3779b9)).slice(0, 3);
    const players = [{ name: myName(), me: true }, ...rivals.map((name) => ({ name, me: false }))].map((p, i) => ({
      ...p, seat: i, colour: SEATS[i], pos: 0, tile: undefined, falls: 0, steps: 0, stunUntil: 0, streak: 0,
      memory: p.me ? null : rows.map(() => random() < level.memory),
      pace: p.me ? 0 : level.pace * (0.85 + random() * 0.4),
      think: seeded(seed + 101 * (i + 1)),
    }));
    return { level, levelId, mode: MODES[modeId] ? modeId : 'race', seed, rows, players, turn: 0, phase: 'preview', winner: null, glows: new Map(), peek: -1, turns: 0, startedAt: 0, helps: { eye: 1, shield: 1 }, shieldOn: false };
  }
  const me = () => game.players.find((p) => p.me);
  const choices = (pos) => game.rows[pos].colours.map((_, c) => c).filter((c) => !game.rows[pos].broken.has(c));
  const canTap = () => game?.phase === 'play' && (game.mode === 'race' ? now() >= me().stunUntil && me().pos < game.rows.length : game.players[game.turn] === me());

  /* ---------------------------------------------------------------- drawing */
  function drawPlayers() {
    const box = $('brPlayers'); box.replaceChildren();
    for (const p of game.players) {
      const li = doc.createElement('li');
      const turn = game.mode === 'turns' && game.players[game.turn] === p && game.phase === 'play';
      li.className = 'br-seat' + (p.me ? ' is-me' : '') + (turn ? ' is-turn' : '') + (now() < p.stunUntil ? ' is-down' : '');
      li.style.setProperty('--seat', p.colour);
      li.style.setProperty('--progress', String(p.pos / game.rows.length));
      const dot = doc.createElement('i'); dot.textContent = p.name.slice(0, 1);
      const name = doc.createElement('b'); name.textContent = p.me ? 'أنت' : p.name;
      const where = doc.createElement('small'); where.textContent = p.pos >= game.rows.length ? 'عبر 🏁' : p.pos + ' / ' + game.rows.length;
      const bar = doc.createElement('span'); bar.className = 'br-bar';
      li.append(dot, name, where, bar); box.append(li);
    }
  }
  function pawn(p) {
    const el = doc.createElement('span');
    el.className = 'br-pawn' + (p.me ? ' is-me' : '');
    el.style.setProperty('--seat', p.colour);
    el.textContent = p.name.slice(0, 1);
    el.setAttribute('aria-hidden', 'true');
    return el;
  }
  // the board is built once per game and then only updated: a tile is never replaced under a finger
  let view = null;
  function buildBoard() {
    const board = $('brBoard'); board.replaceChildren();
    board.style.setProperty('--cols', game.level.cols);
    board.style.setProperty('--rows', game.rows.length);
    const bank = (cls, text) => { const el = doc.createElement('div'); el.className = 'br-bank ' + cls; el.append(Object.assign(doc.createElement('b'), { textContent: text })); return el; };
    view = { game, goal: bank('br-goal', 'الضفة الثانية'), start: bank('br-start', 'البداية'), lines: [], tiles: [], pawns: game.players.map(pawn) };
    board.append(view.goal);
    for (let r = game.rows.length - 1; r >= 0; r--) {
      const row = game.rows[r], line = doc.createElement('div');
      line.className = 'br-row';
      line.setAttribute('role', 'group');
      line.setAttribute('aria-label', 'الصف ' + (r + 1));
      view.lines[r] = line; view.tiles[r] = [];
      row.colours.forEach(([, colour], c) => {
        const tile = doc.createElement('button');
        tile.type = 'button'; tile.className = 'br-tile';
        tile.style.setProperty('--tile', colour);
        tile.dataset.row = r; tile.dataset.col = c;
        view.tiles[r][c] = tile; line.append(tile);
      });
      board.append(line);
    }
    board.append(view.start);
  }
  function drawBoard() {
    if (!view || view.game !== game) buildBoard();
    const p = me(), tap = canTap(), t = now();
    game.rows.forEach((row, r) => {
      view.lines[r].classList.toggle('is-next', Boolean(tap && p.pos === r));
      row.colours.forEach(([name], c) => {
        const tile = view.tiles[r][c], broken = row.broken.has(c), glow = game.glows.get(r + ':' + c);
        tile.classList.toggle('is-broken', broken);
        tile.classList.toggle('is-safe', (game.phase === 'preview' && row.revealed && row.safe === c) || (game.peek >= 0 && r >= game.peek && r < game.peek + 3 && row.safe === c));
        tile.classList.toggle('is-glow', Boolean(glow && glow > t));
        tile.disabled = !(tap && p.pos === r && !broken);
        tile.setAttribute('aria-label', 'الصف ' + (r + 1) + '، البلاطة ال' + name + (broken ? '، مكسورة' : ''));
      });
    });
    game.players.forEach((pl, i) => {
      const el = view.pawns[i];
      const home = pl.pos >= game.rows.length ? view.goal : pl.pos === 0 ? view.start : view.tiles[pl.pos - 1][pl.tile] || view.start;
      if (el.parentElement !== home) home.append(el);
      el.classList.toggle('is-down', t < pl.stunUntil);
    });
    $('brEye').disabled = !(game.phase === 'play' && game.helps.eye > 0 && p.pos < game.rows.length);
    $('brShield').disabled = !(game.phase === 'play' && game.helps.shield > 0 && !game.shieldOn);
    $('brEye').querySelector('small').textContent = String(game.helps.eye);
    $('brShield').querySelector('small').textContent = game.shieldOn ? 'مفعّل' : String(game.helps.shield);
    $('brShield').classList.toggle('is-on', game.shieldOn);
  }
  function say(text) { $('brStatus').textContent = text; }
  function draw() { drawPlayers(); drawBoard(); }

  /* ---------------------------------------------------------------- effects */
  function shards(tile, colour) {
    if (reduce || !tile) return;
    const box = tile.getBoundingClientRect(), layer = $('brFx');
    for (let i = 0; i < 10; i++) {
      const s = doc.createElement('i'); s.className = 'br-shard';
      s.style.left = (box.left + box.width / 2) + 'px'; s.style.top = (box.top + box.height / 2) + 'px';
      s.style.setProperty('--c', colour);
      s.style.setProperty('--dx', (Math.random() * 160 - 80).toFixed(0) + 'px');
      s.style.setProperty('--dy', (Math.random() * 140 + 40).toFixed(0) + 'px');
      s.style.setProperty('--r', (Math.random() * 540 - 270).toFixed(0) + 'deg');
      layer.append(s); setTimeout(() => s.remove(), 900);
    }
  }
  function drop(p, tile) {
    if (reduce || !tile) return;
    const box = tile.getBoundingClientRect(), ghost = pawn(p);
    ghost.classList.add('br-falling');
    ghost.style.left = (box.left + box.width / 2) + 'px'; ghost.style.top = (box.top + box.height / 2) + 'px';
    $('brFx').append(ghost); setTimeout(() => ghost.remove(), 800);
  }
  function float(text, tone = '') {
    const el = doc.createElement('div'); el.className = 'br-float ' + tone; el.textContent = text;
    $('brFx').append(el); setTimeout(() => el.remove(), 1200);
  }
  function confetti() {
    if (reduce) return;
    const layer = $('brFx'), colours = ['#ffcc3e', '#ff4d6d', '#3fa7ff', '#2fd6a1', '#b57cff', '#ff8a3d'];
    for (let i = 0; i < 46; i++) {
      const c = doc.createElement('i'); c.className = 'br-confetti';
      c.style.left = (Math.random() * 100) + 'vw'; c.style.setProperty('--c', colours[i % colours.length]);
      c.style.setProperty('--d', (1.6 + Math.random() * 1.4).toFixed(2) + 's'); c.style.setProperty('--x', (Math.random() * 120 - 60).toFixed(0) + 'px');
      c.style.animationDelay = (Math.random() * 0.4).toFixed(2) + 's';
      layer.append(c); setTimeout(() => c.remove(), 3600);
    }
  }

  /* ---------------------------------------------------------------- moving */
  function rivalChoice(p) {
    const row = game.rows[p.pos], free = choices(p.pos);
    const knows = p.memory[p.pos] || (row.seen && p.think() < game.level.recall);
    if (knows && free.includes(row.safe)) return row.safe;
    return free[Math.floor(p.think() * free.length)];
  }
  function step(p, c) {
    if (game?.phase !== 'play' || p.pos >= game.rows.length) return;
    const r = p.pos, row = game.rows[r], tile = view.tiles[r][c];
    if (row.broken.has(c)) return;
    p.steps++;
    if (c === row.safe) {
      row.seen = true;
      p.pos = r + 1; p.tile = c; p.streak++;
      game.glows.set(r + ':' + c, now() + 900);
      later(920, () => { if (game) drawBoard(); });
      if (p.me) { sounds.step(p.streak); buzz(12); if (p.streak >= 3 && p.streak % 3 === 0) float(p.streak + ' ورا بعض! 🔥', 'hot'); }
      else if (game.mode === 'turns') sounds.step(0);
      if (p.pos >= game.rows.length) return finish(p);
      if (p.me && game.mode === 'race') say('كمّل! الصف ' + (p.pos + 1) + ' من ' + game.rows.length);
      else if (game.mode === 'turns') say((p.me ? 'ثابتة! ' : p.name + ' عدّى الصف ' + (r + 1) + ' ') + '✦');
    } else if (p.me && game.shieldOn) {
      row.broken.add(c); game.shieldOn = false;
      sounds.crack(); sounds.shield(); shards(tile, row.colours[c][1]); float('🛡 الدرع حماك!', 'good');
      say('انكسرت، بس الدرع ثبّتك مكانك');
    } else {
      row.broken.add(c);
      p.falls++; p.streak = 0;
      sounds.crack(); shards(tile, row.colours[c][1]);
      if (p.me) { sounds.fall(); buzz([40, 30, 60]); drop(p, tile); $('brGame').classList.toggle('is-shake', !reduce); later(450, () => $('brGame')?.classList.remove('is-shake')); }
      p.pos = 0; p.tile = undefined;
      if (game.mode === 'race') p.stunUntil = now() + STUN_MS;
      say(p.me ? (game.mode === 'race' ? 'طحت! ترجع للبداية…' : 'انكسرت! ترجع للبداية') : 'انكسرت تحت ' + p.name + '، رجع للبداية');
      if (p.me && game.mode === 'race') later(STUN_MS + 20, () => { if (game?.phase === 'play') { say('يلا من جديد! تذكّر المكسور'); draw(); } });
    }
    draw();
    report();
  }

  /* ---------------------------------------------------------------- race: everyone at once */
  function raceRival(p) {
    if (game?.phase !== 'play' || p.pos >= game.rows.length) return;
    const wait = Math.max(0, p.stunUntil - now());
    later(wait + p.pace * (0.75 + p.think() * 0.5), () => {
      if (game?.phase !== 'play') return;
      if (now() < p.stunUntil) return raceRival(p);
      step(p, rivalChoice(p));
      raceRival(p);
    });
  }

  /* ---------------------------------------------------------------- turns: one step each */
  let turnTimer = 0, tick = 0;
  function clearTurn() { clearTimeout(turnTimer); clearInterval(tick); $('brClock').style.setProperty('--left', '1'); }
  function nextTurn() {
    clearTurn();
    if (game?.phase !== 'play') return;
    game.turns++;
    game.turn = (game.turn + 1) % game.players.length;
    beginTurn();
  }
  function beginTurn() {
    const p = game.players[game.turn];
    draw();
    if (p.me) {
      say('دورك · اختر بلاطة من الصف ' + (p.pos + 1));
      sounds.turn();
      const started = Date.now();
      tick = setInterval(() => $('brClock').style.setProperty('--left', String(Math.max(0, 1 - (Date.now() - started) / TURN_MS))), 100);
      turnTimer = setTimeout(() => { const free = choices(p.pos); take(free[Math.floor(Math.random() * free.length)]); }, TURN_MS);
    } else {
      say('دور ' + p.name + '…');
      turnTimer = setTimeout(() => { step(p, rivalChoice(p)); if (game?.phase === 'play') later(reduce ? 250 : 520, nextTurn); }, reduce ? 260 : 420 + Math.random() * 380);
    }
  }

  /* ---------------------------------------------------------------- the player's tap */
  let lastTap = 0;
  function take(c) {
    if (!canTap()) return;
    if (game.mode === 'race') {
      if (now() - lastTap < STEP_MS) return;
      lastTap = now();
      step(me(), c);
      return;
    }
    clearTurn();
    step(me(), c);
    if (game?.phase === 'play') later(reduce ? 250 : 560, nextTurn);
  }

  /* ---------------------------------------------------------------- helps */
  function eye() {
    if (game?.phase !== 'play' || game.helps.eye < 1) return;
    game.helps.eye--; game.peek = me().pos; sounds.power(); float('👁 عين الصقر', 'good');
    draw();
    later(1100, () => { if (game) { game.peek = -1; draw(); } });
  }
  function shield() {
    if (game?.phase !== 'play' || game.helps.shield < 1 || game.shieldOn) return;
    game.helps.shield--; game.shieldOn = true; sounds.shield(); float('🛡 الدرع جاهز', 'good');
    draw();
  }

  /* ---------------------------------------------------------------- start and finish */
  function start(levelId, modeId) {
    clearTimers(); clearTurn();
    const seed = link ? link.local.seed : (Math.random() * 4294967296) >>> 0;
    game = newGame(link ? link.local.level : levelId, link ? 'race' : modeId, seed);
    doc.body.classList.add('br-running');
    doc.body.classList.toggle('br-race', game.mode === 'race');
    $('brIntro').hidden = true; $('brGame').hidden = false; $('brResult').hidden = true;
    $('brLevel').textContent = MODES[game.mode] + ' · ' + game.level.label + ' · ' + game.rows.length + ' صفوف';
    link?.live?.();
    view = null;
    draw();
    // the safe way lights up, row by row from the near bank, then stays a moment
    const sweep = reduce ? 0 : Math.min(150, Math.floor(game.level.preview / 2 / game.rows.length));
    game.rows.forEach((row, r) => later(r * sweep, () => { row.revealed = true; sounds.reveal(r); drawBoard(); }));
    let left = Math.ceil(game.level.preview / 1000);
    say('احفظ الطريق الآمن · ' + left);
    const count = setInterval(() => { left--; if (left > 0) say('احفظ الطريق الآمن · ' + left); else clearInterval(count); }, 1000);
    timers.push(count);
    later(game.level.preview, () => {
      clearInterval(count);
      game.phase = 'play'; game.startedAt = now();
      game.rows.forEach((row) => { row.revealed = false; });
      if (game.mode === 'race') {
        say('انطلق! 🏃 أول واحد يعبر يفوز');
        sounds.turn();
        game.players.filter((p) => !p.me).forEach(raceRival);
        draw();
      } else {
        say('يلا! كل واحد خطوة بدوره');
        beginTurn();
      }
    });
    $('brGame').scrollIntoView({ block: 'start' });
  }

  function finish(winner) {
    clearTimers(); clearTurn();
    game.phase = 'over'; game.winner = winner;
    draw();
    const p = me(), won = winner.me, secs = ((now() - game.startedAt) / 1000).toFixed(1);
    (won ? sounds.win : sounds.lose)();
    if (won) confetti();
    const ranked = [...game.players].sort((a, b) => (b === winner) - (a === winner) || b.pos - a.pos || a.falls - b.falls);
    $('brResultTitle').textContent = won ? 'عبرت الجسر أول واحد! 🏆' : winner.name + ' عبر قبلك';
    $('brResultNote').textContent = won ? (game.mode === 'race' ? 'بـ ' + secs + ' ثانية · ' : '') + p.falls + ' سقطات' : 'وصلت للصف ' + p.pos + ' من ' + game.rows.length;
    const list = $('brRanks'); list.replaceChildren();
    ranked.forEach((pl, i) => {
      const li = doc.createElement('li'); li.className = pl.me ? 'is-me' : '';
      li.style.setProperty('--seat', pl.colour);
      const n = doc.createElement('b'); n.textContent = (i + 1) + '. ' + (pl.me ? 'أنت' : pl.name);
      const s = doc.createElement('small'); s.textContent = pl === winner ? 'عبر الجسر' : 'الصف ' + pl.pos + ' · ' + pl.falls + ' سقطات';
      li.append(n, s); list.append(li);
    });
    later(won ? 900 : 500, () => { $('brResult').hidden = false; if (!$('brAgain').hidden) $('brAgain').focus(); });
    $('brAgain').hidden = Boolean(link);
    report(true);
  }

  function report(done = false) {
    if (!link || !game) return;
    const p = me(), won = game.winner === p;
    const progress = won ? 1 : p.pos / game.rows.length;
    // crossing first, then the fewest falls and steps, is the best result
    const score = Math.round(progress * 1000) + (won ? 4000 - Math.min(2000, p.falls * 250 + p.steps * 20) : 0);
    link.report({ progress, score, mistakes: p.falls, done: done || game.phase === 'over', won });
  }

  /* ---------------------------------------------------------------- the page */
  function init() {
    let level = LEVELS[store.get('bs-bridge-level')] ? store.get('bs-bridge-level') : 'standard';
    let mode = MODES[store.get('bs-bridge-mode')] ? store.get('bs-bridge-mode') : 'race';
    const paint = () => {
      doc.querySelectorAll('[data-br-level]').forEach((b) => { const on = b.dataset.brLevel === level; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); });
      doc.querySelectorAll('[data-br-mode]').forEach((b) => { const on = b.dataset.brMode === mode; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); });
    };
    doc.querySelectorAll('[data-br-level]').forEach((b) => b.addEventListener('click', () => { level = b.dataset.brLevel; store.set('bs-bridge-level', level); paint(); }));
    doc.querySelectorAll('[data-br-mode]').forEach((b) => b.addEventListener('click', () => { mode = b.dataset.brMode; store.set('bs-bridge-mode', mode); paint(); }));
    paint();
    $('brPlay').addEventListener('click', () => start(level, mode));
    $('brAgain').addEventListener('click', () => start(level, mode));
    $('brQuit').addEventListener('click', () => { clearTimers(); clearTurn(); game = null; doc.body.classList.remove('br-running', 'br-race'); $('brGame').hidden = true; $('brResult').hidden = true; $('brIntro').hidden = false; });
    $('brBoard').addEventListener('click', (event) => {
      const tile = event.target.closest('.br-tile');
      if (!tile || tile.disabled || !game) return;
      if (Number(tile.dataset.row) === me().pos) take(Number(tile.dataset.col));
    });
    $('brEye').addEventListener('click', eye);
    $('brShield').addEventListener('click', shield);
    const sound = $('brSound');
    const paintSound = () => { sound.textContent = muted ? '🔇' : '🔊'; sound.setAttribute('aria-pressed', String(!muted)); };
    sound.addEventListener('click', () => { muted = !muted; store.set('bs-new-games-mute', muted ? '1' : '0'); paintSound(); });
    paintSound();
    if (link) { $('brIntro').querySelector('.br-levels').hidden = true; $('brIntro').querySelector('.br-modes').hidden = true; start(link.local.level, 'race'); }
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})();
