/* 33.9.4: a picture for every player (a ready one or an uploaded photo, with a report button),
   levels with a name and a bar, and trophies for playing and for winning. Tap any player with
   data-player-username (seats, friends, the leaderboard) to open the player's card and add them. */
(() => {
  'use strict';
  if (window.BS_PROFILE_PRO) return;
  const doc = document, fmt = new Intl.NumberFormat('en-US');
  const node = (tag, cls, text) => { const el = doc.createElement(tag); if (cls) el.className = cls; if (text != null) el.textContent = text; return el; };
  const css = (href) => { if (doc.querySelector('link[href^="' + href.split('?')[0] + '"]')) return; const l = doc.createElement('link'); l.rel = 'stylesheet'; l.href = href; doc.head?.appendChild(l); };
  css('/assets/css/profile-pro-v33-9-4.css?v=33.9.8');

  // ------------------------------------------------------------ pictures
  // the same list the server accepts: hero faces (h-) and cartoon girls and friends (g-)
  const PRESETS = ['h-falcon', 'h-desert', 'g-princess', 'g-fairy', 'h-knight', 'h-samurai', 'g-princess-pink', 'g-fairy-pink', 'h-ninja', 'h-viking', 'g-princess-blue', 'g-fairy-blue', 'h-gladiator', 'h-astronaut', 'g-cat', 'g-fox', 'h-diver', 'h-racer', 'h-cyber', 'h-robot'];
  const presetUrl = (id) => !PRESETS.includes(id) ? '' : id.startsWith('h-') ? '/assets/heroes/face/' + id.slice(2) + '.webp' : '/assets/avatars-v33-9-4/' + id.slice(2) + '.webp';
  function photoUrl(username, photo) {
    if (photo?.kind === 'preset') return presetUrl(photo.id);
    if (!username) return '';
    return '/api/social/photo/' + encodeURIComponent(username) + (photo?.kind === 'upload' ? '?v=' + Number(photo.v || 0) : '');
  }
  /** a round picture: the photo, else the given fallback picture, else the first letter */
  function avatar({ username = '', photo = null, fallback = '', name = '' } = {}, cls = 'bs-avatar') {
    const box = node('span', cls), letter = node('b', '', String(name || username || '؟').trim().slice(0, 1) || '؟');
    box.append(letter);
    const src = photoUrl(username, photo) || fallback;
    if (src) { const img = node('img'); img.alt = ''; img.decoding = 'async'; img.loading = 'lazy'; img.onerror = () => { if (fallback && img.src.indexOf(fallback) < 0) img.src = fallback; else img.remove(); }; img.src = src; box.append(img); }
    return box;
  }

  // ------------------------------------------------------------ levels
  const TIERS = [[50, 'أسطورة', '#ff5d8f'], [35, 'نخبة', '#c98cff'], [20, 'خبير', '#53b7ff'], [10, 'محترف', '#62f4c8'], [5, 'هاوي', '#ffd166'], [1, 'مبتدئ', '#c9d3e6']];
  function levelInfo(card = {}) {
    const xp = Math.max(0, Number(card.xp) || 0), level = Number(card.level) || Math.floor(xp / 1000) + 1;
    const [, tier, color] = TIERS.find(([min]) => level >= min) || TIERS[TIERS.length - 1];
    const into = xp % 1000;
    return { level, tier, color, xp, into, need: 1000 - into, pct: Math.round(into / 10) };
  }
  function levelBar(card) {
    const L = levelInfo(card), box = node('div', 'bs-level');
    box.style.setProperty('--tier', L.color);
    const head = node('div', 'bs-level-head');
    head.append(node('b', 'bs-level-num', String(L.level)), node('span', 'bs-level-name', 'المستوى ' + L.level + ' · ' + L.tier));
    const bar = node('div', 'bs-level-bar'), fill = node('i'); fill.style.width = L.pct + '%'; bar.append(fill);
    box.append(head, bar);
    if (card.xp != null) box.append(node('small', 'bs-level-next', 'باقي ' + fmt.format(L.need) + ' خبرة للمستوى ' + (L.level + 1)));
    return box;
  }

  // ------------------------------------------------------------ trophies
  const TIER_NAMES = ['برونزي', 'فضي', 'ذهبي', 'ماسي'];
  const TIER_COLORS = ['#d08a4e', '#c9d3e6', '#ffcb45', '#7ee8ff'];
  const GAMES = { baloot: 'البلوت', jackaroo: 'جاكارو', snakes: 'الثعبان والسلالم', zahra: 'الزهرة', dice: 'النرد', chaos: 'أونو', hockey: 'الهوكي', billiards: 'البلياردو', quiz: 'تحدي الأسئلة', serpent: 'حلبة الثعابين', memory: 'الذاكرة', logic: 'المنطق', puzzle: 'ترتيب الأرقام', sudoku: 'سودوكو', paths: 'توصيل الأرقام', jewels: 'ماستر الجواهر', focus: 'مواجهة التركيز', cipher: 'ساحة الشفرات', wordbomb: 'صيد الكلمات', reaction: 'سرعة الاستجابة', accuracy: 'الدقة' };
  const MAIN = [
    ['wins', 'كأس الانتصارات', 'على كل فوز', [10, 50, 200, 1000], (c) => c.wins],
    ['games', 'كأس المشوار', 'على كل جولة تكملها', [25, 100, 500, 2000], (c) => c.games],
    ['online', 'كأس المنافسة', 'على الفوز أونلاين', [5, 25, 100, 400], (c) => c.rankedWins],
    ['level', 'كأس المستوى', 'على المستوى اللي توصله', [5, 15, 30, 50], (c) => levelInfo(c).level],
    ['streak', 'كأس الحضور', 'على أيام الهدية ورا بعض', [3, 5, 7], (c) => c.streak],
  ];
  const GAME_GOALS = [5, 25, 100, 300];
  function grade(value, goals) { let tier = -1; goals.forEach((g, i) => { if (value >= g) tier = i; }); return { tier, next: goals[tier + 1] ?? null }; }
  function trophies(card = {}) {
    const out = [];
    for (const [id, name, how, goals, get] of MAIN) { const value = Math.max(0, Number(get(card)) || 0), g = grade(value, goals); out.push({ id, name, how, value, ...g, goals }); }
    const stats = card.stats || {};
    for (const [game, label] of Object.entries(GAMES)) {
      const wins = Number(stats[game]?.[1]) || 0, g = grade(wins, GAME_GOALS);
      out.push({ id: 'game-' + game, name: 'كأس ' + label, how: 'على الفوز في ' + label, value: wins, ...g, goals: GAME_GOALS, game: true });
    }
    return out;
  }
  const earned = (card) => trophies(card).filter((t) => t.tier >= 0);
  function cup(color, size = 30) {
    const ns = 'http://www.w3.org/2000/svg', svg = doc.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 32 32'); svg.setAttribute('width', size); svg.setAttribute('height', size); svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = `<path d="M9 5h14v6a7 7 0 0 1-14 0z" fill="${color}"/><path d="M9 7H5.5a3.5 3.5 0 0 0 3.8 5.4M23 7h3.5a3.5 3.5 0 0 1-3.8 5.4" fill="none" stroke="${color}" stroke-width="2"/><path d="M14 18h4v4h-4z" fill="${color}"/><path d="M10 24h12v3H10z" rx="1" fill="${color}"/><path d="M12 7h3v7a4 4 0 0 1-3-3z" fill="#fff" opacity=".35"/>`;
    return svg;
  }
  function chip(t) {
    const el = node('span', 'bs-trophy' + (t.tier < 0 ? ' locked' : ''));
    el.style.setProperty('--cup', t.tier < 0 ? '#5d6b82' : TIER_COLORS[t.tier]);
    el.append(cup(t.tier < 0 ? '#5d6b82' : TIER_COLORS[t.tier]));
    const copy = node('span', 'bs-trophy-copy');
    copy.append(node('b', '', t.name), node('small', '', t.tier < 0 ? (fmt.format(t.value) + ' من ' + fmt.format(t.next)) : TIER_NAMES[t.tier] + (t.next ? ' · الجاي عند ' + fmt.format(t.next) : ' · أعلى درجة')));
    el.append(copy);
    el.title = t.how;
    return el;
  }
  /** the shelf: the best few trophies (compact) or the whole room (all) */
  function shelf(card, { all = false, limit = 4 } = {}) {
    const list = trophies(card), got = list.filter((t) => t.tier >= 0).sort((a, b) => b.tier - a.tier || Number(Boolean(a.game)) - Number(Boolean(b.game)));
    const box = node('div', 'bs-trophies' + (all ? ' all' : ''));
    const head = node('div', 'bs-trophies-head');
    head.append(cup(TIER_COLORS[2], 20), node('b', '', got.length ? fmt.format(got.length) + ' ' + (got.length === 1 ? 'كأس' : got.length === 2 ? 'كأسين' : 'كؤوس') : 'ما عنده كؤوس للحين'));
    box.append(head);
    const grid = node('div', 'bs-trophy-grid');
    const show = all ? [...got, ...list.filter((t) => t.tier < 0 && (!t.game || t.value > 0))] : got.slice(0, limit);
    show.forEach((t) => grid.append(chip(t)));
    if (show.length) box.append(grid);
    const waiting = list.filter((t) => t.tier < 0 && t.game && t.value === 0).length;
    if (all && waiting) box.append(node('p', 'bs-trophies-more', 'ولكل لعبة كأس: أول 5 انتصارات فيها تعطيك كأسها البرونزي (' + fmt.format(waiting) + ' لعبة باقية).'));
    return box;
  }

  // ------------------------------------------------------------ sheets
  let sheet = null;
  function openSheet(title, build) {
    sheet?.remove();
    sheet = node('div', 'bs-pp-sheet');
    const panel = node('section', 'bs-pp-panel'); panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-label', title);
    const close = node('button', 'bs-pp-close', '✕'); close.type = 'button'; close.setAttribute('aria-label', 'إغلاق');
    panel.append(close, node('h2', '', title));
    build(panel, () => sheet?.remove());
    sheet.append(panel);
    sheet.addEventListener('click', (e) => { if (e.target === sheet || e.target === close) sheet.remove(); });
    (doc.fullscreenElement || doc.body).append(sheet);
    setTimeout(() => close.focus({ preventScroll: true }), 30);
    return panel;
  }
  const toast = (t) => window.BS_PLATFORM?.toast?.(t);

  async function compress(file) {
    const bitmap = await createImageBitmap(file);
    const side = Math.min(bitmap.width, bitmap.height), size = 320;
    const canvas = doc.createElement('canvas'); canvas.width = canvas.height = size;
    const g = canvas.getContext('2d'); g.imageSmoothingQuality = 'high';
    g.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
    bitmap.close?.();
    for (const q of [.82, .7, .58, .45]) {
      let url = canvas.toDataURL('image/webp', q), type = 'image/webp';
      if (!url.startsWith('data:image/webp')) { url = canvas.toDataURL('image/jpeg', q + .05); type = 'image/jpeg'; }
      const data = url.slice(url.indexOf(',') + 1);
      if (data.length * .75 < 85000) return { type, data, url };
    }
    throw new Error('الصورة كبيرة، جرّب صورة ثانية');
  }

  function openPicker() {
    const social = window.BS_SOCIAL;
    if (!social?.isLoggedIn?.()) { location.href = '/social?next=' + encodeURIComponent(location.pathname); return; }
    const me = social.profile?.() || {};
    openSheet('صورتك', (panel, done) => {
      const now = node('div', 'bs-pp-current');
      now.append(avatar({ username: me.username, photo: me.photo, name: me.displayName }, 'bs-avatar xl'));
      const note = node('p', 'bs-pp-note', 'اختر صورة جاهزة (أبطال وبنات وغيرهم) أو ارفع صورتك. أول تغيير مجانًا، وبعدها 250 عملة.');
      const grid = node('div', 'bs-pp-grid');
      const busy = (on) => panel.classList.toggle('busy', on);
      async function save(photo, label) {
        busy(true); note.textContent = 'نحفظ صورتك…';
        try { const r = await social.setPhoto(photo); me.photo = r.photo || null; now.replaceChildren(avatar({ username: me.username, photo: me.photo, name: me.displayName }, 'bs-avatar xl')); note.textContent = label; window.BS_AUDIO?.play?.('combo', { volume: .5 }); setTimeout(done, 700); }
        catch (e) { note.textContent = e?.message || 'ما انحفظت، جرّب مرة ثانية.'; }
        finally { busy(false); }
      }
      for (const id of PRESETS) {
        const b = node('button', 'bs-pp-pick' + (me.photo?.kind === 'preset' && me.photo.id === id ? ' on' : '')); b.type = 'button';
        const img = node('img'); img.src = presetUrl(id); img.alt = ''; b.append(img); b.setAttribute('aria-label', 'اختر هذي الصورة');
        b.onclick = () => save({ kind: 'preset', id }, 'تم، هذي صورتك الحين ✓');
        grid.append(b);
      }
      const file = node('input'); file.type = 'file'; file.accept = 'image/*'; file.hidden = true;
      const upload = node('button', 'bs-btn primary bs-pp-upload', 'ارفع صورة من جوالك'); upload.type = 'button';
      upload.onclick = () => file.click();
      file.onchange = async () => {
        const f = file.files?.[0]; file.value = ''; if (!f) return;
        try { busy(true); note.textContent = 'نجهز صورتك…'; const c = await compress(f); await save({ kind: 'upload', type: c.type, data: c.data }, 'تم رفع صورتك ✓'); }
        catch (e) { note.textContent = e?.message || 'ما قدرنا نقرأ الصورة، جرّب صورة ثانية.'; busy(false); }
      };
      const rules = node('p', 'bs-pp-rules', 'الصورة لازم تكون لائقة. أي صورة ينبلغ عنها تنشال، ولو تكرر الشي ممكن ينوقف الحساب.');
      const actions = node('div', 'bs-pp-actions'); actions.append(upload);
      if (me.photo) { const rm = node('button', 'bs-btn', 'شيل الصورة'); rm.type = 'button'; rm.onclick = () => save({ kind: 'none' }, 'شلنا الصورة ✓'); actions.append(rm); }
      panel.append(now, note, grid, actions, rules, file);
    });
  }

  function report(username, name) {
    const social = window.BS_SOCIAL;
    if (!social?.isLoggedIn?.()) { toast('سجّل دخولك عشان تقدر تبلّغ'); return; }
    openSheet('بلاغ عن صورة', (panel, done) => {
      const p = node('p', 'bs-pp-note', 'تبلّغ عن صورة ' + (name || '@' + username) + '؟ إذا كانت غير لائقة تنشال بعد المراجعة.');
      const yes = node('button', 'bs-btn danger', 'بلّغ'); yes.type = 'button';
      const no = node('button', 'bs-btn', 'تراجع'); no.type = 'button'; no.onclick = done;
      yes.onclick = async () => { yes.disabled = true; try { await social.reportPhoto(username); p.textContent = 'وصل بلاغك، شكراً لك. بنراجع الصورة.'; yes.remove(); no.textContent = 'تمام'; } catch (e) { yes.disabled = false; p.textContent = e?.message || 'ما وصل البلاغ، جرّب مرة ثانية.'; } };
      const row = node('div', 'bs-pp-actions'); row.append(yes, no); panel.append(p, row);
    });
  }

  // ------------------------------------------------------------ tap any player
  function needCard() {
    if (window.BS_PLAYER_CARD) return Promise.resolve(window.BS_PLAYER_CARD);
    css('/assets/css/player-card-v33-7.css?v=33.9.8');
    return new Promise((ok) => { const s = doc.createElement('script'); s.src = '/assets/js/player-card-v33-7.js?v=33.9.8'; s.onload = () => ok(window.BS_PLAYER_CARD); s.onerror = () => ok(null); doc.head.append(s); });
  }
  doc.addEventListener('click', async (e) => {
    const el = e.target?.closest?.('[data-player-username]');
    if (!el || e.target.closest('button,a,input,select,textarea')) return;
    e.preventDefault();
    const card = await needCard();
    card?.open?.({ username: el.dataset.playerUsername, name: el.dataset.playerName || el.dataset.playerUsername });
  });

  // ------------------------------------------------------------ your own profile (the friends page)
  function myCard() {
    const p = window.BS_CAREER?.get?.(); if (!p) return null;
    return { level: p.level, xp: p.xp, wins: p.wins, games: p.games, rankedWins: p.rankedWins, streak: p.dailyStreak, stats: p.stats || {} };
  }
  // 33.9.7: your profile lives in a sheet opened from the player bar at the top of every page
  function meNow() {
    const social = window.BS_SOCIAL, acc = social?.isLoggedIn?.() ? social.profile?.() : null, c = window.BS_CAREER?.get?.() || {};
    return { acc, name: acc?.displayName || c.name || 'ضيف', username: acc?.username || '', photo: acc?.photo || null, hero: c.equipped?.character || '', card: myCard() || {}, coins: Number(c.coins) || 0 };
  }
  function renderBar() {
    if (typeof location === 'undefined' || /^\/admin/.test(location.pathname)) return;
    const me = meNow(), L = levelInfo(me.card);
    for (const brand of doc.querySelectorAll('.bs-topbar .bs-brand')) {
      brand.classList.add('bs-playerbar'); brand.setAttribute('href', '#profile'); brand.setAttribute('aria-label', 'ملفك: ' + me.name);
      const pic = avatar({ username: me.username, photo: me.photo, name: me.name, fallback: me.hero ? '/assets/heroes/face/' + me.hero + '.webp' : '' }, 'bs-avatar bs-pb-pic');
      const copy = node('span', 'bs-pb-copy');
      copy.append(node('b', '', me.name), node('span', '', 'المستوى ' + L.level + ' · ' + L.tier));
      const bar = node('i', 'bs-pb-xp'); bar.style.setProperty('--x', L.pct + '%'); bar.style.setProperty('--tier', L.color); copy.append(bar);
      brand.replaceChildren(pic, copy);
      if (!brand.dataset.pb) { brand.dataset.pb = '1'; brand.addEventListener('click', (e) => { e.preventDefault(); openProfile(); }); }
    }
  }
  function openProfile() {
    const me = meNow(), card = me.card;
    openSheet('ملفك', (panel, done) => {
      panel.classList.add('bs-pp-profile');
      const top = node('div', 'bs-pp-top');
      const pic = avatar({ username: me.username, photo: me.photo, name: me.name, fallback: me.hero ? '/assets/heroes/face/' + me.hero + '.webp' : '' }, 'bs-avatar xl');
      const side = node('div', 'bs-pp-side');
      const nm = node('div', 'bs-pp-name'); nm.append(node('b', '', me.name)); if (me.username) nm.append(node('small', '', '@' + me.username));
      side.append(nm, levelBar(card));
      top.append(pic, side);
      const stats = node('div', 'bs-pp-stats');
      for (const [k, v] of [['العملات', fmt.format(me.coins)], ['الانتصارات', fmt.format(card.wins || 0)], ['المباريات', fmt.format(card.games || 0)], ['الكؤوس', fmt.format(earned(card).length)]]) { const c = node('div'); c.append(node('b', '', v), node('small', '', k)); stats.append(c); }
      const acts = node('div', 'bs-pp-actions');
      const chPic = node('button', 'bs-btn primary', 'غيّر صورتك'); chPic.type = 'button'; chPic.onclick = () => { done(); openPicker(); };
      const chName = node('button', 'bs-btn', 'غيّر اسمك'); chName.type = 'button'; chName.onclick = () => renameBox(panel, me);
      acts.append(chPic, chName);
      const price = node('p', 'bs-pp-rules', me.acc ? 'أول تغيير للصورة وأول تغيير للاسم مجانًا، وبعدها كل تغيير بـ 250 عملة.' : 'سجّل دخولك عشان تحط صورة ويشوفك أصدقاؤك.');
      const links = node('div', 'bs-pp-actions');
      const friends = node('a', 'bs-btn', me.acc ? 'أصدقاؤك وحسابك' : 'سجّل دخولك'); friends.href = '/social';
      links.append(friends);
      panel.append(top, stats, acts, price, node('h3', 'bs-pp-title', 'كؤوسك'), shelf(card, { all: true }), links);
      if (me.acc?.role === 'owner') moderation(panel);
    });
  }
  function renameBox(panel, me) {
    if (panel.querySelector('.bs-pp-rename')) return;
    const box = node('form', 'bs-pp-rename');
    const input = node('input'); input.maxLength = 20; input.value = me.name; input.setAttribute('aria-label', 'اسمك الجديد');
    const save = node('button', 'bs-btn primary', 'احفظ'); save.type = 'submit';
    const note = node('small', 'bs-pp-note', me.acc ? 'أول تغيير مجانًا، وبعدها 250 عملة.' : '');
    box.append(input, save, note);
    box.onsubmit = async (e) => {
      e.preventDefault(); const name = input.value.trim(); if (!name) return;
      save.disabled = true;
      try { await window.BS_CAREER.rename(name); note.textContent = 'تم ✓'; window.BS_AUDIO?.play?.('coin', { volume: .5 }); setTimeout(() => sheet?.remove(), 700); }
      catch (err) { note.textContent = err?.message || 'ما انحفظ، جرّب مرة ثانية.'; save.disabled = false; }
    };
    panel.querySelector('.bs-pp-actions')?.after(box); input.focus();
  }
  async function moderation(box) {
    const wrap = node('div', 'bs-pp-mod'); wrap.append(node('h3', 'bs-pp-title', 'صور مبلغ عنها'));
    box.append(wrap);
    let data; try { data = await window.BS_SOCIAL.moderation(); } catch { wrap.append(node('p', 'bs-pp-note', 'ما قدرنا نجيب البلاغات الحين.')); return; }
    const list = data.reports || [];
    if (!list.length) { wrap.append(node('p', 'bs-pp-note', 'ما فيه بلاغات ✓')); return; }
    for (const r of list) {
      const row = node('div', 'bs-pp-modrow');
      const img = node('img'); img.alt = ''; img.src = '/api/social/photo/' + encodeURIComponent(r.username) + '?review=' + r.at; img.onerror = () => { img.replaceWith(node('span', 'bs-pp-gone', r.hidden ? 'مخفية' : '—')); };
      const copy = node('div'); copy.append(node('b', '', '@' + r.username), node('small', '', fmt.format(r.reports) + ' بلاغ' + (r.hidden ? ' · مخفية عن اللاعبين' : '')));
      const rm = node('button', 'bs-btn danger', 'احذفها'), keep = node('button', 'bs-btn', 'خلها'); rm.type = keep.type = 'button';
      const act = async (action) => { rm.disabled = keep.disabled = true; try { await window.BS_SOCIAL.moderation(r.username, action); row.remove(); } catch { rm.disabled = keep.disabled = false; } };
      rm.onclick = () => act('remove'); keep.onclick = () => act('keep');
      row.append(img, copy, rm, keep); wrap.append(row);
    }
  }
  addEventListener('bs-career-change', () => setTimeout(renderBar, 0));
  addEventListener('bs-photo-change', () => setTimeout(renderBar, 0));
  addEventListener('bs-social-session', () => setTimeout(renderBar, 0));
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', () => setTimeout(renderBar, 120)); else setTimeout(renderBar, 120);
  if (typeof location !== 'undefined' && location.hash === '#profile') setTimeout(openProfile, 600);

  // ------------------------------------------------------------ a new level, a new trophy
  let before = null;
  addEventListener('bs-career-change', () => {
    const card = myCard(); if (!card) return;
    const now = { level: levelInfo(card).level, cups: new Map(earned(card).map((t) => [t.id, t.tier])) };
    if (before) {
      if (now.level > before.level) { toast('🎉 وصلت المستوى ' + now.level + ' · ' + levelInfo(card).tier); window.BS_AUDIO?.play?.('levelUp', { volume: .75 }); }
      else for (const t of earned(card)) if ((before.cups.get(t.id) ?? -1) < t.tier) { toast('🏆 ' + t.name + ' · ' + TIER_NAMES[t.tier]); window.BS_AUDIO?.play?.('combo', { volume: .6 }); break; }
    }
    before = now;
  });
  setTimeout(() => { const card = myCard(); if (card && !before) before = { level: levelInfo(card).level, cups: new Map(earned(card).map((t) => [t.id, t.tier])) }; }, 1200);

  window.BS_PROFILE_PRO = Object.freeze({ openProfile, renderBar, photoUrl, presetUrl, avatar, levelInfo, levelBar, trophies, earned, shelf, openPicker, report, PRESETS });
})();
