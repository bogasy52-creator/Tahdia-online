const sprites=new Map(),TAU=Math.PI*2;
export function arenaFoodSprite(kind){
 if(!['apple','berry','citrus','grapes','star','gem','remains'].includes(kind))kind='berry';
 if(sprites.has(kind))return sprites.get(kind);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d');
 const dot=(x,y,r,color)=>{c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,TAU);c.fill();};
 const path=(points,fill,stroke='#ffffff90')=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();c.strokeStyle=stroke;c.lineWidth=3;c.stroke();};
 // Each food is rendered once. Glow, shadow and detail are baked into its small sprite.
 c.shadowColor='#001d2290';c.shadowBlur=10;c.shadowOffsetY=6;dot(64,68,40,'#0e343ad9');c.shadowBlur=0;c.shadowOffsetY=0;
 c.strokeStyle='#bfead040';c.lineWidth=2;c.beginPath();c.arc(64,64,43,0,TAU);c.stroke();
 const colors={apple:'#ff5d77',berry:'#ff91d1',citrus:'#ffce64',grapes:'#b69bff',star:'#ffe080',gem:'#75eff0',remains:'#abed8a'};
 const color=colors[kind]||colors.berry;
 if(kind==='gem'){
  path([[64,22],[98,49],[84,89],[64,105],[43,89],[30,49]],'#53c7d0');
  path([[64,22],[79,49],[64,93],[49,49]],'#adffed');path([[30,49],[49,49],[64,93]],'#3192ae','#93f6ee');
  path([[79,49],[98,49],[64,93]],'#2d8eb0','#93f6ee');
 }else if(kind==='star'||kind==='remains'){
  const points=Array.from({length:10},(_,i)=>{const a=-Math.PI/2+i*Math.PI/5,r=i%2?20:39;return [64+Math.cos(a)*r,64+Math.sin(a)*r];});path(points,color,kind==='star'?'#fff6c6':'#d5ffbd');
  c.fillStyle='#fffbd0';c.beginPath();c.ellipse(56,55,5,12,.8,0,TAU);c.fill();
 }else if(kind==='citrus'){
  dot(64,65,35,'#fff1ac');dot(64,65,29,'#ffb444');c.strokeStyle='#fff0b1';c.lineWidth=3;
  for(let i=0;i<8;i++){const a=i*TAU/8;c.beginPath();c.moveTo(64+Math.cos(a)*5,65+Math.sin(a)*5);c.lineTo(64+Math.cos(a)*26,65+Math.sin(a)*26);c.stroke();}
 }else if(kind==='grapes'){
  for(const[x,y]of [[49,45],[74,45],[39,65],[64,66],[87,65],[51,85],[75,85]]){dot(x,y,14,'#7958cd');dot(x-2,y-3,11,'#bc97ff');dot(x-5,y-7,3,'#f0d6ff');}
 }else if(kind==='apple'){
  dot(49,62,25,'#df3658');dot(77,62,25,'#ff5577');dot(64,78,24,'#f54563');c.strokeStyle='#8d2843';c.lineWidth=4;c.beginPath();c.moveTo(65,43);c.quadraticCurveTo(68,24,73,24);c.stroke();
 }else{
  path([[32,48],[49,33],[80,33],[97,48],[91,76],[64,103],[36,76]],'#ed699b','#ffd6e7');
  c.fillStyle='#ffe9a9';for(const[x,y]of [[48,55],[68,55],[83,55],[53,74],[73,76],[64,88]]){c.beginPath();c.ellipse(x,y,2,4,.3,0,TAU);c.fill();}
 }
 if(['apple','berry','grapes'].includes(kind)){c.fillStyle='#a7e28e';c.beginPath();c.ellipse(74,29,16,7,-.4,0,TAU);c.fill();}
 c.globalAlpha=.6;dot(48,45,5,'#fffce8');c.globalAlpha=1;sprites.set(kind,canvas);return canvas;
}
export function paintArenaFood(ctx,f,now,reduced){
 const kind=f.kind||'berry',size=34+Math.sqrt(f.value||1)*5,pulse=!reduced&&['gem','star'].includes(kind)?1+Math.sin(now/340+f.x)*.06:1;
 ctx.drawImage(arenaFoodSprite(kind),f.x-size*pulse/2,f.y-size*pulse/2,size*pulse,size*pulse);
}
export function paintArenaFloor(ctx,g,{minX,minY,maxX,maxY},zoom){
 // Large quiet panels provide motion cues without a dense scrolling grid.
 const tile=156,row=135;ctx.fillStyle='#153b36';ctx.fillRect(0,0,g.width,g.height);
 for(let j=Math.floor(minY/row)-1;j<=Math.ceil(maxY/row)+1;j++)for(let i=Math.floor(minX/tile)-1;i<=Math.ceil(maxX/tile)+1;i++){
  const x=i*tile+(j%2?tile/2:0),y=j*row;if(x< -90||x>g.width+90||y< -90||y>g.height+90)continue;
  const n=((i+j)%3+3)%3;ctx.fillStyle=['#1a4038','#1d443a','#1b423c'][n];ctx.strokeStyle='#8fb28d0e';ctx.lineWidth=2;ctx.beginPath();
  for(let k=0;k<6;k++){const a=-Math.PI/2+k*TAU/6,px=x+Math.cos(a)*88,py=y+Math.sin(a)*88;k?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle='#b8d3a81a';ctx.beginPath();ctx.arc(x+14,y-12,2,0,TAU);ctx.arc(x-31,y+28,1.5,0,TAU);ctx.fill();
 }
 const cx=g.width/2,cy=g.height/2;
 ctx.strokeStyle='#bfd79c22';ctx.lineWidth=3;ctx.beginPath();ctx.arc(cx,cy,170,0,TAU);ctx.arc(cx,cy,184,0,TAU);ctx.stroke();
 ctx.save();ctx.translate(cx,cy);ctx.rotate(Math.PI/4);ctx.strokeRect(-34,-34,68,68);ctx.restore();
 ctx.lineWidth=22;ctx.strokeStyle='#102f32';ctx.strokeRect(11,11,g.width-22,g.height-22);
 ctx.lineWidth=3/zoom;ctx.strokeStyle='#d1c18b';ctx.strokeRect(13,13,g.width-26,g.height-26);
 ctx.lineWidth=1/zoom;ctx.strokeStyle='#b1e4b344';ctx.strokeRect(24,24,g.width-48,g.height-48);
}
export function paintCombatZones(ctx,s,zoom,ownMass){
 ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
 const color=s.mass<ownMass?'#9cf1bb':s.mass>ownMass?'#ffc98a':'#b8e9eb';
 ctx.strokeStyle=color;ctx.lineWidth=4/zoom;ctx.beginPath();s.segments.slice(0,5).forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();
 const end=s.segments.at(-1);if(end){ctx.strokeStyle='#ff9b8c';ctx.lineWidth=5/zoom;ctx.beginPath();s.segments.slice(-4).forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();ctx.lineWidth=2/zoom;ctx.beginPath();ctx.arc(end.x,end.y,10/zoom,0,TAU);ctx.stroke();ctx.beginPath();ctx.moveTo(end.x-3/zoom,end.y-3/zoom);ctx.lineTo(end.x+3/zoom,end.y+3/zoom);ctx.moveTo(end.x+3/zoom,end.y-3/zoom);ctx.lineTo(end.x-3/zoom,end.y+3/zoom);ctx.stroke();}
 ctx.restore();
}
