import {drawNeonBody,drawNeonHead} from './neon-snakes-v33.js?v=33.0.0';
import {snakeGeometry} from './arena-geometry.js?v=29.1.0';
/* Tahdia 31.1.0 — the living snakes and ladders of the snakes & ladders board.
   The snakes are the arena's own species (serpent-art-v16.js): painted heads
   from the arena sheet and scaled, patterned bodies, each snake a different
   species with the equipped one first. They slither, flick their tongues and,
   when a stone lands on a head, lunge, bite, swallow it (a lump runs down the
   body), swell, and stay a little bigger for every stone they have eaten in
   this match. Ladders are round gold (or wooden, ember, starlit or neon) beams that light up
   rung by rung while a stone climbs. */
(function(){
  'use strict';
  const PORTRAIT_ART='assets/arena/neon-cobra.webp';
  const cobra=new Image();let cobraRequested=false;
  const snakes=new Map(),ladders=new Map(),meals=new Map();
  let canvas,ctx,routes=[],width=0,height=0,clock=0,last=0,frame=0,paintedAt=0,artRequested=false;
  const reduce=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch{return false}};
  const ease=t=>Math.sin(Math.max(0,Math.min(1,t))*Math.PI);
  const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
  const art=()=>window.BS_SERPENT_ART||null;

  // Arena species. The equipped snake leads; the rest follow in this order.
  const SPECIES=['snake-wild','snake-gold','snake-aurora','snake-toxic','snake-ice','snake-plasma'];
  const FALLBACK={'snake-wild':['#378d6b','#102e2b','#a9ecc3'],'snake-gold':['#be8c34','#52381d','#ffe6a8'],'snake-aurora':['#8961bb','#342440','#e9d3ff'],'snake-toxic':['#76a52c','#27361c','#ddff91'],'snake-ice':['#65b8d9','#23415f','#e5fcff'],'snake-plasma':['#448dc5','#392853','#bcfaff'],'snake-sovereign':['#1b5a3d','#06100b','#e8c46a']};
  function speciesFor(index){
    const eq=document.documentElement?.dataset?.snake;
    const list=eq==='snake-sovereign'||SPECIES.includes(eq)?[eq,...SPECIES.filter(s=>s!==eq)]:SPECIES;
    return list[index%list.length];
  }
  // Ladder materials follow the board from the shop.
  const LADDERS={
    classic:{dark:'#3f230c',mid:'#94602f',light:'#d9a46c',hi:'#ffe2b5',peg:'#2a1606',glow:'#ffd27a'},
    royal:{dark:'#5c3d0b',mid:'#c29236',light:'#efd28a',hi:'#fff6d8',peg:'#3e2905',glow:'#fff0a8'},
    cyber:{dark:'#06202e',mid:'#1a6f92',light:'#4fd9fb',hi:'#d4fbff',peg:'#041723',glow:'#6ff6ff'},
    ember:{dark:'#140804',mid:'#5b2a14',light:'#ff8a3d',hi:'#ffd2a1',peg:'#0d0503',glow:'#ffb347'},
    cosmic:{dark:'#1b1638',mid:'#6c5fb8',light:'#cdc4ff',hi:'#f5f2ff',peg:'#100c26',glow:'#d9ccff'}
  };
  // 32.0.0: the jewel board (the free one) climbs on gold ladders too
  const boardTheme=()=>{const id=document.documentElement?.dataset?.board||'board-forest';return /lava/.test(id)?'ember':/galaxy/.test(id)?'cosmic':/royal|sand/.test(id)?'royal':/cyber|twilight|forest/.test(id)?'cyber':'classic';};

  function layout(entries){
    const board=document.getElementById('board');if(!board)return;
    if(!canvas){
      canvas=document.createElement('canvas');canvas.className='arena-live-creatures v31 v311';canvas.setAttribute('aria-hidden','true');
      ctx=canvas.getContext('2d',{alpha:true});
    }
    // 32.1.0: a new board (the group games build one per round) takes the canvas over
    if(canvas.parentNode!==document.getElementById('boardWrap'))document.getElementById('boardWrap').appendChild(canvas);
    // the painted heads come from the arena sheet, fetched once when the board first appears
    // Procedural neon heads need no image sheet.
    const dpr=Math.min(devicePixelRatio||1,window.innerWidth<760?1.5:2),r=board.getBoundingClientRect();
    width=r.width;height=r.height;canvas.width=Math.ceil(width*dpr);canvas.height=Math.ceil(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
    // lie exactly over the tiles, whatever the frame padding is
    if(canvas.style?.setProperty&&Number.isFinite(board.offsetLeft)){
      for(const [k,v] of [['left',board.offsetLeft+'px'],['top',board.offsetTop+'px'],['width',width+'px'],['height',height+'px'],['right','auto'],['bottom','auto'],['inset','auto']])if(k!=='inset')canvas.style.setProperty(k,v,'important');
    }
    routes=entries.map((route,index)=>({...route,index,a:{x:route.a.x*width/1000,y:route.a.y*height/1000},b:{x:route.b.x*width/1000,y:route.b.y*height/1000}}));
    let snakeIndex=0;for(const r of routes)if(r.to<r.from)r.colorIndex=snakeIndex++;
    canvas.dataset.snakes=routes.filter(r=>r.to<r.from).length;canvas.dataset.ladders=routes.filter(r=>r.to>r.from).length;canvas.dataset.assets='ready';
    if(!frame){last=performance.now();frame=requestAnimationFrame(tick);}
  }
  function phase(from,value){
    paintedAt=-Infinity;
    const entry=snakes.get(Number(from))||{};entry.phase=value||'idle';entry.at=clock;snakes.set(Number(from),entry);
    if(canvas){if(value==='tracking'){canvas.dataset.history='';canvas.dataset.maxScale='1';}canvas.dataset.phase=entry.phase;canvas.dataset.activeSnake=from;canvas.dataset.history=(canvas.dataset.history?canvas.dataset.history+',':'')+entry.phase;}
  }
  function ladder(from,value){paintedAt=-Infinity;ladders.set(Number(from),{phase:value||'idle',at:clock});}
  // How many stones a snake has eaten this match (no argument clears the board).
  function meal(from,count){paintedAt=-Infinity;if(from===null||from===undefined){meals.clear();return;}meals.set(Number(from),clamp(Number(count)||0,0,5));}

  /* ---------- ladders ---------- */
  // A round beam lit from the top left: bright edge, highlight, base, shade.
  function beam(x1,y1,x2,y2,w,t,lit){
    const dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy)||1;let nx=-dy/len,ny=dx/len;if(nx*-.7+ny*-.7<0){nx=-nx;ny=-ny;}
    const g=ctx.createLinearGradient(x1+nx*w/2,y1+ny*w/2,x1-nx*w/2,y1-ny*w/2);
    g.addColorStop(0,lit?'#ffffff':t.light);g.addColorStop(.28,lit?t.glow:t.hi);g.addColorStop(.5,lit?t.glow:t.mid);g.addColorStop(1,t.dark);
    ctx.strokeStyle=g;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
  }
  function drawLadder(r){
    const t=LADDERS[boardTheme()],cell=width/10,dx=r.b.x-r.a.x,dy=r.b.y-r.a.y,len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len,nx=-uy,ny=ux;
    const half=cell*.18,rail=Math.max(2.3,cell*.085),rungW=Math.max(1.6,cell*.055),s=ladders.get(r.from),active=s&&s.phase!=='idle';
    const ext=cell*.14,ax=r.a.x-ux*ext,ay=r.a.y-uy*ext,bx=r.b.x+ux*ext,by=r.b.y+uy*ext;
    const count=Math.max(3,Math.round(len/(cell*.42))),travel=active?((clock-s.at)/1100)%1:-1;
    ctx.save();ctx.lineCap='round';
    // soft shadow on the board
    ctx.strokeStyle=t===LADDERS.classic?'rgba(28,14,4,.26)':'rgba(0,0,0,.42)';
    for(const side of [-1,1]){ctx.lineWidth=rail*1.1;ctx.beginPath();ctx.moveTo(ax+nx*half*side+cell*.06,ay+ny*half*side+cell*.1);ctx.lineTo(bx+nx*half*side+cell*.06,by+ny*half*side+cell*.1);ctx.stroke();}
    for(let i=1;i<count;i++){const f=i/count,x=r.a.x+dx*f+cell*.06,y=r.a.y+dy*f+cell*.1;ctx.lineWidth=rungW;ctx.beginPath();ctx.moveTo(x+nx*half,y+ny*half);ctx.lineTo(x-nx*half,y-ny*half);ctx.stroke();}
    // rungs, then the rails over their ends
    for(let i=1;i<count;i++){
      const f=i/count,x=r.a.x+dx*f,y=r.a.y+dy*f,lit=active&&Math.abs(f-travel)<.14;
      if(lit){ctx.shadowColor=t.glow;ctx.shadowBlur=cell*.4;}
      beam(x+nx*half,y+ny*half,x-nx*half,y-ny*half,rungW,t,lit);
      ctx.shadowBlur=0;
    }
    for(const side of [-1,1])beam(ax+nx*half*side,ay+ny*half*side,bx+nx*half*side,by+ny*half*side,rail,t,false);
    // pegs where rungs meet the rails
    ctx.fillStyle=t.peg;
    for(let i=1;i<count;i++){const f=i/count,x=r.a.x+dx*f,y=r.a.y+dy*f;for(const side of [-1,1]){ctx.beginPath();ctx.arc(x+nx*half*side,y+ny*half*side,Math.max(.7,rail*.16),0,Math.PI*2);ctx.fill();}}
    if(active){
      const glow=.5+.5*Math.sin(clock/120);ctx.globalAlpha=.5*glow;ctx.fillStyle=t.glow;
      for(const p of [r.a,r.b]){ctx.beginPath();ctx.arc(p.x,p.y,cell*.2,0,Math.PI*2);ctx.fill();}
      ctx.globalAlpha=1;
    }
    ctx.restore();
  }

  /* ---------- snakes ---------- */
  function trace(points,from=0,to=points.length-1){ctx.beginPath();ctx.moveTo(points[from].x,points[from].y);for(let i=from+1;i<=to;i++)ctx.lineTo(points[i].x,points[i].y);}
  function fallbackBody(points,species,R){
    const [base,dark,light]=FALLBACK[species]||FALLBACK['snake-wild'];
    ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
    trace(points);ctx.lineWidth=R*2+1.2;ctx.strokeStyle=dark;ctx.stroke();
    trace(points);ctx.lineWidth=R*2;ctx.strokeStyle=base;ctx.stroke();
    trace(points);ctx.lineWidth=Math.max(1,R*.3);ctx.strokeStyle=light;ctx.globalAlpha=.6;ctx.stroke();
    ctx.restore();
  }
  function fallbackHead(species,size){
    const [base,dark,light]=FALLBACK[species]||FALLBACK['snake-wild'];
    ctx.fillStyle=dark;ctx.beginPath();ctx.ellipse(size*.2,0,size*1.25,size*.9,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=base;ctx.beginPath();ctx.ellipse(size*.3,0,size*1.12,size*.76,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=light;for(const s of [-1,1]){ctx.beginPath();ctx.ellipse(size*.55,s*size*.42,size*.18,size*.13,0,0,Math.PI*2);ctx.fill();}
  }
  function tongue(size,flick){
    const L=size*(.8+.25*Math.sin(clock/40))*flick,x=size*1.62;
    ctx.strokeStyle='#e23a55';ctx.lineWidth=Math.max(.8,size*.08);ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+L,0);ctx.moveTo(x+L,0);ctx.lineTo(x+L+size*.22,-size*.17);ctx.moveTo(x+L,0);ctx.lineTo(x+L+size*.22,size*.17);ctx.stroke();
  }
  function drawSnake(r){
    const state=snakes.get(r.from)||{phase:'idle',at:0},elapsed=clock-state.at,ph=state.phase,still=reduce();
    const cell=width/10,species=speciesFor(r.colorIndex||0),A=art();
    const shape=snakeGeometry(r.a,r.b,{width,height},{time:clock,seed:r.index,motion:!still,route:r.from});
    const raw=shape.points,n=raw.length;
    // idle slither: a small travelling wave; both ends stay on their cells
    const amp=still?0:cell*(ph==='idle'?.06:.03),speed=ph==='digesting'?700:1500;
    const pts=raw.map((p,i)=>{
      const a=raw[Math.max(0,i-1)],b=raw[Math.min(n-1,i+1)],dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy)||1,nx=-dy/l,ny=dx/l,t=i/(n-1);
      const wave=Math.sin(t*Math.PI*3.2-clock/speed*Math.PI*2+r.index)*amp*Math.sin(Math.PI*t);
      return {x:p.x+nx*wave,y:p.y+ny*wave,nx,ny,t};
    });
    const fed=meals.get(r.from)||0,grownBy=1+fed*.08;
    const swell=ph==='digesting'?1+.3*ease(elapsed/900):ph==='releasing'?1+.12*(1-Math.min(1,elapsed/550)):1;
    const length=Math.hypot(r.a.x-r.b.x,r.a.y-r.b.y);
    const R=cell*clamp(.1+length/(cell*70),.105,.145)*grownBy*swell;
    ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
    // The tapered silhouette supplies its own dark edge, without a blunt tail shadow.
    // body: the arena species, its scales shrunk to the board
    drawNeonBody(ctx,pts,species,R,ph!=='idle');
    // the swallowed stone runs down the body as a lump
    if(ph==='swallowing'){
      const s=Math.min(1,elapsed/900),i=Math.min(n-2,Math.max(1,Math.round(s*(n-1)))),p=pts[i],lump=R*(1.55-.35*s);
      const [base,dark,light]=FALLBACK[species]||FALLBACK['snake-wild'];
      ctx.fillStyle=dark;ctx.beginPath();ctx.arc(p.x,p.y,lump+.8,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=base;ctx.beginPath();ctx.arc(p.x,p.y,lump,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=.45;ctx.fillStyle=light;ctx.beginPath();ctx.arc(p.x-lump*.3,p.y-lump*.35,lump*.42,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    }
    // head: lifts toward the stone, lunges, and grows with the snake
    const neck=pts[0],head=shape.head,dir=Math.atan2(head.y-neck.y,head.x-neck.x);
    const track=ph==='tracking'?Math.min(1,elapsed/380):ph==='attacking'?1:0,strike=ph==='attacking'?ease(elapsed/360):0,breathe=still||ph!=='idle'?0:Math.sin(clock/900+r.index)*.035;
    const size=R*2.35*(1+breathe+.14*track+.3*strike)*(1+(swell-1)*.6);
    const shake=ph==='digesting'&&!still?Math.sin(elapsed/45)*cell*.02:0;
    ctx.save();
    ctx.translate(neck.x+Math.cos(dir)*strike*cell*.24+shake,neck.y+Math.sin(dir)*strike*cell*.24-track*cell*.04);ctx.rotate(dir);
    if(track>0){ctx.save();ctx.globalAlpha=.3*track+.25*strike;const g=ctx.createRadialGradient(size*.5,0,0,size*.5,0,size*2.2);g.addColorStop(0,'#ff3b4e');g.addColorStop(1,'rgba(255,59,78,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(size*.5,0,size*2.2,0,Math.PI*2);ctx.fill();ctx.restore();}
    const flick=still?0:ph==='tracking'?1:((clock+r.index*613)%2900<260?1:0);
    if(flick&&strike<.2)tongue(size,flick);
    drawNeonHead(ctx,species,size);
    ctx.restore();
    // the bite: a white flash and a ring at the head
    if(ph==='attacking'&&!still){
      const k=Math.min(1,elapsed/360);ctx.globalAlpha=(1-k)*.8;ctx.strokeStyle='#ffffff';ctx.lineWidth=Math.max(1,cell*.04);
      ctx.beginPath();ctx.arc(head.x,head.y,cell*(.2+.45*k),0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;
    }
    ctx.restore();
    const proxy=document.querySelector(`.snake-creature[data-from="${r.from}"]`);
    if(proxy){proxy.dataset.visualScale=swell.toFixed(3);proxy.dataset.visualPhase=ph;proxy.dataset.fed=String(fed);}
    if(canvas&&Number(canvas.dataset.activeSnake)===r.from)canvas.dataset.maxScale=String(Math.max(swell,Number(canvas.dataset.maxScale)||1));
  }

  function tick(now){
    // a board that left the page (a group round ended) stops drawing
    if(canvas.isConnected===false){frame=0;return;}
    const delta=Math.min(100,now-last);last=now;
    if(document.hidden||window.BS_PRO?.paused||document.getElementById('game')?.classList.contains('hidden')){frame=requestAnimationFrame(tick);return;}
    clock+=delta;
    const active=[...snakes.values(),...ladders.values()].some(entry=>entry.phase!=='idle');
    if(clock-paintedAt<(active?30:80)){frame=requestAnimationFrame(tick);return;}
    paintedAt=clock;ctx.clearRect(0,0,width,height);
    for(const r of routes)if(r.to>r.from)drawLadder(r);
    for(const r of routes)if(r.to<r.from)drawSnake(r);
    canvas.dataset.frame=String(Math.floor(clock));
    frame=requestAnimationFrame(tick);
  }

  // Pawns: 3D stones by default, characters or crystal on request.
  const PLAYER_COLORS=['#2f86e8','#8b5cf6','#f0b429','#22a565','#e5484d','#14b8a6','#f97316','#ec4899','#84cc16','#94a3b8'];
  function crystal(el,player){
    const art=document.documentElement?.dataset?.pieceArt;
    if(art==='characters'||art==='royal'){
      const c=document.createElement('canvas');c.className='crystal-sprite';c.width=144;c.height=180;c.setAttribute('aria-hidden','true');
      if(window.BS_STONES?.draw(c,document.documentElement.dataset.pawn,player)){el.appendChild(c);return c;}
    }
    if(window.BS_PIECES){
      const pawnId=window.BS_PIECES.equipped(),svg=window.BS_PIECES.icon(document,{design:window.BS_PIECES.designFor(pawnId),item:pawnId,color:PLAYER_COLORS[player%PLAYER_COLORS.length],className:'crystal-sprite piece-svg'});
      el.appendChild(svg);return svg;
    }
    const c=document.createElement('canvas');c.className='crystal-sprite';c.width=144;c.height=180;c.setAttribute('aria-hidden','true');el.appendChild(c);return c;
  }
  function wait(ms){
    return new Promise(resolve=>{
      let remaining=ms,started=0,timer=null;
      const clear=()=>{if(timer!==null){clearTimeout(timer);timer=null;remaining=Math.max(0,remaining-(performance.now()-started));}};
      const finish=()=>{window.removeEventListener('bs-match-pause',sync);resolve();};
      const sync=()=>{clear();if(window.BS_PRO?.paused)return;started=performance.now();timer=setTimeout(finish,remaining);};
      window.addEventListener('bs-match-pause',sync);sync();
    });
  }
  function portrait(el){
    if(!cobraRequested){cobraRequested=true;cobra.src=PORTRAIT_ART;}
    const c=document.createElement('canvas');c.width=360;c.height=283;c.setAttribute('aria-hidden','true');
    const paint=()=>c.getContext('2d')?.drawImage(cobra,285,10,610,480,0,0,360,283);
    cobra.complete&&cobra.naturalWidth?paint():cobra.addEventListener('load',paint,{once:true});
    el.appendChild(c);return c;
  }
  window.BS_ARENA={layout,phase,ladder,meal,crystal,portrait,wait,PLAYER_COLORS,speciesFor};
  if(typeof CustomEvent==='function')window.dispatchEvent?.(new CustomEvent('bs-arena-ready'));
})();
