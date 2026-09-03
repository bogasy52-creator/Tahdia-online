// Snake PRO Ultimate Feel Engine v5.0
// Visual layer: alive snake feeling, smooth feedback, no gameplay dependency.
(function(){
'use strict';
const KEY='busraj_snake_profile_v2';
let profile={xp:0,games:0,best:0,skin:'gold'};
try{profile={...profile,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(profile))}catch{}};

window.SnakePro={
 finish(score=0){profile.games++;profile.xp+=Math.max(10,Math.floor(score/10));profile.best=Math.max(profile.best,score);save();return profile},
 profile(){return profile}
};

function injectStyle(){
 const s=document.createElement('style');
 s.textContent=`
 .snake-board-wrap.snake-alive .snake-cell{transition:transform .18s cubic-bezier(.2,.8,.2,1)}
 .snake-board-wrap.snake-alive .token-stack{transform-origin:center;animation:snakeBreath 1.8s ease-in-out infinite}
 .snake-board-wrap.snake-hit{animation:snakeImpact .32s cubic-bezier(.2,1,.4,1)}
 .snake-board-wrap.snake-speed{filter:saturate(1.15)}
 @keyframes snakeBreath{0%,100%{scale:1}50%{scale:1.035}}
 @keyframes snakeImpact{0%{transform:scale(1)}35%{transform:scale(1.025) rotate(.4deg)}100%{transform:scale(1)}}
 .snake-energy{position:absolute;inset:0;pointer-events:none;overflow:hidden}
 .snake-spark{position:absolute;width:7px;height:7px;border-radius:50%;background:#ffd86b;animation:spark .65s ease-out forwards}
 @keyframes spark{to{transform:translate(var(--x),var(--y)) scale(0);opacity:0}}
 `;
 document.head.appendChild(s);
}
function impact(){
 const wrap=document.querySelector('#boardWrap');
 if(!wrap)return;
 wrap.classList.remove('snake-hit');void wrap.offsetWidth;wrap.classList.add('snake-hit');
 setTimeout(()=>wrap.classList.remove('snake-hit'),350);
}
function sparks(){
 const wrap=document.querySelector('#boardWrap');if(!wrap)return;
 let layer=wrap.querySelector('.snake-energy');
 if(!layer){layer=document.createElement('div');layer.className='snake-energy';wrap.appendChild(layer)}
 for(let i=0;i<8;i++){
  const p=document.createElement('i');p.className='snake-spark';p.style.left='50%';p.style.top='50%';
  p.style.setProperty('--x',`${Math.cos(i)*70}px`);p.style.setProperty('--y',`${Math.sin(i)*70}px`);
  layer.appendChild(p);setTimeout(()=>p.remove(),700);
 }
}
function observe(){
 const wrap=document.querySelector('#boardWrap');
 if(wrap)wrap.classList.add('snake-alive');
 const roll=document.querySelector('#roll');
 roll?.addEventListener('click',()=>{setTimeout(()=>{impact();sparks()},120)});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{injectStyle();observe()});else{injectStyle();observe()}
})();

// Snake PRO V5.1 Creature Motion Layer
(function(){
'use strict';
function creaturePulse(){
 const wrap=document.querySelector('#boardWrap');
 if(!wrap)return;
 wrap.querySelectorAll('.token-stack').forEach((token,index)=>{
   token.style.setProperty('--snake-delay',`${index*70}ms`);
   token.classList.add('creature-active');
 });
}
function addCreatureStyle(){
 const s=document.createElement('style');
 s.textContent=`
 .token-stack.creature-active{animation:snakeLiving 1.35s ease-in-out infinite;transform-origin:center bottom;}
 .snake-cell .token-stack>*{transition:filter .2s,transform .2s;}
 .snake-cell:hover .token-stack{filter:brightness(1.22);}
 .snake-board-wrap.creature-shake{animation:creatureShake .22s ease-out;}
 .snake-board-wrap.creature-focus .token-stack{animation-duration:.55s;}
 @keyframes snakeLiving{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-3px) scale(1.04)}}
 @keyframes creatureShake{0%{transform:translate(0)}25%{transform:translate(-5px,2px)}50%{transform:translate(5px,-2px)}100%{transform:translate(0)}}
 `;
 document.head.appendChild(s);
}
function react(){
 const wrap=document.querySelector('#boardWrap');
 if(!wrap)return;
 wrap.classList.remove('creature-shake');
 void wrap.offsetWidth;
 wrap.classList.add('creature-shake');
 setTimeout(()=>wrap.classList.remove('creature-shake'),250);
}
function boot(){
 addCreatureStyle();
 creaturePulse();
 new MutationObserver(creaturePulse).observe(document.querySelector('#board'),{childList:true,subtree:true});
 document.querySelector('#roll')?.addEventListener('click',react);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();


// Snake PRO V5 Ultimate Creature Feel Expansion
(function(){
'use strict';
function installUltimateLayer(){
 const s=document.createElement('style');
 s.textContent=`
 .token-stack.ultimate-creature{
   animation:ultimateSnakeBreath 1.1s ease-in-out infinite;
   transform-origin:center;
 }
 .snake-board-wrap.ultimate-speed{
   animation:ultimateSpeed .45s ease-in-out;
 }
 .snake-board-wrap.ultimate-hit{
   animation:ultimateHit .28s ease-out;
 }
 @keyframes ultimateSnakeBreath{
   0%,100%{transform:scale(1) translateY(0)}
   50%{transform:scale(1.045) translateY(-2px)}
 }
 @keyframes ultimateSpeed{
   50%{filter:brightness(1.25) saturate(1.3)}
 }
 @keyframes ultimateHit{
   0%{transform:scale(1)}
   40%{transform:scale(1.03) rotate(-1deg)}
   100%{transform:scale(1)}
 }
 `;
 document.head.appendChild(s);
}
function pulseSnake(){
 const board=document.querySelector('#boardWrap');
 if(!board)return;
 board.querySelectorAll('.token-stack').forEach(t=>t.classList.add('ultimate-creature'));
}
function feedback(type){
 const board=document.querySelector('#boardWrap');
 if(!board)return;
 board.classList.remove('ultimate-hit','ultimate-speed');
 void board.offsetWidth;
 board.classList.add(type==='speed'?'ultimate-speed':'ultimate-hit');
 setTimeout(()=>board.classList.remove('ultimate-hit','ultimate-speed'),400);
 if(navigator.vibrate) navigator.vibrate(type==='speed'?20:35);
}
function boot(){
 installUltimateLayer();
 pulseSnake();
 const observer=new MutationObserver(pulseSnake);
 const board=document.querySelector('#board');
 if(board) observer.observe(board,{childList:true,subtree:true});
 document.querySelector('#roll')?.addEventListener('click',()=>feedback('hit'));
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot);
else boot();
})();
