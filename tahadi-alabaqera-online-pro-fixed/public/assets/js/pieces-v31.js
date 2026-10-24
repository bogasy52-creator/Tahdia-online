/* Tahdia 31.0.0 — game pieces drawn as vector art.
   Pawns (snakes & ladders, zahra) and glass marbles (jackaroo) share one
   lighting model: light from the top left, a soft contact shadow, and the
   player's colour carried by the body. Every shop stone maps to a shape. */
(function(root){
  'use strict';
  const NS='http://www.w3.org/2000/svg';
  const COLORS=Object.freeze(['#e0474c','#2f86e8','#f0b429','#22a565','#8b5cf6','#f2711c']);
  const DESIGNS={'pawn-classic':'classic','pawn-atlas':'atlas','pawn-rook':'rook','pawn-orbit':'orbit','pawn-lance':'lance','pawn-lotus':'lotus','pawn-monolith':'monolith','pawn-jade':'gem','pawn-amethyst':'gem','pawn-onyx':'rook','pawn-gold':'crown','pawn-crown':'crown','pawn-orb':'orb','pawn-prism':'monolith'};
  const MARBLES={classic:'glass',atlas:'glass',rook:'metal',lance:'metal',monolith:'metal',orbit:'galaxy',orb:'galaxy',lotus:'pearl',gem:'pearl',crown:'royal'};
  const TRIM={classic:'silver',atlas:'silver',rook:'gold',orbit:'gold',lance:'silver',lotus:'gold',monolith:'silver',crown:'gold',orb:'gold',gem:'gold'};
  let sequence=0;

  function rgb(hex){const h=String(hex||'#888').replace('#','');const v=h.length===3?h.split('').map(c=>c+c).join(''):h.padEnd(6,'0');return [0,2,4].map(i=>parseInt(v.slice(i,i+2),16)||0);}
  function hex(c){return '#'+c.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');}
  function mix(a,b,t){const x=rgb(a),y=rgb(b);return hex(x.map((v,i)=>v+(y[i]-v)*t));}
  const light=(c,t)=>mix(c,'#ffffff',t),dark=(c,t)=>mix(c,'#000000',t);
  function el(doc,tag,attrs={}){const n=doc.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))if(v!==undefined&&v!==null)n.setAttribute(k,String(v));return n;}
  function stops(doc,g,list){for(const [o,c,a] of list)g.appendChild(el(doc,'stop',{offset:o,'stop-color':c,'stop-opacity':a??1}));return g;}
  function linear(doc,defs,id,list,x1=0,y1=0,x2=1,y2=0){if(!defs.querySelector?.('#'+id))defs.appendChild(stops(doc,el(doc,'linearGradient',{id,x1,y1,x2,y2}),list));return 'url(#'+id+')';}
  function radial(doc,defs,id,list,cx=.35,cy=.3,r=.75){if(!defs.querySelector?.('#'+id))defs.appendChild(stops(doc,el(doc,'radialGradient',{id,cx,cy,r}),list));return 'url(#'+id+')';}
  function safe(value){return String(value).replace(/[^a-z0-9]/gi,'');}

  /* Shared paints for one colour + trim, defined once per document part. */
  function paints(doc,defs,color,trim,scope){
    const k=scope+'-'+safe(color)+'-'+trim;
    const metal=trim==='gold'?['#fff3c9','#e7c36d','#a77a2a','#6b4a17']:['#ffffff','#d5dde2','#8d9aa3','#4c5961'];
    return {
      body:linear(doc,defs,k+'-body',[[0,light(color,.5)],[.3,light(color,.12)],[.62,color],[1,dark(color,.5)]]),
      head:radial(doc,defs,k+'-head',[[0,light(color,.75)],[.3,light(color,.2)],[.72,color],[1,dark(color,.45)]],.36,.3,.78),
      top:linear(doc,defs,k+'-top',[[0,light(color,.35)],[1,dark(color,.15)]],0,0,1,1),
      side:linear(doc,defs,k+'-side',[[0,dark(color,.25)],[.5,dark(color,.45)],[1,dark(color,.62)]]),
      metal:linear(doc,defs,k+'-metal',[[0,metal[0]],[.35,metal[1]],[.7,metal[2]],[1,metal[3]]]),
      shadow:radial(doc,defs,scope+'-shadow',[[0,'#000000',.5],[.6,'#000000',.22],[1,'#000000',0]],.5,.5,.5),
      glass:linear(doc,defs,k+'-glass',[[0,light(color,.8),.95],[.5,light(color,.3),.85],[1,color,.9]],0,0,1,1),
      spec:'#ffffff',edge:dark(color,.55)
    };
  }

  function base(doc,g,p,w=5){
    g.appendChild(el(doc,'ellipse',{cx:0,cy:.7,rx:w+1.3,ry:2.2,fill:p.shadow}));
    g.appendChild(el(doc,'path',{d:`M${-w} -.3v1.15a${w} 1.75 0 0 0 ${w*2} 0V-.3Z`,fill:p.side}));
    g.appendChild(el(doc,'ellipse',{cx:0,cy:-.3,rx:w,ry:1.75,fill:p.top,stroke:p.edge,'stroke-width':.18,'stroke-opacity':.5}));
  }
  function shine(doc,g,d,opacity=.55){g.appendChild(el(doc,'path',{d,fill:'#ffffff',opacity}));}

  const SHAPES={
    classic(doc,g,p){
      base(doc,g,p,4.9);
      g.appendChild(el(doc,'path',{d:'M-4.1 -.7C-3.9 -3.4-1.7 -5.3-1.55 -8.6H1.55C1.7 -5.3 3.9 -3.4 4.1 -.7Q0 .9-4.1 -.7Z',fill:p.body,stroke:p.edge,'stroke-width':.18,'stroke-opacity':.55}));
      shine(doc,g,'M-3.1 -1.4C-2.9 -3.6-1.6 -5.2-1.3 -7.9L-.7 -7.9C-.9 -5-2 -3.4-2.2 -1.2Z',.42);
      g.appendChild(el(doc,'ellipse',{cx:0,cy:-8.75,rx:2.65,ry:.95,fill:p.top,stroke:p.edge,'stroke-width':.16,'stroke-opacity':.45}));
      g.appendChild(el(doc,'circle',{cx:0,cy:-11.7,r:3.15,fill:p.head,stroke:p.edge,'stroke-width':.18,'stroke-opacity':.5}));
      g.appendChild(el(doc,'ellipse',{cx:-1.15,cy:-12.95,rx:.95,ry:.62,fill:'#fff',opacity:.9}));
    },
    atlas(doc,g,p){
      base(doc,g,p,4.6);
      g.appendChild(el(doc,'path',{d:'M-3.6 -.7C-3.1 -5-1.3 -10.2 0 -16.4 1.3 -10.2 3.1 -5 3.6 -.7Q0 .8-3.6 -.7Z',fill:p.body,stroke:p.edge,'stroke-width':.18,'stroke-opacity':.55}));
      shine(doc,g,'M-2.5 -1.3C-2.1 -5-.9 -9.6-.1 -14.4L.2 -14.2C-.4 -9.8-1.3 -5.2-1.6 -1.1Z',.45);
      g.appendChild(el(doc,'path',{d:'M-2.95 -5.2Q0 -4.1 2.95 -5.2L2.7 -6.4Q0 -5.4-2.7 -6.4Z',fill:p.metal}));
    },
    rook(doc,g,p){
      base(doc,g,p,4.9);
      g.appendChild(el(doc,'path',{d:'M-3.7 -.7-2.9 -9-3.5 -9.4V-12.8H-2.15V-11.5H-.7V-12.8H.7V-11.5H2.15V-12.8H3.5V-9.4L2.9 -9 3.7 -.7Q0 .9-3.7 -.7Z',fill:p.body,stroke:p.edge,'stroke-width':.2,'stroke-opacity':.6}));
      g.appendChild(el(doc,'rect',{x:-3.15,y:-9.7,width:6.3,height:.9,rx:.3,fill:p.metal}));
      g.appendChild(el(doc,'rect',{x:-.55,y:-7.4,width:1.1,height:2.4,rx:.55,fill:dark(p.edge,.2),opacity:.75}));
      shine(doc,g,'M-2.8 -1.4-2.2 -8.6H-1.6L-2 -1.2Z',.4);
    },
    orbit(doc,g,p){
      base(doc,g,p,4.6);
      g.appendChild(el(doc,'path',{d:'M-1.5 -.8-.95 -6.1H.95L1.5 -.8Q0 .1-1.5 -.8Z',fill:p.metal}));
      g.appendChild(el(doc,'path',{d:'M-5.2 -9.6A5.3 1.7 -16 0 1 5.2 -10.6',fill:'none',stroke:p.metal,'stroke-width':.75,opacity:.75}));
      g.appendChild(el(doc,'circle',{cx:0,cy:-9.7,r:3.75,fill:p.head,stroke:p.edge,'stroke-width':.18,'stroke-opacity':.5}));
      g.appendChild(el(doc,'path',{d:'M-5.2 -9.6A5.3 1.7 -16 0 0 5.2 -10.6',fill:'none',stroke:p.metal,'stroke-width':.85}));
      g.appendChild(el(doc,'ellipse',{cx:-1.3,cy:-11.1,rx:1.1,ry:.7,fill:'#fff',opacity:.9}));
    },
    lance(doc,g,p){
      base(doc,g,p,4.3);
      g.appendChild(el(doc,'path',{d:'M-2.5 -.7-1.25 -11.6H1.25L2.5 -.7Q0 .7-2.5 -.7Z',fill:p.body,stroke:p.edge,'stroke-width':.18,'stroke-opacity':.55}));
      g.appendChild(el(doc,'path',{d:'M-1.45 -11.4 0 -18.2 1.45 -11.4Q0 -10.8-1.45 -11.4Z',fill:p.metal}));
      g.appendChild(el(doc,'path',{d:'M0 -10.9V-2',stroke:'#fff',opacity:.35,'stroke-width':.35}));
      shine(doc,g,'M-1.9 -1.3-1 -10.8H-.55L-1.2 -1.2Z',.4);
    },
    lotus(doc,g,p){
      base(doc,g,p,4.6);
      g.appendChild(el(doc,'path',{d:'M0 -1.1C-1.6 -4.2-1.8 -9.5 0 -14.2 1.8 -9.5 1.6 -4.2 0 -1.1Z',fill:p.glass,stroke:'#ffffff',  'stroke-width':.25,'stroke-opacity':.7}));
      for(const s of [-1,1])g.appendChild(el(doc,'path',{d:`M0 -1C${s*-3.4} -2.2 ${s*-5.4} -6.6 ${s*-4.4} -10.4 ${s*-2.6} -9.4 ${s*-1.2} -6 0 -1Z`,fill:p.body,stroke:'#ffffff','stroke-width':.22,'stroke-opacity':.6,opacity:.95}));
      g.appendChild(el(doc,'circle',{cx:0,cy:-2.2,r:.9,fill:p.metal}));
    },
    monolith(doc,g,p){
      base(doc,g,p,4.5);
      g.appendChild(el(doc,'path',{d:'M0 -15.4 3.4 -11.2 2.9 -2 0 -.5-2.9 -2-3.4 -11.2Z',fill:p.body,stroke:p.edge,'stroke-width':.2,'stroke-opacity':.55}));
      g.appendChild(el(doc,'path',{d:'M0 -15.4V-.5L-2.9 -2-3.4 -11.2Z',fill:'#fff',opacity:.22}));
      g.appendChild(el(doc,'path',{d:'M-3.4 -11.2 0 -9.6 3.4 -11.2M0 -9.6V-.5',fill:'none',stroke:'#fff',opacity:.5,'stroke-width':.25}));
    },
    crown(doc,g,p){
      SHAPES.classic(doc,g,p);
      g.appendChild(el(doc,'path',{d:'M-2.7 -13.9-3.1 -17.1-1.45 -15.6 0 -18 1.45 -15.6 3.1 -17.1 2.7 -13.9Q0 -13.2-2.7 -13.9Z',fill:p.metal,stroke:'#6b4a17','stroke-width':.18}));
      for(const [x,y] of [[-3.1,-17.2],[0,-18.1],[3.1,-17.2]])g.appendChild(el(doc,'circle',{cx:x,cy:y,r:.45,fill:'#fff6d6'}));
    },
    orb(doc,g,p){
      base(doc,g,p,4.6);
      g.appendChild(el(doc,'path',{d:'M-1.6 -.8-1.1 -3.8H1.1L1.6 -.8Z',fill:p.metal}));
      g.appendChild(el(doc,'circle',{cx:0,cy:-8.2,r:4,fill:p.head,opacity:.92,stroke:light(p.edge,.4),'stroke-width':.25}));
      for(const s of [-1,0,1])g.appendChild(el(doc,'path',{d:`M${s*1.1} -3.7Q${s*3.6} -5.2 ${s*3.1} -8.6`,fill:'none',stroke:p.metal,'stroke-width':.7,'stroke-linecap':'round'}));
      g.appendChild(el(doc,'ellipse',{cx:-1.4,cy:-9.8,rx:1.2,ry:.8,fill:'#fff',opacity:.9}));
    },
    gem(doc,g,p){
      base(doc,g,p,4.4);
      g.appendChild(el(doc,'path',{d:'M-1.2 -.8-.8 -3.4H.8L1.2 -.8Z',fill:p.metal}));
      g.appendChild(el(doc,'path',{d:'M-3.6 -10.4-1.9 -13.2H1.9L3.6 -10.4 0 -3.2Z',fill:p.body,stroke:p.edge,'stroke-width':.2,'stroke-opacity':.55}));
      g.appendChild(el(doc,'path',{d:'M-3.6 -10.4H3.6M-1.9 -13.2-1.1 -10.4 0 -3.2 1.1 -10.4 1.9 -13.2',fill:'none',stroke:'#fff',opacity:.55,'stroke-width':.22}));
      g.appendChild(el(doc,'path',{d:'M-1.9 -13.2-1.1 -10.4-3.6 -10.4Z',fill:'#fff',opacity:.35}));
    }
  };

  /* A pawn group in local units: the base sits on (0,0) and the piece rises
     about 13–18 units. `defs` receives the gradients. */
  function pawn(doc,defs,{design='classic',color=COLORS[0],scope='bsp',number=''}={}){
    const shape=SHAPES[design]?design:'classic',p=paints(doc,defs,color,TRIM[shape]||'silver',scope),g=el(doc,'g',{'data-piece-design':shape});
    SHAPES[shape](doc,g,p);
    if(number!=='')g.appendChild(el(doc,'text',{x:0,y:.55,'text-anchor':'middle','font-size':1.7,'font-weight':800,'font-family':'Tajawal,Arial,sans-serif',fill:'#ffffff','paint-order':'stroke',stroke:dark(color,.55),'stroke-width':.35},number));
    return g;
  }

  /* A glass marble centred on (0,0) with radius 5. */
  function marble(doc,defs,{style='glass',color=COLORS[0],scope='bsm'}={}){
    const k=scope+'-'+safe(color)+'-'+style,g=el(doc,'g',{'data-marble-style':style});
    const shadow=radial(doc,defs,scope+'-mshadow',[[0,'#000000',.55],[.6,'#000000',.2],[1,'#000000',0]],.5,.5,.5);
    g.appendChild(el(doc,'ellipse',{cx:.9,cy:4.6,rx:5.4,ry:1.9,fill:shadow}));
    const bodyStops=style==='galaxy'?[[0,mix(color,'#ffffff',.25)],[.35,dark(color,.35)],[.8,'#0b1023'],[1,'#03050c']]
      :style==='pearl'?[[0,'#ffffff'],[.35,light(color,.62)],[.75,light(color,.3)],[1,dark(color,.25)]]
      :style==='metal'?[[0,'#ffffff'],[.3,light(color,.45)],[.62,dark(color,.15)],[1,dark(color,.62)]]
      :[[0,light(color,.72)],[.38,light(color,.18)],[.78,color],[1,dark(color,.55)]];
    const body=radial(doc,defs,k+'-ball',bodyStops,.36,.3,.8);
    const clip=el(doc,'clipPath',{id:k+'-clip'});clip.appendChild(el(doc,'circle',{cx:0,cy:0,r:5}));if(!defs.querySelector?.('#'+k+'-clip'))defs.appendChild(clip);
    g.appendChild(el(doc,'circle',{cx:0,cy:0,r:5,fill:body}));
    const inner=el(doc,'g',{'clip-path':'url(#'+k+'-clip)'});
    if(style==='glass'||style==='royal'){
      inner.appendChild(el(doc,'path',{d:'M-6 1.6C-3.6 -2.4-.4 3.8 2.4 -.4 3.8 -2.6 5.2 -3 6.4 -2.4V.4C5 0 3.6 .8 2.4 2.6-.6 6-3.6 -.2-6 4Z',fill:'#ffffff',opacity:.38}));
      inner.appendChild(el(doc,'path',{d:'M-6 -2.2C-3 -5 .6 -.6 3.4 -3.8',fill:'none',stroke:light(color,.55),'stroke-width':.9,opacity:.65}));
    }else if(style==='metal'){
      inner.appendChild(el(doc,'rect',{x:-6,y:-1.15,width:12,height:2.3,fill:color,opacity:.95}));
      inner.appendChild(el(doc,'rect',{x:-6,y:-1.15,width:12,height:.5,fill:'#ffffff',opacity:.45}));
    }else if(style==='galaxy'){
      inner.appendChild(el(doc,'ellipse',{cx:.6,cy:.8,rx:4.2,ry:2.2,fill:light(color,.25),opacity:.55,transform:'rotate(-24)'}));
      for(const [x,y,r] of [[-2.2,-1,.28],[1.6,-2.4,.22],[2.6,1.4,.3],[-.6,2.6,.2],[-3,1.6,.18],[.4,-.4,.25]])inner.appendChild(el(doc,'circle',{cx:x,cy:y,r,fill:'#ffffff',opacity:.9}));
    }else if(style==='pearl'){
      inner.appendChild(el(doc,'ellipse',{cx:1.6,cy:1.8,rx:4.6,ry:2.4,fill:'#b8f3ff',opacity:.25,transform:'rotate(-30)'}));
      inner.appendChild(el(doc,'ellipse',{cx:-1.8,cy:2.4,rx:3.4,ry:1.6,fill:'#ffd1f0',opacity:.22,transform:'rotate(18)'}));
    }
    g.appendChild(inner);
    if(style==='royal'){const gold=linear(doc,defs,scope+'-royal-gold',[[0,'#fff3c9'],[.4,'#e7c36d'],[1,'#7a5518']]);g.appendChild(el(doc,'ellipse',{cx:0,cy:0,rx:5.05,ry:1.5,fill:'none',stroke:gold,'stroke-width':.9}));}
    g.appendChild(el(doc,'circle',{cx:0,cy:0,r:4.85,fill:'none',stroke:dark(color,.6),'stroke-width':.3,opacity:.55}));
    g.appendChild(el(doc,'ellipse',{cx:-1.7,cy:-2.1,rx:1.85,ry:1.15,fill:'#ffffff',opacity:.92,transform:'rotate(-28 -1.7 -2.1)'}));
    g.appendChild(el(doc,'ellipse',{cx:2,cy:2.5,rx:1,ry:.5,fill:'#ffffff',opacity:.3,transform:'rotate(-28 2 2.5)'}));
    return g;
  }

  /* A standalone <svg> for DOM tokens and previews. */
  function icon(doc,{kind='pawn',design='classic',style,color=COLORS[0],className='piece-svg',label=''}={}){
    const scope='i'+(++sequence),svg=el(doc,'svg',{viewBox:kind==='marble'?'-6.5 -6.5 13 13':'-7 -19.5 14 22',class:className,'aria-hidden':label?null:'true',role:label?'img':null,'aria-label':label||null,focusable:'false'});
    const defs=el(doc,'defs');svg.appendChild(defs);
    svg.appendChild(kind==='marble'?marble(doc,defs,{style:style||MARBLES[design]||'glass',color,scope}):pawn(doc,defs,{design,color,scope}));
    return svg;
  }
  const designFor=id=>DESIGNS[id]||'classic';
  const marbleFor=id=>MARBLES[designFor(id)]||'glass';
  const equipped=()=>root.BS_CAREER?.get?.()?.equipped?.pawn||root.document?.documentElement?.dataset?.pawn||'pawn-classic';

  root.BS_PIECES=Object.freeze({COLORS,DESIGNS:Object.freeze({...DESIGNS}),SHAPES:Object.freeze(Object.keys(SHAPES)),designFor,marbleFor,equipped,pawn,marble,icon,mix,light,dark});
})(typeof window!=='undefined'?window:globalThis);
