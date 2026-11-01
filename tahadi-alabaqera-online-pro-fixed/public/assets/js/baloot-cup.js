/* Tahdia 33.2.0 — the weekly Baloot cup on the Baloot page.
   The menu shows your place and points this week, the top of the table and the
   time left; «الترتيب والجوائز» opens the full table, the prizes and last
   week's champions. Last week's top three claim their coins here. Points come
   from the server (every Baloot match an account finishes): this page only
   reads them. One small request when the menu shows. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const number = new Intl.NumberFormat('en-US');
  const MEDALS = ['الأول', 'الثاني', 'الثالث'];
  let view = null, loadedAt = 0, offset = 0, busy = false, sheet = null, tick = 0, request = null;

  function session() { try { return String(localStorage.getItem('bs_social_session') || ''); } catch { return ''; } }
  function player() { const name = session().split('.')[0].toLowerCase(); return /^[a-z0-9_]{3,20}$/.test(name) ? name : ''; }
  function node(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  // Arabic counting: 1 and 2 have their own forms, 3–10 take the plural, 11+ the singular.
  function count(n, [one, two, few, many]) { return n === 1 ? one : n === 2 ? two : n >= 3 && n <= 10 ? `${n} ${few}` : `${number.format(n)} ${many}`; }
  const points = (n) => (n === 0 ? '0 نقطة' : count(n, ['نقطة', 'نقطتين', 'نقاط', 'نقطة']));
  function timeLeft(ms) {
    if (ms <= 60_000) return 'تنتهي خلال دقيقة';
    const d = Math.floor(ms / 86_400_000), h = Math.floor((ms % 86_400_000) / 3_600_000), m = Math.ceil((ms % 3_600_000) / 60_000);
    const days = (n) => count(n, ['يوم', 'يومين', 'أيام', 'يومًا']), hours = (n) => count(n, ['ساعة', 'ساعتين', 'ساعات', 'ساعة']);
    if (d) return 'تنتهي بعد ' + days(d) + (h ? ' و' + hours(h) : '');
    if (h) return 'تنتهي بعد ' + hours(h);
    return 'تنتهي بعد ' + count(m, ['دقيقة', 'دقيقتين', 'دقائق', 'دقيقة']);
  }
  const now = () => Date.now() + offset;
  const trophy = () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = '<path d="M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M7 6H4.5a2.5 2.5 0 0 0 2.6 3.9M17 6h2.5a2.5 2.5 0 0 1-2.6 3.9M12 13v4m-4 3h8m-6.5 0 .5-3h4l.5 3"/>';
    return svg;
  };

  async function load({ fresh = false } = {}) {
    if (!$('balootCup') || (!fresh && Date.now() - loadedAt < 45_000 && view)) return view;
    request?.abort?.();
    const controller = request = new AbortController(), name = player();
    try {
      const res = await fetch('/api/baloot/cup' + (name ? '?player=' + name : ''), { cache: 'no-store', signal: controller.signal });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'cup_unavailable');
      view = data; loadedAt = Date.now(); offset = Number.isFinite(data.serverNow) ? data.serverNow - Date.now() : 0;
      render();
    } catch (error) { if (error.name !== 'AbortError' && !view) $('balootCup').hidden = true; }
    return view;
  }

  /* ---------- the card in the Baloot menu ---------- */
  function render() {
    const box = $('balootCup');
    if (!box || !view) return;
    box.replaceChildren();
    box.hidden = false;
    const head = node('header', 'bl-cup-head'), icon = node('span', 'bl-cup-icon'), copy = node('div');
    icon.append(trophy());
    copy.append(node('h2', null, 'بطولة البلوت الأسبوعية'), node('small', 'bl-cup-left', timeLeft(view.endsAt - now())));
    head.append(icon, copy);
    box.append(head);
    if (view.prize) box.append(prizeBanner(view.prize));
    const name = player(), me = view.me;
    if (!name) {
      const p = node('p', 'bl-cup-empty', 'سجّل دخولك عشان تدخل البطولة وتنافس على الجوائز. ');
      const a = node('a', 'bl-cup-link', 'سجّل دخولك'); a.href = '/social'; p.append(a); box.append(p);
    } else if (me?.games) {
      const line = node('p', 'bl-cup-me');
      if (me.rank) line.append('مركزك ', node('b', null, number.format(me.rank)), ' · ');
      else line.append('خارج أول 100 · ');
      line.append('نقاطك ', node('b', null, number.format(me.points)));
      box.append(line);
    } else box.append(node('p', 'bl-cup-empty', 'ما لعبت هالأسبوع. كل صكّة تكملها تدخلك الترتيب، والفوز بثلاث نقاط.'));
    if (view.players.length) {
      const list = node('ol', 'bl-cup-top');
      for (const row of view.players.slice(0, 3)) list.append(rowItem(row));
      box.append(list);
    } else box.append(node('p', 'bl-cup-empty', 'ما فيه نتائج للحين. أول صكّة تخلصها تحطك في الصدارة.'));
    const more = node('button', 'bl-btn bl-cup-more', 'الترتيب والجوائز'); more.type = 'button'; more.onclick = openSheet;
    box.append(more);
    clearInterval(tick); tick = setInterval(() => { const left = box.querySelector('.bl-cup-left'); if (left && view) left.textContent = timeLeft(view.endsAt - now()); if (view && now() >= view.endsAt) load({ fresh: true }); }, 60_000);
  }
  function rowItem(row) {
    const li = node('li', row.username === player() ? 'is-me' : null);
    li.append(node('i', null, String(row.rank)), node('span', null, row.name), node('b', null, number.format(row.points)));
    li.setAttribute('aria-label', `المركز ${row.rank}: ${row.name}، ${points(row.points)}`);
    return li;
  }
  function prizeBanner(prize) {
    const box = node('div', 'bl-cup-prize'), text = node('p', null, `مبروك! جيت ${MEDALS[prize.rank - 1]} في بطولة الأسبوع الماضي.`);
    const claim = node('button', 'bl-cta bl-cup-claim', `استلم ${number.format(prize.coins)} عملة`); claim.type = 'button';
    claim.onclick = () => claimPrize(claim);
    box.append(text, claim);
    return box;
  }
  async function claimPrize(button) {
    if (busy) return;
    busy = true; button.disabled = true;
    try {
      const res = await fetch('/api/baloot/cup/claim', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + session() }, body: '{}', cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) throw new Error('سجّل دخولك مرة ثانية وبعدها استلم جائزتك.');
      if (!res.ok || !data.ok) throw new Error(data.error === 'no_prize' ? 'استلمت هذي الجائزة من قبل.' : 'ما قدرنا نضيف الجائزة الحين. جرّب بعد شوي.');
      window.BS_PLATFORM?.toast?.(`أضفنا ${number.format(data.prize.coins)} عملة لرصيدك 🏆`);
      try { await window.BS_CAREER?.refresh?.(); } catch {}
      await load({ fresh: true });
    } catch (error) { window.BS_PLATFORM?.toast?.(error.message); button.disabled = false; }
    finally { busy = false; }
  }

  /* ---------- the full table ---------- */
  function buildSheet() {
    sheet = node('div', 'bl-sheet bl-cup-sheet');
    sheet.id = 'cupSheet'; sheet.hidden = true;
    sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-labelledby', 'cupSheetTitle');
    const card = node('div', 'bl-sheet-card bl-cup-card'), head = node('div', 'bl-cup-sheet-head'), title = node('h2', null, 'بطولة البلوت الأسبوعية'), close = node('button', 'bl-round-btn', '✕');
    title.id = 'cupSheetTitle'; close.type = 'button'; close.setAttribute('aria-label', 'إغلاق'); close.onclick = closeSheet;
    head.append(title, close);
    card.append(head, node('div', 'bl-cup-body'));
    sheet.append(card);
    sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sheet && !sheet.hidden) closeSheet(); });
    document.body.append(sheet);
  }
  function fillSheet() {
    const body = sheet.querySelector('.bl-cup-body');
    body.replaceChildren();
    body.append(node('p', 'bl-cup-left bl-cup-center', timeLeft(view.endsAt - now())));
    if (view.prize) body.append(prizeBanner(view.prize));
    const prizes = node('div', 'bl-cup-prizes');
    view.prizes.forEach((coins, i) => { const tile = node('div', 'p' + (i + 1)); tile.append(node('b', null, number.format(coins)), node('small', null, 'عملة للمركز ' + MEDALS[i])); prizes.append(tile); });
    const rules = node('ul', 'bl-cup-rules');
    rules.append(node('li', null, `كل صكّة تكملها بحسابك = ${points(view.points.play)}، والفوز = ${points(view.points.win)}.`),
      node('li', null, 'الترتيب يبدأ من جديد كل ليلة اثنين الساعة 12 بتوقيت السعودية، وأول ثلاثة يستلمون جوائزهم من هنا خلال أسبوعين.'));
    body.append(prizes, rules);
    if (view.players.length) {
      const table = node('table', 'bl-cup-table'), thead = node('thead'), tr = node('tr'), tbody = node('tbody');
      for (const h of ['#', 'اللاعب', 'النقاط', 'الفوز']) tr.append(node('th', null, h));
      thead.append(tr);
      for (const row of view.players) {
        const r = node('tr', row.username === player() ? 'is-me' : null);
        r.append(node('td', null, String(row.rank)), node('td', null, row.name), node('td', null, number.format(row.points)), node('td', null, `${row.wins} من ${row.games}`));
        tbody.append(r);
      }
      table.append(thead, tbody);
      const wrap = node('div', 'bl-cup-table-wrap'); wrap.append(table); body.append(wrap);
      if (view.total > view.players.length) body.append(node('small', 'bl-cup-note', `يظهر أول ${view.players.length} من ${number.format(view.total)} لاعب.`));
    } else body.append(node('p', 'bl-cup-empty', 'ما فيه نتائج للحين. أول صكّة تخلصها تحطك في الصدارة.'));
    const me = view.me;
    if (me?.games && !(me.rank && me.rank <= view.players.length)) body.append(node('p', 'bl-cup-mine', me.rank ? `مركزك ${me.rank} · ${points(me.points)}` : `${points(me.points)} · خارج أول 100`));
    if (view.champions?.players?.length) {
      body.append(node('h3', 'bl-cup-sub', 'أبطال الأسبوع الماضي'));
      const list = node('ol', 'bl-cup-top bl-cup-champions');
      for (const row of view.champions.players) list.append(rowItem(row));
      body.append(list);
    }
  }
  async function openSheet() {
    if (!sheet) buildSheet();
    if (view) fillSheet();
    sheet.hidden = false;
    sheet.querySelector('.bl-round-btn')?.focus();
    await load({ fresh: true });
    if (!sheet.hidden && view) fillSheet();
  }
  function closeSheet() { if (sheet) sheet.hidden = true; $('balootCup')?.querySelector('.bl-cup-more')?.focus(); }

  /* ---------- after a match: what it added ---------- */
  function matchEnded(won) {
    const line = $('matchCup');
    if (line) {
      const add = won ? 3 : 1;
      line.textContent = player() ? `+${points(add)} في بطولة البلوت الأسبوعية 🏆` : 'سجّل دخولك عشان تنحسب لك نقاط البطولة.';
      line.hidden = false;
    }
    setTimeout(() => load({ fresh: true }), 4000);
  }

  function init() {
    if (!$('balootCup')) return;
    load();
    // back from a table: show the new points
    const setup = $('setup');
    if (setup && window.MutationObserver) new MutationObserver(() => { if (!setup.hidden) load(); }).observe(setup, { attributes: true, attributeFilter: ['hidden'] });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
    addEventListener('storage', (e) => { if (e.key === 'bs_social_session') load({ fresh: true }); });
  }
  window.BS_BALOOT_CUP = Object.freeze({ load, matchEnded, open: openSheet, get view() { return view; } });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
