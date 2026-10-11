/* Convert actual hole centres into a continuous stone path. */
export function createStonePathFrames(from,waypoints,to,{lift=5}={}){
 if(!from||!to)return [];
 const points=[from,...waypoints.filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y))];
 if(!points.length||Math.hypot(points.at(-1).x-to.x,points.at(-1).y-to.y)>.01)points.push(to);
 if(points.length<2)points.push(to);
 const count=points.length-1,frame=(p,offset,scale=1)=>({translate:`${p.x-to.x}px ${p.y-to.y}px`,offset,scale:String(scale)}),frames=[frame(points[0],0)];
 for(let i=0;i<count;i++){
  const a=points[i],b=points[i+1];frames.push(frame({x:(a.x+b.x)/2,y:(a.y+b.y)/2-lift},(i+.5)/count,1.08),frame(b,(i+1)/count));
 }
 return frames;
}
