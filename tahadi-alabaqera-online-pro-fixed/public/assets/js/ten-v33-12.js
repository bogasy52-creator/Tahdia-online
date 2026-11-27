/* لعبة العباقرة 33.12.0 / 33.21.0 — «عشر ثواني» (alone against five, or live with real players).
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
  const myName = () => String(window.BS_PARTY_LINK?.name || store.get('bs-player-name-v33') || store.get('bs_player_name') || 'أنت').trim().slice(0, 16) || 'أنت';
  const secs = (ms) => (ms / 1000).toFixed(2);

  const TICK_HEARD_MS = 3000;
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
      const name = doc.createElement('b'); name.textContent = p.me ? 'أنت' : p.name; if (p.host && net) name.title = 'صاحب الغرفة';
      const time = doc.createElement('small'); time.textContent = p.out ? 'طلع' : p.last != null ? secs(p.last) + 's' : p.stopped ? '✓ وقّف' : p.away ? 'انقطع' : '—';
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
    // 33.17.0: the clock is heard for the first 3 seconds only; after that you count by feel
    const tick = () => { ticks++; if (performance.now() - game.startedAt < TICK_HEARD_MS) sounds.tick(); if (plan.tick !== 1000 && plan.hideAt <= 1000 && !reduce && ticks > 1 && game.random() < 0.35) { count.classList.add('is-fake'); count.classList.remove('is-hidden'); count.textContent = String(ticks); after(220, () => { count.classList.add('is-hidden'); count.classList.remove('is-fake'); }); } ticker = setTimeout(tick, plan.tick); };
    ticker = setTimeout(tick, plan.tick);
    const paint = () => {
      const t = performance.now() - game.startedAt;
      if (t < plan.hideAt) { count.textContent = String(Math.floor(t / 1000)); dial.style.setProperty('--p', String(Math.min(1, t / TARGET))); }
      else if (!count.classList.contains('is-hidden') && !count.classList.contains('is-fake')) { count.classList.add('is-hidden'); dial.style.setProperty('--p', '0'); }
      if (t >= LIMIT) return net ? netStop(LIMIT) : stop(LIMIT);
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
    $('tsAgain').hidden = Boolean(link); $('tsAgain').textContent = 'العب مرة ثانية'; $('tsResultWait').hidden = true; $('tsResultFriends').hidden = Boolean(link); $('tsResultSolo').hidden = true;
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


  /* ---------------------------------------------------------------- 33.21.0: the live room
     Everyone at the table starts the same round at the same moment, each phone measures its own
     clock, and the room says who left. The screens are the solo ones, fed by the room. */
  let net = null;
  const account = () => { try { return localStorage.getItem('bs_social_session') || ''; } catch { return ''; } };
  const note = (text) => { $('tsLobbyNote').textContent = text; };
  function share() {
    if (!net?.code) return;
    const url = location.origin + '/ten?room=' + net.code;
    if (navigator.share) navigator.share({ title: 'عشر ثواني', text: 'تعال نلعب عشر ثواني، رمز الغرفة ' + net.code, url }).catch(() => {});
    else navigator.clipboard?.writeText(url).then(() => note('نسخت الرابط، أرسله لأصحابك'), () => note('رمز الغرفة: ' + net.code));
  }
  class TenOnline {
    constructor() { this.ws = null; this.code = ''; this.hostKey = ''; this.token = ''; this.state = null; this.me = ''; this.closed = false; }
    async api(path, body, what) {
      let res; try { res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' }); }
      catch { throw Error('ما وصلنا للسيرفر. تأكد من النت وجرّب مرة ثانية'); }
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.code) throw Error((typeof d.error === 'string' && d.error.length < 90 && !/_/.test(d.error) ? d.error : 'ما قدرنا ' + what) + ' (' + res.status + ')');
      return d;
    }
    async quick() { const d = await this.api('/api/ten/quick', {}, 'نلقى طاولة الحين'); return this.join(d.code); }
    async create() {
      const d = await this.api('/api/ten/rooms', { capacity: 8 }, 'نفتح الغرفة');
      this.hostKey = d.hostKey; try { sessionStorage.setItem('bs_ten_host:' + d.code, d.hostKey); } catch { /* private */ }
      return this.join(d.code);
    }
    async join(code) { try { return await this.connect(code); } catch (first) { if (this.closed || /ممتلئة|بدأت|صاحب/.test(first.message)) throw first; await new Promise((r) => setTimeout(r, 900)); return this.connect(code); } }
    connect(code) {
      this.code = code; this.detach();
      try { this.hostKey ||= sessionStorage.getItem('bs_ten_host:' + code) || ''; this.token = sessionStorage.getItem('bs_ten_room:' + code) || ''; } catch { /* private */ }
      const protocols = ['bs-ten-v1', ...(this.hostKey ? ['hk.' + this.hostKey] : []), ...(this.token ? ['rt.' + this.token] : []), ...(account() ? ['st.' + account()] : [])];
      return new Promise((resolve, reject) => {
        let ok = false, ws;
        try { ws = this.ws = new WebSocket((location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host + '/api/ten/rooms/' + code + '/ws?name=' + encodeURIComponent(myName()), protocols); }
        catch { reject(Error('المتصفح ما قبل الاتصال بالغرفة')); return; }
        const timer = setTimeout(() => { if (!ok) { try { ws.close(); } catch { /* gone */ } reject(Error('الغرفة ما ردت، جرّب مرة ثانية')); } }, 12000);
        ws.onmessage = (ev) => {
          if (this.ws !== ws) return; let m; try { m = JSON.parse(ev.data); } catch { return; }
          if (m.type === 'hello') {
            ok = true; clearTimeout(timer); this.me = m.id; this.lostAt = 0;
            try { sessionStorage.setItem('bs_ten_room:' + code, m.token); } catch { /* private */ }
            if (!window.BS_PARTY_LINK?.embedded) { const url = new URL(location.href); url.searchParams.set('room', code); url.searchParams.delete('play'); history.replaceState(null, '', url); }
            resolve(this);
          }
          if (m.type === 'state') { this.state = m.state; paintNet(m.state, performance.now()); }
        };
        ws.onclose = (ev) => {
          clearTimeout(timer);
          // the room refuses with a reason before the socket opens: the join request says why
          if (!ok) { fetch('/api/ten/rooms/' + code + '/status', { cache: 'no-store' }).then((r) => r.json()).then((d) => reject(Error(!d?.ok ? 'الغرفة انتهت أو الرمز غلط' : d.status !== 'lobby' && d.status !== 'finished' ? 'الجولة بدأت؛ انتظر اللي بعدها أو افتح غرفة ثانية' : d.players >= d.playerLimit ? 'الغرفة ممتلئة' : 'ما قدرنا ندخل الغرفة')), () => reject(Error('ما قدرنا ندخل الغرفة'))); }
          else if (!this.closed && this.ws === ws) this.lost();
        };
        ws.onerror = () => {};
      });
    }
    async lost() {
      if (this.closed || this.lostAt) return; this.lostAt = Date.now();
      $('tsRound').textContent = 'انقطع الاتصال… نرجعك'; note('انقطع الاتصال… نرجعك');
      for (const wait of [500, 1400, 3000]) { await new Promise((r) => setTimeout(r, wait)); if (this.closed || net !== this) return; try { await this.connect(this.code); return; } catch { /* next try */ } }
      if (!this.closed && net === this) { leave(); $('tsIntroError').textContent = 'انقطع الاتصال بالغرفة. تقدر ترجع بالرابط نفسه.'; }
    }
    send(m) { try { if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(m)); } catch { /* closed */ } }
    detach() { if (this.ws) { const ws = this.ws; this.ws = null; ws.onclose = null; try { ws.close(1000); } catch { /* gone */ } } }
    close() { this.closed = true; this.send({ type: 'leave' }); this.detach(); }
  }

  async function online(open) {
    const err = $('tsIntroError'); err.textContent = '';
    stopAll(); net?.close();
    const client = net = new TenOnline();
    shown = { match: -1, round: -1, status: '' };
    show('lobby'); note('نجهّز الغرفة…'); $('tsCode').textContent = '——'; $('tsLobbyPlayers').replaceChildren(); $('tsStart').hidden = true;
    try { await open(client); }
    catch (e) { if (net !== client) return; net = null; show('intro'); err.textContent = e.message; }
  }
  function leave() {
    stopAll(); net?.close(); net = null; game = null;
    if (!window.BS_PARTY_LINK?.embedded) { const url = new URL(location.href); url.searchParams.delete('room'); history.replaceState(null, '', url); }
    doc.body.classList.remove('ts-running', 'ts-live'); show('intro');
  }
  function show(which) {
    $('tsIntro').hidden = which !== 'intro'; $('tsLobby').hidden = which !== 'lobby'; $('tsGame').hidden = which !== 'game';
    if (which !== 'result') $('tsResult').hidden = true;
    doc.body.classList.toggle('ts-live', Boolean(net));
  }

  // the room's state, drawn: a lobby, a round counting down or running, a reveal, or the final places
  let shown = { match: -1, round: -1, status: '' };
  function netPlayers(s) {
    return s.players.map((p, i) => ({ ...p, me: p.id === net.me, colour: SEATS[i % SEATS.length], away: !p.connected, outRound: p.outRound || 0 }));
  }
  function paintNet(s, now) {
    const players = netPlayers(s), me = players.find((p) => p.me);
    if (s.status === 'lobby') return paintLobby(s, players, me);
    // a round (or the reveal of one): the solo game object, filled from the room
    game ??= { level: LEVELS.standard, players: [], round: 0, phase: 'ready', random: Math.random };
    game.players = players; game.round = s.round;
    if (s.status === 'finished') { if (shown.status !== 'finished' || shown.match !== s.match) { shown = { match: s.match, round: s.round, status: 'finished' }; netFinish(s, players, me); } return; }
    show('game'); doc.body.classList.add('ts-running');
    $('tsLevel').textContent = (s.party ? 'جولة الغرفة' : s.quick ? 'أونلاين' : 'غرفة ' + s.code) + ' · ' + players.length + ' لاعبين';
    $('tsNext').hidden = true;
    const fresh = shown.match !== s.match || shown.round !== s.round;
    if ((s.status === 'count' || s.status === 'run') && fresh) { shown = { match: s.match, round: s.round, status: s.status }; netRound(s, me, now); }
    else if (s.status === 'reveal' && shown.status !== 'reveal') { shown = { match: s.match, round: s.round, status: 'reveal' }; netReveal(s, players, me); }
    else if (s.status !== 'reveal') drawSeats();
  }
  function paintLobby(s, players, me) {
    stopAll(); show('lobby'); doc.body.classList.remove('ts-running');
    $('tsCode').textContent = s.code; $('tsCodeBox').hidden = s.quick || s.party;
    $('tsInvite').hidden = $('tsShare').hidden = s.quick || s.party;
    const list = $('tsLobbyPlayers'); list.replaceChildren();
    players.forEach((p) => { const li = doc.createElement('li'); li.style.setProperty('--seat', p.colour); li.className = (p.me ? 'is-me' : '') + (p.away ? ' is-away' : ''); const b = doc.createElement('b'); b.textContent = p.me ? p.name + ' (أنت)' : p.name; const t = doc.createElement('small'); t.textContent = p.host ? 'صاحب الغرفة' : p.away ? 'يرجع…' : 'جاهز'; li.append(b, t); list.append(li); });
    const humans = players.length, startsIn = s.startsIn != null ? Math.ceil(s.startsIn / 1000) : null;
    $('tsStart').hidden = s.quick || s.party || !me?.host;
    $('tsStart').disabled = humans < 2;
    $('tsLobbyTitle').textContent = s.party ? 'جولة «عشر ثواني»' : s.quick ? 'طاولة أونلاين' : 'غرفة أصحابك';
    note(s.party ? (startsIn != null ? 'نبدأ أول ما يدخل الكل، أو بعد ' + startsIn + ' ثانية' : 'ننتظر الباقين…')
      : s.quick ? (startsIn != null ? 'نبدأ بعد ' + startsIn + ' ثانية' : 'ننتظر لاعبين…')
      : me?.host ? (humans < 2 ? 'ادعُ صديق أو أرسل الرابط، وتقدر تبدأ أول ما يدخل واحد' : 'كلكم هنا؟ اضغط «ابدأ»') : 'بانتظار صاحب الغرفة يبدأ');
    // the countdown keeps moving between the room's messages
    if (startsIn != null) { const end = performance.now() + s.startsIn, base = net.state, line = s.party ? 'نبدأ أول ما يدخل الكل، أو بعد ' : 'نبدأ بعد '; const down = () => { if (net?.state !== base) return; const n = Math.max(0, Math.ceil((end - performance.now()) / 1000)); note(line + n + ' ثانية'); if (n > 0) after(500, down); }; down(); }
  }
  function netRound(s, me, now) {
    stopAll(); game.phase = 'count'; game.mine = null;
    const plan = s.plan, goAt = now + (s.goIn ?? 0);
    drawSeats();
    $('tsRound').textContent = 'الجولة ' + s.round + ' · ' + plan.note;
    $('tsVerdict').textContent = me?.out ? 'طلعت من المباراة، تابع الباقين' : ''; $('tsVerdict').className = 'ts-verdict';
    const count = $('tsCount'), dial = $('tsDial'), press = $('tsPress');
    count.classList.remove('is-hidden', 'is-fake'); dial.style.setProperty('--p', '0');
    press.disabled = true; press.textContent = me?.out ? 'تتفرج' : 'استعد';
    const wait = () => {
      const left = goAt - performance.now();
      if (left > 0) { const n = Math.ceil(left / 1000); if (count.textContent !== String(n)) { count.textContent = String(n); sounds.count(); } after(Math.min(120, left), wait); return; }
      if (me?.out) { count.textContent = '…'; game.phase = 'watch'; return; }
      // back after a drop with the time already in: show it and wait with the others
      if (me?.last != null) { count.textContent = secs(me.last); game.phase = 'sent'; press.textContent = 'ننتظر الباقين…'; return; }
      // the clock is the room's: a phone that came back mid-round still counts from the start
      run(plan); game.startedAt = goAt;
    };
    wait();
  }
  function netStop(forced) {
    if (game?.phase !== 'run') return;
    const t = Math.round(forced ?? (performance.now() - game.startedAt));
    stopAll(); sounds.stop(); game.phase = 'sent';
    net.send({ type: 'stop', round: game.round, ms: t });
    const count = $('tsCount'), press = $('tsPress'), offBy = t - TARGET, verdict = $('tsVerdict');
    count.classList.remove('is-hidden', 'is-fake'); count.textContent = secs(t);
    $('tsDial').style.setProperty('--p', String(Math.min(1, t / TARGET)));
    press.disabled = true; press.textContent = 'ننتظر الباقين…';
    verdict.textContent = Math.abs(offBy) <= 50 ? 'مضبوطة! ' + secs(t) + ' ثانية' : (offBy > 0 ? 'متأخر ' : 'مستعجل ') + secs(Math.abs(offBy)) + ' ثانية';
    verdict.className = 'ts-verdict ' + (Math.abs(offBy) <= 400 ? 'is-good' : 'is-bad');
  }
  function netReveal(s, players, me) {
    stopAll(); game.phase = 'between';
    const left = players.filter((p) => s.left.includes(p.id)), standing = players.filter((p) => !p.out && p.last != null);
    const best = [...standing].sort((a, b) => Math.abs(a.last - TARGET) - Math.abs(b.last - TARGET))[0];
    drawSeats(left[0], best);
    const press = $('tsPress'), verdict = $('tsVerdict'); press.disabled = true;
    if (me && s.left.includes(me.id)) { sounds.out(); verdict.textContent = 'طلعت هالجولة (' + secs(me.last) + ' ثانية). تقدر تتفرج على الباقين'; verdict.className = 'ts-verdict is-bad'; }
    else verdict.textContent = (me?.last != null ? secs(me.last) + ' ثانية · ' : '') + 'طلع ' + left.map((p) => (p.me ? 'أنت' : p.name)).join(' و');
    press.textContent = 'الجولة الجاية بعد ' + Math.ceil((s.nextIn || 0) / 1000);
    const end = performance.now() + (s.nextIn || 0), tickDown = () => { const n = Math.ceil((end - performance.now()) / 1000); if (n <= 0 || game?.phase !== 'between') return; press.textContent = 'الجولة الجاية بعد ' + n; after(250, tickDown); };
    tickDown();
  }
  function netFinish(s, players, me) {
    stopAll(); game.phase = 'over'; doc.body.classList.remove('ts-running');
    const won = me?.place === 1;
    if (won) sounds.win();
    $('tsResultTitle').textContent = won ? 'أنت ساعة الشلة! فزت' : 'مركزك ' + (me?.place || '—') + ' من ' + players.length;
    $('tsResultNote').textContent = won ? 'آخر واحد صامد بعد ' + s.round + ' جولات' : me?.outRound ? 'طلعت في الجولة ' + me.outRound : '';
    const list = $('tsRanks'); list.replaceChildren();
    [...players].sort((a, b) => (a.place || 99) - (b.place || 99)).forEach((p) => {
      const li = doc.createElement('li'); li.className = (p.me ? 'is-me' : '') + (p.out && p.place !== 1 ? ' is-out' : ''); li.style.setProperty('--seat', p.colour);
      const n = doc.createElement('b'); n.textContent = p.place + '. ' + (p.me ? 'أنت' : p.name);
      const t = doc.createElement('small'); t.textContent = p.place === 1 ? 'الفايز' : 'طلع في الجولة ' + p.outRound; li.append(n, t); list.append(li);
    });
    // again: a public table finds a new one; a friends room starts again when its owner says
    const again = $('tsAgain'); again.hidden = s.party || (!s.quick && !me?.host);
    again.textContent = s.quick ? 'طاولة ثانية' : 'جولة ثانية بنفس الغرفة';
    $('tsResultWait').hidden = s.party || s.quick || Boolean(me?.host);
    $('tsResultFriends').hidden = !s.quick; $('tsResultSolo').hidden = Boolean(s.party);
    $('tsResult').hidden = false;
  }

  /* ---------------------------------------------------------------- the page */
  function init() {
    const saved = store.get('bs-ten-level');
    let level = LEVELS[saved] ? saved : 'standard';
    const paint = () => doc.querySelectorAll('[data-ts-level]').forEach((b) => { const on = b.dataset.tsLevel === level; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); });
    doc.querySelectorAll('[data-ts-level]').forEach((b) => b.addEventListener('click', () => { level = b.dataset.tsLevel; store.set('bs-ten-level', level); paint(); }));
    paint();
    $('tsPlay').addEventListener('click', () => start(level));
    $('tsAgain').addEventListener('click', () => { if (!net) return start(level); if (net.state?.quick) return online((c) => c.quick()); net.send({ type: 'start' }); });
    $('tsNext').addEventListener('click', () => { if (game?.phase === 'between') nextRound(); });
    // pointerdown: the moment the finger lands is the time that counts
    const press = () => (net ? netStop() : stop());
    $('tsPress').addEventListener('pointerdown', (event) => { if (game?.phase === 'run') { event.preventDefault(); press(); } });
    $('tsPress').addEventListener('click', () => { if (game?.phase === 'run') press(); });
    doc.addEventListener('keydown', (event) => { if (game?.phase === 'run' && (event.code === 'Space' || event.key === 'Enter')) { event.preventDefault(); press(); } });
    $('tsQuit').addEventListener('click', () => { if (net) return leave(); stopAll(); game = null; doc.body.classList.remove('ts-running'); $('tsGame').hidden = true; $('tsResult').hidden = true; $('tsIntro').hidden = false; });
    $('tsResultSolo').addEventListener('click', () => { leave(); start(level); });
    // leaving the page mid-count stops the round where it was: no counting in the background
    doc.addEventListener('visibilitychange', () => { if (doc.hidden && game?.phase === 'run') press(); });
    const sound = $('tsSound');
    const paintSound = () => { sound.textContent = muted ? '🔇' : '🔊'; sound.setAttribute('aria-pressed', String(!muted)); };
    sound.addEventListener('click', () => { muted = !muted; store.set('bs-new-games-mute', muted ? '1' : '0'); paintSound(); });
    paintSound();
    $('tsOnlineBtn').addEventListener('click', () => online((c) => c.quick()));
    $('tsFriendsBtn').addEventListener('click', () => online((c) => c.create()));
    $('tsResultFriends').addEventListener('click', () => online((c) => c.create()));
    $('tsStart').addEventListener('click', () => net?.send({ type: 'start' }));
    $('tsLeave').addEventListener('click', () => leave());
    $('tsInvite').addEventListener('click', () => { if (!net?.code) return; if (window.BS_SOCIAL?.openInvitePicker) window.BS_SOCIAL.openInvitePicker({ game: 'ten', roomCode: net.code, title: 'عشر ثواني' }); else share(); });
    $('tsShare').addEventListener('click', share);
    if (link) { $('tsIntro').querySelector('.ts-levels').hidden = true; start(link.local.level); return; }
    // a room in the address: an invite, a shared link, or a round of «الغرف»
    const code = String(new URLSearchParams(location.search).get('room') || '').replace(/\D/g, '');
    if (/^03\d{4}$/.test(code)) online((c) => c.join(code));
    else if (new URLSearchParams(location.search).get('play') === 'online') online((c) => c.quick());
    else if (new URLSearchParams(location.search).get('play') === 'room') online((c) => c.create());
    // inside the group room's frame the room is the way out
    if (window.BS_PARTY_LINK?.embedded) doc.body.classList.add('ts-embedded');
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})();
