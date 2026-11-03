// Four-seat games retain their original track; six-seat games have six equal arms.
// 33.6.0: a state may carry its own arm — a Jackaroo table of four has eighteen holes to a
// quarter (numbered 1–18 at every seat). Every other board, and every older game, keeps 13.
// 33.7.0: the board of the picture: 19 places to a seat (the house, then holes 1 to 18), and
// `home: 'fill'` — a marble's journey ends in the four holes of its home lane, one marble a
// hole, so the deepest hole is the finish. Games without it end one step past the lane.
export function boardGeometry(state=4){
 const count=typeof state==='number'?state:(state?.players?.length||4),seats=count>4?6:4,arm=Number.isInteger(state?.arm)&&state.arm>=13&&state.arm<=19?state.arm:13,track=seats*arm,fill=state?.home==='fill';
 return{seats,arm,track,fill,finish:track+(fill?3:4),starts:Array.from({length:seats},(_,i)=>i*arm),safe:new Set(Array.from({length:seats},(_,i)=>[i*arm,i*arm+8]).flat())};
}
export function boardStonePosition(seat,progress,state=4){
 const g=boardGeometry(state);if(progress<0||progress>=g.track)return null;return(g.starts[seat]+progress)%g.track;
}
// Separate stones at shared cells. Stable ordering prevents duplicate-looking counters.
export function stoneOffset(index,count,radius=3.8){if(count<2)return{x:0,y:0};const a=2*Math.PI*index/count-Math.PI/2;return{x:Math.cos(a)*radius,y:Math.sin(a)*radius};}
