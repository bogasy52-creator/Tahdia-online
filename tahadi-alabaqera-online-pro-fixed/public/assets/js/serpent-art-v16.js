/* Shared, bounded reptile materials for the arena and the product studio. */
(function(root){
 'use strict';
 const IDS=['snake-wild','snake-aurora','snake-gold','snake-ice','snake-toxic','snake-plasma','snake-sovereign'];
 const PALETTES=[['#a9ecc3','#378d6b','#102e2b','#e6cf90'],['#e9d3ff','#8961bb','#342440','#efb3eb'],['#ffe6a8','#be8c34','#52381d','#fff3c5'],['#e5fcff','#65b8d9','#23415f','#b4edff'],['#ddff91','#76a52c','#27361c','#e2ff75'],['#bcfaff','#448dc5','#392853','#dc93ff'],['#e3c680','#243e43','#09151f','#ffe4a3']];
 const KINDS=['viper','ribbon','cobra','crystal','dragon','plasma','sovereign'];
 const SPECIES=Object.freeze(Object.fromEntries(IDS.map((id,i)=>[id,Object.freeze({kind:KINDS[i],light:PALETTES[i][0],mid:PALETTES[i][1],dark:PALETTES[i][2],accent:PALETTES[i][3],cell:i===6?2:i})])));
 const image=new Image(),materials=new Map(),patterns=new WeakMap();let loaded=false,loading=null;
 // The 460 KB head sheet is requested on first use, not on every page that
 // includes this helper (board games load it only for cosmetic previews).
 function start(){if(!loading)loading=new Promise(resolve=>{image.onload=()=>{loaded=!!image.naturalWidth;resolve(loaded)};image.onerror=()=>resolve(false);image.src='assets/arena/v16/serpent-heads.webp';});return loading;}
 const species=id=>SPECIES[id]||SPECIES['snake-wild'];
 function ellipse(c,x,y,rx,ry,color){c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=color;c.fill();}
 function material(id){
  const p=species(id),key=p.kind;if(materials.has(key))return materials.get(key);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d');
  c.fillStyle=p.mid;c.fillRect(0,0,128,128);
  if(p.kind==='ribbon'){
   for(const [y,h,color]of [[8,18,p.dark],[29,8,p.accent],[48,32,p.light],[89,9,p.accent],[109,14,p.dark]]){c.fillStyle=color;c.fillRect(0,y,128,h);}
   for(let x=0;x<128;x+=16){c.beginPath();c.moveTo(x,0);c.quadraticCurveTo(x+13,64,x,128);c.strokeStyle=p.light+'55';c.lineWidth=1;c.stroke();}
  }else if(p.kind==='plasma'){
   c.fillStyle=p.dark;c.fillRect(0,0,128,128);for(let row=0;row<5;row++){const y=row*26+6;c.beginPath();c.moveTo(0,y);c.lineTo(27,y);c.lineTo(41,y+10);c.lineTo(89,y+10);c.lineTo(103,y);c.lineTo(128,y);c.strokeStyle=row%2?p.accent:p.light;c.lineWidth=row===2?4:2;c.stroke();ellipse(c,41,y+10,3,3,p.mid);}
  }else if(p.kind==='crystal'){
   for(let y=-16;y<144;y+=32)for(let x=-16;x<144;x+=32){const offset=(y/32%2)*16;c.beginPath();c.moveTo(x+offset,y-18);c.lineTo(x+offset+20,y);c.lineTo(x+offset,y+18);c.lineTo(x+offset-20,y);c.closePath();c.fillStyle=(x+y)%64===0?p.light:p.mid;c.fill();c.strokeStyle=p.dark+'99';c.lineWidth=1.2;c.stroke();c.beginPath();c.moveTo(x+offset,y-18);c.lineTo(x+offset,y+18);c.lineTo(x+offset+20,y);c.fillStyle=p.dark+'55';c.fill();}
  }else if(p.kind==='viper'){
   for(let x=-20;x<160;x+=38){c.beginPath();c.moveTo(x,64);c.lineTo(x+19,31);c.lineTo(x+38,64);c.lineTo(x+19,97);c.closePath();c.fillStyle=p.dark;c.fill();c.lineWidth=2;c.strokeStyle=p.accent;c.stroke();}
   for(let y=7;y<128;y+=19)for(let x=0;x<128;x+=14){ellipse(c,x+(y%2)*4,y,3,2,p.light+'60');}
  }else{
   const scale=p.kind==='cobra'?26:18;
   for(let row=-1;row<9;row++)for(let col=-1;col<10;col++){
    const x=col*scale+(row%2)*scale/2,y=row*scale;c.beginPath();c.moveTo(x,y-scale*.55);c.quadraticCurveTo(x+scale*.8,y-scale*.2,x+scale*.48,y+scale*.32);c.quadraticCurveTo(x,y+scale,x-scale*.48,y+scale*.32);c.quadraticCurveTo(x-scale*.8,y-scale*.2,x,y-scale*.55);
    c.fillStyle=(row+col)%3===0?p.dark:p.mid;c.fill();c.lineWidth=p.kind==='cobra'?1.8:1;c.strokeStyle=p.light+'a0';c.stroke();
    if(p.kind==='dragon'){c.beginPath();c.moveTo(x,y-4);c.lineTo(x+5,y+6);c.lineTo(x-5,y+6);c.closePath();c.fillStyle=p.accent+'88';c.fill();}
   }
   if(p.kind==='sovereign'){c.strokeStyle=p.accent+'d0';c.lineWidth=3;for(let x=-20;x<148;x+=32){c.beginPath();c.moveTo(x,64);c.lineTo(x+16,47);c.lineTo(x+32,64);c.lineTo(x+16,81);c.closePath();c.stroke();}}
   if(p.kind==='cobra'){c.fillStyle=p.accent+'99';c.fillRect(0,52,128,24);c.fillStyle=p.dark+'a0';c.fillRect(0,59,128,10);}
  }
  const g=c.createLinearGradient(0,0,0,128);for(const [t,color]of [[0,'#010714ba'],[.3,p.light+'26'],[.47,'#ffffff4d'],[.6,'#ffffff06'],[1,'#010714ce']])g.addColorStop(t,color);c.fillStyle=g;c.fillRect(0,0,128,128);
  materials.set(key,canvas);return canvas;
 }
 function pathPoints(points,budget=80){
  const valid=[];for(const p of Array.isArray(points)?points:[]){if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>1e7||Math.abs(p.y)>1e7)continue;const last=valid.at(-1);if(!last||Math.hypot(p.x-last.x,p.y-last.y)>.15)valid.push(p);}
  const limit=Math.min(160,Math.max(24,Math.round(Number(budget)||80)));if(valid.length<=limit)return valid;
  return Array.from({length:limit},(_,i)=>valid[Math.round(i*(valid.length-1)/(limit-1))]);
 }
 function head(c,id,size=34){
  size=Math.max(1,Math.min(500,Number(size)||34));
  if(id==='snake-sovereign')return sovereignHead(c,size);
  if(!loading)start();
  const p=species(id);c.save();c.shadowColor='#010611';c.shadowBlur=size*.18;
  if(loaded){const w=image.naturalWidth/3,h=image.naturalHeight/2,col=p.cell%3,row=Math.floor(p.cell/3);c.drawImage(image,col*w,row*h,w,h,-size*1.13,-size*1.21,size*2.86,size*2.42);}
  else{ellipse(c,0,0,size*1.24,size*.87,p.dark);ellipse(c,size*.35,0,size*1.12,size*.68,p.mid);for(const side of [-1,1]){ellipse(c,size*.55,size*.4*side,size*.17,size*.12,p.accent);ellipse(c,size*.6,size*.4*side,size*.035,size*.1,'#08131d');}}
  c.restore();
 }
 const now=()=>root.performance?.now?.()||Date.now();
 function aura(c,s,time=0,reduced=false){
  if(s?.skin!=='snake-sovereign')return;
  const points=[{x:s.x,y:s.y},...(s.segments||[])].filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)),radius=7+Math.sqrt(s.mass||28)*.55;if(points.length<2)return;
  const trace=()=>{c.beginPath();points.slice(0,120).forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));};
  c.save();c.lineCap='round';c.lineJoin='round';
  const breathe=reduced?.5:.5+.5*Math.sin(time/600);
  trace();c.strokeStyle=`rgba(232,196,106,${(.14+.1*breathe).toFixed(3)})`;c.lineWidth=radius*(3.6+.6*breathe);c.stroke();
  trace();c.strokeStyle='rgba(98,255,175,.12)';c.lineWidth=radius*2.7;c.stroke();
  const head=points[0],pulse=reduced?.5:.5+.5*Math.sin(time/420);
  c.globalAlpha=.25+.3*pulse;c.strokeStyle='#f3d27a';c.lineWidth=Math.max(1,radius*.12);c.beginPath();c.arc(head.x,head.y,radius*(2.1+.25*pulse),0,Math.PI*2);c.stroke();
  if(!reduced)for(let i=0;i<12;i++){
   const p=points[Math.min(points.length-1,Math.floor((i+1)*points.length/13))];if(!p)continue;
   const phase=time/700+i*2.1,x=p.x+Math.cos(phase)*(radius*1.6),y=p.y+Math.sin(phase)*(radius*1.6),r=1.8+(1+Math.sin(phase*1.7))*1.3;
   c.globalAlpha=.45+.35*Math.sin(phase);c.fillStyle=i%3?'#ffe39a':'#7dffbf';c.shadowColor=c.fillStyle;c.shadowBlur=6;
   c.beginPath();c.moveTo(x-r,y);c.lineTo(x,y-r*2);c.lineTo(x+r,y);c.lineTo(x,y+r*2);c.closePath();c.fill();
  }
  c.restore();
 }
 /* The manager's serpent: an obsidian body with a moving emerald sheen,
    gold-rimmed plates and filigree, emerald studs and a crowned head. */
 function sovereignBody(c,input,r,boost,budget){
  const points=pathPoints(input,budget),n=points.length;if(n<2)return;
  const t=now()/1000,still=root.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
  const width=i=>r*(.12+.88*Math.pow(1-i/(n-1),.42));
  const edge=points.map((a,i)=>{const prev=points[Math.max(0,i-1)],next=points[Math.min(n-1,i+1)],dx=prev.x-next.x,dy=prev.y-next.y,len=Math.hypot(dx,dy)||1;return {x:a.x,y:a.y,nx:-dy/len,ny:dx/len,ang:Math.atan2(dy,dx)};});
  const seg=(i,w,color)=>{const a=edge[i],b=edge[i-1];c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.lineWidth=w;c.strokeStyle=color;c.stroke();};
  const offsetLine=(k,from=0,to=n-1)=>{c.beginPath();for(let i=from;i<=to;i++){const e=edge[i],w=width(i)*k,x=e.x+e.nx*w,y=e.y+e.ny*w;i>from?c.lineTo(x,y):c.moveTo(x,y);}};
  c.save();c.lineCap='round';c.lineJoin='round';
  for(let i=n-1;i>0;i--)seg(i,width(i)*2+2.6,'#020604');
  for(let i=n-1;i>0;i--)seg(i,width(i)*2,i%2?'#0c1712':'#0f1d16');
  for(let i=n-1;i>0;i--){const wave=still?.35:Math.max(0,Math.sin(i*.32-t*4.2));seg(i,width(i)*1.25,`rgba(31,143,90,${(.22+.5*wave).toFixed(3)})`);}
  for(let i=n-1;i>0;i--){const glint=still?0:Math.max(0,Math.sin(i*.18-t*2.6))**6;if(glint>.05)seg(i,width(i)*.9,`rgba(255,236,170,${(glint*.55).toFixed(3)})`);}
  c.globalAlpha=.75;c.strokeStyle='#e8c46a';c.lineWidth=Math.max(.6,r*.07);offsetLine(.82,0,n-2);c.stroke();offsetLine(-.82,0,n-2);c.stroke();c.globalAlpha=1;
  for(let i=2;i<n-2;i+=3){
   const e=edge[i],w=width(i);if(w<1.4)continue;
   c.save();c.translate(e.x,e.y);c.rotate(e.ang);
   c.fillStyle='#123d2a';c.strokeStyle='#e8c46a';c.lineWidth=Math.max(.5,w*.08);
   c.beginPath();c.moveTo(-w*.52,0);c.lineTo(0,-w*.34);c.lineTo(w*.52,0);c.lineTo(0,w*.34);c.closePath();c.fill();c.stroke();
   if(i%9===2){const g=c.createRadialGradient(-w*.06,-w*.06,0,0,0,w*.2);g.addColorStop(0,'#d9ffe9');g.addColorStop(.45,'#3ce38f');g.addColorStop(1,'#0b4a2c');c.fillStyle=g;c.beginPath();c.arc(0,0,w*.17,0,Math.PI*2);c.fill();}
   c.restore();
  }
  c.strokeStyle='#f2d58a';c.lineWidth=Math.max(.8,r*.14);offsetLine(0,0,Math.max(1,Math.floor(n*.85)));c.stroke();
  c.globalAlpha=.22;c.strokeStyle='#ffffff';c.lineWidth=Math.max(.6,r*.12);offsetLine(-.45,0,Math.max(1,Math.floor(n*.7)));c.stroke();c.globalAlpha=1;
  if(boost&&!still){for(let k=0;k<14;k++){const i=Math.min(n-1,Math.floor(n*.55+((k*37+Math.floor(t*30))%Math.max(1,Math.floor(n*.45))))),e=edge[i],w=width(i),j=Math.sin(t*9+k)*w*1.4,x=e.x+e.nx*j,y=e.y+e.ny*j,s=1.2+(k%3);c.globalAlpha=.55;c.fillStyle=k%2?'#ffe39a':'#7dffbf';c.beginPath();c.moveTo(x-s,y);c.lineTo(x,y-s*1.8);c.lineTo(x+s,y);c.lineTo(x,y+s*1.8);c.closePath();c.fill();}c.globalAlpha=1;}
  c.restore();
 }
 function sovereignHead(c,size){
  const t=now()/1000,still=root.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true,S=size*.92;
  c.save();
  const shape=()=>{c.beginPath();c.moveTo(-S*.78,-S*.42);c.bezierCurveTo(-S*.42,-S*.72,S*.32,-S*.7,S*.86,-S*.36);c.quadraticCurveTo(S*1.32,-S*.14,S*1.32,0);c.quadraticCurveTo(S*1.32,S*.14,S*.86,S*.36);c.bezierCurveTo(S*.32,S*.7,-S*.42,S*.72,-S*.78,S*.42);c.quadraticCurveTo(-S*.95,0,-S*.78,-S*.42);c.closePath();};
  c.shadowColor='rgba(0,0,0,.6)';c.shadowBlur=S*.25;c.shadowOffsetY=S*.06;
  const g=c.createLinearGradient(0,-S*.7,0,S*.7);g.addColorStop(0,'#08120d');g.addColorStop(.32,'#1b5a3d');g.addColorStop(.5,'#2a7a55');g.addColorStop(.68,'#1b5a3d');g.addColorStop(1,'#06100b');
  shape();c.fillStyle=g;c.fill();c.shadowBlur=0;c.shadowOffsetY=0;
  c.lineWidth=Math.max(.7,S*.055);c.strokeStyle='#e8c46a';shape();c.stroke();
  // gold scale rows along the brow
  c.lineWidth=Math.max(.4,S*.03);c.strokeStyle='rgba(242,213,138,.9)';
  for(const side of [-1,1]){c.beginPath();c.moveTo(-S*.62,side*S*.3);c.quadraticCurveTo(S*.1,side*S*.6,S*.88,side*S*.24);c.stroke();}
  c.fillStyle='#e8c46a';c.beginPath();c.moveTo(S*.82,0);c.lineTo(S*1.08,-S*.12);c.lineTo(S*1.24,0);c.lineTo(S*1.08,S*.12);c.closePath();c.fill();
  c.fillStyle='#03100a';for(const side of [-1,1]){c.beginPath();c.arc(S*1.12,side*S*.06,Math.max(.35,S*.028),0,Math.PI*2);c.fill();}
  // emerald eyes
  const glow=still?.75:.6+.4*Math.sin(t*3.2);
  for(const side of [-1,1]){
   c.save();c.translate(S*.5,side*S*.42);c.rotate(side*.28);
   c.fillStyle='#e8c46a';c.beginPath();c.ellipse(0,0,S*.2,S*.12,0,0,Math.PI*2);c.fill();
   c.shadowColor='#62ffaf';c.shadowBlur=S*.5*glow;c.fillStyle='#7dffbf';c.beginPath();c.ellipse(0,0,S*.155,S*.085,0,0,Math.PI*2);c.fill();c.shadowBlur=0;
   c.fillStyle='#021008';c.beginPath();c.ellipse(S*.01,0,S*.022,S*.075,0,0,Math.PI*2);c.fill();
   c.fillStyle='rgba(255,255,255,.9)';c.beginPath();c.arc(-S*.05,-S*.03,Math.max(.3,S*.022),0,Math.PI*2);c.fill();
   c.restore();
  }
  // a gold diadem across the head with three emerald-tipped points
  const gold=c.createLinearGradient(-S*.4,-S*.5,S*.2,S*.5);gold.addColorStop(0,'#fff3c4');gold.addColorStop(.5,'#e8c46a');gold.addColorStop(1,'#a8741c');
  c.strokeStyle='#5c3d0b';c.lineWidth=Math.max(.35,S*.02);c.fillStyle=gold;
  c.beginPath();c.moveTo(-S*.34,-S*.5);c.quadraticCurveTo(-S*.16,0,-S*.34,S*.5);c.lineTo(-S*.22,S*.52);c.quadraticCurveTo(-S*.04,0,-S*.22,-S*.52);c.closePath();c.fill();c.stroke();
  for(const y of [-S*.3,0,S*.3]){const base=-S*.2+Math.abs(y)*.25,tip=base+(y===0?S*.42:S*.3);c.fillStyle=gold;c.beginPath();c.moveTo(base,y-S*.1);c.lineTo(tip,y);c.lineTo(base,y+S*.1);c.closePath();c.fill();c.stroke();
   const gem=c.createRadialGradient(tip-S*.02,y-S*.02,0,tip,y,S*.08);gem.addColorStop(0,'#e6fff1');gem.addColorStop(.5,'#3ce38f');gem.addColorStop(1,'#0b4a2c');c.fillStyle=gem;c.beginPath();c.arc(tip,y,S*(y===0?.075:.06),0,Math.PI*2);c.fill();}
  c.restore();
 }
 function body(c,input,id,radius=13,boost=false,_variant=0,budget=80){
  if(id==='snake-sovereign')return sovereignBody(c,input,Math.max(1,Math.min(300,Number(radius)||13)),boost,budget);
  const points=pathPoints(input,budget);if(points.length<2)return;const p=species(id),r=Math.max(1,Math.min(300,Number(radius)||13)),n=points.length,texture=material(id);
  const edges=points.map((a,i)=>{const prev=points[Math.max(0,i-1)],next=points[Math.min(n-1,i+1)],dx=prev.x-next.x,dy=prev.y-next.y,len=Math.hypot(dx,dy)||1;return {...a,nx:-dy/len,ny:dx/len,w:r*(.04+.96*Math.pow(1-i/(n-1),p.kind==='ribbon'?.65:p.kind==='crystal'?.35:.44))*(p.kind==='cobra'&&i/(n-1)<.19?1+Math.sin(i/(n-1)/.19*Math.PI)*.38:1)};});
  // Continuous round strokes remain solid at loops and tight turns; a ribbon
  // polygon can fold over itself and clip away visible body sections.
  const trace=(from,to)=>{c.beginPath();c.moveTo(points[from].x,points[from].y);for(let i=from+1;i<=to;i++)c.lineTo(points[i].x,points[i].y);};
  c.save();c.lineCap='round';c.lineJoin='round';
  const tailStart=Math.max(1,Math.floor((n-1)*.75));
  let cache=patterns.get(c);if(!cache){cache=new Map();patterns.set(c,cache);}let pattern=cache.get(p.kind);if(!cache.has(p.kind)){try{pattern=c.createPattern?.(texture,'repeat')||null;}catch{pattern=null;}cache.set(p.kind,pattern);}
  for(let i=n-1;i>tailStart;i--){const a=edges[i],b=edges[i-1],width=r*Math.max(.06,(n-i)/(n-tailStart));c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.lineWidth=width*2+.8;c.strokeStyle=p.dark;c.stroke();c.lineWidth=width*2;c.strokeStyle=pattern||p.mid;c.stroke();}
  trace(0,tailStart);c.lineWidth=r*2+1.2;c.strokeStyle=p.dark;c.stroke();c.lineWidth=r*2;c.strokeStyle=pattern||p.mid;c.stroke();
  trace(0,tailStart);c.lineWidth=Math.max(1,r*.26);c.strokeStyle=p.light+'70';c.stroke();
  if(p.kind==='dragon'||p.kind==='crystal'){for(let i=3;i<tailStart;i+=p.kind==='dragon'?4:6){const a=edges[i],b=edges[Math.min(n-1,i+2)];c.beginPath();c.moveTo(a.x+a.nx*r,a.y+a.ny*r);c.lineTo(a.x+a.nx*r*1.45,a.y+a.ny*r*1.45);c.lineTo(b.x+b.nx*r,b.y+b.ny*r);c.closePath();c.fillStyle=p.accent;c.fill();}}
  if(boost){c.strokeStyle=p.accent;c.globalAlpha=.18;c.lineWidth=r*2.3;c.shadowColor=p.accent;c.shadowBlur=r;c.beginPath();points.forEach((a,i)=>i?c.lineTo(a.x,a.y):c.moveTo(a.x,a.y));c.stroke();}c.restore();
 }
 function preview(canvas,id,time=0,{rotation=0,zoom=1,clear=true}={}){
  const c=canvas.getContext('2d');if(!c)return;const width=canvas.width,height=canvas.height;c.setTransform(1,0,0,1,0,0);if(clear)c.clearRect(0,0,width,height);c.save();c.scale(width/600,height/360);c.translate(300,180);c.rotate(rotation);c.scale(zoom,zoom);c.translate(-300,-180);
  const points=Array.from({length:80},(_,i)=>{const t=i/79;return {x:442-t*335,y:158+Math.sin(t*11.2+time*.6)*(30+t*35)};});aura(c,{skin:id,x:points[0].x,y:points[0].y,segments:points.slice(1),mass:70},time*1000,root.matchMedia?.('(prefers-reduced-motion: reduce)').matches);body(c,points,id,18,false,0,80);c.translate(points[0].x,points[0].y);c.rotate(Math.atan2(points[0].y-points[1].y,points[0].x-points[1].x));head(c,id,id==='snake-gold'?37:34);c.restore();
 }
 root.BS_SERPENT_ART=Object.freeze({SPECIES,IDS:Object.freeze(IDS),get ready(){return start();},head,body,aura,preview,pathPoints,material});
})(window);
