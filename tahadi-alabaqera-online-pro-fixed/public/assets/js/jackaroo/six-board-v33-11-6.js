// Six-player extension of the classic Jackaroo board: parallel finger edges,
// flat outer caps and circular valleys. Indexes retain the server's 19 places
// per sector (house + 1..18); this module changes no game rule or saved state.
const TURN=Math.PI/3,WIDTH=11,END=84,NECK=43,LABEL=6.1;
const round=n=>+n.toFixed(3);
const rotate=(p,a)=>({x:p.x*Math.cos(a)-p.y*Math.sin(a),y:p.x*Math.sin(a)+p.y*Math.cos(a)});
const place=(p,s)=>{const q=rotate(p,s*TURN);return{x:round(100+q.x),y:round(100+q.y)};};
export function jackarooSixLayout(arm=19){
 if(![13,18,19].includes(arm))throw new Error('unsupported_jackaroo_sector');
 const radius=NECK/Math.sqrt(3)-WIDTH,center={x:-WIDTH-radius,y:NECK},straight=END-NECK,arc=radius*2*TURN,cap=WIDTH*2;
 const segments=[{count:6,length:straight},{count:4,length:arc},{count:6,length:straight},{count:3,length:cap}];
 function sample(segment,t){
  if(segment===0)return{p:{x:-WIDTH,y:END-straight*t},n:{x:-1,y:0}};
  if(segment===1){const a=-t*2*TURN;return{p:{x:center.x+radius*Math.cos(a),y:center.y+radius*Math.sin(a)},n:{x:Math.cos(a),y:Math.sin(a)}};}
  if(segment===2)return{p:rotate({x:WIDTH,y:NECK+straight*t},TURN),n:rotate({x:1,y:0},TURN)};
  return{p:rotate({x:WIDTH-cap*t,y:END},TURN),n:rotate(t===0?{x:Math.SQRT1_2,y:Math.SQRT1_2}:{x:0,y:1},TURN)};
 }
 const quarter=[];
 if(arm===19)segments.forEach((segment,i)=>{for(let k=0;k<segment.count;k++)quarter.push(sample(i,k/segment.count));});
 else{const length=segments.reduce((n,s)=>n+s.length,0);for(let k=0;k<arm;k++){let d=k*length/arm,i=0;while(i<3&&d>=segments[i].length){d-=segments[i].length;i++;}quarter.push(sample(i,d/segments[i].length));}}
 const track=[],labels=[],lanes=[],finish=[],bases=[],seatsAt=[];
 for(let s=0;s<6;s++){
  quarter.forEach(({p,n},k)=>{track.push(place(p,s));const guide=arm===19&&(k===6||k===10)?{x:-n.x,y:-n.y}:n;labels.push(k?{...place({x:p.x+guide.x*LABEL,y:p.y+guide.y*LABEL},s),num:k}:null);});
  lanes.push([76,67,58,49].map(y=>place({x:0,y},s)));finish.push(place({x:0,y:40},s));
  bases.push([[-1,-1],[1,-1],[-1,1],[1,1]].map(([x,y])=>place({x:-29+x*4.2,y:58+y*4.2},s)));
  seatsAt.push(place({x:-40,y:70},s));
 }
 const step=Math.min(...track.map((p,i)=>{const q=track[(i+1)%track.length];return Math.hypot(p.x-q.x,p.y-q.y);}));
 return{kind:'cross-six',seats:6,arm,track,labels,lanes,finish,bases,seatsAt,hole:round(Math.min(2.55,step*.38)),step,segments,reference:'six-parallel-fingers'};
}
