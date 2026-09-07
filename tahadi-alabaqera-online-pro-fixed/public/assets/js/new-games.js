(function () {
  const root = document.querySelector('[data-new-game]');
  if (!root) return;
  const game = root.dataset.newGame;
  const meta = {
    draw: { icon: '🎨', title: 'ارسم وخمّن', desc: 'ارسم الكلمة بسرعة، واجعل منافسك يلتقط الفكرة قبل انتهاء الوقت.' },
    secret: { icon: '🔐', title: 'كلمة السر', desc: 'فكّر في المعنى، اختر الكلمة، وتجاوز الفخاخ قبل خصمك.' },
    order: { icon: '🏁', title: 'سباق الترتيب', desc: 'رتّب الأحداث والعناصر بالترتيب الصحيح قبل أن يسبقك الوقت.' },
    auction: { icon: '💰', title: 'المزاد الذكي', desc: 'راهن من رصيدك على إجابتك: مخاطرة محسوبة أو انسحاب ذكي.' },
    cipher: { icon: '🔮', title: 'شفرة العباقرة', desc: 'حل تسلسل الرموز وافتح الشفرة بأقل عدد من المحاولات.' },
  }[game];
  if (!meta) return;
  const $ = (s) => root.querySelector(s);
  const mount = $('#gameMount'), result = $('#resultPanel'), profileEl = $('#profileStrip');
  let state = { score: 0, aiScore: 0, round: 0, total: 1, finished: false };
  const timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
  const clearAll = () => { for (const id of timers) clearTimeout(id); timers.clear(); };
  const shuffle = (items) => { const a = [...items]; for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  const play = (sound) => { try { window.BS_AUDIO?.play?.(sound); } catch {} };
  const profile = () => window.TAHADI_PROGRESS?.mount?.(profileEl);
  const hud = () => {
    if ($('#playerScore')) $('#playerScore').textContent = Math.round(state.score);
    if ($('#aiScore')) $('#aiScore').textContent = Math.round(state.aiScore);
    if ($('#roundText')) $('#roundText').textContent = `${Math.min(state.round, state.total)} / ${state.total}`;
    if ($('#progressBar')) $('#progressBar').style.width = `${Math.min(100, Math.round((state.round / state.total) * 100))}%`;
  };
  function shell() {
    const title = root.querySelector('.newHeroTitle'), desc = root.querySelector('.newHeroDesc'), icon = root.querySelector('.newGameIcon');
    if (title) title.textContent = `${meta.icon} ${meta.title}`;
    if (desc) desc.textContent = meta.desc;
    if (icon) icon.textContent = meta.icon;
    root.querySelectorAll('a[href="/online"]').forEach((a) => { a.href = '/matchmaking'; });
    profile(); hud();
  }
  function base() { clearAll(); state = { score: 0, aiScore: 0, round: 0, total: 1, finished: false }; mount.classList.remove('hidden'); result.classList.add('hidden'); }
  function renderBase(total, body) {
    state.total = total;
    mount.innerHTML = `<div class="arcade-hud"><div class="arcade-stat"><small>أنت</small><b id="playerScore">0</b><div class="arcade-progress"><i id="progressBar"></i></div></div><div class="arcade-timer"><span id="roundText">0 / ${total}</span></div><div class="arcade-stat"><small>خصم AI</small><b id="aiScore">0</b><div class="arcade-progress"><i style="width:72%;background:linear-gradient(90deg,#f4c76d,#d946ef)"></i></div></div></div><section class="arcade-stage new-stage">${body}</section><div class="arcade-secondary"><span>كل جولة تمنحك نقاطًا وXP وعملات.</span><span class="arcade-badge">NEW DUEL</span></div>`;
  }
  function finish(note) {
    if (state.finished) return;
    state.finished = true; clearAll();
    const win = state.score >= state.aiScore;
    const p = window.TAHADI_PROGRESS?.award?.({ game, score: state.score, win }) || {};
    mount.classList.add('hidden'); result.classList.remove('hidden'); result.classList.add('arcade-result');
    result.innerHTML = `<div class="arcade-badge">${win ? '🏆 فوز مستحق' : '💪 مباراة قوية'}</div><div class="big">${Math.round(state.score)}</div><p class="arcade-note">${esc(note)}</p><div class="arcade-hud"><div class="arcade-stat"><small>نتيجتك</small><b>${Math.round(state.score)}</b></div><div class="arcade-timer">VS</div><div class="arcade-stat"><small>خصم AI</small><b>${Math.round(state.aiScore)}</b></div></div><div class="award-list">${(p.unlocked || []).slice(-4).map((t) => `<span class="award-pill">🏅 ${esc(t)}</span>`).join('')}</div><p class="arcade-note">+${p.deltaXp || 10} XP • +${p.deltaCoins || 3} عملة</p><div class="arcade-actions-row"><button class="bs-btn primary" id="newAgain">إعادة التحدي</button><a class="bs-btn" href="/matchmaking">👥 لاعب حقيقي</a><a class="bs-btn" href="/">الرئيسية</a></div>`;
    $('#newAgain').onclick = start; profile(); play(win ? 'win' : 'wrong');
  }
  function drawGame() {
    base();
    const rounds = shuffle([{ word: 'شمس', icon: '☀️' }, { word: 'قهوة', icon: '☕' }, { word: 'صاروخ', icon: '🚀' }, { word: 'نخلة', icon: '🌴' }, { word: 'أسد', icon: '🦁' }]);
    renderBase(5, `<div class="new-game-wide"><div class="new-kicker" id="drawPrompt">الجولة 1 من 5</div><div class="draw-word" id="drawWord">${rounds[0].icon} ارسم: ${rounds[0].word}</div><canvas id="drawCanvas" class="draw-canvas" width="720" height="360" aria-label="لوحة الرسم"></canvas><div class="draw-toolbar"><button class="bs-btn" id="clearDraw">مسح</button><label class="draw-color">لون الرسم <input id="drawColor" type="color" value="#f4c76d"></label><button class="bs-btn primary" id="submitDraw">إرسال الرسم</button></div><p id="drawFeedback" class="arcade-note"></p></div>`);
    const canvas = $('#drawCanvas'), ctx = canvas.getContext('2d'), prompt = $('#drawPrompt'), word = $('#drawWord'), feedback = $('#drawFeedback');
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 8; let drawing = false, strokes = 0, round = 0, started = performance.now();
    const point = (event) => { const rect = canvas.getBoundingClientRect(); const touch = event.touches?.[0]; const x = (touch ? touch.clientX : event.clientX) - rect.left; const y = (touch ? touch.clientY : event.clientY) - rect.top; return { x: x * (canvas.width / rect.width), y: y * (canvas.height / rect.height) }; };
    const startStroke = (event) => { event.preventDefault(); drawing = true; strokes += 1; const p = point(event); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
    const moveStroke = (event) => { if (!drawing) return; event.preventDefault(); const p = point(event); ctx.lineTo(p.x, p.y); ctx.strokeStyle = $('#drawColor').value; ctx.stroke(); };
    const stopStroke = () => { drawing = false; };
    canvas.addEventListener('pointerdown', startStroke); canvas.addEventListener('pointermove', moveStroke); window.addEventListener('pointerup', stopStroke);
    $('#clearDraw').onclick = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); strokes = 0; };
    $('#submitDraw').onclick = () => { const elapsed = performance.now() - started; const gain = Math.max(45, Math.round(170 - elapsed / 120 + Math.min(strokes * 7, 70))); state.score += gain; state.aiScore += Math.round(95 + Math.random() * 80); feedback.textContent = `التقط AI الفكرة! +${gain} نقطة`; play('correct'); round += 1; state.round = round; hud(); if (round >= rounds.length) return finish('أنهيت معرض الرسومات — كلما كان الرسم أسرع وأوضح زادت نقاطك.'); const item = rounds[round]; prompt.textContent = `الجولة ${round + 1} من ${rounds.length}`; word.textContent = `${item.icon} ارسم: ${item.word}`; ctx.clearRect(0, 0, canvas.width, canvas.height); strokes = 0; started = performance.now(); };
  }
  const secretRounds = [{ clue: 'شيء نشربه ساخنًا ويوقظنا صباحًا', answer: 'قهوة', options: ['قهوة', 'مطر', 'كتاب', 'مفتاح'] }, { clue: 'له أسنان ولا يعض', answer: 'مشط', options: ['مشط', 'باب', 'ساعة', 'قلم'] }, { clue: 'يدور حول نفسه ولا يتحرك من مكانه', answer: 'عقرب الساعة', options: ['عقرب الساعة', 'السحاب', 'الكرة', 'المصعد'] }, { clue: 'مكان تتجمع فيه الكتب', answer: 'مكتبة', options: ['مكتبة', 'ملعب', 'مطار', 'مطبخ'] }, { clue: 'يضيء الطريق في الظلام', answer: 'مصباح', options: ['مصباح', 'وسادة', 'مفتاح', 'حقيبة'] }, { clue: 'له أوراق وليس شجرة', answer: 'كتاب', options: ['كتاب', 'كرسي', 'نافذة', 'حذاء'] }];
  function secretGame() {
    base(); renderBase(secretRounds.length, `<div class="new-game-wide"><div class="new-kicker" id="secretRound">الجولة 1</div><div class="secret-card"><span>🔐 كلمة السر</span><h2 id="secretClue"></h2></div><div class="secret-options" id="secretOptions"></div><p id="secretFeedback" class="arcade-note"></p></div>`);
    const round = () => { if (state.round >= secretRounds.length) return finish('فككت كلمات السر بسرعة وتركيز.'); const q = secretRounds[state.round]; $('#secretRound').textContent = `الجولة ${state.round + 1} من ${secretRounds.length}`; $('#secretClue').textContent = q.clue; const options = $('#secretOptions'); const feedback = $('#secretFeedback'); options.innerHTML = ''; shuffle(q.options).forEach((answer) => { const b = document.createElement('button'); b.className = 'secret-option'; b.textContent = answer; b.onclick = () => { options.querySelectorAll('button').forEach((x) => { x.disabled = true; }); const ok = answer === q.answer; b.classList.add(ok ? 'correct' : 'wrong'); if (ok) { state.score += 155; feedback.textContent = 'إجابة صحيحة — كلمة السر انفتحت ✨'; play('correct'); } else { state.score = Math.max(0, state.score - 35); feedback.textContent = `الإجابة الصحيحة: ${q.answer}`; options.querySelectorAll('button').forEach((x) => { if (x.textContent === q.answer) x.classList.add('correct'); }); play('wrong'); } state.aiScore += Math.round(ok ? 90 + Math.random() * 45 : 135 + Math.random() * 55); state.round += 1; hud(); later(round, 800); }; options.appendChild(b); }); }; round();
  }
  const orderRounds = [{ label: 'رتّب مراحل إعداد القهوة', items: ['طحن البن', 'استخلاص القهوة', 'تسخين الماء', 'تقديم الكوب'], correct: ['تسخين الماء', 'طحن البن', 'استخلاص القهوة', 'تقديم الكوب'] }, { label: 'رتّب مراحل نمو النبات', items: ['ثمرة', 'بذرة', 'نبتة', 'زهرة'], correct: ['بذرة', 'نبتة', 'زهرة', 'ثمرة'] }, { label: 'رتّب الوحدات من الأصغر إلى الأكبر', items: ['كيلومتر', 'سنتيمتر', 'متر', 'مليمتر'], correct: ['مليمتر', 'سنتيمتر', 'متر', 'كيلومتر'] }, { label: 'رتّب اليوم من البداية إلى النهاية', items: ['النوم', 'الظهر', 'الصباح', 'المساء'], correct: ['الصباح', 'الظهر', 'المساء', 'النوم'] }, { label: 'رتّب مراحل بناء منزل', items: ['التشطيب', 'الأساسات', 'المخطط', 'الهيكل'], correct: ['المخطط', 'الأساسات', 'الهيكل', 'التشطيب'] }];
  function orderGame() {
    base(); renderBase(orderRounds.length, `<div class="new-game-wide"><div class="new-kicker" id="orderRound"></div><h2 id="orderLabel" class="order-label"></h2><div id="orderChoices" class="order-choices"></div><div class="order-picked" id="orderPicked">اضغط العناصر بالترتيب الصحيح</div><button class="bs-btn primary" id="submitOrder" disabled>تحقق من الترتيب</button><p id="orderFeedback" class="arcade-note"></p></div>`);
    const next = () => { if (state.round >= orderRounds.length) return finish('رتّبت السلاسل بسرعة ودقة — مهارة ممتازة في اتخاذ القرار.'); const q = orderRounds[state.round]; const choices = $('#orderChoices'), picked = $('#orderPicked'), submit = $('#submitOrder'), feedback = $('#orderFeedback'); let selected = []; $('#orderRound').textContent = `الجولة ${state.round + 1} من ${orderRounds.length}`; $('#orderLabel').textContent = q.label; picked.textContent = 'اضغط العناصر بالترتيب الصحيح'; choices.innerHTML = ''; submit.disabled = true; shuffle(q.items).forEach((item) => { const b = document.createElement('button'); b.className = 'order-choice'; b.textContent = item; b.onclick = () => { if (selected.includes(item)) return; selected.push(item); b.classList.add('picked'); picked.textContent = selected.map((x, i) => `${i + 1}. ${x}`).join('  •  '); submit.disabled = selected.length !== q.items.length; }; choices.appendChild(b); }); submit.onclick = () => { const ok = selected.every((value, i) => value === q.correct[i]); choices.querySelectorAll('button').forEach((b) => { b.disabled = true; }); submit.disabled = true; if (ok) { state.score += 180; feedback.textContent = 'ترتيب صحيح — سبقت خصمك!'; play('correct'); } else { state.score = Math.max(0, state.score - 40); feedback.textContent = `الترتيب الصحيح: ${q.correct.join(' ← ')}`; play('wrong'); } state.aiScore += Math.round(ok ? 105 + Math.random() * 45 : 150 + Math.random() * 50); state.round += 1; hud(); later(next, 1000); }; }; next();
  }
  const auctionRounds = [{ q: 'كم عدد ألوان قوس قزح؟', answer: 7, options: [5, 6, 7, 8] }, { q: 'كم عدد أضلاع المربع؟', answer: 4, options: [3, 4, 5, 6] }, { q: 'كم دقيقة في الساعة؟', answer: 60, options: [30, 45, 60, 90] }, { q: 'كم كوكبًا في المجموعة الشمسية؟', answer: 8, options: [7, 8, 9, 10] }, { q: 'كم لاعبًا يبدأ به فريق كرة القدم؟', answer: 11, options: [9, 10, 11, 12] }];
  function auctionGame() {
    base(); renderBase(auctionRounds.length, `<div class="new-game-wide"><div class="new-kicker" id="auctionRound"></div><div class="auction-card"><div class="auction-pot">رصيد الجولة <b id="auctionPot">100</b></div><h2 id="auctionQuestion"></h2><p>اختر قيمة رهانك، ثم اختر الإجابة. الإجابة الصحيحة تضاعف الرهان والخاطئة تخصمه.</p><input id="auctionBid" type="range" min="10" max="100" step="10" value="50"><div class="bid-line"><span>رهانك</span><b id="bidValue">50</b></div><div id="auctionOptions" class="secret-options"></div></div><p id="auctionFeedback" class="arcade-note"></p></div>`);
    const next = () => { if (state.round >= auctionRounds.length) return finish('أدرت رصيدك بذكاء — المخاطرة المحسوبة تصنع الفارق.'); const q = auctionRounds[state.round]; const bid = $('#auctionBid'), bidValue = $('#bidValue'), options = $('#auctionOptions'), feedback = $('#auctionFeedback'); $('#auctionRound').textContent = `المزاد ${state.round + 1} من ${auctionRounds.length}`; $('#auctionQuestion').textContent = q.q; options.innerHTML = ''; bid.value = 50; bidValue.textContent = '50'; bid.oninput = () => { bidValue.textContent = bid.value; }; shuffle(q.options).forEach((answer) => { const b = document.createElement('button'); b.className = 'secret-option'; b.textContent = answer; b.onclick = () => { options.querySelectorAll('button').forEach((x) => { x.disabled = true; }); const amount = Number(bid.value); const ok = answer === q.answer; if (ok) { state.score += amount * 2; feedback.textContent = `كسبت ${amount * 2} نقطة — رهان ناجح 💰`; b.classList.add('correct'); play('correct'); } else { state.score = Math.max(0, state.score - amount); feedback.textContent = `خسرت ${amount} نقطة — الإجابة الصحيحة ${q.answer}`; b.classList.add('wrong'); options.querySelectorAll('button').forEach((x) => { if (Number(x.textContent) === q.answer) x.classList.add('correct'); }); play('wrong'); } state.aiScore += Math.round(50 + Math.random() * 130); state.round += 1; hud(); later(next, 950); }; options.appendChild(b); }); }; next();
  }
  const cipherRounds = [{ seq: ['🔺', '🔵', '🔺', '🔵'], answer: '🔺', options: ['🔺', '🟩', '⭐', '🔵'] }, { seq: ['1', '3', '5', '7'], answer: '9', options: ['8', '9', '10', '11'] }, { seq: ['A', 'C', 'E', 'G'], answer: 'I', options: ['H', 'I', 'J', 'K'] }, { seq: ['🌙', '⭐', '🌙', '⭐'], answer: '🌙', options: ['☀️', '🌙', '☁️', '⭐'] }, { seq: ['2', '4', '8', '16'], answer: '32', options: ['20', '24', '30', '32'] }, { seq: ['🟥', '🟨', '🟩', '🟥'], answer: '🟨', options: ['🟨', '🟦', '🟩', '🟥'] }];
  function cipherGame() {
    base(); renderBase(cipherRounds.length, `<div class="new-game-wide"><div class="new-kicker" id="cipherRound"></div><div class="cipher-lock">🔒</div><div class="cipher-sequence" id="cipherSequence"></div><div class="secret-options" id="cipherOptions"></div><p id="cipherFeedback" class="arcade-note"></p></div>`);
    const next = () => { if (state.round >= cipherRounds.length) return finish('فتحت الشفرة كاملة — عينك على الأنماط أقوى من الحظ.'); const q = cipherRounds[state.round]; const options = $('#cipherOptions'), feedback = $('#cipherFeedback'); $('#cipherRound').textContent = `الشفرة ${state.round + 1} من ${cipherRounds.length}`; $('#cipherSequence').innerHTML = q.seq.map((x) => `<span class="cipher-token">${esc(x)}</span>`).join('') + '<span class="cipher-token missing">?</span>'; options.innerHTML = ''; shuffle(q.options).forEach((answer) => { const b = document.createElement('button'); b.className = 'secret-option'; b.textContent = answer; b.onclick = () => { options.querySelectorAll('button').forEach((x) => { x.disabled = true; }); const ok = answer === q.answer; b.classList.add(ok ? 'correct' : 'wrong'); if (ok) { state.score += 175; feedback.textContent = 'شفرة صحيحة — القفل يضيء ✨'; play('correct'); } else { state.score = Math.max(0, state.score - 30); feedback.textContent = `الرمز الصحيح: ${q.answer}`; options.querySelectorAll('button').forEach((x) => { if (x.textContent === q.answer) x.classList.add('correct'); }); play('wrong'); } state.aiScore += Math.round(ok ? 100 + Math.random() * 45 : 145 + Math.random() * 40); state.round += 1; hud(); later(next, 850); }; options.appendChild(b); }); }; next();
  }
  function start() { shell(); if (game === 'draw') drawGame(); else if (game === 'secret') secretGame(); else if (game === 'order') orderGame(); else if (game === 'auction') auctionGame(); else cipherGame(); }
  shell();
  const initial = root.querySelector('[data-start]'); if (initial) initial.onclick = start; else start();
}());
