/* Tahdia 32.0.0 — Saudi Baloot rules engine.
   Pure functions over a JSON state, shared by the table (offline against
   bots) and the BoardRoom Durable Object (online). Rules follow the common
   Saudi game as played in the big apps:
   - 4 players, partners opposite. Seats run anticlockwise: 0 bottom, 1 right,
     2 top, 3 left. Team 0 = seats 0 & 2, team 1 = seats 1 & 3.
   - 32 cards. 5 each, one card face up. Round 1: Hokm on that suit, Sun,
     Ashkal (dealer or dealer's left) or pass. A later Sun beats a Hokm; the
     Hokm bidder confirms or switches to Sun. Round 2: Hokm on another suit
     or Sun. All pass twice: new deal.
   - Hokm doubling: double (opponents), triple (buyers), four (opponents),
     gahwa (buyers, wins the match). Sun can be doubled only when the buyers
     are above 100 and the others below 100.
   - Card points 162 (Hokm) / 130 (Sun) including 10 for the last trick.
     Projects: sira, fifty, hundred, four hundred; Baloot (K+Q of trumps).
   - First team to 152 wins.
   - 32.1.0 open play (state.open): any card may be played. A card the rules
     do not allow is a "cut" (قطع), kept secret on the table; a player of the
     other team may claim (يسجّل) at any time in the hand. A right claim wins
     the hand for the claimers, a wrong one gives it to the accused team.
   Cards are two-letter strings: rank (7 8 9 T J Q K A) + suit (S H D C). */

export const SUITS = ['S', 'H', 'D', 'C'];
export const RANKS = ['7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
export const TARGET = 152;
const SEQUENCE = ['7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const PLAIN_ORDER = ['7', '8', '9', 'J', 'Q', 'K', 'T', 'A'];
const TRUMP_ORDER = ['7', '8', 'Q', 'K', 'T', 'A', '9', 'J'];
const PLAIN_POINTS = { A: 11, T: 10, K: 4, Q: 3, J: 2, 9: 0, 8: 0, 7: 0 };
const TRUMP_POINTS = { J: 20, 9: 14, A: 11, T: 10, K: 4, Q: 3, 8: 0, 7: 0 };
// Project values in game points [hokm, sun].
const PROJECT_POINTS = { sira: [2, 4], fifty: [5, 10], hundred: [10, 20], fourHundred: [10, 40] };
const PROJECT_RANK = { sira: 1, fifty: 2, hundred: 3, fourHundred: 4 };

export const rankOf = (card) => card[0];
export const suitOf = (card) => card[1];
export const teamOf = (seat) => seat % 2;
export const partnerOf = (seat) => (seat + 2) % 4;
export const nextSeat = (seat) => (seat + 1) % 4;
const clone = (value) => (typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)));

export function createDeck() {
  return SUITS.flatMap((suit) => RANKS.map((rank) => rank + suit));
}

export function shuffleDeck(deck = createDeck(), rng = Math.random) {
  const out = [...deck];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function cardPoints(card, contract) {
  if (contract?.type === 'hokm' && suitOf(card) === contract.trump) return TRUMP_POINTS[rankOf(card)];
  return PLAIN_POINTS[rankOf(card)];
}

// Strength of a card inside a trick: trumps beat everything, then the led
// suit; other cards never win.
export function cardPower(card, contract, ledSuit) {
  if (contract?.type === 'hokm' && suitOf(card) === contract.trump) return 100 + TRUMP_ORDER.indexOf(rankOf(card));
  if (suitOf(card) === ledSuit) return PLAIN_ORDER.indexOf(rankOf(card));
  return -1;
}

export function trickWinner(cards, contract) {
  if (!cards.length) return null;
  const led = suitOf(cards[0].card);
  let best = cards[0];
  for (const entry of cards.slice(1)) {
    if (cardPower(entry.card, contract, led) > cardPower(best.card, contract, led)) best = entry;
  }
  return best;
}

// Display order inside a hand: suits grouped, strongest first.
export function sortHand(hand, contract = null) {
  const suitOrder = contract?.type === 'hokm' ? [contract.trump, ...SUITS.filter((s) => s !== contract.trump)] : SUITS;
  return [...hand].sort((a, b) => {
    const sa = suitOrder.indexOf(suitOf(a)), sb = suitOrder.indexOf(suitOf(b));
    if (sa !== sb) return sa - sb;
    return cardPower(b, contract, suitOf(b)) - cardPower(a, contract, suitOf(a));
  });
}

/* ---------- Projects ---------- */

function projectValue(type, contractType) {
  const [hokm, sun] = PROJECT_POINTS[type];
  return contractType === 'sun' ? sun : hokm;
}

function candidateProjects(hand, contractType) {
  const out = [];
  for (const suit of SUITS) {
    const held = SEQUENCE.map((rank) => hand.includes(rank + suit));
    for (let start = 0; start < 8; start++) {
      for (const length of [3, 4, 5]) {
        if (start + length > 8) continue;
        let ok = true;
        for (let k = start; k < start + length; k++) if (!held[k]) { ok = false; break; }
        if (!ok) continue;
        const type = length === 3 ? 'sira' : length === 4 ? 'fifty' : 'hundred';
        out.push({ type, kind: 'sequence', cards: SEQUENCE.slice(start, start + length).map((r) => r + suit), top: start + length - 1 });
      }
    }
  }
  for (const rank of ['A', 'K', 'Q', 'J', 'T']) {
    if (SUITS.every((suit) => hand.includes(rank + suit))) {
      const type = rank === 'A' && contractType === 'sun' ? 'fourHundred' : 'hundred';
      out.push({ type, kind: 'four', cards: SUITS.map((suit) => rank + suit), top: SEQUENCE.indexOf(rank) });
    }
  }
  return out.map((p) => ({ ...p, value: projectValue(p.type, contractType) }));
}

// Compare two projects: positive when a is better.
function compareProject(a, b) {
  if (PROJECT_RANK[a.type] !== PROJECT_RANK[b.type]) return PROJECT_RANK[a.type] - PROJECT_RANK[b.type];
  if (a.kind !== b.kind) return a.kind === 'four' ? 1 : -1;
  return a.top - b.top;
}

// The best set of at most two projects that share no card.
export function findProjects(hand, contractType) {
  const all = candidateProjects(hand, contractType);
  let best = [];
  let bestScore = -1;
  const score = (list) => list.reduce((sum, p) => sum + p.value * 100 + p.top, 0);
  for (let i = 0; i < all.length; i++) {
    const single = [all[i]];
    if (score(single) > bestScore) { best = single; bestScore = score(single); }
    for (let j = i + 1; j < all.length; j++) {
      if (all[i].cards.some((c) => all[j].cards.includes(c))) continue;
      const pair = [all[i], all[j]];
      if (score(pair) > bestScore) { best = pair; bestScore = score(pair); }
    }
  }
  return best.sort((a, b) => compareProject(b, a));
}

/* ---------- Match & hands ---------- */

export function createBalootMatch({ names = ['أنت', 'اليمين', 'الشريك', 'اليسار'], target = TARGET, dealer = null, rng = Math.random, open = false } = {}) {
  const state = {
    kind: 'baloot',
    v: 1,
    open: Boolean(open),
    names: names.slice(0, 4).map((n, i) => String(n || `لاعب ${i + 1}`).slice(0, 20)),
    target,
    scores: [0, 0],
    dealer: Number.isInteger(dealer) ? dealer % 4 : Math.floor(rng() * 4),
    handNo: 0,
    phase: 'bidding',
    winner: null,
    history: [],
  };
  return startHand(state, rng);
}

export function startHand(state, rng = Math.random) {
  const deck = shuffleDeck(createDeck(), rng);
  const first = nextSeat(state.dealer);
  state.hands = [[], [], [], []];
  // 3 then 2 cards each, starting at the dealer's right.
  let k = 0;
  for (const count of [3, 2]) for (let i = 0; i < 4; i++) for (let c = 0; c < count; c++) state.hands[(first + i) % 4].push(deck[k++]);
  state.exposed = deck[k++];
  state.stock = deck.slice(k);
  state.handNo += 1;
  state.phase = 'bidding';
  state.turn = first;
  state.bidding = { round: 1, first, spoken: 0, bids: [], hokm: null, confirm: null };
  state.contract = null;
  state.doubling = null;
  state.trick = null;
  state.tricks = [];
  state.played = [];
  state.declared = [[], [], [], []];
  state.projects = null;
  state.baloot = null;
  state.startHands = null;
  state.result = null;
  state.leadTop = false;
  state.violations = [];
  state.claim = null;
  return state;
}

function biddingPosition(state, seat) {
  return (seat - state.bidding.first + 4) % 4; // 0 = dealer's right … 3 = dealer
}

// What the player on turn may say during bidding.
export function biddingOptions(state, seat = state.turn) {
  if (state.phase !== 'bidding' || seat !== state.turn) return [];
  const b = state.bidding;
  if (b.confirm === seat) return [{ bid: 'hokm', suit: b.hokm.suit }, { bid: 'sun' }];
  const out = [{ bid: 'pass' }, { bid: 'sun' }];
  const pos = biddingPosition(state, seat);
  if (b.round === 1) {
    if (!b.hokm) out.push({ bid: 'hokm', suit: suitOf(state.exposed) });
    const passedBefore = b.bids.filter((x) => x.round === 1).every((x) => x.bid === 'pass');
    if (pos === 2 || (pos === 3 && passedBefore)) out.push({ bid: 'ashkal' });
  } else if (!b.hokm) {
    for (const suit of SUITS) if (suit !== suitOf(state.exposed)) out.push({ bid: 'hokm', suit });
  }
  return out;
}

function sameOption(a, b) {
  return a.bid === b.bid && (a.bid !== 'hokm' || a.suit === b.suit);
}

function setContract(state, events, { type, trump = null, buyer, ashkal = false }) {
  const taker = ashkal ? partnerOf(buyer) : buyer;
  state.contract = { type, trump, buyer, taker, ashkal, multiplier: 1, gahwa: false, locked: false };
  // Second part of the deal: the taker gets the face-up card and two more,
  // everyone else three.
  state.hands[taker].push(state.exposed);
  const order = [0, 1, 2, 3].map((i) => (state.bidding.first + i) % 4);
  for (const seat of order) {
    const count = seat === taker ? 2 : 3;
    for (let c = 0; c < count; c++) state.hands[seat].push(state.stock.shift());
  }
  state.startHands = clone(state.hands);
  events.push({ type: 'contract', contract: clone(state.contract), exposed: state.exposed });
  // Baloot: the King and Queen of trumps in one hand.
  if (type === 'hokm') {
    const holder = state.hands.findIndex((h) => h.includes('K' + trump) && h.includes('Q' + trump));
    state.baloot = holder >= 0 ? { seat: holder, played: 0, announced: false } : null;
  }
  const opponents = 1 - teamOf(buyer);
  const canDoubleSun = state.scores[teamOf(buyer)] > 100 && state.scores[opponents] < 100;
  if (type === 'hokm' || canDoubleSun) {
    state.phase = 'doubling';
    state.doubling = { stage: 'double', by: null, asked: [], stages: type === 'hokm' ? ['double', 'triple', 'four', 'gahwa'] : ['double'] };
    state.turn = nextSeat(buyer); // the opponent on the buyer's right is asked first
  } else startPlay(state, events);
}

function startPlay(state, events) {
  state.phase = 'playing';
  state.doubling = null;
  state.turn = state.bidding.first;
  state.trick = { leader: state.turn, cards: [], top: false };
  events.push({ type: 'play_started', leader: state.turn });
}

function nextBidder(state, events, rng) {
  const b = state.bidding;
  b.spoken += 1;
  if (b.spoken < 4) {
    state.turn = nextSeat(state.turn);
    return;
  }
  if (b.hokm) {
    if (b.round === 1) {
      b.confirm = b.hokm.seat;
      state.turn = b.hokm.seat;
      return;
    }
    setContract(state, events, { type: 'hokm', trump: b.hokm.suit, buyer: b.hokm.seat });
    return;
  }
  if (b.round === 1) {
    b.round = 2;
    b.spoken = 0;
    state.turn = b.first;
    events.push({ type: 'second_round' });
    return;
  }
  // Nobody bought: the deal passes to the right.
  events.push({ type: 'redeal', dealer: state.dealer });
  state.history.push({ handNo: state.handNo, redeal: true });
  state.dealer = nextSeat(state.dealer);
  startHand(state, rng);
  events.push({ type: 'deal', dealer: state.dealer, exposed: state.exposed });
}

function applyBid(state, seat, action, events, rng) {
  const option = { bid: action.bid, suit: action.suit };
  if (!biddingOptions(state, seat).some((o) => sameOption(o, option))) throw new Error('illegal_bid');
  const b = state.bidding;
  b.bids.push({ seat, round: b.round, bid: option.bid, suit: option.bid === 'hokm' ? option.suit : null });
  events.push({ type: 'bid', seat, round: b.round, bid: option.bid, suit: option.bid === 'hokm' ? option.suit : null });
  if (b.confirm === seat) {
    b.confirm = null;
    setContract(state, events, option.bid === 'sun' ? { type: 'sun', buyer: seat } : { type: 'hokm', trump: option.suit, buyer: seat });
    return;
  }
  if (option.bid === 'sun' || option.bid === 'ashkal') {
    setContract(state, events, { type: 'sun', buyer: seat, ashkal: option.bid === 'ashkal' });
    return;
  }
  if (option.bid === 'hokm') b.hokm = { seat, suit: option.suit };
  nextBidder(state, events, rng);
}

/* ---------- Doubling ---------- */

export function doublingOptions(state, seat = state.turn) {
  if (state.phase !== 'doubling' || seat !== state.turn) return [];
  const d = state.doubling;
  const hokm = state.contract.type === 'hokm';
  if (d.stage === 'double') return hokm ? [{ call: 'double', locked: false }, { call: 'double', locked: true }, { call: 'pass' }] : [{ call: 'double', locked: false }, { call: 'pass' }];
  if (d.stage === 'triple') return [{ call: 'triple' }, { call: 'pass' }];
  if (d.stage === 'four') return [{ call: 'four', locked: false }, { call: 'four', locked: true }, { call: 'pass' }];
  if (d.stage === 'gahwa') return [{ call: 'gahwa' }, { call: 'pass' }];
  return [];
}

function applyDouble(state, seat, action, events) {
  const option = { call: action.call, locked: Boolean(action.locked) };
  const legal = doublingOptions(state, seat);
  if (!legal.some((o) => o.call === option.call && (o.locked === undefined || o.locked === option.locked))) throw new Error('illegal_double');
  const d = state.doubling;
  const c = state.contract;
  events.push({ type: 'double', seat, call: option.call, locked: option.call === 'double' || option.call === 'four' ? option.locked : false });
  if (option.call === 'pass') {
    // Either opponent may double: the second one is asked when the first passes.
    if (d.stage === 'double' && !d.asked.includes(partnerOf(seat))) {
      d.asked.push(seat);
      state.turn = partnerOf(seat);
      return;
    }
    return startPlay(state, events);
  }
  if (option.call === 'double') { c.multiplier = 2; c.locked = option.locked; d.by = seat; }
  if (option.call === 'triple') { c.multiplier = 3; c.locked = false; }
  if (option.call === 'four') { c.multiplier = 4; c.locked = option.locked; }
  if (option.call === 'gahwa') { c.gahwa = true; c.locked = false; }
  const nextStage = d.stages[d.stages.indexOf(d.stage) + 1];
  if (!nextStage) return startPlay(state, events);
  d.stage = nextStage;
  // Triple and gahwa belong to the buyer, four to the player who doubled.
  state.turn = nextStage === 'four' ? d.by : c.buyer;
}

/* ---------- Play ---------- */

function highestRemaining(state, suit) {
  const gone = new Set(state.played);
  for (let i = PLAIN_ORDER.length - 1; i >= 0; i--) {
    const card = PLAIN_ORDER[i] + suit;
    if (!gone.has(card)) return card;
  }
  return null;
}

export function legalCards(state, seat = state.turn) {
  if (state.phase !== 'playing' || seat !== state.turn) return [];
  const hand = state.hands[seat];
  const c = state.contract;
  const cards = state.trick.cards;
  if (!cards.length) {
    if (c.type === 'hokm' && c.locked) {
      const other = hand.filter((x) => suitOf(x) !== c.trump);
      if (other.length) return other;
    }
    return [...hand];
  }
  const led = suitOf(cards[0].card);
  const follow = hand.filter((x) => suitOf(x) === led);
  if (c.type === 'sun') return follow.length ? follow : [...hand];
  const trump = c.trump;
  const winning = trickWinner(cards, c);
  const partnerWinning = teamOf(winning.seat) === teamOf(seat);
  if (follow.length) {
    if (led !== trump || partnerWinning) return follow;
    const best = cardPower(winning.card, c, led);
    const higher = follow.filter((x) => cardPower(x, c, led) > best);
    return higher.length ? higher : follow;
  }
  const trumps = hand.filter((x) => suitOf(x) === trump);
  if (!trumps.length) return [...hand];
  if (partnerWinning) {
    // The last player is free when the partner wins. The third player is free
    // only when the lead was the top card left in its suit (an Ace or "ekka").
    const position = cards.length;
    if (position === 3) return [...hand];
    const leadCard = cards[0].card;
    const sure = winning.seat === cards[0].seat && suitOf(leadCard) !== trump && state.leadTop === true;
    if (sure) return [...hand];
  }
  const best = cardPower(winning.card, c, led);
  const higher = trumps.filter((x) => cardPower(x, c, led) > best);
  return higher.length ? higher : trumps;
}

// Why a card breaks the rules, for the claim explanation.
function cutReason(state, seat, card) {
  const c = state.contract, cards = state.trick.cards, hand = state.hands[seat];
  if (!cards.length) return 'lead';
  const led = suitOf(cards[0].card);
  if (suitOf(card) !== led && hand.some((x) => suitOf(x) === led)) return 'follow';
  if (c.type === 'hokm' && suitOf(card) !== c.trump && suitOf(card) !== led && hand.some((x) => suitOf(x) === c.trump)) return 'trump';
  return 'higher';
}

// The cards a seat may put down now: any card in open play, else the legal ones.
export function playableCards(state, seat = state.turn) {
  if (state.phase !== 'playing' || seat !== state.turn) return [];
  return state.open ? [...state.hands[seat]] : legalCards(state, seat);
}

function applyPlay(state, seat, action, events, rng) {
  const card = String(action.card || '');
  const legal = legalCards(state, seat);
  if (!playableCards(state, seat).includes(card)) throw new Error('illegal_card');
  if (!legal.includes(card)) state.violations.push({ seat, card, trick: state.tricks.length, reason: cutReason(state, seat, card), should: legal.slice(0, 3) });
  const c = state.contract;
  const first = state.tricks.length === 0;
  if (!state.trick.cards.length) {
    // Leading the top card left in its suit protects the partner (ekka).
    state.leadTop = suitOf(card) !== c.trump && highestRemaining(state, suitOf(card)) === card;
    state.trick.top = state.leadTop;
  }
  if (first && action.declare !== false) {
    const found = findProjects(state.startHands[seat], c.type);
    if (found.length) {
      state.declared[seat] = found;
      events.push({ type: 'declare', seat, projects: found.map((p) => p.type) });
    }
  }
  state.hands[seat] = state.hands[seat].filter((x) => x !== card);
  state.trick.cards.push({ seat, card });
  state.played.push(card);
  events.push({ type: 'play', seat, card });
  if (state.baloot && state.baloot.seat === seat && (card === 'K' + c.trump || card === 'Q' + c.trump)) {
    state.baloot.played += 1;
    if (state.baloot.played === 2) {
      state.baloot.announced = true;
      events.push({ type: 'baloot', seat });
    }
  }
  if (state.trick.cards.length < 4) {
    state.turn = nextSeat(seat);
    return;
  }
  const win = trickWinner(state.trick.cards, c);
  const points = state.trick.cards.reduce((sum, x) => sum + cardPoints(x.card, c), 0);
  state.tricks.push({ leader: state.trick.leader, cards: state.trick.cards, winner: win.seat, points, top: Boolean(state.trick.top) });
  events.push({ type: 'trick', winner: win.seat, points, cards: clone(state.trick.cards) });
  if (state.tricks.length === 1) resolveProjects(state, events);
  if (state.tricks.length === 8) {
    scoreHand(state, events, rng);
    return;
  }
  state.turn = win.seat;
  state.trick = { leader: win.seat, cards: [], top: false };
}

function resolveProjects(state, events) {
  let bestSeat = null;
  let best = null;
  for (let i = 0; i < 4; i++) {
    const seat = (state.bidding.first + i) % 4; // earlier seats win ties
    for (const p of state.declared[seat]) {
      if (!best || compareProject(p, best) > 0) { best = p; bestSeat = seat; }
    }
  }
  if (!best) { state.projects = { team: null, shown: [] }; return; }
  const team = teamOf(bestSeat);
  const shown = [];
  for (const seat of [0, 1, 2, 3]) if (teamOf(seat) === team) for (const p of state.declared[seat]) shown.push({ seat, ...p });
  state.projects = { team, shown };
  events.push({ type: 'projects', team, shown: clone(shown) });
}

/* ---------- Scoring ---------- */

function hokmPoints(abnat) { return Math.floor((abnat + 4) / 10); }
function sunPoints(abnat) { return abnat % 10 === 5 ? abnat / 5 : Math.round(abnat / 10) * 2; }

function scoreHand(state, events, rng, forced = null) {
  const c = state.contract;
  const hokm = c.type === 'hokm';
  const decl = teamOf(c.buyer);
  const opp = 1 - decl;
  const abnat = [0, 0];
  const tricks = [0, 0];
  for (const t of state.tricks) { abnat[teamOf(t.winner)] += t.points; tricks[teamOf(t.winner)] += 1; }
  if (state.tricks.length === 8) abnat[teamOf(state.tricks[7].winner)] += 10;
  const mult = c.multiplier;
  const projectPts = [0, 0];
  if (state.projects?.team !== null && state.projects?.team !== undefined) {
    projectPts[state.projects.team] = state.projects.shown.reduce((sum, p) => sum + p.value, 0) * (mult > 1 ? 2 : 1);
  }
  const balootPts = [0, 0];
  if (state.baloot?.announced) {
    const holder = state.baloot.seat;
    const blocked = state.projects?.team === teamOf(holder) && state.projects.shown.some((p) => p.seat === holder && p.type === 'hundred' && (p.cards.includes('K' + c.trump) || p.cards.includes('Q' + c.trump)));
    if (!blocked) balootPts[teamOf(holder)] = 2;
  }
  const full = hokm ? 16 : 26;
  const score = [0, 0];
  let declWins;
  let kaboot = null;
  let counting = null;
  const cardGame = [0, 0];
  if (forced) {
    // A claim ends the hand: its winners take the whole hand, like a lost contract.
    const w = forced.winner;
    declWins = w === decl;
    score[w] = full * Math.max(1, mult) + projectPts[0] + projectPts[1] + balootPts[w];
    score[1 - w] = balootPts[1 - w];
    // the result shows the projects where they went: all of them to the claim's winners
    const all = projectPts[0] + projectPts[1];
    projectPts[w] = all; projectPts[1 - w] = 0;
  } else if (tricks[0] === 8 || tricks[1] === 8) {
    kaboot = tricks[0] === 8 ? 0 : 1;
    declWins = kaboot === decl;
    const base = hokm ? [0, 25, 50, 75, 100][mult] : mult > 1 ? 88 : 44;
    score[kaboot] = base + projectPts[kaboot] + balootPts[kaboot];
  } else {
    counting = mult === 2 || mult === 4 ? decl : opp;
    const other = 1 - counting;
    cardGame[counting] = hokm ? hokmPoints(abnat[counting]) : sunPoints(abnat[counting]);
    cardGame[other] = full - cardGame[counting];
    const total = [0, 1].map((t) => cardGame[t] + projectPts[t] + balootPts[t]);
    if (total[decl] !== total[opp]) declWins = total[decl] > total[opp];
    else {
      const units = abnat[counting] % 10;
      let countingWins;
      if (hokm) countingWins = units >= 2 && units <= 5 ? true : units === 1 ? null : false;
      else countingWins = units >= 1 && units <= 4 ? true : units === 0 || units === 5 ? null : false;
      declWins = countingWins === null ? true : countingWins ? counting === decl : counting !== decl;
    }
    if (mult === 1) {
      if (declWins) { score[0] = total[0]; score[1] = total[1]; }
      else { score[opp] = full + projectPts[0] + projectPts[1] + balootPts[opp]; score[decl] = balootPts[decl]; }
    } else {
      const w = declWins ? decl : opp;
      score[w] = full * mult + projectPts[0] + projectPts[1] + balootPts[w];
      score[1 - w] = balootPts[1 - w];
    }
  }
  const winnerTeam = declWins ? decl : opp;
  state.scores = [state.scores[0] + score[0], state.scores[1] + score[1]];
  const result = { handNo: state.handNo, contract: clone(c), abnat, tricks, cardGame, projects: projectPts, baloot: balootPts, score, kaboot, declWins, winnerTeam, counting, open: Boolean(state.open), claim: state.claim ? clone(state.claim) : null, cuts: clone(state.violations || []) };
  state.result = result;
  state.history.push(result);
  events.push({ type: 'hand_scored', result: clone(result), scores: [...state.scores] });
  if (c.gahwa) state.winner = winnerTeam;
  else if (state.scores[0] >= state.target || state.scores[1] >= state.target) {
    if (state.scores[0] !== state.scores[1]) state.winner = state.scores[0] > state.scores[1] ? 0 : 1;
  }
  if (state.winner !== null) {
    state.phase = 'finished';
    state.turn = null;
    events.push({ type: 'match_finished', winner: state.winner, scores: [...state.scores] });
    return;
  }
  state.phase = 'scored';
  state.turn = null;
}

// After a scored hand: deal the next one (the deal passes to the right).
export function nextHand(state, rng = Math.random) {
  if (state.phase !== 'scored') throw new Error('hand_not_scored');
  state.dealer = nextSeat(state.dealer);
  startHand(state, rng);
  return [{ type: 'deal', dealer: state.dealer, exposed: state.exposed }];
}

/* ---------- Claims (open play) ---------- */

export function canClaim(state, seat) {
  return Boolean(state?.open) && state.phase === 'playing' && !state.claim && Number.isInteger(seat) && seat >= 0 && seat < 4 && (state.played?.length || 0) > 0;
}

function applyClaim(state, seat, events, rng) {
  if (!canClaim(state, seat)) throw new Error('illegal_claim');
  const team = teamOf(seat), accused = 1 - team;
  const proof = (state.violations || []).find((v) => teamOf(v.seat) === accused) || null;
  state.claim = { seat, team, accused, correct: Boolean(proof), proof: proof ? clone(proof) : null, trick: state.tricks.length };
  events.push({ type: 'claim', seat, team, correct: Boolean(proof), proof: proof ? clone(proof) : null });
  if (state.trick?.cards?.length) state.trick = { ...state.trick, cards: [] };
  scoreHand(state, events, rng, { winner: proof ? team : accused });
}

/* What one seat can prove from the table alone: a card it saw played that the
   rules did not allow, given the cards the same player showed afterwards.
   (Holding more cards only adds duties, so the proof never lies.) */
export function provenCuts(view, accusedTeam) {
  if (!view?.open || !view.contract) return [];
  const tricks = (view.tricks || []).map((t, index) => ({ ...t, index }));
  if (view.trick?.cards?.length) tricks.push({ ...view.trick, index: tricks.length });
  const sequence = [];
  for (const t of tricks) t.cards.forEach((entry, k) => sequence.push({ ...entry, trick: t.index, before: t.cards.slice(0, k), top: Boolean(t.top) }));
  const found = [];
  sequence.forEach((p, i) => {
    if (teamOf(p.seat) !== accusedTeam) return;
    const later = sequence.slice(i + 1).filter((x) => x.seat === p.seat).map((x) => x.card);
    if (!later.length) return;
    const probe = { phase: 'playing', turn: p.seat, contract: view.contract, hands: [[], [], [], []], trick: { cards: p.before }, leadTop: p.top, played: [] };
    probe.hands[p.seat] = [p.card, ...later];
    if (!legalCards(probe, p.seat).includes(p.card)) found.push({ seat: p.seat, card: p.card, trick: p.trick, shown: later.find((x) => legalCards(probe, p.seat).includes(x)) || later[0] });
  });
  return found;
}

/* ---------- Actions ---------- */

export function applyBalootAction(input, seat, action, rng = Math.random) {
  const state = clone(input);
  const events = [];
  if (state.phase === 'finished') throw new Error('match_finished');
  if (action?.type === 'next') {
    events.push(...nextHand(state, rng));
    return { state, events };
  }
  if (action?.type === 'claim') { applyClaim(state, seat, events, rng); return { state, events }; }
  if (seat !== state.turn) throw new Error('wrong_turn');
  if (action?.type === 'bid') applyBid(state, seat, action, events, rng);
  else if (action?.type === 'double') applyDouble(state, seat, action, events);
  else if (action?.type === 'play') applyPlay(state, seat, action, events, rng);
  else throw new Error('invalid_action');
  return { state, events };
}

// Who acts now and what they may do (for UI and timeouts).
export function balootActions(state, seat = state.turn) {
  if (state.phase === 'bidding') return biddingOptions(state, seat).map((o) => ({ type: 'bid', ...o }));
  if (state.phase === 'doubling') return doublingOptions(state, seat).map((o) => ({ type: 'double', ...o }));
  if (state.phase === 'playing') return playableCards(state, seat).map((card) => ({ type: 'play', card }));
  return [];
}

// The state as one seat may see it: other hands, the stock and undeclared
// project cards are hidden.
export function balootView(state, seat) {
  const view = clone(state);
  view.hands = state.hands.map((hand, i) => (i === seat ? sortHand(hand, state.contract) : hand.map(() => '??')));
  view.stock = state.stock?.map(() => '??') || [];
  view.startHands = null;
  const reveal = state.tricks?.length >= 1;
  view.declared = state.declared.map((list, i) => list.map((p) => (i === seat || (reveal && state.projects?.team === teamOf(i)) ? p : { type: p.type })));
  if (view.baloot && !view.baloot.announced) view.baloot = null;
  // cuts stay secret until a claim or the end of the hand
  view.violations = null;
  view.me = seat;
  return view;
}
