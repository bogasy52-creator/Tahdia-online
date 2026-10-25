/* Tahdia 32.0.0 — Baloot bots.
   A bot only reads what its seat may see (balootView): its own hand, the
   face-up card, the bids, the cards already played and who played them.
   It bids from the strength of its hand, doubles carefully, cashes winners,
   draws trumps when its side bought Hokm, feeds points to a partner who is
   sure to win and throws its cheapest card when it cannot win. */
import {
  SUITS, rankOf, suitOf, teamOf, partnerOf, cardPoints, cardPower, trickWinner,
  balootActions, findProjects,
} from './baloot-engine.js';

const PLAIN_ORDER = ['7', '8', '9', 'J', 'Q', 'K', 'T', 'A'];
const TRUMP_ORDER = ['7', '8', 'Q', 'K', 'T', 'A', '9', 'J'];
const LEVELS = { easy: { noise: 0.9, bid: 1.25, sun: 5 }, medium: { noise: 0.35, bid: 1, sun: 4.6 }, hard: { noise: 0, bid: 0.92, sun: 4.5 } };
export const BOT_LEVELS = LEVELS;

function hokmStrength(cards, trump) {
  const trumps = cards.filter((c) => suitOf(c) === trump);
  const value = { J: 3, 9: 2.2, A: 1.4, T: 1, K: 0.6, Q: 0.5, 8: 0.35, 7: 0.35 };
  let score = trumps.reduce((n, c) => n + value[rankOf(c)], 0);
  for (const suit of SUITS) {
    if (suit === trump) continue;
    const held = cards.filter((c) => suitOf(c) === suit).map(rankOf);
    if (held.includes('A')) score += 1;
    if (held.includes('T')) score += held.includes('A') ? 0.6 : 0.25;
    if (!held.length && trumps.length >= 3) score += 0.4;
  }
  if (trumps.length >= 4) score += 0.6;
  return score;
}

function sunStrength(cards) {
  let score = 0;
  for (const suit of SUITS) {
    const held = cards.filter((c) => suitOf(c) === suit).map(rankOf);
    if (held.includes('A')) score += 1.6;
    if (held.includes('T')) score += held.includes('A') ? 1.1 : held.length >= 2 ? 0.45 : 0.1;
    if (held.includes('K') && (held.includes('A') || held.includes('T'))) score += 0.35;
    if (held.length >= 4 && held.includes('A')) score += 0.5;
  }
  return score;
}

/* ---------- Bidding ---------- */

function bid(view, seat, options, level) {
  const hand = view.hands[seat];
  const withCard = [...hand, view.exposed];
  const has = (o) => options.find((x) => x.bid === o);
  const b = view.bidding;
  const partnerBid = b.bids.find((x) => x.seat === partnerOf(seat) && x.bid !== 'pass');
  const sun = sunStrength(withCard);
  const sunNeed = level.sun * level.bid;
  const hokmNeed = 4.6 * level.bid;
  if (b.confirm === seat) {
    return sun >= sunNeed + 0.6 && sun > hokmStrength(withCard, b.hokm.suit) * 0.9 ? { type: 'bid', bid: 'sun' } : { type: 'bid', bid: 'hokm', suit: b.hokm.suit };
  }
  // A strong Sun hand takes the deal; low face-up cards go to the partner.
  if (has('sun') && sun >= sunNeed && !(partnerBid && partnerBid.bid === 'hokm' && sun < sunNeed + 1)) {
    if (has('ashkal') && ['7', '8', '9'].includes(rankOf(view.exposed)) && sunStrength(hand) >= sunNeed) return { type: 'bid', bid: 'ashkal' };
    return { type: 'bid', bid: 'sun' };
  }
  const hokmOptions = options.filter((o) => o.bid === 'hokm');
  let best = null;
  for (const o of hokmOptions) {
    const strength = hokmStrength(withCard, o.suit);
    if (!best || strength > best.strength) best = { suit: o.suit, strength };
  }
  if (best && best.strength >= hokmNeed && !partnerBid) return { type: 'bid', bid: 'hokm', suit: best.suit };
  return { type: 'bid', bid: 'pass' };
}

function double(view, seat, options, level) {
  const c = view.contract;
  const hand = view.hands[seat];
  const call = (name) => options.find((o) => o.call === name);
  if (c.type === 'sun') {
    const aces = hand.filter((x) => rankOf(x) === 'A').length;
    return aces >= 3 && level.noise < 0.5 && call('double') ? { type: 'double', call: 'double', locked: false } : { type: 'double', call: 'pass' };
  }
  const trumps = hand.filter((x) => suitOf(x) === c.trump);
  const strength = hokmStrength(hand, c.trump);
  const mine = teamOf(seat) === teamOf(c.buyer);
  if (!mine && call('double')) {
    const strongTrumps = trumps.some((x) => rankOf(x) === 'J') && trumps.length >= 3 || trumps.filter((x) => ['J', '9'].includes(rankOf(x))).length === 2 && trumps.length >= 2;
    if (strongTrumps && strength >= 5.4 * level.bid) return { type: 'double', call: 'double', locked: false };
  }
  if (mine && call('triple') && strength >= 8.5 * level.bid) return { type: 'double', call: 'triple' };
  if (!mine && call('four') && strength >= 8 * level.bid) return { type: 'double', call: 'four', locked: false };
  if (mine && call('gahwa') && strength >= 10.5 * level.bid) return { type: 'double', call: 'gahwa' };
  return { type: 'double', call: 'pass' };
}

/* ---------- Card play ---------- */

function knowledge(view) {
  const played = new Set(view.played || []);
  const voids = [new Set(), new Set(), new Set(), new Set()];
  const c = view.contract;
  const tricks = [...(view.tricks || []), ...(view.trick?.cards?.length ? [{ cards: view.trick.cards }] : [])];
  for (const t of tricks) {
    const led = suitOf(t.cards[0].card);
    for (const { seat, card } of t.cards.slice(1)) {
      if (suitOf(card) !== led) {
        voids[seat].add(led);
        if (c.type === 'hokm' && suitOf(card) !== c.trump) voids[seat].add(c.trump);
      }
    }
  }
  return { played, voids };
}

function order(contract, suit) {
  return contract.type === 'hokm' && suit === contract.trump ? TRUMP_ORDER : PLAIN_ORDER;
}

// No card still out (not played, not in my hand) beats this one in its suit.
function isMaster(card, view, seat, played) {
  const suit = suitOf(card);
  const ranks = order(view.contract, suit);
  const mine = new Set(view.hands[seat]);
  for (let i = ranks.indexOf(rankOf(card)) + 1; i < ranks.length; i++) {
    const other = ranks[i] + suit;
    if (!played.has(other) && !mine.has(other)) return false;
  }
  return true;
}

function outstanding(suit, view, seat, played) {
  const mine = new Set(view.hands[seat]);
  return PLAIN_ORDER.map((r) => r + suit).filter((c) => !played.has(c) && !mine.has(c)).length;
}

const cheapest = (cards, contract) => [...cards].sort((a, b) => cardPoints(a, contract) - cardPoints(b, contract) || cardPower(a, contract, suitOf(a)) - cardPower(b, contract, suitOf(b)))[0];

function lead(view, seat, legal, info) {
  const c = view.contract;
  const hokm = c.type === 'hokm';
  const ourBuy = teamOf(c.buyer) === teamOf(seat);
  const opponents = [(seat + 1) % 4, (seat + 3) % 4];
  // Draw trumps while the opponents may still hold some.
  if (hokm && ourBuy) {
    const trumps = legal.filter((x) => suitOf(x) === c.trump);
    const oppHaveTrumps = opponents.some((o) => !info.voids[o].has(c.trump)) && outstanding(c.trump, view, seat, info.played) > 0;
    const top = trumps.find((x) => isMaster(x, view, seat, info.played));
    if (top && oppHaveTrumps) return top;
  }
  // Cash winners in suits the opponents can still follow.
  const masters = legal.filter((x) => (!hokm || suitOf(x) !== c.trump) && isMaster(x, view, seat, info.played));
  const safe = masters.filter((x) => !hokm || opponents.every((o) => !info.voids[o].has(suitOf(x)) || info.voids[o].has(c.trump)));
  if (safe.length) return safe.sort((a, b) => cardPoints(b, c) - cardPoints(a, c))[0];
  // Give the partner a ruff: a suit the partner lacks while holding trumps.
  if (hokm) {
    const p = partnerOf(seat);
    const ruff = legal.filter((x) => suitOf(x) !== c.trump && info.voids[p].has(suitOf(x)) && !info.voids[p].has(c.trump));
    if (ruff.length) return cheapest(ruff, c);
  }
  // Otherwise a low card from the longest plain suit, never a lone Ten.
  const plain = legal.filter((x) => !hokm || suitOf(x) !== c.trump);
  const pool = plain.length ? plain : legal;
  const bySuit = {};
  for (const x of pool) (bySuit[suitOf(x)] ||= []).push(x);
  const suits = Object.keys(bySuit).sort((a, b) => bySuit[b].length - bySuit[a].length);
  for (const suit of suits) {
    const cards = bySuit[suit].sort((a, b) => cardPower(a, c, suit) - cardPower(b, c, suit));
    const low = cards[0];
    if (rankOf(low) === 'T' && cards.length === 1 && suits.length > 1) continue;
    return low;
  }
  return cheapest(pool, c);
}

function follow(view, seat, legal, info) {
  const c = view.contract;
  const cards = view.trick.cards;
  const led = suitOf(cards[0].card);
  const winning = trickWinner(cards, c);
  const last = cards.length === 3;
  const partnerWins = teamOf(winning.seat) === teamOf(seat);
  const winPower = cardPower(winning.card, c, led);
  const beats = legal.filter((x) => cardPower(x, c, led) > winPower);
  const pointsOnTable = cards.reduce((n, x) => n + cardPoints(x.card, c), 0);
  // Is the partner's card safe from the player(s) still to come?
  const toCome = [];
  for (let s = (seat + 1) % 4; toCome.length < 3 - cards.length; s = (s + 1) % 4) toCome.push(s);
  const partnerSafe = partnerWins && (last || (isMaster(winning.card, view, seat, info.played) && toCome.every((o) => !(c.type === 'hokm' && suitOf(winning.card) !== c.trump && info.voids[o].has(led) && !info.voids[o].has(c.trump)))));
  if (partnerWins && partnerSafe) {
    // Feed points without wasting a card that wins later.
    const feed = legal.filter((x) => !isMaster(x, view, seat, info.played) || rankOf(x) === 'T' && suitOf(x) === led);
    const pool = feed.length ? feed : legal;
    return [...pool].sort((a, b) => cardPoints(b, c) - cardPoints(a, c))[0];
  }
  if (beats.length && !partnerWins) {
    // Win as cheaply as possible; when others still play, prefer a sure winner.
    const sorted = [...beats].sort((a, b) => cardPower(a, c, led) - cardPower(b, c, led));
    if (last) return sorted[0];
    const sure = sorted.filter((x) => isMaster(x, view, seat, info.played));
    const worth = pointsOnTable >= 10 || view.tricks.length === 7;
    if (sure.length && (worth || cardPoints(sure[0], c) <= 4)) return sure[0];
    return worth ? sorted.at(-1) : sorted[0];
  }
  if (beats.length && partnerWins && !last) {
    // The partner's card may fall: take over only with a sure winner.
    const sure = beats.filter((x) => isMaster(x, view, seat, info.played)).sort((a, b) => cardPower(a, c, led) - cardPower(b, c, led));
    if (sure.length && pointsOnTable >= 10) return sure[0];
  }
  // Cannot (or need not) win: throw the cheapest card, keep winners.
  const keep = legal.filter((x) => !isMaster(x, view, seat, info.played));
  return cheapest(keep.length ? keep : legal, c);
}

function play(view, seat, options, level, rng) {
  const legal = options.map((o) => o.card);
  if (legal.length === 1) return { type: 'play', card: legal[0] };
  if (level.noise && rng() < level.noise * 0.25) return { type: 'play', card: legal[Math.floor(rng() * legal.length)] };
  const info = knowledge(view);
  const card = view.trick.cards.length ? follow(view, seat, legal, info) : lead(view, seat, legal, info);
  return { type: 'play', card: legal.includes(card) ? card : legal[0] };
}

// The action a bot takes for `seat`. `view` should be balootView(state, seat).
export function chooseBalootAction(view, seat, { level = 'hard', rng = Math.random } = {}) {
  const options = balootActions(view, seat);
  if (!options.length) return null;
  const profile = LEVELS[level] || LEVELS.hard;
  if (view.phase === 'bidding') return bid(view, seat, options.map(({ type, ...o }) => o), profile);
  if (view.phase === 'doubling') return double(view, seat, options.map(({ type, ...o }) => o), profile);
  if (view.phase === 'playing') return play(view, seat, options, profile, rng);
  return null;
}

export { findProjects };
