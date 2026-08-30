import { createJackarooGame, playJackarooAction } from '../../public/assets/js/engines/jackaroo-engine.js';

export function createJackarooServerGame(names, rng = Math.random) {
  return createJackarooGame(names, { rng });
}

export function playJackarooServer(state, actorSeat, cardIndex, action) {
  if (state.winnerTeam !== null) throw new Error('match_finished');
  if (actorSeat !== state.turn) throw new Error('wrong_turn');
  if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= state.hands[actorSeat].length) {
    throw new Error('invalid_card');
  }
  if (!action || typeof action !== 'object') throw new Error('invalid_action');
  const next = playJackarooAction(state, cardIndex, action, actorSeat);
  return {
    state: next,
    event: {
      type: 'play_card',
      player: actorSeat,
      card: next.lastEvent?.card ?? null,
      action: next.lastEvent?.action ?? action,
      detail: next.lastEvent ?? null,
    },
  };
}

export function publicJackarooGame(state, viewerSeat) {
  const hand = Number.isInteger(viewerSeat) && viewerSeat >= 0 && viewerSeat < 4
    ? [...state.hands[viewerSeat]]
    : [];
  return {
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      marbles: [...p.marbles],
    })),
    turn: state.turn,
    dealer: state.dealer,
    dealIndex: state.dealIndex,
    played: state.played,
    winnerTeam: state.winnerTeam,
    hand,
    handCounts: state.hands.map((h) => h.length),
    deckCount: state.deck.length,
    discardCount: state.discard.length,
    lastEvent: state.lastEvent ? structuredClone(state.lastEvent) : null,
  };
}
