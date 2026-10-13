/* Detailed raster assets on a continuous tapered body, shared by the games. */
(function(root){
 'use strict';
 const SPECIES=Object.freeze({
  'snake-wild':{kind:'viper',light:'#a7f6c5',mid:'#359477',dark:'#104c42',accent:'#e4d396'},
  'snake-aurora':{kind:'ribbon',light:'#ebccff',mid:'#b077d6',dark:'#4f346c',accent:'#ffbde1'},
  'snake-gold':{kind:'cobra',light:'#ffe9af',mid:'#d4a352',dark:'#6d4b25',accent:'#fffcda'},
  'snake-ice':{kind:'crystal',light:'#dcfbff',mid:'#68bcdd',dark:'#27557b',accent:'#b0f4ff'},
  'snake-toxic':{kind:'dragon',light:'#d3fc85',mid:'#80b82b',dark:'#34531d',accent:'#e5ff90'},
  'snake-plasma':{kind:'plasma',light:'#c6f5ff',mid:'#56bad3',dark:'#574487',accent:'#d3a9ff'}
 });
 const images={},cache=new Map();
 const sources={cobra:'assets/arena/neon-cobra.webp',head:'assets/arena/serpent-head.png',objects:'assets/arena/objects.webp',orb:'assets/arena/pawn-orb.png',crown:'assets/arena/pawn-crown.png',board:'assets/arena/arena-plate.webp',table:'assets/arena/jackaroo-table.webp'};
 const ready=Promise.all(Object.entries(sources).map(([key,src])=>new Promise(resolve=>{const img=new Image();images[key]=img;img.onload=resolve;img.onerror=resolve;img.src=src;})));
 const hues={'snake-wild':-92,'snake-aurora':55,'snake-gold':185,'snake-ice':-15,'snake-toxic':-125,'snake-plasma':28};
 function raster(id,variant=0){
  const key=id+':'+variant;if(cache.has(key))return cache.get(key);if(!images.head.naturalWidth||!images.cobra.naturalWidth)return null;
  const texture=document.createElement('canvas'),face=document.createElement('canvas');texture.width=texture.height=128;face.width=1000;face.height=714;
  for(const [canvas,img,crop]of [[texture,images.cobra,[375,770,100,100]],[face,images.head,[540,0,1244,887]]]){const c=canvas.getContext('2d');c.filter='hue-rotate('+((hues[id]??hues['snake-wild'])+variant*53)+'deg)';c.drawImage(img,...crop,0,0,canvas.width,canvas.height);}
  const art={texture,face};cache.set(key,art);return art;
 }
 const ellipse=(ctx,x,y,rx,ry,color)=>{ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();};
 function gradient(ctx,a,b,colors){const g=ctx.createLinearGradient(a[0],a[1],b[0],b[1]);colors.forEach((c,i)=>g.addColorStop(i/(colors.length-1),c));return g;}
 function head(ctx,id,size=34,variant=0){
  const art=raster(id,variant);if(!art)return;
  ctx.save();ctx.shadowColor='#020e17';ctx.shadowBlur=size*.22;
  ctx.drawImage(art.face,-size*.85,-size*.91,size*2.55,size*1.821);ctx.restore();
 }
 function body(ctx,points,id,r=13,boost=false,variant=0){
  if(points.length<2)return;const p=SPECIES[id]||SPECIES['snake-wild'],art=raster(id,variant),n=points.length;
  const edges=points.map((a,i)=>{const prev=points[Math.max(0,i-1)],next=points[Math.min(n-1,i+1)],dx=prev.x-next.x,dy=prev.y-next.y,d=Math.hypot(dx,dy)||1,w=r*(.08+.92*Math.sqrt(1-i/(n-1)));return {x:a.x,y:a.y,nx:-dy/d,ny:dx/d,w};});
  const outline=()=>{ctx.beginPath();edges.forEach((e,i)=>{const x=e.x+e.nx*e.w,y=e.y+e.ny*e.w;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});for(const e of [...edges].reverse())ctx.lineTo(e.x-e.nx*e.w,e.y-e.ny*e.w);ctx.closePath();};
  ctx.save();outline();ctx.fillStyle=p.dark;ctx.shadowColor='#010b13';ctx.shadowBlur=r*.5;ctx.shadowOffsetY=r*.3;ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.clip();
  let distance=0;
  for(let i=n-1;i>=1;i--){const a=edges[i],b=edges[i-1],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);if(!len)continue;const w=Math.max(a.w,b.w);
   ctx.save();ctx.translate(a.x,a.y);ctx.rotate(Math.atan2(dy,dx));
   if(art){const scale=128/(r*2),sample=len*scale,u=(distance*scale)%128,first=Math.min(sample,128-u),firstW=len*first/sample;ctx.drawImage(art.texture,u,0,first,128,0,-w,firstW+.5,w*2);if(first<sample)ctx.drawImage(art.texture,0,0,sample-first,128,firstW,-w,len-firstW+.5,w*2);}
   else{ctx.fillStyle=p.mid;ctx.fillRect(0,-w,len+1,w*2);}
   const shade=gradient(ctx,[0,-w],[0,w],['#020e1688','#ffffff08','#ffffff38','#030d1688']);ctx.fillStyle=shade;ctx.fillRect(0,-w,len+1,w*2);
   ctx.restore();distance+=len;
  }
  ctx.restore();ctx.save();ctx.lineJoin='round';
  for(const side of [-1,1]){ctx.beginPath();edges.forEach((e,i)=>{const x=e.x+e.nx*e.w*side,y=e.y+e.ny*e.w*side;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.strokeStyle=side===1?p.light+'88':p.mid+'77';ctx.lineWidth=.85;ctx.stroke();}
  if(boost){ctx.globalAlpha=.25;ctx.strokeStyle=p.accent;ctx.lineWidth=r*2.6;ctx.shadowColor=p.accent;ctx.shadowBlur=r;ctx.beginPath();points.forEach((a,i)=>i?ctx.lineTo(a.x,a.y):ctx.moveTo(a.x,a.y));ctx.stroke();}ctx.restore();
 }
 function serpent(ctx,id,time){
  const p=SPECIES[id]||SPECIES['snake-wild'],pts=Array.from({length:77},(_,i)=>{const t=i/76;return {x:455-t*345,y:150+Math.sin(t*Math.PI*3.7+time*.6)*(40+t*35)+Math.cos(t*8)*8};});
  ctx.save();ctx.translate(0,18);ctx.shadowColor=p.dark;ctx.shadowBlur=10;body(ctx,pts,id,19);ctx.shadowBlur=0;ctx.translate(pts[0].x,pts[0].y);ctx.rotate(Math.atan2(pts[0].y-pts[1].y,pts[0].x-pts[1].x));head(ctx,id,p.kind==='cobra'?49:36);ctx.restore();
 }
 function die(ctx,item){
  const color=item.color||'#decdaa';ctx.save();ctx.translate(295,180);ctx.rotate(-.18);
  ctx.beginPath();ctx.moveTo(-65,-64);ctx.lineTo(21,-96);ctx.lineTo(92,-48);ctx.lineTo(13,-16);ctx.closePath();ctx.fillStyle=gradient(ctx,[-65,-90],[75,-16],['#fff1dc',color]);ctx.fill();
  ctx.beginPath();ctx.moveTo(-65,-64);ctx.lineTo(13,-16);ctx.lineTo(13,93);ctx.lineTo(-65,43);ctx.closePath();ctx.fillStyle=gradient(ctx,[-65,-40],[18,95],[color,'#061323']);ctx.fill();
  ctx.beginPath();ctx.moveTo(13,-16);ctx.lineTo(92,-48);ctx.lineTo(92,60);ctx.lineTo(13,93);ctx.closePath();ctx.fillStyle=gradient(ctx,[90,-45],[13,91],['#ffffff',color]);ctx.fill();
  const dark=['dice-midnight','dice-nebula','dice-ruby'].includes(item.id)?'#f2e2c7':'#182734';
  for(const [x,y]of [[36,7],[72,-7],[36,58],[72,44],[54,26]])ellipse(ctx,x,y,5,7,dark);for(const [x,y]of [[-40,-29],[-10,26]])ellipse(ctx,x,y,5,7,dark);
  for(const [x,y]of [[-18,-57],[15,-69],[40,-47]])ellipse(ctx,x,y,7,4,'#172331');ctx.restore();
 }
 function paintPawn(canvas,id,player=0){
  if(root.BS_STONES?.draw(canvas,id,player))return;
  const ctx=canvas.getContext('2d');if(!ctx)return;ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
  if(['pawn-orb','pawn-crown'].includes(id)){ctx.filter=player===1?'hue-rotate(62deg)':player===2?'hue-rotate(155deg)':player===3?'hue-rotate(-105deg)':'none';const img=images[id==='pawn-orb'?'orb':'crown'];if(img.naturalWidth){const size=Math.min(canvas.width,canvas.height);ctx.drawImage(img,0,0,img.naturalWidth,img.naturalHeight,(canvas.width-size)/2,(canvas.height-size)/2,size,size);}return;}
  ctx.filter=player===2||player===3?'hue-rotate(-150deg)':'none';if(images.objects.naturalWidth)ctx.drawImage(images.objects,player%2?1400:785,60,480,690,0,0,canvas.width,canvas.height);
 }
 function pawn(ctx,item){
  if(root.BS_STONES){const c=document.createElement('canvas');if(root.BS_STONES.draw(c,item.id,({'pawn-amethyst':1,'pawn-gold':2,'pawn-jade':3}[item.id]||0))){ctx.drawImage(c,192,20,216,300);return;}}
  if(['pawn-orb','pawn-crown'].includes(item.id)){const img=images[item.id==='pawn-orb'?'orb':'crown'];if(img.naturalWidth)ctx.drawImage(img,0,0,img.naturalWidth,img.naturalHeight,158,32,284,284);return;}
  const player={'pawn-amethyst':1,'pawn-gold':2,'pawn-jade':3}[item.id]||0;ctx.save();ctx.filter=(player===2||player===3?'hue-rotate(-150deg) ':'')+(root.BS_CAREER_CORE?.COSMETIC_STYLES?.[item.id]?.['--pawn-look']||'none');
  if(images.objects.naturalWidth)ctx.drawImage(images.objects,player%2?1400:785,60,480,690,200,28,200,288);ctx.restore();
 }
 function board(ctx,item,table){
  const img=images[table?'table':'board'];if(!img.naturalWidth)return;ctx.save();ctx.filter=root.BS_CAREER_CORE?.COSMETIC_STYLES?.[item.id]?.[table?'--table-look':'--arena-board-filter']||'none';
  const ratio=Math.min(480/img.naturalWidth,310/img.naturalHeight),w=img.naturalWidth*ratio,h=img.naturalHeight*ratio;ctx.drawImage(img,(600-w)/2,(360-h)/2,w,h);ctx.restore();
 }
 function paint(canvas,item,time=0){
  const ctx=canvas.getContext('2d');if(!ctx)return;ctx.setTransform(canvas.width/600,0,0,canvas.height/360,0,0);ctx.clearRect(0,0,600,360);
  if(item.type==='snake')serpent(ctx,item.id,time);
  else if(item.type==='dice')die(ctx,item);
  else if(item.type==='pawn')pawn(ctx,item);
  else if(item.type==='board'||item.type==='table')board(ctx,item,item.type==='table');
  else if(item.type==='trail'){const color=item.color||'#81dfff';for(let i=0;i<24;i++){const t=i/23,x=130+t*345,y=230-90*t+Math.sin(t*5+time)*30;ellipse(ctx,x,y,3+t*13,3+t*13,color+Math.floor(30+t*200).toString(16).padStart(2,'0'));}ellipse(ctx,468,147,22,22,'#fff4db');}
  else if(item.type==='victory'){ctx.fillStyle=item.color;ctx.textAlign='center';ctx.font='92px serif';ctx.fillText(item.id==='victory-royal'?'♛':item.id==='victory-aurora'?'✧':'✦',300,228);for(let i=0;i<12;i++){const a=i*Math.PI/6,r=82+i%3*12;ellipse(ctx,300+Math.cos(a)*r,170+Math.sin(a)*r,3,3,item.color);}}
  else{ctx.strokeStyle=item.color;ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(130,128,340,95,15);ctx.stroke();ctx.fillStyle=item.color;ctx.font='700 31px sans-serif';ctx.textAlign='center';ctx.fillText(item.name,300,185,315);}
 }
 function mount(el,item,{live=false}={}){
  const canvas=document.createElement('canvas');canvas.width=840;canvas.height=504;canvas.dataset.species=SPECIES[item.id]?.kind||item.type;canvas.setAttribute('aria-hidden','true');el.appendChild(canvas);paint(canvas,item);
  ready.then(()=>paint(canvas,item));
  if(live&&!root.matchMedia?.('(prefers-reduced-motion: reduce)').matches){let previous=0;const tick=now=>{if(!canvas.isConnected)return;if(!document.hidden&&canvas.getClientRects().length&&now-previous>60){paint(canvas,item,now/1000);previous=now;}root.requestAnimationFrame(tick);};root.requestAnimationFrame(tick);}
  return canvas;
 }
 root.BS_COSMETIC_ART={SPECIES,head,body,mount,paint,paintPawn,ready};
})(window);
