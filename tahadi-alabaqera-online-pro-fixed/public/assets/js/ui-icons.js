(function(){
 const paths={
  snake:'<path d="M19 5c-6-3-12-1-10 5s12 1 10 7-13 7-14 0"/><path d="M18 3c4-1 5 5 1 6-4 1-6-4-1-6Z"/><circle cx="20" cy="5" r=".5" fill="currentColor"/>',
  dice:'<rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="8" cy="8" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="16" cy="16" r="1" fill="currentColor"/>',
  jack:'<path d="M12 3c-2 4-8 6-8 11 0 4 5 5 8 1 3 4 8 3 8-1 0-5-6-7-8-11Z"/><path d="M12 15v6m-4 0h8"/>',
  flower:'<circle cx="12" cy="12" r="3"/><path d="M9 9C3 7 4 2 8 3c3 0 4 3 4 6 0-6 5-8 7-5 3 4-1 6-4 8 6-1 8 4 5 6-4 3-7-1-8-3 1 6-4 8-6 5-3-4 0-6 3-8-6 1-8-3-5-5"/>',
  home:'<path d="m3 11 9-8 9 8M5 10v11h5v-7h4v7h5V10"/>',
  shop:'<path d="m12 3 9 9-9 9-9-9 9-9Z"/><path d="m8 12 4 4 4-4-4-4-4 4Z"/>',
  fullscreen:'<path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5"/>',
  volume:'<path d="m11 4-6 5H2v6h3l6 5V4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute:'<path d="m11 4-6 5H2v6h3l6 5V4Zm5 5 5 6m0-6-5 6"/>',
  settings:'<path d="m9 3 1-1h4l1 1 .5 3 3 1 2 2v4l-2 2-3 1-.5 3-1 1h-4l-1-1-.5-3-3-1-2-2V9l2-2 3-1 .5-3Z"/><circle cx="12" cy="11" r="3"/>',
  memory:'<rect x="3" y="4" width="11" height="15" rx="2"/><path d="M17 7h4v15H10v-1M7 8h3m-3 4h3"/>',
  reaction:'<path d="m14 2-9 12h7l-2 8 9-12h-7l2-8Z"/>',
  logic:'<path d="M19 4H5l7 8-7 8h14"/>',
  puzzle:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>',
  accuracy:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  users:'<circle cx="9" cy="8" r="4"/><path d="M2 21v-2a7 7 0 0 1 14 0v2m1-15a4 4 0 0 1 0 8m2 3a6 6 0 0 1 3 4"/>'
 };
 function icon(name){return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.dice}</svg>`}
 window.BS_ICONS={icon};
 function apply(){
  document.querySelectorAll('[data-audio-toggle]').forEach(b=>b.innerHTML=icon(window.BS_AUDIO?.getSettings?.().muted?'mute':'volume'));
  document.querySelectorAll('[data-settings-open]').forEach(b=>{b.innerHTML=icon('settings');b.setAttribute('aria-label','إعدادات اللعب')});
  document.querySelectorAll('[data-game-fullscreen]').forEach(b=>b.innerHTML=icon('fullscreen'));
  document.querySelectorAll('a.bs-icon-btn').forEach(b=>{const h=b.getAttribute('href');if(h==='/shop')b.innerHTML=icon('shop');else if(h==='./'||h==='/')b.innerHTML=icon('home');else if(h?.startsWith('/social'))b.innerHTML=icon('users')});
  document.querySelectorAll('.home-game .game-symbol').forEach(el=>{const key=el.closest('a').getAttribute('href').slice(1);el.innerHTML=icon({snakes:'snake',jackaroo:'jack',zahra:'flower',dice:'dice',memory:'memory',reaction:'reaction',logic:'logic',puzzle:'puzzle',accuracy:'accuracy'}[key]||'logic')});
  const hero=document.querySelector('.premium-hero h1'),kind=document.body.classList.contains('game-snakes')?'snake':document.body.classList.contains('game-jackaroo')?'jack':document.body.classList.contains('game-zahra')?'flower':'dice';if(hero)hero.innerHTML=icon(kind)+' '+hero.textContent.replace(/[🐍🎯🎲🃏]/gu,'').trim();
  const roll=document.getElementById('roll');if(roll)roll.innerHTML=icon('dice')+' '+roll.textContent.replace(/🎲/g,'').trim();
 }
 window.addEventListener('bs-audio-change',()=>document.querySelectorAll('[data-audio-toggle]').forEach(b=>b.innerHTML=icon(window.BS_AUDIO.getSettings().muted?'mute':'volume')));apply();
})();
