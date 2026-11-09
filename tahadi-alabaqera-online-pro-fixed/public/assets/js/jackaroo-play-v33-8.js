/* Tahdia 33.8.0 — Jackaroo played on the board itself.
   Pick a card, then tap the marble on the board: a marble with one move goes at once. When the
   card offers that marble more than one move (the ace: one or eleven, the seven: split it, the
   jack: which marble to swap with), its choices appear on the board: a small menu by the marble
   and a glowing mark on every hole it can reach — tap either. The seven is played in two taps:
   where the first marble stops, then which marble walks the rest.
   It also draws the table's effects: the card flying to the middle, a kill, a swap, a marble
   coming home, a burnt card. Sounds come from the shared audio manager. */
import { boardGeometry } from './engines/board-geometry-v29.js?v=33.8.0';
import { globalJackarooPosition } from './engines/jackaroo-engine.js?v=33.8.0-rules2';

const jkReduce = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
function jkEl(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
function jkCenterIn(board, target) {
  if (!target) return null;
  const b = board.getBoundingClientRect(), r = target.getBoundingClientRect();
  if (!b.width || !r.width) return null;
  return { x: (r.left + r.width / 2 - b.left) / b.width * 100, y: (r.top + r.height / 2 - b.top) / b.height * 100 };
}
/** The hole (or marble) an action leaves the given marble on. */
export function landingOf(board, state, owner, marble, steps, backward = false) {
  const g = boardGeometry(state), pos = state.players[owner].marbles[marble];
  if (pos < 0) return board.querySelector(`[data-track="${globalJackarooPosition(owner, 0, state)}"]`);
  const end = backward ? (pos - steps >= 0 ? pos - steps : g.track + (pos - steps)) : pos + steps;
  if (end < g.track) return board.querySelector(`[data-track="${globalJackarooPosition(owner, end, state)}"]`);
  const lane = Math.min(3, end - g.track);
  return board.querySelector(`[data-safe="${owner}:${lane}"]`) || board.querySelector(`[data-home="${owner}:${lane}"]`);
}
const jkStoneEl = (board, o, m) => board.querySelector(`[data-stone="${o}:${m}"]`);
/** The choices one tapped marble has with the chosen card. */
export function choicesFor(state, actions, pi, mi, nameOf = (i) => state.players[i]?.name || '') {
  const out = [];
  for (const a of actions) {
    if (a.type === 'enter' && a.owner === pi && a.marble === mi) out.push({ key: 'enter', label: 'اطلع', sub: 'لخانة البداية', act: a, land: { owner: pi, marble: mi, steps: 0 } });
    else if ((a.type === 'move' || a.type === 'moveAny5') && a.owner === pi && a.marble === mi) out.push({ key: (a.backward ? '-' : '+') + a.steps, label: (a.backward ? '−' : '+') + a.steps, sub: a.backward ? 'لورا' : a.steps === 7 ? 'السبعة كاملة' : 'لقدّام', act: a, land: { owner: pi, marble: mi, steps: a.steps, backward: Boolean(a.backward) } });
    else if (a.type === 'swap' && a.owner === pi && a.marble === mi) out.push({ key: 'swap:' + a.otherOwner + ':' + a.otherMarble, label: '⇄', sub: 'بدّل مع ' + nameOf(a.otherOwner) + ' · ' + (a.otherMarble + 1), act: a, stone: [a.otherOwner, a.otherMarble] });
  }
  // the seven: a split leaves this marble k holes on, then another marble walks the rest
  const splits = actions.filter((a) => a.type === 'split7' && a.owner === pi && (a.first.marble === mi || a.second.marble === mi));
  const byStep = new Map();
  for (const a of splits) {
    const mine = a.first.marble === mi ? a.first : a.second, other = a.first.marble === mi ? a.second : a.first;
    if (!byStep.has(mine.steps)) byStep.set(mine.steps, []);
    const list = byStep.get(mine.steps);
    // the order the player picked (this marble first) wins over the reverse
    const existing = list.find((x) => x.marble === other.marble);
    if (!existing) list.push({ marble: other.marble, steps: other.steps, act: a, first: a.first.marble === mi });
    else if (!existing.first && a.first.marble === mi) Object.assign(existing, { act: a, first: true });
  }
  for (const [k, rest] of [...byStep].sort((a, b) => a[0] - b[0])) {
    out.push({ key: 'split:' + k, label: '+' + k, sub: 'والباقي ' + (7 - k) + ' لحجر ثاني', land: { owner: pi, marble: mi, steps: k }, then: rest.map((r) => ({ key: 'rest:' + r.marble, label: '+' + r.steps, sub: 'حجر ' + (r.marble + 1), act: r.act, stone: [pi, r.marble], land: { owner: pi, marble: r.marble, steps: r.steps } })) });
  }
  return out;
}
/** The menu and the marks on the board. */
export function createChooser({ board, onCommit, onCancel = () => {}, sound = () => {} }) {
  let layer = null, live = null;
  function host() {
    if (!layer) { layer = jkEl('div', 'jk-choose'); layer.addEventListener('click', (e) => { if (e.target === layer) cancel(); }); }
    if (layer.parentElement !== board) board.append(layer);
    return layer;
  }
  function clear() { live = null; if (layer) { layer.replaceChildren(); layer.classList.remove('on'); } }
  function cancel() { if (!live) return; clear(); onCancel(); }
  function mark(at, text, title, fn, tone = '') {
    const b = jkEl('button', 'jk-mark' + (tone ? ' ' + tone : ''), text); b.type = 'button';
    b.style.left = at.x + '%'; b.style.top = at.y + '%'; b.setAttribute('aria-label', title);
    b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
    return b;
  }
  function choose(option, state) {
    if (option.act) { sound('select'); clear(); onCommit(option.act); return; }
    if (option.then?.length === 1) { sound('select'); clear(); onCommit(option.then[0].act); return; }
    sound('select');
    open(state, option.then, option.from, 'السبعة: أي حجر يمشي ' + (option.then[0] ? option.then[0].label.slice(1) : '') + '؟', option);
  }
  /** Keeps the menu on the screen: inside the board and inside the window. */
  function keepInView(menu) {
    const wrap = (board.closest?.('.jack-board-wrap') || board).getBoundingClientRect(), r = menu.getBoundingClientRect();
    if (!r.width) return;
    const vw = window.innerWidth || wrap.right, vh = window.innerHeight || wrap.bottom;
    const left = Math.max(wrap.left, 0) + 6, right = Math.min(wrap.right, vw) - 6, top = Math.max(wrap.top, 0) + 6, bottom = Math.min(wrap.bottom, vh) - 6;
    let dx = 0, dy = 0;
    if (r.left < left) dx = left - r.left; else if (r.right > right) dx = right - r.right;
    if (r.top < top) dy = top - r.top; else if (r.bottom > bottom) dy = bottom - r.bottom;
    if (dx || dy) menu.style.translate = Math.round(dx) + 'px ' + Math.round(dy) + 'px';
  }
  /** Shows the choices of a marble: a menu by it and a mark where each one lands. A few choices are
      tapped on the board too; many (the seven) only light up where they land, and the menu chooses. */
  function open(state, options, from, title, parent = null) {
    const box = host(); box.replaceChildren(); box.classList.add('on');
    live = { options, from };
    const origin = jkCenterIn(board, jkStoneEl(board, from[0], from[1]));
    if (!origin) { onCancel(); return; }
    const ring = jkEl('i', 'jk-from'); ring.style.left = origin.x + '%'; ring.style.top = origin.y + '%'; box.append(ring);
    // the swaps sit on different marbles: always tapped there; many holes in a row (the seven) only light up
    const many = options.filter((o) => o.label !== '⇄').length > 3;
    for (const o of options) {
      const target = o.stone && !o.land ? jkStoneEl(board, o.stone[0], o.stone[1]) : o.land ? landingOf(board, state, o.land.owner, o.land.marble, o.land.steps, o.land.backward) : null;
      const at = jkCenterIn(board, target);
      const tone = o.label === '⇄' ? 'swap' : o.then ? 'split' : '';
      if (at && many && o.label !== '⇄') { const dot = jkEl('i', 'jk-mark dot' + (tone ? ' ' + tone : ''), o.label.replace('+', '')); dot.style.left = at.x + '%'; dot.style.top = at.y + '%'; dot.setAttribute('aria-hidden', 'true'); box.append(dot); }
      else if (at) box.append(mark(at, o.label === '⇄' ? '⇄' : o.label, o.sub, () => choose({ ...o, from: o.stone || from }, state), tone));
      // the second marble of a split: tap the marble itself too
      if (parent && o.stone) { const s = jkCenterIn(board, jkStoneEl(board, o.stone[0], o.stone[1])); if (s) box.append(mark(s, '●', o.sub, () => choose(o, state), 'stone')); }
    }
    // the menu, by the marble, kept on the screen
    const menu = jkEl('div', 'jk-menu' + (many ? ' grid' : '')); menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', title || 'اختر الحركة');
    if (title) menu.append(jkEl('b', 'jk-menu-title', title));
    const list = jkEl('div', 'jk-menu-list');
    for (const o of options.slice(0, 8)) {
      const b = jkEl('button', 'jk-menu-item'); b.type = 'button'; b.setAttribute('role', 'menuitem'); b.setAttribute('aria-label', o.label + ' ' + o.sub);
      b.append(jkEl('strong', '', o.label), jkEl('small', '', many && o.then ? 'والباقي ' + (7 - Number(o.label.replace('+', ''))) : many && o.key === '+7' ? 'كاملة' : o.sub));
      b.addEventListener('click', (e) => { e.stopPropagation(); choose({ ...o, from: o.stone || from }, state); });
      list.append(b);
    }
    menu.append(list);
    if (options.length > 8) menu.append(jkEl('small', 'jk-menu-more', 'وباقي الخيارات على اللوحة'));
    const x = jkEl('button', 'jk-menu-close', '✕'); x.type = 'button'; x.setAttribute('aria-label', 'إلغاء'); x.addEventListener('click', (e) => { e.stopPropagation(); cancel(); });
    menu.append(x);
    menu.style.left = Math.min(80, Math.max(20, origin.x)) + '%';
    menu.style.top = origin.y + '%';
    menu.classList.toggle('below', origin.y < 45);
    box.append(menu);
    keepInView(menu);
    setTimeout(() => menu.querySelector('.jk-menu-item')?.focus({ preventScroll: true }), 30);
  }
  /** The tapped marble: one move goes at once, more open the menu. Returns false when it has none. */
  function pick(state, actions, pi, mi, nameOf) {
    const options = choicesFor(state, actions, pi, mi, nameOf);
    if (!options.length) return false;
    if (options.length === 1 && options[0].act) { clear(); onCommit(options[0].act); return true; }
    if (options.length === 1 && options[0].then?.length === 1) { clear(); onCommit(options[0].then[0].act); return true; }
    const swaps = options.every((o) => o.label === '⇄');
    open(state, options, [pi, mi], swaps ? 'اختر الحجر اللي تبدّل معه' : options.some((o) => o.then) ? 'السبعة: كم يمشي هالحجر؟' : 'اختر الحركة');
    return true;
  }
  return { pick, clear, cancel, get open() { return Boolean(live); }, reattach() { if (layer && live) host(); } };
}

/* ---------- the table's effects ---------- */
export function createJackFx(board) {
  let layer = null;
  const host = () => { if (!layer) layer = jkEl('div', 'jk-fx'); if (layer.parentElement !== board) board.append(layer); return layer; };
  const spot = (target) => jkCenterIn(board, typeof target === 'string' ? board.querySelector(target) : target);
  function put(node, at) { node.style.left = at.x + '%'; node.style.top = at.y + '%'; host().append(node); return node; }
  function gone(node, ms) { setTimeout(() => node.remove(), ms); }
  function burst(target, color = '#ffd36b', count = 12) {
    const at = typeof target?.x === 'number' ? target : spot(target); if (!at) return;
    const ring = put(jkEl('i', 'jk-ring'), at); ring.style.setProperty('--c', color); gone(ring, 700);
    if (jkReduce()) return;
    for (let i = 0; i < count; i++) {
      const d = put(jkEl('i', 'jk-spark'), at), angle = (i / count) * Math.PI * 2, far = 26 + Math.random() * 22;
      d.style.setProperty('--c', color);
      d.animate?.([{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(angle) * far}px), calc(-50% + ${Math.sin(angle) * far}px)) scale(.3)`, opacity: 0 }], { duration: 560 + Math.random() * 200, easing: 'cubic-bezier(.2,.7,.3,1)' });
      gone(d, 800);
    }
  }
  function say(target, text, tone = '') {
    const at = typeof target?.x === 'number' ? target : spot(target); if (!at) return;
    // a word by a player at the edge stays on the screen
    const t = put(jkEl('b', 'jk-say ' + tone, text), { x: Math.min(78, Math.max(22, at.x)), y: Math.max(12, at.y) }); gone(t, 1300);
    const r = t.getBoundingClientRect(), vw = window.innerWidth || r.right, pad = 8;
    if (r.width && r.left < pad) t.style.marginLeft = Math.round(pad - r.left) + 'px';
    else if (r.width && r.right > vw - pad) t.style.marginLeft = Math.round(vw - pad - r.right) + 'px';
  }
  function toss(card, fromSeat) {
    const from = spot(`[data-player-tag="${fromSeat}"]`) || { x: 50, y: 92 }, to = spot('[data-pile-cards]') || { x: 50, y: 50 };
    const url = window.BS_JACK_CARDS?.url?.(card); if (!url || jkReduce()) return Promise.resolve();
    const img = put(jkEl('img', 'jk-toss'), from); img.src = url; img.alt = '';
    const dx = to.x - from.x, dy = to.y - from.y, b = board.getBoundingClientRect();
    const anim = img.animate?.([{ transform: 'translate(-50%,-50%) rotate(-12deg) scale(.7)', opacity: .2 }, { transform: `translate(calc(-50% + ${dx / 100 * b.width}px), calc(-50% + ${dy / 100 * b.height}px)) rotate(8deg) scale(1)`, opacity: 1 }], { duration: 380, easing: 'cubic-bezier(.2,.8,.25,1)', fill: 'forwards' });
    gone(img, 520);
    return anim?.finished?.catch(() => {}) || Promise.resolve();
  }
  function flame(target) { burst(target, '#ff7a3d', 16); say(target, '🔥', 'fire'); }
  return { burst, say, toss, flame, spot };
}
