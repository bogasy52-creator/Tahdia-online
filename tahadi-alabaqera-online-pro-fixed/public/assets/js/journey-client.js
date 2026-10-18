import {GAMES,normalizeJourney, commitJourney, dayKey, journeyStats} from './engines/journey-engine.js?v=23.0.1';
const PREFIX = 'tahdia-journey-v17:', QUEUE = 'tahdia-journey-outbox-v17:';
let chain = Promise.resolve(), revision = 0;
const session = () => { try { return localStorage.getItem('bs_social_session') || ''; } catch { return ''; } };
const owner = () => window.BS_CAREER?.account?.() || 'guest';
const read = key => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
const now = () => window.BS_CAREER?.now?.() || Date.now();
function save(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function notify() { window.dispatchEvent(new CustomEvent('tahdia-journey-change', {detail: get()})); }
export const get = () => normalizeJourney(read(PREFIX + owner()) || {});
export const stats = () => journeyStats(get(), now());
export const today = () => dayKey(now());
export const pendingCount = () => (read(QUEUE + owner()) || []).length;
function serialize(work) { const next = chain.then(work, work); chain = next.catch(() => {}); return next; }
function locked(name, work) { return navigator.locks?.request ? navigator.locks.request(PREFIX + name, work) : work(); }
async function call(proof, token) {
  const response = await fetch('/api/social/career/journey', {method: 'POST', headers: {'content-type': 'application/json', authorization: 'Bearer ' + token}, body: JSON.stringify(proof ? {proof} : {}), cache: 'no-store', signal: AbortSignal.timeout(10000)});
  const data = await response.json(); if (!response.ok) { const error = new Error(data.error || 'تعذر حفظ التقدم'); error.status = response.status; throw error; } return data;
}
function merge(a, b) {
  const left = normalizeJourney(a), right = normalizeJourney(b);
  for (const game of GAMES) for (const [level, stars] of Object.entries(right.stages[game])) left.stages[game][level] = Math.max(left.stages[game][level] || 0, stars);
  for (const [day, row] of Object.entries(right.daily)) for (const [game, stars] of Object.entries(row)) { left.daily[day] ||= {}; left.daily[day][game] = Math.max(left.daily[day][game] || 0, stars); }
  return normalizeJourney(left);
}
export function refresh() {
  const token = session(), name = owner(), current = revision;
  if (!token || name === 'guest') { notify(); return Promise.resolve(get()); }
  return serialize(() => locked(name, async () => {
    let data = await call(null, token);
    if (token !== session() || name !== owner() || current !== revision) return get();
    const rows = read(QUEUE + name) || [];
    for (const proof of rows) {
      if (token !== session() || current !== revision) return get();
      try { data = await call(proof, token); }
      catch (error) {
        // Expired daily stages remain on this device. Do not block later stage sync.
        if (![400, 404].includes(error.status)) throw error;
        if (error.message !== 'daily_expired') throw error;
      }
      const queue = read(QUEUE + name) || []; const index = queue.findIndex(row => row.key === proof.key);
      if (index >= 0) queue.splice(index, 1); save(QUEUE + name, queue);
    }
    if (token !== session() || current !== revision) return get();
    save(PREFIX + name, merge(data.journey, get())); notify();
    window.BS_CAREER?.refresh?.().catch(() => {}); return get();
  }));
}
export async function complete(proof) {
  const name = owner(), token = session(), current = revision;
  const result = await serialize(() => locked(name, async () => {
    if (name !== owner() || token !== session() || current !== revision) throw new Error('account_changed');
    const result = commitJourney(get(), proof, {now: now()});
    if (name !== 'guest' && token) {
      const rows = read(QUEUE + name) || [], key = proof.game + ':' + (proof.daily || proof.level) + ':' + result.stars;
      if (!rows.some(row => row.key === key)) { if (rows.length >= 300) throw new Error('اتصل بالإنترنت لمزامنة المراحل المحفوظة'); rows.push({...proof, key}); save(QUEUE + name, rows); }
    }
    save(PREFIX + name, result.journey); notify(); return result;
  }));
  if (name === 'guest' && name === owner() && token === session() && current === revision) {
    if(result.first)await window.BS_CAREER?.record?.({id: result.receipt, game: proof.game, win: true});
    if(name === owner() && token === session() && current === revision)await window.BS_CAREER?.unlockJourney?.(journeyStats(result.journey).stars);
  }
  if (token && name !== 'guest') refresh().catch(() => {});
  return {...result, pending: token && name !== 'guest'};
}
window.addEventListener('bs-social-session', () => { revision++; notify(); refresh().catch(() => {}); });
window.addEventListener('online', () => refresh().catch(() => {}));
window.addEventListener('storage', event => { if (event.key?.startsWith(PREFIX) || event.key?.startsWith(QUEUE)) notify(); });
export const ready = refresh().catch(() => get());
