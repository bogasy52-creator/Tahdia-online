// Four-seat games retain their original track; six-seat games have six equal arms.
export function boardGeometry(state=4){
 const count=typeof state==='number'?state:(state?.players?.length||4),seats=count>4?6:4,track=seats*13;
 return{seats,track,finish:track+4,starts:Array.from({length:seats},(_,i)=>i*13),safe:new Set(Array.from({length:seats},(_,i)=>[i*13,i*13+8]).flat())};
}
export function boardStonePosition(seat,progress,state=4){
 const g=boardGeometry(state);if(progress<0||progress>=g.track)return null;return(g.starts[seat]+progress)%g.track;
}
// Separate stones at shared cells. Stable ordering prevents duplicate-looking counters.
export function stoneOffset(index,count,radius=3.8){if(count<2)return{x:0,y:0};const a=2*Math.PI*index/count-Math.PI/2;return{x:Math.cos(a)*radius,y:Math.sin(a)*radius};}
