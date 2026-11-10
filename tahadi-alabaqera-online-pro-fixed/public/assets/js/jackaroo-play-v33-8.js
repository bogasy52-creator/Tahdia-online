/* Tahdia 33.8.0 — Jackaroo played on the board itself.
   33.9.0: played the way a real board is played, with no hints. Pick a card, then tap your
   marble: a marble with one move goes at once. When the card gives it more than one (the ace:
   one or eleven; the seven: all of it or a part of it), tap the hole where it should stop — the
   seven's rest is walked by the next marble you tap. The jack: tap your marble, then the one to
   swap with (or that one first). Nothing on the board shows what can move or where a move lands;
   a tap that cannot be played says why, by the place you tapped.
   It also draws the table's effects: the card flying to the middle, a kill, a swap, a marble
   coming home, a burnt card. Sounds come from the shared audio manager. */
import { boardGeometry } from './engines/board-geometry-v29.js?v=33.9.5';
import { globalJackarooPosition } from './engines/jackaroo-engine.js?v=33.9.5-rules3';

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
/** Where a tap on the board landed: the nearest marble and the nearest hole (yard, walk, lane). */
function jkNearest(board, selector, x, y, reach) {
  let best = null, gap = Infinity;
  for (const el of board.querySelectorAll(selector)) {
    const shape = el.matches('circle') ? el : el.querySelector('circle') || el;
    const r = shape.getBoundingClientRect();
    if (!r.width) continue;
    const d = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y);
    if (d < Math.max(reach, r.width * 0.75) && d < gap) { gap = d; best = el; }
  }
  return best;
}
function jkHole(el) {
  if (!el) return null;
  const d = el.dataset || {};
  if (d.track != null) return { kind: 'track', at: Number(d.track) };
  if (d.home != null) { const [o, h] = d.home.split(':').map(Number); return { kind: 'lane', owner: o, at: h }; }
  if (d.finishCup != null) return { kind: 'lane', owner: Number(d.finishCup), at: 4 };
  if (d.yard != null) return { kind: 'yard', owner: Number(d.yard.split(':')[0]) };
  return null;
}
/** The hole an option leaves its marble on, as a place on the board. */
export function landingSpot(state, owner, marble, steps = 0, backward = false, enter = false) {
  const g = boardGeometry(state), pos = state.players[owner].marbles[marble];
  if (enter || pos < 0) return { kind: 'track', at: globalJackarooPosition(owner, 0, state) };
  const end = backward ? (pos - steps >= 0 ? pos - steps : g.track + (pos - steps)) : pos + steps;
  if (end < g.track) return { kind: 'track', at: globalJackarooPosition(owner, end, state) };
  return { kind: 'lane', owner, at: Math.min(4, end - g.track) };
}
const jkSame = (a, b) => Boolean(a && b && a.kind === b.kind && a.at === b.at && (a.kind !== 'lane' || a.owner === b.owner));
const JK_STEPS = { A: [1, 11], K: [13], Q: [12], '10': [10], '4': [4], '5': [5], '7': [7] };
/** 33.9.0: a house with its owner's marble on it (board-petals draws «مقفل» by it). */
export const JK_LOCK = 'مقفل — صاحب البيت، لا يمكن المرور';
/** The board as the hand that plays it: taps on marbles and holes, no hints. */
export function createBoardPicker({ board, fx = null, context = () => null, onCommit, tell = () => {}, sound = () => {}, shut = () => false }) {
  let pick = null, layer = null;
  const host = () => { if (!layer) layer = jkEl('div', 'jk-pick'); if (layer.parentElement !== board) board.append(layer); return layer; };
  const keyOf = (el) => el ? el.getAttribute('data-stone').split(':').map(Number) : null;
  const same = (a, b) => Boolean(a && b && a[0] === b[0] && a[1] === b[1]);
  function paint() {
    const box = host(); box.replaceChildren();
    if (!pick) return;
    const at = jkCenterIn(board, jkStoneEl(board, pick.from[0], pick.from[1]));
    if (at) { const ring = jkEl('i', 'jk-picked'); ring.style.left = at.x + '%'; ring.style.top = at.y + '%'; box.append(ring); }
    if (pick.stop) {
      const spot = jkCenterIn(board, pick.stop.kind === 'track' ? board.querySelector(`[data-track="${pick.stop.at}"]`) : board.querySelector(`[data-home="${pick.stop.owner}:${pick.stop.at}"]`));
      if (spot) { const stop = jkEl('i', 'jk-stop', String(pick.steps)); stop.style.left = spot.x + '%'; stop.style.top = spot.y + '%'; box.append(stop); }
    }
  }
  function clear() { pick = null; if (layer) layer.replaceChildren(); }
  function nope(text, at, stone) {
    sound('error');
    if (text && fx && at) fx.say(at, text, 'warn');
    const el = stone && jkStoneEl(board, stone[0], stone[1]);
    if (el) { el.classList.remove('jk-nope'); void el.getBBox?.(); el.classList.add('jk-nope'); setTimeout(() => el.classList.remove('jk-nope'), 420); }
  }
  function commit(act) { sound('select'); clear(); onCommit(act); }
  function base(ctx) { tell(ctx?.hint || 'اختر الحجر'); }
  /** Why the tapped marble has nothing with this card. */
  function explain(ctx, stone, at) {
    const { state, me } = ctx, rank = String(ctx.card || '').replace(/[SHDC]$/, '');
    const [o, m] = stone, pos = state.players[o]?.marbles?.[m];
    const g = boardGeometry(state), home = (v) => (g.fill ? v >= g.track : v === g.finish);
    const own = o === me || (o % 2 === me % 2 && state.players[me].marbles.every(home));
    if (own && pos < 0) return nope(rank === 'A' || rank === 'K' ? 'خانة البداية مسكّرة' : 'يطلع من الحوش بالآس أو الشايب', at, stone);
    if (own && (JK_STEPS[rank] || [Number(rank)]).every((n) => n > 0 && shut(state, o, m, n, rank === '4'))) return nope(JK_LOCK, at, stone);
    if (own) return nope('هالحجر ما يمشي بهالورقة', at, stone);
    if (pos === 0 && (rank === 'J' || rank === '5')) return nope(JK_LOCK, at, stone);
    if (rank === 'J') return nope('ما تقدر تبدّل مع هالحجر', at, stone);
    if (rank === '5') return nope('هالحجر ما يمشي 5', at, stone);
    return nope('هذا مو حجرك', at, stone);
  }
  function begin(ctx, from, options, at) {
    if (options.length === 1 && options[0].act) return commit(options[0].act);
    if (options.length === 1 && options[0].then?.length === 1) return commit(options[0].then[0].act);
    sound('select');
    if (options.every((o) => o.key.startsWith('swap:'))) { pick = { kind: 'swap', from, options }; paint(); return tell('الولد: اضغط الحجر اللي تبدّل معه'); }
    // a marble with a single stop for the seven's first part goes straight to its rest
    if (options.length === 1 && options[0].then) return stopAt(ctx, from, options[0]);
    pick = { kind: 'move', from, options }; paint();
    tell(options.some((o) => o.then) ? 'السبعة: اضغط الخانة اللي يوقف فيها هالحجر' : 'اضغط الخانة اللي يوقف فيها');
  }
  function stopAt(ctx, from, option) {
    pick = { kind: 'rest', from, options: pick?.options || [option], rest: option.then, steps: option.land.steps, stop: landingSpot(ctx.state, from[0], from[1], option.land.steps) };
    paint();
    tell('السبعة: باقي ' + (7 - option.land.steps) + ' — اضغط الحجر اللي يمشيها');
  }
  function fresh(ctx, stone, hole, at) {
    if (stone) {
      const options = choicesFor(ctx.state, ctx.actions, stone[0], stone[1]);
      if (options.length) return begin(ctx, stone, options, at);
      const swaps = ctx.actions.filter((a) => a.type === 'swap' && a.otherOwner === stone[0] && a.otherMarble === stone[1]);
      if (swaps.length === 1) return commit(swaps[0]);
      if (swaps.length > 1) { sound('select'); pick = { kind: 'swapFrom', from: stone, swaps }; paint(); return tell('الولد: اضغط حجرك اللي يتبدّل معه'); }
    }
    // a tap on your yard, or on your start, brings a marble out
    const enter = hole && ctx.actions.find((a) => a.type === 'enter' && ((hole.kind === 'yard' && hole.owner === a.owner) || jkSame(hole, landingSpot(ctx.state, a.owner, a.marble, 0, false, true))));
    if (enter) return commit(enter);
    if (stone) return explain(ctx, stone, at);
    if (hole) nope('اضغط حجرك أول', at);
  }
  function next(ctx, stone, hole, at) {
    if (pick.kind === 'swap') {
      if (same(stone, pick.from)) { clear(); return base(ctx); }
      const hit = stone && pick.options.find((o) => same(o.stone, stone));
      if (hit) return commit(hit.act);
      pick = null; paint();
      return fresh(ctx, stone, hole, at);
    }
    if (pick.kind === 'swapFrom') {
      if (same(stone, pick.from)) { clear(); return base(ctx); }
      const hit = stone && pick.swaps.find((a) => a.owner === stone[0] && a.marble === stone[1]);
      if (hit) return commit(hit);
      return nope('اضغط حجرك اللي يتبدّل معه', at, stone);
    }
    if (pick.kind === 'rest') {
      const hit = stone && pick.rest.find((r) => same(r.stone, stone));
      if (hit) return commit(hit.act);
      if (same(stone, pick.from)) { const options = pick.options; pick = { kind: 'move', from: stone, options }; paint(); return tell('السبعة: اضغط الخانة اللي يوقف فيها هالحجر'); }
      return nope('هالحجر ما يقدر يمشي ' + (7 - pick.steps), at, stone);
    }
    // a move with several stops: the hole tapped says which
    const hit = hole && pick.options.find((o) => o.land && jkSame(hole, landingSpot(ctx.state, o.land.owner, o.land.marble, o.land.steps, o.land.backward, o.key === 'enter')));
    if (hit) { if (hit.act) return commit(hit.act); if (hit.then.length === 1) return commit(hit.then[0].act); return stopAt(ctx, pick.from, hit); }
    if (same(stone, pick.from)) { clear(); return base(ctx); }
    if (stone && choicesFor(ctx.state, ctx.actions, stone[0], stone[1]).length) { pick = null; return fresh(ctx, stone, hole, at); }
    return nope('ما يوقف هنا بهالورقة', at, stone);
  }
  function tap(stone, hole, at) {
    const ctx = context();
    if (!ctx || ctx.waiting) return;
    if (!ctx.card) { if (stone) nope('اختر ورقة أول', at, stone); return; }
    if (pick) return next(ctx, stone, hole, at);
    return fresh(ctx, stone, hole, at);
  }
  board.addEventListener('click', (e) => {
    // the plate by a locked house says what it means
    const lock = e.target.closest?.('[data-lock-badge]');
    if (lock) { if (fx) fx.say(lock, JK_LOCK, 'gold'); return; }
    if (e.target.closest?.('[data-player-tag],button,a,.jk-fx b,.jk-confirm')) return;
    const at = jkCenterIn(board, { getBoundingClientRect: () => ({ left: e.clientX, top: e.clientY, width: 1, height: 1 }) });
    const stone = keyOf(jkNearest(board, '[data-stone]', e.clientX, e.clientY, 15));
    const hole = jkHole(jkNearest(board, '[data-track],[data-home],[data-yard],[data-finish-cup]', e.clientX, e.clientY, 12));
    if (!stone && !hole) { if (pick) { clear(); base(context()); } return; }
    tap(stone, hole, at);
  });
  board.addEventListener('bs-board-render', () => { if (pick) paint(); });
  return {
    clear,
    /** The keyboard: Enter on a marble. */
    tapStone(pi, mi) { const el = jkStoneEl(board, pi, mi); tap([pi, mi], null, jkCenterIn(board, el)); },
    reattach() { if (pick) paint(); else if (layer && layer.parentElement !== board) host(); },
    get busy() { return Boolean(pick); },
  };
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
    const x = Math.min(78, Math.max(22, at.x)), t = put(jkEl('b', 'jk-say ' + tone, text), { x, y: Math.max(12, at.y) }); gone(t, tone === 'warn' ? 1700 : 1300);
    // measured without its animation (offsetWidth), so a long word never leaves the screen
    const b = board.getBoundingClientRect(), w = t.offsetWidth, mid = b.left + (x / 100) * b.width, vw = window.innerWidth || b.right, pad = 8;
    if (w && mid - w / 2 < pad) t.style.marginLeft = Math.round(pad - (mid - w / 2)) + 'px';
    else if (w && mid + w / 2 > vw - pad) t.style.marginLeft = Math.round(vw - pad - (mid + w / 2)) + 'px';
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
