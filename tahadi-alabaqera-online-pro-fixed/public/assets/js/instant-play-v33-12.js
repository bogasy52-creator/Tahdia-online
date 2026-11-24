/* لعبة العباقرة 33.12.0 / 33.13.0 — a game opens straight into play, after one quick choice.
   A plain visit (nothing in the address) shows a small sheet with the game's own modes (the
   opponent, the level, the number of players…), the last choice already picked, and one big
   «العب». It presses the page's own controls for you, so every rule and every room stays the
   page's. Games with nothing to choose start at once. Playing with friends happens outside the
   game, in «الغرف» (/party?game=…). `?play=menu` shows the page's full menu as before, and any
   room, party or match in the address is left to the page exactly as it was.
   Loaded in <head>: the menu stays hidden while the sheet is up. */
(function (root) {
  'use strict';
  if (root.BS_INSTANT) return;
  const doc = root.document, loc = root.location;
  const page = (loc.pathname.replace(/\.html$/, '').replace(/\/+$/, '') || '/').slice(1);
  // a choice: [label, control, extra]. control: a selector to press, or '=#select=value'.
  // extra.text: the pressed control must also say this (several share one data-v); extra.start:
  // the button that starts the game for this choice.
  const OPPONENT = (ai, two, start) => ['الخصم', [['ضد منافس', ai, { start: start[0] }], ['مع خويّك على جوال واحد', two, { start: start[1] }]]];
  const LEVEL = (sel, names = ['سهل', 'متوسط', 'صعب'], values = ['easy', 'medium', 'hard']) => ['المستوى', values.map((v, i) => [names[i], `${sel}[data-v="${v}"]`])];
  const GAMES = Object.freeze({
    // pages with their own practice table
    hockey: { groups: [OPPONENT('[data-v="ai"]', '[data-v="two"]', ['#startBtn', '#startBtn']), LEVEL('', ['سهل', 'متوسط', 'صعب'], ['easy', 'mid', 'hard']), ['الأهداف', [['3', '[data-v="3"]'], ['5', '[data-v="5"]'], ['7', '[data-v="7"]']]]], running: 'body.hockey-running' },
    billiards: { groups: [OPPONENT('[data-mode="ai"]', '[data-mode="two"]', ['#biStartAi', '#biStartTwo']), LEVEL('', ['سهل', 'متوسط', 'محترف'])], running: 'body.bi-playing' },
    carrom: { groups: [OPPONENT('[data-mode="ai"]', '[data-mode="hotseat"]', ['[data-start="ai"]', '[data-start="hotseat"]']), LEVEL('', ['سهل', 'متوسط', 'محترف'], ['easy', 'normal', 'expert'])], running: 'body.carrom-running' },
    race: { alias: 'carrom' },
    pegs: { prep: ['?#pegsTourSkip'], groups: [OPPONENT('[data-mode="ai"]', '[data-mode="hotseat"]', ['[data-start="ai"]', '[data-start="hotseat"]']),
      ['الطور', [['الكلاسيكي', '=#pegsFormat=classic'], ['الطاولة الكبيرة', '=#pegsFormat=large'], ['الفرق', '=#pegsFormat=teams'], ['سباق الذاكرة', '=#pegsFormat=race'], ['السباق الكبير', '=#pegsFormat=race-large']]],
      LEVEL(), ['وقت الحفظ', [['4 ث', '[data-v="4"]', { text: 'ث' }], ['7 ث', '[data-v="7"]', { text: 'ث' }], ['12 ث', '[data-v="12"]', { text: 'ث' }]]]], running: 'body.pegs-running' },
    tanks: { prep: ['#tkPracticeTab'], groups: [['الطور', [['كل دبابة لنفسها', '=#tkPracticeMode=ffa'], ['فريقان', '=#tkPracticeMode=teams']]], ['الدبابات', [['2', '=#tkPracticeCount=2'], ['4', '=#tkPracticeCount=4']]], ['المستوى', [['سهل', '=#tkPracticeLevel=0'], ['متوسط', '=#tkPracticeLevel=1'], ['صعب', '=#tkPracticeLevel=2']]]], start: '#tkPractice', running: 'body.game-running' },
    jewels: { groups: [OPPONENT('[data-mode="ai"]', '[data-mode="two"]', ['#jwStartAi', '#jwStartTwo']), LEVEL('', ['هادئ', 'منافس', 'محترف'])], running: 'body.game-running' },
    'paths-online': { prep: ['#pathModeSolo'], groups: [['الصعوبة', [['سهل', '=#pathDifficulty=1'], ['متوسط', '=#pathDifficulty=2'], ['صعب', '=#pathDifficulty=3'], ['خبير', '=#pathDifficulty=4'], ['ماستر', '=#pathDifficulty=5']]]], start: '#pathSoloStart', focus: '#pathMatch' },
    ludo: { groups: [['الخصم', [['ضد منافسين', '=#practiceMode=ai'], ['مع أصحابك على جوال واحد', '=#practiceMode=pass']]], ['اللاعبين', [['2', '=#practiceCount=2'], ['3', '=#practiceCount=3'], ['4', '=#practiceCount=4'], ['6', '=#practiceCount=6']]], ['الطور', [['الكلاسيك', '=#practiceSpeed=classic'], ['سريع ⚡', '=#practiceSpeed=quick']]]], start: '#practiceStart', running: 'body.game-running', online: true },
    picture: { groups: [['الصورة', [['9 قطع', '=#practiceSize=3'], ['16 قطعة', '=#practiceSize=4'], ['25 قطعة', '=#practiceSize=5']]]], start: '#practice', running: 'body.picture-playing' },
    memory: { groups: [['الطريقة', [['سباق الأزواج', '=#memoryMode=pairs'], ['بدون مؤقت', '=#memoryMode=calm'], ['تذكّر الترتيب', '=#memoryMode=sequence']]], ['المستوى', [['مريح', '=#arcadeLevel=casual'], ['متوازن', '=#arcadeLevel=standard'], ['محترف', '=#arcadeLevel=expert']]]], start: '#start', running: 'body.memory-playing' },
    logic: { groups: [['المستوى', [['مريح', '=#arcadeLevel=casual'], ['متوازن', '=#arcadeLevel=standard'], ['محترف', '=#arcadeLevel=expert']]]], start: '#start', focus: '#arena' },
    puzzle: { groups: [['المستوى', [['مريح', '=#arcadeLevel=casual'], ['متوازن', '=#arcadeLevel=standard'], ['محترف', '=#arcadeLevel=expert']]]], start: '#start', focus: '#arena' },
    reaction: { steps: ['#chPractice'], running: 'body.ch-in-match' },
    focus: { steps: ['#chPractice'], running: 'body.ch-in-match' },
    cipher: { steps: ['#chPractice'], running: 'body.ch-in-match' },
    wordbomb: { steps: ['#chPractice'], running: 'body.ch-in-match' },
    uno: { groups: [['الطور', [['كلاسيكي', '=#unoMode=classic'], ['سحب متراكم', '=#unoMode=stack'], ['جولة سريعة', '=#unoMode=quick']]], ['اللاعبين', [['2', '=#unoPracticePlayers=2'], ['3', '=#unoPracticePlayers=3'], ['4', '=#unoPracticePlayers=4'], ['6', '=#unoPracticePlayers=6'], ['8', '=#unoPracticePlayers=8']]]], start: '#chPractice', running: 'body.ch-in-match', online: true },
    chaos: { alias: 'uno' },
    sudoku: { steps: ['#sudokuContinue'], running: 'body.sudoku-playing' },
    bridge: { groups: [['الطور', [['سباق', '[data-br-mode="race"]'], ['بالدور', '[data-br-mode="turns"]']]], ['المستوى', [['سهل', '[data-br-level="casual"]'], ['متوسط', '[data-br-level="standard"]'], ['صعب', '[data-br-level="expert"]']]]], start: '#brPlay', running: 'body.br-running' },
    blocks: { groups: [['الطور', [['كلاسيك', '[data-bk-mode="classic"]'], ['دقيقتين ⏱', '[data-bk-mode="timed"]']]], ['المستوى', [['سهل', '[data-bk-level="casual"]'], ['متوسط', '[data-bk-level="standard"]'], ['صعب', '[data-bk-level="expert"]']]]], start: '#bkPlay', running: 'body.bk-running' },
    ten: { groups: [['المنافسين', [['سهل', '[data-ts-level="casual"]'], ['متوسط', '[data-ts-level="standard"]'], ['صعب', '[data-ts-level="expert"]']]]], start: '#tsPlay', running: 'body.ts-running' },
    // games that are played online only: the quick table, completed by the computer
    snakes: { quick: true, groups: [['الطور', [['عادي', '.gm33-mode[data-mode="classic"]'], ['الصدام', '.gm33-mode[data-mode="clash"]'], ['مطوّر', '.gm33-mode[data-mode="adventure"]']]], ['اللاعبين', [['2', '.gm33-seat[data-seats="2"]'], ['3', '.gm33-seat[data-seats="3"]'], ['4', '.gm33-seat[data-seats="4"]']]]] },
    jackaroo: { quick: true, groups: [['الطور', [['الكلاسيك', '.gm33-mode[data-mode="classic"]'], ['سريع ⚡', '.gm33-mode[data-mode="quick"]']]], ['اللاعبين', [['4', '.gm33-seat[data-seats="4"]'], ['6', '.gm33-seat[data-seats="6"]']]]] },
    baloot: { quick: true, groups: [['القانون', [['مفتوح', '.gm33-mode[data-mode="open"]'], ['مقيّد', '.gm33-mode[data-mode="strict"]']]]] },
    dice: { quick: true }, serpent: { quick: true }, online: { quick: true },
    // the questions: the quick online round is the game itself; the group lineup lives in ?play=menu
    quiz: { go: '/online' },
  });
  // the name and picture each game's sheet shows
  const ART = Object.freeze({ ludo: ['لودو', 'brand/ludo-cover-v33-15.webp'], blocks: ['رص البلوكات', 'brand/blocks-cover-v33-15.svg'], bridge: ['جسر الألوان', 'brand/bridge-cover-v33-12.svg'], ten: ['عشر ثواني', 'brand/ten-cover-v33-12.svg'], jackaroo: ['جاكارو', 'brand/jackaroo-cover-v33-8.webp'], baloot: ['بلوت', 'brand/baloot-cover-v32.webp'], uno: ['أونو', 'challenges/uno-table.svg'], pegs: ['سر الألوان', 'brand/pegs-cover-v33-10-3.webp'], snakes: ['الثعبان والسلالم', 'brand/snakes-studio-v29-1.webp'], billiards: ['بلياردو', 'brand/billiards-cover-33-10-nov14.webp'], carrom: ['كيرم', 'brand/carrom-cover-v33-9-6.webp'], hockey: ['هوكي الهواء', 'brand/air-hockey-cover-v33-7.svg'], memory: ['الذاكرة', 'game-cards-v27/memory.svg'], logic: ['المنطق', 'game-cards-v27/logic.svg'], puzzle: ['ترتيب الأرقام', 'game-cards-v27/puzzle.svg'], 'paths-online': ['توصيل الأرقام', 'game-cards-v27/paths-online.svg'], picture: ['سباق الصور', 'ai-v19/garden.webp'], jewels: ['ماستر الجواهر', 'brand/jewels-cover-v33-10-5.webp'], tanks: ['معركة الدبابات', 'brand/tanks-arena-cover-nov14.webp'] });
  const key = GAMES[page]?.alias || page, game = GAMES[key];
  if (!game) return;
  const params = new URLSearchParams(loc.search), play = params.get('play') || '';
  // anything else in the address belongs to the page (a room code, a party round, a level…)
  const own = [...params.keys()].some((name) => !['play', 'utm_source', 'utm_medium', 'utm_campaign', 'from'].includes(name));
  const instant = Boolean(game) && !own && !['menu', 'online', 'room'].includes(play) && !root.BS_PARTY_LINK && root.top === root.self;
  const party = { carrom: 'carrom', uno: 'chaos', online: 'quiz', 'paths-online': 'paths-online' }[key] || key;
  // بلوت has no seat in the group room: its friends play in its own room
  const partyUrl = key === 'baloot' ? loc.pathname + '?play=room' : '/party?game=' + encodeURIComponent(party);
  const hasOnline = Boolean(game.quick || game.online || game.groups?.some(([, list]) => list.some(([, sel]) => /online/.test(sel))) || ['hockey', 'billiards', 'carrom', 'pegs', 'jewels', 'tanks'].includes(key));
  root.BS_INSTANT = Object.freeze({ page: key, instant, play, partyUrl, menuUrl: loc.pathname + '?play=menu', onlineUrl: loc.pathname + '?play=online' });
  const html = doc.documentElement;
  html.classList.add(instant ? 'ip-instant' : 'ip-menu');
  function ready(fn) { if (doc.readyState === 'complete') setTimeout(fn, 60); else root.addEventListener('load', () => setTimeout(fn, 60), { once: true }); }
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function find(selector, tries, text) {
    for (let i = 0; i < tries; i++) {
      const list = [...doc.querySelectorAll(selector)].filter((el) => !el.disabled && (!text || (el.textContent || '').includes(text)));
      if (list.length) return list[0];
      await wait(120);
    }
    return null;
  }
  async function press(list, tries = 25) {
    for (const selector of list) { const el = await find(selector, tries); if (el) { el.click(); return true; } }
    return false;
  }
  if (!instant) {
    // ?play=online / ?play=room from «الغرف» or the sheet: the page's own buttons, pressed for you
    if (play === 'online' || play === 'room') ready(async() => {const rule=new URLSearchParams(loc.search).get('rule');if(key==='baloot'&&['open','strict'].includes(rule))await press(['.gm33-mode[data-mode="'+rule+'"]'],12);return press(play === 'online' ? ['[data-v="online"]', '[data-mode="online"]', '.gm33-quick', '#tkQuick', '#chQuick'] : ['.gm33-create', '#tkCreate', '#chCreate'], 12);});
    return;
  }
  if (game.go) { loc.replace(game.go); return; }
  html.classList.add('ip-boot');
  const style = doc.createElement('style');
  style.textContent = 'html.ip-boot body{visibility:hidden}html.ip-boot .ip-sheet{visibility:visible}html.ip-boot{background:#160a33}html.ip-boot:not(.ip-asking)::after{content:"";position:fixed;inset:50% auto auto 50%;width:44px;height:44px;margin:-22px;border-radius:50%;border:4px solid #ffffff22;border-top-color:#ffcc3e;animation:ip-spin .8s linear infinite}@keyframes ip-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){html.ip-boot::after{animation:none}}';
  (doc.head || html).appendChild(style);
  let shown = false;
  const show = () => { if (shown) return; shown = true; html.classList.remove('ip-boot', 'ip-asking'); };
  let safety = setTimeout(show, 6500);

  /* ---------------------------------------------------------------- the choices */
  const STORE = 'bs-ip-choice-' + key;
  const saved = () => { try { return JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch { return {}; } };
  const save = (value) => { try { localStorage.setItem(STORE, JSON.stringify(value)); } catch { /* private mode */ } };
  function isOn(control, extra = {}) {
    if (control.startsWith('=')) { const [sel, value] = control.slice(1).split('='); return doc.querySelector(sel)?.value === value; }
    const el = [...doc.querySelectorAll(control)].find((n) => !extra.text || (n.textContent || '').includes(extra.text));
    return Boolean(el && (el.classList.contains('is-on') || el.classList.contains('on') || el.classList.contains('active') || el.getAttribute('aria-pressed') === 'true' || el.getAttribute('aria-checked') === 'true' || el.getAttribute('aria-selected') === 'true'));
  }
  async function choose(control, extra = {}) {
    if (control.startsWith('=')) {
      const [sel, value] = control.slice(1).split('=');
      const el = await find(sel, 20);
      if (el && el.value !== value) { el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })); el.dispatchEvent(new Event('input', { bubbles: true })); }
      return;
    }
    const el = await find(control, 20, extra.text);
    if (el) { el.click(); await wait(90); }
  }
  function picks() {
    const memory = saved();
    return (game.groups || []).map(([label, list]) => {
      const remembered = list.findIndex(([name]) => name === memory[label]);
      if (remembered >= 0) return remembered;
      const current = list.findIndex(([, control, extra]) => isOn(control, extra));
      return current >= 0 ? current : 0;
    });
  }

  /* ---------------------------------------------------------------- starting */
  async function start(chosen) {
    try {
      for (const step of game.prep || []) { const optional = step.startsWith('?'), sel = optional ? step.slice(1) : step; const el = await find(sel, optional ? 4 : 30); if (el) { el.click(); await wait(160); } }
      if (game.quick) {
        for (const [i, [, list]] of (game.groups || []).entries()) { const [, control, extra] = list[chosen[i]]; await choose(control, extra); }
        const match = await find('.gm33-match-choice select', 10);
        if (match && match.value !== 'mixed') { match.value = 'mixed'; match.dispatchEvent(new Event('change', { bubbles: true })); }
        const ok = await press(['.gm33-quick'], 40);
        await wait(ok ? 500 : 0);
        return show();
      }
      if (game.steps) {
        for (const step of game.steps) {
          const optional = step.startsWith('?'), sel = optional ? step.slice(1) : step;
          const el = await find(sel, optional ? 4 : 40);
          if (!el) { if (optional) continue; return show(); }
          el.click(); await wait(160);
        }
      } else {
        let begin = game.start;
        for (const [i, [, list]] of game.groups.entries()) { const [, control, extra = {}] = list[chosen[i]]; await choose(control, extra); if (extra.start) begin = extra.start; await wait(60); }
        const el = await find(begin, 40);
        if (!el) return show();
        el.click();
      }
      if (game.running) for (let i = 0; i < 25 && !doc.querySelector(game.running); i++) await wait(120);
      // the board itself, not the page's title, is what the player sees first
      if (game.focus) { const el = doc.querySelector(game.focus); if (el) { el.style.scrollMarginTop = '64px'; el.scrollIntoView({ block: 'start' }); } }
    } catch { /* the page's menu stays: the same as before this file */ }
    show();
  }

  /* ---------------------------------------------------------------- the sheet */
  function sheet() {
    const [title = (doc.title.split('—')[0] || '').trim(), image] = ART[key] || [];
    const chosen = picks();
    const box = doc.createElement('div');
    box.className = 'ip-sheet';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-labelledby', 'ipSheetTitle');
    const card = doc.createElement('div'); card.className = 'ip-card';
    const head = doc.createElement('div'); head.className = 'ip-head';
    const h = doc.createElement('h2'); h.id = 'ipSheetTitle'; h.textContent = title || 'جاهز؟';
    const back = doc.createElement('a'); back.href = '/'; back.className = 'ip-close'; back.setAttribute('aria-label', 'رجوع للرئيسية'); back.textContent = '✕';
    head.append(h, back); card.append(head);
    if (image) { const pic = doc.createElement('img'); pic.className = 'ip-cover'; pic.src = '/assets/' + image; pic.alt = ''; pic.decoding = 'async'; card.insertBefore(pic, head); }
    (game.groups || []).forEach(([label, list], g) => {
      const row = doc.createElement('div'); row.className = 'ip-group'; row.setAttribute('role', 'radiogroup'); row.setAttribute('aria-label', label);
      const name = doc.createElement('span'); name.className = 'ip-label'; name.textContent = label; row.append(name);
      const opts = doc.createElement('div'); opts.className = 'ip-options' + (list.length > 4 ? ' is-many' : '');
      list.forEach(([text], i) => {
        const b = doc.createElement('button'); b.type = 'button'; b.textContent = text; b.setAttribute('role', 'radio');
        const paint = () => { const on = chosen[g] === i; b.classList.toggle('is-on', on); b.setAttribute('aria-checked', String(on)); };
        b.addEventListener('click', () => { chosen[g] = i; opts.querySelectorAll('button').forEach((x, j) => { x.classList.toggle('is-on', j === i); x.setAttribute('aria-checked', String(j === i)); }); });
        paint(); opts.append(b);
      });
      row.append(opts); card.append(row);
    });
    const go = doc.createElement('button'); go.type = 'button'; go.className = 'ip-play'; go.textContent = game.quick ? 'العب الحين' : 'العب';
    go.addEventListener('click', () => {
      const memory = {}; (game.groups || []).forEach(([label, list], g) => { memory[label] = list[chosen[g]][0]; }); save(memory);
      html.classList.remove('ip-asking'); box.remove(); clearTimeout(safety); safety = setTimeout(show, 6500); start(chosen);
    });
    card.append(go);
    const more = doc.createElement('div'); more.className = 'ip-more-ways';
    const link = (href, text) => { const a = doc.createElement('a'); a.href = href; a.textContent = text; return a; };
    more.append(link(partyUrl, '👥 غرفة مع أصحابك'));
    if (hasOnline && !game.quick) more.append(link(root.BS_INSTANT.onlineUrl, '🌐 أونلاين'));
    more.append(link(root.BS_INSTANT.menuUrl, '⚙ كل الخيارات'));
    card.append(more); box.append(card);
    doc.body.append(box);
    html.classList.add('ip-asking');
    clearTimeout(safety);
    go.focus({ preventScroll: true });
    doc.addEventListener('keydown', function esc(e) { if (e.key === 'Escape' && box.isConnected) { doc.removeEventListener('keydown', esc); loc.href = '/'; } });
  }
  ready(() => {
    clearTimeout(safety);
    if (game.groups?.length) { sheet(); return; }
    safety = setTimeout(show, 6500);
    start([]);
  });

  // the way to play with friends (outside, in الغرف) and to the full menu, on the page itself
  ready(() => {
    if (doc.querySelector('.ip-ways')) return;
    const nav = doc.createElement('nav');
    nav.className = 'ip-ways';
    nav.setAttribute('aria-label', 'طرق اللعب');
    const link = (href, icon, text, cls) => { const a = doc.createElement('a'); a.href = href; a.className = cls; const i = doc.createElement('span'); i.setAttribute('aria-hidden', 'true'); i.textContent = icon; const b = doc.createElement('b'); b.textContent = text; a.append(i, b); return a; };
    nav.append(link(partyUrl, '👥', 'العب مع أصحابك', 'ip-friends'), link(root.BS_INSTANT.menuUrl, '⚙', 'الأوضاع والأونلاين', 'ip-more'));
    const host = doc.querySelector('main') || doc.body;
    host.insertBefore(nav, host.firstChild);
  });
})(window);
