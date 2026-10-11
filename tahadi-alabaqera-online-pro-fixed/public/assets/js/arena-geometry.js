const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
// Coordinates are real board pixels. Endpoints never drift during idle motion.
export function snakeGeometry(a,b,{width,height},{time=0,seed=0,motion=true}={}){
 const cell=width/10,side=a.x>width*.55?-1:1;
 const neck={x:a.x-side*cell*.31,y:a.y+cell*.23};
 const dx=b.x-neck.x,dy=b.y-neck.y,length=Math.hypot(dx,dy)||1,nx=-dy/length,ny=dx/length;
 const amplitude=cell*clamp(length/(cell*9),.30,.66),lobes=1;
 const points=Array.from({length:65},(_,i)=>{
  const t=i/64,fade=Math.sin(Math.PI*t);
  const bend=Math.sin(t*Math.PI*2*lobes)*amplitude*fade;
  const breath=motion?Math.sin(time/1800-t*4+seed*.8)*cell*.024*fade:0;
  return {x:clamp(neck.x+dx*t+nx*(bend+breath),cell*.12,width-cell*.12),y:clamp(neck.y+dy*t+ny*(bend+breath),cell*.12,height-cell*.12)};
 });
 points[0]=neck;points[64]={...b};
 return {head:{...a},side,headWidth:cell*1.52,radius:cell*clamp(.21+length/(cell*80),.23,.32),points};
}
