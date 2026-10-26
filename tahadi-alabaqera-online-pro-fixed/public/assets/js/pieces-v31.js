/* Tahdia 31.1.0 — game pieces.
   Every stone in the shop is a studio render of a real 3D model (glossy
   plastic, metal trims, cut gems and glass) in each of the six player
   colours, with its own soft contact shadow. Pawns stand on (0,0) of a
   14 × 22 box and marbles sit in the middle of a 13 × 13 box, so callers
   keep placing them exactly as before. Two sizes: `s` for boards and chips,
   `l` for the shop. */
(function(root){
  'use strict';
  const NS='http://www.w3.org/2000/svg',XLINK='http://www.w3.org/1999/xlink',ROOT='/assets/pieces-3d/';
  const COLORS=Object.freeze(['#e0474c','#2f86e8','#f0b429','#22a565','#8b5cf6','#f2711c']);
  // 32.1.0: four more seat colours (up to ten players) tint the closest studio render
  const EXTRA=Object.freeze({'#14b8a6':['#22a565','hue-rotate(32deg) saturate(1.15)'],'#ec4899':['#e0474c','hue-rotate(-34deg) saturate(1.2) brightness(1.1)'],'#84cc16':['#22a565','hue-rotate(-44deg) saturate(1.4) brightness(1.15)'],'#94a3b8':['#2f86e8','grayscale(.85) brightness(1.2)']});
  const DESIGNS={'pawn-classic':'classic','pawn-atlas':'atlas','pawn-rook':'rook','pawn-orbit':'orbit','pawn-lance':'lance','pawn-lotus':'lotus','pawn-monolith':'monolith','pawn-jade':'gem','pawn-amethyst':'gem','pawn-onyx':'rook','pawn-gold':'crown','pawn-crown':'crown','pawn-orb':'orb','pawn-prism':'monolith'};
  const ITEMS=Object.freeze(Object.keys(DESIGNS));
  const DEFAULT_ITEM={classic:'pawn-classic',atlas:'pawn-atlas',spire:'pawn-atlas',rook:'pawn-rook',orbit:'pawn-orbit',lance:'pawn-lance',lotus:'pawn-lotus',monolith:'pawn-monolith',gem:'pawn-amethyst',crown:'pawn-gold',orb:'pawn-orb'};
  const MARBLES={classic:'glass',atlas:'glass',rook:'metal',lance:'metal',monolith:'metal',orbit:'galaxy',orb:'galaxy',lotus:'pearl',gem:'pearl',crown:'royal'};
  const STYLES=Object.freeze(['glass','metal','galaxy','pearl','royal']);
  const SHAPES=Object.freeze(['classic','atlas','rook','orbit','lance','lotus','monolith','gem','crown','orb']);

  function rgb(hex){const h=String(hex||'#888').replace('#','');const v=h.length===3?h.split('').map(c=>c+c).join(''):h.padEnd(6,'0');return [0,2,4].map(i=>parseInt(v.slice(i,i+2),16)||0);}
  function hex(c){return '#'+c.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');}
  function mix(a,b,t){const x=rgb(a),y=rgb(b);return hex(x.map((v,i)=>v+(y[i]-v)*t));}
  const light=(c,t)=>mix(c,'#ffffff',t),dark=(c,t)=>mix(c,'#000000',t);
  // the renders exist for the six player colours; any other colour uses the closest one
  function colorIndex(color){
    const exact=COLORS.indexOf(String(color||'').toLowerCase());if(exact>=0)return exact;
    const c=rgb(color);let best=0,score=Infinity;
    COLORS.forEach((p,i)=>{const q=rgb(p),d=(c[0]-q[0])**2*.3+(c[1]-q[1])**2*.59+(c[2]-q[2])**2*.11;if(d<score){score=d;best=i;}});
    return best;
  }
  const designFor=id=>DESIGNS[id]||'classic';
  const marbleFor=id=>MARBLES[designFor(id)]||'glass';
  const itemFor=(design,item)=>DESIGNS[item]?item:DEFAULT_ITEM[design]||'pawn-classic';
  const equipped=()=>root.BS_CAREER?.get?.()?.equipped?.pawn||root.document?.documentElement?.dataset?.pawn||'pawn-classic';
  function src(kind,{item,design='classic',style,color=COLORS[0],size='s'}={}){
    const dir=ROOT+(size==='l'?'':'s/'),ci=colorIndex(color);
    if(kind==='marble')return dir+'marble-'+(STYLES.includes(style)?style:'glass')+'-'+ci+'.webp';
    return dir+itemFor(design,item)+'-'+ci+'.webp';
  }
  function el(doc,tag,attrs={}){const n=doc.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))if(v!==undefined&&v!==null)n.setAttribute(k,String(v));return n;}
  function picture(doc,url,x,y,w,h){
    const img=el(doc,'image',{x,y,width:w,height:h,preserveAspectRatio:'xMidYMid meet',href:url,decoding:'async'});
    try{img.setAttributeNS?.(XLINK,'xlink:href',url);}catch{}
    return img;
  }
  /* A pawn group in local units: the base sits on (0,0) and the piece rises
     up to 19.5 units. `defs` is accepted for older callers. */
  function pawn(doc,defs,{design='classic',item,color=COLORS[0],number='',size='s'}={}){
    const id=itemFor(design,item),g=el(doc,'g',{'data-piece-design':designFor(id),'data-piece-item':id,'data-piece-color':COLORS[colorIndex(color)]});
    g.appendChild(picture(doc,src('pawn',{item:id,color,size}),-7,-19.5,14,22));
    if(number!=='')g.appendChild(el(doc,'text',{x:0,y:.55,'text-anchor':'middle','font-size':1.7,'font-weight':800,'font-family':'Tajawal,Arial,sans-serif',fill:'#ffffff','paint-order':'stroke',stroke:dark(color,.55),'stroke-width':.35})).textContent=String(number);
    return g;
  }
  /* A marble centred on (0,0) with radius 5. */
  function marble(doc,defs,{style='glass',color=COLORS[0],size='s'}={}){
    const g=el(doc,'g',{'data-marble-style':STYLES.includes(style)?style:'glass','data-piece-color':COLORS[colorIndex(color)]});
    g.appendChild(picture(doc,src('marble',{style,color,size}),-6.5,-6.5,13,13));
    return g;
  }
  /* A standalone <svg> for DOM tokens and previews. */
  let sequence=0;
  function icon(doc,{kind='pawn',design='classic',item,style,color=COLORS[0],className='piece-svg',label='',size='s'}={}){
    sequence++;
    const extra=EXTRA[String(color||'').toLowerCase()];if(extra)color=extra[0];
    const svg=el(doc,'svg',{viewBox:kind==='marble'?'-6.5 -6.5 13 13':'-7 -19.5 14 22',class:className,'aria-hidden':label?null:'true',role:label?'img':null,'aria-label':label||null,focusable:'false'});
    if(extra&&svg.style){svg.style.filter=extra[1];svg.style.setProperty('--piece-tint',extra[1]);svg.classList.add('piece-tinted');}
    svg.appendChild(kind==='marble'?marble(doc,null,{style:style||MARBLES[design]||'glass',color,size}):pawn(doc,null,{design,item,color,size}));
    return svg;
  }
  /* Ask the browser for the pictures a board is about to show. */
  const warmed=new Set();
  function preload(kind='pawn',{item,design,style,size='s',colors=COLORS}={}){
    if(typeof Image!=='function')return;
    for(const color of colors){const url=src(kind,{item:item||equipped(),design,style,color,size});if(warmed.has(url))continue;warmed.add(url);const im=new Image();im.decoding='async';im.src=url;}
  }
  root.BS_PIECES=Object.freeze({COLORS,DESIGNS:Object.freeze({...DESIGNS}),ITEMS,SHAPES,STYLES,designFor,marbleFor,itemFor,colorIndex,equipped,src,pawn,marble,icon,preload,mix,light,dark});
  // Board pages warm the equipped stone in every colour before the first move.
  const warm=()=>{const body=root.document?.body;if(!body?.classList)return;
    if(body.classList.contains('game-jackaroo'))preload('marble',{style:marbleFor(equipped())});
    else if(body.classList.contains('game-snakes')||body.classList.contains('game-zahra'))preload('pawn');};
  if(root.document?.readyState==='loading')root.document.addEventListener?.('DOMContentLoaded',warm,{once:true});else try{warm();}catch{}
})(typeof window!=='undefined'?window:globalThis);
