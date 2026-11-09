import { createSnakesGame, playSnakesRoll, TACTICS_JUMPS } from './snakes-engine.js';

// Tahdia 33.8.0 — «الصدام»: snakes & ladders where the players meet on the board.
// A direct start on the balanced board; land on a cell where an opponent stands and they go back
// CLASH_BACK cells (never below cell 1). A six rolls again, and 100 needs the exact number.
export const CLASH_BACK = 10;

export function createClashGame(names) {
  const state = createSnakesGame(names, { entrySix: false });
  return { ...state, variant: 'clash', rulesVersion: 6, jumps: { ...TACTICS_JUMPS }, bumps: state.players.map(() => 0) };
}

/** One roll: the move (with its ladder or snake), then everyone standing where it ended is pushed back. */
export function playClashTurn(state, roll) {
  if (state.winner !== null) return state;
  const next = playSnakesRoll(state, roll), event = next.lastEvent, mover = event.player, at = next.players[mover].position;
  const bumped = [];
  if (!event.blocked && at > 0 && at < 100) {
    for (const player of next.players) {
      if (player.id === mover || player.position !== at) continue;
      const from = player.position, to = Math.max(1, from - CLASH_BACK);
      player.position = to;
      bumped.push({ player: player.id, from, to });
    }
  }
  if (bumped.length) {
    next.bumps = (next.bumps || next.players.map(() => 0)).slice();
    next.bumps[mover] = (next.bumps[mover] || 0) + bumped.length;
  }
  next.lastEvent = { ...event, rolls: [roll], total: roll, bumped };
  return next;
}

/** Where a roll would leave the mover, and who it would push back (the page shows it before you roll). */
export function clashTargets(state, seat) {
  const from = state.players[seat]?.position ?? 0;
  return [1, 2, 3, 4, 5, 6].map((roll) => {
    const landed = from + roll;
    if (landed > 100) return { roll, to: from, hits: [] };
    const to = Number(state.jumps[landed] ?? landed);
    return { roll, to, hits: to > 0 && to < 100 ? state.players.filter((p) => p.id !== seat && p.position === to).map((p) => p.id) : [] };
  });
}
