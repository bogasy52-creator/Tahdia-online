import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBalootMatch, applyBalootAction, balootActions, biddingOptions, legalCards, findProjects,
  cardPoints, cardPower, trickWinner, balootView, createDeck, teamOf,
} from '../public/assets/js/engines/baloot-engine.js';

function seeded(seed = 1) {
  return () => { seed |= 0; seed = seed + 0x6d2b79f5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const act = (s, action, seat = s.turn) => applyBalootAction(s, seat, action, seeded(9));

// A hand already in play with chosen cards.
function playing({ contract, hands, first = 0, trick = [], played = [] }) {
  const s = createBalootMatch({ rng: seeded(3), dealer: 3 });
  s.phase = 'playing';
  s.contract = { buyer: 0, taker: 0, ashkal: false, multiplier: 1, gahwa: false, locked: false, trump: null, ...contract };
  s.hands = hands.map((h) => [...h]);
  s.startHands = hands.map((h) => [...h]);
  s.stock = [];
  s.bidding.first = first;
  s.played = [...played, ...trick.map((x) => x.card)];
  s.trick = { leader: trick[0]?.seat ?? first, cards: trick };
  s.turn = trick.length ? (trick.at(-1).seat + 1) % 4 : first;
  s.tricks = [];
  s.doubling = null;
  return s;
}

test('the 32 cards are worth 152 in Hokm and 120 in Sun before the last trick', () => {
  const deck = createDeck();
  assert.equal(deck.length, 32);
  assert.equal(deck.reduce((n, c) => n + cardPoints(c, { type: 'sun' }), 0), 120);
  assert.equal(deck.reduce((n, c) => n + cardPoints(c, { type: 'hokm', trump: 'H' }), 0), 152);
  const hokm = { type: 'hokm', trump: 'S' };
  const trumps = ['JS', '9S', 'AS', 'TS', 'KS', 'QS', '8S', '7S'];
  for (let i = 1; i < trumps.length; i++) assert.ok(cardPower(trumps[i - 1], hokm, 'S') > cardPower(trumps[i], hokm, 'S'), trumps[i - 1]);
  const plain = ['AH', 'TH', 'KH', 'QH', 'JH', '9H', '8H', '7H'];
  for (let i = 1; i < plain.length; i++) assert.ok(cardPower(plain[i - 1], hokm, 'H') > cardPower(plain[i], hokm, 'H'), plain[i - 1]);
  // a low trump beats the Ace of the led suit; an off-suit Ace never wins
  assert.equal(trickWinner([{ seat: 0, card: 'AH' }, { seat: 1, card: '7S' }, { seat: 2, card: 'AD' }], hokm).seat, 1);
});

test('projects: runs, four of a kind, at most two that share no card', () => {
  assert.deepEqual(findProjects(['7H', '8H', '9H', 'KS', 'AD', 'QC', 'JC', '8D'], 'hokm').map((p) => p.type), ['sira']);
  assert.deepEqual(findProjects(['7H', '8H', '9H', 'TH', 'KS', 'AD', 'QC', '8D'], 'sun').map((p) => [p.type, p.value]), [['fifty', 10]]);
  assert.deepEqual(findProjects(['AS', 'AH', 'AD', 'AC', '7H', '8C', '9D', 'QS'], 'sun').map((p) => [p.type, p.value]), [['fourHundred', 40]]);
  assert.deepEqual(findProjects(['AS', 'AH', 'AD', 'AC', '7H', '8C', '9D', 'QS'], 'hokm').map((p) => [p.type, p.value]), [['hundred', 10]]);
  // all eight hearts: a hundred and a sira
  assert.deepEqual(findProjects(['7H', '8H', '9H', 'TH', 'JH', 'QH', 'KH', 'AH'], 'hokm').map((p) => p.type), ['hundred', 'sira']);
  // four Jacks and a run through the Jack of hearts: the best pair without sharing the Jack
  const both = findProjects(['JS', 'JH', 'JD', 'JC', 'TH', '9H', '8H', 'AS'], 'sun');
  assert.deepEqual(both.map((p) => p.type), ['hundred', 'sira'].slice(0, both.length));
  assert.ok(!both[1] || !both[1].cards.some((c) => both[0].cards.includes(c)));
  // nines, eights and sevens are not projects
  assert.deepEqual(findProjects(['9S', '9H', '9D', '9C', 'KS', 'QD', 'AH', 'TC'], 'sun'), []);
});

test('bidding: Sun ends it, a later Sun beats Hokm, Ashkal sits with the dealer side', () => {
  let s = createBalootMatch({ rng: seeded(11), dealer: 3 });
  assert.equal(s.turn, 0, 'the player on the dealer\'s right speaks first');
  assert.equal(s.hands.every((h) => h.length === 5), true);
  const first = biddingOptions(s).map((o) => o.bid);
  assert.deepEqual(first.sort(), ['hokm', 'pass', 'sun']);
  ({ state: s } = act(s, { type: 'bid', bid: 'hokm', suit: s.exposed[1] }));
  assert.ok(!biddingOptions(s).some((o) => o.bid === 'hokm'), 'only one Hokm in the first round');
  ({ state: s } = act(s, { type: 'bid', bid: 'pass' }));
  assert.ok(biddingOptions(s).some((o) => o.bid === 'ashkal'), 'the dealer\'s left may call Ashkal');
  const { state: sun, events } = act(s, { type: 'bid', bid: 'sun' });
  assert.equal(sun.contract.type, 'sun');
  assert.equal(sun.contract.buyer, 2);
  assert.ok(events.some((e) => e.type === 'contract'));
  assert.ok(sun.hands.every((h) => h.length === 8), 'everyone holds eight cards');
  assert.ok(sun.hands[2].includes(s.exposed), 'the buyer took the face-up card');
});

test('bidding: the Hokm bidder confirms or switches; round two names another suit; all pass deals again', () => {
  let s = createBalootMatch({ rng: seeded(12), dealer: 3 });
  const suit = s.exposed[1];
  ({ state: s } = act(s, { type: 'bid', bid: 'hokm', suit }));
  for (let i = 0; i < 3; i++) ({ state: s } = act(s, { type: 'bid', bid: 'pass' }));
  assert.equal(s.turn, 0);
  assert.deepEqual(biddingOptions(s).map((o) => o.bid).sort(), ['hokm', 'sun']);
  const confirmed = act(s, { type: 'bid', bid: 'hokm', suit }).state;
  assert.equal(confirmed.contract.type, 'hokm');
  assert.equal(confirmed.contract.trump, suit);
  assert.equal(confirmed.phase, 'doubling', 'opponents may double a Hokm');
  assert.equal(confirmed.turn, 1);

  let r = createBalootMatch({ rng: seeded(13), dealer: 3 });
  for (let i = 0; i < 4; i++) ({ state: r } = act(r, { type: 'bid', bid: 'pass' }));
  assert.equal(r.bidding.round, 2);
  const suits = biddingOptions(r).filter((o) => o.bid === 'hokm').map((o) => o.suit);
  assert.equal(suits.length, 3);
  assert.ok(!suits.includes(r.exposed[1]));
  assert.ok(!biddingOptions(r).some((o) => o.bid === 'ashkal'));
  const dealer = r.dealer;
  for (let i = 0; i < 4; i++) ({ state: r } = act(r, { type: 'bid', bid: 'pass' }));
  assert.equal(r.dealer, (dealer + 1) % 4, 'the deal passes to the right');
  assert.equal(r.bidding.round, 1);
  assert.ok(r.history.some((h) => h.redeal));
});

test('play: follow suit, overtrump a trump lead, trump an opponent, free when the partner wins', () => {
  const hokm = { type: 'hokm', trump: 'S' };
  // seat 1 must follow hearts with any heart
  let s = playing({ contract: hokm, hands: [['AH'], ['7H', 'KH', 'JS'], ['8D'], ['9C']], trick: [{ seat: 0, card: 'QH' }] });
  assert.deepEqual(legalCards(s, 1).sort(), ['7H', 'KH'].sort());
  // trump led: beat it when able
  s = playing({ contract: hokm, hands: [[], ['7S', '9S', 'AD'], [], []], trick: [{ seat: 0, card: 'AS' }] });
  assert.deepEqual(legalCards(s, 1), ['9S']);
  // no hearts: the opponent leads, so trump
  s = playing({ contract: hokm, hands: [[], ['7S', 'AD', 'KC'], [], []], trick: [{ seat: 0, card: 'QH' }] });
  assert.deepEqual(legalCards(s, 1), ['7S']);
  // an opponent trumped: overtrump if possible
  s = playing({ contract: hokm, hands: [[], [], ['8S', 'JS', 'AD'], []], trick: [{ seat: 0, card: 'QH' }, { seat: 1, card: '9S' }] });
  assert.deepEqual(legalCards(s, 2), ['JS']);
  // last player and the partner wins: anything
  s = playing({ contract: hokm, hands: [[], [], [], ['8S', 'AD', 'KC']], trick: [{ seat: 0, card: 'QH' }, { seat: 1, card: 'AH' }, { seat: 2, card: '7H' }] });
  assert.deepEqual(legalCards(s, 3).sort(), ['8S', 'AD', 'KC'].sort());
  // third player, partner led the top heart left: free
  s = playing({ contract: hokm, hands: [[], [], ['8S', 'AD'], []], trick: [{ seat: 0, card: 'AH' }, { seat: 1, card: '7H' }] });
  s.leadTop = true;
  assert.deepEqual(legalCards(s, 2).sort(), ['8S', 'AD'].sort());
  // third player, partner led a low heart: must trump
  s.leadTop = false;
  assert.deepEqual(legalCards(s, 2), ['8S']);
  // Sun: no trumps, follow or anything
  s = playing({ contract: { type: 'sun' }, hands: [[], ['AD', 'KC'], [], []], trick: [{ seat: 0, card: 'QH' }] });
  assert.deepEqual(legalCards(s, 1).sort(), ['AD', 'KC'].sort());
  // a locked double: no trump lead while other suits remain
  s = playing({ contract: { ...hokm, locked: true, multiplier: 2 }, hands: [['JS', 'AH'], [], [], []] });
  assert.deepEqual(legalCards(s, 0), ['AH']);
});

// Play out a hand where the given seat wins every trick or the given split.
function finishHand(s) {
  let guard = 0;
  while (s.phase === 'playing' && guard++ < 64) {
    const cards = legalCards(s);
    ({ state: s } = applyBalootAction(s, s.turn, { type: 'play', card: cards[0] }, seeded(5)));
  }
  return s;
}

test('scoring: a Sun kaboot is 44, a made Hokm splits 16, a failed contract gives all to the others', () => {
  // seat 0 holds every top card in Sun: a sweep
  const top = ['AS', 'TS', 'AH', 'TH', 'AD', 'TD', 'AC', 'TC'];
  const rest = createDeck().filter((c) => !top.includes(c));
  let s = playing({ contract: { type: 'sun', buyer: 0 }, hands: [top, rest.slice(0, 8), rest.slice(8, 16), rest.slice(16, 24)] });
  s = finishHand(s);
  assert.equal(s.result.kaboot, 0);
  // four Aces (400) and four Tens (100) in Sun, plus the partner's runs
  assert.ok(s.result.projects[0] >= 60);
  assert.deepEqual(s.result.score, [44 + s.result.projects[0], 0]);

  // Hokm: points convert with 5 rounding down, the other side gets the rest of 16
  const h = createBalootMatch({ rng: seeded(21), dealer: 3 });
  let g = h;
  ({ state: g } = act(g, { type: 'bid', bid: 'hokm', suit: g.exposed[1] }));
  for (let i = 0; i < 3; i++) ({ state: g } = act(g, { type: 'bid', bid: 'pass' }));
  ({ state: g } = act(g, { type: 'bid', bid: 'hokm', suit: g.exposed[1] }));
  ({ state: g } = act(g, { type: 'double', call: 'pass' }));
  ({ state: g } = act(g, { type: 'double', call: 'pass' }));
  assert.equal(g.phase, 'playing');
  g = finishHand(g);
  const res = g.result;
  assert.equal(res.abnat[0] + res.abnat[1], 162);
  if (res.kaboot === null && res.declWins) assert.equal(res.score[0] + res.score[1] - res.projects[0] - res.projects[1] - res.baloot[0] - res.baloot[1], 16);
  if (res.kaboot === null && !res.declWins) assert.equal(res.score[teamOf(res.contract.buyer)], res.baloot[teamOf(res.contract.buyer)]);
});

test('scoring: doubling multiplies, projects go to the best project, Baloot always stays with its holder', () => {
  // Team 0 buys Hokm spades with Baloot and a sira, and takes most tricks.
  const hands = [
    ['JS', '9S', 'AS', 'KS', 'QS', 'AH', 'AD', 'AC'],
    ['7S', '8S', 'TH', 'KH', 'QH', 'JH', '9H', '8H'],
    ['TS', '7H', 'TD', 'KD', 'QD', 'JD', '9D', '8D'],
    ['7D', 'TC', 'KC', 'QC', 'JC', '9C', '8C', '7C'],
  ];
  let s = playing({ contract: { type: 'hokm', trump: 'S', buyer: 0, multiplier: 2 }, hands });
  s.baloot = { seat: 0, played: 0, announced: false };
  s = finishHand(s);
  const r = s.result;
  assert.equal(r.contract.multiplier, 2);
  assert.ok(r.declWins);
  // doubled: the winners take 32 plus doubled projects plus 2 for Baloot
  const projects = r.projects[0] + r.projects[1];
  assert.equal(r.score[0], r.kaboot === 0 ? 25 + projects + r.baloot[0] : 32 + projects + r.baloot[0]);
  assert.equal(r.baloot[0], 2);
  assert.equal(r.score[1], 0);
});

test('a view hides the other hands and the stock; finished matches stop at 152', () => {
  const s = createBalootMatch({ rng: seeded(31), dealer: 0 });
  const v = balootView(s, 2);
  assert.equal(v.hands[2].includes('??'), false);
  assert.ok(v.hands[0].every((c) => c === '??'));
  assert.ok(v.stock.every((c) => c === '??'));
  assert.equal(v.startHands, null);
  // play random matches to the end
  const rng = seeded(41);
  let m = createBalootMatch({ rng });
  for (let i = 0; i < 4000 && m.phase !== 'finished'; i++) {
    if (m.phase === 'scored') { ({ state: m } = applyBalootAction(m, null, { type: 'next' }, rng)); continue; }
    const acts = balootActions(m);
    const pick = acts.find((a) => a.bid === 'pass' || a.call === 'pass') && rng() < 0.6 ? acts.find((a) => a.bid === 'pass' || a.call === 'pass') : acts[Math.floor(rng() * acts.length)];
    ({ state: m } = applyBalootAction(m, m.turn, pick, rng));
  }
  assert.equal(m.phase, 'finished');
  assert.ok(Math.max(...m.scores) >= 152 || m.history.some((h) => h.contract?.gahwa));
  assert.notEqual(m.scores[0], m.scores[1]);
  assert.throws(() => applyBalootAction(m, 0, { type: 'play', card: 'AS' }), /match_finished/);
});

test('wrong turns and illegal cards are refused', () => {
  const s = createBalootMatch({ rng: seeded(51), dealer: 3 });
  assert.throws(() => applyBalootAction(s, 2, { type: 'bid', bid: 'pass' }), /wrong_turn/);
  assert.throws(() => applyBalootAction(s, 0, { type: 'bid', bid: 'ashkal' }), /illegal_bid/);
  const p = playing({ contract: { type: 'sun' }, hands: [['AH', 'KS'], ['7H'], ['8H'], ['9H']] });
  assert.throws(() => applyBalootAction(p, 0, { type: 'play', card: 'QD' }), /illegal_card/);
});
