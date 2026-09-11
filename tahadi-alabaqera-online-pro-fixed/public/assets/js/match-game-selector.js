(function (global) {
  'use strict';

  const games = Object.freeze([
    Object.freeze({ id: 'quiz', name: 'تحدي العباقرة', icon: '🧠', note: 'أسئلة وذاكرة وصور وأصوات', transport: 'quiz' }),
    Object.freeze({ id: 'snakes', name: 'الثعبان والسلالم', icon: '🐍', note: 'سباق إلى الخانة 100', transport: 'board' }),
    Object.freeze({ id: 'zahra', name: 'لعبة الزهرة', icon: '🎲', note: 'حركة وتخطيط ومنافسة', transport: 'board' }),
    Object.freeze({ id: 'jackaroo', name: 'جاكارو', icon: '🃏', note: 'فرق وبطاقات وتكتيك', transport: 'board' }),
    Object.freeze({ id: 'spotdiff', name: 'اكتشف الفروقات', icon: '🔍', note: 'سرعة ملاحظة مباشرة', transport: 'board' }),
  ]);
  const requestedId = new URLSearchParams(global.location?.search || '').get('game');
  let selectedId = games.some((game) => game.id === requestedId) ? requestedId : 'quiz';

  function findGame(id) {
    return games.find((game) => game.id === String(id || '')) || null;
  }

  function updateSelection() {
    if (!global.document) return;
    global.document.querySelectorAll?.('[data-match-game]').forEach((button) => {
      const selected = button.dataset.matchGame === selectedId;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    const game = findGame(selectedId);
    const search = global.document.getElementById?.('searchBtn');
    if (search && game) search.textContent = `⚔️ ابحث عن منافس في ${game.name}`;
    const status = global.document.getElementById?.('searchStatus');
    if (status && game) status.textContent = `تم اختيار ${game.name} — اضغط للبحث`;
  }

  function select(id) {
    if (!findGame(id)) return false;
    selectedId = id;
    updateSelection();
    return true;
  }

  function launch(id = selectedId) {
    const game = findGame(id);
    if (!game) {
      global.BS_PLATFORM?.toast?.('اختر لعبة صحيحة أولًا');
      return false;
    }
    selectedId = game.id;
    if (game.transport === 'quiz') {
      if (!global.TahdiaMatchmaking?.join) {
        global.BS_PLATFORM?.toast?.('نظام مطابقة الأسئلة لم يجهز بعد');
        return false;
      }
      global.TahdiaMatchmaking.join();
      return true;
    }
    if (!global.TAHADI_BOARD_MATCHMAKING?.join) {
      global.BS_PLATFORM?.toast?.('نظام مطابقة اللعبة لم يجهز بعد');
      return false;
    }
    global.TAHADI_BOARD_MATCHMAKING.join(game.id);
    return true;
  }

  function render() {
    if (!global.document) return;
    const picker = global.document.getElementById?.('matchGamePicker');
    if (!picker) return;
    picker.innerHTML = games.map((game) => `<button type="button" class="match-game-option${game.id === selectedId ? ' selected' : ''}" data-match-game="${game.id}" aria-pressed="${game.id === selectedId}"><span class="match-game-icon" aria-hidden="true">${game.icon}</span><span><b>${game.name}</b><small>${game.note}</small></span><i aria-hidden="true">✓</i></button>`).join('');
    picker.querySelectorAll('[data-match-game]').forEach((button) => button.addEventListener('click', () => select(button.dataset.matchGame)));
    global.document.getElementById?.('searchBtn')?.addEventListener('click', () => launch());
    updateSelection();
  }

  global.TAHADI_GAME_SELECTOR = Object.freeze({ games, findGame, select, launch, selected: () => selectedId });
  if (!global.document) return;
  if (global.document.readyState === 'loading') global.document.addEventListener('DOMContentLoaded', render, { once: true });
  else render();
}(window));
