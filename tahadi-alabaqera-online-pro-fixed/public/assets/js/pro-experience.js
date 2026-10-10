(function(){
 'use strict';
 const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 let paused=false,pausedAnimations=[],previousFocus=null;
 const listeners=new Set();
 const overlay=document.createElement('div');overlay.className='pro-pause';overlay.id='proPause';
 overlay.innerHTML='<section role="dialog" aria-modal="true" aria-label="إيقاف اللعب"><div class="pause-icon">Ⅱ</div><h2>خذ وقتك</h2><p>جولتك محفوظة. تابع من نفس المكان.</p><button class="bs-btn primary" id="proContinue">متابعة اللعب</button><button class="bs-btn" id="proToSetup">تغيير نمط اللعب</button></section>';
 document.body.appendChild(overlay);
 function setPaused(value){
  if(value===paused)return;paused=value;document.body.classList.toggle('arena-paused',value);overlay.classList.toggle('show',value);
  if(value){previousFocus=document.activeElement;pausedAnimations=document.querySelector('#game')?.getAnimations?.({subtree:true})||[];for(const a of pausedAnimations)a.pause();overlay.querySelector('#proContinue').focus()}
  else{for(const a of pausedAnimations)try{a.play()}catch{}pausedAnimations=[];for(const fn of listeners)fn();listeners.clear();previousFocus?.focus?.()}
  window.dispatchEvent(new CustomEvent('bs-match-pause',{detail:{paused:value}}));
 }
 document.getElementById('proContinue').onclick=()=>setPaused(false);
 document.getElementById('proToSetup').onclick=()=>{setPaused(false);location.reload()};
 const game=document.getElementById('game');
 function syncFullscreenOverlays(){const target=document.fullscreenElement||document.webkitFullscreenElement;for(const el of [overlay,document.getElementById('winnerOverlay'),document.getElementById('privacy')]){if(!el)continue;if(target&&!target.contains(el))target.appendChild(el);else if(!target&&el.parentElement!==document.body)document.body.appendChild(el)}}
 document.addEventListener('fullscreenchange',syncFullscreenOverlays);document.addEventListener('webkitfullscreenchange',syncFullscreenOverlays);
 if(game){
  const toolbar=game.querySelector('.game-toolbar'),pause=document.createElement('button');pause.className='bs-btn';pause.id='pauseMatch';pause.textContent='Ⅱ';pause.setAttribute('aria-label','إيقاف اللعب');pause.onclick=()=>{if(game.querySelector('#livebar:not(.hidden)'))return window.BS_PLATFORM.toast('المباراة أونلاين مستمرة — يمكنك فتح إعدادات الصوت');setPaused(true)};
  (toolbar.querySelector('.toolbar-actions')||toolbar).appendChild(pause);
  const players=document.getElementById('players');
  if(players){const roster=document.createElement('div');roster.className='round-roster';roster.appendChild(players);const live=game.querySelector('#livebar');if(live)live.after(roster);else toolbar.after(roster)}
 }
 function confetti(){
  if(reduce())return;
  for(let i=0;i<38;i++){
   const el=document.createElement('i');el.className='confetti-piece';el.style.setProperty('--cf',['#bdaaf4','#efc686','#91c4ab','#84baca'][i%4]);el.style.left=(15+Math.random()*70)+'vw';el.style.top='-14px';document.body.appendChild(el);
   const animation=el.animate([{transform:'translateY(0) rotate(0)',opacity:1},{transform:`translate(${(Math.random()-.5)*250}px,100vh) rotate(${400+Math.random()*800}deg)`,opacity:0}],{duration:1800+Math.random()*900,delay:Math.random()*300,easing:'cubic-bezier(.2,.5,.6,1)'});
   animation.finished.catch(()=>{}).finally(()=>el.remove());
  }
 }
 async function record(result){
  const api=window.BS_CAREER,before=api?.get?.();
  if(!api)return;const updated=await api.record(result),after=updated||api.get();
  const card=document.querySelector('.winner-card');
  if(card){let row=card.querySelector('.winner-reward');if(!row){row=document.createElement('div');row.className='winner-reward';card.querySelector('#again')?.before(row)}
   const coins=Math.max(0,(after?.coins||0)-(before?.coins||0)),xp=Math.max(0,(after?.xp||0)-(before?.xp||0));
   row.textContent=coins||xp?`◈ +${coins} عملة · +${xp} خبرة`:'النتيجة محفوظة — راجع تقدمك من الرئيسية';
  }
  if(result.win)confetti();return after;
 }
 function mountDaily(target){
  if(!target||!window.BS_CAREER_CORE)return;
  function render(){
   const core=window.BS_CAREER_CORE,status=core.dailyStatus(window.BS_CAREER.get());
   target.className='daily-panel';target.innerHTML=`<div><h3>هديتك اليومية <span aria-hidden="true">✦</span></h3><p>${status.claimed?'استلمت هدية اليوم. ارجع غدًا لتكمل السلسلة.':'كل يوم تلعب فيه، هديتك تكبر. اليوم '+status.streak+' من 7.'}</p></div><button class="bs-btn gold daily-claim" ${status.claimed?'disabled':''}>${status.claimed?'✓ تم الاستلام':'استلم ◈ '+status.coins}</button><div class="daily-strip">${status.gifts.map((coins,i)=>`<div class="daily-day ${i+1===status.streak?'current':''} ${status.claimed&&i+1<=status.streak?'claimed':''}"><span>اليوم ${i+1}</span><strong>${coins}</strong><span>${status.claimed&&i+1<=status.streak?'✓':'◈'}</span></div>`).join('')}</div>`;
   target.querySelector('button').onclick=async e=>{e.target.disabled=true;try{await window.BS_CAREER.daily();window.BS_AUDIO.play('finish');window.BS_PLATFORM.toast('وصلت هديتك إلى الرصيد ◈');render()}catch(error){window.BS_PLATFORM.toast('لم تُستلم الهدية: '+error.message);e.target.disabled=false}};
  }
  window.addEventListener('bs-career-change',render);document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});render();
 }
 window.BS_PRO={get paused(){return paused},setPaused,waitForPlay:()=>paused?new Promise(resolve=>listeners.add(resolve)):Promise.resolve(),record,confetti,mountDaily,reduced:reduce};
 for(const target of document.querySelectorAll('[data-daily-gift]'))mountDaily(target);
 document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&game&&!game.classList.contains('hidden')){e.preventDefault();paused?setPaused(false):document.getElementById('pauseMatch').click()}
  if(paused&&e.key==='Tab'){const buttons=overlay.querySelectorAll('button');if(e.shiftKey&&document.activeElement===buttons[0]){e.preventDefault();buttons[1].focus()}else if(!e.shiftKey&&document.activeElement===buttons[1]){e.preventDefault();buttons[0].focus()}}
 });
 for(const el of document.querySelectorAll('.snake-head-creature'))el.classList.add('idle');
})();
