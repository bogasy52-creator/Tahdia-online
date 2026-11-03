/* Tahdia 33.7.0 — «ساعة الغرفة»: one clear countdown for every room.
   A game hands its deadline to the clock (BS_CLOCK.attach(host).set({...})) and the clock
   does the rest the same way everywhere: a ring with the seconds in big digits, amber in
   the last ten seconds and red in the last five, a tick for every one of the last five
   seconds when the time is yours (or everybody's), and a heartbeat at three. When the place
   of the clock scrolls out of sight, a copy floats at the top of the screen.
   BS_CLOCK.alert() is the other half of the tension: when a player is one step from winning,
   everybody else hears a heartbeat and sees who it is; the player himself sees a gold note.
   And when a turn becomes yours, a soft call (and the tab's title, if you are elsewhere). */
(() => {
  'use strict';
  if (window.BS_CLOCK) return;
  const clocks = new Set(), seen = new Map();
  let loop = 0, floatBox = null, floatRing = null, floatText = null, edge = null, banner = null, bannerTimer = 0;
  const audio = () => window.BS_AUDIO;
  function settings() { try { return audio()?.getSettings?.() || {}; } catch { return {}; } }
  const quiet = () => { const s = settings(); return Boolean(s.muted) || s.effects === false; };
  function heartbeat(strong = true) {
    const a = audio(); if (!a?.tone || quiet()) return;
    try { a.unlock?.(); a.tone(66, .12, strong ? .6 : .4, 'sine', 0, 42); a.tone(60, .14, strong ? .5 : .32, 'sine', .2, 38); } catch {}
  }
  function chime() {
    const a = audio(); if (!a?.tone || quiet()) return;
    try { a.unlock?.(); a.tone(660, .1, .05, 'triangle', 0); a.tone(880, .14, .05, 'triangle', .09); a.tone(1320, .18, .04, 'sine', .18); } catch {}
  }
  // «دورك»: a soft two-note call and a short buzz when your turn starts, and the tab's title
  // says so while you are in another app, so a turn is never lost to the clock unnoticed
  let title = '', titled = false;
  function yourTurn() {
    const a = audio();
    if (a?.tone && !quiet()) { try { a.unlock?.(); a.tone(523, .09, .045, 'sine', 0); a.tone(784, .14, .05, 'sine', .1); } catch {} }
    try { a?.vibrate?.(28); } catch {}
    if (document.hidden && !titled) { title = document.title; titled = true; document.title = '⏰ دورك! · ' + title; }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && titled) { document.title = title; titled = false; } });
  function make(tag, cls, parent) { const el = document.createElement(tag); el.className = cls; parent?.append(el); return el; }
  function shared() {
    if (floatBox || !document.body) return;
    floatBox = make('div', 'bs-clock-float', document.body); floatBox.setAttribute('aria-hidden', 'true');
    floatRing = make('i', 'bs-clock', floatBox); floatRing.dataset.size = 'sm';
    floatText = make('span', 'bs-clock-float-text', floatBox);
    edge = make('div', 'bs-tension-edge', document.body); edge.setAttribute('aria-hidden', 'true');
    banner = make('div', 'bs-alert-banner', document.body); banner.setAttribute('role', 'status'); banner.setAttribute('aria-live', 'polite');
  }
  const rendered = (el) => Boolean(el?.isConnected && el.getClientRects().length);
  function inView(el) { const r = el.getBoundingClientRect(), h = window.innerHeight || document.documentElement.clientHeight; return r.width > 0 && r.bottom > 6 && r.top < h - 6; }
  function paint(el, sec, f, tone) {
    const text = String(sec);
    if (el.dataset.s !== text) el.dataset.s = text;
    if (el.dataset.tone !== tone) el.dataset.tone = tone;
    el.classList.toggle('long', sec >= 100);
    el.style.setProperty('--f', f.toFixed(3));
  }
  function frame() {
    let tension = false, lead = null;
    for (const c of [...clocks]) {
      if (!c.host.isConnected) { c.destroy(); continue; }
      const s = c.spec; if (!s) continue;
      const now = s.clock ? Number(s.clock()) : Date.now(), left = Math.max(0, s.end - now), sec = Math.ceil(left / 1000);
      if (!c.full) c.full = s.total > 0 ? s.total : Math.max(1000, left);
      const f = Math.max(0, Math.min(1, left / c.full));
      const tone = left <= 0 ? 'out' : sec <= 5 ? 'danger' : sec <= 10 || f <= .25 ? 'warn' : 'calm';
      paint(c.el, sec, f, tone); c.host.dataset.clockTone = tone;
      const loud = Boolean(s.mine || s.shared), live = rendered(c.host) && !document.hidden;
      if (loud && live && c.last !== -1 && sec !== c.last) {
        if (sec > 0 && sec <= 5) { try { audio()?.timerTick?.(sec); } catch {} if (sec === 3) heartbeat(true); }
        else if (sec === 0 && s.mine && c.last > 0) { try { audio()?.timerEnd?.(); } catch {} }
      }
      c.last = sec;
      if (loud && live && left > 0 && sec <= 5) tension = true;
      if (live && (!lead || (loud && !(lead.spec.mine || lead.spec.shared)))) lead = c;
    }
    if (floatBox) {
      const show = Boolean(lead && lead.spec && !inView(lead.el));
      floatBox.classList.toggle('show', show);
      if (show) { paint(floatRing, Number(lead.el.dataset.s) || 0, Number(lead.el.style.getPropertyValue('--f')) || 0, lead.el.dataset.tone || 'calm'); floatText.textContent = lead.spec.label || ''; floatBox.dataset.tone = lead.el.dataset.tone || 'calm'; }
      edge.classList.toggle('on', tension);
    }
    if (![...clocks].some((c) => c.spec)) stop();
  }
  function run() { if (!loop) loop = setInterval(frame, 200); }
  function stop() { if (loop) { clearInterval(loop); loop = 0; } floatBox?.classList.remove('show'); edge?.classList.remove('on'); }
  /** Puts a clock at the start of `host` (it stays there when the page rewrites the host's text). */
  function attach(host, { size = '' } = {}) {
    if (!host) return null;
    if (host.__bsClock) return host.__bsClock;
    shared();
    const el = document.createElement('i'); el.className = 'bs-clock'; el.setAttribute('aria-hidden', 'true'); if (size) el.dataset.size = size;
    const c = { host, el, spec: null, last: -1, full: 0 };
    const keep = () => { if (c.spec && host.firstChild !== el) host.prepend(el); };
    c.watch = new MutationObserver(keep); c.watch.observe(host, { childList: true });
    /** {end, total, clock, mine, shared, key, label}: `end` and `clock()` share one time base. */
    c.set = (spec) => {
      const end = Number(spec?.end);
      if (!spec || !Number.isFinite(end) || end <= 0) return c.clear();
      if (!c.spec || c.spec.key !== spec.key) { c.last = -1; c.full = 0; if (spec.mine && end > (spec.clock ? Number(spec.clock()) : Date.now()) + 1500) yourTurn(); }
      c.spec = { ...spec, end, total: Number(spec.total) || 0 };
      keep(); host.classList.add('bs-clock-on'); run(); frame();
      return c;
    };
    c.clear = () => {
      if (!c.spec) return c;
      c.spec = null; el.remove(); host.classList.remove('bs-clock-on'); delete host.dataset.clockTone; frame();
      return c;
    };
    c.destroy = () => { c.clear(); c.watch.disconnect(); clocks.delete(c); delete host.__bsClock; };
    clocks.add(c); host.__bsClock = c;
    return c;
  }
  /** Once per key: «فلان قرب يفوز» with a heartbeat for everyone else (tone 'rival'), or a
      gold note for the player who is close (tone 'mine'). */
  function alert(key, text, { tone = 'rival', hold = 3000 } = {}) {
    if (!key || !text) return false;
    shared(); if (!banner || seen.has(key)) return false;
    seen.set(key, Date.now()); if (seen.size > 120) seen.delete(seen.keys().next().value);
    banner.textContent = text; banner.dataset.tone = tone;
    banner.classList.remove('show'); void banner.offsetWidth; banner.classList.add('show');
    clearTimeout(bannerTimer); bannerTimer = setTimeout(() => banner.classList.remove('show'), hold);
    if (tone === 'rival') {
      heartbeat(true); setTimeout(() => heartbeat(false), 820);
      edge.classList.remove('flash'); void edge.offsetWidth; edge.classList.add('flash'); setTimeout(() => edge.classList.remove('flash'), 2200);
      try { audio()?.vibrate?.([40, 70, 40]); } catch {}
    } else chime();
    return true;
  }
  window.BS_CLOCK = Object.freeze({ attach, alert, heartbeat, active: () => [...clocks].filter((c) => c.spec).length });
})();
