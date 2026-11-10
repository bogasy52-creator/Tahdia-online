/* Tahdia 33.4.0 — the Baloot tables: which table you sit at, and «طاولتك», the
   picker inside the Baloot page. A table is a shop item of type «table» (the same
   one dresses the Jackaroo and Zahra boards); here each one is its own Baloot
   table: frame, band, surface, corner fittings and an emblem under the trick
   (baloot-tables-v33-4.css). The felt carries data-table, so the previews in the
   picker are drawn by the very same rules. Buying here is the shop's own purchase. */
(function () {
  'use strict';
  const THEME = Object.freeze({
    'table-walnut': 'diwan', 'table-club': 'club', 'table-gallery': 'ivory', 'table-nocturne': 'night',
    'table-midnight': 'night', 'table-slate': 'night', 'table-botanic': 'garden', 'table-emerald': 'garden',
    'table-royal': 'palace', 'table-majlis': 'majlis', 'table-cyber': 'reactor',
  });
  const LINE = Object.freeze({
    diwan: 'ديوانية: جوز بنحاس، سدو أحمر وجوخ أخضر',
    club: 'طاولة بيضاوية: مسند جلد وحاجز نحاس',
    ivory: 'رخام عاجي، خطوط ذهب وجوخ فحمي',
    night: 'كربون وحواف مضيئة وخلايا نحل',
    garden: 'خشب الورد، حبات لؤلؤ وأغصان على اليشم',
    palace: 'إطار ذهب، حبات ذهب ومخمل بنفسجي مزخرف',
    majlis: 'جلد ومسامير نحاس، سدو عريض ودلّة',
    reactor: 'فولاذ وأضواء زرقاء وشبكة',
  });
  const ORDER = ['table-walnut', 'table-club', 'table-gallery', 'table-nocturne', 'table-botanic', 'table-royal', 'table-majlis', 'table-cyber'];
  const ERRORS = { insufficient_coins: 'رصيدك ما يكفي لهذي الطاولة', price_changed: 'تغيّر السعر، جرّب مرة ثانية', item_retired: 'هذي الطاولة ما عادت تنباع', item_locked: 'هذي الطاولة مقفلة' };
  const $ = (id) => document.getElementById(id);
  const make = (tag, cls, text) => { const el = document.createElement(tag); if (cls) el.className = cls; if (text != null) el.textContent = String(text); return el; };
  const career = () => window.BS_CAREER;
  const catalog = () => window.BS_CAREER_CORE?.CATALOG || career()?.catalog || [];
  const profile = () => { try { return career()?.get?.() || null; } catch { return null; } };
  const itemOf = (id) => catalog().find((x) => x.id === id);
  const equipped = () => profile()?.equipped?.table || 'table-walnut';
  const themeOf = (id) => THEME[id] || 'diwan';
  const priceOf = (id) => { try { return window.BS_CAREER_CORE?.itemPrice?.(id, career()?.now?.() ?? Date.now()) ?? itemOf(id)?.price ?? 0; } catch { return itemOf(id)?.price ?? 0; } };
  const toast = (text) => { try { window.BS_PLATFORM?.toast?.(text); } catch {} };
  const sound = (name) => { try { window.BS_AUDIO?.play?.(name); } catch {} };

  /** The tables shown in the picker: the shop's, and any other you own. */
  function tables() {
    const owned = new Set(profile()?.owned || []);
    return ORDER.filter((id) => {
      const item = itemOf(id);
      if (!item) return false;
      if (id === 'table-cyber' || item.source || item.retired) return owned.has(id);
      return true;
    });
  }

  /** A table in miniature, drawn by the same rules as the real one. */
  function felt(theme, { seats = false, cards = false } = {}) {
    const root = make('div', 'bl-felt blt-felt'); root.dataset.table = theme;
    const inner = make('div', 'bl-felt-inner'), center = make('div', 'bl-center');
    inner.append(center);
    if (seats) {
      for (const [pos, name, letter] of [['top', 'شريكك', 'ش'], ['right', 'خصم', 'خ'], ['left', 'خصم', 'خ'], ['bottom', 'أنت', 'أ']]) {
        // own class names: the table script looks for .bl-seat anywhere on the page
        const seat = make('div', 'blt-seat'); seat.dataset.pos = pos; seat.dataset.team = pos === 'top' || pos === 'bottom' ? '0' : '1';
        const avatar = make('div', 'blt-avatar', letter);
        const plate = make('div', 'blt-name'); plate.append(make('b', null, name));
        seat.append(avatar, plate); inner.append(seat);
      }
    }
    if (cards && window.BS_CARDS?.url) {
      const deck = profile()?.equipped?.deck || 'deck-classic';
      [['KH', 0], ['AS', 1], ['TD', 2]].forEach(([card, i]) => { const img = make('img', 'blt-card'); img.alt = ''; img.decoding = 'async'; img.src = window.BS_CARDS.url(card, deck); img.style.setProperty('--i', String(i)); center.append(img); });
    }
    root.append(inner);
    return root;
  }

  /** Dress the real table (the felt) for the equipped table. */
  function apply(target = $('felt')) {
    if (target) target.dataset.table = themeOf(equipped());
    paintChoice();
  }

  /* ---------- «طاولتك» on the Baloot page ---------- */
  function paintChoice() {
    const host = $('tableChoice');
    if (!host) return;
    const id = equipped(), item = itemOf(id);
    const button = make('button', 'blt-choice'); button.type = 'button'; button.setAttribute('aria-haspopup', 'dialog');
    const thumb = make('span', 'blt-thumb'); thumb.append(felt(themeOf(id)));
    const copy = make('span', 'blt-choice-copy'); copy.append(make('small', null, 'طاولتك'), make('b', null, item?.name || 'طاولة الجوز'), make('em', null, LINE[themeOf(id)]));
    button.append(thumb, copy, make('span', 'blt-choice-go', 'غيّر الطاولة'));
    button.addEventListener('click', () => open(button));
    host.replaceChildren(button);
  }

  /* ---------- the picker ---------- */
  let sheet = null, chosen = '', returnFocus = null, busy = false;
  function build() {
    sheet = make('div', 'bl-sheet blt-sheet'); sheet.id = 'tableSheet'; sheet.hidden = true;
    sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-labelledby', 'tableSheetTitle');
    const card = make('div', 'bl-sheet-card blt-card');
    const head = make('div', 'blt-head'); const title = make('h2', null, 'طاولات البلوت'); title.id = 'tableSheetTitle';
    const close = make('button', 'bl-round-btn blt-close', '✕'); close.type = 'button'; close.setAttribute('aria-label', 'إغلاق');
    close.addEventListener('click', hide); head.append(title, close);
    const stage = make('div', 'blt-stage'), info = make('div', 'blt-info'), list = make('div', 'blt-list');
    list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', 'الطاولات');
    const action = make('button', 'bl-cta blt-action'); action.type = 'button'; action.addEventListener('click', act);
    const foot = make('div', 'blt-foot'); foot.append(make('small', 'blt-coins'), make('small', 'blt-note', 'الطاولة نفسها تلبس لوحتي الجاكارو والزهرة.'));
    card.append(head, stage, info, list, action, foot); sheet.append(card); document.body.append(sheet);
    sheet.addEventListener('click', (event) => { if (event.target === sheet) hide(); });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && sheet && !sheet.hidden) { event.preventDefault(); hide(); } });
    addEventListener('resize', () => { if (sheet && !sheet.hidden) fit(); });
  }
  function fit() {
    const stage = sheet?.querySelector('.blt-stage'), table = stage?.firstElementChild;
    if (!table) return;
    const scale = Math.max(.4, Math.min(1, stage.clientWidth / 300, (innerHeight * .36) / 400));
    table.style.transform = `scale(${scale})`; stage.style.height = Math.round(400 * scale) + 'px';
  }
  function paint() {
    if (!sheet) return;
    const id = chosen || equipped(), theme = themeOf(id), item = itemOf(id), p = profile();
    const owned = new Set(p?.owned || []), mine = equipped(), price = priceOf(id), coins = Number(p?.coins || 0);
    const stage = sheet.querySelector('.blt-stage'); stage.replaceChildren(felt(theme, { seats: true, cards: true })); fit();
    const info = sheet.querySelector('.blt-info'); info.replaceChildren(make('b', null, item?.name || ''), make('small', null, LINE[theme]));
    const list = sheet.querySelector('.blt-list'), hadFocus = list.contains(document.activeElement); list.replaceChildren();
    for (const tid of tables()) {
      const option = make('button', 'blt-option'); option.type = 'button'; option.dataset.item = tid;
      option.setAttribute('role', 'option'); option.setAttribute('aria-selected', String(tid === id));
      const thumb = make('span', 'blt-thumb'); thumb.append(felt(themeOf(tid)));
      const status = tid === mine ? 'طاولتك ✓' : owned.has(tid) ? 'عندك' : '🪙 ' + priceOf(tid);
      option.append(thumb, make('b', null, itemOf(tid)?.name || ''), make('small', tid === mine ? 'is-on' : owned.has(tid) ? 'is-owned' : 'is-price', status));
      option.addEventListener('click', () => { chosen = tid; sound('balootFlip'); paint(); });
      list.append(option);
    }
    const action = sheet.querySelector('.blt-action');
    action.disabled = busy || id === mine || (!owned.has(id) && coins < price);
    action.textContent = id === mine ? 'هذي طاولتك ✓' : owned.has(id) ? 'اجلس على هذي الطاولة' : coins < price ? `تحتاج 🪙 ${price} · رصيدك ${coins}` : `اشترها بـ 🪙 ${price} واجلس`;
    sheet.querySelector('.blt-coins').textContent = 'رصيدك: 🪙 ' + coins;
    const picked = list.querySelector('[aria-selected="true"]');
    picked?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
    if (hadFocus) picked?.focus?.({ preventScroll: true });
  }
  async function act() {
    const id = chosen || equipped(), p = profile();
    if (busy || !id || id === equipped() || !career()) return;
    busy = true; paint();
    try {
      if ((p?.owned || []).includes(id)) await career().equip(id);
      else await career().purchase(id, { expectedPrice: priceOf(id) });
      sound('balootChime'); toast('جلست على ' + (itemOf(id)?.name || 'الطاولة'));
    } catch (error) { toast(ERRORS[error?.message] || 'ما قدرنا نغيّر الطاولة الحين، جرّب بعد شوي'); }
    finally { busy = false; apply(); paint(); }
  }
  function open(from) {
    if (!sheet) build();
    returnFocus = from || document.activeElement; chosen = equipped();
    sheet.hidden = false; paint();
    sheet.querySelector('.blt-close')?.focus();
  }
  function hide() {
    if (!sheet || sheet.hidden) return;
    sheet.hidden = true; chosen = '';
    try { returnFocus?.focus?.(); } catch {}
  }

  addEventListener('bs-career-change', () => { apply(); if (sheet && !sheet.hidden) paint(); });
  const start = () => {
    apply();
    $('changeTable')?.addEventListener('click', (event) => { $('closeLog')?.click(); open(event.currentTarget); });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
  window.BS_BALOOT_TABLES = Object.freeze({ THEME, LINE, themeOf, tables, felt, apply, open, hide });
})();
