/* Tahdia 33.4.0 — home: «ارجع لمباراتك» brings you back to an open match.
   Room codes are typed inside each game (its «غرفة مع أصحابك»), not on the home page. */
(()=>{
 const menu=window.BS_GAME_MENU,box=document.getElementById('homeResume'),last=menu?.lastMatch();
 if(box&&last)menu.resolve(last.code).then(found=>{
  if(!found||found.game!==last.game){if(found===null)menu.forget(last.game,last.code);return;}
  const link=document.createElement('a');link.className='home-resume-card';link.href=menu.roomUrl(last.game,last.code);
  link.innerHTML='<span aria-hidden="true">↩</span><b></b><small></small><i aria-hidden="true">←</i>';
  link.querySelector('b').textContent='ارجع لمباراتك في '+(menu.TITLES[last.game]||'اللعبة');
  link.querySelector('small').textContent=last.status==='playing'?'المباراة شغّالة · الغرفة '+last.code:'الغرفة '+last.code+' بانتظارك';
  box.replaceChildren(link);box.hidden=false;
 }).catch(()=>{});
})();
