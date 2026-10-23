(() => {
  const STORAGE_KEY = 'bs_social_session';
  const PROFILE_KEY = 'bs_social_profile';
  const SEEN_INVITES_KEY = 'bs_seen_invites_v25_2';
  const INBOX_INTERVAL_MS = 30000;
  const state = { token: '', profile: null, dashboard: null, socket: null, reconnectTimer: null, reconnectAttempt: 0, manualClose: false, heartbeat:null, welcomeTimer:null, lastMessageAt:0 };
  const events = new EventTarget();
  let inboxTimer = null;
  let inboxPending = null;
  let inviteExpiryTimer=null;
  const seenInvites = new Set();
  function seenKey() { return `${SEEN_INVITES_KEY}:${cachedProfile()?.username || token().split('.')[0] || 'guest'}`; }
  function loadSeen() {
    seenInvites.clear();
    try { for (const id of JSON.parse(localStorage.getItem(seenKey()) || '[]')) seenInvites.add(String(id)); } catch {}
  }
  function rememberInvite(id) {
    if (!id) return;
    seenInvites.add(String(id));
    const recent = [...seenInvites].slice(-80);
    try { localStorage.setItem(seenKey(), JSON.stringify(recent)); } catch {}
  }
  function syncInbox(data) {
    if (!data || !Array.isArray(data.notifications) || !token()) return;
    const latest = [...data.notifications]
      .filter(n => n?.type === 'game_invite' && !n.read && n.joinPath && Number(n.expiresAt || 0) > Date.now())
      .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
      .find(n => !seenInvites.has(String(n.id)));
    if (latest) showIncomingInvite(latest);
  }
  function refreshInbox() {
    if (!token() || document.hidden) return Promise.resolve(null);
    if (!inboxPending) { const request=me(true).catch(() => null).finally(() => { if(inboxPending===request)inboxPending=null; }); inboxPending=request; }
    return inboxPending;
  }
  function startInbox() {
    clearInterval(inboxTimer);
    if (!token()) return;
    loadSeen();
    inboxTimer = setInterval(()=>{if(state.socket?.readyState!==1)refreshInbox();}, INBOX_INTERVAL_MS);
    refreshInbox();
  }
  function stopInbox() { clearInterval(inboxTimer); inboxTimer = null; inboxPending = null; }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshInbox(); });
  window.addEventListener('online', refreshInbox);
  window.addEventListener('focus', refreshInbox);


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
    const changed=state.token!==String(nextToken||'');
    if(changed){closeRealtime();state.reconnectAttempt=0;state.dashboard=null;inboxPending=null;clearTimeout(inviteExpiryTimer);document.querySelector('#bsSocialInvite')?.remove();}
    state.token = String(nextToken || '');
    state.profile = profile || null;
    writeStorage(STORAGE_KEY, state.token);
    writeStorage(PROFILE_KEY, state.profile ? JSON.stringify(state.profile) : '');
    if (state.token) startInbox(); else stopInbox();
    decorate();
    window.dispatchEvent(new CustomEvent('bs-social-session'));
  }

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (options.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
    const session = token();
    if (session) headers.set('authorization', `Bearer ${session}`);
    const deadline=typeof AbortSignal!=='undefined'&&AbortSignal.timeout?AbortSignal.timeout(10000):undefined;
    let response;try{response=await fetch(path,{...options,headers,cache:'no-store',signal:options.signal||deadline});}catch(error){throw new Error(error.name==='TimeoutError'||error.name==='AbortError'?'انتهت مهلة الاتصال. أعد المحاولة.':'تعذر الوصول للخادم. تحقق من اتصالك.');}
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 && session===token() && path !== '/api/social/login') {
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
    const session=token();
    const data = await api('/api/social/me');
    if(session!==token()||data.profile?.username!==session.split('.')[0])return null;
    state.dashboard = data;
    state.profile = data.profile;
    writeStorage(PROFILE_KEY, JSON.stringify(data.profile || null));
    decorate(data);
    syncInbox(data);
    return data;
  }
  async function user(username) { return api(`/api/social/users/${encodeURIComponent(String(username || '').trim())}`); }
  async function requestFriend(username) { const data = await api('/api/social/friends/request', { method: 'POST', body: JSON.stringify({ username }) }); state.dashboard = null; return data; }
  async function respondFriend(username, accept) { const data = await api('/api/social/friends/respond', { method: 'POST', body: JSON.stringify({ username, accept }) }); state.dashboard = null; return data; }
  async function removeFriend(username) { const data = await api(`/api/social/friends/${encodeURIComponent(username)}`, { method: 'DELETE' }); state.dashboard = null; return data; }
  async function block(username) { const data = await api('/api/social/block', { method: 'POST', body: JSON.stringify({ username }) }); state.dashboard = null; return data; }
  async function unblock(username) { const data = await api('/api/social/unblock', { method: 'POST', body: JSON.stringify({ username }) }); state.dashboard = null; return data; }
  async function settings(values) { const data = await api('/api/social/settings', { method: 'POST', body: JSON.stringify(values) }); state.dashboard = null; return data; }
  async function invite(username, game, roomCode, variant) { return api('/api/social/invites', { method: 'POST', body: JSON.stringify({ username, game, roomCode, ...(variant?{variant}:{}) }) }); }
  async function readNotifications(ids = []) { const data = await api('/api/social/notifications/read', { method: 'POST', body: JSON.stringify({ ids }),keepalive:true }); state.dashboard = null; return data; }

  function emit(type, detail) { events.dispatchEvent(new CustomEvent(type, { detail })); }

  function showIncomingInvite(notification) {
    if (!notification?.joinPath || Date.now() >= Number(notification.expiresAt || 0)) return;
    if(!/^(?:\/(?:online|picture|jackaroo|snakes|zahra|serpent|sudoku|paths-online|dice|journey|local|logic|memory|puzzle|reaction)(?:\?room=\d{6})?|\/journey\?game=(?:paths|jewels))$/.test(notification.joinPath))return;
    if (notification.id && seenInvites.has(String(notification.id))) return;
    rememberInvite(notification.id);clearTimeout(inviteExpiryTimer);
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
    const labels = { party: 'غرفة الأصدقاء', quiz: 'تحدي العباقرة', picture: 'سباق الصور', jackaroo: 'جاكارو', snakes: 'الثعبان', zahra: 'الزهرة', serpent: 'حلبة الثعبان', sudoku: 'سودوكو', paths: 'توصيل الأرقام', dice: 'النرد', journey: 'رحلة النجوم', local: 'العباقرة المحلي', logic: 'المنطق', memory: 'الذاكرة', puzzle: 'ترتيب الأرقام', reaction: 'سرعة الاستجابة' };
    sub.textContent = notification.roomCode ? `${labels[notification.game] || notification.game} • الغرفة ${notification.roomCode}` : `تحدٍ جديد • ${labels[notification.game] || notification.game}`;
    const actions = document.createElement('div');
    actions.className = 'bs-social-invite-actions';
    const join = document.createElement('a');
    join.className = 'bs-btn gold'; join.textContent = 'انضم الآن'; join.href = notification.joinPath;
    const close = document.createElement('button');
    close.className = 'bs-btn'; close.textContent = 'لاحقًا'; close.type = 'button'; close.onclick = () => { wrap.remove(); if (notification.id) readNotifications([notification.id]).catch(() => {}); };
    join.addEventListener('click', () => { if (notification.id) readNotifications([notification.id]).catch(() => {}); });
    actions.append(join, close); wrap.append(title, sub, actions);
    wrap.setAttribute('role','status');
    inviteExpiryTimer=setTimeout(()=>wrap.remove(),Math.max(1,Math.min(300000,Number(notification.expiresAt)-Date.now())));
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

  function clearSocketTimers(){clearInterval(state.heartbeat);clearTimeout(state.welcomeTimer);state.heartbeat=null;state.welcomeTimer=null;}
  function scheduleRealtime(){
    clearTimeout(state.reconnectTimer);
    if(state.manualClose||!token())return;
    const delay=Math.min(15000,800*(2**Math.min(5,state.reconnectAttempt++)))+Math.floor(Math.random()*300);
    state.reconnectTimer=setTimeout(connectRealtime,delay);
  }
  function recoverRealtime(ws){
    if(state.socket!==ws||state.manualClose||!token())return;
    state.socket=null;clearSocketTimers();ws.onopen=ws.onclose=ws.onerror=ws.onmessage=null;try{ws.close(4000,'resync');}catch{}
    emit('connection',{online:false});refreshInbox();scheduleRealtime();
  }
  function connectRealtime() {
    if (!token() || typeof WebSocket === 'undefined') return;
    state.manualClose = false;
    clearTimeout(state.reconnectTimer);
    if (state.socket && state.socket.readyState <= 1) return;
    clearSocketTimers();
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    let ws;try{ws = new WebSocket(`${proto}//${location.host}/api/social/ws`, ['busraj-social-v1', `st.${token()}`]);}catch{scheduleRealtime();return;}
    state.socket = ws;state.lastMessageAt=Date.now();
    state.welcomeTimer=setTimeout(()=>{if(state.socket===ws)recoverRealtime(ws);},12000);
    ws.onopen = () => {
      if(state.socket!==ws)return;
      state.lastMessageAt=Date.now();refreshInbox();
      state.heartbeat=setInterval(()=>{
        if(state.socket!==ws||document.hidden)return;
        if(Date.now()-state.lastMessageAt>60000){recoverRealtime(ws);return;}
        if(ws.readyState===1)try{ws.send(JSON.stringify({type:'ping'}));}catch{recoverRealtime(ws);}
      },25000);
    };
    ws.onmessage = (event) => {
      if(state.socket!==ws)return;
      let data;try{data=JSON.parse(event.data);}catch{return;}
      state.lastMessageAt=Date.now();
      if(data.type==='social_welcome'){clearTimeout(state.welcomeTimer);state.reconnectAttempt=0;emit('connection',{online:true});}
      handleMessage(event.data);
    };
    ws.onerror = () => {if(state.socket===ws)emit('connection', { online: false, error: true });};
    ws.onclose = (event) => {
      if(state.socket!==ws)return;
      state.socket=null;clearSocketTimers();
      emit('connection', { online: false, code: event.code });
      if (!state.manualClose && token() && ![4001,1008].includes(event.code)) {refreshInbox();scheduleRealtime();}
    };
  }
  function closeRealtime() {
    state.manualClose = true;clearSocketTimers();
    clearTimeout(state.reconnectTimer);
    const ws=state.socket;state.socket=null;
    if(ws){ws.onclose=ws.onmessage=ws.onerror=ws.onopen=null;try{ws.close(1000,'logout');}catch{}}
  }
  function restoreRealtime(){
    if(!token())return;
    if(state.socket?.readyState===1){
      if(Date.now()-state.lastMessageAt>45000){recoverRealtime(state.socket);}
      else try{state.socket.send(JSON.stringify({type:'ping'}));}catch{state.socket.close();}
    }else connectRealtime();
    refreshInbox();
  }
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)restoreRealtime();});
  window.addEventListener('online',restoreRealtime);
  window.addEventListener('pageshow',restoreRealtime);
  window.addEventListener('storage',event=>{
    if(event.key!==STORAGE_KEY)return;
    setSession(readStorage(STORAGE_KEY),parseJson(readStorage(PROFILE_KEY)));
    if(token())connectRealtime();
  });

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

  async function openInvitePicker({ game, roomCode, variant, title:gameTitle, roundClosed, share } = {}) {
    if (!token()) {
      toast('سجّل الدخول أولًا لإرسال دعوة لصديق');
      setTimeout(() => { location.href = `/social?next=${encodeURIComponent(location.pathname + location.search)}`; }, 650);
      return;
    }
    const openedSession=token(),source=document.activeElement;let data;
    try { data = await me(true); } catch (error) { toast(error.message); return; }
    if(!data||openedSession!==token())return;
    const friends = [...(data.friends || [])].sort((a, b) => Number(b.online) - Number(a.online) || String(a.displayName).localeCompare(String(b.displayName), 'ar'));
    let modal = document.querySelector('#bsInviteFriendsModal');
    if (!modal) {
      modal = document.createElement('div'); modal.id = 'bsInviteFriendsModal'; modal.className = 'bs-modal';
    }
    const parent=document.fullscreenElement||document.querySelector('body.serpent-active #arenaPlay')||document.body;if(modal.parentElement!==parent)parent.appendChild(modal);
    modal.innerHTML = '';
    const panel = document.createElement('section'); panel.className = 'bs-panel bs-social-picker';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','دعوة صديق لهذه اللعبة');
    const head = document.createElement('div'); head.className = 'bs-social-picker-head';
    const copy = document.createElement('div'); const title = document.createElement('h2'); title.textContent = 'دعوة صديق · '+(gameTitle||'اللعبة الحالية'); const note = document.createElement('small'); note.textContent = roomCode ? `يدخل صديقك إلى غرفتك ${roomCode}` : roundClosed?'الجولة بدأت؛ الدعوة لتحدٍ جديد في نفس اللعبة':'يفتح صديقك نفس اللعبة مباشرة'; copy.append(title, note);
    const dismiss=()=>{modal.classList.remove('open');source?.focus?.();};const close = document.createElement('button'); close.type = 'button'; close.className = 'bs-icon-btn'; close.textContent = '✕';close.setAttribute('aria-label','إغلاق دعوة الأصدقاء');close.onclick=dismiss;
    head.append(copy, close); panel.appendChild(head);
    const list = document.createElement('div'); list.className = 'bs-social-picker-list';
    if (!friends.length) {
      const empty = document.createElement('div'); empty.className = 'bs-social-empty'; empty.textContent = 'ما عندك أصدقاء بعد. أضف صديقًا من صفحة الأصدقاء.'; list.appendChild(empty);
    }
    for (const friend of friends) {
      const row = document.createElement('div'); row.className = 'bs-social-picker-row';
      const who = document.createElement('div'); const name = document.createElement('b'); name.textContent = `${friend.online ? '🟢' : '⚫'} ${friend.displayName}`; const user = document.createElement('small'); user.textContent = `@${friend.username}`; who.append(name, user);
      const send = document.createElement('button'); send.type = 'button'; send.className = 'bs-btn cyan'; send.textContent = 'دعوة';
      send.onclick = async () => {if(openedSession!==token()){toast('تغيّر الحساب؛ افتح قائمة الأصدقاء مجددًا');dismiss();return;} send.disabled = true; try { await invite(friend.username, game, roomCode, variant); send.textContent = 'أُرسلت ✓'; toast(friend.online?`أُرسلت الدعوة إلى ${friend.displayName}`:`حُفظت الدعوة لدى ${friend.displayName} وستظهر عند اتصاله`); } catch (error) { send.disabled = false; toast(error.message); } };
      row.append(who, send); list.appendChild(row);
    }
    panel.appendChild(list);
    if(typeof share==='function'){const button=document.createElement('button');button.type='button';button.className='bs-btn';button.textContent='مشاركة رابط اللعبة';button.onclick=share;panel.append(button);}
    const footer = document.createElement('a'); footer.href = '/social'; footer.className = 'bs-social-picker-footer'; footer.textContent = 'إدارة الأصدقاء ←'; panel.appendChild(footer);
    modal.appendChild(panel); modal.classList.add('open');
    modal.onclick = (event) => { if (event.target === modal) dismiss(); };
    panel.onkeydown=event=>{if(event.key==='Escape'){event.preventDefault();dismiss();}if(event.key==='Tab'){const controls=[...panel.querySelectorAll('button,a,input')].filter(n=>!n.disabled),first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}};close.focus();
  }

  const apiPublic = {
    version: '25.3.0',
    signup, login, logout, me, user, requestFriend, respondFriend, removeFriend, block, unblock,
    settings, invite, readNotifications, connectRealtime, closeRealtime, openInvitePicker,
    isLoggedIn: () => Boolean(token()), profile: () => cachedProfile(), events,
  };
  window.BS_SOCIAL = apiPublic;
  decorate();
  if (token()) {
    startInbox();
    connectRealtime();
  }
})();
