/* Tahdia 31.1.0 — snakes & ladders page extras: the lobby illustration,
   the equipped-stone preview and tap-the-die-to-roll. */
(function(){
  'use strict';
  const NS='http://www.w3.org/2000/svg',$=s=>document.querySelector(s);
  const el=(tag,attrs={})=>{const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
  const COLORS=['#2f86e8','#8b5cf6','#f0b429','#22a565'];
  const equippedDesign=()=>window.BS_PIECES?.designFor(window.BS_PIECES.equipped())||'classic';

  // The lobby picture is the real board you will play on (the equipped one),
  // with your 3D stones and the die resting on it.
  // 32.0.0: new pictures for the boards on sale; retired boards keep theirs
  const BOARDS={'board-forest':'board-v32-forest','board-royal':'board-v32-royal','board-cyber':'board-v32-cyber','board-lava':'board-v32-lava','board-galaxy':'board-v32-galaxy','board-ocean':'board-v311-ocean','board-sand':'board-v311-sand','board-twilight':'board-v311-twilight'};
  function image(href,attrs){const im=el('image',{...attrs,href,preserveAspectRatio:'xMidYMid meet'});try{im.setAttributeNS('http://www.w3.org/1999/xlink','xlink:href',href);}catch{}return im;}
  function hero(){
    const host=$('#snlHeroArt');if(!host)return;host.replaceChildren();
    const svg=el('svg',{viewBox:'0 0 120 120',role:'presentation'}),defs=el('defs');svg.appendChild(defs);
    const id=BOARDS[document.documentElement.dataset.board]?document.documentElement.dataset.board:'board-forest';
    const board=el('g',{transform:'rotate(-5 60 60)'});
    board.appendChild(el('rect',{x:7,y:10,width:104,height:104,rx:13,fill:'#000',opacity:.35,transform:'translate(2 4)'}));
    board.appendChild(image('/assets/previews/'+BOARDS[id]+'.webp',{x:6,y:6,width:106,height:106}));
    svg.appendChild(board);
    if(window.BS_PIECES){
      for(const [x,y,c,s] of [[40,80,COLORS[0],1.9],[62,98,COLORS[2],1.75]]){
        const g=el('g',{transform:`translate(${x} ${y}) scale(${s})`});g.appendChild(window.BS_PIECES.pawn(document,defs,{design:equippedDesign(),item:window.BS_PIECES.equipped(),color:c,scope:'snlhero',size:'l'}));svg.appendChild(g);
      }
    }
    svg.appendChild(image('/assets/pieces-3d/die-hero.webp',{x:84,y:82,width:30,height:31.7}));
    host.appendChild(svg);
  }
  function loadout(){
    const host=$('#snlStonePreview');if(!host||!window.BS_PIECES)return;host.replaceChildren();
    for(const c of COLORS.slice(0,3))host.appendChild(window.BS_PIECES.icon(document,{design:equippedDesign(),item:window.BS_PIECES.equipped(),color:c}));
  }
  function dieTap(){
    const die=$('#die');if(!die||die.dataset.v31Tap)return;die.dataset.v31Tap='1';
    die.addEventListener('click',()=>{const roll=$('#roll');if(roll&&!roll.disabled)roll.click();});
  }
  function refresh(){hero();loadout();}
  refresh();dieTap();
  addEventListener('bs-career-change',refresh);
})();
