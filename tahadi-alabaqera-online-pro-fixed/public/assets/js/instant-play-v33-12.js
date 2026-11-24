/* لعبة العباقرة 33.12.0 — every game opens straight into play.
   A plain visit (nothing in the address) starts the page's own game at once: the practice
   table against the computer, or, for the games that only exist online, the quick table that
   the computer completes. Playing with friends happens outside the game, in «الغرف»
   (/party?game=…). `?play=menu` shows the page's full menu as before (modes, online, rooms),
   and any room, party or match in the address is left to the page exactly as it was.
   Loaded in <head>: it hides the menu for the moment the game needs to open. */
(function (root) {
  'use strict';
  if (root.BS_INSTANT) return;
  const doc = root.document, loc = root.location;
  const page = (loc.pathname.replace(/\.html$/, '').replace(/\/+$/, '') || '/').slice(1);
  const GAMES = Object.freeze({
    // pages with their own practice table
    hockey: { steps: ['[data-v="ai"]', '#startBtn'], running: 'body.hockey-running' },
    billiards: { steps: ['[data-mode="ai"]', '#biStartAi'], running: 'body.bi-playing' },
    carrom: { steps: ['[data-mode="ai"]', '.cm-primary'], running: 'body.carrom-running' },
    race: { alias: 'carrom' },
    pegs: { steps: ['?#pegsTourSkip', '[data-mode="ai"]', '?.pg-primary'], running: 'body.pegs-running' },
    tanks: { steps: ['#tkPracticeTab', '#tkPractice'], running: 'body.game-running' },
    jewels: { steps: ['[data-mode="ai"]', '#jwStartAi'], running: 'body.game-running' },
    'paths-online': { steps: ['#pathModeSolo', '#pathSoloStart'], focus: '#pathMatch' },
    ludo: { steps: ['=#practiceMode=ai', '#practiceStart'], running: 'body.game-running' },
    picture: { steps: ['#practice'], running: 'body.picture-playing' },
    memory: { steps: ['#start'], running: 'body.memory-playing' },
    logic: { steps: ['#start'], focus: '#arena' },
    puzzle: { steps: ['#start'], focus: '#arena' },
    reaction: { steps: ['#chPractice'], running: 'body.ch-in-match' },
    focus: { steps: ['#chPractice'], running: 'body.ch-in-match' },
    cipher: { steps: ['#chPractice'], running: 'body.ch-in-match' },
    wordbomb: { steps: ['#chPractice'], running: 'body.ch-in-match' },
    uno: { steps: ['#chPractice'], running: 'body.ch-in-match' },
    chaos: { alias: 'uno' },
    sudoku: { steps: ['#sudokuContinue'], running: 'body.sudoku-playing' },
    bridge: { steps: ['#brPlay'], running: 'body.br-running' },
    ten: { steps: ['#tsPlay'], running: 'body.ts-running' },
    // games that are played online only: the quick table, completed by the computer
    snakes: { quick: true }, dice: { quick: true }, jackaroo: { quick: true },
    baloot: { quick: true }, serpent: { quick: true }, online: { quick: true },
    // the questions: the quick online round is the game itself; the group lineup lives in ?play=menu
    quiz: { go: '/online' },
  });
  const key = GAMES[page]?.alias || page, game = GAMES[key];
  if (!game) return;
  const params = new URLSearchParams(loc.search), play = params.get('play') || '';
  // anything else in the address belongs to the page (a room code, a party round, a level…)
  const own = [...params.keys()].some((name) => !['play', 'utm_source', 'utm_medium', 'utm_campaign', 'from'].includes(name));
  const instant = Boolean(game) && !own && !['menu', 'online', 'room'].includes(play) && !root.BS_PARTY_LINK && root.top === root.self;
  const party = { carrom: 'carrom', uno: 'chaos', online: 'quiz', 'paths-online': 'paths-online' }[key] || key;
  // بلوت has no seat in the group room: its friends play in its own room
  const partyUrl = key === 'baloot' ? loc.pathname + '?play=room' : '/party?game=' + encodeURIComponent(party);
  root.BS_INSTANT = Object.freeze({ page: key, instant, play, partyUrl, menuUrl: loc.pathname + '?play=menu' });
  const html = doc.documentElement;
  html.classList.add(instant ? 'ip-instant' : 'ip-menu');
  if (!instant) {
    // ?play=online / ?play=room from «الغرف»: the page's own buttons, pressed for you
    if (play === 'online' || play === 'room') ready(() => press(play === 'online' ? ['.gm33-quick', '#tkQuick', '#chQuick'] : ['.gm33-create', '#tkCreate', '#chCreate'], 12));
    return;
  }
  if (game.go) { loc.replace(game.go); return; }
  html.classList.add('ip-boot');
  const style = doc.createElement('style');
  style.textContent = 'html.ip-boot body{visibility:hidden}html.ip-boot{background:#160a33}html.ip-boot::after{content:"";position:fixed;inset:50% auto auto 50%;width:44px;height:44px;margin:-22px;border-radius:50%;border:4px solid #ffffff22;border-top-color:#ffcc3e;animation:ip-spin .8s linear infinite}@keyframes ip-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){html.ip-boot::after{animation:none}}';
  (doc.head || html).appendChild(style);
  let shown = false;
  const show = () => { if (shown) return; shown = true; html.classList.remove('ip-boot'); };
  const safety = setTimeout(show, 6500);

  function ready(fn) { if (doc.readyState === 'complete') setTimeout(fn, 60); else root.addEventListener('load', () => setTimeout(fn, 60), { once: true }); }
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function find(selector, tries) {
    for (let i = 0; i < tries; i++) {
      const el = doc.querySelector(selector);
      if (el && !el.disabled) return el;
      await wait(120);
    }
    return null;
  }
  async function press(list, tries = 25) {
    for (const selector of list) { const el = await find(selector, tries); if (el) { el.click(); return true; } }
    return false;
  }
  async function run() {
    try {
      if (game.quick) {
        const choice = await find('.gm33-match-choice select', 10);
        if (choice && choice.value !== 'mixed') { choice.value = 'mixed'; choice.dispatchEvent(new Event('change', { bubbles: true })); }
        const ok = await press(['.gm33-quick'], 40);
        await wait(ok ? 500 : 0);
        return show();
      }
      for (const step of game.steps) {
        if (step.startsWith('=')) {
          const [selector, value] = step.slice(1).split('=');
          const el = await find(selector, 25);
          if (el && el.value !== value) { el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })); }
          continue;
        }
        const optional = step.startsWith('?'), selector = optional ? step.slice(1) : step;
        const el = await find(selector, optional ? 4 : 40);
        if (!el) { if (optional) continue; return show(); }
        el.click();
        await wait(160);
      }
      if (game.running) for (let i = 0; i < 25 && !doc.querySelector(game.running); i++) await wait(120);
      // the board itself, not the page's title, is what the player sees first
      if (game.focus) { const el = doc.querySelector(game.focus); if (el) { el.style.scrollMarginTop = '64px'; el.scrollIntoView({ block: 'start' }); } }
    } catch { /* the page's menu stays: the same as before this file */ }
    show();
  }
  ready(() => { clearTimeout(safety); setTimeout(show, 6500); run(); });

  // the way to play with friends (outside, in الغرف) and to the full menu, on the page itself
  ready(() => {
    if (doc.querySelector('.ip-ways')) return;
    const nav = doc.createElement('nav');
    nav.className = 'ip-ways';
    nav.setAttribute('aria-label', 'طرق اللعب');
    const link = (href, icon, text, cls) => { const a = doc.createElement('a'); a.href = href; a.className = cls; const i = doc.createElement('span'); i.setAttribute('aria-hidden', 'true'); i.textContent = icon; const b = doc.createElement('b'); b.textContent = text; a.append(i, b); return a; };
    nav.append(link(root.BS_INSTANT.partyUrl, '👥', 'العب مع أصحابك', 'ip-friends'), link(root.BS_INSTANT.menuUrl, '⚙', 'الأوضاع والأونلاين', 'ip-more'));
    const host = doc.querySelector('main') || doc.body;
    host.insertBefore(nav, host.firstChild);
  });
})(window);
