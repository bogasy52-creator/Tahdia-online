/* Direct swipe steering: a change of finger direction takes effect immediately. */
export class ArenaGestures {
 constructor({steer=()=>{},end=()=>{}}={}){this.steer=steer;this.end=end;this.pointers=new Map();}
 start(e,rect,duo=false){
  const x=e.clientX-rect.left,y=e.clientY-rect.top;
  const index=duo?Number(rect.width>rect.height?x>=rect.width/2:y>=rect.height/2):0;
  if([...this.pointers.values()].some(p=>p.index===index))return null;
  this.pointers.set(e.pointerId,{index,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,angle:null});return index;
 }
 move(e){
  const p=this.pointers.get(e.pointerId);if(!p)return null;
  const dx=e.clientX-p.lastX,dy=e.clientY-p.lastY,d=Math.hypot(dx,dy);if(d<3)return p.index;
  p.angle=Math.atan2(dy,dx);p.lastX=e.clientX;p.lastY=e.clientY;
  this.steer(p.index,p.angle);
  p.x=e.clientX;p.y=e.clientY;return p.index;
 }
 stop(id){const p=this.pointers.get(id);if(!p)return null;this.pointers.delete(id);this.end(p.index);return p.index;}
 clear(){for(const id of [...this.pointers.keys()])this.stop(id);}
}
