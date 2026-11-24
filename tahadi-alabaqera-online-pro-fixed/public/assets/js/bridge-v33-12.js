/* لعبة العباقرة 33.12.0 — «جسر الألوان».
   A bridge of coloured glass: one tile in every row holds, the others break. The safe way
   shows for a moment at the start, then everyone crosses in turn, a row at a time. A safe
   step glows for a second and goes back to looking like the rest, a wrong one breaks for
   good and sends its player back to the start. The first across wins.
   In a group room (الغرف) every player gets the same bridge (the room's seed) and the
   page reports how far its player got. */
(function () {
  'use strict';
  const doc = document, $ = (id) => doc.getElementById(id);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LEVELS = Object.freeze({
    casual: { label: 'سهل', rows: 8, cols: 2, preview: 3400, memory: 0.5, recall: 0.8 },
    standard: { label: 'متوسط', rows: 10, cols: 3, preview: 2800, memory: 0.62, recall: 0.86 },
    expert: { label: 'صعب', rows: 12, cols: 4, preview: 2200, memory: 0.76, recall: 0.92 },
  });
  const PALETTE = Object.freeze([
    ['أحمر', '#ff4d6d'], ['أزرق', '#3fa7ff'], ['أخضر', '#2fd6a1'], ['ذهبي', '#ffc83d'], ['بنفسجي', '#b57cff'], ['برتقالي', '#ff8a3d'],
  ]);
  const RIVALS = Object.freeze(['فهد', 'نورة', 'سارة', 'ماجد', 'خالد', 'ريم', 'بدر', 'لطيفة', 'سعود', 'منيرة']);
  const SEATS = Object.freeze(['#ffcc3e', '#3fa7ff', '#ff4d6d', '#2fd6a1']);
  const TURN_MS = 15000;
  const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };
  const link = window.BS_PARTY_LINK?.local ? window.BS_PARTY_LINK : null;

  function seeded(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }
  const shuffle = (list, random) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const myName = () => String(link?.name || store.get('bs-player-name-v33') || store.get('bs_player_name') || 'أنت').trim().slice(0, 16) || 'أنت';

  /* ---------------------------------------------------------------- sound */
  let audio = null, muted = store.get('bs-new-games-mute') === '1';
  function tone(freq, ms, type = 'sine', gain = 0.06, when = 0) {
    if (muted) return;
    try {
      audio ??= new (window.AudioContext || window.webkitAudioContext)();
      const t = audio.currentTime + when, o = audio.createOscillator(), g = audio.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
      o.connect(g).connect(audio.destination); o.start(t); o.stop(t + ms / 1000 + 0.02);
    } catch { /* no sound on this device */ }
  }
  const sounds = {
    step() { tone(660, 160, 'triangle'); tone(990, 140, 'triangle', 0.04, 0.06); },
    crack() { tone(180, 260, 'sawtooth', 0.05); tone(120, 340, 'square', 0.03, 0.05); },
    turn() { tone(520, 90, 'sine', 0.035); },
    win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 220, 'triangle', 0.06, i * 0.12)); },
    lose() { [392, 330, 262].forEach((f, i) => tone(f, 240, 'sine', 0.05, i * 0.14)); },
  };

  /* ---------------------------------------------------------------- the game */
  let game = null, timer = 0, tick = 0;

  function newGame(levelId, seed) {
    const level = LEVELS[levelId] || LEVELS.standard, random = seeded(seed);
    const rows = [];
    for (let r = 0; r < level.rows; r++) {
      const colours = shuffle(PALETTE, random).slice(0, level.cols);
      rows.push({ colours, safe: Math.floor(random() * level.cols), broken: new Set() });
    }
    const rivals = shuffle(RIVALS, seeded(seed ^ 0x9e3779b9)).slice(0, 3);
    const players = [{ name: myName(), me: true }, ...rivals.map((name) => ({ name, me: false }))].map((p, i) => ({
      ...p, seat: i, colour: SEATS[i], pos: 0, falls: 0, steps: 0,
      // what each rival kept from the start: some rows, not all
      memory: p.me ? null : rows.map(() => random() < level.memory),
    }));
    return { level, levelId, seed, rows, players, turn: 0, phase: 'preview', winner: null, glow: null, turns: 0, startedAt: Date.now() };
  }

  /* ---------------------------------------------------------------- drawing */
  function drawPlayers() {
    const box = $('brPlayers'); box.replaceChildren();
    for (const p of game.players) {
      const li = doc.createElement('li');
      li.className = 'br-seat' + (p.me ? ' is-me' : '') + (game.players[game.turn] === p && game.phase === 'play' ? ' is-turn' : '');
      li.style.setProperty('--seat', p.colour);
      const dot = doc.createElement('i'); dot.textContent = p.name.slice(0, 1);
      const name = doc.createElement('b'); name.textContent = p.me ? 'أنت' : p.name;
      const where = doc.createElement('small'); where.textContent = p.pos >= game.rows.length ? 'عبر الجسر' : 'الصف ' + p.pos + ' / ' + game.rows.length;
      li.append(dot, name, where); box.append(li);
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
    view = { goal: bank('br-goal', 'الضفة الثانية'), start: bank('br-start', 'البداية'), lines: [], tiles: [], pawns: game.players.map(pawn), key: '' };
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
    if (!view || view.game !== game) { buildBoard(); view.game = game; }
    const me = game.players.find((p) => p.me), current = game.players[game.turn];
    const mine = game.phase === 'play' && current?.me;
    game.rows.forEach((row, r) => {
      view.lines[r].classList.toggle('is-next', Boolean(mine && me.pos === r));
      row.colours.forEach(([name], c) => {
        const tile = view.tiles[r][c], broken = row.broken.has(c);
        tile.classList.toggle('is-broken', broken);
        tile.classList.toggle('is-safe', game.phase === 'preview' && row.safe === c);
        tile.classList.toggle('is-glow', Boolean(game.glow && game.glow.r === r && game.glow.c === c));
        tile.disabled = !(mine && me.pos === r && !broken);
        tile.setAttribute('aria-label', 'الصف ' + (r + 1) + '، البلاطة ال' + name + (broken ? '، مكسورة' : ''));
      });
    });
    game.players.forEach((p, i) => {
      const el = view.pawns[i];
      const home = p.pos >= game.rows.length ? view.goal : p.pos === 0 ? view.start : view.tiles[p.pos - 1][p.tile] || view.start;
      if (el.parentElement !== home) home.append(el);
    });
  }

  function say(text) { $('brStatus').textContent = text; }
  function draw() { drawPlayers(); drawBoard(); }

  /* ---------------------------------------------------------------- turns */
  function clearTimers() { clearTimeout(timer); clearInterval(tick); $('brClock').style.setProperty('--left', '1'); }

  function nextTurn() {
    clearTimers();
    if (game.phase !== 'play') return;
    game.turns++;
    let next = game.turn;
    for (let i = 0; i < game.players.length; i++) { next = (next + 1) % game.players.length; if (game.players[next].pos < game.rows.length) break; }
    game.turn = next;
    beginTurn();
  }

  function beginTurn() {
    const p = game.players[game.turn];
    draw();
    if (p.me) {
      say('دورك · اختر بلاطة من الصف ' + (p.pos + 1));
      sounds.turn();
      const started = Date.now();
      tick = setInterval(() => { $('brClock').style.setProperty('--left', String(Math.max(0, 1 - (Date.now() - started) / TURN_MS))); }, 100);
      timer = setTimeout(() => { const free = choices(p.pos); step(p, free[Math.floor(Math.random() * free.length)]); }, TURN_MS);
      const first = $('brBoard').querySelector('.br-row.is-next .br-tile:not(:disabled)');
      if (first && doc.activeElement?.classList?.contains('br-tile')) first.focus();
    } else {
      say('دور ' + p.name + '…');
      timer = setTimeout(() => step(p, rivalChoice(p)), reduce ? 350 : 650 + Math.random() * 650);
    }
  }

  const choices = (pos) => game.rows[pos].colours.map((_, c) => c).filter((c) => !game.rows[pos].broken.has(c));

  function rivalChoice(p) {
    const row = game.rows[p.pos], free = choices(p.pos);
    // the start's preview, or a step somebody already made safely on this row
    const knows = (p.memory[p.pos] || (row.seen && Math.random() < game.level.recall));
    if (knows && free.includes(row.safe)) return row.safe;
    return free[Math.floor(Math.random() * free.length)];
  }

  function step(p, c) {
    if (game.phase !== 'play' || game.players[game.turn] !== p) return;
    clearTimers();
    const r = p.pos, row = game.rows[r];
    p.steps++;
    if (c === row.safe) {
      row.seen = true;
      p.pos = r + 1; p.tile = c;
      game.glow = { r, c };
      sounds.step();
      if (p.pos >= game.rows.length) return finish(p);
      say((p.me ? 'ثابتة! ' : p.name + ' عدّى الصف ' + (r + 1) + ' ') + '✦');
      draw();
      setTimeout(() => { if (game?.glow?.r === r) { game.glow = null; draw(); } }, reduce ? 500 : 1000);
      report();
      setTimeout(nextTurn, reduce ? 450 : 900);
    } else {
      row.broken.add(c);
      p.falls++; p.pos = 0; p.tile = undefined;
      sounds.crack();
      say(p.me ? 'انكسرت! ترجع للبداية' : 'انكسرت تحت ' + p.name + '، رجع للبداية');
      const tile = $('brBoard').querySelector(`.br-tile[data-row="${r}"][data-col="${c}"]`);
      if (tile && !reduce) { tile.classList.add('is-cracking'); setTimeout(() => tile.classList.remove('is-cracking'), 820); }
      $('brGame').classList.toggle('is-shake', p.me && !reduce);
      setTimeout(() => { $('brGame').classList.remove('is-shake'); draw(); report(); nextTurn(); }, reduce ? 450 : 900);
    }
  }

  /* ---------------------------------------------------------------- start and finish */
  function start(levelId) {
    clearTimers();
    const seed = link ? link.local.seed : (Math.random() * 4294967296) >>> 0;
    game = newGame(link ? link.local.level : levelId, seed);
    doc.body.classList.add('br-running');
    $('brIntro').hidden = true; $('brGame').hidden = false; $('brResult').hidden = true;
    $('brLevel').textContent = game.level.label + ' · ' + game.rows.length + ' صفوف';
    link?.live?.();
    draw();
    // the safe way shows for a moment
    let left = Math.ceil(game.level.preview / 1000);
    say('احفظ الطريق الآمن · ' + left);
    const count = setInterval(() => { left--; if (left > 0) say('احفظ الطريق الآمن · ' + left); }, 1000);
    timer = setTimeout(() => {
      clearInterval(count);
      game.phase = 'play';
      say('يلا! كل واحد خطوة بدوره');
      beginTurn();
    }, game.level.preview);
    $('brGame').scrollIntoView({ block: 'start' });
  }

  function finish(winner) {
    clearTimers();
    game.phase = 'over'; game.winner = winner;
    draw();
    const me = game.players.find((p) => p.me), won = winner.me;
    (won ? sounds.win : sounds.lose)();
    const ranked = [...game.players].sort((a, b) => (b === winner) - (a === winner) || b.pos - a.pos || a.falls - b.falls);
    $('brResultTitle').textContent = won ? 'عبرت الجسر أول واحد!' : winner.name + ' عبر قبلك';
    $('brResultNote').textContent = won ? 'ذاكرة حديد · ' + me.falls + ' سقطات' : 'وصلت للصف ' + me.pos + ' من ' + game.rows.length;
    const list = $('brRanks'); list.replaceChildren();
    ranked.forEach((p, i) => {
      const li = doc.createElement('li'); li.className = p.me ? 'is-me' : '';
      li.style.setProperty('--seat', p.colour);
      const n = doc.createElement('b'); n.textContent = (i + 1) + '. ' + (p.me ? 'أنت' : p.name);
      const s = doc.createElement('small'); s.textContent = p === winner ? 'عبر الجسر' : 'الصف ' + p.pos + ' · ' + p.falls + ' سقطات';
      li.append(n, s); list.append(li);
    });
    $('brResult').hidden = false;
    $('brAgain').hidden = Boolean(link);
    report(true);
    setTimeout(() => $('brAgain').hidden ? null : $('brAgain').focus(), 50);
  }

  function report(done = false) {
    if (!link || !game) return;
    const me = game.players.find((p) => p.me), won = game.winner === me;
    const progress = won ? 1 : me.pos / game.rows.length;
    // crossing first, then the fewest falls and steps, is the best result
    const score = Math.round(progress * 1000) + (won ? 4000 - Math.min(2000, me.falls * 250 + me.steps * 20) : 0);
    link.report({ progress, score, mistakes: me.falls, done: done || game.phase === 'over', won });
  }

  /* ---------------------------------------------------------------- the page */
  function init() {
    const saved = store.get('bs-bridge-level');
    let level = LEVELS[saved] ? saved : 'standard';
    const paint = () => doc.querySelectorAll('[data-br-level]').forEach((b) => { const on = b.dataset.brLevel === level; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); });
    doc.querySelectorAll('[data-br-level]').forEach((b) => b.addEventListener('click', () => { level = b.dataset.brLevel; store.set('bs-bridge-level', level); paint(); }));
    paint();
    $('brPlay').addEventListener('click', () => start(level));
    $('brAgain').addEventListener('click', () => start(level));
    $('brQuit').addEventListener('click', () => { clearTimers(); game = null; doc.body.classList.remove('br-running'); $('brGame').hidden = true; $('brResult').hidden = true; $('brIntro').hidden = false; });
    $('brBoard').addEventListener('click', (event) => {
      const tile = event.target.closest('.br-tile');
      if (!tile || tile.disabled || !game) return;
      const me = game.players[game.turn];
      if (me?.me && Number(tile.dataset.row) === me.pos) step(me, Number(tile.dataset.col));
    });
    const sound = $('brSound');
    const paintSound = () => { sound.textContent = muted ? '🔇' : '🔊'; sound.setAttribute('aria-pressed', String(!muted)); };
    sound.addEventListener('click', () => { muted = !muted; store.set('bs-new-games-mute', muted ? '1' : '0'); paintSound(); });
    paintSound();
    if (link) { $('brIntro').querySelector('.br-levels').hidden = true; start(link.local.level); }
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})();
