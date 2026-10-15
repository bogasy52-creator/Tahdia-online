(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const search = $('gameSearch'), cards = [...document.querySelectorAll('.home-game')];
  if (!search || !cards.length) return;
  let category = 'all';
  const normalize = value => String(value).normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').toLowerCase().trim();
  function filterGames() {
    const terms = normalize(search.value).split(/\s+/).filter(Boolean);
    let count = 0;
    for (const card of cards) {
      const matches = (category === 'all' || card.dataset.categories.split(' ').includes(category)) && terms.every(term => normalize(card.textContent).includes(term));
      card.classList.toggle('hidden', !matches);
      if (matches) count++;
    }
    $('gameResults').textContent = count + ' ألعاب جاهزة للعب';
    $('gameEmpty').classList.toggle('hidden', count > 0);
  }
  search.addEventListener('input', filterGames);
  $('gameFilters').addEventListener('click', event => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    category = button.dataset.category;
    $('gameFilters').querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    filterGames();
  });
  $('gameReset').onclick = () => {
    category = 'all'; search.value = '';
    $('gameFilters').querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', String(item.dataset.category === 'all')));
    filterGames(); search.focus();
  };
  const allowed = new Map(cards.map(card => [card.getAttribute('href'), card]));
  try {
    const last = allowed.get(localStorage.getItem('tahdia-last-game-v14'));
    if (last) {
      $('lastGame').href = last.getAttribute('href');
      $('lastGameName').textContent = last.querySelector('h3').textContent;
      $('lastGame').classList.remove('hidden');
    }
  } catch {}
  document.querySelectorAll('[data-game-route], .home-game').forEach(link => link.addEventListener('click', () => {
    const route = link.dataset.gameRoute || link.getAttribute('href');
    if (allowed.has(route)) try { localStorage.setItem('tahdia-last-game-v14', route); } catch {}
  }));
  $('homeQuickPlay').onclick = async () => {
    const button = $('homeQuickPlay');
    if (button.disabled) return;
    button.disabled = true; button.setAttribute('aria-busy', 'true');
    try { await window.TahdiaMatchmaking.join(); }
    catch (error) { window.BS_PLATFORM?.toast?.(error.message || 'تعذر بدء المواجهة. أعد المحاولة.'); }
    finally { button.disabled = false; button.setAttribute('aria-busy', 'false'); }
  };
  $('editProfile').onclick = async () => {
    const name = prompt('اكتب اسم اللاعب', window.BS_CAREER.get().name);
    if (!name?.trim()) return;
    try { await window.BS_CAREER.rename(name.trim()); }
    catch (error) { window.BS_PLATFORM?.toast?.(error.message); }
  };
  filterGames();
})();
