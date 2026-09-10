// ذكاء اصطناعي بسيط للبوت — مستويان: 'medium' (متوسط) و 'pro' (محترف)
// يُستخدم من السيرفر لتحريك مقاعد البوت تلقائيًا، ومن العميل لوضع "العب ضد بوت" محليًا.
import { jackarooTeam, playJackarooAction } from './jackaroo-engine.js';
import { playDominoAction } from './domino-engine.js';
import { applyLudoMove } from './ludo-engine.js';

function pickWeighted(list, difficulty) {
  if (!list.length) return null;
  list.sort((a, b) => b.score - a.score);
  if (difficulty === 'pro') return list[0].choice;
  const poolSize = Math.max(1, Math.ceil(list.length * 0.6));
  const pool = list.slice(0, poolSize);
  return pool[Math.floor(Math.random() * pool.length)].choice;
}

// ---------- جاكارو ----------
function scoreJackarooState(state, actor) {
  const myTeam = jackarooTeam(actor);
  let score = 0;
  state.players.forEach((p, pi) => {
    const team = jackarooTeam(pi);
    const sign = team === myTeam ? 1 : -1;
    p.marbles.forEach((m) => {
      if (m === 56) score += sign * 120;
      else if (m >= 0) score += sign * (m + 5);
    });
  });
  if (state.winnerTeam === myTeam) score += 100000;
  else if (state.winnerTeam !== null) score -= 100000;
  return score;
}

export function chooseJackarooBotAction(state, actor, difficulty = 'medium', getActions) {
  const candidates = [];
  const hand = state.hands[actor] || [];
  for (let cardIndex = 0; cardIndex < hand.length; cardIndex++) {
    const legal = getActions(state, cardIndex, actor);
    for (const action of legal) {
      try {
        const next = playJackarooAction(state, cardIndex, action, actor);
        candidates.push({ choice: { cardIndex, action }, score: scoreJackarooState(next, actor) });
      } catch { /* skip illegal simulated combo */ }
    }
  }
  return pickWeighted(candidates, difficulty);
}

// ---------- دومينو ----------
function dominoMobility(hand, tile, side, leftEnd, rightEnd) {
  // تقدير تقريبي: كم قطعة أخرى في اليد ستبقى قابلة للعب بعد هذه الحركة
  const otherEnd = side === 'left' ? rightEnd : leftEnd;
  return hand.filter((t) => t !== tile && (t[0] === otherEnd || t[1] === otherEnd)).length;
}

export function chooseDominoBotAction(state, actor, difficulty = 'medium', getActions) {
  const actions = getActions(state, actor);
  if (!actions.length) return null;
  const plays = actions.filter((a) => a.type === 'play');
  if (!plays.length) return actions[0]; // draw أو pass إجباري
  const hand = state.hands[actor] || [];
  const candidates = plays.map((a) => {
    const tile = hand[a.tileIndex];
    const heavy = tile[0] + tile[1];
    const isDouble = tile[0] === tile[1];
    let score = heavy * 3 + (isDouble ? 6 : 0);
    if (difficulty === 'pro') {
      score += dominoMobility(hand, tile, a.side, state.leftEnd, state.rightEnd) * 2;
    }
    return { choice: a, score };
  });
  return pickWeighted(candidates, difficulty);
}

// ---------- الزهرة (لودو) ----------
export function chooseLudoBotMove(state, legalTokenIndexes, roll, difficulty = 'medium') {
  if (!legalTokenIndexes.length) return null;
  const actor = state.turn;
  const candidates = legalTokenIndexes.map((tokenIndex) => {
    try {
      const next = applyLudoMove(state, tokenIndex, roll);
      const captured = next.lastEvent?.captured?.length || 0;
      const to = next.players[actor].tokens[tokenIndex];
      let score = captured * 40 + to;
      if (to === 56) score += 100;
      return { choice: tokenIndex, score };
    } catch { return { choice: tokenIndex, score: 0 }; }
  });
  return pickWeighted(candidates, difficulty);
}
