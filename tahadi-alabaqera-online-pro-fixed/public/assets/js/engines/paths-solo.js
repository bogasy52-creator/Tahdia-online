import {createPaths, movePaths, restartPaths, restorePaths} from './journey-engine.js?v=29.1.0';

// The same stage engine and proof format as the original journey. Only the view
// is adapted to the shared solo/friends board; saved stars and resumes keep working.
export function createSoloPathsSession(level = 1, daily = '', resume = null) {
  let board = createPaths(level, daily), seq = 0, lastFault = '', faults = 0;
  if (resume?.level === level && (resume.daily || '') === daily) {
    try { board = restorePaths(resume); } catch { /* A damaged resume starts this stage cleanly. */ }
  }
  faults = board.restarts;
  const round = 'solo:' + level + ':' + daily;
  const proof = () => ({game: 'paths', engineVersion: board.engineVersion, level: board.level, daily: board.daily, log: structuredClone(board.log)});
  return {
    proof,
    move(type, data = {}) {
      if (board.won || !['path', 'reset'].includes(type)) return false;
      lastFault = '';
      if (type === 'reset') board = restartPaths(board);
      else {
        const result = movePaths(board, data.color, data.path);
        if (result.accepted) board = result.state;
        else { faults++; lastFault = result.fault || 'incomplete'; board = restartPaths(board); }
      }
      seq++;
      return true;
    },
    snapshot(now = Date.now()) {
      const covered = new Set(Object.values(board.paths).flat()).size;
      return {
        code: 'مرحلة ' + board.level, round, serverNow: now,
        difficulty: Math.min(5, Math.floor((board.level - 1) / 24) + 1), capacity: 1,
        status: board.won ? 'finished' : 'playing', total: board.size ** 2 - board.walls.length,
        puzzle: {size: board.size, pairs: board.pairs, walls: board.walls, gates: board.gates, level: board.level},
        players: [{id: 'solo', name: 'أنت', role: 'host', connected: true, rank: 1, covered, finishedAt: board.won ? now : null}],
        me: {id: 'solo', paths: structuredClone(board.paths), seq, faults, lastFault},
        winnerId: board.won ? 'solo' : null,
      };
    },
  };
}
