(function (global) {
  'use strict';

  const EFFECT_MS = 2100;
  let entranceAt = 0;
  let victoryAt = 0;

  function profile() { return global.TAHADI_PROGRESS?.read?.() || {}; }
  function item(id) { return global.TAHADI_STORE_BY_ID?.get?.(id) || global.TAHADI_PROGRESS?.item?.(id) || null; }
  function safeClass(id) { return String(id || 'classic').replace(/^(entrance|victory|table|frame|avatar)-/, '').replace(/[^a-z0-9-]/g, ''); }
  function escapeHtml(value) { return String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char])); }

  function equippedItems() {
    const p = profile();
    const equipped = p.equipped || {};
    return {
      profile: p,
      table: item(equipped.table),
      avatar: item(equipped.avatar),
      frame: item(equipped.frame),
      entrance: item(equipped.entrance),
      victory: item(equipped.victory),
    };
  }

  function applyCosmetics() {
    const kit = equippedItems();
    const root = document.documentElement;
    const tableColors = kit.table?.colors || ['#111827', '#312e81'];
    const frameColors = kit.frame?.colors || ['#64748b', '#cbd5e1'];
    root.style.setProperty('--tahadi-table-a', tableColors[0]);
    root.style.setProperty('--tahadi-table-b', tableColors[1]);
    root.style.setProperty('--tahadi-frame-a', frameColors[0]);
    root.style.setProperty('--tahadi-frame-b', frameColors[1]);
    document.body?.classList.add('tahadi-cosmetics');
    if (document.body) {
      document.body.dataset.tahadiTable = safeClass(kit.profile.equipped?.table);
      document.body.dataset.tahadiFrame = safeClass(kit.profile.equipped?.frame);
    }

    let ambience = document.getElementById('tahadiTableAmbience');
    if (!ambience && document.body) {
      ambience = document.createElement('div');
      ambience.id = 'tahadiTableAmbience';
      ambience.className = 'tahadi-table-ambience';
      ambience.setAttribute('aria-hidden', 'true');
      document.body.prepend(ambience);
    }

    let loadout = document.getElementById('tahadiLoadout');
    if (!loadout && document.body) {
      loadout = document.createElement('div');
      loadout.id = 'tahadiLoadout';
      loadout.className = 'tahadi-loadout';
      loadout.setAttribute('aria-label', 'المظهر المجهز');
      document.body.appendChild(loadout);
    }
    if (loadout) {
      const avatarColors = kit.avatar?.colors || ['#8b5cf6', '#22d3ee'];
      loadout.style.setProperty('--avatar-a', avatarColors[0]);
      loadout.style.setProperty('--avatar-b', avatarColors[1]);
      loadout.innerHTML = `<span class="tahadi-loadout-avatar">${escapeHtml(kit.avatar?.preview || '🧠')}</span><span><b>${escapeHtml(kit.profile.name || 'لاعب العباقرة')}</b><small>${escapeHtml(kit.table?.name || 'منتصف الليل')}</small></span>`;
    }
    return kit;
  }

  function particles(colors, count = 20) {
    return Array.from({ length: count }, (_, index) => `<i style="--i:${index};--pc:${colors[index % colors.length]}"></i>`).join('');
  }

  function cleanup(kind = '') {
    const selector = kind ? `.tahadi-${kind}` : '.tahadi-match-fx';
    document.querySelectorAll(selector).forEach((layer) => {
      clearTimeout(layer.__tahadiTimer);
      clearInterval(layer.__tahadiCountdown);
      layer.remove();
    });
  }

  function replayTarget() {
    return document.querySelector('#again,#restart,#lgRetry,#qmPlayAgain,#sdAgain,[data-replay]');
  }

  function overlay(kind, options = {}) {
    cleanup();
    const kit = applyCosmetics();
    const cosmetic = kind === 'entrance' ? kit.entrance : kit.victory;
    const colors = cosmetic?.colors || (kind === 'entrance' ? ['#8b5cf6', '#22d3ee'] : ['#f0b94a', '#fff7cc']);
    const layer = document.createElement('section');
    layer.className = `tahadi-match-fx tahadi-${kind} effect-${safeClass(cosmetic?.id)}`;
    layer.style.setProperty('--fx-a', colors[0]);
    layer.style.setProperty('--fx-b', colors[1]);
    layer.setAttribute('role', 'dialog');
    layer.setAttribute('aria-modal', 'true');
    layer.setAttribute('aria-live', 'polite');
    const avatar = kit.avatar?.preview || '🧠';
    const defaultTitle = kind === 'entrance' ? `${kit.profile.name || 'لاعب العباقرة'} دخل التحدي` : 'انتصار احترافي!';
    const opponent = options.opponent || (new URLSearchParams(location.search).get('bot') === '1' ? 'BOT' : 'المنافس');
    const entranceBody = `<div class="tahadi-versus"><div class="tahadi-player-card"><span>${escapeHtml(avatar)}</span><b>${escapeHtml(options.playerName || kit.profile.name || 'أنت')}</b></div><div class="tahadi-versus-center"><em>VS</em><strong class="tahadi-fx-countdown">3</strong></div><div class="tahadi-player-card opponent"><span>🤖</span><b>${escapeHtml(opponent)}</b></div></div>`;
    const victoryBody = `<div class="tahadi-fx-frame"><span>${escapeHtml(cosmetic?.preview || '🏆')}</span></div><div class="tahadi-fx-actions"><button type="button" data-fx-replay>إعادة اللعب</button><a href="/">الرئيسية</a><a href="/store">المتجر</a></div>`;
    layer.innerHTML = `<div class="tahadi-fx-particles">${particles(colors, kind === 'victory' ? 28 : 18)}</div><button type="button" class="tahadi-fx-skip" data-fx-skip aria-label="تخطي المؤثر">تخطي</button><div class="tahadi-fx-card">${kind === 'entrance' ? entranceBody : victoryBody}<small>${escapeHtml(cosmetic?.name || (kind === 'entrance' ? 'دخول احترافي' : 'احتفال الفوز'))}</small><h2>${escapeHtml(options.title || defaultTitle)}</h2><p>${escapeHtml(options.subtitle || (kind === 'entrance' ? 'استعد… الجولة تبدأ الآن' : 'تمت إضافة المكافأة والتقدم إلى حسابك'))}</p></div>`;
    document.body.appendChild(layer);
    requestAnimationFrame(() => layer.classList.add('show'));
    try { global.BS_AUDIO?.play?.(kind === 'victory' ? 'win' : 'launch'); } catch {}
    let completed = false;
    const finish = () => {
      if (completed) return;
      completed = true;
      clearTimeout(layer.__tahadiTimer);
      clearInterval(layer.__tahadiCountdown);
      layer.classList.remove('show');
      setTimeout(() => layer.remove(), 420);
      if (typeof options.onComplete === 'function') options.onComplete();
    };
    layer.querySelector('[data-fx-skip]')?.addEventListener('click', finish);
    layer.querySelector('[data-fx-replay]')?.addEventListener('click', () => {
      const target = replayTarget();
      finish();
      setTimeout(() => target?.click(), 80);
    });
    if (kind === 'entrance') {
      let count = 3;
      const counter = layer.querySelector('.tahadi-fx-countdown');
      layer.__tahadiCountdown = setInterval(() => {
        count -= 1;
        if (counter) counter.textContent = count > 0 ? String(count) : 'ابدأ!';
        if (count <= 0) clearInterval(layer.__tahadiCountdown);
      }, 650);
    }
    layer.__tahadiTimer = setTimeout(finish, Number(options.duration) || (kind === 'entrance' ? 2450 : EFFECT_MS + 1100));
    return layer;
  }

  function showEntrance(options = {}) {
    const now = Date.now();
    if (now - entranceAt < 1200) return null;
    entranceAt = now;
    return overlay('entrance', options);
  }

  function showVictory(options = {}) {
    const now = Date.now();
    if (now - victoryAt < 1800) return null;
    victoryAt = now;
    return overlay('victory', options);
  }

  function startTrigger(target) {
    if (!(target instanceof Element)) return false;
    const button = target.closest('button, [role="button"]');
    if (!button) return false;
    return button.matches('[data-start],#start,#startBot,#startBtn,#classicStartBtn,#sdNewLocal,#modeBot') || /^(ابدأ|ابدأ اللعب|بدء)/.test(button.textContent.trim());
  }

  function watchGameScreens() {
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        const screen = record.target instanceof Element ? record.target.closest('#game,#sdGame,#quickArena,#gameMount') : null;
        if (screen && !screen.classList.contains('hidden')) { showEntrance(); break; }
      }
    });
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  function mount() {
    applyCosmetics();
    document.addEventListener('click', (event) => {
      if (startTrigger(event.target)) setTimeout(() => showEntrance(), 60);
    }, true);
    global.addEventListener('tahadi-award', (event) => {
      if (event.detail?.win) showVictory({ subtitle: `+${event.detail.deltaXp || 0} XP • +${event.detail.deltaCoins || 0} عملة` });
    });
    global.addEventListener('tahadi-progress', applyCosmetics);
    watchGameScreens();
    if (new URLSearchParams(location.search).get('bot') === '1') setTimeout(() => showEntrance({ subtitle: 'تم تجهيز منافس BOT — حظًا موفقًا' }), 380);
  }

  global.TAHADI_PRESENTATION = Object.freeze({ applyCosmetics, showEntrance, showVictory, cleanup });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
}(window));
