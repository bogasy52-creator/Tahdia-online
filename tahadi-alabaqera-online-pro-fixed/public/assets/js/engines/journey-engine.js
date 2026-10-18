import {createStrictPaths,moveStrictPaths,hintStrictPaths,restartStrictPaths,restoreStrictPaths,strictPathsStars}from './paths-v20.js';
import {createSudoku,restoreSudoku,sudokuStars}from './sudoku-engine.js';
/* Deterministic stages. The browser and the server replay the same moves. */
import {restoreMatch3,match3Stars} from './match3-engine.js?v=21.0.0';
export const GAMES = Object.freeze(['jewels', 'paths', 'sudoku']);
export const STAGE_COUNT = 60;
export const STAGE_LIMITS=Object.freeze({jewels:60,paths:120,sudoku:120});
export const stageCount=game=>STAGE_LIMITS[game]||0;
export const totalStageCount=()=>Object.values(STAGE_LIMITS).reduce((a,b)=>a+b,0);
export const CHAPTERS = Object.freeze(['بداية المغامرة', 'حديقة البلّور', 'بحيرة الضوء', 'قمم الشفق', 'قصر النجوم']);
export const COLORS = Object.freeze(['#66e2c0', '#ffb96b', '#a99aff', '#ff799c', '#68bdff', '#f2df79', '#ffffff','#f28d65','#98ce5b']);
export function dayKey(now = Date.now()) { return new Date(now + 10800000).toISOString().slice(0, 10); }
function hash(value) { let n = 2166136261; for (const c of String(value)) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return n >>> 0 || 1; }
function next(state) { let n = state.seed; n ^= n << 13; n ^= n >>> 17; n ^= n << 5; state.seed = n >>> 0 || 1; return state.seed / 4294967296; }
export function adjacent(a, b, size, diagonal = false) {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a >= size * size || b >= size * size || a === b) return false;
  const dx = Math.abs(a % size - b % size), dy = Math.abs(Math.floor(a / size) - Math.floor(b / size));
  return diagonal ? dx <= 1 && dy <= 1 : dx + dy === 1;
}
export const chaptersFor=game=>game==='jewels'?CHAPTERS:[...CHAPTERS,'متاهة الضوء','الممرات الدقيقة','الحلقات العميقة','متاهة الخبير','قمة التحدي'];
export function stageSpec(game, level = 1, daily = '') {
  if (!GAMES.includes(game) || !Number.isInteger(level) || level < 1 || level > stageCount(game) || daily && !/^\d{4}-\d{2}-\d{2}$/.test(daily)) throw new Error('invalid_stage');
  const number = daily ? 19 + hash(daily + game) % 30 : level;
  return { game, level, daily, number, seed: hash('tahdia-17:' + game + ':' + (daily || level)), chapter: Math.floor((level - 1) / 12) };
}
export function createJewels(level = 1, daily = '') {
  const spec = stageSpec('jewels', level, daily), size = spec.number < 13 ? 6 : 7;
  const state = { ...spec, size, colors: spec.number < 8 ? 4 : spec.number < 37 ? 5 : 6, moves: 0, limit: 20, collected: 0, colorCount: 0, score: 0, won: false, over: false, board: [], log: [], goal: 24 + Math.floor(spec.number / 2), colorGoal: 6 + Math.floor(spec.number / 7), targetColor: spec.number % (spec.number < 8 ? 4 : spec.number < 37 ? 5 : 6) };
  state.board = Array.from({ length: size * size }, () => Math.floor(next(state) * state.colors));
  ensureMove(state); return state;
}
export function jewelPaths(state) {
  const paths = [], { board, size } = state;
  const search = path => {
    if (path.length >= 3) { paths.push(path); return; }
    const last = path.at(-1);
    for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) {
      const cell = last + y * size + x;
      if (!path.includes(cell) && adjacent(last, cell, size, true) && board[cell] === board[last]) search([...path, cell]);
    }
  };
  for (let i = 0; i < board.length; i++) search([i]);
  return paths;
}
function ensureMove(state) {
  if (jewelPaths(state).length) return;
  const color = Math.floor(next(state) * state.colors), row = Math.floor(next(state) * state.size) * state.size;
  state.board[row] = state.board[row + 1] = state.board[row + 2] = color;
}
export function moveJewels(raw, path) {
  if (!raw || raw.over || !Array.isArray(path) || path.length < 3 || path.length > raw.size * raw.size || new Set(path).size !== path.length) return { state: raw, accepted: false };
  const color = raw.board[path[0]];
  if (color == null || path.some((p, i) => !Number.isInteger(p) || p < 0 || p >= raw.board.length || raw.board[p] !== color || i > 0 && !adjacent(path[i - 1], p, raw.size, true))) return { state: raw, accepted: false };
  const state = structuredClone(raw), cleared = new Set(path), bonus = path.length >= 7;
  if (bonus) { const row = Math.floor(path.at(-1) / state.size); for (let x = 0; x < state.size; x++) cleared.add(row * state.size + x); }
  state.collected += cleared.size;
  state.colorCount += [...cleared].filter(i => state.board[i] === state.targetColor).length;
  state.score += cleared.size * 10 + Math.max(0, path.length - 3) * 15 + (bonus ? 80 : 0);
  for (let x = 0; x < state.size; x++) {
    const column = [];
    for (let y = state.size - 1; y >= 0; y--) if (!cleared.has(y * state.size + x)) column.push(state.board[y * state.size + x]);
    while (column.length < state.size) column.push(Math.floor(next(state) * state.colors));
    for (let y = 0; y < state.size; y++) state.board[(state.size - y - 1) * state.size + x] = column[y];
  }
  state.moves++; state.log.push([...path]); state.won = state.collected >= state.goal && state.colorCount >= state.colorGoal;
  state.over = state.won || state.moves >= state.limit; ensureMove(state);
  return { state, accepted: true, cleared: [...cleared], bonus };
}
export function createLegacyPaths(level = 1, daily = '') {
  if(level>60)throw Error('invalid_stage');const spec = stageSpec('paths', level, daily), size = spec.number < 13 ? 5 : spec.number < 37 ? 6 : 7;
  const state = { ...spec, size, pairs: [], paths: {}, solution: [], moves: 0, hints: 0, won: false, log: [] };
  let walk = Array.from({ length: size * size }, (_, i) => Math.floor(i / size) * size + (Math.floor(i / size) % 2 ? size - 1 - i % size : i % size));
  // Backbite mixing preserves a Hamiltonian walk: every puzzle has a full-cover solution.
  for (let i = 0; i < size * size * 35; i++) {
    if (next(state) < .5) walk.reverse();
    const end = walk[0], candidates = walk.map((p, j) => j > 1 && adjacent(end, p, size) ? j : -1).filter(j => j > 0);
    if (candidates.length) { const cut = candidates[Math.floor(next(state) * candidates.length)]; walk = [...walk.slice(0, cut).reverse(), ...walk.slice(cut)]; }
  }
  const count = spec.number < 7 ? 3 : spec.number < 25 ? 4 : spec.number < 43 ? 5 : 6;
  let cursor = 0;
  for (let color = 0; color < count; color++) {
    const left = walk.length - cursor, remaining = count - color;
    const length = remaining === 1 ? left : Math.max(3, Math.min(left - (remaining - 1) * 3, Math.floor(left / remaining) + Math.floor(next(state) * 3) - 1));
    const path = walk.slice(cursor, cursor + length); cursor += length;
    state.solution.push(path); state.pairs.push([path[0], path.at(-1)]);
  }
  return state;
}
function moveLegacyPaths(raw, color, path) {
  if (!raw || raw.won || !Number.isInteger(color) || !raw.pairs[color] || !Array.isArray(path) || path.length < 2 || path.length > raw.size * raw.size || new Set(path).size !== path.length) return { state: raw, accepted: false };
  const pair = raw.pairs[color], blocked = new Set(Object.entries(raw.paths).filter(([key]) => Number(key) !== color).flatMap(([, value]) => value));
  const endpoints = new Set(raw.pairs.filter((_, i) => i !== color).flat());
  if (!pair.includes(path[0]) || path.at(-1) !== pair.find(p => p !== path[0]) || path.some((p, i) => endpoints.has(p) || blocked.has(p) || !Number.isInteger(p) || p < 0 || p >= raw.size * raw.size || i > 0 && !adjacent(path[i - 1], p, raw.size))) return { state: raw, accepted: false };
  const state = structuredClone(raw); state.paths[color] = [...path]; state.moves++; state.log.push({ color, path: [...path] });
  state.won = Object.keys(state.paths).length === state.pairs.length && new Set(Object.values(state.paths).flat()).size === state.size * state.size;
  return { state, accepted: true };
}
export function clearPath(raw, color) {
  if (raw.won || !Number.isInteger(color) || !raw.pairs[color]) return raw;
  const state = structuredClone(raw); delete state.paths[color]; state.log.push({ clear: color }); return state;
}
function hintLegacyPaths(raw) {
  if (raw.won || raw.hints >= 3) return { state: raw, accepted: false };
  const state = structuredClone(raw), color = state.pairs.findIndex((_, i) => JSON.stringify(state.paths[i]) !== JSON.stringify(state.solution[i]));
  if (color < 0) return { state: raw, accepted: false };
  const path = state.solution[color], cells = new Set(path);
  for (const [key, value] of Object.entries(state.paths)) if (Number(key) !== color && value.some(p => cells.has(p))) delete state.paths[key];
  state.paths[color] = [...path]; state.hints++; state.moves++; state.log.push({ hint: true });
  state.won = Object.keys(state.paths).length === state.pairs.length && new Set(Object.values(state.paths).flat()).size === state.size * state.size;
  return { state, accepted: true };
}
export const createPaths=createStrictPaths;
export const restartPaths=restartStrictPaths;
export const restorePaths=restoreStrictPaths;
export function movePaths(raw,color,path){return raw?.engineVersion===3?moveStrictPaths(raw,color,path):moveLegacyPaths(raw,color,path);}
export function hintPaths(raw){return raw?.engineVersion===3?hintStrictPaths(raw):hintLegacyPaths(raw);}
export function starsFor(state) {
  if (!state?.won) return 0;
  if(state.engineVersion===4)return sudokuStars(state);
  if(state.engineVersion===3)return strictPathsStars(state);
  if (state.engineVersion === 2) return match3Stars(state);
  if (state.game === 'jewels') return state.moves <= 10 ? 3 : state.moves <= 15 ? 2 : 1;
  return state.hints === 0 && state.moves <= state.pairs.length + 2 ? 3 : state.hints <= 1 ? 2 : 1;
}
export function replayProof(proof) {
  if(proof?.engineVersion===4){const state=restoreSudoku(proof,{requireWin:true});return {state,stars:sudokuStars(state)};}
  if(proof?.engineVersion===3){const state=restoreStrictPaths(proof,{requireWin:true});return {state,stars:strictPathsStars(state)};}
  if (proof?.engineVersion === 2) { const state=restoreMatch3(proof,{requireWin:true}); return {state,stars:match3Stars(state)}; }
  if (proof?.engineVersion != null) throw new Error('invalid_proof');
  if (!proof || !['jewels','paths'].includes(proof.game) || !Number.isInteger(proof.level) || proof.level < 1 || proof.level > STAGE_COUNT || !Array.isArray(proof.log) || proof.log.length > (proof.game === 'jewels' ? 20 : 180)) throw new Error('invalid_proof');
  let state = proof.game === 'jewels' ? createJewels(proof.level, proof.daily || '') : createLegacyPaths(proof.level, proof.daily || '');
  for (const row of proof.log) {
    if (state.won) throw new Error('moves_after_finish');
    if (proof.game === 'paths' && Number.isInteger(row?.clear)) { state = clearPath(state, row.clear); continue; }
    const result = proof.game === 'jewels' ? moveJewels(state, row) : row?.hint === true ? hintPaths(state) : movePaths(state, row?.color, row?.path);
    if (!result.accepted) throw new Error('invalid_move'); state = result.state;
  }
  if (!state.won) throw new Error('stage_incomplete');
  return { state, stars: starsFor(state) };
}
const cleanStars = value => Number.isInteger(value) && value >= 1 && value <= 3 ? value : 0;
export function normalizeJourney(raw = {}) {
  const stages = Object.fromEntries(GAMES.map(game => [game, Object.fromEntries(Object.entries(raw?.stages?.[game] || {}).filter(([key, value]) => /^\d+$/.test(key) && +key >= 1 && +key <= stageCount(game) && cleanStars(value)).map(([key, value]) => [key, cleanStars(value)]))]));
  const daily = Object.fromEntries(Object.entries(raw?.daily || {}).filter(([key, value]) => /^\d{4}-\d{2}-\d{2}$/.test(key) && value && typeof value === 'object').sort(([a], [b]) => a.localeCompare(b)).slice(-35).map(([key, value]) => [key, Object.fromEntries(GAMES.filter(game => cleanStars(value[game])).map(game => [game, cleanStars(value[game])]))]));
  return { version: 1, stages, daily };
}
export function nextStage(progress, game) { const p = normalizeJourney(progress); for (let i = 1; i <= stageCount(game); i++) if (!p.stages[game]?.[i]) return i; return stageCount(game); }
export function commitJourney(raw, proof, { now = Date.now() } = {}) {
  const progress = normalizeJourney(raw);
  if (proof?.daily && proof.daily !== dayKey(now) && proof.daily !== dayKey(now - 86400000)) throw new Error('daily_expired');
  if (!proof?.daily && (!GAMES.includes(proof?.game) || proof.level > nextStage(progress, proof.game))) throw new Error('stage_locked');
  const { state, stars } = replayProof(proof);
  const target = proof.daily ? progress.daily[proof.daily] ||= {} : progress.stages[proof.game];
  const key = proof.daily ? proof.game : proof.level, first = !target[key]; target[key] = Math.max(target[key] || 0, stars);
  return { journey: normalizeJourney(progress), first, stars, score: state.score || 0, receipt: 'journey-v17:' + proof.game + ':' + (proof.daily || proof.level) };
}
export function journeyStats(raw, now = Date.now()) {
  const p = normalizeJourney(raw), today = dayKey(now); let streak = 0;
  for (let i = 0; i < 35; i++) { const date = dayKey(now - i * 86400000); if (Object.keys(p.daily[date] || {}).length) streak++; else if (i > 0 || date !== today) break; }
  return { stars: GAMES.reduce((sum, game) => sum + Object.values(p.stages[game]).reduce((a, b) => a + b, 0), 0), completed: GAMES.reduce((sum, game) => sum + Object.keys(p.stages[game]).length, 0), dailyDone: Object.keys(p.daily[today] || {}).length, streak };
}
