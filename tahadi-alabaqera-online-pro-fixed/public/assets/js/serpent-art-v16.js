/* Shared, bounded reptile materials for the arena and the product studio. */
(function(root){
 'use strict';
 const IDS=['snake-wild','snake-aurora','snake-gold','snake-ice','snake-toxic','snake-plasma'];
 const PALETTES=[['#a9ecc3','#378d6b','#102e2b','#e6cf90'],['#e9d3ff','#8961bb','#342440','#efb3eb'],['#ffe6a8','#be8c34','#52381d','#fff3c5'],['#e5fcff','#65b8d9','#23415f','#b4edff'],['#ddff91','#76a52c','#27361c','#e2ff75'],['#bcfaff','#448dc5','#392853','#dc93ff']];
 const KINDS=['viper','ribbon','cobra','crystal','dragon','plasma'];
 const SPECIES=Object.freeze(Object.fromEntries(IDS.map((id,i)=>[id,Object.freeze({kind:KINDS[i],light:PALETTES[i][0],mid:PALETTES[i][1],dark:PALETTES[i][2],accent:PALETTES[i][3],cell:i})])));
 const image=new Image(),materials=new Map();let loaded=false;
 const ready=new Promise(resolve=>{image.onload=()=>{loaded=!!image.naturalWidth;resolve(loaded)};image.onerror=()=>resolve(false);image.src='assets/arena/v16/serpent-heads.webp';});
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
  size=Math.max(1,Math.min(500,Number(size)||34));const p=species(id);c.save();c.shadowColor='#010611';c.shadowBlur=size*.18;
  if(loaded){const w=image.naturalWidth/3,h=image.naturalHeight/2,col=p.cell%3,row=Math.floor(p.cell/3);c.drawImage(image,col*w,row*h,w,h,-size*1.13,-size*1.21,size*2.86,size*2.42);}
  else{ellipse(c,0,0,size*1.24,size*.87,p.dark);ellipse(c,size*.35,0,size*1.12,size*.68,p.mid);for(const side of [-1,1]){ellipse(c,size*.55,size*.4*side,size*.17,size*.12,p.accent);ellipse(c,size*.6,size*.4*side,size*.035,size*.1,'#08131d');}}
  c.restore();
 }
 function body(c,input,id,radius=13,boost=false,_variant=0,budget=80){
  const points=pathPoints(input,budget);if(points.length<2)return;const p=species(id),r=Math.max(1,Math.min(300,Number(radius)||13)),n=points.length,texture=material(id);
  const edges=points.map((a,i)=>{const prev=points[Math.max(0,i-1)],next=points[Math.min(n-1,i+1)],dx=prev.x-next.x,dy=prev.y-next.y,len=Math.hypot(dx,dy)||1;return {...a,nx:-dy/len,ny:dx/len,w:r*(.04+.96*Math.pow(1-i/(n-1),p.kind==='ribbon'?.65:p.kind==='crystal'?.35:.44))*(p.kind==='cobra'&&i/(n-1)<.19?1+Math.sin(i/(n-1)/.19*Math.PI)*.38:1)};});
  const outline=()=>{c.beginPath();for(let i=0;i<n;i++){const a=edges[i],x=a.x+a.nx*a.w,y=a.y+a.ny*a.w;i?c.lineTo(x,y):c.moveTo(x,y);}for(let i=n-1;i>=0;i--){const a=edges[i];c.lineTo(a.x-a.nx*a.w,a.y-a.ny*a.w);}c.closePath();};
  if(p.kind==='dragon'||p.kind==='crystal'){c.save();for(let i=3;i<n-4;i+=p.kind==='dragon'?4:6){const a=edges[i],b=edges[Math.min(n-1,i+2)];c.beginPath();c.moveTo(a.x+a.nx*a.w,a.y+a.ny*a.w);c.lineTo(a.x+a.nx*a.w*1.5,a.y+a.ny*a.w*1.5);c.lineTo(b.x+b.nx*b.w,b.y+b.ny*b.w);c.closePath();c.fillStyle=p.accent;c.fill();}c.restore();}
  c.save();outline();c.fillStyle=p.dark;c.shadowColor='#010612';c.shadowBlur=r*.55;c.shadowOffsetY=r*.28;c.fill();c.shadowBlur=0;c.shadowOffsetY=0;c.clip();
  let distance=0;
  for(let i=n-1;i>=1;i--){const a=edges[i],b=edges[i-1],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);if(len<.01)continue;const width=Math.max(a.w,b.w);c.save();c.translate(a.x,a.y);c.rotate(Math.atan2(dy,dx));
   const unit=128/(r*2);let x=0,tiles=0;while(x<len&&tiles++<24){const source=(distance+x)*unit%128,take=Math.min(len-x,(128-source)/unit);if(take<=.001)break;c.drawImage(texture,source,0,take*unit,128,x,-width,take+.6,width*2);x+=take;}c.restore();distance+=len;
  }
  c.restore();c.save();c.lineJoin='round';
  for(const side of [-1,1]){c.beginPath();for(let i=0;i<n;i++){const a=edges[i],x=a.x+a.nx*a.w*side,y=a.y+a.ny*a.w*side;i?c.lineTo(x,y):c.moveTo(x,y);}c.strokeStyle=side===1?p.light+'a0':p.dark;c.lineWidth=.8;c.stroke();}
  if(boost){c.strokeStyle=p.accent;c.globalAlpha=.18;c.lineWidth=r*2.3;c.shadowColor=p.accent;c.shadowBlur=r;c.beginPath();points.forEach((a,i)=>i?c.lineTo(a.x,a.y):c.moveTo(a.x,a.y));c.stroke();}c.restore();
 }
 function preview(canvas,id,time=0,{rotation=0,zoom=1,clear=true}={}){
  const c=canvas.getContext('2d');if(!c)return;const width=canvas.width,height=canvas.height;c.setTransform(1,0,0,1,0,0);if(clear)c.clearRect(0,0,width,height);c.save();c.scale(width/600,height/360);c.translate(300,180);c.rotate(rotation);c.scale(zoom,zoom);c.translate(-300,-180);
  const points=Array.from({length:80},(_,i)=>{const t=i/79;return {x:442-t*335,y:158+Math.sin(t*11.2+time*.6)*(30+t*35)};});body(c,points,id,18,false,0,80);c.translate(points[0].x,points[0].y);c.rotate(Math.atan2(points[0].y-points[1].y,points[0].x-points[1].x));head(c,id,id==='snake-gold'?37:34);c.restore();
 }
 root.BS_SERPENT_ART=Object.freeze({SPECIES,IDS:Object.freeze(IDS),ready,head,body,preview,pathPoints,material});
})(window);
