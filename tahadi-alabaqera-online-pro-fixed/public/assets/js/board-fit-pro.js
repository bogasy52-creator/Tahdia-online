(()=>{'use strict';let pending=0;function fit(){pending=0;
 const jack=document.body.classList.contains('game-jackaroo'),running=document.body.classList.contains('game-running');
 if(jack&&running){const box=document.querySelector('.jack-board-wrap'),board=document.getElementById('board');if(box&&board){const r=box.getBoundingClientRect();const size=Math.max(1,Math.floor(Math.min(r.width,r.height)));board.style.setProperty('--pro-board-size',size+'px');}}
 const field=document.querySelector('.cm-playfield'),surface=document.getElementById('carromSurface');if(field&&surface){const r=field.getBoundingClientRect(),size=Math.max(1,Math.floor(Math.min(r.width-12,r.height-8)));if(r.width&&r.height){surface.style.width=size+'px';surface.style.height=size+'px';}}
}
function schedule(){if(!pending)pending=requestAnimationFrame(fit);}
for(const type of ['resize','orientationchange','busraj:game-layout','bs-reaction-refresh'])addEventListener(type,schedule,{passive:true});
window.visualViewport?.addEventListener('resize',schedule);
if(typeof ResizeObserver==='function'){const obs=new ResizeObserver(schedule);for(const selector of ['.jack-board-wrap','.cm-playfield','.jk-hand-dock']){const el=document.querySelector(selector);if(el)obs.observe(el);}}
if(typeof MutationObserver==='function')new MutationObserver(schedule).observe(document.body,{attributes:true,attributeFilter:['class']});
schedule();window.BS_BOARD_FIT=Object.freeze({fit:schedule});})();
