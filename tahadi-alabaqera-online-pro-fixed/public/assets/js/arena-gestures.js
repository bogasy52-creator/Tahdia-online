/* Direct swipe steering: a change of finger direction takes effect immediately. */
export class ArenaGestures {
 constructor({mode='swipe',steer=()=>{},end=()=>{}}={}){this.mode=mode;this.steer=steer;this.end=end;this.pointers=new Map();}
 start(e,rect,duo=false){
  const x=e.clientX-rect.left,y=e.clientY-rect.top;
  const index=duo?Number(rect.width>rect.height?x>=rect.width/2:y>=rect.height/2):0;
  if([...this.pointers.values()].some(p=>p.index===index))return null;
  this.pointers.set(e.pointerId,{index,x:e.clientX,y:e.clientY,originX:e.clientX,originY:e.clientY,lastX:e.clientX,lastY:e.clientY,angle:null,knobX:0,knobY:0});return index;
 }
 move(e){
  const p=this.pointers.get(e.pointerId);if(!p)return null;
  if(this.mode==='joystick'||this.mode==='floating'){
   if(this.mode==='floating'){const dx=e.clientX-p.originX,dy=e.clientY-p.originY,d=Math.hypot(dx,dy);if(d>44){p.originX=e.clientX-dx/d*44;p.originY=e.clientY-dy/d*44;}}
   const dx=e.clientX-p.originX,dy=e.clientY-p.originY,d=Math.hypot(dx,dy),scale=Math.min(1,38/Math.max(1,d));
   p.knobX=dx*scale;p.knobY=dy*scale;
   if(d<(this.mode==='floating'?5:9))return p.index;
   const angle=Math.atan2(dy,dx),difference=p.angle===null?Infinity:Math.abs(Math.atan2(Math.sin(angle-p.angle),Math.cos(angle-p.angle)));
   if(difference>.045){p.angle=angle;this.steer(p.index,angle);}return p.index;
  }
  const dx=e.clientX-p.lastX,dy=e.clientY-p.lastY,d=Math.hypot(dx,dy);if(d<(this.mode==='free'?10:3))return p.index;
  p.angle=Math.atan2(dy,dx);p.lastX=e.clientX;p.lastY=e.clientY;
  this.steer(p.index,p.angle);
  p.x=e.clientX;p.y=e.clientY;return p.index;
 }
 stop(id){const p=this.pointers.get(id);if(!p)return null;this.pointers.delete(id);this.end(p.index);return p.index;}
 clear(){for(const id of [...this.pointers.keys()])this.stop(id);}
}
