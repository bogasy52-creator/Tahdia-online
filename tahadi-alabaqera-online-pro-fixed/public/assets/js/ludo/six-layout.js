// Six equal sectors: the same 13-square sector and five-square home column as classic Ludo.
const center={x:300,y:300},polar=(a,r)=>({x:300+Math.cos(a)*r,y:300+Math.sin(a)*r});
const alpha=24*Math.PI/180,sector=Math.PI/3,angle=s=>s*sector-2*Math.PI/3;
const vertices=[];
for(let s=0;s<6;s++){
 const tip=polar(angle(s),260),next=polar(angle(s+1),260),side=angle(s)+sector/2,u={x:Math.cos(side),y:Math.sin(side)};
 const meet=(p,a)=>{const v={x:Math.cos(a),y:Math.sin(a)},d=(162-(p.x-300)*u.x-(p.y-300)*u.y)/(v.x*u.x+v.y*u.y);return{x:p.x+v.x*d,y:p.y+v.y*d};};
 vertices.push({p:tip,r:15},{p:meet(tip,angle(s)+Math.PI-alpha),r:27},{p:meet(next,angle(s+1)+Math.PI+alpha),r:27});
}
const dense=[];
vertices.forEach(({p,r},i)=>{const prev=vertices[(i+vertices.length-1)%vertices.length].p,next=vertices[(i+1)%vertices.length].p,la=Math.hypot(p.x-prev.x,p.y-prev.y),lb=Math.hypot(next.x-p.x,next.y-p.y),da=Math.min(r,la*.45),db=Math.min(r,lb*.45),a={x:p.x+(prev.x-p.x)/la*da,y:p.y+(prev.y-p.y)/la*da},b={x:p.x+(next.x-p.x)/lb*db,y:p.y+(next.y-p.y)/lb*db};for(let k=0;k<=20;k++){const t=k/20;dense.push({x:(1-t)**2*a.x+2*(1-t)*t*p.x+t*t*b.x,y:(1-t)**2*a.y+2*(1-t)*t*p.y+t*t*b.y});}});
const loop=[...dense.slice(10),...dense.slice(0,11)],cum=[0];for(let i=1;i<loop.length;i++)cum.push(cum[i-1]+Math.hypot(loop[i].x-loop[i-1].x,loop[i].y-loop[i-1].y));
const steps=Array.from({length:78},(_,k)=>{const d=k*cum.at(-1)/78;let i=1;while(i<cum.length-1&&cum[i]<d)i++;const t=(d-cum[i-1])/(cum[i]-cum[i-1]);return{x:loop[i-1].x+(loop[i].x-loop[i-1].x)*t,y:loop[i-1].y+(loop[i].y-loop[i-1].y)*t};});
export const SIX_TRACK=Object.freeze(steps.map((_,i)=>Object.freeze(steps[(i+2)%78])));
export const SIX_LANES=Object.freeze(Array.from({length:6},(_,s)=>Array.from({length:5},(_,h)=>polar(angle(s),202-h*28))));
export const SIX_YARDS=Object.freeze(Array.from({length:6},(_,s)=>{const a=angle(s)+sector/2,p=polar(a,242),u={x:Math.cos(a),y:Math.sin(a)},v={x:-u.y,y:u.x};return{...p,slots:[[-1,-1],[1,-1],[-1,1],[1,1]].map(([x,y])=>({x:p.x+u.x*x*20+v.x*y*20,y:p.y+u.y*x*20+v.y*y*20}))};}));
export const sixAngle=angle;
export function sixRotate(p,viewer=0){const a=(210-viewer*60)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),x=p.x-center.x,y=p.y-center.y;return{x:300+x*c-y*s,y:300+x*s+y*c};}
export function sixSpot(state,seat,token,progress){
 if(progress<0)return{...SIX_YARDS[seat].slots[token],where:'yard'};
 if(progress>=82){const p=polar(angle(seat),65),a=angle(seat)+Math.PI/2,d=(token-1.5)*10;return{x:p.x+Math.cos(a)*d,y:p.y+Math.sin(a)*d,where:'home',small:true};}
 if(progress>=77)return{...SIX_LANES[seat][progress-77],where:'lane'};
 const cell=(seat*13+progress)%78;return{...SIX_TRACK[cell],where:'track',cell};
}
