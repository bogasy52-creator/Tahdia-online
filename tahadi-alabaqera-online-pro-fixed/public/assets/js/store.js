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

  const availableCatalog = window.TAHADI_STORE_CATALOG || [];

  function safeToken(value) {
    return String(value || 'classic').replace(/[^a-z0-9-]/gi, '').slice(0, 48) || 'classic';
  }
  function safeColor(value, fallback) {
    const color = String(value || '');
    return /^#[0-9a-f]{3,8}$/i.test(color) ? color : fallback;
  }
  function usageForCategory(category) {
    return ({
      avatar: 'تظهر الشخصية في بطاقة اللاعب وشاشة الدخول والنتيجة داخل جميع الألعاب.',
      frame: 'يحيط الإطار بشخصيتك في بطاقة اللاعب والمواجهة ويظهر للمنافس.',
      table: 'تتغير ألوان وإضاءة ساحة اللعب والطاولة فور تجهيز هذا العنصر.',
      entrance: 'يعمل مرة واحدة عند بداية المباراة ولا يتكرر مع كل سؤال.',
      victory: 'يظهر احتفال الفوز بعد انتصارك فقط مع حفظ المكافأة والتقدم.',
      sound: 'تظهر عبارات الحزمة في زر «الصوتيات والعبارات» داخل كل لعبة، وتتغير معها نغمة المؤثرات.',
    })[category] || 'عنصر تجميلي يظهر مباشرة بعد تجهيزه.';
  }

  function renderArtwork(entry) {
    const category = categories.includes(entry?.category) ? entry.category : 'avatar';
    const id = safeToken(entry?.id);
    const one = safeColor(entry?.colors?.[0], '#8b5cf6');
    const two = safeColor(entry?.colors?.[1], '#22d3ee');
    const gradient = `art-${id}`;
    const defs = `<defs><linearGradient id="${gradient}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${one}"/><stop offset="1" stop-color="${two}"/></linearGradient><radialGradient id="${gradient}-glow"><stop stop-color="#fff" stop-opacity=".7"/><stop offset="1" stop-color="${one}" stop-opacity="0"/></radialGradient></defs>`;
    const seed = hash(id) % 4;
    let art = '';
    if (category === 'avatar') {
      const accessory = [
        '<path d="M48 70 63 36l15 30m54 4-15-34-15 30" fill="none" stroke="#fff" stroke-opacity=".72" stroke-width="7" stroke-linecap="round"/>',
        '<path d="M45 76c16-29 74-40 91-2l-12 12H57Z" fill="url(#' + gradient + ')" stroke="#fff" stroke-opacity=".45" stroke-width="3"/>',
        '<path d="M55 59h70l-9-25-18 16-17-18-15 18-18-15Z" fill="url(#' + gradient + ')" stroke="#fff" stroke-opacity=".55" stroke-width="3"/>',
        '<path d="M43 76c7-31 32-50 47-50s40 19 47 50l-18 8H61Z" fill="#10182d" stroke="url(#' + gradient + ')" stroke-width="6"/>',
      ][seed];
      art = `<circle cx="90" cy="90" r="76" fill="#090f20" stroke="url(#${gradient})" stroke-width="5"/><circle cx="90" cy="72" r="38" fill="#e9c7a6"/><path d="M35 158c4-40 26-60 55-60s51 20 55 60" fill="url(#${gradient})"/><path d="M56 71c5-33 62-42 70 0-13-9-22-15-35-15s-22 6-35 15Z" fill="#12182a"/>${accessory}<circle cx="76" cy="76" r="4" fill="#111827"/><circle cx="105" cy="76" r="4" fill="#111827"/><path d="M78 92q12 9 24 0" fill="none" stroke="#7c3f35" stroke-width="3" stroke-linecap="round"/><path d="M80 119h20l-10 18Z" fill="#fff" fill-opacity=".8"/>`;
    } else if (category === 'frame') {
      art = `<circle cx="90" cy="90" r="70" fill="#0a1020"/><circle cx="90" cy="78" r="28" fill="#d9b18d"/><path d="M48 145c8-32 25-47 42-47s34 15 42 47" fill="#273552"/><rect x="22" y="20" width="136" height="140" rx="38" fill="none" stroke="url(#${gradient})" stroke-width="10"/><rect x="34" y="32" width="112" height="116" rx="29" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2"/><path d="m22 50 18-18m100 0 18 18M22 130l18 18m100 0 18-18" stroke="#fff" stroke-opacity=".7" stroke-width="5" stroke-linecap="round"/>`;
    } else if (category === 'table') {
      art = `<path d="m24 52 66-30 66 30v77l-66 30-66-30Z" fill="url(#${gradient})" stroke="#fff" stroke-opacity=".42" stroke-width="4"/><path d="m24 77 66 30 66-30M57 37l66 30v77M24 103l66 30 66-30M90 22v137" fill="none" stroke="#fff" stroke-opacity=".24" stroke-width="3"/><circle cx="58" cy="83" r="9" fill="#fff"/><circle cx="121" cy="116" r="9" fill="#111827" stroke="#fff" stroke-width="2"/><circle cx="90" cy="59" r="8" fill="#f5c451"/>`;
    } else if (category === 'entrance') {
      art = `<ellipse cx="90" cy="153" rx="53" ry="10" fill="url(#${gradient}-glow)"/><ellipse cx="90" cy="82" rx="52" ry="68" fill="none" stroke="url(#${gradient})" stroke-width="10"/><ellipse cx="90" cy="82" rx="35" ry="51" fill="#080e1e" stroke="#fff" stroke-opacity=".42" stroke-width="2"/><path d="M90 46v65m-24 29c3-29 13-42 24-42s21 13 24 42" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round"/><path d="M27 37 15 25m138 12 12-12M20 92H6m154 0h14" stroke="${two}" stroke-width="5" stroke-linecap="round"/>`;
    } else if (category === 'victory') {
      art = `<path d="M61 31h58v34c0 30-15 48-29 48S61 95 61 65Z" fill="url(#${gradient})" stroke="#fff" stroke-opacity=".5" stroke-width="4"/><path d="M61 45H38c0 26 12 38 31 37m50-37h23c0 26-12 38-31 37M90 113v20m-27 17h54" fill="none" stroke="#f9e4a4" stroke-width="8" stroke-linecap="round"/><path d="m47 20 7-12 7 12m58 0 7-12 7 12M24 63l-14-4 9-11m142 15 14-4-9-11" fill="none" stroke="${two}" stroke-width="4" stroke-linecap="round"/><circle cx="90" cy="63" r="15" fill="#fff" fill-opacity=".88"/><path d="m90 51 4 8 9 1-7 6 2 9-8-4-8 4 2-9-7-6 9-1Z" fill="${one}"/>`;
    } else {
      art = `<rect x="31" y="42" width="64" height="96" rx="20" fill="url(#${gradient})" stroke="#fff" stroke-opacity=".5" stroke-width="4"/><circle cx="63" cy="90" r="21" fill="#07101f" stroke="#fff" stroke-opacity=".55" stroke-width="3"/><circle cx="63" cy="90" r="8" fill="${two}"/><path d="M113 64q34 26 0 52m13-70q54 44 0 88" fill="none" stroke="url(#${gradient})" stroke-width="8" stroke-linecap="round"/><path d="M25 154h130" stroke="#fff" stroke-opacity=".26" stroke-width="4" stroke-linecap="round"/>`;
    }
    return `<svg class="cosmetic-art art-${category}" data-cosmetic-category="${category}" viewBox="0 0 180 180" role="img" aria-label="${String(entry?.name || 'عنصر تجميلي').replace(/["<>]/g, '')}">${defs}${art}</svg>`;
  }

  function loadoutForProfile(profile, catalog = availableCatalog) {
    return categories.map((category) => ({
      category,
      label: labels[category],
      item: catalog.find((entry) => entry.id === profile?.equipped?.[category]) || null,
    }));
  }

  const api = { rotationForDate, statusForItem, renderArtwork, usageForCategory, loadoutForProfile, categories: [...categories] };
  window.TAHADI_STORE_UI = api;
  if (!document) return;

  const byId = (id) => document.getElementById(id);
  const catalog = availableCatalog;
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
    return `<span class="cosmetic-art-wrap ${large ? 'large' : ''}" style="--item-one:${colors(entry)[0]};--item-two:${colors(entry)[1]}">${renderArtwork(entry)}</span>`;
  }
  function visibleItems() {
    return activeCategory === 'featured'
      ? rotationForDate(new Date().toISOString().slice(0, 10), catalog)
      : activeCategory === 'smart'
        ? catalog.filter((entry) => entry.category === 'avatar' && entry.personality)
      : catalog.filter((entry) => entry.category === activeCategory);
  }
  function renderHeader() {
    const p = profile();
    const balance = window.TAHADI_PROGRESS?.balanceLabel?.() ?? p.coins;
    if (byId('shopBalance')) byId('shopBalance').textContent = balance;
    if (byId('shopLevel')) byId('shopLevel').textContent = p.level;
    if (byId('shopPlayer')) byId('shopPlayer').textContent = p.name || 'لاعب العباقرة';
    const heroAvatar = byId('shopHeroAvatar');
    const equippedAvatar = item(p.equipped?.avatar) || catalog.find((entry) => entry.category === 'avatar');
    if (heroAvatar && equippedAvatar) heroAvatar.innerHTML = renderArtwork(equippedAvatar);
    byId('shopOwnerBadge')?.classList.toggle('hidden', !owner());
  }

  function renderLoadout() {
    const box = byId('shopLoadout');
    if (!box) return;
    box.innerHTML = loadoutForProfile(profile(), catalog).map((slot) => `<button type="button" class="loadout-slot" data-loadout-category="${slot.category}" data-loadout-id="${slot.item?.id || ''}"><span class="loadout-mini">${slot.item ? renderArtwork(slot.item) : '<span>＋</span>'}</span><span><small>${slot.label}</small><b>${slot.item?.name || 'غير مجهز'}</b></span><i>مفعّل ✓</i></button>`).join('');
    box.querySelectorAll('[data-loadout-category]').forEach((button) => button.addEventListener('click', () => {
      activeCategory = button.dataset.loadoutCategory;
      selectedId = button.dataset.loadoutId || catalog.find((entry) => entry.category === activeCategory)?.id || selectedId;
      document.querySelectorAll('[data-category]').forEach((entry) => entry.classList.toggle('active', entry.dataset.category === activeCategory));
      refresh();
      byId('shopPreview')?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    }));
  }
  function renderSpotlight() {
    const node = byId('shopSpotlight');
    if (!node) return;
    const selected = item(selectedId);
    const entry = selected?.rarity === 'legendary' || selected?.interactive
      ? selected
      : catalog.find((candidate) => candidate.personality) || catalog.find((candidate) => candidate.rarity === 'legendary');
    if (!entry) return;
    const trait = entry.personality?.title || (entry.interactive ? 'معاينة تفاعلية حية' : 'إصدار أسطوري محدود');
    const line = entry.personality?.greeting || usageForCategory(entry.category);
    node.style.setProperty('--spot-a', colors(entry)[0]);
    node.style.setProperty('--spot-b', colors(entry)[1]);
    node.innerHTML = `<div class="spotlight-copy"><span class="spotlight-eyebrow"><i></i> MYTHIC SPOTLIGHT</span><small>${rarityLabels[entry.rarity]} · ${labels[entry.category]}</small><h2>${entry.name}</h2><p>${line}</p><div class="spotlight-traits"><span>✦ ${trait}</span><span>المستوى ${entry.level}</span><span>${entry.price ? `${entry.price} عملة` : 'مجاني'}</span></div><div class="spotlight-actions"><button type="button" data-spotlight-select>عرض التفاصيل</button><button type="button" data-spotlight-trial>معاينة حية</button></div></div><div class="spotlight-stage"><span class="spotlight-orbit one"></span><span class="spotlight-orbit two"></span>${glyph(entry, true)}<b>${entry.personality ? 'SMART' : 'LEGENDARY'}</b></div>`;
    node.querySelector('[data-spotlight-select]')?.addEventListener('click', () => {
      activeCategory = entry.personality ? 'smart' : entry.category;
      selectedId = entry.id;
      document.querySelectorAll('[data-category]').forEach((button) => button.classList.toggle('active', button.dataset.category === activeCategory));
      renderGrid();
      renderPreview();
      byId('shopPreview')?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    });
    node.querySelector('[data-spotlight-trial]')?.addEventListener('click', () => trial(entry, node.querySelector('.spotlight-stage')));
  }
  function renderCollection() {
    const node = byId('shopCollection');
    if (!node) return;
    const p = profile();
    const owned = owner() ? catalog.length : new Set(p.inventory || []).size;
    const percent = Math.min(100, Math.round(owned / Math.max(1, catalog.length) * 100));
    const breakdown = categories.map((category) => {
      const all = catalog.filter((entry) => entry.category === category);
      const count = owner() ? all.length : all.filter((entry) => p.inventory?.includes(entry.id)).length;
      return `<span><i>${labels[category]}</i><b>${count}<small>/${all.length}</small></b></span>`;
    }).join('');
    node.innerHTML = `<div class="collection-ring" style="--collection:${percent * 3.6}deg"><strong>${percent}%</strong><small>المجموعة</small></div><div class="collection-copy"><span class="section-kicker">MY COLLECTION</span><h2>${owned} من ${catalog.length} عنصرًا</h2><div class="collection-progress"><i style="width:${percent}%"></i></div><div class="collection-breakdown">${breakdown}</div></div>`;
  }
  function renderGrid() {
    const grid = byId('shopGrid');
    if (!grid) return;
    const p = profile();
    grid.innerHTML = visibleItems().map((entry) => {
      const status = statusForItem(entry, p, owner());
      const selected = entry.id === selectedId;
      return `<button type="button" class="shop-item rarity-${entry.rarity}${entry.interactive ? ' interactive' : ''}${selected ? ' selected' : ''}" data-item-id="${entry.id}" aria-pressed="${selected}">
        <span class="shop-item-top"><span class="rarity">${rarityLabels[entry.rarity] || entry.rarity}</span>${entry.personality ? '<span class="smart-mark">SMART</span>' : ''}<span class="item-state state-${status.kind}">${status.kind === 'equipped' ? '✓ مجهز' : status.kind === 'owned' || status.kind === 'owner' ? 'مملوك' : entry.price ? `${entry.price} 🪙` : 'مجاني'}</span></span>
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
    const personality = entry.personality ? `<div class="preview-personality"><span>شخصية ذكية</span><b>${entry.personality.title}</b><p>«${entry.personality.greeting}»</p><div><i>تتفاعل مع الإجابة</i><i>تحتفل بالفوز</i><i>تساند عند الخطأ</i></div></div>` : '';
    const phrases = entry.category === 'sound' ? `<div class="preview-phrases"><b>عبارات الحزمة</b>${(entry.phrases || []).map((phrase) => `<button type="button" data-preview-phrase="${phrase}">${phrase}</button>`).join('')}</div>` : '';
    panel.innerHTML = `<div class="preview-stage${entry.interactive ? ' interactive' : ''}" style="--item-one:${colors(entry)[0]};--item-two:${colors(entry)[1]}">${glyph(entry, true)}<div class="preview-rings" aria-hidden="true"></div><span class="preview-live-badge">${entry.interactive ? 'INTERACTIVE' : 'LIVE PREVIEW'}</span></div>
      <div class="preview-copy"><span class="preview-kicker">${rarityLabels[entry.rarity]} • ${labels[entry.category]}</span><h2>${entry.name}</h2><p>${previewDescription(entry)}</p>${personality}${phrases}<div class="preview-usage"><b>مكان التفعيل</b><span>${usageForCategory(entry.category)}</span></div><div class="preview-meta"><span>المستوى ${entry.level}</span><span>${entry.price ? `${entry.price} عملة` : 'مجاني'}</span></div>${actionMarkup(entry, status)}</div>`;
    byId('shopAction')?.addEventListener('click', () => actOn(entry, status));
    panel.querySelectorAll('[data-preview-phrase]').forEach((button) => button.addEventListener('click', () => speakStorePhrase(button.dataset.previewPhrase, entry)));
    const tryButton = byId('shopTry');
    if (tryButton) {
      tryButton.textContent = entry.category === 'sound' ? '♫ استمع قبل التجهيز' : '▶ جرّب العنصر الآن';
      tryButton.onclick = () => trial(entry);
    }
  }
  function previewDescription(entry) {
    const copy = {
      avatar: entry.personality ? 'رفيق ذكي يتبدل مزاجه وتعليقه حسب الإجابة والفوز وأحداث المباراة.' : 'شخصية مرسومة تظهر في ملفك وشاشة المواجهة والنتائج.',
      frame: 'إطار يحيط بشخصيتك ويبرز هويتك أمام المنافسين.',
      table: 'خامة لونية تطبق على ساحات وطاولات اللعب المتوافقة.',
      entrance: 'مشهد دخول قصير قبل المواجهة مع حركة وإضاءة خاصة.',
      victory: 'احتفال مميز يظهر عند الفوز دون أن يحجب أزرار التحكم.',
      sound: 'هوية صوتية متكاملة تغيّر المؤثرات وتضيف أربع عبارات مسموعة داخل كل لعبة.',
    };
    return copy[entry.category] || 'عنصر تجميلي لحسابك.';
  }
  function transactionId(entry) {
    return window.crypto?.randomUUID?.() || `${Date.now()}-${entry.id}`;
  }
  function previewSound(entry) {
    const specs = {
      classic: [420, 'sine', .12], arcade: [620, 'square', .09], royal: [330, 'triangle', .18],
      cyber: [760, 'sawtooth', .08], calm: [280, 'sine', .24],
    };
    const [frequency, type, duration] = specs[entry.sound] || specs.classic;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return window.BS_AUDIO?.play?.('round');
      const context = previewSound.context || (previewSound.context = new AudioContext());
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(80, frequency * .62), context.currentTime + duration);
      gain.gain.setValueAtTime(.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(.13, context.currentTime + .015);
      gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + duration + .02);
    } catch { window.BS_AUDIO?.play?.('round'); }
  }
  function speakStorePhrase(phrase, entry) {
    try {
      if (window.speechSynthesis && window.SpeechSynthesisUtterance) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(String(phrase || ''));
        utterance.lang = 'ar-SA';
        utterance.rate = entry?.sound === 'arcade' ? 1.08 : entry?.sound === 'calm' ? .9 : .98;
        window.speechSynthesis.speak(utterance);
      } else previewSound(entry || { sound: 'classic' });
    } catch { previewSound(entry || { sound: 'classic' }); }
  }
  function trial(entry, suppliedStage = null) {
    const stage = suppliedStage || byId('shopPreview')?.querySelector?.('.preview-stage');
    if (!stage) return;
    stage.classList.remove('is-testing');
    stage.dataset.trial = entry.category;
    void stage.offsetWidth;
    stage.classList.add('is-testing');
    if (entry.category === 'sound') {
      previewSound(entry);
      if (entry.phrases?.[0]) window.setTimeout(() => speakStorePhrase(entry.phrases[0], entry), 180);
    }
    else if (entry.personality) window.setTimeout(() => speakStorePhrase(entry.personality.greeting, entry), 120);
    else window.BS_AUDIO?.play?.(entry.category === 'victory' ? 'win' : 'launch');
    window.setTimeout(() => stage.classList.remove('is-testing'), 1700);
    announce(`معاينة ${entry.name} — ${usageForCategory(entry.category)}`);
  }
  function actOn(entry, status) {
    if (status.kind === 'owned' || status.kind === 'owner') {
      const result = window.TAHADI_PROGRESS.equip(entry.id);
      if (result.ok) announce(`تم تجهيز ${entry.name}`);
      return refresh();
    }
    if (status.kind !== 'buy') return;
    const accepted = window.confirm(`شراء «${entry.name}» مقابل ${entry.price} عملة؟`);
    if (!accepted) return;
    const result = window.TAHADI_PROGRESS.purchase(entry.id, transactionId(entry));
    if (!result.ok) return announce(result.error === 'insufficient_coins' ? 'رصيدك لا يكفي لهذا العنصر' : 'تعذر إتمام الشراء');
    window.TAHADI_PROGRESS.equip(entry.id);
    announce(`تم شراء وتجهيز ${entry.name}`);
    refresh();
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
    renderSpotlight();
    renderCollection();
    renderLoadout();
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
