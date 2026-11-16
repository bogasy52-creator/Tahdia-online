/* Tahdia 33.10.3 — the home lobby: a greeting by the time of day and your name, the spotlight of
   tonight's games (dots, and a slow turn to the next one until you touch it), and a filter bar that
   shows a line under it once it sticks to the top. Nothing here is needed for the page to work. */
(function () {
  'use strict';
  const doc = document, strip = doc.querySelector('.home-featured'), dots = doc.querySelector('[data-spot-dots]');
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // the greeting: morning or evening, with your name when we know it
  const greet = doc.querySelector('[data-home-greet]');
  function paintGreeting() {
    if (!greet) return;
    const hour = new Date().getHours(), part = hour >= 4 && hour < 12 ? 'صباح الخير' : 'مساء الخير';
    let name = '';
    try { name = (window.BS_SOCIAL?.isLoggedIn?.() && window.BS_SOCIAL.profile?.()?.displayName) || window.BS_CAREER?.get?.()?.name || ''; } catch {}
    name = String(name || '').trim();
    greet.textContent = name && name !== 'لاعب العباقرة' ? part + '، ' + name : part;
  }
  paintGreeting();
  addEventListener('bs-career-change', paintGreeting);
  setTimeout(paintGreeting, 1200);

  // the spotlight: one dot a game, the dot of the game in view lit
  if (strip && dots) {
    const cards = [...strip.querySelectorAll('.home-feature')];
    dots.replaceChildren(...cards.map(() => doc.createElement('i')));
    let current = 0, touched = false, timer = 0;
    const wide = () => getComputedStyle(strip).display === 'grid';
    function light(i) { current = i; [...dots.children].forEach((d, k) => d.classList.toggle('on', k === i)); }
    function nearest() {
      const box = strip.getBoundingClientRect(), mid = box.left + box.width / 2;
      let best = 0, bestD = Infinity;
      cards.forEach((c, k) => { const r = c.getBoundingClientRect(), d = Math.abs(r.left + r.width / 2 - mid); if (d < bestD) { bestD = d; best = k; } });
      return best;
    }
    let ticking = false;
    strip.addEventListener('scroll', () => { if (ticking) return; ticking = true; requestAnimationFrame(() => { ticking = false; light(nearest()); }); }, { passive: true });
    for (const type of ['pointerdown', 'touchstart', 'wheel', 'keydown']) strip.addEventListener(type, () => { touched = true; }, { passive: true });
    light(0);
    // a slow turn to the next game while nobody touches it and it can be seen
    let visible = true;
    if (typeof IntersectionObserver === 'function') new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(strip);
    if (!reduce) timer = setInterval(() => {
      if (touched || !visible || wide() || doc.hidden) return;
      const next = cards[(current + 1) % cards.length];
      next.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }, 5200);
    addEventListener('pagehide', () => clearInterval(timer));
  }

  // who is playing now: a line under the title, and a badge on the games with players in them
  const KEYS = { uno: 'chaos', 'paths-online': 'paths' };
  const keyOf = (href) => { const name = String(href || '').split(/[?#]/)[0].replace(/^\/+|\/+$/g, ''); return KEYS[name] || name; };
  async function live() {
    if (doc.hidden || typeof fetch !== 'function') return;
    let data = null;
    try { const r = await fetch('/api/presence/live', { cache: 'no-store', credentials: 'same-origin' }); if (r.ok) data = await r.json(); } catch {}
    if (!data?.ok) return;
    const copy = doc.querySelector('.home-hero .hero-copy');
    let line = doc.querySelector('[data-home-live]');
    if (!line && copy) { line = doc.createElement('p'); line.className = 'home-live'; line.dataset.homeLive = ''; copy.append(line); }
    if (line) { const n = Number(data.people) || 0; line.hidden = n < 2; line.textContent = n + ' لاعب في بوسراج الحين'; }
    for (const card of doc.querySelectorAll('.home-game, .home-feature')) {
      const n = Number(data.games?.[keyOf(card.getAttribute('href'))]) || 0;
      let badge = card.querySelector('.home-playing');
      if (n < 2) { badge?.remove(); continue; }
      if (!badge) { badge = doc.createElement('span'); badge.className = 'home-playing'; (card.querySelector('.game-cover') || card).append(badge); }
      badge.textContent = n + ' يلعبون';
    }
  }
  live(); setInterval(live, 60000);

  // the filter bar shows its edge once it sticks
  const tools = doc.querySelector('.game-library-tools');
  if (tools && typeof IntersectionObserver === 'function') {
    const mark = doc.createElement('i'); mark.setAttribute('aria-hidden', 'true'); mark.style.cssText = 'display:block;height:1px;margin-bottom:-1px';
    tools.before(mark);
    new IntersectionObserver(([e]) => tools.classList.toggle('is-stuck', !e.isIntersecting && e.boundingClientRect.top < 0)).observe(mark);
  }
})();
