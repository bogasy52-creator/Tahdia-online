/* لعبة العباقرة 33.12.0 — «عشر ثواني».
   Stop the clock at exactly ten seconds, without seeing it. Six players; after each round
   the one farthest from ten seconds leaves. Every round hides the clock sooner, and the later
   rounds tick at the wrong speed on purpose. Last one standing wins.
   In a group room (الغرف) everyone gets the same rounds and rivals (the room's seed) and the
   page reports how far its player got. */
(function () {
  'use strict';
  const doc = document, $ = (id) => doc.getElementById(id);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TARGET = 10000, LIMIT = 20000;
  const LEVELS = Object.freeze({
    casual: { label: 'سهل', spread: 900 },
    standard: { label: 'متوسط', spread: 600 },
    expert: { label: 'صعب', spread: 360 },
  });
  // how each round plays: when the count disappears, and how fast the ticks lie
  const ROUNDS = Object.freeze([
    { hideAt: 5000, tick: 1000, note: 'العدّاد يختفي بعد 5 ثواني' },
    { hideAt: 3000, tick: 1000, note: 'يختفي بعد 3 ثواني' },
    { hideAt: 1000, tick: 1000, note: 'ما تشوف إلا أول ثانية' },
    { hideAt: 1000, tick: 820, note: 'انتبه: التكتكة أسرع من الوقت' },
    { hideAt: 0, tick: 1230, note: 'بدون عدّاد، والتكتكة أبطأ' },
  ]);
  const RIVALS = Object.freeze(['فهد', 'نورة', 'سارة', 'ماجد', 'خالد', 'ريم', 'بدر', 'لطيفة', 'سعود', 'منيرة', 'حمد', 'دانة']);
  const SEATS = Object.freeze(['#ffcc3e', '#3fa7ff', '#ff4d6d', '#2fd6a1', '#b57cff', '#ff8a3d']);
  const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };
  const link = window.BS_PARTY_LINK?.local ? window.BS_PARTY_LINK : null;
  function seeded(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }
  const shuffle = (list, random) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const gauss = (random) => { let u = 0, v = 0; while (!u) u = random(); while (!v) v = random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const myName = () => String(link?.name || store.get('bs-player-name-v33') || store.get('bs_player_name') || 'أنت').trim().slice(0, 16) || 'أنت';
  const secs = (ms) => (ms / 1000).toFixed(2);

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
    tick() { tone(1400, 40, 'square', 0.025); },
    count() { tone(660, 120, 'triangle', 0.05); },
    go() { tone(990, 220, 'triangle', 0.06); },
    stop() { tone(440, 120, 'sine', 0.07); },
    out() { [392, 311].forEach((f, i) => tone(f, 220, 'sine', 0.05, i * 0.15)); },
    win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 220, 'triangle', 0.06, i * 0.12)); },
  };

  /* ---------------------------------------------------------------- the game */
  let game = null, frame = 0, ticker = 0, later = [];
  const after = (ms, fn) => { const id = setTimeout(fn, ms); later.push(id); return id; };
  const stopAll = () => { later.forEach(clearTimeout); later = []; cancelAnimationFrame(frame); clearTimeout(ticker); };

  function newGame(levelId, seed) {
    const level = LEVELS[levelId] || LEVELS.standard, random = seeded(seed);
    const names = shuffle(RIVALS, random).slice(0, 5);
    const players = [{ name: myName(), me: true }, ...names.map((name) => ({ name, me: false }))].map((p, i) => ({
      ...p, colour: SEATS[i], out: false, outRound: 0, last: null, total: 0,
      // a rival is steadier or shakier than the level's average
      skill: p.me ? 1 : 0.7 + random() * 0.6,
    }));
    return { level, levelId, seed, random, players, round: 0, phase: 'ready', startedAt: 0, mine: null };
  }

  /* ---------------------------------------------------------------- drawing */
  function drawSeats(worst, best) {
    const box = $('tsPlayers'); box.replaceChildren();
    for (const p of game.players) {
      const li = doc.createElement('li');
      li.className = 'ts-seat' + (p.me ? ' is-me' : '') + (p.out ? ' is-out' : '') + (p === worst ? ' is-worst' : '') + (p === best ? ' is-best' : '');
      li.style.setProperty('--seat', p.colour);
      const dot = doc.createElement('i'); dot.textContent = p.name.slice(0, 1);
      const copy = doc.createElement('span');
      const name = doc.createElement('b'); name.textContent = p.me ? 'أنت' : p.name;
      const time = doc.createElement('small'); time.textContent = p.out ? 'طلع' : p.last == null ? '—' : secs(p.last) + 's';
      copy.append(name, time); li.append(dot, copy); box.append(li);
    }
  }
  const alive = () => game.players.filter((p) => !p.out);

  /* ---------------------------------------------------------------- a round */
  function nextRound() {
    stopAll();
    const plan = ROUNDS[Math.min(game.round, ROUNDS.length - 1)];
    game.round++; game.phase = 'count'; game.mine = null;
    game.players.forEach((p) => { if (!p.out) p.last = null; });
    drawSeats();
    $('tsRound').textContent = 'الجولة ' + game.round + ' · ' + plan.note;
    $('tsVerdict').textContent = ''; $('tsVerdict').className = 'ts-verdict';
    $('tsNext').hidden = true;
    const count = $('tsCount'), dial = $('tsDial'), press = $('tsPress');
    count.classList.remove('is-hidden', 'is-fake'); dial.style.setProperty('--p', '0');
    press.disabled = true; press.textContent = 'استعد';
    // 3, 2, 1, then the clock runs
    let n = 3; count.textContent = String(n); sounds.count();
    const step = () => {
      n--;
      if (n > 0) { count.textContent = String(n); sounds.count(); after(800, step); return; }
      run(plan);
    };
    after(800, step);
  }

  function run(plan) {
    const count = $('tsCount'), dial = $('tsDial'), press = $('tsPress');
    game.phase = 'run'; game.startedAt = performance.now();
    press.disabled = false; press.textContent = 'وقّف!'; press.focus({ preventScroll: true });
    sounds.go();
    count.textContent = '0';
    let ticks = 0;
    const tick = () => { ticks++; sounds.tick(); if (plan.tick !== 1000 && plan.hideAt <= 1000 && !reduce && ticks > 1 && game.random() < 0.35) { count.classList.add('is-fake'); count.classList.remove('is-hidden'); count.textContent = String(ticks); after(220, () => { count.classList.add('is-hidden'); count.classList.remove('is-fake'); }); } ticker = setTimeout(tick, plan.tick); };
    ticker = setTimeout(tick, plan.tick);
    const paint = () => {
      const t = performance.now() - game.startedAt;
      if (t < plan.hideAt) { count.textContent = String(Math.floor(t / 1000)); dial.style.setProperty('--p', String(Math.min(1, t / TARGET))); }
      else if (!count.classList.contains('is-hidden') && !count.classList.contains('is-fake')) { count.classList.add('is-hidden'); dial.style.setProperty('--p', '0'); }
      if (t >= LIMIT) return stop(LIMIT);
      frame = requestAnimationFrame(paint);
    };
    if (plan.hideAt === 0) { count.classList.add('is-hidden'); }
    frame = requestAnimationFrame(paint);
  }

  function stop(forced) {
    if (game?.phase !== 'run') return;
    const t = forced ?? (performance.now() - game.startedAt);
    stopAll();
    sounds.stop();
    game.phase = 'reveal';
    const me = game.players.find((p) => p.me);
    me.last = Math.round(t);
    // the rivals: ten seconds and their own wobble, a little shakier every round
    for (const p of alive()) {
      if (p.me) continue;
      const wobble = game.level.spread * p.skill * (1 + 0.12 * (game.round - 1));
      p.last = Math.round(Math.max(3000, Math.min(LIMIT, TARGET + gauss(game.random) * wobble)));
    }
    for (const p of alive()) p.total += Math.max(0, 1000 - Math.abs(p.last - TARGET) / 2);
    const count = $('tsCount'), press = $('tsPress');
    count.classList.remove('is-hidden', 'is-fake');
    count.textContent = secs(me.last);
    $('tsDial').style.setProperty('--p', String(Math.min(1, me.last / TARGET)));
    press.disabled = true; press.textContent = 'انتظر…';
    const off = me.last - TARGET, verdict = $('tsVerdict');
    verdict.textContent = Math.abs(off) <= 50 ? 'مضبوطة! ' + secs(me.last) + ' ثانية' : (off > 0 ? 'متأخر ' : 'مستعجل ') + secs(Math.abs(off)) + ' ثانية';
    verdict.className = 'ts-verdict ' + (Math.abs(off) <= 400 ? 'is-good' : 'is-bad');
    // the farthest from ten seconds leaves
    const standing = alive();
    const ranked = [...standing].sort((a, b) => Math.abs(a.last - TARGET) - Math.abs(b.last - TARGET));
    const best = ranked[0], worst = ranked.at(-1);
    after(reduce ? 200 : 700, () => {
      drawSeats(worst, best);
      worst.out = true; worst.outRound = game.round;
      after(reduce ? 300 : 1100, () => {
        drawSeats(null, best);
        if (worst.me) { sounds.out(); verdict.textContent = 'طلعت هالجولة · ' + verdict.textContent; return finish(false); }
        if (alive().length === 1) { sounds.win(); return finish(true); }
        verdict.textContent += ' · طلع ' + worst.name;
        report(false);
        game.phase = 'between';
        const next = $('tsNext'); next.hidden = false; next.focus({ preventScroll: true });
        press.textContent = 'جاهز';
      });
    });
  }

  /* ---------------------------------------------------------------- start and finish */
  function start(levelId) {
    stopAll();
    const seed = link ? link.local.seed : (Math.random() * 4294967296) >>> 0;
    game = newGame(link ? link.local.level : levelId, seed);
    doc.body.classList.add('ts-running');
    $('tsIntro').hidden = true; $('tsGame').hidden = false; $('tsResult').hidden = true;
    $('tsLevel').textContent = game.level.label + ' · ستة لاعبين';
    link?.live?.();
    nextRound();
    $('tsGame').scrollIntoView({ block: 'start' });
  }

  function finish(won) {
    stopAll();
    game.phase = 'over';
    const me = game.players.find((p) => p.me);
    const place = won ? 1 : alive().length + 1;
    $('tsResultTitle').textContent = won ? 'أنت ساعة الشلة! فزت' : 'مركزك ' + place + ' من ' + game.players.length;
    $('tsResultNote').textContent = won ? 'آخر واحد صامد بعد ' + game.round + ' جولات' : 'طلعت في الجولة ' + game.round + '. جرّب مرة ثانية، العد بالقلب يتعلّم';
    const ranked = [...game.players].sort((a, b) => (a.out - b.out) || (b.outRound - a.outRound) || (b.total - a.total));
    const list = $('tsRanks'); list.replaceChildren();
    ranked.forEach((p, i) => {
      const li = doc.createElement('li'); li.className = (p.me ? 'is-me' : '') + (p.out ? ' is-out' : '');
      li.style.setProperty('--seat', p.colour);
      const n = doc.createElement('b'); n.textContent = (i + 1) + '. ' + (p.me ? 'أنت' : p.name);
      const s = doc.createElement('small'); s.textContent = p.out ? 'طلع في الجولة ' + p.outRound : 'صامد';
      li.append(n, s); list.append(li);
    });
    $('tsAgain').hidden = Boolean(link);
    $('tsResult').hidden = false;
    report(true, won);
    void me;
  }

  function report(done, won = false) {
    if (!link || !game) return;
    const me = game.players.find((p) => p.me);
    const survived = me.out ? me.outRound - 1 : game.round;
    const progress = won ? 1 : Math.min(1, survived / (game.players.length - 1));
    link.report({ progress, score: Math.round(survived * 1000 + me.total / 10 + (won ? 3000 : 0)), mistakes: me.out ? 1 : 0, done, won });
  }

  /* ---------------------------------------------------------------- the page */
  function init() {
    const saved = store.get('bs-ten-level');
    let level = LEVELS[saved] ? saved : 'standard';
    const paint = () => doc.querySelectorAll('[data-ts-level]').forEach((b) => { const on = b.dataset.tsLevel === level; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); });
    doc.querySelectorAll('[data-ts-level]').forEach((b) => b.addEventListener('click', () => { level = b.dataset.tsLevel; store.set('bs-ten-level', level); paint(); }));
    paint();
    $('tsPlay').addEventListener('click', () => start(level));
    $('tsAgain').addEventListener('click', () => start(level));
    $('tsNext').addEventListener('click', () => { if (game?.phase === 'between') nextRound(); });
    // pointerdown: the moment the finger lands is the time that counts
    $('tsPress').addEventListener('pointerdown', (event) => { if (game?.phase === 'run') { event.preventDefault(); stop(); } });
    $('tsPress').addEventListener('click', () => { if (game?.phase === 'run') stop(); });
    doc.addEventListener('keydown', (event) => { if (game?.phase === 'run' && (event.code === 'Space' || event.key === 'Enter')) { event.preventDefault(); stop(); } });
    $('tsQuit').addEventListener('click', () => { stopAll(); game = null; doc.body.classList.remove('ts-running'); $('tsGame').hidden = true; $('tsResult').hidden = true; $('tsIntro').hidden = false; });
    // leaving the page mid-count stops the round where it was: no counting in the background
    doc.addEventListener('visibilitychange', () => { if (doc.hidden && game?.phase === 'run') stop(); });
    const sound = $('tsSound');
    const paintSound = () => { sound.textContent = muted ? '🔇' : '🔊'; sound.setAttribute('aria-pressed', String(!muted)); };
    sound.addEventListener('click', () => { muted = !muted; store.set('bs-new-games-mute', muted ? '1' : '0'); paintSound(); });
    paintSound();
    if (link) { $('tsIntro').querySelector('.ts-levels').hidden = true; start(link.local.level); }
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})();
