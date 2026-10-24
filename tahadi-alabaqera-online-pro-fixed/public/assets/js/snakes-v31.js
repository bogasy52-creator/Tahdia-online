/* Tahdia 31.0.0 — snakes & ladders page extras: the lobby illustration,
   the equipped-stone preview and tap-the-die-to-roll. */
(function(){
  'use strict';
  const NS='http://www.w3.org/2000/svg',$=s=>document.querySelector(s);
  const el=(tag,attrs={})=>{const n=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
  const COLORS=['#2f86e8','#8b5cf6','#f0b429','#22a565'];
  const equippedDesign=()=>window.BS_PIECES?.designFor(window.BS_PIECES.equipped())||'classic';

  function hero(){
    const host=$('#snlHeroArt');if(!host)return;host.replaceChildren();
    const svg=el('svg',{viewBox:'0 0 120 120',role:'presentation'}),defs=el('defs');svg.appendChild(defs);
    const frame=el('linearGradient',{id:'snlHeroFrame',x1:0,y1:0,x2:1,y2:1});
    for(const [o,c] of [[0,'#c58b52'],[.3,'#7a4a24'],[1,'#3f230d']])frame.appendChild(el('stop',{offset:o,'stop-color':c}));
    const body=el('linearGradient',{id:'snlHeroSnake',x1:0,y1:0,x2:1,y2:1});
    for(const [o,c] of [[0,'#9ff0bd'],[.45,'#2fae63'],[1,'#13633a']])body.appendChild(el('stop',{offset:o,'stop-color':c}));
    defs.append(frame,body);
    svg.appendChild(el('rect',{x:6,y:10,width:104,height:104,rx:12,fill:'url(#snlHeroFrame)',transform:'rotate(-4 58 62)'}));
    const board=el('g',{transform:'rotate(-4 58 62)'});
    for(let r=0;r<5;r++)for(let c=0;c<5;c++)board.appendChild(el('rect',{x:12+c*18.4,y:16+r*18.4,width:18.4,height:18.4,fill:(r+c)%2?'#eedcb6':'#f8efd9'}));
    board.appendChild(el('rect',{x:12,y:16,width:92,height:92,rx:4,fill:'none',stroke:'#e9c27a','stroke-width':1}));
    // Ladder.
    const lad=el('g',{stroke:'#a26a35','stroke-linecap':'round'});
    lad.append(el('line',{x1:28,y1:100,x2:58,y2:40,'stroke-width':2.6}),el('line',{x1:37,y1:104,x2:67,y2:44,'stroke-width':2.6}));
    for(let i=1;i<7;i++){const t=i/7,x1=28+30*t,y1=100-60*t;lad.appendChild(el('line',{x1,y1,x2:x1+9,y2:y1+4,'stroke-width':1.8,stroke:'#c48a4c'}));}
    board.appendChild(lad);
    // Snake.
    board.appendChild(el('path',{d:'M88 30C70 36 96 54 78 62S60 82 76 96',fill:'none',stroke:'#13633a','stroke-width':7.2,'stroke-linecap':'round'}));
    board.appendChild(el('path',{d:'M88 30C70 36 96 54 78 62S60 82 76 96',fill:'none',stroke:'url(#snlHeroSnake)','stroke-width':5.6,'stroke-linecap':'round'}));
    board.appendChild(el('path',{d:'M88 30C70 36 96 54 78 62S60 82 76 96',fill:'none',stroke:'#0d4528','stroke-width':1.6,'stroke-dasharray':'1.6 4','stroke-linecap':'round',opacity:.75}));
    const head=el('g',{transform:'translate(90 28) rotate(-25)'});
    head.append(el('ellipse',{cx:2,cy:0,rx:7.4,ry:5.6,fill:'#2fae63',stroke:'#13633a','stroke-width':.9}),el('ellipse',{cx:4,cy:-2.6,rx:1.7,ry:1.4,fill:'#fff3b0'}),el('ellipse',{cx:4,cy:2.6,rx:1.7,ry:1.4,fill:'#fff3b0'}),el('ellipse',{cx:4.4,cy:-2.6,rx:.5,ry:1.1,fill:'#14100a'}),el('ellipse',{cx:4.4,cy:2.6,rx:.5,ry:1.1,fill:'#14100a'}),el('path',{d:'M9.2 0h5m0 0 2-1.4M14.2 0l2 1.4',stroke:'#e23a55','stroke-width':.8,fill:'none'}));
    board.appendChild(head);
    svg.appendChild(board);
    if(window.BS_PIECES){
      for(const [x,y,c,s] of [[44,74,COLORS[0],1.9],[66,96,COLORS[2],1.75]]){
        const g=el('g',{transform:`translate(${x} ${y}) scale(${s})`});g.appendChild(window.BS_PIECES.pawn(document,defs,{design:equippedDesign(),color:c,scope:'snlhero'}));svg.appendChild(g);
      }
    }
    // A die resting on the corner.
    const die=el('g',{transform:'translate(96 98)'});
    die.append(el('path',{d:'M-11 -4 0 -9 11 -4 0 1Z',fill:'#fffdf6',stroke:'#c3ae84','stroke-width':.7}),el('path',{d:'M-11 -4V8L0 13V1Z',fill:'#e7dcc2',stroke:'#c3ae84','stroke-width':.7}),el('path',{d:'M11 -4V8L0 13V1Z',fill:'#d6c7a3',stroke:'#c3ae84','stroke-width':.7}));
    for(const [x,y] of [[0,-4]])die.appendChild(el('ellipse',{cx:x,cy:y,rx:2.2,ry:1.1,fill:'#c81f37'}));
    for(const [x,y] of [[-7.6,1],[-3.4,6.6],[3.2,1.2],[7.6,7]])die.appendChild(el('ellipse',{cx:x,cy:y,rx:1,ry:1.3,fill:'#121920'}));
    svg.appendChild(die);
    host.appendChild(svg);
  }
  function loadout(){
    const host=$('#snlStonePreview');if(!host||!window.BS_PIECES)return;host.replaceChildren();
    for(const c of COLORS.slice(0,3))host.appendChild(window.BS_PIECES.icon(document,{design:equippedDesign(),color:c}));
  }
  function dieTap(){
    const die=$('#die');if(!die||die.dataset.v31Tap)return;die.dataset.v31Tap='1';
    die.addEventListener('click',()=>{const roll=$('#roll');if(roll&&!roll.disabled)roll.click();});
  }
  function refresh(){hero();loadout();}
  refresh();dieTap();
  addEventListener('bs-career-change',refresh);
})();
