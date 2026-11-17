/* Tahdia 33.10.7 — «شطرنج الذاكرة» is a memory game, so a screenshot of the colours is cheating.
   A web page can't stop the phone's own screenshot (only a native app can), so the board does what a
   page can: it covers the colours the moment the page leaves the screen or loses focus, while the
   desktop screenshot keys are held (PrintScreen, ⌘⇧ on a Mac, ⊞⇧ on Windows), and covers the board during printing. The cover lifts as soon as the player is back on the board. */
const STYLE = `
.pegs-shield{position:absolute;inset:0;z-index:60;display:grid;place-content:center;gap:8px;text-align:center;
  background:#080a16;backdrop-filter:blur(26px);-webkit-backdrop-filter:blur(26px);color:#fff;
  font:800 17px/1.5 inherit;border-radius:inherit;padding:18px;pointer-events:auto}
.pegs-shield[hidden]{display:none}
.pegs-shield b{font-size:34px;line-height:1}
.pegs-shield small{font-weight:600;font-size:13px;opacity:.75}
.pegs-guarded,.pegs-guarded *{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
html.pegs-covered .pegs-guarded>*:not(.pegs-shield),html.pegs-covered #pegsBoard{visibility:hidden}`;

export function guardPegs(stage, { toast } = {}) {
  if (!stage || stage.querySelector('.pegs-shield')) return () => {};
  if (!document.getElementById('pegsGuardStyle')) {
    const style = document.createElement('style'); style.id = 'pegsGuardStyle'; style.textContent = STYLE; document.head.appendChild(style);
  }
  if (getComputedStyle(stage).position === 'static') stage.style.position = 'relative';
  stage.classList.add('pegs-guarded');
  const shield = document.createElement('div');
  shield.className = 'pegs-shield'; shield.hidden = true; shield.setAttribute('role', 'status');
  shield.innerHTML = '<b aria-hidden="true">🔒</b><span>التصوير ممنوع في شطرنج الذاكرة</span><small>ارجع للعبة وتكمل</small>';
  stage.appendChild(shield);
  let timer = 0, held = false;
  const root = document.documentElement;
  const cover = (ms = 0) => {
    clearTimeout(timer); shield.hidden = false; root.classList.add('pegs-covered');
    if (ms) timer = setTimeout(uncover, ms);
  };
  const uncover = () => {
    clearTimeout(timer);
    if (document.hidden || held) return;
    shield.hidden = true; root.classList.remove('pegs-covered');
  };
  const later = () => { clearTimeout(timer); timer = setTimeout(uncover, 300); };
  const shot = (e) => e.key === 'PrintScreen' || e.code === 'PrintScreen';
  // ⌘⇧ (Mac: 3/4/5 take the shot) and ⊞⇧ (Windows: S opens the snipping tool) reach the page first
  const combo = (e) => (e.metaKey && e.shiftKey) || (e.key === 'Meta' && e.shiftKey) || (e.key === 'Shift' && e.metaKey);
  const onDown = (e) => {
    if (shot(e)) { cover(1500); return; }
    if (combo(e)) { held = true; cover(); }
  };
  const onUp = (e) => {
    if (shot(e)) {
      cover(1500);
      toast?.('التصوير ممنوع في شطرنج الذاكرة');
      return;
    }
    if (held && (e.key === 'Meta' || e.key === 'Shift')) { held = false; cover(1500); }
  };
  const onVisibility = () => { if (document.hidden) cover(); else later(); };
  const onBlur = () => cover();
  const onFocus = () => { held = false; later(); };
  const onMenu = (e) => e.preventDefault();
  const onTap = () => { held = false; setTimeout(uncover, 60); };
  document.addEventListener('keydown', onDown, true);
  document.addEventListener('keyup', onUp, true);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('blur', onBlur);
  window.addEventListener('focus', onFocus);
  window.addEventListener('pagehide', onBlur);
  window.addEventListener('beforeprint', onBlur);
  window.addEventListener('afterprint', later);
  stage.addEventListener('contextmenu', onMenu);
  shield.addEventListener('pointerdown', onTap);
  if (document.hidden) cover();
  return () => {
    clearTimeout(timer); shield.remove(); stage.classList.remove('pegs-guarded'); root.classList.remove('pegs-covered');
    document.removeEventListener('keydown', onDown, true); document.removeEventListener('keyup', onUp, true);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('blur', onBlur); window.removeEventListener('focus', onFocus); window.removeEventListener('pagehide', onBlur);
    window.removeEventListener('beforeprint', onBlur); window.removeEventListener('afterprint', later);
    stage.removeEventListener('contextmenu', onMenu);
  };
}
