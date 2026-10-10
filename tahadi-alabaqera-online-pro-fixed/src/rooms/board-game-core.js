import { createSnakesServerGame, rollSnakesServer } from '../games/snakes-server.js';
import { createJackarooServerGame, playJackarooServer, publicJackarooGame } from '../games/jackaroo-server.js';

const TYPES = new Set(['snakes', 'jackaroo']);
const DAY = 24 * 60 * 60 * 1000;

function cleanName(value, fallback = 'لاعب') {
  return String(value || fallback).trim().replace(/[<>]/g, '').slice(0, 20) || fallback;
}

export function boardRoomCapacity(gameType) {
  if (!TYPES.has(gameType)) throw new Error('invalid_game_type');
  return 4;
}

export function createBoardRoom({ code, hostKey, gameType, now = Date.now() }) {
  if (!/^\d{6}$/.test(String(code || ''))) throw new Error('invalid_room_code');
  if (!TYPES.has(gameType)) throw new Error('invalid_game_type');
  return {
    code: String(code),
    hostKey: String(hostKey || ''),
    gameType,
    createdAt: now,
    updatedAt: now,
    expiresAt: now + DAY,
    status: 'lobby',
    players: {},
    order: [],
    game: null,
    lastEvent: null,
  };
}

export function addBoardPlayer(room, { id, token, name, role = 'guest', now = Date.now() }) {
  if (!room || room.status !== 'lobby') throw new Error('match_started');
  if (room.order.length >= boardRoomCapacity(room.gameType)) throw new Error('room_full');
  const playerId = String(id || '');
  const reconnectToken = String(token || '');
  if (!playerId || !reconnectToken) throw new Error('player_identity_required');
  if (room.players[playerId]) throw new Error('player_exists');
  const player = {
    id: playerId,
    token: reconnectToken,
    name: cleanName(name, `لاعب ${room.order.length + 1}`),
    role: role === 'host' ? 'host' : 'guest',
    seat: room.order.length,
    ready: false,
    connected: false,
  };
  room.players[playerId] = player;
  room.order.push(playerId);
  room.updatedAt = now;
  return player;
}

export function setBoardReady(room, playerId, ready, now = Date.now()) {
  if (!room || room.status !== 'lobby') throw new Error('not_in_lobby');
  const player = room.players[playerId];
  if (!player) throw new Error('player_not_found');
  player.ready = Boolean(ready);
  room.updatedAt = now;
  return player.ready;
}

export function canStartBoardMatch(room) {
  const count = room.order.length;
  const enough = room.gameType === 'snakes' ? count >= 2 && count <= 4 : count === 4;
  return enough && room.order.every((id) => room.players[id]?.ready);
}

export function startBoardMatch(room, rng = Math.random, now = Date.now()) {
  if (!room || room.status !== 'lobby') throw new Error('not_in_lobby');
  if (room.gameType === 'snakes') {
    if (room.order.length < 2 || room.order.length > 4) throw new Error('snakes_requires_2_to_4_players');
  } else if (room.order.length !== 4) {
    throw new Error('jackaroo_requires_4_players');
  }
  if (!room.order.every((id) => room.players[id]?.ready)) throw new Error('players_not_ready');
  const names = room.order.map((id) => room.players[id].name);
  room.game = room.gameType === 'snakes'
    ? createSnakesServerGame(names)
    : createJackarooServerGame(names, rng);
  room.status = 'playing';
  room.lastEvent = { type: 'match_started', at: now };
  room.updatedAt = now;
  room.expiresAt = now + DAY;
  return room.game;
}

export function applyBoardCommand(room, playerId, message, rng = Math.random, now = Date.now()) {
  if (!room || room.status !== 'playing' || !room.game) throw new Error('match_not_playing');
  const player = room.players[playerId];
  if (!player) throw new Error('player_not_found');
  const type = String(message?.type || '');
  let result;
  if (room.gameType === 'snakes') {
    if (type !== 'roll') throw new Error('invalid_action');
    result = rollSnakesServer(room.game, player.seat, rng);
  } else {
    if (type !== 'play_card' && type !== 'select_move') throw new Error('invalid_action');
    result = playJackarooServer(room.game, player.seat, Number(message.cardIndex), message.action);
  }
  room.game = result.state;
  room.lastEvent = { ...result.event, at: now };
  room.updatedAt = now;
  const finished = room.gameType === 'snakes'
    ? room.game.winner !== null
    : room.game.winnerTeam !== null;
  if (finished) {
    room.status = 'finished';
    room.expiresAt = now + DAY;
  }
  return { event: room.lastEvent, finished };
}

export function resetBoardMatch(room, now = Date.now()) {
  if (!room) throw new Error('room_not_found');
  room.status = 'lobby';
  room.game = null;
  room.lastEvent = null;
  room.updatedAt = now;
  room.expiresAt = now + DAY;
  for (const id of room.order) room.players[id].ready = false;
  return room;
}

function publicPlayers(room) {
  return room.order.map((id) => {
    const p = room.players[id];
    return {
      id: p.id,
      name: p.name,
      role: p.role,
      seat: p.seat,
      ready: Boolean(p.ready),
      connected: Boolean(p.connected),
    };
  });
}

export function boardPublicState(room, viewerId) {
  const me = viewerId ? room.players[viewerId] : null;
  const base = {
    code: room.code,
    gameType: room.gameType,
    status: room.status,
    capacity: boardRoomCapacity(room.gameType),
    players: publicPlayers(room),
    me: me ? { id: me.id, role: me.role, seat: me.seat } : null,
    game: null,
    lastEvent: room.lastEvent ? structuredClone(room.lastEvent) : null,
  };
  if (!room.game) return base;
  if (room.gameType === 'snakes') {
    base.game = structuredClone(room.game);
  } else {
    base.game = publicJackarooGame(room.game, me?.seat);
  }
  return base;
}
