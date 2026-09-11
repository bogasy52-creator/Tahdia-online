(function (global) {
  'use strict';
  const WAIT_MS = 12_000;
  const POLL_MS = 850;
  const SUPPORTED = new Set(['snakes', 'zahra', 'jackaroo', 'spotdiff']);
  const pathGame = location.pathname.replace(/^\/+|\/+$/g, '').replace(/\.html$/i, '').split('/').at(-1);
  const pageGame = SUPPORTED.has(pathGame) ? pathGame : null;
  let game = pageGame;
  let ticket = '';
  let active = false;
  let pollTimer = null;
  let fallbackTimer = null;
  let readySent = false;
  let startSent = false;

  function resolveGame(requestedGame) {
    const candidate = typeof requestedGame === 'string' ? requestedGame : pageGame;
    return SUPPORTED.has(candidate) ? candidate : null;
  }

  function destinationFor(requestedGame, params = {}) {
    const selectedGame = resolveGame(requestedGame);
    if (!selectedGame) return null;
    const next = new URL(`/${selectedGame}.html`, location.origin);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') next.searchParams.set(key, String(value));
    });
    return next.href;
  }

  function botDestination(requestedGame) {
    const base = destinationFor(requestedGame);
    if (!base) return null;
    const next = new URL(base);
    next.searchParams.set('bot', '1');
    next.searchParams.set('difficulty', global.TAHADI_BOT?.difficulty?.() || 'medium');
    return next.href;
  }

  function profileName() {
    return String(global.BS_SOCIAL?.profile?.()?.displayName || global.TAHADI_PROGRESS?.read?.()?.name || 'لاعب العباقرة').trim().slice(0, 20) || 'لاعب العباقرة';
  }

  async function jsonFetch(url, options) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || 'تعذر البحث عن منافس');
    return data;
  }

  function overlay() {
    document.getElementById('boardMatchBox')?.remove();
    const box = document.createElement('div');
    box.id = 'boardMatchBox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.innerHTML = `<div class="board-mm-card"><div class="board-mm-radar"><span>⚡</span></div><small>مطابقة ذكية</small><h2>نبحث عن منافس حقيقي</h2><p id="boardMatchText">12 ثانية كحد أقصى، ثم تبدأ ضد BOT تلقائيًا.</p><div class="board-mm-bar"><i></i></div><button id="boardMatchCancel" type="button">إلغاء البحث</button></div>`;
    const style = document.createElement('style');
    style.textContent = '#boardMatchBox{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:18px;background:#03050dcc;backdrop-filter:blur(15px);direction:rtl;color:#fff}.board-mm-card{width:min(430px,100%);padding:28px 22px;text-align:center;border:1px solid #8b6fd366;border-radius:28px;background:linear-gradient(160deg,#1a1930,#090d19);box-shadow:0 28px 90px #000a}.board-mm-card h2{margin:10px 0 7px;font-size:28px}.board-mm-card p{margin:0;color:#adb6ca;line-height:1.7}.board-mm-card small{color:#f1c972;font-weight:900}.board-mm-radar{width:84px;height:84px;margin:auto;border:1px solid #8165c5;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle,#7c3aed55,transparent 68%);animation:boardMmPulse 1.2s ease-in-out infinite alternate}.board-mm-radar span{font-size:32px}.board-mm-bar{height:5px;margin:20px 0;border-radius:99px;background:#ffffff12;overflow:hidden}.board-mm-bar i{display:block;width:100%;height:100%;background:linear-gradient(90deg,#22d3ee,#8b5cf6,#f0b94a);transform-origin:right;animation:boardMmWait 12s linear forwards}.board-mm-card button{width:100%;min-height:47px;border:1px solid #3a4260;border-radius:14px;background:#090d18;color:#fff;font:inherit;font-weight:900}@keyframes boardMmPulse{to{transform:scale(1.08);box-shadow:0 0 38px #7c3aed44}}@keyframes boardMmWait{to{transform:scaleX(0)}}@media(prefers-reduced-motion:reduce){#boardMatchBox *{animation:none!important}}';
    box.appendChild(style);
    document.body.appendChild(box);
    box.querySelector('#boardMatchCancel').addEventListener('click', () => cancel(false));
    return box;
  }

  function stopTimers() {
    clearTimeout(pollTimer);
    clearTimeout(fallbackTimer);
    pollTimer = null;
    fallbackTimer = null;
  }

  async function cancel(toBot) {
    if (!active && !toBot) return;
    stopTimers();
    const oldTicket = ticket;
    let cancelData = null;
    if (oldTicket) {
      try {
        const response = await fetch(`/api/matchmaking/cancel?game=${encodeURIComponent(game)}`, {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ticket: oldTicket }),
        });
        cancelData = await response.json().catch(() => null);
      } catch {}
    }
    if (cancelData?.status === 'matched') {
      active = true;
      ticket = oldTicket;
      return found(cancelData);
    }
    active = false;
    ticket = '';
    if (!toBot) {
      document.getElementById('boardMatchBox')?.remove();
      return;
    }
    const text = document.getElementById('boardMatchText');
    if (text) text.textContent = 'لا يوجد منافس الآن — BOT جاهز ويدخل مكانه.';
    try { global.BS_AUDIO?.play?.('round'); } catch {}
    setTimeout(() => {
      const next = botDestination(game);
      if (next) location.href = next;
    }, 500);
  }

  function found(data) {
    if (!active) return;
    active = false;
    stopTimers();
    const text = document.getElementById('boardMatchText');
    if (text) text.textContent = `تم العثور على ${data.opponent || 'منافس'} — ندخل الطاولة الآن.`;
    try { global.BS_AUDIO?.play?.('join'); } catch {}
    setTimeout(() => {
      const next = destinationFor(game, {
        room: data.code,
        quick: '1',
        matchHost: data.role === 'host' ? data.hostKey : null,
      });
      if (next) location.href = next;
    }, 500);
  }

  async function poll() {
    if (!active || !ticket) return;
    try {
      const data = await jsonFetch(`/api/matchmaking/status?game=${encodeURIComponent(game)}&ticket=${encodeURIComponent(ticket)}`);
      if (data.status === 'matched') return found(data);
    } catch (error) {
      console.info('board matchmaking poll', error?.message || error);
    }
    if (active) pollTimer = setTimeout(poll, POLL_MS);
  }

  async function join(requestedGame) {
    const selectedGame = resolveGame(requestedGame);
    if (!selectedGame || active) return false;
    game = selectedGame;
    active = true;
    overlay();
    try {
      const progress = global.TAHADI_PROGRESS?.read?.() || {};
      const data = await jsonFetch('/api/matchmaking/join', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ game, name: profileName(), level: progress.level || 1 }),
      });
      ticket = data.ticket || '';
      if (data.status === 'matched') return found(data);
      fallbackTimer = setTimeout(() => cancel(true), WAIT_MS);
      pollTimer = setTimeout(poll, POLL_MS);
    } catch (error) {
      console.info('board matchmaking unavailable', error?.message || error);
      cancel(true);
    }
    return true;
  }

  function autoReady(room, client) {
    if (new URLSearchParams(location.search).get('quick') !== '1' || room?.status !== 'lobby' || !client) return;
    const me = room.players?.find((player) => player.id === room.me?.id);
    if (me?.ready) readySent = false;
    else if (me && !readySent) {
      readySent = true;
      setTimeout(() => client.send('ready', { ready: true }), 80);
    }
    const allReady = room.players?.length === room.playerLimit && room.players.every((player) => player.ready && player.connected);
    if (!allReady) startSent = false;
    else if (room.me?.role === 'host' && !startSent) {
      startSent = true;
      setTimeout(() => client.send('start'), 120);
    }
  }

  function mount() {
    if (!pageGame || new URLSearchParams(location.search).has('room') || new URLSearchParams(location.search).has('bot')) return;
    const modes = document.querySelector('.play-mode');
    if (!modes || document.getElementById('boardQuickMatch')) return;
    const button = document.createElement('button');
    button.id = 'boardQuickMatch';
    button.type = 'button';
    button.textContent = '⚡ منافس سريع';
    button.addEventListener('click', () => join(pageGame));
    modes.appendChild(button);
  }

  global.TAHADI_BOARD_MATCHMAKING = Object.freeze({ join, cancel, autoReady, resolveGame, destinationFor, botDestination, supportedGames: Object.freeze([...SUPPORTED]), WAIT_MS });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
}(window));
