// Tahdia 33.0.0 — the board tables (السلم والثعبان، الزهرة، جاكارو، تحدي النرد)
// inside the BoardRoom Durable Object.
// - A table starts with whoever is in the room. Seats nobody took are given to
//   bots, a mix of easy, medium and hard; a quick table (العب الحين) is filled
//   to a comfortable size, a friends' room only to the smallest real table.
// - Bots play at once on the server. Every move (the player's and the bots'
//   after it) is kept as a step, so each table animates them in order, and one
//   player action costs one Durable Object request however many bots answer.
// - Each seat carries its owner's dice, stone and character from the shop.
import { createSnakesServerGame, rollSnakesServer } from './snakes-server.js';
import { createLudoGame, getLegalLudoMoves, applyLudoMove, passLudoTurn } from '../../public/assets/js/engines/ludo-engine.js';
import { createJackarooGame, getJackarooActions, playJackarooAction } from '../../public/assets/js/engines/jackaroo-engine.js';
import { createRaceDiceGame, rollRaceDice, bankRaceDice } from '../../public/assets/js/engines/dice-engine.js';
import { chooseJackarooMove, chooseLudoMove, chooseSnakePower, shouldBankDice } from '../../public/assets/js/engines/bot-strategy.js';
import { Career } from '../career/core.js';

export const TABLE_GAMES = Object.freeze(['snakes', 'zahra', 'jackaroo', 'dice']);
export const MAX_SEATS = Object.freeze({ snakes: 10, zahra: 6, jackaroo: 6, dice: 10 });
export const QUICK_SEATS = Object.freeze({ snakes: 4, zahra: 4, jackaroo: 4, dice: 3 });
export const TABLE_LOBBY_MS = 10_000;
// a group room's table starts when all its players are in, or this long after the first one came
export const PARTY_TABLE_WAIT_MS = 30_000;
export const DICE_TARGET = 50;
// how long a table needs on screen for one step (dice, walk, ladder or snake…)
export const STEP_MS = Object.freeze({ snakes: 2700, zahra: 1250, jackaroo: 1500, dice: 900 });
export const TURN_MS = Object.freeze({ room: 60_000, quick: 35_000, away: 9_000 });
export const MAX_STEPS = 60;
export const BOT_NAMES = Object.freeze(['سلطان', 'نايف', 'بندر', 'مشعل', 'تركي', 'فيصل', 'ريان', 'فهد', 'عبدالله', 'خالد', 'نورة', 'ريم', 'سارة', 'هيا', 'لمى', 'جود', 'منيرة', 'عبير']);
export const BOT_LEVELS = Object.freeze(['easy', 'medium', 'hard']);

const items = (type) => (Career?.CATALOG || []).filter((item) => item.type === type).map((item) => item.id);
const DICE = items('dice'), PAWNS = items('pawn'), HEROES = (Career?.HEROES || []).map((hero) => hero.id);
export const DEFAULT_LOOK = Object.freeze({ dice: 'dice-ivory', pawn: 'pawn-classic', character: 'fox' });
/** The dice and stones everyone owns: what a guest (no account) may show. */
export const FREE_LOOK_ITEMS = Object.freeze((Career?.CATALOG || []).filter((item) => (item.type === 'dice' || item.type === 'pawn') && item.price === 0 && !item.source).map((item) => item.id));

/** A seat's look from what its owner equipped; anything unknown falls back to the default. */
export function cleanLook({ dice, pawn, character } = {}) {
  const hero = String(character || '').replace(/^character-/, '');
  return {
    dice: DICE.includes(dice) ? dice : DEFAULT_LOOK.dice,
    pawn: PAWNS.includes(pawn) ? pawn : DEFAULT_LOOK.pawn,
    character: HEROES.includes(hero) ? hero : DEFAULT_LOOK.character,
  };
}

/** Bots come in all strengths: 35% easy, 40% medium, 25% hard. */
export function pickBotLevel(rng = Math.random) {
  const x = rng();
  return x < 0.35 ? 'easy' : x < 0.75 ? 'medium' : 'hard';
}

/** How many seats the table gets for this many players. */
export function seatsFor(game, humans, quick = false) {
  if (game === 'jackaroo') return humans > 4 ? 6 : 4;
  const least = quick ? QUICK_SEATS[game] : 2;
  return Math.min(MAX_SEATS[game], Math.max(least, humans));
}

/** Seat → player id (null for a bot). In Jackaroo the first players in sit as partners. */
export function seatPlan(game, humanIds, seats) {
  const order = Array(seats).fill(null);
  const pattern = game === 'jackaroo' ? (seats === 6 ? [0, 2, 4, 1, 3, 5] : [0, 2, 1, 3]) : [...Array(seats).keys()];
  humanIds.slice(0, seats).forEach((id, i) => { order[pattern[i]] = id; });
  return order;
}

function makeBot(seat, rng, taken) {
  const pool = BOT_NAMES.filter((name) => !taken.has(name));
  const name = pool.length ? pool[Math.floor(rng() * pool.length)] : 'بوت ' + (seat + 1);
  taken.add(name);
  const pick = (list) => list[Math.floor(rng() * list.length)] || null;
  return {
    id: 'bot:' + seat + ':' + Math.floor(rng() * 1e9).toString(36),
    bot: true, level: pickBotLevel(rng), name, role: 'bot', ready: true, connected: true, disconnectedAt: null,
    look: cleanLook({ dice: pick(DICE), pawn: rng() < 0.6 ? 'pawn-character' : pick(PAWNS), character: pick(HEROES) }),
  };
}

function createState(game, names, variant, rng) {
  if (game === 'snakes') return createSnakesServerGame(names, { variant: variant || 'classic' });
  if (game === 'zahra') return createLudoGame(names);
  if (game === 'jackaroo') return createJackarooGame(names, { rng });
  return createRaceDiceGame(names, DICE_TARGET);
}

// Dice come from `roll` (1–6); everything else random from `rng`. The room passes its own
// server die, so a test can set the dice without touching names or shuffles.
const rollWith = (rng) => () => 1 + Math.floor(rng() * 6);
const unitOf = (roll) => () => (roll() - 1) / 6;
export const tableOver = (room) => {
  const s = room.state;
  if (!s) return true;
  return room.game === 'jackaroo' ? s.winnerTeam !== null && s.winnerTeam !== undefined : s.winner !== null && s.winner !== undefined;
};

/* ---------- steps: what each table animates, in order ---------- */
export function beginSteps(room) { return { from: room.version, list: [] }; }
export function recordStep(room, steps) {
  room.version = (room.version || 0) + 1;
  steps.list.push({ version: room.version, state: structuredClone(room.state), pendingRoll: room.pendingRoll ?? null });
  if (steps.list.length > MAX_STEPS) steps.list.splice(0, steps.list.length - MAX_STEPS);
}
export const stepsTime = (room, steps) => (steps?.list?.length || 0) * (STEP_MS[room.game] || 1000);

/* ---------- starting a table ---------- */
export function startTable(room, { quick = false, rng = Math.random, roll = rollWith(rng), now = Date.now() } = {}) {
  const humans = room.order.filter((id) => room.players[id] && !room.players[id].bot);
  const seats = seatsFor(room.game, humans.length, quick);
  const plan = seatPlan(room.game, humans, seats);
  const taken = new Set(humans.map((id) => room.players[id].name));
  for (let seat = 0; seat < seats; seat++) {
    if (plan[seat]) continue;
    const bot = makeBot(seat, rng, taken);
    room.players[bot.id] = bot;
    plan[seat] = bot.id;
  }
  // a player beyond the table's seats (never more than the room allows) waits out this match
  room.order = plan;
  room.state = createState(room.game, plan.map((id) => room.players[id].name), room.variant, rng);
  room.status = 'playing';
  room.startedAt = now;
  room.rewardsComplete = false;
  room.pendingRoll = null;
  room.lobbyDeadline = null;
  for (const id of plan) room.players[id].ready = true;
  const steps = beginSteps(room);
  recordStep(room, steps); // the starting position
  runBots(room, steps, rng, roll);
  return steps;
}

/** Drops the bots of the last match, back to the lobby with the same people. */
export function resetTable(room) {
  for (const id of Object.keys(room.players)) if (room.players[id].bot) delete room.players[id];
  room.order = room.order.filter((id) => room.players[id]);
  room.state = null;
  room.pendingRoll = null;
  room.turnDeadline = null;
}

/* ---------- moves ---------- */
const seatOf = (room) => room.state.turn;
export const seatIsBot = (room, seat) => Boolean(room.players[room.order[seat]]?.bot);

function playSnakes(room, seat, roll, power = null) {
  room.state = rollSnakesServer(room.state, seat, unitOf(roll), { power }).state;
}
function rollZahra(room, roll) {
  const value = roll(), legal = getLegalLudoMoves(room.state, value);
  if (!legal.length) { room.state = passLudoTurn(room.state, value); room.pendingRoll = null; return null; }
  room.pendingRoll = value;
  return value;
}
function moveZahra(room, token) {
  room.state = applyLudoMove(room.state, token, room.pendingRoll);
  room.pendingRoll = null;
}

/** One bot turn (Zahra: the roll and the move are two steps). */
export function botTurn(room, steps, rng, roll = rollWith(rng)) {
  const seat = seatOf(room), bot = room.players[room.order[seat]], level = bot?.level || 'medium';
  const s = room.state;
  if (room.game === 'snakes') {
    const want = chooseSnakePower(s, level, rng);
    playSnakes(room, seat, roll, want === 'double' && s.rulesVersion === 2 && s.players[seat].double > 0 && s.players[seat].position > 0 ? 'double' : null);
    recordStep(room, steps);
  } else if (room.game === 'zahra') {
    const value = room.pendingRoll ?? rollZahra(room, roll);
    recordStep(room, steps);
    if (value !== null) { moveZahra(room, chooseLudoMove(room.state, value, level, rng)); recordStep(room, steps); }
  } else if (room.game === 'jackaroo') {
    const move = chooseJackarooMove(s, level, rng) || firstJackarooMove(s, seat);
    if (!move) return false;
    room.state = playJackarooAction(s, move.cardIndex, move.action, seat);
    recordStep(room, steps);
  } else {
    if (s.turnTotal > 0 && shouldBankDice(s, level)) room.state = bankRaceDice(s);
    else room.state = rollRaceDice(s, roll());
    trimDice(room);
    recordStep(room, steps);
  }
  return true;
}
function firstJackarooMove(state, seat) {
  const hand = state.hands?.[seat] || [];
  for (let cardIndex = 0; cardIndex < hand.length; cardIndex++) {
    const legal = getJackarooActions(state, cardIndex, seat);
    const action = legal.find((a) => a.type !== 'discard') || legal[0];
    if (action) return { cardIndex, action };
  }
  return null;
}
const trimDice = (room) => { if (room.state?.history?.length > 30) room.state.history = room.state.history.slice(-30); };

/** Bots act until a person must, or the match ends. */
export function runBots(room, steps, rng, roll = rollWith(rng)) {
  let guard = 0;
  while (room.status === 'playing' && !tableOver(room) && seatIsBot(room, seatOf(room)) && guard++ < 500) {
    if (!botTurn(room, steps, rng, roll)) break;
  }
  return steps;
}

/** A person's move. Returns the steps, or throws a short reason. */
export function playerMove(room, seat, msg, rng, roll = rollWith(rng)) {
  if (room.status !== 'playing' || !room.state || tableOver(room)) throw new Error('match_not_playing');
  if (seat !== seatOf(room)) throw new Error('wrong_turn');
  const steps = beginSteps(room);
  if (room.game === 'snakes') {
    if (msg.type !== 'roll') throw new Error('invalid_action');
    const power = msg.power ?? null, p = room.state.players[seat];
    if (power !== null && (power !== 'double' || room.state.rulesVersion !== 2 || !(p.double > 0) || p.position === 0)) throw new Error('power_unavailable');
    playSnakes(room, seat, roll, power);
  } else if (room.game === 'zahra') {
    if (msg.type === 'roll') { if (room.pendingRoll !== null) throw new Error('move_first'); rollZahra(room, roll); }
    else if (msg.type === 'ludo_move') { if (room.pendingRoll === null) throw new Error('roll_first'); moveZahra(room, Number(msg.token)); }
    else throw new Error('invalid_action');
  } else if (room.game === 'jackaroo') {
    if (msg.type !== 'jackaroo_play') throw new Error('invalid_action');
    const cardIndex = Number(msg.cardIndex), legal = getJackarooActions(room.state, cardIndex, seat), sig = JSON.stringify(msg.action);
    if (!legal.some((a) => JSON.stringify(a) === sig)) throw new Error('illegal_move');
    room.state = playJackarooAction(room.state, cardIndex, msg.action, seat);
  } else {
    if (msg.type === 'dice_roll') room.state = rollRaceDice(room.state, roll());
    else if (msg.type === 'dice_bank') { if (!(room.state.turnTotal > 0)) throw new Error('roll_first'); room.state = bankRaceDice(room.state); }
    else throw new Error('invalid_action');
    trimDice(room);
  }
  recordStep(room, steps);
  if (room.game !== 'zahra' || room.pendingRoll === null) runBots(room, steps, rng, roll);
  return steps;
}

/** The server plays for a person whose time ran out (a fair, plain move; never a power). */
export function timeoutMove(room, rng, roll = rollWith(rng)) {
  if (room.status !== 'playing' || !room.state || tableOver(room)) return null;
  const seat = seatOf(room), steps = beginSteps(room), s = room.state;
  if (room.game === 'snakes') { playSnakes(room, seat, roll, null); recordStep(room, steps); }
  else if (room.game === 'zahra') {
    const value = room.pendingRoll ?? rollZahra(room, roll);
    recordStep(room, steps);
    if (value !== null) { moveZahra(room, chooseLudoMove(room.state, value, 'medium', rng)); recordStep(room, steps); }
  } else if (room.game === 'jackaroo') {
    const move = chooseJackarooMove(s, 'medium', rng) || firstJackarooMove(s, seat);
    if (!move) return null;
    room.state = playJackarooAction(s, move.cardIndex, move.action, seat);
    recordStep(room, steps);
  } else {
    room.state = s.turnTotal > 0 ? bankRaceDice(s) : rollRaceDice(s, roll());
    trimDice(room);
    recordStep(room, steps);
  }
  runBots(room, steps, rng, roll);
  return steps;
}

/** The winner seats of a finished table (a team in Jackaroo). */
export function winnerSeats(room) {
  const s = room.state;
  if (!s) return [];
  if (room.game === 'jackaroo') return s.winnerTeam === null || s.winnerTeam === undefined ? [] : room.order.map((_, i) => i).filter((i) => i % 2 === s.winnerTeam);
  return s.winner === null || s.winner === undefined ? [] : [s.winner];
}

/** How far each seat got, for rankings (party links, results). */
export function seatProgress(room, seat) {
  const sp = room.state?.players?.[seat] || {};
  if (room.game === 'snakes') return Number(sp.position) || 0;
  if (room.game === 'zahra') return (sp.tokens || []).reduce((n, t) => n + Math.max(0, t + 1), 0);
  if (room.game === 'jackaroo') return (sp.marbles || []).reduce((n, t) => n + Math.max(0, t + 1), 0);
  return Number(sp.score) || 0;
}
