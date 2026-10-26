// Tahdia 32.0.0 — Baloot inside the BoardRoom Durable Object.
// The room owns the full match state; every player receives only the view of
// their own seat. Bots fill empty seats and play at once on the server: the
// events of one update (the human move, the bot moves after it, the next
// deal…) go out as one batch that each table animates in order. Only human
// turns, the lobby countdown of a public table and the pause between hands
// need an alarm, which keeps Durable Object requests low.
import { createBalootMatch, applyBalootAction, balootView, teamOf, partnerOf } from '../../public/assets/js/engines/baloot-engine.js';
import { chooseBalootAction } from '../../public/assets/js/engines/baloot-bot.js';

export const BALOOT_SEATS = [0, 2, 1, 3]; // the first two players are partners
export const BALOOT_LOBBY_MS = 10_000;
export const BALOOT_NEXT_HAND_MS = 6_500;
export const BALOOT_AWAY_MS = 9_000;
const TURN_MS = { bidding: 20_000, doubling: 15_000, playing: 25_000 };
const BOT_NAMES = ['سلطان', 'نايف', 'بندر', 'مشعل', 'تركي', 'فيصل', 'ريان', 'فهد', 'عبدالله', 'خالد'];
// How long a table needs to show each event, so a human is never timed out
// while the moves before their turn are still on screen.
const SHOW_MS = { deal: 1900, bid: 800, second_round: 1200, redeal: 1300, contract: 2700, double: 1000, declare: 0, play: 420, baloot: 500, trick: 1150, projects: 2700, play_started: 0, claim: 2900 };

export function freeBalootSeat(room) {
  const taken = new Set(Object.values(room.players).map((p) => p.seat));
  return BALOOT_SEATS.find((seat) => !taken.has(seat)) ?? null;
}

export function balootHumanAt(room, seat) {
  return Object.values(room.players).find((p) => p.seat === seat) || null;
}

function showTime(events) {
  return events.reduce((ms, e) => ms + (SHOW_MS[e.type] || 0), 0);
}

function pushBatch(room, events, now) {
  if (!events.length) return;
  const id = (room.batch?.id || 0) + 1;
  room.batch = { id, at: now, events };
}

// The seat is played by the server: a bot, or a human who left the table.
function autoSeat(room, seat) {
  return room.bots?.includes(seat);
}

export function startBalootRoom(room, rng, now) {
  const names = [0, 1, 2, 3].map((seat) => balootHumanAt(room, seat)?.name || null);
  const pool = BOT_NAMES.filter((n) => !names.includes(n)).sort(() => rng() - 0.5);
  room.bots = [0, 1, 2, 3].filter((seat) => !names[seat]);
  room.botNames = {};
  for (const seat of room.bots) { names[seat] = pool.shift() || 'بوت'; room.botNames[seat] = names[seat]; }
  // 32.1.0: open play unless the room was made with strict rules
  room.state = createBalootMatch({ names, target: 152, rng, open: room.open !== false });
  room.status = 'playing';
  room.startedAt = now;
  room.rewardsComplete = false;
  room.nextHandAt = null;
  room.lobbyDeadline = null;
  const events = [{ type: 'deal', dealer: room.state.dealer, exposed: room.state.exposed }];
  runBalootBots(room, rng, now, events);
  pushBatch(room, events, now);
  scheduleBalootTurn(room, now, events);
  return events;
}

// Let bots (and absent players, after their grace) act until a human must.
export function runBalootBots(room, rng, now, events, { level = 'hard' } = {}) {
  let guard = 0;
  while (room.state && ['bidding', 'doubling', 'playing'].includes(room.state.phase) && autoSeat(room, room.state.turn) && guard++ < 200) {
    const seat = room.state.turn;
    // a bot never cuts for a team that has a human in it
    const action = chooseBalootAction(balootView(room.state, seat), seat, { level, rng, honest: !autoSeat(room, partnerOf(seat)) });
    if (!action) break;
    const result = applyBalootAction(room.state, seat, action, rng);
    room.state = result.state;
    events.push(...result.events);
  }
  return events;
}

export function scheduleBalootTurn(room, now, events) {
  const s = room.state;
  room.turnDeadline = null;
  room.turnTotal = null;
  room.nextHandAt = null;
  if (!s) return;
  const showing = showTime(events);
  if (s.phase === 'scored') { room.nextHandAt = now + showing + BALOOT_NEXT_HAND_MS; return; }
  if (s.phase === 'finished') { room.status = 'finished'; room.expiresAt = now + 24 * 60 * 60 * 1000; return; }
  const human = balootHumanAt(room, s.turn);
  const total = human && !human.connected ? BALOOT_AWAY_MS : TURN_MS[s.phase] || 20_000;
  room.turnTotal = total;
  room.turnDeadline = now + showing + total;
}

export function applyBalootMove(room, player, action, rng, now) {
  if (!room.state || room.status !== 'playing') throw new Error('match_not_playing');
  const clean = sanitizeAction(action);
  // a claim (open play) may come from anyone at any moment of the hand
  if (clean.type !== 'claim' && room.state.turn !== player.seat) throw new Error('wrong_turn');
  const result = applyBalootAction(room.state, player.seat, clean, rng);
  room.state = result.state;
  const events = [...result.events];
  runBalootBots(room, rng, now, events);
  pushBatch(room, events, now);
  scheduleBalootTurn(room, now, events);
  return events;
}

function sanitizeAction(action) {
  const type = String(action?.type || '');
  if (type === 'bid') return { type, bid: String(action.bid || ''), suit: action.suit ? String(action.suit).slice(0, 1) : undefined };
  if (type === 'double') return { type, call: String(action.call || ''), locked: Boolean(action.locked) };
  if (type === 'play') return { type, card: String(action.card || '').slice(0, 2) };
  if (type === 'claim') return { type };
  throw new Error('invalid_action');
}

// Alarm work: start a public table, deal the next hand, or play for a human
// whose time ran out.
export function balootAlarm(room, rng, now) {
  if (room.status === 'lobby' && room.publicMatch && room.lobbyDeadline && now >= room.lobbyDeadline) {
    if (!Object.keys(room.players).length) return 'empty';
    startBalootRoom(room, rng, now);
    return 'started';
  }
  if (room.status !== 'playing' || !room.state) return null;
  if (room.state.phase === 'scored' && room.nextHandAt && now >= room.nextHandAt) {
    const result = applyBalootAction(room.state, null, { type: 'next' }, rng);
    room.state = result.state;
    const events = [...result.events];
    runBalootBots(room, rng, now, events);
    pushBatch(room, events, now);
    scheduleBalootTurn(room, now, events);
    return 'dealt';
  }
  if (room.turnDeadline && now >= room.turnDeadline && ['bidding', 'doubling', 'playing'].includes(room.state.phase)) {
    const seat = room.state.turn;
    const action = chooseBalootAction(balootView(room.state, seat), seat, { level: 'medium', rng, honest: true });
    const result = applyBalootAction(room.state, seat, action, rng);
    room.state = result.state;
    const events = [...result.events];
    runBalootBots(room, rng, now, events);
    pushBatch(room, events, now);
    scheduleBalootTurn(room, now, events);
    return 'timeout';
  }
  return null;
}

export function balootPlayers(room) {
  const list = [];
  for (const p of Object.values(room.players)) list.push({ id: p.id, index: p.seat, name: p.name, role: p.role, ready: Boolean(p.ready), connected: Boolean(p.connected), bot: false, character: p.character || '' });
  for (const seat of room.bots || []) list.push({ id: 'bot-' + seat, index: seat, name: room.botNames?.[seat] || 'بوت', role: 'bot', ready: true, connected: true, bot: true, character: '' });
  return list.sort((a, b) => a.index - b.index);
}

export function balootRoomView(room, player) {
  const seat = player ? player.seat : 0;
  return {
    state: room.state ? balootView(room.state, seat) : null,
    batch: room.batch || null,
    publicMatch: Boolean(room.publicMatch),
    lobbyDeadline: room.lobbyDeadline || null,
    turnTotal: room.turnTotal || null,
    nextHandAt: room.nextHandAt || null,
  };
}

export function balootWinFor(room, player) {
  return room.state?.winner === teamOf(player.seat);
}
