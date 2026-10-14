import {snakeGeometry} from './arena-geometry.js?v=13.4.0';
import {recolorBluePixels,ARENA_HUES,cosmeticSnakeHue} from './arena-palette.js?v=13.4.0';
/* Creature heads keep their proportions. Real painted scales follow a
   tapered body mesh between the rule engine's head and tail cells. */
(function(){
 'use strict';
 const cobra=new Image(),objects=new Image();
 cobra.src='assets/arena/neon-cobra.webp';objects.src='assets/arena/objects.webp';
 const plate=new Image();plate.src='assets/arena/arena-plate.webp';
 const snakes=new Map(),ladders=new Map(),skins=new Map();let canvas,ctx,routes=[],width=0,height=0,clock=0,last=0,frame=0,paintedAt=0;
 const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 const ease=t=>Math.sin(Math.max(0,Math.min(1,t))*Math.PI);
 function skin(hue,id){
  const key=hue+':'+(id||'snake-wild');if(skins.has(key))return skins.get(key);
  function sprite(x,y,w,h,dw,dh){
   const c=document.createElement('canvas');c.width=dw;c.height=dh;const paint=c.getContext('2d');
   paint.drawImage(cobra,x,y,w,h,0,0,dw,dh);
   const pixels=paint.getImageData(0,0,dw,dh);recolorBluePixels(pixels.data,hue);paint.putImageData(pixels,0,0);return c;
  }
  const result={texture:sprite(375,770,100,100,128,128),head:sprite(285,10,610,480,610,480)};
  skins.set(key,result);return result;
 }
 function layout(entries){
  const board=document.getElementById('board');if(!board)return;
  const game=document.getElementById('game');if(game&&!game.querySelector?.('.arena-frame')){const background=document.createElement('img');background.className='arena-frame';background.src=plate.src;background.alt='';background.setAttribute('aria-hidden','true');game.prepend?.(background);}
  if(!canvas){canvas=document.createElement('canvas');canvas.className='arena-live-creatures';canvas.setAttribute('aria-hidden','true');document.getElementById('boardWrap').appendChild(canvas);ctx=canvas.getContext('2d',{alpha:true});}
  const dpr=Math.min(devicePixelRatio||1,2),r=board.getBoundingClientRect();width=r.width;height=r.height;
  canvas.width=Math.ceil(width*dpr);canvas.height=Math.ceil(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
  routes=entries.map((route,index)=>({...route,index,a:{x:route.a.x*width/1000,y:route.a.y*height/1000},b:{x:route.b.x*width/1000,y:route.b.y*height/1000}}));
  canvas.dataset.snakes=routes.filter(r=>r.to<r.from).length;canvas.dataset.ladders=routes.filter(r=>r.to>r.from).length;
  canvas.dataset.assets=[cobra,objects,plate].every(img=>img.complete&&img.naturalWidth)?'ready':'loading';
  if(!frame){last=performance.now();frame=requestAnimationFrame(tick)}
 }
 function phase(from,value){const entry=snakes.get(Number(from))||{};entry.phase=value||'idle';entry.at=clock;snakes.set(Number(from),entry);if(canvas){if(value==='tracking'){canvas.dataset.history='';canvas.dataset.maxScale='1';}canvas.dataset.phase=entry.phase;canvas.dataset.activeSnake=from;canvas.dataset.history=(canvas.dataset.history?canvas.dataset.history+',':'')+entry.phase;} }
 function ladder(from,value){ladders.set(Number(from),{phase:value||'idle',at:clock})}
 function drawTravelCue(points,origin,target,active,progress=0){
  if(!active)return;
  ctx.save();ctx.strokeStyle='#f5dfa0';ctx.lineWidth=width*.004;ctx.shadowColor='#d9bd6b';ctx.shadowBlur=width*.014;ctx.globalAlpha=.75;
  ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();
  for(const p of [origin,target]){const size=width*.024;ctx.beginPath();ctx.moveTo(p.x,p.y-size);ctx.lineTo(p.x+size,p.y);ctx.lineTo(p.x,p.y+size);ctx.lineTo(p.x-size,p.y);ctx.closePath();ctx.stroke();}
  const dot=points[Math.min(points.length-1,Math.floor(Math.max(0,Math.min(1,progress))*(points.length-1)))],size=width*.012;
  ctx.fillStyle='#fff5cf';ctx.beginPath();ctx.moveTo(dot.x,dot.y-size);ctx.lineTo(dot.x+size,dot.y);ctx.lineTo(dot.x,dot.y+size);ctx.lineTo(dot.x-size,dot.y);ctx.closePath();ctx.fill();ctx.restore();
 }
 function drawLadder(r){
  if(!objects.complete||!objects.naturalWidth)return;
  const dx=r.b.x-r.a.x,dy=r.b.y-r.a.y,len=Math.hypot(dx,dy),w=width*.052,s=ladders.get(r.from),active=s&&s.phase!=='idle';
  ctx.save();ctx.translate(r.a.x,r.a.y);ctx.rotate(Math.atan2(dy,dx)+Math.PI/2);
  // Rails, rungs and anchors are drawn independently: short and long routes
  // keep the same rung thickness instead of stretching a complete ladder.
  ctx.shadowColor='#02080de0';ctx.shadowBlur=width*.012;ctx.shadowOffsetX=width*.003;ctx.shadowOffsetY=width*.006;
  const rail=w*.21;
  ctx.drawImage(objects,318,20,40,728,-w/2,-len,rail,len);
  ctx.drawImage(objects,518,20,40,728,w/2-rail,-len,rail,len);
  ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
  const count=Math.max(3,Math.round(len/(width*.026))),gap=len/(count+1),travel=active?((clock-s.at)/1200)%1:-1;
  for(let i=1;i<=count;i++){
   const y=-i*gap,lit=active&&Math.abs(i/(count+1)-travel)<.13;
   ctx.save();if(lit){ctx.shadowColor='#91faff';ctx.shadowBlur=width*.018;}
   ctx.drawImage(objects,354,67,162,36,-w/2+rail*.55,y-width*.003,w-rail*1.1,width*.0085);ctx.restore();
  }
  for(const y of [-len,0]){ctx.drawImage(objects,305,5,264,48,-w*.56,y-width*.004,w*1.12,width*.0095);}
  ctx.restore();
 }
 function drawSnake(r){
  if(!cobra.complete||!cobra.naturalWidth)return;
  const state=snakes.get(r.from)||{phase:'idle',at:0},elapsed=clock-state.at,phase=state.phase;
  const shape=snakeGeometry(r.a,r.b,{width,height},{time:clock,seed:r.index,motion:!reduce(),route:r.from});
  const cosmetic=document.documentElement.dataset.snake;
  const hue=cosmeticSnakeHue(cosmetic,r.from),art=skin(hue,cosmetic);
  const growth=phase==='digesting'?1+.24*ease(elapsed/900):phase==='releasing'?1+.10*(1-Math.min(1,elapsed/550)):1;
  const swallow=phase==='swallowing'?Math.min(1,elapsed/900):-1;
  const points=shape.points;
  drawTravelCue(points,shape.head,r.b,phase!=='idle',reduce()?0:Math.min(1,elapsed/(phase==='swallowing'?900:1600)));
  // Tapered mesh with metallic lighting and the creature artwork's real scales.
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  const segments=[];
  for(let i=points.length-2;i>=0;i--){
   const a=points[i],b=points[i+1],t=i/(points.length-1),dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
   const bulge=swallow<0?0:.48*Math.exp(-Math.pow((t-swallow)/.10,2));
   const taper=t<.74?1-.15*(t/.74):.08+.77*Math.pow((1-t)/.26,.72);
   const rad=shape.radius*taper*(growth+bulge);
   segments.push({a,b,t,rad,nx,ny,dx,dy,len,i});
   ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineWidth=rad*2+1.2;ctx.strokeStyle='#050912';ctx.stroke();
  }
  const ordered=[...segments].reverse(),texture=art.texture;
  ctx.save();ctx.shadowColor=`hsl(${hue} 100% 58%)`;ctx.shadowBlur=width*.014;
  ctx.fillStyle=`hsla(${hue} 100% 56% / .48)`;ctx.beginPath();
  ordered.forEach(({a,rad,nx,ny},i)=>{const x=a.x+nx*rad,y=a.y+ny*rad;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});
  const lastSegment=ordered.at(-1);ctx.lineTo(lastSegment.b.x,lastSegment.b.y);
  for(const {a,rad,nx,ny} of segments)ctx.lineTo(a.x-nx*rad,a.y-ny*rad);
  ctx.closePath();ctx.fill();ctx.restore();
  for(const {a,b,rad,nx,ny} of segments){
   const shade=ctx.createLinearGradient(a.x-nx*rad,a.y-ny*rad,a.x+nx*rad,a.y+ny*rad);
   shade.addColorStop(0,`hsl(${hue} 76% 9%)`);shade.addColorStop(.22,`hsl(${hue} 85% 23%)`);shade.addColorStop(.45,`hsl(${hue} 88% 41%)`);shade.addColorStop(.59,`hsl(${hue} 92% 54%)`);shade.addColorStop(.74,`hsl(${hue} 80% 26%)`);shade.addColorStop(1,`hsl(${hue} 76% 9%)`);
   ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineWidth=rad*2;ctx.strokeStyle=shade;ctx.stroke();
  }
  ctx.save();ctx.beginPath();
  ordered.forEach(({a,rad,nx,ny},i)=>{const x=a.x+nx*rad,y=a.y+ny*rad;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});
  const tip=ordered.at(-1);ctx.lineTo(tip.b.x,tip.b.y);
  for(const {a,rad,nx,ny} of segments)ctx.lineTo(a.x-nx*rad,a.y-ny*rad);
  ctx.closePath();ctx.clip();ctx.globalAlpha=.92;
  let distance=0;
  for(const {a,rad,dx,dy,len} of ordered){
   const scale=128/(shape.radius*2),sample=len*scale,u=(distance*scale)%128;
   ctx.save();ctx.translate(a.x,a.y);ctx.rotate(Math.atan2(dy,dx));
   const first=Math.min(sample,128-u),firstWidth=len*first/sample;
   ctx.drawImage(texture,u,0,first,128,0,-rad,firstWidth+.35,rad*2);
   if(first<sample)ctx.drawImage(texture,0,0,sample-first,128,firstWidth,-rad,len-firstWidth+.35,rad*2);
   ctx.restore();distance+=len;
  }
  ctx.restore();
  // Narrow emissive rims keep the armor dark and detailed while its
  // silhouette remains visible at phone size, including the tapered tail.
  ctx.save();ctx.globalCompositeOperation='screen';ctx.shadowColor=`hsl(${hue} 100% 58%)`;ctx.shadowBlur=width*.004;
  for(const side of [1,-1]){
   ctx.strokeStyle=`hsla(${hue} 100% 70% / ${side===1?.8:.4})`;ctx.lineWidth=width*(side===1?.0021:.0014);
   ctx.beginPath();ordered.forEach(({a,rad,nx,ny},i)=>{const x=a.x+nx*rad*side,y=a.y+ny*rad*side;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});
   ctx.lineTo(tip.b.x,tip.b.y);ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle=`hsla(${hue} 100% 78% / .22)`;ctx.lineWidth=.6;
  ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();
  // The source head keeps its original proportions, regardless of fall length.
  const strike=phase==='attacking'?ease(elapsed/360):0,track=phase==='tracking'?ease(elapsed/380):0;
  const shake=phase==='digesting'?Math.sin(elapsed/45)*width*.0025:0;
  const hw=shape.headWidth*(1+(growth-1)*.35),hh=hw*480/610;
  ctx.translate(shape.head.x+shape.side*strike*hw*.14+shake,shape.head.y-track*hh*.025);
  ctx.rotate((shape.side===1?-.025:.025)+strike*shape.side*.085);ctx.scale(shape.side,1);
  ctx.shadowColor=`hsl(${hue} 100% 60%)`;ctx.shadowBlur=width*.01;
  ctx.drawImage(art.head,0,0,610,480,-hw*.68,-hh*.52,hw,hh);
  ctx.restore();
  const proxy=document.querySelector(`.snake-creature[data-from="${r.from}"]`);if(proxy){proxy.dataset.visualScale=growth.toFixed(3);proxy.dataset.visualPhase=phase;}
  if(canvas&&Number(canvas.dataset.activeSnake)===r.from)canvas.dataset.maxScale=String(Math.max(growth,Number(canvas.dataset.maxScale)||1));
 }
 function phaseReset(from){phase(from,null)}
 function tick(now){
  const delta=Math.min(100,now-last);last=now;
  if(document.hidden||window.BS_PRO?.paused||document.getElementById('game')?.classList.contains('hidden')){frame=requestAnimationFrame(tick);return;}
  clock+=delta;
  if(clock-paintedAt<30){frame=requestAnimationFrame(tick);return;}paintedAt=clock;
  ctx.clearRect(0,0,width,height);
  canvas.dataset.assets=[cobra,objects,plate].every(img=>img.complete&&img.naturalWidth)?'ready':'loading';
  for(const r of routes)if(r.to>r.from)drawLadder(r);
  for(const r of routes)if(r.to<r.from)drawSnake(r);
  canvas.dataset.frame=String(Math.floor(clock));frame=requestAnimationFrame(tick);
 }
 function crystal(el,player){
  const c=document.createElement('canvas');c.className='crystal-sprite';c.width=144;c.height=180;c.setAttribute('aria-hidden','true');
  if(window.BS_STONES?.draw(c,document.documentElement.dataset.pawn,player)){el.appendChild(c);return c;}
  const paint=()=>{const pawn=document.documentElement.dataset.pawn;if(['pawn-orb','pawn-crown'].includes(pawn)&&window.BS_COSMETIC_ART){window.BS_COSMETIC_ART.ready.then(()=>window.BS_COSMETIC_ART.paintPawn(c,pawn,player));return;}const context=c.getContext('2d');context.clearRect(0,0,144,180);context.filter=player===2||player===3?'hue-rotate(-150deg)':'none';context.drawImage(objects,player%2?1400:785,60,480,690,0,0,144,180)};
  objects.complete&&objects.naturalWidth?paint():objects.addEventListener('load',paint,{once:true});el.appendChild(c);return c;
 }
 // A rendering frame can be throttled by a browser. Game completion uses a
 // pause-aware timer, so it does not depend on the canvas drawing a frame.
 function wait(ms){return new Promise(resolve=>{
  let remaining=ms,started=0,timer=null;
  const clear=()=>{if(timer!==null){clearTimeout(timer);timer=null;remaining=Math.max(0,remaining-(performance.now()-started));}};
  const finish=()=>{window.removeEventListener('bs-match-pause',sync);resolve()};
  const sync=()=>{clear();if(window.BS_PRO?.paused)return;started=performance.now();timer=setTimeout(finish,remaining)};
  window.addEventListener('bs-match-pause',sync);sync();
 })}
 function portrait(el,id,from=id==='snake-plasma'?95:99){
  const c=document.createElement('canvas');c.width=360;c.height=283;c.setAttribute('aria-hidden','true');
  const paint=()=>c.getContext('2d').drawImage(skin(cosmeticSnakeHue(id,from),id).head,0,0,360,283);
  cobra.complete&&cobra.naturalWidth?paint():cobra.addEventListener('load',paint,{once:true});el.appendChild(c);return c;
 }
 window.BS_ARENA={layout,phase,ladder,crystal,portrait,wait};
 if(typeof CustomEvent==='function')window.dispatchEvent?.(new CustomEvent('bs-arena-ready'));
})();
