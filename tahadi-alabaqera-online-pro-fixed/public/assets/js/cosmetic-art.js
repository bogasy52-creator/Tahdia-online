/* Canvas-native collectible art, shared by the vault and the actual games. */
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
 const ellipse=(ctx,x,y,rx,ry,color)=>{ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();};
 function gradient(ctx,a,b,colors){const g=ctx.createLinearGradient(a[0],a[1],b[0],b[1]);colors.forEach((c,i)=>g.addColorStop(i/(colors.length-1),c));return g;}
 function head(ctx,id,size=34){
  const p=SPECIES[id]||SPECIES['snake-wild'];ctx.save();ctx.scale(size/34,size/34);ctx.lineJoin='round';
  if(p.kind==='cobra'){
   ctx.beginPath();ctx.moveTo(2,-18);ctx.bezierCurveTo(-44,-52,-57,-15,-44,26);ctx.quadraticCurveTo(-30,52,-8,28);ctx.quadraticCurveTo(21,40,27,4);ctx.quadraticCurveTo(14,-12,2,-18);ctx.fillStyle=gradient(ctx,[-45,-35],[20,40],[p.dark,p.mid,p.light,p.mid]);ctx.fill();ctx.strokeStyle=p.light;ctx.lineWidth=1;ctx.stroke();
   for(let i=0;i<6;i++){ctx.beginPath();ctx.moveTo(-34+i*8,-18);ctx.lineTo(-35+i*8,18);ctx.strokeStyle='#613e2655';ctx.lineWidth=3;ctx.stroke();}
  }
  if(p.kind==='ribbon')for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(-12,side*8);ctx.bezierCurveTo(-62,side*58,-47,side*40,-5,side*21);ctx.fillStyle=p.accent+'99';ctx.fill();ctx.strokeStyle=p.light;ctx.lineWidth=1.4;ctx.stroke();}
  if(p.kind==='crystal'||p.kind==='dragon')for(let i=0;i<3;i++)for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(-25+i*11,side*12);ctx.lineTo(-29+i*10,side*(29-i*3));ctx.lineTo(-13+i*10,side*14);ctx.fillStyle=i%2?p.mid:p.light;ctx.fill();}
  ctx.beginPath();ctx.moveTo(-30,0);ctx.quadraticCurveTo(-14,-23,10,-20);ctx.quadraticCurveTo(31,-17,38,-5);ctx.quadraticCurveTo(47,0,35,10);ctx.quadraticCurveTo(12,27,-18,13);ctx.closePath();
  ctx.fillStyle=gradient(ctx,[0,-22],[0,22],[p.light,p.mid,p.dark]);ctx.fill();ctx.strokeStyle=p.dark;ctx.lineWidth=1.5;ctx.stroke();
  if(p.kind==='crystal'){ctx.beginPath();ctx.moveTo(-15,-12);ctx.lineTo(18,-17);ctx.lineTo(2,5);ctx.closePath();ctx.fillStyle='#ffffff48';ctx.fill();}
  if(p.kind==='plasma'){ctx.shadowColor=p.accent;ctx.shadowBlur=10;ellipse(ctx,-2,-15,10,2,p.accent);ctx.shadowBlur=0;}
  for(const side of [-1,1]){ellipse(ctx,17,side*10,6,4,'#07131b');ellipse(ctx,18,side*10,3.5,2.6,p.accent);ellipse(ctx,20,side*10,1,1,'#fff');}
  ctx.beginPath();ctx.moveTo(27,4);ctx.quadraticCurveTo(39,7,37,1);ctx.strokeStyle=p.dark;ctx.lineWidth=1.8;ctx.stroke();
  ctx.beginPath();ctx.moveTo(36,2);ctx.lineTo(52,2);ctx.lineTo(58,-3);ctx.moveTo(52,2);ctx.lineTo(58,6);ctx.strokeStyle='#e593aa';ctx.lineWidth=1.3;ctx.stroke();ctx.restore();
 }
 function body(ctx,points,id,r=13,boost=false){
  const p=SPECIES[id]||SPECIES['snake-wild'];ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  for(let i=points.length-1;i>=1;i--){const a=points[i],b=points[i-1],t=1-i/points.length,w=r*(.25+.75*Math.sqrt(t));
   ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=p.dark;ctx.lineWidth=w*2+3;ctx.stroke();
   ctx.strokeStyle=gradient(ctx,[a.x-w,a.y-w],[a.x+w,a.y+w],[p.dark,p.mid,p.light,p.mid]);ctx.lineWidth=w*2;ctx.stroke();
   if(i%3===0){ctx.save();ctx.translate(a.x,a.y);ctx.rotate(Math.atan2(b.y-a.y,b.x-a.x));
    if(p.kind==='crystal'){ctx.beginPath();ctx.moveTo(-4,-w);ctx.lineTo(5,0);ctx.lineTo(-4,w);ctx.fillStyle='#d5f6ff44';ctx.fill();}
    else if(p.kind==='dragon'){ctx.beginPath();ctx.moveTo(-4,-w*.65);ctx.lineTo(2,-w*1.65);ctx.lineTo(6,-w*.4);ctx.fillStyle=p.light;ctx.fill();}
    else if(p.kind==='plasma'){ctx.strokeStyle=p.accent;ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(0,0,3,w,0,0,Math.PI*2);ctx.stroke();}
    else if(p.kind==='ribbon'){ctx.strokeStyle=p.accent;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-3,-w*.4);ctx.lineTo(2,w*.4);ctx.stroke();}
    else{ellipse(ctx,0,0,w*.22,w*.7,p.dark+'88');ellipse(ctx,1,-w*.45,w*.17,w*.12,p.light+'bb');}ctx.restore();
   }
  }
  if(boost){ctx.globalAlpha=.35;ctx.strokeStyle=p.accent;ctx.lineWidth=r*3.4;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();}
  ctx.restore();
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
 function pawn(ctx,item){
  const color=item.color||'#9edae2';ellipse(ctx,300,259,92,21,'#07111a');ellipse(ctx,300,243,82,24,'#3d5268');ellipse(ctx,300,236,77,22,'#142d3a');ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(300,236,69,17,0,0,Math.PI*2);ctx.stroke();
  const sides=item.id==='pawn-onyx'?5:item.id==='pawn-prism'?8:6,top={x:300,y:75};for(let i=0;i<sides;i++){const x=300+Math.cos(i*Math.PI*2/sides)*47,y=175+Math.sin(i*Math.PI*2/sides)*21,x2=300+Math.cos((i+1)*Math.PI*2/sides)*47,y2=175+Math.sin((i+1)*Math.PI*2/sides)*21;ctx.beginPath();ctx.moveTo(top.x,top.y);ctx.lineTo(x,y);ctx.lineTo(300,229);ctx.lineTo(x2,y2);ctx.closePath();ctx.fillStyle=gradient(ctx,[x,100],[x2,230],i%2?[color,'#1c3640']:['#faf2de',color]);ctx.fill();ctx.strokeStyle='#d2efed50';ctx.lineWidth=1;ctx.stroke();}
  if(item.id==='pawn-gold'){ctx.strokeStyle='#fff0b2';ctx.lineWidth=3;ctx.beginPath();ctx.arc(300,154,66,0,Math.PI*2);ctx.stroke();}
 }
 function board(ctx,item,table){
  const palettes={'board-forest':['#263f3c','#506c59'],'board-ocean':['#162f45','#42799b'],'board-sand':['#6b5140','#c9a474'],'board-twilight':['#312b49','#897ca6'],'board-royal':['#ad8952','#e8d7ab'],'board-cyber':['#193e49','#408592']},colors=palettes[item.id]||['#273444',item.color||'#5d9d86'];
  ctx.save();ctx.translate(300,170);ctx.scale(1,.65);ctx.rotate(-.18);ctx.fillStyle='#071018';ctx.fillRect(-170,-170,340,365);ctx.fillStyle=item.color;ctx.fillRect(-170,-170,340,340);ctx.fillStyle='#091726';ctx.fillRect(-151,-151,302,302);
  if(!table){for(let y=0;y<6;y++)for(let x=0;x<6;x++){ctx.fillStyle=colors[(x+y)%2];ctx.fillRect(-141+x*47,-141+y*47,44,44);}ctx.strokeStyle=colors[1];ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(-85,90);ctx.bezierCurveTo(15,70,-20,-70,86,-95);ctx.stroke();}
  else{for(let i=0;i<4;i++){ctx.save();ctx.rotate(i*Math.PI/2);for(let j=0;j<14;j++){ctx.beginPath();ctx.arc(-112+j*17,-85,5,0,Math.PI*2);ctx.fillStyle=j===0?'#dbbd83':'#d1c5ad';ctx.fill();}for(let j=0;j<4;j++)ellipse(ctx,-76+j*16,-42,6,6,['#eb9a91','#aa9ff5','#91d5b0','#e7c486'][i]);ctx.restore();}ellipse(ctx,0,0,30,30,'#142333');ctx.fillStyle='#e5c88b';ctx.font='700 16px serif';ctx.textAlign='center';ctx.fillText('BS',0,5);}
  ctx.restore();
 }
 function paint(canvas,item,time=0){
  const ctx=canvas.getContext('2d');if(!ctx)return;ctx.setTransform(canvas.width/600,0,0,canvas.height/360,0,0);ctx.clearRect(0,0,600,360);
  ctx.save();ctx.globalAlpha=.14;ellipse(ctx,300,205,180,91,item.color||'#7abfa3');ctx.restore();
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
  if(live&&!root.matchMedia?.('(prefers-reduced-motion: reduce)').matches){let previous=0;const tick=now=>{if(!canvas.isConnected)return;if(!document.hidden&&canvas.getClientRects().length&&now-previous>60){paint(canvas,item,now/1000);previous=now;}root.requestAnimationFrame(tick);};root.requestAnimationFrame(tick);}
  return canvas;
 }
 root.BS_COSMETIC_ART={SPECIES,head,body,mount,paint};
})(window);
