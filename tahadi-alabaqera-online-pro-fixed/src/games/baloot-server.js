// Tahdia 32.0.0 — Baloot inside the BoardRoom Durable Object.
// The room owns the full match state; every player receives only the view of
// their own seat. Bots fill empty seats and play at once on the server: the
// events of one update (the human move, the bot moves after it, the next
// deal…) go out as one batch that each table animates in order. Only human
// turns, the lobby countdown of a public table and the pause between hands
// need an alarm, which keeps Durable Object requests low.
import { createBalootMatch, applyBalootAction, balootView, teamOf, partnerOf, provenCuts, balootPublicTricks } from '../../public/assets/js/engines/baloot-engine.js';
import { chooseBalootAction } from '../../public/assets/js/engines/baloot-bot.js';
import { pickBotLevel } from './board-tables.js';

export const BALOOT_SEATS = [0, 2, 1, 3]; // the first two players are partners
export const BALOOT_LOBBY_MS = 10_000;
export const BALOOT_NEXT_HAND_MS = 6_500;
export const BALOOT_AWAY_MS = 9_000;
const TURN_MS = { bidding: 20_000, doubling: 15_000, playing: 25_000 };
const BOT_NAMES = ['سلطان', 'نايف', 'بندر', 'مشعل', 'تركي', 'فيصل', 'ريان', 'فهد', 'عبدالله', 'خالد'];
// How long a table needs to show each event, so a human is never timed out
// while the moves before their turn are still on screen.
const SHOW_MS = { deal: 2300, bid: 1000, second_round: 1300, redeal: 1500, contract: 3000, double: 1300, declare: 0, play: 650, baloot: 600, trick: 1500, projects: 3000, play_started: 0, claim: 3300 };

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
  // 33.0.0: bots of every strength — sometimes easy, sometimes hard
  room.botLevels = {};
  for (const seat of room.bots) { names[seat] = pool.shift() || 'بوت'; room.botNames[seat] = names[seat]; room.botLevels[seat] = pickBotLevel(rng); }
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
export function runBalootBots(room, rng, now, events, { level = null } = {}) {
  let guard = 0;
  while (room.state && !room.state.review && ['bidding', 'doubling', 'playing'].includes(room.state.phase) && autoSeat(room, room.state.turn) && guard++ < 200) {
    const seat = room.state.turn;
    // a bot never cuts for a team that has a human in it
    const action = chooseBalootAction(balootView(room.state, seat), seat, { level: level || room.botLevels?.[seat] || 'hard', rng, honest: !autoSeat(room, partnerOf(seat)) });
    if (!action) break;
    if(action.type==='claim'){
      const proof=provenCuts(balootView(room.state,seat),1-teamOf(seat))[0];
      if(!proof)break;
      const follow=balootPublicTricks(room.state).find(t=>t.cards.some(p=>p.seat===proof.seat&&p.card===proof.shown));
      Object.assign(action,{type:'review_claim',target:proof.seat,reason:'cut',card:proof.card,tricks:[...new Set([proof.trick,...(follow?[follow.index]:[])])]});
    }
    const result = applyBalootAction(room.state, seat, action, rng);
    room.state = result.state;
    if(room.state.review)room.state.review.automatic=true;
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
  if(s.review){if(room.reviewId!==s.review.id){room.reviewId=s.review.id;room.reviewUntil=now+(s.review.automatic?4500:30000);}s.review.deadline=room.reviewUntil;room.turnDeadline=room.reviewUntil;room.turnTotal=30000;return;}
  room.reviewId=null;room.reviewUntil=null;
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
  if (!['review_claim','confirm_review','cancel_review'].includes(clean.type) && room.state.turn !== player.seat) throw new Error('wrong_turn');
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
  if (type === 'play') return { type, card: String(action.card || '').slice(0, 2), projects: Array.isArray(action.projects)?action.projects.slice(0,3):[] };
  if(type==='review_projects')return {type};
  if(type==='review_claim')return {type,target:action.target,reason:action.reason,project:action.project,card:String(action.card||'').slice(0,2),tricks:Array.isArray(action.tricks)?action.tricks.slice(0,9):null};
  if(['confirm_review','cancel_review'].includes(type))return {type,reviewId:String(action.reviewId||'').slice(0,80)};
  if(type==='show_projects'||type==='claim')throw new Error('review_required');

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
  if(room.state.review){
    if(now<(room.reviewUntil||Infinity))return null;
    const pending=room.state.review,result=applyBalootAction(room.state,pending.seat,{type:pending.automatic?'confirm_review':'cancel_review',reviewId:pending.id},rng);room.state=result.state;const events=[...result.events];runBalootBots(room,rng,now,events);pushBatch(room,events,now);scheduleBalootTurn(room,now,events);return 'review_timeout';
  }
  if (room.turnDeadline && now >= room.turnDeadline && ['bidding', 'doubling', 'playing'].includes(room.state.phase)) {
    const seat = room.state.turn;
    const action = chooseBalootAction(balootView(room.state, seat), seat, { level: 'medium', rng, honest: true });
    if(action.type==='play'&&!(room.bots||[]).includes(seat))action.projects=[];
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
  for (const seat of room.bots || []) list.push({ id: 'bot-' + seat, index: seat, name: room.botNames?.[seat] || 'بوت', role: 'bot', ready: true, connected: true, bot: true, level: room.botLevels?.[seat] || 'hard', character: '' });
  return list.sort((a, b) => a.index - b.index);
}

export function balootRoomView(room, player) {
  const seat = player ? player.seat : 0;
  return {
    state: room.state ? balootView(room.state, seat) : null,
    batch: room.batch || null,
    publicMatch: Boolean(room.publicMatch),
    open: room.open !== false,
    lobbyDeadline: room.lobbyDeadline || null,
    turnTotal: room.turnTotal || null,
    nextHandAt: room.nextHandAt || null,
  };
}

export function balootWinFor(room, player) {
  return room.state?.winner === teamOf(player.seat);
}
