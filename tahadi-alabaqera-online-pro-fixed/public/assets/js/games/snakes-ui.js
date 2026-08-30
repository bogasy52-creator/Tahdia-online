import { createSnakesGame, playSnakesRoll, DEFAULT_SNAKES_JUMPS } from '../engines/snakes-engine.js';
import { BoardRoomClient } from '../online/room-client.js';
import { copyRoomCode, normalizeRoomCode } from '../online/room-lobby.js';

const $ = (selector) => document.querySelector(selector);
const COLORS = ['#8b5cf6', '#22d3ee', '#e5aa3b', '#22c55e'];
const SVG_NS = 'http://www.w3.org/2000/svg';
let mode = null;
let localState = null;
let onlineState = null;
let client = null;
let busy = false;
let pendingOnlineEvent = null;
let connected = false;

function currentState() {
  return mode === 'online' ? onlineState?.game : localState;
}

function showOnly(id) {
  for (const el of ['homeScreen', 'localSetup', 'onlineSetup', 'game'].map((x) => $('#' + x))) el?.classList.add('hidden');
  $('#' + id)?.classList.remove('hidden');
}

function cleanNames() {
  const count = Number($('#playerCount').value);
  return Array.from({ length: count }, (_, i) => $('#n' + i).value.trim() || `لاعب ${i + 1}`);
}

function randomRoll() {
  const value = crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
  return Math.floor(value * 6) + 1;
}

function boardPoint(n) {
  const zero = n - 1;
  const rowFromBottom = Math.floor(zero / 10);
  const inRow = zero % 10;
  const col = rowFromBottom % 2 === 0 ? inRow : 9 - inRow;
  return { x: col * 100 + 50, y: (9 - rowFromBottom) * 100 + 50 };
}

function svgEl(name, attrs = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

function buildBoard() {
  const board = $('#board');
  board.innerHTML = '';
  for (let r = 9; r >= 0; r--) {
    const row = Array.from({ length: 10 }, (_, i) => r * 10 + i + 1);
    if (r % 2 === 1) row.reverse();
    for (const n of row) {
      const cell = document.createElement('div');
      cell.className = 'snake-cell';
      cell.dataset.n = n;
      cell.innerHTML = `<b>${n}</b><div class="snake-token-stack"></div>`;
      board.appendChild(cell);
    }
  }
  drawJumps();
}

function drawJumps() {
  const svg = $('#jumpOverlay');
  svg.innerHTML = '';
  const defs = svgEl('defs');
  const snakePalette = [
    ['#4d7e3e', '#b9d66d'], ['#8b3a35', '#d9935d'], ['#285f69', '#66c8c5'], ['#684085', '#b476c8'],
    ['#7c5d27', '#dfbd5c'], ['#38556f', '#77a9d2'], ['#6f343e', '#d86f7c'], ['#496b2b', '#9cbf52'],
  ];
  snakePalette.forEach((pair, index) => {
    const grad = svgEl('linearGradient', { id: `snakeGrad${index}`, x1: '0', y1: '0', x2: '1', y2: '1' });
    grad.append(svgEl('stop', { offset: '0%', 'stop-color': pair[0] }));
    grad.append(svgEl('stop', { offset: '50%', 'stop-color': pair[1] }));
    grad.append(svgEl('stop', { offset: '100%', 'stop-color': pair[0] }));
    defs.append(grad);
  });
  svg.append(defs);
  let snakeIndex = 0;
  let ladderIndex = 0;
  for (const [fromRaw, to] of Object.entries(DEFAULT_SNAKES_JUMPS)) {
    const from = Number(fromRaw);
    if (to > from) drawLadder(svg, from, to, ladderIndex++);
    else drawSnake(svg, from, to, snakeIndex++);
  }
}

function drawLadder(svg, from, to, index) {
  const a = boardPoint(from), b = boardPoint(to);
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  const px = -dy / len * 16, py = dx / len * 16;
  const group = svgEl('g', { class: 'ladder', 'data-from': from, 'data-to': to });
  for (const sign of [-1, 1]) {
    group.append(svgEl('line', { class: 'ladder-rail', x1: a.x + px * sign, y1: a.y + py * sign, x2: b.x + px * sign, y2: b.y + py * sign }));
    group.append(svgEl('line', { class: 'ladder-highlight', x1: a.x + px * sign - 2, y1: a.y + py * sign - 2, x2: b.x + px * sign - 2, y2: b.y + py * sign - 2 }));
  }
  const rungCount = Math.max(4, Math.round(len / 70));
  for (let i = 1; i < rungCount; i++) {
    const t = i / rungCount;
    const cx = a.x + dx * t, cy = a.y + dy * t;
    group.append(svgEl('line', { class: 'ladder-rung', x1: cx - px, y1: cy - py, x2: cx + px, y2: cy + py }));
  }
  svg.append(group);
}

function drawSnake(svg, from, to, index) {
  const a = boardPoint(from), b = boardPoint(to);
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  const px = -dy / len, py = dx / len;
  const bend = 80 + (index % 3) * 18;
  const sign = index % 2 === 0 ? 1 : -1;
  const c1 = { x: a.x + dx * .28 + px * bend * sign, y: a.y + dy * .28 + py * bend * sign };
  const c2 = { x: a.x + dx * .7 - px * bend * .7 * sign, y: a.y + dy * .7 - py * bend * .7 * sign };
  const pathData = `M ${a.x} ${a.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${b.x} ${b.y}`;
  const group = svgEl('g', { 'data-from': from, 'data-to': to });
  group.append(svgEl('path', { class: 'snake-body', d: pathData, stroke: `url(#snakeGrad${index % 8})`, 'stroke-width': 30 }));
  group.append(svgEl('path', { class: 'snake-shine', d: pathData }));
  const angle = Math.atan2(c1.y - a.y, c1.x - a.x) * 180 / Math.PI;
  const head = svgEl('g', { transform: `translate(${a.x} ${a.y}) rotate(${angle})` });
  head.append(svgEl('ellipse', { cx: 0, cy: 0, rx: 25, ry: 19, fill: snakePaletteColor(index) }));
  head.append(svgEl('circle', { class: 'snake-eye', cx: 8, cy: -8, r: 7 }));
  head.append(svgEl('circle', { class: 'snake-eye', cx: 8, cy: 8, r: 7 }));
  head.append(svgEl('circle', { class: 'snake-pupil', cx: 11, cy: -8, r: 3 }));
  head.append(svgEl('circle', { class: 'snake-pupil', cx: 11, cy: 8, r: 3 }));
  head.append(svgEl('path', { class: 'snake-tongue', d: 'M 20 0 L 37 0 M 37 0 L 43 -5 M 37 0 L 43 5' }));
  group.append(head);
  svg.append(group);
}

function snakePaletteColor(index) {
  return ['#789b50', '#b8654c', '#4d8f91', '#8b5aa3', '#ad873a', '#577f9f', '#9a4d58', '#6e8f42'][index % 8];
}

function marble(playerIndex, player, current) {
  const token = document.createElement('span');
  token.className = `${player.position ? 'snake-marble' : 'snake-start-marble'}${current ? ' current' : ''}`;
  token.style.setProperty('--token', COLORS[playerIndex]);
  token.textContent = player.name.slice(0, 1);
  token.title = player.name;
  return token;
}

function renderTokens(state = currentState(), positions = null) {
  if (!state) return;
  document.querySelectorAll('.snake-token-stack').forEach((x) => { x.innerHTML = ''; });
  const lane = $('#startLane');
  lane.querySelectorAll('.snake-start-marble').forEach((x) => x.remove());
  const values = positions || state.players.map((p) => p.position);
  values.forEach((position, index) => {
    const player = { ...state.players[index], position };
    const token = marble(index, player, state.turn === index && state.winner === null);
    if (position) document.querySelector(`.snake-cell[data-n="${position}"] .snake-token-stack`)?.appendChild(token);
    else lane.appendChild(token);
  });
}

function renderPlayers(state = currentState()) {
  const box = $('#players');
  box.innerHTML = '';
  if (!state) return;
  state.players.forEach((player, index) => {
    const row = document.createElement('div');
    row.className = 'board-player' + (state.turn === index && state.winner === null ? ' current' : '');
    const connectedMark = mode === 'online' ? `<small>${onlineState?.players[index]?.connected ? 'متصل' : 'غير متصل'}</small>` : '';
    row.innerHTML = `<i class="seat-dot" style="--seat:${COLORS[index]}"></i><div><b>${escapeHtml(player.name)}</b>${connectedMark}<small>${player.position ? `الخانة ${player.position}` : 'في البداية'}</small></div><span class="position">${player.position || '—'}</span>`;
    box.appendChild(row);
  });
}

function renderGame(state = currentState()) {
  if (!state) return;
  renderPlayers(state);
  renderTokens(state);
  $('#die').dataset.value = state.lastRoll || $('#die').dataset.value || 1;
  if (state.winner !== null) {
    $('#status').textContent = `الفائز: ${state.players[state.winner].name}`;
    showWinner(state.players[state.winner].name);
  } else {
    $('#status').textContent = `الدور الآن: ${state.players[state.turn].name}`;
  }
  updateRollButton();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function animateRoll(prev, next, event = next.lastEvent) {
  if (!event || event.type && event.type !== 'roll') return;
  const positions = prev.players.map((p) => p.position);
  const playerIndex = event.player;
  if (!event.blocked) {
    for (let n = event.from + 1; n <= event.landed; n++) {
      positions[playerIndex] = n;
      renderTokens(next, positions);
      BS_AUDIO.play('move', { volume: .42 });
      await wait(75);
    }
  }
  if (event.to !== event.landed) {
    await animateJump(playerIndex, event.landed, event.to, event.jumpType, next.players[playerIndex].name);
    positions[playerIndex] = event.to;
    renderTokens(next, positions);
    BS_AUDIO.play(event.jumpType === 'ladder' ? 'ladder' : 'snake');
    if (event.jumpType === 'snake') {
      $('#board').classList.remove('snake-hit');
      void $('#board').offsetWidth;
      $('#board').classList.add('snake-hit');
      BS_AUDIO.vibrate([75, 45, 80]);
    } else BS_AUDIO.vibrate([30, 25, 50]);
  }
}

function cellCenterPx(n) {
  const cell = document.querySelector(`.snake-cell[data-n="${n}"]`);
  const wrap = $('#boardWrap').getBoundingClientRect();
  const rect = cell.getBoundingClientRect();
  return { x: rect.left - wrap.left + rect.width / 2, y: rect.top - wrap.top + rect.height / 2 };
}

function animateJump(playerIndex, from, to, type, name) {
  if (!from || !to) return Promise.resolve();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return Promise.resolve();
  const a = cellCenterPx(from), b = cellCenterPx(to);
  const moving = document.createElement('span');
  moving.className = 'moving-marble';
  moving.style.setProperty('--token', COLORS[playerIndex]);
  moving.textContent = String(name || '').slice(0, 1);
  $('#motionLayer').appendChild(moving);
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  const px = -dy / len, py = dx / len;
  const curve = type === 'snake' ? 56 : 12;
  const control = { x: (a.x + b.x) / 2 + px * curve, y: (a.y + b.y) / 2 + py * curve };
  const duration = type === 'snake' ? 520 : 410;
  return new Promise((resolve) => {
    const start = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const u = 1 - eased;
      const x = u * u * a.x + 2 * u * eased * control.x + eased * eased * b.x;
      const y = u * u * a.y + 2 * u * eased * control.y + eased * eased * b.y;
      moving.style.left = `${x}px`;
      moving.style.top = `${y}px`;
      if (t < 1) requestAnimationFrame(frame);
      else { moving.remove(); resolve(); }
    }
    requestAnimationFrame(frame);
  });
}

function rollVisual() {
  const die = $('#die');
  die.classList.remove('rolling');
  void die.offsetWidth;
  die.classList.add('rolling');
  BS_AUDIO.play('dice');
}

async function localRoll() {
  if (busy || !localState || localState.winner !== null) return;
  busy = true;
  updateRollButton();
  rollVisual();
  await wait(500);
  const roll = randomRoll();
  $('#die').dataset.value = roll;
  const prev = structuredClone(localState);
  const next = playSnakesRoll(localState, roll);
  $('#status').textContent = `${prev.players[prev.turn].name} رمى ${roll}`;
  await animateRoll(prev, next);
  localState = next;
  renderGame();
  if (next.lastEvent?.blocked) BS_PLATFORM.toast('تحتاج رقمًا دقيقًا للوصول إلى 100');
  if (next.lastEvent?.extraTurn) BS_PLATFORM.toast('ستة! رمية إضافية');
  busy = false;
  updateRollButton();
}

function onlineRoll() {
  if (busy || !onlineState?.game) return;
  busy = true;
  rollVisual();
  $('#status').textContent = 'السيرفر يرمي النرد...';
  client?.roll();
  setTimeout(() => { busy = false; updateRollButton(); }, 1600);
}

function updateRollButton() {
  const button = $('#rollBtn');
  const state = currentState();
  if (!state) { button.disabled = true; return; }
  if (mode === 'local') button.disabled = busy || state.winner !== null;
  else button.disabled = busy || !connected || onlineState?.status !== 'playing' || state.winner !== null || onlineState?.me?.seat !== state.turn;
}

function startLocal() {
  mode = 'local';
  localState = createSnakesGame(cleanNames());
  onlineState = null;
  busy = false;
  buildBoard();
  showOnly('game');
  $('#modeLabel').textContent = 'محلي';
  $('#restartLocal').classList.remove('hidden');
  $('#rematchBtn').classList.add('hidden');
  $('#winnerOverlay').classList.remove('show');
  $('#die').dataset.value = 1;
  renderGame();
  BS_AUDIO.play('launch');
}

function restartLocal() {
  if (mode !== 'local') return;
  startLocal();
}

function setupClient() {
  client?.close();
  client = new BoardRoomClient('snakes');
  client.addEventListener('connection', (e) => {
    const status = e.detail.status;
    connected = status === 'connected';
    const el = $('#connectionStatus');
    el.className = `connection-pill ${status}`;
    const labels = { connecting: 'جاري الاتصال', connected: 'متصل', reconnecting: 'إعادة اتصال', disconnected: 'انقطع الاتصال', error: 'مشكلة اتصال' };
    el.textContent = labels[status] || status;
    updateRollButton();
  });
  client.addEventListener('servererror', (e) => {
    busy = false;
    updateRollButton();
    BS_AUDIO.play('error');
    BS_PLATFORM.toast(e.detail.message);
  });
  client.addEventListener('gameevent', (e) => {
    pendingOnlineEvent = e.detail.event || null;
  });
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
      if (prev?.game && onlineState.game && pendingOnlineEvent?.type === 'roll') {
        const event = pendingOnlineEvent;
        pendingOnlineEvent = null;
        $('#die').dataset.value = event.roll;
        $('#status').textContent = `${onlineState.players[event.player]?.name || 'اللاعب'} رمى ${event.roll}`;
        await animateRoll(prev.game, onlineState.game, event);
      }
      busy = false;
      renderGame(onlineState.game);
      const host = onlineState.me?.role === 'host';
      $('#rematchBtn').classList.toggle('hidden', onlineState.status !== 'finished' || !host);
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
  const box = $('#lobbyPlayers');
  box.innerHTML = '';
  onlineState.players.forEach((player, index) => {
    const row = document.createElement('div');
    row.className = 'lobby-player';
    row.innerHTML = `<i class="seat-dot" style="--seat:${COLORS[index]}"></i><div><b>${escapeHtml(player.name)}</b><small>${player.connected ? 'متصل' : 'غير متصل'}${player.role === 'host' ? ' · مضيف' : ''}</small></div><span class="ready-mark ${player.ready ? 'yes' : ''}">${player.ready ? 'جاهز' : 'غير جاهز'}</span>`;
    box.appendChild(row);
  });
  const me = onlineState.players.find((p) => p.id === onlineState.me?.id);
  $('#readyBtn').textContent = me?.ready ? 'إلغاء الجاهزية' : 'أنا جاهز';
  $('#readyBtn').onclick = () => client?.setReady(!me?.ready);
  const host = onlineState.me?.role === 'host';
  $('#startOnlineBtn').classList.toggle('hidden', !host);
  const enough = onlineState.players.length >= 2 && onlineState.players.length <= 4;
  $('#startOnlineBtn').disabled = !enough || !onlineState.players.every((p) => p.ready);
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
  } catch (error) {
    BS_PLATFORM.toast(error.message || 'تعذر إنشاء الغرفة');
  }
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
  } catch (error) {
    BS_PLATFORM.toast(error.message || 'تعذر دخول الغرفة');
  }
}

function showWinner(name) {
  $('#winnerName').textContent = name;
  $('#winnerOverlay').classList.add('show');
  BS_AUDIO.play('win');
  BS_AUDIO.vibrate([110, 55, 110, 55, 220]);
}

function goMenu() {
  client?.close();
  client = null;
  connected = false;
  mode = null;
  localState = null;
  onlineState = null;
  pendingOnlineEvent = null;
  $('#winnerOverlay').classList.remove('show');
  $('#onlineEntry').classList.remove('hidden');
  $('#onlineLobby').classList.add('hidden');
  showOnly('homeScreen');
}

$('#localModeBtn').onclick = () => showOnly('localSetup');
$('#onlineModeBtn').onclick = () => showOnly('onlineSetup');
document.querySelectorAll('[data-back-menu]').forEach((button) => { button.onclick = goMenu; });
$('#startLocalBtn').onclick = startLocal;
$('#restartLocal').onclick = restartLocal;
$('#leaveGame').onclick = goMenu;
$('#rollBtn').onclick = () => mode === 'online' ? onlineRoll() : localRoll();
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
$('#playerCount').onchange = () => {
  const count = Number($('#playerCount').value);
  for (let i = 0; i < 4; i++) $('#n' + i).closest('label').classList.toggle('hidden', i >= count);
};
$('#playerCount').dispatchEvent(new Event('change'));
$('#roomCode').addEventListener('input', (event) => { event.target.value = normalizeRoomCode(event.target.value); });
window.addEventListener('resize', () => { if (!$('#game').classList.contains('hidden')) drawJumps(); });
showOnly('homeScreen');
