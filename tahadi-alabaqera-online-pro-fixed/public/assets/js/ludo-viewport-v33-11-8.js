/* Fit the existing SVG to the actual space left by the toolbar, players and dock.
   No game state, geometry, turn or saved room is changed by a viewport update. */
(() => {
  const body = document.body, arena = document.getElementById('game');
  const stage = arena?.querySelector('.ludo-stage');
  if (!body.classList.contains('ludo-page') || !stage) return;
  const rosters = [...stage.querySelectorAll('.ludo-plates')];
  const finite = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
  function compute({width, height, top = 0, bottom = 0, gap = 8, landscape = false}) {
    width = finite(width); height = finite(height); gap = finite(gap);
    // In landscape the same two rosters sit beside the board, with room for 3 seats each.
    const side = landscape ? Math.min(180, Math.max(100, width * .22)) : 0;
    const freeWidth = landscape ? width - 2 * side - 2 * gap : width;
    const freeHeight = landscape ? height : height - finite(top) - finite(bottom) - 2 * gap;
    return Math.max(1, Math.floor(Math.min(760, freeWidth, freeHeight)));
  }
  let frame = 0, last = 0;
  function fit() {
    frame = 0;
    if (!body.classList.contains('game-running') || arena.classList.contains('hidden')) return;
    const rect = stage.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    const landscape = window.matchMedia('(orientation:landscape) and (max-height:620px)').matches;
    const gap = parseFloat(window.getComputedStyle(stage).rowGap) || 0;
    const size = compute({width: rect.width, height: rect.height,
      top: rosters[0]?.getBoundingClientRect().height || 0,
      bottom: rosters[1]?.getBoundingClientRect().height || 0, gap, landscape});
    if (size !== last) {
      last = size;
      stage.style.setProperty('--ludo-board-size', size + 'px');
    }
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(fit);
  }
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(schedule);
    [stage, arena, ...rosters].forEach(element => observer.observe(element));
  }
  const mutations = new MutationObserver(schedule);
  mutations.observe(body, {attributes: true, attributeFilter: ['class']});
  mutations.observe(arena, {attributes: true, attributeFilter: ['class']});
  mutations.observe(stage, {subtree: true, attributes: true, attributeFilter: ['hidden']});
  window.addEventListener('resize', schedule, {passive: true});
  window.addEventListener('orientationchange', schedule, {passive: true});
  window.visualViewport?.addEventListener('resize', schedule, {passive: true});
  window.addEventListener('pageshow', schedule);
  window.BS_LUDO_VIEWPORT = Object.freeze({compute, fit: schedule});
  schedule();
})();
