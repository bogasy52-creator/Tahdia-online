/* Tahdia 32.0.0 — the Baloot table.
   One renderer for both ways to play: offline against bots (the engine runs
   here) and online (the BoardRoom runs the engine and sends this seat's view
   plus the events since the last update). Events are animated one by one:
   deal, bids, the contract, cards flying to the middle, the trick sweeping to
   its winner, projects, Baloot and the hand result. */
import { createBalootMatch, applyBalootAction, balootView, balootActions, teamOf, partnerOf } from './engines/baloot-engine.js?v=32.0.0';
import { chooseBalootAction } from './engines/baloot-bot.js?v=32.0.0';
import { BoardOnlineClient } from './board-online.js?v=32.0.0';

const $ = (id) => document.getElementById(id);
const POS = ['bottom', 'right', 'top', 'left'];
const SUIT = { S: '♠', H: '♥', D: '♦', C: '♣' };
const RED = { H: true, D: true };
const PROJECT_NAME = { sira: 'سرا', fifty: 'خمسين', hundred: 'مية', fourHundred: 'أربعمية' };
const BOT_NAMES = ['أبو فهد', 'سلطان', 'نايف', 'بندر', 'مشعل', 'تركي', 'فيصل', 'ريان'];
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, reduce() ? Math.min(ms, 120) : ms / ui.speed));
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const play = (name, opts) => { try { window.BS_AUDIO?.play?.(name, opts); } catch {} };

const ui = {
  mode: 'bots', me: 0, match: null, view: null, busy: false, picked: null, level: 'hard', target: 152,
  deck: 'deck-classic', speed: 1, receipt: '', rewarded: false, client: null, room: null, eventSeq: 0,
  pending: Promise.resolve(), lastHandShown: 0, botTimer: null, sending: false,
};

/* ---------- Cosmetics ---------- */
function equipped(type) {
  try { return window.BS_CAREER?.get?.()?.equipped?.[type] || ''; } catch { return ''; }
}
function applyCosmetics() {
  const deck = equipped('deck');
  ui.deck = window.BS_CARDS?.DECKS?.[deck] ? deck : 'deck-classic';
  const table = equipped('table');
  const felt = { 'table-gallery': 'ivory', 'table-nocturne': 'carbon', 'table-midnight': 'carbon', 'table-cyber': 'carbon', 'table-slate': 'carbon', 'table-botanic': 'jade', 'table-emerald': 'jade', 'table-royal': 'royal', 'table-majlis': 'majlis' }[table] || '';
  if (felt) document.body.dataset.felt = felt; else delete document.body.dataset.felt;
}
const cardUrl = (card) => window.BS_CARDS.url(card === '??' ? 'back' : card, ui.deck);
function cardEl(card, extra = '') {
  const el = document.createElement('div');
  el.className = 'bl-card ' + extra;
  el.dataset.card = card;
  const img = document.createElement('img');
  img.alt = card === '??' ? 'ورقة مقلوبة' : cardName(card);
  img.src = cardUrl(card);
  img.draggable = false;
  el.appendChild(img);
  return el;
}
function cardName(card) {
  const rank = { A: 'إكة', K: 'شايب', Q: 'بنت', J: 'ولد', T: '10', 9: '9', 8: '8', 7: '7' }[card[0]];
  return rank + ' ' + SUIT[card[1]];
}
function suitHtml(suit) { return `<span class="suit ${RED[suit] ? 'red suit-red' : 'suit-black'}">${SUIT[suit]}</span>`; }

/* ---------- Seats ---------- */
const posOf = (seat) => POS[(seat - ui.me + 4) % 4];
const seatEl = (seat) => document.querySelector(`.bl-seat[data-pos="${posOf(seat)}"]`);
const slotEl = (seat) => document.querySelector(`.bl-slot[data-pos="${posOf(seat)}"]`);
function seatName(view, seat) { return view?.names?.[seat] || 'لاعب'; }
const playerAt = (seat) => ui.room?.players?.find((p) => p.index === seat) || null;
function isBot(seat) {
  if (ui.mode === 'bots') return seat !== ui.me;
  return Boolean(playerAt(seat)?.bot);
}

function renderSeats(view) {
  for (let seat = 0; seat < 4; seat++) {
    const el = seatEl(seat);
    el.dataset.team = String(teamOf(seat));
    el.querySelector('.bl-name b').textContent = seat === ui.me ? 'أنت' : seatName(view, seat);
    const tags = [];
    if (view.dealer === seat) tags.push('الموزّع');
    if (view.contract && view.contract.buyer === seat) tags.push(view.contract.ashkal ? 'أشكل' : 'المشتري');
    const online = ui.mode !== 'bots' ? playerAt(seat) : null;
    if (online && !online.bot && !online.connected) tags.push('منقطع');
    el.querySelector('.bl-name small').textContent = tags.join(' · ');
    const face = el.querySelector('.bl-face');
    const art = avatarFor(view, seat);
    if (face.dataset.key !== art.key) {
      face.dataset.key = art.key;
      face.innerHTML = art.html;
      face.classList.toggle('letter', Boolean(art.letter));
    }
    el.classList.toggle('is-turn', view.turn === seat && ['bidding', 'doubling', 'playing'].includes(view.phase));
    if (seat !== ui.me) {
      const backs = el.querySelector('.bl-backs');
      const count = view.hands?.[seat]?.length || 0;
      if (Number(backs.dataset.count) !== count) {
        backs.dataset.count = String(count);
        backs.innerHTML = '';
        const vertical = posOf(seat) !== 'top';
        const spread = vertical ? 4.5 : 8;
        const width = vertical ? 70 : 96;
        for (let i = 0; i < count; i++) {
          const img = document.createElement('img');
          img.src = cardUrl('??');
          img.alt = '';
          img.style.left = (width / 2 - 15 + (i - (count - 1) / 2) * spread) + 'px';
          img.style.transform = `rotate(${(i - (count - 1) / 2) * (vertical ? 3 : 4)}deg)`;
          backs.appendChild(img);
        }
      }
    }
  }
}

function avatarFor(view, seat) {
  // Heroes from the shop: yours, the other players' (sent by the room), and
  // a hero for each bot by seat. A player without one gets the free hero.
  const core = window.BS_CAREER_CORE;
  // online, everyone (you included) wears the hero the room accepted
  const character = seat === ui.me && ui.mode !== 'online' ? equipped('character') : (playerAt(seat)?.character || '');
  const src = core?.heroFace?.(character) || (isBot(seat) ? core?.botHeroFace?.(seat) : core?.heroFace?.('fox')) || '';
  if (src) return { key: 'img:' + src, html: `<img src="${esc(src)}" alt="">` };
  const name = seat === ui.me ? seatName(view, seat) : seatName(view, seat);
  const letter = esc(name.trim().slice(0, 1) || '؟');
  return { key: 'txt:' + letter + isBot(seat), html: letter, letter: true };
}

/* ---------- Hand ---------- */
function legalSet(view) {
  if (view.phase !== 'playing' || view.turn !== ui.me || ui.busy) return null;
  return new Set(balootActions(view, ui.me).map((a) => a.card));
}

function renderHand(view) {
  const hand = $('hand');
  const cards = view.hands?.[ui.me] || [];
  const legal = legalSet(view);
  hand.classList.toggle('waiting', !legal);
  const width = hand.clientWidth || 360;
  const cw = parseFloat(getComputedStyle(document.body).getPropertyValue('--bl-card-w')) || Math.min(92, width * 0.175);
  const n = cards.length;
  const step = n > 1 ? Math.min(cw * 0.86, (width - cw - 28) / (n - 1)) : 0;
  const total = cw + step * (n - 1);
  const start = (width - total) / 2;
  const existing = new Map([...hand.children].map((el) => [el.dataset.card, el]));
  const keep = new Set();
  cards.forEach((card, i) => {
    let el = existing.get(card);
    if (!el) { el = cardEl(card); el.addEventListener('click', () => onCardTap(card)); hand.appendChild(el); }
    keep.add(card);
    const t = n > 1 ? i / (n - 1) - 0.5 : 0;
    const fan = `rotate(${(t * 16).toFixed(2)}deg) translateY(${(Math.abs(t) * 14).toFixed(1)}px)`;
    el.style.left = (start + i * step).toFixed(1) + 'px';
    el.style.zIndex = String(10 + i);
    el.style.setProperty('--fan', fan);
    if (!el.classList.contains('picked')) el.style.transform = fan;
    el.classList.toggle('legal', Boolean(legal?.has(card)));
    el.classList.toggle('dim', Boolean(legal && !legal.has(card)));
    if (!legal || !legal.has(card)) el.classList.remove('picked');
  });
  for (const [card, el] of existing) if (!keep.has(card)) el.remove();
  if (ui.picked && !keep.has(ui.picked)) ui.picked = null;
}

// The cards left in the hand slide together as soon as one leaves it.
function closeHandGap() {
  const hand = $('hand');
  const els = [...hand.children];
  const width = hand.clientWidth || 360;
  const cw = parseFloat(getComputedStyle(document.body).getPropertyValue('--bl-card-w')) || Math.min(92, width * 0.175);
  const n = els.length;
  const step = n > 1 ? Math.min(cw * 0.86, (width - cw - 28) / (n - 1)) : 0;
  const start = (width - (cw + step * (n - 1))) / 2;
  els.forEach((el, i) => {
    const t = n > 1 ? i / (n - 1) - 0.5 : 0;
    const fan = `rotate(${(t * 16).toFixed(2)}deg) translateY(${(Math.abs(t) * 14).toFixed(1)}px)`;
    el.style.left = (start + i * step).toFixed(1) + 'px';
    el.style.setProperty('--fan', fan);
    if (!el.classList.contains('picked')) el.style.transform = fan;
  });
}

function onCardTap(card) {
  const view = ui.view;
  const legal = view && legalSet(view);
  if (!legal) return;
  if (!legal.has(card)) { toast('لازم تلعب من الشكل المطلوب أو حسب القانون'); return; }
  const el = [...$('hand').children].find((x) => x.dataset.card === card);
  if (ui.picked !== card) {
    for (const other of $('hand').children) other.classList.remove('picked');
    el?.classList.add('picked');
    el && (el.style.transform = '');
    ui.picked = card;
    play('click', { volume: 0.4 });
    return;
  }
  ui.picked = null;
  act({ type: 'play', card });
}

/* ---------- Centre ---------- */
function renderCenter(view) {
  const bidding = view.phase === 'bidding' || (view.phase === 'doubling' && false);
  const exposed = $('exposed');
  if (view.phase === 'bidding' && view.exposed) {
    exposed.hidden = false;
    if (exposed.dataset.card !== view.exposed) {
      exposed.dataset.card = view.exposed;
      exposed.innerHTML = '';
      exposed.appendChild(cardEl(view.exposed));
    }
  } else { exposed.hidden = true; exposed.dataset.card = ''; }
  const deck = $('deck');
  deck.hidden = !bidding;
  if (bidding && !deck.childElementCount) {
    for (let i = 0; i < 4; i++) { const img = document.createElement('img'); img.src = cardUrl('??'); img.alt = ''; img.style.transform = `translate(${-i * 1.2}px,${-i * 1.2}px)`; deck.appendChild(img); }
  }
  // Cards on the table for the current trick.
  const trick = view.phase === 'playing' ? view.trick?.cards || [] : [];
  for (let seat = 0; seat < 4; seat++) {
    const slot = slotEl(seat);
    const entry = trick.find((x) => x.seat === seat);
    if (!entry) { if (!slot.dataset.hold) slot.innerHTML = ''; slot.dataset.card = ''; continue; }
    if (slot.dataset.card !== entry.card) {
      slot.dataset.card = entry.card;
      slot.innerHTML = '';
      slot.appendChild(cardEl(entry.card));
    }
  }
}

/* ---------- HUD ---------- */
function teamLabel(team) { return team === teamOf(ui.me) ? 'لنا' : 'لهم'; }
function contractText(view) {
  const c = view.contract;
  if (!c) return '';
  const who = c.buyer === ui.me ? 'أنت' : seatName(view, c.buyer);
  let text = c.type === 'sun' ? `${c.ashkal ? 'أشكل' : 'صن'} · ${esc(who)}` : `حكم ${suitHtml(c.trump)} · ${esc(who)}`;
  if (c.gahwa) text += ' · قهوة ☕';
  else if (c.multiplier > 1) text += ` · ${['', '', 'دبل', 'ثري', 'فور'][c.multiplier]}${c.locked ? ' مقفول' : ''}`;
  return text;
}
function renderHud(view) {
  const us = teamOf(ui.me);
  setScore($('scoreUs'), view.scores[us]);
  setScore($('scoreThem'), view.scores[1 - us]);
  $('scoreTarget').textContent = String(view.target);
  const chip = $('contractChip');
  const text = contractText(view);
  chip.hidden = !text;
  chip.innerHTML = text;
  const tricks = [0, 0];
  for (const t of view.tricks || []) tricks[teamOf(t.winner)] += 1;
  const tc = $('trickCount');
  tc.hidden = view.phase !== 'playing' && view.phase !== 'scored';
  tc.textContent = `الأكلات · لنا ${tricks[us]} · لهم ${tricks[1 - us]}`;
}
function setScore(el, value) {
  if (el.textContent !== String(value)) {
    el.textContent = String(value);
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  }
}

/* ---------- Actions & prompt ---------- */
function bidLabel(o, view) {
  if (o.bid === 'pass') return { text: 'بس', cls: 'pass' };
  if (o.bid === 'sun') return { text: view.bidding?.confirm === ui.me ? 'أحوّلها صن' : 'صن', cls: 'sun' };
  if (o.bid === 'ashkal') return { text: 'أشكل', cls: 'sun' };
  const second = view.bidding?.round === 2;
  return { html: `${view.bidding?.confirm === ui.me ? 'أثبّت حكم' : second ? 'ثاني' : 'حكم'}${suitHtml(o.suit)}`, cls: 'hokm' };
}
function doubleLabel(o) {
  const names = { double: 'دبل', triple: 'ثري', four: 'فور', gahwa: 'قهوة ☕', pass: 'بس' };
  return { text: names[o.call] + (o.locked ? ' مقفول' : ''), cls: o.call === 'pass' ? 'pass' : 'hot' };
}
function renderActions(view) {
  const box = $('actions');
  box.innerHTML = '';
  if (ui.busy || view.turn !== ui.me || !['bidding', 'doubling'].includes(view.phase)) return;
  for (const o of balootActions(view, ui.me)) {
    const label = o.type === 'bid' ? bidLabel(o, view) : doubleLabel(o);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'bl-act ' + label.cls;
    if (label.html) b.innerHTML = label.html; else b.textContent = label.text;
    b.addEventListener('click', () => act(o));
    box.appendChild(b);
  }
}
function renderPrompt(view) {
  const p = $('prompt');
  if (view.phase === 'finished') { p.textContent = ''; return; }
  if (view.phase === 'scored') { p.textContent = 'انتهت الجولة'; return; }
  const mine = view.turn === ui.me;
  if (view.phase === 'bidding') {
    if (mine) p.innerHTML = view.bidding?.confirm === ui.me ? 'ثبّت الحكم أو حوّلها صن' : view.bidding?.round === 2 ? '<b>الجولة الثانية</b>: ثاني بشكل آخر، أو صن، أو بس' : 'دورك في الشراء';
    else p.textContent = `${seatName(view, view.turn)} يقرر…`;
    return;
  }
  if (view.phase === 'doubling') {
    p.innerHTML = mine ? '<b>الدبل</b>: ترفع المخاطرة أو تمرّر' : `${esc(seatName(view, view.turn))} يفكر في الدبل…`;
    return;
  }
  if (view.phase === 'playing') {
    if (mine) p.innerHTML = ui.picked ? 'اضغط الورقة مرة ثانية لتلعبها' : '<b>دورك</b> · اختر ورقة';
    else p.textContent = `دور ${seatName(view, view.turn)}`;
  }
}

function render(view = ui.view) {
  if (!view) return;
  ui.view = view;
  renderSeats(view);
  renderCenter(view);
  renderHud(view);
  renderHand(view);
  renderActions(view);
  renderPrompt(view);
}

/* ---------- Animation helpers ---------- */
function rectOf(el) { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; }
async function fly(card, from, to, { duration = 420, rotate = 0, fromScale = 1, toScale = 1, fade = false } = {}) {
  if (!from || !to) return;
  const el = document.createElement('div');
  el.className = 'bl-flying';
  const img = document.createElement('img');
  img.src = cardUrl(card);
  img.alt = '';
  el.appendChild(img);
  document.body.appendChild(el);
  const w = el.getBoundingClientRect().width || 70;
  const h = w * 1.4;
  el.style.left = (from.x - w / 2) + 'px';
  el.style.top = (from.y - h / 2) + 'px';
  const dx = to.x - from.x, dy = to.y - from.y;
  const frames = [
    { transform: `translate(0,0) rotate(${rotate * 0.3}deg) scale(${fromScale})`, opacity: 1 },
    { transform: `translate(${dx}px,${dy}px) rotate(${rotate}deg) scale(${toScale})`, opacity: fade ? 0 : 1 },
  ];
  try { await el.animate(frames, { duration: reduce() ? 80 : duration / ui.speed, easing: 'cubic-bezier(.2,.8,.25,1)', fill: 'forwards' }).finished; } catch {}
  el.remove();
}
function bubble(seat, text, cls = '', ms = 1500) {
  const b = seatEl(seat).querySelector('.bl-bubble');
  b.className = 'bl-bubble ' + cls;
  b.innerHTML = text;
  b.hidden = false;
  void b.offsetWidth;
  b.classList.add('show');
  clearTimeout(b._t);
  b._t = setTimeout(() => { b.hidden = true; }, ms / ui.speed);
}
async function banner(html, ms = 1300) {
  const el = $('banner');
  el.innerHTML = html;
  el.hidden = false;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  await wait(ms);
  el.hidden = true;
}
function toast(text, ms = 2200) {
  const t = $('toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(t._t);
  t._t = setTimeout(() => { t.hidden = true; }, ms);
}
const deckPoint = () => rectOf($('felt').querySelector('.bl-felt-inner'));
function seatPoint(seat) {
  if (seat === ui.me) return rectOf($('hand'));
  const backs = seatEl(seat).querySelector('.bl-backs');
  return rectOf(backs || seatEl(seat));
}

async function animateDeal(view) {
  play('balootShuffle', { volume: 0.7 });
  const center = deckPoint();
  const order = [0, 1, 2, 3].map((i) => (view.dealer + 1 + i) % 4);
  const jobs = [];
  let k = 0;
  for (const count of [3, 2]) for (const seat of order) {
    for (let c = 0; c < count; c++) {
      const delay = k++ * 28;
      jobs.push(wait(delay).then(() => { play('balootDeal', { volume: 0.32 }); return fly('??', center, seatPoint(seat), { duration: 300, rotate: 10, toScale: seat === ui.me ? 1 : 0.5, fade: seat !== ui.me }); }));
    }
  }
  await Promise.all(jobs);
}

async function animateSecondDeal(view, contract) {
  const center = deckPoint();
  const ex = $('exposed');
  const from = !ex.hidden ? rectOf(ex) : center;
  await fly(view.exposed || contract.exposed || '??', from, seatPoint(contract.taker), { duration: 420, toScale: contract.taker === ui.me ? 1 : 0.5, fade: contract.taker !== ui.me });
  const order = [0, 1, 2, 3].map((i) => (view.dealer + 1 + i) % 4);
  const jobs = [];
  let k = 0;
  for (const seat of order) {
    const count = seat === contract.taker ? 2 : 3;
    for (let c = 0; c < count; c++) {
      const delay = k++ * 40;
      jobs.push(wait(delay).then(() => { play('balootDeal', { volume: 0.3 }); return fly('??', center, seatPoint(seat), { duration: 280, rotate: 8, toScale: seat === ui.me ? 1 : 0.5, fade: seat !== ui.me }); }));
    }
  }
  await Promise.all(jobs);
}

async function animatePlay(seat, card) {
  const slot = slotEl(seat);
  let from;
  if (seat === ui.me) {
    const el = [...$('hand').children].find((x) => x.dataset.card === card);
    from = el ? rectOf(el) : rectOf($('hand'));
    el?.remove();
    closeHandGap();
  } else from = seatPoint(seat);
  play('balootPlay', { volume: 0.8 });
  slot.dataset.hold = '1';
  await fly(card, from, rectOf(slot), { duration: 340, rotate: { bottom: 2, top: -3, left: -8, right: 7 }[posOf(seat)], fromScale: seat === ui.me ? 1 : 0.55 });
  slot.innerHTML = '';
  slot.appendChild(cardEl(card));
  slot.dataset.card = card;
}

async function animateTrick(event) {
  const winSlot = slotEl(event.winner);
  winSlot.querySelector('.bl-card')?.classList.add('win');
  await wait(650);
  play('balootTrick', { volume: 0.6 });
  const target = rectOf(seatEl(event.winner).querySelector('.bl-avatar'));
  const jobs = [];
  for (const { seat, card } of event.cards) {
    const slot = slotEl(seat);
    const from = rectOf(slot);
    slot.innerHTML = '';
    slot.dataset.card = '';
    delete slot.dataset.hold;
    jobs.push(fly(card, from, target, { duration: 380, toScale: 0.35, fade: true }));
  }
  await Promise.all(jobs);
}

async function showProjects(event) {
  play('balootChime', { volume: 0.6 });
  const shown = event.shown || [];
  const layer = $('felt').querySelector('.bl-center');
  const boxes = [];
  const bySeat = new Map();
  for (const p of shown) { if (!bySeat.has(p.seat)) bySeat.set(p.seat, []); bySeat.get(p.seat).push(p); }
  for (const [seat, list] of bySeat) {
    const box = document.createElement('div');
    box.className = 'bl-projects';
    box.innerHTML = `<b>${esc(seat === ui.me ? 'أنت' : seatName(ui.view, seat))}: ${list.map((p) => PROJECT_NAME[p.type]).join(' + ')}</b>` + list.flatMap((p) => p.cards).map((c) => `<img src="${cardUrl(c)}" alt="${cardName(c)}">`).join('');
    const spot = { bottom: 'left:50%;bottom:24%;transform:translateX(-50%)', top: 'left:50%;top:21%;transform:translateX(-50%)', left: 'left:4%;top:38%', right: 'right:4%;top:38%' }[posOf(seat)];
    box.setAttribute('style', spot);
    layer.appendChild(box);
    boxes.push(box);
  }
  bubbleTeam(event.team);
  await wait(2600);
  boxes.forEach((b) => b.remove());
}
function bubbleTeam(team) {
  for (let seat = 0; seat < 4; seat++) if (teamOf(seat) === team) bubble(seat, 'مشروعنا الأعلى ✨', 'hot', 1800);
}

/* A short burst of confetti in the team colours. */
function celebrate() {
  if (reduce()) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'bl-confetti';
  document.body.appendChild(canvas);
  const dpr = Math.min(2, devicePixelRatio || 1), w = innerWidth, h = innerHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const c = canvas.getContext('2d');
  c.scale(dpr, dpr);
  const colors = ['#f1cf7e', '#5fe0c0', '#ff9a66', '#fff3d6', '#c4253a'];
  const bits = Array.from({ length: 140 }, () => ({ x: w / 2 + (Math.random() - 0.5) * w * 0.3, y: h * 0.42, vx: (Math.random() - 0.5) * 11, vy: -6 - Math.random() * 9, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3, s: 5 + Math.random() * 6, col: colors[Math.floor(Math.random() * colors.length)] }));
  const t0 = performance.now();
  const frame = (now) => {
    const t = now - t0;
    c.clearRect(0, 0, w, h);
    for (const b of bits) {
      b.vy += 0.32; b.x += b.vx; b.y += b.vy; b.r += b.vr; b.vx *= 0.99;
      c.save(); c.translate(b.x, b.y); c.rotate(b.r); c.globalAlpha = Math.max(0, 1 - t / 2400); c.fillStyle = b.col; c.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2); c.restore();
    }
    if (t < 2400) requestAnimationFrame(frame); else canvas.remove();
  };
  requestAnimationFrame(frame);
}

function bidText(e) {
  if (e.bid === 'pass') return ['بس', 'pass'];
  if (e.bid === 'sun') return ['صن ☀️', 'hot'];
  if (e.bid === 'ashkal') return ['أشكل', 'hot'];
  return [`${e.round === 2 ? 'ثاني' : 'حكم'} ${suitHtml(e.suit)}`, 'hot'];
}

// Animate one batch of events; `after` is the view once the batch is done.
async function playEvents(events, after) {
  for (const e of events) {
    if (e.type === 'deal') {
      render({ ...after, phase: 'dealing', hands: after.hands.map(() => []), trick: null, tricks: [], contract: null });
      $('exposed').hidden = true;
      await animateDeal(after);
      render(after);
      play('balootFlip', { volume: 0.5 });
      await wait(300);
    } else if (e.type === 'bid') {
      const [text, cls] = bidText(e);
      bubble(e.seat, text, cls);
      play(e.bid === 'pass' ? 'click' : 'balootBid', { volume: e.bid === 'pass' ? 0.35 : 0.7 });
      await wait(e.bid === 'pass' ? 520 : 820);
    } else if (e.type === 'second_round') {
      await banner('الجولة الثانية<small>ثاني بشكل آخر، أو صن</small>', 1100);
    } else if (e.type === 'redeal') {
      await banner('ما أحد اشترى<small>توزيع جديد</small>', 1200);
    } else if (e.type === 'contract') {
      const c = e.contract;
      const who = c.buyer === ui.me ? 'أنت' : seatName(after, c.buyer);
      play('balootBuy', { volume: 0.8 });
      await banner(c.type === 'sun' ? `${c.ashkal ? 'أشكل' : 'صن'}<small>${esc(who)} اشترى</small>` : `حكم ${suitHtml(c.trump)}<small>${esc(who)} اشترى</small>`, 1100);
      await animateSecondDeal({ ...after, exposed: e.exposed }, { ...c, exposed: e.exposed });
      render(after);
    } else if (e.type === 'double') {
      const names = { double: 'دبل', triple: 'ثري', four: 'فور', gahwa: 'قهوة ☕', pass: 'بس' };
      bubble(e.seat, names[e.call] + (e.locked ? ' مقفول' : ''), e.call === 'pass' ? 'pass' : 'hot');
      if (e.call !== 'pass') { play('balootDouble', { volume: 0.9 }); await banner(names[e.call] + (e.call === 'gahwa' ? '<small>الفائز بالجولة يربح الصكّة</small>' : ''), 900); } else await wait(480);
    } else if (e.type === 'declare') {
      bubble(e.seat, e.projects.map((p) => PROJECT_NAME[p]).join(' + '), 'hot', 1800);
      play('balootChime', { volume: 0.4 });
    } else if (e.type === 'play') {
      await animatePlay(e.seat, e.card);
    } else if (e.type === 'baloot') {
      bubble(e.seat, 'بلوت 👑', 'hot', 2000);
      play('balootChime', { volume: 0.8 });
      await wait(500);
    } else if (e.type === 'trick') {
      await animateTrick(e);
    } else if (e.type === 'projects') {
      await showProjects(e);
    } else if (e.type === 'hand_scored') {
      renderHud({ ...after, scores: e.scores });
      await showResult(e.result, e.scores, after);
    } else if (e.type === 'match_finished') {
      showMatchEnd(e.winner, e.scores);
    }
  }
}

/* ---------- Results ---------- */
function showResult(result, scores, view) {
  const us = teamOf(ui.me), them = 1 - us;
  const c = result.contract;
  const buyerTeam = teamOf(c.buyer);
  const ours = buyerTeam === us;
  let title;
  if (result.kaboot !== null) title = result.kaboot === us ? 'كبوت لكم! 🔥' : 'كبوت عليكم';
  else title = result.declWins ? (ours ? 'نجحت شريتكم' : 'نجح الخصم') : (ours ? 'خسرتم الشرية — النقاط للخصم' : 'خسر الخصم الشرية — النقاط لكم');
  $('resultTitle').textContent = title;
  const who = c.buyer === ui.me ? 'أنت' : seatName(view, c.buyer);
  $('resultLine').innerHTML = `${c.type === 'sun' ? (c.ashkal ? 'أشكل' : 'صن') : 'حكم ' + suitHtml(c.trump)} · المشتري ${esc(who)}${c.multiplier > 1 ? ' · ×' + c.multiplier : ''}${c.gahwa ? ' · قهوة' : ''}`;
  const row = (label, a, b, cls = '') => `<tr class="${cls}"><td>${label}</td><td>${a}</td><td>${b}</td></tr>`;
  const rows = [
    row('الأكلات', result.tricks[us], result.tricks[them]),
    row('الأبناط', result.abnat[us], result.abnat[them]),
    row('المشاريع', result.projects[us] || '—', result.projects[them] || '—'),
    row('البلوت', result.baloot[us] || '—', result.baloot[them] || '—'),
    row('نقاط الجولة', result.score[us], result.score[them], 'total'),
  ];
  $('resultRows').innerHTML = rows.join('');
  $('resultTotals').textContent = `لنا ${scores[us]} · لهم ${scores[them]}`;
  const won = result.winnerTeam === us;
  play(won ? 'win' : 'wrong', { volume: 0.6 });
  if (result.kaboot === us) celebrate();
  const sheet = $('resultSheet');
  const finished = view.phase === 'finished';
  $('nextHand').textContent = finished ? 'النتيجة النهائية' : 'الجولة التالية';
  $('nextHand').disabled = ui.mode !== 'bots' && !finished;
  sheet.hidden = false;
  return new Promise((resolve) => {
    let done = false;
    const close = () => { if (done) return; done = true; sheet.hidden = true; resolve(); };
    $('nextHand').onclick = close;
    // Online the room deals the next hand by itself.
    if (ui.mode !== 'bots' && !finished) setTimeout(close, 5200);
  });
}

function showMatchEnd(winner, scores) {
  const us = teamOf(ui.me);
  const won = winner === us;
  $('matchTitle').textContent = won ? 'فزتم بالصكّة! 🏆' : 'راحت الصكّة عليكم';
  $('matchLine').textContent = `لنا ${scores[us]} · لهم ${scores[1 - us]}`;
  const fan = document.querySelector('.bl-end-fan');
  fan.innerHTML = '';
  ['AS', 'KH', 'QD', 'JC', 'TS'].forEach((card, i) => { const img = document.createElement('img'); img.src = cardUrl(card); img.alt = ''; img.style.transform = `translateX(-50%) rotate(${(i - 2) * 11}deg)`; fan.appendChild(img); });
  $('matchEnd').hidden = false;
  play(won ? 'win' : 'wrong');
  if (won) celebrate();
  if (ui.mode === 'bots' && !ui.rewarded) {
    ui.rewarded = true;
    try { window.BS_CAREER?.record?.({ id: ui.receipt, game: 'baloot', win: won }); } catch {}
  }
  $('playAgain').textContent = ui.mode === 'bots' ? 'صكّة جديدة' : 'إعادة';
  $('playAgain').hidden = ui.mode !== 'bots' && ui.room?.me?.role !== 'host';
}

/* ---------- Offline game ---------- */
function startBots() {
  applyCosmetics();
  ui.mode = 'bots';
  ui.me = 0;
  ui.level = $('botLevel').value;
  ui.target = Number($('target').value) || 152;
  const myName = ($('nameBots').value || '').trim().slice(0, 20) || 'أنت';
  try { localStorage.setItem('bs_baloot_name', myName); } catch {}
  const pool = [...BOT_NAMES].sort(() => Math.random() - 0.5);
  const names = [myName, pool[0], pool[1], pool[2]];
  ui.receipt = (window.BS_UUID?.() || (Date.now() + '-' + Math.random().toString(36).slice(2)));
  ui.rewarded = false;
  ui.match = createBalootMatch({ names, target: ui.target });
  showTable();
  const view = balootView(ui.match, ui.me);
  ui.view = view;
  queue(() => playEvents([{ type: 'deal', dealer: view.dealer, exposed: view.exposed }], view).then(() => render(view)).then(botsTurn));
}

function queue(task) {
  ui.pending = ui.pending.then(async () => { ui.busy = true; try { await task(); } catch (error) { console.error(error); } finally { ui.busy = false; render(); } });
  return ui.pending;
}

function applyLocal(seat, action) {
  const { state, events } = applyBalootAction(ui.match, seat, action, Math.random);
  ui.match = state;
  const view = balootView(state, ui.me);
  return playEvents(events, view).then(() => { ui.view = view; render(view); });
}

function botsTurn() {
  clearTimeout(ui.botTimer);
  const s = ui.match;
  if (!s || ui.mode !== 'bots') return;
  if (s.phase === 'scored') { queue(() => applyLocal(null, { type: 'next' })).then(botsTurn); return; }
  if (!['bidding', 'doubling', 'playing'].includes(s.phase) || s.turn === ui.me) return;
  const seat = s.turn;
  const delay = s.phase === 'playing' ? 520 + Math.random() * 420 : 700 + Math.random() * 500;
  ui.botTimer = setTimeout(() => {
    queue(async () => {
      const action = chooseBalootAction(balootView(ui.match, seat), seat, { level: ui.level });
      if (action) await applyLocal(seat, action);
    }).then(botsTurn);
  }, delay / ui.speed);
}

/* ---------- Acting ---------- */
function act(action) {
  if (ui.busy) return;
  if (ui.mode === 'bots') {
    if (ui.match.turn !== ui.me) return;
    $('actions').innerHTML = '';
    queue(() => applyLocal(ui.me, action)).then(botsTurn);
    return;
  }
  if (!ui.client || ui.sending) return;
  ui.sending = true;
  $('actions').innerHTML = '';
  const ok = ui.client.send('baloot', { action });
  if (!ok) ui.sending = false;
  setTimeout(() => { ui.sending = false; }, 1500);
}

/* ---------- Online ---------- */
function onRoomState(room) {
  ui.room = room;
  ui.sending = false;
  ui.me = room.me?.index ?? 0;
  if (room.status === 'lobby') { ui.batchId = 0; ui.matchStart = null; showLobby(room); return; }
  const view = room.state;
  if (!view) return;
  if (ui.matchStart !== room.startedAt) { ui.matchStart = room.startedAt; ui.batchId = 0; ui.seenBatch = false; }
  if ($('table').hidden) showTable();
  // Animate a new batch; on (re)connect only a batch that just happened.
  let events = [];
  const batch = room.batch;
  if (batch && batch.id > (ui.batchId || 0)) {
    const fresh = (room.serverNow || Date.now()) - batch.at < 4000;
    if (ui.seenBatch || fresh) events = batch.events || [];
    ui.batchId = batch.id;
  }
  ui.seenBatch = true;
  queue(async () => {
    if (events.length) await playEvents(events, view);
    ui.view = view;
    render(view);
    paintTimer();
  });
}

function showLobby(room) {
  $('setup').hidden = false;
  $('table').hidden = true;
  document.body.classList.remove('bl-playing');
  for (const p of document.querySelectorAll('.bl-panel')) p.hidden = true;
  $('lobby').hidden = false;
  $('lobbyKind').textContent = room.publicMatch ? 'لعب سريع' : 'غرفة خاصة';
  $('lobbyTitle').textContent = room.publicMatch ? 'نجمع اللاعبين…' : 'بانتظار أصحابك';
  $('lobbyCode').textContent = room.code || '——————';
  $('copyCode').hidden = Boolean(room.publicMatch);
  $('inviteFriends').hidden = Boolean(room.publicMatch);
  try { window.BS_INVITES?.set?.({ game: 'baloot', code: room.code, joinable: !room.publicMatch }); } catch {}
  const seats = $('lobbySeats');
  seats.innerHTML = '';
  for (let seat = 0; seat < 4; seat++) {
    const p = room.players.find((x) => x.index === seat);
    const card = document.createElement('div');
    card.className = 'bl-seat-card' + (p ? '' : ' empty');
    card.dataset.team = String(seat % 2);
    const face = p ? (window.BS_CAREER_CORE?.heroFace?.(p.character) || '') : '';
    card.innerHTML = p ? `<span class="bl-mini-face">${face ? `<img src="${esc(face)}" alt="">` : esc((p.name || '؟').slice(0, 1))}</span><span><b>${esc(p.name)}${p.id === room.me?.id ? ' (أنت)' : ''}</b><small>${seat % 2 === 0 ? 'الفريق الأول' : 'الفريق الثاني'} · ${p.ready ? 'جاهز' : p.connected ? 'متصل' : 'يعيد الاتصال'}</small></span>` : `<span class="bl-mini-face">🤖</span><span><b>مقعد فاضي</b><small>البوت يكمله عند البداية</small></span>`;
    seats.appendChild(card);
  }
  const me = room.players.find((p) => p.id === room.me?.id);
  $('readyBtn').hidden = Boolean(room.publicMatch);
  $('readyBtn').textContent = me?.ready ? 'إلغاء الجاهزية' : 'أنا جاهز';
  $('hostStart').hidden = room.publicMatch || room.me?.role !== 'host';
  $('lobbyNote').textContent = room.publicMatch ? 'تبدأ الطاولة تلقائيًا، والمقاعد الفاضية يكملها البوت.' : 'أرسل الرمز لأصحابك. أول لاعبين شركاء. المضيف يبدأ، والبوت يكمل الناقص.';
  $('lobbyCountdown').hidden = !room.publicMatch || !room.lobbyDeadline;
  paintLobbyRing();
}

function paintLobbyRing() {
  const room = ui.room;
  if (!room || room.status !== 'lobby' || !room.publicMatch || !room.lobbyDeadline) return;
  const left = Math.max(0, room.lobbyDeadline - (room.serverNow + Date.now() - room.clientReceivedAt));
  $('lobbySeconds').textContent = String(Math.ceil(left / 1000));
  const canvas = $('lobbyRing');
  const c = canvas.getContext('2d');
  const css = canvas.clientWidth || 72, dpr = Math.min(3, devicePixelRatio || 1);
  if (canvas.width !== Math.round(css * dpr)) { canvas.width = Math.round(css * dpr); canvas.height = canvas.width; }
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, css, css);
  c.lineWidth = 6; c.lineCap = 'round';
  c.strokeStyle = '#ffffff1c'; c.beginPath(); c.arc(css / 2, css / 2, css / 2 - 5, 0, Math.PI * 2); c.stroke();
  c.strokeStyle = '#f1cf7e'; c.beginPath(); c.arc(css / 2, css / 2, css / 2 - 5, -Math.PI / 2, -Math.PI / 2 + Math.min(1, left / 15000) * Math.PI * 2); c.stroke();
  if (left > 0) requestAnimationFrame(paintLobbyRing);
}

function paintTimer() {
  const room = ui.room;
  for (const el of document.querySelectorAll('.bl-seat')) el.querySelector('.bl-timer').style.setProperty('--t', '1');
  if (!room || room.status !== 'playing' || !room.turnDeadline || !ui.view) return;
  const seat = ui.view.turn;
  if (seat === null || seat === undefined) return;
  const total = room.turnTotal || 30000;
  const left = Math.max(0, room.turnDeadline - (room.serverNow + Date.now() - room.clientReceivedAt));
  seatEl(seat).querySelector('.bl-timer').style.setProperty('--t', String(Math.min(1, left / total)));
  if (left > 0 && ui.room === room) requestAnimationFrame(paintTimer);
}

async function startOnline(kind) {
  applyCosmetics();
  ui.mode = 'online';
  const name = (($(kind === 'quick' ? 'nameQuick' : 'nameRoom').value) || '').trim().slice(0, 20) || 'لاعب';
  try { localStorage.setItem('bs_baloot_name', name); } catch {}
  message('');
  ui.client?.close?.();
  ui.client = new BoardOnlineClient('baloot', {
    onState: onRoomState,
    onStatus: (s) => { const n = $('netState'); n.hidden = s.online; n.className = 'bl-net' + (s.online ? '' : ' off'); n.textContent = s.text || ''; },
    onError: (text) => { toast(text); ui.sending = false; },
  });
  try {
    if (kind === 'quick') {
      const res = await fetch('/api/baloot/quick', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || 'تعذر إيجاد طاولة الآن');
      await ui.client.join(data.code, name);
    } else if (kind === 'create') await ui.client.create(name, 4);
    else await ui.client.join($('joinCode').value, name);
  } catch (error) {
    message(error.message || 'تعذر الاتصال');
    ui.client?.close?.();
    ui.client = null;
  }
}

/* ---------- Screens ---------- */
function showTable() {
  $('setup').hidden = true;
  $('table').hidden = false;
  document.body.classList.add('bl-playing');
  $('resultSheet').hidden = true;
  $('matchEnd').hidden = true;
  for (const slot of document.querySelectorAll('.bl-slot')) { slot.innerHTML = ''; slot.dataset.card = ''; delete slot.dataset.hold; }
  for (const backs of document.querySelectorAll('.bl-backs')) { backs.innerHTML = ''; backs.dataset.count = ''; }
  $('hand').innerHTML = '';
  try { window.scrollTo(0, 0); } catch {}
}
function showSetup() {
  clearTimeout(ui.botTimer);
  ui.match = null;
  ui.view = null;
  ui.client?.close?.();
  ui.client = null;
  ui.room = null;
  try { window.BS_INVITES?.set?.(null); } catch {}
  $('table').hidden = true;
  $('setup').hidden = false;
  $('lobby').hidden = true;
  $('matchEnd').hidden = true;
  $('resultSheet').hidden = true;
  document.body.classList.remove('bl-playing');
  selectMode(ui.lastMode || 'bots');
}
function message(text) { $('setupMessage').textContent = text; }
function selectMode(mode) {
  ui.lastMode = mode;
  for (const b of document.querySelectorAll('.bl-mode')) { const on = b.dataset.mode === mode; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', String(on)); }
  for (const p of document.querySelectorAll('.bl-panel')) p.hidden = p.dataset.panel !== mode;
  $('lobby').hidden = true;
}
function heroFan() {
  const fan = $('heroFan');
  fan.innerHTML = '';
  ['JS', '9S', 'AH', 'KD', 'QD'].forEach((card, i) => {
    const img = document.createElement('img');
    img.src = cardUrl(card);
    img.alt = '';
    img.style.transform = `translateX(-50%) rotate(${(i - 2) * 12}deg) translateY(${Math.abs(i - 2) * 6}px)`;
    img.style.zIndex = String(i);
    fan.appendChild(img);
  });
}

function showLog() {
  const history = (ui.view?.history || []).filter((h) => !h.redeal);
  const us = teamOf(ui.me);
  $('logRows').innerHTML = history.length ? history.map((h, i) => `<tr><td>${i + 1} · ${h.contract.type === 'sun' ? 'صن' : 'حكم ' + suitHtml(h.contract.trump)}</td><td>${h.score[us]}</td><td>${h.score[1 - us]}</td></tr>`).join('') : '<tr><td colspan="3">ما في جولات بعد</td></tr>';
  $('logSheet').hidden = false;
}

function init() {
  applyCosmetics();
  heroFan();
  try {
    const saved = localStorage.getItem('bs_baloot_name');
    if (saved) for (const id of ['nameBots', 'nameQuick', 'nameRoom']) $(id).value = saved;
  } catch {}
  for (const b of document.querySelectorAll('.bl-mode')) b.addEventListener('click', () => selectMode(b.dataset.mode));
  $('startBots').addEventListener('click', startBots);
  $('startQuick').addEventListener('click', () => startOnline('quick'));
  $('createRoom').addEventListener('click', () => startOnline('create'));
  $('joinRoom').addEventListener('click', () => startOnline('join'));
  $('readyBtn').addEventListener('click', () => { const me = ui.room?.players?.find((p) => p.id === ui.room?.me?.id); ui.client?.send('ready', { ready: !me?.ready }); });
  $('hostStart').addEventListener('click', () => ui.client?.send('start'));
  $('leaveLobby').addEventListener('click', showSetup);
  $('inviteFriends').addEventListener('click', () => { if (window.BS_INVITES?.open) window.BS_INVITES.open(); else $('copyCode').click(); });
  $('copyCode').addEventListener('click', async () => { try { await navigator.clipboard.writeText(ui.room?.code || ''); toast('نسخنا الرمز'); } catch { toast('الرمز: ' + (ui.room?.code || '')); } });
  $('leaveTable').addEventListener('click', () => { if (ui.mode === 'bots' && ui.match && ui.match.phase !== 'finished' && !confirmLeave()) return; showSetup(); });
  $('openLog').addEventListener('click', showLog);
  $('closeLog').addEventListener('click', () => { $('logSheet').hidden = true; });
  $('playAgain').addEventListener('click', () => { $('matchEnd').hidden = true; if (ui.mode === 'bots') startBots(); else ui.client?.send('rematch'); });
  $('endExit').addEventListener('click', showSetup);
  $('felt').addEventListener('click', (e) => { if (ui.picked && !e.target.closest('.bl-hand')) { const card = ui.picked; if (legalSet(ui.view)?.has(card)) { ui.picked = null; act({ type: 'play', card }); } } });
  addEventListener('resize', () => render());
  addEventListener('bs-career-change', () => { applyCosmetics(); heroFan(); });
  const params = new URLSearchParams(location.search);
  const code = params.get('room') || params.get('code');
  if (code && /^\d{6}$/.test(code)) {
    selectMode('room');
    $('joinCode').value = code;
    let saved = '';
    try { saved = localStorage.getItem('bs_baloot_name') || ''; } catch {}
    if (saved) startOnline('join'); else $('nameRoom').focus();
  }
  else selectMode('bots');
  window.BS_AUDIO?.prime?.(['balootDeal', 'balootPlay', 'balootTrick', 'balootShuffle', 'balootBid', 'balootBuy', 'balootDouble', 'balootChime', 'balootFlip']);
}
let leaveArmed = 0;
function confirmLeave() {
  if (Date.now() - leaveArmed < 2500) return true;
  leaveArmed = Date.now();
  toast('اضغط ✕ مرة ثانية للخروج من الصكّة');
  return false;
}

window.BS_BALOOT = { ui, startBots, render, act };
init();
