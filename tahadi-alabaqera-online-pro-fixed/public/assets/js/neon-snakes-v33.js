/* Tahdia 33.1.0 — neon board snakes.
   Each snake is a lit neon tube in its own colour: a soft halo, a dark glass
   body with a bright rim, a white-hot core and evenly spaced chevrons that point
   down the snake, the way a stone slides. Clean shapes and no busy scales, so
   the board stays tidy; the halo is layered fills (no blur filter), which keeps
   it cheap on phones. The heads are drawn too: no image sheet. */
const PALETTES={
 // [neon rim, white-hot core, dark glass]
 'snake-wild':['#3dff9a','#e2fff0','#04261a'],
 'snake-gold':['#ffbe2e','#fff4cf','#2a1904'],
 'snake-aurora':['#b27dff','#f0e6ff','#1b0d36'],
 'snake-toxic':['#c6ff33','#f4ffd6','#1d2905'],
 'snake-ice':['#3fb0ff','#e2f4ff','#061c33'],
 'snake-plasma':['#ff4fd6','#ffe2f7','#2e0625'],
 'snake-coral':['#ff6450','#ffe3dd','#320b06'],
 'snake-aqua':['#24f0d0','#dcfff8','#03282a'],
 'snake-sovereign':['#ffd76a','#fff7da','#0b291b']
};
export const NEON_SNAKE_COLORS=Object.freeze(Object.fromEntries(Object.entries(PALETTES).map(([id,[neon]])=>[id,neon])));
// Use arc length so the chevrons stay evenly spaced on short and long spline spans.
export function sampleNeonSpine(points,spacing){
 if(!Number.isFinite(spacing)||spacing<=0)throw new RangeError('Scale spacing must be positive');
 if(points.length<2)return points.map(p=>({...p}));const out=[{...points[0]}];let remaining=spacing;
 for(let i=1;i<points.length;i++){let a={...points[i-1]},b=points[i],length=Math.hypot(b.x-a.x,b.y-a.y);
  while(length>=remaining&&length>0){const t=remaining/length;a={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};out.push(a);length-=remaining;remaining=spacing;}
  remaining-=length;
 }const end=points.at(-1);if(Math.hypot(end.x-out.at(-1).x,end.y-out.at(-1).y)>.01)out.push({...end});return out;
}
function trace(c,points){c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));}
// Full at the neck, a slight belly, then a long fine tail.
const girth=(r,t)=>r*(1.02+.1*Math.sin(t*Math.PI))*(1-.9*Math.pow(t,2.2));
function outline(c,points,r){
 const sides=[[],[]];for(let i=0;i<points.length;i++){const p=points[i],a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],length=Math.hypot(b.x-a.x,b.y-a.y)||1,nx=-(b.y-a.y)/length,ny=(b.x-a.x)/length,w=girth(r,i/(points.length-1));sides[0].push({x:p.x+nx*w,y:p.y+ny*w});sides[1].push({x:p.x-nx*w,y:p.y-ny*w});}
 trace(c,[...sides[0],...sides[1].reverse()]);c.closePath();
}
export function drawNeonBody(c,points,species,radius,active=false){
 const [neon,core,glass]=PALETTES[species]||PALETTES['snake-wild'];c.save();c.lineCap='round';c.lineJoin='round';
 // the halo: two soft layers of the snake's own colour
 c.fillStyle=neon;c.globalAlpha=active?.2:.11;outline(c,points,radius*2);c.fill();
 c.globalAlpha=active?.3:.19;outline(c,points,radius*1.45);c.fill();c.globalAlpha=1;
 // the tube: dark glass inside a bright rim
 outline(c,points,radius);c.fillStyle=glass;c.fill();
 c.strokeStyle=neon;c.lineWidth=Math.max(1.1,radius*(active?.34:.27));c.stroke();
 // the white-hot core along the spine
 c.globalAlpha=.92;outline(c,points,radius*.3);c.fillStyle=core;c.fill();c.globalAlpha=1;
 // chevrons pointing down the snake (head → tail), the way a stone slides
 const spine=sampleNeonSpine(points,Math.max(3,radius*2.4));c.strokeStyle=neon;c.lineWidth=Math.max(.9,radius*.24);
 for(let i=2;i<spine.length-1;i++){
  const p=spine[i],a=spine[i-1],b=spine[i+1],t=i/(spine.length-1),w=girth(radius,t);if(w<radius*.42)break;
  c.save();c.translate(p.x,p.y);c.rotate(Math.atan2(b.y-a.y,b.x-a.x));
  c.beginPath();c.moveTo(-w*.5,-w*.66);c.lineTo(w*.2,0);c.lineTo(-w*.5,w*.66);c.stroke();c.restore();
 }
 c.restore();
}
// The head faces +x from the neck at the origin; the snout ends near 1.2 × size.
function headShape(c,s){
 c.beginPath();c.moveTo(-s*.62,-s*.4);
 c.bezierCurveTo(-s*.3,-s*.6,s*.12,-s*.74,s*.46,-s*.6);
 c.quadraticCurveTo(s*.92,-s*.38,s*1.16,-s*.08);
 c.quadraticCurveTo(s*1.24,0,s*1.16,s*.08);
 c.quadraticCurveTo(s*.92,s*.38,s*.46,s*.6);
 c.bezierCurveTo(s*.12,s*.74,-s*.3,s*.6,-s*.62,s*.4);
 c.closePath();
}
export function drawNeonHead(c,species,size){
 const [neon,core,glass]=PALETTES[species]||PALETTES['snake-wild'];c.save();c.lineJoin='round';c.lineCap='round';
 c.scale(1.14,1.14);
 // halo
 c.fillStyle=neon;c.globalAlpha=.15;c.save();c.translate(size*.28,0);c.scale(1.45,1.45);c.translate(-size*.28,0);headShape(c,size);c.fill();c.restore();
 c.globalAlpha=.26;c.save();c.translate(size*.28,0);c.scale(1.2,1.2);c.translate(-size*.28,0);headShape(c,size);c.fill();c.restore();c.globalAlpha=1;
 // glass head tinted with the snake's colour, and a bright rim
 headShape(c,size);c.fillStyle=glass;c.fill();c.globalAlpha=.24;c.fillStyle=neon;c.fill();c.globalAlpha=1;
 c.strokeStyle=neon;c.lineWidth=Math.max(1.2,size*.12);c.stroke();
 // the core runs on from the body to a crest diamond between the eyes
 c.strokeStyle=core;c.lineWidth=Math.max(.8,size*.1);c.globalAlpha=.9;c.beginPath();c.moveTo(-size*.62,0);c.lineTo(size*.08,0);c.stroke();
 c.fillStyle=core;c.beginPath();c.moveTo(size*.02,0);c.lineTo(size*.2,-size*.14);c.lineTo(size*.4,0);c.lineTo(size*.2,size*.14);c.closePath();c.fill();c.globalAlpha=1;
 // big glowing almond eyes with slit pupils
 for(const sign of [-1,1]){c.save();c.translate(size*.6,sign*size*.33);c.rotate(sign*.3);
  c.fillStyle=neon;c.globalAlpha=.5;c.beginPath();c.ellipse(0,0,size*.3,size*.22,0,0,Math.PI*2);c.fill();c.globalAlpha=1;
  c.fillStyle='#fffbe6';c.beginPath();c.ellipse(0,0,size*.21,size*.15,0,0,Math.PI*2);c.fill();
  c.fillStyle='#03060b';c.beginPath();c.ellipse(size*.02,0,size*.045,size*.13,0,0,Math.PI*2);c.fill();
  c.fillStyle='#ffffff';c.beginPath();c.arc(size*.08,-size*.06,Math.max(.5,size*.035),0,Math.PI*2);c.fill();c.restore();}
 // nostrils
 c.fillStyle=neon;for(const sign of [-1,1]){c.beginPath();c.arc(size*1.02,sign*size*.1,Math.max(.6,size*.04),0,Math.PI*2);c.fill();}
 c.restore();
}
