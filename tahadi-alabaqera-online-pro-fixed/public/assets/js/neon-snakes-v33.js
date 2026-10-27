/* Detailed board creatures: tapered bodies, evenly spaced scales and restrained neon. */
const PALETTES={
 'snake-wild':['#52f1c5','#124e48'], 'snake-gold':['#f3cc78','#65502a'],
 'snake-aurora':['#c5a4ff','#443365'], 'snake-toxic':['#c2e88b','#415432'],
 'snake-ice':['#8fe2ef','#245264'], 'snake-plasma':['#ee9ed5','#633957'],
 'snake-sovereign':['#f8df9d','#44513d']
};
// Use arc length so scales stay the same size on short and long spline spans.
export function sampleNeonSpine(points,spacing){
 if(!Number.isFinite(spacing)||spacing<=0)throw new RangeError('Scale spacing must be positive');
 if(points.length<2)return points.map(p=>({...p}));const out=[{...points[0]}];let remaining=spacing;
 for(let i=1;i<points.length;i++){let a={...points[i-1]},b=points[i],length=Math.hypot(b.x-a.x,b.y-a.y);
  while(length>=remaining&&length>0){const t=remaining/length;a={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};out.push(a);length-=remaining;remaining=spacing;}
  remaining-=length;
 }const end=points.at(-1);if(Math.hypot(end.x-out.at(-1).x,end.y-out.at(-1).y)>.01)out.push({...end});return out;
}
function trace(c,points){c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));}
const girth=(r,t)=>r*(1.02+.12*Math.sin(t*Math.PI))*(1-.92*Math.pow(t,2.4));
function outline(c,points,r){
 const sides=[[],[]];for(let i=0;i<points.length;i++){const p=points[i],a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],length=Math.hypot(b.x-a.x,b.y-a.y)||1,nx=-(b.y-a.y)/length,ny=(b.x-a.x)/length,w=girth(r,i/(points.length-1));sides[0].push({x:p.x+nx*w,y:p.y+ny*w});sides[1].push({x:p.x-nx*w,y:p.y-ny*w});}
 trace(c,[...sides[0],...sides[1].reverse()]);c.closePath();
}
export function drawNeonBody(c,points,species,radius,active=false){
 const [light,dark]=PALETTES[species]||PALETTES['snake-wild'];c.save();c.lineCap='round';c.lineJoin='round';
 outline(c,points,radius*1.18);c.fillStyle='#07151e';c.fill();
 outline(c,points,radius);c.fillStyle=dark;c.fill();c.strokeStyle=light;c.lineWidth=Math.max(.8,radius*.14);c.shadowColor=light;c.shadowBlur=radius*(active?1.15:.5);c.stroke();c.shadowBlur=0;
 // Real scale plates, in two staggered rows instead of a ladder-shaped wireframe.
 const spine=sampleNeonSpine(points,Math.max(2,radius*.85));
 for(let i=1;i<spine.length-2;i++){
  const p=spine[i],a=spine[i-1],b=spine[i+1],t=i/(spine.length-1),w=girth(radius,t);if(w<radius*.24)continue;
  c.save();c.translate(p.x,p.y);c.rotate(Math.atan2(b.y-a.y,b.x-a.x));
  for(const sign of [-1,1]){c.save();c.translate((i%2)*w*.16,sign*w*.43);c.beginPath();c.moveTo(-w*.46,0);c.quadraticCurveTo(-w*.04,-w*.37,w*.4,0);c.quadraticCurveTo(-w*.04,w*.37,-w*.46,0);c.fillStyle=i%3===0?light:'#092830';c.globalAlpha=i%3===0?.24:.32;c.fill();c.globalAlpha=.48;c.strokeStyle=light;c.lineWidth=Math.max(.35,radius*.055);c.stroke();c.restore();}
  // A small dorsal diamond creates depth without a continuous bright tube.
  if(i%2===0){c.globalAlpha=.68;c.fillStyle=light;c.beginPath();c.moveTo(-w*.36,0);c.lineTo(0,-w*.2);c.lineTo(w*.36,0);c.lineTo(0,w*.2);c.closePath();c.fill();}c.restore();
 }
 // Interrupted, narrow highlight on the upper flank.
 c.globalAlpha=.4;trace(c,points.slice(0,Math.max(3,Math.floor(points.length*.75))).map((p,i)=>({x:p.x-radius*.16,y:p.y-radius*.24})));c.strokeStyle='#e8fff8';c.lineWidth=Math.max(.45,radius*.075);c.stroke();c.restore();
}
export function drawNeonHead(c,species,size){
 const [light,dark]=PALETTES[species]||PALETTES['snake-wild'];c.save();
 // Defined cheek plates, a narrow snout and a continuous neck connection.
 c.beginPath();c.moveTo(-size*.72,-size*.38);c.bezierCurveTo(-size*.32,-size*.75,size*.13,-size*.72,size*.5,-size*.43);c.quadraticCurveTo(size*.75,-size*.25,size*1.06,-size*.17);c.quadraticCurveTo(size*1.2,0,size*1.06,size*.17);c.quadraticCurveTo(size*.75,size*.25,size*.5,size*.43);c.bezierCurveTo(size*.13,size*.72,-size*.32,size*.75,-size*.72,size*.38);c.closePath();
 const shade=c.createLinearGradient(0,-size*.8,0,size*.8);shade.addColorStop(0,light);shade.addColorStop(.2,dark);shade.addColorStop(.6,'#102732');shade.addColorStop(1,dark);c.fillStyle=shade;c.fill();c.lineWidth=Math.max(.8,size*.045);c.strokeStyle=light;c.shadowColor=light;c.shadowBlur=size*.18;c.stroke();c.shadowBlur=0;
 // Crown plates: three inset diamonds with thin seams.
 for(const [x,y,k] of [[-.22,0,.22],[.13,0,.21],[.39,0,.15],[-.42,-.27,.14],[-.42,.27,.14]]){c.beginPath();c.moveTo(size*(x-k),size*y);c.lineTo(size*x,size*(y-k*.8));c.lineTo(size*(x+k),size*y);c.lineTo(size*x,size*(y+k*.8));c.closePath();c.globalAlpha=.5;c.fillStyle=dark;c.fill();c.strokeStyle=light;c.lineWidth=Math.max(.4,size*.022);c.stroke();}c.globalAlpha=1;
 // Recessed almond eyes with slit pupils and a small white catchlight.
 for(const sign of [-1,1]){c.save();c.translate(size*.43,sign*size*.29);c.rotate(sign*.3);c.fillStyle='#041119';c.beginPath();c.ellipse(0,0,size*.19,size*.13,0,0,Math.PI*2);c.fill();c.fillStyle='#e9f3b2';c.beginPath();c.ellipse(size*.015,0,size*.125,size*.085,0,0,Math.PI*2);c.fill();c.fillStyle='#03121b';c.fillRect(-size*.005,-size*.076,size*.027,size*.152);c.fillStyle='#fff';c.beginPath();c.arc(size*.04,-size*.026,size*.025,0,Math.PI*2);c.fill();c.restore();}
 // Nostrils and jaw line sharpen the snout at phone sizes.
 c.fillStyle='#020f16';for(const sign of [-1,1]){c.beginPath();c.ellipse(size*.91,sign*size*.095,size*.035,size*.02,sign*.2,0,Math.PI*2);c.fill();}
 c.strokeStyle=light;c.globalAlpha=.7;c.lineWidth=Math.max(.5,size*.027);c.beginPath();c.moveTo(size*.56,-size*.19);c.quadraticCurveTo(size*.7,0,size*1.07,0);c.quadraticCurveTo(size*.7,0,size*.56,size*.19);c.stroke();c.restore();
}
