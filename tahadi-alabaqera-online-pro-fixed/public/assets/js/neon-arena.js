import {snakeGeometry} from './arena-geometry.js?v=29.1.0';
/* Tahdia 31.0.0 — living snakes and ladders for the snakes & ladders board.
   Slim, tidy snakes drawn as vector tubes: an idle slither, blinking eyes and
   a flicking tongue; on a catch the head rises and grows, strikes, a bulge
   travels down the body, the body swells, then settles. Ladders are drawn
   under the snakes and light rung by rung while a pawn climbs. No image
   downloads are needed for the board. */
(function(){
  'use strict';
  const PORTRAIT_ART='assets/arena/neon-cobra.webp';
  const cobra=new Image();let cobraRequested=false;
  const snakes=new Map(),ladders=new Map();
  let canvas,ctx,routes=[],width=0,height=0,clock=0,last=0,frame=0,paintedAt=0;
  const reduce=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch{return false}};
  const ease=t=>Math.sin(Math.max(0,Math.min(1,t))*Math.PI);
  const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));

  // Snake colours follow the equipped snake skin from the shop.
  const P=(base,dark,light,belly,mark)=>({base,dark,light,belly,mark});
  const SKINS={
    'snake-wild':[P('#2fae63','#13633a','#9ff0bd','#eef7cf','#0d4528'),P('#d9434f','#7d1a26','#ff9ba3','#ffe7d6','#5a0f19'),P('#3478e0','#163f86','#9cc6ff','#e3f0ff','#0f2c63'),P('#e9a72a','#8d5a0b','#ffe08f','#fff5d6','#6b4305'),P('#8b5bd9','#452386','#d1b6ff','#f1e8ff','#2f1661'),P('#1fa4a6','#0d5b5d','#8ff0ee','#e1fbf8','#0a4344'),P('#ef7a45','#8f3a12','#ffc19e','#fff0e2','#6d2a0b'),P('#7fb52f','#3f6612','#cdf28c','#f4fbdc','#2d4a0b')],
    'snake-gold':[P('#e3b24b','#8a6219','#fff0b8','#fff9e6','#6e4c0f'),P('#d4973a','#7a4f12','#ffd78f','#fff3df','#5c3a0a'),P('#f0c868','#9b7322','#fff6cf','#fffbea','#73541a')],
    'snake-ice':[P('#5fb9e6','#1f5f87','#d4f3ff','#f2fbff','#174a69'),P('#7fd3e8','#2a7088','#e6fbff','#f6feff','#1f5566'),P('#4e8fe0','#1d4583','#c4dcff','#eef5ff','#16335f')],
    'snake-toxic':[P('#79c43a','#3a6a12','#d6ff8f','#f6ffd8','#2b5009'),P('#3fbf6b','#16673a','#a9f5c4','#ecfff2','#0f4d2a'),P('#b8d838','#5f7410','#efff9c','#fbffe0','#475809')],
    'snake-aurora':[P('#a679e8','#4f2b8e','#e2cdff','#f6efff','#3a1f6b'),P('#e07ac4','#83306c','#ffc6ec','#fff0fa','#651f52'),P('#7f8cf0','#33388f','#cdd3ff','#f0f2ff','#262a6e')],
    'snake-plasma':[P('#35c7e8','#0f5f7a','#b9f4ff','#eafcff','#0b4659'),P('#8a5cf5','#3d1f8e','#d3c1ff','#f3eeff','#2c166b'),P('#e14fd0','#7b1b70','#ffbdf3','#ffeefb','#5c1153')],
    'snake-sovereign':[P('#1d5a3e','#06140d','#8ff0bb','#f6e3a8','#e8c46a'),P('#163f2c','#040d08','#62ffaf','#f6e3a8','#e8c46a')]
  };
  // Board themes from the shop change ladder materials.
  const LADDERS={
    classic:{rail:'#a26a35',railHi:'#f0c890',railLo:'#5e3a17',rung:'#c48a4c',rungHi:'#f6d9a9',glow:'#ffd27a'},
    royal:{rail:'#c99a3e',railHi:'#fff0bd',railLo:'#7a5514',rung:'#d7ad55',rungHi:'#fff4cf',glow:'#fff0a8'},
    cyber:{rail:'#1f6f8f',railHi:'#7ff3ff',railLo:'#0b2c3d',rung:'#2a95b8',rungHi:'#b5fbff',glow:'#6ff6ff'}
  };
  const boardTheme=()=>{const id=document.documentElement?.dataset?.board||'';return /royal|sand/.test(id)?'royal':/cyber|twilight/.test(id)?'cyber':'classic';};
  const palette=(index)=>{const list=SKINS[document.documentElement?.dataset?.snake]||SKINS['snake-wild'];return list[index%list.length];};

  function layout(entries){
    const board=document.getElementById('board');if(!board)return;
    if(!canvas){
      canvas=document.createElement('canvas');canvas.className='arena-live-creatures v31';canvas.setAttribute('aria-hidden','true');
      document.getElementById('boardWrap').appendChild(canvas);ctx=canvas.getContext('2d',{alpha:true});
    }
    const dpr=Math.min(devicePixelRatio||1,2),r=board.getBoundingClientRect();
    width=r.width;height=r.height;canvas.width=Math.ceil(width*dpr);canvas.height=Math.ceil(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
    routes=entries.map((route,index)=>({...route,index,a:{x:route.a.x*width/1000,y:route.a.y*height/1000},b:{x:route.b.x*width/1000,y:route.b.y*height/1000}}));
    let snakeIndex=0;for(const r of routes)if(r.to<r.from)r.colorIndex=snakeIndex++;
    canvas.dataset.snakes=routes.filter(r=>r.to<r.from).length;canvas.dataset.ladders=routes.filter(r=>r.to>r.from).length;canvas.dataset.assets='ready';
    if(!frame){last=performance.now();frame=requestAnimationFrame(tick);}
  }
  function phase(from,value){
    const entry=snakes.get(Number(from))||{};entry.phase=value||'idle';entry.at=clock;snakes.set(Number(from),entry);
    if(canvas){if(value==='tracking'){canvas.dataset.history='';canvas.dataset.maxScale='1';}canvas.dataset.phase=entry.phase;canvas.dataset.activeSnake=from;canvas.dataset.history=(canvas.dataset.history?canvas.dataset.history+',':'')+entry.phase;}
  }
  function ladder(from,value){ladders.set(Number(from),{phase:value||'idle',at:clock});}

  function drawLadder(r){
    const t=LADDERS[boardTheme()],cell=width/10,dx=r.b.x-r.a.x,dy=r.b.y-r.a.y,len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len,nx=-uy,ny=ux;
    const half=cell*.2,rail=Math.max(2,cell*.085),s=ladders.get(r.from),active=s&&s.phase!=='idle';
    const ext=cell*.12,ax=r.a.x-ux*ext,ay=r.a.y-uy*ext,bx=r.b.x+ux*ext,by=r.b.y+uy*ext;
    ctx.save();ctx.lineCap='round';
    // Shadow on the board.
    ctx.strokeStyle='rgba(40,24,8,.28)';ctx.lineWidth=rail*1.15;
    for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(ax+nx*half*side+cell*.05,ay+ny*half*side+cell*.08);ctx.lineTo(bx+nx*half*side+cell*.05,by+ny*half*side+cell*.08);ctx.stroke();}
    // Rungs first, rails over them.
    const count=Math.max(3,Math.round(len/(cell*.46))),travel=active?((clock-s.at)/1100)%1:-1;
    for(let i=1;i<count;i++){
      const f=i/count,x=r.a.x+dx*f,y=r.a.y+dy*f,lit=active&&Math.abs(f-travel)<.14;
      ctx.lineWidth=Math.max(1.6,cell*.062);ctx.strokeStyle=lit?t.glow:t.rung;
      if(lit){ctx.shadowColor=t.glow;ctx.shadowBlur=cell*.35;}
      ctx.beginPath();ctx.moveTo(x+nx*half,y+ny*half);ctx.lineTo(x-nx*half,y-ny*half);ctx.stroke();
      ctx.shadowBlur=0;ctx.lineWidth=Math.max(.6,cell*.018);ctx.strokeStyle=lit?'#ffffff':t.rungHi;
      ctx.beginPath();ctx.moveTo(x+nx*half*.92-ux*cell*.012,y+ny*half*.92-uy*cell*.012);ctx.lineTo(x-nx*half*.92-ux*cell*.012,y-ny*half*.92-uy*cell*.012);ctx.stroke();
    }
    for(const side of [-1,1]){
      const ox=nx*half*side,oy=ny*half*side;
      ctx.lineWidth=rail;ctx.strokeStyle=t.railLo;ctx.beginPath();ctx.moveTo(ax+ox,ay+oy);ctx.lineTo(bx+ox,by+oy);ctx.stroke();
      ctx.lineWidth=rail*.62;ctx.strokeStyle=t.rail;ctx.beginPath();ctx.moveTo(ax+ox,ay+oy);ctx.lineTo(bx+ox,by+oy);ctx.stroke();
      ctx.lineWidth=Math.max(.7,rail*.22);ctx.strokeStyle=t.railHi;ctx.beginPath();ctx.moveTo(ax+ox-nx*rail*.18,ay+oy-ny*rail*.18);ctx.lineTo(bx+ox-nx*rail*.18,by+oy-ny*rail*.18);ctx.stroke();
    }
    if(active){
      const glow=.5+.5*Math.sin(clock/120);ctx.globalAlpha=.55*glow;ctx.fillStyle=t.glow;
      for(const p of [r.a,r.b]){ctx.beginPath();ctx.arc(p.x,p.y,cell*.18,0,Math.PI*2);ctx.fill();}
      ctx.globalAlpha=1;
    }
    ctx.restore();
  }

  function bodyOutline(points,widths){
    ctx.beginPath();
    for(let i=0;i<points.length;i++){const p=points[i];i?ctx.lineTo(p.x+p.nx*widths[i],p.y+p.ny*widths[i]):ctx.moveTo(p.x+p.nx*widths[i],p.y+p.ny*widths[i]);}
    for(let i=points.length-1;i>=0;i--){const p=points[i];ctx.lineTo(p.x-p.nx*widths[i],p.y-p.ny*widths[i]);}
    ctx.closePath();
  }
  function offsetLine(points,widths,factor,from=0,to=points.length){
    ctx.beginPath();
    for(let i=from;i<to;i++){const p=points[i],w=widths[i]*factor;i>from?ctx.lineTo(p.x+p.nx*w,p.y+p.ny*w):ctx.moveTo(p.x+p.nx*w,p.y+p.ny*w);}
  }

  function drawSnake(r){
    const state=snakes.get(r.from)||{phase:'idle',at:0},elapsed=clock-state.at,ph=state.phase,still=reduce();
    const cell=width/10,pal=palette(r.colorIndex||0);
    const shape=snakeGeometry(r.a,r.b,{width,height},{time:clock,seed:r.index,motion:!still,route:r.from});
    const raw=shape.points,n=raw.length;
    // Idle slither: a small travelling wave; both ends stay on their cells.
    const amp=still?0:cell*(ph==='idle'?.07:.035),speed=ph==='digesting'?700:1500;
    const pts=raw.map((p,i)=>{
      const a=raw[Math.max(0,i-1)],b=raw[Math.min(n-1,i+1)],dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy)||1,nx=-dy/l,ny=dx/l,t=i/(n-1);
      const wave=Math.sin(t*Math.PI*3.2-clock/speed*Math.PI*2+r.index)*amp*Math.sin(Math.PI*t);
      return {x:p.x+nx*wave,y:p.y+ny*wave,nx,ny,t};
    });
    const growth=ph==='digesting'?1+.3*ease(elapsed/900):ph==='releasing'?1+.12*(1-Math.min(1,elapsed/550)):1;
    const swallow=ph==='swallowing'?Math.min(1,elapsed/900):-1;
    const R=cell*.115*growth;
    const widths=pts.map(({t})=>{
      const taper=t<.06?.82+t/.06*.24:t<.62?1.06-(t-.06)*.18:Math.max(.1,.96*Math.pow((1-t)/.38,.85));
      const bulge=swallow<0?0:.9*Math.exp(-Math.pow((t-swallow)/.07,2));
      return R*(taper+bulge);
    });
    ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
    // Contact shadow.
    ctx.save();ctx.translate(cell*.05,cell*.09);ctx.fillStyle='rgba(30,20,8,.26)';bodyOutline(pts,widths);ctx.fill();ctx.restore();
    // Body.
    ctx.fillStyle=pal.base;bodyOutline(pts,widths);ctx.fill();
    ctx.save();bodyOutline(pts,widths);ctx.clip();
    // Belly on the lower side, dark flank, dorsal sheen.
    ctx.strokeStyle=pal.belly;ctx.globalAlpha=.8;
    for(let c=0;c<n-1;c+=8){const to=Math.min(n,c+9);ctx.lineWidth=Math.max(.5,widths[Math.min(n-1,c+4)]*.7);offsetLine(pts,widths,.72,c,to);ctx.stroke();}
    ctx.globalAlpha=.55;ctx.strokeStyle=pal.dark;
    for(let c=0;c<n-1;c+=8){const to=Math.min(n,c+9);ctx.lineWidth=Math.max(.5,widths[Math.min(n-1,c+4)]*.55);offsetLine(pts,widths,-.88,c,to);ctx.stroke();}
    // Diamond markings along the back.
    ctx.globalAlpha=.85;ctx.fillStyle=pal.mark;
    for(let i=5;i<n-6;i+=5){
      const p=pts[i],q=pts[i+1],ang=Math.atan2(q.y-p.y,q.x-p.x),w=widths[i];
      ctx.save();ctx.translate(p.x-p.nx*w*.12,p.y-p.ny*w*.12);ctx.rotate(ang);
      ctx.beginPath();ctx.moveTo(-w*.8,0);ctx.lineTo(0,-w*.5);ctx.lineTo(w*.8,0);ctx.lineTo(0,w*.5);ctx.closePath();ctx.fill();ctx.restore();
    }
    ctx.globalAlpha=.5;ctx.strokeStyle=pal.light;
    for(let c=0;c<n-1;c+=8){const to=Math.min(n,c+9);ctx.lineWidth=Math.max(.4,widths[Math.min(n-1,c+4)]*.22);offsetLine(pts,widths,-.42,c,to);ctx.stroke();}
    if(swallow>=0){const i=Math.round(swallow*(n-1)),p=pts[i];ctx.globalAlpha=.35;ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(p.x-p.nx*widths[i]*.3,p.y-p.ny*widths[i]*.3,widths[i]*.45,0,Math.PI*2);ctx.fill();}
    ctx.restore();
    ctx.globalAlpha=1;ctx.lineWidth=Math.max(.8,cell*.02);ctx.strokeStyle=pal.dark;bodyOutline(pts,widths);ctx.stroke();
    if(r.from&&document.documentElement?.dataset?.snake==='snake-sovereign'){ctx.globalAlpha=.75;ctx.strokeStyle='#e9c46a';ctx.lineWidth=Math.max(.6,cell*.014);offsetLine(pts,widths,-.98,0,n-3);ctx.stroke();ctx.globalAlpha=1;}
    // Head: faces away from the neck, rises and grows when it strikes.
    const neck=pts[0],head=shape.head,dir=Math.atan2(head.y-neck.y,head.x-neck.x);
    const track=ph==='tracking'?Math.min(1,elapsed/380):ph==='attacking'?1:0,strike=ph==='attacking'?ease(elapsed/360):0,breathe=still||ph!=='idle'?0:Math.sin(clock/900+r.index)*.04;
    const open=ph==='tracking'?.45*Math.min(1,elapsed/250):ph==='attacking'?.9:ph==='swallowing'?Math.max(0,.6-elapsed/400):0;
    const headScale=(1+breathe+.18*track+.45*strike)*(1+(growth-1)*.5);
    const H=cell*.3*headScale,W=cell*.24*headScale;
    // Neck joins the head smoothly.
    ctx.strokeStyle=pal.base;ctx.lineWidth=widths[0]*2;ctx.beginPath();ctx.moveTo(neck.x,neck.y);ctx.lineTo(head.x-Math.cos(dir)*H*.45,head.y-Math.sin(dir)*H*.45);ctx.stroke();
    const shake=ph==='digesting'&&!still?Math.sin(elapsed/45)*cell*.02:0;
    ctx.translate(head.x+Math.cos(dir)*strike*cell*.22+shake,head.y+Math.sin(dir)*strike*cell*.22-track*cell*.05);ctx.rotate(dir);
    if(track>0){ctx.save();ctx.globalAlpha=.35*track+.25*strike;ctx.fillStyle='#ff3b4e';ctx.beginPath();ctx.arc(H*.1,0,H*1.25,0,Math.PI*2);ctx.fill();ctx.restore();}
    ctx.save();ctx.translate(cell*.04,cell*.07);ctx.fillStyle='rgba(30,20,8,.26)';headPath(H,W);ctx.fill();ctx.restore();
    const g=ctx.createRadialGradient(-H*.15,-W*.45,W*.1,0,0,H*1.15);g.addColorStop(0,pal.light);g.addColorStop(.45,pal.base);g.addColorStop(1,pal.dark);
    ctx.fillStyle=g;headPath(H,W);ctx.fill();ctx.lineWidth=Math.max(.8,cell*.02);ctx.strokeStyle=pal.dark;ctx.stroke();
    // Crown markings on the head.
    ctx.fillStyle=pal.mark;ctx.globalAlpha=.8;ctx.beginPath();ctx.moveTo(-H*.55,0);ctx.lineTo(-H*.05,-W*.32);ctx.lineTo(H*.25,0);ctx.lineTo(-H*.05,W*.32);ctx.closePath();ctx.fill();ctx.globalAlpha=1;
    if(open>0){
      ctx.fillStyle='#4a0d16';ctx.beginPath();ctx.moveTo(H*.12,0);ctx.lineTo(H*1.02,-W*.5*open);ctx.lineTo(H*1.02,W*.5*open);ctx.closePath();ctx.fill();
      ctx.fillStyle='#d9435a';ctx.beginPath();ctx.moveTo(H*.3,0);ctx.lineTo(H*.95,-W*.32*open);ctx.lineTo(H*.95,W*.32*open);ctx.closePath();ctx.fill();
      ctx.fillStyle='#fffaf0';for(const s of [-1,1]){ctx.beginPath();ctx.moveTo(H*.82,s*W*.42*open);ctx.lineTo(H*.92,s*W*.42*open);ctx.lineTo(H*.86,s*W*.12*open);ctx.closePath();ctx.fill();}
    }
    // Eyes blink now and then.
    const blink=still?1:((clock+r.index*977)%4200<140?.15:1);
    for(const s of [-1,1]){
      ctx.fillStyle='#fff3b0';ctx.beginPath();ctx.ellipse(H*.22,s*W*.52,W*.24,W*.2*blink,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#14100a';ctx.beginPath();ctx.ellipse(H*.25,s*W*.52,W*.07*(1+track*.8),W*.17*blink,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#ffffff';ctx.globalAlpha=.85;ctx.beginPath();ctx.arc(H*.18,s*W*.52-W*.08,W*.05,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    }
    ctx.fillStyle=pal.dark;for(const s of [-1,1]){ctx.beginPath();ctx.arc(H*.82,s*W*.16,Math.max(.5,W*.05),0,Math.PI*2);ctx.fill();}
    // Forked tongue flicks while idle, and darts out while tracking.
    const flick=still?0:ph==='tracking'?1:((clock+r.index*613)%2900<260?1:0);
    if(flick&&open<.3){
      const L=H*(.85+.25*Math.sin(clock/40));ctx.strokeStyle='#e23a55';ctx.lineWidth=Math.max(.7,cell*.022);
      ctx.beginPath();ctx.moveTo(H*.95,0);ctx.lineTo(H*.95+L,0);ctx.moveTo(H*.95+L,0);ctx.lineTo(H*.95+L+H*.22,-W*.18);ctx.moveTo(H*.95+L,0);ctx.lineTo(H*.95+L+H*.22,W*.18);ctx.stroke();
    }
    ctx.restore();
    const proxy=document.querySelector(`.snake-creature[data-from="${r.from}"]`);
    if(proxy){proxy.dataset.visualScale=growth.toFixed(3);proxy.dataset.visualPhase=ph;}
    if(canvas&&Number(canvas.dataset.activeSnake)===r.from)canvas.dataset.maxScale=String(Math.max(growth,Number(canvas.dataset.maxScale)||1));
  }
  function headPath(H,W){
    ctx.beginPath();ctx.moveTo(-H*.72,0);
    ctx.bezierCurveTo(-H*.72,-W*.95,H*.15,-W*1.08,H*.62,-W*.62);
    ctx.quadraticCurveTo(H*1.02,-W*.3,H*1.02,0);
    ctx.quadraticCurveTo(H*1.02,W*.3,H*.62,W*.62);
    ctx.bezierCurveTo(H*.15,W*1.08,-H*.72,W*.95,-H*.72,0);ctx.closePath();
  }

  function tick(now){
    const delta=Math.min(100,now-last);last=now;
    if(document.hidden||window.BS_PRO?.paused||document.getElementById('game')?.classList.contains('hidden')){frame=requestAnimationFrame(tick);return;}
    clock+=delta;
    if(clock-paintedAt<30){frame=requestAnimationFrame(tick);return;}
    paintedAt=clock;ctx.clearRect(0,0,width,height);
    for(const r of routes)if(r.to>r.from)drawLadder(r);
    for(const r of routes)if(r.to<r.from)drawSnake(r);
    canvas.dataset.frame=String(Math.floor(clock));
    frame=requestAnimationFrame(tick);
  }

  // Pawns: glossy stones by default, characters or crystal on request.
  const PLAYER_COLORS=['#2f86e8','#8b5cf6','#f0b429','#22a565'];
  function crystal(el,player){
    const art=document.documentElement?.dataset?.pieceArt;
    if(art==='characters'||art==='royal'){
      const c=document.createElement('canvas');c.className='crystal-sprite';c.width=144;c.height=180;c.setAttribute('aria-hidden','true');
      if(window.BS_STONES?.draw(c,document.documentElement.dataset.pawn,player)){el.appendChild(c);return c;}
    }
    if(window.BS_PIECES){
      const pawnId=window.BS_PIECES.equipped(),svg=window.BS_PIECES.icon(document,{design:window.BS_PIECES.designFor(pawnId),color:PLAYER_COLORS[player%4],className:'crystal-sprite piece-svg'});
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
  window.BS_ARENA={layout,phase,ladder,crystal,portrait,wait,PLAYER_COLORS};
  if(typeof CustomEvent==='function')window.dispatchEvent?.(new CustomEvent('bs-arena-ready'));
})();
