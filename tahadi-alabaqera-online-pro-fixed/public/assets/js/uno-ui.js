/* A full-screen card table. Inputs always go through the room's action handler.
   33.9.0: the cards are bold classic cards of our own — a bright colour field, a white diamond with
   the big number or sign, the indices in the corners, a wild card split in four colours — and the
   table is alive: your hand fans out, every card flies to the pile, the room glows in the colour of
   play, the direction ring turns, and skips, reverses, +2, +4, wild colours and «أونو!» land on the
   player they hit. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const make = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  // the colours of the cards: light, field and deep shade
  const PAINT = {red:['#ff6b5e','#e3262f','#8e0b17'],gold:['#ffe46b','#f6b70a','#a26f00'],green:['#5fe39b','#17a957','#0a6331'],blue:['#62b0ff','#1f6fdb','#0b3c8c'],wild:['#3d4559','#1b1f2b','#090b11']};
  const COLORS = {red:'#e3262f',gold:'#f6b70a',green:'#17a957',blue:'#1f6fdb',wild:'#1b1f2b'};
  const NAMES = {red:'أحمر',gold:'أصفر',green:'أخضر',blue:'أزرق',wild:'تغيير اللون'};
  const LABELS = {skip:'منع',reverse:'عكس',draw2:'اسحب ورقتين',wild:'غيّر اللون',draw4:'اسحب أربع'};
  const MARKS = {skip:'⊘',reverse:'⇄',draw2:'+2',wild:'✦',draw4:'+4'};
  const MODES = {classic:'كلاسيكي',stack:'سحب متراكم',quick:'جولة سريعة'};
  const FACE_ORDER = ['0','1','2','3','4','5','6','7','8','9','skip','reverse','draw2','wild','draw4'];
  const COLOR_ORDER = ['red','gold','green','blue','wild'];
  let match = null, hooks = null, mounted = false, paused = false, armed = false;
  let selected = null, handKey = '', topKey = '', seen = -1, resultKey = '', winnerActor = null, dockObserver = null;
  let dom = null, prev = null, lastFrom = null, pile = [], sorted = false, pickerReturn = null, shownTurn = '';
  const rivals = new Map();
  const me = () => match?.players.find(p => p.id === hooks.me);
  const text = (node,value) => { if (node.textContent !== value) node.textContent = value; };
  const sound = name => { if (!document.hidden) window.BS_AUDIO?.play?.(name); };
  const still = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches || window.BS_AUDIO?.getSettings?.().effects === false; } catch { return false; } };

  /* ---------- the cards ---------- */
  function sign(face, ink, deep) {
    const stroke = `stroke="${deep}" stroke-width="2.2" stroke-linejoin="round"`;
    if (/^[0-9]$/.test(face)) return `<text x="42" y="76" text-anchor="middle" font-family="'Arial Black',Arial,sans-serif" font-weight="900" font-size="46" fill="${ink}" stroke="#ffffff" stroke-width="2.4" paint-order="stroke">${face}</text>`+(face==='6'||face==='9'?`<rect x="32" y="80" width="20" height="3.6" rx="1.8" fill="${ink}"/>`:'');
    if (face === 'skip') return `<circle cx="42" cy="60" r="17" fill="none" stroke="${ink}" stroke-width="7"/><path d="M30 72 54 48" stroke="${ink}" stroke-width="7" stroke-linecap="round"/>`;
    if (face === 'reverse') return `<g transform="rotate(-35 42 60)"><path d="M27 58V52Q27 45 34 45H50V39L60 49 50 59V53H35V58Z" fill="${ink}" ${stroke}/><path d="M57 62V68Q57 75 50 75H34V81L24 71 34 61V67H49V62Z" fill="${ink}" ${stroke}/></g>`;
    if (face === 'draw2') return `<rect x="26" y="40" width="20" height="29" rx="4" fill="${ink}" stroke="#fff" stroke-width="2" transform="rotate(-12 36 54)"/><rect x="38" y="50" width="20" height="29" rx="4" fill="${ink}" stroke="#fff" stroke-width="2" transform="rotate(10 48 64)"/>`;
    const quad = (cx, cy, r) => { const c = [COLORS.red, COLORS.gold, COLORS.green, COLORS.blue]; return c.map((col, i) => { const a0 = i * Math.PI / 2 - Math.PI / 4, a1 = a0 + Math.PI / 2; return `<path d="M${cx} ${cy}L${(cx + r * Math.cos(a0)).toFixed(2)} ${(cy + r * Math.sin(a0)).toFixed(2)}A${r} ${r} 0 0 1 ${(cx + r * Math.cos(a1)).toFixed(2)} ${(cy + r * Math.sin(a1)).toFixed(2)}Z" fill="${col}"/>`; }).join(''); };
    if (face === 'wild') return `<g>${quad(42, 60, 20)}<circle cx="42" cy="60" r="20" fill="none" stroke="#fff" stroke-width="2.4"/></g>`;
    if (face === 'draw4') return [[COLORS.blue, -18, 24, 46], [COLORS.green, -6, 34, 42], [COLORS.red, 6, 44, 46], [COLORS.gold, 18, 54, 50]].map(([col, a, x, y]) => `<rect x="${x - 9}" y="${y - 13}" width="18" height="26" rx="3.6" fill="${col}" stroke="#fff" stroke-width="1.8" transform="rotate(${a} ${x} ${y})"/>`).join('');
    return `<text x="42" y="72" text-anchor="middle" font-size="30" font-weight="900" fill="${ink}">?</text>`;
  }
  function faceSVG(card) {
    const [hi, mid, deep] = PAINT[card.color] || PAINT.wild, wild = card.color === 'wild';
    const mark = MARKS[card.face] || (/^[0-9]$/.test(card.face) ? card.face : '?');
    const id = 'uc-' + String(card.id).replace(/[^a-z0-9]/gi, '');
    const ink = wild ? '#1b1f2b' : mid;
    const corner = `<g font-family="'Arial Black',Arial,sans-serif" font-weight="900" font-size="15" fill="#fff" stroke="${deep}" stroke-width="1.6" paint-order="stroke"><text x="11" y="22">${mark}</text><text x="11" y="22" transform="rotate(180 42 60)">${mark}</text></g>`;
    const window_ = wild ? '' : `<rect x="-23" y="-23" width="46" height="46" rx="11" transform="translate(42 60) rotate(45)" fill="#fffdf7"/><rect x="-23" y="-23" width="46" height="46" rx="11" transform="translate(42 60) rotate(45)" fill="none" stroke="${deep}" stroke-opacity=".35" stroke-width="1.2"/>`;
    const ring = wild ? `<circle cx="42" cy="60" r="31" fill="none" stroke="url(#r${id})" stroke-width="3"/>` : '';
    return `<svg viewBox="0 0 84 120" aria-hidden="true" direction="ltr"><defs><radialGradient id="${id}" cx="30%" cy="22%" r="95%"><stop offset="0" stop-color="${hi}"/><stop offset=".55" stop-color="${mid}"/><stop offset="1" stop-color="${deep}"/></radialGradient>`+
      (wild ? `<linearGradient id="r${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${COLORS.red}"/><stop offset=".33" stop-color="${COLORS.gold}"/><stop offset=".66" stop-color="${COLORS.green}"/><stop offset="1" stop-color="${COLORS.blue}"/></linearGradient>` : '') +
      `</defs><rect x=".6" y=".6" width="82.8" height="118.8" rx="9.5" fill="#fffdf8" stroke="#d8d0c0" stroke-width="1.2"/><rect x="5" y="5" width="74" height="110" rx="7.5" fill="url(#${id})"/><path d="M5 40Q30 28 79 34V12.5Q79 5 71.5 5H12.5Q5 5 5 12.5Z" fill="#fff" opacity=".1"/>${ring}${window_}${sign(card.face, ink, deep)}${corner}</svg>`;
  }
  const BACK = '<svg viewBox="0 0 84 120" aria-hidden="true"><defs><radialGradient id="ub-glow" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#2b3247"/><stop offset="1" stop-color="#0d0f17"/></radialGradient></defs><rect x=".6" y=".6" width="82.8" height="118.8" rx="9.5" fill="#fffdf8" stroke="#d8d0c0" stroke-width="1.2"/><rect x="5" y="5" width="74" height="110" rx="7.5" fill="url(#ub-glow)"/><rect x="-22" y="-22" width="44" height="44" rx="10" transform="translate(42 60) rotate(45)" fill="#e3262f" stroke="#ffe08a" stroke-width="1.6"/><text x="42" y="65" text-anchor="middle" font-family="Tajawal,Arial,sans-serif" font-weight="900" font-size="13" fill="#fff">بوسراج</text><g fill="#ffe08a"><circle cx="16" cy="16" r="1.6"/><circle cx="68" cy="16" r="1.6"/><circle cx="16" cy="104" r="1.6"/><circle cx="68" cy="104" r="1.6"/></g></svg>';
  function cardNode(card, cls = '') {
    const node = make('button','uno-card '+cls);
    node.type = 'button';
    node.dataset.card = card.id;
    node.dataset.color = card.color;
    node.setAttribute('aria-label', (LABELS[card.face] || card.face)+' · '+NAMES[card.color]);
    node.innerHTML = faceSVG(card);
    return node;
  }
  function backNode(cls = '') { const node = make('span', 'uno-back ' + cls); node.innerHTML = BACK; return node; }
  function action(label, cls, fn) {
    const button = make('button',cls,label);
    button.type = 'button'; button.addEventListener('click',fn);
    return button;
  }

  /* ---------- the table ---------- */
  function mount() {
    const table = make('div','uno-table uno39 uno-pro');
    const heading = make('div','uno-table-heading');
    const tableCount = make('small','uno-table-count');
    heading.append(make('b','','أونو'),make('small','uno-mode'),tableCount);
    const meter = make('div','uno-turn-clock');
    meter.append(make('small','','وقت الدور'),make('b','uno-seconds','30'));
    const clockbar = make('i','uno-clock-bar');
    meter.append(clockbar);
    const seats = make('div','uno-seats');
    seats.setAttribute('role','list'); seats.setAttribute('aria-label','اللاعبون بترتيب المقاعد');
    seats.setAttribute('tabindex','0');
    const center = make('div','uno-center');
    const stock = action('','uno-stock',() => send('draw'));
    stock.setAttribute('aria-label','اسحب ورقة');
    const back = make('span','uno-card-back');
    back.append(backNode('uno-stock-top'));
    const stockCount = make('small','uno-stock-count');
    stock.append(back,stockCount);
    const discard = make('div','uno-discard');
    const middle = make('div','uno-piles'); middle.append(stock,discard);
    // the ring of play turns the way the turn goes
    const ring = make('div','uno-ring');
    ring.innerHTML = '<svg viewBox="0 0 200 200" aria-hidden="true"><defs><marker id="uno-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 10 5 0 10Z" fill="currentColor"/></marker></defs><path d="M100 14A86 86 0 0 1 186 100" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" marker-end="url(#uno-arrow)"/><path d="M100 186A86 86 0 0 1 14 100" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" marker-end="url(#uno-arrow)"/></svg>';
    const direction = make('div','uno-direction');
    const tint = make('span','uno-color');
    const turn = make('b','uno-turn-name');
    direction.append(tint,turn);
    const feed = make('p','uno-feed');
    feed.setAttribute('aria-live','polite');
    middle.prepend(ring);center.append(middle,direction,feed);
    const status = make('div','uno-status');
    status.setAttribute('role','status');
    const fx = make('div','uno-fx'); fx.setAttribute('aria-hidden','true');
    table.append(heading,meter,seats,center,status);
    const picker = make('div','uno-picker');
    picker.hidden = true;
    picker.setAttribute('role','dialog'); picker.setAttribute('aria-modal','true');
    picker.setAttribute('aria-label','اختيار اللون');
    const choice = make('div','uno-picker-card');
    const buttons = make('div','uno-colors');
    for (const color of ['red','gold','green','blue']) {
      const button = action(NAMES[color],'uno-color-choice',() => play(selected,color));
      button.style.setProperty('--color',COLORS[color]); buttons.append(button);
    }
    choice.append(make('b','','اللون لك'),make('small','','اختر لون اللعب الجاي'),buttons,action('إلغاء','uno-picker-close',() => closePicker()));
    picker.addEventListener('keydown',pickerKey);
    picker.append(choice);table.append(picker);
    const dock = make('div','uno-dock');
    const meta = make('div','uno-dock-meta');
    const top = make('div','uno-dock-top');
    const own = make('b','uno-own-name');
    const hint = make('small','uno-hand-hint','اسحب أفقيًا لرؤية بقية أوراقك');
    hint.id = 'unoHandHint'; hint.hidden = true;
    const sort = action('رتّب الأوراق','uno-sort',() => { sorted = !sorted; handKey = ''; render(match,hooks); });
    sort.setAttribute('aria-pressed','false');
    meta.append(own,sort);
    const draw = action('اسحب','uno-draw',() => send('draw'));
    const pass = action('مرّر','uno-pass',() => send('pass'));
    const uno = action('أونو!','uno-call',callUno);
    const catchButton = action('مسكته! نسي أونو','uno-catch',() => send('catch'));
    pass.hidden = true; catchButton.hidden = true;
    top.append(draw,pass,uno,catchButton);
    const hand = make('div','uno-hand');
    hand.setAttribute('aria-label','أوراقك');
    hand.setAttribute('role','group');
    dock.append(meta,top,hand,hint);
    table.append(dock,fx);
    $('chBoard').className = 'ch-board ch-uno';
    $('chBoard').replaceChildren(table);
    $('chControls').replaceChildren(); $('chTactics').replaceChildren();
    dom = {table,seats,stock,stockCount,discard,tint,turn,feed,status,picker,hand,own,draw,pass,uno,catchButton,ring,fx,center,dock,sort,hint,tableCount,
      seconds:meter.querySelector('.uno-seconds'),bar:clockbar,mode:heading.querySelector('small')};
    mounted = true;
    const fitDock = () => { fan(); table.style.setProperty('--uno-dock-height',(dock.getBoundingClientRect?.().height||200)+'px'); };
    if(typeof ResizeObserver!=='undefined'){dockObserver=new ResizeObserver(fitDock);dockObserver.observe(dock);}
    fitDock();
  }
  /* Your hand as a fan: the cards overlap as they must and lean out from the middle. */
  function fan() {
    if (!dom) return;
    const cards = [...dom.hand.children], n = cards.length; if (!n) return;
    // the outer cards lean out (they turn about a point under the hand): room is kept for that on both sides
    const W = dom.hand.clientWidth || 360, cw = Math.min(86, Math.max(58, W / 4.6)), spread = Math.min(22, n * 2.6), lean = Math.sin(spread / 2 * Math.PI / 180) * cw * 1.43 * 1.3;
    const room = n > 1 ? (W - cw - 2 * lean - 6) / (n - 1) : cw;
    const crowded = n > 8 || room < 30;
    dom.hand.classList.toggle('scrollable',crowded);
    dom.hand.setAttribute('tabindex',crowded?'0':'-1');
    dom.hand.setAttribute('aria-label',crowded?'أوراقك · مرّر أفقيًا لرؤية جميع الأوراق':'أوراقك');
    dom.hand.setAttribute('aria-describedby',crowded?'unoHandHint':'');
    dom.hint.hidden=!crowded;
    const step = n > 1 ? Math.max(0, Math.min(cw * .72, room)) : 0, start = (W - cw - step * (n - 1)) / 2;
    dom.hand.style.setProperty('--uno-cw', cw + 'px');
    cards.forEach((card, i) => { const k = n > 1 ? i / (n - 1) - .5 : 0; card.style.setProperty('--x', (start + step * i).toFixed(1) + 'px'); card.style.setProperty('--r', (k * spread).toFixed(1) + 'deg'); card.style.setProperty('--y', (k * k * 26).toFixed(1) + 'px'); card.style.zIndex = String(i + 1); });
  }
  function closePicker(restore = true) {
    const source = pickerReturn;
    const open = dom && !dom.picker.hidden;
    selected = null;
    pickerReturn = null;
    if (dom) {
      dom.picker.hidden = true;
      for (const node of [dom.seats,dom.center,dom.dock]) node.inert = false;
      if (open && restore) (source?.isConnected && !source.disabled ? source : dom.sort).focus();
    }
  }
  function pickerKey(e) {
    if (!dom || dom.picker.hidden) return;
    const buttons = [...dom.picker.querySelectorAll('button')].filter(b=>!b.disabled);
    const i = buttons.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); closePicker(); return; }
    if (e.key === 'Tab') {
      if (e.shiftKey && i <= 0) { e.preventDefault(); buttons.at(-1)?.focus(); }
      else if (!e.shiftKey && (i < 0 || i === buttons.length - 1)) { e.preventDefault(); buttons[0]?.focus(); }
      return;
    }
    const colors = buttons.slice(0,4), current = colors.indexOf(document.activeElement);
    const step = {ArrowLeft:1,ArrowRight:-1,ArrowDown:2,ArrowUp:-2}[e.key];
    if (step !== undefined || e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      colors[e.key === 'Home' ? 0 : e.key === 'End' ? 3 : ((current < 0 ? 0 : current) + step + 4) % 4]?.focus();
    }
  }
  function send(type) {
    if (!match || match.phase !== 'playing' || paused) return;
    hooks.act({type});
  }
  function play(card, color) {
    if (!card || !match.uno.legal.includes(card.id) || paused || match.phase !== 'playing') return;
    if (card.color === 'wild' && !color) {
      selected = card; dom.picker.hidden = false;
      pickerReturn = [...dom.hand.children].find(node=>node.dataset.card===card.id) || document.activeElement;
      for (const node of [dom.seats,dom.center,dom.dock]) node.inert = true;
      dom.picker.querySelector('button')?.focus(); return;
    }
    const called = armed;
    const fromPicker = !dom.picker.hidden;
    lastFrom = dom.hand.querySelector(`[data-card="${globalThis.CSS?.escape ? CSS.escape(card.id) : card.id}"]`)?.getBoundingClientRect?.() || null;
    closePicker(false);
    if (hooks.act({type:'play',card:card.id,color,uno:called}) !== false) armed = false;
    if (fromPicker) dom?.sort.focus();
  }
  function callUno() {
    const u = match.uno, player = me();
    if (u.missed === player.slot) { send('uno'); return; }
    if (u.hand.length !== 2 || u.turn !== player.slot) return;
    armed = !armed; tick(match,{...hooks,paused});
  }

  /* ---------- the table's effects ---------- */
  function spot(el) { const r = el?.getBoundingClientRect?.(), t = dom.table.getBoundingClientRect?.(); if (!r || !t || !r.width) return null; return { x: r.left + r.width / 2 - t.left, y: r.top + r.height / 2 - t.top, w: r.width, h: r.height }; }
  function seatSpot(slot) { const p = match.players.find(q => q.slot === slot); if (!p) return null; if (p.id === hooks.me) return spot(dom.hand) || spot(dom.table); return spot(rivals.get(p.id)) || spot(dom.center); }
  function put(node, at, ms) { node.style.left = at.x + 'px'; node.style.top = at.y + 'px'; dom.fx.append(node); setTimeout(() => node.remove(), ms); return node; }
  function stamp(at, word, cls = '', ms = 1300) { if (!at) return; put(make('b', 'uno-stamp ' + cls, word), at, ms); }
  function burst(at, color) { if (!at || still()) return; const ring = put(make('i', 'uno-burst'), at, 900); ring.style.setProperty('--c', color); }
  /* A card (or a back) flying from one place on the table to another. */
  function fly(node, from, to, { ms = 420, spin = 14, delay = 0 } = {}) {
    if (!from || !to || still() || !node.animate) return Promise.resolve();
    node.classList.add('uno-flyer'); put(node, from, ms + delay + 120);
    const dx = to.x - from.x, dy = to.y - from.y;
    const anim = node.animate([{ transform: 'translate(-50%,-50%) rotate(0deg) scale(.9)', opacity: .95 }, { transform: `translate(calc(-50% + ${dx * .55}px), calc(-50% + ${dy * .55 - 40}px)) rotate(${spin * .6}deg) scale(1.08)`, opacity: 1, offset: .55 }, { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${spin}deg) scale(1)`, opacity: 1 }], { duration: ms, delay, easing: 'cubic-bezier(.25,.75,.35,1)', fill: 'forwards' });
    return anim.finished.catch(() => {});
  }
  function shake() { if (!still()) dom.table.animate?.([{ transform: 'translate(0,0)' }, { transform: 'translate(-5px,2px)' }, { transform: 'translate(4px,-2px)' }, { transform: 'translate(-2px,1px)' }, { transform: 'translate(0,0)' }], { duration: 360 }); }
  /* What the last move did, on the table: who played what at whom. */
  function animate(u, before, myTurnPlay) {
    const e = u.event; if (!e) return;
    const n = match.players.length, dir = before?.direction ?? u.direction, after = (slot, k = 1) => ((slot + dir * k) % n + n) % n;
    const pileAt = spot(dom.discard), stockAt = spot(dom.stock);
    if (e.kind === 'play' && e.card) {
      const from = e.player === me()?.slot && lastFrom ? { x: lastFrom.left + lastFrom.width / 2 - dom.table.getBoundingClientRect().left, y: lastFrom.top + lastFrom.height / 2 - dom.table.getBoundingClientRect().top } : seatSpot(e.player);
      lastFrom = null;
      const top = dom.discard.lastElementChild; top?.classList.add('arriving');
      fly(cardNode(e.card, 'uno-flying'), from, pileAt, { spin: 8 - Math.random() * 16 }).then(() => { top?.classList.remove('arriving'); top?.classList.add('landed'); burst(pileAt, COLORS[u.color] || '#fff'); });
      const face = e.card.face;
      setTimeout(() => {
        if (face === 'skip') { stamp(seatSpot(after(e.player)), '⊘ ممنوع', 'skip'); sound('error'); }
        else if (face === 'reverse') { dom.ring.classList.remove('flip'); void dom.ring.offsetWidth; dom.ring.classList.add('flip'); stamp(spot(dom.center), '⇄ انعكس الدور', 'reverse'); }
        else if (face === 'draw2' || face === 'draw4') {
          const count = face === 'draw2' ? 2 : 4;
          if (u.pending) stamp(pileAt, '+' + u.pending + ' تتراكم', 'stack');
          else { const target = after(e.player), at = seatSpot(target); stamp(at, '+' + count, 'plus', 1500); for (let i = 0; i < Math.min(4, count); i++) fly(backNode('uno-flying'), stockAt, at, { ms: 360, delay: 120 * i, spin: 20 }); shake(); }
        }
        if (e.card.color === 'wild') { burst(pileAt, COLORS[u.color]); stamp(pileAt, NAMES[u.color], 'color ' + u.color, 1200); }
        if (/أونو/.test(e.text || '')) { stamp(seatSpot(e.player), 'أونو!', 'uno', 1500); shake(); }
      }, 380);
    } else if (e.kind === 'draw') {
      const got = before ? Math.max(1, (u.counts[e.player] || 0) - (before.counts[e.player] || 0)) : 1, at = seatSpot(e.player);
      for (let i = 0; i < Math.min(4, got); i++) fly(backNode('uno-flying'), stockAt, at, { ms: 360, delay: 110 * i, spin: -12 });
      if (got > 1) stamp(at, '+' + got, 'plus');
    } else if (e.kind === 'uno') { stamp(seatSpot(e.player), 'أونو!', 'uno', 1500); shake(); }
    else if (e.kind === 'catch') { const caught = before ? u.counts.findIndex((c, i) => c - (before.counts[i] || 0) >= 2) : -1; stamp(seatSpot(caught >= 0 ? caught : e.player), 'مسكته!', 'catch', 1500); shake(); }
    else if (e.kind === 'timeout') stamp(seatSpot(e.player), '⏱ راح وقته', 'skip');
    else if (e.kind === 'finish' && e.player !== null && e.player !== undefined) { const at = seatSpot(e.player); burst(at, '#ffd36b'); stamp(at, '🏆', 'win', 2000); }
  }

  function render(m,next) {
    if (!m.uno) return;
    match=m; hooks=next;
    if (!mounted) mount();
    const u=m.uno, player=me();
    if (!player) return;
    if (selected && (!u.legal.includes(selected.id) || m.phase !== 'playing')) { closePicker(false); dom.sort.focus(); }
    if (u.hand.length !== 2) armed=false;
    text(dom.mode,MODES[u.mode]||'كلاسيكي');
    text(dom.own,player.name+' · '+u.hand.length+' أوراق');
    text(dom.tableCount,m.players.length+' لاعبين');
    dom.table.dataset.players=String(m.players.length);
    dom.sort.setAttribute('aria-pressed',String(sorted));
    text(dom.sort,sorted?'ترتيب التوزيع':'رتّب الأوراق');
    const order=m.players.filter(p=>p.id!==player.id).sort((a,b)=>(a.slot-player.slot+m.players.length)%m.players.length-(b.slot-player.slot+m.players.length)%m.players.length);
    const ids=new Set(order.map(p=>p.id));
    for(const [id,seat] of rivals)if(!ids.has(id)){seat.remove();rivals.delete(id);}
    for(const [i,p] of order.entries()) {
      let seat=rivals.get(p.id);
      if(!seat) {
        seat=make('div','uno-rival');seat.dataset.player=p.id;seat.setAttribute('role','listitem');
        const number=make('small','uno-seat-number',String(p.slot+1).padStart(2,'0'));
        const face=make('span','uno-rival-face',([...String(p.name||'؟')][0]||'؟'));
        const backs=make('div','uno-mini-hand');
        for(let k=0;k<3;k++)backs.append(make('i'));
        backs.setAttribute('aria-hidden','true');
        seat.append(number,face,backs,make('b','uno-rival-name',p.name),make('small','uno-rival-count'));
        rivals.set(p.id,seat);dom.seats.append(seat);
      }
      dom.seats.append(seat);
      seat.setAttribute('aria-current',u.turn===p.slot?'true':'false');
      seat.setAttribute('aria-label',p.name+' · المقعد '+(p.slot+1)+' · '+u.counts[p.slot]+' أوراق'+(u.turn===p.slot?' · دوره الآن':''));
      seat.classList.toggle('active',u.turn===p.slot);
      seat.classList.toggle('last-card',u.counts[p.slot]===1);
      text(seat.querySelector('.uno-rival-count'),u.counts[p.slot]===1?'أونو · ورقة وحدة':u.counts[p.slot]+' أوراق');
    }
    const turnKey=player.id+':'+u.turn;
    if(shownTurn!==turnKey){shownTurn=turnKey;const active=order.find(p=>p.slot===u.turn);if(active)rivals.get(active.id)?.scrollIntoView?.({block:'nearest',inline:'nearest',behavior:still()?'instant':'smooth'});}
    const key=u.hand.map(c=>c.id).join(',')+'|'+u.legal.join(',')+'|'+sorted;
    if(handKey!==key) {
      const had=new Set([...dom.hand.children].map(c=>c.dataset.card));
      const focus=document.activeElement?.dataset?.card;
      const scroll=dom.hand.scrollLeft;
      handKey=key;
      const hand=[...u.hand];
      if(sorted)hand.sort((a,b)=>COLOR_ORDER.indexOf(a.color)-COLOR_ORDER.indexOf(b.color)||FACE_ORDER.indexOf(a.face)-FACE_ORDER.indexOf(b.face));
      dom.hand.replaceChildren(...hand.map(card=>{
        const node=cardNode(card,'uno-hand-card');
        node.addEventListener('click',()=>play(card));
        node.classList.toggle('playable',u.legal.includes(card.id));
        if(had.size&&!had.has(card.id))node.classList.add('dealt');
        return node;
      }));
      fan();
      if(scroll!==undefined)dom.hand.scrollLeft=scroll;
      if(focus){const same=[...dom.hand.children].find(node=>node.dataset.card===focus);if(same&&u.legal.includes(focus))same.focus();else dom.sort.focus();}
    }
    if(topKey!==u.top.id) {
      topKey=u.top.id;
      // the pile keeps the last cards, each a little turned
      pile=[...pile.filter(c=>c.id!==u.top.id),{...u.top,turn:(Math.random()*24-12).toFixed(1)}].slice(-3);
      dom.discard.replaceChildren(...pile.map((c,i)=>{const node=cardNode(c,'uno-top-card'+(i<pile.length-1?' under':''));node.disabled=true;node.style.setProperty('--turn',c.turn+'deg');return node;}));
    }
    text(dom.stockCount,u.stock+' ورقة');
    text(dom.tint,NAMES[u.color]);
    dom.tint.style.setProperty('--color',COLORS[u.color]);
    dom.table.style.setProperty('--uno-tint',COLORS[u.color]||'#1f6fdb');
    dom.ring.classList.toggle('back',u.direction!==1);
    text(dom.turn,u.direction===1?'الدور مع عقارب الساعة':'الدور عكس عقارب الساعة');
    text(dom.feed,u.event?.text||'');
    if(u.event?.id!==seen) {
      if(seen>=0){sound(u.event.kind==='play'?'card':u.event.kind==='draw'?'deal':u.event.kind==='finish'?'win':'select');try{animate(u,prev);}catch{}}
      seen=u.event?.id;
    }
    prev={counts:[...u.counts],direction:u.direction,turn:u.turn};
    tick(m,{...next,paused});
  }
  function tick(m,next) {
    if(!mounted||!m.uno)return;
    paused=!!next.paused;
    const u=m.uno, player=m.players.find(p=>p.id===next.me);
    if(!player)return;
    const active=m.phase==='playing'&&!paused, myTurn=u.turn===player.slot;
    if(selected&&!active){closePicker(false);dom.sort.focus();}
    const left=Math.max(0,Math.ceil((u.deadline-next.now())/1000));
    text(dom.seconds,String(left));
    dom.bar.style.setProperty('--left',Math.min(100,left/30*100)+'%');
    dom.table.classList.toggle('my-turn',active&&myTurn);
    text(dom.status,m.phase==='finished'?'انتهت الجولة':paused?'اللعب متوقف':myTurn?(u.pending?'عليك سحب '+u.pending+' أو تراكم بنفس الرمز':u.drawn?'العب الورقة المسحوبة أو مرّر':'دورك · اختر ورقة مضيئة'):'دور '+m.players[u.turn].name);
    dom.stock.disabled=dom.draw.disabled=!active||!myTurn||!!u.drawn;
    text(dom.draw,u.pending?'اسحب '+u.pending:'اسحب ورقة');
    dom.pass.hidden=!u.drawn;dom.pass.disabled=!active||!myTurn;
    dom.uno.disabled=!active||!(u.missed===player.slot||myTurn&&u.hand.length===2);
    dom.uno.classList.toggle('armed',armed);
    dom.uno.classList.toggle('due',!dom.uno.disabled&&!armed);
    dom.uno.setAttribute('aria-pressed',String(armed));
    text(dom.uno,armed?'أونو جاهز!':'أونو!');
    dom.catchButton.hidden=u.missed===null||u.missed===player.slot;
    dom.catchButton.disabled=!active;
    for(const node of dom.hand.children)node.disabled=!active||!myTurn||!u.legal.includes(node.dataset.card);
  }
  function podium(m,id) {
    const area=$('unoRecap');
    const key=m.seed+':'+m.startedAt;
    if(!area||resultKey===key)return;
    resultKey=key;
    const winner=m.players.find(p=>m.winners.includes(p.id));
    const portrait=make('div','uno-winner');
    if(winner&&window.BS_CHARACTERS) {
      winnerActor=window.BS_CHARACTERS.actor(winner.hero,{piece:true,staticIdle:true});
      portrait.append(winnerActor);
      window.BS_CHARACTERS.setState(winnerActor,'win',{returnIdle:false});
    }
    const rows=make('div','uno-final-rows');
    for(const p of [...m.players].sort((a,b)=>b.score-a.score)) {
      const row=make('div','uno-final-row');
      row.classList.toggle('self',p.id===id);
      row.append(make('b','',p.name),make('span','',m.winners.includes(p.id)?'الفائز':m.uno.counts[p.slot]+' أوراق متبقية'));
      rows.append(row);
    }
    area.replaceChildren(portrait,rows);
  }
  function clear() {
    closePicker(false);
    dockObserver?.disconnect();dockObserver=null;
    if(winnerActor)window.BS_CHARACTERS?.dispose?.(winnerActor);
    winnerActor=null;mounted=false;match=null;hooks=null;dom=null;paused=false;armed=false;
    selected=null;handKey='';topKey='';seen=-1;resultKey='';rivals.clear();prev=null;lastFrom=null;pile=[];sorted=false;pickerReturn=null;shownTurn='';
    $('unoRecap')?.replaceChildren();
  }
  window.BS_UNO={render,tick,podium,clear};
})();
