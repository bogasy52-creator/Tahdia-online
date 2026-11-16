/* Tahdia 33.10.3 — aiming that does what the hand means, for the cue tables (billiards and carrom).
   Three pieces, each doing one job:
   · turning: drag anywhere on the table and the aim turns with your finger round the ball — it never
     jumps to where you touched, and it slows down near the ball where a small move is a big angle;
   · the ruler: a strip of ticks under the table; slide it for a hair-fine turn, or tap ‹ › to nudge;
   · the pull: pull the handle back along its track and let go to strike; back to the start cancels.
   Every game keeps its own rules: these only turn a hand into the game's own angle and power. */
(function (root) {
  'use strict';
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const clamp = (v) => Math.max(0, Math.min(1, v));

  /** Turning by dragging on the table. o: { can(), point(ev) → {x,y} in table units, center() → {x,y},
      get() → angle, set(angle), lever (table units at which the turn is one to one), claim(p, ev) → false
      to leave a touch to the game, tap(p, ev), start(), end(moved) } */
  function aimDrag(el, o) {
    let h = null;
    el.addEventListener('pointerdown', (e) => {
      if (h || !o.can() || (e.button !== undefined && e.button !== 0) || e.isPrimary === false) return;
      const p = o.point(e); if (!p) return;
      if (o.claim && o.claim(p, e) === false) return;
      e.preventDefault?.();
      const c = o.center(), a = Math.atan2(p.y - c.y, p.x - c.x);
      h = { id: e.pointerId, sx: e.clientX, sy: e.clientY, last: a, base: o.get(), acc: 0, moved: false };
      try { el.setPointerCapture?.(e.pointerId); } catch {}
      o.start?.();
    });
    el.addEventListener('pointermove', (e) => {
      if (!h || h.id !== e.pointerId) return;
      if (!o.can()) { finish(e, true); return; }
      if (!h.moved && Math.hypot(e.clientX - h.sx, e.clientY - h.sy) < 7) return;
      h.moved = true;
      const p = o.point(e); if (!p) return;
      const c = o.center(), a = Math.atan2(p.y - c.y, p.x - c.x), d = Math.hypot(p.x - c.x, p.y - c.y);
      const step = wrap(a - h.last); h.last = a;
      h.acc += step * Math.min(1, d / (o.lever || 120));
      o.set(wrap(h.base + h.acc));
    });
    function finish(e, cancel) {
      if (!h || (e && e.pointerId !== undefined && h.id !== e.pointerId)) return;
      const was = h; h = null;
      if (!cancel && !was.moved && e && o.can()) { const p = o.point(e); if (p) o.tap?.(p, e); }
      o.end?.(was.moved);
    }
    el.addEventListener('pointerup', (e) => finish(e));
    el.addEventListener('pointercancel', (e) => finish(e, true));
    el.addEventListener('lostpointercapture', (e) => finish(e, true));
    return { get active() { return Boolean(h); }, cancel() { finish(null, true); } };
  }

  /** The ruler: slide for a fine turn, tap ‹ › to nudge (hold to keep turning). o: { can(), rotate(radians),
      perPx, nudge, label } — a slide to the right turns the aim clockwise on screen. */
  function fineRuler(el, o) {
    const doc = el.ownerDocument || document;
    for (const a of ['tabindex', 'role', 'aria-valuemin', 'aria-valuemax', 'aria-valuenow', 'aria-valuetext']) el.removeAttribute?.(a);
    // left to right whatever the page: ‹ turns the aim against the clock, › with it, like the slide
    el.classList.add('cue-ruler'); el.setAttribute('role', 'group'); el.setAttribute('dir', 'ltr'); el.setAttribute('aria-label', o.label || 'تصويب دقيق');
    el.replaceChildren();
    const make = (tag, cls, attrs = {}) => { const n = doc.createElement(tag); n.className = cls; for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };
    const left = make('button', 'cue-nudge', { type: 'button', 'aria-label': 'لف التصويب شوي عكس الساعة', 'data-d': '-1' });
    const right = make('button', 'cue-nudge', { type: 'button', 'aria-label': 'لف التصويب شوي مع الساعة', 'data-d': '1' });
    left.textContent = '‹'; right.textContent = '›';
    const track = make('div', 'cue-ruler-track', { tabindex: '0', role: 'slider', 'aria-label': (o.label || 'تصويب دقيق') + ': اسحب يمين ويسار، أو الأسهم', 'aria-valuemin': '-180', 'aria-valuemax': '180', 'aria-valuenow': '0', 'data-label': o.hint || 'دقّق' });
    const ticks = make('i', 'cue-ruler-ticks', { 'aria-hidden': 'true' }), mark = make('i', 'cue-ruler-mark', { 'aria-hidden': 'true' });
    track.append(ticks, mark); el.append(left, track, right);
    let last = null, off = 0, was = null;
    const slide = (dx) => { off += dx; ticks.style.transform = 'translateX(' + (off % 32).toFixed(1) + 'px)'; };
    track.addEventListener('pointerdown', (e) => { if (!o.can()) return; e.preventDefault?.(); last = e.clientX; track.classList.add('drag'); try { track.setPointerCapture?.(e.pointerId); } catch {} });
    track.addEventListener('pointermove', (e) => { if (last === null) return; if (!o.can()) { up(); return; } const dx = e.clientX - last; last = e.clientX; if (!dx) return; slide(dx); o.rotate(dx * (o.perPx || 0.0011)); });
    const up = () => { last = null; track.classList.remove('drag'); };
    track.addEventListener('pointerup', up); track.addEventListener('pointercancel', up); track.addEventListener('lostpointercapture', up);
    track.addEventListener('keydown', (e) => { if (!o.can() || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return; e.preventDefault?.(); e.stopPropagation?.(); const d = e.key === 'ArrowRight' ? 1 : -1; slide(d * 4); o.rotate(d * (e.shiftKey ? 0.0012 : o.nudge || 0.0035)); });
    for (const b of [left, right]) {
      let timer = 0, delay = 0;
      const d = Number(b.getAttribute('data-d')), step = () => { if (!o.can()) { stop(); return; } slide(d * 4); o.rotate(d * (o.nudge || 0.0035)); };
      const stop = () => { clearTimeout(delay); clearInterval(timer); timer = 0; delay = 0; };
      b.addEventListener('pointerdown', (e) => { if (!o.can()) return; e.preventDefault?.(); stop(); step(); delay = setTimeout(() => { timer = setInterval(step, 70); }, 340); });
      b.addEventListener('pointerup', stop); b.addEventListener('pointerleave', stop); b.addEventListener('pointercancel', stop);
      b.addEventListener('click', (e) => { if (!e.detail) step(); }); // a keyboard press (a pointer already turned it)
    }
    return {
      paint(can) { if (can === was) return; was = can; el.classList.toggle('off', !can); for (const b of [left, right]) b.disabled = !can; track.setAttribute('aria-disabled', String(!can)); track.tabIndex = can ? 0 : -1; },
      value(text, now) { track.setAttribute('aria-valuenow', String(now)); track.setAttribute('aria-valuetext', text); },
      track,
    };
  }

  /** The pull: drag the handle back along its track and let go to strike; back near the start cancels.
      o: { can(), change(power), fire(power), cancel(), get() → the prepared power for the keys, min, label,
      hint, armed, weak } */
  function powerPull(el, o) {
    const doc = el.ownerDocument || document;
    el.classList.add('cue-pull'); el.setAttribute('role', 'slider'); el.tabIndex = 0;
    el.setAttribute('aria-label', o.label || 'قوة الضربة: اسحب وأفلت'); el.setAttribute('aria-valuemin', '0'); el.setAttribute('aria-valuemax', '100');
    el.replaceChildren();
    const fill = doc.createElement('i'); fill.className = 'cue-pull-fill'; fill.setAttribute('aria-hidden', 'true');
    const stick = doc.createElement('i'); stick.className = 'cue-pull-stick'; stick.setAttribute('aria-hidden', 'true');
    const text = doc.createElement('b'); text.className = 'cue-pull-text';
    const value = doc.createElement('output'); value.className = 'cue-pull-value';
    el.append(fill, stick, text, value);
    let from = null, power = 0, was = null;
    const min = o.min ?? 0.06, hint = o.hint || 'اسحب لورا وأفلت';
    function paint(p) {
      power = p; el.style.setProperty('--p', p.toFixed(3)); el.setAttribute('aria-valuenow', String(Math.round(p * 100)));
      el.setAttribute('aria-valuetext', Math.round(p * 100) + '%');
      value.textContent = p > 0.01 ? Math.round(p * 100) + '%' : '';
      el.classList.toggle('armed', p >= min); el.classList.toggle('hard', p >= 0.75); el.classList.toggle('live', p > 0.01); el.classList.toggle('far', p >= 0.45);
      text.textContent = !from || p <= 0.01 ? hint : p >= min ? (o.armed || 'أفلت للضربة') : (o.weak || 'رجّعها للبداية = إلغاء');
    }
    el.addEventListener('pointerdown', (e) => { if (!o.can() || from) return; e.preventDefault?.(); from = { x: e.clientX, y: e.clientY, id: e.pointerId }; el.classList.add('drag'); try { el.setPointerCapture?.(e.pointerId); } catch {} paint(0); });
    el.addEventListener('pointermove', (e) => {
      if (!from || e.pointerId !== from.id) return;
      if (!o.can()) { release(true); return; }
      const r = el.getBoundingClientRect();
      // pull it any way you like: along the track, or down
      const p = clamp(Math.max(Math.abs(e.clientX - from.x) / Math.max(40, r.width * 0.78), (e.clientY - from.y) / 180));
      if (Math.abs(p - power) < 0.004) return;
      paint(p); o.change?.(p);
    });
    function release(cancel) {
      if (!from) return; from = null; el.classList.remove('drag');
      const p = power; paint(0);
      if (!cancel && p >= min && o.can()) o.fire(p); else o.cancel?.();
    }
    el.addEventListener('pointerup', (e) => { if (from && e.pointerId === from.id) release(false); });
    el.addEventListener('pointercancel', () => release(true));
    el.addEventListener('lostpointercapture', () => release(true));
    el.addEventListener('keydown', (e) => {
      if (!o.can()) return;
      const now = o.get ? o.get() : power;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault?.(); e.stopPropagation?.(); const p = clamp(now + (e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? 0.05 : -0.05) * (e.shiftKey ? 0.2 : 1)); o.change?.(p); el.setAttribute('aria-valuenow', String(Math.round(p * 100))); el.setAttribute('aria-valuetext', Math.round(p * 100) + '%'); }
      else if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault?.(); e.stopPropagation?.(); if (now >= min) o.fire(now); }
      else if (e.key === 'Escape') { e.preventDefault?.(); e.stopPropagation?.(); o.cancel?.(); }
    });
    paint(0);
    return {
      paint(can) { if (can === was) return; was = can; el.classList.toggle('off', !can); el.setAttribute('aria-disabled', String(!can)); el.tabIndex = can ? 0 : -1; if (!can && from) release(true); },
      get dragging() { return Boolean(from); },
    };
  }

  root.BS_CUE_CONTROLS = Object.freeze({ aimDrag, fineRuler, powerPull, wrap });
})(window);
