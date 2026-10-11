/* Raster creatures are drawn independently of the empty arena texture.
   Strip deformation bends the actual scales and carries a swallowed-pawn
   bulge down the body. The rules and unbiased die remain in the game engine. */
(function(){
 'use strict';
 const cobra=new Image(),objects=new Image();
 cobra.src='assets/arena/neon-cobra.png';objects.src='assets/arena/objects.png';
 const plate=new Image();plate.src='assets/arena/arena-plate.png';
 const snakes=new Map(),ladders=new Map();let canvas,ctx,routes=[],width=0,height=0,clock=0,last=0,frame=0,paintedAt=0;
 const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 const palettes=[145,65,0,-165,75,-95,100,-20];
 const ease=t=>Math.sin(Math.max(0,Math.min(1,t))*Math.PI);
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
 function drawLadder(r){
  if(!objects.complete||!objects.naturalWidth)return;
  const dx=r.b.x-r.a.x,dy=r.b.y-r.a.y,len=Math.hypot(dx,dy),w=width*.058,s=ladders.get(r.from),active=s&&s.phase!=='idle';
  ctx.save();ctx.translate(r.a.x,r.a.y);ctx.rotate(Math.atan2(dy,dx)+Math.PI/2);
  if(active){ctx.shadowColor='#4be9ff';ctx.shadowBlur=8;ctx.globalAlpha=.86+.14*Math.sin(clock/85);}
  ctx.drawImage(objects,294,0,292,768,-w/2,-len,w,len);ctx.restore();
 }
 function drawSnake(r){
  if(!cobra.complete||!cobra.naturalWidth)return;
  const state=snakes.get(r.from)||{phase:'idle',at:0},elapsed=clock-state.at,phase=state.phase;
  const dx=r.b.x-r.a.x,dy=r.b.y-r.a.y,rawLength=Math.hypot(dx,dy),bias=Math.min(height*.02,rawLength*.08),length=rawLength-bias,bodyWidth=Math.min(width*.21,Math.max(width*.16,length*.32)),headHeight=bodyWidth*.65;
  let growth=1,shake=0,headLunge=0,swallow=-1;
  if(phase==='tracking'){headLunge=ease(elapsed/400)*bodyWidth*.06;}
  if(phase==='attacking'){headLunge=ease(elapsed/360)*bodyWidth*.28;growth=1+ease(elapsed/360)*.15;}
  if(phase==='swallowing'){swallow=Math.min(.99,elapsed/900);growth=1.04;}
  if(phase==='digesting'){growth=1+.46*ease(elapsed/900);shake=Math.sin(elapsed*.04)*.065;}
  if(phase==='releasing'){growth=1+.12*(1-Math.min(1,elapsed/550));shake=Math.sin(elapsed*.03)*.025*(1-Math.min(1,elapsed/550));}
  if(phase==='inspect'){growth=1+.12*ease(elapsed/650);headLunge=ease(elapsed/650)*bodyWidth*.12;if(elapsed>650)phaseReset(r.from);}
  ctx.save();ctx.translate(r.a.x,r.a.y);ctx.rotate(Math.atan2(dy,dx)-Math.PI/2+shake);ctx.translate(0,bias);
  const cosmetic=document.documentElement.dataset.snake,hue=cosmetic==='snake-gold'?-170:cosmetic==='snake-aurora'?65:cosmetic==='snake-ice'?0:({17:145,54:-25,62:0,64:-170,87:65,93:-95,95:75,99:-10}[r.from]??palettes[r.index%palettes.length]);
  ctx.filter=`hue-rotate(${hue}deg)`;
  // Head is a separate deformable region: its jaw stretches during strike.
  // Body retains the winding S silhouette of the high-resolution source.
  const sourceH=cobra.naturalHeight,sourceW=cobra.naturalWidth,strips=64,step=sourceH/strips;
  for(let i=0;i<strips;i++){
   const sy=i*step,t=sy/sourceH,tailT=Math.max(0,(sy-500)/(sourceH-500));
   const ypos=v=>{let y=v<=500?(v-300)/500*headHeight:headHeight*.4+(v-500)/(sourceH-500)*(length-headHeight*.4);if(v<500){y-=headLunge;if(phase==='attacking'&&v>220)y+=(v-220)/280*headHeight*.12*ease(elapsed/360);}return y;};
   const y=ypos(sy),ny=ypos(sy+step);
   const head=sy<500,center=sy<500?750:750-200*tailT;
   const idleWave=reduce()?0:Math.sin(clock/680+t*11+r.index)*bodyWidth*.023*Math.sin(Math.PI*t);
   const belly=swallow<0?0:Math.exp(-Math.pow((tailT-swallow)/.13,2))*.65;
   let scale=(growth+belly)*(head?1+.45*(sy<=300?1:(500-sy)/200):1);
   const w=bodyWidth*scale,x=-center/sourceW*w+idleWave;
   ctx.drawImage(cobra,0,sy,sourceW,Math.min(step+1,sourceH-sy),x,y,w,Math.max(1,ny-y+1));
  }
  ctx.restore();
  const proxy=document.querySelector(`.snake-creature[data-from="${r.from}"]`);if(proxy){proxy.dataset.visualScale=growth.toFixed(3);proxy.dataset.visualPhase=phase;}
  if(canvas&&Number(canvas.dataset.activeSnake)===r.from)canvas.dataset.maxScale=String(Math.max(growth,Number(canvas.dataset.maxScale)||1));
 }
 function phaseReset(from){phase(from,null)}
 function tick(now){
  const delta=Math.min(50,now-last);last=now;
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
  const paint=()=>{const context=c.getContext('2d');context.clearRect(0,0,144,180);context.filter=player===2||player===3?'hue-rotate(-150deg)':'none';context.drawImage(objects,player%2?1400:785,60,480,690,0,0,144,180)};
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
 window.BS_ARENA={layout,phase,ladder,crystal,wait};
})();
