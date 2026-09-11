/* Player progression shared by the arcade and board games.
   It is deliberately local-first: a player can play immediately without an
   account, while the online rooms remain authoritative for multiplayer moves. */
(function () {
  const KEY = 'tahadi-progress-v3';
  const LEGACY_V2 = 'tahadi-progress-v2';
  const LEGACY = 'tahadi-progress-v1';
  const LEGACY_PLAYER = 'tahadi-player';
  const DEFAULT_ITEMS = ['avatar-nova', 'frame-classic', 'table-midnight', 'entrance-focus', 'victory-crown', 'sound-classic'];
  const DEFAULT_EQUIPPED = { avatar: 'avatar-nova', frame: 'frame-classic', table: 'table-midnight', entrance: 'entrance-focus', victory: 'victory-crown', sound: 'sound-classic' };
  const DAILY_REWARDS = [60, 80, 100, 130, 160, 200, 300];
  const MAX_PURCHASE_LOG = 120;
  const MAX_EVENT_LOG = 240;
  let entitlements = { owner: false, infiniteCoins: false, unlockAll: false, username: '' };
  const base = {
    schemaVersion: 3, name: 'لاعب العباقرة', level: 1, xp: 0, coins: 500, wins: 0, games: 0,
    bestScore: 0, bestByGame: {}, titles: ['بداية العباقرة'], achievements: [],
    lastGame: null, streak: 0, daily: { date: '', games: 0, wins: 0 },
    inventory: DEFAULT_ITEMS, equipped: DEFAULT_EQUIPPED, purchaseLog: [], awardLog: [], coinLog: [], starterGrantClaimed: true,
    dailyReward: { lastClaim: '', streak: 0 },
    weekly: { week: '', counters: { games: 0, wins: 0, score: 0 }, claimed: [] },
    botDifficulty: 'auto', revision: 1, serverRevision: 0, updatedAt: 0,
  };

  function finite(value, fallback = 0, max = Number.MAX_SAFE_INTEGER) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.min(max, Math.round(number))) : fallback;
  }
  function uniqueStrings(values, limit = 200) {
    return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || '').slice(0, 80)).filter(Boolean))].slice(0, limit);
  }
  function signed(value, fallback = 0, max = 1_000_000) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(-max, Math.min(max, Math.round(number))) : fallback;
  }
  function cloneBase() {
    return {
      ...base,
      bestByGame: {}, titles: [...base.titles], achievements: [], daily: { ...base.daily },
      inventory: [...DEFAULT_ITEMS], equipped: { ...DEFAULT_EQUIPPED }, purchaseLog: [], awardLog: [], coinLog: [],
      dailyReward: { ...base.dailyReward },
      weekly: { week: '', counters: { games: 0, wins: 0, score: 0 }, claimed: [] },
    };
  }
  function readJson(key) {
    try { const value = JSON.parse(localStorage.getItem(key) || 'null'); return value && typeof value === 'object' ? value : null; }
    catch { return null; }
  }
  function catalog() { return Array.isArray(window.TAHADI_STORE_CATALOG) ? window.TAHADI_STORE_CATALOG : []; }
  function itemById(id) {
    if (window.TAHADI_STORE_BY_ID?.get) return window.TAHADI_STORE_BY_ID.get(String(id)) || null;
    return catalog().find((entry) => entry.id === String(id)) || null;
  }
  function normalizePurchaseLog(value) {
    const seen = new Set();
    const entries = [];
    for (const raw of Array.isArray(value) ? value : []) {
      const txId = String(raw?.txId || '').slice(0, 100);
      const itemId = String(raw?.itemId || '').slice(0, 80);
      if (!txId || !itemId || seen.has(txId)) continue;
      seen.add(txId);
      entries.push({ txId, itemId, price: finite(raw.price, 0, 1_000_000), at: finite(raw.at, 0) });
    }
    return entries.slice(-MAX_PURCHASE_LOG);
  }
  function normalizeCoinLog(value) {
    const seen = new Set();
    const entries = [];
    for (const raw of Array.isArray(value) ? value : []) {
      const id = String(raw?.id || '').slice(0, 120);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      entries.push({ id, kind: String(raw?.kind || 'adjustment').slice(0, 24), amount: signed(raw?.amount), at: finite(raw?.at) });
    }
    return entries.slice(-MAX_EVENT_LOG);
  }
  function createEventId(prefix = 'event') {
    const raw = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `${prefix}:${String(raw).slice(0, 100)}`;
  }
  function applyCoinEvent(profile, entry) {
    const id = String(entry?.id || '').slice(0, 120);
    if (!id || profile.coinLog.some((item) => item.id === id)) return false;
    const amount = signed(entry.amount);
    profile.coins = Math.max(0, finite(profile.coins) + amount);
    profile.coinLog.push({ id, kind: String(entry.kind || 'adjustment').slice(0, 24), amount, at: finite(entry.at || Date.now()) });
    profile.coinLog = profile.coinLog.slice(-MAX_EVENT_LOG);
    return true;
  }
  function normalize(profile = {}) {
    const p = { ...cloneBase(), ...(profile && typeof profile === 'object' ? profile : {}) };
    p.schemaVersion = 3;
    p.name = String(p.name || base.name).normalize('NFKC').trim().slice(0, 20) || base.name;
    for (const field of ['xp', 'coins', 'wins', 'games', 'bestScore', 'streak', 'revision', 'serverRevision', 'updatedAt']) p[field] = finite(p[field], base[field] || 0);
    p.level = Math.max(1, finite(p.level, 1, 1000));
    p.bestByGame = Object.fromEntries(Object.entries(p.bestByGame && typeof p.bestByGame === 'object' ? p.bestByGame : {}).slice(0, 80).map(([key, value]) => [String(key).slice(0, 40), finite(value)]));
    p.titles = uniqueStrings(p.titles?.length ? p.titles : base.titles, 80);
    p.achievements = uniqueStrings(p.achievements, 120);
    p.daily = { date: String(p.daily?.date || '').slice(0, 10), games: finite(p.daily?.games), wins: finite(p.daily?.wins) };
    const inventory = uniqueStrings([...DEFAULT_ITEMS, ...(Array.isArray(p.inventory) ? p.inventory : [])], 200);
    const knownCatalog = catalog();
    const knownIds = new Set(knownCatalog.map((entry) => entry.id));
    p.inventory = knownCatalog.length ? inventory.filter((id) => DEFAULT_ITEMS.includes(id) || knownIds.has(id)) : inventory;
    p.purchaseLog = normalizePurchaseLog(p.purchaseLog);
    p.awardLog = uniqueStrings(p.awardLog, MAX_EVENT_LOG);
    p.coinLog = normalizeCoinLog(p.coinLog);
    p.starterGrantClaimed = Boolean(p.starterGrantClaimed);
    p.dailyReward = { lastClaim: String(p.dailyReward?.lastClaim || '').slice(0, 10), streak: finite(p.dailyReward?.streak, 0, 7) };
    p.weekly = {
      week: String(p.weekly?.week || '').slice(0, 10),
      counters: { games: finite(p.weekly?.counters?.games), wins: finite(p.weekly?.counters?.wins), score: finite(p.weekly?.counters?.score) },
      claimed: uniqueStrings(p.weekly?.claimed, 10),
    };
    p.botDifficulty = ['auto', 'medium', 'pro'].includes(p.botDifficulty) ? p.botDifficulty : 'auto';
    const equipped = { ...DEFAULT_EQUIPPED, ...(p.equipped && typeof p.equipped === 'object' ? p.equipped : {}) };
    p.equipped = { ...DEFAULT_EQUIPPED };
    for (const category of Object.keys(DEFAULT_EQUIPPED)) {
      const id = String(equipped[category] || DEFAULT_EQUIPPED[category]);
      const known = itemById(id);
      p.equipped[category] = p.inventory.includes(id) && (!known || known.category === category) ? id : DEFAULT_EQUIPPED[category];
    }
    return p;
  }
  function persist(profile, { notify = true, bump = true } = {}) {
    const p = normalize(profile);
    if (bump) p.revision = Math.max(1, finite(p.revision) + 1);
    p.updatedAt = Math.max(Date.now(), finite(p.updatedAt));
    try {
      localStorage.setItem(KEY, JSON.stringify(p));
      localStorage.setItem(LEGACY_PLAYER, JSON.stringify({ name: p.name, level: p.level, xp: p.xp }));
    } catch {}
    if (notify) window.dispatchEvent(new CustomEvent('tahadi-progress', { detail: p }));
    return p;
  }
  function read() {
    const current = readJson(KEY);
    const legacy = readJson(LEGACY_V2) || readJson(LEGACY) || readJson(LEGACY_PLAYER);
    if (current) return normalize(current);
    const p = cloneBase();
    if (legacy && typeof legacy === 'object') {
      Object.assign(p, legacy);
      p.coins = finite(legacy.coins) + 500;
      p.starterGrantClaimed = true;
      p.inventory = [...DEFAULT_ITEMS, ...(Array.isArray(legacy.inventory) ? legacy.inventory : [])];
      p.equipped = { ...DEFAULT_EQUIPPED, ...(legacy.equipped || {}) };
      if (legacy.name) p.name = String(legacy.name).slice(0, 20);
    }
    return persist(p, { notify: false, bump: false });
  }
  function save(profile) {
    return persist(profile);
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
    const awardId = String(result.eventId || createEventId(`award:${game}`)).slice(0, 120);
    if (p.awardLog.includes(awardId)) return { ...p, duplicate: true, deltaXp: 0, deltaCoins: 0, game, score, win, eventId: awardId };
    const beforeTitles = new Set(p.titles || []);
    p.games += 1;
    p.lastGame = game;
    p.xp += Math.max(10, Math.round(score * 0.35) + (win ? 45 : 0));
    const deltaCoins = Math.max(3, Math.round(score / 90) + (win ? 20 : 0));
    applyCoinEvent(p, { id: `award:${awardId}`, kind: 'award', amount: deltaCoins, at: Date.now() });
    p.awardLog.push(awardId);
    p.awardLog = p.awardLog.slice(-MAX_EVENT_LOG);
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
    const week = weekKey(today);
    if (p.weekly.week !== week) p.weekly = { week, counters: { games: 0, wins: 0, score: 0 }, claimed: [] };
    p.weekly.counters.games += 1;
    p.weekly.counters.score += score;
    if (win) p.weekly.counters.wins += 1;
    const saved = save(p);
    const detail = { ...saved, unlocked: saved.titles.filter((title) => !beforeTitles.has(title)), deltaXp: Math.max(10, Math.round(score * 0.35) + (win ? 45 : 0)), deltaCoins, game, score, win, eventId: awardId };
    window.dispatchEvent(new CustomEvent('tahadi-award', { detail }));
    return detail;
  }
  function setEntitlements(value = {}) {
    const username = String(value.username || '').normalize('NFKC').trim().toLowerCase();
    const owner = username === 'bosrag' && value.owner === true;
    entitlements = { username: owner ? 'bosrag' : '', owner, infiniteCoins: owner && value.infiniteCoins !== false, unlockAll: owner && value.unlockAll !== false };
    window.dispatchEvent(new CustomEvent('tahadi-entitlements', { detail: { ...entitlements } }));
    return { ...entitlements };
  }
  function isOwner() { return entitlements.owner === true; }
  function isOwned(itemId) { return entitlements.unlockAll === true || read().inventory.includes(String(itemId)); }
  function availableItems() { return catalog().filter((entry) => entitlements.unlockAll || Number(entry.level || 1) <= read().level); }
  function balanceLabel() { return entitlements.infiniteCoins ? '∞' : String(read().coins); }
  function purchase(itemId, transactionId) {
    const item = itemById(itemId);
    if (!item) return { ok: false, error: 'unknown_item', profile: read() };
    const p = read();
    if (p.inventory.includes(item.id)) return { ok: false, error: 'already_owned', profile: p };
    if (!isOwner() && p.level < Number(item.level || 1)) return { ok: false, error: 'level_locked', requiredLevel: Number(item.level || 1), profile: p };
    if (!isOwner() && p.coins < Number(item.price || 0)) return { ok: false, error: 'insufficient_coins', profile: p };
    const txId = String(transactionId || globalThis.crypto?.randomUUID?.() || `${Date.now()}-${item.id}`).slice(0, 100);
    if (p.purchaseLog.some((entry) => entry.txId === txId)) return { ok: false, error: 'duplicate_transaction', profile: p };
    if (!isOwner()) applyCoinEvent(p, { id: `purchase:${txId}`, kind: 'purchase', amount: -Number(item.price || 0), at: Date.now() });
    p.inventory.push(item.id);
    p.purchaseLog.push({ txId, itemId: item.id, price: isOwner() ? 0 : Number(item.price || 0), at: Date.now() });
    const saved = save(p);
    return { ok: true, item, profile: saved };
  }
  function equip(itemId) {
    const item = itemById(itemId);
    const p = read();
    if (!item) return { ok: false, error: 'unknown_item', profile: p };
    if (!entitlements.unlockAll && !p.inventory.includes(item.id)) return { ok: false, error: 'not_owned', profile: p };
    p.equipped[item.category] = item.id;
    if (isOwner() && !p.inventory.includes(item.id)) p.inventory.push(item.id);
    return { ok: true, item, profile: save(p) };
  }
  function utcDay(value) {
    const text = String(value || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(text) && Number.isFinite(Date.parse(`${text}T00:00:00Z`)) ? text : '';
  }
  function daysBetween(a, b) { return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000); }
  function claimDaily(date = new Date().toISOString().slice(0, 10)) {
    const today = utcDay(date);
    const p = read();
    if (!today) return { ok: false, error: 'invalid_date', profile: p };
    if (today !== new Date().toISOString().slice(0, 10)) return { ok: false, error: 'invalid_claim_date', profile: p };
    if (p.dailyReward.lastClaim === today) return { ok: false, error: 'already_claimed', profile: p };
    if (p.dailyReward.lastClaim && daysBetween(p.dailyReward.lastClaim, today) < 1) return { ok: false, error: 'claim_date_not_after_last', profile: p };
    const consecutive = p.dailyReward.lastClaim && daysBetween(p.dailyReward.lastClaim, today) === 1;
    const streak = consecutive ? (p.dailyReward.streak % 7) + 1 : 1;
    const reward = DAILY_REWARDS[streak - 1];
    p.dailyReward = { lastClaim: today, streak };
    if (!isOwner()) applyCoinEvent(p, { id: `daily:${today}`, kind: 'daily', amount: reward, at: Date.now() });
    return { ok: true, reward, profile: save(p) };
  }
  function weekKey(date = new Date().toISOString().slice(0, 10)) {
    const value = new Date(`${utcDay(date) || new Date().toISOString().slice(0, 10)}T00:00:00Z`);
    const day = value.getUTCDay() || 7;
    value.setUTCDate(value.getUTCDate() - day + 1);
    return value.toISOString().slice(0, 10);
  }
  function recordMission(event = {}) {
    const p = read();
    const week = weekKey(event.date);
    if (p.weekly.week !== week) p.weekly = { week, counters: { games: 0, wins: 0, score: 0 }, claimed: [] };
    p.weekly.counters.games += finite(event.games);
    p.weekly.counters.wins += finite(event.wins);
    p.weekly.counters.score += finite(event.score);
    return save(p);
  }
  function claimWeekly(missionId, date = new Date().toISOString().slice(0, 10)) {
    const missions = {
      games: { counter: 'games', target: 7, reward: 160 },
      wins: { counter: 'wins', target: 3, reward: 220 },
      score: { counter: 'score', target: 5000, reward: 260 },
    };
    const mission = missions[String(missionId)];
    const p = read();
    if (!mission) return { ok: false, error: 'unknown_mission', profile: p };
    const week = weekKey(date);
    if (p.weekly.week !== week) p.weekly = { week, counters: { games: 0, wins: 0, score: 0 }, claimed: [] };
    if (p.weekly.claimed.includes(String(missionId))) return { ok: false, error: 'already_claimed', profile: p };
    if (finite(p.weekly.counters[mission.counter]) < mission.target) return { ok: false, error: 'mission_incomplete', target: mission.target, profile: p };
    p.weekly.claimed.push(String(missionId));
    if (!isOwner()) applyCoinEvent(p, { id: `weekly:${week}:${missionId}`, kind: 'weekly', amount: mission.reward, at: Date.now() });
    return { ok: true, reward: mission.reward, profile: save(p) };
  }
  function merge(remote = {}) {
    const local = read();
    const incoming = normalize(remote);
    const merged = normalize(local);
    for (const field of ['xp', 'level', 'wins', 'games', 'bestScore', 'streak']) merged[field] = Math.max(finite(local[field]), finite(incoming[field]));
    const incomingIsNewer = finite(incoming.revision) > finite(local.revision)
      || (finite(incoming.revision) === finite(local.revision) && finite(incoming.updatedAt) > finite(local.updatedAt));
    const preferred = incomingIsNewer ? incoming : local;
    const secondary = incomingIsNewer ? local : incoming;
    merged.coins = finite(preferred.coins);
    const preferredCoinIds = new Set((preferred.coinLog || []).map((entry) => entry.id));
    for (const entry of secondary.coinLog || []) {
      if (!preferredCoinIds.has(entry.id)) merged.coins = Math.max(0, merged.coins + signed(entry.amount));
    }
    merged.coinLog = normalizeCoinLog([...(preferred.coinLog || []), ...(secondary.coinLog || [])]);
    const gameKeys = new Set([...Object.keys(local.bestByGame || {}), ...Object.keys(incoming.bestByGame || {})]);
    merged.bestByGame = Object.fromEntries([...gameKeys].map((key) => [key, Math.max(finite(local.bestByGame?.[key]), finite(incoming.bestByGame?.[key]))]));
    merged.titles = uniqueStrings([...(local.titles || []), ...(incoming.titles || [])], 80);
    merged.achievements = uniqueStrings([...(local.achievements || []), ...(incoming.achievements || [])], 120);
    merged.inventory = uniqueStrings([...(local.inventory || []), ...(incoming.inventory || [])], 200);
    merged.purchaseLog = normalizePurchaseLog([...(local.purchaseLog || []), ...(incoming.purchaseLog || [])]);
    merged.awardLog = uniqueStrings([...(local.awardLog || []), ...(incoming.awardLog || [])], MAX_EVENT_LOG);
    if (finite(incoming.updatedAt) >= finite(local.updatedAt)) {
      for (const category of Object.keys(DEFAULT_EQUIPPED)) {
        const id = incoming.equipped?.[category];
        if (id && merged.inventory.includes(id)) merged.equipped[category] = id;
      }
      merged.botDifficulty = incoming.botDifficulty;
      merged.dailyReward = incoming.dailyReward;
      merged.weekly = incoming.weekly;
    }
    merged.revision = Math.max(finite(local.revision), finite(incoming.revision));
    merged.serverRevision = Math.max(finite(local.serverRevision), finite(incoming.serverRevision));
    return save(merged);
  }
  function acknowledgeServer(value) {
    const p = read();
    p.serverRevision = Math.max(finite(p.serverRevision), finite(value?.serverRevision ?? value));
    return persist(p, { notify: false, bump: false });
  }
  function setBotDifficulty(value) {
    const p = read();
    p.botDifficulty = ['auto', 'medium', 'pro'].includes(value) ? value : 'auto';
    return save(p).botDifficulty;
  }
  function botDifficulty() { return read().botDifficulty || 'auto'; }
  function escapeHtml(value) { return String(value || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c])); }
  function mount(element) {
    if (!element) return;
    const p = read();
    element.innerHTML = `<div class="arcade-avatar">${escapeHtml((p.name || 'ل').slice(0, 1))}</div><div><b>${escapeHtml(p.name)}</b><small>المستوى ${p.level} • ${p.xp} XP • ${balanceLabel()} 🪙</small></div><div class="level">${escapeHtml(p.titles?.at(-1) || 'بداية العباقرة')}</div>`;
  }
  function ensureNewGames() {
    const list = document.querySelector('#games .games');
    if (!list) return;
    const games = [
      ['draw', '🎨', 'ارسم وخمّن', 'ارسم الكلمة بسرعة واجعل خصمك يلتقط الفكرة.', 'إبداع • سرعة', 'AI', 'جولة 90 ثانية'],
      ['secret', '🔐', 'كلمة السر', 'فك الدليل واختر الكلمة قبل خصمك.', 'لغز • معرفة', 'AI', '6 جولات'],
      ['order', '🏁', 'سباق الترتيب', 'رتّب العناصر بسرعة ودقة.', 'ترتيب • تركيز', 'AI', '5 جولات'],
      ['memory', '🧠', 'تحدي الذاكرة', 'احفظ الأرقام والرموز والصور قبل اختفائها.', 'ذاكرة • ملاحظة', 'AI', '18 سؤالًا'],
      ['auction', '💰', 'المزاد الذكي', 'راهن بذكاء واربح نقاطًا مضاعفة.', 'مخاطرة • قرار', 'AI', '5 جولات'],
      ['cipher', '🔮', 'شفرة العباقرة', 'اكتشف الرمز الناقص وافتح القفل.', 'منطق • أنماط', 'AI', '6 شفرات'],
      ['spotdiff', '🔍', 'فرق تعرف', 'اكتشف الفروقات الخمسة قبل خصمك.', 'ملاحظة • سرعة', 'فردي + أونلاين', '5 فروقات'],
    ];
    list.innerHTML = '';
    const fragment = document.createDocumentFragment();
    games.forEach(([route, icon, title, desc, difference, mode, duration], index) => {
      const card = document.createElement('a');
      card.className = 'bs-panel game'; card.href = `/${route}`; card.dataset.newGameLink = route;
      card.innerHTML = `<div class="game-topline"><span class="game-rank">${index + 1}</span><span class="ico">${icon}</span><span class="bs-chip">${mode}</span></div><div><h3>${title}</h3><p>${desc}</p></div><div class="game-difference"><span>${difference}</span><span>${duration}</span></div>`;
      fragment.appendChild(card);
    });
    list.appendChild(fragment);
    const count = document.querySelector('.hero-showcase .stat:nth-of-type(2) b');
    if (count) count.textContent = String(list.querySelectorAll('.game').length);
  }
  function refreshHome() {
    ensureNewGames();
    const gamesHeading = document.querySelector('#games .head h2');
    const gamesCopy = document.querySelector('#games .head p');
    if (gamesHeading) gamesHeading.textContent = 'ترتيب الألعاب والفروقات';
    if (gamesCopy) gamesCopy.textContent = 'من الأعلى إلى الأسفل — كل بطاقة توضّح نوع التحدي ومدته وما يميّزه.';
    const byId = (id) => document.getElementById(id);
    if (!byId('playerName')) return;
    const p = read();
    const values = { playerName: p.name, level: p.level, xpText: p.xp, winsText: p.wins, gamesText: p.games, bestText: p.bestScore, coinsText: balanceLabel(), titleText: p.titles?.at(-1) || 'بداية العباقرة', rankText: rankFor(p.level), avatar: itemById(p.equipped.avatar)?.preview || (p.name || 'ل').slice(0, 1) };
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
  window.TAHADI_PROGRESS = {
    read, save, award, mount, levelFor, levelBounds, xpProgress, rankFor,
    purchase, equip, claimDaily, recordMission, claimWeekly, merge, acknowledgeServer, setEntitlements, isOwner, isOwned,
    availableItems, balanceLabel, setBotDifficulty, botDifficulty,
    catalog, item: itemById, titles: () => read().titles,
  };
  window.addEventListener('DOMContentLoaded', refreshHome, { once: true });
})();
