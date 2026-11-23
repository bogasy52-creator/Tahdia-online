/* Keep the optional owner and audio actions out of the wallet/profile row. */
(() => {
  const menu = document.querySelector('.home-palace .palace-more');
  if (!menu) return;
  const summary = menu.querySelector('summary');
  document.addEventListener('pointerdown', event => {
    if (menu.open && !menu.contains(event.target)) menu.open = false;
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.open) {
      menu.open = false;
      summary.focus();
    }
  });
  menu.addEventListener('click', event => {
    if (event.target.closest?.('a')) menu.open = false;
  });
})();
