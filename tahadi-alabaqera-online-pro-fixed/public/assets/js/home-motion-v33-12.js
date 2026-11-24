/* لعبة العباقرة 33.12.0 — the games on the home page move.
   A reel of every game in the library runs under the lobby cards (tap one to play it), and the
   «كل الألعاب» card turns through their covers. It stops while touched or focused, while the
   page is hidden, and for people who asked their device for less motion. */
(function () {
  'use strict';
  const doc = document;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  function games() {
    return [...doc.querySelectorAll('#games .home-game')].map((card) => ({
      href: card.getAttribute('href'),
      name: card.querySelector('h3')?.textContent.trim() || '',
      image: card.querySelector('img')?.getAttribute('src') || '',
      fresh: Boolean(card.querySelector('.game-number')),
    })).filter((g) => g.href && g.name && g.image && g.href !== '/party');
  }
  function item(game, copy) {
    const a = doc.createElement('a');
    a.className = 'hm-reel-item';
    a.href = game.href;
    if (copy) { a.setAttribute('aria-hidden', 'true'); a.tabIndex = -1; }
    const img = doc.createElement('img');
    img.src = game.image; img.alt = ''; img.width = 120; img.height = 80; img.loading = 'lazy'; img.decoding = 'async';
    const b = doc.createElement('b'); b.textContent = game.name;
    a.append(img, b);
    if (game.fresh) { const i = doc.createElement('i'); i.textContent = 'جديد'; a.append(i); }
    return a;
  }
  function reel(list) {
    const minis = doc.querySelector('.palace-minis');
    if (!minis || doc.querySelector('.hm-reel')) return;
    const box = doc.createElement('section');
    box.className = 'hm-reel';
    box.setAttribute('aria-label', 'كل ألعابنا');
    const track = doc.createElement('div');
    track.className = 'hm-reel-track';
    list.forEach((g) => track.append(item(g, false)));
    // a second copy, for a reel with no seam
    list.forEach((g) => track.append(item(g, true)));
    track.style.setProperty('--hm-count', String(list.length));
    box.append(track);
    minis.after(box);
    let release = 0;
    const hold = () => { box.classList.add('is-held'); clearTimeout(release); release = setTimeout(() => box.classList.remove('is-held'), 2600); };
    box.addEventListener('pointerdown', hold, { passive: true });
    box.addEventListener('wheel', hold, { passive: true });
  }
  function shuffleCovers(list) {
    const card = doc.querySelector('.palace-minis a[href="#games"]');
    if (!card || card.querySelector('.hm-cycle')) return;
    const frame = doc.createElement('span');
    frame.className = 'hm-cycle';
    frame.setAttribute('aria-hidden', 'true');
    const covers = list.filter((g) => !['/jackaroo', '/baloot', '/pegs', '/ludo', '/jewels', '/billiards'].includes(g.href));
    const a = doc.createElement('img'), b = doc.createElement('img');
    [a, b].forEach((img) => { img.alt = ''; img.decoding = 'async'; frame.append(img); });
    card.prepend(frame);
    card.classList.add('hm-has-cycle');
    let i = 0, front = a;
    a.src = covers[0]?.image || ''; a.classList.add('is-on');
    if (covers.length < 2) return;
    setInterval(() => {
      if (doc.hidden || reduce.matches) return;
      i = (i + 1) % covers.length;
      const back = front === a ? b : a;
      back.src = covers[i].image;
      const show = () => { back.classList.add('is-on'); front.classList.remove('is-on'); front = back; };
      if (back.complete) show(); else back.onload = show;
    }, 2600);
  }
  function start() {
    const list = games();
    if (list.length < 4) return;
    reel(list);
    shuffleCovers(list);
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
})();
