import {SIZE,POCKETS,aimCarrom} from './engine.js';
const THEMES={
 walnut:{edge:['#7f4b2b','#442819','#241810'],wood:['#f5dfac','#e4bd7d','#d5aa6b'],ink:'#79502c',line:'#a25143',cloth:'#0b242c',metal:'#d2ac66'},
 club:{edge:['#456c6c','#1c3f45','#0c242f'],wood:['#e7e5c3','#c9cfa9','#aab993'],ink:'#395b51',line:'#6c6651',cloth:'#091c28',metal:'#d8c28e'},
};
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
 rounded(b,2,2,996,996,49,ramp(b,[0,0],[1000,1000],theme.edge),'#080e18',4);
 rounded(b,15,15,970,970,39,'#37271c',theme.metal,1.7);
 rounded(b,30,30,940,940,31,ramp(b,[0,0],[1000,1000],theme.edge),'#f4e0ae66',1.3);
 rounded(b,67,67,866,866,13,ramp(b,[200,100],[800,950],theme.wood),'#2b2116',5);
 b.save();b.beginPath();if(b.roundRect)b.roundRect(70,70,860,860,9);else b.rect(70,70,860,860);b.clip();
 for(let i=0;i<140;i++){
  const y=72+i*6.2;
  b.beginPath();b.moveTo(65,y);b.bezierCurveTo(320,y+Math.sin(i*.7)*9,650,y+Math.cos(i*.3)*6,940,y+Math.sin(i)*4);
  b.strokeStyle=i%5?'#8052290a':'#80522918';b.lineWidth=i%5?.7:1.5;b.stroke();
 }
 b.restore();
 // Four engraved baselines, circles and corner arrows.
 for(let side=0;side<4;side++){
  b.save();b.translate(500,500);b.rotate(side*Math.PI/2);b.translate(-500,-500);
  rounded(b,200,794,600,39,18,null,theme.ink,2.2);
  line(b,220,803,780,803,theme.ink,1.2);line(b,220,825,780,825,theme.ink,2.3);
  for(const x of [220,780]){
   circle(b,x,814,20,theme.wood[0],theme.ink,2.3);
   circle(b,x,814,12,theme.line);
   circle(b,x,814,6,theme.wood[1]);
  }
  b.restore();
 }
 for(const [x,y] of POCKETS) {
  const dx=x<500?1:-1,dy=y<500?1:-1;
  line(b,x+dx*72,y+dy*72,x+dx*157,y+dy*157,theme.ink,2.2);
  const ax=x+dx*156,ay=y+dy*156;
  path(b,[[ax,ay],[ax-dx*19,ay-dy*4],[ax-dx*4,ay-dy*19]],theme.ink);
  const ring=b.createRadialGradient(x-5,y-5,20,x,y,53);
  ring.addColorStop(0,'#17222a');ring.addColorStop(.73,'#050f18');ring.addColorStop(.81,theme.metal);ring.addColorStop(1,'#382a1d');
  circle(b,x,y,53,ring);
  circle(b,x,y,41,'#06121c','#111c22',2);
  b.save();b.beginPath();b.arc(x,y,34,0,Math.PI*2);b.clip();
  for(let i=-4;i<=4;i++) {
   line(b,x-40,y+i*10,x+40,y+i*10,'#34414a70',1);
   line(b,x+i*10,y-40,x+i*10,y+40,'#34414a70',1);
  }
  b.restore();circle(b,x,y,40,null,'#b0916040',1);
 }
 circle(b,500,500,107,null,theme.ink,2.2);circle(b,500,500,96,null,theme.line,1.3);
 for(let i=0;i<12;i++){
  const a=i*Math.PI/6;
  const p=[500+Math.cos(a)*88,500+Math.sin(a)*88],q=[500+Math.cos(a+.07)*62,500+Math.sin(a+.07)*62],r=[500+Math.cos(a-.07)*62,500+Math.sin(a-.07)*62];
  path(b,[p,q,r],theme.line+'50');
 }
 circle(b,500,500,23,theme.line);circle(b,500,500,17,theme.wood[0],theme.ink,1.1);
 b.font='700 12px system-ui,sans-serif';b.letterSpacing='4px';b.textAlign='center';b.fillStyle=theme.ink+'99';
 b.fillText('B O S R A J   C A R R O M',500,652);
 return c;
}
const sprites=new Map();
function disc(kind) {
 if(sprites.has(kind))return sprites.get(kind);
 const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
 const c=canvas.getContext('2d'),r=49;
 const colors=kind==='light'?['#ffffec','#eed59d','#ad874e']:kind==='dark'?['#78828a','#263542','#101c28']:kind==='queen'?['#ffcfaa','#d6475b','#70243f']:['#ffffff','#dbe5d7','#91b2a4'];
 c.shadowColor='#07152599';c.shadowBlur=7;c.shadowOffsetY=4;
 circle(c,64,65,r,ramp(c,[38,20],[85,108],colors));
 c.shadowColor='transparent';circle(c,64,61,r-3,null,kind==='dark'?'#c5c5b044':'#fff9dbb0',2);
 circle(c,64,61,r-10,null,kind==='dark'?'#0a1621':'#947d494f',2);
 const hi=c.createRadialGradient(46,41,0,64,61,50);hi.addColorStop(0,'#ffffff70');hi.addColorStop(1,'#ffffff00');circle(c,64,61,r-4,hi);
 if(kind==='queen'||kind==='striker'){
  const pts=[];for(let i=0;i<16;i++){const a=i*Math.PI/8-Math.PI/2,rad=i%2?12:25;pts.push([64+Math.cos(a)*rad,61+Math.sin(a)*rad]);}
  path(c,pts,kind==='queen'?'#f6d38f':'#417b75',kind==='queen'?'#ffedba':'#ffffff',1);
  circle(c,64,61,5,kind==='queen'?'#9a3643':'#d9e7db');
 }
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
   ctx.save();ctx.setLineDash([10,10]);line(ctx,from.x,from.y,to.x,to.y,'#ffffffb8',2.8);ctx.restore();
   circle(ctx,to.x,to.y,s.striker.r,null,'#ffffffa8',1.5);
   if(guide.target) {
    const p=view(guide.target,seat),dx=p.x-to.x,dy=p.y-to.y,d=Math.hypot(dx,dy);
    if(d>.001)line(ctx,p.x,p.y,p.x+dx/d*125,p.y+dy/d*125,'#8bc9bb',3);
   }
   circle(ctx,from.x,from.y,s.striker.r+9,null,'#fff4ba',2.5);
   const end={x:from.x-Math.cos(angle+(seat?Math.PI:0))*(45+power*90),y:from.y-Math.sin(angle+(seat?Math.PI:0))*(45+power*90)};
   line(ctx,from.x,from.y,end.x,end.y,'#4b685995',7);
  }
  for(const b of [...s.coins,s.striker]){
   if(b.pocketed)continue;
   const p=view(b,seat),r=b.r*1.22;
   ctx.drawImage(disc(b.kind),p.x-r,p.y-r,r*2,r*2);
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
