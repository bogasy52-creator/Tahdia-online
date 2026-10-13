/* A floating steering origin, independent of the position of any UI pad. */
export class ArenaGestures {
 constructor({steer=()=>{},end=()=>{}}={}){this.steer=steer;this.end=end;this.pointers=new Map();}
 start(e,rect,duo=false){
  const x=e.clientX-rect.left,y=e.clientY-rect.top;
  const index=duo?Number(rect.width>rect.height?x>=rect.width/2:y>=rect.height/2):0;
  if([...this.pointers.values()].some(p=>p.index===index))return null;
  this.pointers.set(e.pointerId,{index,x:e.clientX,y:e.clientY});return index;
 }
 move(e){
  const p=this.pointers.get(e.pointerId);if(!p)return null;
  const dx=e.clientX-p.x,dy=e.clientY-p.y,d=Math.hypot(dx,dy);if(d<4)return p.index;
  this.steer(p.index,Math.atan2(dy,dx));
  if(d>52){p.x=e.clientX-dx/d*52;p.y=e.clientY-dy/d*52;}return p.index;
 }
 stop(id){const p=this.pointers.get(id);if(!p)return null;this.pointers.delete(id);this.end(p.index);return p.index;}
 clear(){for(const id of [...this.pointers.keys()])this.stop(id);}
}
