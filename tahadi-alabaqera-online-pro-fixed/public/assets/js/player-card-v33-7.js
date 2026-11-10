/* Tahdia 33.7.0 — «ملف اللاعب»: tap any player in a room (a seat, a name in the list, a face on
   the board) to see who it is: the character, the level, the wins and the games, whether the
   player is online, and a button to add the player as a friend. Opponents the computer plays
   and guests without an account get the same card, with a word instead of the button. */
(() => {
  'use strict';
  if (window.BS_PLAYER_CARD) return;
  const doc = document, fmt = new Intl.NumberFormat('ar-SA-u-nu-latn');
  const LEVELS = { easy: 'سهل', medium: 'متوسط', hard: 'صعب' };
  let sheet = null, source = null, opened = 0;
  const node = (tag, cls, text) => { const el = doc.createElement(tag); if (cls) el.className = cls; if (text != null) el.textContent = text; return el; };
  const core = () => window.BS_CAREER_CORE;
  function poster(character) { try { return (core()?.heroPoster || core()?.heroArt)?.(character || 'fox') || ''; } catch { return ''; } }
  function heroName(character) { try { return core()?.heroOf?.(character || 'fox')?.name || ''; } catch { return ''; } }
  function titleName(id) { try { return id && id !== 'title-player' ? core()?.CATALOG?.find((i) => i.id === id)?.name || '' : ''; } catch { return ''; } }
  function seen(p) {
    if (p?.online) return 'متصل الحين';
    const at = Number(p?.lastSeen); if (!Number.isFinite(at) || at <= 0) return '';
    const min = Math.max(0, Math.floor((Date.now() - at) / 60000));
    if (min < 1) return 'كان متصل قبل شوي';
    if (min < 60) return 'آخر ظهور قبل ' + min + ' دقيقة';
    if (min < 1440) return 'آخر ظهور قبل ' + Math.floor(min / 60) + ' ساعة';
    return 'آخر ظهور قبل ' + Math.floor(min / 1440) + ' يوم';
  }
  const same = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();
  async function relation(username) {
    const social = window.BS_SOCIAL;
    if (!social?.isLoggedIn?.()) return 'guest';
    if (same(social.profile?.()?.username, username)) return 'self';
    try {
      const data = await social.me(true);
      if (same(data?.profile?.username, username)) return 'self';
      if ((data?.friends || []).some((x) => same(x.username, username))) return 'friend';
      if ((data?.outgoing || []).some((x) => same(x.username, username))) return 'sent';
      if ((data?.incoming || []).some((x) => same(x.username, username))) return 'received';
    } catch {}
    return 'none';
  }
  function close() {
    if (!sheet?.classList.contains('open')) return;
    sheet.classList.remove('open'); opened++;
    try { source?.focus?.({ preventScroll: true }); } catch {}
  }
  function host() {
    if (!sheet) {
      sheet = node('div', 'bs-pcard');
      sheet.addEventListener('click', (e) => { if (e.target === sheet || e.target.closest?.('[data-pcard-close]')) close(); });
      doc.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sheet.classList.contains('open')) { e.preventDefault(); close(); } });
    }
    const parent = doc.fullscreenElement || doc.body;
    if (sheet.parentElement !== parent) parent.append(sheet);
    return sheet;
  }
  // 33.9.4: pictures, levels and trophies come from profile-pro
  function pro() {
    if (window.BS_PROFILE_PRO) return Promise.resolve(window.BS_PROFILE_PRO);
    return new Promise((ok) => { const s = doc.createElement('script'); s.src = '/assets/js/profile-pro-v33-9-4.js?v=33.9.7'; s.onload = () => ok(window.BS_PROFILE_PRO || null); s.onerror = () => ok(null); doc.head.append(s); setTimeout(() => ok(window.BS_PROFILE_PRO || null), 4000); });
  }
  function stat(label, value) { const box = node('div', 'bs-pcard-stat'); box.append(node('b', '', value == null ? '—' : fmt.format(value)), node('small', '', label)); return box; }
  function button(text, cls = 'bs-btn') { const b = node('button', cls, text); b.type = 'button'; return b; }
  /** info: {name, username, character, bot, level, me, color} — whatever the room knows. */
  async function open(info = {}) {
    info = { ...info };
    if (info.me && !info.username && !info.bot) info.username = window.BS_SOCIAL?.profile?.()?.username || '';
    const panel = node('section', 'bs-pcard-panel');
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-label', 'ملف ' + (info.name || 'اللاعب'));
    if (info.color) panel.style.setProperty('--pc', info.color);
    const shut = button('✕', 'bs-pcard-close'); shut.dataset.pcardClose = ''; shut.setAttribute('aria-label', 'إغلاق');
    const face = node('div', 'bs-pcard-face'), img = node('img'); img.alt = ''; img.decoding = 'async';
    const art = poster(info.character); if (art) { img.src = art; face.append(img); } else face.append(node('span', 'bs-pcard-letter', String(info.name || '؟').trim().slice(0, 1) || '؟'));
    const name = node('h2', 'bs-pcard-name', info.name || 'لاعب');
    const line = node('p', 'bs-pcard-line');
    const stats = node('div', 'bs-pcard-stats');
    const hero = heroName(info.character), note = node('p', 'bs-pcard-note');
    const actions = node('div', 'bs-pcard-actions');
    panel.append(shut, face, name, line, stats, note, actions);
    const box = host(); box.replaceChildren(panel); box.classList.add('open');
    source = doc.activeElement; const ticket = ++opened;
    setTimeout(() => shut.focus({ preventScroll: true }), 30);
    // 33.9.2: a seat the computer plays reads like a guest's
    if (!info.username || info.bot) {
      line.textContent = info.me ? 'هذا أنت · تلعب كضيف' : 'ضيف · ما عنده حساب';
      note.textContent = info.me ? 'سجّل دخولك عشان يقدر أصحابك يضيفونك ويشوفون ملفك.' : 'الضيف ما عنده ملف يتحفظ، فما ينضاف للأصدقاء.';
      if (info.me) { const a = node('a', 'bs-btn primary', 'سجّل دخولك'); a.href = '/social?next=' + encodeURIComponent(location.pathname + location.search); actions.append(a); }
      return;
    }
    { const handle = node('bdi', '', '@' + info.username); handle.dir = 'ltr'; line.replaceChildren(handle); }
    stats.append(stat('المستوى', null), stat('الانتصارات', null), stat('المباريات', null)); stats.classList.add('loading');
    const [profile, rel, P] = await Promise.all([
      Promise.resolve(window.BS_SOCIAL?.user?.(info.username)).then((d) => d?.profile || null).catch(() => null),
      relation(info.username),
      pro(),
    ]);
    if (ticket !== opened || !panel.isConnected) return;
    stats.classList.remove('loading');
    if (!profile) { stats.replaceChildren(); note.textContent = 'ما قدرنا نجيب ملفه الحين.'; }
    else {
      if (profile.displayName) name.textContent = profile.displayName;
      const presence = seen(profile), handle = node('bdi', '', '@' + profile.username); handle.dir = 'ltr'; line.replaceChildren(handle, presence ? ' · ' + presence : '');
      line.classList.toggle('online', Boolean(profile.online));
      const card = profile.card || {};
      if (card.character && !info.character) { const art2 = poster(card.character); if (art2) { img.src = art2; face.replaceChildren(img); } }
      stats.replaceChildren(stat('المستوى', card.level), stat('الانتصارات', card.wins), stat('المباريات', card.games));
      if (P) {
        if (profile.photo) { const pic = P.avatar({ username: profile.username, photo: profile.photo, fallback: img.src || '', name: profile.displayName }, 'bs-avatar bs-pcard-photo'); face.replaceChildren(pic); face.classList.add('has-photo'); }
        stats.replaceChildren(stat('الكؤوس', P.earned(card).length), stat('الانتصارات', card.wins), stat('المباريات', card.games));
        const extra = node('div', 'bs-pcard-pro'); extra.append(P.levelBar({ ...card, xp: card.xp }), P.shelf(card, { limit: 4 }));
        stats.after(extra);
        if (profile.photo?.kind === 'upload' && rel !== 'self') { const rp = button('بلّغ عن الصورة', 'bs-pcard-report'); rp.addEventListener('click', () => P.report(profile.username, profile.displayName)); actions.after(rp); }
      }
      const title = titleName(card.title), heroNow = heroName(info.character || card.character);
      note.textContent = [title && 'لقبه «' + title + '»', heroNow && 'يلعب بشخصية ' + heroNow].filter(Boolean).join(' · ');
    }
    const add = button('أضف صديق', 'bs-btn primary');
    const set = (text, done = true) => { add.textContent = text; add.disabled = done; };
    if (rel === 'self') { const a = node('a', 'bs-btn', 'هذا ملفك · افتحه'); a.href = '/social'; actions.append(a); if (P) { const ch = button('غيّر صورتك', 'bs-btn'); ch.addEventListener('click', () => { close(); P.openPicker(); }); actions.append(ch); } return; }
    if (rel === 'guest') { const a = node('a', 'bs-btn primary', 'سجّل دخولك عشان تضيفه'); a.href = '/social?next=' + encodeURIComponent(location.pathname + location.search); actions.append(a); return; }
    if (rel === 'friend') set('صديقك ✓');
    else if (rel === 'sent') set('طلبك مرسل ✓');
    else if (rel === 'received') set('اقبل طلب صداقته', false);
    actions.append(add);
    add.addEventListener('click', async () => {
      if (add.disabled) return; add.disabled = true;
      try {
        if (rel === 'received') { await window.BS_SOCIAL.respondFriend(info.username, true); set('صرتوا أصدقاء ✓'); }
        else { const r = await window.BS_SOCIAL.requestFriend(info.username); set(r?.alreadyFriends ? 'صرتوا أصدقاء ✓' : 'انرسل طلب الصداقة ✓'); }
        window.BS_AUDIO?.play?.('select');
      } catch (e) { add.disabled = false; note.textContent = e?.message || 'ما قدرنا نرسل الطلب، جرّب مرة ثانية.'; }
    });
  }
  window.BS_PLAYER_CARD = Object.freeze({ open, close });
})();
