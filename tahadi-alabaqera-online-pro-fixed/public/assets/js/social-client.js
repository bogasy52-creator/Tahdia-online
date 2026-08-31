(() => {
  const STORAGE_KEY = 'bs_social_session';
  const PROFILE_KEY = 'bs_social_profile';
  const state = { token: '', profile: null, dashboard: null, socket: null, reconnectTimer: null, reconnectAttempt: 0, manualClose: false };
  const events = new EventTarget();

  function readStorage(key) { try { return localStorage.getItem(key) || ''; } catch { return ''; } }
  function writeStorage(key, value) { try { if (value) localStorage.setItem(key, value); else localStorage.removeItem(key); } catch {} }
  function parseJson(value, fallback = null) { try { return JSON.parse(value); } catch { return fallback; } }
  function toast(message) { if (window.BS_PLATFORM?.toast) window.BS_PLATFORM.toast(message); else console.info(message); }
  function token() { if (!state.token) state.token = readStorage(STORAGE_KEY); return state.token; }
  function cachedProfile() {
    if (!state.profile) state.profile = parseJson(readStorage(PROFILE_KEY));
    return state.profile;
  }
  function setSession(nextToken, profile) {
    state.token = String(nextToken || '');
    state.profile = profile || null;
    writeStorage(STORAGE_KEY, state.token);
    writeStorage(PROFILE_KEY, state.profile ? JSON.stringify(state.profile) : '');
    decorate();
  }

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (options.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
    const session = token();
    if (session) headers.set('authorization', `Bearer ${session}`);
    const response = await fetch(path, { ...options, headers, cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 && path !== '/api/social/login') {
      setSession('', null);
      closeRealtime();
    }
    if (!response.ok || data.ok === false) {
      const error = new Error(data.error || 'تعذر تنفيذ الطلب');
      error.status = response.status;
      throw error;
    }
    return data;
  }

  async function signup({ username, displayName, password }) {
    const data = await api('/api/social/signup', { method: 'POST', body: JSON.stringify({ username, displayName, password }) });
    setSession(data.token, data.profile);
    connectRealtime();
    return data;
  }
  async function login({ username, password }) {
    const data = await api('/api/social/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    setSession(data.token, data.profile);
    connectRealtime();
    return data;
  }
  async function logout() {
    try { if (token()) await api('/api/social/logout', { method: 'POST' }); } catch {}
    closeRealtime();
    setSession('', null);
    state.dashboard = null;
  }
  async function me(force = false) {
    if (!token()) return null;
    if (state.dashboard && !force) return state.dashboard;
    const data = await api('/api/social/me');
    state.dashboard = data;
    state.profile = data.profile;
    writeStorage(PROFILE_KEY, JSON.stringify(data.profile || null));
    decorate(data);
    return data;
  }
  async function user(username) { return api(`/api/social/users/${encodeURIComponent(String(username || '').trim())}`); }
  async function requestFriend(username) { const data = await api('/api/social/friends/request', { method: 'POST', body: JSON.stringify({ username }) }); state.dashboard = null; return data; }
  async function respondFriend(username, accept) { const data = await api('/api/social/friends/respond', { method: 'POST', body: JSON.stringify({ username, accept }) }); state.dashboard = null; return data; }
  async function removeFriend(username) { const data = await api(`/api/social/friends/${encodeURIComponent(username)}`, { method: 'DELETE' }); state.dashboard = null; return data; }
  async function block(username) { const data = await api('/api/social/block', { method: 'POST', body: JSON.stringify({ username }) }); state.dashboard = null; return data; }
  async function unblock(username) { const data = await api('/api/social/unblock', { method: 'POST', body: JSON.stringify({ username }) }); state.dashboard = null; return data; }
  async function settings(values) { const data = await api('/api/social/settings', { method: 'POST', body: JSON.stringify(values) }); state.dashboard = null; return data; }
  async function invite(username, game, roomCode) { return api('/api/social/invites', { method: 'POST', body: JSON.stringify({ username, game, roomCode }) }); }
  async function readNotifications(ids = []) { const data = await api('/api/social/notifications/read', { method: 'POST', body: JSON.stringify({ ids }) }); state.dashboard = null; return data; }

  function emit(type, detail) { events.dispatchEvent(new CustomEvent(type, { detail })); }

  function showIncomingInvite(notification) {
    if (!notification?.joinPath || Date.now() >= Number(notification.expiresAt || 0)) return;
    let wrap = document.querySelector('#bsSocialInvite');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'bsSocialInvite';
      wrap.className = 'bs-social-invite-card';
      document.body.appendChild(wrap);
    }
    wrap.innerHTML = '';
    const title = document.createElement('b');
    title.textContent = `🎮 دعوة من ${notification.from?.displayName || notification.from?.username || 'صديق'}`;
    const sub = document.createElement('span');
    const labels = { quiz: 'تحدي العباقرة', jackaroo: 'جاكارو', snakes: 'السلم والثعبان', zahra: 'الزهرة' };
    sub.textContent = `${labels[notification.game] || notification.game} • الغرفة ${notification.roomCode}`;
    const actions = document.createElement('div');
    actions.className = 'bs-social-invite-actions';
    const join = document.createElement('a');
    join.className = 'bs-btn gold'; join.textContent = 'انضم الآن'; join.href = notification.joinPath;
    const close = document.createElement('button');
    close.className = 'bs-btn'; close.textContent = 'لاحقًا'; close.type = 'button'; close.onclick = () => wrap.remove();
    actions.append(join, close); wrap.append(title, sub, actions);
  }

  function handleMessage(raw) {
    let message; try { message = JSON.parse(raw); } catch { return; }
    if (message.type === 'social_welcome') {
      state.profile = message.profile || state.profile;
      if (state.profile) writeStorage(PROFILE_KEY, JSON.stringify(state.profile));
      decorate(); emit('connected', message); return;
    }
    if (message.type === 'notification') {
      state.dashboard = null;
      const n = message.notification;
      if (n?.type === 'game_invite') showIncomingInvite(n);
      else if (n?.type === 'friend_request') toast(`👥 طلب صداقة من ${n.from?.displayName || n.from?.username || 'لاعب'}`);
      else if (n?.type === 'friend_accepted') toast(`✅ تم قبول طلب الصداقة`);
      decorate({ unread: Number(document.querySelector('[data-social-badge]')?.textContent || 0) + 1 });
      emit('notification', n); return;
    }
    if (message.type === 'friend_presence') { state.dashboard = null; emit('presence', message.friend); return; }
    if (message.type === 'pong') emit('pong', message);
  }

  function connectRealtime() {
    if (!token() || typeof WebSocket === 'undefined') return;
    state.manualClose = false;
    clearTimeout(state.reconnectTimer);
    if (state.socket && state.socket.readyState <= 1) return;
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${location.host}/api/social/ws`, ['busraj-social-v1', `st.${token()}`]);
    state.socket = ws;
    ws.onopen = () => { state.reconnectAttempt = 0; emit('connection', { online: true }); };
    ws.onmessage = (event) => handleMessage(event.data);
    ws.onerror = () => emit('connection', { online: false, error: true });
    ws.onclose = (event) => {
      if (state.socket === ws) state.socket = null;
      emit('connection', { online: false, code: event.code });
      if (!state.manualClose && token() && event.code !== 4001) {
        const delay = Math.min(8000, 800 * (2 ** Math.min(4, state.reconnectAttempt++)));
        state.reconnectTimer = setTimeout(connectRealtime, delay);
      }
    };
  }
  function closeRealtime() {
    state.manualClose = true;
    clearTimeout(state.reconnectTimer);
    try { state.socket?.close(1000, 'logout'); } catch {}
    state.socket = null;
  }

  function decorate(data = state.dashboard) {
    const profile = data?.profile || cachedProfile();
    const unread = Number(data?.unread || 0);
    document.querySelectorAll('[data-social-name]').forEach((el) => { el.textContent = profile?.displayName || 'حسابي'; });
    document.querySelectorAll('[data-social-open]').forEach((el) => {
      el.setAttribute('href', profile ? '/social' : '/social?auth=1');
      el.setAttribute('title', profile ? `@${profile.username}` : 'تسجيل الدخول');
    });
    document.querySelectorAll('[data-social-badge]').forEach((el) => {
      el.textContent = unread > 99 ? '99+' : String(unread || '');
      el.classList.toggle('hidden', !unread);
    });
  }

  async function openInvitePicker({ game, roomCode } = {}) {
    if (!token()) {
      toast('سجّل الدخول أولًا لإرسال دعوة لصديق');
      setTimeout(() => { location.href = `/social?next=${encodeURIComponent(location.pathname + location.search)}`; }, 650);
      return;
    }
    let data;
    try { data = await me(true); } catch (error) { toast(error.message); return; }
    const friends = [...(data.friends || [])].sort((a, b) => Number(b.online) - Number(a.online) || String(a.displayName).localeCompare(String(b.displayName), 'ar'));
    let modal = document.querySelector('#bsInviteFriendsModal');
    if (!modal) {
      modal = document.createElement('div'); modal.id = 'bsInviteFriendsModal'; modal.className = 'bs-modal'; document.body.appendChild(modal);
    }
    modal.innerHTML = '';
    const panel = document.createElement('section'); panel.className = 'bs-panel bs-social-picker';
    const head = document.createElement('div'); head.className = 'bs-social-picker-head';
    const copy = document.createElement('div'); const title = document.createElement('h2'); title.textContent = '👥 دعوة صديق'; const note = document.createElement('small'); note.textContent = `الغرفة ${roomCode}`; copy.append(title, note);
    const close = document.createElement('button'); close.type = 'button'; close.className = 'bs-icon-btn'; close.textContent = '✕'; close.onclick = () => modal.classList.remove('open');
    head.append(copy, close); panel.appendChild(head);
    const list = document.createElement('div'); list.className = 'bs-social-picker-list';
    if (!friends.length) {
      const empty = document.createElement('div'); empty.className = 'bs-social-empty'; empty.textContent = 'ما عندك أصدقاء بعد. أضف صديقًا من صفحة الأصدقاء.'; list.appendChild(empty);
    }
    for (const friend of friends) {
      const row = document.createElement('div'); row.className = 'bs-social-picker-row';
      const who = document.createElement('div'); const name = document.createElement('b'); name.textContent = `${friend.online ? '🟢' : '⚫'} ${friend.displayName}`; const user = document.createElement('small'); user.textContent = `@${friend.username}`; who.append(name, user);
      const send = document.createElement('button'); send.type = 'button'; send.className = 'bs-btn cyan'; send.textContent = 'دعوة';
      send.onclick = async () => { send.disabled = true; try { await invite(friend.username, game, roomCode); send.textContent = 'تم ✓'; toast(`تم إرسال الدعوة إلى ${friend.displayName}`); } catch (error) { send.disabled = false; toast(error.message); } };
      row.append(who, send); list.appendChild(row);
    }
    panel.appendChild(list);
    const footer = document.createElement('a'); footer.href = '/social'; footer.className = 'bs-social-picker-footer'; footer.textContent = 'إدارة الأصدقاء ←'; panel.appendChild(footer);
    modal.appendChild(panel); modal.classList.add('open');
    modal.onclick = (event) => { if (event.target === modal) modal.classList.remove('open'); };
  }

  const apiPublic = {
    signup, login, logout, me, user, requestFriend, respondFriend, removeFriend, block, unblock,
    settings, invite, readNotifications, connectRealtime, closeRealtime, openInvitePicker,
    isLoggedIn: () => Boolean(token()), profile: () => cachedProfile(), events,
  };
  window.BS_SOCIAL = apiPublic;
  decorate();
  if (token()) {
    connectRealtime();
    window.addEventListener('load', () => me(true).catch(() => {}), { once: true });
  }
})();
