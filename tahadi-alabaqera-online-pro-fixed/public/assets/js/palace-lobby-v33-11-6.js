/* Account values stay authoritative in the existing career and social clients. */
(()=>{'use strict';
 function paint(){
  const p=window.BS_CAREER?.get?.(),social=window.BS_SOCIAL?.profile?.();if(!p)return;
  const avatar=document.querySelector('[data-palace-avatar]');
  const hero=window.BS_CAREER_CORE?.heroFace?.(p.equipped?.character||'fox');
  // 33.18.1: the player's own picture (a ready one or an uploaded photo) comes first; the character's face only when there is none
  const ph=social?.photo,user=social?.username||'',face=(ph&&!ph.hidden?(window.BS_PROFILE_PRO?.photoUrl?.(user,ph)||(ph.kind==='preset'&&/^[hg]-[a-z-]+$/.test(ph.id||'')?(ph.id.startsWith('h-')?'/assets/heroes/face/'+ph.id.slice(2)+'.webp':'/assets/avatars-v33-9-4/'+ph.id.slice(2)+'.webp'):ph.kind==='upload'&&user?'/api/social/photo/'+encodeURIComponent(user)+'?v='+Number(ph.v||0):'')):'')||hero;
  if(avatar&&face&&avatar.getAttribute('src')!==face){avatar.src=face;avatar.classList.toggle('is-photo',face!==hero);avatar.onerror=()=>{if(hero&&avatar.getAttribute('src')!==hero){avatar.src=hero;avatar.classList.remove('is-photo');return;}avatar.onerror=null;avatar.src='/icon-192.png';};}
  const name=document.querySelector('.palace-profile [data-career-name]');if(name)name.textContent=social?.displayName||p.name||'لاعب';
 }
 for(const event of ['bs-career-change','bs-social-change','bs-social-ready'])window.addEventListener(event,paint);
 paint();setTimeout(paint,900);
 document.querySelectorAll('.palace-game,.palace-shortcut,.palace-minis a').forEach(link=>link.addEventListener('pointerdown',()=>window.BS_AUDIO?.unlock?.(),{passive:true}));
})();
