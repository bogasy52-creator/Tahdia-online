const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
// Paths are laid out around neighboring heads. Their real start and end
// cells still come from the game engine; only the space between is shaped.
const corridors={
 99:[[.18,.13]],95:[[.48,.13]],93:[[.85,.13]],
 87:[[.65,.25],[.52,.37],[.49,.51],[.38,.63]],
 62:[[.19,.46],[.12,.61],[.18,.74]],64:[[.30,.30],[.22,.25],[.11,.25],[.032,.30],[.032,.38]],
 68:[[.83,.41],[.87,.48]],54:[[.73,.51],[.70,.57]],17:[[.43,.88],[.57,.89]]
};
function spline(knots,t){
 const span=(knots.length-1)*t,index=Math.min(knots.length-2,Math.floor(span)),u=span-index;
 const p=knots[Math.max(0,index-1)],a=knots[index],b=knots[index+1],q=knots[Math.min(knots.length-1,index+2)];
 const axis=k=>.5*((2*a[k])+(-p[k]+b[k])*u+(2*p[k]-5*a[k]+4*b[k]-q[k])*u*u+(-p[k]+3*a[k]-3*b[k]+q[k])*u*u*u);
 return {x:axis('x'),y:axis('y')};
}
// Coordinates are real board pixels. Endpoints never drift during idle motion.
export function snakeGeometry(a,b,{width,height},{time=0,seed=0,motion=true,route=null}={}){
 const cell=width/10,side=a.x>width*.55?-1:1;
 const neck={x:a.x-side*cell*.31,y:a.y+cell*.23};
 const dx=b.x-neck.x,dy=b.y-neck.y,length=Math.hypot(dx,dy)||1,nx=-dy/length,ny=dx/length;
 const amplitude=cell*clamp(length/(cell*9),.30,.66),lobes=1;
 const knots=corridors[route]?[neck,...corridors[route].map(([x,y])=>({x:x*width,y:y*height})),b]:null;
 const points=Array.from({length:65},(_,i)=>{
  const t=i/64,fade=Math.sin(Math.PI*t);
  const bend=Math.sin(t*Math.PI*2*lobes)*amplitude*fade;
  const breath=motion?Math.sin(time/1800-t*4+seed*.8)*cell*.024*fade:0;
  const base=knots?spline(knots,t):{x:neck.x+dx*t+nx*bend,y:neck.y+dy*t+ny*bend};
  return {x:clamp(base.x+nx*breath,cell*.28,width-cell*.28),y:clamp(base.y+ny*breath,cell*.28,height-cell*.28)};
 });
 points[0]=neck;points[64]={...b};
 return {head:{...a},side,headWidth:cell*clamp(1.17+length/(cell*70),1.18,1.32),radius:cell*clamp(.21+length/(cell*110),.23,.28),points};
}
