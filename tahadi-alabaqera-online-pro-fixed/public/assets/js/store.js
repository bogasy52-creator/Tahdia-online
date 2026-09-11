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
    return { kind: 'buy', label: item.price ? `شراء • ${item.price} CR` : 'مجاني' };
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
    const gradient = `nm-${id}`;
    const signature = hash(id);
    const variant = signature % 6;
    const shift = 5 + (signature % 9);
    const defs = `<defs><linearGradient id="${gradient}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${one}"/><stop offset=".48" stop-color="${two}"/><stop offset="1" stop-color="#070a12"/></linearGradient><linearGradient id="${gradient}-metal" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f5f7fb" stop-opacity=".92"/><stop offset=".18" stop-color="#758196"/><stop offset=".5" stop-color="#171d28"/><stop offset=".78" stop-color="#020409"/><stop offset="1" stop-color="#596579"/></linearGradient><radialGradient id="${gradient}-glow"><stop stop-color="${two}" stop-opacity=".8"/><stop offset="1" stop-color="${one}" stop-opacity="0"/></radialGradient><filter id="${gradient}-shadow" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="9" stdDeviation="8" flood-color="#000" flood-opacity=".72"/></filter><clipPath id="${gradient}-cut"><path d="M18 31 48 10h84l30 21v118l-30 21H48l-30-21Z"/></clipPath></defs>`;
    const atmosphere = `<path d="M22 39 50 17h80l28 22v102l-28 22H50l-28-22Z" fill="#060912" stroke="${one}" stroke-opacity=".34"/><path d="M34 48 57 29h66l23 19v84l-23 19H57l-23-19Z" fill="url(#${gradient}-glow)" opacity=".2"/><g opacity=".18" clip-path="url(#${gradient}-cut)" stroke="#fff"><path d="M8 ${40 + shift}h164M8 ${72 + shift}h164M8 ${104 + shift}h164M8 ${136 + shift}h164"/><path d="M${42 + shift} 8v164M${84 + shift} 8v164M${126 + shift} 8v164"/></g>`;
    let art = '';
    if (category === 'avatar') {
      const crowns = [
        'M58 54 69 24l21 18 22-18 10 30',
        'M54 52 66 30l12 10 12-25 13 25 13-10 11 22',
        'M55 54 55 27l22 15 13-26 14 26 21-15v27',
        'M51 56 70 22l20 17 20-17 19 34',
        'M56 54 68 17l22 24 23-24 12 37',
        'M52 53 64 31l26-17 27 17 11 22',
      ][variant];
      art = `${atmosphere}<g class="nm-avatar-helmet" filter="url(#${gradient}-shadow)"><path d="M29 160c7-34 25-53 53-59h16c28 6 46 25 53 59Z" fill="#090d16" stroke="url(#${gradient})" stroke-width="4"/><path d="M34 160 51 119l27 13 12 30 13-30 27-13 17 41Z" fill="url(#${gradient})" opacity=".82"/><path d="${crowns}" fill="none" stroke="${two}" stroke-width="7" stroke-linecap="square" stroke-linejoin="miter"/><path d="M51 61 68 42h44l17 19-7 61-20 24H78l-20-24Z" fill="url(#${gradient}-metal)" stroke="#dce5f1" stroke-opacity=".42" stroke-width="2"/><path d="M60 68 75 57h31l14 11-8 29-22 12-22-12Z" fill="#02050a" stroke="${one}" stroke-width="3"/><path class="nm-visor" d="M66 73 77 64h27l11 9-8 13H74Z" fill="url(#${gradient})" stroke="${two}" stroke-width="2"/><path d="M68 101 90 111l22-10-6 30-16 10-16-10Z" fill="#0b111d" stroke="#9aa8bd" stroke-opacity=".55" stroke-width="2"/><path d="M52 76h11l4 31-9 15m70-46h-11l-4 31 9 15" fill="none" stroke="${two}" stroke-opacity=".8" stroke-width="4"/><path d="M81 47h18l-3 10H84Z" fill="${one}"/></g>`;
    } else if (category === 'frame') {
      art = `${atmosphere}<g filter="url(#${gradient}-shadow)"><path d="M31 48 57 22h66l26 26v84l-26 26H57l-26-26Z" fill="none" stroke="url(#${gradient})" stroke-width="12"/><path d="M43 54 62 35h56l19 19v72l-19 19H62l-19-19Z" fill="#050810" stroke="#eef2f8" stroke-opacity=".28" stroke-width="2"/><path d="m31 48 24 8m94-8-24 8M31 132l24-8m94 8-24-8" stroke="${two}" stroke-width="4"/><path d="M90 49 105 77 90 105 75 77Z" fill="url(#${gradient})" opacity=".82"/><path d="M66 126h48" stroke="#fff" stroke-opacity=".55" stroke-width="3"/></g>`;
    } else if (category === 'table') {
      art = `${atmosphere}<g filter="url(#${gradient}-shadow)"><path d="m24 72 66-35 66 35-9 67-57 26-57-26Z" fill="#03060c" stroke="url(#${gradient})" stroke-width="5"/><path d="m38 77 52-27 52 27-7 51-45 21-45-21Z" fill="url(#${gradient})" opacity=".7"/><path d="m38 77 52 25 52-25M44 104l46 22 46-22M63 62l51 24v52M90 50v99" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="2"/><path d="m52 124 38 18 38-18" fill="none" stroke="${two}" stroke-width="3"/><path d="M70 82h12v12H70zm31 25h12v12h-12z" fill="#edf4ff" stroke="#070a10" stroke-width="2"/></g>`;
    } else if (category === 'entrance') {
      art = `${atmosphere}<g filter="url(#${gradient}-shadow)"><path d="M40 144V58l22-29h56l22 29v86" fill="#050811" stroke="url(#${gradient})" stroke-width="8"/><path d="M56 142V68l16-22h36l16 22v74" fill="url(#${gradient}-glow)" stroke="#d9e2ef" stroke-opacity=".42" stroke-width="2"/><path d="M90 52v88M67 67l23 20 23-20M67 119l23-20 23 20" fill="none" stroke="${two}" stroke-width="3"/><path d="M25 151h130M31 44 18 31m131 13 13-13" stroke="#fff" stroke-opacity=".48" stroke-width="4"/></g>`;
    } else if (category === 'victory') {
      art = `${atmosphere}<g filter="url(#${gradient}-shadow)"><path d="M29 57 69 71 90 30l21 41 40-14-24 45 9 38-46 23-46-23 9-38Z" fill="#070b13" stroke="url(#${gradient})" stroke-width="6"/><path d="m47 70 29 17 14-31 15 31 28-17-18 37 7 24-32 16-32-16 7-24Z" fill="url(#${gradient})" opacity=".76"/><path d="m90 69 10 20 22 3-16 15 4 22-20-10-20 10 4-22-16-15 22-3Z" fill="#eff4fb" fill-opacity=".9"/><path d="M20 45 8 32m152 13 12-13M20 122 6 132m154-10 14 10" stroke="${two}" stroke-width="4"/></g>`;
    } else {
      art = `${atmosphere}<g filter="url(#${gradient}-shadow)"><path d="M31 54 48 36h45l17 18v73l-17 18H48l-17-18Z" fill="url(#${gradient}-metal)" stroke="url(#${gradient})" stroke-width="4"/><path d="M45 65h51v50H45Z" fill="#03060b" stroke="#e6edf7" stroke-opacity=".34" stroke-width="2"/><path d="M51 93h8l6-19 10 39 8-28 7 8h8" fill="none" stroke="${two}" stroke-width="4" stroke-linejoin="bevel"/><path d="M120 64q28 25 0 50m13-66q47 42 0 82" fill="none" stroke="url(#${gradient})" stroke-width="7"/><path d="M24 154h132" stroke="#fff" stroke-opacity=".3" stroke-width="3"/></g>`;
    }
    const label = String(entry?.name || 'عنصر تجميلي').replace(/["<>]/g, '');
    return `<svg class="cosmetic-art art-${category}" data-art-system="noir-mythic" data-art-variant="${variant}" data-cosmetic-category="${category}" viewBox="0 0 180 180" role="img" aria-label="${label}">${defs}${art}<text x="90" y="174" text-anchor="middle" fill="#dce4ef" fill-opacity=".72" font-family="system-ui,sans-serif" font-size="8" font-weight="800" letter-spacing="2">${String(entry?.preview || '').replace(/["<>]/g, '')}</text></svg>`;
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
    node.innerHTML = `<div class="spotlight-copy"><span class="spotlight-eyebrow"><i></i> MYTHIC SPOTLIGHT</span><small>${rarityLabels[entry.rarity]} · ${labels[entry.category]}</small><h2>${entry.name}</h2><p>${line}</p><div class="spotlight-traits"><span>AI // ${trait}</span><span>المستوى ${entry.level}</span><span>${entry.price ? `${entry.price} CR` : 'مجاني'}</span></div><div class="spotlight-actions"><button type="button" data-spotlight-select>عرض التفاصيل</button><button type="button" data-spotlight-trial>معاينة حية</button></div></div><div class="spotlight-stage"><span class="spotlight-orbit one"></span><span class="spotlight-orbit two"></span>${glyph(entry, true)}<b>${entry.personality ? 'SMART' : 'LEGENDARY'}</b></div>`;
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
        <span class="shop-item-top"><span class="rarity">${rarityLabels[entry.rarity] || entry.rarity}</span>${entry.personality ? '<span class="smart-mark">SMART</span>' : ''}<span class="item-state state-${status.kind}">${status.kind === 'equipped' ? '✓ مجهز' : status.kind === 'owned' || status.kind === 'owner' ? 'مملوك' : entry.price ? `${entry.price} CR` : 'مجاني'}</span></span>
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
      <div class="preview-copy"><span class="preview-kicker">${rarityLabels[entry.rarity]} • ${labels[entry.category]}</span><h2>${entry.name}</h2><p>${previewDescription(entry)}</p>${personality}${phrases}<div class="preview-usage"><b>مكان التفعيل</b><span>${usageForCategory(entry.category)}</span></div><div class="preview-meta"><span>المستوى ${entry.level}</span><span>${entry.price ? `${entry.price} CR` : 'مجاني'}</span></div>${actionMarkup(entry, status)}</div>`;
    byId('shopAction')?.addEventListener('click', () => actOn(entry, status));
    panel.querySelectorAll('[data-preview-phrase]').forEach((button) => button.addEventListener('click', () => speakStorePhrase(button.dataset.previewPhrase, entry)));
    const tryButton = byId('shopTry');
    if (tryButton) {
      tryButton.textContent = entry.category === 'sound' ? 'AUDIO TEST // استمع قبل التجهيز' : 'LIVE TEST // جرّب العنصر الآن';
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
      return `<article class="mission-card"><div><span>${mission.title}</span><b>${mission.copy}</b><small>${Math.min(mission.value, mission.target)} / ${mission.target}</small></div><div class="mission-progress"><i style="width:${percent}%"></i></div><button class="bs-btn" data-mission="${mission.id}" ${!complete || claimed ? 'disabled' : ''}>${claimed ? 'تم ✓' : `+${mission.reward} CR`}</button></article>`;
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
