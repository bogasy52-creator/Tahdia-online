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
      const genericAccessory = [
        '<path d="M48 70 63 36l15 30m54 4-15-34-15 30" fill="none" stroke="#fff" stroke-opacity=".72" stroke-width="7" stroke-linecap="round"/>',
        '<path d="M45 76c16-29 74-40 91-2l-12 12H57Z" fill="url(#' + gradient + ')" stroke="#fff" stroke-opacity=".45" stroke-width="3"/>',
        '<path d="M55 59h70l-9-25-18 16-17-18-15 18-18-15Z" fill="url(#' + gradient + ')" stroke="#fff" stroke-opacity=".55" stroke-width="3"/>',
        '<path d="M43 76c7-31 32-50 47-50s40 19 47 50l-18 8H61Z" fill="#10182d" stroke="url(#' + gradient + ')" stroke-width="6"/>',
      ][seed];
      // ملمح مميّز فريد لكل شخصية (بدل تكرار 4 أشكال فقط بين 16 شخصية) — يطابق اسم وطابع كل واحدة.
      const themedAccessory = {
        nova: '<g stroke="#fff" stroke-opacity=".8" stroke-width="4" stroke-linecap="round"><path d="M90 18v16M74 24l6 12M106 24l-6 12"/></g><path d="m90 14 4 10 10 2-10 3-4 10-4-10-10-3 10-2Z" fill="url(#' + gradient + ')"/>',
        orbit: '<ellipse cx="90" cy="78" rx="58" ry="17" fill="none" stroke="url(#' + gradient + ')" stroke-width="4" transform="rotate(-14 90 78)"/><circle cx="140" cy="70" r="4" fill="' + two + '"/>',
        falcon: '<path d="M48 70 63 36l15 30m54 4-15-34-15 30" fill="none" stroke="#fff" stroke-opacity=".78" stroke-width="7" stroke-linecap="round"/>',
        coder: '<rect x="52" y="66" width="24" height="16" rx="5" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="4"/><rect x="104" y="66" width="24" height="16" rx="5" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="4"/><path d="M76 74h28" stroke="#fff" stroke-opacity=".8" stroke-width="4"/>',
        knight: '<path d="M43 76c7-31 32-50 47-50s40 19 47 50l-18 8H61Z" fill="#10182d" stroke="url(#' + gradient + ')" stroke-width="6"/><path d="M60 62h60" stroke="url(#' + gradient + ')" stroke-width="6"/>',
        queen: '<path d="M55 59h70l-9-25-18 16-17-18-15 18-18-15Z" fill="url(#' + gradient + ')" stroke="#fff" stroke-opacity=".55" stroke-width="3"/><circle cx="90" cy="34" r="4" fill="#fff"/>',
        desert: '<path d="M40 74c8-24 30-38 50-38s42 14 50 38c-16-6-33-9-50-9s-34 3-50 9Z" fill="url(#' + gradient + ')" stroke="#fff" stroke-opacity=".4" stroke-width="3"/><path d="M118 46c10 8 16 18 18 28" fill="none" stroke="url(#' + gradient + ')" stroke-width="5" stroke-linecap="round"/>',
        cyber: '<rect x="48" y="70" width="84" height="13" rx="6" fill="url(#' + gradient + ')" opacity=".92"/><path d="M56 83v6m14-6v9m14-9v6m14-6v9m14-9v6m14-6v9" stroke="' + two + '" stroke-width="2" opacity=".8"/>',
        lunar: '<path d="M112 40a26 26 0 1 0 0 44 20 20 0 0 1 0-44z" fill="url(#' + gradient + ')"/><circle cx="122" cy="38" r="2.4" fill="#fff"/>',
        phoenix: '<path d="M90 22c10 14 17 22 17 32a17 17 0 0 1-34 0c0-6 3-10 6-13-1 6 2 10 5 10 5 0 5-5 3-10-2-6-2-13 3-19z" fill="url(#' + gradient + ')"/>',
        titan: '<path d="M42 74 90 54l48 20-10 10-38-16-38 16Z" fill="none" stroke="url(#' + gradient + ')" stroke-width="6" stroke-linejoin="round"/><path d="m90 50 6 10-6 6-6-6Z" fill="' + two + '"/>',
        genius: '<path d="M40 62 90 44l50 18-50 18Z" fill="#10182d" stroke="url(#' + gradient + ')" stroke-width="4" stroke-linejoin="round"/><path d="M132 66v18" stroke="url(#' + gradient + ')" stroke-width="4" stroke-linecap="round"/><circle cx="132" cy="88" r="3" fill="' + two + '"/>',
        rashid: '<path d="M54 72a36 15 0 1 0 72 0" fill="none" stroke="url(#' + gradient + ')" stroke-width="5"/><path d="M90 72v-6" stroke="url(#' + gradient + ')" stroke-width="4" stroke-linecap="round"/>',
        lama: '<path d="M58 40 78 66l-16 4 22 30-6-30 16-2Z" fill="url(#' + gradient + ')" stroke="#fff" stroke-opacity=".5" stroke-width="2.5" stroke-linejoin="round"/>',
        shaheen: '<path d="M90 40 122 52v18c0 16-14 26-32 32-18-6-32-16-32-32V52Z" fill="none" stroke="url(#' + gradient + ')" stroke-width="5" stroke-linejoin="round"/><path d="M90 56v34" stroke="url(#' + gradient + ')" stroke-width="4" stroke-linecap="round"/>',
        noura: '<g fill="' + two + '"><circle cx="60" cy="42" r="3"/><circle cx="90" cy="30" r="3.6"/><circle cx="120" cy="42" r="3"/></g><path d="M60 42c10 10 20 12 30-12 10 24 20 22 30 12" fill="none" stroke="url(#' + gradient + ')" stroke-width="2.5" stroke-dasharray="1 5"/>',
      }[id.replace(/^avatar-/, '')] || genericAccessory;
      art = `<circle cx="90" cy="90" r="76" fill="#090f20" stroke="url(#${gradient})" stroke-width="5"/><circle cx="90" cy="72" r="38" fill="#e9c7a6"/><path d="M35 158c4-40 26-60 55-60s51 20 55 60" fill="url(#${gradient})"/><path d="M56 71c5-33 62-42 70 0-13-9-22-15-35-15s-22 6-35 15Z" fill="#12182a"/>${themedAccessory}<circle cx="76" cy="76" r="4" fill="#111827"/><circle cx="105" cy="76" r="4" fill="#111827"/><path d="M78 92q12 9 24 0" fill="none" stroke="#7c3f35" stroke-width="3" stroke-linecap="round"/><path d="M80 119h20l-10 18Z" fill="#fff" fill-opacity=".8"/>`;
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
  function closePurchaseModal() {
    byId('shopPurchaseModal')?.remove();
  }
  function flyCoins(fromEl) {
    const wallet = byId('shopBalance') || document.querySelector('[data-shop-balance]');
    if (!fromEl || !wallet) return;
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
  function showPurchaseModal(entry) {
    closePurchaseModal();
    const p = profile();
    const infinite = owner();
    const balance = infinite ? '∞' : Number(p.coins || 0);
    const after = infinite ? '∞' : Math.max(0, Number(p.coins || 0) - Number(entry.price || 0));
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
    const close = () => { modal.classList.remove('show'); document.removeEventListener('keydown', onKey); window.setTimeout(() => modal.remove(), 200); };
    const onKey = (event) => { if (event.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    modal.addEventListener('click', (event) => { if (event.target === modal) close(); });
    modal.querySelector('[data-modal-close]')?.addEventListener('click', close);
    modal.querySelector('[data-modal-cancel]')?.addEventListener('click', close);
    modal.querySelector('[data-modal-confirm]')?.addEventListener('click', () => {
      const artEl = modal.querySelector('.cosmetic-art-wrap');
      const result = window.TAHADI_PROGRESS.purchase(entry.id, transactionId(entry));
      if (!result.ok) { announce(result.error === 'insufficient_coins' ? 'رصيدك لا يكفي لهذا العنصر' : 'تعذر إتمام الشراء'); return close(); }
      window.TAHADI_PROGRESS.equip(entry.id);
      flyCoins(artEl);
      announce(`تم شراء وتجهيز ${entry.name}`);
      window.BS_AUDIO?.play?.('launch');
      close();
      refresh();
    });
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
    showPurchaseModal(entry);
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
