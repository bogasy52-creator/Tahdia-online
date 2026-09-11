(function (global) {
  'use strict';

  const EFFECT_MS = 2100;
  let victoryAt = 0;

  function createEntranceGate() {
    let claimed = false;
    return Object.freeze({
      claim() {
        if (claimed) return false;
        claimed = true;
        return true;
      },
      reset() { claimed = false; },
      isClaimed() { return claimed; },
    });
  }

  function isGameScreenReveal(record) {
    const target = record?.target;
    if (!target || typeof target.matches !== 'function') return false;
    if (!target.matches('#game,#sdGame,#quickArena,#gameMount')) return false;
    const wasHidden = String(record.oldValue || '').split(/\s+/).includes('hidden');
    return wasHidden && !target.classList?.contains?.('hidden');
  }

  const entranceGate = createEntranceGate();
  global.TAHADI_PRESENTATION_POLICY = Object.freeze({ createEntranceGate, isGameScreenReveal });

  function profile() { return global.TAHADI_PROGRESS?.read?.() || {}; }
  function item(id) { return global.TAHADI_STORE_BY_ID?.get?.(id) || global.TAHADI_PROGRESS?.item?.(id) || null; }
  function safeClass(id) { return String(id || 'classic').replace(/^(entrance|victory|table|frame|avatar|sound)-/, '').replace(/[^a-z0-9-]/g, ''); }
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
      sound: item(equipped.sound),
    };
  }

  const FALLBACK_PHRASES = ['جاهز للتحدي!', 'أحسنت يا بطل', 'جولة جميلة', 'بالتوفيق للجميع'];

  function phrasesForSound(sound) {
    const phrases = Array.isArray(sound?.phrases) ? sound.phrases.filter(Boolean).slice(0, 4) : [];
    return phrases.length === 4 ? phrases : FALLBACK_PHRASES;
  }

  function avatarLine(kit, mood) {
    const personality = kit.avatar?.personality;
    const key = mood === 'cheer' ? 'correct' : mood === 'concern' ? 'wrong' : mood === 'win' ? 'win' : 'greeting';
    return personality?.[key] || ({ cheer: 'أحسنت!', concern: 'ركّز في التالية', win: 'فوز مستحق!', focus: 'جاهز للجولة' }[mood] || 'أنا معك');
  }

  function setAvatarMood(mood = 'focus', message = '') {
    const dock = document.getElementById('tahadiVoiceDock');
    if (!dock) return;
    const avatar = dock.querySelector('.tahadi-smart-avatar');
    const bubble = dock.querySelector('[data-avatar-bubble]');
    const safeMood = ['focus', 'cheer', 'concern', 'win'].includes(mood) ? mood : 'focus';
    dock.dataset.mood = safeMood;
    if (avatar) avatar.dataset.mood = safeMood;
    if (bubble) {
      bubble.textContent = message || avatarLine(equippedItems(), safeMood);
      bubble.classList.add('show');
    }
    clearTimeout(dock.__moodTimer);
    dock.__moodTimer = setTimeout(() => {
      if (avatar) avatar.dataset.mood = 'focus';
      dock.dataset.mood = 'focus';
      bubble?.classList.remove('show');
    }, safeMood === 'win' ? 3600 : 2400);
  }

  function moodForCue(name) {
    if (['win', 'finish'].includes(name)) return 'win';
    if (['correct', 'capture', 'ladder', 'ladderLand'].includes(name)) return 'cheer';
    if (['wrong', 'error', 'buzzer', 'snake', 'snakeBite', 'disconnect'].includes(name)) return 'concern';
    return 'focus';
  }

  function speakPhrase(text, sound) {
    const phrase = String(text || '').trim().slice(0, 80);
    if (!phrase) return false;
    if (global.BS_AUDIO?.getSettings?.()?.muted) return false;
    try {
      if (global.speechSynthesis && global.SpeechSynthesisUtterance) {
        global.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(phrase);
        utterance.lang = 'ar-SA';
        utterance.rate = sound?.sound === 'arcade' ? 1.08 : sound?.sound === 'calm' ? .9 : .98;
        utterance.pitch = sound?.sound === 'cyber' ? 1.18 : sound?.sound === 'royal' ? .88 : 1;
        global.speechSynthesis.speak(utterance);
        return true;
      }
    } catch {}
    try { global.BS_AUDIO?.play?.('select'); } catch {}
    return false;
  }

  function renderVoiceDock(kit = equippedItems()) {
    const dock = document.getElementById('tahadiVoiceDock');
    if (!dock) return;
    const colors = kit.avatar?.colors || ['#8b5cf6', '#22d3ee'];
    dock.style.setProperty('--voice-a', colors[0]);
    dock.style.setProperty('--voice-b', colors[1]);
    const phrases = phrasesForSound(kit.sound);
    const muted = global.BS_AUDIO?.getSettings?.()?.muted === true;
    dock.innerHTML = `<button type="button" class="tahadi-voice-toggle" data-voice-toggle aria-expanded="${dock.classList.contains('open')}" aria-controls="tahadiVoicePanel"><span>${escapeHtml(kit.avatar?.preview || '🧠')}</span><b>الصوتيات والعبارات</b><i aria-hidden="true">⌃</i></button><section id="tahadiVoicePanel" class="tahadi-voice-panel" aria-label="العبارات السريعة"><div class="tahadi-character-row"><div class="tahadi-smart-avatar" data-mood="focus"><span>${escapeHtml(kit.avatar?.preview || '🧠')}</span><i></i><em></em></div><div><small>${escapeHtml(kit.avatar?.personality?.title || 'رفيقك داخل المباراة')}</small><b>${escapeHtml(kit.avatar?.name || 'نوفا')}</b><p data-avatar-bubble>${escapeHtml(avatarLine(kit, 'focus'))}</p></div></div><div class="tahadi-phrase-grid">${phrases.map((phrase) => `<button type="button" data-quick-phrase="${escapeHtml(phrase)}">${escapeHtml(phrase)}</button>`).join('')}</div><div class="tahadi-voice-actions"><button type="button" data-voice-sound>♪ اختبر ${escapeHtml(kit.sound?.name || 'الصوت')}</button><button type="button" data-voice-mute>${muted ? 'تشغيل الصوت' : 'كتم الصوت'}</button></div><small class="tahadi-voice-note">تُسمع العبارة فقط عند ضغطك عليها</small></section>`;
  }

  function mountVoiceDock(kit = equippedItems()) {
    if (!document.body) return null;
    let dock = document.getElementById('tahadiVoiceDock');
    if (!dock) {
      dock = document.createElement('aside');
      dock.id = 'tahadiVoiceDock';
      dock.className = 'tahadi-voice-dock';
      dock.setAttribute('aria-label', 'الشخصية الذكية والصوتيات');
      dock.addEventListener('click', (event) => {
        const toggle = event.target.closest('[data-voice-toggle]');
        if (toggle) {
          const open = dock.classList.toggle('open');
          toggle.setAttribute('aria-expanded', String(open));
          try { global.BS_AUDIO?.play?.('click'); } catch {}
          return;
        }
        const phraseButton = event.target.closest('[data-quick-phrase]');
        if (phraseButton) {
          const phrase = phraseButton.dataset.quickPhrase;
          const current = equippedItems();
          speakPhrase(phrase, current.sound);
          setAvatarMood('cheer', phrase);
          try { global.dispatchEvent(new CustomEvent('tahadi-phrase', { detail: { phrase } })); } catch {}
          return;
        }
        if (event.target.closest('[data-voice-sound]')) {
          if (global.BS_AUDIO?.getSettings?.()?.muted) {
            setAvatarMood('concern', 'الصوت مكتوم — شغّله أولًا');
            return;
          }
          try { global.BS_AUDIO?.play?.('join'); } catch {}
          setAvatarMood('cheer', 'الصوت مجهز ويعمل داخل المباراة');
          return;
        }
        const muteButton = event.target.closest('[data-voice-mute]');
        if (muteButton) {
          const muted = global.BS_AUDIO?.toggleMuted?.();
          muteButton.textContent = muted ? 'تشغيل الصوت' : 'كتم الصوت';
          setAvatarMood('focus', muted ? 'تم كتم الصوت' : 'تم تشغيل الصوت');
        }
      });
      document.body.appendChild(dock);
    }
    renderVoiceDock(kit);
    return dock;
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
      document.body.dataset.tahadiAvatar = safeClass(kit.profile.equipped?.avatar);
      document.body.dataset.tahadiEntrance = safeClass(kit.profile.equipped?.entrance);
      document.body.dataset.tahadiVictory = safeClass(kit.profile.equipped?.victory);
      document.body.dataset.tahadiSound = safeClass(kit.profile.equipped?.sound);
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
    if (document.getElementById('tahadiVoiceDock')) renderVoiceDock(kit);
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
    const entranceBody = `<div class="tahadi-versus"><div class="tahadi-player-card"><span>${escapeHtml(avatar)}</span><b>${escapeHtml(options.playerName || kit.profile.name || 'أنت')}</b></div><div class="tahadi-versus-center"><em>VS</em><span class="tahadi-fx-countdown"><b>3</b><small>استعداد</small></span></div><div class="tahadi-player-card opponent"><span>🤖</span><b>${escapeHtml(opponent)}</b></div></div>`;
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
      const counter = layer.querySelector('.tahadi-fx-countdown b');
      layer.__tahadiCountdown = setInterval(() => {
        count -= 1;
        if (counter) counter.textContent = count > 0 ? String(count) : 'ابدأ!';
        if (count <= 0) clearInterval(layer.__tahadiCountdown);
      }, 520);
    }
    const requestedDuration = Number(options.duration) || (kind === 'entrance' ? 1900 : EFFECT_MS + 1100);
    layer.__tahadiTimer = setTimeout(finish, Math.min(5000, Math.max(900, requestedDuration)));
    return layer;
  }

  function showEntrance(options = {}) {
    if (options.reset === true) entranceGate.reset();
    if (!entranceGate.claim()) return null;
    return overlay('entrance', options);
  }

  function resetEntrance() {
    cleanup('entrance');
    entranceGate.reset();
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
    return button.matches('[data-start],#start,#startBot,#startBtn,#classicStartBtn,#sdNewLocal');
  }

  function watchGameScreens() {
    const observer = new MutationObserver((records) => {
      if (records.some(isGameScreenReveal)) showEntrance();
    });
    observer.observe(document.body, { subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['class'] });
    return observer;
  }

  function mount() {
    const kit = applyCosmetics();
    mountVoiceDock(kit);
    document.addEventListener('click', (event) => {
      if (startTrigger(event.target)) setTimeout(() => showEntrance(), 60);
    }, true);
    global.addEventListener('tahadi-award', (event) => {
      if (event.detail?.win) {
        setAvatarMood('win');
        showVictory({ subtitle: `+${event.detail.deltaXp || 0} XP • +${event.detail.deltaCoins || 0} عملة` });
      }
    });
    global.addEventListener('tahadi-progress', () => mountVoiceDock(applyCosmetics()));
    global.addEventListener('tahadi-audio-cue', (event) => setAvatarMood(moodForCue(event.detail?.name)));
    watchGameScreens();
    if (new URLSearchParams(location.search).get('bot') === '1') setTimeout(() => showEntrance({ subtitle: 'تم تجهيز منافس BOT — حظًا موفقًا' }), 380);
  }

  global.TAHADI_PRESENTATION = Object.freeze({ applyCosmetics, mountVoiceDock, setAvatarMood, speakPhrase, showEntrance, resetEntrance, showVictory, cleanup });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
}(window));
