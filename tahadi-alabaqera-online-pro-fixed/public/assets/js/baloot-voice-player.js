/* Complete, ordered calls. A new call never interrupts the current recording. */
export function createVoicePlayer({ recordings, getContext, fetchClip, isAllowed,
  getVolume, isVisible = () => true, onChange = () => {}, now = () => Date.now(),
  maxQueue = 8, maxAge = 3500, cacheSize = 16, loadTimeout = 2500 }) {
  const buffers = new Map(), loading = new Map(), seen = new Map();
  let queue = [], active = null, generation = 0, runner = null;
  let error = null, last = null, disposed = false;
  const volume = () => { const n = Number(getVolume()); return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : .72; };
  const allowed = () => !disposed && isVisible() && isAllowed() && volume() > 0;
  function status() {
    return { state: active ? 'playing' : runner ? 'loading' : error ? 'error' : 'ready',
      pending: queue.length, current: active?.id ?? null, last, error };
  }
  function changed() { onChange(status()); }
  async function load(id, ticket) {
    if (buffers.has(id)) {
      const buffer = buffers.get(id); buffers.delete(id); buffers.set(id, buffer); return buffer;
    }
    if (loading.has(id)) return loading.get(id).promise;
    const controller = new AbortController();
    const item = { controller, promise: null };
    let timer;
    const work = (async () => {
      const data = await fetchClip(recordings[id], controller.signal);
      if (ticket !== generation || disposed || controller.signal.aborted) return null;
      const context = getContext();
      if (!context) throw new Error('audio_unavailable');
      const buffer = await context.decodeAudioData(data);
      if (ticket !== generation || disposed || controller.signal.aborted) return null;
      buffers.set(id, buffer);
      while (buffers.size > cacheSize) buffers.delete(buffers.keys().next().value);
      return buffer;
    })();
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error('clip_timeout')); }, loadTimeout);
    });
    item.promise = Promise.race([work, timeout]).finally(() => {
      clearTimeout(timer);
      if (loading.get(id) === item) loading.delete(id);
    });
    loading.set(id, item);
    return item.promise;
  }
  const fresh = item => now() - item.created <= item.maxAge;
  function warmQueue() {
    // Fetch the next calls during the current recording, rather than adding
    // another network round trip after each spoken word. Speculation is bounded.
    for (const item of queue) {
      if (loading.size >= 2) break;
      if (fresh(item) && !buffers.has(item.id) && !loading.has(item.id)) void load(item.id, generation).catch(() => {});
    }
  }
  function play(buffer, id, ticket) {
    return new Promise((resolve, reject) => {
      const context = getContext();
      if (ticket !== generation || !allowed() || context?.state !== 'running') { resolve(false); return; }
      let source, gain, finished = false;
      const done = () => {
        if (finished) return; finished = true;
        if (active?.source === source) active = null;
        if (source) source.onended = null;
        try { source?.disconnect(); gain?.disconnect(); } catch {}
        resolve(true);
      };
      try {
        source = context.createBufferSource(); gain = context.createGain();
        source.buffer = buffer; gain.gain.value = volume();
        source.connect(gain); gain.connect(context.destination);
        source.onended = done;
        active = { id, source, gain, done };
        // Play the entire recording at its original speed, including its ending.
        source.start();
        last = id; error = null; changed();
      } catch (cause) {
        finished = true;
        if (active?.source === source) active = null;
        try { source?.disconnect(); gain?.disconnect(); } catch {}
        reject(cause);
      }
    });
  }
  async function drain() {
    if (runner || !allowed() || getContext()?.state !== 'running') return;
    const ticket = generation, token = {};
    runner = token; changed();
    try {
      while (queue.length && ticket === generation && allowed()) {
        if (getContext()?.state !== 'running') break;
        const next = queue.shift();
        if (!fresh(next)) continue;
        try {
          const pending = load(next.id, ticket);
          warmQueue();
          const buffer = await pending;
          if (ticket !== generation || !allowed()) break;
          // A suspended context keeps the call pending until a real user gesture.
          if (getContext()?.state !== 'running') { queue.unshift(next); break; }
          if (buffer && fresh(next)) await play(buffer, next.id, ticket);
        } catch {
          if (ticket === generation) { error = 'clip_unavailable'; changed(); }
        }
      }
    } finally {
      if (runner === token) {
        runner = null; changed();
        if (queue.length && allowed() && getContext()?.state === 'running') void drain();
      }
    }
  }
  function enqueue(id, { urgent = false, key, createdAt = now(), maxAge: age = maxAge } = {}) {
    if (!recordings[id]?.src || !allowed()) return false;
    const item = { id, urgent, created: Number.isFinite(createdAt) ? Math.min(now(), createdAt) : now(),
      maxAge: Number.isFinite(age) && age >= 0 ? age : maxAge };
    const identity = key == null ? null : String(key);
    if (!fresh(item) || identity !== null && seen.has(identity)) return false;
    queue = queue.filter(fresh);
    if (queue.length >= maxQueue) {
      const expendable = queue.findIndex(item => !item.urgent);
      if (!urgent && expendable < 0) return false;
      queue.splice(expendable < 0 ? 0 : expendable, 1);
    }
    if (identity !== null) {
      seen.set(identity, true);
      while (seen.size > 256) seen.delete(seen.keys().next().value);
    }
    const index = urgent ? queue.findIndex(entry => !entry.urgent) : -1;
    if (index < 0) queue.push(item); else queue.splice(index, 0, item);
    changed(); void drain(); warmQueue(); return true;
  }
  function stop({ clearLast = false } = {}) {
    generation++; queue = []; runner = null; error = null; seen.clear();
    for (const item of loading.values()) item.controller.abort();
    loading.clear();
    const playing = active; active = null;
    if (playing) { try { playing.source.stop(); } catch {} playing.done(); }
    if (clearLast) last = null;
    changed();
  }
  function refreshSettings() {
    if (!allowed()) { stop(); return; }
    if (active) active.gain.gain.value = volume();
    void drain();
  }
  async function prime(ids) {
    if (!allowed()) return;
    const ticket = generation, pending = ids.filter(id => recordings[id]?.src);
    // Bound decoding and network work on mobile devices.
    await Promise.all([0, 1].map(async () => {
      while (pending.length && ticket === generation && allowed()) {
        try { await load(pending.shift(), ticket); } catch { /* Playback exposes a failed call. */ }
      }
    }));
  }
  return { enqueue, drain, prime, stop, refreshSettings, status,
    replay() { return last ? enqueue(last, { urgent: true }) : false; },
    dispose() { stop({ clearLast: true }); buffers.clear(); disposed = true; } };
}
