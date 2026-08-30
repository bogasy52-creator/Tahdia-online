import {
  createJackarooGame,
  getJackarooActions,
  playJackarooAction,
  globalJackarooPosition,
  cardRank,
} from '../engines/jackaroo-engine.js';
import { BoardRoomClient } from '../online/room-client.js';
import { copyRoomCode, normalizeRoomCode } from '../online/room-lobby.js';

const $ = (selector) => document.querySelector(selector);
const COLORS = ['#8b5cf6', '#22d3ee', '#e5aa3b', '#22c55e'];
const SUITS = { S: '♠', H: '♥', D: '♦', C: '♣' };
let mode = null;
let localState = null;
let onlineState = null;
let client = null;
let connected = false;
let selectedCard = null;
let selectedSource = null;
let splitStage = null;
let pendingOnlineEvent = null;
let busy = false;
const targetMap = new Map();

function showOnly(id) {
  for (const el of ['homeScreen', 'localSetup', 'onlineSetup', 'game'].map((x) => $('#' + x))) el?.classList.add('hidden');
  $('#' + id)?.classList.remove('hidden');
}

function stateForDisplay() {
  return mode === 'online' ? onlineState?.game : localState;
}

function viewerSeat() {
  return mode === 'online' ? onlineState?.me?.seat : localState?.turn;
}

function getHand() {
  if (mode === 'online') return onlineState?.game?.hand || [];
  return localState?.hands?.[localState.turn] || [];
}

function engineStateForActions() {
  if (mode === 'local') return localState;
  const game = onlineState?.game;
  const seat = onlineState?.me?.seat;
  if (!game || !Number.isInteger(seat)) return null;
  const hands = [[], [], [], []];
  hands[seat] = [...(game.hand || [])];
  return {
    players: game.players.map((p) => ({ ...p, marbles: [...p.marbles] })),
    hands,
    deck: [],
    discard: [],
    dealer: game.dealer,
    dealIndex: game.dealIndex,
    turn: game.turn,
    played: game.played,
    winnerTeam: game.winnerTeam,
    lastEvent: game.lastEvent,
  };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function getNames() {
  return [0, 1, 2, 3].map((i) => $('#n' + i).value.trim() || `لاعب ${i + 1}`);
}

function posPct(global, radius = 43.5) {
  const angle = (-90 + global * 360 / 52) * Math.PI / 180;
  return { x: 50 + radius * Math.cos(angle), y: 50 + radius * Math.sin(angle) };
}

function buildBoard() {
  const board = $('#jackBoard');
  board.querySelectorAll('.track-hole,.safe-hole,.home-zone,.completed-tray').forEach((x) => x.remove());
  for (let i = 0; i < 52; i++) {
    const p = posPct(i);
    const hole = document.createElement('div');
    hole.className = 'track-hole' + ([0, 13, 26, 39].includes(i) ? ' start' : '');
    hole.dataset.track = i;
    hole.style.left = p.x + '%';
    hole.style.top = p.y + '%';
    const owner = [0, 13, 26, 39].indexOf(i);
    if (owner >= 0) hole.style.setProperty('--seat', COLORS[owner]);
    board.appendChild(hole);
  }
  for (let player = 0; player < 4; player++) {
    const angle = (-90 + player * 90) * Math.PI / 180;
    for (let j = 0; j < 4; j++) {
      const r = 31 - j * 5.6;
      const hole = document.createElement('div');
      hole.className = 'safe-hole';
      hole.dataset.safe = `${player}:${j}`;
      hole.style.left = (50 + r * Math.cos(angle)) + '%';
      hole.style.top = (50 + r * Math.sin(angle)) + '%';
      hole.style.setProperty('--seat', COLORS[player]);
      board.appendChild(hole);
    }
    buildHomeZone(board, player);
    const tray = document.createElement('div');
    tray.className = 'completed-tray';
    tray.dataset.completed = player;
    tray.style.left = `${50 + 12 * Math.cos(angle)}%`;
    tray.style.top = `${50 + 12 * Math.sin(angle)}%`;
    tray.style.setProperty('--seat', COLORS[player]);
    board.appendChild(tray);
  }
  board.onclick = boardClick;
}

function buildHomeZone(board, player) {
  const centers = [
    { x: 74, y: 26 }, { x: 74, y: 74 }, { x: 26, y: 74 }, { x: 26, y: 26 },
  ];
  const c = centers[player];
  const zone = document.createElement('div');
  zone.className = 'home-zone';
  zone.dataset.homeZone = player;
  zone.style.left = c.x + '%';
  zone.style.top = c.y + '%';
  zone.style.setProperty('--seat', COLORS[player]);
  zone.innerHTML = `<span class="home-label">P${player + 1}</span>`;
  const positions = [{ x: 34, y: 39 }, { x: 66, y: 39 }, { x: 34, y: 70 }, { x: 66, y: 70 }];
  positions.forEach((pos, marble) => {
    const hole = document.createElement('div');
    hole.className = 'home-hole';
    hole.dataset.home = `${player}:${marble}`;
    hole.style.left = pos.x + '%';
    hole.style.top = pos.y + '%';
    zone.appendChild(hole);
  });
  board.appendChild(zone);
}

function marble(player, marbleIndex) {
  const piece = document.createElement('span');
  piece.className = 'jack-marble';
  piece.dataset.owner = player;
  piece.dataset.marble = marbleIndex;
  piece.style.setProperty('--seat', COLORS[player]);
  piece.textContent = marbleIndex + 1;
  return piece;
}

function renderPieces(state = stateForDisplay()) {
  if (!state) return;
  document.querySelectorAll('.track-hole,.safe-hole,.home-hole,.completed-tray').forEach((node) => { node.innerHTML = ''; });
  state.players.forEach((player, pi) => {
    let completed = 0;
    player.marbles.forEach((progress, mi) => {
      if (progress === -1) {
        document.querySelector(`.home-hole[data-home="${pi}:${mi}"]`)?.appendChild(marble(pi, mi));
      } else if (progress >= 0 && progress <= 51) {
        const global = globalJackarooPosition(pi, progress);
        document.querySelector(`.track-hole[data-track="${global}"]`)?.appendChild(marble(pi, mi));
      } else if (progress >= 52 && progress <= 55) {
        document.querySelector(`.safe-hole[data-safe="${pi}:${progress - 52}"]`)?.appendChild(marble(pi, mi));
      } else if (progress === 56) completed += 1;
    });
    const tray = document.querySelector(`[data-completed="${pi}"]`);
    if (tray) {
      for (let i = 0; i < completed; i++) {
        const dot = document.createElement('i');
        dot.className = 'completed-dot';
        dot.style.setProperty('--seat', COLORS[pi]);
        tray.appendChild(dot);
      }
    }
  });
}

function renderTeams(state = stateForDisplay()) {
  if (!state) return;
  [[0, 2], [1, 3]].forEach((members, team) => {
    const done = members.flatMap((i) => state.players[i].marbles).filter((value) => value === 56).length;
    const el = $('#team' + team);
    el.innerHTML = `<b>الفريق ${team + 1}</b><span>${escapeHtml(state.players[members[0]].name)} + ${escapeHtml(state.players[members[1]].name)}</span><span>${done}/8 مكتملة</span>`;
    el.classList.toggle('leading', done >= 4);
  });
}

function renderPlayers(state = stateForDisplay()) {
  const box = $('#players');
  box.innerHTML = '';
  if (!state) return;
  state.players.forEach((player, index) => {
    const done = player.marbles.filter((x) => x === 56).length;
    const home = player.marbles.filter((x) => x === -1).length;
    const row = document.createElement('div');
    row.className = 'board-player' + (state.turn === index && state.winnerTeam === null ? ' current' : '');
    const onlineMeta = mode === 'online' ? onlineState?.players[index] : null;
    const cardCount = mode === 'online' ? `<small class="opponent-cards">${onlineState?.game?.handCounts?.[index] ?? 0} ورقة</small>` : '';
    row.innerHTML = `<i class="seat-dot" style="--seat:${COLORS[index]}"></i><div><b>${escapeHtml(player.name)}</b><small>${home} بالبداية · ${done}/4 مكتملة${onlineMeta ? ` · ${onlineMeta.connected ? 'متصل' : 'غير متصل'}` : ''}</small>${cardCount}</div><span class="position">${player.marbles.filter((x) => x >= 0 && x < 56).length}</span>`;
    box.appendChild(row);
  });
}

function cardFace(card, index, enabled) {
  const rank = cardRank(card), suitCode = String(card).slice(-1), red = suitCode === 'H' || suitCode === 'D';
  const button = document.createElement('button');
  const count = Math.max(1, getHand().length);
  const center = (count - 1) / 2;
  button.className = `playing-card${red ? ' red' : ''}${selectedCard === index ? ' selected' : ''}`;
  button.style.setProperty('--angle', `${(index - center) * 5.5}deg`);
  button.style.setProperty('--z', String(index + 1));
  button.disabled = !enabled;
  button.innerHTML = `<span class="rank">${rank}</span><span class="mini-rank">${rank}${SUITS[suitCode] || ''}</span><span class="suit">${SUITS[suitCode] || '◆'}</span>`;
  button.onclick = () => selectCard(index);
  return button;
}

function canAct() {
  const state = stateForDisplay();
  if (!state || state.winnerTeam !== null || busy) return false;
  if (mode === 'local') return true;
  return connected && onlineState?.status === 'playing' && onlineState?.me?.seat === state.turn;
}

function renderHand() {
  const hand = getHand();
  const box = $('#hand');
  box.innerHTML = '';
  hand.forEach((card, index) => box.appendChild(cardFace(card, index, canAct())));
  const state = stateForDisplay();
  if (mode === 'online' && state && onlineState?.me?.seat !== state.turn) $('#handHint').textContent = `بانتظار ${state.players[state.turn].name}`;
  else $('#handHint').textContent = `${hand.length} ورقة`;
}

function renderStatus(state = stateForDisplay()) {
  if (!state) return;
  if (state.winnerTeam !== null) {
    const members = state.winnerTeam === 0 ? [0, 2] : [1, 3];
    $('#status').textContent = `فاز ${state.players[members[0]].name} و${state.players[members[1]].name}`;
  } else if (mode === 'online' && onlineState?.me?.seat !== state.turn) {
    $('#status').textContent = `الدور: ${state.players[state.turn].name}. يمكنك رؤية أوراقك لكن الحركة لصاحب الدور فقط.`;
  } else {
    $('#status').textContent = `الدور: ${state.players[state.turn].name}. اختر ورقة ثم الحجر والخانة.`;
  }
}

function render(state = stateForDisplay()) {
  if (!state) return;
  renderPieces(state);
  renderTeams(state);
  renderPlayers(state);
  $('#deckCount').textContent = mode === 'online' ? `الرزمة: ${state.deckCount}` : `الرزمة: ${state.deck.length}`;
  $('#dealText').textContent = `دورة التوزيع: ${['4', '4', '5'][state.dealIndex]}`;
  renderStatus(state);
  renderHand();
  clearSelection(false);
  if (state.winnerTeam !== null) showWinner(state.winnerTeam, state);
}

function clearHighlights() {
  document.querySelectorAll('.legal-source,.selected-source,.legal-target-piece').forEach((el) => el.classList.remove('legal-source', 'selected-source', 'legal-target-piece'));
  document.querySelectorAll('.legal-target').forEach((el) => el.classList.remove('legal-target'));
  targetMap.clear();
}

function clearSelection(updateHand = true) {
  selectedCard = null;
  selectedSource = null;
  splitStage = null;
  clearHighlights();
  $('#discardBtn').classList.add('hidden');
  $('#moveHint').textContent = canAct() ? 'اختر ورقة لعرض الأحجار القانونية على اللوحة.' : 'بانتظار دورك.';
  if (updateHand) renderHand();
}

function sourceKey(owner, marbleIndex) { return `${owner}:${marbleIndex}`; }
function actionSource(action) {
  if (action.type === 'enter' || action.type === 'move' || action.type === 'moveAny5' || action.type === 'swap') return sourceKey(action.owner, action.marble);
  if (action.type === 'split7') return sourceKey(action.owner, action.first.marble);
  return null;
}

function sourceElement(owner, marbleIndex) {
  return document.querySelector(`.jack-marble[data-owner="${owner}"][data-marble="${marbleIndex}"]`);
}

function targetElementForProgress(state, owner, progress) {
  if (progress >= 0 && progress <= 51) return document.querySelector(`.track-hole[data-track="${globalJackarooPosition(owner, progress)}"]`);
  if (progress >= 52 && progress <= 55) return document.querySelector(`.safe-hole[data-safe="${owner}:${progress - 52}"]`);
  return null;
}

function progressAfter(state, owner, marbleIndex, steps, backward = false) {
  const from = state.players[owner].marbles[marbleIndex];
  if (backward) return from - steps >= 0 ? from - steps : 52 + (from - steps);
  return from + steps;
}

function selectCard(index) {
  if (!canAct()) return;
  selectedCard = index;
  selectedSource = null;
  splitStage = null;
  clearHighlights();
  BS_AUDIO.play('card');
  renderHand();
  const engineState = engineStateForActions();
  const actions = getJackarooActions(engineState, index, engineState.turn);
  if (actions.length === 1 && actions[0].type === 'discard') {
    $('#moveHint').textContent = 'لا توجد حركة قانونية لهذه الورقة.';
    $('#discardBtn').classList.remove('hidden');
    $('#discardBtn').onclick = () => commitAction(actions[0]);
    return;
  }
  $('#discardBtn').classList.add('hidden');
  const sources = new Set(actions.map(actionSource).filter(Boolean));
  for (const key of sources) {
    const [owner, marbleIndex] = key.split(':').map(Number);
    sourceElement(owner, marbleIndex)?.classList.add('legal-source');
  }
  $('#moveHint').textContent = 'الأحجار المضيئة هي الأحجار القانونية لهذه الورقة. اختر حجرًا.';
}

function boardClick(event) {
  const piece = event.target.closest('.jack-marble');
  if (piece) {
    handlePieceClick(Number(piece.dataset.owner), Number(piece.dataset.marble));
    return;
  }
  const hole = event.target.closest('.track-hole,.safe-hole');
  if (hole && hole.classList.contains('legal-target')) {
    const actions = targetMap.get(hole) || [];
    handleTargetActions(actions);
  }
}

function currentActions() {
  const engineState = engineStateForActions();
  if (selectedCard === null || !engineState) return [];
  return getJackarooActions(engineState, selectedCard, engineState.turn);
}

function handlePieceClick(owner, marbleIndex) {
  if (selectedCard === null || !canAct()) return;
  if (splitStage?.phase === 'second-source') {
    const candidates = splitStage.actions.filter((a) => a.second.marble === marbleIndex && a.owner === owner);
    if (!candidates.length) return;
    clearHighlights();
    sourceElement(owner, marbleIndex)?.classList.add('selected-source');
    splitStage = { phase: 'second-target', actions: candidates };
    markTargets(candidates, 'second');
    $('#moveHint').textContent = 'اختر خانة الحجر الثاني لإكمال مجموع 7.';
    return;
  }
  if (selectedSource) {
    const swaps = selectedSource.actions.filter((a) => a.type === 'swap' && a.otherOwner === owner && a.otherMarble === marbleIndex);
    if (swaps.length) return commitAction(swaps[0]);
    return;
  }
  const actions = currentActions().filter((action) => actionSource(action) === sourceKey(owner, marbleIndex));
  if (!actions.length) return;
  clearHighlights();
  sourceElement(owner, marbleIndex)?.classList.add('selected-source');
  selectedSource = { owner, marble: marbleIndex, actions };
  const enter = actions.find((a) => a.type === 'enter');
  if (enter) {
    $('#moveHint').textContent = 'إخراج الحجر إلى خانة البداية.';
    return commitAction(enter);
  }
  if (actions.some((a) => a.type === 'swap')) {
    for (const action of actions.filter((a) => a.type === 'swap')) sourceElement(action.otherOwner, action.otherMarble)?.classList.add('legal-target-piece');
    $('#moveHint').textContent = 'اختر الحجر الذي تريد التبديل معه.';
    return;
  }
  markTargets(actions, actions[0]?.type === 'split7' ? 'first' : 'single');
  $('#moveHint').textContent = actions[0]?.type === 'split7' ? 'اختر خانة الحركة الأولى من تقسيم 7.' : 'اختر الخانة المضيئة.';
}

function markTargets(actions, phase) {
  const state = engineStateForActions();
  for (const action of actions) {
    let owner, marbleIndex, steps, backward = false;
    if (action.type === 'split7') {
      const part = phase === 'second' ? action.second : action.first;
      owner = action.owner; marbleIndex = part.marble; steps = part.steps;
    } else {
      owner = action.owner; marbleIndex = action.marble; steps = action.steps; backward = Boolean(action.backward);
    }
    const progress = progressAfter(state, owner, marbleIndex, steps, backward);
    const target = targetElementForProgress(state, owner, progress);
    if (!target) continue;
    target.classList.add('legal-target');
    const list = targetMap.get(target) || [];
    list.push(action);
    targetMap.set(target, list);
  }
}

function handleTargetActions(actions) {
  if (!actions.length) return;
  if (actions[0].type === 'split7' && (!splitStage || splitStage.phase !== 'second-target')) {
    clearHighlights();
    splitStage = { phase: 'second-source', actions };
    const seen = new Set();
    for (const action of actions) {
      const key = sourceKey(action.owner, action.second.marble);
      if (seen.has(key)) continue;
      seen.add(key);
      sourceElement(action.owner, action.second.marble)?.classList.add('legal-source');
    }
    $('#moveHint').textContent = 'اختر الحجر الثاني لتكملة تقسيم 7.';
    return;
  }
  return commitAction(actions[0]);
}

function elementCenter(el) {
  const wrap = $('#boardWrap').getBoundingClientRect();
  const rect = el.getBoundingClientRect();
  return { x: rect.left - wrap.left + rect.width / 2, y: rect.top - wrap.top + rect.height / 2 };
}

function progressElement(state, owner, progress, marbleIndex = null) {
  if (progress === -1 && marbleIndex !== null) return document.querySelector(`.home-hole[data-home="${owner}:${marbleIndex}"]`);
  if (progress >= 0 && progress <= 51) return document.querySelector(`.track-hole[data-track="${globalJackarooPosition(owner, progress)}"]`);
  if (progress >= 52 && progress <= 55) return document.querySelector(`.safe-hole[data-safe="${owner}:${progress - 52}"]`);
  return document.querySelector(`[data-completed="${owner}"]`);
}

function animateGhost(owner, marbleIndex, fromProgress, toProgress) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
  const state = stateForDisplay();
  const fromEl = progressElement(state, owner, fromProgress, marbleIndex);
  const toEl = progressElement(state, owner, toProgress, marbleIndex);
  if (!fromEl || !toEl) return Promise.resolve();
  const a = elementCenter(fromEl), b = elementCenter(toEl);
  const ghost = document.createElement('span');
  ghost.className = 'moving-jack-marble';
  ghost.style.setProperty('--seat', COLORS[owner]);
  ghost.textContent = marbleIndex + 1;
  $('#motionLayer').appendChild(ghost);
  return new Promise((resolve) => {
    const start = performance.now(), duration = 360;
    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      ghost.style.left = `${a.x + (b.x - a.x) * eased}px`;
      ghost.style.top = `${a.y + (b.y - a.y) * eased}px`;
      ghost.style.transform = `translate(-50%,-50%) scale(${1 + Math.sin(Math.PI * t) * .18})`;
      if (t < 1) requestAnimationFrame(frame);
      else { ghost.remove(); resolve(); }
    }
    requestAnimationFrame(frame);
  });
}

async function animateJackEvent(prev, next, event) {
  const detail = event?.detail || event;
  if (!detail) return;
  if (detail.type === 'move' && detail.move) {
    const action = detail.action;
    await animateGhost(action.owner, action.marble, detail.move.from, detail.move.to);
  } else if (detail.type === 'moveAny5' && detail.move) {
    const action = detail.action;
    await animateGhost(action.owner, action.marble, detail.move.from, detail.move.to);
  } else if (detail.type === 'split7') {
    const action = detail.action;
    if (detail.first) await animateGhost(action.owner, action.first.marble, detail.first.from, detail.first.to);
    if (detail.second) await animateGhost(action.owner, action.second.marble, detail.second.from, detail.second.to);
  } else if (detail.type === 'swap') {
    $('#jackBoard').classList.remove('jack-impact'); void $('#jackBoard').offsetWidth; $('#jackBoard').classList.add('jack-impact');
    await new Promise((resolve) => setTimeout(resolve, 220));
  }
  const captured = detail.captured || detail.move?.captured || detail.first?.captured || detail.second?.captured;
  if (Array.isArray(captured) && captured.length) {
    BS_AUDIO.play('duel');
    BS_AUDIO.vibrate([45, 30, 55]);
    $('#jackBoard').classList.remove('jack-impact'); void $('#jackBoard').offsetWidth; $('#jackBoard').classList.add('jack-impact');
  }
  if (next?.players?.some((p) => p.marbles.some((m) => m >= 52))) {
    $('#jackBoard').classList.remove('safe-glow'); void $('#jackBoard').offsetWidth; $('#jackBoard').classList.add('safe-glow');
  }
}

async function commitAction(action) {
  if (selectedCard === null || busy) return;
  busy = true;
  const cardIndex = selectedCard;
  clearHighlights();
  $('#discardBtn').classList.add('hidden');
  if (mode === 'online') {
    $('#moveHint').textContent = 'السيرفر يتحقق من الحركة...';
    client?.playCard(cardIndex, action);
    setTimeout(() => { busy = false; renderHand(); }, 1500);
    return;
  }
  const prev = structuredClone(localState);
  try {
    const next = playJackarooAction(localState, cardIndex, action, localState.turn);
    await animateJackEvent(prev, next, next.lastEvent);
    localState = next;
    BS_AUDIO.play(action.type === 'discard' ? 'wrong' : action.type === 'swap' ? 'duel' : 'move');
    selectedCard = null;
    selectedSource = null;
    splitStage = null;
    busy = false;
    render();
    if (localState.winnerTeam === null) setTimeout(showPrivacy, 180);
  } catch {
    busy = false;
    BS_AUDIO.play('error');
    BS_PLATFORM.toast('هذه الحركة لم تعد صالحة');
    render();
  }
}

function startLocal() {
  mode = 'local';
  localState = createJackarooGame(getNames());
  onlineState = null;
  selectedCard = null;
  busy = false;
  buildBoard();
  showOnly('game');
  $('#modeLabel').textContent = 'محلي';
  $('#restartLocal').classList.remove('hidden');
  $('#rematchBtn').classList.add('hidden');
  $('#winnerOverlay').classList.remove('show');
  render();
  BS_AUDIO.play('launch');
  showPrivacy();
}

function showPrivacy() {
  if (mode !== 'local' || !localState || localState.winnerTeam !== null) return;
  clearSelection();
  $('#privacyName').textContent = `دور ${localState.players[localState.turn].name}`;
  $('#privacy').classList.add('show');
}

function setupClient() {
  client?.close();
  client = new BoardRoomClient('jackaroo');
  client.addEventListener('connection', (e) => {
    const status = e.detail.status;
    connected = status === 'connected';
    const el = $('#connectionStatus');
    el.className = `connection-pill ${status}`;
    const labels = { connecting: 'جاري الاتصال', connected: 'متصل', reconnecting: 'إعادة اتصال', disconnected: 'انقطع الاتصال', error: 'مشكلة اتصال' };
    el.textContent = labels[status] || status;
    renderHand();
  });
  client.addEventListener('servererror', (e) => {
    busy = false;
    BS_AUDIO.play('error');
    BS_PLATFORM.toast(e.detail.message);
    renderHand();
  });
  client.addEventListener('gameevent', (e) => { pendingOnlineEvent = e.detail.event || null; });
  client.addEventListener('state', async (e) => {
    const prev = onlineState;
    onlineState = e.detail.state;
    renderOnlineLobby();
    if (onlineState?.status === 'playing' || onlineState?.status === 'finished') {
      if ($('#game').classList.contains('hidden')) {
        buildBoard();
        showOnly('game');
        $('#modeLabel').textContent = 'أونلاين';
        $('#restartLocal').classList.add('hidden');
      }
      if (prev?.game && onlineState.game && pendingOnlineEvent?.type === 'play_card') {
        const event = pendingOnlineEvent;
        pendingOnlineEvent = null;
        await animateJackEvent(prev.game, onlineState.game, event);
      }
      busy = false;
      selectedCard = null;
      selectedSource = null;
      splitStage = null;
      render();
      $('#rematchBtn').classList.toggle('hidden', onlineState.status !== 'finished' || onlineState.me?.role !== 'host');
    } else if (onlineState?.status === 'lobby') {
      showOnly('onlineSetup');
      $('#onlineEntry').classList.add('hidden');
      $('#onlineLobby').classList.remove('hidden');
    }
  });
}

function renderOnlineLobby() {
  if (!onlineState) return;
  $('#roomCodeDisplay').textContent = onlineState.code || client?.code || '------';
  const box = $('#lobbyPlayers'); box.innerHTML = '';
  onlineState.players.forEach((player, index) => {
    const row = document.createElement('div'); row.className = 'lobby-player';
    row.innerHTML = `<i class="seat-dot" style="--seat:${COLORS[index]}"></i><div><b>${escapeHtml(player.name)}</b><small>${player.connected ? 'متصل' : 'غير متصل'}${player.role === 'host' ? ' · مضيف' : ''} · فريق ${index % 2 + 1}</small></div><span class="ready-mark ${player.ready ? 'yes' : ''}">${player.ready ? 'جاهز' : 'غير جاهز'}</span>`;
    box.appendChild(row);
  });
  const me = onlineState.players.find((p) => p.id === onlineState.me?.id);
  $('#readyBtn').textContent = me?.ready ? 'إلغاء الجاهزية' : 'أنا جاهز';
  $('#readyBtn').onclick = () => client?.setReady(!me?.ready);
  const host = onlineState.me?.role === 'host';
  $('#startOnlineBtn').classList.toggle('hidden', !host);
  $('#startOnlineBtn').disabled = onlineState.players.length !== 4 || !onlineState.players.every((p) => p.ready);
}

async function createOnlineRoom() {
  try {
    setupClient();
    const name = $('#onlineName').value.trim() || 'لاعب';
    const data = await client.createRoom(name);
    $('#roomCode').value = data.code;
    $('#onlineEntry').classList.add('hidden');
    $('#onlineLobby').classList.remove('hidden');
    client.connect({ code: data.code, name, token: data.token, hostKey: data.hostKey, reuseSaved: false });
  } catch (error) { BS_PLATFORM.toast(error.message || 'تعذر إنشاء الغرفة'); }
}

async function joinOnlineRoom() {
  try {
    setupClient();
    const name = $('#onlineName').value.trim() || 'لاعب';
    const code = normalizeRoomCode($('#roomCode').value);
    $('#roomCode').value = code;
    await client.roomStatus(code);
    $('#onlineEntry').classList.add('hidden');
    $('#onlineLobby').classList.remove('hidden');
    client.connect({ code, name });
  } catch (error) { BS_PLATFORM.toast(error.message || 'تعذر دخول الغرفة'); }
}

function showWinner(team, state = stateForDisplay()) {
  const members = team === 0 ? [0, 2] : [1, 3];
  $('#winnerName').textContent = `${state.players[members[0]].name} + ${state.players[members[1]].name}`;
  $('#winnerOverlay').classList.add('show');
  BS_AUDIO.play('win');
  BS_AUDIO.vibrate([110, 55, 110, 55, 220]);
}

function goMenu() {
  client?.close(); client = null; connected = false;
  mode = null; localState = null; onlineState = null; pendingOnlineEvent = null; busy = false;
  selectedCard = null; selectedSource = null; splitStage = null;
  $('#privacy').classList.remove('show'); $('#winnerOverlay').classList.remove('show');
  $('#onlineEntry').classList.remove('hidden'); $('#onlineLobby').classList.add('hidden');
  showOnly('homeScreen');
}

$('#localModeBtn').onclick = () => showOnly('localSetup');
$('#onlineModeBtn').onclick = () => showOnly('onlineSetup');
document.querySelectorAll('[data-back-menu]').forEach((button) => { button.onclick = goMenu; });
$('#startLocalBtn').onclick = startLocal;
$('#restartLocal').onclick = () => { if (mode === 'local') startLocal(); };
$('#leaveGame').onclick = goMenu;
$('#revealHand').onclick = () => { $('#privacy').classList.remove('show'); BS_AUDIO.play('card'); render(); };
$('#createRoomBtn').onclick = createOnlineRoom;
$('#joinRoomBtn').onclick = joinOnlineRoom;
$('#copyRoomBtn').onclick = async () => BS_PLATFORM.toast(await copyRoomCode(client?.code || onlineState?.code) ? 'تم نسخ الكود' : 'تعذر نسخ الكود');
$('#startOnlineBtn').onclick = () => client?.startMatch();
$('#rematchBtn').onclick = () => client?.rematch();
$('#rulesBtn').onclick = () => $('#rulesModal').classList.add('open');
$('#closeRulesBtn').onclick = () => $('#rulesModal').classList.remove('open');
$('#rulesModal').onclick = (event) => { if (event.target === $('#rulesModal')) $('#rulesModal').classList.remove('open'); };
$('#winnerAgainBtn').onclick = () => {
  $('#winnerOverlay').classList.remove('show');
  if (mode === 'local') startLocal();
  else if (onlineState?.me?.role === 'host') client?.rematch();
};
$('#winnerMenuBtn').onclick = goMenu;
$('#roomCode').addEventListener('input', (event) => { event.target.value = normalizeRoomCode(event.target.value); });
showOnly('homeScreen');
