// Snake PRO Upgrade v4.1
(function(){
  const KEY='busraj_snake_profile_v1';
  let profile={xp:0,games:0,best:0,skin:'gold'};
  try{
    const stored=JSON.parse(localStorage.getItem(KEY)||'null');
    if(stored&&typeof stored==='object')profile={...profile,...stored};
  }catch{}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(profile))}catch{}}
  window.SnakePro={
    finish(score){
      profile.games++;
      profile.xp+=Math.max(10,Math.floor(score/10));
      if(score>profile.best) profile.best=score;
      save();
      return profile;
    },
    profile(){return profile;}
  };
  const badge=document.createElement('div');
  badge.id='snakeProBadge';
  badge.style.cssText='position:fixed;top:80px;left:16px;z-index:9999;background:rgba(5,8,17,.8);border:1px solid rgba(244,199,109,.4);border-radius:14px;padding:8px 12px;color:#f4c76d;font-weight:700;font-size:13px;backdrop-filter:blur(10px)';
  badge.textContent=`XP ${profile.xp} | أفضل ${profile.best}`;
  document.addEventListener('DOMContentLoaded',()=>{
    /* The reference arena already contains its own chrome; keep the profile
       badge on the setup screen so it never covers the supplied artwork. */
    if(!document.body.classList.contains('game-snakes'))document.body.appendChild(badge);
  });
})();
