// The classic three-column arm repeated six times. Indices and saved progress remain unchanged.
// 33.13.0: the yards sit nearer the arms (radius 210, not 239), so the board is drawn a quarter larger.
export const SIX_CELL=26;
const center={x:300,y:300},sector=Math.PI/3,angle=s=>s*sector-2*Math.PI/3;
const inner=SIX_CELL*(Math.sqrt(3)+1),tip=inner+5*SIX_CELL;
const local=(a,r,x=0)=>Object.defineProperty({x:300+Math.cos(a)*r-Math.sin(a)*x,y:300+Math.sin(a)*r+Math.cos(a)*x},'angle',{value:a*180/Math.PI});
const loop=[];
for(let s=0;s<6;s++){
 for(let k=0;k<6;k++)loop.push(local(angle(s),inner+k*SIX_CELL,-SIX_CELL));
 loop.push(local(angle(s),tip));
 for(let k=5;k>=0;k--)loop.push(local(angle(s),inner+k*SIX_CELL,SIX_CELL));
}
// Start is one square below the cap, just as in four-player Ludo. The home gate is two before start.
export const SIX_TRACK=Object.freeze(loop.map((_,i)=>Object.freeze(loop[(i+8)%78])));
export const SIX_LANES=Object.freeze(Array.from({length:6},(_,s)=>Object.freeze(Array.from({length:5},(_,h)=>Object.freeze(local(angle(s),tip-(h+1)*SIX_CELL))))));
export const SIX_YARDS=Object.freeze(Array.from({length:6},(_,s)=>{const a=angle(s)+sector/2,p=local(a,210),u={x:Math.cos(a),y:Math.sin(a)},v={x:-u.y,y:u.x};return Object.freeze({...p,angle:a*180/Math.PI,slots:Object.freeze([[-1,-1],[1,-1],[-1,1],[1,1]].map(([x,y])=>Object.freeze({x:p.x+u.x*x*20+v.x*y*20,y:p.y+u.y*x*20+v.y*y*20})))});}));
export const sixAngle=angle;
export function sixRotate(p,viewer=0){const a=(210-viewer*60)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),x=p.x-center.x,y=p.y-center.y;return{x:300+x*c-y*s,y:300+x*s+y*c};}
export function sixSpot(state,seat,token,progress){
 if(progress<0)return{...SIX_YARDS[seat].slots[token],where:'yard'};
 if(progress>=82){const p=local(angle(seat),52),a=angle(seat)+Math.PI/2,d=(token-1.5)*10;return{x:p.x+Math.cos(a)*d,y:p.y+Math.sin(a)*d,where:'home',small:true};}
 if(progress>=77)return{...SIX_LANES[seat][progress-77],where:'lane'};
 const cell=(seat*13+progress)%78;return{...SIX_TRACK[cell],where:'track',cell};
}
