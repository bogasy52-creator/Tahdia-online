/* Memory Challenge polish: responsive cards and a real in-game fullscreen mode. */
(function () {
  const root = document.querySelector('[data-arcade-game="memory"]');
  if (!root) return;
  const mount = root.querySelector('#gameMount');
  let fullscreenButton = null;
  function syncFullscreenLabel() {
    if (!fullscreenButton) return;
    fullscreenButton.textContent = document.fullscreenElement ? '⛶ خروج من ملء الشاشة' : '⛶ ملء الشاشة';
    fullscreenButton.setAttribute('aria-pressed', String(Boolean(document.fullscreenElement)));
  }
  function toggleFullscreen() {
    const target = mount?.querySelector('.arcade-stage') || mount;
    if (!target) return;
    const task = document.fullscreenElement ? document.exitFullscreen?.() : target.requestFullscreen?.();
    Promise.resolve(task).catch(() => {
      // iOS Safari has no element fullscreen API; the visual fallback keeps the
      // board useful without changing the scoring logic.
      root.classList.toggle('memory-fullscreen-fallback', !document.fullscreenElement);
      syncFullscreenLabel();
    });
  }
  function enhance() {
    const grid = mount?.querySelector('#memoryGrid');
    const stage = mount?.querySelector('.arcade-stage');
    if (!grid || !stage) return;
    stage.classList.add('memory-pro-stage');
    grid.classList.add('memory-pro-grid');
    grid.querySelectorAll('.memory-card').forEach((card, index) => {
      card.setAttribute('aria-label', `بطاقة الذاكرة ${index + 1}`);
      card.setAttribute('type', 'button');
    });
    if (!fullscreenButton || !fullscreenButton.isConnected) {
      fullscreenButton = document.createElement('button');
      fullscreenButton.type = 'button';
      fullscreenButton.className = 'memory-fullscreen-btn';
      fullscreenButton.addEventListener('click', toggleFullscreen);
      stage.parentElement?.insertBefore(fullscreenButton, stage);
    }
    syncFullscreenLabel();
  }
  root.querySelector('[data-start]')?.addEventListener('click', () => setTimeout(enhance, 80));
  document.addEventListener('fullscreenchange', syncFullscreenLabel);
})();
