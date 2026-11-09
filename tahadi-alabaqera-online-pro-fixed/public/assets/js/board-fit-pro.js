(()=>{'use strict';let pending=0;function fit(){pending=0;
 const jack=document.body.classList.contains('game-jackaroo'),running=document.body.classList.contains('game-running');
 if(jack&&running){const box=document.querySelector('.jack-board-wrap'),board=document.getElementById('board');if(box&&board){const r=box.getBoundingClientRect();const tall=r.height>r.width*1.06&&r.width<700&&!document.fullscreenElement?.matches?.('.jk-no-zoom');const size=Math.max(1,Math.floor(tall?Math.min(r.height,r.width*1.1):Math.min(r.width,r.height)));
 // 33.9.0: on a tall phone the board also stretches down into the empty space (its marbles and holes stay round)
 const high=tall?Math.max(size,Math.floor(Math.min(r.height-2,size*1.34))):size;
 board.style.setProperty('--pro-board-size',size+'px');board.style.setProperty('--pro-board-h',high+'px');document.body.classList.toggle('jack-board-wide',tall&&size>r.width+2);document.body.classList.toggle('jack-board-tall',high>size+2);}}
 const field=document.querySelector('.cm-playfield'),surface=document.getElementById('carromSurface');if(field&&surface){const r=field.getBoundingClientRect(),size=Math.max(1,Math.floor(Math.min(r.width-12,r.height-8)));if(r.width&&r.height){surface.style.width=size+'px';surface.style.height=size+'px';}}
}
function schedule(){if(!pending)pending=requestAnimationFrame(fit);}
for(const type of ['resize','orientationchange','busraj:game-layout','bs-reaction-refresh'])addEventListener(type,schedule,{passive:true});
window.visualViewport?.addEventListener('resize',schedule);
if(typeof ResizeObserver==='function'){const obs=new ResizeObserver(schedule);for(const selector of ['.jack-board-wrap','.cm-playfield','.jk-hand-dock']){const el=document.querySelector(selector);if(el)obs.observe(el);}}
if(typeof MutationObserver==='function')new MutationObserver(schedule).observe(document.body,{attributes:true,attributeFilter:['class']});
if(document.body.classList.contains('game-jackaroo')){
 const bar=document.querySelector('.table-topbar');if(bar){const button=document.createElement('button');button.type='button';button.className='table-control jack-focus-control';button.setAttribute('aria-label','تكبير لوحة الجاكارو');button.setAttribute('aria-pressed','false');button.textContent='⤢';button.onclick=()=>{const active=document.body.classList.toggle('jack-board-focus');button.setAttribute('aria-pressed',String(active));button.setAttribute('aria-label',active?'إظهار تفاصيل اللاعبين':'تكبير لوحة الجاكارو');schedule();};bar.append(button);}
}
schedule();window.BS_BOARD_FIT=Object.freeze({fit:schedule});})();
