/* Classic Snake Arena. The live snake is drawn on canvas; no background artwork is used. */
(function () {
  const style = document.createElement('link'); style.rel = 'stylesheet'; style.href = 'assets/css/snake-classic.css'; document.head.appendChild(style);
  function ensureMarkup() {
    if (document.getElementById('classicArena')) return;
    const arena = document.createElement('section');
    arena.id = 'classicArena'; arena.className = 'classic-arena classic-hidden'; arena.setAttribute('aria-live', 'polite');
    arena.innerHTML = `<div class="classic-top"><div><div class="classic-kicker"><i aria-hidden="true">✦</i> SNAKE ARENA <span>LIVE PLAY</span></div><h1 class="classic-title">الثعبان <span>يكبر معك.</span></h1><p class="classic-sub">حرّكه، التهم الطاقة، وكبّره داخل ساحة نيون تفاعلية — بدون صورة خلفية.</p></div><button id="classicExit" class="bs-btn">‹ العودة</button></div><div class="classic-hud"><div class="classic-stat score-stat"><small>النقاط</small><b id="classicScore">0</b></div><div class="classic-stat best-stat"><small>الأفضل</small><b id="classicBest">0</b></div><div class="classic-stat level-stat"><small>المستوى</small><b id="classicLevel">1</b></div><div class="classic-stat live-stat"><small>الحالة</small><b><i></i> LIVE</b></div></div><div class="classic-shell"><section class="classic-board-card"><div class="classic-board-label"><span>ARENA 01</span><span>اجمع الطاقة واصنع رقمك</span></div><div class="classic-canvas-wrap"><canvas id="classicCanvas" aria-label="لوحة لعبة الثعبان التفاعلية"></canvas></div><div class="classic-legend"><span class="snake"><i aria-hidden="true">●</i> ثعبان حي</span><span class="food"><i aria-hidden="true">✦</i> طاقة = نمو</span><span><i aria-hidden="true">⌁</i> لمس أو أسهم</span></div></section><aside class="classic-side"><section class="classic-panel"><div id="classicStatus" class="classic-status">اضغط ابدأ للعب</div><div class="classic-actions"><button id="classicStart" class="classic-btn gold">ابدأ اللعب <span aria-hidden="true">↗</span></button><button id="classicPause" class="classic-btn primary classic-hidden">إيقاف مؤقت</button></div></section><section class="classic-panel"><div class="classic-panel-heading"><span class="panel-icon" aria-hidden="true">⌘</span><h2>تحكم الثعبان</h2></div><div class="classic-controls" dir="ltr" aria-label="أزرار الاتجاه"><button data-dir="up" aria-label="أعلى"><span aria-hidden="true">↑</span></button><button data-dir="left" aria-label="يسار"><span aria-hidden="true">←</span></button><button data-dir="down" aria-label="أسفل"><span aria-hidden="true">↓</span></button><button data-dir="right" aria-label="يمين"><span aria-hidden="true">→</span></button></div><div class="classic-sound" style="margin-top:13px"><span><i aria-hidden="true">♫</i> أصوات الأكل والحركة</span><button id="classicSound" class="classic-switch on" aria-pressed="true"><i></i></button></div></section><section class="classic-panel"><div class="classic-panel-heading"><span class="panel-icon" aria-hidden="true">✦</span><h2>الهدف</h2></div><p class="classic-help">اجمع الطاقة لتكبر. كلما كبر الثعبان ارتفع المستوى وتسارعت الحركة. اصطدم بنفسك أو بالحافة وتنتهي الجولة.</p></section></aside></div>`;
    document.getElementById('game')?.before(arena);
  }
  ensureMarkup();
  const COLS = 22, ROWS = 22, BEST_KEY = 'tahadi-snake-classic-best';
  const $ = (id) => document.getElementById(id);
  const canvas = $('classicCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let snake = [], food = { x: 15, y: 10 }, direction = { x: 1, y: 0 }, queued = direction;
  let score = 0, best = Number(localStorage.getItem(BEST_KEY) || 0), level = 1;
  let timer = null, raf = 0, particles = [], running = false, paused = false, soundOn = true, audioCtx = null;

  function safeNumber(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
  function status(text, kind = '') { const el = $('classicStatus'); if (el) { el.textContent = text; el.className = `classic-status ${kind}`; } }
  function tone(freq, duration = .08, type = 'sine', volume = .045) {
    if (!soundOn) return;
    try {
      audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
      const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
      osc.type = type; osc.frequency.value = freq; gain.gain.setValueAtTime(volume, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + duration);
      osc.connect(gain).connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + duration);
    } catch {}
  }
  function eatSound() { tone(520, .07, 'triangle', .06); setTimeout(() => tone(780, .12, 'triangle', .05), 40); }
  function overSound() { tone(180, .22, 'sawtooth', .06); setTimeout(() => tone(110, .32, 'sawtooth', .045), 90); }
  function resize() {
    const rect = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(rect.width * dpr)); canvas.height = Math.max(1, Math.round(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw();
  }
  function bounds() { const r = canvas.getBoundingClientRect(); return { w: r.width, h: r.height, tile: Math.min(r.width / COLS, r.height / ROWS) }; }
  function roundRect(x, y, w, h, radius) { if (ctx.roundRect) ctx.roundRect(x, y, w, h, radius); else ctx.rect(x, y, w, h); }
  function placeFood() {
    for (let i = 0; i < 400; i += 1) {
      const next = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
      if (!snake.some((part) => part.x === next.x && part.y === next.y)) { food = next; return; }
    }
    food = { x: 2, y: 2 };
  }
  function resetState() {
    snake = [{ x: 7, y: 11 }, { x: 6, y: 11 }, { x: 5, y: 11 }, { x: 4, y: 11 }];
    direction = { x: 1, y: 0 }; queued = direction; score = 0; level = 1; particles = []; placeFood(); updateHud();
  }
  function updateHud() {
    if ($('classicScore')) $('classicScore').textContent = score;
    if ($('classicBest')) $('classicBest').textContent = Math.max(best, score);
    if ($('classicLevel')) $('classicLevel').textContent = level;
  }
  function setDirection(next) {
    if (!running || paused) return;
    if (next.x === -direction.x && next.y === -direction.y) return;
    queued = next; tone(250, .035, 'square', .018);
  }
  function burst(x, y) {
    for (let i = 0; i < 15; i += 1) particles.push({ x, y, dx: (Math.random() - .5) * 2.8, dy: (Math.random() - .5) * 2.8, life: 1, hue: 35 + Math.random() * 45 });
  }
  function schedule() {
    clearTimeout(timer); if (!running || paused) return;
    const delay = Math.max(68, 138 - (level - 1) * 8); timer = setTimeout(step, delay);
  }
  function step() {
    if (!running || paused) return;
    direction = queued;
    const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
    const hitWall = head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS;
    const hitSelf = snake.some((part, index) => index > 0 && part.x === head.x && part.y === head.y);
    if (hitWall || hitSelf) return gameOver();
    snake.unshift(head);
    const ate = head.x === food.x && head.y === food.y;
    if (ate) {
      score += 10; level = Math.min(12, Math.floor(score / 50) + 1); burst(food.x, food.y); placeFood(); eatSound();
      try { window.BS_AUDIO?.play?.('correct', { volume: .28 }); } catch {}
    } else snake.pop();
    updateHud(); draw(); schedule();
  }
  function gameOver() {
    running = false; paused = false; clearTimeout(timer); timer = null;
    best = Math.max(best, score); localStorage.setItem(BEST_KEY, String(best)); updateHud(); status(`انتهت الجولة — نتيجتك ${score}. اضغط «جولة جديدة»`, 'over'); overSound();
    try { window.BS_AUDIO?.play?.('wrong', { volume: .35 }); window.BS_AUDIO?.vibrate?.([90, 50, 180]); } catch {}
    $('classicStart')?.classList.remove('classic-hidden'); $('classicStart') && ($('classicStart').textContent = 'جولة جديدة'); $('classicPause')?.classList.add('classic-hidden');
  }
  function draw() {
    const { w, h, tile } = bounds(); if (!w || !h) return;
    const ox = (w - tile * COLS) / 2, oy = (h - tile * ROWS) / 2;
    ctx.clearRect(0, 0, w, h);
    const bg = ctx.createRadialGradient(w * .42, h * .34, 0, w * .5, h * .5, Math.max(w, h) * .72); bg.addColorStop(0, '#142d3b'); bg.addColorStop(.56, '#091823'); bg.addColorStop(1, '#050b12'); ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.save(); ctx.translate(ox, oy);
    ctx.strokeStyle = 'rgba(111,224,244,.075)'; ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x += 1) { ctx.beginPath(); ctx.moveTo(x * tile, 0); ctx.lineTo(x * tile, ROWS * tile); ctx.stroke(); }
    for (let y = 0; y <= ROWS; y += 1) { ctx.beginPath(); ctx.moveTo(0, y * tile); ctx.lineTo(COLS * tile, y * tile); ctx.stroke(); }
    const fx = (food.x + .5) * tile, fy = (food.y + .5) * tile, glow = ctx.createRadialGradient(fx, fy, 1, fx, fy, tile * .7); glow.addColorStop(0, '#fff6c0'); glow.addColorStop(.22, '#ffd166'); glow.addColorStop(.56, '#ff6b6b'); glow.addColorStop(1, 'rgba(255,82,125,0)'); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(fx, fy, tile * .72, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffca62'; ctx.beginPath(); ctx.arc(fx, fy + tile * .03, tile * .25, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#72edb2'; ctx.rotate(-.45); ctx.fillRect(fx + tile * .05, fy - tile * .35, tile * .19, tile * .08); ctx.rotate(.45);
    snake.slice().reverse().forEach((part, reverseIndex) => {
      const index = snake.length - 1 - reverseIndex, px = part.x * tile + tile * .11, py = part.y * tile + tile * .11, size = tile * .78, t = index / Math.max(1, snake.length - 1);
      const grad = ctx.createLinearGradient(px, py, px + size, py + size); grad.addColorStop(0, `hsl(${188 - t * 20} 90% ${65 - t * 15}%)`); grad.addColorStop(1, `hsl(${218 - t * 20} 78% ${33 - t * 12}%)`); ctx.fillStyle = grad; ctx.shadowColor = '#38e8ff'; ctx.shadowBlur = index === 0 ? tile * .32 : tile * .13; ctx.beginPath(); roundRect(px, py, size, size, tile * .23); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.arc(px + size * .28, py + size * .24, size * .09, 0, Math.PI * 2); ctx.fill();
      if (index === 0) {
        const hx = px + size / 2, hy = py + size / 2, perp = { x: -direction.y, y: direction.x }, front = { x: direction.x * size * .18, y: direction.y * size * .18 };
        ctx.fillStyle = '#06101a'; [1, -1].forEach((side) => { ctx.beginPath(); ctx.arc(hx + front.x + perp.x * size * .2 * side, hy + front.y + perp.y * size * .2 * side, size * .085, 0, Math.PI * 2); ctx.fill(); });
        ctx.strokeStyle = '#ff789f'; ctx.lineWidth = Math.max(1, tile * .035); ctx.beginPath(); ctx.moveTo(hx + front.x + direction.x * size * .33, hy + front.y + direction.y * size * .33); ctx.lineTo(hx + front.x + direction.x * size * .57, hy + front.y + direction.y * size * .57); ctx.stroke();
      }
    });
    particles = particles.filter((p) => p.life > 0);
    particles.forEach((p) => { p.x += p.dx * .28; p.y += p.dy * .28; p.life -= .045; ctx.fillStyle = `hsla(${p.hue},100%,70%,${p.life})`; ctx.beginPath(); ctx.arc((p.x + .5) * tile, (p.y + .5) * tile, Math.max(1.5, tile * .07 * p.life), 0, Math.PI * 2); ctx.fill(); });
    ctx.restore();
    if (particles.length) { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); }
  }
  function start() {
    $('setup')?.classList.add('hidden'); $('game')?.classList.add('classic-hidden'); $('classicArena')?.classList.remove('classic-hidden');
    resetState(); running = true; paused = false; status('تحرّك الآن — كل كرة تكبّرك وتزيد نقاطك', 'live');
    $('classicStart')?.classList.add('classic-hidden'); $('classicPause')?.classList.remove('classic-hidden'); $('classicPause') && ($('classicPause').textContent = 'إيقاف مؤقت'); tone(440, .08, 'triangle', .04);
    // The arena is created while hidden, so its canvas can be 1×1. Resize
    // after revealing it or the snake appears blank on the first launch.
    requestAnimationFrame(() => { resize(); draw(); schedule(); });
  }
  function pause() { if (!running) return; paused = !paused; $('classicPause').textContent = paused ? 'متابعة اللعب' : 'إيقاف مؤقت'; status(paused ? 'متوقف مؤقتًا' : 'استمر — الثعبان يتحرك', paused ? '' : 'live'); if (paused) clearTimeout(timer); else schedule(); draw(); }
  function exit() { clearTimeout(timer); running = false; paused = false; $('classicArena')?.classList.add('classic-hidden'); $('setup')?.classList.remove('hidden'); $('classicStart')?.classList.remove('classic-hidden'); }
  function bind() {
    $('classicStart')?.addEventListener('click', start); $('classicPause')?.addEventListener('click', pause); $('classicExit')?.addEventListener('click', exit);
    $('classicSound')?.addEventListener('click', () => { soundOn = !soundOn; $('classicSound').classList.toggle('on', soundOn); $('classicSound').setAttribute('aria-pressed', String(soundOn)); });
    const dirs = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
    document.querySelectorAll('.classic-controls [data-dir]').forEach((button) => {
      const push = (event) => { event.preventDefault(); setDirection(dirs[button.dataset.dir]); };
      button.addEventListener('pointerdown', push, { passive: false });
      button.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') push(event); });
    });
    document.addEventListener('keydown', (event) => { const keys = { ArrowUp: { x: 0, y: -1 }, w: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 }, s: { x: 0, y: 1 }, ArrowLeft: { x: -1, y: 0 }, a: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, d: { x: 1, y: 0 } }; if (keys[event.key]) { event.preventDefault(); setDirection(keys[event.key]); } if (event.key === ' ' && running) { event.preventDefault(); pause(); } });
    let touch = null; canvas.addEventListener('touchstart', (event) => { const t = event.changedTouches[0]; touch = { x: t.clientX, y: t.clientY }; }, { passive: true }); canvas.addEventListener('touchend', (event) => { if (!touch) return; const t = event.changedTouches[0], dx = t.clientX - touch.x, dy = t.clientY - touch.y; touch = null; if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return; setDirection(Math.abs(dx) > Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) }); }, { passive: true });
    window.addEventListener('resize', resize); resetState(); resize();
  }
  window.TAHDIA_CLASSIC_SNAKE = { start, exit };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true }); else bind();
})();
