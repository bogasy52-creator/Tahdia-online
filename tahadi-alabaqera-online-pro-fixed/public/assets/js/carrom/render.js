import {SIZE,POCKETS,aimCarrom} from './engine.js?v=33.9.10-club10';
// 33.9.6: a real club board — a lacquered rosewood frame, a maple surface with its grain under a lamp,
// red-and-black markings, netted pockets — and coins turned from wood with grooves and a shine.
const THEMES={
 walnut:{edge:['#5a2a16','#2e140a','#170904'],wood:['#f7deaa','#ebc584','#d9a965'],grain:[150,92,40],ink:'#3b2414',line:'#b8322c',cloth:'#0b242c',metal:'#e0bd72'},
 club:{edge:['#1f4a4c','#0f2a2e','#061517'],wood:['#f1ecd0','#dcd6ad','#c4bd8f'],grain:[110,104,60],ink:'#2b3b33',line:'#9a3a2c',cloth:'#091c28',metal:'#d8c28e'},
};
// value noise for the grain
function noise2(seed){
 const p=new Uint8Array(512);let s=seed>>>0||1;for(let i=0;i<256;i++)p[i]=i;
 for(let i=255;i>0;i--){s=(Math.imul(s,1664525)+1013904223)>>>0;const j=s%(i+1);[p[i],p[j]]=[p[j],p[i]];}
 for(let i=0;i<256;i++)p[i+256]=p[i];
 const fade=t=>t*t*(3-2*t),h=(x,y)=>p[p[x&255]+(y&255)]/255;
 return (x,y)=>{const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=fade(xf),v=fade(yf);
  const a=h(xi,yi),b=h(xi+1,yi),c=h(xi,yi+1),d=h(xi+1,yi+1);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;};
}
function grainLayer(theme){
 const N=1000,c=document.createElement('canvas');c.width=c.height=N;const g=c.getContext('2d'),img=g.createImageData(N,N),d=img.data;
 const n=noise2(91),m=noise2(17),[gr,gg,gb]=theme.grain;
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){
  // long fine streaks along the board, gently bent, with a little figure in the maple
  const bend=n(x*.0035,y*.012)*9+n(x*.01,y*.04)*1.5;
  const streak=.5+.5*Math.sin(y*.42+bend*2.4);
  const fine=m(x*.02,y*.9);
  const a=Math.pow(streak,14)*.16+Math.pow(fine,6)*.1;
  const i=(y*N+x)*4;d[i]=gr;d[i+1]=gg;d[i+2]=gb;d[i+3]=Math.round(Math.min(1,a)*255);
 }
 g.putImageData(img,0,0);return c;
}
function path(ctx,points,fill,stroke,width=1) {
 ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();
 if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.lineWidth=width;ctx.strokeStyle=stroke;ctx.stroke();}
}
function circle(ctx,x,y,r,fill,stroke,width=1){
 ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);
 if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.lineWidth=width;ctx.strokeStyle=stroke;ctx.stroke();}
}
function line(ctx,x,y,x2,y2,color,width=1){
 ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
}
function rounded(ctx,x,y,w,h,r,fill,stroke,width=1){
 ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x,y,w,h,r);else ctx.rect(x,y,w,h);
 if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.lineWidth=width;ctx.strokeStyle=stroke;ctx.stroke();}
}
function ramp(ctx,a,b,colors){
 const g=ctx.createLinearGradient(a[0],a[1],b[0],b[1]);
 colors.forEach((c,i)=>g.addColorStop(i/(colors.length-1),c));return g;
}
function wood(ctx,theme) {
 const c=document.createElement('canvas');c.width=1000;c.height=1000;const b=c.getContext('2d');
 // the frame: lacquered wood with a bevel and a shine along it
 b.save();b.shadowColor='#000c';b.shadowBlur=26;b.shadowOffsetY=10;rounded(b,4,4,992,992,52,theme.edge[2]);b.restore();
 rounded(b,4,4,992,992,52,ramp(b,[0,0],[1000,1000],[theme.edge[0],theme.edge[1],theme.edge[2],theme.edge[1]]));
 b.save();b.beginPath();if(b.roundRect)b.roundRect(4,4,992,992,52);else b.rect(4,4,992,992);b.clip();
 const fg=grainLayer({grain:[0,0,0]});b.globalAlpha=.55;b.drawImage(fg,0,0,1000,1000);b.globalAlpha=1;
 const shine=b.createLinearGradient(0,0,1000,1000);shine.addColorStop(0,'#ffffff30');shine.addColorStop(.18,'#ffffff08');shine.addColorStop(.5,'#ffffff00');shine.addColorStop(.82,'#00000030');
 b.fillStyle=shine;b.fillRect(0,0,1000,1000);b.restore();
 rounded(b,9,9,982,982,48,null,'#ffffff2a',2);
 rounded(b,58,58,884,884,16,null,'#00000080',6);
 rounded(b,62,62,876,876,14,null,theme.metal+'aa',1.6);
 // the surface: maple under a lamp
 b.save();b.beginPath();if(b.roundRect)b.roundRect(66,66,868,868,12);else b.rect(66,66,868,868);b.clip();
 b.fillStyle=ramp(b,[100,80],[900,960],theme.wood);b.fillRect(66,66,868,868);
 b.drawImage(grainLayer(theme),66,66,868,868);
 const lamp=b.createRadialGradient(470,430,40,500,500,640);lamp.addColorStop(0,'#fff8e030');lamp.addColorStop(.55,'#ffffff00');lamp.addColorStop(1,'#3a1c0855');
 b.fillStyle=lamp;b.fillRect(66,66,868,868);
 const inner=b.createLinearGradient(66,0,140,0);inner.addColorStop(0,'#00000040');inner.addColorStop(1,'#00000000');
 for(let side=0;side<4;side++){b.save();b.translate(500,500);b.rotate(side*Math.PI/2);b.translate(-500,-500);b.fillStyle=inner;b.fillRect(66,66,60,868);b.restore();}
 b.restore();
 // the markings: two lines per side with red circles, arrows to the pockets, the centre star
 for(let side=0;side<4;side++){
  b.save();b.translate(500,500);b.rotate(side*Math.PI/2);b.translate(-500,-500);
  line(b,214,790,786,790,theme.ink,2.4);line(b,214,838,786,838,theme.ink,2.4);
  for(const x of [214,786]){circle(b,x,814,24,theme.wood[0],theme.ink,2.4);circle(b,x,814,17,theme.line);circle(b,x,814,8,theme.wood[0]);}
  b.restore();
 }
 for(const [x,y] of POCKETS) {
  const dx=x<500?1:-1,dy=y<500?1:-1;
  line(b,x+dx*78,y+dy*78,x+dx*160,y+dy*160,theme.ink,2.4);
  const ax=x+dx*160,ay=y+dy*160;
  path(b,[[ax+dx*4,ay+dy*4],[ax-dx*20,ay-dy*5],[ax-dx*5,ay-dy*20]],theme.ink);
  b.save();b.translate(x+dx*124,y+dy*124);b.rotate(Math.atan2(dy,dx));b.beginPath();b.arc(0,0,34,-1.2,1.2);b.strokeStyle=theme.ink;b.lineWidth=2;b.stroke();b.restore();
  // the pocket: a metal rim, a dark hole and its net
  const ring=b.createRadialGradient(x-6,y-6,30,x,y,54);ring.addColorStop(0,'#000');ring.addColorStop(.74,'#0a0604');ring.addColorStop(.8,theme.metal);ring.addColorStop(.9,'#7a5a2a');ring.addColorStop(1,'#2a1a0c');
  circle(b,x,y,54,ring);
  const hole=b.createRadialGradient(x+dx*6,y+dy*6,4,x,y,42);hole.addColorStop(0,'#000');hole.addColorStop(1,'#140d08');
  circle(b,x,y,42,hole);
  b.save();b.beginPath();b.arc(x,y,40,0,Math.PI*2);b.clip();
  for(let i=-5;i<=5;i++){line(b,x-44,y+i*8+ i*.6,x+44,y+i*8-i*.6,'#6b5a4a44',1);line(b,x+i*8,y-44,x+i*8,y+44,'#6b5a4a44',1);}
  b.restore();
 }
 circle(b,500,500,112,null,theme.ink,2.4);circle(b,500,500,100,null,theme.line,2);
 const star=[];for(let i=0;i<16;i++){const a=i*Math.PI/8-Math.PI/2,r=i%2?30:92;star.push([500+Math.cos(a)*r,500+Math.sin(a)*r]);}
 path(b,star,theme.line+'cc',theme.ink,1.2);
 const star2=[];for(let i=0;i<16;i++){const a=i*Math.PI/8-Math.PI/2+Math.PI/16,r=i%2?22:56;star2.push([500+Math.cos(a)*r,500+Math.sin(a)*r]);}
 path(b,star2,theme.wood[0]+'dd',theme.ink,1);
 circle(b,500,500,20,theme.line,theme.ink,1.6);circle(b,500,500,9,theme.wood[0]);
 b.font='700 13px system-ui,sans-serif';b.textAlign='center';b.fillStyle=theme.ink+'88';
 b.fillText('B O S R A J',500,682);
 return c;
}
const sprites=new Map();
function disc(kind) {
 // 33.9.10: the striker you equipped in the shop
 const look=kind==='striker'&&typeof window!=='undefined'&&window.BS_LOOKS?window.BS_LOOKS.striker():'';
 if(sprites.has(kind+look))return sprites.get(kind+look);
 if(look){const cv=document.createElement('canvas');cv.width=cv.height=160;window.BS_LOOKS.drawStriker(cv.getContext('2d'),80,78,62,look);sprites.set(kind+look,cv);return cv;}
 const canvas=document.createElement('canvas');canvas.width=canvas.height=160;
 const c=canvas.getContext('2d'),X=80,Y=78,r=62;
 const tone={light:['#fff8e0','#ead09a','#b38a4f','#8a6332'],dark:['#6b7076','#26292e','#101215','#000'],queen:['#ffb3b8','#e0283f','#8e0f22','#4a0612'],striker:['#ffffff','#eef2f2','#c4d0d0','#8aa0a0']}[kind]||['#fff','#eee','#ccc','#999'];
 // the shadow under it
 c.save();c.shadowColor='#000a';c.shadowBlur=10;c.shadowOffsetX=3;c.shadowOffsetY=7;circle(c,X,Y+3,r,'#000');c.restore();
 // the edge, then the face
 circle(c,X,Y+3,r,tone[3]);
 const face=c.createRadialGradient(X-r*.35,Y-r*.45,r*.1,X,Y,r*1.05);face.addColorStop(0,tone[0]);face.addColorStop(.45,tone[1]);face.addColorStop(1,tone[2]);
 circle(c,X,Y,r-1,face);
 // turned grooves
 for(const k of [.84,.6,.34]){c.beginPath();c.arc(X,Y,r*k,0,Math.PI*2);c.lineWidth=2.6;c.strokeStyle=kind==='light'?'#8a63328c':kind==='striker'?'#5f8d8a99':'#00000099';c.stroke();
  c.beginPath();c.arc(X,Y+1.2,r*k,0,Math.PI*2);c.lineWidth=1.2;c.strokeStyle=kind==='dark'?'#ffffff22':'#ffffff66';c.stroke();}
 if(kind==='striker'){
  const pts=[];for(let i=0;i<16;i++){const a=i*Math.PI/8-Math.PI/2,rad=i%2?r*.2:r*.46;pts.push([X+Math.cos(a)*rad,Y+Math.sin(a)*rad]);}
  path(c,pts,'#1c8a86','#0d5552',1.5);circle(c,X,Y,r*.1,'#f6d38f');
  c.beginPath();c.arc(X,Y,r*.94,0,Math.PI*2);c.lineWidth=4;c.strokeStyle='#1c8a86';c.stroke();
 }
 if(kind==='queen'){circle(c,X,Y,r*.22,'#f6d38f','#fff1c4',1.5);}
 // the shine
 const hi=c.createRadialGradient(X-r*.38,Y-r*.48,0,X-r*.3,Y-r*.4,r*.75);hi.addColorStop(0,'#ffffffcc');hi.addColorStop(.35,'#ffffff40');hi.addColorStop(1,'#ffffff00');
 circle(c,X,Y,r-2,hi);
 sprites.set(kind,canvas);return canvas;
}
export function createCarromRenderer(canvas) {
 const ctx=canvas.getContext('2d');
 let w=1,h=1,background=null,lastTheme='',dpr=1;
 function resize(width,height,ratio=Math.min(2,devicePixelRatio||1)){
  w=width;h=height;dpr=Math.min(2,ratio);
  canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
 }
 const view=(p,seat)=>seat===1?{x:1000-p.x,y:1000-p.y}:p;
 function draw(s,{angle=-Math.PI/2,power=.55,seat=0,aim=true}={}) {
  const theme=THEMES[lastTheme]||THEMES.walnut;
  if(!background)background=wood(ctx,theme);
  const scale=Math.min(w,h)*dpr/1000;
  ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.setTransform(scale,0,0,scale,(canvas.width-1000*scale)/2,(canvas.height-1000*scale)/2);
  ctx.drawImage(background,0,0);
  if(aim&&s.phase==='aim') {
   const guide=aimCarrom(s,angle),from=view(s.striker,seat),to=view(guide,seat);
   ctx.save();ctx.lineCap='round';ctx.shadowColor='#0008';ctx.shadowBlur=4;
   ctx.setLineDash([2,14]);line(ctx,from.x,from.y,to.x,to.y,'#fffef2',5);ctx.restore();
   circle(ctx,to.x,to.y,s.striker.r,'#ffffff22','#ffffffd0',2.5);
   if(guide.target) {
    const p=view(guide.target,seat),dx=p.x-to.x,dy=p.y-to.y,d=Math.hypot(dx,dy);
    if(d>.001){ctx.save();ctx.lineCap='round';line(ctx,p.x,p.y,p.x+dx/d*150,p.y+dy/d*150,'#7dffcf',4);ctx.restore();circle(ctx,p.x,p.y,guide.target.r+5,null,'#7dffcf',2.5);}
   }
   const glow=ctx.createRadialGradient(from.x,from.y,s.striker.r,from.x,from.y,s.striker.r+22);glow.addColorStop(0,'#fff4ba88');glow.addColorStop(1,'#fff4ba00');
   circle(ctx,from.x,from.y,s.striker.r+22,glow);
   if(power>0.01){
    const back=angle+(seat?Math.PI:0),len=40+power*130,ex=from.x-Math.cos(back)*len,ey=from.y-Math.sin(back)*len;
    const pg=ctx.createLinearGradient(from.x,from.y,ex,ey);pg.addColorStop(0,'#3ddc84');pg.addColorStop(.55,'#f2c94c');pg.addColorStop(1,'#ff5b45');
    ctx.save();ctx.lineCap='round';line(ctx,from.x,from.y,ex,ey,pg,10);ctx.restore();
    // 33.9.10: the strength as a ring round the striker, green to red
    const col=power<.45?'#3ddc84':power<.75?'#f2c94c':'#ff5b45';
    ctx.save();ctx.lineCap='round';ctx.beginPath();ctx.arc(from.x,from.y,s.striker.r+15,0,Math.PI*2);ctx.strokeStyle='#00000055';ctx.lineWidth=9;ctx.stroke();
    ctx.beginPath();ctx.arc(from.x,from.y,s.striker.r+15,-Math.PI/2,-Math.PI/2+Math.PI*2*power);ctx.strokeStyle=col;ctx.lineWidth=7;ctx.shadowColor=col;ctx.shadowBlur=12;ctx.stroke();ctx.restore();
   }
  }
  for(const b of [...s.coins,s.striker]){
   if(b.pocketed)continue;
   const p=view(b,seat),r=b.r*1.29;
   ctx.drawImage(disc(b.kind),p.x-r,p.y-r*1.0,r*2,r*2);
  }
 }
 function setTheme(key){lastTheme=THEMES[key]?key:'walnut';background=null;}
 function point(clientX,clientY,seat=0){
  const r=canvas.getBoundingClientRect(),scale=Math.min(r.width,r.height)/1000;
  const x=(clientX-r.left-(r.width-1000*scale)/2)/scale,y=(clientY-r.top-(r.height-1000*scale)/2)/scale;
  return seat?{x:1000-x,y:1000-y}:{x,y};
 }
 return {resize,draw,setTheme,point};
}
