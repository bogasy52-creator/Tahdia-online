import { DurableObject } from 'cloudflare:workers';
import {
  addBoardPlayer,
  applyBoardCommand,
  boardPublicState,
  createBoardRoom,
  resetBoardMatch,
  setBoardReady,
  startBoardMatch,
} from './board-game-core.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
    },
  });
}

function cleanName(value) {
  return String(value || '').trim().replace(/[<>]/g, '').slice(0, 20) || 'لاعب';
}

function makeToken() {
  return crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
}

function secureUnit() {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
}

export class BoardGameRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.room = null;
    this.rateLimits = new Map();
    this.ctx.blockConcurrencyWhile(async () => {
      this.room = (await this.ctx.storage.get('room')) || null;
      this.syncConnectedFlags();
    });
  }

  syncConnectedFlags() {
    if (!this.room?.players) return;
    const online = new Set();
    for (const ws of this.ctx.getWebSockets()) {
      try {
        const attachment = ws.deserializeAttachment();
        if (attachment?.playerId) online.add(attachment.playerId);
      } catch {}
    }
    for (const player of Object.values(this.room.players)) player.connected = online.has(player.id);
  }

  async persist() {
    if (!this.room) return;
    this.room.updatedAt = Date.now();
    await this.ctx.storage.put('room', this.room);
    await this.ctx.storage.setAlarm(this.room.expiresAt);
  }

  findByToken(value) {
    const reconnectToken = String(value || '');
    if (!reconnectToken || !this.room) return null;
    return Object.values(this.room.players).find((player) => player.token === reconnectToken) || null;
  }

  hostPlayer() {
    if (!this.room) return null;
    return Object.values(this.room.players).find((player) => player.role === 'host') || null;
  }

  allowMessage(playerId) {
    const now = Date.now();
    const prior = this.rateLimits.get(playerId);
    if (!prior || now - prior.startedAt >= 5000) {
      this.rateLimits.set(playerId, { startedAt: now, count: 1 });
      return true;
    }
    prior.count += 1;
    return prior.count <= 30;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/init' && request.method === 'POST') {
      if (this.room) return json({ ok: false, error: 'room_exists' }, 409);
      const body = await request.json();
      const now = Date.now();
      this.room = createBoardRoom({
        code: body.code,
        hostKey: body.hostKey,
        gameType: body.gameType,
        now,
      });
      addBoardPlayer(this.room, {
        id: body.hostPlayerId,
        token: body.hostToken,
        name: body.name,
        role: 'host',
        now,
      });
      await this.persist();
      return json({ ok: true }, 201);
    }

    if (url.pathname === '/status') {
      if (!this.room) return json({ ok: false, error: 'الغرفة غير موجودة' }, 404);
      this.syncConnectedFlags();
      return json({
        ok: true,
        code: this.room.code,
        gameType: this.room.gameType,
        status: this.room.status,
        players: this.room.order.length,
        capacity: 4,
      });
    }

    if (url.pathname.endsWith('/ws')) {
      if (!this.room) return json({ ok: false, error: 'الغرفة غير موجودة' }, 404);
      if (request.headers.get('Upgrade') !== 'websocket') return json({ ok: false, error: 'WebSocket required' }, 426);

      const name = cleanName(url.searchParams.get('name'));
      const reconnectToken = url.searchParams.get('token') || '';
      const hostKey = url.searchParams.get('hostKey') || '';
      let player = this.findByToken(reconnectToken);

      if (!player && hostKey && hostKey === this.room.hostKey) player = this.hostPlayer();

      if (!player) {
        if (this.room.status !== 'lobby') return json({ ok: false, error: 'المباراة بدأت' }, 409);
        try {
          player = addBoardPlayer(this.room, {
            id: crypto.randomUUID(),
            token: makeToken(),
            name,
            role: 'guest',
            now: Date.now(),
          });
        } catch (error) {
          const message = String(error?.message || error);
          if (message.includes('room_full')) return json({ ok: false, error: 'الغرفة ممتلئة' }, 409);
          return json({ ok: false, error: 'تعذر الانضمام للغرفة' }, 400);
        }
      } else if (name) {
        player.name = name;
      }

      for (const old of this.ctx.getWebSockets()) {
        try {
          if (old.deserializeAttachment()?.playerId === player.id) old.close(4001, 'reconnected');
        } catch {}
      }

      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({ playerId: player.id });
      player.connected = true;
      await this.persist();

      server.send(JSON.stringify({
        type: 'welcome',
        playerId: player.id,
        token: player.token,
        state: boardPublicState(this.room, player.id),
      }));
      this.broadcastState();
      this.broadcastEvent({ type: 'player_joined', playerId: player.id, name: player.name });

      return new Response(null, { status: 101, webSocket: client });
    }

    return json({ ok: false, error: 'not_found' }, 404);
  }

  playerForSocket(ws) {
    try {
      const attachment = ws.deserializeAttachment();
      return attachment?.playerId ? this.room?.players?.[attachment.playerId] : null;
    } catch {
      return null;
    }
  }

  sendError(ws, message) {
    try { ws.send(JSON.stringify({ type: 'error', message })); } catch {}
  }

  broadcastEvent(event) {
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.send(JSON.stringify({ type: 'event', event })); } catch {}
    }
  }

  broadcastState() {
    if (!this.room) return;
    this.syncConnectedFlags();
    for (const ws of this.ctx.getWebSockets()) {
      const player = this.playerForSocket(ws);
      if (!player) continue;
      try { ws.send(JSON.stringify({ type: 'state', state: boardPublicState(this.room, player.id) })); } catch {}
    }
  }

  async persistAndBroadcast() {
    await this.persist();
    this.broadcastState();
  }

  async webSocketMessage(ws, raw) {
    if (!this.room) return;
    const player = this.playerForSocket(ws);
    if (!player) return;
    if (!this.allowMessage(player.id)) return this.sendError(ws, 'طلبات كثيرة جدًا، حاول بعد لحظة');

    const rawText = typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
    if (rawText.length > 4096) return this.sendError(ws, 'الرسالة أكبر من المسموح');
    let msg;
    try { msg = JSON.parse(rawText); }
    catch { return this.sendError(ws, 'رسالة غير صالحة'); }

    try {
      switch (msg.type) {
        case 'join':
          ws.send(JSON.stringify({ type: 'state', state: boardPublicState(this.room, player.id) }));
          break;

        case 'ready':
          setBoardReady(this.room, player.id, msg.ready, Date.now());
          await this.persistAndBroadcast();
          break;

        case 'start':
          if (player.role !== 'host') return this.sendError(ws, 'للمضيف فقط');
          startBoardMatch(this.room, secureUnit, Date.now());
          await this.persistAndBroadcast();
          this.broadcastEvent({ type: 'match_started', gameType: this.room.gameType });
          break;

        case 'roll':
        case 'play_card':
        case 'select_move': {
          const result = applyBoardCommand(this.room, player.id, msg, secureUnit, Date.now());
          await this.persist();
          this.broadcastEvent(result.event);
          this.broadcastState();
          if (result.finished) this.broadcastEvent({ type: 'match_finished', gameType: this.room.gameType });
          break;
        }

        case 'rematch':
          if (player.role !== 'host' || this.room.status !== 'finished') return this.sendError(ws, 'للمضيف فقط بعد نهاية المباراة');
          resetBoardMatch(this.room, Date.now());
          await this.persistAndBroadcast();
          break;

        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', at: Date.now() }));
          break;

        default:
          this.sendError(ws, 'أمر غير معروف');
      }
    } catch (error) {
      const code = String(error?.message || error);
      const messages = {
        wrong_turn: 'ليس دورك الآن',
        players_not_ready: 'كل اللاعبين يجب أن يكونوا جاهزين',
        snakes_requires_2_to_4_players: 'السلم والثعبان يحتاج من لاعبين إلى أربعة',
        jackaroo_requires_4_players: 'جاكارو يحتاج أربعة لاعبين بالضبط',
        illegal_jackaroo_action: 'الحركة غير قانونية',
        invalid_card: 'الورقة غير صالحة',
        match_not_playing: 'المباراة غير جارية',
      };
      this.sendError(ws, messages[code] || 'تعذر تنفيذ الحركة');
    }
  }

  async webSocketClose(ws) {
    const player = this.playerForSocket(ws);
    if (!player || !this.room) return;
    player.connected = false;
    this.rateLimits.delete(player.id);
    await this.persist();
    this.broadcastEvent({ type: 'player_left', playerId: player.id, name: player.name });
    this.broadcastState();
  }

  async webSocketError(ws) {
    await this.webSocketClose(ws);
  }

  async alarm() {
    if (!this.room) return;
    if (Date.now() >= this.room.expiresAt) {
      for (const ws of this.ctx.getWebSockets()) {
        try { ws.close(4004, 'room_expired'); } catch {}
      }
      await this.ctx.storage.deleteAll();
      this.room = null;
      return;
    }
    await this.ctx.storage.setAlarm(this.room.expiresAt);
  }
}
