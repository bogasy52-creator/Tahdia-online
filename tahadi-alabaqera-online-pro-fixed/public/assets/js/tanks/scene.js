/* Orthographic solid geometry over the authoritative 2D simulation. */
import {TANKS,TANK_COLORS} from './core.js?v=33.10.5-life1';
const {W,H}=TANKS,TAU=Math.PI*2,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const hash=n=>{let x=Math.imul(n+31,1597334677);x^=x>>>13;return(x>>>0)/4294967296;};
const shade=(hex,k)=>{const v=parseInt(hex.slice(1),16);return '#'+[v>>16,v>>8&255,v&255].map(n=>Math.round(clamp(n*k,0,255)).toString(16).padStart(2,'0')).join('');};
export function makeTankCamera(width,height,{focus=null,zoom=1}={}){
  const angle=(width>height*1.15?-Math.PI/2:0)-.085,tilt=.76,lift=.92,c=Math.abs(Math.cos(angle)),s=Math.abs(Math.sin(angle));
  const scale=Math.max(.025,Math.min((width-22)/(W*c+H*s+20),(height-24)/((W*s+H*c)*tilt+112)));
  const v={width,height,angle,tilt,lift,scale:scale*zoom,focusX:focus?focus.x:W/2,focusY:focus?focus.y:H/2,cx:width/2,cy:height/2+18*scale};
  if(focus){const corners=[[0,0],[W,0],[W,H],[0,H]].map(([x,y])=>projectTankPoint(v,x,y)),xs=corners.map(p=>p.x),ys=corners.map(p=>p.y),shift=(min,max,size)=>max-min<size?size/2-(min+max)/2:min>0?-min:max<size?size-max:0;v.cx+=shift(Math.min(...xs),Math.max(...xs),width);v.cy+=shift(Math.min(...ys),Math.max(...ys),height);}
  return v;
}
export function projectTankPoint(v,x,y,z=0){x-=v.focusX??W/2;y-=v.focusY??H/2;const c=Math.cos(v.angle),s=Math.sin(v.angle);return{x:v.cx+(x*c-y*s)*v.scale,y:v.cy+(x*s+y*c)*(v.tilt??1)*v.scale-z*(v.lift??0)*v.scale};}
export function unprojectTankPoint(v,x,y){const xx=(x-v.cx)/v.scale,yy=(y-v.cy)/v.scale/(v.tilt??1),c=Math.cos(v.angle),s=Math.sin(v.angle);return{x:(v.focusX??W/2)+xx*c+yy*s,y:(v.focusY??H/2)-xx*s+yy*c};}
export function tankScreenVector(v,x,y){const c=Math.cos(v.angle),s=Math.sin(v.angle),yy=y/(v.tilt??1);return{x:x*c+yy*s,y:-x*s+yy*c};}
function path(c,points){c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x??p[0],p.y??p[1]):c.moveTo(p.x??p[0],p.y??p[1]));c.closePath();}
function polygon(c,points,fill,stroke=null,width=1){path(c,points);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
const local=(x,y,a,px,py)=>[x+px*Math.cos(a)-py*Math.sin(a),y+px*Math.sin(a)+py*Math.cos(a)];
function plane(c,v,z,fn){c.save();const co=Math.cos(v.angle),si=Math.sin(v.angle),s=v.scale,t=v.tilt;c.transform(co*s,si*s*t,-si*s,co*s*t,v.cx-((v.focusX??W/2)*co-(v.focusY??H/2)*si)*s,v.cy-((v.focusX??W/2)*si+(v.focusY??H/2)*co)*s*t-z*v.lift*s);fn();c.restore();}
function line3(c,v,points,color,width=1){c.beginPath();points.forEach(([x,y,z],i)=>{const p=projectTankPoint(v,x,y,z);i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y);});c.strokeStyle=color;c.lineWidth=Math.max(.6,width*v.scale);c.lineCap='round';c.lineJoin='round';c.stroke();}
function prism(c,v,points,z,height,color,{top=1.25}={}){
  const upper=points.map(([x,y])=>projectTankPoint(v,x,y,z+height)),faces=[];
  for(let i=0;i<points.length;i++){const j=(i+1)%points.length,[x,y]=points[i],[xx,yy]=points[j],nx=yy-y,ny=-(xx-x),len=Math.hypot(nx,ny)||1;if(nx*Math.sin(v.angle)+ny*Math.cos(v.angle)<=0)continue;faces.push({depth:(x+xx)*Math.sin(v.angle)+(y+yy)*Math.cos(v.angle),points:[projectTankPoint(v,x,y,z),projectTankPoint(v,xx,yy,z),upper[j],upper[i]],fill:shade(color,.53+.21*(-nx/len*.65-ny/len*.35))});}
  faces.sort((a,b)=>a.depth-b.depth);for(const f of faces)polygon(c,f.points,f.fill,'#ffffff15',.55);polygon(c,upper,shade(color,top),'#ffffff15',.7);
}
function box(c,v,x,y,w,d,z,h,color,a=0,bevel=0,options={}){const bx=w/2,by=d/2,b=Math.min(bevel,bx,by),pts=b?[[-bx+b,-by],[bx-b,-by],[bx,-by+b],[bx,by-b],[bx-b,by],[-bx+b,by],[-bx,by-b],[-bx,-by+b]]:[[-bx,-by],[bx,-by],[bx,by],[-bx,by]];prism(c,v,pts.map(([px,py])=>local(x,y,a,px,py)),z,h,color,options);}
function cylinder(c,v,x,y,r,z,h,color,n=14){prism(c,v,Array.from({length:n},(_,i)=>[x+Math.cos(i*TAU/n)*r,y+Math.sin(i*TAU/n)*r]),z,h,color);}
function halo(c,p,r,color){if(r<=0)return;const g=c.createRadialGradient(p.x,p.y,0,p.x,p.y,r);g.addColorStop(0,color);g.addColorStop(1,color.slice(0,7)+'00');c.fillStyle=g;c.fillRect(p.x-r,p.y-r,r*2,r*2);}
export function paintTankTerrain(c,map=0){
  const colors=[['#273e45','#142a33'],['#333e36','#1b2b2b'],['#54483a','#2c3536']][map%3],g=c.createLinearGradient(0,0,W,H);g.addColorStop(0,colors[0]);g.addColorStop(1,colors[1]);c.fillStyle=g;c.fillRect(0,0,W,H);
  for(let y=0;y<H;y+=100)for(let x=0;x<W;x+=100){c.fillStyle=(x+y)%200?'#ffffff03':'#00000008';c.fillRect(x+1,y+1,98,98);c.strokeStyle='#9bcbcb0c';c.lineWidth=1;c.strokeRect(x+.5,y+.5,99,99);c.fillStyle='#b6d4d315';for(const[dx,dy]of[[7,7],[93,7],[7,93],[93,93]])c.fillRect(x+dx,y+dy,2,2);}
  for(let i=0;i<1800;i++){c.fillStyle=i%3?'#cee8db0c':'#00000019';c.fillRect(hash(i*3)*W,hash(i*3+1)*H,1+hash(i)*3,1+hash(i+3)*2);}
  c.lineWidth=2;c.strokeStyle='#bce0c617';for(const y of[H*.17,H*.83]){c.beginPath();c.moveTo(30,y);c.lineTo(W-30,y);c.stroke();}
  for(const[seat,x,y]of[[0,110,140],[1,790,910],[2,790,140],[3,110,910]]){c.strokeStyle=TANK_COLORS[seat]+'58';c.lineWidth=2.2;c.setLineDash([14,7]);c.beginPath();c.arc(x,y,63,0,TAU);c.stroke();c.setLineDash([]);c.fillStyle=TANK_COLORS[seat]+'0c';c.fill();}
  c.save();c.translate(W/2,H/2);c.strokeStyle='#a6c9be12';c.lineWidth=2;for(const r of[155,168]){c.beginPath();c.arc(0,0,r,0,TAU);c.stroke();}c.rotate(-Math.PI/4);c.strokeRect(-80,-80,160,160);c.restore();
  c.textAlign='center';c.font='600 16px sans-serif';c.fillStyle='#a5c8bf26';c.fillText('B O S R A J   /   A R E N A',W/2,H*.61);
}
function arenaShell(c,v,terrain,map){
  box(c,v,W/2,H/2,W+40,H+40,-42,38,'#172a32',0,25,{top:.9});plane(c,v,0,()=>{terrain?c.drawImage(terrain,0,0,W,H):paintTankTerrain(c,map);});
  for(const[x,y,w,d]of[[W/2,-8,W+30,17],[W/2,H+8,W+30,17],[-8,H/2,17,H],[W+8,H/2,17,H]])box(c,v,x,y,w,d,0,16,'#456068',0,4);
  for(const x of[0,W])for(let y=74;y<H;y+=146){const p=projectTankPoint(v,x,y,18);halo(c,p,20*v.scale,'#7df2d546');line3(c,v,[[x,y-21,18],[x,y+21,18]],'#b2f1dc',3);}
  for(const y of[0,H])for(let x=90;x<W;x+=180)line3(c,v,[[x-25,y,18],[x+25,y,18]],'#dfbd76',3);
}
function obstacle(c,v,b){
  if(b.hp===0)return;const x=b.x+b.w/2,y=b.y+b.h/2;
  if(b.type==='stone'){
    box(c,v,x,y,b.w,b.h,0,49,'#45606a',0,5,{top:1.2});box(c,v,x,y,b.w+1,b.h+1,49,10,'#76857e',0,5);
    plane(c,v,60,()=>{c.save();c.beginPath();c.rect(b.x+4,b.y+4,b.w-8,b.h-8);c.clip();c.strokeStyle='#d9ba6c';c.lineWidth=9;for(let i=-b.h;i<b.w+b.h;i+=28){c.beginPath();c.moveTo(b.x+i,b.y+b.h);c.lineTo(b.x+i+b.h,b.y);c.stroke();}c.restore();c.fillStyle='#d1d3b2';for(const xx of[b.x+7,b.x+b.w-7])for(const yy of[b.y+7,b.y+b.h-7]){c.beginPath();c.arc(xx,yy,2,0,TAU);c.fill();}});
    line3(c,v,[[b.x+8,b.y+b.h+1,15],[b.x+b.w-8,b.y+b.h+1,15]],'#91b7b94f',2);
  }else if(b.type==='barrel'){
    const r=Math.min(b.w,b.h)*.43;
    for(const[z,h,color,radius]of[[0,9,'#a7513b',r],[9,3,'#bd9964',r+1],[12,27,'#a7513b',r],[39,3,'#bd9964',r+1],[42,10,'#a7513b',r]])cylinder(c,v,x,y,radius,z,h,color);
    plane(c,v,54,()=>{c.strokeStyle='#f3cf897d';c.lineWidth=1;c.beginPath();c.arc(x,y,r*.78,0,TAU);c.stroke();c.fillStyle='#402c27';c.beginPath();c.arc(x+5,y-4,3,0,TAU);c.fill();});
    const p=projectTankPoint(v,x,y,25);c.save();c.fillStyle='#f1ce68';c.font=`900 ${Math.max(7,17*v.scale)}px sans-serif`;c.textAlign='center';c.fillText('!',p.x,p.y+4);c.restore();
  }else{
    box(c,v,x,y,b.w,b.h,0,43,'#b8874e',0,2);plane(c,v,44,()=>{c.strokeStyle='#f3cb8b';c.lineWidth=5;c.strokeRect(b.x+3,b.y+3,b.w-6,b.h-6);c.beginPath();c.moveTo(b.x+5,b.y+5);c.lineTo(b.x+b.w-5,b.y+b.h-5);c.moveTo(b.x+b.w-5,b.y+5);c.lineTo(b.x+5,b.y+b.h-5);c.stroke();c.fillStyle='#4a4234';for(const xx of[b.x+5,b.x+b.w-5])for(const yy of[b.y+5,b.y+b.h-5])c.fillRect(xx-1,yy-1,2,2);if(b.hp<b.maxHp){c.strokeStyle='#392a26';c.lineWidth=3;c.beginPath();c.moveTo(x-7,b.y);c.lineTo(x+5,y);c.lineTo(x-5,b.y+b.h);c.stroke();}});
  }
}
export function paintArmoredTank(c,v,p,color=TANK_COLORS[p.seat%4],time=0){
  const a=p.body||0;if(!p.alive){box(c,v,p.x,p.y,63,47,0,15,'#252f30',a,7);box(c,v,p.x,p.y,34,30,15,13,'#3d4442',a+.2,5);return;}
  for(const side of[-1,1]){const[x,y]=local(p.x,p.y,a,0,side*25);box(c,v,x,y,76,17,1,16,'#202e35',a,5);for(let i=0;i<10;i++){const d=-35+((i*7.5+(p.track||0)*.4)%75),[tx,ty]=local(p.x,p.y,a,d,side*25);box(c,v,tx,ty,3.5,18,15,2.5,'#84968d',a,0,{top:1.1});}}
  box(c,v,p.x,p.y,68,44,14,19,color,a,9,{top:1.16});const[rearX,rearY]=local(p.x,p.y,a,-21,0);box(c,v,rearX,rearY,15,27,32,4,'#263e43',a,2);
  plane(c,v,37,()=>{c.save();c.translate(rearX,rearY);c.rotate(a);c.strokeStyle='#a8c8b9';c.lineWidth=1.5;for(let i=-10;i<=10;i+=4){c.beginPath();c.moveTo(-5,i);c.lineTo(5,i);c.stroke();}c.restore();});
  for(const side of[-1,1]){const[x,y]=local(p.x,p.y,a,30,side*15);box(c,v,x,y,7,6,24,5,'#d7dfb7',a);halo(c,projectTankPoint(v,x,y,29),10*v.scale,'#fff0bb56');}
  const recoil=(p.recoil||0)*5,tx=p.x-Math.cos(p.aim)*recoil,ty=p.y-Math.sin(p.aim)*recoil;cylinder(c,v,tx,ty,23,32,5,'#21363d',16);box(c,v,tx,ty,42,34,37,17,color,p.aim,9,{top:1.27});
  const[gunX,gunY]=local(tx,ty,p.aim,33,0);box(c,v,gunX,gunY,39,9,42,8,'#7c9998',p.aim,2);const[tipX,tipY]=local(tx,ty,p.aim,52,0);box(c,v,tipX,tipY,10,15,40,12,'#30464f',p.aim,2);
  const[hx,hy]=local(tx,ty,p.aim,-6,-2);cylinder(c,v,hx,hy,8,54,3,'#304e4b',12);plane(c,v,58,()=>{c.strokeStyle='#deebbb';c.lineWidth=1.4;c.beginPath();c.arc(hx,hy,7.5,0,TAU);c.stroke();for(const[xx,yy]of[[-13,-10],[12,-10],[-12,11],[12,11]]){const[x,y]=local(tx,ty,p.aim,xx,yy);c.fillStyle='#e9d6a0';c.beginPath();c.arc(x,y,1.4,0,TAU);c.fill();}});
  const[ax,ay]=local(p.x,p.y,a,-25,-18);line3(c,v,[[ax,ay,31],[ax-3,ay-4,72]],'#aec4b7',1.7);
  if(p.shield>0){const q=projectTankPoint(v,p.x,p.y,25);c.save();c.strokeStyle='#a6f4ffaa';c.lineWidth=1.2;c.setLineDash([5,3]);c.beginPath();c.ellipse(q.x,q.y,47*v.scale,49*v.scale,0,0,TAU);c.stroke();c.setLineDash([]);halo(c,q,49*v.scale,'#68d7f91b');c.restore();}
}
function pickup(c,v,p,time){if(p.taken)return;const color={shield:'#8edcff',rapid:'#f0c56f',triple:'#c59cfc',repair:'#82e9a6',boost:'#6ce8f3',heavy:'#ff8d69',homing:'#ff6fb1'}[p.kind]||'#fff',z=20+Math.sin(time*.003+p.x)*5,q=projectTankPoint(v,p.x,p.y,z);halo(c,q,35*v.scale,color+'38');box(c,v,p.x,p.y,29,29,z,7,'#e0d2aa',Math.PI/4,3);c.save();c.fillStyle='#173e4a';c.font=`900 ${Math.max(9,22*v.scale)}px sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText({shield:'◇',rapid:'ϟ',triple:'≡',repair:'+',boost:'»',heavy:'◉',homing:'➶'}[p.kind],q.x,q.y-5*v.scale);c.restore();}
function effects(c,v,fx,time,light){
  for(const e of fx){const age=(time-e.at)/1000;if(age<0)continue;
    if(e.type==='shot'&&age<.16){const q=projectTankPoint(v,e.x+Math.cos(e.aim)*57,e.y+Math.sin(e.aim)*57,47),o=projectTankPoint(v,e.x,e.y,47),a=1-age/.16;c.save();c.globalCompositeOperation='lighter';halo(c,q,68*v.scale*a,'#ffc36bbf');c.translate(q.x,q.y);c.rotate(Math.atan2(q.y-o.y,q.x-o.x));c.scale(v.scale,v.scale);polygon(c,[[0,-3],[8,-13*a],[19,-5],[40*a,0],[19,5],[8,13*a],[0,3]],'#fff0b7');polygon(c,[[0,-3],[26*a,0],[0,3]],'#fff');c.restore();}
    if(!['hit','kill','explosion','break','ricochet','impact','chip'].includes(e.type))continue;const big=e.type==='kill'||e.type==='explosion',wood=e.type==='break',life=big?1.65:wood?.85:.45;if(age>life)continue;const a=1-age/life,q=projectTankPoint(v,e.x,e.y,big?28:22);c.save();
    if(big){if(age<.45){const t=age/.45;halo(c,q,(55+t*80)*v.scale,'#fc9c36'+Math.round((1-t)*170).toString(16).padStart(2,'0'));c.fillStyle='#ffd578';c.beginPath();c.arc(q.x,q.y,(14+age*75)*v.scale,0,TAU);c.fill();c.strokeStyle='#ffd88d'+Math.round((1-t)*180).toString(16).padStart(2,'0');c.lineWidth=3*v.scale;c.beginPath();c.ellipse(q.x,q.y+15*v.scale,(35+t*85)*v.scale,(18+t*48)*v.scale,0,0,TAU);c.stroke();}
      for(let i=0;i<(light?3:7);i++){const theta=hash(e.id*19+i)*TAU,d=age*(20+hash(i)*18),p=projectTankPoint(v,e.x+Math.cos(theta)*d,e.y+Math.sin(theta)*d,20+age*80);c.fillStyle=`rgba(75,84,79,${a*.42})`;c.beginPath();c.arc(p.x,p.y,(12+age*17)*v.scale,0,TAU);c.fill();}}
    for(let i=0;i<(light?5:big?23:wood?14:8);i++){const theta=hash(e.id*93+i*3)*TAU,speed=45+hash(i*5+e.id)*135,z=Math.max(0,18+age*(big?150:80)-age*age*160),p=projectTankPoint(v,e.x+Math.cos(theta)*age*speed,e.y+Math.sin(theta)*age*speed,z);c.globalAlpha=a;c.fillStyle=wood?'#d6a35e':i%3?'#ffd687':'#fffbe6';c.save();c.translate(p.x,p.y);c.rotate(theta+age*i);c.fillRect(-2,-1,Math.max(1.4,(big||wood?7:11)*v.scale*a),Math.max(1.1,3*v.scale));c.restore();}c.restore();
  }
}
export function drawTankScene(c,g,w,h,{time=0,view=makeTankCamera(w,h),terrain=null,fx=[],tracks=[],craters=[],localSeat=0,light=false}={}){
  const bg=c.createRadialGradient(w*.5,h*.35,0,w*.5,h*.5,Math.max(w,h)*.75);bg.addColorStop(0,'#17333f');bg.addColorStop(.7,'#071925');bg.addColorStop(1,'#050f18');c.fillStyle=bg;c.fillRect(0,0,w,h);arenaShell(c,view,terrain,g.map);
  plane(c,view,.2,()=>{for(const t of tracks){c.save();c.translate(t.x,t.y);c.rotate(t.a);c.fillStyle='#bfd0bb12';c.fillRect(-5,-28,12,7);c.fillRect(-5,21,12,7);c.restore();}for(const p of craters){c.fillStyle='#070d10a0';c.beginPath();c.ellipse(p.x,p.y,43,33,.3,0,TAU);c.fill();}for(const b of g.walls)if(b.hp!==0){c.fillStyle='#020b1275';c.fillRect(b.x+10,b.y+16,b.w+5,b.h+5);}for(const p of g.players){c.fillStyle='#010a127d';c.beginPath();c.ellipse(p.x+10,p.y+14,45,32,p.body,0,TAU);c.fill();}if(g.roundTime>TANKS.STORM_START){const n=Math.min(490,(g.roundTime-TANKS.STORM_START)*TANKS.STORM_RATE);c.fillStyle='#f4682840';c.fillRect(0,0,W,n);c.fillRect(0,H-n,W,n);c.fillRect(0,n,n,H-2*n);c.fillRect(W-n,n,n,H-2*n);c.strokeStyle='#f9b661';c.lineWidth=3;c.setLineDash([17,11]);c.strokeRect(n,n,W-2*n,H-2*n);c.setLineDash([]);}});
  const depth=(x,y)=>x*Math.sin(view.angle)+y*Math.cos(view.angle),objects=[...g.walls.filter(b=>b.hp!==0).map(b=>({d:depth(b.x+b.w/2,b.y+b.h/2),paint:()=>obstacle(c,view,b)})),...g.players.map(p=>({d:depth(p.x,p.y),paint:()=>paintArmoredTank(c,view,p,TANK_COLORS[p.seat],time)})),...g.pickups.filter(p=>!p.taken).map(p=>({d:depth(p.x,p.y),paint:()=>pickup(c,view,p,time)}))];objects.sort((a,b)=>a.d-b.d);for(const obj of objects)obj.paint();
  const self=g.players[localSeat];if(self?.alive&&g.phase==='battle'){const{x,y,aim}=self;c.save();c.setLineDash([3,6]);line3(c,view,[[x+Math.cos(aim)*64,y+Math.sin(aim)*64,44],[x+Math.cos(aim)*145,y+Math.sin(aim)*145,44]],'#b6e8d79c',2.5);c.restore();}
  for(const b of g.bullets){const q=projectTankPoint(view,b.x,b.y,45);c.save();c.globalCompositeOperation='lighter';if(!light)halo(c,q,24*view.scale,'#ffbf643f');line3(c,view,[[b.x-b.vx*.045,b.y-b.vy*.045,45],[b.x,b.y,45]],'#ffe2a0',6);c.fillStyle='#fff9e3';c.beginPath();c.arc(q.x,q.y,Math.max(2.2,4*view.scale),0,TAU);c.fill();c.restore();}effects(c,view,fx,time,light);
  // 33.10.4: a real health bar over every tank — long, coloured by what is left, the shield in blue over it
  const lifeColor=f=>f>.6?'#45e07a':f>.3?'#ffcf4a':'#ff5a4a',onScreen=[];
  for(const p of g.players){if(!p.alive)continue;const q=projectTankPoint(view,p.x,p.y,87);if(q.x<0||q.x>w||q.y<0||q.y>h)continue;const mine=p.seat===localSeat,x=clamp(q.x,40,w-40),y=clamp(q.y,16,h-20),size=Math.max(mine?54:46,(mine?84:72)*view.scale),bh=mine?8:7,f=clamp(p.hp/TANKS.HP,0,1),sf=clamp((p.shield||0)/TANKS.SHIELD,0,1);onScreen.push({seat:p.seat,x,y});c.save();
    c.font=`800 ${Math.max(10,12.5*view.scale)}px system-ui,sans-serif`;c.textAlign='center';c.textBaseline='bottom';c.lineWidth=3.5;c.strokeStyle='#051b25';const label=mine?'أنت':p.name;c.strokeText(label,x,y-bh-4);c.fillStyle=mine?'#ffffff':'#f3f3dc';c.fillText(label,x,y-bh-4);
    c.fillStyle='#04121acc';c.beginPath();c.roundRect(x-size/2-2,y-bh-1,size+4,bh+4,4);c.fill();c.fillStyle=TANK_COLORS[p.seat];c.fillRect(x-size/2-2,y-bh-1,3,bh+4);
    c.fillStyle='#ffffff1a';c.fillRect(x-size/2,y-bh+1,size,bh);c.fillStyle=lifeColor(f);c.fillRect(x-size/2,y-bh+1,size*f,bh);c.fillStyle='#ffffff40';c.fillRect(x-size/2,y-bh+1,size*f,Math.max(1,bh*.35));
    c.fillStyle='#04121a99';for(let k=1;k<5;k++)c.fillRect(x-size/2+size*k/5-.5,y-bh+1,1,bh);
    if(sf>0){c.fillStyle='#7fd8ff';c.fillRect(x-size/2,y+1,size*sf,2.5);}
    if(mine){c.font=`900 ${Math.max(9,10*view.scale)}px system-ui,sans-serif`;c.textBaseline='top';c.lineWidth=3;c.strokeText(String(Math.ceil(p.hp)),x+size/2+12,y-bh-1);c.fillStyle=lifeColor(f);c.fillText(String(Math.ceil(p.hp)),x+size/2+12,y-bh-1);}
    c.restore();}
  // 33.10.4: an enemy off the screen shows as an arrow on the edge, in its colour, pointing where it is
  const lead=g.players[localSeat],selfQ=lead?.alive?projectTankPoint(view,lead.x,lead.y,20):{x:w/2,y:h/2};
  if(view.zoomed)for(const p of g.players){if(!p.alive||p.seat===localSeat||(g.mode==='teams'&&lead&&p.team===lead.team))continue;const q=projectTankPoint(view,p.x,p.y,20);if(q.x>=8&&q.x<=w-8&&q.y>=8&&q.y<=h-8)continue;const a=Math.atan2(q.y-selfQ.y,q.x-selfQ.x),m=22,ex=clamp(selfQ.x+Math.cos(a)*9999,m,w-m),ey0=selfQ.y+Math.sin(a)*Math.abs((ex-selfQ.x)/(Math.cos(a)||1e-6)),ey=clamp(ey0,m,h-m),ex2=Math.abs(ey0-ey)>.5?clamp(selfQ.x+Math.cos(a)*Math.abs((ey-selfQ.y)/(Math.sin(a)||1e-6)),m,w-m):ex;c.save();c.translate(ex2,ey);c.rotate(a);c.globalAlpha=.92;c.fillStyle=TANK_COLORS[p.seat];c.strokeStyle='#04121a';c.lineWidth=2.5;c.beginPath();c.moveTo(12,0);c.lineTo(-7,-9);c.lineTo(-3,0);c.lineTo(-7,9);c.closePath();c.stroke();c.fill();c.restore();}
  // the map of the arena sits in the corner farthest from your tank, and fades when a tank is under it
  if(view.zoomed){
    const rw=Math.min(84,w*.2),rh=rw*H/W,right=selfQ.x<w/2,mx=right?w-rw-10:10,my=12,under=onScreen.some(o=>o.x>mx-14&&o.x<mx+rw+14&&o.y>my-14&&o.y<my+rh+30);c.save();c.globalAlpha=under?.28:.82;c.fillStyle='#06141de0';c.beginPath();c.roundRect(mx-4,my-4,rw+8,rh+8,7);c.fill();c.strokeStyle='#b8c9b55c';c.lineWidth=1;c.stroke();
    c.save();c.beginPath();c.rect(mx,my,rw,rh);c.clip();for(const b of g.walls)if(b.hp!==0){c.fillStyle=b.type==='stone'?'#5c7b80':'#927a52';c.fillRect(mx+b.x/W*rw,my+b.y/H*rh,Math.max(2,b.w/W*rw),Math.max(2,b.h/H*rh));}
    for(const p of g.pickups)if(!p.taken){c.fillStyle='#e7d69a';c.fillRect(mx+p.x/W*rw-1.5,my+p.y/H*rh-1.5,3,3);}
    for(const p of g.players)if(p.alive){c.beginPath();c.arc(mx+p.x/W*rw,my+p.y/H*rh,p.seat===localSeat?3.8:2.6,0,TAU);c.fillStyle=TANK_COLORS[p.seat];c.fill();if(p.seat===localSeat){c.strokeStyle='#fff';c.lineWidth=1.2;c.stroke();}}
    c.restore();c.restore();
  }
  for(const e of fx){const t=(time-e.at)/800;if(e.type!=='hit'||!e.damage||t<0||t>1)continue;const q=projectTankPoint(view,e.x,e.y,75+40*t),x=clamp(q.x+Math.max(18,30*view.scale),16,w-16);c.save();c.globalAlpha=1-t;c.font='900 15px system-ui,sans-serif';c.textAlign='center';c.lineWidth=3;c.strokeStyle='#2c1d22';c.strokeText('−'+e.damage,x,q.y);c.fillStyle='#ffdf9c';c.fillText('−'+e.damage,x,q.y);c.restore();}
}
