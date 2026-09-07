/* Player progression shared by the arcade and board games.
   It is deliberately local-first: a player can play immediately without an
   account, while the online rooms remain authoritative for multiplayer moves. */
(function () {
  const KEY = 'tahadi-progress-v2';
  const LEGACY = 'tahadi-progress-v1';
  const LEGACY_PLAYER = 'tahadi-player';
  const base = {
    name: 'لاعب العباقرة', level: 1, xp: 0, coins: 0, wins: 0, games: 0,
    bestScore: 0, bestByGame: {}, titles: ['بداية العباقرة'], achievements: [],
    lastGame: null, streak: 0, daily: { date: '', games: 0, wins: 0 },
  };

  function readJson(key) {
    try { const value = JSON.parse(localStorage.getItem(key) || 'null'); return value && typeof value === 'object' ? value : null; }
    catch { return null; }
  }
  function read() {
    const current = readJson(KEY);
    const legacy = readJson(LEGACY) || readJson(LEGACY_PLAYER);
    const p = { ...base, ...(current || {}) };
    p.bestByGame = { ...base.bestByGame, ...(current?.bestByGame || {}) };
    p.titles = Array.isArray(p.titles) && p.titles.length ? [...new Set(p.titles)] : [...base.titles];
    p.achievements = Array.isArray(p.achievements) ? [...new Set(p.achievements)] : [];
    p.daily = { ...base.daily, ...(p.daily || {}) };
    if (legacy) {
      if (legacy.name && (!current || p.name === base.name)) p.name = String(legacy.name).slice(0, 20);
      if (Number(legacy.level) > p.level) p.level = Number(legacy.level);
      if (Number(legacy.xp) > p.xp) p.xp = Number(legacy.xp);
    }
    return p;
  }
  function save(profile) {
    const p = { ...base, ...profile, bestByGame: { ...base.bestByGame, ...(profile.bestByGame || {}) } };
    try {
      localStorage.setItem(KEY, JSON.stringify(p));
      localStorage.setItem(LEGACY_PLAYER, JSON.stringify({ name: p.name, level: p.level, xp: p.xp }));
    } catch {}
    window.dispatchEvent(new CustomEvent('tahadi-progress', { detail: p }));
    return p;
  }
  function levelFor(xp) { return Math.max(1, Math.floor(Math.sqrt(Math.max(0, Number(xp) || 0) / 80)) + 1); }
  function levelBounds(level) {
    const n = Math.max(1, Number(level) || 1);
    return { start: (n - 1) ** 2 * 80, end: n ** 2 * 80 };
  }
  function xpProgress(profile) {
    const bounds = levelBounds(profile.level);
    return Math.max(0, Math.min(100, Math.round(((Number(profile.xp) - bounds.start) / Math.max(1, bounds.end - bounds.start)) * 100)));
  }
  function rankFor(level) { return Number(level) >= 15 ? 'GOLD' : Number(level) >= 8 ? 'SILVER' : 'BRONZE'; }
  function titleFor(p, game) {
    const titles = new Set(p.titles || []);
    titles.add('بداية العباقرة');
    if (p.games >= 5) titles.add('المنافس الصاعد');
    if (p.games >= 10) titles.add('متعدد المهارات');
    if (p.wins >= 5) titles.add('سريع البديهة');
    if (p.streak >= 3) titles.add('سلسلة انتصارات');
    if (game === 'logic' && Number(p.bestByGame.logic) >= 700) titles.add('عبقري المنطق');
    if (game === 'cipher' && Number(p.bestByGame.cipher) >= 700) titles.add('فكّاك الشفرات');
    if (game === 'auction' && Number(p.bestByGame.auction) >= 500) titles.add('صاحب المخاطرة');
    if (game === 'order' && Number(p.bestByGame.order) >= 650) titles.add('سيد الترتيب');
    if (game === 'draw' && Number(p.bestByGame.draw) >= 600) titles.add('ريشة العباقرة');
    if (game === 'secret' && Number(p.bestByGame.secret) >= 650) titles.add('كاشف الأسرار');
    if (game === 'reaction' && Number(p.bestByGame.reaction) >= 1500) titles.add('خاطف اللحظة');
    if (game === 'accuracy' && Number(p.bestByGame.accuracy) >= 2400) titles.add('عين الصقر');
    if (p.level >= 15) titles.add('العقل الحديدي');
    if (p.bestScore >= 1200) titles.add('ملك التحديات');
    return [...titles];
  }
  function award(result = {}) {
    const p = read();
    const game = String(result.game || 'arcade');
    const score = Math.max(0, Math.round(Number(result.score) || 0));
    const win = Boolean(result.win);
    const beforeTitles = new Set(p.titles || []);
    p.games += 1;
    p.lastGame = game;
    p.xp += Math.max(10, Math.round(score * 0.35) + (win ? 45 : 0));
    p.coins += Math.max(3, Math.round(score / 90) + (win ? 20 : 0));
    if (win) { p.wins += 1; p.streak += 1; } else p.streak = 0;
    p.bestScore = Math.max(Number(p.bestScore) || 0, score);
    p.bestByGame[game] = Math.max(Number(p.bestByGame[game]) || 0, score);
    const today = new Date().toISOString().slice(0, 10);
    if (p.daily.date !== today) p.daily = { date: today, games: 0, wins: 0 };
    p.daily.games += 1;
    if (win) p.daily.wins += 1;
    p.level = levelFor(p.xp);
    p.titles = titleFor(p, game);
    p.achievements = [...new Set([...(p.achievements || []), ...(p.games >= 10 ? ['10 مباريات'] : []), ...(p.wins >= 5 ? ['5 انتصارات'] : []), ...(p.daily.games >= 3 ? ['تحدي اليوم'] : [])])];
    const saved = save(p);
    return { ...saved, unlocked: saved.titles.filter((title) => !beforeTitles.has(title)), deltaXp: Math.max(10, Math.round(score * 0.35) + (win ? 45 : 0)), deltaCoins: Math.max(3, Math.round(score / 90) + (win ? 20 : 0)) };
  }
  function escapeHtml(value) { return String(value || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c])); }
  function mount(element) {
    if (!element) return;
    const p = read();
    element.innerHTML = `<div class="arcade-avatar">${escapeHtml((p.name || 'ل').slice(0, 1))}</div><div><b>${escapeHtml(p.name)}</b><small>المستوى ${p.level} • ${p.xp} XP • ${p.coins} 🪙</small></div><div class="level">${escapeHtml(p.titles?.at(-1) || 'بداية العباقرة')}</div>`;
  }
  function ensureNewGames() {
    const list = document.querySelector('#games .games');
    if (!list || list.querySelector('[data-new-game-link]')) return;
    const games = [
      ['draw', '🎨', 'ارسم وخمّن', 'ارسم الكلمة بسرعة واجعل خصمك يلتقط الفكرة.'],
      ['secret', '🔐', 'كلمة السر', 'فك الدليل واختر الكلمة قبل خصمك.'],
      ['order', '🏁', 'سباق الترتيب', 'رتّب العناصر بسرعة ودقة.'],
      ['auction', '💰', 'المزاد الذكي', 'راهن بذكاء واربح نقاطًا مضاعفة.'],
      ['cipher', '🔮', 'شفرة العباقرة', 'اكتشف الرمز الناقص وافتح القفل.'],
    ];
    const fragment = document.createDocumentFragment();
    for (const [route, icon, title, desc] of games) {
      const card = document.createElement('a');
      card.className = 'bs-panel game'; card.href = `/${route}`; card.dataset.newGameLink = route;
      card.innerHTML = `<div class="ico">${icon}</div><div><h3>${title}</h3><p>${desc}</p></div><span class="bs-chip">جديد • AI</span>`;
      fragment.appendChild(card);
    }
    list.prepend(fragment);
    const count = document.querySelector('.hero-showcase .stat:nth-of-type(2) b');
    if (count) count.textContent = String(list.querySelectorAll('.game').length);
  }
  function refreshHome() {
    ensureNewGames();
    const byId = (id) => document.getElementById(id);
    if (!byId('playerName')) return;
    const p = read();
    const values = { playerName: p.name, level: p.level, xpText: p.xp, winsText: p.wins, gamesText: p.games, bestText: p.bestScore, coinsText: p.coins, titleText: p.titles?.at(-1) || 'بداية العباقرة', rankText: rankFor(p.level), avatar: (p.name || 'ل').slice(0, 1) };
    for (const [id, value] of Object.entries(values)) if (byId(id)) byId(id).textContent = value;
    if (byId('xpBar')) byId('xpBar').style.width = `${xpProgress(p)}%`;
    const tournament = document.querySelector('#tournaments .tournament');
    if (tournament) {
      const complete = Math.min(3, Number(p.daily?.games) || 0);
      const title = tournament.querySelector('b');
      const copy = tournament.querySelector('small');
      const chip = tournament.querySelector('.bs-chip');
      if (title) title.textContent = complete >= 3 ? '🏆 أنجزت تحدي اليوم' : '🏆 تحدي اليوم';
      if (copy) copy.textContent = 'أكمل 3 مباريات في أي تحدٍ لتحصل على إنجاز اليوم.';
      if (chip) chip.textContent = `${complete} / 3`;
    }
    const online = byId('onlineCount');
    if (online) fetch('/api/health', { cache: 'no-store' }).then((response) => { online.textContent = response.ok ? 'متصل' : 'غير متصل'; }).catch(() => { online.textContent = 'غير متصل'; });
  }
  window.TAHADI_PROGRESS = { read, save, award, mount, levelFor, levelBounds, xpProgress, rankFor, titles: () => read().titles };
  window.addEventListener('DOMContentLoaded', refreshHome, { once: true });
})();
