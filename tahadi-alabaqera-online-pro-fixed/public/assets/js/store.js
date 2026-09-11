(function () {
  const categories = ['avatar', 'frame', 'table', 'entrance', 'victory', 'sound'];
  const labels = { avatar: 'الشخصيات', frame: 'الإطارات', table: 'الطاولات', entrance: 'الدخول', victory: 'الفوز', sound: 'الصوتيات' };
  const rarityLabels = { free: 'أساسي', common: 'شائع', rare: 'نادر', epic: 'ملحمي', legendary: 'أسطوري' };

  function hash(text) {
    let value = 2166136261;
    for (const char of String(text)) value = Math.imul(value ^ char.charCodeAt(0), 16777619) >>> 0;
    return value;
  }
  function validDate(value) {
    const text = String(value || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : new Date().toISOString().slice(0, 10);
  }
  function rotationForDate(date, catalog = window.TAHADI_STORE_CATALOG || []) {
    const day = validDate(date);
    return categories.map((category) => {
      const pool = catalog.filter((item) => item.category === category && item.price > 0);
      return pool[hash(`${day}:${category}`) % pool.length];
    }).filter(Boolean);
  }
  function statusForItem(item, profile, owner = false) {
    if (profile?.equipped?.[item.category] === item.id) return { kind: 'equipped', label: 'مجهّز الآن' };
    if (owner) return { kind: 'owner', label: 'متاح للمدير' };
    if (profile?.inventory?.includes(item.id)) return { kind: 'owned', label: 'تجهيز' };
    if (Number(profile?.level || 1) < Number(item.level || 1)) return { kind: 'level_locked', label: `يفتح بالمستوى ${item.level}` };
    if (Number(profile?.coins || 0) < Number(item.price || 0)) return { kind: 'insufficient', label: 'الرصيد غير كافٍ' };
    return { kind: 'buy', label: item.price ? `شراء • ${item.price} 🪙` : 'مجاني' };
  }

  const api = { rotationForDate, statusForItem, categories: [...categories] };
  window.TAHADI_STORE_UI = api;
  if (!document) return;

  const byId = (id) => document.getElementById(id);
  const catalog = window.TAHADI_STORE_CATALOG || [];
  let activeCategory = 'featured';
  let selectedId = rotationForDate(new Date().toISOString().slice(0, 10), catalog)[0]?.id || catalog[0]?.id;

  function item(id) { return catalog.find((entry) => entry.id === id) || null; }
  function profile() { return window.TAHADI_PROGRESS?.read?.() || { level: 1, coins: 0, inventory: [], equipped: {} }; }
  function owner() { return Boolean(window.TAHADI_PROGRESS?.isOwner?.()); }
  function colors(entry) { return Array.isArray(entry?.colors) ? entry.colors : ['#8b5cf6', '#22d3ee']; }
  function announce(message) {
    const live = byId('shopLive');
    if (live) live.textContent = message;
    window.BS_PLATFORM?.toast?.(message);
  }
  function glyph(entry, large = false) {
    if (window.TAHADI_ICONS?.render) return window.TAHADI_ICONS.render(entry, { large });
    const [one, two] = colors(entry);
    return `<span class="cosmetic-glyph ${large ? 'large' : ''} cat-${entry.category}" style="--item-one:${one};--item-two:${two}" aria-hidden="true"><i>${entry.preview}</i></span>`;
  }
  function visibleItems() {
    return activeCategory === 'featured'
      ? rotationForDate(new Date().toISOString().slice(0, 10), catalog)
      : catalog.filter((entry) => entry.category === activeCategory);
  }
  function renderHeader() {
    const p = profile();
    const balance = window.TAHADI_PROGRESS?.balanceLabel?.() ?? p.coins;
    if (byId('shopBalance')) byId('shopBalance').textContent = balance;
    if (byId('shopLevel')) byId('shopLevel').textContent = p.level;
    if (byId('shopPlayer')) byId('shopPlayer').textContent = p.name || 'لاعب العباقرة';
    byId('shopOwnerBadge')?.classList.toggle('hidden', !owner());
  }
  function renderGrid() {
    const grid = byId('shopGrid');
    if (!grid) return;
    const p = profile();
    grid.innerHTML = visibleItems().map((entry) => {
      const status = statusForItem(entry, p, owner());
      const selected = entry.id === selectedId;
      return `<button type="button" class="shop-item rarity-${entry.rarity}${selected ? ' selected' : ''}" data-item-id="${entry.id}" aria-pressed="${selected}">
        <span class="shop-item-top"><span class="rarity">${rarityLabels[entry.rarity] || entry.rarity}</span><span class="item-state state-${status.kind}">${status.kind === 'equipped' ? '✓ مجهز' : status.kind === 'owned' || status.kind === 'owner' ? 'مملوك' : entry.price ? `${entry.price} 🪙` : 'مجاني'}</span></span>
        ${glyph(entry)}
        <span class="shop-item-copy"><b>${entry.name}</b><small>${labels[entry.category]} • المستوى ${entry.level}</small></span>
      </button>`;
    }).join('');
    grid.querySelectorAll('[data-item-id]').forEach((button) => button.addEventListener('click', () => {
      selectedId = button.dataset.itemId;
      renderGrid();
      renderPreview();
    }));
  }
  function actionMarkup(entry, status) {
    const disabled = ['equipped', 'insufficient', 'level_locked'].includes(status.kind);
    return `<button id="shopAction" type="button" class="bs-btn ${status.kind === 'buy' ? 'gold' : 'primary'}" ${disabled ? 'disabled' : ''}>${status.label}</button>`;
  }
  function renderPreview() {
    const panel = byId('shopPreview');
    const entry = item(selectedId);
    if (!panel || !entry) return;
    const status = statusForItem(entry, profile(), owner());
    panel.dataset.category = entry.category;
    panel.innerHTML = `<div class="preview-stage">${glyph(entry, true)}<div class="preview-rings" aria-hidden="true"></div></div>
      <div class="preview-copy"><span class="preview-kicker">${rarityLabels[entry.rarity]} • ${labels[entry.category]}</span><h2>${entry.name}</h2><p>${previewDescription(entry)}</p><div class="preview-meta"><span>المستوى ${entry.level}</span><span>${entry.price ? `${entry.price} عملة` : 'مجاني'}</span></div>${actionMarkup(entry, status)}</div>`;
    byId('shopAction')?.addEventListener('click', () => actOn(entry, status));
  }
  function previewDescription(entry) {
    const copy = {
      avatar: 'شخصية مرسومة تظهر في ملفك وشاشة المواجهة والنتائج.',
      frame: 'إطار يحيط بشخصيتك ويبرز هويتك أمام المنافسين.',
      table: 'خامة لونية تطبق على ساحات وطاولات اللعب المتوافقة.',
      entrance: 'مشهد دخول قصير قبل المواجهة مع حركة وإضاءة خاصة.',
      victory: 'احتفال مميز يظهر عند الفوز دون أن يحجب أزرار التحكم.',
      sound: 'هوية صوتية تستخدم تنويعات من مؤثرات اللعبة المحلية.',
    };
    return copy[entry.category] || 'عنصر تجميلي لحسابك.';
  }
  function transactionId(entry) {
    return window.crypto?.randomUUID?.() || `${Date.now()}-${entry.id}`;
  }
  function closePurchaseModal() {
    document.getElementById('shopPurchaseModal')?.remove();
  }
  function flyCoins(fromEl) {
    if (!fromEl) return;
    const wallet = byId('shopBalance');
    if (!wallet) return;
    const start = fromEl.getBoundingClientRect();
    const end = wallet.getBoundingClientRect();
    for (let i = 0; i < 6; i++) {
      const coin = document.createElement('span');
      coin.className = 'coin-fly';
      coin.textContent = '🪙';
      coin.style.left = `${start.left + start.width / 2}px`;
      coin.style.top = `${start.top + start.height / 2}px`;
      coin.style.setProperty('--dx', `${end.left - start.left + (Math.random() * 20 - 10)}px`);
      coin.style.setProperty('--dy', `${end.top - start.top}px`);
      coin.style.animationDelay = `${i * 45}ms`;
      document.body.appendChild(coin);
      coin.addEventListener('animationend', () => coin.remove());
    }
  }
  function showPurchaseModal(entry, status) {
    closePurchaseModal();
    const p = profile();
    const balance = owner() ? '∞' : Number(p.coins || 0);
    const after = owner() ? '∞' : Math.max(0, Number(p.coins || 0) - Number(entry.price || 0));
    const modal = document.createElement('div');
    modal.id = 'shopPurchaseModal';
    modal.className = 'shop-modal-backdrop';
    modal.innerHTML = `<div class="shop-modal" role="dialog" aria-modal="true" aria-labelledby="shopModalTitle">
      <button type="button" class="shop-modal-close" data-modal-close aria-label="إغلاق">✕</button>
      ${glyph(entry, true)}
      <span class="preview-kicker">${rarityLabels[entry.rarity]} • ${labels[entry.category]}</span>
      <h2 id="shopModalTitle">تأكيد شراء «${entry.name}»</h2>
      <div class="shop-modal-ledger">
        <div><span>السعر</span><b>${entry.price} 🪙</b></div>
        <div><span>رصيدك الحالي</span><b>${balance}</b></div>
        <div class="after"><span>الرصيد بعد الشراء</span><b>${after}</b></div>
      </div>
      <div class="shop-modal-actions">
        <button type="button" class="bs-btn gold" data-modal-confirm>تأكيد الشراء</button>
        <button type="button" class="bs-btn" data-modal-cancel>إلغاء</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('show'));
    const close = () => { modal.classList.remove('show'); document.removeEventListener('keydown', onKey); setTimeout(() => modal.remove(), 200); };
    const onKey = (event) => { if (event.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    modal.addEventListener('click', (event) => { if (event.target === modal) close(); });
    modal.querySelector('[data-modal-close]')?.addEventListener('click', close);
    modal.querySelector('[data-modal-cancel]')?.addEventListener('click', close);
    modal.querySelector('[data-modal-confirm]')?.addEventListener('click', () => {
      const glyphEl = modal.querySelector('.cosmetic-glyph');
      const result = window.TAHADI_PROGRESS.purchase(entry.id, transactionId(entry));
      if (!result.ok) { announce(result.error === 'insufficient_coins' ? 'رصيدك لا يكفي لهذا العنصر' : 'تعذر إتمام الشراء'); return close(); }
      window.TAHADI_PROGRESS.equip(entry.id);
      flyCoins(glyphEl);
      announce(`تم شراء وتجهيز ${entry.name}`);
      window.BS_AUDIO?.play?.('coin');
      close();
      refresh();
    });
  }
  function actOn(entry, status) {
    if (status.kind === 'owned' || status.kind === 'owner') {
      const result = window.TAHADI_PROGRESS.equip(entry.id);
      if (result.ok) announce(`تم تجهيز ${entry.name}`);
      return refresh();
    }
    if (status.kind !== 'buy') return;
    showPurchaseModal(entry, status);
  }
  function renderDaily() {
    const p = profile();
    const today = new Date().toISOString().slice(0, 10);
    const claimed = p.dailyReward?.lastClaim === today;
    const nextDay = claimed ? p.dailyReward.streak : (p.dailyReward?.streak || 0) % 7 + 1;
    const rewards = [60, 80, 100, 130, 160, 200, 300];
    const node = byId('dailyReward');
    if (!node) return;
    node.innerHTML = `<div><span class="section-kicker">هدية العودة</span><h2>المكافأة اليومية</h2><p>استمر سبعة أيام لتحصل على مكافأة أكبر.</p></div><div class="daily-track">${rewards.map((reward, index) => `<span class="${index + 1 === nextDay ? 'today' : ''} ${index + 1 <= Number(p.dailyReward?.streak || 0) && claimed ? 'done' : ''}"><b>${index + 1}</b><small>${reward}</small></span>`).join('')}</div><button id="claimDaily" class="bs-btn gold" ${claimed ? 'disabled' : ''}>${claimed ? 'تم الاستلام اليوم ✓' : 'استلم المكافأة'}</button>`;
    byId('claimDaily')?.addEventListener('click', () => {
      const result = window.TAHADI_PROGRESS.claimDaily(today);
      if (result.ok) announce(`+${result.reward} عملة — مكافأة اليوم`);
      refresh();
    });
  }
  function renderMissions() {
    const p = profile();
    const missions = [
      { id: 'games', title: 'المثابر', copy: 'العب 7 مباريات', value: p.weekly?.counters?.games || 0, target: 7, reward: 160 },
      { id: 'wins', title: 'سلسلة الفوز', copy: 'حقق 3 انتصارات', value: p.weekly?.counters?.wins || 0, target: 3, reward: 220 },
      { id: 'score', title: 'جامع النقاط', copy: 'اجمع 5000 نقطة', value: p.weekly?.counters?.score || 0, target: 5000, reward: 260 },
    ];
    const box = byId('weeklyMissions');
    if (!box) return;
    box.innerHTML = missions.map((mission) => {
      const claimed = p.weekly?.claimed?.includes(mission.id);
      const complete = mission.value >= mission.target;
      const percent = Math.min(100, Math.round(mission.value / mission.target * 100));
      return `<article class="mission-card"><div><span>${mission.title}</span><b>${mission.copy}</b><small>${Math.min(mission.value, mission.target)} / ${mission.target}</small></div><div class="mission-progress"><i style="width:${percent}%"></i></div><button class="bs-btn" data-mission="${mission.id}" ${!complete || claimed ? 'disabled' : ''}>${claimed ? 'تم ✓' : `+${mission.reward} 🪙`}</button></article>`;
    }).join('');
    box.querySelectorAll('[data-mission]').forEach((button) => button.addEventListener('click', () => {
      const result = window.TAHADI_PROGRESS.claimWeekly(button.dataset.mission);
      if (result.ok) announce(`+${result.reward} عملة — أنجزت المهمة`);
      refresh();
    }));
  }
  function renderHistory() {
    const list = byId('purchaseHistory');
    if (!list) return;
    const entries = [...(profile().purchaseLog || [])].slice(-8).reverse();
    list.innerHTML = entries.length ? entries.map((entry) => {
      const bought = item(entry.itemId);
      return `<li><span>${bought?.preview || '✓'}</span><div><b>${bought?.name || entry.itemId}</b><small>${new Date(entry.at || Date.now()).toLocaleDateString('ar-SA')}</small></div><strong>${entry.price ? `−${entry.price}` : 'مفتوح'}</strong></li>`;
    }).join('') : '<li class="empty-history">لم تشترِ عناصر بعد — هدية البداية بانتظارك.</li>';
  }
  function refresh() {
    renderHeader();
    renderGrid();
    renderPreview();
    renderDaily();
    renderMissions();
    renderHistory();
  }
  function init() {
    document.querySelectorAll('[data-category]').forEach((button) => button.addEventListener('click', () => {
      activeCategory = button.dataset.category;
      document.querySelectorAll('[data-category]').forEach((entry) => entry.classList.toggle('active', entry === button));
      selectedId = visibleItems()[0]?.id || selectedId;
      refresh();
    }));
    window.addEventListener('tahadi-progress', refresh);
    window.addEventListener('tahadi-entitlements', refresh);
    refresh();
    window.BS_SOCIAL?.me?.(true).then(refresh).catch(() => {});
  }
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
