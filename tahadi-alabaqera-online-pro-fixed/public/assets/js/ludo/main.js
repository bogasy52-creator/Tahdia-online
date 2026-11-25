/* Tahdia 33.10.5 — the «لودو» page. It plays the tables of الزهرة (variant «ludo» / «ludo-quick»), so
   rooms, quick tables, the party and the stats are the same; the board is the classic cross.
   The board turns so your yard is at the bottom left, and each player's card sits in the corner of
   the screen where his yard is, with his die next to it. */
import { renderLudoBoard, LUDO_COLORS, LUDO_NAMES, screenCorner } from './board.js?v=33.18.1';
import { createZahraPractice } from '../zahra-practice-v33-10.js?v=33.11.4';
import { getLegalLudoMoves, ludoGeometry } from '../engines/ludo-engine.js?v=33.11.4';
import { createTable, seatLook, skinDie } from '../board-table-v33.js?v=33.18.1';
import { ludoSound } from './sound-v33-13.js?v=33.13.0';

const $ = (s) => document.querySelector(s);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const isLudo = (variant) => variant === 'ludo' || variant === 'ludo-quick';
const CORNERS = ['tl', 'tm', 'tr', 'bl', 'bm', 'br'];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

let room = null, state = null, currentRoll = null, busy = false, practice = null, frameGeneration = 0, remoteTimer = null;
let receipt = '', rewarded = false, visualTurn = null, leaving = false, motion = null, lastCalled = '';

const me = () => room?.me?.index ?? -1;
// on one phone passed round the table the board stays still; everywhere else it turns to the one holding it
const viewer = () => (room?.localMode === 'pass' ? 0 : Math.max(0, me()));
const canAct = () => room?.status === 'playing' && state && me() === state.turn && state.winner === null;
const playerAt = (seat) => (room?.players || []).find((p) => p.index === seat) || null;
const cornerOf = (seat) => screenCorner(state, seat, viewer());
const diceOf = (seat) => $('#die-' + cornerOf(seat));
const home = (p) => p.tokens.filter((t) => t === ludoGeometry(state).finish).length;
const colourName = (seat) => LUDO_NAMES[ludoGeometry(state).corners[seat]];
const colourOf = (seat) => LUDO_COLORS[ludoGeometry(state).corners[seat]];

/* ---------- the players' corners ---------- */
function face(seat) {
  const look = seatLook(room, seat), url = window.BS_CAREER_CORE?.heroFace?.(look.character) || '';
  const name = state.players[seat]?.name || '؟';
  return url ? `<img src="${esc(url)}" alt="" loading="lazy" decoding="async">` : `<b>${esc(String(name).trim().slice(0, 1))}</b>`;
}
function renderPlates() {
  document.body.classList.toggle('ludo-six',state.players.length===6);
  const turn = visualTurn ?? state.turn, seatAt = {};
  state.players.forEach((_, seat) => { seatAt[cornerOf(seat)] = seat; });
  for (const corner of CORNERS) {
    const plate = document.querySelector(`.ludo-plate[data-corner="${corner}"]`), seat = seatAt[corner];
    plate.hidden = seat === undefined;
    if (seat === undefined) continue;
    const p = state.players[seat], done = home(p), mine = seat === me() && room?.localMode !== 'pass', on = turn === seat && state.winner === null;
    plate.style.setProperty('--seat', colourOf(seat));
    plate.classList.toggle('is-turn', on);
    plate.classList.toggle('is-me', mine);
    plate.classList.toggle('is-winner', state.winner === seat);
    plate.dataset.seat = String(seat);
    const card = plate.querySelector('.lp-card');
    const key = [seat, p.name, done, mine, seatLook(room, seat).character,seatLook(room,seat).frame].join('|');
    if (card.dataset.key !== key) {
      card.dataset.key = key;
      card.dataset.playerTag = String(seat);
      card.setAttribute('role', 'button'); card.tabIndex = 0;
      card.setAttribute('aria-label', `${p.name}، ${colourName(seat)}، ${done} من 4 في الوسط`);
      card.innerHTML = `<span class="lp-face">${face(seat)}</span><span class="lp-meta"><b>${esc(p.name)}</b><small>${mine ? 'أنت · ' : ''}${colourName(seat)}</small><span class="lp-home" aria-hidden="true">${[0, 1, 2, 3].map((k) => `<i class="${k < done ? 'in' : ''}"></i>`).join('')}</span></span>`;
    }
    const image=plate.querySelector('.lp-face'),frame=seatLook(room,seat).frame;
    if(image){image.className='lp-face bs-avatar'+(frame&&frame!=='frame-none'?' bs-frame bs-frame-'+frame.replace(/^frame-/,''):'');}
    window.BS_LEGEND_FRAMES?.decorateAvatar(image,frame);window.BS_LEGEND_FRAMES?.decorateName(plate.querySelector('.lp-meta b'),frame);
    const die = plate.querySelector('.die');
    skinDie(die, seatLook(room, seat).dice);
    plate.classList.toggle('show-die', on || (state.winner === null && seat === state.lastEvent?.player && turn === seat));
    die.classList.toggle('can-roll', on && canAct() && currentRoll === null && !busy);
  }
}

/* ---------- the board ---------- */
function renderBoard(move = null) {
  const legal = canAct() && !busy && currentRoll ? getLegalLudoMoves(state, currentRoll) : [];
  motion = renderLudoBoard($('#board'), state, {
    viewer: viewer(), active: state.winner === null ? (visualTurn ?? state.turn) : -1, legal, move,
    onPick: (token) => moveToken(token),
    onStep: (n) => ludoSound.step(n),
  });
  return motion;
}

function render(move = null) {
  if (!state) return Promise.resolve();
  renderPlates();
  const drawn = renderBoard(move);
  const roll = $('#roll');
  roll.disabled = busy || currentRoll !== null || state.winner !== null || !canAct();
  roll.hidden = state.winner !== null;
  if (!busy) {
    const seat = state.lastEvent?.player ?? state.turn, value = currentRoll || state.lastRoll;
    if (value) window.BS_DICE?.set(diceOf(currentRoll ? state.turn : seat), value);
  }
  document.body.classList.toggle('ludo-quick', state.quick === true);
  document.body.classList.toggle('ludo-my-turn', canAct());
  $('#ludoQuickTag').hidden = state.quick !== true;
  if (state.winner !== null) { showWinner(); return drawn; }
  $('#winnerOverlay').classList.remove('show');
  const p = state.players[state.turn], mine = state.turn === me();
  const legal = currentRoll ? getLegalLudoMoves(state, currentRoll) : [];
  $('#status').textContent = currentRoll
    ? (mine ? (legal.length > 1 ? `طلع لك ${currentRoll} — اختر حجر من اللي يلمعون` : `طلع لك ${currentRoll} — المس الحجر اللي يلمع`) : `${p.name} طلع له ${currentRoll} ويختار…`)
    : mine ? (room?.localMode === 'pass' ? `دور ${p.name} (${colourName(state.turn)}) — ارمِ النرد` : 'دورك — المس النرد وارمِ') : `دور ${p.name}…`;
  return drawn;
}

function showWinner() {
  const s = state, w = s.winner, mine = w === me() && room?.localMode !== 'pass';
  $('#winnerName').textContent = mine ? 'فزت! 🎉' : s.players[w].name + ' فاز';
  $('#winnerWhy').textContent = s.quick ? 'أول حجر وصل الوسط في الطور السريع.' : 'دخّل الأحجار الأربعة للوسط.';
  const order = s.players.map((p, i) => ({ i, p, done: home(p), far: p.tokens.reduce((n, t) => n + Math.max(0, t + 1), 0) }))
    .sort((a, b) => (a.i === w ? -1 : b.i === w ? 1 : b.done - a.done || b.far - a.far));
  $('#winnerBoard').innerHTML = order.map((r) => `<li style="--seat:${colourOf(r.i)}"><i></i><b>${esc(r.p.name)}</b><span>${r.done}/4</span></li>`).join('');
  $('#winnerOverlay').classList.add('show');
  const again = $('#again');
  again.textContent = room?.local ? 'جولة تدريب جديدة' : room?.publicMatch ? 'مباراة جديدة' : room?.me?.role === 'host' ? 'جولة جديدة' : 'بانتظار المضيف';
  again.disabled = !room?.local && !room?.publicMatch && room?.me?.role !== 'host';
  if (!rewarded && !room?.local) {
    rewarded = true;
    if (window.BS_SOCIAL?.isLoggedIn()) (window.BS_PRO?.onlineResult ? window.BS_PRO.onlineResult(w === me()) : window.BS_CAREER?.refresh?.())?.catch?.(() => {});
    else (window.BS_PRO?.record || window.BS_CAREER?.record)?.({ id: receipt, game: 'zahra', win: w === me() });
  }
}

/* a word in the middle of the board: a capture, a stone home, a six */
function burst(text, tone = '') {
  const box = $('#ludoBurst'); if (!box) return;
  const el = document.createElement('div'); el.className = 'ludo-burst-word ' + tone; el.textContent = text;
  box.append(el); setTimeout(() => el.remove(), 1500);
}

/* ---------- playing ---------- */
async function spin(seat, value) {
  if (!value) return;
  visualTurn = seat;
  renderPlates();
  await window.BS_DICE?.roll(diceOf(seat), value);
}
function roll() {
  if (busy || currentRoll !== null || state?.winner !== null || !canAct()) return;
  busy = true; render();
  if (!(practice?.active ? practice.send('roll') : table.send('roll'))) { busy = false; render(); return; }
  if (practice?.active) return;
  clearTimeout(remoteTimer);
  remoteTimer = setTimeout(() => { busy = false; render(); window.BS_PLATFORM?.toast('تأخر اتصال الغرفة'); }, 9000);
}
$('#roll').addEventListener('click', roll);
for (const corner of CORNERS) $('#die-' + corner)?.addEventListener('click', () => { const seat = Number(document.querySelector(`.ludo-plate[data-corner="${corner}"]`)?.dataset.seat); if (seat === state?.turn) roll(); });
function moveToken(token) {
  if (busy || currentRoll === null || !canAct() || !getLegalLudoMoves(state, currentRoll).includes(token)) return;
  busy = true; render();
  window.BS_AUDIO?.play?.('select', { volume: 0.5 });
  if (!(practice?.active ? practice.send('ludo_move', { token }) : table.send('ludo_move', { token }))) { busy = false; render(); return; }
  if (practice?.active) return;
  clearTimeout(remoteTimer);
  remoteTimer = setTimeout(() => { busy = false; render(); window.BS_PLATFORM?.toast('تأخر اتصال الغرفة'); }, 9000);
}

function enterGame() {
  document.body.classList.add('game-running');
  $('#setup').classList.add('hidden');
  $('#game').classList.remove('hidden');
  $('#winnerOverlay').classList.remove('show');
  $('#livebar').classList.remove('hidden');
  window.BS_GAME_FULLSCREEN?.fit?.();
}
function showMenu() {
  $('#status').__bsClock?.clear?.();
  frameGeneration++;
  clearTimeout(remoteTimer);
  visualTurn = null; busy = false; state = null; currentRoll = null;
  $('#game').classList.add('hidden');
  $('#setup').classList.remove('hidden');
  $('#winnerOverlay').classList.remove('show');
  document.body.classList.remove('game-running', 'ludo-my-turn');
}
function net(s) {
  const e = $('#liveNet'); if (!e) return;
  e.classList.toggle('online', !!s.online); e.classList.toggle('reconnecting', !!s.reconnecting);
  e.querySelector('span').textContent = s.text || '';
}
/* A room that is not a «لودو» table belongs to the page of الزهرة. */
function elsewhere(next) {
  if (!next || next.local || isLudo(next.variant) || leaving) return false;
  leaving = true;
  location.replace('/zahra?room=' + encodeURIComponent(next.code));
  return true;
}

/* One room state (or one step of it): a throw, a move or a pass — shown, then drawn. */
async function apply(next, { animate, signal } = {}) {
  if (signal?.aborted || elsewhere(next)) return;
  const generation = ++frameGeneration;
  const valid = () => !signal?.aborted && generation === frameGeneration && state === next.state;
  clearTimeout(remoteTimer);
  room = next;
  // practice frames do not pass the room player, so the end screen learns here who won
  if (next.local) window.BS_HERO_FX?.frame?.(next);
  if (!next.state) return;
  const prev = state, prevPending = currentRoll;
  state = next.state;
  currentRoll = next.pendingRoll ?? null;
  if (!prev || (prev.rollCount || 0) > (state.rollCount || 0) || prev.players.length !== state.players.length) {
    receipt = 'board:' + next.code + ':' + (next.startedAt || next.version) + ':' + (next.me?.id || 'guest');
    rewarded = false;
  }
  if ($('#game').classList.contains('hidden')) enterGame();
  $('#gameRoomCode').textContent = next.local ? (next.localMode === 'ai' ? 'تدريب' : 'على جهاز واحد') : next.publicMatch ? 'مباراة سريعة' : next.code;
  $('#boardSeatCount').textContent = state.players.length + ' لاعبين';
  if (next.local) net({ online: true, text: 'تدريب محلي' });
  $('#roomLabel')?.classList.toggle('hidden', Boolean(next.publicMatch || next.local));
  if (animate && prev && prev.players.length === state.players.length) {
    busy = true;
    const event = state.lastEvent, moved = (state.rollCount || 0) === (prev.rollCount || 0) + 1;
    try {
      if (currentRoll !== null && currentRoll !== prevPending) {
        await spin(state.turn, currentRoll); if (!valid()) return;
        if (currentRoll === 6) { burst('6!', 'six'); ludoSound.six(); }
      } else if (moved && event?.pass) {
        await spin(event.player, event.roll); if (!valid()) return;
        if (event.player === me()) window.BS_PLATFORM?.toast(event.roll === 6 ? 'ما فيه حركة — لك رمية ثانية' : 'ما فيه حركة بهالرمية');
        await wait(320); if (!valid()) return;
      } else if (moved && event && !event.pass) {
        if (prevPending === null) { await spin(event.player, state.lastRoll); if (!valid()) return; }
        visualTurn = event.player;
        const caps = event.captured?.length || 0;
        const drawn = render({ seat: event.player, token: event.token, from: event.from, to: event.to, captured: event.captured });
        if (event.from === -1) ludoSound.out();
        await drawn; if (!valid()) return;
        ludoSound.land();
        if (caps) {
          ludoSound.capture(); window.BS_AUDIO?.vibrate?.([50, 30, 70]);
          burst('💥 أكل!', 'capture');
          window.BS_PLATFORM?.toast(event.player === me() ? '💥 أكلت حجر! لك رمية زيادة' : `💥 ${state.players[event.player].name} أكل حجر ${caps > 1 ? caps : ''}`.trim());
        } else if (event.home) { ludoSound.home(); burst('★ وصل!', 'home'); }
        await wait(caps ? 380 : 140); if (!valid()) return;
      }
    } finally { if (valid()) visualTurn = null; }
  }
  if (!valid()) return;
  busy = false;
  visualTurn = null;
  render();
  if (state.winner !== null && prev?.winner === null) (state.winner === me() || room?.localMode === 'pass' ? ludoSound.win : ludoSound.lose)();
  // 33.13.0: a soft call when it becomes your turn (once for each turn)
  else if (state.winner === null && canAct() && currentRoll === null) { const key = state.turn + ':' + (state.rollCount || 0); if (key !== lastCalled) { lastCalled = key; ludoSound.turn(); } }
}

window.BS_AUDIO?.prime?.(['move','boardLand','capture','finish','win','select','dice','diceImpact']);
const table = createTable({
  game: 'zahra', page: '/ludo', title: 'لودو',
  modes: [
    { id: 'ludo', label: 'الكلاسيك', hint: 'اللي يدخّل أحجاره الأربعة للوسط يفوز' },
    { id: 'ludo-quick', label: 'سريع ⚡', hint: 'أول واحد يوصّل حجر واحد للوسط يفوز' },
  ],
  modesLabel: 'طريقة اللعب',
  seats: [2, 3, 4, 6], seatsDefault: 6,
  lobbyNote: (r, quick) => (r?.variant === 'ludo-quick' ? '⚡ سريع: أول حجر يوصل الوسط يفوز. ' : '') + (quick ? 'تبدأ بعد العد وتكتمل المقاعد بمنافسين متنوعي المستوى.' : 'أرسل الرمز لأصحابك. تبدأ بمن حضر، وتكتمل الطاولة تلقائيًا.'),
  apply,
  onLobby: (next) => { if (!elsewhere(next)) showMenu(); },
  onMenu: showMenu,
  onStatus: net,
  onError: (m) => { clearTimeout(remoteTimer); busy = false; render(); window.BS_AUDIO?.play?.('error'); window.BS_PLATFORM?.toast(m); },
});

let leaveArmed = 0;
$('#leaveGame').onclick = () => {
  if (room?.status === 'playing' && !room.local && Date.now() - leaveArmed > 2500) { leaveArmed = Date.now(); window.BS_PLATFORM?.toast('اضغط «خروج» مرة ثانية لترك المباراة'); return; }
  leaveCurrent();
};
function leaveCurrent() { practice?.leave(); table.leave(); room = null; }
function startPractice() {
  leaveCurrent();
  practice ||= createZahraPractice({ onFrame: apply, onError: (message) => { busy = false; render(); window.BS_PLATFORM?.toast(message); } });
  const profile = window.BS_CAREER?.get?.() || {};
  return practice.start({ mode: $('#practiceMode').value, count: Number($('#practiceCount').value), quick: $('#practiceSpeed').value === 'quick', layout: 'classic', name: profile.name || table.menu.name() || 'أنت', look: profile.equipped || {} });
}
$('#practiceStart').onclick = startPractice;
$('#again').onclick = () => (practice?.active ? startPractice() : table.again());
$('#toMenu').onclick = leaveCurrent;
window.addEventListener('pagehide', () => practice?.leave());
window.addEventListener('bs-career-change', () => { if (state && !busy) render(); });
document.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && e.target === document.body && canAct() && currentRoll === null) { e.preventDefault(); roll(); } });

// the picture on the menu: the board as it looks to the yellow player, with a game under way
(() => {
  const art = $('#ludoHeroArt'); if (!art) return;
  const sample = {layout:'classic',turn:0,winner:null,players:['فهد','نورة','سارة','ماجد','خالد','ريم'].map((name,k)=>({name,tokens:[k*3,-1,-1,-1]}))};
  renderLudoBoard(art, sample, { viewer: 3, active: 3 });
})();

window.BS_TABLE = Object.freeze({
  get active() { return Boolean(state); },
  get mode() { return practice?.active ? (room?.localMode === 'pass' ? 'local' : 'ai') : 'online'; },
  get bots() { return (room?.players || []).filter((p) => p.bot).map((p) => p.index); },
  get players() { return (state?.players || []).map((p, i) => ({ index: i, name: String(p?.name || 'لاعب ' + (i + 1)) })); },
});
