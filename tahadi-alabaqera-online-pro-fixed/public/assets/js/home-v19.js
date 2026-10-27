/* Tahdia 33.0.0 — home room box: any room code goes to its game (the code names it, the
   server confirms the room is open). Also brings you back to an open match. */
(()=>{
 const menu=window.BS_GAME_MENU,$=id=>document.getElementById(id),form=$('homeRoomJoin'),field=$('homeRoomCode'),message=$('homeRoomMessage');
 const normalize=v=>String(v).replace(/[٠-٩]/g,n=>String(n.charCodeAt(0)-1632)).replace(/[۰-۹]/g,n=>String(n.charCodeAt(0)-1776)).replace(/\D/g,'').slice(0,6);
 const say=(text,error=false)=>{if(!message)return;message.textContent=text||'';message.classList.toggle('is-error',Boolean(error&&text));};
 if(form&&field){
  let pending=false;
  form.addEventListener('submit',async event=>{
   event.preventDefault();
   const code=normalize(field.value);
   if(!/^\d{6}$/.test(code)){say('اكتب رمز الغرفة من 6 أرقام',true);field.focus();return;}
   if(pending)return;
   pending=true;say('نبحث عن الغرفة…');const button=form.querySelector('button');if(button)button.disabled=true;
   try{
    const found=menu?await menu.resolve(code):undefined;
    if(found===null){say('ما لقينا غرفة مفتوحة بهذا الرمز. تأكد من الرقم.',true);return;}
    // no answer from the server: the code itself names the game
    const game=found?.game||menu?.gameOfCode(code),url=game&&menu?.roomUrl(game,code);
    if(!url){say('ما عرفنا لعبة هذا الرمز. افتح اللعبة واكتبه فيها.',true);return;}
    say('');location.assign(url);
   }finally{pending=false;if(button)button.disabled=false;}
  });
  field.addEventListener('input',()=>{say('');field.value=normalize(field.value);});
 }
 // «ارجع لمباراتك»: the match you were in, while its room is still open
 const box=$('homeResume'),last=menu?.lastMatch();
 if(box&&last)menu.resolve(last.code).then(found=>{
  if(!found||found.game!==last.game){if(found===null)menu.forget(last.game,last.code);return;}
  const link=document.createElement('a');link.className='home-resume-card';link.href=menu.roomUrl(last.game,last.code);
  link.innerHTML='<span aria-hidden="true">↩</span><b></b><small></small><i aria-hidden="true">←</i>';
  link.querySelector('b').textContent='ارجع لمباراتك في '+(menu.TITLES[last.game]||'اللعبة');
  link.querySelector('small').textContent=last.status==='playing'?'المباراة شغّالة · الغرفة '+last.code:'الغرفة '+last.code+' بانتظارك';
  box.replaceChildren(link);box.hidden=false;
 }).catch(()=>{});
})();
