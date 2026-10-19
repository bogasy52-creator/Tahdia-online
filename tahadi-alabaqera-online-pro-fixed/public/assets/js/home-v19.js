/* Room shortcuts use the same authoritative routes as the game clients. */
(() => {
  const form = document.getElementById('homeRoomJoin');
  const field = document.getElementById('homeRoomCode');
  const game = document.getElementById('homeRoomGame');
  if (!form || !field || !game) return;
  const routes = Object.freeze({quiz:'/online',picture:'/picture',sudoku:'/sudoku',paths:'/paths-online',serpent:'/serpent',snakes:'/snakes',jackaroo:'/jackaroo',zahra:'/zahra'});
  const normalize = value => String(value).replace(/[٠-٩]/g, n => String(n.charCodeAt(0)-1632)).replace(/[۰-۹]/g, n => String(n.charCodeAt(0)-1776)).replace(/\D/g,'').slice(0,6);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const code = normalize(field.value), route = routes[game.value];
    if (!route || !/^\d{6}$/.test(code)) {
      field.setCustomValidity('اكتب رمز الغرفة من 6 أرقام');
      field.reportValidity();
      return;
    }
    location.assign(route+'?room='+code);
  });
  field.addEventListener('input', () => {field.setCustomValidity('');field.value=normalize(field.value);});
})();
