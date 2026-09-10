// محرك لعبة الدومينو (دبل-6 كلاسيكي) — منطق صرف بدون أي اعتماد على DOM أو Workers
// يُستخدم من السيرفر (src/index.js) ومن العميل (domino.html) في آن واحد.

export function createDominoTiles() {
  const tiles = [];
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) tiles.push([a, b]);
  return tiles; // 28 قطعة
}

export function shuffleDominoTiles(tiles = createDominoTiles(), rng = Math.random) {
  const a = tiles.map((t) => [...t]);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const isDouble = (t) => t[0] === t[1];
const pipSum = (hand) => hand.reduce((s, t) => s + t[0] + t[1], 0);

export function createDominoGame(names = ['لاعب 1', 'لاعب 2'], options = {}) {
  const clean = names.slice(0, 4).map((n, i) => String(n || `لاعب ${i + 1}`).slice(0, 20));
  if (clean.length < 2 || clean.length > 4) throw new Error('domino_requires_2_to_4_players');
  const rng = options.rng || Math.random;
  const deck = options.deck ? options.deck.map((t) => [...t]) : shuffleDominoTiles(createDominoTiles(), rng);
  const hands = clean.map(() => []);
  for (let r = 0; r < 7; r++) for (let p = 0; p < clean.length; p++) hands[p].push(deck.pop());

  let starter = 0;
  let bestDouble = -1;
  hands.forEach((hand, p) => {
    hand.forEach((t) => { if (isDouble(t) && t[0] > bestDouble) { bestDouble = t[0]; starter = p; } });
  });

  return {
    players: clean.map((name, id) => ({ id, name })),
    hands,
    boneyard: deck,
    board: [],
    leftEnd: null,
    rightEnd: null,
    turn: starter,
    requireStartDouble: bestDouble >= 0 ? bestDouble : null,
    passStreak: 0,
    winner: null,
    status: 'playing',
    lastEvent: null,
  };
}

export function getDominoActions(state, seat = state.turn) {
  if (state.status === 'finished') return [];
  const hand = state.hands[seat] || [];
  if (state.board.length === 0) {
    let candidates = hand.map((t, i) => ({ t, i }));
    if (state.requireStartDouble !== null) {
      const forced = candidates.filter(({ t }) => isDouble(t) && t[0] === state.requireStartDouble);
      if (forced.length) candidates = forced;
    }
    return candidates.map(({ i }) => ({ type: 'play', tileIndex: i, side: 'left' }));
  }
  const plays = [];
  hand.forEach((t, tileIndex) => {
    if (t[0] === state.leftEnd || t[1] === state.leftEnd) plays.push({ type: 'play', tileIndex, side: 'left' });
    if (t[0] === state.rightEnd || t[1] === state.rightEnd) plays.push({ type: 'play', tileIndex, side: 'right' });
  });
  if (plays.length) return plays;
  if (state.boneyard.length) return [{ type: 'draw' }];
  return [{ type: 'pass' }];
}

function placeTile(state, tile, side) {
  if (state.board.length === 0) {
    state.board.push([...tile]);
    state.leftEnd = tile[0];
    state.rightEnd = tile[1];
    return;
  }
  if (side === 'left') {
    const oriented = tile[1] === state.leftEnd ? [...tile] : [tile[1], tile[0]];
    state.board.unshift(oriented);
    state.leftEnd = oriented[0];
  } else {
    const oriented = tile[0] === state.rightEnd ? [...tile] : [tile[1], tile[0]];
    state.board.push(oriented);
    state.rightEnd = oriented[1];
  }
}

export function playDominoAction(state, seat, action) {
  if (state.status === 'finished') throw new Error('match_finished');
  if (seat !== state.turn) throw new Error('wrong_turn');
  if (!action || typeof action !== 'object') throw new Error('invalid_action');
  const legal = getDominoActions(state, seat);
  const sig = JSON.stringify(action);
  if (!legal.some((a) => JSON.stringify(a) === sig)) throw new Error('illegal_domino_action');

  const s = structuredClone(state);
  const event = { type: action.type, player: seat };

  if (action.type === 'play') {
    const [tile] = s.hands[seat].splice(action.tileIndex, 1);
    placeTile(s, tile, action.side);
    event.tile = tile;
    event.side = action.side;
    s.passStreak = 0;
    if (s.hands[seat].length === 0) {
      s.status = 'finished';
      s.winner = seat;
      event.emptiedHand = true;
    } else {
      s.turn = (seat + 1) % s.players.length;
    }
  } else if (action.type === 'draw') {
    const tile = s.boneyard.pop();
    s.hands[seat].push(tile);
    event.drew = true;
    // الدور يبقى لنفس اللاعب حتى يستطيع اللعب أو يفرغ صندوق السحب
  } else if (action.type === 'pass') {
    s.passStreak++;
    event.pass = true;
    s.turn = (seat + 1) % s.players.length;
    if (s.passStreak >= s.players.length) {
      s.status = 'finished';
      const sums = s.hands.map((h) => pipSum(h));
      const min = Math.min(...sums);
      const winners = sums.map((v, i) => (v === min ? i : -1)).filter((i) => i >= 0);
      s.winner = winners.length === 1 ? winners[0] : 'draw';
      event.blocked = true;
      event.winner = s.winner;
    }
  }

  s.lastEvent = event;
  return s;
}

export function dominoHandValue(hand) { return pipSum(hand); }
