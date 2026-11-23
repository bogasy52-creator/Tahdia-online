/* Account values stay authoritative in the existing career and social clients. */
(()=>{'use strict';
 function paint(){
  const p=window.BS_CAREER?.get?.(),social=window.BS_SOCIAL?.profile?.();if(!p)return;
  const avatar=document.querySelector('[data-palace-avatar]');
  const face=social?.photoUrl||window.BS_CAREER_CORE?.heroFace?.(p.equipped?.character||'fox');
  if(avatar&&face&&avatar.getAttribute('src')!==face){avatar.src=face;avatar.onerror=()=>{avatar.onerror=null;avatar.src='/icon-192.png';};}
  const name=document.querySelector('.palace-profile [data-career-name]');if(name)name.textContent=social?.displayName||p.name||'لاعب';
 }
 for(const event of ['bs-career-change','bs-social-change','bs-social-ready'])window.addEventListener(event,paint);
 paint();setTimeout(paint,900);
 document.querySelectorAll('.palace-game,.palace-shortcut,.palace-minis a').forEach(link=>link.addEventListener('pointerdown',()=>window.BS_AUDIO?.unlock?.(),{passive:true}));
})();
