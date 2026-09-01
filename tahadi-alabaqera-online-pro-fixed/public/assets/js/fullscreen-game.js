(() => {
  const root = document.documentElement;
  const body = document.body;
  const buttons = () => [...document.querySelectorAll('[data-game-fullscreen]')];
  const supported = !!(root.requestFullscreen || root.webkitRequestFullscreen);
  const active = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  const dedicatedStage = () => body.classList.contains('game-running') && (body.classList.contains('game-snakes') || body.classList.contains('game-zahra'));
  let frame = 0;
  let lastBoardWidth = 0;
  let lastBoardHeight = 0;
  let lastLayoutMode = '';

  function viewport() {
    const vv = window.visualViewport;
    return {
      width: Math.max(1, Math.round(vv?.width || window.innerWidth || root.clientWidth || 1)),
      height: Math.max(1, Math.round(vv?.height || window.innerHeight || root.clientHeight || 1)),
    };
  }

  function updateButton() {
    const isActive = active();
    for (const button of buttons()) {
      button.textContent = isActive ? '↙' : '⛶';
      button.classList.toggle('is-fullscreen', isActive);
      button.setAttribute('aria-pressed', String(isActive));
      button.setAttribute('aria-label', isActive ? 'الخروج من ملء الشاشة' : 'ملء الشاشة');
      button.title = isActive ? 'الخروج من ملء الشاشة' : 'ملء الشاشة';
      if (!supported) button.dataset.cssFullscreen = 'true';
    }
  }

  function fitNow() {
    frame = 0;
    const {width, height} = viewport();
    body.style.setProperty('--game-vw', `${width}px`);
    body.style.setProperty('--game-vh', `${height}px`);
    updateButton();
    if (!dedicatedStage()) return;

    const computeLayout = window.BS_ADAPTIVE_BOARD_LAYOUT?.computeAdaptiveBoardLayout;
    const layout = computeLayout
      ? computeLayout({width, height})
      : {
          mode: height >= width ? 'portrait' : 'landscape',
          boardSize: Math.min(width, height),
          boardWidth: Math.min(width, height),
          boardHeight: Math.min(width, height),
          topStrip: height >= width ? 36 : 0,
          gap: height >= width ? 2 : 4,
          dockWidth: Math.min(300, Math.max(168, Math.round(width * .24))),
          dockHeight: Math.min(230, Math.max(180, height - Math.min(width, height) - 38)),
        };
    body.dataset.gameLayoutMode = layout.mode;
    body.style.setProperty('--game-top-strip', `${layout.topStrip}px`);
    body.style.setProperty('--game-gap', `${layout.gap}px`);
    body.style.setProperty('--game-dock-width', `${layout.dockWidth}px`);
    body.style.setProperty('--game-dock-height', `${layout.dockHeight}px`);
    body.style.setProperty('--game-board-size', `${layout.boardSize}px`);
    body.style.setProperty('--game-board-width', `${layout.boardWidth??layout.boardSize}px`);
    body.style.setProperty('--game-board-height', `${layout.boardHeight??layout.boardSize}px`);

    const main = document.querySelector('#game .game-main');
    const board = document.querySelector('#game .snake-board-wrap, #game .ludo-frame');
    if (!main || !board) return;

    // The layout CSS determines how much room the board column/row receives.
    // Scale the planned board without destroying its portrait aspect ratio.
    const rect = main.getBoundingClientRect();
    const plannedWidth=Math.max(1,layout.boardWidth??layout.boardSize);
    const plannedHeight=Math.max(1,layout.boardHeight??layout.boardSize);
    const scale=Math.min(1,rect.width/plannedWidth,rect.height/plannedHeight);
    const boardWidth=Math.max(1,Math.floor(plannedWidth*scale));
    const boardHeight=Math.max(1,Math.floor(plannedHeight*scale));
    const size=Math.min(boardWidth,boardHeight);
    if (Math.abs(boardWidth-lastBoardWidth)>1 || Math.abs(boardHeight-lastBoardHeight)>1 || layout.mode !== lastLayoutMode) {
      lastBoardWidth = boardWidth;
      lastBoardHeight = boardHeight;
      lastLayoutMode = layout.mode;
      body.style.setProperty('--game-board-size', `${size}px`);
      body.style.setProperty('--game-board-width', `${boardWidth}px`);
      body.style.setProperty('--game-board-height', `${boardHeight}px`);
      window.dispatchEvent(new CustomEvent('busraj:game-layout', {detail: {width, height, boardSize: size, boardWidth, boardHeight, mode: layout.mode}}));
    }
  }

  function fit() {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => requestAnimationFrame(fitNow));
  }

  async function toggle() {
    try {
      if (active()) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) await exit.call(document);
      } else {
        const request = root.requestFullscreen || root.webkitRequestFullscreen;
        if (request) {
          try { await request.call(root, {navigationUI: 'hide'}); }
          catch { await request.call(root); }
        } else {
          window.BS_PLATFORM?.toast?.('اللعبة ممتدة بالفعل على كامل مساحة الشاشة المتاحة');
        }
      }
    } catch {
      window.BS_PLATFORM?.toast?.('تعذر وضع المتصفح في ملء الشاشة — مساحة اللعبة نفسها ستبقى كاملة');
    }
    fit();
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-game-fullscreen]');
    if (!button) return;
    event.preventDefault();
    toggle();
  });
  document.addEventListener('fullscreenchange', fit);
  document.addEventListener('webkitfullscreenchange', fit);
  window.addEventListener('resize', fit, {passive: true});
  window.addEventListener('orientationchange', () => setTimeout(fit, 90), {passive: true});
  window.visualViewport?.addEventListener('resize', fit, {passive: true});
  window.visualViewport?.addEventListener('scroll', fit, {passive: true});

  const bodyObserver = new MutationObserver((records) => {
    if (records.some((record) => record.attributeName === 'class')) fit();
  });
  bodyObserver.observe(body, {attributes: true, attributeFilter: ['class']});

  if ('ResizeObserver' in window) {
    const resizeObserver = new ResizeObserver(() => fit());
    const main = document.querySelector('#game .game-main');
    if (main) resizeObserver.observe(main);
  }

  window.BS_GAME_FULLSCREEN = Object.freeze({fit, toggle, active, supported});
  fit();
})();
