/* Tahdia 33.6.0 — home: «ادخل غرفة برمز». A room code from any game, typed on the home page,
   opens that game's room (the first two digits name the game; the server confirms the room is
   open). The box lives in a sheet that opens only when you ask for it, so the page never jumps
   to it or opens the keyboard on its own. 33.7.0: on a phone it opens at the top of the screen
   and keeps to the part the keyboard leaves, so the box is always in view. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const open = $('homeJoinOpen'), sheet = $('homeJoinSheet'), form = $('homeJoinForm'), input = $('homeJoinCode'), error = $('homeJoinError');
  if (!open || !sheet || !form || !input) return;
  const menu = () => window.BS_GAME_MENU;
  const digits = (value) => String(value ?? '').normalize('NFKC').replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 1776)).replace(/\D/g, '');
  let busy = false;
  function say(text) { error.textContent = text || ''; error.hidden = !text; }
  // 33.7.0: while the keyboard is up, the sheet covers only the part of the screen you can see
  const view = window.visualViewport;
  function fit() {
    if (sheet.hidden || !view) return;
    const covered = window.innerHeight - view.height > 80;
    sheet.classList.toggle('fit-keyboard', covered);
    sheet.style.setProperty('--join-top', Math.round(view.offsetTop) + 'px');
    sheet.style.setProperty('--join-height', Math.round(view.height) + 'px');
    if (covered && document.activeElement === input) input.scrollIntoView?.({ block: 'nearest' });
  }
  view?.addEventListener('resize', fit); view?.addEventListener('scroll', fit);
  function show() {
    say(''); input.value = ''; sheet.hidden = false; document.body.classList.add('home-join-on');
    try { input.focus({ preventScroll: true }); } catch { input.focus(); }
    fit();
  }
  function hide() { sheet.hidden = true; sheet.classList.remove('fit-keyboard'); document.body.classList.remove('home-join-on'); busy = false; form.querySelector('[type=submit]').disabled = false; try { open.focus({ preventScroll: true }); } catch {} }
  open.addEventListener('click', show);
  sheet.addEventListener('click', (event) => { if (event.target === sheet || event.target.closest?.('[data-join-close]')) hide(); });
  sheet.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.preventDefault(); hide(); } });
  input.addEventListener('input', () => { const clean = digits(input.value).slice(0, 6); if (clean !== input.value) input.value = clean; say(''); });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    const code = digits(input.value);
    if (!/^\d{6}$/.test(code)) { say('رمز الغرفة 6 أرقام'); input.focus(); return; }
    const m = menu();
    if (!m?.joinAnywhere) { say('ما قدرنا نفتح الغرف الحين، جرّب بعد شوي'); return; }
    busy = true; form.querySelector('[type=submit]').disabled = true; say('');
    window.BS_AUDIO?.play?.('select');
    try {
      // no game is open here, so the code always takes you to its own game's page
      await m.joinAnywhere(code, { game: null, onJoin: async () => { say('ما عرفنا لعبة هذا الرمز. تأكد من الرقم.'); } });
    } catch (e) { say(e?.message || 'ما قدرنا نفتح الغرفة'); }
    busy = false; form.querySelector('[type=submit]').disabled = false;
  });
})();
