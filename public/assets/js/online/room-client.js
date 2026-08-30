import { loadRoomIdentity, normalizeRoomCode, saveRoomIdentity } from './room-lobby.js';

export class BoardRoomClient extends EventTarget {
  constructor(gameType, options = {}) {
    super();
    if (!['snakes', 'jackaroo'].includes(gameType)) throw new Error('invalid_game_type');
    this.gameType = gameType;
    this.fetchImpl = options.fetchImpl || globalThis.fetch?.bind(globalThis);
    this.WebSocketImpl = options.WebSocketImpl || globalThis.WebSocket;
    this.baseUrl = options.baseUrl || '';
    this.socket = null;
    this.code = '';
    this.name = '';
    this.token = '';
    this.hostKey = '';
    this.playerId = '';
    this.state = null;
    this.manualClose = false;
    this.reconnectAttempt = 0;
    this.reconnectTimer = null;
    this.pingTimer = null;
  }

  emit(type, detail = {}) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  async createRoom(name) {
    if (!this.fetchImpl) throw new Error('fetch_unavailable');
    const response = await this.fetchImpl(`${this.baseUrl}/api/games/rooms`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ gameType: this.gameType, name }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || 'تعذر إنشاء الغرفة');
    this.code = normalizeRoomCode(data.code);
    this.name = String(name || '').slice(0, 20);
    this.token = String(data.token || '');
    this.hostKey = String(data.hostKey || '');
    this.playerId = String(data.playerId || '');
    saveRoomIdentity(this.gameType, this.code, { token: this.token, hostKey: this.hostKey, name: this.name });
    return data;
  }

  async roomStatus(code) {
    if (!this.fetchImpl) throw new Error('fetch_unavailable');
    const normalized = normalizeRoomCode(code);
    if (normalized.length !== 6) throw new Error('كود الغرفة يجب أن يكون 6 أرقام');
    const response = await this.fetchImpl(`${this.baseUrl}/api/games/rooms/${normalized}/status`, { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || 'الغرفة غير موجودة');
    if (data.gameType !== this.gameType) throw new Error('كود الغرفة للعبة أخرى');
    return data;
  }

  connect({ code, name, token = '', hostKey = '', reuseSaved = true } = {}) {
    const normalized = normalizeRoomCode(code);
    if (normalized.length !== 6) throw new Error('كود الغرفة يجب أن يكون 6 أرقام');
    if (!this.WebSocketImpl) throw new Error('websocket_unavailable');

    const saved = reuseSaved ? loadRoomIdentity(this.gameType, normalized) : null;
    this.code = normalized;
    this.name = String(name || saved?.name || 'لاعب').trim().slice(0, 20) || 'لاعب';
    this.token = String(token || saved?.token || '');
    this.hostKey = String(hostKey || saved?.hostKey || '');
    this.manualClose = false;
    this.openSocket();
    return this;
  }

  openSocket() {
    clearTimeout(this.reconnectTimer);
    if (this.socket && this.socket.readyState <= 1) {
      try { this.socket.close(4000, 'replace'); } catch {}
    }
    const base = this.baseUrl || (globalThis.location ? globalThis.location.origin : 'http://localhost');
    const url = new URL(`/api/games/rooms/${this.code}/ws`, base);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.searchParams.set('name', this.name);
    if (this.token) url.searchParams.set('token', this.token);
    if (this.hostKey) url.searchParams.set('hostKey', this.hostKey);
    const ws = new this.WebSocketImpl(url.toString());
    this.socket = ws;
    this.emit('connection', { status: 'connecting' });

    ws.addEventListener('open', () => {
      this.reconnectAttempt = 0;
      this.emit('connection', { status: 'connected' });
      this.startPing();
    });

    ws.addEventListener('message', (event) => {
      let message;
      try { message = JSON.parse(event.data); }
      catch { return; }
      if (message.type === 'welcome') {
        this.playerId = String(message.playerId || '');
        this.token = String(message.token || this.token || '');
        this.state = message.state || null;
        saveRoomIdentity(this.gameType, this.code, { token: this.token, hostKey: this.hostKey, name: this.name });
        this.emit('welcome', { message, state: this.state });
        if (this.state) this.emit('state', { state: this.state });
        return;
      }
      if (message.type === 'state') {
        this.state = message.state || null;
        this.emit('state', { state: this.state });
        return;
      }
      if (message.type === 'event') {
        this.emit('gameevent', { event: message.event });
        return;
      }
      if (message.type === 'error') {
        this.emit('servererror', { message: message.message || 'تعذر تنفيذ الطلب' });
        return;
      }
      if (message.type === 'pong') this.emit('pong', { at: message.at });
    });

    ws.addEventListener('close', (event) => {
      this.stopPing();
      this.emit('connection', { status: 'disconnected', code: event.code, reason: event.reason });
      if (!this.manualClose && event.code !== 4004) this.scheduleReconnect();
    });

    ws.addEventListener('error', () => {
      this.emit('connection', { status: 'error' });
    });
  }

  scheduleReconnect() {
    clearTimeout(this.reconnectTimer);
    const delay = Math.min(5000, 700 * (2 ** Math.min(3, this.reconnectAttempt++)));
    this.emit('connection', { status: 'reconnecting', delay });
    this.reconnectTimer = setTimeout(() => this.openSocket(), delay);
  }

  startPing() {
    this.stopPing();
    this.pingTimer = setInterval(() => this.send({ type: 'ping' }), 20000);
  }

  stopPing() {
    clearInterval(this.pingTimer);
    this.pingTimer = null;
  }

  send(message) {
    if (!this.socket || this.socket.readyState !== 1) return false;
    try {
      this.socket.send(JSON.stringify(message));
      return true;
    } catch {
      return false;
    }
  }

  setReady(ready) { return this.send({ type: 'ready', ready: Boolean(ready) }); }
  startMatch() { return this.send({ type: 'start' }); }
  roll() { return this.send({ type: 'roll' }); }
  playCard(cardIndex, action) { return this.send({ type: 'play_card', cardIndex, action }); }
  rematch() { return this.send({ type: 'rematch' }); }

  close() {
    this.manualClose = true;
    clearTimeout(this.reconnectTimer);
    this.stopPing();
    try { this.socket?.close(1000, 'client_close'); } catch {}
    this.socket = null;
  }
}
